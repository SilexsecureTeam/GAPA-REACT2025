// Minimal guest cart stored in localStorage
// Structure: { items: Array<{ product_id: string; quantity: number }> }

export type GuestCartItem = { product_id: string; quantity: number }
export type GuestCart = { items: GuestCartItem[] }

const STORAGE_KEY = 'guestCart'

export function getGuestCart(): GuestCart {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { items: [] }
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.items)) return { items: parsed.items }
  } catch {
    // ignore
  }
  return { items: [] }
}

export function setGuestCart(cart: GuestCart) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
  } catch {
    // ignore write errors (e.g., quota)
  }
}

export function addGuestCartItem(product_id: string, quantity: number) {
  const cart = getGuestCart()
  const idx = cart.items.findIndex((it) => it.product_id === product_id)
  if (idx >= 0) {
    cart.items[idx].quantity = Math.max(1, Math.min(99, (cart.items[idx].quantity || 0) + quantity))
  } else {
    cart.items.push({ product_id, quantity: Math.max(1, Math.min(99, quantity)) })
  }
  setGuestCart(cart)
  return cart
}
