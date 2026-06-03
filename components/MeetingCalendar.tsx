
import React, { useState } from 'react';
import { Meeting, Personnel } from '../types';
import { IconCalendarClock, IconPlus, IconMapPin, IconUsers, IconTrash, IconClock, IconEdit } from './Icons';
import { saveMeetingToCloud, deleteMeetingFromCloud, updateMeetingInCloud } from '../services/firebaseService';
import { Language } from '../App';

interface Props {
  meetings: Meeting[];
  currentUser: Personnel;
  personnel: Personnel[];
  lang: Language;
}

export const MeetingCalendar: React.FC<Props> = ({ meetings, currentUser, personnel, lang }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showModal, setShowModal] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
      title: '',
      startTime: '10:00',
      endTime: '11:00',
      location: '',
      attendeeIds: [] as string[],
      description: ''
  });

  const t = {
      fa: {
          header: 'جدول زمانی و تقویم جلسات',
          sub: 'مشاهده و تنظیم جلسات کاری برای تمام پرسنل',
          prev: 'قبلی',
          next: 'بعدی',
          today: 'امروز',
          new: 'جلسه جدید',
          add: 'افزودن جلسه',
          edit: 'ویرایش جلسه',
          title: 'موضوع جلسه',
          start: 'ساعت شروع',
          end: 'ساعت پایان',
          location: 'مکان / لینک جلسه',
          attendees: 'دعوت از همکاران',
          desc: 'توضیحات (اختیاری)',
          save: 'ثبت در تقویم',
          update: 'بروزرسانی',
          deleteConfirm: 'آیا از حذف این جلسه اطمینان دارید؟',
          online: 'آنلاین',
          organizer: 'تنظیم‌کننده'
      },
      en: {
          header: 'Meeting Calendar & Schedule',
          sub: 'View and schedule meetings for all staff',
          prev: 'Prev',
          next: 'Next',
          today: 'Today',
          new: 'New Meeting',
          add: 'Add Meeting',
          edit: 'Edit Meeting',
          title: 'Meeting Title',
          start: 'Start Time',
          end: 'End Time',
          location: 'Location / Link',
          attendees: 'Invite Colleagues',
          desc: 'Description (Optional)',
          save: 'Save to Calendar',
          update: 'Update',
          deleteConfirm: 'Are you sure you want to delete this meeting?',
          online: 'Online',
          organizer: 'Organizer'
      }
  }[lang];

  const hours = Array.from({ length: 13 }, (_, i) => i + 8); 

  const handleOpenCreate = (startTime?: string, endTime?: string) => {
      setEditingMeetingId(null);
      setFormData({ title: '', startTime: startTime || '10:00', endTime: endTime || '11:00', location: '', attendeeIds: [], description: '' });
      setShowModal(true);
  };

  const handleOpenEdit = (meeting: Meeting) => {
      setEditingMeetingId(meeting.id);
      setFormData({ title: meeting.title, startTime: meeting.startTime, endTime: meeting.endTime, location: meeting.location, attendeeIds: meeting.attendeeIds, description: meeting.description || '' });
      setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title) return;
      if (editingMeetingId) {
          await updateMeetingInCloud(editingMeetingId, { title: formData.title, date: selectedDate, startTime: formData.startTime, endTime: formData.endTime, location: formData.location, attendeeIds: formData.attendeeIds, description: formData.description }, currentUser.fullName);
      } else {
          const meeting: Meeting = { id: `meet-${Date.now()}`, title: formData.title, date: selectedDate, startTime: formData.startTime, endTime: formData.endTime, location: formData.location, organizerId: currentUser.id, organizerName: currentUser.fullName, attendeeIds: formData.attendeeIds, description: formData.description };
          await saveMeetingToCloud(meeting);
      }
      setShowModal(false);
  };

  const handleDelete = async (id: string) => { if (window.confirm(t.deleteConfirm)) { await deleteMeetingFromCloud(id); } };
  const getMeetingsForHour = (hour: number) => { return meetings.filter(m => { if (m.date !== selectedDate) return false; const startH = parseInt(m.startTime.split(':')[0]); return startH === hour; }); };
  const changeDate = (days: number) => { const date = new Date(selectedDate); date.setDate(date.getDate() + days); setSelectedDate(date.toISOString().split('T')[0]); };
  const toggleAttendee = (id: string) => { setFormData(prev => { const exists = prev.attendeeIds.includes(id); return { ...prev, attendeeIds: exists ? prev.attendeeIds.filter(pid => pid !== id) : [...prev.attendeeIds, id] }; }); };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm gap-4"><div><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg"><IconCalendarClock className="w-6 h-6" /></div>{t.header}</h2><p className="text-sm text-gray-500 mt-1">{t.sub}</p></div><div className="flex items-center gap-4 bg-gray-50 p-2 rounded-xl"><button onClick={() => changeDate(-1)} className="px-3 py-1 bg-white rounded shadow text-gray-600 hover:text-indigo-600">{t.prev}</button><div className="text-center w-32"><span className="block font-bold text-gray-800 dir-ltr">{selectedDate}</span><span className="text-xs text-gray-500">{new Date(selectedDate).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US', { weekday: 'long' })}</span></div><button onClick={() => changeDate(1)} className="px-3 py-1 bg-white rounded shadow text-gray-600 hover:text-indigo-600">{t.next}</button><button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="text-xs text-indigo-600 font-bold px-2">{t.today}</button></div><button onClick={() => handleOpenCreate()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-200"><IconPlus className="w-5 h-5" /> {t.new}</button></div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"><div className="divide-y divide-gray-100">{hours.map(hour => { const slotMeetings = getMeetingsForHour(hour); return (<div key={hour} className="flex min-h-[100px] group hover:bg-gray-50 transition-colors"><div className="w-20 border-r border-l border-gray-100 p-4 text-center text-gray-500 font-mono text-sm bg-gray-50/50">{hour}:00</div><div className="flex-grow p-2 relative"><div className="absolute top-1/2 w-full h-px bg-gray-100 border-t border-dashed border-gray-200 -z-10"></div>{slotMeetings.length === 0 && (<div className="h-full flex items-center px-4 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleOpenCreate(`${hour}:00`, `${hour + 1}:00`)} className="text-xs text-indigo-400 bg-white border border-indigo-100 px-2 py-1 rounded hover:bg-indigo-50">+ {t.add}</button></div>)}<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">{slotMeetings.map(meeting => (<div key={meeting.id} className="bg-indigo-50 border-r-4 border-l-4 border-indigo-500 rounded p-3 text-sm shadow-sm relative group/card hover:shadow-md transition-shadow"><div className="font-bold text-gray-800 mb-1 px-6">{meeting.title}</div><div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-2"><span className="flex items-center gap-1"><IconClock className="w-3 h-3" /> {meeting.startTime} - {meeting.endTime}</span><span className="flex items-center gap-1"><IconMapPin className="w-3 h-3" /> {meeting.location || t.online}</span></div><div className="flex items-center gap-1 text-xs text-gray-500"><IconUsers className="w-3 h-3" /><span>{meeting.attendeeIds.length}</span><span className="text-gray-400 mx-1">|</span><span>{t.organizer}: {meeting.organizerName}</span></div><div className="absolute top-2 right-2 left-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">{(meeting.organizerId === currentUser.id || currentUser.roles.includes('مدیر')) && (<><button onClick={() => handleOpenEdit(meeting)} className="text-blue-400 hover:text-blue-600 bg-white rounded-full p-1 shadow" title="Edit"><IconEdit className="w-3 h-3" /></button><button onClick={() => handleDelete(meeting.id)} className="text-red-400 hover:text-red-600 bg-white rounded-full p-1 shadow" title="Delete"><IconTrash className="w-3 h-3" /></button></>)}</div></div>))}</div></div></div>); })}</div></div>
        {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in"><div className="p-5 border-b border-gray-100 flex justify-between items-center bg-indigo-50 rounded-t-2xl"><h3 className="font-bold text-indigo-900">{editingMeetingId ? t.edit : t.new} - {selectedDate}</h3><button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button></div><form onSubmit={handleSubmit} className="p-6 space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.title}</label><input required className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.start}</label><input type="time" required className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-center" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.end}</label><input type="time" required className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-center" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} /></div></div><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.location}</label><input className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.attendees}</label><div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-lg max-h-32 overflow-y-auto">{personnel.map(p => (<button key={p.id} type="button" onClick={() => toggleAttendee(p.id)} className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${formData.attendeeIds.includes(p.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>{p.fullName}</button>))}</div></div><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.desc}</label><textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div><div className="flex justify-end pt-2"><button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">{editingMeetingId ? t.update : t.save}</button></div></form></div></div>
        )}
    </div>
  );
};
