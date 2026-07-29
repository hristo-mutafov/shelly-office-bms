<template>
    <div class="office-bms">
        <header class="office-bms__header">
            <div>
                <p class="office-bms__eyebrow">{{ customization.clientName || 'Office BMS' }}</p>
                <h1>{{ customization.title || buildingName }}</h1>
                <p>{{ customization.subtitle || 'Building management overview' }}</p>
            </div>
            <div class="office-bms__user">
                {{ user.name || user.username || 'Not signed in' }}
            </div>
        </header>

        <main class="office-bms__content">
            <Dashboard :devices="devices.data.value" :roles="roles" />
        </main>
    </div>
</template>

<script setup lang="ts">
import {useCurrentUser, useCustomization, useDevices} from '@host';
import {computed, onMounted} from 'vue';
import Dashboard from './components/Dashboard.vue';
import {useDeviceRoles} from './composables/useDeviceRoles';

const customization = useCustomization();
const user = useCurrentUser();
const devices = useDevices();
const buildingName = 'Office Building';

const roles = useDeviceRoles(computed(() => devices.data.value));

onMounted(() => {
    void devices.refresh();
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
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-6);
    max-width: 1200px;
    margin: 0 auto 28px;
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
</style>
