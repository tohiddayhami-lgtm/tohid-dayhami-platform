import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { MetaShop, MetaShopMember, MetaShopOrder, MetaShopProduct } from '../types';
import type { MetaShopMemberSession } from '../utils/metaShopMemberSession';
import { metaShopProductImageUrl, productMainImage } from '../utils/metaShopImage';
import {
  loginMetaShopMember,
  registerMetaShopMember,
  recoverMetaShopMemberPassword,
  updateMetaShopMemberProfile,
  toggleMetaShopMemberFavorite,
  lookupMetaShopOrdersForMember,
  fetchMetaShopMemberById,
} from '../services/metaShopMemberService';
import {
  clearMetaShopMemberSession,
  writeMetaShopMemberSession,
  memberSessionToPublic,
} from '../utils/metaShopMemberSession';

const HeartIcon = ({ filled, size = 18 }: { filled?: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

type AuthView = 'login' | 'register' | 'recover';
type PanelTab = 'overview' | 'orders' | 'favorites' | 'profile';

interface Props {
  shop: MetaShop;
  uiLang: string;
  dir: 'rtl' | 'ltr';
  locale: string;
  products: MetaShopProduct[];
  session: MetaShopMemberSession | null;
  open: boolean;
  onClose: () => void;
  onSessionChange: (session: MetaShopMemberSession | null) => void;
  onOpenProduct?: (productId: string) => void;
  money: (n: number) => string;
  statusLabel: (s: MetaShopOrder['status']) => string;
}

const STRINGS: Record<string, Record<string, string>> = {
  en: {
    myAccount: 'My account', login: 'Sign in', register: 'Create account', logout: 'Sign out',
    username: 'Username', password: 'Password', confirmPassword: 'Confirm password',
    fullName: 'Full name', phone: 'Mobile', email: 'Email', company: 'Company',
    country: 'Country', city: 'City', forgot: 'Forgot password?', recoverTitle: 'Reset password',
    recoverHint: 'Enter your username and registered phone number, then choose a new password.',
    newPassword: 'New password', resetBtn: 'Reset password', noAccount: 'No account yet?',
    hasAccount: 'Already have an account?', createBtn: 'Create account', signInBtn: 'Sign in',
    overview: 'Overview', orders: 'Orders', favorites: 'Saved', profile: 'Profile',
    welcome: 'Welcome', orderCount: 'Orders', savedCount: 'Saved items', recentOrders: 'Recent orders',
    noOrders: 'No orders yet.', noFavorites: 'No saved products yet.', saveHint: 'Tap ♥ on products to save them.',
    viewAll: 'View all', updateProfile: 'Save changes', profileSaved: 'Profile updated.',
    errInvalid: 'Invalid username or password.', errDisabled: 'This account is disabled.',
    errUsernameTaken: 'This username is already taken.', errPhoneTaken: 'This phone is already registered.',
    errIncomplete: 'Please fill in all required fields.', errPasswordMatch: 'Passwords do not match.',
    errShortUser: 'Username must be at least 3 characters.', errShortPass: 'Password must be at least 6 characters.',
    errNotFound: 'Account not found.', errPhoneMismatch: 'Phone number does not match this account.',
    errGeneric: 'Something went wrong. Please try again.', loading: 'Loading…', close: 'Close',
    memberSince: 'Member since', tracking: 'Tracking', items: 'items', openProduct: 'View product',
    recoverByPhone: 'Recover with phone', backToLogin: 'Back to sign in',
  },
  fa: {
    myAccount: 'حساب من', login: 'ورود', register: 'ثبت‌نام', logout: 'خروج',
    username: 'نام کاربری', password: 'رمز عبور', confirmPassword: 'تکرار رمز عبور',
    fullName: 'نام و نام خانوادگی', phone: 'موبایل', email: 'ایمیل', company: 'شرکت',
    country: 'کشور', city: 'شهر', forgot: 'رمز را فراموش کردید؟', recoverTitle: 'بازیابی رمز عبور',
    recoverHint: 'نام کاربری و شماره موبایل ثبت‌شده را وارد کنید و رمز جدید انتخاب کنید.',
    newPassword: 'رمز عبور جدید', resetBtn: 'تغییر رمز', noAccount: 'حساب ندارید؟',
    hasAccount: 'قبلاً ثبت‌نام کرده‌اید؟', createBtn: 'ایجاد حساب', signInBtn: 'ورود',
    overview: 'خلاصه', orders: 'سفارش‌ها', favorites: 'ذخیره‌شده', profile: 'پروفایل',
    welcome: 'خوش آمدید', orderCount: 'سفارش', savedCount: 'ذخیره‌شده', recentOrders: 'آخرین سفارش‌ها',
    noOrders: 'هنوز سفارشی ثبت نکرده‌اید.', noFavorites: 'محصولی ذخیره نکرده‌اید.', saveHint: 'روی ♥ محصولات بزنید تا ذخیره شوند.',
    viewAll: 'مشاهده همه', updateProfile: 'ذخیره تغییرات', profileSaved: 'پروفایل به‌روز شد.',
    errInvalid: 'نام کاربری یا رمز عبور اشتباه است.', errDisabled: 'این حساب غیرفعال است.',
    errUsernameTaken: 'این نام کاربری قبلاً ثبت شده.', errPhoneTaken: 'این شماره موبایل قبلاً ثبت شده.',
    errIncomplete: 'لطفاً فیلدهای الزامی را پر کنید.', errPasswordMatch: 'رمز عبور و تکرار آن یکسان نیست.',
    errShortUser: 'نام کاربری حداقل ۳ کاراکتر باشد.', errShortPass: 'رمز عبور حداقل ۶ کاراکتر باشد.',
    errNotFound: 'حساب یافت نشد.', errPhoneMismatch: 'شماره موبایل با این حساب مطابقت ندارد.',
    errGeneric: 'خطایی رخ داد. دوباره تلاش کنید.', loading: 'در حال بارگذاری…', close: 'بستن',
    memberSince: 'عضو از', tracking: 'کد رهگیری', items: 'قلم', openProduct: 'مشاهده محصول',
    recoverByPhone: 'بازیابی با موبایل', backToLogin: 'بازگشت به ورود',
  },
};

const errKey = (code: string): string => {
  const map: Record<string, string> = {
    invalid_credentials: 'errInvalid',
    account_disabled: 'errDisabled',
    username_taken: 'errUsernameTaken',
    phone_taken: 'errPhoneTaken',
    incomplete: 'errIncomplete',
    short_username: 'errShortUser',
    short_password: 'errShortPass',
    not_found: 'errNotFound',
    phone_mismatch: 'errPhoneMismatch',
  };
  return map[code] || 'errGeneric';
};

export const MetaShopMemberPanel: React.FC<Props> = ({
  shop, uiLang, dir, locale, products, session, open, onClose, onSessionChange, onOpenProduct,
  money, statusLabel,
}) => {
  const t = (k: string) => STRINGS[uiLang]?.[k] || STRINGS.en[k] || k;
  const [authView, setAuthView] = useState<AuthView>('login');
  const [panelTab, setPanelTab] = useState<PanelTab>('overview');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [orders, setOrders] = useState<MetaShopOrder[] | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({
    username: '', password: '', confirm: '', fullName: '', phone: '', email: '', company: '', country: '', city: '',
  });
  const [recoverForm, setRecoverForm] = useState({ username: '', phone: '', password: '', confirm: '' });
  const [profileForm, setProfileForm] = useState({
    fullName: '', email: '', company: '', country: '', city: '',
  });

  const favoriteIds = useMemo(() => new Set(session?.favoriteProductIds || []), [session?.favoriteProductIds]);
  const favoriteProducts = useMemo(
    () => products.filter(p => favoriteIds.has(p.id)),
    [products, favoriteIds],
  );

  const loadOrders = useCallback(async () => {
    if (!session) return;
    setOrdersLoading(true);
    try {
      const rows = await lookupMetaShopOrdersForMember(shop.id, session.id, session.phone);
      setOrders(rows);
    } finally {
      setOrdersLoading(false);
    }
  }, [session, shop.id]);

  useEffect(() => {
    if (!open || !session) return;
    if (panelTab === 'orders' || panelTab === 'overview') void loadOrders();
  }, [open, session, panelTab, loadOrders]);

  useEffect(() => {
    if (!session) return;
    setProfileForm({
      fullName: session.fullName || '',
      email: '',
      company: '',
      country: '',
      city: '',
    });
    void fetchMetaShopMemberById(session.id).then(full => {
      if (!full) return;
      setProfileForm({
        fullName: full.fullName || '',
        email: full.email || '',
        company: full.company || '',
        country: full.country || '',
        city: full.city || '',
      });
    });
  }, [session?.id]);

  useEffect(() => {
    if (!open) return;
    setErr('');
    setOkMsg('');
  }, [open, authView, panelTab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const member = await loginMetaShopMember(shop.id, loginForm.username, loginForm.password);
      writeMetaShopMemberSession(member);
      onSessionChange(memberSessionToPublic(member));
      setPanelTab('overview');
    } catch (ex) {
      setErr(t(errKey(ex instanceof Error ? ex.message : 'errGeneric')));
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (regForm.password !== regForm.confirm) { setErr(t('errPasswordMatch')); return; }
    setBusy(true);
    try {
      const member = await registerMetaShopMember({
        shopId: shop.id,
        username: regForm.username,
        password: regForm.password,
        fullName: regForm.fullName,
        phone: regForm.phone,
        email: regForm.email,
        company: regForm.company,
        country: regForm.country,
        city: regForm.city,
      });
      writeMetaShopMemberSession(member);
      onSessionChange(memberSessionToPublic(member));
      setPanelTab('overview');
    } catch (ex) {
      setErr(t(errKey(ex instanceof Error ? ex.message : 'errGeneric')));
    } finally {
      setBusy(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (recoverForm.password !== recoverForm.confirm) { setErr(t('errPasswordMatch')); return; }
    setBusy(true);
    try {
      await recoverMetaShopMemberPassword(shop.id, recoverForm.username, recoverForm.phone, recoverForm.password);
      setOkMsg(t('profileSaved'));
      setAuthView('login');
      setLoginForm({ username: recoverForm.username, password: recoverForm.password });
    } catch (ex) {
      setErr(t(errKey(ex instanceof Error ? ex.message : 'errGeneric')));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    clearMetaShopMemberSession(shop.id);
    onSessionChange(null);
    setOrders(null);
    setAuthView('login');
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setErr('');
    try {
      const full = await fetchMetaShopMemberById(session.id);
      if (!full) throw new Error('not_found');
      const updated = await updateMetaShopMemberProfile(full, profileForm);
      writeMetaShopMemberSession(updated);
      onSessionChange(memberSessionToPublic(updated));
      setOkMsg(t('profileSaved'));
    } catch (ex) {
      setErr(t(errKey(ex instanceof Error ? ex.message : 'errGeneric')));
    } finally {
      setBusy(false);
    }
  };

  const handleUnfavorite = async (productId: string) => {
    if (!session) return;
    const full = await fetchMetaShopMemberById(session.id);
    if (!full) return;
    const updated = await toggleMetaShopMemberFavorite(full, productId);
    writeMetaShopMemberSession(updated);
    onSessionChange(memberSessionToPublic(updated));
  };

  if (!open) return null;

  const renderAuth = () => (
    <div className="msm-auth">
      <div className="msm-auth-tabs">
        <button type="button" className={authView === 'login' ? 'on' : ''} onClick={() => setAuthView('login')}>{t('login')}</button>
        <button type="button" className={authView === 'register' ? 'on' : ''} onClick={() => setAuthView('register')}>{t('register')}</button>
      </div>

      {authView === 'login' && (
        <form className="msm-form" onSubmit={handleLogin}>
          <label><span>{t('username')}</span><input value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} autoComplete="username" dir="ltr" required /></label>
          <label><span>{t('password')}</span><input type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} autoComplete="current-password" dir="ltr" required /></label>
          <button type="button" className="msm-link" onClick={() => setAuthView('recover')}>{t('forgot')}</button>
          <button type="submit" className="msm-primary" disabled={busy}>{busy ? t('loading') : t('signInBtn')}</button>
        </form>
      )}

      {authView === 'register' && (
        <form className="msm-form" onSubmit={handleRegister}>
          <div className="msm-grid2">
            <label><span>{t('username')} *</span><input value={regForm.username} onChange={e => setRegForm({ ...regForm, username: e.target.value })} dir="ltr" required /></label>
            <label><span>{t('fullName')} *</span><input value={regForm.fullName} onChange={e => setRegForm({ ...regForm, fullName: e.target.value })} required /></label>
            <label><span>{t('phone')} *</span><input value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })} dir="ltr" required /></label>
            <label><span>{t('email')}</span><input value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} dir="ltr" /></label>
            <label><span>{t('password')} *</span><input type="password" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} dir="ltr" required /></label>
            <label><span>{t('confirmPassword')} *</span><input type="password" value={regForm.confirm} onChange={e => setRegForm({ ...regForm, confirm: e.target.value })} dir="ltr" required /></label>
          </div>
          <button type="submit" className="msm-primary" disabled={busy}>{busy ? t('loading') : t('createBtn')}</button>
        </form>
      )}

      {authView === 'recover' && (
        <form className="msm-form" onSubmit={handleRecover}>
          <p className="msm-hint">{t('recoverHint')}</p>
          <label><span>{t('username')}</span><input value={recoverForm.username} onChange={e => setRecoverForm({ ...recoverForm, username: e.target.value })} dir="ltr" required /></label>
          <label><span>{t('phone')}</span><input value={recoverForm.phone} onChange={e => setRecoverForm({ ...recoverForm, phone: e.target.value })} dir="ltr" required /></label>
          <label><span>{t('newPassword')}</span><input type="password" value={recoverForm.password} onChange={e => setRecoverForm({ ...recoverForm, password: e.target.value })} dir="ltr" required /></label>
          <label><span>{t('confirmPassword')}</span><input type="password" value={recoverForm.confirm} onChange={e => setRecoverForm({ ...recoverForm, confirm: e.target.value })} dir="ltr" required /></label>
          <button type="button" className="msm-link" onClick={() => setAuthView('login')}>{t('backToLogin')}</button>
          <button type="submit" className="msm-primary" disabled={busy}>{busy ? t('loading') : t('resetBtn')}</button>
        </form>
      )}

      {err && <p className="msm-err">{err}</p>}
      {okMsg && <p className="msm-ok">{okMsg}</p>}
    </div>
  );

  const renderOrderCard = (o: MetaShopOrder) => (
    <article key={o.id} className="msm-order-card">
      <div className="msm-order-head">
        <b dir="ltr">{o.trackingCode}</b>
        <span className={`msm-status msm-status-${o.status}`}>{statusLabel(o.status)}</span>
      </div>
      <div className="msm-order-meta">
        {new Date(o.createdAt).toLocaleString(locale)} · {o.items.length} {t('items')} · {money(o.total)}
      </div>
      <ul className="msm-order-items">
        {o.items.slice(0, 4).map((it, i) => <li key={i}>{it.name} × {it.qty}</li>)}
        {o.items.length > 4 && <li>…</li>}
      </ul>
    </article>
  );

  const renderPanel = () => {
    if (!session) return null;
    const recent = (orders || []).slice(0, 3);
    return (
      <div className="msm-panel">
        <aside className="msm-side">
          <div className="msm-user-card">
            <div className="msm-avatar">{session.fullName.charAt(0).toUpperCase()}</div>
            <div>
              <b>{session.fullName}</b>
              <span dir="ltr">@{session.username}</span>
            </div>
          </div>
          <nav className="msm-nav">
            {(['overview', 'orders', 'favorites', 'profile'] as PanelTab[]).map(tab => (
              <button key={tab} type="button" className={panelTab === tab ? 'on' : ''} onClick={() => setPanelTab(tab)}>
                {t(tab)}
                {tab === 'favorites' && favoriteIds.size > 0 && <em>{favoriteIds.size}</em>}
                {tab === 'orders' && orders && orders.length > 0 && <em>{orders.length}</em>}
              </button>
            ))}
          </nav>
          <button type="button" className="msm-logout" onClick={handleLogout}>{t('logout')}</button>
        </aside>

        <div className="msm-main">
          {panelTab === 'overview' && (
            <div className="msm-overview">
              <h3>{t('welcome')}, {session.fullName.split(' ')[0]}</h3>
              <div className="msm-stats">
                <div><b>{orders?.length ?? '—'}</b><span>{t('orderCount')}</span></div>
                <div><b>{favoriteIds.size}</b><span>{t('savedCount')}</span></div>
              </div>
              <h4>{t('recentOrders')}</h4>
              {ordersLoading ? <p className="msm-muted">{t('loading')}</p>
                : recent.length ? recent.map(renderOrderCard)
                : <p className="msm-muted">{t('noOrders')}</p>}
              {orders && orders.length > 3 && (
                <button type="button" className="msm-link" onClick={() => setPanelTab('orders')}>{t('viewAll')}</button>
              )}
            </div>
          )}

          {panelTab === 'orders' && (
            <div className="msm-orders">
              <h3>{t('orders')}</h3>
              {ordersLoading ? <p className="msm-muted">{t('loading')}</p>
                : orders?.length ? orders.map(renderOrderCard)
                : <p className="msm-muted">{t('noOrders')}</p>}
            </div>
          )}

          {panelTab === 'favorites' && (
            <div className="msm-favorites">
              <h3>{t('favorites')}</h3>
              {!favoriteProducts.length ? (
                <p className="msm-muted">{t('noFavorites')} {t('saveHint')}</p>
              ) : (
                <div className="msm-fav-list">
                  {favoriteProducts.map(p => {
                    const thumb = metaShopProductImageUrl(productMainImage(p), 96);
                    return (
                      <article key={p.id} className="msm-fav-row">
                        <button type="button" className="msm-fav-thumb" onClick={() => onOpenProduct?.(p.id)}>
                          {thumb ? (
                            <img src={thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="msm-fav-ph">{p.name.charAt(0)}</span>
                          )}
                        </button>
                        <button type="button" className="msm-fav-info" onClick={() => onOpenProduct?.(p.id)}>
                          <b>{p.name}</b>
                          {p.sku && <span className="msm-fav-sku" dir="ltr">{p.sku}</span>}
                        </button>
                        <button
                          type="button"
                          className="msm-fav-heart on"
                          onClick={() => void handleUnfavorite(p.id)}
                          title={t('savedProduct')}
                          aria-label={t('savedProduct')}
                        >
                          <HeartIcon filled size={20} />
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {panelTab === 'profile' && (
            <div className="msm-profile">
              <h3>{t('profile')}</h3>
              <form className="msm-form" onSubmit={handleProfileSave}>
                <div className="msm-grid2">
                  <label><span>{t('fullName')}</span><input value={profileForm.fullName} onChange={e => setProfileForm({ ...profileForm, fullName: e.target.value })} required /></label>
                  <label><span>{t('phone')}</span><input value={session.phone} disabled dir="ltr" /></label>
                  <label><span>{t('email')}</span><input value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} dir="ltr" /></label>
                  <label><span>{t('company')}</span><input value={profileForm.company} onChange={e => setProfileForm({ ...profileForm, company: e.target.value })} /></label>
                  <label><span>{t('country')}</span><input value={profileForm.country} onChange={e => setProfileForm({ ...profileForm, country: e.target.value })} /></label>
                  <label><span>{t('city')}</span><input value={profileForm.city} onChange={e => setProfileForm({ ...profileForm, city: e.target.value })} /></label>
                </div>
                <button type="submit" className="msm-primary" disabled={busy}>{busy ? t('loading') : t('updateProfile')}</button>
              </form>
              {okMsg && <p className="msm-ok">{okMsg}</p>}
              {err && <p className="msm-err">{err}</p>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="msm-overlay" dir={dir} onClick={onClose}>
      <div className="msm-modal" onClick={e => e.stopPropagation()}>
        <header className="msm-header">
          <h2>{t('myAccount')}</h2>
          <button type="button" className="msm-close" onClick={onClose} aria-label={t('close')}>×</button>
        </header>
        {session ? renderPanel() : renderAuth()}
      </div>
      <style>{MSM_CSS}</style>
    </div>
  );
};

/** Export favorite toggle for product cards */
export async function toggleMemberFavorite(
  session: MetaShopMemberSession,
  productId: string,
  onSessionChange: (s: MetaShopMemberSession) => void,
): Promise<boolean> {
  const full = await fetchMetaShopMemberById(session.id);
  if (!full) return false;
  const updated = await toggleMetaShopMemberFavorite(full, productId);
  writeMetaShopMemberSession(updated);
  onSessionChange(memberSessionToPublic(updated));
  return updated.favoriteProductIds?.includes(productId) ?? false;
}

const MSM_CSS = `
.msm-overlay { position:fixed; inset:0; z-index:200; background:rgba(15,23,42,.45); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:16px; }
.msm-modal { width:min(920px,100%); max-height:min(88vh,900px); background:#fff; border-radius:20px; box-shadow:0 24px 80px rgba(0,0,0,.18); display:flex; flex-direction:column; overflow:hidden; }
.msm-header { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid #e8eaed; }
.msm-header h2 { margin:0; font-size:1.15rem; font-weight:800; color:#111827; }
.msm-close { border:0; background:#f3f4f6; width:36px; height:36px; border-radius:10px; font-size:1.4rem; line-height:1; cursor:pointer; color:#374151; }
.msm-auth { padding:20px 22px 24px; overflow:auto; }
.msm-auth-tabs { display:flex; gap:8px; margin-bottom:18px; }
.msm-auth-tabs button { flex:1; border:1px solid #e5e7eb; background:#f9fafb; padding:10px; border-radius:12px; font-weight:700; cursor:pointer; }
.msm-auth-tabs button.on { background:var(--ms-primary,#2563eb); color:#fff; border-color:transparent; }
.msm-form { display:flex; flex-direction:column; gap:12px; }
.msm-form label { display:flex; flex-direction:column; gap:6px; font-size:.82rem; color:#6b7280; font-weight:600; }
.msm-form input { border:1px solid #d1d5db; border-radius:10px; padding:10px 12px; font-size:.95rem; }
.msm-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.msm-primary { border:0; background:var(--ms-primary,#2563eb); color:#fff; padding:12px 16px; border-radius:12px; font-weight:800; cursor:pointer; margin-top:4px; }
.msm-primary:disabled { opacity:.6; cursor:wait; }
.msm-link { border:0; background:none; color:var(--ms-primary,#2563eb); font-weight:700; cursor:pointer; text-align:start; padding:0; }
.msm-hint { margin:0 0 8px; color:#6b7280; font-size:.88rem; line-height:1.5; }
.msm-err { color:#dc2626; font-size:.88rem; margin:8px 0 0; }
.msm-ok { color:#059669; font-size:.88rem; margin:8px 0 0; }
.msm-panel { display:flex; min-height:420px; overflow:hidden; flex:1; }
.msm-side { width:240px; background:#f8fafc; border-inline-end:1px solid #e8eaed; padding:18px 14px; display:flex; flex-direction:column; gap:14px; }
.msm-user-card { display:flex; gap:12px; align-items:center; }
.msm-avatar { width:44px; height:44px; border-radius:14px; background:var(--ms-primary,#2563eb); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.1rem; flex-shrink:0; }
.msm-user-card b { display:block; font-size:.95rem; color:#111827; }
.msm-user-card span { font-size:.78rem; color:#6b7280; }
.msm-nav { display:flex; flex-direction:column; gap:6px; flex:1; }
.msm-nav button { border:0; background:transparent; text-align:start; padding:10px 12px; border-radius:10px; font-weight:700; color:#374151; cursor:pointer; display:flex; align-items:center; justify-content:space-between; }
.msm-nav button.on { background:#fff; color:var(--ms-primary,#2563eb); box-shadow:0 1px 4px rgba(0,0,0,.06); }
.msm-nav em { font-style:normal; background:#e5e7eb; border-radius:999px; padding:2px 8px; font-size:.72rem; }
.msm-logout { border:1px solid #e5e7eb; background:#fff; border-radius:10px; padding:10px; font-weight:700; color:#6b7280; cursor:pointer; }
.msm-main { flex:1; padding:20px 22px; overflow:auto; }
.msm-main h3 { margin:0 0 14px; font-size:1.05rem; }
.msm-main h4 { margin:18px 0 10px; font-size:.92rem; color:#374151; }
.msm-stats { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:8px; }
.msm-stats div { background:#f8fafc; border:1px solid #e8eaed; border-radius:14px; padding:14px; }
.msm-stats b { display:block; font-size:1.4rem; color:var(--ms-primary,#2563eb); }
.msm-stats span { font-size:.82rem; color:#6b7280; }
.msm-muted { color:#9ca3af; font-size:.9rem; }
.msm-order-card { border:1px solid #e8eaed; border-radius:14px; padding:14px; margin-bottom:10px; background:#fff; }
.msm-order-head { display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:6px; }
.msm-status { font-size:.75rem; font-weight:800; padding:4px 8px; border-radius:999px; background:#f3f4f6; }
.msm-status-new { background:#fef3c7; color:#92400e; }
.msm-status-in_progress { background:#dbeafe; color:#1d4ed8; }
.msm-status-done { background:#d1fae5; color:#047857; }
.msm-status-cancelled { background:#fee2e2; color:#b91c1c; }
.msm-order-meta { font-size:.82rem; color:#6b7280; margin-bottom:8px; }
.msm-order-items { margin:0; padding-inline-start:18px; font-size:.85rem; color:#374151; }
.msm-fav-list { display:flex; flex-direction:column; gap:8px; }
.msm-fav-row { display:flex; align-items:center; gap:12px; padding:10px 12px; border:1px solid #e8eaed; border-radius:12px; background:#fff; }
.msm-fav-thumb { flex-shrink:0; width:56px; height:56px; border-radius:10px; overflow:hidden; border:0; padding:0; background:#f1f5f9; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.msm-fav-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.msm-fav-ph { font-size:1.1rem; font-weight:800; color:#94a3b8; }
.msm-fav-info { flex:1; min-width:0; border:0; background:none; text-align:start; padding:0; cursor:pointer; }
.msm-fav-info b { display:block; font-size:.88rem; color:#111827; line-height:1.35; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.msm-fav-sku { display:block; font-size:.75rem; color:#9ca3af; margin-top:2px; }
.msm-fav-heart { flex-shrink:0; border:0; background:none; color:#ef4444; padding:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:8px; }
.msm-fav-heart:hover { background:#fef2f2; }
@media (max-width:720px) {
  .msm-panel { flex-direction:column; }
  .msm-side { width:100%; border-inline-end:0; border-bottom:1px solid #e8eaed; }
  .msm-nav { flex-direction:row; overflow:auto; }
  .msm-nav button { white-space:nowrap; }
  .msm-grid2 { grid-template-columns:1fr; }
}
`;
