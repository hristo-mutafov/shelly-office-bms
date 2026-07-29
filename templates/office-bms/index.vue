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

        <main class="office-bms__grid">
            <section class="office-bms__panel">
                <span class="office-bms__metric">{{ devices.data.value.length }}</span>
                <span>Devices</span>
            </section>
            <section class="office-bms__panel">
                <span class="office-bms__metric">{{ onlineCount }}</span>
                <span>Online</span>
            </section>
            <section class="office-bms__panel">
                <span class="office-bms__metric">{{ floors.length }}</span>
                <span>Floors</span>
            </section>
        </main>
    </div>
</template>

<script setup lang="ts">
import {
    useCurrentUser,
    useCustomization,
    useDevices,
    useLocations
} from '@host';
import {computed, onMounted} from 'vue';

const customization = useCustomization();
const user = useCurrentUser();
const devices = useDevices();
const locationsState = useLocations();
const buildingName = 'Office Building';

const onlineCount = computed(
    () => devices.data.value.filter((device) => device.online).length
);
const floors = computed(
    () => locationsState.data.value.filter((location) => location.kind === 'floor')
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
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-6);
    max-width: 1120px;
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

.office-bms__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-4);
    max-width: 1120px;
    margin: 0 auto;
}

.office-bms__panel {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-5);
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 14%, transparent);
    border-radius: var(--radius-md);
    background: var(--fm-template-card);
}

.office-bms__metric {
    font-size: var(--type-subheading);
    font-weight: 800;
}
</style>
