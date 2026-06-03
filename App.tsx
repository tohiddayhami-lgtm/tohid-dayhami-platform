
import React, { useState, useEffect, useCallback } from 'react';
import { CustomerForm } from './components/CustomerForm';
import { AdminDashboard } from './components/AdminDashboard';
import { TrackingView } from './components/TrackingView';
import { LoginView } from './components/LoginView';
import { FeaturedBusinesses } from './components/FeaturedBusinesses';
import { Ticket, TicketStatus, ViewState, ServiceOption, Personnel, Customer, AppConfig, FormField, TimelineEntry, InternalMessage, Task, Meeting, KPI } from './types';
import { IconLayout, IconPlus, IconSearch, IconShield, IconBulb } from './components/Icons';
import {
  saveTicketToCloud, updateTicketInCloud, deleteTicketFromCloud,
  saveCustomerToCloud, saveCustomersBulkToCloud, updateCustomerInCloud, deleteCustomerFromCloud,
  saveAppConfigToCloud,
  saveServicesToCloud,
  savePersonnelToCloud,
  subscribeToTickets, subscribeToCustomers, subscribeToSettings,
  subscribeToMessages, subscribeToTasks, subscribeToMeetings, subscribeToKPIs, sanitizeData, logSystemAction
} from './services/firebaseService';

export type Language = 'fa' | 'en';

export const DICTIONARY = {
  fa: {
    startBtn: 'شروع مشاوره و خدمات',
    trackBtn: 'پیگیری پرونده',
    newTicket: 'ثبت درخواست',
    tracking: 'پیگیری',
    expertPanel: 'پنل کارشناسان',
    footer: '© ۱۴۰۳ پلتفرم جامع خدمات صادراتی',
    features: [
      { title: 'ارسال آنلاین مدارک', desc: 'بارگذاری کاتالوگ، عکس و ویدیو جهت بررسی کارشناسان' },
      { title: 'تحلیل هوشمند بازار', desc: 'استفاده از هوش مصنوعی برای ارزیابی پتانسیل محصول' },
      { title: 'پیگیری مرحله به مرحله', desc: 'اطلاع از وضعیت دقیق درخواست در پنل کاربری' },
    ],
    alertSuccess: 'درخواست شما با موفقیت ثبت شد.\nشماره پیگیری: ',
    landingSubtitle: 'اولین و بزرگترین پلتفرم هوشمند خدمات صادراتی و بازرگانی کشور.'
  },
  en: {
    startBtn: 'Get Started',
    trackBtn: 'Track Request',
    newTicket: 'New Request',
    tracking: 'Track',
    expertPanel: 'Staff Login',
    footer: '© 2024 Comprehensive Export Platform. All rights reserved.',
    features: [
      { title: 'Online Submission', desc: 'Upload documents for expert review' },
      { title: 'AI Market Analysis', desc: 'Smart evaluation of product potential' },
      { title: 'Live Tracking', desc: 'Track your request status in real-time' },
    ],
    alertSuccess: 'Your request has been submitted successfully.\nTracking ID: ',
    landingSubtitle: 'The leading smart export and trade services platform.'
  }
};

