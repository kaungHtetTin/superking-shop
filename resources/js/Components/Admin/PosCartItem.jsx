import { useEffect, useState } from 'react';
import Icon from '@/Components/Admin/icons';
import '@/styles/pos-cart.css';
import { formatSelectedUnitQuantity } from '@/Utils/unitLabel';

export default function PosCartItem({ line, money, t, exceedsStock, canFoc, onQuantity, onUnit, onFocQuantity, onFocUnit, onRemove }) {
    const [showFoc, setShowFoc] = useState(false);
    const [quantityDraft, setQuantityDraft] = useState(String(line.quantity ?? 1));
    const free = Number(line.foc_quantity || 0);
    const units = line.unit_options || [];
    const freeUnit = units.find(unit => Number(unit.id) === Number(line.foc_product_unit_id));
    const selectedUnit = units.find(unit => Number(unit.id) === Number(line.product_unit_id)) || line;
    const quantityId = `cart-qty-${line.id}`;

    useEffect(() => {
        setQuantityDraft(String(line.quantity ?? 1));
    }, [line.quantity]);

    const normalizeQuantity = value => {
        const parsed = Number(value);
        const current = Number(line.quantity || 1);
        const available = Math.max(1, Number(line.available_qty || 1));
        const quantity = Number.isFinite(parsed) ? parsed : current;

        return Math.max(1, Math.min(quantity, available));
    };

    const commitQuantity = () => {
        const quantity = normalizeQuantity(quantityDraft);
        setQuantityDraft(String(quantity));
        onQuantity(quantity);
    };

    const changeQuantityDraft = value => {
        const normalized = value.replace(',', '.');

        if (normalized === '' || /^\d*\.?\d{0,4}$/.test(normalized)) {
            setQuantityDraft(normalized);
        }
    };

    const stepQuantity = delta => {
        const quantity = normalizeQuantity(Number(quantityDraft || line.quantity || 1) + delta);
        setQuantityDraft(String(quantity));
        onQuantity(quantity);
    };

    const displayedQuantity = Number(quantityDraft || line.quantity || 1);

    return <article className={`pos-item ${exceedsStock ? 'pos-item--error' : ''}`} aria-label={line.product_name || line.name}>
        <header className="pos-item__header">
            <div className="pos-item__identity"><strong>{line.product_name || line.name}</strong><small>{line.product_code || '—'}</small></div>
            <div className="pos-item__total"><small>{t('Total')}</small><strong>{money(Number(line.unit_price || 0) * Number(line.quantity || 0))}</strong></div>
            <button type="button" className="pos-item__remove" aria-label={`${t('Remove item')} ${line.name}`} title={t('Remove item')} onClick={onRemove}><Icon name="trash" size={16} /></button>
        </header>
        <div className="pos-item__controls">
            <div className="pos-item__field"><label htmlFor={quantityId}>{t('Quantity')}</label><div className="pos-item__stepper">
                <button type="button" aria-label={`${t('Decrease quantity for')} ${line.name}`} disabled={displayedQuantity <= 1} onClick={() => stepQuantity(-1)}>−</button>
                <input
                    id={quantityId}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={quantityDraft}
                    onFocus={event => event.target.select()}
                    onChange={event => changeQuantityDraft(event.target.value)}
                    onBlur={commitQuantity}
                    onKeyDown={event => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            event.currentTarget.blur();
                        }

                        if (event.key === 'Escape') {
                            event.preventDefault();
                            setQuantityDraft(String(line.quantity ?? 1));
                        }
                    }}
                    aria-invalid={exceedsStock || undefined}
                />
                <button type="button" aria-label={`${t('Increase quantity for')} ${line.name}`} disabled={displayedQuantity >= Number(line.available_qty)} onClick={() => stepQuantity(1)}>+</button>
            </div></div>
            <label className="pos-item__field"><span>{t('Unit')}</span><select value={line.product_unit_id} onChange={event => onUnit(event.target.value)}>{units.map(unit => <option key={unit.id} value={unit.id} disabled={Number(unit.available_qty) <= 0}>{unit.name} ({unit.code})</option>)}</select></label>
            <div className="pos-item__price"><small>{t('Unit price')}</small><span>{line.unit_price > 0 ? money(line.unit_price) : t('Price unavailable')}</span></div>
        </div>
        <footer className="pos-item__footer"><small>{t('Available')}: {formatSelectedUnitQuantity(line.available_qty, selectedUnit, units)}</small>{canFoc && <div className="pos-item__free-actions">
            <button type="button" aria-expanded={showFoc} aria-controls={`cart-foc-${line.id}`} onClick={() => setShowFoc(!showFoc)}>{free > 0 ? `${t('Free')}: ${free} ${freeUnit?.name || line.unit_name} · ${t('Edit')}` : `+ ${t('FOC')}`} <span aria-hidden="true">{showFoc ? '−' : '+'}</span></button>
            {free > 0 && <button type="button" onClick={() => onFocQuantity(0, true)}>{t('Clear')}</button>}
        </div>}</footer>
        {canFoc && showFoc && <div id={`cart-foc-${line.id}`} className="pos-item__free-fields">
            <label className="pos-item__field"><span>{t('Free quantity')}</span><input type="number" min="0" step="0.0001" inputMode="decimal" value={line.foc_quantity ?? 0} onFocus={event => event.target.select()} onChange={event => onFocQuantity(event.target.value)} onBlur={() => onFocQuantity(line.foc_quantity, true)} /></label>
            <label className="pos-item__field"><span>{t('Free unit')}</span><select value={line.foc_product_unit_id || line.product_unit_id} onChange={event => onFocUnit(event.target.value)}>{units.map(unit => <option key={unit.id} value={unit.id} disabled={Number(unit.available_qty) <= 0}>{unit.name} ({unit.code})</option>)}</select></label>
        </div>}
        {exceedsStock && <small className="pos-item__error" role="alert">{t('Quantity including free items exceeds available stock.')}</small>}
    </article>;
}
