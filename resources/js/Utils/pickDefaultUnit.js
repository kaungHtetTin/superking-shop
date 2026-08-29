/** Pick the configured selling unit when at least one complete unit is available. */
export function pickDefaultUnitForProduct(product) {
    const activeUnits = (product?.units || []).filter((unit) => unit.is_active !== false);
    const availableUnits = activeUnits.filter((unit) => Number(unit.available_qty ?? 0) >= 1);
    if (!availableUnits.length) return null;

    return availableUnits.find((unit) => unit.is_default_selling)
        || availableUnits.find((unit) => unit.is_base)
        || availableUnits[0];
}
