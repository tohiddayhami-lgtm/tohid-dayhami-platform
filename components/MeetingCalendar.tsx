
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Meeting, Personnel, NotificationConfig, MeetingKind, Price, Currency, ConsultantCategory } from '../types';
import { ConsultationAdminManager } from './ConsultationAdminManager';
import { IconCalendarClock, IconPlus, IconMapPin, IconUsers, IconTrash, IconClock, IconEdit, IconCopy, IconLink } from './Icons';
import { saveMeetingToCloud, deleteMeetingFromCloud, updateMeetingInCloud, saveNotificationLog, confirmMeetingBooking, uploadFileWithProgress } from '../services/firebaseService';
import { sendWhatsAppNotification, sendMasterCopy, renderTemplate, buildLog, DEFAULT_MEETING_CREATED_TEMPLATE, DEFAULT_MEETING_UPDATED_TEMPLATE, DEFAULT_MEETING_DELETED_TEMPLATE } from '../services/notificationService';
import { StaffIdPicker } from './StaffIdPicker';
import { AppModal, modalFieldInput, modalFieldLabel, modalFieldTextarea } from './AppModal';
import { Language } from '../App';
import { ALL_CURRENCIES, CUR_LABEL, normalizePrices } from '../utils/servicePriceList';
import { InvoiceAmountInput } from './InvoiceAmountInput';
import { formatInvoiceAmount } from '../utils/invoiceMoney';
import { MEETING_STATUS_STYLE, getMeetingDisplayStatus, getMeetingSessionLabel, isBookableMeeting } from '../utils/meetingBookingUtils';

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

function normalizeTime(t?: string | null, fallback = '09:00'): string {
  if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)) return t;
  return fallback;
}

