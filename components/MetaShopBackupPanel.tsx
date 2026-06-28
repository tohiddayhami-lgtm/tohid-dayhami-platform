import React, { useCallback, useEffect, useState } from 'react';
import { MetaShop, MetaShopBackupMeta, MetaShopBackupSlotNum } from '../types';
import { META_SHOP_BACKUP_SLOT_NUMS } from '../utils/metaShopBackup';
import {
  hydrateMetaShopBackup,
  listMetaShopBackupSlots,
  saveMetaShopBackupSlot,
} from '../services/firebaseService';
import { IconRefreshCw, IconCheck } from './Icons';

interface Props {
  shop: MetaShop;
  T: boolean;
  actorName: string;
  productsReady: boolean;
  productsLoading?: boolean;
  onSaveShop: (shop: MetaShop) => Promise<void>;
  onDraftReplace: (shop: MetaShop) => void;
}

export const MetaShopBackupPanel: React.FC<Props> = ({
  shop, T, actorName, productsReady, productsLoading, onSaveShop, onDraftReplace,
}) => {
  const [slots, setSlots] = useState<(MetaShopBackupMeta | null)[]>([null, null, null]);
  const [loading, setLoading] = useState(false);
  const [busySlot, setBusySlot] = useState<MetaShopBackupSlotNum | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSlots(await listMetaShopBackupSlots(shop.id));
    } finally {
      setLoading(false);
    }
  }, [shop.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const slotLabel = (slot: MetaShopBackupSlotNum) =>
    T ? `سیو پایه ${slot}` : `Base save ${slot}`;

  const saveSlot = async (slot: MetaShopBackupSlotNum) => {
    if (!productsReady || productsLoading) {
      alert(T ? 'ابتدا صبر کنید تا همه محصولات بارگذاری شوند.' : 'Wait until all products are loaded.');
      return;
    }
    const note = window.prompt(
      T ? `یادداشت برای ${slotLabel(slot)} (اختیاری):` : `Note for ${slotLabel(slot)} (optional):`,
      slots[slot - 1]?.label || '',
    );
    if (note === null) return;
    if (!window.confirm(
      T
        ? `وضعیت فعلی فروشگاه در ${slotLabel(slot)} ذخیره شود؟ (${shop.products.length} محصول)`
        : `Save current shop state to ${slotLabel(slot)}? (${shop.products.length} products)`,
    )) return;

    setBusySlot(slot);
    try {
      await saveMetaShopBackupSlot(shop, slot, actorName, note || undefined);
      await refresh();
      alert(T ? 'بکاپ ذخیره شد.' : 'Backup saved.');
    } catch (e) {
      alert(e instanceof Error ? e.message : (T ? 'خطا در ذخیره بکاپ' : 'Backup save failed'));
    } finally {
      setBusySlot(null);
    }
  };

  const restoreSlot = async (slot: MetaShopBackupSlotNum) => {
    const meta = slots[slot - 1];
    if (!meta) {
      alert(T ? 'این اسلات خالی است.' : 'This slot is empty.');
      return;
    }
    const when = new Date(meta.savedAt).toLocaleString(T ? 'fa-IR' : 'en-US');
    if (!window.confirm(
      T
        ? `فروشگاه به ${slotLabel(slot)} برگردد؟\n${when} — ${meta.productCount} محصول\n\nوضعیت فعلی جایگزین می‌شود.`
        : `Restore ${slotLabel(slot)}?\n${when} — ${meta.productCount} products\n\nCurrent state will be replaced.`,
    )) return;

    setBusySlot(slot);
    try {
      const restored = await hydrateMetaShopBackup(shop.id, slot);
      if (!restored?.products) throw new Error(T ? 'بکاپ یافت نشد.' : 'Backup not found.');
      onDraftReplace(restored);
      await onSaveShop(restored);
      alert(T ? 'بازیابی انجام شد و فروشگاه ذخیره شد.' : 'Restored and saved.');
    } catch (e) {
      alert(e instanceof Error ? e.message : (T ? 'خطا در بازیابی' : 'Restore failed'));
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-amber-900">
            {T ? 'سیو پایه / بکاپ (۳ اسلات)' : 'Base save / backup (3 slots)'}
          </h4>
          <p className="text-[11px] text-amber-800/90 mt-0.5">
            {T
              ? 'هر اسلات یک تصویر کامل از فروشگاه + محصولات است. در صورت به‌هم‌ریختگی، بازیابی کنید.'
              : 'Each slot is a full snapshot. Restore if something goes wrong.'}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="text-[11px] px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-800 hover:bg-amber-100 flex items-center gap-1"
        >
          <IconRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {T ? 'بروزرسانی' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {META_SHOP_BACKUP_SLOT_NUMS.map(slot => {
          const meta = slots[slot - 1];
          const busy = busySlot === slot;
          return (
            <div key={slot} className="bg-white border border-amber-100 rounded-lg p-3 flex flex-col gap-2 min-h-[120px]">
              <div className="font-semibold text-xs text-amber-900">{slotLabel(slot)}</div>
              {meta ? (
                <div className="text-[10px] text-gray-500 space-y-0.5 flex-1">
                  <div dir="ltr">{new Date(meta.savedAt).toLocaleString(T ? 'fa-IR' : 'en-US')}</div>
                  <div>{meta.productCount} {T ? 'محصول' : 'products'}</div>
                  {meta.label && <div className="text-amber-700 truncate" title={meta.label}>{meta.label}</div>}
                  <div className="text-gray-400">{meta.savedBy}</div>
                </div>
              ) : (
                <div className="text-[10px] text-gray-400 flex-1">{T ? 'خالی' : 'Empty'}</div>
              )}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={busy || !productsReady || productsLoading}
                  onClick={() => saveSlot(slot)}
                  className="flex-1 min-w-[70px] text-[10px] px-2 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 font-medium"
                >
                  {busy ? '…' : (T ? 'ذخیره' : 'Save')}
                </button>
                <button
                  type="button"
                  disabled={busy || !meta}
                  onClick={() => restoreSlot(slot)}
                  className="flex-1 min-w-[70px] text-[10px] px-2 py-1.5 rounded-lg border border-amber-400 text-amber-900 hover:bg-amber-50 disabled:opacity-40 font-medium flex items-center justify-center gap-0.5"
                >
                  <IconRefreshCw className="w-3 h-3" />
                  {T ? 'بازیابی' : 'Restore'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!productsReady && (
        <p className="text-[10px] text-amber-700 flex items-center gap-1">
          <IconCheck className="w-3 h-3 opacity-50" />
          {T ? 'برای ذخیره بکاپ، بارگذاری کامل محصولات لازم است.' : 'Full product load required before saving a backup.'}
        </p>
      )}
    </div>
  );
};
