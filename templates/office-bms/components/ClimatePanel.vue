<template>
    <section class="climate-panel">
        <header class="climate-panel__header">
            <h2>Climate</h2>
            <MockBadge v-if="isMock" />
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
            v-if="!points.length"
            message="No temperature history available for this sensor yet."
            icon="fas fa-temperature-half"
        />
        <EChart v-else :option="chartOption" height="220px" />
    </section>
</template>

<script setup lang="ts">
import type {HostDevice} from '@host';
import EChart from '@shared/components/EChart.vue';
import EmptyState from '@shared/components/EmptyState.vue';
import MockBadge from '@shared/components/MockBadge.vue';
import {computed, ref} from 'vue';
import {useStatusHistory} from '../composables/useStatusHistory';
import {findBthomeField} from '../lib/bthome';
import {formatChartBuckets} from '../lib/formatChartTime';
import {mockClimateHistory} from '../lib/mockClimateDoorWindow';

const props = defineProps<{
    device: HostDevice;
    isMock?: boolean;
}>();

// device.list keeps the last known reading even after a sensor drops
// offline — gate on .online so a stale snapshot isn't shown as current,
// same fix as the Dashboard power KPI.
const temperatureLabel = computed(() => {
    const value = props.device.online ? props.device.capabilities?.temperature?.temperature_c : null;
    return value != null ? value.toFixed(1) : '—';
});
const humidityLabel = computed(() => {
    const value = props.device.online ? props.device.capabilities?.temperature?.humidity_pct : null;
    return value != null ? value.toFixed(0) : '—';
});

const now = new Date();
const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

// The BTHome component index (bthomesensor:<n>) is assigned per-device at
// pairing time, so it can't be hardcoded — discover it from the device's own
// status/settings instead, the same way the backend's capability mapper
// does. This is what lets the chart work on real hardware we've never
// tested, instead of needing a guessed field name baked in ahead of time.
const temperatureField = props.isMock ? null : findBthomeField(props.device, ['temperature']);

const historyOptions = ref(
    temperatureField
        ? {
              shellyID: props.device.shellyID,
              field: temperatureField,
              from: dayAgo.toISOString(),
              to: now.toISOString()
          }
        : null
);

const {points: liveHistoryPoints} = useStatusHistory(historyOptions);
const points = computed(() => (props.isMock ? mockClimateHistory() : liveHistoryPoints.value));

const chartOption = computed(() => ({
    grid: {left: 40, right: 16, top: 16, bottom: 28},
    xAxis: {
        type: 'category',
        data: formatChartBuckets(points.value.map((p) => p.bucket)),
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
    display: flex;
    align-items: center;
    gap: 8px;
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
