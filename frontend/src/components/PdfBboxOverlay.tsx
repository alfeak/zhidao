import { HighlightRemark, PdfBoundingBox } from '../types';

interface PdfBboxOverlayProps {
  boxes: PdfBoundingBox[];
  remarksByBlock: Map<number, HighlightRemark[]>;
  activeBoxId?: string | null;
  selectedBoxId?: string | null;
}

/** Scales MinerU page-space [x0, y0, x1, y1] boxes over a rendered PDF page. */
export default function PdfBboxOverlay({ boxes, remarksByBlock, activeBoxId = null, selectedBoxId = null }: PdfBboxOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {boxes.map((box) => {
        const left = (box.x0 / box.pageWidth) * 100;
        const top = (box.y0 / box.pageHeight) * 100;
        const width = ((box.x1 - box.x0) / box.pageWidth) * 100;
        const height = ((box.y1 - box.y0) / box.pageHeight) * 100;
        const remarks = remarksByBlock.get(box.blockIndex) || [];
        const isActive = box.id === activeBoxId;
        const isSelected = box.id === selectedBoxId;
        return (
          <div
            key={box.id}
            title={box.type}
            aria-label={`MinerU ${box.type} block`}
            className={`absolute border transition-all duration-100 ${
              isSelected || isActive
                ? 'z-20 border-2 border-cyan-500 bg-cyan-300/10'
                : remarks.length
                  ? 'border-amber-500/80 bg-cyan-300/5'
                  : 'border-cyan-500/40 bg-cyan-300/5'
            }`}
            style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
          >
            {remarks.length > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white" style={{ backgroundColor: remarks[0].color }} />}
          </div>
        );
      })}
    </div>
  );
}
