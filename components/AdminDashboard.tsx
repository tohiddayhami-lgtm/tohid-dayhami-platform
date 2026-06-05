
import React, { useState, useEffect, useRef } from 'react';
import { Ticket, TicketStatus, ServiceOption, Personnel, Customer, AppConfig, ProjectDetails, AttachedFile, Currency, Payment, InternalMessage, Invoice, Task, Meeting, SystemLog, ProjectMilestone, ProjectRisk, ProjectTeamMember, KPI, CustomForm, PerformanceReport, NewsArticle, AnalyticsEvent } from '../types';
import { IconCheck, IconActivity, IconUsers, IconBriefcase, IconLayout, IconPaperclip, IconShield, IconSettings, IconClock, IconFile, IconEdit, IconTrash, IconProject, IconMoney, IconUpload, IconPlus, IconChart, IconMail, IconInvoice, IconList, IconCalendarClock, IconHistory, IconCopy, IconSearch, IconFlag, IconAlertTriangle, IconTime, IconTrendingUp, IconRefreshCw, IconLock, IconMegaphone, IconBarChart2, IconMapPin, IconWhatsapp, IconTarget, IconClipboard, IconFolder, IconAward, IconWallet } from './Icons';
import { ServiceManager } from './ServiceManager';
import { PersonnelManager } from './PersonnelManager';
import { CustomerManager } from './CustomerManager';
import { SettingsManager } from './SettingsManager';
import { NewsManager } from './NewsManager';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { IconNewspaper, IconGlobe, IconImage, IconPort, IconBarChart2 as IconAnalytics } from './Icons';
import { InternalMessenger } from './InternalMessenger';
import { InvoiceModal } from './InvoiceModal';
import { TaskManager } from './TaskManager';
import { MeetingCalendar } from './MeetingCalendar';
import { PerformanceReports } from './PerformanceReports';
import { KPIManager } from './KPIManager';
import { SalesDashboard } from './SalesDashboard';
import { ReportManager } from './ReportManager';
import { GoalTracker } from './GoalTracker';
import { ExpenseManager } from './ExpenseManager';
import { FormBuilderPanel } from './FormBuilderPanel';
import { uploadFileWithProgress, logSystemAction, subscribeToSystemLogs, saveTaskToCloud, restoreEntityFromLog, sendInternalMessage, subscribeToCustomForms, saveReport } from '../services/firebaseService';
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
  onUpdateTicket: (ticketId: string, updates: Partial<Ticket>, actorName: string, actionNote?: string, visibility?: 'public' | 'internal') => void;
  onDeleteTicket: (ticketId: string) => Promise<void>;
  onUpdateServices: (services: ServiceOption[]) => void;
  onUpdatePersonnel: (personnel: Personnel[]) => void;
  onUpdateCustomers: (customers: Customer[]) => void; 
  onEditCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onUpdateConfig: (config: AppConfig) => void;
  onLogout: () => void;
  lang: Language;
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
  lang
}) => {
  const safeRoles = currentUser?.roles || [];
  const isAdmin = safeRoles.includes('مدیر');
  const isMaster = currentUser?.username === 'master';
  
  const canManageInvoices = isAdmin || isMaster || currentUser?.permissions?.canIssueInvoices; 
  const canAssign = isAdmin || isMaster || currentUser?.permissions?.canAssign;
  const hasCustomerAccess = isAdmin || isMaster || currentUser?.permissions?.canViewCustomers;
  const hasTariffAccess = isAdmin || isMaster || currentUser?.permissions?.canViewTariffs;
  const canViewAllTickets = isAdmin || isMaster || currentUser?.permissions?.canViewAllTickets;

  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'services' | 'personnel' | 'settings' | 'messages' | 'tasks' | 'meetings' | 'logs' | 'reports' | 'kpi' | 'forms' | 'sales' | 'staff_reports' | 'goals' | 'expenses' | 'news_mgmt' | 'seo' | 'analytics'>('overview');
  const [seoForm, setSeoForm] = useState({ favicon: config.favicon || '', seoTitle: config.seoTitle || '', seoDescription: config.seoDescription || '', seoKeywords: config.seoKeywords || '', ogTitle: config.ogTitle || '', ogDescription: config.ogDescription || '', ogImage: config.ogImage || '', metaPortUrl: config.metaPortUrl || '' });
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconProgress, setFaviconProgress] = useState(0);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [heroBgUploading, setHeroBgUploading] = useState(false);
  const [heroBgProgress, setHeroBgProgress] = useState(0);
  const heroBgInputRef = useRef<HTMLInputElement>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'my' | 'history'>(canViewAllTickets ? 'all' : 'my');
  const [projectSubTab, setProjectSubTab] = useState<'active' | 'history'>('active');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [globalSearch, setGlobalSearch] = useState(''); 
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'info' | 'project'>('info');
  const [newComment, setNewComment] = useState('');
  const [commentVisibility, setCommentVisibility] = useState<'public' | 'internal'>('public'); 
  const [showMentionList, setShowMentionList] = useState(false); 
  
  const [isEditingTicket, setIsEditingTicket] = useState(false);
  const [editingTicketData, setEditingTicketData] = useState<Partial<Ticket>>({});
  
  const [tempAssignedTo, setTempAssignedTo] = useState<string>('');

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>(undefined);

  const [quickReportText, setQuickReportText] = useState('');
  const [quickReportItems, setQuickReportItems] = useState<string[]>([]);
  const [isSavingQuickReport, setIsSavingQuickReport] = useState(false);
  const [formLinkCopied, setFormLinkCopied] = useState(false);

  const [projectForm, setProjectForm] = useState<ProjectDetails>({
      isActive: false,
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
      statusNote: ''
  });
  
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
      serviceId: '',
      customerName: '',
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

  const userKPIs = kpis.filter(k => (k.assignedUserId === currentUser.id) || (k.assignedRole && currentUser.roles.includes(k.assignedRole)));

  const t = {
      fa: {
          overview: 'داشبورد و کارتابل',
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
          goals: 'ردیاب اهداف (Goals)',
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
          saveSeo: 'ذخیره تنظیمات سئو'
      },
      en: {
          overview: 'Overview & Dashboard',
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
          goals: 'SMART Goals Tracker',
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
          saveSeo: 'Save SEO Settings'
      }
  }[lang];

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
  }, [filterMode, statusFilter, globalSearch]);

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
              setProjectForm({ isActive: false, tariff: { amount: 0, currency: 'IRR' }, startDate: '', endDate: '', teamMemberIds: [], teamMembers: [], projectFiles: [], payments: [], invoices: [], milestones: [], risks: [], progress: 0, statusNote: '' });
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
              const allowedForms = forms.filter(f => f.allowedRoles.length === 0 || currentUser.roles.some(r => f.allowedRoles.includes(r)) || isMaster);
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
      
      if (filterMode === 'history') {
          if (!isArchived) return false;
      } else {
          if (isArchived) return false;
          
          if (!canViewAllTickets || filterMode === 'my') {
             if (!(t.assignedTo === currentUser.id || t.projectData?.teamMemberIds?.includes(currentUser.id))) return false;
          }
      }

      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
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
    if (!selectedTicket || !newComment.trim()) return;
    await processMentions(newComment, `Ticket ${selectedTicket.id}`, selectedTicket.id);
    onUpdateTicket(selectedTicket.id, {}, currentUser.fullName, newComment, commentVisibility);
    logSystemAction('UPDATE', 'Ticket', `Comment added to ticket ${selectedTicket.id}`, currentUser.fullName, selectedTicket.id);
    setNewComment('');
    setShowMentionList(false);
    setCommentVisibility('public');
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

  const handleInsertMention = (username: string) => { setNewComment(prev => prev + `@${username} `); setShowMentionList(false); };
  const handleStartEdit = () => { if (!selectedTicket) return; setEditingTicketData({ customerName: selectedTicket.customerName, companyName: selectedTicket.companyName, phoneNumber: selectedTicket.phoneNumber, whatsappNumber: selectedTicket.whatsappNumber, location: selectedTicket.location, businessType: selectedTicket.businessType, description: selectedTicket.description, serviceId: selectedTicket.serviceId }); setIsEditingTicket(true); };
  const handleSaveEdit = () => { if (!selectedTicket) return; onUpdateTicket(selectedTicket.id, editingTicketData, currentUser.fullName, 'Edit Basic Info'); logSystemAction('UPDATE', 'Ticket', `Edited ticket ${selectedTicket.id}`, currentUser.fullName, selectedTicket.id); setIsEditingTicket(false); };
  const handleDelete = async (id: string) => { if (!id) return; if (window.confirm(lang === 'fa' ? 'آیا از حذف اطمینان دارید؟' : 'Are you sure you want to delete?')) { await onDeleteTicket(id); if (selectedTicketId === id) setSelectedTicketId(null); } };
  const handleUpdateTicketStatus = (status: TicketStatus) => { if (!selectedTicket) return; onUpdateTicket(selectedTicket.id, { status }, currentUser.fullName); logSystemAction('UPDATE', 'Ticket', `Status changed to ${status}`, currentUser.fullName, selectedTicket.id); };
  const handleDeleteTimelineEntry = (index: number) => { if (!selectedTicket || !isMaster) return; if (window.confirm('Delete entry?')) { const newTimeline = [...(selectedTicket.timeline || [])]; newTimeline.splice(index, 1); onUpdateTicket(selectedTicket.id, { timeline: newTimeline }, currentUser.fullName); } };
  const handleEditTimelineEntry = (index: number, currentDesc: string) => { if (!selectedTicket || !isMaster) return; const newDesc = window.prompt('Edit:', currentDesc); if (newDesc !== null) { const newTimeline = [...(selectedTicket.timeline || [])]; newTimeline[index] = { ...newTimeline[index], description: newDesc }; onUpdateTicket(selectedTicket.id, { timeline: newTimeline }, currentUser.fullName); } };
  const handleAssignTicket = async () => { if (!selectedTicket) return; if (tempAssignedTo === selectedTicket.assignedTo) return; const targetUser = personnel.find(p => p.id === tempAssignedTo); const actionDesc = targetUser ? `Assigned to ${targetUser.fullName}` : 'Unassigned'; onUpdateTicket(selectedTicket.id, { assignedTo: tempAssignedTo }, currentUser.fullName, actionDesc); logSystemAction('UPDATE', 'Ticket', `Assigned ticket ${selectedTicket.id}`, currentUser.fullName, selectedTicket.id); if (targetUser && targetUser.id !== currentUser.id) { const msg: InternalMessage = { id: `notify-${Date.now()}`, senderId: currentUser.id, senderName: 'System', recipientIds: [targetUser.id], recipientNames: [targetUser.fullName], subject: `Assignment: ${selectedTicket.customerName}`, body: `Ticket #${selectedTicket.id} has been assigned to you.`, createdAt: new Date().toISOString(), readBy: [] }; await sendInternalMessage(msg); } alert(lang === 'fa' ? 'ارجاع انجام شد.' : 'Assigned successfully.'); };
  const handleCreateProject = async (e: React.FormEvent) => { e.preventDefault(); const newTicketId = `PROJ-${Math.floor(10000 + Math.random() * 90000)}`; const newTicket: Ticket = { id: newTicketId, customerName: newProjectData.customerName, phoneNumber: newProjectData.phoneNumber, whatsappNumber: newProjectData.phoneNumber, location: 'N/A', serviceId: newProjectData.serviceId, description: `Project: ${newProjectData.title}`, status: TicketStatus.IN_PROGRESS, createdAt: new Date().toISOString(), priority: newProjectData.priority, files: [], timeline: [ { type: 'creation', title: 'Project Created', description: `Project "${newProjectData.title}" created by ${currentUser.fullName}.`, actorName: currentUser.fullName, timestamp: new Date().toISOString(), visibility: 'public' } ], projectData: { isActive: true, tariff: { amount: parseInt(newProjectData.tariffAmount.replace(/,/g, '')) || 0, currency: newProjectData.tariffCurrency }, startDate: newProjectData.startDate, endDate: newProjectData.endDate, teamMemberIds: [currentUser.id], teamMembers: [ { userId: currentUser.id, role: 'Project Manager', responsibility: 'Owner', joinedAt: new Date().toISOString() } ], projectFiles: [], payments: [], invoices: [], milestones: [], risks: [], progress: 0, statusNote: 'Project Initialized.' }, assignedTo: currentUser.id }; try { await onCreateTicket(newTicket); setCreatedProjectId(newTicketId); } catch (e) { alert('Error creating project'); } };
  const handleProjectModalClose = () => { setShowNewProjectModal(false); setCreatedProjectId(null); setNewProjectData({ title: '', serviceId: '', customerName: '', phoneNumber: '', startDate: '', endDate: '', tariffAmount: '', tariffCurrency: 'IRR', priority: 'Medium' }); };
  const handleProjectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (!e.target.files || e.target.files.length === 0) return; const files: File[] = Array.from(e.target.files); for (const file of files) { if (file.size > 5 * 1024 * 1024) { alert('File too large > 5MB'); continue; } const newFile: AttachedFile = { name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 }; setProjectForm(prev => ({ ...prev, projectFiles: [...prev.projectFiles, newFile] })); uploadFileWithProgress( file, (progress) => setProjectForm(prev => ({ ...prev, projectFiles: prev.projectFiles.map(f => f.name === file.name && f.status === 'uploading' ? { ...f, progress } : f) })), (url) => setProjectForm(prev => ({ ...prev, projectFiles: prev.projectFiles.map(f => f.name === file.name ? { ...f, content: url, status: 'success', progress: 100 } : f) })), (err) => setProjectForm(prev => ({ ...prev, projectFiles: prev.projectFiles.map(f => f.name === file.name ? { ...f, status: 'error', errorMsg: err.message } : f) })), 'documents' ); } if (projectFileInputRef.current) projectFileInputRef.current.value = ''; };
  const handleRemoveProjectFile = (index: number) => { setProjectForm(prev => ({ ...prev, projectFiles: prev.projectFiles.filter((_, i) => i !== index) })); };
  const handleSaveInvoice = (invoice: Invoice) => { if (!selectedTicket) return; const invoices = projectForm.invoices || []; const existingIdx = invoices.findIndex(i => i.id === invoice.id); let newInvoices = existingIdx >= 0 ? invoices.map((inv, i) => i === existingIdx ? invoice : inv) : [...invoices, invoice]; const updatedProjectData = { ...projectForm, invoices: newInvoices, isActive: true }; onUpdateTicket(selectedTicket.id, { projectData: updatedProjectData }, currentUser.fullName, `Invoice ${invoice.number} updated.`); logSystemAction('UPDATE', 'Project', `Invoice ${invoice.number} saved`, currentUser.fullName, selectedTicket.id); setShowInvoiceModal(false); };
  const handleSaveProject = () => { if (!selectedTicket) return; if (projectForm.projectFiles.some(f => f.status === 'uploading')) { alert(lang === 'fa' ? 'صبر کنید...' : 'Wait for upload...'); return; } const updatedProjectData = { ...projectForm, isActive: true }; onUpdateTicket(selectedTicket.id, { projectData: updatedProjectData }, currentUser.fullName, 'Project Updated'); logSystemAction('UPDATE', 'Project', `Project ${selectedTicket.id} updated`, currentUser.fullName, selectedTicket.id); alert(lang === 'fa' ? 'ذخیره شد.' : 'Saved.'); };
  const handleAddMilestone = () => { if (!newMilestoneTitle.trim()) return; const milestone: ProjectMilestone = { id: `ms-${Date.now()}`, title: newMilestoneTitle, dueDate: newMilestoneDate, isCompleted: false }; setProjectForm(prev => ({ ...prev, milestones: [...(prev.milestones || []), milestone] })); setNewMilestoneTitle(''); setNewMilestoneDate(''); };
  const handleToggleMilestone = (id: string) => { setProjectForm(prev => ({ ...prev, milestones: prev.milestones?.map(m => m.id === id ? { ...m, isCompleted: !m.isCompleted } : m) })); };
  const handleAddRisk = () => { if(!newRiskTitle.trim()) return; const risk: ProjectRisk = { id: `rsk-${Date.now()}`, title: newRiskTitle, impact: newRiskImpact }; setProjectForm(prev => ({ ...prev, risks: [...(prev.risks || []), risk] })); setNewRiskTitle(''); };
  const handleAddTeamMember = async () => { if (!newTeamMemberId || !newTeamMemberResp.trim() || !selectedTicket) return; if (projectForm.teamMemberIds.includes(newTeamMemberId)) return; const newTask: Task = { id: `task-${Date.now()}`, title: `Project Join: ${selectedTicket.customerName}`, description: `Role: "${newTeamMemberRole}", Resp: ${newTeamMemberResp}`, creatorId: currentUser.id, creatorName: currentUser.fullName, assigneeIds: [newTeamMemberId], isCompleted: false, priority: 'High', createdAt: new Date().toISOString(), comments: [] }; await saveTaskToCloud(newTask); const newMember: ProjectTeamMember = { userId: newTeamMemberId, role: newTeamMemberRole || 'Member', responsibility: newTeamMemberResp, joinedAt: new Date().toISOString() }; setProjectForm(prev => ({ ...prev, teamMemberIds: [...prev.teamMemberIds, newTeamMemberId], teamMembers: [...(prev.teamMembers || []), newMember] })); setNewTeamMemberId(''); setNewTeamMemberRole(''); setNewTeamMemberResp(''); };
  const handleRemoveTeamMember = (userId: string) => { if (window.confirm('Remove member?')) { setProjectForm(prev => ({ ...prev, teamMemberIds: prev.teamMemberIds.filter(id => id !== userId), teamMembers: (prev.teamMembers || []).filter(m => m.userId !== userId) })); } };
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
                    <button onClick={() => setSelectedTicketId(null)} className="bg-white text-gray-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-full border border-gray-200 transition-colors shadow-sm w-8 h-8 flex items-center justify-center">✕</button>
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
                                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><IconActivity className="w-5 h-5 text-indigo-500" /> {t.events}</h3>
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
                                                    {entry.visibility === 'internal' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded mt-1 inline-block">Internal</span>}
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={commentsEndRef}></div>
                                    </div>
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
                                        <div className="flex gap-2">
                                            <button onClick={() => setCommentVisibility('public')} className={`text-xs px-2 py-1 rounded transition-colors ${commentVisibility === 'public' ? 'bg-green-100 text-green-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>{t.publicReport}</button>
                                            <button onClick={() => setCommentVisibility('internal')} className={`text-xs px-2 py-1 rounded transition-colors ${commentVisibility === 'internal' ? 'bg-amber-100 text-amber-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>{t.internalNote}</button>
                                        </div>
                                        <button onClick={handleAddComment} disabled={!newComment.trim()} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">{t.send}</button>
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-bold text-gray-500 block mb-1">{t.startDate}</label><input type="date" className="w-full border rounded-lg p-2 text-sm" value={projectForm.startDate} onChange={e => setProjectForm({...projectForm, startDate: e.target.value})} /></div>
                                        <div><label className="text-xs font-bold text-gray-500 block mb-1">{t.endDate}</label><input type="date" className="w-full border rounded-lg p-2 text-sm" value={projectForm.endDate} onChange={e => setProjectForm({...projectForm, endDate: e.target.value})} /></div>
                                    </div>
                                    <div><label className="text-xs font-bold text-gray-500 block mb-1">{t.contractAmount}</label><div className="flex gap-2"><input className="w-full border rounded-lg p-2 text-sm" type="number" value={projectForm.tariff?.amount} onChange={e => setProjectForm({...projectForm, tariff: { ...projectForm.tariff, amount: parseInt(e.target.value) || 0, currency: projectForm.tariff?.currency || 'IRR' }})} /><select className="border rounded-lg p-2 text-sm bg-white" value={projectForm.tariff?.currency} onChange={e => setProjectForm({...projectForm, tariff: { ...projectForm.tariff, currency: e.target.value as Currency, amount: projectForm.tariff?.amount || 0 }})}><option value="IRR">IRR</option><option value="USD">USD</option><option value="OMR">OMR</option></select></div></div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">{t.team}</h4>
                                    <div className="space-y-3 mb-4">{projectForm.teamMembers?.map((m, i) => { const p = personnel.find(per => per.id === m.userId); return (<div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">{p?.fullName.charAt(0)}</div><div><div className="text-sm font-bold text-gray-800">{p?.fullName}</div><div className="text-xs text-gray-500">{m.role}</div></div></div><button onClick={() => handleRemoveTeamMember(m.userId)} className="text-red-400 hover:text-red-600"><IconTrash className="w-4 h-4" /></button></div>); })}</div>
                                    <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200"><select className="w-full border rounded p-2 text-sm" value={newTeamMemberId} onChange={e => setNewTeamMemberId(e.target.value)}><option value="">Select Personnel</option>{personnel.filter(p => !projectForm.teamMemberIds.includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select><input className="w-full border rounded p-2 text-sm" placeholder={t.role} value={newTeamMemberRole} onChange={e => setNewTeamMemberRole(e.target.value)} /><input className="w-full border rounded p-2 text-sm" placeholder={t.responsibility} value={newTeamMemberResp} onChange={e => setNewTeamMemberResp(e.target.value)} /><button onClick={handleAddTeamMember} className="bg-indigo-600 text-white p-2 rounded text-sm font-bold hover:bg-indigo-700">{t.addMember}</button></div>
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

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-100px)]">
      {showInvoiceModal && selectedTicket && (
          <InvoiceModal customer={{ id: selectedTicket.customerName, fullName: selectedTicket.customerName, companyName: selectedTicket.companyName, location: selectedTicket.location, phoneNumber: selectedTicket.phoneNumber, whatsappNumber: selectedTicket.whatsappNumber, firstContact: '', totalTickets: 0 }} template={config.invoiceTemplate || { companyName: config.appTitle, address: '', phone: '', footerText: '', termsConditions: '', defaultTaxRate: 0, colorTheme: '#4f46e5' }} initialData={editingInvoice} onSave={handleSaveInvoice} onClose={() => setShowInvoiceModal(false)} />
      )}
      {showNewProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in overflow-hidden"><div className="p-6 border-b border-gray-100 flex justify-between items-center bg-purple-50"><h3 className="font-bold text-lg text-purple-900 flex items-center gap-2"><IconProject className="w-5 h-5" />{t.newProject}</h3><button onClick={handleProjectModalClose} className="text-gray-400 hover:text-gray-600">✕</button></div>{createdProjectId ? (<div className="p-8 text-center"><div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><IconCheck className="w-8 h-8 text-green-600" /></div><h3 className="text-xl font-bold text-gray-800 mb-2">{t.successProject}</h3><p className="text-gray-500 text-sm mb-6">Tracking Code:</p><div className="bg-gray-50 border-2 border-dashed border-purple-200 rounded-xl p-4 flex items-center justify-between gap-3 mb-6"><span className="font-mono font-black text-2xl text-purple-700 tracking-wider">{createdProjectId}</span><button onClick={() => { navigator.clipboard.writeText(createdProjectId); alert(t.copyCode); }} className="bg-white border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-300 p-2 rounded-lg transition-colors"><IconCopy className="w-5 h-5" /></button></div><button onClick={handleProjectModalClose} className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors">{t.understand}</button></div>) : (<form onSubmit={handleCreateProject} className="p-6 space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.projectTitle}</label><input required className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-purple-500" value={newProjectData.title} onChange={e => setNewProjectData({...newProjectData, title: e.target.value})} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.relatedService}</label><select className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-purple-500 bg-white" required value={newProjectData.serviceId} onChange={e => setNewProjectData({...newProjectData, serviceId: e.target.value})}><option value="">...</option>{services.map(s => <option key={s.id} value={s.id}>{lang === 'en' && s.titleEn ? s.titleEn : s.title}</option>)}</select></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.customer}</label><input required className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-purple-500" value={newProjectData.customerName} onChange={e => setNewProjectData({...newProjectData, customerName: e.target.value})} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.phone}</label><input required className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-purple-500 dir-ltr text-right" value={newProjectData.phoneNumber} onChange={e => setNewProjectData({...newProjectData, phoneNumber: e.target.value})} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.startDate}</label><input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-purple-500" value={newProjectData.startDate} onChange={e => setNewProjectData({...newProjectData, startDate: e.target.value})} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.endDate}</label><input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-purple-500" value={newProjectData.endDate} onChange={e => setNewProjectData({...newProjectData, endDate: e.target.value})} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contractAmount}</label><div className="flex gap-2"><input className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-purple-500" placeholder="0" value={newProjectData.tariffAmount} onChange={e => setNewProjectData({...newProjectData, tariffAmount: formatNumberInput(e.target.value)})} /><select className="px-2 py-2 rounded-lg border border-gray-300 bg-white" value={newProjectData.tariffCurrency} onChange={e => setNewProjectData({...newProjectData, tariffCurrency: e.target.value as Currency})}><option value="IRR">IRR</option><option value="USD">USD</option><option value="OMR">OMR</option></select></div></div><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.priority}</label><select className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-purple-500 bg-white" value={newProjectData.priority} onChange={e => setNewProjectData({...newProjectData, priority: e.target.value as any})}><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option></select></div></div><div className="flex gap-3 pt-4"><button type="button" onClick={handleProjectModalClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">{t.cancel}</button><button type="submit" className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 shadow-lg shadow-purple-200">{t.create}</button></div></form>)}</div></div>
      )}
      
      <div className="w-full md:w-72 shrink-0 space-y-6">
         <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center sticky top-24">
            <div className="relative w-24 h-24 mb-4"><div className="w-full h-full rounded-full overflow-hidden border-2 border-indigo-100 shadow-md">{currentUser.avatar ? (<img src={currentUser.avatar} alt={currentUser.fullName} className="w-full h-full object-cover" />) : (<div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-2xl font-bold">{currentUser.fullName.charAt(0)}</div>)}</div><div className="absolute bottom-0 right-0 bg-green-500 w-4 h-4 rounded-full border-2 border-white"></div></div>
            <h3 className="font-bold text-gray-900 text-lg">{currentUser.fullName}</h3>
            <div className="flex flex-wrap justify-center gap-1 mt-1 mb-2">{(currentUser.roles || []).map((r, i) => (<span key={i} className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{r}</span>))}</div>
            {directManager && (<div className="text-xs text-gray-500 mb-4 bg-gray-50 px-2 py-1 rounded inline-flex items-center gap-1"><IconLayout className="w-3 h-3" /> {t.manager}: {directManager.fullName}</div>)}
            <div className="w-full space-y-2">
                <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconActivity className="w-5 h-5" /><span className="font-medium">{t.overview}</span></button>
                <button onClick={() => setActiveTab('tasks')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative ${activeTab === 'tasks' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconList className="w-5 h-5" /><span className="font-medium">{t.tasks}</span>{pendingTasksCount > 0 && <span className="absolute rtl:left-4 ltr:right-4 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingTasksCount}</span>}</button>
                <button onClick={() => setActiveTab('staff_reports')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'staff_reports' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconClipboard className="w-5 h-5" /><span className="font-medium">{t.staff_reports}</span></button>
                <button onClick={() => setActiveTab('goals')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'goals' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconTarget className="w-5 h-5" /><span className="font-medium">{t.goals}</span></button>
                <button onClick={() => setActiveTab('meetings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'meetings' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconCalendarClock className="w-5 h-5" /><span className="font-medium">{t.meetings}</span></button>
                <button onClick={() => setActiveTab('messages')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative ${activeTab === 'messages' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconMail className="w-5 h-5" /><span className="font-medium">{t.messages}</span>{unreadMessagesCount > 0 && <span className="absolute rtl:left-4 ltr:right-4 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unreadMessagesCount}</span>}</button>
                <button onClick={() => setActiveTab('projects')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'projects' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconProject className="w-5 h-5" /><span className="font-medium">{t.projects}</span></button>
                <button onClick={() => setActiveTab('forms')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'forms' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconClipboard className="w-5 h-5" /><span className="font-medium">{t.forms}</span></button>
                <button onClick={() => setActiveTab('sales')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'sales' ? 'bg-green-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconMoney className="w-5 h-5" /><span className="font-medium">{t.sales}</span></button>
                {(isAdmin || isMaster) && (<button onClick={() => setActiveTab('expenses')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'expenses' ? 'bg-rose-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconWallet className="w-5 h-5" /><span className="font-medium">{t.expenses}</span></button>)}
                {hasTariffAccess && (<button onClick={() => setActiveTab('services')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'services' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconBriefcase className="w-5 h-5" /><span className="font-medium">{t.services}</span></button>)}
                {isAdmin && (<><div className="px-4 py-2 text-xs font-bold text-gray-400 mt-4 border-t border-gray-100 pt-4">Admin</div><button onClick={() => setActiveTab('personnel')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'personnel' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconShield className="w-5 h-5" /><span className="font-medium">{t.personnel}</span></button><button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconSettings className="w-5 h-5" /><span className="font-medium">{t.settings}</span></button></>)}
                {isMaster && (<><button onClick={() => setActiveTab('logs')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'logs' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconHistory className="w-5 h-5" /><span className="font-medium">{t.logs}</span></button><button onClick={() => setActiveTab('reports')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'reports' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconBarChart2 className="w-5 h-5" /><span className="font-medium">{t.reports}</span></button><button onClick={() => setActiveTab('kpi')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'kpi' ? 'bg-pink-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconTarget className="w-5 h-5" /><span className="font-medium">{t.kpi}</span></button><button onClick={() => setActiveTab('analytics')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'analytics' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconAnalytics className="w-5 h-5" /><span className="font-medium">{lang === 'fa' ? 'آمار بازدید' : 'Analytics'}</span></button><button onClick={() => setActiveTab('news_mgmt')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'news_mgmt' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconNewspaper className="w-5 h-5" /><span className="font-medium">{t.news_mgmt}</span></button><button onClick={() => setActiveTab('seo')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'seo' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><IconGlobe className="w-5 h-5" /><span className="font-medium">{t.seo}</span></button></>)}
            </div>
            <button onClick={onLogout} className="w-full text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 py-3 rounded-xl transition-colors mt-6">{t.logout}</button>
        </div>
      </div>

      <div className="flex-grow">
        {activeTab === 'expenses' && (isAdmin || isMaster) && <ExpenseManager currentUser={currentUser} personnel={personnel} lang={lang} />}
        {activeTab === 'staff_reports' && <ReportManager currentUser={currentUser} personnel={personnel} lang={lang} config={config} />}
        {activeTab === 'goals' && <GoalTracker currentUser={currentUser} personnel={personnel} lang={lang} />}
        {activeTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">


                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"><div className="text-gray-500 text-xs mb-1">{t.myTasks}</div><div className="text-2xl font-black text-indigo-600">{myTasksCount}</div></div>
                     <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"><div className="text-gray-500 text-xs mb-1">{t.allRequests}</div><div className="text-2xl font-black text-gray-800">{tickets.filter(t => t.status !== 'تکمیل شده' && t.status !== 'لغو شده').length}</div></div>
                     <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"><div className="text-gray-500 text-xs mb-1">{t.activeProjects}</div><div className="text-2xl font-black text-purple-600">{activeProjectsList.length}</div></div>
                     <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"><div className="text-gray-500 text-xs mb-1">{t.newMessages}</div><div className="text-2xl font-black text-blue-600">{unreadMessagesCount}</div></div>
                 </div>

                 <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-xl shadow-indigo-50 animate-fade-in">
                     <div className="flex items-center gap-3 mb-4">
                         <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200"><IconClipboard className="w-5 h-5" /></div>
                         <h3 className="font-bold text-gray-800">{t.quickReport}</h3>
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
                            className="flex-grow px-4 py-3 bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-500 rounded-xl text-sm outline-none transition-all shadow-inner"
                            placeholder={t.quickReportHint}
                            value={quickReportText}
                            onChange={e => setQuickReportText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleQuickReportAdd())}
                         />
                         <button onClick={handleQuickReportAdd} className="bg-indigo-100 text-indigo-600 px-4 rounded-xl font-bold hover:bg-indigo-200 transition-colors">
                             <IconPlus className="w-5 h-5" />
                         </button>
                     </div>

                     {quickReportItems.length > 0 && (
                         <div className="mt-4 flex justify-end">
                             <button 
                                onClick={handleSubmitQuickReport}
                                disabled={isSavingQuickReport}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-2"
                             >
                                 {isSavingQuickReport ? '...' : <><IconCheck className="w-4 h-4" /> {t.submitQuick}</>}
                             </button>
                         </div>
                     )}
                 </div>

                 {userKPIs.length > 0 && (
                     <div className="bg-pink-50 border border-pink-100 rounded-2xl p-6 shadow-sm">
                         <h3 className="font-bold text-pink-900 flex items-center gap-2 mb-4"><IconTarget className="w-5 h-5" /> {t.kpiWidget}</h3>
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
                     <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
                         <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-amber-900 flex items-center gap-2"><IconList className="w-5 h-5 text-amber-600" /> {t.pendingTasks} ({myPendingTasks.length})</h3><button onClick={() => setActiveTab('tasks')} className="text-amber-700 hover:text-amber-900 text-sm font-bold underline">{t.viewAll}</button></div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{myPendingTasks.slice(0, 4).map(task => (<div key={task.id} className="bg-white p-4 rounded-xl border border-amber-100 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow"><div><div className="font-bold text-gray-800 text-sm mb-1">{task.title}</div><div className="text-xs text-gray-500 flex items-center gap-2"><span className={`px-2 py-0.5 rounded ${task.priority === 'High' ? 'bg-red-100 text-red-600' : 'bg-gray-100'}`}>{task.priority}</span><span>{task.creatorName}</span></div></div><button onClick={() => setActiveTab('tasks')} className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-200">{t.doTask}</button></div>))}</div>
                     </div>
                 )}
                 <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                     <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                         <div className="flex gap-2">
                             <div className="flex bg-gray-100 p-1 rounded-lg">
                                 {canViewAllTickets && <button onClick={() => setFilterMode('all')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${filterMode === 'all' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>{t.allCompany}</button>}
                                 <button onClick={() => setFilterMode('my')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${filterMode === 'my' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>{t.myCartable}</button>
                                 <button onClick={() => setFilterMode('history')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${filterMode === 'history' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>{t.history}</button>
                             </div>
                             <select className="bg-gray-100 text-gray-600 text-sm font-bold px-3 py-1.5 rounded-lg border-transparent focus:border-gray-300 outline-none" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}><option value="all">{t.allStatuses}</option>{Object.values(TicketStatus).map(s => <option key={s} value={s}>{s}</option>)}</select>
                         </div>
                         <div className="relative w-full md:w-64">
                             <input type="text" className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100" placeholder={t.searchPlaceholder} value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} />
                             <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                         </div>
                     </div>
                     <div className="overflow-x-auto"><table className="w-full text-start"><thead className="bg-gray-50 text-gray-500 text-sm"><tr><th className="px-4 py-3 rounded-tr-lg text-center w-12">{t.row}</th><th className="px-4 py-3">{t.code}</th><th className="px-4 py-3">{t.service}</th><th className="px-4 py-3">{t.status}</th><th className="px-4 py-3">{t.expert}</th><th className="px-4 py-3 text-center rounded-tl-lg">{t.action}</th></tr></thead><tbody className="divide-y divide-gray-100">{paginatedTickets.map((ticket, idx) => (
                        <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-center text-xs font-bold text-gray-400">
                                {filteredTickets.length - ((currentPage - 1) * ITEMS_PER_PAGE + idx)}
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex flex-col">
                                    <span className="font-mono text-[10px] text-gray-400 mb-0.5">{ticket.id}</span>
                                    <span className="font-bold text-gray-800 text-sm" title={ticket.customerName}>{ticket.customerName}</span>
                                    {ticket.companyName && (
                                        <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded w-fit mt-0.5 border border-indigo-100 flex items-center gap-1">
                                           <IconBriefcase className="w-3 h-3" /> {ticket.companyName}
                                        </span>
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
                            <td className="px-4 py-3 text-center"><button onClick={() => setSelectedTicketId(ticket.id)} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors">{t.check}</button></td>
                        </tr>
                     ))}</tbody></table>{paginatedTickets.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">{t.notFound}</div>}</div>
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
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <div className="bg-purple-100 text-purple-600 p-2 rounded-lg"><IconProject className="w-6 h-6" /></div>
                        {t.projectDashboard}
                    </h2>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button onClick={() => setProjectSubTab('active')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${projectSubTab === 'active' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>
                                <IconActivity className="w-4 h-4" /> {t.activeProjects}
                            </button>
                            <button onClick={() => setProjectSubTab('history')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${projectSubTab === 'history' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>
                                <IconHistory className="w-4 h-4" /> {t.projectHistory}
                            </button>
                        </div>
                        <button onClick={() => setShowNewProjectModal(true)} className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-purple-700 flex items-center gap-2 shadow-lg shadow-purple-200">
                            <IconPlus className="w-5 h-5" /> {t.newProject}
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 w-12 text-center">{t.row}</th>
                                    <th className="px-6 py-4">{t.customer}</th>
                                    <th className="px-6 py-4">{t.service}</th>
                                    <th className="px-6 py-4">{t.progress}</th>
                                    <th className="px-6 py-4">{t.status}</th>
                                    <th className="px-6 py-4 text-center">{t.action}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {currentProjectDisplayList.map((project, idx) => (
                                    <tr key={project.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 text-center text-xs font-bold text-gray-400">{idx + 1}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{project.customerName}</div>
                                            <div className="text-[10px] text-gray-400 font-mono">#{project.id}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-gray-700">{getServiceTitle(project.serviceId)}</div>
                                            <div className={`inline-flex items-center gap-1 text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded ${getPriorityBadge(project.priority || 'Medium').bg} ${getPriorityBadge(project.priority || 'Medium').text}`}>
                                                <IconFlag className="w-2.5 h-2.5" /> {project.priority}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-full max-w-[120px]">
                                                <div className="flex justify-between text-[10px] text-gray-500 mb-1 font-bold">
                                                    <span>{project.projectData?.progress}%</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${project.projectData?.progress}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-[6px] text-[10px] font-bold ${getStatusBadge(project.status)}`}>
                                                {project.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => setSelectedTicketId(project.id)} className="bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all">
                                                {t.view}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {currentProjectDisplayList.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-20 text-center text-gray-400 bg-white italic">
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
            />
        )}
        {activeTab === 'sales' && <SalesDashboard currentUser={currentUser} personnel={personnel} services={services} onUpdatePersonnel={onUpdatePersonnel} onUpdateServices={onUpdateServices} lang={lang} />}
        {activeTab === 'messages' && <InternalMessenger currentUser={currentUser} personnel={personnel} messages={messages} lang={lang} />}
        {activeTab === 'tasks' && <TaskManager currentUser={currentUser} personnel={personnel} tasks={tasks} lang={lang} />}
        {activeTab === 'meetings' && <MeetingCalendar meetings={meetings} currentUser={currentUser} personnel={personnel} lang={lang} />}
        {activeTab === 'services' && hasTariffAccess && <ServiceManager services={services} onUpdate={onUpdateServices} readonly={!isAdmin && !isMaster} lang={lang} />}
        {activeTab === 'personnel' && isAdmin && <PersonnelManager personnel={personnel} config={config} onUpdate={onUpdatePersonnel} onUpdateConfig={onUpdateConfig} lang={lang} />}
        {activeTab === 'settings' && isAdmin && <SettingsManager config={config} personnel={personnel} onUpdate={onUpdateConfig} isMaster={isMaster} />}
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

        {activeTab === 'logs' && isMaster && (
            <div className="space-y-4 animate-fade-in">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><IconHistory className="w-6 h-6" /> {t.auditLogs}</h2></div>
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden"><table className="w-full text-start text-sm"><thead className="bg-gray-50 text-gray-500"><tr><th className="px-4 py-3">{t.time}</th><th className="px-4 py-3">{t.user}</th><th className="px-4 py-3">{t.operation}</th><th className="px-4 py-3">{t.entity}</th><th className="px-4 py-3">{t.details}</th><th className="px-4 py-3">{t.action}</th></tr></thead><tbody className="divide-y divide-gray-100">{systemLogs.map(log => (<tr key={log.id} className="hover:bg-gray-50"><td className="px-4 py-3 text-gray-500 dir-ltr text-right">{new Date(log.timestamp).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</td><td className="px-4 py-3 font-bold text-gray-700">{log.actorName}</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${log.actionType === 'DELETE' ? 'bg-red-100 text-red-700' : (log.actionType === 'CREATE' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}`}>{log.actionType}</span></td><td className="px-4 py-3">{log.entity}</td><td className="px-4 py-3 text-gray-600 truncate max-w-xs" title={log.details}>{log.details}</td><td className="px-4 py-3">{log.actionType === 'DELETE' && log.backupData && (<button onClick={() => handleRestore(log)} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1 font-bold text-xs"><IconRefreshCw className="w-3 h-3" /> {t.restore}</button>)}</td></tr>))}</tbody></table></div></div>
        )}
      </div>
      {selectedTicket && renderTicketModal()}
    </div>
  );
};
