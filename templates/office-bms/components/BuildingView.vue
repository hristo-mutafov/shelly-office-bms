<template>
    <div class="building-view">
        <div class="building-view__toolbar">
            <h2>{{ building?.name || 'Building' }}</h2>
            <button type="button" class="building-view__daynight" @click="isDay = !isDay">
                <i :class="isDay ? 'fas fa-sun' : 'fas fa-moon'" />
                {{ isDay ? 'Day' : 'Night' }}
            </button>
        </div>

        <EmptyState v-if="!floors.length" message="No floors set up yet in FM's Locations." icon="fas fa-building" />

        <template v-else>
            <div
                class="building-view__stage"
                :class="{'is-night': !isDay}"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp"
                @pointerleave="onPointerUp"
                @wheel.prevent="onWheel"
            >
                <div class="building-view__sky">
                    <div class="building-view__orb" :class="isDay ? 'is-sun' : 'is-moon'" />
                </div>
                <div class="building-view__world" :style="worldStyle">
                    <div class="building-view__ground" />
                    <Box3D
                        v-for="(floor, i) in floors"
                        :key="floor.id"
                        :width="boxWidth"
                        :depth="boxDepth"
                        :height="floorHeight"
                        :y="i * (floorHeight + floorGap)"
                        :color="floorColor"
                        :lit="isDay"
                    >
                        <button type="button" class="building-view__floor-label" @click="onFloorClick(floor.id)">
                            {{ floor.name }}
                        </button>
                    </Box3D>
                </div>
            </div>
            <p class="building-view__hint">Drag to rotate, scroll to zoom, click a floor to open it.</p>

            <ul class="building-view__list">
                <li v-for="floor in floors" :key="floor.id" @click="onFloorClick(floor.id)">
                    <i class="fas fa-layer-group" />
                    <span>{{ floor.name }}</span>
                    <i class="fas fa-chevron-right building-view__chevron" />
                </li>
            </ul>
        </template>
    </div>
</template>

<script setup lang="ts">
import {useCustomization, useLocations} from '@host';
import Box3D from '@shared/components/Box3D.vue';
import EmptyState from '@shared/components/EmptyState.vue';
import {computed, onMounted, ref} from 'vue';

const emit = defineEmits<{'select-floor': [id: number]}>();

const locationsState = useLocations();
const customization = useCustomization();
const theme = computed(() => customization.value.theme);

const building = computed(() =>
    locationsState.data.value.find((l) => l.kind === 'building')
);
const floors = computed(() =>
    locationsState.data.value
        .filter((l) => l.kind === 'floor' && l.parentLocationId === building.value?.id)
        .sort((a, b) => a.name.localeCompare(b.name))
);

onMounted(() => void locationsState.refresh());

const boxWidth = 220;
const boxDepth = 150;
const floorHeight = 64;
const floorGap = 6;
const floorColor = computed(() => theme.value?.accent || '#3b6fd6');

const isDay = ref(true);
const yaw = ref(-35);
const pitch = ref(-24);
const zoom = ref(1);

const worldStyle = computed(() => ({
    transform: `rotateX(${pitch.value}deg) rotateY(${yaw.value}deg) scale(${zoom.value})`
}));

let dragging = false;
let lastX = 0;
let lastY = 0;
let dragDistance = 0;

function onPointerDown(event: PointerEvent): void {
    dragging = true;
    dragDistance = 0;
    lastX = event.clientX;
    lastY = event.clientY;
}

function onPointerMove(event: PointerEvent): void {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    dragDistance += Math.abs(dx) + Math.abs(dy);
    yaw.value += dx * 0.4;
    pitch.value = Math.min(-5, Math.max(-70, pitch.value - dy * 0.3));
    lastX = event.clientX;
    lastY = event.clientY;
}

function onPointerUp(): void {
    dragging = false;
}

function onWheel(event: WheelEvent): void {
    zoom.value = Math.min(1.8, Math.max(0.6, zoom.value - event.deltaY * 0.001));
}

function onFloorClick(id: number): void {
    if (dragDistance > 6) return;
    emit('select-floor', id);
}
</script>

<style scoped>
.building-view__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3, 10px);
}

.building-view__daynight {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 20%, transparent);
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 0.8rem;
}

.building-view__stage {
    position: relative;
    height: 420px;
    border-radius: var(--radius-md, 10px);
    overflow: hidden;
    perspective: 1400px;
    perspective-origin: 50% 30%;
    cursor: grab;
    touch-action: none;
}

.building-view__stage:active {
    cursor: grabbing;
}

.building-view__sky {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, #bcdcff 0%, #eef6ff 70%);
    transition: background 0.6s ease;
}

.building-view__stage.is-night .building-view__sky {
    background: linear-gradient(180deg, #0b1330 0%, #1c2b52 70%);
}

.building-view__orb {
    position: absolute;
    top: 40px;
    right: 60px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    transition: all 0.6s ease;
}

.building-view__orb.is-sun {
    background: #ffd166;
    box-shadow: 0 0 40px 10px rgba(255, 209, 102, 0.6);
}

.building-view__orb.is-moon {
    background: #e8ecf7;
    box-shadow: 0 0 24px 6px rgba(232, 236, 247, 0.35);
}

.building-view__world {
    position: absolute;
    left: 50%;
    top: 62%;
    transform-style: preserve-3d;
}

.building-view__ground {
    position: absolute;
    width: 420px;
    height: 320px;
    left: -210px;
    top: -160px;
    background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0) 70%);
    transform: rotateX(90deg) translateZ(-4px);
}

.building-view__floor-label {
    background: rgba(0, 0, 0, 0.35);
    color: white;
    border: none;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
}

.building-view__hint {
    text-align: center;
    font-size: 0.75rem;
    opacity: 0.55;
    margin: 8px 0 20px;
}

.building-view__list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-width: 480px;
}

.building-view__list li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    margin-bottom: 8px;
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 14%, transparent);
    border-radius: var(--radius-md, 10px);
    background: var(--fm-template-card);
    cursor: pointer;
}

.building-view__list li:hover {
    background: color-mix(in srgb, var(--fm-template-text) 4%, transparent);
}

.building-view__chevron {
    margin-left: auto;
    opacity: 0.4;
    font-size: 0.75rem;
}
</style>
