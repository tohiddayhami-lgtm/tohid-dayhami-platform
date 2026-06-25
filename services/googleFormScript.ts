import { CustomForm, FormField, ServiceOption } from '../types';
import { firebaseConfig } from './firebaseService';

/**
 * Generates self-contained Google Apps Scripts that:
 *   1. Create a Google Form mirroring a platform form.
 *   2. Install an onFormSubmit trigger automatically.
 *   3. On every submission, write a Ticket directly to Firestore (the same project
 *      the platform reads from) so the response lands in the cartable / archive.
 *
 * No OAuth / service account / Cloud API needed — the admin pastes the code into
 * script.google.com, runs the setup function once, authorizes, and shares the
 * generated form link. Because the script runs on Google's servers, it works
 * even from Iran (where firestore.googleapis.com is blocked for the browser).
 *
 * Two builders:
 *   - buildGoogleFormScript(form)              → a custom "Forms & Standards" form
 *   - buildServiceRequestGoogleScript(services, formFields)
 *                                              → the main Service Request form, with a
 *        service-selection question. The ticket is written with the REAL serviceId and
 *        NO assignedTo, so the platform's existing auto-routing (App.tsx) assigns it to
 *        the right person EXACTLY like a native service request (service.routePosition /
 *        routeDepartmentId → least-loaded eligible staff).
 */

const PROJECT_ID = JSON.stringify(firebaseConfig.projectId);
const API_KEY = JSON.stringify(firebaseConfig.apiKey);

/**
 * Apps Script helpers shared by both generated scripts. Plain ES5-ish JS injected
 * as a string. References PROJECT_ID / API_KEY which each script declares at top.
 */
const SHARED_HELPERS = `
function addFieldToForm(form, f) {
  try {
    switch (f.type) {
      case 'header':
        form.addSectionHeaderItem().setTitle(f.label);
        return;
      case 'textarea':
        form.addParagraphTextItem().setTitle(f.label).setRequired(f.required);
        return;
      case 'select':
        var li = form.addListItem().setTitle(f.label).setRequired(f.required);
        if (f.options && f.options.length) li.setChoiceValues(f.options);
        return;
      case 'checkbox':
        var ci = form.addCheckboxItem().setTitle(f.label).setRequired(f.required);
        if (f.options && f.options.length) ci.setChoiceValues(f.options);
        else ci.setChoiceValues(['بله']);
        return;
      case 'date':
        form.addDateItem().setTitle(f.label).setRequired(f.required);
        return;
      case 'email':
        var et = form.addTextItem().setTitle(f.label).setRequired(f.required);
        et.setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
        return;
      case 'number':
        var nt = form.addTextItem().setTitle(f.label).setRequired(f.required);
        nt.setValidation(FormApp.createTextValidation().requireNumber().build());
        return;
      case 'file':
        // آپلود فایل در گوگل‌فرم محدودیت دسترسی دارد؛ از کاربر «لینک فایل» می‌خواهیم.
        form.addParagraphTextItem().setTitle(f.label + ' (لینک فایل)').setRequired(f.required);
        return;
      default: // text, tel و سایر موارد
        form.addTextItem().setTitle(f.label).setRequired(f.required);
    }
  } catch (err) {
    try { form.addTextItem().setTitle(f.label).setRequired(false); } catch (e2) {}
  }
}

function writeTicketToFirestore(docId, data) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID +
            '/databases/(default)/documents/tickets?documentId=' +
            encodeURIComponent(docId) + '&key=' + API_KEY;
  var payload = JSON.stringify({ fields: toFsFields(data) });
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code >= 200 && code < 300) {
    Logger.log('✅ تیکت در سامانه ثبت شد: ' + docId);
  } else {
    Logger.log('❌ خطای Firestore (' + code + '): ' + res.getContentText());
  }
}

// ── تبدیل آبجکت جاوااسکریپت به فرمت سند Firestore ──────────────────────────
function toFsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return (v % 1 === 0) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Object.prototype.toString.call(v) === '[object Array]') {
    var arr = [];
    for (var i = 0; i < v.length; i++) arr.push(toFsValue(v[i]));
    return { arrayValue: { values: arr } };
  }
  if (typeof v === 'object') return { mapValue: { fields: toFsFields(v) } };
  return { stringValue: String(v) };
}
function toFsFields(obj) {
  var fields = {};
  for (var k in obj) {
    if (obj.hasOwnProperty(k) && obj[k] !== undefined) fields[k] = toFsValue(obj[k]);
  }
  return fields;
}

// حذف تریگرهای قبلیِ همین پروژه (برای جلوگیری از ثبت تکراری هنگام اجرای دوباره)
function removeExistingTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}
`;

