import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { usePatientWorker } from "@/hooks/usePatientWorker";
import { api } from "@/lib/api";
import { PatientRow, COLLAPSED_H, EXPANDED_H } from "./PatientRow";
import type { SortState } from "@/types";

const OVERSCAN = 8;

type SortCol = SortState["column"];

function SortIcon({ col, sort }: { col: SortCol; sort: SortState }) {
  if (sort.column === col) {
    return (
      <span className="ml-1 text-blue-400">
        {sort.direction === "asc" ? "↑" : "↓"}{" "}
        <span className="text-xs text-blue-600">1</span>
      </span>
    );
  }
  if (sort.secondary?.column === col) {
    return (
      <span className="ml-1 text-blue-300">
        {sort.secondary.direction === "asc" ? "↑" : "↓"}{" "}
        <span className="text-xs text-blue-500">2</span>
      </span>
    );
  }
  if (sort.tertiary?.column === col) {
    return (
      <span className="ml-1 text-blue-200">
        {sort.tertiary.direction === "asc" ? "↑" : "↓"}{" "}
        <span className="text-xs text-blue-400">3</span>
      </span>
    );
  }
  return <span className="ml-1 text-slate-600">↕</span>;
}

export function PatientLog() {
  const patients = useAppStore((s) => s.patients);
  const filteredIndices = useAppStore((s) => s.filteredIndices);
  const filterState = useAppStore((s) => s.filterState);
  const sortState = useAppStore((s) => s.sortState);
  const setSortState = useAppStore((s) => s.setSortState);
  const setFilterState = useAppStore((s) => s.setFilterState);
  const upsertPatient = useAppStore((s) => s.upsertPatient);
  const selectedUnitId = useAppStore((s) => s.selectedUnitId);

  const { filterAndSort } = usePatientWorker();

  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setContainerHeight(entries[0]?.contentRect.height ?? 400);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    filterAndSort(filterState, sortState);
  }, [patients, filterState, sortState, filterAndSort]);

  useEffect(() => {
    setSelectedIds(new Set());
    setScrollTop(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [selectedUnitId]);

  const rowHeights = useMemo(() => {
    return filteredIndices.map((idx) => {
      const p = patients[idx];
      return p && expandedIds.has(p.id) ? EXPANDED_H : COLLAPSED_H;
    });
  }, [filteredIndices, patients, expandedIds]);

  const totalHeight = rowHeights.reduce((s, h) => s + h, 0);

  const { startIdx, endIdx, offsetY } = useMemo(() => {
    let accumulated = 0;
    let start = 0;
    let startOffset = 0;

    for (let i = 0; i < rowHeights.length; i++) {
      if (accumulated + rowHeights[i]! > scrollTop) {
        start = i;
        startOffset = accumulated;
        break;
      }
      accumulated += rowHeights[i]!;
    }

    const visStart = Math.max(0, start - OVERSCAN);
    let visEnd = visStart;
    let visH = 0;
    let recalcOffset = 0;

    for (let i = 0; i < visStart; i++) recalcOffset += rowHeights[i]!;

    for (let i = visStart; i < rowHeights.length; i++) {
      visH += rowHeights[i]!;
      visEnd = i;
      if (visH > containerHeight + OVERSCAN * COLLAPSED_H) break;
    }

    return {
      startIdx: visStart,
      endIdx: Math.min(visEnd + OVERSCAN, filteredIndices.length - 1),
      offsetY: recalcOffset,
    };
  }, [scrollTop, containerHeight, rowHeights, filteredIndices.length]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        const allIds = filteredIndices
          .map((i) => patients[i]?.id)
          .filter(Boolean) as string[];
        setSelectedIds(new Set(allIds));
      }
    },
    [filteredIndices, patients],
  );

  const acknowledgeFlag = useCallback(
    async (patientId: string) => {
      const patient = patients.find((p) => p.id === patientId);
      if (!patient) return;
      const optimistic = {
        ...patient,
        flags: patient.flags.filter((f) => f !== "high_acuity"),
      };
      upsertPatient(optimistic);
      try {
        await api.getPatient(patientId);
      } catch {
        upsertPatient(patient);
      }
    },
    [patients, upsertPatient],
  );

  const handleSort = useCallback(
    (col: SortCol, e: React.MouseEvent) => {
      if (e.shiftKey) {
        if (sortState.column === col) {
          setSortState({
            ...sortState,
            direction: sortState.direction === "asc" ? "desc" : "asc",
          });
          return;
        }
        if (!sortState.secondary) {
          setSortState({
            ...sortState,
            secondary: { column: col, direction: "desc" },
          });
          return;
        }
        if (sortState.secondary.column === col) {
          setSortState({
            ...sortState,
            secondary: {
              column: col,
              direction:
                sortState.secondary.direction === "asc" ? "desc" : "asc",
            },
          });
          return;
        }
        if (!sortState.tertiary) {
          setSortState({
            ...sortState,
            tertiary: { column: col, direction: "desc" },
          });
          return;
        }
        setSortState({
          ...sortState,
          tertiary: {
            column: col,
            direction: sortState.tertiary.direction === "asc" ? "desc" : "asc",
          },
        });
        return;
      }
      setSortState(
        sortState.column === col
          ? {
              column: col,
              direction: sortState.direction === "asc" ? "desc" : "asc",
            }
          : { column: col, direction: "desc" },
      );
    },
    [sortState, setSortState],
  );

  const visibleRows = [];
  let currentOffset = offsetY;
  for (let i = startIdx; i <= endIdx && i < filteredIndices.length; i++) {
    const idx = filteredIndices[i]!;
    const patient = patients[idx];
    if (!patient) {
      currentOffset += rowHeights[i] ?? COLLAPSED_H;
      continue;
    }
    const h = rowHeights[i] ?? COLLAPSED_H;
    visibleRows.push(
      <PatientRow
        key={patient.id}
        patient={patient}
        isSelected={selectedIds.has(patient.id)}
        isExpanded={expandedIds.has(patient.id)}
        onToggleExpand={toggleExpand}
        onToggleSelect={toggleSelect}
        onAcknowledgeFlag={acknowledgeFlag}
        style={{ top: currentOffset, height: h }}
      />,
    );
    currentOffset += h;
  }

  const avgAcuity =
    filteredIndices.length > 0
      ? (
          filteredIndices.reduce((s, i) => s + (patients[i]?.acuity ?? 0), 0) /
          filteredIndices.length
        ).toFixed(1)
      : "—";

  const maxLos =
    filteredIndices.length > 0
      ? Math.max(...filteredIndices.map((i) => patients[i]?.los_hours ?? 0))
      : 0;

  const staff = useAppStore((s) => s.staff);
  const rns = staff.filter(
    (s) => s.unit_id === selectedUnitId && s.role === "rn",
  );
  const nurseRatio =
    rns.length > 0 ? Math.round(filteredIndices.length / rns.length) : 0;

  return (
    <div className="flex h-full flex-col" onKeyDown={handleSelectAll}>
      <div className="flex items-center gap-3 border-b border-slate-700/50 bg-slate-900/60 px-4 py-2">
        <input
          type="text"
          placeholder="Search patients…"
          value={filterState.search}
          onChange={(e) => setFilterState({ search: e.target.value })}
          className="h-7 w-48 rounded-md border border-slate-700 bg-slate-800 px-3 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500"
        />
        <select
          value={filterState.status[0] ?? ""}
          onChange={(e) =>
            setFilterState({
              status: e.target.value ? [e.target.value as never] : [],
            })
          }
          className="h-7 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-slate-300 outline-none focus:border-blue-500"
        >
          <option value="">All Status</option>
          <option value="admitted">Admitted</option>
          <option value="pending">Pending</option>
          <option value="discharging">Discharging</option>
          <option value="boarding">Boarding</option>
        </select>
        <select
          value={filterState.acuity_max < 5 ? filterState.acuity_min : ""}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            setFilterState(
              v
                ? { acuity_min: v, acuity_max: v }
                : { acuity_min: 1, acuity_max: 5 },
            );
          }}
          className="h-7 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-slate-300 outline-none focus:border-blue-500"
        >
          <option value="">All Acuity</option>
          {[1, 2, 3, 4, 5].map((a) => (
            <option key={a} value={a}>
              Acuity {a}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-slate-500">
          {selectedIds.size > 0 && (
            <span className="mr-3 text-blue-400">
              {selectedIds.size} selected
            </span>
          )}
          {filteredIndices.length} patients
        </span>
      </div>

      <div
        className="grid border-b border-slate-700/50 bg-slate-900/80 text-xs font-semibold text-slate-500"
        style={{
          gridTemplateColumns:
            "20px 16px 144px 44px 96px 80px 112px 1fr 80px 80px",
        }}
        role="row"
      >
        <div className="px-4 py-2 col-span-2" />
        <button
          className="px-4 py-2 text-left hover:text-slate-300 transition-colors"
          onClick={(e) => handleSort("name", e)}
        >
          Patient <SortIcon col="name" sort={sortState} />
        </button>
        <button
          className="py-2 text-left hover:text-slate-300 transition-colors"
          onClick={(e) => handleSort("acuity", e)}
        >
          Acuity <SortIcon col="acuity" sort={sortState} />
        </button>
        <div className="py-2">Status</div>
        <button
          className="py-2 text-left hover:text-slate-300 transition-colors"
          onClick={(e) => handleSort("los", e)}
        >
          LOS <SortIcon col="los" sort={sortState} />
        </button>
        <div className="py-2">Complaint</div>
        <div className="py-2">Flags</div>
        <div className="py-2">Isolation</div>
        <div className="py-2" />
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto scrollbar-thin"
          onScroll={handleScroll}
          role="rowgroup"
          aria-label="Patient list"
        >
          <div style={{ height: totalHeight, position: "relative" }}>
            {visibleRows}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 border-t border-slate-700/50 bg-slate-900/80 px-4 py-2 text-xs text-slate-500">
        <span>
          Showing{" "}
          <span className="text-slate-300">{filteredIndices.length}</span>{" "}
          patients
        </span>
        <span>
          Avg acuity <span className="text-slate-300">{avgAcuity}</span>
        </span>
        <span>
          Max LOS{" "}
          <span
            className={
              maxLos > 72 ? "text-orange-400 font-semibold" : "text-slate-300"
            }
          >
            {maxLos >= 24
              ? `${Math.floor(maxLos / 24)}d ${maxLos % 24}h`
              : `${maxLos}h`}
          </span>
        </span>
        <span>
          Nurse ratio{" "}
          <span
            className={
              nurseRatio > 6
                ? "text-orange-400 font-semibold"
                : "text-slate-300"
            }
          >
            {nurseRatio === 0 ? "—" : `1:${nurseRatio}`}
          </span>
        </span>
        {selectedIds.size > 0 && (
          <button className="ml-auto rounded bg-blue-600/20 px-3 py-1 text-blue-400 hover:bg-blue-600/30 transition-colors">
            Bulk Assign ({selectedIds.size})
          </button>
        )}
      </div>
    </div>
  );
}
