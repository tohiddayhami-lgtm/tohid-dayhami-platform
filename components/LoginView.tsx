import React, { useState } from 'react';
import { IconShield, IconUsers } from './Icons';

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
      if (!success) {
        setError('نام کاربری یا رمز عبور اشتباه است.');
      }
    } catch (err) {
      setError('خطا در برقراری ارتباط.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full mb-4">
            <IconShield className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">ورود به پنل مدیریت</h2>
          <p className="text-gray-500 mt-2 text-sm">ویژه کارشناسان و مدیران سیستم</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">نام کاربری</label>
            <div className="relative">
              <input
                type="text"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-gray-50 text-left dir-ltr"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <IconUsers className="w-5 h-5 text-gray-400 absolute right-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">رمز عبور</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-gray-50 text-left dir-ltr"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex justify-center items-center"
          >
            {isLoading ? (
               <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : 'ورود به سیستم'}
          </button>
          
          <button 
            type="button" 
            onClick={onBack}
            className="w-full text-gray-500 text-sm hover:text-gray-700 transition-colors"
          >
            بازگشت به صفحه اصلی
          </button>
        </form>
      </div>
    </div>
  );
};