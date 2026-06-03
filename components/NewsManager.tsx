
import React, { useState, useRef } from 'react';
import { NewsArticle } from '../types';
import { IconPlus, IconEdit, IconTrash, IconCheck, IconNewspaper, IconImage, IconUpload } from './Icons';
import { saveNewsArticleToCloud, deleteNewsArticleFromCloud } from '../services/firebaseService';

const SAMPLE_FA: NewsArticle[] = [
  {
    id: 'news_fa_001', slug: 'راهنمای-صادرات-به-عمان',
    title: 'راهنمای کامل صادرات به کشور عمان در سال ۱۴۰۳',
    titleEn: 'Complete Guide to Exporting to Oman in 2024',
    summary: 'در این مقاله با مراحل کامل صادرات کالا به کشور عمان، مدارک لازم، مقررات گمرکی و فرصت‌های تجاری آشنا می‌شوید.',
    summaryEn: 'This article covers the full process of exporting goods to Oman.',
    content: 'عمان یکی از مهم‌ترین بازارهای هدف برای صادرکنندگان است...\n\nمراحل صادرات:\n۱. دریافت کارت بازرگانی\n۲. ثبت سفارش صادراتی\n۳. تهیه مدارک گمرکی\n\nمدارک لازم:\n- فاکتور تجاری (Commercial Invoice)\n- بارنامه (Bill of Lading)\n- گواهی مبدأ (Certificate of Origin)',
    contentEn: '', category: 'راهنما و آموزش',
    tags: ['عمان', 'صادرات', 'گمرک'], author: 'تیم توحید دیهمی',
    publishedAt: '2024-03-15T10:00:00.000Z', isPublished: true,
    coverImage: '', viewCount: 0,
    metaDescription: 'راهنمای جامع صادرات به عمان - مراحل، مدارک و مقررات گمرکی',
    metaKeywords: 'صادرات به عمان، گمرک عمان'
  },
  {
    id: 'news_fa_002', slug: 'استانداردهای-بسته-بندی-صادراتی',
    title: 'استانداردهای بسته‌بندی برای ورود به بازارهای اروپایی',
    titleEn: 'Packaging Standards for European Market Entry',
    summary: 'بسته‌بندی مناسب یکی از کلیدی‌ترین عوامل موفقیت در صادرات است.',
    summaryEn: 'Proper packaging is one of the key success factors in exports.',
    content: 'بازارهای اروپایی دارای استانداردهای سختگیرانه‌ای هستند...\n\nالزامات اصلی:\n- برچسب‌گذاری به زبان کشور مقصد\n- درج تاریخ انقضا و کد تولید\n- رعایت استانداردهای زیست‌محیطی\n\nگواهینامه‌های مورد نیاز:\n- CE Marking\n- ISO 22000 برای مواد غذایی',
    contentEn: '', category: 'قوانین و مقررات',
    tags: ['بسته‌بندی', 'اروپا', 'استاندارد'], author: 'تیم توحید دیهمی',
    publishedAt: '2024-03-20T08:00:00.000Z', isPublished: true,
    coverImage: '', viewCount: 0,
    metaDescription: 'استانداردهای بسته‌بندی صادراتی برای بازارهای اروپایی',
    metaKeywords: 'بسته‌بندی صادراتی، استاندارد اروپا'
  }
];

