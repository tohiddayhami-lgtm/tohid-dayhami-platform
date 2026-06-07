
import React, { useState } from 'react';
import { CompanyProcess, Personnel, ProcessNode } from '../types';
import { MindMapEditor } from './MindMapEditor';
import { IconPlus, IconTrash, IconShield, IconUsers, IconCheck, IconMindMap } from './Icons';

interface Props {
  processes: CompanyProcess[];
  personnel: Personnel[];
  currentUser: Personnel;
  onSave: (process: CompanyProcess) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  lang: 'fa' | 'en';
}

function canAccess(process: CompanyProcess, user: Personnel): boolean {
  if (user.username === 'master') return true;
  if (process.accessType === 'all') return true;
  return process.accessibleTo.includes(user.id);
}

const IconX = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

export const ProcessManager: React.FC<Props> = ({
  processes,
  personnel,
  currentUser,
  onSave,
  onDelete,
  lang,
}) => {
  const isMaster = currentUser.username === 'master';
  const [openProcessId, setOpenProcessId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAccessType, setNewAccessType] = useState<'all' | 'specific'>('all');
  const [newAccessIds, setNewAccessIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [accessType, setAccessType] = useState<'all' | 'specific'>('all');
  const [accessIds, setAccessIds] = useState<string[]>([]);

  const visibleProcesses = processes.filter(p => canAccess(p, currentUser));
  const activePersonnel = personnel.filter(p => p.status === 'active' && p.username !== 'master');
  const openProcess = visibleProcesses.find(p => p.id === openProcessId);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setIsSaving(true);
    const rootId = `root-${Date.now()}`;
    const rootNode: ProcessNode = {
      id: rootId,
      label: newTitle.trim(),
      parentId: null,
      childIds: [],
      notes: '',
      files: [],
      color: '#111827',
      isCollapsed: false,
    };
    let accessibleTo = newAccessType === 'specific' ? newAccessIds : [];
    if (!isMaster && newAccessType === 'specific' && !accessibleTo.includes(currentUser.id)) {
      accessibleTo = [currentUser.id, ...accessibleTo];
    }
    const newProcess: CompanyProcess = {
      id: `proc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser.fullName,
      accessType: newAccessType,
      accessibleTo,
      nodes: [rootNode],
      rootNodeId: rootId,
    };
    await onSave(newProcess);
    setShowCreateModal(false);
    setNewTitle('');
    setNewDesc('');
    setNewAccessType('all');
    setNewAccessIds([]);
    setIsSaving(false);
    setOpenProcessId(newProcess.id);
  };

  const handleSaveAccess = async () => {
    if (!showAccessModal) return;
    const proc = processes.find(p => p.id === showAccessModal);
    if (!proc) return;
    setIsSaving(true);
    await onSave({ ...proc, accessType, accessibleTo: accessType === 'specific' ? accessIds : [] });
    setShowAccessModal(null);
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    await onDelete(id);
    setShowDeleteConfirm(null);
    if (openProcessId === id) setOpenProcessId(null);
  };

  const openAccessModal = (proc: CompanyProcess) => {
    setAccessType(proc.accessType);
    setAccessIds(proc.accessibleTo);
    setShowAccessModal(proc.id);
  };

  const toggleId = (id: string, arr: string[], setArr: (v: string[]) => void) => {
    setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  };

  const closeCreate = () => {
    setShowCreateModal(false);
    setNewTitle('');
    setNewDesc('');
    setNewAccessType('all');
    setNewAccessIds([]);
  };

  if (openProcess) {
    return (
      <div className="fixed inset-0 z-[90] bg-white flex flex-col">
        <MindMapEditor
          process={openProcess}
          currentUser={currentUser}
          onSave={async (updated) => { await onSave(updated); }}
          onBack={() => setOpenProcessId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in p-6" dir="rtl">

      {/* Header card */}
      <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl">
            <IconMindMap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">مایند مپ</h2>
            <p className="text-xs text-gray-400 mt-0.5">{visibleProcesses.length} مایند مپ</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-medium transition-colors"
        >
          <IconPlus className="w-4 h-4" />
          مایند مپ جدید
        </button>
      </div>

      {/* Grid */}
      {visibleProcesses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-24 flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center">
            <IconMindMap className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm text-gray-400">هنوز مایند مپی ایجاد نشده. اولین مایند مپ را بسازید.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-1 flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-black transition-colors"
          >
            <IconPlus className="w-4 h-4" /> مایند مپ جدید
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProcesses.map(proc => {
            const nodeCount = proc.nodes.length - 1;
            const accessLabel = proc.accessType === 'all' ? 'همه کارکنان' : `${proc.accessibleTo.length} نفر انتخابی`;
            const isOwner = proc.createdBy === currentUser.fullName;
            const updatedDate = proc.lastUpdated
              ? new Date(proc.lastUpdated).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })
              : new Date(proc.createdAt).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });

            return (
              <div
                key={proc.id}
                onClick={() => setOpenProcessId(proc.id)}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all group cursor-pointer relative"
              >
                {/* Actions */}
                <div
                  className="absolute top-3 left-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  {isMaster && (
                    <button
                      onClick={() => openAccessModal(proc)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors"
                      title="تنظیم دسترسی"
                    >
                      <IconShield className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {(isMaster || isOwner) && (
                    <button
                      onClick={() => setShowDeleteConfirm(proc.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="حذف"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Icon */}
                <div className="w-10 h-10 bg-gray-50 group-hover:bg-indigo-50 rounded-xl flex items-center justify-center mb-4 transition-colors">
                  <IconMindMap className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                </div>

                <h3 className="font-semibold text-gray-900 text-sm mb-1 text-right leading-snug">{proc.title}</h3>
                {proc.description && (
                  <p className="text-xs text-gray-400 line-clamp-2 text-right mb-4 leading-relaxed">{proc.description}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-50 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <IconUsers className="w-3 h-3" />
                    {accessLabel}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>{nodeCount} شاخه</span>
                    <span className="text-gray-200">·</span>
                    <span>{updatedDate}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" dir="rtl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">مایند مپ جدید</h3>
              <button onClick={closeCreate} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">عنوان *</label>
                <input
                  autoFocus
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 focus:bg-white text-right transition-colors"
                  placeholder="مثال: برنامه‌ریزی فروش، فرآیند جذب نیرو..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && newTitle.trim() && handleCreate()}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">توضیح <span className="font-normal text-gray-400">(اختیاری)</span></label>
                <textarea
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 focus:bg-white resize-none text-right transition-colors"
                  rows={2}
                  placeholder="توضیح کوتاه..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">سطح دسترسی</label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  {[{ v: 'all' as const, l: 'همه کارکنان' }, { v: 'specific' as const, l: 'افراد انتخابی' }].map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => setNewAccessType(v)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${newAccessType === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {newAccessType === 'specific' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-2">انتخاب پرسنل</label>
                  <div className="max-h-44 overflow-y-auto space-y-0.5 border border-gray-100 rounded-xl bg-gray-50 p-2">
                    {activePersonnel.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-3">پرسنل فعالی وجود ندارد</p>
                    )}
                    {activePersonnel.map(p => (
                      <label key={p.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                        <div
                          className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer shrink-0 ${newAccessIds.includes(p.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300 bg-white'}`}
                          onClick={() => toggleId(p.id, newAccessIds, setNewAccessIds)}
                        >
                          {newAccessIds.includes(p.id) && <IconCheck className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="text-sm text-gray-700 flex-1">{p.fullName}</span>
                        <span className="text-xs text-gray-400">{p.roles[0]}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5 text-right">
                    {newAccessIds.length > 0 ? `${newAccessIds.length} نفر انتخاب شده` : 'هیچ‌کس انتخاب نشده'}
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || isSaving}
                className="flex-1 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'در حال ایجاد...' : 'ایجاد مایند مپ'}
              </button>
              <button
                onClick={closeCreate}
                className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Access Control Modal ────────────────────────── */}
      {showAccessModal && (() => {
        const proc = processes.find(p => p.id === showAccessModal);
        if (!proc) return null;
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" dir="rtl">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">تنظیم دسترسی</h3>
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[280px]">{proc.title}</p>
                </div>
                <button onClick={() => setShowAccessModal(null)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <IconX className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-2">چه کسانی دسترسی داشته باشند؟</label>
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                    {[{ v: 'all' as const, l: 'همه کارکنان' }, { v: 'specific' as const, l: 'افراد انتخابی' }].map(({ v, l }) => (
                      <button
                        key={v}
                        onClick={() => setAccessType(v)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${accessType === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {accessType === 'specific' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-2">انتخاب پرسنل</label>
                    <div className="max-h-52 overflow-y-auto space-y-0.5 border border-gray-100 rounded-xl bg-gray-50 p-2">
                      {activePersonnel.map(p => (
                        <label key={p.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                          <div
                            className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer shrink-0 ${accessIds.includes(p.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300 bg-white'}`}
                            onClick={() => toggleId(p.id, accessIds, setAccessIds)}
                          >
                            {accessIds.includes(p.id) && <IconCheck className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 truncate">{p.fullName}</p>
                            <p className="text-[11px] text-gray-400">{p.roles.join('، ')}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      {accessIds.length > 0 ? `${accessIds.length} نفر انتخاب شده` : 'فقط مستر دسترسی خواهد داشت'}
                    </p>
                  </div>
                )}
              </div>
              <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={handleSaveAccess}
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'ذخیره...' : 'ذخیره تغییرات'}
                </button>
                <button
                  onClick={() => setShowAccessModal(null)}
                  className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Delete Confirm ─────────────────────────────── */}
      {showDeleteConfirm && (() => {
        const proc = processes.find(p => p.id === showDeleteConfirm);
        if (!proc) return null;
        return (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in"
              dir="rtl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 text-center">
                <div className="w-11 h-11 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <IconTrash className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-2">حذف مایند مپ</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  مایند مپ <span className="font-semibold text-gray-700">«{proc.title}»</span> و تمام داده‌هایش حذف می‌شود.
                  این عملیات قابل بازگشت نیست.
                </p>
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <button
                  onClick={() => handleDelete(proc.id)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  حذف
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
