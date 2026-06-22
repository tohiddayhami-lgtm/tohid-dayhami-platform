import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dir?: 'rtl' | 'ltr';
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

/** مودال تمام‌صفحه با portal — دکمه‌ها همیشه در viewport دیده می‌شوند */
export const AppModal: React.FC<Props> = ({
  open, onClose, title, children, footer, dir = 'rtl', size = 'md',
}) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        className={`relative w-full ${SIZE_CLASS[size]} bg-white rounded-t-2xl sm:rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.18)] border border-gray-200/70 flex flex-col max-h-[92dvh] sm:max-h-[min(88dvh,720px)] overflow-hidden`}
        dir={dir}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0 px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 custom-scrollbar">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 px-5 py-3.5 border-t border-gray-100 bg-white/95 backdrop-blur-sm safe-area-pb">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export const modalFieldLabel = 'block text-[11px] font-medium text-gray-500 mb-1.5';
export const modalFieldInput = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/20 text-sm bg-white transition-colors';
export const modalFieldTextarea = `${modalFieldInput} resize-y min-h-[72px] max-h-32`;
