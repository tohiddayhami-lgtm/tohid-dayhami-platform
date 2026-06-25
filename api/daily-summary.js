/**
 * Vercel cron endpoint — sends a daily WhatsApp summary of tomorrow's meetings.
 * Schedule: "30 13 * * *"  (13:30 UTC = 17:00 Tehran winter / 18:00 Tehran summer)
 * Deduplication: one doc per day in "meeting_notification_sent" prevents double-sends.
 */

const PROJECT_ID = 'company-crm-103aa';
const API_KEY    = 'AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

// ── Firestore REST helpers (same as meeting-reminder.js) ─────────────────────

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
  await fetch(`${BASE}/${col}/${docId}?key=${API_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toFirestoreDoc(data)),
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

const DEFAULT_DAILY_SUMMARY_TEMPLATE =
  'سلام {recipientName} 👋\n📋 جلسات شما برای فردا ({tomorrowDate}):\n\n{meetingsList}\n\nموفق باشید! 🌟';

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Determine "today" and "tomorrow" in Tehran timezone
    const nowUtc = Date.now();
    const nowTehranMs = nowUtc + TEHRAN_OFFSET_MS;
    const todayTehran = new Date(nowTehranMs);
    const todayStr = todayTehran.toISOString().split('T')[0];  // YYYY-MM-DD Tehran today

    const tomorrowTehran = new Date(nowTehranMs + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrowTehran.toISOString().split('T')[0]; // YYYY-MM-DD Tehran tomorrow

    // Deduplication: one summary per day
    const dedupeDocId = `daily_summary_${todayStr}`;
    const alreadySent = await fetchDoc('meeting_notification_sent', dedupeDocId);
    if (alreadySent) {
      return res.json({ ok: true, message: 'Daily summary already sent today', sent: 0 });
    }

    // Fetch data in parallel
    const [appConfigDoc, allPersonnel, allMeetings] = await Promise.all([
      fetchDoc('settings', 'appConfig'),
      fetchCollection('personnel'),
      fetchCollection('meetings'),
    ]);

    const nc = appConfigDoc?.notificationConfig;
    if (!nc?.enabled || !nc.onDailySummary) {
      return res.json({ ok: true, message: 'Daily summary disabled', sent: 0 });
    }

    // Filter tomorrow's meetings
    const tomorrowMeetings = allMeetings.filter(m => m.date === tomorrowStr);
    if (tomorrowMeetings.length === 0) {
      // Mark as done anyway so we don't re-check
      await saveDoc('meeting_notification_sent', dedupeDocId, { sentAt: new Date().toISOString(), reason: 'no_meetings' });
      return res.json({ ok: true, message: 'No meetings tomorrow', sent: 0 });
    }

    // Build personnel lookup map
    const personnelMap = {};
    for (const p of allPersonnel) personnelMap[p.id] = p;

    // Group meetings by person (organizer + attendees)
    const personMeetings = {};
    for (const meeting of tomorrowMeetings) {
      const pids = [...new Set([meeting.organizerId, ...(meeting.attendeeIds || [])])];
      for (const pid of pids) {
        if (!personMeetings[pid]) personMeetings[pid] = [];
        personMeetings[pid].push(meeting);
      }
    }

    // Sort each person's meetings by start time
    for (const pid of Object.keys(personMeetings)) {
      personMeetings[pid].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    let sentCount = 0;
    const errors = [];

    for (const [pid, pMeetings] of Object.entries(personMeetings)) {
      const person = personnelMap[pid];
      if (!person) continue;
      const phone = nc.personnelPhones?.[pid];
      if (!phone) continue;
      const apiKey = nc.personnelApiKeys?.[pid];
      if (nc.provider === 'callmebot' && !apiKey) continue;

      const meetingsList = pMeetings
        .map(m => `• ${m.title} — ${m.startTime} تا ${m.endTime}${m.location ? ` — ${m.location}` : ''}`)
        .join('\n');

      const template = nc.dailySummaryTemplate || DEFAULT_DAILY_SUMMARY_TEMPLATE;
      const msg = renderTemplate(template, {
        recipientName: person.fullName,
        tomorrowDate:  tomorrowStr,
        meetingsList,
      });

      try {
        await sendWhatsApp(phone, msg, nc, apiKey);
        sentCount++;
      } catch (e) {
        errors.push(`${person.fullName}: ${e.message}`);
      }
    }

    // Mark daily summary as sent
    await saveDoc('meeting_notification_sent', dedupeDocId, {
      sentAt: new Date().toISOString(),
      tomorrowDate: tomorrowStr,
      sentCount,
    });

    return res.json({ ok: true, sent: sentCount, errors });
  } catch (e) {
    console.error('daily-summary error:', e);
    return res.status(500).json({ error: String(e) });
  }
}
