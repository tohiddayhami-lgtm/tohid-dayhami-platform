import React, { useState, useRef } from 'react';
import { Customer, Ticket, ServiceOption, Personnel } from '../types';
import { IconSearch, IconUsers, IconDatabase, IconStar, IconEdit, IconTrash, IconCheck, IconUpload, IconWhatsapp, IconBriefcase } from './Icons';
import { mapCsvHeaders } from '../services/geminiService';
import { Language } from '../App';

interface Props {
  customers: Customer[];
  tickets: Ticket[];
  services: ServiceOption[];
  currentUser: Personnel;
  onUpdate: (customers: Customer[]) => void;
  onEdit: (id: string, updates: Partial<Customer>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  lang: Language;
}

type CategoryFilter = 'all' | 'vip' | 'regular' | 'new' | 'potential';
type SourceFilter = 'all' | 'google_form' | 'web_form' | 'custom_form' | 'csv' | 'direct';

const getCategory = (n: number): Exclude<CategoryFilter, 'all'> => {
  if (n >= 5) return 'vip';
  if (n >= 2) return 'regular';
  if (n === 1) return 'new';
  return 'potential';
};

const getSourceType = (source?: string): Exclude<SourceFilter, 'all'> => {
  if (!source) return 'direct';
  const s = source.toLowerCase();
  if (s.includes('google') || s.includes('gform') || s === 'google form') return 'google_form';
  if (s.startsWith('form:') || s.includes('custom form') || s.includes('فرم آنلاین')) return 'custom_form';
  if (s === 'web form' || s === 'web') return 'web_form';
  if (s.startsWith('import:')) return 'csv';
  return 'direct';
};

const CATEGORY_CONFIG = {
  vip:       { labelFa: 'VIP طلایی',  bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-400'  },
  regular:   { labelFa: 'ثابت',       bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-400' },
  new:       { labelFa: 'جدید',       bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-400'  },
  potential: { labelFa: 'بالقوه',     bg: 'bg-gray-50',    text: 'text-gray-500',   border: 'border-gray-200',   dot: 'bg-gray-300'   },
};

const SOURCE_CONFIG: Record<Exclude<SourceFilter, 'all'>, { labelFa: string; bg: string; text: string; emoji: string }> = {
  google_form:  { labelFa: 'گوگل فرم',     bg: 'bg-red-50',     text: 'text-red-600',    emoji: '📊' },
  web_form:     { labelFa: 'ثبت سایت',     bg: 'bg-blue-50',    text: 'text-blue-600',   emoji: '🌐' },
  custom_form:  { labelFa: 'فرم آنلاین',   bg: 'bg-purple-50',  text: 'text-purple-600', emoji: '📝' },
  csv:          { labelFa: 'ایمپورت CSV',  bg: 'bg-gray-100',   text: 'text-gray-600',   emoji: '📥' },
  direct:       { labelFa: 'مستقیم',       bg: 'bg-teal-50',    text: 'text-teal-600',   emoji: '👤' },
};

const IconDownload = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);

const IconX = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

const IconGoogleForm = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" opacity=".3"/>
    <path d="M14 2v6h6M8 13h8M8 17h5"/>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <line x1="8" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const parseCSV = (text: string): string[][] => {
  const results: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let inQuotes = false;
    let cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    row.push(cell.trim());
    results.push(row);
  }
  return results;
};

export const CustomerBank: React.FC<Props> = ({
  customers, tickets, services, currentUser, onUpdate, onEdit, onDelete, lang,
}) => {
  const [search, setSearch]                 = useState('');
  const [catFilter, setCatFilter]           = useState<CategoryFilter>('all');
  const [srcFilter, setSrcFilter]           = useState<SourceFilter>('all');
  const [page, setPage]                     = useState(1);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSaving, setIsSaving]             = useState(false);
  const [isImporting, setIsImporting]       = useState(false);
  const [importStatus, setImportStatus]     = useState('');
  const [importType, setImportType]         = useState<'csv' | 'google'>('csv');
  const csvRef    = useRef<HTMLInputElement>(null);
  const googleRef = useRef<HTMLInputElement>(null);
  const itemsPerPage = 20;

  const isAdmin = currentUser.roles.includes('مدیر') || currentUser.username === 'master';

  const getCustomerTickets = (c: Customer) =>
    tickets.filter(t => t.phoneNumber === c.phoneNumber || t.customerName === c.fullName);

  const getRequestTitles = (c: Customer): string[] => {
    const seen = new Set<string>();
    return getCustomerTickets(c)
      .map(t => services.find(s => s.id === t.serviceId)?.title || '')
      .filter(title => { if (!title || seen.has(title)) return false; seen.add(title); return true; });
  };

  // ---- counts ----
  const sourceCounts: Record<SourceFilter, number> = { all: customers.length, google_form: 0, web_form: 0, custom_form: 0, csv: 0, direct: 0 };
  const catCounts: Record<CategoryFilter, number>  = { all: customers.length, vip: 0, regular: 0, new: 0, potential: 0 };
  customers.forEach(c => {
    catCounts[getCategory(c.totalTickets)]++;
    sourceCounts[getSourceType(c.source)]++;
  });

  // ---- filter ----
  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const matchSearch =
      c.fullName.toLowerCase().includes(q) ||
      (c.companyName || '').toLowerCase().includes(q) ||
      c.phoneNumber.includes(q) ||
      (c.location || '').toLowerCase().includes(q) ||
      (c.source || '').toLowerCase().includes(q);
    const matchCat = catFilter === 'all' || getCategory(c.totalTickets) === catFilter;
    const matchSrc = srcFilter === 'all' || getSourceType(c.source) === srcFilter;
    return matchSearch && matchCat && matchSrc;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated  = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // ---- export ----
  const exportToExcel = () => {
    const BOM = '﻿';
    const headers = ['ردیف', 'نام مشتری', 'نام شرکت', 'شماره تماس', 'واتساپ', 'لوکیشن', 'نوع کسب‌وکار', 'دسته‌بندی', 'منبع ثبت', 'عنوان درخواست‌ها', 'تعداد تیکت', 'تاریخ اول تماس'];
    const rows = filtered.map((c, i) => {
      const srcCfg = SOURCE_CONFIG[getSourceType(c.source)];
      return [
        i + 1, c.fullName, c.companyName || '', c.phoneNumber, c.whatsappNumber || '',
        c.location, c.businessType || '',
        CATEGORY_CONFIG[getCategory(c.totalTickets)].labelFa,
        srcCfg.labelFa,
        getRequestTitles(c).join(' | '),
        c.totalTickets,
        c.firstContact ? new Date(c.firstContact).toLocaleDateString('fa-IR') : '',
      ];
    });
    const csv = BOM + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: `customers_bank_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ---- import ----
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>, isGoogleForm: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportType(isGoogleForm ? 'google' : 'csv');
    setImportStatus('در حال خواندن فایل...');
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error('فایل خالی یا نامعتبر');
      const headers = rows[0];
      const dataRows = rows.slice(1).filter(r => r.join('').length > 3);
      setImportStatus('تحلیل هوشمند ستون‌ها...');
      const mapping = await mapCsvHeaders(headers);
      setImportStatus(`در حال وارد کردن ${dataRows.length} ردیف...`);
      const getValue = (row: string[], field: string) => {
        const h = mapping[field]; const idx = headers.indexOf(h); return idx !== -1 ? row[idx] : '';
      };
      const sourceTag = isGoogleForm ? 'Google Form' : `Import: ${file.name}`;
      const newCustomers: Customer[] = dataRows.map((row, idx) => ({
        id: `${isGoogleForm ? 'GF' : 'IMP'}-${Date.now()}-${idx}`,
        fullName:      getValue(row, 'fullName')     || `ردیف ${idx + 1}`,
        companyName:   getValue(row, 'companyName')  || undefined,
        location:      getValue(row, 'location')     || 'N/A',
        phoneNumber:   getValue(row, 'phoneNumber')  || '',
        whatsappNumber:getValue(row, 'whatsappNumber') || getValue(row, 'phoneNumber') || '',
        email:         getValue(row, 'email')        || undefined,
        businessType:  getValue(row, 'businessType') || undefined,
        firstContact:  new Date().toISOString(),
        totalTickets:  0,
        source:        sourceTag,
      }));
      // merge: avoid duplicate phone numbers
      const existingPhones = new Set(customers.map(c => c.phoneNumber));
      const fresh = newCustomers.filter(c => !c.phoneNumber || !existingPhones.has(c.phoneNumber));
      const dupes = newCustomers.length - fresh.length;
      onUpdate([...customers, ...fresh]);
      setImportStatus(`✓ ${fresh.length} مشتری اضافه شد${dupes > 0 ? ` (${dupes} تکراری نادیده گرفته شد)` : ''}`);
      if (isGoogleForm) setSrcFilter('google_form');
      setTimeout(() => { setIsImporting(false); setImportStatus(''); }, 3000);
    } catch (err: any) {
      setImportStatus(`خطا: ${err.message || 'فایل پردازش نشد'}`);
      setTimeout(() => setIsImporting(false), 2500);
    }
    (isGoogleForm ? googleRef : csvRef).current && ((isGoogleForm ? googleRef : csvRef).current!.value = '');
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer) return;
    setIsSaving(true);
    await onEdit(editingCustomer.id, editingCustomer);
    setIsSaving(false);
    setEditingCustomer(null);
  };

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-2xl border border-gray-100 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-600 p-2.5 rounded-xl">
            <IconDatabase className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">بانک مشتریان</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {catCounts.all} مشتری ·
              <span className="text-red-500 font-medium"> {sourceCounts.google_form} گوگل فرم</span> ·
              <span className="text-blue-500 font-medium"> {sourceCounts.web_form} سایت</span>
            </p>
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm shadow-green-100"
          >
            <IconDownload className="w-4 h-4" />
            خروجی Excel
          </button>
          <button
            onClick={() => googleRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            <IconGoogleForm className="w-4 h-4" />
            {isImporting && importType === 'google' ? importStatus : 'ایمپورت گوگل فرم'}
          </button>
          <button
            onClick={() => csvRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            <IconUpload className="w-4 h-4" />
            {isImporting && importType === 'csv' ? importStatus : 'ایمپورت CSV'}
          </button>
          <input ref={googleRef} type="file" className="hidden" accept=".csv" onChange={e => handleImport(e, true)} disabled={isImporting} />
          <input ref={csvRef}    type="file" className="hidden" accept=".csv" onChange={e => handleImport(e, false)} disabled={isImporting} />
        </div>
      </div>

      {/* ── Category Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['vip', 'regular', 'new', 'potential'] as const).map(cat => {
          const cfg = CATEGORY_CONFIG[cat];
          const active = catFilter === cat;
          return (
            <button
              key={cat}
              onClick={() => { setCatFilter(active ? 'all' : cat); setPage(1); }}
              className={`bg-white p-4 rounded-xl border transition-all text-start ${active ? `${cfg.border} ring-2 ring-offset-1 ${cfg.text}` : 'border-gray-100 hover:border-gray-200'}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={`text-xs font-medium ${cfg.text}`}>{cfg.labelFa}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{catCounts[cat]}</div>
            </button>
          );
        })}
      </div>

      {/* ── Source Stats ── */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {(['google_form', 'web_form', 'custom_form', 'csv', 'direct'] as const).map(src => {
          const cfg = SOURCE_CONFIG[src];
          const active = srcFilter === src;
          return (
            <button
              key={src}
              onClick={() => { setSrcFilter(active ? 'all' : src); setPage(1); }}
              className={`p-3 rounded-xl border text-start transition-all ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-100 hover:border-gray-200'}`}
            >
              <div className={`text-lg mb-0.5`}>{cfg.emoji}</div>
              <div className={`text-[10px] font-medium ${active ? 'text-white/70' : 'text-gray-400'}`}>{cfg.labelFa}</div>
              <div className={`text-xl font-bold ${active ? 'text-white' : 'text-gray-900'}`}>{sourceCounts[src]}</div>
            </button>
          );
        })}
      </div>

      {/* ── Search + Filter ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <IconSearch className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            className="flex-grow outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent"
            placeholder="جستجو نام، شرکت، شماره، لوکیشن، منبع..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} className="text-gray-400 hover:text-gray-600">
              <IconX className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto">
          {([
            { key: 'all' as CategoryFilter,       label: `همه (${catCounts.all})` },
            { key: 'vip' as CategoryFilter,        label: `⭐ VIP (${catCounts.vip})` },
            { key: 'regular' as CategoryFilter,    label: `ثابت (${catCounts.regular})` },
            { key: 'new' as CategoryFilter,        label: `جدید (${catCounts.new})` },
            { key: 'potential' as CategoryFilter,  label: `بالقوه (${catCounts.potential})` },
          ]).map(tab => (
            <button key={tab.key} onClick={() => { setCatFilter(tab.key); setPage(1); }}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${catFilter === tab.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {tab.label}
            </button>
          ))}
          <span className="mx-2 text-gray-200 text-sm">|</span>
          {([
            { key: 'all' as SourceFilter,          label: `همه منابع` },
            { key: 'google_form' as SourceFilter,  label: `📊 گوگل فرم (${sourceCounts.google_form})` },
            { key: 'web_form' as SourceFilter,     label: `🌐 سایت (${sourceCounts.web_form})` },
            { key: 'custom_form' as SourceFilter,  label: `📝 فرم آنلاین (${sourceCounts.custom_form})` },
            { key: 'csv' as SourceFilter,          label: `📥 CSV (${sourceCounts.csv})` },
          ]).map(tab => (
            <button key={tab.key} onClick={() => { setSrcFilter(tab.key); setPage(1); }}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${srcFilter === tab.key ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 text-xs font-medium">
                <th className="px-3 py-3 text-center w-8 select-none">#</th>
                <th className="px-4 py-3 text-start min-w-[170px]">مشتری</th>
                <th className="px-4 py-3 text-start min-w-[120px]">شرکت</th>
                <th className="px-4 py-3 text-start min-w-[130px]">شماره تماس</th>
                <th className="px-4 py-3 text-start min-w-[100px]">لوکیشن</th>
                <th className="px-4 py-3 text-start min-w-[100px]">کسب‌وکار</th>
                <th className="px-4 py-3 text-center min-w-[85px]">دسته</th>
                <th className="px-4 py-3 text-center min-w-[100px]">منبع</th>
                <th className="px-4 py-3 text-start min-w-[220px]">عنوان درخواست‌ها</th>
                <th className="px-4 py-3 text-center min-w-[60px]">تیکت</th>
                <th className="px-4 py-3 text-start min-w-[100px]">اول تماس</th>
                {isAdmin && <th className="px-4 py-3 text-center min-w-[70px]">عملیات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map((customer, idx) => {
                const cat     = getCategory(customer.totalTickets);
                const catCfg  = CATEGORY_CONFIG[cat];
                const src     = getSourceType(customer.source);
                const srcCfg  = SOURCE_CONFIG[src];
                const titles  = getRequestTitles(customer);
                const rowNum  = (page - 1) * itemsPerPage + idx + 1;
                const initials = customer.fullName.split(' ').map(w => w[0]).slice(0, 2).join('');
                const date     = customer.firstContact
                  ? new Date(customer.firstContact).toLocaleDateString('fa-IR', { year: '2-digit', month: 'short', day: 'numeric' })
                  : '—';

                return (
                  <tr key={customer.id} className="hover:bg-gray-50/70 transition-colors group">
                    <td className="px-3 py-2.5 text-center text-xs text-gray-300 tabular-nums select-none">{rowNum}</td>

                    {/* name */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${src === 'google_form' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                          {initials}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-xs leading-tight">{customer.fullName}</div>
                          {customer.email && <div className="text-[10px] text-gray-400 dir-ltr">{customer.email}</div>}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-2.5 text-xs text-gray-500">{customer.companyName || <span className="text-gray-200">—</span>}</td>

                    {/* phone */}
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-gray-700 dir-ltr">{customer.phoneNumber || '—'}</span>
                        {customer.whatsappNumber && customer.whatsappNumber !== customer.phoneNumber && (
                          <span className="text-[10px] text-green-600 dir-ltr flex items-center gap-1">
                            <IconWhatsapp className="w-3 h-3" />{customer.whatsappNumber}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-2.5 text-xs text-gray-500">{customer.location}</td>

                    {/* biz */}
                    <td className="px-4 py-2.5">
                      {customer.businessType
                        ? <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-medium"><IconBriefcase className="w-3 h-3" />{customer.businessType}</span>
                        : <span className="text-gray-200 text-xs">—</span>}
                    </td>

                    {/* category */}
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catCfg.bg} ${catCfg.text} ${catCfg.border}`}>
                        {cat === 'vip' && <IconStar className="w-2.5 h-2.5" />}
                        {catCfg.labelFa}
                      </span>
                    </td>

                    {/* source */}
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${srcCfg.bg} ${srcCfg.text}`}>
                        <span>{srcCfg.emoji}</span>
                        {srcCfg.labelFa}
                      </span>
                    </td>

                    {/* request titles */}
                    <td className="px-4 py-2.5">
                      {titles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {titles.slice(0, 3).map((title, ti) => (
                            <span key={ti} className="bg-indigo-50 text-indigo-600 text-[10px] px-2 py-0.5 rounded font-medium whitespace-nowrap">
                              {title}
                            </span>
                          ))}
                          {titles.length > 3 && <span className="text-[10px] text-gray-400 px-1">+{titles.length - 3}</span>}
                        </div>
                      ) : <span className="text-gray-200 text-xs">—</span>}
                    </td>

                    {/* ticket count */}
                    <td className="px-4 py-2.5 text-center">
                      {customer.totalTickets > 0
                        ? <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full tabular-nums">{customer.totalTickets}</span>
                        : <span className="text-gray-300 text-xs">0</span>}
                    </td>

                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{date}</td>

                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingCustomer(customer)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <IconEdit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => window.confirm('آیا از حذف اطمینان دارید؟') && onDelete(customer.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <IconTrash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 12 : 11} className="py-16 text-center text-gray-400 text-sm">
                    <IconUsers className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                    {srcFilter === 'google_form' ? 'هنوز مشتری گوگل فرم ایمپورت نشده' : 'مشتری‌ای یافت نشد'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-400">{filtered.length} مشتری · صفحه {page} از {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-50">قبلی</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                return <button key={p} onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium ${page === p ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{p}</button>;
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-50">بعدی</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 text-sm">ویرایش مشتری</h3>
              <button onClick={() => setEditingCustomer(null)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {([
                { label: 'نام و نام خانوادگی', field: 'fullName'       as const, type: 'text' },
                { label: 'نام شرکت',           field: 'companyName'    as const, type: 'text' },
                { label: 'شماره تماس',         field: 'phoneNumber'    as const, type: 'tel'  },
                { label: 'واتساپ',             field: 'whatsappNumber' as const, type: 'tel'  },
                { label: 'ایمیل',              field: 'email'          as const, type: 'email'},
                { label: 'لوکیشن',             field: 'location'       as const, type: 'text' },
                { label: 'نوع کسب‌وکار',       field: 'businessType'   as const, type: 'text' },
              ] as { label: string; field: keyof Customer; type: string }[]).map(({ label, field, type }) => (
                <div key={String(field)}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-all ${type === 'tel' || type === 'email' ? 'dir-ltr' : ''}`}
                    value={(editingCustomer[field] as string) || ''}
                    onChange={e => setEditingCustomer({ ...editingCustomer, [field]: e.target.value })}
                  />
                </div>
              ))}
              {/* source select */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">منبع ثبت</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                  value={editingCustomer.source || 'Web Form'}
                  onChange={e => setEditingCustomer({ ...editingCustomer, source: e.target.value })}
                >
                  <option value="Google Form">📊 گوگل فرم</option>
                  <option value="Web Form">🌐 ثبت سایت</option>
                  <option value="Direct">👤 مستقیم</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditingCustomer(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">انصراف</button>
                <button onClick={handleSaveEdit} disabled={isSaving}
                  className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center gap-2 shadow-sm shadow-indigo-100 disabled:opacity-60">
                  {isSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <IconCheck className="w-4 h-4" />}
                  ذخیره
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
