import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, FileText, PenTool, Trash } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import MarkdownRenderer from './MarkdownRenderer';
import ReaderToolbar, { ReaderMode } from './reader/ReaderToolbar';
import TranslationControls from './reader/TranslationControls';
import ConfirmPopover from './ConfirmPopover';
import PdfBboxOverlay from './PdfBboxOverlay';
import { HighlightRemark, MarkdownBlock, Paper, PdfBoundingBox, TranslationLanguage } from '../types';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface Props {
  paper: Paper | null; selectedBlock: MarkdownBlock | null; onSelectBlock: (block: MarkdownBlock) => void;
  remarks: HighlightRemark[]; onAddRemark: (blockIndex: number, comment: string, color: string) => void; onDeleteRemark: (id: string) => void;
  translationLanguages: TranslationLanguage[]; onTranslate: (code: string) => Promise<void>; loadingAction: string | null;
}

const REMARK_COLORS = [
  { value: '#fef08a', name: '黄色' },
  { value: '#bbf7d0', name: '绿色' },
  { value: '#bfdbfe', name: '蓝色' },
  { value: '#fecdd3', name: '粉色' },
  { value: '#e9d5ff', name: '紫色' },
];

const DeferredMarkdown = memo(function DeferredMarkdown({ content, paperId }: { content: string; paperId: string }) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '900px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return <div ref={targetRef} className="markdown-body text-sm text-gray-800 dark:text-slate-100" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 360px' }}>
    {isNearViewport ? <MarkdownRenderer content={content} paperId={paperId} /> : <div className="h-48" aria-hidden="true" />}
  </div>;
});

interface MarkdownBlockCardProps {
  block: MarkdownBlock;
  paperId: string;
  remarks: HighlightRemark[];
  selected: boolean;
  onSelect: (block: MarkdownBlock) => void;
  onAddRemark: (blockIndex: number, comment: string, color: string) => void;
  onDeleteRemark: (id: string) => void;
}

