
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, setDoc, query, orderBy, onSnapshot, deleteDoc, where, limit, writeBatch, getDoc } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { Ticket, Customer, AppConfig, ServiceOption, Personnel, AttachedFile, PersonnelDocument, InternalMessage, Task, Meeting, SystemLog, KPI, CustomForm, SalesRecord, PerformanceReport, StrategicObjective, Expense, NewsArticle, AnalyticsEvent, NotificationLog, CustomerAccount } from '../types';

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

// ── Iran Proxy ─────────────────────────────────────────────────────────────
// Firebase (Google) is blocked in Iran. On first use we test connectivity;
// if blocked we route public read/write through /api/fb (Vercel serverless).

const _PROXY_LS_KEY = '_iran_proxy_v2';
const _PROXY_TTL_MS = 10 * 60 * 1000; // 10 minutes — persist across page reloads

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
// ── End Iran Proxy ──────────────────────────────────────────────────────────
const CENTRAL_STORAGE_BUCKET = "calculator-55611.firebasestorage.app";
const CENTRAL_STORAGE_PROJECT_ID = "calculator-55611";
const STORAGE_ROOT = "tohid-dayhami-platform";
export type CentralStorageFolder = "uploads" | "images" | "documents" | "temp";
export const storageFolders: Record<CentralStorageFolder, string> = {
    uploads: `${STORAGE_ROOT}/uploads`,
    images: `${STORAGE_ROOT}/images`,
    documents: `${STORAGE_ROOT}/documents`,
    temp: `${STORAGE_ROOT}/temp`,
};
const storage = getStorage(app, `gs://${CENTRAL_STORAGE_BUCKET}`);
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
    const message = error instanceof Error ? error.message : "";
    const details = `Bucket: ${CENTRAL_STORAGE_BUCKET} | Path: ${storagePath} | Code: ${code || "unknown"}`;

    if (code === "storage/unauthorized") {
        return `دسترسی آپلود در Firebase Storage مجاز نیست. Rules پروژه ${CENTRAL_STORAGE_PROJECT_ID}، وضعیت Publish شدن Rules، و App Check را بررسی کنید. ${details}`;
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
    onProgress?: (progress: number) => void
): Promise<{ url: string; path: string }> => {
    const path = buildCentralStoragePath(file.name, folder);
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

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
    folder: CentralStorageFolder = "uploads"
) => {
    try {
        const { url } = await uploadFile(file, folder, onProgress);
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
    collectionName?: string
) => {
    try {
        const logEntry: SystemLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            actionType,
            entity,
            details,
            actorName,
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
    const ticketToSave = { ...ticket, files: cleanFilesForDB(ticket.files) };
    const proxy = await checkProxyMode();
    if (proxy) {
      await proxyWrite('tickets', ticket.id, sanitizeData(ticketToSave));
    } else {
      await setDoc(doc(db, "tickets", ticket.id), sanitizeData(ticketToSave));
    }
    logSystemAction('CREATE', 'Ticket', `تیکت جدید با عنوان ${ticket.serviceId} برای ${ticket.customerName} ایجاد شد`, 'سیستم/مشتری', ticket.id);
    return ticket.id;
  } catch (e) {
    console.error("Error adding ticket: ", e);
    throw e;
  }
};

export const updateTicketInCloud = async (id: string, updates: Partial<Ticket>) => {
  try {
    const ticketRef = doc(db, "tickets", id);
    const finalUpdates = { ...updates };
    if (updates.projectData && updates.projectData.projectFiles) {
        finalUpdates.projectData.projectFiles = cleanFilesForDB(updates.projectData.projectFiles);
    }
    if (updates.files) {
        finalUpdates.files = cleanFilesForDB(updates.files);
    }
    await updateDoc(ticketRef, sanitizeData(finalUpdates));
  } catch (e) {
    throw e;
  }
};

export const deleteTicketFromCloud = async (id: string) => {
  const ref = doc(db, "tickets", id);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : null;
  await deleteDoc(ref);
  logSystemAction('DELETE', 'Ticket', `تیکت با شناسه ${id} حذف شد`, 'Master', id, data, 'tickets');
};

export const subscribeToTickets = (callback: (tickets: Ticket[]) => void) => {
  let inner: (() => void) | null = null;
  let gone = false;

  checkProxyMode().then(proxy => {
    if (gone) return;
    if (proxy) {
      inner = proxyPoll<Ticket>('tickets', list => {
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(list);
      });
    } else {
      const q = query(collection(db, "tickets"));
      inner = onSnapshot(q, snap => {
        const tickets = snap.docs.map(d => d.data() as Ticket);
        tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(tickets);
      }, () => {});
    }
  });

  return () => { gone = true; inner?.(); };
};

export const saveCustomerToCloud = async (customer: Customer) => {
  const proxy = await checkProxyMode();
  if (proxy) {
    await proxyWrite('customers', customer.id, sanitizeData(customer));
  } else {
    await setDoc(doc(db, "customers", customer.id), sanitizeData(customer));
  }
};

export const updateCustomerInCloud = async (id: string, updates: Partial<Customer>) => {
  await updateDoc(doc(db, "customers", id), sanitizeData(updates));
  logSystemAction('UPDATE', 'Customer', `اطلاعات مشتری بروزرسانی شد`, 'کاربر سیستم', id);
};

export const deleteCustomerFromCloud = async (id: string) => {
  const ref = doc(db, "customers", id);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : null;
  await deleteDoc(ref);
  logSystemAction('DELETE', 'Customer', `مشتری حذف شد`, 'Master', id, data, 'customers');
};

export const saveCustomersBulkToCloud = async (customers: Customer[]) => {
    const batchSize = 400;
    for (let i = 0; i < customers.length; i += batchSize) {
        const chunk = customers.slice(i, i + batchSize);
        await Promise.all(chunk.map(c => setDoc(doc(db, "customers", c.id), sanitizeData(c))));
    }
    logSystemAction('CREATE', 'Customer', `${customers.length} مشتری به صورت گروهی ایمپورت شدند`, 'سیستم');
};

export const subscribeToCustomers = (callback: (customers: Customer[]) => void) => {
  return onSnapshot(collection(db, "customers"), (snap) => {
    const list = snap.docs.map(doc => doc.data() as Customer);
    callback(list);
  }, (error) => {});
};

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
      const msgToSave = { 
          ...message, 
          files: cleanFilesForDB(message.files)
      };
      await setDoc(doc(db, "messages", message.id), sanitizeData(msgToSave));
      logSystemAction('CREATE', 'Message', `پیام جدید از ${message.senderName} ارسال شد`, message.senderName, message.id);
  } catch(e) {
      throw e;
  }
};

