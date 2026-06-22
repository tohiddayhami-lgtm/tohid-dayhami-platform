import React from 'react';
import type { MeetingConsultantProfile } from '../utils/meetingBookingUtils';
import { toPersianDigits } from '../utils/persianDate';

interface Props {
  profile: MeetingConsultantProfile;
  fa: boolean;
  selected?: boolean;
  openSlots?: number;
  onClick?: () => void;
  className?: string;
}

export const ConsultantPublicCard: React.FC<Props> = ({
  profile, fa, selected = false, openSlots = 0, onClick, className = '',
}) => {
  const labels = {
    clientsServed: fa ? 'متقاضی راهنمایی‌شده' : 'Clients advised',
    experience: fa ? 'سابقه کاری' : 'Experience',
    openSlots: fa ? 'زمان باز' : 'Open slots',
    year: fa ? 'سال' : 'yr',
  };

  const fmtPlus = (n: number) => (fa ? `+${toPersianDigits(n)}` : `+${n}`);
  const fmtExperience = (years: number) =>
    fa ? `+${toPersianDigits(years)} ${labels.year}` : `+${years} ${labels.year}`;

  const initial = profile.name?.charAt(0) || '?';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border-2 transition-all duration-200 text-right ${
        selected
          ? 'border-violet-500 ring-4 ring-violet-200 scale-[1.02]'
          : 'border-white/80 hover:border-violet-300 hover:shadow-xl hover:-translate-y-0.5'
      } ${className}`}
    >
      {profile.photo ? (
        <img
          src={profile.photo}
          alt={profile.name}
          className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-200 via-indigo-200 to-purple-300 flex items-center justify-center">
          <span className="text-5xl font-black text-violet-700/40">{initial}</span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />

      <div className="absolute bottom-0 left-0 right-0 p-3.5 text-white">
        <h3 className="font-black text-sm sm:text-base leading-snug mb-2.5 drop-shadow-sm">{profile.name}</h3>

        <div className="space-y-1.5">
          {profile.clientsServed != null && profile.clientsServed > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-2.5 py-1.5">
              <span className="text-[10px] font-semibold text-white/85 leading-tight">{labels.clientsServed}</span>
              <span className="text-xs font-black shrink-0">{fmtPlus(profile.clientsServed)}</span>
            </div>
          )}
          {profile.experienceYears != null && profile.experienceYears > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-2.5 py-1.5">
              <span className="text-[10px] font-semibold text-white/85 leading-tight">{labels.experience}</span>
              <span className="text-xs font-black shrink-0">{fmtExperience(profile.experienceYears)}</span>
            </div>
          )}
        </div>

        {openSlots > 0 && (
          <span className="mt-2.5 inline-block text-[10px] font-bold bg-emerald-500/90 text-white px-2.5 py-0.5 rounded-full">
            {fa ? `${toPersianDigits(openSlots)} ${labels.openSlots}` : `${openSlots} ${labels.openSlots}`}
          </span>
        )}
      </div>
    </button>
  );
};
