<template>
    <Teleport to="body">
        <div v-if="open" class="modal-backdrop" @click.self="$emit('close')">
            <div class="modal" role="dialog" aria-modal="true">
                <header class="modal__header">
                    <h3>{{ title }}</h3>
                    <button type="button" class="modal__close" aria-label="Close" @click="$emit('close')">
                        <i class="fas fa-xmark" />
                    </button>
                </header>
                <div class="modal__body">
                    <slot />
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
defineProps<{
    open: boolean;
    title: string;
}>();
defineEmits<{close: []}>();
</script>

<style scoped>
.modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--space-4, 12px);
}

.modal {
    width: 100%;
    max-width: 420px;
    max-height: 85vh;
    overflow-y: auto;
    background: var(--fm-template-card);
    color: var(--fm-template-text);
    border-radius: var(--radius-md, 10px);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4, 12px) var(--space-5, 16px);
    border-bottom: 1px solid color-mix(in srgb, var(--fm-template-text) 12%, transparent);
}

.modal__header h3 {
    margin: 0;
    font-size: 1rem;
}

.modal__close {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 1rem;
    opacity: 0.7;
}

.modal__close:hover {
    opacity: 1;
}

.modal__body {
    padding: var(--space-5, 16px);
}
</style>
