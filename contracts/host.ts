// Shape for the raw-escape-hatch device.getstatushistory RPC (no curated
// @host wrapper — called via callMethod() directly, see useStatusHistory).
export type StatusHistoryPoint = {
    bucket?: string;
    avgVal?: number | null;
    minVal?: number | null;
    maxVal?: number | null;
};

// Shape used for the mocked door/window open/close history. Real
// door/window history comes from the device-events journal instead (see
// DeviceChangeEvent below) — discrete state changes, not a sampled
// timeline — but the mock data still needs some {ts, value} shape.
export type StatusTimelinePoint = {
    ts?: unknown;
    value?: number | null;
    prevValue?: number | null;
};

// device.status only stores NUMERIC telemetry (power, voltage, temperature,
// energy counters) — confirmed by querying it directly, boolean fields like
// switch:0.output are simply absent. Discrete state changes (relay on/off,
// door open/closed) live in a separate append-only journal instead, read via
// deviceevents.query (another raw-escape-hatch RPC, no curated @host wrapper).
export type DeviceChangeEvent = {
    ts: string;
    shellyId: string;
    component: string;
    field: string;
    prev?: unknown;
    next?: unknown;
    kind: 'state_change' | 'event' | 'config';
};
