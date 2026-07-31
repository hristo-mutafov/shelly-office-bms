import {useRoute, useRouter} from 'vue-router';
import {computed} from 'vue';

export type TemplateView = 'dashboard' | 'building' | 'floor' | 'events';

// Reads/writes query params on FM's existing router instead of registering
// new routes — FM's own route table only has a catch-all pointing at
// TemplateHost, so this keeps navigation deep-linkable/refreshable without
// touching the host app's routing config.
export function useTemplateNav() {
    const route = useRoute();
    const router = useRouter();

    const view = computed<TemplateView>(() => {
        const raw = route.query.view;
        if (raw === 'building' || raw === 'floor' || raw === 'events') return raw;
        return 'dashboard';
    });

    const floorId = computed<number | null>(() => {
        const raw = route.query.floor;
        const n = Number(raw);
        return raw && Number.isFinite(n) ? n : null;
    });

    // push (not replace) — each nav call must add a history entry so the
    // browser's back button can step back through dashboard → building →
    // floor. replace() collapses them into one entry, which is why back
    // used to always land on dashboard regardless of where you came from.
    function goToDashboard(): void {
        void router.push({query: {}});
    }

    function goToBuilding(): void {
        void router.push({query: {view: 'building'}});
    }

    function goToFloor(id: number): void {
        void router.push({query: {view: 'floor', floor: String(id)}});
    }

    function goToEvents(): void {
        void router.push({query: {view: 'events'}});
    }

    return {view, floorId, goToDashboard, goToBuilding, goToFloor, goToEvents};
}
