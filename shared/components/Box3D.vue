<template>
    <div class="box3d" :style="outerStyle">
        <div class="box3d__face" :style="topStyle" />
        <div class="box3d__face box3d__face--front" :style="frontStyle">
            <slot />
        </div>
        <div class="box3d__face" :style="backStyle" />
        <div class="box3d__face" :style="rightStyle" />
        <div class="box3d__face" :style="leftStyle" />
    </div>
</template>

<script setup lang="ts">
import {shade} from '@shared/lib/shade';
import {computed} from 'vue';

const props = withDefaults(
    defineProps<{
        width: number;
        height: number;
        depth: number;
        color: string;
        x?: number;
        y?: number;
        z?: number;
        lit?: boolean;
    }>(),
    {x: 0, y: 0, z: 0, lit: true}
);

const dim = computed(() => (props.lit ? 0 : -70));

// x/z place the box's horizontal center; y places its BOTTOM edge (so
// floors can stack with y = index * floorHeight). Each face below is
// centered on the box's own local origin (0,0,0) *before* its rotation —
// left:50%/top:50% + negative margins of its own half-extents — so every
// face's default transform-origin (its own center) already sits exactly
// at the shared origin. Only then does translateZ(halfOfThatAxis) push it
// out to the correct plane; skipping the pre-centering step (each face
// anchored at its own top-left corner instead) is what produced the
// misaligned side walls before this rewrite.
const outerStyle = computed(() => ({
    transform: `translate3d(${props.x}px, ${-(props.y + props.height / 2)}px, ${props.z}px)`
}));

function centeredFace(w: number, h: number) {
    return {
        width: `${w}px`,
        height: `${h}px`,
        left: '50%',
        top: '50%',
        marginLeft: `${-w / 2}px`,
        marginTop: `${-h / 2}px`
    };
}

const topStyle = computed(() => ({
    ...centeredFace(props.width, props.depth),
    background: shade(props.color, 45 + dim.value),
    transform: `rotateX(90deg) translateZ(${props.height / 2}px)`
}));
const frontStyle = computed(() => ({
    ...centeredFace(props.width, props.height),
    background: shade(props.color, 10 + dim.value),
    transform: `translateZ(${props.depth / 2}px)`
}));
const backStyle = computed(() => ({
    ...centeredFace(props.width, props.height),
    background: shade(props.color, -15 + dim.value),
    transform: `rotateY(180deg) translateZ(${props.depth / 2}px)`
}));
const rightStyle = computed(() => ({
    ...centeredFace(props.depth, props.height),
    background: shade(props.color, -25 + dim.value),
    transform: `rotateY(90deg) translateZ(${props.width / 2}px)`
}));
const leftStyle = computed(() => ({
    ...centeredFace(props.depth, props.height),
    background: shade(props.color, -35 + dim.value),
    transform: `rotateY(-90deg) translateZ(${props.width / 2}px)`
}));
</script>

<style scoped>
.box3d {
    position: absolute;
    top: 0;
    left: 0;
    transform-style: preserve-3d;
}

.box3d__face {
    position: absolute;
    transition: background 0.4s ease;
}

.box3d__face--front {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
}
</style>
