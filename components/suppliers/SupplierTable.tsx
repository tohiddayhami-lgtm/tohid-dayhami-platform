import React from 'react';
import type { GlobalSupplier, SupplierColumnKey, SupplierCountryOption } from '../../types/supplier';
import { COLUMN_LABELS } from '../../utils/supplierFilters';
import { STATUS_LABELS } from '../../utils/supplierConstants';
import { resolveCountryFromList } from '../../utils/supplierLists';
import { supplierDisplayScore, supplierHasNotes } from '../../utils/supplierAccess';
import { IconStar, IconFlag, IconNote, IconAlertTriangle } from '../Icons';

interface Props {
  rows: GlobalSupplier[];
  columns: SupplierColumnKey[];
  countries: SupplierCountryOption[];
  selected: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onOpen: (s: GlobalSupplier) => void;
  onToggleFlag: (s: GlobalSupplier, key: keyof GlobalSupplier['flags']) => void;
  lang: 'fa' | 'en';
}

const fmtDate = (iso?: string, lang?: 'fa' | 'en') => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US');
  } catch {
    return '—';
  }
};

const Stars: React.FC<{ value: number }> = ({ value }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <IconStar key={i} className={`w-3 h-3 ${i <= Math.round(value) ? 'text-amber-400' : 'text-gray-200'}`} />
    ))}
    <span className="text-[10px] font-bold text-gray-500 mr-1">{value.toFixed(1)}</span>
  </div>
);

export const SupplierTable: React.FC<Props> = ({
  rows, columns, countries, selected, onSelect, onSelectAll, onOpen, onToggleFlag, lang,
}) => {
  const allIds = rows.map(r => r.id);
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));

  const renderCell = (s: GlobalSupplier, col: SupplierColumnKey) => {
    const country = resolveCountryFromList(countries, s.general.countryCode || s.general.country);
    switch (col) {
      case 'companyName':
        return (
          <div className="flex items-center gap-2 min-w-[160px]">
            {s.general.logoUrl ? (
              <img src={s.general.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover border" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-black text-gray-400">
                {(s.companyName || '?')[0]}
              </div>
            )}
            <div>
              <div className="font-bold text-gray-800">{s.companyName || '—'}</div>
              <div className="flex gap-1 mt-0.5">
                {s.flags.favorite && <IconStar className="w-3 h-3 text-amber-400" />}
                {s.flags.topSupplier && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded">TOP</span>}
                {s.flags.blacklisted && <span className="text-[9px] bg-red-100 text-red-700 px-1 rounded">BL</span>}
                {s.flags.needsAttention && <IconAlertTriangle className="w-3 h-3 text-rose-500" />}
                {s.flags.pinned && <IconFlag className="w-3 h-3 text-indigo-500" />}
              </div>
            </div>
          </div>
        );
      case 'contactPerson': return s.contactPerson || s.contact.mainContactName || '—';
      case 'country': return <span>{country.flag} {country.name}</span>;
      case 'city': return s.general.city || '—';
      case 'productCategory': return s.productCategory || '—';
      case 'services': return (s.supplierServices || []).map(x => x.name).slice(0, 2).join(', ') || (s.serviceTypes || []).slice(0, 2).join(', ') || '—';
      case 'email': return <span className="dir-ltr text-xs">{s.email || '—'}</span>;
      case 'phone': return <span className="dir-ltr text-xs">{s.phone || '—'}</span>;
      case 'whatsapp': return <span className="dir-ltr text-xs">{s.whatsapp || '—'}</span>;
      case 'website': return s.website ? <a href={s.website} target="_blank" rel="noreferrer" className="text-blue-600 text-xs truncate max-w-[120px] inline-block">{s.website}</a> : '—';
      case 'status': {
        const st = STATUS_LABELS[s.status];
        return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.color}`}>{lang === 'fa' ? st.fa : st.en}</span>;
      }
      case 'rating': return <Stars value={s.rating ?? 0} />;
      case 'score': return <span className="font-black text-gray-700">{supplierDisplayScore(s).toFixed(1)}</span>;
      case 'tags':
        return (
          <div className="flex flex-wrap gap-1 max-w-[180px]">
            {s.tags.slice(0, 3).map(t => (
              <span key={t.id} className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: t.color }}>{t.label}</span>
            ))}
            {s.tags.length > 3 && <span className="text-[9px] text-gray-400">+{s.tags.length - 3}</span>}
          </div>
        );
      case 'lastContact': return fmtDate(s.lastContact, lang);
      case 'createdAt': return fmtDate(s.createdAt, lang);
      case 'notes': return supplierHasNotes(s) ? <IconNote className="w-4 h-4 text-indigo-500" /> : '—';
      default: return '—';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-3 w-10">
                <input type="checkbox" checked={allSelected} onChange={() => onSelectAll(allSelected ? [] : allIds)} />
              </th>
              {columns.map(col => (
                <th key={col} className="p-3 text-right text-[11px] font-black text-gray-500 whitespace-nowrap">
                  {lang === 'fa' ? COLUMN_LABELS[col].fa : COLUMN_LABELS[col].en}
                </th>
              ))}
              <th className="p-3 text-[11px] font-black text-gray-500">{lang === 'fa' ? 'عملیات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 2} className="p-8 text-center text-gray-400 text-sm">{lang === 'fa' ? 'تأمین‌کننده‌ای یافت نشد' : 'No suppliers found'}</td></tr>
            )}
            {rows.map(s => (
              <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/80 cursor-pointer" onClick={() => onOpen(s)}>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => onSelect(s.id)} />
                </td>
                {columns.map(col => (
                  <td key={col} className="p-3 text-gray-600 align-middle">{renderCell(s, col)}</td>
                ))}
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button type="button" title="Favorite" onClick={() => onToggleFlag(s, 'favorite')} className="p-1.5 rounded-lg hover:bg-amber-50">
                      <IconStar className={`w-4 h-4 ${s.flags.favorite ? 'text-amber-500' : 'text-gray-300'}`} />
                    </button>
                    <button type="button" title="Top" onClick={() => onToggleFlag(s, 'topSupplier')} className="p-1.5 rounded-lg hover:bg-violet-50 text-[10px] font-black text-violet-600">TOP</button>
                    <button type="button" title="Flag" onClick={() => onToggleFlag(s, 'flagged')} className="p-1.5 rounded-lg hover:bg-rose-50">
                      <IconFlag className={`w-4 h-4 ${s.flags.flagged ? 'text-rose-500' : 'text-gray-300'}`} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
