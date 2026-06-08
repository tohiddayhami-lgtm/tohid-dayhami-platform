import React, { useState } from 'react';
import { Personnel } from '../types';
import { getStaffCode, findPersonnelByCode } from '../services/staffId';
import { Language } from '../App';

interface Props {
  personnel: Personnel[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  lang: Language;
  currentUserId?: string;   // when set, this person cannot be added (used for messaging recipients)
  className?: string;
}

// Reusable "add people by their personnel ID" picker — no full company roster is shown.
// Type an ID, see the matched name, add it as a chip. Used for recipients/attendees/assignees.
export const StaffIdPicker: React.FC<Props> = ({ personnel, selectedIds, onChange, lang, currentUserId, className }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const fa = lang === 'fa';

  const t = {
    placeholder: fa ? 'آی دی پرسنلی را وارد کنید' : 'Enter personnel ID',
    add: fa ? 'افزودن' : 'Add',
    notFound: fa ? 'پرسنلی با این آی دی یافت نشد.' : 'No personnel found with this ID.',
    self: fa ? 'نمی‌توانید خودتان را اضافه کنید.' : 'You cannot add yourself.',
  };

  const add = () => {
    const person = findPersonnelByCode(personnel, code);
    if (!person) { setError(t.notFound); return; }
    if (currentUserId && person.id === currentUserId) { setError(t.self); return; }
    if (!selectedIds.includes(person.id)) onChange([...selectedIds, person.id]);
    setCode(''); setError('');
  };

  const remove = (id: string) => onChange(selectedIds.filter(x => x !== id));

  const match = code.trim() ? findPersonnelByCode(personnel, code) : undefined;

  return (
    <div className={className}>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedIds.map(id => {
            const p = personnel.find(pp => pp.id === id);
            if (!p) return null;
            return (
              <span key={id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white">
                {p.fullName}
                <span className="font-mono text-[10px] opacity-80" dir="ltr">{getStaffCode(p)}</span>
                <button type="button" onClick={() => remove(id)} className="hover:text-white/70">✕</button>
              </span>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          value={code}
          onChange={e => { setCode(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={t.placeholder}
          dir="ltr"
          className="flex-1 min-w-0 text-sm text-gray-800 placeholder-gray-300 border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
        />
        <button type="button" onClick={add}
          className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-black transition-colors shrink-0">
          {t.add}
        </button>
      </div>
      {code.trim() && !error && (
        match
          ? <p className="text-[11px] text-emerald-600 mt-1.5">✓ {match.fullName}</p>
          : <p className="text-[11px] text-gray-400 mt-1.5">{t.notFound}</p>
      )}
      {error && <p className="text-[11px] text-red-500 mt-1.5">{error}</p>}
    </div>
  );
};
