<template>
    <span class="mock-badge" title="Simulated data — this sensor hasn't been connected yet">
        <i class="fas fa-flask" /> Mock data
    </span>
</template>

<script setup lang="ts"></script>

<style scoped>
.mock-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 3px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, #9b59d0 18%, transparent);
    color: #9b59d0;
}
</style>
