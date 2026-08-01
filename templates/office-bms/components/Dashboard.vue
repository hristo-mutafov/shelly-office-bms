<template>
    <div class="dashboard">
        <section v-if="attentionItems.length" class="dashboard__attention">
            <h2>Needs attention</h2>
            <ul>
                <li v-for="(item, i) in attentionItems" :key="i">{{ item }}</li>
            </ul>
        </section>

        <section class="dashboard__kpis">
            <KpiTile
                label="Current power"
                :value="powerLabel"
                unit="W"
                icon="fas fa-bolt"
            />
            <KpiTile
                label="Consumption"
                :value="energyLabel"
                unit="kWh"
                icon="fas fa-plug-circle-bolt"
            />
            <KpiTile
                label="Temperature"
                :value="temperatureLabel"
                unit="°C"
                icon="fas fa-temperature-half"
            />
            <KpiTile
                label="Humidity"
                :value="humidityLabel"
                unit="% RH"
                icon="fas fa-droplet"
            />
            <KpiTile
                label="Open doors/windows"
                :value="openCount"
                icon="fas fa-door-open"
                :attention="openCount > 0"
            />
            <KpiTile
                label="Devices online"
                :value="onlineLabel"
                icon="fas fa-signal"
                :attention="onlineCount < devices.length"
            />
        </section>

        <section class="dashboard__panels">
            <EnergyPanel v-if="roles.plug" :key="roles.plug.shellyID" :device-id="roles.plug.shellyID" />
            <ClimatePanel
                :key="roles.climateSensor.shellyID"
                :device="roles.climateSensor"
                :is-mock="roles.climateSensorIsMock"
            />
            <DoorWindowPanel
                :key="roles.doorWindowSensor.shellyID"
                :device="roles.doorWindowSensor"
                :is-mock="roles.doorWindowSensorIsMock"
            />
        </section>

        <EmptyState
            v-if="!roles.plug"
            message="No plug onboarded yet — approve it in FM's Waiting Room to see live energy data here."
            icon="fas fa-plug"
        />

        <section v-if="devices.length" class="dashboard__devices">
            <h2>Devices</h2>
            <ul>
                <li v-for="device in devices" :key="device.shellyID" @click="selectedShellyId = device.shellyID">
                    <span class="dashboard__device-dot" :class="`is-${deviceDotState(device)}`" />
                    <span class="dashboard__device-name">
                        {{ device.name || device.shellyID }}
                        <span v-if="device.name" class="dashboard__device-id">{{ device.shellyID }}</span>
                    </span>
                    <i class="fas fa-chevron-right" />
                </li>
            </ul>
        </section>

        <DeviceDetailPopup :device="selectedDevice" @close="selectedShellyId = null" />
    </div>
</template>

<script setup lang="ts">
import type {HostDevice} from '@host';
import EmptyState from '@shared/components/EmptyState.vue';
import KpiTile from '@shared/components/KpiTile.vue';
import {computed, ref} from 'vue';
import type {DeviceRoles} from '../composables/useDeviceRoles';
import {wattHoursToKwh} from '../lib/energy';
import ClimatePanel from './ClimatePanel.vue';
import DeviceDetailPopup from './DeviceDetailPopup.vue';
import DoorWindowPanel from './DoorWindowPanel.vue';
import EnergyPanel from './EnergyPanel.vue';

const props = defineProps<{
    devices: HostDevice[];
    roles: DeviceRoles;
}>();

// Track the selected device by id, not by object reference — devices.data
// is a computed that produces fresh device objects on every store update
// (e.g. a live status push after switching relay state), so holding onto a
// snapshot reference would freeze the popup on whatever state it had at
// click time. Re-deriving it live keeps the popup in sync automatically.
const selectedShellyId = ref<string | null>(null);
const selectedDevice = computed(
    () => props.devices.find((d) => d.shellyID === selectedShellyId.value) ?? null
);

function deviceDotState(device: HostDevice): 'online' | 'offline' | 'off' {
    if (!device.online) return 'offline';
    if (device.capabilities?.relay && !device.capabilities.relay.state) return 'off';
    return 'online';
}

