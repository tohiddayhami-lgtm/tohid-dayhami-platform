import React from 'react';
import type { MetaShopRealEstate } from '../types';
import { Language } from '../App';
import { InvoiceAmountInput } from './InvoiceAmountInput';
import { DEAL_TYPE_LABEL, PROPERTY_TYPE_LABEL } from '../utils/metaShopRealEstate';

interface Props {
  value: MetaShopRealEstate | undefined;
  onChange: (re: MetaShopRealEstate) => void;
  lang: Language;
  currency: string;
}

const fld = 'w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-1 focus:ring-indigo-400';
const lbl = 'block text-[11px] font-semibold text-gray-600 mb-0.5';

export const MetaShopRealEstateFields: React.FC<Props> = ({ value, onChange, lang, currency }) => {
  const T = lang === 'fa';
  const re = value || { dealType: 'sale' as const, propertyType: 'apartment' };
  const set = (patch: Partial<MetaShopRealEstate>) => onChange({ ...re, ...patch });
  const linesToArr = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);
  const arrToLines = (a?: string[]) => (a || []).join('\n');

  return (
    <div className="mt-3 border-t border-amber-200 pt-3 space-y-3 bg-amber-50/40 rounded-xl p-3">
      <p className="text-xs font-bold text-amber-900">{T ? '🏠 مشخصات املاک' : '🏠 Property details'}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className={lbl}>{T ? 'نوع معامله' : 'Deal'}</label>
          <select className={fld + ' bg-white'} value={re.dealType} onChange={e => set({ dealType: e.target.value as MetaShopRealEstate['dealType'] })}>
            {Object.entries(DEAL_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{T ? v.fa : v.en}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>{T ? 'نوع ملک' : 'Property type'}</label>
          <select className={fld + ' bg-white'} value={re.propertyType} onChange={e => set({ propertyType: e.target.value })}>
            {Object.entries(PROPERTY_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{T ? v.fa : v.en}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>{T ? 'متراژ (m²)' : 'Area m²'}</label>
          <input type="number" className={fld} value={re.areaSqm ?? ''} onChange={e => set({ areaSqm: parseFloat(e.target.value) || undefined })} />
        </div>
        <div>
          <label className={lbl}>{T ? 'متراژ زمین' : 'Land m²'}</label>
          <input type="number" className={fld} value={re.landAreaSqm ?? ''} onChange={e => set({ landAreaSqm: parseFloat(e.target.value) || undefined })} />
        </div>
        <div>
          <label className={lbl}>{T ? 'خواب' : 'Beds'}</label>
          <input type="number" className={fld} value={re.bedrooms ?? ''} onChange={e => set({ bedrooms: parseInt(e.target.value, 10) || undefined })} />
        </div>
        <div>
          <label className={lbl}>{T ? 'حمام' : 'Baths'}</label>
          <input type="number" className={fld} value={re.bathrooms ?? ''} onChange={e => set({ bathrooms: parseInt(e.target.value, 10) || undefined })} />
        </div>
        <div>
          <label className={lbl}>{T ? 'طبقه' : 'Floor'}</label>
          <input type="number" className={fld} value={re.floor ?? ''} onChange={e => set({ floor: parseInt(e.target.value, 10) || undefined })} />
        </div>
        <div>
          <label className={lbl}>{T ? 'کل طبقات' : 'Total floors'}</label>
          <input type="number" className={fld} value={re.totalFloors ?? ''} onChange={e => set({ totalFloors: parseInt(e.target.value, 10) || undefined })} />
        </div>
        <div>
          <label className={lbl}>{T ? 'سال ساخت' : 'Year built'}</label>
          <input type="number" className={fld} value={re.yearBuilt ?? ''} onChange={e => set({ yearBuilt: parseInt(e.target.value, 10) || undefined })} />
        </div>
        <div>
          <label className={lbl}>{T ? 'نوع سند' : 'Deed'}</label>
          <input className={fld} value={re.documentType || ''} onChange={e => set({ documentType: e.target.value })} placeholder={T ? 'سند تک‌برگ' : 'Freehold'} />
        </div>
        <div>
          <label className={lbl}>{T ? 'شهر' : 'City'}</label>
          <input className={fld} value={re.city || ''} onChange={e => set({ city: e.target.value })} />
        </div>
        <div>
          <label className={lbl}>{T ? 'منطقه' : 'District'}</label>
          <input className={fld} value={re.district || ''} onChange={e => set({ district: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className={lbl}>{T ? 'آدرس کامل' : 'Full address'}</label>
          <input className={fld} value={re.fullAddress || ''} onChange={e => set({ fullAddress: e.target.value })} />
        </div>
        {(re.dealType === 'rent' || re.dealType === 'rent-short') && (
          <>
            <div>
              <label className={lbl}>{T ? 'اجاره ماهانه' : 'Monthly rent'}</label>
              <InvoiceAmountInput value={re.monthlyRent || 0} maxDecimals={0} className={fld + ' dir-ltr bg-white'} onChange={n => set({ monthlyRent: n || undefined, rentCurrency: currency })} />
            </div>
            <div>
              <label className={lbl}>{T ? 'ودیعه / رهن' : 'Deposit'}</label>
              <InvoiceAmountInput value={re.deposit || 0} maxDecimals={0} className={fld + ' dir-ltr bg-white'} onChange={n => set({ deposit: n || undefined })} />
            </div>
          </>
        )}
        {(re.dealType === 'sale' || re.dealType === 'pre-sale') && (
          <div>
            <label className={lbl}>{T ? 'قیمت هر متر' : 'Price/m²'}</label>
            <InvoiceAmountInput value={re.pricePerSqm || 0} maxDecimals={0} className={fld + ' dir-ltr bg-white'} onChange={n => set({ pricePerSqm: n || undefined })} />
          </div>
        )}
        <div>
          <label className={lbl}>{T ? 'پارکینگ' : 'Parking'}</label>
          <input type="number" className={fld} value={re.parkingSpaces ?? ''} onChange={e => set({ parkingSpaces: parseInt(e.target.value, 10) || undefined })} />
        </div>
        <div className="col-span-2 flex flex-wrap gap-3 items-center pt-1">
          <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={!!re.elevator} onChange={e => set({ elevator: e.target.checked })} />{T ? 'آسانسور' : 'Elevator'}</label>
          <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={!!re.balcony} onChange={e => set({ balcony: e.target.checked })} />{T ? 'بالکن' : 'Balcony'}</label>
          <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={!!re.storage} onChange={e => set({ storage: e.target.checked })} />{T ? 'انباری' : 'Storage'}</label>
          <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={!!re.negotiable} onChange={e => set({ negotiable: e.target.checked })} />{T ? 'قابل مذاکره' : 'Negotiable'}</label>
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className={lbl}>{T ? 'امکانات (هر خط یک مورد)' : 'Amenities (one per line)'}</label>
          <textarea rows={2} className={fld} value={arrToLines(re.amenities)} onChange={e => set({ amenities: linesToArr(e.target.value) })} />
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className={lbl}>{T ? 'دسترسی نزدیک (مترو، مدرسه…)' : 'Nearby (one per line)'}</label>
          <textarea rows={2} className={fld} value={arrToLines(re.nearbyPlaces)} onChange={e => set({ nearbyPlaces: linesToArr(e.target.value) })} />
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className={lbl}>{T ? 'رزومه / توضیح تکمیلی ملک' : 'Property resume / extra notes'}</label>
          <textarea rows={3} className={fld} value={arrToLines(re.publicHighlights)} onChange={e => set({ publicHighlights: linesToArr(e.target.value) })} placeholder={T ? 'هر خط یک نکته مهم برای مشتری' : 'One highlight per line'} />
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className={lbl}>{T ? 'لینک نقشه' : 'Map URL'}</label>
          <input className={fld + ' dir-ltr'} value={re.mapUrl || ''} onChange={e => set({ mapUrl: e.target.value })} />
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className={lbl}>{T ? 'تور مجازی' : 'Virtual tour'}</label>
          <input className={fld + ' dir-ltr'} value={re.virtualTourUrl || ''} onChange={e => set({ virtualTourUrl: e.target.value })} />
        </div>
      </div>
      <div className="border-t border-emerald-200 pt-3 mt-1">
        <p className="text-xs font-bold text-emerald-900 mb-2">{T ? '📞 مشاور / تماس این ملک' : '📞 Agent / contact for this property'}</p>
        <p className="text-[10px] text-gray-500 mb-2">{T ? 'خالی بگذارید تا از شماره پیش‌فرض فروشگاه (بخش تماس و فوتر) استفاده شود.' : 'Leave empty to use the shop default (Contact & footer section).'}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className={lbl}>{T ? 'نام مشاور' : 'Agent name'}</label>
            <input className={fld} value={re.agentName || ''} onChange={e => set({ agentName: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>{T ? 'تلفن مشاور' : 'Agent phone'}</label>
            <input className={fld + ' dir-ltr'} value={re.agentPhone || ''} onChange={e => set({ agentPhone: e.target.value })} placeholder="+968 …" />
          </div>
          <div>
            <label className={lbl}>{T ? 'واتس‌اپ مشاور' : 'Agent WhatsApp'}</label>
            <input className={fld + ' dir-ltr'} value={re.agentWhatsapp || ''} onChange={e => set({ agentWhatsapp: e.target.value })} placeholder="+968 …" />
          </div>
        </div>
      </div>
    </div>
  );
};
