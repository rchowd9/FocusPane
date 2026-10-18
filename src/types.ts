export type UserRole = "Trainee" | "Operator" | "Supervisor";

export type AlarmStatus = "ACTIVE" | "ACKNOWLEDGED";

// Wire format shared with backend/main.py. `timestamp` is Unix seconds.
export interface AlarmEvent {
  id: string;
  tag: string;
  description: string;
  raw_severity: string;
  impact_score: number;
  timestamp: number;
  status: string;
}

// An event as tracked by the UI, including operator acknowledgement.
export interface TrackedAlarm extends AlarmEvent {
  status: AlarmStatus;
  acknowledgedAt?: number;
}

export type FeedMode = "simulated" | "websocket";
export type FeedStatus = "connecting" | "live" | "reconnecting";
