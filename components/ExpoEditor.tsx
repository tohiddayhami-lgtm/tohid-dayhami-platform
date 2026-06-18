import React, { useRef, useState } from 'react';
import { MetaShop, MetaverseExpo, MetaverseBooth, MetaverseHotspot, HotspotType, EnvPreset, MetaShopDirCat, BoothFace, ExpoWallAd, ExpoWall, ExpoPresentation, ExpoMeetWall, BoothTier, ExpoEntranceAd, ExpoEntranceAdPosition, ExpoRetailCategory, ExpoVisualStyle, BoothEntranceFacing } from '../types';
import { uploadFileWithProgress } from '../services/firebaseService';
import { autoArrangeBooths, shopToBoothFields, BANNER_SIZES, bannerSize, type ExpoBoothLayout, planRectPct, findNextLayoutSlot, layoutCarpetRects, EXPO_LAYOUT_OPTIONS, normalizeBoothLayout } from './metaverse/expoUtils';
import { Language } from '../App';
import { IconPlus, IconTrash, IconGlobe, IconUpload, IconEdit } from './Icons';

interface Props {
  expo?: MetaverseExpo;
  shops: MetaShop[];
  lang: Language;
  bazaarSlug: string;
  shopBaseUrl: string;
  onChange: (expo: MetaverseExpo) => void;
  onPreview?: () => void | Promise<void>;  // saves the bazaar, then opens the 3D preview
  readonly?: boolean;
}

const PRESETS: EnvPreset[] = ['warehouse', 'city', 'sunset', 'dawn', 'night', 'forest', 'apartment', 'studio', 'park', 'lobby'];
const HOTSPOT_TYPES: HotspotType[] = ['product', 'company', 'video', 'pdf', 'image', 'url', 'page', 'whatsapp', 'contact', 'order'];
const PANEL_FACES: { face: BoothFace; fa: string; en: string }[] = [
  { face: 'innerBack', fa: 'دیوار پشت — داخل', en: 'Back wall — inside' },
  { face: 'innerLeft', fa: 'دیوار چپ — داخل', en: 'Left wall — inside' },
  { face: 'innerRight', fa: 'دیوار راست — داخل', en: 'Right wall — inside' },
  { face: 'outerBack', fa: 'دیوار پشت — بیرون', en: 'Back wall — outside' },
  { face: 'outerLeft', fa: 'دیوار چپ — بیرون', en: 'Left wall — outside' },
  { face: 'outerRight', fa: 'دیوار راست — بیرون', en: 'Right wall — outside' },
];

const ENTRANCE_AD_POSITIONS: { key: ExpoEntranceAdPosition; fa: string; en: string }[] = [
  { key: 'aboveArch', fa: 'دیوار بالای سردر', en: 'Wall above arch' },
  { key: 'archLeft', fa: 'کنار سردر — چپ', en: 'Arch side — left' },
  { key: 'archRight', fa: 'کنار سردر — راست', en: 'Arch side — right' },
  { key: 'railLeft', fa: 'کنار ریل — چپ', en: 'Rail side — left' },
  { key: 'railRight', fa: 'کنار ریل — راست', en: 'Rail side — right' },
];

const MANAGER_SLOTS = [0, 1, 2, 3, 4] as const;

const blankExpo = (): MetaverseExpo => ({
  enabled: true, visualStyle: 'exhibition', preset: 'warehouse', width: 30, depth: 30, height: 9,
  groundColor: '#cfd4dc', wallColor: '#e9edf3', spawn: { x: 0, y: 0, z: 8 }, booths: [], schemaVersion: 1,
});

const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;

