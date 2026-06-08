
import React, { useState, useRef, useCallback } from 'react';
import { Personnel, AppConfig, PersonnelDocument, AttachedFile, Department } from '../types';
import { IconPlus, IconTrash, IconShield, IconEdit, IconCheck, IconSettings, IconUsers, IconMoney, IconBriefcase, IconUpload, IconFile, IconPaperclip, IconLayout, IconInvoice } from './Icons';
import { uploadFileWithProgress } from '../services/firebaseService';
import { Language } from '../App';

// ── Job Description — bilingual structured format ──
interface BL { fa: string; en: string; }
interface CommissionEntry { department: BL; process: BL; percentage: number; basis: BL; }
interface PolicyEntry { title: BL; rule: BL; }

interface JobDescData {
  meta: { company: BL; documentType: string; version: string; lastUpdated: string; };
  position: BL;
  department: BL;
  reportsTo: BL;
  employmentType: BL;
  summary: BL;
  responsibilities: BL[];
  requiredSkills: BL[];
  qualifications: BL;
  workingHours: BL;
  compensation: { model: BL; baseSalary: null; commission: CommissionEntry[]; };
  kpis: BL[];
  companyPolicies: PolicyEntry[];
  notes: BL;
}

const bl = (fa = '', en = ''): BL => ({ fa, en });

const emptyJD = (): JobDescData => ({
  meta: { company: bl('مرکز راهکارهای کسب‌وکار توحید دیهمی', 'Tohid Dayhami Business Solutions Center SPC'), documentType: 'job_description', version: '1.0', lastUpdated: new Date().toISOString().slice(0, 10) },
  position: bl(), department: bl(), reportsTo: bl(), employmentType: bl(),
  summary: bl(),
  responsibilities: [bl()], requiredSkills: [bl()],
  qualifications: bl(), workingHours: bl(),
  compensation: { model: bl(), baseSalary: null, commission: [{ department: bl(), process: bl(), percentage: 0, basis: bl() }] },
  kpis: [bl()],
  companyPolicies: [{ title: bl(), rule: bl() }],
  notes: bl(),
});

const SAMPLE_JD: JobDescData = {
  meta: { company: bl('مرکز راهکارهای کسب‌وکار توحید دیهمی', 'Tohid Dayhami Business Solutions Center SPC'), documentType: 'job_description', version: '1.0', lastUpdated: '2026-06-05' },
  position:       bl('کارشناس صادرات', 'Export Specialist'),
  department:     bl('واحد بازرگانی', 'Commercial Unit'),
  reportsTo:      bl('مدیر بازرگانی', 'Commercial Manager'),
  employmentType: bl('پورسانتی (درصدی)', 'Commission-based'),
  summary: bl(
    'مسئولیت اجرا و پیگیری فرآیندهای صادراتی، ارتباط با مشتریان بین‌المللی و هماهنگی با تیم‌های داخلی برای تحقق اهداف صادراتی شرکت.',
    "Responsible for executing export processes, liaising with international clients, and coordinating with internal teams to meet the company's export targets."
  ),
  responsibilities: [
    bl('بررسی و پردازش درخواست‌های صادراتی مشتریان', "Review and process clients' export requests"),
    bl('هماهنگی با شرکت‌های حمل‌ونقل بین‌المللی', 'Coordinate with international freight forwarders'),
    bl('تهیه و تکمیل مستندات گمرکی و صادراتی', 'Prepare and complete customs and export documents'),
    bl('پاسخگویی به استعلام مشتریان در کمتر از ۴ ساعت', 'Respond to client inquiries within 4 hours'),
  ],
  requiredSkills: [
    bl('آشنایی کامل با قوانین گمرکی و صادراتی', 'Thorough knowledge of customs and export regulations'),
    bl('تسلط به انگلیسی — حداقل B2', 'English proficiency — minimum B2'),
    bl('مهارت در Word و Excel', 'Proficiency in Word and Excel'),
  ],
  qualifications: bl(
    'کارشناسی یا بالاتر در بازرگانی، مدیریت یا اقتصاد. حداقل ۲ سال سابقه مرتبط در تجارت بین‌الملل.',
    "Bachelor's or higher in Commerce, Management or Economics. Min. 2 years relevant experience in international trade."
  ),
  workingHours: bl('یکشنبه تا چهارشنبه ۹:۰۰–۱۷:۰۰ — پنجشنبه ۹:۰۰–۱۳:۰۰', 'Sunday–Wednesday 09:00–17:00 — Thursday 09:00–13:00'),
  compensation: {
    model: bl('پورسانتی (درصدی)', 'Commission-based'),
    baseSalary: null,
    commission: [
      { department: bl('واحد بازرگانی', 'Commercial Unit'), process: bl('قرارداد صادراتی نهایی‌شده', 'Finalized export contract'), percentage: 10, basis: bl('بر مبنای حاشیه سود قرارداد', 'Based on contract profit margin') },
      { department: bl('واحد مشاوره', 'Consulting Unit'), process: bl('جذب پروژه مشاوره صادرات', 'Acquiring an export-consulting project'), percentage: 15, basis: bl('بر مبنای ارزش قرارداد مشاوره', 'Based on consulting contract value') },
    ],
  },
  kpis: [
    bl('پرونده‌های صادراتی ماهانه — هدف: ۲۰', 'Monthly export cases — target: 20'),
    bl('رضایت مشتری — هدف: ۹۰٪+', 'Client satisfaction — target: 90%+'),
    bl('زمان پاسخگویی — هدف: زیر ۴ ساعت', 'Response time — target: under 4h'),
  ],
  companyPolicies: [
    { title: bl('ساعت کاری و حضور آنلاین', 'Working Hours & Online Presence'), rule: bl('ساعت کاری رسمی یکشنبه تا چهارشنبه ۹:۰۰–۱۷:۰۰ و پنجشنبه ۹:۰۰–۱۳:۰۰ است. حضور آنلاین در تمام ساعات کاری الزامی است؛ در صورت عدم حضور، تکمیل برگه‌ی مرخصی ضروری است.', 'Official hours: Sun–Wed 09:00–17:00, Thu 09:00–13:00. Being online during all working hours is mandatory; otherwise a leave form must be completed.') },
    { title: bl('فرهنگ نتیجه‌محور', 'Results-Oriented Culture'), rule: bl('ارزیابی عملکرد اساساً بر مبنای تحقق نتایج و KPIهاست، نه صرف حضور.', 'Performance is judged primarily on results and KPIs, not mere attendance.') },
    { title: bl('انجام کار صرفاً در قالب رسمی شرکت', 'Work Solely Within the Company Framework'), rule: bl('تمامی کارها و تعاملات با مشتریان باید فقط در قالب رسمی شرکت انجام شود. ورود به هرگونه قرارداد فردی و مستقل با مشتریان شرکت اکیداً ممنوع است.', "All work and interactions with clients must occur solely within the official company framework. Entering into any individual or independent contract with the company's clients is strictly prohibited.") },
  ],
  notes: bl('امکان دورکاری جزئی در روزهای مشخص پس از گذراندن دوره آزمایشی.', 'Partial remote work on designated days is possible after probation.'),
};

