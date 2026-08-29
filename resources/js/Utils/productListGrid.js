/**
 * User-side standard grid for product cards — matches Home “Best Sellers”.
 * - xs: 2 columns
 * - sm: 4 columns
 * - md and up: 6 columns
 */
export const DEFAULT_PRODUCT_LIST_GRID_GAP = { xs: '10px', sm: '12px', md: '16px' };

export const productListGridTemplateColumns = {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(4, minmax(0, 1fr))',
    md: 'repeat(6, minmax(0, 1fr))',
    lg: 'repeat(6, minmax(0, 1fr))',
};

/** Use with MUI `sx`: spread then add margins etc. */
export const productListGridSx = {
    display: 'grid',
    gridTemplateColumns: productListGridTemplateColumns,
    gap: DEFAULT_PRODUCT_LIST_GRID_GAP,
};
