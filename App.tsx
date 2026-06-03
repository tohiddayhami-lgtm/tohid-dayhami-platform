
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

// Translations Dictionary
export type Language = 'fa' | 'en';

export const DICTIONARY = {
  fa: {
    startBtn: 'شروع مشاوره و خدمات',
    trackBtn: 'پیگیری وضعیت پرونده',
    newTicket: 'ثبت درخواست',
    tracking: 'پیگیری',
    expertPanel: 'پنل کارشناسان',
    footer: '© 1403 پلتفرم جامع خدمات صادراتی. تمامی حقوق محفوظ است.',
    features: [
      { title: 'ارسال آنلاین مدارک', desc: 'بارگذاری کاتالوگ، عکس و ویدیو جهت بررسی کارشناسان' },
      { title: 'تحلیل هوشمند بازار', desc: 'استفاده از هوش مصنوعی برای ارزیابی پتانسیل محصول' },
      { title: 'پیگیری مرحله به مرحله', desc: 'اطلاع از وضعیت دقیق درخواست در پنل کاربری' },
    ],
    alertSuccess: 'درخواست شما با موفقیت ثبت شد.\nشماره پیگیری: ',
    landingSubtitle: 'اولین و بزرگترین پلتفرم هوشمند خدمات صادراتی و بازرگانی کشور. با ما مسیر ورود به بازارهای جهانی را هموار کنید.'
  },
  en: {
    startBtn: 'Start Services',
    trackBtn: 'Track Request',
    newTicket: 'New Request',
    tracking: 'Tracking',
    expertPanel: 'Staff Login',
    footer: '© 2024 Comprehensive Export Platform. All rights reserved.',
    features: [
      { title: 'Online Submission', desc: 'Upload documents for expert review' },
      { title: 'AI Market Analysis', desc: 'Smart evaluation of product potential' },
      { title: 'Live Tracking', desc: 'Track your request status in real-time' },
    ],
    alertSuccess: 'Your request has been submitted successfully.\nTracking ID: ',
    landingSubtitle: 'The leading smart export and trade services platform. Paving your path to global markets.'
  }
};

// Default Services with Updated Price Structure and Sub-services
const DEFAULT_SERVICES: ServiceOption[] = [
  { 
    id: 's1', 
    title: 'مشاوره تخصصی صادرات', titleEn: 'Expert Export Consultation',
    description: 'مشاوره ورود به بازار و قوانین گمرکی', descriptionEn: 'Market entry strategy and customs regulations',
    icon: '🌍', isActive: true, price: { amount: 5000000, currency: 'IRR' }
  },
  { 
    id: 's2', 
    title: 'خدمات مدیریت صادرات (EMC)', titleEn: 'Export Management (EMC)',
    description: 'برون‌سپاری کامل فرایند فروش خارجی', descriptionEn: 'Complete outsourcing of foreign sales processes',
    icon: '🤝', isActive: true, price: { amount: 0, currency: 'IRR' }
  },
  { 
    id: 's3', 
    title: 'طراحی بسته‌بندی صادراتی', titleEn: 'Export Packaging Design',
    description: 'طراحی استاندارد برای بازارهای جهانی', descriptionEn: 'Standard design for global markets',
    icon: '📦', isActive: true, price: { amount: 30000000, currency: 'IRR' }
  },
  { 
    id: 's4', 
    title: 'طراحی گرافیک و کاتالوگ', titleEn: 'Graphic Design & Catalog',
    description: 'تولید محتوای بصری بین‌المللی', descriptionEn: 'International visual content production',
    icon: '🎨', isActive: true, price: { amount: 15000000, currency: 'IRR' },
    subServices: [
        { id: 'sub1', title: 'طراحی لوگو', titleEn: 'Logo Design', price: { amount: 5000000, currency: 'IRR' } },
        { id: 'sub2', title: 'کارت ویزیت', titleEn: 'Business Card', price: { amount: 2000000, currency: 'IRR' } },
        { id: 'sub3', title: 'کاتالوگ دیجیتال', titleEn: 'Digital Catalog', price: { amount: 10000000, currency: 'IRR' } },
        { id: 'sub4', title: 'هویت بصری (برندینگ)', titleEn: 'Visual Identity', price: { amount: 25000000, currency: 'IRR' } }
    ]
  },
  { 
    id: 's5', 
    title: 'تورهای تجاری', titleEn: 'Business Trade Tours',
    description: 'اعزام هیئت تجاری و بازدید از نمایشگاه', descriptionEn: 'Trade delegation dispatch and exhibition visits',
    icon: '✈️', isActive: true, price: { amount: 1500, currency: 'USD' }
  },
  { 
    id: 's6', 
    title: 'دوره آموزشی بازرگانی', titleEn: 'Trade Training Courses',
    description: 'کارگاه‌های تخصصی صادرات و واردات', descriptionEn: 'Specialized export and import workshops',
    icon: '🎓', isActive: true, price: { amount: 3000000, currency: 'IRR' }
  },
  { 
    id: 's7', 
    title: 'غرفه مجازی', titleEn: 'Virtual Exhibition Booth',
    description: 'نمایش محصولات در نمایشگاه‌های آنلاین', descriptionEn: 'Product display in online exhibitions',
    icon: '💻', isActive: true, price: { amount: 10000000, currency: 'IRR' }
  },
];

