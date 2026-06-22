import React from 'react';
import type { MeetingConsultantProfile } from '../utils/meetingBookingUtils';
import { toPersianDigits } from '../utils/persianDate';
import { ConsultantAvatar } from './ConsultantAvatar';

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
      className={`group w-full flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-white border-2 shadow-sm transition-all duration-200 text-right ${
        selected
          ? 'border-violet-500 ring-2 ring-violet-200 bg-violet-50/30'
          : 'border-gray-100 hover:border-violet-300 hover:shadow-md'
      } ${className}`}
    >
      <ConsultantAvatar name={profile.name} avatarUrl={profile.photo} size="md" ring className="shrink-0" />

      <div className="min-w-0 flex-1 text-right">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-black text-sm text-gray-900 leading-snug">{profile.name}</h3>
          {openSlots > 0 && (
            <span className="shrink-0 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {fa ? `${toPersianDigits(openSlots)} زمان باز` : `${openSlots} open`}
            </span>
          )}
        </div>
        {profile.specialty && (
          <p className="text-xs font-bold text-violet-700 mt-0.5 leading-snug">{profile.specialty}</p>
        )}
        {experienceLine && (
          <p className="text-[11px] text-gray-600 mt-1 leading-snug">{experienceLine}</p>
        )}
        {projectsLine && (
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{projectsLine}</p>
        )}
      </div>
    </button>
  );
};
