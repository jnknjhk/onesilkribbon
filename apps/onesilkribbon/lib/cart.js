import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const basketQuantityLimit = stockQty => Number.isSafeInteger(stockQty) && stockQty >= 0 ? stockQty : 99

export const useCart = create(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      openCart:   () => set({ isOpen: true }),
      closeCart:  () => set({ isOpen: false }),
      toggleCart: () => set(s => ({ isOpen: !s.isOpen })),

      addItem: (item) => {
        const items = get().items
        const existing = items.find(i => i.skuId === item.skuId)
        const stockQty = item.stockQty ?? existing?.stockQty
        const qty = (existing?.qty ?? 0) + item.qty
        if (!Number.isSafeInteger(item.qty) || item.qty < 1 || qty > basketQuantityLimit(stockQty)) return false
        const nextItems = existing
          ? items.map(i => i.skuId === item.skuId ? { ...i, stockQty, qty } : i)
          : [...items, item]
        set({ items: nextItems, isOpen: true })
        return true
      },

      removeItem: (skuId) =>
        set(s => ({ items: s.items.filter(i => i.skuId !== skuId) })),

      updateQty: (skuId, qty) => {
        if (!Number.isSafeInteger(qty)) return
        if (qty < 1) return get().removeItem(skuId)
        set(s => ({ items: s.items.map(i =>
          i.skuId === skuId && (qty < i.qty || qty <= basketQuantityLimit(i.stockQty)) ? { ...i, qty } : i
        )}))
      },

      clearCart: () => set({ items: [], isOpen: false }),

      getItemCount: () => get().items.reduce((s, i) => s + i.qty, 0),
      getSubtotal:  () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
    }),
    {
      name: 'osr-cart', version: 1,
      // Restore only after React's first render so saved items cannot change
      // the server-rendered basket count during hydration.
      skipHydration: true,
      partialize: state => ({ items: state.items }),
      merge: (saved, current) => ({ ...current, items: Array.isArray(saved?.items) ? saved.items : current.items }),
    }
  )
)