/** Maps a platform FormField list into the lightweight shape the script bakes in. */
const mapFields = (fields: FormField[]) =>
  [...fields]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(f => ({
      key: f.key || f.id,
      label: (f.label || f.key || f.id).trim(),
      type: f.type,
      required: !!f.required,
      options: f.options || [],
    }));

// ════════════════════════════════════════════════════════════════════════════
//  1) Custom "Forms & Standards" form → Google Form
// ════════════════════════════════════════════════════════════════════════════
export const buildGoogleFormScript = (form: CustomForm): string => {
  const fields = mapFields(form.fields);

  // Google-Form question title → platform field key (so responses land under customData[key]).
  const keyMap: Record<string, string> = {};
  fields.forEach(f => { if (f.type !== 'header') keyMap[f.label] = f.key; });

  const FIELDS_JSON = JSON.stringify(fields, null, 2);
  const KEYMAP_JSON = JSON.stringify(keyMap, null, 2);
  const TITLE = JSON.stringify(form.title || 'فرم');
  const DESC = JSON.stringify(form.description || '');
  const FORM_ID = JSON.stringify(form.id);
  // Routing config of the form — embedded so the platform can assign the ticket to
  // the same person/role you set in the form builder (read by App.tsx).
  const ASSIGNEE_ID = JSON.stringify(form.assigneePersonnelId || '');
  const ASSIGNEE_ROLE = JSON.stringify(form.assigneeRole || '');

  return `/**
 * ═══════════════════════════════════════════════════════════════════════
 *  اتصال خودکار گوگل‌فرم به سامانه — فرم: ${form.title}
 *  ۱) تابع «setupGoogleForm» را یک‌بار اجرا کنید.
 *  ۲) لینک فرم از Execution log کپی و برای مشتری ارسال می‌شود.
 *  ۳) هر پاسخ، خودکار به‌صورت تیکت در سامانه ثبت می‌گردد.
 * ═══════════════════════════════════════════════════════════════════════
 */

var PROJECT_ID = ${PROJECT_ID};
var API_KEY    = ${API_KEY};
var PLATFORM_FORM_ID = ${FORM_ID};
var FORM_TITLE = ${TITLE};
var FORM_DESC  = ${DESC};

var Q_NAME  = 'نام و نام خانوادگی';
var Q_PHONE = 'شماره تماس';

var ASSIGNEE_ID   = ${ASSIGNEE_ID};
var ASSIGNEE_ROLE = ${ASSIGNEE_ROLE};

var FIELDS  = ${FIELDS_JSON};
var KEY_MAP = ${KEYMAP_JSON};

function setupGoogleForm() {
  var form = FormApp.create(FORM_TITLE);
  if (FORM_DESC) form.setDescription(FORM_DESC);
  form.setCollectEmail(false);

  form.addTextItem().setTitle(Q_NAME).setRequired(true);
  form.addTextItem().setTitle(Q_PHONE).setRequired(true);

  for (var i = 0; i < FIELDS.length; i++) addFieldToForm(form, FIELDS[i]);

  removeExistingTriggers();
  ScriptApp.newTrigger('onFormSubmit').forForm(form).onFormSubmit().create();
  PropertiesService.getScriptProperties().setProperty('linkedFormId', form.getId());

  Logger.log('✅ گوگل‌فرم ساخته و به سامانه متصل شد.');
  Logger.log('📨 لینک پر کردن فرم (برای مشتری): ' + form.getPublishedUrl());
  Logger.log('✏️ لینک ویرایش فرم (برای شما): ' + form.getEditUrl());
}

function onFormSubmit(e) {
  try {
    var itemResponses = e.response.getItemResponses();
    var customData = { formId: PLATFORM_FORM_ID, formTitle: FORM_TITLE };
    // ارجاع تنظیم‌شده‌ی فرم را همراه تیکت می‌فرستیم تا سامانه آن را به همان شخص/نقش ارجاع دهد.
    if (ASSIGNEE_ID)   customData.__assigneePersonnelId = ASSIGNEE_ID;
    if (ASSIGNEE_ROLE) customData.__assigneeRole = ASSIGNEE_ROLE;
    var name = '', phone = '', descLines = [];

    for (var i = 0; i < itemResponses.length; i++) {
      var ir = itemResponses[i];
      var title = ir.getItem().getTitle();
      var ans = ir.getResponse();
      if (ans && ans.join) ans = ans.join('، ');
      var ansStr = (ans === null || ans === undefined) ? '' : String(ans);
      if (!ansStr) continue;

      if (title === Q_NAME)  { name = ansStr; continue; }
      if (title === Q_PHONE) { phone = ansStr; continue; }

      var key = KEY_MAP[title];
      if (key) customData[key] = ansStr;
      descLines.push(title + ': ' + ansStr);
    }

    var now = new Date().toISOString();
    var id = 'FRM-' + (new Date()).getTime() + '-' + Math.floor(Math.random() * 9000 + 1000) + '-GF';

    var ticket = {
      id: id,
      customerName: name || 'بدون نام',
      phoneNumber: phone,
      whatsappNumber: phone,
      location: '-',
      serviceId: 'form:' + PLATFORM_FORM_ID,
      description: '[فرم: ' + FORM_TITLE + ']\\n' + descLines.join('\\n'),
      status: 'ثبت شده',
      createdAt: now,
      source: 'google_form',
      timeline: [{
        type: 'creation', title: 'ثبت از طریق گوگل‌فرم',
        description: 'فرم «' + FORM_TITLE + '» توسط ' + (name || 'کاربر') + ' در گوگل‌فرم تکمیل شد.',
        actorName: 'گوگل‌فرم', timestamp: now, visibility: 'public'
      }],
      customData: customData
    };

    writeTicketToFirestore(id, ticket);
  } catch (err) {
    Logger.log('❌ خطا در ثبت پاسخ: ' + err);
  }
}
${SHARED_HELPERS}`;
};

