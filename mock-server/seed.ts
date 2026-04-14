import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  Unit,
  Bed,
  Patient,
  StaffMember,
  Alert,
  VitalsEntry,
  NoteEntry,
  CareTeamMember,
  PatientFlag,
} from "../src/types/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const uid = () => Math.random().toString(36).slice(2, 10);

const FIRST_NAMES = [
  "James",
  "Mary",
  "Robert",
  "Patricia",
  "John",
  "Jennifer",
  "Michael",
  "Linda",
  "William",
  "Barbara",
  "David",
  "Elizabeth",
  "Richard",
  "Susan",
  "Joseph",
  "Jessica",
  "Thomas",
  "Sarah",
  "Charles",
  "Karen",
  "Christopher",
  "Lisa",
  "Daniel",
  "Nancy",
  "Matthew",
  "Betty",
  "Anthony",
  "Margaret",
  "Mark",
  "Sandra",
  "Donald",
  "Ashley",
  "Steven",
  "Dorothy",
  "Paul",
  "Kimberly",
  "Andrew",
  "Emily",
  "Joshua",
  "Donna",
  "Kenneth",
  "Michelle",
  "Kevin",
  "Carol",
  "Brian",
  "Amanda",
  "George",
  "Melissa",
  "Timothy",
  "Deborah",
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
  "Walker",
  "Young",
  "Allen",
  "King",
  "Wright",
  "Scott",
  "Torres",
  "Nguyen",
  "Hill",
  "Flores",
  "Green",
  "Adams",
  "Nelson",
  "Baker",
  "Hall",
  "Rivera",
  "Campbell",
  "Mitchell",
  "Carter",
  "Roberts",
];

const COMPLAINTS = [
  "Chest pain with exertion",
  "Shortness of breath",
  "Acute abdominal pain",
  "Altered mental status",
  "Severe headache",
  "Syncope episode",
  "Fever and chills",
  "Lower extremity edema",
  "Palpitations",
  "Nausea and vomiting",
  "Fall with injury",
  "Hypertensive urgency",
  "Diabetic ketoacidosis",
  "Pneumonia",
  "COPD exacerbation",
  "Stroke symptoms",
  "Sepsis workup",
  "Post-operative monitoring",
  "Seizure activity",
  "Renal failure workup",
  "Gastrointestinal bleed",
  "Deep vein thrombosis",
  "Pulmonary embolism",
  "Acute MI workup",
  "Pancreatitis",
  "Cellulitis",
  "Urinary tract infection",
  "Bowel obstruction",
  "Atrial fibrillation",
  "Drug overdose",
];

const DIAGNOSES = [
  "Congestive heart failure",
  "NSTEMI",
  "Pneumonia",
  "Acute kidney injury",
  "Ischemic stroke",
  "COPD exacerbation",
  "Sepsis",
  "Acute pancreatitis",
  "GI bleed - upper",
  "DVT right lower extremity",
  "Hypertensive emergency",
  "DKA",
  "Atrial fibrillation with RVR",
  "Post-op day 2 CABG",
  "Cellulitis left leg",
  "Pulmonary embolism",
  "Altered mental status - etiology unknown",
  "Bowel obstruction",
  "Acute liver failure",
  "Community-acquired pneumonia",
];

const UNIT_CONFIGS: Array<
  Partial<Unit> & { rooms: number; beds_per_room: number }
> = [
  {
    name: "3 North - Cardiac Step-Down",
    floor: 3,
    specialty: "cardiac",
    rooms: 18,
    beds_per_room: 3,
  },
  {
    name: "4 South - Neuro ICU",
    floor: 4,
    specialty: "neuro",
    rooms: 16,
    beds_per_room: 3,
  },
  {
    name: "5 East - Surgical",
    floor: 5,
    specialty: "surgical",
    rooms: 18,
    beds_per_room: 3,
  },
  {
    name: "2 West - General ICU",
    floor: 2,
    specialty: "icu",
    rooms: 16,
    beds_per_room: 3,
  },
  {
    name: "6 North - Pediatrics",
    floor: 6,
    specialty: "peds",
    rooms: 16,
    beds_per_room: 3,
  },
  {
    name: "3 South - Oncology",
    floor: 3,
    specialty: "oncology",
    rooms: 16,
    beds_per_room: 3,
  },
  {
    name: "4 East - Cardiac ICU",
    floor: 4,
    specialty: "cardiac",
    rooms: 14,
    beds_per_room: 3,
  },
  {
    name: "5 West - Neuro Step-Down",
    floor: 5,
    specialty: "neuro",
    rooms: 18,
    beds_per_room: 3,
  },
];

