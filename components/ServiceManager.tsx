
import React, { useState } from 'react';
import { ServiceOption, Currency, SubService } from '../types';
import { IconPlus, IconEdit, IconTrash, IconCheck, IconMoney, IconList } from './Icons';
import { Language } from '../App';

interface Props {
  services: ServiceOption[];
  onUpdate: (services: ServiceOption[]) => void;
  readonly?: boolean;
  lang: Language;
}

export const ServiceManager: React.FC<Props> = ({ services, onUpdate, readonly = false, lang }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ServiceOption>>({ title: '', titleEn: '', description: '', descriptionEn: '', icon: '', price: { amount: 0, currency: 'IRR' }, isActive: true, subServices: [] });
  
  // Sub Service State
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubTitleEn, setNewSubTitleEn] = useState('');
  const [newSubPrice, setNewSubPrice] = useState(0);

  const t = {
      fa: {
          title: 'لیست خدمات و تعرفه‌ها',
          add: 'افزودن سرویس و تعرفه جدید',
          edit: 'ویرایش سرویس / تعرفه',
          serviceTitle: 'عنوان سرویس (فارسی)',
          serviceTitleEn: 'عنوان سرویس (انگلیسی)',
          desc: 'توضیحات (فارسی)',
          descEn: 'توضیحات (انگلیسی)',
          icon: 'آیکون (ایموجی)',
          price: 'تعرفه پایه',
          active: 'فعال در فرم مشتری',
          save: 'ذخیره تغییرات',
          create: 'افزودن به لیست',
          cancel: 'انصراف',
          deleteConfirm: 'آیا از حذف این سرویس اطمینان دارید؟',
          tableOrder: 'ترتیب',
          tableIcon: 'آیکون',
          tableTitle: 'عنوان',
          tablePrice: 'تعرفه پایه',
          tableDesc: 'توضیحات',
          tableStatus: 'وضعیت',
          tableAction: 'عملیات',
          activeLabel: 'فعال',
          inactiveLabel: 'غیرفعال',
          empty: 'لیست خدمات خالی است.',
          subServices: 'زیرمجموعه خدمات (اختیاری)',
          subPlaceholder: 'عنوان زیرمجموعه (مثلا: طراحی لوگو)',
          subPlaceholderEn: 'Sub-service (e.g. Logo)',
          addSub: 'افزودن زیرمجموعه',
          subList: 'لیست زیرمجموعه‌ها'
      },
      en: {
          title: 'Services & Tariffs List',
          add: 'Add New Service',
          edit: 'Edit Service',
          serviceTitle: 'Service Title (Farsi)',
          serviceTitleEn: 'Service Title (English)',
          desc: 'Description (Farsi)',
          descEn: 'Description (English)',
          icon: 'Icon (Emoji)',
          price: 'Base Price',
          active: 'Active in Customer Form',
          save: 'Save Changes',
          create: 'Add to List',
          cancel: 'Cancel',
          deleteConfirm: 'Are you sure you want to delete this service?',
          tableOrder: 'Order',
          tableIcon: 'Icon',
          tableTitle: 'Title',
          tablePrice: 'Base Price',
          tableDesc: 'Description',
          tableStatus: 'Status',
          tableAction: 'Action',
          activeLabel: 'Active',
          inactiveLabel: 'Inactive',
          empty: 'Service list is empty.',
          subServices: 'Sub-Services (Optional)',
          subPlaceholder: 'Sub-service title (e.g. Logo Design)',
          subPlaceholderEn: 'Sub-service (EN)',
          addSub: 'Add Sub-service',
          subList: 'Sub-services List'
      }
  }[lang];

  const handleEdit = (service: ServiceOption) => { setEditingId(service.id); setFormData({ ...service, subServices: service.subServices || [] }); };
  const handleDelete = (id: string) => { if (window.confirm(t.deleteConfirm)) { onUpdate(services.filter(s => s.id !== id)); } };
  const handleReset = () => { 
      setEditingId(null); 
      setFormData({ title: '', titleEn: '', description: '', descriptionEn: '', icon: '', price: { amount: 0, currency: 'IRR' }, isActive: true, subServices: [] }); 
      setNewSubTitle(''); setNewSubTitleEn(''); setNewSubPrice(0);
  };

  const handleAddSubService = () => {
      if (!newSubTitle.trim()) return;
      const newSub: SubService = {
          id: `sub-${Date.now()}`,
          title: newSubTitle,
          titleEn: newSubTitleEn,
          price: { amount: newSubPrice, currency: formData.price?.currency || 'IRR' }
      };
      setFormData(prev => ({ ...prev, subServices: [...(prev.subServices || []), newSub] }));
      setNewSubTitle('');
      setNewSubTitleEn('');
      setNewSubPrice(0);
  };

  const handleRemoveSubService = (id: string) => {
      setFormData(prev => ({ ...prev, subServices: prev.subServices?.filter(s => s.id !== id) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description) return;
    if (editingId) {
      onUpdate(services.map(s => s.id === editingId ? { ...s, ...formData } as ServiceOption : s));
    } else {
      const newService: ServiceOption = { 
          id: `s-${Date.now()}`, 
          title: formData.title!, 
          titleEn: formData.titleEn || formData.title, 
          description: formData.description!, 
          descriptionEn: formData.descriptionEn || formData.description, 
          icon: formData.icon || '✨', 
          price: formData.price, 
          isActive: formData.isActive ?? true,
          subServices: formData.subServices || []
      };
      onUpdate([...services, newService]);
    }
    handleReset();
  };

  const moveService = (index: number, direction: 'up' | 'down') => {
    const newServices = [...services];
    if (direction === 'up' && index > 0) {
      [newServices[index], newServices[index - 1]] = [newServices[index - 1], newServices[index]];
    } else if (direction === 'down' && index < newServices.length - 1) {
      [newServices[index], newServices[index + 1]] = [newServices[index + 1], newServices[index]];
    }
    onUpdate(newServices);
  };

  const formatPrice = (amount: number, currency: Currency) => {
      const currLabel = currency === 'IRR' ? (lang === 'fa' ? 'ریال' : 'IRR') : (currency === 'OMR' ? (lang === 'fa' ? 'عمان' : 'OMR') : (lang === 'fa' ? 'دلار' : 'USD'));
      return `${amount.toLocaleString()} ${currLabel}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {!readonly && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6"><div className="p-2 bg-blue-100 text-blue-600 rounded-lg">{editingId ? <IconEdit className="w-5 h-5" /> : <IconPlus className="w-5 h-5" />}</div><h3 className="text-lg font-bold text-gray-800">{editingId ? t.edit : t.add}</h3></div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.serviceTitle}</label><input type="text" required className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.serviceTitleEn}</label><input type="text" className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none dir-ltr" value={formData.titleEn} onChange={e => setFormData({...formData, titleEn: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.icon}</label><input type="text" className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="emoji" value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} /></div>
            <div className=""><label className="block text-sm font-medium text-gray-700 mb-1">{t.price}</label><div className="flex gap-2"><div className="relative flex-grow"><IconMoney className="absolute rtl:right-3 ltr:left-3 top-2.5 w-5 h-5 text-gray-400" /><input type="number" className="w-full rtl:pl-4 rtl:pr-10 ltr:pr-4 ltr:pl-10 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" value={formData.price?.amount || ''} onChange={e => setFormData({ ...formData, price: { amount: parseInt(e.target.value) || 0, currency: formData.price?.currency || 'IRR' } })} /></div><select className="w-32 py-2 px-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={formData.price?.currency || 'IRR'} onChange={e => setFormData({ ...formData, price: { amount: formData.price?.amount || 0, currency: e.target.value as Currency } })}><option value="IRR">IRR</option><option value="OMR">OMR</option><option value="USD">USD</option></select></div></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">{t.desc}</label><input type="text" required className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">{t.descEn}</label><input type="text" className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none dir-ltr" value={formData.descriptionEn} onChange={e => setFormData({...formData, descriptionEn: e.target.value})} /></div>
            
            {/* Sub Services Section */}
            <div className="md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm"><IconList className="w-4 h-4" /> {t.subServices}</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                    <input className="flex-grow px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none" placeholder={t.subPlaceholder} value={newSubTitle} onChange={e => setNewSubTitle(e.target.value)} />
                    <input className="flex-grow px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none dir-ltr" placeholder={t.subPlaceholderEn} value={newSubTitleEn} onChange={e => setNewSubTitleEn(e.target.value)} />
                    <input type="number" className="w-24 px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none" placeholder="Price" value={newSubPrice || ''} onChange={e => setNewSubPrice(parseInt(e.target.value))} />
                    <button type="button" onClick={handleAddSubService} className="bg-indigo-600 text-white px-3 rounded-lg text-sm font-bold hover:bg-indigo-700">{t.addSub}</button>
                </div>
                <div className="space-y-2">
                    {formData.subServices?.map((sub) => (
                        <div key={sub.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 text-sm">
                            <span>{sub.title} {sub.titleEn ? `(${sub.titleEn})` : ''} {sub.price?.amount ? ` - ${formatPrice(sub.price.amount, sub.price.currency)}` : ''}</span>
                            <button type="button" onClick={() => handleRemoveSubService(sub.id)} className="text-red-500 hover:text-red-700"><IconTrash className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-4 mt-2"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/><span className="text-sm text-gray-700">{t.active}</span></label></div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-4">{editingId && (<button type="button" onClick={handleReset} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">{t.cancel}</button>)}<button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">{editingId ? t.save : t.create}</button></div>
          </form>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center"><h3 className="font-bold text-gray-800">{t.title}</h3>{readonly && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Read-only</span>}</div>
        <div className="overflow-x-auto"><table className="w-full text-start"><thead className="bg-gray-50 text-gray-500 text-sm"><tr>{!readonly && <th className="px-6 py-3 w-16 text-center">{t.tableOrder}</th>}<th className="px-6 py-3">{t.tableIcon}</th><th className="px-6 py-3">{t.tableTitle}</th><th className="px-6 py-3">{t.tablePrice}</th><th className="px-6 py-3">{t.tableDesc}</th><th className="px-6 py-3">{t.tableStatus}</th>{!readonly && <th className="px-6 py-3">{t.tableAction}</th>}</tr></thead><tbody className="divide-y divide-gray-100">{services.map((service, index) => (<tr key={service.id} className="hover:bg-gray-50 group">
            {!readonly && (
                <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                        <button onClick={() => moveService(index, 'up')} disabled={index === 0} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-indigo-600 disabled:opacity-20 transition-colors">▲</button>
                        <button onClick={() => moveService(index, 'down')} disabled={index === services.length - 1} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-indigo-600 disabled:opacity-20 transition-colors">▼</button>
                    </div>
                </td>
            )}
            <td className="px-6 py-4 text-2xl">{service.icon}</td><td className="px-6 py-4 font-medium text-gray-900">{lang === 'en' && service.titleEn ? service.titleEn : service.title} {service.subServices && service.subServices.length > 0 && <span className="block text-[10px] text-gray-400 mt-1">{service.subServices.length} sub-items</span>}</td><td className="px-6 py-4">{service.price && service.price.amount > 0 ? (<span className="font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full text-sm">{formatPrice(service.price.amount, service.price.currency)}</span>) : (<span className="text-gray-400 text-xs italic">-</span>)}</td><td className="px-6 py-4 text-sm text-gray-500">{lang === 'en' && service.descriptionEn ? service.descriptionEn : service.description}</td><td className="px-6 py-4">{service.isActive ? (<span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded"><IconCheck className="w-3 h-3" /> {t.activeLabel}</span>) : (<span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-1 rounded">{t.inactiveLabel}</span>)}</td>{!readonly && (<td className="px-6 py-4"><div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleEdit(service)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><IconEdit className="w-4 h-4" /></button><button onClick={() => handleDelete(service.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><IconTrash className="w-4 h-4" /></button></div></td>)}</tr>))}{services.length === 0 && (<tr><td colSpan={readonly ? 5 : 7} className="text-center py-8 text-gray-400">{t.empty}</td></tr>)}</tbody></table></div>
      </div>
    </div>
  );
};
