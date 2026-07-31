import type {HostLoadState} from '@host';
import type {Ref} from 'vue';

// @host's HostAsyncState.refresh() never rejects — it catches its own RPC
// failures and just sets state to 'error' — so a naive `await refresh()`
// can't tell success from failure. On a cold page load, the very first RPC
// this fires can lose that race (auth/websocket bootstrap still settling)
// and, with nothing re-checking `state`, the resource is left permanently
// empty for the rest of the session. This retries by checking `state`
// itself instead of relying on a thrown error.
export async function refreshUntilReady(
    resource: {state: Ref<HostLoadState>; refresh: () => Promise<void>},
    options: {attempts?: number; delayMs?: number} = {}
): Promise<void> {
    const attempts = options.attempts ?? 4;
    const delayMs = options.delayMs ?? 700;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        await resource.refresh();
        if (resource.state.value === 'ready') return;
        if (attempt < attempts) {
            await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        }
    }
}