const DEFAULT_PERSONNEL: Personnel[] = [
  { 
    id: 'p_master', 
    fullName: 'Master Admin', 
    roles: ['مدیر'], 
    jobDescription: 'مدیر کل سیستم با دسترسی نامحدود به تمامی بخش‌ها.',
    email: 'master@export.com', 
    username: 'master', 
    password: 'MasterAdmin2024', 
    status: 'active',
    permissions: { canAssign: true, canViewCustomers: true, canViewTariffs: true, canViewAllTickets: true, canIssueInvoices: true }
  },
  { 
    id: 'p1', 
    fullName: 'مدیر ارشد سیستم', 
    roles: ['مدیر'], 
    jobDescription: 'نظارت بر عملکرد تیم فروش و پیگیری قراردادهای کلان.',
    reportsTo: 'p_master', // Reports to Master
    email: 'admin@export.com', 
    username: 'admin', 
    password: 'Tohid123@', 
    status: 'active',
    permissions: { canAssign: true, canViewCustomers: true, canViewTariffs: true, canViewAllTickets: true, canIssueInvoices: true }
  },
  { 
    id: 'p2', 
    fullName: 'کارشناس فروش', 
    roles: ['کارشناس صادرات'], 
    jobDescription: 'پیگیری لیدهای ورودی و تبدیل به مشتری نهایی.',
    reportsTo: 'p1', // Reports to Admin
    email: 'sales@export.com', 
    username: 'sales', 
    password: '123', 
    status: 'active',
    permissions: { canAssign: false, canViewCustomers: false, canViewTariffs: true, canViewAllTickets: false, canIssueInvoices: true }
  },
];

