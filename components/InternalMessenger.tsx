
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { InternalMessage, Personnel, AttachedFile } from '../types';
import { IconMail, IconSend, IconInbox, IconPaperclip, IconTrash, IconFile, IconReply, IconPlus, IconSearch, IconUsers, IconArrowRight, IconHistory } from './Icons';
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

  // Compose State
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
          inbox: 'صندوق ورودی',
          sent: 'پیام‌های ارسالی',
          compose: 'نوشتن پیام جدید',
          search: 'جستجو در مکاتبات...',
          subject: 'موضوع پیام',
          body: 'متن پیام',
          recipients: 'ارسال به:',
          send: 'ارسال پیام',
          reply: 'پاسخ سریع',
          delete: 'حذف',
          files: 'فایل‌های پیوست',
          cancel: 'انصراف',
          writeHere: 'اینجا بنویسید...',
          from: 'از طرف:',
          to: 'ارسال شده به:',
          noSelect: 'برای مشاهده محتوا، یک پیام را از لیست انتخاب کنید.',
          empty: 'هنوز پیامی در این بخش وجود ندارد.'
      },
      en: {
          inbox: 'Inbox',
          sent: 'Sent',
          compose: 'Compose New',
          search: 'Search messages...',
          subject: 'Subject',
          body: 'Body',
          recipients: 'To:',
          send: 'Send Message',
          reply: 'Quick Reply',
          delete: 'Delete',
          files: 'Attachments',
          cancel: 'Cancel',
          writeHere: 'Write your message...',
          from: 'From:',
          to: 'To:',
          noSelect: 'Select a message from the list to read.',
          empty: 'No messages here yet.'
      }
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
      return list.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [messages, activeTab, currentUser.id, searchTerm]);

  const selectedMessage = useMemo(() => 
    messages.find(m => m.id === selectedMsgId) || null
  , [messages, selectedMsgId]);

  const handleSendMessage = async () => {
      if (recipientIds.length === 0 || !subject.trim() || !body.trim()) return;
      setIsSending(true);
      try {
          const recipientNames = recipientIds.map(id => personnel.find(p => p.id === id)?.fullName || 'Unknown');
          const newMessage: InternalMessage = { 
              id: `msg-${Date.now()}`, 
              senderId: currentUser.id, 
              senderName: currentUser.fullName, 
              recipientIds, 
              recipientNames, 
              subject, 
              body, 
              files: attachments.filter(f => f.status === 'success'), 
              createdAt: new Date().toISOString(), 
              readBy: [] 
          };
          await sendInternalMessage(newMessage);
          onAfterSend?.(recipientIds, currentUser.fullName, subject);
          setIsComposeOpen(false);
          setRecipientIds([]); setSubject(''); setBody(''); setAttachments([]);
          setActiveTab('sent');
          if (!isMobile) setSelectedMsgId(newMessage.id);
      } catch (e) { alert('Error!'); } finally { setIsSending(false); }
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
          uploadFileWithProgress(file, (progress) => setAttachments(prev => prev.map(f => f.name === file.name ? { ...f, progress } : f)), (url) => setAttachments(prev => prev.map(f => f.name === file.name ? { ...f, content: url, status: 'success', progress: 100 } : f)), (err) => setAttachments(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error' } : f)), 'uploads');
      }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl flex h-[750px] w-full max-w-full overflow-hidden animate-fade-in relative ring-1 ring-black/5">
        
        {/* --- Sidebar (Message List) --- */}
        <div className={`flex flex-col border-l border-gray-100 bg-white transition-all duration-300 relative z-20 shrink-0 ${isMobile && selectedMsgId ? 'hidden' : 'w-full md:w-[360px] lg:w-[400px]'}`}>
            <div className="p-5 border-b border-gray-100 bg-white shrink-0">
                <div className="flex justify-between items-center mb-5">
                    <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><IconMail className="w-5 h-5" /></div>
                        {activeTab === 'inbox' ? t.inbox : t.sent}
                    </h2>
                    <button onClick={() => setIsComposeOpen(true)} className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all hover:scale-110 active:scale-95">
                        <IconPlus className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-2xl mb-4">
                    <button onClick={() => {setActiveTab('inbox'); setSelectedMsgId(null);}} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'inbox' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        <IconInbox className="w-4 h-4" /> {t.inbox}
                    </button>
                    <button onClick={() => {setActiveTab('sent'); setSelectedMsgId(null);}} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'sent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        <IconSend className="w-4 h-4" /> {t.sent}
                    </button>
                </div>

                <div className="relative">
                    <input className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-transparent rounded-2xl text-sm outline-none focus:bg-white focus:border-indigo-300 transition-all font-medium" placeholder={t.search} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <IconSearch className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar bg-gray-50/20">
                {filteredMessages.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-300"><IconMail className="w-8 h-8" /></div>
                        <p className="text-gray-400 text-sm font-bold">{t.empty}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {filteredMessages.map(msg => {
                            const isUnread = activeTab === 'inbox' && !msg.readBy.includes(currentUser.id);
                            const isSelected = selectedMsgId === msg.id;

                            return (
                                <div 
                                    key={msg.id} 
                                    onClick={() => handleSelectMessage(msg)} 
                                    className={`group flex items-start gap-4 p-5 cursor-pointer transition-all relative border-r-4 min-w-0 ${isSelected ? 'bg-white border-indigo-600 shadow-sm z-10' : 'bg-transparent border-transparent hover:bg-white/80'}`}
                                >
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-sm font-black shrink-0 shadow-sm transition-transform group-hover:scale-105 ${activeTab === 'inbox' ? (isUnread ? 'bg-gradient-to-br from-indigo-600 to-blue-700' : 'bg-gradient-to-br from-gray-300 to-gray-400') : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>
                                        {activeTab === 'inbox' ? msg.senderName.charAt(0) : <IconSend className="w-4 h-4" />}
                                    </div>

                                    <div className="flex-grow min-w-0">
                                        <div className="flex justify-between items-center mb-1 gap-2">
                                            <h4 className={`text-sm truncate shrink ${isUnread ? 'font-black text-indigo-900' : 'font-bold text-gray-600'}`}>
                                                {activeTab === 'inbox' ? msg.senderName : msg.recipientNames.join(', ')}
                                            </h4>
                                            <span className="text-[10px] text-gray-400 whitespace-nowrap dir-ltr shrink-0">
                                                {new Date(msg.createdAt).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US')}
                                            </span>
                                        </div>
                                        <div className={`text-xs truncate mb-1.5 ${isUnread ? 'font-black text-gray-900' : 'font-bold text-gray-500'}`}>
                                            {msg.subject}
                                        </div>
                                        <div className={`text-[11px] truncate leading-relaxed ${isUnread ? 'text-gray-600' : 'text-gray-400'}`}>
                                            {msg.body.replace(/\n/g, ' ')}
                                        </div>
                                        {msg.files && msg.files.length > 0 && (
                                            <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-indigo-500 font-black bg-indigo-50 w-fit px-2 py-0.5 rounded-full">
                                                <IconPaperclip className="w-3 h-3" /> {msg.files.length} پیوست
                                            </div>
                                        )}
                                    </div>
                                    
                                    {isUnread && (
                                        <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)] shrink-0 mt-1.5 ring-2 ring-white"></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>

        {/* --- Content Area (Message Details) --- */}
        <div className={`flex-grow flex flex-col bg-white overflow-hidden min-w-0 relative z-10 ${isMobile && !selectedMsgId ? 'hidden' : 'flex'}`}>
            {selectedMessage ? (
                <div className="flex flex-col h-full animate-fade-in">
                    {/* Detail Header */}
                    <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                        <div className="flex items-center gap-4 min-w-0">
                            {isMobile && (
                                <button onClick={() => setSelectedMsgId(null)} className="p-2 -mr-2 hover:bg-gray-100 rounded-xl">
                                    <IconArrowRight className="w-5 h-5 ltr:rotate-180 text-gray-400" />
                                </button>
                            )}
                            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg shadow-inner shrink-0">{selectedMessage.senderName.charAt(0)}</div>
                            <div className="min-w-0">
                                <h3 className="font-black text-gray-900 text-base md:text-lg truncate leading-tight">{selectedMessage.subject}</h3>
                                <p className="text-xs text-gray-400 mt-0.5 truncate">{activeTab === 'inbox' ? t.from : t.to} <span className="font-black text-indigo-600">{activeTab === 'inbox' ? selectedMessage.senderName : selectedMessage.recipientNames.join(', ')}</span></p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                             <span className="hidden lg:inline text-[11px] font-black text-gray-400 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100 dir-ltr">{new Date(selectedMessage.createdAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</span>
                             {isMaster && <button onClick={() => { if(confirm('پیام برای همیشه حذف شود؟')) { deleteMessageFromCloud(selectedMessage.id); setSelectedMsgId(null); } }} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all" title={t.delete}><IconTrash className="w-5 h-5" /></button>}
                        </div>
                    </div>

                    {/* Detail Body */}
                    <div className="flex-grow overflow-y-auto p-6 md:p-10 custom-scrollbar bg-white">
                        <div className="max-w-4xl mx-auto">
                            <div className="bg-white p-6 md:p-12 rounded-[2.5rem] border border-gray-100 shadow-sm text-gray-800 text-sm md:text-base leading-[2] whitespace-pre-wrap break-words min-h-[300px]">
                                {selectedMessage.body}
                            </div>

                            {selectedMessage.files && selectedMessage.files.length > 0 && (
                                <div className="mt-12">
                                    <h4 className="text-[11px] font-black text-gray-400 mb-6 uppercase tracking-[0.2em] flex items-center gap-3">
                                        <div className="w-6 h-px bg-gray-200"></div> {t.files} <div className="flex-grow h-px bg-gray-200"></div>
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {selectedMessage.files.map((f, i) => (
                                            <a key={i} href={f.content} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-5 bg-gray-50 rounded-3xl border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group">
                                                <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:rotate-6">
                                                    <IconFile className="w-6 h-6" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-[13px] font-black text-gray-900 truncate">{f.name}</div>
                                                    <div className="text-[10px] text-gray-400 mt-1 font-bold">{(f.size/1024/1024).toFixed(2)} MB</div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Reply Box */}
                    <div className="p-5 md:p-8 border-t border-gray-100 bg-gray-50/50 shrink-0">
                        <div className="max-w-4xl mx-auto">
                            <button 
                                onClick={() => {
                                    setRecipientIds([selectedMessage.senderId]); 
                                    setSubject(`${lang==='fa'?'پاسخ به:':'Re:'} ${selectedMessage.subject}`); 
                                    setBody(`\n\n--- ${selectedMessage.senderName} ---\n> ${selectedMessage.body}`);
                                    setIsComposeOpen(true); 
                                }}
                                className="w-full bg-white border border-gray-200 rounded-3xl px-8 py-4 text-sm text-gray-400 font-bold hover:border-indigo-300 hover:shadow-lg transition-all text-start flex items-center gap-4 group"
                            >
                                <div className="p-2 bg-indigo-50 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <IconReply className="w-5 h-5 text-indigo-500 group-hover:text-white" />
                                </div>
                                {t.reply}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-gray-400 p-10 text-center animate-fade-in bg-gray-50/30">
                    <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center mb-8 shadow-xl shadow-indigo-100/50 ring-1 ring-indigo-50">
                        <IconMail className="w-16 h-16 text-indigo-100" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-3">{t.noSelect}</h3>
                    <p className="text-sm max-w-sm leading-relaxed font-medium text-gray-400">{activeTab === 'inbox' ? 'صندوق ورودی شما خالی است یا پیامی را انتخاب نکرده‌اید.' : 'مکاتبات ارسال شده را می‌توانید از لیست سمت راست مدیریت کنید.'}</p>
                </div>
            )}
        </div>

        {/* --- Compose Full-Screen Modal --- */}
        {isComposeOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xl animate-fade-in" onClick={() => setIsComposeOpen(false)}>
                <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-white/20" onClick={e => e.stopPropagation()}>
                    <div className="p-10 pb-6 border-b border-gray-50 flex justify-between items-start bg-white shrink-0">
                        <div>
                            <h3 className="font-black text-3xl text-gray-900 flex items-center gap-4">
                                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                                    <IconPlus className="w-7 h-7" />
                                </div>
                                {t.compose}
                            </h3>
                            <p className="text-xs text-gray-400 mt-3 font-black uppercase tracking-widest bg-gray-50 w-fit px-3 py-1 rounded-full">سیستم مکاتبات سازمانی امن</p>
                        </div>
                        <button onClick={() => setIsComposeOpen(false)} className="p-4 hover:bg-red-50 hover:text-red-500 rounded-3xl transition-all hover:rotate-90">✕</button>
                    </div>
                    
                    <div className="p-10 pt-4 flex-grow overflow-y-auto custom-scrollbar space-y-10">
                        <div>
                            <label className="text-[11px] font-black text-indigo-600 mb-3 block uppercase tracking-[0.2em]">{t.recipients}</label>
                            <div className="flex flex-wrap gap-2.5 p-4 bg-gray-50/50 border border-gray-100 rounded-[2rem] max-h-40 overflow-y-auto custom-scrollbar">
                                {personnel.filter(p => p.id !== currentUser.id).map(p => (
                                    <button 
                                        key={p.id} 
                                        onClick={() => setRecipientIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])} 
                                        className={`px-5 py-2.5 rounded-2xl text-[13px] font-black transition-all border shadow-sm ${recipientIds.includes(p.id) ? 'bg-indigo-600 text-white border-indigo-600 scale-105' : 'bg-white text-gray-500 border-gray-100 hover:border-indigo-300 hover:text-indigo-600'}`}
                                    >
                                        {p.fullName}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-black text-indigo-600 mb-3 block uppercase tracking-[0.2em]">{t.subject}</label>
                            <input className="w-full py-5 px-8 text-base font-black bg-gray-50/50 border border-transparent rounded-[2rem] outline-none focus:bg-white focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-50/50 transition-all" placeholder={t.subject} value={subject} onChange={e => setSubject(e.target.value)} />
                        </div>

                        <div className="flex-grow">
                            <label className="text-[11px] font-black text-indigo-600 mb-3 block uppercase tracking-[0.2em]">{t.body}</label>
                            <textarea className="w-full h-72 py-6 px-8 text-base text-gray-700 font-medium bg-gray-50/50 border border-transparent rounded-[2.5rem] outline-none focus:bg-white focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-50/50 transition-all resize-none custom-scrollbar" placeholder={t.writeHere} value={body} onChange={e => setBody(e.target.value)} />
                        </div>

                        {attachments.length > 0 && (
                            <div className="animate-slide-in">
                                <label className="text-[11px] font-black text-indigo-600 mb-4 block uppercase tracking-[0.2em]">{t.files}</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{attachments.map((f, i) => (
                                    <div key={i} className="flex items-center justify-between gap-4 bg-indigo-50/50 p-4 rounded-3xl border border-indigo-100 group">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm"><IconFile className="w-4 h-4" /></div>
                                            <span className="text-[13px] font-black truncate text-indigo-900">{f.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {f.status === 'uploading' && <div className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div><span className="text-[10px] text-indigo-600 font-black">{Math.round(f.progress || 0)}%</span></div>}
                                            <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 hover:bg-red-100 text-red-500 rounded-xl transition-colors">✕</button>
                                        </div>
                                    </div>
                                ))}</div>
                            </div>
                        )}
                    </div>

                    <div className="p-10 border-t border-gray-50 flex items-center justify-between bg-white shrink-0">
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 text-indigo-600 font-black text-sm hover:bg-indigo-50 px-6 py-4 rounded-[1.5rem] transition-all border border-transparent hover:border-indigo-100">
                            <IconPaperclip className="w-5 h-5" /> {lang==='fa'?'افزودن پیوست':'Add Files'}
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} multiple />
                        
                        <div className="flex gap-4">
                            <button onClick={() => setIsComposeOpen(false)} className="px-8 py-4 text-sm font-black text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest">{t.cancel}</button>
                            <button 
                                onClick={handleSendMessage} 
                                disabled={isSending || recipientIds.length === 0 || !subject.trim()} 
                                className="bg-indigo-600 text-white px-12 py-4 rounded-[1.5rem] text-sm font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale transition-all flex items-center gap-3"
                            >
                                {isSending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <IconSend className="w-5 h-5" />}
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
