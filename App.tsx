
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Period, FixedAlarm, ViewType, ScheduleProfile, ManualBellConfig } from './types';
import { COLORS, INITIAL_PERIODS, PREBUILT_SOUNDS } from './constants';
import PeriodCard from './components/PeriodCard';
import AlarmCard from './components/AlarmCard';
import TimePicker from './components/TimePicker';
import { optimizeSchedule } from './services/geminiService';
import { BackgroundMode } from '@anuradev/capacitor-background-mode';
import { Capacitor } from '@capacitor/core';

const QUICK_DURATIONS = [30, 35, 40, 45, 50, 55, 60, 90];
const RING_DURATION_PRESETS = [5, 10, 15, 30, 45, 60];
const QUICK_NAMES = [
  "PRAYER", "1st Bell", "2nd Bell", "3rd Bell", "4th Bell",
  "Lunch Break", "5th Bell", "6th Bell", "7th Bell", "8th Bell", "DIARY"
];

const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const getTimeInMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const getDurationMinutes = (start: string, end: string) => {
  let startTotal = getTimeInMinutes(start);
  let endTotal = getTimeInMinutes(end);
  if (endTotal < startTotal) endTotal += 24 * 60;
  return endTotal - startTotal;
};

const format12h = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const FlipDigit: React.FC<{ value: string }> = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (value !== displayValue) {
      setAnimate(true);
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setAnimate(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [value, displayValue]);

  return (
    <div className="flip-digit-container w-[0.6em] justify-center text-indigo-600">
      <span key={displayValue} className={animate ? 'digit-flip-animate' : ''}>
        {value}
      </span>
    </div>
  );
};

const SoundOptionList: React.FC<{
  sounds: { id: string, name: string, url: string }[],
  selectedUrl: string,
  onSelect: (url: string) => void,
  onPreview: (url: string) => void,
  previewingUrl: string | null,
  maxHeight?: string
}> = ({ sounds, selectedUrl, onSelect, onPreview, previewingUrl, maxHeight = "160px" }) => (
  <div className="overflow-y-auto custom-scrollbar border border-slate-100 rounded-2xl bg-white divide-y divide-slate-50 shadow-inner" style={{ maxHeight }}>
    {sounds.map(s => (
      <div
        key={s.id}
        onClick={() => onSelect(s.url)}
        className={`p-3 flex items-center justify-between cursor-pointer active:bg-slate-50 ${selectedUrl === s.url ? 'bg-indigo-50/20' : ''}`}
      >
        <div className="flex items-center space-x-3 truncate">
          <div className={`w-3.5 h-3.5 rounded-full border-[2.5px] ${selectedUrl === s.url ? 'border-indigo-500 bg-indigo-500 shadow-sm' : 'border-slate-100'}`} />
          <span className={`font-bold text-[11px] truncate ${selectedUrl === s.url ? 'text-indigo-900' : 'text-slate-500'}`}>{s.name}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onPreview(s.url); }}
          className={`p-1.5 rounded-lg transition-colors ${previewingUrl === s.url ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-indigo-400 hover:bg-indigo-50'}`}
        >
          {previewingUrl === s.url ? (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
          ) : (
            <svg className="w-3 h-3" fill="center" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l4-2a1 1 0 000-1.664l-4-2z" /></svg>
          )}
        </button>
      </div>
    ))}
  </div>
);

interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText: string;
  type: 'danger' | 'info';
}

