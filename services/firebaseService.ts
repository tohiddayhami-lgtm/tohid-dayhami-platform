
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, setDoc, query, orderBy, onSnapshot, deleteDoc, where, limit, writeBatch, getDoc } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { Ticket, Customer, AppConfig, ServiceOption, Personnel, AttachedFile, PersonnelDocument, InternalMessage, Task, Meeting, MeetingBookingGuest, SystemLog, KPI, CustomForm, SalesRecord, PerformanceReport, StrategicObjective, Expense, NewsArticle, AnalyticsEvent, NotificationLog, CustomerAccount, CompanyProcess, Invoice, InvoiceSectionPreset, MetaShop, MetaShopOrder, MetaBazaar, MetaShopEvent, MetaExpoEvent, MetaExpoPresence, MetaExpoRegistration, MetaExpoBoothReservation, TeamBrainstormPost } from '../types';
import { summarizeInvoiceChanges } from '../utils/invoiceAudit';
import { MAX_BOOTH_PENDING_RESERVATIONS } from '../utils/boothReservationUtils';

export const firebaseConfig = {
  apiKey: "AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc",
  authDomain: "company-crm-103aa.firebaseapp.com",
  projectId: "company-crm-103aa",
  storageBucket: "company-crm-103aa.firebasestorage.app",
  messagingSenderId: "299697909758",
  appId: "1:299697909758:web:f364faba178ed5e3b01aaf",
  measurementId: "G-N426FMEKMR"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Centralized media bucket lives in calculator-55611 (separate from Firestore project).
// Storage SDK must use that project's Firebase app — cross-bucket access from company-crm-103aa
// triggers storage/unauthorized even when rules allow public writes.
const centralStorageConfig = {
  apiKey: "AIzaSyBF11zbII9hRPHPaQBpQcnvCvxVdbgJv7c",
  authDomain: "calculator-55611.firebaseapp.com",
  projectId: "calculator-55611",
  storageBucket: "calculator-55611.firebasestorage.app",
  messagingSenderId: "62112615270",
  appId: "1:62112615270:web:0ade99d9cdf585eae3d6a7",
};
const storageApp = initializeApp(centralStorageConfig, "centralStorage");

// ── Iran Proxy ─────────────────────────────────────────────────────────────
// Firebase (Google) is blocked in Iran. On first use we test connectivity;
// if blocked we route public read/write through /api/fb (Vercel serverless).

const _PROXY_LS_KEY = '_iran_proxy_v2';
const _PROXY_TTL_MS = 3 * 60 * 1000; // 3 minutes — re-check often so phone/laptop stay in sync

let _proxyMode: boolean | null = (() => {
  try {
    const raw = localStorage.getItem(_PROXY_LS_KEY);
    if (raw) {
      const { v, ts } = JSON.parse(raw);
      if (Date.now() - ts < _PROXY_TTL_MS) return v === '1';
    }
  } catch {}
  return null;
})();
let _proxyWaiters: Array<(v: boolean) => void> = [];
let _proxyChecking = false;

const checkProxyMode = (): Promise<boolean> => {
  if (_proxyMode !== null) return Promise.resolve(_proxyMode);
  if (_proxyChecking) return new Promise(r => _proxyWaiters.push(r));
  _proxyChecking = true;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1000); // reduced from 1500ms

  return fetch(
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/settings/appConfig?key=${firebaseConfig.apiKey}`,
    { signal: controller.signal }
  )
    .then(() => { clearTimeout(timer); _proxyMode = false; })
    .catch(() => { _proxyMode = true; })
    .then(() => {
      try { localStorage.setItem(_PROXY_LS_KEY, JSON.stringify({ v: _proxyMode ? '1' : '0', ts: Date.now() })); } catch {}
      _proxyWaiters.forEach(r => r(_proxyMode!));
      _proxyWaiters = [];
      return _proxyMode!;
    });
};

const _fb = '/api/fb';

// Parse a single Firestore REST value to plain JS
function _fsVal(v: Record<string, unknown>): unknown {
  if ('stringValue'    in v) return v.stringValue;
  if ('integerValue'   in v) return Number(v.integerValue);
  if ('doubleValue'    in v) return v.doubleValue;
  if ('booleanValue'   in v) return v.booleanValue;
  if ('nullValue'      in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue'     in v) return ((v.arrayValue as { values?: Record<string, unknown>[] }).values || []).map(_fsVal);
  if ('mapValue'       in v) return _fsFields((v.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields || {});
  return null;
}
function _fsFields(fields: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, fv] of Object.entries(fields)) o[k] = _fsVal(fv);
  return o;
}

const proxyGet = async <T>(col: string, opts: { doc?: string; orderField?: string; dir?: 'asc' | 'desc' } = {}): Promise<T> => {
  const p = new URLSearchParams({ col });
  if (opts.doc) p.set('doc', opts.doc);
  if (opts.orderField) p.set('orderField', opts.orderField);
  if (opts.dir) p.set('dir', opts.dir);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000); // 12s timeout — prevents infinite hang
  try {
    const r = await fetch(`${_fb}?${p}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`Proxy ${r.status}`);
    return r.json() as Promise<T>;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
};

const proxyWrite = async (col: string, docId: string, data: unknown): Promise<void> => {
  const r = await fetch(`${_fb}?col=${encodeURIComponent(col)}&doc=${encodeURIComponent(docId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(`Proxy write ${r.status}`);
};

const proxyPoll = <T>(
  col: string,
  callback: (data: T[]) => void,
  opts: { orderField?: string; dir?: 'asc' | 'desc'; intervalMs?: number } = {}
): (() => void) => {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;

  const run = async () => {
    if (stopped) return;
    try {
      const data = await proxyGet<T[]>(col, { orderField: opts.orderField, dir: opts.dir });
      if (!stopped && Array.isArray(data)) callback(data);
    } catch {}
    if (!stopped) timer = setTimeout(run, opts.intervalMs ?? 10_000);
  };

  run();
  return () => { stopped = true; clearTimeout(timer); };
};

const forceProxyMode = () => {
  _proxyMode = true;
  try { localStorage.setItem(_PROXY_LS_KEY, JSON.stringify({ v: '1', ts: Date.now() })); } catch {}
};

/** Unified collection listener — direct Firestore or /api/fb polling when Google is blocked in Iran. */
function subscribeCollection<T>(
  col: string,
  callback: (items: T[]) => void,
  opts?: {
    sort?: (a: T, b: T) => number;
    orderField?: string;
    dir?: 'asc' | 'desc';
    intervalMs?: number;
    mergeDocId?: boolean;
  },
): () => void {
  let inner: (() => void) | null = null;
  let gone = false;

  const deliver = (items: T[]) => {
    const list = Array.isArray(items) ? [...items] : [];
    if (opts?.sort) list.sort(opts.sort);
    callback(list);
  };

  const startProxy = () => {
    inner?.();
    inner = proxyPoll<T>(col, deliver, {
      orderField: opts?.orderField,
      dir: opts?.dir,
      intervalMs: opts?.intervalMs ?? 8_000,
    });
  };

  const startDirect = () => {
    inner?.();
    const q = opts?.orderField
      ? query(collection(db, col), orderBy(opts.orderField, opts?.dir === 'asc' ? 'asc' : 'desc'))
      : query(collection(db, col));
    inner = onSnapshot(q, snap => {
      deliver(snap.docs.map(d => {
        const data = d.data() as T;
        if (opts?.mergeDocId) {
          const withId = data as T & { id?: string };
          return { ...data, id: withId.id || d.id } as T;
        }
        return data;
      }));
    }, () => {
      if (gone) return;
      forceProxyMode();
      startProxy();
    });
  };

  checkProxyMode().then(proxy => {
    if (gone) return;
    if (proxy) startProxy();
    else startDirect();
  });

  return () => { gone = true; inner?.(); };
};

async function setDocCloud(col: string, id: string, data: unknown) {
  const proxy = await checkProxyMode();
  const payload = sanitizeData(data);
  if (proxy) await proxyWrite(col, id, payload);
  else await setDoc(doc(db, col, id), payload);
}

async function updateDocCloud(col: string, id: string, updates: Record<string, unknown>) {
  const proxy = await checkProxyMode();
  const payload = sanitizeData(updates);
  if (proxy) {
    const existing = (await proxyGet<Record<string, unknown>>(col, { doc: id })) || { id };
    await proxyWrite(col, id, { ...existing, ...payload, id });
  } else {
    await updateDoc(doc(db, col, id), payload);
  }
}

async function deleteDocCloud(col: string, id: string) {
  const proxy = await checkProxyMode();
  if (proxy) {
    const r = await fetch(`${_fb}?col=${encodeURIComponent(col)}&doc=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`Proxy delete ${r.status}`);
  } else {
    await deleteDoc(doc(db, col, id));
  }
}

