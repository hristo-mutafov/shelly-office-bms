<template>
    <section class="climate-panel">
        <header class="climate-panel__header">
            <h2>Climate</h2>
        </header>

        <div class="climate-panel__live">
            <div>
                <span class="climate-panel__value">{{ temperatureLabel }}</span>
                <span class="climate-panel__unit">°C</span>
            </div>
            <div>
                <span class="climate-panel__value">{{ humidityLabel }}</span>
                <span class="climate-panel__unit">% RH</span>
            </div>
        </div>

        <EmptyState
            v-if="!temperatureField"
            message="24h history will appear once the sensor's field name is confirmed against live data."
            icon="fas fa-temperature-half"
        />
        <EChart v-else :option="chartOption" height="220px" />
    </section>
</template>

<script setup lang="ts">
import type {HostDevice} from '@host';
import EChart from '@shared/components/EChart.vue';
import EmptyState from '@shared/components/EmptyState.vue';
import {computed, ref} from 'vue';
import {useStatusHistory} from '../composables/useStatusHistory';

const props = defineProps<{
    device: HostDevice;
    /** device.status field for temperature history, e.g. 'bthomesensor:200.value'. */
    temperatureField?: string;
    humidityField?: string;
}>();

const temperatureLabel = computed(() => {
    const value = props.device.capabilities?.temperature?.temperature_c;
    return value != null ? value.toFixed(1) : '—';
});
const humidityLabel = computed(() => {
    const value = props.device.capabilities?.temperature?.humidity_pct;
    return value != null ? value.toFixed(0) : '—';
});

const now = new Date();
const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

const historyOptions = ref(
    props.temperatureField
        ? {
              shellyID: props.device.shellyID,
              field: props.temperatureField,
              from: dayAgo.toISOString(),
              to: now.toISOString()
          }
        : null
);

const {points} = useStatusHistory(historyOptions);

const chartOption = computed(() => ({
    grid: {left: 40, right: 16, top: 16, bottom: 28},
    xAxis: {
        type: 'category',
        data: points.value.map((p) => p.bucket ?? ''),
        axisLabel: {fontSize: 10}
    },
    yAxis: {type: 'value', name: '°C'},
    series: [
        {
            type: 'line',
            data: points.value.map((p) => p.avgVal ?? null),
            smooth: true,
            showSymbol: false,
            connectNulls: true
        }
    ],
    tooltip: {trigger: 'axis'}
}));
</script>

<style scoped>
.climate-panel {
    padding: var(--space-5, 16px);
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 14%, transparent);
    border-radius: var(--radius-md, 10px);
    background: var(--fm-template-card);
}

.climate-panel__header {
    margin-bottom: var(--space-3, 10px);
}

.climate-panel__live {
    display: flex;
    gap: var(--space-6, 24px);
    margin-bottom: var(--space-3, 10px);
}

.climate-panel__value {
    font-size: 1.8rem;
    font-weight: 800;
}

.climate-panel__unit {
    margin-left: 4px;
    opacity: 0.65;
    font-size: 0.8rem;
}
</style>
