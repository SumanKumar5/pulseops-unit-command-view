import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  Unit,
  Bed,
  Patient,
  StaffMember,
  Alert,
} from "../src/types/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

interface HospitalData {
  units: Unit[];
  beds: Bed[];
  patients: Patient[];
  staff: StaffMember[];
  alerts: Alert[];
}

function loadData(): HospitalData {
  const raw = readFileSync(join(__dirname, "data", "hospital.json"), "utf-8");
  return JSON.parse(raw);
}

let db = loadData();

const sseClients = new Map<string, express.Response[]>();

function getClients(unitId: string): express.Response[] {
  return sseClients.get(unitId) ?? [];
}

function broadcast(unitId: string, eventType: string, payload: unknown) {
  const clients = getClients(unitId);
  const data = JSON.stringify({ type: eventType, payload });
  clients.forEach((res) => {
    res.write(`data: ${data}\n\n`);
  });
}

function broadcastAll(eventType: string, payload: unknown) {
  sseClients.forEach((_, unitId) => broadcast(unitId, eventType, payload));
}

app.get("/stream", (req, res) => {
  const unitId = (req.query["unit_id"] as string) ?? "all";
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  if (!sseClients.has(unitId)) sseClients.set(unitId, []);
  sseClients.get(unitId)!.push(res);

  req.on("close", () => {
    const list = sseClients.get(unitId) ?? [];
    sseClients.set(
      unitId,
      list.filter((r) => r !== res),
    );
  });
});

app.get("/api/v1/units", (_req, res) => {
  res.json({ data: db.units });
});

app.get("/api/v1/units/:unitId/census", (req, res) => {
  const { unitId } = req.params;
  const beds = db.beds.filter((b) => b.unit_id === unitId);
  const unit = db.units.find((u) => u.id === unitId);
  if (!unit) {
    res.status(404).json({ error: "Unit not found" });
    return;
  }
  const occupied = beds.filter((b) => b.status === "occupied").length;
  const available = beds.filter((b) => b.status === "available").length;
  const cleaning = beds.filter((b) => b.status === "cleaning").length;
  const maintenance = beds.filter((b) => b.status === "maintenance").length;
  const blocked = beds.filter((b) => b.status === "blocked").length;
  const unitPatients = db.patients.filter((p) => p.unit_id === unitId);
  const avgAcuity = unitPatients.length
    ? unitPatients.reduce((s, p) => s + p.acuity, 0) / unitPatients.length
    : 0;
  const avgLos = unitPatients.length
    ? unitPatients.reduce((s, p) => s + p.los_hours, 0) / unitPatients.length
    : 0;
  const rns = db.staff.filter((s) => s.unit_id === unitId && s.role === "rn");
  const nurseRatio = rns.length ? unitPatients.length / rns.length : 0;
  res.json({
    beds,
    summary: {
      unit_id: unitId,
      total_beds: beds.length,
      occupied,
      available,
      cleaning,
      maintenance,
      blocked,
      avg_acuity: parseFloat(avgAcuity.toFixed(2)),
      avg_los: parseFloat(avgLos.toFixed(1)),
      nurse_ratio: parseFloat(nurseRatio.toFixed(2)),
    },
  });
});

app.get("/api/v1/patients", (req, res) => {
  const {
    unit_id,
    status,
    acuity,
    search,
    sort_by,
    sort_dir,
    page = "1",
    limit = "100",
  } = req.query as Record<string, string>;
  let patients = [...db.patients];
  if (unit_id) patients = patients.filter((p) => p.unit_id === unit_id);
  if (status) patients = patients.filter((p) => p.status === status);
  if (acuity) patients = patients.filter((p) => p.acuity === parseInt(acuity));
  if (search) {
    const q = search.toLowerCase();
    patients = patients.filter(
      (p) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.chief_complaint.toLowerCase().includes(q) ||
        p.admitting_dx.toLowerCase().includes(q),
    );
  }
  if (sort_by) {
    patients.sort((a, b) => {
      let av = 0,
        bv = 0;
      if (sort_by === "name")
        return sort_dir === "desc"
          ? `${b.last_name}${b.first_name}`.localeCompare(
              `${a.last_name}${a.first_name}`,
            )
          : `${a.last_name}${a.first_name}`.localeCompare(
              `${b.last_name}${b.first_name}`,
            );
      if (sort_by === "acuity") {
        av = a.acuity;
        bv = b.acuity;
      }
      if (sort_by === "los") {
        av = a.los_hours;
        bv = b.los_hours;
      }
      return sort_dir === "desc" ? bv - av : av - bv;
    });
  }
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const total = patients.length;
  const sliced = patients.slice((pageNum - 1) * limitNum, pageNum * limitNum);
  res.json({
    data: sliced,
    meta: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
  });
});

