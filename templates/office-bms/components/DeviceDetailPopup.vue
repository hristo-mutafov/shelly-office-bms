<template>
    <Modal :open="!!device" :title="device?.name || device?.shellyID || 'Device'" @close="$emit('close')">
        <template v-if="device">
            <div class="device-popup__status">
                <span class="device-popup__badge" :class="device.online ? 'is-online' : 'is-offline'">
                    {{ device.online ? 'Online' : 'Offline' }}
                </span>
            </div>

            <dl v-if="device.capabilities?.energy" class="device-popup__readings">
                <div>
                    <dt>Power</dt>
                    <dd>{{ formatNum(device.capabilities.energy.power_w) }} W</dd>
                </div>
                <div>
                    <dt>Total energy</dt>
                    <dd>{{ formatNum(wattHoursToKwh(device.capabilities.energy.total_energy_wh)) }} kWh</dd>
                </div>
            </dl>

            <dl v-if="device.capabilities?.temperature" class="device-popup__readings">
                <div>
                    <dt>Temperature</dt>
                    <dd>{{ formatNum(device.capabilities.temperature.temperature_c) }} °C</dd>
                </div>
                <div>
                    <dt>Humidity</dt>
                    <dd>{{ formatNum(device.capabilities.temperature.humidity_pct) }} %</dd>
                </div>
            </dl>

            <dl v-if="device.capabilities?.door" class="device-popup__readings">
                <div>
                    <dt>State</dt>
                    <dd>{{ device.capabilities.door.open ? 'Open' : 'Closed' }}</dd>
                </div>
            </dl>

            <div v-if="device.capabilities?.relay" class="device-popup__control">
                <button
                    type="button"
                    class="device-popup__toggle"
                    :class="{on: device.capabilities.relay.state}"
                    :disabled="switching || !device.online"
                    @click="toggleRelay"
                >
                    {{ switching ? 'Switching…' : device.capabilities.relay.state ? 'Turn off' : 'Turn on' }}
                </button>
                <p v-if="switchError" class="device-popup__error">{{ switchError }}</p>
            </div>
        </template>
    </Modal>
</template>

<script setup lang="ts">
import type {HostDevice} from '@host';
import {devices} from '@host';
import Modal from '@shared/components/Modal.vue';
import {ref} from 'vue';

const props = defineProps<{device: HostDevice | null}>();
defineEmits<{close: []}>();

const switching = ref(false);
const switchError = ref<string | null>(null);

function formatNum(value: number | null | undefined): string {
    return value != null ? value.toFixed(1) : '—';
}

function wattHoursToKwh(value: number | null | undefined): number | null {
    return value != null ? value / 1000 : null;
}

async function toggleRelay(): Promise<void> {
    if (!props.device) return;
    switching.value = true;
    switchError.value = null;
    try {
        await devices.call(props.device.shellyID, 'Switch.Set', {
            id: 0,
            on: !props.device.capabilities?.relay?.state
        });
    } catch (err) {
        switchError.value = err instanceof Error ? err.message : String(err);
    } finally {
        switching.value = false;
    }
}
</script>

<style scoped>
.device-popup__status {
    margin-bottom: var(--space-4, 12px);
}

.device-popup__badge {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
}

.device-popup__badge.is-online {
    background: color-mix(in srgb, #18a999 18%, transparent);
    color: #18a999;
}

.device-popup__badge.is-offline {
    background: color-mix(in srgb, #9ca3af 25%, transparent);
    color: #6b7280;
}

.device-popup__readings {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3, 10px);
    margin: 0 0 var(--space-4, 12px);
}

.device-popup__readings dt {
    font-size: 0.7rem;
    opacity: 0.65;
}

.device-popup__readings dd {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
}

.device-popup__toggle {
    width: 100%;
    padding: 10px;
    border-radius: var(--radius-md, 10px);
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 20%, transparent);
    background: transparent;
    color: inherit;
    font-weight: 700;
    cursor: pointer;
}

.device-popup__toggle.on {
    background: var(--fm-template-accent);
    color: white;
    border-color: transparent;
}

.device-popup__toggle:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.device-popup__error {
    color: #e0642c;
    font-size: 0.8rem;
    margin: 8px 0 0;
}
</style>
