import { CustomForm } from '../types';
import { firebaseConfig } from './firebaseService';

/**
 * Builds a self-contained Google Apps Script that:
 *   1. Creates a brand-new Google Form mirroring the platform's CustomForm.
 *   2. Installs an onFormSubmit trigger automatically.
 *   3. On every submission, writes a Ticket directly to Firestore (same project
 *      the platform reads from), so the response lands in the form's archive and
 *      the admin cartable exactly like a native public-form submission.
 *
 * No OAuth / service account / Cloud API needed — the admin pastes the code into
 * script.google.com, runs `setupGoogleForm` once, authorizes, and shares the
 * generated form link. Because the script runs on Google's servers, it works
 * even from Iran (where firestore.googleapis.com is blocked for the browser).
 */
export const buildGoogleFormScript = (form: CustomForm): string => {
  // Fields in display order; headers kept so the Google Form gets section breaks.
  const fields = [...form.fields]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(f => ({
      key: f.key || f.id,
      label: (f.label || f.key || f.id).trim(),
      type: f.type,
      required: !!f.required,
      options: f.options || [],
    }));

  // Map a Google-Form question title back to the platform field key, so responses
  // are stored under customData[field.key] (what the archive table reads).
  const keyMap: Record<string, string> = {};
  fields.forEach(f => { if (f.type !== 'header') keyMap[f.label] = f.key; });

  const FIELDS_JSON = JSON.stringify(fields, null, 2);
  const KEYMAP_JSON = JSON.stringify(keyMap, null, 2);
  const TITLE = JSON.stringify(form.title || 'فرم');
  const DESC = JSON.stringify(form.description || '');
  const FORM_ID = JSON.stringify(form.id);
  const PROJECT_ID = JSON.stringify(firebaseConfig.projectId);
  const API_KEY = JSON.stringify(firebaseConfig.apiKey);

  // NOTE: everything below is plain Apps Script (ES5-ish). It is injected as a
  // string; the only template placeholders are the JSON constants above.
  return `/**
 * ═══════════════════════════════════════════════════════════════════════
 *  اتصال خودکار گوگل‌فرم به سامانه طوحید دهیامی
 *  فرم: ${form.title}
 * ───────────────────────────────────────────────────────────────────────
 *  راهنمای استفاده:
 *   ۱) تابع «setupGoogleForm» را یک‌بار اجرا کنید تا گوگل‌فرم ساخته شود.
 *   ۲) لینک فرم از بخش Execution log کپی و برای مشتری ارسال می‌شود.
 *   ۳) از این پس هر پاسخ، خودکار به‌صورت تیکت در سامانه ثبت می‌گردد.
 * ═══════════════════════════════════════════════════════════════════════
 */

var PLATFORM_FORM_ID = ${FORM_ID};
var FORM_TITLE       = ${TITLE};
var FORM_DESC        = ${DESC};
var PROJECT_ID       = ${PROJECT_ID};
var API_KEY          = ${API_KEY};

// عنوان دو پرسش ثابتِ مشخصات تماس (برای ثبت نام و شماره در کارتابل)
var Q_NAME  = 'نام و نام خانوادگی';
var Q_PHONE = 'شماره تماس';

// تعریف فیلدهای فرم (از روی فرم سامانه تولید شده است)
var FIELDS = ${FIELDS_JSON};

// نگاشت عنوان سؤال → کلید فیلد در سامانه
var KEY_MAP = ${KEYMAP_JSON};

/**
 * یک‌بار اجرا کنید: گوگل‌فرم را می‌سازد و تریگر ارسال را نصب می‌کند.
 */
function setupGoogleForm() {
  var form = FormApp.create(FORM_TITLE);
  if (FORM_DESC) form.setDescription(FORM_DESC);
  form.setCollectEmail(false);

  // پرسش‌های مشخصات تماس (همیشه و در ابتدای فرم)
  form.addTextItem().setTitle(Q_NAME).setRequired(true);
  form.addTextItem().setTitle(Q_PHONE).setRequired(true);

  for (var i = 0; i < FIELDS.length; i++) {
    addFieldToForm(form, FIELDS[i]);
  }

  // نصب خودکار تریگر «هنگام ارسال فرم»
  removeExistingTriggers();
  ScriptApp.newTrigger('onFormSubmit').forForm(form).onFormSubmit().create();

  // ذخیره‌ی شناسه فرم برای مراجعات بعدی
  PropertiesService.getScriptProperties().setProperty('linkedFormId', form.getId());

  Logger.log('✅ گوگل‌فرم با موفقیت ساخته و به سامانه متصل شد.');
  Logger.log('📨 لینک پر کردن فرم (این را برای مشتری بفرستید):');
  Logger.log(form.getPublishedUrl());
  Logger.log('✏️ لینک ویرایش فرم (برای خودتان):');
  Logger.log(form.getEditUrl());
}

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
    // اگر افزودن فیلد با خطا مواجه شد، به‌صورت متن ساده اضافه می‌کنیم تا فرم خراب نشود.
    try { form.addTextItem().setTitle(f.label).setRequired(false); } catch (e2) {}
  }
}

/**
 * با هر ارسال فرم اجرا می‌شود و پاسخ را به‌صورت تیکت در سامانه ثبت می‌کند.
 */
function onFormSubmit(e) {
  try {
    var itemResponses = e.response.getItemResponses();
    var customData = { formId: PLATFORM_FORM_ID, formTitle: FORM_TITLE };
    var name = '';
    var phone = '';
    var descLines = [];

    for (var i = 0; i < itemResponses.length; i++) {
      var ir = itemResponses[i];
      var title = ir.getItem().getTitle();
      var ans = ir.getResponse();
      if (ans && ans.join) ans = ans.join('، '); // چک‌باکس چندگزینه‌ای
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
        type: 'creation',
        title: 'ثبت از طریق گوگل‌فرم',
        description: 'فرم «' + FORM_TITLE + '» توسط ' + (name || 'کاربر') + ' در گوگل‌فرم تکمیل شد.',
        actorName: 'گوگل‌فرم',
        timestamp: now,
        visibility: 'public'
      }],
      customData: customData
    };

    writeTicketToFirestore(id, ticket);
  } catch (err) {
    Logger.log('❌ خطا در ثبت پاسخ: ' + err);
  }
}

/**
 * نوشتن مستقیم سند تیکت در Firestore (REST). همان پروژه‌ای که سامانه از آن می‌خواند.
 */
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
};
