const numberLabel = (value) => Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 6,
});

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
