
import React from 'react';
import { FixedAlarm } from '../types';

interface AlarmCardProps {
  alarm: FixedAlarm;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (alarm: FixedAlarm) => void;
}

const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const format12h = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return { time: `${displayH}:${m.toString().padStart(2, '0')}`, ampm };
};

const AlarmCard: React.FC<AlarmCardProps> = ({ alarm, onToggle, onDelete, onEdit }) => {
  const { time, ampm } = format12h(alarm.time);

  return (
    <div
      className={`p-5 rounded-[28px] transition-all duration-300 border flex items-center justify-between shadow-sm active:scale-[0.98] cursor-pointer ${alarm.isActive
          ? 'bg-white border-indigo-100 ring-1 ring-indigo-50'
          : 'bg-slate-100 border-transparent opacity-80 grayscale'
        }`}
      onClick={() => onEdit(alarm)}
    >
      <div className="flex flex-col">
        <div className="flex items-baseline space-x-1">
          <span className={`text-3xl font-black tabular-nums transition-colors ${alarm.isActive ? 'text-slate-900' : 'text-slate-400'}`}>
            {time}
          </span>
          <span className={`text-[10px] font-black uppercase tracking-widest ${alarm.isActive ? 'text-indigo-600' : 'text-slate-500'}`}>
            {ampm}
          </span>
        </div>
        <div className="flex items-center space-x-2 mt-1">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight truncate max-w-[100px]">
            {alarm.label || 'Alarm'}
          </span>
          <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded uppercase tracking-tighter">🔔 {alarm.ringDuration || 10}s</span>
          <div className="flex gap-0.5">
            {DAYS_SHORT.map((d, i) => (
              <span key={i} className={`text-[7px] font-black ${alarm.repeatDays.includes(i) ? 'text-indigo-600' : 'text-slate-400'}`}>
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(alarm.id); }}
          className={`w-11 h-6 rounded-full transition-all duration-300 relative flex items-center shadow-inner ${alarm.isActive ? 'bg-indigo-500' : 'bg-slate-200'
            }`}
        >
          <div className={`w-4 h-4 bg-white rounded-full absolute transition-all duration-300 shadow-sm transform ${alarm.isActive ? 'translate-x-6' : 'translate-x-1'
            }`} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(alarm.id); }}
          className="p-2 text-slate-200 hover:text-red-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default AlarmCard;
