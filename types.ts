
export enum TicketStatus {
  SUBMITTED = 'ثبت شده',
  PROCESSING = 'در حال بررسی',
  IN_PROGRESS = 'در دست اقدام',
  COMPLETED = 'تکمیل شده',
  CANCELLED = 'لغو شده'
}

export type Currency = 'IRR' | 'OMR' | 'USD';

export interface Price {
  amount: number;
  currency: Currency;
}

export interface AttachedFile {
  name: string;
  size: number;
  type: string;
  content: string; // Base64 or URL or Blob URL
  rawFile?: File; // Direct file reference for efficient upload
  status?: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  errorMsg?: string;
}

export interface SubService {
  id: string;
  title: string;
  titleEn?: string;
  price?: Price;
}

export interface ServiceOption {
  id: string;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  icon?: string;
  price?: Price;
  isActive: boolean;
  subServices?: SubService[];
  defaultCommission?: number;
}

export interface PersonnelPermissions {
  canAssign: boolean; 
  canViewCustomers: boolean; 
  canViewTariffs: boolean; 
  canViewAllTickets: boolean;
  canIssueInvoices: boolean;
}

export interface PersonnelDocument {
  id: string;
  title: string;
  file: AttachedFile;
}

export interface Personnel {
  id: string;
  fullName: string;
  roles: string[]; 
  jobDescription?: string; 
  reportsTo?: string;
  email: string;
  username: string;
  password?: string;
  avatar?: string; 
  documents?: PersonnelDocument[]; 
  status: 'active' | 'inactive';
  permissions?: PersonnelPermissions;
  customCommissions?: Record<string, number>;
}

export interface Customer {
  id: string;
  fullName: string;
  companyName?: string; 
  location: string; 
  phoneNumber: string;
  whatsappNumber: string;
  email?: string;
  businessType?: string;
  firstContact: string;
  totalTickets: number;
  source?: string; 
  loyaltyCode?: string;
}

export interface TimelineEntry {
  type: 'status_change' | 'comment' | 'assignment' | 'creation' | 'update' | 'project_update' | 'invoice_created';
  title: string;
  description?: string; 
  actorName: string; 
  timestamp: string;
  visibility?: 'public' | 'internal';
}

export interface Payment {
  id: string;
  amount: number;
  currency: Currency;
  date: string;
  type: 'deposit' | 'settlement' | 'installment';
  note?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate?: string;
  customerName: string;
  companyName?: string;
  items: InvoiceItem[];
  currency: Currency;
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  note?: string;
  issuedBy: string;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate?: string;
}

export interface ProjectRisk {
  id: string;
  title: string;
  impact: 'Low' | 'Medium' | 'High';
}

export interface ProjectTeamMember {
  userId: string;
  role: string;
  responsibility: string;
  joinedAt: string;
}

export interface ProjectDetails {
  isActive: boolean;
  tariff?: Price;
  startDate: string;
  endDate: string;
  teamMemberIds: string[]; 
  teamMembers?: ProjectTeamMember[];
  projectFiles: AttachedFile[];
  payments: Payment[];
  invoices?: Invoice[];
  milestones?: ProjectMilestone[];
  risks?: ProjectRisk[];
  progress: number; 
  statusNote?: string;
}

export interface Ticket {
  id: string;
  customerName: string; 
  companyName?: string; 
  location: string; 
  phoneNumber: string;
  whatsappNumber: string; 
  businessType?: string; 
  serviceId: string;
  selectedSubServices?: string[];
  description: string;
  files?: AttachedFile[];
  status: TicketStatus;
  createdAt: string;
  aiAnalysis?: string;
  priority?: 'Low' | 'Medium' | 'High';
  assignedTo?: string;
  timeline: TimelineEntry[]; 
  customData?: Record<string, string>; 
  projectData?: ProjectDetails;
  discountApplied?: boolean;
}

export interface InternalMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientIds: string[];
  recipientNames: string[];
  subject: string;
  body: string;
  files?: AttachedFile[];
  createdAt: string;
  readBy: string[];
}

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: string;
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  creatorId: string;
  creatorName: string;
  assigneeIds: string[];
  isCompleted: boolean;
  checklist?: TaskChecklistItem[];
  dueDate?: string;
  priority: 'Low' | 'Medium' | 'High';
  createdAt: string;
  comments: TaskComment[];
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  organizerId: string;
  organizerName: string;
  attendeeIds: string[];
  description?: string;
}