const DEFAULT_SERVICES: ServiceOption[] = [
  { id: 's1', title: 'مشاوره تخصصی صادرات', titleEn: 'Expert Export Consultation', description: 'مشاوره ورود به بازار و قوانین گمرکی', descriptionEn: 'Market entry strategy and customs regulations', icon: '🌍', isActive: true, price: { amount: 5000000, currency: 'IRR' } },
  { id: 's2', title: 'خدمات مدیریت صادرات (EMC)', titleEn: 'Export Management (EMC)', description: 'برون‌سپاری کامل فرایند فروش خارجی', descriptionEn: 'Complete outsourcing of foreign sales processes', icon: '🤝', isActive: true, price: { amount: 0, currency: 'IRR' } },
  { id: 's3', title: 'طراحی بسته‌بندی صادراتی', titleEn: 'Export Packaging Design', description: 'طراحی استاندارد برای بازارهای جهانی', descriptionEn: 'Standard design for global markets', icon: '📦', isActive: true, price: { amount: 30000000, currency: 'IRR' } },
  { id: 's4', title: 'طراحی گرافیک و کاتالوگ', titleEn: 'Graphic Design & Catalog', description: 'تولید محتوای بصری بین‌المللی', descriptionEn: 'International visual content production', icon: '🎨', isActive: true, price: { amount: 15000000, currency: 'IRR' }, subServices: [
      { id: 'sub1', title: 'طراحی لوگو', titleEn: 'Logo Design', price: { amount: 5000000, currency: 'IRR' } },
      { id: 'sub2', title: 'کارت ویزیت', titleEn: 'Business Card', price: { amount: 2000000, currency: 'IRR' } },
      { id: 'sub3', title: 'کاتالوگ دیجیتال', titleEn: 'Digital Catalog', price: { amount: 10000000, currency: 'IRR' } },
      { id: 'sub4', title: 'هویت بصری (برندینگ)', titleEn: 'Visual Identity', price: { amount: 25000000, currency: 'IRR' } }
  ]},
  { id: 's5', title: 'تورهای تجاری', titleEn: 'Business Trade Tours', description: 'اعزام هیئت تجاری و بازدید از نمایشگاه', descriptionEn: 'Trade delegation dispatch and exhibition visits', icon: '✈️', isActive: true, price: { amount: 1500, currency: 'USD' } },
  { id: 's6', title: 'دوره آموزشی بازرگانی', titleEn: 'Trade Training Courses', description: 'کارگاه‌های تخصصی صادرات و واردات', descriptionEn: 'Specialized export and import workshops', icon: '🎓', isActive: true, price: { amount: 3000000, currency: 'IRR' } },
  { id: 's7', title: 'غرفه مجازی', titleEn: 'Virtual Exhibition Booth', description: 'نمایش محصولات در نمایشگاه‌های آنلاین', descriptionEn: 'Product display in online exhibitions', icon: '💻', isActive: true, price: { amount: 10000000, currency: 'IRR' } },
];

const DEFAULT_PERSONNEL: Personnel[] = [
  { id: 'p_master', fullName: 'Master Admin', roles: ['مدیر'], jobDescription: 'مدیر کل سیستم با دسترسی نامحدود به تمامی بخش‌ها.', email: 'master@export.com', username: 'master', password: '', status: 'active', permissions: { canAssign: true, canViewCustomers: true, canViewTariffs: true, canViewAllTickets: true, canIssueInvoices: true } },
  { id: 'p1', fullName: 'مدیر ارشد سیستم', roles: ['مدیر'], jobDescription: 'نظارت بر عملکرد تیم فروش و پیگیری قراردادهای کلان.', reportsTo: 'p_master', email: 'admin@export.com', username: 'admin', password: '', status: 'active', permissions: { canAssign: true, canViewCustomers: true, canViewTariffs: true, canViewAllTickets: true, canIssueInvoices: true } },
  { id: 'p2', fullName: 'کارشناس فروش', roles: ['کارشناس صادرات'], jobDescription: 'پیگیری لیدهای ورودی و تبدیل به مشتری نهایی.', reportsTo: 'p1', email: 'sales@export.com', username: 'sales', password: '', status: 'active', permissions: { canAssign: false, canViewCustomers: false, canViewTariffs: true, canViewAllTickets: false, canIssueInvoices: true } },
];