app.get("/api/v1/patients/:id", (req, res) => {
  const patient = db.patients.find((p) => p.id === req.params["id"]);
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(patient);
});

app.post("/api/v1/patients/:id/admit", (req, res) => {
  const patient = db.patients.find((p) => p.id === req.params["id"]);
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ifMatch = req.headers["if-match"];
  if (ifMatch && ifMatch !== patient.etag) {
    res.status(409).json({
      error: "conflict",
      current_etag: patient.etag,
      current_state: patient,
    });
    return;
  }
  if (Math.random() < 0.15) {
    res.status(409).json({
      error: "conflict",
      current_etag: patient.etag,
      current_state: patient,
    });
    return;
  }
  const { bed_id, unit_id, admitting_provider_id, acuity, chief_complaint } =
    req.body as {
      bed_id: string;
      unit_id: string;
      admitting_provider_id: string;
      acuity: Patient["acuity"];
      chief_complaint: string;
    };
  const newEtag = Math.random().toString(36).slice(2, 10);
  const idx = db.patients.findIndex((p) => p.id === req.params["id"]);
  const updated: Patient = {
    ...patient,
    bed_id,
    unit_id,
    admitting_provider_id,
    acuity,
    chief_complaint,
    status: "admitted",
    admitted_at: new Date().toISOString(),
    etag: newEtag,
  };
  db.patients[idx] = updated;
  const bedIdx = db.beds.findIndex((b) => b.id === bed_id);
  if (bedIdx !== -1) {
    db.beds[bedIdx] = {
      ...db.beds[bedIdx],
      status: "occupied",
      patient_id: patient.id,
    };
    broadcast(unit_id, "BED_STATUS_CHANGED", {
      bed_id,
      new_status: "occupied",
      patient_id: patient.id,
    });
  }
  broadcast(unit_id, "PATIENT_ADMITTED", updated);
  res.json({ patient: updated, etag: newEtag });
});

app.post("/api/v1/patients/:id/discharge", (req, res) => {
  const patient = db.patients.find((p) => p.id === req.params["id"]);
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ifMatch = req.headers["if-match"];
  if (ifMatch && ifMatch !== patient.etag) {
    res.status(409).json({
      error: "conflict",
      current_etag: patient.etag,
      current_state: patient,
    });
    return;
  }
  const newEtag = Math.random().toString(36).slice(2, 10);
  const idx = db.patients.findIndex((p) => p.id === req.params["id"]);
  const timestamp = new Date().toISOString();
  const updated: Patient = {
    ...patient,
    status: "discharging",
    bed_id: null,
    etag: newEtag,
  };
  db.patients[idx] = updated;
  if (patient.bed_id) {
    const bedIdx = db.beds.findIndex((b) => b.id === patient.bed_id);
    if (bedIdx !== -1) {
      db.beds[bedIdx] = {
        ...db.beds[bedIdx],
        status: "cleaning",
        patient_id: null,
      };
      broadcast(patient.unit_id ?? "", "BED_STATUS_CHANGED", {
        bed_id: patient.bed_id,
        new_status: "cleaning",
      });
    }
  }
  broadcast(patient.unit_id ?? "", "PATIENT_DISCHARGED", {
    patient_id: patient.id,
    bed_id: patient.bed_id,
    timestamp,
  });
  res.json({ patient: updated, etag: newEtag });
});

