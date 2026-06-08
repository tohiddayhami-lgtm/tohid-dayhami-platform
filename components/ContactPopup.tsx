import React, { useState, useEffect } from 'react';
import { AppConfig, InternalMessage } from '../types';
import { IconSend, IconSearch, IconReply, IconMail } from './Icons';
import { Language } from '../App';

interface Props {
  config?: AppConfig;
  lang: Language;
  onContactSubmit?: (data: { name: string; phone: string; departmentId: string; message: string }) => Promise<void>;
  lookupContactMessages?: (name: string, phone: string) => InternalMessage[];
  onClose: () => void;
}

export const ContactPopup: React.FC<Props> = ({ config, lang, onContactSubmit, lookupContactMessages, onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dept, setDept] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [threads, setThreads] = useState<InternalMessage[] | null>(null);

  // Only departments the master chose to expose, in the configured order
  const departments = (config?.departments || []).filter(d => d.showInContact !== false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const t = {
    fa: {
      title: 'مکاتبه با ما',
      desc: 'مکاتبه مستقیم با دپارتمان‌های پلتفرم صادراتی توحید دیهمی',
      namePlaceholder: 'نام و نام خانوادگی',
      phonePlaceholder: 'شماره موبایل — مثال: 09120000000',
      deptPlaceholder: '— انتخاب دپارتمان —',
      msgPlaceholder: 'پیام خود را بنویسید...',
      send: 'ارسال پیام',
      sending: 'در حال ارسال...',
      noDepts: 'در حال حاضر دپارتمانی برای ارتباط تعریف نشده است.',
      incomplete: 'لطفاً همه فیلدها (نام، موبایل، دپارتمان و پیام) را تکمیل کنید.',
      error: 'خطا در ارسال. دوباره تلاش کنید.',
      myMessages: 'پیام‌ها و پاسخ‌های من',
      lookup: 'مشاهده پاسخ‌ها',
      noThreads: 'پیامی با این نام و شماره موبایل یافت نشد.',
      replies: 'پاسخ‌ها',
      noReply: 'هنوز پاسخی ثبت نشده است.',
      you: 'شما',
      tracking: 'کد رهگیری مکاتبه:',
    },
    en: {
      title: 'Contact Us',
      desc: 'Direct correspondence with Tohid Dayhami Export Platform departments',
      namePlaceholder: 'Full Name',
      phonePlaceholder: 'Phone Number — e.g. +1 555 000 0000',
      deptPlaceholder: '— Select a department —',
      msgPlaceholder: 'Write your message...',
      send: 'Send Message',
      sending: 'Sending...',
      noDepts: 'No departments are available for contact at the moment.',
      incomplete: 'Please complete all fields (name, mobile, department and message).',
      error: 'Submission failed. Please try again.',
      myMessages: 'My messages & replies',
      lookup: 'View replies',
      noThreads: 'No messages found with this name and mobile number.',
      replies: 'Replies',
      noReply: 'No reply yet.',
      you: 'You',
      tracking: 'Correspondence tracking code:',
    },
  }[lang];

  const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/5 transition-all bg-white';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onContactSubmit) return;
    if (!name.trim() || !phone.trim() || !dept || !message.trim()) { setError(t.incomplete); return; }
    setSubmitting(true);
    setError('');
    try {
      await onContactSubmit({ name: name.trim(), phone: phone.trim(), departmentId: dept, message: message.trim() });
      setMessage('');
      setSent(true);
      setTimeout(() => { if (lookupContactMessages) setThreads(lookupContactMessages(name, phone)); }, 400);
    } catch {
      setError(t.error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookup = () => {
    if (!lookupContactMessages) return;
    setThreads(lookupContactMessages(name, phone));
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-fade-in p-0 sm:p-4"
      onClick={onClose}
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-gray-900 to-gray-700 text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 ltr:right-4 rtl:left-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white text-sm transition-colors"
            aria-label="close"
          >✕</button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <IconMail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight">{t.title}</h2>
              <p className="text-[11px] text-white/70 leading-snug mt-0.5">{t.desc}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {departments.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-2xl py-10 text-center text-sm text-gray-400">
              {t.noDepts}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder={t.namePlaceholder} value={name}
                  onChange={e => { setName(e.target.value); setSent(false); }} className={inputCls} />
                <input type="tel" placeholder={t.phonePlaceholder} value={phone}
                  onChange={e => { setPhone(e.target.value); setSent(false); }} className={inputCls} dir="ltr" />
              </div>
              <select value={dept} onChange={e => setDept(e.target.value)} className={inputCls}>
                <option value="">{t.deptPlaceholder}</option>
                {departments.map(d => <option key={d.id} value={d.id}>{(d.contactLabel || '').trim() || d.name}</option>)}
              </select>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
                placeholder={t.msgPlaceholder} className={inputCls + ' resize-none'} />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit" disabled={submitting}
                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {submitting
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <IconSend className="w-4 h-4" />}
                {submitting ? t.sending : t.send}
              </button>
            </form>
          )}

          {/* My messages & replies — lookup by name + mobile */}
          <div className="border-t border-gray-100 mt-6 pt-5">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <p className="text-sm font-semibold text-gray-700">{t.myMessages}</p>
              <button type="button" onClick={handleLookup}
                disabled={!name.trim() || !phone.trim()}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                <IconSearch className="w-3.5 h-3.5" />{t.lookup}
              </button>
            </div>

            {threads !== null && threads.length === 0 && (
              <p className="text-xs text-gray-400 py-4 text-center">{t.noThreads}</p>
            )}

            {threads && threads.length > 0 && (
              <div className="space-y-3 animate-fade-in">
                {threads.map(m => (
                  <div key={m.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-700">{m.contactDepartmentName || ''}</span>
                        {m.contactTrackingCode && (
                          <span className="text-[10px] font-mono bg-gray-900 text-white px-1.5 py-0.5 rounded" dir="ltr" title={t.tracking}>{m.contactTrackingCode}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400" dir="ltr">{new Date(m.createdAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</span>
                    </div>
                    {/* Customer's original message */}
                    <div className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-[11px] font-semibold shrink-0">{(m.contactName || t.you).charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-gray-500 mb-0.5">{t.you}</p>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{m.body}</p>
                        </div>
                      </div>
                    </div>
                    {/* Replies */}
                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                      <p className="text-[11px] font-semibold text-gray-400 mb-2 flex items-center gap-1"><IconReply className="w-3 h-3" />{t.replies}</p>
                      {(!m.replies || m.replies.length === 0) ? (
                        <p className="text-xs text-gray-400">{t.noReply}</p>
                      ) : (
                        <div className="space-y-2">
                          {m.replies.map(r => (
                            <div key={r.id} className="flex items-start gap-2">
                              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[11px] font-semibold shrink-0">{(r.authorName || '?').charAt(0)}</div>
                              <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl px-3 py-2">
                                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                                  <span className="text-[11px] font-medium text-emerald-700">{r.authorName}</span>
                                  <span className="text-[10px] text-gray-400" dir="ltr">{new Date(r.createdAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</span>
                                </div>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{r.body}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