export const updateMessageInCloud = async (id: string, updates: Partial<InternalMessage>) => {
    await updateDoc(doc(db, "messages", id), sanitizeData(updates));
};

export const deleteMessageFromCloud = async (id: string) => {
    const ref = doc(db, "messages", id);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : null;
    await deleteDoc(ref);
    logSystemAction('DELETE', 'Message', `پیام حذف شد`, 'Master', id, data, 'messages');
};

export const subscribeToMessages = (callback: (msgs: InternalMessage[]) => void) => {
    const q = query(collection(db, "messages"));
    return onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(d => d.data() as InternalMessage);
        msgs.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(msgs);
    }, (e) => {});
};

export const saveTaskToCloud = async (task: Task) => {
    await setDoc(doc(db, "tasks", task.id), sanitizeData(task));
    logSystemAction('CREATE', 'Task', `وظیفه جدید "${task.title}" ایجاد شد`, task.creatorName, task.id);
};

export const updateTaskInCloud = async (id: string, updates: Partial<Task>) => {
    await updateDoc(doc(db, "tasks", id), sanitizeData(updates));
};

export const deleteTaskFromCloud = async (id: string) => {
    const ref = doc(db, "tasks", id);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : null;
    await deleteDoc(ref);
    logSystemAction('DELETE', 'Task', `وظیفه حذف شد`, 'کاربر', id, data, 'tasks');
};

export const subscribeToTasks = (callback: (tasks: Task[]) => void) => {
    const q = query(collection(db, "tasks"));
    return onSnapshot(q, (snapshot) => {
        const tasks = snapshot.docs.map(d => d.data() as Task);
        tasks.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(tasks);
    }, (e) => {});
};

