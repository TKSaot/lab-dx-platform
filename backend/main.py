import os
import shutil
import json
from typing import List

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from openai import OpenAI
from dotenv import load_dotenv

import crud
import models
import schemas
from database import SessionLocal, engine

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
async def upload_audio(
    file: UploadFile = File(...),
    mode: str = Form("summary"),       # "summary" (要約) or "proofread" (文字起こし修正)
    summary_level: str = Form("standard") # "short", "standard", "long"
):
    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = f"{temp_dir}/{file.filename}"

    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        if not client:
            return {
                "filename": file.filename,
                "transcription": "【デモ】APIキー未設定",
                "summary": "APIキーを設定してください。",
                "action_items": []
            }

        # 1. Whisperで文字起こし
        with open(temp_file_path, "rb") as audio_file:
            transcript_response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        transcribed_text = transcript_response.text

        # 2. GPTへの指示を作成（モードとレベルに応じて分岐）
        base_instruction = "あなたは優秀な会議の書記です。入力された音声テキストから、以下のJSON形式でデータを出力してください。"
        
        json_format_instruction = """
        必ず有効なJSONのみを返してください。Markdown記法は不要です。
        {
            "summary": "出力テキスト",
            "action_items": ["タスク1", "タスク2"]
        }
        """

        # モード別のプロンプト構築
        if mode == "proofread":
            # 文字起こし修正モード
            specific_instruction = """
            【指示】
            入力されたテキストの内容を要約せず、そのまま**「誤字脱字の修正」「てにをはの修正」「読みやすさの改善」**のみを行ってください。
            発言内容は削除せず、日本語として自然な文章に整えてください。
            "summary"フィールドに修正後の全文を入れてください。
            """
        else:
            # 要約モード (summary_levelで調整)
            length_instruction = "標準的な長さで要約してください。"
            if summary_level == "short":
                length_instruction = "要点を絞り、非常に簡潔に（3行程度で）要約してください。"
            elif summary_level == "long":
                length_instruction = "詳細は省かず、詳細な情報を残して長めに要約してください。"
            
            specific_instruction = f"""
            【指示】
            入力されたテキストを議事録として要約してください。
            **{length_instruction}**
            "summary"フィールドに要約を入れてください。
            """

        system_prompt = f"{base_instruction}\n{specific_instruction}\n{json_format_instruction}\naction_itemsには、誰かがやるべき具体的な作業を抽出してください。"

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": transcribed_text}
            ],
            response_format={"type": "json_object"}
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

# --- タスクAPI (変更なし) ---
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