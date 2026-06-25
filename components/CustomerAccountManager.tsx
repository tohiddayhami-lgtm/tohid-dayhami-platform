import React, { useState } from 'react';
import { CustomerAccount, Ticket, ServiceOption } from '../types';
import { IconPlus, IconTrash, IconEdit, IconUsers } from './Icons';

interface Props {
  customerAccounts: CustomerAccount[];
  tickets: Ticket[];
  services: ServiceOption[];
  currentUserName: string;
  onSave: (account: CustomerAccount) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  lang: 'fa' | 'en';
}

export const CustomerAccountManager: React.FC<Props> = ({
  customerAccounts, tickets, services, currentUserName, onSave, onDelete
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: '', username: '', password: '', ticketIds: [] as string[], note: '', isActive: true });
  const [ticketSearch, setTicketSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => { setForm({ fullName: '', username: '', password: '', ticketIds: [], note: '', isActive: true }); setEditId(null); setShowForm(false); setTicketSearch(''); };

  const handleEdit = (acc: CustomerAccount) => {
    setForm({ fullName: acc.fullName, username: acc.username, password: acc.password, ticketIds: acc.ticketIds, note: acc.note || '', isActive: acc.isActive });
    setEditId(acc.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.username || !form.password) return;
    setSaving(true);
    const account: CustomerAccount = {
      id: editId || `ca_${Date.now()}`,
      ...form,
      createdAt: editId ? (customerAccounts.find(a => a.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      createdBy: currentUserName,
    };
    await onSave(account);
    resetForm();
    setSaving(false);
  };

  const toggleTicket = (id: string) => {
    setForm(f => ({ ...f, ticketIds: f.ticketIds.includes(id) ? f.ticketIds.filter(t => t !== id) : [...f.ticketIds, id] }));
  };

  const filteredTickets = tickets.filter(t => {
    if (!ticketSearch) return true;
    const q = ticketSearch.toLowerCase();
    return t.id.toLowerCase().includes(q) || t.customerName.toLowerCase().includes(q) || (t.companyName || '').toLowerCase().includes(q);
  }).slice(0, 20);

  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-800 transition-colors bg-white";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <IconUsers className="w-4 h-4 text-gray-500" /> مدیریت حساب‌های مشتریان
          <span className="text-xs font-normal text-gray-400">({customerAccounts.length} حساب)</span>
        </h2>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ fullName: '', username: '', password: '', ticketIds: [], note: '', isActive: true }); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-black transition-colors">
          <IconPlus className="w-3.5 h-3.5" /> حساب جدید
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">{editId ? 'ویرایش حساب' : 'ایجاد حساب جدید'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">نام کامل</label>
                <input required className={inputClass} placeholder="نام مشتری" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">نام کاربری</label>
                <input required className={inputClass + " dir-ltr"} placeholder="username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">رمز عبور</label>
                <input required className={inputClass + " dir-ltr"} placeholder="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">انتخاب پرونده(ها)</label>
              <input className={inputClass + " mb-2"} placeholder="جستجو پرونده..." value={ticketSearch} onChange={e => setTicketSearch(e.target.value)} />
              <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-100 rounded-lg p-2">
                {filteredTickets.length === 0 && <p className="text-xs text-gray-400 text-center py-2">پرونده‌ای یافت نشد</p>}
                {filteredTickets.map(t => (
                  <label key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={form.ticketIds.includes(t.id)} onChange={() => toggleTicket(t.id)} className="rounded" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono text-gray-400">#{t.id}</span>
                      <span className="text-xs font-medium text-gray-700 mr-2">{t.customerName}</span>
                      {t.companyName && <span className="text-[10px] text-gray-400">({t.companyName})</span>}
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{t.status}</span>
                  </label>
                ))}
              </div>
              {form.ticketIds.length > 0 && (
                <p className="text-[10px] text-gray-500 mt-1">{form.ticketIds.length} پرونده انتخاب شده</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">یادداشت (اختیاری)</label>
              <input className={inputClass} placeholder="یادداشت..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              <label htmlFor="isActive" className="text-xs text-gray-600">حساب فعال</label>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={resetForm} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">انصراف</button>
              <button type="submit" disabled={saving} className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50">
                {saving ? '...' : (editId ? 'ذخیره تغییرات' : 'ایجاد حساب')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {customerAccounts.length === 0 && !showForm && (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center text-gray-400 text-sm">
          هنوز حساب مشتری ثبت نشده است
        </div>
      )}
      {customerAccounts.map(acc => {
        const accTickets = tickets.filter(t => acc.ticketIds.includes(t.id));
        return (
          <div key={acc.id} className={`bg-white border rounded-xl p-4 ${acc.isActive ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-900">{acc.fullName}</span>
                  <span className="text-[10px] font-mono text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded dir-ltr">{acc.username}</span>
                  {!acc.isActive && <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">غیرفعال</span>}
                </div>
                {acc.note && <p className="text-xs text-gray-400 mt-0.5">{acc.note}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {accTickets.length === 0
                    ? <span className="text-[10px] text-gray-300">بدون پرونده</span>
                    : accTickets.map(t => (
                      <div key={t.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                        <span className="text-[10px] font-mono text-gray-400">#{t.id}</span>
                        <span className="text-[10px] text-gray-600">{t.customerName}</span>
                        <span className="text-[9px] text-gray-400">({t.status})</span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleEdit(acc)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <IconEdit className="w-3.5 h-3.5" />
                </button>
                <button onClick={async () => { if (confirm('حذف این حساب؟')) await onDelete(acc.id); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <IconTrash className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
