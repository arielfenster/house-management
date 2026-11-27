<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

// Forms and panels: bottom sheet (Drawer) on phones, Dialog on desktop (docs/05-UI-UX-GUIDELINES.md).
const props = defineProps<{
  title: string
  description?: string
  /**
   * Don't move focus into the sheet when it opens (no keyboard popping up on phones), e.g. when opening a
   * record to read or tweak it. Focus is still trapped in the sheet; Esc and Tab work as usual.
   */
  preventAutoFocus?: boolean
}>()

function onOpenAutoFocus(event: Event) {
  if (props.preventAutoFocus) {
    event.preventDefault()
  }
}

const open = defineModel<boolean>('open', { required: true })

// `md` breakpoint, same as the AppShell sidebar. False during SSR: sheets start closed, so nothing mismatches.
const isDesktop = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <Dialog v-if="isDesktop" v-model:open="open">
    <!-- Long forms scroll inside the dialog instead of overflowing short desktop windows. -->
    <DialogContent class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md" @open-auto-focus="onOpenAutoFocus">
      <DialogHeader>
        <DialogTitle><span dir="auto">{{ props.title }}</span></DialogTitle>
        <DialogDescription :class="props.description ? undefined : 'sr-only'">
          {{ props.description ?? props.title }}
        </DialogDescription>
      </DialogHeader>
      <!-- DialogContent is a grid: min-w-0 lets long content (links, codes) truncate instead of overflowing. -->
      <div class="min-w-0">
        <slot />
      </div>
    </DialogContent>
  </Dialog>

  <Drawer v-else v-model:open="open">
    <DrawerContent @open-auto-focus="onOpenAutoFocus">
      <DrawerHeader class="text-left">
        <DrawerTitle><span dir="auto">{{ props.title }}</span></DrawerTitle>
        <DrawerDescription :class="props.description ? undefined : 'sr-only'">
          {{ props.description ?? props.title }}
        </DrawerDescription>
      </DrawerHeader>
      <div class="min-w-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <slot />
      </div>
    </DrawerContent>
  </Drawer>
</template>
