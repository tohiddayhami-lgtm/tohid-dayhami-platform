
import React, { useState } from 'react';
import { KPI, Personnel } from '../types';
import { IconTarget, IconPlus, IconBrain, IconTrash, IconEdit } from './Icons';
import { saveKPIToCloud, deleteKPIFromCloud, updateKPIInCloud } from '../services/firebaseService';
import { suggestKPIs } from '../services/geminiService';
import { Language } from '../App';

interface Props {
  kpis: KPI[];
  personnel: Personnel[];
  lang: Language;
}

export const KPIManager: React.FC<Props> = ({ kpis, personnel, lang }) => {
  const [showModal, setShowModal] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [formData, setFormData] = useState<Partial<KPI>>({
      title: '',
      targetValue: 100,
      currentValue: 0,
      unit: 'count',
      period: 'monthly',
      description: ''
  });
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedUser, setSelectedUser] = useState('');

  const t = {
      fa: {
          header: 'مدیریت شاخص‌های کلیدی عملکرد (KPI)',
          sub: 'تعریف و پایش اهداف برای پرسنل و سمت‌های سازمانی',
          add: 'تعریف KPI جدید',
          role: 'سمت سازمانی',
          user: 'کارمند مشخص (اختیاری)',
          title: 'عنوان شاخص',
          target: 'مقدار هدف',
          unit: 'واحد اندازه‌گیری',
          period: 'دوره زمانی',
          desc: 'توضیحات',
          aiBtn: 'پیشنهاد هوش مصنوعی',
          save: 'ذخیره شاخص',
          cancel: 'انصراف',
          count: 'تعداد / عدد',
          percent: 'درصد %',
          currency: 'مبلغ (ریال)',
          monthly: 'ماهانه',
          quarterly: 'سه ماهه',
          yearly: 'سالانه',
          current: 'وضعیت فعلی',
          delete: 'حذف',
          edit: 'ویرایش',
          updateVal: 'بروزرسانی مقدار',
          aiLoading: 'در حال تحلیل شغل و تولید شاخص‌ها...',
          noKpis: 'هنوز شاخصی تعریف نشده است.'
      },
      en: {
          header: 'KPI Management',
          sub: 'Define and track goals for staff and roles',
          add: 'New KPI',
          role: 'Role',
          user: 'Specific Employee (Optional)',
          title: 'KPI Title',
          target: 'Target Value',
          unit: 'Unit',
          period: 'Period',
          desc: 'Description',
          aiBtn: 'AI Suggestion',
          save: 'Save KPI',
          cancel: 'Cancel',
          count: 'Count',
          percent: 'Percent %',
          currency: 'Currency',
          monthly: 'Monthly',
          quarterly: 'Quarterly',
          yearly: 'Yearly',
          current: 'Current Value',
          delete: 'Delete',
          edit: 'Edit',
          updateVal: 'Update Value',
          aiLoading: 'Analyzing role and generating KPIs...',
          noKpis: 'No KPIs defined yet.'
      }
  }[lang];

  // Extract unique roles from personnel
  const roles = Array.from(new Set(personnel.flatMap(p => p.roles)));

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title) return;
      const newKPI: KPI = {
          id: formData.id || `kpi-${Date.now()}`,
          title: formData.title!,
          targetValue: Number(formData.targetValue),
          currentValue: Number(formData.currentValue || 0),
          unit: formData.unit as any,
          period: formData.period as any,
          description: formData.description,
          assignedRole: selectedRole || undefined,
          assignedUserId: selectedUser || undefined
      };

      if (formData.id) {
          await updateKPIInCloud(formData.id, newKPI);
      } else {
          await saveKPIToCloud(newKPI);
      }
      setShowModal(false);
      setFormData({ title: '', targetValue: 100, currentValue: 0, unit: 'count', period: 'monthly', description: '' });
  };

  const handleAiSuggest = async () => {
      if (!selectedRole) {
          alert(lang === 'fa' ? 'لطفا ابتدا یک سمت را انتخاب کنید.' : 'Please select a role first.');
          return;
      }
      setLoadingAI(true);
      const suggestions = await suggestKPIs(selectedRole);
      setLoadingAI(false);
      
      if (suggestions.length > 0) {
          const s = suggestions[0];
          setFormData(prev => ({
              ...prev,
              title: s.title,
              unit: s.unit,
              description: s.description
          }));
      }
  };

  const handleDelete = async (id: string) => {
      if (window.confirm('Delete this KPI?')) {
          await deleteKPIFromCloud(id);
      }
  };

  const calculateProgress = (kpi: KPI) => {
      if (kpi.targetValue === 0) return 0;
      return Math.min(100, Math.round((kpi.currentValue / kpi.targetValue) * 100));
  };

  const getProgressColor = (percent: number) => {
      if (percent >= 100) return 'bg-green-500';
      if (percent >= 70) return 'bg-blue-500';
      if (percent >= 40) return 'bg-yellow-500';
      return 'bg-red-500';
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm gap-4">
            <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <div className="bg-pink-100 text-pink-600 p-2 rounded-lg"><IconTarget className="w-6 h-6" /></div>
                    {t.header}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{t.sub}</p>
            </div>
            <button onClick={() => { setShowModal(true); setFormData({}); }} className="bg-pink-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-pink-700 flex items-center gap-2 shadow-lg shadow-pink-200">
                <IconPlus className="w-5 h-5" /> {t.add}
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {kpis.map(kpi => {
                const progress = calculateProgress(kpi);
                const assignedPerson = personnel.find(p => p.id === kpi.assignedUserId);
                return (
                    <div key={kpi.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <div className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {kpi.assignedRole ? `Role: ${kpi.assignedRole}` : (assignedPerson ? `User: ${assignedPerson.fullName}` : 'Global')}
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => { setFormData(kpi); setShowModal(true); setSelectedRole(kpi.assignedRole || ''); setSelectedUser(kpi.assignedUserId || ''); }} className="p-1 text-gray-400 hover:text-blue-500"><IconEdit className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(kpi.id)} className="p-1 text-gray-400 hover:text-red-500"><IconTrash className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg mb-1">{kpi.title}</h3>
                        <p className="text-xs text-gray-500 mb-4 h-8 line-clamp-2">{kpi.description}</p>
                        
                        <div className="mb-2 flex justify-between items-end">
                            <div className="text-2xl font-black text-gray-800">
                                {kpi.currentValue.toLocaleString()} 
                                <span className="text-xs text-gray-400 font-normal ml-1">/ {kpi.targetValue.toLocaleString()}</span>
                            </div>
                            <div className="text-xs font-bold text-gray-500">{t[kpi.unit]}</div>
                        </div>
                        
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden mb-4">
                            <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(progress)}`} style={{ width: `${progress}%` }}></div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                className="w-20 px-2 py-1 border rounded text-sm text-center outline-none" 
                                placeholder="Value"
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter') {
                                        updateKPIInCloud(kpi.id, { currentValue: Number((e.target as HTMLInputElement).value) });
                                        (e.target as HTMLInputElement).value = '';
                                    }
                                }}
                            />
                            <span className="text-xs text-gray-400">{t.updateVal}</span>
                        </div>
                    </div>
                );
            })}
            {kpis.length === 0 && <div className="col-span-full py-12 text-center text-gray-400">{t.noKpis}</div>}
        </div>

        {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-pink-50 rounded-t-2xl">
                        <h3 className="font-bold text-pink-900">{t.add}</h3>
                        <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                    <form onSubmit={handleSave} className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t.role}</label>
                                <select className="w-full px-3 py-2 border rounded-lg" value={selectedRole} onChange={e => { setSelectedRole(e.target.value); setSelectedUser(''); }}>
                                    <option value="">-</option>
                                    {roles.map((r, i) => <option key={i} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t.user}</label>
                                <select className="w-full px-3 py-2 border rounded-lg" value={selectedUser} onChange={e => { setSelectedUser(e.target.value); setSelectedRole(''); }}>
                                    <option value="">-</option>
                                    {personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                                </select>
                            </div>
                        </div>

                        {selectedRole && (
                            <button type="button" onClick={handleAiSuggest} disabled={loadingAI} className="w-full py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-md">
                                {loadingAI ? (
                                    <>
                                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    {t.aiLoading}
                                    </>
                                ) : (
                                    <><IconBrain className="w-5 h-5" /> {t.aiBtn}</>
                                )}
                            </button>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t.title}</label>
                            <input required className="w-full px-3 py-2 border rounded-lg" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t.target}</label>
                                <input type="number" required className="w-full px-3 py-2 border rounded-lg" value={formData.targetValue} onChange={e => setFormData({...formData, targetValue: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t.unit}</label>
                                <select className="w-full px-3 py-2 border rounded-lg" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value as any})}>
                                    <option value="count">{t.count}</option>
                                    <option value="percent">{t.percent}</option>
                                    <option value="currency">{t.currency}</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t.period}</label>
                            <select className="w-full px-3 py-2 border rounded-lg" value={formData.period} onChange={e => setFormData({...formData, period: e.target.value as any})}>
                                <option value="monthly">{t.monthly}</option>
                                <option value="quarterly">{t.quarterly}</option>
                                <option value="yearly">{t.yearly}</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t.desc}</label>
                            <textarea className="w-full px-3 py-2 border rounded-lg" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg">{t.cancel}</button>
                            <button type="submit" className="flex-1 py-2 bg-pink-600 text-white rounded-lg font-bold">{t.save}</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};
