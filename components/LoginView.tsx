import React, { useState } from 'react';
import { IconShield, IconUsers } from './Icons';

interface Props {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onCustomerLogin: (username: string, password: string) => Promise<boolean>;
  onBack: () => void;
}

export const LoginView: React.FC<Props> = ({ onLogin, onCustomerLogin, onBack }) => {
  const [staffUser, setStaffUser] = useState('');
  const [staffPass, setStaffPass] = useState('');
  const [staffError, setStaffError] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);

  const [custUser, setCustUser] = useState('');
  const [custPass, setCustPass] = useState('');
  const [custError, setCustError] = useState('');
  const [custLoading, setCustLoading] = useState(false);

  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors dir-ltr text-left";

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError('');
    setStaffLoading(true);
    try {
      const ok = await onLogin(staffUser, staffPass);
      if (!ok) setStaffError('نام کاربری یا رمز عبور اشتباه است.');
    } catch { setStaffError('خطا در برقراری ارتباط.'); }
    finally { setStaffLoading(false); }
  };

  const handleCustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustError('');
    setCustLoading(true);
    try {
      const ok = await onCustomerLogin(custUser, custPass);
      if (!ok) setCustError('نام کاربری یا رمز عبور اشتباه است.');
    } catch { setCustError('خطا در برقراری ارتباط.'); }
    finally { setCustLoading(false); }
  };

  const spinner = (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
  );

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">

        {/* ── Staff Login ── */}
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <div className="text-center mb-6">
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-3">
              <IconShield className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">ورود پرسنل</h2>
            <p className="text-xs text-gray-400 mt-1">ویژه کارشناسان و مدیران</p>
          </div>
          <form onSubmit={handleStaffSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">نام کاربری</label>
              <input type="text" required className={inputClass} placeholder="username" value={staffUser} onChange={e => setStaffUser(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">رمز عبور</label>
              <input type="password" required className={inputClass} placeholder="••••••••" value={staffPass} onChange={e => setStaffPass(e.target.value)} />
            </div>
            {staffError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-center">{staffError}</p>}
            <button type="submit" disabled={staffLoading}
              className="w-full bg-gray-900 text-white py-2.5 rounded-full text-sm font-medium hover:bg-black transition-colors flex justify-center items-center gap-2">
              {staffLoading ? spinner : 'ورود'}
            </button>
          </form>
        </div>

        {/* ── Customer Login ── */}
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <div className="text-center mb-6">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <IconUsers className="w-5 h-5 text-gray-600" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">پنل مشتریان</h2>
            <p className="text-xs text-gray-400 mt-1">پیگیری درخواست و مکاتبات</p>
          </div>
          <form onSubmit={handleCustSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">نام کاربری</label>
              <input type="text" required className={inputClass} placeholder="username" value={custUser} onChange={e => setCustUser(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">رمز عبور</label>
              <input type="password" required className={inputClass} placeholder="••••••••" value={custPass} onChange={e => setCustPass(e.target.value)} />
            </div>
            {custError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-center">{custError}</p>}
            <button type="submit" disabled={custLoading}
              className="w-full bg-gray-100 text-gray-800 py-2.5 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors flex justify-center items-center gap-2 border border-gray-200">
              {custLoading ? spinner : 'ورود به پنل مشتری'}
            </button>
          </form>
        </div>

      </div>
      <div className="text-center mt-4">
        <button type="button" onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          بازگشت به صفحه اصلی
        </button>
      </div>
    </div>
  );
};
