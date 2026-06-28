const STORAGE_PREFIX = 'metashop_order_alert_sound_';

export function getOrderAlertSoundEnabled(userId: string): boolean {
  try {
    const v = localStorage.getItem(STORAGE_PREFIX + userId);
    if (v === null) return true;
    return v === '1';
  } catch {
    return true;
  }
}

export function setOrderAlertSoundEnabled(userId: string, enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, enabled ? '1' : '0');
  } catch { /* ignore */ }
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    return audioCtx;
  } catch {
    return null;
  }
}

/** Distinct three-tone shop bell for new MetaShop orders. */
export function playMetaShopOrderAlertChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const t = ctx.currentTime;
  const freqs = [784, 988, 1175];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t + i * 0.12);
    const start = t + i * 0.12;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.38, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  });
}

export async function unlockOrderAlertAudio(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') await ctx.resume();
  playMetaShopOrderAlertChime();
  return ctx.state === 'running';
}

export function isOrderAlertAudioSuspended(): boolean {
  const ctx = getAudioContext();
  return ctx?.state === 'suspended';
}
