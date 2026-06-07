
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { InternalMessage, Personnel, AttachedFile } from '../types';
import { IconMail, IconSend, IconInbox, IconPaperclip, IconTrash, IconFile, IconReply, IconPlus, IconSearch, IconArrowRight } from './Icons';
import { sendInternalMessage, updateMessageInCloud, deleteMessageFromCloud, uploadFileWithProgress } from '../services/firebaseService';
import { Language } from '../App';

interface Props {
  currentUser: Personnel;
  personnel: Personnel[];
  messages: InternalMessage[];
  lang: Language;
  onAfterSend?: (recipientIds: string[], senderName: string, subject: string) => void;
}

export const InternalMessenger: React.FC<Props> = ({ currentUser, personnel, messages, lang, onAfterSend }) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMaster = currentUser.username === 'master';

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const t = {
    fa: {
      inbox: 'صندوق ورودی', sent: 'ارسال‌شده',
      compose: 'پیام جدید', search: 'جستجو...',
      subject: 'موضوع', body: 'متن پیام',
      recipients: 'گیرندگان', send: 'ارسال',
      reply: 'پاسخ', delete: 'حذف',
      files: 'پیوست‌ها', cancel: 'انصراف',
      writeHere: 'متن پیام را بنویسید...',
      from: 'از:', to: 'به:',
      noSelect: 'یک پیام انتخاب کنید',
      empty: 'پیامی وجود ندارد',
    },
    en: {
      inbox: 'Inbox', sent: 'Sent',
      compose: 'New Message', search: 'Search...',
      subject: 'Subject', body: 'Message',
      recipients: 'To', send: 'Send',
      reply: 'Reply', delete: 'Delete',
      files: 'Attachments', cancel: 'Cancel',
      writeHere: 'Write your message...',
      from: 'From:', to: 'To:',
      noSelect: 'Select a message',
      empty: 'No messages',
    },
  }[lang];

  const filteredMessages = useMemo(() => {
    let list = activeTab === 'inbox'
      ? messages.filter(m => m.recipientIds.includes(currentUser.id))
      : messages.filter(m => m.senderId === currentUser.id);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(m =>
        m.subject.toLowerCase().includes(term) ||
        m.body.toLowerCase().includes(term) ||
        m.senderName.toLowerCase().includes(term)
      );
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [messages, activeTab, currentUser.id, searchTerm]);

  const selectedMessage = useMemo(() =>
    messages.find(m => m.id === selectedMsgId) || null
  , [messages, selectedMsgId]);

  const unreadCount = useMemo(() =>
    messages.filter(m => m.recipientIds.includes(currentUser.id) && !m.readBy.includes(currentUser.id)).length
  , [messages, currentUser.id]);

  const handleSendMessage = async () => {
    if (recipientIds.length === 0 || !subject.trim() || !body.trim()) return;
    setIsSending(true);
    try {
      const recipientNames = recipientIds.map(id => personnel.find(p => p.id === id)?.fullName || 'Unknown');
      const newMessage: InternalMessage = {
        id: `msg-${Date.now()}`,
        senderId: currentUser.id,
        senderName: currentUser.fullName,
        recipientIds, recipientNames, subject, body,
        files: attachments.filter(f => f.status === 'success'),
        createdAt: new Date().toISOString(),
        readBy: [],
      };
      await sendInternalMessage(newMessage);
      onAfterSend?.(recipientIds, currentUser.fullName, subject);
      setIsComposeOpen(false);
      setRecipientIds([]); setSubject(''); setBody(''); setAttachments([]);
      setActiveTab('sent');
      if (!isMobile) setSelectedMsgId(newMessage.id);
    } catch { alert('خطا در ارسال'); } finally { setIsSending(false); }
  };

  const handleSelectMessage = (msg: InternalMessage) => {
    setSelectedMsgId(msg.id);
    if (activeTab === 'inbox' && !msg.readBy.includes(currentUser.id)) {
      updateMessageInCloud(msg.id, { readBy: [...msg.readBy, currentUser.id] });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const newFile: AttachedFile = { name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 };
      setAttachments(prev => [...prev, newFile]);
      uploadFileWithProgress(
        file,
        (progress) => setAttachments(prev => prev.map(f => f.name === file.name ? { ...f, progress } : f)),
        (url) => setAttachments(prev => prev.map(f => f.name === file.name ? { ...f, content: url, status: 'success', progress: 100 } : f)),
        (err) => setAttachments(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error' } : f)),
        'uploads'
      );
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString(lang === 'fa' ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US', { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getInitial = (name: string) => name.trim().charAt(0).toUpperCase();

  return (
    <div className="bg-white border border-gray-200 rounded-2xl flex overflow-hidden h-[680px] w-full" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── Sidebar ── */}
      <div className={`flex flex-col border-l border-gray-200 shrink-0 bg-gray-50/60 ${isMobile && selectedMsgId ? 'hidden' : 'w-full md:w-72 lg:w-80'}`}>

        {/* Sidebar Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">
              {activeTab === 'inbox' ? t.inbox : t.sent}
              {activeTab === 'inbox' && unreadCount > 0 && (
                <span className="mr-2 text-[11px] font-medium bg-blue-500 text-white rounded-full px-1.5 py-0.5">{unreadCount}</span>
              )}
            </h2>
            <button
              onClick={() => setIsComposeOpen(true)}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              title={t.compose}
            >
              <IconPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 mb-3">
            <button
              onClick={() => { setActiveTab('inbox'); setSelectedMsgId(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'inbox' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <IconInbox className="w-3.5 h-3.5" />
              {t.inbox}
            </button>
            <button
              onClick={() => { setActiveTab('sent'); setSelectedMsgId(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'sent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <IconSend className="w-3.5 h-3.5" />
              {t.sent}
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <IconSearch className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t.search}
              className="w-full pr-8 pl-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 placeholder-gray-400 outline-none focus:border-blue-400 transition-colors"
            />
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <IconMail className="w-8 h-8 text-gray-200" />
              <p className="text-xs text-gray-400">{t.empty}</p>
            </div>
          ) : (
            <div>
              {filteredMessages.map(msg => {
                const isUnread = activeTab === 'inbox' && !msg.readBy.includes(currentUser.id);
                const isSelected = selectedMsgId === msg.id;
                return (
                  <div
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-white'}`}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 ${isUnread ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {activeTab === 'inbox' ? getInitial(msg.senderName) : getInitial(currentUser.fullName)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <span className={`text-xs truncate ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
                          {activeTab === 'inbox' ? msg.senderName : msg.recipientNames.join('، ')}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">{formatDate(msg.createdAt)}</span>
                      </div>
                      <div className={`text-xs truncate mb-0.5 ${isUnread ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                        {msg.subject}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate leading-relaxed">
                        {msg.body.replace(/\n/g, ' ')}
                      </div>
                      {msg.files && msg.files.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
                          <IconPaperclip className="w-2.5 h-2.5" />
                          {msg.files.length}
                        </div>
                      )}
                    </div>

                    {isUnread && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className={`flex-1 flex flex-col bg-white min-w-0 ${isMobile && !selectedMsgId ? 'hidden' : 'flex'}`}>
        {selectedMessage ? (
          <div className="flex flex-col h-full">

            {/* Message Header */}
            <div className="px-6 py-4 border-b border-gray-200 shrink-0">
              {isMobile && (
                <button onClick={() => setSelectedMsgId(null)} className="mb-3 flex items-center gap-1 text-blue-500 text-sm">
                  <IconArrowRight className="w-4 h-4 ltr:rotate-180" />
                  <span>بازگشت</span>
                </button>
              )}
              <h2 className="text-base font-semibold text-gray-900 mb-2 leading-snug">{selectedMessage.subject}</h2>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700 shrink-0">
                    {getInitial(selectedMessage.senderName)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-900">{selectedMessage.senderName}</div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {t.to} {selectedMessage.recipientNames.join('، ')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-gray-400 hidden sm:inline">{formatFullDate(selectedMessage.createdAt)}</span>
                  {isMaster && (
                    <button
                      onClick={() => { if (confirm('پیام حذف شود؟')) { deleteMessageFromCloud(selectedMessage.id); setSelectedMsgId(null); } }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Message Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-sm text-gray-800 leading-7 whitespace-pre-wrap break-words">{selectedMessage.body}</p>

              {selectedMessage.files && selectedMessage.files.length > 0 && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-3">{t.files}</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedMessage.files.map((f, i) => (
                      <a
                        key={i}
                        href={f.content}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                      >
                        <IconFile className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="max-w-[160px] truncate">{f.name}</span>
                        <span className="text-gray-400 shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reply Bar */}
            <div className="px-6 py-3 border-t border-gray-100 shrink-0">
              <button
                onClick={() => {
                  setRecipientIds([selectedMessage.senderId]);
                  setSubject(`${lang === 'fa' ? 'پاسخ:' : 'Re:'} ${selectedMessage.subject}`);
                  setBody(`\n\n— ${selectedMessage.senderName}\n${selectedMessage.body.split('\n').map(l => `> ${l}`).join('\n')}`);
                  setIsComposeOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <IconReply className="w-3.5 h-3.5" />
                {t.reply}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <IconMail className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">{t.noSelect}</p>
          </div>
        )}
      </div>

      {/* ── Compose Modal ── */}
      {isComposeOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setIsComposeOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[80vh] overflow-hidden border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Compose Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h3 className="text-sm font-semibold text-gray-900">{t.compose}</h3>
              <button
                onClick={() => setIsComposeOpen(false)}
                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 text-xs transition-colors"
              >✕</button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* To */}
              <div className="px-5 py-3 border-b border-gray-100">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-400 pt-1 shrink-0 w-12 text-left">{t.recipients}</span>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {personnel.filter(p => p.id !== currentUser.id).map(p => (
                      <button
                        key={p.id}
                        onClick={() => setRecipientIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${recipientIds.includes(p.id) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'}`}
                      >
                        {p.fullName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Subject */}
              <div className="px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 shrink-0 w-12 text-left">{t.subject}</span>
                  <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder={t.subject}
                    className="flex-1 text-sm text-gray-800 outline-none placeholder-gray-300"
                  />
                </div>
              </div>

              {/* Body */}
              <div className="px-5 pt-3 pb-2">
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder={t.writeHere}
                  rows={8}
                  className="w-full text-sm text-gray-800 placeholder-gray-300 outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="px-5 pb-3 border-t border-gray-100 pt-3">
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                        <IconFile className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="max-w-[120px] truncate">{f.name}</span>
                        {f.status === 'uploading' && (
                          <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                        )}
                        <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 transition-colors shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Compose Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50 shrink-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title={lang === 'fa' ? 'افزودن پیوست' : 'Add attachment'}
              >
                <IconPaperclip className="w-4 h-4" />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} multiple />

              <div className="flex items-center gap-2">
                <button onClick={() => setIsComposeOpen(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  {t.cancel}
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={isSending || recipientIds.length === 0 || !subject.trim() || !body.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 text-white rounded-xl text-xs font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isSending
                    ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                    : <IconSend className="w-3.5 h-3.5" />
                  }
                  {t.send}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
