// frontend/src/app/page.tsx
"use client";
import { useEffect, useState } from 'react';

export default function Home() {
  const [message, setMessage] = useState<string>("Loading...");

  useEffect(() => {
    // FastAPI (http://127.0.0.1:8000) からデータを取得
    fetch('http://127.0.0.1:8000/api/test')
      .then((res) => res.json())
      .then((data) => setMessage(data.data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h1>Lab DX Platform</h1>
      <p>Backend Status: <strong>{message}</strong></p>
    </div>
  );
}