// ── End Iran Proxy ──────────────────────────────────────────────────────────
const CENTRAL_STORAGE_BUCKET = "calculator-55611.firebasestorage.app";
const CENTRAL_STORAGE_PROJECT_ID = "calculator-55611";
/** Must match storage.rules isDocumentFile() limit. */
export const DOCUMENT_MAX_BYTES = 120 * 1024 * 1024;
const STORAGE_ROOT = "tohid-dayhami-platform";
export type CentralStorageFolder = "uploads" | "images" | "documents" | "temp";
export const storageFolders: Record<CentralStorageFolder, string> = {
    uploads: `${STORAGE_ROOT}/uploads`,
    images: `${STORAGE_ROOT}/images`,
    documents: `${STORAGE_ROOT}/documents`,
    temp: `${STORAGE_ROOT}/temp`,
};
const storage = getStorage(storageApp);
export let analytics: Analytics | null = null;

isSupported()
    .then((supported) => {
        if (supported) {
            analytics = getAnalytics(app);
        }
    })
    .catch((error) => {
        console.warn("Firebase Analytics is not available in this browser.", error);
    });

// --- Strategic Objectives (OKRs) Functions ---

export const saveObjective = async (obj: StrategicObjective) => {
    await setDoc(doc(db, "objectives", obj.id), sanitizeData(obj));
    logSystemAction('CREATE', 'Objective', `هدف استراتژیک جدید: ${obj.title}`, 'مدیریت', obj.id);
};

export const updateObjective = async (id: string, updates: Partial<StrategicObjective>) => {
    await updateDoc(doc(db, "objectives", id), sanitizeData({ ...updates, updatedAt: new Date().toISOString() }));
};

export const deleteObjective = async (id: string) => {
    await deleteDoc(doc(db, "objectives", id));
    logSystemAction('DELETE', 'Objective', `حذف هدف استراتژیک`, 'مدیریت', id);
};

export const subscribeToObjectives = (callback: (objs: StrategicObjective[]) => void) => {
    const q = query(collection(db, "objectives"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(d => d.data() as StrategicObjective);
        callback(list);
    });
};

// --- FX Rates Functions ---

export const saveFxRates = async (rates: { USD_IRR: number; OMR_IRR: number }) => {
    await setDoc(doc(db, "app_settings", "fx_rates"), { ...rates, updatedAt: new Date().toISOString() });
};

export const subscribeToFxRates = (callback: (rates: { USD_IRR: number; OMR_IRR: number }) => void) => {
    return onSnapshot(doc(db, "app_settings", "fx_rates"), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            callback({ USD_IRR: data.USD_IRR, OMR_IRR: data.OMR_IRR });
        }
    });
};

// --- Expenses Functions ---

export const saveExpense = async (expense: Expense, actorName: string) => {
    await setDoc(doc(db, "expenses", expense.id), sanitizeData(expense));
    logSystemAction('CREATE', 'Expense', `هزینه جدید ثبت شد: ${expense.title}`, actorName, expense.id);
};

export const updateExpense = async (id: string, updates: Partial<Expense>, actorName: string) => {
    await updateDoc(doc(db, "expenses", id), sanitizeData(updates));
    logSystemAction('UPDATE', 'Expense', `بروزرسانی هزینه`, actorName, id);
};

export const deleteExpense = async (id: string, actorName: string) => {
    await deleteDoc(doc(db, "expenses", id));
    logSystemAction('DELETE', 'Expense', `حذف هزینه`, actorName, id);
};

export const subscribeToExpenses = (callback: (expenses: Expense[]) => void) => {
    const q = query(collection(db, "expenses"), orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(d => d.data() as Expense);
        callback(list);
    });
};

// --- Helper Functions ---

export const sanitizeData = (data: any): any => {
  const seen = new WeakSet();

  const deepCopy = (obj: any): any => {
    if (obj === undefined || obj === null) return null;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (seen.has(obj)) return null;
    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj.map(deepCopy).filter(item => item !== undefined);
    }

    const proto = Object.getPrototypeOf(obj);
    if (proto && proto.constructor && proto.constructor.name !== 'Object') {
        if (proto !== null) return null;
    }
    
    if (obj._reactName || (obj.nativeEvent && obj.target) || (obj.nodeType && obj.nodeName) || (obj.i && obj.src)) {
        return null;
    }

    const res: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (key.startsWith('_') || key === 'src' || key === 'target' || key === 'view' || key === 'nativeEvent' || key === 'rawFile') continue;
        try {
            const val = deepCopy(obj[key]);
            if (val !== undefined) {
                res[key] = val;
            }
        } catch (e) {
            res[key] = null;
        }
      }
    }
    return res;
  };

  try {
      return deepCopy(data);
  } catch (e) {
      console.error("Sanitization failed", e);
      return null;
  }
};

export const compressImage = (file: File, maxWidth = 800, quality = 0.5): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            return resolve("");
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                } else {
                    resolve(event.target?.result as string);
                }
            };
            img.onerror = () => resolve(""); 
        };
        reader.onerror = () => resolve("");
    });
};

const sanitizeFileName = (fileName: string) => {
    const cleaned = fileName
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
    return cleaned || "file";
};

const assertCentralStoragePath = (path: string) => {
    if (!path.startsWith(`${STORAGE_ROOT}/`)) {
        throw new Error("Storage path must stay inside the centralized project folder.");
    }
    return path;
};

const buildCentralStoragePath = (fileName: string, folder: CentralStorageFolder = "uploads") => {
    const timestamp = Date.now();
    return `${storageFolders[folder]}/${timestamp}-${sanitizeFileName(fileName)}`;
};

const pathFromDownloadUrl = (url: string) => {
    const parsed = new URL(url);
    const marker = "/o/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return url;
    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
};

const normalizeStoragePath = (pathOrUrl: string) => {
    const path = pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")
        ? pathFromDownloadUrl(pathOrUrl)
        : pathOrUrl.replace(/^gs:\/\/[^/]+\//, "");
    return assertCentralStoragePath(path);
};

const getStorageErrorMessage = (error: unknown) => {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
    const storagePath = typeof error === "object" && error && "storagePath" in error ? String((error as { storagePath?: unknown }).storagePath) : "نامشخص";
    const fileSize = typeof error === "object" && error && "fileSize" in error ? Number((error as { fileSize?: unknown }).fileSize) : NaN;
    const message = error instanceof Error ? error.message : "";
    const details = `Bucket: ${CENTRAL_STORAGE_BUCKET} | Path: ${storagePath} | Code: ${code || "unknown"}`;
    const sizeMb = Number.isFinite(fileSize) && fileSize > 0 ? (fileSize / (1024 * 1024)).toFixed(1) : "";
    const maxMb = (DOCUMENT_MAX_BYTES / (1024 * 1024)).toFixed(0);

    if (code === "storage/unauthorized") {
        const overLimit = Number.isFinite(fileSize) && fileSize >= DOCUMENT_MAX_BYTES;
        if (overLimit) {
            return `حجم فایل (${sizeMb} مگابایت) بیش از حد مجاز (${maxMb} مگابایت) است. فایل را فشرده کنید یا مدل را سبک‌تر کنید. ${details}`;
        }
        return `دسترسی آپلود در Firebase Storage رد شد${sizeMb ? ` (حجم فایل: ${sizeMb} مگابایت)` : ""}. اگر حجم زیر ${maxMb} مگابایت است، معمولاً storage.rules روی پروژه ${CENTRAL_STORAGE_PROJECT_ID} Publish نشده — دستور «firebase deploy --only storage» را اجرا کنید و دوباره تلاش کنید. ${details}`;
    }

    if (code === "storage/bucket-not-found") {
        return `Bucket مرکزی پیدا نشد. ${details}`;
    }

    if (code === "storage/canceled") {
        return "آپلود لغو شد.";
    }

    if (code === "storage/retry-limit-exceeded") {
        return "آپلود به دلیل کندی یا قطعی شبکه متوقف شد. دوباره تلاش کنید.";
    }

    return `${message || "آپلود ناموفق. لطفاً اتصال اینترنت و تنظیمات Firebase Storage را بررسی کنید."} ${details}`;
};

export const uploadFile = (
    file: File,
    folder: CentralStorageFolder = "uploads",
    onProgress?: (progress: number) => void,
    contentType?: string
): Promise<{ url: string; path: string }> => {
    const path = buildCentralStoragePath(file.name, folder);
    const storageRef = ref(storage, path);
    const resolvedType = contentType
        || (folder === "images" ? (file.type || "image/png") : undefined)
        || (file.type || undefined);
    const uploadTask = uploadBytesResumable(storageRef, file, resolvedType ? { contentType: resolvedType } : undefined);

    return new Promise((resolve, reject) => {
        uploadTask.on(
            "state_changed",
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                onProgress?.(progress);
            },
            (error) => {
                Object.assign(error, {
                    storageBucket: CENTRAL_STORAGE_BUCKET,
                    storagePath: path,
                    fileSize: file.size,
                });
                reject(error);
            },
            async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve({ url, path });
            }
        );
    });
};

