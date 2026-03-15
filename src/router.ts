import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
    },
    {
      path: '/design',
      name: 'design',
      component: () => import('@/pages/DesignSystemPage.vue'),
    },
    {
      path: '/colors',
      name: 'colors',
      component: () => import('@/pages/ColorsPage.vue'),
    },
  ],
})

export default router
