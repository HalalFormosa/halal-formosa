import { ref, computed, watch } from 'vue'

export interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  image?: string
}

const CART_KEY = 'hf_store_cart'

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const items = ref<CartItem[]>(loadCart())

function persist() {
  localStorage.setItem(CART_KEY, JSON.stringify(items.value))
}

watch(items, persist, { deep: true })

export function useStoreCart() {
  const cartCount = computed(() =>
    items.value.reduce((sum, i) => sum + i.quantity, 0)
  )

  const cartTotal = computed(() =>
    items.value.reduce((sum, i) => sum + i.price * i.quantity, 0)
  )

  function addItem(product: { id: string; name: string; price: number; image?: string }, qty = 1) {
    const existing = items.value.find(i => i.productId === product.id)
    if (existing) {
      existing.quantity += qty
    } else {
      items.value.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
        image: product.image
      })
    }
  }

  function removeItem(productId: string) {
    items.value = items.value.filter(i => i.productId !== productId)
  }

  function updateQty(productId: string, qty: number) {
    const item = items.value.find(i => i.productId === productId)
    if (item) {
      if (qty <= 0) {
        removeItem(productId)
      } else {
        item.quantity = qty
      }
    }
  }

  function clearCart() {
    items.value = []
  }

  return {
    items,
    cartCount,
    cartTotal,
    addItem,
    removeItem,
    updateQty,
    clearCart
  }
}
