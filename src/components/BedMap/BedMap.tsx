import { useState, useRef, useCallback, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { BedCell } from "./BedCell";
import type { Bed, Patient } from "@/types";
import styles from "./BedMap.module.css";

const CELL_W = 110;
const CELL_H = 80;
const ROOM_GAP = 16;
const BED_GAP = 4;
const COLS = 4;
const HEADER_H = 32;
const PAD = 20;

interface BedLayout {
  bed: Bed;
  x: number;
  y: number;
}

function computeLayout(beds: Bed[]): {
  layouts: BedLayout[];
  totalW: number;
  totalH: number;
} {
  const rooms = new Map<string, Bed[]>();
  beds.forEach((b) => {
    if (!rooms.has(b.room)) rooms.set(b.room, []);
    rooms.get(b.room)!.push(b);
  });

  const roomList = Array.from(rooms.entries());
  const layouts: BedLayout[] = [];
  let maxY = 0;

  roomList.forEach(([, roomBeds], roomIdx) => {
    const col = roomIdx % COLS;
    const row = Math.floor(roomIdx / COLS);
    const roomX =
      PAD +
      col *
        (CELL_W * roomBeds.length + BED_GAP * (roomBeds.length - 1) + ROOM_GAP);
    const roomY = PAD + row * (CELL_H + HEADER_H + ROOM_GAP);

    roomBeds.forEach((bed, bi) => {
      layouts.push({
        bed,
        x: roomX + bi * (CELL_W + BED_GAP),
        y: roomY + HEADER_H,
      });
      maxY = Math.max(maxY, roomY + HEADER_H + CELL_H);
    });
  });

  const maxX = PAD + COLS * (CELL_W * 2 + BED_GAP + ROOM_GAP);
  return { layouts, totalW: maxX + PAD, totalH: maxY + PAD };
}

interface BedMapProps {
  onBedClick: (bedId: string) => void;
}

export function BedMap({ onBedClick }: BedMapProps) {
  const beds = useAppStore((s) => s.beds);
  const patients = useAppStore((s) => s.patients);
  const selectedUnitId = useAppStore((s) => s.selectedUnitId);

  const [isHeatmap, setIsHeatmap] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const unitBeds = beds.filter((b) => b.unit_id === selectedUnitId);
  const patientMap = new Map<string, Patient>();
  patients.forEach((p) => {
    if (p.bed_id) patientMap.set(p.bed_id, p);
  });

  const { layouts, totalW, totalH } = computeLayout(unitBeds);

  const rooms = new Map<string, Bed[]>();
  unitBeds.forEach((b) => {
    if (!rooms.has(b.room)) rooms.set(b.room, []);
    rooms.get(b.room)!.push(b);
  });
  const roomList = Array.from(rooms.entries());

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [selectedUnitId]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(3, Math.max(0.4, z - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [pan],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPan({
        x: dragStart.current.panX + e.clientX - dragStart.current.x,
        y: dragStart.current.panY + e.clientY - dragStart.current.y,
      });
    },
    [isDragging],
  );

  const onMouseUp = useCallback(() => setIsDragging(false), []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = 40;
    if (e.key === "ArrowLeft") setPan((p) => ({ ...p, x: p.x + step }));
    if (e.key === "ArrowRight") setPan((p) => ({ ...p, x: p.x - step }));
    if (e.key === "ArrowUp") setPan((p) => ({ ...p, y: p.y + step }));
    if (e.key === "ArrowDown") setPan((p) => ({ ...p, y: p.y - step }));
    if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(3, z + 0.1));
    if (e.key === "-") setZoom((z) => Math.max(0.4, z - 0.1));
  }, []);

  const statusCounts = unitBeds.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-2">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          {[
            { status: "available", color: "#10b981", label: "Available" },
            { status: "occupied", color: "#3b82f6", label: "Occupied" },
            { status: "cleaning", color: "#f59e0b", label: "Cleaning" },
            { status: "maintenance", color: "#6b7280", label: "Maint." },
            { status: "blocked", color: "#ef4444", label: "Blocked" },
          ].map(({ status, color, label }) => (
            <div key={status} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span>
                {label} ({statusCounts[status] ?? 0})
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsHeatmap((h) => !h)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              isHeatmap
                ? "bg-purple-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {isHeatmap ? "Heatmap ON" : "Heatmap"}
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
            className="rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
            aria-label="Zoom in"
          >
            +
          </button>
          <span className="min-w-[3rem] text-center text-xs text-slate-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
            className="rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
          >
            Reset
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden ${styles.container}`}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        role="application"
        aria-label="Bed map — use arrow keys to pan, + and - to zoom, Tab moves between beds, Enter opens detail"
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ display: "block" }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {roomList.map(([room, roomBeds], roomIdx) => {
              const col = roomIdx % COLS;
              const row = Math.floor(roomIdx / COLS);
              const roomX = PAD + col * (CELL_W * 2 + BED_GAP + ROOM_GAP);
              const roomY = PAD + row * (CELL_H + HEADER_H + ROOM_GAP);
              const roomW =
                roomBeds.length * CELL_W + (roomBeds.length - 1) * BED_GAP;
              return (
                <g key={room}>
                  <rect
                    x={roomX - 4}
                    y={roomY - 2}
                    width={roomW + 8}
                    height={CELL_H + HEADER_H + 4}
                    rx="8"
                    fill="rgba(15,23,42,0.6)"
                    stroke="rgba(51,65,85,0.4)"
                    strokeWidth="1"
                  />
                  <text
                    x={roomX + roomW / 2}
                    y={roomY + 14}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#64748b"
                    fontFamily="Inter, sans-serif"
                    fontWeight="600"
                    letterSpacing="0.05em"
                  >
                    ROOM {room}
                  </text>
                </g>
              );
            })}

            {layouts.map(({ bed, x, y }) => (
              <BedCell
                key={bed.id}
                bed={bed}
                patient={patientMap.get(bed.id) ?? null}
                onClick={onBedClick}
                isHeatmap={isHeatmap}
                x={x}
                y={y}
                width={CELL_W}
                height={CELL_H}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
