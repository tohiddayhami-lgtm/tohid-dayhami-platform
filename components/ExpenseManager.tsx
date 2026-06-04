
import React, { useState, useEffect, useRef } from 'react';
import { Expense, Currency, ExpenseCategory, Personnel, AttachedFile, SalesRecord } from '../types';
import { IconPlus, IconTrash, IconEdit, IconCheck, IconSearch, IconFileText, IconWallet, IconUsers, IconRefreshCw, IconMoney, IconChart } from './Icons';
import { saveExpense, updateExpense, deleteExpense, subscribeToExpenses, uploadFileWithProgress, subscribeToSalesRecords } from '../services/firebaseService';
import { Language } from '../App';

interface Props {
  currentUser: Personnel;
  personnel: Personnel[];
  lang: Language;
}

// ── Accounting category metadata ─────────────────────────────────────────────
const CAT_META: Record<string, { label: string; group: string; color: string }> = {
  cogs:             { label: 'بهای تمام‌شده خدمات / کالا',       group: 'cogs',    color: 'bg-purple-100 text-purple-700' },
  salary_benefits:  { label: 'حقوق، دستمزد و مزایا',              group: 'opex',    color: 'bg-blue-100 text-blue-700' },
  rent_utilities:   { label: 'اجاره، قبوض و تأسیسات',             group: 'opex',    color: 'bg-cyan-100 text-cyan-700' },
  marketing_ads:    { label: 'بازاریابی و تبلیغات',               group: 'opex',    color: 'bg-pink-100 text-pink-700' },
  admin_general:    { label: 'هزینه‌های اداری و عمومی',            group: 'opex',    color: 'bg-slate-100 text-slate-700' },
  it_software:      { label: 'فناوری اطلاعات و نرم‌افزار',        group: 'opex',    color: 'bg-indigo-100 text-indigo-700' },
  sales_commission: { label: 'کمیسیون فروش و بازاریابی',          group: 'opex',    color: 'bg-orange-100 text-orange-700' },
  tax_legal:        { label: 'مالیات، عوارض و هزینه‌های حقوقی',  group: 'below',   color: 'bg-red-100 text-red-700' },
  depreciation:     { label: 'استهلاک دارایی‌ها',                  group: 'below',   color: 'bg-yellow-100 text-yellow-700' },
  financial_costs:  { label: 'هزینه‌های مالی و بانکی',            group: 'below',   color: 'bg-rose-100 text-rose-700' },
  capex:            { label: 'سرمایه‌گذاری و خرید دارایی ثابت',  group: 'capex',   color: 'bg-teal-100 text-teal-700' },
  other:            { label: 'سایر هزینه‌ها',                      group: 'below',   color: 'bg-gray-100 text-gray-600' },
  // legacy
  operational:        { label: 'هزینه عملیاتی (قدیمی)',     group: 'opex',  color: 'bg-gray-100 text-gray-600' },
  non_operational:    { label: 'هزینه غیرعملیاتی (قدیمی)', group: 'below', color: 'bg-gray-100 text-gray-600' },
  salary:             { label: 'حقوق و مزایا (قدیمی)',       group: 'opex',  color: 'bg-blue-100 text-blue-700' },
  tax:                { label: 'مالیات (قدیمی)',               group: 'below', color: 'bg-red-100 text-red-700' },
  marketing:          { label: 'تبلیغات (قدیمی)',             group: 'opex',  color: 'bg-pink-100 text-pink-700' },
  rent:               { label: 'اجاره (قدیمی)',                group: 'opex',  color: 'bg-cyan-100 text-cyan-700' },
  designer_commission:{ label: 'کمیسیون طراح (قدیمی)',       group: 'opex',  color: 'bg-orange-100 text-orange-700' },
};

const NEW_CATEGORIES = ['cogs','salary_benefits','rent_utilities','marketing_ads','admin_general','it_software','sales_commission','tax_legal','depreciation','financial_costs','capex','other'];

const MONTH_NAMES: Record<string, string> = {
  '01':'ژانویه','02':'فوریه','03':'مارس','04':'آوریل',
  '05':'مه','06':'ژوئن','07':'ژوئیه','08':'اوت',
  '09':'سپتامبر','10':'اکتبر','11':'نوامبر','12':'دسامبر'
};

