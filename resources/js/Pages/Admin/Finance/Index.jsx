import { useEffect, useMemo, useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { FilterVisibilityControl, PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

const money = formatMoney;

const emptyEntry = {
    location_id: '',
    type: 'expense',
    category: 'inventory',
    title: '',
    amount: '',
    entry_date: new Date().toISOString().slice(0, 10),
    payment_method: '',
    reference: '',
    status: 'approved',
    notes: '',
};

function MetricCard({ label, value, icon, tone }) {
    const t = usePhraseTranslation();

    return (
        <article className={`metric-card glass ${tone ? `tone-${tone}` : ''}`}>
            <span className="icon-well">
                <Icon name={icon} size={15} />
            </span>
            <small>{t(label)}</small>
            <strong>{value}</strong>
        </article>
    );
}

function categoryLabel(options, type, value) {
    return (options.categories?.[type] || []).find((item) => item.value === value)?.label || value;
}

function smoothLinePath(points) {
    if (points.length === 0) {
        return '';
    }

    if (points.length === 1) {
        return `M ${points[0].x} ${points[0].y}`;
    }

    return points.reduce((path, point, index) => {
        if (index === 0) {
            return `M ${point.x} ${point.y}`;
        }

        const previous = points[index - 1];
        const controlX = (previous.x + point.x) / 2;

        return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
    }, '');
}

function DailyFinanceChart({ trend }) {
    const t = usePhraseTranslation();
    const chart = useMemo(() => {
        const rows = trend.map((row) => ({
            day: row.day,
            income: Number(row.income || 0),
            expenses: Number(row.expenses || 0),
            net: Number(row.net || 0),
        }));

        if (rows.length === 0) {
            return null;
        }

        const values = rows.flatMap((row) => [row.income, row.expenses, row.net, 0]);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const width = 720;
        const height = 260;
        const padding = { top: 18, right: 18, bottom: 34, left: 64 };
        const innerWidth = width - padding.left - padding.right;
        const innerHeight = height - padding.top - padding.bottom;
        const xFor = (index) => padding.left + (rows.length === 1 ? innerWidth / 2 : (index / (rows.length - 1)) * innerWidth);
        const yFor = (value) => padding.top + ((max - value) / range) * innerHeight;
        const pathFor = (key) => smoothLinePath(rows.map((row, index) => ({ x: xFor(index), y: yFor(row[key]) })));
        const ticks = Array.from({ length: 5 }, (_, index) => min + (range / 4) * index).reverse();
        const labelStep = Math.max(1, Math.ceil(rows.length / 5));

        return {
            rows,
            width,
            height,
            padding,
            innerWidth,
            xFor,
            yFor,
            pathFor,
            ticks,
            labelStep,
            zeroY: yFor(0),
            totals: rows.reduce((totals, row) => ({
                income: totals.income + row.income,
                expenses: totals.expenses + row.expenses,
                net: totals.net + row.net,
            }), { income: 0, expenses: 0, net: 0 }),
        };
    }, [trend]);

    if (!chart) {
        return (
            <div className="finance-chart-empty">
                <span className="muted">{t('No finance data in this period.')}</span>
            </div>
        );
    }

    const series = [
        { key: 'income', label: 'Income', className: 'income' },
        { key: 'expenses', label: 'Costs & expenses', className: 'expenses' },
        { key: 'net', label: 'Net', className: 'net' },
    ];

    return (
        <div className="finance-chart">
            <div className="finance-chart-summary">
                {series.map((item) => (
                    <div key={item.key}>
                        <span className={`chart-dot ${item.className}`} />
                        <small>{t(item.label)}</small>
                        <strong>{money(chart.totals[item.key])}</strong>
                    </div>
                ))}
            </div>
            <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={t('Daily finance trend line chart')}>
                {chart.ticks.map((tick) => (
                    <g key={tick}>
                        <line
                            className="chart-grid-line"
                            x1={chart.padding.left}
                            x2={chart.width - chart.padding.right}
                            y1={chart.yFor(tick)}
                            y2={chart.yFor(tick)}
                        />
                        <text className="chart-y-label" x={chart.padding.left - 10} y={chart.yFor(tick) + 4}>
                            {money(tick)}
                        </text>
                    </g>
                ))}
                <line
                    className="chart-zero-line"
                    x1={chart.padding.left}
                    x2={chart.width - chart.padding.right}
                    y1={chart.zeroY}
                    y2={chart.zeroY}
                />
                {series.map((item) => (
                    <path
                        key={item.key}
                        className={`chart-line ${item.className}`}
                        d={chart.pathFor(item.key)}
                    />
                ))}
                {series.map((item) => chart.rows.map((row, index) => (
                    <circle
                        key={`${item.key}-${row.day}`}
                        className={`chart-point ${item.className}`}
                        cx={chart.xFor(index)}
                        cy={chart.yFor(row[item.key])}
                        r="3.5"
                    >
                        <title>{`${row.day} ${t(item.label)}: ${money(row[item.key])}`}</title>
                    </circle>
                )))}
                {chart.rows.map((row, index) => (
                    (index % chart.labelStep === 0 || index === chart.rows.length - 1) && (
                        <text key={row.day} className="chart-x-label" x={chart.xFor(index)} y={chart.height - 10}>
                            {row.day.slice(5)}
                        </text>
                    )
                ))}
            </svg>
        </div>
    );
}

function LedgerPagination({ paginator }) {
    const t = usePhraseTranslation();

    if (!paginator || paginator.last_page <= 1) {
        return null;
    }

    return (
        <div className="ledger-pagination">
            <small>
                {t('Showing :from-:to of :total entries', {
                    from: paginator.from || 0,
                    to: paginator.to || 0,
                    total: paginator.total,
                })}
            </small>
            <div className="pagination-links">
                {paginator.links.map((link, index) => {
                    const label = link.label.includes('&laquo;')
                        ? t('Previous')
                        : link.label.includes('&raquo;')
                            ? t('Next')
                            : link.label.replace(/&amp;/g, '&');

                    if (!link.url) {
                        return (
                            <span
                                key={`${label}-${index}`}
                                className={`pagination-link disabled ${link.active ? 'active' : ''}`}
                            >
                                {label}
                            </span>
                        );
                    }

                    return (
                        <Link
                            key={`${label}-${index}`}
                            href={link.url}
                            className={`pagination-link ${link.active ? 'active' : ''}`}
                            preserveScroll
                        >
                            {label}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

export default function FinanceIndex({ entries, summary, trend, filters, options }) {
    const t = usePhraseTranslation();
    const { app_base, flash } = usePage().props;
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [localSuccess, setLocalSuccess] = useState('');
    const [visibleEntries, setVisibleEntries] = useState(entries);
    const [deletingId, setDeletingId] = useState(null);
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [filterState, setFilterState] = useState({
        q: filters.q ?? '',
        location_id: filters.location_id ?? '',
        from: filters.from ?? '',
        to: filters.to ?? '',
        type: filters.type ?? '',
        status: filters.status ?? '',
        category: filters.category ?? '',
    });
    const [visibleFilters, setVisibleFilters] = useState({ q: true, location_id: Boolean(filters.location_id), from: Boolean(filters.from), to: Boolean(filters.to), type: true, status: Boolean(filters.status), category: Boolean(filters.category) });
    const form = useForm({ ...emptyEntry });

    const categoryOptions = useMemo(() => {
        if (filterState.type && options.categories?.[filterState.type]) return options.categories[filterState.type];
        return [...(options.categories?.income || []), ...(options.categories?.expense || []), ...(options.categories?.asset || [])];
    }, [filterState.type, options.categories]);

    const formCategoryOptions = options.manual_categories?.[form.data.type] || [];

    const activeFilterCount = Object.values(filterState).filter(Boolean).length;

    useEffect(() => {
        setVisibleEntries(entries);
    }, [entries]);

    useEffect(() => {
        if (!filterDrawerOpen) return undefined;
        const closeOnEscape = (event) => event.key === 'Escape' && setFilterDrawerOpen(false);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [filterDrawerOpen]);

    const submitFilters = (event) => {
        event.preventDefault();
        setFilterDrawerOpen(false);
        router.get(
            routeWithBase('/admin/finance', app_base),
            { ...filterState, q: filterState.q.trim() || undefined },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const openModal = (entry = null) => {
        setLocalSuccess('');
        setEditing(entry);
        form.clearErrors();
        form.setData(
            entry
                ? {
                      location_id: entry.location_id || '',
                      type: entry.type,
                      category: entry.category,
                      title: entry.title,
                      amount: entry.amount,
                      entry_date: entry.entry_date ? entry.entry_date.slice(0, 10) : emptyEntry.entry_date,
                      payment_method: entry.payment_method || '',
                      reference: entry.reference || '',
                      status: entry.status,
                      notes: entry.notes || '',
                  }
                : { ...emptyEntry, location_id: filters.location_id || options.locations?.[0]?.id || '' },
        );
        setOpen(true);
    };

    const closeModal = () => {
        setOpen(false);
        setEditing(null);
        form.reset();
    };

    const submit = async (e) => {
        e.preventDefault();
        let failed = false;
        const options = {
            preserveScroll: true,
            onError: () => {
                failed = true;
            },
        };

        if (editing) {
            await form.patch(routeWithBase(`/admin/finance/entries/${editing.id}`, app_base), options);
        } else {
            await form.post(routeWithBase('/admin/finance/entries', app_base), options);
        }

        if (!failed) {
            setLocalSuccess(editing ? t('Financial entry updated.') : t('Financial entry created.'));
            closeModal();
            await router.reload({ preserveScroll: true, showSkeleton: false });
        }
    };

    const remove = (entry) => {
        if (!confirm(t('Delete ":title"?', { title: entry.title }))) return;
        const previousEntries = visibleEntries;
        setLocalSuccess('');
        setDeletingId(entry.id);
        setVisibleEntries((current) => ({
            ...current,
            data: current.data.filter((item) => Number(item.id) !== Number(entry.id)),
            total: Math.max(0, Number(current.total || 0) - 1),
        }));
        router.delete(routeWithBase(`/admin/finance/entries/${entry.id}`, app_base), {}, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: (page) => {
                setLocalSuccess(t('Financial entry deleted.'));
                if (page?.props?.entries) setVisibleEntries(page.props.entries);
                router.reload({
                    preserveScroll: true,
                    preserveState: true,
                    showSkeleton: false,
                    onSuccess: (freshPage) => {
                        if (freshPage?.props?.entries) setVisibleEntries(freshPage.props.entries);
                    },
                });
            },
            onError: () => setVisibleEntries(previousEntries),
            onFinish: () => setDeletingId(null),
        });
    };

    const resetFilters = () => {
        setFilterDrawerOpen(false);
        setFilterState({ q: '', location_id: '', from: '', to: '', type: '', status: '', category: '' });
        router.get(routeWithBase('/admin/finance', app_base));
    };
    const exportQuery = new URLSearchParams();
    Object.entries(filterState).forEach(([key, value]) => value !== null && value !== undefined && value !== '' && exportQuery.set(key, value));

    const renderFilterFields = (autoFocus = false, onlyVisible = false) => (
        <>
            {(!onlyVisible || visibleFilters.q !== false) && <label className="form-field finance-report-filter__search">
                <span>{t('Search entries')}</span>
                <span className="search-box"><Icon name="search" size={15} /><input autoFocus={autoFocus} type="search" placeholder={t('Title, reference or notes')} value={filterState.q} onChange={(event) => setFilterState((current) => ({ ...current, q: event.target.value }))} /></span>
            </label>}
            {(!onlyVisible || visibleFilters.location_id !== false) && <label className="form-field finance-report-filter__store">
                <span>{t('Store')}</span>
                <select value={filterState.location_id} onChange={(event) => setFilterState((current) => ({ ...current, location_id: event.target.value }))}>
                    <option value="">{t('All stores')}</option>
                    {options.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
            </label>}
            {(!onlyVisible || visibleFilters.from !== false) && <label className="form-field finance-report-filter__date"><span>{t('From')}</span><input type="date" value={filterState.from} onChange={(event) => setFilterState((current) => ({ ...current, from: event.target.value }))} /></label>}
            {(!onlyVisible || visibleFilters.to !== false) && <label className="form-field finance-report-filter__date"><span>{t('To')}</span><input type="date" value={filterState.to} onChange={(event) => setFilterState((current) => ({ ...current, to: event.target.value }))} /></label>}
            {(!onlyVisible || visibleFilters.type !== false) && <label className="form-field finance-report-filter__select">
                <span>{t('Type')}</span>
                <select value={filterState.type} onChange={(event) => setFilterState((current) => ({ ...current, type: event.target.value, category: '' }))}>
                    <option value="">{t('All types')}</option><option value="income">{t('Income')}</option><option value="expense">{t('Expense')}</option><option value="asset">{t('Asset acquisition')}</option>
                </select>
            </label>}
            {(!onlyVisible || visibleFilters.status !== false) && <label className="form-field finance-report-filter__select">
                <span>{t('Status')}</span>
                <select value={filterState.status} onChange={(event) => setFilterState((current) => ({ ...current, status: event.target.value }))}>
                    <option value="">{t('All statuses')}</option>
                    {options.statuses.map((status) => <option key={status} value={status}>{t(status)}</option>)}
                </select>
            </label>}
            {(!onlyVisible || visibleFilters.category !== false) && <label className="form-field finance-report-filter__category">
                <span>{t('Category')}</span>
                <select value={filterState.category} onChange={(event) => setFilterState((current) => ({ ...current, category: event.target.value }))}>
                    <option value="">{t('All categories')}</option>
                    {categoryOptions.map((category) => <option key={`${category.value}-${category.label}`} value={category.value}>{t(category.label)}</option>)}
                </select>
            </label>}
        </>
    );

    return (
        <AdminLayout
            title={t('Finance')}
            eyebrow={t('Financial control')}
            action={
                <button type="button" className="btn primary" onClick={() => openModal()}>
                    <Icon name="plus" size={14} />
                    {t('Add entry')}
                </button>
            }
        >
            <Head title={t('Finance')} />
            <AdminFlash flash={flash} errors={open ? {} : form.errors} />
            <p className="muted">{t('Revenue includes completed credit sales. Payments and refunds are tracked separately from profit.')}</p>
            {Number(summary.unvalued_adjustment_lines) > 0 && <p role="status" className="muted">{t('Historical stock adjustments are missing cost snapshots. Profit is incomplete until those records are reconciled.')} ({summary.unvalued_adjustment_lines})</p>}

            <div className="metrics-grid six compact-kpi-strip finance-kpi-strip">
                <MetricCard label="Order revenue" value={money(summary.order_revenue)} icon="receipt" />
                <MetricCard label="Cost of goods" value={money(summary.cost_of_goods)} icon="box" tone="danger" />
                <MetricCard label="Inventory purchases" value={money(summary.stock_purchases)} icon="receipt" />
                <MetricCard label="Other income" value={money(summary.manual_income)} icon="wallet" />
                <MetricCard label="Operating expenses" value={money(summary.expenses)} icon="card" tone="danger" />
                <MetricCard label="Net profit" value={money(summary.net_profit)} icon="chart" tone={summary.net_profit < 0 ? 'danger' : 'success'} />
                <MetricCard label="Paid orders" value={summary.paid_orders} icon="check" />
                <MetricCard label="Refunds due (all dates)" value={money(summary.refunds_due)} icon="wallet" tone="danger" />
            </div>

            <section className="panel glass finance-filter-panel">
                <PanelHeading
                    eyebrow={t('Period controls')}
                    title={t('Finance filters')}
                    action={(<div className="inline-actions filter-heading-actions">
                        <button type="button" className="btn secondary finance-report-filter__mobile-trigger" onClick={() => setFilterDrawerOpen(true)}>
                            <Icon name="filterList" size={15} /> {t('Filter')}
                            {activeFilterCount > 0 && <span className="finance-report-filter__count">{activeFilterCount}</span>}
                        </button>
                        <FilterVisibilityControl filters={[{ key: 'q', label: 'Search entries' }, { key: 'location_id', label: 'Store' }, { key: 'from', label: 'From date' }, { key: 'to', label: 'To date' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'category', label: 'Category' }]} visible={visibleFilters} onToggle={(key) => setVisibleFilters((current) => ({ ...current, [key]: current[key] === false }))} activeCount={activeFilterCount} />
                    </div>)}
                />
                <form className="finance-report-filter" onSubmit={submitFilters} aria-label={t('Finance filters')}>
                    <div className="finance-report-filter__scroll">
                        <div className="finance-report-filter__fields">{renderFilterFields(false, true)}</div>
                    </div>
                    <div className="inline-actions finance-report-filter__actions">
                        <button type="submit" className="btn primary"><Icon name="search" size={14} /> {t('Search')}</button>
                        <a className="btn secondary" href={`${routeWithBase('/admin/finance/export', app_base)}?${exportQuery.toString()}`}><Icon name="download" size={14} /> CSV</a>
                        <button type="button" className="btn secondary" onClick={resetFilters}>{t('Reset')}</button>
                    </div>
                </form>
            </section>

            {filterDrawerOpen && (
                <div className="modal-backdrop finance-report-filter__backdrop" onMouseDown={() => setFilterDrawerOpen(false)}>
                    <form className="drawer glass finance-report-filter__drawer" onSubmit={submitFilters} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="finance-filter-title">
                        <div className="drawer-header">
                            <div><small className="eyebrow">{t('Period controls')}</small><h2 id="finance-filter-title">{t('Finance filters')}</h2></div>
                            <button type="button" className="icon-btn" onClick={() => setFilterDrawerOpen(false)} aria-label={t('Close')}><Icon name="close" size={16} /></button>
                        </div>
                        <div className="finance-report-filter__drawer-body">
                            {renderFilterFields(true)}
                            <a className="btn secondary finance-report-filter__drawer-export" href={`${routeWithBase('/admin/finance/export', app_base)}?${exportQuery.toString()}`}><Icon name="download" size={14} /> CSV</a>
                        </div>
                        <div className="drawer-actions">
                            <button type="button" className="btn secondary" onClick={resetFilters}>{t('Reset')}</button>
                            <button type="submit" className="btn primary"><Icon name="search" size={14} /> {t('Search')}</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="finance-grid finance-grid-full">
                <section className="panel glass">
                    <PanelHeading eyebrow={`${summary.from} ${t('to')} ${summary.to}`} title={t('Daily finance trend')} />
                    <DailyFinanceChart trend={trend} />
                </section>
            </div>

            <section className="panel glass finance-ledger-panel">
                <PanelHeading eyebrow={t('Financial records')} title={t('Financial activity')} />
                {localSuccess && <div className="flash success" role="status">{localSuccess}</div>}
                <div className="table-wrap">
                    <table className="finance-ledger-table">
                        <thead>
                            <tr>
                                <th>{t('Date')}</th>
                                <th>{t('Entry')}</th>
                                <th>{t('Store')}</th>
                                <th>{t('Type')}</th>
                                <th className="numeric-cell">{t('Amount')}</th>
                                <th>{t('Status')}</th>
                                <th>{t('Recorded by')}</th>
                                <th className="table-actions-column" />
                            </tr>
                        </thead>
                        <tbody>
                            {visibleEntries.data.length === 0 ? (
                                <tr><td colSpan={8}><span className="muted">{t('No finance entries match your filters.')}</span></td></tr>
                            ) : visibleEntries.data.map((entry) => {
                                const isManagedEntry = entry.is_system_managed || entry.is_stock_receipt_entry || entry.category === 'stock_receipt';

                                return (
                                    <tr key={entry.id}>
                                        <td>{entry.entry_date?.slice(0, 10)}</td>
                                        <td>
                                            <strong>{entry.title}</strong>
                                            <small>
                                                {t(categoryLabel(options, entry.type, entry.category))}
                                                {entry.reference ? ` / ${entry.reference}` : ''}
                                            </small>
                                        </td>
                                        <td>{entry.location?.name || t('Unassigned')}</td>
                                        <td><StatusBadge status={entry.type === 'income' ? 'success' : entry.type === 'asset' ? 'info' : 'warning'} label={t(entry.category === 'stock_adjustment' && entry.type === 'asset' ? 'Stock count surplus' : entry.category === 'stock_receipt' ? 'Inventory purchase' : entry.type === 'asset' ? 'Asset acquisition' : entry.type)} /></td>
                                        <td className="money-cell"><strong>{money(entry.amount)}</strong></td>
                                        <td><StatusBadge status={entry.status} label={t(entry.status)} /></td>
                                        <td>{entry.recorder?.name || t('System')}</td>
                                        <td className="table-actions-column">
                                            {isManagedEntry ? (
                                                <span className="muted">{t('System managed')}</span>
                                            ) : (
                                                <div className="inline-actions">
                                                    <button type="button" className="icon-btn small" onClick={() => openModal(entry)} aria-label={t('Edit entry')} title={t('Edit entry')} disabled={deletingId !== null}>
                                                        <Icon name="edit" size={13} />
                                                    </button>
                                                    <button type="button" className="icon-btn small danger" onClick={() => remove(entry)} aria-label={t('Delete entry')} title={t('Delete entry')} disabled={deletingId !== null}>
                                                        <Icon name="trash" size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <LedgerPagination paginator={visibleEntries} />
            </section>

            {open && (
                <div className="modal-backdrop" onClick={closeModal}>
                    <form className="operation-modal compact glass admin-form-modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header admin-form-modal-header">
                            <div className="admin-form-modal-title">
                                <span className="admin-form-title-icon"><Icon name="wallet" size={16} /></span>
                                <div>
                                    <h2>{editing ? t('Edit entry') : t('New entry')}</h2>
                                </div>
                            </div>
                            <button type="button" className="icon-btn small" onClick={closeModal} aria-label={t('Close')} title={t('Close')}>
                                <Icon name="close" size={14} />
                            </button>
                        </div>

                        {Object.keys(form.errors).length > 0 && (
                            <div className="flash error" style={{ margin: '12px 16px 0' }}>
                                {Object.values(form.errors).map((error, index) => <div key={`${index}-${error}`}>{error}</div>)}
                            </div>
                        )}

                        <div className="crud-grid admin-form-grid">
                            <label className="form-field">
                                <span>{t('Store')}</span>
                                <select value={form.data.location_id} onChange={(e) => form.setData('location_id', e.target.value)} required>
                                    <option value="">{t('Choose store')}</option>
                                    {options.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                                </select>
                            </label>
                            <label className="form-field">
                                <span>{t('Type')}</span>
                                <select
                                    value={form.data.type}
                                    onChange={(e) => {
                                        const type = e.target.value;
                                        form.setData({
                                            ...form.data,
                                            type,
                                            category: options.manual_categories?.[type]?.[0]?.value || '',
                                        });
                                    }}
                                >
                                    <option value="income">{t('Income')}</option>
                                    <option value="expense">{t('Expense')}</option>
                                </select>
                            </label>
                            <label className="form-field">
                                <span>{t('Category')}</span>
                                <select value={form.data.category} onChange={(e) => form.setData('category', e.target.value)}>
                                    {formCategoryOptions.map((category) => (
                                        <option key={category.value} value={category.value}>{t(category.label)}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="form-field">
                                <span>{t('Title')}</span>
                                <input value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} required />
                            </label>
                            <label className="form-field">
                                <span>{t('Amount')}</span>
                                <input type="number" step="0.01" min="0.01" value={form.data.amount} onChange={(e) => form.setData('amount', e.target.value)} required />
                            </label>
                            <label className="form-field">
                                <span>{t('Date')}</span>
                                <input type="date" value={form.data.entry_date} onChange={(e) => form.setData('entry_date', e.target.value)} required />
                            </label>
                            <label className="form-field">
                                <span>{t('Status')}</span>
                                <select value={form.data.status} onChange={(e) => form.setData('status', e.target.value)}>
                                    <option value="approved">{t('Approved')}</option>
                                    <option value="pending">{t('Pending')}</option>
                                    <option value="void">{t('Void')}</option>
                                </select>
                            </label>
                            <label className="form-field">
                                <span>{t('Payment method')}</span>
                                <input value={form.data.payment_method} onChange={(e) => form.setData('payment_method', e.target.value)} placeholder={t('Cash, bank, wallet...')} />
                            </label>
                            <label className="form-field">
                                <span>{t('Reference')}</span>
                                <input value={form.data.reference} onChange={(e) => form.setData('reference', e.target.value)} placeholder={t('Receipt or transaction ID')} />
                            </label>
                            <label className="form-field full">
                                <span>{t('Notes')}</span>
                                <textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} rows={3} />
                            </label>
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={closeModal}>{t('Cancel')}</button>
                            <button type="submit" className="btn primary" disabled={form.processing}>{editing ? t('Save changes') : t('Create entry')}</button>
                        </div>
                    </form>
                </div>
            )}
        </AdminLayout>
    );
}
