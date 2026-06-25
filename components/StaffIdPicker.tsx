import React, { useMemo, useState } from 'react';
import { Personnel } from '../types';
import { getStaffCode, findPersonnelByQuery, formatPersonnelLabel } from '../services/staffId';
import { Language } from '../App';

interface Props {
  personnel: Personnel[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  lang: Language;
  currentUserId?: string;   // when set, this person cannot be added (used for messaging recipients)
  className?: string;
  showRoster?: boolean;     // dropdown list of all personnel (name + ID)
}

// Add people by name or personnel ID. Chips and lists always show name + ID together.
export const StaffIdPicker: React.FC<Props> = ({
  personnel, selectedIds, onChange, lang, currentUserId, className, showRoster = true,
}) => {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const fa = lang === 'fa';

  const t = {
    placeholder: fa ? 'نام یا آی‌دی پرسنلی را وارد کنید' : 'Enter name or personnel ID',
    rosterPlaceholder: fa ? '— انتخاب از لیست پرسنل —' : '— Select from roster —',
    add: fa ? 'افزودن' : 'Add',
    notFound: fa ? 'پرسنلی با این نام یا آی‌دی یافت نشد.' : 'No personnel found with this name or ID.',
    self: fa ? 'نمی‌توانید خودتان را اضافه کنید.' : 'You cannot add yourself.',
    multipleMatch: fa ? 'چند پرسنل یافت شد — دقیق‌تر تایپ کنید یا از لیست انتخاب کنید.' : 'Multiple matches — be more specific or pick from the list.',
  };

  const available = useMemo(
    () => personnel.filter(p => !selectedIds.includes(p.id) && p.id !== currentUserId),
    [personnel, selectedIds, currentUserId],
  );

  const addPerson = (person: Personnel) => {
    if (currentUserId && person.id === currentUserId) { setError(t.self); return; }
    if (!selectedIds.includes(person.id)) onChange([...selectedIds, person.id]);
    setQuery(''); setError('');
  };

  const addFromQuery = () => {
    const person = findPersonnelByQuery(personnel, query);
    if (!person) {
      const q = query.trim().toLowerCase();
      const partial = personnel.filter(p => p.fullName.toLowerCase().includes(q));
      if (partial.length > 1) { setError(t.multipleMatch); return; }
      setError(t.notFound);
      return;
    }
    addPerson(person);
  };

  const remove = (id: string) => onChange(selectedIds.filter(x => x !== id));

  const match = query.trim() ? findPersonnelByQuery(personnel, query) : undefined;

  return (
    <div className={className}>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedIds.map(id => {
            const p = personnel.find(pp => pp.id === id);
            if (!p) return (
              <span key={id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-400 text-white">
                {id}
                <button type="button" onClick={() => remove(id)} className="hover:text-white/70">✕</button>
              </span>
            );
            return (
              <span key={id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white">
                <span>{p.fullName}</span>
                <span className="font-mono text-[10px] opacity-85" dir="ltr">{getStaffCode(p)}</span>
                <button type="button" onClick={() => remove(id)} className="hover:text-white/70">✕</button>
              </span>
            );
          })}
        </div>
      )}

      {showRoster && available.length > 0 && (
        <select
          value=""
          onChange={e => {
            const p = personnel.find(pp => pp.id === e.target.value);
            if (p) addPerson(p);
          }}
          className="w-full mb-2 text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 bg-white"
        >
          <option value="">{t.rosterPlaceholder}</option>
          {available.map(p => (
            <option key={p.id} value={p.id}>{formatPersonnelLabel(p, { withRole: true })}</option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFromQuery(); } }}
          placeholder={t.placeholder}
          className="flex-1 min-w-0 text-sm text-gray-800 placeholder-gray-300 border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
        />
        <button type="button" onClick={addFromQuery}
          className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-black transition-colors shrink-0">
          {t.add}
        </button>
      </div>
      {query.trim() && !error && (
        match
          ? <p className="text-[11px] text-emerald-600 mt-1.5">✓ {formatPersonnelLabel(match)}</p>
          : <p className="text-[11px] text-gray-400 mt-1.5">{t.notFound}</p>
      )}
      {error && <p className="text-[11px] text-red-500 mt-1.5">{error}</p>}
    </div>
  );
};