function generateVitals(count: number): VitalsEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(Date.now() - i * 3600000).toISOString(),
    hr: rand(55, 115),
    bp_sys: rand(90, 180),
    bp_dia: rand(55, 110),
    spo2: rand(92, 100),
    temp: parseFloat((rand(970, 1015) / 10).toFixed(1)),
    rr: rand(12, 28),
  }));
}

function generateNotes(authorNames: string[]): NoteEntry[] {
  const templates = [
    "Patient resting comfortably. Vitals stable. Continue current management.",
    "Reviewed labs. Potassium slightly low - repletion ordered.",
    "Family at bedside. Updated on plan of care. Questions answered.",
    "Patient ambulated in hallway x2 with PT. Tolerated well.",
    "Pain controlled with current regimen. Patient reports 3/10.",
    "Awaiting cardiology consult. Echo scheduled for tomorrow.",
    "IV site changed. New PIV placed in right antecubital.",
    "Patient requesting discharge information. Case management notified.",
  ];
  return Array.from({ length: rand(1, 4) }, () => ({
    id: uid(),
    author: pick(authorNames),
    role: pick(["RN", "MD", "NP", "Charge RN"]),
    content: pick(templates),
    created_at: new Date(Date.now() - rand(0, 86400000)).toISOString(),
  }));
}

function generateUnits(): Unit[] {
  return UNIT_CONFIGS.map((cfg, i) => {
    const total = cfg.rooms! * cfg.beds_per_room!;
    return {
      id: `unit-${i + 1}`,
      name: cfg.name!,
      floor: cfg.floor!,
      specialty: cfg.specialty as Unit["specialty"],
      total_beds: total,
      staffed_beds: total - rand(0, 3),
      target_census: Math.floor(total * 0.85),
    };
  });
}

function generateBeds(units: Unit[]): Bed[] {
  const beds: Bed[] = [];
  const cfg = UNIT_CONFIGS;
  units.forEach((unit, ui) => {
    const { rooms, beds_per_room } = cfg[ui];
    for (let r = 1; r <= rooms; r++) {
      for (let b = 0; b < beds_per_room; b++) {
        const bedLetter = String.fromCharCode(65 + b);
        const statusRoll = Math.random();
        const status: Bed["status"] =
          statusRoll < 0.92
            ? "occupied"
            : statusRoll < 0.96
              ? "available"
              : statusRoll < 0.98
                ? "cleaning"
                : statusRoll < 0.99
                  ? "maintenance"
                  : "blocked";
        beds.push({
          id: `bed-${unit.id}-${r}${bedLetter}`,
          unit_id: unit.id,
          room: `${unit.floor * 100 + r}`,
          bed_number: bedLetter,
          status,
          patient_id: null,
          isolation_type:
            Math.random() < 0.12
              ? pick([
                  "contact",
                  "droplet",
                  "airborne",
                ] as Bed["isolation_type"][])
              : null,
          telemetry_equipped: Math.random() < 0.6,
        });
      }
    }
  });
  return beds;
}

function generateStaff(units: Unit[]): StaffMember[] {
  const staff: StaffMember[] = [];
  units.forEach((unit) => {
    const shifts: StaffMember["shift"][] = ["day", "evening", "night"];
    shifts.forEach((shift) => {
      const rnCount = rand(3, 6);
      for (let i = 0; i < rnCount; i++) {
        staff.push({
          id: `staff-${uid()}`,
          name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
          role: "rn",
          unit_id: unit.id,
          shift,
          patient_ids: [],
          patient_ratio: 0,
        });
      }
      staff.push({
        id: `staff-${uid()}`,
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        role: "charge_rn",
        unit_id: unit.id,
        shift,
        patient_ids: [],
        patient_ratio: 0,
      });
      if (Math.random() < 0.7) {
        staff.push({
          id: `staff-${uid()}`,
          name: `Dr. ${pick(LAST_NAMES)}`,
          role: pick(["md", "np"] as StaffMember["role"][]),
          unit_id: unit.id,
          shift,
          patient_ids: [],
          patient_ratio: 0,
        });
      }
    });
  });
  return staff;
}

