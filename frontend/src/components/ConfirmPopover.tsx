import { createPortal } from 'react-dom';

interface ConfirmPopoverProps {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  layered?: boolean;
}

/** A compact, anchored confirmation surface for destructive actions. */
export default function ConfirmPopover({
  title,
  description,
  confirmLabel = '删除',
  onConfirm,
  onCancel,
  layered = false,
}: ConfirmPopoverProps) {
  const content = (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => event.stopPropagation()}
      className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-gray-200 bg-white p-3 text-left shadow-xl dark:border-slate-700 dark:bg-slate-800"
    >
      <p className="text-xs font-semibold text-gray-900 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-slate-400">{description}</p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700">取消</button>
        <button type="button" onClick={onConfirm} className="rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700">{confirmLabel}</button>
      </div>
    </div>
  );

  if (!layered) return content;
  return createPortal(
    <div data-confirm-layer className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/15 p-4" onClick={onCancel}>
      <div onClick={(event) => event.stopPropagation()} className="w-64 rounded-md border border-gray-200 bg-white p-3 text-left shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        <p className="text-xs font-semibold text-gray-900 dark:text-slate-100">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-slate-400">{description}</p>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700">取消</button>
          <button type="button" onClick={onConfirm} className="rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700">{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
