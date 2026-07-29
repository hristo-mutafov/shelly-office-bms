// Mirrors @host's HostDevice.capabilities (frontend/src/shell/template-host/types.ts).
// Devices classify by what they MEASURE, not by management capability.
export type DeviceEnergyCapability = {
    power_w?: number | null;
    total_energy_wh?: number | null;
};
export type DeviceTemperatureCapability = {
    temperature_c?: number | null;
    humidity_pct?: number | null;
};
export type DeviceRelayCapability = {state: boolean};
export type DeviceDoorCapability = {open: boolean};
export type DeviceMotionCapability = {detected: boolean};

export type DeviceCapabilities = {
    energy?: DeviceEnergyCapability;
    temperature?: DeviceTemperatureCapability;
    relay?: DeviceRelayCapability;
    door?: DeviceDoorCapability;
    motion?: DeviceMotionCapability;
};

export type HostLocationLike = {
    id: number;
    name: string;
    kind: 'building' | 'floor' | 'room' | string;
    parentLocationId: number | null;
};

export type HostGroupLike = {
    id: number;
    name: string;
    parentGroupId: number | null;
};

// Shapes for the two raw-escape-hatch RPCs used for sensor history —
// device.getstatushistory / device.getstatustimeline. Neither has a
// curated @host wrapper, so templates call them via callMethod() directly.
export type StatusHistoryPoint = {
    bucket?: string;
    avgVal?: number | null;
    minVal?: number | null;
    maxVal?: number | null;
};

export type StatusTimelinePoint = {
    ts?: unknown;
    value?: number | null;
    prevValue?: number | null;
};
