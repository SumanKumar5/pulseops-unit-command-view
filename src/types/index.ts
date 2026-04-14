export interface Unit {
  id: string;
  name: string;
  floor: number;
  specialty: "cardiac" | "neuro" | "surgical" | "icu" | "peds" | "oncology";
  total_beds: number;
  staffed_beds: number;
  target_census: number;
}

export interface Bed {
  id: string;
  unit_id: string;
  room: string;
  bed_number: string;
  status: "available" | "occupied" | "cleaning" | "maintenance" | "blocked";
  patient_id: string | null;
  isolation_type: "contact" | "droplet" | "airborne" | null;
  telemetry_equipped: boolean;
}

export interface VitalsEntry {
  timestamp: string;
  hr: number;
  bp_sys: number;
  bp_dia: number;
  spo2: number;
  temp: number;
  rr: number;
}

export interface NoteEntry {
  id: string;
  author: string;
  role: string;
  content: string;
  created_at: string;
}

export interface CareTeamMember {
  provider_id: string;
  name: string;
  role: string;
}

export type PatientFlag =
  | "fall_risk"
  | "isolation"
  | "dnr"
  | "high_acuity"
  | "pending_discharge"
  | "rrt_watch";

export interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: "M" | "F" | "X";
  bed_id: string | null;
  unit_id: string | null;
  status: "admitted" | "pending" | "discharging" | "boarding";
  acuity: 1 | 2 | 3 | 4 | 5;
  chief_complaint: string;
  admitting_dx: string;
  admitted_at: string;
  expected_discharge: string | null;
  los_hours: number;
  attending_provider_id: string;
  care_team: CareTeamMember[];
  flags: PatientFlag[];
  isolation_type: "contact" | "droplet" | "airborne" | null;
  fall_risk: "low" | "moderate" | "high";
  code_status: "full" | "dnr" | "dnar" | "comfort";
  vitals_history: VitalsEntry[];
  notes: NoteEntry[];
  etag: string;
}

export interface Alert {
  id: string;
  unit_id: string;
  patient_id: string | null;
  alert_type:
    | "fall_risk"
    | "deterioration"
    | "rrt_criteria"
    | "isolation_breach"
    | "medication"
    | "critical_lab";
  severity: "critical" | "high" | "medium";
  message: string;
  fired_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  auto_resolves_at: string | null;
}

export interface StaffMember {
  id: string;
  name: string;
  role: "rn" | "cna" | "md" | "np" | "charge_rn" | "transport";
  unit_id: string;
  shift: "day" | "evening" | "night";
  patient_ids: string[];
  patient_ratio: number;
}

export interface CensusSummary {
  unit_id: string;
  total_beds: number;
  occupied: number;
  available: number;
  cleaning: number;
  maintenance: number;
  blocked: number;
  avg_acuity: number;
  avg_los: number;
  nurse_ratio: number;
}

export interface CensusStats {
  by_acuity: Record<1 | 2 | 3 | 4 | 5, number>;
  by_status: Record<Patient["status"], number>;
  avg_los: number;
  patients_over_target_los: number;
  beds_available: number;
  nurse_ratio_violations: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pages: number;
  };
}

export type SSEEventType =
  | "BED_STATUS_CHANGED"
  | "PATIENT_ADMITTED"
  | "PATIENT_DISCHARGED"
  | "PATIENT_TRANSFERRED"
  | "ALERT_FIRED"
  | "ALERT_RESOLVED"
  | "TELEMETRY_SPIKE"
  | "STAFF_UPDATED"
  | "HEARTBEAT";

export interface SSEEventPayloadMap {
  BED_STATUS_CHANGED: {
    bed_id: string;
    new_status: Bed["status"];
    patient_id?: string;
  };
  PATIENT_ADMITTED: Patient;
  PATIENT_DISCHARGED: { patient_id: string; bed_id: string; timestamp: string };
  PATIENT_TRANSFERRED: {
    patient_id: string;
    from_bed: string;
    to_bed: string;
    to_unit: string;
  };
  ALERT_FIRED: Alert;
  ALERT_RESOLVED: { alert_id: string; resolved_at: string };
  TELEMETRY_SPIKE: {
    patient_id: string;
    vital: string;
    value: number;
    threshold: number;
  };
  STAFF_UPDATED: StaffMember;
  HEARTBEAT: { server_time: string };
}

export interface FilterState {
  status: Patient["status"][];
  acuity_min: number;
  acuity_max: number;
  unit_ids: string[];
  search: string;
  fall_risk: Patient["fall_risk"][];
  isolation_type: Array<Patient["isolation_type"]>;
  code_status: Patient["code_status"][];
  attending_provider_id: string;
  los_threshold_hours: number | null;
  flags: PatientFlag[];
}

export interface SortState {
  column: "name" | "acuity" | "los" | "last_event";
  direction: "asc" | "desc";
  secondary?: {
    column: "name" | "acuity" | "los" | "last_event";
    direction: "asc" | "desc";
  };
}

export type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";
