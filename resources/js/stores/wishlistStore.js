import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Client wishlist snapshot includes selling units so an item can be moved to cart.
 * @typedef {{ productId: number, productCode?: string|null, slug: string, name: string, imagePath: string|null, units: unknown[], categoryName: string|null, rating: number, review_count: number }} WishlistItem
 */

export const useWishlistStore = create(
    persist(
        (set, get) => ({
            items: /** @type {WishlistItem[]} */ ([]),

            count: () => get().items.length,

            has: (productId) => get().items.some((i) => i.productId === productId),

            /** @param {WishlistItem} row */
            add: (row) => {
                set((state) => {
                    if (state.items.some((i) => i.productId === row.productId)) {
                        return state;
                    }
                    return { items: [...state.items, row] };
                });
            },

            remove: (productId) => {
                set((state) => ({
                    items: state.items.filter((i) => i.productId !== productId),
                }));
            },

            /** @returns {boolean} true if item is now in the wishlist */
            toggle: (row) => {
                const items = get().items;
                const exists = items.some((i) => i.productId === row.productId);
                if (exists) {
                    set({ items: items.filter((i) => i.productId !== row.productId) });
                    return false;
                }
                set({ items: [...items, row] });
                return true;
            },
        }),
        {
            name: 'lalapick-wishlist-v1',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ items: state.items }),
        }
    )
);