function generatePatients(
  beds: Bed[],
  staff: StaffMember[],
): { patients: Patient[]; beds: Bed[] } {
  const patients: Patient[] = [];
  const updatedBeds = [...beds];
  const staffNames = staff.map((s) => s.name);

  updatedBeds.forEach((bed, bi) => {
    if (bed.status !== "occupied") return;
    const patientId = `patient-${uid()}`;
    const admittedAt = new Date(
      Date.now() - rand(1, 240) * 3600000,
    ).toISOString();
    const losHours = Math.floor(
      (Date.now() - new Date(admittedAt).getTime()) / 3600000,
    );
    const acuity = pick([1, 2, 3, 4, 5] as Patient["acuity"][]);
    const flags: PatientFlag[] = [];
    if (Math.random() < 0.3) flags.push("fall_risk");
    if (bed.isolation_type) flags.push("isolation");
    if (acuity >= 4) flags.push("high_acuity");
    if (Math.random() < 0.15) flags.push("pending_discharge");
    if (Math.random() < 0.1) flags.push("rrt_watch");

    const unitStaff = staff.filter((s) => s.unit_id === bed.unit_id);
    const provider =
      unitStaff.find((s) => s.role === "md" || s.role === "np") ?? unitStaff[0];
    const careTeam: CareTeamMember[] = unitStaff
      .slice(0, rand(2, 4))
      .map((s) => ({ provider_id: s.id, name: s.name, role: s.role }));

    const patient: Patient = {
      id: patientId,
      mrn: `MRN${rand(100000, 999999)}`,
      first_name: pick(FIRST_NAMES),
      last_name: pick(LAST_NAMES),
      dob: new Date(Date.now() - rand(18, 90) * 365 * 86400000)
        .toISOString()
        .split("T")[0],
      gender: pick(["M", "F", "X"]),
      bed_id: bed.id,
      unit_id: bed.unit_id,
      status: pick([
        "admitted",
        "admitted",
        "admitted",
        "pending",
        "discharging",
        "boarding",
      ]),
      acuity,
      chief_complaint: pick(COMPLAINTS),
      admitting_dx: pick(DIAGNOSES),
      admitted_at: admittedAt,
      expected_discharge:
        Math.random() < 0.7
          ? new Date(Date.now() + rand(4, 72) * 3600000).toISOString()
          : null,
      los_hours: losHours,
      attending_provider_id: provider?.id ?? "unknown",
      care_team: careTeam,
      flags,
      isolation_type: bed.isolation_type,
      fall_risk: pick(["low", "moderate", "high"]),
      code_status: pick(["full", "full", "full", "dnr", "dnar", "comfort"]),
      vitals_history: generateVitals(rand(4, 12)),
      notes: generateNotes(staffNames),
      etag: uid(),
    };

    patients.push(patient);
    updatedBeds[bi] = { ...bed, patient_id: patientId };
  });

  const unitStaffMap: Record<string, StaffMember[]> = {};
  staff.forEach((s) => {
    if (!unitStaffMap[s.unit_id]) unitStaffMap[s.unit_id] = [];
    unitStaffMap[s.unit_id].push(s);
  });

  patients.forEach((p) => {
    if (!p.unit_id) return;
    const rns = (unitStaffMap[p.unit_id] ?? []).filter((s) => s.role === "rn");
    if (rns.length > 0) {
      const rn = rns[rand(0, rns.length - 1)];
      rn.patient_ids.push(p.id);
    }
  });

  staff.forEach((s) => {
    s.patient_ratio = s.patient_ids.length;
  });

  return { patients, beds: updatedBeds };
}

