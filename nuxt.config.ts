import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],

  ssr: false,

  components: [
    { path: '~/components/ui', prefix: '' },
    { path: '~/components/forms', prefix: '' },
    '~/components',
  ],

  devtools: {
    enabled: true,
  },

  app: {
    head: {
      title: 'Lager',
      meta: [
        { name: 'theme-color', content: '#64748b' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Lager' },
      ],
      link: [{ rel: 'manifest', href: '/manifest.webmanifest' }],
    },
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    apiBase: '',
  },

  compatibilityDate: '2025-01-15',

  vite: {
    plugins: [tailwindcss()],
    server: {
      hmr: {
        clientPort: 3000,
      },
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs',
      },
    },
  },
})
