<template>
    <div class="kpi-tile" :class="{'kpi-tile--attention': attention}">
        <div class="kpi-tile__icon" v-if="icon">
            <i :class="icon" />
        </div>
        <div class="kpi-tile__body">
            <span class="kpi-tile__label">{{ label }}</span>
            <span class="kpi-tile__value">
                {{ value }}<span v-if="unit" class="kpi-tile__unit">{{ unit }}</span>
            </span>
            <span v-if="hint" class="kpi-tile__hint">{{ hint }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    label: string;
    value: string | number;
    unit?: string;
    icon?: string;
    hint?: string;
    attention?: boolean;
}>();
</script>

<style scoped>
.kpi-tile {
    display: flex;
    align-items: center;
    gap: var(--space-4, 12px);
    padding: var(--space-5, 16px);
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 14%, transparent);
    border-radius: var(--radius-md, 10px);
    background: var(--fm-template-card);
}

.kpi-tile--attention {
    border-color: color-mix(in srgb, var(--bms-status-alert, #e0642c) 55%, transparent);
    background: color-mix(in srgb, var(--bms-status-alert, #e0642c) 8%, var(--fm-template-card));
}

.kpi-tile__icon {
    font-size: 1.4rem;
    color: var(--fm-template-accent);
}

.kpi-tile__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.kpi-tile__label {
    font-size: 0.8rem;
    opacity: 0.7;
}

.kpi-tile__value {
    font-size: var(--type-subheading, 1.5rem);
    font-weight: 800;
}

.kpi-tile__unit {
    font-size: 0.75rem;
    font-weight: 600;
    margin-left: 2px;
    opacity: 0.7;
}

.kpi-tile__hint {
    font-size: 0.75rem;
    opacity: 0.65;
}
</style>
