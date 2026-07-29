import {useRoute, useRouter} from 'vue-router';
import {computed} from 'vue';

export type TemplateView = 'dashboard' | 'building' | 'floor';

// Reads/writes query params on FM's existing router instead of registering
// new routes — FM's own route table only has a catch-all pointing at
// TemplateHost, so this keeps navigation deep-linkable/refreshable without
// touching the host app's routing config.
export function useTemplateNav() {
    const route = useRoute();
    const router = useRouter();

    const view = computed<TemplateView>(() => {
        const raw = route.query.view;
        if (raw === 'building' || raw === 'floor') return raw;
        return 'dashboard';
    });

    const floorId = computed<number | null>(() => {
        const raw = route.query.floor;
        const n = Number(raw);
        return raw && Number.isFinite(n) ? n : null;
    });

    function goToDashboard(): void {
        void router.replace({query: {}});
    }

    function goToBuilding(): void {
        void router.replace({query: {view: 'building'}});
    }

    function goToFloor(id: number): void {
        void router.replace({query: {view: 'floor', floor: String(id)}});
    }

    return {view, floorId, goToDashboard, goToBuilding, goToFloor};
}
