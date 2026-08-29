import { useState } from 'react';
import axios from 'axios';
import { Head, Link, useForm } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import ProductFormUI from '@/Components/Admin/ProductFormUI';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatErrorMessage } from '@/Utils/formatErrorMessage';

const initialUnit = () => ({
    name: 'Piece',
    code: 'pc',
    conversion_factor: 1,
    is_base: true,
    is_default_selling: true,
    is_active: true,
});

export default function Create({ categories, app_base }) {
    const t = usePhraseTranslation();
    const [previews, setPreviews] = useState([]);
    const { data, setData, post, processing, errors } = useForm({
        category_id: '', barcode: '', name: '', description: '', min_quantity: 0, original_price: 0,
        status: 'active', is_featured: false, metadata: null, mainImageAttachmentId: null,
        imageAttachmentIds: [], units: [initialUnit()], price_types: [{ name: 'retail', prices: [0] }], images: [],
    });

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

    const generateBarcode = async () => {
        const response = await axios.get(routeWithBase('/admin/products/barcode/generate', app_base));
        setData('barcode', response.data.barcode);
    };

    const submit = (event) => {
        event.preventDefault();
        post(routeWithBase('/admin/products', app_base));
    };

    return (
        <AdminLayout title={t('Add product')} eyebrow={t('Catalog')} action={<button type="button" className="btn primary" onClick={submit} disabled={processing}><Icon name="check" size={14} />{processing ? t('Saving...') : t('Save product')}</button>}>
            <Head title={t('Create Product')} />
            <div className="sticky-toolbar product-form-toolbar"><Link href={routeWithBase('/admin/products', app_base)} className="back-link"><Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} />{t('Back to products')}</Link><span>{t('Product details, units, prices and media')}</span></div>
            {Object.keys(errors).length > 0 && <div className="flash error">{t('Please correct the errors below.')}{Object.entries(errors).map(([key, error]) => <div key={key}><small>{key}: {formatErrorMessage(error)}</small></div>)}</div>}
            <form onSubmit={submit} className="product-crud-form">
                <ProductFormUI
                    data={data} setData={setData} errors={errors} processing={processing} categories={categories}
                    previews={previews} product={{ images: [] }} appUrl={null} onGenerateBarcode={generateBarcode}
                    onImageChange={handleImages} onRemoveNewPreview={removePreview} onRemoveExistingImage={() => {}}
                    onSetCover={() => {}} onClearAllImages={() => { previews.forEach(URL.revokeObjectURL); setPreviews([]); setData('images', []); }}
                />
            </form>
        </AdminLayout>
    );
}
