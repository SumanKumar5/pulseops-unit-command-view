import { create } from "zustand";
import type {
  Unit,
  Bed,
  Patient,
  Alert,
  StaffMember,
  FilterState,
  SortState,
  ConnectionState,
} from "@/types";

interface AppState {
  selectedUnitId: string | null;
  units: Unit[];
  beds: Bed[];
  patients: Patient[];
  alerts: Alert[];
  staff: StaffMember[];
  connectionState: ConnectionState;
  lastHeartbeat: string | null;
  isMuted: boolean;
  filterState: FilterState;
  sortState: SortState;
  filteredIndices: number[];
  activePatientId: string | null;
  showAlertHistory: boolean;

  setSelectedUnit: (id: string) => void;
  setUnits: (units: Unit[]) => void;
  setBeds: (beds: Bed[]) => void;
  setPatients: (patients: Patient[]) => void;
  updateBed: (bedId: string, patch: Partial<Bed>) => void;
  upsertPatient: (patient: Patient) => void;
  removePatient: (patientId: string) => void;
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  resolveAlert: (alertId: string, resolvedAt: string) => void;
  acknowledgeAlertOptimistic: (alertId: string, by: string) => void;
  rollbackAlert: (alertId: string) => void;
  setStaff: (staff: StaffMember[]) => void;
  setConnectionState: (state: ConnectionState) => void;
  setLastHeartbeat: (time: string) => void;
  toggleMute: () => void;
  setFilterState: (patch: Partial<FilterState>) => void;
  setSortState: (sort: SortState) => void;
  setFilteredIndices: (indices: number[]) => void;
  setActivePatient: (id: string | null) => void;
  setShowAlertHistory: (show: boolean) => void;
}

const defaultFilter: FilterState = {
  status: [],
  acuity_min: 1,
  acuity_max: 5,
  unit_ids: [],
  search: "",
  fall_risk: [],
  isolation_type: [],
  code_status: [],
  attending_provider_id: "",
  los_threshold_hours: null,
  flags: [],
};

const defaultSort: SortState = {
  column: "acuity",
  direction: "desc",
};

export const useAppStore = create<AppState>((set, get) => ({
  selectedUnitId: null,
  units: [],
  beds: [],
  patients: [],
  alerts: [],
  staff: [],
  connectionState: "connecting",
  lastHeartbeat: null,
  isMuted: false,
  filterState: defaultFilter,
  sortState: defaultSort,
  filteredIndices: [],
  activePatientId: null,
  showAlertHistory: false,

  setSelectedUnit: (id) => set({ selectedUnitId: id }),
  setUnits: (units) => set({ units }),
  setBeds: (beds) => set({ beds }),
  setPatients: (patients) => set({ patients }),

  updateBed: (bedId, patch) =>
    set((s) => ({
      beds: s.beds.map((b) => (b.id === bedId ? { ...b, ...patch } : b)),
    })),

  upsertPatient: (patient) =>
    set((s) => {
      const idx = s.patients.findIndex((p) => p.id === patient.id);
      if (idx === -1) return { patients: [...s.patients, patient] };
      const next = [...s.patients];
      next[idx] = patient;
      return { patients: next };
    }),

  removePatient: (patientId) =>
    set((s) => ({ patients: s.patients.filter((p) => p.id !== patientId) })),

  setAlerts: (alerts) => set({ alerts }),

  addAlert: (alert) =>
    set((s) => ({
      alerts: [alert, ...s.alerts.filter((a) => a.id !== alert.id)],
    })),

  resolveAlert: (alertId, resolvedAt) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              acknowledged_at: resolvedAt,
              acknowledged_by: a.acknowledged_by ?? "system",
            }
          : a,
      ),
    })),

  acknowledgeAlertOptimistic: (alertId, by) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              acknowledged_by: by,
              acknowledged_at: new Date().toISOString(),
            }
          : a,
      ),
    })),

  rollbackAlert: (alertId) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === alertId
          ? { ...a, acknowledged_by: null, acknowledged_at: null }
          : a,
      ),
    })),

  setStaff: (staff) => set({ staff }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setLastHeartbeat: (time) => set({ lastHeartbeat: time }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  setFilterState: (patch) =>
    set((s) => ({ filterState: { ...s.filterState, ...patch } })),
  setSortState: (sortState) => set({ sortState }),
  setFilteredIndices: (filteredIndices) => set({ filteredIndices }),
  setActivePatient: (activePatientId) => set({ activePatientId }),
  setShowAlertHistory: (showAlertHistory) => set({ showAlertHistory }),
}));
