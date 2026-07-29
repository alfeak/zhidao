import React from 'react';
import { Languages, ClipboardList, Trash2 } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { Paper } from '../types';

interface LLMSidebarProps {
  paper: Paper | null;
  actionResult: string | null;
  clearingAction: () => void;
}

export default function LLMSidebar({
  paper,
  actionResult,
  clearingAction,
}: LLMSidebarProps) {
  if (!paper) return null;

  return (
    <div className="flex-1 w-full bg-white dark:bg-slate-900 flex flex-col min-h-0 font-sans transition-colors duration-300">
      {/* Header */}
      <div className="p-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between shrink-0 transition-colors duration-300">
        <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest font-mono">
          翻译结果输出
        </span>
        {actionResult && (
          <button
            onClick={clearingAction}
            className="text-[10px] text-gray-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold flex items-center gap-1 px-2 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>清空内容</span>
          </button>
        )}
      </div>

      {/* Main Body Scroller */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30 dark:bg-slate-950/20">
        {!actionResult ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 text-center py-16 px-4">
            <Languages className="w-10 h-10 stroke-1 text-gray-300 dark:text-slate-700 mb-3" />
            <p className="text-xs font-semibold text-gray-600 dark:text-slate-300">暂无翻译内容</p>
            <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
              请点击上方【全文翻译】按钮，选择目标语种后即可立即在此生成多语言学术翻译结果。
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-gray-200 dark:border-slate-800 shadow-xs markdown-body text-xs text-slate-800 dark:text-slate-100 transition-colors duration-300 leading-relaxed">
            <MarkdownRenderer content={actionResult} paperId={paper.id} />
          </div>
        )}
      </div>
    </div>
  );
}