const SAMPLE_EN: NewsArticle[] = [
  {
    id: 'news_en_001', slug: 'oman-export-guide-2024',
    title: 'Complete Guide to Exporting to Oman in 2024',
    titleEn: 'Complete Guide to Exporting to Oman in 2024',
    summary: 'A step-by-step guide covering everything you need to know about exporting goods to Oman.',
    summaryEn: 'A step-by-step guide covering everything you need to know about exporting goods to Oman.',
    content: 'Oman is one of the most strategic trade destinations in the Gulf region...\n\nKey Steps:\n1. Obtain an export license\n2. Register your export order\n3. Prepare customs documentation\n\nRequired Documents:\n- Commercial Invoice\n- Bill of Lading\n- Certificate of Origin\n- Packing List',
    contentEn: 'Oman is one of the most strategic trade destinations in the Gulf region...\n\nKey Steps:\n1. Obtain an export license\n2. Register your export order\n3. Prepare customs documentation\n\nRequired Documents:\n- Commercial Invoice\n- Bill of Lading\n- Certificate of Origin\n- Packing List',
    category: 'راهنما و آموزش', tags: ['oman', 'export', 'customs'],
    author: 'Tohid Dayhami Team', publishedAt: '2024-03-15T10:00:00.000Z',
    isPublished: true, coverImage: '', viewCount: 0,
    metaDescription: 'Step-by-step guide for exporting to Oman — documents, customs and trade opportunities.',
    metaKeywords: 'export to Oman, Oman customs, Gulf trade'
  },
  {
    id: 'news_en_002', slug: 'eu-packaging-standards-exporters',
    title: 'EU Packaging Standards Every Exporter Must Know',
    titleEn: 'EU Packaging Standards Every Exporter Must Know',
    summary: 'Entering European markets requires strict packaging compliance. This article outlines the key standards.',
    summaryEn: 'Entering European markets requires strict packaging compliance. This article outlines the key standards.',
    content: 'The European Union enforces some of the world\'s most rigorous packaging standards...\n\nCore Requirements:\n- Labeling in the destination country\'s language\n- Expiry date and production batch codes\n- Environmental compliance\n\nRequired Certifications:\n- CE Marking\n- ISO 22000 for food products\n- REACH for chemicals',
    contentEn: 'The European Union enforces some of the world\'s most rigorous packaging standards...\n\nCore Requirements:\n- Labeling in the destination country\'s language\n- Expiry date and production batch codes\n- Environmental compliance\n\nRequired Certifications:\n- CE Marking\n- ISO 22000 for food products\n- REACH for chemicals',
    category: 'قوانین و مقررات', tags: ['packaging', 'EU', 'standards'],
    author: 'Tohid Dayhami Team', publishedAt: '2024-03-20T08:00:00.000Z',
    isPublished: true, coverImage: '', viewCount: 0,
    metaDescription: 'EU packaging standards for exporters — CE marking, ISO 22000, and labeling requirements.',
    metaKeywords: 'EU packaging standards, CE marking, export compliance'
  }
];

