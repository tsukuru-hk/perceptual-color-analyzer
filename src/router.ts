import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'overview',
      component: () => import('@/pages/OverviewPage.vue'),
    },
    {
      path: '/chroma',
      name: 'chroma',
      component: () => import('@/pages/ChromaPage.vue'),
    },
    {
      path: '/lightness',
      name: 'lightness',
      component: () => import('@/pages/LightnessPage.vue'),
    },
    {
      path: '/hue',
      name: 'hue',
      component: () => import('@/pages/HuePage.vue'),
    },
    {
      path: '/gamut',
      name: 'gamut',
      component: () => import('@/pages/GamutPage.vue'),
    },
    {
      path: '/distribution',
      name: 'distribution',
      component: () => import('@/pages/DistributionPage.vue'),
    },
    {
      path: '/design',
      name: 'design',
      component: () => import('@/pages/DesignSystemPage.vue'),
    },
  ],
})

export default router
