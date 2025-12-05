"use client";

import { useState, useEffect } from "react";

// --- 型定義 ---
interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  exp: number;
}

interface TranscriptionResult {
  filename: string;
  transcription: string;
  summary: string;
}

export default function Home() {
  const API_URL = "http://127.0.0.1:8000";

  // --- State (状態管理) ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  
  // 議事録機能用のState
  const [file, setFile] = useState<File | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isTaskLoading, setIsTaskLoading] = useState(false);

  // --- 初期化 ---
  useEffect(() => {
    fetchTasks();
  }, []);

  // --- タスク関連の関数 ---
  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/tasks/`);
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    setIsTaskLoading(true);
    try {
      await fetch(`${API_URL}/tasks/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTaskTitle, status: "todo" }),
      });
      setNewTaskTitle("");
      fetchTasks();
    } catch (error) {
      console.error("Failed to add task:", error);
    } finally {
      setIsTaskLoading(false);
    }
  };

  const deleteTask = async (id: number) => {
    await fetch(`${API_URL}/tasks/${id}`, { method: "DELETE" });
    fetchTasks();
  };

  // --- 議事録関連の関数 ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const uploadAudio = async () => {
    if (!file) return;
    setIsProcessingAudio(true);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/upload-audio/`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) throw new Error("Upload failed");
      
      const data = await res.json();
      setTranscriptionResult(data);
    } catch (error) {
      console.error("Error uploading audio:", error);
      alert("処理に失敗しました。Backendが起動しているか確認してください。");
    } finally {
      setIsProcessingAudio(false);
    }
  };

  // --- レンダリング ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="bg-blue-600 text-white p-6 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Research Lab DX</h1>
            <p className="opacity-90 text-sm">研究室・寮運営のための統合プラットフォーム</p>
          </div>
          <div className="text-right text-sm">
             <span className="bg-blue-500 px-3 py-1 rounded-full">Dev Mode</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* 左カラム：議事録生成機能 */}
        <section className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-600">
              <span>🎙️</span> 議事録自動生成
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              会議の録音データをアップロードすると、AIが文字起こしと要約を行います。
            </p>
            
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition">
              <input 
                type="file" 
                accept="audio/*" 
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <button
              onClick={uploadAudio}
              disabled={!file || isProcessingAudio}
              className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {isProcessingAudio ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  解析中... (これには時間がかかります)
                </>
              ) : "解析開始"}
            </button>
          </div>

          {/* 結果表示エリア */}
          {transcriptionResult && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
              <h3 className="font-bold text-lg mb-3">📝 要約結果</h3>
              <div className="bg-yellow-50 p-4 rounded-lg text-sm text-slate-700 whitespace-pre-wrap leading-relaxed border border-yellow-100">
                {transcriptionResult.summary}
              </div>
              
              <details className="mt-4">
                <summary className="text-xs text-slate-400 cursor-pointer hover:text-blue-500">原文（文字起こし）を見る</summary>
                <div className="mt-2 p-3 bg-slate-50 rounded text-xs text-slate-500 max-h-40 overflow-y-auto">
                  {transcriptionResult.transcription}
                </div>
              </details>
            </div>
          )}
        </section>

        {/* 右カラム：タスク管理機能 */}
        <section className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-600">
              <span>✅</span> タスク管理
            </h2>
            
            <form onSubmit={addTask} className="flex gap-2 mb-6">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="新しいタスク..."
                className="flex-1 p-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button 
                type="submit" 
                disabled={isTaskLoading}
                className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 transition"
              >
                +
              </button>
            </form>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {tasks.map((task) => (
                <div key={task.id} className="group bg-white border border-slate-200 p-3 rounded-lg flex justify-between items-center hover:shadow-md transition">
                  <div>
                    <div className="font-semibold text-slate-800">{task.title}</div>
                    <div className="text-xs text-slate-400 mt-1 flex gap-2">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 uppercase">{task.status}</span>
                      <span className="text-yellow-600">★ {task.exp} EXP</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition px-2"
                  >
                    🗑️
                  </button>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-center text-slate-400 py-4 text-sm">タスクはありません</p>
              )}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}