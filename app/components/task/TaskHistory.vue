<script setup lang="ts">
import { ChevronDownIcon, HistoryIcon } from '@lucide/vue'
import type { HouseholdMember } from '~/composables/use-household-members'
import { describeCompletion, type CompletionTiming } from '#shared/task-list'

// Last completion + expandable completion history of one task (features/TASKS.md §6, TASKS-010).
// RLS shows the history to whoever can see the task.
const props = defineProps<{
  taskId: string
  members: HouseholdMember[]
  timezone: string
  today: string
}>()

interface Entry {
  id: string
  completedAt: string
  completedBy: string | null
  dueDateAtCompletion: string | null
}

/** Enough for "last done" and a useful history; older entries stay in the database. */
const HISTORY_LIMIT = 50

const supabase = useSupabaseClient()
const entries = ref<Entry[]>([])
const loading = ref(true)
const failed = ref(false)
const expanded = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  const { data, error } = await supabase
    .from('task_completions')
    .select('id, completed_at, completed_by, due_date_at_completion')
    .eq('task_id', props.taskId)
    .order('completed_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  loading.value = false
  if (error) {
    failed.value = true
    return
  }
  entries.value = data.map(row => ({
    id: row.id,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    dueDateAtCompletion: row.due_date_at_completion,
  }))
}

watch(() => props.taskId, () => {
  expanded.value = false
  void load()
}, { immediate: true })

const names = computed(() => new Map(props.members.map(m => [m.id, m.displayName])))

function who(id: string | null): string {
  return (id && names.value.get(id)) || 'Former member'
}

const described = computed(() =>
  entries.value.map(entry => ({
    ...entry,
    who: who(entry.completedBy),
    ...describeCompletion(entry.completedAt, entry.dueDateAtCompletion, props.timezone, props.today),
  })),
)
const last = computed(() => described.value[0] ?? null)

const TIMING_CLASS: Record<CompletionTiming, string> = {
  early: 'text-muted-foreground',
  on_time: 'text-muted-foreground',
  late: 'text-amber-700 dark:text-amber-400',
}
</script>

<template>
  <section class="rounded-lg bg-muted/60 px-3 py-2.5 text-sm" aria-label="Completion history">
    <p v-if="loading" class="text-muted-foreground">
      Loading history…
    </p>
    <p v-else-if="failed" class="text-muted-foreground">
      Could not load the history.
    </p>
    <p v-else-if="!last" class="flex items-center gap-2 text-muted-foreground">
      <HistoryIcon class="size-4 shrink-0" aria-hidden="true" />
      Not done yet.
    </p>
    <template v-else>
      <div class="flex items-center gap-2">
        <HistoryIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p class="min-w-0 flex-1">
          Last done <span class="font-medium">{{ last.date }}</span>
          by <span dir="auto">{{ last.who }}</span>
          <span v-if="last.timingText" :class="last.timing ? TIMING_CLASS[last.timing] : ''"> · {{ last.timingText }}</span>
        </p>
        <Button
          v-if="described.length > 1"
          type="button"
          variant="ghost"
          size="xs"
          class="shrink-0"
          :aria-expanded="expanded"
          aria-controls="task-history-list"
          @click="expanded = !expanded"
        >
          History ({{ described.length }})
          <ChevronDownIcon class="size-3.5 transition-transform" :class="{ 'rotate-180': expanded }" aria-hidden="true" />
        </Button>
      </div>
      <ol v-if="expanded" id="task-history-list" class="mt-2 space-y-1 border-t border-foreground/10 pt-2">
        <li v-for="entry in described" :key="entry.id" class="flex items-baseline gap-2 text-xs">
          <span class="w-24 shrink-0 font-medium">{{ entry.date }}</span>
          <span class="min-w-0 flex-1 truncate" dir="auto">{{ entry.who }}</span>
          <span v-if="entry.timingText" class="shrink-0" :class="entry.timing ? TIMING_CLASS[entry.timing] : ''">{{ entry.timingText }}</span>
        </li>
      </ol>
    </template>
  </section>
</template>
