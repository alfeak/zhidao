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
import PdfBlockPopover from './PdfBlockPopover';
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
  onContextMenu: (block: MarkdownBlock, x: number, y: number) => void;
}

const MarkdownBlockCard = memo(function MarkdownBlockCard({ block, paperId, remarks, selected, onSelect, onAddRemark, onDeleteRemark, onContextMenu }: MarkdownBlockCardProps) {
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

  return <article onClick={() => onSelect(block)} onContextMenu={(event) => { event.preventDefault(); onContextMenu(block, event.clientX, event.clientY); }} className={`relative group cursor-pointer border-l-2 px-3 py-2 transition-colors ${selected ? 'border-black bg-white shadow-sm dark:border-slate-200 dark:bg-slate-800' : 'border-transparent hover:border-cyan-400 hover:bg-white/80 dark:hover:bg-slate-900/70'}`}>
    <DeferredMarkdown content={block.content} paperId={paperId} />
    {remarks.map((remark) => <div key={remark.id} className="relative mt-3 flex justify-between rounded border border-l-4 p-2 text-xs" style={{ backgroundColor: `${remark.color}20`, borderColor: remark.color }}><span>{remark.comment}</span><button type="button" aria-label="删除备注" title="删除备注" onClick={(event) => { event.stopPropagation(); setRemarkPendingDelete(remark.id); }} className="ml-3 text-gray-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"><Trash className="h-3 w-3" /></button>{remarkPendingDelete === remark.id && <ConfirmPopover title="删除备注？" description="删除后无法恢复。" onCancel={() => setRemarkPendingDelete(null)} onConfirm={() => { onDeleteRemark(remark.id); setRemarkPendingDelete(null); }} />}</div>)}
    <div className="absolute right-3 top-2 flex gap-1 rounded border bg-white px-2 py-1 opacity-0 shadow-sm group-hover:opacity-100 dark:bg-slate-800"><button type="button" onClick={(event) => { event.stopPropagation(); setIsRemarkEditorOpen((open) => !open); }} className="flex items-center gap-1 text-xs"><PenTool className="h-3 w-3" />Remark</button></div>
    {isRemarkEditorOpen && <div onClick={(event) => event.stopPropagation()} className="mt-4 space-y-3 rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"><textarea value={remarkText} onChange={(event) => setRemarkText(event.target.value)} rows={2} placeholder="写下你的备注…" className="w-full rounded border border-gray-300 p-2 text-xs outline-none focus:ring-1 focus:ring-black dark:border-slate-600 dark:bg-slate-900 dark:focus:ring-white" /><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-1.5" aria-label="备注颜色">{REMARK_COLORS.map((item) => <button type="button" key={item.value} onClick={() => setColor(item.value)} aria-label={`选择${item.name}备注`} title={item.name} style={{ backgroundColor: item.value }} className={`flex h-6 w-6 items-center justify-center rounded-full border transition-transform hover:scale-110 ${color === item.value ? 'border-slate-900 ring-2 ring-slate-400 ring-offset-1 dark:border-white dark:ring-slate-500 dark:ring-offset-slate-800' : 'border-gray-300 dark:border-slate-600'}`}>{color === item.value && <Check className="h-3.5 w-3.5 text-slate-900" strokeWidth={3} />}</button>)}</div><button type="button" onClick={saveRemark} disabled={!remarkText.trim()} className="rounded bg-black px-3 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900">保存备注</button></div></div>}
  </article>;
});

interface JumpMenuState { x: number; y: number; blockIndex: number; pageIndex?: number; }

function JumpContextMenu({ mode, hasTranslation, onJump }: { mode: ReaderMode; hasTranslation: boolean; onJump: (mode: ReaderMode) => void }) {
  return <div data-jump-menu className="min-w-44 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
    <div className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">跳转到对应区块</div>
    {mode !== 'pdf' && <button type="button" onClick={() => onJump('pdf')} className="block w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">PDF 预览</button>}
    {mode !== 'md' && <button type="button" onClick={() => onJump('md')} className="block w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">原文 Markdown</button>}
    {mode !== 'translate' && <button type="button" disabled={!hasTranslation} title={hasTranslation ? undefined : '暂无已完成的翻译'} onClick={() => onJump('translate')} className="block w-full px-3 py-2 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 dark:hover:bg-slate-800">翻译文本{hasTranslation ? '' : '（暂无）'}</button>}
  </div>;
}

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
  const [pdfSourceBlocks, setPdfSourceBlocks] = useState<MarkdownBlock[]>([]);
  const [pdfChineseBlocks, setPdfChineseBlocks] = useState<MarkdownBlock[]>([]);
  const [pdfSelectedBox, setPdfSelectedBox] = useState<PdfBoundingBox | null>(null);
  const pdfPopoverRef = useRef<HTMLElement | null>(null);
  const readerScrollRef = useRef<HTMLDivElement | null>(null);
  const blockElementsRef = useRef(new Map<number, HTMLDivElement>());
  const pageElementsRef = useRef(new Map<number, HTMLDivElement>());
  const pendingJumpRef = useRef<{ mode: ReaderMode; blockIndex: number; pageIndex?: number } | null>(null);
  const markdownCacheRef = useRef(new Map<string, MarkdownBlock[]>());
  const [jumpMenu, setJumpMenu] = useState<JumpMenuState | null>(null);

  const translationCodes = paper?.translations?.map((item) => item.targetLanguage).join('|') || '';
  const hasTranslation = !!language && paper?.translations?.some((item) => item.targetLanguage === language);

  useEffect(() => { setMode('pdf'); setLanguage(null); setBlocks([]); setLoadedLanguage(null); pendingJumpRef.current = null; setJumpMenu(null); }, [paper?.id]);
  useEffect(() => {
    if (mode === 'translate' && !language) {
      setLanguage(translationLanguages.some((item) => item.code === 'zh-CN') ? 'zh-CN' : translationLanguages[0]?.code || null);
    }
  }, [mode, language, translationLanguages]);

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
    if (!pdfSelectedBox) return;
    const closeWhenOutside = (event: PointerEvent) => {
      const target = event.target;
      const isConfirmLayer = target instanceof Element && !!target.closest('[data-confirm-layer]');
      if (!pdfPopoverRef.current?.contains(target as Node) && !isConfirmLayer) setPdfSelectedBox(null);
    };
    document.addEventListener('pointerdown', closeWhenOutside);
    return () => document.removeEventListener('pointerdown', closeWhenOutside);
  }, [pdfSelectedBox]);

  useEffect(() => {
    if (!jumpMenu) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-jump-menu]')) return;
      setJumpMenu(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [jumpMenu]);

  useEffect(() => {
    if (!paper?.isDecoded) {
      setPdfSourceBlocks([]); setPdfChineseBlocks([]); setPdfSelectedBox(null);
      return;
    }
    const controller = new AbortController();
    const getBlocks = async (targetLanguage?: string) => {
      const query = targetLanguage ? `?targetLanguage=${encodeURIComponent(targetLanguage)}` : '';
      const response = await fetch(`/api/papers/${paper.id}/markdown${query}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Markdown blocks unavailable');
      return response.json() as Promise<{ blocks?: MarkdownBlock[] }>;
    };
    void getBlocks().then(({ blocks }) => { if (!controller.signal.aborted) setPdfSourceBlocks(blocks || []); }).catch(() => !controller.signal.aborted && setPdfSourceBlocks([]));
    void getBlocks('zh-CN').then(({ blocks }) => { if (!controller.signal.aborted) setPdfChineseBlocks(blocks || []); }).catch(() => !controller.signal.aborted && setPdfChineseBlocks([]));
    return () => controller.abort();
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
    const cacheKey = `${paper.id}:${requested}`;
    const cachedBlocks = markdownCacheRef.current.get(cacheKey);
    if (cachedBlocks) {
      setBlocks(cachedBlocks);
      setError(null);
      setLoading(false);
      setLoadedLanguage(requested);
      return;
    }
    setLoading(true); setError(null); setLoadedLanguage(null);
    fetch(`/api/papers/${paper.id}/markdown${query}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(`Server returned ${response.status}`); return response.json() as Promise<{ content: string; blocks?: MarkdownBlock[] }>; })
      .then(({ content, blocks: serverBlocks }) => {
        if (controller.signal.aborted) return;
        const sections = content.split(/(?=^#{1,6}\s)/m).map((item) => item.trim()).filter(Boolean);
        const fallbackBlocks = (sections.length ? sections : [content]).map((section, index) => ({ id: `${paper.id}_${requested}_${index}`, index, content: section }));
        const resolvedBlocks = serverBlocks?.length ? serverBlocks : fallbackBlocks;
        markdownCacheRef.current.set(cacheKey, resolvedBlocks);
        setBlocks(resolvedBlocks);
        setLoadedLanguage(requested);
      }).catch((cause) => !controller.signal.aborted && setError(cause.message)).finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [paper?.id, paper?.isDecoded, mode, language, hasTranslation, translationCodes]);

  const openTranslate = () => {
    setLanguage((current) => current || (translationLanguages.some((item) => item.code === 'zh-CN') ? 'zh-CN' : paper?.translations?.[0]?.targetLanguage || translationLanguages[0]?.code || null));
    changeMode('translate');
  };
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
  const pdfSourceBlocksByIndex = useMemo(() => new Map(pdfSourceBlocks.map((block) => [block.index, block])), [pdfSourceBlocks]);
  const pdfChineseBlocksByIndex = useMemo(() => new Map(pdfChineseBlocks.map((block) => [block.index, block])), [pdfChineseBlocks]);

  const changeMode = (nextMode: ReaderMode) => {
    setMode(nextMode);
  };
  const selectMarkdownBlock = (block: MarkdownBlock) => {
    onSelectBlock(block);
  };
  const selectPdfBox = (box: PdfBoundingBox) => {
    setPdfSelectedBox(box);
  };
  const preferredTranslationLanguage = language && paper?.translations?.some((item) => item.targetLanguage === language)
    ? language : paper?.translations?.find((item) => item.targetLanguage === 'zh-CN')?.targetLanguage || paper?.translations?.[0]?.targetLanguage;
  const jumpTo = (nextMode: ReaderMode) => {
    if (!jumpMenu || (nextMode === 'translate' && !preferredTranslationLanguage)) return;
    const target = jumpMenu;
    setJumpMenu(null);
    if (nextMode === 'translate') setLanguage(preferredTranslationLanguage);
    pendingJumpRef.current = { mode: nextMode, blockIndex: target.blockIndex, pageIndex: target.pageIndex };
    setMode(nextMode);
  };
  const performPendingJump = () => {
    const container = readerScrollRef.current;
    const target = pendingJumpRef.current;
    if (!container || !target || target.mode !== mode) return false;
    if (mode === 'pdf') {
      const box = pdfBoxes.find((item) => item.blockIndex === target.blockIndex);
      const pageIndex = target.pageIndex ?? box?.pageIndex;
      const page = pageIndex === undefined ? undefined : pageElementsRef.current.get(pageIndex);
      if (!page) return false;
      const boxCenter = box ? (((box.y0 + box.y1) / 2) / box.pageHeight) * page.offsetHeight : page.offsetHeight / 2;
      const desiredTop = page.offsetTop + boxCenter - container.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, Math.min(desiredTop, container.scrollHeight - container.clientHeight)) });
      if (box) {
        setPdfSelectedBox(box);
        const sourceBlock = pdfSourceBlocksByIndex.get(box.blockIndex);
        if (sourceBlock) onSelectBlock(sourceBlock);
      }
    } else {
      const expectedLanguage = mode === 'translate' ? language : 'original';
      if (loadedLanguage !== expectedLanguage) return false;
      const block = blockElementsRef.current.get(target.blockIndex);
      if (!block) return false;
      const desiredTop = block.offsetTop + block.offsetHeight / 2 - container.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, Math.min(desiredTop, container.scrollHeight - container.clientHeight)) });
      const selected = blocks.find((item) => item.index === target.blockIndex);
      if (selected) onSelectBlock(selected);
    }
    pendingJumpRef.current = null;
    return true;
  };
  useEffect(() => {
    if (!pendingJumpRef.current) return;
    let frame = 0;
    let attempts = 0;
    const retryJump = () => {
      if (performPendingJump() || attempts++ >= 36) return;
      frame = window.requestAnimationFrame(retryJump);
    };
    frame = window.requestAnimationFrame(retryJump);
    return () => window.cancelAnimationFrame(frame);
  }, [mode, blocks, pages, pdfBoxes, loadedLanguage, language]);
  const openJumpMenu = (blockIndex: number, pageIndex: number | undefined, x: number, y: number) => setJumpMenu({ blockIndex, pageIndex, x, y });

  if (!paper) return <div className="flex-1 flex items-center justify-center text-slate-400"><FileText className="w-12 h-12" /></div>;
  return <div className="flex-1 flex flex-col min-h-0 bg-gray-50/50 dark:bg-slate-950/20">
    <ReaderToolbar paper={paper} mode={mode} onModeChange={changeMode} onOpenTranslate={openTranslate} />
    <div ref={readerScrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-8">
      {mode === 'pdf' ? <div className="min-h-full flex justify-center bg-slate-100 dark:bg-slate-950 py-6">{pdfUrl ? <Document file={pdfUrl} onLoadSuccess={({ numPages }) => setPages(numPages)}>{pages && Array.from({ length: pages }, (_, index) => {
        const selectedBlock = pdfSelectedBox?.pageIndex === index ? pdfSourceBlocksByIndex.get(pdfSelectedBox.blockIndex) : undefined;
        const chineseBlock = selectedBlock ? pdfChineseBlocksByIndex.get(selectedBlock.index) : undefined;
        return <div key={index} ref={(element) => { if (element) pageElementsRef.current.set(index, element); else pageElementsRef.current.delete(index); }} className="relative mb-4 w-fit max-w-[calc(100vw-3rem)] shadow-xl"><Page pageNumber={index + 1} width={900} className="max-w-[calc(100vw-3rem)]" /><PdfBboxOverlay boxes={pdfBoxesByPage.get(index) || []} remarksByBlock={remarksByBlock} onSelectBox={selectPdfBox} onContextMenu={(box, x, y) => openJumpMenu(box.blockIndex, box.pageIndex, x, y)} />{selectedBlock && <PdfBlockPopover block={selectedBlock} box={pdfSelectedBox!} paperId={paper.id} chineseContent={chineseBlock?.content} popoverRef={pdfPopoverRef} remarks={remarksByBlock.get(selectedBlock.index) || []} onClose={() => setPdfSelectedBox(null)} onAddRemark={onAddRemark} onDeleteRemark={onDeleteRemark} />}</div>;
      })}</Document> : <span className="text-sm text-slate-500">Loading PDF…</span>}</div> :
        <div className="mx-auto max-w-3xl space-y-1">
          {mode === 'translate' && <TranslationControls paper={paper} language={language} languages={translationLanguages} loading={loadingAction === 'translate_full'} onLanguageChange={setLanguage} onTranslate={onTranslate} />}
          {mode === 'translate' && !hasTranslation ? <div className="py-16 text-center text-sm text-gray-500">Choose a language and start a translation. The completed document will appear here automatically.</div> :
            !visibleBlocks || loading ? <div className="py-12 text-center text-sm text-gray-500">Loading…</div> : error ? <div className="py-12 text-center text-sm text-rose-600">{error}</div> : blocks.map((block) => <div key={block.id} ref={(element) => { if (element) blockElementsRef.current.set(block.index, element); else blockElementsRef.current.delete(block.index); }}><MarkdownBlockCard block={block} paperId={paper.id} remarks={remarksByBlock.get(block.index) || []} selected={selectedBlock?.id === block.id} onSelect={selectMarkdownBlock} onAddRemark={onAddRemark} onDeleteRemark={onDeleteRemark} onContextMenu={(item, x, y) => openJumpMenu(item.index, item.pageIndex, x, y)} /></div>)}
        </div>}
    </div>
    {jumpMenu && <div className="fixed z-[90]" style={{ left: Math.min(jumpMenu.x, window.innerWidth - 192), top: Math.min(jumpMenu.y, window.innerHeight - 150) }}><JumpContextMenu mode={mode} hasTranslation={!!preferredTranslationLanguage} onJump={jumpTo} /></div>}
  </div>;
}
