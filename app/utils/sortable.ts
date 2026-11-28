import Sortable, { type SortableEvent } from 'sortablejs'
import type { Directive } from 'vue'

/** A finished drag: element `id` (its `data-id`) went from list `fromList` to `toList` (their `data-list`). */
export interface SortableMove {
  id: string
  fromList: string
  toList: string
  newIndex: number
}

export interface SortableBinding {
  /** Lists with the same group exchange elements (items move between sections). */
  group: string
  /** Selector of the drag handle inside each element. */
  handle: string
  disabled: boolean
  onMove: (move: SortableMove) => void
}

const bindings = new WeakMap<HTMLElement, SortableBinding>()
const instances = new WeakMap<HTMLElement, Sortable>()

/**
 * Puts the dragged element back where it was. Vue owns the DOM: after a drop we undo SortableJS's DOM move and let
 * the state change re-render the list. (Callers also re-key the list after a drop, so Vue rebuilds it from state —
 * transition groups do not reliably reconcile nodes that were moved behind their back.)
 */
function revert(evt: SortableEvent) {
  const { item, from, to, oldIndex = 0, newIndex = 0 } = evt
  // Across lists SortableJS leaves a hidden copy of the element in the source list; we restore the real one.
  if (evt.clone && evt.clone !== item) {
    evt.clone.remove()
  }
  const offset = from === to && oldIndex > newIndex ? 1 : 0
  from.insertBefore(item, from.children[oldIndex + offset] ?? null)
}

function create(el: HTMLElement): Sortable {
  return Sortable.create(el, {
    group: bindings.get(el)?.group,
    handle: bindings.get(el)?.handle,
    disabled: bindings.get(el)?.disabled ?? true,
    animation: 150,
    // Rows still being saved cannot move yet.
    filter: '[data-pending]',
    preventOnFilter: false,
    ghostClass: 'opacity-40',
    // Pointer-event dragging everywhere instead of native HTML5 drag-and-drop: touch already uses it, desktop
    // browsers then behave the same, and it is what automated tests can drive reliably.
    forceFallback: true,
    fallbackOnBody: true,
    // A few pixels of movement before a drag starts, so a tap on the handle is not a drag.
    fallbackTolerance: 3,
    onEnd: (evt) => {
      const binding = bindings.get(el)
      const id = evt.item.dataset.id
      const fromList = evt.from.dataset.list
      const toList = evt.to.dataset.list
      if (evt.from === evt.to && evt.oldIndex === evt.newIndex) {
        return
      }
      revert(evt)
      if (binding && id !== undefined && fromList !== undefined && toList !== undefined) {
        binding.onMove({
          id,
          fromList,
          toList,
          newIndex: evt.newIndex ?? 0,
        })
      }
    },
  })
}

/** `v-sortable="{ group, handle, disabled, onMove }"` on a list element whose children have `data-id`. */
export const vSortable: Directive<HTMLElement, SortableBinding> = {
  mounted(el, { value }) {
    bindings.set(el, value)
    instances.set(el, create(el))
  },
  updated(el, { value }) {
    bindings.set(el, value)
    const sortable = instances.get(el)
    sortable?.option('disabled', value.disabled)
    sortable?.option('group', value.group)
    sortable?.option('handle', value.handle)
  },
  beforeUnmount(el) {
    instances.get(el)?.destroy()
    instances.delete(el)
    bindings.delete(el)
  },
}
