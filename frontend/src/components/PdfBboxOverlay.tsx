import { PdfBoundingBox } from '../types';

interface PdfBboxOverlayProps {
  boxes: PdfBoundingBox[];
}

/** Scales MinerU page-space [x0, y0, x1, y1] boxes over a rendered PDF page. */
export default function PdfBboxOverlay({ boxes }: PdfBboxOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {boxes.map((box) => {
        const left = (box.x0 / box.pageWidth) * 100;
        const top = (box.y0 / box.pageHeight) * 100;
        const width = ((box.x1 - box.x0) / box.pageWidth) * 100;
        const height = ((box.y1 - box.y0) / box.pageHeight) * 100;
        return (
          <div
            key={box.id}
            role="button"
            tabIndex={0}
            title={box.type}
            aria-label={`MinerU ${box.type} block`}
            className="pointer-events-auto absolute border border-cyan-500/40 bg-cyan-300/5 transition-all duration-100 hover:z-20 hover:border-2 hover:border-cyan-500 hover:bg-cyan-300/10 focus:z-20 focus:border-2 focus:border-cyan-500 focus:outline-none"
            style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}
