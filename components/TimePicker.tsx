
import React, { useState, useRef, useEffect } from 'react';

interface TimePickerProps {
  value: string; // HH:mm
  onChange: (value: string) => void;
  label: string;
}

type PickerMode = 'hours' | 'minutes';

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, label }) => {
  const [h, m] = value.split(':').map(Number);
  const [mode, setMode] = useState<PickerMode>('hours');
  const [isAM, setIsAM] = useState(h < 12);
  const [isDragging, setIsDragging] = useState(false);
  const clockRef = useRef<HTMLDivElement>(null);

  const displayHour = h % 12 === 0 ? 12 : h % 12;

  const updateTimeFromAngle = (clientX: number, clientY: number) => {
    if (!clockRef.current) return;
    const rect = clockRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const x = clientX - centerX;
    const y = clientY - centerY;
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    if (mode === 'hours') {
      let hour = Math.round(angle / 30);
      if (hour === 0) hour = 12;
      
      let finalH = hour;
      if (!isAM && finalH < 12) finalH += 12;
      if (isAM && finalH === 12) finalH = 0;
      onChange(`${finalH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    } else {
      let minute = Math.round(angle / 6);
      if (minute === 60) minute = 0;
      onChange(`${h.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    updateTimeFromAngle(clientX, clientY);
  };

  const handleMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    updateTimeFromAngle(clientX, clientY);
  };

  const handleEnd = () => {
    if (isDragging && mode === 'hours') {
      // Auto switch to minutes after selecting hour
      setMode('minutes');
    }
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    } else {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, mode, h, m, isAM]);

  const toggleAmPm = (isAmVal: boolean) => {
    setIsAM(isAmVal);
    let currentH = h;
    if (isAmVal && currentH >= 12) currentH -= 12;
    if (!isAmVal && currentH < 12) currentH += 12;
    onChange(`${currentH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  };

  const handleMinuteSlider = (newM: number) => {
    onChange(`${h.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`);
    if (mode === 'hours') setMode('minutes');
  };

  const handleHourSlider = (newH12: number) => {
    let finalH = newH12;
    if (!isAM && finalH < 12) finalH += 12;
    if (isAM && finalH === 12) finalH = 0;
    onChange(`${finalH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    if (mode === 'minutes') setMode('hours');
  };

  const handRotation = mode === 'hours' ? (displayHour % 12) * 30 : m * 6;

  return (
    <div className="flex flex-col space-y-2 bg-white p-4 rounded-[30px] border border-slate-100 shadow-xl select-none">
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">{label}</label>
        <div className="flex bg-slate-50 rounded-lg p-0.5 shadow-inner scale-90 origin-right">
          <button 
            type="button" 
            onClick={() => toggleAmPm(true)} 
            className={`px-3 py-1 rounded-md text-[9px] font-black transition-all ${isAM ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
          >
            AM
          </button>
          <button 
            type="button" 
            onClick={() => toggleAmPm(false)} 
            className={`px-3 py-1 rounded-md text-[9px] font-black transition-all ${!isAM ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
          >
            PM
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center space-x-1 py-1">
        <button 
          type="button" 
          onClick={() => setMode('hours')} 
          className={`text-4xl font-black tabular-nums transition-all ${mode === 'hours' ? 'text-indigo-600' : 'text-slate-200'}`}
        >
          {displayHour.toString().padStart(2, '0')}
        </button>
        <span className="text-3xl font-black text-slate-100">:</span>
        <button 
          type="button" 
          onClick={() => setMode('minutes')} 
          className={`text-4xl font-black tabular-nums transition-all ${mode === 'minutes' ? 'text-indigo-600' : 'text-slate-200'}`}
        >
          {m.toString().padStart(2, '0')}
        </button>
      </div>

      <div className="relative flex justify-center py-2">
        <div 
          ref={clockRef} 
          onMouseDown={handleStart} 
          onTouchStart={handleStart} 
          className="relative w-48 h-48 bg-slate-50 rounded-full border-[4px] border-white shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] flex items-center justify-center cursor-pointer touch-none"
        >
          {Array.from({ length: 12 }, (_, i) => {
            const num = i + 1;
            const angle = (num * 30 - 90) * (Math.PI / 180);
            const left = 50 + 82 * Math.cos(angle) * 0.5;
            const top = 50 + 82 * Math.sin(angle) * 0.5;
            const isSelected = mode === 'hours' ? displayHour === num : m === (num * 5) % 60;
            
            return (
              <div 
                key={num} 
                className={`absolute w-6 h-6 flex items-center justify-center text-[10px] font-black rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                  isSelected ? 'text-indigo-600' : 'text-slate-300'
                }`} 
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                {mode === 'hours' ? num : (num * 5) % 60 === 0 ? '00' : (num * 5)}
              </div>
            );
          })}

          <div 
            className="absolute bottom-1/2 left-1/2 w-1 bg-indigo-500 origin-bottom transition-transform duration-75" 
            style={{ 
              height: '75px', 
              transform: `translateX(-50%) rotate(${handRotation}deg)`,
              borderTopLeftRadius: '5px',
              borderTopRightRadius: '5px'
            }}
          >
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-indigo-600 rounded-full border-2 border-white shadow-md flex items-center justify-center">
               <div className="w-1 h-1 bg-white rounded-full" />
            </div>
          </div>
          <div className="w-2 h-2 bg-slate-800 rounded-full z-20 shadow-sm" />
        </div>
      </div>
      
      {/* Minute/Hour Bar Slider */}
      <div className="px-4 py-2 bg-slate-50/50 rounded-2xl border border-slate-50 mt-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">
            {mode === 'hours' ? 'Hour Bar' : 'Minute Bar'}
          </span>
          <span className="text-[9px] font-black text-indigo-500">
            {mode === 'hours' ? displayHour : m}
          </span>
        </div>
        <input 
          type="range" 
          min={mode === 'hours' ? 1 : 0} 
          max={mode === 'hours' ? 12 : 59} 
          value={mode === 'hours' ? displayHour : m}
          onChange={(e) => mode === 'hours' ? handleHourSlider(Number(e.target.value)) : handleMinuteSlider(Number(e.target.value))}
          className="w-full accent-indigo-600 h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200"
        />
      </div>

      <div className="flex justify-center space-x-2 pb-1 mt-1">
        <button 
          type="button" 
          onClick={() => setMode('hours')}
          className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${mode === 'hours' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}
        >
          Hours
        </button>
        <button 
          type="button" 
          onClick={() => setMode('minutes')}
          className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${mode === 'minutes' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}
        >
          Minutes
        </button>
      </div>
    </div>
  );
};

export default TimePicker;
