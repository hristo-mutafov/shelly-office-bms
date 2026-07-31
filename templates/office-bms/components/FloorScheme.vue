<template>
    <div class="floor-scheme">
        <header class="floor-scheme__header">
            <h2><i class="fas fa-layer-group" /> {{ floorName }}</h2>
            <div>
                <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="floor-scheme__file-input" @change="onFileChange" />
                <button
                    type="button"
                    class="floor-scheme__upload-btn"
                    :disabled="uploading || floorBlocked"
                    @click="fileInput?.click()"
                >
                    {{
                        floorLoading
                            ? 'Loading floor…'
                            : floorError
                              ? 'Retry above first'
                              : uploading
                                ? 'Processing…'
                                : viz.floorPlan
                                  ? 'Replace schematic'
                                  : 'Upload schematic'
                    }}
                </button>
            </div>
        </header>
        <p v-if="uploadError" class="floor-scheme__error">{{ uploadError }}</p>

        <div class="floor-scheme__layout">
            <div
                class="floor-scheme__canvas-wrap"
                :class="{'is-drag-over': isDraggingOver}"
                @dragover.prevent="onDragOver"
                @dragleave.prevent="isDraggingOver = false"
                @drop.prevent="onDrop"
            >
                <EmptyState
                    v-if="floorLoading"
                    message="Loading this floor…"
                    icon="fas fa-spinner fa-spin"
                />
                <div v-else-if="floorError" class="floor-scheme__load-error">
                    <EmptyState :message="`Couldn't load this floor: ${floorError}`" icon="fas fa-triangle-exclamation" />
                    <button type="button" class="floor-scheme__retry-btn" @click="reloadFloor">Retry</button>
                </div>
                <EmptyState
                    v-else-if="!viz.floorPlan"
                    message="Upload or drag and drop a floor plan image here to start placing devices."
                    icon="fas fa-file-image"
                />
                <div v-else ref="canvasEl" class="floor-scheme__canvas" :style="{aspectRatio: `${viz.floorPlan.widthPx} / ${viz.floorPlan.heightPx}`}">
                    <img :src="viz.floorPlan.url" alt="" class="floor-scheme__image" />
                    <button
                        v-for="marker in markers"
                        :key="marker.device.shellyID"
                        type="button"
                        class="floor-scheme__marker"
                        :class="{
                            'is-online': isMarkerActive(marker.device),
                            'is-offline': !isMarkerActive(marker.device),
                            'has-alert': marker.device.online && marker.device.capabilities?.door?.open
                        }"
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
                <p v-if="!floorBlocked && !viz.floorPlan && trayDevices.length" class="floor-scheme__tray-hint">
                    Upload a floor plan (left) before you can drag devices onto it.
                </p>
                <EmptyState v-if="!trayDevices.length" message="All devices are placed on this floor." icon="fas fa-check" />
                <ul v-else>
                    <li
                        v-for="device in trayDevices"
                        :key="device.shellyID"
                        :draggable="!!viz.floorPlan && !floorBlocked"
                        :class="{'is-disabled': !viz.floorPlan || floorBlocked}"
                        :title="floorLoading ? 'Loading floor…' : floorError ? 'Retry loading the floor first' : viz.floorPlan ? '' : 'Upload a floor plan first'"
                        @dragstart="onDragStart($event, device.shellyID)"
                    >
                        <span class="floor-scheme__tray-dot" :class="device.online ? 'is-online' : 'is-offline'" />
                        {{ device.name || device.shellyID }}
                    </li>
                </ul>

                <div class="floor-scheme__legend">
                    <h3>Legend</h3>
                    <div><span class="floor-scheme__legend-dot is-online" /> Online / on</div>
                    <div><span class="floor-scheme__legend-dot is-offline" /> Offline / off</div>
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
import {extractErrorMessage} from '../lib/errors';
import DeviceDetailPopup from './DeviceDetailPopup.vue';

const props = defineProps<{
    floorLocationId: number;
    floorName: string;
    devices: HostDevice[];
}>();

const {
    viz,
    loading: floorLoading,
    error: floorError,
    setFloorPlan,
    setDevicePlacement,
    removeDevicePlacement,
    reload: reloadFloor
} = useFloorGroup(toRef(props, 'floorLocationId'), toRef(props, 'floorName'));

