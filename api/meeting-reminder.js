/**
 * Vercel cron endpoint — sends WhatsApp reminders 1 hour before each meeting.
 * Schedule: every 5 minutes  →  "* /5 * * * *"  (Vercel Pro)
 * For Hobby plan: call this via an external cron (e.g. cron-job.org) every 5 min.
 *
 * Uses the same Firestore REST helpers as api/fb.js.
 * Deduplication: stores sent markers in collection "meeting_notification_sent".
 */

const PROJECT_ID = 'company-crm-103aa';
const API_KEY    = 'AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Tehran standard offset (UTC+3:30). Iran observes DST (UTC+4:30 in summer),
// but using 3.5 h gives at worst a 1-hour early reminder — still useful.
const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

// ── Firestore REST helpers ────────────────────────────────────────────────────

function parseValue(v) {
  if ('stringValue'    in v) return v.stringValue;
  if ('integerValue'   in v) return Number(v.integerValue);
  if ('doubleValue'    in v) return v.doubleValue;
  if ('booleanValue'   in v) return v.booleanValue;
  if ('nullValue'      in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue'     in v) return (v.arrayValue.values || []).map(parseValue);
  if ('mapValue'       in v) return parseFields(v.mapValue.fields || {});
  return null;
}
function parseFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields)) obj[k] = parseValue(v);
  return obj;
}
function parseDoc(doc) {
  return { id: doc.name.split('/').pop(), ...parseFields(doc.fields || {}) };
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')
    return Number.isInteger(v) && Math.abs(v) < 2e15
      ? { integerValue: String(v) }
      : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v))      return { arrayValue: { values: v.filter(x => x !== undefined).map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) fields[k] = toValue(v);
  return fields;
}
function toFirestoreDoc(data) {
  const { id, ...rest } = data;
  return { fields: toFields(rest) };
}

async function fetchDoc(col, docId) {
  const r = await fetch(`${BASE}/${col}/${docId}?key=${API_KEY}`);
  if (r.status === 404) return null;
  if (!r.ok) return null;
  const d = await r.json();
  return d.fields ? parseDoc(d) : null;
}

async function fetchCollection(col, pageSize = 500) {
  const r = await fetch(`${BASE}/${col}?key=${API_KEY}&pageSize=${pageSize}`);
  const data = await r.json();
  return (data.documents || []).map(parseDoc);
}

async function saveDoc(col, docId, data) {
  const body = JSON.stringify(toFirestoreDoc(data));
  await fetch(`${BASE}/${col}/${docId}?key=${API_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

// ── WhatsApp sending ──────────────────────────────────────────────────────────

function normalizePhone(phone) {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('09'))  return `+98${d.slice(1)}`;
  if (d.startsWith('989')) return `+${d}`;
  if (d.startsWith('98'))  return `+${d}`;
  if (d.startsWith('00'))  return `+${d.slice(2)}`;
  return `+${d}`;
}

async function sendWhatsApp(phone, message, nc, apiKey) {
  const p = normalizePhone(phone);
  if (nc.provider === 'callmebot') {
    const url =
      `https://api.callmebot.com/whatsapp.php` +
      `?phone=${encodeURIComponent(p)}` +
      `&text=${encodeURIComponent(message)}` +
      `&apikey=${encodeURIComponent(apiKey || '')}`;
    await fetch(url);
  } else if (nc.provider === 'ultramsg') {
    const body = new URLSearchParams({ token: nc.ultraMsgToken, to: p, body: message });
    await fetch(`https://api.ultramsg.com/${nc.ultraMsgInstance}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } else if (nc.provider === 'webhook') {
    await fetch(nc.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: p, message }),
    });
  }
}

function renderTemplate(template, vars) {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replace(new RegExp(`\\{${k}\\}`, 'g'), v || ''),
    template,
  );
}

const DEFAULT_MEETING_REMINDER_TEMPLATE =
  'سلام {recipientName} 👋\n⏰ یادآوری جلسه\n\n📌 موضوع: {meetingTitle}\n📅 تاریخ: {meetingDate}\n🕐 ساعت: {meetingTime}\n📍 مکان: {meetingLocation}\n\nیک ساعت دیگر شروع می‌شود ⏱';

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const nowUtc = Date.now();

    // Fetch Firestore data in parallel
    const [appConfigDoc, allPersonnel, allMeetings] = await Promise.all([
      fetchDoc('settings', 'appConfig'),
      fetchCollection('personnel'),
      fetchCollection('meetings'),
    ]);

    const nc = appConfigDoc?.notificationConfig;
    if (!nc?.enabled || !nc.onMeetingReminder) {
      return res.json({ ok: true, message: 'Meeting reminders disabled', sent: 0 });
    }

    // Build personnel lookup map
    const personnelMap = {};
    for (const p of allPersonnel) personnelMap[p.id] = p;

    let sentCount = 0;
    const errors = [];

    for (const meeting of allMeetings) {
      // Parse meeting time as Tehran local, convert to UTC
      // new Date('YYYY-MM-DDTHH:MM:00') on a UTC server = UTC timestamp for that literal time
      // Actual UTC = literal - Tehran offset (since Tehran = UTC + offset)
      const meetingLiteralMs = new Date(`${meeting.date}T${meeting.startTime}:00`).getTime();
      const meetingUtcMs = meetingLiteralMs - TEHRAN_OFFSET_MS;

      const diffMs = meetingUtcMs - nowUtc;
      // Window: 55–65 minutes before start (covers 5-min cron interval with buffer)
      if (diffMs < 55 * 60 * 1000 || diffMs > 65 * 60 * 1000) continue;

      // Check if reminder already sent for this meeting
      const sentDocId = `${meeting.id}_1hr`;
      const alreadySent = await fetchDoc('meeting_notification_sent', sentDocId);
      if (alreadySent) continue;

      // Send to organizer + all attendees (deduplicated)
      const allPersonIds = [...new Set([meeting.organizerId, ...(meeting.attendeeIds || [])])];
      const results = [];

      for (const pid of allPersonIds) {
        const person = personnelMap[pid];
        if (!person) continue;
        const phone = nc.personnelPhones?.[pid];
        if (!phone) continue;
        const apiKey = nc.personnelApiKeys?.[pid];
        if (nc.provider === 'callmebot' && !apiKey) continue;

        const template = nc.meetingReminderTemplate || DEFAULT_MEETING_REMINDER_TEMPLATE;
        const msg = renderTemplate(template, {
          recipientName: person.fullName,
          meetingTitle:  meeting.title,
          meetingDate:   meeting.date,
          meetingTime:   meeting.startTime,
          meetingLocation: meeting.location || 'نامشخص',
          organizerName: meeting.organizerName,
        });

        try {
          await sendWhatsApp(phone, msg, nc, apiKey);
          results.push({ pid, name: person.fullName, status: 'sent' });
          sentCount++;
        } catch (e) {
          results.push({ pid, name: person.fullName, status: 'failed', error: e.message });
          errors.push(e.message);
        }
      }

      // Mark reminder as sent to prevent duplicates
      await saveDoc('meeting_notification_sent', sentDocId, {
        meetingId: meeting.id,
        type: '1hr_reminder',
        sentAt: new Date().toISOString(),
        results,
      });
    }

    return res.json({ ok: true, sent: sentCount, errors });
  } catch (e) {
    console.error('meeting-reminder error:', e);
    return res.status(500).json({ error: String(e) });
  }
}
