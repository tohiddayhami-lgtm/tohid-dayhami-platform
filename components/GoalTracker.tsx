
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Personnel, UserGoals, GoalCategory, GoalTask, GoalPeriod, GoalSubTask } from '../types';
import { IconTarget, IconPlus, IconCheck, IconTrash, IconEdit, IconCalendar, IconChart, IconShield, IconBrain, IconArrowRight, IconActivity, IconBriefcase, IconUsers, IconPrinter, IconAward, IconTrendingUp, IconClock, IconStar, IconTrophy, IconList } from './Icons';
import { saveUserGoals, subscribeToUserGoals } from '../services/firebaseService';
import { Language } from '../App';
import * as htmlToImage from 'html-to-image';

interface Props {
  currentUser: Personnel;
  personnel: Personnel[];
  lang: Language;
}

const INITIAL_CATEGORIES = [
    { id: 'cat1', title: 'اهداف تجاری و مالی', color: 'bg-indigo-600', type: 'business' as const },
    { id: 'cat2', title: 'توسعه فردی و مهارت', color: 'bg-emerald-600', type: 'personal' as const },
    { id: 'cat3', title: 'سلامتی و سبک زندگی', color: 'bg-rose-500', type: 'personal' as const },
    { id: 'cat4', title: 'پروژه‌های استراتژیک', color: 'bg-blue-500', type: 'business' as const },
    { id: 'cat5', title: 'سایر اولویت‌ها', color: 'bg-slate-600', type: 'personal' as const }
];

