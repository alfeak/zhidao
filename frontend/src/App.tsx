import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Moon, Settings, Sun } from 'lucide-react';
import { HighlightRemark, MarkdownBlock, TranslationLanguage } from './types';
import ImportModule from './components/ImportModule';
import PaperList from './components/PaperList';
import ReaderCore from './components/ReaderCore';
import LandingPage from './components/LandingPage';
import UserMenu from './components/UserMenu';
import SettingsModal from './components/SettingsModal';
import LLMChatDrawer from './components/LLMChatDrawer';
import { usePaperWorkspace } from './hooks/usePaperWorkspace';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const {
    user,
    loading: authLoading,
    googleClientId,
    loginWithGoogle,
    logout,
  } = useAuth();
  const {
    papers,
    activePaper,
    setActivePaper,
    refresh,
    deletePaper,
    retryDecode,
    startTranslation,
  } = usePaperWorkspace();
  const [selectedBlock, setSelectedBlock] = useState<MarkdownBlock | null>(null);
  const [remarks, setRemarks] = useState<HighlightRemark[]>([]);
  const [translationLanguages, setTranslationLanguages] = useState<TranslationLanguage[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (
    localStorage.getItem('zhidao-theme') as 'light' | 'dark'
  ) || 'light');
  const [time, setTime] = useState('');

  const refreshRemarks = useCallback(async (paperId: string) => {
    try {
      const response = await fetch(`/api/papers/${paperId}/remarks`);
      if (response.ok) setRemarks(await response.json());
    } catch (error) {
      console.error('Error fetching remarks:', error);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/translation-languages');
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const data = await response.json() as { languages: TranslationLanguage[] };
        setTranslationLanguages(data.languages);
      } catch (error) {
        console.error('Error fetching translation languages:', error);
      }
    })();
  }, []);

  useEffect(() => {
    setSelectedBlock(null);
    if (activePaper) void refreshRemarks(activePaper.id);
    else setRemarks([]);
  }, [activePaper?.id, refreshRemarks]);

  useEffect(() => {
    localStorage.setItem('zhidao-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const updateTime = () => setTime(new Date().toLocaleTimeString('en-GB'));
    updateTime();
    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const addRemark = async (blockIndex: number, comment: string, color: string) => {
    if (!activePaper) return;
    try {
      const response = await fetch('/api/remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId: activePaper.id, blockIndex, comment, color }),
      });
      if (response.ok) await refreshRemarks(activePaper.id);
    } catch (error) {
      console.error('Error adding remark:', error);
    }
  };

  const removeRemark = async (remarkId: string) => {
    if (!activePaper) return;
    try {
      const response = await fetch(`/api/remarks/${remarkId}`, { method: 'DELETE' });
      if (response.ok) await refreshRemarks(activePaper.id);
    } catch (error) {
      console.error('Error deleting remark:', error);
    }
  };

  const translate = async (targetLanguage: string) => {
    setLoadingAction('translate_full');
    try {
      await startTranslation(targetLanguage);
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setLoadingAction(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-400 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <span className="text-xs font-mono tracking-widest text-slate-500">ZHIDAO AUTHENTICATING...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingPage
        googleClientId={googleClientId}
        onGoogleLogin={async (credential) => {
          await loginWithGoogle(credential);
        }}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col min-h-0 overflow-hidden bg-white font-sans text-gray-800 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5 select-none dark:border-slate-800 dark:bg-slate-900">
        <div className="logo-breathe cursor-pointer rounded-[2px] border-2 border-black bg-black px-3 py-0.5 font-display text-base font-black tracking-widest text-white shadow-sm transition-colors duration-500 dark:border-white dark:bg-white dark:text-black">知道</div>
        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded border border-slate-300 bg-slate-50 px-3.5 py-1 font-mono text-sm font-bold tracking-widest shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-800 dark:bg-slate-200" />
          {time || '00:00:00'}
        </div>
        <div className="flex items-center gap-2">
          <UserMenu user={user} onLogout={logout} />
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="flex items-center justify-center rounded-md bg-gray-100 p-1.5 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700" title="切换主题">
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-400" />}
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="flex items-center justify-center rounded-md bg-gray-100 p-1.5 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700" title="系统与偏好设置">
            <Settings className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </header>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <div className="relative flex min-h-0 flex-1">
        <aside className="flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900" style={{ width: isLeftSidebarOpen ? '320px' : '0px' }}>
          <div className="flex h-full w-[320px] min-h-0 flex-col">
            <ImportModule onImportSuccess={() => void refresh()} />
            <PaperList papers={papers} activePaper={activePaper} onSelectPaper={setActivePaper} onDeletePaper={deletePaper} onRetryDecode={retryDecode} />
          </div>
        </aside>
        <button onClick={() => setIsLeftSidebarOpen((open) => !open)} className="absolute top-1/2 z-40 flex h-12 w-4 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-gray-200 bg-white text-gray-500 shadow-xs transition-all hover:bg-slate-50 hover:text-black dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" style={{ left: isLeftSidebarOpen ? '320px' : '0px' }} title={isLeftSidebarOpen ? '收起左侧面板' : '展开左侧面板'}>
          {isLeftSidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <main className="flex min-h-0 flex-1 flex-col bg-white transition-colors duration-300 dark:bg-slate-950">
          <ReaderCore paper={activePaper} selectedBlock={selectedBlock} onSelectBlock={setSelectedBlock} remarks={remarks} onAddRemark={addRemark} onDeleteRemark={removeRemark} translationLanguages={translationLanguages} onTranslate={translate} loadingAction={loadingAction} onRetryDecode={retryDecode} />
        </main>
        {activePaper && (
          <button
            onClick={() => setIsRightSidebarOpen((open) => !open)}
            className="absolute top-1/2 z-40 flex h-12 w-4 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-gray-200 bg-white text-gray-500 shadow-xs transition-all hover:bg-slate-50 hover:text-black dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            style={{ right: isRightSidebarOpen ? '380px' : '0px' }}
            title={isRightSidebarOpen ? '收起 AI 对话面板' : '展开 AI 对话面板'}
          >
            {isRightSidebarOpen ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        )}
        <aside
          className="flex min-h-0 shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900"
          style={{ width: activePaper && isRightSidebarOpen ? '380px' : '0px' }}
        >
          <LLMChatDrawer paper={activePaper} user={user} isOpen={isRightSidebarOpen} />
        </aside>
      </div>
    </div>
  );
}
