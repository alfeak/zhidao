import { HighlightRemark, PdfBoundingBox } from '../types';

interface PdfBboxOverlayProps {
  boxes: PdfBoundingBox[];
  remarksByBlock: Map<number, HighlightRemark[]>;
  onSelectBox: (box: PdfBoundingBox) => void;
  onContextMenu: (box: PdfBoundingBox, x: number, y: number) => void;
}

/** Scales MinerU page-space [x0, y0, x1, y1] boxes over a rendered PDF page. */
export default function PdfBboxOverlay({ boxes, remarksByBlock, onSelectBox, onContextMenu }: PdfBboxOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {boxes.map((box) => {
        const left = (box.x0 / box.pageWidth) * 100;
        const top = (box.y0 / box.pageHeight) * 100;
        const width = ((box.x1 - box.x0) / box.pageWidth) * 100;
        const height = ((box.y1 - box.y0) / box.pageHeight) * 100;
        const remarks = remarksByBlock.get(box.blockIndex) || [];
        return (
          <div
            key={box.id}
            role="button"
            tabIndex={0}
            title={box.type}
            aria-label={`MinerU ${box.type} block`}
            onClick={() => onSelectBox(box)}
            onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContextMenu(box, event.clientX, event.clientY); }}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectBox(box); }}
            className={`pointer-events-auto absolute border bg-cyan-300/5 transition-all duration-100 hover:z-20 hover:border-2 hover:border-cyan-500 hover:bg-cyan-300/10 focus:z-20 focus:border-2 focus:border-cyan-500 focus:outline-none ${remarks.length ? 'border-amber-500/80' : 'border-cyan-500/40'}`}
            style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
          >
            {remarks.length > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white" style={{ backgroundColor: remarks[0].color }} />}
          </div>
        );
      })}
    </div>
  );
}
