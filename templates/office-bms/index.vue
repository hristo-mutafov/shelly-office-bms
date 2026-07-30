<template>
    <div class="office-bms">
        <header class="office-bms__header">
            <div class="office-bms__brand">
                <img v-if="customization.logoUrl" :src="customization.logoUrl" alt="" class="office-bms__logo" />
                <div>
                    <p class="office-bms__eyebrow">{{ customization.clientName || 'Office BMS' }}</p>
                    <h1>{{ customization.title || buildingName }}</h1>
                </div>
            </div>
            <nav class="office-bms__nav">
                <button type="button" :class="{active: nav.view.value === 'dashboard'}" @click="nav.goToDashboard()">
                    Dashboard
                </button>
                <button type="button" :class="{active: nav.view.value === 'building' || nav.view.value === 'floor'}" @click="nav.goToBuilding()">
                    Building
                </button>
                <button type="button" :class="{active: nav.view.value === 'events'}" @click="nav.goToEvents()">
                    Events
                </button>
            </nav>
            <div class="office-bms__user">
                {{ user.name || user.username || 'Not signed in' }}
            </div>
        </header>

        <nav v-if="nav.view.value === 'floor'" class="office-bms__breadcrumb">
            <button type="button" @click="nav.goToBuilding()">Building</button>
            <i class="fas fa-chevron-right" />
            <span>{{ selectedFloorName }}</span>
        </nav>

        <main class="office-bms__content">
            <Dashboard v-if="nav.view.value === 'dashboard'" :devices="devices.data.value" :roles="roles" />
            <BuildingView v-else-if="nav.view.value === 'building'" @select-floor="nav.goToFloor" />
            <FloorScheme
                v-else-if="nav.view.value === 'floor' && nav.floorId.value"
                :key="nav.floorId.value"
                :floor-location-id="nav.floorId.value"
                :floor-name="selectedFloorName"
                :devices="devices.data.value"
            />
            <EventsPanel
                v-else-if="nav.view.value === 'events'"
                :plug="roles.plug"
                :door-window-sensor="roles.doorWindowSensor"
                :door-window-sensor-is-mock="roles.doorWindowSensorIsMock"
            />
        </main>
    </div>
</template>

<script setup lang="ts">
import {useCurrentUser, useCustomization, useDevices, useLocations} from '@host';
import {computed, onMounted} from 'vue';
import BuildingView from './components/BuildingView.vue';
import Dashboard from './components/Dashboard.vue';
import EventsPanel from './components/EventsPanel.vue';
import FloorScheme from './components/FloorScheme.vue';
import {useDeviceRoles} from './composables/useDeviceRoles';
import {useTemplateNav} from './composables/useTemplateNav';

const customization = useCustomization();
const user = useCurrentUser();
const devices = useDevices();
const locationsState = useLocations();
const buildingName = 'Office Building';

const roles = useDeviceRoles(computed(() => devices.data.value));
const nav = useTemplateNav();

const selectedFloorName = computed(
    () => locationsState.data.value.find((l) => l.id === nav.floorId.value)?.name || 'Floor'
);

onMounted(() => {
    void devices.refresh();
    void locationsState.refresh();
});
</script>

<style scoped>
.office-bms {
    min-height: 100vh;
    padding: var(--space-8);
    color: var(--fm-template-text);
    background: var(--fm-template-background);
}

.office-bms__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
    max-width: 1200px;
    margin: 0 auto 20px;
}

.office-bms__brand {
    display: flex;
    align-items: center;
    gap: 12px;
}

.office-bms__logo {
    height: 36px;
    width: auto;
    object-fit: contain;
}

.office-bms__eyebrow,
.office-bms__user {
    color: var(--fm-template-accent);
    font-weight: 700;
}

.office-bms h1 {
    margin: 0;
    font-size: var(--type-subheading);
}

.office-bms__nav {
    display: flex;
    gap: 6px;
}

.office-bms__nav button {
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 20%, transparent);
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
}

.office-bms__nav button.active {
    background: var(--fm-template-accent);
    color: white;
    border-color: transparent;
}

.office-bms__breadcrumb {
    max-width: 1200px;
    margin: 0 auto 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    opacity: 0.8;
}

.office-bms__breadcrumb button {
    background: none;
    border: none;
    color: var(--fm-template-accent);
    cursor: pointer;
    font-weight: 600;
    padding: 0;
}

.office-bms__content {
    max-width: 1200px;
    margin: 0 auto;
}
</style>
