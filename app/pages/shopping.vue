<script setup lang="ts">
import { ArrowUpDownIcon, ShoppingCartIcon } from '@lucide/vue'
import { useLocalStorage, usePreferredReducedMotion } from '@vueuse/core'
import type { ShoppingGroup } from '~/composables/use-shopping'
import { vSortable, type SortableMove } from '~/utils/sortable'

// Shopping (features/SHOPPING.md): the household's list — items without a section on top, then each section
// under a small heading. One tap ticks an item off: it leaves the list and is deleted, with Undo (D22). Fast entry
// bar kept in view at the top (SHOP-005); sections created, renamed and deleted (with undo) inline (SHOP-006);
// items renamed, moved to another section or deleted from their pencil (SHOP-007/008).
// Arrange mode (SHOP-008): drag handles reorder items (also across sections) and sections. Realtime: SHOP-009.
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
  moveItem,
  moveSection,
} = useShopping()

// Section new items go to ('' = none), remembered on this device. Read after mount so the server-rendered select
// hydrates without a mismatch.
const addTarget = useLocalStorage<string>('shopping-target-section', '', { initOnMounted: true })
// Sections still being saved cannot take items yet (the insert would fail its foreign key).
const savedSections = computed(() => sections.value.filter(s => !s.pending))

/** Arrange mode: rows show drag handles instead of tick and pencil. Off by default so shopping stays one-tap. */
const arranging = ref(false)

const topGroup = computed((): ShoppingGroup => groups.value[0] ?? { section: null, items: [] })
const sectionGroups = computed(() => groups.value.slice(1))

/** `data-list` of an item list: the section id, or '' for the top area. */
function listKey(group: ShoppingGroup): string {
  return group.section?.id ?? ''
}

// Bumped after every drop: the list box re-renders from state, so no DOM that SortableJS touched survives
// (Vue and SortableJS both move nodes; letting only Vue's render stand keeps them from diverging).
const listVersion = ref(0)

function onItemDrop(move: SortableMove) {
  listVersion.value++
  const item = groups.value.flatMap(g => g.items).find(i => i.id === move.id)
  if (item) {
    void moveItem(item, move.toList === '' ? null : move.toList, move.newIndex)
  }
}

function onSectionDrop(move: SortableMove) {
  listVersion.value++
  const section = sections.value.find(s => s.id === move.id)
  if (section) {
    void moveSection(section, move.newIndex)
  }
}

const itemSortable = computed(() => ({
  group: 'shopping-items',
  handle: '.drag-handle',
  disabled: !arranging.value,
  onMove: onItemDrop,
}))

const sectionSortable = computed(() => ({
  group: 'shopping-sections',
  handle: '.section-drag-handle',
  disabled: !arranging.value,
  onMove: onSectionDrop,
}))

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
        <span v-if="!isEmpty && !arranging" class="text-xs text-muted-foreground" aria-live="polite">
          {{ remaining === 0 ? 'All done' : `${remaining} to get` }}
        </span>
        <Button
          v-if="!isEmpty"
          :variant="arranging ? 'default' : 'ghost'"
          size="sm"
          class="h-9"
          :aria-pressed="arranging"
          @click="arranging = !arranging"
        >
          <ArrowUpDownIcon v-if="!arranging" />
          {{ arranging ? 'Done' : 'Arrange' }}
        </Button>
      </template>
    </PageHeader>

    <!-- Sticky so it stays reachable while scrolling a long list in the store. -->
    <div v-if="!arranging" class="sticky top-0 z-20 -mx-4 mb-3 bg-background px-4 py-2">
      <ShoppingAddBar v-model:target="addTarget" :sections="savedSections" :add="addItems" />
    </div>
    <p v-else class="mb-3 text-sm text-muted-foreground">
      Drag the handles to reorder items and sections, or to move an item to another section.
    </p>

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
    <div v-else :key="listVersion" class="overflow-hidden rounded-lg border border-foreground/20 bg-card shadow-xs">
      <!-- Top area (no section). Always a drop target while arranging. -->
      <section
        v-if="topGroup.items.length || arranging"
        aria-label="Items without a section"
        class="border-b border-foreground/10 last:border-b-0"
      >
        <p v-if="arranging" class="border-b border-foreground/10 bg-muted/50 px-3 pt-3 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          No section
        </p>
        <TransitionGroup
          v-sortable="itemSortable"
          tag="ul"
          :css="false"
          :data-list="listKey(topGroup)"
          :class="{ 'min-h-11': arranging && !topGroup.items.length }"
          @leave="collapse"
        >
          <ShoppingItemRow
            v-for="item in topGroup.items"
            :key="item.id"
            :item="item"
            :rename="renameItem"
            :sections="savedSections"
            :arranging="arranging"
            @done="completeItem(item)"
            @delete="deleteItem(item)"
            @move="moveItem(item, $event)"
          />
        </TransitionGroup>
      </section>

      <!-- Sections, reorderable among themselves (never above the top area). -->
      <div v-sortable="sectionSortable" data-list="sections">
        <section
          v-for="group in sectionGroups"
          :key="group.section!.id"
          :data-id="group.section!.id"
          :aria-labelledby="`shopping-section-${group.section!.id}`"
          class="border-b border-foreground/10 bg-card last:border-b-0"
        >
          <ShoppingSectionHeading
            :section="group.section!"
            :sections="sections"
            :rename="renameSection"
            :arranging="arranging"
            @delete="deleteSection(group.section!)"
          />
          <!-- Kept mounted when empty so the last row can still animate out, and to accept drops. -->
          <TransitionGroup
            v-sortable="itemSortable"
            tag="ul"
            :css="false"
            :data-list="listKey(group)"
            :class="{ 'min-h-11': arranging && !group.items.length }"
            @leave="collapse"
          >
            <ShoppingItemRow
              v-for="item in group.items"
              :key="item.id"
              :item="item"
              :rename="renameItem"
              :sections="savedSections"
              :arranging="arranging"
              @done="completeItem(item)"
              @delete="deleteItem(item)"
              @move="moveItem(item, $event)"
            />
          </TransitionGroup>
          <p v-if="!group.items.length && !arranging" class="px-3 py-2.5 text-xs text-muted-foreground">
            No items
          </p>
        </section>
      </div>
    </div>

    <!-- New sections become the add target, so the next items typed go straight into them. -->
    <ShoppingNewSection
      v-if="!loading && !error && !arranging"
      class="mt-2"
      :sections="sections"
      :create="createSection"
      @created="addTarget = $event"
    />
  </div>
</template>
