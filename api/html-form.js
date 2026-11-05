/**
 * Host uploaded HTML forms and capture submissions into tickets + customers.
 *
 * GET  /api/html-form?id=<formId>   → injected HTML (also rewritten from /htmlform/:id)
 * POST /api/html-form               → { formId, data } → ticket + customer
 */

const PROJECT_ID = 'company-crm-103aa';
const API_KEY = 'AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function parseFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields || {})) obj[k] = parseValue(v);
  return obj;
}

function parseValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseValue);
  if ('mapValue' in v) return parseFields(v.mapValue.fields || {});
  return null;
}

function parseDoc(doc) {
  const id = doc.name.split('/').pop();
  return { id, ...parseFields(doc.fields || {}) };
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) && Math.abs(v) < 2e15
      ? { integerValue: String(v) }
      : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.filter(x => x !== undefined).map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) fields[k] = toValue(v);
  }
  return fields;
}

async function getDoc(col, id) {
  const r = await fetch(`${BASE}/${col}/${encodeURIComponent(id)}?key=${API_KEY}`);
  if (r.status === 404) return null;
  if (!r.ok) return null;
  const d = await r.json();
  return d.fields ? parseDoc(d) : null;
}

async function setDoc(col, id, data) {
  const r = await fetch(`${BASE}/${col}/${encodeURIComponent(id)}?key=${API_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields({ ...data, id }) }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`firestore write ${col}/${id}: ${r.status} ${t.slice(0, 300)}`);
  }
}

async function listCollection(col) {
  const docs = [];
  let pageToken;
  do {
    const qs = new URLSearchParams({ pageSize: '200', key: API_KEY });
    if (pageToken) qs.set('pageToken', pageToken);
    const r = await fetch(`${BASE}/${col}?${qs}`);
    if (!r.ok) break;
    const data = await r.json();
    for (const doc of data.documents || []) docs.push(parseDoc(doc));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

function waMeLink(phone) {
  let d = digits(phone);
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('09')) d = `98${d.slice(1)}`;
  return `https://wa.me/${d}`;
}

function normalizeNotifyPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('09')) return `+98${d.slice(1)}`;
  if (d.startsWith('989')) return `+${d}`;
  if (d.startsWith('98')) return `+${d}`;
  if (d.startsWith('00')) return `+${d.slice(2)}`;
  return `+${d}`;
}

async function sendWhatsApp(phone, message, nc, apiKey) {
  if (!nc || !phone || !message) return { success: false, error: 'missing' };
  const provider = nc.provider || 'callmebot';
  const p = normalizeNotifyPhone(phone);
  try {
    if (provider === 'callmebot') {
      if (!apiKey) return { success: false, error: 'no api key' };
      const text = String(message).slice(0, 700);
      const url =
        `https://api.callmebot.com/whatsapp.php` +
        `?phone=${encodeURIComponent(p)}` +
        `&text=${encodeURIComponent(text)}` +
        `&apikey=${encodeURIComponent(apiKey)}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
    } else if (provider === 'ultramsg') {
      if (!nc.ultraMsgToken || !nc.ultraMsgInstance) return { success: false, error: 'ultramsg not configured' };
      const body = new URLSearchParams({ token: nc.ultraMsgToken, to: p, body: message });
      const r = await fetch(`https://api.ultramsg.com/${nc.ultraMsgInstance}/messages/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!r.ok) return { success: false, error: `HTTP ${r.status}` };
    } else if (provider === 'webhook') {
      if (!nc.webhookUrl) return { success: false, error: 'no webhook' };
      await fetch(nc.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: p, message }),
      });
    } else {
      return { success: false, error: 'unknown provider' };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e && e.message ? e.message : e) };
  }
}

function isActivePerson(p) {
  return (p.status || 'active') === 'active';
}

function notifReady(nc, id) {
  const phones = nc.personnelPhones || {};
  const keys = nc.personnelApiKeys || {};
  if (!phones[id]) return false;
  if (nc.provider === 'callmebot' && !keys[id]) return false;
  return true;
}

function pickFallbackAssignee(personnel, nc) {
  const active = personnel.filter(isActivePerson);
  const isManager = p => (p.roles || []).some(r => typeof r === 'string' && r.includes('مدیر'));
  const ready = id => notifReady(nc, id);
  return (
    active.find(p => p.username === 'master' && ready(p.id))
    || active.find(p => isManager(p) && ready(p.id))
    || active.find(p => p.username === 'master')
    || active.find(p => isManager(p))
    || active.find(p => ready(p.id))
    || null
  );
}

