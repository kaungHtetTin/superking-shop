export const unitPrice = (unit, priceType = 'retail') => {
    if (priceType === 'retail' && unit?.flash_sale) {
        return Number(unit.flash_sale.sale_price ?? 0);
    }
    const price = (unit?.prices || []).find((row) => row.price_type === priceType)?.price;
    return Number(price ?? unit?.effective_price ?? unit?.price ?? 0);
};

export const unitOriginalPrice = (unit) => Number(
    unit?.flash_sale?.original_price
    ?? (unit?.prices || []).find((row) => row.price_type === 'retail')?.price
    ?? unit?.price
    ?? 0,
);

export const hasFlashSale = (unit) => Boolean(unit?.flash_sale);

let currencyLabel = 'MMK';

export const configurePricing = (settings = {}) => {
    currencyLabel = String(settings.currency_label || 'MMK').trim();
};

export const formatMoney = (value) =>
    [
        Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
        currencyLabel,
    ].filter(Boolean).join(' ');
