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
            <ClimatePanel v-if="roles.climateSensor" :key="roles.climateSensor.shellyID" :device="roles.climateSensor" />
            <DoorWindowPanel v-if="roles.doorWindowSensor" :key="roles.doorWindowSensor.shellyID" :device="roles.doorWindowSensor" />
        </section>

        <EmptyState
            v-if="!roles.plug && !roles.climateSensor && !roles.doorWindowSensor"
            message="No devices onboarded yet — approve them in FM's Waiting Room to see live data here."
            icon="fas fa-plug"
        />
    </div>
</template>

<script setup lang="ts">
import type {HostDevice} from '@host';
import EmptyState from '@shared/components/EmptyState.vue';
import KpiTile from '@shared/components/KpiTile.vue';
import {computed} from 'vue';
import type {DeviceRoles} from '../composables/useDeviceRoles';
import ClimatePanel from './ClimatePanel.vue';
import DoorWindowPanel from './DoorWindowPanel.vue';
import EnergyPanel from './EnergyPanel.vue';

const props = defineProps<{
    devices: HostDevice[];
    roles: DeviceRoles;
}>();

const powerLabel = computed(() => {
    const value = props.roles.plug?.capabilities?.energy?.power_w;
    return value != null ? value.toFixed(0) : '—';
});
const temperatureLabel = computed(() => {
    const value = props.roles.climateSensor?.capabilities?.temperature?.temperature_c;
    return value != null ? value.toFixed(1) : '—';
});
const humidityLabel = computed(() => {
    const value = props.roles.climateSensor?.capabilities?.temperature?.humidity_pct;
    return value != null ? value.toFixed(0) : '—';
});

const openCount = computed(
    () => props.devices.filter((d) => d.capabilities?.door?.open).length
);
const onlineCount = computed(() => props.devices.filter((d) => d.online).length);
const onlineLabel = computed(() => `${onlineCount.value}/${props.devices.length}`);

const attentionItems = computed(() => {
    const items: string[] = [];
    for (const device of props.devices) {
        if (device.capabilities?.door?.open) {
            items.push(`${device.name ?? device.shellyID} is open`);
        }
        if (!device.online) {
            items.push(`${device.name ?? device.shellyID} is offline`);
        }
    }
    const temp = props.roles.climateSensor?.capabilities?.temperature?.temperature_c;
    if (temp != null && (temp < 16 || temp > 28)) {
        items.push(`Temperature is out of comfort range (${temp.toFixed(1)}°C)`);
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
    background: color-mix(in srgb, #e0642c 10%, var(--fm-template-card));
    border: 1px solid color-mix(in srgb, #e0642c 35%, transparent);
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
</style>