export const saveMeetingToCloud = async (meeting: Meeting) => {
    await setDoc(doc(db, "meetings", meeting.id), sanitizeData(meeting));
    logSystemAction('CREATE', 'Meeting', `جلسه "${meeting.title}" تنظیم شد`, meeting.organizerName, meeting.id);
};

export const updateMeetingInCloud = async (id: string, updates: Partial<Meeting>, actorName: string) => {
    await updateDoc(doc(db, "meetings", id), sanitizeData(updates));
    logSystemAction('UPDATE', 'Meeting', `جلسه بروزرسانی شد`, actorName, id);
};

export const deleteMeetingFromCloud = async (id: string) => {
    const ref = doc(db, "meetings", id);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : null;
    await deleteDoc(ref);
    logSystemAction('DELETE', 'Meeting', `جلسه لغو/حذف شد`, 'کاربر', id, data, 'meetings');
};

export const subscribeToMeetings = (callback: (meetings: Meeting[]) => void) => {
    const q = query(collection(db, "meetings"));
    return onSnapshot(q, (snapshot) => {
        const meetings = snapshot.docs.map(d => d.data() as Meeting);
        callback(meetings);
    }, (e) => {});
};

export const saveKPIToCloud = async (kpi: KPI) => {
    await setDoc(doc(db, "kpis", kpi.id), sanitizeData(kpi));
    logSystemAction('CREATE', 'KPI', `شاخص عملکرد "${kpi.title}" ایجاد شد`, 'Master', kpi.id);
};

export const updateKPIInCloud = async (id: string, updates: Partial<KPI>) => {
    await updateDoc(doc(db, "kpis", id), sanitizeData(updates));
    logSystemAction('UPDATE', 'KPI', `شاخص عملکرد بروزرسانی شد`, 'System', id);
};

export const deleteKPIFromCloud = async (id: string) => {
    const ref = doc(db, "kpis", id);
    await deleteDoc(ref);
    logSystemAction('DELETE', 'KPI', `شاخص عملکرد حذف شد`, 'Master', id);
};

export const subscribeToKPIs = (callback: (kpis: KPI[]) => void) => {
    const q = query(collection(db, "kpis"));
    return onSnapshot(q, (snapshot) => {
        const kpis = snapshot.docs.map(d => d.data() as KPI);
        callback(kpis);
    }, (e) => {});
};

export const saveCustomFormToCloud = async (form: CustomForm, actorName: string) => {
    await setDoc(doc(db, "custom_forms", form.id), sanitizeData(form));
    logSystemAction('CREATE', 'CustomForm', `فرم "${form.title}" ایجاد شد`, actorName, form.id);
};

export const updateCustomFormInCloud = async (id: string, updates: Partial<CustomForm>, actorName: string) => {
    await updateDoc(doc(db, "custom_forms", id), sanitizeData(updates));
    logSystemAction('UPDATE', 'CustomForm', `فرم بروزرسانی شد`, actorName, id);
};

export const deleteCustomFormFromCloud = async (id: string, actorName: string) => {
    const ref = doc(db, "custom_forms", id);
    await deleteDoc(ref);
    logSystemAction('DELETE', 'CustomForm', `فرم حذف شد`, actorName, id);
};

export const subscribeToCustomForms = (callback: (forms: CustomForm[]) => void) => {
    const q = query(collection(db, "custom_forms"));
    return onSnapshot(q, (snapshot) => {
        const forms = snapshot.docs.map(d => d.data() as CustomForm);
        callback(forms);
    }, (e) => {});
};

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
  const proxy = await checkProxyMode();
  if (proxy) {
    // proxyGet throws on server errors; returns null when document doesn't exist (proxy sends 200+null for 404)
    return await proxyGet<CustomForm>('custom_forms', { doc: id });
  }
  // getDoc throws on network errors; returns snapshot with exists()=false when document not found
  const docSnap = await getDoc(doc(db, "custom_forms", id));
  if (docSnap.exists()) return docSnap.data() as CustomForm;
  return null;
};

export const saveAppConfigToCloud = async (config: AppConfig) => {
    await setDoc(doc(db, "settings", "appConfig"), sanitizeData(config));
    logSystemAction('UPDATE', 'System', `تنظیمات سیستم تغییر کرد`, 'Admin');
};