const INITIAL_CONFIG: AppConfig = {
  appTitle: 'پلتفرم جامع صادراتی',
  appTitleEn: 'Export Platform',
  appSubtitle: 'مشاوره، توسعه بازار و خدمات بازرگانی',
  appSubtitleEn: 'Consultancy, Market Development & Trade Services',
  landingHeroTitle: 'مسیر جهانی شدن کسب‌وکار شما',
  landingHeroSubtitle: 'اولین و بزرگترین پلتفرم هوشمند خدمات صادراتی و بازرگانی کشور. با ما مسیر ورود به بازارهای جهانی را هموار کنید.',
  footerText: '© ۱۴۰۳ پلتفرم جامع خدمات صادراتی. تمامی حقوق محفوظ است.',
  dailyTips: [
    "موفقیت در صادرات نیازمند شناخت دقیق بازار هدف است.",
    "بسته‌بندی مناسب، نماینده خاموش محصول شما در قفسه‌های فروشگاه‌های جهانی است.",
    "اخذ گواهی‌نامه‌های بین‌المللی، کلید ورود به بازارهای اروپایی است."
  ],
  showDailyTips: true,
  personnelRoles: ['مدیر', 'کارشناس صادرات', 'طراح گرافیک/بسته بندی', 'پشتیبانی', 'کارشناس آموزش', 'مدیر مالی'],
  formFields: [
    { id: 'h1', key: 'h_contact', label: 'اطلاعات تماس و موقعیت', labelEn: 'Contact Info', type: 'header', required: false, order: 0, isSystem: true },
    { id: 'f1', key: 'fullName', label: 'نام و نام خانوادگی (شخص مسئول)', labelEn: 'Full Name', type: 'text', required: true, placeholder: 'مثال: علی محمدی', placeholderEn: 'e.g. John Doe', order: 1, isSystem: true },
    { id: 'f2', key: 'companyName', label: 'نام شرکت / برند (اختیاری)', labelEn: 'Company Name', type: 'text', required: false, placeholder: 'مثال: بازرگانی پارس', order: 2, isSystem: true },
    { id: 'f3', key: 'location', label: 'کشور و شهر', labelEn: 'Country/City', type: 'text', required: true, placeholder: 'مثال: ایران، تهران', order: 3, isSystem: true },
    { id: 'f4', key: 'phoneNumber', label: 'شماره موبایل', labelEn: 'Mobile Number', type: 'tel', required: true, placeholder: '0912...', order: 4, isSystem: true },
    { id: 'f5', key: 'whatsappNumber', label: 'شماره واتس‌اپ', labelEn: 'WhatsApp', type: 'tel', required: true, placeholder: 'جهت هماهنگی...', order: 5, isSystem: true },
    { id: 'f6', key: 'email', label: 'ایمیل (اختیاری)', labelEn: 'Email', type: 'email', required: false, placeholder: 'email@example.com', order: 6, isSystem: true },
    { id: 'h2', key: 'h_req', label: 'جزئیات درخواست', labelEn: 'Request Details', type: 'header', required: false, order: 7, isSystem: true },
    { id: 'f7', key: 'businessType', label: 'نوع کسب‌وکار', labelEn: 'Business Type', type: 'select', required: true, options: ['تولیدی', 'بازرگانی', 'صنایع دستی', 'کشاورزی', 'خدماتی', 'دانش‌بنیان', 'سایر'], order: 8, isSystem: true },
    { id: 'f8', key: 'description', label: 'شرح درخواست و اطلاعات محصول', labelEn: 'Description', type: 'textarea', required: true, placeholder: 'توضیحات کامل...', order: 9, isSystem: true },
  ],
  assignmentConfig: { mode: 'manual', serviceRoleMap: {} }
};

const STORAGE_KEYS = { USER: 'crm_session_user', VIEW: 'crm_last_view', LAST_ACTIVE: 'crm_last_active' };
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

