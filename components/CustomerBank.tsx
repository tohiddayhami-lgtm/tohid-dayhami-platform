import React, { useState, useRef } from 'react';
import { Customer, Ticket, ServiceOption, Personnel } from '../types';
import { IconSearch, IconUsers, IconDatabase, IconTag, IconStar, IconEdit, IconTrash, IconCheck, IconUpload, IconWhatsapp, IconBriefcase } from './Icons';
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

const getCategory = (totalTickets: number): Exclude<CategoryFilter, 'all'> => {
  if (totalTickets >= 5) return 'vip';
  if (totalTickets >= 2) return 'regular';
  if (totalTickets === 1) return 'new';
  return 'potential';
};

const CATEGORY_CONFIG = {
  vip:       { label: 'VIP', labelFa: 'VIP طلایی',   bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-400'  },
  regular:   { label: 'Regular', labelFa: 'ثابت',    bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-400' },
  new:       { label: 'New', labelFa: 'جدید',         bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-400'  },
  potential: { label: 'Potential', labelFa: 'بالقوه', bg: 'bg-gray-50',    text: 'text-gray-500',   border: 'border-gray-200',   dot: 'bg-gray-300'   },
};

const IconDownload = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);

const IconX = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

export const CustomerBank: React.FC<Props> = ({
  customers,
  tickets,
  services,
  currentUser,
  onUpdate,
  onEdit,
  onDelete,
  lang,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [page, setPage] = useState(1);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsPerPage = 20;

  const isAdmin = currentUser.roles.includes('مدیر') || currentUser.username === 'master';

  const getCustomerTickets = (customer: Customer) =>
    tickets.filter(t => t.phoneNumber === customer.phoneNumber || t.customerName === customer.fullName);

  const getRequestTitles = (customer: Customer): string[] => {
    const ct = getCustomerTickets(customer);
    const seen = new Set<string>();
    return ct
      .map(t => services.find(s => s.id === t.serviceId)?.title || '')
      .filter(title => {
        if (!title || seen.has(title)) return false;
        seen.add(title);
        return true;
      });
  };

  const filtered = customers.filter(c => {
    const matchSearch =
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (c.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
      c.phoneNumber.includes(search) ||
      (c.location || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || getCategory(c.totalTickets) === categoryFilter;
    return matchSearch && matchCat;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const counts = {
    all: customers.length,
    vip: customers.filter(c => getCategory(c.totalTickets) === 'vip').length,
    regular: customers.filter(c => getCategory(c.totalTickets) === 'regular').length,
    new: customers.filter(c => getCategory(c.totalTickets) === 'new').length,
    potential: customers.filter(c => getCategory(c.totalTickets) === 'potential').length,
  };

  const exportToExcel = () => {
    const BOM = '﻿';
    const headers = ['ردیف', 'نام مشتری', 'نام شرکت', 'شماره تماس', 'واتساپ', 'لوکیشن', 'نوع کسب‌وکار', 'دسته‌بندی', 'عنوان درخواست‌ها', 'تعداد تیکت', 'تاریخ اول تماس', 'منبع'];
    const rows = filtered.map((c, i) => {
      const titles = getRequestTitles(c).join(' | ');
      const cat = CATEGORY_CONFIG[getCategory(c.totalTickets)].labelFa;
      const date = c.firstContact ? new Date(c.firstContact).toLocaleDateString('fa-IR') : '';
      return [
        i + 1,
        c.fullName,
        c.companyName || '',
        c.phoneNumber,
        c.whatsappNumber || '',
        c.location,
        c.businessType || '',
        cat,
        titles,
        c.totalTickets,
        date,
        c.source || '',
      ];
    });
    const csv =
      BOM +
      [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportStatus('در حال خواندن فایل...');
    try {
      const text = await file.text();
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.replace(/^"|"$/g, '').trim()));
      if (rows.length < 2) throw new Error('Invalid CSV');
      const headers = rows[0];
      const dataRows = rows.slice(1).filter(row => row.join('').length > 5);
      setImportStatus('تحلیل هوشمند ستون‌ها...');
      const mapping = await mapCsvHeaders(headers);
      setImportStatus('در حال وارد کردن...');
      const getValue = (row: string[], field: string) => {
        const headerName = mapping[field];
        const idx = headers.indexOf(headerName);
        return idx !== -1 ? row[idx] : '';
      };
      const newCustomers: Customer[] = dataRows.map((row, idx) => ({
        id: `IMP-${Date.now()}-${idx}`,
        fullName: getValue(row, 'fullName') || `Imported ${idx + 1}`,
        companyName: getValue(row, 'companyName'),
        location: getValue(row, 'location') || 'N/A',
        phoneNumber: getValue(row, 'phoneNumber') || '',
        whatsappNumber: getValue(row, 'whatsappNumber') || '',
        email: getValue(row, 'email'),
        businessType: getValue(row, 'businessType') || 'Other',
        firstContact: new Date().toISOString(),
        totalTickets: 0,
        source: `Import: ${file.name}`,
      }));
      onUpdate([...customers, ...newCustomers]);
      setImportStatus(`موفق! ${newCustomers.length} مشتری اضافه شد.`);
      setTimeout(() => { setIsImporting(false); setImportStatus(''); }, 2500);
    } catch {
      setImportStatus('خطا در پردازش فایل.');
      setTimeout(() => setIsImporting(false), 2000);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer) return;
    setIsSaving(true);
    await onEdit(editingCustomer.id, editingCustomer);
    setIsSaving(false);
    setEditingCustomer(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('آیا از حذف این مشتری اطمینان دارید؟')) {
      await onDelete(id);
    }
  };

  const categoryTabs: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: `همه (${counts.all})` },
    { key: 'vip', label: `VIP طلایی (${counts.vip})` },
    { key: 'regular', label: `ثابت (${counts.regular})` },
    { key: 'new', label: `جدید (${counts.new})` },
    { key: 'potential', label: `بالقوه (${counts.potential})` },
  ];

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-2xl border border-gray-100 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-600 p-2.5 rounded-xl">
            <IconDatabase className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">بانک مشتریان</h2>
            <p className="text-xs text-gray-400 mt-0.5">{counts.all} مشتری ثبت شده</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm shadow-green-200"
          >
            <IconDownload className="w-4 h-4" />
            خروجی Excel
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold rounded-xl transition-colors"
          >
            <IconUpload className="w-4 h-4" />
            {isImporting ? importStatus : 'ایمپورت CSV'}
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} disabled={isImporting} />
        </div>
      </div>

      {/* Category Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['vip', 'regular', 'new', 'potential'] as const).map(cat => {
          const cfg = CATEGORY_CONFIG[cat];
          return (
            <button
              key={cat}
              onClick={() => { setCategoryFilter(cat === categoryFilter ? 'all' : cat); setPage(1); }}
              className={`bg-white p-4 rounded-xl border transition-all text-start ${categoryFilter === cat ? `${cfg.border} ring-2 ring-offset-1 ring-current ${cfg.text}` : 'border-gray-100 hover:border-gray-200'}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={`text-xs font-medium ${cfg.text}`}>{cfg.labelFa}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{counts[cat]}</div>
            </button>
          );
        })}
      </div>

      {/* Search + Filter Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <IconSearch className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            className="flex-grow outline-none text-sm text-gray-700 placeholder-gray-400"
            placeholder="جستجو نام، شرکت، شماره، لوکیشن..."
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
          {categoryTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setCategoryFilter(tab.key); setPage(1); }}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                categoryFilter === tab.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 text-xs font-medium">
                <th className="px-3 py-3 text-center w-8">#</th>
                <th className="px-4 py-3 text-start min-w-[160px]">مشتری</th>
                <th className="px-4 py-3 text-start min-w-[120px]">شرکت</th>
                <th className="px-4 py-3 text-start min-w-[130px]">شماره تماس</th>
                <th className="px-4 py-3 text-start min-w-[100px]">لوکیشن</th>
                <th className="px-4 py-3 text-start min-w-[110px]">کسب‌وکار</th>
                <th className="px-4 py-3 text-center min-w-[90px]">دسته</th>
                <th className="px-4 py-3 text-start min-w-[220px]">عنوان درخواست‌ها</th>
                <th className="px-4 py-3 text-center min-w-[70px]">تیکت</th>
                <th className="px-4 py-3 text-start min-w-[110px]">اول تماس</th>
                {isAdmin && <th className="px-4 py-3 text-center min-w-[80px]">عملیات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map((customer, idx) => {
                const cat = getCategory(customer.totalTickets);
                const cfg = CATEGORY_CONFIG[cat];
                const titles = getRequestTitles(customer);
                const rowNum = (page - 1) * itemsPerPage + idx + 1;
                const initials = customer.fullName.split(' ').map(w => w[0]).slice(0, 2).join('');
                const firstContactDate = customer.firstContact
                  ? new Date(customer.firstContact).toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—';

                return (
                  <tr key={customer.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400 tabular-nums">{rowNum}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <span className="font-medium text-gray-900 text-xs">{customer.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{customer.companyName || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-gray-700 dir-ltr">{customer.phoneNumber}</span>
                        {customer.whatsappNumber && customer.whatsappNumber !== customer.phoneNumber && (
                          <span className="text-[10px] text-green-600 dir-ltr flex items-center gap-1">
                            <IconWhatsapp className="w-3 h-3" />{customer.whatsappNumber}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{customer.location}</td>
                    <td className="px-4 py-2.5">
                      {customer.businessType ? (
                        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-medium">
                          <IconBriefcase className="w-3 h-3" />{customer.businessType}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cat === 'vip' && <IconStar className="w-2.5 h-2.5" />}
                        {cfg.labelFa}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {titles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {titles.slice(0, 3).map((title, ti) => (
                            <span key={ti} className="bg-indigo-50 text-indigo-600 text-[10px] px-2 py-0.5 rounded font-medium whitespace-nowrap">
                              {title}
                            </span>
                          ))}
                          {titles.length > 3 && (
                            <span className="text-[10px] text-gray-400 px-1 py-0.5">+{titles.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {customer.totalTickets > 0 ? (
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full tabular-nums">
                          {customer.totalTickets}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{firstContactDate}</td>
                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingCustomer(customer)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <IconEdit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(customer.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
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
                  <td colSpan={isAdmin ? 11 : 10} className="py-16 text-center text-gray-400 text-sm">
                    <IconUsers className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                    مشتری‌ای یافت نشد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-400">
              {filtered.length} مشتری · صفحه {page} از {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                قبلی
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${page === p ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                بعدی
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
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
              {[
                { label: 'نام و نام خانوادگی', field: 'fullName' as const, type: 'text' },
                { label: 'نام شرکت', field: 'companyName' as const, type: 'text' },
                { label: 'شماره تماس', field: 'phoneNumber' as const, type: 'tel' },
                { label: 'واتساپ', field: 'whatsappNumber' as const, type: 'tel' },
                { label: 'لوکیشن', field: 'location' as const, type: 'text' },
                { label: 'نوع کسب‌وکار', field: 'businessType' as const, type: 'text' },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all ${type === 'tel' ? 'dir-ltr text-right' : ''}`}
                    value={(editingCustomer[field] as string) || ''}
                    onChange={e => setEditingCustomer({ ...editingCustomer, [field]: e.target.value })}
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  انصراف
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors shadow-sm shadow-indigo-200 disabled:opacity-60"
                >
                  {isSaving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <IconCheck className="w-4 h-4" />
                  )}
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
