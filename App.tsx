
import React, { useState, useEffect, useCallback } from 'react';
import { CustomerForm } from './components/CustomerForm';
import { AdminDashboard } from './components/AdminDashboard';
import { TrackingView } from './components/TrackingView';
import { LoginView } from './components/LoginView';
import { FeaturedBusinesses } from './components/FeaturedBusinesses';
import { NewsPage } from './components/NewsPage';
import { PublicFormView } from './components/PublicFormView';
import { Ticket, TicketStatus, ViewState, ServiceOption, Personnel, Customer, AppConfig, FormField, TimelineEntry, InternalMessage, Task, Meeting, KPI, NewsArticle } from './types';
import { IconPlus, IconSearch, IconShield, IconBulb, IconNewspaper, IconLock, IconPort, IconLayout, IconMagic, IconTrendingUp, IconTarget, IconDatabase, IconFileText, IconMessageSquare, IconGlobe, IconMegaphone, IconAward, IconCloud, IconFolder, IconBriefcase } from './components/Icons';
import {
  saveTicketToCloud, updateTicketInCloud, deleteTicketFromCloud,
  saveCustomerToCloud, saveCustomersBulkToCloud, updateCustomerInCloud, deleteCustomerFromCloud,
  saveAppConfigToCloud,
  saveServicesToCloud,
  savePersonnelToCloud,
  subscribeToTickets, subscribeToCustomers, subscribeToSettings,
  subscribeToMessages, subscribeToTasks, subscribeToMeetings, subscribeToKPIs, sanitizeData, logSystemAction,
  subscribeToNews, logPageView, subscribeToAnalytics
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
  { id: 's3', title: 'خدمات طراحی بسته بندی', titleEn: 'Packaging Design', description: 'طراحی استاندارد برای بازارهای جهانی', descriptionEn: 'Standard design for global markets', isActive: true, price: { amount: 30000000, currency: 'IRR' } },
  { id: 's4', title: 'خدمات طراحی گرافیک', titleEn: 'Graphic Design', description: 'تولید محتوای بصری بین‌المللی', descriptionEn: 'International visual content production', isActive: true, price: { amount: 15000000, currency: 'IRR' }, subServices: [
      { id: 'sub1', title: 'طراحی لوگو', titleEn: 'Logo Design', price: { amount: 5000000, currency: 'IRR' } },
      { id: 'sub2', title: 'کارت ویزیت', titleEn: 'Business Card', price: { amount: 2000000, currency: 'IRR' } },
      { id: 'sub3', title: 'کاتالوگ دیجیتال', titleEn: 'Digital Catalog', price: { amount: 10000000, currency: 'IRR' } },
      { id: 'sub4', title: 'هویت بصری (برندینگ)', titleEn: 'Visual Identity', price: { amount: 25000000, currency: 'IRR' } }
  ]},
  { id: 's8', title: 'خدمات خرید محصول صادراتی', titleEn: 'Export Product Procurement', description: 'تامین و خرید محصولات برای صادرات', descriptionEn: 'Sourcing and procurement of export products', isActive: true, price: { amount: 0, currency: 'IRR' } },
  { id: 's9', title: 'خدمات فروش محصول صادراتی', titleEn: 'Export Product Sales', description: 'بازاریابی و فروش در بازارهای خارجی', descriptionEn: 'Marketing and sales in foreign markets', isActive: true, price: { amount: 0, currency: 'IRR' } },
  { id: 's10', title: 'خرید نرم افزار تخصصی صادراتی توحید پلاس', titleEn: 'Tohid Plus Export Software', description: 'نرم افزار تخصصی مدیریت فرآیند صادرات', descriptionEn: 'Specialized export management software', isActive: true, price: { amount: 0, currency: 'IRR' } },
  { id: 's1', title: 'خدمات مشاوره تخصصی', titleEn: 'Expert Consultation', description: 'مشاوره ورود به بازار و قوانین گمرکی', descriptionEn: 'Market entry strategy and customs regulations', isActive: true, price: { amount: 5000000, currency: 'IRR' } },
  { id: 's7', title: 'خدمات غرفه مجازی متاپورت', titleEn: 'Metaport Virtual Booth', description: 'نمایش محصولات در نمایشگاه‌های آنلاین', descriptionEn: 'Product display in online exhibitions', isActive: true, price: { amount: 10000000, currency: 'IRR' } },
  { id: 's11', title: 'خدمات ثبت شرکت در عمان', titleEn: 'Company Registration in Oman', description: 'ثبت و راه‌اندازی شرکت در کشور عمان', descriptionEn: 'Company registration and setup in Oman', isActive: true, price: { amount: 0, currency: 'IRR' } },
  { id: 's12', title: 'انتقادات و پیشنهادات', titleEn: 'Feedback & Suggestions', description: 'ارسال پیشنهادات و انتقادات به تیم ما', descriptionEn: 'Send your feedback and suggestions to our team', isActive: true, price: { amount: 0, currency: 'IRR' } },
  { id: 's_other', title: 'سایر', titleEn: 'Other', description: 'سایر خدمات مورد نیاز', descriptionEn: 'Other required services', isActive: true, price: { amount: 0, currency: 'IRR' } },
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
    { id: 'h1', key: 'h_contact', label: 'اطلاعات تماس و موقعیت', labelEn: 'Contact Information', type: 'header', required: false, order: 0, isSystem: true },
    { id: 'f1', key: 'fullName', label: 'نام و نام خانوادگی (شخص مسئول)', labelEn: 'Full Name (Contact Person)', type: 'text', required: true, placeholder: 'مثال: علی محمدی', placeholderEn: 'e.g. John Smith', order: 1, isSystem: true },
    { id: 'f2', key: 'companyName', label: 'نام شرکت / برند (اختیاری)', labelEn: 'Company / Brand (Optional)', type: 'text', required: false, placeholder: 'مثال: بازرگانی پارس', placeholderEn: 'e.g. Pars Trading Co.', order: 2, isSystem: true },
    { id: 'f3', key: 'location', label: 'کشور و شهر', labelEn: 'Country & City', type: 'text', required: true, placeholder: 'مثال: ایران، تهران', placeholderEn: 'e.g. Iran, Tehran', order: 3, isSystem: true },
    { id: 'f4', key: 'phoneNumber', label: 'شماره موبایل', labelEn: 'Mobile Number', type: 'tel', required: true, placeholder: '0912...', placeholderEn: '+1 555 000 0000', order: 4, isSystem: true },
    { id: 'f5', key: 'whatsappNumber', label: 'شماره واتس‌اپ', labelEn: 'WhatsApp Number', type: 'tel', required: true, placeholder: 'مثال: 09120000000', placeholderEn: '+1 555 000 0000', order: 5, isSystem: true },
    { id: 'f6', key: 'email', label: 'ایمیل (اختیاری)', labelEn: 'Email (Optional)', type: 'email', required: false, placeholder: 'email@example.com', placeholderEn: 'email@example.com', order: 6, isSystem: true },
    { id: 'h2', key: 'h_req', label: 'جزئیات درخواست', labelEn: 'Request Details', type: 'header', required: false, order: 7, isSystem: true },
    { id: 'f7', key: 'businessType', label: 'نوع کسب‌وکار', labelEn: 'Business Type', type: 'select', required: true, options: ['تولیدی', 'بازرگانی', 'صنایع دستی', 'کشاورزی', 'خدماتی', 'دانش‌بنیان', 'سایر'], optionsEn: ['Manufacturing', 'Trading', 'Handicrafts', 'Agriculture', 'Services', 'Knowledge-Based', 'Other'], order: 8, isSystem: true },
    { id: 'f8', key: 'description', label: 'اطلاعات محصول', labelEn: 'Product Information', type: 'textarea', required: true, placeholder: 'نوع محصول یا خدمتی که ارائه می‌دهید را توضیح دهید...', placeholderEn: 'Describe the type of product or service you offer...', order: 9, isSystem: true },
  ],
  assignmentConfig: { mode: 'manual', targetType: 'role', serviceRoleMap: {}, servicePersonnelMap: {} }
};

