import React, { useState, useEffect, useMemo } from 'react';
import { usePage, router } from '@/spa/router';
import {
    Box,
    Container,
    Typography,
    Stack,
    Button,
    Chip,
    TextField,
    InputAdornment,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Pagination,
    Drawer,
    IconButton,
    Divider,
    Badge,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { Search, Clear, Tune, Close, LocalFireDepartment } from '@mui/icons-material';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import ProductCard from '@/Components/User/ProductCard';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { routeWithBase } from '@/Utils/url';
import { productListGridSx } from '@/Utils/productListGrid';
import {
    eyebrowSxForTheme,
    getMusicStoreColors,
    sectionShellSxForTheme,
    storefrontBackgroundSx,
} from '@/Components/User/musicStoreDesign';
import { usePhraseTranslation } from '@/Utils/i18n';

const Index = ({ products, categories, filters: rawFilters }) => {
    // Laravel serializes an empty associative array as `[]`; normalize it so
    // Array.prototype.sort is never mistaken for an active sort filter.
    const filters = useMemo(() => (Array.isArray(rawFilters) ? {} : (rawFilters || {})), [rawFilters]);
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const sectionShellSx = sectionShellSxForTheme(theme);
    const isMobileFilters = useMediaQuery(theme.breakpoints.down('md'));
    const page = usePage();
    const { app_base } = page.props;
    const t = usePhraseTranslation();
    const [search, setSearch] = useState(filters.search || '');
    const [minPrice, setMinPrice] = useState(filters.min_price || '');
    const [maxPrice, setMaxPrice] = useState(filters.max_price || '');
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [desktopAdvancedOpen, setDesktopAdvancedOpen] = useState(false);

    useEffect(() => {
        setSearch(filters.search || '');
        setMinPrice(filters.min_price || '');
        setMaxPrice(filters.max_price || '');
    }, [filters.search, filters.min_price, filters.max_price]);

    useEffect(() => {
        if (!isMobileFilters) {
            setFilterDrawerOpen(false);
        }
    }, [isMobileFilters]);

    const activeFilterCount = useMemo(() => {
        let n = 0;
        if (filters.category) n += 1;
        if (filters.search && String(filters.search).trim()) n += 1;
        if (filters.sort && !['newest', 'latest'].includes(String(filters.sort))) n += 1;
        if (filters.min_price) n += 1;
        if (filters.max_price) n += 1;
        if (filters.min_rating) n += 1;
        if (filters.flash_sale) n += 1;
        return n;
    }, [filters.category, filters.search, filters.sort, filters.min_price, filters.max_price, filters.min_rating, filters.flash_sale]);

    const applyFilters = (newFilters) => {
        router.get(
            routeWithBase('/products', app_base),
            {
                ...filters,
                ...newFilters,
                page: 1,
            },
            {
                preserveState: true,
                replace: true,
            },
        );
        if (isMobileFilters) {
            setFilterDrawerOpen(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ search });
    };

    const handleCategoryClick = (slug) => {
        const newCategory = filters.category === slug ? null : slug;
        applyFilters({ category: newCategory });
    };

    const handleSortChange = (e) => {
        applyFilters({ sort: e.target.value });
    };

    const applyPriceFilters = (e) => {
        e.preventDefault();
        applyFilters({ min_price: minPrice || undefined, max_price: maxPrice || undefined });
    };

    const handlePageChange = (event, value) => {
        router.get(
            routeWithBase('/products', app_base),
            {
                ...filters,
                page: value,
            },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    const clearFilters = () => {
        setSearch('');
        setMinPrice('');
        setMaxPrice('');
        router.get(routeWithBase('/products', app_base), {}, { replace: true });
        if (isMobileFilters) {
            setFilterDrawerOpen(false);
        }
    };

    const fieldSx = {
        minWidth: 0,
        '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            bgcolor: musicColors.sheet,
        },
    };

    const categoryChips = (
        <Box
            sx={{
                display: 'flex',
                gap: 1,
                ...(isMobileFilters
                    ? {
                          flexWrap: 'wrap',
                      }
                    : {
                          flexWrap: 'nowrap',
                          overflowX: 'auto',
                          pb: 1.5,
                          mx: { xs: -0.5, sm: 0 },
                          px: { xs: 0.5, sm: 0 },
                          WebkitOverflowScrolling: 'touch',
                          '&::-webkit-scrollbar': { height: 6 },
                          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
                      }),
            }}
        >
            <Chip
                label={t('All')}
                onClick={() => handleCategoryClick(null)}
                variant={!filters.category ? 'filled' : 'outlined'}
                color={!filters.category ? 'primary' : 'default'}
                size="small"
                sx={{ fontWeight: 700, flexShrink: 0, borderRadius: 1.5 }}
            />
            {categories.map((cat) => (
                <Chip
                    key={cat.id}
                    label={cat.name}
                    onClick={() => handleCategoryClick(cat.slug)}
                    variant={filters.category === cat.slug ? 'filled' : 'outlined'}
                    color={filters.category === cat.slug ? 'primary' : 'default'}
                    size="small"
                    sx={{ fontWeight: 700, flexShrink: 0, borderRadius: 1.5 }}
                />
            ))}
        </Box>
    );

    const searchAndSort = (
        <Stack spacing={2}>
            <Box
                component="form"
                onSubmit={handleSearch}
                sx={{
                    display: 'flex',
                    gap: 1,
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { sm: 'stretch' },
                }}
            >
                <TextField
                    fullWidth
                    size="small"
                    placeholder={t('Search guitars, keyboards, microphones...')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search fontSize="small" color="action" />
                            </InputAdornment>
                        ),
                        sx: { borderRadius: 1.5, bgcolor: musicColors.sheet },
                    }}
                    sx={{ flex: 1 }}
                />
                <Button
                    type="submit"
                    variant="contained"
                    sx={{
                        px: 2.5,
                        borderRadius: 1.5,
                        fontWeight: 700,
                        flexShrink: 0,
                        minHeight: 40,
                    }}
                >
                    {t('Search')}
                </Button>
            </Box>
            <FormControl size="small" fullWidth={isMobileFilters} sx={{ width: { md: 220 }, flexShrink: 0 }}>
                <InputLabel id="products-sort-label">{t('Sort')}</InputLabel>
                <Select
                    labelId="products-sort-label"
                    label={t('Sort')}
                    value={filters.sort || 'newest'}
                    onChange={handleSortChange}
                    sx={{ borderRadius: 1.5, bgcolor: 'background.paper' }}
                >
                    <MenuItem value="newest">{t('Newest')}</MenuItem>
                    <MenuItem value="price_low">{t('Price: low to high')}</MenuItem>
                    <MenuItem value="price_high">{t('Price: high to low')}</MenuItem>
                    <MenuItem value="best_selling">{t('Best selling')}</MenuItem>
                    <MenuItem value="rating">{t('Top rated')}</MenuItem>
                </Select>
            </FormControl>
        </Stack>
    );

    const advancedFilters = (
        <Box
            component="form"
            onSubmit={applyPriceFilters}
            sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: isMobileFilters
                        ? '1fr'
                        : 'minmax(150px, 1fr) minmax(150px, 1fr) minmax(180px, 1fr) auto auto',
                },
                gap: 1.25,
                alignItems: 'stretch',
            }}
        >
            <TextField size="small" type="number" label={t('Min price')} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} sx={fieldSx} />
            <TextField size="small" type="number" label={t('Max price')} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} sx={fieldSx} />
            <FormControl size="small" sx={fieldSx}>
                <InputLabel id={isMobileFilters ? 'rating-filter-label-mobile' : 'rating-filter-label'}>{t('Rating')}</InputLabel>
                <Select
                    labelId={isMobileFilters ? 'rating-filter-label-mobile' : 'rating-filter-label'}
                    label={t('Rating')}
                    value={filters.min_rating || ''}
                    onChange={(e) => applyFilters({ min_rating: e.target.value || undefined })}
                >
                    <MenuItem value="">{t('Any rating')}</MenuItem>
                    <MenuItem value="4">{t('4 stars & up')}</MenuItem>
                    <MenuItem value="3">{t('3 stars & up')}</MenuItem>
                </Select>
            </FormControl>
            <Button
                variant="outlined"
                startIcon={<LocalFireDepartment />}
                onClick={() => applyFilters({ flash_sale: filters.flash_sale ? undefined : 1 })}
                sx={{
                    minHeight: 40,
                    px: 2,
                    borderRadius: 1.5,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    color: filters.flash_sale ? 'primary.main' : 'text.primary',
                    borderColor: filters.flash_sale ? 'primary.main' : 'divider',
                    bgcolor: filters.flash_sale ? 'primary.light' : 'background.paper',
                    '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: filters.flash_sale ? 'primary.light' : 'primary.light',
                    },
                }}
            >
                {t('Flash sale')}
            </Button>
            <Button
                type="submit"
                variant="contained"
                sx={{
                    minHeight: 40,
                    px: 3,
                    borderRadius: 1.5,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                }}
            >
                {t('Apply')}
            </Button>
        </Box>
    );

    return (
        <Box
            className="user-storefront"
            sx={{
                minHeight: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                ...storefrontBackgroundSx(theme),
            }}
        >
            <UserBrandHead title="Shop All Products" />

            <Navbar />

            <Container maxWidth="lg" sx={{ mt: { xs: '16px', md: '24px' }, pb: { xs: '24px', md: '32px' } }}>
                <Box
                    sx={{
                        ...sectionShellSx,
                        p: { xs: '16px', sm: '20px' },
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        mb: 2.5,
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ ...eyebrowSxForTheme(theme), mb: 0.5 }}>
                            {t('Instrument catalog')}
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5, color: musicColors.ink, lineHeight: 1.1 }}>
                            {filters.category
                                ? categories.find((c) => c.slug === filters.category)?.name
                                : t('All instruments & gear')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                            {t('Showing')} {products.from || 0}-{products.to || 0} {t('of')} {products.total} {t('items for players, studios, and stage setups.')}
                        </Typography>
                        {filters.flash_sale ? (
                            <Chip
                                icon={<LocalFireDepartment />}
                                label={t('Flash sale')}
                                color="primary"
                                size="small"
                                onDelete={() => applyFilters({ flash_sale: undefined })}
                                sx={{ mt: 1, fontWeight: 700 }}
                            />
                        ) : null}
                    </Box>

                    {isMobileFilters ? (
                        <Badge
                            color="primary"
                            overlap="circular"
                            badgeContent={activeFilterCount}
                            invisible={activeFilterCount === 0}
                            sx={{ flexShrink: 0, '& .MuiBadge-badge': { fontWeight: 700 } }}
                        >
                            <Button
                                variant={activeFilterCount > 0 ? 'contained' : 'outlined'}
                                color="primary"
                                size="medium"
                                startIcon={<Tune />}
                                onClick={() => setFilterDrawerOpen(true)}
                                aria-label={t('Open filters')}
                                sx={{
                                    fontWeight: 700,
                                    borderRadius: 2,
                                    px: 1.5,
                                    py: 1,
                                    minWidth: 'auto',
                                    whiteSpace: 'nowrap',
                                    boxShadow: activeFilterCount > 0 ? 2 : 0,
                                }}
                            >
                                {t('Filters')}
                            </Button>
                        </Badge>
                    ) : null}
                </Box>

                {/* Desktop / tablet: filters inline */}
                {!isMobileFilters ? (
                    <>
                        <Box sx={{ mb: 2 }}>{categoryChips}</Box>
                        <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={1.5}
                            alignItems={{ md: 'flex-start' }}
                            sx={{ mb: '16px' }}
                        >
                            <Box
                                component="form"
                                onSubmit={handleSearch}
                                sx={{
                                    flex: 1,
                                    minWidth: 0,
                                    display: 'flex',
                                    gap: 1,
                                    flexDirection: { xs: 'column', sm: 'row' },
                                    alignItems: { sm: 'stretch' },
                                }}
                            >
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder={t('Search guitars, keyboards, microphones...')}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Search fontSize="small" color="action" />
                                            </InputAdornment>
                                        ),
                                        sx: { borderRadius: 1.5, bgcolor: musicColors.sheet },
                                    }}
                                    sx={{ flex: 1 }}
                                />
                                <Button
                                    type="submit"
                                    variant="contained"
                                    sx={{
                                        px: 2.5,
                                        borderRadius: 1.5,
                                        fontWeight: 700,
                                        flexShrink: 0,
                                    minHeight: 44,
                                    }}
                                >
                                    {t('Search')}
                                </Button>
                            </Box>
                            <FormControl size="small" sx={{ width: { xs: '100%', md: 220 }, flexShrink: 0 }}>
                                <InputLabel id="products-sort-label-desktop">{t('Sort')}</InputLabel>
                                <Select
                                    labelId="products-sort-label-desktop"
                                    label={t('Sort')}
                                    value={filters.sort || 'newest'}
                                    onChange={handleSortChange}
                                    sx={{ borderRadius: 1.5, bgcolor: 'background.paper' }}
                                >
                                    <MenuItem value="newest">{t('Newest')}</MenuItem>
                                    <MenuItem value="price_low">{t('Price: low to high')}</MenuItem>
                                    <MenuItem value="price_high">{t('Price: high to low')}</MenuItem>
                                    <MenuItem value="best_selling">{t('Best selling')}</MenuItem>
                                    <MenuItem value="rating">{t('Top rated')}</MenuItem>
                                </Select>
                            </FormControl>
                            <Badge color="primary" badgeContent={activeFilterCount} invisible={activeFilterCount === 0}>
                                <Button
                                    variant={desktopAdvancedOpen || activeFilterCount > 0 ? 'contained' : 'outlined'}
                                    startIcon={<Tune />}
                                    onClick={() => setDesktopAdvancedOpen((open) => !open)}
                                    sx={{ minHeight: 46, whiteSpace: 'nowrap' }}
                                >
                                    {t('Filters')}
                                </Button>
                            </Badge>
                        </Stack>
                        {desktopAdvancedOpen && <Box sx={{ ...sectionShellSx, p: '16px', mb: '16px' }}>{advancedFilters}</Box>}
                    </>
                ) : null}

                {/* Small screens: right drawer */}
                <Drawer
                    anchor="right"
                    open={isMobileFilters && filterDrawerOpen}
                    onClose={() => setFilterDrawerOpen(false)}
                    PaperProps={{
                        sx: {
                            width: 'min(100vw - 40px, 400px)',
                            maxWidth: '100%',
                            borderRadius: '12px 0 0 12px',
                            display: 'flex',
                            flexDirection: 'column',
                        },
                    }}
                    ModalProps={{ keepMounted: true }}
                >
                    <Box
                        sx={{
                            px: 2,
                            py: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                        }}
                    >
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {t('Categories & filters')}
                        </Typography>
                        <IconButton
                            edge="end"
                            onClick={() => setFilterDrawerOpen(false)}
                            aria-label={t('Close filters')}
                            size="small"
                        >
                            <Close />
                        </IconButton>
                    </Box>

                    <Box sx={{ flex: 1, overflowY: 'auto', px: '16px', py: '16px', pb: '84px' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                            {t('Category')}
                        </Typography>
                        {categoryChips}

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                            {t('Search & sort')}
                        </Typography>
                        {searchAndSort}

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                            {t('Price & rating')}
                        </Typography>
                        {advancedFilters}

                        <Divider sx={{ my: 2 }} />

                        <Button
                            fullWidth
                            variant="outlined"
                            color="inherit"
                            startIcon={<Clear />}
                            onClick={clearFilters}
                            sx={{ fontWeight: 700, position: 'sticky', bottom: 0, bgcolor: 'background.paper', boxShadow: '0 -12px 24px rgba(0,0,0,.08)' }}
                        >
                            {t('Reset all filters')}
                        </Button>
                    </Box>
                </Drawer>

                {filters.flash_sale ? (
                    <Box
                        sx={{
                            mb: 2.5,
                            p: { xs: 1.5, sm: 2 },
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'primary.main',
                            bgcolor: 'primary.light',
                            display: 'flex',
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            justifyContent: 'space-between',
                            gap: 1.5,
                            flexDirection: { xs: 'column', sm: 'row' },
                        }}
                    >
                        <Stack direction="row" spacing={1.25} alignItems="center">
                            <Box
                                sx={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 1.5,
                                    display: 'grid',
                                    placeItems: 'center',
                                    bgcolor: 'background.paper',
                                    color: 'primary.main',
                                    flexShrink: 0,
                                }}
                            >
                                <LocalFireDepartment fontSize="small" />
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                    {t('Limited-time gear deals')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                    {t('Instruments and accessories while stock lasts')}
                                </Typography>
                            </Box>
                        </Stack>
                        <Button
                            variant="outlined"
                            size="small"
                            color="primary"
                            onClick={() => applyFilters({ flash_sale: undefined })}
                            sx={{ borderRadius: 1.5, fontWeight: 700, bgcolor: 'background.paper' }}
                        >
                            {t('Show all')}
                        </Button>
                    </Box>
                ) : null}

                {products.data.length > 0 ? (
                    <Box
                        sx={{
                            ...productListGridSx,
                            mb: 6,
                        }}
                    >
                        {products.data.map((product) => (
                            <ProductCard key={product.id} product={product} returnTo={page.url} />
                        ))}
                    </Box>
                ) : (
                    <Stack alignItems="center" justifyContent="center" sx={{ py: 12 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                            {t('No products found')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center', px: 2 }}>
                            {t('Try a different category or clear your search.')}
                        </Typography>
                        <Button variant="outlined" onClick={clearFilters} startIcon={<Clear />}>
                            {t('Reset filters')}
                        </Button>
                    </Stack>
                )}

                {products.total > products.per_page && (
                    <Stack alignItems="center" sx={{ mt: 4, mb: 8 }}>
                        <Pagination
                            count={products.last_page}
                            page={products.current_page}
                            onChange={handlePageChange}
                            color="primary"
                            size="medium"
                            sx={{
                                '& .MuiPaginationItem-root': { fontWeight: 700 },
                                '& .Mui-selected': { borderRadius: 1 },
                            }}
                        />
                    </Stack>
                )}
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
};

export default Index;
