import type {
  Patient,
  FilterState,
  SortState,
  CensusStats,
  PatientFlag,
} from "@/types";

interface WorkerState {
  patients: Patient[];
}

const state: WorkerState = { patients: [] };
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingFilter: FilterState | null = null;

function computeStats(indices: number[]): CensusStats {
  const by_acuity: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  const by_status: Record<Patient["status"], number> = {
    admitted: 0,
    pending: 0,
    discharging: 0,
    boarding: 0,
  };
  let los_sum = 0;
  let patients_over_target_los = 0;
  const nurse_ratio_violations: string[] = [];

  indices.forEach((i) => {
    const p = state.patients[i];
    if (!p) return;
    by_acuity[p.acuity] = (by_acuity[p.acuity] ?? 0) + 1;
    by_status[p.status] = (by_status[p.status] ?? 0) + 1;
    los_sum += p.los_hours;
    if (p.los_hours > 72) patients_over_target_los++;
    if (p.acuity >= 4 && p.care_team.length < 2) {
      nurse_ratio_violations.push(p.id);
    }
  });

  const beds_available = state.patients.filter(
    (p) => p.status === "admitted" && p.bed_id !== null,
  ).length;

  return {
    by_acuity,
    by_status,
    avg_los:
      indices.length > 0
        ? parseFloat((los_sum / indices.length).toFixed(1))
        : 0,
    patients_over_target_los,
    beds_available,
    nurse_ratio_violations,
  };
}

function applyFilter(filter: FilterState): number[] {
  return state.patients.reduce<number[]>((acc, p, i) => {
    if (filter.status.length > 0 && !filter.status.includes(p.status))
      return acc;
    if (p.acuity < filter.acuity_min || p.acuity > filter.acuity_max)
      return acc;
    if (
      filter.unit_ids.length > 0 &&
      (!p.unit_id || !filter.unit_ids.includes(p.unit_id))
    )
      return acc;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const match =
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.chief_complaint.toLowerCase().includes(q) ||
        p.admitting_dx.toLowerCase().includes(q);
      if (!match) return acc;
    }
    if (filter.fall_risk.length > 0 && !filter.fall_risk.includes(p.fall_risk))
      return acc;
    if (
      filter.isolation_type.length > 0 &&
      !filter.isolation_type.includes(p.isolation_type)
    )
      return acc;
    if (
      filter.code_status.length > 0 &&
      !filter.code_status.includes(p.code_status)
    )
      return acc;
    if (
      filter.attending_provider_id &&
      p.attending_provider_id !== filter.attending_provider_id
    )
      return acc;
    if (
      filter.los_threshold_hours !== null &&
      p.los_hours < filter.los_threshold_hours
    )
      return acc;
    if (filter.flags.length > 0) {
      const hasAll = filter.flags.every((f: PatientFlag) =>
        p.flags.includes(f),
      );
      if (!hasAll) return acc;
    }
    acc.push(i);
    return acc;
  }, []);
}

function applySort(indices: number[], sort: SortState): number[] {
  return [...indices].sort((ai, bi) => {
    const a = state.patients[ai];
    const b = state.patients[bi];
    if (!a || !b) return 0;

    const compare = (
      col: SortState["column"],
      dir: SortState["direction"],
    ): number => {
      let av: string | number = 0;
      let bv: string | number = 0;
      if (col === "name") {
        av = `${a.last_name} ${a.first_name}`;
        bv = `${b.last_name} ${b.first_name}`;
        return dir === "asc"
          ? (av as string).localeCompare(bv as string)
          : (bv as string).localeCompare(av as string);
      }
      if (col === "acuity") {
        av = a.acuity;
        bv = b.acuity;
      }
      if (col === "los") {
        av = a.los_hours;
        bv = b.los_hours;
      }
      if (col === "last_event") {
        av = new Date(a.admitted_at).getTime();
        bv = new Date(b.admitted_at).getTime();
      }
      return dir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    };

    const primary = compare(sort.column, sort.direction);
    if (primary !== 0) return primary;
    if (sort.secondary)
      return compare(sort.secondary.column, sort.secondary.direction);
    return 0;
  });
}

function computeHandoffList(): number[] {
  const now = Date.now();
  const four_hours = 4 * 3600 * 1000;
  return state.patients.reduce<number[]>((acc, p, i) => {
    if (p.status === "discharging") {
      acc.push(i);
      return acc;
    }
    if (p.acuity >= 4 && p.los_hours > 48) {
      acc.push(i);
      return acc;
    }
    if (p.expected_discharge) {
      const eta = new Date(p.expected_discharge).getTime();
      if (eta - now <= four_hours && eta > now) {
        acc.push(i);
        return acc;
      }
    }
    return acc;
  }, []);
}

function runFilterAndSort(filter: FilterState, sort: SortState) {
  const filtered = applyFilter(filter);
  const sorted = applySort(filtered, sort);
  const stats = computeStats(sorted);
  self.postMessage({ type: "RESULT", payload: { indices: sorted, stats } });
}

type WorkerMessage =
  | { type: "LOAD"; payload: Patient[] }
  | { type: "FILTER"; payload: FilterState }
  | { type: "SORT"; payload: SortState }
  | { type: "AGGREGATE"; payload: { unit_ids: string[] } }
  | { type: "COMPUTE_HANDOFF_LIST" }
  | {
      type: "FILTER_AND_SORT";
      payload: { filter: FilterState; sort: SortState };
    };

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type } = e.data;

  if (type === "LOAD") {
    state.patients = e.data.payload;
    self.postMessage({
      type: "LOADED",
      payload: { count: state.patients.length },
    });
    return;
  }

  if (type === "FILTER_AND_SORT") {
    pendingFilter = e.data.payload.filter;
    const sort = e.data.payload.sort;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (pendingFilter) runFilterAndSort(pendingFilter, sort);
    }, 100);
    return;
  }

  if (type === "FILTER") {
    pendingFilter = e.data.payload;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (pendingFilter) {
        const sorted = applySort(applyFilter(pendingFilter), {
          column: "acuity",
          direction: "desc",
        });
        self.postMessage({
          type: "RESULT",
          payload: { indices: sorted, stats: computeStats(sorted) },
        });
      }
    }, 100);
    return;
  }

  if (type === "SORT") {
    const filter: FilterState = {
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
    const sorted = applySort(applyFilter(filter), e.data.payload);
    self.postMessage({
      type: "RESULT",
      payload: { indices: sorted, stats: computeStats(sorted) },
    });
    return;
  }

  if (type === "AGGREGATE") {
    const { unit_ids } = e.data.payload;
    const indices = state.patients.reduce<number[]>((acc, p, i) => {
      if (unit_ids.length === 0 || (p.unit_id && unit_ids.includes(p.unit_id)))
        acc.push(i);
      return acc;
    }, []);
    self.postMessage({
      type: "RESULT",
      payload: { indices, stats: computeStats(indices) },
    });
    return;
  }

  if (type === "COMPUTE_HANDOFF_LIST") {
    const indices = computeHandoffList();
    self.postMessage({ type: "HANDOFF_LIST", payload: { indices } });
    return;
  }
};