// ════════════════════════════════════════════════════════════════════════════
//  2) Service Request form → Google Form (with service-based auto-routing)
// ════════════════════════════════════════════════════════════════════════════
export const buildServiceRequestGoogleScript = (
  services: ServiceOption[],
  formFields: FormField[],
  multiService = false,
): string => {
  const fields = mapFields(formFields);

  // question title → field key
  const keyMap: Record<string, string> = {};
  fields.forEach(f => { if (f.type !== 'header') keyMap[f.label] = f.key; });

  // Active services with their sub-services (title + id), so the script can build the
  // form and map selected services / sub-services back to their IDs for routing.
  const activeServices = services
    .filter(s => s.isActive !== false)
    .map(s => ({
      id: s.id,
      title: (s.title || s.id).trim(),
      subs: (s.subServices || [])
        .map(ss => ({ id: ss.id, title: (ss.title || ss.id).trim() }))
        .filter(ss => ss.title),
    }))
    .filter(s => s.title);

  const FIELDS_JSON = JSON.stringify(fields, null, 2);
  const KEYMAP_JSON = JSON.stringify(keyMap, null, 2);
  const SERVICES_JSON = JSON.stringify(activeServices, null, 2);

  const headerComment = multiService
    ? `/**
 * ═══════════════════════════════════════════════════════════════════════
 *  گوگل‌فرمِ «ثبت درخواست خدمات» (حالت چند‌خدمت) — متصل به سامانه
 *  مشتری می‌تواند در صورت نیاز چند خدمت را هم‌زمان انتخاب کند. برای هر خدمتِ
 *  انتخابی یک «درخواست جداگانه» ثبت می‌شود و هرکدام طبق تنظیمات «ارجاع
 *  سرویس/زیرخدمت» سامانه، مستقل به کارشناس مربوطه ارجاع داده می‌شود
 *  (دقیقاً مانند فرم ثبت درخواستِ خودِ سامانه که چند تیکت می‌سازد).
 *
 *  ۱) تابع «setupGoogleForm» را یک‌بار اجرا کنید.
 *  ۲) لینک فرم از Execution log کپی و برای مشتری ارسال می‌شود.
 * ═══════════════════════════════════════════════════════════════════════
 */`
    : `/**
 * ═══════════════════════════════════════════════════════════════════════
 *  گوگل‌فرمِ «ثبت درخواست خدمات» (حالت تک‌خدمت) — متصل به سامانه
 *  مشتری یک «نوع خدمت» را انتخاب می‌کند، سپس فقط «زیرخدمت‌های» همان خدمت
 *  به او نمایش داده می‌شود (بخش‌بندی شرطی)، و در پایان اطلاعات تماس.
 *  هر پاسخ به‌صورت تیکت ثبت و طبق تنظیمات «ارجاع سرویس/زیرخدمت» سامانه
 *  خودکار به کارشناس مربوطه ارجاع داده می‌شود (دقیقاً مانند ثبت درخواست بومی).
 *
 *  ۱) تابع «setupGoogleForm» را یک‌بار اجرا کنید.
 *  ۲) لینک فرم از Execution log کپی و برای مشتری ارسال می‌شود.
 * ═══════════════════════════════════════════════════════════════════════
 */`;

  const vars = `
var PROJECT_ID   = ${PROJECT_ID};
var API_KEY      = ${API_KEY};
var FORM_TITLE   = 'فرم ثبت درخواست خدمات';
var Q_SERVICE    = 'نوع خدمت درخواستی';
var Q_SERVICES   = 'خدمت‌های مورد نظر';
var SUB_Q_PREFIX = 'زیرخدمت‌های مرتبط با';

var FIELDS   = ${FIELDS_JSON};
var KEY_MAP  = ${KEYMAP_JSON};
var SERVICES = ${SERVICES_JSON};`;

  const pickFn = `
function pick(formData, keys) {
  for (var i = 0; i < keys.length; i++) { if (formData[keys[i]]) return formData[keys[i]]; }
  return '';
}`;

  // ── SINGLE-service mode (conditional sub-service branching) ──────────────────
  const setupSingle = `
function setupGoogleForm() {
  var form = FormApp.create(FORM_TITLE);
  form.setDescription('برای ثبت درخواست، لطفاً فرم زیر را تکمیل کنید.');
  form.setCollectEmail(false);

  var hasSubs = false;
  for (var i = 0; i < SERVICES.length; i++) {
    if (SERVICES[i].subs && SERVICES[i].subs.length) { hasSubs = true; break; }
  }

  if (!SERVICES.length) {
    for (var i = 0; i < FIELDS.length; i++) addFieldToForm(form, FIELDS[i]);

  } else if (!hasSubs) {
    // هیچ خدمتی زیرخدمت ندارد → یک لیست کشویی + فیلدها در یک صفحه
    var titles = [];
    for (var i = 0; i < SERVICES.length; i++) titles.push(SERVICES[i].title);
    form.addListItem().setTitle(Q_SERVICE).setRequired(true).setChoiceValues(titles);
    for (var i = 0; i < FIELDS.length; i++) addFieldToForm(form, FIELDS[i]);

  } else {
    // انتخاب خدمت (صفحه ۱) → صفحه‌ی زیرخدمتِ همان خدمت → صفحه‌ی اطلاعات تماس
    var radio = form.addMultipleChoiceItem().setTitle(Q_SERVICE).setRequired(true);

    var subPageByTitle = {};
    var subPages = [];
    for (var i = 0; i < SERVICES.length; i++) {
      var s = SERVICES[i];
      if (s.subs && s.subs.length) {
        var pb = form.addPageBreakItem().setTitle('زیرخدمت‌های «' + s.title + '»');
        var vals = [];
        for (var j = 0; j < s.subs.length; j++) vals.push(s.subs[j].title);
        form.addCheckboxItem()
            .setTitle(SUB_Q_PREFIX + ' «' + s.title + '»')
            .setRequired(false)
            .setChoiceValues(vals);
        subPageByTitle[s.title] = pb;
        subPages.push(pb);
      }
    }

    var contactPage = form.addPageBreakItem().setTitle('اطلاعات تماس و تکمیلی');
    for (var i = 0; i < FIELDS.length; i++) addFieldToForm(form, FIELDS[i]);

    // پس از هر صفحه‌ی زیرخدمت، مستقیم به صفحه‌ی تماس (setGoToPage مسیرِ صفحه‌ی قبلی را تعیین می‌کند)
    for (var i = 1; i < subPages.length; i++) {
      subPages[i].setGoToPage(contactPage);
    }

    var choices = [];
    for (var i = 0; i < SERVICES.length; i++) {
      var s = SERVICES[i];
      var target = subPageByTitle[s.title] ? subPageByTitle[s.title] : contactPage;
      choices.push(radio.createChoice(s.title, target));
    }
    radio.setChoices(choices);
  }

  removeExistingTriggers();
  ScriptApp.newTrigger('onFormSubmit').forForm(form).onFormSubmit().create();
  PropertiesService.getScriptProperties().setProperty('linkedFormId', form.getId());

  Logger.log('✅ گوگل‌فرمِ ثبت درخواست (تک‌خدمت) ساخته و به سامانه متصل شد.');
  Logger.log('📨 لینک پر کردن فرم (برای مشتری): ' + form.getPublishedUrl());
  Logger.log('✏️ لینک ویرایش فرم (برای شما): ' + form.getEditUrl());
}`;

  const onSubmitSingle = `
function onFormSubmit(e) {
  try {
    var itemResponses = e.response.getItemResponses();
    var formData = {};
    var serviceTitle = '';
    var subSelections = [];
    var descLines = [];

    for (var i = 0; i < itemResponses.length; i++) {
      var ir = itemResponses[i];
      var title = ir.getItem().getTitle();
      var raw = ir.getResponse();

      if (title === Q_SERVICE) {
        serviceTitle = (raw === null || raw === undefined) ? '' : String(raw);
        continue;
      }
      if (title.indexOf(SUB_Q_PREFIX) === 0) {
        if (raw && raw.length) {
          for (var k = 0; k < raw.length; k++) subSelections.push(String(raw[k]));
        }
        continue;
      }

      var ans = raw;
      if (ans && ans.join) ans = ans.join('، ');
      var ansStr = (ans === null || ans === undefined) ? '' : String(ans);
      if (!ansStr) continue;
      var key = KEY_MAP[title];
      if (key) formData[key] = ansStr;
      descLines.push(title + ': ' + ansStr);
    }

    var serviceId = serviceTitle;
    var serviceObj = null;
    for (var i = 0; i < SERVICES.length; i++) {
      if (SERVICES[i].title === serviceTitle) { serviceObj = SERVICES[i]; serviceId = SERVICES[i].id; break; }
    }
    if (!serviceId) serviceId = 's_other';

    var selectedSubIds = [];
    if (serviceObj && serviceObj.subs && subSelections.length) {
      for (var a = 0; a < subSelections.length; a++) {
        for (var b = 0; b < serviceObj.subs.length; b++) {
          if (serviceObj.subs[b].title === subSelections[a]) { selectedSubIds.push(serviceObj.subs[b].id); break; }
        }
      }
    }
    if (subSelections.length) descLines.push('زیرخدمت‌ها: ' + subSelections.join('، '));

    var name         = pick(formData, ['fullName', 'name', 'customerName']);
    var phone        = pick(formData, ['phoneNumber', 'mobile', 'phone', 'tel']);
    var whatsapp     = pick(formData, ['whatsappNumber', 'whatsapp']) || phone;
    var company      = pick(formData, ['companyName', 'company']);
    var location     = pick(formData, ['location', 'city', 'address']) || '-';
    var businessType = pick(formData, ['businessType', 'business']);

    var now = new Date().toISOString();
    var id = 'FRM-' + (new Date()).getTime() + '-' + Math.floor(Math.random() * 9000 + 1000) + '-GF';

    // assignedTo را خالی می‌گذاریم تا سامانه خودش طبق ارجاع سرویس/زیرخدمت عمل کند.
    var ticket = {
      id: id,
      customerName: name || 'بدون نام',
      companyName: company,
      location: location,
      phoneNumber: phone,
      whatsappNumber: whatsapp,
      businessType: businessType,
      serviceId: serviceId,
      selectedSubServices: selectedSubIds,
      description: '[درخواست از گوگل‌فرم — خدمت: ' + serviceTitle + ']\\n' + descLines.join('\\n'),
      status: 'ثبت شده',
      createdAt: now,
      priority: 'Medium',
      source: 'google_form',
      timeline: [{
        type: 'creation', title: 'ثبت درخواست از گوگل‌فرم',
        description: 'درخواست خدمت «' + serviceTitle + '» توسط ' + (name || 'مشتری') + ' از طریق گوگل‌فرم ثبت شد.',
        actorName: 'گوگل‌فرم', timestamp: now, visibility: 'public'
      }],
      customData: formData
    };

    writeTicketToFirestore(id, ticket);
  } catch (err) {
    Logger.log('❌ خطا در ثبت درخواست: ' + err);
  }
}`;

  // ── MULTI-service mode (checkbox; one ticket per selected service) ───────────
  const setupMulti = `
function setupGoogleForm() {
  var form = FormApp.create(FORM_TITLE);
  form.setDescription('برای ثبت درخواست، لطفاً فرم زیر را تکمیل کنید. در صورت نیاز می‌توانید چند خدمت را هم‌زمان انتخاب کنید.');
  form.setCollectEmail(false);

  // انتخاب چندتاییِ خدمت‌ها
  if (SERVICES.length) {
    var titles = [];
    for (var i = 0; i < SERVICES.length; i++) titles.push(SERVICES[i].title);
    form.addCheckboxItem()
        .setTitle(Q_SERVICES)
        .setHelpText('می‌توانید یک یا چند خدمت را انتخاب کنید.')
        .setRequired(true)
        .setChoiceValues(titles);
  }

  // برای هر خدمتِ دارای زیرخدمت، یک چک‌باکس زیرخدمت (اختیاری). چون انتخاب خدمت
  // چندتایی است، نمایش شرطی ممکن نیست؛ پس هر گروه با راهنمای واضح نمایش داده می‌شود.
  for (var i = 0; i < SERVICES.length; i++) {
    var s = SERVICES[i];
    if (s.subs && s.subs.length) {
      var vals = [];
      for (var j = 0; j < s.subs.length; j++) vals.push(s.subs[j].title);
      form.addCheckboxItem()
          .setTitle(SUB_Q_PREFIX + ' «' + s.title + '»')
          .setHelpText('فقط در صورتی تکمیل کنید که خدمت «' + s.title + '» را انتخاب کرده‌اید.')
          .setRequired(false)
          .setChoiceValues(vals);
    }
  }

  // اطلاعات تماس و سایر فیلدها
  for (var i = 0; i < FIELDS.length; i++) addFieldToForm(form, FIELDS[i]);

  removeExistingTriggers();
  ScriptApp.newTrigger('onFormSubmit').forForm(form).onFormSubmit().create();
  PropertiesService.getScriptProperties().setProperty('linkedFormId', form.getId());

  Logger.log('✅ گوگل‌فرمِ ثبت درخواست (چند‌خدمت) ساخته و به سامانه متصل شد.');
  Logger.log('📨 لینک پر کردن فرم (برای مشتری): ' + form.getPublishedUrl());
  Logger.log('✏️ لینک ویرایش فرم (برای شما): ' + form.getEditUrl());
}`;

  const onSubmitMulti = `
function onFormSubmit(e) {
  try {
    var itemResponses = e.response.getItemResponses();
    var formData = {};
    var serviceSelections = [];
    var subByQuestion = {}; // عنوان سؤال زیرخدمت → آرایه‌ی عناوین انتخابی
    var descLines = [];

    for (var i = 0; i < itemResponses.length; i++) {
      var ir = itemResponses[i];
      var title = ir.getItem().getTitle();
      var raw = ir.getResponse();

      if (title === Q_SERVICES) {
        if (raw && raw.length) { for (var k = 0; k < raw.length; k++) serviceSelections.push(String(raw[k])); }
        if (serviceSelections.length) descLines.push('خدمات: ' + serviceSelections.join('، '));
        continue;
      }
      if (title.indexOf(SUB_Q_PREFIX) === 0) {
        var arr = [];
        if (raw && raw.length) { for (var k = 0; k < raw.length; k++) arr.push(String(raw[k])); }
        subByQuestion[title] = arr;
        continue;
      }

      var ans = raw;
      if (ans && ans.join) ans = ans.join('، ');
      var ansStr = (ans === null || ans === undefined) ? '' : String(ans);
      if (!ansStr) continue;
      var key = KEY_MAP[title];
      if (key) formData[key] = ansStr;
      descLines.push(title + ': ' + ansStr);
    }

    var name         = pick(formData, ['fullName', 'name', 'customerName']);
    var phone        = pick(formData, ['phoneNumber', 'mobile', 'phone', 'tel']);
    var whatsapp     = pick(formData, ['whatsappNumber', 'whatsapp']) || phone;
    var company      = pick(formData, ['companyName', 'company']);
    var location     = pick(formData, ['location', 'city', 'address']) || '-';
    var businessType = pick(formData, ['businessType', 'business']);

    var now = new Date().toISOString();
    var baseTime = (new Date()).getTime();
    var commonDesc = descLines.join('\\n');

    if (serviceSelections.length === 0) serviceSelections = ['']; // حداقل یک درخواست ثبت شود

    // برای هر خدمتِ انتخابی، یک تیکت جداگانه (مثل فرم بومی) — هرکدام مستقل ارجاع می‌شود.
    for (var si = 0; si < serviceSelections.length; si++) {
      var stitle = serviceSelections[si];
      var sobj = null;
      var sid = stitle || 's_other';
      for (var a = 0; a < SERVICES.length; a++) {
        if (SERVICES[a].title === stitle) { sobj = SERVICES[a]; sid = SERVICES[a].id; break; }
      }

      var subIds = [];
      var selSubTitles = [];
      if (sobj && sobj.subs && sobj.subs.length) {
        var qTitle = SUB_Q_PREFIX + ' «' + sobj.title + '»';
        var selSubs = subByQuestion[qTitle] || [];
        for (var x = 0; x < selSubs.length; x++) {
          for (var y = 0; y < sobj.subs.length; y++) {
            if (sobj.subs[y].title === selSubs[x]) { subIds.push(sobj.subs[y].id); selSubTitles.push(selSubs[x]); break; }
          }
        }
      }

      var perDesc = commonDesc;
      if (selSubTitles.length) perDesc += '\\nزیرخدمت‌های «' + (stitle || '—') + '»: ' + selSubTitles.join('، ');

      var id = 'FRM-' + baseTime + '-' + si + '-' + Math.floor(Math.random() * 9000 + 1000) + '-GF';
      var ticket = {
        id: id,
        customerName: name || 'بدون نام',
        companyName: company,
        location: location,
        phoneNumber: phone,
        whatsappNumber: whatsapp,
        businessType: businessType,
        serviceId: sid,
        selectedSubServices: subIds,
        description: '[درخواست از گوگل‌فرم — خدمت: ' + (stitle || '—') + ']\\n' + perDesc,
        status: 'ثبت شده',
        createdAt: now,
        priority: 'Medium',
        source: 'google_form',
        timeline: [{
          type: 'creation', title: 'ثبت درخواست از گوگل‌فرم',
          description: 'درخواست خدمت «' + (stitle || '—') + '» توسط ' + (name || 'مشتری') + ' از طریق گوگل‌فرم ثبت شد.',
          actorName: 'گوگل‌فرم', timestamp: now, visibility: 'public'
        }],
        customData: formData
      };

      writeTicketToFirestore(id, ticket);
    }
  } catch (err) {
    Logger.log('❌ خطا در ثبت درخواست: ' + err);
  }
}`;

  const body = multiService ? `${setupMulti}\n${onSubmitMulti}` : `${setupSingle}\n${onSubmitSingle}`;

  return `${headerComment}
${vars}
${body}
${pickFn}
${SHARED_HELPERS}`;
};