const App: React.FC = () => {
  // Global States
  const [periods, setPeriods] = useState<Period[]>(() => {
    const saved = localStorage.getItem('periods');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((p: any) => ({
        ...p,
        repeatDays: p.repeatDays || [0, 1, 2, 3, 4, 5, 6],
        soundUrl: p.soundUrl || null,
        ringDuration: p.ringDuration || 10
      }));
    }
    return INITIAL_PERIODS.map(p => ({ ...p, repeatDays: [0, 1, 2, 3, 4, 5, 6], soundUrl: null, ringDuration: 10 }));
  });

  const [fixedAlarms, setFixedAlarms] = useState<FixedAlarm[]>(() => {
    const saved = localStorage.getItem('fixedAlarms');
    return saved ? JSON.parse(saved).map((a: any) => ({ ...a, soundUrl: a.soundUrl || null, ringDuration: a.ringDuration || 10 })) : [];
  });

  const [savedProfiles, setSavedProfiles] = useState<ScheduleProfile[]>(() => {
    const saved = localStorage.getItem('scheduleProfiles');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeProfileName, setActiveProfileName] = useState<string | null>(() => {
    return localStorage.getItem('activeProfileName');
  });

  const [customSounds, setCustomSounds] = useState<{ id: string, name: string, url: string }[]>(() => {
    const saved = localStorage.getItem('customSounds');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedSound, setSelectedSound] = useState(() => {
    return localStorage.getItem('selectedSound') || PREBUILT_SOUNDS[0].url;
  });

  const [manualBellConfig, setManualBellConfig] = useState<ManualBellConfig>(() => {
    const saved = localStorage.getItem('manualBellConfig');
    return saved ? JSON.parse(saved) : { soundUrl: PREBUILT_SOUNDS[0].url, ringDuration: 5 };
  });

  const [previewingUrl, setPreviewingUrl] = useState<string | null>(null);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedProfilePreview, setSelectedProfilePreview] = useState<ScheduleProfile | null>(null);
  const [isRenamingProfile, setIsRenamingProfile] = useState(false);
  const [editingFromProfileId, setEditingFromProfileId] = useState<string | null>(null);

  // New Ringing Overlay State
  const [isRinging, setIsRinging] = useState(false);
  const [ringingLabel, setRingingLabel] = useState('');

  const [tempProfileName, setTempProfileName] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [tempUrl, setTempUrl] = useState('');
  const [tempUrlName, setTempUrlName] = useState('');

  const [view, setView] = useState<ViewType>('schedule');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);
  const [addStep, setAddStep] = useState(1);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState('');

  // Confirmation Dialog State
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    confirmText: 'Confirm',
    type: 'info'
  });

  // Period Form State
  const [newName, setNewName] = useState('');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [repeatDays, setRepeatDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [periodSound, setPeriodSound] = useState<string | null>(null);
  const [periodRingDuration, setPeriodRingDuration] = useState(10);

  // Alarm Form State
  const [newAlarmTime, setNewAlarmTime] = useState('07:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState('');
  const [newAlarmDays, setNewAlarmDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [editingAlarmId, setEditingAlarmId] = useState<string | null>(null);
  const [alarmSound, setAlarmSound] = useState<string | null>(null);
  const [alarmRingDuration, setAlarmRingDuration] = useState(10);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ringTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allSounds = useMemo(() => [...PREBUILT_SOUNDS, ...customSounds], [customSounds]);

  useEffect(() => {
    localStorage.setItem('periods', JSON.stringify(periods));
  }, [periods]);

  useEffect(() => {
    localStorage.setItem('fixedAlarms', JSON.stringify(fixedAlarms));
  }, [fixedAlarms]);

  useEffect(() => {
    localStorage.setItem('selectedSound', selectedSound);
  }, [selectedSound]);

  useEffect(() => {
    localStorage.setItem('customSounds', JSON.stringify(customSounds));
  }, [customSounds]);

  useEffect(() => {
    localStorage.setItem('scheduleProfiles', JSON.stringify(savedProfiles));
  }, [savedProfiles]);

  useEffect(() => {
    localStorage.setItem('manualBellConfig', JSON.stringify(manualBellConfig));
  }, [manualBellConfig]);

  useEffect(() => {
    const setupBackgroundMode = async () => {
      if (Capacitor.getPlatform() !== 'android') return;

      try {
        const { enabled } = await BackgroundMode.isEnabled();
        if (!enabled) {
          await BackgroundMode.enable({
            title: "Smart School Bell",
            text: "Bell monitoring active (Always On)",
            icon: 'ic_launcher',
            color: "4f46e5",
            visibility: 'secret',
            silent: false,
            resume: true
          });
        }

        // Disable battery optimizations for the webview specifically
        await BackgroundMode.disableWebViewOptimizations();

        // Check if battery optimizations are active (enabled)
        const batteryStatus = await BackgroundMode.checkBatteryOptimizations();
        if (batteryStatus.enabled) {
          // If they are enabled, prompt the user to disable them for this app
          await BackgroundMode.requestDisableBatteryOptimizations();
        }
      } catch (e) {
        console.error("Background mode setup error:", e);
      }
    };

    setupBackgroundMode();
  }, []);

  useEffect(() => {
    if (activeProfileName) {
      localStorage.setItem('activeProfileName', activeProfileName);
    } else {
      localStorage.removeItem('activeProfileName');
    }
  }, [activeProfileName]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      checkAlarms(now);
    }, 1000);
    return () => clearInterval(timer);
  }, [periods, fixedAlarms, selectedSound]);

  const checkAlarms = useCallback((now: Date) => {
    const timeStr = now.toTimeString().slice(0, 5);
    const seconds = now.getSeconds();
    const day = now.getDay();

    if (seconds === 0) {
      // 1. Check for periods starting
      const activePeriodsStarted = periods.filter(p =>
        p.isActive &&
        p.repeatDays.includes(day) &&
        p.startTime === timeStr
      );

      // 2. Check for periods ending
      const activePeriodsEnded = periods.filter(p =>
        p.isActive &&
        p.repeatDays.includes(day) &&
        p.endTime === timeStr
      );

      // 3. Check for fixed alarms
      const triggeredAlarms = fixedAlarms.filter(a =>
        a.isActive &&
        a.repeatDays.includes(day) &&
        a.time === timeStr
      );

      // Priority: Start > End > Fixed Alarm
      // This ensures that if multiple events hit at the same minute, the most relevant ringing label is shown.
      if (activePeriodsStarted.length > 0) {
        const p = activePeriodsStarted[0];
        const soundToPlay = p.soundUrl || selectedSound;
        playAlarm(soundToPlay, p.ringDuration, `${p.name} Started`);
      } else if (activePeriodsEnded.length > 0) {
        const p = activePeriodsEnded[0];
        const soundToPlay = p.soundUrl || selectedSound;
        playAlarm(soundToPlay, p.ringDuration, `${p.name} Ended`);
      } else if (triggeredAlarms.length > 0) {
        const a = triggeredAlarms[0];
        const soundToPlay = a.soundUrl || selectedSound;
        playAlarm(soundToPlay, a.ringDuration, a.label || "Alarm Triggered");
      }
    }
  }, [periods, fixedAlarms, selectedSound]);

  const stopAlarm = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.loop = false;
    }
    if (ringTimeoutRef.current) {
      window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    setIsRinging(false);
    setRingingLabel('');
    if (navigator.vibrate) navigator.vibrate(0);
  }, []);

  const playAlarm = (url?: string, durationSeconds: number = 10, label: string = "Bell Ringing") => {
    const soundUrl = url || selectedSound;
    if (audioRef.current) {
      // Clear existing if any
      if (ringTimeoutRef.current) {
        window.clearTimeout(ringTimeoutRef.current);
      }

      setPreviewingUrl(null);
      setIsRinging(true);
      setRingingLabel(label);
      audioRef.current.src = soundUrl;
      audioRef.current.currentTime = 0;
      audioRef.current.loop = true; // Loop for the duration
      audioRef.current.play().catch(e => {
        console.log("Audio play blocked", e);
        setIsRinging(false);
      });

      if (navigator.vibrate) {
        navigator.vibrate([300, 100, 300, 100, 300]);
      }

      ringTimeoutRef.current = window.setTimeout(() => {
        stopAlarm();
      }, durationSeconds * 1000);
    }
  };

  const handleManualBellToggle = () => {
    if (isRinging) {
      stopAlarm();
    } else {
      playAlarm(manualBellConfig.soundUrl, manualBellConfig.ringDuration, "Manual Bell");
    }
  };

  const testAlarm = (url: string) => {
    if (audioRef.current) {
      if (ringTimeoutRef.current) {
        window.clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
      setIsRinging(false);

      if (previewingUrl === url) {
        audioRef.current.pause();
        audioRef.current.loop = false;
        setPreviewingUrl(null);
      } else {
        setPreviewingUrl(url);
        audioRef.current.src = url;
        audioRef.current.currentTime = 0;
        audioRef.current.loop = false;
        audioRef.current.play().catch(e => {
          console.log("Audio test blocked", e);
          setPreviewingUrl(null);
        });
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const newCustomSound = {
        id: `custom-${Date.now()}`,
        name: file.name.split('.')[0],
        url: base64
      };
      setCustomSounds(prev => [...prev, newCustomSound]);
    };
    reader.readAsDataURL(file);
  };

  const handleAddUrlSound = () => {
    if (!tempUrl.trim() || !tempUrlName.trim()) return;
    const newSound = {
      id: `url-${Date.now()}`,
      name: tempUrlName,
      url: tempUrl
    };
    setCustomSounds(prev => [...prev, newSound]);
    setTempUrl('');
    setTempUrlName('');
  };

  const handleSaveProfile = () => {
    if (!newProfileName.trim() || periods.length === 0) return;
    const newProfile: ScheduleProfile = {
      id: `profile-${Date.now()}`,
      name: newProfileName,
      periods: [...periods]
    };
    setSavedProfiles(prev => [...prev, newProfile]);
    setActiveProfileName(newProfile.name); // Automatically set as active since we just saved current
    setNewProfileName('');
    setIsProfileModalOpen(false);
  };

  const requestConfirm = (config: Omit<ConfirmConfig, 'isOpen'>) => {
    setConfirmConfig({ ...config, isOpen: true });
  };

  const closeConfirm = () => {
    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
  };

  const applyProfile = (profile: ScheduleProfile) => {
    requestConfirm({
      title: 'Apply Profile',
      message: `Do you want to replace your current schedule with "${profile.name}"?`,
      confirmText: 'Apply Now',
      type: 'info',
      onConfirm: () => {
        setPeriods(profile.periods);
        setActiveProfileName(profile.name);
        setView('schedule');
        setSelectedProfilePreview(null);
        if (navigator.vibrate) navigator.vibrate(50);
        closeConfirm();
      }
    });
  };

  const deleteProfile = (id: string, name: string) => {
    requestConfirm({
      title: 'Delete Profile',
      message: `Are you sure you want to delete the profile "${name}"? This cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
      onConfirm: () => {
        setSavedProfiles(prev => prev.filter(p => p.id !== id));
        if (activeProfileName === name) setActiveProfileName(null);
        closeConfirm();
      }
    });
  };

  const handleRenameProfile = () => {
    if (!selectedProfilePreview || !tempProfileName.trim()) return;
    const updatedProfiles = savedProfiles.map(p =>
      p.id === selectedProfilePreview.id ? { ...p, name: tempProfileName } : p
    );
    if (activeProfileName === selectedProfilePreview.name) {
      setActiveProfileName(tempProfileName);
    }
    setSavedProfiles(updatedProfiles);
    setSelectedProfilePreview({ ...selectedProfilePreview, name: tempProfileName });
    setIsRenamingProfile(false);
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const calculatedEndTime = useMemo(() => {
    const [h, m] = newStartTime.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + duration, 0, 0);
    return date.toTimeString().slice(0, 5);
  }, [newStartTime, duration]);

  const handleSavePeriod = () => {
    const periodData: Partial<Period> = {
      name: newName || 'Unnamed Period',
      startTime: newStartTime,
      endTime: calculatedEndTime,
      repeatDays: repeatDays,
      soundUrl: periodSound || undefined,
      ringDuration: periodRingDuration
    };

    // Any manual change clears the "Active Profile" label
    setActiveProfileName(null);

    if (editingFromProfileId) {
      // Logic for saving back to a saved profile list
      const updatedProfiles = savedProfiles.map(prof => {
        if (prof.id === editingFromProfileId) {
          const updatedPeriods = prof.periods.map(p =>
            p.id === editingPeriodId ? { ...p, ...periodData } : p
          ).sort((a, b) => a.startTime.localeCompare(b.startTime));

          // Sync the current preview if it's the same profile
          if (selectedProfilePreview?.id === prof.id) {
            setSelectedProfilePreview({ ...prof, periods: updatedPeriods });
          }
          return { ...prof, periods: updatedPeriods };
        }
        return prof;
      });
      setSavedProfiles(updatedProfiles);
    } else {
      // Logic for saving to the active day schedule
      if (editingPeriodId) {
        setPeriods(prev => prev.map(p => p.id === editingPeriodId ? { ...p, ...periodData } : p).sort((a, b) => a.startTime.localeCompare(b.startTime)));
      } else {
        const newPeriod: Period = {
          id: Date.now().toString(),
          isActive: true,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          ...(periodData as any)
        };
        setPeriods(prev => [...prev, newPeriod].sort((a, b) => a.startTime.localeCompare(b.startTime)));
      }
    }
    closeModal();
  };

  const handleSaveAlarm = () => {
    const alarmData = {
      time: newAlarmTime,
      label: newAlarmLabel || 'Alarm',
      repeatDays: newAlarmDays,
      soundUrl: alarmSound || undefined,
      ringDuration: alarmRingDuration
    };
    if (editingAlarmId) {
      setFixedAlarms(prev => prev.map(a => a.id === editingAlarmId ? { ...a, ...alarmData } : a).sort((a, b) => a.time.localeCompare(b.time)));
    } else {
      const newAlarm: FixedAlarm = { id: Date.now().toString(), isActive: true, ...alarmData };
      setFixedAlarms(prev => [...prev, newAlarm].sort((a, b) => a.time.localeCompare(b.time)));
    }
    closeAlarmModal();
  };

  const openModal = (period?: Period, fromProfileId?: string) => {
    // If opening from a profile preview, close the preview popup first
    if (fromProfileId) {
      setSelectedProfilePreview(null);
      setIsRenamingProfile(false);
    }

    if (period) {
      setEditingPeriodId(period.id);
      setNewName(period.name);
      setNewStartTime(period.startTime);
      setDuration(getDurationMinutes(period.startTime, period.endTime));
      setRepeatDays(period.repeatDays || [0, 1, 2, 3, 4, 5, 6]);
      setPeriodSound(period.soundUrl || null);
      setPeriodRingDuration(period.ringDuration || 10);
      setEditingFromProfileId(fromProfileId || null);
    } else {
      setEditingPeriodId(null);
      setNewName('');
      setNewStartTime('09:00');
      setDuration(60);
      setRepeatDays([0, 1, 2, 3, 4, 5, 6]);
      setPeriodSound(null);
      setPeriodRingDuration(10);
      setEditingFromProfileId(null);
    }
    setAddStep(1);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPeriodId(null);
    setEditingFromProfileId(null);
  };

  const openAlarmModal = (alarm?: FixedAlarm) => {
    if (alarm) {
      setEditingAlarmId(alarm.id);
      setNewAlarmTime(alarm.time);
      setNewAlarmLabel(alarm.label);
      setNewAlarmDays(alarm.repeatDays);
      setAlarmSound(alarm.soundUrl || null);
      setAlarmRingDuration(alarm.ringDuration || 10);
    } else {
      setEditingAlarmId(null);
      setNewAlarmTime('07:00');
      setNewAlarmLabel('');
      setNewAlarmDays([0, 1, 2, 3, 4, 5, 6]);
      setAlarmSound(null);
      setAlarmRingDuration(10);
    }
    setIsAlarmModalOpen(true);
  };

  const closeAlarmModal = () => {
    setIsAlarmModalOpen(false);
    setEditingAlarmId(null);
  };

  const nowStr = useMemo(() => currentTime.toTimeString().slice(0, 5), [currentTime]);
  const currentDay = currentTime.getDay();

  const nextAlarmInfo = useMemo(() => {
    const activePeriods = periods.filter(p => p.isActive);
    const activeAlarms = fixedAlarms.filter(a => a.isActive);
    const events = [
      ...activePeriods.map(p => ({ time: p.endTime, name: p.name, label: 'Ends In', repeat: p.repeatDays })),
      ...activePeriods.map(p => ({ time: p.startTime, name: p.name, label: 'Starts In', repeat: p.repeatDays })),
      ...activeAlarms.map(a => ({ time: a.time, name: a.label, label: 'Alarm In', repeat: a.repeatDays }))
    ];
    if (events.length === 0) return null;
    let bestEvent: any = null;
    let minDiff = Infinity;
    for (let i = 0; i <= 7; i++) {
      const checkDay = (currentDay + i) % 7;
      const todayEvents = events.filter(e => e.repeat.includes(checkDay));
      for (const e of todayEvents) {
        if (i === 0 && e.time <= nowStr) continue;
        const [h, m] = e.time.split(':').map(Number);
        const targetDate = new Date(currentTime);
        targetDate.setHours(h, m, 0, 0);
        targetDate.setDate(targetDate.getDate() + i);
        const diff = targetDate.getTime() - currentTime.getTime();
        if (diff < minDiff) { minDiff = diff; bestEvent = e; }
      }
      if (bestEvent) break;
    }
    if (!bestEvent) return null;
    const minsTotal = Math.floor(minDiff / (1000 * 60));
    const hLeft = Math.floor(minsTotal / 60);
    const mLeft = minsTotal % 60;
    const sLeft = Math.floor((minDiff % (1000 * 60)) / 1000);
    return { name: bestEvent.name, label: bestEvent.label, time: bestEvent.time, countdown: `${hLeft > 0 ? hLeft + 'h ' : ''}${mLeft}m ${sLeft}s` };
  }, [periods, fixedAlarms, currentTime, nowStr, currentDay]);

  const timeParts = useMemo(() => {
    const hh = currentTime.getHours().toString().padStart(2, '0');
    const mm = currentTime.getMinutes().toString().padStart(2, '0');
    const ss = currentTime.getSeconds().toString().padStart(2, '0');
    return { hh, mm, ss };
  }, [currentTime]);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#fcfdfe] flex flex-col relative overflow-hidden shadow-2xl text-slate-900">
      <audio ref={audioRef} preload="auto" onEnded={() => setPreviewingUrl(null)} />
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />

      {/* RINGING POPUP OVERLAY */}
      {isRinging && (
        <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center p-6 bg-slate-900/90 backdrop-blur-2xl animate-in fade-in duration-500">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/20 rounded-full animate-pulse-ring" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full animate-pulse-ring [animation-delay:1s]" />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-xs">
            <div className="w-32 h-32 bg-indigo-600 rounded-[48px] shadow-2xl shadow-indigo-500/40 flex items-center justify-center animate-ring-shake">
              <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
            </div>

            <div className="space-y-3">
              <h2 className="text-4xl font-black text-white tracking-tight">{ringingLabel}</h2>
              <div className="flex items-center justify-center space-x-2 text-indigo-500 font-black text-xl tabular-nums">
                <span>{timeParts.hh}:{timeParts.mm}</span>
                <span className="text-xs opacity-80 font-bold uppercase tracking-widest bg-indigo-500/20 px-2 py-0.5 rounded-full">{currentTime.getHours() >= 12 ? 'PM' : 'AM'}</span>
              </div>
            </div>

            <div className="w-full pt-10">
              <button
                onClick={stopAlarm}
                className="w-full py-6 bg-white text-slate-900 rounded-[32px] font-black text-xl uppercase tracking-widest shadow-[0_20px_50px_rgba(0,0,0,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3 group"
              >
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white group-active:animate-ping">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
                </div>
                Stop Bell
              </button>
              <p className="mt-4 text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">Tap to dismiss</p>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG MODAL */}
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-backdrop" onClick={closeConfirm} />
          <div className="relative w-full max-w-[320px] bg-white rounded-[32px] p-8 shadow-2xl animate-modal-pop text-center">
            <div className={`mx-auto w-16 h-16 rounded-3xl flex items-center justify-center mb-6 ${confirmConfig.type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-500'}`}>
              {confirmConfig.type === 'danger' ? (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              ) : (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">{confirmConfig.title}</h3>
            <p className="text-sm font-bold text-slate-600 mb-8 leading-relaxed px-2">{confirmConfig.message}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmConfig.onConfirm}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg ${confirmConfig.type === 'danger' ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'}`}
              >
                {confirmConfig.confirmText}
              </button>
              <button
                onClick={closeConfirm}
                className="w-full py-4 bg-slate-100 text-slate-600 font-black rounded-2xl text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE PREVIEW MODAL */}
      {selectedProfilePreview && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md animate-backdrop" onClick={() => { setSelectedProfilePreview(null); setIsRenamingProfile(false); }} />
          <div className="relative w-full max-w-[340px] bg-white rounded-[40px] shadow-2xl p-6 sm:p-8 animate-modal-pop max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1 mr-4">
                {isRenamingProfile ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempProfileName}
                      onChange={(e) => setTempProfileName(e.target.value)}
                      className="flex-1 bg-slate-50 border border-indigo-200 rounded-xl px-3 py-1.5 font-black text-sm outline-none focus:ring-2 ring-indigo-500"
                      autoFocus
                      onBlur={() => { if (!tempProfileName.trim()) setIsRenamingProfile(false); }}
                    />
                    <button onClick={handleRenameProfile} className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-900 leading-tight truncate">{selectedProfilePreview.name}</h3>
                    <button
                      onClick={() => { setTempProfileName(selectedProfilePreview.name); setIsRenamingProfile(true); }}
                      className="p-1.5 text-slate-300 hover:text-indigo-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                  </div>
                )}
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Contains {selectedProfilePreview.periods.length} Bells</p>
              </div>
              <button onClick={() => { setSelectedProfilePreview(null); setIsRenamingProfile(false); }} className="p-2 text-slate-300 hover:text-slate-900 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1 py-2">
              {selectedProfilePreview.periods.map(p => (
                <div key={p.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group/bell">
                  <div className="flex items-center space-x-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <div className="flex flex-col">
                      <span className="font-black text-xs text-slate-800">{p.name}</span>
                      <span className="text-[8px] font-bold text-indigo-400">🔔 {p.ringDuration}s Ring</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-indigo-600 leading-none">{format12h(p.startTime)}</p>
                      <p className="text-[8px] font-bold text-slate-400 leading-none mt-0.5">to {format12h(p.endTime)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openModal(p, selectedProfilePreview.id); }}
                      className="p-2 bg-white text-slate-300 hover:text-indigo-600 rounded-xl shadow-sm border border-slate-100 opacity-0 group-hover/bell:opacity-100 transition-all active:scale-90"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => { setSelectedProfilePreview(null); setIsRenamingProfile(false); }} className="flex-1 p-4 bg-slate-50 text-slate-400 font-black rounded-[20px] text-xs uppercase tracking-widest">Close</button>
              <button onClick={() => applyProfile(selectedProfilePreview)} className="flex-[2] p-4 bg-indigo-600 text-white font-black rounded-[20px] shadow-xl text-xs uppercase tracking-widest">Apply Now</button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE PROFILE MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsProfileModalOpen(false)} />
          <div className="relative w-full max-w-[300px] bg-white rounded-[32px] p-6 shadow-2xl animate-modal-pop">
            <h3 className="text-lg font-black text-slate-900 mb-2">Save Schedule</h3>
            <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-wider">Name this set of bells</p>
            <input type="text" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} placeholder="Summer Schedule, Exams..." className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm font-bold mb-4 focus:ring-2 ring-indigo-500 outline-none" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setIsProfileModalOpen(false)} className="flex-1 p-3 text-slate-400 font-black text-xs uppercase tracking-widest">Cancel</button>
              <button onClick={handleSaveProfile} disabled={!newProfileName.trim()} className="flex-1 p-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg disabled:opacity-50 text-xs uppercase tracking-widest">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* FIXED ALARM MODAL */}
      {isAlarmModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-backdrop" onClick={closeAlarmModal} />
          <div className="relative w-full max-w-[340px] bg-white rounded-[40px] shadow-2xl p-6 sm:p-8 animate-modal-pop overflow-hidden max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-black text-slate-900 mb-4">{editingAlarmId ? 'Edit Alarm' : 'Set Alarm'}</h2>
            <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar">
              <TimePicker label="Select Alarm Time" value={newAlarmTime} onChange={setNewAlarmTime} />

              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ring Duration</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={alarmRingDuration}
                      onChange={(e) => setAlarmRingDuration(Number(e.target.value))}
                      className="w-12 bg-white border border-indigo-100 rounded-lg px-1.5 py-0.5 text-xs font-black text-indigo-600 text-center focus:ring-1 ring-indigo-500 outline-none"
                    />
                    <span className="text-[10px] font-black text-indigo-400">Seconds</span>
                  </div>
                </div>
                <input
                  type="range" min="1" max="120" step="1"
                  value={alarmRingDuration > 120 ? 120 : alarmRingDuration} onChange={(e) => setAlarmRingDuration(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Alarm Label</label>
                <input type="text" value={newAlarmLabel} onChange={(e) => setNewAlarmLabel(e.target.value)} placeholder="Wake up..." className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-800" />
              </div>

              <SoundOptionList sounds={allSounds} selectedUrl={alarmSound || selectedSound} onSelect={setAlarmSound} onPreview={testAlarm} previewingUrl={previewingUrl} />
              <div className="flex justify-between items-center gap-1">
                {DAYS_SHORT.map((day, idx) => (
                  <button key={idx} onClick={() => setNewAlarmDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])} className={`w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-black border ${newAlarmDays.includes(idx) ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-300 border-slate-100'}`}>{day}</button>
                ))}
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={closeAlarmModal} className="flex-1 py-4 bg-white border border-slate-100 text-slate-400 font-black rounded-[20px] text-sm">Cancel</button>
              <button onClick={handleSaveAlarm} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-[20px] shadow-xl text-sm">Save Alarm</button>
            </div>
          </div>
        </div>
      )}

      {/* URL INPUT MODAL */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsUrlModalOpen(false)} />
          <div className="relative w-full max-w-[300px] bg-white rounded-[32px] p-6 shadow-2xl animate-modal-pop">
            <h3 className="text-lg font-black text-slate-900 mb-4">Link Audio URL</h3>
            <div className="space-y-4">
              <input type="text" value={tempUrlName} onChange={(e) => setTempUrlName(e.target.value)} placeholder="Sound Name" className="w-full bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm font-bold" />
              <input type="text" value={tempUrl} onChange={(e) => setTempUrl(e.target.value)} placeholder="https://..." className="w-full bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm font-bold" />
              <div className="flex gap-2">
                <button onClick={() => setIsUrlModalOpen(false)} className="flex-1 p-3 text-slate-400 font-black">Cancel</button>
                <button onClick={() => { handleAddUrlSound(); setIsUrlModalOpen(false); }} className="flex-1 p-3 bg-indigo-600 text-white rounded-xl font-black">Link</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PERIOD MODAL POPUP */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-backdrop" onClick={closeModal} />
          <div className="relative w-full max-w-[340px] bg-white rounded-[40px] shadow-2xl p-6 sm:p-8 animate-modal-pop overflow-hidden">
            <div className="flex items-center justify-between mb-6 px-1">
              <h2 className="text-xl font-black text-slate-900">
                {editingPeriodId ? 'Edit Bell' : 'Add Bell'}
                {editingFromProfileId && <span className="block text-[8px] text-indigo-400 uppercase tracking-widest mt-1">Editing inside profile</span>}
              </h2>
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5, 6].map(s => (
                  <div key={s} className={`h-1 rounded-full transition-all duration-300 ${addStep >= s ? 'w-4 bg-indigo-600' : 'w-2 bg-slate-100'}`} />
                ))}
              </div>
            </div>
            {addStep === 1 && (
              <div className="step-enter space-y-6">
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                  <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-3">Goal / Task Title</label>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} type="text" placeholder="Focus..." className="w-full text-2xl font-black bg-transparent border-none focus:ring-0 text-slate-900 p-0" required autoFocus />
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {QUICK_NAMES.map(name => (
                      <button key={name} onClick={() => setNewName(name)} className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all border ${newName === name ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-100'}`}>{name}</button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setAddStep(2)} disabled={!newName.trim()} className="w-full p-5 bg-slate-900 text-white rounded-[24px] font-black">Next Step</button>
              </div>
            )}
            {addStep === 2 && (
              <div className="step-enter space-y-4">
                <TimePicker label="Select Start Time" value={newStartTime} onChange={setNewStartTime} />
                <div className="flex space-x-3">
                  <button onClick={() => setAddStep(1)} className="flex-1 p-5 bg-white border border-slate-100 text-slate-400 font-black rounded-[24px]">Back</button>
                  <button onClick={() => setAddStep(3)} className="flex-[2] p-5 bg-slate-900 text-white font-black rounded-[24px]">Duration</button>
                </div>
              </div>
            )}
            {addStep === 3 && (
              <div className="step-enter space-y-6">
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black text-slate-300 uppercase">Period Duration</label>
                      <span className="text-[8px] font-bold text-indigo-400">Ends at {format12h(calculatedEndTime)}</span>
                    </div>
                    <span className="text-xl font-black text-indigo-600">{duration}m</span>
                  </div>

                  {/* Duration Slider (Minute Bar) */}
                  <div className="py-2">
                    <input
                      type="range" min="1" max="180" step="1"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full accent-indigo-600 h-2 rounded-lg appearance-none cursor-pointer bg-white border border-slate-100"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[7px] font-black text-slate-300">1m</span>
                      <span className="text-[7px] font-black text-slate-300">180m</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_DURATIONS.map(d => (
                      <button key={d} onClick={() => setDuration(d)} className={`py-2 px-1 rounded-xl text-[10px] font-black border ${duration === d ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400'}`}>{d}m</button>
                    ))}
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setAddStep(2)} className="flex-1 p-5 bg-white border border-slate-100 text-slate-400 font-black rounded-[24px]">Back</button>
                  <button onClick={() => setAddStep(4)} className="flex-[2] p-5 bg-slate-900 text-white font-black rounded-[24px]">Tone</button>
                </div>
              </div>
            )}
            {addStep === 4 && (
              <div className="step-enter space-y-6">
                <SoundOptionList sounds={allSounds} selectedUrl={periodSound || selectedSound} onSelect={setPeriodSound} onPreview={testAlarm} previewingUrl={previewingUrl} />
                <div className="flex space-x-3">
                  <button onClick={() => setAddStep(3)} className="flex-1 p-5 bg-white border border-slate-100 text-slate-400 font-black rounded-[24px]">Back</button>
                  <button onClick={() => setAddStep(5)} className="flex-[2] p-5 bg-slate-900 text-white font-black rounded-[24px]">Ring Time</button>
                </div>
              </div>
            )}
            {addStep === 5 && (
              <div className="step-enter space-y-6">
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-6">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alarm Ring Duration</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={periodRingDuration}
                        onChange={(e) => setPeriodRingDuration(Number(e.target.value))}
                        className="w-14 bg-white border border-indigo-100 rounded-xl px-2 py-1 text-base font-black text-indigo-600 text-center focus:ring-2 ring-indigo-500 outline-none shadow-sm"
                      />
                      <span className="text-[10px] font-black text-indigo-400">Sec</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {RING_DURATION_PRESETS.map(s => (
                      <button key={s} onClick={() => setPeriodRingDuration(s)} className={`py-3 rounded-xl text-xs font-black border transition-all ${periodRingDuration === s ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-105' : 'bg-white text-slate-400 border-slate-100'}`}>{s}s</button>
                    ))}
                  </div>
                  <input
                    type="range" min="1" max="120" step="1"
                    value={periodRingDuration > 120 ? 120 : periodRingDuration} onChange={(e) => setPeriodRingDuration(Number(e.target.value))}
                    className="w-full accent-indigo-600 mt-2"
                  />
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setAddStep(4)} className="flex-1 p-5 bg-white border border-slate-100 text-slate-600 font-black rounded-[24px]">Back</button>
                  <button onClick={() => setAddStep(6)} className="flex-[2] p-5 bg-slate-900 text-white font-black rounded-[24px]">Repeat</button>
                </div>
              </div>
            )}
            {addStep === 6 && (
              <div className="step-enter space-y-6">
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex justify-between gap-1.5">
                  {DAYS_SHORT.map((day, idx) => (
                    <button key={idx} onClick={() => setRepeatDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])} className={`w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-black border ${repeatDays.includes(idx) ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-500 border-slate-100'}`}>{day}</button>
                  ))}
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setAddStep(5)} className="flex-1 p-5 bg-white border border-slate-100 text-slate-600 font-black rounded-[24px]">Back</button>
                  <button onClick={handleSavePeriod} className="flex-[2] p-5 bg-indigo-600 text-white font-black rounded-[24px] shadow-2xl">Save Bell</button>
                </div>
              </div>
            )}
            <button onClick={closeModal} className="mt-6 w-full text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] py-2">Cancel</button>
          </div>
        </div>
      )}

      <header className="p-4 pt-8 bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-20">
        <div className="flex justify-between items-center px-1">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Periodize</h1>
            <p className="text-slate-600 font-bold text-[8px] uppercase tracking-[0.2em] mt-1">{currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          </div>
          <div className="text-right flex items-center space-x-0.5 justify-end">
            <div className="text-2xl font-black text-indigo-600 tabular-nums flex items-baseline">
              <FlipDigit value={timeParts.hh[0]} /><FlipDigit value={timeParts.hh[1]} />
              <span className="mx-0.5 opacity-30">:</span>
              <FlipDigit value={timeParts.mm[0]} /><FlipDigit value={timeParts.mm[1]} />
              <span className="mx-0.5 opacity-30 text-sm">:</span>
              <span className="text-sm opacity-60"><FlipDigit value={timeParts.ss[0]} /><FlipDigit value={timeParts.ss[1]} /></span>
            </div>
          </div>
        </div>
        {nextAlarmInfo && (
          <div className="mt-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-[20px] flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-9 h-9 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-500 border border-indigo-50 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="truncate">
                <p className="text-[8px] font-black text-indigo-500 uppercase leading-none mb-1 tracking-wider">{nextAlarmInfo.label}</p>
                <div className="flex items-center gap-1.5 truncate">
                  <p className="text-xs font-black text-indigo-900 leading-none truncate">{nextAlarmInfo.name}</p>
                  <span className="text-[10px] font-bold text-indigo-700 opacity-90">@ {nextAlarmInfo.time}</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] font-black text-indigo-600 tabular-nums bg-white px-2.5 py-1 rounded-full border border-indigo-100 shadow-sm ml-2">
              {nextAlarmInfo.countdown}
            </p>
          </div>
        )}
      </header>

      <main className="flex-1 p-3 pb-32 overflow-y-auto custom-scrollbar">
        {view === 'schedule' && (
          <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeProfileName && (
              <div className="mb-4 px-1 flex flex-col items-start bg-indigo-50/20 p-3 rounded-2xl border border-indigo-100/30">
                <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Applied Profile</p>
                <h2 className="text-lg font-black uppercase tracking-tight active-profile-glow leading-none">
                  {activeProfileName}
                </h2>
              </div>
            )}
            <div className="flex justify-between items-center mb-2 px-1">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Your Bells</h2>
              <button
                onClick={() => setIsProfileModalOpen(true)}
                disabled={periods.length === 0}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-30 transition-all flex items-center gap-1.5"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                Save Current
              </button>
            </div>
            {periods.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-20 opacity-30 text-center">
                <h2 className="text-lg font-black text-slate-900">No Periods Yet</h2>
                <p className="text-[10px] font-bold mt-1 uppercase tracking-widest">Load a profile or add one.</p>
              </div>
            ) : periods.map(p => {
              const isToday = p.repeatDays.includes(currentDay);
              const isActive = isToday && p.isActive && nowStr >= p.startTime && nowStr < p.endTime;
              return (
                <PeriodCard
                  key={p.id}
                  period={p}
                  currentTime={currentTime}
                  isActive={isActive}
                  onToggle={(id) => {
                    setActiveProfileName(null);
                    setPeriods(prev => prev.map(item => item.id === id ? { ...item, isActive: !item.isActive } : item));
                  }}
                  onDelete={(id) => requestConfirm({
                    title: 'Delete Bell',
                    message: `Are you sure you want to remove "${p.name}"?`,
                    confirmText: 'Delete',
                    type: 'danger',
                    onConfirm: () => {
                      setActiveProfileName(null);
                      setPeriods(prev => prev.filter(item => item.id !== id));
                      closeConfirm();
                    }
                  })}
                  onEdit={() => openModal(p)}
                />
              );
            })}
          </div>
        )}

        {view === 'alarms' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center mb-4 px-1">
              <h2 className="text-lg font-black text-slate-900">Fixed Alarms</h2>
              <button onClick={() => openAlarmModal()} className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg active:scale-90 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
            {fixedAlarms.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-20 opacity-30 text-center">
                <h2 className="text-lg font-black text-slate-900">No Alarms</h2>
              </div>
            ) : fixedAlarms.map(a => (
              <AlarmCard
                key={a.id}
                alarm={a}
                onToggle={(id) => setFixedAlarms(prev => prev.map(item => item.id === id ? { ...item, isActive: !item.isActive } : item))}
                onDelete={(id) => requestConfirm({
                  title: 'Delete Alarm',
                  message: `Remove alarm for ${a.time}?`,
                  confirmText: 'Delete',
                  type: 'danger',
                  onConfirm: () => {
                    setFixedAlarms(prev => prev.filter(item => item.id !== id));
                    closeConfirm();
                  }
                })}
                onEdit={(alarm) => openAlarmModal(alarm)}
              />
            ))}
          </div>
        )}

        {view === 'ai' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-indigo-600 p-6 rounded-[30px] mb-6 text-white shadow-xl">
              <h2 className="text-xl font-black mb-1">AI Genius</h2>
              <p className="text-indigo-100 text-xs opacity-80 uppercase tracking-widest">Plan your school day in seconds.</p>
            </div>
            <textarea value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Example: Create a schedule for 6 school periods starting at 8:00 AM... " className="w-full h-40 p-5 bg-white border border-slate-100 rounded-[24px] outline-none font-bold shadow-sm placeholder-slate-400 resize-none text-slate-900 focus:ring-2 ring-indigo-500" />
            <button onClick={async () => {
              setIsAiLoading(true);
              try {
                const suggested = await optimizeSchedule(aiInput);
                const newPeriods = suggested.map((s: any, idx: number) => ({ id: `ai-${Date.now()}-${idx}`, name: s.name, startTime: s.startTime, endTime: s.endTime, isActive: true, color: COLORS[idx % COLORS.length], repeatDays: [0, 1, 2, 3, 4, 5, 6], soundUrl: null, ringDuration: 10 }));
                setActiveProfileName(null);
                setPeriods(newPeriods); setView('schedule');
              } catch (err) { alert("AI failed."); } finally { setIsAiLoading(false); }
            }} disabled={isAiLoading || !aiInput.trim()} className="w-full mt-4 p-5 bg-slate-900 text-white rounded-[24px] font-black">{isAiLoading ? "Processing..." : "Generate AI Plan"}</button>
          </div>
        )}

        {view === 'settings' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">Setup & Profiles</h2>
            </div>

            <section className="mb-8">
              <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Manual Bell Config</h3>
              <div className="bg-white rounded-[30px] border border-slate-100 p-6 shadow-sm space-y-4">
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Manual Ring Duration</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={manualBellConfig.ringDuration}
                        onChange={(e) => setManualBellConfig(prev => ({ ...prev, ringDuration: Number(e.target.value) }))}
                        className="w-12 bg-white border border-amber-100 rounded-lg px-1 py-0.5 text-xs font-black text-amber-600 text-center focus:ring-1 ring-amber-500 outline-none"
                      />
                      <span className="text-[10px] font-black text-amber-400">Sec</span>
                    </div>
                  </div>
                  <input
                    type="range" min="1" max="60" step="1"
                    value={manualBellConfig.ringDuration > 60 ? 60 : manualBellConfig.ringDuration} onChange={(e) => setManualBellConfig(prev => ({ ...prev, ringDuration: Number(e.target.value) }))}
                    className="w-full accent-amber-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Bell Tone</label>
                  <SoundOptionList sounds={allSounds} selectedUrl={manualBellConfig.soundUrl} onSelect={(url) => setManualBellConfig(prev => ({ ...prev, soundUrl: url }))} onPreview={testAlarm} previewingUrl={previewingUrl} maxHeight="120px" />
                </div>
                <button
                  onClick={handleManualBellToggle}
                  className={`w-full py-3 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${isRinging ? 'bg-red-500 shadow-red-100' : 'bg-amber-500 shadow-amber-100'}`}
                >
                  <svg className={`w-4 h-4 ${isRinging ? 'animate-bounce' : 'animate-pulse-soft'}`} fill="currentColor" viewBox="0 0 20 20">
                    {isRinging ? (
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    ) : (
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    )}
                  </svg>
                  {isRinging ? 'Stop Ringing' : 'Test This Bell'}
                </button>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Saved Lists (Profiles)</h3>
              <div className="space-y-3">
                {savedProfiles.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-slate-100 rounded-[30px] text-center">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No profiles saved yet.</p>
                  </div>
                ) : (
                  savedProfiles.map(profile => (
                    <div
                      key={profile.id}
                      onClick={() => setSelectedProfilePreview(profile)}
                      className={`p-4 rounded-[28px] border transition-all cursor-pointer flex items-center justify-between group active:scale-[0.98] ${activeProfileName === profile.name ? 'bg-indigo-50/20 border-indigo-200 shadow-md ring-1 ring-indigo-100' : 'bg-white border-slate-100 shadow-sm'}`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${activeProfileName === profile.name ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <div className="truncate flex-1">
                          <h4 className={`font-black text-sm truncate ${activeProfileName === profile.name ? 'text-indigo-900' : 'text-slate-800'}`}>{profile.name}</h4>
                          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{profile.periods.length} Bells Configured</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); applyProfile(profile); }}
                          className={`px-4 py-2 text-[9px] font-black rounded-xl uppercase tracking-widest shadow-lg active:scale-90 transition-all ${activeProfileName === profile.name ? 'bg-slate-900 text-white' : 'bg-emerald-500 text-white shadow-emerald-100'}`}
                        >
                          {activeProfileName === profile.name ? 'Active' : 'Apply'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteProfile(profile.id, profile.name); }}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Global Sounds</h3>
              <div className="bg-white rounded-[30px] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
                {allSounds.map(s => (
                  <div key={s.id} onClick={() => setSelectedSound(s.url)} className={`p-4 flex items-center justify-between cursor-pointer ${selectedSound === s.url ? 'bg-indigo-50/10' : ''}`}>
                    <div className="flex items-center space-x-3 truncate">
                      <div className={`w-4 h-4 rounded-full border-[3px] ${selectedSound === s.url ? 'border-indigo-500 bg-indigo-500' : 'border-slate-100'}`} />
                      <span className={`font-black text-xs truncate ${selectedSound === s.url ? 'text-indigo-900' : 'text-slate-500'}`}>{s.name}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); testAlarm(s.url); }} className={`p-2 rounded-xl ${previewingUrl === s.url ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-indigo-400'}`}>
                      {previewingUrl === s.url ? <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg> : <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l4-2a1 1 0 000-1.664l-4-2z" /></svg>}
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => setIsUrlModalOpen(true)} className="p-4 bg-white border border-indigo-100 text-indigo-600 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm">Link Audio URL</button>
                <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm">Upload File</button>
              </div>
            </section>
          </div>
        )}
      </main>

      {view === 'schedule' && (
        <div className="fixed bottom-24 right-6 flex flex-col items-center space-y-4 z-30">
          <button
            onClick={handleManualBellToggle}
            className={`w-12 h-12 text-white rounded-[16px] shadow-lg flex flex-col items-center justify-center active:scale-90 transition-all group overflow-hidden relative ${isRinging ? 'bg-red-500 ring-4 ring-red-100' : 'bg-amber-500'}`}
            title={isRinging ? "Stop Bell" : "Manual Bell"}
          >
            <div className="absolute inset-0 bg-white/20 scale-0 group-active:scale-100 transition-transform duration-500 rounded-full" />
            <svg className={`w-5 h-5 ${isRinging ? 'animate-bounce' : 'animate-pulse-soft'}`} fill="currentColor" viewBox="0 0 20 20">
              {isRinging ? (
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              ) : (
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              )}
            </svg>
            <span className="text-[6px] font-black uppercase tracking-tighter mt-0.5">{isRinging ? 'Stop' : 'Ring Now'}</span>
          </button>

          <button
            onClick={() => openModal()}
            className="w-14 h-14 bg-indigo-600 text-white rounded-[18px] shadow-xl flex items-center justify-center active:scale-90 transition-all"
            title="Add Bell"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
      )}

      <nav className="fixed bottom-5 left-10 right-10 bg-white/70 backdrop-blur-2xl border border-slate-100 px-6 py-3.5 flex justify-around items-center z-40 max-w-sm mx-auto rounded-[28px] shadow-2xl">
        <NavBtn active={view === 'schedule'} onClick={() => setView('schedule')} label="Day" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
        <NavBtn active={view === 'alarms'} onClick={() => setView('alarms')} label="Alarms" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <NavBtn active={view === 'ai'} onClick={() => setView('ai')} label="AI" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
        <NavBtn active={view === 'settings'} onClick={() => setView('settings')} label="Setup" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066" /></svg>} />
      </nav>
    </div>
  );
};

const NavBtn: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center space-y-0.5 transition-all duration-300 ${active ? 'text-indigo-600 scale-105' : 'text-slate-500'}`}>
    <div>{icon}</div>
    <span className={`text-[7px] font-black uppercase tracking-widest ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
  </button>
);

export default App;
