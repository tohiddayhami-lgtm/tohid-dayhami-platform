import React, { useState, useMemo } from 'react';
import { MetaShop, MetaShopProduct, MetaShopOrder } from '../types';
import { Language } from '../App';

interface OrderData {
  customerName: string; company?: string; phone: string; email?: string;
  country?: string; city?: string; notes?: string;
  items: { productId: string; name: string; sku?: string; unit?: string; qty: number; unitPrice?: number; lineTotal?: number }[];
  total: number; currency: string;
}

interface Props {
  shop: MetaShop;
  lang: Language;
  onSubmitOrder: (data: OrderData) => Promise<string>; // returns tracking code
  onLookup?: (phone: string) => Promise<MetaShopOrder[]>;
}

const CartIcon = ({ s = 18 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
);

export const MetaShopView: React.FC<Props> = ({ shop, lang, onSubmitOrder, onLookup }) => {
  const isServices = shop.type === 'services';
  const [cart, setCart] = useState<Record<string, number>>({});
  const [activeCat, setActiveCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<MetaShopProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [step, setStep] = useState<'cart' | 'review'>('cart');
  const [form, setForm] = useState({ customerName: '', company: '', phone: '', email: '', country: '', city: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [tracking, setTracking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupResults, setLookupResults] = useState<MetaShopOrder[] | null>(null);
  const [copied, setCopied] = useState(false);

  const T = lang === 'fa';
  const t = {
    cartBtn: shop.cartButtonText || (T ? 'ثبت سفارش' : 'Place Order'),
    add: isServices ? (T ? 'افزودن به درخواست' : 'Add to request') : (T ? 'افزودن به سبد' : 'Add to cart'),
    added: T ? 'افزوده شد ✓' : 'Added ✓',
    all: T ? 'همه' : 'All',
    searchPh: shop.searchPlaceholder || (T ? 'جستجوی محصولات...' : 'Search products...'),
    empty: T ? 'موردی یافت نشد.' : 'No items found.',
    cartTitle: T ? 'سبد سفارش شما' : 'Your Order',
    cartEmpty: T ? 'هنوز موردی اضافه نشده است.' : 'No items yet.',
    qty: T ? 'تعداد' : 'Qty',
    remove: T ? 'حذف' : 'Remove',
    total: T ? 'جمع کل' : 'Total',
    yourInfo: T ? 'اطلاعات شما' : 'Your Information',
    name: T ? 'نام و نام خانوادگی' : 'Full Name',
    company: T ? 'شرکت' : 'Company',
    phone: T ? 'موبایل / واتس‌اپ' : 'Mobile / WhatsApp',
    email: T ? 'ایمیل' : 'Email',
    country: T ? 'کشور' : 'Country',
    city: T ? 'شهر / مقصد' : 'City / Destination',
    notes: T ? 'توضیحات و درخواست‌های ویژه' : 'Notes / Special requests',
    submit: shop.cartButtonText || (T ? 'ثبت نهایی سفارش' : 'Submit Order'),
    submitting: T ? 'در حال ثبت...' : 'Submitting...',
    incomplete: T ? 'لطفاً نام و شماره موبایل را وارد کنید.' : 'Please enter your name and phone.',
    err: T ? 'خطا در ثبت سفارش. دوباره تلاش کنید.' : 'Failed to submit. Please try again.',
    thanksTitle: T ? 'سفارش شما ثبت شد!' : 'Order received!',
    thanksDesc: shop.orderThankYouText || (T ? 'سفارش شما با موفقیت ثبت شد. کد رهگیری زیر را نزد خود نگه دارید؛ به‌زودی با شما تماس می‌گیریم.' : 'Your order has been received. Keep your tracking code below — we will contact you shortly.'),
    trackingCode: T ? 'کد رهگیری سفارش' : 'Order tracking code',
    copy: T ? 'کپی' : 'Copy', copied: T ? 'کپی شد' : 'Copied',
    close: T ? 'بستن' : 'Close',
    trackMy: T ? 'پیگیری سفارش‌های من' : 'Track my orders',
    trackBtn: T ? 'مشاهده' : 'View',
    noOrders: T ? 'سفارشی با این شماره یافت نشد.' : 'No orders found for this number.',
    moq: T ? 'حداقل سفارش' : 'MOQ',
    pack: T ? 'بسته' : 'Pack',
    statusNew: T ? 'جدید' : 'New', statusProg: T ? 'در حال انجام' : 'In progress', statusDone: T ? 'انجام شد' : 'Done', statusCanc: T ? 'لغو شد' : 'Cancelled',
    perPack: T ? '/ بسته' : '/ pack',
    review: T ? 'ادامه و پیش‌نمایش فاکتور' : 'Continue to invoice preview',
    invoiceTitle: T ? 'پیش‌نمایش فاکتور' : 'Invoice preview',
    editCart: T ? 'ویرایش سبد' : 'Edit cart',
    colItem: T ? 'شرح' : 'Item',
    colQty: T ? 'تعداد' : 'Qty',
    colUnit: T ? 'قیمت واحد' : 'Unit price',
    colLine: T ? 'مبلغ' : 'Amount',
    invHint: T ? 'این یک پیش‌فاکتور است؛ مبلغ نهایی پس از بررسی تأیید می‌شود.' : 'This is a proforma preview; the final amount is confirmed after review.',
    confirm: T ? 'ثبت نهایی سفارش' : 'Confirm & submit order',
  };

  const theme = shop.theme;
  const money = (n?: number) => n == null ? '' : `${shop.currency} ${(Math.round(n * 100) / 100).toLocaleString()}`;

  const products = useMemo(() => (shop.products || []).filter(p => p.active !== false), [shop.products]);
  const categories = useMemo(() => {
    if (shop.categories && shop.categories.length) return shop.categories;
    const set: string[] = [];
    products.forEach(p => { if (p.group && !set.includes(p.group)) set.push(p.group); });
    return set;
  }, [shop.categories, products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      const matchCat = activeCat === 'all' || p.group === activeCat;
      const hay = `${p.name} ${p.sku || ''} ${p.description || ''} ${p.group || ''}`.toLowerCase();
      const matchSearch = !q || hay.includes(q);
      return (q ? matchSearch : matchCat && matchSearch);
    });
  }, [products, activeCat, search]);

  const cartItems = useMemo(() => Object.keys(cart).map(id => {
    const p = products.find(x => x.id === id); if (!p) return null;
    const qty = cart[id]; const rate = p.price || 0;
    return { p, qty, rate, line: rate * qty };
  }).filter(Boolean) as { p: MetaShopProduct; qty: number; rate: number; line: number }[], [cart, products]);

  const cartCount = Object.keys(cart).length;
  const grandTotal = cartItems.reduce((a, c) => a + c.line, 0);

  const addToCart = (p: MetaShopProduct) => { setCart(c => ({ ...c, [p.id]: (c[p.id] || 0) + 1 })); };
  const setQty = (id: string, q: number) => setCart(c => { const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = q; return n; });

  const submit = async () => {
    if (!form.customerName.trim() || !form.phone.trim()) { setError(t.incomplete); return; }
    if (cartItems.length === 0) { setError(T ? 'سبد خالی است.' : 'Cart is empty.'); return; }
    setSubmitting(true); setError('');
    try {
      const code = await onSubmitOrder({
        customerName: form.customerName.trim(), company: form.company.trim() || undefined,
        phone: form.phone.trim(), email: form.email.trim() || undefined,
        country: form.country.trim() || undefined, city: form.city.trim() || undefined,
        notes: form.notes.trim() || undefined,
        items: cartItems.map(c => ({ productId: c.p.id, name: c.p.name, sku: c.p.sku, unit: c.p.unit, qty: c.qty, unitPrice: c.rate, lineTotal: c.line })),
        total: grandTotal, currency: shop.currency,
      });
      setTracking(code);
      setCart({}); setCartOpen(false);
    } catch { setError(t.err); }
    finally { setSubmitting(false); }
  };

  const doLookup = async () => {
    if (!onLookup || !lookupPhone.trim()) return;
    setLookupResults(await onLookup(lookupPhone.trim()));
  };

  const statusLabel = (s: MetaShopOrder['status']) => s === 'done' ? t.statusDone : s === 'in_progress' ? t.statusProg : s === 'cancelled' ? t.statusCanc : t.statusNew;

  const cssVars = {
    ['--ms-primary' as any]: theme.primary, ['--ms-cover' as any]: theme.cover,
    ['--ms-cover-text' as any]: theme.coverText, ['--ms-bg' as any]: theme.bg,
    ['--ms-heading' as any]: theme.heading, ['--ms-text' as any]: theme.text,
  };

  const PriceBlock = ({ p }: { p: MetaShopProduct }) => (
    <div className="ms-prices">
      {p.price != null && (
        <div className="ms-price-row">
          <span className="ms-price-amt">{money(p.price)} {p.unit && <span className="ms-price-unit">/{p.unit}</span>} {isServices && p.priceUnit && <span className="ms-price-unit">{p.priceUnit}</span>}</span>
        </div>
      )}
      {!isServices && p.packPrice != null && p.packPrice > 0 && (
        <div className="ms-price-row"><span className="ms-price-amt ms-pack">{money(p.packPrice)} <span className="ms-price-unit">{t.perPack}</span></span></div>
      )}
    </div>
  );

  return (
    <div className="ms-root" dir={T ? 'rtl' : 'ltr'} style={cssVars}>
      <style>{MS_CSS}</style>

      {/* Topbar */}
      <nav className="ms-topbar">
        <div className="ms-topbar-inner">
          <div className="ms-brand">
            {shop.logo && <img src={shop.logo} alt="" className="ms-logo" />}
            <span className="ms-name">{shop.name}</span>
          </div>
          <button className={`ms-cart-btn ${cartCount ? 'has' : ''}`} onClick={() => (setStep('cart'), setCartOpen(true))}>
            <CartIcon s={16} /><span>{t.cartBtn}</span>{cartCount > 0 && <span className="ms-badge">{cartCount}</span>}
          </button>
        </div>
      </nav>

      {/* Cover */}
      <header className="ms-cover" style={shop.coverImage ? { backgroundImage: `linear-gradient(160deg, rgba(0,0,0,.33), rgba(0,0,0,.5)), url(${shop.coverImage})` } : undefined}>
        <div className="ms-cover-inner">
          {shop.collectionText && <p className="ms-collection">{shop.collectionText}</p>}
          <h1>{shop.title || shop.name}</h1>
          {shop.subtitle && <p className="ms-subtitle">{shop.subtitle}</p>}
        </div>
      </header>

      <main className="ms-container">
        {/* Search */}
        <div className="ms-tools">
          <div className="ms-search">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.searchPh} />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
          </div>
        </div>

        {/* Category pills */}
        {categories.length > 0 && (
          <div className="ms-filter-bar">
            <button className={`ms-pill ${activeCat === 'all' ? 'active' : ''}`} onClick={() => setActiveCat('all')}>{t.all}</button>
            {categories.map(c => <button key={c} className={`ms-pill ${activeCat === c ? 'active' : ''}`} onClick={() => setActiveCat(c)}>{c}</button>)}
          </div>
        )}

        {/* Grid */}
        {filtered.length === 0 ? <p className="ms-empty">{t.empty}</p> : (
          <div className="ms-grid">
            {filtered.map(p => {
              const inCart = cart[p.id] > 0;
              return (
                <article className="ms-card" key={p.id}>
                  <div className="ms-card-img" onClick={() => setDetail(p)}>
                    {p.images && p.images[0] ? <img src={p.images[0]} alt={p.name} loading="lazy" /> : <div className="ms-noimg">{p.name.charAt(0)}</div>}
                    {p.group && <span className="ms-group-badge">{p.group}</span>}
                  </div>
                  <div className="ms-card-body">
                    <h3 className="ms-pname" onClick={() => setDetail(p)}>{p.name}</h3>
                    <div className="ms-badges">
                      {p.sku && <span className="ms-sku">{p.sku}</span>}
                      {p.stockLabel && <span className="ms-stock">{p.stockLabel}</span>}
                    </div>
                    {p.description && <p className="ms-desc">{p.description}</p>}
                    {!isServices && (p.pack || p.moq) && (
                      <div className="ms-meta">
                        {p.pack != null && <span>{t.pack}: <b>{p.pack} {p.unit}</b></span>}
                        {p.moq && <span>{t.moq}: <b>{p.moq}</b></span>}
                      </div>
                    )}
                    <PriceBlock p={p} />
                    <button className={`ms-add ${inCart ? 'in' : ''}`} onClick={() => addToCart(p)}>{inCart ? `${t.added} (${cart[p.id]})` : t.add}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {onLookup && (
          <div className="ms-track-link">
            <button onClick={() => setLookupOpen(v => !v)}>{t.trackMy}</button>
            {lookupOpen && (
              <div className="ms-track-box">
                <div className="ms-track-row">
                  <input value={lookupPhone} onChange={e => setLookupPhone(e.target.value)} placeholder={t.phone} dir="ltr" />
                  <button onClick={doLookup}>{t.trackBtn}</button>
                </div>
                {lookupResults && (lookupResults.length === 0
                  ? <p className="ms-track-empty">{t.noOrders}</p>
                  : <div className="ms-track-list">{lookupResults.map(o => (
                      <div key={o.id} className="ms-track-item">
                        <div><b>{o.trackingCode}</b> · {o.shopName}</div>
                        <div className="ms-track-sub">{new Date(o.createdAt).toLocaleString(T ? 'fa-IR' : 'en-US')} · {money(o.total)} · <span className="ms-status">{statusLabel(o.status)}</span></div>
                      </div>))}
                    </div>)}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="ms-footer">
        <div className="ms-foot-grid">
          {shop.phone && <div><b>{T ? 'تلفن:' : 'Phone:'}</b> <span dir="ltr">{shop.phone}</span></div>}
          {shop.email && <div><b>{T ? 'ایمیل:' : 'Email:'}</b> {shop.email}</div>}
          {shop.website && <div><b>{T ? 'وب‌سایت:' : 'Website:'}</b> {shop.website}</div>}
          {shop.address && <div>{shop.address}</div>}
        </div>
        {shop.footerText && <p className="ms-foot-text">{shop.footerText}</p>}
      </footer>

      {/* Product detail modal */}
      {detail && (
        <div className="ms-modal-ov" onClick={() => setDetail(null)}>
          <div className="ms-modal" onClick={e => e.stopPropagation()}>
            <button className="ms-modal-x" onClick={() => setDetail(null)}>✕</button>
            <div className="ms-modal-gal">{detail.images && detail.images[0] ? <img src={detail.images[0]} alt={detail.name} /> : <div className="ms-noimg lg">{detail.name.charAt(0)}</div>}</div>
            <div className="ms-modal-info">
              <h2>{detail.name}</h2>
              <div className="ms-badges">{detail.sku && <span className="ms-sku">{detail.sku}</span>}{detail.hsCode && <span className="ms-hs">HS: {detail.hsCode}</span>}{detail.stockLabel && <span className="ms-stock">{detail.stockLabel}</span>}</div>
              {detail.description && <p className="ms-modal-desc">{detail.description}</p>}
              {detail.colors && detail.colors.length > 0 && (
                <div className="ms-colors">{detail.colors.map((c, i) => <span key={i} className="ms-color-chip"><i style={{ background: c.hex2 ? `linear-gradient(135deg, ${c.hex}, ${c.hex2})` : c.hex }} />{c.name}</span>)}</div>
              )}
              {detail.features && detail.features.length > 0 && (
                <div className="ms-feats">{detail.features.map((f, i) => <div key={i}><span>{f.label}</span><b>{f.value}</b></div>)}</div>
              )}
              {!isServices && (detail.pack || detail.moq) && (
                <div className="ms-meta">{detail.pack != null && <span>{t.pack}: <b>{detail.pack} {detail.unit}</b></span>}{detail.moq && <span>{t.moq}: <b>{detail.moq}</b></span>}</div>
              )}
              <PriceBlock p={detail} />
              <button className="ms-add lg" onClick={() => { addToCart(detail); setDetail(null); }}>{t.add}</button>
            </div>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      <div className={`ms-cart-ov ${cartOpen ? 'open' : ''}`} onClick={() => setCartOpen(false)} />
      <aside className={`ms-drawer ${cartOpen ? 'open' : ''}`}>
        <header className="ms-drawer-head"><h2>{step === 'review' ? t.invoiceTitle : t.cartTitle}</h2><button onClick={() => setCartOpen(false)}>✕</button></header>

        {/* STEP 1 — cart items */}
        {step === 'cart' && (
          <>
            <div className="ms-drawer-body">
              {cartItems.length === 0 ? <p className="ms-cart-empty">{t.cartEmpty}</p> : cartItems.map(({ p, qty, line }) => (
                <div className="ms-citem" key={p.id}>
                  {p.images && p.images[0] ? <img src={p.images[0]} alt="" /> : <div className="ms-noimg sm">{p.name.charAt(0)}</div>}
                  <div className="ms-citem-info">
                    <div className="ms-citem-name">{p.name}</div>
                    {p.sku && <div className="ms-citem-sku">{p.sku}</div>}
                    <div className="ms-citem-row">
                      <div className="ms-qty"><button onClick={() => setQty(p.id, qty - 1)}>−</button><input value={qty} onChange={e => setQty(p.id, parseInt(e.target.value) || 0)} /><button onClick={() => setQty(p.id, qty + 1)}>+</button></div>
                      <button className="ms-rm" onClick={() => setQty(p.id, 0)}>{t.remove}</button>
                    </div>
                    {p.price != null && <div className="ms-citem-price">{money(line)}</div>}
                  </div>
                </div>
              ))}
            </div>
            {cartItems.length > 0 && (
              <div className="ms-checkout-bar">
                <div className="ms-summary"><span>{t.total}</span><b>{money(grandTotal)}</b></div>
                <button className="ms-submit" onClick={() => { setError(''); setStep('review'); }}>{t.review} →</button>
              </div>
            )}
          </>
        )}

        {/* STEP 2 — invoice preview + customer info */}
        {step === 'review' && (
          <>
            <div className="ms-drawer-body">
              <button className="ms-back" onClick={() => setStep('cart')}>← {t.editCart}</button>
              <div className="ms-invoice">
                <div className="ms-inv-head">
                  {shop.logo && <img src={shop.logo} alt="" className="ms-inv-logo" />}
                  <div><div className="ms-inv-shop">{shop.name}</div>{shop.phone && <div className="ms-inv-sub" dir="ltr">{shop.phone}</div>}</div>
                </div>
                <table className="ms-inv-table">
                  <thead><tr><th>{t.colItem}</th><th className="c">{t.colQty}</th><th className="r">{t.colUnit}</th><th className="r">{t.colLine}</th></tr></thead>
                  <tbody>
                    {cartItems.map(({ p, qty, rate, line }) => (
                      <tr key={p.id}>
                        <td>{p.name}{p.sku && <span className="ms-inv-sku"> · {p.sku}</span>}</td>
                        <td className="c">{qty}{p.unit ? ` ${p.unit}` : ''}</td>
                        <td className="r">{p.price != null ? money(rate) : '—'}</td>
                        <td className="r b">{p.price != null ? money(line) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="ms-inv-total"><span>{t.total}</span><b>{money(grandTotal)}</b></div>
                <p className="ms-inv-hint">{t.invHint}</p>
              </div>
              <div className="ms-form embedded">
                <h3>{t.yourInfo}</h3>
                <div className="ms-grid2">
                  <input placeholder={`${t.name} *`} value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
                  <input placeholder={t.company} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
                </div>
                <div className="ms-grid2">
                  <input placeholder={`${t.phone} *`} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" />
                  <input placeholder={t.email} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" />
                </div>
                <div className="ms-grid2">
                  <input placeholder={t.country} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
                  <input placeholder={t.city} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                </div>
                <textarea rows={2} placeholder={t.notes} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                {error && <p className="ms-err">{error}</p>}
              </div>
            </div>
            <div className="ms-checkout-bar">
              <button className="ms-submit" disabled={submitting} onClick={submit}>{submitting ? t.submitting : t.confirm}</button>
            </div>
          </>
        )}
      </aside>

      {/* Thank-you / tracking */}
      {tracking && (
        <div className="ms-thanks-ov">
          <div className="ms-thanks">
            <div className="ms-thanks-ic">✓</div>
            <h3>{t.thanksTitle}</h3>
            <p>{t.thanksDesc}</p>
            <div className="ms-track-code">
              <span className="ms-track-label">{t.trackingCode}</span>
              <div className="ms-track-val"><b dir="ltr">{tracking}</b>
                <button onClick={() => { navigator.clipboard.writeText(tracking); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? t.copied : t.copy}</button>
              </div>
            </div>
            <button className="ms-submit" onClick={() => { setTracking(null); setForm({ customerName: '', company: '', phone: '', email: '', country: '', city: '', notes: '' }); }}>{t.close}</button>
          </div>
        </div>
      )}
    </div>
  );
};

const MS_CSS = `
.ms-root { --ms-primary:#2d4a1a; background: var(--ms-bg,#fdfbf6); color: var(--ms-text,#2d3a24); min-height:100vh; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
.ms-root * { box-sizing:border-box; }
.ms-topbar { position:sticky; top:0; z-index:50; background:rgba(255,255,255,.97); backdrop-filter:blur(16px); border-bottom:1px solid #e8eaed; box-shadow:0 1px 8px rgba(0,0,0,.06); }
.ms-topbar-inner { max-width:1280px; margin:0 auto; padding:0 20px; height:58px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
.ms-brand { display:flex; align-items:center; gap:12px; min-width:0; }
.ms-logo { max-height:34px; width:auto; object-fit:contain; }
.ms-name { font-size:15px; font-weight:800; color:var(--ms-heading,#1f2a18); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ms-cart-btn { display:flex; align-items:center; gap:8px; background:var(--ms-primary); color:#fff; border:none; padding:9px 18px; border-radius:999px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,.15); white-space:nowrap; }
.ms-badge { background:rgba(255,255,255,.25); border-radius:999px; padding:1px 7px; font-size:11px; font-weight:800; }
.ms-cover { background:var(--ms-cover,#2d4a1a); color:var(--ms-cover-text,#fff); padding:64px 24px; text-align:center; background-size:cover; background-position:center; min-height:240px; display:flex; align-items:center; justify-content:center; }
.ms-cover-inner { max-width:740px; }
.ms-collection { font-size:13px; letter-spacing:.35em; text-transform:uppercase; opacity:.8; margin-bottom:18px; }
.ms-cover h1 { font-size:clamp(26px,5vw,52px); font-weight:900; letter-spacing:-.02em; line-height:1.05; }
.ms-subtitle { font-size:clamp(15px,2.2vw,22px); opacity:.9; font-weight:300; margin-top:8px; }
.ms-container { max-width:1280px; margin:0 auto; padding:0 20px; }
.ms-tools { max-width:760px; margin:20px auto 6px; }
.ms-search { position:relative; }
.ms-search input { width:100%; border:1.5px solid #e2e8f0; border-radius:999px; padding:11px 42px 11px 16px; font-size:13px; outline:none; box-shadow:0 8px 26px rgba(15,23,42,.06); }
.ms-search input:focus { border-color:var(--ms-primary); }
.ms-search svg { position:absolute; inset-inline-end:15px; top:50%; transform:translateY(-50%); color:#94a3b8; }
.ms-filter-bar { display:flex; gap:8px; overflow-x:auto; padding:14px 2px 4px; scrollbar-width:none; }
.ms-filter-bar::-webkit-scrollbar { display:none; }
.ms-pill { flex-shrink:0; padding:8px 18px; border-radius:999px; font-size:13px; font-weight:600; border:2px solid #e2e8f0; background:#fff; color:#64748b; cursor:pointer; white-space:nowrap; }
.ms-pill.active { background:var(--ms-primary); border-color:var(--ms-primary); color:#fff; box-shadow:0 4px 12px rgba(0,0,0,.15); }
.ms-empty { text-align:center; color:#94a3b8; padding:40px; font-size:14px; }
.ms-grid { display:grid; gap:16px; grid-template-columns:repeat(2,1fr); padding:14px 0 56px; }
@media (min-width:768px){ .ms-grid { grid-template-columns:repeat(3,1fr); } }
@media (min-width:1100px){ .ms-grid { grid-template-columns:repeat(4,1fr); } }
.ms-card { background:#fff; border:1px solid #eef0f3; border-radius:16px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.06); display:flex; flex-direction:column; transition:box-shadow .2s, transform .2s; }
.ms-card:hover { box-shadow:0 12px 32px rgba(0,0,0,.13); transform:translateY(-4px); }
.ms-card-img { position:relative; aspect-ratio:4/3; background:#f8fafc; cursor:zoom-in; overflow:hidden; }
.ms-card-img img { width:100%; height:100%; object-fit:cover; }
.ms-noimg { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:40px; font-weight:800; color:#cbd5e1; background:#f1f5f9; }
.ms-noimg.sm { width:56px; height:56px; font-size:20px; border-radius:8px; }
.ms-noimg.lg { font-size:80px; }
.ms-group-badge { position:absolute; top:10px; inset-inline-start:10px; background:var(--ms-primary); color:#fff; font-size:10px; padding:4px 10px; border-radius:999px; font-weight:700; }
.ms-card-body { padding:14px; flex:1; display:flex; flex-direction:column; gap:8px; }
.ms-pname { font-size:14px; font-weight:700; color:var(--ms-heading,#1f2a18); line-height:1.3; cursor:pointer; }
.ms-badges { display:flex; flex-wrap:wrap; gap:4px; }
.ms-sku { font-size:10px; font-family:ui-monospace,monospace; font-weight:700; padding:2px 7px; background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; border-radius:5px; }
.ms-hs { font-size:10px; font-family:ui-monospace,monospace; padding:2px 7px; color:#64748b; }
.ms-stock { font-size:10px; font-weight:900; padding:2px 8px; background:#ecfdf5; color:#047857; border:1px solid #bbf7d0; border-radius:999px; }
.ms-desc { font-size:12px; color:#64748b; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.ms-meta { display:flex; gap:10px; flex-wrap:wrap; font-size:11px; color:#64748b; padding:6px 0; border-top:1px solid #f1f5f9; }
.ms-meta b { color:#334155; }
.ms-prices { border-top:1px solid #f1f5f9; padding-top:10px; margin-top:auto; display:flex; flex-direction:column; gap:4px; }
.ms-price-amt { font-weight:800; font-size:15px; color:#0f172a; }
.ms-price-amt.ms-pack { font-size:13px; color:#475569; font-weight:700; }
.ms-price-unit { font-size:10px; font-weight:400; color:#94a3b8; }
.ms-add { margin-top:10px; padding:11px 12px; background:var(--ms-primary); color:#fff; font-size:13px; font-weight:700; border:none; border-radius:10px; cursor:pointer; width:100%; box-shadow:0 2px 8px rgba(0,0,0,.12); }
.ms-add.in { background:#10b981; }
.ms-add.lg { margin-top:18px; padding:13px; font-size:14px; }
.ms-add:active { transform:scale(.98); }
.ms-colors { display:flex; flex-wrap:wrap; gap:7px; }
.ms-color-chip { display:inline-flex; align-items:center; gap:5px; border:1px solid #e2e8f0; background:#f8fafc; border-radius:999px; padding:3px 9px 3px 4px; font-size:11px; font-weight:700; color:#475569; }
.ms-color-chip i { width:15px; height:15px; border-radius:50%; border:1px solid rgba(15,23,42,.18); }
.ms-feats { display:flex; flex-direction:column; gap:4px; }
.ms-feats > div { display:flex; justify-content:space-between; font-size:12px; border-bottom:1px solid #f1f5f9; padding:4px 0; }
.ms-feats span { color:#94a3b8; } .ms-feats b { color:#334155; }
/* footer */
.ms-footer { background:var(--ms-primary); color:#fff; padding:48px 24px 36px; text-align:center; margin-top:24px; }
.ms-foot-grid { display:grid; gap:8px; max-width:480px; margin:0 auto; font-size:15px; }
.ms-foot-grid b { font-size:13px; opacity:.85; }
.ms-foot-text { font-size:12px; opacity:.6; margin-top:20px; }
/* modal */
.ms-modal-ov { position:fixed; inset:0; z-index:9000; background:rgba(0,0,0,.72); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:16px; }
.ms-modal { background:#fff; border-radius:20px; width:100%; max-width:820px; max-height:90vh; display:flex; overflow:hidden; position:relative; }
.ms-modal-x { position:absolute; top:12px; inset-inline-end:12px; z-index:10; width:36px; height:36px; border-radius:50%; border:none; background:rgba(15,23,42,.08); color:#475569; cursor:pointer; font-size:14px; }
.ms-modal-gal { width:46%; background:#f8fafc; display:flex; align-items:center; justify-content:center; }
.ms-modal-gal img { width:100%; height:100%; max-height:90vh; object-fit:contain; }
.ms-modal-info { flex:1; overflow-y:auto; padding:28px 24px; display:flex; flex-direction:column; gap:12px; }
.ms-modal-info h2 { font-size:22px; font-weight:800; color:var(--ms-heading,#1f2a18); }
.ms-modal-desc { font-size:14px; line-height:1.75; color:var(--ms-text); white-space:pre-line; }
@media (max-width:600px){ .ms-modal { flex-direction:column; } .ms-modal-gal { width:100%; height:200px; } }
/* drawer */
.ms-cart-ov { position:fixed; inset:0; background:rgba(15,23,42,.55); backdrop-filter:blur(4px); z-index:1100; opacity:0; pointer-events:none; transition:opacity .25s; }
.ms-cart-ov.open { opacity:1; pointer-events:auto; }
.ms-drawer { position:fixed; top:0; inset-inline-end:0; height:100%; width:min(440px,100vw); background:#fff; z-index:1200; transform:translateX(100%); transition:transform .3s; display:flex; flex-direction:column; box-shadow:-20px 0 40px rgba(0,0,0,.2); }
html[dir="rtl"] .ms-drawer { transform:translateX(-100%); }
.ms-drawer.open { transform:translateX(0); }
.ms-drawer-head { flex-shrink:0; padding:18px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:var(--ms-primary); color:#fff; }
.ms-drawer-head h2 { font-size:17px; font-weight:800; }
.ms-drawer-head button { background:rgba(255,255,255,.15); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer; }
.ms-drawer-body { flex:1; overflow-y:auto; padding:16px; }
.ms-cart-empty { text-align:center; color:#94a3b8; padding:40px 20px; }
.ms-citem { display:flex; gap:12px; padding:12px 0; border-bottom:1px solid #f1f5f9; }
.ms-citem img { width:56px; height:56px; object-fit:cover; border-radius:8px; flex-shrink:0; }
.ms-citem-info { flex:1; min-width:0; }
.ms-citem-name { font-size:13px; font-weight:700; color:#0f172a; }
.ms-citem-sku { font-size:11px; font-family:ui-monospace,monospace; color:#64748b; margin-top:2px; }
.ms-citem-row { display:flex; align-items:center; gap:10px; margin-top:8px; }
.ms-qty { display:inline-flex; align-items:center; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; }
.ms-qty button { width:28px; height:28px; border:none; background:#f8fafc; color:#475569; cursor:pointer; font-size:16px; font-weight:700; }
.ms-qty input { width:46px; height:28px; border:none; text-align:center; font-size:13px; font-weight:600; outline:none; }
.ms-rm { background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:12px; }
.ms-citem-price { font-size:13px; font-weight:700; color:#0f172a; margin-top:6px; }
.ms-summary { display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:#f8fafc; border-top:1px solid #e2e8f0; font-size:16px; font-weight:800; color:#0f172a; }
.ms-form { padding:12px 16px; border-top:1px solid #e2e8f0; background:#f8fafc; max-height:46vh; overflow-y:auto; }
.ms-form h3 { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:#0f172a; margin-bottom:8px; }
.ms-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; }
.ms-form input, .ms-form textarea { width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; outline:none; font-family:inherit; background:#fff; margin-bottom:8px; }
.ms-grid2 input { margin-bottom:0; }
.ms-form input:focus, .ms-form textarea:focus { border-color:var(--ms-primary); }
.ms-err { color:#ef4444; font-size:12px; margin-bottom:8px; }
.ms-submit { width:100%; padding:12px; background:var(--ms-primary); color:#fff; border:none; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 6px 16px rgba(0,0,0,.15); }
.ms-submit:disabled { opacity:.6; cursor:not-allowed; }
.ms-checkout-bar { flex-shrink:0; padding:12px 16px; border-top:1px solid #e2e8f0; background:#fff; }
.ms-checkout-bar .ms-summary { background:transparent; border:0; padding:0 0 10px; }
.ms-back { background:none; border:none; color:#64748b; font-size:13px; cursor:pointer; margin-bottom:10px; }
.ms-form.embedded { padding:14px 0 0; border:0; background:transparent; max-height:none; }
.ms-invoice { border:1px solid #e2e8f0; border-radius:14px; padding:14px; background:#fff; }
.ms-inv-head { display:flex; align-items:center; gap:10px; padding-bottom:10px; border-bottom:2px solid var(--ms-primary); margin-bottom:10px; }
.ms-inv-logo { height:34px; object-fit:contain; }
.ms-inv-shop { font-weight:800; color:var(--ms-heading,#0f172a); font-size:14px; }
.ms-inv-sub { font-size:11px; color:#94a3b8; }
.ms-inv-table { width:100%; border-collapse:collapse; font-size:12px; }
.ms-inv-table th { text-align:start; color:#94a3b8; font-weight:600; font-size:10px; text-transform:uppercase; padding:4px 4px; border-bottom:1px solid #f1f5f9; }
.ms-inv-table td { padding:7px 4px; border-bottom:1px solid #f1f5f9; color:#334155; vertical-align:top; }
.ms-inv-table .c { text-align:center; } .ms-inv-table .r { text-align:end; } .ms-inv-table .b { font-weight:800; color:#0f172a; }
.ms-inv-sku { color:#94a3b8; font-size:10px; }
.ms-inv-total { display:flex; justify-content:space-between; align-items:center; padding-top:10px; margin-top:6px; border-top:2px solid var(--ms-primary); font-size:15px; font-weight:800; color:#0f172a; }
.ms-inv-hint { font-size:10px; color:#94a3b8; margin-top:8px; line-height:1.4; }
/* track link */
.ms-track-link { text-align:center; padding:0 0 48px; }
.ms-track-link > button { background:none; border:none; color:var(--ms-primary); font-weight:700; font-size:13px; cursor:pointer; text-decoration:underline; }
.ms-track-box { max-width:420px; margin:14px auto 0; }
.ms-track-row { display:flex; gap:8px; }
.ms-track-row input { flex:1; padding:9px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; outline:none; }
.ms-track-row button { padding:9px 18px; background:var(--ms-primary); color:#fff; border:none; border-radius:8px; font-weight:700; cursor:pointer; }
.ms-track-empty { color:#94a3b8; font-size:13px; padding:14px; }
.ms-track-list { margin-top:12px; display:flex; flex-direction:column; gap:8px; }
.ms-track-item { border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; text-align:start; font-size:13px; }
.ms-track-sub { font-size:11px; color:#64748b; margin-top:3px; }
.ms-status { font-weight:700; color:var(--ms-primary); }
/* thanks */
.ms-thanks-ov { position:fixed; inset:0; background:rgba(15,23,42,.7); z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(6px); }
.ms-thanks { background:#fff; padding:32px 28px; border-radius:24px; max-width:400px; text-align:center; }
.ms-thanks-ic { width:64px; height:64px; border-radius:50%; background:#10b981; color:#fff; font-size:32px; display:flex; align-items:center; justify-content:center; margin:0 auto 16px; }
.ms-thanks h3 { font-size:20px; font-weight:800; color:#0f172a; margin-bottom:8px; }
.ms-thanks p { font-size:14px; color:#64748b; line-height:1.6; margin-bottom:18px; }
.ms-track-code { background:#f8fafc; border:1px dashed #cbd5e1; border-radius:14px; padding:14px; margin-bottom:18px; }
.ms-track-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; }
.ms-track-val { display:flex; align-items:center; justify-content:center; gap:10px; margin-top:8px; }
.ms-track-val b { font-size:20px; font-family:ui-monospace,monospace; color:#0f172a; letter-spacing:.05em; }
.ms-track-val button { background:var(--ms-primary); color:#fff; border:none; padding:6px 14px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; }
`;
