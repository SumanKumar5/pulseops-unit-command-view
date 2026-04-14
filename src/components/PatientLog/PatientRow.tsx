import { memo, useState } from "react";
import type { Patient } from "@/types";
import { Badge } from "@/components/ui/Badge";

interface PatientRowProps {
  patient: Patient;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onAcknowledgeFlag: (id: string) => void;
  style: React.CSSProperties;
}

const ACUITY_VARIANT = {
  1: "acuity1",
  2: "acuity2",
  3: "acuity3",
  4: "acuity4",
  5: "acuity5",
} as const;

const STATUS_COLORS: Record<Patient["status"], string> = {
  admitted: "text-emerald-400",
  pending: "text-amber-400",
  discharging: "text-blue-400",
  boarding: "text-orange-400",
};

const COLLAPSED_H = 44;
const EXPANDED_H = 140;

function VitalsSparkline({ vitals }: { vitals: Patient["vitals_history"] }) {
  const last3 = vitals.slice(0, 3);
  if (last3.length === 0) return null;
  return (
    <div className="flex items-center gap-3 mt-2">
      {last3.map((v, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded bg-slate-800 px-2 py-1 text-xs"
        >
          <span className="text-slate-500">#{i + 1}</span>
          <span className="text-red-300">HR {v.hr}</span>
          <span className="text-blue-300">
            BP {v.bp_sys}/{v.bp_dia}
          </span>
          <span className="text-emerald-300">SpO2 {v.spo2}%</span>
          <span className="text-amber-300">{v.temp}°F</span>
        </div>
      ))}
    </div>
  );
}

function areEqual(prev: PatientRowProps, next: PatientRowProps) {
  return (
    prev.patient.id === next.patient.id &&
    prev.patient.status === next.patient.status &&
    prev.patient.acuity === next.patient.acuity &&
    prev.patient.flags.length === next.patient.flags.length &&
    prev.patient.etag === next.patient.etag &&
    prev.isSelected === next.isSelected &&
    prev.isExpanded === next.isExpanded &&
    prev.style.top === next.style.top
  );
}

export const PatientRow = memo(function PatientRow({
  patient,
  isSelected,
  isExpanded,
  onToggleExpand,
  onToggleSelect,
  onAcknowledgeFlag,
  style,
}: PatientRowProps) {
  const losDisplay =
    patient.los_hours >= 24
      ? `${Math.floor(patient.los_hours / 24)}d ${patient.los_hours % 24}h`
      : `${patient.los_hours}h`;

  const isOverLos = patient.los_hours > 72;

  return (
    <div
      style={{ ...style, height: isExpanded ? EXPANDED_H : COLLAPSED_H }}
      className={`absolute left-0 right-0 border-b border-slate-800/60 transition-colors ${
        isSelected ? "bg-blue-900/20" : "hover:bg-slate-800/40"
      }`}
      role="row"
    >
      <div className="flex h-11 items-center gap-3 px-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(patient.id)}
          className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 accent-blue-500"
          aria-label={`Select ${patient.first_name} ${patient.last_name}`}
          onClick={(e) => e.stopPropagation()}
        />

        <button
          onClick={() => onToggleExpand(patient.id)}
          className="flex w-4 items-center justify-center text-slate-500 hover:text-slate-300"
          aria-label={isExpanded ? "Collapse row" : "Expand row"}
        >
          <svg
            className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        <div className="w-36 min-w-0">
          <div className="truncate text-sm font-medium text-slate-100">
            {patient.last_name}, {patient.first_name}
          </div>
          <div className="text-xs text-slate-500">{patient.mrn}</div>
        </div>

        <Badge variant={ACUITY_VARIANT[patient.acuity]}>
          A{patient.acuity}
        </Badge>

        <div className="w-24 min-w-0">
          <div
            className={`text-xs font-medium capitalize ${STATUS_COLORS[patient.status]}`}
          >
            {patient.status}
          </div>
        </div>

        <div className="w-20 min-w-0">
          <span
            className={`text-xs ${isOverLos ? "font-semibold text-orange-400" : "text-slate-400"}`}
          >
            {losDisplay}
          </span>
        </div>

        <div className="w-28 min-w-0 truncate text-xs text-slate-400">
          {patient.chief_complaint}
        </div>

        <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
          {patient.flags.slice(0, 3).map((flag) => (
            <Badge
              key={flag}
              variant={
                flag === "high_acuity"
                  ? "critical"
                  : flag === "fall_risk"
                    ? "high"
                    : "muted"
              }
            >
              {flag.replace("_", " ")}
            </Badge>
          ))}
          {patient.flags.length > 3 && (
            <span className="text-xs text-slate-500">
              +{patient.flags.length - 3}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {patient.isolation_type && (
            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-300">
              {patient.isolation_type.toUpperCase()}
            </span>
          )}
          {patient.fall_risk === "high" && (
            <span className="text-amber-400" title="High fall risk">
              ⚠
            </span>
          )}
        </div>

        <button
          onClick={() => onAcknowledgeFlag(patient.id)}
          className="ml-auto rounded bg-slate-700/60 px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-600 hover:text-slate-200"
        >
          Ack Flag
        </button>
      </div>

      {isExpanded && (
        <div className="px-4 pb-3">
          <div className="text-xs text-slate-500 mb-1">Latest Vitals</div>
          <VitalsSparkline vitals={patient.vitals_history} />
          <div className="mt-2 flex gap-2">
            <span className="text-xs text-slate-500">
              Dx: <span className="text-slate-300">{patient.admitting_dx}</span>
            </span>
            <span className="text-xs text-slate-500">
              Code:{" "}
              <span className="text-slate-300 uppercase">
                {patient.code_status}
              </span>
            </span>
            <span className="text-xs text-slate-500">
              Fall:{" "}
              <span className="text-slate-300 capitalize">
                {patient.fall_risk}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}, areEqual);

export { COLLAPSED_H, EXPANDED_H };
