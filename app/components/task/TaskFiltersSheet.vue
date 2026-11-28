<script setup lang="ts">
import { CheckIcon } from '@lucide/vue'
import type { FilterSection } from '~/composables/use-task-filter-sections'

// Filters sheet (bottom sheet on phones, dialog on desktop): one section per filter with tappable chips.
// Filtering is live; "Show N tasks" just closes the sheet.
const props = defineProps<{
  sections: FilterSection[]
  /** Tasks shown with the current filters (for the close button). */
  resultCount: number
}>()

const emit = defineEmits<{
  set: [key: FilterSection['key'], value: string | null]
  clear: []
}>()

const open = defineModel<boolean>('open', { required: true })
const { facets } = useTaskFilters()

function selected(section: FilterSection, value: string | null): boolean {
  return facets.value[section.key] === value
}

const anyActive = computed(() => props.sections.some(s => facets.value[s.key] !== null))

const chipClass = 'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
const chipIdle = 'border-foreground/20 bg-background hover:bg-muted'
const chipOn = 'border-primary bg-primary text-primary-foreground'
</script>

<template>
  <ResponsiveSheet v-model:open="open" title="Filters" description="Show only the tasks you need." prevent-auto-focus>
    <div class="space-y-6 pb-1">
      <fieldset v-for="section in props.sections" :key="section.key">
        <legend class="mb-2.5 flex items-center gap-1.5 text-sm font-medium">
          <component :is="section.icon" class="size-4 text-muted-foreground" aria-hidden="true" />
          {{ section.label }}
        </legend>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            :aria-pressed="selected(section, null)"
            :class="[chipClass, selected(section, null) ? chipOn : chipIdle]"
            @click="emit('set', section.key, null)"
          >
            <CheckIcon v-if="selected(section, null)" class="size-3.5" aria-hidden="true" />
            Any
          </button>
          <button
            v-for="option in section.options"
            :key="option.value"
            type="button"
            :aria-pressed="selected(section, option.value)"
            :class="[chipClass, selected(section, option.value) ? chipOn : chipIdle]"
            @click="emit('set', section.key, selected(section, option.value) ? null : option.value)"
          >
            <CheckIcon v-if="selected(section, option.value)" class="size-3.5" aria-hidden="true" />
            <span dir="auto">{{ option.label }}</span>
          </button>
        </div>
      </fieldset>

      <div class="flex items-center gap-2 border-t border-foreground/10 pt-4">
        <Button type="button" variant="ghost" :disabled="!anyActive" @click="emit('clear')">
          Clear all
        </Button>
        <Button type="button" class="flex-1" @click="open = false">
          Show {{ props.resultCount }} {{ props.resultCount === 1 ? 'task' : 'tasks' }}
        </Button>
      </div>
    </div>
  </ResponsiveSheet>
</template>
