import React, { useMemo, useState } from 'react';
import type { Personnel } from '../types';
import type { CartableTodoColumn, CartableTodoItem, CartableTodoNote } from '../types';
import { Language } from '../App';
import {
  saveCartableTodoToCloud,
  updateCartableTodoInCloud,
  deleteCartableTodoFromCloud,
} from '../services/firebaseService';
import { IconPlus, IconTrash, IconCheck, IconArchive, IconNote } from './Icons';

interface Props {
  currentUser: Personnel;
  items: CartableTodoItem[];
  personnel: Personnel[];
  lang: Language;
  canToggle?: boolean;
  onDisable?: () => void;
}

const COLUMNS: {
  id: CartableTodoColumn;
  titleFa: string;
  titleEn: string;
  card: string;
  pin: string;
  rot: string;
}[] = [
  { id: 'todo', titleFa: 'کارهایی که باید انجام بدم', titleEn: 'To do', card: 'bg-[#fef08a]', pin: 'bg-red-500', rot: '-rotate-1' },
  { id: 'doing', titleFa: 'کارهای در حال انجام', titleEn: 'In progress', card: 'bg-[#bae6fd]', pin: 'bg-sky-600', rot: 'rotate-1' },
  { id: 'done', titleFa: 'کارهای انجام شده', titleEn: 'Done', card: 'bg-[#a7f3d0]', pin: 'bg-emerald-600', rot: '-rotate-1' },
];

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const CartableStickyTodos: React.FC<Props> = ({ currentUser, items, personnel, lang, canToggle, onDisable }) => {
  const T = lang === 'fa';
  const isMaster = currentUser.username === 'master';

  const [showArchive, setShowArchive] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<string>(isMaster ? 'all' : currentUser.id);
  const [drafts, setDrafts] = useState<Record<CartableTodoColumn, string>>({ todo: '', doing: '', done: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(() => {
    let list = items.filter(i => (showArchive ? !!i.archived : !i.archived));
    if (isMaster) {
      if (ownerFilter !== 'all') list = list.filter(i => i.ownerId === ownerFilter);
    } else {
      list = list.filter(i => i.ownerId === currentUser.id);
    }
    return list;
  }, [items, showArchive, isMaster, ownerFilter, currentUser.id]);

  const byColumn = useMemo(() => {
    const map: Record<CartableTodoColumn, CartableTodoItem[]> = { todo: [], doing: [], done: [] };
    visible.forEach(i => {
      map[i.column]?.push(i);
    });
    return map;
  }, [visible]);

  const ownersWithTodos = useMemo(() => {
    const ids = new Set(items.map(i => i.ownerId));
    return personnel.filter(p => ids.has(p.id) || p.id === currentUser.id);
  }, [items, personnel, currentUser.id]);

  const canEdit = (item: CartableTodoItem) =>
    isMaster || item.ownerId === currentUser.id;

  const addItem = async (column: CartableTodoColumn) => {
    const title = drafts[column].trim();
    if (!title) return;
    const now = new Date().toISOString();
    const item: CartableTodoItem = {
      id: uid('ctodo'),
      title,
      column,
      notes: [],
      checked: column === 'done',
      archived: false,
      startDate: column !== 'todo' ? now.slice(0, 10) : '',
      dueDate: '',
      ownerId: currentUser.id,
      ownerName: currentUser.fullName || currentUser.username,
      createdAt: now,
      updatedAt: now,
    };
    setDrafts(d => ({ ...d, [column]: '' }));
    await saveCartableTodoToCloud(item);
  };

  const patch = async (id: string, updates: Partial<CartableTodoItem>) => {
    setBusyId(id);
    try {
      await updateCartableTodoInCloud(id, updates);
    } finally {
      setBusyId(null);
    }
  };

  const toggleCheck = async (item: CartableTodoItem) => {
    if (!canEdit(item)) return;
    const next = !item.checked;
    await patch(item.id, {
      checked: next,
      column: next ? 'done' : (item.column === 'done' ? 'todo' : item.column),
    });
  };

  const moveTo = async (item: CartableTodoItem, column: CartableTodoColumn) => {
    if (!canEdit(item)) return;
    await patch(item.id, {
      column,
      checked: column === 'done' ? true : item.checked && column !== 'todo' ? item.checked : false,
      startDate: item.startDate || (column !== 'todo' ? new Date().toISOString().slice(0, 10) : item.startDate),
    });
  };

  const archiveItem = async (item: CartableTodoItem) => {
    if (!canEdit(item)) return;
    await patch(item.id, { archived: !item.archived });
  };

  const removeItem = async (item: CartableTodoItem) => {
    if (!canEdit(item)) return;
    if (!window.confirm(T ? 'این کار حذف شود؟' : 'Delete this task?')) return;
    await deleteCartableTodoFromCloud(item.id);
  };

  const addNote = async (item: CartableTodoItem) => {
    if (!canEdit(item) || !noteDraft.trim()) return;
    const note: CartableTodoNote = {
      id: uid('note'),
      text: noteDraft.trim(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser.fullName || currentUser.username,
    };
    await patch(item.id, { notes: [...(item.notes || []), note] });
    setNoteDraft('');
  };

  const removeNote = async (item: CartableTodoItem, noteId: string) => {
    if (!canEdit(item)) return;
    await patch(item.id, { notes: (item.notes || []).filter(n => n.id !== noteId) });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">
            {T ? 'یادداشت‌های کارتابل' : 'Cartable sticky todos'}
          </h3>
          <p className="text-[11px] text-gray-400">
            {T
              ? (isMaster ? 'هر نفر لیست خودش را می‌بیند — شما به‌عنوان مستر همه را می‌بینید' : 'فقط لیست شخصی شما')
              : (isMaster ? 'Each person has a private list — as master you can view everyone' : 'Your personal list only')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isMaster && (
            <select
              value={ownerFilter}
              onChange={e => setOwnerFilter(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white"
            >
              <option value="all">{T ? 'همه افراد' : 'Everyone'}</option>
              {ownersWithTodos.map(p => (
                <option key={p.id} value={p.id}>{p.fullName || p.username}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowArchive(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1 ${
              showArchive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            <IconArchive className="w-3.5 h-3.5" />
            {showArchive ? (T ? 'بازگشت به لیست' : 'Back to list') : (T ? 'آرشیو' : 'Archive')}
          </button>
          {canToggle && onDisable && (
            <button
              type="button"
              onClick={onDisable}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-800 hover:border-gray-400 font-bold"
              title={T ? 'مخفی کردن این بخش' : 'Hide this section'}
            >
              {T ? 'غیرفعال کردن' : 'Turn off'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <div
            key={col.id}
            className={`relative rounded-sm shadow-md border border-black/5 p-4 pt-5 ${col.card} ${col.rot} transition-transform hover:rotate-0`}
          >
            <span className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full shadow ${col.pin}`} />
            <h4 className="font-black text-gray-900 text-sm mb-3 leading-snug pe-1">
              {T ? col.titleFa : col.titleEn}
              <span className="ms-2 text-[10px] font-bold text-gray-600/70">
                ({byColumn[col.id].length})
              </span>
            </h4>

            {!showArchive && (
              <div className="flex gap-1.5 mb-3">
                <input
                  value={drafts[col.id]}
                  onChange={e => setDrafts(d => ({ ...d, [col.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), void addItem(col.id))}
                  placeholder={T ? 'کار جدید…' : 'New task…'}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-white/70 border border-black/5 text-xs outline-none focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => void addItem(col.id)}
                  className="shrink-0 p-1.5 rounded-lg bg-gray-900 text-white hover:bg-black"
                  title={T ? 'افزودن' : 'Add'}
                >
                  <IconPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto pe-0.5">
              {byColumn[col.id].length === 0 && (
                <p className="text-[11px] text-gray-500/80 py-4 text-center">
                  {showArchive
                    ? (T ? 'آرشیوی در این ستون نیست' : 'No archived items')
                    : (T ? 'هنوز کاری نیست' : 'No tasks yet')}
                </p>
              )}

              {byColumn[col.id].map(item => {
                const open = expandedId === item.id;
                const overdue = item.dueDate && !item.checked && item.dueDate < new Date().toISOString().slice(0, 10);
                return (
                  <div
                    key={item.id}
                    className={`bg-white/80 rounded-xl border border-black/5 p-2.5 shadow-sm ${busyId === item.id ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        disabled={!canEdit(item)}
                        onClick={() => void toggleCheck(item)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          item.checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-400 bg-white'
                        }`}
                      >
                        {item.checked && <IconCheck className="w-3 h-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => { setExpandedId(open ? null : item.id); setNoteDraft(''); }}
                          className={`text-start w-full text-xs font-bold text-gray-900 ${item.checked ? 'line-through text-gray-400' : ''}`}
                        >
                          {item.title}
                        </button>
                        {isMaster && ownerFilter === 'all' && (
                          <div className="text-[10px] text-gray-400 mt-0.5">{item.ownerName}</div>
                        )}
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] text-gray-500">
                          {item.startDate && <span>{T ? 'شروع:' : 'Start:'} {item.startDate}</span>}
                          {item.dueDate && (
                            <span className={overdue ? 'text-red-600 font-bold' : ''}>
                              {T ? 'مهلت:' : 'Due:'} {item.dueDate}
                            </span>
                          )}
                          {(item.notes?.length || 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <IconNote className="w-3 h-3" />{item.notes!.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {open && (
                      <div className="mt-2 pt-2 border-t border-black/5 space-y-2">
                        {canEdit(item) && (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="text-[10px] text-gray-500">
                                {T ? 'تاریخ شروع' : 'Start date'}
                                <input
                                  type="date"
                                  value={item.startDate || ''}
                                  onChange={e => void patch(item.id, { startDate: e.target.value })}
                                  className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-gray-200 text-[11px]"
                                />
                              </label>
                              <label className="text-[10px] text-gray-500">
                                {T ? 'مهلت انجام' : 'Due date'}
                                <input
                                  type="date"
                                  value={item.dueDate || ''}
                                  onChange={e => void patch(item.id, { dueDate: e.target.value })}
                                  className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-gray-200 text-[11px]"
                                />
                              </label>
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {COLUMNS.filter(c => c.id !== item.column).map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => void moveTo(item, c.id)}
                                  className="text-[10px] px-2 py-1 rounded-lg bg-white border border-gray-200 font-bold text-gray-600 hover:border-gray-400"
                                >
                                  → {T ? c.titleFa : c.titleEn}
                                </button>
                              ))}
                            </div>

                            <div>
                              <div className="text-[10px] font-bold text-gray-500 mb-1">
                                {T ? 'نوت‌های این کار' : 'Notes on this task'}
                              </div>
                              <div className="space-y-1 mb-1.5 max-h-28 overflow-y-auto">
                                {(item.notes || []).map(n => (
                                  <div key={n.id} className="flex items-start gap-1 bg-white/90 rounded-lg px-2 py-1 text-[11px]">
                                    <span className="flex-1 text-gray-700">{n.text}</span>
                                    <button type="button" onClick={() => void removeNote(item, n.id)} className="text-red-400 hover:text-red-600">
                                      <IconTrash className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                {(item.notes || []).length === 0 && (
                                  <p className="text-[10px] text-gray-400">{T ? 'نوتی نیست' : 'No notes'}</p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <input
                                  value={noteDraft}
                                  onChange={e => setNoteDraft(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), void addNote(item))}
                                  placeholder={T ? 'نوت جدید…' : 'Add note…'}
                                  className="flex-1 px-2 py-1 rounded-lg bg-white border border-gray-200 text-[11px]"
                                />
                                <button type="button" onClick={() => void addNote(item)} className="px-2 py-1 rounded-lg bg-gray-900 text-white text-[10px] font-bold">
                                  {T ? 'ثبت' : 'Add'}
                                </button>
                              </div>
                            </div>

                            <div className="flex gap-1 pt-1">
                              <button
                                type="button"
                                onClick={() => void archiveItem(item)}
                                className="flex-1 text-[10px] font-bold py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1"
                              >
                                <IconArchive className="w-3 h-3" />
                                {item.archived ? (T ? 'خروج از آرشیو' : 'Unarchive') : (T ? 'آرشیو' : 'Archive')}
                              </button>
                              <button
                                type="button"
                                onClick={() => void removeItem(item)}
                                className="px-2 py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50"
                              >
                                <IconTrash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                        {!canEdit(item) && (
                          <div className="space-y-1">
                            {(item.notes || []).map(n => (
                              <div key={n.id} className="text-[11px] bg-white/90 rounded-lg px-2 py-1 text-gray-700">{n.text}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
