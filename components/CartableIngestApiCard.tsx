import React, { useMemo, useState } from 'react';
import { AppConfig } from '../types';
import { Language } from '../App';
import { IconCopy, IconLink, IconRefreshCw } from './Icons';

interface Props {
  config: AppConfig;
  lang: Language;
  onUpdateConfig: (config: AppConfig) => void;
}

function newKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export const CartableIngestApiCard: React.FC<Props> = ({ config, lang, onUpdateConfig }) => {
  const T = lang === 'fa';
  const [copied, setCopied] = useState('');
  const endpoint = `${typeof window !== 'undefined' ? window.location.origin : 'https://www.tohiddayhami.com'}/api/cartable`;
  const key = (config.cartableApiKey || '').trim();

  const claudePrompt = useMemo(() => {
    return `این API کارتابل توحید دیهمی است. از **سرور** وب‌سایت (نه مرورگر عمومی) استفاده کن.

کلید:
X-Api-Key: ${key || '<کلید کارتابل>'}

1) خواندن همه درخواست‌های ثبت‌شده:
GET ${endpoint}
Header: X-Api-Key

پاسخ: { ok: true, count, requests: [{ id, createdAt, status, name, company, phone, whatsapp, city, title, description, data }] }

مشتری‌ها:
GET ${endpoint}?resource=customers

یک درخواست:
GET ${endpoint}?id=TICKET_ID

2) ثبت مشتری جدید از فرم سایت:
POST ${endpoint}
Headers:
  Content-Type: application/json
  X-Api-Key: ${key || '<کلید کارتابل>'}
Body:
{
  "name": "نام کامل",
  "phone": "0912xxxxxxx",
  "email": "email@example.com",
  "company": "شرکت (اختیاری)",
  "city": "شهر (اختیاری)",
  "source": "Website signup",
  "note": "ثبت‌نام از وب‌سایت",
  "createTicket": true
}

قوانین:
- برای خواندن لیست حتماً هدر X-Api-Key بفرست.
- name و phone برای ثبت الزامی است.
- کلید را در فرانت‌اند عمومی نگذار.`.trim();
  }, [endpoint, key]);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(''), 1800);
    } catch { /* ignore */ }
  };

  const generate = () => {
    const next = newKey();
    onUpdateConfig({ ...config, cartableApiKey: next });
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <IconLink className="w-4 h-4 text-teal-700" />
        <h3 className="font-bold text-sm text-gray-900">{T ? 'API ثبت مشتری وب‌سایت' : 'Website customer API'}</h3>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed mb-3">
        {T
          ? 'این آدرس را به کلود بدهید تا ثبت‌نام‌های سایت مستقیم به بانک مشتری و کارتابل بروند. کلید را فقط روی سرور سایت بگذارید.'
          : 'Give this endpoint to Claude so website signups are stored in the customer bank and cartable. Keep the key on the website server only.'}
      </p>
      <div className="space-y-2 text-[11px]">
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 font-mono break-all" dir="ltr">
          <span className="flex-1">POST {endpoint}</span>
          <button type="button" onClick={() => copy(endpoint, 'url')} className="text-teal-700 shrink-0">
            {copied === 'url' ? 'OK' : <IconCopy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={key || (T ? 'هنوز کلیدی ساخته نشده' : 'No key yet')}
            className="flex-1 bg-gray-50 rounded-lg px-3 py-2 font-mono text-[11px]"
            dir="ltr"
          />
          {key && (
            <button type="button" onClick={() => copy(key, 'key')} className="px-2 py-2 text-teal-700">
              {copied === 'key' ? 'OK' : <IconCopy className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={generate}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-900 text-white text-[11px] font-medium"
          >
            <IconRefreshCw className="w-3.5 h-3.5" />
            {key ? (T ? 'کلید جدید' : 'New key') : (T ? 'ساخت کلید' : 'Create key')}
          </button>
        </div>
        <button
          type="button"
          onClick={() => copy(claudePrompt, 'prompt')}
          disabled={!key}
          className="w-full mt-1 px-3 py-2 rounded-lg border border-teal-200 bg-teal-50 text-teal-900 text-xs font-medium disabled:opacity-40"
        >
          {copied === 'prompt' ? (T ? 'کپی شد' : 'Copied') : (T ? 'کپی متن آماده برای کلود' : 'Copy Claude prompt')}
        </button>
      </div>
    </div>
  );
};
