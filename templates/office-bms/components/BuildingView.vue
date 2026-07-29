<template>
    <div class="building-view">
        <h2>{{ building?.name || 'Building' }}</h2>
        <EmptyState v-if="!floors.length" message="No floors set up yet in FM's Locations." icon="fas fa-building" />
        <ul v-else class="building-view__floors">
            <li v-for="floor in floors" :key="floor.id" @click="$emit('select-floor', floor.id)">
                <i class="fas fa-layer-group" />
                <span>{{ floor.name }}</span>
                <i class="fas fa-chevron-right building-view__chevron" />
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import {useLocations} from '@host';
import EmptyState from '@shared/components/EmptyState.vue';
import {computed, onMounted} from 'vue';

defineEmits<{'select-floor': [id: number]}>();

const locationsState = useLocations();

const building = computed(() =>
    locationsState.data.value.find((l) => l.kind === 'building')
);
const floors = computed(() =>
    locationsState.data.value
        .filter((l) => l.kind === 'floor' && l.parentLocationId === building.value?.id)
        .sort((a, b) => a.name.localeCompare(b.name))
);

onMounted(() => void locationsState.refresh());
</script>

<style scoped>
.building-view__floors {
    list-style: none;
    margin: 0;
    padding: 0;
    max-width: 480px;
}

.building-view__floors li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    margin-bottom: 8px;
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 14%, transparent);
    border-radius: var(--radius-md, 10px);
    background: var(--fm-template-card);
    cursor: pointer;
}

.building-view__floors li:hover {
    background: color-mix(in srgb, var(--fm-template-text) 4%, transparent);
}

.building-view__chevron {
    margin-left: auto;
    opacity: 0.4;
    font-size: 0.75rem;
}
</style>
