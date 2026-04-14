import {
  useEffect,
  useState,
  useCallback,
  useTransition,
  useDeferredValue,
  Suspense,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/api";
import { useSSE } from "@/hooks/useSSE";
import { useUnitViewState } from "@/hooks/useUnitViewState";
import { BedMap } from "@/components/BedMap";
import { PatientLog } from "@/components/PatientLog";
import { AlertPanel } from "@/components/AlertPanel";
import { PatientDetail } from "@/components/ui/PatientDetail";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { Spinner } from "@/components/ui/Spinner";
import type { Unit } from "@/types";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

const SPECIALTY_COLORS: Record<Unit["specialty"], string> = {
  cardiac: "text-red-400 bg-red-400/10 border-red-400/20",
  neuro: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  surgical: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  icu: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  peds: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  oncology: "text-pink-400 bg-pink-400/10 border-pink-400/20",
};

type PanelLayout = "split" | "map" | "list" | "alerts";

const PANEL_LABELS: Record<PanelLayout, string> = {
  split: "Split",
  map: "Map",
  list: "List",
  alerts: "Alerts",
};

export function UnitCommandView() {
  const units = useAppStore((s) => s.units);
  const selectedUnitId = useAppStore((s) => s.selectedUnitId);
  const setSelectedUnit = useAppStore((s) => s.setSelectedUnit);
  const setBeds = useAppStore((s) => s.setBeds);
  const setPatients = useAppStore((s) => s.setPatients);
  const setAlerts = useAppStore((s) => s.setAlerts);
  const setActivePatient = useAppStore((s) => s.setActivePatient);
  const connectionState = useAppStore((s) => s.connectionState);
  const alerts = useAppStore((s) => s.alerts);

  const [layout, setLayoutState] = useState<PanelLayout>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("v");
      if (!encoded) return "split";
      const decoded = JSON.parse(decodeURIComponent(atob(encoded)));
      return (decoded?.layout as PanelLayout) ?? "split";
    } catch {
      return "split";
    }
  });

  const setLayout = useCallback((l: PanelLayout) => {
    setLayoutState(l);
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("v");
      if (!encoded) return;
      const decoded = JSON.parse(decodeURIComponent(atob(encoded)));
      decoded.layout = l;
      const newEncoded = btoa(encodeURIComponent(JSON.stringify(decoded)));
      const url = new URL(window.location.href);
      url.searchParams.set("v", newEncoded);
      window.history.replaceState(null, "", url.toString());
    } catch {}
  }, []);
  const [, startTransition] = useTransition();
  const deferredUnitId = useDeferredValue(selectedUnitId);
  const [savedViewName, setSavedViewName] = useState("");
  const [showSaveView, setShowSaveView] = useState(false);
  const [savedViews, setSavedViews] = useState<
    { name: string; savedAt: string }[]
  >([]);
  const [showViewsMenu, setShowViewsMenu] = useState(false);

  useSSE(selectedUnitId);
  const { saveView, loadView, listViews, deleteView } = useUnitViewState();

  const selectedUnit = units.find((u) => u.id === selectedUnitId);

  const { isLoading: unitsLoading, data: unitsData } = useQuery({
    queryKey: ["units"],
    queryFn: api.getUnits,
  });

  const { isLoading: censusLoading, data: censusData } = useQuery({
    queryKey: ["census", selectedUnitId],
    queryFn: () => api.getCensus(selectedUnitId!),
    enabled: !!selectedUnitId,
  });

  const { isLoading: patientsLoading, data: patientsData } = useQuery({
    queryKey: ["patients", selectedUnitId],
    queryFn: () => api.getPatients({ unit_id: selectedUnitId!, limit: 500 }),
    enabled: !!selectedUnitId,
  });

  const { data: alertsData } = useQuery({
    queryKey: ["alerts", selectedUnitId],
    queryFn: () =>
      api.getAlerts({ unit_id: selectedUnitId!, status: "active" }),
    enabled: !!selectedUnitId,
  });

  useEffect(() => {
    if (!unitsData) return;
    useAppStore.getState().setUnits(unitsData);
    if (!selectedUnitId && unitsData.length > 0) {
      setSelectedUnit(unitsData[0].id);
    }
  }, [unitsData, selectedUnitId, setSelectedUnit]);

  useEffect(() => {
    if (censusData) setBeds(censusData.beds);
  }, [censusData, setBeds]);

  useEffect(() => {
    if (patientsData) setPatients(patientsData.data);
  }, [patientsData, setPatients]);

  useEffect(() => {
    if (alertsData) setAlerts(alertsData);
  }, [alertsData, setAlerts]);

  const { data: staffData } = useQuery({
    queryKey: ["staff", selectedUnitId],
    queryFn: () => api.getStaff({ unit_id: selectedUnitId! }),
    enabled: !!selectedUnitId,
  });

  useEffect(() => {
    if (staffData) useAppStore.getState().setStaff(staffData);
  }, [staffData]);

  const handleBedClick = useCallback(
    (bedId: string) => {
      const beds = useAppStore.getState().beds;
      const patients = useAppStore.getState().patients;
      const bed = beds.find((b) => b.id === bedId);
      if (bed?.patient_id) setActivePatient(bed.patient_id);
      else {
        const p = patients.find((pt) => pt.bed_id === bedId);
        if (p) setActivePatient(p.id);
      }
    },
    [setActivePatient],
  );

  useEffect(() => {
    listViews().then(setSavedViews);
  }, [listViews, showViewsMenu]);

  const handleSaveView = async () => {
    if (!savedViewName.trim()) return;
    await saveView(savedViewName.trim());
    setSavedViewName("");
    setShowSaveView(false);
    const views = await listViews();
    setSavedViews(views);
  };

  const handleLoadView = async (name: string) => {
    await loadView(name);
    setShowViewsMenu(false);
  };

  const handleDeleteView = async (name: string) => {
    await deleteView(name);
    const views = await listViews();
    setSavedViews(views);
  };

  const activeAlertCount = alerts.filter(
    (a) => a.unit_id === selectedUnitId && !a.acknowledged_by,
  ).length;

  const criticalCount = alerts.filter(
    (a) =>
      a.unit_id === selectedUnitId &&
      !a.acknowledged_by &&
      a.severity === "critical",
  ).length;

  const isLoading = unitsLoading || censusLoading || patientsLoading;

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900/95 px-5 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <span className="text-base font-bold tracking-tight text-white">
            PulseOps
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-sm text-slate-400">Unit Command View</span>
        </div>

        {selectedUnit && (
          <div className="flex items-center gap-2 ml-2">
            <span
              className={`rounded-md border px-2 py-0.5 text-xs font-semibold capitalize ${SPECIALTY_COLORS[selectedUnit.specialty]}`}
            >
              {selectedUnit.specialty}
            </span>
            <span className="text-sm font-medium text-slate-200">
              {selectedUnit.name}
            </span>
            <span className="text-xs text-slate-600">
              Floor {selectedUnit.floor}
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ConnectionBadge />

          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-500/30 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-xs font-semibold text-red-300">
                {criticalCount} Critical
              </span>
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setShowViewsMenu((v) => !v)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-slate-100"
            >
              Views ▾
            </button>
            {showViewsMenu && (
              <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
                <div className="border-b border-slate-700/50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Saved Views
                  </p>
                </div>
                {savedViews.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-slate-500 text-center">
                    No saved views
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto">
                    {savedViews.map((v) => (
                      <div
                        key={v.name}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800/60"
                      >
                        <button
                          onClick={() => handleLoadView(v.name)}
                          className="flex-1 text-left text-xs text-slate-300 hover:text-white"
                        >
                          {v.name}
                        </button>
                        <button
                          onClick={() => handleDeleteView(v.name)}
                          className="text-slate-600 hover:text-red-400 text-xs"
                          aria-label={`Delete view ${v.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-slate-700/50 p-2">
                  {showSaveView ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={savedViewName}
                        onChange={(e) => setSavedViewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveView()}
                        placeholder="View name…"
                        autoFocus
                        className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500 placeholder-slate-600"
                      />
                      <button
                        onClick={handleSaveView}
                        className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSaveView(true)}
                      className="w-full rounded-md bg-slate-800 py-1.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
                    >
                      + Save current view
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
            {(Object.keys(PANEL_LABELS) as PanelLayout[]).map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  layout === l
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                {PANEL_LABELS[l]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex shrink-0 overflow-x-auto border-b border-slate-800 bg-slate-900/60 px-4 py-2 gap-1.5 scrollbar-thin">
        {units.map((u) => {
          const uAlerts = alerts.filter(
            (a) => a.unit_id === u.id && !a.acknowledged_by,
          ).length;
          const isSelected = selectedUnitId === u.id;
          return (
            <button
              key={u.id}
              onClick={() => startTransition(() => setSelectedUnit(u.id))}
              className={`relative flex shrink-0 flex-col rounded-xl border px-4 py-2 text-left transition-all ${
                isSelected
                  ? "border-blue-500/50 bg-blue-600/15 shadow-lg shadow-blue-500/10"
                  : "border-slate-700/50 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800"
              }`}
            >
              <span
                className={`text-xs font-semibold ${isSelected ? "text-blue-300" : "text-slate-300"}`}
              >
                {u.name.split(" - ")[0]}
              </span>
              <span className="text-xs text-slate-500 mt-0.5">
                {u.name.split(" - ")[1]}
              </span>
              {uAlerts > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {uAlerts > 9 ? "9+" : uAlerts}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center gap-3">
          <Spinner size="lg" />
          <span className="text-sm text-slate-400">Loading unit data…</span>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center gap-3">
              <Spinner size="lg" />
              <span className="text-sm text-slate-400">Loading unit data…</span>
            </div>
          }
        >
          <main className="flex flex-1 overflow-hidden gap-0">
            {(layout === "split" || layout === "map") && (
              <div
                className={`flex flex-col border-r border-slate-800 ${
                  layout === "split" ? "w-[55%]" : "flex-1"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-4 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Bed Map
                  </span>
                  <span className="text-xs text-slate-600">
                    {
                      useAppStore
                        .getState()
                        .beds.filter((b) => b.unit_id === deferredUnitId).length
                    }{" "}
                    beds
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ErrorBoundary name="Bed Map">
                    <BedMap onBedClick={handleBedClick} />
                  </ErrorBoundary>
                </div>
              </div>
            )}

            {(layout === "split" || layout === "list") && (
              <div
                className={`flex flex-col ${
                  layout === "split" ? "flex-1" : "flex-1"
                } border-r border-slate-800`}
              >
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-4 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Patient Log
                  </span>
                  <span className="text-xs text-slate-600">
                    {
                      useAppStore
                        .getState()
                        .patients.filter((p) => p.unit_id === deferredUnitId)
                        .length
                    }{" "}
                    patients
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ErrorBoundary name="Patient Log">
                    <PatientLog />
                  </ErrorBoundary>
                </div>
              </div>
            )}

            <div
              className={`flex flex-col border-slate-800 ${
                layout === "alerts" ? "flex-1" : "w-72 shrink-0"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Alert Centre
                </span>
                {activeAlertCount > 0 && (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">
                    {activeAlertCount} active
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <ErrorBoundary name="Alert Panel">
                  <AlertPanel />
                </ErrorBoundary>
              </div>
            </div>
          </main>
        </Suspense>
      )}

      <PatientDetail />

      {connectionState === "offline" && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-950/90 px-5 py-3 shadow-2xl backdrop-blur"
        >
          <span className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-sm font-medium text-red-300">
            Connection lost — dashboard may be out of date
          </span>
        </div>
      )}
    </div>
  );
}
