import { useState } from 'react';
import { Head, useForm, usePage, router } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading } from '@/Components/Admin/shared';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { routeWithBase } from '@/Utils/url';
import { formatMoney } from '@/Utils/pricing';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function FinanceBook({ books, funds, locations = [], filters = {} }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const [selected, setSelected] = useState(null);
    const [mode, setMode] = useState('fund');
    const filterForm = useForm({ location_id: filters.location_id || '', date: filters.date || '' });
    const form = useForm({ location_id: '', entry_date: '', amount: '', notes: '' });
    const open = (book, nextMode = 'fund') => { setMode(nextMode); form.clearErrors(); form.setData({ location_id: book.id, entry_date: filters.date, amount: nextMode === 'count' ? (book.actual_balance ?? '') : '', notes: nextMode === 'count' ? (book.count_notes || '') : '' }); setSelected(book); };
    const submit = (event) => { event.preventDefault(); form.transform((data) => mode === 'count' ? { location_id: data.location_id, entry_date: data.entry_date, actual_balance: data.amount, notes: data.notes } : data); form.post(routeWithBase(mode === 'count' ? '/admin/finance-book/counts' : '/admin/finance-book', app_base), { preserveScroll: true, onSuccess: () => { setSelected(null); form.reset(); } }); };

    return <AdminLayout title={t('Finance book')} eyebrow={t('Branch expense funds')} contentClassName="finance-book-page">
        <Head title={t('Finance book')} />
        <AdminFlash flash={flash} errors={form.errors} />
        <section className="panel glass"><PanelHeading eyebrow={t('Daily cash ledger')} title={t('Book filters')} /><p className="muted finance-book-description">{t('Funds and approved expenses are matched by date. Balances do not carry forward automatically.')}</p><form className="finance-book-filters" onSubmit={(event) => { event.preventDefault(); router.get(routeWithBase('/admin/finance-book', app_base), filterForm.data); }}>
            <label className="form-field"><span>{t('Branch')}</span><select value={filterForm.data.location_id} onChange={(event) => filterForm.setData('location_id', event.target.value)}><option value="">{t('All allowed branches')}</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
            <label className="form-field"><span>{t('Date')}</span><input type="date" required value={filterForm.data.date} onChange={(event) => filterForm.setData('date', event.target.value)} /></label>
            <div className="finance-book-filter-actions"><button className="btn primary" type="submit"><Icon name="filterList" size={15} />{t('Apply filters')}</button><button className="btn secondary" type="button" onClick={() => router.get(routeWithBase('/admin/finance-book', app_base))}>{t('Reset')}</button></div>
        </form></section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 14 }}>
            {(books?.data || []).map((book) => <section key={book.id} className="panel glass">
                <div className="panel-heading"><div><small className="muted">{book.code}</small><h2>{book.name}</h2></div><button className="btn primary" type="button" onClick={() => open(book)}>{t('Add expense fund')}</button></div>
                {[['Funds added', book.capital], ['Approved expenses', book.expenses], ['Available balance', book.balance]].map(([label, amount]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}><span className="muted">{t(label)}</span><strong style={{ color: amount < 0 ? 'var(--color-danger)' : undefined }}>{formatMoney(amount)}</strong></div>)}
                {[['Actual cash balance', book.actual_balance], ['Difference', book.actual_balance === null ? null : Number(book.actual_balance) - Number(book.balance)]].map(([label, amount]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0' }}><span className="muted">{t(label)}</span><strong style={{ color: label === 'Difference' && amount !== null && amount !== 0 ? 'var(--color-danger)' : undefined }}>{amount === null ? t('Not recorded') : formatMoney(amount)}</strong></div>)}
                <button type="button" className="btn secondary" onClick={() => open(book, 'count')}>{t('Record actual cash')}</button>
            </section>)}
        </div>
        <AdminPagination paginator={books} label={t('branches')} />
        {!books?.data?.length && <section className="panel glass"><p className="muted">{t('No accessible branches.')}</p></section>}
        <section className="panel glass"><PanelHeading eyebrow={t('Audit ledger')} title={t('Funding history')} /><div className="table-wrap"><table><thead><tr><th>{t('Date')}</th><th>{t('Branch')}</th><th className="finance-book-money">{t('Amount')}</th><th>{t('Notes')}</th></tr></thead><tbody>{(funds?.data || []).map((fund) => <tr key={fund.id}><td>{fund.entry_date}</td><td>{fund.branch_name}</td><td className="finance-book-money">{formatMoney(fund.amount)}</td><td>{fund.notes || '—'}</td></tr>)}{!funds?.data?.length && <tr><td colSpan={4} className="muted">{t('No expense funds added yet.')}</td></tr>}</tbody></table></div>
            <AdminPagination paginator={funds} label={t('funding records')} />
        </section>
        {selected && (
            <div className="modal-backdrop" onClick={() => !form.processing && setSelected(null)}>
                <form className="operation-modal compact glass admin-form-modal admin-form-modal-small" role="dialog" aria-modal="true" aria-labelledby="fund-title" onSubmit={submit} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Escape' && !form.processing) setSelected(null); }}>
                    <div className="drawer-header admin-form-modal-header">
                        <div className="admin-form-modal-title">
                            <span className="admin-form-title-icon"><Icon name="wallet" size={16} /></span>
                            <div><h2 id="fund-title">{t(mode === 'count' ? 'Record actual cash' : 'Add expense fund')}</h2><small>{selected.name} · {selected.code} · {form.data.entry_date}</small></div>
                        </div>
                        <button type="button" className="icon-btn small" disabled={form.processing} onClick={() => setSelected(null)} aria-label={t('Close')}><Icon name="close" size={14} /></button>
                    </div>
                    <div className="crud-grid admin-form-grid admin-form-grid-single">
                        <label className="form-field"><span>{t('Date')}</span><input type="date" required value={form.data.entry_date} onChange={(event) => form.setData('entry_date', event.target.value)} />{form.errors.entry_date && <small className="field-error">{form.errors.entry_date}</small>}</label>
                        <label className="form-field"><span>{t('Amount (MMK)')}</span><input autoFocus required type="number" min={mode === 'count' ? '0' : '0.01'} step="0.01" value={form.data.amount} onChange={(event) => form.setData('amount', event.target.value)} aria-invalid={Boolean((form.errors.amount || form.errors.actual_balance))} aria-describedby={(form.errors.amount || form.errors.actual_balance) ? 'fund-amount-error' : undefined} />{(form.errors.amount || form.errors.actual_balance) && <small id="fund-amount-error" className="field-error">{(form.errors.amount || form.errors.actual_balance)}</small>}</label>
                        <label className="form-field"><span>{t('Notes (optional)')}</span><textarea rows={3} maxLength={1000} value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} />{form.errors.notes && <small className="field-error">{form.errors.notes}</small>}</label>
                        {form.errors.location_id && <small className="field-error">{form.errors.location_id}</small>}
                    </div>
                    <div className="modal-actions"><button type="button" className="btn secondary" disabled={form.processing} onClick={() => setSelected(null)}>{t('Cancel')}</button><button type="submit" className="btn primary" disabled={form.processing}>{t(form.processing ? 'Saving...' : mode === 'count' ? 'Save actual cash' : 'Add fund')}</button></div>
                </form>
            </div>
        )}
    </AdminLayout>;
}
