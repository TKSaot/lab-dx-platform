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

interface UserStats {
  level: number;
  total_exp: number;
  next_level_exp_req: number;
  progress_percentage: number;
}

interface TranscriptionResult {
  filename: string;
  transcription: string;
  summary: string;
}

export default function Home() {
  const API_URL = "http://127.0.0.1:8000";

  // --- State ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null); // レベル情報
  const [newTaskTitle, setNewTaskTitle] = useState("");
  
  // 議事録関連
  const [file, setFile] = useState<File | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);

  // --- 初期化 ---
  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, []);

  // --- データ取得 ---
  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/tasks/`);
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/stats/`);
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  // --- アクション ---
  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;
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
    }
  };

  // タスク完了・未完了切り替え
  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    try {
      await fetch(`${API_URL}/tasks/${task.id}/status?status=${newStatus}`, {
        method: "PUT",
      });
      fetchTasks();
      fetchStats(); // 経験値が変わるので更新
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const deleteTask = async (id: number) => {
    await fetch(`${API_URL}/tasks/${id}`, { method: "DELETE" });
    fetchTasks();
  };

  // 議事録アップロード
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
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
      const data = await res.json();
      setTranscriptionResult(data);
    } catch (error) {
      console.error("Error uploading audio:", error);
      alert("処理に失敗しました。");
    } finally {
      setIsProcessingAudio(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* --- ヘッダー & ゲーミフィケーションバー --- */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-slate-800">Research Lab DX</h1>
            
            {/* レベル表示バッジ */}
            {stats && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Level</div>
                  <div className="text-2xl font-black text-blue-600 leading-none">{stats.level}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total EXP</div>
                  <div className="text-xl font-bold text-slate-700 leading-none">{stats.total_exp}</div>
                </div>
              </div>
            )}
          </div>

          {/* 経験値プログレスバー */}
          {stats && (
            <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-1000 ease-out"
                style={{ width: `${stats.progress_percentage}%` }}
              ></div>
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500 mix-blend-multiply">
                NEXT LEVEL: {100 - stats.progress_percentage} EXP
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* 左カラム：議事録生成 */}
        <section className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-600">
              <span>🎙️</span> 議事録自動生成
            </h2>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition">
              <input type="file" accept="audio/*" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"/>
            </div>
            <button onClick={uploadAudio} disabled={!file || isProcessingAudio} className="mt-4 w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition disabled:opacity-50">
              {isProcessingAudio ? "AI解析中..." : "解析して要約"}
            </button>
          </div>

          {transcriptionResult && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
              <h3 className="font-bold text-lg mb-3">📝 要約結果</h3>
              <div className="bg-yellow-50 p-4 rounded-lg text-sm whitespace-pre-wrap">{transcriptionResult.summary}</div>
            </div>
          )}
        </section>

        {/* 右カラム：タスク管理（ゲーミフィケーション付き） */}
        <section className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-600">
              <span>🚀</span> タスク＆クエスト
            </h2>
            
            <form onSubmit={addTask} className="flex gap-2 mb-6">
              <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="新しいクエストを追加..." className="flex-1 p-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 transition">+</button>
            </form>

            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className={`p-3 rounded-lg flex justify-between items-center transition border ${task.status === "done" ? "bg-slate-50 border-slate-100" : "bg-white border-slate-200 shadow-sm hover:shadow-md"}`}>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleTaskStatus(task)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${task.status === "done" ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 hover:border-blue-500"}`}
                    >
                      {task.status === "done" && "✓"}
                    </button>
                    <div>
                      <div className={`font-semibold ${task.status === "done" ? "text-slate-400 line-through" : "text-slate-800"}`}>
                        {task.title}
                      </div>
                      <div className="text-xs text-slate-400">報酬: {task.exp} EXP</div>
                    </div>
                  </div>
                  <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500 px-2">×</button>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}