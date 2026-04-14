import type {
  SSEEventType,
  SSEEventPayloadMap,
  Bed,
  Patient,
  Alert,
  StaffMember,
} from "@/types";

type Handler<T extends SSEEventType> = (payload: SSEEventPayloadMap[T]) => void;

interface QueuedEvent {
  type: SSEEventType;
  payload: unknown;
  bed_id?: string;
}

type ConnectionStateListener = (
  state: import("@/types").ConnectionState,
) => void;

const HEARTBEAT_TIMEOUT_MS = 15000;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const MAX_QUEUE_SIZE = 200;
const JITTER = 0.25;

function withJitter(ms: number): number {
  const jitter = ms * JITTER * (Math.random() * 2 - 1);
  return Math.max(0, ms + jitter);
}

class SSEManager {
  private unitId: string | null = null;
  private es: EventSource | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private connectionState: import("@/types").ConnectionState = "connecting";
  private subscribers = new Map<SSEEventType, Set<Handler<SSEEventType>>>();
  private stateListeners = new Set<ConnectionStateListener>();
  private eventQueue: QueuedEvent[] = [];
  private isReconnecting = false;
  private catchupFn: ((unitId: string) => Promise<void>) | null = null;

  setCatchupFn(fn: (unitId: string) => Promise<void>) {
    this.catchupFn = fn;
  }

  connect(unitId: string) {
    if (this.unitId === unitId && this.es?.readyState === EventSource.OPEN)
      return;
    this.unitId = unitId;
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.isReconnecting = false;
    this.teardown();
    this.openConnection();
  }

  private openConnection() {
    if (!this.unitId) return;
    this.setConnectionState("connecting");
    this.es = new EventSource(
      `http://localhost:3001/stream?unit_id=${this.unitId}`,
    );

    this.es.onopen = () => {
      this.setConnectionState("connected");
      this.backoffMs = INITIAL_BACKOFF_MS;
      this.resetHeartbeatTimer();
      if (this.isReconnecting) {
        this.isReconnecting = false;
        this.runCatchup().then(() => this.replayQueue());
      }
    };

    this.es.onmessage = (e: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(e.data) as {
          type: SSEEventType;
          payload: unknown;
        };
        this.handleEvent(parsed.type, parsed.payload);
        if (parsed.type === "HEARTBEAT") this.resetHeartbeatTimer();
      } catch {
        /* ignore malformed */
      }
    };

    this.es.onerror = () => {
      this.teardown();
      this.scheduleReconnect();
    };
  }

  private handleEvent(type: SSEEventType, payload: unknown) {
    if (this.isReconnecting) {
      this.enqueue(type, payload);
      return;
    }
    const handlers = this.subscribers.get(type);
    if (!handlers) return;
    handlers.forEach((h) => {
      try {
        (h as Handler<typeof type>)(payload as SSEEventPayloadMap[typeof type]);
      } catch {
        /* isolate */
      }
    });
  }

  private enqueue(type: SSEEventType, payload: unknown) {
    const bedId =
      type === "BED_STATUS_CHANGED"
        ? (payload as { bed_id: string }).bed_id
        : undefined;
    const dedupKey = bedId ? `${bedId}:${type}` : null;
    if (dedupKey) {
      const existing = this.eventQueue.findIndex(
        (e) => e.bed_id === bedId && e.type === type,
      );
      if (existing !== -1) {
        this.eventQueue[existing] = { type, payload, bed_id: bedId };
        return;
      }
    }
    if (this.eventQueue.length >= MAX_QUEUE_SIZE) this.eventQueue.shift();
    this.eventQueue.push({ type, payload, bed_id: bedId });
  }

  private replayQueue() {
    const queue = [...this.eventQueue];
    this.eventQueue = [];
    queue.forEach(({ type, payload }) => {
      const handlers = this.subscribers.get(type);
      if (!handlers) return;
      handlers.forEach((h) => {
        try {
          (h as Handler<typeof type>)(
            payload as SSEEventPayloadMap[typeof type],
          );
        } catch {
          /* isolate */
        }
      });
    });
  }

  private async runCatchup() {
    if (!this.unitId || !this.catchupFn) return;
    try {
      await this.catchupFn(this.unitId);
    } catch {
      /* non-fatal */
    }
  }

  private resetHeartbeatTimer() {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = setTimeout(() => {
      this.teardown();
      this.scheduleReconnect();
    }, HEARTBEAT_TIMEOUT_MS);
  }

  private scheduleReconnect() {
    this.isReconnecting = true;
    this.setConnectionState("reconnecting");
    const delay = withJitter(Math.min(this.backoffMs, MAX_BACKOFF_MS));
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = setTimeout(() => this.openConnection(), delay);
  }

  private teardown() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.es) {
      this.es.close();
      this.es = null;
    }
  }

  subscribe<T extends SSEEventType>(type: T, handler: Handler<T>): () => void {
    if (!this.subscribers.has(type)) this.subscribers.set(type, new Set());
    this.subscribers.get(type)!.add(handler as Handler<SSEEventType>);
    return () =>
      this.subscribers.get(type)?.delete(handler as Handler<SSEEventType>);
  }

  onConnectionState(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.connectionState);
    return () => this.stateListeners.delete(listener);
  }

  private setConnectionState(state: import("@/types").ConnectionState) {
    this.connectionState = state;
    this.stateListeners.forEach((l) => l(state));
  }

  getConnectionState() {
    return this.connectionState;
  }

  getQueueSize() {
    return this.eventQueue.length;
  }

  disconnect() {
    this.teardown();
    this.setConnectionState("offline");
    this.unitId = null;
  }
}

export const sseManager = new SSEManager();