const downloadJson = (data: NewsArticle[], filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

interface Props {
  articles: NewsArticle[];
}

const CATEGORIES = ['اخبار صادرات', 'بازارهای هدف', 'قوانین و مقررات', 'موفقیت‌های مشتریان', 'راهنما و آموزش', 'سایر'];

const emptyForm = (): Partial<NewsArticle> => ({
  title: '', titleEn: '',
  slug: '',
  summary: '', summaryEn: '',
  content: '', contentEn: '',
  category: 'اخبار صادرات',
  tags: [],
  publishedAt: new Date().toISOString().split('T')[0],
  isPublished: false,
  coverImage: '',
  author: '',
  viewCount: 0,
  metaDescription: '',
  metaKeywords: '',
});

export const NewsManager: React.FC<Props> = ({ articles }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<NewsArticle>>(emptyForm());
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'form'>('list');
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as NewsArticle[];
      if (!Array.isArray(data)) { alert('فرمت JSON نادرست است. باید آرایه باشد.'); return; }
      let count = 0;
      for (const item of data) {
        if (!item.title || !item.content) continue;
        const article: NewsArticle = {
          id:              item.id || `news_${Date.now()}_${count}`,
          slug:            item.slug || item.title.replace(/\s+/g, '-'),
          title:           item.title,
          titleEn:         item.titleEn || '',
          summary:         item.summary || '',
          summaryEn:       item.summaryEn || '',
          content:         item.content,
          contentEn:       item.contentEn || '',
          category:        item.category || 'سایر',
          tags:            Array.isArray(item.tags) ? item.tags : [],
          author:          item.author || 'تیم توحید دیهمی',
          publishedAt:     item.publishedAt || new Date().toISOString(),
          isPublished:     item.isPublished ?? false,
          coverImage:      item.coverImage || '',
          viewCount:       item.viewCount ?? 0,
          metaDescription: item.metaDescription || '',
          metaKeywords:    item.metaKeywords || '',
        };
        await saveNewsArticleToCloud(article);
        count++;
      }
      alert(`${count} مقاله با موفقیت وارد شد.`);
    } catch (err: any) {
      alert('خطا در خواندن فایل: ' + err.message);
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleEdit = (article: NewsArticle) => {
    setForm({ ...article });
    setTagsInput((article.tags || []).join(', '));
    setEditingId(article.id);
    setActiveTab('form');
  };

  const handleNew = () => {
    setForm(emptyForm());
    setTagsInput('');
    setEditingId(null);
    setActiveTab('form');
  };

  const handleSave = async () => {
    if (!form.title?.trim() || !form.content?.trim()) {
      alert('عنوان و محتوا الزامی است.');
      return;
    }
    setSaving(true);
    try {
      const id = editingId || `news_${Date.now()}`;
      const slug = form.slug?.trim() || form.title!.replace(/\s+/g, '-').replace(/[^\w؀-ۿ-]/g, '');
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const article: NewsArticle = {
        id, slug, tags,
        title: form.title!,
        titleEn: form.titleEn || '',
        summary: form.summary || '',
        summaryEn: form.summaryEn || '',
        content: form.content!,
        contentEn: form.contentEn || '',
        category: form.category || 'اخبار صادرات',
        publishedAt: form.publishedAt || new Date().toISOString(),
        isPublished: form.isPublished ?? false,
        coverImage: form.coverImage || '',
        author: form.author || 'تیم توحید دیهمی',
        viewCount: form.viewCount ?? 0,
        metaDescription: form.metaDescription || '',
        metaKeywords: form.metaKeywords || '',
      };
      await saveNewsArticleToCloud(article);
      setActiveTab('list');
      setEditingId(null);
      setForm(emptyForm());
    } catch (e: any) {
      alert('خطا در ذخیره: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`حذف مقاله "${title}"؟`)) return;
    await deleteNewsArticleFromCloud(id);
  };

  const inp = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-gray-400 bg-white";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">مدیریت اخبار و مقالات</h2>
          <p className="text-xs text-gray-400 mt-0.5">{articles.length} مقاله — {articles.filter(a => a.isPublished).length} منتشر شده</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => downloadJson(SAMPLE_FA, 'news-sample-fa.json')}
            className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 text-gray-500 text-xs rounded-lg hover:bg-gray-50 transition-colors"
          >
            ↓ سمپل فارسی
          </button>
          <button
            onClick={() => downloadJson(SAMPLE_EN, 'news-sample-en.json')}
            className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 text-gray-500 text-xs rounded-lg hover:bg-gray-50 transition-colors"
          >
            ↓ Sample EN
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <IconUpload className="w-4 h-4" />
            {importing ? 'در حال وارد کردن...' : 'Import JSON'}
          </button>
          <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportJson} />
          <button onClick={handleNew}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-black transition-colors">
            <IconPlus className="w-4 h-4" /> مقاله جدید
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {(['list', 'form'] as const).map(tab => (
          <button key={tab} onClick={() => { if (tab === 'list') { setEditingId(null); setForm(emptyForm()); } setActiveTab(tab); }}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${activeTab === tab ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
            {tab === 'list' ? 'لیست مقالات' : (editingId ? 'ویرایش مقاله' : 'مقاله جدید')}
          </button>
        ))}
      </div>

      {/* List Tab */}
      {activeTab === 'list' && (
        <div className="space-y-2">
          {articles.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <IconNewspaper className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">هنوز مقاله‌ای ثبت نشده.</p>
            </div>
          )}
          {articles.map(article => (
            <div key={article.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl bg-white hover:border-gray-200 transition-colors">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 shrink-0">
                {article.coverImage
                  ? <img src={article.coverImage} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><IconImage className="w-5 h-5 text-gray-300" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${article.isPublished ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <p className="text-sm font-medium text-gray-900 truncate">{article.title}</p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span>{article.category}</span>
                  <span>·</span>
                  <span dir="ltr">{article.publishedAt?.split('T')[0]}</span>
                  <span>·</span>
                  <span>{article.isPublished ? 'منتشر شده' : 'پیش‌نویس'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleEdit(article)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                  <IconEdit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(article.id, article.title)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                  <IconTrash className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Tab */}
      {activeTab === 'form' && (
        <div className="space-y-4">

          {/* Basic Info */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">اطلاعات اصلی</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">عنوان (فارسی) *</label>
                <input className={inp} value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="عنوان مقاله" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title (English)</label>
                <input className={`${inp} dir-ltr`} value={form.titleEn || ''} onChange={e => setForm(p => ({ ...p, titleEn: e.target.value }))} placeholder="Article title in English" dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">دسته‌بندی</label>
                <select className={inp} value={form.category || ''} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">نویسنده</label>
                <input className={inp} value={form.author || ''} onChange={e => setForm(p => ({ ...p, author: e.target.value }))} placeholder="نام نویسنده" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">تاریخ انتشار</label>
                <input type="date" className={`${inp} dir-ltr`} value={form.publishedAt?.split('T')[0] || ''} onChange={e => setForm(p => ({ ...p, publishedAt: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">آدرس تصویر کاور (URL)</label>
                <input className={`${inp} dir-ltr`} value={form.coverImage || ''} onChange={e => setForm(p => ({ ...p, coverImage: e.target.value }))} placeholder="https://..." dir="ltr" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">تگ‌ها (جداشده با کاما)</label>
              <input className={inp} value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="صادرات، عمان، گمرک" />
            </div>
          </div>

          {/* Summary */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">خلاصه</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">خلاصه (فارسی)</label>
              <textarea className={inp} rows={2} value={form.summary || ''} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="خلاصه‌ای کوتاه از مقاله..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Summary (English)</label>
              <textarea className={`${inp} dir-ltr`} rows={2} value={form.summaryEn || ''} onChange={e => setForm(p => ({ ...p, summaryEn: e.target.value }))} placeholder="Short article summary..." dir="ltr" />
            </div>
          </div>

          {/* Content */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">محتوای مقاله</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">متن کامل (فارسی) *</label>
              <textarea className={inp} rows={10} value={form.content || ''} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="متن کامل مقاله را اینجا بنویسید..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Content (English)</label>
              <textarea className={`${inp} dir-ltr`} rows={6} value={form.contentEn || ''} onChange={e => setForm(p => ({ ...p, contentEn: e.target.value }))} placeholder="Full article content in English..." dir="ltr" />
            </div>
          </div>

          {/* SEO */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">سئو مقاله</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">توضیحات متا (Meta Description)</label>
              <textarea className={inp} rows={2} value={form.metaDescription || ''} onChange={e => setForm(p => ({ ...p, metaDescription: e.target.value }))} placeholder="توضیح کوتاه برای موتورهای جستجو (زیر ۱۶۰ کاراکتر)" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">کلمات کلیدی متا</label>
              <input className={inp} value={form.metaKeywords || ''} onChange={e => setForm(p => ({ ...p, metaKeywords: e.target.value }))} placeholder="صادرات، بازرگانی، عمان" />
            </div>
          </div>

          {/* Publish toggle + Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setForm(p => ({ ...p, isPublished: !p.isPublished }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${form.isPublished ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.isPublished ? 'start-5' : 'start-0.5'}`} />
              </div>
              <span className="text-sm text-gray-700">{form.isPublished ? 'منتشر شده' : 'پیش‌نویس'}</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setActiveTab('list')} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors">
                انصراف
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-black transition-colors disabled:opacity-50">
                {saving ? '...' : <><IconCheck className="w-4 h-4" /> ذخیره مقاله</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