export const ExpoEditor: React.FC<Props> = ({ expo, shops, lang, bazaarSlug, shopBaseUrl, onChange, onPreview, readonly = false }) => {
  const T = lang === 'fa';
  const e: MetaverseExpo = expo || { ...blankExpo(), enabled: false };
  const [openBooth, setOpenBooth] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [quickN, setQuickN] = useState(6);
  const [quickLayout, setQuickLayout] = useState<ExpoBoothLayout>(() => normalizeBoothLayout(expo?.boothLayout || 'cross'));
  const [quickTier, setQuickTier] = useState<BoothTier>('basic');
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const t = {
    title: T ? 'نمایشگاه متاورس (سه‌بعدی)' : 'Metaverse Exhibition (3D)',
    hint: T ? 'یک سالن نمایشگاهی سه‌بعدی برای این بازارچه بسازید که بازدیدکنندگان با مرورگر، موبایل یا عینک VR داخلش قدم بزنند.' : 'Build a walkable 3D hall for this bazaar — visitors explore on web, mobile or a VR headset.',
    enable: T ? 'فعال‌سازی نمایشگاه سه‌بعدی' : 'Enable 3D exhibition',
    preview: T ? 'ذخیره و پیش‌نمایش نمایشگاه' : 'Save & preview exhibition',
    previewHint: T ? 'پیش‌نمایش، بازارچه را ذخیره می‌کند و نمایشگاه را در تب جدید باز می‌کند.' : 'Preview saves the bazaar and opens the exhibition in a new tab.',
    hall: T ? 'تنظیمات سالن' : 'Hall settings',
    titleFa: T ? 'عنوان (فارسی)' : 'Title (FA)', titleEn: T ? 'عنوان (انگلیسی)' : 'Title (EN)',
    subFa: T ? 'زیرعنوان (فارسی)' : 'Subtitle (FA)', subEn: T ? 'زیرعنوان (انگلیسی)' : 'Subtitle (EN)',
    visualStyle: T ? 'استایل نمایشگاه' : 'Expo style',
    styleExhibition: T ? 'نمایشگاهی کلاسیک' : 'Classic exhibition',
    styleStorefront: T ? 'دفاتر تجاری' : 'Commercial offices',
    styleSupermarket: T ? 'مرکز خرید / فروشگاه زنجیره‌ای' : 'Mall / supermarket departments',
    width: T ? 'عرض سالن (متر)' : 'Width (m)', depth: T ? 'عمق سالن (متر)' : 'Depth (m)', height: T ? 'ارتفاع سقف (متر)' : 'Ceiling height (m)',
    preset: T ? 'محیط/نور' : 'Environment', ground: T ? 'رنگ کف' : 'Ground color', wall: T ? 'رنگ دیوار' : 'Wall color',
    envGlb: T ? 'مدل محیط سفارشی (GLB)' : 'Custom environment GLB', skybox: T ? 'آسمان/HDR (URL)' : 'Skybox / HDR (URL)', music: T ? 'موزیک محیط (URL)' : 'Ambient music (URL)',
    spawn: T ? 'نقطه‌ی شروع بازدیدکننده' : 'Visitor start point',
    entranceT: T ? 'ورودی حرفه‌ای نمایشگاه' : 'Professional expo entrance',
    entranceHint: T ? 'یک راهروی ورود با سردر قابل تبلیغ، بنرهای کنار مسیر و دربان PNG قبل از ورود به سالن نمایش داده می‌شود.' : 'Shows an entry corridor with media arch signage, side ads and PNG doorman before visitors enter the hall.',
    entranceEnable: T ? 'فعال‌سازی ورودی' : 'Enable entrance',
    organizerFa: T ? 'متن سردر / برگزارکننده (فارسی)' : 'Arch / organizer text (FA)',
    organizerEn: T ? 'متن سردر / برگزارکننده (انگلیسی)' : 'Arch / organizer text (EN)',
    doormanPng: T ? 'تصویر PNG دربان' : 'Doorman PNG',
    entranceArchMedia: T ? 'رسانه بزرگ سردر' : 'Main arch media',
    entranceArchW: T ? 'عرض رسانه سردر (متر)' : 'Arch media width (m)',
    entranceArchH: T ? 'ارتفاع رسانه سردر (متر)' : 'Arch media height (m)',
    entranceAdsT: T ? 'بنرهای تبلیغاتی ورودی' : 'Entrance advertising banners',
    addEntranceAd: T ? 'افزودن بنر ورودی' : 'Add entrance banner',
    noEntranceAds: T ? 'بنر ورودی اضافه نشده.' : 'No entrance banners yet.',
    entranceAdPos: T ? 'جایگاه بنر' : 'Banner position',
    entranceAdLift: T ? 'فاصله از سردر (متر)' : 'Distance above arch (m)',
    adsJsonSample: T ? 'دانلود JSON نمونه تبلیغات برای AI' : 'Download AI ads JSON sample',
    floorplan: T ? 'نقشه‌ی کف (غرفه‌ها را بکشید و جابه‌جا کنید)' : 'Floor plan (drag booths to place)',
    booths: T ? 'غرفه‌ها' : 'Booths', addBooth: T ? 'افزودن غرفه' : 'Add booth', noBooths: T ? 'هنوز غرفه‌ای اضافه نشده.' : 'No booths yet.',
    adsT: T ? 'تبلیغات محیطی روی دیوارها' : 'Wall advertising banners',
    adsHint: T ? 'فقط دیوار، اندازهٔ بنر، تصویر و لینک را بدهید؛ جای‌گذاری روی دیوار به‌صورت خودکار و متناسب با سالن انجام می‌شود. هر بنر لینک‌دار است (در تب جدید باز می‌شود).' : 'Just pick a wall, a banner size, an image and a link — placement on the wall is automatic and fits the hall. Each banner is clickable (opens in a new tab).',
    addAd: T ? 'افزودن بنر' : 'Add banner', noAds: T ? 'بنری اضافه نشده.' : 'No banners yet.',
    moveUp: T ? 'انتقال به بالا' : 'Move up', moveDown: T ? 'انتقال به پایین' : 'Move down',
    adWall: T ? 'دیوار' : 'Wall', adSize: T ? 'اندازهٔ بنر' : 'Banner size', adLink: T ? 'لینک (اختیاری)' : 'Link (optional)', adImage: T ? 'رسانه تابلو' : 'Banner media',
    adTitleFa: T ? 'متن تابلو (فارسی)' : 'Banner text (FA)', adTitleEn: T ? 'متن تابلو (انگلیسی)' : 'Banner text (EN)',
    adScaleAll: T ? 'بزرگ‌نمایی همه تابلوها' : 'All banners scale',
    adLiftAll: T ? 'بالا بردن همه تابلوها (متر)' : 'Lift all banners (m)',
    adScaleOne: T ? 'بزرگ‌نمایی همین تابلو' : 'This banner scale',
    adLiftOne: T ? 'بالا/پایین همین تابلو (متر)' : 'This banner lift (m)',
    adEnabled: T ? 'نمایش تابلو' : 'Show banner',
    meter: T ? 'متر' : 'm',
    adPos: T ? 'موقعیت افقی (۰ تا ۱)' : 'Horizontal (0–1)', adHeight: T ? 'ارتفاع (۰ تا ۱)' : 'Height (0–1)', adW: T ? 'عرض (متر)' : 'Width (m)', adH: T ? 'ارتفاع (متر)' : 'Height (m)',
    wallBack: T ? 'دیوار انتهایی' : 'Back', wallLeft: T ? 'چپ' : 'Left', wallRight: T ? 'راست' : 'Right', wallFront: T ? 'ورودی' : 'Front',
    presT: T ? 'پرزنتیشن دیوار انتهایی (PDF)' : 'End-wall presentation (PDF)',
    presHint: T ? 'یک فایل PDF بزرگ روی دیوار نمایش داده می‌شود و بازدیدکننده با موبایل یا عینک VR صفحه‌ها را جلو/عقب می‌زند.' : 'A large PDF shown on the wall; visitors flip pages forward/back with phone or VR.',
    presEnable: T ? 'فعال‌سازی پرزنتیشن' : 'Enable presentation', presPdf: T ? 'فایل PDF' : 'PDF file', presUploaded: T ? 'بارگذاری شد ✓' : 'Uploaded ✓',
    liveT: T ? 'حضور آنلاین و تماس تصویری' : 'Live presence & video call',
    liveHint: T ? 'بازدیدکننده‌ها در نمایشگاه با نشانگر دیجیتال مینیمال دیده می‌شوند و برای تماس صوتی/تصویری از نمایشگر Google Meet روی دیوار استفاده می‌کنند.' : 'Visitors appear with minimal digital markers and use the Google Meet wall screen for voice/video calls.',
    presenceEnable: T ? 'نمایش کاربران آنلاین' : 'Show online visitors',
    avatarsEnable: T ? 'نمایش نشانگر دیجیتال کاربران' : 'Show visitor markers',
    meetEnable: T ? 'نمایش تماس Google Meet روی دیوار' : 'Show Google Meet wall screen',
    meetUrl: T ? 'لینک Google Meet' : 'Google Meet link',
    meetTitleFa: T ? 'عنوان تماس (فارسی)' : 'Call title (FA)',
    meetTitleEn: T ? 'عنوان تماس (انگلیسی)' : 'Call title (EN)',
    quickTitle: T ? 'چیدمان سریع' : 'Quick setup',
    quickHint: T ? 'برای تغییر جای غرفه‌های موجود، سبک را انتخاب کنید و «تغییر چیدمان غرفه‌های فعلی» را بزنید. دکمه ساخت از نو، غرفه‌ها را دوباره می‌سازد.' : 'To rearrange existing booths, pick a style and click "Rearrange current booths". Rebuild creates booths from scratch.',
    quickCount: T ? 'تعداد غرفه‌ها' : 'Number of booths',
    quickLayout: T ? 'سبک چیدمان' : 'Layout style',
    layoutHint: T ? 'هر سبک راهروهای منظم با فرش دارد؛ فرش قرمز در ورودی درب نمایشگاه.' : 'Each style has organized aisle carpets; red carpet at the entrance door.',
    applyLayout: T ? 'تغییر چیدمان غرفه‌های فعلی' : 'Rearrange current booths',
    applyTierAll: T ? 'اعمال نوع به همه' : 'Apply type to all',
    boothTier: T ? 'نوع غرفه' : 'Booth type',
    tierBasic: T ? 'پایه' : 'Basic',
    tierStandard: T ? 'استاندارد' : 'Standard',
    tierPremium: T ? 'پریمیوم' : 'Premium',
    premiumSignFa: T ? 'متن LCD پریمیوم (فارسی)' : 'Premium LCD text (FA)',
    premiumSignEn: T ? 'متن LCD پریمیوم (انگلیسی)' : 'Premium LCD text (EN)',
    premiumSignColor: T ? 'رنگ LCD پریمیوم' : 'Premium LCD color',
    storefrontSignFa: T ? 'تابلو سردر مغازه (فارسی)' : 'Storefront sign (FA)',
    storefrontSignEn: T ? 'تابلو سردر مغازه (انگلیسی)' : 'Storefront sign (EN)',
    storefrontGlassFa: T ? 'متن خدمات روی شیشه (فارسی)' : 'Glass services text (FA)',
    storefrontGlassEn: T ? 'متن خدمات روی شیشه (انگلیسی)' : 'Glass services text (EN)',
    retailT: T ? 'دسته‌بندی‌های فروشگاه زنجیره‌ای' : 'Supermarket departments',
    retailHint: T ? 'برای سبک مرکز خرید/لولو، هر دسته یک بخش رنگی داخل سالن می‌سازد و فروشگاه‌های متاشاپ انتخاب‌شده از همان بخش قابل کلیک هستند.' : 'For the mall/supermarket style, each category creates a colored department zone and selected MetaShops become clickable from that zone.',
    addRetailCat: T ? 'افزودن دسته‌بندی' : 'Add department',
    noRetailCat: T ? 'هنوز دسته‌بندی تعریف نشده.' : 'No departments yet.',
    retailTitleFa: T ? 'نام دسته (فارسی)' : 'Department name (FA)',
    retailTitleEn: T ? 'نام دسته (انگلیسی)' : 'Department name (EN)',
    retailDescFa: T ? 'توضیح کوتاه (فارسی)' : 'Short description (FA)',
    retailDescEn: T ? 'توضیح کوتاه (انگلیسی)' : 'Short description (EN)',
    retailColor: T ? 'رنگ دسته' : 'Department color',
    retailShops: T ? 'فروشگاه‌های متصل' : 'Linked MetaShops',
    retailCategory: T ? 'دسته‌بندی فروشگاهی' : 'Retail department',
    quickBuild: T ? 'ساخت از نو' : 'Rebuild from scratch',
    quickConfirm: T ? 'غرفه‌های فعلی پاک و دوباره چیده می‌شوند. ادامه می‌دهید؟' : 'Existing booths will be replaced and re-arranged. Continue?',
    screen: T ? 'ویدئوی ال‌سی‌دی غرفه' : 'Booth LCD video',
    screenHint: T ? 'لینک یوتیوب/ویمیو یا فایل mp4. روی نمایشگر داخل غرفه به‌صورت خودکار و بی‌صدا پخش می‌شود.' : 'YouTube/Vimeo link or mp4 file. Plays automatically (muted) on the in-booth LCD.',
    screenAuto: T ? 'از ویدئوی محصولات' : 'From product video',
    panels: T ? 'تابلوها و نمایشگرها (۳ داخل + ۳ بیرون)' : 'Panels & screens (3 inside + 3 outside)',
    panelsHint: T ? 'برای هر دیوار غرفه رسانه بگذارید: تصویر/GIF، ویدیو، PDF ورق‌خور، یا HTML. همه مستقیماً روی خود دیوار نمایش داده می‌شوند.' : 'Put media on each booth wall: image/GIF, video, page-turnable PDF, or HTML. Everything renders directly on the wall.',
    applyShop: T ? 'پر کردن اطلاعات از فروشگاه' : 'Fill from shop',
    boothFa: T ? 'نام غرفه (فارسی)' : 'Booth name (FA)', boothEn: T ? 'نام غرفه (انگلیسی)' : 'Booth name (EN)',
    shop: T ? 'فروشگاه مرتبط' : 'Linked shop', noShop: T ? '— بدون فروشگاه —' : '— none —',
    color: T ? 'رنگ غرفه' : 'Booth color', scale: T ? 'مقیاس' : 'Scale', rot: T ? 'چرخش (درجه)' : 'Rotation (deg)',
    entranceFacing: T ? 'سمت رو به درب ورود' : 'Side facing entrance',
    entranceFacingFront: T ? 'روبه‌رو (جلو)' : 'Front toward entrance',
    entranceFacingLeft: T ? 'سمت چپ' : 'Left side',
    entranceFacingRight: T ? 'سمت راست' : 'Right side',
    entranceFacingBack: T ? 'پشت غرفه' : 'Back toward entrance',
    entranceFacingHint: T ? 'غرفه در جای خود می‌چرخد؛ سمت انتخابی عمود بر دیوار ورودی (زاویه صاف، نه کج به درب).' : 'Booth spins in place; chosen side faces the entrance wall square-on (not angled at the door).',
    logo: T ? 'لوگو' : 'Logo', banner: T ? 'بنر' : 'Banner', glb: T ? 'مدل GLB غرفه' : 'Booth GLB model',
    glbScale: T ? 'مقیاس مدل GLB' : 'GLB model scale',
    glbRot: T ? 'چرخش مدل (درجه)' : 'Model rotation (°)',
    glbAdjustHint: T ? 'مدل در جای خود می‌چرخد؛ اندازهٔ اولیه خودکار با غرفهٔ استاندارد (۴×۴ متر) هم‌تراز می‌شود.' : 'Model spins in place; initial size auto-fits the standard 4×4 m booth footprint.',
    upload: T ? 'آپلود' : 'Upload', uploading: T ? 'در حال آپلود…' : 'Uploading…', clear: T ? 'حذف' : 'Clear',
    counterGlb: (n: number) => T ? `GLB مینیاتوری روی کانتر ${n}` : `Counter miniature GLB ${n}`,
    managerPng: (n: number) => T ? `PNG مدیرعامل / شخص ${n} پشت کانتر` : `Manager/person PNG ${n} behind counter`,
    managerActive: (n: number) => T ? `نمایش شخص ${n}` : `Show person ${n}`,
    managerNameFa: (n: number) => T ? `نام شخص ${n} (فارسی)` : `Person ${n} name (FA)`,
    managerNameEn: (n: number) => T ? `نام شخص ${n} (انگلیسی)` : `Person ${n} name (EN)`,
    managerLink: (n: number) => T ? `لینک شخص ${n}` : `Person ${n} link`,
    managerAudioFa: (n: number) => T ? `فایل صوتی فارسی شخص ${n}` : `Person ${n} Persian audio`,
    managerAudioEn: (n: number) => T ? `فایل صوتی انگلیسی شخص ${n}` : `Person ${n} English audio`,
    uploadImg: T ? 'آپلود تصویر / GIF' : 'Upload image / GIF', uploadVid: T ? 'آپلود ویدیو' : 'Upload video', uploadPdf: T ? 'آپلود PDF' : 'Upload PDF', uploadHtml: T ? 'آپلود فایل HTML' : 'Upload HTML file',
    vidErr: T ? 'فقط فایل ویدیویی (mp4/webm/ogg) مجاز است.' : 'Only video files (mp4/webm/ogg) allowed.',
    vidTooBig: T ? 'حجم ویدیو بیش از ۱۵۰ مگابایت است. لطفاً فشرده‌تر کنید.' : 'Video exceeds 150MB. Please compress it.',
    audioErr: T ? 'فقط فایل صوتی مجاز است.' : 'Only audio files are allowed.',
    htmlErr: T ? 'فقط فایل HTML (html/htm) مجاز است.' : 'Only HTML files (html/htm) allowed.',
    posX: 'X', posZ: 'Z',
    hotspots: T ? 'نشانگرهای تعاملی (هات‌اسپات)' : 'Interactive hotspots', addHotspot: T ? 'افزودن نشانگر' : 'Add hotspot', noHot: T ? 'بدون نشانگر.' : 'No hotspots.',
    hType: T ? 'نوع' : 'Type', hTitleFa: T ? 'عنوان (فا)' : 'Title (FA)', hTitleEn: T ? 'عنوان (en)' : 'Title (EN)', hBodyFa: T ? 'متن (فا)' : 'Text (FA)', hBodyEn: T ? 'متن (en)' : 'Text (EN)',
    hUrl: T ? 'لینک (ویدئو/PDF/تصویر/سایت)' : 'URL (video/pdf/image/site)', hProduct: T ? 'محصول' : 'Product', hPhone: T ? 'تلفن' : 'Phone', hWa: T ? 'واتس‌اپ' : 'WhatsApp', hEmail: T ? 'ایمیل' : 'Email',
    hPos: T ? 'موقعیت نسبت به غرفه (X/Y/Z)' : 'Position vs booth (X/Y/Z)',
    edit: T ? 'ویرایش غرفه' : 'Edit booth', glbErr: T ? 'فقط فایل GLB/GLTF مجاز است.' : 'Only GLB/GLTF files allowed.', tooBig: T ? 'حجم فایل بیش از ۳۰ مگابایت است.' : 'File exceeds 30MB.',
    typeLabels: {
      product: T ? 'محصول' : 'Product', company: T ? 'پروفایل شرکت' : 'Company', video: T ? 'ویدئو' : 'Video', pdf: T ? 'کاتالوگ PDF' : 'PDF', image: T ? 'تصویر' : 'Image',
      url: T ? 'لینک خارجی' : 'External link', page: T ? 'صفحه فروشگاه' : 'Shop page', whatsapp: 'WhatsApp', contact: T ? 'تماس' : 'Contact', order: T ? 'ثبت سفارش' : 'Order',
    } as Record<HotspotType, string>,
  };

  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-indigo-500 text-sm';
  const lbl = 'block text-[12px] font-semibold text-gray-600 mb-1';
  const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-5';

  const patch = (p: Partial<MetaverseExpo>) => onChange({ ...e, ...p });
  const defaultRetailCategories = (): ExpoRetailCategory[] => [
    { id: 'retail-fresh', title: { fa: 'میوه و سبزی تازه', en: 'Fresh Fruit & Veg' }, description: { fa: 'ورودی سمت راست، محصولات تازه روز', en: 'Right-side fresh produce' }, color: '#22c55e', shopSlugs: [] },
    { id: 'retail-dairy', title: { fa: 'لبنیات و یخچالی', en: 'Dairy & Chilled' }, description: { fa: 'شیر، پنیر، ماست، کالاهای سردخانه‌ای', en: 'Milk, cheese, yogurt, chilled goods' }, color: '#0ea5e9', shopSlugs: [] },
    { id: 'retail-legumes', title: { fa: 'حبوبات و خشکبار', en: 'Legumes & Nuts' }, description: { fa: 'لوبیا، عدس، نخود، خشکبار', en: 'Beans, lentils, chickpeas, nuts' }, color: '#16a34a', shopSlugs: [] },
    { id: 'retail-grocery', title: { fa: 'مواد غذایی', en: 'Grocery' }, description: { fa: 'برنج، روغن، کنسرو، کالاهای مصرفی', en: 'Rice, oil, canned goods, essentials' }, color: '#f59e0b', shopSlugs: [] },
    { id: 'retail-bakery', title: { fa: 'نان و شیرینی', en: 'Bakery' }, description: { fa: 'نان، شیرینی، کیک و اسنک', en: 'Bread, pastry, cakes and snacks' }, color: '#d97706', shopSlugs: [] },
    { id: 'retail-care', title: { fa: 'بهداشتی و خانه', en: 'Care & Home' }, description: { fa: 'بهداشت، شوینده، لوازم خانه', en: 'Care, cleaning, home items' }, color: '#a855f7', shopSlugs: [] },
  ];
  const setBi = (field: 'title' | 'subtitle', which: 'fa' | 'en', val: string) => patch({ [field]: { ...(e[field] || {}), [which]: val } } as any);
  const setEntranceOrganizer = (which: 'fa' | 'en', val: string) => patch({ entranceOrganizer: { ...(e.entranceOrganizer || {}), [which]: val } });
  const setSpawn = (k: 'x' | 'z', v: number) => patch({ spawn: { x: e.spawn?.x ?? 0, y: 0, z: e.spawn?.z ?? 0, ...(e.spawn || {}), [k]: v } });

  // ── Entrance media / ads ──
  const updEntranceAds = (entranceAds: ExpoEntranceAd[]) => patch({ entranceAds });
  const addEntranceAd = () => {
    const s = bannerSize('billboard');
    updEntranceAds([...(e.entranceAds || []), { id: newId('entrance-ad'), position: 'aboveArch', size: s.key, w: s.w, h: s.h }]);
  };
  const updEntranceAd = (id: string, p: Partial<ExpoEntranceAd>) => updEntranceAds((e.entranceAds || []).map(a => a.id === id ? { ...a, ...p } : a));
  const setEntranceAdTitle = (ad: ExpoEntranceAd, which: 'fa' | 'en', val: string) =>
    updEntranceAd(ad.id, { title: { ...(ad.title || {}), [which]: val } });
  const setEntranceAdSize = (id: string, key: string) => {
    const s = bannerSize(key);
    updEntranceAd(id, { size: s.key, w: s.w, h: s.h });
  };
  const delEntranceAd = (id: string) => updEntranceAds((e.entranceAds || []).filter(a => a.id !== id));

  // ── Booths ──
  const updBooths = (booths: MetaverseBooth[]) => patch({ booths });
  const addBooth = () => {
    const W = e.width || 30, D = e.depth || 30;
    const isSF = e.visualStyle === 'storefront' || e.visualStyle === 'business_center';
    const onFloor = e.booths || [];
    const idx = onFloor.length;
    const slot = findNextLayoutSlot((e.booths || []).length, e.boothLayout || (isSF ? 'storefront' : 'cross'));
    const b: MetaverseBooth = {
      id: newId('booth'),
      name: { fa: T ? (isSF ? `دفتر ${idx + 1}` : `غرفه ${idx + 1}`) : (isSF ? `Office ${idx + 1}` : `Booth ${idx + 1}`), en: isSF ? `Office ${idx + 1}` : `Booth ${idx + 1}` },
      x: slot?.x ?? ((idx % 4) - 1.5) * (W / 5),
      y: 0,
      z: slot?.z ?? ((Math.floor(idx / 4)) - 1) * (D / 5),
      ry: slot?.ry ?? 0,
      color: isSF ? '#0f766e' : '#2d4a1a',
      tier: 'basic',
      hotspots: [],
    };
    updBooths([...(e.booths || []), b]);
    setOpenBooth(b.id);
  };
  const updBooth = (id: string, p: Partial<MetaverseBooth>) => updBooths((e.booths || []).map(b => b.id === id ? { ...b, ...p } : b));
  const delBooth = (id: string) => updBooths((e.booths || []).filter(b => b.id !== id));
  const setBoothPremiumSign = (b: MetaverseBooth, which: 'fa' | 'en', val: string) =>
    updBooth(b.id, { premiumSignText: { ...(b.premiumSignText || {}), [which]: val } });
  const setBoothStorefrontSign = (b: MetaverseBooth, which: 'fa' | 'en', val: string) =>
    updBooth(b.id, { storefrontSignText: { ...(b.storefrontSignText || {}), [which]: val } });
  const setBoothGlassText = (b: MetaverseBooth, which: 'fa' | 'en', val: string) =>
    updBooth(b.id, { storefrontGlassText: { ...(b.storefrontGlassText || {}), [which]: val } });
  const compactFive = (values: string[]) => {
    const next = values.slice(0, 5);
    while (next.length && !next[next.length - 1]) next.pop();
    return next;
  };
  const setBoothManagerPng = (b: MetaverseBooth, index: number, url: string) => {
    const next = Array.from({ length: 5 }, (_, i) => b.managerPngs?.[i] || '');
    next[index] = url || '';
    updBooth(b.id, { managerPngs: compactFive(next) });
  };
  const setBoothManagerEnabled = (b: MetaverseBooth, index: number, enabled: boolean) => {
    const next = Array.from({ length: 5 }, (_, i) => b.managerEnabled?.[i] !== false);
    next[index] = enabled;
    updBooth(b.id, { managerEnabled: next });
  };
  const setBoothManagerName = (b: MetaverseBooth, index: number, which: 'fa' | 'en', val: string) => {
    const next = Array.from({ length: 5 }, (_, i) => b.managerNames?.[i] || {});
    next[index] = { ...next[index], [which]: val };
    while (next.length && !next[next.length - 1]?.fa && !next[next.length - 1]?.en) next.pop();
    updBooth(b.id, { managerNames: next });
  };
  const setBoothManagerLink = (b: MetaverseBooth, index: number, val: string) => {
    const legacy = (b as any).managerWhatsapps as string[] | undefined;
    const next = Array.from({ length: 5 }, (_, i) => b.managerLinks?.[i] || legacy?.[i] || '');
    next[index] = val;
    updBooth(b.id, { managerLinks: compactFive(next) });
  };
  const setBoothManagerAudio = (b: MetaverseBooth, index: number, which: 'fa' | 'en', url: string) => {
    const field = which === 'fa' ? 'managerAudiosFa' : 'managerAudiosEn';
    const next = Array.from({ length: 5 }, (_, i) => b[field]?.[i] || '');
    next[index] = url || '';
    updBooth(b.id, { [field]: compactFive(next), ...(which === 'fa' ? { managerAudios: undefined } : {}) } as Partial<MetaverseBooth>);
  };
  const setBoothCounterGlb = (b: MetaverseBooth, index: number, url: string) => {
    const next = Array.from({ length: 5 }, (_, i) => b.counterGlbs?.[i] || '');
    next[index] = url || '';
    updBooth(b.id, { counterGlbs: compactFive(next) });
  };

  // ── Environmental wall ads ──
  const WALLS: ExpoWall[] = ['back', 'left', 'right', 'front'];
  const updWallAds = (wallAds: ExpoWallAd[]) => patch({ wallAds });
  const addWallAd = () => { const s = bannerSize('standard'); updWallAds([...(e.wallAds || []), { id: newId('ad'), wall: 'back', size: s.key, w: s.w, h: s.h }]); };
  const updWallAd = (id: string, p: Partial<ExpoWallAd>) => updWallAds((e.wallAds || []).map(a => a.id === id ? { ...a, ...p } : a));
  const setWallAdTitle = (ad: ExpoWallAd, which: 'fa' | 'en', val: string) =>
    updWallAd(ad.id, { title: { ...(ad.title || {}), [which]: val } });
  const setAdSize = (id: string, key: string) => { const s = bannerSize(key); updWallAd(id, { size: key, w: s.w, h: s.h }); };
  const moveWallAd = (id: string, dir: -1 | 1) => {
    const ads = [...(e.wallAds || [])];
    const i = ads.findIndex(a => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ads.length) return;
    [ads[i], ads[j]] = [ads[j], ads[i]];
    updWallAds(ads);
  };
  const delWallAd = (id: string) => updWallAds((e.wallAds || []).filter(a => a.id !== id));

  // ── End-wall PDF presentation ──
  const setPres = (p: Partial<ExpoPresentation>) => patch({ presentation: { ...(e.presentation || {}), ...p } });
  const setMeet = (p: Partial<ExpoMeetWall>) => patch({ meetWall: { ...(e.meetWall || {}), ...p } });
  const setMeetTitle = (which: 'fa' | 'en', val: string) => setMeet({ title: { ...(e.meetWall?.title || {}), [which]: val } });
  const setPresence = (p: Partial<NonNullable<MetaverseExpo['presence']>>) => patch({ presence: { ...(e.presence || {}), ...p } });
  const updRetailCategories = (retailCategories: ExpoRetailCategory[]) => patch({ retailCategories });
  const addRetailCategory = () => {
    const i = (e.retailCategories || []).length + 1;
    updRetailCategories([...(e.retailCategories || []), {
      id: newId('retail-cat'),
      title: { fa: `دسته ${i}`, en: `Department ${i}` },
      color: ['#16a34a', '#f59e0b', '#0ea5e9', '#a855f7', '#ef4444'][i % 5],
      shopSlugs: [],
    }]);
  };
  const updRetailCategory = (id: string, p: Partial<ExpoRetailCategory>) => updRetailCategories((e.retailCategories || []).map(c => c.id === id ? { ...c, ...p } : c));
  const delRetailCategory = (id: string) => {
    patch({
      retailCategories: (e.retailCategories || []).filter(c => c.id !== id),
      booths: (e.booths || []).map(b => b.categoryId === id ? { ...b, categoryId: undefined } : b),
    });
  };
  const setRetailBi = (cat: ExpoRetailCategory, field: 'title' | 'description', which: 'fa' | 'en', val: string) =>
    updRetailCategory(cat.id, { [field]: { ...((cat[field] as MetaShopDirCat) || {}), [which]: val } } as Partial<ExpoRetailCategory>);
  const uploadPdf = (key: string, file: File, onUrl: (u: string) => void) => {
    if (!/\.pdf$/i.test(file.name)) { alert(T ? 'فقط فایل PDF مجاز است.' : 'Only PDF files allowed.'); return; }
    if (file.size > 40 * 1024 * 1024) { alert(t.tooBig); return; }
    setUploading(key);
    uploadFileWithProgress(file, () => {}, u => { onUrl(u); setUploading(null); }, err => { alert(err.message); setUploading(null); }, 'documents');
  };

  // Quick setup: auto-size the hall and arrange booths in the selected pattern.
  const applyLayoutToBooths = (layout = quickLayout, tier?: BoothTier) => {
    const current = e.booths || [];
    if (current.length === 0) return;
    const L = normalizeBoothLayout(layout);
    const { width, depth, spawn, cells } = autoArrangeBooths(current.length, L);
    const cats = L === 'supermarket' && !(e.retailCategories || []).length ? defaultRetailCategories() : (e.retailCategories || []);
    const booths = current.map((b, i) => ({
      ...b,
      x: cells[i]?.x ?? b.x,
      z: cells[i]?.z ?? b.z,
      ry: cells[i]?.ry ?? b.ry,
      floorId: undefined,
      tier: tier || b.tier || 'basic',
      categoryId: L === 'supermarket' && cats.length ? (b.categoryId || cats[i % cats.length].id) : b.categoryId,
    }));
    const visualStyle: ExpoVisualStyle | undefined = L === 'storefront' ? 'storefront' : L === 'supermarket' ? 'supermarket' : undefined;
    const hallPatch = { width, depth, entranceEnabled: true };
    patch({ boothLayout: L, ...hallPatch, spawn, booths, ...(visualStyle ? { visualStyle } : {}), ...(L === 'supermarket' && !(e.retailCategories || []).length ? { retailCategories: cats } : {}) });
  };
  const setTierAndApply = (tier: BoothTier) => {
    setQuickTier(tier);
    if ((e.booths || []).length > 0) patch({ booths: (e.booths || []).map(b => ({ ...b, tier })) });
  };
  const quickBuild = () => {
    if ((e.booths || []).length > 0 && !confirm(t.quickConfirm)) return;
    const L = normalizeBoothLayout(quickLayout);
    const { width, depth, spawn, cells } = autoArrangeBooths(quickN, L);
    const cats = L === 'supermarket' && !(e.retailCategories || []).length ? defaultRetailCategories() : (e.retailCategories || []);
    const isSF = L === 'storefront';
    const booths: MetaverseBooth[] = cells.map((c, i) => ({
      id: newId('booth'), name: { fa: isSF ? `دفتر ${i + 1}` : `غرفه ${i + 1}`, en: isSF ? `Office ${i + 1}` : `Booth ${i + 1}` },
      x: c.x, y: 0, z: c.z, ry: c.ry, color: isSF ? '#0f766e' : '#2d4a1a', tier: quickTier,
      categoryId: L === 'supermarket' && cats.length ? cats[i % cats.length].id : undefined,
      hotspots: [],
    }));
    const visualStyle: ExpoVisualStyle | undefined = isSF ? 'storefront' : L === 'supermarket' ? 'supermarket' : undefined;
    const hallPatch = { width, depth, entranceEnabled: true };
    patch({ boothLayout: L, ...hallPatch, spawn, booths, ...(visualStyle ? { visualStyle } : {}), ...(L === 'supermarket' && !(e.retailCategories || []).length ? { retailCategories: cats } : {}) });
    setOpenBooth(null);
  };

  // Link a booth to a shop and pull the shop's name/logo/banner/color/video into the booth.
  const applyShopToBooth = (booth: MetaverseBooth, slug: string) => {
    if (!slug) { updBooth(booth.id, { shopSlug: undefined }); return; }
    const shop = shops.find(s => s.slug === slug);
    const categoryId = booth.categoryId || (e.retailCategories || []).find(c => (c.shopSlugs || []).includes(slug))?.id;
    if (!shop) { updBooth(booth.id, { shopSlug: slug, categoryId }); return; }
    updBooth(booth.id, { ...shopToBoothFields(shop, lang), categoryId });
  };
  const firstProductVideo = (slug?: string) => (slug ? (shops.find(s => s.slug === slug)?.products || []).find(p => p.videoUrl)?.videoUrl : undefined);

  // ── Booth wall panels (3 inner + 3 outer; each an image URL or a video link) ──
  const panelVal = (b: MetaverseBooth, face: BoothFace): string =>
    (b.panels?.[face]) || (face === 'innerBack' ? (b.screenUrl || b.bannerImage || '') : '');
  const setPanel = (b: MetaverseBooth, face: BoothFace, url: string) => {
    const panels = { ...(b.panels || {}) };
    if (url) panels[face] = url; else delete panels[face];
    const p: Partial<MetaverseBooth> = { panels };
    if (face === 'innerBack') { p.screenUrl = undefined; p.bannerImage = undefined; } // migrate legacy into panels
    updBooth(b.id, p);
  };

  // ── Hotspots ──
  const updHotspots = (boothId: string, hs: MetaverseHotspot[]) => updBooth(boothId, { hotspots: hs });
  const addHotspot = (b: MetaverseBooth) => {
    const h: MetaverseHotspot = { id: newId('hs'), type: 'company', x: 0, y: 1.6, z: 2, shopSlug: b.shopSlug, title: { fa: '', en: '' } };
    updHotspots(b.id, [...(b.hotspots || []), h]);
  };
  const updHotspot = (b: MetaverseBooth, hid: string, p: Partial<MetaverseHotspot>) => updHotspots(b.id, (b.hotspots || []).map(h => h.id === hid ? { ...h, ...p } : h));
  const delHotspot = (b: MetaverseBooth, hid: string) => updHotspots(b.id, (b.hotspots || []).filter(h => h.id !== hid));
  const setHotBi = (b: MetaverseBooth, hid: string, field: 'title' | 'body', which: 'fa' | 'en', val: string) => {
    const h = (b.hotspots || []).find(x => x.id === hid); if (!h) return;
    updHotspot(b, hid, { [field]: { ...((h[field] as MetaShopDirCat) || {}), [which]: val } } as any);
  };

  // ── Uploads ──
  const uploadImage = (key: string, file: File, onUrl: (u: string) => void) => {
    setUploading(key);
    uploadFileWithProgress(file, () => {}, u => { onUrl(u); setUploading(null); }, err => { alert(err.message); setUploading(null); }, 'images');
  };
  const uploadGlb = (key: string, file: File, onUrl: (u: string) => void) => {
    if (!/\.(glb|gltf)$/i.test(file.name)) { alert(t.glbErr); return; }
    if (file.size > 30 * 1024 * 1024) { alert(t.tooBig); return; }
    setUploading(key);
    uploadFileWithProgress(file, () => {}, u => { onUrl(u); setUploading(null); }, err => { alert(err.message); setUploading(null); }, 'documents');
  };
  // Upload a real video FILE (mp4/webm/ogg) → its URL plays muted on the booth wall (VideoTexture).
  const uploadVideo = (key: string, file: File, onUrl: (u: string) => void) => {
    if (!/\.(mp4|webm|ogg)$/i.test(file.name) && !/^video\//.test(file.type)) { alert(t.vidErr); return; }
    if (file.size > 150 * 1024 * 1024) { alert(t.vidTooBig); return; }
    setUploading(key); setUploadPct(0);
    uploadFileWithProgress(
      file,
      p => setUploadPct(Math.round(p)),
      u => { onUrl(u); setUploading(null); setUploadPct(0); },
      err => { alert(err.message); setUploading(null); setUploadPct(0); },
      'documents',
    );
  };
  const uploadAudio = (key: string, file: File, onUrl: (u: string) => void) => {
    if (!/\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(file.name) && !/^audio\//.test(file.type)) { alert(t.audioErr); return; }
    if (file.size > 30 * 1024 * 1024) { alert(t.tooBig); return; }
    setUploading(key); setUploadPct(0);
    uploadFileWithProgress(
      file,
      p => setUploadPct(Math.round(p)),
      u => { onUrl(u); setUploading(null); setUploadPct(0); },
      err => { alert(err.message); setUploading(null); setUploadPct(0); },
      'documents',
    );
  };
  // Upload an HTML page → shown on the booth wall through an iframe. Force text/html so Firebase
  // serves it inline (renderable in the iframe) instead of as a download.
  const uploadHtml = (key: string, file: File, onUrl: (u: string) => void) => {
    if (!/\.html?$/i.test(file.name) && !/html/.test(file.type)) { alert(t.htmlErr); return; }
    if (file.size > 10 * 1024 * 1024) { alert(t.tooBig); return; }
    setUploading(key);
    uploadFileWithProgress(file, () => {}, u => { onUrl(u); setUploading(null); }, err => { alert(err.message); setUploading(null); }, 'documents', 'text/html; charset=utf-8');
  };

  const ImgUpload: React.FC<{ id: string; value?: string; onUrl: (u: string) => void; label: string }> = ({ id, value, onUrl, label }) => {
    const ref = useRef<HTMLInputElement>(null);
    return (
      <div>
        <label className={lbl}>{label}</label>
        <div className="flex items-center gap-2">
          {value && <img src={value} alt="" className="w-9 h-9 rounded object-cover border border-gray-200" />}
          <button type="button" onClick={() => ref.current?.click()} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"><IconUpload className="w-3.5 h-3.5" />{uploading === id ? t.uploading : t.upload}</button>
          {value && <button type="button" onClick={() => onUrl('')} className="text-xs text-red-400 hover:text-red-600">{t.clear}</button>}
          <input type="file" ref={ref} className="hidden" accept="image/*" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadImage(id, f, onUrl); ev.target.value = ''; }} />
        </div>
      </div>
    );
  };
  const AudioUpload: React.FC<{ id: string; value?: string; onUrl: (u: string) => void; label: string }> = ({ id, value, onUrl, label }) => {
    const ref = useRef<HTMLInputElement>(null);
    return (
      <div>
        <label className={lbl}>{label}</label>
        <div className="flex items-center gap-2">
          {value && <span className="text-[11px] px-2 py-1 rounded bg-sky-50 text-sky-700 font-bold">AUDIO</span>}
          <button type="button" onClick={() => ref.current?.click()} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"><IconUpload className="w-3.5 h-3.5" />{uploading === id ? t.uploading : t.upload}</button>
          {value && <button type="button" onClick={() => onUrl('')} className="text-xs text-red-400 hover:text-red-600">{t.clear}</button>}
          <input type="file" ref={ref} className="hidden" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadAudio(id, f, onUrl); ev.target.value = ''; }} />
        </div>
        {uploading === id && <span className="text-[10px] text-gray-400">{t.uploading} {uploadPct > 0 ? `${uploadPct}%` : ''}</span>}
      </div>
    );
  };
  const GlbUpload: React.FC<{ id: string; value?: string; onUrl: (u: string) => void; label: string }> = ({ id, value, onUrl, label }) => {
    const ref = useRef<HTMLInputElement>(null);
    return (
      <div>
        <label className={lbl}>{label}</label>
        <div className="flex items-center gap-2">
          {value && <span className="text-[11px] text-emerald-600 font-bold">✓ GLB</span>}
          <button type="button" onClick={() => ref.current?.click()} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"><IconUpload className="w-3.5 h-3.5" />{uploading === id ? t.uploading : t.upload}</button>
          {value && <button type="button" onClick={() => onUrl('')} className="text-xs text-red-400 hover:text-red-600">{t.clear}</button>}
          <input type="file" ref={ref} className="hidden" accept=".glb,.gltf,model/gltf-binary" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadGlb(id, f, onUrl); ev.target.value = ''; }} />
        </div>
      </div>
    );
  };

  const AdMediaUpload: React.FC<{ id: string; value?: string; onUrl: (u: string) => void; label: string }> = ({ id, value, onUrl, label }) => {
    const imgRef = useRef<HTMLInputElement>(null);
    const vidRef = useRef<HTMLInputElement>(null);
    const pdfRef = useRef<HTMLInputElement>(null);
    const isImage = !!value && /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(value);
    const isPdf = !!value && /\.pdf(\?.*)?$/i.test(value);
    const isVideo = !!value && /\.(mp4|webm|ogg)(\?.*)?$/i.test(value);
    return (
      <div>
        <label className={lbl}>{label}</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {isImage && <img src={value} alt="" className="w-9 h-9 rounded object-cover border border-gray-200" />}
          {isPdf && <span className="text-[11px] px-2 py-1 rounded bg-amber-50 text-amber-700 font-bold">PDF</span>}
          {isVideo && <span className="text-[11px] px-2 py-1 rounded bg-rose-50 text-rose-700 font-bold">VIDEO</span>}
          {!readonly && <button type="button" title={t.uploadImg} onClick={() => imgRef.current?.click()} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><IconUpload className="w-3.5 h-3.5" /></button>}
          {!readonly && <button type="button" title={t.uploadVid} onClick={() => vidRef.current?.click()} className="text-[13px] px-1.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50">🎬</button>}
          {!readonly && <button type="button" title={t.uploadPdf} onClick={() => pdfRef.current?.click()} className="text-[12px] px-1.5 py-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50">PDF</button>}
          {value && !readonly && <button type="button" onClick={() => onUrl('')} className="text-xs text-red-400 hover:text-red-600">{t.clear}</button>}
          <input type="file" ref={imgRef} className="hidden" accept="image/*" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadImage(id, f, onUrl); ev.target.value = ''; }} />
          <input type="file" ref={vidRef} className="hidden" accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadVideo(id, f, onUrl); ev.target.value = ''; }} />
          <input type="file" ref={pdfRef} className="hidden" accept="application/pdf,.pdf" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadPdf(id, f, onUrl); ev.target.value = ''; }} />
        </div>
        {uploading === id && <span className="text-[10px] text-gray-400">{t.uploading} {uploadPct > 0 ? `${uploadPct}%` : ''}</span>}
      </div>
    );
  };

  // One wall-panel field: a URL input + shortcuts to upload an image/GIF, a video file, or an
  // HTML page. Uploaded media renders directly on the wall (image/GIF/video texture or iframe).
  const PanelField: React.FC<{ id: string; value?: string; onUrl: (u: string) => void; label: string; product?: string }> = ({ id, value, onUrl, label, product }) => {
    const imgRef = useRef<HTMLInputElement>(null);
    const vidRef = useRef<HTMLInputElement>(null);
    const pdfRef = useRef<HTMLInputElement>(null);
    const htmlRef = useRef<HTMLInputElement>(null);
    return (
      <div>
        <label className={lbl}>{label}</label>
        <div className="flex gap-1">
          <input className={fld + ' dir-ltr'} value={value || ''} onChange={ev => onUrl(ev.target.value)} placeholder={T ? 'لینک، یا از دکمه‌ها آپلود کنید' : 'link, or upload via buttons'} />
          {!readonly && <button type="button" title={t.uploadImg} onClick={() => imgRef.current?.click()} className="shrink-0 text-xs px-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><IconUpload className="w-3.5 h-3.5" /></button>}
          {!readonly && <button type="button" title={t.uploadVid} onClick={() => vidRef.current?.click()} className="shrink-0 text-[13px] px-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50">🎬</button>}
          {!readonly && <button type="button" title={t.uploadPdf} onClick={() => pdfRef.current?.click()} className="shrink-0 text-[12px] px-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50">PDF</button>}
          {!readonly && <button type="button" title={t.uploadHtml} onClick={() => htmlRef.current?.click()} className="shrink-0 text-[12px] px-1.5 rounded-lg border border-sky-200 text-sky-600 hover:bg-sky-50">🌐</button>}
          {product && !readonly && <button type="button" title={t.screenAuto} onClick={() => onUrl(product)} className="shrink-0 text-[11px] px-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50">📹</button>}
          <input type="file" ref={imgRef} className="hidden" accept="image/*" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadImage(id, f, onUrl); ev.target.value = ''; }} />
          <input type="file" ref={vidRef} className="hidden" accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadVideo(id, f, onUrl); ev.target.value = ''; }} />
          <input type="file" ref={pdfRef} className="hidden" accept="application/pdf,.pdf" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadPdf(id, f, onUrl); ev.target.value = ''; }} />
          <input type="file" ref={htmlRef} className="hidden" accept="text/html,.html,.htm" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadHtml(id, f, onUrl); ev.target.value = ''; }} />
        </div>
        {uploading === id && <span className="text-[10px] text-gray-400">{t.uploading} {uploadPct > 0 ? `${uploadPct}%` : ''}</span>}
      </div>
    );
  };

  // ── 2D floor-plan (drag to place) ──
  const FloorPlan: React.FC = () => {
    const svgRef = useRef<SVGSVGElement>(null);
    const W = Math.max(8, e.width || 30), D = Math.max(8, e.depth || 30);
    const dragId = useRef<string | null>(null);
    const isSF = e.visualStyle === 'storefront' || e.visualStyle === 'business_center';
    const sfTheme = { accent: '#0d9488', planBg: '#f0fdfa', floorColor: '#ccfbf1', boothColor: '#0f766e', boothZone: '#99f6e4', carpetColor: '#9f1239', carpetBorder: '#d4a574', signBg: '#0f766e' };
    const theme = isSF ? sfTheme : null;
    const tierMark = (tier?: BoothTier) => tier === 'premium' ? 'P' : tier === 'standard' ? 'S' : 'B';
    const visibleBooths = e.booths || [];
    const toWorld = (clientX: number, clientY: number) => {
      const r = svgRef.current!.getBoundingClientRect();
      const nx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      const ny = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
      return { x: +(nx * W - W / 2).toFixed(2), z: +(ny * D - D / 2).toFixed(2) };
    };
    const onMove = (ev: React.PointerEvent) => {
      if (!dragId.current) return;
      const { x, z } = toWorld(ev.clientX, ev.clientY);
      if (dragId.current === '__spawn__') setSpawn('x', x), setSpawn('z', z);
      else updBooth(dragId.current, { x, z });
    };
    const wx = (x: number) => ((x + W / 2) / W) * 100;
    const wz = (z: number) => ((z + D / 2) / D) * 100;
    const boothPw = (4 / W) * 100;
    const boothPh = (4 / D) * 100;
    const cats = e.retailCategories || [];
    const carpets = layoutCarpetRects(e.boothLayout || 'cross', W, D);
    return (
      <div>
        <p className="text-[11px] text-slate-600 mb-2">{t.layoutHint}</p>
      <svg
        ref={svgRef} viewBox="0 0 100 100" preserveAspectRatio="none"
        className="w-full rounded-xl border-2 touch-none select-none"
        style={{
          aspectRatio: `${W} / ${D}`,
          cursor: dragId.current ? 'grabbing' : 'default',
          borderColor: theme?.accent || '#cbd5e1',
          background: theme ? `linear-gradient(135deg, ${theme.planBg} 0%, ${theme.floorColor} 100%)` : undefined,
        }}
        onPointerMove={onMove}
        onPointerUp={() => { dragId.current = null; }}
        onPointerLeave={() => { dragId.current = null; }}
      >
        <rect x={0.5} y={0.5} width={99} height={99} fill="none" stroke={theme?.accent || '#cbd5e1'} strokeWidth={0.8} />
        {carpets.map((c, ci) => {
          const r = planRectPct(c, W, D);
          const fill = c.entrance ? (c.color || '#b91c1c') : (theme?.carpetColor || c.color || '#9f1239');
          const stroke = c.entrance ? (c.border || '#fca5a5') : (theme?.carpetBorder || c.border || '#d4a574');
          return (
            <g key={`carpet-${ci}`}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={0.6} fill={fill} opacity={c.entrance ? 0.55 : 0.35} />
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={0.6} fill="none" stroke={stroke} strokeWidth={0.35} opacity={0.7} />
            </g>
          );
        })}
        {e.visualStyle === 'supermarket' && cats.map((c, i) => {
          const rows = Math.max(1, Math.ceil(cats.length / 2));
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = col === 0 ? 6 : 52;
          const y = 8 + row * (84 / rows);
          const h = Math.max(12, 72 / rows);
          return (
            <g key={c.id}>
              <rect x={x} y={y} width={42} height={h} rx={2} fill={c.color || '#16a34a'} opacity={0.12} stroke={c.color || '#16a34a'} strokeWidth={0.4} />
              <text x={x + 21} y={y + 4.2} textAnchor="middle" fontSize={2.8} fill={c.color || '#166534'} fontWeight="bold">{(T ? c.title?.fa : c.title?.en) || c.title?.fa || c.title?.en || ''}</text>
            </g>
          );
        })}
        {!readonly && visibleBooths.map((b, i) => (
          <g key={b.id} transform={`translate(${wx(b.x || 0)} ${wz(b.z || 0)})`} style={{ cursor: 'grab' }}
            onPointerDown={ev => { (ev.target as Element).setPointerCapture?.(ev.pointerId); dragId.current = b.id; }}
            onClick={() => setOpenBooth(b.id)}
          >
            <rect x={-3.2} y={-3.2} width={6.4} height={6.4} rx={1} fill={b.color || theme?.boothColor || '#2d4a1a'} stroke="#fff" strokeWidth={0.5} />
            <text x={0} y={6.5} textAnchor="middle" fontSize={2.9} fill="#475569">{T ? `غ ${i + 1}` : `B${i + 1}`}</text>
            <text x={0} y={10.2} textAnchor="middle" fontSize={2.1} fill="#64748b">{tierMark(b.tier)}</text>
          </g>
        ))}
        {/* spawn marker */}
        <g transform={`translate(${wx(e.spawn?.x || 0)} ${wz(e.spawn?.z || 0)})`} style={{ cursor: 'grab' }}
          onPointerDown={ev => { (ev.target as Element).setPointerCapture?.(ev.pointerId); dragId.current = '__spawn__'; }}
        >
          <circle r={2.4} fill="#22d3ee" stroke="#0e7490" strokeWidth={0.6} />
          <text x={0} y={-3.2} textAnchor="middle" fontSize={3} fill="#0e7490" fontWeight="bold">{T ? 'شروع' : 'start'}</text>
        </g>
      </svg>
      </div>
    );
  };

  const previewUrl = `${shopBaseUrl}?expo=${encodeURIComponent(bazaarSlug)}`;
  const shopProducts = (slug?: string) => (slug ? (shops.find(s => s.slug === slug)?.products || []) : []);
  const downloadExpoAdsJsonSample = () => {
    const wallAds = (e.wallAds || []).length > 0 ? (e.wallAds || []).map((ad, i) => ({
      id: ad.id || `wall-ad-${i + 1}`,
      wall: ad.wall || 'back',
      size: ad.size || 'standard',
      w: ad.w || bannerSize(ad.size).w,
      h: ad.h || bannerSize(ad.size).h,
      scale: ad.scale ?? 1,
      lift: ad.lift ?? 0,
      title: ad.title || { fa: `تبلیغات محیطی ${i + 1}`, en: `Wall Advertising ${i + 1}` },
      enabled: ad.enabled !== false,
      image: ad.image || 'PASTE_GENERATED_IMAGE_OR_VIDEO_GIF_PDF_URL_HERE',
      url: ad.url || 'https://example.com',
    })) : [
      { id: 'wall-ad-back-1', wall: 'back', size: 'billboard', w: 6, h: 3, scale: 1, lift: 0, title: { fa: 'تبلیغات اصلی سالن', en: 'Main Hall Advertisement' }, image: 'PASTE_GENERATED_IMAGE_URL_HERE', url: 'https://example.com' },
      { id: 'wall-ad-left-1', wall: 'left', size: 'wide', w: 4.5, h: 2, scale: 1.15, lift: 0.4, title: { fa: 'حامی نمایشگاه', en: 'Expo Sponsor' }, image: 'PASTE_GENERATED_IMAGE_URL_HERE', url: 'https://example.com' },
      { id: 'wall-ad-right-1', wall: 'right', size: 'standard', w: 3, h: 2, scale: 1, lift: -0.25, title: { fa: 'محل تبلیغات', en: 'Advertising Space' }, image: 'PASTE_GENERATED_IMAGE_URL_HERE', url: 'https://example.com' },
    ];
    const entranceAds = (e.entranceAds || []).length > 0 ? (e.entranceAds || []).map((ad, i) => ({
      id: ad.id || `entrance-ad-${i + 1}`,
      position: ad.position || 'aboveArch',
      size: ad.size || 'billboard',
      w: ad.w || bannerSize(ad.size).w,
      h: ad.h || bannerSize(ad.size).h,
      lift: ad.lift ?? (ad.position === 'aboveArch' ? 0.75 : undefined),
      title: ad.title || { fa: `تبلیغات ورودی ${i + 1}`, en: `Entrance Advertising ${i + 1}` },
      enabled: ad.enabled !== false,
      image: ad.image || 'PASTE_GENERATED_IMAGE_OR_VIDEO_GIF_PDF_URL_HERE',
      url: ad.url || 'https://example.com',
    })) : [
      { id: 'entrance-above-arch', position: 'aboveArch', size: 'billboard', w: 8, h: 2.5, lift: 1, title: { fa: 'بنر بالای سردر', en: 'Banner Above Entrance Arch' }, image: 'PASTE_GENERATED_IMAGE_URL_HERE', url: 'https://example.com' },
      { id: 'entrance-rail-left', position: 'railLeft', size: 'portrait', w: 2, h: 3.5, title: { fa: 'بنر ایستاده چپ', en: 'Left Standing Banner' }, image: 'PASTE_GENERATED_IMAGE_URL_HERE', url: 'https://example.com' },
      { id: 'entrance-rail-right', position: 'railRight', size: 'portrait', w: 2, h: 3.5, title: { fa: 'بنر ایستاده راست', en: 'Right Standing Banner' }, image: 'PASTE_GENERATED_IMAGE_URL_HERE', url: 'https://example.com' },
    ];
    const sample = {
      _instructions: {
        fa: 'این فایل را به هوش مصنوعی بدهید تا فقط مقدار image را با URL رسانه تولیدشده پر کند. سپس در بخش بازارچه‌ها روی همان بازارچه، دکمه به‌روزرسانی از JSON را بزنید و این فایل را آپلود کنید.',
        en: 'Give this file to an AI image/media generator and ask it to replace only the image fields with generated media URLs. Then upload it via Bazaars > Update from JSON for the target bazaar.',
      },
      expo: {
        wallAdScale: e.wallAdScale ?? 1.35,
        wallAdLift: e.wallAdLift ?? 2,
        wallAds,
        entranceAds,
      },
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `expo-ads-ai-sample-${bazaarSlug || 'bazaar'}.json`;
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className={card + ' space-y-4'}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xl">🥽</span>
          <div><h4 className="font-bold text-gray-800">{t.title}</h4><p className="text-xs text-gray-400 max-w-md">{t.hint}</p></div>
        </div>
        <div className="flex items-center gap-2">
          {e.enabled && (
            onPreview
              ? <button type="button" onClick={() => onPreview()} title={t.previewHint} className="text-xs px-3 py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1"><IconGlobe className="w-3.5 h-3.5" />{t.preview}</button>
              : (bazaarSlug && <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs px-3 py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1"><IconGlobe className="w-3.5 h-3.5" />{t.preview}</a>)
          )}
          {e.enabled && <button type="button" onClick={downloadExpoAdsJsonSample} className="text-xs px-3 py-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50">⤓ {t.adsJsonSample}</button>}
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <input type="checkbox" className="w-4 h-4 accent-indigo-600" disabled={readonly} checked={!!e.enabled} onChange={ev => onChange({ ...(expo || blankExpo()), enabled: ev.target.checked })} />
            {t.enable}
          </label>
        </div>
      </div>

      {e.enabled && (
        <div className="space-y-5 animate-fade-in">
          {/* Hall settings */}
          <div className="border border-gray-100 rounded-xl p-4">
            <h5 className="font-bold text-gray-700 text-sm mb-3">{t.hall}</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div><label className={lbl}>{t.titleFa}</label><input className={fld} value={e.title?.fa || ''} onChange={ev => setBi('title', 'fa', ev.target.value)} /></div>
              <div><label className={lbl}>{t.titleEn}</label><input className={fld + ' dir-ltr'} value={e.title?.en || ''} onChange={ev => setBi('title', 'en', ev.target.value)} /></div>
              <div><label className={lbl}>{t.preset}</label><select className={fld + ' bg-white'} value={e.preset || 'warehouse'} onChange={ev => patch({ preset: ev.target.value as EnvPreset })}>{PRESETS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
              <div><label className={lbl}>{t.visualStyle}</label>
                <select className={fld + ' bg-white'} value={e.visualStyle === 'business_center' ? 'storefront' : (e.visualStyle || 'exhibition')} onChange={ev => {
                  const visualStyle = ev.target.value as ExpoVisualStyle;
                  const extra = visualStyle === 'supermarket' && !(e.retailCategories || []).length
                    ? { retailCategories: defaultRetailCategories() }
                    : visualStyle === 'storefront'
                      ? { width: 24, depth: 28, entranceEnabled: true }
                      : {};
                  patch({ visualStyle, ...extra });
                }}>
                  <option value="exhibition">{t.styleExhibition}</option>
                  <option value="storefront">{t.styleStorefront}</option>
                  <option value="supermarket">{t.styleSupermarket}</option>
                </select>
              </div>
              <div><label className={lbl}>{t.subFa}</label><input className={fld} value={e.subtitle?.fa || ''} onChange={ev => setBi('subtitle', 'fa', ev.target.value)} /></div>
              <div><label className={lbl}>{t.subEn}</label><input className={fld + ' dir-ltr'} value={e.subtitle?.en || ''} onChange={ev => setBi('subtitle', 'en', ev.target.value)} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={lbl}>{t.width}</label><input type="number" className={fld} value={e.width ?? 30} onChange={ev => patch({ width: +ev.target.value })} /></div>
                <div><label className={lbl}>{t.depth}</label><input type="number" className={fld} value={e.depth ?? 30} onChange={ev => patch({ depth: +ev.target.value })} /></div>
                <div><label className={lbl}>{t.height}</label><input type="number" min={4} step={0.5} className={fld} value={e.height ?? 9} onChange={ev => patch({ height: +ev.target.value })} /></div>
              </div>
              <div><label className={lbl}>{t.ground}</label><div className="flex gap-2"><input type="color" value={e.groundColor || '#cfd4dc'} onChange={ev => patch({ groundColor: ev.target.value })} className="w-10 h-9 rounded border border-gray-300" /><input className={fld + ' dir-ltr'} value={e.groundColor || ''} onChange={ev => patch({ groundColor: ev.target.value })} /></div></div>
              <div><label className={lbl}>{t.wall}</label><div className="flex gap-2"><input type="color" value={e.wallColor || '#e9edf3'} onChange={ev => patch({ wallColor: ev.target.value })} className="w-10 h-9 rounded border border-gray-300" /><input className={fld + ' dir-ltr'} value={e.wallColor || ''} onChange={ev => patch({ wallColor: ev.target.value })} /></div></div>
              <GlbUpload id="env-glb" value={e.environmentUrl} onUrl={u => patch({ environmentUrl: u || undefined })} label={t.envGlb} />
              <div><label className={lbl}>{t.skybox}</label><input className={fld + ' dir-ltr'} value={e.skyboxUrl || ''} onChange={ev => patch({ skyboxUrl: ev.target.value || undefined })} placeholder="https://…/sky.hdr" /></div>
              <div><label className={lbl}>{t.music}</label><input className={fld + ' dir-ltr'} value={e.music || ''} onChange={ev => patch({ music: ev.target.value || undefined })} placeholder="https://…/ambient.mp3" /></div>
            </div>
          </div>

          {/* Entrance corridor */}
          <div className="border border-emerald-100 bg-emerald-50/40 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <h5 className="font-bold text-emerald-800 text-sm">🚪 {t.entranceT}</h5>
                <p className="text-[11px] text-emerald-700/70 mt-0.5">{t.entranceHint}</p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                <input type="checkbox" className="w-4 h-4 accent-emerald-600" disabled={readonly} checked={!!e.entranceEnabled} onChange={ev => patch({ entranceEnabled: ev.target.checked })} />
                {t.entranceEnable}
              </label>
            </div>
            {e.entranceEnabled && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div><label className={lbl}>{t.organizerFa}</label><input className={fld} value={e.entranceOrganizer?.fa || ''} onChange={ev => setEntranceOrganizer('fa', ev.target.value)} placeholder={e.title?.fa || ''} /></div>
                  <div><label className={lbl}>{t.organizerEn}</label><input className={fld + ' dir-ltr'} value={e.entranceOrganizer?.en || ''} onChange={ev => setEntranceOrganizer('en', ev.target.value)} placeholder={e.title?.en || ''} /></div>
                  <ImgUpload id="entrance-doorman" value={e.entranceDoormanImage} onUrl={u => patch({ entranceDoormanImage: u || undefined })} label={t.doormanPng} />
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white/70 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h6 className="text-xs font-bold text-emerald-800">{t.entranceAdsT} <span className="text-[11px] text-emerald-500">({(e.entranceAds || []).length})</span></h6>
                    {!readonly && <button type="button" onClick={addEntranceAd} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addEntranceAd}</button>}
                  </div>
                  {(e.entranceAds || []).length === 0 ? <p className="text-sm text-emerald-700/50 text-center py-2">{t.noEntranceAds}</p> : (
                    <div className="space-y-2">
                      {(e.entranceAds || []).map(ad => (
                        <div key={ad.id} className={`rounded-lg border border-emerald-100 bg-emerald-50/40 p-2.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-2 items-end ${ad.enabled === false ? 'opacity-50' : ''}`}>
                          <div className="lg:col-span-8">
                            <label className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                              <input type="checkbox" className="w-4 h-4 accent-emerald-600" disabled={readonly} checked={ad.enabled !== false} onChange={ev => updEntranceAd(ad.id, { enabled: ev.target.checked })} />
                              {t.adEnabled}
                            </label>
                          </div>
                          <div><label className={lbl}>{t.entranceAdPos}</label>
                            <select className={fld + ' bg-white'} value={ad.position} onChange={ev => updEntranceAd(ad.id, { position: ev.target.value as ExpoEntranceAdPosition })}>
                              {ENTRANCE_AD_POSITIONS.map(p => <option key={p.key} value={p.key}>{T ? p.fa : p.en}</option>)}
                            </select>
                          </div>
                          <div><label className={lbl}>{t.adSize}</label>
                            <select className={fld + ' bg-white'} value={ad.size || 'portrait'} onChange={ev => setEntranceAdSize(ad.id, ev.target.value)}>
                              {BANNER_SIZES.map(s => <option key={s.key} value={s.key}>{(T ? s.fa : s.en)} ({s.w}×{s.h} {t.meter})</option>)}
                            </select>
                          </div>
                          <div><label className={lbl}>{t.adW}</label><input type="number" min={0.8} max={18} step={0.25} className={fld} value={ad.w ?? bannerSize(ad.size).w} onChange={ev => updEntranceAd(ad.id, { w: +ev.target.value || undefined })} /></div>
                          <div><label className={lbl}>{t.adH}</label><input type="number" min={0.8} max={8} step={0.25} className={fld} value={ad.h ?? bannerSize(ad.size).h} onChange={ev => updEntranceAd(ad.id, { h: +ev.target.value || undefined })} /></div>
                          {ad.position === 'aboveArch' && (
                            <div><label className={lbl}>{t.entranceAdLift}</label><input type="number" min={0} max={8} step={0.25} className={fld} value={ad.lift ?? 0.75} onChange={ev => updEntranceAd(ad.id, { lift: ev.target.value === '' ? undefined : +ev.target.value })} /></div>
                          )}
                          <div><label className={lbl}>{t.adTitleFa}</label><input className={fld} value={ad.title?.fa || ''} onChange={ev => setEntranceAdTitle(ad, 'fa', ev.target.value)} placeholder="تبلیغات ورودی" /></div>
                          <div><label className={lbl}>{t.adTitleEn}</label><input className={fld + ' dir-ltr'} value={ad.title?.en || ''} onChange={ev => setEntranceAdTitle(ad, 'en', ev.target.value)} placeholder="Entrance ad" /></div>
                          <AdMediaUpload id={`entrance-ad-${ad.id}`} value={ad.image} onUrl={u => updEntranceAd(ad.id, { image: u || undefined })} label={t.adImage} />
                          <div className="flex items-end gap-2">
                            <div className="flex-1"><label className={lbl}>{t.adLink}</label><input className={fld + ' dir-ltr'} value={ad.url || ''} onChange={ev => updEntranceAd(ad.id, { url: ev.target.value || undefined })} placeholder="https://…" /></div>
                            {!readonly && <button type="button" onClick={() => delEntranceAd(ad.id)} className="text-red-400 hover:text-red-600 pb-2" title={t.clear}><IconTrash className="w-4 h-4" /></button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Floor plan */}
          <div className="border border-gray-100 rounded-xl p-4">
            <h5 className="font-bold text-gray-700 text-sm mb-3">{t.floorplan}</h5>
            <FloorPlan />
          </div>

          {/* Supermarket / mall departments */}
          <div className="border border-lime-100 bg-lime-50/35 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
              <h5 className="font-bold text-lime-800 text-sm">🛒 {t.retailT} <span className="text-xs text-lime-500">({(e.retailCategories || []).length})</span></h5>
              {!readonly && <button type="button" onClick={addRetailCategory} className="text-xs px-3 py-1.5 rounded-lg bg-lime-600 text-white hover:bg-lime-700 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addRetailCat}</button>}
            </div>
            <p className="text-[11px] text-lime-700/75 mb-3">{t.retailHint}</p>
            {(e.retailCategories || []).length === 0 ? <p className="text-sm text-lime-700/50 text-center py-2">{t.noRetailCat}</p> : (
              <div className="space-y-2">
                {(e.retailCategories || []).map(cat => (
                  <div key={cat.id} className="rounded-lg border border-lime-100 bg-white/80 p-2.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-2 items-end">
                    <div><label className={lbl}>{t.retailTitleFa}</label><input className={fld} value={cat.title?.fa || ''} onChange={ev => setRetailBi(cat, 'title', 'fa', ev.target.value)} /></div>
                    <div><label className={lbl}>{t.retailTitleEn}</label><input className={fld + ' dir-ltr'} value={cat.title?.en || ''} onChange={ev => setRetailBi(cat, 'title', 'en', ev.target.value)} /></div>
                    <div><label className={lbl}>{t.retailDescFa}</label><input className={fld} value={cat.description?.fa || ''} onChange={ev => setRetailBi(cat, 'description', 'fa', ev.target.value)} placeholder="مثلاً حبوبات، برنج، خشکبار" /></div>
                    <div><label className={lbl}>{t.retailDescEn}</label><input className={fld + ' dir-ltr'} value={cat.description?.en || ''} onChange={ev => setRetailBi(cat, 'description', 'en', ev.target.value)} placeholder="Legumes, rice, nuts" /></div>
                    <div><label className={lbl}>{t.retailColor}</label><div className="flex gap-2"><input type="color" value={cat.color || '#16a34a'} onChange={ev => updRetailCategory(cat.id, { color: ev.target.value })} className="w-10 h-9 rounded border border-gray-300" /><input className={fld + ' dir-ltr'} value={cat.color || ''} onChange={ev => updRetailCategory(cat.id, { color: ev.target.value || undefined })} placeholder="#16a34a" /></div></div>
                    <div className="lg:col-span-2"><label className={lbl}>{t.retailShops}</label>
                      <select multiple className={fld + ' bg-white min-h-[76px]'} value={cat.shopSlugs || []} onChange={ev => updRetailCategory(cat.id, { shopSlugs: Array.from(ev.target.selectedOptions).map(o => o.value) })}>
                        {shops.map(s => <option key={s.id} value={s.slug}>{s.name}</option>)}
                      </select>
                    </div>
                    {!readonly && <button type="button" onClick={() => delRetailCategory(cat.id)} className="text-red-400 hover:text-red-600 pb-2 justify-self-end" title={t.clear}><IconTrash className="w-4 h-4" /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Environmental wall ads */}
          <div className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <h5 className="font-bold text-gray-700 text-sm">📣 {t.adsT} <span className="text-xs text-gray-400">({(e.wallAds || []).length})</span></h5>
              {!readonly && <button onClick={addWallAd} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addAd}</button>}
            </div>
            <p className="text-[11px] text-gray-400 mb-3">{t.adsHint}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-2.5">
              <div><label className={lbl}>{t.adScaleAll}</label><input type="number" min={0.5} max={3} step={0.05} className={fld} value={e.wallAdScale ?? 1.35} onChange={ev => patch({ wallAdScale: +ev.target.value || 1 })} /></div>
              <div><label className={lbl}>{t.adLiftAll}</label><input type="number" min={-4} max={8} step={0.25} className={fld} value={e.wallAdLift ?? 2} onChange={ev => patch({ wallAdLift: +ev.target.value || 0 })} /></div>
            </div>
            {(e.wallAds || []).length === 0 ? <p className="text-sm text-gray-400 text-center py-2">{t.noAds}</p> : (
              <div className="space-y-2">
                {(e.wallAds || []).map((ad, idx, ads) => (
                  <div key={ad.id} className={`rounded-lg border border-gray-200 p-2.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2 items-end ${ad.enabled === false ? 'opacity-50' : ''}`}>
                    <div className="lg:col-span-6">
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-700">
                        <input type="checkbox" className="w-4 h-4 accent-indigo-600" disabled={readonly} checked={ad.enabled !== false} onChange={ev => updWallAd(ad.id, { enabled: ev.target.checked })} />
                        {t.adEnabled}
                      </label>
                    </div>
                    <div><label className={lbl}>{t.adWall}</label>
                      <select className={fld + ' bg-white'} value={ad.wall} onChange={ev => updWallAd(ad.id, { wall: ev.target.value as ExpoWall })}>
                        <option value="back">{t.wallBack}</option><option value="left">{t.wallLeft}</option><option value="right">{t.wallRight}</option><option value="front">{t.wallFront}</option>
                      </select>
                    </div>
                    <div><label className={lbl}>{t.adSize}</label>
                      <select className={fld + ' bg-white'} value={ad.size || 'standard'} onChange={ev => setAdSize(ad.id, ev.target.value)}>
                        {BANNER_SIZES.map(s => <option key={s.key} value={s.key}>{(T ? s.fa : s.en)} ({s.w}×{s.h} {t.meter})</option>)}
                      </select>
                    </div>
                    <div><label className={lbl}>{t.adScaleOne}</label><input type="number" min={0.2} max={4} step={0.05} className={fld} value={ad.scale ?? 1} onChange={ev => updWallAd(ad.id, { scale: +ev.target.value || 1 })} /></div>
                    <div><label className={lbl}>{t.adLiftOne}</label><input type="number" min={-6} max={8} step={0.25} className={fld} value={ad.lift ?? 0} onChange={ev => updWallAd(ad.id, { lift: +ev.target.value || 0 })} /></div>
                    <div><label className={lbl}>{t.adTitleFa}</label><input className={fld} value={ad.title?.fa || ''} onChange={ev => setWallAdTitle(ad, 'fa', ev.target.value)} placeholder="محل تبلیغات" /></div>
                    <div><label className={lbl}>{t.adTitleEn}</label><input className={fld + ' dir-ltr'} value={ad.title?.en || ''} onChange={ev => setWallAdTitle(ad, 'en', ev.target.value)} placeholder="Advertising space" /></div>
                    <AdMediaUpload id={`ad-${ad.id}`} value={ad.image} onUrl={u => updWallAd(ad.id, { image: u || undefined })} label={t.adImage} />
                    <div className="flex items-end gap-2 lg:col-span-2">
                      <div className="flex-1"><label className={lbl}>{t.adLink}</label><input className={fld + ' dir-ltr'} value={ad.url || ''} onChange={ev => updWallAd(ad.id, { url: ev.target.value || undefined })} placeholder="https://…" /></div>
                      {!readonly && <div className="flex items-center gap-1 pb-2">
                        <button type="button" onClick={() => moveWallAd(ad.id, -1)} disabled={idx === 0} className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white" title={t.moveUp}>↑</button>
                        <button type="button" onClick={() => moveWallAd(ad.id, 1)} disabled={idx === ads.length - 1} className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white" title={t.moveDown}>↓</button>
                      </div>}
                      {!readonly && <button onClick={() => delWallAd(ad.id)} className="text-red-400 hover:text-red-600 pb-2" title={t.clear}><IconTrash className="w-4 h-4" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* End-wall PDF presentation */}
          <div className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <h5 className="font-bold text-gray-700 text-sm">📊 {t.presT}</h5>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700"><input type="checkbox" className="w-4 h-4 accent-indigo-600" disabled={readonly} checked={!!e.presentation?.enabled} onChange={ev => setPres({ enabled: ev.target.checked })} />{t.presEnable}</label>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">{t.presHint}</p>
            {e.presentation?.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                <div className="lg:col-span-2">
                  <label className={lbl}>{t.presPdf}</label>
                  <div className="flex items-center gap-2">
                    {e.presentation?.pdfUrl && <span className="text-[11px] text-emerald-600 font-bold">{t.presUploaded}</span>}
                    {!readonly && <button type="button" onClick={() => pdfInputRef.current?.click()} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"><IconUpload className="w-3.5 h-3.5" />{uploading === 'pres-pdf' ? t.uploading : t.upload}</button>}
                    {e.presentation?.pdfUrl && !readonly && <button type="button" onClick={() => setPres({ pdfUrl: undefined })} className="text-xs text-red-400 hover:text-red-600">{t.clear}</button>}
                    <input type="file" ref={pdfInputRef} className="hidden" accept="application/pdf,.pdf" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadPdf('pres-pdf', f, u => setPres({ pdfUrl: u })); ev.target.value = ''; }} />
                  </div>
                </div>
                <div><label className={lbl}>{t.adWall}</label>
                  <select className={fld + ' bg-white'} value={e.presentation?.wall || 'back'} onChange={ev => setPres({ wall: ev.target.value as ExpoWall })}>
                    <option value="back">{t.wallBack}</option><option value="left">{t.wallLeft}</option><option value="right">{t.wallRight}</option><option value="front">{t.wallFront}</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lbl}>{t.adW}</label><input type="number" step="0.5" className={fld} value={e.presentation?.w ?? 7} onChange={ev => setPres({ w: +ev.target.value })} /></div>
                  <div><label className={lbl}>{t.adH}</label><input type="number" step="0.5" className={fld} value={e.presentation?.h ?? 4} onChange={ev => setPres({ h: +ev.target.value })} /></div>
                </div>
              </div>
            )}
          </div>

          {/* Live presence / Google Meet wall */}
          <div className="border border-emerald-100 bg-emerald-50/35 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
              <h5 className="font-bold text-emerald-800 text-sm">💬 {t.liveT}</h5>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-700"><input type="checkbox" className="w-4 h-4 accent-emerald-600" disabled={readonly} checked={e.presence?.enabled !== false} onChange={ev => setPresence({ enabled: ev.target.checked })} />{t.presenceEnable}</label>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-700"><input type="checkbox" className="w-4 h-4 accent-emerald-600" disabled={readonly} checked={e.presence?.avatarsEnabled !== false} onChange={ev => setPresence({ avatarsEnabled: ev.target.checked })} />{t.avatarsEnable}</label>
              </div>
            </div>
            <p className="text-[11px] text-emerald-700/75 mb-3">{t.liveHint}</p>
            <div className="rounded-lg bg-white/75 border border-emerald-100 p-3">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-700"><input type="checkbox" className="w-4 h-4 accent-emerald-600" disabled={readonly} checked={!!e.meetWall?.enabled} onChange={ev => setMeet({ enabled: ev.target.checked })} />{t.meetEnable}</label>
              </div>
              {e.meetWall?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                  <div className="lg:col-span-2"><label className={lbl}>{t.meetUrl}</label><input className={fld + ' dir-ltr'} value={e.meetWall?.url || ''} onChange={ev => setMeet({ url: ev.target.value || undefined })} placeholder="https://meet.google.com/xxx-xxxx-xxx" /></div>
                  <div><label className={lbl}>{t.adWall}</label>
                    <select className={fld + ' bg-white'} value={e.meetWall?.wall || 'front'} onChange={ev => setMeet({ wall: ev.target.value as ExpoWall })}>
                      <option value="back">{t.wallBack}</option><option value="left">{t.wallLeft}</option><option value="right">{t.wallRight}</option><option value="front">{t.wallFront}</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>{t.adW}</label><input type="number" step="0.25" className={fld} value={e.meetWall?.w ?? 5.5} onChange={ev => setMeet({ w: +ev.target.value || 5.5 })} /></div>
                    <div><label className={lbl}>{t.adH}</label><input type="number" step="0.25" className={fld} value={e.meetWall?.h ?? 3} onChange={ev => setMeet({ h: +ev.target.value || 3 })} /></div>
                  </div>
                  <div><label className={lbl}>{t.adPos}</label><input type="number" min={0.05} max={0.95} step={0.05} className={fld} value={e.meetWall?.u ?? 0.5} onChange={ev => setMeet({ u: +ev.target.value || 0.5 })} /></div>
                  <div><label className={lbl}>{t.adHeight}</label><input type="number" min={0.1} max={0.9} step={0.05} className={fld} value={e.meetWall?.v ?? 0.55} onChange={ev => setMeet({ v: +ev.target.value || 0.55 })} /></div>
                  <div><label className={lbl}>{t.meetTitleFa}</label><input className={fld} value={e.meetWall?.title?.fa || ''} onChange={ev => setMeetTitle('fa', ev.target.value)} placeholder="تماس تصویری زنده" /></div>
                  <div><label className={lbl}>{t.meetTitleEn}</label><input className={fld + ' dir-ltr'} value={e.meetWall?.title?.en || ''} onChange={ev => setMeetTitle('en', ev.target.value)} placeholder="Live video call" /></div>
                </div>
              )}
            </div>
          </div>

          {/* Quick setup — N booths → auto-arrange */}
          {!readonly && (
            <div className="border border-indigo-100 bg-indigo-50/50 rounded-xl p-4">
              <h5 className="font-bold text-indigo-700 text-sm mb-1">⚡ {t.quickTitle}</h5>
              <p className="text-[12px] text-indigo-600/80 mb-3 max-w-2xl">{t.quickHint}</p>
              <div className="flex items-end gap-2 flex-wrap">
                <div><label className={lbl}>{t.quickLayout}</label>
                  <select className={fld + ' bg-white min-w-52'} value={normalizeBoothLayout(quickLayout)} onChange={ev => setQuickLayout(ev.target.value as ExpoBoothLayout)}>
                    {EXPO_LAYOUT_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{T ? opt.labelFa : opt.labelEn}</option>
                    ))}
                  </select>
                </div>
                {(e.booths || []).length > 0 && <button type="button" onClick={() => applyLayoutToBooths()} className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold">{t.applyLayout}</button>}
                <div className="w-px h-9 bg-indigo-200 mx-1 hidden sm:block" />
                <div><label className={lbl}>{t.quickCount}</label><input type="number" min={1} className={fld + ' w-28'} value={quickN} onChange={ev => setQuickN(Math.max(1, Math.floor(+ev.target.value || 1)))} /></div>
                <div><label className={lbl}>{t.boothTier}</label>
                  <select className={fld + ' bg-white min-w-32'} value={quickTier} onChange={ev => setQuickTier(ev.target.value as BoothTier)}>
                    <option value="basic">{t.tierBasic}</option>
                    <option value="standard">{t.tierStandard}</option>
                    <option value="premium">{t.tierPremium}</option>
                  </select>
                </div>
                {(e.booths || []).length > 0 && <button type="button" onClick={() => setTierAndApply(quickTier)} className="text-sm px-3 py-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-white font-bold">{t.applyTierAll}</button>}
                <button onClick={quickBuild} className="text-sm px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-bold flex items-center gap-1"><IconPlus className="w-4 h-4" />{t.quickBuild}</button>
              </div>
            </div>
          )}

          {/* Booths */}
          <div className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-bold text-gray-700 text-sm">{t.booths} <span className="text-xs text-gray-400">({(e.booths || []).length})</span></h5>
              {!readonly && <button onClick={addBooth} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addBooth}</button>}
            </div>
            {(e.booths || []).length === 0 ? <p className="text-sm text-gray-400 text-center py-4">{t.noBooths}</p> : (
              <div className="space-y-2">
                {(e.booths || []).map(b => {
                  const open = openBooth === b.id;
                  return (
                    <div key={b.id} className="rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2 p-2.5">
                        <span className="w-4 h-4 rounded shrink-0" style={{ background: b.color || '#2d4a1a' }} />
                        <span className="text-sm font-medium text-gray-700 flex-1 truncate">{(T ? b.name?.fa : b.name?.en) || b.name?.fa || b.name?.en || '—'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{b.tier === 'premium' ? t.tierPremium : b.tier === 'standard' ? t.tierStandard : t.tierBasic}</span>
                        {b.shopSlug && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{b.shopSlug}</span>}
                        <span className="text-[10px] text-gray-400">{(b.hotspots || []).length} ⭐</span>
                        <button onClick={() => setOpenBooth(open ? null : b.id)} className="text-xs px-2 py-1 rounded-lg text-indigo-500 hover:bg-indigo-50 flex items-center gap-1"><IconEdit className="w-3.5 h-3.5" />{t.edit}</button>
                        {!readonly && <button onClick={() => delBooth(b.id)} className="text-xs px-2 py-1 rounded-lg text-red-400 hover:bg-red-50"><IconTrash className="w-3.5 h-3.5" /></button>}
                      </div>

                      {open && (
                        <div className="border-t border-gray-100 p-3 space-y-3 bg-gray-50/50">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div><label className={lbl}>{t.boothFa}</label><input className={fld} value={b.name?.fa || ''} onChange={ev => updBooth(b.id, { name: { ...(b.name || {}), fa: ev.target.value } })} /></div>
                            <div><label className={lbl}>{t.boothEn}</label><input className={fld + ' dir-ltr'} value={b.name?.en || ''} onChange={ev => updBooth(b.id, { name: { ...(b.name || {}), en: ev.target.value } })} /></div>
                            <div><label className={lbl}>{t.shop}</label>
                              <div className="flex gap-1.5">
                                <select className={fld + ' bg-white'} value={b.shopSlug || ''} onChange={ev => applyShopToBooth(b, ev.target.value)}>
                                  <option value="">{t.noShop}</option>
                                  {shops.map(s => <option key={s.id} value={s.slug}>{s.name}</option>)}
                                </select>
                                {b.shopSlug && !readonly && <button type="button" title={t.applyShop} onClick={() => applyShopToBooth(b, b.shopSlug!)} className="shrink-0 text-xs px-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50">↻</button>}
                              </div>
                            </div>
                            <div><label className={lbl}>{t.boothTier}</label>
                              <select className={fld + ' bg-white'} value={b.tier || 'basic'} onChange={ev => updBooth(b.id, { tier: ev.target.value as BoothTier })}>
                                <option value="basic">{t.tierBasic}</option>
                                <option value="standard">{t.tierStandard}</option>
                                <option value="premium">{t.tierPremium}</option>
                              </select>
                            </div>

                            {(b.tier || 'basic') === 'premium' && <>
                              <div><label className={lbl}>{t.premiumSignFa}</label><input className={fld} value={b.premiumSignText?.fa || ''} onChange={ev => setBoothPremiumSign(b, 'fa', ev.target.value)} placeholder={b.name?.fa || ''} /></div>
                              <div><label className={lbl}>{t.premiumSignEn}</label><input className={fld + ' dir-ltr'} value={b.premiumSignText?.en || ''} onChange={ev => setBoothPremiumSign(b, 'en', ev.target.value)} placeholder={b.name?.en || ''} /></div>
                              <div><label className={lbl}>{t.premiumSignColor}</label><div className="flex gap-2"><input type="color" value={b.premiumSignColor || b.color || '#0f766e'} onChange={ev => updBooth(b.id, { premiumSignColor: ev.target.value })} className="w-10 h-9 rounded border border-gray-300" /><input className={fld + ' dir-ltr'} value={b.premiumSignColor || ''} onChange={ev => updBooth(b.id, { premiumSignColor: ev.target.value || undefined })} placeholder={b.color || '#0f766e'} /></div></div>
                            </>}
                            <div><label className={lbl}>{t.retailCategory}</label>
                              <select className={fld + ' bg-white'} value={b.categoryId || ''} onChange={ev => updBooth(b.id, { categoryId: ev.target.value || undefined })}>
                                <option value="">—</option>
                                {(e.retailCategories || []).map(c => <option key={c.id} value={c.id}>{(T ? c.title?.fa : c.title?.en) || c.title?.fa || c.title?.en || c.id}</option>)}
                              </select>
                            </div>
                            <div><label className={lbl}>{t.storefrontSignFa}</label><input className={fld} value={b.storefrontSignText?.fa || ''} onChange={ev => setBoothStorefrontSign(b, 'fa', ev.target.value)} placeholder={b.name?.fa || ''} /></div>
                            <div><label className={lbl}>{t.storefrontSignEn}</label><input className={fld + ' dir-ltr'} value={b.storefrontSignText?.en || ''} onChange={ev => setBoothStorefrontSign(b, 'en', ev.target.value)} placeholder={b.name?.en || ''} /></div>
                            <div><label className={lbl}>{t.storefrontGlassFa}</label><input className={fld} value={b.storefrontGlassText?.fa || ''} onChange={ev => setBoothGlassText(b, 'fa', ev.target.value)} placeholder="خدمات، محصولات ویژه، مشاوره" /></div>
                            <div><label className={lbl}>{t.storefrontGlassEn}</label><input className={fld + ' dir-ltr'} value={b.storefrontGlassText?.en || ''} onChange={ev => setBoothGlassText(b, 'en', ev.target.value)} placeholder="Services, offers, consultation" /></div>
                            <div><label className={lbl}>{t.color}</label><div className="flex gap-2"><input type="color" value={b.color || '#2d4a1a'} onChange={ev => updBooth(b.id, { color: ev.target.value })} className="w-10 h-9 rounded border border-gray-300" /><input className={fld + ' dir-ltr'} value={b.color || ''} onChange={ev => updBooth(b.id, { color: ev.target.value })} /></div></div>
                            <div className="grid grid-cols-2 gap-2">
                              <div><label className={lbl}>{t.scale}</label><input type="number" step="0.1" className={fld} value={b.scale ?? 1} onChange={ev => updBooth(b.id, { scale: +ev.target.value })} /></div>
                              <div><label className={lbl}>{t.rot}</label><input type="number" className={fld} value={Math.round(((b.ry || 0) * 180 / Math.PI))} onChange={ev => updBooth(b.id, { ry: (+ev.target.value) * Math.PI / 180 })} /></div>
                            </div>
                            <div>
                              <label className={lbl}>{t.entranceFacing}</label>
                              <select
                                className={fld + ' bg-white'}
                                value={b.entranceFacing || ''}
                                onChange={ev => updBooth(b.id, { entranceFacing: (ev.target.value || undefined) as BoothEntranceFacing | undefined })}
                              >
                                <option value="">{T ? '— پیش‌فرض چیدمان —' : '— layout default —'}</option>
                                <option value="front">{t.entranceFacingFront}</option>
                                <option value="left">{t.entranceFacingLeft}</option>
                                <option value="right">{t.entranceFacingRight}</option>
                                <option value="back">{t.entranceFacingBack}</option>
                              </select>
                              <p className="text-[10px] text-gray-500 mt-1">{t.entranceFacingHint}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div><label className={lbl}>{t.posX}</label><input type="number" step="0.5" className={fld} value={b.x ?? 0} onChange={ev => updBooth(b.id, { x: +ev.target.value })} /></div>
                              <div><label className={lbl}>{t.posZ}</label><input type="number" step="0.5" className={fld} value={b.z ?? 0} onChange={ev => updBooth(b.id, { z: +ev.target.value })} /></div>
                            </div>
                            <ImgUpload id={`logo-${b.id}`} value={b.logo} onUrl={u => updBooth(b.id, { logo: u || undefined })} label={t.logo} />
                            {MANAGER_SLOTS.map(i => (
                              <GlbUpload key={`counter-glb-${b.id}-${i}`} id={`counter-glb-${i + 1}-${b.id}`} value={b.counterGlbs?.[i]} onUrl={u => setBoothCounterGlb(b, i, u)} label={t.counterGlb(i + 1)} />
                            ))}
                            {MANAGER_SLOTS.map(i => (
                              <React.Fragment key={`manager-slot-${b.id}-${i}`}>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-700 self-end pb-2">
                                  <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={b.managerEnabled?.[i] !== false} onChange={ev => setBoothManagerEnabled(b, i, ev.target.checked)} />
                                  {t.managerActive(i + 1)}
                                </label>
                                <ImgUpload id={`manager-${i + 1}-${b.id}`} value={b.managerPngs?.[i]} onUrl={u => setBoothManagerPng(b, i, u)} label={t.managerPng(i + 1)} />
                                <div><label className={lbl}>{t.managerNameFa(i + 1)}</label><input className={fld} value={b.managerNames?.[i]?.fa || ''} onChange={ev => setBoothManagerName(b, i, 'fa', ev.target.value)} /></div>
                                <div><label className={lbl}>{t.managerNameEn(i + 1)}</label><input className={fld + ' dir-ltr'} value={b.managerNames?.[i]?.en || ''} onChange={ev => setBoothManagerName(b, i, 'en', ev.target.value)} /></div>
                                <div><label className={lbl}>{t.managerLink(i + 1)}</label><input className={fld + ' dir-ltr'} value={b.managerLinks?.[i] || (b as any).managerWhatsapps?.[i] || ''} onChange={ev => setBoothManagerLink(b, i, ev.target.value)} placeholder="https://meet.google.com/… / https://wa.me/…" /></div>
                                <AudioUpload id={`manager-audio-fa-${i + 1}-${b.id}`} value={b.managerAudiosFa?.[i] || b.managerAudios?.[i]} onUrl={u => setBoothManagerAudio(b, i, 'fa', u)} label={t.managerAudioFa(i + 1)} />
                                <AudioUpload id={`manager-audio-en-${i + 1}-${b.id}`} value={b.managerAudiosEn?.[i]} onUrl={u => setBoothManagerAudio(b, i, 'en', u)} label={t.managerAudioEn(i + 1)} />
                              </React.Fragment>
                            ))}
                            <GlbUpload id={`glb-${b.id}`} value={b.modelUrl} onUrl={u => updBooth(b.id, { modelUrl: u || undefined, ...(u ? {} : { modelScale: undefined, modelRy: undefined }) })} label={t.glb} />
                            {b.modelUrl && (
                              <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-violet-100 bg-violet-50/40 p-2.5 grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div><label className={lbl}>{t.glbScale}</label><input type="number" min={0.05} max={10} step={0.05} className={fld} value={b.modelScale ?? 1} onChange={ev => updBooth(b.id, { modelScale: +ev.target.value || 1 })} /></div>
                                <div><label className={lbl}>{t.glbRot}</label><input type="number" min={-360} max={360} step={1} className={fld} value={Math.round((b.modelRy || 0) * 180 / Math.PI)} onChange={ev => updBooth(b.id, { modelRy: (+ev.target.value) * Math.PI / 180 })} /></div>
                                <p className="md:col-span-2 text-[10px] text-violet-700/80">{t.glbAdjustHint}</p>
                              </div>
                            )}
                          </div>

                          {/* Six wall panels (3 inner + 3 outer) — image or video per surface */}
                          <div className="border-t border-gray-100 pt-2">
                            <span className="text-xs font-bold text-gray-600">🖼 {t.panels}</span>
                            <p className="text-[11px] text-gray-400 mb-2 mt-0.5">{t.panelsHint}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {PANEL_FACES.map(pf => (
                                <PanelField key={pf.face} id={`panel-${b.id}-${pf.face}`} label={T ? pf.fa : pf.en}
                                  value={panelVal(b, pf.face)} onUrl={u => setPanel(b, pf.face, u)}
                                  product={pf.face === 'innerBack' ? firstProductVideo(b.shopSlug) : undefined} />
                              ))}
                            </div>
                          </div>

                          {/* Hotspots */}
                          <div className="border-t border-gray-100 pt-2">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-gray-600">{t.hotspots} <span className="text-gray-400">({(b.hotspots || []).length})</span></span>
                              {!readonly && <button onClick={() => addHotspot(b)} className="text-[11px] px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1"><IconPlus className="w-3 h-3" />{t.addHotspot}</button>}
                            </div>
                            {(b.hotspots || []).length === 0 ? <p className="text-[11px] text-gray-400">{t.noHot}</p> : (
                              <div className="space-y-2">
                                {(b.hotspots || []).map(h => (
                                  <div key={h.id} className="rounded-lg border border-gray-200 bg-white p-2.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                    <div><label className={lbl}>{t.hType}</label><select className={fld + ' bg-white'} value={h.type} onChange={ev => updHotspot(b, h.id, { type: ev.target.value as HotspotType })}>{HOTSPOT_TYPES.map(ht => <option key={ht} value={ht}>{t.typeLabels[ht]}</option>)}</select></div>
                                    <div><label className={lbl}>{t.hTitleFa}</label><input className={fld} value={h.title?.fa || ''} onChange={ev => setHotBi(b, h.id, 'title', 'fa', ev.target.value)} /></div>
                                    <div><label className={lbl}>{t.hTitleEn}</label><input className={fld + ' dir-ltr'} value={h.title?.en || ''} onChange={ev => setHotBi(b, h.id, 'title', 'en', ev.target.value)} /></div>
                                    <div className="flex items-end justify-end gap-2">
                                      {!readonly && <button onClick={() => delHotspot(b, h.id)} className="text-xs px-2 py-1.5 rounded-lg text-red-400 hover:bg-red-50"><IconTrash className="w-3.5 h-3.5" /></button>}
                                    </div>
                                    {['video', 'pdf', 'image', 'url'].includes(h.type) && <div className="md:col-span-2 lg:col-span-2"><label className={lbl}>{t.hUrl}</label><input className={fld + ' dir-ltr'} value={h.url || ''} onChange={ev => updHotspot(b, h.id, { url: ev.target.value })} /></div>}
                                    {['company', 'order', 'page', 'product'].includes(h.type) && <div><label className={lbl}>{t.shop}</label><select className={fld + ' bg-white'} value={h.shopSlug || ''} onChange={ev => updHotspot(b, h.id, { shopSlug: ev.target.value || undefined })}><option value="">{t.noShop}</option>{shops.map(s => <option key={s.id} value={s.slug}>{s.name}</option>)}</select></div>}
                                    {h.type === 'product' && <div><label className={lbl}>{t.hProduct}</label><select className={fld + ' bg-white'} value={h.productRef || ''} onChange={ev => updHotspot(b, h.id, { productRef: ev.target.value || undefined })}><option value="">—</option>{shopProducts(h.shopSlug).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
                                    {h.type === 'whatsapp' && <div><label className={lbl}>{t.hWa}</label><input className={fld + ' dir-ltr'} value={h.whatsapp || ''} onChange={ev => updHotspot(b, h.id, { whatsapp: ev.target.value })} placeholder="+98…" /></div>}
                                    {h.type === 'contact' && <>
                                      <div><label className={lbl}>{t.hPhone}</label><input className={fld + ' dir-ltr'} value={h.phone || ''} onChange={ev => updHotspot(b, h.id, { phone: ev.target.value })} /></div>
                                      <div><label className={lbl}>{t.hEmail}</label><input className={fld + ' dir-ltr'} value={h.email || ''} onChange={ev => updHotspot(b, h.id, { email: ev.target.value })} /></div>
                                    </>}
                                    {['info', 'contact', 'company', 'whatsapp'].includes(h.type) && <div className="md:col-span-2"><label className={lbl}>{t.hBodyFa}</label><input className={fld} value={h.body?.fa || ''} onChange={ev => setHotBi(b, h.id, 'body', 'fa', ev.target.value)} /></div>}
                                    <div className="md:col-span-2 lg:col-span-4 grid grid-cols-3 gap-2">
                                      <div><label className={lbl}>{t.hPos} X</label><input type="number" step="0.25" className={fld} value={h.x ?? 0} onChange={ev => updHotspot(b, h.id, { x: +ev.target.value })} /></div>
                                      <div><label className={lbl}>Y</label><input type="number" step="0.25" className={fld} value={h.y ?? 1.6} onChange={ev => updHotspot(b, h.id, { y: +ev.target.value })} /></div>
                                      <div><label className={lbl}>Z</label><input type="number" step="0.25" className={fld} value={h.z ?? 2} onChange={ev => updHotspot(b, h.id, { z: +ev.target.value })} /></div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
