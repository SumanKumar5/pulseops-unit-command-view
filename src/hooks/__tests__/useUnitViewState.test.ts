import { describe, it, expect, beforeEach } from "vitest";

function encodeState(state: Record<string, unknown>): string {
  return btoa(encodeURIComponent(JSON.stringify(state)));
}

function decodeState(encoded: string): Record<string, unknown> | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded)));
  } catch {
    return null;
  }
}

const DEFAULT_FILTER = {
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

const DEFAULT_SORT = { column: "acuity", direction: "desc" };

describe("URL state serialization round-trips", () => {
  it("encodes and decodes basic state", () => {
    const state = {
      unitId: "unit-1",
      filter: DEFAULT_FILTER,
      sort: DEFAULT_SORT,
      zoom: 1,
    };
    const encoded = encodeState(state);
    const decoded = decodeState(encoded);
    expect(decoded).toEqual(state);
  });

  it("round-trips empty filter arrays correctly", () => {
    const state = {
      unitId: "unit-1",
      filter: { ...DEFAULT_FILTER, status: [], unit_ids: [], flags: [] },
      sort: DEFAULT_SORT,
      zoom: 1,
    };
    const decoded = decodeState(encodeState(state));
    expect(decoded?.filter).toMatchObject({
      status: [],
      unit_ids: [],
      flags: [],
    });
  });

  it("round-trips null values for optional fields", () => {
    const state = {
      unitId: "unit-1",
      filter: {
        ...DEFAULT_FILTER,
        los_threshold_hours: null,
        isolation_type: [null],
      },
      sort: DEFAULT_SORT,
      zoom: 1,
    };
    const decoded = decodeState(encodeState(state));
    expect(
      (decoded?.filter as Record<string, unknown>)?.los_threshold_hours,
    ).toBeNull();
  });

  it("round-trips units with special characters in IDs", () => {
    const state = {
      unitId: "unit-3 North & ICU / floor=2",
      filter: DEFAULT_FILTER,
      sort: DEFAULT_SORT,
      zoom: 1,
    };
    const decoded = decodeState(encodeState(state));
    expect(decoded?.unitId).toBe("unit-3 North & ICU / floor=2");
  });

  it("round-trips zoom levels", () => {
    const state = {
      unitId: "unit-1",
      filter: DEFAULT_FILTER,
      sort: DEFAULT_SORT,
      zoom: 2.5,
    };
    const decoded = decodeState(encodeState(state));
    expect(decoded?.zoom).toBe(2.5);
  });

  it("round-trips sort direction asc", () => {
    const state = {
      unitId: "unit-1",
      filter: DEFAULT_FILTER,
      sort: { column: "los", direction: "asc" },
      zoom: 1,
    };
    const decoded = decodeState(encodeState(state));
    expect((decoded?.sort as Record<string, unknown>)?.direction).toBe("asc");
  });

  it("returns null for corrupted encoded string", () => {
    expect(decodeState("!!!not-valid-base64!!!")).toBeNull();
  });

  it("round-trips complex filter with multiple values", () => {
    const state = {
      unitId: "unit-2",
      filter: {
        ...DEFAULT_FILTER,
        status: ["admitted", "pending"],
        acuity_min: 3,
        acuity_max: 5,
        search: "cardiac",
        fall_risk: ["high"],
        los_threshold_hours: 72,
      },
      sort: { column: "name", direction: "asc" },
      zoom: 1.5,
    };
    const decoded = decodeState(encodeState(state));
    expect(decoded).toEqual(state);
  });
});

describe("Worker filter logic", () => {
  const patients = [
    {
      id: "p1",
      first_name: "John",
      last_name: "Smith",
      mrn: "MRN001",
      status: "admitted",
      acuity: 5,
      unit_id: "unit-1",
      fall_risk: "high",
      isolation_type: "contact",
      code_status: "full",
      attending_provider_id: "doc-1",
      los_hours: 80,
      flags: ["fall_risk"],
      chief_complaint: "chest pain",
      admitting_dx: "MI",
    },
    {
      id: "p2",
      first_name: "Jane",
      last_name: "Doe",
      mrn: "MRN002",
      status: "pending",
      acuity: 2,
      unit_id: "unit-1",
      fall_risk: "low",
      isolation_type: null,
      code_status: "dnr",
      attending_provider_id: "doc-2",
      los_hours: 24,
      flags: [],
      chief_complaint: "fever",
      admitting_dx: "pneumonia",
    },
    {
      id: "p3",
      first_name: "Bob",
      last_name: "Jones",
      mrn: "MRN003",
      status: "admitted",
      acuity: 3,
      unit_id: "unit-2",
      fall_risk: "moderate",
      isolation_type: null,
      code_status: "full",
      attending_provider_id: "doc-1",
      los_hours: 48,
      flags: ["high_acuity"],
      chief_complaint: "stroke",
      admitting_dx: "CVA",
    },
  ];

  function applyFilter(
    patients: typeof patients,
    filter: Partial<
      typeof DEFAULT_FILTER & {
        status: string[];
        acuity_min: number;
        acuity_max: number;
        unit_ids: string[];
        search: string;
        fall_risk: string[];
        los_threshold_hours: number | null;
      }
    >,
  ) {
    return patients.reduce<number[]>((acc, p, i) => {
      const f = { ...DEFAULT_FILTER, ...filter };
      if (f.status.length > 0 && !f.status.includes(p.status)) return acc;
      if (p.acuity < f.acuity_min || p.acuity > f.acuity_max) return acc;
      if (f.unit_ids.length > 0 && !f.unit_ids.includes(p.unit_id)) return acc;
      if (f.search) {
        const q = f.search.toLowerCase();
        if (
          ![
            p.first_name,
            p.last_name,
            p.mrn,
            p.chief_complaint,
            p.admitting_dx,
          ].some((v) => v.toLowerCase().includes(q))
        )
          return acc;
      }
      if (f.fall_risk.length > 0 && !f.fall_risk.includes(p.fall_risk))
        return acc;
      if (f.los_threshold_hours !== null && p.los_hours < f.los_threshold_hours)
        return acc;
      acc.push(i);
      return acc;
    }, []);
  }

  it("returns all indices with empty filter", () => {
    const result = applyFilter(patients as never, {});
    expect(result).toEqual([0, 1, 2]);
  });

  it("filters by status", () => {
    const result = applyFilter(patients as never, { status: ["admitted"] });
    expect(result).toEqual([0, 2]);
  });

  it("filters by acuity range", () => {
    const result = applyFilter(patients as never, {
      acuity_min: 3,
      acuity_max: 5,
    });
    expect(result).toEqual([0, 2]);
  });

  it("filters by unit_ids", () => {
    const result = applyFilter(patients as never, { unit_ids: ["unit-2"] });
    expect(result).toEqual([2]);
  });

  it("filters by text search across name/mrn/complaint/dx", () => {
    expect(applyFilter(patients as never, { search: "smith" })).toEqual([0]);
    expect(applyFilter(patients as never, { search: "MRN002" })).toEqual([1]);
    expect(applyFilter(patients as never, { search: "pneumonia" })).toEqual([
      1,
    ]);
    expect(applyFilter(patients as never, { search: "chest" })).toEqual([0]);
  });

  it("filters by fall_risk", () => {
    const result = applyFilter(patients as never, { fall_risk: ["high"] });
    expect(result).toEqual([0]);
  });

  it("filters by LOS threshold", () => {
    const result = applyFilter(patients as never, { los_threshold_hours: 72 });
    expect(result).toEqual([0]);
  });

  it("compound filter — admitted + acuity >= 3", () => {
    const result = applyFilter(patients as never, {
      status: ["admitted"],
      acuity_min: 3,
      acuity_max: 5,
    });
    expect(result).toEqual([0, 2]);
  });

  it("returns empty array when nothing matches", () => {
    const result = applyFilter(patients as never, { search: "zzznomatch" });
    expect(result).toEqual([]);
  });
});
