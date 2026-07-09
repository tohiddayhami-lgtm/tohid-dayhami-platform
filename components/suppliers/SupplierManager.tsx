import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { Personnel } from '../../types';
import type { GlobalSupplier, SupplierListFilters, SupplierListSettings, SupplierMergedLists } from '../../types/supplier';
import { Language } from '../../App';
import { subscribeToSuppliers, saveSupplierToCloud, updateSupplierInCloud, softDeleteSupplierFromCloud, subscribeToSupplierListSettings } from '../../services/supplierService';
import { getSupplierPermissions } from '../../utils/supplierAccess';
import { filterSuppliers, paginate, DEFAULT_COLUMNS, SupplierColumnKey } from '../../utils/supplierFilters';
import { emptySupplier, syncSupplierTopFields } from '../../utils/supplierUtils';
import { buildSupplierLists, emptySupplierListSettings } from '../../utils/supplierLists';
import { SupplierWidgets } from './SupplierWidgets';
import { SupplierFilterBar } from './SupplierFilterBar';
import { SupplierTable } from './SupplierTable';
import { SupplierProfilePanel } from './SupplierProfilePanel';
import { SupplierListSettingsPanel } from './SupplierListSettingsPanel';
import { IconPlus, IconTrash, IconBriefcase, IconList, IconRefreshCw, IconSettings } from '../Icons';

interface Props {
  currentUser: Personnel;
  personnel: Personnel[];
  lang: Language;
}

const PAGE_SIZE = 20;

const defaultFilters = (): SupplierListFilters => ({
  search: '',
  countries: [],
  categories: [],
  serviceTypes: [],
  statuses: [],
  tags: [],
});