export const getFileUrl = async (pathOrUrl: string) => {
    const path = normalizeStoragePath(pathOrUrl);
    return getDownloadURL(ref(storage, path));
};

export const deleteFile = async (pathOrUrl: string) => {
    const path = normalizeStoragePath(pathOrUrl);
    await deleteObject(ref(storage, path));
};

export const uploadFileWithProgress = async (
    file: File,
    onProgress: (progress: number) => void,
    onSuccess: (url: string) => void,
    onError: (error: Error) => void,
    folder: CentralStorageFolder = "uploads",
    contentType?: string
) => {
    try {
        const { url } = await uploadFile(file, folder, onProgress, contentType);
        onProgress(100);
        onSuccess(url);
    } catch (error) {
        console.error("Storage Error:", error);
        onError(new Error(getStorageErrorMessage(error)));
    }
};

// --- Reports ---

export const saveReport = async (report: PerformanceReport) => {
    const reportId = report.id || `rep-${Date.now()}`;
    await setDoc(doc(db, "reports", reportId), sanitizeData({ ...report, id: reportId }));
    logSystemAction('CREATE', 'Report', `گزارش ${report.type} ثبت شد`, report.userName, reportId);
    return reportId;
};

export const updateReport = async (id: string, updates: Partial<PerformanceReport>, actorName: string) => {
    await updateDoc(doc(db, "reports", id), sanitizeData(updates));
    logSystemAction('UPDATE', 'Report', `گزارش ویرایش شد`, actorName, id);
};

export const subscribeToReports = (callback: (reports: PerformanceReport[]) => void) => {
    const q = query(collection(db, "reports"));
    return onSnapshot(q, (snapshot) => {
        const reports = snapshot.docs.map(d => d.data() as PerformanceReport);
        reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(reports);
    }, (e) => {});
};

// --- Rest of Maintenance/Logging ---

export const backupSystemData = async () => {
    try {
        const collections = ['tickets', 'customers', 'settings', 'messages', 'tasks', 'meetings', 'kpis', 'custom_forms', 'sales_records', 'reports', 'user_goals', 'objectives', 'expenses'];
        const data: any = {};
        for (const col of collections) {
            const snap = await getDocs(collection(db, col));
            data[col] = snap.docs.map(d => d.data());
        }
        const safeData = sanitizeData(data);
        const blob = new Blob([JSON.stringify(safeData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CRM_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return true;
    } catch (e) {
        console.error("Backup failed", e);
        return false;
    }
};

export const clearSystemData = async () => {
    try {
        const ticketsSnap = await getDocs(collection(db, 'tickets'));
        const batch = writeBatch(db);
        ticketsSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        return true;
    } catch (e) {
        console.error("Clear failed", e);
        return false;
    }
};

export const logSystemAction = async (
    actionType: SystemLog['actionType'],
    entity: SystemLog['entity'],
    details: string,
    actorName: string,
    entityId?: string,
    backupData?: any,
    collectionName?: string,
    actorId?: string,
) => {
    try {
        const logEntry: SystemLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            actionType,
            entity,
            details,
            actorName,
            actorId,
            entityId,
            timestamp: new Date().toISOString(),
            backupData,
            collectionName
        };
        await setDoc(doc(db, "system_logs", logEntry.id), sanitizeData(logEntry));
    } catch (e) {
        console.error("Failed to log action", e);
    }
};

export const subscribeToSystemLogs = (callback: (logs: SystemLog[]) => void) => {
    const q = query(collection(db, "system_logs"), orderBy("timestamp", "desc"), limit(100));
    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(d => d.data() as SystemLog);
        callback(logs);
    }, (e) => {});
};

export const fetchAnalyticsData = async () => {
    try {
        const q = query(collection(db, "system_logs"), orderBy("timestamp", "desc"), limit(1000));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as SystemLog);
    } catch (e) {
        console.error("Analytics fetch failed", e);
        return [];
    }
};

export const restoreEntityFromLog = async (log: SystemLog): Promise<boolean> => {
    if (!log.backupData || !log.collectionName || !log.entityId) return false;
    try {
        await setDoc(doc(db, log.collectionName, log.entityId), log.backupData);
        await logSystemAction('UPDATE', log.entity, `بازیابی اطلاعات حذف شده`, log.actorName, log.entityId);
        return true;
    } catch (e) {
        console.error("Restoration failed", e);
        return false;
    }
};

const cleanFilesForDB = (files: AttachedFile[] | undefined) => {
    if (!files) return [];
    return files.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        content: f.content 
    })).filter(f => f.content && !f.content.startsWith('blob:')); 
};

export const saveSalesRecord = async (sale: SalesRecord) => {
    await setDoc(doc(db, "sales_records", sale.id), sanitizeData(sale));
    logSystemAction('CREATE', 'Sale', `فروش جدید ثبت شد: ${sale.serviceTitle}`, sale.salespersonName, sale.id);
};

export const updateSalesRecord = async (id: string, updates: Partial<SalesRecord>, actorName: string) => {
    await updateDoc(doc(db, "sales_records", id), sanitizeData({ ...updates, updatedAt: new Date().toISOString(), updatedBy: actorName }));
    logSystemAction('UPDATE', 'Sale', `رکورد فروش ویرایش شد`, actorName, id);
};

export const deleteSalesRecord = async (id: string, actorName: string) => {
    await deleteDoc(doc(db, "sales_records", id));
    logSystemAction('DELETE', 'Sale', `رکورد فروش حذف شد`, actorName, id);
};

export const subscribeToSalesRecords = (callback: (sales: SalesRecord[]) => void) => {
    const q = query(collection(db, "sales_records"));
    return onSnapshot(q, (snapshot) => {
        const sales = snapshot.docs.map(d => d.data() as SalesRecord);
        // Changed to DESC (newest first) so that the latest records appear at the top
        sales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(sales);
    }, (e) => {});
};

