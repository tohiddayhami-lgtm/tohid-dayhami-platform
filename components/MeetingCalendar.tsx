
import React, { useState, useRef, useEffect } from 'react';
import { Meeting, Personnel, NotificationConfig } from '../types';
import { IconCalendarClock, IconPlus, IconMapPin, IconUsers, IconTrash, IconClock, IconEdit, IconCopy } from './Icons';
import { saveMeetingToCloud, deleteMeetingFromCloud, updateMeetingInCloud, saveNotificationLog } from '../services/firebaseService';
import { sendWhatsAppNotification, renderTemplate, buildLog, DEFAULT_MEETING_CREATED_TEMPLATE, DEFAULT_MEETING_UPDATED_TEMPLATE, DEFAULT_MEETING_DELETED_TEMPLATE } from '../services/notificationService';
import { Language } from '../App';

const HOUR_HEIGHT = 80; // px per hour in the grid
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const MEETING_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-600', 'bg-fuchsia-600', 'bg-teal-500',
  'bg-indigo-500', 'bg-orange-500',
];

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

function changeDay(dateStr: string, delta: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
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
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
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

  const DAY_NAMES_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
  const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS_FA = ['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'];
  const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const todayStr = toDateStr(new Date());
  const selDateObj = new Date(selectedDate);
  const dayName = fa ? DAY_NAMES_FA[selDateObj.getDay()] : DAY_NAMES_EN[selDateObj.getDay()];
  const monthName = fa ? MONTHS_FA[selDateObj.getMonth()] : MONTHS_EN[selDateObj.getMonth()];
  const dateLabel = fa
    ? `${dayName}، ${selDateObj.getDate()} ${monthName} ${selDateObj.getFullYear()}`
    : `${dayName}, ${monthName} ${selDateObj.getDate()}, ${selDateObj.getFullYear()}`;

  const dayMeetings = meetings
    .filter(m => m.date === selectedDate)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const handleOpenCreate = (st?: string, et?: string) => {
    setEditingMeetingId(null);
    const s = st || '09:00';
    setFormData({ title: '', date: selectedDate, startTime: s, endTime: et || addMinutes(s, 60), location: '', attendeeIds: [], description: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (m: Meeting) => {
    setEditingMeetingId(m.id);
    setFormData({ title: m.title, date: m.date, startTime: m.startTime, endTime: m.endTime, location: m.location, attendeeIds: m.attendeeIds, description: m.description || '' });
    setShowModal(true);
  };

  // ── Notification helpers ─────────────────────────────────────────
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
    for (const pid of [...new Set([...(oldM.attendeeIds || []), ...(newM.attendeeIds || [])])]) {
      const person = personnel.find(p => p.id === pid);
      if (!person) continue;
      const phone = notificationConfig!.personnelPhones?.[pid];
      if (!phone) continue;
      const apiKey = notificationConfig!.personnelApiKeys?.[pid];
      if (notificationConfig!.provider === 'callmebot' && !apiKey) continue;
      const msg = renderTemplate(notificationConfig!.meetingUpdatedTemplate || DEFAULT_MEETING_UPDATED_TEMPLATE, {
        recipientName: person.fullName, meetingTitle: newM.title, meetingDate: newM.date,
        meetingTime: newM.startTime, meetingEndTime: newM.endTime,
        meetingLocation: newM.location || 'نامشخص', organizerName: newM.organizerName, changes: changesText,
      });
      const result = await sendWhatsAppNotification(phone, msg, notificationConfig!, apiKey);
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
      const updatedM: Meeting = {
        id: editingMeetingId, title: formData.title, date: formData.date,
        startTime: formData.startTime, endTime: formData.endTime, location: formData.location,
        organizerId: currentUser.id, organizerName: currentUser.fullName,
        attendeeIds: formData.attendeeIds, description: formData.description,
      };
      if (oldM) sendMeetingUpdatedNotifications(oldM, updatedM);
    } else {
      const meeting: Meeting = {
        id: `meet-${Date.now()}`, title: formData.title, date: formData.date,
        startTime: formData.startTime, endTime: formData.endTime, location: formData.location,
        organizerId: currentUser.id, organizerName: currentUser.fullName,
        attendeeIds: formData.attendeeIds, description: formData.description,
      };
      await saveMeetingToCloud(meeting);
      sendMeetingCreatedNotifications(meeting);
    }
    // If meeting is on a different date than currently viewed, navigate there
    if (formData.date !== selectedDate) setSelectedDate(formData.date);
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
    setFormData(prev => ({
      ...prev,
      attendeeIds: prev.attendeeIds.includes(id)
        ? prev.attendeeIds.filter(p => p !== id)
        : [...prev.attendeeIds, id],
    }));

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top + (gridRef.current?.scrollTop || 0);
    const hour = Math.min(22, Math.max(0, Math.floor(relY / HOUR_HEIGHT)));
    handleOpenCreate(`${hour.toString().padStart(2, '0')}:00`, `${Math.min(23, hour + 1).toString().padStart(2, '0')}:00`);
  };

  // Current time
  const now = new Date();
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;
  const isToday = selectedDate === todayStr;

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden animate-fade-in"
      style={{ height: 'calc(100vh - 130px)', minHeight: '600px' }}>

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0 gap-2 flex-wrap">
        {/* Left: icon + title */}
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
            <IconCalendarClock className="w-5 h-5" />
          </div>
          <span className="text-base font-bold text-gray-800">{fa ? 'تقویم جلسات' : 'Meeting Calendar'}</span>
        </div>

        {/* Center: navigation */}
        <div className="flex items-center gap-1.5" dir="ltr">
          <button
            onClick={() => setSelectedDate(changeDay(selectedDate, -1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition-colors text-sm"
          >‹</button>

          <button
            onClick={() => setSelectedDate(todayStr)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${isToday ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >{fa ? 'امروز' : 'Today'}</button>

          <button
            onClick={() => setSelectedDate(changeDay(selectedDate, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition-colors text-sm"
          >›</button>

          {/* Date display + picker */}
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
            />
            <div className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer select-none ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
              {dateLabel}
            </div>
          </div>
        </div>

        {/* Right: new meeting */}
        <button
          onClick={() => handleOpenCreate()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 shadow-sm shadow-blue-200 transition-colors text-xs"
        >
          <IconPlus className="w-3.5 h-3.5" />
          {fa ? 'جلسه جدید' : 'New Meeting'}
        </button>
      </div>

      {/* ── Day summary bar ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
        <div className={`text-2xl font-black w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0 ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
          {selDateObj.getDate()}
        </div>
        <div>
          <div className={`text-sm font-bold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{dayName}</div>
          <div className="text-xs text-gray-400">{monthName} {selDateObj.getFullYear()}</div>
        </div>
        {dayMeetings.length > 0 && (
          <div className="mr-auto flex items-center gap-1 text-xs text-gray-500">
            <IconUsers className="w-3.5 h-3.5" />
            {dayMeetings.length} {fa ? 'جلسه' : 'meeting(s)'}
          </div>
        )}
      </div>

      {/* ── Scrollable 24-h grid ─────────────────────────────────── */}
      <div ref={gridRef} className="flex-1 overflow-y-auto" dir="ltr">
        <div className="flex" style={{ height: `${24 * HOUR_HEIGHT}px`, position: 'relative' }}>

          {/* Time label column */}
          <div className="w-14 flex-shrink-0 border-r border-gray-200 relative select-none bg-white">
            {HOURS.map(h => (
              <div
                key={h}
                className="absolute flex items-start justify-end pr-2 w-full"
                style={{ top: `${h * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
              >
                {h > 0 && (
                  <span className="text-[11px] text-gray-400 font-mono leading-none -mt-2">
                    {h.toString().padStart(2, '0')}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Main day column */}
          <div
            className={`flex-1 relative cursor-pointer ${isToday ? 'bg-blue-50/20' : 'bg-white'}`}
            onClick={handleGridClick}
          >
            {/* Hour grid lines */}
            {HOURS.map(h => (
              <div key={h} className="absolute left-0 right-0 border-t border-gray-100"
                style={{ top: `${h * HOUR_HEIGHT}px` }} />
            ))}
            {/* Half-hour dashed lines */}
            {HOURS.map(h => (
              <div key={`hf${h}`} className="absolute left-0 right-0 border-t border-dashed border-gray-100/70"
                style={{ top: `${h * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
            ))}

            {/* Current time line */}
            {isToday && (
              <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                style={{ top: `${nowTop}px` }}>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 -ml-1.5 shadow" />
                <div className="h-0.5 bg-red-400 flex-1" />
              </div>
            )}

            {/* Meetings */}
            {dayMeetings.map(meeting => {
              const startMin = timeToMinutes(meeting.startTime);
              const endMin   = timeToMinutes(meeting.endTime);
              const top    = (startMin / 60) * HOUR_HEIGHT;
              const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 28);
              const colorClass = getMeetingColor(meeting);
              const canEdit = meeting.organizerId === currentUser.id || currentUser.roles.includes('مدیر');
              const attendeeNames = meeting.attendeeIds
                .map(id => personnel.find(p => p.id === id)?.fullName)
                .filter(Boolean)
                .join('، ');

              return (
                <div
                  key={meeting.id}
                  className={`absolute rounded-xl text-white overflow-hidden shadow-md z-10 group/m transition-all hover:shadow-xl hover:z-30 ${colorClass}`}
                  style={{ top: `${top + 1}px`, height: `${height - 2}px`, left: '8px', right: '8px' }}
                  onClick={e => { e.stopPropagation(); handleOpenEdit(meeting); }}
                >
                  <div className="px-3 py-2 h-full flex flex-col overflow-hidden">
                    {/* Title */}
                    <div className="font-bold text-sm leading-snug truncate">{meeting.title}</div>

                    {/* Time */}
                    {height > 36 && (
                      <div className="flex items-center gap-1 text-[11px] text-white/85 mt-0.5">
                        <IconClock className="w-3 h-3 flex-shrink-0" />
                        {meeting.startTime} – {meeting.endTime}
                      </div>
                    )}

                    {/* Location */}
                    {height > 56 && meeting.location && (
                      <div className="flex items-center gap-1 text-[11px] text-white/75 mt-0.5 min-w-0">
                        <IconMapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{meeting.location}</span>
                      </div>
                    )}

                    {/* Attendees */}
                    {height > 76 && attendeeNames && (
                      <div className="flex items-center gap-1 text-[11px] text-white/70 mt-0.5 min-w-0">
                        <IconUsers className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{attendeeNames}</span>
                      </div>
                    )}

                    {/* Organizer */}
                    {height > 100 && (
                      <div className="text-[11px] text-white/60 mt-0.5 truncate">
                        {fa ? 'تنظیم‌کننده' : 'By'}: {meeting.organizerName}
                      </div>
                    )}
                  </div>

                  {/* Hover action bar */}
                  <div
                    className="absolute top-1.5 right-2 hidden group-hover/m:flex gap-0.5 bg-black/35 backdrop-blur-sm rounded-lg px-1.5 py-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <button onClick={() => handleCopy(meeting)} title={fa ? 'کپی' : 'Copy'}
                      className="text-white/90 hover:text-yellow-300 p-0.5 rounded transition-colors">
                      <IconCopy className="w-3.5 h-3.5" />
                    </button>
                    {canEdit && (
                      <>
                        <button onClick={() => handleOpenEdit(meeting)} title={fa ? 'ویرایش' : 'Edit'}
                          className="text-white/90 hover:text-blue-200 p-0.5 rounded transition-colors">
                          <IconEdit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(meeting.id)} title={fa ? 'حذف' : 'Delete'}
                          className="text-white/90 hover:text-red-200 p-0.5 rounded transition-colors">
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty state hint */}
            {dayMeetings.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-gray-300">
                  <IconCalendarClock className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-medium opacity-60">
                    {fa ? 'برای افزودن جلسه روی هر ساعت کلیک کنید' : 'Click any time slot to add a meeting'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal ────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in" dir={fa ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between px-5 py-3.5 bg-blue-600 rounded-t-2xl">
              <h3 className="font-bold text-white text-sm">
                {editingMeetingId ? (fa ? 'ویرایش جلسه' : 'Edit Meeting') : (fa ? 'جلسه جدید' : 'New Meeting')}
              </h3>
              <button onClick={() => setShowModal(false)}
                className="text-white/80 hover:text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-base">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3 max-h-[82vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'موضوع جلسه' : 'Title'}</label>
                <input required autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'تاریخ' : 'Date'}</label>
                <input type="date" required dir="ltr"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'ساعت شروع' : 'Start'}</label>
                  <input type="time" required dir="ltr"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
                    value={formData.startTime}
                    onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'ساعت پایان' : 'End'}</label>
                  <input type="time" required dir="ltr"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
                    value={formData.endTime}
                    onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'مکان / لینک' : 'Location'}</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              {/* Attendees */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'شرکت‌کنندگان' : 'Attendees'}</label>
                <div className="flex flex-wrap gap-1.5 p-2.5 border border-gray-300 rounded-lg max-h-28 overflow-y-auto bg-gray-50">
                  {personnel.map(p => (
                    <button key={p.id} type="button" onClick={() => toggleAttendee(p.id)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
                        formData.attendeeIds.includes(p.id)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                      }`}>
                      {p.fullName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{fa ? 'توضیحات' : 'Notes'}</label>
                <textarea rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
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
