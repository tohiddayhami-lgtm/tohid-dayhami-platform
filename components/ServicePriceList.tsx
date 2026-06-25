import React, { useMemo, useState } from 'react';
import type { AppConfig, Currency, Price, ServiceOption, SubService } from '../types';
import { Language } from '../App';
import { IconCheck, IconFileText, IconPlus, IconTrash } from './Icons';
import {
  ALL_CURRENCIES,
  CUR_LABEL,
  collectUsedCurrencies,
  exportPriceListCSV,
  formatPriceAmount,
  normalizePrices,
  openPrintablePriceList,
  servicePrices,
  subPrices,
} from '../utils/servicePriceList';

interface Props {
  services: ServiceOption[];
  onUpdate: (services: ServiceOption[]) => void;
  readonly?: boolean;
  lang: Language;
  config?: AppConfig;
}

const blankPrice = (currency: Currency = 'OMR'): Price => ({ amount: 0, currency });

export const ServicePriceList: React.FC<Props> = ({ services, onUpdate, readonly = false, lang, config }) => {
  const T = lang === 'fa';
  const [activeOnly, setActiveOnly] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPrices, setDraftPrices] = useState<Price[]>([]);
  const [draftSubPrices, setDraftSubPrices] = useState<Record<string, Price[]>>({});

  const filtered = useMemo(
    () => services.filter(s => !activeOnly || s.isActive),
    [services, activeOnly],
  );
  const currencies = useMemo(() => collectUsedCurrencies(filtered), [filtered]);

  const t = {
    title: T ? 'لیست قیمت خدمات' : 'Service price list',
    subtitle: T ? 'ثبت تعرفه به چند ارز و خروجی برای پرسنل' : 'Multi-currency tariffs and staff export',
    activeOnly: T ? 'فقط خدمات فعال' : 'Active services only',
    print: T ? 'چاپ / PDF پرسنل' : 'Print / PDF for staff',
    excel: T ? 'خروجی Excel' : 'Export Excel',
    preview: T ? 'پیش‌نمایش' : 'Preview',
    service: T ? 'خدمت' : 'Service',
    sub: T ? 'زیرخدمت' : 'Sub-service',
    noPrice: T ? 'قیمت ثبت نشده' : 'No price set',
    edit: T ? 'ویرایش قیمت‌ها' : 'Edit prices',
    save: T ? 'ذخیره' : 'Save',
    cancel: T ? 'انصراف' : 'Cancel',
    addCurrency: T ? 'افزودن ارز' : 'Add currency',
    count: (n: number) => T ? `${n} خدمت` : `${n} services`,
  };

  const companyTitle = (T ? config?.appTitle : config?.appTitleEn) || config?.appTitle || (T ? 'شرکت' : 'Company');
  const companySubtitle = T ? config?.appSubtitle : config?.appSubtitleEn;

  const startEdit = (svc: ServiceOption) => {
    setEditingId(svc.id);
    const base = servicePrices(svc);
    setDraftPrices(base.length ? [...base] : [blankPrice(svc.price?.currency || 'OMR')]);
    const subMap: Record<string, Price[]> = {};
    (svc.subServices || []).forEach(sub => {
      const sp = subPrices(sub);
      subMap[sub.id] = sp.length ? [...sp] : [blankPrice(sub.price?.currency || 'OMR')];
    });
    setDraftSubPrices(subMap);
  };

  const cancelEdit = () => { setEditingId(null); setDraftPrices([]); setDraftSubPrices({}); };

  const saveEdit = (svcId: string) => {
    const { prices, price } = normalizePrices(draftPrices);
    onUpdate(services.map(s => {
      if (s.id !== svcId) return s;
      return {
        ...s,
        prices,
        price,
        subServices: (s.subServices || []).map(sub => {
          const subDraft = draftSubPrices[sub.id];
          if (!subDraft) return sub;
          const norm = normalizePrices(subDraft);
          return { ...sub, prices: norm.prices, price: norm.price };
        }),
      };
    }));
    cancelEdit();
  };

  const patchDraftPrice = (idx: number, patch: Partial<Price>) => {
    setDraftPrices(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  };

  const addDraftPrice = () => {
    const used = new Set(draftPrices.map(p => p.currency));
    const next = ALL_CURRENCIES.find(c => !used.has(c)) || 'OMR';
    setDraftPrices(prev => [...prev, blankPrice(next)]);
  };

  const removeDraftPrice = (idx: number) => {
    setDraftPrices(prev => prev.filter((_, i) => i !== idx));
  };

  const patchSubDraft = (subId: string, idx: number, patch: Partial<Price>) => {
    setDraftSubPrices(prev => ({
      ...prev,
      [subId]: (prev[subId] || []).map((p, i) => i === idx ? { ...p, ...patch } : p),
    }));
  };

  const addSubDraftPrice = (subId: string) => {
    const cur = draftSubPrices[subId] || [];
    const used = new Set(cur.map(p => p.currency));
    const next = ALL_CURRENCIES.find(c => !used.has(c)) || 'OMR';
    setDraftSubPrices(prev => ({ ...prev, [subId]: [...cur, blankPrice(next)] }));
  };

  const removeSubDraftPrice = (subId: string, idx: number) => {
    setDraftSubPrices(prev => ({
      ...prev,
      [subId]: (prev[subId] || []).filter((_, i) => i !== idx),
    }));
  };

  const inp = 'w-full px-2.5 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-400 bg-white';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* toolbar */}
      <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">{t.title}</h3>
            <p className="text-indigo-200/80 text-xs mt-1">{t.subtitle} · {t.count(filtered.length)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs bg-white/10 border border-white/15 rounded-xl px-3 py-2 cursor-pointer">
              <input type="checkbox" className="accent-indigo-400" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
              {t.activeOnly}
            </label>
            <button
              type="button"
              onClick={() => exportPriceListCSV(filtered, lang, `price-list-${new Date().toISOString().slice(0, 10)}.csv`)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white/10 border border-white/20 hover:bg-white/20 flex items-center gap-1.5"
            >
              <IconFileText className="w-4 h-4" /> {t.excel}
            </button>
            <button
              type="button"
              onClick={() => openPrintablePriceList(filtered, { lang, companyTitle, companySubtitle, activeOnly })}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-indigo-900 hover:bg-indigo-50 flex items-center gap-1.5 shadow"
            >
              <IconFileText className="w-4 h-4" /> {t.print}
            </button>
          </div>
        </div>
      </div>

      {/* preview table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.preview}</span>
          {currencies.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {currencies.map(c => (
                <span key={c} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {CUR_LABEL[c][T ? 'fa' : 'en']}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-indigo-50/60 text-indigo-900 text-xs">
                <th className="p-3 text-start font-bold w-10">#</th>
                <th className="p-3 text-start font-bold min-w-[200px]">{t.service}</th>
                {currencies.map(c => (
                  <th key={c} className="p-3 text-center font-bold whitespace-nowrap">{CUR_LABEL[c][T ? 'fa' : 'en']}</th>
                ))}
                {!readonly && <th className="p-3 w-24" />}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={3 + currencies.length} className="p-10 text-center text-gray-400 text-sm">{T ? 'خدمتی برای نمایش نیست' : 'No services to show'}</td></tr>
              )}
              {filtered.map((svc, idx) => {
                const isEditing = editingId === svc.id;
                const prices = isEditing ? draftPrices : servicePrices(svc);
                const title = T ? svc.title : (svc.titleEn || svc.title);
                return (
                  <React.Fragment key={svc.id}>
                    <tr className="border-t border-gray-100 hover:bg-slate-50/50">
                      <td className="p-3 text-indigo-600 font-bold text-center">{idx + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-gray-800 flex items-center gap-2">
                          <span>{svc.icon || '✨'}</span>
                          <span>{title}</span>
                        </div>
                        {svc.description && <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{T ? svc.description : (svc.descriptionEn || svc.description)}</p>}
                      </td>
                      {isEditing ? (
                        <td colSpan={currencies.length + (readonly ? 0 : 1)} className="p-3 bg-indigo-50/30">
                          <div className="space-y-3">
                            <div className="space-y-2">
                              {draftPrices.map((p, pi) => (
                                <div key={pi} className="flex flex-wrap items-center gap-2">
                                  <input type="number" min="0" className={`${inp} w-32`} value={p.amount || ''} onChange={e => patchDraftPrice(pi, { amount: +e.target.value })} placeholder={T ? 'مبلغ' : 'Amount'} />
                                  <select className={`${inp} w-28`} value={p.currency} onChange={e => patchDraftPrice(pi, { currency: e.target.value as Currency })}>
                                    {ALL_CURRENCIES.map(c => <option key={c} value={c}>{CUR_LABEL[c][T ? 'fa' : 'en']}</option>)}
                                  </select>
                                  <button type="button" onClick={() => removeDraftPrice(pi)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><IconTrash className="w-4 h-4" /></button>
                                </div>
                              ))}
                              <button type="button" onClick={addDraftPrice} className="text-xs font-bold text-indigo-600 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addCurrency}</button>
                            </div>
                            {(svc.subServices || []).map(sub => {
                              const st = T ? sub.title : (sub.titleEn || sub.title);
                              const subDraft = draftSubPrices[sub.id] || [];
                              return (
                                <div key={sub.id} className="border-t border-indigo-100 pt-3">
                                  <p className="text-xs font-bold text-gray-600 mb-2">{t.sub}: {st}</p>
                                  <div className="space-y-2 pl-3 border-r-2 border-indigo-200">
                                    {subDraft.map((p, pi) => (
                                      <div key={pi} className="flex flex-wrap items-center gap-2">
                                        <input type="number" min="0" className={`${inp} w-28`} value={p.amount || ''} onChange={e => patchSubDraft(sub.id, pi, { amount: +e.target.value })} />
                                        <select className={`${inp} w-24`} value={p.currency} onChange={e => patchSubDraft(sub.id, pi, { currency: e.target.value as Currency })}>
                                          {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <button type="button" onClick={() => removeSubDraftPrice(sub.id, pi)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><IconTrash className="w-3.5 h-3.5" /></button>
                                      </div>
                                    ))}
                                    <button type="button" onClick={() => addSubDraftPrice(sub.id)} className="text-[10px] font-bold text-indigo-600 flex items-center gap-1"><IconPlus className="w-3 h-3" />{t.addCurrency}</button>
                                  </div>
                                </div>
                              );
                            })}
                            <div className="flex gap-2 pt-1">
                              <button type="button" onClick={() => saveEdit(svc.id)} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1"><IconCheck className="w-4 h-4" />{t.save}</button>
                              <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-xl text-gray-500 text-xs font-bold hover:bg-gray-100">{t.cancel}</button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          {currencies.map(c => {
                            const cell = prices.filter(p => p.currency === c);
                            return (
                              <td key={c} className="p-3 text-center">
                                {cell.length ? cell.map(p => (
                                  <div key={p.currency} className="text-xs font-bold text-gray-800 whitespace-nowrap">{formatPriceAmount(p.amount, p.currency, lang)}</div>
                                )) : <span className="text-gray-300">—</span>}
                              </td>
                            );
                          })}
                          {!readonly && (
                            <td className="p-3">
                              <button type="button" onClick={() => startEdit(svc)} className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded-lg whitespace-nowrap">{t.edit}</button>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                    {!isEditing && (svc.subServices || []).map(sub => {
                      const sp = subPrices(sub);
                      const st = T ? sub.title : (sub.titleEn || sub.title);
                      return (
                        <tr key={sub.id} className="border-t border-gray-50 bg-gray-50/40">
                          <td />
                          <td className="p-3 pl-8 text-gray-600 text-xs"><span className="text-indigo-400 mr-1">◦</span>{st}</td>
                          {currencies.map(c => {
                            const cell = sp.filter(p => p.currency === c);
                            return (
                              <td key={c} className="p-3 text-center text-xs text-gray-700">
                                {cell.length ? cell.map(p => (
                                  <div key={p.currency} className="whitespace-nowrap">{formatPriceAmount(p.amount, p.currency, lang)}</div>
                                )) : <span className="text-gray-300">—</span>}
                              </td>
                            );
                          })}
                          {!readonly && <td />}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 text-center">
        {T ? 'برای چاپ و تحویل به پرسنل از دکمه «چاپ / PDF پرسنل» استفاده کنید. خروجی Excel برای ویرایش در اکسل مناسب است.' : 'Use Print/PDF for a formatted handout to staff. Excel export is for spreadsheet editing.'}
      </p>
    </div>
  );
};
