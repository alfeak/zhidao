/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Eye, FileText, Sparkles, MessageSquare, Plus, PenTool, Check, Trash } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Paper, MarkdownBlock, HighlightRemark } from '../types';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface ReaderCoreProps {
  paper: Paper | null;
  selectedBlock: MarkdownBlock | null;
  onSelectBlock: (block: MarkdownBlock) => void;
  remarks: HighlightRemark[];
  onAddRemark: (blockId: string, comment: string, color: string) => void;
  onDeleteRemark: (remarkId: string) => void;
}

export default function ReaderCore({
  paper,
  selectedBlock,
  onSelectBlock,
  remarks,
  onAddRemark,
  onDeleteRemark,
}: ReaderCoreProps) {
  const [viewMode, setViewMode] = useState<'pdf' | 'md'>('pdf');
  const [remarkText, setRemarkText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#fef08a'); // Tailwind yellow-200
  const [activeRemarkFormBlockId, setActiveRemarkFormBlockId] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const colors = [
    { name: 'Yellow', value: '#fef08a' }, // yellow-200
    { name: 'Green', value: '#bbf7d0' },  // green-200
    { name: 'Blue', value: '#bfdbfe' },   // blue-200
    { name: 'Rose', value: '#fecdd3' },   // rose-200
    { name: 'Purple', value: '#e9d5ff' }, // purple-200
  ];

  if (!paper) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 bg-white dark:bg-slate-950 font-sans transition-colors duration-300">
        <div className="text-center max-w-sm">
          <FileText className="w-16 h-16 stroke-1 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
          <h2 className="font-display font-medium text-lg text-slate-800 dark:text-slate-200 mb-2">欢迎来到「知道」</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            一个完全开放透明的学术研究工作台。请在左侧选择一篇论文，或在左上角导入新的 PDF 在线链接开始。
          </p>
        </div>
      </div>
    );
  }

  // Force PDF mode if paper is not yet decoded
  const activeMode = paper.isDecoded ? viewMode : 'pdf';

  const handleSaveRemark = (blockId: string) => {
    if (!remarkText.trim()) return;
    onAddRemark(blockId, remarkText, selectedColor);
    setRemarkText('');
    setActiveRemarkFormBlockId(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50/50 dark:bg-slate-950/20 border-r border-gray-200 dark:border-slate-800 font-sans transition-colors duration-300">
      {/* Reader Toolbar Header */}
      <div className="h-14 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between shrink-0 transition-colors duration-300">
        <div className="flex flex-col min-w-0 pr-4">
          <h2 className="font-display font-bold text-xs text-gray-800 dark:text-slate-250 truncate" title={paper.title}>
            {paper.title}
          </h2>
          <span className="text-[10px] text-gray-400 dark:text-slate-400 truncate mt-0.5" title={paper.url}>
            {paper.url}
          </span>
        </div>

        {/* View Switcher (Visible only if paper is decoded) */}
        {paper.isDecoded ? (
          <div className="flex bg-gray-100 dark:bg-slate-800 p-0.5 rounded transition-colors duration-300">
            <button
              onClick={() => setViewMode('pdf')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer ${
                activeMode === 'pdf'
                  ? 'bg-white dark:bg-slate-700 text-black dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>PDF 视图</span>
            </button>
            <button
              onClick={() => setViewMode('md')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer ${
                activeMode === 'md'
                  ? 'bg-white dark:bg-slate-700 text-black dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>智能句读译注 (MD)</span>
            </button>
          </div>
        ) : (
          <div className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 rounded border border-amber-200 dark:border-amber-900/30 flex items-center gap-1.5 animate-pulse transition-colors duration-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>由于论文尚未解码，当前仅支持直接 PDF 预览。解码完成后将解锁双语块点选解析。</span>
          </div>
        )}
      </div>

      {/* Reader Stage */}
      <div className="flex-1 min-h-0 relative">
        {activeMode === 'pdf' ? (
          <div className="w-full h-full bg-gray-900 overflow-y-auto relative">
            <Document
              key={paper.id}
              file={paper.url}
              onLoadSuccess={({ numPages }) => {
                setPageCount(numPages);
                setPdfError(null);
              }}
              onLoadError={() => {
                setPageCount(null);
                setPdfError('PDF 加载失败，请检查文件链接后重试。');
              }}
              loading={<div className="min-h-full flex items-center justify-center text-sm text-slate-300">正在加载 PDF…</div>}
              error={null}
              className="min-h-full py-6 flex flex-col items-center gap-4"
            >
              {pdfError ? (
                <div className="mt-12 rounded border border-rose-400/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
                  {pdfError}
                </div>
              ) : pageCount ? (
                Array.from({ length: pageCount }, (_, index) => (
                  <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    width={900}
                    className="max-w-[calc(100vw-3rem)] shadow-xl"
                    renderAnnotationLayer
                    renderTextLayer
                  />
                ))
              ) : null}
            </Document>
            {/* Optional Floating decode trigger if failed */}
            {paper.decodeStatus === 'failed' && (
              <div className="absolute top-4 left-4 right-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/30 p-4 rounded shadow-md flex items-center justify-between transition-colors duration-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <p className="text-xs text-rose-800 dark:text-rose-300 font-medium">
                    文档语义解码失败。可能因为网络超时。当前仅可浏览原版 PDF，点击右侧可重试解码。
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Decoded Markdown block-pointing Mode */
          <div className="w-full h-full overflow-y-auto px-6 py-8 bg-gray-50/70 dark:bg-slate-950/40 transition-colors duration-300">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="border-b border-gray-200 dark:border-slate-800 pb-4 mb-6">
                <span className="text-[10px] uppercase tracking-widest font-mono text-gray-600 dark:text-slate-300 font-bold bg-gray-200/60 dark:bg-slate-800/80 px-2 py-1 rounded">
                  结构化 Markdown 区块 (Point-Selectable Markdown Blocks)
                </span>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
                  提示：以下各卡片代表解码出的段落块。你可以随时【点击任意卡片】将其发送到右侧 LLM 解析栏，并进行点选多维解析与高亮备注。
                </p>
              </div>

              {paper.mdBlocks.map((block) => {
                const isSelected = selectedBlock?.id === block.id;
                const blockRemarks = remarks.filter((r) => r.blockId === block.id);

                return (
                  <div
                    key={block.id}
                    onClick={() => onSelectBlock(block)}
                    className={`p-5 rounded border transition-all duration-300 relative group cursor-pointer ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800 border-black dark:border-slate-200 shadow-lg translate-x-1'
                        : 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/50 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Block index tag */}
                    <div className="flex items-center justify-between mb-3 text-[10px] font-mono font-medium text-gray-400 select-none">
                      <span className="bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-slate-400 transition-colors">
                        索引 #{block.index + 1}
                      </span>
                      {block.pageIndex && (
                        <span className="bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-slate-400 transition-colors">
                          页码 {block.pageIndex}
                        </span>
                      )}
                    </div>

                    {/* Block markdown content */}
                    <div className="markdown-body text-gray-800 dark:text-slate-100 text-sm">
                      <ReactMarkdown>{block.content}</ReactMarkdown>
                    </div>

                    {/* Existing remarks list for this block */}
                    {blockRemarks.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-slate-800 space-y-2">
                        {blockRemarks.map((rem) => (
                          <div
                            key={rem.id}
                            className="text-xs p-2.5 rounded border flex items-start justify-between shadow-xs transition-all hover:shadow-sm"
                            style={{ backgroundColor: `${rem.color}20`, borderColor: rem.color }}
                          >
                            <div className="flex-1">
                              <p className="text-gray-800 dark:text-slate-200 font-sans leading-relaxed">{rem.comment}</p>
                              <span className="text-[9px] text-gray-400 dark:text-slate-400 block mt-1">
                                协同用户标注 • {new Date(rem.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteRemark(rem.id);
                              }}
                              className="p-1 text-gray-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-white/50 dark:hover:bg-slate-800/50 cursor-pointer"
                              title="删除备注"
                            >
                              <Trash className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Block Action Buttons bar on Hover */}
                    <div className="absolute -bottom-3.5 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1 shadow-md z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBlock(block);
                        }}
                        className="text-[10px] font-semibold text-gray-600 dark:text-slate-300 hover:text-black dark:hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-yellow-500 dark:text-yellow-400" />
                        <span>选中分析</span>
                      </button>

                      <div className="h-3 w-px bg-gray-250 dark:bg-slate-700 mx-1"></div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveRemarkFormBlockId(
                            activeRemarkFormBlockId === block.id ? null : block.id
                          );
                        }}
                        className="text-[10px] font-semibold text-gray-600 dark:text-slate-300 hover:text-black dark:hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        <PenTool className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                        <span>快捷备注</span>
                      </button>
                    </div>

                    {/* Inline Remark form */}
                    {activeRemarkFormBlockId === block.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-4 p-4 border border-gray-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 space-y-3 shadow-xl z-10 relative"
                      >
                        <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300">添加协同备注 (全平台可见)</h4>
                        <textarea
                          rows={2}
                          required
                          value={remarkText}
                          onChange={(e) => setRemarkText(e.target.value)}
                          placeholder="输入对此段学术论点、翻译细节或逻辑的见解/纠错..."
                          className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-black dark:focus:ring-white outline-none transition-all text-gray-800 dark:text-slate-100"
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1.5">
                            {colors.map((c) => (
                              <button
                                key={c.name}
                                onClick={() => setSelectedColor(c.value)}
                                className="w-5 h-5 rounded-full border border-gray-300 dark:border-slate-600 relative transition-transform hover:scale-110 flex items-center justify-center cursor-pointer"
                                style={{ backgroundColor: c.value }}
                              >
                                {selectedColor === c.value && <Check className="w-2.5 h-2.5 text-gray-700 dark:text-slate-900" />}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setActiveRemarkFormBlockId(null)}
                              className="px-2.5 py-1.5 border border-gray-350 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-xs transition-colors cursor-pointer"
                            >
                              取消
                            </button>
                            <button
                              onClick={() => handleSaveRemark(block.id)}
                              className="px-3 py-1.5 bg-black dark:bg-slate-100 dark:text-slate-900 hover:bg-gray-800 dark:hover:bg-slate-200 text-white font-medium rounded text-xs transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <span>保存备注</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