export const saveServicesToCloud = async (services: ServiceOption[]) => {
    await setDoc(doc(db, "settings", "services"), { list: sanitizeData(services) });
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
    await setDoc(doc(db, "settings", "personnel"), { list: sanitizeData(cleanList) });
    logSystemAction('UPDATE', 'Personnel', `لیست پرسنل بروزرسانی شد`, 'Admin');
};

export const subscribeToSettings = (
    onConfig: (c: AppConfig) => void,
    onServices: (s: ServiceOption[]) => void,
    onPersonnel: (p: Personnel[]) => void
) => {
  let inner: (() => void) | null = null;
  let gone = false;

  checkProxyMode().then(proxy => {
    if (gone) return;
    if (proxy) {
      inner = proxyPoll<any>('settings', docs => {
        docs.forEach((d: any) => {
          if (d.id === 'appConfig') onConfig(d as AppConfig);
          if (d.id === 'services' && d.list) onServices(d.list as ServiceOption[]);
          if (d.id === 'personnel' && d.list) onPersonnel(d.list as Personnel[]);
        });
      });
    } else {
      inner = onSnapshot(collection(db, "settings"), snap => {
        snap.docs.forEach(d => {
          if (d.id === 'appConfig') onConfig(d.data() as AppConfig);
          if (d.id === 'services') onServices(d.data().list);
          if (d.id === 'personnel') onPersonnel(d.data().list);
        });
      }, () => {});
    }
  });

  return () => { gone = true; inner?.(); };
};

export const saveNewsArticleToCloud = async (article: NewsArticle): Promise<void> => {
    await setDoc(doc(db, 'news', article.id), sanitizeData(article));
    logSystemAction('UPDATE', 'News', `مقاله "${article.title}" ذخیره شد`, 'Admin');
};

export const deleteNewsArticleFromCloud = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'news', id));
    logSystemAction('DELETE', 'News', `مقاله حذف شد`, 'Admin');
};

export const subscribeToNews = (callback: (articles: NewsArticle[]) => void) => {
  let inner: (() => void) | null = null;
  let gone = false;

  checkProxyMode().then(proxy => {
    if (gone) return;
    if (proxy) {
      inner = proxyPoll<NewsArticle>('news', list => {
        list.sort((a, b) => new Date((b as any).publishedAt).getTime() - new Date((a as any).publishedAt).getTime());
        callback(list);
      }, { orderField: 'publishedAt', dir: 'desc' });
    } else {
      inner = onSnapshot(
        query(collection(db, 'news'), orderBy('publishedAt', 'desc')),
        snap => callback(snap.docs.map(d => d.data() as NewsArticle)),
        () => {}
      );
    }
  });

  return () => { gone = true; inner?.(); };
};

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

export const subscribeToAnalytics = (callback: (events: AnalyticsEvent[]) => void) => {
    return onSnapshot(
        query(collection(db, 'analytics'), orderBy('timestamp', 'desc'), limit(5000)),
        (snap) => callback(snap.docs.map(d => d.data() as AnalyticsEvent)),
        () => {}
    );
};

// ── Notification Logs ──

export const saveNotificationLog = async (log: Omit<NotificationLog, 'id'>): Promise<void> => {
    try {
        const id = `nl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, 'notification_logs', id), sanitizeData({ ...log, id }));
    } catch {}
};

export const subscribeToNotificationLogs = (callback: (logs: NotificationLog[]) => void) => {
    const q = query(collection(db, 'notification_logs'), orderBy('createdAt', 'desc'), limit(100));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => d.data() as NotificationLog));
    }, () => {});
};

// ── Customer Accounts ──────────────────────────────────────────────────────
export const saveCustomerAccount = async (account: CustomerAccount) => {
  await setDoc(doc(db, 'customerAccounts', account.id), sanitizeData(account));
};

export const deleteCustomerAccount = async (id: string) => {
  await deleteDoc(doc(db, 'customerAccounts', id));
};

export const subscribeToCustomerAccounts = (callback: (accounts: CustomerAccount[]) => void) => {
  const q = query(collection(db, 'customerAccounts'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => d.data() as CustomerAccount));
  });
};