const App: React.FC = () => {
  const [view, setViewState] = useState<ViewState>('landing');
  const [lang, setLang] = useState<Language>('fa');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [services, setServices] = useState<ServiceOption[]>(DEFAULT_SERVICES);
  const [personnel, setPersonnel] = useState<Personnel[]>(DEFAULT_PERSONNEL);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [currentUser, setCurrentUser] = useState<Personnel | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig>(INITIAL_CONFIG);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const t = DICTIONARY[lang];

  const setView = (newView: ViewState) => {
    setViewState(newView);
    localStorage.setItem(STORAGE_KEYS.VIEW, newView);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
    const storedView = localStorage.getItem(STORAGE_KEYS.VIEW);
    const lastActive = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
    const now = Date.now();
    if (storedUser && lastActive) {
      if (now - parseInt(lastActive) > INACTIVITY_TIMEOUT) {
        handleLogout();
      } else {
        try {
          setCurrentUser(JSON.parse(storedUser));
          localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, now.toString());
          if (storedView) setViewState(storedView as ViewState);
        } catch { handleLogout(); }
      }
    }
  }, []);

  useEffect(() => {
    const updateActivity = () => { if (currentUser) localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, Date.now().toString()); };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, updateActivity));
    const interval = setInterval(() => {
      const lastActive = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
      if (currentUser && lastActive && Date.now() - parseInt(lastActive) > INACTIVITY_TIMEOUT) {
        handleLogout();
        alert('نشست کاربری شما به دلیل عدم فعالیت منقضی شد.');
      }
    }, 60000);
    return () => { events.forEach(e => window.removeEventListener(e, updateActivity)); clearInterval(interval); };
  }, [currentUser]);

  useEffect(() => {
    const unsubTickets = subscribeToTickets((data) => { setTickets(data); setIsLoadingData(false); });
    const unsubCustomers = subscribeToCustomers((data) => setCustomers(data));
    const unsubMessages = subscribeToMessages((data) => setMessages(data));
    const unsubTasks = subscribeToTasks((data) => setTasks(data));
    const unsubMeetings = subscribeToMeetings((data) => setMeetings(data));
    const unsubKPIs = subscribeToKPIs((data) => setKpis(data));
    const unsubSettings = subscribeToSettings(
      (cfg) => { if (cfg) setAppConfig(cfg); },
      (srv) => { if (srv) setServices(srv.map((s: any) => ({ ...s, price: typeof s.price === 'string' ? { amount: 0, currency: 'IRR' } : (s.price || { amount: 0, currency: 'IRR' }) }))); },
      (ppl) => { if (ppl) setPersonnel(ppl.map((p: any) => ({ ...p, roles: Array.isArray(p.roles) ? p.roles : (p.role ? [p.role] : []), permissions: p.permissions || {} }))); }
    );
    return () => { unsubTickets(); unsubCustomers(); unsubSettings(); unsubMessages(); unsubTasks(); unsubMeetings(); unsubKPIs(); };
  }, []);

  const calculateAssignee = useCallback((serviceIdOrTitle: string): string | undefined => {
    const config = appConfig.assignmentConfig;
    if (!config || config.mode === 'manual' || !config.serviceRoleMap) return undefined;
    let targetRole = config.serviceRoleMap[serviceIdOrTitle];
    if (!targetRole) {
      const serviceObj = services.find(s => s.title === serviceIdOrTitle || s.titleEn === serviceIdOrTitle || s.title.includes(serviceIdOrTitle));
      if (serviceObj) targetRole = config.serviceRoleMap[serviceObj.id];
    }
    if (!targetRole) return undefined;
    const eligibleStaff = personnel.filter(p => p.roles.includes(targetRole) && p.status === 'active');
    if (eligibleStaff.length === 0) return undefined;
    if (config.mode === 'random') return eligibleStaff[Math.floor(Math.random() * eligibleStaff.length)].id;
    if (config.mode === 'auto_load_balance') {
      const staffWorkload = eligibleStaff.map(staff => ({ id: staff.id, count: tickets.filter(t => t.assignedTo === staff.id && t.status !== TicketStatus.COMPLETED && t.status !== TicketStatus.CANCELLED).length }));
      staffWorkload.sort((a, b) => a.count - b.count);
      return staffWorkload[0].id;
    }
    return undefined;
  }, [appConfig.assignmentConfig, personnel, tickets, services]);

  useEffect(() => {
    if (!currentUser || !appConfig.assignmentConfig || appConfig.assignmentConfig.mode === 'manual') return;
    const isAuthorized = currentUser.username === 'master' || currentUser.roles.includes('مدیر');
    if (!isAuthorized) return;
    const unassigned = tickets.filter(t => !t.assignedTo && t.status !== TicketStatus.CANCELLED && t.status !== TicketStatus.COMPLETED);
    if (unassigned.length === 0) return;
    const processAssignments = async () => {
      for (const ticket of unassigned) {
        const assigneeId = calculateAssignee(ticket.serviceId);
        if (assigneeId) {
          const assignee = personnel.find(p => p.id === assigneeId);
          if (assignee) {
            await updateTicketInCloud(ticket.id, { assignedTo: assigneeId, timeline: [...(ticket.timeline || []), { type: 'assignment', title: 'ارجاع خودکار (سیستم)', description: `ارجاع هوشمند به ${assignee.fullName}`, actorName: 'System Bot', timestamp: new Date().toISOString(), visibility: 'internal' }] });
          }
        }
      }
    };
    processAssignments();
  }, [tickets, currentUser, appConfig.assignmentConfig, calculateAssignee, personnel]);

  const saveNewTicketToSystem = async (ticket: Ticket) => {
    let assignedTo = ticket.assignedTo;
    let assignmentNote: TimelineEntry | null = null;
    if (!assignedTo) {
      const autoAssignedId = calculateAssignee(ticket.serviceId);
      if (autoAssignedId) {
        assignedTo = autoAssignedId;
        const assigneeName = personnel.find(p => p.id === autoAssignedId)?.fullName || 'Unknown';
        assignmentNote = { type: 'assignment', title: 'ارجاع هوشمند', description: `تیکت به صورت اتوماتیک به ${assigneeName} ارجاع شد.`, actorName: 'سیستم', timestamp: new Date().toISOString(), visibility: 'internal' };
      }
    }
    const initialTimeline: TimelineEntry[] = [{ type: 'creation', title: 'ثبت درخواست', description: 'درخواست در سامانه ثبت شد', timestamp: new Date().toISOString(), actorName: 'سیستم', visibility: 'public' }, ...(ticket.timeline || [])];
    if (assignmentNote) initialTimeline.push(assignmentNote);
    let newCustomer: Customer | undefined;
    const existingCustomer = customers.find(c => c.phoneNumber === ticket.phoneNumber);
    if (existingCustomer) {
      newCustomer = { ...existingCustomer, fullName: ticket.customerName, companyName: ticket.companyName || existingCustomer.companyName, location: ticket.location || existingCustomer.location, whatsappNumber: ticket.whatsappNumber, businessType: ticket.businessType || existingCustomer.businessType, totalTickets: existingCustomer.totalTickets + 1, source: existingCustomer.source || 'Web Form' };
    } else {
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const phoneSuffix = ticket.phoneNumber.substring(ticket.phoneNumber.length - 4);
      newCustomer = { id: `C-${Date.now()}`, fullName: ticket.customerName, companyName: ticket.companyName, location: ticket.location, phoneNumber: ticket.phoneNumber, whatsappNumber: ticket.whatsappNumber, businessType: ticket.businessType, firstContact: new Date().toISOString(), totalTickets: 1, source: 'Web Form', loyaltyCode: `VIP-${phoneSuffix}-${randomStr}` };
    }
    await saveTicketToCloud({ ...ticket, assignedTo, timeline: initialTimeline });
    if (newCustomer) await saveCustomerToCloud(newCustomer);
  };

  const handleNewTicket = async (ticketOrTickets: Ticket | Ticket[]) => {
    try {
      if (Array.isArray(ticketOrTickets)) { for (const t of ticketOrTickets) await saveNewTicketToSystem(t); }
      else await saveNewTicketToSystem(ticketOrTickets);
    } catch (e: any) { console.error("Database Save Error", e); alert("خطا در ذخیره سازی در دیتابیس."); throw e; }
  };

  const handleUpdateTicket = async (id: string, updates: Partial<Ticket>, actorName: string, actionNote?: string, visibility: 'public' | 'internal' = 'public') => {
    let updatePayload = { ...updates };
    const currentTicket = tickets.find(t => t.id === id);
    let newEntry: TimelineEntry | null = null;
    if (actionNote) {
      newEntry = { type: updates.projectData ? 'project_update' : (updates.status ? 'status_change' : (updates.assignedTo ? 'assignment' : 'comment')), title: updates.status ? 'تغییر وضعیت' : (updates.assignedTo ? 'تغییر مسئول' : (updates.projectData ? 'بروزرسانی پروژه' : 'یادداشت')), description: actionNote, timestamp: new Date().toISOString(), actorName, visibility };
    } else if (updates.status && updates.status !== currentTicket?.status) {
      newEntry = { type: 'status_change', title: `تغییر وضعیت به ${updates.status}`, timestamp: new Date().toISOString(), actorName, visibility: 'public' };
    }
    if (newEntry) updatePayload.timeline = [...(currentTicket?.timeline || []), newEntry];
    await updateTicketInCloud(id, updatePayload);
  };

  const handleDeleteTicket = async (id: string) => { await deleteTicketFromCloud(id); };
  const handleUpdateCustomers = async (newCustomersList: Customer[]) => {
    const imported = newCustomersList.filter(c => c.source?.startsWith('Import') && !customers.find(old => old.id === c.id));
    if (imported.length > 0) await saveCustomersBulkToCloud(imported);
  };
  const handleEditCustomer = async (id: string, updates: Partial<Customer>) => { await updateCustomerInCloud(id, updates); };
  const handleDeleteCustomer = async (id: string) => { await deleteCustomerFromCloud(id); };
  const handleUpdateServices = async (newServices: ServiceOption[]) => { await saveServicesToCloud(newServices); };
  const handleUpdatePersonnel = async (newPersonnel: Personnel[]) => { await savePersonnelToCloud(newPersonnel); };
  const handleUpdateConfig = async (newConfig: AppConfig) => { await saveAppConfigToCloud(newConfig); };

  const handleLogin = async (u: string, p: string): Promise<boolean> => {
    const user = personnel.find(person => person.username === u && person.password === p);
    if (user) {
      setCurrentUser(user);
      logSystemAction('LOGIN', 'System', 'ورود کاربر به سیستم', user.fullName, user.id);
      try { localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sanitizeData(user))); localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, Date.now().toString()); } catch { }
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('landing');
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.VIEW);
    localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col" dir={lang === 'fa' ? 'rtl' : 'ltr'}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">

          {/* Logo */}
          <button onClick={() => setView('landing')} className="flex items-center gap-2">
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
              <IconShield className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {lang === 'fa' ? appConfig.appTitle : appConfig.appTitleEn}
            </span>
          </button>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { id: 'new-ticket', label: t.newTicket, icon: <IconPlus className="w-3.5 h-3.5" /> },
              { id: 'tracking',   label: t.tracking,  icon: <IconSearch className="w-3.5 h-3.5" /> },
              { id: 'admin',      label: t.expertPanel, icon: <IconLayout className="w-3.5 h-3.5" /> },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setView(item.id as ViewState)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
                  ${view === item.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right side: lang + mobile menu */}
          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
              <button onClick={() => setLang('fa')} className={`px-2.5 py-1 font-semibold transition-colors ${lang === 'fa' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>FA</button>
              <button onClick={() => setLang('en')} className={`px-2.5 py-1 font-semibold transition-colors ${lang === 'en' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>EN</button>
            </div>
            <div className="md:hidden">
              <button onClick={() => setView(view === 'landing' ? 'new-ticket' : 'landing')} className="p-1.5 text-gray-500">
                <IconLayout className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-grow w-full max-w-6xl mx-auto px-5 py-8">
        {isLoadingData && view !== 'landing' ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
              <span className="text-sm">در حال بارگذاری...</span>
            </div>
          </div>
        ) : (
          <>
            {/* ── Landing ── */}
            {view === 'landing' && (
              <div className="animate-fade-in">

                {/* Hero */}
                <section className="text-center py-24 md:py-32">
                  <p className="text-xs font-medium text-gray-400 tracking-widest uppercase mb-6">
                    {lang === 'fa' ? 'پلتفرم هوشمند صادراتی' : 'Smart Export Platform'}
                  </p>
                  <h1 className="text-4xl md:text-6xl font-semibold text-gray-900 leading-tight mb-6 tracking-tight">
                    {lang === 'fa'
                      ? (appConfig.landingHeroTitle || 'مسیر جهانی شدن کسب‌وکار شما')
                      : 'Globalize Your Business'}
                  </h1>
                  <p className="text-base md:text-lg text-gray-500 mb-10 max-w-xl mx-auto leading-relaxed">
                    {lang === 'fa' ? (appConfig.landingHeroSubtitle || t.landingSubtitle) : t.landingSubtitle}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => setView('new-ticket')}
                      className="px-7 py-3 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-black transition-colors"
                    >
                      {t.startBtn}
                    </button>
                    <button
                      onClick={() => setView('tracking')}
                      className="px-7 py-3 bg-white text-gray-700 border border-gray-200 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      {t.trackBtn}
                    </button>
                  </div>
                </section>

                {/* Features */}
                <section className="border-t border-gray-100 py-16">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-100 rounded-2xl overflow-hidden">
                    {t.features.map((f, i) => (
                      <div key={i} className="bg-white p-8">
                        <div className="text-2xl mb-4">{['📂', '🌍', '📊'][i]}</div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">{f.title}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Daily Tip */}
                {appConfig.showDailyTips && appConfig.dailyTips && appConfig.dailyTips.length > 0 && (
                  <section className="py-8">
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 flex gap-4 items-start max-w-2xl mx-auto">
                      <IconBulb className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                          {lang === 'fa' ? 'نکته روز' : 'Daily Tip'}
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {appConfig.dailyTips[Math.floor(Math.random() * appConfig.dailyTips.length)]}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* Featured Businesses */}
                {appConfig.featuredBusinesses && appConfig.featuredBusinesses.length > 0 && (
                  <FeaturedBusinesses businesses={appConfig.featuredBusinesses} lang={lang} />
                )}
              </div>
            )}

            {view === 'new-ticket' && (
              <CustomerForm
                config={appConfig}
                services={services.filter(s => s.isActive)}
                onSubmit={handleNewTicket}
                onCancel={() => setView('landing')}
                onGoToTracking={() => setView('tracking')}
                lang={lang}
              />
            )}

            {view === 'tracking' && (
              <TrackingView tickets={tickets} services={services} lang={lang} />
            )}

            {view === 'admin' && (
              <>
                {!currentUser ? (
                  <LoginView onLogin={handleLogin} onBack={() => setView('landing')} />
                ) : (
                  <AdminDashboard
                    lang={lang}
                    currentUser={currentUser}
                    tickets={tickets}
                    services={services}
                    personnel={personnel}
                    customers={customers}
                    messages={messages}
                    tasks={tasks}
                    meetings={meetings}
                    kpis={kpis}
                    config={appConfig}
                    onCreateTicket={async (t) => handleNewTicket(t)}
                    onUpdateTicket={handleUpdateTicket}
                    onDeleteTicket={handleDeleteTicket}
                    onUpdateServices={handleUpdateServices}
                    onUpdatePersonnel={handleUpdatePersonnel}
                    onUpdateCustomers={handleUpdateCustomers}
                    onEditCustomer={handleEditCustomer}
                    onDeleteCustomer={handleDeleteCustomer}
                    onUpdateConfig={handleUpdateConfig}
                    onLogout={handleLogout}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">{appConfig.footerText || t.footer}</p>
      </footer>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 flex justify-around py-2 z-50">
        {[
          { id: 'new-ticket', icon: <IconPlus className="w-5 h-5" />, label: t.newTicket },
          { id: 'tracking',   icon: <IconSearch className="w-5 h-5" />, label: t.tracking },
          { id: 'admin',      icon: <IconLayout className="w-5 h-5" />, label: t.expertPanel },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id as ViewState)}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 ${view === item.id ? 'text-gray-900' : 'text-gray-400'}`}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default App;
