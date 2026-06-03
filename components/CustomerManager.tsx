import React, { useState, useRef } from 'react';
import { Customer, Personnel } from '../types';
import { IconSearch, IconWhatsapp, IconBriefcase, IconUsers, IconUpload, IconEdit, IconTrash, IconCheck } from './Icons';
import { mapCsvHeaders } from '../services/geminiService';
import { Language } from '../App';

interface Props {
  customers: Customer[];
  currentUser: Personnel;
  onUpdate: (customers: Customer[]) => void;
  onEdit: (id: string, updates: Partial<Customer>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  lang: Language;
}

export const CustomerManager: React.FC<Props> = ({ customers, currentUser, onUpdate, onEdit, onDelete, lang }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const itemsPerPage = 15;
  const isAdmin = currentUser.roles.includes('مدیر') || currentUser.username === 'master';

  const t = {
      fa: {
          header: 'بانک اطلاعات مشتریان',
          sub: 'مدیریت لیست مشتریان و وارد کردن اطلاعات انبوه',
          search: 'جستجو...',
          import: 'ایمپورن CSV',
          reading: 'در حال خواندن فایل...',
          mapping: 'تحلیل هوشمند ستون‌ها...',
          importing: 'در حال وارد کردن...',
          successImport: 'موفقیت‌آمیز! مشتریان اضافه شدند.',
          errorImport: 'خطا در پردازش فایل.',
          edit: 'ویرایش اطلاعات مشتری',
          name: 'نام و نام خانوادگی',
          company: 'نام شرکت',
          location: 'لوکیشن',
          phone: 'شماره تماس',
          bizType: 'نوع کسب‌وکار',
          save: 'ذخیره تغییرات',
          cancel: 'انصراف',
          deleteConfirm: 'آیا از حذف این مشتری اطمینان دارید؟',
          colCustomer: 'مشتری',
          colContact: 'شماره تماس / منبع',
          colLoc: 'لوکیشن',
          colBiz: 'حوزه کسب‌وکار',
          colOrders: 'سفارشات',
          colAction: 'عملیات',
          noOrders: 'بدون سفارش',
          empty: 'هیچ مشتری‌ای یافت نشد.',
          prev: 'قبلی',
          next: 'بعدی',
          ticket: 'تیکت'
      },
      en: {
          header: 'Customer Database',
          sub: 'Manage customer list and bulk import',
          search: 'Search...',
          import: 'Import CSV',
          reading: 'Reading file...',
          mapping: 'AI Mapping Columns...',
          importing: 'Importing records...',
          successImport: 'Success! Customers added.',
          errorImport: 'Error processing file.',
          edit: 'Edit Customer',
          name: 'Full Name',
          company: 'Company',
          location: 'Location',
          phone: 'Phone Number',
          bizType: 'Business Type',
          save: 'Save Changes',
          cancel: 'Cancel',
          deleteConfirm: 'Are you sure you want to delete this customer?',
          colCustomer: 'Customer',
          colContact: 'Contact / Source',
          colLoc: 'Location',
          colBiz: 'Industry',
          colOrders: 'Orders',
          colAction: 'Action',
          noOrders: 'No Orders',
          empty: 'No customers found.',
          prev: 'Prev',
          next: 'Next',
          ticket: 'Ticket'
      }
  }[lang];

  const filteredCustomers = customers.filter(c => c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || c.phoneNumber.includes(searchTerm) || c.whatsappNumber.includes(searchTerm));
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsImporting(true); setImportStatus(t.reading);
    try {
      const text = await file.text();
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.replace(/^"|"$/g, '').trim()));
      if (rows.length < 2) throw new Error("Invalid CSV");
      const headers = rows[0];
      const dataRows = rows.slice(1).filter(row => row.length === headers.length || row.join('').length > 5);
      setImportStatus(t.mapping);
      const mapping = await mapCsvHeaders(headers);
      setImportStatus(t.importing);
      const newCustomers: Customer[] = dataRows.map((row, index) => {
        const getValue = (field: string) => { const headerName = mapping[field]; const idx = headers.indexOf(headerName); return idx !== -1 ? row[idx] : ''; };
        return { id: `IMP-${Date.now()}-${index}`, fullName: getValue('fullName') || `Imported ${index + 1}`, companyName: getValue('companyName'), location: getValue('location') || 'N/A', phoneNumber: getValue('phoneNumber') || '', whatsappNumber: getValue('whatsappNumber') || '', email: getValue('email'), businessType: getValue('businessType') || 'Other', firstContact: new Date().toISOString(), totalTickets: 0, source: `Import: ${file.name}` };
      });
      onUpdate([...customers, ...newCustomers]);
      setImportStatus(t.successImport);
      setTimeout(() => { setIsImporting(false); setImportStatus(''); }, 2000);
    } catch (error) {
        setImportStatus(t.errorImport);
        setTimeout(() => setIsImporting(false), 2000);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string) => {
      if (window.confirm(t.deleteConfirm)) {
          await onDelete(id);
      }
  };

  const handleSaveEdit = async () => {
      if (!editingCustomer) return;
      setIsSavingEdit(true);
      await onEdit(editingCustomer.id, editingCustomer);
      setIsSavingEdit(false);
      setEditingCustomer(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm gap-4">
            <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg"><IconUsers className="w-6 h-6" /></div>
                    {t.header}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{t.sub}</p>
            </div>
            <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-50 flex items-center gap-2">
                    <IconUpload className="w-5 h-5" /> {isImporting ? importStatus : t.import}
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} disabled={isImporting} />
            </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
            <IconSearch className="w-5 h-5 text-gray-400" />
            <input 
                className="flex-grow outline-none text-gray-700"
                placeholder={t.search}
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-start">
                    <thead className="bg-gray-50 text-gray-500 text-sm">
                        <tr>
                            <th className="px-6 py-4 text-start">{t.colCustomer}</th>
                            <th className="px-6 py-4 text-start">{t.colContact}</th>
                            <th className="px-6 py-4 text-start">{t.colLoc}</th>
                            <th className="px-6 py-4 text-start">{t.colBiz}</th>
                            <th className="px-6 py-4 text-center">{t.colOrders}</th>
                            <th className="px-6 py-4 text-center">{t.colAction}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedCustomers.map(customer => (
                            <tr key={customer.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900">{customer.fullName}</div>
                                    <div className="text-xs text-gray-500">{customer.companyName}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-gray-800 dir-ltr text-right">{customer.phoneNumber}</div>
                                    <div className="text-xs text-gray-400 truncate max-w-[150px]">{customer.source || 'Direct'}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{customer.location}</td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                                        <IconBriefcase className="w-3 h-3" /> {customer.businessType}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {customer.totalTickets > 0 ? (
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">{customer.totalTickets} {t.ticket}</span>
                                    ) : (
                                        <span className="text-gray-400 text-xs">{t.noOrders}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => setEditingCustomer(customer)} className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                            <IconEdit className="w-4 h-4" />
                                        </button>
                                        {isAdmin && (
                                            <button onClick={() => handleDelete(customer.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                <IconTrash className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {paginatedCustomers.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-8 text-gray-400">{t.empty}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="flex justify-center p-4 border-t border-gray-100 gap-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 bg-gray-100 rounded text-sm text-gray-600 disabled:opacity-50"
                    >
                        {t.prev}
                    </button>
                    <span className="text-sm text-gray-600 flex items-center">{currentPage} / {totalPages}</span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-gray-100 rounded text-sm text-gray-600 disabled:opacity-50"
                    >
                        {t.next}
                    </button>
                </div>
            )}
        </div>

        {editingCustomer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-indigo-50 rounded-t-2xl">
                        <h3 className="font-bold text-indigo-900">{t.edit}</h3>
                        <button onClick={() => setEditingCustomer(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t.name}</label>
                            <input className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={editingCustomer.fullName} onChange={e => setEditingCustomer({...editingCustomer, fullName: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t.company}</label>
                            <input className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={editingCustomer.companyName || ''} onChange={e => setEditingCustomer({...editingCustomer, companyName: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t.location}</label>
                                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={editingCustomer.location} onChange={e => setEditingCustomer({...editingCustomer, location: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t.phone}</label>
                                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dir-ltr text-right" value={editingCustomer.phoneNumber} onChange={e => setEditingCustomer({...editingCustomer, phoneNumber: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t.bizType}</label>
                            <input className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={editingCustomer.businessType || ''} onChange={e => setEditingCustomer({...editingCustomer, businessType: e.target.value})} />
                        </div>
                        <div className="flex justify-end pt-2 gap-2">
                            <button onClick={() => setEditingCustomer(null)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">{t.cancel}</button>
                            <button onClick={handleSaveEdit} disabled={isSavingEdit} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-2">
                                {isSavingEdit ? '...' : <><IconCheck className="w-4 h-4" /> {t.save}</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