export interface KPI {
  id: string;
  title: string;
  titleEn?: string;
  targetValue: number;
  currentValue: number;
  unit: 'percent' | 'count' | 'currency';
  period: 'monthly' | 'quarterly' | 'yearly';
  assignedRole?: string;
  assignedUserId?: string;
  description?: string;
}

export interface CustomForm {
  id: string;
  title: string;
  titleEn?: string;
  category: string;
  description?: string;
  descriptionEn?: string;
  fields: FormField[];
  allowedRoles: string[];
  allowedPersonnelIds?: string[]; // specific people who can see this form
  allowAttachments?: boolean;     // whether submitters can attach files
  isPublic?: boolean;
  assigneePersonnelId?: string;  // assign to specific person
  assigneeRole?: string;         // assign to first person with this role
  createdAt: string;
  createdBy: string;
}

export interface SalesRecord {
  id: string;
  salespersonId: string;
  salespersonName: string;
  serviceId: string;
  serviceTitle: string;
  customerName: string;
  saleAmount: number;           // Total contract / invoice amount
  receivedAmount?: number;      // Amount actually received so far
  paymentStatus?: 'received' | 'partial' | 'pending';
  currency: Currency;
  commissionRate: number;
  commissionAmount: number;
  commissionPaid?: boolean;
  depositAccount: string;
  depositDate: string;
  notes?: string;
  snapshotRates?: { USD_IRR: number; OMR_IRR: number };
  saleAmountIRR?: number;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

// --- Expense Management Types ---
export type ExpenseCategory =
  | 'cogs'             // بهای تمام‌شده خدمات / کالا
  | 'salary_benefits'  // حقوق، دستمزد و مزایا
  | 'rent_utilities'   // اجاره، قبوض و تأسیسات
  | 'marketing_ads'    // بازاریابی و تبلیغات
  | 'admin_general'    // هزینه‌های اداری و عمومی
  | 'it_software'      // فناوری اطلاعات و نرم‌افزار
  | 'sales_commission' // کمیسیون فروش و بازاریابی
  | 'tax_legal'        // مالیات، عوارض و هزینه حقوقی
  | 'depreciation'     // استهلاک دارایی‌ها
  | 'financial_costs'  // هزینه‌های مالی و بانکی
  | 'capex'            // سرمایه‌گذاری و خرید دارایی ثابت
  | 'other'            // سایر هزینه‌ها
  // legacy keys (backward compat with existing Firebase data)
  | 'operational' | 'non_operational' | 'salary' | 'tax' | 'marketing' | 'rent' | 'designer_commission';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  paidAmount?: number; // Added for partial payments
  currency: Currency;
  category: ExpenseCategory;
  date: string;
  paidTo: string; // The person or company receiving the payment
  personnelId?: string; // Link to a company personnel if applicable
  description?: string;
  files?: AttachedFile[];
  status: 'paid' | 'pending' | 'partial';
  createdAt: string;
  createdBy: string;
}

// --- Reporting Types ---
export type ReportType = 'daily' | 'weekly' | 'monthly';

export interface PerformanceReport {
  id: string;
  userId: string;
  userName: string;
  type: ReportType;
  date: string; // YYYY-MM-DD or YYYY-WW or YYYY-MM
  content: string;
  completedTasks: string[]; // Linear list of task descriptions
  status: 'draft' | 'submitted';
  createdAt: string;
  updatedAt: string;
}

// --- Goal Tracker Types ---
export interface GoalSubTask {
  id: string;
  text: string;
  isCompleted: boolean;
}

export interface GoalTask {
  id: string;
  text: string;
  isCompleted: boolean;
  subTasks?: GoalSubTask[]; // New: Sub-steps for break-down
}

export interface GoalCategory {
  id: string;
  title: string;
  color: string; 
  tasks: GoalTask[];
  type: 'personal' | 'business';
}

export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'five_year';

export interface UserGoals {
  id: string; // docId: userId_period
  userId: string;
  userName: string;
  period: GoalPeriod;
  lastUpdated: string;
  categories: GoalCategory[];
}

export interface StrategicObjective {
  id: string;
  title: string;
  description?: string;
  ownerId: string;
  department?: string;
  period: string; // e.g., "Q1 2024"
  status: 'on_track' | 'at_risk' | 'behind' | 'completed';
  keyResults: KeyResult[];
  createdAt: string;
  updatedAt: string;
}

export interface KeyResult {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  weight: number; 
}

