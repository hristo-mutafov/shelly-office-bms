import type {HostDevice} from '@host';
import type {StatusHistoryPoint, StatusTimelinePoint} from '@template-contract';

// Explicitly authorized by Shelly (2026-07-30) as a substitute for the H&T
// and door/window sensors, whose Bluetooth gateway (the plug) can't reach
// them yet — firmware 1.2.2 predates the Gen3 BTHome component (needs 1.3+).
// The plug's own energy data is real throughout; only these two devices are
// mocked, and every surface showing them says so (see MockBadge.vue).
export const MOCK_CLIMATE_SHELLY_ID = 'mock-ht-sensor';
export const MOCK_DOOR_WINDOW_SHELLY_ID = 'mock-door-window-sensor';

export function mockClimateDevice(): HostDevice {
    const hour = new Date().getHours();
    const temperatureC = 21.5 + Math.sin((hour / 24) * Math.PI * 2) * 1.8;
    const humidityPct = 45 + Math.cos((hour / 24) * Math.PI * 2) * 8;
    return {
        shellyID: MOCK_CLIMATE_SHELLY_ID,
        name: 'H&T Sensor (mock)',
        online: true,
        capabilities: {
            temperature: {
                temperature_c: Number(temperatureC.toFixed(1)),
                humidity_pct: Number(humidityPct.toFixed(0))
            }
        }
    };
}

export function mockDoorWindowDevice(): HostDevice {
    return {
        shellyID: MOCK_DOOR_WINDOW_SHELLY_ID,
        name: 'Door/Window Sensor (mock)',
        online: true,
        capabilities: {
            door: {open: false}
        }
    };
}

export function mockClimateHistory(): StatusHistoryPoint[] {
    const points: StatusHistoryPoint[] = [];
    const now = new Date();
    for (let hoursAgo = 23; hoursAgo >= 0; hoursAgo--) {
        const bucketHour = (now.getHours() - hoursAgo + 24) % 24;
        const avg = 21.5 + Math.sin((bucketHour / 24) * Math.PI * 2) * 1.8;
        points.push({
            bucket: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
            avgVal: Number(avg.toFixed(1)),
            minVal: Number((avg - 0.4).toFixed(1)),
            maxVal: Number((avg + 0.4).toFixed(1))
        });
    }
    return points;
}

// A plausible day: closed overnight, a few short opens during business hours.
const MOCK_DOOR_EVENT_HOURS_AGO: {hoursAgo: number; open: boolean}[] = [
    {hoursAgo: 14.5, open: true},
    {hoursAgo: 14.4, open: false},
    {hoursAgo: 9.2, open: true},
    {hoursAgo: 9.0, open: false},
    {hoursAgo: 3.7, open: true},
    {hoursAgo: 3.6, open: false}
];

export function mockDoorWindowHistory(): StatusTimelinePoint[] {
    const now = Date.now();
    return MOCK_DOOR_EVENT_HOURS_AGO.map((event) => ({
        ts: new Date(now - event.hoursAgo * 3_600_000).toISOString(),
        value: event.open ? 1 : 0
    }));
}
