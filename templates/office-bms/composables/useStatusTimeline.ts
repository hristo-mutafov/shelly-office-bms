import type {StatusTimelinePoint} from '@template-contract';
import {callMethod} from '@host';
import {computed, type Ref, ref, watch} from 'vue';
import {extractErrorMessage} from '../lib/errors';

export type UseStatusTimelineOptions = {
    shellyID: string;
    field: string;
    from: string;
    to: string;
    immediate?: boolean;
};

export function useStatusTimeline(options: Ref<UseStatusTimelineOptions | null>) {
    const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const points = ref<StatusTimelinePoint[]>([]);
    const error = ref<string | null>(null);
    const loading = computed(() => state.value === 'loading');

    async function refresh(): Promise<void> {
        const opts = options.value;
        if (!opts?.shellyID) {
            points.value = [];
            state.value = 'idle';
            return;
        }
        state.value = 'loading';
        error.value = null;
        try {
            const res = await callMethod('device.getstatustimeline', {
                shellyID: opts.shellyID,
                field: opts.field,
                from: opts.from,
                to: opts.to
            });
            points.value = res.data ?? [];
            state.value = 'ready';
        } catch (err) {
            error.value = extractErrorMessage(err);
            state.value = 'error';
        }
    }

    watch(
        options,
        () => {
            if (options.value?.immediate ?? true) void refresh();
        },
        {immediate: true, deep: true}
    );

    return {state, loading, points, error, refresh};
}
