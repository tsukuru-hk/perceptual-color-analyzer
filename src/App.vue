<template>
  <div class="flex min-h-screen bg-background">
    <Sidebar />
    <main class="ml-56 flex-1 p-8">
      <router-view />
    </main>
    <Toaster />
  </div>
</template>

<script setup lang="ts">
import { Sidebar, Toaster } from '@/components/ui'
</script>
