import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
        if (existing) {
          set({ items: items.map(i =>
            i.skuId === item.skuId ? { ...i, qty: i.qty + item.qty } : i
          )})
        } else {
          set({ items: [...items, item] })
        }
        set({ isOpen: true })
      },

      removeItem: (skuId) =>
        set(s => ({ items: s.items.filter(i => i.skuId !== skuId) })),

      updateQty: (skuId, qty) => {
        if (qty < 1) return get().removeItem(skuId)
        set(s => ({ items: s.items.map(i =>
          i.skuId === skuId ? { ...i, qty } : i
        )}))
      },

      clearCart: () => set({ items: [], isOpen: false }),

      getItemCount: () => get().items.reduce((s, i) => s + i.qty, 0),
      getSubtotal:  () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
    }),
    { name: 'osr-cart', version: 1 }
  )
)
