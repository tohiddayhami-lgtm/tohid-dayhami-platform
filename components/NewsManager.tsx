
import React, { useState } from 'react';
import { NewsArticle } from '../types';
import { IconPlus, IconEdit, IconTrash, IconCheck, IconNewspaper, IconImage } from './Icons';
import { saveNewsArticleToCloud, deleteNewsArticleFromCloud } from '../services/firebaseService';

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
  const [activeTab, setActiveTab] = useState<'list' | 'form'>('list');

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
        author: form.author || 'تیم توحید دیهیمی',
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
        <button onClick={handleNew}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-black transition-colors">
          <IconPlus className="w-4 h-4" /> مقاله جدید
        </button>
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
