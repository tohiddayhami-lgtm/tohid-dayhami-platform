
import React, { useState, useEffect, useRef } from 'react';
import { Expense, Currency, ExpenseCategory, Personnel, AttachedFile, SalesRecord } from '../types';
import { IconPlus, IconTrash, IconEdit, IconCheck, IconSearch, IconFileText, IconWallet, IconUsers, IconRefreshCw, IconMoney, IconChart, IconTrendingUp } from './Icons';
import { saveExpense, updateExpense, deleteExpense, subscribeToExpenses, uploadFileWithProgress, subscribeToSalesRecords, saveSalesRecord, updateSalesRecord, deleteSalesRecord } from '../services/firebaseService';
import { Language } from '../App';

interface Props {
  currentUser: Personnel;
  personnel: Personnel[];
  lang: Language;
}

// ── Accounting category metadata ──────────────────────────────────────────────
const EXP_CAT: Record<string, { label: string; group: string; color: string }> = {
  cogs:              { label: 'بهای تمام‌شده خدمات',           group: 'cogs',  color: 'bg-purple-100 text-purple-700' },
  salary_benefits:   { label: 'حقوق، دستمزد و مزایا',          group: 'opex',  color: 'bg-blue-100 text-blue-700' },
  rent_utilities:    { label: 'اجاره، قبوض و تأسیسات',          group: 'opex',  color: 'bg-cyan-100 text-cyan-700' },
  marketing_ads:     { label: 'بازاریابی و تبلیغات',            group: 'opex',  color: 'bg-pink-100 text-pink-700' },
  admin_general:     { label: 'هزینه‌های اداری و عمومی',        group: 'opex',  color: 'bg-slate-100 text-slate-700' },
  it_software:       { label: 'فناوری اطلاعات و نرم‌افزار',    group: 'opex',  color: 'bg-indigo-100 text-indigo-700' },
  sales_commission:  { label: 'کمیسیون فروش و بازاریابی',       group: 'opex',  color: 'bg-orange-100 text-orange-700' },
  tax_legal:         { label: 'مالیات، عوارض و هزینه حقوقی',   group: 'below', color: 'bg-red-100 text-red-700' },
  depreciation:      { label: 'استهلاک دارایی‌ها',              group: 'below', color: 'bg-yellow-100 text-yellow-700' },
  financial_costs:   { label: 'هزینه‌های مالی و بانکی',         group: 'below', color: 'bg-rose-100 text-rose-700' },
  capex:             { label: 'سرمایه‌گذاری / دارایی ثابت',    group: 'capex', color: 'bg-teal-100 text-teal-700' },
  other:             { label: 'سایر هزینه‌ها',                   group: 'below', color: 'bg-gray-100 text-gray-600' },
  // legacy
  operational:         { label: 'هزینه عملیاتی',        group: 'opex',  color: 'bg-gray-100 text-gray-600' },
  non_operational:     { label: 'هزینه غیرعملیاتی',     group: 'below', color: 'bg-gray-100 text-gray-600' },
  salary:              { label: 'حقوق (قدیمی)',          group: 'opex',  color: 'bg-blue-100 text-blue-700' },
  tax:                 { label: 'مالیات (قدیمی)',         group: 'below', color: 'bg-red-100 text-red-700' },
  marketing:           { label: 'تبلیغات (قدیمی)',       group: 'opex',  color: 'bg-pink-100 text-pink-700' },
  rent:                { label: 'اجاره (قدیمی)',          group: 'opex',  color: 'bg-cyan-100 text-cyan-700' },
  designer_commission: { label: 'کمیسیون طراح (قدیمی)', group: 'opex',  color: 'bg-orange-100 text-orange-700' },
};

const INC_CAT: Record<string, { label: string; color: string }> = {
  service_revenue:  { label: 'فروش خدمات',         color: 'bg-emerald-100 text-emerald-700' },
  project_revenue:  { label: 'درآمد پروژه',        color: 'bg-green-100 text-green-700' },
  consulting:       { label: 'حق مشاوره',           color: 'bg-teal-100 text-teal-700' },
  training:         { label: 'درآمد آموزشی',        color: 'bg-lime-100 text-lime-700' },
  financial_income: { label: 'درآمد مالی / سود',   color: 'bg-cyan-100 text-cyan-700' },
  other_income:     { label: 'سایر درآمدها',        color: 'bg-gray-100 text-gray-600' },
};

const NEW_EXP_CATS = ['cogs','salary_benefits','rent_utilities','marketing_ads','admin_general','it_software','sales_commission','tax_legal','depreciation','financial_costs','capex','other'];
const NEW_INC_CATS = Object.keys(INC_CAT);

const MONTH_NAMES: Record<string, string> = {
  '01':'ژانویه','02':'فوریه','03':'مارس','04':'آوریل',
  '05':'مه','06':'ژوئن','07':'ژوئیه','08':'اوت',
  '09':'سپتامبر','10':'اکتبر','11':'نوامبر','12':'دسامبر'
};

const fmtNum = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });
// OMR always 3 decimal places (1 OMR = 1000 baisa)
const fmtOMR = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtM   = (n: number) => {
  if (Math.abs(n) >= 1_000) return `${n.toFixed(3)}`;
  return n.toFixed(3);
};

// ── Quick Converter sub-component ────────────────────────────────────────────
const CURRENCIES = ['IRR','USD','OMR'] as const;
type CurKey = typeof CURRENCIES[number];

