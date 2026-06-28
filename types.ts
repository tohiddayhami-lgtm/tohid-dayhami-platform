
export enum TicketStatus {
  SUBMITTED = 'ثبت شده',
  PROCESSING = 'در حال بررسی',
  IN_PROGRESS = 'در دست اقدام',
  COMPLETED = 'تکمیل شده',
  CANCELLED = 'لغو شده'
}

export type Currency = 'IRR' | 'OMR' | 'USD' | 'EUR' | 'AED' | 'AUD';

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
  /** Optional multi-currency tariffs (overrides single price when set). */
  prices?: Price[];
  routeDepartmentId?: string; // auto-route requests of this sub-service to a department
  routePosition?: string;     // auto-route requests of this sub-service to a position/سمت (takes priority over department)
}

export interface ServiceOption {
  id: string;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  icon?: string;
  price?: Price;
  /** Optional multi-currency tariffs (overrides single price when set). */
  prices?: Price[];
  isActive: boolean;
  subServices?: SubService[];
  defaultCommission?: number;
  routeDepartmentId?: string; // auto-route requests of this service to a department
  routePosition?: string;     // auto-route requests of this service to a position/سمت (takes priority over department)
}

export interface PersonnelPermissions {
  canAssign: boolean; 
  canViewCustomers: boolean; 
  canViewTariffs: boolean; 
  canViewAllTickets: boolean;
  canIssueInvoices: boolean;      // create & edit own invoices
  canViewAllInvoices?: boolean;   // view all invoices in archive (master/admin always)
  canManageMetaShop?: boolean;    // access Meta Shop panel; edit shops, bazaars, expos, booth layout
  canDeleteMetaShop?: boolean;    // delete whole shops/bazaars (booth delete stays admin-only)
  allowedMetaShopIds?: string[];  // if set, staff only sees/edits these shop ids in the panel
}

export interface PersonnelDocument {
  id: string;
  title: string;
  file: AttachedFile;
}

export interface Department {
  id: string;
  name: string;
  positions: string[]; // names of positions (from personnelRoles) assigned to this department
  showInContact?: boolean; // whether this department is shown to customers in the "Contact Us" form (undefined = shown, for backward compatibility)
  contactLabel?: string; // optional custom label shown to customers in the "Contact Us" form instead of the department name (e.g. "ارتباط با مدیرعامل")
  contactRecipientPosition?: string; // if set, contact messages route only to this position/role; otherwise to the whole department
}

export interface Personnel {
  id: string;
  fullName: string;
  roles: string[];
  jobDescription?: string;
  /** Manager note visible to this person in their dashboard (under job description). */
  staffNote?: string;
  reportsTo?: string;
  email: string;
  username: string;
  staffCode?: string; // dedicated personnel/messaging ID — colleagues use it to message this person
  password?: string;
  avatar?: string;
  /** رزومه / معرفی عمومی برای صفحه رزرو مشاوره */
  consultantBio?: string;
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
  labelIds?: string[];
}

export interface TimelineEntry {
  type: 'status_change' | 'comment' | 'assignment' | 'creation' | 'update' | 'project_update' | 'invoice_created' | 'customer_upload';
  title: string;
  description?: string;
  actorName: string;
  timestamp: string;
  visibility?: 'public' | 'internal';
  files?: AttachedFile[];
}

export interface CustomerUploadWindow {
  isOpen: boolean;
  openedBy: string;
  openedAt: string;
  expiresAt: string;
  prompt: string;
  promptEn?: string;
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
  /** نمایش «Included» به‌جای قیمت — در جمع فاکتور لحاظ نمی‌شود */
  priceIncluded?: boolean;
}

/** Extra line in totals area — fees, discounts, or other charges (not main line items). */
export interface InvoiceAdjustment {
  id: string;
  label: string;
  amount: number; // positive = charge, negative = discount
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate?: string;
  customerName: string;
  companyName?: string;
  // ── Customer snapshot (for standalone invoices in the Invoices archive) ──
  customerId?: string;        // linked customer-bank record, if picked from the bank
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  items: InvoiceItem[];
  currency: string;                        // preset (AED, USD, …) or any custom code
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  note?: string;
  issuedBy: string;
  issuedByPersonnelId?: string;    // personnel id of issuer (for access control)
  status?: 'draft' | 'issued' | 'paid';  // archive status
  createdAt?: string;                      // when first created (for sorting the archive)
  documentTitle?: string;                  // header title — e.g. INVOICE, PROFORMA INVOICE
  qtyColumnLabel?: string;                 // line items table — default "QTY"
  unitPriceColumnLabel?: string;           // line items table — default "UNIT PRICE"
  type?: string;                           // legacy — no longer shown in UI
  paymentTerms?: string;                   // payment terms box (defaults from template)
  vatInclusive?: boolean;                  // true => VAT is included in the line amounts
  adjustments?: InvoiceAdjustment[];       // extra fees / discounts below line items
  paymentDetails?: string;                 // free-form bank / payment block (copy-paste, preset-able)
  receipts?: InvoiceReceipt[];             // partial / full payments received
  amountPaid?: number;                   // cached sum of receipts (for archive display)
  balanceDue?: number;                   // total − amountPaid
  amountDecimals?: 0 | 1 | 2 | 3;        // per-invoice display/input precision
}

export interface InvoiceReceipt {
  id: string;
  amount: number;
  date: string;                            // YYYY-MM-DD
  method?: string;                         // e.g. Bank Transfer, Cash
  reference?: string;                      // transaction ref
  note?: string;
  recordedBy: string;
  recordedAt: string;
}

export type InvoiceSectionKey = 'paymentTerms' | 'paymentDetails' | 'items' | 'adjustments' | 'notes' | 'vat';