function generateAlerts(units: Unit[], patients: Patient[]): Alert[] {
  const alerts: Alert[] = [];
  const types: Alert["alert_type"][] = [
    "fall_risk",
    "deterioration",
    "rrt_criteria",
    "isolation_breach",
    "medication",
    "critical_lab",
  ];

  units.forEach((unit) => {
    const unitPatients = patients.filter((p) => p.unit_id === unit.id);
    const alertCount = rand(4, 8);
    for (let i = 0; i < alertCount; i++) {
      const patient = Math.random() < 0.8 ? pick(unitPatients) : null;
      const severity: Alert["severity"] = pick([
        "critical",
        "critical",
        "high",
        "high",
        "medium",
      ]);
      const firedAt = new Date(Date.now() - rand(0, 3600000)).toISOString();
      const isAcknowledged = Math.random() < 0.3;
      alerts.push({
        id: `alert-${uid()}`,
        unit_id: unit.id,
        patient_id: patient?.id ?? null,
        alert_type: pick(types),
        severity,
        message: pick([
          "Patient meets RRT activation criteria - HR > 130",
          "Fall risk patient found unattended near bed edge",
          "Critical potassium level: 2.8 mEq/L",
          "Isolation precautions not observed by visitor",
          "Medication administration overdue by 45 minutes",
          "SpO2 dropped to 88% - intervention required",
          "Blood pressure critically elevated: 198/112",
          "Patient requesting to leave AMA",
          "Telemetry showing frequent PVCs",
          "INR supratherapeutic: 5.2",
        ]),
        fired_at: firedAt,
        acknowledged_by: isAcknowledged ? "Charge RN" : null,
        acknowledged_at: isAcknowledged
          ? new Date(
              new Date(firedAt).getTime() + rand(60000, 600000),
            ).toISOString()
          : null,
        auto_resolves_at:
          Math.random() < 0.4
            ? new Date(Date.now() + rand(300000, 3600000)).toISOString()
            : null,
      });
    }
  });

  return alerts;
}

function main() {
  const units = generateUnits();
  const beds = generateBeds(units);
  const staff = generateStaff(units);
  const { patients, beds: updatedBeds } = generatePatients(beds, staff);

  const boardingPatients: Patient[] = [];
  units.forEach((unit) => {
    const count = rand(8, 15);
    const unitStaff = staff.filter((s) => s.unit_id === unit.id);
    const provider =
      unitStaff.find((s) => s.role === "md" || s.role === "np") ?? unitStaff[0];
    const careTeam: CareTeamMember[] = unitStaff
      .slice(0, rand(2, 3))
      .map((s) => ({ provider_id: s.id, name: s.name, role: s.role }));
    for (let i = 0; i < count; i++) {
      const admittedAt = new Date(
        Date.now() - rand(1, 120) * 3600000,
      ).toISOString();
      const losHours = Math.floor(
        (Date.now() - new Date(admittedAt).getTime()) / 3600000,
      );
      const acuity = pick([1, 2, 3, 4, 5] as Patient["acuity"][]);
      boardingPatients.push({
        id: `patient-${uid()}`,
        mrn: `MRN${rand(100000, 999999)}`,
        first_name: pick(FIRST_NAMES),
        last_name: pick(LAST_NAMES),
        dob: new Date(Date.now() - rand(18, 90) * 365 * 86400000)
          .toISOString()
          .split("T")[0],
        gender: pick(["M", "F", "X"]),
        bed_id: null,
        unit_id: unit.id,
        status: pick(["pending", "boarding"] as Patient["status"][]),
        acuity,
        chief_complaint: pick(COMPLAINTS),
        admitting_dx: pick(DIAGNOSES),
        admitted_at: admittedAt,
        expected_discharge:
          Math.random() < 0.6
            ? new Date(Date.now() + rand(4, 48) * 3600000).toISOString()
            : null,
        los_hours: losHours,
        attending_provider_id: provider?.id ?? "unknown",
        care_team: careTeam,
        flags: Math.random() < 0.3 ? ["fall_risk"] : [],
        isolation_type: null,
        fall_risk: pick(["low", "moderate", "high"]),
        code_status: pick(["full", "full", "dnr"]),
        vitals_history: generateVitals(rand(2, 6)),
        notes: generateNotes(staff.map((s) => s.name)),
        etag: uid(),
      });
    }
  });

  const allPatients = [...patients, ...boardingPatients];
  const alerts = generateAlerts(units, allPatients);
  const hospital = {
    units,
    beds: updatedBeds,
    staff,
    patients: allPatients,
    alerts,
  };

  const dataDir = join(__dirname, "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    join(dataDir, "hospital.json"),
    JSON.stringify(hospital, null, 2),
  );

  console.log(`Seed complete:`);
  console.log(`  Units:    ${units.length}`);
  console.log(`  Beds:     ${updatedBeds.length}`);
  console.log(`  Patients: ${allPatients.length}`);
  console.log(`  Staff:    ${staff.length}`);
  console.log(`  Alerts:   ${alerts.length}`);
}

main();
