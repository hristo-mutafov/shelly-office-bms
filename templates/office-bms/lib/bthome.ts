import type {HostDevice} from '@host';

const BTHOME_COMPONENT = /^bthomesensor:\d+$/;

function componentType(
    device: HostDevice,
    key: string,
    status: Record<string, unknown>
): string | null {
    // Mirrors the backend's own deriveDomainCapabilities()/bthomeType() logic
    // (frontend/src/shell/template-host/deviceCapabilities.ts) using only the
    // @host-exposed status/settings fields — no raw fetch needed.
    const settings = device.settings?.[key] as Record<string, unknown> | undefined;
    const type = settings?.obj_id ?? settings?.type ?? status.kind;
    return typeof type === 'string' ? type : null;
}

/**
 * Finds the live `bthomesensor:<n>.value` history field matching a BTHome
 * object type (temperature/humidity/door/window/opening). The numeric index
 * is assigned per-device by the gateway at pairing time, so it can't be
 * hardcoded — this discovers it from whatever real device actually shows up,
 * which is what lets the history charts work on hardware we never tested.
 */
export function findBthomeField(device: HostDevice, types: string[]): string | null {
    const status = device.status ?? {};
    for (const [key, raw] of Object.entries(status)) {
        if (!BTHOME_COMPONENT.test(key)) continue;
        const componentStatus = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
        const type = componentType(device, key, componentStatus);
        if (type && types.includes(type)) return `${key}.value`;
    }
    return null;
}
