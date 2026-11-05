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

function originFromReq(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.tohiddayhami.com';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function closedPage(title, message) {
  return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title>
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

function injectBridge(html, formId, origin) {
  const endpoint = `${origin}/api/html-form`;
  const script = `<script>(function(){
    var FORM_ID=${JSON.stringify(formId)};
    var ENDPOINT=${JSON.stringify(endpoint)};
    var inFlight=false;
    var lastSentAt=0;
    var SNAP={};
    var SUBMIT_RE=/ثبت\\s*نهایی|ثبت\\s*فرم|ثبت\\s*درخواست|ارسال\\s*نهایی|ارسال\\s*فرم|ارسال\\s*درخواست|ارسال در واتس|send on whatsapp|\\bsubmit\\b|\\bsend\\b|confirm\\s*and\\s*send/i;
    var NAV_RE=/^(ادامه|بعدی|قبلی|بازگشت|ویرایش|لغو|انصراف|next|continue|back|prev|previous|edit|cancel)$/i;
    function flatten(v){
      if(v==null) return "";
      if(Array.isArray(v)) return v.filter(Boolean).join(", ");
      if(typeof v==="object") try{return JSON.stringify(v)}catch(e){return String(v)}
      return String(v);
    }
    function putInto(obj,k,v){
      if(!k) return;
      var s=flatten(v).trim();
      if(!s || s==="{}" || s==="[]") return;
      if(obj[k] && obj[k]!==s) obj[k]=obj[k]+", "+s;
      else obj[k]=s;
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
    function fromStorage(){
      var out={};
      try{
        for(var i=0;i<localStorage.length;i++){
          var key=localStorage.key(i);
          var raw=localStorage.getItem(key);
          if(!raw || raw[0]!=="{" && raw[0]!=="[") continue;
          var o=JSON.parse(raw);
          if(o && o.S && typeof o.S==="object") mergeObj(out,o.S);
          else if(o && typeof o==="object" && !Array.isArray(o)) mergeObj(out,o);
        }
      }catch(e){}
      return out;
    }
    function fromSummary(){
      var out={};
      document.querySelectorAll("dl.sum div, .sum div").forEach(function(row){
        var dt=row.querySelector("dt");
        var dd=row.querySelector("dd");
        if(dt && dd) putInto(out,(dt.innerText||"").trim(), (dd.innerText||"").trim());
      });
      return out;
    }
    function collect(){
      var data={};
      mergeObj(data, SNAP);
      mergeObj(data, fromStorage());
      mergeObj(data, fromSummary());
      try{ mergeObj(data, window.S); }catch(e){}
      try{ mergeObj(data, window.formData); }catch(e){}
      try{ mergeObj(data, window.state); }catch(e){}
      document.querySelectorAll("input,textarea,select").forEach(function(el,i){ readEl(el,i); });
      mergeObj(data, SNAP);
      document.querySelectorAll("[aria-pressed=true],[data-selected=true],.chip[aria-pressed=true]").forEach(function(el,i){
        putInto(data, el.getAttribute("data-key")||labelOf(el)||"choice_"+(i+1), el.getAttribute("data-val")||(el.innerText||"").trim());
      });
      return data;
    }
    function btnText(el){
      return ((el.innerText||el.value||el.getAttribute("aria-label")||"")+" ").replace(/\\s+/g," ").trim();
    }
    function isSubmitEl(el){
      if(!el || !el.closest) return null;
      var btn=el.closest("button,input[type=submit],input[type=button],a[href], [type=submit], [role=button]");
      if(!btn) return null;
      var t=btnText(btn);
      if(NAV_RE.test(t)) return null;
      var href=btn.getAttribute("href")||"";
      if(btn.id==="b-wa" || /wa\\.me|whatsapp/i.test(href)) return btn;
      if((btn.getAttribute("type")||"").toLowerCase()==="submit") return btn;
      if(SUBMIT_RE.test(t)) return btn;
      if(/submit/i.test(btn.id||"") || /\\bsubmit\\b/i.test(btn.className||"")) return btn;
      return null;
    }
    function toast(msg, ok){
      try{
        var n=document.createElement("div");
        n.setAttribute("role","status");
        n.style.cssText="position:fixed;bottom:16px;inset-inline:16px;z-index:99999;background:"+(ok?"#065f46":"#7f1d1d")+";color:#fff;padding:12px 16px;border-radius:10px;font:600 13px Tahoma,sans-serif;text-align:center";
        n.textContent=msg;
        document.body.appendChild(n);
        setTimeout(function(){ n.remove(); },4500);
      }catch(e){}
    }
    async function submitToCrm(){
      if(inFlight) return false;
      if(Date.now()-lastSentAt<2500) return true;
      var data=collect();
      if(!Object.keys(data).length){
        toast("لطفاً فرم را تکمیل کنید", false);
        return false;
      }
      inFlight=true;
      try{
        var r=await fetch(ENDPOINT,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({formId:FORM_ID,data:data})
        });
        if(!r.ok){ toast("خطا در ثبت در سامانه. دوباره تلاش کنید.", false); return false; }
        lastSentAt=Date.now();
        toast("در کارتابل ثبت شد", true);
        return true;
      }catch(e){
        toast("خطا در اتصال. دوباره تلاش کنید.", false);
        return false;
      }finally{
        inFlight=false;
      }
    }
    document.addEventListener("click",function(e){
      var btn=isSubmitEl(e.target);
      if(!btn) return;
      var href=btn.tagName==="A" ? (btn.getAttribute("href")||"") : "";
      e.preventDefault();
      e.stopPropagation();
      submitToCrm().then(function(ok){
        if(!ok) return;
        if(href && href!=="#" && !/^javascript:/i.test(href)) window.open(href,"_blank","noopener");
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

function pick(data, keys) {
  for (const k of keys) {
    if (data[k] != null && String(flattenVal(data[k])).trim()) return flattenVal(data[k]).trim();
  }
  const lowerKeys = keys.map(k => String(k).toLowerCase());
  for (const [dk, dv] of Object.entries(data || {})) {
    const dl = String(dk).toLowerCase();
    if (lowerKeys.some(k => dl === k || dl.includes(k) || k.includes(dl))) {
      const s = flattenVal(dv).trim();
      if (s) return s;
    }
  }
  return '';
}

function digits(s) {
  return String(s || '').replace(/\D/g, '');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const origin = originFromReq(req);

  try {
    if (req.method === 'GET') {
      const id = String(req.query.id || req.query.formId || '').trim();
      if (!id) return res.status(400).send('form id required');
      const form = await getDoc('custom_forms', id);
      if (!form || form.kind !== 'html' || form.isPublic === false) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(closedPage('فرم یافت نشد', 'این فرم در دسترس نیست.'));
      }
      if (form.isClosed) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(closedPage(
          form.title || 'فرم',
          form.closedMessage || 'مهلت تکمیل این فرم به پایان رسیده است.',
        ));
      }
      const body = await getDoc('html_form_bodies', id);
      if (!body?.html) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(closedPage('فرم ناقص است', 'فایل HTML این فرم ذخیره نشده.'));
      }
      const html = injectBridge(String(body.html), id, origin);
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

      const data = {};
      for (const [k, v] of Object.entries(raw)) {
        const s = flattenVal(v).trim();
        if (s) data[k] = s.slice(0, 4000);
      }

      const name = pick(data, [
        'name', 'fullName', 'full_name', 'customerName', 'نام', 'نام و نام خانوادگی', 'نام کامل',
      ]) || 'بدون نام';
      const phone = pick(data, [
        'mobile', 'phone', 'whatsapp', 'tel', 'phoneNumber', 'موبایل', 'تلفن', 'شماره تماس',
        'موبایل / واتس‌اپ (با کد کشور)', 'واتس‌اپ',
      ]);
      const email = pick(data, ['email', 'ایمیل']);
      const company = pick(data, ['company', 'companyName', 'brand', 'شرکت', 'شرکت / برند']);
      const city = pick(data, ['city', 'location', 'country', 'شهر', 'شهر / کشور']) || '-';
      const phoneNorm = digits(phone);

      const now = new Date().toISOString();
      const ticketId = `HTML-${Date.now().toString().slice(-8)}-${formId.slice(0, 6).toUpperCase()}`;

      const descLines = Object.entries(data)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`);
      const description = `[فرم HTML: ${form.title || ''}]\n${descLines.join('\n')}`;

      const customData = {
        ...data,
        formId,
        formTitle: form.title || '',
        importSource: 'html_form',
      };
      if (form.assigneePersonnelId) customData.__assigneePersonnelId = form.assigneePersonnelId;
      if (form.assigneeRole) customData.__assigneeRole = form.assigneeRole;

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
        timeline: [{
          type: 'creation',
          title: 'ثبت از فرم HTML',
          description: `فرم "${form.title || ''}" توسط ${name} پر شد`,
          actorName: 'سیستم',
          timestamp: now,
          visibility: 'public',
        }],
        customData,
      };

      await setDoc('tickets', ticketId, ticket);

      if (phoneNorm.length >= 6) {
        let existing = await queryByField('customers', 'phoneNumber', phone);
        if (!existing && phone !== phoneNorm) {
          existing = await queryByField('customers', 'phoneNumber', phoneNorm);
        }
        if (existing) {
          await setDoc('customers', existing.id, {
            ...existing,
            fullName: name !== 'بدون نام' ? name : existing.fullName,
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
            phoneNumber: phone,
            whatsappNumber: phone,
            email: email || undefined,
            firstContact: now,
            totalTickets: 1,
            source: `HTML Form: ${form.title || ''}`,
            loyaltyCode: `VIP-${suffix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          });
        }
      }

      return res.status(200).json({ ok: true, ticketId });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