function timeToMinutes(t?: string | null): number {
  const [h, m] = normalizeTime(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function addMinutes(t: string, mins: number): string {
  const total = Math.min(timeToMinutes(t) + mins, 23 * 60 + 59);
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

function normalizeMeeting(m: Meeting): Meeting {
  const startTime = normalizeTime(m.startTime, '09:00');
  const endTime = normalizeTime(m.endTime, addMinutes(startTime, 60));
  return {
    ...m,
    id: m.id || `meet-${Date.now()}`,
    title: m.title || '',
    date: m.date || toDateStr(new Date()),
    startTime,
    endTime: timeToMinutes(endTime) > timeToMinutes(startTime) ? endTime : addMinutes(startTime, 60),
    location: m.location || '',
    attendeeIds: Array.isArray(m.attendeeIds) ? m.attendeeIds : [],
    organizerId: m.organizerId || '',
    organizerName: m.organizerName || '',
    kind: m.kind || 'internal',
    guests: Array.isArray(m.guests) ? m.guests : [],
    prices: Array.isArray(m.prices) ? m.prices : undefined,
  };
}

function getMeetingColor(m: Meeting): string {
  if (isBookableMeeting(m)) {
    const st = getMeetingDisplayStatus(m);
    if (st !== 'internal') return MEETING_STATUS_STYLE[st].bg;
  }
  const id = m.id || '';
  const h = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return MEETING_COLORS[h % MEETING_COLORS.length];
}

type CalendarSubTab = 'staff' | 'public';

interface Props {
  meetings: Meeting[];
  currentUser: Personnel;
  personnel: Personnel[];
  lang: Language;
  notificationConfig?: NotificationConfig;
  shopBaseUrl?: string;
  consultantCategories?: ConsultantCategory[];
  initialSubTab?: CalendarSubTab;
}

export const MeetingCalendar: React.FC<Props> = ({
  meetings, currentUser, personnel, lang, notificationConfig, shopBaseUrl,
  consultantCategories = [], initialSubTab = 'staff',
}) => {
  const [calendarSubTab, setCalendarSubTab] = useState<CalendarSubTab>(initialSubTab);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  useEffect(() => {
    setCalendarSubTab(initialSubTab);
  }, [initialSubTab]);
  const [showModal, setShowModal] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [formData, setFormData] = useState({
    title: '', date: toDateStr(new Date()),
    startTime: '09:00', endTime: '10:00',
    location: '', attendeeIds: [] as string[], description: '',
    kind: 'internal' as MeetingKind,
    sessionType: '',
    consultantId: '',
    consultantName: '',
    consultantBio: '',
    consultantPhoto: '',
    priceInputs: ALL_CURRENCIES.map(c => ({ currency: c, amount: 0 })),
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const isMasterOrAdmin = currentUser.username === 'master' || (currentUser.roles || []).includes('مدیر');
  const activePersonnel = personnel.filter(p => (p.status || 'active') === 'active');

  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, []);

  const fa = lang === 'fa';
  const internalMeetings = useMemo(() => meetings.filter(m => !isBookableMeeting(m)), [meetings]);
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

  const emptyPriceInputs = () => ALL_CURRENCIES.map(c => ({ currency: c, amount: 0 }));

  const pricesFromForm = (): { prices: Price[]; price?: Price } => {
    const raw = formData.priceInputs
      .map(p => ({ currency: p.currency as Currency, amount: p.amount || 0 }))
      .filter(p => p.amount > 0);
    return normalizePrices(raw);
  };

  const loadPricesToForm = (m?: Meeting) => {
    const list = m?.prices?.length ? m.prices : m?.price ? [m.price] : [];
    return ALL_CURRENCIES.map(c => {
      const found = list.find(p => p.currency === c);
      return { currency: c, amount: found?.amount || 0 };
    });
  };

  const applyConsultantFromPersonnel = (personId: string, mergeOnlyEmpty = false) => {
    const p = activePersonnel.find(x => x.id === personId);
    if (!p) return;
    setFormData(prev => ({
      ...prev,
      consultantId: personId,
      consultantName: mergeOnlyEmpty && prev.consultantName.trim() ? prev.consultantName : p.fullName,
      consultantBio: mergeOnlyEmpty && prev.consultantBio.trim() ? prev.consultantBio : (p.consultantBio || ''),
      consultantPhoto: mergeOnlyEmpty && prev.consultantPhoto ? prev.consultantPhoto : (p.avatar || ''),
    }));
  };

  const handleConsultantPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    uploadFileWithProgress(
      file,
      () => {},
      (url) => { setFormData(prev => ({ ...prev, consultantPhoto: url })); setUploadingPhoto(false); },
      (err) => { alert(err.message); setUploadingPhoto(false); },
      'images',
    );
    e.target.value = '';
  };

  const handleOpenCreate = (date?: string, st?: string, et?: string) => {
    setEditingMeetingId(null);
    const s = st || '09:00';
    setFormData({
      title: '', date: date || todayStr, startTime: s, endTime: et || addMinutes(s, 60),
      location: '', attendeeIds: [], description: '',
      kind: 'internal', sessionType: '', consultantId: '', consultantName: '', consultantBio: '', consultantPhoto: '',
      priceInputs: emptyPriceInputs(),
    });
    setShowModal(true);
  };

  const handleOpenEdit = (m: Meeting) => {
    const meeting = normalizeMeeting(m);
    setEditingMeetingId(meeting.id);
    setFormData({
      title: meeting.title,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
      attendeeIds: meeting.attendeeIds,
      description: meeting.description || '',
      kind: meeting.kind || 'internal',
      sessionType: meeting.sessionType || '',
      consultantId: meeting.consultantId || '',
      consultantName: meeting.consultantName || '',
      consultantBio: meeting.consultantBio || '',
      consultantPhoto: meeting.consultantPhoto || '',
      priceInputs: loadPricesToForm(meeting),
    });
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

  const buildMeetingPayload = (id: string): Meeting => {
    const consultant = activePersonnel.find(p => p.id === formData.consultantId);
    const { prices, price } = pricesFromForm();
    const isBookable = false;
    const sessionLabel = formData.sessionType.trim();
    const consultantName = formData.consultantName.trim() || consultant?.fullName || '';
    return {
      id,
      title: formData.title.trim() || (isBookable ? sessionLabel : ''),
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      location: formData.location,
      organizerId: currentUser.id,
      organizerName: currentUser.fullName,
      attendeeIds: isBookable ? [] : formData.attendeeIds,
      description: formData.description,
      kind: 'internal',
      sessionType: isBookable ? sessionLabel : undefined,
      consultantId: isBookable && formData.consultantId ? formData.consultantId : undefined,
      consultantName: isBookable ? consultantName : undefined,
      consultantBio: isBookable && formData.consultantBio.trim() ? formData.consultantBio.trim() : undefined,
      consultantPhoto: isBookable && formData.consultantPhoto ? formData.consultantPhoto : undefined,
      prices: isBookable && prices.length ? prices : undefined,
      price: isBookable ? price : undefined,
      bookingStatus: isBookable ? 'open' : undefined,
      guests: editingMeetingId ? meetings.find(m => m.id === editingMeetingId)?.guests : undefined,
      confirmedGuestId: editingMeetingId ? meetings.find(m => m.id === editingMeetingId)?.confirmedGuestId : undefined,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    if (editingMeetingId) {
      const oldM = meetings.find(m => m.id === editingMeetingId);
      const payload = buildMeetingPayload(editingMeetingId);
      const existing = meetings.find(m => m.id === editingMeetingId);
      const updates: Partial<Meeting> = {
        title: payload.title,
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        location: payload.location,
        attendeeIds: payload.attendeeIds,
        description: payload.description,
        kind: payload.kind,
        sessionType: payload.sessionType,
        consultantId: payload.consultantId,
        consultantName: payload.consultantName,
        consultantBio: payload.consultantBio,
        consultantPhoto: payload.consultantPhoto,
        prices: payload.prices,
        price: payload.price,
      };
      if (payload.kind === 'internal') {
        updates.bookingStatus = undefined;
        updates.guests = undefined;
        updates.confirmedGuestId = undefined;
      }
      await updateMeetingInCloud(editingMeetingId, updates, currentUser.fullName);
      if (oldM) sendMeetingUpdatedNotifications(oldM, { ...existing!, ...updates } as Meeting);
    } else {
      const meeting = buildMeetingPayload(`meet-${Date.now()}`);
      if (meeting.kind === 'bookable') {
        meeting.bookingStatus = 'open';
        meeting.guests = [];
      }
      await saveMeetingToCloud(meeting);
      if (meeting.kind === 'internal') sendMeetingCreatedNotifications(meeting);
    }
    setShowModal(false);
  };

  const handleConfirmGuest = async (meetingId: string, guestId: string) => {
    if (!isMasterOrAdmin) return;
    if (!window.confirm(fa ? 'این رزرو قطعی شود؟' : 'Confirm this booking?')) return;
    await confirmMeetingBooking(meetingId, guestId, currentUser.fullName);
    setShowModal(false);
  };

  const copyPublicLink = async () => {
    const base = (shopBaseUrl || `${window.location.origin}${window.location.pathname}`).replace(/\?.*$/, '').replace(/\/$/, '');
    const url = `${base}?page=booking`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {}
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

  if (calendarSubTab === 'public') {
    return (
      <div className="flex flex-col animate-fade-in" style={{ minHeight: 'calc(100vh - 130px)' }}>
        <div className="flex gap-1 p-1 mb-3 bg-gray-100 rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => setCalendarSubTab('staff')}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold text-gray-600 hover:bg-white transition-colors"
          >
            {fa ? 'جلسات پرسنل' : 'Staff meetings'}
          </button>
          <button
            type="button"
            className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-violet-600 text-white shadow-md"
          >
            {fa ? 'مشاوره عمومی' : 'Public consultations'}
          </button>
        </div>
        <ConsultationAdminManager
          meetings={meetings}
          personnel={personnel}
          categories={consultantCategories}
          currentUser={currentUser}
          lang={lang}
          shopBaseUrl={shopBaseUrl}
          embedded
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden animate-fade-in"
      style={{ height: 'calc(100vh - 130px)', minHeight: '600px' }}>

      {/* ── Sub-tabs ── */}
      <div className="flex gap-1 p-1 mx-3 mt-3 bg-gray-100 rounded-xl border border-gray-200 flex-shrink-0">
        <button
          type="button"
          className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white shadow-md"
        >
          {fa ? 'جلسات پرسنل' : 'Staff meetings'}
        </button>
        <button
          type="button"
          onClick={() => setCalendarSubTab('public')}
          className="flex-1 py-2.5 rounded-lg text-sm font-bold text-violet-700 hover:bg-violet-50 transition-colors"
        >
          {fa ? 'مشاوره عمومی' : 'Public consultations'}
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
            <IconCalendarClock className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-gray-800">{fa ? 'تقویم جلسات پرسنل' : 'Staff meeting calendar'}</span>
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
          const count = internalMeetings.filter(m => m.date === ds).length;
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
            const dayMeetings = internalMeetings
              .map(normalizeMeeting)
              .filter(m => m.date === ds && m.title);

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
                  const canEdit = meeting.organizerId === currentUser.id || (currentUser.roles || []).includes('مدیر');

                  return (
                    <div key={meeting.id}
                      className={`absolute rounded overflow-hidden shadow-sm z-10 group/m transition-all hover:shadow-md hover:z-30 ${colorClass}`}
                      style={{ top: `${top + 1}px`, height: `${height - 2}px`, left: '1px', right: '1px' }}
                      onClick={e => { e.stopPropagation(); handleOpenEdit(meeting); }}>

                      <div className="px-1 py-0.5 h-full flex flex-col overflow-hidden">
                        {/* Title always visible */}
                        <div className="text-white font-semibold leading-tight truncate" style={{ fontSize: '10px' }}>
                          {isBookableMeeting(meeting)
                            ? getMeetingSessionLabel(meeting, fa ? 'fa' : 'en')
                            : meeting.title}
                        </div>
                        {isBookableMeeting(meeting) && height > 22 && (
                          <div className="text-white/80 leading-none truncate" style={{ fontSize: '8px' }}>
                            {fa ? MEETING_STATUS_STYLE[getMeetingDisplayStatus(meeting) as 'open' | 'pending' | 'confirmed'].labelFa
                              : MEETING_STATUS_STYLE[getMeetingDisplayStatus(meeting) as 'open' | 'pending' | 'confirmed'].labelEn}
                            {(meeting.guests?.length || 0) > 0 ? ` (${meeting.guests!.length})` : ''}
                          </div>
                        )}
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

      <AppModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingMeetingId ? (fa ? 'ویرایش جلسه' : 'Edit Meeting') : (fa ? 'جلسه جدید' : 'New Meeting')}
        dir={fa ? 'rtl' : 'ltr'}
        size="sm"
        footer={(
          <button
            type="submit"
            form="staff-meeting-form"
            className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors"
          >
            {editingMeetingId ? (fa ? 'بروزرسانی' : 'Update') : (fa ? 'ثبت جلسه' : 'Save')}
          </button>
        )}
      >
        <form id="staff-meeting-form" onSubmit={handleSubmit} className="space-y-4">
          <p className="text-[11px] text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">{fa ? 'جلسات پرسنل — برای مشاوره عمومی به تب «مشاوره عمومی» بروید' : 'Staff meetings — use the Consultations tab for public booking'}</p>

          <div>
            <label className={modalFieldLabel}>{fa ? 'موضوع جلسه' : 'Title'} *</label>
            <input autoFocus required className={modalFieldInput} value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
          </div>

          <div>
            <label className={modalFieldLabel}>{fa ? 'تاریخ' : 'Date'}</label>
            <input type="date" required dir="ltr" className={modalFieldInput} value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={modalFieldLabel}>{fa ? 'شروع' : 'Start'}</label>
              <input type="time" required dir="ltr" className={`${modalFieldInput} text-center`} value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} />
            </div>
            <div>
              <label className={modalFieldLabel}>{fa ? 'پایان' : 'End'}</label>
              <input type="time" required dir="ltr" className={`${modalFieldInput} text-center`} value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={modalFieldLabel}>{fa ? 'مکان / لینک' : 'Location'}</label>
            <input className={modalFieldInput} value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
          </div>

          <div>
            <label className={modalFieldLabel}>{fa ? 'شرکت‌کنندگان' : 'Attendees'}</label>
            <StaffIdPicker
              personnel={personnel}
              selectedIds={formData.attendeeIds}
              onChange={ids => setFormData({ ...formData, attendeeIds: ids })}
              lang={lang}
            />
          </div>

          <div>
            <label className={modalFieldLabel}>{fa ? 'توضیحات' : 'Notes'}</label>
            <textarea rows={2} className={modalFieldTextarea} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          </div>
        </form>
      </AppModal>
    </div>
  );
};