function resolveFormAssignee(form, personnel) {
  if (form.assigneePersonnelId) {
    return personnel.find(p => p.id === form.assigneePersonnelId && isActivePerson(p)) || null;
  }
  if (form.assigneeRole) {
    const role = String(form.assigneeRole).trim().toLowerCase();
    const eligible = personnel.filter(p =>
      isActivePerson(p) && (p.roles || []).some(r => r && String(r).trim().toLowerCase() === role),
    );
    if (eligible.length) return eligible[0];
  }
  return null;
}

function buildFormNotifyMessage({ recipientName, formTitle, name, phone, ticketId }) {
  const wa = waMeLink(phone);
  return [
    `سلام ${recipientName || ''} 👋`.trim(),
    `📌 موضوع: ${formTitle || 'فرم'}`,
    `👤 ${name || 'بدون نام'}`,
    phone ? `📞 ${phone}` : '',
    wa ? `💬 ${wa}` : '',
    `📋 ${ticketId}`,
  ].filter(Boolean).join('\n').slice(0, 700);
}

function notifyRecipients(nc, personnel, preferred) {
  const readyIds = [];
  const seen = new Set();
  const add = id => {
    if (!id || seen.has(id) || !notifReady(nc, id)) return;
    seen.add(id);
    readyIds.push(id);
  };
  add(preferred?.id);
  add(nc.masterRecipientId);
  for (const id of Object.keys(nc.personnelPhones || {})) add(id);
  return readyIds.map(id => personnel.find(p => p.id === id) || { id, fullName: '' });
}

