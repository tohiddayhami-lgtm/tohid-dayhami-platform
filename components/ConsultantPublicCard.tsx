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
  const initial = profile.name?.charAt(0) || '?';

  const experienceLine = profile.experienceYears
    ? fa
      ? `بیش از ${toPersianDigits(profile.experienceYears)} سال تجربه تخصصی`
      : `Over ${profile.experienceYears} years of specialized experience`
    : null;

  const projectsLine = profile.clientsServed
    ? fa
      ? `تعداد پروژه‌های مشاوره ${toPersianDigits(profile.clientsServed)} مورد`
      : `${profile.clientsServed} consultation projects`
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full aspect-[3/4] flex flex-col rounded-2xl overflow-hidden bg-white shadow-md border-2 transition-all duration-200 text-right ${
        selected
          ? 'border-violet-500 ring-4 ring-violet-200 scale-[1.02]'
          : 'border-gray-100 hover:border-violet-300 hover:shadow-xl hover:-translate-y-0.5'
      } ${className}`}
    >
      {/* عکس — بخش بالایی کارت، نه کل کارت */}
      <div className="relative flex-[5] min-h-0 bg-gradient-to-br from-violet-50 to-indigo-50 overflow-hidden">
        {profile.photo ? (
          <img
            src={profile.photo}
            alt={profile.name}
            className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl font-black text-violet-300">{initial}</span>
          </div>
        )}
        {openSlots > 0 && (
          <span className="absolute top-2 left-2 text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-sm">
            {fa ? `${toPersianDigits(openSlots)} زمان باز` : `${openSlots} open`}
          </span>
        )}
      </div>

      {/* اطلاعات اولیه — بخش پایینی کارت */}
      <div className="flex-[4] min-h-0 flex flex-col justify-center gap-1 px-3 py-2.5 sm:px-3.5 sm:py-3 border-t border-gray-100 bg-white">
        <h3 className="font-black text-sm sm:text-[15px] text-gray-900 leading-snug line-clamp-2">
          {profile.name}
        </h3>
        {profile.specialty && (
          <p className="text-xs font-bold text-violet-700 leading-snug line-clamp-1">
            {profile.specialty}
          </p>
        )}
        {experienceLine && (
          <p className="text-[11px] text-gray-600 leading-snug line-clamp-2">
            {experienceLine}
          </p>
        )}
        {projectsLine && (
          <p className="text-[10px] text-gray-500 leading-snug line-clamp-2 mt-0.5">
            {projectsLine}
          </p>
        )}
      </div>
    </button>
  );
};