export const saveTicketToCloud = async (ticket: Ticket) => {
  try {
    const safeId = ticket.id || `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const ticketToSave = { ...ticket, id: safeId, files: cleanFilesForDB(ticket.files) };
    await setDocCloud('tickets', safeId, ticketToSave);
    logSystemAction('CREATE', 'Ticket', `تیکت جدید با عنوان ${ticket.serviceId} برای ${ticket.customerName} ایجاد شد`, 'سیستم/مشتری', safeId);
    return safeId;
  } catch (e) {
    console.error("Error adding ticket: ", e);
    throw e;
  }
};

export const updateTicketInCloud = async (id: string, updates: Partial<Ticket>) => {
  try {
    const finalUpdates = { ...updates };
    if (updates.projectData && updates.projectData.projectFiles) {
        finalUpdates.projectData.projectFiles = cleanFilesForDB(updates.projectData.projectFiles);
    }
    if (updates.files) {
        finalUpdates.files = cleanFilesForDB(updates.files);
    }
    await updateDocCloud('tickets', id, finalUpdates as Record<string, unknown>);
  } catch (e) {
    throw e;
  }
};

export const deleteTicketFromCloud = async (id: string) => {
  const proxy = await checkProxyMode();
  let data: unknown = null;
  if (proxy) {
    data = await proxyGet('tickets', { doc: id });
  } else {
    const snap = await getDoc(doc(db, 'tickets', id));
    data = snap.exists() ? snap.data() : null;
  }
  await deleteDocCloud('tickets', id);
  logSystemAction('DELETE', 'Ticket', `تیکت با شناسه ${id} حذف شد`, 'Master', id, data, 'tickets');
};

export const subscribeToTickets = (callback: (tickets: Ticket[]) => void) =>
  subscribeCollection<Ticket>('tickets', callback, {
    sort: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    intervalMs: 8_000,
    mergeDocId: true,
  });

export const saveCustomerToCloud = async (customer: Customer) => {
  await setDocCloud('customers', customer.id, customer);
};

export const updateCustomerInCloud = async (id: string, updates: Partial<Customer>) => {
  await updateDocCloud('customers', id, updates as Record<string, unknown>);
  logSystemAction('UPDATE', 'Customer', `اطلاعات مشتری بروزرسانی شد`, 'کاربر سیستم', id);
};

export const deleteCustomerFromCloud = async (id: string) => {
  const proxy = await checkProxyMode();
  let data: unknown = null;
  if (proxy) {
    data = await proxyGet('customers', { doc: id });
  } else {
    const snap = await getDoc(doc(db, 'customers', id));
    data = snap.exists() ? snap.data() : null;
  }
  await deleteDocCloud('customers', id);
  logSystemAction('DELETE', 'Customer', `مشتری حذف شد`, 'Master', id, data, 'customers');
};

export const saveCustomersBulkToCloud = async (customers: Customer[]) => {
    const batchSize = 400;
    for (let i = 0; i < customers.length; i += batchSize) {
        const chunk = customers.slice(i, i + batchSize);
        await Promise.all(chunk.map(c => setDocCloud('customers', c.id, c)));
    }
    logSystemAction('CREATE', 'Customer', `${customers.length} مشتری به صورت گروهی ایمپورت شدند`, 'سیستم');
};

export const subscribeToCustomers = (callback: (customers: Customer[]) => void) =>
  subscribeCollection<Customer>('customers', callback, { intervalMs: 10_000 });

export const findCustomerByLoyaltyCode = async (code: string): Promise<Customer | null> => {
    if (!code) return null;
    const q = query(collection(db, "customers"), where("loyaltyCode", "==", code), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data() as Customer;
    }
    return null;
};

export const sendInternalMessage = async (message: InternalMessage) => {
  try {
    const msgToSave = { ...message, files: cleanFilesForDB(message.files) };
    await setDocCloud('messages', message.id, msgToSave);
    logSystemAction('CREATE', 'Message', `پیام جدید از ${message.senderName} ارسال شد`, message.senderName, message.id);
  } catch (e) {
    throw e;
  }
};

function normalizeInternalMessage(m: InternalMessage): InternalMessage {
  return {
    ...m,
    id: m.id || '',
    recipientIds: Array.isArray(m.recipientIds) ? m.recipientIds : [],
    recipientNames: Array.isArray(m.recipientNames) ? m.recipientNames : [],
    readBy: Array.isArray(m.readBy) ? m.readBy : [],
    archivedBy: Array.isArray(m.archivedBy) ? m.archivedBy : [],
    hiddenBy: Array.isArray(m.hiddenBy) ? m.hiddenBy : [],
  };
}

async function patchMessageInCloud(
  id: string,
  patch: (msg: InternalMessage) => Partial<InternalMessage>,
): Promise<InternalMessage> {
  const proxy = await checkProxyMode();
  let existing: InternalMessage | null = null;
  if (proxy) {
    existing = await proxyGet<InternalMessage>('messages', { doc: id });
  } else {
    const snap = await getDoc(doc(db, 'messages', id));
    if (snap.exists()) {
      const data = snap.data() as InternalMessage;
      existing = normalizeInternalMessage({ ...data, id: data.id || snap.id });
    }
  }
  if (!existing) throw new Error(`Message ${id} not found`);
  const updates = patch(existing);
  const merged = normalizeInternalMessage({ ...existing, ...updates, id: existing.id || id });
  await setDocCloud('messages', id, merged);
  return merged;
}

export const markMessageAsRead = async (id: string, userId: string): Promise<void> => {
  if (!id || !userId) return;
  await patchMessageInCloud(id, (msg) => {
    const readBy = msg.readBy || [];
    if (readBy.includes(userId)) return {};
    return { readBy: [...readBy, userId] };
  });
};

export const setMessageArchivedForUser = async (id: string, userId: string, archived: boolean): Promise<void> => {
  if (!id || !userId) return;
  await patchMessageInCloud(id, (msg) => {
    const archivedBy = msg.archivedBy || [];
    const next = archived
      ? (archivedBy.includes(userId) ? archivedBy : [...archivedBy, userId])
      : archivedBy.filter(x => x !== userId);
    return { archivedBy: next };
  });
};

export const hideMessageForUser = async (id: string, userId: string): Promise<void> => {
  if (!id || !userId) return;
  await patchMessageInCloud(id, (msg) => {
    const hiddenBy = msg.hiddenBy || [];
    if (hiddenBy.includes(userId)) return {};
    return { hiddenBy: [...hiddenBy, userId] };
  });
};

export const updateMessageInCloud = async (id: string, updates: Partial<InternalMessage>) => {
  await updateDocCloud('messages', id, updates as Record<string, unknown>);
};

export const deleteMessageFromCloud = async (id: string) => {
  const proxy = await checkProxyMode();
  let data: InternalMessage | null = null;
  if (proxy) {
    data = await proxyGet<InternalMessage>('messages', { doc: id });
  } else {
    const ref = doc(db, 'messages', id);
    const snap = await getDoc(ref);
    data = snap.exists() ? (snap.data() as InternalMessage) : null;
  }
  await deleteDocCloud('messages', id);
  logSystemAction('DELETE', 'Message', `پیام حذف شد`, 'Master', id, data, 'messages');
};

export const subscribeToMessages = (callback: (msgs: InternalMessage[]) => void) =>
  subscribeCollection<InternalMessage>('messages', list => {
    callback(list.map(m => normalizeInternalMessage(m)));
  }, {
    sort: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    intervalMs: 6_000,
    mergeDocId: true,
  });

// ── Team brainstorm (sticky-note ideas board) ──
function normalizeTeamBrainstormPost(p: TeamBrainstormPost): TeamBrainstormPost {
  const color = p.color && TB_COLORS.includes(p.color as TBColor) ? p.color : 'yellow';
  return {
    ...p,
    id: p.id || '',
    color,
    likedBy: Array.isArray(p.likedBy) ? p.likedBy : [],
    comments: Array.isArray(p.comments) ? p.comments : [],
    files: Array.isArray(p.files) ? p.files : [],
  };
}

const TB_COLORS = ['yellow', 'pink', 'mint', 'sky', 'lavender', 'peach'] as const;
type TBColor = typeof TB_COLORS[number];

async function patchTeamBrainstormPost(
  id: string,
  patch: (post: TeamBrainstormPost) => Partial<TeamBrainstormPost>,
): Promise<TeamBrainstormPost> {
  const proxy = await checkProxyMode();
  let existing: TeamBrainstormPost | null = null;
  if (proxy) {
    existing = await proxyGet<TeamBrainstormPost>('team_brainstorm', { doc: id });
  } else {
    const snap = await getDoc(doc(db, 'team_brainstorm', id));
    if (snap.exists()) {
      const data = snap.data() as TeamBrainstormPost;
      existing = normalizeTeamBrainstormPost({ ...data, id: data.id || snap.id });
    }
  }
  if (!existing) throw new Error(`Brainstorm post ${id} not found`);
  const updates = patch(existing);
  const payload: Record<string, unknown> = { ...updates };
  if (updates.files) payload.files = cleanFilesForDB(updates.files);
  if (updates.comments) {
    payload.comments = updates.comments.map(c => ({
      ...c,
      files: cleanFilesForDB(c.files),
    }));
  }
  const merged = normalizeTeamBrainstormPost({ ...existing, ...payload, id: existing.id || id });
  await setDocCloud('team_brainstorm', id, merged);
  return merged;
}

export const saveTeamBrainstormPost = async (post: TeamBrainstormPost) => {
  const payload = { ...post, files: cleanFilesForDB(post.files) };
  await setDocCloud('team_brainstorm', post.id, payload);
};

export const updateTeamBrainstormPostInCloud = async (id: string, updates: Partial<TeamBrainstormPost>) => {
  await patchTeamBrainstormPost(id, (existing) => ({ ...existing, ...updates }));
};

export const deleteTeamBrainstormPostFromCloud = async (id: string) => {
  await deleteDocCloud('team_brainstorm', id);
};

export const subscribeToTeamBrainstorm = (callback: (posts: TeamBrainstormPost[]) => void) =>
  subscribeCollection<TeamBrainstormPost>('team_brainstorm', list => {
    callback(list.map(p => normalizeTeamBrainstormPost(p)));
  }, {
    sort: (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime(),
    intervalMs: 8_000,
    mergeDocId: true,
  });

// ── Standalone Invoices (Invoices archive) ──
export const saveInvoiceToCloud = async (invoice: Invoice, actor?: Personnel) => {
    const proxy = await checkProxyMode();
    let prev: Invoice | null = null;
    if (proxy) {
        prev = await proxyGet<Invoice>('invoices', { doc: invoice.id });
    } else {
        const snap = await getDoc(doc(db, 'invoices', invoice.id));
        prev = snap.exists() ? (snap.data() as Invoice) : null;
    }
    await setDocCloud('invoices', invoice.id, invoice);
    const details = summarizeInvoiceChanges(prev, invoice);
    const actorName = actor?.fullName || invoice.issuedBy || 'System';
    const actorId = actor?.id;
    await logSystemAction(
        prev ? 'UPDATE' : 'CREATE',
        'Invoice',
        details,
        actorName,
        invoice.id,
        undefined,
        undefined,
        actorId,
    );
};

export const deleteInvoiceFromCloud = async (id: string, actor?: Personnel) => {
    const proxy = await checkProxyMode();
    let data: unknown = null;
    if (proxy) {
        data = await proxyGet('invoices', { doc: id });
    } else {
        const snap = await getDoc(doc(db, 'invoices', id));
        data = snap.exists() ? snap.data() : null;
    }
    await deleteDocCloud('invoices', id);
    const inv = data as Invoice | null;
    await logSystemAction(
        'DELETE',
        'Invoice',
        inv ? `Deleted invoice ${inv.number} (${inv.customerName || '—'})` : `Deleted invoice ${id}`,
        actor?.fullName || 'System',
        id,
        data,
        'invoices',
        actor?.id,
    );
};

export const subscribeToInvoices = (callback: (invoices: Invoice[]) => void) =>
  subscribeCollection<Invoice>('invoices', callback, {
    sort: (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime(),
    intervalMs: 10_000,
  });

// ── Invoice section presets (named saves per section) ──
export const saveInvoiceSectionPresetToCloud = async (preset: InvoiceSectionPreset) => {
    await setDocCloud('invoice_presets', preset.id, preset);
    logSystemAction('CREATE', 'InvoicePreset', `Preset "${preset.name}" (${preset.section}) saved`, preset.createdBy, preset.id);
};

export const deleteInvoiceSectionPresetFromCloud = async (id: string) => {
    const proxy = await checkProxyMode();
    let data: unknown = null;
    if (proxy) {
        data = await proxyGet('invoice_presets', { doc: id });
    } else {
        const snap = await getDoc(doc(db, 'invoice_presets', id));
        data = snap.exists() ? snap.data() : null;
    }
    await deleteDocCloud('invoice_presets', id);
    logSystemAction('DELETE', 'InvoicePreset', `Invoice preset deleted`, 'Master', id, data, 'invoice_presets');
};

export const subscribeToInvoiceSectionPresets = (callback: (presets: InvoiceSectionPreset[]) => void) =>
  subscribeCollection<InvoiceSectionPreset>('invoice_presets', callback, {
    sort: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    intervalMs: 15_000,
  });

// ── Meta Shops (online catalogs/shops) ──
export const saveMetaShopToCloud = async (shop: MetaShop) => {
    await setDocCloud('metaShops', shop.id, shop);
    logSystemAction('UPDATE', 'MetaShop', `فروشگاه ${shop.name} ذخیره شد`, 'Master', shop.id);
};
export const deleteMetaShopFromCloud = async (id: string) => {
    const proxy = await checkProxyMode();
    let data: unknown = null;
    if (proxy) {
        data = await proxyGet('metaShops', { doc: id });
    } else {
        const snap = await getDoc(doc(db, 'metaShops', id));
        data = snap.exists() ? snap.data() : null;
    }
    await deleteDocCloud('metaShops', id);
    logSystemAction('DELETE', 'MetaShop', `فروشگاه حذف شد`, 'Master', id, data, 'metaShops');
};
export const subscribeToMetaShops = (callback: (shops: MetaShop[]) => void) =>
  subscribeCollection<MetaShop>('metaShops', callback, {
    sort: (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    intervalMs: 8_000,
  });
// Fetch a single shop directly (public view, before the subscription warms up)
export const getMetaShopBySlug = async (slug: string): Promise<MetaShop | null> => {
    try {
        const proxy = await checkProxyMode();
        if (proxy) {
            const all = await proxyGet<MetaShop[]>('metaShops');
            return (all || []).find(s => s.slug === slug) || null;
        }
        const q = query(collection(db, "metaShops"), where("slug", "==", slug), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return snap.docs[0].data() as MetaShop;
    } catch { return null; }
};

// ── Meta Shop Orders ──
export const saveMetaShopOrderToCloud = async (order: MetaShopOrder) => {
    await setDocCloud('metaShopOrders', order.id, order);
    logSystemAction('CREATE', 'MetaShopOrder', `سفارش جدید از ${order.customerName} (${order.shopName})`, order.customerName, order.id);
};
export const updateMetaShopOrderInCloud = async (id: string, updates: Partial<MetaShopOrder>) => {
    await updateDocCloud('metaShopOrders', id, updates as Record<string, unknown>);
};
export const subscribeToMetaShopOrders = (callback: (orders: MetaShopOrder[]) => void) =>
  subscribeCollection<MetaShopOrder>('metaShopOrders', callback, {
    sort: (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    intervalMs: 8_000,
  });
// Customer order lookup by phone (public, no auth)
export const lookupMetaShopOrders = async (phone: string): Promise<MetaShopOrder[]> => {
    try {
        const q = query(collection(db, "metaShopOrders"), where("phone", "==", phone));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as MetaShopOrder).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch { return []; }
};
// Customer order lookup by tracking code (public, no auth)
export const lookupMetaShopOrdersByTracking = async (trackingCode: string): Promise<MetaShopOrder[]> => {
    try {
        const q = query(collection(db, "metaShopOrders"), where("trackingCode", "==", trackingCode));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as MetaShopOrder).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch { return []; }
};

// ── Meta Bazaars (curated multi-level shop directories) ──
export const saveMetaBazaarToCloud = async (bazaar: MetaBazaar) => {
    await setDocCloud('metaBazaars', bazaar.id, bazaar);
    logSystemAction('UPDATE', 'MetaBazaar', `بازارچه ${bazaar.name} ذخیره شد`, 'Master', bazaar.id);
};
export const deleteMetaBazaarFromCloud = async (id: string) => {
    const proxy = await checkProxyMode();
    let data: unknown = null;
    if (proxy) {
        data = await proxyGet('metaBazaars', { doc: id });
    } else {
        const snap = await getDoc(doc(db, 'metaBazaars', id));
        data = snap.exists() ? snap.data() : null;
    }
    await deleteDocCloud('metaBazaars', id);
    logSystemAction('DELETE', 'MetaBazaar', `بازارچه حذف شد`, 'Master', id, data, 'metaBazaars');
};
export const subscribeToMetaBazaars = (callback: (bazaars: MetaBazaar[]) => void) =>
  subscribeCollection<MetaBazaar>('metaBazaars', callback, {
    sort: (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    intervalMs: 8_000,
  });
export const getMetaBazaarBySlug = async (slug: string): Promise<MetaBazaar | null> => {
    try {
        const proxy = await checkProxyMode();
        if (proxy) {
            const all = await proxyGet<MetaBazaar[]>('metaBazaars');
            return (all || []).find(b => b.slug === slug) || null;
        }
        const q = query(collection(db, "metaBazaars"), where("slug", "==", slug), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return snap.docs[0].data() as MetaBazaar;
    } catch { return null; }
};

export const saveTaskToCloud = async (task: Task) => {
    await setDocCloud('tasks', task.id, task);
    logSystemAction('CREATE', 'Task', `وظیفه جدید "${task.title}" ایجاد شد`, task.creatorName, task.id);
};

export const updateTaskInCloud = async (id: string, updates: Partial<Task>) => {
    await updateDocCloud('tasks', id, updates as Record<string, unknown>);
};

export const deleteTaskFromCloud = async (id: string) => {
    const proxy = await checkProxyMode();
    let data: unknown = null;
    if (proxy) {
        data = await proxyGet('tasks', { doc: id });
    } else {
        const snap = await getDoc(doc(db, 'tasks', id));
        data = snap.exists() ? snap.data() : null;
    }
    await deleteDocCloud('tasks', id);
    logSystemAction('DELETE', 'Task', `وظیفه حذف شد`, 'کاربر', id, data, 'tasks');
};

export const subscribeToTasks = (callback: (tasks: Task[]) => void) =>
  subscribeCollection<Task>('tasks', callback, {
    sort: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    intervalMs: 8_000,
  });

export const saveMeetingToCloud = async (meeting: Meeting) => {
    await setDocCloud('meetings', meeting.id, meeting);
    logSystemAction('CREATE', 'Meeting', `جلسه "${meeting.title}" تنظیم شد`, meeting.organizerName, meeting.id);
};

export const updateMeetingInCloud = async (id: string, updates: Partial<Meeting>, actorName: string) => {
    await updateDocCloud('meetings', id, updates as Record<string, unknown>);
    logSystemAction('UPDATE', 'Meeting', `جلسه بروزرسانی شد`, actorName, id);
};

export const deleteMeetingFromCloud = async (id: string) => {
    const proxy = await checkProxyMode();
    let data: unknown = null;
    if (proxy) {
        data = await proxyGet('meetings', { doc: id });
    } else {
        const snap = await getDoc(doc(db, 'meetings', id));
        data = snap.exists() ? snap.data() : null;
    }
    await deleteDocCloud('meetings', id);
    logSystemAction('DELETE', 'Meeting', `جلسه لغو/حذف شد`, 'کاربر', id, data, 'meetings');
};

export const subscribeToMeetings = (callback: (meetings: Meeting[]) => void) =>
  subscribeCollection<Meeting>('meetings', callback, { intervalMs: 10_000 });

const MAX_MEETING_PENDING_GUESTS = 100;

export const tryBookMeeting = async (
    meetingId: string,
    guest: Omit<MeetingBookingGuest, 'id' | 'bookedAt'>,
): Promise<'ok' | 'taken' | 'full' | 'error' | 'not_found'> => {
    try {
        if (!meetingId) return 'error';
        const proxy = await checkProxyMode();
        let meeting: Meeting | null = null;
        if (proxy) {
            meeting = await proxyGet<Meeting>('meetings', { doc: meetingId });
        } else {
            const snap = await getDoc(doc(db, 'meetings', meetingId));
            if (snap.exists()) meeting = snap.data() as Meeting;
        }
        if (!meeting || meeting.kind !== 'bookable') return 'not_found';
        if (meeting.bookingStatus === 'confirmed' || meeting.confirmedGuestId) return 'taken';
        const guests = meeting.guests || [];
        if (guests.length >= MAX_MEETING_PENDING_GUESTS) return 'full';

        const newGuest: MeetingBookingGuest = {
            ...guest,
            id: `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            bookedAt: new Date().toISOString(),
        };
        await updateDocCloud('meetings', meetingId, {
            guests: [...guests, newGuest],
            bookingStatus: 'pending',
        });
        return 'ok';
    } catch { return 'error'; }
};

