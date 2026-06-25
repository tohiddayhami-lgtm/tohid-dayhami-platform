import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application render failed', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
          <div className="max-w-xl w-full bg-white border border-red-100 rounded-2xl shadow-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              !
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">برنامه با خطا روبه‌رو شد</h1>
            <p className="text-slate-600 leading-7 mb-4">
              صفحه به‌صورت کامل سفید نشده است تا بتوانید خطا را ببینید. لطفاً صفحه را رفرش کنید؛ اگر مشکل باقی ماند، پیام خطای زیر را بررسی کنید.
            </p>
            <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-left dir-ltr overflow-auto text-sm">
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