async function saveNotifyLog(log) {
  const id = `NL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    await setDoc('notification_logs', id, { ...log, id });
  } catch {
    /* non-fatal */
  }
}

async function notifyHtmlForm({ nc, personnel, form, name, phone, ticketId, assignee }) {
  if (!nc || nc.enabled === false) return false;
  const ncUse = { ...nc, provider: nc.provider || 'callmebot' };
  const preferred = assignee || resolveFormAssignee(form, personnel) || pickFallbackAssignee(personnel, ncUse);
  const targets = notifyRecipients(ncUse, personnel, preferred);
  if (!targets.length) return false;

  let any = false;
  for (const target of targets) {
    const staffPhone = ncUse.personnelPhones?.[target.id];
    const apiKey = ncUse.personnelApiKeys?.[target.id];
    if (!staffPhone) continue;
    const msg = buildFormNotifyMessage({
      recipientName: target.fullName,
      formTitle: displayFormTitle(form) || form.title || form.titleEn,
      name,
      phone,
      ticketId,
    });
    const result = await sendWhatsApp(staffPhone, msg, ncUse, apiKey);
    await saveNotifyLog({
      type: 'new_ticket',
      recipientId: target.id,
      recipientName: target.fullName || '',
      phone: staffPhone,
      message: msg,
      status: result.success ? 'sent' : 'failed',
      error: result.error,
      ticketId,
      createdAt: new Date().toISOString(),
    });
    if (result.success) any = true;
  }
  return any;
}

async function queryByField(col, field, value) {
  const r = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: col }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: 'EQUAL',
            value: { stringValue: value },
          },
        },
        limit: 1,
      },
    }),
  });
  if (!r.ok) return null;
  const rows = await r.json();
  const doc = rows?.[0]?.document;
  return doc?.fields ? parseDoc(doc) : null;
}

function slugifyFormName(s) {
  const ascii = String(s || '')
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return ascii || 'form';
}

function displayFormTitle(form) {
  const t = String(form && form.title || '').trim();
  const en = String(form && form.titleEn || '').trim();
  if (t && !/^html$/i.test(t)) return t;
  if (en && !/^html$/i.test(en)) return en;
  const slug = String(form && form.slug || '').replace(/[-_]+/g, ' ').trim();
  if (slug && !/^html/i.test(slug)) return slug;
  return '';
}

function formPublicSlug(form) {
  if (form.slug && String(form.slug).trim()) return String(form.slug).trim();
  const fromEn = slugifyFormName(form.titleEn || '');
  if (fromEn !== 'form') return fromEn;
  const fromTitle = slugifyFormName(form.title || '');
  if (fromTitle !== 'form') return fromTitle;
  return slugifyFormName(form.id || 'form');
}

async function findFormByRef(ref) {
  const key = String(ref || '').trim();
  if (!key) return null;
  const byId = await getDoc('custom_forms', key);
  if (byId) return byId;
  const bySlug = await queryByField('custom_forms', 'slug', key);
  if (bySlug) return bySlug;
  const all = await listCollection('custom_forms');
  return all.find(f => formPublicSlug(f) === key.toLowerCase()) || null;
}

function originFromReq(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.tohiddayhami.com';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function faviconType(href) {
  const p = String(href || '').split('?')[0].toLowerCase();
  if (p.endsWith('.svg')) return 'image/svg+xml';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.webp')) return 'image/webp';
  if (p.endsWith('.ico')) return 'image/x-icon';
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
  return '';
}

function faviconTags(href) {
  if (!href) return '';
  const type = faviconType(href);
  const t = type ? ` type="${type}"` : '';
  const u = esc(href);
  return `<link rel="icon"${t} href="${u}" />
<link rel="shortcut icon"${t} href="${u}" />
<link rel="apple-touch-icon" href="${u}" />`;
}

function closedPage(title, message, favicon) {
  return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title>
${faviconTags(favicon)}
<style>body{font-family:Tahoma,sans-serif;max-width:520px;margin:4rem auto;padding:0 1.25rem;line-height:1.8;color:#1d1d1f;text-align:center}</style>
</head><body><h1>${esc(title)}</h1><p>${esc(message)}</p></body></html>`;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function injectPreviewMeta(html, form, origin, formId, favicon) {
  const title = String(form.title || form.titleEn || '').trim() || 'فرم آنلاین';
  const desc = String(form.description || form.descriptionEn || form.titleEn || title).trim();
  const url = `${origin}/f/${formPublicSlug(form)}`;
  const tags = `
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="پلتفرم توحید دیهمی" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<link rel="canonical" href="${esc(url)}" />
${faviconTags(favicon)}
`;
  let out = String(html || '');
  out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, '');
  out = out.replace(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi, '');
  out = out.replace(/<meta[^>]+(?:property|name)=["'](?:og:title|og:description|og:url|twitter:title|twitter:description|description)["'][^>]*>/gi, '');
  if (/<head[^>]*>/i.test(out)) return out.replace(/<head[^>]*>/i, m => `${m}\n${tags}`);
  if (/<html[^>]*>/i.test(out)) return out.replace(/<html[^>]*>/i, m => `${m}\n<head>${tags}</head>`);
  return `<!DOCTYPE html><html lang="fa" dir="rtl"><head>${tags}</head><body>${out}</body></html>`;
}

function injectBridge(html, formId, origin) {
  const endpoint = `${origin}/api/html-form`;
  const script = `<script>(function(){
    var FORM_ID=${JSON.stringify(formId)};
    var ENDPOINT=${JSON.stringify(endpoint)};
    var inFlight=false;
    var lastSentAt=0;
    var SNAP={};
    var SUBMIT_RE=/ثبت\\s*نهایی|ثبت\\s*فرم|ثبت\\s*درخواست|ارسال\\s*نهایی|ارسال\\s*فرم|ارسال\\s*درخواست|\\bsubmit\\b|confirm\\s*and\\s*send/i;
    var NAV_RE=/^(ادامه|بعدی|قبلی|بازگشت|ویرایش|لغو|انصراف|next|continue|back|prev|previous|edit|cancel)$/i;
    function flatten(v){
      if(v==null) return "";
      if(Array.isArray(v)) return v.filter(Boolean).join(", ");
      if(typeof v==="object") try{return JSON.stringify(v)}catch(e){return String(v)}
      return String(v);
    }
    function isNoiseKey(k){
      return /^(id|color|ts|v|L|lang|step|visitors|password|token)$/i.test(k);
    }
    function isNoiseVal(s){
      if(!s) return true;
      if(/^Guest\\s+\\d+$/i.test(s)) return true;
      if(/Guest\\s+\\d+/i.test(s) && (s.match(/,/g)||[]).length>=1) return true;
      return false;
    }
    function putInto(obj,k,v){
      if(!k || isNoiseKey(k)) return;
      var s=flatten(v).trim();
      if(!s || s==="{}" || s==="[]" || isNoiseVal(s)) return;
      if(s.length>4000) s=s.slice(0,4000);
      obj[k]=s;
    }
    function mergeObj(obj, src){
      if(!src || typeof src!=="object") return;
      Object.keys(src).forEach(function(k){ putInto(obj,k,src[k]); });
    }
    function labelOf(el){
      if(!el) return "";
      if(el.id){
        var lab=document.querySelector('label[for="'+String(el.id).replace(/"/g,"")+'"]');
        if(lab) return (lab.innerText||"").split("\\n")[0].trim();
      }
      var wrap=el.closest && el.closest("label");
      if(wrap) return (wrap.innerText||"").split("\\n")[0].trim();
      return (el.getAttribute("aria-label")||el.getAttribute("placeholder")||"").trim();
    }
    function fieldKey(el,i){
      var key=el.getAttribute("data-k")||el.getAttribute("name")||el.id||labelOf(el);
      key=String(key||"").replace(/\\s+/g," ").trim();
      if(!key || key==="f-copytext") return "field_"+(i+1);
      return key.slice(0,80);
    }
    function readEl(el,i){
      if(!el || el.type==="file" || el.type==="button" || el.type==="submit" || el.type==="reset") return;
      if(el.id==="f-copytext") return;
      var key=fieldKey(el,i||0);
      if(el.type==="checkbox"){ if(el.checked) putInto(SNAP,key, el.value && el.value!=="on" ? el.value : "true"); return; }
      if(el.type==="radio"){ if(el.checked) putInto(SNAP,key, el.value||"true"); return; }
      if(el.tagName==="SELECT" && el.multiple){
        putInto(SNAP,key, Array.prototype.map.call(el.selectedOptions||[],function(o){return o.text||o.value}).join(", "));
        return;
      }
      if(el.value) putInto(SNAP,key, el.value);
    }
    document.addEventListener("input",function(e){ if(e.target) readEl(e.target,0); },true);
    document.addEventListener("change",function(e){ if(e.target) readEl(e.target,0); },true);
    document.addEventListener("click",function(e){
      var c=e.target && e.target.closest && e.target.closest(".chip,[data-key][data-val]");
      if(!c) return;
      var k=c.getAttribute("data-key")||c.getAttribute("data-k");
      var v=c.getAttribute("data-val")||(c.innerText||"").trim();
      if(k && v) putInto(SNAP,k,v);
    },true);
    function looksLikeVisitor(o){
      if(!o || typeof o!=="object") return true;
      if(/^Guest\\s+\\d+$/i.test(String(o.name||""))) return true;
      if(o.color && o.id && String(o.id).indexOf("v_")==0) return true;
      return false;
    }
    function looksLikeFormState(o){
      if(!o || typeof o!=="object" || Array.isArray(o)) return false;
      if(looksLikeVisitor(o)) return false;
      if(o.S && typeof o.S==="object" && !Array.isArray(o.S)) return true;
      var keys=Object.keys(o).join(" ").toLowerCase();
      return /(nm|ph|mobile|phone|whatsapp|fullName|fullname|نام|موبایل|email|شرکت)/i.test(keys);
    }
    function takeFormObj(out,o){
      if(!looksLikeFormState(o)) return;
      if(o.S && typeof o.S==="object") mergeObj(out,o.S);
      else mergeObj(out,o);
    }
    function fromStorage(){
      var out={};
      try{
        var prefer=["arka-exs","arka-req","htmlform-"+FORM_ID,"form-"+FORM_ID,FORM_ID];
        prefer.forEach(function(key){
          var raw=localStorage.getItem(key);
          if(!raw) return;
          try{ takeFormObj(out, JSON.parse(raw)); }catch(e){}
        });
        for(var i=0;i<localStorage.length;i++){
          var key=localStorage.key(i);
          if(!key || prefer.indexOf(key)>=0) continue;
          if(!/(arka|htmlform|form-draft|td-form|req)/i.test(key)) continue;
          var raw=localStorage.getItem(key);
          if(!raw || (raw[0]!=="{" && raw[0]!=="[")) continue;
          try{ takeFormObj(out, JSON.parse(raw)); }catch(e){}
        }
      }catch(e){}
      return out;
    }
    function fromSummary(){
      var out={};
      document.querySelectorAll("dl.sum div, .sum div, dl div").forEach(function(row){
        var dt=row.querySelector("dt");
        var dd=row.querySelector("dd");
        if(dt && dd) putInto(out,(dt.innerText||"").trim(), (dd.innerText||"").trim());
      });
      document.querySelectorAll("dt").forEach(function(dt){
        var dd=dt.nextElementSibling;
        if(dd && dd.tagName==="DD") putInto(out,(dt.innerText||"").trim(), (dd.innerText||"").trim());
      });
      return out;
    }
    function collect(){
      var data={};
      mergeObj(data, fromStorage());
      try{ if(window.S && typeof window.S==="object") mergeObj(data, window.S); }catch(e){}
      try{ if(looksLikeFormState(window.formData)) mergeObj(data, window.formData); }catch(e){}
      document.querySelectorAll("input,textarea,select").forEach(function(el,i){ readEl(el,i); });
      mergeObj(data, SNAP);
      mergeObj(data, fromSummary());
      document.querySelectorAll("[aria-pressed=true],[data-selected=true],.chip[aria-pressed=true]").forEach(function(el,i){
        putInto(data, el.getAttribute("data-key")||labelOf(el)||"choice_"+(i+1), el.getAttribute("data-val")||(el.innerText||"").trim());
      });
      return data;
    }
    function btnText(el){
      return ((el.innerText||el.value||el.getAttribute("aria-label")||"")+" ").replace(/\\s+/g," ").trim();
    }
    function isWhatsAppEl(el){
      if(!el) return false;
      var href=(el.getAttribute && (el.getAttribute("href")||"")) || "";
      var id=(el.id||"")+" "+(el.className||"");
      if(/wa\\.me|whatsapp|api\\.whatsapp/i.test(href)) return true;
      if(/\\b(b-wa|wa-link)\\b/i.test(id) || el.id==="wa") return true;
      if(/^whatsapp$/i.test((el.innerText||"").replace(/\\s+/g," ").trim())) return true;
      return false;
    }
    function isSubmitEl(el){
      if(!el || !el.closest) return null;
      var btn=el.closest("button,input[type=submit],input[type=button],a[href], [type=submit], [role=button]");
      if(!btn) return null;
      if(isWhatsAppEl(btn) || btn.closest && btn.closest("a[href*='whatsapp'],a[href*='wa.me'],.wa-link,#wa,#b-wa")) return null;
      var t=btnText(btn);
      if(NAV_RE.test(t)) return null;
      if(/whatsapp|واتس\\s*اپ/i.test(t) && !/ثبت|ارسال\\s*نهایی/i.test(t)) return null;
      if((btn.getAttribute("type")||"").toLowerCase()==="submit") return btn;
      if(SUBMIT_RE.test(t)) return btn;
      if(/^(b-)?submit$/i.test(btn.id||"") || /\\bsubmit\\b/i.test(btn.className||"")) return btn;
      return null;
    }
    function toast(msg, ok){
      try{
        var n=document.createElement("div");
        n.setAttribute("role","status");
        n.style.cssText="position:fixed;bottom:16px;inset-inline:16px;z-index:100001;background:"+(ok?"#065f46":"#7f1d1d")+";color:#fff;padding:12px 16px;border-radius:10px;font:600 13px Tahoma,sans-serif;text-align:center";
        n.textContent=msg;
        document.body.appendChild(n);
        setTimeout(function(){ n.remove(); },4500);
      }catch(e){}
    }
    function showBusy(){
      try{
        var el=document.getElementById("td-form-busy");
        if(!el){
          el=document.createElement("div");
          el.id="td-form-busy";
          el.setAttribute("role","status");
          el.setAttribute("aria-live","assertive");
          el.style.cssText="position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;font-family:Tahoma,sans-serif";
          el.innerHTML='<div style="background:#fff;color:#0f172a;border-radius:16px;padding:22px 28px;min-width:220px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.25)"><div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#0f766e;border-radius:50%;margin:0 auto 14px;animation:td-spin .8s linear infinite"></div><div style="font:700 15px Tahoma,sans-serif">در حال ثبت درخواست…</div><div style="margin-top:6px;font:400 12px Tahoma,sans-serif;color:#64748b">لطفاً چند لحظه صبر کنید</div></div>';
          if(!document.getElementById("td-form-busy-style")){
            var st=document.createElement("style");
            st.id="td-form-busy-style";
            st.textContent="@keyframes td-spin{to{transform:rotate(360deg)}}";
            document.head.appendChild(st);
          }
          document.body.appendChild(el);
        }
        el.style.display="flex";
      }catch(e){}
    }
    function hideBusy(){
      try{
        var el=document.getElementById("td-form-busy");
        if(el) el.style.display="none";
      }catch(e){}
    }
    function payloadKey(data){
      try{ return JSON.stringify(data); }catch(e){ return ""; }
    }
    function sentStoreKey(){ return "td-html-sent-"+FORM_ID; }
    function alreadySent(data){
      try{
        var prev=sessionStorage.getItem(sentStoreKey());
        var key=payloadKey(data);
        return !!(prev && key && prev===key);
      }catch(e){ return false; }
    }
    function markSent(data){
      try{ sessionStorage.setItem(sentStoreKey(), payloadKey(data)); }catch(e){}
    }
    function resetToStart(){
      SNAP={};
      try{ sessionStorage.removeItem(sentStoreKey()); }catch(e){}
      try{
        ["arka-exs","arka-req","htmlform-"+FORM_ID,"form-"+FORM_ID,FORM_ID].forEach(function(k){
          try{ localStorage.removeItem(k); }catch(e){}
        });
      }catch(e){}
      try{
        document.querySelectorAll("input,textarea").forEach(function(el){
          if(el.type==="checkbox"||el.type==="radio") el.checked=false;
          else el.value="";
        });
        document.querySelectorAll("select").forEach(function(el){ el.selectedIndex=0; });
      }catch(e){}
      try{ location.reload(); }catch(e){}
    }
    function showSuccess(){
      hideBusy();
      try{
        var old=document.getElementById("td-form-ok");
        if(old) old.remove();
        var el=document.createElement("div");
        el.id="td-form-ok";
        el.setAttribute("role","dialog");
        el.style.cssText="position:fixed;inset:0;z-index:100002;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Tahoma,sans-serif";
        el.innerHTML='<div style="background:#fff;color:#0f172a;border-radius:18px;padding:28px 24px;max-width:420px;width:100%;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.25)"><div style="width:52px;height:52px;border-radius:50%;background:#d1fae5;color:#047857;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font:700 26px/1 Tahoma,sans-serif">✓</div><div style="font:700 16px/1.8 Tahoma,sans-serif">فرم شما با موفقیت ثبت شد و همکاران ما با شما ارتباط می‌گیرند</div><button type="button" id="td-form-ok-btn" style="margin-top:18px;background:#0f766e;color:#fff;border:0;border-radius:12px;padding:12px 22px;font:700 14px Tahoma,sans-serif;cursor:pointer">بازگشت به ابتدا</button></div>';
        document.body.appendChild(el);
        var btn=document.getElementById("td-form-ok-btn");
        if(btn) btn.onclick=function(){ resetToStart(); };
      }catch(e){
        toast("فرم شما با موفقیت ثبت شد و همکاران ما با شما ارتباط می‌گیرند", true);
        setTimeout(resetToStart, 2200);
      }
    }
    async function submitToCrm(){
      if(inFlight) return false;
      var data=collect();
      if(!Object.keys(data).length){
        toast("لطفاً فرم را تکمیل کنید", false);
        return false;
      }
      if(alreadySent(data)){
        showSuccess();
        return true;
      }
      inFlight=true;
      showBusy();
      try{
        var r=await fetch(ENDPOINT,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({formId:FORM_ID,data:data})
        });
        hideBusy();
        if(!r.ok){ toast("خطا در ثبت در سامانه. دوباره تلاش کنید.", false); return false; }
        lastSentAt=Date.now();
        markSent(data);
        showSuccess();
        return true;
      }catch(e){
        hideBusy();
        toast("خطا در اتصال. دوباره تلاش کنید.", false);
        return false;
      }finally{
        inFlight=false;
        hideBusy();
      }
    }
    document.addEventListener("click",function(e){
      if(e.target && e.target.closest && e.target.closest("a[href*='whatsapp'],a[href*='wa.me'],.wa-link,#wa,#b-wa")) return;
      var btn=isSubmitEl(e.target);
      if(!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if(btn.disabled) return;
      btn.disabled=true;
      submitToCrm().then(function(ok){
        if(!ok) btn.disabled=false;
      });
    },true);
    document.addEventListener("submit",function(e){
      var form=e.target;
      if(!form || form.tagName!=="FORM") return;
      e.preventDefault();
      e.stopPropagation();
      submitToCrm();
    },true);
  })();<\/script>`;
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body[^>]*>/i, m => `${m}\n${script}`);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}\n</body>`);
  return `${script}\n${html}`;
}

function flattenVal(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.filter(Boolean).map(flattenVal).join(', ');
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

function toWesternDigits(s) {
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  return String(s || '')
    .replace(/[۰-۹]/g, ch => String(fa.indexOf(ch)))
    .replace(/[٠-٩]/g, ch => String(ar.indexOf(ch)));
}

function isContactKey(k) {
  return /name|mobile|phone|tel|whatsapp|نام|موبایل|تلفن|واتس/i.test(String(k || ''));
}

function isJunkText(s, key) {
  const t = String(s || '').trim();
  if (!t) return true;
  if (/^Guest\s+\d+$/i.test(t)) return true;
  if (/Guest\s+\d+/i.test(t) && t.includes(',')) return true;
  if (isContactKey(key)) return false;
  if (t.length > 180 && t.split(',').length > 4) return true;
  return false;
}

function pick(data, keys, opts = {}) {
  const allow = (s) => {
    const t = flattenVal(s).trim();
    if (!t || isJunkText(t, opts.phone ? 'phone' : 'name')) return '';
    if (opts.phone) {
      const d = digits(t);
      if (d.length < 8 || d.length > 15) return '';
      return t;
    }
    if (/^\+?\d[\d\s-]{7,}$/.test(t)) return '';
    return t;
  };
  for (const k of keys) {
    const s = allow(data[k]);
    if (s) return s;
  }
  const lowerKeys = keys.map(k => String(k).toLowerCase());
  for (const [dk, dv] of Object.entries(data || {})) {
    const dl = String(dk).toLowerCase();
    if (lowerKeys.some(k => dl === k || dl.includes(k) || k.includes(dl))) {
      const s = allow(dv);
      if (s) return s;
    }
  }
  return '';
}

function digits(s) {
  return toWesternDigits(s).replace(/\D/g, '');
}

function extractPhone(data) {
  const direct = pick(data, [
    'ph', 'mobile', 'phone', 'whatsapp', 'wa', 'tel', 'phoneNumber', 'موبایل', 'تلفن', 'شماره تماس',
    'موبایل / واتس‌اپ', 'موبایل / واتس‌اپ (با کد کشور)', 'واتس‌اپ',
  ], { phone: true });
  if (direct) return direct;
  for (const v of Object.values(data || {})) {
    const d = digits(v);
    if (d.length >= 8 && d.length <= 15) return flattenVal(v).trim();
  }
  return '';
}

function extractName(data, phone) {
  const direct = pick(data, [
    'nm', 'name', 'fullName', 'full_name', 'customerName', 'نام', 'نام و نام خانوادگی', 'نام کامل',
  ]);
  if (direct && digits(direct) !== digits(phone)) return direct;
  for (const [k, v] of Object.entries(data || {})) {
    if (!isContactKey(k) && /svc|field|goal|exp|market|ans|note|heard/i.test(k)) continue;
    const t = flattenVal(v).trim();
    if (t.length >= 3 && t.length <= 80 && /[^\d+]/.test(t) && digits(t) !== digits(phone) && !isJunkText(t, k)) {
      if (/نام/.test(k) || /^name$/i.test(k)) return t;
    }
  }
  return direct || '';
}

function safeFieldKey(k) {
  const s = String(k || '')
    .replace(/[.[\]*$]/g, '_')
    .replace(/^__+/, '')
    .trim()
    .slice(0, 80);
  return s || 'field';
}

const SKIP_DATA_KEYS = /^(id|color|ts|v|L|lang|step|visitors|password|token|formId|formTitle|importSource)$/i;

function cleanFormData(raw) {
  const data = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (SKIP_DATA_KEYS.test(k)) continue;
    const s = flattenVal(v).trim();
    if (!s || isJunkText(s, k)) continue;
    data[k] = s.slice(0, 4000);
  }
  return data;
}

const FIELD_LABELS = {
  nm: 'نام',
  name: 'نام',
  fullName: 'نام',
  full_name: 'نام',
  ph: 'موبایل',
  mobile: 'موبایل',
  phone: 'موبایل',
  tel: 'تلفن',
  whatsapp: 'واتس‌اپ',
  wa: 'واتس‌اپ',
  email: 'ایمیل',
  company: 'شرکت',
  brand: 'برند',
  city: 'شهر',
  location: 'موقعیت',
  country: 'کشور',
  svc: 'خدمات',
  service: 'خدمات',
  msg: 'توضیحات',
  message: 'توضیحات',
  note: 'یادداشت',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const origin = originFromReq(req);

  try {
    if (req.method === 'GET') {
      const ref = String(req.query.id || req.query.formId || req.query.slug || '').trim();
      if (!ref) return res.status(400).send('form id required');
      const form = await findFormByRef(ref);
      const cfg = await getDoc('settings', 'appConfig');
      const favicon = cfg?.favicon || '';
      if (!form || form.kind !== 'html' || form.isPublic === false) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(closedPage('فرم یافت نشد', 'این فرم در دسترس نیست.', favicon));
      }
      const id = form.id;
      if (form.isClosed) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(closedPage(
          form.title || form.titleEn || 'فرم',
          form.closedMessage || 'مهلت تکمیل این فرم به پایان رسیده است.',
          favicon,
        ));
      }
      const body = await getDoc('html_form_bodies', id);
      if (!body?.html) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(closedPage('فرم ناقص است', 'فایل HTML این فرم ذخیره نشده.', favicon));
      }
      const html = injectBridge(injectPreviewMeta(String(body.html), form, origin, id, favicon), id, origin);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(html);
    }

    if (req.method === 'POST') {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const formId = String(payload.formId || '').trim();
      const raw = payload.data && typeof payload.data === 'object' ? payload.data : {};
      if (!formId) return res.status(400).json({ error: 'formId required' });

      const form = await getDoc('custom_forms', formId);
      if (!form || form.kind !== 'html' || form.isPublic === false) {
        return res.status(404).json({ error: 'form_not_found' });
      }
      if (form.isClosed) return res.status(403).json({ error: 'form_closed' });

      const data = cleanFormData(raw);

      const phone = extractPhone(data);
      const name = extractName(data, phone) || 'بدون نام';
      const email = pick(data, ['email', 'ایمیل']);
      const company = pick(data, ['company', 'companyName', 'brand', 'شرکت', 'شرکت / برند']);
      const city = pick(data, ['city', 'location', 'country', 'شهر', 'شهر / کشور']) || '-';
      const phoneNorm = digits(phone);

      const now = new Date().toISOString();
      const ticketId = `HTML-${Date.now().toString().slice(-8)}-${formId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8).toUpperCase() || 'FORM'}`;

      const formTitle = displayFormTitle(form) || form.title || form.titleEn || 'فرم آنلاین';
      const descLines = Object.entries(data)
        .filter(([, v]) => v)
        .map(([k, v]) => `${FIELD_LABELS[k] || k}: ${v}`);
      const description = [
        `موضوع: ${formTitle}`,
        `درخواست جدید از فرم «${formTitle}»`,
        `شناسه درخواست: ${ticketId}`,
        name !== 'بدون نام' ? `ثبت‌کننده: ${name}` : '',
        phone ? `شماره: ${phone}` : '',
        '',
        ...descLines,
      ].filter(Boolean).join('\n');

      const customData = {
        formId,
        formTitle,
        importSource: 'html_form',
        requestId: ticketId,
        customerName: name,
        customerPhone: phone || '',
      };
      for (const [k, v] of Object.entries(data)) {
        const sk = safeFieldKey(k);
        if (sk === 'formTitle' || sk === 'formId' || sk === 'importSource') continue;
        customData[sk] = v;
      }
      customData.formTitle = formTitle;
      if (form.assigneePersonnelId) customData.__assigneePersonnelId = form.assigneePersonnelId;
      if (form.assigneeRole) customData.__assigneeRole = form.assigneeRole;

      const timeline = [{
        type: 'creation',
        title: 'درخواست جدید از فرم HTML',
        description: `درخواست جداگانه از فرم «${form.title || ''}»${name !== 'بدون نام' ? ` — ${name}` : ''}`,
        actorName: 'سیستم',
        timestamp: now,
        visibility: 'public',
      }];

      let assignee = form.assigneePersonnelId
        ? { id: form.assigneePersonnelId, fullName: '' }
        : null;

      const ticket = {
        id: ticketId,
        customerName: name,
        companyName: company || undefined,
        location: city,
        phoneNumber: phone || '-',
        whatsappNumber: phone || '-',
        serviceId: `form:${formId}`,
        description,
        status: 'ثبت شده',
        createdAt: now,
        assignedTo: form.assigneePersonnelId || undefined,
        timeline,
        customData,
      };

      await setDoc('tickets', ticketId, ticket);

      if (phoneNorm.length >= 8) {
        let existing = await queryByField('customers', 'phoneNumber', phone);
        if (!existing && phone !== phoneNorm) {
          existing = await queryByField('customers', 'phoneNumber', phoneNorm);
        }
        if (existing) {
          const keepName = name !== 'بدون نام' && !isJunkText(name)
            ? name
            : (existing.fullName || name);
          await setDoc('customers', existing.id, {
            ...existing,
            fullName: keepName,
            companyName: company || existing.companyName,
            location: city !== '-' ? city : (existing.location || '-'),
            whatsappNumber: phone || existing.whatsappNumber,
            email: email || existing.email,
            totalTickets: Number(existing.totalTickets || 0) + 1,
            source: existing.source || `HTML Form: ${form.title || ''}`,
          });
        } else {
          const cid = `C-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
          const suffix = phoneNorm.slice(-4) || '0000';
          await setDoc('customers', cid, {
            id: cid,
            fullName: name,
            companyName: company || undefined,
            location: city,
            phoneNumber: phoneNorm.length === digits(phone).length ? phone : phone,
            whatsappNumber: phone,
            email: email || undefined,
            firstContact: now,
            totalTickets: 1,
            source: `HTML Form: ${form.title || ''}`,
            loyaltyCode: `VIP-${suffix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          });
        }
      }

      try {
        const cfg = await getDoc('settings', 'appConfig');
        const nc = cfg?.notificationConfig;
        const personnel = await listCollection('personnel');
        assignee = resolveFormAssignee(form, personnel) || (nc ? pickFallbackAssignee(personnel, nc) : null);
        if (assignee?.id && assignee.id !== ticket.assignedTo) {
          timeline.push({
            type: 'assignment',
            title: 'ارجاع خودکار (سیستم)',
            description: `ارجاع به ${assignee.fullName}`,
            actorName: 'سیستم',
            timestamp: now,
            visibility: 'internal',
          });
          ticket.assignedTo = assignee.id;
          ticket.timeline = timeline;
          await setDoc('tickets', ticketId, ticket);
        }
        const sent = await notifyHtmlForm({
          nc,
          personnel,
          form,
          name,
          phone,
          ticketId,
          assignee,
        });
        if (sent) {
          await setDoc('tickets', ticketId, {
            ...ticket,
            customData: { ...ticket.customData, whatsappNotified: '1' },
          });
        }
      } catch {
        /* ticket is saved even if WhatsApp fails */
      }

      return res.status(200).json({ ok: true, ticketId });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
