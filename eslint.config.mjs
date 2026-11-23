// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  // Generated files: shadcn-vue components (keep as-is so `shadcn-vue add` diffs stay clean)
  // and the `npm run db:types` output.
  ignores: ['app/components/ui/**', 'types/database.types.ts'],
})
