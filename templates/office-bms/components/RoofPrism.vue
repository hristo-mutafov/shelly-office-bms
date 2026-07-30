<template>
    <div class="roof3d" :style="outerStyle">
        <div class="roof3d__hinge" :style="frontHingeStyle">
            <div class="roof3d__slope" :style="frontSlopeStyle" />
        </div>
        <div class="roof3d__hinge" :style="backHingeStyle">
            <div class="roof3d__slope" :style="backSlopeStyle" />
        </div>
        <div class="roof3d__gable" :style="rightGableStyle" />
        <div class="roof3d__gable" :style="leftGableStyle" />
    </div>
</template>

<script setup lang="ts">
import {computed} from 'vue';

const props = withDefaults(
    defineProps<{
        width: number;
        depth: number;
        roofHeight: number;
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

// Roof-local origin is the CENTER of the base rectangle — where it sits on
// top of the topmost floor — unlike Box3D's box-center convention.
const outerStyle = computed(() => ({
    transform: `translate3d(${props.x}px, ${-props.y}px, ${props.z}px)`
}));

const slopeLen = computed(() => Math.hypot(props.depth / 2, props.roofHeight));

// Each slope panel hangs straight down from its hinge (top:0) in its own
// local frame; rotateX then swings it up to meet the ridge above the roof
// center. Solving slopeLen*cos(theta) = -roofHeight (rise to the ridge) and
// slopeLen*sin(theta) = ∓depth/2 (run back to the center, sign flips
// between front/back) for theta via atan2 sidesteps having to eyeball the
// rotation direction/sign by hand.
const thetaFront = computed(
    () => (Math.atan2(-props.depth / 2, -props.roofHeight) * 180) / Math.PI
);
const thetaBack = computed(() => -thetaFront.value);

const hingeBase = computed(() => ({
    left: '50%',
    marginLeft: `${-props.width / 2}px`,
    width: `${props.width}px`
}));
const frontHingeStyle = computed(() => ({
    ...hingeBase.value,
    transform: `translateZ(${props.depth / 2}px)`
}));
const backHingeStyle = computed(() => ({
    ...hingeBase.value,
    transform: `translateZ(${-props.depth / 2}px)`
}));
const frontSlopeStyle = computed(() => ({
    height: `${slopeLen.value}px`,
    background: shade(props.color, -10 + dim.value),
    transform: `rotateX(${thetaFront.value}deg)`
}));
const backSlopeStyle = computed(() => ({
    height: `${slopeLen.value}px`,
    background: shade(props.color, -25 + dim.value),
    transform: `rotateX(${thetaBack.value}deg)`
}));

function gableStyle(side: 'left' | 'right') {
    const rotate = side === 'right' ? 90 : -90;
    const shadeAmount = side === 'right' ? -20 : -35;
    return {
        width: `${props.depth}px`,
        height: `${props.roofHeight}px`,
        top: `${-props.roofHeight}px`,
        left: '50%',
        marginLeft: `${-props.depth / 2}px`,
        background: shade(props.color, shadeAmount + dim.value),
        transform: `rotateY(${rotate}deg) translateZ(${props.width / 2}px)`
    };
}
const rightGableStyle = computed(() => gableStyle('right'));
const leftGableStyle = computed(() => gableStyle('left'));
</script>

<style scoped>
.roof3d {
    position: absolute;
    top: 0;
    left: 0;
    transform-style: preserve-3d;
}

.roof3d__hinge {
    position: absolute;
    top: 0;
    height: 0;
    transform-style: preserve-3d;
}

.roof3d__slope {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    transform-origin: top center;
    transition: background 0.4s ease;
}

.roof3d__gable {
    position: absolute;
    transition: background 0.4s ease;
    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
}
</style>