// ════════════════════════════════════════════════════════════════════════════
//  3) Connect an EXISTING Google Form (the admin already built) → cartable
// ════════════════════════════════════════════════════════════════════════════
//  This is a CONTAINER-BOUND script: the admin pastes it into their existing
//  form's own Apps Script editor (Extensions → Apps Script). It does NOT create a
//  form — it just installs an onFormSubmit trigger and forwards every response to
//  Firestore as a ticket. Contact name/phone are auto-detected from question
//  titles; the ticket is routed by the chosen service (serviceId) or directly to
//  the chosen person/role (__assignee* in customData), handled by App.tsx.
export const buildExistingFormConnectScript = (opts: {
  mode: 'service' | 'assignee';
  serviceId?: string;
  serviceTitle?: string;
  assigneeId?: string;
  assigneeRole?: string;
  targetLabel?: string;
}): string => {
  const SERVICE_ID = JSON.stringify(opts.mode === 'service' ? (opts.serviceId || '') : '');
  const ASSIGNEE_ID = JSON.stringify(opts.mode === 'assignee' ? (opts.assigneeId || '') : '');
  const ASSIGNEE_ROLE = JSON.stringify(opts.mode === 'assignee' ? (opts.assigneeRole || '') : '');
  const TARGET = opts.targetLabel || (opts.mode === 'service' ? (opts.serviceTitle || 'خدمت') : 'کارشناس انتخابی');

  return `/**
 * ═══════════════════════════════════════════════════════════════════════
 *  اتصال «گوگل‌فرمِ موجودِ شما» به سامانه طوحید دهیامی
 *  ارجاع به: ${TARGET}
 * ───────────────────────────────────────────────────────────────────────
 *  این کد را داخل ویرایشگر اسکریپتِ همان گوگل‌فرم جای‌گذاری کنید
 *  (از منوی فرم: Extensions → Apps Script). سپس تابع «setupConnect» را
 *  یک‌بار اجرا کنید. از این پس هر پاسخ این فرم در کارتابل ثبت می‌شود.
 * ═══════════════════════════════════════════════════════════════════════
 */

var PROJECT_ID    = ${PROJECT_ID};
var API_KEY       = ${API_KEY};
var SERVICE_ID    = ${SERVICE_ID};
var ASSIGNEE_ID   = ${ASSIGNEE_ID};
var ASSIGNEE_ROLE = ${ASSIGNEE_ROLE};

// واژه‌های کلیدی برای تشخیص خودکار نام و شماره تماس از عنوان سؤالات فرم
var NAME_KEYS  = ['نام', 'اسم', 'name'];
var PHONE_KEYS = ['تلفن', 'موبایل', 'همراه', 'شماره', 'تماس', 'واتس', 'phone', 'mobile', 'tel', 'whatsapp'];

function setupConnect() {
  var form = FormApp.getActiveForm();
  if (!form) {
    Logger.log('❌ این اسکریپت باید از داخل ویرایشگر اسکریپتِ همان گوگل‌فرم اجرا شود (Extensions → Apps Script).');
    return;
  }
  removeExistingTriggers();
  ScriptApp.newTrigger('onFormSubmit').forForm(form).onFormSubmit().create();
  Logger.log('✅ فرم «' + form.getTitle() + '» با موفقیت به سامانه متصل شد.');
  Logger.log('از این پس هر پاسخ این فرم به‌صورت تیکت در کارتابل ثبت و ارجاع داده می‌شود.');
}

function matchesAny(text, keys) {
  for (var i = 0; i < keys.length; i++) { if (text.indexOf(keys[i]) >= 0) return true; }
  return false;
}

function onFormSubmit(e) {
  try {
    var form = FormApp.getActiveForm();
    var formTitle = (form && form.getTitle()) || 'گوگل‌فرم';
    var itemResponses = e.response.getItemResponses();
    var customData = { formTitle: formTitle };
    var name = '', phone = '', descLines = [];

    for (var i = 0; i < itemResponses.length; i++) {
      var ir = itemResponses[i];
      var title = ir.getItem().getTitle();
      var ans = ir.getResponse();
      if (ans && ans.join) ans = ans.join('، ');
      var ansStr = (ans === null || ans === undefined) ? '' : String(ans);
      if (!ansStr) continue;

      customData[title] = ansStr;
      descLines.push(title + ': ' + ansStr);

      var low = title.toLowerCase();
      if (!name  && matchesAny(low, NAME_KEYS))  name = ansStr;
      if (!phone && matchesAny(low, PHONE_KEYS)) phone = ansStr;
    }

    // ارجاع: یا بر اساس خدمت (serviceId)، یا مستقیم به شخص/نقش (در customData)
    if (ASSIGNEE_ID)   customData.__assigneePersonnelId = ASSIGNEE_ID;
    if (ASSIGNEE_ROLE) customData.__assigneeRole = ASSIGNEE_ROLE;
    var serviceId = SERVICE_ID ? SERVICE_ID : 'google_form';

    var now = new Date().toISOString();
    var id = 'GF-' + (new Date()).getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);

    // assignedTo را خالی می‌گذاریم تا سامانه طبق ارجاع تعیین‌شده عمل کند (و نوتیفیکیشن بفرستد).
    var ticket = {
      id: id,
      customerName: name || 'بدون نام',
      phoneNumber: phone,
      whatsappNumber: phone,
      location: '-',
      serviceId: serviceId,
      description: '[گوگل‌فرم: ' + formTitle + ']\\n' + descLines.join('\\n'),
      status: 'ثبت شده',
      createdAt: now,
      source: 'google_form',
      timeline: [{
        type: 'creation', title: 'ثبت از طریق گوگل‌فرم',
        description: 'فرم «' + formTitle + '» توسط ' + (name || 'کاربر') + ' تکمیل شد.',
        actorName: 'گوگل‌فرم', timestamp: now, visibility: 'public'
      }],
      customData: customData
    };

    writeTicketToFirestore(id, ticket);
  } catch (err) {
    Logger.log('❌ خطا در ثبت پاسخ: ' + err);
  }
}
${SHARED_HELPERS}`;
};
