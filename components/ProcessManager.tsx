
import React, { useState } from 'react';
import { CompanyProcess, Personnel, ProcessNode } from '../types';
import { MindMapEditor } from './MindMapEditor';
import { IconPlus, IconTrash, IconEdit, IconShield, IconUsers, IconCheck, IconMindMap } from './Icons';

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
  const [showAccessModal, setShowAccessModal] = useState<string | null>(null); // processId
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAccessType, setNewAccessType] = useState<'all' | 'specific'>('all');
  const [newAccessIds, setNewAccessIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Access modal state
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
    const newProcess: CompanyProcess = {
      id: `proc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser.fullName,
      accessType: newAccessType,
      accessibleTo: newAccessType === 'specific' ? newAccessIds : [],
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

  const toggleAccessId = (id: string, arr: string[], setArr: (v: string[]) => void) => {
    setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  };

  // If a process is open, render the mind map editor as a full-screen overlay
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
    <div className="p-6 space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">فرآیندهای شرکت</h2>
          <p className="text-sm text-gray-500 mt-0.5">مدیریت و مستندسازی فرآیندهای سازمانی</p>
        </div>
        {isMaster && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-black transition-colors"
          >
            <IconPlus className="w-4 h-4" /> فرآیند جدید
          </button>
        )}
      </div>

      {/* Process grid */}
      {visibleProcesses.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <IconMindMap className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {isMaster ? 'هنوز فرآیندی تعریف نشده. اولین فرآیند را ایجاد کنید.' : 'هیچ فرآیندی برای شما قابل نمایش نیست.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProcesses.map(proc => {
            const nodeCount = proc.nodes.length - 1; // exclude root
            const accessLabel = proc.accessType === 'all'
              ? 'همه کارکنان'
              : `${proc.accessibleTo.length} نفر انتخابی`;
            return (
              <div
                key={proc.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all group cursor-pointer"
                onClick={() => setOpenProcessId(proc.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-900 group-hover:text-white transition-colors">
                    <IconMindMap className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  {isMaster && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openAccessModal(proc)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                        title="تنظیم دسترسی"
                      >
                        <IconShield className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(proc.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                        title="حذف فرآیند"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="font-semibold text-gray-900 text-sm mb-1 text-right">{proc.title}</h3>
                {proc.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 text-right mb-3">{proc.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
                  <span className="flex items-center gap-1">
                    <IconUsers className="w-3.5 h-3.5" />
                    {accessLabel}
                  </span>
                  <span>{nodeCount} شاخه</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" dir="rtl">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">ایجاد فرآیند جدید</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">عنوان فرآیند *</label>
                <input
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 text-right"
                  placeholder="مثال: فرآیند جذب نیرو"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">توضیح (اختیاری)</label>
                <textarea
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 resize-none text-right"
                  rows={2}
                  placeholder="توضیح کوتاهی از این فرآیند..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
              </div>

              {/* Access type */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">سطح دسترسی</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setNewAccessType('all')}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${newAccessType === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  >
                    همه کارکنان
                  </button>
                  <button
                    onClick={() => setNewAccessType('specific')}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${newAccessType === 'specific' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  >
                    افراد انتخابی
                  </button>
                </div>
              </div>

              {newAccessType === 'specific' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">انتخاب پرسنل</label>
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
                    {activePersonnel.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">پرسنل فعالی وجود ندارد</p>
                    )}
                    {activePersonnel.map(p => (
                      <label key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${newAccessIds.includes(p.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}
                             onClick={() => toggleAccessId(p.id, newAccessIds, setNewAccessIds)}>
                          {newAccessIds.includes(p.id) && <IconCheck className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="text-sm text-gray-700">{p.fullName}</span>
                        <span className="text-xs text-gray-400 mr-auto">{p.roles[0]}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {newAccessIds.length > 0
                      ? `${newAccessIds.length} نفر انتخاب شده`
                      : 'بدون انتخاب، فقط شما دسترسی خواهید داشت'}
                  </p>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || isSaving}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'در حال ایجاد...' : 'ایجاد فرآیند'}
              </button>
              <button
                onClick={() => { setShowCreateModal(false); setNewTitle(''); setNewDesc(''); setNewAccessType('all'); setNewAccessIds([]); }}
                className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access Control Modal */}
      {showAccessModal && (() => {
        const proc = processes.find(p => p.id === showAccessModal);
        if (!proc) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" dir="rtl">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">تنظیم دسترسی</h3>
                <p className="text-sm text-gray-500 mt-0.5">{proc.title}</p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">چه کسانی دسترسی داشته باشند؟</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setAccessType('all')}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${accessType === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                    >
                      <IconUsers className="w-4 h-4 inline ml-1.5" />
                      همه کارکنان
                    </button>
                    <button
                      onClick={() => setAccessType('specific')}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${accessType === 'specific' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                    >
                      <IconShield className="w-4 h-4 inline ml-1.5" />
                      افراد انتخابی
                    </button>
                  </div>
                </div>

                {accessType === 'specific' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">انتخاب پرسنل</label>
                    <div className="max-h-56 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
                      {activePersonnel.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">پرسنل فعالی وجود ندارد</p>
                      )}
                      {activePersonnel.map(p => (
                        <label key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${accessIds.includes(p.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}
                            onClick={() => toggleAccessId(p.id, accessIds, setAccessIds)}
                          >
                            {accessIds.includes(p.id) && <IconCheck className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-800">{p.fullName}</p>
                            <p className="text-xs text-gray-400">{p.roles.join('، ')}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {accessIds.length > 0
                        ? `${accessIds.length} نفر انتخاب شده`
                        : 'بدون انتخاب، فقط مستر دسترسی خواهد داشت'}
                    </p>
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-gray-100 flex gap-3">
                <button
                  onClick={handleSaveAccess}
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
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

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (() => {
        const proc = processes.find(p => p.id === showDeleteConfirm);
        if (!proc) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" dir="rtl" onClick={e => e.stopPropagation()}>
              <div className="p-5 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <IconTrash className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1">حذف فرآیند</h3>
                <p className="text-sm text-gray-600">
                  فرآیند <strong>«{proc.title}»</strong> و تمام داده‌های آن حذف می‌شود. این عملیات قابل بازگشت نیست.
                </p>
              </div>
              <div className="px-5 pb-5 flex gap-3">
                <button
                  onClick={() => handleDelete(proc.id)}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  بله، حذف شود
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
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
