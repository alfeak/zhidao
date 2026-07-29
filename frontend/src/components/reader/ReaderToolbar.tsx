import type { ReactNode } from 'react';
import { Eye, Languages, Sparkles, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Paper } from '../../types';

export type ReaderMode = 'pdf' | 'md' | 'translate';

interface Props {
  paper: Paper;
  mode: ReaderMode;
  onModeChange: (mode: ReaderMode) => void;
  onOpenTranslate: () => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export default function ReaderToolbar({
  paper,
  mode,
  onModeChange,
  onOpenTranslate,
  scale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: Props) {
  const button = (name: ReaderMode, label: string, icon: ReactNode, onClick = () => onModeChange(name)) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition ${
        mode === name
          ? 'bg-white dark:bg-slate-700 text-black dark:text-white shadow-xs'
          : 'text-gray-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="h-14 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between shrink-0 select-none">
      <div className="flex flex-col min-w-0 pr-4">
        <h2 className="font-display font-bold text-xs truncate" title={paper.title}>
          {paper.title}
        </h2>
        <span className="text-[10px] text-gray-400 truncate" title={paper.url}>
          {paper.url}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {paper.isDecoded && (
          <div className="flex items-center gap-1 border-r border-gray-200 dark:border-slate-800 pr-3">
            <button
              type="button"
              onClick={onZoomOut}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="缩小 (Ctrl + 向下滚轮)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onResetZoom}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              title="重置缩放 (100%)"
            >
              <span>{Math.round(scale * 100)}%</span>
              {scale !== 1.0 && <RotateCcw className="w-3 h-3 text-slate-400" />}
            </button>
            <button
              type="button"
              onClick={onZoomIn}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="放大 (Ctrl + 向上滚轮)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {paper.isDecoded ? (
          <div className="flex bg-gray-100 dark:bg-slate-800 p-0.5 rounded">
            {button('pdf', 'PDF', <Eye className="w-3.5 h-3.5" />)}
            {button('md', 'Markdown', <Sparkles className="w-3.5 h-3.5" />)}
            {button('translate', 'Translate', <Languages className="w-3.5 h-3.5" />, onOpenTranslate)}
          </div>
        ) : (
          <span className="text-xs text-amber-700 dark:text-amber-400">Waiting for decoding</span>
        )}
      </div>
    </div>
  );
}
