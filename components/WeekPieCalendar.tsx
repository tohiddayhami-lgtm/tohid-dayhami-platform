import React, { useMemo } from 'react';
import type { Meeting } from '../types';
import { getMeetingDisplayStatus, isBookableMeeting, MEETING_STATUS_STYLE } from '../utils/meetingBookingUtils';
import { getDayName, getWeekRangeLabel, toDateStr } from '../utils/weekCalendar';

const INTERNAL_HEX = '#3b82f6';
const EMPTY_HEX = '#e2e8f0';

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArc(cx: number, cy: number, rOut: number, rIn: number, a0: number, a1: number): string {
  if (a1 - a0 >= 359.99) a1 = a0 + 359.99;
  const p0 = polar(cx, cy, rOut, a0);
  const p1 = polar(cx, cy, rOut, a1);
  const p2 = polar(cx, cy, rIn, a1);
  const p3 = polar(cx, cy, rIn, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${rOut} ${rOut} 0 ${large} 1 ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${rIn} ${rIn} 0 ${large} 0 ${p3.x} ${p3.y} Z`;
}

function meetingHex(m: Meeting): string {
  if (isBookableMeeting(m)) {
    const st = getMeetingDisplayStatus(m);
    if (st !== 'internal') return MEETING_STATUS_STYLE[st].hex;
  }
  return INTERNAL_HEX;
}

function sliceFill(meetings: Meeting[]): string {
  if (!meetings.length) return EMPTY_HEX;
  const counts = { open: 0, pending: 0, confirmed: 0, internal: 0 };
  meetings.forEach(m => {
    const st = getMeetingDisplayStatus(m);
    if (st === 'open') counts.open++;
    else if (st === 'pending') counts.pending++;
    else if (st === 'confirmed') counts.confirmed++;
    else counts.internal++;
  });
  const total = meetings.length;
  if (counts.confirmed > 0 && counts.confirmed >= counts.open && counts.confirmed >= counts.pending) return MEETING_STATUS_STYLE.confirmed.hex;
  if (counts.pending > 0 && counts.pending >= counts.open) return MEETING_STATUS_STYLE.pending.hex;
  if (counts.open > 0) return MEETING_STATUS_STYLE.open.hex;
  return INTERNAL_HEX;
}

export interface WeekPieCalendarProps {
  weekDays: Date[];
  meetings: Meeting[];
  fa: boolean;
  selectedDate?: string;
  onSelectDate: (dateStr: string) => void;
  onMeetingClick?: (m: Meeting) => void;
  canBookMeeting?: (m: Meeting) => boolean;
  size?: number;
  className?: string;
}

export const WeekPieCalendar: React.FC<WeekPieCalendarProps> = ({
  weekDays, meetings, fa, selectedDate, onSelectDate, onMeetingClick, canBookMeeting, size = 320, className = '',
}) => {
  const todayStr = toDateStr(new Date());
  const cx = size / 2;
  const cy = size / 2;
  const rOut = size * 0.46;
  const rIn = size * 0.28;
  const sliceDeg = 360 / 7;
  const gap = 1.2;

  const dayData = useMemo(() => weekDays.map(day => {
    const ds = toDateStr(day);
    const dayMeetings = meetings.filter(m => m.date === ds && (m.title || m.sessionType));
    return { day, ds, meetings: dayMeetings, fill: sliceFill(dayMeetings) };
  }), [weekDays, meetings]);

  const weekStats = useMemo(() => {
    let open = 0, pending = 0, confirmed = 0, internal = 0;
    dayData.forEach(d => {
      d.meetings.forEach(m => {
        const st = getMeetingDisplayStatus(m);
        if (st === 'open') open++;
        else if (st === 'pending') pending++;
        else if (st === 'confirmed') confirmed++;
        else internal++;
      });
    });
    return { open, pending, confirmed, internal, total: open + pending + confirmed + internal };
  }, [dayData]);

  const weekLabel = getWeekRangeLabel(weekDays, fa);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm" role="img" aria-label={fa ? 'نمای هفتگی جلسات' : 'Weekly meetings pie'}>
        {dayData.map((d, i) => {
          const a0 = i * sliceDeg + gap / 2;
          const a1 = (i + 1) * sliceDeg - gap / 2;
          const isSelected = selectedDate === d.ds;
          const isToday = d.ds === todayStr;
          const mid = (a0 + a1) / 2;
          const labelPos = polar(cx, cy, (rOut + rIn) / 2, mid);
          const count = d.meetings.length;

          return (
            <g key={d.ds}>
              <path
                d={donutArc(cx, cy, rOut, rIn, a0, a1)}
                fill={d.fill}
                stroke={isSelected ? '#1e293b' : isToday ? '#6366f1' : '#fff'}
                strokeWidth={isSelected ? 3 : isToday ? 2 : 1.5}
                className="cursor-pointer transition-opacity hover:opacity-90"
                onClick={() => onSelectDate(d.ds)}
              />
              {/* mini meeting ticks on slice */}
              {d.meetings.slice(0, 6).map((m, j) => {
                const tickAngle = a0 + ((j + 1) / (Math.min(d.meetings.length, 6) + 1)) * (a1 - a0);
                const t0 = polar(cx, cy, rIn + 4, tickAngle);
                const t1 = polar(cx, cy, rOut - 6, tickAngle);
                return (
                  <line
                    key={m.id}
                    x1={t0.x} y1={t0.y} x2={t1.x} y2={t1.y}
                    stroke={meetingHex(m)}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    className="pointer-events-none opacity-90"
                  />
                );
              })}
              <text
                x={labelPos.x}
                y={labelPos.y - (count > 0 ? 5 : 0)}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none select-none"
                fill={count > 0 && d.fill !== EMPTY_HEX ? '#fff' : '#475569'}
                style={{ fontSize: size < 280 ? 11 : 13, fontWeight: 800 }}
              >
                {getDayName(d.day, fa, true)}
              </text>
              <text
                x={labelPos.x}
                y={labelPos.y + 10}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none select-none"
                fill={count > 0 && d.fill !== EMPTY_HEX ? 'rgba(255,255,255,.92)' : '#64748b'}
                style={{ fontSize: 10, fontWeight: 700 }}
              >
                {d.day.getDate()}
              </text>
              {count > 0 && (
                <text
                  x={labelPos.x}
                  y={labelPos.y + 22}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                  fill={count > 0 && d.fill !== EMPTY_HEX ? 'rgba(255,255,255,.85)' : '#94a3b8'}
                  style={{ fontSize: 9, fontWeight: 600 }}
                >
                  {count}
                </text>
              )}
            </g>
          );
        })}
        {/* center hub */}
        <circle cx={cx} cy={cy} r={rIn - 4} fill="#fff" stroke="#e2e8f0" strokeWidth={1} />
        <text x={cx} y={cy - 14} textAnchor="middle" fill="#0f172a" style={{ fontSize: 11, fontWeight: 800 }}>{weekLabel}</text>
        <text x={cx} y={cy + 2} textAnchor="middle" fill="#64748b" style={{ fontSize: 10, fontWeight: 600 }}>
          {fa ? `${weekStats.total} جلسه` : `${weekStats.total} sessions`}
        </text>
        {weekStats.total > 0 && (
          <text x={cx} y={cy + 16} textAnchor="middle" fill="#64748b" style={{ fontSize: 8, fontWeight: 600 }}>
            {weekStats.open > 0 && <tspan fill={MEETING_STATUS_STYLE.open.hex}>●{weekStats.open} </tspan>}
            {weekStats.pending > 0 && <tspan fill={MEETING_STATUS_STYLE.pending.hex}>●{weekStats.pending} </tspan>}
            {weekStats.confirmed > 0 && <tspan fill={MEETING_STATUS_STYLE.confirmed.hex}>●{weekStats.confirmed}</tspan>}
            {weekStats.internal > 0 && <tspan fill={INTERNAL_HEX}> ●{weekStats.internal}</tspan>}
          </text>
        )}
      </svg>

      {/* selected day meeting chips */}
      {selectedDate && (() => {
        const sel = dayData.find(d => d.ds === selectedDate);
        if (!sel || !sel.meetings.length) {
          return (
            <p className="text-xs text-gray-400 mt-2 text-center">
              {fa ? 'جلسه‌ای در این روز نیست — روی روز دیگری کلیک کنید' : 'No sessions this day — pick another slice'}
            </p>
          );
        }
        return (
          <div className="w-full max-w-lg mt-3 space-y-1.5">
            <p className="text-xs font-bold text-gray-600 text-center">
              {getDayName(sel.day, fa)} {sel.day.getDate()} — {sel.meetings.length} {fa ? 'جلسه' : 'sessions'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {sel.meetings.map(m => {
                const st = getMeetingDisplayStatus(m);
                const hex = meetingHex(m);
                const label = m.title || m.sessionType || (fa ? 'جلسه' : 'Session');
                const bookable = canBookMeeting?.(m);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onMeetingClick?.(m)}
                    className={`text-left px-3 py-2 rounded-xl border bg-white shadow-sm transition-shadow text-xs min-w-[140px] ${
                      bookable === false ? 'opacity-70 cursor-default border-gray-200' : 'border-gray-200 hover:shadow-md cursor-pointer'
                    } ${bookable ? 'ring-1 ring-violet-200' : ''}`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: hex }} />
                      <span className="font-bold text-gray-800 truncate">{label}</span>
                    </div>
                    <div className="text-gray-500 dir-ltr">{m.startTime} – {m.endTime}</div>
                    {st !== 'internal' && (
                      <div className="text-[10px] font-semibold mt-0.5" style={{ color: hex }}>
                        {fa ? MEETING_STATUS_STYLE[st as 'open' | 'pending' | 'confirmed'].labelFa
                          : MEETING_STATUS_STYLE[st as 'open' | 'pending' | 'confirmed'].labelEn}
                        {bookable && <span className="text-violet-600"> · {fa ? 'رزرو' : 'Book'}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
