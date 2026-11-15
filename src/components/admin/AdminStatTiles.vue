<template>
  <div class="ap-tiles" data-testid="admin-tiles">
    <div v-for="tile in tiles" :key="tile.label" class="ap-tile">
      <div class="ap-tile-value" :class="tile.tone">{{ tile.value }}</div>
      <div class="ap-tile-label">{{ tile.label }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import '@/views/admin/adminPage.css'

export interface StatTile {
  label: string
  value: string | number
  tone?: 'good' | 'warn' | 'bad'
}

defineProps<{ tiles: StatTile[] }>()
</script>
