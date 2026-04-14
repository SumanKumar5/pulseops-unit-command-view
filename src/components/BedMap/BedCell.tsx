import { memo } from "react";
import type { Bed, Patient } from "@/types";
import { Badge } from "@/components/ui/Badge";

interface BedCellProps {
  bed: Bed;
  patient: Patient | null;
  onClick: (bedId: string) => void;
  isHeatmap: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

const STATUS_COLORS: Record<Bed["status"], string> = {
  available: "#10b981",
  occupied: "#3b82f6",
  cleaning: "#f59e0b",
  maintenance: "#6b7280",
  blocked: "#ef4444",
};

const STATUS_BG: Record<Bed["status"], string> = {
  available: "rgba(16,185,129,0.12)",
  occupied: "rgba(59,130,246,0.12)",
  cleaning: "rgba(245,158,11,0.12)",
  maintenance: "rgba(107,114,128,0.12)",
  blocked: "rgba(239,68,68,0.12)",
};

const ACUITY_HEAT: Record<number, string> = {
  1: "rgba(16,185,129,0.25)",
  2: "rgba(59,130,246,0.25)",
  3: "rgba(245,158,11,0.30)",
  4: "rgba(249,115,22,0.40)",
  5: "rgba(239,68,68,0.55)",
};

function IsolationIcon({
  type,
  cx,
  cy,
}: {
  type: string;
  cx: number;
  cy: number;
}) {
  const color =
    type === "airborne"
      ? "#f87171"
      : type === "droplet"
        ? "#60a5fa"
        : "#34d399";
  return (
    <g transform={`translate(${cx - 6}, ${cy - 6})`}>
      <rect width="12" height="12" rx="2" fill={color} opacity="0.9" />
      <text
        x="6"
        y="9"
        textAnchor="middle"
        fontSize="7"
        fill="white"
        fontWeight="bold"
      >
        {type === "airborne" ? "A" : type === "droplet" ? "D" : "C"}
      </text>
    </g>
  );
}

function FallRiskIcon({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx - 5}, ${cy - 5})`}>
      <polygon points="5,0 10,10 0,10" fill="#fbbf24" opacity="0.9" />
      <text
        x="5"
        y="9"
        textAnchor="middle"
        fontSize="6"
        fill="#1c1917"
        fontWeight="bold"
      >
        !
      </text>
    </g>
  );
}

function TelemetryIcon({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx - 6}, ${cy - 4})`}>
      <polyline
        points="0,4 2,4 4,0 6,8 8,2 10,4 12,4"
        fill="none"
        stroke="#a78bfa"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function areEqual(prev: BedCellProps, next: BedCellProps) {
  return (
    prev.bed.status === next.bed.status &&
    prev.bed.patient_id === next.bed.patient_id &&
    prev.bed.isolation_type === next.bed.isolation_type &&
    prev.patient?.acuity === next.patient?.acuity &&
    prev.patient?.fall_risk === next.patient?.fall_risk &&
    prev.isHeatmap === next.isHeatmap &&
    prev.x === next.x &&
    prev.y === next.y
  );
}

export const BedCell = memo(function BedCell({
  bed,
  patient,
  onClick,
  isHeatmap,
  x,
  y,
  width,
  height,
}: BedCellProps) {
  const bg = isHeatmap
    ? patient
      ? ACUITY_HEAT[patient.acuity]
      : "rgba(15,23,42,0.4)"
    : STATUS_BG[bed.status];

  const borderColor = isHeatmap
    ? patient
      ? ACUITY_HEAT[patient.acuity].replace("0.", "0.8,")
      : "rgba(51,65,85,0.5)"
    : STATUS_COLORS[bed.status];

  const cx = x + width / 2;
  const pad = 6;
  const iconY = y + height - 14;

  return (
    <g
      role="button"
      aria-label={`Bed ${bed.room}${bed.bed_number} - ${bed.status}${patient ? ` - ${patient.first_name} ${patient.last_name}` : ""}`}
      tabIndex={0}
      onClick={() => onClick(bed.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(bed.id);
      }}
      style={{ cursor: "pointer", outline: "none" }}
    >
      <rect
        x={x + 2}
        y={y + 2}
        width={width - 4}
        height={height - 4}
        rx="6"
        fill={bg}
        stroke={borderColor}
        strokeWidth="1.5"
        className="transition-all duration-200"
      />

      <text
        x={x + pad}
        y={y + 16}
        fontSize="9"
        fill="#94a3b8"
        fontFamily="Inter, sans-serif"
        fontWeight="500"
      >
        {bed.room}
        {bed.bed_number}
      </text>

      {patient && (
        <>
          <text
            x={cx}
            y={y + height / 2 - 4}
            fontSize="10"
            fill="#e2e8f0"
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
            fontWeight="600"
          >
            {patient.last_name.slice(0, 8)}
          </text>
          <text
            x={cx}
            y={y + height / 2 + 8}
            fontSize="8"
            fill="#94a3b8"
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
          >
            {patient.first_name[0]}. · {patient.los_hours}h
          </text>

          <rect
            x={x + width - 22}
            y={y + 4}
            width="18"
            height="14"
            rx="3"
            fill={
              patient.acuity === 5
                ? "#ef4444"
                : patient.acuity === 4
                  ? "#f97316"
                  : patient.acuity === 3
                    ? "#f59e0b"
                    : patient.acuity === 2
                      ? "#3b82f6"
                      : "#10b981"
            }
            opacity="0.9"
          />
          <text
            x={x + width - 13}
            y={y + 14}
            fontSize="9"
            fill="white"
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
            fontWeight="700"
          >
            {patient.acuity}
          </text>
        </>
      )}

      {!patient && bed.status !== "occupied" && (
        <text
          x={cx}
          y={y + height / 2 + 4}
          fontSize="9"
          fill="#64748b"
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontWeight="500"
          textTransform="uppercase"
        >
          {bed.status}
        </text>
      )}

      <g>
        {bed.isolation_type && (
          <IsolationIcon
            type={bed.isolation_type}
            cx={x + pad + 6}
            cy={iconY}
          />
        )}
        {patient?.fall_risk === "high" && (
          <FallRiskIcon
            cx={x + pad + (bed.isolation_type ? 20 : 6)}
            cy={iconY}
          />
        )}
        {bed.telemetry_equipped && patient && (
          <TelemetryIcon cx={x + width - 18} cy={iconY} />
        )}
      </g>
    </g>
  );
}, areEqual);
