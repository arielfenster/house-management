<script setup lang="ts">
import type { Component } from 'vue'
import { BellIcon, CircleUserRoundIcon, FolderIcon, ListChecksIcon, ShoppingCartIcon } from '@lucide/vue'
import { ROUTES } from '#shared/routes'

interface NavItem {
  to: string
  label: string
  icon: Component
}

// Exactly four destinations, same order on phone and desktop (docs/05-UI-UX-GUIDELINES.md).
const NAV_ITEMS: NavItem[] = [
  {
    to: ROUTES.tasks,
    label: 'Tasks',
    icon: ListChecksIcon,
  },
  {
    to: ROUTES.files,
    label: 'Files',
    icon: FolderIcon,
  },
  {
    to: ROUTES.shopping,
    label: 'Shopping',
    icon: ShoppingCartIcon,
  },
  {
    to: ROUTES.notifications,
    label: 'Notifications',
    icon: BellIcon,
  },
]

const route = useRoute()
const accountOpen = useAccountSheetOpen()
const { data: household } = useCurrentHousehold()

function isActive(item: NavItem): boolean {
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}
</script>

<template>
  <div class="min-h-dvh">
    <!-- Desktop: compact left sidebar -->
    <aside class="fixed inset-y-0 left-0 hidden w-56 flex-col border-r bg-sidebar md:flex">
      <nav class="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
        <NuxtLink
          v-for="item in NAV_ITEMS"
          :key="item.to"
          :to="item.to"
          :aria-current="isActive(item) ? 'page' : undefined"
          class="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground"
        >
          <component :is="item.icon" class="size-4 shrink-0" aria-hidden="true" />
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="border-t p-3">
        <button
          type="button"
          class="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Household and account"
          @click="accountOpen = true"
        >
          <CircleUserRoundIcon class="size-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 truncate text-start" dir="auto">{{ household?.name ?? 'Household' }}</span>
        </button>
      </div>
    </aside>

    <!-- Content: room for the bottom bar (+ safe area) on phones, the sidebar on desktop -->
    <main class="px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-8 md:pl-60">
      <div class="mx-auto max-w-[720px]">
        <slot />
      </div>
    </main>

    <!-- Phone: fixed bottom bar -->
    <nav
      class="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Main"
    >
      <ul class="grid grid-cols-4">
        <li v-for="item in NAV_ITEMS" :key="item.to">
          <NuxtLink
            :to="item.to"
            :aria-current="isActive(item) ? 'page' : undefined"
            class="flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
          >
            <component :is="item.icon" class="size-5" aria-hidden="true" />
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <AccountSheet />
  </div>
</template>
