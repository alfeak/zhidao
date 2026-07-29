import { RefObject, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { HighlightRemark, MarkdownBlock, PdfBoundingBox } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import ConfirmPopover from './ConfirmPopover';

interface PdfBlockPopoverProps {
  block: MarkdownBlock;
  box: PdfBoundingBox;
  paperId: string;
  chineseContent?: string;
  popoverRef: RefObject<HTMLElement | null>;
  remarks: HighlightRemark[];
  onClose: () => void;
  onAddRemark: (blockIndex: number, comment: string, color: string) => void;
  onDeleteRemark: (remarkId: string) => void;
}

const colors = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecdd3', '#e9d5ff'];

export default function PdfBlockPopover({ block, box, paperId, chineseContent, popoverRef, remarks, onClose, onAddRemark, onDeleteRemark }: PdfBlockPopoverProps) {
  const [text, setText] = useState('');
  const [color, setColor] = useState(colors[0]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [language, setLanguage] = useState<'zh-CN' | 'original'>(chineseContent ? 'zh-CN' : 'original');
  useEffect(() => setLanguage(chineseContent ? 'zh-CN' : 'original'), [block.id, chineseContent]);
  const left = Math.min((box.x0 / box.pageWidth) * 100, 50);
  const top = (box.y0 / box.pageHeight) * 100;
  const width = Math.max(((box.x1 - box.x0) / box.pageWidth) * 100, 46);
  const height = Math.max(((box.y1 - box.y0) / box.pageHeight) * 100, 28);
  const nearBottom = top > 62;

  return <aside ref={popoverRef} onClick={(event) => event.stopPropagation()} className="absolute z-30 flex max-h-[calc(100%-1rem)] min-w-[26rem] max-w-[calc(100%-1rem)] flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900" style={{ left: `${left}%`, width: `${width}%`, minHeight: `${height}%`, ...(nearBottom ? { bottom: '0.5rem' } : { top: `${top}%` }) }}>
    <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700"><div className="flex items-center gap-2"><select value={language} onChange={(event) => setLanguage(event.target.value as 'zh-CN' | 'original')} className="max-w-24 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800"><option value="zh-CN" disabled={!chineseContent}>中文</option><option value="original">原文</option></select><span className="text-[10px] text-slate-400">第 {block.index + 1} 块</span></div><button type="button" aria-label="关闭" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4"><div className="markdown-body text-sm leading-7 text-slate-800 dark:text-slate-100"><MarkdownRenderer content={language === 'zh-CN' && chineseContent ? chineseContent : block.content} paperId={paperId} /></div>{remarks.map((remark) => <div key={remark.id} className="relative mt-3 border-l-4 px-2.5 py-2 text-sm" style={{ borderColor: remark.color, backgroundColor: `${remark.color}20` }}><span>{remark.comment}</span><button type="button" onClick={() => setPendingDelete(remark.id)} className="ml-2 text-xs text-slate-500 hover:text-rose-600">删除</button>{pendingDelete === remark.id && <ConfirmPopover layered title="删除备注？" description="删除后无法恢复。" onCancel={() => setPendingDelete(null)} onConfirm={() => { onDeleteRemark(remark.id); setPendingDelete(null); }} />}</div>)}</div>
    <footer className="shrink-0 border-t border-slate-200 p-2 dark:border-slate-700"><textarea value={text} onChange={(event) => setText(event.target.value)} rows={2} placeholder="添加备注…" className="w-full rounded border border-slate-300 p-1.5 text-xs dark:border-slate-600 dark:bg-slate-800" /><div className="mt-2 flex items-center justify-between"><div className="flex gap-1">{colors.map((value) => <button type="button" key={value} onClick={() => setColor(value)} style={{ backgroundColor: value }} className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300">{color === value && <Check className="h-3 w-3" />}</button>)}</div><button type="button" disabled={!text.trim()} onClick={() => { onAddRemark(block.index, text.trim(), color); setText(''); }} className="rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-40 dark:bg-white dark:text-black">保存</button></div></footer>
  </aside>;
}
