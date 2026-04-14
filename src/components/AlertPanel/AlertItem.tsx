import { memo, useEffect, useState } from "react";
import type { Alert } from "@/types";

interface AlertItemProps {
  alert: Alert;
  onAcknowledge: (id: string) => void;
}

const SEVERITY_STYLES: Record<Alert["severity"], string> = {
  critical: "border-l-red-500 bg-red-500/8",
  high: "border-l-orange-500 bg-orange-500/8",
  medium: "border-l-amber-500 bg-amber-500/8",
};

const SEVERITY_DOT: Record<Alert["severity"], string> = {
  critical: "bg-red-400 shadow-red-400/60 animate-pulse",
  high: "bg-orange-400 shadow-orange-400/60",
  medium: "bg-amber-400",
};

const SEVERITY_BADGE: Record<Alert["severity"], string> = {
  critical: "bg-red-500/20 text-red-300",
  high: "bg-orange-500/20 text-orange-300",
  medium: "bg-amber-500/20 text-amber-300",
};

const TYPE_LABELS: Record<Alert["alert_type"], string> = {
  fall_risk: "Fall Risk",
  deterioration: "Deterioration",
  rrt_criteria: "RRT Criteria",
  isolation_breach: "Isolation Breach",
  medication: "Medication",
  critical_lab: "Critical Lab",
};

function useRelativeTime(timestamp: string) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function update() {
      const diff = Math.floor(
        (Date.now() - new Date(timestamp).getTime()) / 1000,
      );
      if (diff < 60) setLabel(`${diff}s ago`);
      else if (diff < 3600) setLabel(`${Math.floor(diff / 60)}m ago`);
      else setLabel(`${Math.floor(diff / 3600)}h ago`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timestamp]);

  return label;
}

function areEqual(prev: AlertItemProps, next: AlertItemProps) {
  return (
    prev.alert.id === next.alert.id &&
    prev.alert.acknowledged_by === next.alert.acknowledged_by &&
    prev.alert.acknowledged_at === next.alert.acknowledged_at
  );
}

export const AlertItem = memo(function AlertItem({
  alert,
  onAcknowledge,
}: AlertItemProps) {
  const relTime = useRelativeTime(alert.fired_at);
  const isPending = alert.acknowledged_by === "__pending__";
  const isAcknowledged = !!alert.acknowledged_by && !isPending;

  return (
    <div
      role={alert.severity === "critical" ? "alert" : "status"}
      aria-live={alert.severity === "critical" ? "assertive" : "polite"}
      aria-atomic="true"
      className={`border-l-2 px-3 py-2.5 transition-opacity ${SEVERITY_STYLES[alert.severity]} ${
        isAcknowledged ? "opacity-40" : ""
      } ${isPending ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full shadow-sm ${SEVERITY_DOT[alert.severity]}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[alert.severity]}`}
            >
              {alert.severity.toUpperCase()}
            </span>
            <span className="text-xs font-medium text-slate-300">
              {TYPE_LABELS[alert.alert_type]}
            </span>
            <span className="ml-auto text-xs text-slate-600 tabular-nums shrink-0">
              {relTime}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {alert.message}
          </p>
          {isAcknowledged && (
            <p className="mt-1 text-xs text-slate-600">
              Acknowledged by {alert.acknowledged_by}
            </p>
          )}
        </div>
        {!isAcknowledged && !isPending && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="shrink-0 rounded bg-slate-700/60 px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-600 hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
            aria-label={`Acknowledge ${alert.severity} alert: ${alert.message}`}
          >
            Ack
          </button>
        )}
        {isPending && (
          <span className="shrink-0 text-xs text-slate-600 italic">
            saving…
          </span>
        )}
      </div>
    </div>
  );
}, areEqual);