app.post("/api/v1/patients/:id/transfer", (req, res) => {
  const patient = db.patients.find((p) => p.id === req.params["id"]);
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ifMatch = req.headers["if-match"];
  if (ifMatch && ifMatch !== patient.etag) {
    res.status(409).json({
      error: "conflict",
      current_etag: patient.etag,
      current_state: patient,
    });
    return;
  }
  const { target_unit_id, target_bed_id } = req.body as {
    target_unit_id: string;
    target_bed_id: string;
    reason: string;
  };
  const newEtag = Math.random().toString(36).slice(2, 10);
  const idx = db.patients.findIndex((p) => p.id === req.params["id"]);
  const from_bed = patient.bed_id ?? "";
  const updated: Patient = {
    ...patient,
    unit_id: target_unit_id,
    bed_id: target_bed_id,
    etag: newEtag,
  };
  db.patients[idx] = updated;
  if (from_bed) {
    const oldBedIdx = db.beds.findIndex((b) => b.id === from_bed);
    if (oldBedIdx !== -1)
      db.beds[oldBedIdx] = {
        ...db.beds[oldBedIdx],
        status: "cleaning",
        patient_id: null,
      };
  }
  const newBedIdx = db.beds.findIndex((b) => b.id === target_bed_id);
  if (newBedIdx !== -1)
    db.beds[newBedIdx] = {
      ...db.beds[newBedIdx],
      status: "occupied",
      patient_id: patient.id,
    };
  broadcastAll("PATIENT_TRANSFERRED", {
    patient_id: patient.id,
    from_bed,
    to_bed: target_bed_id,
    to_unit: target_unit_id,
  });
  res.json({ patient: updated, etag: newEtag });
});

app.get("/api/v1/staff", (req, res) => {
  const { unit_id, role, shift } = req.query as Record<string, string>;
  let staff = [...db.staff];
  if (unit_id) staff = staff.filter((s) => s.unit_id === unit_id);
  if (role) staff = staff.filter((s) => s.role === role);
  if (shift) staff = staff.filter((s) => s.shift === shift);
  res.json({ data: staff });
});

app.get("/api/v1/alerts", (req, res) => {
  const { unit_id, severity, status } = req.query as Record<string, string>;
  let alerts = [...db.alerts];
  if (unit_id) alerts = alerts.filter((a) => a.unit_id === unit_id);
  if (severity) alerts = alerts.filter((a) => a.severity === severity);
  if (status === "active") alerts = alerts.filter((a) => !a.acknowledged_by);
  if (status === "acknowledged")
    alerts = alerts.filter((a) => !!a.acknowledged_by);
  res.json({ data: alerts });
});

app.post("/api/v1/alerts/:id/acknowledge", (req, res) => {
  const idx = db.alerts.findIndex((a) => a.id === req.params["id"]);
  if (idx === -1) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { acknowledged_by, note } = req.body as {
    acknowledged_by: string;
    note?: string;
  };
  db.alerts[idx] = {
    ...db.alerts[idx],
    acknowledged_by,
    acknowledged_at: new Date().toISOString(),
  };
  broadcastAll("ALERT_RESOLVED", {
    alert_id: req.params["id"],
    resolved_at: new Date().toISOString(),
    note,
  });
  res.json({ alert: db.alerts[idx] });
});

app.get("/api/v1/summary/unit-stats", (req, res) => {
  const { unit_id } = req.query as Record<string, string>;
  const unit = db.units.find((u) => u.id === unit_id);
  if (!unit) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const beds = db.beds.filter((b) => b.unit_id === unit_id);
  const patients = db.patients.filter((p) => p.unit_id === unit_id);
  const rns = db.staff.filter((s) => s.unit_id === unit_id && s.role === "rn");
  res.json({
    unit_id,
    total_beds: beds.length,
    occupied: beds.filter((b) => b.status === "occupied").length,
    available: beds.filter((b) => b.status === "available").length,
    cleaning: beds.filter((b) => b.status === "cleaning").length,
    maintenance: beds.filter((b) => b.status === "maintenance").length,
    blocked: beds.filter((b) => b.status === "blocked").length,
    avg_acuity: patients.length
      ? parseFloat(
          (
            patients.reduce((s, p) => s + p.acuity, 0) / patients.length
          ).toFixed(2),
        )
      : 0,
    avg_los: patients.length
      ? parseFloat(
          (
            patients.reduce((s, p) => s + p.los_hours, 0) / patients.length
          ).toFixed(1),
        )
      : 0,
    nurse_ratio: rns.length
      ? parseFloat((patients.length / rns.length).toFixed(2))
      : 0,
  });
});

const BED_STATUSES: Bed["status"][] = [
  "available",
  "occupied",
  "cleaning",
  "maintenance",
  "blocked",
];

