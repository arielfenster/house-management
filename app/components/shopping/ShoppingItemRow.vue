<script setup lang="ts">
import { CheckIcon } from '@lucide/vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import type { ShoppingItem } from '~/composables/use-shopping'

// Plain shopping row (features/SHOPPING.md §6): square checkbox + name. Ticking shows the check for a moment,
// then the row is removed (the page collapses it). The whole row is the target: in a store one large target beats
// precision. (Inline edit comes with SHOP-007.)
const props = defineProps<{
  item: ShoppingItem
}>()

const emit = defineEmits<{
  done: []
}>()

/** How long the tick is visible before the row leaves. */
const TICK_MS = 300

const ticking = ref(false)
const reduceMotion = usePreferredReducedMotion()

function onTick() {
  if (ticking.value || props.item.pending) {
    return
  }
  ticking.value = true
  setTimeout(() => {
    emit('done')
  }, reduceMotion.value === 'reduce' ? 0 : TICK_MS)
}
</script>

<template>
  <!-- `hover:` only applies on devices that can hover (Tailwind v4), so phones get no sticky highlight. -->
  <li class="overflow-hidden border-b border-foreground/10 last:border-b-0" :class="{ 'opacity-60': props.item.pending }">
    <button
      type="button"
      role="checkbox"
      :aria-checked="ticking"
      :aria-label="`Got ${props.item.name}`"
      :disabled="props.item.pending"
      class="group flex min-h-11 w-full items-center gap-3 px-3 text-start outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      @click="onTick"
    >
      <span
        class="grid size-5 shrink-0 place-items-center rounded-[5px] border-2 border-muted-foreground/40 transition-colors group-hover:border-primary group-aria-checked:border-primary group-aria-checked:bg-primary"
        aria-hidden="true"
      >
        <CheckIcon class="size-3.5 stroke-3 text-primary-foreground opacity-0 transition-opacity group-aria-checked:opacity-100" />
      </span>
      <span
        class="min-w-0 flex-1 py-2.5 text-sm break-words transition-colors"
        dir="auto"
        :class="{ 'text-muted-foreground line-through': ticking }"
      >
        {{ props.item.name }}
      </span>
    </button>
  </li>
</template>
