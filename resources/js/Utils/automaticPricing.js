const SCALE = 1000000000000n;
const decimal = value => {
    if (!/^\d+(\.\d{0,12})?$/.test(String(value))) throw new Error('Invalid decimal');
    const [whole, fraction = ''] = String(value).split('.');
    return BigInt(whole) * SCALE + BigInt(fraction.padEnd(12, '0'));
};
const ceil = (a, b) => (a + b - 1n) / b;
const money = cents => `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;

// Informational only: the server recomputes every Automatic amount at commit.
export function automaticPrice(cost, rule, factor = '1') {
    try {
        const c = decimal(cost);
        if (c <= 0n) return null;
        const markup = c * (SCALE + decimal(rule.markup_percent) / 100n) / SCALE;
        const minimum = c + decimal(rule.minimum_profit);
        const rounded = ceil(markup > minimum ? markup : minimum, decimal(rule.rounding)) * decimal(rule.rounding);
        return money(ceil(rounded * decimal(factor) / SCALE, SCALE / 100n));
    } catch { return null; }
}

export function effectiveBuyingCost(paid, free, factor, cost) {
    try {
        const denominator = (decimal(paid) + decimal(free)) * decimal(factor) / SCALE;
        if (decimal(paid) <= 0n || denominator <= 0n) return null;
        const value = decimal(paid) * decimal(cost) / denominator;
        const rounded = (value + 500000n) / 1000000n;
        return `${rounded / 1000000n}.${String(rounded % 1000000n).padStart(6, '0')}`;
    } catch { return null; }
}

export function isBelowBuyingCost(amount, cost, factor = '1') {
    try { return decimal(amount) > 0n && decimal(amount) < decimal(cost) * decimal(factor) / SCALE; }
    catch { return false; }
}
