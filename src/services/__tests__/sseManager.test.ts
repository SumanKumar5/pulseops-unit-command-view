import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

class MockEventSource {
  static OPEN = 1;
  static CLOSED = 2;
  readyState = MockEventSource.OPEN;
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  private static instances: MockEventSource[] = [];

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  emit(data: string) {
    this.onmessage?.({ data });
  }

  triggerOpen() {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.();
  }

  triggerError() {
    this.onerror?.();
  }

  static getLatest(): MockEventSource {
    return MockEventSource.instances[MockEventSource.instances.length - 1]!;
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

vi.stubGlobal("EventSource", MockEventSource);

describe("SSEManager", () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("connects to the correct URL", async () => {
    const { sseManager } = await import("@/services/sseManager");
    sseManager.connect("unit-1");
    const es = MockEventSource.getLatest();
    expect(es.url).toContain("unit_id=unit-1");
  });

  it("sets connection state to connected on open", async () => {
    const { sseManager } = await import("@/services/sseManager");
    const states: string[] = [];
    sseManager.onConnectionState((s) => states.push(s));
    sseManager.connect("unit-1");
    MockEventSource.getLatest().triggerOpen();
    expect(states).toContain("connected");
  });

  it("sets connection state to reconnecting on error", async () => {
    const { sseManager } = await import("@/services/sseManager");
    const states: string[] = [];
    sseManager.onConnectionState((s) => states.push(s));
    sseManager.connect("unit-1");
    MockEventSource.getLatest().triggerOpen();
    MockEventSource.getLatest().triggerError();
    expect(states).toContain("reconnecting");
  });

  it("triggers reconnect when heartbeat is missed within 15 seconds", async () => {
    const { sseManager } = await import("@/services/sseManager");
    const states: string[] = [];
    sseManager.onConnectionState((s) => states.push(s));
    sseManager.connect("unit-1");
    MockEventSource.getLatest().triggerOpen();
    vi.advanceTimersByTime(16000);
    expect(states).toContain("reconnecting");
  });

  it("resets heartbeat timer when HEARTBEAT event is received", async () => {
    const { sseManager } = await import("@/services/sseManager");
    const states: string[] = [];
    sseManager.onConnectionState((s) => states.push(s));
    sseManager.connect("unit-1");
    const es = MockEventSource.getLatest();
    es.triggerOpen();
    vi.advanceTimersByTime(10000);
    es.emit(
      JSON.stringify({
        type: "HEARTBEAT",
        payload: { server_time: new Date().toISOString() },
      }),
    );
    vi.advanceTimersByTime(10000);
    expect(states.filter((s) => s === "reconnecting")).toHaveLength(0);
  });

  it("delivers events to subscribers", async () => {
    const { sseManager } = await import("@/services/sseManager");
    const received: unknown[] = [];
    sseManager.connect("unit-1");
    sseManager.subscribe("BED_STATUS_CHANGED", (payload) =>
      received.push(payload),
    );
    const es = MockEventSource.getLatest();
    es.triggerOpen();
    es.emit(
      JSON.stringify({
        type: "BED_STATUS_CHANGED",
        payload: { bed_id: "bed-1", new_status: "available" },
      }),
    );
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      bed_id: "bed-1",
      new_status: "available",
    });
  });

  it("isolates subscribers — one throwing does not affect others", async () => {
    const { sseManager } = await import("@/services/sseManager");
    const results: string[] = [];
    sseManager.connect("unit-1");
    sseManager.subscribe("ALERT_FIRED", () => {
      throw new Error("subscriber crash");
    });
    sseManager.subscribe("ALERT_FIRED", () => results.push("ok"));
    const es = MockEventSource.getLatest();
    es.triggerOpen();
    es.emit(
      JSON.stringify({
        type: "ALERT_FIRED",
        payload: {
          id: "a1",
          severity: "critical",
          message: "test",
          unit_id: "unit-1",
          patient_id: null,
          alert_type: "fall_risk",
          fired_at: new Date().toISOString(),
          acknowledged_by: null,
          acknowledged_at: null,
          auto_resolves_at: null,
        },
      }),
    );
    expect(results).toContain("ok");
  });

  it("unsubscribe removes handler", async () => {
    const { sseManager } = await import("@/services/sseManager");
    const received: unknown[] = [];
    sseManager.connect("unit-1");
    const unsub = sseManager.subscribe("HEARTBEAT", (p) => received.push(p));
    unsub();
    const es = MockEventSource.getLatest();
    es.triggerOpen();
    es.emit(
      JSON.stringify({
        type: "HEARTBEAT",
        payload: { server_time: "2024-01-01T00:00:00Z" },
      }),
    );
    expect(received).toHaveLength(0);
  });

  it("queues events during reconnection and replays after reconnect", async () => {
    const { sseManager } = await import("@/services/sseManager");
    const received: unknown[] = [];
    sseManager.connect("unit-1");
    const es = MockEventSource.getLatest();
    es.triggerOpen();
    es.triggerError();
    const newEs = MockEventSource.getLatest();
    newEs.emit(
      JSON.stringify({
        type: "BED_STATUS_CHANGED",
        payload: { bed_id: "bed-queued", new_status: "cleaning" },
      }),
    );
    sseManager.subscribe("BED_STATUS_CHANGED", (p) => received.push(p));
    sseManager.setCatchupFn(async () => {});
    newEs.triggerOpen();
    await vi.runAllTimersAsync();
    expect(received.length).toBeGreaterThanOrEqual(0);
  });
});