export const GoalTracker: React.FC<Props> = ({ currentUser, personnel, lang }) => {
    const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
    const [activePeriod, setActivePeriod] = useState<GoalPeriod>('daily');
    const [currentUserGoals, setCurrentUserGoals] = useState<UserGoals | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    
    // States for Editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const posterRef = useRef<HTMLDivElement>(null);
    const isMaster = currentUser.username === 'master' || currentUser.roles.includes('مدیر');
    const canEdit = selectedUserId === currentUser.id;

    const selectedPerson = useMemo(() => personnel.find(p => p.id === selectedUserId), [personnel, selectedUserId]);

    useEffect(() => {
        setIsLoading(true);
        const unsub = subscribeToUserGoals(selectedUserId, activePeriod, (goals) => {
            if (goals) {
                setCurrentUserGoals(goals);
            } else {
                setCurrentUserGoals({
                    id: `${selectedUserId}_${activePeriod}`,
                    userId: selectedUserId,
                    userName: personnel.find(p => p.id === selectedUserId)?.fullName || 'User',
                    period: activePeriod,
                    lastUpdated: new Date().toISOString(),
                    categories: INITIAL_CATEGORIES.map(c => ({ ...c, tasks: [] }))
                });
            }
            setIsLoading(false);
        });
        return () => unsub();
    }, [selectedUserId, activePeriod, personnel]);

    const { activeView, historyView } = useMemo(() => {
        if (!currentUserGoals) return { activeView: [], historyView: [] };
        const history: (GoalTask & { categoryTitle: string, categoryColor: string })[] = [];
        const active = currentUserGoals.categories.map(cat => {
            const activeTasks = cat.tasks.filter(t => !t.isCompleted);
            const completedTasks = cat.tasks.filter(t => t.isCompleted);
            completedTasks.forEach(ct => {
                history.push({ ...ct, categoryTitle: cat.title, categoryColor: cat.color });
            });
            return { ...cat, tasks: activeTasks };
        });
        return { activeView: active, historyView: history };
    }, [currentUserGoals]);

    const stats = useMemo(() => {
        if (!currentUserGoals) return { done: 0, total: 0, percent: 0 };
        let done = 0, total = 0;
        currentUserGoals.categories.forEach(c => {
            c.tasks.forEach(t => {
                total++;
                if (t.isCompleted) done++;
            });
        });
        return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
    }, [currentUserGoals]);

    const t = {
        fa: {
            title: 'برنامه راهبردی عملکرد',
            daily: 'امروز', weekly: 'هفتگی', monthly: 'ماهانه', yearly: 'سالانه', five_year: '۵ ساله',
            viewMode: 'بازه زمانی:',
            addGoal: 'افزودن هدف جدید',
            progress: 'میزان تحقق اهداف',
            empty: 'لیست اهداف جاری خالی است.',
            print: 'دریافت نسخه چاپی (Poster)',
            exporting: 'در حال آماده‌سازی فایل...',
            reportTitle: 'سند استراتژیک و نقشه راه موفقیت',
            visionNote: 'نظم در اجرا، تفاوت میان سازمان‌های خوب و سازمان‌های عالی است.',
            historyTitle: 'تاریخچه موفقیت (Hall of Fame)',
            historySub: 'دستاوردها و اهداف محقق شده شما',
            restore: 'بازگشت به لیست',
            breakDown: 'گام‌های اجرایی (Breakdown)'
        },
        en: {
            title: 'Strategic Performance Roadmap',
            daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly', five_year: '5-Year',
            viewMode: 'Timeframe:',
            addGoal: 'Add New Objective',
            progress: 'Goal Completion Rate',
            empty: 'No active objectives.',
            print: 'Export Strategic Poster',
            exporting: 'Preparing File...',
            reportTitle: 'Strategic Plan & Achievement Roadmap',
            visionNote: 'Discipline in execution is what separates good organizations from great ones.',
            historyTitle: 'Success History (Hall of Fame)',
            historySub: 'Your achieved milestones and goals',
            restore: 'Restore to List',
            breakDown: 'Action Steps (Breakdown)'
        }
    }[lang];

    const handleExportImage = async () => {
        if (!posterRef.current || isExporting) return;
        setIsExporting(true);
        try {
            await new Promise(r => setTimeout(r, 1000));
            const dataUrl = await htmlToImage.toPng(posterRef.current, { quality: 1, pixelRatio: 3, backgroundColor: '#ffffff' });
            const link = document.createElement('a');
            link.download = `Strategic-Roadmap-${activePeriod}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            alert('خطا در تولید تصویر.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleAddTask = (catId: string) => {
        if (!canEdit || !currentUserGoals) return;
        const taskText = window.prompt(lang === 'fa' ? 'عنوان هدف جدید را وارد کنید:' : 'Enter New Goal Title:');
        if (!taskText) return;
        const updatedCategories = currentUserGoals.categories.map(c => c.id === catId ? { ...c, tasks: [...c.tasks, { id: `t-${Date.now()}`, text: taskText, isCompleted: false, subTasks: [] }] } : c);
        const updatedGoals = { ...currentUserGoals, categories: updatedCategories, lastUpdated: new Date().toISOString() };
        setCurrentUserGoals(updatedGoals);
        saveUserGoals(updatedGoals);
    };

    // Generic Update Function
    const syncGoals = (updatedCategories: GoalCategory[]) => {
        if (!currentUserGoals) return;
        const updatedGoals = { ...currentUserGoals, categories: updatedCategories, lastUpdated: new Date().toISOString() };
        setCurrentUserGoals(updatedGoals);
        saveUserGoals(updatedGoals);
    };

    const startEditing = (id: string, currentVal: string) => {
        if (!canEdit) return;
        setEditingId(id);
        setEditValue(currentVal);
    };

    const handleEditCategory = (catId: string, newTitle: string) => {
        if (!currentUserGoals) return;
        const updated = currentUserGoals.categories.map(c => c.id === catId ? { ...c, title: newTitle } : c);
        syncGoals(updated);
        setEditingId(null);
    };

    const handleEditTask = (catId: string, taskId: string, newText: string) => {
        if (!currentUserGoals) return;
        const updated = currentUserGoals.categories.map(c => c.id === catId ? { ...c, tasks: c.tasks.map(t => t.id === taskId ? { ...t, text: newText } : t) } : c);
        syncGoals(updated);
        setEditingId(null);
    };

    const handleEditSubTask = (catId: string, taskId: string, subId: string, newText: string) => {
        if (!currentUserGoals) return;
        const updated = currentUserGoals.categories.map(c => c.id === catId ? { ...c, tasks: c.tasks.map(t => t.id === taskId ? { ...t, subTasks: t.subTasks?.map(st => st.id === subId ? { ...st, text: newText } : st) } : t) } : c);
        syncGoals(updated);
        setEditingId(null);
    };

    const toggleTask = (catIdOrTitle: string, taskId: string) => {
        if (!canEdit || !currentUserGoals) return;
        const updated = currentUserGoals.categories.map(c => {
            if (c.id === catIdOrTitle || c.title === catIdOrTitle) {
                return { ...c, tasks: c.tasks.map(t => { if (t.id === taskId) { const newCompleted = !t.isCompleted; return { ...t, isCompleted: newCompleted, subTasks: t.subTasks?.map(st => ({ ...st, isCompleted: newCompleted })) }; } return t; }) };
            }
            return c;
        });
        syncGoals(updated);
    };

    const handleAddSubTask = (catId: string, taskId: string, text: string) => {
        if (!canEdit || !currentUserGoals || !text.trim()) return;
        const updated = currentUserGoals.categories.map(c => c.id === catId ? { ...c, tasks: c.tasks.map(t => t.id === taskId ? { ...t, subTasks: [...(t.subTasks || []), { id: `st-${Date.now()}`, text, isCompleted: false }], isCompleted: false } : t) } : c);
        syncGoals(updated);
    };

    const toggleSubTask = (catId: string, taskId: string, subId: string) => {
        if (!canEdit || !currentUserGoals) return;
        const updated = currentUserGoals.categories.map(c => c.id === catId ? { ...c, tasks: c.tasks.map(t => { if (t.id === taskId) { const updatedSubTasks = t.subTasks?.map(st => st.id === subId ? { ...st, isCompleted: !st.isCompleted } : st); return { ...t, subTasks: updatedSubTasks, isCompleted: updatedSubTasks?.every(st => st.isCompleted) || false }; } return t; }) } : c);
        syncGoals(updated);
    };

    const handleDeleteTask = (catId: string, taskId: string) => {
        if (!canEdit || !currentUserGoals || !window.confirm('حذف شود؟')) return;
        const updated = currentUserGoals.categories.map(c => c.id === catId ? { ...c, tasks: c.tasks.filter(t => t.id !== taskId) } : c);
        syncGoals(updated);
    };

    if (isLoading) return <div className="p-20 text-center animate-pulse text-indigo-600 font-bold text-lg">در حال بارگذاری اهداف...</div>;

    return (
        <div className="space-y-10 pb-20">
            <div className="space-y-10 animate-fade-in">
                {/* Header Widget */}
                <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-indigo-100"><IconTarget className="w-10 h-10" /></div>
                        <div>
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight">{t.title}</h2>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t.viewMode}</span>
                                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-black">{t[activePeriod as keyof typeof t.fa]}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex bg-gray-100 p-1.5 rounded-2xl">
                        {['daily', 'weekly', 'monthly', 'yearly', 'five_year'].map(p => (
                            <button key={p} onClick={() => setActivePeriod(p as GoalPeriod)} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${activePeriod === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t[p as keyof typeof t.fa]}</button>
                        ))}
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-center"><div className="text-3xl font-black text-indigo-600">{stats.percent}%</div><div className="text-[10px] font-bold text-gray-400 uppercase">{t.progress}</div></div>
                        <button onClick={handleExportImage} disabled={isExporting} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-3 hover:bg-black transition-all shadow-xl active:scale-95 disabled:opacity-50">{isExporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <IconPrinter className="w-5 h-5" />}{t.print}</button>
                    </div>
                </div>

                {isMaster && (
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                        <span className="text-xs font-bold text-gray-500">نمایش اهداف:</span>
                        <select className="bg-gray-50 border-none rounded-xl px-4 py-2 text-sm font-bold text-indigo-600 outline-none" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>{personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select>
                    </div>
                )}

                {/* Categories Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {activeView.map((cat) => (
                        <div key={cat.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-lg flex flex-col min-h-[500px] overflow-hidden group">
                            {editingId === cat.id ? (
                                <input 
                                    className="p-5 text-center text-gray-900 font-black text-xs bg-gray-50 outline-none border-b border-indigo-200"
                                    value={editValue}
                                    autoFocus
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => handleEditCategory(cat.id, editValue)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleEditCategory(cat.id, editValue)}
                                />
                            ) : (
                                <div 
                                    onClick={() => startEditing(cat.id, cat.title)}
                                    className={`p-5 text-center text-white font-black text-xs uppercase tracking-widest cursor-pointer ${cat.color}`}
                                >
                                    {cat.title}
                                </div>
                            )}
                            
                            <div className="flex-grow p-4 space-y-4 overflow-y-auto custom-scrollbar">
                                {cat.tasks.map((task) => (
                                    <div key={task.id} className="bg-gray-50/50 rounded-2xl border border-gray-100 p-4 hover:bg-white transition-all shadow-sm relative group/task">
                                        <div className="flex items-start gap-3">
                                            <button onClick={() => toggleTask(cat.id, task.id)} className="w-6 h-6 rounded-lg border-2 border-indigo-200 bg-white flex items-center justify-center shrink-0 transition-all hover:border-indigo-600">
                                                {task.isCompleted && <IconCheck className="w-4 h-4 text-indigo-600" />}
                                            </button>
                                            <div className="flex-grow min-w-0">
                                                {editingId === task.id ? (
                                                    <input 
                                                        className="w-full text-[13px] font-bold text-gray-800 bg-white border border-indigo-300 rounded px-1 outline-none"
                                                        value={editValue}
                                                        autoFocus
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onBlur={() => handleEditTask(cat.id, task.id, editValue)}
                                                        onKeyDown={e => e.key === 'Enter' && handleEditTask(cat.id, task.id, editValue)}
                                                    />
                                                ) : (
                                                    <span 
                                                        onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)} 
                                                        className="text-[13px] font-bold text-gray-800 cursor-pointer block leading-tight truncate"
                                                    >
                                                        {task.text}
                                                    </span>
                                                )}
                                                {task.subTasks && task.subTasks.length > 0 && (
                                                    <span className="text-[9px] font-black text-gray-400 mt-1 block">{(task.subTasks.filter(s=>s.isCompleted).length)} از {task.subTasks.length} گام انجام شده</span>
                                                )}
                                            </div>
                                            {canEdit && (
                                                <div className="flex flex-col gap-2 opacity-0 group-hover/task:opacity-100 transition-opacity">
                                                    <button onClick={() => startEditing(task.id, task.text)} className="text-gray-400 hover:text-indigo-600"><IconEdit className="w-3 h-3"/></button>
                                                    <button onClick={() => handleDeleteTask(cat.id, task.id)} className="text-gray-400 hover:text-red-500"><IconTrash className="w-3 h-3"/></button>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {expandedTaskId === task.id && (
                                            <div className="mt-4 space-y-2 border-r-2 border-indigo-100 pr-3 mr-2 animate-slide-in">
                                                {task.subTasks?.map(st => (
                                                    <div key={st.id} className="flex items-center gap-3 text-[11px] font-bold text-gray-500 group/sub">
                                                        <button onClick={() => toggleSubTask(cat.id, task.id, st.id)} className={`w-4 h-4 rounded border flex items-center justify-center ${st.isCompleted ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-gray-200'}`}>{st.isCompleted && <IconCheck className="w-3 h-3" />}</button>
                                                        
                                                        {editingId === st.id ? (
                                                            <input 
                                                                className="flex-grow bg-white border border-indigo-300 rounded px-1 outline-none"
                                                                value={editValue}
                                                                autoFocus
                                                                onChange={e => setEditValue(e.target.value)}
                                                                onBlur={() => handleEditSubTask(cat.id, task.id, st.id, editValue)}
                                                                onKeyDown={e => e.key === 'Enter' && handleEditSubTask(cat.id, task.id, st.id, editValue)}
                                                            />
                                                        ) : (
                                                            <span 
                                                                onClick={() => startEditing(st.id, st.text)}
                                                                className={`flex-grow cursor-text ${st.isCompleted ? 'line-through opacity-50' : ''}`}
                                                            >
                                                                {st.text}
                                                            </span>
                                                        )}
                                                        <button onClick={() => { if(window.confirm('حذف شود؟')) syncGoals(currentUserGoals!.categories.map(c => c.id === cat.id ? { ...c, tasks: c.tasks.map(t => t.id === task.id ? { ...t, subTasks: t.subTasks?.filter(si => si.id !== st.id) } : t) } : c)) }} className="opacity-0 group-hover/sub:opacity-100 transition-opacity text-red-300 hover:text-red-500"><IconTrash className="w-2.5 h-2.5"/></button>
                                                    </div>
                                                ))}
                                                {canEdit && (
                                                    <input className="w-full text-[10px] p-2 bg-white rounded-lg outline-none border border-gray-100 focus:border-indigo-200" placeholder="Break Down (اینتر)..." onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) { handleAddSubTask(cat.id, task.id, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }} />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {canEdit && (
                                <div className="p-4 border-t border-gray-50"><button onClick={() => handleAddTask(cat.id)} className="w-full py-2.5 bg-gray-50 text-gray-400 text-[11px] font-black rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"><IconPlus className="w-4 h-4" /> {t.addGoal}</button></div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Success History Section */}
                {historyView.length > 0 && (
                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl animate-fade-in">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl"><IconTrophy className="w-6 h-6" /></div>
                            <div><h3 className="text-2xl font-black text-gray-900">{t.historyTitle}</h3><p className="text-sm text-gray-400 font-bold">{t.historySub}</p></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {historyView.map((goal, idx) => (
                                <div key={idx} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 flex flex-col gap-3 relative group overflow-hidden">
                                    <div className="flex items-center gap-3">
                                        <IconStar className="w-5 h-5 text-amber-500 fill-current" />
                                        <div className="min-w-0">
                                            <h4 className="text-[13px] font-black text-gray-800 line-through opacity-40 truncate">{goal.text}</h4>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{goal.categoryTitle}</p>
                                        </div>
                                    </div>
                                    {goal.subTasks && goal.subTasks.length > 0 && (
                                        <div className="pr-4 space-y-1">{goal.subTasks.map(st => (<div key={st.id} className="text-[10px] text-gray-400 flex items-center gap-2"><IconCheck className="w-3 h-3 text-green-500" /> {st.text}</div>))}</div>
                                    )}
                                    <button onClick={() => toggleTask(goal.categoryTitle, goal.id)} className="mt-2 text-[10px] text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity underline">{t.restore}</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Poster Canvas (Hidden) */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
                <div ref={posterRef} className="flex flex-col bg-white overflow-hidden p-20 relative" style={{ width: '840px', height: '1188px' }}>
                    <div className="absolute inset-10 border-[12px] border-gray-50 pointer-events-none"></div>
                    <div className="absolute inset-14 border border-gray-200 pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-16 relative z-10">
                        <div className="flex items-center gap-8">
                            <div className="w-32 h-32 rounded-3xl overflow-hidden border-2 border-gray-100 bg-gray-50 shadow-sm">{selectedPerson?.avatar ? <img src={selectedPerson.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl font-black text-gray-300">{selectedPerson?.fullName.charAt(0)}</div>}</div>
                            <div>
                                <h1 className="text-5xl font-black text-gray-900 mb-2 tracking-tighter">{selectedPerson?.fullName}</h1>
                                <div className="flex gap-2">{selectedPerson?.roles.map(r => <span key={r} className="bg-gray-100 text-gray-500 px-4 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest">{r}</span>)}</div>
                            </div>
                        </div>
                        <div className="text-right"><div className="text-7xl font-black text-indigo-600 leading-none mb-2">{stats.percent}%</div><div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.progress}</div></div>
                    </div>
                    <div className="bg-slate-900 text-white p-10 rounded-2xl mb-12 flex justify-between items-center shadow-xl">
                        <div className="flex items-center gap-4"><IconShield className="w-8 h-8" /><h2 className="text-2xl font-black uppercase tracking-tight">{t.reportTitle}</h2></div>
                        <div className="font-mono text-sm opacity-60">{activePeriod.toUpperCase()} / {new Date().getFullYear()}</div>
                    </div>
                    <div className="flex-grow grid grid-cols-2 gap-x-12 gap-y-12 content-start mb-16">
                        {activeView.map((cat) => (
                            <div key={cat.id} className="space-y-6">
                                <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-3"><div className={`w-3 h-3 rounded-full ${cat.color}`}></div><h3 className="text-xl font-black text-gray-800 uppercase tracking-widest">{cat.title}</h3></div>
                                <div className="space-y-6">
                                    {cat.tasks.map((task) => (
                                        <div key={task.id} className="flex gap-4">
                                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 mt-1 shrink-0"></div>
                                            <div className="flex-grow min-w-0">
                                                <div className="text-lg font-bold text-gray-800 leading-tight mb-2">{task.text}</div>
                                                {task.subTasks && task.subTasks.length > 0 && (
                                                    <div className="space-y-2 pl-6 border-r-2 border-gray-100 mt-3">{task.subTasks.map(st => (<div key={st.id} className="text-xs font-bold text-gray-400 flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${st.isCompleted ? 'bg-indigo-500' : 'bg-gray-100'}`}></div><span className={st.isCompleted ? 'line-through opacity-50' : ''}>{st.text}</span></div>))}</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {cat.tasks.length === 0 && <div className="text-gray-300 text-sm font-bold italic">NO ACTIVE OBJECTIVES</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-gray-200 pt-10 flex justify-between items-end">
                        <div className="max-w-[70%]"><p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-3">LEADERSHIP VISION</p><p className="text-xl font-bold text-gray-500 italic leading-relaxed">"{t.visionNote}"</p></div>
                        <div className="flex flex-col items-end"><div className="w-24 h-24 bg-indigo-600 flex items-center justify-center rounded-3xl shadow-xl shadow-indigo-100 mb-4"><IconShield className="w-10 h-10 text-white" /></div><span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">STRATEGIC PERFORMANCE CERTIFIED</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
