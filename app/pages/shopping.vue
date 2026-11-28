<script setup lang="ts">
import { ShoppingCartIcon } from '@lucide/vue'

// Shopping (features/SHOPPING.md): the household's list — items without a section on top, then each section
// under a small heading; one tap ticks an item (optimistic, SHOP-004). Adding, editing and reordering come in
// SHOP-005…008, realtime in SHOP-009.
const { groups, isEmpty, remaining, pending, error, refresh, setChecked } = useShopping()

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

    <EmptyState v-else-if="isEmpty" title="Your list is empty" description="Items you add show here for everyone in the household.">
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
          <h2
            v-if="group.section"
            :id="`shopping-section-${group.section.id}`"
            class="border-b border-foreground/10 bg-muted/50 px-3 pt-3 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            dir="auto"
          >
            {{ group.section.name }}
          </h2>
          <ul v-if="group.items.length">
            <ShoppingItemRow
              v-for="item in group.items"
              :key="item.id"
              :item="item"
              @toggle="setChecked(item, $event)"
            />
          </ul>
          <p v-else class="px-3 py-2.5 text-xs text-muted-foreground">
            No items
          </p>
        </section>
      </template>
    </div>
  </div>
</template>
