import React, { useEffect, useState } from 'react';
import { Language } from '../App';
import { ExpoDoorsLoader } from './metaverse/ExpoDoorsLoader';

interface Props {
  ready: boolean;            // becomes true when the content behind the doors is ready
  lang: Language;
  title?: string;
  subtitle?: string;
  primary?: string;
  accent?: string;
  bg?: string;
  emblem?: string;
  openingText?: string;
  children: React.ReactNode; // shown once `ready`; the doors open to reveal it
}

// Wraps any view in the grand-doors loader: closed (shimmer) while loading, then slides open
// to reveal `children`. Reusable for the bazaar directory, the expo, etc.
export const DoorsGate: React.FC<Props> = ({ ready, lang, title, subtitle, primary, accent, bg, emblem, openingText, children }) => {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Open shortly after the content is ready (so the closed doors register, then part).
  useEffect(() => { if (ready) { const t = setTimeout(() => setOpen(true), 320); return () => clearTimeout(t); } }, [ready]);
  // Remove the overlay after the slide-apart animation finishes.
  useEffect(() => { if (open) { const t = setTimeout(() => setRevealed(true), 1250); return () => clearTimeout(t); } }, [open]);
  // Safety cap — never stay stuck on the doors.
  useEffect(() => { const c = setTimeout(() => setOpen(true), 8000); return () => clearTimeout(c); }, []);

  return (
    <>
      {ready && children}
      {!revealed && <ExpoDoorsLoader lang={lang} title={title} subtitle={subtitle} open={open} primary={primary} accent={accent} bg={bg} emblem={emblem} openingText={openingText} />}
    </>
  );
};
