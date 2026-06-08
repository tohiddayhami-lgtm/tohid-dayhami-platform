
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { InternalMessage, Personnel, AttachedFile, ContactReply, MessageReferral, Department } from '../types';
import { IconMail, IconSend, IconInbox, IconPaperclip, IconTrash, IconFile, IconReply, IconPlus, IconSearch, IconArrowRight, IconFolder } from './Icons';
import { sendInternalMessage, updateMessageInCloud, deleteMessageFromCloud, uploadFileWithProgress } from '../services/firebaseService';
import { getStaffCode, findPersonnelByCode } from '../services/staffId';
import { Language } from '../App';

interface Props {
  currentUser: Personnel;
  personnel: Personnel[];
  messages: InternalMessage[];
  lang: Language;
  departments?: Department[];
  onAfterSend?: (recipientIds: string[], senderName: string, subject: string) => void;
}

export const InternalMessenger: React.FC<Props> = ({ currentUser, personnel, messages, lang, departments = [], onAfterSend }) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'contacts' | 'archive'>('inbox');
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [recipientCode, setRecipientCode] = useState(''); // staff ID typed to add a recipient
  const [recipientError, setRecipientError] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline reply to a customer "Contact Us" message (appended to the message thread)
  const [contactReplyText, setContactReplyText] = useState('');
  const [isReplyingContact, setIsReplyingContact] = useState(false);

  // Refer / forward a correspondence to other personnel or a department
  const [isReferOpen, setIsReferOpen] = useState(false);
  const [referPersonnelIds, setReferPersonnelIds] = useState<string[]>([]);
  const [referDeptId, setReferDeptId] = useState('');
  const [referNote, setReferNote] = useState('');
  const [isReferring, setIsReferring] = useState(false);

  const isMaster = currentUser.username === 'master';

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const t = {
    fa: {
      inbox: 'صندوق ورودی', sent: 'ارسال‌شده', allContacts: 'همه مکاتبات', archiveTab: 'آرشیو',
      archive: 'آرشیو', unarchive: 'خروج از آرشیو',
      compose: 'پیام جدید', search: 'جستجو...',
      subject: 'موضوع', body: 'متن پیام',
      recipients: 'گیرندگان', send: 'ارسال',
      recipientIdPlaceholder: 'آی دی پرسنلی گیرنده را وارد کنید',
      addRecipient: 'افزودن',
      recipientNotFound: 'پرسنلی با این آی دی یافت نشد.',
      recipientSelf: 'نمی‌توانید برای خودتان ارسال کنید.',
      yourId: 'آی دی پرسنلی شما:',
      staffIdLabel: 'آی دی:',
      reply: 'پاسخ', delete: 'حذف',
      files: 'پیوست‌ها', cancel: 'انصراف',
      writeHere: 'متن پیام را بنویسید...',
      from: 'از:', to: 'به:',
      noSelect: 'یک پیام انتخاب کنید',
      empty: 'پیامی وجود ندارد',
      contactBadge: 'تماس از مشتری',
      contactPhone: 'موبایل:',
      contactDept: 'دپارتمان:',
      repliesTitle: 'پاسخ‌ها به مشتری',
      replyPlaceholder: 'پاسخ خود را بنویسید... (مشتری این پاسخ را در صفحه پیگیری می‌بیند)',
      sendReply: 'ارسال پاسخ',
      noReplyYet: 'هنوز پاسخی ثبت نشده است.',
      trackingCode: 'کد رهگیری:',
      refer: 'ارجاع',
      referTitle: 'ارجاع مکاتبه',
      referToPersonnel: 'ارجاع به پرسنل',
      referToDept: 'ارجاع به دپارتمان',
      referDeptPlaceholder: '— انتخاب دپارتمان —',
      referNotePlaceholder: 'یادداشت (اختیاری)...',
      referSubmit: 'ثبت ارجاع',
      referHistory: 'سوابق ارجاع',
      referredBy: 'ارجاع توسط',
      referredTo: 'به',
      referEmpty: 'حداقل یک پرسنل یا دپارتمان را انتخاب کنید.',
    },
    en: {
      inbox: 'Inbox', sent: 'Sent', allContacts: 'All correspondence', archiveTab: 'Archive',
      archive: 'Archive', unarchive: 'Unarchive',
      compose: 'New Message', search: 'Search...',
      subject: 'Subject', body: 'Message',
      recipients: 'To', send: 'Send',
      recipientIdPlaceholder: 'Enter the recipient personnel ID',
      addRecipient: 'Add',
      recipientNotFound: 'No personnel found with this ID.',
      recipientSelf: 'You cannot message yourself.',
      yourId: 'Your personnel ID:',
      staffIdLabel: 'ID:',
      reply: 'Reply', delete: 'Delete',
      files: 'Attachments', cancel: 'Cancel',
      writeHere: 'Write your message...',
      from: 'From:', to: 'To:',
      noSelect: 'Select a message',
      empty: 'No messages',
      contactBadge: 'Customer enquiry',
      contactPhone: 'Mobile:',
      contactDept: 'Department:',
      repliesTitle: 'Replies to customer',
      replyPlaceholder: 'Write your reply... (the customer sees it on the tracking page)',
      sendReply: 'Send reply',
      noReplyYet: 'No reply yet.',
      trackingCode: 'Tracking code:',
      refer: 'Refer',
      referTitle: 'Refer correspondence',
      referToPersonnel: 'Refer to personnel',
      referToDept: 'Refer to a department',
      referDeptPlaceholder: '— Select a department —',
      referNotePlaceholder: 'Note (optional)...',
      referSubmit: 'Submit referral',
      referHistory: 'Referral history',
      referredBy: 'Referred by',
      referredTo: 'to',
      referEmpty: 'Select at least one staff member or a department.',
    },
  }[lang];

  const isArchived = (m: InternalMessage) => (m.archivedBy || []).includes(currentUser.id);

  const filteredMessages = useMemo(() => {
    let list = activeTab === 'archive'
      // Everything the current user archived (whether received, sent, or a correspondence)
      ? messages.filter(m => (m.archivedBy || []).includes(currentUser.id))
      : activeTab === 'inbox'
      ? messages.filter(m => m.recipientIds.includes(currentUser.id) && !(m.archivedBy || []).includes(currentUser.id))
      : activeTab === 'sent'
      ? messages.filter(m => m.senderId === currentUser.id && !(m.archivedBy || []).includes(currentUser.id))
      // Master-only: every customer correspondence in the system (even if not a recipient), excluding archived
      : messages.filter(m => m.isCustomerContact && !(m.archivedBy || []).includes(currentUser.id));
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(m =>
        m.subject.toLowerCase().includes(term) ||
        m.body.toLowerCase().includes(term) ||
        m.senderName.toLowerCase().includes(term) ||
        (m.contactTrackingCode || '').toLowerCase().includes(term) ||
        (m.contactPhone || '').includes(term) ||
        (m.contactDepartmentName || '').toLowerCase().includes(term)
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
      setRecipientIds([]); setRecipientCode(''); setRecipientError(''); setSubject(''); setBody(''); setAttachments([]);
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

  // Archive / unarchive a message for the current user only (keeps inbox/sent tidy)
  const handleToggleArchive = (msg: InternalMessage) => {
    const archived = (msg.archivedBy || []).includes(currentUser.id);
    const next = archived
      ? (msg.archivedBy || []).filter(id => id !== currentUser.id)
      : [...(msg.archivedBy || []), currentUser.id];
    updateMessageInCloud(msg.id, { archivedBy: next });
    setSelectedMsgId(null);
  };

  // Add a recipient by typing their personnel ID (no full company list is shown)
  const addRecipientByCode = () => {
    const person = findPersonnelByCode(personnel, recipientCode);
    if (!person) { setRecipientError(t.recipientNotFound); return; }
    if (person.id === currentUser.id) { setRecipientError(t.recipientSelf); return; }
    if (!recipientIds.includes(person.id)) setRecipientIds(prev => [...prev, person.id]);
    setRecipientCode(''); setRecipientError('');
  };

  const handleContactReply = async () => {
    if (!selectedMessage || !contactReplyText.trim()) return;
    setIsReplyingContact(true);
    try {
      const reply: ContactReply = {
        id: `r-${Date.now()}`,
        authorId: currentUser.id,
        authorName: currentUser.fullName,
        body: contactReplyText.trim(),
        createdAt: new Date().toISOString(),
      };
      await updateMessageInCloud(selectedMessage.id, { replies: [...(selectedMessage.replies || []), reply] });
      setContactReplyText('');
    } catch { alert(lang === 'fa' ? 'خطا در ارسال پاسخ' : 'Failed to send reply'); }
    finally { setIsReplyingContact(false); }
  };

  // Personnel whose سمت belongs to the given department
  const deptStaff = (deptId: string): Personnel[] => {
    const dept = departments.find(d => d.id === deptId);
    if (!dept) return [];
    return personnel.filter(p => (p.roles || []).some(r => (dept.positions || []).includes(r)));
  };

  const openRefer = () => { setReferPersonnelIds([]); setReferDeptId(''); setReferNote(''); setIsReferOpen(true); };

  const handleRefer = async () => {
    if (!selectedMessage) return;
    const dept = referDeptId ? departments.find(d => d.id === referDeptId) : undefined;
    const deptIds = referDeptId ? deptStaff(referDeptId).map(p => p.id) : [];
    const referredIds = Array.from(new Set([...referPersonnelIds, ...deptIds]));
    if (referredIds.length === 0) { alert(t.referEmpty); return; }
    setIsReferring(true);
    try {
      const nameOf = (id: string) => personnel.find(p => p.id === id)?.fullName || 'Unknown';
      const referredNames = referredIds.map(nameOf);
      // Merge referred personnel into the message recipients so it lands in their کارتابل
      const newRecipientIds = Array.from(new Set([...(selectedMessage.recipientIds || []), ...referredIds]));
      const newRecipientNames = newRecipientIds.map(nameOf);
      const referral: MessageReferral = {
        id: `ref-${Date.now()}`,
        byId: currentUser.id,
        byName: currentUser.fullName,
        toNames: referredNames,
        departmentName: dept?.name,
        note: referNote.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      await updateMessageInCloud(selectedMessage.id, {
        recipientIds: newRecipientIds,
        recipientNames: newRecipientNames,
        referrals: [...(selectedMessage.referrals || []), referral],
      });
      // Notify the newly referred personnel (e.g. WhatsApp), reusing the existing pipeline
      onAfterSend?.(referredIds, currentUser.fullName, selectedMessage.subject);
      setIsReferOpen(false);
    } catch { alert(lang === 'fa' ? 'خطا در ثبت ارجاع' : 'Failed to refer'); }
    finally { setIsReferring(false); }
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
              {activeTab === 'inbox' ? t.inbox : activeTab === 'sent' ? t.sent : activeTab === 'archive' ? t.archiveTab : t.allContacts}
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
            {isMaster && (
              <button
                onClick={() => { setActiveTab('contacts'); setSelectedMsgId(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'contacts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <IconMail className="w-3.5 h-3.5" />
                {t.allContacts}
              </button>
            )}
            <button
              onClick={() => { setActiveTab('archive'); setSelectedMsgId(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'archive' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <IconFolder className="w-3.5 h-3.5" />
              {t.archiveTab}
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
                      {activeTab === 'sent' ? getInitial(currentUser.fullName) : getInitial(msg.senderName)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <span className={`text-xs truncate ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
                          {activeTab === 'sent' ? msg.recipientNames.join('، ') : msg.senderName}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">{formatDate(msg.createdAt)}</span>
                      </div>
                      <div className={`text-xs truncate mb-0.5 ${isUnread ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                        {msg.subject}
                      </div>
                      {msg.contactTrackingCode && (
                        <span className="inline-block text-[9px] font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded mb-0.5" dir="ltr">{msg.contactTrackingCode}</span>
                      )}
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
                  <button
                    onClick={openRefer}
                    className="flex items-center gap-1 px-2.5 h-7 rounded-lg border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors text-xs font-medium"
                    title={t.referTitle}
                  >
                    <IconArrowRight className="w-3.5 h-3.5 ltr:rotate-180" />
                    {t.refer}
                  </button>
                  <button
                    onClick={() => handleToggleArchive(selectedMessage)}
                    className="flex items-center gap-1 px-2.5 h-7 rounded-lg border border-gray-200 text-gray-600 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 transition-colors text-xs font-medium"
                    title={isArchived(selectedMessage) ? t.unarchive : t.archive}
                  >
                    <IconFolder className="w-3.5 h-3.5" />
                    {isArchived(selectedMessage) ? t.unarchive : t.archive}
                  </button>
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
              {selectedMessage.isCustomerContact && (
                <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{t.contactBadge}</span>
                  {selectedMessage.contactTrackingCode && <span className="text-xs text-amber-900 font-semibold flex items-center gap-1">{t.trackingCode} <b className="font-mono bg-amber-900 text-white px-1.5 py-0.5 rounded" dir="ltr">{selectedMessage.contactTrackingCode}</b></span>}
                  {selectedMessage.contactDepartmentName && <span className="text-xs text-amber-800">{t.contactDept} <b>{selectedMessage.contactDepartmentName}</b></span>}
                  {selectedMessage.contactPhone && <span className="text-xs text-amber-800" dir="ltr">{t.contactPhone} {selectedMessage.contactPhone}</span>}
                </div>
              )}
              <p className="text-sm text-gray-800 leading-7 whitespace-pre-wrap break-words">{selectedMessage.body}</p>

              {selectedMessage.referrals && selectedMessage.referrals.length > 0 && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5"><IconArrowRight className="w-3.5 h-3.5 ltr:rotate-180" />{t.referHistory}</p>
                  <div className="space-y-2">
                    {selectedMessage.referrals.map(r => (
                      <div key={r.id} className="bg-blue-50/60 border border-blue-100 rounded-xl px-3 py-2">
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <span className="text-[11px] text-blue-800">
                            <b>{r.byName}</b> {t.referredTo}: {r.departmentName ? <b>{r.departmentName}</b> : r.toNames.join('، ')}
                          </span>
                          <span className="text-[10px] text-gray-400" dir="ltr">{formatFullDate(r.createdAt)}</span>
                        </div>
                        {r.note && <p className="text-xs text-gray-700 whitespace-pre-wrap break-words">{r.note}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedMessage.isCustomerContact && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5"><IconReply className="w-3.5 h-3.5" />{t.repliesTitle}</p>
                  {(!selectedMessage.replies || selectedMessage.replies.length === 0) ? (
                    <p className="text-xs text-gray-400 mb-3">{t.noReplyYet}</p>
                  ) : (
                    <div className="space-y-2 mb-3">
                      {selectedMessage.replies.map(r => (
                        <div key={r.id} className="bg-emerald-50/60 border border-emerald-100 rounded-xl px-3 py-2">
                          <div className="flex items-baseline justify-between gap-2 mb-0.5">
                            <span className="text-[11px] font-semibold text-emerald-700">{r.authorName}</span>
                            <span className="text-[10px] text-gray-400" dir="ltr">{formatFullDate(r.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{r.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={contactReplyText}
                      onChange={e => setContactReplyText(e.target.value)}
                      rows={2}
                      placeholder={t.replyPlaceholder}
                      className="flex-1 text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 resize-none"
                    />
                    <button
                      onClick={handleContactReply}
                      disabled={isReplyingContact || !contactReplyText.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-medium hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                      {isReplyingContact ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : <IconSend className="w-3.5 h-3.5" />}
                      {t.sendReply}
                    </button>
                  </div>
                </div>
              )}

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

            {/* Reply Bar (internal messages only — contact messages reply inline above) */}
            {!selectedMessage.isCustomerContact && (
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
            )}
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

      {/* ── Refer / Forward Modal ── */}
      {isReferOpen && selectedMessage && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setIsReferOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[80vh] overflow-hidden border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h3 className="text-sm font-semibold text-gray-900">{t.referTitle}</h3>
              <button onClick={() => setIsReferOpen(false)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 text-xs transition-colors">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Refer to a department */}
              {departments.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">{t.referToDept}</label>
                  <select
                    value={referDeptId}
                    onChange={e => setReferDeptId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-blue-400"
                  >
                    <option value="">{t.referDeptPlaceholder}</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({deptStaff(d.id).length})</option>)}
                  </select>
                </div>
              )}

              {/* Refer to specific personnel */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{t.referToPersonnel}</label>
                <div className="flex flex-wrap gap-1.5">
                  {personnel.filter(p => p.id !== currentUser.id).map(p => (
                    <button
                      key={p.id}
                      onClick={() => setReferPersonnelIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${referPersonnelIds.includes(p.id) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'}`}
                    >
                      {p.fullName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional note */}
              <div>
                <textarea
                  value={referNote}
                  onChange={e => setReferNote(e.target.value)}
                  rows={2}
                  placeholder={t.referNotePlaceholder}
                  className="w-full text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50 shrink-0">
              <button onClick={() => setIsReferOpen(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">{t.cancel}</button>
              <button
                onClick={handleRefer}
                disabled={isReferring || (referPersonnelIds.length === 0 && !referDeptId)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 text-white rounded-xl text-xs font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isReferring ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : <IconArrowRight className="w-3.5 h-3.5 ltr:rotate-180" />}
                {t.referSubmit}
              </button>
            </div>
          </div>
        </div>
      )}

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
              {/* To — by personnel ID (no full company list shown) */}
              <div className="px-5 py-3 border-b border-gray-100">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-400 pt-2 shrink-0 w-12 text-left">{t.recipients}</span>
                  <div className="flex-1 min-w-0">
                    {/* Added recipients as chips */}
                    {recipientIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {recipientIds.map(id => {
                          const p = personnel.find(pp => pp.id === id);
                          if (!p) return null;
                          return (
                            <span key={id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500 text-white">
                              {p.fullName}
                              <span className="font-mono text-[10px] opacity-80" dir="ltr">{getStaffCode(p)}</span>
                              <button onClick={() => setRecipientIds(prev => prev.filter(rid => rid !== id))} className="hover:text-white/70">✕</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {/* ID input */}
                    <div className="flex items-center gap-2">
                      <input
                        value={recipientCode}
                        onChange={e => { setRecipientCode(e.target.value); setRecipientError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRecipientByCode(); } }}
                        placeholder={t.recipientIdPlaceholder}
                        dir="ltr"
                        className="flex-1 min-w-0 text-sm text-gray-800 placeholder-gray-300 border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
                      />
                      <button type="button" onClick={addRecipientByCode}
                        className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-black transition-colors shrink-0">
                        {t.addRecipient}
                      </button>
                    </div>
                    {/* Live resolved-name hint */}
                    {recipientCode.trim() && !recipientError && (() => {
                      const match = findPersonnelByCode(personnel, recipientCode);
                      return match
                        ? <p className="text-[11px] text-emerald-600 mt-1.5">✓ {match.fullName}</p>
                        : <p className="text-[11px] text-gray-400 mt-1.5">{t.recipientNotFound}</p>;
                    })()}
                    {recipientError && <p className="text-[11px] text-red-500 mt-1.5">{recipientError}</p>}
                    {/* Your own ID, for sharing with colleagues */}
                    <p className="text-[10px] text-gray-400 mt-2">{t.yourId} <span className="font-mono text-gray-600" dir="ltr">{getStaffCode(currentUser)}</span></p>
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
