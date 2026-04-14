import axios from "axios";

export const apiClient = axios.create({
  baseURL: "http://localhost:3001",
  headers: { "Content-Type": "application/json" },
});

export const api = {
  getUnits: () =>
    apiClient
      .get<{ data: import("@/types").Unit[] }>("/api/v1/units")
      .then((r) => r.data.data),

  getCensus: (unitId: string) =>
    apiClient
      .get<{
        beds: import("@/types").Bed[];
        summary: import("@/types").CensusSummary;
      }>(`/api/v1/units/${unitId}/census`)
      .then((r) => r.data),

  getPatients: (params: Record<string, string | number>) =>
    apiClient
      .get<
        import("@/types").PaginatedResponse<import("@/types").Patient>
      >("/api/v1/patients", { params })
      .then((r) => r.data),

  getPatient: (id: string) =>
    apiClient
      .get<import("@/types").Patient>(`/api/v1/patients/${id}`)
      .then((r) => r.data),

  admitPatient: (
    id: string,
    etag: string,
    body: {
      bed_id: string;
      unit_id: string;
      admitting_provider_id: string;
      acuity: import("@/types").Patient["acuity"];
      chief_complaint: string;
    },
  ) =>
    apiClient.post<{ patient: import("@/types").Patient; etag: string }>(
      `/api/v1/patients/${id}/admit`,
      body,
      { headers: { "If-Match": etag } },
    ),

  dischargePatient: (
    id: string,
    etag: string,
    body: { disposition: string; discharge_notes: string },
  ) =>
    apiClient.post<{ patient: import("@/types").Patient; etag: string }>(
      `/api/v1/patients/${id}/discharge`,
      body,
      { headers: { "If-Match": etag } },
    ),

  transferPatient: (
    id: string,
    etag: string,
    body: { target_unit_id: string; target_bed_id: string; reason: string },
  ) =>
    apiClient.post<{ patient: import("@/types").Patient; etag: string }>(
      `/api/v1/patients/${id}/transfer`,
      body,
      { headers: { "If-Match": etag } },
    ),

  getStaff: (params: Record<string, string>) =>
    apiClient
      .get<{
        data: import("@/types").StaffMember[];
      }>("/api/v1/staff", { params })
      .then((r) => r.data.data),

  getAlerts: (params: Record<string, string>) =>
    apiClient
      .get<{ data: import("@/types").Alert[] }>("/api/v1/alerts", { params })
      .then((r) => r.data.data),

  acknowledgeAlert: (
    id: string,
    body: { acknowledged_by: string; note?: string },
  ) => apiClient.post(`/api/v1/alerts/${id}/acknowledge`, body),

  getUnitStats: (unitId: string) =>
    apiClient
      .get<import("@/types").CensusSummary>("/api/v1/summary/unit-stats", {
        params: { unit_id: unitId },
      })
      .then((r) => r.data),
};
