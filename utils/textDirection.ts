/** Detect Arabic / Persian script in a string. */
export const hasRtlScript = (text: string): boolean =>
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text || '');

/** Best direction for a mixed EN/FA invoice line. */
export const textDirection = (text: string): 'rtl' | 'ltr' | 'auto' => {
  if (!text?.trim()) return 'auto';
  return hasRtlScript(text) ? 'rtl' : 'ltr';
};
