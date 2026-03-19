// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import eslintConfigPrettier from 'eslint-config-prettier'

export default withNuxt(
  {
    files: ['**/*.ts', '**/*.vue'],
    rules: {
      // Typisierung
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // Vue-spezifisch
      'vue/max-attributes-per-line': [
        'error',
        {
          singleline: { max: 2 },
          multiline: { max: 1 },
        },
      ],
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/define-macros-order': [
        'error',
        {
          order: ['defineProps', 'defineEmits', 'defineExpose'],
        },
      ],
      'vue/no-unused-vars': 'error',
      'vue/prefer-import-from-vue': 'error',
      'vue/no-template-shadow': 'error',
      'vue/no-v-html': 'error',
      'vue/padding-line-between-blocks': 'error',
      // Vue 3 supports multiple root elements (fragments); this rule is Vue 2 only
      'vue/no-multiple-template-root': 'off',

      // KISS — Komplexitäts-Limits (realistisch für Vue-Apps mit Offline-Logik)
      complexity: ['warn', 15],
      'max-lines-per-function': [
        'warn',
        {
          max: 50,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-depth': ['warn', 4],

      // Code-Stil
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-duplicate-imports': 'error',
    },
  },
  {
    // search.vue uses v-html for highlight() which produces safe <mark> tags
    files: ['app/pages/search.vue'],
    rules: {
      'vue/no-v-html': 'off',
    },
  },
  {
    // Composables: inferred return types are idiomatic in Vue; composables are
    // module-pattern functions that group related logic — line/complexity limits
    // don't apply meaningfully to them
    files: ['app/composables/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'max-lines-per-function': 'off',
      complexity: 'off',
      'max-depth': 'off',
    },
  },
  {
    // Plugins run in browser context where console.log is appropriate for
    // service-worker lifecycle events
    files: ['app/plugins/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Relaxed rules für Test-Dateien
    files: ['tests/**/*.ts', 'tests/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'max-lines-per-function': 'off',
    },
  },
  // Must be last: disables all ESLint rules that conflict with Prettier
  eslintConfigPrettier,
)