// See Dashboard.vue for why this tracks id, not object reference.
const selectedShellyId = ref<string | null>(null);
const selectedDevice = computed(
    () => props.devices.find((d) => d.shellyID === selectedShellyId.value) ?? null
);
const fileInput = ref<HTMLInputElement | null>(null);
const canvasEl = ref<HTMLDivElement | null>(null);
const uploading = ref(false);
const uploadError = ref<string | null>(null);
const isDraggingOver = ref(false);
const floorBlocked = computed(() => floorLoading.value || !!floorError.value);

const markers = computed(() =>
    props.devices
        .filter((d) => viz.value.devicePlacements?.[d.shellyID])
        .map((d) => ({device: d, placement: viz.value.devicePlacements![d.shellyID]}))
);

const trayDevices = computed(() =>
    props.devices.filter((d) => !viz.value.devicePlacements?.[d.shellyID])
);

// Per the legend, the green/gray marker color means "on" as well as
// "online" — a relay-bearing device (the plug) that's switched off reads as
// gray even while still connected, not just when it drops offline entirely.
function isMarkerActive(device: HostDevice): boolean {
    if (!device.online) return false;
    if (device.capabilities?.relay) return device.capabilities.relay.state;
    return true;
}

function iconFor(device: HostDevice): string {
    if (device.capabilities?.door) {
        return device.capabilities.door.open ? 'fas fa-door-open' : 'fas fa-door-closed';
    }
    // Relay-bearing devices (the plug) show their on/off state, not just a
    // static plug icon — otherwise switching it off/on is invisible here.
    if (device.capabilities?.relay) {
        return device.capabilities.relay.state ? 'fas fa-plug-circle-check' : 'fas fa-plug-circle-xmark';
    }
    if (device.capabilities?.temperature) return 'fas fa-temperature-half';
    if (device.capabilities?.energy) return 'fas fa-plug';
    return 'fas fa-microchip';
}

async function uploadFloorPlan(file: File): Promise<void> {
    if (floorBlocked.value) {
        uploadError.value = floorError.value
            ? 'This floor failed to load — click Retry above first.'
            : 'Still loading this floor — try again in a moment.';
        return;
    }
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
        uploadError.value = extractErrorMessage(err);
    } finally {
        uploading.value = false;
    }
}

async function onFileChange(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await uploadFloorPlan(file);
    if (fileInput.value) fileInput.value.value = '';
}

function onDragOver(): void {
    if (!floorBlocked.value) isDraggingOver.value = true;
}

function onDragStart(event: DragEvent, shellyID: string): void {
    event.dataTransfer?.setData('text/plain', shellyID);
}

async function onDrop(event: DragEvent): Promise<void> {
    isDraggingOver.value = false;
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
        await uploadFloorPlan(file);
        return;
    }
    const shellyID = event.dataTransfer?.getData('text/plain');
    if (!shellyID || !canvasEl.value || floorBlocked.value) return;
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

.floor-scheme__header h2 {
    display: flex;
    align-items: center;
    gap: 10px;
}

.floor-scheme__header h2 i {
    color: var(--fm-template-accent);
    font-size: 0.85em;
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

.floor-scheme__load-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3, 10px);
}

.floor-scheme__retry-btn {
    padding: 6px 16px;
    border-radius: var(--radius-md, 10px);
    border: 1px solid color-mix(in srgb, #e0642c 40%, transparent);
    background: transparent;
    color: #e0642c;
    font-weight: 600;
    cursor: pointer;
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
    transition: border-color 0.15s ease, background 0.15s ease;
}

.floor-scheme__canvas-wrap.is-drag-over {
    border-color: var(--fm-template-accent);
    background: color-mix(in srgb, var(--fm-template-accent) 6%, var(--fm-template-card));
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

.floor-scheme__tray :deep(.empty-state) {
    padding: var(--space-4, 12px);
    border: 1px solid color-mix(in srgb, #18a999 35%, transparent);
    border-radius: var(--radius-md, 10px);
    color: #18a999;
    background: color-mix(in srgb, #18a999 8%, transparent);
}

.floor-scheme__tray :deep(.empty-state i) {
    font-size: 1.1rem;
}

.floor-scheme__tray :deep(.empty-state p) {
    font-size: 0.8rem;
    margin: 0;
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
