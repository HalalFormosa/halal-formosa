<template>
  <div class="store-scroll" :class="{ readonly: mode === 'readonly' }">
    <div
        v-for="store in stores"
        :key="store.id"
        class="store-option"
        :class="{ selected: isSelected(store), readonly: mode === 'readonly' }"
        @click="mode === 'readonly' ? openInMaps(store.name) : onClick(store)"
    >
      <!-- Logo -->
      <div class="store-logo-wrapper">
        <img
            :src="store.logo_url || 'https://via.placeholder.com/60.webp'"
            :alt="store.name"
            class="store-logo"
        />
      </div>
      <!-- Name -->
      <span class="store-name">{{ store.name }}</span>
    </div>
  </div>
</template>


<script setup lang="ts">
import { Capacitor } from "@capacitor/core"
import { AppLauncher } from '@capacitor/app-launcher'

interface Store {
  id: string
  name: string
  logo_url?: string | null
}

type Mode = "select" | "filter" | "readonly"

const props = defineProps<{
  stores: Store[]
  mode?: Mode
  modelValue?: string[] | null
  activeStores?: Store[]
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: string[]): void
  (e: "update:activeStores", value: Store[]): void
}>()

function isSelected(store: Store): boolean {
  switch (props.mode) {
    case "select":
      return props.modelValue?.includes(store.id) || false
    case "filter":
      return props.activeStores?.some(s => s.id === store.id) || false
    default:
      return false
  }
}

async function openInMaps(storeName: string) {
  const query = encodeURIComponent(storeName)

  if (Capacitor.getPlatform() === "android") {
    await AppLauncher.openUrl({ url: `geo:0,0?q=${query}` })
  } else if (Capacitor.getPlatform() === "ios") {
    await AppLauncher.openUrl({ url: `maps://?q=${query}` })
  } else {
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank")
  }
}

function onClick(store: Store) {
  if (props.mode === "readonly") return

  if (props.mode === "select") {
    let newValue = [...(props.modelValue || [])]
    if (newValue.includes(store.id)) {
      newValue = newValue.filter((id) => id !== store.id)
    } else {
      newValue.push(store.id)
    }
    emit("update:modelValue", newValue)
  }

  if (props.mode === "filter") {
    const current = props.activeStores || []
    const exists = current.some(s => s.id === store.id)

    let updated: Store[]

    if (exists) {
      updated = current.filter(s => s.id !== store.id)
    } else {
      updated = [...current, store]
    }

    emit("update:activeStores", updated)
  }

}
</script>

<style>
.store-option.readonly {
  cursor: pointer;
}

.store-logo-wrapper {
  pointer-events: auto;   /* ✅ ensure clicks pass through */
  cursor: pointer;
}
.store-option.readonly {
  pointer-events: auto;   /* ✅ enable click in readonly mode */
}

</style>