// Initial Config with Default Form Fields
const INITIAL_CONFIG: AppConfig = {
  appTitle: 'پلتفرم جامع صادراتی',
  appTitleEn: 'Export Platform',
  appSubtitle: 'مشاوره، توسعه بازار و خدمات بازرگانی',
  appSubtitleEn: 'Consultancy, Market Development & Trade Services',
  
  landingHeroTitle: 'مسیر جهانی شدن کسب‌وکار شما',
  landingHeroSubtitle: 'اولین و بزرگترین پلتفرم هوشمند خدمات صادراتی و بازرگانی کشور. با ما مسیر ورود به بازارهای جهانی را هموار کنید.',
  footerText: '© 1403 پلتفرم جامع خدمات صادراتی. تمامی حقوق محفوظ است.',
  
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

// Storage Keys
const STORAGE_KEYS = {
  USER: 'crm_session_user',
  VIEW: 'crm_last_view',
  LAST_ACTIVE: 'crm_last_active'
};
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 Minutes

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

  // Wrapper for setView to persist state
  const setView = (newView: ViewState) => {
    setViewState(newView);
    localStorage.setItem(STORAGE_KEYS.VIEW, newView);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);

  // Session Restoration & Inactivity Check
  useEffect(() => {
    const restoreSession = () => {
        const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
        const storedView = localStorage.getItem(STORAGE_KEYS.VIEW);
        const lastActive = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
        const now = Date.now();

        if (storedUser && lastActive) {
            if (now - parseInt(lastActive) > INACTIVITY_TIMEOUT) {
                // Session expired
                handleLogout();
            } else {
                // Restore session
                try {
                    setCurrentUser(JSON.parse(storedUser));
                    // Update activity timestamp
                    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, now.toString());
                    
                    if (storedView) {
                        setViewState(storedView as ViewState);
                    }
                } catch (e) {
                    console.error("Failed to parse stored session", e);
                    handleLogout();
                }
            }
        }
    };

    restoreSession();
  }, []);

  // Activity Tracker
  useEffect(() => {
      const updateActivity = () => {
          if (currentUser) {
              localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, Date.now().toString());
          }
      };

      const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      events.forEach(event => window.addEventListener(event, updateActivity));

      // Periodic check for expiration
      const interval = setInterval(() => {
          const lastActive = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
          if (currentUser && lastActive) {
              if (Date.now() - parseInt(lastActive) > INACTIVITY_TIMEOUT) {
                  handleLogout();
                  alert('نشست کاربری شما به دلیل عدم فعالیت منقضی شد. لطفاً مجدداً وارد شوید.');
              }
          }
      }, 60000); // Check every minute

      return () => {
          events.forEach(event => window.removeEventListener(event, updateActivity));
          clearInterval(interval);
      };
  }, [currentUser]);


  // Real-time subscriptions to Firebase
  useEffect(() => {
    // Tickets Subscription
    const unsubTickets = subscribeToTickets((data) => {
      setTickets(data);
      setIsLoadingData(false);
    });

    // Customers Subscription
    const unsubCustomers = subscribeToCustomers((data) => {
      setCustomers(data);
    });

    // Messages Subscription
    const unsubMessages = subscribeToMessages((data) => {
        setMessages(data);
    });

    // Tasks Subscription
    const unsubTasks = subscribeToTasks((data) => {
        setTasks(data);
    });

    // Meetings Subscription
    const unsubMeetings = subscribeToMeetings((data) => {
        setMeetings(data);
    });

    // KPIs Subscription
    const unsubKPIs = subscribeToKPIs((data) => {
        setKpis(data);
    });

    // Settings (Config, Services, Personnel) Subscription
    const unsubSettings = subscribeToSettings(
      (cfg) => { if (cfg) setAppConfig(cfg); },
      (srv) => { 
          if (srv) {
              // Migration for legacy price strings
              const migratedServices = srv.map((s: any) => ({
                  ...s,
                  price: typeof s.price === 'string' 
                      ? { amount: 0, currency: 'IRR' } // Fallback for old data
                      : (s.price || { amount: 0, currency: 'IRR' })
              }));
              setServices(migratedServices);
          }
      },
      (ppl) => { 
        if (ppl) {
            // Data Migration: Ensure 'roles' array exists even for legacy data
            const migratedPersonnel = ppl.map((p: any) => ({
                ...p,
                roles: Array.isArray(p.roles) ? p.roles : (p.role ? [p.role] : []),
                permissions: p.permissions || {} // Ensure permissions object exists
            }));
            setPersonnel(migratedPersonnel);
        }
      }
    );

    // Cleanup listeners on unmount
    return () => {
      unsubTickets();
      unsubCustomers();
      unsubSettings();
      unsubMessages();
      unsubTasks();
      unsubMeetings();
      unsubKPIs();
    };
  }, []);

  // --- Auto Assignment Logic ---
  const calculateAssignee = useCallback((serviceIdOrTitle: string): string | undefined => {
      const config = appConfig.assignmentConfig;
      if (!config || config.mode === 'manual' || !config.serviceRoleMap) return undefined;

      // 1. Try direct ID match
      let targetRole = config.serviceRoleMap[serviceIdOrTitle];

      // 2. If not found (e.g. Google Form sent "Consulting" instead of "s1"), try to find service by Title
      if (!targetRole) {
          const serviceObj = services.find(s => 
              s.title === serviceIdOrTitle || 
              s.titleEn === serviceIdOrTitle || 
              s.title.includes(serviceIdOrTitle) // Fuzzy check
          );
          if (serviceObj) {
              targetRole = config.serviceRoleMap[serviceObj.id];
          }
      }

      if (!targetRole) return undefined;

      // Filter active personnel with the target role
      const eligibleStaff = personnel.filter(p => p.roles.includes(targetRole) && p.status === 'active');
      if (eligibleStaff.length === 0) return undefined;

      // Random Mode
      if (config.mode === 'random') {
          const randomIndex = Math.floor(Math.random() * eligibleStaff.length);
          return eligibleStaff[randomIndex].id;
      }

      // Load Balance Mode (Round Robin-ish based on active workload)
      if (config.mode === 'auto_load_balance') {
          // Calculate active tickets for each eligible staff member
          const staffWorkload = eligibleStaff.map(staff => {
              const activeCount = tickets.filter(t => 
                  t.assignedTo === staff.id && 
                  t.status !== TicketStatus.COMPLETED && 
                  t.status !== TicketStatus.CANCELLED
              ).length;
              return { id: staff.id, count: activeCount };
          });

          // Sort by workload (ascending)
          staffWorkload.sort((a, b) => a.count - b.count);
          
          // Return the ID of the person with the least work
          return staffWorkload[0].id;
      }

      return undefined;
  }, [appConfig.assignmentConfig, personnel, tickets, services]);

  // --- External Ticket Watcher (For Google Forms / External Sources) ---
  useEffect(() => {
      // Logic to auto-assign tickets that come from external sources (e.g. Google Forms)
      // This runs only for authorized users (Admin/Master) to prevent race conditions from multiple clients.
      
      if (!currentUser || !appConfig.assignmentConfig || appConfig.assignmentConfig.mode === 'manual') return;
      
      const isAuthorized = currentUser.username === 'master' || currentUser.roles.includes('مدیر');
      if (!isAuthorized) return;

      const unassigned = tickets.filter(t => !t.assignedTo && t.status !== TicketStatus.CANCELLED && t.status !== TicketStatus.COMPLETED);
      
      if (unassigned.length === 0) return;

      const processAssignments = async () => {
          for (const ticket of unassigned) {
              let assigneeId = calculateAssignee(ticket.serviceId);
              
              // Fallback Logic: if no assignee found via strict rules, assign to first Sales Manager
              // This is a safety net for Google Forms to ensure they get assigned
              if (!assigneeId) {
                  const salesManager = personnel.find(p => p.roles.includes('مدیر فروش') || p.roles.includes('Sales Manager'));
                  if (salesManager) {
                      assigneeId = salesManager.id;
                  }
              }

              if (assigneeId) {
                  const assignee = personnel.find(p => p.id === assigneeId);
                  if (assignee) {
                      const note: TimelineEntry = {
                          type: 'assignment',
                          title: 'ارجاع خودکار (سیستم)',
                          description: `دریافت از ورودی خارجی و ارجاع هوشمند به ${assignee.fullName}`,
                          actorName: 'System Bot',
                          timestamp: new Date().toISOString(),
                          visibility: 'internal'
                      };
                      
                      // Perform update
                      await updateTicketInCloud(ticket.id, {
                          assignedTo: assigneeId,
                          timeline: [...(ticket.timeline || []), note]
                      });
                  }
              }
          }
      };

      processAssignments();

  }, [tickets, currentUser, appConfig.assignmentConfig, calculateAssignee, personnel]);


  // Shared Logic for Saving Ticket
  const saveNewTicketToSystem = async (ticket: Ticket) => {
    // --- ASSIGNMENT LOGIC ---
    let assignedTo = ticket.assignedTo;
    let assignmentNote: TimelineEntry | null = null;

    if (!assignedTo) {
        const autoAssignedId = calculateAssignee(ticket.serviceId);
        if (autoAssignedId) {
            assignedTo = autoAssignedId;
            const assigneeName = personnel.find(p => p.id === autoAssignedId)?.fullName || 'Unknown';
            assignmentNote = {
                type: 'assignment',
                title: 'ارجاع هوشمند',
                description: `تیکت به صورت اتوماتیک به ${assigneeName} ارجاع شد.`,
                actorName: 'سیستم',
                timestamp: new Date().toISOString(),
                visibility: 'internal'
            };
        }
    }

    const initialTimeline: TimelineEntry[] = [
        {
            type: 'creation',
            title: 'ثبت درخواست',
            description: 'درخواست در سامانه ثبت شد',
            timestamp: new Date().toISOString(),
            actorName: 'سیستم',
            visibility: 'public'
        },
        ...(ticket.timeline || [])
    ];

    if (assignmentNote) {
        initialTimeline.push(assignmentNote);
    }

    // Check if customer exists to update or create
    let newCustomer: Customer | undefined;
    const existingCustomer = customers.find(c => c.phoneNumber === ticket.phoneNumber);
    
    if (existingCustomer) {
        newCustomer = {
            ...existingCustomer,
            fullName: ticket.customerName,
            companyName: ticket.companyName || existingCustomer.companyName,
            location: ticket.location || existingCustomer.location,
            whatsappNumber: ticket.whatsappNumber,
            businessType: ticket.businessType || existingCustomer.businessType,
            totalTickets: existingCustomer.totalTickets + 1,
            source: existingCustomer.source || 'Web Form'
        };
    } else {
        // Generate Unique Loyalty Code for New Customers
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const phoneSuffix = ticket.phoneNumber.substring(ticket.phoneNumber.length - 4);
        const loyaltyCode = `VIP-${phoneSuffix}-${randomStr}`;

        newCustomer = {
            id: `C-${Date.now()}`,
            fullName: ticket.customerName,
            companyName: ticket.companyName,
            location: ticket.location,
            phoneNumber: ticket.phoneNumber,
            whatsappNumber: ticket.whatsappNumber,
            businessType: ticket.businessType,
            firstContact: new Date().toISOString(),
            totalTickets: 1,
            source: 'Web Form',
            loyaltyCode: loyaltyCode
        };
    }
    
    // Add timeline if empty
    const ticketToSave = {
        ...ticket,
        assignedTo: assignedTo,
        timeline: initialTimeline
    };

    await saveTicketToCloud(ticketToSave);
    if (newCustomer) await saveCustomerToCloud(newCustomer);
  };

  const handleNewTicket = async (ticketOrTickets: Ticket | Ticket[]) => {
     try {
         if (Array.isArray(ticketOrTickets)) {
             // Handle array of tickets (Multi-Select Service)
             for (const t of ticketOrTickets) {
                 await saveNewTicketToSystem(t);
             }
         } else {
             await saveNewTicketToSystem(ticketOrTickets);
         }
     } catch (e) {
         console.error("Database Save Error", e);
         alert("خطا در ذخیره سازی در دیتابیس.");
         throw e;
     }
  };

  const handleUpdateTicket = async (id: string, updates: Partial<Ticket>, actorName: string, actionNote?: string, visibility: 'public' | 'internal' = 'public') => {
    let updatePayload = { ...updates };
    const currentTicket = tickets.find(t => t.id === id);
    
    // Construct new timeline entry
    let newEntry: TimelineEntry | null = null;
    
    if (actionNote) {
        // Explicit comment/action note
        newEntry = {
            type: updates.projectData ? 'project_update' : (updates.status ? 'status_change' : (updates.assignedTo ? 'assignment' : 'comment')),
            title: updates.status ? 'تغییر وضعیت' : (updates.assignedTo ? 'تغییر مسئول' : (updates.projectData ? 'بروزرسانی پروژه' : 'یادداشت')),
            description: actionNote,
            timestamp: new Date().toISOString(),
            actorName: actorName,
            visibility: visibility
        };
    } else if (updates.status && updates.status !== currentTicket?.status) {
         newEntry = {
            type: 'status_change',
            title: `تغییر وضعیت به ${updates.status}`,
            timestamp: new Date().toISOString(),
            actorName: actorName,
            visibility: 'public'
         };
    }

    if (newEntry) {
        // Append to existing timeline or create new array
        const existingTimeline = currentTicket?.timeline || [];
        updatePayload.timeline = [...existingTimeline, newEntry];
    }

    await updateTicketInCloud(id, updatePayload);
  };
  
  const handleDeleteTicket = async (id: string) => {
      await deleteTicketFromCloud(id);
  };

  const handleUpdateCustomers = async (newCustomersList: Customer[]) => {
      // For imports, we just save the new ones to cloud.
      // The state will be updated by the listener.
      const imported = newCustomersList.filter(c => c.source?.startsWith('Import') && !customers.find(old => old.id === c.id));
      if (imported.length > 0) {
          await saveCustomersBulkToCloud(imported);
      }
  };

  const handleEditCustomer = async (id: string, updates: Partial<Customer>) => {
      await updateCustomerInCloud(id, updates);
  };

  const handleDeleteCustomer = async (id: string) => {
      await deleteCustomerFromCloud(id);
  };
  
  const handleUpdateServices = async (newServices: ServiceOption[]) => {
      await saveServicesToCloud(newServices);
  };
  
  const handleUpdatePersonnel = async (newPersonnel: Personnel[]) => {
      await savePersonnelToCloud(newPersonnel);
  };

  const handleUpdateConfig = async (newConfig: AppConfig) => {
      await saveAppConfigToCloud(newConfig);
  };

  const handleLogin = async (u: string, p: string): Promise<boolean> => {
    const user = personnel.find(person => person.username === u && person.password === p);
    if (user) {
      setCurrentUser(user);
      // Log Login
      logSystemAction('LOGIN', 'System', 'ورود کاربر به سیستم', user.fullName, user.id);
      
      // Persist Session
      try {
        const safeUser = sanitizeData(user); // Ensure no cycles before stringify
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(safeUser));
        localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, Date.now().toString());
      } catch (e) {
        console.error("Failed to save session", e);
      }
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('landing');
    // Clear Session
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.VIEW);
    localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE);
  };

  const NavItem = ({ active, label, icon, onClick }: any) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
        active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className={`min-h-screen bg-gray-50 flex flex-col font-sans ${lang === 'fa' ? 'font-vazir' : ''}`} dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('landing')}>
            <div className="bg-indigo-600 text-white p-2 rounded-lg">
               <IconShield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{lang === 'fa' ? appConfig.appTitle : appConfig.appTitleEn}</h1>
              <p className="text-xs text-gray-500">{lang === 'fa' ? appConfig.appSubtitle : appConfig.appSubtitleEn}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex gap-2">
              <NavItem 
                active={view === 'new-ticket'} 
                label={t.newTicket} 
                icon={<IconPlus className="w-4 h-4" />}
                onClick={() => setView('new-ticket')} 
              />
              <NavItem 
                active={view === 'tracking'} 
                label={t.tracking} 
                icon={<IconSearch className="w-4 h-4" />}
                onClick={() => setView('tracking')} 
              />
              <NavItem 
                active={view === 'admin'} 
                label={t.expertPanel} 
                icon={<IconLayout className="w-4 h-4" />}
                onClick={() => setView('admin')} 
              />
            </nav>
            
            {/* Language Switcher */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white">
               <button 
                 onClick={() => setLang('fa')}
                 className={`px-3 py-1 text-sm font-bold transition-colors ${lang === 'fa' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
               >
                 FA
               </button>
               <div className="w-px bg-gray-200"></div>
               <button 
                 onClick={() => setLang('en')}
                 className={`px-3 py-1 text-sm font-bold transition-colors ${lang === 'en' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
               >
                 EN
               </button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
             <button onClick={() => setView(view === 'landing' ? 'new-ticket' : 'landing')} className="text-gray-600">
                <IconLayout />
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full">
        {isLoadingData && view !== 'landing' ? (
           <div className="flex items-center justify-center h-64">
               <div className="text-gray-500 flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>در حال دریافت اطلاعات از سرور...</span>
               </div>
           </div>
        ) : (
          <>
            {view === 'landing' && (
              <div className="animate-fade-in">
                <div className="text-center py-20">
                  <h2 className="text-4xl md:text-6xl font-black text-gray-900 mb-6 leading-tight whitespace-pre-line">
                    {lang === 'fa' ? (appConfig.landingHeroTitle || 'مسیر جهانی شدن کسب‌وکار شما') : 'Globalize Your Business'}
                  </h2>
                  <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed whitespace-pre-line">
                    {lang === 'fa' ? (appConfig.landingHeroSubtitle || t.landingSubtitle) : t.landingSubtitle}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                      onClick={() => setView('new-ticket')}
                      className="px-8 py-4 bg-indigo-600 text-white rounded-xl text-lg font-bold shadow-xl shadow-indigo-200 hover:scale-105 transition-transform"
                    >
                      {t.startBtn}
                    </button>
                    <button 
                      onClick={() => setView('tracking')}
                      className="px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-xl text-lg font-bold hover:bg-gray-50 transition-colors"
                    >
                      {t.trackBtn}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24">
                    {t.features.map((f, i) => (
                      <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                          <div className="text-4xl mb-4">{[ '📂', '🌍', '📊'][i]}</div>
                          <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                          <p className="text-gray-500">{f.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Daily Tip Section */}
                  {appConfig.showDailyTips && appConfig.dailyTips && appConfig.dailyTips.length > 0 && (
                      <div className="mt-20 max-w-2xl mx-auto">
                          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 relative">
                              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-white p-2 rounded-full border border-yellow-200 shadow-sm">
                                  <IconBulb className="w-6 h-6 text-yellow-500" />
                              </div>
                              <h4 className="font-bold text-yellow-800 mb-2">{lang === 'fa' ? 'نکته روز صادرات' : 'Daily Export Tip'}</h4>
                              <p className="text-gray-700 italic font-medium">
                                  "{appConfig.dailyTips[Math.floor(Math.random() * appConfig.dailyTips.length)]}"
                              </p>
                          </div>
                      </div>
                  )}
                </div>

                {/* Featured Businesses Section (Ads) */}
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
              <TrackingView 
                tickets={tickets} 
                services={services}
                lang={lang}
              />
            )}

            {view === 'admin' && (
              <>
                {!currentUser ? (
                  <LoginView 
                    onLogin={handleLogin} 
                    onBack={() => setView('landing')}
                  />
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

      <footer className="bg-white border-t border-gray-200 py-8 text-center text-gray-500 text-sm">
        <p>{appConfig.footerText || t.footer}</p>
      </footer>
      
      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-3 z-50">
          <button onClick={() => setView('new-ticket')} className={`flex flex-col items-center ${view === 'new-ticket' ? 'text-indigo-600' : 'text-gray-400'}`}>
             <IconPlus className="w-6 h-6" />
             <span className="text-xs mt-1">{t.newTicket}</span>
          </button>
          <button onClick={() => setView('tracking')} className={`flex flex-col items-center ${view === 'tracking' ? 'text-indigo-600' : 'text-gray-400'}`}>
             <IconSearch className="w-6 h-6" />
             <span className="text-xs mt-1">{t.tracking}</span>
          </button>
           <button onClick={() => setView('admin')} className={`flex flex-col items-center ${view === 'admin' ? 'text-indigo-600' : 'text-gray-400'}`}>
             <IconLayout className="w-6 h-6" />
             <span className="text-xs mt-1">{t.expertPanel}</span>
          </button>
      </div>
    </div>
  );
};

export default App;
