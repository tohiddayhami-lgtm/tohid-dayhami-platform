
import React, { useState, useRef } from 'react';
import { Personnel, AppConfig, PersonnelDocument, AttachedFile } from '../types';
import { IconPlus, IconTrash, IconShield, IconEdit, IconCheck, IconSettings, IconUsers, IconMoney, IconBriefcase, IconUpload, IconFile, IconPaperclip, IconLayout, IconInvoice } from './Icons';
import { uploadFileWithProgress } from '../services/firebaseService';
import { Language } from '../App';

interface Props {
  personnel: Personnel[];
  config: AppConfig;
  onUpdate: (list: Personnel[]) => void;
  onUpdateConfig: (config: AppConfig) => void;
  lang: Language;
}

export const PersonnelManager: React.FC<Props> = ({ personnel, config, onUpdate, onUpdateConfig, lang }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [showRoleManager, setShowRoleManager] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '', roles: [] as string[], jobDescription: '', reportsTo: '', email: '', username: '', password: '', avatar: '', documents: [] as PersonnelDocument[],
    canAssign: false, canViewCustomers: false, canViewTariffs: false, canViewAllTickets: false, canIssueInvoices: false
  });

  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocFile, setNewDocFile] = useState<AttachedFile | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const availableRoles = config.personnelRoles || ['مدیر', 'کارشناس صادرات', 'طراح گرافیک/بسته بندی', 'پشتیبانی', 'کارشناس آموزش'];

  const t = {
      fa: {
          rolesTitle: 'مدیریت سمت‌ها',
          rolePlaceholder: 'عنوان سمت جدید',
          add: 'افزودن',
          editUser: 'ویرایش اطلاعات پرسنل',
          newUser: 'تعریف حساب کاربری و پرسنل جدید',
          uploadPhoto: 'افزودن عکس',
          uploading: 'در حال آپلود...',
          name: 'نام و نام خانوادگی',
          email: 'ایمیل سازمانی',
          roles: 'سمت‌های سازمانی',
          manager: 'مدیر مستقیم / گزارش‌دهی به',
          jobDesc: 'شرح شغل',
          permissions: 'دسترسی‌ها و مجوزها',
          permAssign: 'مجوز ارجاع کار',
          permAllTickets: 'مشاهده کل درخواست‌ها',
          permCustomers: 'دسترسی بانک مشتریان',
          permTariffs: 'مشاهده تعرفه‌ها',
          permInvoice: 'مجوز صدور فاکتور',
          docs: 'پرونده پرسنلی و مدارک',
          docTitle: 'عنوان مدرک',
          docFile: 'فایل',
          selectFile: 'انتخاب فایل',
          loginInfo: 'اطلاعات ورود به سامانه',
          username: 'نام کاربری',
          password: 'رمز عبور',
          save: 'ذخیره تغییرات',
          create: 'ایجاد حساب کاربری',
          cancel: 'انصراف',
          deleteConfirm: 'آیا از حذف این پرسنل اطمینان دارید؟',
          emailLbl: 'ایمیل:',
          usernameLbl: 'نام کاربری:',
          docsLbl: 'مدارک:'
      },
      en: {
          rolesTitle: 'Manage Roles',
          rolePlaceholder: 'New Role Title',
          add: 'Add',
          editUser: 'Edit Staff Info',
          newUser: 'New Staff Account',
          uploadPhoto: 'Upload Photo',
          uploading: 'Uploading...',
          name: 'Full Name',
          email: 'Work Email',
          roles: 'Organizational Roles',
          manager: 'Direct Manager / Reports To',
          jobDesc: 'Job Description',
          permissions: 'Permissions',
          permAssign: 'Can Assign Tasks',
          permAllTickets: 'View All Requests',
          permCustomers: 'View Customer Bank',
          permTariffs: 'View Tariffs',
          permInvoice: 'Can Issue Invoices',
          docs: 'Personnel Documents',
          docTitle: 'Document Title',
          docFile: 'File',
          selectFile: 'Select File',
          loginInfo: 'Login Credentials',
          username: 'Username',
          password: 'Password',
          save: 'Save Changes',
          create: 'Create Account',
          cancel: 'Cancel',
          deleteConfirm: 'Are you sure you want to delete this staff member?',
          emailLbl: 'Email:',
          usernameLbl: 'Username:',
          docsLbl: 'Docs:'
      }
  }[lang];

  const handleEdit = (person: Personnel) => {
    setEditingId(person.id);
    setFormData({
        fullName: person.fullName, roles: person.roles || [], jobDescription: person.jobDescription || '', reportsTo: person.reportsTo || '',
        email: person.email, username: person.username, password: person.password || '', avatar: person.avatar || '', documents: person.documents || [],
        canAssign: person.permissions?.canAssign || false, canViewCustomers: person.permissions?.canViewCustomers || false,
        canViewTariffs: person.permissions?.canViewTariffs || false, canViewAllTickets: person.permissions?.canViewAllTickets || false,
        canIssueInvoices: person.permissions?.canIssueInvoices || false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setFormData({ fullName: '', roles: [], jobDescription: '', reportsTo: '', email: '', username: '', password: '', avatar: '', documents: [], canAssign: false, canViewCustomers: false, canViewTariffs: false, canViewAllTickets: false, canIssueInvoices: false });
      setNewDocTitle(''); setNewDocFile(null);
  };

  const toggleRole = (role: string) => { setFormData(prev => { const exists = prev.roles.includes(role); return exists ? { ...prev, roles: prev.roles.filter(r => r !== role) } : { ...prev, roles: [...prev.roles, role] }; }); };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      setIsProcessingImage(true);
      uploadFileWithProgress(file, () => {}, (url) => { setFormData(prev => ({ ...prev, avatar: url })); setIsProcessingImage(false); }, (err) => { alert(err.message); setIsProcessingImage(false); });
  };

  const handleDocFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return; }
      setNewDocFile({ name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 });
      uploadFileWithProgress(file, (progress) => { setNewDocFile(prev => prev ? { ...prev, progress } : null); }, (url) => { setNewDocFile(prev => prev ? { ...prev, content: url, status: 'success', progress: 100 } : null); }, (err) => { setNewDocFile(prev => prev ? { ...prev, status: 'error', errorMsg: err.message } : null); });
  };

  const handleAddDocument = () => {
      if (!newDocTitle.trim() || !newDocFile || newDocFile.status !== 'success') return;
      const newDoc: PersonnelDocument = { id: `doc-${Date.now()}`, title: newDocTitle, file: newDocFile };
      setFormData(prev => ({ ...prev, documents: [...prev.documents, newDoc] }));
      setNewDocTitle(''); setNewDocFile(null); if (docInputRef.current) docInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.roles.length === 0 || formData.documents.some(d => d.file.status === 'uploading') || isProcessingImage) return;
    const permissions = { canAssign: formData.canAssign, canViewCustomers: formData.canViewCustomers, canViewTariffs: formData.canViewTariffs, canViewAllTickets: formData.canViewAllTickets, canIssueInvoices: formData.canIssueInvoices };
    if (editingId) {
        onUpdate(personnel.map(p => p.id === editingId ? { ...p, ...formData, permissions } : p));
    } else {
        const newPerson: Personnel = { id: `p-${Date.now()}`, ...formData, status: 'active', permissions };
        onUpdate([...personnel, newPerson]);
    }
    handleCancelEdit();
  };

  const handleRemove = (id: string) => { if (window.confirm(t.deleteConfirm)) { onUpdate(personnel.filter(p => p.id !== id)); if (editingId === id) handleCancelEdit(); } };
  const handleAddRole = () => { if (!newRoleName.trim() || availableRoles.includes(newRoleName.trim())) return; onUpdateConfig({ ...config, personnelRoles: [...availableRoles, newRoleName.trim()] }); setNewRoleName(''); };
  const handleDeleteRole = (roleToDelete: string) => { if (window.confirm(`Delete ${roleToDelete}?`)) { onUpdateConfig({ ...config, personnelRoles: availableRoles.filter(r => r !== roleToDelete) }); } };

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex justify-end"><button onClick={() => setShowRoleManager(!showRoleManager)} className="text-sm text-indigo-600 flex items-center gap-1 hover:underline"><IconSettings className="w-4 h-4" /> {t.rolesTitle}</button></div>
       {showRoleManager && (<div className="bg-gray-50 p-4 rounded-xl border border-indigo-100 mb-4 animate-fade-in"><div className="flex gap-2 mb-4"><input className="flex-grow px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-indigo-500" placeholder={t.rolePlaceholder} value={newRoleName} onChange={e => setNewRoleName(e.target.value)} /><button onClick={handleAddRole} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700">{t.add}</button></div><div className="flex flex-wrap gap-2">{availableRoles.map((role, idx) => (<div key={idx} className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"><span>{role}</span>{role !== 'مدیر' && (<button onClick={() => handleDeleteRole(role)} className="text-red-400 hover:text-red-600"><IconTrash className="w-3 h-3" /></button>)}</div>))}</div></div>)}
       <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-colors" style={editingId ? { borderColor: '#8b5cf6', borderWidth: '2px' } : {}}><div className="flex items-center gap-3 mb-6"><div className={`p-2 rounded-lg ${editingId ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600'}`}>{editingId ? <IconEdit className="w-5 h-5" /> : <IconPlus className="w-5 h-5" />}</div><h3 className="text-lg font-bold text-gray-800">{editingId ? t.editUser : t.newUser}</h3></div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
             <div className="md:col-span-3 flex flex-col items-center gap-4"><div onClick={() => !isProcessingImage && avatarInputRef.current?.click()} className={`w-32 h-32 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 hover:bg-gray-100 cursor-pointer overflow-hidden relative group transition-all ${isProcessingImage ? 'opacity-50 cursor-wait' : ''}`}>{formData.avatar ? (<img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />) : (<div className="text-center text-gray-400"><IconUsers className="w-8 h-8 mx-auto mb-1" /><span className="text-xs">{isProcessingImage ? t.uploading : t.uploadPhoto}</span></div>)}</div><input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarSelect} /></div>
             <div className="md:col-span-9 space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">{t.name}</label><input type="text" required className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})}/></div><div><label className="block text-sm font-medium text-gray-700 mb-1">{t.email}</label><input type="email" required className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}/></div></div>
                 <div><label className="block text-sm font-medium text-gray-700 mb-2">{t.roles}</label><div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-xl bg-gray-50 max-h-32 overflow-y-auto">{availableRoles.map((role) => (<button type="button" key={role} onClick={() => toggleRole(role)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${formData.roles.includes(role) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}>{role} {formData.roles.includes(role) && '✓'}</button>))}</div></div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">{t.manager}</label><select className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none bg-white" value={formData.reportsTo} onChange={e => setFormData({...formData, reportsTo: e.target.value})}><option value="">-</option>{personnel.filter(p => p.id !== editingId).map(p => (<option key={p.id} value={p.id}>{p.fullName} ({p.roles.join(', ')})</option>))}</select></div></div>
                 <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.jobDesc}</label><textarea rows={2} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none" value={formData.jobDescription} onChange={e => setFormData({...formData, jobDescription: e.target.value})}/></div>
             </div>
          </div>
          <div className="border-t border-gray-100 pt-4"><label className="block text-sm font-bold text-gray-700 mb-3">{t.permissions}</label><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3"><label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-3 py-3 rounded-lg border border-blue-100"><input type="checkbox" className="w-4 h-4" checked={formData.canAssign} onChange={e => setFormData({...formData, canAssign: e.target.checked})}/><span className="text-xs font-bold text-blue-800">{t.permAssign}</span></label><label className="flex items-center gap-2 cursor-pointer bg-purple-50 px-3 py-3 rounded-lg border border-purple-100"><input type="checkbox" className="w-4 h-4" checked={formData.canViewAllTickets} onChange={e => setFormData({...formData, canViewAllTickets: e.target.checked})}/><span className="text-xs font-bold text-purple-800">{t.permAllTickets}</span></label><label className="flex items-center gap-2 cursor-pointer bg-green-50 px-3 py-3 rounded-lg border border-green-100"><input type="checkbox" className="w-4 h-4" checked={formData.canViewCustomers} onChange={e => setFormData({...formData, canViewCustomers: e.target.checked})}/><span className="text-xs font-bold text-green-800">{t.permCustomers}</span></label><label className="flex items-center gap-2 cursor-pointer bg-amber-50 px-3 py-3 rounded-lg border border-amber-100"><input type="checkbox" className="w-4 h-4" checked={formData.canViewTariffs} onChange={e => setFormData({...formData, canViewTariffs: e.target.checked})}/><span className="text-xs font-bold text-amber-800">{t.permTariffs}</span></label><label className="flex items-center gap-2 cursor-pointer bg-rose-50 px-3 py-3 rounded-lg border border-rose-100"><input type="checkbox" className="w-4 h-4" checked={formData.canIssueInvoices} onChange={e => setFormData({...formData, canIssueInvoices: e.target.checked})}/><span className="text-xs font-bold text-rose-800">{t.permInvoice}</span></label></div></div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><IconPaperclip className="w-4 h-4 text-gray-500" />{t.docs}</h4><div className="flex gap-2 mb-4"><input className="flex-grow px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none" placeholder={t.docTitle} value={newDocTitle} onChange={e => setNewDocTitle(e.target.value)} /><button type="button" onClick={() => docInputRef.current?.click()} className="bg-white border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"><IconUpload className="w-4 h-4" />{newDocFile ? t.docFile : t.selectFile}</button><input type="file" ref={docInputRef} className="hidden" accept="image/*,.pdf" onChange={handleDocFileSelect} /><button type="button" onClick={handleAddDocument} disabled={!newDocFile || newDocFile.status !== 'success'} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">{t.add}</button></div><div className="space-y-2">{formData.documents.map((doc, idx) => (<div key={idx} className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded-lg"><div className="flex items-center gap-3"><div className="p-1.5 bg-gray-100 rounded text-gray-500"><IconFile className="w-4 h-4" /></div><div className="flex flex-col"><span className="text-sm font-bold text-gray-800">{doc.title}</span><a href={doc.file.content} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">View</a></div></div><button type="button" onClick={() => setFormData(p => ({...p, documents: p.documents.filter(d => d.id !== doc.id)}))} className="text-red-400 hover:bg-red-50 p-1.5 rounded"><IconTrash className="w-4 h-4" /></button></div>))}</div></div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><IconShield className="w-4 h-4 text-purple-600" />{t.loginInfo}</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-600 mb-1">{t.username}</label><input type="text" required className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none dir-ltr text-left" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})}/></div><div><label className="block text-sm font-medium text-gray-600 mb-1">{t.password}</label><input type="text" required className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none dir-ltr text-left" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}/></div></div></div>
          <div className="flex justify-end pt-2 gap-3">{editingId && (<button type="button" onClick={handleCancelEdit} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors font-medium">{t.cancel}</button>)}<button type="submit" disabled={isProcessingImage} className={`px-8 py-2 text-white rounded-lg transition-colors shadow-lg font-bold ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-purple-600 hover:bg-purple-700'} ${isProcessingImage ? 'opacity-50 cursor-not-allowed' : ''}`}>{editingId ? t.save : t.create}</button></div>
        </form>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{personnel.map(person => { const manager = personnel.find(p => p.id === person.reportsTo); return (<div key={person.id} className={`bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all relative group ${editingId === person.id ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-100'}`}><div className="flex items-start gap-4"><div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden border border-gray-100 ${person.roles.includes('مدیر') ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>{person.avatar ? (<img src={person.avatar} alt={person.fullName} className="w-full h-full object-cover" />) : (person.fullName.charAt(0))}</div><div className="flex-grow"><h4 className="font-bold text-gray-900">{person.fullName}</h4><div className="flex flex-wrap gap-1.5 mt-2 mb-2">{person.roles && person.roles.map((role, rIdx) => (<span key={rIdx} className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">{role}</span>))}</div>{manager && (<div className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded mb-2 inline-flex items-center gap-1"><IconLayout className="w-3 h-3" /> Report: {manager.fullName}</div>)}</div></div><div className="mt-2 text-sm space-y-2"><div className="text-gray-500 flex justify-between"><span>{t.emailLbl}</span><span>{person.email}</span></div><div className="text-gray-500 flex justify-between bg-gray-50 px-2 py-1 rounded"><span>{t.usernameLbl}</span><span className="font-mono">{person.username}</span></div>{person.documents && person.documents.length > 0 && (<div className="mt-3 pt-3 border-t border-gray-100"><span className="text-xs text-gray-500 block mb-1">{t.docsLbl}</span><div className="flex flex-wrap gap-1">{person.documents.map((d, i) => (<a key={i} href={d.file.content} target="_blank" rel="noreferrer" className="text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-600 border border-gray-200 block truncate max-w-[100px]">{d.title}</a>))}</div></div>)}</div><div className="absolute top-4 rtl:left-4 ltr:right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => handleEdit(person)} className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"><IconEdit className="w-4 h-4" /></button><button onClick={() => handleRemove(person.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"><IconTrash className="w-4 h-4" /></button></div></div>)})}</div>
    </div>
  );
};
