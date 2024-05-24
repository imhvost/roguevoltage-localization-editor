<script setup lang="ts">
defineProps<{
  href?: string;
  to?: string | {};
  type?: 'button' | 'submit' | 'reset';
  target?: string;
  disabled?: boolean;
  ariaLabel?: string;
}>();
</script>

<template>
  <a
    v-if="href"
    class="btn"
    :href="href"
    :target="target"
    :class="disabled && 'disabled'"
    :aria-label="ariaLabel"
  >
    <slot></slot>
  </a>
  <button
    v-else
    class="btn"
    :type="type ?? 'button'"
    :disabled="disabled"
    :aria-label="ariaLabel"
  >
    <slot></slot>
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border: 0;
  cursor: pointer;
  height: 40px;
  padding: 0 16px;
  background: var(--color-btn);
  color: var(--color-white);
  line-height: 1.2;
  border-radius: 8px;
  max-width: 100%;
  overflow: hidden;
  will-change: transform;
  text-align: center;
  transition:
    opacity 0.4s,
    color 0.4s,
    border-color 0.4s,
    background-color 0.4s;
  :deep(svg) {
    flex: none;
    color: inherit;
    & + span {
      text-align: left;
    }
  }
  &:hover {
    background-color: var(--color-btn-hover);
  }
  &.disabled,
  &[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-green {
  background-color: var(--color-green);
  &:hover {
    background-color: var(--color-green-hover);
  }
}

.btn-red {
  background-color: var(--color-red);
  &:hover {
    background-color: var(--color-red-hover);
  }
}

.btn-full-width {
  display: flex;
  width: 100%;
}
</style>