const MarkdownBlockCard = memo(function MarkdownBlockCard({ block, paperId, remarks, selected, onSelect, onAddRemark, onDeleteRemark }: MarkdownBlockCardProps) {
  const [isRemarkEditorOpen, setIsRemarkEditorOpen] = useState(false);
  const [remarkText, setRemarkText] = useState('');
  const [color, setColor] = useState(REMARK_COLORS[0].value);
  const [remarkPendingDelete, setRemarkPendingDelete] = useState<string | null>(null);
  const saveRemark = useCallback(() => {
    const comment = remarkText.trim();
    if (!comment) return;
    onAddRemark(block.index, comment, color);
    setRemarkText('');
    setIsRemarkEditorOpen(false);
  }, [block.index, color, onAddRemark, remarkText]);

  return <article onClick={() => onSelect(block)} className={`relative group cursor-pointer rounded border p-5 ${selected ? 'border-black bg-white shadow-lg dark:border-slate-200 dark:bg-slate-800' : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
    <DeferredMarkdown content={block.content} paperId={paperId} />
    {remarks.map((remark) => <div key={remark.id} className="relative mt-3 flex justify-between rounded border border-l-4 p-2 text-xs" style={{ backgroundColor: `${remark.color}20`, borderColor: remark.color }}><span>{remark.comment}</span><button type="button" aria-label="删除备注" title="删除备注" onClick={(event) => { event.stopPropagation(); setRemarkPendingDelete(remark.id); }} className="ml-3 text-gray-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"><Trash className="h-3 w-3" /></button>{remarkPendingDelete === remark.id && <ConfirmPopover title="删除备注？" description="删除后无法恢复。" onCancel={() => setRemarkPendingDelete(null)} onConfirm={() => { onDeleteRemark(remark.id); setRemarkPendingDelete(null); }} />}</div>)}
    <div className="absolute -bottom-3 right-4 flex gap-1 rounded border bg-white px-2 py-1 opacity-0 group-hover:opacity-100 dark:bg-slate-800"><button type="button" onClick={(event) => { event.stopPropagation(); setIsRemarkEditorOpen((open) => !open); }} className="flex items-center gap-1 text-xs"><PenTool className="h-3 w-3" />Remark</button></div>
    {isRemarkEditorOpen && <div onClick={(event) => event.stopPropagation()} className="mt-4 space-y-3 rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"><textarea value={remarkText} onChange={(event) => setRemarkText(event.target.value)} rows={2} placeholder="写下你的备注…" className="w-full rounded border border-gray-300 p-2 text-xs outline-none focus:ring-1 focus:ring-black dark:border-slate-600 dark:bg-slate-900 dark:focus:ring-white" /><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-1.5" aria-label="备注颜色">{REMARK_COLORS.map((item) => <button type="button" key={item.value} onClick={() => setColor(item.value)} aria-label={`选择${item.name}备注`} title={item.name} style={{ backgroundColor: item.value }} className={`flex h-6 w-6 items-center justify-center rounded-full border transition-transform hover:scale-110 ${color === item.value ? 'border-slate-900 ring-2 ring-slate-400 ring-offset-1 dark:border-white dark:ring-slate-500 dark:ring-offset-slate-800' : 'border-gray-300 dark:border-slate-600'}`}>{color === item.value && <Check className="h-3.5 w-3.5 text-slate-900" strokeWidth={3} />}</button>)}</div><button type="button" onClick={saveRemark} disabled={!remarkText.trim()} className="rounded bg-black px-3 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900">保存备注</button></div></div>}
  </article>;
});

export default function ReaderCore({ paper, selectedBlock, onSelectBlock, remarks, onAddRemark, onDeleteRemark, translationLanguages, onTranslate, loadingAction }: Props) {
  const [mode, setMode] = useState<ReaderMode>('pdf');
  const [language, setLanguage] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<MarkdownBlock[]>([]);
  const [loadedLanguage, setLoadedLanguage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [pdfBoxes, setPdfBoxes] = useState<PdfBoundingBox[]>([]);

  const translationCodes = paper?.translations?.map((item) => item.targetLanguage).join('|') || '';
  const hasTranslation = !!language && paper?.translations?.some((item) => item.targetLanguage === language);

  useEffect(() => { setMode('pdf'); setLanguage(null); setBlocks([]); setLoadedLanguage(null); }, [paper?.id]);
  useEffect(() => { if (mode === 'translate' && !language) setLanguage(translationLanguages[0]?.code || null); }, [mode, language, translationLanguages]);

  useEffect(() => {
    if (!paper?.isDecoded) return;
    const controller = new AbortController(); let url: string | null = null;
    fetch(`/api/papers/${paper.id}/file`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('PDF unavailable');
      url = URL.createObjectURL(new Blob([await response.arrayBuffer()], { type: 'application/pdf' }));
      if (!controller.signal.aborted) setPdfUrl(url);
    }).catch(() => !controller.signal.aborted && setPdfUrl(null));
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [paper?.id, paper?.isDecoded]);

  useEffect(() => {
    if (!paper?.isDecoded) {
      setPdfBoxes([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/papers/${paper.id}/layout-boxes`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Layout data unavailable');
        return response.json() as Promise<{ boxes: PdfBoundingBox[] }>;
      })
      .then(({ boxes }) => { if (!controller.signal.aborted) setPdfBoxes(boxes); })
      .catch(() => { if (!controller.signal.aborted) setPdfBoxes([]); });
    return () => controller.abort();
  }, [paper?.id, paper?.isDecoded]);

  useEffect(() => {
    if (!paper?.isDecoded || (mode !== 'md' && mode !== 'translate')) return;
    if (mode === 'translate' && !hasTranslation) return;
    const controller = new AbortController();
    const requested = mode === 'translate' ? language! : 'original';
    const query = mode === 'translate' ? `?targetLanguage=${encodeURIComponent(requested)}` : '';
    setLoading(true); setError(null); setLoadedLanguage(null);
    fetch(`/api/papers/${paper.id}/markdown${query}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(`Server returned ${response.status}`); return response.json() as Promise<{ content: string }>; })
      .then(({ content }) => {
        if (controller.signal.aborted) return;
        const sections = content.split(/(?=^#{1,6}\s)/m).map((item) => item.trim()).filter(Boolean);
        setBlocks((sections.length ? sections : [content]).map((content, index) => ({ id: `${paper.id}_${requested}_${index}`, index, content })));
        setLoadedLanguage(requested);
      }).catch((cause) => !controller.signal.aborted && setError(cause.message)).finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [paper?.id, paper?.isDecoded, mode, language, hasTranslation, translationCodes]);

  const openTranslate = () => { setLanguage((current) => current || paper?.translations?.[0]?.targetLanguage || translationLanguages[0]?.code || null); setMode('translate'); };
  const visibleBlocks = mode !== 'translate' || loadedLanguage === language;
  const remarksByBlock = useMemo(() => {
    const result = new Map<number, HighlightRemark[]>();
    for (const remark of remarks) result.set(remark.blockIndex, [...(result.get(remark.blockIndex) || []), remark]);
    return result;
  }, [remarks]);
  const pdfBoxesByPage = useMemo(() => {
    const result = new Map<number, PdfBoundingBox[]>();
    for (const box of pdfBoxes) result.set(box.pageIndex, [...(result.get(box.pageIndex) || []), box]);
    return result;
  }, [pdfBoxes]);

  if (!paper) return <div className="flex-1 flex items-center justify-center text-slate-400"><FileText className="w-12 h-12" /></div>;
  return <div className="flex-1 flex flex-col min-h-0 bg-gray-50/50 dark:bg-slate-950/20">
    <ReaderToolbar paper={paper} mode={mode} onModeChange={setMode} onOpenTranslate={openTranslate} />
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-8">
      {mode === 'pdf' ? <div className="min-h-full flex justify-center bg-slate-100 dark:bg-slate-950 py-6">{pdfUrl ? <Document file={pdfUrl} onLoadSuccess={({ numPages }) => setPages(numPages)}>{pages && Array.from({ length: pages }, (_, index) => <div key={index} className="relative mb-4 w-fit max-w-[calc(100vw-3rem)] shadow-xl"><Page pageNumber={index + 1} width={900} className="max-w-[calc(100vw-3rem)]" /><PdfBboxOverlay boxes={pdfBoxesByPage.get(index) || []} /></div>)}</Document> : <span className="text-sm text-slate-500">Loading PDF…</span>}</div> :
        <div className="max-w-3xl mx-auto space-y-6">
          {mode === 'translate' && <TranslationControls paper={paper} language={language} languages={translationLanguages} loading={loadingAction === 'translate_full'} onLanguageChange={setLanguage} onTranslate={onTranslate} />}
          {mode === 'translate' && !hasTranslation ? <div className="py-16 text-center text-sm text-gray-500">Choose a language and start a translation. The completed document will appear here automatically.</div> :
            !visibleBlocks || loading ? <div className="py-12 text-center text-sm text-gray-500">Loading…</div> : error ? <div className="py-12 text-center text-sm text-rose-600">{error}</div> : blocks.map((block) => <MarkdownBlockCard key={block.id} block={block} paperId={paper.id} remarks={remarksByBlock.get(block.index) || []} selected={selectedBlock?.id === block.id} onSelect={onSelectBlock} onAddRemark={onAddRemark} onDeleteRemark={onDeleteRemark} />)}
        </div>}
    </div>
  </div>;
}
