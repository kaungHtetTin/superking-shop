import FlashSaleForm from './Form';

export default function EditFlashSale({ productOptions, flashSale }) {
    return <FlashSaleForm productOptions={productOptions} flashSale={flashSale} mode="edit" />;
}
