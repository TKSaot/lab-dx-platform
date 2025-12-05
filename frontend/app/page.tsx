"use client";

import { useState, useEffect } from "react";

// タスクの型定義（Backendのschemas.pyと合わせる）
interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  exp: number;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // APIのURL
  const API_URL = "http://127.0.0.1:8000";

  // 初回ロード時にタスクを取得
  useEffect(() => {
    fetchTasks();
  }, []);

  // タスク取得関数
  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/tasks/`);
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    }
  };

  // タスク追加関数
  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/tasks/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newTaskTitle,
          description: "フロントエンドから追加", // 仮の説明
          status: "todo",
        }),
      });

      if (res.ok) {
        setNewTaskTitle(""); // 入力欄をクリア
        fetchTasks(); // リストを再取得
      }
    } catch (error) {
      console.error("Failed to add task:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // タスク削除関数
  const deleteTask = async (id: number) => {
    try {
      await fetch(`${API_URL}/tasks/${id}`, { method: "DELETE" });
      fetchTasks();
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans text-gray-800">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">
            Research Lab DX
          </h1>
          <p className="text-gray-600">研究室・寮運営プラットフォーム</p>
        </header>

        {/* タスク追加フォーム */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <form onSubmit={addTask} className="flex gap-4">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="新しいタスクを入力..."
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isLoading ? "追加中..." : "追加"}
            </button>
          </form>
        </div>

        {/* タスクリスト表示エリア */}
        <div className="grid gap-4">
          <h2 className="text-xl font-bold border-b pb-2 mb-2">タスク一覧</h2>
          
          {tasks.length === 0 ? (
            <p className="text-center text-gray-500 py-8">タスクはまだありません</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500 flex justify-between items-center hover:shadow-md transition"
              >
                <div>
                  <h3 className="font-bold text-lg">{task.title}</h3>
                  <div className="flex gap-2 text-sm text-gray-500 mt-1">
                    <span className="bg-gray-200 px-2 py-0.5 rounded text-xs uppercase">
                      {task.status}
                    </span>
                    <span>EXP: {task.exp}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-bold px-3 py-1 border border-red-200 rounded hover:bg-red-50"
                >
                  削除
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}