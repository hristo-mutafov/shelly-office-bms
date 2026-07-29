import type {HostDevice} from '@host';
import {computed, type ComputedRef} from 'vue';

export type DeviceRoles = {
    plug: HostDevice | null;
    climateSensor: HostDevice | null;
    doorWindowSensor: HostDevice | null;
};

// Devices declare their role through capabilities, not naming convention —
// avoids hardcoding shellyIDs that would go stale the moment a device is
// swapped or re-onboarded.
export function useDeviceRoles(devices: ComputedRef<HostDevice[]>) {
    return computed<DeviceRoles>(() => {
        let plug: HostDevice | null = null;
        let climateSensor: HostDevice | null = null;
        let doorWindowSensor: HostDevice | null = null;

        for (const device of devices.value) {
            const caps = device.capabilities ?? {};
            if (!plug && caps.energy && caps.relay) plug = device;
            if (!climateSensor && caps.temperature) climateSensor = device;
            if (!doorWindowSensor && caps.door) doorWindowSensor = device;
        }

        return {plug, climateSensor, doorWindowSensor};
    });
}
