
import React, { useState, useEffect } from 'react';
import { Personnel, SalesRecord, ServiceOption, Currency } from '../types';
import { IconMoney, IconPlus, IconChart, IconUsers, IconTrophy, IconPercent, IconEdit, IconCheck, IconSearch, IconBriefcase, IconCalendar, IconRefreshCw, IconTrash, IconWallet } from './Icons';
import { saveSalesRecord, subscribeToSalesRecords, updateSalesRecord, savePersonnelToCloud, saveServicesToCloud, deleteSalesRecord, subscribeToFxRates } from '../services/firebaseService';
import { Language } from '../App';

interface Props {
  currentUser: Personnel;
  personnel: Personnel[];
  services: ServiceOption[];
  onUpdatePersonnel: (personnel: Personnel[]) => void;
  onUpdateServices: (services: ServiceOption[]) => void;
  lang: Language;
}

export const SalesDashboard: React.FC<Props> = ({ currentUser, personnel, services, onUpdatePersonnel, onUpdateServices, lang }) => {
  const [activeTab, setActiveTab] = useState<'new_sale' | 'my_sales' | 'all_sales' | 'commissions' | 'leaderboard'>('my_sales');
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [currentRates, setCurrentRates] = useState<{ USD_IRR: number; OMR_IRR: number }>({ USD_IRR: 600000, OMR_IRR: 1560000 });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const SALES_PER_PAGE = 10;

  // Filtering States
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [filterUserId, setFilterUserId] = useState<string>('');

  const isMaster = currentUser.username === 'master' || currentUser.roles.includes('مدیر');
  
  // New Sale Form State
  const [newSale, setNewSale] = useState({
      serviceId: '',
      salespersonId: currentUser.id,
      customerName: '',
      amount: '',
      currency: 'IRR' as Currency,
      depositAccount: '',
      depositDate: new Date().toISOString().split('T')[0],
      notes: ''
  });

  // Commission Settings State (Master Only)
  const [selectedUserForCommission, setSelectedUserForCommission] = useState<string>('');
  
  // Edit Sales State (Master Only)
  const [editingSale, setEditingSale] = useState<SalesRecord | null>(null);

  const t = {
      fa: {
          header: 'مدیریت فروش و کمیسیون',
          sub: 'ثبت تراکنش‌ها، محاسبه کمیسیون و گزارش‌گیری',
          tabs: {
              new: 'ثبت فروش جدید',
              my: 'فروش‌های من',
              all: 'کل فروش‌ها',
              settings: 'تنظیمات کمیسیون',
              top: 'برترین‌ها'
          },
          form: {
              salesperson: 'فروشنده',
              service: 'خدمت فروخته شده',
              customer: 'نام مشتری',
              amount: 'مبلغ واریزی',
              currency: 'ارز',
              account: 'حساب مقصد',
              date: 'تاریخ واریز',
              notes: 'توضیحات (اختیاری)',
              submit: 'ثبت نهایی فروش',
              calcCommission: 'کمیسیون تخمینی:',
              success: 'فروش با موفقیت ثبت شد.'
          },
          table: {
              row: 'ردیف',
              seller: 'فروشنده',
              service: 'سرویس',
              customer: 'مشتری',
              amount: 'مبلغ',
              commission: 'سهم فروشنده',
              date: 'تاریخ',
              status: 'وضعیت تسویه',
              actions: 'عملیات',
              edit: 'ویرایش',
              save: 'ذخیره',
              cancel: 'لغو',
              paid: 'تسویه شده',
              pending: 'در انتظار پرداخت',
              markPaid: 'تغییر وضعیت تسویه',
              prev: 'قبلی',
              next: 'بعدی'
          },
          settings: {
              selectUser: 'انتخاب فروشنده جهت تنظیم درصد',
              baseRate: 'درصد پایه سرویس',
              userRate: 'درصد اختصاصی کاربر',
              update: 'بروزرسانی درصدها'
          },
          stats: {
              totalSales: 'فروش کل',
              totalCommission: 'کمیسیون کل',
              paidComm: 'پرداخت شده',
              pendingComm: 'باقیمانده',
              count: 'تعداد',
              period: 'دوره زمانی',
              filterUser: 'فیلتر کارشناس'
          },
          leaderboard: {
              title: 'برترین‌های فروش (بر اساس سودآوری)',
              profit: 'سود خالص شرکت:',
              sales: 'فروش ناخالص:'
          }
      },
      en: {
          header: 'Sales & Commission Management',
          sub: 'Record transactions, calculate commissions, and reporting',
          tabs: {
              new: 'New Sale',
              my: 'My Sales',
              all: 'All Sales',
              settings: 'Commission Settings',
              top: 'Leaderboard'
          },
          form: {
              salesperson: 'Salesperson',
              service: 'Sold Service',
              customer: 'Customer Name',
              amount: 'Amount',
              currency: 'Currency',
              account: 'Deposit Account',
              date: 'Deposit Date',
              notes: 'Notes (Optional)',
              submit: 'Submit Sale',
              calcCommission: 'Est. Commission:',
              success: 'Sale recorded successfully.'
          },
          table: {
              row: '#',
              seller: 'Seller',
              service: 'Service',
              customer: 'Customer',
              amount: 'Amount',
              commission: 'Commission',
              date: 'Date',
              status: 'Payment Status',
              actions: 'Actions',
              edit: 'Edit',
              save: 'Save',
              cancel: 'Cancel',
              paid: 'Paid',
              pending: 'Pending',
              markPaid: 'Toggle Payment Status',
              prev: 'Prev',
              next: 'Next'
          },
          stats: {
              totalSales: 'Total Sales',
              totalCommission: 'Total Commission',
              paidComm: 'Paid Comm.',
              pendingComm: 'Pending Comm.',
              count: 'Count',
              period: 'Time Period',
              filterUser: 'Filter Agent'
          },
          leaderboard: {
              title: 'Top Performers (By Company Profit)',
              profit: 'Company Net Profit:',
              sales: 'Gross Sales:'
          }
      }
  }[lang];

  useEffect(() => {
      const unsub = subscribeToSalesRecords(setSalesRecords);
      return () => unsub();
  }, []);

  useEffect(() => {
      const unsub = subscribeToFxRates(setCurrentRates);
      return () => unsub();
  }, []);

  // Reset page when tab or filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [activeTab, selectedMonth, filterUserId]);

  // Filter sales personnel
  const salesPersonnel = personnel.filter(p => 
      p.roles.some(r => r.includes('فروش') || r.toLowerCase().includes('sales')) || p.username === 'master'
  );

  const getCommissionRate = (userId: string, serviceIdOrSubId: string): number => {
      let service = services.find(s => s.id === serviceIdOrSubId);
      if (!service) {
          service = services.find(s => s.subServices?.some(sub => sub.id === serviceIdOrSubId));
      }
      const user = personnel.find(p => p.id === userId);
      if (!service) return 0;
      if (user?.customCommissions && user.customCommissions[service.id] !== undefined) {
          return user.customCommissions[service.id];
      }
      if (service.defaultCommission !== undefined) {
          return service.defaultCommission;
      }
      return 0;
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newSale.amount || !newSale.serviceId || !newSale.customerName) return;

      const amount = parseFloat(newSale.amount.replace(/,/g, ''));
      const rate = getCommissionRate(newSale.salespersonId, newSale.serviceId);
      const commission = (amount * rate) / 100;
      
      const salesperson = personnel.find(p => p.id === newSale.salespersonId);
      
      let serviceTitle = 'Unknown';
      const mainService = services.find(s => s.id === newSale.serviceId);
      
      if (mainService) {
          serviceTitle = mainService.title;
      } else {
          for (const s of services) {
              const sub = s.subServices?.find(sub => sub.id === newSale.serviceId);
              if (sub) {
                  serviceTitle = `${s.title} - ${sub.title}`;
                  break;
              }
          }
      }

      const record: SalesRecord = {
          id: `sale-${Date.now()}`,
          salespersonId: newSale.salespersonId,
          salespersonName: salesperson?.fullName || 'Unknown',
          serviceId: newSale.serviceId,
          serviceTitle: serviceTitle,
          customerName: newSale.customerName,
          saleAmount: amount,
          currency: newSale.currency,
          commissionRate: rate,
          commissionAmount: commission,
          commissionPaid: false,
          depositAccount: newSale.depositAccount,
          depositDate: newSale.depositDate,
          notes: newSale.notes,
          snapshotRates: { USD_IRR: currentRates.USD_IRR, OMR_IRR: currentRates.OMR_IRR },
          createdAt: new Date().toISOString()
      };

      await saveSalesRecord(record);
      alert(t.form.success);
      setNewSale({ ...newSale, amount: '', customerName: '', notes: '' });
      setActiveTab('my_sales');
  };

  const toggleCommissionPaid = async (sale: SalesRecord) => {
      if (!isMaster) return;
      const newState = !sale.commissionPaid;
      await updateSalesRecord(sale.id, { commissionPaid: newState }, currentUser.fullName);
  };

  const handleUpdateCommission = (serviceId: string, newRate: number) => {
      if (!selectedUserForCommission) return; 
      const updatedPersonnel = personnel.map(p => {
          if (p.id === selectedUserForCommission) {
              return {
                  ...p,
                  customCommissions: {
                      ...p.customCommissions,
                      [serviceId]: newRate
                  }
              };
          }
          return p;
      });
      onUpdatePersonnel(updatedPersonnel);
  };

  const handleUpdateServiceDefault = (serviceId: string, newRate: number) => {
      const updatedServices = services.map(s => 
          s.id === serviceId ? { ...s, defaultCommission: newRate } : s
      );
      onUpdateServices(updatedServices);
  };

  const handleEditSale = async () => {
      if (!editingSale) return;
      await updateSalesRecord(editingSale.id, editingSale, currentUser.fullName);
      setEditingSale(null);
  };

  const handleDeleteSale = async (id: string) => {
      if (window.confirm(lang === 'fa' ? 'آیا از حذف این رکورد اطمینان دارید؟' : 'Are you sure you want to delete this record?')) {
          await deleteSalesRecord(id, currentUser.fullName);
      }
  };

  const toOMR = (amount: number, currency: Currency, record: SalesRecord): number => {
      const r = record.snapshotRates || currentRates;
      let irr: number;
      if (currency === 'OMR') return amount;
      if (currency === 'USD') irr = amount * r.USD_IRR;
      else irr = amount;
      return r.OMR_IRR > 0 ? irr / r.OMR_IRR : 0;
  };

  const formatOMR = (num: number) => num.toLocaleString(undefined, { maximumFractionDigits: 3 });
  const formatNumber = (num: number) => num.toLocaleString();

  const handleAmountInput = (val: string) => {
      let normalized = val.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                          .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
      normalized = normalized.replace(/\D/g, '');
      return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // --- Filtering & Pagination Logic ---
  const getFilteredRecords = () => {
      let records = salesRecords;

      // 1. Tab Filter & User Permission
      if (activeTab === 'my_sales') {
          records = records.filter(r => r.salespersonId === currentUser.id);
      } else if (activeTab === 'all_sales') {
          // If Master/Admin selects a user, filter by that user
          if (filterUserId) {
              records = records.filter(r => r.salespersonId === filterUserId);
          }
      }

      // 2. Date Filter (Month)
      if (selectedMonth) {
          records = records.filter(r => r.depositDate.startsWith(selectedMonth));
      }

      return records;
  };

  const filteredSales = getFilteredRecords();
  const totalPages = Math.ceil(filteredSales.length / SALES_PER_PAGE);
  const displaySales = filteredSales.slice((currentPage - 1) * SALES_PER_PAGE, currentPage * SALES_PER_PAGE);

  const calculateStats = (records: SalesRecord[]) => ({
      totalSales: records.reduce((acc, r) => acc + toOMR(r.saleAmount, r.currency, r), 0),
      totalCommission: records.reduce((acc, r) => acc + toOMR(r.commissionAmount, r.currency, r), 0),
      paidCommission: records.filter(r => r.commissionPaid).reduce((acc, r) => acc + toOMR(r.commissionAmount, r.currency, r), 0),
      pendingCommission: records.filter(r => !r.commissionPaid).reduce((acc, r) => acc + toOMR(r.commissionAmount, r.currency, r), 0),
      count: records.length
  });

  const stats = calculateStats(filteredSales);

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm gap-4">
            <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <div className="bg-green-100 text-green-600 p-2 rounded-lg"><IconMoney className="w-6 h-6" /></div>
                    {t.header}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{t.sub}</p>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full">
                <button onClick={() => setActiveTab('new_sale')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'new_sale' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>{t.tabs.new}</button>
                <button onClick={() => setActiveTab('my_sales')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'my_sales' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>{t.tabs.my}</button>
                {isMaster && (
                    <>
                        <button onClick={() => setActiveTab('all_sales')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'all_sales' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>{t.tabs.all}</button>
                        <button onClick={() => setActiveTab('commissions')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'commissions' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>{t.tabs.settings}</button>
                    </>
                )}
                <button onClick={() => setActiveTab('leaderboard')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'leaderboard' ? 'bg-white shadow text-amber-600' : 'text-gray-500'}`}>{t.tabs.top}</button>
            </div>
        </div>

        {/* Filters */}
        {(activeTab === 'my_sales' || activeTab === 'all_sales' || activeTab === 'leaderboard') && (
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 flex items-center gap-2 shadow-sm">
                    <IconCalendar className="w-5 h-5 text-gray-400" />
                    <label className="text-xs font-bold text-gray-500 whitespace-nowrap">{t.stats.period}:</label>
                    <input 
                        type="month" 
                        className="outline-none text-sm font-bold text-gray-800 bg-transparent"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                    {selectedMonth && <button onClick={() => setSelectedMonth('')} className="text-red-400 hover:text-red-600 ml-2"><IconRefreshCw className="w-3 h-3" /></button>}
                </div>

                {isMaster && activeTab === 'all_sales' && (
                    <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 flex items-center gap-2 shadow-sm">
                        <IconUsers className="w-5 h-5 text-gray-400" />
                        <label className="text-xs font-bold text-gray-500 whitespace-nowrap">{t.stats.filterUser}:</label>
                        <select 
                            className="outline-none text-sm font-bold text-gray-800 bg-transparent min-w-[150px]"
                            value={filterUserId}
                            onChange={(e) => setFilterUserId(e.target.value)}
                        >
                            <option value="">-- همه --</option>
                            {salesPersonnel.map(p => (
                                <option key={p.id} value={p.id}>{p.fullName}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        )}

        {/* Stats Cards */}
        {(activeTab === 'my_sales' || activeTab === 'all_sales') && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="text-gray-500 text-xs font-bold mb-1">{t.stats.totalSales}</div>
                    <div className="text-xl font-black text-gray-800">{formatOMR(stats.totalSales)} <span className="text-xs font-normal text-gray-400">OMR</span></div>
                </div>
                <div className="bg-green-50 p-5 rounded-2xl border border-green-100 shadow-sm">
                    <div className="text-green-700 text-xs font-bold mb-1">{t.stats.paidComm}</div>
                    <div className="text-xl font-black text-green-600">{formatOMR(stats.paidCommission)} <span className="text-xs font-normal text-gray-400">OMR</span></div>
                </div>
                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 shadow-sm">
                    <div className="text-amber-700 text-xs font-bold mb-1">{t.stats.pendingComm}</div>
                    <div className="text-xl font-black text-amber-600">{formatOMR(stats.pendingCommission)} <span className="text-xs font-normal text-gray-400">OMR</span></div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="text-gray-500 text-xs font-bold mb-1">{t.stats.count}</div>
                    <div className="text-xl font-black text-indigo-600">{stats.count}</div>
                </div>
            </div>
        )}

        {/* New Sale Form */}
        {activeTab === 'new_sale' && (
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm max-w-3xl mx-auto">
                <form onSubmit={handleSaleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t.form.salesperson}</label>
                            <select 
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 outline-none focus:ring-2 focus:ring-green-500"
                                value={newSale.salespersonId}
                                onChange={(e) => setNewSale({...newSale, salespersonId: e.target.value})}
                                disabled={!isMaster}
                            >
                                {salesPersonnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t.form.service}</label>
                            <select 
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white outline-none focus:ring-2 focus:ring-green-500"
                                value={newSale.serviceId}
                                onChange={(e) => setNewSale({...newSale, serviceId: e.target.value})}
                                required
                            >
                                <option value="">- انتخاب کنید -</option>
                                {services.filter(s => s.isActive !== false).map(s => (
                                    <React.Fragment key={s.id}>
                                        <option value={s.id} className="font-bold text-gray-900">
                                            {s.title}
                                        </option>
                                        {s.subServices?.map(sub => (
                                            <option key={sub.id} value={sub.id} className="text-gray-600">
                                                &nbsp;&nbsp;&nbsp;↳ {sub.title}
                                            </option>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t.form.customer}</label>
                            <input 
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-green-500"
                                value={newSale.customerName}
                                onChange={(e) => setNewSale({...newSale, customerName: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t.form.amount}</label>
                            <div className="flex gap-2">
                                <input 
                                    className="flex-grow px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-green-500 dir-ltr text-right"
                                    value={newSale.amount}
                                    onChange={(e) => setNewSale({...newSale, amount: handleAmountInput(e.target.value)})}
                                    placeholder="0"
                                    required
                                />
                                <select 
                                    className="w-24 px-2 rounded-xl border border-gray-300 bg-white outline-none"
                                    value={newSale.currency}
                                    onChange={(e) => setNewSale({...newSale, currency: e.target.value as Currency})}
                                >
                                    <option value="IRR">IRR</option>
                                    <option value="USD">USD</option>
                                    <option value="OMR">OMR</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t.form.account}</label>
                            <input 
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-green-500"
                                value={newSale.depositAccount}
                                onChange={(e) => setNewSale({...newSale, depositAccount: e.target.value})}
                                placeholder="شماره کارت / حساب"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t.form.date}</label>
                            <input 
                                type="date"
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-green-500"
                                value={newSale.depositDate}
                                onChange={(e) => setNewSale({...newSale, depositDate: e.target.value})}
                                required
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t.form.notes}</label>
                            <textarea 
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-green-500"
                                rows={2}
                                value={newSale.notes}
                                onChange={(e) => setNewSale({...newSale, notes: e.target.value})}
                            />
                        </div>
                    </div>

                    {newSale.amount && newSale.serviceId && (
                        <div className="bg-green-50 p-4 rounded-xl flex justify-between items-center text-green-800 border border-green-100">
                            <span className="font-bold">{t.form.calcCommission}</span>
                            <span className="font-black text-xl">
                                {formatNumber( (parseFloat(newSale.amount.replace(/,/g, '')) * getCommissionRate(newSale.salespersonId, newSale.serviceId)) / 100 )} {newSale.currency}
                                <span className="text-xs mr-2 font-normal opacity-70">({getCommissionRate(newSale.salespersonId, newSale.serviceId)}%)</span>
                            </span>
                        </div>
                    )}

                    <div className="flex justify-end pt-4">
                        <button type="submit" className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-2">
                            <IconCheck className="w-5 h-5" /> {t.form.submit}
                        </button>
                    </div>
                </form>
            </div>
        )}

        {/* Sales Table with Row Numbers & Pagination */}
        {(activeTab === 'my_sales' || activeTab === 'all_sales') && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 text-gray-600 text-sm">
                            <tr>
                                <th className="px-4 py-4 text-center w-12">{t.table.row}</th>
                                <th className="px-6 py-4">{t.table.seller}</th>
                                <th className="px-6 py-4">{t.table.customer}</th>
                                <th className="px-6 py-4">{t.table.service}</th>
                                <th className="px-6 py-4">{t.table.amount}</th>
                                <th className="px-6 py-4">{t.table.commission}</th>
                                <th className="px-6 py-4">{t.table.status}</th>
                                <th className="px-6 py-4 text-center">{t.table.actions}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {displaySales.map((sale, index) => (
                                <tr key={sale.id} className={`transition-colors ${sale.commissionPaid ? 'bg-green-50/40 hover:bg-green-50/60' : 'hover:bg-gray-50'}`}>
                                    <td className="px-4 py-4 text-center text-xs font-bold text-gray-400">
                                        {filteredSales.length - ((currentPage - 1) * SALES_PER_PAGE + index)}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-800 text-sm">{sale.salespersonName}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{sale.customerName}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{sale.serviceTitle}</td>
                                    <td className="px-6 py-4 font-bold text-gray-800">
                                        {formatOMR(toOMR(sale.saleAmount, sale.currency, sale))} <span className="text-xs font-normal text-gray-400">OMR</span>
                                        <div className="text-[10px] text-gray-400">{formatNumber(sale.saleAmount)} {sale.currency}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className={`font-bold ${sale.commissionPaid ? 'text-green-600' : 'text-amber-600'}`}>{formatOMR(toOMR(sale.commissionAmount, sale.currency, sale))} <span className="text-[10px] font-normal text-gray-400">OMR</span></span>
                                            <span className="text-[10px] text-gray-400">({sale.commissionRate}%)</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${sale.commissionPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {sale.commissionPaid ? t.table.paid : t.table.pending}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2 justify-center">
                                            {isMaster && (
                                                <button 
                                                    onClick={() => toggleCommissionPaid(sale)} 
                                                    className={`p-2 rounded-lg transition-all ${sale.commissionPaid ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600'}`}
                                                    title={t.table.markPaid}
                                                >
                                                    <IconWallet className="w-4 h-4" />
                                                </button>
                                            )}
                                            {isMaster && (
                                                <>
                                                    <button onClick={() => setEditingSale(sale)} className="p-2 text-blue-500 hover:text-blue-700 bg-blue-50 rounded-lg transition-colors">
                                                        <IconEdit className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteSale(sale.id)} className="p-2 text-red-500 hover:text-red-700 bg-red-50 rounded-lg transition-colors">
                                                        <IconTrash className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {displaySales.length === 0 && (
                                <tr><td colSpan={8} className="text-center py-8 text-gray-400">موردی یافت نشد.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center p-4 border-t border-gray-100 gap-4">
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                            disabled={currentPage === 1} 
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                        >
                            {t.table.prev}
                        </button>
                        <span className="text-sm text-gray-600 font-medium">{currentPage} / {totalPages}</span>
                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                            disabled={currentPage === totalPages} 
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                        >
                            {t.table.next}
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* Master Editing Modal */}
        {editingSale && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
                    <h3 className="font-bold text-lg mb-4 text-gray-800">ویرایش رکورد فروش</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">مبلغ فروش</label>
                            <input 
                                className="w-full border rounded p-2" 
                                value={editingSale.saleAmount} 
                                type="number"
                                onChange={e => setEditingSale({...editingSale, saleAmount: parseFloat(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">درصد کمیسیون (%)</label>
                            <input 
                                className="w-full border rounded p-2" 
                                value={editingSale.commissionRate} 
                                type="number"
                                onChange={e => {
                                    const rate = parseFloat(e.target.value);
                                    setEditingSale({...editingSale, commissionRate: rate, commissionAmount: (editingSale.saleAmount * rate) / 100});
                                }}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">مبلغ کمیسیون (محاسبه شده)</label>
                            <input 
                                className="w-full border rounded p-2 bg-gray-50" 
                                value={editingSale.commissionAmount} 
                                readOnly
                            />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                             <input type="checkbox" id="edit_paid" checked={editingSale.commissionPaid} onChange={e => setEditingSale({...editingSale, commissionPaid: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" />
                             <label htmlFor="edit_paid" className="text-sm font-bold text-gray-700">کمیسیون پرداخت شده است</label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setEditingSale(null)} className="px-4 py-2 bg-gray-100 rounded text-gray-600">لغو</button>
                        <button onClick={handleEditSale} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">ذخیره</button>
                    </div>
                </div>
            </div>
        )}

        {/* Commission Settings (Master) */}
        {activeTab === 'commissions' && isMaster && (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <label className="block text-sm font-bold text-gray-700 mb-3">{t.settings.selectUser}</label>
                    <select 
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={selectedUserForCommission}
                        onChange={(e) => setSelectedUserForCommission(e.target.value)}
                    >
                        <option value="">-- تنظیم پیش‌فرض سرویس‌ها (همه) --</option>
                        {salesPersonnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                    </select>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700 flex items-center gap-2">
                        <IconPercent className="w-5 h-5 text-indigo-500" />
                        {selectedUserForCommission 
                            ? `تنظیم درصد اختصاصی برای: ${personnel.find(p=>p.id===selectedUserForCommission)?.fullName}` 
                            : 'تنظیم درصد پایه سرویس‌ها (پیش‌فرض سیستم)'}
                    </div>
                    <div className="divide-y divide-gray-100">
                        {services.map(service => {
                            const user = personnel.find(p => p.id === selectedUserForCommission);
                            const currentVal = selectedUserForCommission 
                                ? (user?.customCommissions?.[service.id] ?? service.defaultCommission ?? 0)
                                : (service.defaultCommission ?? 0);

                            return (
                                <div key={service.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{service.icon}</span>
                                        <div>
                                            <div className="font-bold text-gray-800">{service.title}</div>
                                            <div className="text-xs text-gray-500">پیش‌فرض سیستم: {service.defaultCommission || 0}%</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            className="w-20 px-2 py-1 border rounded text-center font-bold outline-none focus:border-indigo-500"
                                            value={currentVal}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if(selectedUserForCommission) handleUpdateCommission(service.id, val);
                                                else handleUpdateServiceDefault(service.id, val);
                                            }}
                                        />
                                        <span className="text-gray-500">%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}

        {/* Leaderboard */}
        {activeTab === 'leaderboard' && (
            <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                <IconTrophy className="absolute top-10 left-10 w-64 h-64 text-white opacity-5 rotate-12" />
                <h3 className="text-2xl font-black mb-8 relative z-10 text-center text-yellow-400 drop-shadow-md">{t.leaderboard.title}</h3>
                
                <div className="space-y-4 relative z-10 max-w-2xl mx-auto">
                    {salesPersonnel.map(person => {
                        // Apply month filter to leaderboard calculation
                        const personSales = salesRecords.filter(r => 
                            r.salespersonId === person.id && 
                            (!selectedMonth || r.depositDate.startsWith(selectedMonth))
                        );
                        
                        const totalSales = personSales.reduce((acc, r) => acc + toOMR(r.saleAmount, r.currency, r), 0);
                        const companyProfit = personSales.reduce((acc, r) => acc + toOMR(r.saleAmount - r.commissionAmount, r.currency, r), 0);
                        
                        return { ...person, totalSales, companyProfit };
                    })
                    // Sort based on COMPANY PROFIT (Highest Profit First)
                    .sort((a, b) => b.companyProfit - a.companyProfit)
                    .map((p, idx) => (
                        <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl border border-white/10 backdrop-blur-md ${idx === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-400/30' : 'bg-white/5'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xl ${idx === 0 ? 'bg-yellow-400 text-indigo-900' : (idx === 1 ? 'bg-gray-300 text-gray-800' : (idx === 2 ? 'bg-orange-400 text-white' : 'bg-white/10 text-white'))}`}>
                                    {idx + 1}
                                </div>
                                <div>
                                    <div className="font-bold text-lg">{p.fullName}</div>
                                    <div className="text-xs opacity-70">{p.roles.join(', ')}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-mono font-bold text-xl text-green-300" title={t.leaderboard.profit}>
                                    {formatOMR(p.companyProfit)} <span className="text-xs opacity-50">OMR</span>
                                </div>
                                <div className="text-[10px] opacity-60 mt-1" title={t.leaderboard.sales}>
                                    {t.leaderboard.sales} {formatOMR(p.totalSales)} OMR
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
  );
};
