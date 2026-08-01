<template>
    <section class="dw-panel">
        <header class="dw-panel__header">
            <h2>Door / Window <span class="dw-panel__range">· 24h</span></h2>
            <MockBadge v-if="isMock" />
            <span class="dw-panel__state" :class="isOpen ? 'dw-panel__state--open' : 'dw-panel__state--closed'">
                {{ isOpen === null ? 'Unknown' : isOpen ? 'Open' : 'Closed' }}
            </span>
        </header>

        <ul v-if="events.length" class="dw-panel__events">
            <li v-for="(event, i) in events" :key="i">
                <span class="dw-panel__event-dot" :class="event.value ? 'is-open' : 'is-closed'" />
                <span>{{ event.value ? 'Opened' : 'Closed' }}</span>
                <time>{{ formatEventTime(event.ts) }}</time>
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
import {useDeviceEvents} from '../composables/useDeviceEvents';
import {formatEventTime} from '../lib/formatChartTime';
import {mockDoorWindowHistory} from '../lib/mockClimateDoorWindow';

const props = defineProps<{
    device: HostDevice;
    isMock?: boolean;
}>();

// device.list keeps the last known reading even after a sensor drops
// offline — gate on .online so a stale open/closed snapshot isn't shown as
// current, same fix as the Dashboard power KPI.
const isOpen = computed(() =>
    props.device.online ? (props.device.capabilities?.door?.open ?? null) : null
);

const now = new Date();
const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

// device.status can't hold this (numeric-only column) — read the discrete
// open/close transitions from the device-events journal instead. No
// component filter: a BLU door/window sensor's exact component key isn't
// confirmed yet, so this takes whatever boolean-valued state change it
// reports rather than guessing a specific field name.
const eventOptions = ref(
    !props.isMock
        ? {
              shellyIds: [props.device.shellyID],
              from: dayAgo.toISOString(),
              to: now.toISOString()
          }
        : null
);
const {events: liveEvents} = useDeviceEvents(eventOptions);

const events = computed(() =>
    (props.isMock
        ? mockDoorWindowHistory()
              .filter((p) => p.ts)
              .map((p) => ({ts: p.ts as string, value: Boolean(p.value)}))
        : liveEvents.value
              .filter((e) => typeof e.next === 'boolean')
              .map((e) => ({ts: e.ts, value: e.next as boolean}))
    ).reverse()
);

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

.dw-panel__range {
    font-size: 0.7rem;
    font-weight: 400;
    opacity: 0.55;
}

.dw-panel__state {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
}

.dw-panel__state--open {
    background: color-mix(in srgb, var(--bms-status-alert, #e0642c) 18%, transparent);
    color: var(--bms-status-alert, #e0642c);
}

.dw-panel__state--closed {
    background: color-mix(in srgb, var(--bms-status-online, #18a999) 18%, transparent);
    color: var(--bms-status-online, #18a999);
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
    background: var(--bms-status-alert, #e0642c);
}

.dw-panel__event-dot.is-closed {
    background: var(--bms-status-online, #18a999);
}
</style>
