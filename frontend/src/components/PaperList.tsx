/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, FileText, Trash2, RefreshCw, AlertCircle, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { Paper } from '../types';
import ConfirmPopover from './ConfirmPopover';

interface PaperListProps {
  papers: Paper[];
  activePaper: Paper | null;
  onSelectPaper: (paper: Paper) => void;
  onDeletePaper: (id: string) => void;
  onRetryDecode: (id: string) => void;
}

export default function PaperList({
  papers,
  activePaper,
  onSelectPaper,
  onDeletePaper,
  onRetryDecode,
}: PaperListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [paperPendingDelete, setPaperPendingDelete] = useState<Paper | null>(null);

  const filteredPapers = papers.filter((paper) =>
    paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    paper.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50/50 dark:bg-slate-950/40 font-sans transition-colors duration-300">
      {/* Search Bar */}
      <div className="p-3 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-300">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="搜索已有论文..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-black dark:focus:ring-white outline-none transition-all text-gray-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Papers Scroller */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredPapers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-slate-500 px-4">
            <FileText className="w-8 h-8 stroke-1 mb-2 text-gray-300 dark:text-slate-700" />
            <p className="text-xs text-center">
              {searchQuery ? '无匹配论文' : '暂无论文，请使用上方链接导入'}
            </p>
          </div>
        ) : (
          filteredPapers.map((paper) => {
            const isActive = activePaper?.id === paper.id;
            
            return (
              <div
                key={paper.id}
                onClick={() => onSelectPaper(paper)}
                className={`group relative p-3 rounded border text-left cursor-pointer transition-all ${
                  isActive
                    ? 'bg-white dark:bg-slate-800 border-black dark:border-slate-100 shadow-sm ring-0'
                    : 'bg-white dark:bg-slate-900 hover:bg-gray-100/50 dark:hover:bg-slate-800/40 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Paper Info */}
                <div className="pr-6">
                  <h4 className={`text-xs font-bold line-clamp-2 ${isActive ? 'text-black dark:text-white' : 'text-gray-700 dark:text-slate-300'}`}>
                    {paper.title}
                  </h4>
                  
                  {/* Status Badges */}
                  <div className="flex items-center gap-2 mt-2">
                    {paper.decodeStatus === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/30">
                        <Clock className="w-2.5 h-2.5" />
                        <span>排队中</span>
                      </span>
                    )}

                    {paper.decodeStatus === 'processing' && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900/30">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        <span>解码中...</span>
                      </span>
                    )}

                    {paper.decodeStatus === 'done' && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/30">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>已解码</span>
                      </span>
                    )}

                    {paper.decodeStatus === 'failed' && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/30">
                        <AlertCircle className="w-2.5 h-2.5" />
                        <span>解码失败</span>
                      </span>
                    )}

                    <span className="text-[9px] text-gray-400 dark:text-slate-500 line-clamp-1 truncate flex-1 max-w-[120px]" title={paper.url}>
                      {paper.url}
                    </span>
                  </div>
                </div>

                {/* Hover Quick Actions */}
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {paper.decodeStatus === 'failed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetryDecode(paper.id);
                      }}
                      title="重试解码"
                      className="p-1 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPaperPendingDelete(paper);
                    }}
                    title="删除论文"
                    className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {paperPendingDelete?.id === paper.id && (
                    <ConfirmPopover
                      title="删除论文？"
                      description="备注和翻译任务记录也会被删除。原始解析文件会保留以便再次导入。"
                      onCancel={() => setPaperPendingDelete(null)}
                      onConfirm={() => {
                        onDeletePaper(paper.id);
                        setPaperPendingDelete(null);
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
