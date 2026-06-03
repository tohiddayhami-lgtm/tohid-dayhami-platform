import React, { useState } from 'react';
import { IconShield } from './Icons';

interface Props {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onBack: () => void;
}

export const LoginView: React.FC<Props> = ({ onLogin, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const success = await onLogin(username, password);
      if (!success) setError('نام کاربری یا رمز عبور اشتباه است.');
    } catch {
      setError('خطا در برقراری ارتباط.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-colors dir-ltr text-left";

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-sm animate-fade-in">

        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <IconShield className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">ورود به پنل مدیریت</h2>
          <p className="text-sm text-gray-400 mt-1">ویژه کارشناسان و مدیران</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">نام کاربری</label>
            <input type="text" required className={inputClass} placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">رمز عبور</label>
            <input type="password" required className={inputClass} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-center">{error}</p>
          )}

          <button type="submit" disabled={isLoading}
            className="w-full bg-gray-900 text-white py-2.5 rounded-full text-sm font-medium hover:bg-black transition-colors flex justify-center items-center gap-2 mt-2">
            {isLoading
              ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
              : 'ورود'}
          </button>

          <button type="button" onClick={onBack} className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1">
            بازگشت به صفحه اصلی
          </button>
        </form>
      </div>
    </div>
  );
};
