
import React, { useState, useRef, useEffect } from 'react';
import { Meeting, Personnel, NotificationConfig } from '../types';
import { IconCalendarClock, IconPlus, IconMapPin, IconUsers, IconTrash, IconClock, IconEdit, IconCopy } from './Icons';
import { saveMeetingToCloud, deleteMeetingFromCloud, updateMeetingInCloud, saveNotificationLog } from '../services/firebaseService';
import { sendWhatsAppNotification, renderTemplate, buildLog, DEFAULT_MEETING_CREATED_TEMPLATE, DEFAULT_MEETING_UPDATED_TEMPLATE, DEFAULT_MEETING_DELETED_TEMPLATE } from '../services/notificationService';
import { Language } from '../App';

const HOUR_HEIGHT = 72; // px per hour slot
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const MEETING_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-fuchsia-600', 'bg-teal-500',
  'bg-indigo-500', 'bg-orange-500',
];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const diff = (d.getDay() - 6 + 7) % 7; // week starts Saturday
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
  return d.toISOString().split('T')[0];
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
  const t = fa ? {
    header: 'تقویم جلسات',
    prev: '‹ هفته قبل', next: 'هفته بعد ›', today: 'امروز', new: 'جلسه جدید',
    editModal: 'ویرایش جلسه', newModal: 'جلسه جدید',
    titleLabel: 'موضوع جلسه', dateLabel: 'تاریخ',
    start: 'ساعت شروع', end: 'ساعت پایان',
    location: 'مکان / لینک', attendees: 'شرکت‌کنندگان',
    desc: 'توضیحات', save: 'ثبت جلسه', update: 'بروزرسانی',
    copy: 'کپی', edit: 'ویرایش', delete: 'حذف',
    deleteConfirm: 'آیا از حذف این جلسه اطمینان دارید؟',
    days: ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'],
    months: ['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'],
  } : {
    header: 'Meeting Calendar',
    prev: '‹ Prev', next: 'Next ›', today: 'Today', new: 'New Meeting',
    editModal: 'Edit Meeting', newModal: 'New Meeting',
    titleLabel: 'Meeting Title', dateLabel: 'Date',
    start: 'Start Time', end: 'End Time',
    location: 'Location / Link', attendees: 'Attendees',
    desc: 'Description', save: 'Save', update: 'Update',
    copy: 'Copy', edit: 'Edit', delete: 'Delete',
    deleteConfirm: 'Delete this meeting?',
    days: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  };

  const weekDays = getWeekDays(weekStart);
  const todayStr = toDateStr(new Date());

  const getDayName = (d: Date) => {
    const idx = d.getDay() === 6 ? 0 : d.getDay() + 1;
    return t.days[idx];
  };

  const getWeekRange = () => {
    const s = weekDays[0], e = weekDays[6];
    const sm = t.months[s.getMonth()], em = t.months[e.getMonth()];
    return s.getMonth() === e.getMonth()
      ? `${sm} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`
      : `${sm} ${s.getDate()} – ${em} ${e.getDate()}, ${e.getFullYear()}`;
  };

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); };
  const goToday = () => setWeekStart(getWeekStart(new Date()));

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

  // ── Notification helpers ──────────────────────────────────────────
  const sendMeetingCreatedNotifications = async (meeting: Meeting) => {
    const nc = notificationConfig;
    if (!nc?.enabled || nc.onMeetingCreated === false) return;
    for (const pid of [...new Set(meeting.attendeeIds || [])]) {
      const person = personnel.find(p => p.id === pid);
      if (!person) continue;
      const phone = nc.personnelPhones?.[pid];
      if (!phone) continue;
      const apiKey = nc.personnelApiKeys?.[pid];
      if (nc.provider === 'callmebot' && !apiKey) continue;
      const msg = renderTemplate(nc.meetingCreatedTemplate || DEFAULT_MEETING_CREATED_TEMPLATE, {
        recipientName: person.fullName, meetingTitle: meeting.title, meetingDate: meeting.date,
        meetingTime: meeting.startTime, meetingEndTime: meeting.endTime,
        meetingLocation: meeting.location || 'نامشخص', organizerName: meeting.organizerName,
      });
      const result = await sendWhatsAppNotification(phone, msg, nc, apiKey);
      await saveNotificationLog(buildLog('meeting_created', pid, person.fullName, phone, msg, result, undefined, meeting.id));
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
    const allIds = [...new Set([...(oldM.attendeeIds || []), ...(newM.attendeeIds || [])])];
    for (const pid of allIds) {
      const person = personnel.find(p => p.id === pid);
      if (!person) continue;
      const phone = nc.personnelPhones?.[pid];
      if (!phone) continue;
      const apiKey = nc.personnelApiKeys?.[pid];
      if (nc.provider === 'callmebot' && !apiKey) continue;
      const msg = renderTemplate(nc.meetingUpdatedTemplate || DEFAULT_MEETING_UPDATED_TEMPLATE, {
        recipientName: person.fullName, meetingTitle: newM.title, meetingDate: newM.date,
        meetingTime: newM.startTime, meetingEndTime: newM.endTime,
        meetingLocation: newM.location || 'نامشخص', organizerName: newM.organizerName, changes: changesText,
      });
      const result = await sendWhatsAppNotification(phone, msg, nc, apiKey);
      await saveNotificationLog(buildLog('meeting_updated', pid, person.fullName, phone, msg, result, undefined, newM.id));
    }
  };

  const sendMeetingDeletedNotifications = async (meeting: Meeting) => {
    const nc = notificationConfig;
    if (!nc?.enabled || nc.onMeetingDeleted === false) return;
    for (const pid of [...new Set(meeting.attendeeIds || [])]) {
      const person = personnel.find(p => p.id === pid);
      if (!person) continue;
      const phone = nc.personnelPhones?.[pid];
      if (!phone) continue;
      const apiKey = nc.personnelApiKeys?.[pid];
      if (nc.provider === 'callmebot' && !apiKey) continue;
      const msg = renderTemplate(nc.meetingDeletedTemplate || DEFAULT_MEETING_DELETED_TEMPLATE, {
        recipientName: person.fullName, meetingTitle: meeting.title, meetingDate: meeting.date,
        meetingTime: meeting.startTime, meetingEndTime: meeting.endTime,
        meetingLocation: meeting.location || 'نامشخص', organizerName: meeting.organizerName,
      });
      const result = await sendWhatsAppNotification(phone, msg, nc, apiKey);
      await saveNotificationLog(buildLog('meeting_deleted', pid, person.fullName, phone, msg, result, undefined, meeting.id));
    }
  };
  // ─────────────────────────────────────────────────────────────────

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
    if (window.confirm(t.deleteConfirm)) {
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

  // Current time
  const now = new Date();
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden animate-fade-in"
      style={{ height: 'calc(100vh - 130px)', minHeight: '620px' }}>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 text-blue-600 p-2 rounded-xl">
            <IconCalendarClock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">{t.header}</h2>
        </div>

        <div className="flex items-center gap-2" dir="ltr">
          <button onClick={prevWeek} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors">
            {t.prev}
          </button>
          <button onClick={goToday} className="px-3 py-1.5 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-gray-700 font-medium transition-colors">
            {t.today}
          </button>
          <button onClick={nextWeek} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors">
            {t.next}
          </button>
          <span className="text-sm font-semibold text-gray-600 min-w-[170px] text-center">{getWeekRange()}</span>
        </div>

        <button onClick={() => handleOpenCreate()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-md shadow-blue-200 transition-colors text-sm">
          <IconPlus className="w-4 h-4" />
          {t.new}
        </button>
      </div>

      {/* ── Day header ──────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 bg-gray-50/80 flex-shrink-0" dir="ltr">
        <div className="w-16 flex-shrink-0 border-r border-gray-200" />
        {weekDays.map(day => {
          const ds = toDateStr(day);
          const isToday = ds === todayStr;
          return (
            <div key={ds} className="flex-1 text-center py-3 border-l border-gray-200 first:border-l-0">
              <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                {getDayName(day)}
              </div>
              <div
                className={`text-2xl font-bold w-11 h-11 flex items-center justify-center mx-auto rounded-full cursor-pointer transition-colors select-none ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-800 hover:bg-gray-200'}`}
                onClick={() => handleOpenCreate(ds)}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Scrollable time grid ─────────────────────────────────── */}
      <div ref={gridRef} className="flex-1 overflow-y-auto" dir="ltr">
        <div className="flex" style={{ height: `${24 * HOUR_HEIGHT}px`, position: 'relative' }}>

          {/* Hour label column */}
          <div className="w-16 flex-shrink-0 border-r border-gray-200 relative select-none">
            {HOURS.map(h => (
              <div key={h} className="absolute flex items-start justify-end pr-2 w-full"
                style={{ top: `${h * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}>
                {h > 0 && (
                  <span className="text-xs text-gray-400 font-mono -mt-2.5">
                    {h.toString().padStart(2, '0')}:00
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
              <div
                key={ds}
                className={`flex-1 relative border-l border-gray-200 first:border-l-0 cursor-pointer transition-colors ${isToday ? 'bg-blue-50/40' : 'hover:bg-gray-50/60'}`}
                onClick={e => handleSlotClick(e, ds)}
              >
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div key={h} className="absolute left-0 right-0 border-t border-gray-100"
                    style={{ top: `${h * HOUR_HEIGHT}px` }} />
                ))}
                {/* Half-hour lines */}
                {HOURS.map(h => (
                  <div key={`hf${h}`} className="absolute left-0 right-0 border-t border-dashed border-gray-100/80"
                    style={{ top: `${h * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
                ))}

                {/* Current time red line */}
                {isToday && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                    style={{ top: `${nowTop}px` }}>
                    <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0 -ml-1.5 shadow-sm" />
                    <div className="h-0.5 bg-red-500 flex-1" />
                  </div>
                )}

                {/* Meetings */}
                {dayMeetings.map(meeting => {
                  const startMin = timeToMinutes(meeting.startTime);
                  const endMin = timeToMinutes(meeting.endTime);
                  const top = (startMin / 60) * HOUR_HEIGHT;
                  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 26);
                  const colorClass = getMeetingColor(meeting);
                  const canEdit = meeting.organizerId === currentUser.id || currentUser.roles.includes('مدیر');

                  return (
                    <div
                      key={meeting.id}
                      className={`absolute inset-x-0.5 rounded-lg text-white overflow-hidden shadow-sm z-10 group/m transition-all hover:shadow-lg hover:z-30 hover:brightness-95 ${colorClass}`}
                      style={{ top: `${top + 1}px`, height: `${height - 2}px` }}
                      onClick={e => { e.stopPropagation(); handleOpenEdit(meeting); }}
                    >
                      <div className="px-2 py-1 h-full flex flex-col overflow-hidden">
                        <div className="font-semibold text-sm leading-tight truncate">{meeting.title}</div>
                        {height > 32 && (
                          <div className="text-xs text-white/85 mt-0.5 flex items-center gap-1">
                            <IconClock className="w-3 h-3 flex-shrink-0" />
                            {meeting.startTime} – {meeting.endTime}
                          </div>
                        )}
                        {height > 54 && meeting.location && (
                          <div className="text-xs text-white/75 mt-0.5 flex items-center gap-1 min-w-0">
                            <IconMapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{meeting.location}</span>
                          </div>
                        )}
                        {height > 76 && meeting.attendeeIds.length > 0 && (
                          <div className="text-xs text-white/70 mt-0.5 flex items-center gap-1">
                            <IconUsers className="w-3 h-3 flex-shrink-0" />
                            {meeting.attendeeIds.length} {fa ? 'نفر' : 'attendees'}
                          </div>
                        )}
                      </div>

                      {/* Hover action bar */}
                      <div
                        className="absolute top-1 right-1 hidden group-hover/m:flex gap-0.5 bg-black/40 backdrop-blur-sm rounded-md px-1 py-0.5"
                        onClick={e => e.stopPropagation()}
                      >
                        <button onClick={() => handleCopy(meeting)} title={t.copy}
                          className="text-white/90 hover:text-yellow-300 p-0.5 rounded transition-colors">
                          <IconCopy className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <>
                            <button onClick={() => handleOpenEdit(meeting)} title={t.edit}
                              className="text-white/90 hover:text-blue-200 p-0.5 rounded transition-colors">
                              <IconEdit className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(meeting.id)} title={t.delete}
                              className="text-white/90 hover:text-red-200 p-0.5 rounded transition-colors">
                              <IconTrash className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in" dir={fa ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between px-6 py-4 bg-blue-600 rounded-t-2xl">
              <h3 className="font-bold text-white text-lg">
                {editingMeetingId ? t.editModal : t.newModal}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t.titleLabel}</label>
                <input required autoFocus
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-base"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t.dateLabel}</label>
                <input type="date" required dir="ltr"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-base"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t.start}</label>
                  <input type="time" required dir="ltr"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-base text-center"
                    value={formData.startTime}
                    onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t.end}</label>
                  <input type="time" required dir="ltr"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-base text-center"
                    value={formData.endTime}
                    onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t.location}</label>
                <input
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-base"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t.attendees}</label>
                <div className="flex flex-wrap gap-2 p-3 border border-gray-300 rounded-xl max-h-36 overflow-y-auto bg-gray-50">
                  {personnel.map(p => (
                    <button key={p.id} type="button" onClick={() => toggleAttendee(p.id)}
                      className={`px-3 py-1 rounded-full text-sm font-semibold border transition-colors ${
                        formData.attendeeIds.includes(p.id)
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                      }`}>
                      {p.fullName}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t.desc}</label>
                <textarea rows={2} resize-none
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-base resize-none"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex justify-end pt-1">
                <button type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl font-bold text-base shadow-md shadow-blue-200 transition-colors">
                  {editingMeetingId ? t.update : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
