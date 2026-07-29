import React, { useEffect, useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { Paper, MarkdownBlock, TranslationLanguage } from '../types';

interface LLMActionBarProps {
  paper: Paper | null;
  selectedBlock: MarkdownBlock | null;
  onTranslate: (targetLanguage: string) => Promise<void>;
  loadingAction: string | null;
  translationLanguages: TranslationLanguage[];
}

export default function LLMActionBar({
  paper,
  selectedBlock,
  onTranslate,
  loadingAction,
  translationLanguages,
}: LLMActionBarProps) {
  const [lang, setLang] = useState('');

  useEffect(() => {
    if (!translationLanguages.some((language) => language.code === lang)) {
      setLang(translationLanguages[0]?.code || '');
    }
  }, [lang, translationLanguages]);

  if (!paper) return null;
  const translationInProgress = paper.translationJob?.status === 'pending' || paper.translationJob?.status === 'processing';
  const isSubmitting = loadingAction === 'translate_full';

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
            disabled={!paper.isDecoded || !!loadingAction || translationInProgress || !translationLanguages.length}
            className="bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-gray-800 dark:text-slate-100 font-medium focus:outline-none focus:border-black dark:focus:border-white cursor-pointer"
          >
            {translationLanguages.map((language) => <option key={language.code} value={language.code}>{language.name} ({language.code})</option>)}
          </select>
        </div>
      </div>

      {/* Translation Button */}
      <button
        onClick={() => onTranslate(lang)}
        disabled={!paper.isDecoded || !!loadingAction || translationInProgress || !lang}
        className="w-full py-2 bg-black dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-gray-800 dark:hover:bg-slate-200 disabled:bg-gray-200 dark:disabled:bg-slate-800 disabled:text-gray-400 dark:disabled:text-slate-600 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
      >
        {isSubmitting || translationInProgress ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Languages className="w-4 h-4" />
        )}
        <span>{translationInProgress ? (paper.translationJob?.status === 'pending' ? 'Translation queued' : 'Translating…') : '全文翻译'}</span>
      </button>
      {paper.translationJob?.status === 'failed' && paper.translationJob.error && (
        <p className="text-[11px] text-rose-600 dark:text-rose-400">Translation failed: {paper.translationJob.error}</p>
      )}
    </div>
  );
}
