import React, { useState, useRef } from 'react';
import { CustomerAccount, Ticket, Personnel, AttachedFile } from '../types';
import { uploadFileWithProgress } from '../services/firebaseService';
import { Language } from '../App';
import { IconPaperclip, IconFile, IconTrash, IconUsers } from './Icons';

interface Props {
  customerUser: CustomerAccount;
  tickets: Ticket[];
  personnel: Personnel[];
  onAddComment: (ticketId: string, commentText: string, files?: AttachedFile[]) => Promise<void>;
  onLogout: () => void;
  lang: Language;
}

export const CustomerDashboard: React.FC<Props> = ({
  customerUser, tickets, personnel, onAddComment, onLogout, lang
}) => {
  const [selectedTicketId, setSelectedTicketId] = useState<string>(tickets[0]?.id || '');
  const [comment, setComment] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);
  const publicTimeline = (selectedTicket?.timeline || []).filter(e => e.visibility !== 'internal');

  const statusBadge = (status: string) => {
    if (status === 'تکمیل شده') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (status === 'لغو شده') return 'bg-red-50 text-red-600 border border-red-100';
    if (status === 'در دست اقدام') return 'bg-gray-900 text-white';
    if (status === 'در حال بررسی') return 'bg-gray-100 text-gray-700 border border-gray-200';
    return 'bg-gray-50 text-gray-600 border border-gray-100';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('حداکثر ۱۰ مگابایت'); return; }
    setUploading(true);
    uploadFileWithProgress(
      file, () => {},
      (url) => { setAttachedFiles(prev => [...prev, { name: file.name, size: file.size, type: file.type, content: url, status: 'success' }]); setUploading(false); },
      (err) => { alert('خطا در آپلود: ' + err.message); setUploading(false); },
      'uploads'
    );
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!comment.trim() && attachedFiles.length === 0) return;
    if (!selectedTicket) return;
    setIsSending(true);
    try {
      await onAddComment(selectedTicket.id, comment.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
      setComment('');
      setAttachedFiles([]);
    } finally { setIsSending(false); }
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
            <IconUsers className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{lang === 'fa' ? `خوش آمدید، ${customerUser.fullName}` : `Welcome, ${customerUser.fullName}`}</h2>
            <p className="text-xs text-gray-400">{lang === 'fa' ? 'پنل مشتری' : 'Customer Portal'}</p>
          </div>
        </div>
        <button onClick={onLogout} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-100 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors">
          {lang === 'fa' ? 'خروج' : 'Logout'}
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-16 text-center text-gray-400 text-sm">
          پرونده‌ای برای نمایش وجود ندارد
        </div>
      ) : (
        <>
          {/* Ticket tabs if multiple */}
          {tickets.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {tickets.map(t => (
                <button key={t.id} onClick={() => setSelectedTicketId(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedTicketId === t.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  #{t.id}
                </button>
              ))}
            </div>
          )}

          {selectedTicket && (
            <>
              {/* Ticket info card */}
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-mono text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded">#{selectedTicket.id}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusBadge(selectedTicket.status)}`}>{selectedTicket.status}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm">{selectedTicket.customerName}</h3>
                    {selectedTicket.companyName && <p className="text-xs text-gray-400 mt-0.5">{selectedTicket.companyName}</p>}
                    {selectedTicket.description && <p className="text-xs text-gray-500 mt-2 leading-relaxed max-w-sm">{selectedTicket.description.slice(0, 120)}{selectedTicket.description.length > 120 ? '...' : ''}</p>}
                  </div>
                  <div className="text-xs text-gray-400 space-y-1 shrink-0">
                    <div>تاریخ ثبت: {new Date(selectedTicket.createdAt).toLocaleDateString('fa-IR')}</div>
                    {selectedTicket.assignedTo && (
                      <div>کارشناس: {personnel.find(p => p.id === selectedTicket.assignedTo)?.fullName || '—'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Conversation */}
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {lang === 'fa' ? 'گفتگو و مکاتبات' : 'Conversation'}
                  </h4>
                  <span className="text-[10px] text-gray-400">{publicTimeline.length} پیام</span>
                </div>

                {/* Messages */}
                <div className="p-5 space-y-3 max-h-[400px] overflow-y-auto">
                  {publicTimeline.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">هنوز پیامی رد و بدل نشده است</p>
                  )}
                  {publicTimeline.map((entry, idx) => {
                    const isMe = entry.actorName === customerUser.fullName;
                    const entryFiles = (entry as any).files as AttachedFile[] | undefined;
                    return (
                      <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-4 py-3 rounded-xl text-sm ${isMe ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-bl-sm'}`}>
                          {!isMe && <div className="text-[10px] font-semibold mb-1 text-gray-400">{entry.actorName}</div>}
                          {entry.description && <div className="text-xs leading-relaxed whitespace-pre-wrap">{entry.description}</div>}
                          {entryFiles && entryFiles.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {entryFiles.map((f, fi) => (
                                <a key={fi} href={f.content} target="_blank" rel="noopener noreferrer"
                                  className={`flex items-center gap-1.5 text-[10px] underline underline-offset-2 ${isMe ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                                  <IconFile className="w-3 h-3 shrink-0" /> {f.name}
                                </a>
                              ))}
                            </div>
                          )}
                          <div className={`text-[9px] mt-1.5 ${isMe ? 'text-gray-400 text-left' : 'text-gray-300'}`}>
                            {new Date(entry.timestamp).toLocaleString('fa-IR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Input */}
                <div className="border-t border-gray-100 p-4 space-y-2">
                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachedFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg text-xs text-gray-600">
                          <IconFile className="w-3 h-3 shrink-0 text-gray-400" />
                          <span className="max-w-[120px] truncate">{f.name}</span>
                          <button onClick={() => setAttachedFiles(p => p.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 ml-1 transition-colors">
                            <IconTrash className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      className="flex-grow px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-800 focus:bg-white transition-colors"
                      placeholder={lang === 'fa' ? 'پیام خود را بنویسید...' : 'Write your message...'}
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading} title="ضمیمه فایل"
                      className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40 shrink-0">
                      <IconPaperclip className="w-4 h-4" />
                    </button>
                    <button onClick={handleSend} disabled={isSending || uploading || (!comment.trim() && attachedFiles.length === 0)}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-black transition-colors disabled:opacity-40 shrink-0">
                      {isSending ? '...' : (lang === 'fa' ? 'ارسال' : 'Send')}
                    </button>
                  </div>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
