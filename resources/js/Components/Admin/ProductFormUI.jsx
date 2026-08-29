import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import { storageUrl } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatErrorMessage } from '@/Utils/formatErrorMessage';

export default function ProductFormUI({
    data,
    setData,
    errors,
    processing,
    categories,
    previews,
    product = { images: [] },
    appUrl,
    onGenerateBarcode,
    onImageChange,
    onRemoveNewPreview,
    onRemoveExistingImage,
    onSetCover,
    onClearAllImages,
}) {
    const t = usePhraseTranslation();
    const existingImages = (product.images || []).filter((image) => data.imageAttachmentIds.includes(image.id));
    const fieldError = (path) => errors[path] ? formatErrorMessage(errors[path]) : null;

    const patchUnit = (index, patch) => {
        const units = data.units.map((unit, unitIndex) => (unitIndex === index ? { ...unit, ...patch } : unit));
        setData('units', units);
    };

    const chooseSingleFlag = (index, key) => {
        setData('units', data.units.map((unit, unitIndex) => ({
            ...unit,
            [key]: unitIndex === index,
            ...(key === 'is_base' && unitIndex === index ? { conversion_factor: 1 } : {}),
        })));
    };

    const addUnitWithPrices = () => {
        const nextUnits = [...data.units, {
            name: '', code: '', conversion_factor: 1, is_base: false,
            is_default_selling: false, is_active: true,
        }];
        setData({
            ...data,
            units: nextUnits,
            price_types: data.price_types.map((type) => ({ ...type, prices: [...type.prices, 0] })),
        });
    };

    const removeUnit = (index) => {
        if (data.units.length === 1) return;
        const removed = data.units[index];
        let units = data.units.filter((_, unitIndex) => unitIndex !== index);
        if (removed.is_base) units = units.map((unit, unitIndex) => ({ ...unit, is_base: unitIndex === 0, conversion_factor: unitIndex === 0 ? 1 : unit.conversion_factor }));
        if (removed.is_default_selling) units = units.map((unit, unitIndex) => ({ ...unit, is_default_selling: unitIndex === 0 }));
        setData({
            ...data,
            units,
            price_types: data.price_types.map((type) => ({
                ...type,
                prices: type.prices.filter((_, unitIndex) => unitIndex !== index),
            })),
        });
    };

    const patchPriceType = (typeIndex, patch) => {
        setData('price_types', data.price_types.map((type, index) => (index === typeIndex ? { ...type, ...patch } : type)));
    };

    const patchUnitPrice = (typeIndex, unitIndex, price) => {
        const prices = data.price_types[typeIndex].prices.map((amount, index) => (index === unitIndex ? price : amount));
        patchPriceType(typeIndex, { prices });
    };

    const addPriceType = () => setData('price_types', [...data.price_types, { name: '', prices: data.units.map(() => 0) }]);

    const removePriceType = (typeIndex) => setData('price_types', data.price_types.filter((_, index) => index !== typeIndex));

    return (
        <div className="product-form-layout">
            <div className="product-form-main">
                <section className="panel product-section product-identity-panel">
                    <PanelHeading eyebrow={t('Product')} title={t('Identity and stock rules')} />
                    <div className="crud-grid">
                        <label className="form-field">
                            <span>{t('Product name')}</span>
                            <input value={data.name} onChange={(event) => setData('name', event.target.value)} required />
                            {errors.name && <small className="field-error">{formatErrorMessage(errors.name)}</small>}
                        </label>
                        <label className="form-field">
                            <span>{t('Barcode')}</span>
                            <div className="field-with-action">
                                <input value={data.barcode} onChange={(event) => setData('barcode', event.target.value)} placeholder={t('Generated automatically when empty')} />
                                <button type="button" className="icon-btn" onClick={onGenerateBarcode} aria-label={t('Generate barcode')} title={t('Generate barcode')} disabled={processing}>
                                    <Icon name="barcode" size={16} />
                                </button>
                            </div>
                            {errors.barcode && <small className="field-error">{formatErrorMessage(errors.barcode)}</small>}
                        </label>
                        <label className="form-field">
                            <span>{t('Original price / base-unit cost')}</span>
                            <input type="number" min="0" step="0.01" value={data.original_price} onChange={(event) => setData('original_price', event.target.value)} required />
                            <small>{t('Used for inventory valuation and profit calculations.')}</small>
                        </label>
                        <label className="form-field">
                            <span>{t('Minimum quantity')}</span>
                            <input type="number" min="0" step="0.0001" value={data.min_quantity} onChange={(event) => setData('min_quantity', event.target.value)} required />
                            <small>{t('Low-stock threshold, always stored in the base unit.')}</small>
                        </label>
                        <label className="form-field full-span product-description-field">
                            <span>{t('Description')}</span>
                            <textarea rows={5} value={data.description} onChange={(event) => setData('description', event.target.value)} />
                        </label>
                    </div>
                </section>

                <section className="panel product-section product-units-panel">
                    <PanelHeading
                        eyebrow={t('Conversions')}
                        title={t('Units and selling prices')}
                        action={<button type="button" className="btn secondary" onClick={addUnitWithPrices}><Icon name="plus" size={14} />{t('Add unit')}</button>}
                    />
                    <div className="product-unit-help">
                        <strong>{t('How units work')}</strong>
                        <span>{t('Inventory is stored in the base unit. A conversion factor is the number of base units contained in one selected unit. Retail is the default selling price.')}</span>
                    </div>
                    <div className="product-unit-matrix">
                        <div className="product-unit-matrix__scroll">
                            <div className="product-unit-matrix__grid product-unit-matrix__header" aria-hidden="true">
                                <span>#</span><span>{t('Unit name')}</span><span>{t('Short code')}</span><span>{t('Conversion factor')}</span><span>{t('Base unit')}</span><span>{t('Default selling')}</span><span>{t('Active')}</span><span />
                            </div>
                            {data.units.map((unit, unitIndex) => (
                                <div className="product-unit-matrix__grid product-unit-matrix__row" key={unit.id || `new-unit-${unitIndex}`}>
                                    <span className="unit-editor__index">{String(unitIndex + 1).padStart(2, '0')}</span>
                                    <label className="form-field product-unit-table-field"><span>{t('Unit name')}</span><input value={unit.name} placeholder={t('Piece, Box, Carton')} onChange={(event) => patchUnit(unitIndex, { name: event.target.value })} aria-invalid={!!fieldError(`units.${unitIndex}.name`)} required />{fieldError(`units.${unitIndex}.name`) && <small className="field-error">{fieldError(`units.${unitIndex}.name`)}</small>}</label>
                                    <label className="form-field product-unit-table-field"><span>{t('Short code')}</span><input value={unit.code} placeholder={t('pc, box, ctn')} onChange={(event) => patchUnit(unitIndex, { code: event.target.value })} aria-invalid={!!fieldError(`units.${unitIndex}.code`)} required />{fieldError(`units.${unitIndex}.code`) && <small className="field-error">{fieldError(`units.${unitIndex}.code`)}</small>}</label>
                                    <label className="form-field product-unit-table-field"><span>{t('Conversion factor')}</span><input type="number" min="0.000001" step="0.000001" value={unit.conversion_factor} disabled={unit.is_base} onChange={(event) => patchUnit(unitIndex, { conversion_factor: event.target.value })} aria-invalid={!!fieldError(`units.${unitIndex}.conversion_factor`)} required />{fieldError(`units.${unitIndex}.conversion_factor`) && <small className="field-error">{fieldError(`units.${unitIndex}.conversion_factor`)}</small>}</label>
                                    <label className={`product-unit-table-toggle${unit.is_base ? ' selected' : ''}`} title={t('Set as base unit')}><input type="radio" name="base-unit" checked={!!unit.is_base} onChange={() => chooseSingleFlag(unitIndex, 'is_base')} /><span>{t('Base')}</span></label>
                                    <label className={`product-unit-table-toggle${unit.is_default_selling ? ' selected' : ''}`} title={t('Set as default selling unit')}><input type="radio" name="selling-unit" checked={!!unit.is_default_selling} onChange={() => chooseSingleFlag(unitIndex, 'is_default_selling')} /><span>{t('Default')}</span></label>
                                    <label className={`product-unit-table-toggle${unit.is_active ? ' selected' : ''}`}><input type="checkbox" checked={!!unit.is_active} onChange={(event) => patchUnit(unitIndex, { is_active: event.target.checked })} /><span>{t('Active')}</span></label>
                                    <button type="button" className="icon-btn danger" onClick={() => removeUnit(unitIndex)} disabled={data.units.length === 1} aria-label={t('Remove unit')} title={t('Remove unit')}><Icon name="trash" size={14} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                    {errors.units && <div className="flash error">{formatErrorMessage(errors.units)}</div>}
                    <div className="product-price-matrix">
                        <div className="unit-prices__heading">
                            <div><strong>{t('Selling price types')}</strong><small>{t('Define each type once, then enter its amount for every unit.')}</small></div>
                            <button type="button" className="btn secondary" onClick={addPriceType}><Icon name="plus" size={13} />{t('Add price type')}</button>
                        </div>
                        <div className="product-price-matrix__scroll">
                            <div className="product-price-matrix__grid product-price-matrix__header" style={{ '--price-unit-count': data.units.length }}>
                                <span>{t('Price type')}</span>
                                {data.units.map((unit, index) => <span key={unit.id || index}>{unit.name || `${t('Unit')} ${index + 1}`}<small>{unit.code || '—'}</small></span>)}
                                <span />
                            </div>
                            {data.price_types.map((type, typeIndex) => (
                                <div className="product-price-matrix__grid product-price-matrix__row" style={{ '--price-unit-count': data.units.length }} key={type.id || `price-type-${typeIndex}`}>
                                    <label className="form-field"><span>{t('Price name')}</span><input value={type.name} disabled={type.name === 'retail'} placeholder={t('wholesale, vip')} onChange={(event) => patchPriceType(typeIndex, { name: event.target.value })} aria-invalid={!!fieldError(`price_types.${typeIndex}.name`)} required /></label>
                                    {data.units.map((unit, unitIndex) => (
                                        <label className="form-field" key={unit.id || unitIndex}>
                                            <span>{unit.name || `${t('Unit')} ${unitIndex + 1}`}</span>
                                            <input type="number" min="0" step="0.01" value={type.prices[unitIndex] ?? 0} onChange={(event) => patchUnitPrice(typeIndex, unitIndex, event.target.value)} aria-invalid={!!fieldError(`price_types.${typeIndex}.prices.${unitIndex}`)} required />
                                        </label>
                                    ))}
                                    <button type="button" className="icon-btn danger" onClick={() => removePriceType(typeIndex)} disabled={type.name === 'retail'} aria-label={t('Remove price type')} title={t('Remove price type')}><Icon name="trash" size={14} /></button>
                                </div>
                            ))}
                        </div>
                        {errors.price_types && <div className="flash error">{formatErrorMessage(errors.price_types)}</div>}
                    </div>
                </section>

            </div>

            <aside className="product-form-side">
                <section className="panel product-section product-summary-panel">
                    <PanelHeading eyebrow={t('Status')} title={t('Visibility')} />
                    <label className="form-field"><span>{t('Product status')}</span><select value={data.status} onChange={(event) => setData('status', event.target.value)}><option value="active">{t('Active')}</option><option value="inactive">{t('Inactive')}</option><option value="draft">{t('Draft')}</option></select></label>
                    <div className="summary-toggle-list">
                        <label className="summary-toggle"><input type="checkbox" checked={!!data.is_featured} onChange={(event) => setData('is_featured', event.target.checked)} /><span><strong>{t('Featured product')}</strong><small>{t('Highlight this product in storefront collections.')}</small></span></label>
                        {'is_active' in data && <label className="summary-toggle"><input type="checkbox" checked={!!data.is_active} onChange={(event) => setData('is_active', event.target.checked)} /><span><strong>{t('Active catalog record')}</strong><small>{t('Allow this product to be used in store operations.')}</small></span></label>}
                    </div>
                </section>
                <section className="panel product-section product-summary-panel">
                    <PanelHeading eyebrow={t('Catalog')} title={t('Category')} />
                    <label className="form-field"><span>{t('Category')}</span><select value={data.category_id} onChange={(event) => setData('category_id', event.target.value)} required><option value="">{t('Select category')}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{errors.category_id && <small className="field-error">{formatErrorMessage(errors.category_id)}</small>}</label>
                </section>
                <section className="panel product-section product-media-panel">
                    <PanelHeading eyebrow={t('Media')} title={t('Product images')} />
                    <div className="product-media-toolbar">
                        <label className="btn secondary" style={{ cursor: 'pointer' }}><Icon name="image" size={14} />{t(existingImages.length || previews.length ? 'Add more images' : 'Upload images')}<input type="file" hidden multiple accept="image/*" onChange={onImageChange} disabled={processing} /></label>
                        {!existingImages.length && previews.length > 0 && onClearAllImages && <button type="button" className="btn danger" onClick={onClearAllImages}>{t('Remove all')}</button>}
                    </div>
                    {!existingImages.length && !previews.length && <div className="product-media-empty"><Icon name="image" size={24} /><strong>{t('No images yet')}</strong><span>{t('Upload product photos, then choose one as the cover image.')}</span></div>}
                    <div className="image-grid">
                        {existingImages.map((image) => (
                            <div key={image.id} className="image-card">
                                <img src={storageUrl(image.image_path, appUrl)} alt="" />
                                <div className="actions">
                                    {data.mainImageAttachmentId === image.id && <span className="chip">{t('Cover')}</span>}
                                    {data.mainImageAttachmentId !== image.id && <button type="button" className="btn secondary full" onClick={() => onSetCover(image.id)}>{t('Set cover')}</button>}
                                    <button type="button" className="btn secondary full" onClick={() => onRemoveExistingImage(image.id)}>{t('Remove')}</button>
                                </div>
                            </div>
                        ))}
                        {previews.map((url, index) => (
                            <div key={`preview-${index}`} className="image-card"><img src={url} alt="" /><div className="actions"><button type="button" className="btn secondary full" onClick={() => onRemoveNewPreview(index)}>{t('Remove')}</button></div></div>
                        ))}
                    </div>
                </section>
                {product.product_code && <section className="panel product-section product-code-panel"><PanelHeading eyebrow={t('System')} title={t('Product code')} /><code>{product.product_code}</code><small className="muted-copy">{t('Generated automatically and cannot be edited.')}</small></section>}
            </aside>
        </div>
    );
}
