import type { ReactNode } from 'react';
import { Eye, Languages, Sparkles } from 'lucide-react';
import { Paper } from '../../types';

export type ReaderMode = 'pdf' | 'md' | 'translate';

interface Props { paper: Paper; mode: ReaderMode; onModeChange: (mode: ReaderMode) => void; onOpenTranslate: () => void; }

export default function ReaderToolbar({ paper, mode, onModeChange, onOpenTranslate }: Props) {
  const button = (name: ReaderMode, label: string, icon: ReactNode, onClick = () => onModeChange(name)) => (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded ${mode === name ? 'bg-white dark:bg-slate-700 text-black dark:text-white shadow-xs' : 'text-gray-500 dark:text-slate-400'}`}>{icon}<span>{label}</span></button>
  );
  return <div className="h-14 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between shrink-0">
    <div className="flex flex-col min-w-0 pr-4"><h2 className="font-display font-bold text-xs truncate" title={paper.title}>{paper.title}</h2><span className="text-[10px] text-gray-400 truncate" title={paper.url}>{paper.url}</span></div>
    {paper.isDecoded ? <div className="flex bg-gray-100 dark:bg-slate-800 p-0.5 rounded">
      {button('pdf', 'PDF', <Eye className="w-3.5 h-3.5" />)}
      {button('md', 'Markdown', <Sparkles className="w-3.5 h-3.5" />)}
      {button('translate', 'Translate', <Languages className="w-3.5 h-3.5" />, onOpenTranslate)}
    </div> : <span className="text-xs text-amber-700 dark:text-amber-400">Waiting for decoding</span>}
  </div>;
}
