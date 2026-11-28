<script setup lang="ts">
import { ShoppingCartIcon } from '@lucide/vue'
import { useLocalStorage, usePreferredReducedMotion } from '@vueuse/core'

// Shopping (features/SHOPPING.md): the household's list — items without a section on top, then each section
// under a small heading; one tap ticks an item off — it leaves the list and is deleted, with Undo (D22); fast entry bar kept in view at the top
// (SHOP-005); sections created, renamed and deleted (with undo) inline (SHOP-006).
// Items are renamed or deleted from their pencil (SHOP-007). Reordering comes in SHOP-008, realtime in SHOP-009.
const {
  groups,
  sections,
  addItems,
  createSection,
  renameSection,
  deleteSection,
  isEmpty,
  remaining,
  pending,
  error,
  refresh,
  completeItem,
  deleteItem,
  renameItem,
} = useShopping()

// Section new items go to ('' = none), remembered on this device. Read after mount so the server-rendered select
// hydrates without a mismatch.
const addTarget = useLocalStorage<string>('shopping-target-section', '', { initOnMounted: true })
// Sections still being saved cannot take items yet (the insert would fail its foreign key).
const savedSections = computed(() => sections.value.filter(s => !s.pending))

// A ticked row collapses its height instead of vanishing, so the rows below slide up rather than jump.
const reduceMotion = usePreferredReducedMotion()

function collapse(el: Element, done: () => void) {
  if (reduceMotion.value === 'reduce' || !(el instanceof HTMLElement)) {
    done()
    return
  }
  const animation = el.animate(
    [
      { height: `${el.offsetHeight}px`, opacity: 1 },
      { height: '0px', opacity: 0 },
    ],
    { duration: 180, easing: 'ease-in' },
  )
  animation.onfinish = done
  animation.oncancel = done
}

const loading = computed(() => pending.value && isEmpty.value)
</script>

<template>
  <div>
    <PageHeader title="Shopping">
      <template #actions>
        <span v-if="!isEmpty" class="text-xs text-muted-foreground" aria-live="polite">
          {{ remaining === 0 ? 'All done' : `${remaining} to get` }}
        </span>
      </template>
    </PageHeader>

    <!-- Sticky so it stays reachable while scrolling a long list in the store. -->
    <div class="sticky top-0 z-20 -mx-4 mb-3 bg-background px-4 py-2">
      <ShoppingAddBar v-model:target="addTarget" :sections="savedSections" :add="addItems" />
    </div>

    <div v-if="loading" class="rounded-lg border border-foreground/20 bg-card shadow-xs" aria-busy="true" aria-label="Loading the shopping list">
      <div v-for="i in 6" :key="i" class="flex h-11 items-center gap-3 border-b border-foreground/10 px-3 last:border-b-0">
        <div class="size-5 rounded-[5px] bg-muted" />
        <div class="h-3 flex-1 rounded bg-muted" :style="{ maxWidth: `${30 + ((i * 17) % 40)}%` }" />
      </div>
    </div>

    <div v-else-if="error" class="py-12 text-center text-sm text-muted-foreground" role="alert">
      Could not load the shopping list.
      <Button variant="link" size="sm" @click="refresh()">
        Try again
      </Button>
    </div>

    <EmptyState v-else-if="isEmpty" title="Your list is empty" description="Type an item above and press Enter, or paste a list — one item per line.">
      <ShoppingCartIcon />
    </EmptyState>

    <!-- One bordered box; sections are small headings inside it (docs/05: separators, not cards). -->
    <div v-else class="overflow-hidden rounded-lg border border-foreground/20 bg-card shadow-xs">
      <template v-for="group in groups" :key="group.section?.id ?? 'top'">
        <section
          v-if="group.section || group.items.length"
          :aria-label="group.section ? undefined : 'Items without a section'"
          :aria-labelledby="group.section ? `shopping-section-${group.section.id}` : undefined"
          class="border-b border-foreground/10 last:border-b-0"
        >
          <ShoppingSectionHeading
            v-if="group.section"
            :section="group.section"
            :sections="sections"
            :rename="renameSection"
            @delete="deleteSection(group.section)"
          />
          <!-- Kept mounted when empty so the last row can still animate out. -->
          <TransitionGroup tag="ul" :css="false" @leave="collapse">
            <ShoppingItemRow
              v-for="item in group.items"
              :key="item.id"
              :item="item"
              :rename="renameItem"
              @done="completeItem(item)"
              @delete="deleteItem(item)"
            />
          </TransitionGroup>
          <p v-if="!group.items.length" class="px-3 py-2.5 text-xs text-muted-foreground">
            No items
          </p>
        </section>
      </template>
    </div>

    <!-- New sections become the add target, so the next items typed go straight into them. -->
    <ShoppingNewSection
      v-if="!loading && !error"
      class="mt-2"
      :sections="sections"
      :create="createSection"
      @created="addTarget = $event"
    />
  </div>
</template>
