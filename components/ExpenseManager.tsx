
import React, { useState, useEffect, useRef } from 'react';
import { Expense, Currency, ExpenseCategory, Personnel, AttachedFile, SalesRecord } from '../types';
import { IconPlus, IconTrash, IconEdit, IconCheck, IconSearch, IconFileText, IconWallet, IconClock, IconUsers, IconRefreshCw, IconMoney, IconChart } from './Icons';
import { saveExpense, updateExpense, deleteExpense, subscribeToExpenses, uploadFileWithProgress, subscribeToSalesRecords } from '../services/firebaseService';
import { Language } from '../App';

interface Props {
  currentUser: Personnel;
  personnel: Personnel[];
  lang: Language;
}

export const ExpenseManager: React.FC<Props> = ({ currentUser, personnel, lang }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filter States
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');
  const [personnelFilter, setPersonnelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<Expense>>({
    title: '',
    amount: 0,
    paidAmount: 0,
    currency: 'IRR',
    category: 'operational',
    date: new Date().toISOString().split('T')[0],
    paidTo: '',
    personnelId: '',
    description: '',
    status: 'paid',
    files: []
  });

  const [displayAmount, setDisplayAmount] = useState('');
  const [displayPaidAmount, setDisplayPaidAmount] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMaster = currentUser.username === 'master' || currentUser.roles.includes('مدیر');

  useEffect(() => {
    const unsub = subscribeToExpenses(setExpenses);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToSalesRecords(setSalesRecords);
    return () => unsub();
  }, []);

  const t = {
    fa: {
      header: 'مدیریت هزینه‌ها و واریزی‌ها',
      sub: 'ثبت و پایش هزینه‌های عملیاتی، غیرعملیاتی و پرداختی به اشخاص',
      add: 'ثبت هزینه جدید',
      edit: 'ویرایش هزینه',
      payPortion: 'ثبت پرداخت مرحله‌ای',
      title: 'عنوان هزینه',
      amount: 'مبلغ کل هزینه',
      paidAmount: 'مبلغ پرداخت شده تا کنون',
      currency: 'ارز',
      category: 'دسته‌بندی',
      date: 'تاریخ ثبت/پرداخت',
      paidTo: 'پرداخت شده به (نام شخص/شرکت)',
      linkedStaff: 'مرتبط با پرسنل',
      desc: 'توضیحات / جزئیات',
      status: 'وضعیت تسویه',
      receipt: 'پیوست رسید / فاکتور',
      save: 'ذخیره نهایی',
      cancel: 'انصراف',
      categories: {
        all: 'همه دسته‌ها',
        operational: 'هزینه عملیاتی',
        non_operational: 'هزینه غیرعملیاتی',
        salary: 'حقوق و مزایا',
        sales_commission: 'کمیسیون فروش',
        designer_commission: 'کمیسیون طراح',
        marketing: 'تبلیغات و مارکتینگ',
        rent: 'اجاره و قبوض',
        tax: 'مالیات و عوارض',
        other: 'سایر موارد'
      },
      table: {
        title: 'شرح',
        amount: 'مبلغ (پرداخت / کل)',
        cat: 'نوع',
        to: 'گیرنده',
        date: 'تاریخ',
        status: 'وضعیت'
      },
      stats: {
        total: 'کل فاکتورها',
        paid: 'مجموع پرداختی‌ها',
        remaining: 'مانده معوقات (بدهی)',
        count: 'تعداد تراکنش'
      },
      filters: {
        allPersonnel: 'همه پرسنل',
        staffSelect: 'فیلتر پرسنل'
      },
      paid: 'تسویه شده',
      pending: 'در انتظار پرداخت',
      partial: 'پرداخت بخشی',
      deleteConfirm: 'آیا از حذف این رکورد هزینه اطمینان دارید؟',
      uploading: 'در حال آپلود...',
      empty: 'هزینه‌ای یافت نشد.',
      noLink: 'بدون ارتباط پرسنلی (متفرقه)',
      remained: 'باقیمانده:',
      newPayment: 'مبلغ پرداختی جدید'
    },
    en: {
      header: 'Expenses & Payments',
      sub: 'Track operational, non-operational costs and person payments',
      add: 'New Expense',
      edit: 'Edit Expense',
      payPortion: 'Record Partial Payment',
      title: 'Title',
      amount: 'Total Amount',
      paidAmount: 'Amount Paid So Far',
      currency: 'Currency',
      category: 'Category',
      date: 'Date',
      paidTo: 'Paid To (Name)',
      linkedStaff: 'Linked Personnel',
      desc: 'Description',
      status: 'Settlement Status',
      receipt: 'Receipt / Attachment',
      save: 'Save Expense',
      cancel: 'Cancel',
      categories: {
        all: 'All Categories',
        operational: 'Operational',
        non_operational: 'Non-Operational',
        salary: 'Salary & Benefits',
        sales_commission: 'Sales Commission',
        designer_commission: 'Designer Commission',
        marketing: 'Marketing',
        rent: 'Rent & Utilities',
        tax: 'Tax & Fees',
        other: 'Others'
      },
      table: {
        title: 'Description',
        amount: 'Amount (Paid / Total)',
        cat: 'Type',
        to: 'Receiver',
        date: 'Date',
        status: 'Status'
      },
      stats: {
        total: 'Total Invoices',
        paid: 'Total Disbursed',
        remaining: 'Total Arrears',
        count: 'Trans. Count'
      },
      filters: {
        allPersonnel: 'All Staff',
        staffSelect: 'Filter Staff'
      },
      paid: 'Paid',
      pending: 'Pending',
      partial: 'Partially Paid',
      deleteConfirm: 'Are you sure you want to delete this expense record?',
      uploading: 'Uploading...',
      empty: 'No expenses found.',
      noLink: 'No Link',
      remained: 'Remained:',
      newPayment: 'New Payment Amount'
    }
  }[lang];

  const filteredExpenses = expenses.filter(ex => {
    const matchesCat = categoryFilter === 'all' || ex.category === categoryFilter;
    const matchesSearch = ex.title.toLowerCase().includes(searchTerm.toLowerCase()) || ex.paidTo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !dateFilter || ex.date.startsWith(dateFilter);
    const matchesPersonnel = personnelFilter === 'all' || ex.personnelId === personnelFilter;
    return matchesCat && matchesSearch && matchesDate && matchesPersonnel;
  });

  // Calculate stats per currency
  const getStatsByCurrency = () => {
    const totals: Record<string, { total: number, paid: number, remaining: number }> = {};
    
    filteredExpenses.forEach(ex => {
      const cur = ex.currency || 'IRR';
      if (!totals[cur]) totals[cur] = { total: 0, paid: 0, remaining: 0 };
      
      const amt = ex.amount || 0;
      const pd = ex.paidAmount || 0;
      
      totals[cur].total += amt;
      totals[cur].paid += pd;
      totals[cur].remaining += (amt - pd);
    });

    return totals;
  };

  const currencyStats = getStatsByCurrency();
  const activeCurrencies = Object.keys(currencyStats);

  const normalizeDigits = (val: string) => {
    return val.toString()
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
  };

  const formatDisplayAmount = (val: string) => {
    const normalized = normalizeDigits(val);
    const clean = normalized.replace(/\D/g, "");
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleAmountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatDisplayAmount(rawValue);
    setDisplayAmount(formatted);
    const numericValue = parseFloat(formatted.replace(/,/g, '')) || 0;
    setFormData(prev => ({ ...prev, amount: numericValue }));
  };

  const handlePaidAmountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatDisplayAmount(rawValue);
    setDisplayPaidAmount(formatted);
    const numericValue = parseFloat(formatted.replace(/,/g, '')) || 0;
    setFormData(prev => ({ ...prev, paidAmount: numericValue }));
  };

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setFormData({ title: '', amount: 0, paidAmount: 0, currency: 'IRR', category: 'operational', date: new Date().toISOString().split('T')[0], paidTo: '', personnelId: '', description: '', status: 'paid', files: [] });
    setDisplayAmount('');
    setDisplayPaidAmount('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (ex: Expense) => {
    setEditingExpense(ex);
    setFormData({ ...ex, personnelId: ex.personnelId || '' });
    setDisplayAmount(ex.amount.toLocaleString());
    setDisplayPaidAmount((ex.paidAmount || 0).toLocaleString());
    setShowAddModal(true);
  };

  const handleOpenPayment = (ex: Expense) => {
    setShowPaymentModal(ex);
    setFormData({ ...ex });
    setDisplayPaidAmount(''); // New amount to add
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) return;
    setIsSubmitting(true);
    
    const amount = Number(formData.amount);
    const paid = Number(formData.paidAmount || 0);
    
    let status: 'paid' | 'pending' | 'partial' = 'pending';
    if (paid >= amount) status = 'paid';
    else if (paid > 0) status = 'partial';

    const expense: Expense = {
      id: editingExpense?.id || `exp-${Date.now()}`,
      title: formData.title!,
      amount: amount,
      paidAmount: paid,
      currency: formData.currency as Currency,
      category: formData.category as ExpenseCategory,
      date: formData.date!,
      paidTo: formData.paidTo!,
      personnelId: formData.personnelId || undefined,
      description: formData.description,
      files: formData.files,
      status: status,
      createdAt: editingExpense?.createdAt || new Date().toISOString(),
      createdBy: editingExpense?.createdBy || currentUser.fullName
    };

    if (editingExpense) {
      await updateExpense(expense.id, expense, currentUser.fullName);
    } else {
      await saveExpense(expense, currentUser.fullName);
    }

    setIsSubmitting(false);
    setShowAddModal(false);
    setEditingExpense(null);
  };

  const handleSavePayment = async () => {
    if (!showPaymentModal) return;
    setIsSubmitting(true);
    
    const newAddition = parseFloat(normalizeDigits(displayPaidAmount).replace(/,/g, '')) || 0;
    const currentPaid = showPaymentModal.paidAmount || 0;
    const totalPaid = currentPaid + newAddition;
    const totalAmount = showPaymentModal.amount;

    let status: 'paid' | 'pending' | 'partial' = 'pending';
    if (totalPaid >= totalAmount) status = 'paid';
    else if (totalPaid > 0) status = 'partial';

    await updateExpense(showPaymentModal.id, {
        paidAmount: totalPaid,
        status: status
    }, currentUser.fullName);

    setIsSubmitting(false);
    setShowPaymentModal(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t.deleteConfirm)) {
      await deleteExpense(id, currentUser.fullName);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const newFile: AttachedFile = { name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 };
    setFormData(prev => ({ ...prev, files: [...(prev.files || []), newFile] }));
    
    uploadFileWithProgress(
      file,
      (progress) => {
        setFormData(prev => ({ ...prev, files: prev.files?.map(f => f.name === file.name ? { ...f, progress } : f) }));
      },
      (url) => {
        setFormData(prev => ({ ...prev, files: prev.files?.map(f => f.name === file.name ? { ...f, content: url, status: 'success', progress: 100 } : f) }));
      },
      (err) => {
        setFormData(prev => ({ ...prev, files: prev.files?.map(f => f.name === file.name ? { ...f, status: 'error' } : f) }));
      },
      'documents'
    );
  };

  const getPersonnelName = (id?: string) => {
    if (!id) return null;
    return personnel.find(p => p.id === id)?.fullName;
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'partial': return 'bg-blue-100 text-blue-700 ring-1 ring-blue-200';
      default: return 'bg-amber-100 text-amber-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'paid': return t.paid;
      case 'partial': return t.partial;
      default: return t.pending;
    }
  };

  const [showReport, setShowReport] = useState(true);

  // Category breakdown for report
  const getCategoryReport = () => {
    const cats: Record<string, { total: number; paid: number; count: number; currency: string }> = {};
    filteredExpenses.forEach(ex => {
      const key = ex.category;
      const cur = ex.currency || 'IRR';
      if (!cats[key]) cats[key] = { total: 0, paid: 0, count: 0, currency: cur };
      cats[key].total += ex.amount || 0;
      cats[key].paid += ex.paidAmount || 0;
      cats[key].count += 1;
    });
    return Object.entries(cats).sort((a, b) => b[1].total - a[1].total);
  };

  const currentMonth = new Date().toISOString().substring(0, 7);

  const MONTH_NAMES: Record<string, string> = {
    '01': 'ژانویه', '02': 'فوریه', '03': 'مارس', '04': 'آوریل',
    '05': 'مه', '06': 'ژوئن', '07': 'ژوئیه', '08': 'اوت',
    '09': 'سپتامبر', '10': 'اکتبر', '11': 'نوامبر', '12': 'دسامبر'
  };

  const formatMonthLabel = (ym: string) => {
    const [year, month] = ym.split('-');
    return `${MONTH_NAMES[month] || month} ${year}`;
  };

  // Monthly breakdown — always includes current month, merges expenses + income
  const getMonthlyReport = () => {
    const months: Record<string, { expenses: number; expPaid: number; income: number }> = {};

    // Always show current month
    months[currentMonth] = { expenses: 0, expPaid: 0, income: 0 };

    // All expenses (not just filtered, to give a full monthly picture)
    expenses.forEach(ex => {
      const month = ex.date?.substring(0, 7);
      if (!month) return;
      if (!months[month]) months[month] = { expenses: 0, expPaid: 0, income: 0 };
      months[month].expenses += ex.amount || 0;
      months[month].expPaid += ex.paidAmount || 0;
    });

    // Income from sales records
    salesRecords.forEach(sr => {
      const month = (sr.depositDate || sr.createdAt || '').substring(0, 7);
      if (!month) return;
      if (!months[month]) months[month] = { expenses: 0, expPaid: 0, income: 0 };
      months[month].income += sr.saleAmount || 0;
    });

    return Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const categoryReport = getCategoryReport();
  const monthlyReport = getMonthlyReport();
  const maxCatTotal = Math.max(...categoryReport.map(c => c[1].total), 1);
  const maxMonthVal = Math.max(...monthlyReport.flatMap(m => [m[1].expenses, m[1].income]), 1);
  const paidCount = filteredExpenses.filter(e => e.status === 'paid').length;
  const partialCount = filteredExpenses.filter(e => e.status === 'partial').length;
  const pendingCount = filteredExpenses.filter(e => e.status === 'pending').length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-sm gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <div className="bg-rose-100 text-rose-600 p-1.5 rounded-lg"><IconWallet className="w-4 h-4" /></div>
            {t.header}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{t.sub}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReport(v => !v)}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${showReport ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}
          >
            <IconChart className="w-4 h-4" /> {showReport ? 'بستن گزارش' : 'گزارش تحلیلی'}
          </button>
          <button onClick={handleOpenAdd} className="bg-rose-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-rose-700 flex items-center gap-1.5 shadow-md shadow-rose-200 transition-all">
            <IconPlus className="w-4 h-4" /> {t.add}
          </button>
        </div>
      </div>

      {/* Stats Cards - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-gray-400 text-[10px] font-bold mb-1">{t.stats.total}</div>
          <div className="space-y-0.5">
            {activeCurrencies.length > 0 ? activeCurrencies.map(cur => (
              <div key={cur} className="text-sm font-black text-gray-800 flex justify-between items-baseline">
                <span>{currencyStats[cur].total.toLocaleString()}</span>
                <span className="text-[9px] text-gray-400 font-bold mr-1">{cur}</span>
              </div>
            )) : <div className="text-sm font-black text-gray-300">0</div>}
          </div>
        </div>

        <div className="bg-green-50 px-4 py-3 rounded-xl border border-green-100 shadow-sm">
          <div className="text-green-600 text-[10px] font-bold mb-1">{t.stats.paid}</div>
          <div className="space-y-0.5">
            {activeCurrencies.length > 0 ? activeCurrencies.map(cur => (
              <div key={cur} className="text-sm font-black text-green-600 flex justify-between items-baseline">
                <span>{currencyStats[cur].paid.toLocaleString()}</span>
                <span className="text-[9px] text-green-400 font-bold mr-1">{cur}</span>
              </div>
            )) : <div className="text-sm font-black text-green-200">0</div>}
          </div>
        </div>

        <div className="bg-amber-50 px-4 py-3 rounded-xl border border-amber-100 shadow-sm">
          <div className="text-amber-600 text-[10px] font-bold mb-1">{t.stats.remaining}</div>
          <div className="space-y-0.5">
            {activeCurrencies.length > 0 ? activeCurrencies.map(cur => (
              <div key={cur} className="text-sm font-black text-amber-600 flex justify-between items-baseline">
                <span>{currencyStats[cur].remaining.toLocaleString()}</span>
                <span className="text-[9px] text-amber-400 font-bold mr-1">{cur}</span>
              </div>
            )) : <div className="text-sm font-black text-amber-200">0</div>}
          </div>
        </div>

        <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-gray-400 text-[10px] font-bold mb-1">{t.stats.count}</div>
          <div className="text-2xl font-black text-gray-600 mt-1">{filteredExpenses.length}</div>
          <div className="flex gap-1 mt-1">
            <span className="text-[9px] bg-green-100 text-green-600 px-1 rounded font-bold">{paidCount} تسویه</span>
            <span className="text-[9px] bg-amber-100 text-amber-600 px-1 rounded font-bold">{pendingCount} معوق</span>
          </div>
        </div>
      </div>

      {/* Analytics Report Section */}
      {showReport && (
        <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden animate-fade-in">
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
            <IconChart className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-bold text-indigo-800">گزارش تحلیلی هزینه‌ها</span>
            <span className="text-[10px] text-indigo-400 mr-auto">بر اساس فیلترهای انتخابی</span>
          </div>
          <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Status Distribution */}
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs font-bold text-gray-500 mb-3">توزیع وضعیت پرداخت</div>
              <div className="space-y-2">
                {[
                  { label: t.paid, count: paidCount, color: 'bg-green-500', textColor: 'text-green-700' },
                  { label: t.partial, count: partialCount, color: 'bg-blue-500', textColor: 'text-blue-700' },
                  { label: t.pending, count: pendingCount, color: 'bg-amber-500', textColor: 'text-amber-700' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className={`text-[10px] font-bold ${item.textColor}`}>{item.label}</span>
                      <span className="text-[10px] text-gray-500 font-bold">{item.count} مورد</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all`}
                        style={{ width: filteredExpenses.length > 0 ? `${(item.count / filteredExpenses.length) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* Pie-like donut summary */}
              <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                {[
                  { label: 'تسویه', pct: filteredExpenses.length > 0 ? Math.round((paidCount / filteredExpenses.length) * 100) : 0, color: 'text-green-600' },
                  { label: 'بخشی', pct: filteredExpenses.length > 0 ? Math.round((partialCount / filteredExpenses.length) * 100) : 0, color: 'text-blue-600' },
                  { label: 'معوق', pct: filteredExpenses.length > 0 ? Math.round((pendingCount / filteredExpenses.length) * 100) : 0, color: 'text-amber-600' },
                ].map(item => (
                  <div key={item.label} className="bg-white rounded-lg p-2 border border-gray-100">
                    <div className={`text-lg font-black ${item.color}`}>{item.pct}٪</div>
                    <div className="text-[9px] text-gray-400 font-bold">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs font-bold text-gray-500 mb-3">هزینه به تفکیک دسته‌بندی</div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {categoryReport.length === 0 && <div className="text-[10px] text-gray-400 text-center py-4">داده‌ای موجود نیست</div>}
                {categoryReport.map(([cat, data]) => (
                  <div key={cat}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] font-bold text-gray-600 truncate max-w-[120px]">{t.categories[cat as keyof typeof t.categories] || cat}</span>
                      <span className="text-[9px] text-gray-400 font-mono">{data.total.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-rose-500 rounded-full transition-all"
                        style={{ width: `${(data.paid / data.total) * 100}%` }}
                        title={`پرداخت شده: ${data.paid.toLocaleString()}`}
                      />
                      <div
                        className="h-full bg-rose-200"
                        style={{ width: `${((data.total - data.paid) / data.total) * 100}%` }}
                        title={`باقیمانده: ${(data.total - data.paid).toLocaleString()}`}
                      />
                    </div>
                    <div className="text-[9px] text-gray-400 mt-0.5">{data.count} مورد — پرداخت: {data.paid.toLocaleString()} | مانده: {(data.total - data.paid).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Income vs Expense Chart */}
            <div className="bg-gray-50 rounded-xl p-3 lg:col-span-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-gray-500">درآمد و هزینه ماه به ماه (میلادی)</div>
                <div className="flex gap-3 text-[9px] font-bold">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />درآمد</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />هزینه</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-200 inline-block" />پرداخت‌نشده</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="flex gap-3 min-w-max pb-1">
                  {monthlyReport.map(([month, data]) => {
                    const isCurrentMonth = month === currentMonth;
                    const net = data.income - data.expenses;
                    return (
                      <div
                        key={month}
                        className={`flex flex-col items-center gap-1 min-w-[64px] rounded-xl px-2 py-2 ${isCurrentMonth ? 'bg-indigo-50 ring-2 ring-indigo-300' : 'bg-white border border-gray-100'}`}
                      >
                        {/* Bar chart area */}
                        <div className="flex items-end gap-1 h-20">
                          {/* Income bar */}
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[8px] text-green-600 font-bold">{data.income > 0 ? (data.income / 1000000).toFixed(1) + 'M' : ''}</span>
                            <div className="w-5 bg-gray-200 rounded-t-sm overflow-hidden flex flex-col justify-end" style={{ height: '64px' }}>
                              <div
                                className="w-full bg-green-500 rounded-t-sm transition-all"
                                style={{ height: `${(data.income / maxMonthVal) * 100}%` }}
                              />
                            </div>
                          </div>
                          {/* Expense bar (paid + unpaid stacked) */}
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[8px] text-rose-600 font-bold">{data.expenses > 0 ? (data.expenses / 1000000).toFixed(1) + 'M' : ''}</span>
                            <div className="w-5 bg-gray-200 rounded-t-sm overflow-hidden flex flex-col justify-end" style={{ height: '64px' }}>
                              <div className="w-full flex flex-col" style={{ height: `${(data.expenses / maxMonthVal) * 100}%` }}>
                                <div className="bg-rose-200 flex-1" style={{ height: `${data.expenses > 0 ? ((data.expenses - data.expPaid) / data.expenses) * 100 : 0}%` }} />
                                <div className="bg-rose-500 flex-shrink-0" style={{ height: `${data.expenses > 0 ? (data.expPaid / data.expenses) * 100 : 0}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Month label */}
                        <div className={`text-[9px] font-bold text-center leading-tight ${isCurrentMonth ? 'text-indigo-700' : 'text-gray-500'}`}>
                          {formatMonthLabel(month).split(' ').map((w, i) => <div key={i}>{w}</div>)}
                          {isCurrentMonth && <div className="text-[8px] text-indigo-400 font-bold">● جاری</div>}
                        </div>
                        {/* Net balance */}
                        <div className={`text-[9px] font-black ${net >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                          {net >= 0 ? '+' : ''}{(net / 1000000).toFixed(1)}M
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Summary row for current month */}
              {(() => {
                const cm = monthlyReport.find(([m]) => m === currentMonth);
                if (!cm) return null;
                const [, d] = cm;
                return (
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-200 pt-3">
                    <div className="bg-green-50 rounded-lg p-2 text-center border border-green-100">
                      <div className="text-[9px] text-green-500 font-bold mb-0.5">درآمد ماه جاری</div>
                      <div className="text-sm font-black text-green-700">{d.income.toLocaleString()}</div>
                    </div>
                    <div className="bg-rose-50 rounded-lg p-2 text-center border border-rose-100">
                      <div className="text-[9px] text-rose-500 font-bold mb-0.5">هزینه ماه جاری</div>
                      <div className="text-sm font-black text-rose-700">{d.expenses.toLocaleString()}</div>
                    </div>
                    <div className={`rounded-lg p-2 text-center border ${d.income - d.expenses >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}>
                      <div className="text-[9px] text-gray-500 font-bold mb-0.5">خالص ماه جاری</div>
                      <div className={`text-sm font-black ${d.income - d.expenses >= 0 ? 'text-indigo-700' : 'text-amber-700'}`}>
                        {(d.income - d.expenses) >= 0 ? '+' : ''}{(d.income - d.expenses).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white px-3 py-2.5 rounded-xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-2 items-center">
        <div className="relative flex-grow w-full">
          <IconSearch className="absolute right-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
          <input
            className="w-full pl-3 pr-9 py-2 bg-gray-50 border-none rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-rose-100"
            placeholder="جستجو در شرح هزینه یا گیرنده..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
          <select
            className="px-3 py-2 bg-gray-50 rounded-lg text-xs border-none font-bold text-gray-600 outline-none"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value as any)}
          >
            <option value="all">{t.categories.all}</option>
            {Object.keys(t.categories).filter(k => k !== 'all').map(cat => <option key={cat} value={cat}>{t.categories[cat as keyof typeof t.categories]}</option>)}
          </select>

          <select
            className="px-3 py-2 bg-gray-50 rounded-lg text-xs border-none font-bold text-indigo-600 outline-none"
            value={personnelFilter}
            onChange={e => setPersonnelFilter(e.target.value)}
          >
            <option value="all">{t.filters.allPersonnel}</option>
            {personnel.map(p => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </select>

          <input
            type="month"
            className="px-3 py-2 bg-gray-50 rounded-lg text-xs border-none font-bold text-gray-600 outline-none"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          />
        </div>
        <button onClick={() => {setSearchTerm(''); setCategoryFilter('all'); setPersonnelFilter('all'); setDateFilter('');}} className="p-2 text-gray-400 hover:text-rose-600 transition-colors" title="ریست فیلترها">
          <IconRefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wide border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-[10px]">{t.table.title}</th>
                <th className="px-3 py-2.5 text-[10px]">{t.table.amount}</th>
                <th className="px-3 py-2.5 text-[10px]">{t.table.cat}</th>
                <th className="px-3 py-2.5 text-[10px]">{t.table.to}</th>
                <th className="px-3 py-2.5 text-[10px]">{t.table.date}</th>
                <th className="px-3 py-2.5 text-[10px] text-center">{t.table.status}</th>
                <th className="px-3 py-2.5 text-[10px] text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredExpenses.map(ex => (
                <tr key={ex.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-3 py-2">
                    <div className="font-bold text-gray-800 text-xs">{ex.title}</div>
                    {ex.personnelId && (
                      <div className="text-[9px] text-indigo-500 flex items-center gap-0.5 mt-0.5 font-bold">
                        <IconUsers className="w-2.5 h-2.5" /> {getPersonnelName(ex.personnelId)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex flex-col">
                        <span className="font-black text-rose-600 text-xs">{(ex.paidAmount || 0).toLocaleString()} <span className="text-[9px] font-normal opacity-50">/ {ex.amount.toLocaleString()}</span></span>
                        <div className="flex items-center gap-1 mt-0.5">
                            <div className="w-14 bg-gray-100 h-1 rounded-full overflow-hidden">
                                <div className={`h-full ${ex.status === 'partial' ? 'bg-blue-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, ((ex.paidAmount || 0) / ex.amount) * 100)}%` }}></div>
                            </div>
                            <span className="text-[8px] font-bold text-gray-400 uppercase">{ex.currency}</span>
                        </div>
                    </div>
                  </td>
                  <td className="px-3 py-2"><span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-bold">{t.categories[ex.category as keyof typeof t.categories]}</span></td>
                  <td className="px-3 py-2 text-gray-600 font-medium text-xs">{ex.paidTo}</td>
                  <td className="px-3 py-2 text-gray-400 dir-ltr font-mono text-[10px]">{ex.date}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getStatusBadge(ex.status)}`}>
                      {getStatusLabel(ex.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center gap-0.5">
                      <button onClick={() => handleOpenPayment(ex)} className="p-1 text-green-500 hover:text-green-700 hover:bg-green-50 rounded" title={t.payPortion}><IconMoney className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleOpenEdit(ex)} className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded"><IconEdit className="w-3.5 h-3.5" /></button>
                      {isMaster && <button onClick={() => handleDelete(ex.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><IconTrash className="w-3.5 h-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400">
                    <IconWallet className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="font-bold text-xs">{t.empty}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 bg-rose-50 flex justify-between items-center">
              <h3 className="font-black text-xl text-rose-900 flex items-center gap-2"><IconWallet className="w-5 h-5" />{editingExpense ? t.edit : t.add}</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-rose-100 rounded-full">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-8 overflow-y-auto space-y-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">{t.title}</label>
                  <input required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 transition-all font-bold" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="مثلاً: هزینه خرید تجهیزات..." />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">{t.amount}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-grow">
                      <input 
                        type="text" 
                        required 
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 transition-all font-black text-rose-600 dir-ltr text-right" 
                        value={displayAmount} 
                        onChange={handleAmountInputChange} 
                        placeholder="0" 
                      />
                    </div>
                    <select className="w-24 px-2 border rounded-xl bg-gray-50 outline-none font-bold" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as any})}>
                      <option value="IRR">ریال</option>
                      <option value="USD">USD</option>
                      <option value="OMR">OMR</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">{t.paidAmount}</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 transition-all font-black text-green-600 dir-ltr text-right" 
                    value={displayPaidAmount} 
                    onChange={handlePaidAmountInputChange} 
                    placeholder="0" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">{t.category}</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 bg-white font-bold" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                    {Object.keys(t.categories).filter(k => k !== 'all').map(cat => <option key={cat} value={cat}>{t.categories[cat as keyof typeof t.categories]}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">{t.date}</label>
                  <input type="date" required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-mono" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">{t.linkedStaff}</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 bg-white font-bold text-indigo-600" value={formData.personnelId} onChange={e => setFormData({...formData, personnelId: e.target.value, paidTo: e.target.value ? (personnel.find(p=>p.id === e.target.value)?.fullName || formData.paidTo) : formData.paidTo })}>
                    <option value="">{t.noLink}</option>
                    {personnel.map(p => (
                      <option key={p.id} value={p.id}>{p.fullName} ({p.roles.join(', ')})</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">{t.paidTo}</label>
                  <input required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-bold" value={formData.paidTo} onChange={e => setFormData({...formData, paidTo: e.target.value})} placeholder="شخص یا شرکت" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">{t.desc}</label>
                  <textarea rows={2} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-medium" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>

                <div className="md:col-span-2">
                   <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">{t.receipt}</label>
                   <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-rose-400 hover:bg-rose-50/30 transition-all bg-gray-50">
                      <IconFileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 font-bold">برای آپلود کلیک کنید (فاکتور، فیش واریز و ...)</p>
                      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                   </div>
                   <div className="flex flex-wrap gap-2 mt-3">
                     {formData.files?.map((f, i) => (
                       <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 p-2 rounded-lg text-xs shadow-sm">
                         <IconFileText className="w-3 h-3 text-rose-500" />
                         <span className="max-w-[150px] truncate font-bold">{f.name}</span>
                         {f.status === 'uploading' && <span className="text-[10px] text-blue-500">{Math.round(f.progress || 0)}%</span>}
                         <button type="button" onClick={() => setFormData(p => ({...p, files: p.files?.filter((_, idx) => idx !== i)}))} className="text-red-400 hover:text-red-600 transition-colors">✕</button>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            </form>
            <div className="p-6 border-t border-gray-100 flex gap-3 bg-gray-50/50">
              <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-white rounded-2xl transition-all border border-transparent hover:border-gray-200 uppercase tracking-widest">{t.cancel}</button>
              <button onClick={handleSave} disabled={isSubmitting} className="flex-1 py-3 bg-rose-600 text-white font-black rounded-2xl shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all flex justify-center items-center gap-2">
                {isSubmitting ? <IconRefreshCw className="w-5 h-5 animate-spin" /> : <><IconCheck className="w-5 h-5" /> {t.save}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowPaymentModal(null)}>
            <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-100 bg-green-50 flex justify-between items-center">
                    <h3 className="font-black text-lg text-green-900 flex items-center gap-2"><IconMoney className="w-5 h-5" />{t.payPortion}</h3>
                    <button onClick={() => setShowPaymentModal(null)} className="p-2 hover:bg-green-100 rounded-full">✕</button>
                </div>
                <div className="p-8 space-y-6">
                    <div>
                        <div className="text-sm font-bold text-gray-500 mb-1">{showPaymentModal.title}</div>
                        <div className="text-xs text-gray-400 mb-4">{showPaymentModal.paidTo}</div>
                        
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-gray-500">{t.title}:</span>
                                <span className="text-gray-900">{showPaymentModal.amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-gray-500">{t.paidAmount}:</span>
                                <span className="text-green-600">{(showPaymentModal.paidAmount || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm font-black border-t border-gray-200 pt-2">
                                <span className="text-gray-700">{t.remained}</span>
                                <span className="text-rose-600">{(showPaymentModal.amount - (showPaymentModal.paidAmount || 0)).toLocaleString()} {showPaymentModal.currency}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">{t.newPayment}</label>
                        <input 
                            type="text" 
                            autoFocus
                            className="w-full px-4 py-4 rounded-xl border-2 border-green-100 outline-none focus:border-green-500 transition-all font-black text-2xl text-green-600 dir-ltr text-center" 
                            value={displayPaidAmount} 
                            onChange={(e) => setDisplayPaidAmount(formatDisplayAmount(e.target.value))}
                            placeholder="0" 
                        />
                    </div>
                </div>
                <div className="p-6 bg-gray-50 flex gap-3">
                    <button onClick={() => setShowPaymentModal(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-white rounded-xl transition-all">انصراف</button>
                    <button onClick={handleSavePayment} disabled={isSubmitting || !displayPaidAmount} className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 transition-all flex justify-center items-center gap-2">
                        {isSubmitting ? <IconRefreshCw className="w-5 h-5 animate-spin" /> : <><IconCheck className="w-5 h-5" /> {t.save}</>}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
