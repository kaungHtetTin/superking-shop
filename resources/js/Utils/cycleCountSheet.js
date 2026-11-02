const editableFields = ['counted_quantity', 'notes'];

export function cycleCountProgress(items) {
    const missing = items.filter((item) => item.counted_quantity === '' || item.counted_quantity == null).length;
    const invalid = items.filter((item) => {
        if (item.counted_quantity === '' || item.counted_quantity == null) return false;
        try { countValue(String(item.counted_quantity)); return false; } catch { return true; }
    }).length;
    return { missing, invalid, complete: items.length > 0 && missing === 0 && invalid === 0 };
}

export function cycleCountEditsChanged(saved, current) {
    const normalized = (data) => ({
        notes: String(data.notes || '').trim(),
        items: data.items.map((item) => ({
            id: Number(item.id),
            quantity: item.counted_quantity === '' || item.counted_quantity == null ? null : String(Number(item.counted_quantity)),
            notes: String(item.notes || '').trim(),
        })).sort((a, b) => a.id - b.id),
    });
    return JSON.stringify(normalized(saved)) !== JSON.stringify(normalized(current));
}

function countValue(value) {
    const text = value.trim();
    if (text === '') return '';
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,4})?$/.test(text)) {
        throw new Error('Counts must be non-negative numbers with up to four decimal places.');
    }
    const normalized = text.replaceAll(',', '');
    if (Number(normalized) > 9999999999) {
        throw new Error('A count cannot exceed 9,999,999,999.');
    }
    return normalized;
}

// Only physical counts and notes are editable; calculated columns never accept paste.
export function pasteCycleCountCells(items, startRow, field, text) {
    const startColumn = editableFields.indexOf(field);
    if (startColumn < 0 || startRow < 0 || startRow >= items.length) {
        throw new Error('Choose a physical count or notes cell first.');
    }
    const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
    if (startRow + lines.length > items.length) {
        throw new Error('The pasted rows exceed the remaining products in this count.');
    }
    const next = items.map((item) => ({ ...item }));
    lines.forEach((line, offset) => {
        const values = line.split('\t');
        if (startColumn + values.length > editableFields.length) {
            throw new Error('Paste counts in one column, or counts and notes in two columns.');
        }
        values.forEach((value, column) => {
            const key = editableFields[startColumn + column];
            if (key === 'notes' && value.length > 1000) {
                throw new Error('Each note must be 1,000 characters or fewer.');
            }
            next[startRow + offset][key] = key === 'counted_quantity' ? countValue(value) : value;
        });
    });
    return next;
}
