<template>
    <div class="events-panel">
        <h2>Device events — last 24 hours</h2>
        <EmptyState v-if="!events.length" message="No device events in the last 24 hours." icon="fas fa-clock-rotate-left" />
        <ul v-else class="events-panel__list">
            <li v-for="(event, i) in events" :key="i">
                <span class="events-panel__dot" :class="event.kind" />
                <i :class="event.icon" />
                <span class="events-panel__desc">{{ event.description }}</span>
                <MockBadge v-if="event.isMock" />
                <time>{{ formatTime(event.ts) }}</time>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import type {HostDevice} from '@host';
import EmptyState from '@shared/components/EmptyState.vue';
import MockBadge from '@shared/components/MockBadge.vue';
import {computed, ref} from 'vue';
import {useDeviceEvents} from '../composables/useDeviceEvents';
import {mockDoorWindowHistory} from '../lib/mockClimateDoorWindow';

const props = defineProps<{
    plug: HostDevice | null;
    doorWindowSensor: HostDevice;
    doorWindowSensorIsMock: boolean;
}>();

type FeedEvent = {
    ts: string;
    kind: 'relay' | 'door';
    icon: string;
    description: string;
    isMock: boolean;
};

const now = new Date();
const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

// device.status only stores numeric telemetry — relay on/off and door
// open/closed are discrete state changes, which live in the separate
// device-events journal instead (see useDeviceEvents for why).
const relayEventOptions = ref(
    props.plug
        ? {
              shellyIds: [props.plug.shellyID],
              component: 'switch:0',
              from: dayAgo.toISOString(),
              to: now.toISOString()
          }
        : null
);
const {events: relayRawEvents} = useDeviceEvents(relayEventOptions);

const events = computed<FeedEvent[]>(() => {
    const relayEvents: FeedEvent[] = relayRawEvents.value
        .filter((e) => e.field === 'output')
        .map((e) => ({
            ts: e.ts,
            kind: 'relay',
            icon: e.next ? 'fas fa-plug-circle-check' : 'fas fa-plug-circle-xmark',
            description: `${props.plug?.name || 'Plug'} turned ${e.next ? 'on' : 'off'}`,
            isMock: false
        }));

    const doorEvents: FeedEvent[] = props.doorWindowSensorIsMock
        ? mockDoorWindowHistory()
              .filter((p) => p.ts)
              .map((p) => ({
                  ts: p.ts as string,
                  kind: 'door' as const,
                  icon: p.value ? 'fas fa-door-open' : 'fas fa-door-closed',
                  description: `${props.doorWindowSensor.name} ${p.value ? 'opened' : 'closed'}`,
                  isMock: true
              }))
        : [];

    return [...relayEvents, ...doorEvents].sort((a, b) => b.ts.localeCompare(a.ts));
});

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
.events-panel {
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-5, 16px);
    border: 1px solid color-mix(in srgb, var(--fm-template-text) 14%, transparent);
    border-radius: var(--radius-md, 10px);
    background: var(--fm-template-card);
}

.events-panel h2 {
    margin: 0 0 var(--space-4, 12px);
    font-size: 1rem;
}

.events-panel__list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.events-panel__list li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 4px;
    border-bottom: 1px solid color-mix(in srgb, var(--fm-template-text) 8%, transparent);
    font-size: 0.85rem;
}

.events-panel__list li:last-child {
    border-bottom: none;
}

.events-panel__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.events-panel__dot.relay {
    background: var(--fm-template-accent);
}

.events-panel__dot.door {
    background: #e0642c;
}

.events-panel__desc {
    flex: 1;
}

.events-panel__list time {
    opacity: 0.6;
    font-size: 0.75rem;
    white-space: nowrap;
}
</style>
