from sqlalchemy.orm import Session
from sqlalchemy import func
import models
import schemas

# 全タスクの取得
def get_tasks(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Task).offset(skip).limit(limit).all()

# タスクの作成
def create_task(db: Session, task: schemas.TaskCreate):
    db_task = models.Task(
        title=task.title,
        description=task.description,
        status=task.status,
        exp=20  # タスク1つにつき20EXP（固定）
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

# タスクの削除
def delete_task(db: Session, task_id: int):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if db_task:
        db.delete(db_task)
        db.commit()
        return True
    return False

# ステータスの更新
def update_task_status(db: Session, task_id: int, status: str):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if db_task:
        db_task.status = status
        db.commit()
        db.refresh(db_task)
    return db_task

# --- 追加: ゲーミフィケーション用 ---
def get_total_exp(db: Session):
    # ステータスが "done" のタスクのEXPを合計する
    result = db.query(func.sum(models.Task.exp)).filter(models.Task.status == "done").scalar()
    return result if result else 0