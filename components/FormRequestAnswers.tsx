import React, { useState } from 'react';
import { CustomForm, Ticket } from '../types';
import { IconPrinter } from './Icons';
import { exportFormRequestPdf } from '../utils/exportFormRequestPdf';
import {
  displayImageSrc,
  isFormTicket,
  isHttpUrl,
  isImageUrl,
  parseTicketFormAnswers,
  ticketPhotoRows,
} from '../utils/formRequestAnswers';

type Props = {
  ticket: Ticket;
  form?: CustomForm | null;
  formTitle: string;
  lang?: 'fa' | 'en';
  compact?: boolean;
};

const Photo: React.FC<{ url: string; label: string }> = ({ url, label }) => {
  const [tryN, setTryN] = useState(0);
  const src = tryN === 0 ? displayImageSrc(url) : url;
  if (tryN >= 2) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block text-[11px] text-blue-600 break-all dir-ltr text-left hover:underline">
        {url}
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block space-y-1">
      <img
        src={src}
        alt={label}
        className="max-h-52 w-full rounded-xl border border-gray-100 bg-gray-50 object-contain"
        onError={() => setTryN(n => n + 1)}
      />
      <span className="block text-[11px] text-blue-600 break-all dir-ltr text-left">{url}</span>
    </a>
  );
};

export const FormRequestAnswers: React.FC<Props> = ({ ticket, form, formTitle, lang = 'fa', compact }) => {
  const [busy, setBusy] = useState(false);
  const photos = ticketPhotoRows(ticket, form);
  const photoVals = new Set(photos.map(p => p.value));
  const answers = parseTicketFormAnswers(ticket, form);
  if (!answers.length && !photos.length && !isFormTicket(ticket)) return null;
  const fa = lang === 'fa';

  const downloadPdf = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const rows = [
        ...photos,
        ...answers.filter(a => !photoVals.has(a.value)),
      ];
      await exportFormRequestPdf({ ticket, formTitle, answers: rows });
    } catch {
      alert(fa ? 'ساخت PDF ناموفق بود. دوباره تلاش کنید.' : 'PDF export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? 'space-y-2' : 'col-span-2 space-y-3'}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-gray-800 tracking-tight">{fa ? 'پاسخ فرم' : 'Form answers'}</span>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={busy || (answers.length === 0 && photos.length === 0)}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold bg-gray-900 text-white px-3 py-1.5 rounded-full hover:bg-black disabled:opacity-40"
        >
          <IconPrinter className="w-3.5 h-3.5" />
          {busy ? 'PDF…' : (fa ? 'PDF درخواست' : 'Request PDF')}
        </button>
      </div>
      {photos.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-gray-400">{fa ? 'عکس‌های پیوست مشتری' : 'Attached photos'}</p>
          <div className="grid grid-cols-1 gap-2">
            {photos.map((p, i) => (
              <div key={`ph-${i}`} className="rounded-2xl border border-gray-100 p-2.5 bg-white">
                <p className="text-[11px] font-medium text-gray-400 mb-1">{p.label}</p>
                <Photo url={p.value} label={p.label} />
              </div>
            ))}
          </div>
        </div>
      )}
      {answers.length === 0 && photos.length === 0 ? (
        <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-2xl">{fa ? 'پاسخ ساختاریافته‌ای ثبت نشده.' : 'No structured answers stored.'}</p>
      ) : (
        <ol className="divide-y divide-gray-100 rounded-2xl border border-gray-100 overflow-hidden bg-white">
          {answers.filter(row => !photoVals.has(row.value)).map((row, i) => {
            const url = isHttpUrl(row.value);
            const img = isImageUrl(row.value);
            return (
              <li key={`${row.label}-${i}`} className="px-3.5 py-2.5">
                <p className="text-[11px] font-medium text-gray-400 mb-1">{row.label}</p>
                {img ? (
                  <Photo url={row.value} label={row.label} />
                ) : url ? (
                  <a href={row.value} target="_blank" rel="noreferrer" className="text-[13px] text-blue-600 break-all dir-ltr text-left hover:underline">{row.value}</a>
                ) : (
                  <p className="text-[13px] text-gray-900 whitespace-pre-wrap break-words leading-relaxed">{row.value}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
