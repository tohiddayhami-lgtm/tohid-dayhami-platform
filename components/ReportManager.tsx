
import React, { useState, useEffect, useMemo } from 'react';
import { PerformanceReport, Personnel, ReportType } from '../types';
import { IconClipboard, IconPlus, IconCheck, IconSearch, IconTrash, IconAward, IconList, IconEdit, IconLock } from './Icons';
import { saveReport, updateReport, subscribeToReports, saveAppConfigToCloud } from '../services/firebaseService';
import { Language } from '../App';

interface Props {
  currentUser: Personnel;
  personnel: Personnel[];
  lang: Language;
  config: any;
}

export const ReportManager: React.FC<Props> = ({ currentUser, personnel, lang, config }) => {
  const [activeTab, setActiveTab] = useState<ReportType>('daily');
  const [reports, setReports] = useState<PerformanceReport[]>([]);
  const [filterUserId, setFilterUserId] = useState<string>(currentUser.id);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form State
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [tempTasks, setTempTasks] = useState<string[]>([]);
  const [currentTask, setCurrentTask] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  const isMaster = currentUser.username === 'master';
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const unsub = subscribeToReports(setReports);
    return () => unsub();
  }, []);

  const t = {
    fa: {
      header: 'سامانه گزارش‌دهی عملکرد',
      sub: 'ثبت فعالیت‌ها به صورت خطی و تجمیع هوشمند',
      tabs: { daily: 'گزارش روزانه', weekly: 'گزارش هفتگی', monthly: 'گزارش ماهانه' },
      new: 'ثبت گزارش عملکرد',
      edit: 'ویرایش گزارش',
      filterUser: 'مشاهده گزارش‌های:',
      tasks: 'لیست فعالیت‌های انجام شده (گزارش خطی)',
      addTask: 'افزودن سطر',
      content: 'توضیحات و موانع اجرایی',
      save: 'تایید و ثبت نهایی',
      update: 'بروزرسانی تغییرات',
      cancel: 'انصراف',
      empty: 'هنوز گزارشی برای این کاربر ثبت نشده است.',
      topPerformer: 'انتخاب به عنوان کارمند نمونه',
      isTop: 'کارمند نمونه منتخب',
      currentTop: 'کارمند نمونه فعلی',
      removeTop: 'حذف انتخاب',
      itemPlaceholder: 'مثلاً: پیگیری تیکت شماره ۱۲۴ یا جلسه با مشتری...',
      date: 'تاریخ گزارش',
      locked: 'زمان ویرایش پایان یافته'
    },
    en: {
      header: 'Performance Reporting',
      sub: 'Linear activity logging and smart aggregation',
      tabs: { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' },
      new: 'Add Performance Report',
      edit: 'Edit Report',
      filterUser: 'View reports for:',
      tasks: 'Activity List (Linear Report)',
      addTask: 'Add Line',
      content: 'Notes & Blockers',
      save: 'Submit Report',
      update: 'Update Report',
      cancel: 'Cancel',
      empty: 'No reports found for this user.',
      topPerformer: 'Set as Top Performer',
      isTop: 'Selected Top Performer',
      currentTop: 'Top Performer',
      removeTop: 'Clear Selection',
      itemPlaceholder: 'e.g., Followed up on Ticket #124...',
      date: 'Report Date',
      locked: 'Editing Period Ended'
    }
  }[lang];

  const filteredReports = useMemo(() => {
    return reports.filter(r => r.userId === filterUserId && r.type === activeTab);
  }, [reports, filterUserId, activeTab]);

  const handleAddTask = () => {
    if (!currentTask.trim()) return;
    setTempTasks([...tempTasks, currentTask.trim()]);
    setCurrentTask('');
  };

  const handleOpenEdit = (report: PerformanceReport) => {
      setEditingReportId(report.id);
      setNewContent(report.content);
      setTempTasks(report.completedTasks);
      setReportDate(report.date);
      setShowAddModal(true);
  };

  const handleSaveReport = async () => {
    if (tempTasks.length === 0 && !newContent.trim()) return;

    if (editingReportId) {
        await updateReport(editingReportId, {
            content: newContent,
            completedTasks: tempTasks,
            date: reportDate,
            updatedAt: new Date().toISOString()
        }, currentUser.fullName);
    } else {
        const report: PerformanceReport = {
            id: `rep-${Date.now()}`,
            userId: currentUser.id,
            userName: currentUser.fullName,
            type: activeTab,
            date: reportDate,
            content: newContent,
            completedTasks: tempTasks,
            status: 'submitted',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await saveReport(report);

        if (activeTab === 'daily') {
            const weekKey = getWeekKey(new Date(reportDate));
            const monthKey = reportDate.slice(0, 7);
            await autoUpdateAggregatedReport(weekKey, 'weekly', report);
            await autoUpdateAggregatedReport(monthKey, 'monthly', report);
        }
    }

    handleCloseModal();
  };

  const handleCloseModal = () => {
      setShowAddModal(false);
      setEditingReportId(null);
      setTempTasks([]);
      setNewContent('');
  };

  const getWeekKey = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return `${date.getFullYear()}-W${Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)}`;
  };

  const autoUpdateAggregatedReport = async (dateKey: string, type: ReportType, sourceDaily: PerformanceReport) => {
      const existing = reports.find(r => r.userId === currentUser.id && r.type === type && r.date === dateKey);
      const summaryText = `[${sourceDaily.date}]: ${sourceDaily.completedTasks.join(' | ')}`;
      
      if (existing) {
          const updatedTasks = [...existing.completedTasks, ...sourceDaily.completedTasks];
          const updatedContent = existing.content + "\n" + summaryText;
          await updateReport(existing.id, { 
              completedTasks: updatedTasks, 
              content: updatedContent,
              updatedAt: new Date().toISOString() 
          }, 'System');
      } else {
          const newAggReport: PerformanceReport = {
              id: `agg-${Date.now()}-${Math.random()}`,
              userId: currentUser.id,
              userName: currentUser.fullName,
              type,
              date: dateKey,
              content: `تجمیع خودکار:\n${summaryText}`,
              completedTasks: sourceDaily.completedTasks,
              status: 'submitted',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
          };
          await saveReport(newAggReport);
      }
  };

  const handleSetTopPerformer = async (userId: string) => {
    if (!isMaster) return;
    await saveAppConfigToCloud({ ...config, topPerformerId: userId });
    alert(lang === 'fa' ? 'کارمند نمونه با موفقیت تغییر یافت.' : 'Top performer updated successfully.');
  };

  const handleClearTopPerformer = async () => {
      if (!isMaster) return;
      await saveAppConfigToCloud({ ...config, topPerformerId: null });
      alert(lang === 'fa' ? 'انتخاب کارمند نمونه لغو شد.' : 'Top performer selection cleared.');
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm gap-4">
            <div className="flex items-center gap-4">
                <div className="bg-indigo-100 text-indigo-600 p-3 rounded-xl"><IconClipboard className="w-6 h-6" /></div>
                <div>
                    <h2 className="text-xl font-bold text-gray-800">{t.header}</h2>
                    <p className="text-sm text-gray-500">{t.sub}</p>
                </div>
            </div>
            <div className="flex gap-2">
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    {(['daily', 'weekly', 'monthly'] as ReportType[]).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>{t.tabs[tab]}</button>
                    ))}
                </div>
                <button onClick={() => { setEditingReportId(null); setShowAddModal(true); }} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-200">
                    <IconPlus className="w-5 h-5" /> {t.new}
                </button>
            </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <IconSearch className="w-5 h-5 text-gray-400" />
                <label className="text-sm font-bold text-gray-700">{t.filterUser}</label>
                <select 
                    className="outline-none bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                    value={filterUserId}
                    onChange={(e) => setFilterUserId(e.target.value)}
                >
                    {personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                </select>
            </div>
            {isMaster && config.topPerformerId && (
                <div className="flex items-center gap-3 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-100 text-sm font-bold">
                    <div className="flex items-center gap-2">
                        <IconAward className="w-4 h-4" />
                        {t.currentTop}: {personnel.find(p => p.id === config.topPerformerId)?.fullName}
                    </div>
                    <button onClick={handleClearTopPerformer} className="p-1 hover:bg-amber-200 rounded-full transition-colors text-amber-500 hover:text-amber-700" title={t.removeTop}>✕</button>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 gap-4">
            {filteredReports.map(report => {
                const isOwnReport = report.userId === currentUser.id;
                const isToday = report.date === todayStr;
                const canEdit = isMaster || (isOwnReport && isToday);

                return (
                    <div key={report.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">{report.userName.charAt(0)}</div>
                                <div>
                                    <div className="font-bold text-gray-900">{report.userName}</div>
                                    <div className="text-xs text-gray-400 font-mono">{report.date}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isMaster && (
                                    <button 
                                        onClick={() => handleSetTopPerformer(report.userId)} 
                                        className={`opacity-0 group-hover:opacity-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${config.topPerformerId === report.userId ? 'bg-amber-500 text-white shadow-sm' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                                    >
                                        <IconAward className="w-4 h-4" /> {config.topPerformerId === report.userId ? t.isTop : t.topPerformer}
                                    </button>
                                )}
                                
                                {canEdit ? (
                                    <button 
                                        onClick={() => handleOpenEdit(report)}
                                        className="opacity-0 group-hover:opacity-100 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all hover:bg-blue-200"
                                    >
                                        <IconEdit className="w-4 h-4" /> {t.edit}
                                    </button>
                                ) : (
                                    isOwnReport && (
                                        <span className="text-[10px] text-gray-300 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                                            <IconLock className="w-3 h-3" /> {t.locked}
                                        </span>
                                    )
                                )}
                                
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded">{new Date(report.createdAt).toLocaleTimeString()}</span>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-1"><IconList className="w-3 h-3" /> {t.tasks}</h4>
                                <div className="space-y-2">
                                    {report.completedTasks.map((task, i) => (
                                        <div key={i} className="flex items-center gap-3 text-sm text-gray-700 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                                            <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 font-bold text-[10px]">{i+1}</div>
                                            {task}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {report.content && (
                                <div className="pt-4 border-t border-gray-50">
                                    <h4 className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">{t.content}</h4>
                                    <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{report.content}</p>
                                </div>
                            )}
                            {report.updatedAt !== report.createdAt && (
                                <div className="text-[10px] text-gray-400 mt-2 italic">
                                    آخرین ویرایش: {new Date(report.updatedAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            {filteredReports.length === 0 && <div className="py-12 text-center text-gray-400 bg-white rounded-2xl border-2 border-dashed">{t.empty}</div>}
        </div>

        {/* Modal (Add/Edit) */}
        {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl animate-fade-in overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b border-gray-100 bg-indigo-50 flex justify-between items-center">
                        <h3 className="font-bold text-indigo-900 text-lg flex items-center gap-2">
                           {editingReportId ? <IconEdit className="w-5 h-5" /> : <IconPlus className="w-5 h-5" />}
                           {editingReportId ? t.edit : t.new} ({t.tabs[activeTab]})
                        </h3>
                        <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                    <div className="p-6 overflow-y-auto space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">{t.date}</label>
                                <input 
                                    type="date" 
                                    className="w-full border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400" 
                                    value={reportDate} 
                                    onChange={e => setReportDate(e.target.value)} 
                                    disabled={!isMaster && editingReportId !== null} // Only master can change date during edit
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <IconList className="w-4 h-4 text-indigo-600" />
                                {t.tasks}
                            </label>
                            <div className="space-y-2 mb-4">
                                {tempTasks.map((task, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-white p-3 rounded-xl border border-gray-200 shadow-sm group">
                                        <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">{i+1}</span>
                                        <span className="flex-grow text-sm text-gray-700">{task}</span>
                                        <button onClick={() => setTempTasks(tempTasks.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><IconTrash className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    className="flex-grow border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 bg-white" 
                                    placeholder={t.itemPlaceholder} 
                                    value={currentTask} 
                                    onChange={e => setCurrentTask(e.target.value)} 
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTask())}
                                />
                                <button onClick={handleAddTask} className="bg-indigo-600 text-white px-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">{t.addTask}</button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">{t.content}</label>
                            <textarea 
                                className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                                rows={3} 
                                value={newContent} 
                                onChange={e => setNewContent(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 border-t flex gap-3">
                        <button onClick={handleCloseModal} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">{t.cancel}</button>
                        <button onClick={handleSaveReport} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                            {editingReportId ? t.update : t.save}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