export const confirmMeetingBooking = async (
    meetingId: string,
    guestId: string,
    actorName: string,
): Promise<void> => {
    try {
        if (!meetingId || !guestId) return;
        const proxy = await checkProxyMode();
        let meeting: Meeting | null = null;
        if (proxy) {
            meeting = await proxyGet<Meeting>('meetings', { doc: meetingId });
        } else {
            const snap = await getDoc(doc(db, 'meetings', meetingId));
            if (snap.exists()) meeting = snap.data() as Meeting;
        }
        if (!meeting || meeting.kind !== 'bookable') return;
        const guest = (meeting.guests || []).find(g => g.id === guestId);
        if (!guest) return;
        await updateMeetingInCloud(meetingId, {
            bookingStatus: 'confirmed',
            confirmedGuestId: guestId,
        }, actorName);
    } catch {}
};

export const saveKPIToCloud = async (kpi: KPI) => {
    await setDocCloud('kpis', kpi.id, kpi);
    logSystemAction('CREATE', 'KPI', `شاخص عملکرد "${kpi.title}" ایجاد شد`, 'Master', kpi.id);
};

export const updateKPIInCloud = async (id: string, updates: Partial<KPI>) => {
    await updateDocCloud('kpis', id, updates as Record<string, unknown>);
    logSystemAction('UPDATE', 'KPI', `شاخص عملکرد بروزرسانی شد`, 'System', id);
};

