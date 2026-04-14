import { useEffect, useRef } from "react";
import { sseManager } from "@/services/sseManager";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/api";
import type { Bed, Patient } from "@/types";

export function useSSE(unitId: string | null) {
  const updateBed = useAppStore((s) => s.updateBed);
  const upsertPatient = useAppStore((s) => s.upsertPatient);
  const removePatient = useAppStore((s) => s.removePatient);
  const addAlert = useAppStore((s) => s.addAlert);
  const resolveAlert = useAppStore((s) => s.resolveAlert);
  const setConnectionState = useAppStore((s) => s.setConnectionState);
  const setLastHeartbeat = useAppStore((s) => s.setLastHeartbeat);
  const setBeds = useAppStore((s) => s.setBeds);
  const isMuted = useAppStore((s) => s.isMuted);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  useEffect(() => {
    sseManager.setCatchupFn(async (id) => {
      const { beds } = await api.getCensus(id);
      setBeds(beds);
    });
  }, [setBeds]);

  useEffect(() => {
    if (!unitId) return;
    sseManager.connect(unitId);

    const unsubs = [
      sseManager.onConnectionState(setConnectionState),

      sseManager.subscribe("HEARTBEAT", ({ server_time }) => {
        setLastHeartbeat(server_time);
      }),

      sseManager.subscribe(
        "BED_STATUS_CHANGED",
        ({ bed_id, new_status, patient_id }) => {
          updateBed(bed_id, {
            status: new_status as Bed["status"],
            patient_id: patient_id ?? null,
          });
        },
      ),

      sseManager.subscribe("PATIENT_ADMITTED", (patient) => {
        upsertPatient(patient as Patient);
      }),

      sseManager.subscribe("PATIENT_DISCHARGED", ({ patient_id, bed_id }) => {
        removePatient(patient_id);
        updateBed(bed_id, { status: "cleaning", patient_id: null });
      }),

      sseManager.subscribe(
        "PATIENT_TRANSFERRED",
        ({ patient_id, from_bed, to_bed, to_unit }) => {
          updateBed(from_bed, { status: "cleaning", patient_id: null });
          updateBed(to_bed, { status: "occupied", patient_id: patient_id });
          const patients = useAppStore.getState().patients;
          const p = patients.find((x) => x.id === patient_id);
          if (p) upsertPatient({ ...p, unit_id: to_unit, bed_id: to_bed });
        },
      ),

      sseManager.subscribe("ALERT_FIRED", (alert) => {
        addAlert(alert);
        if (!isMutedRef.current && alert.severity === "critical") {
          playChime(alert.severity);
        }
      }),

      sseManager.subscribe("ALERT_RESOLVED", ({ alert_id, resolved_at }) => {
        resolveAlert(alert_id, resolved_at);
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [
    unitId,
    updateBed,
    upsertPatient,
    removePatient,
    addAlert,
    resolveAlert,
    setConnectionState,
    setLastHeartbeat,
    setBeds,
  ]);
}

function playChime(severity: string) {
  try {
    const ctx = new AudioContext();
    const frequencies = severity === "critical" ? [880, 1100, 880] : [660, 880];
    let time = ctx.currentTime;
    frequencies.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
      osc.start(time);
      osc.stop(time + 0.4);
      time += 0.35;
    });
  } catch {}
}
