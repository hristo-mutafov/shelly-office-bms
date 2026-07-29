export type HostDeviceLike = {
    id: string;
    name?: string;
    online: boolean;
    model?: string;
    kind?: string;
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
