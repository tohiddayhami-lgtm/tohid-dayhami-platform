
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Task, Personnel, TaskComment, InternalMessage, TaskChecklistItem } from '../types';
import { IconCheckSquare, IconPlus, IconList, IconUsers, IconMessageSquare, IconTrash, IconClock, IconSend, IconEdit, IconCheck, IconSearch, IconHistory, IconArrowRight } from './Icons';
import { saveTaskToCloud, updateTaskInCloud, deleteTaskFromCloud, sendInternalMessage } from '../services/firebaseService';
import { Language } from '../App';

interface Props {
  currentUser: Personnel;
  personnel: Personnel[];
  tasks: Task[];
  lang: Language;
}

export const TaskManager: React.FC<Props> = ({ currentUser, personnel, tasks, lang }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTaskData, setEditingTaskData] = useState<Partial<Task>>({});

  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const [filterMode, setFilterMode] = useState<'my' | 'all'>('all');
  
  // Create Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([currentUser.id]);
  const [tempChecklistItem, setTempChecklistItem] = useState('');
  
  const [newComment, setNewComment] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const isAdmin = currentUser.roles.includes('مدیر') || currentUser.username === 'master';

  const t = {
      fa: {
          header: 'مدیریت امور و وظایف',
          activeTasks: 'کارهای جاری',
          archive: 'بایگانی تکمیل شده‌ها',
          myTasks: 'وظایف من',
          allTasks: 'کل سازمان',
          newTask: 'تعریف کار جدید',
          title: 'عنوان',
          priority: 'اولویت',
          assignees: 'مسئولین',
          progress: 'پیشرفت',
          actions: 'عملیات',
          low: 'عادی',
          medium: 'فوری',
          high: 'خیلی فوری',
          empty: 'موردی برای نمایش وجود ندارد.',
          deleteConfirm: 'آیا از حذف دائمی این وظیفه اطمینان دارید؟',
          edit: 'ویرایش و گفتگو',
          save: 'ذخیره تغییرات',
          cancel: 'انصراف',
          archiveNote: 'در بخش بایگانی، تمامی پرسنل امکان ویرایش و ثبت نظر روی وظایف را دارند.'
      },
      en: {
          header: 'Tasks & Operations',
          activeTasks: 'Active Tasks',
          archive: 'Archive',
          myTasks: 'My Tasks',
          allTasks: 'All Tasks',
          newTask: 'New Task',
          title: 'Title',
          priority: 'Priority',
          assignees: 'Assignees',
          progress: 'Progress',
          actions: 'Actions',
          low: 'Low',
          medium: 'Normal',
          high: 'Urgent',
          empty: 'No tasks to show.',
          deleteConfirm: 'Are you sure you want to delete this task?',
          edit: 'Edit & Chat',
          save: 'Save Changes',
          cancel: 'Cancel',
          archiveNote: 'In the archive section, all personnel can edit and comment on tasks.'
      }
  }[lang];

  const filteredTasks = useMemo(() => {
      return tasks.filter(task => {
          // Filter by Active/Archive tab
          const isTaskCompleted = task.isCompleted;
          if (activeTab === 'active' && isTaskCompleted) return false;
          if (activeTab === 'archive' && !isTaskCompleted) return false;

          // Filter by User ownership
          if (filterMode === 'my') return task.assigneeIds.includes(currentUser.id) || task.creatorId === currentUser.id;
          
          return true;
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tasks, activeTab, filterMode, currentUser.id]);

  const toggleTaskCompletion = async (task: Task) => {
      const newState = !task.isCompleted;
      await updateTaskInCloud(task.id, { isCompleted: newState });
      if (newState) {
          // Visual feedback can be added here
      }
  };

  const handleStartEdit = (task: Task) => {
      setSelectedTask(task);
      setEditingTaskData({
          title: task.title,
          description: task.description,
          priority: task.priority,
          assigneeIds: task.assigneeIds,
          checklist: task.checklist || []
      });
      setIsEditing(true);
  };

  const handleSaveEdit = async () => {
      if (!selectedTask || !editingTaskData.title) return;
      await updateTaskInCloud(selectedTask.id, editingTaskData);
      setIsEditing(false);
      setSelectedTask(null);
  };

  const handleAddComment = async () => {
      if (!selectedTask || !newComment.trim()) return;
      const comment: TaskComment = { 
          id: `cm-${Date.now()}`, 
          authorId: currentUser.id, 
          authorName: currentUser.fullName, 
          text: newComment, 
          timestamp: new Date().toISOString() 
      };
      const updatedComments = [...(selectedTask.comments || []), comment];
      await updateTaskInCloud(selectedTask.id, { comments: updatedComments });
      setSelectedTask({ ...selectedTask, comments: updatedComments });
      setNewComment('');
  };

  // Fixed error: Added handleCreateTask implementation
  const handleCreateTask = async () => {
      if (!newTaskTitle.trim()) return;
      const task: Task = {
          id: `task-${Date.now()}`,
          title: newTaskTitle.trim(),
          description: newTaskDesc.trim(),
          creatorId: currentUser.id,
          creatorName: currentUser.fullName,
          assigneeIds: newTaskAssignees,
          isCompleted: false,
          priority: newTaskPriority,
          createdAt: new Date().toISOString(),
          comments: [],
          checklist: []
      };
      await saveTaskToCloud(task);
      setShowAddModal(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskPriority('Medium');
      setNewTaskAssignees([currentUser.id]);
  };

  // Fixed error: Added handleDeleteTask implementation
  const handleDeleteTask = async (id: string) => {
      if (window.confirm(t.deleteConfirm)) {
          await deleteTaskFromCloud(id);
      }
  };

  const calculateProgress = (checklist: TaskChecklistItem[] = []) => {
      if (checklist.length === 0) return 0;
      const completed = checklist.filter(i => i.isCompleted).length;
      return Math.round((completed / checklist.length) * 100);
  };

  const getPriorityBadge = (p: string) => {
      switch(p) {
          case 'High': return 'bg-red-50 text-red-600 border-red-100';
          case 'Medium': return 'bg-amber-50 text-amber-600 border-amber-100';
          default: return 'bg-blue-50 text-blue-600 border-blue-100';
      }
  };

  return (
    <div className="space-y-6 animate-fade-in">
        {/* Header Section */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
                <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-100">
                    <IconList className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-gray-900">{t.header}</h2>
                    <p className="text-sm text-gray-400 font-medium">{activeTab === 'active' ? t.activeTasks : t.archive}</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-gray-100 p-1.5 rounded-2xl">
                    <button onClick={() => setActiveTab('active')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        <IconCheckSquare className="w-4 h-4 inline-block ml-1" /> {t.activeTasks}
                    </button>
                    <button onClick={() => setActiveTab('archive')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'archive' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        <IconHistory className="w-4 h-4 inline-block ml-1" /> {t.archive}
                    </button>
                </div>

                <div className="h-8 w-px bg-gray-200 mx-2"></div>

                <div className="flex bg-gray-100 p-1.5 rounded-2xl">
                    <button onClick={() => setFilterMode('all')} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${filterMode === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
                        {t.allTasks}
                    </button>
                    <button onClick={() => setFilterMode('my')} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${filterMode === 'my' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
                        {t.myTasks}
                    </button>
                </div>

                <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2">
                    <IconPlus className="w-4 h-4" /> {t.newTask}
                </button>
            </div>
        </div>

        {activeTab === 'archive' && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-amber-700 text-xs font-bold flex items-center gap-3">
                <IconHistory className="w-5 h-5 shrink-0" />
                {t.archiveNote}
            </div>
        )}

        {/* Linear Task List */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden ring-1 ring-black/5">
            <div className="overflow-x-auto">
                <table className="w-full text-start">
                    <thead className="bg-gray-50/80 text-gray-400 text-[11px] font-black uppercase tracking-widest border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-5 text-center w-16">#</th>
                            <th className="px-6 py-5 text-start">{t.title}</th>
                            <th className="px-6 py-5 text-center w-32">{t.priority}</th>
                            <th className="px-6 py-5 text-center w-40">{t.assignees}</th>
                            <th className="px-6 py-5 text-center w-32">{t.progress}</th>
                            <th className="px-6 py-5 text-center w-32">{t.actions}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredTasks.map((task) => {
                            const progress = calculateProgress(task.checklist);
                            return (
                                <tr key={task.id} className={`group hover:bg-indigo-50/30 transition-all ${task.isCompleted ? 'bg-gray-50/50' : 'bg-white'}`}>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => toggleTaskCompletion(task)}
                                            className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${task.isCompleted ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100' : 'border-gray-200 bg-white hover:border-indigo-400 group-hover:scale-110'}`}
                                        >
                                            {task.isCompleted && <IconCheck className="w-4 h-4" />}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col min-w-[200px]">
                                            <span className={`font-black text-sm text-gray-800 transition-all ${task.isCompleted ? 'text-gray-400 line-through' : 'group-hover:text-indigo-600'}`}>
                                                {task.title}
                                            </span>
                                            {task.description && (
                                                <span className="text-[11px] text-gray-400 mt-1 line-clamp-1 max-w-md font-medium">
                                                    {task.description}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getPriorityBadge(task.priority)}`}>
                                            {lang === 'fa' ? t[task.priority.toLowerCase() as keyof typeof t.fa] : task.priority}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center -space-x-2 space-x-reverse">
                                            {task.assigneeIds.map(uid => {
                                                const p = personnel.find(per => per.id === uid);
                                                return (
                                                    <div key={uid} className="w-8 h-8 rounded-xl border-2 border-white bg-gray-100 overflow-hidden shadow-sm" title={p?.fullName}>
                                                        {p?.avatar ? <img src={p.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-gray-400">{p?.fullName.charAt(0)}</div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center gap-1.5">
                                            <span className="text-[10px] font-black text-gray-400">{progress}%</span>
                                            <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-700 ${progress === 100 ? 'bg-green-500' : 'bg-indigo-600'}`} style={{ width: `${progress}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => handleStartEdit(task)}
                                                className="p-2.5 text-indigo-400 hover:text-indigo-700 hover:bg-white rounded-xl shadow-sm hover:shadow transition-all"
                                                title={t.edit}
                                            >
                                                <IconEdit className="w-4 h-4" />
                                            </button>
                                            {(isAdmin || task.creatorId === currentUser.id) && (
                                                <button 
                                                    onClick={() => handleDeleteTask(task.id)}
                                                    className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    <IconTrash className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredTasks.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-24 text-center">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                        <IconList className="w-8 h-8 text-gray-200" />
                                    </div>
                                    <p className="text-gray-400 font-black text-sm">{t.empty}</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* CREATE TASK MODAL (Same logic, improved UI) */}
        {showAddModal && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowAddModal(false)}>
                <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-8 border-b border-gray-50 flex justify-between items-center shrink-0">
                        <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3"><div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><IconPlus className="w-5 h-5" /></div>{t.newTask}</h3>
                        <button onClick={() => setShowAddModal(false)} className="p-3 hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all">✕</button>
                    </div>
                    <div className="overflow-y-auto p-10 flex-grow custom-scrollbar space-y-8">
                        <div>
                            <label className="text-[11px] font-black text-indigo-600 mb-3 block uppercase tracking-widest">{t.title}</label>
                            <input required className="w-full py-4 px-6 text-sm font-black bg-gray-50 border border-transparent rounded-[1.5rem] outline-none focus:bg-white focus:border-indigo-300 transition-all" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="..." />
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-indigo-600 mb-3 block uppercase tracking-widest">شرح کار (توضیحات)</label>
                            <textarea className="w-full h-32 py-4 px-6 text-sm text-gray-600 font-medium bg-gray-50 border border-transparent rounded-[1.5rem] outline-none focus:bg-white focus:border-indigo-300 transition-all resize-none" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-[11px] font-black text-indigo-600 mb-3 block uppercase tracking-widest">{t.priority}</label>
                                <select className="w-full py-4 px-6 text-sm font-black bg-gray-50 border border-transparent rounded-2xl outline-none focus:bg-white focus:border-indigo-300 transition-all appearance-none" value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)}>
                                    <option value="Low">{t.low}</option>
                                    <option value="Medium">{t.medium}</option>
                                    <option value="High">{t.high}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="p-8 border-t border-gray-50 flex justify-end gap-3 shrink-0">
                        <button onClick={() => setShowAddModal(false)} className="px-8 py-3 text-xs font-black text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest">{t.cancel}</button>
                        <button onClick={handleCreateTask} disabled={!newTaskTitle.trim()} className="bg-indigo-600 text-white px-10 py-3 rounded-2xl text-sm font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50">ثبت وظیفه جدید</button>
                    </div>
                </div>
            </div>
        )}

        {/* DETAIL & EDIT TASK MODAL (Fully Redesigned) */}
        {selectedTask && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-fade-in" onClick={() => setSelectedTask(null)}>
                <div className="bg-white rounded-[3rem] w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white shrink-0">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => { toggleTaskCompletion(selectedTask); setSelectedTask(null); }}
                                className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all ${selectedTask.isCompleted ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100' : 'border-indigo-200 bg-white hover:border-indigo-600 text-indigo-600'}`}
                            >
                                <IconCheck className="w-5 h-5" />
                            </button>
                            <div className="min-w-0">
                                <h3 className={`text-xl font-black text-gray-900 truncate leading-tight ${selectedTask.isCompleted ? 'line-through opacity-40' : ''}`}>{selectedTask.title}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getPriorityBadge(selectedTask.priority)}`}>{selectedTask.priority}</span>
                                    <span className="text-[10px] text-gray-400 font-bold dir-ltr">Created {new Date(selectedTask.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedTask(null)} className="p-4 hover:bg-gray-100 rounded-3xl transition-all">✕</button>
                    </div>

                    <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                        {/* Left Side: Info & Checklist */}
                        <div className="flex-grow overflow-y-auto p-10 custom-scrollbar space-y-10 border-l border-gray-50">
                            <div>
                                <label className="text-[11px] font-black text-indigo-600 mb-4 block uppercase tracking-[0.2em]">توضیحات تکمیلی</label>
                                {isEditing ? (
                                    <textarea className="w-full h-32 p-6 bg-gray-50 border-transparent rounded-[2rem] text-sm font-medium outline-none focus:bg-white focus:border-indigo-300 transition-all resize-none" value={editingTaskData.description} onChange={e => setEditingTaskData({...editingTaskData, description: e.target.value})} />
                                ) : (
                                    <p className="text-sm text-gray-600 leading-loose bg-white border border-gray-50 p-6 rounded-[2rem] whitespace-pre-wrap">{selectedTask.description || 'بدون توضیحات.'}</p>
                                )}
                            </div>

                            <div className="bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><IconList className="w-4 h-4" /> چک‌لیست زیرمجموعه</h4>
                                    <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{calculateProgress(selectedTask.checklist)}%</span>
                                </div>
                                <div className="space-y-3 mb-6">
                                    {(isEditing ? editingTaskData.checklist : selectedTask.checklist || []).map((item: any) => (
                                        <div key={item.id} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm group">
                                            <input type="checkbox" checked={item.isCompleted} onChange={() => {
                                                const updated = (isEditing ? editingTaskData.checklist : selectedTask.checklist)?.map((i: any) => i.id === item.id ? { ...i, isCompleted: !i.isCompleted } : i);
                                                if(isEditing) setEditingTaskData({...editingTaskData, checklist: updated});
                                                else { updateTaskInCloud(selectedTask.id, { checklist: updated }); setSelectedTask({...selectedTask, checklist: updated}); }
                                            }} className="w-5 h-5 text-indigo-600 rounded cursor-pointer" />
                                            <input 
                                                className={`flex-grow text-sm font-bold bg-transparent outline-none ${item.isCompleted ? 'line-through text-gray-300' : 'text-gray-700'}`}
                                                value={item.text}
                                                readOnly={!isEditing}
                                                onChange={(e) => {
                                                    const updated = editingTaskData.checklist?.map((i: any) => i.id === item.id ? { ...i, text: e.target.value } : i);
                                                    setEditingTaskData({...editingTaskData, checklist: updated});
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input className="flex-grow px-6 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:border-indigo-400 bg-white" placeholder="آیتم جدید..." value={tempChecklistItem} onChange={e => setTempChecklistItem(e.target.value)} onKeyDown={e => { if(e.key==='Enter') {
                                        const newItem = { id: `cl-${Date.now()}`, text: tempChecklistItem, isCompleted: false };
                                        if(isEditing) setEditingTaskData({...editingTaskData, checklist: [...(editingTaskData.checklist || []), newItem]});
                                        else { const updated = [...(selectedTask.checklist || []), newItem]; updateTaskInCloud(selectedTask.id, { checklist: updated }); setSelectedTask({...selectedTask, checklist: updated}); }
                                        setTempChecklistItem('');
                                    }}} />
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Chat & Assignees */}
                        <div className="w-full md:w-96 flex flex-col shrink-0 bg-gray-50/30">
                            <div className="p-8 border-b border-gray-50 shrink-0">
                                <label className="text-[10px] font-black text-gray-400 mb-4 block uppercase tracking-widest">تیم انجام دهنده</label>
                                <div className="flex flex-wrap gap-2">
                                    {isEditing ? (
                                        personnel.map(p => (
                                            <button key={p.id} onClick={() => {
                                                const current = editingTaskData.assigneeIds || [];
                                                const updated = current.includes(p.id) ? current.filter(id => id !== p.id) : [...current, p.id];
                                                setEditingTaskData({...editingTaskData, assigneeIds: updated});
                                            }} className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border ${editingTaskData.assigneeIds?.includes(p.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-200'}`}>
                                                {p.fullName}
                                            </button>
                                        ))
                                    ) : (
                                        selectedTask.assigneeIds.map(uid => {
                                            const p = personnel.find(per => per.id === uid);
                                            return <span key={uid} className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-white border border-gray-100 text-gray-700 shadow-sm">{p?.fullName}</span>;
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="flex-grow overflow-y-auto p-8 custom-scrollbar space-y-6">
                                <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">مکاتبات و پیگیری‌ها</label>
                                {(selectedTask.comments || []).map((comment, idx) => (
                                    <div key={idx} className={`flex gap-3 ${comment.authorId === currentUser.id ? 'flex-row-reverse' : ''}`}>
                                        <div className="w-8 h-8 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-[10px] font-black text-indigo-600 shrink-0 shadow-sm">{comment.authorName.charAt(0)}</div>
                                        <div className={`p-4 rounded-2xl text-[11px] max-w-[85%] leading-relaxed ${comment.authorId === currentUser.id ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-100 text-gray-700 shadow-sm'}`}>
                                            <div className="font-black opacity-60 mb-1">{comment.authorName}</div>
                                            {comment.text}
                                            <div className="text-[9px] mt-1.5 opacity-40 text-left dir-ltr">{new Date(comment.timestamp).toLocaleTimeString()}</div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={commentsEndRef}></div>
                            </div>

                            <div className="p-8 border-t border-gray-50 bg-white shrink-0">
                                <div className="relative">
                                    <input className="w-full py-4 px-6 text-xs font-bold bg-gray-50 border border-transparent rounded-2xl outline-none focus:bg-white focus:border-indigo-300 transition-all pr-12" placeholder="ارسال پیام..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment()} />
                                    <button onClick={handleAddComment} disabled={!newComment.trim()} className="absolute right-3 top-2 bottom-2 bg-indigo-600 text-white px-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100">
                                        <IconSend className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 border-t border-gray-50 flex justify-between bg-white shrink-0">
                        {isEditing ? (
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setIsEditing(false)} className="flex-grow py-4 text-xs font-black text-gray-400 hover:bg-gray-50 rounded-2xl transition-all">لغو ویرایش</button>
                                <button onClick={handleSaveEdit} className="flex-grow py-4 bg-green-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-green-100 hover:bg-green-700 transition-all">ذخیره تغییرات</button>
                            </div>
                        ) : (
                            <button onClick={() => handleSaveEdit()} className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-sm hover:bg-indigo-100 transition-all">بستن پرونده</button>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