const QuickConverter: React.FC<{
  rates: {USD_IRR:number;OMR_IRR:number};
  fmtInput: (v:string)=>string;
  parseAmt: (v:string)=>number;
  normalizeDigits: (v:string)=>string;
}> = ({ rates, fmtInput, parseAmt, normalizeDigits }) => {
  const [qAmt, setQAmt] = useState('');
  const [qFrom, setQFrom] = useState<CurKey>('IRR');

  const toIRR2 = (a:number,c:string) => c==='IRR'?a:c==='USD'?a*rates.USD_IRR:c==='OMR'?a*rates.OMR_IRR:a;
  const toAny  = (a:number, from:string, to:string) => {
    const irr = toIRR2(a, from);
    if (to==='IRR') return irr;
    if (to==='USD') return rates.USD_IRR>0 ? irr/rates.USD_IRR : 0;
    if (to==='OMR') return rates.OMR_IRR>0 ? irr/rates.OMR_IRR : 0;
    return irr;
  };

  const num = parseAmt(qAmt);
  const CUR_LABEL: Record<CurKey,string> = {IRR:'ریال ایران (IRR)', USD:'دلار آمریکا (USD)', OMR:'ریال عمان (OMR)'};

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <input
          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-black dir-ltr text-right outline-none focus:border-amber-400"
          placeholder="مبلغ را وارد کنید..."
          value={qAmt}
          onChange={e => setQAmt(fmtInput(e.target.value))}
        />
        <select className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none"
          value={qFrom} onChange={e => setQFrom(e.target.value as CurKey)}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {num > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {CURRENCIES.map(to => {
            const converted = toAny(num, qFrom, to);
            const isFrom = to === qFrom;
            return (
              <div key={to} className={`rounded-xl p-2.5 border text-center ${isFrom ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
                <div className="text-[9px] font-bold text-gray-400 mb-0.5">{CUR_LABEL[to]}</div>
                <div className={`text-sm font-black ${isFrom ? 'text-amber-700' : 'text-gray-800'}`}>
                  {isFrom ? qAmt : converted.toLocaleString(undefined, {maximumFractionDigits: to==='IRR'?0:6})}
                </div>
                {isFrom && <div className="text-[8px] text-amber-400 font-bold">← مبدأ</div>}
              </div>
            );
          })}
        </div>
      )}
      {!num && (
        <div className="text-[10px] text-gray-400 text-center py-2">مبلغ را وارد کنید تا معادل سه ارز نمایش داده شود</div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export const ExpenseManager: React.FC<Props> = ({ currentUser, personnel, lang }) => {
  const today        = new Date();
  const currentMonth = today.toISOString().substring(0, 7);
  const currentYear  = today.getFullYear().toString();
  const todayStr     = today.toISOString().split('T')[0];

  const [expenses,     setExpenses]     = useState<Expense[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);

  // Custom categories (persisted in localStorage)
  const [customExpCats, setCustomExpCats] = useState<Record<string,{label:string;group:string}>>(() => {
    try { return JSON.parse(localStorage.getItem('customExpCats') || '{}'); } catch { return {}; }
  });
  const [customIncCats, setCustomIncCats] = useState<Record<string,string>>(() => {
    try { return JSON.parse(localStorage.getItem('customIncCats') || '{}'); } catch { return {}; }
  });
  const [newExpCatName, setNewExpCatName] = useState('');
  const [newIncCatName, setNewIncCatName] = useState('');
  const [showAddExpCat, setShowAddExpCat] = useState(false);
  const [showAddIncCat, setShowAddIncCat] = useState(false);

  // UI state
  const [showExpModal,  setShowExpModal]  = useState(false);
  const [showIncModal,  setShowIncModal]  = useState(false);
  const [showPayModal,  setShowPayModal]  = useState<Expense | null>(null);
  const [editingExp,    setEditingExp]    = useState<Expense | null>(null);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [reportPeriod,  setReportPeriod]  = useState<'month'|'year'|'all'>('month');
  const [reportCurrency,setReportCurrency]= useState<'all'|'IRR'|'USD'|'OMR'>('all');
  const [tableView,     setTableView]     = useState<'all'|'expense'|'income'>('all');
  const [showPLDetails, setShowPLDetails] = useState(false);
  const [openCats,      setOpenCats]      = useState<Record<string,boolean>>({});

  // Exchange rates (persisted in localStorage)
  const [rates, setRates] = useState<{USD_IRR:number;OMR_IRR:number}>(() => {
    try { return JSON.parse(localStorage.getItem('fx_rates') || '{"USD_IRR":600000,"OMR_IRR":1560000}'); }
    catch { return {USD_IRR:600000, OMR_IRR:1560000}; }
  });
  const [showRatesPanel, setShowRatesPanel] = useState(false);
  const [rDraft, setRDraft] = useState({USD_IRR:'', OMR_IRR:''});

  // Filters — default date to current month so data shows immediately
  const [dateFilter,      setDateFilter]      = useState(currentMonth);
  const [categoryFilter,  setCategoryFilter]  = useState('all');
  const [personnelFilter, setPersonnelFilter] = useState('all');
  const [searchTerm,      setSearchTerm]      = useState('');

  // Expense form
  const blankExp: Partial<Expense> = {
    title:'', amount:0, paidAmount:0, currency:'IRR',
    category:'salary_benefits' as ExpenseCategory,
    date: todayStr, paidTo:'', personnelId:'', description:'', status:'paid', files:[]
  };
  const [expForm, setExpForm] = useState<Partial<Expense>>(blankExp);
  const [dispAmt,     setDispAmt]     = useState('');
  const [dispPaidAmt, setDispPaidAmt] = useState('');

  // Income form
  const blankInc = { title:'', category:'service_revenue', amount:0, receivedAmount:0, currency:'IRR' as Currency, date: todayStr, account:'', notes:'' };
  const [incForm,         setIncForm]         = useState(blankInc);
  const [editingInc,      setEditingInc]      = useState<SalesRecord | null>(null);
  const [showIncPayModal, setShowIncPayModal] = useState<SalesRecord | null>(null);
  const [dispIncAmt,      setDispIncAmt]      = useState('');
  const [dispIncReceived, setDispIncReceived] = useState('');
  const [dispIncNewReceipt, setDispIncNewReceipt] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMaster = currentUser.username === 'master' || currentUser.roles.includes('مدیر');

  useEffect(() => { const u = subscribeToExpenses(setExpenses);       return () => u(); }, []);
  useEffect(() => { const u = subscribeToSalesRecords(setSalesRecords); return () => u(); }, []);

  // ── helpers ────────────────────────────────────────────────────────────────
  const normalizeDigits = (v: string) =>
    v.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
     .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

  // Supports decimals: keeps one dot, formats integer part with commas
  const fmtInput = (v: string) => {
    const norm = normalizeDigits(v);
    const dotIdx = norm.indexOf('.');
    if (dotIdx >= 0) {
      const intPart = norm.substring(0, dotIdx).replace(/\D/g,'');
      const decPart = norm.substring(dotIdx + 1).replace(/\D/g,'').substring(0, 6);
      return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g,',')}. ${decPart}`.replace('. ', '.');
    }
    return norm.replace(/\D/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,',');
  };

  const parseAmt = (disp: string) => parseFloat(normalizeDigits(disp).replace(/,/g,'')) || 0;

  // ── Exchange rate helpers ───────────────────────────────────────────────────
  const toIRR = (amt: number, cur: string): number => {
    if (!amt) return 0;
    if (cur === 'IRR') return amt;
    if (cur === 'USD') return amt * rates.USD_IRR;
    if (cur === 'OMR') return amt * rates.OMR_IRR;
    return amt;
  };
  const toOMR = (amt: number, cur: string) => rates.OMR_IRR > 0 ? toIRR(amt, cur) / rates.OMR_IRR : 0;
  const toUSD = (amt: number, cur: string) => rates.USD_IRR > 0 ? toIRR(amt, cur) / rates.USD_IRR : 0;

  // Returns conversion hint lines for display under amount field
  const convHint = (amt: number, cur: string): {omr:string;usd:string;irr:string} => {
    if (!amt || amt <= 0) return {omr:'',usd:'',irr:''};
    const omr = toOMR(amt, cur);
    const usd = toUSD(amt, cur);
    const irr = toIRR(amt, cur);
    return {
      omr: cur !== 'OMR' ? `${omr.toLocaleString(undefined,{maximumFractionDigits:4})} OMR` : '',
      usd: cur !== 'USD' ? `${usd.toLocaleString(undefined,{maximumFractionDigits:4})} USD` : '',
      irr: cur !== 'IRR' ? `${Math.round(irr).toLocaleString()} IRR` : '',
    };
  };

  const saveRates = () => {
    const r = {
      USD_IRR: parseAmt(rDraft.USD_IRR) || rates.USD_IRR,
      OMR_IRR: parseAmt(rDraft.OMR_IRR) || rates.OMR_IRR,
    };
    setRates(r);
    localStorage.setItem('fx_rates', JSON.stringify(r));
    setShowRatesPanel(false);
    setRDraft({USD_IRR:'', OMR_IRR:''});
  };

  // Custom category helpers — typed
  const customExpEntries = Object.entries(customExpCats).map(([k,v]) => [k,{label:(v as {label:string;group:string}).label, group:(v as {label:string;group:string}).group, color:'bg-violet-100 text-violet-700'}] as [string, {label:string;group:string;color:string}]);
  const allExpCats: Record<string,{label:string;group:string;color:string}> = { ...EXP_CAT, ...Object.fromEntries(customExpEntries) };
  const customIncEntries = Object.entries(customIncCats).map(([k,v]) => [k,{label:String(v), color:'bg-violet-100 text-violet-700'}] as [string,{label:string;color:string}]);
  const allIncCats: Record<string,{label:string;color:string}> = { ...INC_CAT, ...Object.fromEntries(customIncEntries) };

  const addCustomExpCat = () => {
    if (!newExpCatName.trim()) return;
    const key = `cust_exp_${Date.now()}`;
    const updated = {...customExpCats, [key]:{label:newExpCatName.trim(),group:'opex'}};
    setCustomExpCats(updated);
    localStorage.setItem('customExpCats', JSON.stringify(updated));
    setExpForm(p => ({...p, category: key as ExpenseCategory}));
    setNewExpCatName(''); setShowAddExpCat(false);
  };

  const addCustomIncCat = () => {
    if (!newIncCatName.trim()) return;
    const key = `cust_inc_${Date.now()}`;
    const updated = {...customIncCats, [key]: newIncCatName.trim()};
    setCustomIncCats(updated);
    localStorage.setItem('customIncCats', JSON.stringify(updated));
    setIncForm(p => ({...p, category: key}));
    setNewIncCatName(''); setShowAddIncCat(false);
  };

  const expCatLabel  = (k: string) => allExpCats[k]?.label || EXP_CAT[k]?.label || k;
  const expCatColor  = (k: string) => allExpCats[k]?.color || EXP_CAT[k]?.color || 'bg-gray-100 text-gray-600';
  const incCatLabel  = (k: string) => allIncCats[k]?.label || INC_CAT[k]?.label || k;
  const incCatColor  = (k: string) => allIncCats[k]?.color || INC_CAT[k]?.color || 'bg-green-100 text-green-700';

  const statusBadge = (s: string) =>
    s==='paid'    ? 'bg-green-100 text-green-700' :
    s==='partial' ? 'bg-blue-100 text-blue-700'   : 'bg-amber-100 text-amber-700';
  const statusLabel = (s: string) =>
    s==='paid' ? 'تسویه' : s==='partial' ? 'بخشی' : 'معوق';

  const getPName = (id?: string) => personnel.find(p => p.id === id)?.fullName;

  // ── filtered data ──────────────────────────────────────────────────────────
  const filteredExp = expenses.filter(ex => {
    const mCat  = categoryFilter === 'all' || ex.category === categoryFilter;
    const mSrch = searchTerm === '' ||
                  ex.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  ex.paidTo.toLowerCase().includes(searchTerm.toLowerCase());
    const mDate = !dateFilter || ex.date.startsWith(dateFilter);
    const mPers = personnelFilter === 'all' || ex.personnelId === personnelFilter;
    return mCat && mSrch && mDate && mPers;
  });

  const filteredInc = salesRecords.filter(sr => {
    const mDate = !dateFilter || (sr.depositDate||'').startsWith(dateFilter);
    const mSrch = searchTerm === '' ||
                  (sr.customerName||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (sr.serviceTitle||'').toLowerCase().includes(searchTerm.toLowerCase());
    return mDate && mSrch;
  });

  // ── All figures converted to OMR ──────────────────────────────────────────
  // Helper: convert any amount+currency to OMR (defined after rates state)
  const omr = (amt: number, cur: string) => toOMR(amt, cur);

  // KPI totals in OMR
  const kpiIncOMR      = filteredInc.reduce((s,sr) => s + omr(sr.saleAmount||0, sr.currency||'IRR'), 0);
  const kpiExpOMR      = filteredExp.reduce((s,e)  => s + omr(e.amount||0,      e.currency||'IRR'), 0);
  const kpiExpPaidOMR  = filteredExp.reduce((s,e)  => s + omr(e.paidAmount||0,  e.currency||'IRR'), 0);
  const kpiNetOMR      = kpiIncOMR - kpiExpOMR;
  const kpiArrearsOMR  = kpiExpOMR - kpiExpPaidOMR;

  // Income receivables in OMR
  const kpiIncReceivedOMR = filteredInc.reduce((s,sr) => s + omr(sr.receivedAmount??sr.saleAmount, sr.currency||'IRR'), 0);
  const kpiIncPendingOMR  = kpiIncOMR - kpiIncReceivedOMR;

  const paidCnt    = filteredExp.filter(e=>e.status==='paid').length;
  const partialCnt = filteredExp.filter(e=>e.status==='partial').length;
  const pendingCnt = filteredExp.filter(e=>e.status==='pending').length;

  // ── P&L engine — all in OMR, all currencies ────────────────────────────────
  const inPeriod = (d: string) => {
    if (reportPeriod === 'month') return d.startsWith(currentMonth);
    if (reportPeriod === 'year')  return d.startsWith(currentYear);
    return true;
  };

  const plExp = expenses.filter(ex => inPeriod(ex.date));
  const plInc = salesRecords.filter(sr => inPeriod(sr.depositDate||sr.createdAt||''));

  // All P&L amounts are in OMR
  const plRevenue   = plInc.reduce((s,r) => s + omr(r.saleAmount||0, r.currency||'IRR'), 0);
  const byGroup     = (g: string) => plExp
    .filter(e => (allExpCats[e.category]?.group||EXP_CAT[e.category]?.group||'below') === g)
    .reduce((s,e) => s + omr(e.amount||0, e.currency||'IRR'), 0);
  const byCat       = (cat: string) => plExp
    .filter(e => e.category === cat)
    .reduce((s,e) => s + omr(e.amount||0, e.currency||'IRR'), 0);

  const plCogs      = byGroup('cogs');
  const grossProfit = plRevenue - plCogs;
  const plOpex      = byGroup('opex');
  const ebit        = grossProfit - plOpex;
  const plBelow     = byGroup('below');
  const netIncome   = ebit - plBelow;
  const plCapex     = byGroup('capex');

  // Category breakdown in OMR
  const catKeysSet: string[] = [];
  plExp.forEach(e => { const k = String(e.category); if (!catKeysSet.includes(k)) catKeysSet.push(k); });
  const sortedCats = catKeysSet
    .map(k => [k, byCat(k)] as [string, number])
    .sort((a,b) => b[1] - a[1]);
  const maxCatAmt = Math.max(...sortedCats.map(c=>c[1]), 1);

  // ── Monthly chart — all in OMR ─────────────────────────────────────────────
  const monthlyData: Record<string,{expenses:number;expPaid:number;income:number}> = {};
  monthlyData[currentMonth] = {expenses:0, expPaid:0, income:0};
  expenses.forEach(ex => {
    const m = ex.date?.substring(0,7); if (!m) return;
    if (!monthlyData[m]) monthlyData[m] = {expenses:0,expPaid:0,income:0};
    monthlyData[m].expenses += omr(ex.amount||0,     ex.currency||'IRR');
    monthlyData[m].expPaid  += omr(ex.paidAmount||0, ex.currency||'IRR');
  });
  salesRecords.forEach(sr => {
    const m = (sr.depositDate||sr.createdAt||'').substring(0,7); if (!m) return;
    if (!monthlyData[m]) monthlyData[m] = {expenses:0,expPaid:0,income:0};
    monthlyData[m].income += omr(sr.saleAmount||0, sr.currency||'IRR');
  });
  const monthlyRows = Object.entries(monthlyData).sort((a,b)=>a[0].localeCompare(b[0]));
  const maxMV = Math.max(...monthlyRows.flatMap(m=>[m[1].expenses,m[1].income]), 1);

  // ── expense form handlers ──────────────────────────────────────────────────
  const openAddExp = () => {
    setEditingExp(null); setExpForm(blankExp);
    setDispAmt(''); setDispPaidAmt(''); setShowExpModal(true);
  };
  const openEditExp = (ex: Expense) => {
    setEditingExp(ex); setExpForm({...ex, personnelId:ex.personnelId||''});
    setDispAmt(ex.amount.toLocaleString());
    setDispPaidAmt((ex.paidAmount||0).toLocaleString());
    setShowExpModal(true);
  };
  const openPayExp = (ex: Expense) => { setShowPayModal(ex); setExpForm({...ex}); setDispPaidAmt(''); };

  const saveExp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expForm.title || !expForm.amount) return;
    setIsSubmitting(true);
    const amount = parseAmt(dispAmt);
    const paid   = parseAmt(dispPaidAmt);
    const status: 'paid'|'pending'|'partial' = paid>=amount?'paid':paid>0?'partial':'pending';
    const exp: Expense = {
      id: editingExp?.id || `exp-${Date.now()}`,
      title: expForm.title!, amount, paidAmount:paid,
      currency: expForm.currency as Currency,
      category: expForm.category as ExpenseCategory,
      date: expForm.date!, paidTo: expForm.paidTo!,
      personnelId: expForm.personnelId||undefined,
      description: expForm.description, files: expForm.files,
      status, createdAt: editingExp?.createdAt||new Date().toISOString(),
      createdBy: editingExp?.createdBy||currentUser.fullName,
    };
    if (editingExp) await updateExpense(exp.id, exp, currentUser.fullName);
    else            await saveExpense(exp, currentUser.fullName);
    setIsSubmitting(false); setShowExpModal(false); setEditingExp(null);
  };

  const savePay = async () => {
    if (!showPayModal) return;
    setIsSubmitting(true);
    const added   = parseFloat(normalizeDigits(dispPaidAmt).replace(/,/g,''))||0;
    const newPaid = (showPayModal.paidAmount||0) + added;
    const status: 'paid'|'pending'|'partial' =
      newPaid >= showPayModal.amount ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
    await updateExpense(showPayModal.id, {paidAmount:newPaid,status}, currentUser.fullName);
    setIsSubmitting(false); setShowPayModal(null);
  };

  const delExp = async (id: string) => {
    if (window.confirm('آیا از حذف این رکورد هزینه اطمینان دارید؟'))
      await deleteExpense(id, currentUser.fullName);
  };

  // ── income form handlers ───────────────────────────────────────────────────
  const openAddInc = () => {
    setEditingInc(null);
    setIncForm(blankInc);
    setDispIncAmt(''); setDispIncReceived('');
    setShowIncModal(true);
  };

  const openEditInc = (sr: SalesRecord) => {
    setEditingInc(sr);
    setIncForm({
      title:          sr.customerName,
      category:       sr.serviceTitle || 'service_revenue',
      amount:         sr.saleAmount,
      receivedAmount: sr.receivedAmount || 0,
      currency:       sr.currency,
      date:           sr.depositDate,
      account:        sr.depositAccount || '',
      notes:          sr.notes || '',
    });
    setDispIncAmt(sr.saleAmount.toLocaleString());
    setDispIncReceived((sr.receivedAmount || 0).toLocaleString());
    setShowIncModal(true);
  };

  const openIncPay = (sr: SalesRecord) => {
    setShowIncPayModal(sr);
    setDispIncNewReceipt('');
  };

  const calcIncStatus = (total: number, received: number): 'received'|'partial'|'pending' =>
    received >= total ? 'received' : received > 0 ? 'partial' : 'pending';

  const saveInc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incForm.title || !incForm.amount) return;
    setIsSubmitting(true);
    const total    = parseAmt(dispIncAmt);
    const received = parseAmt(dispIncReceived);
    const status   = calcIncStatus(total, received);
    const now      = new Date().toISOString();
    const rec: SalesRecord = {
      id:              editingInc?.id || `inc-${Date.now()}`,
      salespersonId:   currentUser.id,
      salespersonName: currentUser.fullName,
      serviceId:       incForm.category,
      serviceTitle:    incForm.category,
      customerName:    incForm.title,
      saleAmount:      total,
      receivedAmount:  received,
      paymentStatus:   status,
      currency:        incForm.currency,
      commissionRate:   0,
      commissionAmount: 0,
      commissionPaid:   true,
      depositAccount:  incForm.account || '-',
      depositDate:     incForm.date,
      notes:           incForm.notes,
      createdAt:       editingInc?.createdAt || now,
      updatedAt:       editingInc ? now : undefined,
      updatedBy:       editingInc ? currentUser.fullName : undefined,
    };
    if (editingInc) await updateSalesRecord(rec.id, rec, currentUser.fullName);
    else            await saveSalesRecord(rec);
    setIsSubmitting(false); setShowIncModal(false); setEditingInc(null);
  };

  const saveIncPay = async () => {
    if (!showIncPayModal) return;
    setIsSubmitting(true);
    const added      = parseAmt(dispIncNewReceipt);
    const newReceived = (showIncPayModal.receivedAmount || 0) + added;
    const status     = calcIncStatus(showIncPayModal.saleAmount, newReceived);
    await updateSalesRecord(showIncPayModal.id, {
      receivedAmount: newReceived,
      paymentStatus:  status,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.fullName,
    }, currentUser.fullName);
    setIsSubmitting(false); setShowIncPayModal(null);
  };

  const delInc = async (id: string) => {
    if (window.confirm('آیا از حذف این رکورد درآمد اطمینان دارید؟'))
      await deleteSalesRecord(id, currentUser.fullName);
  };

  const incStatusBadge = (s?: string) =>
    s==='received' ? 'bg-emerald-100 text-emerald-700' :
    s==='partial'  ? 'bg-blue-100 text-blue-700'       : 'bg-amber-100 text-amber-700';
  const incStatusLabel = (s?: string) =>
    s==='received' ? 'دریافت‌شده' : s==='partial' ? 'دریافت بخشی' : 'در انتظار دریافت';

  // ── file upload ────────────────────────────────────────────────────────────
  const handleFileSelect = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]; if (!file) return;
    const nf: AttachedFile = {name:file.name,size:file.size,type:file.type,content:'',status:'uploading',progress:0};
    setExpForm(p => ({...p, files:[...(p.files||[]),nf]}));
    uploadFileWithProgress(file,
      pct  => setExpForm(p=>({...p,files:p.files?.map(f=>f.name===file.name?{...f,progress:pct}:f)})),
      url  => setExpForm(p=>({...p,files:p.files?.map(f=>f.name===file.name?{...f,content:url,status:'success',progress:100}:f)})),
      _err => setExpForm(p=>({...p,files:p.files?.map(f=>f.name===file.name?{...f,status:'error'}:f)})),
      'documents'
    );
  };

  // ── P&L row component ──────────────────────────────────────────────────────
  const PLRow = ({label,value,indent=false,bold=false,top=false}:{
    label:string;value:number;indent?:boolean;bold?:boolean;top?:boolean;
  }) => (
    <div className={`flex justify-between items-center py-0.5 ${top?'border-t border-gray-300 mt-1 pt-1.5':''} ${indent?'pr-3':''}`}>
      <span className={`text-[10px] ${bold?'font-black text-gray-800':'font-medium text-gray-500'}`}>{label}</span>
      <span className={`text-[10px] font-black tabular-nums ${bold?(value<0?'text-rose-600':'text-gray-900'):(value<0?'text-rose-600':'text-gray-700')}`}>
        {value<0?`(${fmtOMR(Math.abs(value))})`:fmtOMR(value)}
      </span>
    </div>
  );

  const periodLabel = reportPeriod==='month'?`${MONTH_NAMES[currentMonth.split('-')[1]]} ${currentMonth.split('-')[0]}`:reportPeriod==='year'?`سال ${currentYear}`:'کل دوره';

  // ── unified table rows ─────────────────────────────────────────────────────
  type Row =
    | { kind:'expense'; data: Expense }
    | { kind:'income';  data: SalesRecord };

  const tableRows: Row[] = [
    ...(tableView !== 'income' ? filteredExp.map(d => ({kind:'expense' as const, data:d})) : []),
    ...(tableView !== 'expense' ? filteredInc.map(d => ({kind:'income'  as const, data:d})) : []),
  ].sort((a, b) => {
    const da = a.kind==='expense' ? a.data.date : (a.data as SalesRecord).depositDate||'';
    const db2 = b.kind==='expense' ? b.data.date : (b.data as SalesRecord).depositDate||'';
    return db2.localeCompare(da);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-sm gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <div className="bg-rose-100 text-rose-600 p-1.5 rounded-lg"><IconWallet className="w-4 h-4"/></div>
            هزینه‌ها و درآمدها
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">ثبت، پایش و گزارش‌گیری مالی شرکت</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openAddInc}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 shadow-md shadow-emerald-200 transition-all">
            <IconTrendingUp className="w-4 h-4"/> ثبت درآمد
          </button>
          <button onClick={openAddExp}
            className="bg-rose-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-rose-700 flex items-center gap-1.5 shadow-md shadow-rose-200 transition-all">
            <IconPlus className="w-4 h-4"/> ثبت هزینه
          </button>
        </div>
      </div>

      {/* ── Exchange Rate Panel ── */}
      <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
        <button
          onClick={() => { setShowRatesPanel(v=>!v); setRDraft({USD_IRR: fmtInput(String(rates.USD_IRR)), OMR_IRR: fmtInput(String(rates.OMR_IRR))}); }}
          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-amber-50/50 transition-colors"
        >
          <span className="text-sm">💱</span>
          <span className="text-xs font-bold text-amber-800">نرخ ارز (تبدیل)</span>
          <div className="flex gap-4 mr-auto text-[10px] text-amber-700 font-bold">
            <span>1 USD = {fmtNum(rates.USD_IRR)} IRR</span>
            <span>1 OMR = {fmtNum(rates.OMR_IRR)} IRR</span>
            <span className="text-gray-400">1 USD ≈ {rates.OMR_IRR > 0 ? (rates.USD_IRR / rates.OMR_IRR).toFixed(4) : '—'} OMR</span>
          </div>
          <span className="text-gray-400 text-[10px]">{showRatesPanel ? '▲' : '▼'}</span>
        </button>

        {showRatesPanel && (
          <div className="px-4 pb-4 border-t border-amber-100 bg-amber-50/30 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">

              {/* USD → IRR */}
              <div>
                <label className="block text-[10px] font-bold text-amber-700 mb-1.5 uppercase tracking-widest">نرخ دلار (USD)</label>
                <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-3 py-2.5">
                  <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">1 USD =</span>
                  <input
                    className="flex-1 text-sm font-black text-amber-700 dir-ltr text-right outline-none bg-transparent"
                    value={rDraft.USD_IRR}
                    onChange={e => setRDraft(p=>({...p, USD_IRR: fmtInput(e.target.value)}))}
                    placeholder={fmtNum(rates.USD_IRR)}
                  />
                  <span className="text-[10px] text-gray-400 font-bold">IRR</span>
                </div>
              </div>

              {/* OMR → IRR */}
              <div>
                <label className="block text-[10px] font-bold text-amber-700 mb-1.5 uppercase tracking-widest">نرخ ریال عمان (OMR)</label>
                <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-3 py-2.5">
                  <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">1 OMR =</span>
                  <input
                    className="flex-1 text-sm font-black text-amber-700 dir-ltr text-right outline-none bg-transparent"
                    value={rDraft.OMR_IRR}
                    onChange={e => setRDraft(p=>({...p, OMR_IRR: fmtInput(e.target.value)}))}
                    placeholder={fmtNum(rates.OMR_IRR)}
                  />
                  <span className="text-[10px] text-gray-400 font-bold">IRR</span>
                </div>
              </div>

              {/* Auto-calculated cross rate */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">نرخ متقاطع (محاسبه خودکار)</label>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 space-y-1">
                  {(() => {
                    const usdIRR = parseAmt(rDraft.USD_IRR) || rates.USD_IRR;
                    const omrIRR = parseAmt(rDraft.OMR_IRR) || rates.OMR_IRR;
                    return (
                      <>
                        <div className="text-[10px] text-gray-600 font-bold flex justify-between">
                          <span>1 USD ≈</span>
                          <span className="text-indigo-700">{omrIRR > 0 ? (usdIRR / omrIRR).toFixed(6) : '—'} OMR</span>
                        </div>
                        <div className="text-[10px] text-gray-600 font-bold flex justify-between">
                          <span>1 OMR ≈</span>
                          <span className="text-indigo-700">{usdIRR > 0 ? (omrIRR / usdIRR).toFixed(4) : '—'} USD</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Quick Converter */}
            <div className="mt-4 bg-white border border-amber-200 rounded-xl p-3">
              <div className="text-[10px] font-bold text-amber-700 mb-2">ماشین‌حساب تبدیل سریع</div>
              <QuickConverter rates={rates} fmtInput={fmtInput} parseAmt={parseAmt} normalizeDigits={normalizeDigits} />
            </div>

            <div className="flex gap-2 mt-3">
              <button onClick={saveRates}
                className="px-5 py-2 bg-amber-600 text-white text-xs font-black rounded-xl hover:bg-amber-700 flex items-center gap-1.5 shadow-md shadow-amber-200">
                <IconCheck className="w-3.5 h-3.5"/> ذخیره نرخ‌ها
              </button>
              <button onClick={() => { setShowRatesPanel(false); setRDraft({USD_IRR:'',OMR_IRR:''}); }}
                className="px-4 py-2 text-gray-500 text-xs font-bold hover:bg-gray-100 rounded-xl">
                انصراف
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Cards — all in OMR ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 shadow-sm">
          <div className="text-emerald-600 text-[10px] font-bold mb-0.5">جمع درآمد</div>
          <div className="text-base font-black text-emerald-700">{fmtOMR(kpiIncOMR)}</div>
          <div className="text-[9px] text-emerald-400 mt-0.5 flex justify-between">
            <span>{filteredInc.length} رکورد</span>
            <span>دریافتی: {fmtOMR(kpiIncReceivedOMR)}</span>
          </div>
          {kpiIncPendingOMR > 0.0001 && (
            <div className="text-[9px] text-amber-500 font-bold mt-0.5">مانده دریافتنی: {fmtOMR(kpiIncPendingOMR)}</div>
          )}
        </div>

        <div className="bg-rose-50 px-4 py-3 rounded-xl border border-rose-100 shadow-sm">
          <div className="text-rose-600 text-[10px] font-bold mb-0.5">جمع هزینه</div>
          <div className="text-base font-black text-rose-700">{fmtOMR(kpiExpOMR)}</div>
          <div className="text-[9px] text-rose-400 mt-0.5 flex justify-between">
            <span>{filteredExp.length} رکورد</span>
            <span>پرداخت: {fmtOMR(kpiExpPaidOMR)}</span>
          </div>
        </div>

        <div className={`px-4 py-3 rounded-xl border shadow-sm ${kpiNetOMR>=0?'bg-indigo-50 border-indigo-100':'bg-amber-50 border-amber-100'}`}>
          <div className={`text-[10px] font-bold mb-0.5 ${kpiNetOMR>=0?'text-indigo-600':'text-amber-600'}`}>خالص جریان نقدی</div>
          <div className={`text-base font-black ${kpiNetOMR>=0?'text-indigo-700':'text-amber-700'}`}>
            {kpiNetOMR>=0?'+':''}{fmtOMR(kpiNetOMR)}
          </div>
          <div className={`text-[9px] mt-0.5 font-bold ${kpiNetOMR>=0?'text-indigo-400':'text-amber-500'}`}>
            {kpiNetOMR>=0?'سودده ▲':'زیان‌ده ▼'}
          </div>
        </div>

        <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-gray-400 text-[10px] font-bold mb-0.5">معوقات پرداختی</div>
          <div className="text-base font-black text-amber-600">{fmtOMR(kpiArrearsOMR)}</div>
          <div className="flex gap-1 mt-1.5 flex-wrap">
            <span className="text-[9px] bg-green-100 text-green-600 px-1.5 rounded font-bold">{paidCnt} تسویه</span>
            <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 rounded font-bold">{partialCnt} بخشی</span>
            <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 rounded font-bold">{pendingCnt} معوق</span>
          </div>
        </div>
      </div>
      {/* OMR label */}
      <div className="flex items-center gap-2 -mt-1">
        <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
          همه مبالغ به ریال عمان (OMR) تبدیل‌شده — نرخ: 1 OMR = {fmtNum(rates.OMR_IRR)} IRR
        </span>
      </div>

      {/* ══ Financial Report Panel ══ */}
      <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <IconChart className="w-4 h-4 text-indigo-600"/>
            <span className="text-xs font-bold text-indigo-800">گزارش مالی — صورت وضعیت شرکت</span>
          </div>
          <div className="flex gap-1 mr-auto flex-wrap items-center">
            {(['month','year','all'] as const).map(p=>(
              <button key={p} onClick={()=>setReportPeriod(p)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border ${reportPeriod===p?'bg-indigo-600 text-white border-indigo-600':'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}>
                {p==='month'?'ماه جاری':p==='year'?'سال جاری':'کل دوره'}
              </button>
            ))}
            <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg mr-1">
              OMR
            </span>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── P&L Statement ── */}
          <div className={`bg-gray-50 rounded-xl p-3 border border-gray-200 ${showPLDetails ? 'lg:col-span-3' : ''}`}>
            {/* header */}
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                صورت سود و زیان · {periodLabel}
              </div>
              <button
                onClick={() => setShowPLDetails(v => !v)}
                className={`text-[9px] font-black px-2.5 py-1 rounded-lg border transition-all ${showPLDetails ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}
              >
                {showPLDetails ? '▲ بستن جزئیات' : '▼ نمایش جزئیات'}
              </button>
            </div>

            <div className={showPLDetails ? 'max-h-[70vh] overflow-y-auto pr-1' : ''}>

              {/* ─── Income ─── */}
              <div className="text-[9px] font-black text-emerald-600 uppercase mb-1 mt-1">درآمد</div>
              <PLRow label="جمع درآمد فروش و خدمات" value={plRevenue} bold />
              {showPLDetails && plInc.length > 0 && (
                <div className="mr-3 mt-1 mb-2 space-y-0.5 border-r-2 border-emerald-200 pr-2">
                  {plInc.map(sr => (
                    <div key={sr.id} className="flex justify-between items-start py-0.5 group">
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-bold text-gray-700 truncate">{sr.customerName}</div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${incCatColor(sr.serviceTitle||'other_income')}`}>
                            {incCatLabel(sr.serviceTitle||'other_income')}
                          </span>
                          <span className="text-[8px] text-gray-400 dir-ltr font-mono">{sr.depositDate}</span>
                          {sr.currency !== 'OMR' && (
                            <span className="text-[8px] text-gray-400">{fmtNum(sr.saleAmount)} {sr.currency}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] font-black text-emerald-700 tabular-nums mr-2 shrink-0">
                        {fmtOMR(omr(sr.receivedAmount??sr.saleAmount, sr.currency||'IRR'))}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ─── COGS ─── */}
              {plCogs > 0 && (
                <>
                  <div className="text-[9px] font-black text-gray-400 uppercase mt-2 mb-1">بهای تمام‌شده</div>
                  {(() => {
                    const catItems = plExp.filter(e => (allExpCats[e.category]?.group||'below') === 'cogs');
                    return (
                      <>
                        {catItems.length > 0 && showPLDetails ? (
                          <div className="mr-3 space-y-0.5 border-r-2 border-purple-200 pr-2 mb-1">
                            {catItems.map(e => (
                              <div key={e.id} className="flex justify-between items-start py-0.5">
                                <div className="flex-1 min-w-0">
                                  <div className="text-[9px] font-bold text-gray-700 truncate">{e.title}</div>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${expCatColor(e.category)}`}>{expCatLabel(e.category)}</span>
                                    <span className="text-[8px] text-gray-400 dir-ltr font-mono">{e.date}</span>
                                    {e.paidTo && <span className="text-[8px] text-gray-400 truncate max-w-[80px]">{e.paidTo}</span>}
                                    {e.currency !== 'OMR' && <span className="text-[8px] text-gray-400">{fmtNum(e.amount)} {e.currency}</span>}
                                  </div>
                                </div>
                                <span className="text-[9px] font-black text-rose-600 tabular-nums mr-2 shrink-0">
                                  ({fmtOMR(omr(e.amount, e.currency||'IRR'))})
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <PLRow label="بهای تمام‌شده" value={-plCogs} indent />
                        )}
                      </>
                    );
                  })()}
                </>
              )}
              <PLRow label="سود ناخالص" value={grossProfit} bold top />

              {/* ─── OPEX ─── */}
              <div className="text-[9px] font-black text-gray-400 uppercase mt-2 mb-1">هزینه‌های عملیاتی</div>
              {[
                'salary_benefits','rent_utilities','marketing_ads','admin_general',
                'it_software','sales_commission','operational','salary','marketing','rent','designer_commission',
                ...Object.keys(customExpCats).filter(k => (customExpCats[k] as {group:string}).group === 'opex'),
              ].map((k:string) => {
                const v = byCat(k);
                if (!v) return null;
                const items = plExp.filter(e => e.category === k);
                const isOpen = openCats[k];
                return (
                  <React.Fragment key={k}>
                    <div
                      className={`flex justify-between items-center py-0.5 pr-3 ${showPLDetails && items.length > 0 ? 'cursor-pointer hover:bg-gray-100 rounded' : ''}`}
                      onClick={() => showPLDetails && setOpenCats(p => ({...p, [k]: !p[k]}))}
                    >
                      <span className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                        {showPLDetails && items.length > 0 && (
                          <span className="text-[8px] text-indigo-400">{isOpen ? '▼' : '▶'}</span>
                        )}
                        {allExpCats[k]?.label || k}
                        {showPLDetails && <span className="text-[8px] text-gray-400">({items.length})</span>}
                      </span>
                      <span className="text-[10px] font-black tabular-nums text-rose-600">({fmtOMR(v)})</span>
                    </div>
                    {showPLDetails && isOpen && items.length > 0 && (
                      <div className="mr-5 mb-1 space-y-0.5 border-r-2 border-rose-200 pr-2">
                        {items.map(e => (
                          <div key={e.id} className="flex justify-between items-start py-0.5">
                            <div className="flex-1 min-w-0">
                              <div className="text-[9px] font-bold text-gray-700 truncate">{e.title}</div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[8px] text-gray-400 dir-ltr font-mono">{e.date}</span>
                                {e.paidTo && <span className="text-[8px] text-gray-400 truncate max-w-[100px]">{e.paidTo}</span>}
                                {e.currency !== 'OMR' && <span className="text-[8px] text-gray-400">{fmtNum(e.amount)} {e.currency}</span>}
                                <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${statusBadge(e.status)}`}>{statusLabel(e.status)}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 mr-2">
                              <div className="text-[9px] font-black text-rose-600 tabular-nums">
                                ({fmtOMR(omr(e.amount, e.currency||'IRR'))})
                              </div>
                              {e.paidAmount !== e.amount && (
                                <div className="text-[8px] text-emerald-600 font-bold">
                                  پرداخت: {fmtOMR(omr(e.paidAmount||0, e.currency||'IRR'))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              <PLRow label="سود عملیاتی (EBIT)" value={ebit} bold top />

              {/* ─── Below the line ─── */}
              {plBelow > 0 && (
                <>
                  <div className="text-[9px] font-black text-gray-400 uppercase mt-2 mb-1">هزینه‌های غیرعملیاتی</div>
                  {[
                    'tax_legal','depreciation','financial_costs','other','non_operational','tax',
                    ...Object.keys(customExpCats).filter(k => (customExpCats[k] as {group:string}).group === 'below'),
                  ].map((k:string) => {
                    const v = byCat(k);
                    if (!v) return null;
                    const items = plExp.filter(e => e.category === k);
                    const isOpen = openCats[k];
                    return (
                      <React.Fragment key={k}>
                        <div
                          className={`flex justify-between items-center py-0.5 pr-3 ${showPLDetails && items.length > 0 ? 'cursor-pointer hover:bg-gray-100 rounded' : ''}`}
                          onClick={() => showPLDetails && setOpenCats(p => ({...p, [k]: !p[k]}))}
                        >
                          <span className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                            {showPLDetails && items.length > 0 && (
                              <span className="text-[8px] text-indigo-400">{isOpen ? '▼' : '▶'}</span>
                            )}
                            {allExpCats[k]?.label || k}
                            {showPLDetails && <span className="text-[8px] text-gray-400">({items.length})</span>}
                          </span>
                          <span className="text-[10px] font-black tabular-nums text-rose-600">({fmtOMR(v)})</span>
                        </div>
                        {showPLDetails && isOpen && items.length > 0 && (
                          <div className="mr-5 mb-1 space-y-0.5 border-r-2 border-amber-200 pr-2">
                            {items.map(e => (
                              <div key={e.id} className="flex justify-between items-start py-0.5">
                                <div className="flex-1 min-w-0">
                                  <div className="text-[9px] font-bold text-gray-700 truncate">{e.title}</div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[8px] text-gray-400 dir-ltr font-mono">{e.date}</span>
                                    {e.paidTo && <span className="text-[8px] text-gray-400 truncate max-w-[100px]">{e.paidTo}</span>}
                                    {e.currency !== 'OMR' && <span className="text-[8px] text-gray-400">{fmtNum(e.amount)} {e.currency}</span>}
                                  </div>
                                </div>
                                <span className="text-[9px] font-black text-rose-600 tabular-nums mr-2 shrink-0">
                                  ({fmtOMR(omr(e.amount, e.currency||'IRR'))})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </>
              )}

              {/* ─── Net Income ─── */}
              <div className="border-t-2 border-gray-400 mt-1 pt-1.5">
                <PLRow label="سود / زیان خالص دوره" value={netIncome} bold />
              </div>
              {plCapex > 0 && (
                <div className="border-t border-dashed border-gray-200 mt-2 pt-1.5">
                  <div className="text-[9px] font-black text-teal-500 mb-0.5">یادداشت</div>
                  <PLRow label="سرمایه‌گذاری / CapEx (خارج از P&L)" value={plCapex} />
                  {showPLDetails && plExp.filter(e=>e.category==='capex').map(e => (
                    <div key={e.id} className="flex justify-between items-start py-0.5 mr-3 pr-2 border-r-2 border-teal-200">
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-bold text-gray-700 truncate">{e.title}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] text-gray-400 dir-ltr font-mono">{e.date}</span>
                          {e.paidTo && <span className="text-[8px] text-gray-400">{e.paidTo}</span>}
                        </div>
                      </div>
                      <span className="text-[9px] font-black text-teal-700 tabular-nums mr-2 shrink-0">
                        {fmtOMR(omr(e.amount, e.currency||'IRR'))}
                      </span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* ── Category Breakdown ── */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">
              تفکیک هزینه بر اساس سرفصل · {periodLabel}
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {sortedCats.length === 0 && (
                <div className="text-[10px] text-gray-400 text-center py-8">هزینه‌ای در این دوره ثبت نشده</div>
              )}
              {sortedCats.map(([cat,amt])=>{
                const paid=plExp.filter(e=>e.category===cat).reduce((s,e)=>s+(e.paidAmount||0),0);
                return (
                  <div key={cat}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${expCatColor(cat)}`}>{expCatLabel(cat)}</span>
                      <span className="text-[9px] font-mono text-gray-500">{fmtNum(amt)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden" style={{width:`${(amt/maxCatAmt)*100}%`}}>
                      <div className="h-full bg-rose-500 rounded-full" style={{width:`${amt>0?(paid/amt)*100:0}%`}}/>
                    </div>
                    <div className="text-[8px] text-gray-400 mt-0.5">پرداخت: {fmtNum(paid)} — مانده: {fmtNum(amt-paid)}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-2 border-t border-gray-200 grid grid-cols-3 gap-1 text-center">
              {[
                {l:'تسویه', n:paidCnt,    p:filteredExp.length>0?Math.round(paidCnt/filteredExp.length*100):0,    c:'text-green-600', b:'bg-green-50'},
                {l:'بخشی',  n:partialCnt, p:filteredExp.length>0?Math.round(partialCnt/filteredExp.length*100):0, c:'text-blue-600',  b:'bg-blue-50'},
                {l:'معوق',  n:pendingCnt, p:filteredExp.length>0?Math.round(pendingCnt/filteredExp.length*100):0, c:'text-amber-600', b:'bg-amber-50'},
              ].map(item=>(
                <div key={item.l} className={`${item.b} rounded-lg p-1.5 border border-gray-100`}>
                  <div className={`text-sm font-black ${item.c}`}>{item.p}٪</div>
                  <div className="text-[8px] text-gray-400">{item.l} · {item.n}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Monthly Chart ── */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">
              جریان ماهانه درآمد و هزینه
            </div>
            <div className="flex gap-1.5 items-end overflow-x-auto pb-1" style={{minHeight:'96px'}}>
              {monthlyRows.map(([month, d])=>{
                const isCur = month === currentMonth;
                const net   = d.income - d.expenses;
                const incH  = Math.max((d.income/maxMV)*72, d.income>0?4:0);
                const expH  = Math.max((d.expenses/maxMV)*72, d.expenses>0?4:0);
                return (
                  <div key={month}
                    className={`flex flex-col items-center gap-0.5 min-w-[48px] flex-shrink-0 rounded-lg px-1 py-1 ${isCur?'bg-indigo-50 ring-2 ring-indigo-300':'bg-white border border-gray-100'}`}>
                    <div className="flex items-end gap-0.5" style={{height:'76px', alignItems:'flex-end'}}>
                      {/* income bar */}
                      <div className="w-4 rounded-t-sm bg-gray-200 flex flex-col justify-end overflow-hidden" style={{height:'72px'}}>
                        <div className="w-full bg-emerald-500 rounded-t-sm" style={{height:`${incH}px`}}/>
                      </div>
                      {/* expense bar stacked */}
                      <div className="w-4 rounded-t-sm bg-gray-200 flex flex-col justify-end overflow-hidden" style={{height:'72px'}}>
                        <div className="w-full flex flex-col" style={{height:`${expH}px`}}>
                          <div className="w-full bg-rose-200" style={{height:`${d.expenses>0?((d.expenses-d.expPaid)/d.expenses)*100:0}%`}}/>
                          <div className="w-full bg-rose-500" style={{height:`${d.expenses>0?(d.expPaid/d.expenses)*100:0}%`}}/>
                        </div>
                      </div>
                    </div>
                    <div className={`text-[8px] font-bold text-center leading-none ${isCur?'text-indigo-700':'text-gray-400'}`}>
                      {(MONTH_NAMES[month.split('-')[1]]||'').substring(0,3)}
                      <div className="text-[7px] opacity-70">{month.split('-')[0]}</div>
                      {isCur&&<div className="text-[7px] text-indigo-400">●</div>}
                    </div>
                    <div className={`text-[8px] font-black ${net>=0?'text-emerald-600':'text-rose-600'}`}>
                      {net>=0?'+':''}{fmtOMR(net)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 text-[8px] text-gray-400 font-bold mt-1">
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 bg-emerald-500 rounded-sm inline-block"/>درآمد</span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 bg-rose-500 rounded-sm inline-block"/>هزینه پرداخت</span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 bg-rose-200 rounded-sm inline-block"/>معوق</span>
            </div>
            {/* current month mini-summary */}
            {(() => {
              const cm = monthlyData[currentMonth];
              const n  = cm.income - cm.expenses;
              return (
                <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t border-gray-200">
                  {[
                    {l:'درآمد', v:cm.income,   c:'text-emerald-700', b:'bg-emerald-50'},
                    {l:'هزینه', v:cm.expenses, c:'text-rose-700',    b:'bg-rose-50'},
                    {l:'خالص',  v:n,           c:n>=0?'text-indigo-700':'text-amber-700', b:n>=0?'bg-indigo-50':'bg-amber-50'},
                  ].map(item=>(
                    <div key={item.l} className={`${item.b} rounded-lg p-1.5 text-center`}>
                      <div className="text-[8px] text-gray-400">{item.l} ماه جاری</div>
                      <div className={`text-xs font-black ${item.c}`}>{fmtOMR(item.v)}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

        </div>
      </div>

      {/* ── Filters + table-view tabs ── */}
      <div className="bg-white px-3 py-2.5 rounded-xl border border-gray-100 shadow-sm space-y-2">
        <div className="flex flex-col lg:flex-row gap-2 items-center">
          <div className="relative flex-grow w-full">
            <IconSearch className="absolute right-3 top-2.5 w-3.5 h-3.5 text-gray-400"/>
            <input className="w-full pl-3 pr-9 py-2 bg-gray-50 border-none rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100"
              placeholder="جستجو در شرح، گیرنده یا مشتری..."
              value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
            <select className="px-3 py-2 bg-gray-50 rounded-lg text-xs border-none font-bold text-gray-600 outline-none"
              value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>
              <option value="all">همه سرفصل‌ها</option>
              {NEW_EXP_CATS.map(k=><option key={k} value={k}>{EXP_CAT[k].label}</option>)}
            </select>
            <select className="px-3 py-2 bg-gray-50 rounded-lg text-xs border-none font-bold text-indigo-600 outline-none"
              value={personnelFilter} onChange={e=>setPersonnelFilter(e.target.value)}>
              <option value="all">همه پرسنل</option>
              {personnel.map(p=><option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
            {/* month picker — pre-filled with current month */}
            <input type="month"
              className="px-3 py-2 bg-gray-50 rounded-lg text-xs border-none font-bold text-gray-700 outline-none"
              value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/>
            <button onClick={()=>{setSearchTerm('');setCategoryFilter('all');setPersonnelFilter('all');setDateFilter(currentMonth);}}
              className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-rose-600 bg-gray-50 rounded-lg flex items-center gap-1 transition-colors" title="بازگشت به ماه جاری">
              <IconRefreshCw className="w-3.5 h-3.5"/> ماه جاری
            </button>
          </div>
        </div>
        {/* Table view toggle */}
        <div className="flex gap-1.5">
          {([['all','همه'],['income','درآمدها ▲'],['expense','هزینه‌ها ▼']] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setTableView(v)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${tableView===v?v==='income'?'bg-emerald-600 text-white border-emerald-600':v==='expense'?'bg-rose-600 text-white border-rose-600':'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
              {l}
            </button>
          ))}
          <span className="mr-auto text-[10px] text-gray-400 self-center">
            {tableRows.length} رکورد
          </span>
        </div>
      </div>

      {/* ── Unified Table ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-[10px]">نوع</th>
                <th className="px-3 py-2 text-[10px]">شرح</th>
                <th className="px-3 py-2 text-[10px]">مبلغ</th>
                <th className="px-3 py-2 text-[10px]">سرفصل</th>
                <th className="px-3 py-2 text-[10px]">طرف حساب</th>
                <th className="px-3 py-2 text-[10px]">تاریخ</th>
                <th className="px-3 py-2 text-[10px] text-center">وضعیت</th>
                <th className="px-3 py-2 text-[10px] text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableRows.map(row => {
                if (row.kind === 'income') {
                  const sr = row.data as SalesRecord;
                  const received = sr.receivedAmount ?? sr.saleAmount;
                  const pct = sr.saleAmount > 0 ? Math.min(100, (received / sr.saleAmount) * 100) : 100;
                  const status = sr.paymentStatus || (received >= sr.saleAmount ? 'received' : received > 0 ? 'partial' : 'received');
                  return (
                    <tr key={sr.id} className="hover:bg-emerald-50/30 transition-colors bg-emerald-50/10">
                      <td className="px-3 py-2">
                        <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">درآمد ▲</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-bold text-emerald-800 text-xs">{sr.customerName}</div>
                        {sr.notes && <div className="text-[9px] text-gray-400 mt-0.5 truncate max-w-[140px]">{sr.notes}</div>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {/* OMR primary */}
                        <div className="font-black text-emerald-700 text-xs">
                          {fmtOMR(omr(received, sr.currency||'IRR'))}
                          <span className="text-[8px] font-bold text-amber-600 mr-1">OMR</span>
                        </div>
                        {/* original secondary */}
                        {sr.currency !== 'OMR' && (
                          <div className="text-[9px] text-gray-400 dir-ltr">
                            {fmtNum(received)} / {fmtNum(sr.saleAmount)} {sr.currency}
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-14 bg-gray-100 h-1 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{width:`${pct}%`}}/>
                          </div>
                          <span className="text-[8px] text-gray-400">{Math.round(pct)}٪</span>
                        </div>
                        {sr.saleAmount > received && (
                          <div className="text-[8px] text-amber-600 font-bold mt-0.5">
                            مانده: {fmtOMR(omr(sr.saleAmount-received,sr.currency||'IRR'))} OMR
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${incCatColor(sr.serviceTitle||'other_income')}`}>
                          {incCatLabel(sr.serviceTitle||'other_income')}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{sr.depositAccount||'—'}</td>
                      <td className="px-3 py-2 text-gray-400 dir-ltr font-mono text-[10px]">{sr.depositDate}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${incStatusBadge(status)}`}>
                          {incStatusLabel(status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex justify-center gap-0.5">
                          <button onClick={()=>openIncPay(sr)}
                            className="p-1 text-emerald-500 hover:bg-emerald-50 rounded" title="ثبت دریافت جدید">
                            <IconMoney className="w-3.5 h-3.5"/>
                          </button>
                          <button onClick={()=>openEditInc(sr)}
                            className="p-1 text-blue-400 hover:bg-blue-50 rounded" title="ویرایش">
                            <IconEdit className="w-3.5 h-3.5"/>
                          </button>
                          {isMaster && (
                            <button onClick={()=>delInc(sr.id)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                              <IconTrash className="w-3.5 h-3.5"/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }
                // expense row
                const ex = row.data as Expense;
                return (
                  <tr key={ex.id} className="hover:bg-rose-50/20 transition-colors">
                    <td className="px-3 py-2">
                      <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">هزینه ▼</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-bold text-gray-800 text-xs">{ex.title}</div>
                      {ex.personnelId && (
                        <div className="text-[9px] text-indigo-500 flex items-center gap-0.5 mt-0.5 font-bold">
                          <IconUsers className="w-2.5 h-2.5"/> {getPName(ex.personnelId)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {/* OMR primary */}
                      <div className="font-black text-rose-700 text-xs">
                        {fmtOMR(omr(ex.paidAmount||0, ex.currency||'IRR'))}
                        <span className="text-[8px] font-bold text-amber-600 mr-1">OMR</span>
                        <span className="text-[9px] text-gray-400 font-normal opacity-70">
                          / {fmtOMR(omr(ex.amount, ex.currency||'IRR'))}
                        </span>
                      </div>
                      {/* original secondary */}
                      {ex.currency !== 'OMR' && (
                        <div className="text-[9px] text-gray-400 dir-ltr">
                          {fmtNum(ex.paidAmount||0)} / {fmtNum(ex.amount)} {ex.currency}
                        </div>
                      )}
                      <div className="w-14 bg-gray-100 h-1 rounded-full overflow-hidden mt-0.5">
                        <div className={`h-full ${ex.status==='partial'?'bg-blue-500':'bg-green-500'}`}
                          style={{width:`${Math.min(100,((ex.paidAmount||0)/ex.amount)*100)}%`}}/>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${expCatColor(ex.category)}`}>
                        {expCatLabel(ex.category)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 font-medium text-xs">{ex.paidTo}</td>
                    <td className="px-3 py-2 text-gray-400 dir-ltr font-mono text-[10px]">{ex.date}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${statusBadge(ex.status)}`}>
                        {statusLabel(ex.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex justify-center gap-0.5">
                        <button onClick={()=>openPayExp(ex)}  className="p-1 text-green-500 hover:bg-green-50 rounded" title="ثبت پرداخت"><IconMoney className="w-3.5 h-3.5"/></button>
                        <button onClick={()=>openEditExp(ex)} className="p-1 text-blue-400 hover:bg-blue-50 rounded"><IconEdit className="w-3.5 h-3.5"/></button>
                        {isMaster && <button onClick={()=>delExp(ex.id)} className="p-1 text-red-400 hover:bg-red-50 rounded"><IconTrash className="w-3.5 h-3.5"/></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-gray-400">
                    <IconWallet className="w-10 h-10 mx-auto mb-2 opacity-20"/>
                    <p className="font-bold text-xs">رکوردی برای {dateFilter ? `ماه ${dateFilter}` : 'این بازه'} یافت نشد.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ Income Modal ══ */}
      {showIncModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-fade-in" onClick={()=>setShowIncModal(false)}>
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e=>e.stopPropagation()}>
            <div className="p-5 border-b bg-emerald-50 flex justify-between items-center">
              <h3 className="font-black text-lg text-emerald-900 flex items-center gap-2">
                <IconTrendingUp className="w-5 h-5"/> {editingInc ? 'ویرایش درآمد' : 'ثبت درآمد جدید'}
              </h3>
              <button onClick={()=>{ setShowIncModal(false); setEditingInc(null); }} className="p-2 hover:bg-emerald-100 rounded-full">✕</button>
            </div>
            <form onSubmit={saveInc} className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">شرح / عنوان درآمد</label>
                <input required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 font-bold"
                  value={incForm.title} onChange={e=>setIncForm({...incForm,title:e.target.value})}
                  placeholder="مثلاً: پروژه طراحی سایت شرکت X"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">سرفصل درآمد</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 bg-white font-bold text-sm"
                    value={incForm.category} onChange={e=>{ if(e.target.value==='__new__'){setShowAddIncCat(true);}else{setIncForm({...incForm,category:e.target.value});}}}>
                    <optgroup label="── سرفصل‌های درآمدی ──">
                      {NEW_INC_CATS.map(k=><option key={k} value={k}>{INC_CAT[k].label}</option>)}
                    </optgroup>
                    {Object.keys(customIncCats).length > 0 && (
                      <optgroup label="── سرفصل‌های سفارشی ──">
                        {Object.entries(customIncCats).map(([k,v])=>(
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="──────────────">
                      <option value="__new__">➕ افزودن سرفصل جدید...</option>
                    </optgroup>
                  </select>
                  {showAddIncCat && (
                    <div className="mt-2 flex gap-2 items-center bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                      <input autoFocus className="flex-1 text-xs bg-transparent outline-none font-bold text-violet-800 placeholder-violet-400"
                        placeholder="نام سرفصل درآمد جدید..." value={newIncCatName} onChange={e=>setNewIncCatName(e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();addCustomIncCat();}}}/>
                      <button type="button" onClick={addCustomIncCat} className="text-[10px] font-black bg-violet-600 text-white px-2 py-1 rounded-lg">ثبت</button>
                      <button type="button" onClick={()=>{setShowAddIncCat(false);setNewIncCatName('');}} className="text-[10px] text-gray-400 hover:text-red-500">✕</button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">تاریخ دریافت</label>
                  <input type="date" required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 font-mono"
                    value={incForm.date} onChange={e=>setIncForm({...incForm,date:e.target.value})}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">مبلغ دریافتی</label>
                  <input type="text" required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 font-black text-emerald-600 dir-ltr text-right"
                    value={dispIncAmt}
                    onChange={e=>{ const f=fmtInput(e.target.value); setDispIncAmt(f); setIncForm(p=>({...p,amount:parseAmt(f)})); }}
                    placeholder="0"/>
                  {(() => { const a=parseAmt(dispIncAmt); const h=convHint(a,incForm.currency||'IRR'); if(!a)return null; return (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {h.omr&&<span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">≈ {h.omr}</span>}
                      {h.usd&&<span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">≈ {h.usd}</span>}
                      {h.irr&&<span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">≈ {h.irr}</span>}
                    </div>); })()}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">ارز</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 bg-white font-bold"
                    value={incForm.currency} onChange={e=>setIncForm({...incForm,currency:e.target.value as Currency})}>
                    <option value="IRR">ریال</option>
                    <option value="USD">USD</option>
                    <option value="OMR">OMR</option>
                  </select>
                </div>
              </div>
              {/* Received amount */}
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3">
                <label className="block text-[10px] font-bold text-emerald-700 mb-1.5 uppercase tracking-widest">
                  مبلغ دریافت‌شده تاکنون
                  <span className="normal-case font-normal text-emerald-500 mr-1">(می‌توان کمتر از مبلغ قرارداد باشد)</span>
                </label>
                <input type="text"
                  className="w-full px-4 py-3 rounded-xl border border-emerald-200 outline-none focus:border-emerald-500 font-black text-emerald-700 dir-ltr text-right bg-white"
                  value={dispIncReceived}
                  onChange={e=>{ const f=fmtInput(e.target.value); setDispIncReceived(f); setIncForm(p=>({...p,receivedAmount:parseAmt(f)})); }}
                  placeholder="0 — اگر هنوز چیزی دریافت نشده خالی بگذارید"/>
                {(() => {
                  const total = parseAmt(dispIncAmt);
                  const recv  = parseAmt(dispIncReceived);
                  if (!total) return null;
                  const remaining = total - recv;
                  const pct = Math.min(100, total > 0 ? (recv/total)*100 : 0);
                  const st  = calcIncStatus(total, recv);
                  return (
                    <div className="mt-2 space-y-1.5">
                      <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{width:`${pct}%`}}/>
                      </div>
                      <div className="flex justify-between text-[9px] font-bold">
                        <span className={incStatusBadge(st) + ' px-2 py-0.5 rounded-full'}>{incStatusLabel(st)}</span>
                        {remaining > 0 && <span className="text-amber-600">مانده: {fmtNum(remaining)}</span>}
                        {remaining <= 0 && recv > 0 && <span className="text-emerald-600">تسویه کامل ✓</span>}
                      </div>
                    </div>
                  );
                })()}
                {(() => { const a=parseAmt(dispIncReceived); const h=convHint(a,incForm.currency||'IRR'); if(!a)return null; return (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {h.omr&&<span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">≈ {h.omr}</span>}
                    {h.usd&&<span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">≈ {h.usd}</span>}
                    {h.irr&&<span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">≈ {h.irr}</span>}
                  </div>); })()}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">حساب / کانال دریافت</label>
                <input className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 font-medium"
                  value={incForm.account} onChange={e=>setIncForm({...incForm,account:e.target.value})}
                  placeholder="مثلاً: حساب ملت / کارت به کارت / چک"/>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">توضیحات</label>
                <textarea rows={2} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 font-medium"
                  value={incForm.notes} onChange={e=>setIncForm({...incForm,notes:e.target.value})}/>
              </div>
            </form>
            <div className="p-5 border-t border-gray-100 flex gap-3 bg-gray-50/50">
              <button type="button" onClick={()=>setShowIncModal(false)}
                className="flex-1 py-3 text-gray-500 font-bold hover:bg-white rounded-2xl border border-transparent hover:border-gray-200">انصراف</button>
              <button onClick={saveInc} disabled={isSubmitting}
                className="flex-1 py-3 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 flex justify-center items-center gap-2">
                {isSubmitting?<IconRefreshCw className="w-5 h-5 animate-spin"/>:<><IconCheck className="w-5 h-5"/>{editingInc?'ذخیره تغییرات':'ثبت درآمد'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Expense Add/Edit Modal ══ */}
      {showExpModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-fade-in" onClick={()=>setShowExpModal(false)}>
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e=>e.stopPropagation()}>
            <div className="p-5 border-b bg-rose-50 flex justify-between items-center">
              <h3 className="font-black text-lg text-rose-900 flex items-center gap-2">
                <IconWallet className="w-5 h-5"/>
                {editingExp ? 'ویرایش هزینه' : 'ثبت هزینه جدید'}
              </h3>
              <button onClick={()=>setShowExpModal(false)} className="p-2 hover:bg-rose-100 rounded-full">✕</button>
            </div>
            <form onSubmit={saveExp} className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">شرح هزینه</label>
                  <input required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-bold"
                    value={expForm.title} onChange={e=>setExpForm({...expForm,title:e.target.value})}
                    placeholder="مثلاً: اجاره دفتر / حقوق مهرماه"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">مبلغ کل</label>
                  <div className="flex gap-2">
                    <input type="text" required
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-black text-rose-600 dir-ltr text-right"
                      value={dispAmt}
                      onChange={e=>{ const f=fmtInput(e.target.value); setDispAmt(f); setExpForm(p=>({...p,amount:parseAmt(f)})); }}
                      placeholder="0"/>
                    <select className="w-24 px-2 border rounded-xl bg-gray-50 outline-none font-bold text-sm"
                      value={expForm.currency} onChange={e=>setExpForm({...expForm,currency:e.target.value as Currency})}>
                      <option value="IRR">ریال</option>
                      <option value="USD">USD</option>
                      <option value="OMR">OMR</option>
                    </select>
                  </div>
                  {(() => { const a=parseAmt(dispAmt); const h=convHint(a,expForm.currency||'IRR'); if(!a)return null; return (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {h.omr&&<span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">≈ {h.omr}</span>}
                      {h.usd&&<span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">≈ {h.usd}</span>}
                      {h.irr&&<span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">≈ {h.irr}</span>}
                    </div>); })()}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">مبلغ پرداخت‌شده تاکنون</label>
                  <input type="text"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-black text-green-600 dir-ltr text-right"
                    value={dispPaidAmt}
                    onChange={e=>{ const f=fmtInput(e.target.value); setDispPaidAmt(f); setExpForm(p=>({...p,paidAmount:parseAmt(f)})); }}
                    placeholder="0"/>
                  {(() => { const a=parseAmt(dispPaidAmt); const h=convHint(a,expForm.currency||'IRR'); if(!a)return null; return (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {h.omr&&<span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">≈ {h.omr}</span>}
                      {h.usd&&<span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">≈ {h.usd}</span>}
                      {h.irr&&<span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">≈ {h.irr}</span>}
                    </div>); })()}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">سرفصل حسابداری</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 bg-white font-bold text-sm"
                    value={expForm.category} onChange={e=>{ if(e.target.value==='__new__'){setShowAddExpCat(true);}else{setExpForm({...expForm,category:e.target.value as ExpenseCategory});}}}>
                    <optgroup label="── بهای تمام‌شده ──"><option value="cogs">{EXP_CAT.cogs.label}</option></optgroup>
                    <optgroup label="── هزینه‌های عملیاتی ──">
                      {['salary_benefits','rent_utilities','marketing_ads','admin_general','it_software','sales_commission'].map(k=>(
                        <option key={k} value={k}>{EXP_CAT[k].label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="── هزینه‌های غیرعملیاتی ──">
                      {['tax_legal','depreciation','financial_costs','other'].map(k=>(
                        <option key={k} value={k}>{EXP_CAT[k].label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="── سرمایه‌گذاری ──"><option value="capex">{EXP_CAT.capex.label}</option></optgroup>
                    {Object.keys(customExpCats).length > 0 && (
                      <optgroup label="── سرفصل‌های سفارشی ──">
                        {Object.entries(customExpCats).map(([k,v])=>(
                          <option key={k} value={k}>{(v as {label:string}).label}</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="──────────────">
                      <option value="__new__">➕ افزودن سرفصل جدید...</option>
                    </optgroup>
                  </select>
                  {showAddExpCat && (
                    <div className="mt-2 flex gap-2 items-center bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                      <input autoFocus className="flex-1 text-xs bg-transparent outline-none font-bold text-violet-800 placeholder-violet-400"
                        placeholder="نام سرفصل جدید..." value={newExpCatName} onChange={e=>setNewExpCatName(e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();addCustomExpCat();}}}/>
                      <button type="button" onClick={addCustomExpCat} className="text-[10px] font-black bg-violet-600 text-white px-2 py-1 rounded-lg">ثبت</button>
                      <button type="button" onClick={()=>{setShowAddExpCat(false);setNewExpCatName('');}} className="text-[10px] text-gray-400 hover:text-red-500">✕</button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">تاریخ پرداخت</label>
                  <input type="date" required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-mono"
                    value={expForm.date} onChange={e=>setExpForm({...expForm,date:e.target.value})}/>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">مرتبط با پرسنل</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 bg-white font-bold text-indigo-600"
                    value={expForm.personnelId}
                    onChange={e=>setExpForm({...expForm, personnelId:e.target.value, paidTo:e.target.value?(personnel.find(p=>p.id===e.target.value)?.fullName||expForm.paidTo):expForm.paidTo})}>
                    <option value="">بدون ارتباط پرسنلی</option>
                    {personnel.map(p=><option key={p.id} value={p.id}>{p.fullName} ({p.roles.join(', ')})</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">پرداخت شده به</label>
                  <input required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500 font-bold"
                    value={expForm.paidTo} onChange={e=>setExpForm({...expForm,paidTo:e.target.value})} placeholder="شخص یا شرکت"/>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">توضیحات</label>
                  <textarea rows={2} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-rose-500"
                    value={expForm.description} onChange={e=>setExpForm({...expForm,description:e.target.value})}/>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">پیوست رسید / فاکتور</label>
                  <div onClick={()=>fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-rose-400 hover:bg-rose-50/30 transition-all bg-gray-50">
                    <IconFileText className="w-6 h-6 text-gray-300 mx-auto mb-1"/>
                    <p className="text-xs text-gray-500 font-bold">کلیک برای آپلود (فاکتور، فیش واریز...)</p>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect}/>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {expForm.files?.map((f,i)=>(
                      <div key={i} className="flex items-center gap-1.5 bg-white border border-gray-200 p-1.5 rounded-lg text-xs">
                        <IconFileText className="w-3 h-3 text-rose-500"/>
                        <span className="max-w-[120px] truncate font-bold">{f.name}</span>
                        {f.status==='uploading'&&<span className="text-[9px] text-blue-500">{Math.round(f.progress||0)}%</span>}
                        <button type="button" onClick={()=>setExpForm(p=>({...p,files:p.files?.filter((_,idx)=>idx!==i)}))} className="text-red-400 hover:text-red-600">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </form>
            <div className="p-5 border-t border-gray-100 flex gap-3 bg-gray-50/50">
              <button type="button" onClick={()=>setShowExpModal(false)}
                className="flex-1 py-3 text-gray-500 font-bold hover:bg-white rounded-2xl border border-transparent hover:border-gray-200">انصراف</button>
              <button onClick={saveExp} disabled={isSubmitting}
                className="flex-1 py-3 bg-rose-600 text-white font-black rounded-2xl shadow-xl shadow-rose-200 hover:bg-rose-700 flex justify-center items-center gap-2">
                {isSubmitting?<IconRefreshCw className="w-5 h-5 animate-spin"/>:<><IconCheck className="w-5 h-5"/>ذخیره نهایی</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Partial Payment Modal ══ */}
      {showPayModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-fade-in" onClick={()=>setShowPayModal(null)}>
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="p-5 border-b bg-green-50 flex justify-between items-center">
              <h3 className="font-black text-lg text-green-900 flex items-center gap-2"><IconMoney className="w-5 h-5"/>ثبت پرداخت مرحله‌ای</h3>
              <button onClick={()=>setShowPayModal(null)} className="p-2 hover:bg-green-100 rounded-full">✕</button>
            </div>
            <div className="p-7 space-y-5">
              <div className="text-sm font-bold text-gray-700">{showPayModal.title}</div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2 text-xs font-bold">
                <div className="flex justify-between"><span className="text-gray-500">مبلغ کل:</span><span>{fmtNum(showPayModal.amount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">پرداخت‌شده:</span><span className="text-green-600">{fmtNum(showPayModal.paidAmount||0)}</span></div>
                <div className="flex justify-between border-t pt-2 text-sm">
                  <span className="text-gray-700">باقیمانده:</span>
                  <span className="text-rose-600">{fmtNum(showPayModal.amount-(showPayModal.paidAmount||0))} {showPayModal.currency}</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">مبلغ پرداختی جدید</label>
                <input type="text" autoFocus
                  className="w-full px-4 py-4 rounded-xl border-2 border-green-100 outline-none focus:border-green-500 font-black text-2xl text-green-600 dir-ltr text-center"
                  value={dispPaidAmt} onChange={e=>setDispPaidAmt(fmtInput(e.target.value))} placeholder="0"/>
              </div>
            </div>
            <div className="p-5 bg-gray-50 flex gap-3">
              <button onClick={()=>setShowPayModal(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-white rounded-xl">انصراف</button>
              <button onClick={savePay} disabled={isSubmitting||!dispPaidAmt}
                className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 flex justify-center items-center gap-2">
                {isSubmitting?<IconRefreshCw className="w-5 h-5 animate-spin"/>:<><IconCheck className="w-5 h-5"/>ثبت پرداخت</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Income Partial Receipt Modal ══ */}
      {showIncPayModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-fade-in" onClick={()=>setShowIncPayModal(null)}>
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="p-5 border-b bg-emerald-50 flex justify-between items-center">
              <h3 className="font-black text-lg text-emerald-900 flex items-center gap-2">
                <IconMoney className="w-5 h-5"/> ثبت دریافت مرحله‌ای
              </h3>
              <button onClick={()=>setShowIncPayModal(null)} className="p-2 hover:bg-emerald-100 rounded-full">✕</button>
            </div>
            <div className="p-7 space-y-5">
              {/* contract summary */}
              <div>
                <div className="text-sm font-bold text-gray-800">{showIncPayModal.customerName}</div>
                <div className="text-xs text-gray-400 mt-0.5">{incCatLabel(showIncPayModal.serviceTitle||'')}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-500">مبلغ قرارداد / فاکتور:</span>
                  <span className="text-gray-800 dir-ltr">{fmtNum(showIncPayModal.saleAmount)} {showIncPayModal.currency}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-500">دریافت‌شده تاکنون:</span>
                  <span className="text-emerald-700 dir-ltr">{fmtNum(showIncPayModal.receivedAmount||0)} {showIncPayModal.currency}</span>
                </div>
                <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full"
                    style={{width:`${showIncPayModal.saleAmount>0?Math.min(100,((showIncPayModal.receivedAmount||0)/showIncPayModal.saleAmount)*100):0}%`}}/>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-emerald-200 pt-2">
                  <span className="text-gray-600">مانده دریافتنی:</span>
                  <span className="text-amber-600 dir-ltr">
                    {fmtNum(showIncPayModal.saleAmount - (showIncPayModal.receivedAmount||0))} {showIncPayModal.currency}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">
                  مبلغ دریافتی جدید
                </label>
                <input type="text" autoFocus
                  className="w-full px-4 py-4 rounded-xl border-2 border-emerald-100 outline-none focus:border-emerald-500 font-black text-2xl text-emerald-700 dir-ltr text-center"
                  value={dispIncNewReceipt}
                  onChange={e=>setDispIncNewReceipt(fmtInput(e.target.value))}
                  placeholder="0"/>
                {(() => { const a=parseAmt(dispIncNewReceipt); const h=convHint(a,showIncPayModal.currency||'IRR'); if(!a)return null; return (
                  <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                    {h.omr&&<span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">≈ {h.omr}</span>}
                    {h.usd&&<span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">≈ {h.usd}</span>}
                    {h.irr&&<span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">≈ {h.irr}</span>}
                  </div>); })()}
                {/* preview of new state */}
                {(() => {
                  const added = parseAmt(dispIncNewReceipt);
                  if (!added) return null;
                  const newRecv = (showIncPayModal.receivedAmount||0) + added;
                  const remaining = showIncPayModal.saleAmount - newRecv;
                  const newStatus = calcIncStatus(showIncPayModal.saleAmount, newRecv);
                  return (
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
                      <div className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">پیش‌نمایش پس از ثبت</div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{width:`${Math.min(100,showIncPayModal.saleAmount>0?(newRecv/showIncPayModal.saleAmount)*100:0)}%`}}/>
                      </div>
                      <div className="flex justify-between text-[10px] font-black mt-1">
                        <span className={`${incStatusBadge(newStatus)} px-2 py-0.5 rounded-full`}>{incStatusLabel(newStatus)}</span>
                        {remaining > 0
                          ? <span className="text-amber-600">مانده: {fmtNum(remaining)}</span>
                          : <span className="text-emerald-600 font-black">تسویه کامل ✓</span>
                        }
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="p-5 bg-gray-50 flex gap-3">
              <button onClick={()=>setShowIncPayModal(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-white rounded-xl">انصراف</button>
              <button onClick={saveIncPay} disabled={isSubmitting||!dispIncNewReceipt}
                className="flex-1 py-3 bg-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 flex justify-center items-center gap-2">
                {isSubmitting?<IconRefreshCw className="w-5 h-5 animate-spin"/>:<><IconCheck className="w-5 h-5"/>ثبت دریافت</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
