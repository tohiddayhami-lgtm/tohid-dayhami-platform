
import React, { useState, useEffect, useRef } from 'react';
import { Ticket, TicketStatus, ServiceOption, Personnel, Customer, AppConfig, ProjectDetails, AttachedFile, Currency, Payment, InternalMessage, Invoice, Task, Meeting, SystemLog, ProjectMilestone, ProjectRisk, ProjectTeamMember, ProjectParty, ProjectPartyType, ProjectDefinitionItem, KPI, CustomForm, PerformanceReport, NewsArticle, AnalyticsEvent, CustomerAccount, CompanyProcess, TicketLabel, MetaShop, MetaShopOrder, MetaBazaar } from '../types';
import { IconCheck, IconActivity, IconUsers, IconBriefcase, IconLayout, IconPaperclip, IconShield, IconSettings, IconClock, IconFile, IconEdit, IconTrash, IconProject, IconMoney, IconUpload, IconPlus, IconChart, IconMail, IconInvoice, IconList, IconCalendarClock, IconHistory, IconCopy, IconSearch, IconFlag, IconAlertTriangle, IconTime, IconTrendingUp, IconRefreshCw, IconLock, IconMegaphone, IconBarChart2, IconMapPin, IconWhatsapp, IconTarget, IconClipboard, IconFolder, IconAward, IconWallet, IconMindMap, IconStar, IconTag } from './Icons';
import { ServiceManager } from './ServiceManager';
import { PersonnelManager } from './PersonnelManager';
import { CustomerManager } from './CustomerManager';
import { SettingsManager } from './SettingsManager';
import { NewsManager } from './NewsManager';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { IconNewspaper, IconGlobe, IconImage, IconPort, IconBarChart2 as IconAnalytics } from './Icons';
import { InternalMessenger } from './InternalMessenger';
import { InvoiceModal } from './InvoiceModal';
import { InvoiceManager } from './InvoiceManager';
import { getStaffCode } from '../services/staffId';
import { MetaShopManager } from './MetaShopManager';
import { canAccessMetaShop, canEditMetaShop, canDeleteMetaShopRecords, canDeleteBooths } from '../utils/metaShopAccess';
import { TaskManager } from './TaskManager';
import { MeetingCalendar } from './MeetingCalendar';
import { PerformanceReports } from './PerformanceReports';
import { KPIManager } from './KPIManager';
import { SalesDashboard } from './SalesDashboard';
import { ReportManager } from './ReportManager';
import { ExpenseManager } from './ExpenseManager';
import { FormBuilderPanel } from './FormBuilderPanel';
import { NotificationCenter } from './NotificationCenter';
import { CustomerAccountManager } from './CustomerAccountManager';
import { ProcessManager } from './ProcessManager';
import { CustomerBank } from './CustomerBank';
import { uploadFileWithProgress, logSystemAction, subscribeToSystemLogs, saveTaskToCloud, restoreEntityFromLog, sendInternalMessage, subscribeToCustomForms, saveReport, saveNotificationLog } from '../services/firebaseService';
import { sendWhatsAppNotification, sendMasterCopy, renderTemplate, buildLog } from '../services/notificationService';
import { Language } from '../App';

interface Props {
  currentUser: Personnel;
  tickets: Ticket[];
  services: ServiceOption[];
  personnel: Personnel[];
  customers: Customer[];
  messages: InternalMessage[];
  tasks: Task[];
  meetings: Meeting[];
  kpis?: KPI[];
  news?: NewsArticle[];
  analyticsEvents?: AnalyticsEvent[];
  config: AppConfig;
  onCreateTicket: (ticket: Ticket) => Promise<void>;
  onUpdateTicket: (ticketId: string, updates: Partial<Ticket>, actorName: string, actionNote?: string, visibility?: 'public' | 'internal', files?: AttachedFile[]) => void;
  onDeleteTicket: (ticketId: string) => Promise<void>;
  onUpdateServices: (services: ServiceOption[]) => void;
  onUpdatePersonnel: (personnel: Personnel[]) => void;
  onUpdateCustomers: (customers: Customer[]) => void; 
  onEditCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onUpdateConfig: (config: AppConfig) => void;
  onLogout: () => void;
  lang: Language;
  customerAccounts?: CustomerAccount[];
  onSaveCustomerAccount?: (account: CustomerAccount) => Promise<void>;
  onDeleteCustomerAccount?: (id: string) => Promise<void>;
  processes?: CompanyProcess[];
  onSaveProcess?: (process: CompanyProcess) => Promise<void>;
  onDeleteProcess?: (id: string) => Promise<void>;
  invoices?: Invoice[];
  onSaveInvoice?: (invoice: Invoice) => Promise<void>;
  onDeleteInvoice?: (id: string) => Promise<void>;
  metaShops?: MetaShop[];
  metaShopOrders?: MetaShopOrder[];
  onSaveMetaShop?: (shop: MetaShop) => Promise<void>;
  onDeleteMetaShop?: (id: string) => Promise<void>;
  onUpdateMetaShopOrder?: (id: string, updates: Partial<MetaShopOrder>) => Promise<void>;
  shopBaseUrl?: string;
  metaBazaars?: MetaBazaar[];
  onSaveMetaBazaar?: (b: MetaBazaar) => Promise<void>;
  onDeleteMetaBazaar?: (id: string) => Promise<void>;
}

