export type FloorPlanMeta = {
    url: string;
    widthPx: number;
    heightPx: number;
};

export type DevicePlacement = {
    x: number;
    y: number;
    rot?: number;
};

export type FloorZone = {
    id: string;
    name: string;
    color: string;
    points: {x: number; y: number}[];
};

export type FloorVisualization = {
    floorPlan?: FloorPlanMeta;
    devicePlacements?: Record<string, DevicePlacement>;
    zones?: FloorZone[];
};

export type SetFloorPlanInput = {
    locationId: number;
    floorPlan: FloorPlanMeta;
};

export type SetDevicePlacementInput = {
    locationId: number;
    deviceId: string;
    placement: DevicePlacement;
};