/** Named snapshot of one invoice section — stored in Firebase for reuse across invoices. */
export interface InvoiceSectionPreset {
  id: string;
  name: string;
  section: InvoiceSectionKey;
  createdAt: string;
  createdBy: string;
  billTo?: {
    customerName?: string;
    companyName?: string;
    customerPhone?: string;
    customerAddress?: string;
    customerEmail?: string;
  };
  paymentTerms?: string;
  paymentDetails?: string;
  items?: InvoiceItem[];
  qtyColumnLabel?: string;
  unitPriceColumnLabel?: string;
  adjustments?: InvoiceAdjustment[];
  note?: string;
  taxRate?: number;
  vatInclusive?: boolean;
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

export type ProjectPartyType = 'client' | 'partner' | 'supplier' | 'investor' | 'other';

export interface ProjectParty {
  id: string;
  name: string;
  type: ProjectPartyType;
  company?: string;
  phone?: string;
  profitSharePercent: number;
  notes?: string;
  addedAt: string;
}

export interface ProjectDefinitionItem {
  id: string;
  category: string;
  label: string;
  value: string;
  fileUrl?: string;
  fileName?: string;
  addedAt: string;
  addedBy: string;
}

export interface ProjectDetails {
  isActive: boolean;
  category?: string;
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
  parties?: ProjectParty[];
  definitions?: ProjectDefinitionItem[];
}

export interface TicketLabel {
  id: string;
  name: string;
  color: string; // 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'gray'
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
  customerUploadWindow?: CustomerUploadWindow;
  isFlagged?: boolean; // legacy global flag — prefer flaggedBy
  /** Personnel ids who flagged this case in their own cartable. */
  flaggedBy?: string[];
  labelIds?: string[];
}

export interface ContactReply {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

// A referral/forward of a correspondence to other personnel or a department
export interface MessageReferral {
  id: string;
  byId: string;            // who referred it
  byName: string;
  toNames: string[];       // personnel names it was referred to
  departmentName?: string; // department name, if referred to a whole department
  note?: string;           // optional note from the referrer
  createdAt: string;
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
  // ── Customer "Contact Us" messages (from public tracking page) ──
  isCustomerContact?: boolean;      // true if originated from a customer via the tracking page
  contactName?: string;             // name the customer registered with
  contactPhone?: string;            // mobile they registered with — used for recognition & reply lookup
  contactDepartmentId?: string;     // selected department id
  contactDepartmentName?: string;   // selected department name (snapshot)
  contactTrackingCode?: string;     // human-friendly tracking code for the correspondence (shown in کارتابل & to the customer)
  customerId?: string;              // linked customer record (resolved by phone)
  replies?: ContactReply[];         // staff replies, visible to the customer by name+mobile
  referrals?: MessageReferral[];    // history of referrals/forwards to other personnel/departments
  archivedBy?: string[];            // personnel ids who archived this message (per-user archive, keeps inbox/sent tidy)
  hiddenBy?: string[];              // personnel ids who removed this from their inbox/sent (per-user soft delete)
}

/** Sticky-note color for team brainstorm board. */
export type TeamBrainstormColor = 'yellow' | 'pink' | 'mint' | 'sky' | 'lavender' | 'peach';

export interface TeamBrainstormComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  files?: AttachedFile[];
  likedBy?: string[];
  parentId?: string;
  createdAt: string;
}

export interface TeamBrainstormPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  title: string;
  body: string;
  color: TeamBrainstormColor;
  files?: AttachedFile[];
  likedBy?: string[];
  comments?: TeamBrainstormComment[];
  createdAt: string;
  updatedAt?: string;
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

export type MeetingKind = 'internal' | 'bookable';
export type MeetingBookingStatus = 'open' | 'pending' | 'confirmed';
export type MeetingSessionType = string;

export interface MeetingBookingGuest {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  note?: string;
  bookedAt: string;
  /** کد پیگیری رزرو — برای مشتری و صفحه پیگیری */
  trackingCode?: string;
}

export interface ConsultationFollowUpAttachment {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
}

export interface ConsultationFollowUp {
  recommendations?: string;
  attachments?: ConsultationFollowUpAttachment[];
  publishedAt?: string;
  publishedBy?: string;
}

/** دسته‌بندی موضوعی مشاوران (کسب‌وکار، املاک، …) */
export interface ConsultantCategory {
  id: string;
  nameFa: string;
  nameEn: string;
  sortOrder?: number;
  icon?: string;
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
  /** internal = پرسنل (مخفی از تقویم عمومی) | bookable = قابل رزرو مشتری */
  kind?: MeetingKind;
  bookingStatus?: MeetingBookingStatus;
  sessionType?: MeetingSessionType;
  consultantId?: string;
  consultantName?: string;
  /** دسته موضوعی مشاوره */
  consultantCategoryId?: string;
  /** رزومه اختصاصی این جلسه (مشاور قراردادی یا بازنویسی) */
  consultantBio?: string;
  /** عکس اختصاصی این جلسه */
  consultantPhoto?: string;
  price?: Price;
  prices?: Price[];
  guests?: MeetingBookingGuest[];
  confirmedGuestId?: string;
  /** پیشنهادات و فایل‌های پس از جلسه (برای مهمان قطعی‌شده) */
  followUp?: ConsultationFollowUp;
  sessionCompletedAt?: string;
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
  isClosed?: boolean;            // when true, the form no longer accepts submissions (link shows a "deadline ended" message)
  closedMessage?: string;        // optional custom message shown when the form is closed
  assigneePersonnelId?: string;  // assign to specific person
  assigneeRole?: string;         // assign to first person with this role
  createdAt: string;
  createdBy: string;
}

export interface PaymentInstallment {
  id: string;
  amount: number;
  date: string;
  note?: string;
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
  installments?: PaymentInstallment[];
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
  paidAmount?: number;
  installments?: PaymentInstallment[];
  currency: Currency;
  category: ExpenseCategory;
  date: string;
  paidTo: string;
  personnelId?: string;
  description?: string;
  files?: AttachedFile[];
  status: 'paid' | 'pending' | 'partial';
  snapshotRates?: { USD_IRR: number; OMR_IRR: number };
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
  entity: 'Ticket' | 'Customer' | 'Personnel' | 'Project' | 'Task' | 'Meeting' | 'Message' | 'System' | 'KPI' | 'CustomForm' | 'Sale' | 'Report' | 'Goals' | 'Objective' | 'Expense' | 'News' | 'Invoice' | 'InvoicePreset' | 'MetaShop' | 'MetaShopOrder' | 'MetaBazaar';
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

export type ViewState = 'landing' | 'new-ticket' | 'tracking' | 'admin' | 'export-shops' | 'news' | 'custom-form' | 'metashop' | 'shopsdir' | 'bazaar' | 'expo' | 'expo-map' | 'booking' | 'consultation-track';

// ═══════════════════ META SHOP (online catalogs / shops) ═══════════════════
export type MetaShopType = 'products' | 'services' | 'realestate';

export interface MetaShopTheme {
  primary: string;     // accent: buttons, prices, active states
  cover: string;       // cover/hero background
  coverText: string;   // text on the cover
  bg: string;          // page background
  heading: string;     // headings
  text: string;        // body text
}

export interface MetaShopColorOption { name: string; hex: string; hex2?: string; }

// Bilingual bazaar category / subcategory label
export interface MetaShopDirCat { fa?: string; en?: string; ar?: string; zh?: string; [lang: string]: string | undefined; }

// ── Meta Bazaar: a curated, multi-level directory of shops with its own link ──
export interface MetaBazaarNode {
  id: string;
  label: MetaShopDirCat;          // bilingual node label (e.g. {fa:'ایران', en:'Iran'})
  children?: MetaBazaarNode[];    // nested subcategories — ANY depth (optional)
  shopSlugs?: string[];           // shops shown at this node
}
export interface MetaBazaar {
  id: string;
  slug: string;                   // public link key (?bazaar=<slug>)
  name: string;
  isActive: boolean;
  defaultLang?: string;           // 'en' | 'fa' | ... (visitor can toggle)
  title?: MetaShopDirCat;
  subtitle?: MetaShopDirCat;
  coverImage?: string;
  logo?: string;
  theme?: Partial<MetaShopTheme>;
  levelLabels?: MetaShopDirCat[]; // optional names for each depth level (Country, City, Group, ...)
  tree: MetaBazaarNode[];         // category tree; leaves (or any node) carry shopSlugs
  expo?: MetaverseExpo;           // optional 3D / metaverse exhibition for this bazaar (one bazaar = one expo)
  createdAt?: string;
}

// ═══════════════════ METAVERSE EXHIBITION (3D / WebXR virtual expo) ═══════════════════
// A bazaar can host a walkable 3D exhibition hall. Visitors explore on desktop/mobile/tablet
// or with a VR headset (WebXR), click booths/objects, and contact exhibitors or place orders.
// Everything below stores only metadata + URLs (GLB/images live in Firebase Storage), so the
// whole expo fits comfortably inside the parent MetaBazaar Firestore document.

// What a clickable in-world marker does when tapped
export type HotspotType =
  | 'product'    // show a product (by id) from the linked shop
  | 'company'    // open the exhibitor's shop / company profile
  | 'video'      // play a video (YouTube / Vimeo / mp4) in a popup
  | 'pdf'        // open a PDF / catalog
  | 'image'      // show a full image
  | 'url'        // external website link
  | 'page'       // a specific content page (MetaShopPage) of the linked shop
  | 'whatsapp'   // open WhatsApp chat
  | 'contact'    // show phone / email contact card
  | 'order';     // jump into the shop's order flow (?shop=<slug>)

export interface MetaverseHotspot {
  id: string;
  // world position (meters) — placed relative to the hall, resolved in the editor
  x: number; y: number; z: number;
  ry?: number;                  // optional yaw rotation (radians)
  type: HotspotType;
  title?: MetaShopDirCat;       // bilingual label shown on the marker / modal header
  body?: MetaShopDirCat;        // bilingual descriptive text (info / contact)
  url?: string;                 // video / pdf / image / external URL
  shopSlug?: string;            // target shop for company/order/page/product
  productRef?: string;          // product id within the target shop
  pageId?: string;              // MetaShopPage id (type 'page')
  phone?: string;
  whatsapp?: string;            // phone number for wa.me link
  email?: string;
  icon?: string;                // optional emoji/marker glyph
  color?: string;               // marker accent color
}

// The six panel surfaces of a booth: each of the 3 walls has an inner face (toward the booth
// interior) and an outer face (the aisle side). Each can show an image OR a video link.
export type BoothFace = 'innerBack' | 'innerLeft' | 'innerRight' | 'outerBack' | 'outerLeft' | 'outerRight';

/** Product carousel monitor mounted on a booth wall face. */
export interface BoothProductSlideshow {
  enabled?: boolean;
  /** Seconds between auto-advance (default 5). Manual prev/next always available. */
  autoPlaySec?: number;
  /** Empty = all active products with images from the linked shop. */
  productIds?: string[];
}

/** Which booth side points toward the hall entrance (+Z wall); geometry spins in place, `ry` unchanged. */
export type BoothEntranceFacing = 'front' | 'left' | 'right' | 'back';
export type BoothTier = 'basic' | 'standard' | 'premium';
export type ExpoVisualStyle = 'exhibition' | 'storefront' | 'supermarket' | 'business_center';

export interface ExpoRetailCategory {
  id: string;
  title: MetaShopDirCat;
  description?: MetaShopDirCat;
  color?: string;
  shopSlugs?: string[];
  x?: number;
  z?: number;
  w?: number;
  d?: number;
}

export interface MetaverseBooth {
  id: string;
  name: MetaShopDirCat;         // bilingual booth / company name
  shopSlug?: string;            // links the booth to an existing MetaShop (the exhibitor)
  // placement on the hall floor
  x: number; y: number; z: number;
  ry?: number;                  // facing rotation (radians)
  entranceFacing?: BoothEntranceFacing; // which booth side faces the hall entrance (in-place, keeps ry)
  scale?: number;               // uniform scale (default 1)
  tier?: BoothTier;             // visual/advertising package: basic, standard, premium
  // visuals
  modelUrl?: string;            // optional custom GLB/GLTF (Storage documents/ URL) — overrides procedural booth
  modelScale?: number;          // GLB size multiplier after auto-fit (default 1)
  modelRy?: number;             // GLB extra Y rotation (radians), in-place on top of layout ry
  color?: string;               // accent color for the procedural booth
  floorId?: 0 | 1 | 2;          // legacy business_center floor (deprecated)
  categoryId?: string;            // supermarket: retail department zone
  storefrontSignText?: MetaShopDirCat;  // optional storefront signboard text
  storefrontGlassText?: MetaShopDirCat; // optional service text printed on the glass facade
  premiumSignText?: MetaShopDirCat; // optional rotating LCD text for premium booths
  premiumSignColor?: string;     // rotating LCD background/accent color
  logo?: string;                // logo image URL (Storage images/)
  managerPngs?: string[];       // up to 5 life-size transparent PNG people shown behind the counter
  managerEnabled?: boolean[];   // optional visibility toggle per counter person (default: enabled)
  managerNames?: MetaShopDirCat[]; // optional names displayed above those PNG people
  managerLinks?: string[];      // optional clickable links for those PNG people
  managerAudios?: string[];     // legacy/fallback audio files played when those PNG people are clicked
  managerAudiosFa?: string[];   // Persian audio files for those PNG people
  managerAudiosEn?: string[];   // English audio files for those PNG people
  counterGlbs?: string[];       // up to 5 standardized miniature GLB models displayed on the counter
  bannerImage?: string;         // banner image URL (Storage images/)
  screenUrl?: string;           // (legacy) video link for the in-world LCD — now the innerBack panel fallback
  // Per-face media: each value is an image URL or a video link (YouTube/Vimeo/mp4). Videos
  // auto-play muted & looping on an in-world screen; images render on the wall panel.
  panels?: Partial<Record<BoothFace, string>>;
  /** Per-wall product slideshow monitors — shows linked shop catalog with prev/next controls. */
  productSlideshows?: Partial<Record<BoothFace, BoothProductSlideshow>>;
  hotspots?: MetaverseHotspot[];
  meetEnabled?: boolean;        // per-booth WhatsApp contact badge (legacy field name)
  meetUrl?: string;             // https://wa.me/… or phone number
  meetTitle?: MetaShopDirCat;   // optional short caption under the icon
  meetSide?: 'left' | 'right';  // left/right of center counter on the visitor-facing front (default left)
}

// drei <Environment> presets used for image-based lighting / skybox when no custom HDR is given
export type EnvPreset = 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'park' | 'lobby';

export type ExpoWall = 'back' | 'left' | 'right' | 'front';

// An environmental advertising banner mounted on one of the hall's perimeter walls. Clickable
// (opens its link in a new tab). u/v are normalized placement along the wall (0..1); w/h in meters.
export interface ExpoWallAd {
  id: string;
  wall: ExpoWall;
  size?: string;         // preset banner size key (see BANNER_SIZES) — drives w/h
  w?: number;            // width (meters) — set from the chosen size preset
  h?: number;            // height (meters)
  scale?: number;        // per-banner multiplier, applied after the global wallAdScale
  lift?: number;         // per-banner vertical offset in meters, applied after global wallAdLift
  image?: string;        // banner image URL
  url?: string;          // hyperlink — opens in a new tab
  title?: MetaShopDirCat;
  enabled?: boolean;     // false = hidden in the 3D hall (default: shown)
  // Position is auto-distributed along the wall based on the hall — no manual u/v needed.
}

export type ExpoEntranceAdPosition = 'aboveArch' | 'archLeft' | 'archRight' | 'railLeft' | 'railRight';

export interface ExpoEntranceAd {
  id: string;
  position: ExpoEntranceAdPosition;
  size?: string;
  w?: number;
  h?: number;
  lift?: number;          // vertical offset for above-arch banners (meters)
  image?: string;
  url?: string;
  title?: MetaShopDirCat;
  enabled?: boolean;     // false = hidden in the 3D hall (default: shown)
}

// A large page-turnable PDF presentation mounted on a hall wall (default the far/end wall).
// Pages are rasterized to textures so it works on phone AND in VR; arrows flip pages.
export interface ExpoPresentation {
  enabled?: boolean;
  pdfUrl?: string;
  wall?: ExpoWall;       // which wall (default 'back')
  u?: number;            // 0..1 horizontal position
  v?: number;            // 0..1 vertical center
  w?: number;            // width (meters)
  h?: number;            // height (meters)
  framePad?: number;     // dark border padding in meters (0 = none)
  pdfFit?: 'contain' | 'cover' | 'fill';
}

export interface ExpoMeetWall {
  enabled?: boolean;
  url?: string;          // Google Meet / video call URL
  wall?: ExpoWall;       // wall that shows the call screen
  u?: number;            // 0..1 horizontal position along the wall
  v?: number;            // 0..1 vertical center
  w?: number;            // width (meters)
  h?: number;            // height (meters)
  title?: MetaShopDirCat;
}

export interface ExpoPresenceSettings {
  enabled?: boolean;
  avatarsEnabled?: boolean;
}

/** Free-placed GLB prop anywhere in the exhibition hall (decor / furniture / signage). */
export interface ExpoDecoration {
  id: string;
  modelUrl: string;
  name?: MetaShopDirCat;        // editor label only
  x: number;
  y: number;                    // height above floor (meters)
  z: number;
  ry?: number;                  // Y rotation (radians)
  scale?: number;               // uniform scale multiplier (default 1)
  linkUrl?: string;             // opens in a new tab when clicked (if no audio)
  audioUrl?: string;            // legacy/fallback audio
  audioUrlFa?: string;
  audioUrlEn?: string;
}

/** Media / interactive button placed in a custom GLB environment (world coordinates). */
export type ExpoEnvironmentMediaKind =
  | 'image' | 'video' | 'pdf' | 'html' | 'audio' | 'glb' | 'button';

export type ExpoEnvironmentButtonAction =
  | 'url' | 'whatsapp' | 'phone' | 'meet' | 'contact';

export interface ExpoEnvironmentMedia {
  id: string;
  kind: ExpoEnvironmentMediaKind;
  x: number;
  y: number;
  z: number;
  ry?: number;                  // Y rotation (radians)
  w?: number;                   // screen width in meters (default 2)
  h?: number;                   // screen height in meters (default 1.2)
  scale?: number;               // uniform scale multiplier (default 1)
  url?: string;                 // media file / link
  title?: MetaShopDirCat;       // label on map & button caption
  action?: ExpoEnvironmentButtonAction;
  phone?: string;
  whatsapp?: string;
  email?: string;
  meetUrl?: string;
  icon?: string;                // emoji glyph for buttons
  color?: string;               // accent color
  framePad?: number;            // dark border padding in meters (0 = none)
  pdfFit?: 'contain' | 'cover' | 'fill'; // how PDF fills the screen (default contain)
}

export interface MetaverseExpo {
  enabled: boolean;
  defaultLang?: string;         // opening language code (visitor can switch)
  languages?: MetaShopLang[];   // supported languages — English is always included
  visualStyle?: ExpoVisualStyle; // exhibition booths, glass storefronts, or supermarket departments
  title?: MetaShopDirCat;
  subtitle?: MetaShopDirCat;
  // environment
  environmentUrl?: string;      // optional hall/environment GLB (Storage documents/)
  environmentScale?: number;    // extra scale multiplier after auto-fit (default 1)
  environmentRy?: number;     // Y rotation (radians)
  environmentX?: number;        // position offset (meters)
  environmentY?: number;
  environmentZ?: number;
  environmentAutoFit?: boolean; // fit GLB footprint to max(width, depth) — default true when URL set
  environmentReplacesHall?: boolean; // hide procedural walls/floor/ceiling — default true when URL set
  environmentCollision?: boolean; // block walking through walls; follow stairs/floors — default true when URL set
  environmentMedia?: ExpoEnvironmentMedia[]; // free-placed screens, files & buttons inside custom GLB hall
  skyboxUrl?: string;           // optional HDR / equirectangular image
  preset?: EnvPreset;           // drei Environment preset when no custom HDR
  groundColor?: string;
  wallColor?: string;
  width?: number; depth?: number; height?: number; // hall dimensions (meters)
  spawn?: { x: number; y: number; z: number; ry?: number }; // visitor start position
  entranceEnabled?: boolean;     // optional professional entry corridor/gate
  entranceOrganizer?: MetaShopDirCat; // organizer text shown on the entry arch
  entranceDoormanImage?: string; // PNG/transparent character shown as doorman
  entranceArchMedia?: string;    // image/video/GIF/PDF billboard shown above the entry arch
  entranceArchMediaW?: number;   // width of the large media billboard above the arch (meters)
  entranceArchMediaH?: number;   // height of the large media billboard above the arch (meters)
  entranceAds?: ExpoEntranceAd[]; // side/standing advertising banners around the entry corridor
  entranceRegistration?: ExpoEntranceRegistration; // clickable registration kiosk at the entrance gate
  music?: string;               // optional ambient audio URL
  booths: MetaverseBooth[];
  decorations?: ExpoDecoration[]; // free-placed GLB props (furniture, plants, signage…)
  boothLayout?: string;           // quick-arrange layout id (see expoUtils EXPO_LAYOUT_OPTIONS)
  retailCategories?: ExpoRetailCategory[]; // supermarket/mall department zones linked to MetaShops
  wallAds?: ExpoWallAd[];       // environmental advertising banners on the perimeter walls
  wallAdScale?: number;         // global multiplier for all environmental wall ads
  wallAdLift?: number;          // global vertical offset in meters for all environmental wall ads
  presentation?: ExpoPresentation; // big page-turnable PDF presentation on a hall wall
  /** @deprecated use per-booth meetUrl on MetaverseBooth */
  meetWall?: ExpoMeetWall;
  presence?: ExpoPresenceSettings; // realtime visitors + minimal digital markers
  schemaVersion?: number;       // for future migrations (e.g. splitting into its own collection)
}

/** Visitor registration kiosk at the expo entrance corridor. */
export interface ExpoEntranceRegistration {
  enabled?: boolean;            // default: shown when entrance is enabled
  title?: MetaShopDirCat;       // optional modal title override
}

/** A visitor registration submitted at the expo entrance kiosk. Stored in `metaExpoRegistrations`. */
export interface MetaExpoRegistration {
  id: string;
  timestamp: string;
  bazaarId: string;
  bazaarSlug: string;
  bazaarName?: string;
  visitorId?: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;             // سمت / position in the company
  productService: string;
  whatsapp: string;
  city: string;
  country: string;
  device?: 'mobile' | 'tablet' | 'desktop';
  sessionId?: string;
}

/** Booth reservation request — many pending per booth (up to 100); one confirmed winner chosen by master. */
export type BoothReservationStatus = 'pending' | 'confirmed' | 'cancelled';

export interface MetaExpoBoothReservation {
  id: string;
  timestamp: string;
  bazaarId: string;
  bazaarSlug: string;
  bazaarName?: string;
  boothId: string;
  boothName?: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
  productService: string;
  whatsapp: string;
  status: BoothReservationStatus;
  visitorId?: string;
  sessionId?: string;
  device?: 'mobile' | 'tablet' | 'desktop';
}

export interface MetaExpoPresence {
  id: string;
  roomId: string;
  bazaarId: string;
  bazaarSlug: string;
  visitorId: string;
  name: string;
  color: string;
  company?: string;             // from entrance registration — shown on avatar badge
  jobTitle?: string;            // سمت — shown on avatar badge
  x: number;
  z: number;
  heading: number;
  isVr?: boolean;
  lastSeen: string;
  active?: boolean;
}

// A language a shop can be displayed in (beyond the default fa/en)
export interface MetaShopLang { code: string; name: string; rtl?: boolean; }

// A discount code the customer can enter at checkout
export interface MetaShopDiscount {
  id: string;
  code: string;                          // code the customer types (case-insensitive), e.g. "NOWRUZ"
  type: 'percent' | 'fixed';             // percentage off, or a fixed amount off
  value: number;                         // percent (e.g. 10) or fixed amount in shop currency
  scope: 'all' | 'products' | 'categories'; // applies to whole order, specific products, or categories
  productIds?: string[];                 // when scope = 'products'
  categories?: string[];                 // when scope = 'categories' (product group names)
  active?: boolean;
  label?: string;                        // optional internal note
  minOrder?: number;                     // optional minimum items subtotal to qualify
}

/** Visitor-facing currency with rate relative to shop.currency (1 base = rate × this currency). */
export interface MetaShopDisplayCurrency {
  code: string;
  label?: string;
  labelEn?: string;
  /** Multiply a base-currency amount by this to show in `code`. */
  rate: number;
}

// A predefined extra fee added at checkout (shipping, packaging, ...)
export interface MetaShopFee {
  id: string;
  label: string;            // e.g. "هزینه ارسال"
  labelEn?: string;
  amount: number;
  /** Currency for this fee (defaults to shop.currency). */
  currency?: string;
  /** Shown under the fee line at checkout — e.g. free-shipping rules, delivery areas. */
  description?: string;
  descriptionEn?: string;
  required?: boolean;       // always applied (customer cannot remove)
  defaultOn?: boolean;      // optional fees: pre-checked at checkout
}

// A custom content page shown as an extra tab in the shop (About Us, Certifications, etc.)
export interface MetaShopPageCard { id: string; image?: string; name?: string; nameEn?: string; desc?: string; descEn?: string; i18n?: Record<string, Record<string, string>>; }
export interface MetaShopPage {
  id: string;
  label: string;            // tab label (default language)
  labelEn?: string;         // tab label when the shop is viewed in English
  type: 'text' | 'gallery' | 'cards';
  body?: string;            // text page: paragraphs separated by blank lines
  bodyEn?: string;
  description?: string;     // cards page: intro paragraph
  descriptionEn?: string;
  images?: string[];        // text page side images OR gallery photos
  cards?: MetaShopPageCard[]; // cards page (partners, certifications, ...)
  i18n?: Record<string, Record<string, string>>; // per-language: { zh: { label, body, description } }
}

export interface MetaShopProduct {
  id: string;
  name: string;
  sku?: string;
  hsCode?: string;
  group?: string;          // category (filter pill)
  subcategory?: string;
  description?: string;
  images: string[];
  videoUrl?: string;       // optional product video (YouTube / Vimeo / direct mp4 link)
  i18n?: Record<string, Record<string, string>>; // per-language overrides, e.g. { zh: { name, description } }
  active?: boolean;
  featured?: boolean;      // highlight as a «ویژه» product (up to 3 shown in the featured rail)
  outOfStock?: boolean;    // mark as «در حال حاضر موجود نیست» → customer can browse it but cannot order it
  hidePrice?: boolean;     // hide the price → show «قابل مذاکره» instead; customer can still order a quantity for a later quote
  hidePriceText?: string;  // custom label shown when the price is hidden (e.g. "Please contact us for the new price"); falls back to the shop's hidePriceText, then «قابل مذاکره»
  // pricing
  currency?: string;       // overrides shop currency if set
  price?: number;          // primary price (per unit / per service) — fallback when no priceOptions
  // Optional per-product discount applied to price / packPrice / every rate option.
  // discountType 'percent' → discountValue is 0-100 ; 'amount' → discountValue is a flat amount in the product currency.
  discountType?: 'percent' | 'amount';
  discountValue?: number;
  // Up to 3 named rate options, e.g. "1 day / 3 days / 10 days" or "EXW / FOB / CIF / DDP" or "with freight / without"
  // Each rate option may carry its OWN currency (e.g. a money-exchange buy/sell rate in different currencies)
  priceOptions?: { id: string; label: string; labelEn?: string; price: number; currency?: string }[];
  packPrice?: number;      // optional pack price (products)
  unit?: string;           // kg, pcs, day, hour, session ...
  priceUnit?: string;      // services: "per day", "per session"
  pack?: number;           // items per pack (products)
  moq?: string;            // MOQ label (products)
  stockLabel?: string;
  /** Extra search terms (comma-separated in admin) — site & international shop search. */
  searchKeywords?: string[];
  // rich attributes
  colors?: MetaShopColorOption[];
  origin?: { name: string; flagUrl?: string };
  features?: { label: string; value: string }[];
  /** فیلدهای تخصصی املاک — خرید، اجاره، مغازه، دفتر، زمین و… */
  realEstate?: MetaShopRealEstate;
}

/** اطلاعات کامل یک ملک برای پاسخ به سوالات مشتری خریدار/مستأجر */
export interface MetaShopRealEstateFaq {
  q: string;
  qEn?: string;
  qAr?: string;
  a: string;
  aEn?: string;
  aAr?: string;
  /** Any extra language: { zh: { q, a }, tr: { q, a }, … } */
  i18n?: Record<string, { q?: string; a?: string }>;
}

export interface MetaShopRealEstate {
  dealType: 'sale' | 'rent' | 'rent-short' | 'pre-sale' | 'exchange';
  propertyType: string;
  usage?: string;
  areaSqm?: number;
  landAreaSqm?: number;
  builtAreaSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  halfBaths?: number;
  floor?: number;
  totalFloors?: number;
  unitsPerFloor?: number;
  yearBuilt?: number;
  renovatedYear?: number;
  buildingAge?: string;
  facing?: string;
  view?: string;
  documentType?: string;
  ownership?: string;
  occupancyStatus?: string;
  furnished?: string;
  renovation?: string;
  parkingSpaces?: number;
  parkingType?: string;
  storage?: boolean;
  storageSqm?: number;
  balcony?: boolean;
  balconySqm?: number;
  elevator?: boolean;
  freightElevator?: boolean;
  heating?: string;
  cooling?: string;
  flooring?: string;
  kitchen?: string;
  wcType?: string;
  monthlyRent?: number;
  rentCurrency?: string;
  deposit?: number;
  rentPeriod?: string;
  pricePerSqm?: number;
  maintenanceFee?: number;
  utilitiesIncluded?: string[];
  negotiable?: boolean;
  commission?: string;
  city?: string;
  province?: string;
  district?: string;
  neighborhood?: string;
  street?: string;
  fullAddress?: string;
  postalCode?: string;
  mapUrl?: string;
  nearbyPlaces?: string[];
  amenities?: string[];
  buildingFeatures?: string[];
  security?: string[];
  accessibility?: string[];
  availableFrom?: string;
  leaseDuration?: string;
  minLeaseMonths?: number;
  petsAllowed?: string;
  commercialLicense?: string;
  frontageMeters?: number;
  ceilingHeight?: number;
  powerCapacity?: string;
  loadingDock?: boolean;
  footTraffic?: string;
  currentTenant?: string;
  rentalYield?: string;
  loanEligible?: boolean;
  virtualTourUrl?: string;
  floorPlanUrl?: string;
  agentName?: string;
  agentPhone?: string;
  agentWhatsapp?: string;
  publicHighlights?: string[];
  faq?: MetaShopRealEstateFaq[];
  /** Per-language field overrides: { en: { usage, city, amenities: [] }, ar: {…}, zh: {…} } */
  i18n?: Record<string, Record<string, unknown>>;
  /** Legacy / import: flat suffixes on the same object (usageEn, cityAr, amenitiesEn, …) */
  [key: string]: unknown;
}

export interface MetaShopProductRef {
  id: string;
  name: string;
  sku?: string;
}

export interface MetaShop {
  id: string;
  slug: string;            // public link key (?shop=<slug>)
  name: string;
  type: MetaShopType;
  isActive: boolean;
  theme: MetaShopTheme;
  defaultLang?: string;        // language code the shop opens in (visitor can still toggle)
  languages?: MetaShopLang[];  // supported display languages (defaults to fa + en when absent)
  i18n?: Record<string, Record<string, string>>; // shop-level per-language: { zh: { title, subtitle, collectionText } }
  // ── Directory / bazaar grouping (the "all shops" page) ──
  directoryCats?: MetaShopDirCat[];  // bilingual bazaar categories (a shop can appear under several)
  directorySub?: MetaShopDirCat;     // bilingual subcategory
  // legacy single-language fields (kept for backward compatibility / import)
  directoryCategory?: string;
  directoryCategories?: string[];
  directorySubcategory?: string;
  code?: string;                     // unique 4-char alphanumeric code (searchable; shown on the storefront)
  // Optional storefront banner in the bazaar/directory lists
  storefrontTagline?: string;        // short text shown on the storefront banner (e.g. "🔥 جدید")
  storefrontTaglineEn?: string;
  storefrontColor?: string;          // custom banner/accent color to make this shop stand out in lists
  shopNumber?: string;               // (legacy) number that used to show on the storefront shutter
  pages?: MetaShopPage[];      // extra content tabs (About Us, Certifications, ...)
  productsTabLabel?: string;   // label for the built-in products tab (default localized)
  productsTabLabelEn?: string;
  // hero / cover
  collectionText?: string;
  title?: string;
  subtitle?: string;
  coverImage?: string;
  logo?: string;
  currency: string;
  /** Extra currencies visitors can switch to; rates are vs `currency` (base). */
  displayCurrencies?: MetaShopDisplayCurrency[];
  // contact / footer
  phone?: string;
  whatsapp?: string;   // default WhatsApp for all properties (per-property override in realEstate.agentWhatsapp)
  email?: string;
  website?: string;
  address?: string;
  footerText?: string;
  // catalog
  categories?: (string | MetaShopDirCat)[];   // ordered category list (string or { fa, en, ar, … })
  groupI18n?: Record<string, Record<string, string>>;  // product.group (fa key) → { en, ar, … }
  groupLabels?: Record<string, Record<string, string>>; // alias for groupI18n in imported JSON
  hidePrices?: boolean;    // hide ALL product prices shop-wide → «قابل مذاکره»; orders still capture quantities for a later quote
  hidePriceText?: string;  // shop-wide custom label shown when a price is hidden (e.g. "Please contact us for the new price"); a product's own hidePriceText overrides this; falls back to «قابل مذاکره»
  productCount?: number;
  /** Number of metaShopChunks docs holding products (0 = legacy inline products array). */
  productChunkCount?: number;
  /** Lightweight product list for admin/search without loading chunks. */
  productRefs?: MetaShopProductRef[];
  products: MetaShopProduct[];
  extraFees?: MetaShopFee[]; // predefined checkout fees (shipping, packaging, ...)
  discounts?: MetaShopDiscount[]; // discount codes
  taxRate?: number;          // VAT/tax percentage (0 or undefined = no tax)
  taxInclusive?: boolean;    // true = tax already included in prices; false = added on top
  taxLabel?: string;         // e.g. "مالیات بر ارزش افزوده"
  taxLabelEn?: string;       // e.g. "VAT"
  // order routing → کارتابل (cartable)
  assignType?: 'personnel' | 'department';
  assignedPersonnelIds?: string[];
  assignedDepartmentId?: string;
  /** Personnel who may view/edit this shop in the admin panel (empty = all with canManageMetaShop). */
  editorPersonnelIds?: string[];
  // labels
  cartButtonText?: string;
  orderThankYouText?: string;
  /** Footnote on checkout proforma / invoice preview (per shop). */
  invoiceHintText?: string;
  /** Show proforma footnote on invoice preview (default: on). */
  showInvoiceHint?: boolean;
  searchPlaceholder?: string;
  /** Extra search terms for this shop (comma-separated in admin) — site & international shop search. */
  searchKeywords?: string[];
  /** Product shops: show public supplier partnership form in footer (next to PDF catalog). */
  supplierCollaborationEnabled?: boolean;
  /** Link-share / Open Graph (WhatsApp, Telegram, …) — overrides defaults when set. */
  seoTitle?: string;
  seoDescription?: string;
  seoImage?: string;
  createdAt?: string;
}

export interface MetaShopOrderItem {
  productId: string;
  name: string;
  sku?: string;
  unit?: string;
  qty: number;
  unitPrice?: number;
  lineTotal?: number;
  currency?: string;       // per-line currency (may differ from the order currency)
  optionLabel?: string;    // chosen rate option (e.g. "Buy" / "Sell")
  priceHidden?: boolean;   // price was «قابل مذاکره» — quantity captured for a later quote, no amount
}

export interface MetaShopOrder {
  id: string;
  shopId: string;
  shopName: string;
  shopType?: MetaShopType;
  trackingCode: string;    // customer-facing tracking code
  customerName: string;
  company?: string;
  phone: string;
  email?: string;
  country?: string;
  city?: string;
  notes?: string;
  items: MetaShopOrderItem[];
  fees?: { label: string; amount: number; currency?: string; description?: string }[]; // applied extra fees
  itemsTotal?: number;                          // sum of line items before discount/fees
  discountCode?: string;                        // applied discount code
  discountAmount?: number;                      // discount value subtracted
  taxRate?: number;                             // tax percentage applied
  taxAmount?: number;                           // tax value
  taxInclusive?: boolean;                       // whether tax was inclusive
  total: number;                                // grand total (items − discount + fees + tax if exclusive)
  currency: string;
  status: 'new' | 'in_progress' | 'done' | 'cancelled';
  createdAt: string;
  customerId?: string;     // linked customer-bank record (by phone)
  via?: 'shop' | 'gsite';  // where the order was placed from: direct shop page, or an embedded Google Site / external site
}

/** Public submission: someone refers a property they own or know for a real-estate MetaShop */
export interface MetaShopPropertyReferral {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  trackingCode: string;
  status: 'pending' | 'approved' | 'rejected';
  referrerName: string;
  referrerPhone: string;
  referrerEmail?: string;
  /** owner | acquaintance | agent | other */
  relation?: string;
  propertyTitle?: string;
  dealType?: MetaShopRealEstate['dealType'];
  propertyType?: string;
  city?: string;
  district?: string;
  areaSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  price?: number;
  monthlyRent?: number;
  deposit?: number;
  currency?: string;
  description?: string;
  notes?: string;
  images: string[];
  productId?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectReason?: string;
  createdAt: string;
  via?: 'shop' | 'gsite';
}

/** Public submission: supplier offers products / brand for a product MetaShop */
export interface MetaShopSupplierCollaboration {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  trackingCode: string;
  status: 'pending' | 'approved' | 'rejected';
  supplierName: string;
  supplierPhone: string;
  supplierEmail?: string;
  brandName: string;
  companyName?: string;
  country?: string;
  city?: string;
  description?: string;
  notes?: string;
  images: string[];
  catalogPdfUrl?: string;
  catalogPdfName?: string;
  productId?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectReason?: string;
  createdAt: string;
  via?: 'shop' | 'gsite';
}

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
  // ── Extended company / header fields (match the official invoice layout) ──
  crNumber?: string;          // CR No.
  email?: string;
  // ── Bank / payment details block ──
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  swiftCode?: string;
  iban?: string;
  // ── Defaults reused on every new invoice ──
  defaultPaymentTerms?: string;   // e.g. "Advance Payment: 80% to start / 20% upon completion."
  defaultNotes?: string;          // NOTES / TERMS box default content
  vatInclusive?: boolean;         // VAT is inclusive in the unit prices (default behaviour)
  invoicePrefix?: string;         // invoice-number prefix (default "SVC")
  defaultDocumentTitle?: string;  // header title for new invoices (default "INVOICE")
  defaultQtyColumnLabel?: string;   // default "QTY"
  defaultUnitPriceColumnLabel?: string; // default "UNIT PRICE"
  defaultCurrency?: string;       // default currency for new invoices (e.g. OMR)
  amountDecimals?: 0 | 1 | 2 | 3; // display/input precision for invoice amounts (default 3)
  // ── Section presets (saved from invoice editor for reuse) ──
  defaultItems?: InvoiceItem[];
  defaultAdjustments?: InvoiceAdjustment[];
  defaultBillTo?: {
    customerName?: string;
    companyName?: string;
    customerPhone?: string;
    customerAddress?: string;
    customerEmail?: string;
  };
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
  // Meeting notifications (optional — may not exist in older Firestore configs)
  onMeetingCreated?: boolean;
  onMeetingUpdated?: boolean;
  onMeetingDeleted?: boolean;
  onMeetingReminder?: boolean;
  onDailySummary?: boolean;
  // Message templates ({recipientName}, {ticketId}, {customerName}, {senderName}, {status}, {formTitle})
  ticketTemplate: string;
  messageTemplate: string;
  statusTemplate: string;
  // Meeting templates ({recipientName}, {meetingTitle}, {meetingDate}, {meetingTime}, {meetingLocation}, {organizerName})
  meetingCreatedTemplate?: string;
  meetingUpdatedTemplate?: string;
  meetingDeletedTemplate?: string;
  meetingReminderTemplate?: string;
  // Daily summary template ({recipientName}, {tomorrowDate}, {meetingsList})
  dailySummaryTemplate?: string;
  // Optional "master" recipient — gets a copy of EVERY WhatsApp notification, in
  // addition to the normal recipient. Keyed by personnel ID.
  masterRecipientId?: string;
  // Per-person config (keyed by personnel ID)
  personnelPhones: Record<string, string>;    // WhatsApp phone number
  personnelApiKeys: Record<string, string>;   // CallMeBot API key (per person)
}

export interface NotificationLog {
  id: string;
  type: 'new_ticket' | 'new_message' | 'status_change' | 'test' | 'meeting_created' | 'meeting_updated' | 'meeting_deleted' | 'meeting_reminder' | 'daily_summary';
  recipientId: string;
  recipientName: string;
  phone: string;
  message: string;
  status: 'sent' | 'failed';
  error?: string;
  ticketId?: string;
  meetingId?: string;
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
  // When set, all public "ثبت درخواست" buttons open this URL (e.g. a Google Form)
  // in a new tab instead of the in-app request form.
  requestExternalUrl?: string;
  socialLinks?: SocialLink[];
  notificationConfig?: NotificationConfig;
  dailyTips?: string[];
  showDailyTips?: boolean;
  featuredBusinesses?: FeaturedBusiness[];
  formFields: FormField[];
  personnelRoles?: string[];
  departments?: Department[];
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
  /** MetaBazaar id whose tree powers the public «فروشگاه صادراتی» page (?page=export-shops). */
  exportShopBazaarId?: string;
  /** Info box on public consultation booking page (?page=booking). */
  consultationPublicNoticeFa?: string;
  consultationPublicNoticeEn?: string;
  labels?: TicketLabel[];
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

// Per-Meta-Shop visitor analytics event (a visit, a product click, or an add-to-cart).
// Stored in the `metaShopEvents` collection; powers the per-shop visit report.
export interface MetaShopEvent {
  id: string;
  timestamp: string;
  shopId: string;
  shopName?: string;
  type: 'visit' | 'product_click' | 'add_to_cart';
  productId?: string;
  productName?: string;
  productGroup?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  device?: 'mobile' | 'tablet' | 'desktop';
  sessionId?: string;
  referrer?: string;
  via?: 'shop' | 'gsite'; // direct shop page vs embedded Google Site / external site
}

// Per-metaverse-expo visitor analytics event.
// Stored in the `metaExpoEvents` collection; powers bazaar/expo behavior reports.
export type MetaExpoEventType =
  | 'visit'
  | 'vr_enter'
  | 'language_change'
  | 'booth_click'
  | 'hotspot_click'
  | 'wall_ad_click'
  | 'entrance_ad_click'
  | 'booth_panel_click'
  | 'booth_character_click'
  | 'counter_glb_grab'
  | 'decoration_click'
  | 'booth_dwell'
  | 'entrance_kiosk_click'
  | 'registration_complete'
  | 'booth_reserve_click'
  | 'booth_reservation_complete';

export interface MetaExpoEvent {
  id: string;
  timestamp: string;
  bazaarId: string;
  bazaarSlug: string;
  bazaarName?: string;
  type: MetaExpoEventType;
  country?: string;
  countryCode?: string;
  city?: string;
  device?: 'mobile' | 'tablet' | 'desktop';
  sessionId?: string;
  referrer?: string;
  isVr?: boolean;
  language?: string;
  boothId?: string;
  boothName?: string;
  boothIndex?: number;
  wall?: ExpoWall | string;
  side?: string;
  targetId?: string;
  targetName?: string;
  targetType?: string;
  dwellSec?: number;
  x?: number;
  z?: number;
}

export interface CustomerAccount {
  id: string;
  fullName: string;
  username: string;
  password: string;
  ticketIds: string[];
  isActive: boolean;
  note?: string;
  createdAt: string;
  createdBy: string;
}

// ── Company Processes / Mind Map ─────────────────────────────────────────────

export interface ProcessNodeFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface ProcessNode {
  id: string;
  label: string;
  parentId: string | null;
  childIds: string[];
  notes: string;
  files: ProcessNodeFile[];
  color: string;
  isCollapsed: boolean;
}

export type MindMapLayout = 'tree-right' | 'tree-top' | 'flowchart';

export interface CompanyProcess {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  createdBy: string;
  accessType: 'all' | 'specific';
  accessibleTo: string[];
  nodes: ProcessNode[];
  rootNodeId: string;
  lastUpdated?: string;
  updatedBy?: string;
  layoutType?: MindMapLayout;
}
