from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

import crud
import models
import schemas
from database import SessionLocal, engine

# データベースのテーブルを作成（初回起動時に実行される）
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS設定（フロントエンドからのアクセス許可）
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

# データベースセッションを取得する依存関係
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Lab DX Platform API is running!"}

# --- タスク関連のAPI ---

@app.post("/tasks/", response_model=schemas.Task)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    return crud.create_task(db=db, task=task)

@app.get("/tasks/", response_model=List[schemas.Task])
def read_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tasks = crud.get_tasks(db, skip=skip, limit=limit)
    return tasks

@app.put("/tasks/{task_id}/status", response_model=schemas.Task)
def update_task_status(task_id: int, status: str, db: Session = Depends(get_db)):
    updated_task = crud.update_task_status(db, task_id, status)
    if updated_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated_task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    success = crud.delete_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"detail": "Task deleted"}