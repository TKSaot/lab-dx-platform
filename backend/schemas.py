from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 共通のベースクラス
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "todo"

# タスク作成時に受け取るデータ
class TaskCreate(TaskBase):
    pass

# APIが返すデータ（IDや作成日時を含む）
class Task(TaskBase):
    id: int
    exp: int
    created_at: datetime

    class Config:
        # ORM（SQLAlchemy）のモデルを読み取れるようにする設定
        from_attributes = True