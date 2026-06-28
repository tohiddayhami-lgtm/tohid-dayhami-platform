import React, { useState } from 'react';
import { MetaShopDirCat, MetaShopProduct } from '../types';
import { Language } from '../App';
import {
  CustomerCategory,
  customerCategoriesList,
  categoryLabelFa,
  addCustomerCategory,
  renameCustomerCategory,
  removeCustomerCategory,
  countProductsInCategory,
} from '../utils/customerMetaShopCategories';
import { IconPlus, IconTrash, IconEdit } from './Icons';

interface Props {
  categories: (string | MetaShopDirCat)[];
  groupI18n: Record<string, Record<string, string>>;
  products: MetaShopProduct[];
  lang: Language;
  activeFilter: string | null;
  onFilterChange: (key: string | null) => void;
  onCategoriesChange: (categories: (string | MetaShopDirCat)[], groupI18n: Record<string, Record<string, string>>, products: MetaShopProduct[]) => void;
}

export const CustomerMetaShopCategoryManager: React.FC<Props> = ({
  categories, groupI18n, products, lang, activeFilter, onFilterChange, onCategoriesChange,
}) => {
  const T = lang === 'fa';
  const [showAdd, setShowAdd] = useState(false);
  const [newFa, setNewFa] = useState('');
  const [newEn, setNewEn] = useState('');
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editFa, setEditFa] = useState('');
  const [editEn, setEditEn] = useState('');

  const list = customerCategoriesList(categories, groupI18n);
  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500 bg-white';
  const lbl = 'block text-xs font-medium text-gray-500 mb-1';

  const handleAdd = () => {
    if (!newFa.trim()) return;
    const r = addCustomerCategory(categories, groupI18n, newFa, newEn);
    onCategoriesChange(r.categories, r.groupI18n, products);
    setNewFa('');
    setNewEn('');
    setShowAdd(false);
    onFilterChange(newFa.trim());
  };

  const startEdit = (c: CustomerCategory) => {
    setEditKey(c.key);
    setEditFa(c.fa);
    setEditEn(c.en || '');
  };

  const handleSaveEdit = () => {
    if (!editKey || !editFa.trim()) return;
    const r = renameCustomerCategory(categories, groupI18n, products, editKey, editFa, editEn);
    onCategoriesChange(r.categories, r.groupI18n, r.products);
    if (activeFilter === editKey) onFilterChange(editFa.trim());
    setEditKey(null);
  };

  const handleRemove = (c: CustomerCategory) => {
    const n = countProductsInCategory(products, c.key);
    const msg = T
      ? `دسته «${c.fa}» حذف شود؟${n > 0 ? ` (${n} محصول بدون دسته می‌شود)` : ''}`
      : `Delete category "${c.fa}"?${n > 0 ? ` (${n} products become uncategorized)` : ''}`;
    if (!confirm(msg)) return;
    const r = removeCustomerCategory(categories, groupI18n, products, c.key);
    onCategoriesChange(r.categories, r.groupI18n, r.products);
    if (activeFilter === c.key) onFilterChange(null);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-800">{T ? 'دسته‌بندی محصولات' : 'Product categories'}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {T ? 'دسته بسازید و با کلیک فیلتر کنید — روی هر محصول هم دسته انتخاب می‌شود' : 'Create categories, click to filter, assign on each product'}
          </p>
        </div>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
          >
            <IconPlus className="w-3.5 h-3.5" />
            {T ? 'دسته جدید' : 'New category'}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={lbl}>{T ? 'نام دسته (فارسی) *' : 'Category name (FA) *'}</label>
              <input className={fld} placeholder={T ? 'مثلاً: میوه خشک' : 'e.g. Dried fruit'} value={newFa} onChange={e => setNewFa(e.target.value)} autoFocus />
            </div>
            <div>
              <label className={lbl}>{T ? 'نام انگلیسی (اختیاری)' : 'English name (optional)'}</label>
              <input className={fld + ' dir-ltr'} placeholder="Dried fruit" value={newEn} onChange={e => setNewEn(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} disabled={!newFa.trim()} className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
              {T ? 'افزودن' : 'Add'}
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setNewFa(''); setNewEn(''); }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs">
              {T ? 'انصراف' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {editKey && (
        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 space-y-2">
          <p className="text-xs font-semibold text-amber-800">{T ? 'ویرایش دسته' : 'Edit category'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={lbl}>{T ? 'نام فارسی' : 'FA name'}</label>
              <input className={fld} value={editFa} onChange={e => setEditFa(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>{T ? 'نام انگلیسی' : 'EN name'}</label>
              <input className={fld + ' dir-ltr'} value={editEn} onChange={e => setEditEn(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleSaveEdit} className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium">{T ? 'ذخیره' : 'Save'}</button>
            <button type="button" onClick={() => setEditKey(null)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs">{T ? 'انصراف' : 'Cancel'}</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onFilterChange(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            activeFilter === null ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          {T ? 'همه' : 'All'} ({products.length})
        </button>
        {list.map(c => {
          const count = countProductsInCategory(products, c.key);
          const active = activeFilter === c.key;
          return (
            <div key={c.key} className="inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onFilterChange(active ? null : c.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-800 border-indigo-100 hover:bg-indigo-100'
                }`}
              >
                {categoryLabelFa(c, lang)} ({count})
              </button>
              <button type="button" onClick={() => startEdit(c)} className="p-1 text-gray-300 hover:text-amber-600 rounded" title={T ? 'ویرایش' : 'Edit'}>
                <IconEdit className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => handleRemove(c)} className="p-1 text-gray-300 hover:text-red-500 rounded" title={T ? 'حذف' : 'Delete'}>
                <IconTrash className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        {list.length === 0 && !showAdd && (
          <span className="text-xs text-gray-400 py-1">{T ? 'هنوز دسته‌ای ندارید — «دسته جدید» بزنید' : 'No categories yet — tap New category'}</span>
        )}
      </div>
    </div>
  );
};