export const AdminDashboard: React.FC<Props> = ({
  currentUser,
  tickets,
  services,
  personnel,
  customers,
  messages,
  tasks,
  meetings,
  kpis = [],
  news = [],
  analyticsEvents = [],
  config,
  onCreateTicket,
  onUpdateTicket,
  onDeleteTicket,
  onUpdateServices,
  onUpdatePersonnel,
  onUpdateCustomers,
  onEditCustomer,
  onDeleteCustomer,
  onUpdateConfig,
  onLogout,
  lang,
  customerAccounts = [],
  onSaveCustomerAccount,
  onDeleteCustomerAccount,
  processes = [],
  onSaveProcess,
  onDeleteProcess,
  invoices = [],
  onSaveInvoice,
  onDeleteInvoice,
  metaShops = [],
  metaShopOrders = [],
  onSaveMetaShop,
  onDeleteMetaShop,
  onUpdateMetaShopOrder,
  shopBaseUrl = '',
  metaBazaars = [],
  onSaveMetaBazaar,
  onDeleteMetaBazaar,
}) => {
  const safeRoles = currentUser?.roles || [];
  const isAdmin = safeRoles.includes('مدیر');
  const isMaster = currentUser?.username === 'master';
  
  const canManageInvoices = isAdmin || isMaster || currentUser?.permissions?.canIssueInvoices || currentUser?.permissions?.canViewAllInvoices;
  const canEditInvoices = isAdmin || isMaster || currentUser?.permissions?.canIssueInvoices;
  const canAssign = isAdmin || isMaster || currentUser?.permissions?.canAssign;
  const hasCustomerAccess = isAdmin || isMaster || currentUser?.permissions?.canViewCustomers;
  const hasTariffAccess = isAdmin || isMaster || currentUser?.permissions?.canViewTariffs;
  const canViewAllTickets = isAdmin || isMaster || currentUser?.permissions?.canViewAllTickets;
  const hasMetaShopAccess = canAccessMetaShop(currentUser);
  const canEditMetaShopPanel = canEditMetaShop(currentUser);
  const canDeleteMetaShopPanel = canDeleteMetaShopRecords(currentUser);
  const canDeleteBoothsInMetaShop = canDeleteBooths(currentUser);

  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'services' | 'personnel' | 'settings' | 'messages' | 'tasks' | 'meetings' | 'logs' | 'reports' | 'kpi' | 'forms' | 'sales' | 'staff_reports' | 'expenses' | 'news_mgmt' | 'seo' | 'analytics' | 'notifications' | 'customer_accounts' | 'processes' | 'customer_bank' | 'invoices' | 'metashop'>('overview');
  const [seoForm, setSeoForm] = useState({ favicon: config.favicon || '', seoTitle: config.seoTitle || '', seoDescription: config.seoDescription || '', seoKeywords: config.seoKeywords || '', ogTitle: config.ogTitle || '', ogDescription: config.ogDescription || '', ogImage: config.ogImage || '', metaPortUrl: config.metaPortUrl || '' });
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconProgress, setFaviconProgress] = useState(0);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  // Optimistic flag state so the star toggles instantly (independent of the Firestore round-trip)
  const [flagOverride, setFlagOverride] = useState<Record<string, boolean>>({});
  const isFlaggedOf = (tk: Ticket) => flagOverride[tk.id] !== undefined ? flagOverride[tk.id] : !!tk.isFlagged;
  const toggleFlag = (tk: Ticket) => { const next = !isFlaggedOf(tk); setFlagOverride(o => ({ ...o, [tk.id]: next })); onUpdateTicket(tk.id, { isFlagged: next }, currentUser.fullName || currentUser.username); };
  const [heroBgUploading, setHeroBgUploading] = useState(false);
  const [heroBgProgress, setHeroBgProgress] = useState(0);
  const heroBgInputRef = useRef<HTMLInputElement>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'my' | 'history'>(canViewAllTickets ? 'all' : 'my');
  const [projectSubTab, setProjectSubTab] = useState<'active' | 'history'>('active');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('blue');
  const [globalSearch, setGlobalSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'info' | 'project'>('info');
  const [newComment, setNewComment] = useState('');
  const [commentFiles, setCommentFiles] = useState<AttachedFile[]>([]);
  const [commentVisibility, setCommentVisibility] = useState<'public' | 'internal'>('public');
  const [showMentionList, setShowMentionList] = useState(false);
  const [editingFileLabelKey, setEditingFileLabelKey] = useState<string | null>(null);
  const [editingFileLabelValue, setEditingFileLabelValue] = useState('');
  
  const [isEditingTicket, setIsEditingTicket] = useState(false);
  const [editingTicketData, setEditingTicketData] = useState<Partial<Ticket>>({});
  
  const [tempAssignedTo, setTempAssignedTo] = useState<string>('');

  // ── Bulk actions (overview / cartable) ──
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState<string>('');
  const [bulkAssignValue, setBulkAssignValue] = useState<string>('');

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>(undefined);

  const [quickReportText, setQuickReportText] = useState('');
  const [quickReportItems, setQuickReportItems] = useState<string[]>([]);
  const [isSavingQuickReport, setIsSavingQuickReport] = useState(false);
  const [formLinkCopied, setFormLinkCopied] = useState(false);

  // ── Logs filters ──
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('all');
  const [logEntityFilter, setLogEntityFilter] = useState('all');
  const [logActorFilter, setLogActorFilter] = useState('all');
  const [logDateFrom, setLogDateFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [logDateTo, setLogDateTo] = useState('');
  const [logView, setLogView] = useState<'table' | 'report'>('table');
  const [logPage, setLogPage] = useState(1);
  const LOG_PAGE_SIZE = 20;

  const [projectForm, setProjectForm] = useState<ProjectDetails>({
      isActive: false,
      category: '',
      tariff: { amount: 0, currency: 'IRR' },
      startDate: '',
      endDate: '',
      teamMemberIds: [],
      teamMembers: [],
      projectFiles: [],
      payments: [],
      invoices: [],
      milestones: [],
      risks: [],
      progress: 0,
      statusNote: '',
      parties: [],
      definitions: [],
  });

  const [newParty, setNewParty] = useState<{ name: string; type: ProjectPartyType; company: string; phone: string; profitSharePercent: number; notes: string }>({
      name: '', type: 'client', company: '', phone: '', profitSharePercent: 0, notes: ''
  });

  const [newDefItem, setNewDefItem] = useState<{ category: string; label: string; value: string }>({
      category: '', label: '', value: ''
  });
  const [defUploading, setDefUploading] = useState(false);
  const [pendingDefFile, setPendingDefFile] = useState<{ url: string; name: string } | null>(null);
  const defFileInputRef = useRef<HTMLInputElement>(null);

  // Customer upload window
  const [showUploadWindowForm, setShowUploadWindowForm] = useState(false);
  const [uploadWindowPrompt, setUploadWindowPrompt] = useState('');
  const [uploadWindowDuration, setUploadWindowDuration] = useState(48);
  
  const [newPayment, setNewPayment] = useState<Partial<Payment>>({
      amount: 0,
      currency: 'IRR',
      type: 'deposit',
      note: ''
  });

  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [newRiskTitle, setNewRiskTitle] = useState('');
  const [newRiskImpact, setNewRiskImpact] = useState<'Low'|'Medium'|'High'>('Low');

  const [newTeamMemberId, setNewTeamMemberId] = useState('');
  const [newTeamMemberRole, setNewTeamMemberRole] = useState('');
  const [newTeamMemberResp, setNewTeamMemberResp] = useState('');

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [newProjectData, setNewProjectData] = useState({
      title: '',
      category: '',
      serviceId: '',
      customerName: '',
      customerType: 'client' as ProjectPartyType,
      phoneNumber: '',
      startDate: '',
      endDate: '',
      tariffAmount: '',
      tariffCurrency: 'IRR' as Currency,
      priority: 'Medium' as 'Low' | 'Medium' | 'High'
  });

  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [customForms, setCustomForms] = useState<CustomForm[]>([]);
  const [selectedCustomForm, setSelectedCustomForm] = useState<CustomForm | null>(null);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  const userKPIs = kpis.filter(k => (k.assignedUserId === currentUser.id) || (k.assignedRole && currentUser.roles.includes(k.assignedRole)));

  const t = {
      fa: {
          overview: 'کارتابل',
          tasks: 'امور روزانه',
          meetings: 'تقویم جلسات',
          messages: 'مکاتبات',
          projects: 'مدیریت پروژه‌ها',
          financial: 'گزارشات مالی',
          expenses: 'هزینه‌ها و درآمدها',
          customers: 'بانک مشتریان',
          services: 'خدمات و تعرفه‌ها',
          personnel: 'کاربران و پرسنل',
          settings: 'تنظیمات و فرم‌ساز',
          logs: 'ثبت وقایع (Logs)',
          reports: 'گزارش عملکرد',
          kpi: 'شاخص‌ها (KPI)',
          forms: 'فرم‌ها و استانداردها',
          sales: 'مدیریت فروش',
          staff_reports: 'گزارش‌های پرسنلی',
          logout: 'خروج از سیستم',
          myTasks: 'کارهای من',
          allRequests: 'کل درخواست‌های باز',
          activeProjects: 'پروژه‌های فعال',
          projectHistory: 'بایگانی پروژه‌ها',
          newMessages: 'پیام‌های جدید',
          pendingTasks: 'لیست وظایف امروز شما',
          doTask: 'انجام وظیفه',
          viewAll: 'مشاهده همه',
          searchPlaceholder: 'جستجوی پیشرفته (نام، شماره، توضیحات...)',
          myCartable: 'کارتابل من',
          allCompany: 'کل درخواست‌های شرکت',
          history: 'تاریخچه (تکمیل شده)',
          allStatuses: 'همه وضعیت‌ها',
          row: 'ردیف',
          code: 'کد / متقاضی',
          service: 'سرویس',
          status: 'وضعیت',
          action: 'عملیات',
          check: 'بررسی',
          notFound: 'موردی یافت نشد.',
          bulkSelected: 'مورد انتخاب شده',
          bulkStatusPh: 'تغییر وضعیت گروهی',
          bulkAssignPh: 'ارجاع گروهی به',
          bulkClear: 'لغو انتخاب',
          selectAll: 'انتخاب همه',
          newProject: 'تعریف پروژه جدید',
          projectTitle: 'عنوان پروژه',
          relatedService: 'سرویس مرتبط',
          customer: 'مشتری',
          phone: 'تلفن',
          startDate: 'تاریخ شروع',
          endDate: 'تاریخ پایان',
          contractAmount: 'مبلغ قرارداد',
          priority: 'اولویت',
          cancel: 'انصراف',
          create: 'ایجاد پروژه',
          successProject: 'پروژه با موفقیت ایجاد شد!',
          copyCode: 'کد رهگیری کپی شد',
          understand: 'متوجه شدم، بستن',
          manager: 'مدیر مستقیم',
          save: 'ذخیره',
          edit: 'ویرایش',
          delete: 'حذف',
          restore: 'بازیابی',
          auditLogs: 'لاگ وقایع سیستم (Audit Logs)',
          time: 'زمان',
          user: 'کاربر',
          operation: 'عملیات',
          entity: 'موجودیت',
          details: 'جزئیات',
          revenueTotal: 'درآمد کل',
          revenueByService: 'درآمد به تفکیک خدمات',
          rial: 'ریال ایران',
          usd: 'دلار',
          omr: 'ریال عمان',
          noLogs: 'هیچ لاگی ثبت نشده است.',
          progress: 'پیشرفت',
          view: 'مشاهده',
          projectDashboard: 'داشبورد مدیریت پروژه‌ها',
          ticketInfo: 'اطلاعات درخواست',
          projectMgmt: 'مدیریت پروژه و تیم',
          customerInfo: 'مشخصات کامل متقاضی',
          fullName: 'نام کامل',
          company: 'نام شرکت / برند',
          mobile: 'موبایل',
          whatsapp: 'واتس‌اپ',
          location: 'موقعیت مکانی',
          bizType: 'نوع کسب‌وکار',
          description: 'شرح درخواست',
          files: 'فایل‌های اولیه',
          expert: 'کارشناس مسئول',
          assign: 'ثبت و ارجاع',
          notAssigned: 'تعیین نشده',
          saveEdit: 'ذخیره تغییرات',
          cancelEdit: 'لغو',
          editMode: 'حالت ویرایش',
          timeProgress: 'پیشرفت زمانی',
          physProgress: 'پیشرفت فیزیکی',
          team: 'تیم پروژه',
          financialDash: 'داشبورد مالی پروژه',
          invoiced: 'فاکتور شده',
          paid: 'دریافتی (وصول شده)',
          balance: 'مانده حساب',
          issueInvoice: 'صدور فاکتور',
          recordPayment: 'ثبت دریافتی',
          teamRoles: 'تیم پروژه و مسئولیت‌ها',
          addMember: 'افزودن عضو',
          role: 'سمت',
          responsibility: 'مسئولیت',
          milestones: 'فازبندی پروژه (Milestones)',
          riskMgmt: 'مدیریت ریسک',
          riskTitle: 'عنوان ریسک',
          impact: 'اثر',
          low: 'کم',
          medium: 'متوسط',
          high: 'زیاد',
          projectDocs: 'مستندات و فایل‌های پروژه',
          uploadHint: 'برای آپلود فایل کلیک کنید (فقط PDF و عکس)',
          saveProject: 'ذخیره و بروزرسانی وضعیت پروژه',
          events: 'رویدادها و گفتگوها',
          publicReport: 'گزارش به مشتری',
          internalNote: 'یادداشت داخلی (محرمانه)',
          writeMsg: 'نوشتن پیام...',
          send: 'ارسال',
          mention: 'منشن کردن همکار (@)',
          subServices: 'زیرمجموعه خدمات انتخابی',
          kpiWidget: 'شاخص‌های عملکرد من (KPIs)',
          formsTitle: 'بانک فرم‌ها و استانداردها',
          selectForm: 'انتخاب فرم',
          prev: 'قبلی',
          next: 'بعدی',
          quickReport: 'گزارش خطی وقایع امروز',
          quickReportHint: 'شرح فعالیت خود را بنویسید و اینتر بزنید...',
          submitQuick: 'ثبت نهایی گزارش امروز',
          formLinkTitle: 'لینک اشتراک‌گذاری فرم درخواست',
          formLinkDesc: 'این لینک را برای مشتریان ارسال کنید تا فرم درخواست خدمات را تکمیل کنند. درخواست‌ها مستقیم وارد سامانه می‌شوند.',
          copyLink: 'کپی لینک',
          linkCopied: 'لینک کپی شد',
          news_mgmt: 'مدیریت اخبار',
          seo: 'سئو و فاوآیکون',
          seoTitle: 'عنوان صفحه (SEO Title)',
          seoDesc: 'توضیحات متا (Meta Description)',
          seoKeywords: 'کلمات کلیدی',
          ogTitle: 'عنوان اشتراک (OG Title)',
          ogDesc: 'توضیحات اشتراک (OG Description)',
          ogImage: 'تصویر اشتراک (OG Image URL)',
          favicon: 'فاوآیکون سایت',
          saveSeo: 'ذخیره تنظیمات سئو',
          customer_accounts: 'پنل مشتریان',
          processes: 'مایند مپ',
          projectCategory: 'سرفصل پروژه',
          projectCategoryPh: 'مثال: صادرات، بازرگانی، فناوری...',
          partiesTitle: 'طرفین و شرکاء پروژه',
          partyName: 'نام طرف',
          partyType: 'نوع طرف',
          partyCompany: 'شرکت/سازمان',
          partyPhone: 'تلفن',
          partyShare: 'سهم (%)',
          partyNotes: 'یادداشت',
          addParty: 'افزودن طرف',
          partyTypeClient: 'کارفرما / مشتری',
          partyTypePartner: 'همکار / شریک',
          partyTypeSupplier: 'تامین‌کننده',
          partyTypeInvestor: 'سرمایه‌گذار',
          partyTypeOther: 'سایر',
          definitionsTitle: 'جدول تعریفات پروژه',
          defCategory: 'دسته‌بندی',
          defLabel: 'عنوان / موضوع',
          defValue: 'مقدار / توضیح',
          defFile: 'فایل ضمیمه',
          addDefItem: 'افزودن ردیف',
          defCategoryPh: 'مثال: مدارک قراردادی',
          defLabelPh: 'مثال: شماره قرارداد',
          defValuePh: 'مثال: ۱۴۰۳/۱۲۳',
          totalShare: 'جمع سهام',
          noParties: 'هنوز طرفی تعریف نشده است.',
          noDefinitions: 'هنوز ردیفی اضافه نشده است.',
          uploadingDef: 'در حال آپلود...',
          attachFile: 'پیوست فایل',
          customerTypeLabel: 'نوع ارتباط',
      },
      en: {
          overview: 'Cartable',
          tasks: 'Daily Tasks',
          meetings: 'Meeting Calendar',
          messages: 'Messages',
          projects: 'Project Management',
          financial: 'Financial Reports',
          expenses: 'Expenses & Spending',
          customers: 'Customer Bank',
          services: 'Services & Tariffs',
          personnel: 'Staff & Users',
          settings: 'Settings & Form Builder',
          logs: 'Audit Logs',
          reports: 'Performance Reports',
          kpi: 'KPIs',
          forms: 'Forms & Standards',
          sales: 'Sales Dashboard',
          staff_reports: 'Staff Reports',
          logout: 'Logout',
          myTasks: 'My Tasks',
          allRequests: 'All Open Requests',
          activeProjects: 'Active Projects',
          projectHistory: 'Archived Projects',
          newMessages: 'New Messages',
          pendingTasks: 'Your Pending Tasks',
          doTask: 'Do Task',
          viewAll: 'View All',
          searchPlaceholder: 'Search requests (Name, Phone, ID...)',
          myCartable: 'My Workspace',
          allCompany: 'All Company Requests',
          history: 'History (Archived)',
          allStatuses: 'All Statuses',
          row: '#',
          code: 'ID / Applicant',
          service: 'Service',
          status: 'Status',
          action: 'Action',
          check: 'Review',
          notFound: 'No records found.',
          bulkSelected: 'selected',
          bulkStatusPh: 'Bulk change status',
          bulkAssignPh: 'Bulk assign to',
          bulkClear: 'Clear selection',
          selectAll: 'Select all',
          newProject: 'Create New Project',
          projectTitle: 'Project Title',
          relatedService: 'Related Service',
          customer: 'Customer',
          phone: 'Phone',
          startDate: 'Start Date',
          endDate: 'End Date',
          contractAmount: 'Contract Amount',
          priority: 'Priority',
          cancel: 'Cancel',
          create: 'Create',
          successProject: 'Project Created Successfully!',
          copyCode: 'Tracking Code Copied',
          understand: 'Close',
          manager: 'Direct Manager',
          save: 'Save',
          edit: 'Edit',
          delete: 'Delete',
          restore: 'Restore',
          auditLogs: 'System Audit Logs',
          time: 'Time',
          user: 'User',
          operation: 'Operation',
          entity: 'Entity',
          details: 'Details',
          revenueTotal: 'Total Revenue',
          revenueByService: 'Revenue by Service',
          rial: 'IRR',
          usd: 'USD',
          omr: 'OMR',
          noLogs: 'No logs recorded.',
          progress: 'Progress',
          view: 'View',
          projectDashboard: 'Projects Dashboard',
          ticketInfo: 'Request Info',
          projectMgmt: 'Project & Team Mgmt',
          customerInfo: 'Applicant Details',
          fullName: 'Full Name',
          company: 'Company / Brand',
          mobile: 'Mobile',
          whatsapp: 'WhatsApp',
          location: 'Location',
          bizType: 'Business Type',
          description: 'Description',
          files: 'Initial Files',
          expert: 'Assigned Expert',
          assign: 'Assign',
          notAssigned: 'Unassigned',
          saveEdit: 'Save Changes',
          cancelEdit: 'Cancel',
          editMode: 'Edit Mode',
          timeProgress: 'Time Progress',
          physProgress: 'Physical Progress',
          team: 'Project Team',
          financialDash: 'Financial Dashboard',
          invoiced: 'Invoiced',
          paid: 'Received',
          balance: 'Balance',
          issueInvoice: 'Issue Invoice',
          recordPayment: 'Record Payment',
          teamRoles: 'Team & Responsibilities',
          addMember: 'Add Member',
          role: 'Role',
          responsibility: 'Responsibility',
          milestones: 'Project Milestones',
          riskMgmt: 'Risk Management',
          riskTitle: 'Risk Title',
          impact: 'Impact',
          low: 'Low',
          medium: 'Medium',
          high: 'High',
          projectDocs: 'Project Documents',
          uploadHint: 'Click to upload files (PDF & Images)',
          saveProject: 'Save & Update Project',
          events: 'Events & Chat',
          publicReport: 'Customer Report',
          internalNote: 'Internal Note',
          writeMsg: 'Write a message...',
          send: 'Send',
          mention: 'Mention colleague (@)',
          subServices: 'Selected Sub-services',
          kpiWidget: 'My KPIs',
          formsTitle: 'Forms & Standards Bank',
          selectForm: 'Select Form',
          prev: 'Previous',
          next: 'Next',
          quickReport: 'Daily Linear Report (Quick Add)',
          quickReportHint: 'Describe your activity and press enter...',
          submitQuick: 'Submit Today\'s Report',
          formLinkTitle: 'Shareable Form Link',
          formLinkDesc: 'Send this link to customers so they can fill out the service request form. Submissions go directly into the system.',
          copyLink: 'Copy Link',
          linkCopied: 'Link Copied',
          news_mgmt: 'News Management',
          seo: 'SEO & Favicon',
          seoTitle: 'SEO Title',
          seoDesc: 'Meta Description',
          seoKeywords: 'Keywords',
          ogTitle: 'OG Title',
          ogDesc: 'OG Description',
          ogImage: 'OG Image URL',
          favicon: 'Site Favicon',
          saveSeo: 'Save SEO Settings',
          customer_accounts: 'Customer Accounts',
          processes: 'Mind Map',
          projectCategory: 'Project Category',
          projectCategoryPh: 'e.g. Export, Trade, Technology...',
          partiesTitle: 'Project Parties & Partners',
          partyName: 'Party Name',
          partyType: 'Type',
          partyCompany: 'Company / Org',
          partyPhone: 'Phone',
          partyShare: 'Share (%)',
          partyNotes: 'Notes',
          addParty: 'Add Party',
          partyTypeClient: 'Client / Employer',
          partyTypePartner: 'Partner / Collaborator',
          partyTypeSupplier: 'Supplier',
          partyTypeInvestor: 'Investor',
          partyTypeOther: 'Other',
          definitionsTitle: 'Project Definitions Table',
          defCategory: 'Category',
          defLabel: 'Label / Topic',
          defValue: 'Value / Description',
          defFile: 'Attachment',
          addDefItem: 'Add Row',
          defCategoryPh: 'e.g. Contract Docs',
          defLabelPh: 'e.g. Contract No.',
          defValuePh: 'e.g. CTR-2024-001',
          totalShare: 'Total Share',
          noParties: 'No parties defined yet.',
          noDefinitions: 'No rows added yet.',
          uploadingDef: 'Uploading...',
          attachFile: 'Attach File',
          customerTypeLabel: 'Relationship Type',
      }
  }[lang];

  const [showJobDescModal, setShowJobDescModal] = useState(false);

  const selectedTicket = selectedTicketId ? tickets.find(t => t.id === selectedTicketId) || null : null;
  const directManager = currentUser?.reportsTo ? personnel.find(p => p.id === currentUser.reportsTo) : null;
  const unreadMessagesCount = messages.filter(m => m.recipientIds.includes(currentUser.id) && !m.readBy.includes(currentUser.id)).length;
  const myPendingTasks = tasks.filter(t => t.assigneeIds.includes(currentUser.id) && !t.isCompleted);
  const pendingTasksCount = myPendingTasks.length;

  useEffect(() => {
    if (selectedTicket && commentsEndRef.current) {
        commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.timeline?.length]);

  useEffect(() => {
      setCurrentPage(1);
  }, [filterMode, statusFilter, globalSearch, showFlaggedOnly, labelFilter]);

  useEffect(() => {
      setIsEditingTicket(false);
      setEditingTicketData({});
      setActiveModalTab('info');
      setNewComment('');
      setShowMentionList(false);
      setCommentVisibility('public');
      if (selectedTicket) {
          setTempAssignedTo(selectedTicket.assignedTo || '');
          if (selectedTicket.projectData) {
              setProjectForm(selectedTicket.projectData);
              setNewPayment({ amount: 0, currency: selectedTicket.projectData.tariff?.currency || 'IRR', type: 'deposit', note: '' });
          } else {
              setProjectForm({ isActive: false, category: '', tariff: { amount: 0, currency: 'IRR' }, startDate: '', endDate: '', teamMemberIds: [], teamMembers: [], projectFiles: [], payments: [], invoices: [], milestones: [], risks: [], progress: 0, statusNote: '', parties: [], definitions: [] });
          }
      }
  }, [selectedTicketId, selectedTicket]);

  useEffect(() => {
      if (isMaster && activeTab === 'logs') {
          const unsubLogs = subscribeToSystemLogs(setSystemLogs);
          return () => unsubLogs();
      }
  }, [isMaster, activeTab]);

  useEffect(() => {
      if (activeTab === 'forms') {
          const unsubForms = subscribeToCustomForms((forms) => {
              const allowedForms = forms.filter(f => {
                if (isMaster) return true;
                const noRestriction = (f.allowedRoles?.length ?? 0) === 0 && (f.allowedPersonnelIds?.length ?? 0) === 0;
                if (noRestriction) return true;
                const roleMatch = (f.allowedRoles?.length ?? 0) > 0 && currentUser.roles.some(r => f.allowedRoles.includes(r));
                const personnelMatch = (f.allowedPersonnelIds?.length ?? 0) > 0 && f.allowedPersonnelIds!.includes(currentUser.id);
                return roleMatch || personnelMatch;
              });
              setCustomForms(allowedForms);
          });
          return () => unsubForms();
      }
  }, [activeTab, currentUser]);

  const getServiceTitle = (id: string) => {
      const s = services.find(s => s.id === id);
      if (!s) return id;
      return lang === 'en' && s.titleEn ? s.titleEn : s.title;
  };

  const getAssigneeName = (id?: string) => {
      if (!id) return null;
      return personnel.find(p => p.id === id)?.fullName || null;
  };

  const getSubServiceTitle = (serviceId: string, subId: string) => {
      const s = services.find(s => s.id === serviceId);
      const sub = s?.subServices?.find(sub => sub.id === subId);
      if (!sub) return subId;
      return lang === 'en' && sub.titleEn ? sub.titleEn : sub.title;
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch(status) {
      case TicketStatus.SUBMITTED: return 'bg-blue-50 text-blue-700';
      case TicketStatus.PROCESSING: return 'bg-purple-50 text-purple-700';
      case TicketStatus.IN_PROGRESS: return 'bg-amber-50 text-amber-700';
      case TicketStatus.COMPLETED: return 'bg-emerald-50 text-emerald-700';
      case TicketStatus.CANCELLED: return 'bg-gray-100 text-gray-500 line-through';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  const getPriorityBadge = (priority: string) => {
      switch(priority) {
          case 'High': return { bg: 'bg-red-100', text: 'text-red-700', label: lang === 'fa' ? 'خیلی فوری' : 'High' };
          case 'Medium': return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: lang === 'fa' ? 'فوری' : 'Medium' };
          case 'Low': return { bg: 'bg-green-100', text: 'text-green-700', label: lang === 'fa' ? 'عادی' : 'Low' };
          default: return { bg: 'bg-gray-100', text: 'text-gray-600', label: '-' };
      }
  };

  const myTasksCount = tickets.filter(t => t.assignedTo === currentUser.id || t.projectData?.teamMemberIds?.includes(currentUser.id)).filter(t => t.status !== 'تکمیل شده' && t.status !== 'لغو شده').length;

  const filteredTickets = [...tickets].filter(t => {
      const isArchived = t.status === TicketStatus.COMPLETED || t.status === TicketStatus.CANCELLED;
      const mine = t.assignedTo === currentUser.id || t.projectData?.teamMemberIds?.includes(currentUser.id);

      // Non-privileged users only ever see their own cases (applies in every mode)
      if (!canViewAllTickets && !mine) return false;

      if (showFlaggedOnly) {
          // The flag view shows EVERY flagged case (active or archived, any status) so nothing gets hidden
          if (!isFlaggedOf(t)) return false;
      } else {
          if (filterMode === 'history') {
              if (!isArchived) return false;
          } else {
              if (isArchived) return false;
              if (filterMode === 'my' && !mine) return false;
          }
          if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      }

      if (labelFilter && !(t.labelIds || []).includes(labelFilter)) return false;
      if (globalSearch.trim()) {
          const term = globalSearch.toLowerCase();
          const matchesId = (t.id || '').toLowerCase().includes(term);
          const matchesCustomer = (t.customerName || '').toLowerCase().includes(term);
          const matchesCompany = (t.companyName || '').toLowerCase().includes(term); 
          const matchesPhone = (t.phoneNumber || '').includes(term);
          const matchesService = (getServiceTitle(t.serviceId) || '').toLowerCase().includes(term);
          const matchesAssignee = (getAssigneeName(t.assignedTo) || '').toLowerCase().includes(term);
          const matchesDesc = (t.description || '').toLowerCase().includes(term);
          if (!matchesId && !matchesCustomer && !matchesCompany && !matchesPhone && !matchesService && !matchesAssignee && !matchesDesc) return false;
      }
      return true;
    }).sort((a, b) => {
      const af = isFlaggedOf(a), bf = isFlaggedOf(b);
      if (af && !bf) return -1;
      if (!af && bf) return 1;
      if (a.priority === 'High' && b.priority !== 'High') return -1;
      if (a.priority !== 'High' && b.priority === 'High') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // --- Project Management Logic ---
  const allProjectTickets = tickets.filter(t => t.projectData?.isActive === true).filter(t => {
      if (canViewAllTickets) return true;
      return t.assignedTo === currentUser.id || t.projectData?.teamMemberIds?.includes(currentUser.id);
  });

  const activeProjectsList = allProjectTickets.filter(t => t.status !== TicketStatus.COMPLETED && t.status !== TicketStatus.CANCELLED);
  const historyProjectsList = allProjectTickets.filter(t => t.status === TicketStatus.COMPLETED || t.status === TicketStatus.CANCELLED);
  const currentProjectDisplayList = projectSubTab === 'active' ? activeProjectsList : historyProjectsList;

  const processMentions = async (text: string, sourceTitle: string, sourceId: string) => {
      const mentionRegex = /@([a-zA-Z0-9_]+)/g;
      const matches = text.match(mentionRegex);
      if (!matches) return;
      const uniqueMentions = [...new Set(matches)];
      for (const mention of uniqueMentions) {
          const username = mention.substring(1);
          const targetUser = personnel.find(p => p.username === username);
          if (targetUser && targetUser.id !== currentUser.id) {
              const msg: InternalMessage = { id: `n-${Date.now()}-${Math.random()}`, senderId: currentUser.id, senderName: 'System', recipientIds: [targetUser.id], recipientNames: [targetUser.fullName], subject: `Mentioned in ${sourceTitle}`, body: `${currentUser.fullName} mentioned you:\n\n"${text}"\n\nID: ${sourceId}`, createdAt: new Date().toISOString(), readBy: [] };
              await sendInternalMessage(msg);
          }
      }
  };

  const handleAddComment = async () => {
    if (!selectedTicket || (!newComment.trim() && commentFiles.length === 0)) return;
    if (commentFiles.some(f => f.status === 'uploading')) { alert(lang === 'fa' ? 'صبر کنید تا آپلود تمام شود...' : 'Wait for upload...'); return; }
    await processMentions(newComment, `Ticket ${selectedTicket.id}`, selectedTicket.id);
    onUpdateTicket(selectedTicket.id, {}, currentUser.fullName, newComment || '📎 فایل ضمیمه', commentVisibility, commentFiles.length > 0 ? commentFiles : undefined);
    logSystemAction('UPDATE', 'Ticket', `Comment added to ticket ${selectedTicket.id}`, currentUser.fullName, selectedTicket.id);
    setNewComment('');
    setCommentFiles([]);
    setShowMentionList(false);
    setCommentVisibility('public');
  };

  const handleCommentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach(file => {
      if (file.size > 50 * 1024 * 1024) { alert(`${file.name}: حداکثر ۵۰ مگابایت`); return; }
      const placeholder: AttachedFile = { name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 };
      setCommentFiles(prev => [...prev, placeholder]);
      uploadFileWithProgress(
        file,
        (progress) => setCommentFiles(prev => prev.map(f => f.name === file.name && f.status === 'uploading' ? { ...f, progress } : f)),
        (url) => setCommentFiles(prev => prev.map(f => f.name === file.name && f.status === 'uploading' ? { ...f, content: url, status: 'success', progress: 100 } : f)),
        (err) => setCommentFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMsg: err.message } : f)),
        'uploads'
      );
    });
    e.target.value = '';
  };

  const handleQuickReportAdd = () => {
      if (!quickReportText.trim()) return;
      setQuickReportItems([...quickReportItems, quickReportText.trim()]);
      setQuickReportText('');
  };

  const handleSubmitQuickReport = async () => {
      if (quickReportItems.length === 0) return;
      setIsSavingQuickReport(true);
      const report: PerformanceReport = {
          id: `rep-${Date.now()}`,
          userId: currentUser.id,
          userName: currentUser.fullName,
          type: 'daily',
          date: new Date().toISOString().split('T')[0],
          content: 'گزارش ثبت شده از پنل داشبورد',
          completedTasks: quickReportItems,
          status: 'submitted',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };
      await saveReport(report);
      setQuickReportItems([]);
      setIsSavingQuickReport(false);
      alert(lang === 'fa' ? 'گزارش روزانه با موفقیت ثبت شد.' : 'Daily report submitted.');
  };

  const handleOpenUploadWindow = () => {
    if (!selectedTicket || !uploadWindowPrompt.trim()) return;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + uploadWindowDuration * 3_600_000).toISOString();
    onUpdateTicket(selectedTicket.id, {
      customerUploadWindow: { isOpen: true, openedBy: currentUser.fullName, openedAt: now.toISOString(), expiresAt, prompt: uploadWindowPrompt.trim() },
      timeline: [...(selectedTicket.timeline || []), { type: 'update', title: lang === 'fa' ? 'پنجره آپلود مشتری باز شد' : 'Customer upload window opened', description: uploadWindowPrompt.trim(), actorName: currentUser.fullName, timestamp: now.toISOString(), visibility: 'internal' }],
    }, currentUser.fullName);
    setShowUploadWindowForm(false);
    setUploadWindowPrompt('');
  };

  const handleCloseUploadWindow = () => {
    if (!selectedTicket) return;
    onUpdateTicket(selectedTicket.id, {
      customerUploadWindow: { ...(selectedTicket.customerUploadWindow as any), isOpen: false },
    }, currentUser.fullName);
  };

  const handleInsertMention = (username: string) => { setNewComment(prev => prev + `@${username} `); setShowMentionList(false); };
  const handleStartEdit = () => { if (!selectedTicket) return; setEditingTicketData({ customerName: selectedTicket.customerName, companyName: selectedTicket.companyName, phoneNumber: selectedTicket.phoneNumber, whatsappNumber: selectedTicket.whatsappNumber, location: selectedTicket.location, businessType: selectedTicket.businessType, description: selectedTicket.description, serviceId: selectedTicket.serviceId }); setIsEditingTicket(true); };
  const handleSaveEdit = () => { if (!selectedTicket) return; onUpdateTicket(selectedTicket.id, editingTicketData, currentUser.fullName, 'Edit Basic Info'); logSystemAction('UPDATE', 'Ticket', `Edited ticket ${selectedTicket.id}`, currentUser.fullName, selectedTicket.id); setIsEditingTicket(false); };
  const handleDelete = async (id: string) => { if (!id) return; if (window.confirm(lang === 'fa' ? 'آیا از حذف اطمینان دارید؟' : 'Are you sure you want to delete?')) { await onDeleteTicket(id); if (selectedTicketId === id) setSelectedTicketId(null); } };
  const handleUpdateTicketStatus = (status: TicketStatus) => { if (!selectedTicket) return; onUpdateTicket(selectedTicket.id, { status }, currentUser.fullName); logSystemAction('UPDATE', 'Ticket', `Status changed to ${status}`, currentUser.fullName, selectedTicket.id); };
  const handleDeleteTimelineEntry = (index: number) => { if (!selectedTicket || !isMaster) return; if (window.confirm('Delete entry?')) { const newTimeline = [...(selectedTicket.timeline || [])]; newTimeline.splice(index, 1); onUpdateTicket(selectedTicket.id, { timeline: newTimeline }, currentUser.fullName); } };
  const handleEditTimelineEntry = (index: number, currentDesc: string) => { if (!selectedTicket || !isMaster) return; const newDesc = window.prompt('Edit:', currentDesc); if (newDesc !== null) { const newTimeline = [...(selectedTicket.timeline || [])]; newTimeline[index] = { ...newTimeline[index], description: newDesc }; onUpdateTicket(selectedTicket.id, { timeline: newTimeline }, currentUser.fullName); } };
  // Send a WhatsApp notification to a staff member when a case is assigned/referred to them
  const notifyAssignee = async (targetUserId: string, ticketId: string, customerName: string) => {
    const nc = config.notificationConfig;
    if (!nc?.enabled || !nc.onNewTicket) return;
    const assignee = personnel.find(p => p.id === targetUserId);
    if (!assignee) return;
    const msg = renderTemplate(nc.ticketTemplate, {
      recipientName: assignee.fullName,
      ticketId,
      customerName: customerName || '',
      senderName: currentUser.fullName,
      status: '',
    });
    const phone = nc.personnelPhones?.[targetUserId];
    if (phone) {
      const result = await sendWhatsAppNotification(phone, msg, nc, nc.personnelApiKeys?.[targetUserId]);
      await saveNotificationLog(buildLog('new_ticket', targetUserId, assignee.fullName, phone, msg, result, ticketId));
    }
    // Master copy — sent even if the assignee has NO phone configured.
    await sendMasterCopy({ config: nc, personnel, message: msg, originalRecipientId: targetUserId, originalRecipientName: assignee.fullName, logType: 'new_ticket', ticketId, saveLog: saveNotificationLog });
  };

  const handleAssignTicket = async () => { if (!selectedTicket) return; if (tempAssignedTo === selectedTicket.assignedTo) return; const targetUser = personnel.find(p => p.id === tempAssignedTo); const actionDesc = targetUser ? `Assigned to ${targetUser.fullName}` : 'Unassigned'; onUpdateTicket(selectedTicket.id, { assignedTo: tempAssignedTo }, currentUser.fullName, actionDesc); logSystemAction('UPDATE', 'Ticket', `Assigned ticket ${selectedTicket.id}`, currentUser.fullName, selectedTicket.id); if (targetUser && targetUser.id !== currentUser.id) { const msg: InternalMessage = { id: `notify-${Date.now()}`, senderId: currentUser.id, senderName: 'System', recipientIds: [targetUser.id], recipientNames: [targetUser.fullName], subject: `Assignment: ${selectedTicket.customerName}`, body: `Ticket #${selectedTicket.id} has been assigned to you.`, createdAt: new Date().toISOString(), readBy: [] }; await sendInternalMessage(msg); await notifyAssignee(targetUser.id, selectedTicket.id, selectedTicket.customerName); } alert(lang === 'fa' ? 'ارجاع انجام شد.' : 'Assigned successfully.'); };
  // ── Bulk action handlers ──
  const toggleTicketSelection = (id: string) => setSelectedTicketIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearSelection = () => { setSelectedTicketIds(new Set()); setBulkStatusValue(''); setBulkAssignValue(''); };
  const handleBulkStatusChange = (status: TicketStatus) => {
    const ids = Array.from(selectedTicketIds);
    if (ids.length === 0) return;
    if (!window.confirm(lang === 'fa' ? `تغییر وضعیت ${ids.length} پرونده به «${status}»؟` : `Change status of ${ids.length} request(s) to "${status}"?`)) { setBulkStatusValue(''); return; }
    ids.forEach(id => onUpdateTicket(id, { status }, currentUser.fullName, `Bulk status → ${status}`));
    logSystemAction('UPDATE', 'Ticket', `Bulk status change (${ids.length}) → ${status}`, currentUser.fullName);
    clearSelection();
  };
  const handleBulkAssign = async (assigneeId: string) => {
    if (!canAssign) return;
    const ids = Array.from(selectedTicketIds);
    if (ids.length === 0) return;
    const targetUser = personnel.find(p => p.id === assigneeId);
    const targetLabel = targetUser ? targetUser.fullName : (lang === 'fa' ? 'تعیین نشده' : 'Unassigned');
    if (!window.confirm(lang === 'fa' ? `ارجاع ${ids.length} پرونده به «${targetLabel}»؟` : `Assign ${ids.length} request(s) to "${targetLabel}"?`)) { setBulkAssignValue(''); return; }
    const actionDesc = targetUser ? `Assigned to ${targetUser.fullName}` : 'Unassigned';
    ids.forEach(id => onUpdateTicket(id, { assignedTo: assigneeId }, currentUser.fullName, actionDesc));
    logSystemAction('UPDATE', 'Ticket', `Bulk assign (${ids.length}) → ${targetLabel}`, currentUser.fullName);
    if (targetUser && targetUser.id !== currentUser.id) {
      const msg: InternalMessage = { id: `notify-${Date.now()}`, senderId: currentUser.id, senderName: 'System', recipientIds: [targetUser.id], recipientNames: [targetUser.fullName], subject: lang === 'fa' ? `ارجاع گروهی (${ids.length} پرونده)` : `Bulk assignment (${ids.length})`, body: lang === 'fa' ? `${ids.length} پرونده به شما ارجاع داده شد.` : `${ids.length} request(s) have been assigned to you.`, createdAt: new Date().toISOString(), readBy: [] };
      await sendInternalMessage(msg);
      // One WhatsApp notification summarizing the bulk assignment
      await notifyAssignee(targetUser.id, lang === 'fa' ? `${ids.length} پرونده` : `${ids.length} cases`, '');
    }
    clearSelection();
    alert(lang === 'fa' ? 'ارجاع گروهی انجام شد.' : 'Bulk assignment done.');
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const newTicketId = `PROJ-${Math.floor(10000 + Math.random() * 90000)}`;
    const displayName = newProjectData.customerName.trim() || (lang === 'fa' ? 'پروژه داخلی' : 'Internal Project');
    const parties: ProjectParty[] = newProjectData.customerName.trim()
      ? [{ id: `party-${Date.now()}`, name: newProjectData.customerName.trim(), type: newProjectData.customerType, phone: newProjectData.phoneNumber.trim() || undefined, profitSharePercent: 0, addedAt: new Date().toISOString() }]
      : [];
    const newTicket: Ticket = {
      id: newTicketId,
      customerName: displayName,
      phoneNumber: newProjectData.phoneNumber.trim() || '-',
      whatsappNumber: newProjectData.phoneNumber.trim() || '-',
      location: 'N/A',
      serviceId: newProjectData.serviceId || 'internal',
      description: `Project: ${newProjectData.title}`,
      status: TicketStatus.IN_PROGRESS,
      createdAt: new Date().toISOString(),
      priority: newProjectData.priority,
      files: [],
      timeline: [{ type: 'creation', title: 'Project Created', description: `Project "${newProjectData.title}" created by ${currentUser.fullName}.`, actorName: currentUser.fullName, timestamp: new Date().toISOString(), visibility: 'public' }],
      projectData: { isActive: true, category: newProjectData.category.trim() || undefined, tariff: { amount: parseInt(newProjectData.tariffAmount.replace(/,/g, '')) || 0, currency: newProjectData.tariffCurrency }, startDate: newProjectData.startDate, endDate: newProjectData.endDate, teamMemberIds: [currentUser.id], teamMembers: [{ userId: currentUser.id, role: 'Project Manager', responsibility: 'Owner', joinedAt: new Date().toISOString() }], projectFiles: [], payments: [], invoices: [], milestones: [], risks: [], progress: 0, statusNote: 'Project Initialized.', parties, definitions: [] },
      assignedTo: currentUser.id,
    };
    try { await onCreateTicket(newTicket); setCreatedProjectId(newTicketId); } catch { alert('Error creating project'); }
  };
  const handleProjectModalClose = () => { setShowNewProjectModal(false); setCreatedProjectId(null); setNewProjectData({ title: '', category: '', serviceId: '', customerName: '', customerType: 'client', phoneNumber: '', startDate: '', endDate: '', tariffAmount: '', tariffCurrency: 'IRR', priority: 'Medium' }); };
  const handleProjectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (!e.target.files || e.target.files.length === 0) return; const files: File[] = Array.from(e.target.files); for (const file of files) { if (file.size > 5 * 1024 * 1024) { alert('File too large > 5MB'); continue; } const newFile: AttachedFile = { name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 }; setProjectForm(prev => ({ ...prev, projectFiles: [...prev.projectFiles, newFile] })); uploadFileWithProgress( file, (progress) => setProjectForm(prev => ({ ...prev, projectFiles: prev.projectFiles.map(f => f.name === file.name && f.status === 'uploading' ? { ...f, progress } : f) })), (url) => setProjectForm(prev => ({ ...prev, projectFiles: prev.projectFiles.map(f => f.name === file.name ? { ...f, content: url, status: 'success', progress: 100 } : f) })), (err) => setProjectForm(prev => ({ ...prev, projectFiles: prev.projectFiles.map(f => f.name === file.name ? { ...f, status: 'error', errorMsg: err.message } : f) })), 'documents' ); } if (projectFileInputRef.current) projectFileInputRef.current.value = ''; };
  const handleRemoveProjectFile = (index: number) => { setProjectForm(prev => ({ ...prev, projectFiles: prev.projectFiles.filter((_, i) => i !== index) })); };
  const handleSaveInvoice = (invoice: Invoice) => { if (!selectedTicket) return; const invoices = projectForm.invoices || []; const existingIdx = invoices.findIndex(i => i.id === invoice.id); let newInvoices = existingIdx >= 0 ? invoices.map((inv, i) => i === existingIdx ? invoice : inv) : [...invoices, invoice]; const updatedProjectData = { ...projectForm, invoices: newInvoices, isActive: true }; onUpdateTicket(selectedTicket.id, { projectData: updatedProjectData }, currentUser.fullName, `Invoice ${invoice.number} updated.`); logSystemAction('UPDATE', 'Project', `Invoice ${invoice.number} saved`, currentUser.fullName, selectedTicket.id); setShowInvoiceModal(false); };
  const handleSaveProject = () => { if (!selectedTicket) return; if (projectForm.projectFiles.some(f => f.status === 'uploading')) { alert(lang === 'fa' ? 'صبر کنید...' : 'Wait for upload...'); return; } const updatedProjectData = { ...projectForm, isActive: true }; onUpdateTicket(selectedTicket.id, { projectData: updatedProjectData }, currentUser.fullName, 'Project Updated'); logSystemAction('UPDATE', 'Project', `Project ${selectedTicket.id} updated`, currentUser.fullName, selectedTicket.id); alert(lang === 'fa' ? 'ذخیره شد.' : 'Saved.'); };
  const handleAddMilestone = () => { if (!newMilestoneTitle.trim()) return; const milestone: ProjectMilestone = { id: `ms-${Date.now()}`, title: newMilestoneTitle, dueDate: newMilestoneDate, isCompleted: false }; setProjectForm(prev => ({ ...prev, milestones: [...(prev.milestones || []), milestone] })); setNewMilestoneTitle(''); setNewMilestoneDate(''); };
  const handleToggleMilestone = (id: string) => { setProjectForm(prev => ({ ...prev, milestones: prev.milestones?.map(m => m.id === id ? { ...m, isCompleted: !m.isCompleted } : m) })); };
  const handleAddRisk = () => { if(!newRiskTitle.trim()) return; const risk: ProjectRisk = { id: `rsk-${Date.now()}`, title: newRiskTitle, impact: newRiskImpact }; setProjectForm(prev => ({ ...prev, risks: [...(prev.risks || []), risk] })); setNewRiskTitle(''); };
  const handleAddTeamMember = async () => { if (!newTeamMemberId || !newTeamMemberResp.trim() || !selectedTicket) return; if (projectForm.teamMemberIds.includes(newTeamMemberId)) return; const newTask: Task = { id: `task-${Date.now()}`, title: `Project Join: ${selectedTicket.customerName}`, description: `Role: "${newTeamMemberRole}", Resp: ${newTeamMemberResp}`, creatorId: currentUser.id, creatorName: currentUser.fullName, assigneeIds: [newTeamMemberId], isCompleted: false, priority: 'High', createdAt: new Date().toISOString(), comments: [] }; await saveTaskToCloud(newTask); const newMember: ProjectTeamMember = { userId: newTeamMemberId, role: newTeamMemberRole || 'Member', responsibility: newTeamMemberResp, joinedAt: new Date().toISOString() }; setProjectForm(prev => ({ ...prev, teamMemberIds: [...prev.teamMemberIds, newTeamMemberId], teamMembers: [...(prev.teamMembers || []), newMember] })); setNewTeamMemberId(''); setNewTeamMemberRole(''); setNewTeamMemberResp(''); };
  const handleRemoveTeamMember = (userId: string) => { if (window.confirm('Remove member?')) { setProjectForm(prev => ({ ...prev, teamMemberIds: prev.teamMemberIds.filter(id => id !== userId), teamMembers: (prev.teamMembers || []).filter(m => m.userId !== userId) })); } };

  const partyTypeLabel = (type: ProjectPartyType): string => ({
    client: t.partyTypeClient, partner: t.partyTypePartner, supplier: t.partyTypeSupplier, investor: t.partyTypeInvestor, other: t.partyTypeOther,
  }[type]);

  const handleAddParty = () => {
    if (!newParty.name.trim()) return;
    const party: ProjectParty = { id: `party-${Date.now()}`, name: newParty.name.trim(), type: newParty.type, company: newParty.company.trim() || undefined, phone: newParty.phone.trim() || undefined, profitSharePercent: newParty.profitSharePercent, notes: newParty.notes.trim() || undefined, addedAt: new Date().toISOString() };
    setProjectForm(prev => ({ ...prev, parties: [...(prev.parties || []), party] }));
    setNewParty({ name: '', type: 'client', company: '', phone: '', profitSharePercent: 0, notes: '' });
  };

  const handleRemoveParty = (id: string) => {
    setProjectForm(prev => ({ ...prev, parties: (prev.parties || []).filter(p => p.id !== id) }));
  };

  const handleDefFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.item(0);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert(lang === 'fa' ? 'حداکثر ۱۰ مگابایت' : 'Max 10 MB'); return; }
    setDefUploading(true);
    uploadFileWithProgress(
      file,
      () => {},
      (url) => { setPendingDefFile({ url, name: file.name }); setDefUploading(false); },
      () => { alert(lang === 'fa' ? 'خطا در آپلود' : 'Upload failed'); setDefUploading(false); },
      'documents'
    );
    if (defFileInputRef.current) defFileInputRef.current.value = '';
  };

  const handleAddDefItem = () => {
    if (!newDefItem.label.trim() && !pendingDefFile) return;
    const item: ProjectDefinitionItem = { id: `def-${Date.now()}`, category: newDefItem.category.trim(), label: newDefItem.label.trim(), value: newDefItem.value.trim(), fileUrl: pendingDefFile?.url, fileName: pendingDefFile?.name, addedAt: new Date().toISOString(), addedBy: currentUser.fullName };
    setProjectForm(prev => ({ ...prev, definitions: [...(prev.definitions || []), item] }));
    setNewDefItem({ category: '', label: '', value: '' });
    setPendingDefFile(null);
  };

  const handleRemoveDefItem = (id: string) => {
    setProjectForm(prev => ({ ...prev, definitions: (prev.definitions || []).filter(d => d.id !== id) }));
  };
  const handleRenameTicketFile = (fileContentUrl: string, newName: string) => {
    if (!selectedTicket || !newName.trim()) return;
    const newTimeline = (selectedTicket.timeline || []).map(entry => {
      if (!entry.files?.some(f => f.content === fileContentUrl)) return entry;
      return { ...entry, files: entry.files.map(f => f.content === fileContentUrl ? { ...f, name: newName.trim() } : f) };
    });
    onUpdateTicket(selectedTicket.id, { timeline: newTimeline }, currentUser.fullName);
  };

  const formatNumberInput = (val: string) => val.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const handleRestore = async (log: SystemLog) => { if (window.confirm('Restore?')) { const success = await restoreEntityFromLog(log); alert(success ? 'Restored.' : 'Failed.'); } };
  const calculateFinancials = () => { const totalContract = projectForm.tariff?.amount || 0; const totalInvoiced = (projectForm.invoices || []).reduce((acc, inv) => acc + inv.total, 0); const totalPaid = projectForm.payments.reduce((acc, p) => acc + p.amount, 0); const balance = totalContract - totalPaid; return { totalContract, totalInvoiced, totalPaid, balance }; };
  const { totalContract, totalInvoiced, totalPaid, balance } = calculateFinancials();

  const renderFinancialReport = () => {
      const allProjects = tickets.filter(t => t.projectData?.isActive);
      const totalRevenue = allProjects.reduce((sum, t) => sum + (t.projectData?.tariff?.amount || 0), 0);
      const totalCollected = allProjects.reduce((sum, t) => sum + (t.projectData?.payments?.reduce((p, c) => p + c.amount, 0) || 0), 0);
      const pending = totalRevenue - totalCollected;
      const serviceRevenue: Record<string, number> = {};
      allProjects.forEach(t => { const sName = getServiceTitle(t.serviceId); serviceRevenue[sName] = (serviceRevenue[sName] || 0) + (t.projectData?.tariff?.amount || 0); });
      return (
          <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="text-gray-500 text-sm mb-1">{t.revenueTotal}</div>
                      <div className="text-3xl font-black text-gray-800">{totalRevenue.toLocaleString()} {t.rial}</div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="text-gray-500 text-sm mb-1">{t.paid}</div>
                      <div className="text-3xl font-black text-green-600">{totalCollected.toLocaleString()} {t.rial}</div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="text-gray-500 text-sm mb-1">{t.balance}</div>
                      <div className="text-3xl font-black text-red-600">{pending.toLocaleString()} {t.rial}</div>
                  </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><IconChart className="w-5 h-5 text-indigo-600" /> {t.revenueByService}</h3>
                  <div className="space-y-4">
                      {Object.entries(serviceRevenue).map(([name, amount]) => (
                          <div key={name} className="flex items-center gap-4">
                              <div className="w-1/3 text-sm text-gray-600 font-medium truncate" title={name}>{name}</div>
                              <div className="flex-grow bg-gray-100 rounded-full h-2 overflow-hidden">
                                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${totalRevenue ? (amount / totalRevenue) * 100 : 0}%` }}></div>
                              </div>
                              <div className="w-24 text-right text-sm font-bold text-gray-800">{amount.toLocaleString()}</div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      );
  };

  const renderTicketModal = () => {
    if (!selectedTicket) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setSelectedTicketId(null)}>
            <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] animate-fade-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 text-white px-3 py-1 rounded-lg font-mono font-bold">{selectedTicket.id}</div>
                        <div className="flex bg-gray-200 rounded-lg p-1">
                            <button onClick={() => setActiveModalTab('info')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeModalTab === 'info' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>{t.ticketInfo}</button>
                            <button onClick={() => setActiveModalTab('project')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeModalTab === 'project' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>{t.projectMgmt}</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => toggleFlag(selectedTicket)} title={isFlaggedOf(selectedTicket) ? 'حذف فلگ' : 'فلگ کردن به عنوان مهم'} className={`p-2 rounded-full border transition-colors shadow-sm w-8 h-8 flex items-center justify-center ${isFlaggedOf(selectedTicket) ? 'bg-yellow-50 border-yellow-300 text-yellow-500' : 'bg-white border-gray-200 text-gray-300 hover:text-yellow-400'}`}>
                            <IconStar className={`w-4 h-4 ${isFlaggedOf(selectedTicket) ? 'fill-yellow-400' : ''}`} />
                        </button>
                        <button onClick={() => setSelectedTicketId(null)} className="bg-white text-gray-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-full border border-gray-200 transition-colors shadow-sm w-8 h-8 flex items-center justify-center">✕</button>
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto p-6 bg-gray-50/50">
                    {activeModalTab === 'info' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><IconUsers className="w-5 h-5 text-indigo-500" /> {t.customerInfo}</h3>
                                        {!isEditingTicket ? (
                                            <button onClick={handleStartEdit} className="text-indigo-600 text-xs font-bold bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100">{t.edit}</button>
                                        ) : (
                                            <div className="flex gap-2">
                                                <button onClick={handleSaveEdit} className="text-green-600 text-xs font-bold bg-green-50 px-2 py-1 rounded hover:bg-green-100">{t.saveEdit}</button>
                                                <button onClick={() => setIsEditingTicket(false)} className="text-red-600 text-xs font-bold bg-red-50 px-2 py-1 rounded hover:bg-red-100">{t.cancelEdit}</button>
                                            </div>
                                        )}
                                    </div>
                                    {isEditingTicket ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <input className="border p-2 rounded" value={editingTicketData.customerName || ''} onChange={e => setEditingTicketData({...editingTicketData, customerName: e.target.value})} placeholder={t.fullName} />
                                            <input className="border p-2 rounded" value={editingTicketData.companyName || ''} onChange={e => setEditingTicketData({...editingTicketData, companyName: e.target.value})} placeholder={t.company} />
                                            <input className="border p-2 rounded dir-ltr text-right" value={editingTicketData.phoneNumber || ''} onChange={e => setEditingTicketData({...editingTicketData, phoneNumber: e.target.value})} placeholder={t.mobile} />
                                            <input className="border p-2 rounded" value={editingTicketData.location || ''} onChange={e => setEditingTicketData({...editingTicketData, location: e.target.value})} placeholder={t.location} />
                                            <textarea className="col-span-2 border p-2 rounded" value={editingTicketData.description || ''} onChange={e => setEditingTicketData({...editingTicketData, description: e.target.value})} placeholder={t.description} rows={3} />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                            <div><span className="text-gray-500 block mb-1">{t.fullName}</span><span className="font-bold text-gray-800">{selectedTicket.customerName}</span></div>
                                            <div><span className="text-gray-500 block mb-1">{t.company}</span><span className="font-bold text-gray-800">{selectedTicket.companyName || '-'}</span></div>
                                            <div><span className="text-gray-500 block mb-1">{t.mobile}</span><span className="font-bold text-gray-800 dir-ltr block text-right">{selectedTicket.phoneNumber}</span></div>
                                            <div><span className="text-gray-500 block mb-1">{t.whatsapp}</span><span className="font-bold text-gray-800 dir-ltr block text-right">{selectedTicket.whatsappNumber}</span></div>
                                            <div className="col-span-2"><span className="text-gray-500 block mb-1">{t.description}</span><p className="font-medium text-gray-800 bg-gray-50 p-3 rounded-lg leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p></div>
                                            {(selectedTicket.files || []).length > 0 && (
                                                <div className="col-span-2">
                                                    <span className="text-gray-500 block mb-2">{t.files}</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(selectedTicket.files || []).map((f, i) => (
                                                            <a key={i} href={f.content} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-lg text-xs font-bold text-gray-700 hover:border-indigo-500 hover:text-indigo-600 transition-colors">
                                                                <IconPaperclip className="w-3 h-3" /> {f.name}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {(selectedTicket.selectedSubServices || []).length > 0 && (
                                                <div className="col-span-2 pt-2 border-t border-gray-100">
                                                    <span className="text-gray-500 block mb-2">{t.subServices}</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(selectedTicket.selectedSubServices || []).map((subId, idx) => (
                                                            <span key={idx} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs border border-indigo-100">
                                                                {getSubServiceTitle(selectedTicket.serviceId, subId)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><IconActivity className="w-5 h-5 text-indigo-500" /> {t.events}</h3>
                                    {/* File table */}
                                    {(() => {
                                      const allTicketFiles = (selectedTicket.timeline || []).flatMap(entry =>
                                        ((entry as any).files as AttachedFile[] | undefined || []).map((f: AttachedFile) => ({
                                          key: f.content || `${f.name}-${entry.timestamp}`,
                                          name: f.name,
                                          size: f.size,
                                          content: f.content,
                                          actor: entry.actorName,
                                          timestamp: entry.timestamp,
                                        }))
                                      );
                                      if (allTicketFiles.length === 0) return null;
                                      return (
                                        <div className="mb-5 border border-gray-100 rounded-xl overflow-hidden">
                                          <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-100">
                                            <span className="text-xs font-semibold text-gray-500">📎 فایل‌های مبادله شده</span>
                                            <span className="text-[10px] text-gray-400 bg-white border border-gray-100 px-1.5 py-0.5 rounded-full">{allTicketFiles.length} فایل</span>
                                          </div>
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="border-b border-gray-50 text-gray-400 text-[10px]">
                                                  <th className="px-4 py-2 text-right font-medium">نام فایل</th>
                                                  <th className="px-4 py-2 text-right font-medium">فرستنده</th>
                                                  <th className="px-4 py-2 text-right font-medium">تاریخ</th>
                                                  <th className="px-4 py-2 text-right font-medium">حجم</th>
                                                  <th className="px-4 py-2 text-right font-medium">عملیات</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-50">
                                                {allTicketFiles.map((row) => (
                                                  <tr key={row.key} className="hover:bg-gray-50 transition-colors group">
                                                    <td className="px-4 py-2.5 max-w-[180px]">
                                                      {editingFileLabelKey === row.key ? (
                                                        <input
                                                          autoFocus
                                                          className="w-full text-xs border border-gray-300 rounded px-2 py-0.5 outline-none focus:border-gray-800"
                                                          value={editingFileLabelValue}
                                                          onChange={e => setEditingFileLabelValue(e.target.value)}
                                                          onBlur={() => { handleRenameTicketFile(row.content, editingFileLabelValue); setEditingFileLabelKey(null); }}
                                                          onKeyDown={e => { if (e.key === 'Enter') { handleRenameTicketFile(row.content, editingFileLabelValue); setEditingFileLabelKey(null); } if (e.key === 'Escape') setEditingFileLabelKey(null); }}
                                                        />
                                                      ) : (
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                          <a href={row.content} target="_blank" rel="noopener noreferrer"
                                                            className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2 truncate max-w-[140px]"
                                                            title={row.name}>
                                                            {row.name}
                                                          </a>
                                                          <button onClick={() => { setEditingFileLabelKey(row.key); setEditingFileLabelValue(row.name); }}
                                                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-600 transition-all shrink-0">
                                                            <IconEdit className="w-3 h-3" />
                                                          </button>
                                                        </div>
                                                      )}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{row.actor}</td>
                                                    <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap dir-ltr text-left">{new Date(row.timestamp).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                                    <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{(row.size / 1024).toFixed(0)} KB</td>
                                                    <td className="px-4 py-2.5">
                                                      <a href={row.content} target="_blank" rel="noopener noreferrer"
                                                        className="text-gray-400 hover:text-gray-700 transition-colors text-[10px] border border-gray-200 hover:border-gray-400 px-2 py-0.5 rounded">
                                                        دانلود
                                                      </a>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                    <div className="space-y-6 max-h-[400px] overflow-y-auto mb-6 pr-2 custom-scrollbar">
                                        {(selectedTicket.timeline || []).map((entry, idx) => (
                                            <div key={idx} className={`flex gap-4 ${entry.visibility === 'internal' ? 'bg-amber-50/50 p-2 rounded-lg -mx-2' : ''}`}>
                                                <div className="flex flex-col items-center">
                                                    <div className={`w-3 h-3 rounded-full mt-1.5 ring-4 ring-white ${entry.type === 'creation' ? 'bg-green-500' : entry.type === 'status_change' ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                                                    {idx !== (selectedTicket.timeline?.length || 0) - 1 && <div className="w-0.5 flex-grow bg-gray-200 my-1"></div>}
                                                </div>
                                                <div className="flex-grow">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-xs font-bold text-gray-600">{entry.actorName}</span>
                                                        <span className="text-[10px] text-gray-400 dir-ltr">{new Date(entry.timestamp || new Date()).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</span>
                                                    </div>
                                                    <div className="font-bold text-sm text-gray-800 mt-1">{entry.title}</div>
                                                    {entry.description && (
                                                        <div className="text-sm text-gray-600 mt-1 bg-white/50 p-2 rounded border border-gray-100/50 group relative">
                                                            {entry.description}
                                                            {isMaster && (
                                                                <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                                                                    <button onClick={() => handleEditTimelineEntry(idx, entry.description!)} className="p-1 bg-white rounded border hover:text-blue-500"><IconEdit className="w-3 h-3"/></button>
                                                                    <button onClick={() => handleDeleteTimelineEntry(idx)} className="p-1 bg-white rounded border hover:text-red-500"><IconTrash className="w-3 h-3"/></button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {entry.files && entry.files.length > 0 && (
                                                      <div className="mt-2 space-y-1">
                                                        {entry.files.map((f, fi) => (
                                                          <a key={fi} href={f.content} target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 underline underline-offset-2">
                                                            📎 {f.name} <span className="text-gray-400 no-underline text-[10px]">({(f.size / 1024 / 1024).toFixed(1)} MB)</span>
                                                          </a>
                                                        ))}
                                                      </div>
                                                    )}
                                                    {entry.visibility === 'internal' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded mt-1 inline-block">Internal</span>}
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={commentsEndRef}></div>
                                    </div>
                                    {commentFiles.length > 0 && (
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        {commentFiles.map((f, i) => (
                                          <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border ${f.status === 'error' ? 'bg-red-50 border-red-200 text-red-600' : f.status === 'uploading' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                                            <span className="max-w-[120px] truncate">{f.name}</span>
                                            {f.status === 'uploading' && <span>{f.progress}%</span>}
                                            {f.status === 'error' && <span title={f.errorMsg}>⚠</span>}
                                            <button onClick={() => setCommentFiles(p => p.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 transition-colors">✕</button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="relative">
                                        <textarea className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none pr-12" rows={2} placeholder={t.writeMsg} value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAddComment())} />
                                        <div className="absolute bottom-3 right-3 flex gap-2"><button onClick={() => setShowMentionList(!showMentionList)} className="text-gray-400 hover:text-indigo-600 transition-colors">@</button></div>
                                        {showMentionList && (
                                            <div className="absolute bottom-full mb-2 left-0 w-48 bg-white border border-gray-200 rounded-xl shadow-xl max-h-32 overflow-y-auto z-10">
                                                {personnel.map(p => (
                                                    <button key={p.id} onClick={() => handleInsertMention(p.username)} className="w-full text-start px-3 py-2 text-xs hover:bg-indigo-50 text-gray-700 border-b border-gray-50 last:border-0">
                                                        <span className="font-bold">{p.fullName}</span>
                                                        <span className="block text-gray-400 font-mono">@{p.username}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setCommentVisibility('public')} className={`text-xs px-2 py-1 rounded transition-colors ${commentVisibility === 'public' ? 'bg-green-100 text-green-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>{t.publicReport}</button>
                                            <button onClick={() => setCommentVisibility('internal')} className={`text-xs px-2 py-1 rounded transition-colors ${commentVisibility === 'internal' ? 'bg-amber-100 text-amber-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>{t.internalNote}</button>
                                            <button onClick={() => commentFileInputRef.current?.click()} title="ضمیمه فایل (حداکثر ۵۰ مگابایت)" className="text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100 transition-colors">📎</button>
                                            <input ref={commentFileInputRef} type="file" multiple className="hidden" onChange={handleCommentFileSelect} />
                                        </div>
                                        <button onClick={handleAddComment} disabled={!newComment.trim() && commentFiles.length === 0} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">{t.send}</button>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <label className="block text-xs font-bold text-gray-500 mb-2">{t.status}</label>
                                    <select className={`w-full p-2 rounded-lg border text-sm font-bold outline-none mb-4 ${getStatusBadge(selectedTicket.status)}`} value={selectedTicket.status} onChange={(e) => handleUpdateTicketStatus(e.target.value as TicketStatus)}>{Object.values(TicketStatus).map(s => <option key={s} value={s}>{s}</option>)}</select>
                                    <label className="block text-xs font-bold text-gray-500 mb-2">{t.priority}</label>
                                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-sm font-bold ${getPriorityBadge(selectedTicket.priority || 'Medium').bg} ${getPriorityBadge(selectedTicket.priority || 'Medium').text}`}>
                                        <IconFlag className="w-4 h-4" />
                                        {getPriorityBadge(selectedTicket.priority || 'Medium').label}
                                        {(isAdmin || isMaster) && (
                                            <select className="ml-auto bg-transparent outline-none text-xs" value={selectedTicket.priority || 'Medium'} onChange={(e) => onUpdateTicket(selectedTicket.id, { priority: e.target.value as any }, currentUser.fullName, `Priority changed to ${e.target.value}`)}>
                                                <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                                            </select>
                                        )}
                                    </div>
                                </div>
                                {(config.labels || []).length > 0 && (
                                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                    <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center gap-1"><IconTag className="w-3.5 h-3.5" />لیبل‌ها</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(config.labels || []).map(lbl => {
                                            const isAssigned = (selectedTicket.labelIds || []).includes(lbl.id);
                                            const colors: Record<string,string> = { red:'bg-red-100 text-red-700 border-red-300', orange:'bg-orange-100 text-orange-700 border-orange-300', yellow:'bg-yellow-100 text-yellow-700 border-yellow-300', green:'bg-green-100 text-green-700 border-green-300', blue:'bg-blue-100 text-blue-700 border-blue-300', purple:'bg-purple-100 text-purple-700 border-purple-300', pink:'bg-pink-100 text-pink-700 border-pink-300', gray:'bg-gray-100 text-gray-600 border-gray-300' };
                                            return (
                                                <button key={lbl.id} onClick={() => {
                                                    const curr = selectedTicket.labelIds || [];
                                                    const next = isAssigned ? curr.filter(id => id !== lbl.id) : [...curr, lbl.id];
                                                    onUpdateTicket(selectedTicket.id, { labelIds: next }, currentUser.fullName || currentUser.username);
                                                }} className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border transition-all ${isAssigned ? colors[lbl.color] || colors.gray : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}>
                                                    <IconTag className="w-2.5 h-2.5" />{lbl.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                )}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <label className="block text-xs font-bold text-gray-500 mb-2">{t.expert}</label>
                                    <div className="flex gap-2">
                                        <select className="flex-grow p-2 rounded-lg border border-gray-200 text-sm outline-none bg-white" value={tempAssignedTo} onChange={(e) => setTempAssignedTo(e.target.value)} disabled={!canAssign}>
                                            <option value="">{t.notAssigned}</option>
                                            {personnel.map(p => <option key={p.id} value={p.id}>{p.fullName} - {p.roles[0]}</option>)}
                                        </select>
                                        <button onClick={handleAssignTicket} disabled={!canAssign || tempAssignedTo === selectedTicket.assignedTo} className="bg-indigo-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-300">{t.assign}</button>
                                    </div>
                                </div>
                                {/* Customer upload window card */}
                                {(() => {
                                  const win = selectedTicket.customerUploadWindow;
                                  const winOpen = win?.isOpen && new Date(win.expiresAt).getTime() > Date.now();
                                  const winExpired = win && !win.isOpen === false && !winOpen;
                                  const hoursLeft = winOpen ? Math.max(0, Math.round((new Date(win!.expiresAt).getTime() - Date.now()) / 3_600_000)) : 0;
                                  return (
                                    <div className={`p-4 rounded-2xl border ${winOpen ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'} shadow-sm`}>
                                      <div className="flex items-center gap-2 mb-3">
                                        <IconUpload className="w-4 h-4 text-amber-500" />
                                        <span className="text-xs font-bold text-gray-600">{lang === 'fa' ? 'پنجره آپلود مشتری' : 'Customer Upload Window'}</span>
                                        {winOpen && <span className="mr-auto text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{lang === 'fa' ? `باز — ${hoursLeft} ساعت مانده` : `Open — ${hoursLeft}h left`}</span>}
                                        {win && !winOpen && <span className="mr-auto text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{lang === 'fa' ? 'بسته' : 'Closed'}</span>}
                                      </div>
                                      {winOpen ? (
                                        <div className="space-y-2">
                                          <p className="text-xs text-gray-600 bg-amber-100/60 rounded-lg px-3 py-2 leading-relaxed">{win!.prompt}</p>
                                          <button onClick={handleCloseUploadWindow} className="w-full text-xs text-red-600 border border-red-200 py-1.5 rounded-lg hover:bg-red-50 transition-colors font-medium">
                                            {lang === 'fa' ? '✕ بستن پنجره' : '✕ Close Window'}
                                          </button>
                                        </div>
                                      ) : showUploadWindowForm ? (
                                        <div className="space-y-2">
                                          <textarea
                                            value={uploadWindowPrompt}
                                            onChange={e => setUploadWindowPrompt(e.target.value)}
                                            rows={3}
                                            placeholder={lang === 'fa' ? 'پیام به مشتری — چه مدرک یا اطلاعاتی نیاز دارید؟' : 'Message to customer — what document/info do you need?'}
                                            className="w-full border border-gray-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-amber-400 outline-none resize-none"
                                          />
                                          <div className="flex gap-1.5">
                                            {[24, 48, 72, 168].map(h => (
                                              <button key={h} type="button"
                                                onClick={() => setUploadWindowDuration(h)}
                                                className={`flex-1 text-[10px] py-1 rounded border transition-colors ${uploadWindowDuration === h ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-500 hover:border-amber-300'}`}>
                                                {h === 168 ? (lang === 'fa' ? '۷ روز' : '7d') : (lang === 'fa' ? `${h}ساعت` : `${h}h`)}
                                              </button>
                                            ))}
                                          </div>
                                          <div className="flex gap-2">
                                            <button onClick={() => { setShowUploadWindowForm(false); setUploadWindowPrompt(''); }} className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">{lang === 'fa' ? 'انصراف' : 'Cancel'}</button>
                                            <button onClick={handleOpenUploadWindow} disabled={!uploadWindowPrompt.trim()} className="flex-1 text-xs py-1.5 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-50">{lang === 'fa' ? 'باز کردن' : 'Open'}</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button onClick={() => setShowUploadWindowForm(true)}
                                          className="w-full text-xs text-amber-700 border border-amber-200 py-1.5 rounded-lg hover:bg-amber-50 transition-colors font-medium flex items-center justify-center gap-1.5">
                                          <IconUpload className="w-3.5 h-3.5" />
                                          {lang === 'fa' ? 'باز کردن پنجره آپلود' : 'Open Upload Window'}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                                {(isAdmin || isMaster) && (
                                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                                        <button onClick={() => handleDelete(selectedTicket.id)} className="w-full text-red-600 text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-100 p-2 rounded-lg transition-colors"><IconTrash className="w-4 h-4" /> {t.delete}</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center"><div className="text-gray-500 text-xs mb-1">{t.contractAmount}</div><div className="font-black text-gray-800 text-lg">{(projectForm.tariff?.amount || 0).toLocaleString()} <span className="text-xs font-normal text-gray-400">{projectForm.tariff?.currency}</span></div></div>
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center"><div className="text-gray-500 text-xs mb-1">{t.timeProgress}</div><div className="font-black text-blue-600 text-lg">{(() => { if(!projectForm.startDate || !projectForm.endDate) return '0%'; const total = new Date(projectForm.endDate).getTime() - new Date(projectForm.startDate).getTime(); const passed = Date.now() - new Date(projectForm.startDate).getTime(); return Math.min(100, Math.max(0, Math.round((passed / total) * 100))) + '%'; })()}</div></div>
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center"><div className="text-gray-500 text-xs mb-1">{t.physProgress}</div><div className="flex items-center justify-center gap-2"><input type="number" className="w-12 text-center font-black text-lg border-b border-gray-300 outline-none" value={projectForm.progress} onChange={(e) => setProjectForm({...projectForm, progress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))})} /><span className="text-gray-400">%</span></div></div>
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center"><div className="text-gray-500 text-xs mb-1">{t.invoiced}</div><div className="font-black text-green-600 text-lg">{totalInvoiced.toLocaleString()}</div></div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                                    <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-2">{t.projectMgmt}</h4>
                                    <div>
                                      <label className="text-xs font-bold text-gray-500 block mb-1">{t.projectCategory}</label>
                                      <input className="w-full border rounded-lg p-2 text-sm" placeholder={t.projectCategoryPh} value={projectForm.category || ''} onChange={e => setProjectForm({...projectForm, category: e.target.value})} list="proj-cat-edit" />
                                      <datalist id="proj-cat-edit">
                                        {[...new Set(tickets.filter(tk => tk.projectData?.category).map(tk => tk.projectData!.category!))].map(c => <option key={c} value={c} />)}
                                      </datalist>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-bold text-gray-500 block mb-1">{t.startDate}</label><input type="date" className="w-full border rounded-lg p-2 text-sm" value={projectForm.startDate} onChange={e => setProjectForm({...projectForm, startDate: e.target.value})} /></div>
                                        <div><label className="text-xs font-bold text-gray-500 block mb-1">{t.endDate}</label><input type="date" className="w-full border rounded-lg p-2 text-sm" value={projectForm.endDate} onChange={e => setProjectForm({...projectForm, endDate: e.target.value})} /></div>
                                    </div>
                                    <div><label className="text-xs font-bold text-gray-500 block mb-1">{t.contractAmount}</label><div className="flex gap-2"><input className="w-full border rounded-lg p-2 text-sm" type="number" value={projectForm.tariff?.amount} onChange={e => setProjectForm({...projectForm, tariff: { ...projectForm.tariff, amount: parseInt(e.target.value) || 0, currency: projectForm.tariff?.currency || 'IRR' }})} /><select className="border rounded-lg p-2 text-sm bg-white" value={projectForm.tariff?.currency} onChange={e => setProjectForm({...projectForm, tariff: { ...projectForm.tariff, currency: e.target.value as Currency, amount: projectForm.tariff?.amount || 0 }})}><option value="IRR">IRR</option><option value="USD">USD</option><option value="OMR">OMR</option></select></div></div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">{t.team}</h4>
                                    <div className="space-y-3 mb-4">{projectForm.teamMembers?.map((m, i) => { const p = personnel.find(per => per.id === m.userId); return (<div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">{p?.fullName.charAt(0) || '?'}</div><div><div className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><span className="font-mono text-indigo-700">{p ? getStaffCode(p) : (lang === 'fa' ? 'حذف‌شده' : 'removed')}</span><span className="text-gray-400 font-normal text-xs">{p?.fullName}</span></div><div className="text-xs text-gray-500">{m.role}</div></div></div><button onClick={() => handleRemoveTeamMember(m.userId)} className="text-red-400 hover:text-red-600"><IconTrash className="w-4 h-4" /></button></div>); })}</div>
                                    <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200"><select className="w-full border rounded p-2 text-sm" value={newTeamMemberId} onChange={e => setNewTeamMemberId(e.target.value)}><option value="">{lang === 'fa' ? 'انتخاب پرسنل (با آی‌دی)' : 'Select personnel (by ID)'}</option>{personnel.filter(p => !projectForm.teamMemberIds.includes(p.id)).map(p => <option key={p.id} value={p.id}>{getStaffCode(p)} — {p.fullName}</option>)}</select><input className="w-full border rounded p-2 text-sm" placeholder={t.role} value={newTeamMemberRole} onChange={e => setNewTeamMemberRole(e.target.value)} /><input className="w-full border rounded p-2 text-sm" placeholder={t.responsibility} value={newTeamMemberResp} onChange={e => setNewTeamMemberResp(e.target.value)} /><button onClick={handleAddTeamMember} className="bg-indigo-600 text-white p-2 rounded text-sm font-bold hover:bg-indigo-700">{t.addMember}</button></div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">{t.milestones}</h4>
                                <div className="space-y-2 mb-4">{projectForm.milestones?.map((m, i) => (<div key={i} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded transition-colors"><input type="checkbox" checked={m.isCompleted} onChange={() => handleToggleMilestone(m.id)} className="w-5 h-5 text-indigo-600 rounded" /><div className={`flex-grow ${m.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}><div className="font-bold text-sm">{m.title}</div><div className="text-xs text-gray-500">{m.dueDate}</div></div><button onClick={() => setProjectForm(prev => ({...prev, milestones: prev.milestones?.filter(item => item.id !== m.id)}))} className="text-red-300 hover:text-red-500"><IconTrash className="w-4 h-4" /></button></div>))}</div>
                                <div className="flex gap-2"><input className="flex-grow border rounded p-2 text-sm" placeholder="Title" value={newMilestoneTitle} onChange={e => setNewMilestoneTitle(e.target.value)} /><input className="border rounded p-2 text-sm" type="date" value={newMilestoneDate} onChange={e => setNewMilestoneDate(e.target.value)} /><button onClick={handleAddMilestone} className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-4 rounded text-sm font-bold hover:bg-indigo-100">+</button></div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-4"><h4 className="font-bold text-gray-800">{t.financialDash}</h4>{canManageInvoices && <button onClick={() => { setEditingInvoice(undefined); setShowInvoiceModal(true); }} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-1"><IconInvoice className="w-3 h-3" /> {t.issueInvoice}</button>}</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><h5 className="text-xs font-bold text-gray-500 mb-2">Invoices</h5>{projectForm.invoices && projectForm.invoices.length > 0 ? (<div className="space-y-2">{projectForm.invoices.map(inv => (<div key={inv.id} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm border border-gray-200"><div><div className="font-bold">{inv.number}</div><div className="text-xs text-gray-500">{inv.date}</div></div><div className="font-bold">{inv.total.toLocaleString()}</div><button onClick={() => { setEditingInvoice(inv); setShowInvoiceModal(true); }} className="text-blue-500 text-xs hover:underline">{t.edit}</button></div>))}</div>) : <div className="text-sm text-gray-400 italic">No invoices issued</div>}</div>
                                    <div><h5 className="text-xs font-bold text-gray-500 mb-2">Payments Received</h5><div className="space-y-2 mb-2">{projectForm.payments.map((p, i) => (<div key={i} className="flex justify-between items-center bg-green-50 p-2 rounded text-sm border border-green-100"><div><div className="font-bold">{p.type}</div><div className="text-xs text-gray-500">{p.date}</div></div><div className="font-bold text-green-700">{p.amount.toLocaleString()}</div><button onClick={() => setProjectForm(prev => ({...prev, payments: prev.payments.filter((_, idx) => idx !== i)}))} className="text-red-300 hover:text-red-500"><IconTrash className="w-4 h-4" /></button></div>))}</div><div className="flex gap-2"><input type="number" className="w-24 border rounded p-1 text-sm" placeholder="Amount" value={newPayment.amount || ''} onChange={e => setNewPayment({...newPayment, amount: parseInt(e.target.value) || 0})} />
                                    <select className="border rounded p-1 text-sm bg-white" value={newPayment.type} onChange={e => setNewPayment({...newPayment, type: e.target.value as any})}><option value="deposit">Deposit</option><option value="settlement">Settlement</option><option value="installment">Installment</option></select><button onClick={() => { if(!newPayment.amount) return; setProjectForm(prev => ({...prev, payments: [...prev.payments, { id: `pay-${Date.now()}`, amount: newPayment.amount!, currency: projectForm.tariff?.currency || 'IRR', date: new Date().toISOString().split('T')[0], type: newPayment.type as any }] })); setNewPayment({...newPayment, amount: 0}); }} className="bg-green-600 text-white px-3 rounded text-sm font-bold hover:bg-green-700">{t.recordPayment}</button></div></div>
                                </div>
                            </div>
                            {/* ── Project Parties ── */}
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                              <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4 flex items-center gap-2">
                                <IconUsers className="w-4 h-4 text-indigo-500" /> {t.partiesTitle}
                              </h4>
                              {/* Parties table */}
                              {(projectForm.parties || []).length > 0 ? (
                                <div className="overflow-x-auto mb-4">
                                  <table className="w-full text-sm border-collapse">
                                    <thead>
                                      <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase">
                                        <th className="px-3 py-2 text-right rounded-tr-lg">{t.partyName}</th>
                                        <th className="px-3 py-2 text-right">{t.partyType}</th>
                                        <th className="px-3 py-2 text-right">{t.partyCompany}</th>
                                        <th className="px-3 py-2 text-right">{t.partyPhone}</th>
                                        <th className="px-3 py-2 text-center">{t.partyShare}</th>
                                        <th className="px-3 py-2 text-right">{t.partyNotes}</th>
                                        <th className="px-3 py-2 rounded-tl-lg"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(projectForm.parties || []).map((party) => (
                                        <tr key={party.id} className="hover:bg-gray-50">
                                          <td className="px-3 py-2 font-semibold text-gray-800">{party.name}</td>
                                          <td className="px-3 py-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${party.type === 'client' ? 'bg-blue-50 text-blue-600' : party.type === 'partner' ? 'bg-emerald-50 text-emerald-600' : party.type === 'supplier' ? 'bg-amber-50 text-amber-600' : party.type === 'investor' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                                              {partyTypeLabel(party.type)}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-gray-500 text-xs">{party.company || '—'}</td>
                                          <td className="px-3 py-2 text-gray-500 text-xs dir-ltr">{party.phone || '—'}</td>
                                          <td className="px-3 py-2 text-center">
                                            <span className="font-bold text-indigo-600">{party.profitSharePercent}%</span>
                                          </td>
                                          <td className="px-3 py-2 text-gray-400 text-xs max-w-[100px] truncate">{party.notes || '—'}</td>
                                          <td className="px-3 py-2">
                                            <button onClick={() => handleRemoveParty(party.id)} className="text-red-300 hover:text-red-500"><IconTrash className="w-4 h-4" /></button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                                        <td colSpan={4} className="px-3 py-2 text-xs font-bold text-gray-500">{t.totalShare}</td>
                                        <td className="px-3 py-2 text-center font-black text-indigo-700">
                                          {(projectForm.parties || []).reduce((s, p) => s + p.profitSharePercent, 0)}%
                                        </td>
                                        <td colSpan={2}></td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400 italic mb-4">{t.noParties}</p>
                              )}
                              {/* Add party form */}
                              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <input className="border rounded-lg p-2 text-xs bg-white" placeholder={t.partyName} value={newParty.name} onChange={e => setNewParty({...newParty, name: e.target.value})} />
                                  <select className="border rounded-lg p-2 text-xs bg-white" value={newParty.type} onChange={e => setNewParty({...newParty, type: e.target.value as ProjectPartyType})}>
                                    <option value="client">{t.partyTypeClient}</option>
                                    <option value="partner">{t.partyTypePartner}</option>
                                    <option value="supplier">{t.partyTypeSupplier}</option>
                                    <option value="investor">{t.partyTypeInvestor}</option>
                                    <option value="other">{t.partyTypeOther}</option>
                                  </select>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <input className="border rounded-lg p-2 text-xs bg-white" placeholder={t.partyCompany} value={newParty.company} onChange={e => setNewParty({...newParty, company: e.target.value})} />
                                  <input className="border rounded-lg p-2 text-xs bg-white dir-ltr" placeholder={t.partyPhone} value={newParty.phone} onChange={e => setNewParty({...newParty, phone: e.target.value})} />
                                  <div className="flex items-center gap-1">
                                    <input type="number" min={0} max={100} className="border rounded-lg p-2 text-xs bg-white w-full" placeholder={t.partyShare} value={newParty.profitSharePercent || ''} onChange={e => setNewParty({...newParty, profitSharePercent: parseFloat(e.target.value) || 0})} />
                                    <span className="text-xs text-gray-400">%</span>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <input className="flex-1 border rounded-lg p-2 text-xs bg-white" placeholder={t.partyNotes} value={newParty.notes} onChange={e => setNewParty({...newParty, notes: e.target.value})} />
                                  <button onClick={handleAddParty} className="bg-indigo-600 text-white px-4 rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1"><IconPlus className="w-3 h-3" />{t.addParty}</button>
                                </div>
                              </div>
                            </div>

                            {/* ── Project Definitions Table ── */}
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                              <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4 flex items-center gap-2">
                                <IconList className="w-4 h-4 text-indigo-500" /> {t.definitionsTitle}
                              </h4>
                              <input type="file" ref={defFileInputRef} className="hidden" onChange={handleDefFileUpload} />
                              {/* Definitions table */}
                              {(projectForm.definitions || []).length > 0 ? (
                                <div className="overflow-x-auto mb-4">
                                  <table className="w-full text-sm border-collapse">
                                    <thead>
                                      <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase">
                                        <th className="px-3 py-2 text-right rounded-tr-lg">{t.defCategory}</th>
                                        <th className="px-3 py-2 text-right">{t.defLabel}</th>
                                        <th className="px-3 py-2 text-right">{t.defValue}</th>
                                        <th className="px-3 py-2 text-right">{t.defFile}</th>
                                        <th className="px-3 py-2 rounded-tl-lg"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {/* Group by category */}
                                      {(() => {
                                        const defs = projectForm.definitions || [];
                                        const cats = [...new Set(defs.map(d => d.category || ''))];
                                        return cats.map(cat => (
                                          <React.Fragment key={cat}>
                                            {cat && (
                                              <tr className="bg-indigo-50">
                                                <td colSpan={5} className="px-3 py-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-wider">{cat}</td>
                                              </tr>
                                            )}
                                            {defs.filter(d => (d.category || '') === cat).map(item => (
                                              <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 text-[11px] text-gray-400">{item.category || '—'}</td>
                                                <td className="px-3 py-2 font-semibold text-gray-800">{item.label}</td>
                                                <td className="px-3 py-2 text-gray-600 max-w-[180px]">{item.value || '—'}</td>
                                                <td className="px-3 py-2">
                                                  {item.fileUrl ? (
                                                    <a href={item.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline text-xs"><IconFile className="w-3 h-3" />{item.fileName || lang === 'fa' ? 'فایل' : 'File'}</a>
                                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                                </td>
                                                <td className="px-3 py-2">
                                                  <button onClick={() => handleRemoveDefItem(item.id)} className="text-red-300 hover:text-red-500"><IconTrash className="w-4 h-4" /></button>
                                                </td>
                                              </tr>
                                            ))}
                                          </React.Fragment>
                                        ));
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400 italic mb-4">{t.noDefinitions}</p>
                              )}
                              {/* Add definition row form */}
                              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                                <div className="grid grid-cols-3 gap-2">
                                  <input className="border rounded-lg p-2 text-xs bg-white" placeholder={t.defCategoryPh} value={newDefItem.category} onChange={e => setNewDefItem({...newDefItem, category: e.target.value})} list="def-category-list" />
                                  <datalist id="def-category-list">
                                    {[...new Set((projectForm.definitions || []).map(d => d.category).filter(Boolean))].map(c => <option key={c} value={c} />)}
                                    {['مدارک قراردادی','اطلاعات اولیه','مشخصات فنی','مدارک مالی','گزارشات'].map(c => <option key={c} value={c} />)}
                                  </datalist>
                                  <input className="border rounded-lg p-2 text-xs bg-white" placeholder={t.defLabelPh} value={newDefItem.label} onChange={e => setNewDefItem({...newDefItem, label: e.target.value})} />
                                  <input className="border rounded-lg p-2 text-xs bg-white" placeholder={t.defValuePh} value={newDefItem.value} onChange={e => setNewDefItem({...newDefItem, value: e.target.value})} />
                                </div>
                                <div className="flex gap-2 items-center">
                                  <button type="button" onClick={() => defFileInputRef.current?.click()} disabled={defUploading} className="flex items-center gap-1 text-xs border border-gray-300 bg-white px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                                    <IconUpload className="w-3 h-3" />
                                    {defUploading ? t.uploadingDef : pendingDefFile ? pendingDefFile.name : t.attachFile}
                                  </button>
                                  {pendingDefFile && <button type="button" onClick={() => setPendingDefFile(null)} className="text-red-400 hover:text-red-600 text-xs">✕</button>}
                                  <button onClick={handleAddDefItem} disabled={!newDefItem.label.trim() && !pendingDefFile} className="mr-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1"><IconPlus className="w-3 h-3" />{t.addDefItem}</button>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"><h4 className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">{t.projectDocs}</h4><div className="flex flex-wrap gap-3 mb-4">{(projectForm.projectFiles || []).map((f, i) => (<div key={i} className="relative group bg-gray-50 border border-gray-200 p-2 rounded-lg flex items-center gap-2"><IconFile className="w-4 h-4 text-gray-500" /><a href={f.content} target="_blank" className="text-sm text-blue-600 hover:underline truncate max-w-[150px]">{f.name}</a><button onClick={() => handleRemoveProjectFile(i)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><IconTrash className="w-3 h-3" /></button></div>))}</div><div onClick={() => projectFileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 hover:border-indigo-300 transition-colors"><IconUpload className="w-6 h-6 text-gray-400 mx-auto mb-1" /><span className="text-xs text-gray-500">{t.uploadHint}</span><input type="file" ref={projectFileInputRef} className="hidden" multiple onChange={handleProjectFileUpload} /></div></div>
                            <button onClick={handleSaveProject} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">{t.saveProject}</button>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-100 bg-white shrink-0 flex justify-end"><button onClick={() => setSelectedTicketId(null)} className="px-6 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors flex items-center gap-2">{lang === 'fa' ? 'بستن' : 'Close'}</button></div>
            </div>
        </div>
    );
  };

  // ── Job Description read-only modal ──
  const parseJDForView = (str?: string) => {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return { summary: { fa: str, en: '' } }; }
  };
  const jdView = parseJDForView(currentUser.jobDescription);

  return (
    <div className="flex flex-col md:flex-row gap-5 min-h-[calc(100vh-100px)]">
      {showJobDescModal && jdView && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setShowJobDescModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4 animate-fade-in" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span className="w-7 h-7 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm">📋</span>
                {lang === 'fa' ? 'شرح شغل من' : 'My Job Description'}
              </h3>
              <button onClick={() => setShowJobDescModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">×</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {jdView.position?.fa && (
                <div className="flex items-center gap-3 bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                  <div>
                    <p className="text-xs text-indigo-500 font-semibold">{lang === 'fa' ? 'سمت / عنوان شغلی' : 'Position'}</p>
                    <p className="text-sm font-bold text-indigo-900">{lang === 'fa' ? jdView.position.fa : (jdView.position.en || jdView.position.fa)}</p>
                  </div>
                </div>
              )}
              {jdView.department?.fa && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 font-semibold mb-0.5">{lang === 'fa' ? 'واحد سازمانی' : 'Department'}</p>
                  <p className="text-sm text-gray-800">{lang === 'fa' ? jdView.department.fa : (jdView.department.en || jdView.department.fa)}</p>
                </div>
              )}
              {jdView.summary?.fa && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 font-semibold mb-1">{lang === 'fa' ? 'خلاصه شغل' : 'Summary'}</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{lang === 'fa' ? jdView.summary.fa : (jdView.summary.en || jdView.summary.fa)}</p>
                </div>
              )}
              {jdView.responsibilities?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-2">{lang === 'fa' ? 'مسئولیت‌های اصلی' : 'Responsibilities'}</p>
                  <ul className="space-y-1.5">
                    {jdView.responsibilities.map((r: any, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 shrink-0" />
                        {lang === 'fa' ? (r.fa || r) : (r.en || r.fa || r)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {jdView.kpis?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-2">{lang === 'fa' ? 'شاخص‌های عملکرد (KPIs)' : 'KPIs'}</p>
                  <ul className="space-y-1.5">
                    {jdView.kpis.map((k: any, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 shrink-0" />
                        {lang === 'fa' ? (k.fa || k) : (k.en || k.fa || k)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {jdView.compensation?.model?.fa && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 font-semibold mb-0.5">{lang === 'fa' ? 'مدل جبران خدمات' : 'Compensation'}</p>
                  <p className="text-sm text-gray-800">{lang === 'fa' ? jdView.compensation.model.fa : (jdView.compensation.model.en || jdView.compensation.model.fa)}</p>
                </div>
              )}
              {jdView.workingHours?.fa && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-xs text-gray-400 font-semibold mb-0.5">{lang === 'fa' ? 'ساعات کاری' : 'Working Hours'}</p>
                  <p className="text-sm text-gray-800">{lang === 'fa' ? jdView.workingHours.fa : (jdView.workingHours.en || jdView.workingHours.fa)}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowJobDescModal(false)} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                {lang === 'fa' ? 'بستن' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showInvoiceModal && selectedTicket && (
          <InvoiceModal customer={{ id: selectedTicket.customerName, fullName: selectedTicket.customerName, companyName: selectedTicket.companyName, location: selectedTicket.location, phoneNumber: selectedTicket.phoneNumber, whatsappNumber: selectedTicket.whatsappNumber, firstContact: '', totalTickets: 0 }} template={config.invoiceTemplate || { companyName: config.appTitle, address: '', phone: '', footerText: '', termsConditions: '', defaultTaxRate: 0, colorTheme: '#4f46e5' }} initialData={editingInvoice} onSave={handleSaveInvoice} onClose={() => setShowInvoiceModal(false)} />
      )}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl animate-fade-in overflow-hidden my-4">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm"><IconProject className="w-4 h-4" />{t.newProject}</h3>
              <button onClick={handleProjectModalClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            {createdProjectId ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><IconCheck className="w-7 h-7 text-gray-700" /></div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.successProject}</h3>
                <p className="text-gray-400 text-sm mb-6">{lang === 'fa' ? 'کد پروژه:' : 'Project Code:'}</p>
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-between gap-3 mb-6">
                  <span className="font-mono font-bold text-xl text-gray-900 tracking-wider">{createdProjectId}</span>
                  <button onClick={() => { navigator.clipboard.writeText(createdProjectId); alert(t.copyCode); }} className="bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-400 p-2 rounded-lg transition-colors"><IconCopy className="w-4 h-4" /></button>
                </div>
                <button onClick={handleProjectModalClose} className="w-full py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-black transition-colors">{t.understand}</button>
              </div>
            ) : (
              <form onSubmit={handleCreateProject} className="p-5 space-y-4">
                {/* Project title */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t.projectTitle} <span className="text-red-500">*</span></label>
                  <input required className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-800 text-sm" value={newProjectData.title} onChange={e => setNewProjectData({...newProjectData, title: e.target.value})} />
                </div>
                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t.projectCategory}</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-800 text-sm" placeholder={t.projectCategoryPh} value={newProjectData.category} onChange={e => setNewProjectData({...newProjectData, category: e.target.value})} list="project-category-list" />
                  <datalist id="project-category-list">
                    {[...new Set(tickets.filter(tk => tk.projectData?.category).map(tk => tk.projectData!.category!))].map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                {/* Service */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t.relatedService}</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-800 bg-white text-sm" value={newProjectData.serviceId} onChange={e => setNewProjectData({...newProjectData, serviceId: e.target.value})}>
                    <option value="">{lang === 'fa' ? '— بدون سرویس —' : '— No service —'}</option>
                    {services.map(s => <option key={s.id} value={s.id}>{lang === 'en' && s.titleEn ? s.titleEn : s.title}</option>)}
                  </select>
                </div>
                {/* Customer name + type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t.customer}
                      <span className="text-gray-400 text-[10px] font-normal mr-1">({lang === 'fa' ? 'اختیاری' : 'optional'})</span>
                    </label>
                    <input className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-800 text-sm" placeholder={lang === 'fa' ? 'مثال: پروژه داخلی' : 'e.g. Internal project'} value={newProjectData.customerName} onChange={e => setNewProjectData({...newProjectData, customerName: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.customerTypeLabel}</label>
                    <select className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-800 bg-white text-sm" value={newProjectData.customerType} onChange={e => setNewProjectData({...newProjectData, customerType: e.target.value as ProjectPartyType})}>
                      <option value="client">{t.partyTypeClient}</option>
                      <option value="partner">{t.partyTypePartner}</option>
                      <option value="supplier">{t.partyTypeSupplier}</option>
                      <option value="investor">{t.partyTypeInvestor}</option>
                      <option value="other">{t.partyTypeOther}</option>
                    </select>
                  </div>
                </div>
                {/* Phone */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t.phone}
                    <span className="text-gray-400 text-[10px] font-normal mr-1">({lang === 'fa' ? 'اختیاری' : 'optional'})</span>
                  </label>
                  <input dir="ltr" className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-800 text-sm text-right" value={newProjectData.phoneNumber} onChange={e => setNewProjectData({...newProjectData, phoneNumber: e.target.value})} />
                </div>
                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.startDate}</label>
                    <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-800 text-sm" value={newProjectData.startDate} onChange={e => setNewProjectData({...newProjectData, startDate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.endDate}</label>
                    <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-800 text-sm" value={newProjectData.endDate} onChange={e => setNewProjectData({...newProjectData, endDate: e.target.value})} />
                  </div>
                </div>
                {/* Contract amount + priority */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.contractAmount}</label>
                    <div className="flex gap-1">
                      <input className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-800 text-sm" placeholder="0" value={newProjectData.tariffAmount} onChange={e => setNewProjectData({...newProjectData, tariffAmount: formatNumberInput(e.target.value)})} />
                      <select className="px-2 py-2 rounded-lg border border-gray-200 bg-white text-sm" value={newProjectData.tariffCurrency} onChange={e => setNewProjectData({...newProjectData, tariffCurrency: e.target.value as Currency})}>
                        <option value="IRR">IRR</option><option value="USD">USD</option><option value="OMR">OMR</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.priority}</label>
                    <select className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-800 bg-white text-sm" value={newProjectData.priority} onChange={e => setNewProjectData({...newProjectData, priority: e.target.value as any})}>
                      <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={handleProjectModalClose} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">{t.cancel}</button>
                  <button type="submit" className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black">{t.create}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      
      <div className="w-full md:w-56 shrink-0 space-y-4">
         <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col items-center text-center sticky top-20">
            <div className="relative w-12 h-12 mb-3"><div className="w-full h-full rounded-full overflow-hidden border border-gray-200">{currentUser.avatar ? (<img src={currentUser.avatar} alt={currentUser.fullName} className="w-full h-full object-cover" />) : (<div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-500 text-base font-semibold">{currentUser.fullName.charAt(0)}</div>)}</div><div className="absolute bottom-0 right-0 bg-emerald-500 w-2.5 h-2.5 rounded-full border-2 border-white"></div></div>
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">{currentUser.fullName}</h3>
            <div className="flex flex-wrap justify-center gap-1 mt-1 mb-1">{(currentUser.roles || []).map((r, i) => (<span key={i} className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{r}</span>))}</div>
            {currentUser.jobDescription && (
              <button onClick={() => setShowJobDescModal(true)} className="text-[10px] text-gray-400 hover:text-gray-600 underline underline-offset-2 mb-1">
                {lang === 'fa' ? 'شرح شغل من' : 'My Job Description'}
              </button>
            )}
            {directManager && (<div className="text-[10px] text-gray-400 mb-3 inline-flex items-center gap-1"><IconLayout className="w-2.5 h-2.5" /> {directManager.fullName}</div>)}
            <div className="w-full space-y-1">
                <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'overview' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconActivity className="w-4 h-4 shrink-0" /><span>{t.overview}</span></button>
                {hasCustomerAccess && <button onClick={() => setActiveTab('customer_bank')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'customer_bank' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconUsers className="w-4 h-4 shrink-0" /><span>{lang === 'fa' ? 'بانک مشتریان' : 'Customer Bank'}</span></button>}
                {canManageInvoices && <button onClick={() => setActiveTab('invoices')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'invoices' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconInvoice className="w-4 h-4 shrink-0" /><span>Invoices</span></button>}
                {hasMetaShopAccess && <button onClick={() => setActiveTab('metashop')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'metashop' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconTag className="w-4 h-4 shrink-0" /><span>{lang === 'fa' ? 'متاشاپ' : 'Meta Shop'}</span></button>}
                <button onClick={() => setActiveTab('tasks')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all relative ${activeTab === 'tasks' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconList className="w-4 h-4 shrink-0" /><span>{t.tasks}</span>{pendingTasksCount > 0 && <span className="absolute rtl:left-2 ltr:right-2 bg-gray-900 text-white text-[9px] px-1 py-0.5 rounded-full">{pendingTasksCount}</span>}</button>
                <button onClick={() => setActiveTab('staff_reports')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'staff_reports' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconClipboard className="w-4 h-4 shrink-0" /><span>{t.staff_reports}</span></button>
                <button onClick={() => setActiveTab('meetings')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'meetings' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconCalendarClock className="w-4 h-4 shrink-0" /><span>{t.meetings}</span></button>
                <button onClick={() => setActiveTab('messages')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all relative ${activeTab === 'messages' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconMail className="w-4 h-4 shrink-0" /><span>{t.messages}</span>{unreadMessagesCount > 0 && <span className="absolute rtl:left-2 ltr:right-2 bg-gray-900 text-white text-[9px] px-1 py-0.5 rounded-full">{unreadMessagesCount}</span>}</button>
                <button onClick={() => setActiveTab('projects')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'projects' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconProject className="w-4 h-4 shrink-0" /><span>{t.projects}</span></button>
                <button onClick={() => setActiveTab('forms')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'forms' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconClipboard className="w-4 h-4 shrink-0" /><span>{t.forms}</span></button>
                <button onClick={() => setActiveTab('processes')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'processes' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconMindMap className="w-4 h-4 shrink-0" /><span>{lang === 'fa' ? 'مایند مپ' : 'Mind Map'}</span></button>
                <button onClick={() => setActiveTab('sales')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'sales' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconMoney className="w-4 h-4 shrink-0" /><span>{t.sales}</span></button>
                {(isAdmin || isMaster) && (<button onClick={() => setActiveTab('expenses')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'expenses' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconWallet className="w-4 h-4 shrink-0" /><span>{t.expenses}</span></button>)}
                {hasTariffAccess && (<button onClick={() => setActiveTab('services')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'services' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconBriefcase className="w-4 h-4 shrink-0" /><span>{t.services}</span></button>)}
                {(isAdmin || isMaster) && (<><div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-300 uppercase tracking-wider mt-1 border-t border-gray-100">Admin</div><button onClick={() => setActiveTab('personnel')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'personnel' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconShield className="w-4 h-4 shrink-0" /><span>{t.personnel}</span></button><button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'settings' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconSettings className="w-4 h-4 shrink-0" /><span>{t.settings}</span></button></>)}
                {isMaster && (<><button onClick={() => setActiveTab('notifications')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'notifications' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconWhatsapp className="w-4 h-4 shrink-0" /><span>{lang === 'fa' ? 'نوتیفیکیشن' : 'WhatsApp'}</span></button><button onClick={() => setActiveTab('logs')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'logs' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconHistory className="w-4 h-4 shrink-0" /><span>{t.logs}</span></button><button onClick={() => setActiveTab('reports')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'reports' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconBarChart2 className="w-4 h-4 shrink-0" /><span>{t.reports}</span></button><button onClick={() => setActiveTab('kpi')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'kpi' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconTarget className="w-4 h-4 shrink-0" /><span>{t.kpi}</span></button><button onClick={() => setActiveTab('analytics')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'analytics' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconAnalytics className="w-4 h-4 shrink-0" /><span>{lang === 'fa' ? 'آمار بازدید' : 'Analytics'}</span></button><button onClick={() => setActiveTab('news_mgmt')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'news_mgmt' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconNewspaper className="w-4 h-4 shrink-0" /><span>{t.news_mgmt}</span></button><button onClick={() => setActiveTab('seo')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'seo' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconGlobe className="w-4 h-4 shrink-0" /><span>{t.seo}</span></button><button onClick={() => setActiveTab('customer_accounts')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'customer_accounts' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><IconUsers className="w-4 h-4 shrink-0" /><span>پنل مشتریان</span></button></>)}
            </div>
            <button onClick={onLogout} className="w-full text-xs font-medium text-gray-400 hover:text-gray-700 border border-gray-100 hover:border-gray-300 py-2 rounded-lg transition-colors mt-4">{t.logout}</button>
        </div>
      </div>

      <div className="flex-grow">
        {activeTab === 'expenses' && (isAdmin || isMaster) && <ExpenseManager currentUser={currentUser} personnel={personnel} lang={lang} />}
        {activeTab === 'staff_reports' && <ReportManager currentUser={currentUser} personnel={personnel} lang={lang} config={config} />}
        {activeTab === 'customer_bank' && hasCustomerAccess && <CustomerBank customers={customers} tickets={tickets} services={services} currentUser={currentUser} onUpdate={onUpdateCustomers} onEdit={onEditCustomer} onDelete={onDeleteCustomer} lang={lang} />}
        {activeTab === 'invoices' && canManageInvoices && onSaveInvoice && onDeleteInvoice && (
          <InvoiceManager invoices={invoices} customers={customers} config={config} currentUser={currentUser} lang={lang} onSaveInvoice={onSaveInvoice} onDeleteInvoice={onDeleteInvoice} onUpdateConfig={onUpdateConfig} readonly={!canEditInvoices} />
        )}
        {activeTab === 'metashop' && hasMetaShopAccess && onSaveMetaShop && onDeleteMetaShop && onUpdateMetaShopOrder && (
          <MetaShopManager metaShops={metaShops} metaShopOrders={metaShopOrders} personnel={personnel} config={config} lang={lang} shopBaseUrl={shopBaseUrl} onSaveMetaShop={onSaveMetaShop} onDeleteMetaShop={onDeleteMetaShop} onUpdateMetaShopOrder={onUpdateMetaShopOrder} metaBazaars={metaBazaars} onSaveMetaBazaar={onSaveMetaBazaar} onDeleteMetaBazaar={onDeleteMetaBazaar} readonly={!canEditMetaShopPanel} canDelete={canDeleteMetaShopPanel} canDeleteBooths={canDeleteBoothsInMetaShop} />
        )}
        {activeTab === 'processes' && onSaveProcess && onDeleteProcess && (
          <ProcessManager processes={processes} personnel={personnel} currentUser={currentUser} onSave={onSaveProcess} onDelete={onDeleteProcess} lang={lang} />
        )}
        {activeTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">


                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                     <div className="bg-white p-4 rounded-xl border border-gray-100"><div className="text-gray-400 text-xs mb-1">{t.myTasks}</div><div className="text-2xl font-bold text-gray-900">{myTasksCount}</div></div>
                     <div className="bg-white p-4 rounded-xl border border-gray-100"><div className="text-gray-400 text-xs mb-1">{t.allRequests}</div><div className="text-2xl font-bold text-gray-900">{tickets.filter(t => t.status !== 'تکمیل شده' && t.status !== 'لغو شده').length}</div></div>
                     <div className="bg-white p-4 rounded-xl border border-gray-100"><div className="text-gray-400 text-xs mb-1">{t.activeProjects}</div><div className="text-2xl font-bold text-gray-900">{activeProjectsList.length}</div></div>
                     <div className="bg-white p-4 rounded-xl border border-gray-100"><div className="text-gray-400 text-xs mb-1">{t.newMessages}</div><div className="text-2xl font-bold text-gray-900">{unreadMessagesCount}</div></div>
                 </div>

                 <div className="bg-white p-5 rounded-xl border border-gray-100 animate-fade-in">
                     <div className="flex items-center gap-3 mb-4">
                         <div className="p-1.5 bg-gray-900 text-white rounded-lg"><IconClipboard className="w-4 h-4" /></div>
                         <h3 className="font-semibold text-gray-900 text-sm">{t.quickReport}</h3>
                     </div>
                     
                     <div className="space-y-3 mb-4">
                         {quickReportItems.map((item, idx) => (
                             <div key={idx} className="flex items-center justify-between bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 group animate-slide-in">
                                 <div className="flex items-center gap-3">
                                     <span className="w-5 h-5 rounded-full bg-white border border-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-400">{idx+1}</span>
                                     <span className="text-sm text-gray-700">{item}</span>
                                 </div>
                                 <button onClick={() => setQuickReportItems(quickReportItems.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><IconTrash className="w-4 h-4" /></button>
                             </div>
                         ))}
                     </div>

                     <div className="flex gap-2">
                         <input 
                            className="flex-grow px-4 py-2.5 bg-gray-50 border border-transparent focus:bg-white focus:border-gray-800 rounded-lg text-sm outline-none transition-all"
                            placeholder={t.quickReportHint}
                            value={quickReportText}
                            onChange={e => setQuickReportText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleQuickReportAdd())}
                         />
                         <button onClick={handleQuickReportAdd} className="bg-gray-900 text-white px-4 rounded-lg hover:bg-black transition-colors">
                             <IconPlus className="w-4 h-4" />
                         </button>
                     </div>

                     {quickReportItems.length > 0 && (
                         <div className="mt-4 flex justify-end">
                             <button 
                                onClick={handleSubmitQuickReport}
                                disabled={isSavingQuickReport}
                                className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-black flex items-center gap-2"
                             >
                                 {isSavingQuickReport ? '...' : <><IconCheck className="w-4 h-4" /> {t.submitQuick}</>}
                             </button>
                         </div>
                     )}
                 </div>

                 {userKPIs.length > 0 && (
                     <div className="bg-white border border-gray-100 rounded-xl p-5">
                         <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-4"><IconTarget className="w-4 h-4" /> {t.kpiWidget}</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             {userKPIs.map(k => {
                                 const progress = Math.min(100, Math.round((k.currentValue / k.targetValue) * 100));
                                 return (
                                     <div key={k.id} className="bg-white p-4 rounded-xl border border-pink-100 shadow-sm">
                                         <div className="flex justify-between items-center mb-1">
                                             <span className="text-sm font-bold text-gray-800">{k.title}</span>
                                             <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{k.period}</span>
                                         </div>
                                         <div className="text-xs text-gray-500 mb-2">{k.currentValue} / {k.targetValue} {k.unit}</div>
                                         <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                             <div className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : progress >= 70 ? 'bg-blue-500' : 'bg-pink-500'}`} style={{ width: `${progress}%` }}></div>
                                         </div>
                                     </div>
                                 );
                             })}
                         </div>
                     </div>
                 )}
                 {myPendingTasks.length > 0 && (
                     <div className="bg-white border border-gray-100 rounded-xl p-5">
                         <div className="flex justify-between items-center mb-4"><h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><IconList className="w-4 h-4 text-gray-500" /> {t.pendingTasks} ({myPendingTasks.length})</h3><button onClick={() => setActiveTab('tasks')} className="text-gray-400 hover:text-gray-700 text-xs">{t.viewAll}</button></div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{myPendingTasks.slice(0, 4).map(task => (<div key={task.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center"><div><div className="font-medium text-gray-800 text-sm mb-1">{task.title}</div><div className="text-xs text-gray-400 flex items-center gap-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${task.priority === 'High' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>{task.priority}</span><span>{task.creatorName}</span></div></div><button onClick={() => setActiveTab('tasks')} className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-black">{t.doTask}</button></div>))}</div>
                     </div>
                 )}
                 <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                     <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                         <div className="flex gap-2">
                             <div className="flex bg-gray-100 p-1 rounded-lg">
                                 {canViewAllTickets && <button onClick={() => setFilterMode('all')} className={`px-3 py-1.5 rounded-md text-sm transition-all ${filterMode === 'all' ? 'bg-white shadow text-gray-900 font-semibold' : 'text-gray-500'}`}>{t.allCompany}</button>}
                                 <button onClick={() => setFilterMode('my')} className={`px-3 py-1.5 rounded-md text-sm transition-all ${filterMode === 'my' ? 'bg-white shadow text-gray-900 font-semibold' : 'text-gray-500'}`}>{t.myCartable}</button>
                                 <button onClick={() => setFilterMode('history')} className={`px-3 py-1.5 rounded-md text-sm transition-all ${filterMode === 'history' ? 'bg-white shadow text-gray-900 font-semibold' : 'text-gray-500'}`}>{t.history}</button>
                             </div>
                             <select className="bg-gray-100 text-gray-600 text-sm font-bold px-3 py-1.5 rounded-lg border-transparent focus:border-gray-300 outline-none" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}><option value="all">{t.allStatuses}</option>{Object.values(TicketStatus).map(s => <option key={s} value={s}>{s}</option>)}</select>
                         </div>
                         <div className="flex flex-wrap gap-2 items-center">
                             <button onClick={() => setShowFlaggedOnly(v => !v)} title="فقط پرونده‌های فلگ‌شده" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${showFlaggedOnly ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200'}`}>
                                 <IconStar className={`w-3.5 h-3.5 ${showFlaggedOnly ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                 مهم
                             </button>
                             {(config.labels || []).map(lbl => {
                                 const colors: Record<string,string> = { red:'bg-red-100 text-red-700 border-red-300', orange:'bg-orange-100 text-orange-700 border-orange-300', yellow:'bg-yellow-100 text-yellow-700 border-yellow-300', green:'bg-green-100 text-green-700 border-green-300', blue:'bg-blue-100 text-blue-700 border-blue-300', purple:'bg-purple-100 text-purple-700 border-purple-300', pink:'bg-pink-100 text-pink-700 border-pink-300', gray:'bg-gray-100 text-gray-600 border-gray-300' };
                                 const active = labelFilter === lbl.id;
                                 return <button key={lbl.id} onClick={() => setLabelFilter(active ? null : lbl.id)} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${active ? colors[lbl.color] || colors.gray : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}><IconTag className="w-3 h-3" />{lbl.name}</button>;
                             })}
                             {isMaster && <button onClick={() => setShowLabelManager(true)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200 transition-all"><IconPlus className="w-3 h-3" />مدیریت لیبل‌ها</button>}
                         </div>
                         <div className="relative w-full md:w-64">
                             <input type="text" className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-gray-300" placeholder={t.searchPlaceholder} value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} />
                             <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                         </div>
                     </div>
                     {selectedTicketIds.size > 0 && (
                         <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl animate-fade-in">
                             <span className="text-sm font-bold text-indigo-700">{selectedTicketIds.size} {t.bulkSelected}</span>
                             <select value={bulkStatusValue} onChange={(e) => { const v = e.target.value; setBulkStatusValue(v); if (v) handleBulkStatusChange(v as TicketStatus); }} className="bg-white text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg border border-indigo-200 outline-none focus:border-indigo-400">
                                 <option value="">{t.bulkStatusPh}</option>
                                 {Object.values(TicketStatus).map(s => <option key={s} value={s}>{s}</option>)}
                             </select>
                             {canAssign && (
                                 <select value={bulkAssignValue} onChange={(e) => { const v = e.target.value; if (!v) return; setBulkAssignValue(v); handleBulkAssign(v === '__unassign__' ? '' : v); }} className="bg-white text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg border border-indigo-200 outline-none focus:border-indigo-400">
                                     <option value="">{t.bulkAssignPh}</option>
                                     <option value="__unassign__">{t.notAssigned}</option>
                                     {personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}{p.roles[0] ? ` - ${p.roles[0]}` : ''}</option>)}
                                 </select>
                             )}
                             <button onClick={clearSelection} className="text-sm text-gray-500 hover:text-gray-700 mr-auto flex items-center gap-1"><span className="text-base leading-none">✕</span>{t.bulkClear}</button>
                         </div>
                     )}
                     {(() => { const pageIds = paginatedTickets.map(pt => pt.id); const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedTicketIds.has(id)); return (
                     <div className="overflow-x-auto"><table className="w-full text-start"><thead className="bg-gray-50 text-gray-500 text-sm"><tr><th className="px-3 py-3 rounded-tr-lg text-center w-10"><input type="checkbox" className="w-4 h-4 cursor-pointer accent-indigo-600" checked={allPageSelected} onChange={() => setSelectedTicketIds(prev => { const n = new Set(prev); if (allPageSelected) pageIds.forEach(id => n.delete(id)); else pageIds.forEach(id => n.add(id)); return n; })} title={t.selectAll} /></th><th className="px-4 py-3 text-center w-12">{t.row}</th><th className="px-4 py-3">{t.code}</th><th className="px-4 py-3">{t.service}</th><th className="px-4 py-3">{t.status}</th><th className="px-4 py-3">{t.expert}</th><th className="px-4 py-3 text-center rounded-tl-lg">{t.action}</th></tr></thead><tbody className="divide-y divide-gray-100">{paginatedTickets.map((ticket, idx) => (
                        <tr key={ticket.id} className={`hover:bg-gray-50 transition-colors ${selectedTicketIds.has(ticket.id) ? 'bg-indigo-50/60' : isFlaggedOf(ticket) ? 'bg-yellow-50/40' : ''}`}>
                            <td className="px-3 py-3 text-center">
                                <input type="checkbox" className="w-4 h-4 cursor-pointer accent-indigo-600" checked={selectedTicketIds.has(ticket.id)} onChange={() => toggleTicketSelection(ticket.id)} />
                            </td>
                            <td className="px-4 py-3 text-center text-xs font-bold text-gray-400">
                                {filteredTickets.length - ((currentPage - 1) * ITEMS_PER_PAGE + idx)}
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                        <button type="button" onClick={e => { e.stopPropagation(); toggleFlag(ticket); }} title={isFlaggedOf(ticket) ? 'حذف فلگ' : 'فلگ کردن'} className="flex-shrink-0">
                                            <IconStar className={`w-4 h-4 transition-colors ${isFlaggedOf(ticket) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`} />
                                        </button>
                                        <span className="font-mono text-[10px] text-gray-400">{ticket.id}</span>
                                    </div>
                                    <span className="font-bold text-gray-800 text-sm mt-0.5" title={ticket.customerName}>{ticket.customerName}</span>
                                    {ticket.companyName && (
                                        <span className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded w-fit mt-0.5 border border-gray-100 flex items-center gap-1">
                                           <IconBriefcase className="w-3 h-3" /> {ticket.companyName}
                                        </span>
                                    )}
                                    {(ticket.labelIds || []).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {(ticket.labelIds || []).map(lid => {
                                                const lbl = (config.labels || []).find(l => l.id === lid);
                                                if (!lbl) return null;
                                                const colors: Record<string,string> = { red:'bg-red-100 text-red-700', orange:'bg-orange-100 text-orange-700', yellow:'bg-yellow-100 text-yellow-700', green:'bg-green-100 text-green-700', blue:'bg-blue-100 text-blue-700', purple:'bg-purple-100 text-purple-700', pink:'bg-pink-100 text-pink-700', gray:'bg-gray-100 text-gray-600' };
                                                return <span key={lid} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[lbl.color] || colors.gray}`}><IconTag className="w-2.5 h-2.5" />{lbl.name}</span>;
                                            })}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-700">{getServiceTitle(ticket.serviceId)}</div>
                                <div className="text-[10px] text-gray-400 dir-ltr">{new Date(ticket.createdAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                            </td>
                            <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${getStatusBadge(ticket.status)}`}>{ticket.status}</span></td>
                            <td className="px-4 py-3">
                                {getAssigneeName(ticket.assignedTo) ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                        {getAssigneeName(ticket.assignedTo)}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">
                                        {t.notAssigned}
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-3 text-center"><button onClick={() => setSelectedTicketId(ticket.id)} className="bg-gray-900 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-black transition-colors">{t.check}</button></td>
                        </tr>
                     ))}</tbody></table>{paginatedTickets.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">{t.notFound}</div>}</div>
                     ); })()}
                     {totalPages > 1 && (
                        <div className="flex justify-center items-center p-4 border-t border-gray-100 gap-4">
                            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-bold">{t.prev}</button>
                            <span className="text-sm text-gray-600 font-medium">{currentPage} / {totalPages}</span>
                            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-bold">{t.next}</button>
                        </div>
                     )}
                 </div>
            </div>
        )}
        {activeTab === 'projects' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <div className="bg-gray-100 text-gray-600 p-1.5 rounded-lg"><IconProject className="w-4 h-4" /></div>
                        {t.projectDashboard}
                    </h2>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setProjectSubTab('active')} className={`px-3 py-1.5 rounded-md text-sm transition-all flex items-center gap-1.5 ${projectSubTab === 'active' ? 'bg-white shadow text-gray-900 font-semibold' : 'text-gray-500'}`}>
                                <IconActivity className="w-3.5 h-3.5" /> {t.activeProjects}
                            </button>
                            <button onClick={() => setProjectSubTab('history')} className={`px-3 py-1.5 rounded-md text-sm transition-all flex items-center gap-1.5 ${projectSubTab === 'history' ? 'bg-white shadow text-gray-900 font-semibold' : 'text-gray-500'}`}>
                                <IconHistory className="w-3.5 h-3.5" /> {t.projectHistory}
                            </button>
                        </div>
                        <button onClick={() => setShowNewProjectModal(true)} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black flex items-center gap-2">
                            <IconPlus className="w-4 h-4" /> {t.newProject}
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-4 w-12 text-center">{t.row}</th>
                                    <th className="px-4 py-4">{t.customer}</th>
                                    <th className="px-4 py-4">{t.projectCategory}</th>
                                    <th className="px-4 py-4">{t.partiesTitle}</th>
                                    <th className="px-4 py-4">{t.service}</th>
                                    <th className="px-4 py-4">{t.progress}</th>
                                    <th className="px-4 py-4">{t.status}</th>
                                    <th className="px-4 py-4 text-center">{t.action}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {currentProjectDisplayList.map((project, idx) => (
                                    <tr key={project.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-4 py-4 text-center text-xs font-bold text-gray-400">{idx + 1}</td>
                                        <td className="px-4 py-4">
                                            <div className="font-bold text-gray-900">{project.customerName}</div>
                                            <div className="text-[10px] text-gray-400 font-mono">#{project.id}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {project.projectData?.category ? (
                                                <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                    {project.projectData.category}
                                                </span>
                                            ) : <span className="text-gray-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-4">
                                            {(project.projectData?.parties || []).length > 0 ? (
                                                <div className="flex flex-col gap-0.5">
                                                    {(project.projectData?.parties || []).slice(0, 2).map(p => (
                                                        <div key={p.id} className="flex items-center gap-1">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${p.type === 'client' ? 'bg-blue-400' : p.type === 'partner' ? 'bg-emerald-400' : p.type === 'supplier' ? 'bg-amber-400' : 'bg-gray-400'}`} />
                                                            <span className="text-xs text-gray-700">{p.name}</span>
                                                            <span className="text-[10px] text-gray-400">{p.profitSharePercent}%</span>
                                                        </div>
                                                    ))}
                                                    {(project.projectData?.parties || []).length > 2 && (
                                                        <span className="text-[10px] text-gray-400">+{(project.projectData?.parties?.length || 0) - 2} {lang === 'fa' ? 'نفر دیگر' : 'more'}</span>
                                                    )}
                                                </div>
                                            ) : <span className="text-gray-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-gray-700">{getServiceTitle(project.serviceId)}</div>
                                            <div className={`inline-flex items-center gap-1 text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded ${getPriorityBadge(project.priority || 'Medium').bg} ${getPriorityBadge(project.priority || 'Medium').text}`}>
                                                <IconFlag className="w-2.5 h-2.5" /> {project.priority}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="w-full max-w-[100px]">
                                                <div className="flex justify-between text-[10px] text-gray-500 mb-1 font-bold">
                                                    <span>{project.projectData?.progress}%</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-gray-800 h-full rounded-full transition-all duration-500" style={{ width: `${project.projectData?.progress}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 rounded-[6px] text-[10px] font-bold ${getStatusBadge(project.status)}`}>
                                                {project.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <button onClick={() => setSelectedTicketId(project.id)} className="bg-gray-100 text-gray-700 hover:bg-gray-900 hover:text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-all">
                                                {t.view}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {currentProjectDisplayList.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="py-20 text-center text-gray-400 bg-white italic">
                                            <IconProject className="w-12 h-12 mx-auto mb-3 opacity-10" />
                                            {t.notFound}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
        {activeTab === 'forms' && (
            <FormBuilderPanel
                customForms={customForms}
                currentUser={currentUser}
                isMaster={isMaster}
                isAdmin={isAdmin}
                lang={lang}
                personnel={personnel}
                tickets={tickets}
                services={services}
                formFields={config.formFields}
                requestExternalUrl={config.requestExternalUrl}
                onUpdateRequestUrl={(url) => onUpdateConfig({ ...config, requestExternalUrl: url })}
            />
        )}
        {activeTab === 'sales' && <SalesDashboard currentUser={currentUser} personnel={personnel} services={services} onUpdatePersonnel={onUpdatePersonnel} onUpdateServices={onUpdateServices} lang={lang} />}
        {activeTab === 'messages' && <InternalMessenger
            currentUser={currentUser} personnel={personnel} messages={messages} lang={lang} departments={config.departments || []}
            onAfterSend={async (recipientIds, senderName, subject) => {
              const nc = config.notificationConfig;
              if (!nc?.enabled || !nc.onNewMessage) return;
              for (const rid of recipientIds) {
                const phone = nc.personnelPhones[rid];
                if (!phone) continue;
                const recipient = personnel.find(p => p.id === rid);
                if (!recipient) continue;
                const msg = renderTemplate(nc.messageTemplate, {
                  recipientName: recipient.fullName,
                  senderName,
                  ticketId: subject,
                  customerName: senderName,
                  formTitle: subject,
                  status: '',
                });
                const result = await sendWhatsAppNotification(phone, msg, nc, nc.personnelApiKeys[rid]);
                await saveNotificationLog(buildLog('new_message', rid, recipient.fullName, phone, msg, result));
                await sendMasterCopy({ config: nc, personnel, message: msg, originalRecipientId: rid, originalRecipientName: recipient.fullName, logType: 'new_message', saveLog: saveNotificationLog });
              }
            }}
          />}
        {activeTab === 'tasks' && <TaskManager currentUser={currentUser} personnel={personnel} tasks={tasks} lang={lang} />}
        {activeTab === 'meetings' && <MeetingCalendar meetings={meetings} currentUser={currentUser} personnel={personnel} lang={lang} notificationConfig={config.notificationConfig} />}
        {activeTab === 'services' && hasTariffAccess && <ServiceManager services={services} onUpdate={onUpdateServices} readonly={!isAdmin && !isMaster} lang={lang} config={config} />}
        {activeTab === 'personnel' && (isAdmin || isMaster) && <PersonnelManager personnel={personnel} config={config} onUpdate={onUpdatePersonnel} onUpdateConfig={onUpdateConfig} lang={lang} />}
        {activeTab === 'settings' && (isAdmin || isMaster) && <SettingsManager config={config} personnel={personnel} onUpdate={onUpdateConfig} isMaster={isMaster} />}
        {activeTab === 'notifications' && isMaster && <NotificationCenter config={config} personnel={personnel} onUpdateConfig={onUpdateConfig} lang={lang} />}
        {activeTab === 'reports' && isMaster && <PerformanceReports personnel={personnel} tickets={tickets} tasks={tasks} lang={lang} />}
        {activeTab === 'kpi' && isMaster && <KPIManager kpis={kpis} personnel={personnel} lang={lang} />}

        {activeTab === 'analytics' && isMaster && (
          <AnalyticsDashboard events={analyticsEvents} lang={lang} />
        )}

        {activeTab === 'news_mgmt' && isMaster && (
          <div className="animate-fade-in">
            <NewsManager articles={news} />
          </div>
        )}

        {activeTab === 'seo' && isMaster && (
          <div className="animate-fade-in space-y-4 max-w-2xl">
            <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-100">{t.seo}</p>

              {/* Favicon Upload */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">فاوآیکون سایت</label>
                <div className="flex items-center gap-3">
                  {/* Preview */}
                  <div className="w-12 h-12 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                    {seoForm.favicon
                      ? <img src={seoForm.favicon} alt="favicon" className="w-8 h-8 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      : <span className="text-xs text-gray-300">ICO</span>
                    }
                  </div>
                  {/* Upload button */}
                  <div className="flex-1">
                    <button
                      type="button"
                      disabled={faviconUploading}
                      onClick={() => faviconInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                      <IconUpload className="w-4 h-4" />
                      {faviconUploading ? `در حال آپلود... ${faviconProgress}%` : 'آپلود فاوآیکون (ICO / PNG / SVG)'}
                    </button>
                    {faviconUploading && (
                      <div className="mt-1.5 w-full bg-gray-100 rounded-full h-1">
                        <div className="bg-gray-800 h-1 rounded-full transition-all" style={{ width: `${faviconProgress}%` }} />
                      </div>
                    )}
                    {seoForm.favicon && !faviconUploading && (
                      <p className="text-[11px] text-emerald-600 mt-1">فاوآیکون آپلود شده و فعال است</p>
                    )}
                  </div>
                </div>
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept=".ico,.png,.svg,.jpg,.jpeg,image/x-icon,image/png,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1 * 1024 * 1024) { alert('فایل نباید بیشتر از ۱ مگابایت باشد.'); return; }
                    setFaviconUploading(true);
                    setFaviconProgress(0);
                    uploadFileWithProgress(
                      file,
                      (p) => setFaviconProgress(p),
                      (url) => { setSeoForm(prev => ({ ...prev, favicon: url })); setFaviconUploading(false); },
                      (err) => { alert('خطا در آپلود: ' + err.message); setFaviconUploading(false); },
                      'images'
                    );
                    if (faviconInputRef.current) faviconInputRef.current.value = '';
                  }}
                />
              </div>

              {/* Hero Background Image */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">تصویر پس‌زمینه صفحه اصلی</label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-14 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden shrink-0">
                    {config.heroBgImage
                      ? <img src={config.heroBgImage} alt="hero bg" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-300">بدون تصویر</div>
                    }
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <button
                      type="button"
                      disabled={heroBgUploading}
                      onClick={() => heroBgInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 w-full justify-center"
                    >
                      <IconUpload className="w-4 h-4" />
                      {heroBgUploading ? `در حال آپلود... ${heroBgProgress}%` : 'آپلود تصویر (JPG / PNG / WebP)'}
                    </button>
                    {heroBgUploading && (
                      <div className="w-full bg-gray-100 rounded-full h-1">
                        <div className="bg-gray-800 h-1 rounded-full transition-all" style={{ width: `${heroBgProgress}%` }} />
                      </div>
                    )}
                    {config.heroBgImage && !heroBgUploading && (
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-emerald-600">تصویر فعال است — با overlay سفید ۸۰٪ نمایش داده می‌شود</p>
                        <button type="button" onClick={() => onUpdateConfig({ ...config, heroBgImage: '' })} className="text-[11px] text-red-400 hover:text-red-600">حذف</button>
                      </div>
                    )}
                  </div>
                </div>
                <input
                  ref={heroBgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) { alert('فایل نباید بیشتر از ۵ مگابایت باشد.'); return; }
                    setHeroBgUploading(true);
                    setHeroBgProgress(0);
                    uploadFileWithProgress(
                      file,
                      (p) => setHeroBgProgress(p),
                      (url) => { onUpdateConfig({ ...config, heroBgImage: url }); setHeroBgUploading(false); },
                      (err) => { alert('خطا در آپلود: ' + err.message); setHeroBgUploading(false); },
                      'images'
                    );
                    if (heroBgInputRef.current) heroBgInputRef.current.value = '';
                  }}
                />
              </div>

              {/* SEO Title */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t.seoTitle}</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" value={seoForm.seoTitle} onChange={e => setSeoForm(p => ({ ...p, seoTitle: e.target.value }))} placeholder="پلتفرم جامع صادراتی توحید دیهمی" />
              </div>

              {/* Meta Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t.seoDesc} <span className="text-gray-400">({seoForm.seoDescription.length}/160)</span></label>
                <textarea className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" rows={3} maxLength={160} value={seoForm.seoDescription} onChange={e => setSeoForm(p => ({ ...p, seoDescription: e.target.value }))} placeholder="توضیحات سایت برای موتورهای جستجو..." />
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t.seoKeywords}</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" value={seoForm.seoKeywords} onChange={e => setSeoForm(p => ({ ...p, seoKeywords: e.target.value }))} placeholder="صادرات، بازرگانی، مشاوره صادرات، عمان" />
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-100">Open Graph (Social Media Preview)</p>

              {/* OG Title */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t.ogTitle}</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" value={seoForm.ogTitle} onChange={e => setSeoForm(p => ({ ...p, ogTitle: e.target.value }))} placeholder="عنوان نمایش در شبکه‌های اجتماعی" />
              </div>

              {/* OG Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t.ogDesc}</label>
                <textarea className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" rows={2} value={seoForm.ogDescription} onChange={e => setSeoForm(p => ({ ...p, ogDescription: e.target.value }))} placeholder="توضیحات در شبکه‌های اجتماعی..." />
              </div>

              {/* OG Image */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t.ogImage}</label>
                <input dir="ltr" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" value={seoForm.ogImage} onChange={e => setSeoForm(p => ({ ...p, ogImage: e.target.value }))} placeholder="https://yourdomain.com/og-image.jpg" />
              </div>
            </div>

            {/* MetaPort Link */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <IconPort className="w-4 h-4 text-gray-500" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tohid Meta Port — لینک هایپر</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">آدرس لینک (URL)</label>
                <input
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                  value={seoForm.metaPortUrl || ''}
                  onChange={e => setSeoForm(p => ({ ...p, metaPortUrl: e.target.value }))}
                  placeholder="https://metaport.example.com"
                />
                <p className="text-[11px] text-gray-400 mt-1">این لینک در نوار ناوبار سایت نمایش داده می‌شود و در تب جدید باز می‌شود.</p>
              </div>
            </div>

            <button
              onClick={() => onUpdateConfig({ ...config, ...seoForm })}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-black transition-colors"
            >
              <IconCheck className="w-4 h-4" /> {t.saveSeo}
            </button>
          </div>
        )}

        {activeTab === 'logs' && isMaster && (() => {
          // ── computed filters ──
          const allActors = [...new Set(systemLogs.map(l => l.actorName))].sort();
          const allEntities = [...new Set(systemLogs.map(l => l.entity))].sort();

          const filteredLogs = systemLogs.filter(log => {
            if (logActionFilter !== 'all' && log.actionType !== logActionFilter) return false;
            if (logEntityFilter !== 'all' && log.entity !== logEntityFilter) return false;
            if (logActorFilter !== 'all' && log.actorName !== logActorFilter) return false;
            if (logDateFrom && log.timestamp < logDateFrom) return false;
            if (logDateTo && log.timestamp > logDateTo + 'T23:59:59') return false;
            if (logSearch) {
              const q = logSearch.toLowerCase();
              if (
                !log.actorName.toLowerCase().includes(q) &&
                !log.entity.toLowerCase().includes(q) &&
                !log.details.toLowerCase().includes(q) &&
                !(log.entityId || '').toLowerCase().includes(q)
              ) return false;
            }
            return true;
          });

          const totalPages = Math.ceil(filteredLogs.length / LOG_PAGE_SIZE);
          const pagedLogs = filteredLogs.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE);

          // ── report stats ──
          const totalCreate = systemLogs.filter(l => l.actionType === 'CREATE').length;
          const totalUpdate = systemLogs.filter(l => l.actionType === 'UPDATE').length;
          const totalDelete = systemLogs.filter(l => l.actionType === 'DELETE').length;
          const totalLogin  = systemLogs.filter(l => l.actionType === 'LOGIN').length;

          const actorStats = allActors.map(actor => {
            const actorLogs = systemLogs.filter(l => l.actorName === actor);
            return {
              name: actor,
              total: actorLogs.length,
              create: actorLogs.filter(l => l.actionType === 'CREATE').length,
              update: actorLogs.filter(l => l.actionType === 'UPDATE').length,
              delete: actorLogs.filter(l => l.actionType === 'DELETE').length,
              login:  actorLogs.filter(l => l.actionType === 'LOGIN').length,
              lastSeen: actorLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.timestamp || '',
            };
          }).sort((a, b) => b.total - a.total);

          const entityStats = allEntities.map(entity => ({
            entity,
            count: systemLogs.filter(l => l.entity === entity).length,
          })).sort((a, b) => b.count - a.count);

          // last 7 days activity
          const last7 = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toISOString().split('T')[0];
            return { date: dateStr, count: systemLogs.filter(l => l.timestamp.startsWith(dateStr)).length };
          });
          const maxDay = Math.max(1, ...last7.map(d => d.count));

          const actionBadge = (type: string) => {
            if (type === 'DELETE') return 'bg-red-50 text-red-600 border border-red-100';
            if (type === 'CREATE') return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
            if (type === 'UPDATE') return 'bg-gray-100 text-gray-600 border border-gray-200';
            if (type === 'LOGIN')  return 'bg-gray-900 text-white';
            return 'bg-gray-50 text-gray-500 border border-gray-100';
          };

          return (
            <div className="space-y-4 animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <IconHistory className="w-4 h-4 text-gray-500" /> {t.auditLogs}
                  <span className="text-xs font-normal text-gray-400 mr-1">({systemLogs.length} رویداد)</span>
                </h2>
                <div className="flex gap-2">
                  <button onClick={() => setLogView('table')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${logView === 'table' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    جدول لاگ‌ها
                  </button>
                  <button onClick={() => setLogView('report')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${logView === 'report' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    گزارش تحلیلی
                  </button>
                </div>
              </div>

              {logView === 'report' ? (
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'ایجاد شده', value: totalCreate, color: 'text-emerald-700' },
                      { label: 'ویرایش شده', value: totalUpdate, color: 'text-gray-700' },
                      { label: 'حذف شده',   value: totalDelete, color: 'text-red-600' },
                      { label: 'ورود به سیستم', value: totalLogin, color: 'text-gray-900' },
                    ].map(s => (
                      <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
                        <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                        <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Last 7 days bar chart */}
                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">فعالیت ۷ روز گذشته</p>
                    <div className="flex items-end gap-2 h-24">
                      {last7.map(d => (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-gray-400">{d.count || ''}</span>
                          <div className="w-full bg-gray-100 rounded-sm overflow-hidden" style={{ height: '60px' }}>
                            <div className="w-full bg-gray-800 rounded-sm transition-all" style={{ height: `${(d.count / maxDay) * 60}px`, marginTop: `${60 - (d.count / maxDay) * 60}px` }} />
                          </div>
                          <span className="text-[9px] text-gray-400 dir-ltr">{d.date.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Activity per person */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">فعالیت پرسنل</p>
                      <div className="space-y-3">
                        {actorStats.map(a => (
                          <div key={a.name}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-gray-800">{a.name}</span>
                              <span className="text-xs text-gray-400">{a.total} رویداد</span>
                            </div>
                            <div className="flex gap-1 text-[10px]">
                              {a.create > 0 && <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded">+{a.create}</span>}
                              {a.update > 0 && <span className="bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded">✎{a.update}</span>}
                              {a.delete > 0 && <span className="bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded">✕{a.delete}</span>}
                              {a.login  > 0 && <span className="bg-gray-900 text-white px-1.5 py-0.5 rounded">↩{a.login}</span>}
                            </div>
                            <div className="mt-1.5 w-full bg-gray-100 rounded-full h-1">
                              <div className="bg-gray-800 h-full rounded-full" style={{ width: `${(a.total / (actorStats[0]?.total || 1)) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Activity per entity */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">فعالیت به تفکیک موجودیت</p>
                      <div className="space-y-2">
                        {entityStats.map(e => (
                          <div key={e.entity} className="flex items-center gap-3">
                            <span className="text-sm text-gray-700 w-28 shrink-0">{e.entity}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div className="bg-gray-700 h-full rounded-full" style={{ width: `${(e.count / (entityStats[0]?.count || 1)) * 100}%` }} />
                            </div>
                            <span className="text-xs text-gray-400 w-8 text-start">{e.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Filters */}
                  <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                      {/* Search */}
                      <div className="relative lg:col-span-1">
                        <IconSearch className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
                        <input
                          className="w-full pr-9 pl-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-800 transition-colors"
                          placeholder="جستجو در لاگ‌ها (نام، موجودیت، جزئیات)..."
                          value={logSearch}
                          onChange={e => { setLogSearch(e.target.value); setLogPage(1); }}
                        />
                      </div>
                      {/* Actor */}
                      <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-800" value={logActorFilter} onChange={e => { setLogActorFilter(e.target.value); setLogPage(1); }}>
                        <option value="all">همه کاربران</option>
                        {allActors.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                      {/* Entity */}
                      <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-800" value={logEntityFilter} onChange={e => { setLogEntityFilter(e.target.value); setLogPage(1); }}>
                        <option value="all">همه موجودیت‌ها</option>
                        {allEntities.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {/* Action type pills */}
                      <div className="flex gap-1">
                        {['all', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'OTHER'].map(a => (
                          <button key={a} onClick={() => { setLogActionFilter(a); setLogPage(1); }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${logActionFilter === a ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {a === 'all' ? 'همه' : a}
                          </button>
                        ))}
                      </div>
                      {/* Date range */}
                      <div className="flex items-center gap-2 mr-auto">
                        <span className="text-xs text-gray-400">از:</span>
                        <input type="date" className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-gray-800" value={logDateFrom} onChange={e => { setLogDateFrom(e.target.value); setLogPage(1); }} />
                        <span className="text-xs text-gray-400">تا:</span>
                        <input type="date" className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-gray-800" value={logDateTo} onChange={e => { setLogDateTo(e.target.value); setLogPage(1); }} />
                        {(logSearch || logActionFilter !== 'all' || logEntityFilter !== 'all' || logActorFilter !== 'all' || logDateFrom || logDateTo) && (
                          <button onClick={() => { setLogSearch(''); setLogActionFilter('all'); setLogEntityFilter('all'); setLogActorFilter('all'); setLogDateFrom(''); setLogDateTo(''); setLogPage(1); }}
                            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded-lg">
                            پاک کردن فیلترها
                          </button>
                        )}
                      </div>
                    </div>
                    {filteredLogs.length !== systemLogs.length && (
                      <p className="text-[11px] text-gray-400 mt-2">{filteredLogs.length} نتیجه از {systemLogs.length} رویداد</p>
                    )}
                  </div>

                  {/* Table */}
                  <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-start text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs">
                          <tr>
                            <th className="px-4 py-3 font-medium">{t.time}</th>
                            <th className="px-4 py-3 font-medium">{t.user}</th>
                            <th className="px-4 py-3 font-medium">{t.operation}</th>
                            <th className="px-4 py-3 font-medium">{t.entity}</th>
                            <th className="px-4 py-3 font-medium">{t.details}</th>
                            <th className="px-4 py-3 font-medium text-center">{t.action}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {pagedLogs.map(log => (
                            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-gray-400 text-xs dir-ltr whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-800 text-xs whitespace-nowrap">{log.actorName}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${actionBadge(log.actionType)}`}>{log.actionType}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{log.entity}</td>
                              <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate" title={log.details}>{log.details}</td>
                              <td className="px-4 py-3 text-center">
                                {log.actionType === 'DELETE' && log.backupData && (
                                  <button onClick={() => handleRestore(log)} className="text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-medium mx-auto transition-colors">
                                    <IconRefreshCw className="w-3 h-3" /> {t.restore}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {pagedLogs.length === 0 && (
                            <tr><td colSpan={6} className="py-16 text-center text-gray-400 text-sm">موردی یافت نشد</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex justify-center items-center gap-3 p-4 border-t border-gray-100">
                        <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-200">قبلی</button>
                        <span className="text-xs text-gray-500">{logPage} / {totalPages}</span>
                        <button onClick={() => setLogPage(p => Math.min(totalPages, p + 1))} disabled={logPage === totalPages} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-200">بعدی</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
      {selectedTicket && renderTicketModal()}
      {activeTab === 'customer_accounts' && isMaster && onSaveCustomerAccount && onDeleteCustomerAccount && (
        <CustomerAccountManager
          customerAccounts={customerAccounts}
          tickets={tickets}
          services={services}
          currentUserName={currentUser.fullName}
          onSave={onSaveCustomerAccount}
          onDelete={onDeleteCustomerAccount}
          lang={lang}
        />
      )}
      {showLabelManager && isMaster && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4" onClick={() => setShowLabelManager(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><IconTag className="w-5 h-5 text-gray-600" />مدیریت لیبل‌ها</h3>
              <button onClick={() => setShowLabelManager(false)} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
            </div>
            <div className="space-y-2 mb-5 max-h-60 overflow-y-auto">
              {(config.labels || []).length === 0 && <p className="text-sm text-gray-400 text-center py-4">لیبلی تعریف نشده</p>}
              {(config.labels || []).map(lbl => {
                const colors: Record<string,string> = { red:'bg-red-100 text-red-700', orange:'bg-orange-100 text-orange-700', yellow:'bg-yellow-100 text-yellow-700', green:'bg-green-100 text-green-700', blue:'bg-blue-100 text-blue-700', purple:'bg-purple-100 text-purple-700', pink:'bg-pink-100 text-pink-700', gray:'bg-gray-100 text-gray-600' };
                return (
                  <div key={lbl.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium ${colors[lbl.color] || colors.gray}`}><IconTag className="w-3.5 h-3.5" />{lbl.name}</span>
                    <button onClick={() => { const next = (config.labels || []).filter(l => l.id !== lbl.id); onUpdateConfig({ ...config, labels: next }); }} className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"><IconTrash className="w-4 h-4" /></button>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-bold text-gray-500">افزودن لیبل جدید</p>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200" placeholder="نام لیبل" value={newLabelName} onChange={e => setNewLabelName(e.target.value)} />
              <div className="flex gap-1.5 flex-wrap">
                {['red','orange','yellow','green','blue','purple','pink','gray'].map(c => {
                  const dot: Record<string,string> = { red:'bg-red-400', orange:'bg-orange-400', yellow:'bg-yellow-400', green:'bg-green-400', blue:'bg-blue-400', purple:'bg-purple-400', pink:'bg-pink-400', gray:'bg-gray-400' };
                  return <button key={c} onClick={() => setNewLabelColor(c)} className={`w-7 h-7 rounded-full ${dot[c]} transition-all ${newLabelColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'opacity-60 hover:opacity-100'}`} />;
                })}
              </div>
              <button disabled={!newLabelName.trim()} onClick={() => {
                const newLbl: TicketLabel = { id: `lbl-${Date.now()}`, name: newLabelName.trim(), color: newLabelColor };
                onUpdateConfig({ ...config, labels: [...(config.labels || []), newLbl] });
                setNewLabelName('');
                setNewLabelColor('blue');
              }} className="w-full bg-gray-900 text-white py-2 rounded-xl text-sm font-semibold hover:bg-black disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"><IconPlus className="w-4 h-4" />افزودن لیبل</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
