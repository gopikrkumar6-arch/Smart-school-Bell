
export interface Period {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  isActive: boolean;
  color: string;
  repeatDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  soundUrl?: string;    // Specific sound for this period
  ringDuration: number; // Duration in seconds
}

export interface FixedAlarm {
  id: string;
  time: string; // HH:mm
  label: string;
  isActive: boolean;
  repeatDays: number[];
  soundUrl?: string;    // Specific sound for this alarm
  ringDuration: number; // Duration in seconds
}

export interface ManualBellConfig {
  soundUrl: string;
  ringDuration: number;
}

export interface ScheduleProfile {
  id: string;
  name: string;
  periods: Period[];
}

export type ViewType = 'schedule' | 'alarms' | 'add' | 'settings' | 'ai';

export interface AppState {
  periods: Period[];
  fixedAlarms: FixedAlarm[];
  isAlarmEnabled: boolean;
  activePeriodId: string | null;
}
