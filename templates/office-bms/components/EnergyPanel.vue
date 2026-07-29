<template>
    <section class="energy-panel">
        <header class="energy-panel__header">
            <h2>Energy</h2>
            <div class="energy-panel__range">
                <button
                    v-for="r in ranges"
                    :key="r.value"
                    type="button"
                    :class="{active: range === r.value}"
                    @click="setRange(r.value)"
                >
                    {{ r.label }}
                </button>
            </div>
        </header>

        <div class="energy-panel__live">
            <span class="energy-panel__watts">{{ liveWattsLabel }}</span>
            <span class="energy-panel__watts-unit">W now</span>
        </div>

        <EmptyState v-if="!historyPoints.length && !historyLoading" message="No consumption data yet for this range." icon="fas fa-bolt" />
        <EChart v-else :option="chartOption" height="240px" />
    </section>
</template>

<script setup lang="ts">
import {metrics, useLiveMetric} from '@host';
import EChart from '@shared/components/EChart.vue';
import EmptyState from '@shared/components/EmptyState.vue';
import {computed, onMounted, ref} from 'vue';

const props = defineProps<{deviceId: string}>();

const live = useLiveMetric({devices: [props.deviceId], intervalMs: 3000});
const liveWattsLabel = computed(() =>
    live.data.value ? live.watts.value.toFixed(0) : '—'
);

type RangeValue = 'day' | 'week' | 'month';
const ranges: {value: RangeValue; label: string}[] = [
    {value: 'day', label: 'Day'},
    {value: 'week', label: 'Week'},
    {value: 'month', label: 'Month'}
];
const range = ref<RangeValue>('day');

const historyPoints = ref<{bucket: string; watts: number}[]>([]);
const historyLoading = ref(false);

type Bucket = '1 hour' | '1 day';

function rangeToWindow(value: RangeValue): {from: string; to: string; bucket: Bucket} {
    const to = new Date();
    const from = new Date(to);
    let bucket: Bucket = '1 hour';
    if (value === 'day') {
        from.setDate(from.getDate() - 1);
        bucket = '1 hour';
    } else if (value === 'week') {
        from.setDate(from.getDate() - 7);
        bucket = '1 day';
    } else {
        from.setMonth(from.getMonth() - 1);
        bucket = '1 day';
    }
    return {from: from.toISOString(), to: to.toISOString(), bucket};
}

async function loadHistory(): Promise<void> {
    historyLoading.value = true;
    try {
        const window = rangeToWindow(range.value);
        const res = await metrics.history({
            devices: [props.deviceId],
            from: window.from,
            to: window.to,
            bucket: window.bucket,
            tags: ['power'],
            commodity: 'electricity',
            electricalSource: 'ac_mains'
        });
        historyPoints.value = (res.items ?? []).map((item) => ({
            bucket: String((item as {bucket?: string}).bucket ?? ''),
            watts: Number((item as {value?: number}).value ?? 0)
        }));
    } finally {
        historyLoading.value = false;
    }
}

function setRange(value: RangeValue): void {
    range.value = value;
    void loadHistory();
}

onMounted(() => void loadHistory());

const chartOption = computed(() => ({
    grid: {left: 40, right: 16, top: 16, bottom: 28},
    xAxis: {
        type: 'category',
        data: historyPoints.value.map((p) => p.bucket),
        axisLabel: {fontSize: 10}
    },
    yAxis: {type: 'value', name: 'W'},
    series: [
        {
            type: 'line',
            data: historyPoints.value.map((p) => p.watts),
            smooth: true,
            areaStyle: {opacity: 0.15},
            showSymbol: false
        }
    ],
    tooltip: {trigger: 'axis'}
}));
</script>

<style scoped>
.energy-panel {
    padding: var(--space-5, 16px);
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 14%, transparent);
    border-radius: var(--radius-md, 10px);
    background: var(--fm-template-card);
}

.energy-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3, 10px);
}

.energy-panel__range button {
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 20%, transparent);
    background: transparent;
    color: inherit;
    padding: 4px 10px;
    font-size: 0.75rem;
    cursor: pointer;
    border-radius: 6px;
    margin-left: 4px;
}

.energy-panel__range button.active {
    background: var(--fm-template-accent);
    color: white;
    border-color: transparent;
}

.energy-panel__live {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: var(--space-3, 10px);
}

.energy-panel__watts {
    font-size: 2rem;
    font-weight: 800;
}

.energy-panel__watts-unit {
    opacity: 0.65;
    font-size: 0.85rem;
}
</style>
