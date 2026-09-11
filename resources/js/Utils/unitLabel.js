const numberLabel = (value) => Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 6,
});

const unitFactor = (unit) => Number(unit?.conversion_factor ?? unit?.conversionFactor ?? 0);
const unitCode = (unit) => unit?.unit_code || unit?.code || unit?.unit_name || unit?.name || 'unit';

/** Display a base-unit quantity as descending equivalent product units. */
export function formatCompoundQuantity(baseQuantity, units = [], { signed = false } = {}) {
    const numeric = Number(baseQuantity || 0);
    if (!Number.isFinite(numeric)) return '—';

    const normalizedUnits = [...units]
        .filter((unit) => unit && unitFactor(unit) > 0 && unit.is_active !== false)
        .sort((left, right) => unitFactor(right) - unitFactor(left))
        .filter((unit, index, all) => index === 0 || Math.abs(unitFactor(unit) - unitFactor(all[index - 1])) > 0.000001);

    if (normalizedUnits.length === 0) return numberLabel(numeric);

    const prefix = signed && numeric > 0 ? '+' : numeric < 0 ? '−' : '';
    let remaining = Math.abs(numeric);
    const parts = [];

    normalizedUnits.forEach((unit, index) => {
        const factor = unitFactor(unit);
        const isSmallest = index === normalizedUnits.length - 1;
        const quantity = isSmallest
            ? remaining / factor
            : Math.floor((remaining + 0.0000001) / factor);

        if (quantity > 0.0000001) {
            parts.push(`${numberLabel(quantity)} ${unitCode(unit)}`);
            remaining = Math.max(0, remaining - (quantity * factor));
        }
    });

    if (parts.length === 0) {
        parts.push(`0 ${unitCode(normalizedUnits.at(-1))}`);
    }

    return `${prefix}${parts.join(' · ')}`;
}

export function formatSelectedUnitQuantity(quantity, selectedUnit, units = [], options = {}) {
    return formatCompoundQuantity(Number(quantity || 0) * Math.max(unitFactor(selectedUnit), 0.000001), units, options);
}

export function formatUnitWithConversion(unit, units = []) {
    if (!unit) return 'Unit';

    const name = unit.unit_name || unit.name || unit.unit_code || unit.code || 'Unit';
    const code = unit.unit_code || unit.code || '';
    const factor = Math.max(Number(unit.conversion_factor ?? unit.conversionFactor ?? 1), 0.000001);
    const baseUnit = units.find((option) => option?.is_base || option?.isBase)
        || units.find((option) => Math.abs(Number(option?.conversion_factor ?? option?.conversionFactor ?? 0) - 1) < 0.000001)
        || (unit.is_base || unit.isBase ? unit : null);
    const baseCode = baseUnit?.unit_code || baseUnit?.code || baseUnit?.unit_name || baseUnit?.name || 'base';
    const identity = code && name.toLowerCase() !== code.toLowerCase() ? `${name} (${code})` : name;

    return factor === 1
        ? `${identity} · 1 ${baseCode}`
        : `${identity} · 1 ${code || name} = ${numberLabel(factor)} ${baseCode}`;
}
