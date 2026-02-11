
import React from 'react';
import { Period } from '../types';

interface PeriodCardProps {
  period: Period;
  currentTime: Date;
  isNext?: boolean;
  isActive?: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: () => void;
}

const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const format12h = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const getTimeInMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const getDurationMinutes = (start: string, end: string) => {
  let startTotal = getTimeInMinutes(start);
  let endTotal = getTimeInMinutes(end);

  if (endTotal < startTotal) {
    endTotal += 24 * 60; // Handle overnight periods
  }

  return endTotal - startTotal;
};

const PeriodCard: React.FC<PeriodCardProps> = ({
  period,
  currentTime,
  isNext,
  isActive,
  onToggle,
  onDelete,
  onEdit
}) => {
  const duration = getDurationMinutes(period.startTime, period.endTime);
  const currentDay = currentTime.getDay();
  const runsToday = period.repeatDays.includes(currentDay);

  // Calculate Progress
  let progressPercent = 0;
  if (isActive && runsToday) {
    const startTotal = getTimeInMinutes(period.startTime);
    let currentTotal = currentTime.getHours() * 60 + currentTime.getMinutes();

    // Adjust if period crosses midnight
    const endTotal = startTotal + duration;
    if (currentTotal < startTotal && endTotal >= 24 * 60) {
      currentTotal += 24 * 60;
    }

    progressPercent = Math.min(100, Math.max(0, ((currentTotal - startTotal) / duration) * 100));
  }

  const triggerHaptic = (ms: number) => {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  const handleToggle = () => {
    triggerHaptic(10);
    onToggle(period.id);
  };

  const handleDelete = () => {
    triggerHaptic(30);
    onDelete(period.id);
  };

  const handleEdit = () => {
    triggerHaptic(15);
    onEdit();
  };

  return (
    <div
      className={`relative p-4 rounded-2xl transition-all duration-500 transform ${!runsToday
        ? 'opacity-50 grayscale bg-slate-50 border-dashed border-slate-200'
        : isActive
          ? 'active-period-glow active-period-gradient ring-2 ring-indigo-500/50 scale-[1.02] z-10 shadow-xl'
          : isNext
            ? 'bg-emerald-50/30 border border-emerald-200/50 ring-1 ring-emerald-100 shadow-md'
            : 'bg-white shadow-sm border border-slate-100 hover:border-slate-200'
        } active:scale-[0.98] cursor-pointer active:shadow-inner`}
    >
      {isActive && runsToday && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow-lg shadow-amber-200 flex items-center gap-1 z-20">
          <span className="animate-pulse">⏳</span>
          <span>In Progress</span>
        </div>
      )}

      {isNext && !isActive && runsToday && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow-lg shadow-emerald-200 flex items-center gap-1 z-20">
          <svg className="w-2.5 h-2.5 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" />
          </svg>
          <span>Next Up @ {period.startTime}</span>
        </div>
      )}

      {!runsToday && (
        <div className="absolute top-1 right-12">
          <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Not Today</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <div
              className="w-3.5 h-3.5 rounded-full relative z-10"
              style={{ backgroundColor: period.color }}
            />
            {isActive && runsToday && (
              <div
                className="absolute inset-0 w-3.5 h-3.5 rounded-full animate-ping opacity-75"
                style={{ backgroundColor: period.color }}
              />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-black text-base leading-tight transition-colors duration-300 ${isActive ? 'text-indigo-900' : isNext ? 'text-emerald-900' : 'text-slate-800'}`}>
                {period.name}
              </h3>
              <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md uppercase tracking-tighter">🔔 {period.ringDuration || 10}s</span>
            </div>
            <div className="flex gap-0.5 mt-0.5">
              {DAYS_SHORT.map((d, i) => (
                <span key={i} className={`text-[6px] font-black ${period.repeatDays.includes(i) ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleToggle(); }}
            className={`w-10 h-6 rounded-full transition-all duration-300 relative flex items-center shadow-inner active:scale-110 ${period.isActive ? (isActive ? 'bg-indigo-500' : isNext ? 'bg-emerald-500' : 'bg-indigo-400') : 'bg-slate-200'
              }`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute transition-all duration-300 shadow-sm transform ${period.isActive ? 'translate-x-[20px]' : 'translate-x-1'
              }`} />
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-3 text-slate-400">
        <div className="flex flex-col items-start">
          <span className="text-[7px] font-black uppercase tracking-tighter opacity-70 mb-0.5">Start</span>
          <span className={`text-lg font-black transition-colors duration-300 tabular-nums leading-none ${isActive ? 'text-indigo-600' : isNext ? 'text-emerald-600' : 'text-slate-900'}`}>
            {format12h(period.startTime)}
          </span>
        </div>

        {/* Progress Container */}
        <div className="flex-1 flex items-center justify-center relative h-6 group">
          <div className="h-2 w-full bg-slate-100/60 rounded-full overflow-hidden absolute border border-slate-50 shadow-inner">
            <div
              className={`h-full transition-all duration-1000 ease-linear rounded-r-full relative ${isActive && runsToday ? 'bg-amber-400 sand-texture' : 'bg-transparent'
                }`}
              style={{ width: `${isActive && runsToday ? progressPercent : 0}%` }}
            >
              {isActive && runsToday && progressPercent > 0 && progressPercent < 100 && (
                <div className="absolute right-0 top-0 bottom-0 w-4 overflow-visible">
                  <div className="absolute right-[-2px] top-1/2 -translate-y-1/2 w-2 h-4 bg-amber-500 rounded-full blur-[2px] opacity-60 sand-pour-indicator"></div>
                </div>
              )}
            </div>
          </div>

          <div className={`z-10 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all duration-300 ${isActive && runsToday
            ? 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-100 scale-110'
            : isNext && runsToday
              ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
              : 'bg-white text-slate-400 border-slate-100 shadow-sm'
            }`}>
            {`${duration}m`}
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[7px] font-black uppercase tracking-tighter opacity-70 mb-0.5 text-right">End</span>
          <span className={`text-lg font-black transition-colors duration-300 tabular-nums leading-none ${isActive ? 'text-indigo-600' : isNext ? 'text-emerald-600' : 'text-slate-900'}`}>
            {format12h(period.endTime)}
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex justify-end items-center h-4 space-x-4 border-t border-slate-50 pt-3">
        <button
          onClick={(e) => { e.stopPropagation(); handleEdit(); }}
          className="text-slate-300 hover:text-indigo-500 transition-all duration-200 flex items-center space-x-1.5 group active:scale-90"
        >
          <svg className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          className="text-slate-300 hover:text-red-500 transition-all duration-200 flex items-center space-x-1.5 group active:scale-90"
        >
          <svg className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Delete</span>
        </button>
      </div>
    </div>
  );
};

export default PeriodCard;
