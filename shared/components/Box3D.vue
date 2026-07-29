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

function shade(hex: string, amount: number): string {
    const num = Number.parseInt(hex.replace('#', ''), 16);
    const clamp = (v: number) => Math.min(255, Math.max(0, v));
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0xff) + amount);
    const b = clamp((num & 0xff) + amount);
    return `rgb(${r}, ${g}, ${b})`;
}

const dim = computed(() => (props.lit ? 0 : -70));

// Box origin is its own center. All six faces are positioned at (0,0) and
// rotated/pushed outward along their own local Z axis — the standard CSS
// cube technique: every face shares one preserve-3d parent so the rotations
// compose into a real cuboid instead of six flat, unrelated planes.
const outerStyle = computed(() => ({
    width: `${props.width}px`,
    height: `${props.height}px`,
    transform: `translate3d(${props.x - props.width / 2}px, ${-props.y - props.height / 2}px, ${props.z - props.depth / 2}px)`
}));

const topStyle = computed(() => ({
    width: `${props.width}px`,
    height: `${props.depth}px`,
    background: shade(props.color, 45 + dim.value),
    transform: `rotateX(90deg) translateZ(${props.height / 2}px)`,
    transformOrigin: 'center'
}));
const frontStyle = computed(() => ({
    width: `${props.width}px`,
    height: `${props.height}px`,
    background: shade(props.color, 10 + dim.value),
    transform: `translateZ(${props.depth / 2}px)`
}));
const backStyle = computed(() => ({
    width: `${props.width}px`,
    height: `${props.height}px`,
    background: shade(props.color, -15 + dim.value),
    transform: `rotateY(180deg) translateZ(${props.depth / 2}px)`
}));
const rightStyle = computed(() => ({
    width: `${props.depth}px`,
    height: `${props.height}px`,
    background: shade(props.color, -25 + dim.value),
    transform: `rotateY(90deg) translateZ(${props.width / 2}px)`,
    transformOrigin: 'center'
}));
const leftStyle = computed(() => ({
    width: `${props.depth}px`,
    height: `${props.height}px`,
    background: shade(props.color, -35 + dim.value),
    transform: `rotateY(-90deg) translateZ(${props.width / 2}px)`,
    transformOrigin: 'center'
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
    top: 0;
    left: 0;
    transition: background 0.4s ease;
}

.box3d__face--front {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
}
</style>
