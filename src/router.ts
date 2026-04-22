/**
 * クライアントルーティング：分析各ページとデザインシステム。
 */
import { createRouter, createWebHistory } from 'vue-router'
import type { Component } from 'vue'

/** アプリで定義するルートパスのユニオン */
export type RoutePath =
  | '/'
  | '/chroma'
  | '/lightness'
  | '/hue'
  | '/gamut'
  | '/distribution'
  | '/design'

/**
 * ルートパス → 動的 import 関数のマップ。
 * ホバー時のプリフェッチで利用するため export している。
 */
export const routeImports = {
  '/': () => import('@/pages/OverviewPage.vue'),
  '/chroma': () => import('@/pages/ChromaPage.vue'),
  '/lightness': () => import('@/pages/LightnessPage.vue'),
  '/hue': () => import('@/pages/HuePage.vue'),
  '/gamut': () => import('@/pages/GamutPage.vue'),
  '/distribution': () => import('@/pages/DistributionPage.vue'),
  '/design': () => import('@/pages/DesignSystemPage.vue'),
} as const satisfies Record<RoutePath, () => Promise<{ default: Component }>>

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'overview', component: routeImports['/'] },
    { path: '/chroma', name: 'chroma', component: routeImports['/chroma'] },
    { path: '/lightness', name: 'lightness', component: routeImports['/lightness'] },
    { path: '/hue', name: 'hue', component: routeImports['/hue'] },
    { path: '/gamut', name: 'gamut', component: routeImports['/gamut'] },
    { path: '/distribution', name: 'distribution', component: routeImports['/distribution'] },
    { path: '/design', name: 'design', component: routeImports['/design'] },
  ],
})

export default router
