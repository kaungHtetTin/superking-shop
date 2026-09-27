import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';
import { formatCompoundQuantity } from '@/Utils/unitLabel';

const money = formatMoney;
const percent = (value) => `${Number(value || 0).toFixed(1)}%`;

function MetricCard({ label, value, hint, icon, tone }) {
    const t = usePhraseTranslation();

    return (
        <article className={`metric-card glass ${tone ? `tone-${tone}` : ''}`}>
            <span className="icon-well">
                <Icon name={icon} size={15} />
            </span>
            <small>{t(label)}</small>
            <strong>{value}</strong>
            {hint && <p>{t(hint)}</p>}
        </article>
    );
}

function SalesTrendChart({ rows }) {
    const t = usePhraseTranslation();
    const chartRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(760);

    useEffect(() => {
        const element = chartRef.current;
        if (!element) return undefined;

        const updateWidth = () => {
            setChartWidth(Math.max(320, Math.round(element.getBoundingClientRect().width)));
        };

        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const chart = useMemo(() => {
        const data = rows.map((row) => ({
            day: row.day,
            orders: Number(row.orders || 0),
            revenue: Number(row.revenue || 0),
        }));

        if (data.length === 0) return null;

        const width = chartWidth;
        const height = 280;
        const padding = { top: 18, right: 18, bottom: 34, left: 96 };
        const innerWidth = width - padding.left - padding.right;
        const innerHeight = height - padding.top - padding.bottom;
        const maxRevenue = Math.max(...data.map((row) => row.revenue), 1);
        const maxOrders = Math.max(...data.map((row) => row.orders), 1);
        const xFor = (index) => padding.left + (data.length === 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
        const yRevenue = (value) => padding.top + ((maxRevenue - value) / maxRevenue) * innerHeight;
        const yOrders = (value) => padding.top + ((maxOrders - value) / maxOrders) * innerHeight;
        const revenueLine = data.map((row, index) => `${xFor(index)},${yRevenue(row.revenue)}`).join(' ');
        const orderLine = data.map((row, index) => `${xFor(index)},${yOrders(row.orders)}`).join(' ');
        const ticks = Array.from({ length: 5 }, (_, index) => (maxRevenue / 4) * index).reverse();
        const labelStep = Math.max(1, Math.ceil(data.length / 6));
        const latest = data[data.length - 1];

        return {
            data,
            width,
            height,
            padding,
            xFor,
            yRevenue,
            yOrders,
            revenueLine,
            orderLine,
            ticks,
            labelStep,
            latest,
        };
    }, [rows, chartWidth]);

    if (!chart) {
        return (
            <div className="report-chart-empty">
                <span className="muted">{t('No paid sales in this period.')}</span>
            </div>
        );
    }

    return (
        <div className="report-chart">
            <div className="report-chart-summary">
                <div>
                    <span className="chart-dot income" />
                    <small>{t('Latest revenue')}</small>
                    <strong>{money(chart.latest.revenue)}</strong>
                </div>
                <div>
                    <span className="chart-dot net" />
                    <small>{t('Latest orders')}</small>
                    <strong>{chart.latest.orders}</strong>
                </div>
            </div>
            <svg ref={chartRef} viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={t('Sales by day line chart')}>
                {chart.ticks.map((tick) => (
                    <g key={tick}>
                        <line
                            className="chart-grid-line"
                            x1={chart.padding.left}
                            x2={chart.width - chart.padding.right}
                            y1={chart.yRevenue(tick)}
                            y2={chart.yRevenue(tick)}
                        />
                        <text className="chart-y-label" x={chart.padding.left - 10} y={chart.yRevenue(tick) + 4}>
                            {money(tick)}
                        </text>
                    </g>
                ))}
                <polyline className="chart-line income" points={chart.revenueLine} />
                <polyline className="chart-line net chart-line-secondary" points={chart.orderLine} />
                {chart.data.map((row, index) => (
                    <circle key={`revenue-${row.day}`} className="chart-point income" cx={chart.xFor(index)} cy={chart.yRevenue(row.revenue)} r="3.5">
                        <title>{`${row.day} ${t('revenue')}: ${money(row.revenue)}`}</title>
                    </circle>
                ))}
                {chart.data.map((row, index) => (
                    <circle key={`orders-${row.day}`} className="chart-point net" cx={chart.xFor(index)} cy={chart.yOrders(row.orders)} r="3.5">
                        <title>{`${row.day} ${t('orders')}: ${row.orders}`}</title>
                    </circle>
                ))}
                {chart.data.map((row, index) => (
                    (index % chart.labelStep === 0 || index === chart.data.length - 1) && (
                        <text key={row.day} className="chart-x-label" x={chart.xFor(index)} y={chart.height - 10}>
                            {row.day.slice(5)}
                        </text>
                    )
                ))}
            </svg>
        </div>
    );
}

function InsightCard({ label, value, caption }) {
    const t = usePhraseTranslation();

    return (
        <article className="report-insight">
            <small>{t(label)}</small>
            <strong>{value}</strong>
            <p>{t(caption)}</p>
        </article>
    );
}

function ReportTabs({ view, canViewSales, canViewInventory, appBase }) {
    const t = usePhraseTranslation();
    const tabs = [
        ...(canViewSales ? [{ key: 'sales', label: 'Sales' }, { key: 'product-sales', label: 'Product sales' }, { key: 'pos', label: 'POS' }] : []),
        ...(canViewInventory ? [{ key: 'inventory', label: 'Inventory' }, { key: 'health', label: 'Health' }] : []),
    ];

    return (
        <nav className="report-tabs" aria-label={t('Report sections')}>
            {tabs.map((tab) => (
                <Link
                    key={tab.key}
                    href={routeWithBase(`/admin/reports?view=${tab.key}`, appBase)}
                    className={view === tab.key ? 'active' : ''}
                >
                    {t(tab.label)}
                </Link>
            ))}
        </nav>
    );
}

function ReportFilters({ view, filters, locations, appBase, showDates = false, showStock = false, showSearch = false, extraFilters = {} }) {
    const t = usePhraseTranslation();
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [filterState, setFilterState] = useState({
        location_id: filters?.location_id || '',
        from: filters?.from || '',
        to: filters?.to || '',
        q: filters?.q || '',
        stock_status: filters?.stock_status || '',
    });
    const canExport = ['sales', 'inventory', 'pos'].includes(view);
    const activeFilterCount = [
        filterState.location_id,
        ...(showDates ? [filterState.from, filterState.to] : []),
        ...((showStock || showSearch) ? [filterState.q] : []),
        ...(showStock ? [filterState.stock_status] : []),
    ].filter(Boolean).length;

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

    const requestFilters = {
        view,
        ...extraFilters,
        location_id: filterState.location_id || undefined,
        ...(showDates ? { from: filterState.from || undefined, to: filterState.to || undefined } : {}),
        ...((showStock || showSearch) ? { q: filterState.q.trim() || undefined } : {}),
        ...(showStock ? { stock_status: filterState.stock_status || undefined } : {}),
    };
    const query = new URLSearchParams();
    Object.entries(requestFilters).forEach(([key, value]) => value !== undefined && query.set(key, value));

    const submitFilters = (event) => {
        event.preventDefault();
        setFilterDrawerOpen(false);
        router.get(routeWithBase('/admin/reports', appBase), requestFilters, { preserveState: true, preserveScroll: true, replace: true });
    };

    const resetFilters = () => {
        const empty = { location_id: '', from: '', to: '', q: '', stock_status: '' };
        setFilterState(empty);
        setFilterDrawerOpen(false);
        router.get(routeWithBase('/admin/reports', appBase), { view, ...extraFilters }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const renderFilterFields = (autoFocus = false) => (
        <>
            {(showStock || showSearch) && (
                <label className="form-field reports-filter__search">
                    <span>{t('Search products')}</span>
                    <span className="search-box"><Icon name="search" size={15} /><input autoFocus={autoFocus} type="search" value={filterState.q} onChange={(event) => setFilterState((current) => ({ ...current, q: event.target.value }))} placeholder={t('Product name, code, or barcode')} /></span>
                </label>
            )}
            <label className="form-field reports-filter__location">
                <span>{t('Store / warehouse')}</span>
                <select value={filterState.location_id} onChange={(event) => setFilterState((current) => ({ ...current, location_id: event.target.value }))}>
                    <option value="">{t('All accessible')}</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
            </label>
            {showDates && (
                <>
                    <label className="form-field reports-filter__date"><span>{t('From')}</span><input autoFocus={autoFocus} type="date" value={filterState.from} onChange={(event) => setFilterState((current) => ({ ...current, from: event.target.value }))} /></label>
                    <label className="form-field reports-filter__date"><span>{t('To')}</span><input type="date" value={filterState.to} onChange={(event) => setFilterState((current) => ({ ...current, to: event.target.value }))} /></label>
                </>
            )}
            {showStock && (
                <label className="form-field reports-filter__stock">
                    <span>{t('Stock status')}</span>
                    <select value={filterState.stock_status} onChange={(event) => setFilterState((current) => ({ ...current, stock_status: event.target.value }))}>
                        <option value="">{t('All stock')}</option><option value="low">{t('Low stock')}</option><option value="out">{t('Out of stock')}</option>
                    </select>
                </label>
            )}
        </>
    );

    return (
        <>
            <section className="panel glass reports-filter-panel">
                <PanelHeading
                    eyebrow={t('Report controls')}
                    title={t('Report filters')}
                    action={<button type="button" className="btn secondary reports-filter__mobile-trigger" onClick={() => setFilterDrawerOpen(true)}><Icon name="search" size={14} /> {t('Filter')}{activeFilterCount > 0 && <span className="reports-filter__count">{activeFilterCount}</span>}</button>}
                />
                <form className="reports-filter" onSubmit={submitFilters} aria-label={t('Report filters')}>
                    <div className="reports-filter__scroll"><div className="reports-filter__fields">{renderFilterFields()}</div></div>
                    <div className="inline-actions reports-filter__actions">
                        <button className="btn primary" type="submit"><Icon name="search" size={14} /> {t('Apply')}</button>
                        {canExport && <a className="btn secondary" href={`${routeWithBase('/admin/reports/export', appBase)}?${query.toString()}`}><Icon name="download" size={14} /> CSV</a>}
                        {activeFilterCount > 0 && <button className="btn secondary" type="button" onClick={resetFilters}>{t('Reset')}</button>}
                    </div>
                </form>
            </section>

            {filterDrawerOpen && (
                <div className="modal-backdrop reports-filter__backdrop" onMouseDown={() => setFilterDrawerOpen(false)}>
                    <form className="drawer glass reports-filter__drawer" onSubmit={submitFilters} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="reports-filter-title">
                        <div className="drawer-header"><div><small className="eyebrow">{t('Report controls')}</small><h2 id="reports-filter-title">{t('Report filters')}</h2></div><button type="button" className="icon-btn" onClick={() => setFilterDrawerOpen(false)} aria-label={t('Close')}><Icon name="close" size={16} /></button></div>
                        <div className="reports-filter__drawer-body">{renderFilterFields(true)}{canExport && <a className="btn secondary reports-filter__drawer-export" href={`${routeWithBase('/admin/reports/export', appBase)}?${query.toString()}`}><Icon name="download" size={14} /> CSV</a>}</div>
                        <div className="drawer-actions"><button type="button" className="btn secondary" onClick={resetFilters}>{t('Reset')}</button><button type="submit" className="btn primary"><Icon name="search" size={14} /> {t('Apply')}</button></div>
                    </form>
                </div>
            )}
        </>
    );
}

function ProductSalesReport({ report, filters, locations, appBase }) {
    const t = usePhraseTranslation();
    const [table, setTable] = useState(filters?.breakdown === 'daily' ? 'daily' : 'summary');
    const summary = report.summary || {};
    const exportQuery = (breakdown) => {
        const query = new URLSearchParams({ view: 'product-sales', breakdown });
        ['location_id', 'from', 'to', 'q'].forEach((key) => filters?.[key] && query.set(key, filters[key]));
        return `${routeWithBase('/admin/reports/export', appBase)}?${query.toString()}`;
    };
    const rows = table === 'summary' ? report.summary_rows : report.daily_rows;

    return (
        <div className="reports-view-stack">
            <ReportFilters view="product-sales" filters={filters} locations={locations} appBase={appBase} showDates showSearch extraFilters={{ breakdown: table }} />
            <div className="metrics-grid compact-kpi-strip">
                <MetricCard label="Orders" value={Number(summary.orders || 0).toLocaleString()} hint="Recognized sales" icon="receipt" />
                <MetricCard label="Units sold" value={Number(summary.units || 0).toLocaleString()} hint={`${Number(summary.products || 0).toLocaleString()} unique products`} icon="box" />
                <MetricCard label="Gross sales" value={money(summary.gross_sales)} hint={`Discount ${money(summary.discounts)}`} icon="chart" />
                <MetricCard label="Net sales" value={money(summary.net_sales)} hint="Product sales after discount" icon="wallet" tone="success" />
            </div>
            <section className="panel glass">
                <PanelHeading
                    eyebrow={t('Item performance')}
                    title={t(table === 'summary' ? 'Product sales summary' : 'Daily product sales')}
                    action={(
                        <div className="inline-actions">
                            <button type="button" className={`btn ${table === 'summary' ? 'primary' : 'secondary'}`} onClick={() => setTable('summary')}>{t('Summary')}</button>
                            <button type="button" className={`btn ${table === 'daily' ? 'primary' : 'secondary'}`} onClick={() => setTable('daily')}>{t('Daily breakdown')}</button>
                            <a className="btn secondary" href={exportQuery(table)}><Icon name="download" size={14} /> CSV</a>
                        </div>
                    )}
                />
                <div className="table-wrap report-products-table">
                    <table>
                        <thead><tr>{table === 'daily' && <th>{t('Date')}</th>}<th>{t('Product')}</th><th>{t('Store')}</th><th>{t('Orders')}</th><th>{t('Units sold')}</th><th>{t('FOC')}</th><th>{t('Gross sales')}</th><th>{t('Discount')}</th><th>{t('Net sales')}</th></tr></thead>
                        <tbody>
                            {(rows?.data || []).length === 0 ? <tr><td colSpan={table === 'daily' ? 9 : 8}><span className="muted">{t('No product sales in this period.')}</span></td></tr> : rows.data.map((row, index) => (
                                <tr key={`${table}-${row.sale_date || ''}-${row.location_id}-${row.product_id}-${index}`}>
                                    {table === 'daily' && <td><strong>{row.sale_date}</strong></td>}
                                    <td><strong>{row.product_name}</strong><small>{row.product_code}</small></td>
                                    <td>{row.location_name}</td>
                                    <td>{Number(row.orders || 0).toLocaleString()}</td>
                                    <td><strong>{Number(row.units_sold || 0).toLocaleString()}</strong></td>
                                    <td>{Number(row.foc_units || 0).toLocaleString()}</td>
                                    <td>{money(row.gross_sales)}</td>
                                    <td>{money(row.discount_amount)}</td>
                                    <td><strong>{money(row.net_sales)}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={rows} label={t('items')} queryParams={{ breakdown: table }} />
            </section>
        </div>
    );
}

function InventoryReport({ report, filters, locations, appBase }) {
    const t = usePhraseTranslation();
    const summary = report.summary || {};
    return (
        <>
            <ReportFilters view="inventory" filters={filters} locations={locations} appBase={appBase} showStock />
            <div className="metrics-grid six">
                <MetricCard label="Original valuation" value={money(summary.cost_value)} hint="Inventory asset value" icon="wallet" />
                <MetricCard label="Retail value" value={money(summary.retail_value)} hint="Potential sales value" icon="chart" tone="success" />
                <MetricCard label="Low stock" value={summary.low_stock || 0} hint="At reorder point" icon="bell" />
                <MetricCard label="Out of stock" value={summary.out_of_stock || 0} hint="No available stock" icon="box" />
            </div>

            <div className="reports-layout">
                <section className="panel glass">
                    <PanelHeading eyebrow={t('Warehouse balances')} title={t('Stock risk and valuation')} />
                    <div className="table-wrap report-products-table">
                        <table>
                            <thead><tr><th>{t('Product')}</th><th>{t('Warehouse')}</th><th>{t('On hand')}</th><th>{t('Reserved')}</th><th>{t('Available')}</th><th>{t('Minimum')}</th><th>{t('Cost value')}</th></tr></thead>
                            <tbody>
                                {report.stock_rows.length === 0 ? <tr><td colSpan={7}><span className="muted">{t('No balances match these filters.')}</span></td></tr> : report.stock_rows.map((row) => (
                                    <tr key={row.id}>
                                        <td><strong>{row.product_name}</strong><small>{row.product_code}</small></td>
                                        <td>{row.location_name}</td><td>{formatCompoundQuantity(row.on_hand_qty, row.units)}</td><td>{formatCompoundQuantity(row.reserved_qty, row.units)}</td>
                                        <td><StatusBadge status={Number(row.available_qty) <= 0 ? 'failed' : Number(row.available_qty) <= Number(row.min_quantity) ? 'warning' : 'healthy'} label={formatCompoundQuantity(row.available_qty, row.units)} /></td>
                                        <td>{formatCompoundQuantity(row.min_quantity, row.units)}</td><td><strong>{money(row.cost_value)}</strong></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="report-analysis-grid">
                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Last 30 days')} title={t('Movement activity')} />
                        <div className="report-pair-list">
                            {report.movements.length === 0 ? <p className="muted">{t('No recent movements.')}</p> : report.movements.map((row) => (
                                <article className="report-pair" key={row.type}><strong>{t(row.type.replaceAll('_', ' '))}</strong><small>{t(':count movements', { count: row.movements })}</small></article>
                            ))}
                        </div>
                    </section>
                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Shrinkage')} title={t('Adjustment variance')} />
                        <div className="table-wrap report-products-table"><table><thead><tr><th>{t('Reason')}</th><th>{t('Documents')}</th><th>{t('Loss value')}</th></tr></thead><tbody>
                            {report.adjustments.length === 0 ? <tr><td colSpan={3}><span className="muted">{t('No posted adjustments.')}</span></td></tr> : report.adjustments.map((row) => <tr key={row.reason_code}><td><strong>{t(row.reason_code.replaceAll('_', ' '))}</strong></td><td>{row.documents}</td><td>{Number(row.unvalued_lines) > 0 ? t('Historical cost unavailable') : money(row.loss_value)}</td></tr>)}
                        </tbody></table></div>
                    </section>
                </div>

                <div className="report-analysis-grid">
                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Last 30 days')} title={t('Transfer activity')} />
                        <div className="table-wrap report-products-table"><table><thead><tr><th>{t('Transfer')}</th><th>{t('Route')}</th><th>{t('Amount')}</th><th>{t('Date')}</th></tr></thead><tbody>
                            {report.transfers.length === 0 ? <tr><td colSpan={4}><span className="muted">{t('No recent transfers.')}</span></td></tr> : report.transfers.map((row) => <tr key={row.id}><td><strong>{row.transfer_number}</strong></td><td>{row.source_name} {t('to')} {row.destination_name}</td><td><strong>{money(row.total_amount)}</strong></td><td>{new Date(row.created_at).toLocaleDateString()}</td></tr>)}
                        </tbody></table></div>
                    </section>
                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Last 30 days')} title={t('Product sell-through')} />
                        <div className="table-wrap report-products-table"><table><thead><tr><th>{t('Product')}</th><th>{t('Units sold')}</th><th>{t('On hand')}</th><th>{t('Rate')}</th></tr></thead><tbody>
                            {report.sell_through.length === 0 ? <tr><td colSpan={4}><span className="muted">{t('No paid sales for this warehouse.')}</span></td></tr> : report.sell_through.map((row) => <tr key={row.id}><td><strong>{row.product_name}</strong><small>{row.product_code}</small></td><td>{formatCompoundQuantity(row.units_sold, row.units)}</td><td>{formatCompoundQuantity(row.on_hand_qty, row.units)}</td><td><strong>{percent(row.sell_through_rate)}</strong></td></tr>)}
                        </tbody></table></div>
                    </section>
                </div>
            </div>
        </>
    );
}

function PosReport({ report, filters, locations, appBase }) {
    const t = usePhraseTranslation();
    const summary = report.summary || {};
    return (
        <>
            <ReportFilters view="pos" filters={filters} locations={locations} appBase={appBase} showDates />
            <div className="metrics-grid four">
                <MetricCard label="POS revenue" value={money(summary.revenue)} hint={t(':count completed sales', { count: summary.orders || 0 })} icon="wallet" tone="success" />
                <MetricCard label="Average sale" value={money(summary.average_sale)} hint={report.own_only ? 'Your sales only' : 'All accessible warehouses'} icon="receipt" />
                <MetricCard label="Discounts" value={money(summary.discounts)} hint="POS order discounts" icon="tag" />
            </div>
            <div className="reports-layout">
                <div className="report-analysis-grid">
                    <section className="panel glass"><PanelHeading eyebrow={t('Warehouse performance')} title={t('Sales by warehouse')} /><div className="report-pair-list">{report.by_location.length === 0 ? <p className="muted">{t('No POS sales in this period.')}</p> : report.by_location.map((row) => <article className="report-pair" key={row.id}><strong>{row.name}</strong><small>{t(':count sales', { count: row.orders })}</small><span>{money(row.revenue)}</span></article>)}</div></section>
                    <section className="panel glass"><PanelHeading eyebrow={t('Payment mix')} title={t('Tender breakdown')} /><div className="report-pair-list">{report.tenders.length === 0 ? <p className="muted">{t('No payments in this period.')}</p> : report.tenders.map((row) => <article className="report-pair" key={row.tender_type}><strong>{row.tender_type || t('Other')}</strong><small>{t(':count payments', { count: row.payments })}</small><span>{money(row.amount)}</span></article>)}</div></section>
                </div>
                <div className="report-analysis-grid">
                    <section className="panel glass"><PanelHeading eyebrow={t('Register performance')} title={t('Sales by register')} /><div className="table-wrap report-products-table"><table><thead><tr><th>{t('Register')}</th><th>{t('Orders')}</th><th>{t('Revenue')}</th></tr></thead><tbody>{report.by_register.length === 0 ? <tr><td colSpan={3}><span className="muted">{t('No register sales.')}</span></td></tr> : report.by_register.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><small>{row.code}</small></td><td>{row.orders}</td><td>{money(row.revenue)}</td></tr>)}</tbody></table></div></section>
                    <section className="panel glass"><PanelHeading eyebrow={t('Team performance')} title={t('Sales by cashier')} /><div className="table-wrap report-products-table"><table><thead><tr><th>{t('Cashier')}</th><th>{t('Orders')}</th><th>{t('Revenue')}</th></tr></thead><tbody>{report.by_cashier.length === 0 ? <tr><td colSpan={3}><span className="muted">{t('No cashier sales.')}</span></td></tr> : report.by_cashier.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.orders}</td><td>{money(row.revenue)}</td></tr>)}</tbody></table></div></section>
                </div>
            </div>
        </>
    );
}

function HealthReport({ report }) {
    const t = usePhraseTranslation();

    return (
        <>
            <div className="metrics-grid four">
                <MetricCard label="Healthy checks" value={report.summary.healthy} hint="Latest system snapshots" icon="check" tone="success" />
                <MetricCard label="Warnings" value={report.summary.warnings} hint="Configuration or workflow" icon="bell" />
                <MetricCard label="Failed checks" value={report.summary.failed} hint={t(':count failed jobs', { count: report.summary.failed_jobs })} icon="close" />
                <MetricCard label="Stock alerts" value={report.summary.open_alerts} hint="Open reorder alerts" icon="box" />
            </div>
            <div className="reports-layout">
                <section className="panel glass"><PanelHeading eyebrow={t('Latest snapshots')} title={t('Operations health')} /><div className="operations-health-grid">{report.checks.length === 0 ? <p className="muted">{t('Run the operations health command to create the first snapshot.')}</p> : report.checks.map((check) => <article key={check.check_name} className="operations-health-row"><StatusBadge status={check.status} label={t(check.status)} /><div><strong>{t(check.check_name.replaceAll('_', ' '))}</strong><p>{check.summary}</p><small>{check.checked_at}</small></div></article>)}</div></section>
                <section className="panel glass"><PanelHeading eyebrow={t('Stock queue')} title={t('Open stock alerts')} /><div className="table-wrap report-products-table"><table><thead><tr><th>{t('Product')}</th><th>{t('Warehouse')}</th><th>{t('Available')}</th><th>{t('Minimum')}</th><th>{t('Severity')}</th></tr></thead><tbody>{report.alerts.length === 0 ? <tr><td colSpan={5}><span className="muted">{t('No open stock alerts.')}</span></td></tr> : report.alerts.map((alert) => <tr key={alert.id}><td><strong>{alert.product?.name}</strong><small>{alert.product?.product_code}</small></td><td>{alert.location?.name}</td><td>{formatCompoundQuantity(alert.available_qty, alert.product?.units)}</td><td>{formatCompoundQuantity(alert.min_quantity, alert.product?.units)}</td><td><StatusBadge status={alert.type === 'out_of_stock' ? 'failed' : 'warning'} label={t(alert.type.replaceAll('_', ' '))} /></td></tr>)}</tbody></table></div></section>
            </div>
        </>
    );
}

export default function ReportsIndex({ view = 'sales', filters = {}, locations = [], canViewSales = false, canViewInventory = false, inventoryReport = null, posReport = null, healthReport = null, productSalesReport = null, summary = {}, topProducts = [], salesByDay = [], categoryPerformance = [], purchaseSegments = [], productPairs = [], couponPerformance = [], flashSalePerformance = [] }) {
    const t = usePhraseTranslation();
    const { app_base } = usePage().props;
    const topRevenue = Math.max(...topProducts.map((product) => Number(product.revenue || 0)), 1);
    const topCategoryRevenue = Math.max(1, ...categoryPerformance.map((category) => Number(category.revenue || 0)));
    const topSegmentOrders = Math.max(1, ...purchaseSegments.map((segment) => Number(segment.orders || 0)));

    return (
        <AdminLayout title={t('Reports')} eyebrow={t('Analytics')}>
            <Head title={t('Reports')} />
            <ReportTabs view={view} canViewSales={canViewSales} canViewInventory={canViewInventory} appBase={app_base} />

            {view === 'sales' && (
            <>
            <ReportFilters view="sales" filters={filters} locations={locations} appBase={app_base} showDates />
            {Number(summary.unvalued_adjustment_lines) > 0 && <p role="status" className="muted">{t('Historical stock adjustments are missing cost snapshots. Profit is incomplete until those records are reconciled.')} ({summary.unvalued_adjustment_lines})</p>}
            <div className="metrics-grid four">
                <MetricCard label="Completed sales" value={summary.recognized_orders} hint="Includes credit sales" icon="receipt" />
                <MetricCard label="Revenue" value={money(summary.revenue)} hint="Completed sales, including credit" icon="wallet" tone="success" />
                <MetricCard label="Cost of goods" value={money(summary.cost_of_goods)} hint="Original product cost at sale" icon="box" />
                <MetricCard label="Gross profit" value={money(summary.gross_profit)} hint={`${summary.gross_margin}% margin`} icon="chart" tone="success" />
                <MetricCard label="Operating expenses" value={money(summary.expenses)} hint="Excludes stock purchases" icon="card" tone="danger" />
                <MetricCard label="Inventory purchases" value={money(summary.stock_purchases)} hint="Capitalized as inventory; excluded from profit until sold" icon="receipt" />
                <MetricCard label="Net profit" value={money(summary.net_profit)} hint="After product cost and expenses" icon="wallet" tone={Number(summary.net_profit) < 0 ? 'danger' : 'success'} />
            </div>

            <div className="reports-layout">
                <section className="panel glass">
                    <PanelHeading eyebrow={t('Marketing signals')} title={t('Purchase health')} />
                    <div className="report-insight-grid">
                        <InsightCard
                            label="Average order value"
                            value={money(summary.average_order_value)}
                            caption="Use as the minimum target for bundles and free-shipping thresholds."
                        />
                        <InsightCard
                            label="Units per order"
                            value={summary.units_per_order}
                            caption={t(':count units sold across paid orders.', { count: summary.units_sold })}
                        />
                        <InsightCard
                            label="Repeat customer rate"
                            value={percent(summary.repeat_customer_rate)}
                            caption="Good signal for retention campaigns and loyalty messaging."
                        />
                        <InsightCard
                            label="Discount pressure"
                            value={percent(summary.discount_rate)}
                            caption="Discount share of gross sales before order-level reductions."
                        />
                    </div>
                </section>

                <section className="panel glass">
                    <PanelHeading eyebrow={t('Last 30 days')} title={t('Sales by day')} />
                    <SalesTrendChart rows={salesByDay} />
                </section>

                <div className="report-analysis-grid">
                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Campaign analytics')} title={t('Coupon performance')} />
                        <div className="table-wrap report-products-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{t('Coupon')}</th>
                                        <th>{t('Paid orders')}</th>
                                        <th>{t('Discount')}</th>
                                        <th>{t('Revenue')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {couponPerformance.length === 0 ? (
                                        <tr><td colSpan={4}><span className="muted">{t('No coupon campaigns yet.')}</span></td></tr>
                                    ) : couponPerformance.map((coupon) => (
                                        <tr key={coupon.id}>
                                            <td>
                                                <strong>{coupon.code}</strong>
                                                <small>{t(coupon.type)} / {coupon.value}</small>
                                            </td>
                                            <td>{coupon.paid_orders}</td>
                                            <td><strong>{money(coupon.discount_given)}</strong></td>
                                            <td><strong>{money(coupon.revenue)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Campaign analytics')} title={t('Flash sale performance')} />
                        <div className="table-wrap report-products-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{t('Campaign')}</th>
                                        <th>{t('Selling units')}</th>
                                        <th>{t('Units')}</th>
                                        <th>{t('Est. revenue')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {flashSalePerformance.length === 0 ? (
                                        <tr><td colSpan={4}><span className="muted">{t('No flash sale campaigns yet.')}</span></td></tr>
                                    ) : flashSalePerformance.map((sale) => (
                                        <tr key={sale.id}>
                                            <td>
                                                <strong>{sale.name}</strong>
                                                <small>{sale.starts_at} {t('to')} {sale.ends_at}</small>
                                            </td>
                                            <td>{sale.items}</td>
                                            <td>{sale.units_sold}</td>
                                            <td><strong>{money(sale.estimated_revenue)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <div className="report-analysis-grid">
                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Category demand')} title={t('Category performance')} />
                        <div className="table-wrap report-products-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{t('Category')}</th>
                                        <th>{t('Orders')}</th>
                                        <th>{t('Units')}</th>
                                        <th>{t('Revenue')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categoryPerformance.length === 0 ? (
                                        <tr>
                                            <td colSpan={4}>
                                                <span className="muted">{t('No category sales yet.')}</span>
                                            </td>
                                        </tr>
                                    ) : categoryPerformance.map((category) => {
                                        const revenue = Number(category.revenue || 0);
                                        return (
                                            <tr key={category.id}>
                                                <td>
                                                    <strong>{category.name}</strong>
                                                    <small>{t(':count sold products', { count: category.products })}</small>
                                                    <div className="report-bar">
                                                        <span style={{ width: `${Math.max(4, (revenue / topCategoryRevenue) * 100)}%` }} />
                                                    </div>
                                                </td>
                                                <td>{category.orders}</td>
                                                <td>{category.units}</td>
                                                <td><strong>{money(revenue)}</strong></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Purchase behavior')} title={t('Basket analysis')} />
                        <div className="report-stack">
                            <div className="report-segments">
                                {purchaseSegments.length === 0 ? (
                                    <p className="muted">{t('No basket data yet.')}</p>
                                ) : purchaseSegments.map((segment) => {
                                    const orders = Number(segment.orders || 0);
                                    return (
                                        <article key={segment.segment} className="report-segment">
                                            <div>
                                                <strong>{segment.segment}</strong>
                                                <small>{t(':orders orders / :units units', { orders, units: segment.units })}</small>
                                            </div>
                                            <span>{money(segment.revenue)}</span>
                                            <div className="report-bar">
                                                <span style={{ width: `${Math.max(4, (orders / topSegmentOrders) * 100)}%` }} />
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>

                            <div>
                                <p className="eyebrow">{t('Frequently bought together')}</p>
                                <div className="report-pair-list">
                                    {productPairs.length === 0 ? (
                                        <p className="muted">{t('No product pair data yet.')}</p>
                                    ) : productPairs.map((pair) => (
                                        <article key={pair.pair} className="report-pair">
                                            <strong>{pair.pair}</strong>
                                            <small>{t(':orders shared orders / :units combined units', { orders: pair.orders, units: pair.units })}</small>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <section className="panel glass">
                    <PanelHeading eyebrow={t('Catalog')} title={t('Top products')} />
                    <div className="table-wrap report-products-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('Rank')}</th>
                                    <th>{t('Product')}</th>
                                    <th>{t('Units')}</th>
                                    <th>{t('Revenue')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={4}>
                                            <span className="muted">{t('No paid product sales yet.')}</span>
                                        </td>
                                    </tr>
                                ) : topProducts.map((product, index) => {
                                    const revenue = Number(product.revenue || 0);
                                    return (
                                        <tr key={product.id}>
                                            <td>
                                                <span className="rank-badge">{index + 1}</span>
                                            </td>
                                            <td>
                                                <strong>{product.name}</strong>
                                                <div className="report-bar">
                                                    <span style={{ width: `${Math.max(4, (revenue / topRevenue) * 100)}%` }} />
                                                </div>
                                            </td>
                                            <td>{product.units}</td>
                                            <td><strong>{money(revenue)}</strong></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
            </>
            )}

            {view === 'inventory' && inventoryReport && <InventoryReport report={inventoryReport} filters={filters} locations={locations} appBase={app_base} />}
            {view === 'product-sales' && productSalesReport && <ProductSalesReport report={productSalesReport} filters={filters} locations={locations} appBase={app_base} />}
            {view === 'pos' && posReport && <PosReport report={posReport} filters={filters} locations={locations} appBase={app_base} />}
            {view === 'health' && healthReport && <HealthReport report={healthReport} />}
        </AdminLayout>
    );
}
