import React, { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { Paper, MarkdownBlock } from '../types';

interface LLMActionBarProps {
  paper: Paper | null;
  selectedBlock: MarkdownBlock | null;
  onExecuteAction: (actionType: string, payload: any) => Promise<void>;
  loadingAction: string | null;
}

export default function LLMActionBar({
  paper,
  selectedBlock,
  onExecuteAction,
  loadingAction,
}: LLMActionBarProps) {
  const [lang, setLang] = useState('Chinese (简体中文)');

  if (!paper) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-3 flex flex-col gap-2.5 font-sans shrink-0 transition-colors duration-300">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-800 dark:text-slate-100 font-bold">
          <Languages className="w-4 h-4 text-blue-500" />
          <span>论文翻译</span>
        </div>

        {/* Target Language Selector */}
        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300 font-medium">
          <span className="text-[11px] text-gray-400">语种:</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={!paper.isDecoded || !!loadingAction}
            className="bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-gray-800 dark:text-slate-100 font-medium focus:outline-none focus:border-black dark:focus:border-white cursor-pointer"
          >
            <option value="Chinese (简体中文)">简体中文</option>
            <option value="English (英语)">英语</option>
            <option value="Japanese (日本語)">日本語</option>
            <option value="German (Deutsch)">Deutsch</option>
          </select>
        </div>
      </div>

      {/* Translation Button */}
      <button
        onClick={() => onExecuteAction('translate_full', { targetLanguage: lang })}
        disabled={!paper.isDecoded || !!loadingAction}
        className="w-full py-2 bg-black dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-gray-800 dark:hover:bg-slate-200 disabled:bg-gray-200 dark:disabled:bg-slate-800 disabled:text-gray-400 dark:disabled:text-slate-600 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
      >
        {loadingAction === 'translate_full' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Languages className="w-4 h-4" />
        )}
        <span>全文翻译</span>
      </button>
    </div>
  );
}
