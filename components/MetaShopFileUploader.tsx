import React, { useCallback, useRef, useState } from 'react';
import { IconCopy, IconUpload, IconFile, IconTrash, IconCheck } from './Icons';
import { uploadFileWithProgress, DOCUMENT_MAX_BYTES, type CentralStorageFolder } from '../services/firebaseService';
import { Language } from '../App';

type UploadStatus = 'queued' | 'uploading' | 'done' | 'error';

interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  url?: string;
  error?: string;
}

interface Props {
  lang: Language;
  readonly?: boolean;
}

function pickStorageFolder(file: File): CentralStorageFolder {
  const type = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  if (type.startsWith('image/')) return 'images';
  if (type.startsWith('video/')) return 'uploads';
  if (
    type === 'application/pdf'
    || type.includes('word')
    || type.includes('document')
    || type.includes('presentation')
    || type.includes('powerpoint')
    || type.includes('spreadsheet')
    || type.includes('excel')
    || /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|odt|ods|odp|rtf|txt|csv)$/i.test(name)
  ) return 'documents';
  return 'uploads';
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const MetaShopFileUploader: React.FC<Props> = ({ lang, readonly = false }) => {
  const T = lang === 'fa';
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const uploadingRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const t = {
    title: T ? 'آپلود فایل‌ها' : 'File uploads',
    subtitle: T ? 'عکس، PDF، ورد، پرزنتیشن، ویدئو و هر فرمت دیگر — آپلود گروهی و دریافت لینک مستقیم' : 'Images, PDF, Word, presentations, video & more — bulk upload with direct links',
    drop: T ? 'فایل‌ها را اینجا رها کنید یا کلیک کنید' : 'Drop files here or click to browse',
    dropHint: T ? 'چند فایل همزمان انتخاب کنید' : 'Select multiple files at once',
    maxSize: T ? `حداکثر ${(DOCUMENT_MAX_BYTES / (1024 * 1024)).toFixed(0)} مگابایت برای هر فایل` : `Max ${(DOCUMENT_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB per file`,
    uploading: T ? 'در حال آپلود…' : 'Uploading…',
    queued: T ? 'در صف' : 'Queued',
    done: T ? 'آماده' : 'Ready',
    error: T ? 'خطا' : 'Error',
    copy: T ? 'کپی لینک' : 'Copy link',
    copied: T ? 'کپی شد ✓' : 'Copied ✓',
    copyAll: T ? 'کپی همه لینک‌ها' : 'Copy all links',
    copyAllDone: T ? 'همه لینک‌ها کپی شد ✓' : 'All links copied ✓',
    copyNames: T ? 'کپی نام + لینک' : 'Copy name + link',
    clearDone: T ? 'پاک کردن موارد آپلودشده' : 'Clear uploaded',
    clearAll: T ? 'پاک کردن همه' : 'Clear all',
    noFiles: T ? 'هنوز فایلی آپلود نشده است.' : 'No files uploaded yet.',
    link: T ? 'لینک' : 'Link',
    readonlyMsg: T ? 'دسترسی ویرایش ندارید — فقط مشاهده.' : 'Read-only — uploads disabled.',
  };

  const processQueue = useCallback(async () => {
    if (uploadingRef.current || readonly) return;
    uploadingRef.current = true;
    try {
      for (;;) {
        const target = itemsRef.current.find(it => it.status === 'queued');
        if (!target) break;
        const id = target.id;
        setItems(prev => prev.map(it => (it.id === id ? { ...it, status: 'uploading', progress: 0 } : it)));
        const folder = pickStorageFolder(target.file);
        await new Promise<void>((resolve) => {
          uploadFileWithProgress(
            target.file,
            (p) => setItems(cur => cur.map(it => (it.id === id ? { ...it, progress: p } : it))),
            (url) => {
              setItems(cur => cur.map(it => (it.id === id ? { ...it, status: 'done', progress: 100, url } : it)));
              resolve();
            },
            (err) => {
              setItems(cur => cur.map(it => (it.id === id ? { ...it, status: 'error', error: err.message } : it)));
              resolve();
            },
            folder,
          );
        });
      }
    } finally {
      uploadingRef.current = false;
    }
  }, [readonly]);

  const enqueueFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    const next: UploadItem[] = [];
    for (const file of list) {
      if (file.size > DOCUMENT_MAX_BYTES) {
        next.push({
          id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          status: 'error',
          progress: 0,
          error: T ? `حجم بیش از حد مجاز (${formatBytes(file.size)})` : `Too large (${formatBytes(file.size)})`,
        });
        continue;
      }
      next.push({
        id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        status: 'queued',
        progress: 0,
      });
    }
    setItems(prev => {
      const merged = [...next, ...prev];
      queueMicrotask(() => { void processQueue(); });
      return merged;
    });
  }, [T, processQueue]);

  React.useEffect(() => {
    if (items.some(it => it.status === 'queued') && !uploadingRef.current) {
      void processQueue();
    }
  }, [items, processQueue]);

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      alert(T ? 'کپی نشد' : 'Copy failed');
    }
  };

  const doneUrls = items.filter(it => it.status === 'done' && it.url).map(it => it.url!);
  const copyAllLinks = () => {
    if (!doneUrls.length) return;
    copyText(doneUrls.join('\n'), '__all__');
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1800);
  };
  const copyAllWithNames = () => {
    const lines = items
      .filter(it => it.status === 'done' && it.url)
      .map(it => `${it.file.name}\t${it.url}`);
    if (!lines.length) return;
    copyText(lines.join('\n'), '__names__');
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) enqueueFiles(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (readonly) return;
    if (e.dataTransfer.files?.length) enqueueFiles(e.dataTransfer.files);
  };

  const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-violet-100 text-violet-600 rounded-xl">
          <IconUpload className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">{t.title}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{t.subtitle}</p>
        </div>
      </div>

      {readonly ? (
        <div className={`${card} p-4 text-sm text-amber-800 bg-amber-50 border-amber-100`}>{t.readonlyMsg}</div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`${card} p-10 border-2 border-dashed text-center cursor-pointer transition-colors ${
            dragOver ? 'border-violet-400 bg-violet-50/50' : 'border-gray-200 hover:border-violet-300 hover:bg-gray-50/50'
          }`}
        >
          <IconUpload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">{t.drop}</p>
          <p className="text-xs text-gray-400 mt-1">{t.dropHint}</p>
          <p className="text-[11px] text-gray-400 mt-2">{t.maxSize}</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onInputChange}
          />
        </div>
      )}

      {items.length > 0 && (
        <div className={`${card} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80">
            <span className="text-sm font-semibold text-gray-700">
              {items.length} {T ? 'فایل' : 'files'}
              {items.some(it => it.status === 'uploading') && (
                <span className="text-violet-600 font-normal mr-2"> — {t.uploading}</span>
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              {doneUrls.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={copyAllLinks}
                    className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 flex items-center gap-1"
                  >
                    <IconCopy className="w-3.5 h-3.5" />
                    {copiedAll ? t.copyAllDone : t.copyAll}
                  </button>
                  <button
                    type="button"
                    onClick={copyAllWithNames}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-white flex items-center gap-1"
                  >
                    <IconCopy className="w-3.5 h-3.5" />
                    {t.copyNames}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setItems(prev => prev.filter(it => it.status !== 'done'))}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white"
              >
                {t.clearDone}
              </button>
              <button
                type="button"
                onClick={() => setItems([])}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1"
              >
                <IconTrash className="w-3 h-3" />
                {t.clearAll}
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
            {items.map(it => (
              <div key={it.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    it.status === 'done' ? 'bg-emerald-100 text-emerald-600'
                      : it.status === 'error' ? 'bg-red-100 text-red-600'
                      : it.status === 'uploading' ? 'bg-violet-100 text-violet-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {it.status === 'done' ? <IconCheck className="w-4 h-4" /> : <IconFile className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate" title={it.file.name}>{it.file.name}</p>
                    <p className="text-[11px] text-gray-400">{formatBytes(it.file.size)}</p>
                    {it.status === 'uploading' && (
                      <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 transition-all" style={{ width: `${it.progress}%` }} />
                      </div>
                    )}
                    {it.status === 'error' && <p className="text-[11px] text-red-600 mt-0.5">{it.error}</p>}
                  </div>
                </div>

                {it.status === 'done' && it.url && (
                  <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[280px]">
                    <input
                      readOnly
                      dir="ltr"
                      value={it.url}
                      className="flex-1 min-w-0 text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 font-mono"
                      onFocus={e => e.target.select()}
                    />
                    <button
                      type="button"
                      onClick={() => copyText(it.url!, it.id)}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                    >
                      <IconCopy className="w-3.5 h-3.5" />
                      {copiedId === it.id ? t.copied : t.copy}
                    </button>
                  </div>
                )}

                {it.status === 'queued' && (
                  <span className="text-xs text-gray-400 shrink-0">{t.queued}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && !readonly && (
        <p className="text-center text-sm text-gray-400 py-4">{t.noFiles}</p>
      )}
    </div>
  );
};
