import { useState } from 'react';
import axios from 'axios';
import { Head, Link, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import ProductFormUI from '@/Components/Admin/ProductFormUI';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatErrorMessage } from '@/Utils/formatErrorMessage';

const compactDecimal = (value) => String(value ?? '').replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');

export default function Edit({ product, categories, app_base, returnPage = 1 }) {
    const t = usePhraseTranslation();
    const { app_url } = usePage().props;
    const [previews, setPreviews] = useState([]);
    const { data, setData, post, processing, errors } = useForm({
        _method: 'PATCH',
        category_id: product.category_id,
        barcode: product.barcode || '',
        name: product.name,
        description: product.description || '',
        min_quantity: compactDecimal(product.min_quantity ?? 0),
        original_price: compactDecimal(product.original_price ?? 0),
        status: product.status || 'active',
        is_featured: !!product.is_featured,
        is_active: !!product.is_active,
        metadata: product.metadata || null,
        mainImageAttachmentId: product.images.find((image) => image.is_primary)?.id || null,
        imageAttachmentIds: product.images.map((image) => image.id),
        units: (product.units || []).map((unit) => ({
            ...unit,
            conversion_factor: compactDecimal(unit.conversion_factor),
        })),
        price_types: (product.price_types || []).map((type) => ({
            id: type.id,
            name: type.name,
            prices: (product.units || []).map((unit) => compactDecimal(
                (type.unit_prices || []).find((price) => Number(price.product_unit_id) === Number(unit.id))?.price ?? 0,
            )),
        })),
        images: [],
    });
    const indexHref = `${routeWithBase('/admin/products', app_base)}${returnPage > 1 ? `?page=${returnPage}` : ''}`;

    const handleImages = (event) => {
        const files = Array.from(event.target.files || []);
        setData('images', [...data.images, ...files]);
        setPreviews([...previews, ...files.map((file) => URL.createObjectURL(file))]);
        event.target.value = '';
    };
    const removePreview = (index) => {
        URL.revokeObjectURL(previews[index]);
        setPreviews(previews.filter((_, itemIndex) => itemIndex !== index));
        setData('images', data.images.filter((_, itemIndex) => itemIndex !== index));
    };
    const removeExisting = (imageId) => {
        const ids = data.imageAttachmentIds.filter((id) => id !== imageId);
        setData({ ...data, imageAttachmentIds: ids, mainImageAttachmentId: data.mainImageAttachmentId === imageId ? ids[0] || null : data.mainImageAttachmentId });
    };
    const generateBarcode = async () => {
        const response = await axios.get(routeWithBase('/admin/products/barcode/generate', app_base), { params: { reserved: [product.barcode].filter(Boolean) } });
        setData('barcode', response.data.barcode);
    };
    const submit = (event) => {
        event.preventDefault();
        post(`${routeWithBase(`/admin/products/${product.id}`, app_base)}?return_page=${returnPage}`);
    };

    return (
        <AdminLayout title={`${t('Edit')}: ${product.name}`} eyebrow={t('Catalog')} action={<button type="button" className="btn primary" onClick={submit} disabled={processing}><Icon name="check" size={14} />{processing ? t('Saving...') : t('Save changes')}</button>}>
            <Head title={t('Edit Product')} />
            <div className="sticky-toolbar product-form-toolbar"><Link href={indexHref} className="back-link"><Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} />{t('Back to products')}</Link><span>{t('Product details, units, prices and media')}</span></div>
            {Object.keys(errors).length > 0 && <div className="flash error">{t('Please correct the errors below.')}{Object.entries(errors).map(([key, error]) => <div key={key}><small>{key}: {formatErrorMessage(error)}</small></div>)}</div>}
            <form onSubmit={submit} className="product-crud-form">
                <ProductFormUI
                    data={data} setData={setData} errors={errors} processing={processing} categories={categories}
                    previews={previews} product={product} appUrl={app_url} onGenerateBarcode={generateBarcode}
                    onImageChange={handleImages} onRemoveNewPreview={removePreview} onRemoveExistingImage={removeExisting}
                    onSetCover={(imageId) => setData('mainImageAttachmentId', imageId)}
                />
            </form>
        </AdminLayout>
    );
}
