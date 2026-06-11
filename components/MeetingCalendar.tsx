
import React, { useState, useRef, useEffect } from 'react';
import { Meeting, Personnel, NotificationConfig } from '../types';
import { IconCalendarClock, IconPlus, IconMapPin, IconUsers, IconTrash, IconClock, IconEdit, IconCopy } from './Icons';
import { saveMeetingToCloud, deleteMeetingFromCloud, updateMeetingInCloud, saveNotificationLog } from '../services/firebaseService';
import { sendWhatsAppNotification, sendMasterCopy, renderTemplate, buildLog, DEFAULT_MEETING_CREATED_TEMPLATE, DEFAULT_MEETING_UPDATED_TEMPLATE, DEFAULT_MEETING_DELETED_TEMPLATE } from '../services/notificationService';
import { StaffIdPicker } from './StaffIdPicker';
import { Language } from '../App';

const HOUR_HEIGHT = 52; // px per hour — compact
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const MEETING_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-600', 'bg-fuchsia-600', 'bg-teal-500',
  'bg-indigo-500', 'bg-orange-500',
];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const diff = (d.getDay() - 6 + 7) % 7; // Saturday start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(ws: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function toDateStr(d: Date): string {
  // Use local date parts — toISOString() shifts to UTC and causes off-by-one in UTC+3:30
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function addMinutes(t: string, mins: number): string {
  const total = Math.min(timeToMinutes(t) + mins, 23 * 60 + 59);
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

function getMeetingColor(m: Meeting): string {
  const h = m.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return MEETING_COLORS[h % MEETING_COLORS.length];
}

interface Props {
  meetings: Meeting[];
  currentUser: Personnel;
  personnel: Personnel[];
  lang: Language;
  notificationConfig?: NotificationConfig;
}

export const MeetingCalendar: React.FC<Props> = ({ meetings, currentUser, personnel, lang, notificationConfig }) => {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [showModal, setShowModal] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '', date: toDateStr(new Date()),
    startTime: '09:00', endTime: '10:00',
    location: '', attendeeIds: [] as string[], description: '',
  });
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, []);

  const fa = lang === 'fa';
  const todayStr = toDateStr(new Date());
  const weekDays = getWeekDays(weekStart);

  const DAY_FA  = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه'];
  const DAY_FA_SHORT = ['ش','ی','د','س','چ','پ','ج'];
  const DAY_EN  = ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];
  const MON_FA  = ['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'];
  const MON_EN  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const getDayName = (d: Date, short = false) => {
    const idx = d.getDay() === 6 ? 0 : d.getDay() + 1;
    return fa ? (short ? DAY_FA_SHORT[idx] : DAY_FA[idx]) : DAY_EN[idx];
  };

  const getWeekRange = () => {
    const s = weekDays[0], e = weekDays[6];
    const ms = fa ? MON_FA[s.getMonth()] : MON_EN[s.getMonth()];
    const me = fa ? MON_FA[e.getMonth()] : MON_EN[e.getMonth()];
    return s.getMonth() === e.getMonth()
      ? `${ms} ${s.getDate()}–${e.getDate()}`
      : `${ms} ${s.getDate()} – ${me} ${e.getDate()}`;
  };

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); };
  const goToday  = () => setWeekStart(getWeekStart(new Date()));

  const handleOpenCreate = (date?: string, st?: string, et?: string) => {
    setEditingMeetingId(null);
    const s = st || '09:00';
    setFormData({ title: '', date: date || todayStr, startTime: s, endTime: et || addMinutes(s, 60), location: '', attendeeIds: [], description: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (m: Meeting) => {
    setEditingMeetingId(m.id);
    setFormData({ title: m.title, date: m.date, startTime: m.startTime, endTime: m.endTime, location: m.location, attendeeIds: m.attendeeIds, description: m.description || '' });
    setShowModal(true);
  };

  // ── Notifications ────────────────────────────────────────────────
  const sendMeetingCreatedNotifications = async (meeting: Meeting) => {
    const nc = notificationConfig;
    if (!nc?.enabled || nc.onMeetingCreated === false) return;
    for (const pid of [...new Set(meeting.attendeeIds || [])]) {
      const person = personnel.find(p => p.id === pid); if (!person) continue;
      const phone = nc.personnelPhones?.[pid]; if (!phone) continue;
      const apiKey = nc.personnelApiKeys?.[pid];
      if (nc.provider === 'callmebot' && !apiKey) continue;
      const msg = renderTemplate(nc.meetingCreatedTemplate || DEFAULT_MEETING_CREATED_TEMPLATE, {
        recipientName: person.fullName, meetingTitle: meeting.title, meetingDate: meeting.date,
        meetingTime: meeting.startTime, meetingEndTime: meeting.endTime,
        meetingLocation: meeting.location || 'نامشخص', organizerName: meeting.organizerName,
      });
      const result = await sendWhatsAppNotification(phone, msg, nc, apiKey);
      await saveNotificationLog(buildLog('meeting_created', pid, person.fullName, phone, msg, result, undefined, meeting.id));
      await sendMasterCopy({ config: nc, personnel, message: msg, originalRecipientId: pid, originalRecipientName: person.fullName, logType: 'meeting_created', meetingId: meeting.id, saveLog: saveNotificationLog });
    }
  };

  const sendMeetingUpdatedNotifications = async (oldM: Meeting, newM: Meeting) => {
    const nc = notificationConfig;
    if (!nc?.enabled || nc.onMeetingUpdated === false) return;
    const changes: string[] = [];
    if (oldM.date !== newM.date) changes.push(`• تاریخ: ${oldM.date} ← ${newM.date}`);
    if (oldM.startTime !== newM.startTime || oldM.endTime !== newM.endTime)
      changes.push(`• ساعت: ${oldM.startTime}–${oldM.endTime} ← ${newM.startTime}–${newM.endTime}`);
    if (oldM.location !== newM.location) changes.push(`• مکان: ${newM.location || 'نامشخص'}`);
    if (oldM.title !== newM.title) changes.push(`• موضوع: ${newM.title}`);
    const changesText = changes.length > 0 ? changes.join('\n') : 'اطلاعات جلسه به‌روزرسانی شد';
    for (const pid of [...new Set([...(oldM.attendeeIds || []), ...(newM.attendeeIds || [])])]) {
      const person = personnel.find(p => p.id === pid); if (!person) continue;
      const phone = nc.personnelPhones?.[pid]; if (!phone) continue;
      const apiKey = nc.personnelApiKeys?.[pid];
      if (nc.provider === 'callmebot' && !apiKey) continue;
      const msg = renderTemplate(nc.meetingUpdatedTemplate || DEFAULT_MEETING_UPDATED_TEMPLATE, {
        recipientName: person.fullName, meetingTitle: newM.title, meetingDate: newM.date,
        meetingTime: newM.startTime, meetingEndTime: newM.endTime,
        meetingLocation: newM.location || 'نامشخص', organizerName: newM.organizerName, changes: changesText,
      });
      const result = await sendWhatsAppNotification(phone, msg, nc, apiKey);
      await saveNotificationLog(buildLog('meeting_updated', pid, person.fullName, phone, msg, result, undefined, newM.id));
      await sendMasterCopy({ config: nc, personnel, message: msg, originalRecipientId: pid, originalRecipientName: person.fullName, logType: 'meeting_updated', meetingId: newM.id, saveLog: saveNotificationLog });
    }
  };

  const sendMeetingDeletedNotifications = async (meeting: Meeting) => {
    const nc = notificationConfig;
    if (!nc?.enabled || nc.onMeetingDeleted === false) return;
    for (const pid of [...new Set(meeting.attendeeIds || [])]) {
      const person = personnel.find(p => p.id === pid); if (!person) continue;
      const phone = nc.personnelPhones?.[pid]; if (!phone) continue;
      const apiKey = nc.personnelApiKeys?.[pid];
      if (nc.provider === 'callmebot' && !apiKey) continue;
      const msg = renderTemplate(nc.meetingDeletedTemplate || DEFAULT_MEETING_DELETED_TEMPLATE, {
        recipientName: person.fullName, meetingTitle: meeting.title, meetingDate: meeting.date,
        meetingTime: meeting.startTime, meetingEndTime: meeting.endTime,
        meetingLocation: meeting.location || 'نامشخص', organizerName: meeting.organizerName,
      });
      const result = await sendWhatsAppNotification(phone, msg, nc, apiKey);
      await saveNotificationLog(buildLog('meeting_deleted', pid, person.fullName, phone, msg, result, undefined, meeting.id));
      await sendMasterCopy({ config: nc, personnel, message: msg, originalRecipientId: pid, originalRecipientName: person.fullName, logType: 'meeting_deleted', meetingId: meeting.id, saveLog: saveNotificationLog });
    }
  };
  // ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;
    if (editingMeetingId) {
      const oldM = meetings.find(m => m.id === editingMeetingId);
      await updateMeetingInCloud(editingMeetingId, {
        title: formData.title, date: formData.date, startTime: formData.startTime,
        endTime: formData.endTime, location: formData.location,
        attendeeIds: formData.attendeeIds, description: formData.description,
      }, currentUser.fullName);
      const updatedM: Meeting = { id: editingMeetingId, title: formData.title, date: formData.date,
        startTime: formData.startTime, endTime: formData.endTime, location: formData.location,
        organizerId: currentUser.id, organizerName: currentUser.fullName,
        attendeeIds: formData.attendeeIds, description: formData.description };
      if (oldM) sendMeetingUpdatedNotifications(oldM, updatedM);
    } else {
      const meeting: Meeting = { id: `meet-${Date.now()}`, title: formData.title, date: formData.date,
        startTime: formData.startTime, endTime: formData.endTime, location: formData.location,
        organizerId: currentUser.id, organizerName: currentUser.fullName,
        attendeeIds: formData.attendeeIds, description: formData.description };
      await saveMeetingToCloud(meeting);
      sendMeetingCreatedNotifications(meeting);
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(fa ? 'آیا از حذف این جلسه اطمینان دارید؟' : 'Delete this meeting?')) {
      const m = meetings.find(x => x.id === id);
      await deleteMeetingFromCloud(id);
      if (m) sendMeetingDeletedNotifications(m);
    }
  };

  const handleCopy = async (m: Meeting) => {
    const copy: Meeting = { ...m, id: `meet-${Date.now()}`, organizerId: currentUser.id, organizerName: currentUser.fullName };
    await saveMeetingToCloud(copy);
    sendMeetingCreatedNotifications(copy);
  };

  const toggleAttendee = (id: string) =>
    setFormData(prev => ({ ...prev, attendeeIds: prev.attendeeIds.includes(id) ? prev.attendeeIds.filter(p => p !== id) : [...prev.attendeeIds, id] }));

  const handleSlotClick = (e: React.MouseEvent<HTMLDivElement>, dateStr: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top + (gridRef.current?.scrollTop || 0);
    const hour = Math.min(22, Math.max(0, Math.floor(relY / HOUR_HEIGHT)));
    handleOpenCreate(dateStr, `${hour.toString().padStart(2, '0')}:00`, `${Math.min(23, hour + 1).toString().padStart(2, '0')}:00`);
  };

  const now = new Date();
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden animate-fade-in"
      style={{ height: 'calc(100vh - 130px)', minHeight: '600px' }}>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
            <IconCalendarClock className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-gray-800">{fa ? 'تقویم جلسات' : 'Meeting Calendar'}</span>
        </div>

        <div className="flex items-center gap-1" dir="ltr">
          <button onClick={prevWeek} className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors text-sm font-bold">‹</button>
          <button onClick={goToday} className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors ${toDateStr(new Date()) >= toDateStr(weekDays[0]) && toDateStr(new Date()) <= toDateStr(weekDays[6]) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{fa ? 'امروز' : 'Today'}</button>
          <button onClick={nextWeek} className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors text-sm font-bold">›</button>
          <span className="text-[11px] font-semibold text-gray-500 px-1 min-w-[100px] text-center">{getWeekRange()}</span>
        </div>

        <button onClick={() => handleOpenCreate()} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 shadow-sm transition-colors text-[11px]">
          <IconPlus className="w-3.5 h-3.5" />
          {fa ? 'جلسه جدید' : 'New Meeting'}
        </button>
      </div>

      {/* ── Day header ── */}
      <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0" dir="ltr">
        <div className="w-10 flex-shrink-0 border-r border-gray-200" />
        {weekDays.map(day => {
          const ds = toDateStr(day);
          const isToday = ds === todayStr;
          const count = meetings.filter(m => m.date === ds).length;
          return (
            <div key={ds} className="flex-1 text-center py-1.5 border-l border-gray-200 first:border-l-0">
              <div className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                {getDayName(day, true)}
              </div>
              <div className={`text-base font-black w-8 h-8 flex items-center justify-center mx-auto rounded-full mt-0.5 cursor-pointer transition-colors ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'}`}
                onClick={() => handleOpenCreate(ds)}>
                {day.getDate()}
              </div>
              {count > 0 && (
                <div className="flex justify-center mt-0.5">
                  <span className={`text-[9px] font-bold px-1 rounded-full ${isToday ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>{count}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Scrollable grid ── */}
      <div ref={gridRef} className="flex-1 overflow-y-auto" dir="ltr">
        <div className="flex" style={{ height: `${24 * HOUR_HEIGHT}px` }}>

          {/* Time labels */}
          <div className="w-10 flex-shrink-0 border-r border-gray-200 relative select-none bg-white">
            {HOURS.map(h => (
              <div key={h} className="absolute flex items-start justify-end pr-1 w-full"
                style={{ top: `${h * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}>
                {h > 0 && (
                  <span className="text-[9px] text-gray-400 font-mono leading-none -mt-2">
                    {h.toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map(day => {
            const ds = toDateStr(day);
            const isToday = ds === todayStr;
            const dayMeetings = meetings.filter(m => m.date === ds);

            return (
              <div key={ds}
                className={`flex-1 relative border-l border-gray-200 first:border-l-0 cursor-pointer ${isToday ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'} transition-colors`}
                onClick={e => handleSlotClick(e, ds)}>

                {/* Hour lines */}
                {HOURS.map(h => (
                  <div key={h} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: `${h * HOUR_HEIGHT}px` }} />
                ))}
                {/* Half-hour lines */}
                {HOURS.map(h => (
                  <div key={`hf${h}`} className="absolute left-0 right-0 border-t border-dashed border-gray-100/60" style={{ top: `${h * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
                ))}

                {/* Now line */}
                {isToday && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: `${nowTop}px` }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 -ml-1 shadow-sm" />
                    <div className="h-px bg-red-400 flex-1" />
                  </div>
                )}

                {/* Meetings */}
                {dayMeetings.map(meeting => {
                  const startMin = timeToMinutes(meeting.startTime);
                  const endMin   = timeToMinutes(meeting.endTime);
                  const top    = (startMin / 60) * HOUR_HEIGHT;
                  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 18);
                  const colorClass = getMeetingColor(meeting);
                  const canEdit = meeting.organizerId === currentUser.id || currentUser.roles.includes('مدیر');

                  return (
                    <div key={meeting.id}
                      className={`absolute rounded overflow-hidden shadow-sm z-10 group/m transition-all hover:shadow-md hover:z-30 ${colorClass}`}
                      style={{ top: `${top + 1}px`, height: `${height - 2}px`, left: '1px', right: '1px' }}
                      onClick={e => { e.stopPropagation(); handleOpenEdit(meeting); }}>

                      <div className="px-1 py-0.5 h-full flex flex-col overflow-hidden">
                        {/* Title always visible */}
                        <div className="text-white font-semibold leading-tight truncate" style={{ fontSize: '10px' }}>
                          {meeting.title}
                        </div>
                        {/* Time — only if tall enough */}
                        {height > 28 && (
                          <div className="text-white/80 leading-none truncate" style={{ fontSize: '9px' }}>
                            {meeting.startTime}–{meeting.endTime}
                          </div>
                        )}
                        {/* Location — only if taller */}
                        {height > 44 && meeting.location && (
                          <div className="text-white/70 truncate" style={{ fontSize: '9px' }}>
                            📍 {meeting.location}
                          </div>
                        )}
                      </div>

                      {/* Hover actions */}
                      <div className="absolute top-0 right-0 hidden group-hover/m:flex gap-px bg-black/40 rounded-bl p-0.5"
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleCopy(meeting)} title={fa ? 'کپی' : 'Copy'}
                          className="text-white hover:text-yellow-300 transition-colors p-0.5">
                          <IconCopy className="w-2.5 h-2.5" />
                        </button>
                        {canEdit && <>
                          <button onClick={() => handleOpenEdit(meeting)} title={fa ? 'ویرایش' : 'Edit'}
                            className="text-white hover:text-blue-200 transition-colors p-0.5">
                            <IconEdit className="w-2.5 h-2.5" />
                          </button>
                          <button onClick={() => handleDelete(meeting.id)} title={fa ? 'حذف' : 'Delete'}
                            className="text-white hover:text-red-200 transition-colors p-0.5">
                            <IconTrash className="w-2.5 h-2.5" />
                          </button>
                        </>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in" dir={fa ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between px-5 py-3 bg-blue-600 rounded-t-2xl">
              <h3 className="font-bold text-white text-sm">
                {editingMeetingId ? (fa ? 'ویرایش جلسه' : 'Edit Meeting') : (fa ? 'جلسه جدید' : 'New Meeting')}
              </h3>
              <button onClick={() => setShowModal(false)}
                className="text-white/80 hover:text-white w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-sm">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3 max-h-[82vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'موضوع جلسه' : 'Title'}</label>
                <input required autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'تاریخ' : 'Date'}</label>
                <input type="date" required dir="ltr"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'شروع' : 'Start'}</label>
                  <input type="time" required dir="ltr"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
                    value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'پایان' : 'End'}</label>
                  <input type="time" required dir="ltr"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
                    value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'مکان / لینک' : 'Location'}</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'شرکت‌کنندگان' : 'Attendees'}</label>
                <StaffIdPicker
                  personnel={personnel}
                  selectedIds={formData.attendeeIds}
                  onChange={ids => setFormData({ ...formData, attendeeIds: ids })}
                  lang={lang}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'توضیحات' : 'Notes'}</label>
                <textarea rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div className="flex justify-end pt-1">
                <button type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md shadow-blue-200 transition-colors">
                  {editingMeetingId ? (fa ? 'بروزرسانی' : 'Update') : (fa ? 'ثبت جلسه' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
