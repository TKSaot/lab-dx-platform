import os
import shutil
from typing import List

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from openai import OpenAI
# .envファイルを利用する場合は python-dotenv をインストールし、以下のコメントアウトを外してください
# from dotenv import load_dotenv

import crud
import models
import schemas
from database import SessionLocal, engine

# 環境変数を読み込む（.envがある場合）
# load_dotenv()

# データベースのテーブルを作成
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS設定（フロントエンドとの通信許可）
origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# データベースセッションの依存関係
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- OpenAIクライアント設定 ---
# 環境変数からAPIキーを取得、なければ空文字
# 動作確認時はここに直接 "sk-..." と書いても動きますが、Gitに上げる際は環境変数推奨です
api_key = os.getenv("OPENAI_API_KEY")
client = None

if api_key:
    client = OpenAI(api_key=api_key)

@app.get("/")
def read_root():
    return {"message": "Lab DX Platform API is running!"}

# --- 議事録（音声文字起こし）API ---
@app.post("/upload-audio/")
async def upload_audio(file: UploadFile = File(...)):
    """
    音声ファイルを受け取り、Whisperで文字起こしし、GPTで要約する
    """
    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = f"{temp_dir}/{file.filename}"

    try:
        # 1. アップロードされたファイルを一時保存
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. デモモード判定（APIキーがない場合）
        if not client:
            return {
                "filename": file.filename,
                "transcription": "【デモモード】APIキー未設定のためダミーを表示中。\n(本来はここにWhisperの文字起こし結果が表示されます)",
                "summary": "【デモ要約】\n- APIキーが設定されていません\n- 音声認識機能はスキップされました\n- サーバーログを確認してください"
            }

        # 3. Whisper API (文字起こし)
        with open(temp_file_path, "rb") as audio_file:
            transcript_response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        transcribed_text = transcript_response.text

        # 4. GPT API (要約)
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "あなたは優秀な書記です。以下の会議音声を読みやすい議事録（箇条書き）に要約してください。"},
                {"role": "user", "content": transcribed_text}
            ]
        )
        summary_text = completion.choices[0].message.content

        return {
            "filename": file.filename,
            "transcription": transcribed_text,
            "summary": summary_text
        }

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 一時ファイルの削除（クリーンアップ）
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

# --- タスク関連API ---

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