import { useMemo, useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

const money = formatMoney;

const emptyEntry = {
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
            latest: rows[rows.length - 1],
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
        { key: 'expenses', label: 'Expenses', className: 'expenses' },
        { key: 'net', label: 'Net', className: 'net' },
    ];

    return (
        <div className="finance-chart">
            <div className="finance-chart-summary">
                {series.map((item) => (
                    <div key={item.key}>
                        <span className={`chart-dot ${item.className}`} />
                        <small>{t(item.label)}</small>
                        <strong>{money(chart.latest[item.key])}</strong>
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
    const [search, setSearch] = useState(filters.q ?? '');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(
        Boolean(filters.from || filters.to || filters.type || filters.status || filters.category),
    );
    const form = useForm({ ...emptyEntry });

    const categoryOptions = useMemo(() => {
        if (filters.type && options.categories?.[filters.type]) return options.categories[filters.type];
        return [...(options.categories?.income || []), ...(options.categories?.expense || [])];
    }, [filters.type, options.categories]);

    const formCategoryOptions = options.categories?.[form.data.type] || [];

    const applyFilters = (patch) => {
        router.get(
            routeWithBase('/admin/finance', app_base),
            { ...filters, ...patch },
            { preserveState: true, replace: true },
        );
    };

    const submitSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    const openModal = (entry = null) => {
        setEditing(entry);
        form.clearErrors();
        form.setData(
            entry
                ? {
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
                : { ...emptyEntry },
        );
        setOpen(true);
    };

    const closeModal = () => {
        setOpen(false);
        setEditing(null);
        form.reset();
    };

    const submit = (e) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: closeModal };
        if (editing) {
            form.patch(routeWithBase(`/admin/finance/entries/${editing.id}`, app_base), options);
        } else {
            form.post(routeWithBase('/admin/finance/entries', app_base), options);
        }
    };

    const remove = (entry) => {
        if (!confirm(t('Delete ":title"?', { title: entry.title }))) return;
        router.delete(routeWithBase(`/admin/finance/entries/${entry.id}`, app_base), { preserveScroll: true });
    };

    const resetFilters = () => router.get(routeWithBase('/admin/finance', app_base));

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
            <AdminFlash flash={flash} errors={form.errors} />

            <div className="metrics-grid six compact-kpi-strip finance-kpi-strip">
                <MetricCard label="Order revenue" value={money(summary.order_revenue)} icon="receipt" />
                <MetricCard label="Manual income" value={money(summary.manual_income)} icon="wallet" />
                <MetricCard label="Expenses" value={money(summary.expenses)} icon="card" tone="danger" />
                <MetricCard label="Net profit" value={money(summary.net_profit)} icon="chart" tone={summary.net_profit < 0 ? 'danger' : 'success'} />
                <MetricCard label="Paid orders" value={summary.paid_orders} icon="check" />
                <MetricCard label="Pending review" value={money(Number(summary.pending_income) + Number(summary.pending_expenses))} icon="bell" />
            </div>

            <section className="panel glass finance-filter-panel">
                <PanelHeading eyebrow={t('Period controls')} title={t('Finance filters')} />
                <form className="finance-filter" onSubmit={submitSearch}>
                    <div className="finance-filter-row search-row has-filter-toggle">
                        <div className="search-box">
                            <Icon name="search" size={16} />
                            <input placeholder={t('Search title, reference, notes...')} value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <button
                            type="button"
                            className="btn secondary"
                            aria-expanded={showAdvancedFilters}
                            onClick={() => setShowAdvancedFilters((visible) => !visible)}
                        >
                            <Icon name={showAdvancedFilters ? 'chevronUp' : 'chevronDown'} size={13} />
                            {t('More filters')}
                        </button>
                        <button type="submit" className="btn primary">{t('Search')}</button>
                    </div>
                    {showAdvancedFilters && <div className="finance-filter-row controls-row">
                        <label className="form-field inline">
                            <span>{t('From')}</span>
                            <input type="date" value={filters.from || ''} onChange={(e) => applyFilters({ from: e.target.value || undefined })} />
                        </label>
                        <label className="form-field inline">
                            <span>{t('To')}</span>
                            <input type="date" value={filters.to || ''} onChange={(e) => applyFilters({ to: e.target.value || undefined })} />
                        </label>
                        <select value={filters.type || ''} onChange={(e) => applyFilters({ type: e.target.value || undefined, category: undefined })}>
                            <option value="">{t('All types')}</option>
                            <option value="income">{t('Income')}</option>
                            <option value="expense">{t('Expense')}</option>
                        </select>
                        <select value={filters.status || ''} onChange={(e) => applyFilters({ status: e.target.value || undefined })}>
                            <option value="">{t('All statuses')}</option>
                            {options.statuses.map((status) => (
                                <option key={status} value={status}>
                                    {t(status)}
                                </option>
                            ))}
                        </select>
                        <select value={filters.category || ''} onChange={(e) => applyFilters({ category: e.target.value || undefined })}>
                            <option value="">{t('All categories')}</option>
                            {categoryOptions.map((category) => (
                                <option key={`${category.value}-${category.label}`} value={category.value}>
                                    {t(category.label)}
                                </option>
                            ))}
                        </select>
                        <button type="button" className="btn secondary" onClick={resetFilters}>{t('Reset')}</button>
                    </div>}
                </form>
            </section>

            <div className="finance-grid finance-grid-full">
                <section className="panel glass">
                    <PanelHeading eyebrow={`${summary.from} ${t('to')} ${summary.to}`} title={t('Daily finance trend')} />
                    <DailyFinanceChart trend={trend} />
                </section>
            </div>

            <section className="panel glass finance-ledger-panel">
                <PanelHeading eyebrow={t('Manual ledger')} title={t('Income and expense entries')} />
                <div className="table-wrap">
                    <table className="finance-ledger-table">
                        <thead>
                            <tr>
                                <th>{t('Date')}</th>
                                <th>{t('Entry')}</th>
                                <th>{t('Type')}</th>
                                <th className="numeric-cell">{t('Amount')}</th>
                                <th>{t('Status')}</th>
                                <th>{t('Recorded by')}</th>
                                <th className="table-actions-column" />
                            </tr>
                        </thead>
                        <tbody>
                            {entries.data.length === 0 ? (
                                <tr><td colSpan={7}><span className="muted">{t('No manual finance entries match your filters.')}</span></td></tr>
                            ) : entries.data.map((entry) => {
                                const isStockReceiptEntry = entry.is_stock_receipt_entry || entry.category === 'stock_receipt';

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
                                        <td><StatusBadge status={entry.type === 'income' ? 'success' : 'warning'} label={t(entry.type)} /></td>
                                        <td className="money-cell"><strong>{money(entry.amount)}</strong></td>
                                        <td><StatusBadge status={entry.status} label={t(entry.status)} /></td>
                                        <td>{entry.recorder?.name || t('System')}</td>
                                        <td className="table-actions-column">
                                            {isStockReceiptEntry ? (
                                                <span className="muted">{t('Managed by receipt')}</span>
                                            ) : (
                                                <div className="inline-actions">
                                                    <button type="button" className="icon-btn small" onClick={() => openModal(entry)} aria-label={t('Edit entry')} title={t('Edit entry')}>
                                                        <Icon name="edit" size={13} />
                                                    </button>
                                                    <button type="button" className="icon-btn small danger" onClick={() => remove(entry)} aria-label={t('Delete entry')} title={t('Delete entry')}>
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

                <LedgerPagination paginator={entries} />
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

                        <div className="crud-grid admin-form-grid">
                            <label className="form-field">
                                <span>{t('Type')}</span>
                                <select
                                    value={form.data.type}
                                    onChange={(e) => {
                                        const type = e.target.value;
                                        form.setData({
                                            ...form.data,
                                            type,
                                            category: options.categories?.[type]?.[0]?.value || '',
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
