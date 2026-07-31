<template>
    <div class="floor-scheme">
        <header class="floor-scheme__header">
            <h2>{{ floorName }}</h2>
            <div>
                <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="floor-scheme__file-input" @change="onFileChange" />
                <button type="button" class="floor-scheme__upload-btn" :disabled="uploading" @click="fileInput?.click()">
                    {{ uploading ? 'Processing…' : viz.floorPlan ? 'Replace schematic' : 'Upload schematic' }}
                </button>
            </div>
        </header>
        <p v-if="uploadError" class="floor-scheme__error">{{ uploadError }}</p>

        <ol class="floor-scheme__steps">
            <li :class="{done: !!viz.floorPlan}">Upload a floor plan image for this floor.</li>
            <li :class="{done: markers.length > 0}">Drag a device from "Unassigned devices" onto the plan to place it.</li>
            <li>Click a placed device's marker to view it or remove it from the plan.</li>
        </ol>

        <div class="floor-scheme__layout">
            <div
                class="floor-scheme__canvas-wrap"
                @dragover.prevent
                @drop="onDrop"
            >
                <EmptyState
                    v-if="!viz.floorPlan"
                    message="Upload a floor plan image to start placing devices."
                    icon="fas fa-file-image"
                />
                <div v-else ref="canvasEl" class="floor-scheme__canvas" :style="{aspectRatio: `${viz.floorPlan.widthPx} / ${viz.floorPlan.heightPx}`}">
                    <img :src="viz.floorPlan.url" alt="" class="floor-scheme__image" />
                    <button
                        v-for="marker in markers"
                        :key="marker.device.shellyID"
                        type="button"
                        class="floor-scheme__marker"
                        :class="{'is-online': marker.device.online, 'is-offline': !marker.device.online, 'has-alert': marker.device.online && marker.device.capabilities?.door?.open}"
                        :style="{left: `${marker.placement.x * 100}%`, top: `${marker.placement.y * 100}%`}"
                        :title="marker.device.name || marker.device.shellyID"
                        @click="selectedShellyId = marker.device.shellyID"
                    >
                        <i :class="iconFor(marker.device)" />
                    </button>
                </div>
            </div>

            <aside class="floor-scheme__tray">
                <h3>Unassigned devices</h3>
                <p v-if="!viz.floorPlan && trayDevices.length" class="floor-scheme__tray-hint">
                    Upload a floor plan (left) before you can drag devices onto it.
                </p>
                <EmptyState v-if="!trayDevices.length" message="All devices are placed on this floor." icon="fas fa-check" />
                <ul v-else>
                    <li
                        v-for="device in trayDevices"
                        :key="device.shellyID"
                        :draggable="!!viz.floorPlan"
                        :class="{'is-disabled': !viz.floorPlan}"
                        :title="viz.floorPlan ? '' : 'Upload a floor plan first'"
                        @dragstart="onDragStart($event, device.shellyID)"
                    >
                        <span class="floor-scheme__tray-dot" :class="device.online ? 'is-online' : 'is-offline'" />
                        {{ device.name || device.shellyID }}
                    </li>
                </ul>

                <div class="floor-scheme__legend">
                    <h3>Legend</h3>
                    <div><span class="floor-scheme__legend-dot is-online" /> Online</div>
                    <div><span class="floor-scheme__legend-dot is-offline" /> Offline</div>
                    <div><span class="floor-scheme__legend-dot has-alert" /> Door/window open</div>
                </div>
            </aside>
        </div>

        <DeviceDetailPopup
            :device="selectedDevice"
            unassignable
            @close="selectedShellyId = null"
            @unassign="onUnassign"
        />
    </div>
</template>

<script setup lang="ts">
import type {HostDevice} from '@host';
import EmptyState from '@shared/components/EmptyState.vue';
import {computed, ref, toRef} from 'vue';
import {useFloorGroup} from '../composables/useFloorGroup';
import {compressImageToDataUrl} from '../lib/compressImage';
import DeviceDetailPopup from './DeviceDetailPopup.vue';

const props = defineProps<{
    floorLocationId: number;
    floorName: string;
    devices: HostDevice[];
}>();

const {viz, setFloorPlan, setDevicePlacement, removeDevicePlacement} = useFloorGroup(
    toRef(props, 'floorLocationId'),
    toRef(props, 'floorName')
);

// See Dashboard.vue for why this tracks id, not object reference.
const selectedShellyId = ref<string | null>(null);
const selectedDevice = computed(
    () => props.devices.find((d) => d.shellyID === selectedShellyId.value) ?? null
);
const fileInput = ref<HTMLInputElement | null>(null);
const canvasEl = ref<HTMLDivElement | null>(null);
const uploading = ref(false);
const uploadError = ref<string | null>(null);

const markers = computed(() =>
    props.devices
        .filter((d) => viz.value.devicePlacements?.[d.shellyID])
        .map((d) => ({device: d, placement: viz.value.devicePlacements![d.shellyID]}))
);

