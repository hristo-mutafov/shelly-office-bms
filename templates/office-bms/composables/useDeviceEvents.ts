import type {DeviceChangeEvent} from '@template-contract';
import {callMethod} from '@host';
import {computed, type Ref, ref, watch} from 'vue';

export type UseDeviceEventsOptions = {
    shellyIds: string[];
    from: string;
    to: string;
    /** Filter to one component, e.g. 'switch:0' — the RPC only supports a
     *  single component filter server-side, so query narrowly per device type. */
    component?: string;
    immediate?: boolean;
};

export function useDeviceEvents(options: Ref<UseDeviceEventsOptions | null>) {
    const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const events = ref<DeviceChangeEvent[]>([]);
    const error = ref<string | null>(null);
    const loading = computed(() => state.value === 'loading');

    async function refresh(): Promise<void> {
        const opts = options.value;
        if (!opts?.shellyIds.length) {
            events.value = [];
            state.value = 'idle';
            return;
        }
        state.value = 'loading';
        error.value = null;
        try {
            const res = await callMethod('deviceevents.query', {
                shellyIds: opts.shellyIds,
                from: opts.from,
                to: opts.to,
                component: opts.component,
                limit: 200
            });
            events.value = (res.items ?? []).map((item) => ({
                ts: item.ts,
                shellyId: item.shelly_id,
                component: item.component,
                field: item.field,
                prev: item.prev,
                next: item.next,
                kind: item.kind
            }));
        } catch (err) {
            error.value = err instanceof Error ? err.message : String(err);
            state.value = 'error';
            return;
        }
        state.value = 'ready';
    }

    watch(
        options,
        () => {
            if (options.value?.immediate ?? true) void refresh();
        },
        {immediate: true, deep: true}
    );

    return {state, loading, events, error, refresh};
}
