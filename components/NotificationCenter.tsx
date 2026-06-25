
import React, { useState, useEffect } from 'react';
import { NotificationConfig, NotificationLog, Personnel, AppConfig } from '../types';
import { Language } from '../App';
import { subscribeToNotificationLogs, saveNotificationLog, saveAppConfigToCloud } from '../services/firebaseService';
import {
  sendWhatsAppNotification, renderTemplate,
  DEFAULT_TICKET_TEMPLATE, DEFAULT_MESSAGE_TEMPLATE, DEFAULT_STATUS_TEMPLATE,
  DEFAULT_MEETING_CREATED_TEMPLATE, DEFAULT_MEETING_UPDATED_TEMPLATE, DEFAULT_MEETING_DELETED_TEMPLATE,
  DEFAULT_MEETING_REMINDER_TEMPLATE, DEFAULT_DAILY_SUMMARY_TEMPLATE,
} from '../services/notificationService';
import { IconCheck, IconSettings, IconWhatsapp, IconActivity, IconTrash } from './Icons';

interface Props {
  config: AppConfig;
  personnel: Personnel[];
  onUpdateConfig: (config: AppConfig) => void;
  lang: Language;
}

const DEFAULT_CONFIG: NotificationConfig = {
  enabled: false,
  provider: 'callmebot',
  onNewTicket: true,
  onNewMessage: true,
  onStatusChange: false,
  onMeetingCreated: true,
  onMeetingUpdated: true,
  onMeetingDeleted: true,
  onMeetingReminder: true,
  onDailySummary: true,
  ticketTemplate: DEFAULT_TICKET_TEMPLATE,
  messageTemplate: DEFAULT_MESSAGE_TEMPLATE,
  statusTemplate: DEFAULT_STATUS_TEMPLATE,
  meetingCreatedTemplate: DEFAULT_MEETING_CREATED_TEMPLATE,
  meetingUpdatedTemplate: DEFAULT_MEETING_UPDATED_TEMPLATE,
  meetingDeletedTemplate: DEFAULT_MEETING_DELETED_TEMPLATE,
  meetingReminderTemplate: DEFAULT_MEETING_REMINDER_TEMPLATE,
  dailySummaryTemplate: DEFAULT_DAILY_SUMMARY_TEMPLATE,
  personnelPhones: {},
  personnelApiKeys: {},
};

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400 transition-colors";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

