<template>
    <div class="empty-state">
        <i v-if="icon" :class="icon" />
        <p>{{ message }}</p>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    message: string;
    icon?: string;
}>();
</script>

<style scoped>
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2, 8px);
    padding: var(--space-6, 24px);
    background: transparent;
    border: 1px solid black;
    border-radius: var(--radius-md, 10px);
    color: black;
    text-align: center;
}

.empty-state i {
    font-size: 1.4rem;
}
</style>
