import os
import shutil
import json
from typing import List

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from openai import OpenAI
# ★追加: .envファイルを読み込むためのライブラリ
from dotenv import load_dotenv

import crud
import models
import schemas
from database import SessionLocal, engine

# ★追加: 環境変数を読み込む（これが.envの中身をプログラムに取り込みます）
load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 環境変数からAPIキーを取得
api_key = os.getenv("OPENAI_API_KEY")
client = None

if api_key:
    client = OpenAI(api_key=api_key)
else:
    print("Warning: OPENAI_API_KEY not found in environment variables.")

@app.get("/")
def read_root():
    return {"message": "Lab DX Platform API is running!"}

@app.get("/stats/")
def get_user_stats(db: Session = Depends(get_db)):
    total_exp = crud.get_total_exp(db)
    current_level = (total_exp // 100) + 1
    next_level_exp_req = current_level * 100
    progress = total_exp % 100

    title = "見習い研究員"
    if current_level >= 3: title = "駆け出しのエンジニア"
    if current_level >= 5: title = "ラボの主力メンバー"
    if current_level >= 10: title = "プロジェクトリーダー"
    if current_level >= 20: title = "伝説の技術者"

    return {
        "level": current_level,
        "total_exp": total_exp,
        "next_level_exp_req": next_level_exp_req,
        "progress_percentage": progress,
        "title": title
    }

# --- 議事録＆タスク抽出API ---
@app.post("/upload-audio/")
async def upload_audio(file: UploadFile = File(...)):
    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = f"{temp_dir}/{file.filename}"

    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # デモモード（APIキーなし）
        if not client:
            return {
                "filename": file.filename,
                "transcription": "【デモ】APIキー未設定のためダミーを表示中。",
                "summary": "これはデモ用の要約です。APIキーを設定すると、ここにAIによる要約が表示されます。",
                "action_items": ["APIキーを設定する", "マイクのテストを行う", "チームに共有する"]
            }

        # 1. Whisperで文字起こし
        with open(temp_file_path, "rb") as audio_file:
            transcript_response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        transcribed_text = transcript_response.text

        # 2. GPTで要約とタスク抽出（JSONモード指定）
        system_prompt = """
        あなたは会議の書記です。入力された音声テキストから、以下のJSON形式でデータを出力してください。
        必ず有効なJSONのみを返してください。Markdown記法は不要です。
        
        {
            "summary": "会議の要約（箇条書きで分かりやすく）",
            "action_items": ["タスク1", "タスク2", "タスク3"]
        }
        
        action_itemsには、誰かがやるべき具体的な作業を抽出してください。なければ空配列にしてください。
        """

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": transcribed_text}
            ],
            response_format={"type": "json_object"} # JSONモードを強制
        )
        
        result_json_str = completion.choices[0].message.content
        result_data = json.loads(result_json_str)

        return {
            "filename": file.filename,
            "transcription": transcribed_text,
            "summary": result_data.get("summary", ""),
            "action_items": result_data.get("action_items", [])
        }

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

# --- タスクAPI ---
@app.post("/tasks/", response_model=schemas.Task)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    return crud.create_task(db=db, task=task)

@app.get("/tasks/", response_model=List[schemas.Task])
def read_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_tasks(db, skip=skip, limit=limit)

@app.put("/tasks/{task_id}/status", response_model=schemas.Task)
def update_task_status(task_id: int, status: str, db: Session = Depends(get_db)):
    updated_task = crud.update_task_status(db, task_id, status)
    if not updated_task:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated_task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    success = crud.delete_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"detail": "Task deleted"}