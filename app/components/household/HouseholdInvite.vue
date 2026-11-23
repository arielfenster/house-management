<script setup lang="ts">
import { CheckIcon, CopyIcon, Share2Icon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { joinPath } from '#shared/routes'

const props = defineProps<{
  householdName: string
  inviteCode: string
}>()

const origin = useRequestURL().origin
const inviteLink = computed(() => `${origin}${joinPath(props.inviteCode)}`)

// Web Share API is only known in the browser; render the button after mount to avoid a hydration mismatch.
const canShare = ref(false)
onMounted(() => {
  canShare.value = typeof navigator.share === 'function'
})

/** Legacy copy for browsers without the async Clipboard API (e.g. plain-http dev URLs on a phone). */
function copyWithSelection(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

type CopyTarget = 'link' | 'code'

const COPIED_FEEDBACK_MS = 2000

/** Which button shows the "Copied" state (inline feedback right where the user tapped). */
const copied = ref<CopyTarget | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(copiedTimer))

async function copy(target: CopyTarget) {
  const text = target === 'link' ? inviteLink.value : props.inviteCode
  let ok = false
  try {
    await navigator.clipboard.writeText(text)
    ok = true
  } catch {
    ok = copyWithSelection(text)
  }
  if (!ok) {
    toast.error(`Could not copy the ${target}. Select it and copy it manually.`)
    return
  }
  copied.value = target
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = null
  }, COPIED_FEEDBACK_MS)
}

async function share() {
  try {
    await navigator.share({
      title: `Join ${props.householdName}`,
      text: `Join our household "${props.householdName}":`,
      url: inviteLink.value,
    })
  } catch (error) {
    // AbortError = the user closed the share sheet.
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      toast.error('Could not open sharing. Copy the link instead.')
    }
  }
}
</script>

<template>
  <section class="space-y-4" aria-labelledby="invite-heading">
    <div>
      <h2 id="invite-heading" class="text-sm font-medium">
        Invite a member
      </h2>
      <p class="text-xs text-muted-foreground">
        Send the link (or the code) to the person joining <span dir="auto">{{ props.householdName }}</span>.
      </p>
    </div>

    <div class="space-y-1">
      <p class="text-xs text-muted-foreground">
        Invite link
      </p>
      <div class="flex items-center gap-2">
        <code class="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs" dir="ltr">{{ inviteLink }}</code>
        <Button variant="outline" size="sm" class="w-24 shrink-0" @click="copy('link')">
          <CheckIcon v-if="copied === 'link'" class="text-green-600 dark:text-green-500" />
          <CopyIcon v-else />
          {{ copied === 'link' ? 'Copied' : 'Copy' }}
          <span class="sr-only">invite link</span>
        </Button>
      </div>
    </div>

    <div class="space-y-1">
      <p class="text-xs text-muted-foreground">
        Invite code
      </p>
      <div class="flex items-center gap-2">
        <code class="min-w-0 flex-1 rounded-md bg-muted px-2 py-1.5 font-mono text-xs break-all" dir="ltr">{{ props.inviteCode }}</code>
        <Button variant="outline" size="sm" class="w-24 shrink-0" @click="copy('code')">
          <CheckIcon v-if="copied === 'code'" class="text-green-600 dark:text-green-500" />
          <CopyIcon v-else />
          {{ copied === 'code' ? 'Copied' : 'Copy' }}
          <span class="sr-only">invite code</span>
        </Button>
      </div>
    </div>

    <!-- Announces the copy result to screen readers. -->
    <p class="sr-only" aria-live="polite">
      {{ copied ? `Invite ${copied} copied` : '' }}
    </p>

    <Button v-if="canShare" variant="secondary" class="w-full" @click="share">
      <Share2Icon />
      Share invite link
    </Button>
  </section>
</template>
