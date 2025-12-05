"use client";

import { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { motion, AnimatePresence } from "framer-motion"; // アニメーション用
import { Toaster, toast } from 'react-hot-toast'; // 通知用

// --- 型定義 ---
interface Task {
  id: number;
  title: string;
  description: string | null;
  status: "todo" | "doing" | "done";
  exp: number;
}

interface UserStats {
  level: number;
  total_exp: number;
  next_level_exp_req: number;
  progress_percentage: number;
  title: string;
}

interface TranscriptionResult {
  filename: string;
  transcription: string;
  summary: string;
  action_items: string[];
}

// --- 効果音関数 ---
const playSound = (type: "success" | "drop" | "pop" | "cancel") => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  if (type === "success") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start();
    osc.stop(now + 0.3);
  } else if (type === "pop") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc.start();
    osc.stop(now + 0.05);
  } else if (type === "cancel") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start();
    osc.stop(now + 0.2);
  } else {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(300, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start();
    osc.stop(now + 0.1);
  }
};

export default function Home() {
  const API_URL = "http://127.0.0.1:8000";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true); // 全体のロード状態
  
  const [file, setFile] = useState<File | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  
  const [mode, setMode] = useState<"summary" | "proofread">("summary");
  const [summaryLevel, setSummaryLevel] = useState<"short" | "standard" | "long">("standard");
  
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // 初期データのロード
    const init = async () => {
      await Promise.all([fetchTasks(), fetchStats()]);
      setIsLoading(false);
    };
    init();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/tasks/`);
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      toast.error("タスクの取得に失敗しました");
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/stats/`);
      const data = await res.json();
      if (stats && data.level > stats.level) {
        triggerLevelUpConfetti();
        playSound("success");
        toast.success(`レベルアップ！ Lv.${data.level}`, { icon: '🎉' });
      }
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const addTask = async (title: string) => {
    if (!title) return;
    try {
      await fetch(`${API_URL}/tasks/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title, status: "todo" }),
      });
      setNewTaskTitle("");
      fetchTasks();
      playSound("drop");
      toast.success("クエストを追加しました");
    } catch (error) {
      console.error("Failed to add task:", error);
      toast.error("追加に失敗しました");
    }
  };

  const handleAddTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTask(newTaskTitle);
  };

  const updateStatus = async (taskId: number, newStatus: string) => {
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));
      await fetch(`${API_URL}/tasks/${taskId}/status?status=${newStatus}`, { method: "PUT" });
      if (newStatus === "done") {
        triggerCompletionConfetti();
        playSound("success");
        toast.success("クエスト完了！ EXP獲得！", { icon: '✨' });
      } else {
        playSound("drop");
      }
      fetchStats();
    } catch (error) {
      console.error("Failed to update status:", error);
      fetchTasks();
      toast.error("更新に失敗しました");
    }
  };

  const deleteTask = async (id: number) => {
    if(!confirm("削除しますか？")) return;
    try {
      await fetch(`${API_URL}/tasks/${id}`, { method: "DELETE" });
      fetchTasks();
      toast("削除しました", { icon: '🗑️' });
    } catch (error) {
      toast.error("削除に失敗しました");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const taskId = Number(active.id);
    const newStatus = over.id as string;
    const currentTask = tasks.find(t => t.id === taskId);
    if (currentTask && currentTask.status !== newStatus) {
      updateStatus(taskId, newStatus);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const uploadAudio = async () => {
    if (!file) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsProcessingAudio(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);
    formData.append("summary_level", summaryLevel);

    const loadingToastId = toast.loading("AIが音声を解析中...");

    try {
      const res = await fetch(`${API_URL}/upload-audio/`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      setTranscriptionResult(data);
      playSound("success");
      toast.success("解析完了！", { id: loadingToastId });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast("中断しました", { id: loadingToastId, icon: '🛑' });
      } else {
        console.error("Error:", error);
        toast.error("エラーが発生しました", { id: loadingToastId });
      }
    } finally {
      setIsProcessingAudio(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      playSound("cancel");
      setIsProcessingAudio(false);
    }
  };

  const triggerCompletionConfetti = () => {
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ['#22c55e', '#facc15'] });
  };

  const triggerLevelUpConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  };

  const todoTasks = tasks.filter(t => t.status === 'todo');
  const doingTasks = tasks.filter(t => t.status === 'doing');
  const doneTasks = tasks.filter(t => t.status === 'done');

  // タスクレンダリング用のヘルパー関数
  // すべてのステータスで削除ボタンを表示するために使用します
  const renderTaskWithDelete = (task: Task) => (
    <div key={task.id} className="relative group/item">
      <DraggableTask task={task} />
      <motion.button 
        initial={{ opacity: 0 }} 
        // モバイル対応: 常に少し見えるようにするか、タップで反応させる。今回はPCのホバーを基本としつつ、タップしやすいサイズに。
        whileHover={{ opacity: 1, scale: 1.1 }} 
        whileTap={{ scale: 0.9 }}
        onClick={() => deleteTask(task.id)}
        className="absolute top-2 right-2 text-slate-300 hover:text-red-500 text-xs p-1 bg-white/80 rounded shadow-sm z-10 opacity-0 group-hover/item:opacity-100 transition-opacity"
        title="削除する"
      >
        🗑️
      </motion.button>
    </div>
  );

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <Toaster 
        position="bottom-right" 
        toastOptions={{ 
          duration: 3000, 
          style: { 
            background: '#fff', 
            color: '#1e293b', 
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            fontWeight: 'bold'
          } 
        }} 
      />
      
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 select-none">
        
        {/* Header */}
        <motion.header 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white shadow-sm sticky top-0 z-10 border-b border-slate-200"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex justify-between items-center mb-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-800">
                <span className="text-blue-600">L</span>ab <span className="text-blue-600">DX</span> Platform
              </h1>
              {stats ? (
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">称号</div>
                    <motion.div 
                      key={stats.title}
                      initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                      className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                    >
                      {stats.title}
                    </motion.div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">レベル</div>
                    <motion.div 
                      key={stats.level}
                      initial={{ scale: 1.5, color: "#2563eb" }} animate={{ scale: 1, color: "#1e293b" }}
                      className="text-3xl font-black leading-none"
                    >
                      {stats.level}
                    </motion.div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4 animate-pulse">
                  <div className="h-10 w-24 bg-slate-200 rounded"></div>
                  <div className="h-10 w-16 bg-slate-200 rounded"></div>
                </div>
              )}
            </div>
            {stats && (
              <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-purple-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.progress_percentage}%` }}
                  transition={{ type: "spring", stiffness: 50 }}
                />
              </div>
            )}
          </div>
        </motion.header>

        <main className="max-w-7xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Audio & Settings */}
          <section className="lg:col-span-4 space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"
            >
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-purple-600">
                <span>🎙️</span> 会議・議事録
              </h2>
              
              <div className="mb-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">処理モード</label>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    {["summary", "proofread"].map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m as any)}
                        className={`flex-1 py-2 text-sm font-bold rounded-md transition relative z-0 ${mode === m ? "text-purple-600 shadow-sm bg-white" : "text-slate-500 hover:text-slate-700"}`}
                      >
                         {m === "summary" ? "要約作成" : "文字起こし修正"}
                      </button>
                    ))}
                  </div>
                </div>

                {mode === "summary" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">要約レベル</label>
                    <div className="flex gap-2">
                      {["short", "standard", "long"].map((level) => (
                        <motion.button
                          key={level}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSummaryLevel(level as any)}
                          className={`flex-1 py-1.5 px-2 text-xs font-bold rounded border transition ${
                            summaryLevel === level 
                              ? "bg-purple-50 border-purple-200 text-purple-700" 
                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          {level === "short" ? "簡潔" : level === "standard" ? "標準" : "詳細"}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-purple-50 hover:border-purple-300 transition cursor-pointer group relative"
              >
                <input type="file" accept="audio/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" id="audio-upload"/>
                <div className="text-3xl mb-2 group-hover:scale-110 transition">📂</div>
                <div className="text-sm text-slate-500 font-medium">{file ? file.name : "音声をアップロード"}</div>
              </motion.div>
              
              <AnimatePresence mode="wait">
                {isProcessingAudio ? (
                  <motion.button 
                    key="cancel"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={handleCancel}
                    whileTap={{ scale: 0.95 }}
                    className="mt-4 w-full bg-red-100 text-red-600 py-3 rounded-xl font-bold hover:bg-red-200 transition flex items-center justify-center gap-2"
                  >
                    <span className="animate-pulse">🛑</span> 中断する
                  </motion.button>
                ) : (
                  <motion.button 
                    key="upload"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={uploadAudio} 
                    disabled={!file} 
                    whileTap={{ scale: 0.95 }}
                    className="mt-4 w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition shadow-lg shadow-purple-200 disabled:opacity-50 disabled:shadow-none"
                  >
                    実行する
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>

            <AnimatePresence>
              {transcriptionResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-3 border-b pb-2 flex justify-between items-center">
                      <span>{mode === "summary" ? "📝 要約結果" : "✨ 修正結果"}</span>
                      <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded">
                        {mode === "summary" ? `Level: ${summaryLevel}` : "Proofread"}
                      </span>
                    </h3>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                      {transcriptionResult.summary}
                    </div>
                  </div>

                  {transcriptionResult.action_items.length > 0 && (
                    <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-2xl shadow-sm border border-purple-100">
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-purple-800">
                        <span>🤖</span> AI提案タスク
                      </h3>
                      <div className="space-y-2">
                        {transcriptionResult.action_items.map((item, idx) => (
                          <motion.div 
                            key={idx} 
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white p-3 rounded-lg border border-purple-100 flex justify-between items-center shadow-sm"
                          >
                            <span className="text-sm font-medium text-slate-700">{item}</span>
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              onClick={() => { addTask(item); playSound("pop"); }}
                              className="bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1 rounded text-xs font-bold transition"
                            >
                              ＋追加
                            </motion.button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Right Column: Task Management */}
          <section className="lg:col-span-8">
            <motion.form 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onSubmit={handleAddTaskSubmit} 
              className="flex gap-3 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-slate-200"
            >
              <input 
                type="text" 
                value={newTaskTitle} 
                onChange={(e) => setNewTaskTitle(e.target.value)} 
                placeholder="新しいクエストを入力..." 
                className="flex-1 p-3 bg-transparent border-none focus:ring-0 text-slate-800 outline-none"
              />
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit" 
                className="bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 transition shadow-md shadow-blue-200"
              >
                追加
              </motion.button>
            </motion.form>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full min-h-[400px]">
              {isLoading ? (
                <>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-slate-100 p-4 rounded-2xl h-[300px] animate-pulse">
                      <div className="h-6 w-20 bg-slate-200 rounded mb-4"></div>
                      <div className="space-y-3">
                        <div className="h-20 bg-white rounded-xl"></div>
                        <div className="h-20 bg-white rounded-xl"></div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <DroppableColumn id="todo" title="未着手" count={todoTasks.length} bgColor="bg-slate-100">
                    <AnimatePresence>
                      {todoTasks.map(task => renderTaskWithDelete(task))}
                    </AnimatePresence>
                  </DroppableColumn>

                  <DroppableColumn id="doing" title="進行中" count={doingTasks.length} bgColor="bg-blue-50">
                    <AnimatePresence>
                      {doingTasks.map(task => renderTaskWithDelete(task))}
                    </AnimatePresence>
                  </DroppableColumn>

                  <DroppableColumn id="done" title="完了" count={doneTasks.length} bgColor="bg-green-50">
                    <AnimatePresence>
                      {doneTasks.map(task => renderTaskWithDelete(task))}
                    </AnimatePresence>
                  </DroppableColumn>
                </>
              )}
            </div>
          </section>

        </main>
      </div>
    </DndContext>
  );
}

// Components
function DroppableColumn({ id, title, count, children, bgColor }: { id: string, title: string, count: number, children: React.ReactNode, bgColor: string }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      ref={setNodeRef} 
      className={`${bgColor} p-4 rounded-2xl flex flex-col gap-3 min-h-[200px] transition-colors`}
    >
      <h3 className="font-bold text-slate-500 flex justify-between items-center mb-2">
        <span>{title}</span>
        <motion.span 
          key={count}
          initial={{ scale: 1.5 }} animate={{ scale: 1 }}
          className="bg-white/50 px-2 py-0.5 rounded-full text-xs text-slate-600"
        >
          {count}
        </motion.span>
      </h3>
      {children}
      {count === 0 && <div className="h-full flex items-center justify-center text-slate-300 text-sm font-bold border-2 border-dashed border-slate-200 rounded-xl p-4">タスクなし</div>}
    </motion.div>
  );
}

function DraggableTask({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(task.id) });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999 } : undefined;
  
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <motion.div
        layoutId={String(task.id)}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        className={`bg-white p-4 rounded-xl shadow-sm border border-slate-100 group cursor-grab active:cursor-grabbing touch-none ${isDragging ? 'opacity-50 rotate-3 scale-105 shadow-xl' : 'hover:shadow-md hover:-translate-y-1'} transition-all duration-200`}
      >
        <div className="font-bold text-slate-800 text-sm mb-2">{task.title}</div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded">+{task.exp} EXP</span>
          {task.status === "doing" && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded animate-pulse">NOW</span>}
        </div>
      </motion.div>
    </div>
  );
}