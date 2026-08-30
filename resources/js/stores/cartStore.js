import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * @typedef {{ id: number, name: string, code?: string|null, price: number, originalPrice?: number, flashSale?: object|null, imagePath?: string|null, maxQty: number }} CartUnitOption
 * @typedef {{ unitId: number, productId: number, productCode?: string|null, name: string, unitName: string, priceType?: string, price: number, originalPrice?: number, flashSale?: object|null, imagePath: string|null, maxQty: number, unitOptions?: CartUnitOption[], isPreorder?: boolean, qty: number }} CartLine
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
                    ? {
                        ...item,
                        qty: Math.max(1, Math.min(
                            get().orderQtyCap,
                            Number(item.maxQty || get().orderQtyCap),
                            qty,
                        )),
                    }
                    : item),
            })),
            changeUnit: (currentUnitId, nextUnitId) => set((state) => {
                const current = state.items.find((item) => Number(item.unitId) === Number(currentUnitId));
                if (!current) return state;

                const option = (current.unitOptions || []).find((unit) => Number(unit.id) === Number(nextUnitId));
                if (!option || Number(option.maxQty || 0) <= 0) return state;

                const existing = state.items.find((item) => (
                    Number(item.unitId) === Number(nextUnitId)
                    && Number(item.unitId) !== Number(currentUnitId)
                ));
                const maxQty = Math.min(get().orderQtyCap, Number(option.maxQty || 0));

                if (existing) {
                    return {
                        items: state.items
                            .filter((item) => Number(item.unitId) !== Number(currentUnitId))
                            .map((item) => Number(item.unitId) === Number(nextUnitId)
                                ? {
                                    ...item,
                                    unitOptions: current.unitOptions,
                                    qty: Math.max(1, Math.min(maxQty, Number(item.qty || 0) + Number(current.qty || 0))),
                                    maxQty,
                                }
                                : item),
                    };
                }

                return {
                    items: state.items.map((item) => Number(item.unitId) === Number(currentUnitId)
                        ? {
                            ...item,
                            unitId: option.id,
                            unitName: option.name || option.code,
                            price: Number(option.price || 0),
                            originalPrice: Number(option.originalPrice || option.price || 0),
                            flashSale: option.flashSale || null,
                            imagePath: option.imagePath || item.imagePath,
                            maxQty,
                            qty: Math.max(1, Math.min(maxQty, Number(item.qty || 1))),
                        }
                        : item),
                };
            }),
            syncUnitOptions: (productId, unitOptions) => set((state) => ({
                items: state.items.map((item) => {
                    if (Number(item.productId) !== Number(productId)) return item;

                    const selected = unitOptions.find((unit) => Number(unit.id) === Number(item.unitId));
                    if (!selected) return { ...item, unitOptions };

                    const maxQty = Math.min(get().orderQtyCap, Number(selected.maxQty || 0));
                    return {
                        ...item,
                        unitOptions,
                        unitName: selected.name || selected.code,
                        price: Number(selected.price || 0),
                        originalPrice: Number(selected.originalPrice || selected.price || 0),
                        flashSale: selected.flashSale || null,
                        maxQty,
                        qty: maxQty > 0 ? Math.min(Number(item.qty || 1), maxQty) : Number(item.qty || 1),
                    };
                }),
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