const STORAGE_KEYS = { USER: 'crm_session_user', VIEW: 'crm_last_view', LAST_ACTIVE: 'crm_last_active' };
const CACHE_KEYS = { SERVICES: 'crm_cache_services', CONFIG: 'crm_cache_config' };
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

const readCache = <T,>(key: string): T | null => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : null; } catch { return null; }
};
const writeCache = (key: string, data: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
};

// Extracts form ID from ?form=... (social media safe) or #/f/... (internal nav)
const extractFormId = (): string | null => {
  try {
    const qp = new URLSearchParams(window.location.search).get('form');
    if (qp) return qp;
  } catch {}
  const h = window.location.hash;
  if (h.startsWith('#/f/')) return h.replace('#/f/', '').split('?')[0] || null;
  return null;
};

// Parses current URL into a ViewState, checking query params first (social-media-safe),
// then hash fragments (internal navigation). Query params survive Instagram/WhatsApp/Telegram.
const parseUrl = (search: string, hash: string): ViewState | null => {
  try {
    const p = new URLSearchParams(search);
    const page = p.get('page');
    if (page === 'form')     return 'new-ticket';
    if (page === 'tracking') return 'tracking';
    if (page === 'news')     return 'news';
    if (p.get('form'))       return 'custom-form';
  } catch {}
  if (!hash || hash === '#' || hash === '#/') return 'landing';
  if (hash === '#/form' || hash === '#form')  return 'new-ticket';
  if (hash === '#/tracking')                  return 'tracking';
  if (hash.startsWith('#/news'))              return 'news';
  if (hash.startsWith('#/f/'))                return 'custom-form';
  if (hash === '#/admin')                     return 'admin';
  return null;
};