// device.list keeps the *last known* reading even after a device goes
// offline (nothing resets it to 0), so an unplugged plug would otherwise
// keep showing its last real wattage forever. Gate on .online so a stale
// snapshot doesn't get shown as if it were current.
const powerLabel = computed(() => {
    const plug = props.roles.plug;
    const value = plug?.online ? plug.capabilities?.energy?.power_w : null;
    return value != null ? value.toFixed(0) : '—';
});
// Unlike instantaneous power, total_energy_wh is a cumulative lifetime
// counter — it doesn't go "stale" the way a wattage reading does, so it
// stays visible even while the plug is offline (last known total is still
// an accurate total, just not up to the second).
const energyLabel = computed(() => {
    const kwh = wattHoursToKwh(props.roles.plug?.capabilities?.energy?.total_energy_wh);
    return kwh != null ? kwh.toFixed(1) : '—';
});
const temperatureLabel = computed(() => {
    const sensor = props.roles.climateSensor;
    const value = sensor.online ? sensor.capabilities?.temperature?.temperature_c : null;
    return value != null ? value.toFixed(1) : '—';
});
const humidityLabel = computed(() => {
    const sensor = props.roles.climateSensor;
    const value = sensor.online ? sensor.capabilities?.temperature?.humidity_pct : null;
    return value != null ? value.toFixed(0) : '—';
});

const openCount = computed(() => {
    // Gate on .online — an offline sensor's last-known "open" reading is
    // stale, not a live alert.
    const realOpen = props.devices.filter((d) => d.online && d.capabilities?.door?.open).length;
    const mockOpen =
        props.roles.doorWindowSensorIsMock && props.roles.doorWindowSensor.capabilities?.door?.open ? 1 : 0;
    return realOpen + mockOpen;
});
const onlineCount = computed(() => props.devices.filter((d) => d.online).length);
const onlineLabel = computed(() => `${onlineCount.value}/${props.devices.length}`);

const attentionItems = computed(() => {
    const items: string[] = [];
    for (const device of props.devices) {
        if (device.online && device.capabilities?.door?.open) {
            items.push(`${device.name || device.shellyID} is open`);
        }
        if (!device.online) {
            items.push(`${device.name || device.shellyID} is offline`);
        }
    }
    if (props.roles.doorWindowSensorIsMock && props.roles.doorWindowSensor.capabilities?.door?.open) {
        items.push(`${props.roles.doorWindowSensor.name} is open (mock)`);
    }
    const temp = props.roles.climateSensor.online
        ? props.roles.climateSensor.capabilities?.temperature?.temperature_c
        : null;
    if (temp != null && (temp < 16 || temp > 28)) {
        const suffix = props.roles.climateSensorIsMock ? ' (mock)' : '';
        items.push(`Temperature is out of comfort range (${temp.toFixed(1)}°C)${suffix}`);
    }
    return items;
});
</script>

<style scoped>
.dashboard {
    display: flex;
    flex-direction: column;
    gap: var(--space-5, 16px);
    max-width: 1200px;
    margin: 0 auto;
}

.dashboard__attention {
    padding: var(--space-4, 12px) var(--space-5, 16px);
    border-radius: var(--radius-md, 10px);
    background: color-mix(in srgb, var(--bms-status-alert, #e0642c) 10%, var(--fm-template-card));
    border: 1px solid color-mix(in srgb, var(--bms-status-alert, #e0642c) 35%, transparent);
}

.dashboard__attention h2 {
    margin: 0 0 6px;
    font-size: 0.9rem;
}

.dashboard__attention ul {
    margin: 0;
    padding-left: 18px;
    font-size: 0.85rem;
}

.dashboard__kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-4, 12px);
}

.dashboard__panels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: var(--space-4, 12px);
}

.dashboard__devices {
    padding: var(--space-5, 16px);
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 14%, transparent);
    border-radius: var(--radius-md, 10px);
    background: var(--fm-template-card);
}

.dashboard__devices h2 {
    margin: 0 0 var(--space-3, 10px);
    font-size: 1rem;
}

.dashboard__devices ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
}

.dashboard__devices li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 4px;
    cursor: pointer;
    border-bottom: 1px solid color-mix(in srgb, var(--fm-template-text) 8%, transparent);
}

.dashboard__devices li:last-child {
    border-bottom: none;
}

.dashboard__devices li:hover {
    background: color-mix(in srgb, var(--fm-template-text) 4%, transparent);
}

.dashboard__devices li i {
    margin-left: auto;
    opacity: 0.4;
    font-size: 0.75rem;
}

.dashboard__device-id {
    margin-left: 6px;
    font-size: 0.75rem;
    font-weight: 400;
    opacity: 0.5;
}

.dashboard__device-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.dashboard__device-dot.is-online {
    background: var(--bms-status-online, #18a999);
}

.dashboard__device-dot.is-offline {
    background: var(--bms-status-offline, #9ca3af);
}

.dashboard__device-dot.is-off {
    background: var(--bms-status-alert, #e0642c);
}
</style>