export const deleteKPIFromCloud = async (id: string) => {
    await deleteDocCloud('kpis', id);
    logSystemAction('DELETE', 'KPI', `شاخص عملکرد حذف شد`, 'Master', id);
};

export const subscribeToKPIs = (callback: (kpis: KPI[]) => void) =>
  subscribeCollection<KPI>('kpis', callback, { intervalMs: 10_000 });

export const saveCustomFormToCloud = async (form: CustomForm, actorName: string) => {
    await setDocCloud('custom_forms', form.id, form);
    logSystemAction('CREATE', 'CustomForm', `فرم "${form.title}" ایجاد شد`, actorName, form.id);
};

export const updateCustomFormInCloud = async (id: string, updates: Partial<CustomForm>, actorName: string) => {
    await updateDocCloud('custom_forms', id, updates as Record<string, unknown>);
    logSystemAction('UPDATE', 'CustomForm', `فرم بروزرسانی شد`, actorName, id);
};

export const deleteCustomFormFromCloud = async (id: string, actorName: string) => {
    await deleteDocCloud('custom_forms', id);
    logSystemAction('DELETE', 'CustomForm', `فرم حذف شد`, actorName, id);
};

export const subscribeToCustomForms = (callback: (forms: CustomForm[]) => void) =>
  subscribeCollection<CustomForm>('custom_forms', callback, { intervalMs: 10_000 });

export const getTicketById = async (id: string): Promise<Ticket | null> => {
  const proxy = await checkProxyMode();
  if (proxy) {
    return await proxyGet<Ticket>('tickets', { doc: id });
  }
  const docSnap = await getDoc(doc(db, 'tickets', id));
  if (docSnap.exists()) return docSnap.data() as Ticket;
  return null;
};

export const getCustomFormById = async (id: string): Promise<CustomForm | null> => {
  // Use Firebase REST API directly — pure HTTP fetch, no SDK/IndexedDB, works in
  // Instagram/Facebook/Telegram in-app browsers and avoids Vercel cold starts.
  const restUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/custom_forms/${id}?key=${firebaseConfig.apiKey}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    let res: Response;
    try { res = await fetch(restUrl, { signal: ctrl.signal }); }
    finally { clearTimeout(t); }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { name?: string; fields?: Record<string, Record<string, unknown>> };
    if (!data.fields) return null;
    const docId = (data.name ?? '').split('/').pop() ?? id;
    return { id: docId, ..._fsFields(data.fields) } as unknown as CustomForm;
  } catch {
    // googleapis.com unreachable (Iran without VPN) → fall back to Vercel proxy
    return await proxyGet<CustomForm>('custom_forms', { doc: id });
  }
};

export const saveAppConfigToCloud = async (config: AppConfig) => {
    await setDocCloud('settings', 'appConfig', config);
    logSystemAction('UPDATE', 'System', `تنظیمات سیستم تغییر کرد`, 'Admin');
};

export const saveServicesToCloud = async (services: ServiceOption[]) => {
    await setDocCloud('settings', 'services', { list: services });
    logSystemAction('UPDATE', 'System', `لیست خدمات/تعرفه‌ها بروز شد`, 'Admin');
};

export const savePersonnelToCloud = async (personnel: Personnel[]) => {
    const cleanList = personnel.map(p => {
        const cleanDocs = (p.documents || []).map(docItem => {
             const cleanedFiles = cleanFilesForDB([docItem.file]);
             return cleanedFiles.length > 0 ? { ...docItem, file: cleanedFiles[0] } : null;
        }).filter(d => d !== null);
        return { ...p, documents: cleanDocs };
    });
    await setDocCloud('settings', 'personnel', { list: cleanList });
    logSystemAction('UPDATE', 'Personnel', `لیست پرسنل بروزرسانی شد`, 'Admin');
};