export interface SystemLog {
  id: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'OTHER';
  entity: 'Ticket' | 'Customer' | 'Personnel' | 'Project' | 'Task' | 'Meeting' | 'Message' | 'System' | 'KPI' | 'CustomForm' | 'Sale' | 'Report' | 'Goals' | 'Objective' | 'Expense' | 'News';
  entityId?: string;
  details: string;
  actorName: string;
  actorId?: string;
  timestamp: string;
  backupData?: any;
  collectionName?: string;
}

export interface FeaturedBusiness {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  websiteUrl?: string;
  contactNumber?: string;
  category: string;
  isGold: boolean;
}

export type ViewState = 'landing' | 'new-ticket' | 'tracking' | 'admin' | 'news' | 'custom-form';

export interface NewsArticle {
  id: string;
  title: string;
  titleEn?: string;
  slug: string;
  summary: string;
  summaryEn?: string;
  content: string;
  contentEn?: string;
  category: string;
  categories?: string[];
  tags: string[];
  publishedAt: string;
  isPublished: boolean;
  coverImage?: string;
  author: string;
  viewCount: number;
  metaDescription?: string;
  metaKeywords?: string;
}

export type FormFieldType = 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'select' | 'header' | 'date' | 'checkbox' | 'file';

export interface FormField {
  id: string;
  key: string; 
  label: string;
  labelEn?: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  placeholderEn?: string;
  options?: string[];
  optionsEn?: string[];
  isSystem?: boolean; 
  order: number;
}

export interface InvoiceTemplate {
  companyName: string;
  logoUrl?: string;
  address: string;
  phone: string;
  website?: string;
  footerText: string;
  termsConditions: string;
  defaultTaxRate: number;
  colorTheme: string;
}

export type AssignmentMode = 'manual' | 'auto_load_balance' | 'random';
export type AssignmentTargetType = 'role' | 'personnel';

export interface AssignmentConfig {
  mode: AssignmentMode;
  targetType?: AssignmentTargetType;
  serviceRoleMap: Record<string, string>; 
  servicePersonnelMap?: Record<string, string>;
}

export type SocialPlatform = 'instagram' | 'linkedin' | 'whatsapp' | 'facebook' | 'telegram' | 'twitter';

export type NotificationProvider = 'callmebot' | 'ultramsg' | 'webhook';

export interface NotificationConfig {
  enabled: boolean;
  provider: NotificationProvider;
  // UltraMsg (org-level — one key for all)
  ultraMsgToken?: string;
  ultraMsgInstance?: string;
  // Custom webhook
  webhookUrl?: string;
  // Events to trigger
  onNewTicket: boolean;
  onNewMessage: boolean;
  onStatusChange: boolean;
  // Message templates ({recipientName}, {ticketId}, {customerName}, {senderName}, {status}, {formTitle})
  ticketTemplate: string;
  messageTemplate: string;
  statusTemplate: string;
  // Per-person config (keyed by personnel ID)
  personnelPhones: Record<string, string>;    // WhatsApp phone number
  personnelApiKeys: Record<string, string>;   // CallMeBot API key (per person)
}

export interface NotificationLog {
  id: string;
  type: 'new_ticket' | 'new_message' | 'status_change' | 'test';
  recipientId: string;
  recipientName: string;
  phone: string;
  message: string;
  status: 'sent' | 'failed';
  error?: string;
  ticketId?: string;
  createdAt: string;
}

export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  url: string;
  isActive: boolean;
  order: number;
}

export interface AppConfig {
  appTitle: string;
  appTitleEn: string;
  appSubtitle: string;
  appSubtitleEn: string;
  landingHeroTitle?: string;
  landingHeroSubtitle?: string;
  footerText?: string;
  socialLinks?: SocialLink[];
  notificationConfig?: NotificationConfig;
  dailyTips?: string[];
  showDailyTips?: boolean;
  featuredBusinesses?: FeaturedBusiness[];
  formFields: FormField[];
  personnelRoles?: string[];
  invoiceTemplate?: InvoiceTemplate;
  assignmentConfig?: AssignmentConfig;
  topPerformerId?: string;
  favicon?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  metaPortUrl?: string;
  heroBgImage?: string;
}

export interface AnalyticsEvent {
  id: string;
  timestamp: string;
  page: string;
  articleSlug?: string;
  country: string;
  countryCode: string;
  city: string;
  device: 'mobile' | 'tablet' | 'desktop';
  sessionId: string;
  referrer?: string;
}
