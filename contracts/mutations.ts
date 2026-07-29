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

// Stored in the shadow group's metadata.viz (group.metadata has a 64KB
// budget and no per-field size cap, unlike Location.kindFields.floorPlan.url
// which is capped at 2048 chars — too small for an embedded image).
export type FloorVisualization = {
    floorPlan?: FloorPlanMeta;
    devicePlacements?: Record<string, DevicePlacement>;
    zones?: FloorZone[];
};
