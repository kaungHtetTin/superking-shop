import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * @typedef {{ unitId: number, productId: number, productCode?: string|null, name: string, unitName: string, priceType?: string, price: number, originalPrice?: number, flashSale?: object|null, imagePath: string|null, maxQty: number, isPreorder?: boolean, qty: number }} CartLine
 */

export const useCartStore = create(
    persist(
        (set, get) => ({
            orderQtyCap: 999,
            items: /** @type {CartLine[]} */ ([]),
            itemCount: () => get().items.reduce((sum, item) => sum + item.qty, 0),

            addItem: (payload) => {
                const qty = Math.max(1, Math.min(get().orderQtyCap, payload.qty ?? 1));
                set((state) => {
                    const index = state.items.findIndex((item) => item.unitId === payload.unitId);
                    if (index >= 0) {
                        const next = [...state.items];
                        next[index] = {
                            ...next[index],
                            ...payload,
                            qty: Math.min(get().orderQtyCap, next[index].qty + qty),
                            maxQty: Number(payload.maxQty ?? 0),
                            isPreorder: Boolean(payload.isPreorder),
                        };
                        return { items: next };
                    }
                    return { items: [...state.items, {
                        ...payload,
                        maxQty: Number(payload.maxQty ?? 0),
                        isPreorder: Boolean(payload.isPreorder),
                        priceType: payload.priceType || 'retail',
                        qty,
                    }] };
                });
            },

            setQty: (unitId, qty) => set((state) => ({
                items: state.items.map((item) => item.unitId === unitId
                    ? { ...item, qty: Math.max(1, Math.min(get().orderQtyCap, qty)) }
                    : item),
            })),
            removeItem: (unitId) => set((state) => ({
                items: state.items.filter((item) => item.unitId !== unitId),
            })),
            clear: () => set({ items: [] }),
        }),
        {
            name: 'lalapick-cart-v2',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ items: state.items }),
        },
    ),
);
