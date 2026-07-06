import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppConfig, CartableSheetSource, Personnel, ServiceOption, Ticket,
} from '../types';
import { Language } from '../App';
import { StaffIdPicker } from './StaffIdPicker';
import { IconDatabase, IconUpload, IconRefreshCw, IconCheck, IconTrash, IconPlus, IconLink } from './Icons';
import {
  SHEET_COLUMN_FIELDS,
  SheetColumnField,
  SheetImportOptions,
  SkippedSheetRow,
  autoDetectColumnMap,
  buildTicketsFromSheet,
  columnMapFromSource,
  fetchGoogleSheetCsv,
  parseCsvText,
  parseGoogleSheetUrl,
} from '../utils/googleSheetImport';

interface Props {
  personnel: Personnel[];
  services: ServiceOption[];
  tickets: Ticket[];
  config: AppConfig;
  currentUser: Personnel;
  lang: Language;
  onCreateTickets: (tickets: Ticket[]) => Promise<void>;
  onUpdateConfig: (config: AppConfig) => void;
}

type ImportMode = 'individual' | 'aggregated';

export const CartableSheetImporter: React.FC<Props> = ({
  personnel, services, tickets, config, currentUser, lang, onCreateTickets, onUpdateConfig,
}) => {
  const T = lang === 'fa';
  const fileRef = useRef<HTMLInputElement>(null);

  const [expanded, setExpanded] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [mode, setMode] = useState<ImportMode>('individual');
  const [aggregatedTitle, setAggregatedTitle] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, SheetColumnField>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [saveSourceName, setSaveSourceName] = useState('');
  const [showSaveSource, setShowSaveSource] = useState(false);
  const [previewTickets, setPreviewTickets] = useState<Ticket[]>([]);
  const [skippedDuplicates, setSkippedDuplicates] = useState<SkippedSheetRow[]>([]);
  const [step, setStep] = useState<'load' | 'map' | 'preview'>('load');

  const sources = config.cartableSheetSources || [];

  useEffect(() => {
    if (!serviceId && services.length > 0) {
      setServiceId(services[0].id);
    }
  }, [services, serviceId]);

  const activePersonnel = useMemo(
    () => personnel.filter(p => (p.status || 'active') === 'active'),
    [personnel],
  );
  const personnelNames = useMemo(
    () => Object.fromEntries(personnel.map(p => [p.id, p.fullName])),
    [personnel],
  );

  const txt = {
    title: T ? 'ورود از گوگل‌شیت' : 'Import from Google Sheet',
    subtitle: T
      ? 'داده‌های شیت را بخوانید، به پرسنل ارجاع دهید و در کارتابل با شماره درخواست ثبت کنید.'
      : 'Load sheet data, assign to staff, and register in the cartable with tracking numbers.',
    open: T ? 'ورود شیت' : 'Import sheet',
    close: T ? 'بستن' : 'Close',
    savedSources: T ? 'منابع ذخیره‌شده' : 'Saved sources',
    sheetUrl: T ? 'لینک گوگل‌شیت' : 'Google Sheet URL',
    sheetUrlPh: T ? 'https://docs.google.com/spreadsheets/d/...' : 'https://docs.google.com/spreadsheets/d/...',
    orCsv: T ? 'یا فایل CSV' : 'Or CSV file',
    load: T ? 'بارگذاری داده' : 'Load data',
    loading: T ? 'در حال خواندن...' : 'Loading...',
    rows: T ? 'ردیف' : 'rows',
    service: T ? 'سرویس / موضوع' : 'Service',
    personnel: T ? 'ارجاع به پرسنل' : 'Assign to',
    personnelHint: T
      ? 'چند پرسنل انتخاب کنید — هر درخواست به‌صورت تصادفی به یکی ارجاع می‌شود.'
      : 'Select multiple staff — each request is randomly assigned to one of them.',
    modeIndividual: T ? 'تکی (هر ردیف = یک درخواست)' : 'Individual (one request per row)',
    modeAggregated: T ? 'تجمیعی (همه ردیف‌ها = یک درخواست)' : 'Aggregated (all rows = one request)',
    aggTitle: T ? 'عنوان درخواست تجمیعی' : 'Aggregated request title',
    aggTitlePh: T ? 'مثال: لیست مشتریان جدید' : 'e.g. New customer list',
    columnMap: T ? 'نگاشت ستون‌ها' : 'Column mapping',
    preview: T ? 'پیش‌نمایش و ثبت' : 'Preview & submit',
    dupSkipped: T ? 'ردیف تکراری (همان شماره + همان متن) — ثبت نشد' : 'Duplicate row (same phone + text) — skipped',
    dupInCartable: T ? 'قبلاً در کارتابل' : 'Already in cartable',
    dupInFile: T ? 'تکرار در همین فایل' : 'Repeat in this file',
    allDuplicates: T ? 'همه ردیف‌ها تکراری بودند — مورد جدیدی برای ثبت نیست.' : 'All rows are duplicates — nothing new to register.',
    back: T ? 'بازگشت' : 'Back',
    submit: T ? 'ثبت در کارتابل' : 'Register in cartable',
    submitting: T ? 'در حال ثبت...' : 'Submitting...',
    saveSource: T ? 'ذخیره این شیت' : 'Save this sheet',
    saveSourcePh: T ? 'نام منبع (مثلاً لیست مشتریان عمان)' : 'Source name',
    saved: T ? 'منبع ذخیره شد.' : 'Source saved.',
    ticketCodes: T ? 'شماره درخواست‌ها' : 'Request numbers',
    noData: T ? 'داده‌ای یافت نشد.' : 'No data found.',
    publishHint: T
      ? 'شیت باید «هر کسی با لینک» قابل مشاهده باشد (File → Share → Anyone with the link).'
      : 'Sheet must be shared as "Anyone with the link can view".',
    errors: {
      invalid_sheet_url: T ? 'لینک گوگل‌شیت معتبر نیست.' : 'Invalid Google Sheet URL.',
      sheet_not_public: T ? 'دسترسی شیت باز نیست — اشتراک‌گذاری را روی «هر کسی با لینک» بگذارید.' : 'Sheet is not public — set sharing to anyone with the link.',
      sheet_not_found: T ? 'شیت پیدا نشد.' : 'Sheet not found.',
      fetch_failed: T ? 'خطا در دریافت داده از گوگل.' : 'Failed to fetch sheet data.',
      no_service: T ? 'سرویس را انتخاب کنید.' : 'Select a service.',
      no_rows: T ? 'حداقل یک ردیف داده لازم است.' : 'At least one data row is required.',
    } as Record<string, string>,
  };

  const resetData = () => {
    setHeaders([]);
    setRows([]);
    setColumnMap({});
    setPreviewTickets([]);
    setSkippedDuplicates([]);
    setStep('load');
    setError('');
    setSuccessMsg('');
  };

  const applyParsed = useCallback((parsed: { headers: string[]; rows: string[][] }, src?: CartableSheetSource) => {
    const map = src ? columnMapFromSource(src, parsed.headers) : autoDetectColumnMap(parsed.headers);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setColumnMap(map);
    setStep('map');
    if (src?.serviceId) setServiceId(src.serviceId);
    if (src?.defaultAssigneeIds?.length) setAssigneeIds(src.defaultAssigneeIds);
    if (src?.name) setSourceName(src.name);
  }, []);

  const handleLoadUrl = async () => {
    setError('');
    setSuccessMsg('');
    if (!parseGoogleSheetUrl(sheetUrl)) {
      setError(txt.errors.invalid_sheet_url);
      return;
    }
    setLoading(true);
    try {
      const csv = await fetchGoogleSheetCsv(sheetUrl);
      const parsed = parseCsvText(csv);
      if (!parsed.rows.length) { setError(txt.noData); return; }
      const src = sources.find(s => s.id === selectedSourceId);
      applyParsed(parsed, src);
      if (!sourceName.trim()) {
        setSourceName(src?.name || (T ? 'ورود گوگل‌شیت' : 'Google Sheet import'));
      }
    } catch (e: unknown) {
      const code = e instanceof Error ? e.message : 'fetch_failed';
      setError(txt.errors[code] || code);
    } finally {
      setLoading(false);
    }
  };

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      if (!parsed.rows.length) { setError(txt.noData); return; }
      applyParsed(parsed);
      if (!sourceName.trim()) setSourceName(file.name.replace(/\.csv$/i, ''));
    } catch {
      setError(txt.errors.fetch_failed);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSelectSource = (id: string) => {
    setSelectedSourceId(id);
    const src = sources.find(s => s.id === id);
    if (!src) return;
    setSheetUrl(src.sheetUrl);
    setSourceName(src.name);
    if (src.serviceId) setServiceId(src.serviceId);
    if (src.defaultAssigneeIds?.length) setAssigneeIds(src.defaultAssigneeIds);
  };

  const handleSaveSource = () => {
    const name = saveSourceName.trim() || sourceName.trim();
    if (!name || !sheetUrl.trim()) return;
    const fieldMap: Record<string, string> = {};
    for (const [header, field] of Object.entries(columnMap)) {
      if (field && field !== 'skip') fieldMap[field] = header;
    }
    const entry: CartableSheetSource = {
      id: selectedSourceId || `src_${Date.now()}`,
      name,
      sheetUrl: sheetUrl.trim(),
      serviceId,
      columnMap: Object.keys(fieldMap).length ? fieldMap : undefined,
      defaultAssigneeIds: assigneeIds.length ? assigneeIds : undefined,
      createdAt: new Date().toISOString(),
    };
    const list = [...sources.filter(s => s.id !== entry.id), entry];
    onUpdateConfig({ ...config, cartableSheetSources: list });
    setSelectedSourceId(entry.id);
    setShowSaveSource(false);
    setSuccessMsg(txt.saved);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleDeleteSource = (id: string) => {
    if (!window.confirm(T ? 'این منبع حذف شود؟' : 'Delete this source?')) return;
    onUpdateConfig({ ...config, cartableSheetSources: sources.filter(s => s.id !== id) });
    if (selectedSourceId === id) setSelectedSourceId('');
  };

  const buildPreview = () => {
    const sid = serviceId || services[0]?.id || '';
    if (!sid) { setError(txt.errors.no_service); return; }
    if (!rows.length) { setError(txt.errors.no_rows); return; }
    setError('');
    const opts: SheetImportOptions = {
      mode,
      serviceId: sid,
      assigneeIds,
      sourceName: sourceName.trim() || (T ? 'گوگل‌شیت' : 'Google Sheet'),
      sheetUrl: sheetUrl.trim() || undefined,
      columnMap,
      importerName: currentUser.fullName,
      priority,
      aggregatedTitle: aggregatedTitle.trim() || undefined,
    };
    const result = buildTicketsFromSheet({ headers, rows }, opts, personnelNames, tickets);
    if (!result.tickets.length) {
      setSkippedDuplicates(result.skippedDuplicates);
      setError(txt.allDuplicates);
      setPreviewTickets([]);
      return;
    }
    setPreviewTickets(result.tickets);
    setSkippedDuplicates(result.skippedDuplicates);
    setStep('preview');
  };

  const handleSubmit = async () => {
    if (!previewTickets.length) return;
    setSubmitting(true);
    setError('');
    try {
      await onCreateTickets(previewTickets);
      const codes = previewTickets.map(t => t.id).join(', ');
      const dupNote = skippedDuplicates.length
        ? (T ? ` — ${skippedDuplicates.length} تکراری نادیده گرفته شد` : ` — ${skippedDuplicates.length} duplicates skipped`)
        : '';
      setSuccessMsg(`${T ? 'ثبت شد' : 'Registered'}: ${codes}${dupNote}`);
      resetData();
      setSheetUrl('');
      setSourceName('');
      setAggregatedTitle('');
      setStep('load');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes('Proxy write') || msg.includes('sanitize_failed')
        ? (T ? 'خطا در ارتباط با دیتابیس — اتصال اینترنت را بررسی کنید.' : 'Database connection error.')
        : (T ? `خطا در ثبت: ${msg}` : `Submit failed: ${msg}`));
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:border-gray-800';

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 transition-colors text-right"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 text-white rounded-lg"><IconDatabase className="w-4 h-4" /></div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{txt.title}</div>
            <div className="text-xs text-gray-500 mt-0.5">{txt.subtitle}</div>
          </div>
        </div>
        <span className="text-xs font-bold text-emerald-700 bg-white px-3 py-1.5 rounded-lg border border-emerald-200 shrink-0">{txt.open}</span>
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-emerald-50 bg-emerald-50/40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 text-white rounded-lg"><IconDatabase className="w-4 h-4" /></div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{txt.title}</h3>
            <p className="text-xs text-gray-500">{txt.subtitle}</p>
          </div>
        </div>
        <button type="button" onClick={() => { setExpanded(false); resetData(); }} className="text-xs text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 bg-white">{txt.close}</button>
      </div>

      <div className="p-5 space-y-5">
        {successMsg && (
          <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center gap-2">
            <IconCheck className="w-4 h-4 shrink-0" /> {successMsg}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
        )}

        {step === 'load' && (
          <>
            {sources.length > 0 && (
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">{txt.savedSources}</label>
                <div className="flex flex-wrap gap-2">
                  {sources.map(src => (
                    <div key={src.id} className={`flex items-center gap-1 rounded-lg border text-xs ${selectedSourceId === src.id ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                      <button type="button" onClick={() => handleSelectSource(src.id)} className="px-3 py-2 font-semibold text-gray-800">{src.name}</button>
                      <button type="button" onClick={() => handleDeleteSource(src.id)} className="px-2 py-2 text-red-400 hover:text-red-600 border-r border-gray-200"><IconTrash className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1"><IconLink className="w-3.5 h-3.5" /> {txt.sheetUrl}</label>
                <input className={inputCls} dir="ltr" placeholder={txt.sheetUrlPh} value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} />
                <p className="text-[10px] text-gray-400 mt-1">{txt.publishHint}</p>
              </div>
              <div className="flex flex-col justify-end gap-2">
                <button type="button" onClick={handleLoadUrl} disabled={loading || !sheetUrl.trim()} className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold">
                  {loading ? <IconRefreshCw className="w-4 h-4 animate-spin" /> : <IconDatabase className="w-4 h-4" />}
                  {loading ? txt.loading : txt.load}
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm">
                  <IconUpload className="w-4 h-4" /> {txt.orCsv}
                </button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />
              </div>
            </div>
          </>
        )}

        {(step === 'map' || step === 'preview') && (
          <>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{rows.length} {txt.rows} · {sourceName || '—'}</span>
              <button type="button" onClick={resetData} className="text-gray-400 hover:text-gray-700">{txt.back}</button>
            </div>

            {step === 'map' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">{txt.service}</label>
                    <select className={inputCls} value={serviceId} onChange={e => setServiceId(e.target.value)}>
                      {services.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">{T ? 'اولویت' : 'Priority'}</label>
                    <select className={inputCls} value={priority} onChange={e => setPriority(e.target.value as typeof priority)}>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">{txt.personnel}</label>
                  <StaffIdPicker personnel={activePersonnel} selectedIds={assigneeIds} onChange={setAssigneeIds} lang={lang} className="w-full" />
                  <p className="text-[10px] text-gray-400 mt-1">{txt.personnelHint}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setMode('individual')} className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${mode === 'individual' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>{txt.modeIndividual}</button>
                  <button type="button" onClick={() => setMode('aggregated')} className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${mode === 'aggregated' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>{txt.modeAggregated}</button>
                </div>

                {mode === 'aggregated' && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">{txt.aggTitle}</label>
                    <input className={inputCls} placeholder={txt.aggTitlePh} value={aggregatedTitle} onChange={e => setAggregatedTitle(e.target.value)} />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-gray-500 mb-2 block">{txt.columnMap}</label>
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 text-xs">
                        <tr>
                          <th className="px-3 py-2 text-right">{T ? 'ستون شیت' : 'Sheet column'}</th>
                          <th className="px-3 py-2 text-right">{T ? 'فیلد درخواست' : 'Request field'}</th>
                          <th className="px-3 py-2 text-right">{T ? 'نمونه' : 'Sample'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {headers.map((h, hi) => (
                          <tr key={h + hi}>
                            <td className="px-3 py-2 font-medium text-gray-800">{h}</td>
                            <td className="px-3 py-2">
                              <select
                                className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-white"
                                value={columnMap[h] || 'skip'}
                                onChange={e => setColumnMap(prev => ({ ...prev, [h]: e.target.value as SheetColumnField }))}
                              >
                                {SHEET_COLUMN_FIELDS.map(f => (
                                  <option key={f.key} value={f.key}>{T ? f.fa : f.en}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-400 truncate max-w-[160px]">{rows[0]?.[hi] || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-100 max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>{headers.map(h => <th key={h} className="px-2 py-1.5 text-right text-gray-500 whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.slice(0, 5).map((row, ri) => (
                        <tr key={ri}>{row.map((c, ci) => <td key={ci} className="px-2 py-1.5 text-gray-700 whitespace-nowrap max-w-[120px] truncate">{c}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 5 && <p className="text-[10px] text-gray-400 p-2 text-center">+{rows.length - 5} {txt.rows}</p>}
                </div>

                <div className="flex flex-wrap gap-2 justify-between items-center pt-2">
                  <button type="button" onClick={() => setShowSaveSource(v => !v)} className="text-xs text-gray-500 hover:text-emerald-700 flex items-center gap-1">
                    <IconPlus className="w-3.5 h-3.5" /> {txt.saveSource}
                  </button>
                  <button type="button" onClick={buildPreview} className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-black">{txt.preview}</button>
                </div>

                {showSaveSource && (
                  <div className="flex gap-2 items-end p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex-grow">
                      <label className="text-[10px] font-bold text-gray-400 mb-1 block">{txt.saveSourcePh}</label>
                      <input className={inputCls} value={saveSourceName || sourceName} onChange={e => setSaveSourceName(e.target.value)} />
                    </div>
                    <button type="button" onClick={handleSaveSource} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shrink-0">{T ? 'ذخیره' : 'Save'}</button>
                  </div>
                )}
              </>
            )}

            {step === 'preview' && (
              <>
                <p className="text-sm font-semibold text-gray-800">
                  {mode === 'individual'
                    ? (T ? `${previewTickets.length} درخواست جدید ثبت می‌شود` : `${previewTickets.length} new requests`)
                    : (T ? '۱ درخواست تجمیعی جدید ثبت می‌شود' : '1 new aggregated request')}
                </p>
                {skippedDuplicates.length > 0 && (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
                    <p className="font-semibold">{skippedDuplicates.length} {txt.dupSkipped}</p>
                    <ul className="max-h-24 overflow-y-auto space-y-0.5">
                      {skippedDuplicates.slice(0, 12).map((s, i) => (
                        <li key={i} className="text-amber-700">
                          {T ? 'ردیف' : 'Row'} {s.row}: {s.customerName}
                          {s.phone && s.phone !== '-' ? ` (${s.phone})` : ''}
                          <span className="text-amber-500"> — {s.reason === 'existing' ? txt.dupInCartable : txt.dupInFile}</span>
                        </li>
                      ))}
                      {skippedDuplicates.length > 12 && (
                        <li className="text-amber-500">+{skippedDuplicates.length - 12} …</li>
                      )}
                    </ul>
                  </div>
                )}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {previewTickets.map(t => {
                    const assignee = personnel.find(p => p.id === t.assignedTo);
                    return (
                      <div key={t.id} className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded" dir="ltr">{t.id}</span>
                        <span className="font-semibold text-gray-800">{t.customerName}</span>
                        {assignee && <span className="text-xs text-gray-500">→ {assignee.fullName}</span>}
                        {!assignee && <span className="text-xs text-rose-500">{T ? 'بدون ارجاع' : 'Unassigned'}</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button type="button" onClick={() => setStep('map')} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">{txt.back}</button>
                  <button type="button" onClick={handleSubmit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
                    {submitting ? <IconRefreshCw className="w-4 h-4 animate-spin" /> : <IconCheck className="w-4 h-4" />}
                    {submitting ? txt.submitting : txt.submit}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
