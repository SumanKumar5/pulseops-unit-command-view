import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/api";
import { AlertItem } from "./AlertItem";
import { SlideOver } from "@/components/ui/SlideOver";
import styles from "./AlertPanel.module.css";

export function AlertPanel() {
  const alerts = useAppStore((s) => s.alerts);
  const setAlerts = useAppStore((s) => s.setAlerts);
  const acknowledgeAlertOptimistic = useAppStore(
    (s) => s.acknowledgeAlertOptimistic,
  );
  const rollbackAlert = useAppStore((s) => s.rollbackAlert);
  const selectedUnitId = useAppStore((s) => s.selectedUnitId);
  const isMuted = useAppStore((s) => s.isMuted);
  const toggleMute = useAppStore((s) => s.toggleMute);
  const showAlertHistory = useAppStore((s) => s.showAlertHistory);
  const setShowAlertHistory = useAppStore((s) => s.setShowAlertHistory);

  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PER_PAGE = 10;

  const { data: alertQueryData } = useQuery({
    queryKey: ["alerts", selectedUnitId],
    queryFn: () =>
      selectedUnitId
        ? api.getAlerts({ unit_id: selectedUnitId, status: "active" })
        : Promise.resolve([]),
    enabled: !!selectedUnitId,
    refetchInterval: false,
  });

  useEffect(() => {
    if (alertQueryData) setAlerts(alertQueryData);
  }, [alertQueryData, setAlerts]);

  const unitAlerts = alerts
    .filter((a) => a.unit_id === selectedUnitId)
    .sort((a, b) => {
      const sev = { critical: 0, high: 1, medium: 2 };
      const sd = sev[a.severity] - sev[b.severity];
      if (sd !== 0) return sd;
      return new Date(b.fired_at).getTime() - new Date(a.fired_at).getTime();
    });

  const activeAlerts = unitAlerts.filter(
    (a) => !a.acknowledged_by || a.acknowledged_by === "__pending__",
  );
  const acknowledgedAlerts = unitAlerts.filter(
    (a) => a.acknowledged_by && a.acknowledged_by !== "__pending__",
  );

  const handleAcknowledge = useCallback(
    async (alertId: string) => {
      acknowledgeAlertOptimistic(alertId, "__pending__");
      try {
        await api.acknowledgeAlert(alertId, { acknowledged_by: "Charge RN" });
        acknowledgeAlertOptimistic(alertId, "Charge RN");
      } catch {
        rollbackAlert(alertId);
      }
    },
    [acknowledgeAlertOptimistic, rollbackAlert],
  );

  const criticalCount = activeAlerts.filter(
    (a) => a.severity === "critical",
  ).length;
  const highCount = activeAlerts.filter((a) => a.severity === "high").length;

  const filteredHistory = acknowledgedAlerts.filter((a) =>
    historySearch
      ? a.message.toLowerCase().includes(historySearch.toLowerCase()) ||
        a.alert_type.includes(historySearch.toLowerCase())
      : true,
  );

  const historyPages = Math.ceil(filteredHistory.length / HISTORY_PER_PAGE);
  const pagedHistory = filteredHistory.slice(
    (historyPage - 1) * HISTORY_PER_PAGE,
    historyPage * HISTORY_PER_PAGE,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">Alerts</span>
          {criticalCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white tabular-nums">
              {criticalCount}
            </span>
          )}
          {highCount > 0 && (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white tabular-nums">
              {highCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            title={isMuted ? "Unmute alerts" : "Mute alerts"}
            className={`rounded-md p-1.5 text-xs transition-colors ${
              isMuted
                ? "bg-slate-700 text-slate-500 hover:text-slate-300"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
            aria-label={isMuted ? "Unmute alert sounds" : "Mute alert sounds"}
          >
            {isMuted ? (
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                />
              </svg>
            ) : (
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              </svg>
            )}
          </button>
          <button
            onClick={() => setShowAlertHistory(true)}
            className="rounded-md bg-slate-700 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-600"
          >
            History
          </button>
        </div>
      </div>

      <div
        className={`flex-1 overflow-y-auto scrollbar-thin ${styles.panel}`}
        role="log"
        aria-label="Active alerts"
        aria-live="polite"
      >
        {activeAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-2 text-2xl">✓</div>
            <p className="text-sm font-medium text-emerald-400">All clear</p>
            <p className="text-xs text-slate-600 mt-1">No active alerts</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {activeAlerts.map((alert) => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onAcknowledge={handleAcknowledge}
              />
            ))}
          </div>
        )}
      </div>

      <SlideOver
        open={showAlertHistory}
        onClose={() => {
          setShowAlertHistory(false);
          setHistoryPage(1);
        }}
        title={`Alert History (${acknowledgedAlerts.length})`}
      >
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Search history…"
            value={historySearch}
            onChange={(e) => {
              setHistorySearch(e.target.value);
              setHistoryPage(1);
            }}
            className="h-8 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500"
          />
          <div className="divide-y divide-slate-800/60 rounded-lg border border-slate-700/50 overflow-hidden">
            {pagedHistory.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No acknowledged alerts
              </p>
            ) : (
              pagedHistory.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={handleAcknowledge}
                />
              ))
            )}
          </div>
          {historyPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage === 1}
                className="rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 disabled:opacity-40 hover:bg-slate-600"
              >
                ← Prev
              </button>
              <span className="text-xs text-slate-500">
                {historyPage} / {historyPages}
              </span>
              <button
                onClick={() =>
                  setHistoryPage((p) => Math.min(historyPages, p + 1))
                }
                disabled={historyPage === historyPages}
                className="rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 disabled:opacity-40 hover:bg-slate-600"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </SlideOver>
    </div>
  );
}
