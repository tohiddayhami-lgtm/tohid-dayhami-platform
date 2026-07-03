import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { MetaShop, MetaShopMember } from '../types';
import { Language } from '../App';
import {
  fetchMetaShopMembersByShop,
  summarizeMetaShopMembers,
  updateMetaShopMemberAdmin,
} from '../services/metaShopMemberService';
import { resolveMemberVipDiscountPercent } from '../utils/metaShopMemberVip';

interface Props {
  shop: MetaShop;
  lang: Language;
  readonly?: boolean;
  onBack: () => void;
  onSaveShop: (shop: MetaShop) => Promise<void> | void;
}

export const MetaShopMembersManager: React.FC<Props> = ({ shop, lang, readonly, onBack, onSaveShop }) => {
  const T = lang === 'fa';
  const [members, setMembers] = useState<MetaShopMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vipDefault, setVipDefault] = useState(String(shop.vipDefaultDiscountPercent ?? 10));
  const [savingDefault, setSavingDefault] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchMetaShopMembersByShop(shop.id);
      setMembers(rows);
    } finally {
      setLoading(false);
    }
  }, [shop.id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setVipDefault(String(shop.vipDefaultDiscountPercent ?? 10)); }, [shop.id, shop.vipDefaultDiscountPercent]);

  const stats = useMemo(() => summarizeMetaShopMembers(members), [members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m =>
      m.fullName.toLowerCase().includes(q)
      || m.username.toLowerCase().includes(q)
      || m.phone.includes(q)
      || (m.email || '').toLowerCase().includes(q),
    );
  }, [members, search]);

  const saveVipDefault = async () => {
    const n = Math.min(100, Math.max(0, Number(vipDefault) || 0));
    setSavingDefault(true);
    try {
      await onSaveShop({ ...shop, vipDefaultDiscountPercent: n > 0 ? n : undefined });
    } finally {
      setSavingDefault(false);
    }
  };

  const patchMember = async (member: MetaShopMember, updates: Parameters<typeof updateMetaShopMemberAdmin>[1]) => {
    if (readonly) return;
    setBusyId(member.id);
    try {
      const updated = await updateMetaShopMemberAdmin(member, updates);
      setMembers(prev => prev.map(m => (m.id === updated.id ? updated : m)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 mb-1">
            ← {T ? 'بازگشت به فهرست' : 'Back to list'}
          </button>
          <h2 className="text-lg font-bold text-gray-900">
            {T ? 'کاربران فروشگاه' : 'Shop customers'} — {shop.name}
          </h2>
        </div>
        <button type="button" onClick={() => void load()} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
          {T ? 'بروزرسانی' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: T ? 'ثبت‌نام‌شده' : 'Registered', value: stats.total, cls: 'text-gray-900' },
          { label: T ? 'فعال' : 'Active', value: stats.active, cls: 'text-emerald-700' },
          { label: 'VIP', value: stats.vip, cls: 'text-amber-700' },
          { label: T ? 'غیرفعال' : 'Disabled', value: stats.total - stats.active, cls: 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className={`text-2xl font-black ${card.cls}`}>{card.value}</div>
            <div className="text-xs text-gray-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {!readonly && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-bold text-amber-900 mb-1">
              {T ? 'تخفیف پیش‌فرض VIP (%)' : 'Default VIP discount (%)'}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={vipDefault}
              onChange={e => setVipDefault(e.target.value)}
              className="w-24 border border-amber-200 rounded-lg px-3 py-2 text-sm"
              dir="ltr"
            />
          </div>
          <button
            type="button"
            onClick={() => void saveVipDefault()}
            disabled={savingDefault}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50"
          >
            {savingDefault ? '…' : (T ? 'ذخیره' : 'Save')}
          </button>
          <p className="text-xs text-amber-800/80 flex-1 min-w-[200px]">
            {T
              ? 'اعضای VIP این درصد را در checkout می‌گیرند (مگر تخفیف اختصاصی داشته باشند).'
              : 'VIP members get this % off at checkout (unless they have a personal override).'}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={T ? 'جستجو: نام، کاربری، موبایل…' : 'Search name, username, phone…'}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">{T ? 'در حال بارگذاری…' : 'Loading…'}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">
          {members.length === 0
            ? (T ? 'هنوز کاربری ثبت‌نام نکرده است.' : 'No registered customers yet.')
            : (T ? 'نتیجه‌ای یافت نشد.' : 'No matches.')}
        </p>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                  <th className="text-start p-3 font-bold">{T ? 'مشتری' : 'Customer'}</th>
                  <th className="text-start p-3 font-bold">{T ? 'موبایل' : 'Phone'}</th>
                  <th className="text-start p-3 font-bold">{T ? 'ثبت‌نام' : 'Joined'}</th>
                  <th className="text-center p-3 font-bold">VIP</th>
                  <th className="text-center p-3 font-bold">{T ? 'تخفیف %' : 'Discount %'}</th>
                  <th className="text-center p-3 font-bold">{T ? 'وضعیت' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const effPct = resolveMemberVipDiscountPercent(shop, m);
                  const disabled = m.isActive === false;
                  return (
                    <tr key={m.id} className={`border-b border-gray-50 ${disabled ? 'opacity-55' : ''}`}>
                      <td className="p-3">
                        <div className="font-semibold text-gray-900">{m.fullName}</div>
                        <div className="text-xs text-gray-400" dir="ltr">@{m.username}</div>
                        {m.email && <div className="text-xs text-gray-400" dir="ltr">{m.email}</div>}
                      </td>
                      <td className="p-3" dir="ltr">{m.phone}</td>
                      <td className="p-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en')}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          disabled={readonly || busyId === m.id}
                          onClick={() => void patchMember(m, { isVip: !m.isVip })}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
                            m.isVip
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-amber-200'
                          }`}
                        >
                          {m.isVip ? '★ VIP' : (T ? 'عادی' : 'Regular')}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        {m.isVip ? (
                          <input
                            type="number"
                            min={0}
                            max={100}
                            disabled={readonly || busyId === m.id}
                            defaultValue={m.vipDiscountPercent ?? shop.vipDefaultDiscountPercent ?? ''}
                            key={`${m.id}-${m.vipDiscountPercent}-${shop.vipDefaultDiscountPercent}`}
                            onBlur={e => {
                              const v = Number(e.target.value);
                              if (!Number.isFinite(v) || v < 0) return;
                              void patchMember(m, { vipDiscountPercent: v > 0 ? v : undefined });
                            }}
                            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-center text-xs"
                            dir="ltr"
                            title={T ? `موثر: ${effPct}%` : `Effective: ${effPct}%`}
                          />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          disabled={readonly || busyId === m.id}
                          onClick={() => void patchMember(m, { isActive: disabled })}
                          className={`text-xs font-bold px-2 py-1 rounded-lg ${
                            disabled ? 'text-emerald-600 hover:bg-emerald-50' : 'text-red-500 hover:bg-red-50'
                          }`}
                        >
                          {disabled ? (T ? 'فعال‌سازی' : 'Enable') : (T ? 'غیرفعال' : 'Disable')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
