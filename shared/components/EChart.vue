<template>
    <div ref="el" class="echart" :style="{height}" />
</template>

<script setup lang="ts">
import * as echarts from 'echarts';
import {onBeforeUnmount, onMounted, shallowRef, watch} from 'vue';

const props = withDefaults(
    defineProps<{
        option: Record<string, unknown>;
        height?: string;
    }>(),
    {height: '260px'}
);

const el = shallowRef<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    if (!el.value) return;
    chart = echarts.init(el.value);
    chart.setOption(props.option);
    resizeObserver = new ResizeObserver(() => chart?.resize());
    resizeObserver.observe(el.value);
});

watch(
    () => props.option,
    (next) => {
        chart?.setOption(next, {notMerge: true});
    },
    {deep: true}
);

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    chart?.dispose();
    chart = null;
});
</script>

<style scoped>
.echart {
    width: 100%;
}
</style>