const getInitialView = (): ViewState => {
  const v = parseUrl(window.location.search, window.location.hash);
  if (v && v !== 'admin') return v;
  if (v === 'admin') {
    try { if (localStorage.getItem('crm_session_user')) return 'admin'; } catch {}
  }
  return 'landing';
};

const App: React.FC = () => {
  const [view, setViewState] = useState<ViewState>(getInitialView);
  const [preSelectedServiceId, setPreSelectedServiceId] = useState<string | null>(null);
  const [expandedServiceId,    setExpandedServiceId]    = useState<string | null>(null);
  // Reads from ?form= (social media links) OR #/f/ (internal nav), synchronously on first render
  const [customFormId, setCustomFormId] = useState<string | null>(extractFormId);
  const [lang, setLang] = useState<Language>('fa');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [services, setServices] = useState<ServiceOption[]>(() => readCache<ServiceOption[]>(CACHE_KEYS.SERVICES) ?? []);
  const [isServicesLoaded, setIsServicesLoaded] = useState<boolean>(() => !!readCache(CACHE_KEYS.SERVICES));
  const [personnel, setPersonnel] = useState<Personnel[]>(DEFAULT_PERSONNEL);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [analyticsEvents, setAnalyticsEvents] = useState<import('./types').AnalyticsEvent[]>([]);
  const [currentUser, setCurrentUser] = useState<Personnel | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig>(() => readCache<AppConfig>(CACHE_KEYS.CONFIG) ?? INITIAL_CONFIG);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const t = DICTIONARY[lang];

  // All public views use query params — survive Instagram/WhatsApp/Telegram link sharing.
  const VIEW_URL: Record<ViewState, string> = {
    landing: '/', 'new-ticket': '?page=form', tracking: '?page=tracking',
    news: '?page=news', admin: '#/admin', 'custom-form': '?form=',
  };

  const openFormWithService = (serviceId: string) => {
    setPreSelectedServiceId(serviceId);
    setView('new-ticket');
  };

  const setView = (newView: ViewState, extra?: string) => {
    setViewState(newView);
    localStorage.setItem(STORAGE_KEYS.VIEW, newView);
    let newUrl = VIEW_URL[newView];
    if (newView === 'custom-form' && extra) newUrl = `?form=${extra}`;
    if (newView === 'news' && extra)        newUrl = `?page=news&id=${extra}`;
    if (newView === 'landing')              newUrl = window.location.pathname;
    const currentFull = window.location.search + window.location.hash;
    if (currentFull !== newUrl && (window.location.pathname + currentFull) !== newUrl) {
      history.pushState(null, '', newUrl);
    }
    logPageView(newView, extra);
  };

  const toAbsoluteUrl = (url: string) => {
    if (!url) return '#';
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    const title = appConfig.seoTitle || appConfig.appTitle;
    document.title = title;
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
      el.content = content;
    };
    const setOg = (prop: string, content: string) => {
      let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
      el.content = content;
    };
    if (appConfig.seoDescription) setMeta('description', appConfig.seoDescription);
    if (appConfig.seoKeywords) setMeta('keywords', appConfig.seoKeywords);
    if (appConfig.ogTitle) setOg('og:title', appConfig.ogTitle);
    if (appConfig.ogDescription) setOg('og:description', appConfig.ogDescription);
    if (appConfig.ogImage) setOg('og:image', appConfig.ogImage);
    if (appConfig.favicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = appConfig.favicon;
    }
  }, [appConfig]);

  useEffect(() => {
    // Determine view from current URL (query params take priority over hash)
    const initialView = getInitialView();

    // Extract form ID synchronously
    const fid = extractFormId();
    if (fid) setCustomFormId(fid);

    const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
    const lastActive = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
    const now = Date.now();

    const isPublicView = initialView === 'new-ticket' || initialView === 'tracking' || initialView === 'custom-form';

    if (storedUser && lastActive && !isPublicView) {
      if (now - parseInt(lastActive) > INACTIVITY_TIMEOUT) {
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.VIEW);
        localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE);
        setCurrentUser(null);
      } else {
        try {
          setCurrentUser(JSON.parse(storedUser));
          localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, now.toString());
        } catch { localStorage.removeItem(STORAGE_KEYS.USER); setCurrentUser(null); }
      }
    } else if (storedUser && !isPublicView) {
      try { setCurrentUser(JSON.parse(storedUser)); } catch { localStorage.removeItem(STORAGE_KEYS.USER); }
    }

    setViewState(initialView);
    // Only reset to root for true landing (don't overwrite public ?page= URLs)
    if (initialView === 'landing' && !window.location.search && !window.location.hash.startsWith('#/')) {
      history.replaceState(null, '', '/');
    }
    logPageView(initialView);
  }, []);

  useEffect(() => {
    const handleNav = () => {
      const v = parseUrl(window.location.search, window.location.hash);
      if (!v) return;
      if (v === 'admin' && !currentUser) { setViewState('landing'); return; }
      const fid = extractFormId();
      if (v === 'custom-form' && fid) setCustomFormId(fid);
      setViewState(v);
      localStorage.setItem(STORAGE_KEYS.VIEW, v);
    };
    window.addEventListener('popstate', handleNav);
    window.addEventListener('hashchange', handleNav);
    return () => {
      window.removeEventListener('popstate', handleNav);
      window.removeEventListener('hashchange', handleNav);
    };
  }, [currentUser]);

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
      (cfg) => {
        if (cfg) {
          const LABEL_MIGRATIONS: Record<string, string> = {
            'شرح درخواست و اطلاعات محصول': 'اطلاعات محصول',
            'Request Description & Product Info': 'Product Information',
          };
          const mergedFields = (cfg.formFields || []).map(field => {
            if (!field.isSystem) return field;
            const def = INITIAL_CONFIG.formFields.find(f => f.id === field.id);
            if (!def) return field;
            return {
              ...field,
              label:         LABEL_MIGRATIONS[field.label] ?? field.label,
              labelEn:       LABEL_MIGRATIONS[field.labelEn ?? ''] ?? (field.labelEn || def.labelEn),
              placeholder:   (field.id === 'f8' && field.placeholder?.includes('ابعاد')) ? def.placeholder : field.placeholder,
              placeholderEn: field.placeholderEn || def.placeholderEn,
              optionsEn:     field.optionsEn     || def.optionsEn,
            };
          });
          const merged = { ...cfg, formFields: mergedFields };
          setAppConfig(merged);
          writeCache(CACHE_KEYS.CONFIG, merged);
        }
      },
      (srv) => {
        if (srv) {
          const normalized = srv.map((s: any) => ({ ...s, price: typeof s.price === 'string' ? { amount: 0, currency: 'IRR' } : (s.price || { amount: 0, currency: 'IRR' }) }));
          setServices(normalized);
          setIsServicesLoaded(true);
          writeCache(CACHE_KEYS.SERVICES, normalized);
        }
      },
      (ppl) => { if (ppl) setPersonnel(ppl.map((p: any) => ({ ...p, roles: Array.isArray(p.roles) ? p.roles : (p.role ? [p.role] : []), status: p.status || 'active', permissions: p.permissions || {} }))); }
    );
    const unsubNews = subscribeToNews((data) => { setNews(data); setIsLoadingNews(false); });
    const unsubAnalytics = subscribeToAnalytics((data) => setAnalyticsEvents(data));
    return () => { unsubTickets(); unsubCustomers(); unsubSettings(); unsubMessages(); unsubTasks(); unsubMeetings(); unsubKPIs(); unsubNews(); unsubAnalytics(); };
  }, []);

  const normalizeRoleName = (role?: string) => (role || '')
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

  const calculateAssignee = useCallback((serviceIdOrTitle: string): string | undefined => {
    const config = appConfig.assignmentConfig;
    if (!config || config.mode === 'manual') return undefined;

    const findServiceId = () => {
      const serviceObj = services.find(s => s.id === serviceIdOrTitle || s.title === serviceIdOrTitle || s.titleEn === serviceIdOrTitle || s.title.includes(serviceIdOrTitle));
      return serviceObj?.id || serviceIdOrTitle;
    };

    if (config.targetType === 'personnel') {
      const selectedPersonId = config.servicePersonnelMap?.[findServiceId()];
      const selectedPerson = personnel.find(p => p.id === selectedPersonId && (p.status || 'active') === 'active');
      return selectedPerson?.id;
    }

    if (!config.serviceRoleMap) return undefined;
    let targetRole = config.serviceRoleMap[serviceIdOrTitle]?.trim();
    if (!targetRole) {
      const serviceObj = services.find(s => s.title === serviceIdOrTitle || s.titleEn === serviceIdOrTitle || s.title.includes(serviceIdOrTitle));
      if (serviceObj) targetRole = config.serviceRoleMap[serviceObj.id]?.trim();
    }
    if (!targetRole) return undefined;
    const normalizedTargetRole = normalizeRoleName(targetRole);
    const eligibleStaff = personnel.filter(p =>
      (p.status || 'active') === 'active' &&
      (p.roles || []).some(role => normalizeRoleName(role) === normalizedTargetRole)
    );
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

          {/* Logo + Back */}
          <div className="flex items-center gap-3">
            <button onClick={() => setView('landing')} className="flex items-center gap-2">
              <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
                <IconShield className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-900 hidden sm:inline">
                {lang === 'fa' ? appConfig.appTitle : appConfig.appTitleEn}
              </span>
            </button>
            {view !== 'landing' && (
              <button
                onClick={() => setView('landing')}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 border-s border-gray-200 ps-3 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
                {lang === 'fa' ? 'بازگشت' : 'Back'}
              </button>
            )}
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { id: 'new-ticket', label: t.newTicket,                           icon: <IconPlus      className="w-3.5 h-3.5" /> },
              { id: 'tracking',   label: t.tracking,                            icon: <IconSearch    className="w-3.5 h-3.5" /> },
              { id: 'news',       label: lang === 'fa' ? 'اخبار' : 'News',      icon: <IconNewspaper className="w-3.5 h-3.5" /> },
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
            {/* Tohid Meta Port — external link */}
            <a
              href={toAbsoluteUrl(appConfig.metaPortUrl || '')}
              target={appConfig.metaPortUrl ? '_blank' : undefined}
              rel="noopener noreferrer"
              onClick={e => { if (!appConfig.metaPortUrl) e.preventDefault(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            >
              <IconPort className="w-3.5 h-3.5" />
              Tohid Meta Port
            </a>
          </nav>

          {/* Right side: lang toggle + staff login icon */}
          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
              <button onClick={() => setLang('fa')} className={`px-2.5 py-1 font-semibold transition-colors ${lang === 'fa' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>FA</button>
              <button onClick={() => setLang('en')} className={`px-2.5 py-1 font-semibold transition-colors ${lang === 'en' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>EN</button>
            </div>
            <button
              onClick={() => setView('admin')}
              title={t.expertPanel}
              className={`p-1.5 rounded-lg transition-colors ${view === 'admin' ? 'text-gray-900 bg-gray-100' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <IconLock className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className={`flex-grow w-full max-w-6xl mx-auto px-5 ${view === 'landing' ? 'py-0' : 'py-8'}`}>
        {isLoadingData && view === 'admin' ? (
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

                {/* ── Hero ── */}
                <section className="relative pt-10 pb-12 text-center border-b border-gray-100 overflow-hidden">
                  {appConfig.heroBgImage && (
                    <div className="absolute inset-0 pointer-events-none" style={{zIndex: 0}} aria-hidden="true">
                      <img src={appConfig.heroBgImage} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-white/75" />
                    </div>
                  )}
                  <div className="relative" style={{zIndex: 1}}>
                  <span className="inline-flex items-center gap-1.5 border border-gray-200 text-[11px] text-gray-500 px-3 py-1 rounded-full mb-5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
                    {lang === 'fa' ? 'پلتفرم رسمی خدمات صادراتی توحید دیهمی' : 'Tohid Dayhami Official Export Platform'}
                  </span>
                  <h1 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight mb-4 tracking-tight">
                    {lang === 'fa'
                      ? (appConfig.landingHeroTitle || 'مسیر جهانی شدن کسب‌وکار شما')
                      : 'Your Path to Global Business'}
                  </h1>
                  <p className="text-sm md:text-base text-gray-500 max-w-md mx-auto mb-7 leading-relaxed">
                    {lang === 'fa' ? (appConfig.landingHeroSubtitle || t.landingSubtitle) : t.landingSubtitle}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => setView('new-ticket')}
                      className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black transition-colors"
                    >
                      {t.startBtn}
                    </button>
                    <button
                      onClick={() => setView('tracking')}
                      className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      {t.trackBtn}
                    </button>
                  </div>
                  </div>{/* end z-index wrapper */}
                </section>

                {/* ── Services ── */}
                <section className="py-8 border-b border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
                    {lang === 'fa' ? 'خدمات تخصصی ما' : 'Our Services'}
                  </p>
                  {/* skeleton while loading */}
                  {!isServicesLoaded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {[1,2,3,4,5,6].map(n => (
                        <div key={n} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-center gap-3 animate-pulse">
                          <div className="w-8 h-8 rounded-lg bg-gray-200 shrink-0"/>
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-gray-200 rounded w-3/4"/>
                            <div className="h-2.5 bg-gray-100 rounded w-1/2"/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 ${!isServicesLoaded ? 'hidden' : ''}`}>
                    {services.filter(s => s.isActive).map((service, i) => {
                      const title    = lang === 'en' && service.titleEn ? service.titleEn : service.title;
                      const desc     = lang === 'en' && service.descriptionEn ? service.descriptionEn : service.description;
                      const isOpen   = expandedServiceId === service.id;
                      const t        = (service.title + ' ' + (service.titleEn||'')).toLowerCase();
                      const SvcIcon  =
                        service.id === 's_other'                                          ? IconMessageSquare :
                        t.includes('بسته‌بندی')||t.includes('packaging')                 ? IconLayout        :
                        t.includes('گرافیک')||t.includes('graphic')||t.includes('طراحی') ? IconMagic         :
                        t.includes('صادرات')||t.includes('export')                       ? IconTrendingUp    :
                        t.includes('فروش')||t.includes('sales')                          ? IconTarget        :
                        t.includes('مشاوره')||t.includes('consul')||t.includes('expert') ? IconBulb          :
                        t.includes('نرم‌افزار')||t.includes('software')                  ? IconDatabase      :
                        t.includes('ثبت')||t.includes('شرکت')||t.includes('register')    ? IconFileText      :
                        t.includes('بازخورد')||t.includes('feedback')                    ? IconMessageSquare :
                        t.includes('متاپورت')||t.includes('metaport')                    ? IconPort          :
                        t.includes('برند')||t.includes('brand')                          ? IconAward         :
                        t.includes('تبلیغ')||t.includes('market')                        ? IconMegaphone     :
                        t.includes('وب')||t.includes('web')||t.includes('سایت')          ? IconGlobe         :
                        t.includes('پروژه')||t.includes('project')                       ? IconFolder        :
                        t.includes('ابر')||t.includes('cloud')                           ? IconCloud         :
                        IconBriefcase;

                      return (
                        <div key={service.id}
                          className={`rounded-xl border transition-all duration-200 overflow-hidden
                            ${isOpen ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-gray-50 hover:border-gray-300 hover:bg-white'}`}>

                          {/* ── header row — always visible, click to toggle ── */}
                          <button
                            type="button"
                            onClick={() => setExpandedServiceId(isOpen ? null : service.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-start"
                          >
                            {/* SVG icon */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                              ${isOpen ? 'bg-white/10' : 'bg-white border border-gray-100'}`}>
                              <SvcIcon className={`w-4 h-4 ${isOpen ? 'text-white' : 'text-gray-500'}`} />
                            </div>
                            {/* title */}
                            <span className={`flex-1 text-sm font-medium leading-snug
                              ${isOpen ? 'text-white' : 'text-gray-800'}`}>
                              {title}
                            </span>
                            {/* chevron */}
                            <span className={`text-xs transition-transform duration-200 shrink-0
                              ${isOpen ? 'text-gray-400 rotate-180' : 'text-gray-300'}`}>▼</span>
                          </button>

                          {/* ── expandable body ── */}
                          {isOpen && (
                            <div className="px-4 pb-4 animate-fade-in">
                              {desc && (
                                <p className="text-xs text-gray-300 leading-relaxed border-t border-white/10 pt-3 mb-4">
                                  {desc}
                                </p>
                              )}
                              <button
                                onClick={() => openFormWithService(service.id)}
                                className="w-full py-2.5 px-4 rounded-lg bg-white text-gray-900 text-xs font-semibold hover:bg-gray-100 transition-colors"
                              >
                                {lang === 'fa' ? 'ثبت درخواست' : 'Request Service'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* ── Stats ── */}
                <section className="py-8 border-b border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { num: lang === 'fa' ? '+۷۰۰' : '700+', label: lang === 'fa' ? 'مشتری موفق' : 'Clients' },
                      { num: lang === 'fa' ? '+۳۰'  : '30+',  label: lang === 'fa' ? 'کشور هدف' : 'Countries' },
                      { num: lang === 'fa' ? '+۱۲'  : '12+',  label: lang === 'fa' ? 'سال تجربه' : 'Years' },
                      { num: lang === 'fa' ? '۲۴/۷' : '24/7', label: lang === 'fa' ? 'پشتیبانی آنلاین' : 'Support' },
                    ].map((s, i) => (
                      <div key={i}>
                        <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-0.5">{s.num}</div>
                        <div className="text-xs text-gray-500">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── How it works ── */}
                <section className="py-8 border-b border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
                    {lang === 'fa' ? 'نحوه دریافت خدمات' : 'How It Works'}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {t.features.map((f, i) => (
                      <div key={i} className="flex gap-3 p-4 rounded-xl border border-gray-100">
                        <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-white text-[10px] font-bold">{i + 1}</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-0.5">{f.title}</h3>
                          <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── Daily Tip ── */}
                {appConfig.showDailyTips && appConfig.dailyTips && appConfig.dailyTips.length > 0 && (
                  <section className="py-6 border-b border-gray-100">
                    <div className="flex gap-3 items-start">
                      <IconBulb className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                          {lang === 'fa' ? 'نکته صادراتی روز' : 'Export Tip'}
                        </p>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {appConfig.dailyTips[Math.floor(Math.random() * appConfig.dailyTips.length)]}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* ── CTA ── */}
                <section className="py-8 mb-6">
                  <div className="bg-gray-900 rounded-2xl p-8 md:p-10 text-center">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
                      {lang === 'fa' ? 'شروع همکاری' : 'Get Started'}
                    </p>
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                      {lang === 'fa' ? 'آماده ورود به بازارهای جهانی هستید؟' : 'Ready to go global?'}
                    </h2>
                    <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
                      {lang === 'fa'
                        ? 'درخواست خود را ثبت کنید، کارشناسان ما در اسرع وقت با شما تماس می‌گیرند.'
                        : 'Submit your request and our experts will reach out promptly.'}
                    </p>
                    <button
                      onClick={() => setView('new-ticket')}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
                    >
                      {t.startBtn}
                    </button>
                  </div>
                </section>

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
                onCancel={() => { setPreSelectedServiceId(null); setView('landing'); }}
                onGoToTracking={() => setView('tracking')}
                initialServiceId={preSelectedServiceId ?? undefined}
                lang={lang}
              />
            )}

            {view === 'tracking' && (
              <TrackingView tickets={tickets} services={services} lang={lang} />
            )}

            {view === 'custom-form' && (
              customFormId
                ? <PublicFormView
                    formId={customFormId}
                    lang={lang}
                    appTitle={lang === 'en' ? appConfig.appTitleEn : appConfig.appTitle}
                    onGoToTracking={() => setView('tracking')}
                  />
                : <div className="flex items-center justify-center py-24">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                  </div>
            )}

            {view === 'news' && (
              <NewsPage
                articles={news}
                lang={lang}
                onBack={() => setView('landing')}
                isLoading={isLoadingNews}
                initialArticleId={new URLSearchParams(window.location.search).get('id') || undefined}
              />
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
                    news={news}
                    analyticsEvents={analyticsEvents}
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
      <footer className="border-t border-gray-100 py-4 text-center">
        <p className="text-[11px] text-gray-400">{appConfig.footerText || t.footer}</p>
      </footer>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 flex justify-around py-2 z-50">
        {[
          { id: 'new-ticket', icon: <IconPlus className="w-5 h-5" />,      label: t.newTicket },
          { id: 'tracking',   icon: <IconSearch className="w-5 h-5" />,     label: t.tracking },
          { id: 'news',       icon: <IconNewspaper className="w-5 h-5" />,  label: lang === 'fa' ? 'اخبار' : 'News' },
          { id: 'admin',      icon: <IconLock className="w-5 h-5" />,       label: t.expertPanel },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id as ViewState)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 ${view === item.id ? 'text-gray-900' : 'text-gray-400'}`}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
        <a
          href={toAbsoluteUrl(appConfig.metaPortUrl || '')}
          target={appConfig.metaPortUrl ? '_blank' : undefined}
          rel="noopener noreferrer"
          onClick={e => { if (!appConfig.metaPortUrl) e.preventDefault(); }}
          className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-400"
        >
          <IconPort className="w-5 h-5" />
          <span className="text-[10px] font-medium">Meta Port</span>
        </a>
      </div>
    </div>
  );
};

export default App;
