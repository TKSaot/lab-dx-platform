from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    status = Column(String, default="todo")  # todo, doing, done
    
    # 将来のゲーミフィケーション用: タスク完了時の獲得経験値
    exp = Column(Integer, default=10)
    
    # 作成日時（自動設定）
    created_at = Column(DateTime(timezone=True), server_default=func.now())