const trayDevices = computed(() =>
    props.devices.filter((d) => !viz.value.devicePlacements?.[d.shellyID])
);

function iconFor(device: HostDevice): string {
    if (device.capabilities?.door) {
        return device.capabilities.door.open ? 'fas fa-door-open' : 'fas fa-door-closed';
    }
    if (device.capabilities?.temperature) return 'fas fa-temperature-half';
    if (device.capabilities?.relay || device.capabilities?.energy) return 'fas fa-plug';
    return 'fas fa-microchip';
}

async function onFileChange(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    uploading.value = true;
    uploadError.value = null;
    try {
        const compressed = await compressImageToDataUrl(file);
        await setFloorPlan({
            url: compressed.dataUrl,
            widthPx: compressed.widthPx,
            heightPx: compressed.heightPx
        });
    } catch (err) {
        uploadError.value = err instanceof Error ? err.message : String(err);
    } finally {
        uploading.value = false;
        if (fileInput.value) fileInput.value.value = '';
    }
}

function onDragStart(event: DragEvent, shellyID: string): void {
    event.dataTransfer?.setData('text/plain', shellyID);
}

async function onDrop(event: DragEvent): Promise<void> {
    const shellyID = event.dataTransfer?.getData('text/plain');
    if (!shellyID || !canvasEl.value) return;
    const rect = canvasEl.value.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    await setDevicePlacement(shellyID, {x, y});
}

async function onUnassign(): Promise<void> {
    if (!selectedShellyId.value) return;
    await removeDevicePlacement(selectedShellyId.value);
    selectedShellyId.value = null;
}
</script>

<style scoped>
.floor-scheme__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-4, 12px);
}

.floor-scheme__file-input {
    display: none;
}

.floor-scheme__upload-btn {
    padding: 8px 14px;
    border-radius: var(--radius-md, 10px);
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 20%, transparent);
    background: transparent;
    color: inherit;
    cursor: pointer;
}

.floor-scheme__error {
    color: #e0642c;
    font-size: 0.85rem;
}

.floor-scheme__steps {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2, 8px) var(--space-5, 16px);
    margin: 0 0 var(--space-4, 12px);
    padding: 0;
    list-style: none;
    counter-reset: step;
    font-size: 0.8rem;
    opacity: 0.75;
}

.floor-scheme__steps li {
    counter-increment: step;
    padding-left: 20px;
    position: relative;
}

.floor-scheme__steps li::before {
    content: counter(step);
    position: absolute;
    left: 0;
    top: 0;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid currentColor;
    font-size: 0.65rem;
    line-height: 14px;
    text-align: center;
}

.floor-scheme__steps li.done {
    opacity: 0.5;
    text-decoration: line-through;
}

.floor-scheme__steps li.done::before {
    content: '\2713';
    background: #18a999;
    border-color: #18a999;
    color: white;
}

.floor-scheme__tray-hint {
    font-size: 0.75rem;
    opacity: 0.7;
    margin: 0 0 var(--space-3, 10px);
}

.floor-scheme__layout {
    display: grid;
    grid-template-columns: 1fr 240px;
    gap: var(--space-4, 12px);
}

.floor-scheme__canvas-wrap {
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 14%, transparent);
    border-radius: var(--radius-md, 10px);
    background: var(--fm-template-card);
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.floor-scheme__canvas {
    position: relative;
    width: 100%;
    max-height: 70vh;
}

.floor-scheme__image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
}

.floor-scheme__marker {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    font-size: 0.75rem;
}

.floor-scheme__marker.is-online {
    background: #18a999;
}

.floor-scheme__marker.is-offline {
    background: #9ca3af;
}

.floor-scheme__marker.has-alert {
    box-shadow: 0 0 0 3px #e0642c;
}

.floor-scheme__tray ul {
    list-style: none;
    margin: 0 0 var(--space-4, 12px);
    padding: 0;
}

.floor-scheme__tray li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    margin-bottom: 6px;
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 14%, transparent);
    border-radius: 8px;
    cursor: grab;
    font-size: 0.85rem;
    background: var(--fm-template-card);
}

.floor-scheme__tray li.is-disabled {
    cursor: not-allowed;
    opacity: 0.45;
}

.floor-scheme__tray-dot,
.floor-scheme__legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
}

.floor-scheme__tray-dot.is-online,
.floor-scheme__legend-dot.is-online {
    background: #18a999;
}

.floor-scheme__tray-dot.is-offline,
.floor-scheme__legend-dot.is-offline {
    background: #9ca3af;
}

.floor-scheme__legend-dot.has-alert {
    background: white;
    box-shadow: 0 0 0 3px #e0642c;
}

.floor-scheme__legend {
    font-size: 0.8rem;
}

.floor-scheme__legend div {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
}
</style>
