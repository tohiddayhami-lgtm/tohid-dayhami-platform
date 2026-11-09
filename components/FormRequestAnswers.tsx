import React, { useState } from 'react';
import { CustomForm, Ticket } from '../types';
import { IconPrinter } from './Icons';
import { exportFormRequestPdf } from '../utils/exportFormRequestPdf';
import { isFormTicket, parseTicketFormAnswers } from '../utils/formRequestAnswers';

type Props = {
  ticket: Ticket;
  form?: CustomForm | null;
  formTitle: string;
  lang?: 'fa' | 'en';
};

export const FormRequestAnswers: React.FC<Props> = ({ ticket, form, formTitle, lang = 'fa' }) => {
  const [busy, setBusy] = useState(false);
  const answers = parseTicketFormAnswers(ticket, form);
  if (!answers.length && !isFormTicket(ticket)) return null;
  const fa = lang === 'fa';

  const downloadPdf = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exportFormRequestPdf({ ticket, formTitle, answers });
    } catch {
      alert(fa ? 'ساخت PDF ناموفق بود. دوباره تلاش کنید.' : 'PDF export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col-span-2 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-gray-500 text-sm font-bold">{fa ? 'سوالات و پاسخ‌های همین فرم' : 'This form’s questions & answers'}</span>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={busy || answers.length === 0}
          className="inline-flex items-center gap-1.5 text-xs font-bold bg-teal-700 text-white px-3 py-1.5 rounded-lg hover:bg-teal-800 disabled:opacity-50"
        >
          <IconPrinter className="w-3.5 h-3.5" />
          {busy ? (fa ? 'در حال ساخت PDF…' : 'Building PDF…') : (fa ? 'خروجی PDF درخواست' : 'Download request PDF')}
        </button>
      </div>
      {answers.length === 0 ? (
        <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">{fa ? 'پاسخ ساختاریافته‌ای ثبت نشده.' : 'No structured answers stored.'}</p>
      ) : (
        <ol className="space-y-2">
          {answers.map((row, i) => {
            const isUrl = /^https?:\/\//i.test(row.value);
            const isImg = isUrl && /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(row.value);
            return (
              <li key={`${row.label}-${i}`} className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                <p className="text-[11px] font-bold text-teal-800 mb-1">{i + 1}. {row.label}</p>
                {isImg ? (
                  <a href={row.value} target="_blank" rel="noreferrer">
                    <img src={row.value} alt="" className="max-h-40 rounded border border-white bg-white object-contain" />
                  </a>
                ) : isUrl ? (
                  <a href={row.value} target="_blank" rel="noreferrer" className="text-sm text-blue-700 break-all hover:underline">{row.value}</a>
                ) : (
                  <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{row.value}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
