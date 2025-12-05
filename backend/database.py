from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLiteデータベースのファイル場所を指定
SQLALCHEMY_DATABASE_URL = "sqlite:///./lab_dx.db"

# データベースエンジンの作成
# check_same_thread=False はSQLite特有の設定です
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# データベースセッションの作成
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# モデルクラスの継承元となるBaseクラス
Base = declarative_base()