export const NotificationCenter: React.FC<Props> = ({ config, personnel, onUpdateConfig, lang }) => {
  const [nc, setNc] = useState<NotificationConfig>({ ...DEFAULT_CONFIG, ...config.notificationConfig });
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testApiKey, setTestApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [activeSection, setActiveSection] = useState<'config' | 'personnel' | 'templates' | 'logs'>('config');

  useEffect(() => {
    const unsub = subscribeToNotificationLogs(setLogs);
    return unsub;
  }, []);

  // Sync when config changes externally
  useEffect(() => {
    setNc(prev => ({ ...DEFAULT_CONFIG, ...config.notificationConfig, personnelPhones: { ...prev.personnelPhones, ...config.notificationConfig?.personnelPhones }, personnelApiKeys: { ...prev.personnelApiKeys, ...config.notificationConfig?.personnelApiKeys } }));
  }, [config.notificationConfig]);

  const handleSave = async () => {
    setSaving(true);
    await onUpdateConfig({ ...config, notificationConfig: nc });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const handleTest = async () => {
    if (!testPhone) return;
    setTesting(true); setTestResult(null);
    const msg = `✅ تست نوتیفیکیشن\nاین پیام تأیید می‌کند که تنظیمات واتساپ شما درست است.\n🕐 ${new Date().toLocaleTimeString('fa-IR')}`;
    // Force enabled=true for test — bypass the master toggle
    const result = await sendWhatsAppNotification(testPhone, msg, { ...nc, enabled: true }, testApiKey || undefined);
    setTestResult({ ok: result.success, msg: result.error || 'پیام با موفقیت ارسال شد ✓' });
    await saveNotificationLog({ type: 'test', recipientId: 'test', recipientName: 'Test', phone: testPhone, message: msg, status: result.success ? 'sent' : 'failed', error: result.error, createdAt: new Date().toISOString() });
    setTesting(false);
  };

  const setPhone = (id: string, v: string) => setNc(n => ({ ...n, personnelPhones: { ...n.personnelPhones, [id]: v } }));
  const setApiKey = (id: string, v: string) => setNc(n => ({ ...n, personnelApiKeys: { ...n.personnelApiKeys, [id]: v } }));

  const activePersonnel = personnel.filter(p => (p.status || 'active') === 'active');

  const SECTIONS = [
    { id: 'config',    label: 'تنظیمات API' },
    { id: 'personnel', label: 'شماره پرسنل' },
    { id: 'templates', label: 'قالب پیام‌ها' },
    { id: 'logs',      label: `لاگ ارسال (${logs.length})` },
  ] as const;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <IconWhatsapp className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">مرکز نوتیفیکیشن واتساپ</h2>
            <p className="text-xs text-gray-400">ارسال اعلان خودکار به پرسنل — کارتابل، پیام و تقویم جلسات</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Master enable toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">{nc.enabled ? 'فعال' : 'غیرفعال'}</span>
            <button onClick={() => setNc(n => ({ ...n, enabled: !n.enabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${nc.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${nc.enabled ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors">
            {saved ? <><IconCheck className="w-4 h-4" />ذخیره شد</> : saving ? 'در حال ذخیره...' : <><IconCheck className="w-4 h-4" />ذخیره</>}
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${activeSection === s.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Config ── */}
      {activeSection === 'config' && (
        <div className="space-y-4">
          {/* Master (CC) recipient */}
          <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-5 space-y-3">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider pb-2 border-b border-gray-100">نفر مستر — رونوشت همه‌ی اعلان‌ها</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              یک نفر را انتخاب کنید تا علاوه بر گیرنده‌ی اصلی (نفر ارجاعی)، یک نسخه از <b>همه‌ی نوتیفیکیشن‌های واتساپی</b> سامانه برای او هم ارسال شود.
            </p>
            <select
              value={nc.masterRecipientId || ''}
              onChange={e => setNc(n => ({ ...n, masterRecipientId: e.target.value || undefined }))}
              className={inputCls}
            >
              <option value="">— بدون نفر مستر —</option>
              {activePersonnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
            {nc.masterRecipientId && (() => {
              const m = personnel.find(p => p.id === nc.masterRecipientId);
              const phone = nc.personnelPhones?.[nc.masterRecipientId!];
              const needsKey = nc.provider === 'callmebot' && !nc.personnelApiKeys?.[nc.masterRecipientId!];
              return phone && !needsKey
                ? <p className="text-xs text-green-600">✓ {m?.fullName} رونوشت همه‌ی اعلان‌ها را دریافت می‌کند.</p>
                : <p className="text-xs text-amber-600">⚠️ برای «{m?.fullName}» شماره واتساپ{needsKey ? ' و کلید CallMeBot' : ''} در تب «شماره پرسنل» ثبت نشده — تا ثبت نشود رونوشت ارسال نمی‌شود.</p>;
            })()}
          </div>

          {/* Provider */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-100">سرویس ارسال واتساپ</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'callmebot', label: 'CallMeBot', desc: 'رایگان — کلید جداگانه هر فرد' },
                { id: 'ultramsg',  label: 'UltraMsg',  desc: 'اشتراک پولی — یک کلید کل سازمان' },
                { id: 'webhook',   label: 'Webhook',   desc: 'پیشرفته — آدرس دلخواه' },
              ] as const).map(p => (
                <button key={p.id} onClick={() => setNc(n => ({ ...n, provider: p.id }))}
                  className={`text-center p-3 rounded-xl border-2 transition-colors ${nc.provider === p.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="text-sm font-bold text-gray-800">{p.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>

            {/* Provider-specific fields */}
            {nc.provider === 'callmebot' && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-2">
                <p className="font-semibold">راهنمای CallMeBot:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
                  <li>هر پرسنل باید پیام <span className="font-mono bg-blue-100 px-1 rounded" dir="ltr">I allow callmebot to send me messages</span> را به شماره <span className="font-bold font-mono" dir="ltr">+34 611 04 87 48</span> در واتساپ بزند</li>
                  <li>یک کد API شخصی دریافت می‌کنند</li>
                  <li>آن کد را در جدول «شماره پرسنل» وارد کنید</li>
                </ol>
              </div>
            )}

            {nc.provider === 'ultramsg' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Instance ID</label>
                  <input value={nc.ultraMsgInstance || ''} onChange={e => setNc(n => ({ ...n, ultraMsgInstance: e.target.value }))} placeholder="instance12345" className={inputCls} dir="ltr" />
                </div>
                <div>
                  <label className={labelCls}>Token</label>
                  <input value={nc.ultraMsgToken || ''} onChange={e => setNc(n => ({ ...n, ultraMsgToken: e.target.value }))} placeholder="your_token_here" className={inputCls} dir="ltr" type="password" />
                </div>
              </div>
            )}

            {nc.provider === 'webhook' && (
              <div>
                <label className={labelCls}>آدرس Webhook (POST)</label>
                <input value={nc.webhookUrl || ''} onChange={e => setNc(n => ({ ...n, webhookUrl: e.target.value }))} placeholder="https://your-server.com/whatsapp-webhook" className={inputCls} dir="ltr" />
                <p className="text-xs text-gray-400 mt-1">بدنه: <code className="bg-gray-100 px-1 rounded">{`{"phone": "+98...", "message": "..."}`}</code></p>
              </div>
            )}
          </div>

          {/* Events */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-100">رویدادهای نوتیفیکیشن</p>
            {([
              { key: 'onNewTicket',       label: 'درخواست جدید در کارتابل',    desc: 'وقتی پرونده‌ای به کارشناس ارجاع می‌شود' },
              { key: 'onNewMessage',      label: 'پیام داخلی جدید',            desc: 'وقتی مکاتبه‌ای در سازمان دریافت می‌شود' },
              { key: 'onStatusChange',    label: 'تغییر وضعیت پرونده',         desc: 'وقتی وضعیت تیکت تغییر می‌کند' },
            ] as const).map(ev => (
              <div key={ev.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{ev.label}</p>
                  <p className="text-xs text-gray-400">{ev.desc}</p>
                </div>
                <button onClick={() => setNc(n => ({ ...n, [ev.key]: !n[ev.key] }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${nc[ev.key] ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${nc[ev.key] ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
            {/* Meeting notifications separator */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2 pb-1 border-t border-gray-100">نوتیفیکیشن‌های تقویم جلسات</p>
            {([
              { key: 'onMeetingCreated',  label: 'اطلاع‌رسانی فوری ثبت جلسه',     desc: 'همان لحظه که جلسه جدید ثبت می‌شود، به تمام شرکت‌کنندگان پیام می‌رود' },
              { key: 'onMeetingUpdated',  label: 'اطلاع‌رسانی تغییر جلسه',        desc: 'اگر ساعت، تاریخ، مکان یا شرکت‌کنندگان عوض شوند، همه آگاه می‌شوند' },
              { key: 'onMeetingDeleted',  label: 'اطلاع‌رسانی لغو جلسه',          desc: 'وقتی جلسه‌ای حذف می‌شود، به تمام شرکت‌کنندگان پیام لغو می‌رود' },
              { key: 'onMeetingReminder', label: 'یادآوری جلسه (یک ساعت قبل)',   desc: 'ارسال پیام به تمام شرکت‌کنندگان ۶۰ دقیقه پیش از شروع جلسه' },
              { key: 'onDailySummary',    label: 'خلاصه روزانه جلسات (ساعت ۱۷)', desc: 'هر روز ساعت ۵ عصر، لیست جلسات فردا برای نفرات درگیر ارسال می‌شود' },
            ] as const).map(ev => (
              <div key={ev.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{ev.label}</p>
                  <p className="text-xs text-gray-400">{ev.desc}</p>
                </div>
                <button onClick={() => setNc(n => ({ ...n, [ev.key]: !n[ev.key] }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${nc[ev.key] ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${nc[ev.key] ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>

          {/* Test */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-100">تست ارسال پیام</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>شماره تست (با کد کشور)</label>
                <input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+989120000000" className={inputCls} dir="ltr" />
              </div>
              {nc.provider === 'callmebot' && (
                <div>
                  <label className={labelCls}>کلید CallMeBot برای تست</label>
                  <input value={testApiKey} onChange={e => setTestApiKey(e.target.value)} placeholder="1234567" className={inputCls} dir="ltr" />
                </div>
              )}
            </div>
            <button onClick={handleTest} disabled={testing || !testPhone}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              <IconWhatsapp className="w-4 h-4" />
              {testing ? 'در حال ارسال...' : 'ارسال پیام تست'}
            </button>
            {testResult && (
              <div className={`text-sm rounded-lg px-3 py-2 ${testResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {testResult.ok ? '✓ ' : '✗ '}{testResult.msg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Personnel phones & keys ── */}
      {activeSection === 'personnel' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-bold text-gray-800">شماره واتساپ و کلید API هر کارشناس</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {nc.provider === 'callmebot'
                ? 'هم شماره واتساپ و هم کلید CallMeBot هر فرد الزامی است'
                : 'شماره واتساپ هر فرد الزامی است — کلید API برای CallMeBot'}
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {activePersonnel.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">پرسنلی تعریف نشده</p>
            )}
            {activePersonnel.map(p => (
              <div key={p.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                <div className="w-36 shrink-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.fullName}</p>
                  <p className="text-xs text-gray-400 truncate">{(p.roles || []).join('، ')}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-[10px] text-gray-400 font-semibold">شماره واتساپ</label>
                  <input
                    value={nc.personnelPhones[p.id] || ''}
                    onChange={e => setPhone(p.id, e.target.value)}
                    placeholder="+989120000000"
                    className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-green-300"
                    dir="ltr"
                  />
                </div>
                {nc.provider === 'callmebot' && (
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] text-gray-400 font-semibold">کلید CallMeBot</label>
                    <input
                      value={nc.personnelApiKeys[p.id] || ''}
                      onChange={e => setApiKey(p.id, e.target.value)}
                      placeholder="1234567"
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-green-300"
                      dir="ltr"
                      type="password"
                    />
                  </div>
                )}
                <div className="shrink-0">
                  {nc.personnelPhones[p.id] && (nc.provider !== 'callmebot' || nc.personnelApiKeys[p.id])
                    ? <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ آماده</span>
                    : <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">ناقص</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
              {saved ? 'ذخیره شد ✓' : saving ? 'در حال ذخیره...' : 'ذخیره'}
            </button>
          </div>
        </div>
      )}

      {/* ── Templates ── */}
      {activeSection === 'templates' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800 leading-relaxed">
            <span className="font-bold">متغیرهای کارتابل: </span>
            <code className="bg-amber-100 px-1 rounded">{'{recipientName}'}</code> نام گیرنده ·
            <code className="bg-amber-100 px-1 rounded mx-1">{'{ticketId}'}</code> کد رهگیری ·
            <code className="bg-amber-100 px-1 rounded">{'{customerName}'}</code> نام مشتری ·
            <code className="bg-amber-100 px-1 rounded mx-1">{'{senderName}'}</code> نام فرستنده ·
            <code className="bg-amber-100 px-1 rounded">{'{status}'}</code> وضعیت جدید
          </div>
          {([
            { key: 'ticketTemplate',  label: 'قالب درخواست جدید در کارتابل',    def: DEFAULT_TICKET_TEMPLATE },
            { key: 'messageTemplate', label: 'قالب پیام داخلی جدید',            def: DEFAULT_MESSAGE_TEMPLATE },
            { key: 'statusTemplate',  label: 'قالب تغییر وضعیت پرونده',         def: DEFAULT_STATUS_TEMPLATE },
          ] as const).map(t => (
            <div key={t.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">{t.label}</label>
                <button onClick={() => setNc(n => ({ ...n, [t.key]: t.def }))} className="text-xs text-indigo-500 hover:text-indigo-700">بازنشانی</button>
              </div>
              <textarea
                rows={5}
                value={nc[t.key]}
                onChange={e => setNc(n => ({ ...n, [t.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none font-mono"
              />
            </div>
          ))}

          {/* Meeting templates */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 leading-relaxed">
            <span className="font-bold">متغیرهای جلسات: </span>
            <code className="bg-blue-100 px-1 rounded">{'{recipientName}'}</code> نام گیرنده ·
            <code className="bg-blue-100 px-1 rounded mx-1">{'{meetingTitle}'}</code> موضوع ·
            <code className="bg-blue-100 px-1 rounded">{'{meetingDate}'}</code> تاریخ ·
            <code className="bg-blue-100 px-1 rounded mx-1">{'{meetingTime}'}</code> شروع ·
            <code className="bg-blue-100 px-1 rounded">{'{meetingEndTime}'}</code> پایان ·
            <code className="bg-blue-100 px-1 rounded mx-1">{'{meetingLocation}'}</code> مکان ·
            <code className="bg-blue-100 px-1 rounded">{'{organizerName}'}</code> تنظیم‌کننده
          </div>
          {([
            { key: 'meetingCreatedTemplate',  label: 'قالب اطلاع‌رسانی ثبت جلسه جدید',  def: DEFAULT_MEETING_CREATED_TEMPLATE },
            { key: 'meetingUpdatedTemplate',  label: 'قالب اطلاع‌رسانی تغییر جلسه',      def: DEFAULT_MEETING_UPDATED_TEMPLATE },
            { key: 'meetingDeletedTemplate',  label: 'قالب اطلاع‌رسانی لغو جلسه',        def: DEFAULT_MEETING_DELETED_TEMPLATE },
            { key: 'meetingReminderTemplate', label: 'قالب یادآوری جلسه (یک ساعت قبل)', def: DEFAULT_MEETING_REMINDER_TEMPLATE },
          ] as const).map(t => (
            <div key={t.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">{t.label}</label>
                <button onClick={() => setNc(n => ({ ...n, [t.key]: t.def }))} className="text-xs text-indigo-500 hover:text-indigo-700">بازنشانی</button>
              </div>
              <textarea
                rows={6}
                value={nc[t.key] || t.def}
                onChange={e => setNc(n => ({ ...n, [t.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none font-mono"
              />
            </div>
          ))}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 leading-relaxed">
            <span className="font-bold">متغیرهای خلاصه روزانه: </span>
            <code className="bg-blue-100 px-1 rounded">{'{recipientName}'}</code> نام گیرنده ·
            <code className="bg-blue-100 px-1 rounded mx-1">{'{tomorrowDate}'}</code> تاریخ فردا ·
            <code className="bg-blue-100 px-1 rounded">{'{meetingsList}'}</code> لیست جلسات
          </div>
          {([
            { key: 'dailySummaryTemplate', label: 'قالب خلاصه روزانه جلسات (ساعت ۱۷)', def: DEFAULT_DAILY_SUMMARY_TEMPLATE },
          ] as const).map(t => (
            <div key={t.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">{t.label}</label>
                <button onClick={() => setNc(n => ({ ...n, [t.key]: t.def }))} className="text-xs text-indigo-500 hover:text-indigo-700">بازنشانی</button>
              </div>
              <textarea
                rows={5}
                value={nc[t.key] || t.def}
                onChange={e => setNc(n => ({ ...n, [t.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none font-mono"
              />
            </div>
          ))}

          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
              {saved ? 'ذخیره شد ✓' : 'ذخیره قالب‌ها'}
            </button>
          </div>
        </div>
      )}

      {/* ── Logs ── */}
      {activeSection === 'logs' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <IconActivity className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-bold text-gray-700">لاگ ارسال نوتیفیکیشن‌ها (آخرین ۱۰۰)</span>
          </div>
          {logs.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-10">هنوز نوتیفیکیشنی ارسال نشده</p>
          )}
          <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${log.status === 'sent' ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-800">{log.recipientName}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{log.phone}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${log.status === 'sent' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      {log.status === 'sent' ? 'ارسال شد' : 'خطا'}
                    </span>
                    <span className="text-[10px] text-gray-300">
                      {log.type === 'new_ticket' ? 'درخواست جدید' : log.type === 'new_message' ? 'پیام' : log.type === 'status_change' ? 'تغییر وضعیت' : log.type === 'meeting_created' ? '📅 ثبت جلسه' : log.type === 'meeting_updated' ? '✏️ تغییر جلسه' : log.type === 'meeting_deleted' ? '❌ لغو جلسه' : log.type === 'meeting_reminder' ? '⏰ یادآوری جلسه' : log.type === 'daily_summary' ? '📋 خلاصه روزانه' : 'تست'}
                    </span>
                  </div>
                  {log.ticketId && <p className="text-[10px] text-gray-400 font-mono mt-0.5">#{log.ticketId}</p>}
                  {log.meetingId && <p className="text-[10px] text-gray-400 font-mono mt-0.5">جلسه: {log.meetingId}</p>}
                  {log.error && <p className="text-[10px] text-red-500 mt-0.5 truncate">{log.error}</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5 dir-ltr">{new Date(log.createdAt).toLocaleString('fa-IR')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
