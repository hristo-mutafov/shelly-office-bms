<template>
    <section class="dw-panel">
        <header class="dw-panel__header">
            <h2>Door / Window</h2>
            <MockBadge v-if="isMock" />
            <span class="dw-panel__state" :class="isOpen ? 'dw-panel__state--open' : 'dw-panel__state--closed'">
                {{ isOpen === null ? 'Unknown' : isOpen ? 'Open' : 'Closed' }}
            </span>
        </header>

        <EmptyState
            v-if="!isMock && !field"
            message="24h event history will appear once the sensor's field name is confirmed against live data."
            icon="fas fa-door-open"
        />
        <ul v-else-if="events.length" class="dw-panel__events">
            <li v-for="(event, i) in events" :key="i">
                <span class="dw-panel__event-dot" :class="event.value ? 'is-open' : 'is-closed'" />
                <span>{{ event.value ? 'Opened' : 'Closed' }}</span>
                <time>{{ formatTime(event.ts) }}</time>
            </li>
        </ul>
        <EmptyState v-else message="No open/close events in the last 24 hours." icon="fas fa-door-closed" />
    </section>
</template>

<script setup lang="ts">
import type {HostDevice} from '@host';
import EmptyState from '@shared/components/EmptyState.vue';
import MockBadge from '@shared/components/MockBadge.vue';
import {computed, ref} from 'vue';
import {useStatusTimeline} from '../composables/useStatusTimeline';
import {mockDoorWindowHistory} from '../lib/mockClimateDoorWindow';

const props = defineProps<{
    device: HostDevice;
    isMock?: boolean;
    /** device.status field for open/close events, e.g. 'bthomesensor:201.value'. */
    field?: string;
}>();

const isOpen = computed(() => props.device.capabilities?.door?.open ?? null);

const now = new Date();
const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

const timelineOptions = ref(
    !props.isMock && props.field
        ? {
              shellyID: props.device.shellyID,
              field: props.field,
              from: dayAgo.toISOString(),
              to: now.toISOString()
          }
        : null
);

const {points: liveTimelinePoints} = useStatusTimeline(timelineOptions);
const events = computed(() =>
    (props.isMock ? mockDoorWindowHistory() : liveTimelinePoints.value)
        .filter((p) => p.ts)
        .map((p) => ({ts: p.ts as string, value: Boolean(p.value)}))
        .reverse()
);

function formatTime(ts: string): string {
    return new Date(ts).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
</script>

<style scoped>
.dw-panel {
    padding: var(--space-5, 16px);
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 14%, transparent);
    border-radius: var(--radius-md, 10px);
    background: var(--fm-template-card);
}

.dw-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3, 10px);
}

.dw-panel__state {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
}

.dw-panel__state--open {
    background: color-mix(in srgb, #e0642c 18%, transparent);
    color: #e0642c;
}

.dw-panel__state--closed {
    background: color-mix(in srgb, #18a999 18%, transparent);
    color: #18a999;
}

.dw-panel__events {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 220px;
    overflow-y: auto;
}

.dw-panel__events li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
}

.dw-panel__events time {
    margin-left: auto;
    opacity: 0.6;
    font-size: 0.75rem;
}

.dw-panel__event-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.dw-panel__event-dot.is-open {
    background: #e0642c;
}

.dw-panel__event-dot.is-closed {
    background: #18a999;
}
</style>
