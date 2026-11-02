import { useEffect, useRef, useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { formatMoney } from '@/Utils/pricing';
import { pasteCycleCountCells, cycleCountEditsChanged, cycleCountProgress } from '@/Utils/cycleCountSheet';
import { usePhraseTranslation } from '@/Utils/i18n';

const savedData = (count) => ({ revision: count.revision, notes: count.notes || '', items: count.items.map((item) => ({ id: item.id, counted_quantity: item.counted_quantity ?? '', notes: item.notes || '' })) });
const number = (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });

export default function Show({ count, canEdit, canPost }) {
    const { app_base, flash, errors } = usePage().props;
    const t = usePhraseTranslation();
    const form = useForm(savedData(count));
    const [busy, setBusy] = useState(false);
    const [activeAction, setActiveAction] = useState('');
    const countFormRef = useRef(null);
    const [pasteError, setPasteError] = useState('');
    const cellRefs = useRef({});
    const sheetRef = useRef(null);
    const scrollbarRef = useRef(null);
    const pendingScrollRef = useRef(new WeakMap());
    const [sheetSize, setSheetSize] = useState({ width: 0, viewport: 0 });
    const syncHorizontalScroll = (source, target) => {
        const expected = pendingScrollRef.current.get(source);
        pendingScrollRef.current.delete(source);
        if (expected !== undefined && Math.abs(source.scrollLeft - expected) <= 0.5) return;
        if (target && Math.abs(target.scrollLeft - source.scrollLeft) > 0.5) {
            target.scrollLeft = source.scrollLeft;
            pendingScrollRef.current.set(target, target.scrollLeft);
        }
    };
    useEffect(() => {
        const sheet = sheetRef.current;
        const table = sheet?.querySelector('table');
        if (!sheet || !table) return undefined;
        const measure = () => {
            const size = { width: sheet.scrollWidth, viewport: sheet.clientWidth };
            setSheetSize((current) => current.width === size.width && current.viewport === size.viewport ? current : size);
        };
        const horizontalWheel = (event) => {
            const delta = event.deltaX || (event.shiftKey ? event.deltaY : 0);
            if (!delta || sheet.scrollWidth <= sheet.clientWidth) return;
            event.preventDefault();
            sheet.scrollLeft += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? sheet.clientWidth : 1);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(sheet);
        observer.observe(table);
        sheet.addEventListener('wheel', horizontalWheel, { passive: false });
        return () => { observer.disconnect(); sheet.removeEventListener('wheel', horizontalWheel); };
    }, [count.id]);
    useEffect(() => {
        if (sheetRef.current && scrollbarRef.current) syncHorizontalScroll(sheetRef.current, scrollbarRef.current);
    }, [sheetSize]);
    useEffect(() => { form.setData(savedData(count)); form.clearErrors(); setPasteError(''); }, [count.id, count.revision]);
    const dirty = cycleCountEditsChanged(savedData(count), form.data);
    const draft = count.status === 'draft';
    const editable = draft && canEdit;
    const stale = draft && (count.items.some((item) => item.stale) || Boolean(form.errors.snapshot));
    const inactiveWarehouse = count.location.is_active === false;
    const progress = cycleCountProgress(form.data.items);
    const complete = progress.complete;
    const rows = count.items.map((item) => {
        const entered = form.data.items.find((line) => line.id === item.id);
        const quantity = entered?.counted_quantity;
        const delta = quantity === '' || quantity == null ? null : Number((Number(quantity) - Number(item.system_quantity)).toFixed(4));
        return { ...item, entered, delta, value: delta == null ? null : Math.round(delta * Number(item.base_cost) * 100) / 100 };
    });
    const mismatched = rows.filter((item) => item.delta !== null && item.delta !== 0).length;
    const netValue = rows.reduce((sum, item) => sum + (item.value || 0), 0);
    const updateLine = (id, key, value) => {
        setPasteError('');
        form.setData('items', form.data.items.map((item) => item.id === id ? { ...item, [key]: value } : item));
    };
    const focusCell = (row, column) => {
        const input = cellRefs.current[`${row}-${column}`];
        if (!input || input.disabled) return false;
        input.focus();
        input.select();
        return true;
    };
    const navigateCell = (event, row, column) => {
        if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
        let target;
        if (event.key === 'Enter') target = [row + (event.shiftKey ? -1 : 1), column];
        if (event.key === 'ArrowDown') target = [row + 1, column];
        if (event.key === 'ArrowUp') target = [row - 1, column];
        if (event.key === 'Tab') {
            const index = row * 2 + column + (event.shiftKey ? -1 : 1);
            if (index >= 0 && index < rows.length * 2) target = [Math.floor(index / 2), index % 2];
        }
        if (event.key === 'ArrowRight' && column === 0 && !event.shiftKey) target = [row, 1];
        if (event.key === 'ArrowLeft' && column === 1 && !event.shiftKey && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0) target = [row, 0];
        if (target) {
            event.preventDefault();
            focusCell(...target);
        }
    };
    const pasteCells = (event, row, field) => {
        const text = event.clipboardData.getData('text/plain');
        if (field === 'notes' && !/[\t\r\n]/.test(text)) return;
        event.preventDefault();
        try {
            form.setData('items', pasteCycleCountCells(form.data.items, row, field, text));
            setPasteError('');
        } catch (error) {
            setPasteError(error.message);
        }
    };
    const base = routeWithBase(`/admin/inventory/cycle-counts/${count.id}`, app_base);
    const action = (name, message) => {
        if (!confirm(t(message))) return;
        router.post(`${base}/${name}`, { revision: count.revision }, { preserveScroll: true, onStart: () => { setBusy(true); setActiveAction(name); }, onFinish: () => { setBusy(false); setActiveAction(''); } });
    };
    const postDisabled = busy || form.processing || !complete || stale || inactiveWarehouse;
    const postCounts = () => {
        if (postDisabled || !countFormRef.current?.reportValidity()) return;
        const message = [
            t(dirty ? 'Save and post this count?' : 'Approve and post this count?'),
            `${t('Warehouse')}: ${count.location.name}`,
            `${t('Products with differences')}: ${mismatched}`,
            `${t('Inventory value change')}: ${formatMoney(netValue)}`,
            t('This will adjust warehouse stock and inventory value.'),
        ].join('\n');
        if (!confirm(message)) return;
        const name = dirty ? 'save-and-post' : 'post';
        router.post(`${base}/${name}`, dirty ? form.data : { revision: count.revision }, {
            preserveScroll: true,
            onStart: () => { setBusy(true); setActiveAction(name); form.clearErrors(); },
            onError: (errors) => form.setError(errors),
            onFinish: () => { setBusy(false); setActiveAction(''); },
        });
    };
    const posting = ['post', 'save-and-post'].includes(activeAction);
    const postLabel = posting ? (activeAction === 'save-and-post' ? 'Saving and posting...' : 'Posting...') : dirty && canEdit ? 'Save and post' : 'Approve and post';
    let postHint;
    if (posting) postHint = t('Posting the count. Please wait.');
    else if (busy || form.processing) postHint = t('Wait for the current action to finish.');
    else if (inactiveWarehouse) postHint = t('This warehouse is inactive. Activate it before posting.');
    else if (stale) postHint = t('Stock or cost changed. Refresh and recount before posting.');
    else if (progress.invalid) postHint = t('Correct invalid physical counts before posting. Use non-negative numbers with up to four decimal places.');
    else if (progress.missing) postHint = `${t('Enter a physical count for all products. Remaining')}: ${progress.missing}. ${t('Use 0 for zero stock.')}`;
    else if (!canPost) postHint = t('Save your counts, then ask a staff member with adjustment approval permission to post.');
    else if (form.errors.count) postHint = form.errors.count;
    else if (dirty) postHint = t('Ready to save and post. Your counts will be saved and the adjustments posted together after confirmation.');
    else postHint = t('Counts saved. Ready to approve and post.');
    const save = (event) => { event.preventDefault(); form.put(base, { preserveScroll: true }); };
    return <AdminLayout title={count.count_number} eyebrow={t('Cycle Counting')} action={<div className="inline-actions"><Link className="btn secondary" href={routeWithBase(`/admin/inventory/cycle-counts?location_id=${count.location_id}`, app_base)}>{t('Back to cycle counts')}</Link>{!dirty && <a className="btn secondary" href={`${base}/export`}>XLSX</a>}</div>}>
        <Head title={count.count_number} /><AdminFlash flash={flash} errors={{ ...errors, ...form.errors }} />
        <section className="panel glass cycle-count-panel">
            <PanelHeading title={count.location.name} eyebrow={count.location.code} action={<StatusBadge status={count.status === 'posted' ? 'success' : draft ? 'warning' : 'neutral'} label={t(count.status)} />} />
            <p className="muted">{t('Snapshot')}: {new Date(count.snapshot_at).toLocaleString()} | {t('Created by')}: {count.creator?.name}</p>
            {count.posted_at && <p className="muted">{t('Posted by')}: {count.poster?.name} | {new Date(count.posted_at).toLocaleString()}{count.adjustment && <> | {count.adjustment.adjustment_number} ({t(count.adjustment.status)})</>}</p>}
            {draft && <p className="muted">{t('Enter total physical stock in base units, including reserved stock. Blank means not counted; enter 0 for zero stock. Save a draft or use Save and post when all counts are complete. Value difference = quantity difference multiplied by captured unit cost.')}</p>}
            {stale && <div className="flash error">{t('Stock, cost, or a base unit changed after this snapshot. Refresh and recount before posting. If a base unit changed, start a new session.')}</div>}
            {dirty && <div className="flash warning">{t(canPost ? 'You have unsaved changes. Save a draft, or use Save and post when all counts are complete.' : 'You have unsaved changes. Save counts before requesting approval.')}</div>}
            <div className="cycle-count-summary"><span>{rows.length} {t('products')}</span><span>{rows.filter((item) => item.delta !== null).length} {t('counted')}</span><span>{mismatched} {t('differences')}</span><strong>{t('Net value difference')}: {formatMoney(netValue)}</strong></div>
            <form ref={countFormRef} onSubmit={save}>
                {editable && <p className="cycle-count-sheet-help muted" id="cycle-count-sheet-help">{t('Enter / Up / Down: move between products. Tab: move between count and notes. Paste from Excel: one count per row, or two columns for count and notes. Use Save draft to save progress, or Save and post to apply completed counts.')}</p>}
                {pasteError && <div className="flash error" role="alert">{t(pasteError)}</div>}
                <div ref={sheetRef} onScroll={(event) => syncHorizontalScroll(event.currentTarget, scrollbarRef.current)} className="table-wrap cycle-count-table cycle-count-sheet" tabIndex={0} role="region" aria-label={t('Physical count and variance report')} aria-describedby={editable ? 'cycle-count-sheet-help' : undefined}>
                    <table>
                        <colgroup><col className="count-sheet-row-number" /><col className="count-sheet-product" /><col className="count-sheet-unit" /><col className="count-sheet-system" /><col className="count-sheet-physical" /><col className="count-sheet-difference" /><col className="count-sheet-cost" /><col className="count-sheet-value" /><col className="count-sheet-notes" /></colgroup>
                        <thead><tr>{['#', 'Product', 'Base unit', 'System quantity', 'Physical count', 'Difference', 'Unit cost', 'Value difference', 'Notes'].map((label, column) => <th key={label} scope="col" className={column === 4 || column === 8 ? 'count-sheet-editable-heading' : ''}>{t(label)}</th>)}</tr></thead>
                        <tbody>{rows.map((item, index) => <tr key={item.id}>
                            <th scope="row" className="count-sheet-row-index">{index + 1}</th>
                            <td className="count-sheet-identity"><strong>{item.product_name}</strong><small>{item.product_code}</small>{draft && item.stale && <small>{t('Snapshot changed')}</small>}</td>
                            <td>{item.unit_name}</td><td className="numeric-cell count-sheet-calculated">{number(item.system_quantity)}</td>
                            <td className={`count-sheet-input-cell ${item.delta !== null ? 'is-counted' : ''}`}>{editable ? <input
                                ref={(input) => { cellRefs.current[`${index}-0`] = input; }}
                                className="count-sheet-input count-sheet-count" type="number" min="0" max="9999999999" step="0.0001" inputMode="decimal"
                                aria-label={`${t('Physical count')} ${item.product_name}`} value={item.entered?.counted_quantity ?? ''}
                                onChange={(event) => updateLine(item.id, 'counted_quantity', event.target.value)}
                                onKeyDown={(event) => navigateCell(event, index, 0)} onPaste={(event) => pasteCells(event, index, 'counted_quantity')}
                                onFocus={(event) => event.currentTarget.select()} disabled={busy || form.processing}
                            /> : <span className="count-sheet-readonly">{item.delta === null ? t('Not counted') : number(item.entered.counted_quantity)}</span>}</td>
                            <td className="numeric-cell count-sheet-calculated">{item.delta === null ? '-' : `${item.delta > 0 ? '+' : ''}${number(item.delta)}`}</td>
                            <td className="numeric-cell count-sheet-calculated">{formatMoney(item.base_cost)}</td>
                            <td className="numeric-cell count-sheet-calculated"><strong>{item.value === null ? '-' : formatMoney(item.value)}</strong></td>
                            <td className="count-sheet-input-cell">{editable ? <input
                                ref={(input) => { cellRefs.current[`${index}-1`] = input; }} className="count-sheet-input" maxLength={1000}
                                aria-label={`${t('Notes')} ${item.product_name}`} value={item.entered?.notes || ''}
                                onChange={(event) => updateLine(item.id, 'notes', event.target.value)}
                                onKeyDown={(event) => navigateCell(event, index, 1)} onPaste={(event) => pasteCells(event, index, 'notes')}
                                disabled={busy || form.processing}
                            /> : <span className="count-sheet-readonly">{item.notes || '-'}</span>}</td>
                        </tr>)}</tbody>
                    </table>
                </div>
                <div
                    ref={scrollbarRef} className="cycle-count-sheet-scrollbar" hidden={sheetSize.width <= sheetSize.viewport}
                    style={{ width: sheetSize.viewport }} tabIndex={0} role="region" aria-label={t('Scroll count table horizontally')}
                    onScroll={(event) => syncHorizontalScroll(event.currentTarget, sheetRef.current)}
                ><div style={{ width: sheetSize.width, height: 1 }} /></div>
                <label className="form-field"><span>{t('Session notes')}</span>{editable ? <textarea maxLength={2000} value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} disabled={busy || form.processing} /> : <p>{count.notes || '-'}</p>}</label>
                {draft && <div className="cycle-count-post-controls">
                    <p id="cycle-count-post-hint" className="cycle-count-post-hint" role="status" aria-live="polite">{postHint}</p>
                    <div className="inline-actions cycle-count-actions">
                        {canEdit && <button type="submit" className={`btn ${canPost ? 'secondary' : 'primary'}`} disabled={busy || form.processing || !dirty || progress.invalid > 0}>{t(form.processing ? 'Saving...' : 'Save draft')}</button>}
                        {canPost && <button type="button" className="btn primary" disabled={postDisabled} aria-describedby="cycle-count-post-hint" onClick={postCounts}>{t(postLabel)}</button>}
                        {canEdit && <button type="button" className="btn secondary" disabled={busy || form.processing} onClick={() => action('refresh', 'Refresh system quantities and costs? All physical counts will be cleared and must be counted again.')}>{t('Refresh and recount')}</button>}
                        {canEdit && <button type="button" className="btn secondary" disabled={busy || form.processing} onClick={() => action('cancel', 'Cancel this count session? Stock will remain unchanged.')}>{t('Cancel session')}</button>}
                    </div>
                </div>}
            </form>
        </section>
    </AdminLayout>;
}
