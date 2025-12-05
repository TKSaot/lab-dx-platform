# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# フロントエンド(Next.js)からのアクセスを許可する設定
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

@app.get("/")
def read_root():
    return {"message": "Success! Backend is connected."}

@app.get("/api/test")
def test_api():
    # ここに後々、議事録データなどを入れます
    return {"status": "ok", "data": "Pythonからのデータです"}