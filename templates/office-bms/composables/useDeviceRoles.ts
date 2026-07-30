import type {HostDevice} from '@host';
import {computed, type ComputedRef} from 'vue';
import {mockClimateDevice, mockDoorWindowDevice} from '../lib/mockClimateDoorWindow';

export type DeviceRoles = {
    plug: HostDevice | null;
    climateSensor: HostDevice;
    climateSensorIsMock: boolean;
    doorWindowSensor: HostDevice;
    doorWindowSensorIsMock: boolean;
};

// Devices declare their role through capabilities, not naming convention —
// avoids hardcoding shellyIDs that would go stale the moment a device is
// swapped or re-onboarded. Climate/door-window fall back to mock devices
// (explicitly authorized by Shelly) until the BLU gateway firmware issue
// is resolved — the plug's energy data is always real.
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

        return {
            plug,
            climateSensor: climateSensor ?? mockClimateDevice(),
            climateSensorIsMock: !climateSensor,
            doorWindowSensor: doorWindowSensor ?? mockDoorWindowDevice(),
            doorWindowSensorIsMock: !doorWindowSensor
        };
    });
}
