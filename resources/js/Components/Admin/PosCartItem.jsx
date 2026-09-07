import { useState } from 'react';
import Icon from '@/Components/Admin/icons';
import '@/styles/pos-cart.css';

export default function PosCartItem({ line, money, t, exceedsStock, canFoc, onQuantity, onStep, onUnit, onFocQuantity, onFocUnit, onRemove }) {
    const [showFoc, setShowFoc] = useState(false);
    const free = Number(line.foc_quantity || 0);
    const units = line.unit_options || [];
    const freeUnit = units.find(unit => Number(unit.id) === Number(line.foc_product_unit_id));
    const quantityId = `cart-qty-${line.id}`;
    return <article className={`pos-item ${exceedsStock ? 'pos-item--error' : ''}`} aria-label={line.product_name || line.name}>
        <header className="pos-item__header">
            <div className="pos-item__identity"><strong>{line.product_name || line.name}</strong><small>{line.product_code || '—'}</small></div>
            <div className="pos-item__total"><small>{t('Total')}</small><strong>{money(Number(line.unit_price || 0) * Number(line.quantity || 0))}</strong></div>
            <button type="button" className="pos-item__remove" aria-label={`${t('Remove item')} ${line.name}`} title={t('Remove item')} onClick={onRemove}><Icon name="trash" size={16} /></button>
        </header>
        <div className="pos-item__controls">
            <div className="pos-item__field"><label htmlFor={quantityId}>{t('Quantity')}</label><div className="pos-item__stepper">
                <button type="button" aria-label={`${t('Decrease quantity for')} ${line.name}`} disabled={Number(line.quantity) <= 1} onClick={() => onStep(-1)}>−</button>
                <input id={quantityId} type="number" min="1" step="0.0001" inputMode="decimal" max={line.available_qty} value={line.quantity} onFocus={e => e.target.select()} onChange={e => onQuantity(e.target.value)} aria-invalid={exceedsStock || undefined} />
                <button type="button" aria-label={`${t('Increase quantity for')} ${line.name}`} disabled={Number(line.quantity) >= Number(line.available_qty)} onClick={() => onStep(1)}>+</button>
            </div></div>
            <label className="pos-item__field"><span>{t('Unit')}</span><select value={line.product_unit_id} onChange={e => onUnit(e.target.value)}>{units.map(unit => <option key={unit.id} value={unit.id} disabled={Number(unit.available_qty) <= 0}>{unit.name} ({unit.code})</option>)}</select></label>
            <div className="pos-item__price"><small>{t('Unit price')}</small><span>{line.unit_price > 0 ? money(line.unit_price) : t('Price unavailable')}</span></div>
        </div>
        <footer className="pos-item__footer"><small>{t('Available')}: {line.available_qty} {line.unit_code || line.unit_name}</small>{canFoc && <div className="pos-item__free-actions">
            <button type="button" aria-expanded={showFoc} aria-controls={`cart-foc-${line.id}`} onClick={() => setShowFoc(!showFoc)}>{free > 0 ? `${t('Free')}: ${free} ${freeUnit?.name || line.unit_name} · ${t('Edit')}` : `+ ${t('FOC')}`} <span aria-hidden="true">{showFoc ? '−' : '+'}</span></button>
            {free > 0 && <button type="button" onClick={() => onFocQuantity(0, true)}>{t('Clear')}</button>}
        </div>}</footer>
        {canFoc && showFoc && <div id={`cart-foc-${line.id}`} className="pos-item__free-fields">
            <label className="pos-item__field"><span>{t('Free quantity')}</span><input type="number" min="0" step="0.0001" inputMode="decimal" value={line.foc_quantity ?? 0} onFocus={e => e.target.select()} onChange={e => onFocQuantity(e.target.value)} onBlur={() => onFocQuantity(line.foc_quantity, true)} /></label>
            <label className="pos-item__field"><span>{t('Free unit')}</span><select value={line.foc_product_unit_id || line.product_unit_id} onChange={e => onFocUnit(e.target.value)}>{units.map(unit => <option key={unit.id} value={unit.id} disabled={Number(unit.available_qty) <= 0}>{unit.name} ({unit.code})</option>)}</select></label>
        </div>}
        {exceedsStock && <small className="pos-item__error" role="alert">{t('Quantity including free items exceeds available stock.')}</small>}
    </article>;
}
