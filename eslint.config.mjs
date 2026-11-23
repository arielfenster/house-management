// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    // Generated files: shadcn-vue components (keep as-is so `shadcn-vue add` diffs stay clean)
    // and the `npm run db:types` output. (Kept alone in this object so it stays a global ignore.)
    ignores: ['app/components/ui/**', 'types/database.types.ts'],
  },
  {
    rules: {
      // House style: every `if`/`else`/loop body in braces, on its own line (no `if (x) return y`).
      'curly': ['error', 'all'],
      'brace-style': ['error', '1tbs', { allowSingleLine: false }],
    },
  },
)
