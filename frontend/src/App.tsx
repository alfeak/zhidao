/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Compass, MessageSquare, ClipboardList, Settings, BookOpen, Sparkles, Check, Server, Loader2, RefreshCw, Sun, Moon, ChevronLeft, ChevronRight, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Paper, MarkdownBlock, ChatMessage, HighlightRemark, SystemConfig } from './types';
import ImportModule from './components/ImportModule';
import PaperList from './components/PaperList';
import ReaderCore from './components/ReaderCore';
import LLMActionBar from './components/LLMActionBar';
import LLMSidebar from './components/LLMSidebar';

export default function App() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [activePaper, setActivePaper] = useState<Paper | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<MarkdownBlock | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [remarks, setRemarks] = useState<HighlightRemark[]>([]);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'result' | 'remarks' | 'config'>('result');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('zhidao-theme') as 'light' | 'dark') || 'light';
  });
  const [time, setTime] = useState('');

  useEffect(() => {
    localStorage.setItem('zhidao-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      setTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTabClick = (tab: 'chat' | 'result' | 'remarks' | 'config') => {
    if (isSidebarOpen && activeTab === tab) {
      setIsSidebarOpen(false);
    } else {
      setActiveTab(tab);
      setIsSidebarOpen(true);
    }
  };

  const [config, setConfig] = useState<SystemConfig>({
    models: [
      {
        id: 'model_default_openai',
        name: 'gpt-4o-mini',
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        isPrimary: true,
      },
    ],
  });
  const isPaperDecoded = !!(activePaper && activePaper.isDecoded);
  const prevDecodedRef = useRef(isPaperDecoded);

  // Sync tab options based on paper decoding status
  useEffect(() => {
    if (!isPaperDecoded && activeTab !== 'config') {
      setActiveTab('config');
    }
  }, [isPaperDecoded, activeTab]);

  // Automatically switch to result tab when current active paper becomes successfully decoded
  useEffect(() => {
    if (isPaperDecoded && !prevDecodedRef.current) {
      setActiveTab('result');
      setIsSidebarOpen(true);
    }
    prevDecodedRef.current = isPaperDecoded;
  }, [isPaperDecoded]);

  // Jump to analysis results tab automatically when action result changes
  useEffect(() => {
    if (actionResult) {
      setActiveTab('result');
      setIsSidebarOpen(true);
    }
  }, [actionResult]);

  // Fetch initial configs and papers list
  useEffect(() => {
    fetchConfig();
    fetchPapers();
  }, []);

  // Poll papers status if any paper is in pending or processing state
  useEffect(() => {
    const hasUnfinishedPaper = papers.some(
      (p) => p.decodeStatus === 'pending' || p.decodeStatus === 'processing'
    );

    if (hasUnfinishedPaper) {
      const interval = setInterval(() => {
        fetchPapersSilently();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [papers]);

  // Load chat and remarks when active paper changes
  useEffect(() => {
    if (activePaper) {
      fetchChatMessages(activePaper.id);
      fetchRemarks(activePaper.id);
      setSelectedBlock(null);
      setActionResult(null);
    } else {
      setChatMessages([]);
      setRemarks([]);
      setSelectedBlock(null);
      setActionResult(null);
    }
  }, [activePaper]);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      console.error('Error fetching config:', e);
    }
  };

  const handleUpdateConfig = async (newConfig: Partial<SystemConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated); // Optimistic UI
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
    } catch (e) {
      console.error('Error updating config:', e);
    }
  };

  const fetchPapers = async () => {
    try {
      const res = await fetch('/api/papers');
      if (res.ok) {
        const data = await res.json();
        setPapers(data);
        
        // Auto-select first paper if none is selected and papers exist
        if (data.length > 0 && !activePaper) {
          // Find paper that matches current active, or select first
          setActivePaper(data[0]);
        }
      }
    } catch (e) {
      console.error('Error fetching papers:', e);
    }
  };

  // Silently reload paper states (to update status badges)
  const fetchPapersSilently = async () => {
    try {
      const res = await fetch('/api/papers');
      if (res.ok) {
        const data = await res.json();
        setPapers(data);
        
        // Keep activePaper reference up-to-date with new status
        if (activePaper) {
          const updatedActive = data.find((p: any) => p.id === activePaper.id);
          if (updatedActive) {
            // Only trigger update if status or blocks changed to prevent unnecessary re-renders
            if (
              updatedActive.decodeStatus !== activePaper.decodeStatus ||
              updatedActive.mdBlocks.length !== activePaper.mdBlocks.length
            ) {
              setActivePaper(updatedActive);
            }
          }
        }
      }
    } catch (e) {
      console.error('Silent papers poll error:', e);
    }
  };

  const fetchChatMessages = async (paperId: string) => {
    try {
      const res = await fetch(`/api/papers/${paperId}/chat`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
      }
    } catch (e) {
      console.error('Error fetching chat messages:', e);
    }
  };

  const fetchRemarks = async (paperId: string) => {
    try {
      const res = await fetch(`/api/papers/${paperId}/remarks`);
      if (res.ok) {
        const data = await res.json();
        setRemarks(data);
      }
    } catch (e) {
      console.error('Error fetching remarks:', e);
    }
  };

  const handleSelectPaper = (paper: Paper) => {
    setActivePaper(paper);
  };

  const handleDeletePaper = async (id: string) => {
    try {
      const res = await fetch(`/api/papers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activePaper?.id === id) {
          setActivePaper(null);
        }
        fetchPapers();
      }
    } catch (e) {
      console.error('Error deleting paper:', e);
    }
  };

  const handleRetryDecode = async (id: string) => {
    try {
      const res = await fetch(`/api/papers/${id}/decode`, { method: 'POST' });
      if (res.ok) {
        fetchPapers();
      }
    } catch (e) {
      console.error('Error retrying decode:', e);
    }
  };

  const handleSendMessage = async (msg: string) => {
    if (!activePaper) return;
    
    const res = await fetch(`/api/papers/${activePaper.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || '大模型对话出错');
    }

    // Refresh chat messages
    fetchChatMessages(activePaper.id);
  };

  const handleClearChat = async () => {
    if (!activePaper) return;
    try {
      const res = await fetch(`/api/papers/${activePaper.id}/chat/clear`, {
        method: 'POST',
      });
      if (res.ok) {
        setChatMessages([]);
      }
    } catch (e) {
      console.error('Error clearing chat:', e);
    }
  };

  const handleAddRemark = async (blockId: string, comment: string, color: string) => {
    if (!activePaper) return;
    try {
      const res = await fetch('/api/remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperId: activePaper.id,
          blockId,
          comment,
          color,
        }),
      });

      if (res.ok) {
        fetchRemarks(activePaper.id);
      }
    } catch (e) {
      console.error('Error adding remark:', e);
    }
  };

  const handleDeleteRemark = async (remarkId: string) => {
    if (!activePaper) return;
    try {
      const res = await fetch(`/api/remarks/${remarkId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchRemarks(activePaper.id);
      }
    } catch (e) {
      console.error('Error deleting remark:', e);
    }
  };

  const handleExecuteAction = async (actionType: string, payload: any) => {
    if (!activePaper) return;
    setLoadingAction(actionType);
    setActionResult(null);

    try {
      const res = await fetch(`/api/papers/${activePaper.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          ...payload,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '解析操作失败');
      }

      const data = await res.json();
      setActionResult(data.result);
    } catch (err: any) {
      console.error('Action failed:', err);
      setActionResult(`### ⚠️ 解析操作发生错误\n\n${err.message || '大模型响应失败，请重试。'}`);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col min-h-0 bg-white dark:bg-slate-950 font-sans text-gray-800 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      {/* Platform Branding Top Header */}
      <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-5 select-none z-10 transition-colors duration-300 relative">
        <div className="flex items-center gap-3">
          {/* Custom Unique Logo "知道" - Crisp retro black-and-white editorial stamp */}
          <div className="flex items-center justify-center border-2 border-black dark:border-white bg-black dark:bg-white text-white dark:text-black px-3 py-0.5 font-display font-black text-base tracking-widest select-none rounded-[2px] shadow-sm transition-all duration-300 hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white cursor-pointer">
            知道
          </div>
        </div>

        {/* Middle of Header: Retro black-and-white minimalist monospaced clock */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
          <div className="font-mono text-sm font-bold tracking-widest text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3.5 py-1 rounded select-none shadow-xs flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full animate-pulse"></span>
            <span>{time || '00:00:00'}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Light/Dark Theme Switcher */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer flex items-center justify-center"
            title={theme === 'light' ? '切换到暗黑模式' : '切换到亮色模式'}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-slate-700" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>

          {/* Sidebar Toggle Button */}
          {activePaper && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition-all cursor-pointer ${
                isSidebarOpen
                  ? 'bg-black text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:text-black dark:hover:text-white'
              }`}
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{isSidebarOpen ? '收起翻译栏' : '展开翻译栏'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left column: Imports and paper selection */}
        <aside 
          className="shrink-0 border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0 transition-all duration-300 ease-in-out overflow-hidden"
          style={{ width: isLeftSidebarOpen ? '320px' : '0px' }}
        >
          <div className="w-[320px] h-full flex flex-col min-h-0">
            <ImportModule onImportSuccess={fetchPapers} />
            <PaperList
              papers={papers}
              activePaper={activePaper}
              onSelectPaper={handleSelectPaper}
              onDeletePaper={handleDeletePaper}
              onRetryDecode={handleRetryDecode}
            />
          </div>
        </aside>

        {/* Floating Expand/Collapse trigger on the divider border */}
        <button
          onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
          className={`absolute top-1/2 -translate-y-1/2 z-40 w-4 h-12 bg-white dark:bg-slate-900 border border-gray-250 dark:border-slate-700 rounded-r-md shadow-xs flex items-center justify-center cursor-pointer text-gray-500 dark:text-slate-400 group transition-all duration-300 ease-in-out hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-black dark:hover:text-white`}
          style={{
            left: isLeftSidebarOpen ? '320px' : '0px',
            borderLeft: 'none',
          }}
          title={isLeftSidebarOpen ? "收起左侧面板" : "展开左侧面板"}
        >
          {isLeftSidebarOpen ? (
            <ChevronLeft className="w-3 h-3 group-hover:scale-110 transition-transform" />
          ) : (
            <ChevronRight className="w-3 h-3 group-hover:scale-110 transition-transform" />
          )}
        </button>

        {/* Center column: Reader stage */}
        <main className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-950 transition-colors duration-300">
          <ReaderCore
            paper={activePaper}
            selectedBlock={selectedBlock}
            onSelectBlock={setSelectedBlock}
            remarks={remarks}
            onAddRemark={handleAddRemark}
            onDeleteRemark={handleDeleteRemark}
            onRetryDecode={handleRetryDecode}
          />
        </main>

        {/* Right column: Translation functionality and output */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && activePaper && (
            <motion.section
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="h-full shrink-0 flex flex-col min-h-0 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300"
            >
              <div className="w-[380px] h-full flex flex-col min-h-0">
                <LLMActionBar
                  paper={activePaper}
                  selectedBlock={selectedBlock}
                  onExecuteAction={handleExecuteAction}
                  loadingAction={loadingAction}
                />
                <LLMSidebar
                  paper={activePaper}
                  actionResult={actionResult}
                  clearingAction={() => setActionResult(null)}
                />
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
