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
  /** Selector of the drag handle inside each element; omitted = the whole element drags. */
  handle?: string
  disabled: boolean
  /** Touch only: how long to press before a drag starts (ms), so taps and swipes keep working. 0 = immediately. */
  touchDelay?: number
  onMove: (move: SortableMove) => void
  /** A drag started / ended (dropped or cancelled). */
  onDragStart?: () => void
  onDragEnd?: () => void
}

const bindings = new WeakMap<HTMLElement, SortableBinding>()
const instances = new WeakMap<HTMLElement, Sortable>()

// A mouse drag ends with a click on the element it started on. Rows use this to ignore that click (it is not a tap).
let dragActive = false
let lastDragEnd = 0
const CLICK_AFTER_DRAG_MS = 400

/** Whether a drag is in progress or has just ended: a click now is the tail of the drag, not a tap. */
export function isDragClick(): boolean {
  return dragActive || Date.now() - lastDragEnd < CLICK_AFTER_DRAG_MS
}

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
  const binding = bindings.get(el)
  return Sortable.create(el, {
    group: binding?.group,
    handle: binding?.handle,
    disabled: binding?.disabled ?? true,
    delay: binding?.touchDelay ?? 0,
    delayOnTouchOnly: true,
    // Moving the finger this much before the delay ends means a scroll, not a drag.
    touchStartThreshold: 6,
    animation: 150,
    // Empty lists accept drops within SortableJS's default 5 px. A larger value is checked on every pointer move,
    // even over another list, and steals drops from rows near an empty section.
    // Rows still being saved cannot move yet; text fields (open editors) keep their own pointer behaviour.
    filter: '[data-pending], input, select, textarea',
    preventOnFilter: false,
    ghostClass: 'opacity-40',
    // Pointer-event dragging everywhere instead of native HTML5 drag-and-drop: touch already uses it, desktop
    // browsers then behave the same, and it is what automated tests can drive reliably.
    forceFallback: true,
    fallbackOnBody: true,
    // A few pixels of movement before a mouse drag starts, so a click is still a click.
    fallbackTolerance: 4,
    onStart: () => {
      dragActive = true
      bindings.get(el)?.onDragStart?.()
    },
    onEnd: (evt) => {
      dragActive = false
      lastDragEnd = Date.now()
      const current = bindings.get(el)
      current?.onDragEnd?.()
      const id = evt.item.dataset.id
      const fromList = evt.from.dataset.list
      const toList = evt.to.dataset.list
      if (evt.from === evt.to && evt.oldIndex === evt.newIndex) {
        return
      }
      revert(evt)
      if (current && id !== undefined && fromList !== undefined && toList !== undefined) {
        current.onMove({
          id,
          fromList,
          toList,
          newIndex: evt.newIndex ?? 0,
        })
      }
    },
  })
}

/** `v-sortable="{ group, handle?, disabled, touchDelay?, onMove, … }"` on a list whose children have `data-id`. */
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
    sortable?.option('delay', value.touchDelay ?? 0)
  },
  beforeUnmount(el) {
    instances.get(el)?.destroy()
    instances.delete(el)
    bindings.delete(el)
  },
}
