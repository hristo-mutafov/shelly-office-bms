import type {DevicePlacement, FloorPlanMeta, FloorVisualization} from '@template-contract';
import {groups, useGroupActions} from '@host';
import {computed, ref, watch, type Ref} from 'vue';

type ShadowGroup = {
    id: number;
    name: string;
    metadata: Record<string, unknown>;
};

// Every floor Location gets exactly one shadow Group (linked via
// metadata.floorLocationId) that carries the floor-plan image + device
// placements — data that doesn't fit in Location.kindFields' byte budget.
// The Location stays the source of truth for the physical hierarchy and
// device assignment; the Group is purely a visualization/storage sidecar.
export function useFloorGroup(floorLocationId: Ref<number | null>, floorName: Ref<string>) {
    const group = ref<ShadowGroup | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const actions = useGroupActions();

    const viz = computed<FloorVisualization>(
        () => (group.value?.metadata?.viz as FloorVisualization | undefined) ?? {}
    );

    async function load(): Promise<void> {
        const locationId = floorLocationId.value;
        if (!locationId) {
            group.value = null;
            return;
        }
        loading.value = true;
        error.value = null;
        try {
            const existing = (await groups.list({})).find(
                (g) => (g.metadata as Record<string, unknown> | undefined)?.floorLocationId === locationId
            );
            if (existing) {
                group.value = {
                    id: existing.id,
                    name: existing.name,
                    metadata: (existing.metadata as Record<string, unknown>) ?? {}
                };
                return;
            }
            const created = await actions.create.run({
                name: `${floorName.value} (visualization)`,
                metadata: {floorLocationId: locationId, viz: {}}
            });
            group.value = {
                id: Number(created.id),
                name: created.name,
                metadata: {floorLocationId: locationId, viz: {}}
            };
        } catch (err) {
            error.value = err instanceof Error ? err.message : String(err);
        } finally {
            loading.value = false;
        }
    }

    async function saveViz(next: FloorVisualization): Promise<void> {
        if (!group.value) return;
        const metadata = {...group.value.metadata, viz: next};
        await actions.update.run(String(group.value.id), {metadata});
        group.value = {...group.value, metadata};
    }

    async function setFloorPlan(floorPlan: FloorPlanMeta): Promise<void> {
        await saveViz({...viz.value, floorPlan});
    }

    async function setDevicePlacement(deviceId: string, placement: DevicePlacement): Promise<void> {
        await saveViz({
            ...viz.value,
            devicePlacements: {...viz.value.devicePlacements, [deviceId]: placement}
        });
        if (group.value) {
            await groups.addMembers(group.value.id, [{subjectType: 'device', subjectId: deviceId}]);
        }
    }

    async function removeDevicePlacement(deviceId: string): Promise<void> {
        const next = {...viz.value.devicePlacements};
        delete next[deviceId];
        await saveViz({...viz.value, devicePlacements: next});
    }

    watch(floorLocationId, () => void load(), {immediate: true});

    return {group, viz, loading, error, setFloorPlan, setDevicePlacement, removeDevicePlacement, reload: load};
}
