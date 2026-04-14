import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/api";
import { SlideOver } from "./SlideOver";
import { Badge } from "./Badge";
import type { Patient } from "@/types";

const ACUITY_VARIANT = {
  1: "acuity1",
  2: "acuity2",
  3: "acuity3",
  4: "acuity4",
  5: "acuity5",
} as const;

interface ActionState {
  mode: "idle" | "admit" | "discharge" | "transfer";
  loading: boolean;
  error: string | null;
  conflictPatient: Patient | null;
}

function VitalsTable({ vitals }: { vitals: Patient["vitals_history"] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700/50">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700/50 bg-slate-800/60">
            {["Time", "HR", "BP", "SpO2", "Temp", "RR"].map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left font-semibold text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {vitals.slice(0, 6).map((v, i) => (
            <tr key={i} className="hover:bg-slate-800/30">
              <td className="px-3 py-1.5 text-slate-500 tabular-nums">
                {new Date(v.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td
                className={`px-3 py-1.5 tabular-nums font-medium ${v.hr > 100 || v.hr < 60 ? "text-red-400" : "text-slate-300"}`}
              >
                {v.hr}
              </td>
              <td
                className={`px-3 py-1.5 tabular-nums ${v.bp_sys > 160 || v.bp_sys < 90 ? "text-red-400" : "text-slate-300"}`}
              >
                {v.bp_sys}/{v.bp_dia}
              </td>
              <td
                className={`px-3 py-1.5 tabular-nums ${v.spo2 < 94 ? "text-red-400" : "text-slate-300"}`}
              >
                {v.spo2}%
              </td>
              <td
                className={`px-3 py-1.5 tabular-nums ${v.temp > 101 ? "text-orange-400" : "text-slate-300"}`}
              >
                {v.temp}°F
              </td>
              <td
                className={`px-3 py-1.5 tabular-nums ${v.rr > 20 || v.rr < 12 ? "text-red-400" : "text-slate-300"}`}
              >
                {v.rr}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span
        className={`text-xs text-right ${highlight ? "font-semibold text-orange-400" : "text-slate-300"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function PatientDetail() {
  const activePatientId = useAppStore((s) => s.activePatientId);
  const setActivePatient = useAppStore((s) => s.setActivePatient);
  const upsertPatient = useAppStore((s) => s.upsertPatient);
  const beds = useAppStore((s) => s.beds);
  const units = useAppStore((s) => s.units);
  const queryClient = useQueryClient();

  const [action, setAction] = useState<ActionState>({
    mode: "idle",
    loading: false,
    error: null,
    conflictPatient: null,
  });
  const [dischargeNotes, setDischargeNotes] = useState("");
  const [transferUnit, setTransferUnit] = useState("");
  const [transferBed, setTransferBed] = useState("");

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", activePatientId],
    queryFn: () => api.getPatient(activePatientId!),
    enabled: !!activePatientId,
  });

  const availableBeds = beds.filter(
    (b) =>
      b.status === "available" &&
      (transferUnit ? b.unit_id === transferUnit : true),
  );

  const handleDischarge = async () => {
    if (!patient) return;
    setAction({
      mode: "discharge",
      loading: true,
      error: null,
      conflictPatient: null,
    });
    const optimistic: Patient = {
      ...patient,
      status: "discharging",
      bed_id: null,
    };
    upsertPatient(optimistic);
    try {
      const res = await api.dischargePatient(patient.id, patient.etag, {
        disposition: "home",
        discharge_notes: dischargeNotes,
      });
      upsertPatient(res.data.patient);
      queryClient.invalidateQueries({ queryKey: ["patient", patient.id] });
      setAction({
        mode: "idle",
        loading: false,
        error: null,
        conflictPatient: null,
      });
    } catch (err: unknown) {
      upsertPatient(patient);
      const status = (
        err as {
          response?: { status?: number; data?: { current_state?: Patient } };
        }
      )?.response?.status;
      if (status === 409) {
        const current = (
          err as { response: { data: { current_state: Patient } } }
        ).response.data.current_state;
        setAction({
          mode: "discharge",
          loading: false,
          error: "Conflict detected",
          conflictPatient: current,
        });
      } else {
        setAction({
          mode: "discharge",
          loading: false,
          error: "Discharge failed",
          conflictPatient: null,
        });
      }
    }
  };

  const handleTransfer = async () => {
    if (!patient || !transferUnit || !transferBed) return;
    setAction({
      mode: "transfer",
      loading: true,
      error: null,
      conflictPatient: null,
    });
    const optimistic: Patient = {
      ...patient,
      unit_id: transferUnit,
      bed_id: transferBed,
    };
    upsertPatient(optimistic);
    try {
      const res = await api.transferPatient(patient.id, patient.etag, {
        target_unit_id: transferUnit,
        target_bed_id: transferBed,
        reason: "Clinical transfer",
      });
      upsertPatient(res.data.patient);
      queryClient.invalidateQueries({ queryKey: ["patient", patient.id] });
      setAction({
        mode: "idle",
        loading: false,
        error: null,
        conflictPatient: null,
      });
    } catch (err: unknown) {
      upsertPatient(patient);
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      setAction({
        mode: "transfer",
        loading: false,
        error:
          status === 409
            ? "Conflict — another nurse modified this record"
            : "Transfer failed",
        conflictPatient: null,
      });
    }
  };

  const resolveConflict = () => {
    if (action.conflictPatient) upsertPatient(action.conflictPatient);
    setAction({
      mode: "idle",
      loading: false,
      error: null,
      conflictPatient: null,
    });
  };

  const losDisplay = patient
    ? patient.los_hours >= 24
      ? `${Math.floor(patient.los_hours / 24)}d ${patient.los_hours % 24}h`
      : `${patient.los_hours}h`
    : "";

  return (
    <SlideOver
      open={!!activePatientId}
      onClose={() => {
        setActivePatient(null);
        setAction({
          mode: "idle",
          loading: false,
          error: null,
          conflictPatient: null,
        });
      }}
      title={
        patient
          ? `${patient.first_name} ${patient.last_name}`
          : "Patient Detail"
      }
      width="max-w-xl"
    >
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      )}

      {patient && (
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-100">
                  {patient.first_name} {patient.last_name}
                </h3>
                <Badge variant={ACUITY_VARIANT[patient.acuity]}>
                  A{patient.acuity}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {patient.mrn} · DOB {patient.dob}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className={`text-xs font-semibold capitalize ${
                  patient.status === "admitted"
                    ? "text-emerald-400"
                    : patient.status === "discharging"
                      ? "text-blue-400"
                      : patient.status === "pending"
                        ? "text-amber-400"
                        : "text-orange-400"
                }`}
              >
                {patient.status}
              </span>
              <span className="text-xs text-slate-500 uppercase">
                {patient.code_status}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3">
            <div className="divide-y divide-slate-700/30">
              <InfoRow
                label="Chief Complaint"
                value={patient.chief_complaint}
              />
              <InfoRow label="Admitting Dx" value={patient.admitting_dx} />
              <InfoRow
                label="Admitted"
                value={new Date(patient.admitted_at).toLocaleString()}
              />
              <InfoRow
                label="Length of Stay"
                value={losDisplay}
                highlight={patient.los_hours > 72}
              />
              <InfoRow
                label="Expected DC"
                value={
                  patient.expected_discharge
                    ? new Date(patient.expected_discharge).toLocaleDateString()
                    : "Not set"
                }
              />
              <InfoRow
                label="Fall Risk"
                value={
                  <span
                    className={
                      patient.fall_risk === "high"
                        ? "text-red-400"
                        : patient.fall_risk === "moderate"
                          ? "text-amber-400"
                          : "text-emerald-400"
                    }
                  >
                    {patient.fall_risk}
                  </span>
                }
              />
              {patient.isolation_type && (
                <InfoRow
                  label="Isolation"
                  value={
                    <span className="text-red-300 uppercase">
                      {patient.isolation_type}
                    </span>
                  }
                />
              )}
            </div>
          </div>

          {patient.flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {patient.flags.map((f) => (
                <Badge
                  key={f}
                  variant={
                    f === "high_acuity"
                      ? "critical"
                      : f === "fall_risk"
                        ? "high"
                        : "muted"
                  }
                >
                  {f.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          )}

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Care Team
            </h4>
            <div className="flex flex-wrap gap-2">
              {patient.care_team.map((m) => (
                <div
                  key={m.provider_id}
                  className="rounded-md bg-slate-800 px-2.5 py-1.5"
                >
                  <div className="text-xs font-medium text-slate-200">
                    {m.name}
                  </div>
                  <div className="text-xs uppercase text-slate-500">
                    {m.role}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Vitals History
            </h4>
            <VitalsTable vitals={patient.vitals_history} />
          </div>

          {patient.notes.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Notes
              </h4>
              <div className="flex flex-col gap-2">
                {patient.notes.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-lg border border-slate-700/40 bg-slate-800/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-slate-300">
                        {n.author}
                      </span>
                      <span className="text-xs text-slate-600 uppercase">
                        {n.role}
                      </span>
                      <span className="ml-auto text-xs text-slate-600">
                        {new Date(n.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-400">
                      {n.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-slate-700/50 pt-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Actions
            </h4>

            {action.error && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                <p className="text-xs text-red-400">{action.error}</p>
                {action.conflictPatient && (
                  <button
                    onClick={resolveConflict}
                    className="mt-1.5 text-xs text-blue-400 underline hover:text-blue-300"
                  >
                    Load latest version
                  </button>
                )}
              </div>
            )}

            {action.mode === "idle" && (
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setAction({
                      mode: "discharge",
                      loading: false,
                      error: null,
                      conflictPatient: null,
                    })
                  }
                  className="flex-1 rounded-lg bg-blue-600/20 border border-blue-500/30 px-3 py-2 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-600/30"
                >
                  Discharge
                </button>
                <button
                  onClick={() =>
                    setAction({
                      mode: "transfer",
                      loading: false,
                      error: null,
                      conflictPatient: null,
                    })
                  }
                  className="flex-1 rounded-lg bg-purple-600/20 border border-purple-500/30 px-3 py-2 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-600/30"
                >
                  Transfer
                </button>
              </div>
            )}

            {action.mode === "discharge" && !action.loading && (
              <div className="flex flex-col gap-2">
                <textarea
                  value={dischargeNotes}
                  onChange={(e) => setDischargeNotes(e.target.value)}
                  placeholder="Discharge notes (optional)"
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDischarge}
                    className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
                  >
                    Confirm Discharge
                  </button>
                  <button
                    onClick={() =>
                      setAction({
                        mode: "idle",
                        loading: false,
                        error: null,
                        conflictPatient: null,
                      })
                    }
                    className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {action.mode === "transfer" && !action.loading && (
              <div className="flex flex-col gap-2">
                <select
                  value={transferUnit}
                  onChange={(e) => {
                    setTransferUnit(e.target.value);
                    setTransferBed("");
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="">Select target unit…</option>
                  {units
                    .filter((u) => u.id !== patient.unit_id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
                {transferUnit && (
                  <select
                    value={transferBed}
                    onChange={(e) => setTransferBed(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="">Select target bed…</option>
                    {availableBeds.map((b) => (
                      <option key={b.id} value={b.id}>
                        Room {b.room}
                        {b.bed_number}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleTransfer}
                    disabled={!transferUnit || !transferBed}
                    className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-40"
                  >
                    Confirm Transfer
                  </button>
                  <button
                    onClick={() =>
                      setAction({
                        mode: "idle",
                        loading: false,
                        error: null,
                        conflictPatient: null,
                      })
                    }
                    className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {action.loading && (
              <div className="flex items-center justify-center gap-2 py-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span className="text-xs text-slate-400">Processing…</span>
              </div>
            )}
          </div>
        </div>
      )}
    </SlideOver>
  );
}
