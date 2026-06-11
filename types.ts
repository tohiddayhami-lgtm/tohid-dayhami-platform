
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
  canIssueInvoices: boolean;
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
  reportsTo?: string;
  email: string;
  username: string;
  staffCode?: string; // dedicated personnel/messaging ID — colleagues use it to message this person
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
  currency: Currency;
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  note?: string;
  issuedBy: string;
  status?: 'draft' | 'issued' | 'paid';  // archive status
  createdAt?: string;                      // when first created (for sorting the archive)
  type?: string;                           // invoice type, e.g. "Services" (shown in header, drives number prefix)
  paymentTerms?: string;                   // payment terms box (defaults from template)
  vatInclusive?: boolean;                  // true => VAT is included in the line amounts
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
  isFlagged?: boolean;
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
  entity: 'Ticket' | 'Customer' | 'Personnel' | 'Project' | 'Task' | 'Meeting' | 'Message' | 'System' | 'KPI' | 'CustomForm' | 'Sale' | 'Report' | 'Goals' | 'Objective' | 'Expense' | 'News' | 'Invoice' | 'MetaShop' | 'MetaShopOrder' | 'MetaBazaar';
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

export type ViewState = 'landing' | 'new-ticket' | 'tracking' | 'admin' | 'news' | 'custom-form' | 'metashop' | 'shopsdir' | 'bazaar' | 'expo';

// ═══════════════════ META SHOP (online catalogs / shops) ═══════════════════
export type MetaShopType = 'products' | 'services';

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
export interface MetaShopDirCat { fa?: string; en?: string; }

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

export interface MetaverseBooth {
  id: string;
  name: MetaShopDirCat;         // bilingual booth / company name
  shopSlug?: string;            // links the booth to an existing MetaShop (the exhibitor)
  // placement on the hall floor
  x: number; y: number; z: number;
  ry?: number;                  // facing rotation (radians)
  scale?: number;               // uniform scale (default 1)
  // visuals
  modelUrl?: string;            // optional custom GLB/GLTF (Storage documents/ URL) — overrides procedural booth
  color?: string;               // accent color for the procedural booth
  logo?: string;                // logo image URL (Storage images/)
  bannerImage?: string;         // banner image URL (Storage images/)
  hotspots?: MetaverseHotspot[];
}

// drei <Environment> presets used for image-based lighting / skybox when no custom HDR is given
export type EnvPreset = 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'park' | 'lobby';

export interface MetaverseExpo {
  enabled: boolean;
  defaultLang?: string;         // 'fa' | 'en' (visitor can still toggle)
  title?: MetaShopDirCat;
  subtitle?: MetaShopDirCat;
  // environment
  environmentUrl?: string;      // optional hall/environment GLB (Storage documents/)
  skyboxUrl?: string;           // optional HDR / equirectangular image
  preset?: EnvPreset;           // drei Environment preset when no custom HDR
  groundColor?: string;
  wallColor?: string;
  width?: number; depth?: number; height?: number; // hall dimensions (meters)
  spawn?: { x: number; y: number; z: number; ry?: number }; // visitor start position
  music?: string;               // optional ambient audio URL
  booths: MetaverseBooth[];
  schemaVersion?: number;       // for future migrations (e.g. splitting into its own collection)
  // Seam for future multiplayer (presence + text chat). Not implemented yet:
  // presence?: { roomId?: string; chatEnabled?: boolean };
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

// A predefined extra fee added at checkout (shipping, packaging, ...)
export interface MetaShopFee {
  id: string;
  label: string;            // e.g. "هزینه ارسال"
  labelEn?: string;
  amount: number;           // in the shop currency
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
  // pricing
  currency?: string;       // overrides shop currency if set
  price?: number;          // primary price (per unit / per service) — fallback when no priceOptions
  // Up to 3 named rate options, e.g. "1 day / 3 days / 10 days" or "EXW / FOB / CIF / DDP" or "with freight / without"
  // Each rate option may carry its OWN currency (e.g. a money-exchange buy/sell rate in different currencies)
  priceOptions?: { id: string; label: string; labelEn?: string; price: number; currency?: string }[];
  packPrice?: number;      // optional pack price (products)
  unit?: string;           // kg, pcs, day, hour, session ...
  priceUnit?: string;      // services: "per day", "per session"
  pack?: number;           // items per pack (products)
  moq?: string;            // MOQ label (products)
  stockLabel?: string;
  // rich attributes
  colors?: MetaShopColorOption[];
  origin?: { name: string; flagUrl?: string };
  features?: { label: string; value: string }[];
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
  // contact / footer
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  footerText?: string;
  // catalog
  categories?: string[];   // ordered category list (falls back to product groups)
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
  // labels
  cartButtonText?: string;
  orderThankYouText?: string;
  searchPlaceholder?: string;
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
  fees?: { label: string; amount: number }[]; // applied extra fees (shipping, packaging, ...)
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