const parseJD = (str: string): JobDescData => {
  if (!str) return emptyJD();
  try {
    const p = JSON.parse(str);
    const em = emptyJD();
    // Support new bilingual format
    if (p.position?.fa || p.summary?.fa) {
      return {
        ...em, ...p,
        responsibilities:  p.responsibilities?.length  ? p.responsibilities  : [bl()],
        requiredSkills:    p.requiredSkills?.length     ? p.requiredSkills    : [bl()],
        kpis:              p.kpis?.length               ? p.kpis              : [bl()],
        companyPolicies:   p.companyPolicies?.length    ? p.companyPolicies   : [{ title: bl(), rule: bl() }],
        compensation:      p.compensation               ? p.compensation      : em.compensation,
      };
    }
    // Legacy plain-string format → migrate to bilingual
    return {
      ...em,
      position:        bl(p.position || '', ''),
      department:      bl(p.department || '', ''),
      summary:         bl(p.summary || (typeof str === 'string' && !p.position ? str : ''), ''),
      responsibilities: (p.responsibilities || ['']).map((r: string) => bl(r, '')),
      requiredSkills:   (p.requiredSkills   || ['']).map((s: string) => bl(s, '')),
      qualifications:  bl(p.qualifications || '', ''),
      workingHours:    bl(p.workingHours || '', ''),
      kpis:            (p.kpis || ['']).map((k: string) => bl(k, '')),
      notes:           bl(p.notes || '', ''),
    };
  } catch {
    return { ...emptyJD(), summary: bl(str, '') };
  }
};

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
  const [newRoleDept, setNewRoleDept] = useState(''); // department id for the position being added
  const [newDeptName, setNewDeptName] = useState('');
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null); // department being renamed
  const [editingDeptName, setEditingDeptName] = useState('');
  const [editingDeptLabel, setEditingDeptLabel] = useState(''); // custom Contact Us label for the department being edited
  const [showRoleManager, setShowRoleManager] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '', roles: [] as string[], jobDescription: '', reportsTo: '', email: '', username: '', password: '', avatar: '', documents: [] as PersonnelDocument[],
    canAssign: false, canViewCustomers: false, canViewTariffs: false, canViewAllTickets: false, canIssueInvoices: false
  });

  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocFile, setNewDocFile] = useState<AttachedFile | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const jobDescImportRef = useRef<HTMLInputElement>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Job Description modal state
  const [showJDModal, setShowJDModal] = useState(false);
  const [jdDraft, setJdDraft] = useState<JobDescData>(emptyJD());

  const openJDModal = () => { setJdDraft(parseJD(formData.jobDescription)); setShowJDModal(true); };
  const saveJD = () => { setFormData(f => ({ ...f, jobDescription: JSON.stringify(jdDraft, null, 2) })); setShowJDModal(false); };

  const downloadJDSample = () => {
    const blob = new Blob([JSON.stringify(SAMPLE_JD, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'job_description_sample.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleJDImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        setJdDraft(parseJD(JSON.stringify(parsed)));
        setShowJDModal(true);
      } catch { alert('فایل JSON نامعتبر است'); }
    };
    reader.readAsText(file); e.target.value = '';
  };

  // BL list helpers (responsibilities, requiredSkills, kpis)
  const setBLItem = (key: 'responsibilities' | 'requiredSkills' | 'kpis', idx: number, lang: 'fa'|'en', val: string) =>
    setJdDraft(d => { const arr = [...d[key]] as BL[]; arr[idx] = { ...arr[idx], [lang]: val }; return { ...d, [key]: arr }; });
  const addBLItem = (key: 'responsibilities' | 'requiredSkills' | 'kpis') =>
    setJdDraft(d => ({ ...d, [key]: [...d[key], bl()] }));
  const removeBLItem = (key: 'responsibilities' | 'requiredSkills' | 'kpis', idx: number) =>
    setJdDraft(d => ({ ...d, [key]: (d[key] as BL[]).filter((_, i) => i !== idx) }));

  // Policy helpers
  const addPolicy = () => setJdDraft(d => ({ ...d, companyPolicies: [...d.companyPolicies, { title: bl(), rule: bl() }] }));
  const removePolicy = (idx: number) => setJdDraft(d => ({ ...d, companyPolicies: d.companyPolicies.filter((_, i) => i !== idx) }));
  const setPolicy = (idx: number, field: 'title'|'rule', lang: 'fa'|'en', val: string) =>
    setJdDraft(d => { const arr = [...d.companyPolicies]; arr[idx] = { ...arr[idx], [field]: { ...arr[idx][field], [lang]: val } }; return { ...d, companyPolicies: arr }; });

  // Commission helpers
  const addCommission = () => setJdDraft(d => ({ ...d, compensation: { ...d.compensation, commission: [...d.compensation.commission, { department: bl(), process: bl(), percentage: 0, basis: bl() }] } }));
  const removeCommission = (idx: number) => setJdDraft(d => ({ ...d, compensation: { ...d.compensation, commission: d.compensation.commission.filter((_, i) => i !== idx) } }));
  const setCommission = (idx: number, field: keyof CommissionEntry, lang: 'fa'|'en'|'pct', val: string) =>
    setJdDraft(d => { const arr = [...d.compensation.commission]; if (lang === 'pct') { arr[idx] = { ...arr[idx], percentage: parseFloat(val) || 0 }; } else { arr[idx] = { ...arr[idx], [field]: { ...(arr[idx][field as 'department'] as BL), [lang]: val } }; } return { ...d, compensation: { ...d.compensation, commission: arr } }; });

  const availableRoles = config.personnelRoles || ['مدیر', 'کارشناس صادرات', 'طراح گرافیک/بسته بندی', 'پشتیبانی', 'کارشناس آموزش'];
  const departments: Department[] = config.departments || [];

  // The department a given position belongs to (or undefined if unassigned)
  const deptOfRole = (roleName: string): Department | undefined => departments.find(d => (d.positions || []).includes(roleName));
  // Positions not assigned to any department
  const unassignedRoles = availableRoles.filter(r => !deptOfRole(r));

  const t = {
      fa: {
          rolesTitle: 'مدیریت سمت‌ها و دپارتمان‌ها',
          rolePlaceholder: 'عنوان سمت جدید',
          deptManageTitle: 'دپارتمان‌ها',
          deptPlaceholder: 'نام دپارتمان جدید (مثلا: صادرات)',
          editDept: 'ویرایش عنوان',
          saveDept: 'ذخیره',
          cancelDept: 'انصراف',
          showInContact: 'نمایش در فرم تماس با ما',
          hiddenInContact: 'مخفی از فرم تماس با ما',
          deptNameLabel: 'نام دپارتمان',
          contactLabelPlaceholder: 'لیبل در تماس با ما (اختیاری، مثلا: ارتباط با مدیرعامل)',
          rolesByDeptTitle: 'سمت‌ها بر اساس دپارتمان',
          noDepartment: 'بدون دپارتمان',
          selectDeptForRole: 'دپارتمان',
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
          rolesTitle: 'Manage Roles & Departments',
          rolePlaceholder: 'New Role Title',
          deptManageTitle: 'Departments',
          deptPlaceholder: 'New department name (e.g. Export)',
          editDept: 'Edit title',
          saveDept: 'Save',
          cancelDept: 'Cancel',
          showInContact: 'Shown in Contact Us form',
          hiddenInContact: 'Hidden from Contact Us form',
          deptNameLabel: 'Department name',
          contactLabelPlaceholder: 'Contact Us label (optional, e.g. "Contact the CEO")',
          rolesByDeptTitle: 'Positions by Department',
          noDepartment: 'No Department',
          selectDeptForRole: 'Department',
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
      uploadFileWithProgress(file, () => {}, (url) => { setFormData(prev => ({ ...prev, avatar: url })); setIsProcessingImage(false); }, (err) => { alert(err.message); setIsProcessingImage(false); }, 'images');
  };

  const handleDocFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        setNewDocFile({ name: file.name, size: file.size, type: file.type, content: '', status: 'error', errorMsg: 'حداکثر حجم مجاز ۱۰ مگابایت است' });
        return;
      }
      setNewDocFile({ name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 });
      uploadFileWithProgress(
        file,
        (progress) => { setNewDocFile(prev => prev ? { ...prev, progress } : null); },
        (url)      => { setNewDocFile(prev => prev ? { ...prev, content: url, status: 'success', progress: 100 } : null); },
        (err)      => { setNewDocFile(prev => prev ? { ...prev, status: 'error', errorMsg: err.message } : null); },
        'documents'
      );
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
  const handleAddRole = () => {
    const name = newRoleName.trim();
    if (!name || availableRoles.includes(name)) return;
    // Optionally place the new position into the selected department
    const nextDepts = newRoleDept
      ? departments.map(d => d.id === newRoleDept ? { ...d, positions: [...(d.positions || []), name] } : d)
      : departments;
    onUpdateConfig({ ...config, personnelRoles: [...availableRoles, name], departments: nextDepts });
    setNewRoleName('');
  };
  const handleDeleteRole = (roleToDelete: string) => {
    if (roleToDelete === 'مدیر') return;
    if (window.confirm(`Delete ${roleToDelete}?`)) {
      onUpdateConfig({
        ...config,
        personnelRoles: availableRoles.filter(r => r !== roleToDelete),
        departments: departments.map(d => ({ ...d, positions: (d.positions || []).filter(p => p !== roleToDelete) })),
      });
    }
  };
  // Move a position to a department (empty deptId => unassigned)
  const handleAssignRoleToDept = (roleName: string, deptId: string) => {
    const nextDepts = departments.map(d => {
      const has = (d.positions || []).includes(roleName);
      if (d.id === deptId) return has ? d : { ...d, positions: [...(d.positions || []), roleName] };
      return has ? { ...d, positions: (d.positions || []).filter(p => p !== roleName) } : d;
    });
    onUpdateConfig({ ...config, departments: nextDepts });
  };
  const handleAddDepartment = () => {
    const name = newDeptName.trim();
    if (!name || departments.some(d => d.name === name)) return;
    const newDept: Department = { id: `dept-${Date.now()}`, name, positions: [] };
    onUpdateConfig({ ...config, departments: [...departments, newDept] });
    setNewDeptName('');
  };
  const handleDeleteDepartment = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    if (window.confirm(`حذف دپارتمان «${dept?.name}»؟ سمت‌های آن حذف نمی‌شوند و بدون دپارتمان باقی می‌مانند.`)) {
      onUpdateConfig({ ...config, departments: departments.filter(d => d.id !== deptId) });
    }
  };
  // Begin / save / cancel renaming a department title (and its custom Contact Us label)
  const startEditDept = (dept: Department) => { setEditingDeptId(dept.id); setEditingDeptName(dept.name); setEditingDeptLabel(dept.contactLabel || ''); };
  const cancelEditDept = () => { setEditingDeptId(null); setEditingDeptName(''); setEditingDeptLabel(''); };
  const saveEditDept = () => {
    const name = editingDeptName.trim();
    if (!name) return;
    // Block duplicate names (ignoring the department being edited)
    if (departments.some(d => d.id !== editingDeptId && d.name === name)) { cancelEditDept(); return; }
    const contactLabel = editingDeptLabel.trim();
    onUpdateConfig({ ...config, departments: departments.map(d => d.id === editingDeptId ? { ...d, name, contactLabel: contactLabel || undefined } : d) });
    cancelEditDept();
  };
  // Toggle whether a department appears in the public "Contact Us" form
  const handleToggleDeptContact = (deptId: string) => {
    onUpdateConfig({
      ...config,
      departments: departments.map(d => d.id === deptId ? { ...d, showInContact: d.showInContact === false } : d),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex justify-end"><button onClick={() => setShowRoleManager(!showRoleManager)} className="text-sm text-indigo-600 flex items-center gap-1 hover:underline"><IconSettings className="w-4 h-4" /> {t.rolesTitle}</button></div>
       {showRoleManager && (
         <div className="bg-gray-50 p-4 rounded-xl border border-indigo-100 mb-4 animate-fade-in space-y-5">
           {/* ── Departments ── */}
           <div>
             <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5"><IconBriefcase className="w-4 h-4 text-indigo-500" /> {t.deptManageTitle}</h4>
             <div className="flex gap-2 mb-3">
               <input className="flex-grow px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-indigo-500" placeholder={t.deptPlaceholder} value={newDeptName} onChange={e => setNewDeptName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddDepartment(); } }} />
               <button type="button" onClick={handleAddDepartment} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700">{t.add}</button>
             </div>
             <div className="flex flex-wrap gap-2">
               {departments.length === 0 && <span className="text-xs text-gray-400">{lang === 'fa' ? 'هنوز دپارتمانی تعریف نشده است.' : 'No departments defined yet.'}</span>}
               {departments.map(d => {
                 const visibleInContact = d.showInContact !== false;
                 return (
                 <div key={d.id} className={`bg-white border border-indigo-200 rounded-lg text-sm ${editingDeptId === d.id ? 'p-2 w-full sm:w-auto' : 'px-3 py-1.5 flex items-center gap-2'}`}>
                   {editingDeptId === d.id ? (
                     <div className="flex flex-col gap-1.5 min-w-[220px]">
                       <input
                         autoFocus
                         className="px-2 py-1 rounded border border-indigo-300 text-sm outline-none focus:border-indigo-500 w-full"
                         placeholder={t.deptNameLabel}
                         value={editingDeptName}
                         onChange={e => setEditingDeptName(e.target.value)}
                         onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEditDept(); } else if (e.key === 'Escape') { e.preventDefault(); cancelEditDept(); } }}
                       />
                       <input
                         className="px-2 py-1 rounded border border-gray-200 text-xs outline-none focus:border-indigo-500 w-full"
                         placeholder={t.contactLabelPlaceholder}
                         value={editingDeptLabel}
                         onChange={e => setEditingDeptLabel(e.target.value)}
                         onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEditDept(); } else if (e.key === 'Escape') { e.preventDefault(); cancelEditDept(); } }}
                       />
                       <div className="flex items-center gap-2 justify-end">
                         <button type="button" onClick={saveEditDept} title={t.saveDept} className="text-emerald-500 hover:text-emerald-700 flex items-center gap-1 text-xs font-bold"><IconCheck className="w-3.5 h-3.5" />{t.saveDept}</button>
                         <button type="button" onClick={cancelEditDept} title={t.cancelDept} className="text-gray-400 hover:text-gray-600 text-xs font-bold">✕</button>
                       </div>
                     </div>
                   ) : (
                     <>
                       <span className="font-medium text-indigo-700">{d.name}</span>
                       {(d.contactLabel || '').trim() && <span className="text-[10px] text-gray-400 italic" title={t.contactLabelPlaceholder}>«{d.contactLabel}»</span>}
                       <span className="text-[10px] text-gray-400">({(d.positions || []).length})</span>
                       <button
                         type="button"
                         onClick={() => handleToggleDeptContact(d.id)}
                         title={visibleInContact ? t.showInContact : t.hiddenInContact}
                         className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${visibleInContact ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                       >
                         {visibleInContact ? '👁 ' + t.showInContact : t.hiddenInContact}
                       </button>
                       <button type="button" onClick={() => startEditDept(d)} title={t.editDept} className="text-indigo-400 hover:text-indigo-600"><IconEdit className="w-3 h-3" /></button>
                       <button type="button" onClick={() => handleDeleteDepartment(d.id)} className="text-red-400 hover:text-red-600"><IconTrash className="w-3 h-3" /></button>
                     </>
                   )}
                 </div>
                 );
               })}
             </div>
           </div>

           {/* ── Add position (optionally into a department) ── */}
           <div className="border-t border-gray-200 pt-4">
             <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5"><IconUsers className="w-4 h-4 text-indigo-500" /> {t.rolesByDeptTitle}</h4>
             <div className="flex gap-2 mb-4 flex-wrap">
               <input className="flex-grow min-w-[140px] px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-indigo-500" placeholder={t.rolePlaceholder} value={newRoleName} onChange={e => setNewRoleName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRole(); } }} />
               <select className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white outline-none focus:border-indigo-500" value={newRoleDept} onChange={e => setNewRoleDept(e.target.value)}>
                 <option value="">{t.noDepartment}</option>
                 {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
               </select>
               <button type="button" onClick={handleAddRole} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700">{t.add}</button>
             </div>

             {/* Positions grouped by department */}
             <div className="space-y-3">
               {[...departments, { id: '', name: t.noDepartment, positions: unassignedRoles } as Department].map(group => {
                 const groupRoles = group.id ? (group.positions || []).filter(r => availableRoles.includes(r)) : unassignedRoles;
                 if (group.id && groupRoles.length === 0) return null;
                 if (!group.id && groupRoles.length === 0) return null;
                 return (
                   <div key={group.id || '__none__'}>
                     <p className={`text-xs font-bold mb-1.5 ${group.id ? 'text-indigo-600' : 'text-gray-400'}`}>{group.name}</p>
                     <div className="flex flex-wrap gap-2">
                       {groupRoles.map(role => (
                         <div key={role} className="bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg text-sm flex items-center gap-2">
                           <span>{role}</span>
                           <select
                             className="text-[11px] bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-500 max-w-[110px]"
                             value={deptOfRole(role)?.id || ''}
                             onChange={e => handleAssignRoleToDept(role, e.target.value)}
                             title={t.selectDeptForRole}
                           >
                             <option value="">{t.noDepartment}</option>
                             {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                           </select>
                           {role !== 'مدیر' && (<button type="button" onClick={() => handleDeleteRole(role)} className="text-red-400 hover:text-red-600"><IconTrash className="w-3 h-3" /></button>)}
                         </div>
                       ))}
                     </div>
                   </div>
                 );
               })}
             </div>
           </div>
         </div>
       )}
       <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-colors" style={editingId ? { borderColor: '#8b5cf6', borderWidth: '2px' } : {}}><div className="flex items-center gap-3 mb-6"><div className={`p-2 rounded-lg ${editingId ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600'}`}>{editingId ? <IconEdit className="w-5 h-5" /> : <IconPlus className="w-5 h-5" />}</div><h3 className="text-lg font-bold text-gray-800">{editingId ? t.editUser : t.newUser}</h3></div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
             <div className="md:col-span-3 flex flex-col items-center gap-4"><div onClick={() => !isProcessingImage && avatarInputRef.current?.click()} className={`w-32 h-32 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 hover:bg-gray-100 cursor-pointer overflow-hidden relative group transition-all ${isProcessingImage ? 'opacity-50 cursor-wait' : ''}`}>{formData.avatar ? (<img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />) : (<div className="text-center text-gray-400"><IconUsers className="w-8 h-8 mx-auto mb-1" /><span className="text-xs">{isProcessingImage ? t.uploading : t.uploadPhoto}</span></div>)}</div><input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarSelect} /></div>
             <div className="md:col-span-9 space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">{t.name}</label><input type="text" required className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})}/></div><div><label className="block text-sm font-medium text-gray-700 mb-1">{t.email}</label><input type="email" required className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}/></div></div>
                 <div><label className="block text-sm font-medium text-gray-700 mb-2">{t.roles}</label>
                   <div className="p-3 border border-gray-200 rounded-xl bg-gray-50 max-h-48 overflow-y-auto space-y-3">
                     {[...departments, { id: '', name: t.noDepartment, positions: unassignedRoles } as Department].map(group => {
                       const groupRoles = group.id ? (group.positions || []).filter(r => availableRoles.includes(r)) : unassignedRoles;
                       if (groupRoles.length === 0) return null;
                       return (
                         <div key={group.id || '__none__'}>
                           <p className={`text-[11px] font-bold mb-1.5 ${group.id ? 'text-indigo-600' : 'text-gray-400'}`}>{group.name}</p>
                           <div className="flex flex-wrap gap-2">
                             {groupRoles.map(role => (
                               <button type="button" key={role} onClick={() => toggleRole(role)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${formData.roles.includes(role) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}>{role} {formData.roles.includes(role) && '✓'}</button>
                             ))}
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">{t.manager}</label><select className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none bg-white" value={formData.reportsTo} onChange={e => setFormData({...formData, reportsTo: e.target.value})}><option value="">-</option>{personnel.filter(p => p.id !== editingId).map(p => (<option key={p.id} value={p.id}>{p.fullName} ({p.roles.join(', ')})</option>))}</select></div></div>
                 <div>
                   <input type="file" ref={jobDescImportRef} className="hidden" accept=".json,application/json" onChange={handleJDImport} />
                   <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                     <label className="text-sm font-medium text-gray-700">{t.jobDesc}</label>
                     <div className="flex gap-1.5">
                       <button type="button" onClick={downloadJDSample} className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 flex items-center gap-1">⬇ نمونه JSON</button>
                       <button type="button" onClick={() => jobDescImportRef.current?.click()} className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 flex items-center gap-1">📂 وارد کردن</button>
                       <button type="button" onClick={openJDModal} className="text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 flex items-center gap-1">✏ ویرایش</button>
                     </div>
                   </div>
                   {formData.jobDescription ? (
                     <button type="button" onClick={openJDModal} className="w-full text-right bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 hover:border-indigo-300 transition-colors">
                       {(() => { try { const d = JSON.parse(formData.jobDescription); const pos = d.position?.fa || d.position || '—'; const dept = d.department?.fa || d.department || ''; const sum = d.summary?.fa || d.summary || ''; return <span><span className="font-bold text-gray-800">{pos}</span>{dept ? ` · ${dept}` : ''}{sum ? ` — ${sum.slice(0, 80)}${sum.length > 80 ? '...' : ''}` : ''}</span>; } catch { return <span>{formData.jobDescription.slice(0, 100)}</span>; } })()}
                     </button>
                   ) : (
                     <button type="button" onClick={openJDModal} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors">
                       + کلیک کنید تا شرح شغل تعریف کنید
                     </button>
                   )}
                 </div>
             </div>
          </div>
          <div className="border-t border-gray-100 pt-4"><label className="block text-sm font-bold text-gray-700 mb-3">{t.permissions}</label><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3"><label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-3 py-3 rounded-lg border border-blue-100"><input type="checkbox" className="w-4 h-4" checked={formData.canAssign} onChange={e => setFormData({...formData, canAssign: e.target.checked})}/><span className="text-xs font-bold text-blue-800">{t.permAssign}</span></label><label className="flex items-center gap-2 cursor-pointer bg-purple-50 px-3 py-3 rounded-lg border border-purple-100"><input type="checkbox" className="w-4 h-4" checked={formData.canViewAllTickets} onChange={e => setFormData({...formData, canViewAllTickets: e.target.checked})}/><span className="text-xs font-bold text-purple-800">{t.permAllTickets}</span></label><label className="flex items-center gap-2 cursor-pointer bg-green-50 px-3 py-3 rounded-lg border border-green-100"><input type="checkbox" className="w-4 h-4" checked={formData.canViewCustomers} onChange={e => setFormData({...formData, canViewCustomers: e.target.checked})}/><span className="text-xs font-bold text-green-800">{t.permCustomers}</span></label><label className="flex items-center gap-2 cursor-pointer bg-amber-50 px-3 py-3 rounded-lg border border-amber-100"><input type="checkbox" className="w-4 h-4" checked={formData.canViewTariffs} onChange={e => setFormData({...formData, canViewTariffs: e.target.checked})}/><span className="text-xs font-bold text-amber-800">{t.permTariffs}</span></label><label className="flex items-center gap-2 cursor-pointer bg-rose-50 px-3 py-3 rounded-lg border border-rose-100"><input type="checkbox" className="w-4 h-4" checked={formData.canIssueInvoices} onChange={e => setFormData({...formData, canIssueInvoices: e.target.checked})}/><span className="text-xs font-bold text-rose-800">{t.permInvoice}</span></label></div></div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <IconPaperclip className="w-4 h-4 text-indigo-500" />
              {t.docs}
              <span className="text-xs font-normal text-gray-400 mr-auto">حداکثر ۱۰ MB · PDF، Word، Excel، تصویر</span>
            </h4>

            {/* ── Add new doc ── */}
            <div className="space-y-2 mb-4">
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-1 focus:ring-indigo-300"
                placeholder={t.docTitle}
                value={newDocTitle}
                onChange={e => setNewDocTitle(e.target.value)}
              />

              {/* File drop zone / picker */}
              {!newDocFile ? (
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-xl py-5 text-sm text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors flex flex-col items-center gap-1.5"
                >
                  <IconUpload className="w-6 h-6" />
                  <span>{t.selectFile}</span>
                  <span className="text-[11px] text-gray-300">PDF · Word · Excel · PowerPoint · تصویر</span>
                </button>
              ) : (
                <div className={`bg-white border rounded-xl p-3 transition-colors ${
                  newDocFile.status === 'success' ? 'border-green-200' :
                  newDocFile.status === 'error'   ? 'border-red-200'   :
                  'border-indigo-200'}`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      newDocFile.status === 'success' ? 'bg-green-50 text-green-500' :
                      newDocFile.status === 'error'   ? 'bg-red-50 text-red-400'    :
                      'bg-indigo-50 text-indigo-400'}`}>
                      <IconFile className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 font-medium truncate">{newDocFile.name}</p>
                      <p className="text-[11px] text-gray-400">
                        {(newDocFile.size / 1024 < 1024)
                          ? `${(newDocFile.size / 1024).toFixed(0)} KB`
                          : `${(newDocFile.size / 1024 / 1024).toFixed(1)} MB`}
                        {newDocFile.status === 'uploading' && ` · در حال آپلود ${newDocFile.progress || 0}%`}
                        {newDocFile.status === 'success'   && ' · آپلود شد ✓'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setNewDocFile(null); if (docInputRef.current) docInputRef.current.value = ''; }}
                      className="text-gray-300 hover:text-red-400 transition-colors shrink-0 text-lg leading-none px-1"
                    >×</button>
                  </div>

                  {/* Progress bar */}
                  {newDocFile.status === 'uploading' && (
                    <div className="mt-2.5 w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${newDocFile.progress || 0}%` }}
                      />
                    </div>
                  )}

                  {/* Error message */}
                  {newDocFile.status === 'error' && (
                    <p className="mt-1.5 text-xs text-red-500">{newDocFile.errorMsg}</p>
                  )}
                </div>
              )}

              <input
                type="file"
                ref={docInputRef}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                onChange={handleDocFileSelect}
              />

              <button
                type="button"
                onClick={handleAddDocument}
                disabled={!newDocTitle.trim() || !newDocFile || newDocFile.status !== 'success'}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <IconPlus className="w-4 h-4" />
                {t.add}
              </button>
            </div>

            {/* ── Document list ── */}
            {formData.documents.length > 0 && (
              <div className="space-y-2 border-t border-gray-200 pt-3">
                {formData.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between bg-white border border-gray-100 p-2.5 rounded-xl hover:border-gray-200 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500 shrink-0">
                        <IconFile className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{doc.title}</p>
                        <a
                          href={doc.file.content}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-indigo-500 hover:underline flex items-center gap-0.5"
                        >
                          <IconPaperclip className="w-3 h-3" />
                          {doc.file.name}
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, documents: p.documents.filter(d => d.id !== doc.id) }))}
                      className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><IconShield className="w-4 h-4 text-purple-600" />{t.loginInfo}</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-600 mb-1">{t.username}</label><input type="text" required className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none dir-ltr text-left" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})}/></div><div><label className="block text-sm font-medium text-gray-600 mb-1">{t.password}</label><input type="text" required className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none dir-ltr text-left" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}/></div></div></div>
          <div className="flex justify-end pt-2 gap-3">{editingId && (<button type="button" onClick={handleCancelEdit} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors font-medium">{t.cancel}</button>)}<button type="submit" disabled={isProcessingImage} className={`px-8 py-2 text-white rounded-lg transition-colors shadow-lg font-bold ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-purple-600 hover:bg-purple-700'} ${isProcessingImage ? 'opacity-50 cursor-not-allowed' : ''}`}>{editingId ? t.save : t.create}</button></div>
        </form>
      </div>
      {/* ── Job Description Modal ── */}
      {showJDModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm">📋</span>
                شرح شغل استاندارد
              </h3>
              <div className="flex gap-2">
                <button type="button" onClick={downloadJDSample} className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">⬇ نمونه JSON</button>
                <button type="button" onClick={() => jobDescImportRef.current?.click()} className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">📂 وارد کردن JSON</button>
                <button type="button" onClick={() => setShowJDModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">×</button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

              {/* Helper: bilingual row label */}
              {/* Meta */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 grid grid-cols-3 gap-3 text-xs text-gray-500">
                <div><span className="font-bold">شرکت (FA):</span> {jdDraft.meta.company.fa}</div>
                <div><span className="font-bold">Company (EN):</span> {jdDraft.meta.company.en}</div>
                <div><span className="font-bold">تاریخ:</span> {jdDraft.meta.lastUpdated}</div>
              </div>

              {/* Helper component inline for bilingual text field */}
              {([
                { label: 'عنوان شغلی / Position', key: 'position' as const, ph: { fa: 'کارشناس صادرات', en: 'Export Specialist' } },
                { label: 'واحد سازمانی / Department', key: 'department' as const, ph: { fa: 'واحد بازرگانی', en: 'Commercial Unit' } },
                { label: 'گزارش‌دهی به / Reports To', key: 'reportsTo' as const, ph: { fa: 'مدیر بازرگانی', en: 'Commercial Manager' } },
                { label: 'نوع استخدام / Employment Type', key: 'employmentType' as const, ph: { fa: 'پورسانتی', en: 'Commission-based' } },
                { label: 'ساعات کاری / Working Hours', key: 'workingHours' as const, ph: { fa: 'یکشنبه-چهارشنبه ۹-۱۷', en: 'Sun–Wed 09:00–17:00' } },
              ] as const).map(({ label, key, ph }) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">{label}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={(jdDraft[key] as BL).fa} onChange={e => setJdDraft(d => ({ ...d, [key]: { ...(d[key] as BL), fa: e.target.value } }))} placeholder={ph.fa} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                    <input value={(jdDraft[key] as BL).en} onChange={e => setJdDraft(d => ({ ...d, [key]: { ...(d[key] as BL), en: e.target.value } }))} placeholder={ph.en} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" dir="ltr" />
                  </div>
                </div>
              ))}

              {/* Summary */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">خلاصه شغل / Summary</label>
                <div className="grid grid-cols-2 gap-2">
                  <textarea rows={3} value={jdDraft.summary.fa} onChange={e => setJdDraft(d => ({...d, summary: {...d.summary, fa: e.target.value}}))} placeholder="شرح کوتاهی از هدف و ماهیت این شغل..." className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none" />
                  <textarea rows={3} value={jdDraft.summary.en} onChange={e => setJdDraft(d => ({...d, summary: {...d.summary, en: e.target.value}}))} placeholder="Brief description of the job purpose..." className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none" dir="ltr" />
                </div>
              </div>

              {/* Bilingual list sections */}
              {([
                { label: 'مسئولیت‌های اصلی / Responsibilities', key: 'responsibilities' as const, phFa: 'مثال: بررسی درخواست‌های صادراتی', phEn: "e.g. Review clients' export requests" },
                { label: 'مهارت‌های مورد نیاز / Required Skills', key: 'requiredSkills' as const, phFa: 'مثال: تسلط به انگلیسی B2', phEn: 'e.g. English proficiency B2' },
                { label: 'شاخص‌های عملکرد / KPIs', key: 'kpis' as const, phFa: 'مثال: پرونده ماهانه — هدف: ۲۰', phEn: 'e.g. Monthly cases — target: 20' },
              ] as const).map(({ label, key, phFa, phEn }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-500">{label}</label>
                    <button type="button" onClick={() => addBLItem(key)} className="text-xs text-indigo-600 hover:text-indigo-800">+ افزودن</button>
                  </div>
                  <div className="space-y-1.5">
                    {(jdDraft[key] as BL[]).map((item, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <span className="text-gray-400 text-xs w-5 shrink-0 text-center">{i+1}</span>
                        <input value={item.fa} onChange={e => setBLItem(key, i, 'fa', e.target.value)} placeholder={phFa} className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        <input value={item.en} onChange={e => setBLItem(key, i, 'en', e.target.value)} placeholder={phEn} className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" dir="ltr" />
                        {(jdDraft[key] as BL[]).length > 1 && <button type="button" onClick={() => removeBLItem(key, i)} className="text-red-400 hover:text-red-600 text-sm shrink-0">×</button>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Qualifications */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">تحصیلات و تجربه / Qualifications</label>
                <div className="grid grid-cols-2 gap-2">
                  <textarea rows={2} value={jdDraft.qualifications.fa} onChange={e => setJdDraft(d => ({...d, qualifications: {...d.qualifications, fa: e.target.value}}))} placeholder="کارشناسی بازرگانی — ۲ سال سابقه مرتبط" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none" />
                  <textarea rows={2} value={jdDraft.qualifications.en} onChange={e => setJdDraft(d => ({...d, qualifications: {...d.qualifications, en: e.target.value}}))} placeholder="Bachelor's in Commerce — 2 yrs experience" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none" dir="ltr" />
                </div>
              </div>

              {/* Compensation */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-500">حقوق و مزایا / Compensation</label>
                  <button type="button" onClick={addCommission} className="text-xs text-indigo-600 hover:text-indigo-800">+ افزودن ردیف</button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input value={jdDraft.compensation.model.fa} onChange={e => setJdDraft(d => ({...d, compensation: {...d.compensation, model: {...d.compensation.model, fa: e.target.value}}}))} placeholder="مدل: پورسانتی" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <input value={jdDraft.compensation.model.en} onChange={e => setJdDraft(d => ({...d, compensation: {...d.compensation, model: {...d.compensation.model, en: e.target.value}}}))} placeholder="Model: Commission-based" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" dir="ltr" />
                </div>
                <div className="space-y-2">
                  {jdDraft.compensation.commission.map((c, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100 space-y-1.5">
                      <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-gray-400">ردیف {i+1}</span>{jdDraft.compensation.commission.length > 1 && <button type="button" onClick={() => removeCommission(i)} className="text-red-400 hover:text-red-600 text-xs">× حذف</button>}</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input value={c.department.fa} onChange={e => setCommission(i, 'department', 'fa', e.target.value)} placeholder="واحد (FA)" className="px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        <input value={c.department.en} onChange={e => setCommission(i, 'department', 'en', e.target.value)} placeholder="Unit (EN)" className="px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" dir="ltr" />
                        <input value={c.process.fa} onChange={e => setCommission(i, 'process', 'fa', e.target.value)} placeholder="فرآیند (FA)" className="px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        <input value={c.process.en} onChange={e => setCommission(i, 'process', 'en', e.target.value)} placeholder="Process (EN)" className="px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" dir="ltr" />
                        <input value={c.basis.fa} onChange={e => setCommission(i, 'basis', 'fa', e.target.value)} placeholder="مبنای محاسبه (FA)" className="px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        <input value={c.basis.en} onChange={e => setCommission(i, 'basis', 'en', e.target.value)} placeholder="Basis (EN)" className="px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" dir="ltr" />
                        <div className="col-span-2 flex items-center gap-2">
                          <input type="number" min="0" max="100" value={c.percentage} onChange={e => setCommission(i, 'percentage', 'pct', e.target.value)} className="w-20 px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" dir="ltr" />
                          <span className="text-xs text-gray-500">درصد / %</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Company Policies */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-500">قوانین و سیاست‌های شرکت / Company Policies</label>
                  <button type="button" onClick={addPolicy} className="text-xs text-indigo-600 hover:text-indigo-800">+ افزودن</button>
                </div>
                <div className="space-y-3">
                  {jdDraft.companyPolicies.map((p, i) => (
                    <div key={i} className="bg-blue-50 rounded-xl p-3 border border-blue-100 space-y-1.5">
                      <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-bold text-blue-400">قانون {i+1}</span>{jdDraft.companyPolicies.length > 1 && <button type="button" onClick={() => removePolicy(i)} className="text-red-400 hover:text-red-600 text-xs">× حذف</button>}</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input value={p.title.fa} onChange={e => setPolicy(i, 'title', 'fa', e.target.value)} placeholder="عنوان (FA)" className="px-2 py-1 rounded border border-blue-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white" />
                        <input value={p.title.en} onChange={e => setPolicy(i, 'title', 'en', e.target.value)} placeholder="Title (EN)" className="px-2 py-1 rounded border border-blue-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white" dir="ltr" />
                        <textarea rows={2} value={p.rule.fa} onChange={e => setPolicy(i, 'rule', 'fa', e.target.value)} placeholder="متن قانون (FA)" className="px-2 py-1 rounded border border-blue-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white resize-none" />
                        <textarea rows={2} value={p.rule.en} onChange={e => setPolicy(i, 'rule', 'en', e.target.value)} placeholder="Rule text (EN)" className="px-2 py-1 rounded border border-blue-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white resize-none" dir="ltr" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">توضیحات تکمیلی / Notes</label>
                <div className="grid grid-cols-2 gap-2">
                  <textarea rows={2} value={jdDraft.notes.fa} onChange={e => setJdDraft(d => ({...d, notes: {...d.notes, fa: e.target.value}}))} placeholder="هر نکته دیگری..." className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none" />
                  <textarea rows={2} value={jdDraft.notes.en} onChange={e => setJdDraft(d => ({...d, notes: {...d.notes, en: e.target.value}}))} placeholder="Any additional notes..." className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none" dir="ltr" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
              <button type="button" onClick={() => { if (window.confirm('پاک کردن همه اطلاعات؟')) setJdDraft(emptyJD()); }} className="text-xs text-red-400 hover:text-red-600">پاک کردن</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowJDModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">انصراف</button>
                <button type="button" onClick={saveJD} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">ذخیره شرح شغل</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {personnel.map(person => {
          const manager = personnel.find(p => p.id === person.reportsTo);
          return (
            <div key={person.id} className={`bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all relative group ${editingId === person.id ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-100'}`}>
              {/* ── Header ── */}
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0 overflow-hidden border border-gray-100 ${person.roles.includes('مدیر') ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                  {person.avatar ? (<img src={person.avatar} alt={person.fullName} className="w-full h-full object-cover" />) : person.fullName.charAt(0)}
                </div>
                <div className="flex-grow min-w-0">
                  <h4 className="font-bold text-gray-900 truncate">{person.fullName}</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(person.roles || []).map((role, rIdx) => {
                      const dept = deptOfRole(role);
                      return (
                        <span key={rIdx} className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                          {role}{dept && <span className="text-indigo-400"> · {dept.name}</span>}
                        </span>
                      );
                    })}
                  </div>
                  {manager && (
                    <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                      <IconLayout className="w-3 h-3 text-indigo-400" />
                      {manager.fullName}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Info ── */}
              <div className="text-xs space-y-1.5 mb-3">
                <div className="flex justify-between text-gray-500">
                  <span>{t.emailLbl}</span><span className="text-gray-700">{person.email}</span>
                </div>
                <div className="flex justify-between bg-gray-50 px-2 py-1 rounded text-gray-500">
                  <span>{t.usernameLbl}</span><span className="font-mono text-gray-700">{person.username}</span>
                </div>
              </div>

              {/* ── Documents ── */}
              {person.documents && person.documents.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-[11px] font-semibold text-gray-400 mb-2 flex items-center gap-1">
                    <IconPaperclip className="w-3 h-3" />
                    {t.docsLbl} {person.documents.length}
                  </p>
                  <div className="space-y-1.5">
                    {person.documents.map((d, i) => (
                      <a
                        key={i}
                        href={d.file.content}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-[11px] bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg text-indigo-600 border border-indigo-100 transition-colors"
                      >
                        <IconFile className="w-3 h-3 shrink-0" />
                        <span className="truncate flex-1">{d.title}</span>
                        <span className="text-indigo-400 shrink-0">↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Actions ── */}
              <div className="absolute top-3 rtl:left-3 ltr:right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => handleEdit(person)} className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><IconEdit className="w-4 h-4" /></button>
                <button onClick={() => handleRemove(person.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><IconTrash className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