const fmtMonth = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[m] || m} ${y}`;
};

const fmtNum = (n: number) => n.toLocaleString();
const fmtM   = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `${(n/1_000).toFixed(0)}K`;
  return String(n);
};

// ─────────────────────────────────────────────────────────────────────────────

export const ExpenseManager: React.FC<Props> = ({ currentUser, personnel, lang }) => {
  const [expenses,    setExpenses]    = useState<Expense[]>([]);
  const [salesRecords,setSalesRecords]= useState<SalesRecord[]>([]);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [showPayModal,  setShowPayModal]  = useState<Expense | null>(null);
  const [editingExpense,setEditingExpense]= useState<Expense | null>(null);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [reportPeriod,  setReportPeriod]  = useState<'month'|'year'|'all'>('month');

  // Filters
  const [categoryFilter,  setCategoryFilter]  = useState<string>('all');
  const [personnelFilter, setPersonnelFilter] = useState<string>('all');
  const [searchTerm,      setSearchTerm]      = useState('');
  const [dateFilter,      setDateFilter]      = useState('');

  // Form
  const blankForm: Partial<Expense> = {
    title:'', amount:0, paidAmount:0, currency:'IRR',
    category:'salary_benefits' as ExpenseCategory,
    date: new Date().toISOString().split('T')[0],
    paidTo:'', personnelId:'', description:'', status:'paid', files:[]
  };
  const [formData, setFormData] = useState<Partial<Expense>>(blankForm);
  const [displayAmount,     setDisplayAmount]     = useState('');
  const [displayPaidAmount, setDisplayPaidAmount] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMaster = currentUser.username === 'master' || currentUser.roles.includes('مدیر');

  const currentMonth = new Date().toISOString().substring(0, 7);
  const currentYear  = new Date().getFullYear().toString();

  useEffect(() => { const u = subscribeToExpenses(setExpenses);    return () => u(); }, []);
  useEffect(() => { const u = subscribeToSalesRecords(setSalesRecords); return () => u(); }, []);

  // ── helpers ────────────────────────────────────────────────────────────────
  const normalizeDigits = (v: string) =>
    v.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
     .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

  const fmtInput = (v: string) => normalizeDigits(v).replace(/\D/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,',');

  const catLabel = (key: string) => CAT_META[key]?.label || key;
  const catColor = (key: string) => CAT_META[key]?.color || 'bg-gray-100 text-gray-600';

  const getStatusBadge = (s: string) =>
    s==='paid'    ? 'bg-green-100 text-green-700' :
    s==='partial' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' :
                    'bg-amber-100 text-amber-700';
  const getStatusLabel = (s: string) =>
    s==='paid' ? 'تسویه شده' : s==='partial' ? 'پرداخت بخشی' : 'در انتظار پرداخت';

  const getPersonnelName = (id?: string) => personnel.find(p => p.id === id)?.fullName;

  // ── filtered table data ────────────────────────────────────────────────────
  const filteredExpenses = expenses.filter(ex => {
    const matchCat  = categoryFilter === 'all' || ex.category === categoryFilter;
    const matchSrch = ex.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      ex.paidTo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDate = !dateFilter || ex.date.startsWith(dateFilter);
    const matchPers = personnelFilter === 'all' || ex.personnelId === personnelFilter;
    return matchCat && matchSrch && matchDate && matchPers;
  });

  // ── summary stats (based on filtered) ─────────────────────────────────────
  const currencyStats = (() => {
    const t: Record<string, {total:number;paid:number;remaining:number}> = {};
    filteredExpenses.forEach(ex => {
      const c = ex.currency || 'IRR';
      if (!t[c]) t[c] = {total:0,paid:0,remaining:0};
      t[c].total     += ex.amount || 0;
      t[c].paid      += ex.paidAmount || 0;
      t[c].remaining += (ex.amount||0) - (ex.paidAmount||0);
    });
    return t;
  })();
  const activeCurrencies = Object.keys(currencyStats);

  const paidCount    = filteredExpenses.filter(e => e.status === 'paid').length;
  const partialCount = filteredExpenses.filter(e => e.status === 'partial').length;
  const pendingCount = filteredExpenses.filter(e => e.status === 'pending').length;

  // ── P&L data engine ────────────────────────────────────────────────────────
  const matchPeriod = (dateStr: string) => {
    if (reportPeriod === 'month') return dateStr.startsWith(currentMonth);
    if (reportPeriod === 'year')  return dateStr.startsWith(currentYear);
    return true;
  };

  const plExpenses = expenses.filter(ex => matchPeriod(ex.date));
  const plIncome   = salesRecords.filter(sr => matchPeriod(sr.depositDate || sr.createdAt || ''));

  const totalRevenue   = plIncome.reduce((s, sr) => s + (sr.saleAmount||0), 0);
  const byGroup = (grp: string) =>
    plExpenses.filter(e => (CAT_META[e.category]?.group || 'below') === grp)
              .reduce((s, e) => s + (e.amount||0), 0);

  const totalCogs       = byGroup('cogs');
  const grossProfit     = totalRevenue - totalCogs;
  const totalOpex       = byGroup('opex');
  const ebit            = grossProfit - totalOpex;
  const totalBelow      = byGroup('below');
  const netIncome       = ebit - totalBelow;
  const totalCapex      = byGroup('capex');
  const totalExpenses   = plExpenses.reduce((s, e) => s + (e.amount||0), 0);
  const totalExpPaid    = plExpenses.reduce((s, e) => s + (e.paidAmount||0), 0);

  // category-level breakdown for the period
  const catBreakdown: Record<string, number> = {};
  plExpenses.forEach(ex => {
    catBreakdown[ex.category] = (catBreakdown[ex.category] || 0) + (ex.amount||0);
  });
  const sortedCats = Object.entries(catBreakdown).sort((a,b)=>b[1]-a[1]);
  const maxCatAmt  = Math.max(...sortedCats.map(c=>c[1]), 1);

  // ── monthly trend (all time, always includes current month) ────────────────
  const monthlyData: Record<string, {expenses:number;expPaid:number;income:number}> = {};
  monthlyData[currentMonth] = {expenses:0, expPaid:0, income:0};
  expenses.forEach(ex => {
    const m = ex.date?.substring(0,7); if (!m) return;
    if (!monthlyData[m]) monthlyData[m] = {expenses:0, expPaid:0, income:0};
    monthlyData[m].expenses += ex.amount||0;
    monthlyData[m].expPaid  += ex.paidAmount||0;
  });
  salesRecords.forEach(sr => {
    const m = (sr.depositDate||sr.createdAt||'').substring(0,7); if (!m) return;
    if (!monthlyData[m]) monthlyData[m] = {expenses:0, expPaid:0, income:0};
    monthlyData[m].income += sr.saleAmount||0;
  });
  const monthlyReport = Object.entries(monthlyData).sort((a,b)=>a[0].localeCompare(b[0]));
  const maxMonthVal   = Math.max(...monthlyReport.flatMap(m=>[m[1].expenses, m[1].income]), 1);

  // ── form handlers ──────────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    setEditingExpense(null);
    setFormData(blankForm);
    setDisplayAmount(''); setDisplayPaidAmount('');
    setShowAddModal(true);
  };
  const handleOpenEdit = (ex: Expense) => {
    setEditingExpense(ex);
    setFormData({...ex, personnelId: ex.personnelId||''});
    setDisplayAmount(ex.amount.toLocaleString());
    setDisplayPaidAmount((ex.paidAmount||0).toLocaleString());
    setShowAddModal(true);
  };
  const handleOpenPay = (ex: Expense) => {
    setShowPayModal(ex);
    setFormData({...ex});
    setDisplayPaidAmount('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) return;
    setIsSubmitting(true);
    const amount = Number(formData.amount);
    const paid   = Number(formData.paidAmount||0);
    const status: 'paid'|'pending'|'partial' =
      paid >= amount ? 'paid' : paid > 0 ? 'partial' : 'pending';

    const expense: Expense = {
      id: editingExpense?.id || `exp-${Date.now()}`,
      title: formData.title!,
      amount, paidAmount: paid,
      currency: formData.currency as Currency,
      category: formData.category as ExpenseCategory,
      date: formData.date!,
      paidTo: formData.paidTo!,
      personnelId: formData.personnelId||undefined,
      description: formData.description,
      files: formData.files,
      status,
      createdAt: editingExpense?.createdAt||new Date().toISOString(),
      createdBy: editingExpense?.createdBy||currentUser.fullName,
    };
    if (editingExpense) await updateExpense(expense.id, expense, currentUser.fullName);
    else                await saveExpense(expense, currentUser.fullName);
    setIsSubmitting(false); setShowAddModal(false); setEditingExpense(null);
  };

  const handleSavePay = async () => {
    if (!showPayModal) return;
    setIsSubmitting(true);
    const added  = parseFloat(normalizeDigits(displayPaidAmount).replace(/,/g,''))||0;
    const newPaid = (showPayModal.paidAmount||0) + added;
    const status: 'paid'|'pending'|'partial' =
      newPaid >= showPayModal.amount ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
    await updateExpense(showPayModal.id, {paidAmount: newPaid, status}, currentUser.fullName);
    setIsSubmitting(false); setShowPayModal(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('آیا از حذف این رکورد اطمینان دارید؟'))
      await deleteExpense(id, currentUser.fullName);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const nf: AttachedFile = {name:file.name, size:file.size, type:file.type, content:'', status:'uploading', progress:0};
    setFormData(p => ({...p, files:[...(p.files||[]), nf]}));
    uploadFileWithProgress(file,
      pct  => setFormData(p => ({...p, files: p.files?.map(f => f.name===file.name?{...f,progress:pct}:f)})),
      url  => setFormData(p => ({...p, files: p.files?.map(f => f.name===file.name?{...f,content:url,status:'success',progress:100}:f)})),
      _err => setFormData(p => ({...p, files: p.files?.map(f => f.name===file.name?{...f,status:'error'}:f)})),
      'documents'
    );
  };

  // ── P&L row helper ─────────────────────────────────────────────────────────
  const PLRow = ({label, value, indent=false, bold=false, borderTop=false, positive=true}:{
    label:string; value:number; indent?:boolean; bold?:boolean; borderTop?:boolean; positive?:boolean;
  }) => (
    <div className={`flex justify-between items-center py-1 ${borderTop?'border-t border-gray-300 mt-1 pt-2':''} ${indent?'pr-4':''}`}>
      <span className={`text-xs ${bold?'font-black text-gray-800':'font-medium text-gray-600'}`}>{label}</span>
      <span className={`text-xs font-black tabular-nums ${bold?(value>=0?'text-gray-900':'text-rose-600'):(value<0||!positive)?'text-rose-600':'text-gray-700'}`}>
        {value < 0 ? `(${fmtNum(Math.abs(value))})` : fmtNum(value)}
      </span>
    </div>
  );

  const periodLabel = reportPeriod==='month' ? `${fmtMonth(currentMonth)}` : reportPeriod==='year' ? `سال ${currentYear}` : 'کل دوره';

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-sm gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <div className="bg-rose-100 text-rose-600 p-1.5 rounded-lg"><IconWallet className="w-4 h-4" /></div>
            هزینه‌ها و درآمدها
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">ثبت، پایش و گزارش‌گیری مالی شرکت</p>
        </div>
        <button onClick={handleOpenAdd} className="bg-rose-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-rose-700 flex items-center gap-1.5 shadow-md shadow-rose-200 transition-all">
          <IconPlus className="w-4 h-4" /> ثبت هزینه جدید
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-gray-400 text-[10px] font-bold mb-1">جمع هزینه‌ها (فیلترشده)</div>
          {activeCurrencies.length > 0 ? activeCurrencies.map(c => (
            <div key={c} className="text-sm font-black text-gray-800 flex justify-between items-baseline">
              <span>{fmtNum(currencyStats[c].total)}</span>
              <span className="text-[9px] text-gray-400 font-bold">{c}</span>
            </div>
          )) : <div className="text-sm font-black text-gray-300">0</div>}
        </div>
        <div className="bg-green-50 px-4 py-3 rounded-xl border border-green-100 shadow-sm">
          <div className="text-green-600 text-[10px] font-bold mb-1">مجموع پرداخت‌شده</div>
          {activeCurrencies.length > 0 ? activeCurrencies.map(c => (
            <div key={c} className="text-sm font-black text-green-600 flex justify-between items-baseline">
              <span>{fmtNum(currencyStats[c].paid)}</span>
              <span className="text-[9px] text-green-400 font-bold">{c}</span>
            </div>
          )) : <div className="text-sm font-black text-green-200">0</div>}
        </div>
        <div className="bg-amber-50 px-4 py-3 rounded-xl border border-amber-100 shadow-sm">
          <div className="text-amber-600 text-[10px] font-bold mb-1">مانده معوقات</div>
          {activeCurrencies.length > 0 ? activeCurrencies.map(c => (
            <div key={c} className="text-sm font-black text-amber-600 flex justify-between items-baseline">
              <span>{fmtNum(currencyStats[c].remaining)}</span>
              <span className="text-[9px] text-amber-400 font-bold">{c}</span>
            </div>
          )) : <div className="text-sm font-black text-amber-200">0</div>}
        </div>
        <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-gray-400 text-[10px] font-bold mb-1">تعداد تراکنش</div>
          <div className="text-2xl font-black text-gray-600 mt-1">{filteredExpenses.length}</div>
          <div className="flex gap-1 mt-1">
            <span className="text-[9px] bg-green-100 text-green-600 px-1 rounded font-bold">{paidCount} تسویه</span>
            <span className="text-[9px] bg-amber-100 text-amber-600 px-1 rounded font-bold">{pendingCount} معوق</span>
          </div>
        </div>
      </div>

      {/* ══ Financial Report Panel ══ */}
      <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
        {/* Report toolbar */}
        <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <IconChart className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-800">گزارش مالی — صورت وضعیت شرکت</span>
          </div>
          <div className="flex gap-1 mr-auto">
            {(['month','year','all'] as const).map(p => (
              <button key={p} onClick={() => setReportPeriod(p)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border ${reportPeriod===p?'bg-indigo-600 text-white border-indigo-600':'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}>
                {p==='month'?'ماه جاری':p==='year'?'سال جاری':'کل دوره'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Column 1: P&L Statement ── */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              صورت سود و زیان · {periodLabel}
            </div>

            {/* Revenue */}
            <div className="mb-2">
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">درآمد</div>
              <PLRow label="درآمد فروش و خدمات" value={totalRevenue} bold />
            </div>

            {/* COGS */}
            <div className="mb-2 border-t border-gray-200 pt-2">
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">بهای تمام‌شده</div>
              <PLRow label="بهای تمام‌شده خدمات" value={-totalCogs} indent />
              <PLRow label="سود ناخالص" value={grossProfit} bold borderTop />
            </div>

            {/* OPEX */}
            <div className="mb-2 border-t border-gray-200 pt-2">
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">هزینه‌های عملیاتی</div>
              {['salary_benefits','rent_utilities','marketing_ads','admin_general','it_software','sales_commission'].map((k:string) => {
                const v = plExpenses.filter(e=>e.category===k).reduce((s,e)=>s+(e.amount||0),0);
                if (!v) return null;
                return <React.Fragment key={k}><PLRow label={CAT_META[k]?.label||k} value={-v} indent /></React.Fragment>;
              })}
              {/* legacy opex */}
              {['operational','salary','marketing','rent','designer_commission'].map((k:string) => {
                const v = plExpenses.filter(e=>e.category===k).reduce((s,e)=>s+(e.amount||0),0);
                if (!v) return null;
                return <React.Fragment key={k}><PLRow label={CAT_META[k]?.label||k} value={-v} indent /></React.Fragment>;
              })}
              <PLRow label="سود / زیان عملیاتی (EBIT)" value={ebit} bold borderTop />
            </div>

            {/* Below the line */}
            <div className="mb-2 border-t border-gray-200 pt-2">
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">هزینه‌های غیرعملیاتی</div>
              {['tax_legal','depreciation','financial_costs','other','non_operational','tax'].map((k:string) => {
                const v = plExpenses.filter(e=>e.category===k).reduce((s,e)=>s+(e.amount||0),0);
                if (!v) return null;
                return <React.Fragment key={k}><PLRow label={CAT_META[k]?.label||k} value={-v} indent /></React.Fragment>;
              })}
            </div>

            {/* Net Income */}
            <div className="border-t-2 border-gray-400 pt-2">
              <PLRow label="سود / زیان خالص دوره" value={netIncome} bold />
            </div>

            {/* CapEx note */}
            {totalCapex > 0 && (
              <div className="mt-2 border-t border-dashed border-gray-200 pt-2">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">یادداشت</div>
                <PLRow label="سرمایه‌گذاری / CapEx (خارج از P&L)" value={totalCapex} />
              </div>
            )}
          </div>

          {/* ── Column 2: Expense by Category ── */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
              تفکیک هزینه بر اساس سرفصل · {periodLabel}
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sortedCats.length === 0 && (
                <div className="text-[10px] text-gray-400 text-center py-8">داده‌ای در این دوره ثبت نشده</div>
              )}
              {sortedCats.map(([cat, amt]) => {
                const paidAmt = plExpenses.filter(e=>e.category===cat).reduce((s,e)=>s+(e.paidAmount||0),0);
                const paidPct = amt > 0 ? (paidAmt/amt)*100 : 0;
                const barPct  = (amt/maxCatAmt)*100;
                return (
                  <div key={cat}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${catColor(cat)}`}>
                        {catLabel(cat)}
                      </span>
                      <span className="text-[9px] font-mono text-gray-500">{fmtNum(amt)}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden" style={{width:`${barPct}%`}}>
                      <div className="h-full bg-rose-500 rounded-full" style={{width:`${paidPct}%`}} />
                    </div>
                    <div className="text-[8px] text-gray-400 mt-0.5">
                      پرداخت: {fmtNum(paidAmt)} — مانده: {fmtNum(amt-paidAmt)}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Payment status summary */}
            <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-3 gap-1 text-center">
              {[
                {label:'تسویه', cnt:paidCount,    pct: filteredExpenses.length>0?Math.round(paidCount/filteredExpenses.length*100):0, color:'text-green-600', bg:'bg-green-50 border-green-100'},
                {label:'بخشی',  cnt:partialCount, pct: filteredExpenses.length>0?Math.round(partialCount/filteredExpenses.length*100):0, color:'text-blue-600', bg:'bg-blue-50 border-blue-100'},
                {label:'معوق',  cnt:pendingCount, pct: filteredExpenses.length>0?Math.round(pendingCount/filteredExpenses.length*100):0, color:'text-amber-600', bg:'bg-amber-50 border-amber-100'},
              ].map(item=>(
                <div key={item.label} className={`rounded-lg p-1.5 border ${item.bg}`}>
                  <div className={`text-base font-black ${item.color}`}>{item.pct}٪</div>
                  <div className="text-[8px] text-gray-400 font-bold">{item.label}</div>
                  <div className="text-[8px] text-gray-400">{item.cnt} مورد</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Column 3: Monthly Bar Chart (full width row) ── */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 lg:col-span-1">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
              جریان ماهانه (کل دوره)
            </div>
            <div className="flex gap-2 items-end overflow-x-auto pb-1" style={{minHeight:'110px'}}>
              {monthlyReport.map(([month, d]) => {
                const isCur = month === currentMonth;
                const net   = d.income - d.expenses;
                return (
                  <div key={month} className={`flex flex-col items-center gap-1 min-w-[52px] rounded-lg px-1 py-1 flex-shrink-0 ${isCur?'bg-indigo-50 ring-2 ring-indigo-300':'bg-white border border-gray-100'}`}>
                    <div className="flex items-end gap-0.5 h-16">
                      {/* income */}
                      <div className="w-4 bg-gray-200 rounded-t-sm overflow-hidden flex flex-col justify-end" style={{height:'56px'}}>
                        <div className="w-full bg-green-500 rounded-t-sm" style={{height:`${(d.income/maxMonthVal)*100}%`}} />
                      </div>
                      {/* expense stacked */}
                      <div className="w-4 bg-gray-200 rounded-t-sm overflow-hidden flex flex-col justify-end" style={{height:'56px'}}>
                        <div className="w-full flex flex-col justify-end" style={{height:`${(d.expenses/maxMonthVal)*100}%`}}>
                          <div className="bg-rose-200 w-full" style={{height:`${d.expenses>0?((d.expenses-d.expPaid)/d.expenses)*100:0}%`}} />
                          <div className="bg-rose-500 w-full" style={{height:`${d.expenses>0?(d.expPaid/d.expenses)*100:0}%`}} />
                        </div>
                      </div>
                    </div>
                    <div className={`text-[8px] font-bold text-center leading-tight ${isCur?'text-indigo-700':'text-gray-500'}`}>
                      {(MONTH_NAMES[month.split('-')[1]]||month.split('-')[1]).substring(0,3)}
                      <div className="text-[7px] opacity-70">{month.split('-')[0]}</div>
                      {isCur && <div className="text-[7px] text-indigo-400">●جاری</div>}
                    </div>
                    <div className={`text-[8px] font-black ${net>=0?'text-green-600':'text-rose-600'}`}>
                      {net>=0?'+':''}{fmtM(net)}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex gap-3 mt-2 text-[8px] font-bold text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block"/>درآمد</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500 inline-block"/>هزینه پرداخت‌شده</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-200 inline-block"/>معوق</span>
            </div>
            {/* Current month summary */}
            {(() => {
              const cm = monthlyData[currentMonth];
              if (!cm) return null;
              const net = cm.income - cm.expenses;
              return (
                <div className="mt-3 grid grid-cols-3 gap-1 border-t border-gray-200 pt-2">
                  {[
                    {label:'درآمد', val:cm.income,   color:'text-green-700', bg:'bg-green-50'},
                    {label:'هزینه', val:cm.expenses, color:'text-rose-700',  bg:'bg-rose-50'},
                    {label:'خالص',  val:net,         color: net>=0?'text-indigo-700':'text-amber-700', bg: net>=0?'bg-indigo-50':'bg-amber-50'},
                  ].map(item=>(
                    <div key={item.label} className={`${item.bg} rounded-lg p-1.5 text-center`}>
                      <div className="text-[8px] text-gray-400 font-bold">{item.label} ماه جاری</div>
                      <div className={`text-xs font-black ${item.color}`}>{fmtM(item.val)}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="bg-white px-3 py-2.5 rounded-xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-2 items-center">
        <div className="relative flex-grow w-full">
          <IconSearch className="absolute right-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
          <input
            className="w-full pl-3 pr-9 py-2 bg-gray-50 border-none rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-rose-100"
            placeholder="جستجو در شرح هزینه یا گیرنده..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
          <select className="px-3 py-2 bg-gray-50 rounded-lg text-xs border-none font-bold text-gray-600 outline-none"
            value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">همه سرفصل‌ها</option>
            {NEW_CATEGORIES.map(k => <option key={k} value={k}>{CAT_META[k].label}</option>)}
          </select>
          <select className="px-3 py-2 bg-gray-50 rounded-lg text-xs border-none font-bold text-indigo-600 outline-none"
            value={personnelFilter} onChange={e => setPersonnelFilter(e.target.value)}>
            <option value="all">همه پرسنل</option>
            {personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
          <input type="month" className="px-3 py-2 bg-gray-50 rounded-lg text-xs border-none font-bold text-gray-600 outline-none"
            value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        </div>
        <button onClick={() => {setSearchTerm('');setCategoryFilter('all');setPersonnelFilter('all');setDateFilter('');}}
          className="p-2 text-gray-400 hover:text-rose-600 transition-colors" title="ریست فیلترها">
          <IconRefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-[10px]">شرح هزینه</th>
                <th className="px-3 py-2 text-[10px]">مبلغ (پرداخت / کل)</th>
                <th className="px-3 py-2 text-[10px]">سرفصل حسابداری</th>
                <th className="px-3 py-2 text-[10px]">گیرنده</th>
                <th className="px-3 py-2 text-[10px]">تاریخ</th>
                <th className="px-3 py-2 text-[10px] text-center">وضعیت</th>
                <th className="px-3 py-2 text-[10px] text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredExpenses.map(ex => (
                <tr key={ex.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2">
                    <div className="font-bold text-gray-800 text-xs">{ex.title}</div>
                    {ex.personnelId && (
                      <div className="text-[9px] text-indigo-500 flex items-center gap-0.5 mt-0.5 font-bold">
                        <IconUsers className="w-2.5 h-2.5" /> {getPersonnelName(ex.personnelId)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-black text-rose-600 text-xs">{fmtNum(ex.paidAmount||0)}</span>
                    <span className="text-[9px] text-gray-400"> / {fmtNum(ex.amount)}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-14 bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div className={`h-full ${ex.status==='partial'?'bg-blue-500':'bg-green-500'}`}
                          style={{width:`${Math.min(100,((ex.paidAmount||0)/ex.amount)*100)}%`}} />
                      </div>
                      <span className="text-[8px] font-bold text-gray-400 uppercase">{ex.currency}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${catColor(ex.category)}`}>
                      {catLabel(ex.category)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 font-medium text-xs">{ex.paidTo}</td>
                  <td className="px-3 py-2 text-gray-400 dir-ltr font-mono text-[10px]">{ex.date}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getStatusBadge(ex.status)}`}>
                      {getStatusLabel(ex.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center gap-0.5">
                      <button onClick={() => handleOpenPay(ex)}  className="p-1 text-green-500 hover:bg-green-50 rounded"  title="ثبت پرداخت"><IconMoney className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleOpenEdit(ex)} className="p-1 text-blue-400 hover:bg-blue-50 rounded"><IconEdit className="w-3.5 h-3.5" /></button>
                      {isMaster && <button onClick={() => handleDelete(ex.id)} className="p-1 text-red-400 hover:bg-red-50 rounded"><IconTrash className="w-3.5 h-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400">
                    <IconWallet className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="font-bold text-xs">هزینه‌ای یافت نشد.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ Add / Edit Modal ══ */}
      {showAddModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 bg-rose-50 flex justify-between items-center">
              <h3 className="font-black text-lg text-rose-900 flex items-center gap-2">
                <IconWallet className="w-5 h-5" />
                {editingExpense ? 'ویرایش هزینه' : 'ثبت هزینه جدید'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-rose-100 rounded-full">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">شرح هزینه</label>
                  <input required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-bold"
                    value={formData.title} onChange={e => setFormData({...formData, title:e.target.value})}
                    placeholder="مثلاً: اجاره دفتر مهر ۱۴۰۳" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">مبلغ کل</label>
                  <div className="flex gap-2">
                    <input type="text" required
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-black text-rose-600 dir-ltr text-right"
                      value={displayAmount} onChange={e => { const f=fmtInput(e.target.value); setDisplayAmount(f); setFormData(p=>({...p,amount:parseFloat(f.replace(/,/g,''))||0})); }}
                      placeholder="0" />
                    <select className="w-24 px-2 border rounded-xl bg-gray-50 outline-none font-bold text-sm"
                      value={formData.currency} onChange={e => setFormData({...formData, currency:e.target.value as Currency})}>
                      <option value="IRR">ریال</option>
                      <option value="USD">USD</option>
                      <option value="OMR">OMR</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">مبلغ پرداخت‌شده تاکنون</label>
                  <input type="text"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-black text-green-600 dir-ltr text-right"
                    value={displayPaidAmount} onChange={e => { const f=fmtInput(e.target.value); setDisplayPaidAmount(f); setFormData(p=>({...p,paidAmount:parseFloat(f.replace(/,/g,''))||0})); }}
                    placeholder="0" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">سرفصل حسابداری</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 bg-white font-bold text-sm"
                    value={formData.category} onChange={e => setFormData({...formData, category:e.target.value as ExpenseCategory})}>
                    <optgroup label="── بهای تمام‌شده ──">
                      <option value="cogs">{CAT_META.cogs.label}</option>
                    </optgroup>
                    <optgroup label="── هزینه‌های عملیاتی ──">
                      {['salary_benefits','rent_utilities','marketing_ads','admin_general','it_software','sales_commission'].map(k=>(
                        <option key={k} value={k}>{CAT_META[k].label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="── هزینه‌های غیرعملیاتی ──">
                      {['tax_legal','depreciation','financial_costs','other'].map(k=>(
                        <option key={k} value={k}>{CAT_META[k].label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="── سرمایه‌گذاری ──">
                      <option value="capex">{CAT_META.capex.label}</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">تاریخ پرداخت</label>
                  <input type="date" required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-mono"
                    value={formData.date} onChange={e => setFormData({...formData, date:e.target.value})} />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">مرتبط با پرسنل</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 bg-white font-bold text-indigo-600"
                    value={formData.personnelId}
                    onChange={e => setFormData({...formData, personnelId:e.target.value, paidTo:e.target.value?(personnel.find(p=>p.id===e.target.value)?.fullName||formData.paidTo):formData.paidTo})}>
                    <option value="">بدون ارتباط پرسنلی (متفرقه)</option>
                    {personnel.map(p => <option key={p.id} value={p.id}>{p.fullName} ({p.roles.join(', ')})</option>)}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">پرداخت شده به (نام شخص / شرکت)</label>
                  <input required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-bold"
                    value={formData.paidTo} onChange={e => setFormData({...formData, paidTo:e.target.value})} placeholder="شخص یا شرکت" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">توضیحات / جزئیات</label>
                  <textarea rows={2} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-medium"
                    value={formData.description} onChange={e => setFormData({...formData, description:e.target.value})} />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">پیوست رسید / فاکتور</label>
                  <div onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center cursor-pointer hover:border-rose-400 hover:bg-rose-50/30 transition-all bg-gray-50">
                    <IconFileText className="w-7 h-7 text-gray-300 mx-auto mb-1" />
                    <p className="text-xs text-gray-500 font-bold">برای آپلود کلیک کنید (فاکتور، فیش واریز و ...)</p>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.files?.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 p-2 rounded-lg text-xs shadow-sm">
                        <IconFileText className="w-3 h-3 text-rose-500" />
                        <span className="max-w-[150px] truncate font-bold">{f.name}</span>
                        {f.status==='uploading' && <span className="text-[10px] text-blue-500">{Math.round(f.progress||0)}%</span>}
                        <button type="button" onClick={() => setFormData(p=>({...p,files:p.files?.filter((_,idx)=>idx!==i)}))} className="text-red-400 hover:text-red-600">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </form>
            <div className="p-5 border-t border-gray-100 flex gap-3 bg-gray-50/50">
              <button type="button" onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 text-gray-500 font-bold hover:bg-white rounded-2xl border border-transparent hover:border-gray-200">انصراف</button>
              <button onClick={handleSave} disabled={isSubmitting}
                className="flex-1 py-3 bg-rose-600 text-white font-black rounded-2xl shadow-xl shadow-rose-200 hover:bg-rose-700 flex justify-center items-center gap-2">
                {isSubmitting ? <IconRefreshCw className="w-5 h-5 animate-spin" /> : <><IconCheck className="w-5 h-5" />ذخیره نهایی</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Partial Payment Modal ══ */}
      {showPayModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowPayModal(null)}>
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b bg-green-50 flex justify-between items-center">
              <h3 className="font-black text-lg text-green-900 flex items-center gap-2"><IconMoney className="w-5 h-5" />ثبت پرداخت مرحله‌ای</h3>
              <button onClick={() => setShowPayModal(null)} className="p-2 hover:bg-green-100 rounded-full">✕</button>
            </div>
            <div className="p-7 space-y-5">
              <div className="text-sm font-bold text-gray-700">{showPayModal.title}</div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2 text-xs font-bold">
                <div className="flex justify-between"><span className="text-gray-500">مبلغ کل:</span><span>{fmtNum(showPayModal.amount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">پرداخت‌شده:</span><span className="text-green-600">{fmtNum(showPayModal.paidAmount||0)}</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-2 text-sm">
                  <span className="text-gray-700">باقیمانده:</span>
                  <span className="text-rose-600">{fmtNum(showPayModal.amount-(showPayModal.paidAmount||0))} {showPayModal.currency}</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">مبلغ پرداختی جدید</label>
                <input type="text" autoFocus
                  className="w-full px-4 py-4 rounded-xl border-2 border-green-100 outline-none focus:border-green-500 font-black text-2xl text-green-600 dir-ltr text-center"
                  value={displayPaidAmount}
                  onChange={e => setDisplayPaidAmount(fmtInput(e.target.value))}
                  placeholder="0" />
              </div>
            </div>
            <div className="p-5 bg-gray-50 flex gap-3">
              <button onClick={() => setShowPayModal(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-white rounded-xl">انصراف</button>
              <button onClick={handleSavePay} disabled={isSubmitting || !displayPaidAmount}
                className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 flex justify-center items-center gap-2">
                {isSubmitting ? <IconRefreshCw className="w-5 h-5 animate-spin" /> : <><IconCheck className="w-5 h-5" />ثبت پرداخت</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