export const subscribeToSettings = (
    onConfig: (c: AppConfig) => void,
    onServices: (s: ServiceOption[]) => void,
    onPersonnel: (p: Personnel[]) => void
) => {
  let inner: (() => void) | null = null;
  let gone = false;

  const deliver = (docs: Array<{ id?: string; list?: unknown } & AppConfig>) => {
    docs.forEach((d) => {
      if (d.id === 'appConfig') onConfig(d as AppConfig);
      if (d.id === 'services' && (d as { list?: ServiceOption[] }).list) onServices((d as { list: ServiceOption[] }).list);
      if (d.id === 'personnel' && (d as { list?: Personnel[] }).list) onPersonnel((d as { list: Personnel[] }).list);
    });
  };

  const startProxy = () => {
    inner?.();
    inner = proxyPoll('settings', deliver, { intervalMs: 8_000 });
  };

  checkProxyMode().then(proxy => {
    if (gone) return;
    if (proxy) {
      startProxy();
    } else {
      inner = onSnapshot(collection(db, "settings"), snap => {
        deliver(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, () => {
        if (gone) return;
        forceProxyMode();
        startProxy();
      });
    }
  });

  return () => { gone = true; inner?.(); };
};

export const saveNewsArticleToCloud = async (article: NewsArticle): Promise<void> => {
    await setDocCloud('news', article.id, article);
    logSystemAction('UPDATE', 'News', `مقاله "${article.title}" ذخیره شد`, 'Admin');
};

export const deleteNewsArticleFromCloud = async (id: string): Promise<void> => {
    await deleteDocCloud('news', id);
    logSystemAction('DELETE', 'News', `مقاله حذف شد`, 'Admin');
};

export const subscribeToNews = (callback: (articles: NewsArticle[]) => void) =>
  subscribeCollection<NewsArticle>('news', callback, {
    sort: (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    orderField: 'publishedAt',
    dir: 'desc',
    intervalMs: 12_000,
  });

// ── Analytics ──────────────────────────────────────────────────────────────

let _countryCache: { country: string; countryCode: string; city: string } | null = null;

const getCountryInfo = async () => {
    if (_countryCache) return _countryCache;
    const cached = sessionStorage.getItem('_analytics_geo');
    if (cached) { _countryCache = JSON.parse(cached); return _countryCache!; }
    try {
        const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
        const d = await res.json();
        _countryCache = { country: d.country_name || 'Unknown', countryCode: d.country_code || 'XX', city: d.city || '' };
    } catch {
        _countryCache = { country: 'Unknown', countryCode: 'XX', city: '' };
    }
    sessionStorage.setItem('_analytics_geo', JSON.stringify(_countryCache));
    return _countryCache!;
};

const getSessionId = () => {
    let sid = sessionStorage.getItem('_analytics_sid');
    if (!sid) { sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; sessionStorage.setItem('_analytics_sid', sid); }
    return sid;
};

const getDevice = (): 'mobile' | 'tablet' | 'desktop' => {
    const ua = navigator.userAgent;
    if (/Mobi|Android/i.test(ua)) return 'mobile';
    if (/Tablet|iPad/i.test(ua)) return 'tablet';
    return 'desktop';
};

export const logPageView = async (view: string, articleSlug?: string) => {
    if (view === 'admin') return;
    try {
        const geo = await getCountryInfo();
        const event: AnalyticsEvent = {
            id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            page: view,
            articleSlug: articleSlug || '',
            country: geo.country,
            countryCode: geo.countryCode,
            city: geo.city,
            device: getDevice(),
            sessionId: getSessionId(),
            referrer: document.referrer ? new URL(document.referrer).hostname : 'direct',
        };
        const proxy = await checkProxyMode();
        if (proxy) {
            await proxyWrite('analytics', event.id, sanitizeData(event));
        } else {
            await setDoc(doc(db, 'analytics', event.id), sanitizeData(event));
        }
    } catch {}
};

export const subscribeToAnalytics = (callback: (events: AnalyticsEvent[]) => void) =>
  subscribeCollection<AnalyticsEvent>('analytics', list => callback(list.slice(0, 5000)), {
    sort: (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    orderField: 'timestamp',
    dir: 'desc',
    intervalMs: 15_000,
  });

// ── Meta Shop visitor analytics ────────────────────────────────────────────
// Public, fire-and-forget. Records a visit / product-click / add-to-cart event for one shop.
// Reuses the same geo-IP, session and device helpers as the site-wide analytics, and the
// Iran proxy when active. Visits are de-duplicated to once per session per shop.
export const logMetaShopEvent = async (
    type: MetaShopEvent['type'],
    shop: { id: string; name?: string },
    opts: { productId?: string; productName?: string; productGroup?: string; via?: 'shop' | 'gsite' } = {}
) => {
    try {
        if (!shop?.id) return;
        // One "visit" per session per shop — product clicks / add-to-cart are always logged.
        if (type === 'visit') {
            const key = `_msvisit_${shop.id}`;
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, '1');
        }
        const geo = await getCountryInfo();
        const event: MetaShopEvent = {
            id: `mse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            shopId: shop.id,
            shopName: shop.name || '',
            type,
            productId: opts.productId,
            productName: opts.productName,
            productGroup: opts.productGroup,
            country: geo.country,
            countryCode: geo.countryCode,
            city: geo.city,
            device: getDevice(),
            sessionId: getSessionId(),
            referrer: document.referrer ? new URL(document.referrer).hostname : 'direct',
            via: opts.via,
        };
        const proxy = await checkProxyMode();
        if (proxy) await proxyWrite('metaShopEvents', event.id, sanitizeData(event));
        else await setDoc(doc(db, 'metaShopEvents', event.id), sanitizeData(event));
    } catch {}
};

// Admin, on-demand. Loads all visitor events for one shop (single-field equality query →
// no composite index needed; sorted newest-first client-side).
export const fetchMetaShopEvents = async (shopId: string): Promise<MetaShopEvent[]> => {
    try {
        const q = query(collection(db, 'metaShopEvents'), where('shopId', '==', shopId), limit(10000));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as MetaShopEvent)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch { return []; }
};

// ── Metaverse Expo visitor analytics ───────────────────────────────────────
export const logMetaExpoEvent = async (
    type: MetaExpoEvent['type'],
    bazaar: { id: string; slug: string; name?: string },
    opts: Partial<Omit<MetaExpoEvent, 'id' | 'timestamp' | 'type' | 'bazaarId' | 'bazaarSlug' | 'bazaarName'>> = {}
) => {
    try {
        if (!bazaar?.id || !bazaar?.slug) return;
        if (type === 'visit') {
            const key = `_mevisit_${bazaar.id}`;
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, '1');
        }
        if (type === 'vr_enter') {
            const key = `_mevr_${bazaar.id}`;
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, '1');
        }
        const geo = await getCountryInfo();
        const event: MetaExpoEvent = {
            id: `mee_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            bazaarId: bazaar.id,
            bazaarSlug: bazaar.slug,
            bazaarName: bazaar.name || '',
            type,
            country: geo.country,
            countryCode: geo.countryCode,
            city: geo.city,
            device: getDevice(),
            sessionId: getSessionId(),
            referrer: document.referrer ? new URL(document.referrer).hostname : 'direct',
            ...opts,
        };
        const proxy = await checkProxyMode();
        if (proxy) await proxyWrite('metaExpoEvents', event.id, sanitizeData(event));
        else await setDoc(doc(db, 'metaExpoEvents', event.id), sanitizeData(event));
    } catch {}
};

export const fetchMetaExpoEvents = async (bazaarId: string): Promise<MetaExpoEvent[]> => {
    try {
        const q = query(collection(db, 'metaExpoEvents'), where('bazaarId', '==', bazaarId), limit(20000));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as MetaExpoEvent)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch { return []; }
};

// ── Metaverse Expo entrance visitor registrations ───────────────────────────
export const saveMetaExpoRegistration = async (registration: MetaExpoRegistration): Promise<void> => {
    try {
        if (!registration?.id || !registration?.bazaarId) return;
        const data = sanitizeData(registration);
        const proxy = await checkProxyMode();
        if (proxy) await proxyWrite('metaExpoRegistrations', registration.id, data);
        else await setDoc(doc(db, 'metaExpoRegistrations', registration.id), data);
    } catch {}
};

export const fetchMetaExpoRegistrations = async (bazaarId: string): Promise<MetaExpoRegistration[]> => {
    try {
        const q = query(collection(db, 'metaExpoRegistrations'), where('bazaarId', '==', bazaarId), limit(20000));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as MetaExpoRegistration)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch { return []; }
};

// ── Metaverse Expo booth reservations ───────────────────────────────────────
/** @deprecated Legacy single-doc id; new reservations use unique ids per request. */
export const boothReservationDocId = (bazaarId: string, boothId: string) => `ber_${bazaarId}_${boothId}`;

const newBoothReservationId = (bazaarId: string, boothId: string) =>
    `ber_${bazaarId}_${boothId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const tryReserveBooth = async (reservation: Omit<MetaExpoBoothReservation, 'id' | 'status'>): Promise<'ok' | 'taken' | 'full' | 'error'> => {
    try {
        if (!reservation?.bazaarId || !reservation?.boothId) return 'error';
        const active = (await fetchMetaExpoBoothReservations(reservation.bazaarId))
            .filter(r => r.boothId === reservation.boothId && (r.status === 'pending' || r.status === 'confirmed'));
        if (active.some(r => r.status === 'confirmed')) return 'taken';
        const pending = active.filter(r => r.status === 'pending');
        if (pending.length >= MAX_BOOTH_PENDING_RESERVATIONS) return 'full';

        const id = newBoothReservationId(reservation.bazaarId, reservation.boothId);
        const payload = sanitizeData({ ...reservation, id, status: 'pending' as const });
        const proxy = await checkProxyMode();
        if (proxy) {
            await proxyWrite('metaExpoBoothReservations', id, payload);
            return 'ok';
        }
        await setDoc(doc(db, 'metaExpoBoothReservations', id), payload);
        return 'ok';
    } catch { return 'error'; }
};

/** Master confirms one pending request; all other active holds on that booth are cancelled. */
export const confirmBoothReservation = async (id: string): Promise<void> => {
    try {
        if (!id) return;
        const proxy = await checkProxyMode();
        let target: MetaExpoBoothReservation | null = null;
        if (proxy) {
            target = await proxyGet<MetaExpoBoothReservation>('metaExpoBoothReservations', { doc: id });
        } else {
            const snap = await getDoc(doc(db, 'metaExpoBoothReservations', id));
            if (snap.exists()) target = snap.data() as MetaExpoBoothReservation;
        }
        if (!target || target.status !== 'pending') return;

        const sameBooth = (await fetchMetaExpoBoothReservations(target.bazaarId))
            .filter(r => r.boothId === target!.boothId && (r.status === 'pending' || r.status === 'confirmed'));

        await Promise.all(sameBooth.map(r =>
            updateMetaExpoBoothReservation(r.id, { status: r.id === id ? 'confirmed' : 'cancelled' }),
        ));
    } catch {}
};

export const updateMetaExpoBoothReservation = async (id: string, updates: Partial<MetaExpoBoothReservation>): Promise<void> => {
    try {
        if (!id) return;
        const data = sanitizeData(updates);
        const proxy = await checkProxyMode();
        if (proxy) {
            const existing = await proxyGet<MetaExpoBoothReservation>('metaExpoBoothReservations', { doc: id });
            if (!existing) return;
            await proxyWrite('metaExpoBoothReservations', id, sanitizeData({ ...existing, ...data }));
            return;
        }
        await updateDoc(doc(db, 'metaExpoBoothReservations', id), data);
    } catch {}
};

export const fetchMetaExpoBoothReservations = async (bazaarId: string): Promise<MetaExpoBoothReservation[]> => {
    try {
        const q = query(collection(db, 'metaExpoBoothReservations'), where('bazaarId', '==', bazaarId), limit(2000));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as MetaExpoBoothReservation)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch { return []; }
};

export const subscribeMetaExpoBoothReservations = (
    bazaarId: string,
    callback: (reservations: MetaExpoBoothReservation[]) => void,
): (() => void) => {
    const normalize = (items: MetaExpoBoothReservation[]) =>
        callback(items.filter(r => r.bazaarId === bazaarId));
    let inner: (() => void) | null = null;
    let gone = false;
    checkProxyMode().then(proxy => {
        if (gone) return;
        if (proxy) inner = proxyPoll<MetaExpoBoothReservation>('metaExpoBoothReservations', normalize, { intervalMs: 4000 });
        else {
            inner = onSnapshot(
                query(collection(db, 'metaExpoBoothReservations'), where('bazaarId', '==', bazaarId), limit(2000)),
                snap => normalize(snap.docs.map(d => d.data() as MetaExpoBoothReservation)),
                () => {
                    if (gone) return;
                    forceProxyMode();
                    inner?.();
                    inner = proxyPoll<MetaExpoBoothReservation>('metaExpoBoothReservations', normalize, { intervalMs: 4000 });
                },
            );
        }
    });
    return () => { gone = true; inner?.(); };
};

// ── Metaverse Expo live presence ────────────────────────────────────────────
export const upsertMetaExpoPresence = async (presence: MetaExpoPresence): Promise<void> => {
    try {
        const data = sanitizeData(presence);
        const proxy = await checkProxyMode();
        if (proxy) await proxyWrite('metaExpoPresence', presence.id, data);
        else await setDoc(doc(db, 'metaExpoPresence', presence.id), data);
    } catch {}
};

export const markMetaExpoPresenceInactive = async (presence: MetaExpoPresence): Promise<void> => {
    try {
        await upsertMetaExpoPresence({ ...presence, active: false, lastSeen: new Date().toISOString() });
    } catch {}
};

export const subscribeMetaExpoPresence = (
    roomId: string,
    callback: (presence: MetaExpoPresence[]) => void
): (() => void) => {
    const freshMs = 45_000;
    const normalize = (items: MetaExpoPresence[]) => {
        const cutoff = Date.now() - freshMs;
        callback(items
            .filter(p => p.roomId === roomId && p.active !== false && new Date(p.lastSeen).getTime() >= cutoff)
            .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()));
    };
    let inner: (() => void) | null = null;
    let gone = false;
    checkProxyMode().then(proxy => {
        if (gone) return;
        if (proxy) inner = proxyPoll<MetaExpoPresence>('metaExpoPresence', normalize, { intervalMs: 3000 });
        else {
            inner = onSnapshot(
                query(collection(db, 'metaExpoPresence'), where('roomId', '==', roomId), limit(80)),
                snap => normalize(snap.docs.map(d => d.data() as MetaExpoPresence)),
                () => {
                    if (gone) return;
                    forceProxyMode();
                    inner?.();
                    inner = proxyPoll<MetaExpoPresence>('metaExpoPresence', normalize, { intervalMs: 3000 });
                },
            );
        }
    });
    return () => { gone = true; inner?.(); };
};

// ── Notification Logs ──

export const saveNotificationLog = async (log: Omit<NotificationLog, 'id'>): Promise<void> => {
    try {
        const id = `nl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDocCloud('notification_logs', id, { ...log, id });
    } catch {}
};

export const subscribeToNotificationLogs = (callback: (logs: NotificationLog[]) => void) =>
  subscribeCollection<NotificationLog>('notification_logs', list => callback(list.slice(0, 100)), {
    sort: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    orderField: 'createdAt',
    dir: 'desc',
    intervalMs: 12_000,
  });

// ── Customer Accounts ──────────────────────────────────────────────────────
export const saveCustomerAccount = async (account: CustomerAccount) => {
  await setDocCloud('customerAccounts', account.id, account);
};

export const deleteCustomerAccount = async (id: string) => {
  await deleteDocCloud('customerAccounts', id);
};

export const subscribeToCustomerAccounts = (callback: (accounts: CustomerAccount[]) => void) =>
  subscribeCollection<CustomerAccount>('customerAccounts', callback, {
    sort: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    orderField: 'createdAt',
    dir: 'desc',
    intervalMs: 10_000,
  });

// --- Company Processes ---

export const subscribeToProcesses = (callback: (processes: CompanyProcess[]) => void) =>
  subscribeCollection<CompanyProcess>('processes', callback, {
    sort: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    orderField: 'createdAt',
    dir: 'desc',
    intervalMs: 12_000,
  });

export const saveProcess = async (process: CompanyProcess): Promise<void> => {
  await setDocCloud('processes', process.id, process);
};

export const deleteProcess = async (id: string): Promise<void> => {
  await deleteDocCloud('processes', id);
};
