/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Languages, Search, Sparkles, BookOpen, FileCode, Loader2, RefreshCw } from 'lucide-react';
import { Paper, MarkdownBlock } from '../types';

interface LLMActionBarProps {
  paper: Paper | null;
  selectedBlock: MarkdownBlock | null;
  onExecuteAction: (actionType: string, payload: any) => Promise<void>;
  loadingAction: string | null; // e.g. 'translate_full', 'search_full', 'parse_block', 'parse_full'
}

export default function LLMActionBar({
  paper,
  selectedBlock,
  onExecuteAction,
  loadingAction,
}: LLMActionBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [lang, setLang] = useState('Chinese (简体中文)');

  if (!paper) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4 flex flex-col gap-3 font-sans shrink-0 transition-colors duration-300">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-400 font-mono flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-black dark:text-white" />
          <span>学术大模型多维解析</span>
        </h4>
        {!paper.isDecoded && (
          <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 border border-amber-200 dark:border-amber-900/30 rounded uppercase tracking-wider">
            解码后解锁
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Full Text Translation */}
        <button
          onClick={() => onExecuteAction('translate_full', { targetLanguage: lang })}
          disabled={!paper.isDecoded || !!loadingAction}
          className="p-3 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-800 hover:border-black dark:hover:border-slate-100 disabled:opacity-60 disabled:hover:bg-white dark:disabled:hover:bg-slate-900 disabled:hover:border-gray-200 dark:disabled:hover:border-slate-800 rounded text-left transition-all flex flex-col gap-1 cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-gray-800 dark:text-slate-200">
            {loadingAction === 'translate_full' ? (
              <Loader2 className="w-3.5 h-3.5 text-black dark:text-white animate-spin" />
            ) : (
              <Languages className="w-3.5 h-3.5 text-black dark:text-white" />
            )}
            <span className="text-xs font-bold">全文翻译</span>
          </div>
          <span className="text-[10px] text-gray-400 dark:text-slate-400">译入：{lang.split(' ')[0]}</span>
        </button>

        {/* Full Text Analysis */}
        <button
          onClick={() => onExecuteAction('parse_full', {})}
          disabled={!paper.isDecoded || !!loadingAction}
          className="p-3 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-800 hover:border-black dark:hover:border-slate-100 disabled:opacity-60 disabled:hover:bg-white dark:disabled:hover:bg-slate-900 disabled:hover:border-gray-200 dark:disabled:hover:border-slate-800 rounded text-left transition-all flex flex-col gap-1 cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-gray-800 dark:text-slate-200">
            {loadingAction === 'parse_full' ? (
              <Loader2 className="w-3.5 h-3.5 text-black dark:text-white animate-spin" />
            ) : (
              <BookOpen className="w-3.5 h-3.5 text-black dark:text-white" />
            )}
            <span className="text-xs font-bold">全文解析</span>
          </div>
          <span className="text-[10px] text-gray-400 dark:text-slate-400">大纲、方法、突破归纳</span>
        </button>

        {/* Selected Block Analysis */}
        <button
          onClick={() => onExecuteAction('parse_block', { blockId: selectedBlock?.id })}
          disabled={!paper.isDecoded || !selectedBlock || !!loadingAction}
          className={`p-3 border rounded text-left transition-all flex flex-col gap-1 cursor-pointer ${
            selectedBlock
              ? 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border-gray-200 dark:border-slate-800 hover:border-black dark:hover:border-slate-100'
              : 'bg-gray-50 dark:bg-slate-950/40 border-gray-200 dark:border-slate-800/80 text-gray-400 dark:text-slate-600 cursor-not-allowed'
          }`}
          title={!selectedBlock ? "请先在中央阅读区点击任意Markdown卡片" : "深入解析选中的Markdown块"}
        >
          <div className="flex items-center gap-1.5 text-gray-800 dark:text-slate-200">
            {loadingAction === 'parse_block' ? (
              <Loader2 className="w-3.5 h-3.5 text-black dark:text-white animate-spin" />
            ) : (
              <FileCode className="w-3.5 h-3.5 text-black dark:text-white" />
            )}
            <span className="text-xs font-bold">MD块解析</span>
          </div>
          <span className="text-[10px] text-gray-400 dark:text-slate-400 truncate max-w-full">
            {selectedBlock ? `分析索引 #${selectedBlock.index + 1}` : '未选中Markdown段落'}
          </span>
        </button>

        {/* Full Text Semantic Search Trigger */}
        <div className="border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded p-1.5 flex flex-col justify-center gap-1.5">
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="语义搜索词..."
              disabled={!paper.isDecoded || !!loadingAction}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 text-[10px] px-2 py-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-black dark:focus:ring-white outline-none text-gray-800 dark:text-slate-100"
            />
            <button
              onClick={() => onExecuteAction('search_full', { query: searchQuery })}
              disabled={!paper.isDecoded || !searchQuery.trim() || !!loadingAction}
              className="px-1.5 bg-black dark:bg-slate-100 hover:bg-gray-800 dark:hover:bg-slate-200 disabled:bg-gray-100 dark:disabled:bg-slate-800 text-white dark:text-slate-900 disabled:text-gray-400 dark:disabled:text-slate-600 rounded transition-colors flex items-center justify-center cursor-pointer"
            >
              {loadingAction === 'search_full' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Search className="w-3 h-3" />
              )}
            </button>
          </div>
          <span className="text-[9px] text-gray-400 dark:text-slate-400 text-center">全文语义检索定位</span>
        </div>
      </div>

      {/* Language / Configuration Helpers */}
      <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-slate-450 px-1">
        <div className="flex items-center gap-1">
          <span>翻译目标语种：</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={!paper.isDecoded || !!loadingAction}
            className="bg-transparent border-b border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-200 font-bold py-0.5 focus:outline-none focus:border-black dark:focus:border-white"
          >
            <option value="Chinese (简体中文)" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">简体中文</option>
            <option value="English (英语)" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">英语</option>
            <option value="Japanese (日本語)" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">日本語</option>
            <option value="German (Deutsch)" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">Deutsch</option>
          </select>
        </div>
      </div>
    </div>
  );
}
