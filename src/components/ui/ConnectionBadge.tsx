import { useAppStore } from "@/store/useAppStore";
import { useEffect, useState } from "react";
import { sseManager } from "@/services/sseManager";

export function ConnectionBadge() {
  const connectionState = useAppStore((s) => s.connectionState);
  const lastHeartbeat = useAppStore((s) => s.lastHeartbeat);
  const [queueSize, setQueueSize] = useState(0);
  const [timeSince, setTimeSince] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setQueueSize(sseManager.getQueueSize());
      if (lastHeartbeat) {
        setTimeSince(
          Math.floor((Date.now() - new Date(lastHeartbeat).getTime()) / 1000),
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastHeartbeat]);

  const dot =
    connectionState === "connected"
      ? "bg-emerald-400 shadow-emerald-400/50"
      : connectionState === "reconnecting"
        ? "bg-amber-400 shadow-amber-400/50 animate-pulse"
        : connectionState === "connecting"
          ? "bg-blue-400 shadow-blue-400/50 animate-pulse"
          : "bg-red-400 shadow-red-400/50";

  const label =
    connectionState === "connected"
      ? "Live"
      : connectionState === "reconnecting"
        ? "Reconnecting…"
        : connectionState === "connecting"
          ? "Connecting…"
          : "Offline";

  return (
    <div className="flex items-center gap-2">
      {connectionState === "offline" && queueSize > 0 && (
        <span className="text-xs text-amber-400">
          {queueSize} queued · {timeSince}s ago
        </span>
      )}
      {connectionState === "reconnecting" && (
        <span className="text-xs text-amber-400">
          Last update {timeSince}s ago
        </span>
      )}
      <div className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1">
        <span className={`h-2 w-2 rounded-full shadow-sm ${dot}`} />
        <span className="text-xs font-medium text-slate-300">{label}</span>
      </div>
    </div>
  );
}
