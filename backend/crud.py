from sqlalchemy.orm import Session
import models
import schemas

# 全タスクの取得
def get_tasks(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Task).offset(skip).limit(limit).all()

# タスクの作成
def create_task(db: Session, task: schemas.TaskCreate):
    # 将来的にはタスクの難易度に応じてexpを変えるロジックをここに入れます
    db_task = models.Task(
        title=task.title,
        description=task.description,
        status=task.status,
        exp=20  # 仮で固定の経験値を設定
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

# タスクの削除（オプション機能）
def delete_task(db: Session, task_id: int):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if db_task:
        db.delete(db_task)
        db.commit()
        return True
    return False

# ステータスの更新（ドラッグ&ドロップ用）
def update_task_status(db: Session, task_id: int, status: str):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if db_task:
        db_task.status = status
        db.commit()
        db.refresh(db_task)
    return db_task