/**
 * Host uploaded HTML forms and capture submissions into tickets + customers.
 *
 * GET  /api/html-form?id=<formId>   → injected HTML (also rewritten from /htmlform/:id)
 * POST /api/html-form               → { formId, data } → ticket + customer
 */

const PROJECT_ID = 'company-crm-103aa';
const API_KEY = 'AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const STORAGE_BUCKET = 'calculator-55611.firebasestorage.app';

export const config = { api: { bodyParser: { sizeLimit: '9mb' } } };

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

function currentStaffById(personnel, id) {
  if (!id) return null;
  const person = personnel.find(p => p.id === id);
  if (!person || !isActivePerson(person)) return null;
  return person;
}

function notifyRecipients(nc, personnel, preferred) {
  const readyIds = [];
  const seen = new Set();
  const add = id => {
    if (!id || seen.has(id) || !notifReady(nc, id)) return;
    if (!currentStaffById(personnel, id)) return;
    seen.add(id);
    readyIds.push(id);
  };
  add(preferred?.id);
  add(nc.masterRecipientId);
  for (const person of personnel) {
    if (isActivePerson(person)) add(person.id);
  }
  return readyIds.map(id => currentStaffById(personnel, id)).filter(Boolean);
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
    if (!currentStaffById(personnel, target.id)) continue;
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
  const freshKey = `td-html-fresh-${formId}`;
  html = String(html || '').replace(/const\s+SUBMIT_URL\s*=\s*(['"])[^'"]*\1/, `const SUBMIT_URL=${JSON.stringify(endpoint)}`);
  const boot = `<script>(function(){
    try{
      if(!sessionStorage.getItem(${JSON.stringify(freshKey)})) return;
      var keys=[];
      for(var i=0;i<localStorage.length;i++) keys.push(localStorage.key(i));
      keys.forEach(function(key){
        if(!key) return;
        if(key===${JSON.stringify(formId)} || /^(arka-|htmlform|form-draft|td-form)/i.test(key) || /arka-/i.test(key)){
          try{ localStorage.removeItem(key); }catch(e){}
        }
      });
      try{ sessionStorage.removeItem(${JSON.stringify("td-html-sent-"+formId)}); }catch(e){}
    }catch(e){}
  })();<\/script>`;
  const script = `<script>(function(){
    var FORM_ID=${JSON.stringify(formId)};
    var ENDPOINT=${JSON.stringify(endpoint)};
    var UPLOAD=${JSON.stringify(`${origin}/api/html-form-file`)};
    var origFetch=window.fetch;
    function grabPanel(){
      var el=document.querySelector("#wiz.on dl.wrev")||document.querySelector("#wiz.on .wbody")||document.querySelector("#sheet.on")||document.querySelector("#ceobody")||document.querySelector("dl.rev")||document.querySelector("dl.wrev")||document.querySelector(".report,#result,[data-result],.sum")||document.querySelector("#app");
      var text=el && (el.innerText||"").replace(/[ \\t]+\\n/g,"\\n").replace(/\\n{3,}/g,"\\n\\n").trim()||"";
      return {el:el,text:text};
    }
    function paintFormCopy(text){
      var lines=String(text||"").split(/\\n/).map(function(s){return s.replace(/\\s+/g," ").trim()}).filter(Boolean).slice(0,42);
      if(lines.length<2) return "";
      var pad=28, lineH=28, w=920, h=Math.min(pad*2+56+lines.length*lineH, 1600);
      var c=document.createElement("canvas");
      c.width=w; c.height=h;
      var ctx=c.getContext("2d");
      ctx.fillStyle="#f8fafc"; ctx.fillRect(0,0,w,h);
      ctx.fillStyle="#0f766e"; ctx.fillRect(0,0,w,8);
      ctx.fillStyle="#0f172a"; ctx.font="700 20px Tahoma,sans-serif";
      ctx.direction="rtl"; ctx.textAlign="right";
      var x=w-pad, y=pad+18;
      ctx.fillText("نتیجه ارزیابی و پاسخ‌های فرم", x, y);
      y+=40;
      ctx.font="400 16px Tahoma,sans-serif"; ctx.fillStyle="#1e293b";
      for(var i=0;i<lines.length && y<h-18;i++){
        var s=lines[i];
        if(s.length>72) s=s.slice(0,72)+"…";
        ctx.fillText(s, x, y);
        y+=lineH;
      }
      return c.toDataURL("image/jpeg",0.86);
    }
    async function attachSnapshot(j){
      if(!j || typeof j!=="object") return j;
      if(!j.data || typeof j.data!=="object" || Array.isArray(j.data)) j.data={};
      j.files=Array.isArray(j.files)?j.files:[];
      var panel=grabPanel();
      if(panel.text && panel.text.length>20 && !j.data.__formCopy) j.data.__formCopy=panel.text.slice(0,8000);
      if(j.files.some(function(f){return f && /فرم|نتیجه|copy|snapshot|result/i.test(String(f.label||f.name||""));})) return j;
      var dataUrl="";
      try{
        if(window.html2canvas && panel.el){
          var cv=await window.html2canvas(panel.el,{scale:1.4,backgroundColor:"#ffffff",useCORS:true,logging:false});
          if(cv && cv.width>40) dataUrl=cv.toDataURL("image/jpeg",0.84);
        }
      }catch(e){}
      if(!dataUrl) dataUrl=paintFormCopy(panel.text);
      if(!dataUrl || dataUrl.length<80) return j;
      var b64=dataUrl.split(",")[1]||"";
      if(!b64) return j;
      try{
        var up=await origFetch(UPLOAD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({formId:FORM_ID,filename:"form-result.jpg",contentType:"image/jpeg",data:b64})});
        var uj=await up.json().catch(function(){return {};});
        if(uj.url) j.files.push({name:"form-result.jpg",type:"image/jpeg",size:0,content:uj.url,label:"تصویر نتیجه ارزیابی"});
      }catch(e){}
      return j;
    }
    window.fetch=function(u,o){
      try{
        var s=String(typeof u==="string"?u:(u&&u.url)||"");
        var ours=s.indexOf("/api/html-form")>=0||s.indexOf("/api/hosted-pack")>=0||s.indexOf("/api/arka-forms")>=0;
        function revealTracking(resp){
          return resp.then? resp.then(function(r){ return readTracking(r); }) : readTracking(resp);
        }
        async function readTracking(resp){
          if(s.indexOf("html-form-file")>=0) return resp;
          try{
            var j=await resp.clone().json();
            var code=j && (j.tracking_code||j.ticketId);
            if(resp.ok && code && code!=="OK") showSuccess(code);
          }catch(e){}
          return resp;
        }
        if(ours && o && typeof FormData!=="undefined" && o.body instanceof FormData){
          return (async function(){
            var fd=o.body;
            var raw=fd.get("data");
            var data={};
            try{ data=typeof raw==="string"?JSON.parse(raw):(raw&&typeof raw==="object"?raw:{}); }catch(e){ data={}; }
            fd.forEach(function(val,key){
              if(key==="data"||key==="photos[]"||key==="photos"||key==="formId"||key==="honeypot"||key==="file") return;
              if(typeof val==="string" && val && data[key]==null) data[key]=val;
            });
            var files=[];
            var photos=[].concat(fd.getAll("photos[]")||[], fd.getAll("photos")||[]);
            for(var i=0;i<photos.length;i++){
              var f=photos[i];
              if(!f || !f.name) continue;
              var b64=await new Promise(function(res,rej){ var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||"").split(",")[1]||""); }; fr.onerror=rej; fr.readAsDataURL(f); });
              var up=await origFetch(UPLOAD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({formId:FORM_ID,filename:String(f.name).slice(-80),contentType:f.type||"image/jpeg",data:b64})});
              var j=await up.json().catch(function(){return {};});
              if(j.url) files.push({name:f.name,type:f.type||"image/jpeg",size:f.size||0,content:j.url,label:"عکس پیوست"});
            }
            var packed={formId:FORM_ID,data:data,files:files};
            packed=await attachSnapshot(packed);
            return revealTracking(origFetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(packed)}));
          })();
        }
        if(ours && o && typeof o.body==="string"){
          return (async function(){
            try{
              var j=JSON.parse(o.body);
              j.formId=j.formId||FORM_ID;
              if(!j.data || typeof j.data!=="object" || Array.isArray(j.data)){
                var wrapped={};
                Object.keys(j).forEach(function(k){
                  if(k==="formId"||k==="files"||k==="data") return;
                  wrapped[k]=j[k];
                });
                j.data=wrapped;
              }
              j=await attachSnapshot(j);
              return revealTracking(origFetch.call(this, u, Object.assign({}, o, {body:JSON.stringify(j)})));
            }catch(e){
              return origFetch.call(this, u, o);
            }
          }).call(this);
        }
      }catch(e){}
      return origFetch.apply(this, arguments);
    };
    var inFlight=false;
    var lastSentAt=0;
    var SNAP={};
    var FILE_SNAP=[];
    var DATA_URLS={};
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
    function rememberFile(file,label){
      if(!file || !(file.size>40)) return;
      var lab=String(label||"فایل پیوست").replace(/\\s+/g," ").trim();
      for(var i=0;i<FILE_SNAP.length;i++){
        var prev=FILE_SNAP[i].file;
        if(prev && prev.name===file.name && prev.size===file.size && prev.lastModified===file.lastModified) return;
      }
      FILE_SNAP.push({file:file,label:lab||"فایل پیوست"});
    }
    function stashDataUrl(k,s){
      if(!s || s.indexOf("data:image/")!==0 || s.length<80) return;
      DATA_URLS[k||("img_"+Object.keys(DATA_URLS).length)]=s;
    }
    function putInto(obj,k,v){
      if(!k || isNoiseKey(k)) return;
      try{
        if(typeof File!=="undefined" && v instanceof File){ rememberFile(v,k); return; }
        if(typeof Blob!=="undefined" && v instanceof Blob && !(v instanceof File) && v.size>80 && /^image\\//.test(v.type||"")){ rememberFile(v,k); return; }
      }catch(e){}
      var s=flatten(v).trim();
      if(!s || s==="{}" || s==="[]" || isNoiseVal(s)) return;
      if(s.indexOf("data:image/")===0){ stashDataUrl(k,s); return; }
      if(/^blob:/i.test(s) || /fakepath/i.test(s)) return;
      if(s.length>4000) s=s.slice(0,4000);
      obj[k]=s;
    }
    function mergeObj(obj, src){
      if(!src || typeof src!=="object" || Array.isArray(src)) return;
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
    function nearbyQuestion(el){
      if(!el) return "";
      var wrap=el.closest && el.closest("fieldset,section,.q,.question,.field,.form-group,.item,.card,[data-q],[data-question]");
      if(wrap){
        var h=wrap.querySelector("legend,h1,h2,h3,h4,.q-title,.question-title,.label,.ttl,[data-q-title]");
        if(h && h!==el && !(h.contains && h.contains(el))){
          var ht=(h.innerText||"").replace(/\\s+/g," ").trim();
          if(ht && ht.length<180) return ht.split("\\n")[0];
        }
      }
      var n=el.parentElement;
      for(var i=0;i<6 && n;i++){
        var prev=n.previousElementSibling;
        if(prev){
          var t=(prev.innerText||"").replace(/\\s+/g," ").trim().split("\\n")[0];
          if(t && t.length>=3 && t.length<160 && !NAV_RE.test(t) && !SUBMIT_RE.test(t)) return t;
        }
        n=n.parentElement;
      }
      return "";
    }
    function optionTextFor(el){
      if(!el) return "";
      if(el.tagName==="SELECT"){
        if(el.multiple) return Array.prototype.map.call(el.selectedOptions||[],function(o){return (o.text||o.value||"").trim()}).filter(Boolean).join("، ");
        var o=el.options && el.options[el.selectedIndex];
        return o ? (o.text||o.value||"") : (el.value||"");
      }
      if(el.type==="radio"||el.type==="checkbox"){
        var own=labelOf(el);
        if(own && own.length<80 && el.value && el.value!=="on" && own.indexOf(el.value)<0) return own;
        if(el.value && el.value!=="on") return el.value;
        return own || "بله";
      }
      return el.value||"";
    }
    function fieldKey(el,i){
      var key=el.getAttribute("data-k")||el.getAttribute("data-c")||el.getAttribute("name")||el.id||labelOf(el);
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
    document.addEventListener("change",function(e){
      var el=e.target;
      if(el && el.type==="file" && el.files){
        var q=nearbyQuestion(el)||labelOf(el)||el.getAttribute("name")||el.id||"فایل پیوست";
        for(var j=0;j<el.files.length && j<6;j++) rememberFile(el.files[j], q);
      }
      if(el) readEl(el,0);
    },true);
    document.addEventListener("drop",function(e){
      var dt=e.dataTransfer;
      if(!dt || !dt.files || !dt.files.length) return;
      for(var j=0;j<dt.files.length && j<6;j++) rememberFile(dt.files[j], "فایل پیوست");
    },true);
    try{
      var _readAsDataURL=FileReader.prototype.readAsDataURL;
      FileReader.prototype.readAsDataURL=function(blob){
        this.addEventListener("load",function(){
          try{
            var r=String(this.result||"");
            if(r.indexOf("data:image/")===0 && r.length>2000) stashDataUrl("reader_"+Date.now(), r);
          }catch(e){}
        });
        return _readAsDataURL.apply(this, arguments);
      };
    }catch(e){}
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
      return /(nm|ph|mobile|phone|whatsapp|fullName|fullname|نام|موبایل|email|شرکت|idea|industry|answers)/i.test(keys);
    }
    function takeFormObj(out,o){
      if(!looksLikeFormState(o)) return;
      var src=o.S && typeof o.S==="object" ? o.S : o;
      mergeObj(out,src);
      ["ans","answers","areas","suggested","ids"].forEach(function(k){
        if(src[k] && typeof src[k]==="object") out[k]=src[k];
      });
    }
    function fromStorage(){
      var out={};
      try{
        var prefer=["arka-feasibility-form-v1","arka-exs","arka-req","htmlform-"+FORM_ID,"form-"+FORM_ID,FORM_ID];
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
    function collectAnswers(){
      var rows=[];
      var byLabel={};
      function add(label,value,name){
        var lab=String(label||"").replace(/\\s+/g," ").trim();
        var val=flatten(value).trim();
        if(!lab || !val || isNoiseKey(lab) || isNoiseVal(val)) return;
        if(val==="{}" || val==="[]") return;
        if(lab.length>180) lab=lab.slice(0,180);
        if(val.length>4000) val=val.slice(0,4000);
        if(byLabel[lab]){
          if(byLabel[lab].value.indexOf(val)<0) byLabel[lab].value += "، "+val;
          return;
        }
        var row={label:lab,value:val,name:String(name||"").slice(0,80)};
        byLabel[lab]=row;
        rows.push(row);
      }
      var sum=fromSummary();
      Object.keys(sum).forEach(function(k){ add(k,sum[k],k); });
      document.querySelectorAll("input,textarea,select").forEach(function(el,i){
        if(!el || el.type==="file" || el.type==="button" || el.type==="submit" || el.type==="reset" || el.type==="hidden") return;
        if(el.id==="f-copytext") return;
        var name=fieldKey(el,i||0);
        var q=nearbyQuestion(el)||labelOf(el)||name;
        if(el.type==="radio"){
          if(el.checked) add(q, optionTextFor(el)||el.value, name);
          return;
        }
        if(el.type==="checkbox"){
          if(el.checked) add(q, optionTextFor(el), name);
          return;
        }
        if(el.tagName==="SELECT"){
          var sv=optionTextFor(el);
          if(sv) add(q, sv, name);
          return;
        }
        if(el.value) add(q, el.value, name);
      });
      document.querySelectorAll("[aria-pressed=true],[data-selected=true],.chip[aria-pressed=true]").forEach(function(el,i){
        add(nearbyQuestion(el)||el.getAttribute("data-key")||labelOf(el)||"گزینه", el.getAttribute("data-val")||(el.innerText||"").trim(), el.getAttribute("data-key")||("choice_"+(i+1)));
      });
      return rows;
    }
    function compressImageFile(file){
      return new Promise(function(resolve){
        if(!file || !file.type || file.type.indexOf("image/")!==0 || file.size<700000){ resolve(file); return; }
        var img=new Image();
        var url=URL.createObjectURL(file);
        img.onload=function(){
          var max=1600, w=img.width, h=img.height;
          if(w>max||h>max){ var s=Math.min(max/w,max/h); w=Math.round(w*s); h=Math.round(h*s); }
          var c=document.createElement("canvas");
          c.width=w; c.height=h;
          c.getContext("2d").drawImage(img,0,0,w,h);
          c.toBlob(function(b){
            URL.revokeObjectURL(url);
            resolve(b||file);
          },"image/jpeg",0.82);
        };
        img.onerror=function(){ URL.revokeObjectURL(url); resolve(file); };
        img.src=url;
      });
    }
    var imgBlobUrls=[];
    function collectFileInputs(){
      imgBlobUrls=[];
      document.querySelectorAll("input[type=file]").forEach(function(el,i){
        if(!el.files || !el.files.length) return;
        var q=nearbyQuestion(el)||labelOf(el)||el.getAttribute("name")||el.id||("فایل "+(i+1));
        for(var j=0;j<el.files.length && j<4;j++) rememberFile(el.files[j], q);
      });
      document.querySelectorAll("img").forEach(function(img,i){
        var src=img.currentSrc||img.src||"";
        var w=img.naturalWidth||img.width||0;
        if(w && w<60) return;
        if(src.indexOf("data:image/")===0 && src.length>2000) stashDataUrl("preview_"+i, src);
        if(/^blob:/i.test(src) && (!w || w>=40)){
          try{ imgBlobUrls.push({src:src,label:img.getAttribute("alt")||"عکس پیوست"}); }catch(e){}
        }
      });
      return FILE_SNAP.slice(0,8);
    }
    async function dataUrlToFile(dataUrl, name){
      var r=await fetch(dataUrl);
      var b=await r.blob();
      if(typeof File==="function") return new File([b], name||"photo.jpg", {type:b.type||"image/jpeg"});
      b.name=name||"photo.jpg";
      return b;
    }
    async function collectMediaFiles(){
      var list=collectFileInputs();
      var keys=Object.keys(DATA_URLS);
      for(var i=0;i<keys.length && FILE_SNAP.length<8;i++){
        try{
          var f=await dataUrlToFile(DATA_URLS[keys[i]], (keys[i]||"photo")+".jpg");
          rememberFile(f, keys[i]);
        }catch(e){}
      }
      for(var b=0;b<imgBlobUrls.length && FILE_SNAP.length<8;b++){
        try{
          var f=await dataUrlToFile(imgBlobUrls[b].src, "photo.jpg");
          rememberFile(f, imgBlobUrls[b].label||"عکس پیوست");
        }catch(e){}
      }
      var canvases=document.querySelectorAll("canvas");
      for(var c=0;c<canvases.length && FILE_SNAP.length<8;c++){
        var cv=canvases[c];
        if(!cv.width || cv.width<40 || !cv.height || cv.height<40) continue;
        try{
          var blob=await new Promise(function(res){ cv.toBlob(res, "image/jpeg", 0.82); });
          if(blob && blob.size>80) rememberFile(blob, "عکس فرم");
        }catch(e){}
      }
      return FILE_SNAP.slice(0,8);
    }
    function blobToBase64(blob){
      return new Promise(function(res,rej){
        var fr=new FileReader();
        fr.onload=function(){ var s=String(fr.result||""); res(s.indexOf(",")>=0?s.split(",")[1]:s); };
        fr.onerror=rej;
        fr.readAsDataURL(blob);
      });
    }
    async function uploadPublicFile(file){
      var blob=await compressImageFile(file);
      var name=String(file.name||"photo.jpg").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-80)||"photo.jpg";
      var type=blob.type||file.type||"application/octet-stream";
      var folder=type.indexOf("image/")===0?"images":"uploads";
      var path="tohid-dayhami-platform/"+folder+"/"+Date.now()+"-"+name;
      try{
        var r=await fetch("https://firebasestorage.googleapis.com/v0/b/calculator-55611.firebasestorage.app/o?uploadType=media&name="+encodeURIComponent(path),{
          method:"POST",
          headers:{"Content-Type":type},
          body:blob
        });
        if(r.ok){
          var j=await r.json();
          var token=j.downloadTokens||"";
          return {
            url:"https://firebasestorage.googleapis.com/v0/b/calculator-55611.firebasestorage.app/o/"+encodeURIComponent(path)+"?alt=media"+(token?"&token="+encodeURIComponent(token):""),
            name:name,
            type:type,
            size:blob.size||file.size||0
          };
        }
      }catch(e){}
      var b64=await blobToBase64(blob);
      var r2=await fetch(UPLOAD,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({formId:FORM_ID,filename:name,contentType:type,data:b64})
      });
      var j2=await r2.json().catch(function(){return {};});
      if(!r2.ok || !j2.url) throw new Error("upload_failed");
      return {url:j2.url,name:j2.name||name,type:j2.type||type,size:j2.size||blob.size||0};
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
      if((btn.id||"")==="b-submit" || (btn.id||"")==="c-send" || (btn.id||"")==="w-send") return null;
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
    function freshKey(){ return "td-html-fresh-"+FORM_ID; }
    function wipeFormMemory(){
      SNAP={};
      try{
        var keys=[];
        for(var i=0;i<localStorage.length;i++) keys.push(localStorage.key(i));
        keys.forEach(function(key){
          if(!key) return;
          if(key===FORM_ID || /^(arka-|htmlform|form-draft|td-form)/i.test(key) || /arka-/i.test(key)){
            try{ localStorage.removeItem(key); }catch(e){}
          }
        });
      }catch(e){}
      try{
        document.querySelectorAll("input,textarea").forEach(function(el){
          if(el.type==="checkbox"||el.type==="radio") el.checked=false;
          else if(el.type!=="hidden") el.value="";
        });
        document.querySelectorAll("select").forEach(function(el){ el.selectedIndex=0; });
      }catch(e){}
    }
    try{
      var _setItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){
        try{
          if(this===localStorage && sessionStorage.getItem(freshKey()) && (k===FORM_ID || /^(arka-|htmlform|form-draft|td-form)/i.test(String(k||"")) || /arka-/i.test(String(k||"")))) return;
        }catch(e){}
        return _setItem.apply(this, arguments);
      };
    }catch(e){}
    try{
      window.addEventListener("pagehide", function(){
        try{ if(sessionStorage.getItem(freshKey())) wipeFormMemory(); }catch(e){}
      });
    }catch(e){}
    try{
      if(sessionStorage.getItem(freshKey())){
        wipeFormMemory();
        window.addEventListener("load", function(){
          wipeFormMemory();
          setTimeout(function(){ try{ sessionStorage.removeItem(freshKey()); }catch(e){} }, 80);
        });
      }
    }catch(e){}
    function resetToStart(){
      wipeFormMemory();
      try{ sessionStorage.setItem(freshKey(),"1"); }catch(e){}
      try{
        var u=new URL(location.href);
        u.searchParams.set("_n", String(Date.now()));
        location.replace(u.toString());
      }catch(e){
        try{ location.reload(); }catch(e2){}
      }
    }
    function showSuccess(code){
      hideBusy();
      wipeFormMemory();
      try{ sessionStorage.setItem(freshKey(),"1"); }catch(e){}
      var c=String(code||"").trim();
      if(c==="OK") c="";
      if(c) window.__tdTrack=c;
      else c=String(window.__tdTrack||"");
      try{
        var old=document.getElementById("td-form-ok");
        if(old && old.getAttribute("data-code")===c) return;
        if(old) old.remove();
        var el=document.createElement("div");
        el.id="td-form-ok";
        el.setAttribute("role","dialog");
        el.setAttribute("data-code", c);
        el.style.cssText="position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.32);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);display:flex;align-items:flex-end;justify-content:center;padding:12px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Tahoma,sans-serif";
        var codeBlock=c?'<div style="margin:22px 0 4px;font-size:13px;color:#6e6e73">کد رهگیری</div><div id="td-track-code" dir="ltr" style="font-size:32px;font-weight:600;letter-spacing:.14em;color:#1d1d1f">'+c.replace(/[&<>]/g,"")+'</div><button type="button" id="td-copy-code" style="margin-top:16px;width:100%;background:#1d1d1f;color:#fff;border:0;border-radius:980px;padding:12px 18px;font:600 15px/1 -apple-system,Tahoma,sans-serif;cursor:pointer">کپی کد</button><a id="td-track-link" style="display:block;margin-top:12px;color:#0071e3;font-size:14px;text-decoration:none" target="_blank" rel="noopener">پیگیری با این کد</a>':'';
        el.innerHTML='<div style="background:#f5f5f7;color:#1d1d1f;border-radius:28px;padding:28px 22px 18px;max-width:400px;width:100%;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.18)"><div style="font-size:20px;font-weight:600;letter-spacing:-.02em">ثبت شد</div><div style="font-size:14px;color:#6e6e73;margin-top:6px;line-height:1.6">این کد را نگه دارید و برای پیگیری کارتان بدهید.</div>'+codeBlock+'<button type="button" id="td-form-ok-btn" style="margin-top:14px;background:transparent;color:#6e6e73;border:0;padding:8px;font:500 14px/1 -apple-system,Tahoma,sans-serif;cursor:pointer">فرم جدید</button></div>';
        document.body.appendChild(el);
        var copyBtn=document.getElementById("td-copy-code");
        if(copyBtn) copyBtn.onclick=function(ev){
          ev.preventDefault(); ev.stopPropagation();
          var text=(document.getElementById("td-track-code")||{}).textContent||c;
          var done=function(){ copyBtn.textContent="کپی شد"; };
          if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(done);
          else done();
        };
        var link=document.getElementById("td-track-link");
        if(link && c) link.href=location.origin+"/?page=tracking&code="+encodeURIComponent(c);
        var btn=document.getElementById("td-form-ok-btn");
        if(btn) btn.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); resetToStart(); };
      }catch(e){
        toast(c ? ("ثبت شد. کد رهگیری: "+c) : "فرم شما ثبت شد", true);
      }
    }
    async function submitToCrm(){
      if(inFlight) return false;
      var data=collect();
      var answers=collectAnswers();
      var fileInputs=await collectMediaFiles();
      try{
        var panel=document.querySelector("#sheet.on")||document.querySelector("#ceobody")||document.querySelector("dl.rev")||document.querySelector("#app");
        var copy=panel && (panel.innerText||"").replace(/[ \\t]+\\n/g,"\\n").replace(/\\n{3,}/g,"\\n\\n").trim();
        if(copy && copy.length>20 && !data.__formCopy) data.__formCopy=copy.slice(0,8000);
      }catch(e){}
      if(answers.length) data.__answers=answers;
      if(!Object.keys(data).length && !fileInputs.length){
        toast("لطفاً فرم را تکمیل کنید", false);
        return false;
      }
      if(alreadySent(data) && !fileInputs.length){
        showSuccess();
        return true;
      }
      inFlight=true;
      showBusy();
      var uploaded=[];
      if(fileInputs.length){
        try{
          var busyEl=document.querySelector("#td-form-busy div div:nth-child(2)");
          if(busyEl) busyEl.textContent="در حال ارسال عکس…";
          for(var fi=0; fi<fileInputs.length; fi++){
            var up=await uploadPublicFile(fileInputs[fi].file);
            uploaded.push({name:up.name,type:up.type,size:up.size,content:up.url,label:fileInputs[fi].label});
            answers.push({label:fileInputs[fi].label||"فایل پیوست",value:up.url,name:"file"});
          }
          data.__answers=answers;
        }catch(e){
          hideBusy();
          inFlight=false;
          toast("آپلود عکس ناموفق بود. دوباره تلاش کنید.", false);
          return false;
        }
      }
      if(alreadySent(data)){
        showSuccess();
        return true;
      }
      try{
        var r=await fetch(ENDPOINT,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({formId:FORM_ID,data:data,files:uploaded})
        });
        var code="";
        try{ var j=await r.clone().json(); code=j.tracking_code||j.ticketId||""; }catch(e){}
        hideBusy();
        if(!r.ok){ toast("خطا در ثبت در سامانه. دوباره تلاش کنید.", false); return false; }
        lastSentAt=Date.now();
        markSent(data);
        showSuccess(code);
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
      if(e.target && e.target.closest && e.target.closest("#c-send,#b-submit,#w-send")) return;
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
  let out = String(html || '');
  if (/<head[^>]*>/i.test(out)) out = out.replace(/<head[^>]*>/i, m => `${m}\n${boot}`);
  else if (/<html[^>]*>/i.test(out)) out = out.replace(/<html[^>]*>/i, m => `${m}\n<head>${boot}</head>`);
  else out = `${boot}\n${out}`;
  if (/<body[^>]*>/i.test(out)) return out.replace(/<body[^>]*>/i, m => `${m}\n${script}`);
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${script}\n</body>`);
  return `${script}\n${out}`;
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
  if (/^(idea|industry|stage|market|budget|company|city|score|level|message|msg|note|__formCopy|topic)$/i.test(String(key || ''))) return false;
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
  for (const [k, v] of Object.entries(data || {})) {
    if (v && typeof v === 'object') continue;
    if (/^(ans|answers|areas|score|level)$/i.test(k)) continue;
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

const SKIP_DATA_KEYS = /^(id|color|ts|v|L|lang|step|visitors|password|token|formId|formTitle|importSource|__answers|__photosJson)$/i;

function cleanFormData(raw) {
  const data = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (SKIP_DATA_KEYS.test(k)) continue;
    if (v && typeof v === 'object' && ['ans', 'answers', 'areas', 'suggested', 'ids', 'services'].includes(k)) {
      data[k] = v;
      continue;
    }
    if (typeof v === 'number' || typeof v === 'boolean') {
      data[k] = v;
      continue;
    }
    const s = flattenVal(v).trim();
    if (!s) continue;
    if (/^(__formCopy|idea|message|msg|note)$/i.test(k)) {
      data[k] = s.slice(0, 8000);
      continue;
    }
    if (isJunkText(s, k)) continue;
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
  service: 'خدمت قابل صدور',
  msg: 'توضیحات',
  message: 'توضیحات',
  note: 'توضیح',
};

const ARKA_MAPS = {
  field: {
    design: 'طراحی و گرافیک',
    dev: 'برنامه‌نویسی و فناوری',
    consult: 'مشاوره و کوچینگ',
    teach: 'آموزش و تدریس',
    translate: 'ترجمه و محتوا',
    marketing: 'دیجیتال مارکتینگ',
    eng: 'مهندسی و معماری',
    health: 'سلامت و درمان',
    tourism: 'گردشگری و خدمات سفر',
    company: 'شرکت خدماتی',
    other: 'سایر',
  },
  exp: {
    none: 'هنوز شروع نکرده‌ام',
    some: 'چند تجربه پراکنده داشته‌ام',
    active: 'فعال هستم و می‌خواهم بزرگ‌تر شوم',
  },
  markets: {
    gcc: 'کشورهای حاشیه خلیج فارس',
    iraq: 'عراق',
    turkey: 'ترکیه',
    europe: 'اروپا',
    na: 'آمریکای شمالی',
    cis: 'آسیای میانه و قفقاز',
    unknown: 'هنوز نمی‌دانم',
  },
  goal: {
    first: 'گرفتن اولین مشتری خارجی',
    fx: 'درآمد ارزی پایدار',
    team: 'صادرات خدمات شرکت / تیمم',
    move: 'آماده‌شدن برای کار بین‌المللی',
  },
  heard: {
    insta: 'اینستاگرام',
    friend: 'معرفی دوستان',
    site: 'وب‌سایت',
    wa: 'واتس‌اپ',
    other: 'سایر',
  },
};

const ARKA_GAPS = {
  skill: 'فروش خدمت به مشتری خارجی',
  rial: 'درآمد ارزی',
  price: 'قیمت‌گذاری بین‌المللی',
  find: 'پیدا کردن مشتری خارجی',
  pay: 'دریافت پول از خارج',
  contract: 'قرارداد و شرایط همکاری',
  brand: 'معرفی حرفه‌ای به مشتری خارجی',
};

const REPORT_META_KEYS = /^(formId|formTitle|importSource|requestId|customerName|customerPhone|whatsappNotified|__answers|__answersJson)$/i;
const RAW_CODE_KEYS = /^(ans|field|fieldOther|exp|markets|goal|heard|nm|ph|wa|svc|msg)$/i;

function maybeParseJson(v) {
  if (v && typeof v === 'object') return v;
  const s = flattenVal(v).trim();
  if (!s) return s;
  if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
    try { return JSON.parse(s); } catch { return s; }
  }
  return s;
}

function tokensOf(v) {
  const parsed = maybeParseJson(v);
  if (Array.isArray(parsed)) return parsed.map(x => String(x == null ? '' : x).trim()).filter(Boolean);
  if (parsed && typeof parsed === 'object') return Object.keys(parsed).filter(k => parsed[k]);
  return String(parsed || '').split(/[،,|/]+/).map(x => x.trim()).filter(Boolean);
}

function mapCodes(kind, v) {
  const dict = ARKA_MAPS[kind] || {};
  const out = [];
  const seen = new Set();
  for (const tok of tokensOf(v)) {
    const mapped = dict[tok] || dict[tok.toLowerCase()] || tok;
    if (!mapped || mapped === 'سایر') continue;
    if (seen.has(mapped)) continue;
    seen.add(mapped);
    out.push(mapped);
  }
  return out.join('، ');
}

function gapsFromAns(v) {
  const parsed = maybeParseJson(v);
  const flags = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? Object.entries(parsed).filter(([, val]) => val === true || val === 'true' || val === 1 || val === '1' || val === 'yes')
    : [];
  return flags.map(([k]) => ARKA_GAPS[k] || ARKA_GAPS[k.toLowerCase()] || k);
}

function assessmentText(ansVal, ready) {
  if (ready && /شکاف|مورد/.test(ready)) return ready;
  const gaps = gapsFromAns(ansVal);
  const total = Object.keys(ARKA_GAPS).length;
  if (!gaps.length && !ansVal) return ready || '';
  const pct = total ? Math.round((gaps.length / total) * 100) : 0;
  return `${pct}٪ شکاف · ${gaps.length} از ${total} مورد`;
}

function pickReady(data, keys) {
  for (const k of keys) {
    const s = flattenVal(data[k]).trim();
    if (s && !/^[{\[]/.test(s)) return s;
  }
  return '';
}

function looksRawCode(s) {
  return /^[a-z][a-z0-9_-]{0,24}$/i.test(String(s || '').trim());
}

function decodeToken(tok) {
  const t = String(tok || '').trim();
  if (!t) return '';
  for (const dict of Object.values(ARKA_MAPS)) {
    if (dict[t] || dict[t.toLowerCase()]) return dict[t] || dict[t.toLowerCase()];
  }
  if (ARKA_GAPS[t] || ARKA_GAPS[t.toLowerCase()]) return ARKA_GAPS[t] || ARKA_GAPS[t.toLowerCase()];
  return t;
}

function humanizeValue(key, value) {
  const raw0 = flattenVal(value).trim();
  if (/^https?:\/\//i.test(raw0) || /^data:image\//i.test(raw0)) return raw0;
  const k = String(key || '');
  if (k === 'ans' || /خودسنجی|شکاف/.test(k)) {
    const ready = assessmentText(value, '');
    if (ready) return ready;
  }
  if (ARKA_MAPS[k]) return mapCodes(k, value) || flattenVal(value).trim();
  const parsed = maybeParseJson(value);
  if (Array.isArray(parsed)) return parsed.map(decodeToken).filter(Boolean).join('، ');
  if (parsed && typeof parsed === 'object') {
    const flags = Object.entries(parsed)
      .filter(([, val]) => val === true || val === 'true' || val === 1 || val === '1' || val === 'yes')
      .map(([kk]) => decodeToken(kk));
    if (flags.length) return flags.join('، ');
  }
  const raw = flattenVal(value).trim();
  if (!raw) return '';
  if (looksRawCode(raw)) return decodeToken(raw);
  if (/^[a-z0-9_-]+(?:[،,|/ ]+[a-z0-9_-]+)+$/i.test(raw)) {
    return tokensOf(raw).map(decodeToken).join('، ');
  }
  return raw;
}

function niceLabel(label, name) {
  const lab = String(label || '').replace(/\s+/g, ' ').trim();
  if (FIELD_LABELS[lab]) return FIELD_LABELS[lab];
  if (FIELD_LABELS[name]) return /[\u0600-\u06FF]/.test(lab) && lab.length > 2 ? lab : FIELD_LABELS[name];
  if (/^field_\d+$/i.test(lab) && name) return FIELD_LABELS[name] || lab;
  return lab || FIELD_LABELS[name] || name || 'پاسخ';
}

function coerceAnswerRows(raw) {
  if (!raw) return [];
  let v = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return []; }
  }
  if (!Array.isArray(v)) return [];
  return v.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const label = String(item.label || item.name || item.key || '').trim();
    const value = item.value == null ? '' : item.value;
    const name = String(item.name || item.key || '').trim();
    if (!label) return null;
    return { label, value, name };
  }).filter(Boolean);
}

const FEAS_IND = { food: 'غذایی و کشاورزی', cosm: 'آرایشی و بهداشتی', craft: 'صنایع دستی و هنری', fashion: 'پوشاک و نساجی', manu: 'تولیدی و صنعتی', svc: 'خدماتی', online: 'فروشگاه آنلاین و فناوری', other: 'سایر' };
const FEAS_STAGE = { idea: 'فقط ایده دارم', proto: 'نمونه اولیه دارم', early: 'فروش محدود دارم', run: 'فعال هستم و می‌خواهم گسترش دهم' };
const FEAS_MKT = { ir: 'داخل ایران', gcc: 'عمان و کشورهای خلیج فارس', exp: 'سایر کشورها (صادرات)', tbd: 'هنوز مشخص نیست' };
const FEAS_HEARD = { ig: 'اینستاگرام', ref: 'معرفی دوستان', web: 'سایت', fair: 'نمایشگاه', other: 'سایر' };
const FEAS_YN = { 2: 'بله', 1: 'تا حدی', 0: 'هنوز نه' };
const FEAS_AREAS = { mkt: 'بازار و مشتری', prod: 'محصول و تأمین', brand: 'برند و بسته‌بندی', fin: 'مالی و قیمت‌گذاری', team: 'تیم و الزامات قانونی', sales: 'کانال فروش' };
const FEAS_QS = [
  ['q1', 'mkt', 'مشتری هدفتان را دقیق می‌شناسید؟ (چه کسی، کجا، با چه نیازی)'],
  ['q2', 'mkt', 'رقبای اصلی و قیمت‌هایشان را می‌شناسید؟'],
  ['q3', 'mkt', 'نشانه‌ای از تقاضا دارید؟ مثل پیش‌سفارش، فروش آزمایشی یا درخواست مشتری'],
  ['q4', 'prod', 'محصول یا خدمتتان دقیق تعریف شده و نمونه دارد؟'],
  ['q5', 'prod', 'تأمین مواد اولیه یا روش تولید و اجرا را حل کرده‌اید؟'],
  ['q6', 'brand', 'نام، لوگو و بسته‌بندی آماده عرضه دارید؟'],
  ['q7', 'fin', 'سرمایه لازم برای راه‌اندازی را در اختیار دارید؟'],
  ['q8', 'fin', 'قیمت تمام‌شده و قیمت فروش را حساب کرده‌اید؟'],
  ['q9', 'team', 'تیم یا نیروی اجرایی لازم را دارید؟'],
  ['q10', 'team', 'مجوزها، ثبت شرکت و الزامات قانونی کارتان را می‌شناسید؟'],
  ['q11', 'sales', 'می‌دانید از چه کانالی می‌فروشید؟ آنلاین، فروشگاه، عمده‌فروشی یا صادرات'],
];

function mapFeasCode(dict, v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (dict[s] || dict[s.toLowerCase()]) return dict[s] || dict[s.toLowerCase()];
  if (/[\u0600-\u06FF]/.test(s) || s.length > 12) return s;
  return s;
}

function expandFeasibilityRows(data) {
  const d = data || {};
  const ans = maybeParseJson(d.answers || d.ans);
  const hasQuiz = ans && typeof ans === 'object' && !Array.isArray(ans) && FEAS_QS.some(([id]) => ans[id] != null && ans[id] !== '');
  const hasIdea = !!(d.idea || d.ind || d.mkt || d.form === 'business-feasibility' || (d.score != null && d.score !== ''));
  if (!hasQuiz && !hasIdea) return [];
  const rows = [];
  const add = (label, value) => {
    const v = flattenVal(value).trim();
    if (!label || !v || v === '{}' || v === '[]') return;
    rows.push({ label, value: v.slice(0, 8000) });
  };
  add('ایده', d.idea);
  add('حوزه', d.industry || mapFeasCode(FEAS_IND, d.ind));
  add('مرحله', mapFeasCode(FEAS_STAGE, d.stage) || d.stage);
  add('بازار هدف', d.market || mapFeasCode(FEAS_MKT, d.mkt));
  add('بودجه', d.budget);
  if (hasQuiz) {
    FEAS_QS.forEach(([id, area, q]) => {
      const raw = ans[id];
      if (raw == null || raw === '') return;
      const mapped = FEAS_YN[raw] || FEAS_YN[String(raw)] || String(raw);
      add(`${q} (${FEAS_AREAS[area] || area})`, mapped);
    });
  }
  const areas = maybeParseJson(d.areas);
  if (areas && typeof areas === 'object' && !Array.isArray(areas)) {
    Object.keys(FEAS_AREAS).forEach((k) => {
      if (areas[k] == null || areas[k] === '') return;
      add(`امتیاز ${FEAS_AREAS[k]}`, `${areas[k]}٪`);
    });
  }
  const score = d.score != null && d.score !== '' ? d.score : '';
  const level = d.level || '';
  if (score !== '' || level) add('امتیاز امکان‌سنجی', [score !== '' ? `${score}٪` : '', level].filter(Boolean).join(' · '));
  const sug = Array.isArray(d.suggested) ? d.suggested.filter(Boolean).join('، ') : d.suggested;
  add('خدمات پیشنهادی', sug);
  add('نام', d.name);
  add('کسب‌وکار', d.company);
  add('موبایل', d.mobile);
  add('ایمیل', d.email);
  add('شهر / کشور', d.city);
  add('آشنایی از', d.heard || mapFeasCode(FEAS_HEARD, d.heard));
  return rows;
}

const FORM_KIND_LABEL = {
  'ceo-message': 'پیام به مدیرعامل',
  'arka-export-city': 'درخواست خدمات دفتر آرکا',
  'arka-office-request': 'درخواست دفتر آرکا',
  'business-feasibility': 'امکان‌سنجی کسب‌وکار',
};

const GENERIC_FIELD_LABEL = {
  name: 'نام',
  fullName: 'نام',
  mobile: 'موبایل',
  phone: 'موبایل',
  email: 'ایمیل',
  company: 'شرکت / برند',
  city: 'شهر / کشور',
  topic: 'موضوع',
  message: 'پیام',
  msg: 'پیام',
  note: 'توضیح بیشتر',
  idea: 'ایده',
  industry: 'محصول یا حوزه کاری‌تان چیست؟',
  stage: 'کسب‌وکارتان در چه مرحله‌ای است؟',
  market: 'بازار هدفتان کجاست؟',
  budget: 'بودجه',
  timing: 'چه زمانی می‌خواهید شروع کنید؟',
  contact_by: 'چطور با شما در تماس باشیم؟',
  goal: 'هدف مراجعه (ارزیابی اولیه)',
  services: 'کدام خدمات را لازم دارید؟',
  form: 'نوع درخواست',
  heard: 'آشنایی از',
  not_sure: 'مطمئن نیستم؛ راهنمایی‌ام کنید',
};

const GOAL_GUIDE = {
  start: { title: 'می‌خواهم کسب‌وکار راه بیندازم', rec: 'مشاوره کسب‌وکار، ثبت شرکت، طراحی بسته‌بندی' },
  brand: { title: 'برند و بسته‌بندی می‌خواهم', rec: 'طراحی بسته‌بندی، فروشگاه متا' },
  export: { title: 'می‌خواهم صادرات کنم', rec: 'مدیریت صادرات، فروشگاه متا، تورهای تجاری' },
  source: { title: 'دنبال تأمین کالا هستم', rec: 'تأمین کالا، فروش کالا' },
  grow: { title: 'فروشم رشد نمی‌کند', rec: 'مشاوره کسب‌وکار، راهکار جامع، مدیریت صادرات' },
  learn: { title: 'می‌خواهم یاد بگیرم', rec: 'آکادمی آموزش، محصولات دانشی' },
};

function prettyFormValue(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'بله' : 'خیر';
  if (Array.isArray(v)) {
    return v.map((item) => {
      if (item && typeof item === 'object') return item.title || item.label || item.name || item.code || '';
      return String(item || '');
    }).filter(Boolean).join('، ');
  }
  if (typeof v === 'object') return '';
  return String(v).trim();
}

function genericFormRows(data) {
  const d = data || {};
  const skip = /^(formId|files|honeypot|agree|ids|password|token|lang|__formCopy|__answers|__photosJson)$/i;
  const rows = [];
  const seen = new Set();
  const add = (label, value) => {
    const v = prettyFormValue(value);
    if (!label || !v || v === '{}' || v === '[]') return;
    if (seen.has(label)) return;
    seen.add(label);
    rows.push({ label, value: v.slice(0, 8000) });
  };
  if (d.form) add('نوع درخواست', FORM_KIND_LABEL[d.form] || d.form);
  if (d.goal) {
    const g = GOAL_GUIDE[d.goal] || GOAL_GUIDE[String(d.goal).toLowerCase()];
    add('هدف مراجعه (ارزیابی اولیه)', g ? g.title : d.goal);
    if (g) add('نتیجه ارزیابی / مسیر پیشنهادی به مشتری', g.rec);
  }
  const order = ['services', 'not_sure', 'stage', 'industry', 'market', 'timing', 'contact_by', 'name', 'fullName', 'mobile', 'phone', 'email', 'company', 'city', 'topic', 'message', 'msg', 'note', 'idea', 'budget', 'heard'];
  order.forEach((k) => { if (d[k] != null && d[k] !== '') add(GENERIC_FIELD_LABEL[k] || k, d[k]); });
  Object.entries(d).forEach(([k, v]) => {
    if (skip.test(k) || order.includes(k) || k === 'form' || k === 'goal' || k === 'ans' || k === 'answers' || k === 'areas' || k === 'suggested') return;
    if (v && typeof v === 'object' && !Array.isArray(v)) return;
    add(GENERIC_FIELD_LABEL[k] || k, v);
  });
  if (d.__formCopy && String(d.__formCopy).trim().length > 40) {
    add('رونوشت صفحه فرم', String(d.__formCopy).trim().slice(0, 8000));
  }
  return rows;
}

function flattenIncomingPayload(payload) {
  let raw = {};
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    raw = { ...payload.data };
  } else if (typeof payload.data === 'string') {
    try {
      const parsed = JSON.parse(payload.data);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed;
    } catch { /* ignore */ }
  }
  for (const [k, v] of Object.entries(payload || {})) {
    if (['formId', 'files', 'data'].includes(k) || v === undefined) continue;
    if (raw[k] === undefined) raw[k] = v;
  }
  return raw;
}

function reportRows(data, incomingAnswers) {
  const rows = [];
  const used = new Set();
  const add = (label, value) => {
    const v = flattenVal(value).trim();
    if (!v || v === '{}' || v === '[]') return;
    const lab = String(label || '').replace(/\s+/g, ' ').trim();
    if (!lab || REPORT_META_KEYS.test(lab) || SKIP_DATA_KEYS.test(lab)) return;
    const sig = `${lab}:${v.replace(/\s+/g, ' ')}`;
    if (used.has(sig)) return;
    used.add(sig);
    rows.push({ label: lab.slice(0, 200), value: v.slice(0, 8000) });
  };

  const payloadRows = coerceAnswerRows(incomingAnswers);
  if (payloadRows.length) {
    payloadRows.forEach((row) => {
      add(niceLabel(row.label, row.name), humanizeValue(row.name || row.label, row.value));
    });
  }

  const knownArka = [
    ['نام', pickReady(data, ['نام و نام خانوادگی', 'نام کامل', 'نام', 'fullName', 'full_name', 'name', 'nm'])],
    ['موبایل', pickReady(data, ['موبایل / واتس‌اپ', 'موبایل', 'شماره تماس', 'تلفن', 'phone', 'mobile', 'ph', 'whatsapp'])],
    ['ایمیل', pickReady(data, ['ایمیل', 'email'])],
    ['شهر', pickReady(data, ['شهر / کشور', 'شهر', 'city'])],
  ];
  if (!payloadRows.length) {
    knownArka.forEach(([lab, val]) => add(lab, val));
    const fieldOther = pickReady(data, ['fieldOther', 'حوزه شما']);
    let field = pickReady(data, ['حوزه کاری']) || mapCodes('field', data.field);
    if ((!field || field === 'سایر' || data.field === 'other') && fieldOther) field = fieldOther;
    else if (fieldOther && field && !field.includes(fieldOther)) field = `${field}، ${fieldOther}`;
    add('نتیجه خودسنجی', assessmentText(data.ans, pickReady(data, ['نتیجه خودسنجی'])));
    const gaps = gapsFromAns(data.ans);
    if (gaps.length) add('موارد نیازمند آموزش', gaps.join('، '));
    add('حوزه کاری', field);
    add('خدمت قابل صدور', pickReady(data, ['خدمت قابل صدور', 'service']));
    add('تجربه صادرات', pickReady(data, ['تجربه', 'تجربه صادرات']) || mapCodes('exp', data.exp));
    add('هدف', pickReady(data, ['هدف']) || mapCodes('goal', data.goal));
    add('بازارهای هدف', pickReady(data, ['بازارهای هدف']) || mapCodes('markets', data.markets));
    add('آشنایی از', pickReady(data, ['آشنایی از']) || mapCodes('heard', data.heard));
    add('توضیح', pickReady(data, ['توضیح', 'توضیحات', 'یادداشت', 'note', 'message', 'msg']));
  }

  for (const [k, raw] of Object.entries(data || {})) {
    if (REPORT_META_KEYS.test(k) || SKIP_DATA_KEYS.test(k)) continue;
    if (/^(ans|answers|areas|suggested|ids|ind|mkt|agree|form|score|level|__formCopy|honeypot|goal|services|not_sure)$/i.test(k)) continue;
    if (!payloadRows.length && RAW_CODE_KEYS.test(k)) continue;
    const v = humanizeValue(k, raw);
    if (!v || v.startsWith('{') || v.startsWith('[')) continue;
    if (payloadRows.length && looksRawCode(k) && looksRawCode(String(raw))) continue;
    if (/fakepath/i.test(v) || /^[A-Za-z]:\\/.test(v)) continue;
    const label = niceLabel(k, k);
    if (rows.some(r => r.label === label || r.value === v)) continue;
    add(label, v);
  }
  return rows;
}

function clientTrackingCode(data) {
  const keys = ['کد پیگیری', 'trackingCode', 'tracking_code'];
  for (const k of keys) {
    const v = String(data?.[k] || '').trim();
    if (/^[A-Za-z0-9][A-Za-z0-9-]{3,28}$/.test(v)) return v.toUpperCase();
  }
  return '';
}

function makePublicCode(prefix) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = `${prefix}-`;
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

async function allocTrackingCode(form, data) {
  const prefix = form?.kind === 'pack' ? 'ARK' : 'FRM';
  const candidates = [];
  const given = clientTrackingCode(data);
  if (given) candidates.push(given);
  for (let i = 0; i < 5; i++) candidates.push(makePublicCode(prefix));
  for (const id of candidates) {
    try {
      const existing = await getDoc('tickets', id);
      if (!existing) return id;
    } catch {
      return id;
    }
  }
  return `${makePublicCode(prefix)}${Date.now().toString().slice(-4)}`;
}

function buildFormDescription(formTitle, ticketId, name, phone, rows) {
  const lines = [
    `فرم: ${formTitle}`,
    `شناسه درخواست: ${ticketId}`,
    '',
  ];
  if (name && name !== 'بدون نام') lines.push(`نام: ${name}`);
  if (phone) lines.push(`موبایل: ${phone}`);
  if (rows.length) {
    lines.push('', 'سوالات و پاسخ‌ها');
    rows.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.label}: ${r.value}`);
    });
  }
  return lines.join('\n').trim();
}

function safeStorageName(name) {
  const cleaned = String(name || 'photo.jpg')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);
  return cleaned || 'photo.jpg';
}

async function uploadBufferToStorage(buf, contentType, filename) {
  if (!buf || !buf.length || buf.length > 8 * 1024 * 1024) return '';
  const type = contentType || 'image/jpeg';
  const folder = type.startsWith('image/') ? 'images' : 'uploads';
  const path = `tohid-dayhami-platform/${folder}/${Date.now()}-${safeStorageName(filename)}`;
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`;
  const up = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': type }, body: buf });
  const json = await up.json().catch(() => ({}));
  if (!up.ok) return '';
  const token = json.downloadTokens || '';
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media${token ? `&token=${encodeURIComponent(token)}` : ''}`;
}

async function uploadDataUrlString(dataUrl, filename) {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!m || m[2].length < 80) return '';
  try {
    const buf = Buffer.from(m[2], 'base64');
    return await uploadBufferToStorage(buf, m[1], filename || 'photo.jpg');
  } catch {
    return '';
  }
}

async function liftDataUrls(node, filesOut, depth) {
  if (!node || typeof node !== 'object' || (depth || 0) > 6) return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const v = node[i];
      if (typeof v === 'string' && v.startsWith('data:image/')) {
        const url = await uploadDataUrlString(v, `photo-${i}.jpg`);
        if (url) {
          node[i] = url;
          filesOut.push({ name: `photo-${i}.jpg`, type: 'image/jpeg', size: 0, content: url, label: 'عکس پیوست', status: 'success' });
        }
      } else if (v && typeof v === 'object') {
        if (typeof v.value === 'string' && v.value.startsWith('data:image/')) {
          const url = await uploadDataUrlString(v.value, 'photo.jpg');
          if (url) {
            v.value = url;
            filesOut.push({ name: 'photo.jpg', type: 'image/jpeg', size: 0, content: url, label: String(v.label || 'عکس پیوست'), status: 'success' });
          }
        }
        await liftDataUrls(v, filesOut, (depth || 0) + 1);
      }
    }
    return;
  }
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (typeof v === 'string' && v.startsWith('data:image/') && v.length > 80) {
      const url = await uploadDataUrlString(v, `${k}.jpg`);
      if (url) {
        node[k] = url;
        filesOut.push({ name: `${k}.jpg`, type: 'image/jpeg', size: 0, content: url, label: k, status: 'success' });
      }
    } else if (v && typeof v === 'object') {
      await liftDataUrls(v, filesOut, (depth || 0) + 1);
    }
  }
}

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
      if (form && form.kind === 'pack' && form.isPublic !== false) {
        const slug = formPublicSlug(form);
        res.setHeader('Location', `${origin}/p/${encodeURIComponent(slug)}/`);
        return res.status(302).end();
      }
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
      const raw = flattenIncomingPayload(payload);
      if (raw.honeypot || payload.honeypot) {
        return res.status(200).json({ ok: true, ticketId: 'OK', tracking_code: 'OK' });
      }
      if (!formId) return res.status(400).json({ error: 'formId required' });

      const form = await getDoc('custom_forms', formId);
      if (!form || (form.kind !== 'html' && form.kind !== 'pack') || form.isPublic === false) {
        return res.status(404).json({ error: 'form_not_found' });
      }
      if (form.isClosed) return res.status(403).json({ error: 'form_closed' });

      const incomingAnswers = raw.__answers;
      const liftedFiles = [];
      try { await liftDataUrls(raw, liftedFiles, 0); } catch { /* keep going */ }
      const incomingFiles = (Array.isArray(payload.files) ? payload.files : [])
        .map((f) => ({
          name: String(f?.name || 'file').slice(0, 120),
          type: String(f?.type || ''),
          size: Number(f?.size) || 0,
          content: String(f?.content || f?.url || ''),
          label: String(f?.label || '').slice(0, 160),
          status: 'success',
        }))
        .filter((f) => /^https?:\/\//i.test(f.content))
        .concat(liftedFiles)
        .filter((f, i, arr) => arr.findIndex(x => x.content === f.content) === i)
        .slice(0, 12);
      const data = cleanFormData(raw);

      const phone = extractPhone(data);
      const name = extractName(data, phone) || 'بدون نام';
      const email = pick(data, ['email', 'ایمیل']);
      const company = pick(data, ['company', 'companyName', 'شرکت', 'شرکت / برند']);
      const city = pick(data, ['city', 'location', 'country', 'شهر', 'شهر / کشور']) || '-';
      const phoneNorm = digits(phone);

      const now = new Date().toISOString();
      const ticketId = await allocTrackingCode(form, data);

      const formTitle = displayFormTitle(form) || form.title || form.titleEn || 'فرم آنلاین';
      const merged = { ...raw, ...data };
      const feasRows = expandFeasibilityRows(merged);
      const genRows = genericFormRows(merged);
      const incoming = coerceAnswerRows(incomingAnswers);
      const seed = feasRows.length >= 3
        ? [...feasRows, ...genRows.filter((g) => !feasRows.some((f) => f.label === g.label))]
        : (genRows.length >= 2 ? genRows : (incoming.length ? incoming : genRows));
      const answers = reportRows(data, seed);
      if (raw.form && FORM_KIND_LABEL[raw.form] && !answers.some((a) => a.label === 'نوع درخواست')) {
        answers.unshift({ label: 'نوع درخواست', value: FORM_KIND_LABEL[raw.form] });
      }
      if (!answers.length && genRows.length) answers.push(...genRows);
      const copyText = String(data.__formCopy || raw.__formCopy || '').trim();
      if (copyText.length > 40 && !answers.some((a) => a.label === 'رونوشت صفحه فرم')) {
        answers.push({ label: 'رونوشت صفحه فرم', value: copyText.slice(0, 8000) });
      }
      for (const f of incomingFiles) {
        if (!answers.some((a) => a.value === f.content)) {
          answers.push({ label: f.label || f.name || 'فایل پیوست', value: f.content });
        }
      }
      const description = buildFormDescription(formTitle, ticketId, name, phone, answers);

      const customData = {
        formId,
        formTitle,
        importSource: 'html_form',
        requestId: ticketId,
        trackingCode: ticketId,
        customerName: name,
        customerPhone: phone || '',
        __answersJson: JSON.stringify(answers.slice(0, 80)),
        __photosJson: JSON.stringify(incomingFiles.map(f => ({ label: f.label || f.name, value: f.content }))),
      };
      for (const row of answers) {
        const sk = safeFieldKey(row.label);
        if (sk === 'formTitle' || sk === 'formId' || sk === 'importSource' || sk === '__answersJson' || sk === '__photosJson') continue;
        customData[sk] = row.value;
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
        files: incomingFiles.length
          ? incomingFiles.map(({ name, type, size, content, status }) => ({ name, type, size, content, status }))
          : undefined,
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

      return res.status(200).json({ ok: true, ticketId, tracking_code: ticketId });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