function startSSESimulation() {
  setInterval(() => {
    const occupiedBeds = db.beds.filter(
      (b) => b.status === "occupied" && b.patient_id,
    );
    if (occupiedBeds.length === 0) return;
    const bed = occupiedBeds[Math.floor(Math.random() * occupiedBeds.length)];
    if (!bed.patient_id) return;
    const vitals = ["hr", "spo2", "bp_sys", "rr"];
    const vital = vitals[Math.floor(Math.random() * vitals.length)]!;
    const values: Record<string, number> = {
      hr: Math.floor(Math.random() * 30) + 95,
      spo2: Math.floor(Math.random() * 6) + 88,
      bp_sys: Math.floor(Math.random() * 30) + 155,
      rr: Math.floor(Math.random() * 8) + 18,
    };
    const thresholds: Record<string, number> = {
      hr: 120,
      spo2: 92,
      bp_sys: 180,
      rr: 24,
    };
    broadcast(bed.unit_id, "TELEMETRY_SPIKE", {
      patient_id: bed.patient_id,
      vital,
      value: values[vital],
      threshold: thresholds[vital],
    });
  }, 500);
  setInterval(() => {
    db.units.forEach((unit) => {
      if (sseClients.get(unit.id)?.length === 0) return;
      broadcast(unit.id, "HEARTBEAT", {
        server_time: new Date().toISOString(),
      });
    });
  }, 8000);

  setInterval(() => {
    const occupiedBeds = db.beds.filter((b) => b.status === "occupied");
    if (occupiedBeds.length === 0) return;
    const bed = occupiedBeds[Math.floor(Math.random() * occupiedBeds.length)];
    const newStatus: Bed["status"] =
      Math.random() < 0.7
        ? "occupied"
        : BED_STATUSES[Math.floor(Math.random() * BED_STATUSES.length)];
    const bedIdx = db.beds.findIndex((b) => b.id === bed.id);
    if (bedIdx !== -1)
      db.beds[bedIdx] = { ...db.beds[bedIdx], status: newStatus };
    broadcast(bed.unit_id, "BED_STATUS_CHANGED", {
      bed_id: bed.id,
      new_status: newStatus,
      patient_id: bed.patient_id,
    });
  }, 3000);

  setInterval(() => {
    const patients = db.patients.filter((p) => p.unit_id !== null);
    if (patients.length === 0) return;
    const patient = patients[Math.floor(Math.random() * patients.length)];
    const vitals = ["hr", "spo2", "bp_sys", "temp"];
    const vital = vitals[Math.floor(Math.random() * vitals.length)];
    const thresholds: Record<string, number> = {
      hr: 120,
      spo2: 92,
      bp_sys: 180,
      temp: 101.5,
    };
    const values: Record<string, number> = {
      hr: Math.floor(Math.random() * 60) + 100,
      spo2: Math.floor(Math.random() * 8) + 85,
      bp_sys: Math.floor(Math.random() * 40) + 170,
      temp: parseFloat((Math.random() * 3 + 100).toFixed(1)),
    };
    if (patient.unit_id) {
      broadcast(patient.unit_id, "TELEMETRY_SPIKE", {
        patient_id: patient.id,
        vital,
        value: values[vital],
        threshold: thresholds[vital],
      });
    }
  }, 5000);

  setInterval(() => {
    const activeAlerts = db.alerts.filter((a) => !a.acknowledged_by);
    if (activeAlerts.length === 0) return;
    const alert = activeAlerts[Math.floor(Math.random() * activeAlerts.length)];
    broadcast(alert.unit_id, "ALERT_FIRED", alert);
  }, 7000);
}

setInterval(() => {
  const occupiedBeds = db.beds.filter((b) => b.status === "occupied");
  if (occupiedBeds.length === 0) return;
  const bed = occupiedBeds[Math.floor(Math.random() * occupiedBeds.length)];
  broadcast(bed.unit_id, "TELEMETRY_SPIKE", {
    patient_id: bed.patient_id ?? "",
    vital: "hr",
    value: Math.floor(Math.random() * 40) + 90,
    threshold: 120,
  });
}, 500);

startSSESimulation();

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`PulseOps mock server running on http://localhost:${PORT}`);
});