export const SupplierManager: React.FC<Props> = ({ currentUser, personnel, lang }) => {
  const [suppliers, setSuppliers] = useState<GlobalSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SupplierListFilters>(defaultFilters());
  const [page, setPage] = useState(1);
  const [columns, setColumns] = useState<SupplierColumnKey[]>(DEFAULT_COLUMNS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<GlobalSupplier | null>(null);
  const [showWidgets, setShowWidgets] = useState(true);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showListSettings, setShowListSettings] = useState(false);
  const [listSettings, setListSettings] = useState<SupplierListSettings>(emptySupplierListSettings());

  const permissions = getSupplierPermissions(currentUser);
  const isFa = lang === 'fa';

  const lists = useMemo(() => buildSupplierLists(listSettings, suppliers), [listSettings, suppliers]);

  useEffect(() => {
    const unsub = subscribeToSuppliers(list => {
      setSuppliers(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToSupplierListSettings(setListSettings);
    return () => unsub();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfile(null);
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        document.getElementById('supplier-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const serviceOptions = lists.serviceTypes;

  const filtered = useMemo(() => filterSuppliers(suppliers, filters), [suppliers, filters]);
  const { items: pageItems, total, pages } = useMemo(() => paginate(filtered, page, PAGE_SIZE), [filtered, page]);

  useEffect(() => { setPage(1); }, [filters]);

  const handleCreate = async () => {
    const s = emptySupplier({ fullName: currentUser.fullName, id: currentUser.id });
    await saveSupplierToCloud(s, currentUser);
    setProfile(s);
  };

  const handleSave = useCallback(async (s: GlobalSupplier) => {
    const payload = syncSupplierTopFields(s);
    const exists = suppliers.some(x => x.id === s.id && !x.deletedAt);
    if (exists) {
      await updateSupplierInCloud(s.id, payload, currentUser, `بروزرسانی: ${payload.companyName}`);
    } else {
      await saveSupplierToCloud(payload, currentUser);
    }
    setProfile(payload);
  }, [currentUser, suppliers]);

  const handleToggleFlag = async (s: GlobalSupplier, key: keyof GlobalSupplier['flags']) => {
    if (!permissions.canEdit) return;
    const flags = { ...s.flags, [key]: !s.flags[key] };
    await updateSupplierInCloud(s.id, { flags }, currentUser);
  };

  const handleBulkDelete = async () => {
    if (!permissions.canDelete || selected.size === 0) return;
    if (!window.confirm(isFa ? `حذف ${selected.size} تأمین‌کننده؟` : `Delete ${selected.size} suppliers?`)) return;
    await Promise.all(Array.from(selected).map(id => softDeleteSupplierFromCloud(id, currentUser)));
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleColumn = (col: SupplierColumnKey) => {
    setColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  if (!permissions.canView) {
    return (
      <div className="p-8 text-center text-gray-400">
        {isFa ? 'دسترسی به ماژول تأمین‌کنندگان ندارید.' : 'You do not have access to Suppliers.'}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gray-900 text-white flex items-center justify-center">
            <IconBriefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">{isFa ? 'مدیریت تأمین‌کنندگان' : 'Supplier Management'}</h1>
            <p className="text-xs text-gray-400">{isFa ? 'CRM/ERP جهانی تأمین‌کنندگان' : 'Global supplier CRM/ERP'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowWidgets(v => !v)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50">
            {showWidgets ? (isFa ? 'پنهان کردن داشبورد' : 'Hide widgets') : (isFa ? 'نمایش داشبورد' : 'Show widgets')}
          </button>
          <button type="button" onClick={() => setShowListSettings(true)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1">
            <IconSettings className="w-4 h-4" />
            {isFa ? 'لیست‌ها' : 'Lists'}
          </button>
          <button type="button" onClick={() => setShowColumnPicker(v => !v)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1">
            <IconList className="w-4 h-4" />
            {isFa ? 'ستون‌ها' : 'Columns'}
          </button>
          {permissions.canEdit && (
            <button type="button" onClick={handleCreate}
              className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold flex items-center gap-1">
              <IconPlus className="w-4 h-4" />
              {isFa ? 'تأمین‌کننده جدید' : 'New Supplier'}
            </button>
          )}
          {permissions.canDelete && selected.size > 0 && (
            <button type="button" onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-1">
              <IconTrash className="w-4 h-4" />
              {isFa ? `حذف (${selected.size})` : `Delete (${selected.size})`}
            </button>
          )}
        </div>
      </div>

      {showWidgets && <SupplierWidgets suppliers={suppliers} lang={lang} />}

      {showColumnPicker && (
        <div className="bg-white border border-gray-100 rounded-2xl p-3 flex flex-wrap gap-2">
          {DEFAULT_COLUMNS.map(col => (
            <button key={col} type="button" onClick={() => toggleColumn(col)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${columns.includes(col) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
              {col}
            </button>
          ))}
        </div>
      )}

      <SupplierFilterBar filters={filters} onChange={setFilters} lang={lang} serviceOptions={serviceOptions} categories={lists.categories} countries={lists.countries} tags={lists.tags} />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <IconRefreshCw className="w-5 h-5 animate-spin" />
          {isFa ? 'در حال بارگذاری...' : 'Loading...'}
        </div>
      ) : (
        <>
          <SupplierTable
            rows={pageItems}
            columns={columns}
            countries={lists.countries}
            selected={selected}
            onSelect={toggleSelect}
            onSelectAll={ids => setSelected(new Set(ids))}
            onOpen={setProfile}
            onToggleFlag={handleToggleFlag}
            lang={lang}
          />

          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{isFa ? `${total} مورد` : `${total} results`}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 text-xs font-bold">
                {isFa ? 'قبلی' : 'Prev'}
              </button>
              <span className="text-xs font-bold">{page} / {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 text-xs font-bold">
                {isFa ? 'بعدی' : 'Next'}
              </button>
            </div>
          </div>
        </>
      )}

      {profile && (
        <SupplierProfilePanel
          supplier={profile}
          onClose={() => setProfile(null)}
          onSave={handleSave}
          permissions={permissions}
          currentUser={currentUser}
          personnel={personnel}
          lang={lang}
          lists={lists}
        />
      )}

      {showListSettings && (
        <SupplierListSettingsPanel
          settings={listSettings}
          currentUser={currentUser}
          canEdit={permissions.canEdit}
          lang={lang}
          onSaved={setListSettings}
          onClose={() => setShowListSettings(false)}
        />
      )}
    </div>
  );
};
