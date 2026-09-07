import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, usePage } from '@/spa/router';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import { usePhraseTranslation, useTranslation } from '@/Utils/i18n';
import { routeWithBase, storageUrl } from '@/Utils/url';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    InputAdornment,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    useMediaQuery,
} from '@mui/material';
import {
    Add as AddIcon,
    AccountBalanceWalletOutlined as ShiftIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    Close as CloseIcon,
    Delete as DeleteIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    ImageOutlined as ImagePlaceholderIcon,
    MoneyOff as FocIcon,
    PointOfSale as CheckoutIcon,
    Print as PrintIcon,
    QrCodeScanner as ScanIcon,
    Remove as RemoveIcon,
    Search as SearchIcon,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { formatMoney } from '@/Utils/pricing';
import { formatUnitWithConversion } from '@/Utils/unitLabel';

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const money = formatMoney;
const POS_RESULT_PAGE_SIZE = 24;
const POS_TABLE_ROW_HEIGHT = 44;
const POS_RESULT_OVERSCAN_ROWS = 6;
const WALK_IN_CUSTOMER = Object.freeze({
    id: null,
    name: 'Walk-in customer',
    phone: null,
    email: null,
    credit_status: 'disabled',
    available_credit: 0,
    is_walk_in: true,
});
const calculateLineTotal = (line) => Number(line.quantity || 0) * Number(line.unit_price || 0);
const calculateLineBaseUsage = (line) => {
    const paidBase = Number(line.quantity || 0) * Number(line.conversion_factor || 1);
    const focUnit = (line.unit_options || []).find((unit) => Number(unit.id) === Number(line.foc_product_unit_id));
    const focBase = Number(line.foc_quantity || 0) * Number(focUnit?.conversion_factor || 1);

    return paidBase + focBase;
};
const lineExceedsStock = (line) => calculateLineBaseUsage(line) > Number(
    line.available_base_qty || (Number(line.available_qty || 0) * Number(line.conversion_factor || 1)),
) + 0.00005;

export default function PosIndex({ locations = [], registers = [], categories = [], priceTypes = ['retail'], can = {} }) {
    const { app_base, app_url, app_settings = {}, flash = {}, errors: pageErrors = {} } = usePage().props;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const t = useTranslation();
    const tp = usePhraseTranslation();
    const firstLocation = locations[0];
    const [locationId, setLocationId] = useState(firstLocation?.id || '');
    const [categoryId, setCategoryId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [resultMeta, setResultMeta] = useState({ page: 1, per_page: POS_RESULT_PAGE_SIZE, has_more: false, next_page: null, mode: 'popular' });
    const [searchLoading, setSearchLoading] = useState(false);
    const [productResultsElement, setProductResultsElement] = useState(null);
    const [productScrollTop, setProductScrollTop] = useState(0);
    const [productViewportHeight, setProductViewportHeight] = useState(520);
    const [scanError, setScanError] = useState('');
    const [mobileAppBarExpanded, setMobileAppBarExpanded] = useState(false);
    const [cart, setCart] = useState([]);
    const [customerOptions, setCustomerOptions] = useState([WALK_IN_CUSTOMER]);
    const [customerSearchInput, setCustomerSearchInput] = useState('');
    const [customerLoading, setCustomerLoading] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(WALK_IN_CUSTOMER);
    const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });
    const [customerCreateErrors, setCustomerCreateErrors] = useState({});
    const [customerCreating, setCustomerCreating] = useState(false);
    const [salePriceType, setSalePriceType] = useState('retail');
    const [discountType, setDiscountType] = useState('');
    const [discountValue, setDiscountValue] = useState('');
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [mobileStep, setMobileStep] = useState('products');
    const [tenderType, setTenderType] = useState('cash');
    const [amountTendered, setAmountTendered] = useState('');
    const [creditDepositMethod, setCreditDepositMethod] = useState('cash');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [errors, setErrors] = useState({});
    const [receipt, setReceipt] = useState(null);
    const [activeShift, setActiveShift] = useState(null);
    const [shiftLoading, setShiftLoading] = useState(true);
    const [shiftBusy, setShiftBusy] = useState(false);
    const [openShiftDialogOpen, setOpenShiftDialogOpen] = useState(false);
    const [closeShiftOpen, setCloseShiftOpen] = useState(false);
    const [openingCash, setOpeningCash] = useState('');
    const [openingNotes, setOpeningNotes] = useState('');
    const [countedCash, setCountedCash] = useState('');
    const [closingNotes, setClosingNotes] = useState('');
    const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
    const searchInputRef = useRef(null);
    const categoryScrollRef = useRef(null);
    const checkoutIntentRef = useRef('complete');
    const productScrollFrameRef = useRef(null);
    const productLoadMoreSentinelRef = useRef(null);
    const productLoadMoreLockRef = useRef(false);

    const location = locations.find((item) => Number(item.id) === Number(locationId));
    const locationRegisters = registers.filter((item) => Number(item.location_id) === Number(locationId));
    const [registerId, setRegisterId] = useState('');
    const paymentMethods = ['cash', 'card', 'mobile', ...(can.credit ? ['credit'] : [])];
    const api = async (url, options = {}) => {
        setErrors({});
        try {
            const response = await window.axios({ url: routeWithBase(url, app_base), ...options });
            return response.data;
        } catch (error) {
            const nextErrors = error.response?.data?.errors || { request: error.response?.data?.message || tp('Request failed.') };
            setErrors(nextErrors);
            throw error;
        }
    };

    const refreshShift = useCallback(async () => {
        if (!locationId) {
            setActiveShift(null);
            setShiftLoading(false);
            return;
        }
        setShiftLoading(true);
        try {
            const response = await window.axios.get(routeWithBase('/admin/pos/shifts/active', app_base), { params: { location_id: locationId } });
            setActiveShift(response.data.shift || null);
        } catch (error) {
            setErrors(error.response?.data?.errors || { shift: error.response?.data?.message || tp('Unable to load cash shift.') });
            setActiveShift(null);
        } finally {
            setShiftLoading(false);
        }
    }, [app_base, locationId]);

    useEffect(() => {
        setRegisterId(String(locationRegisters[0]?.id || ''));
        setCart([]);
        refreshShift();
    }, [locationId, refreshShift]);

    useEffect(() => {
        const refreshWhenActive = () => document.visibilityState === 'visible' && refreshShift();
        window.addEventListener('focus', refreshWhenActive);
        document.addEventListener('visibilitychange', refreshWhenActive);
        return () => {
            window.removeEventListener('focus', refreshWhenActive);
            document.removeEventListener('visibilitychange', refreshWhenActive);
        };
    }, [refreshShift]);

    const openShift = async (event) => {
        event.preventDefault();
        if (!registerId) return;
        setShiftBusy(true);
        try {
            const data = await api('/admin/pos/shifts/open', { method: 'post', data: { location_id: locationId, register_id: registerId, opening_cash: Number(openingCash || 0), notes: openingNotes || null } });
            setActiveShift(data.shift);
            setOpenShiftDialogOpen(false);
            setOpeningCash('');
            setOpeningNotes('');
            setMessage(tp('Cash shift opened.'));
        } finally {
            setShiftBusy(false);
        }
    };

    const closeShift = async (event) => {
        event.preventDefault();
        if (!activeShift) return;
        setShiftBusy(true);
        try {
            await api(`/admin/pos/shifts/${activeShift.id}/close`, { method: 'post', data: { counted_cash: Number(countedCash || 0), notes: closingNotes || null } });
            setActiveShift(null);
            setCloseShiftOpen(false);
            setCountedCash('');
            setClosingNotes('');
            setCart([]);
            setMessage(tp('Cash shift closed.'));
        } finally {
            setShiftBusy(false);
        }
    };

    const showOpenShiftDialog = () => {
        setErrors({});
        setScanError('');
        setOpenShiftDialogOpen(true);
    };

    const hideOpenShiftDialog = () => {
        if (shiftBusy) return;
        setOpenShiftDialogOpen(false);
        setErrors({});
    };

    const showCloseShiftDialog = () => {
        if (!activeShift) return;
        setErrors({});
        setCountedCash(String(activeShift.expected_cash ?? ''));
        setCloseShiftOpen(true);
    };

    const hideCloseShiftDialog = () => {
        if (shiftBusy) return;
        setCloseShiftOpen(false);
        setErrors({});
    };

    const fetchSearch = useCallback(async (options = {}) => {
        const { autoAddFirst = false, clearInputAfterSearch = false, append = false, page = 1 } = options;
        if (!locationId) return;

        setScanError('');
        setSearchLoading(true);
        try {
            const data = await api('/admin/pos/products/search', {
                method: 'get',
                params: { location_id: locationId, category_id: categoryId || undefined, q: searchQuery.trim(), page, per_page: resultMeta.per_page },
            });
            const products = Array.isArray(data) ? data : data.data || [];
            const meta = Array.isArray(data)
                ? { page, per_page: resultMeta.per_page, has_more: false, next_page: null, mode: searchQuery.trim() ? 'search' : 'popular' }
                : data.meta;
            setResultMeta(meta);
            setSearchResults((prev) => {
                if (!append) return products;
                const existingIds = new Set(prev.map((item) => item.id));
                return [...prev, ...products.filter((item) => !existingIds.has(item.id))];
            });
            if (autoAddFirst && products[0]) {
                addProductToCart(products[0]);
            }
        } finally {
            setSearchLoading(false);
            if (clearInputAfterSearch) {
                setSearchQuery('');
                window.setTimeout(() => searchInputRef.current?.focus(), 0);
            }
        }
    }, [app_base, categoryId, locationId, resultMeta.per_page, searchQuery]);

    const loadMoreProducts = useCallback(async () => {
        if (productLoadMoreLockRef.current || searchLoading || !resultMeta.has_more) return;

        productLoadMoreLockRef.current = true;
        try {
            await fetchSearch({
                append: true,
                page: resultMeta.next_page || resultMeta.page + 1,
            });
        } catch {
            // The shared request helper already exposes the error in the POS alert area.
        } finally {
            productLoadMoreLockRef.current = false;
        }
    }, [fetchSearch, resultMeta.has_more, resultMeta.next_page, resultMeta.page, searchLoading]);

    const fetchCustomers = useCallback(async (query) => {
        setCustomerLoading(true);
        try {
            const data = await api('/admin/pos/customers/search', {
                method: 'get',
                params: { q: query.trim() },
            });
            const customers = Array.isArray(data) ? data : [];
            setCustomerOptions([WALK_IN_CUSTOMER, ...customers]);
        } catch {
            setCustomerOptions([WALK_IN_CUSTOMER]);
        } finally {
            setCustomerLoading(false);
        }
    }, [app_base]);

    const createCustomer = async (event) => {
        event.preventDefault();
        setCustomerCreateErrors({});
        setCustomerCreating(true);
        try {
            const response = await window.axios.post(routeWithBase('/admin/pos/customers', app_base), newCustomer);
            const customer = response.data.customer;
            setCustomerOptions((current) => [customer, ...current.filter((item) => item.id !== customer.id)]);
            setSelectedCustomer(customer);
            setCustomerSearchInput(customer.name);
            setNewCustomer({ name: '', email: '', phone: '' });
            setCustomerDialogOpen(false);
            setMessage(tp('Customer created and selected.'));
        } catch (error) {
            setCustomerCreateErrors(error.response?.data?.errors || { request: error.response?.data?.message || tp('Unable to create customer.') });
        } finally {
            setCustomerCreating(false);
        }
    };

    useEffect(() => {
        const updateNetworkState = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', updateNetworkState);
        window.addEventListener('offline', updateNetworkState);
        return () => {
            window.removeEventListener('online', updateNetworkState);
            window.removeEventListener('offline', updateNetworkState);
        };
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            fetchSearch();
        }, 180);
        return () => window.clearTimeout(timer);
    }, [fetchSearch]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            fetchCustomers(customerSearchInput);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [customerSearchInput, fetchCustomers]);

    useEffect(() => {
        window.setTimeout(() => searchInputRef.current?.focus(), 150);
    }, []);

    useEffect(() => {
        if (!productResultsElement) return undefined;

        const updateMetrics = () => {
            setProductScrollTop(productResultsElement.scrollTop);
            setProductViewportHeight(productResultsElement.clientHeight || 520);

            const remainingScroll = productResultsElement.scrollHeight
                - productResultsElement.scrollTop
                - productResultsElement.clientHeight;
            const preloadDistance = Math.max(220, productResultsElement.clientHeight * 0.35);
            const hasInternalScroll = productResultsElement.scrollHeight > productResultsElement.clientHeight + 1;
            if (hasInternalScroll && remainingScroll <= preloadDistance) {
                loadMoreProducts();
            }
        };
        const onScroll = () => {
            if (productScrollFrameRef.current) return;
            productScrollFrameRef.current = window.requestAnimationFrame(() => {
                productScrollFrameRef.current = null;
                updateMetrics();
            });
        };

        updateMetrics();
        productResultsElement.addEventListener('scroll', onScroll, { passive: true });

        let resizeObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(updateMetrics);
            resizeObserver.observe(productResultsElement);
        }

        return () => {
            productResultsElement.removeEventListener('scroll', onScroll);
            resizeObserver?.disconnect();
            if (productScrollFrameRef.current) {
                window.cancelAnimationFrame(productScrollFrameRef.current);
                productScrollFrameRef.current = null;
            }
        };
    }, [loadMoreProducts, productResultsElement]);

    useEffect(() => {
        if (
            !productResultsElement
            || !productLoadMoreSentinelRef.current
            || !resultMeta.has_more
            || typeof IntersectionObserver === 'undefined'
        ) return undefined;

        const hasInternalScroll = productResultsElement.scrollHeight > productResultsElement.clientHeight + 1;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting) loadMoreProducts();
        }, {
            root: hasInternalScroll ? productResultsElement : null,
            rootMargin: '300px 0px',
            threshold: 0,
        });

        observer.observe(productLoadMoreSentinelRef.current);
        return () => observer.disconnect();
    }, [loadMoreProducts, productResultsElement, resultMeta.has_more, searchResults.length]);

    useEffect(() => {
        productResultsElement?.scrollTo({ top: 0 });
        setProductScrollTop(0);
    }, [categoryId, locationId, searchQuery, productResultsElement]);

    useEffect(() => {
        if (isMobile && cart.length === 0 && mobileStep !== 'products') {
            setMobileStep('products');
        }
    }, [cart.length, isMobile, mobileStep]);

    useEffect(() => {
        setCart([]);
        setSearchResults([]);
        setResultMeta((prev) => ({ ...prev, page: 1, has_more: false, next_page: null, mode: 'popular' }));
        setSearchQuery('');
    }, [locationId]);

    const getProductDisplayName = (product) => [product?.product_name, product?.unit_name].filter(Boolean).join(' · ') || product?.product_code || tp('Product');

    const resolveProductPrice = (product, priceType = salePriceType) => {
        const prices = product?.prices || [];
        const selected = prices.find((price) => price.price_type === priceType);
        return Number(selected?.price || 0);
    };

    const resolvePriceFromList = (prices, priceType) => Number(
        (prices || []).find((price) => price.price_type === priceType)?.price
        ?? 0,
    );

    const addProductToCart = (product) => {
        if (Number(product?.available_qty || 0) <= 0) {
            setScanError(`${getProductDisplayName(product)}: ${tp('Out of stock')}`);
            return;
        }

        setCart((prev) => {
            const appliedPriceType = salePriceType;
            const existingIndex = prev.findIndex((line) => line.product_unit_id === product.id && line.price_type === appliedPriceType);
            if (existingIndex >= 0) {
                const updated = [...prev];
                const line = updated[existingIndex];
                updated[existingIndex] = {
                    ...line,
                    quantity: Math.min(Number(line.quantity || 0) + 1, Number(line.available_qty || 1)),
                };
                return updated;
            }

            return [
                ...prev,
                {
                    id: makeId(),
                    product_unit_id: product.id,
                    product_id: product.product_id,
                    product_code: product.product_code,
                    barcode: product.barcode,
                    product_name: product.product_name,
                    name: getProductDisplayName(product),
                    unit_name: product.unit_name,
                    unit_code: product.unit_code,
                    image_path: product.image_path,
                    available_qty: Number(product.available_qty || 0),
                    available_base_qty: Number(product.available_base_qty || 0),
                    conversion_factor: Number(product.conversion_factor || 1),
                    prices: product.prices || [],
                    unit_options: product.unit_options || [],
                    price_type: appliedPriceType,
                    unit_price: resolveProductPrice(product, appliedPriceType),
                    quantity: 1,
                    foc_quantity: 0,
                    foc_product_unit_id: product.id,
                },
            ];
        });
    };

    const updateCartLine = (id, patch) => {
        setCart((prev) => prev.map((line) => {
            if (line.id !== id) return line;
            const updated = { ...line, ...patch };
            updated.quantity = Math.max(1, Math.min(Number(updated.quantity || 1), Number(line.available_qty || 1)));
            updated.unit_price = Math.max(0, Number(updated.unit_price || 0));
            return updated;
        }));
    };

    const adjustCartQuantity = (id, delta) => {
        setCart((prev) => prev.map((line) => {
            if (line.id !== id) return line;
            const current = Number(line.quantity || 1);
            const max = Math.max(1, Number(line.available_qty || 1));
            return {
                ...line,
                quantity: Math.max(1, Math.min(current + delta, max)),
            };
        }));
    };

    const changeCartUnit = (id, productUnitId) => {
        setCart((prev) => prev.map((line) => {
            if (line.id !== id) return line;
            const unit = (line.unit_options || []).find((option) => Number(option.id) === Number(productUnitId));
            if (!unit || Number(unit.available_qty || 0) <= 0) return line;
            const nextPriceType = salePriceType;

            return {
                ...line,
                product_unit_id: unit.id,
                unit_name: unit.name,
                unit_code: unit.code,
                name: [line.product_name, unit.name].filter(Boolean).join(' · '),
                available_qty: Number(unit.available_qty || 0),
                conversion_factor: Number(unit.conversion_factor || 1),
                prices: unit.prices || [],
                price_type: nextPriceType,
                unit_price: resolvePriceFromList(unit.prices, nextPriceType, line.unit_price),
                quantity: Math.max(1, Math.min(Number(line.quantity || 1), Number(unit.available_qty || 1))),
            };
        }));
    };

    const changeCartFocUnit = (id, productUnitId) => {
        if (!can.discount) return;
        setCart((prev) => prev.map((line) => {
            if (line.id !== id) return line;
            const unit = (line.unit_options || []).find((option) => Number(option.id) === Number(productUnitId));
            return unit ? { ...line, foc_product_unit_id: unit.id } : line;
        }));
    };

    const changeCartFocQuantity = (id, quantity, normalize = false) => {
        if (!can.discount) return;
        const parsedQuantity = Number(quantity);
        const nextQuantity = quantity === '' && !normalize
            ? ''
            : Math.max(0, Number.isFinite(parsedQuantity) ? parsedQuantity : 0);
        setCart((prev) => prev.map((line) => line.id === id ? { ...line, foc_quantity: nextQuantity } : line));
    };


    const removeCartLine = (id) => {
        setCart((items) => items.filter((item) => item.id !== id));
    };

    const changeSalePriceType = (next) => {
        if (!next || next === salePriceType) return;
        setSalePriceType(next);
        setCart((prev) => prev.map((line) => ({
            ...line,
            price_type: next,
            unit_price: resolvePriceFromList(line.prices, next),
        })));
    };

    const totals = useMemo(() => {
        const subtotal = cart.reduce((sum, item) => sum + calculateLineTotal(item), 0);
        const discountRaw = discountType === 'percent'
            ? subtotal * (Number(discountValue || 0) / 100)
            : Number(discountValue || 0);
        const discount = Math.min(Math.max(discountRaw, 0), subtotal);
        const grandTotal = Math.max(0, subtotal - discount);

        return { subtotal, discount, grandTotal };
    }, [cart, discountType, discountValue]);
    const creditDeposit = tenderType === 'credit' ? Math.max(0, Number(amountTendered || 0)) : 0;
    const creditAmount = tenderType === 'credit' ? Math.max(0, totals.grandTotal - creditDeposit) : 0;
    const creditUnavailable = tenderType === 'credit' && (
        !selectedCustomer
        || selectedCustomer.is_walk_in
        || selectedCustomer.credit_status !== 'active'
        || creditAmount <= 0
        || creditAmount > Number(selectedCustomer.available_credit || 0) + 0.009
    );

    const hasStockIssue = useMemo(() => {
        const usageByProduct = new Map();
        cart.forEach((line) => {
            const key = line.product_id || line.product_code;
            const current = usageByProduct.get(key) || { used: 0, available: Number(line.available_base_qty || 0) };
            current.used += calculateLineBaseUsage(line);
            current.available = Math.max(current.available, Number(line.available_base_qty || 0));
            usageByProduct.set(key, current);
        });

        return [...usageByProduct.values()].some((stock) => stock.used > stock.available + 0.00005);
    }, [cart]);
    const hasAlternatePriceItems = useMemo(() => cart.some((line) => line.price_type !== 'retail'), [cart]);
    const focLineCount = useMemo(() => cart.filter((line) => Number(line.foc_quantity || 0) > 0).length, [cart]);
    const availablePriceTypes = useMemo(() => [...new Set(['retail', ...priceTypes, ...searchResults.flatMap((product) => (product.prices || []).map((price) => price.price_type)), ...cart.flatMap((line) => (line.prices || []).map((price) => price.price_type))])], [cart, priceTypes, searchResults]);
    const resultHeading = resultMeta.mode === 'popular' && !searchQuery.trim() ? tp('POPULAR PRODUCTS') : tp('RESULTS');
    const virtualRowCount = searchResults.length;
    const virtualStartRow = Math.max(0, Math.floor(productScrollTop / POS_TABLE_ROW_HEIGHT) - POS_RESULT_OVERSCAN_ROWS);
    const virtualEndRow = Math.min(
        virtualRowCount,
        Math.ceil((productScrollTop + productViewportHeight) / POS_TABLE_ROW_HEIGHT) + POS_RESULT_OVERSCAN_ROWS,
    );
    const virtualTopSpacer = virtualStartRow * POS_TABLE_ROW_HEIGHT;
    const virtualBottomSpacer = Math.max(0, (virtualRowCount - virtualEndRow) * POS_TABLE_ROW_HEIGHT);
    const visibleTableProducts = searchResults.slice(virtualStartRow, virtualEndRow);

    const scrollCategories = (direction) => {
        categoryScrollRef.current?.scrollBy({
            left: direction * 260,
            behavior: 'smooth',
        });
    };

    const openPaymentDialog = async () => {
        if (busy) return;
        if (!activeShift) {
            showOpenShiftDialog();
            return;
        }
        if (!locationId) {
            setScanError(tp('Select a warehouse before selling.'));
            if (isMobile) setMobileStep('products');
            return;
        }
        if (hasStockIssue) {
            setScanError(tp('Cart quantity exceeds available warehouse stock.'));
            if (isMobile) setMobileStep('cart');
            return;
        }
        if (cart.length) {
            setBusy(true);
            let updated;
            try {
                const latest = await api('/admin/pos/products/prices', { method: 'get', params: { unit_ids: cart.map(line => line.product_unit_id) } });
                updated = cart.map(line => {
                    const unit = latest.find(unit => Number(unit.id) === Number(line.product_unit_id));
                    const price = unit?.prices.find(price => price.price_type === line.price_type);
                    return { ...line, prices: unit?.prices || [], unit_price: Number(price?.price || 0) };
                });
                setCart(updated);
                if (updated.some(line => line.unit_price <= 0)) { setScanError('A cart item is unavailable or needs a selling price. Review the cart.'); return; }
                const subtotal = updated.reduce((sum, item) => sum + calculateLineTotal(item), 0);
                const discount = Math.min(subtotal, Math.max(0, discountType === 'percent' ? subtotal * Number(discountValue || 0) / 100 : Number(discountValue || 0)));
                setAmountTendered(String(subtotal - discount));
            } catch { return; }
            finally { setBusy(false); }
            if (isMobile) {
                setMobileStep('checkout');
            } else {
                setPaymentDialogOpen(true);
            }
        }
    };

    const checkout = async (event) => {
        event.preventDefault();
        if (!locationId || !cart.length) return;
        if (!selectedCustomer && tenderType === 'credit') {
            setScanError(tp('Choose a registered customer before completing the sale.'));
            return;
        }

        setBusy(true);
        try {
            const data = await api('/admin/pos/checkout', {
                method: 'post',
                data: {
                    location_id: locationId,
                    shift_id: activeShift?.id,
                    customer_id: selectedCustomer?.is_walk_in ? null : selectedCustomer?.id,
                    customer_name: selectedCustomer?.is_walk_in ? WALK_IN_CUSTOMER.name : selectedCustomer?.name,
                    customer_phone: selectedCustomer?.is_walk_in ? null : (selectedCustomer?.phone || null),
                    items: cart.map((item) => ({
                        product_unit_id: item.product_unit_id,
                        quantity: item.quantity,
                        price_type: item.price_type,
                        expected_unit_price: item.unit_price,
                        foc_quantity: Number(item.foc_quantity || 0),
                        foc_product_unit_id: Number(item.foc_quantity || 0) > 0 ? item.foc_product_unit_id : null,
                    })),
                    discount_type: discountType || null,
                    discount_value: discountValue || 0,
                    tender_type: tenderType,
                    amount_tendered: ['cash', 'credit'].includes(tenderType) ? Number(amountTendered || 0) : totals.grandTotal,
                    credit_deposit_method: tenderType === 'credit' ? creditDepositMethod : null,
                },
            });
            if ((checkoutIntentRef.current === 'print' || app_settings.receipt?.auto_print) && data.receipt_url) {
                const separator = data.receipt_url.includes('?') ? '&' : '?';
                window.location.assign(`${data.receipt_url}${separator}print=1`);
                return;
            }
            setReceipt(data);
            setCart([]);
            setDiscountType('');
            setDiscountValue('');
            setSelectedCustomer(WALK_IN_CUSTOMER);
            setCustomerSearchInput('');
            setPaymentDialogOpen(false);
            setMobileStep('products');
            setMessage(`${tp('Sale completed')}: ${data.order.receipt_number}`);
            await refreshShift();
            window.setTimeout(() => searchInputRef.current?.focus(), 100);
        } finally {
            checkoutIntentRef.current = 'complete';
            setBusy(false);
        }
    };

    const paymentFormContent = (
        <Stack spacing={1.25} className="pos-console__payment-form">
            <Box className="pos-console__customer-selector">
                <Stack className="pos-console__customer-row" direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
                    <Autocomplete
                        size="small"
                        fullWidth
                        options={customerOptions}
                        value={selectedCustomer}
                        onChange={(event, value) => {
                            const nextCustomer = value || WALK_IN_CUSTOMER;
                            setSelectedCustomer(nextCustomer);
                        }}
                        onInputChange={(event, value) => setCustomerSearchInput(value || '')}
                        getOptionLabel={(option) => option?.is_walk_in ? tp('Walk-in customer') : (option?.name || '')}
                        renderOption={(props, option) => (
                            <li {...props} key={option.is_walk_in ? 'walk-in' : (option.id || option.email || option.name)}>
                                <Stack>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{option.is_walk_in ? tp('Walk-in customer') : option.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {option.is_walk_in ? tp('Default customer for counter sales') : ([option.phone, option.email].filter(Boolean).join(' / ') || tp('No contact'))}
                                    </Typography>
                                    {!option.is_walk_in && option.credit_status === 'active' && (
                                        <Typography variant="caption" color="primary.main">
                                            {tp('Available credit')}: {money(option.available_credit)}
                                        </Typography>
                                    )}
                                </Stack>
                            </li>
                        )}
                        loading={customerLoading}
                        isOptionEqualToValue={(option, value) => option?.is_walk_in
                            ? Boolean(value?.is_walk_in)
                            : Number(option?.id) === Number(value?.id)}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={tp('Customer')}
                                placeholder={tp('Search customer by name, phone, or email...')}
                                size="small"
                            />
                        )}
                        sx={{ flex: 1, minWidth: 0 }}
                    />
                    <Button className="pos-console__new-customer" size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => {
                        setCustomerCreateErrors({});
                        setNewCustomer({ name: '', email: customerSearchInput.includes('@') ? customerSearchInput : '', phone: '' });
                        setCustomerDialogOpen(true);
                    }}>{tp('New customer')}</Button>
                </Stack>
                {selectedCustomer?.is_walk_in && (
                    <Typography className="pos-console__walk-in-hint" variant="caption" color="text.secondary">
                        {tp('Walk-in sale; no customer account or loyalty points will be used.')}
                    </Typography>
                )}
            </Box>

            {can.discount && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                        select
                        size="small"
                        label={tp('Discount')}
                        value={discountType}
                        onChange={(event) => setDiscountType(event.target.value)}
                        sx={{ flex: 1 }}
                    >
                        <MenuItem value="">{tp('No discount')}</MenuItem>
                        <MenuItem value="amount">{tp('Amount')}</MenuItem>
                        <MenuItem value="percent">{tp('Percent')}</MenuItem>
                    </TextField>
                    <TextField
                        size="small"
                        type="number"
                        label={tp('Value')}
                        value={discountValue}
                        disabled={!discountType}
                        onChange={(event) => setDiscountValue(event.target.value)}
                        slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                        sx={{ flex: 1 }}
                    />
                </Stack>
            )}

            <Box className="pos-console__totals" sx={{ p: 1.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                <Stack spacing={0.85}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">{tp('Subtotal')}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right' }}>{money(totals.subtotal)}</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">{tp('Discount')}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: totals.discount > 0 ? 'success.main' : 'inherit', textAlign: 'right' }}>-{money(totals.discount)}</Typography>
                    </Box>
                    <Divider />
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'baseline', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{tp('Sale total')}</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', textAlign: 'right' }}>{money(totals.grandTotal)}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        {tp('Stock will be deducted from')} {location?.name || tp('selected warehouse')}.
                    </Typography>
                </Stack>
            </Box>

            <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{tp('Payment Method')}</Typography>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    fullWidth
                    value={tenderType}
                    onChange={(event, next) => {
                        if (!next) return;
                        setTenderType(next);
                        setAmountTendered(next === 'credit' ? '0' : String(totals.grandTotal));
                    }}
                >
                    {paymentMethods.map((method) => (
                        <ToggleButton key={method} value={method} sx={{ flex: 1, textTransform: 'none' }}>{tp(method)}</ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>
            {tenderType === 'cash' && (
                <TextField
                    size="small"
                    type="number"
                    label={tp('Cash received')}
                    value={amountTendered}
                    onChange={(event) => setAmountTendered(event.target.value)}
                    error={Number(amountTendered || 0) < totals.grandTotal}
                    helperText={Number(amountTendered || 0) < totals.grandTotal
                        ? tp('Cash received must cover the sale total.')
                        : `${tp('Change')}: ${money(Math.max(0, Number(amountTendered || 0) - totals.grandTotal))}`}
                    inputProps={{ min: totals.grandTotal, step: 100 }}
                    fullWidth
                />
            )}
            {tenderType === 'credit' && (
                <Stack spacing={1}>
                    {(!selectedCustomer || selectedCustomer.is_walk_in) && <Alert severity="warning">{tp('Choose a registered customer for a credit sale.')}</Alert>}
                    {selectedCustomer && !selectedCustomer.is_walk_in && selectedCustomer.credit_status !== 'active' && (
                        <Alert severity="error">{tp('Credit sales are not enabled for this customer.')}</Alert>
                    )}
                    {selectedCustomer?.credit_status === 'active' && (
                        <Alert severity={creditAmount <= Number(selectedCustomer.available_credit || 0) ? 'info' : 'error'}>
                            {tp('Available credit')}: {money(selectedCustomer.available_credit)} · {tp('Due in')} {selectedCustomer.credit_terms_days} {tp('days')}
                        </Alert>
                    )}
                    <TextField
                        size="small"
                        type="number"
                        label={tp('Deposit paid now')}
                        value={amountTendered}
                        onChange={(event) => setAmountTendered(event.target.value)}
                        error={creditDeposit >= totals.grandTotal || creditDeposit < 0}
                        helperText={`${tp('Credit balance')}: ${money(creditAmount)}`}
                        inputProps={{ min: 0, max: Math.max(0, totals.grandTotal - 0.01), step: 100 }}
                        fullWidth
                    />
                    {creditDeposit > 0 && (
                        <TextField select size="small" label={tp('Deposit method')} value={creditDepositMethod} onChange={(event) => setCreditDepositMethod(event.target.value)} fullWidth>
                            <MenuItem value="cash">{tp('cash')}</MenuItem>
                            <MenuItem value="card">{tp('card')}</MenuItem>
                            <MenuItem value="mobile">{tp('mobile')}</MenuItem>
                        </TextField>
                    )}
                </Stack>
            )}
        </Stack>
    );

    const completeSaleButtons = (
        <>
            <Button
                type="submit"
                variant="outlined"
                startIcon={<PrintIcon />}
                disabled={busy || cart.length === 0 || !locationId || !activeShift || hasStockIssue || (tenderType === 'cash' && Number(amountTendered || 0) < totals.grandTotal) || creditUnavailable}
                onClick={() => {
                    checkoutIntentRef.current = 'print';
                }}
                sx={{
                    width: { xs: '100%', sm: 'auto' },
                    minWidth: 0,
                    minHeight: { xs: 48, sm: 36 },
                    px: { xs: 1, sm: 2 },
                    whiteSpace: 'normal',
                    lineHeight: 1.2,
                    '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
                }}
            >
                {tp('Complete & Print')}
            </Button>
            <Button
                type="submit"
                variant="contained"
                startIcon={<CheckoutIcon />}
                disabled={busy || cart.length === 0 || !locationId || !activeShift || hasStockIssue || (tenderType === 'cash' && Number(amountTendered || 0) < totals.grandTotal) || creditUnavailable}
                onClick={() => {
                    checkoutIntentRef.current = 'complete';
                }}
                sx={{
                    width: { xs: '100%', sm: 'auto' },
                    minWidth: 0,
                    minHeight: { xs: 48, sm: 36 },
                    px: { xs: 1, sm: 2 },
                    whiteSpace: 'normal',
                    lineHeight: 1.2,
                    '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
                }}
            >
                {tp('Complete Sale')}
            </Button>
        </>
    );

    const shiftError = (...keys) => {
        for (const key of keys) {
            const value = errors[key] ?? pageErrors[key];
            if (Array.isArray(value) && value.length) return value.join(' ');
            if (typeof value === 'string' && value) return value;
        }
        return '';
    };
    const openShiftGeneralError = shiftError('shift', 'request', 'location_id');
    const openShiftRegisterError = shiftError('register_id');
    const openShiftCashError = shiftError('opening_cash');
    const openShiftNotesError = shiftError('notes');
    const closeShiftGeneralError = shiftError('shift', 'request');
    const closeShiftCashError = shiftError('counted_cash');
    const closeShiftNotesError = shiftError('notes');
    const shiftDialogErrorKeys = new Set(['shift', 'request', 'location_id', 'register_id', 'opening_cash', 'counted_cash', 'notes']);
    const visiblePageErrors = Object.entries({ ...pageErrors, ...errors }).filter(
        ([key]) => !(openShiftDialogOpen || closeShiftOpen) || !shiftDialogErrorKeys.has(key),
    );

    return (
        <Box
            className="app-root pos-console"
            style={{
                '--color-primary': theme.palette.primary.main,
                '--color-primary-dark': theme.palette.primary.dark,
                '--color-primary-soft': alpha(theme.palette.primary.main, 0.11),
                '--pos-primary': theme.palette.primary.main,
                '--pos-primary-strong': theme.palette.primary.dark,
                '--pos-primary-soft': alpha(theme.palette.primary.main, 0.11),
                '--pos-bg': alpha(theme.palette.primary.main, 0.055),
            }}
            sx={{
                minHeight: '100vh',
                background: (theme) => `
                    radial-gradient(circle at 12% 0%, ${alpha(theme.palette.primary.main, 0.16)} 0, transparent 28%),
                    linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.9)} 0%, ${alpha(theme.palette.primary.main, 0.07)} 48%, ${theme.palette.background.paper} 100%)
                `,
                display: 'flex',
                flexDirection: 'column',
                overflow: { xs: 'auto', md: 'hidden' },
            }}
        >
            <Head title={tp('POS')} />

            <Box
                component="header"
                className={`admin-topbar glass pos-console__titlebar ${mobileAppBarExpanded ? 'is-mobile-expanded' : 'is-mobile-collapsed'}`}
                sx={{
                    minHeight: 52,
                    px: { xs: 1.5, md: 2 },
                    py: 0.75,
                    bgcolor: 'background.paper',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    flexWrap: 'wrap',
                    flexShrink: 0,
                }}
            >
                <Stack className="pos-console__brand" direction="row" spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
                    <CheckoutIcon color="primary" fontSize="small" />
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                            {tp('POS Interface')}
                        </Typography>
                    </Box>
                </Stack>
                <Typography className="pos-console__mobile-location-summary" variant="caption" title={location?.name || tp('Warehouse')} noWrap>
                    {location?.name || tp('Warehouse')}
                </Typography>
                <Stack direction="row" spacing={0.75} className="pos-console__location" sx={{ alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {tp('Warehouse')}
                    </Typography>
                    <TextField
                        select
                        size="small"
                        value={locationId}
                        onChange={(event) => setLocationId(event.target.value)}
                        disabled={Boolean(activeShift)}
                        inputProps={{ 'aria-label': tp('Warehouse') }}
                        sx={{ width: { xs: '100%', sm: 190 }, maxWidth: '100%' }}
                    >
                        {locations.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
                    </TextField>
                </Stack>
                <Box className="pos-console__titlebar-spacer" sx={{ flex: 1 }} />
                {activeShift && (
                    <Button size="small" color="success" variant="outlined" onClick={showCloseShiftDialog}>
                        {tp('Shift open')} · {activeShift.register?.code}
                    </Button>
                )}
                {!shiftLoading && !activeShift && (
                    <Button size="small" variant="contained" onClick={showOpenShiftDialog}>
                        {tp('Open shift')}
                    </Button>
                )}
                <Chip className="pos-console__online-status" size="small" color={isOnline ? 'success' : 'error'} label={isOnline ? tp('Online') : tp('Offline')} variant="outlined" />
                <LanguageSwitcher compact className="admin-language-switcher" />
                <Button className="pos-console__dashboard-link" size="small" variant="text" component={Link} href={routeWithBase('/admin/dashboard', app_base)}>
                    {t('admin.items.dashboard', 'Dashboard')}
                </Button>
                <IconButton
                    className="pos-console__appbar-toggle"
                    size="small"
                    aria-label={mobileAppBarExpanded ? tp('Collapse app bar') : tp('Expand app bar')}
                    aria-expanded={mobileAppBarExpanded}
                    onClick={() => setMobileAppBarExpanded((expanded) => !expanded)}
                >
                    {mobileAppBarExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
            </Box>

            <Box
                component="main"
                className="pos-console__body"
                sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    p: { xs: 1, md: 1.25 },
                    overflow: { xs: 'visible', md: 'hidden' },
                    '& .MuiPaper-root': { borderRadius: 1, boxShadow: 'none' },
                }}
            >
                {(!shiftLoading && !activeShift) || flash?.success || flash?.error || message || visiblePageErrors.length > 0 ? (
                    <Stack className="pos-console__notices" spacing={0.5}>
                        {!shiftLoading && !activeShift && (
                            <Alert
                                severity="warning"
                                action={(
                                    <Button color="inherit" size="small" onClick={showOpenShiftDialog}>
                                        {tp('Open shift')}
                                    </Button>
                                )}
                            >
                                {tp('Open a cash shift before making a sale.')}
                            </Alert>
                        )}
                        {flash?.success && <Alert severity="success">{flash.success}</Alert>}
                        {flash?.error && <Alert severity="error">{flash.error}</Alert>}
                        {message && <Alert severity="success" onClose={() => setMessage('')}>{message}</Alert>}
                        {visiblePageErrors.map(([key, value]) => (
                            <Alert severity="error" key={key}>
                                {Array.isArray(value) ? value.join(' ') : value}
                            </Alert>
                        ))}
                    </Stack>
                ) : null}

                <Paper
                    className="pos-console__mobile-tabs"
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        mb: 1,
                        p: 0.75,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                    }}
                >
                    <ToggleButtonGroup
                        fullWidth
                        exclusive
                        size="small"
                        value={mobileStep}
                        onChange={(event, next) => next && setMobileStep(next)}
                    >
                        <ToggleButton value="products" sx={{ textTransform: 'none', fontWeight: 800 }}>
                            {tp('Products')}
                        </ToggleButton>
                        <ToggleButton value="cart" sx={{ textTransform: 'none', fontWeight: 800 }}>
                            {tp('Cart')} ({cart.length})
                        </ToggleButton>
                        <ToggleButton value="checkout" disabled={cart.length === 0} sx={{ textTransform: 'none', fontWeight: 800 }}>
                            {tp('Checkout')}
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Paper>

                <Box
                    className="pos-console__workspace"
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 0.8fr) minmax(0, 1.2fr)' },
                        gap: 1.25,
                        alignItems: 'stretch',
                        flex: { xs: '0 0 auto', md: '1 1 auto' },
                        height: { xs: 'auto', md: 'auto' },
                        minHeight: 0,
                    }}
                >
                    <Paper className="pos-console__catalog" sx={{ p: { xs: 1.25, md: 1.35 }, width: '100%', height: { xs: 'auto', md: '100%' }, display: { xs: mobileStep === 'products' ? 'flex' : 'none', md: 'flex' }, flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', borderTop: '2px solid', borderTopColor: 'primary.main' }}>
                        <Stack className="pos-console__catalog-header" direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Stack className="pos-console__catalog-title" direction="row" spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
                                <ScanIcon color="primary" fontSize="small" />
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    {tp('Product Selection')}
                                </Typography>
                            </Stack>
                            <Box sx={{ flex: 1 }} />
                            <Stack className="pos-console__price-mode" direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                                <TextField
                                    select
                                    size="small"
                                    label={tp('Price type')}
                                    value={salePriceType}
                                    onChange={(event) => changeSalePriceType(event.target.value)}
                                >
                                    {availablePriceTypes.map((priceType) => <MenuItem key={priceType} value={priceType}>{tp(priceType.replaceAll('_', ' '))}</MenuItem>)}
                                </TextField>
                            </Stack>
                        </Stack>

                        {scanError && (
                            <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setScanError('')}>
                                {scanError}
                            </Alert>
                        )}

                        <Stack className="pos-console__catalog-search" direction="row" spacing={1}>
                            <TextField
                                fullWidth
                                size="small"
                                inputRef={searchInputRef}
                                placeholder={tp('Scan barcode or search product...')}
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        fetchSearch({ autoAddFirst: true, clearInputAfterSearch: true });
                                    }
                                }}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    },
                                    htmlInput: { enterKeyHint: 'search' },
                                }}
                            />
                            <Button variant="contained" size="small" onClick={() => fetchSearch()} disabled={searchLoading} sx={{ minWidth: 110 }}>
                                {tp('Search')}
                            </Button>
                        </Stack>

                        <Stack
                            className="pos-console__categories"
                            direction="row"
                            spacing={0.5}
                            sx={{
                                mt: 1.25,
                                mb: 0.35,
                                alignItems: 'center',
                            }}
                        >
                            <IconButton
                                size="small"
                                aria-label={tp('Scroll categories left')}
                                onClick={() => scrollCategories(-1)}
                                sx={{
                                    width: 26,
                                    height: 28,
                                    p: 0,
                                    flexShrink: 0,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                }}
                            >
                                <ChevronLeftIcon fontSize="small" />
                            </IconButton>
                            <Box
                                ref={categoryScrollRef}
                                sx={{
                                    flex: 1,
                                    minWidth: 0,
                                    px: 0.5,
                                    py: 0.25,
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                    '&::-webkit-scrollbar': { display: 'none' },
                                }}
                            >
                                <RadioGroup
                                    row
                                    value={String(categoryId)}
                                    onChange={(event) => setCategoryId(event.target.value)}
                                    sx={{
                                        flexWrap: 'nowrap',
                                        gap: 0.85,
                                        minWidth: 'max-content',
                                        width: 'max-content',
                                        '& .MuiFormControlLabel-root': {
                                            mr: 0,
                                            ml: 0,
                                            px: 1,
                                            pr: 1.25,
                                            height: 28,
                                            minWidth: 'fit-content',
                                            flexShrink: 0,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            bgcolor: 'background.paper',
                                            borderRadius: 1,
                                        },
                                        '& .MuiFormControlLabel-root:has(.Mui-checked)': {
                                            borderColor: 'primary.main',
                                            bgcolor: 'rgba(10, 23, 91, 0.06)',
                                        },
                                        '& .MuiFormControlLabel-label': {
                                            fontSize: 13,
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap',
                                        },
                                        '& .MuiRadio-root': {
                                            p: 0.25,
                                            mr: 0.25,
                                        },
                                    }}
                                >
                                    <FormControlLabel value="" control={<Radio size="small" />} label={tp('All')} />
                                    {categories.map((item) => (
                                        <FormControlLabel key={item.id} value={String(item.id)} control={<Radio size="small" />} label={item.name} />
                                    ))}
                                </RadioGroup>
                            </Box>
                            <IconButton
                                size="small"
                                aria-label={tp('Scroll categories right')}
                                onClick={() => scrollCategories(1)}
                                sx={{
                                    width: 26,
                                    height: 28,
                                    p: 0,
                                    flexShrink: 0,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                }}
                            >
                                <ChevronRightIcon fontSize="small" />
                            </IconButton>
                        </Stack>

                        {cart.length > 0 && (
                            <Box className="pos-console__selected-strip" sx={{ display: { xs: 'block', md: 'none' }, mt: 0.75 }}>
                                <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.75, alignItems: 'center' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                                        {tp('Selected products')}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>
                                        {cart.length} {cart.length === 1 ? tp('item') : tp('items')}
                                    </Typography>
                                </Stack>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        gap: 1,
                                        overflowX: 'auto',
                                        overflowY: 'hidden',
                                        pb: 0.75,
                                        scrollbarWidth: 'none',
                                        msOverflowStyle: 'none',
                                        '&::-webkit-scrollbar': { display: 'none' },
                                    }}
                                >
                                    {cart.map((line) => {
                                        const lineTotal = calculateLineTotal(line);

                                        return (
                                            <Box
                                                className="pos-console__selected-card"
                                                key={line.id}
                                                sx={{
                                                    width: 176,
                                                    minWidth: 176,
                                                    display: 'grid',
                                                    gridTemplateColumns: '48px minmax(0, 1fr) 28px',
                                                    gap: 0.75,
                                                    alignItems: 'center',
                                                    p: 0.75,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    bgcolor: 'background.paper',
                                                }}
                                            >
                                                <Box
                                                    className="pos-console__selected-image"
                                                    sx={{
                                                        width: 48,
                                                        height: 48,
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        bgcolor: 'action.hover',
                                                        overflow: 'hidden',
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                    }}
                                                >
                                                    {line.image_path ? (
                                                        <Box component="img" src={storageUrl(line.image_path, app_url)} alt="" loading="lazy" decoding="async" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, fontWeight: 800, textAlign: 'center', px: 0.25 }}>
                                                            {line.product_code || tp('No image')}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography variant="caption" title={line.name} sx={{ display: 'block', fontWeight: 800, lineHeight: 1.12 }} noWrap>
                                                        {line.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                                                        x{line.quantity} - {money(lineTotal)}{Number(line.foc_quantity || 0) > 0 ? ` + ${tp('FOC')} ${line.foc_quantity}` : ''}
                                                    </Typography>
                                                </Box>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    aria-label={`${tp('Remove item')} ${line.name}`}
                                                    onClick={() => removeCartLine(line.id)}
                                                    sx={{ width: 28, height: 28, alignSelf: 'start' }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Box>
                        )}

                        <Divider sx={{ my: 1.25 }} />

                        <Stack className="pos-console__results-meta" direction="row" justifyContent="space-between" spacing={1} sx={{ alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                {resultHeading}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {searchLoading && searchResults.length === 0 ? tp('Loading...') : `${searchResults.length} ${tp('shown')}`}
                            </Typography>
                        </Stack>

                        <TableContainer className="pos-console__product-table" ref={setProductResultsElement} sx={{ mt: 1, flex: 1, minHeight: 0, overflow: 'auto' }}>
                                <Table
                                    size="small"
                                    stickyHeader
                                    sx={{
                                        tableLayout: 'fixed',
                                        '& .MuiTableCell-root': { px: 0.75, py: 0.55 },
                                        '& .MuiTableCell-head': { py: 0.55, fontSize: 12 },
                                    }}
                                >
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'light' ? 'grey.50' : 'rgba(255,255,255,.05)' }}>
                                            <TableCell sx={{ fontWeight: 700 }}>{tp('Product')}</TableCell>
                                            <TableCell sx={{ fontWeight: 700, width: 135 }} align="right">{tp('Price')}</TableCell>
                                            <TableCell sx={{ fontWeight: 700, width: 72 }} align="right">{tp('Available')}</TableCell>
                                            <TableCell sx={{ fontWeight: 700, width: 44 }} align="center">{tp('Add')}</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {virtualTopSpacer > 0 && (
                                            <TableRow aria-hidden="true">
                                                <TableCell colSpan={4} sx={{ p: 0, height: virtualTopSpacer, border: 0 }} />
                                            </TableRow>
                                        )}
                                        {visibleTableProducts.map((product) => {
                                            const outOfStock = Number(product.available_qty || 0) <= 0;
                                            return (
                                                <TableRow key={product.id} hover sx={outOfStock ? { bgcolor: 'rgba(211, 47, 47, 0.08)' } : undefined}>
                                                    <TableCell>
                                                        <Stack className="pos-console__product-cell" direction="row" spacing={0.75}>
                                                            <Box className="pos-console__list-thumbnail">
                                                                {product.image_path ? (
                                                                    <Box
                                                                        component="img"
                                                                        src={storageUrl(product.image_path, app_url)}
                                                                        alt=""
                                                                        loading="lazy"
                                                                        decoding="async"
                                                                    />
                                                                ) : (
                                                                    <ImagePlaceholderIcon aria-hidden="true" />
                                                                )}
                                                            </Box>
                                                            <Box className="pos-console__product-copy">
                                                                <Typography variant="body2" noWrap title={getProductDisplayName(product)}>{getProductDisplayName(product)}</Typography>
                                                                <Typography variant="caption" color="text.secondary" noWrap>{product.product_code || '-'} · {product.unit_code || product.unit_name}</Typography>
                                                                <Typography className="pos-console__mobile-product-meta" variant="caption" color="text.secondary" noWrap>
                                                                    {money(resolveProductPrice(product))} · {product.available_qty} {tp('available')}
                                                                </Typography>
                                                            </Box>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell className="pos-console__product-price" align="right">
                                                        <Typography variant="body2" noWrap>{money(resolveProductPrice(product))}</Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2" sx={{ fontWeight: 700, color: outOfStock ? 'error.main' : 'inherit' }}>{product.available_qty}</Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <IconButton size="small" color={outOfStock ? 'error' : 'primary'} disabled={outOfStock} onClick={() => addProductToCart(product)} sx={{ width: 30, height: 30 }}>
                                                            <AddIcon fontSize="small" />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {virtualBottomSpacer > 0 && (
                                            <TableRow aria-hidden="true">
                                                <TableCell colSpan={4} sx={{ p: 0, height: virtualBottomSpacer, border: 0 }} />
                                            </TableRow>
                                        )}
                                        {resultMeta.has_more && (
                                            <TableRow ref={productLoadMoreSentinelRef} className="pos-console__load-sentinel" aria-hidden="true">
                                                <TableCell colSpan={4} sx={{ p: 0, height: 1, border: 0 }} />
                                            </TableRow>
                                        )}
                                        {searchResults.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} align="center" sx={{ py: 2 }}>
                                                    <Typography variant="body2" color="text.secondary">{tp('Search products or scan a barcode to add items.')}</Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                        </TableContainer>

                        {searchLoading && searchResults.length > 0 && (
                            <Stack
                                className="pos-console__infinite-status"
                                direction="row"
                                spacing={0.75}
                                role="status"
                                aria-live="polite"
                            >
                                <CircularProgress size={13} thickness={5} />
                                <Typography variant="caption">{tp('Loading products...')}</Typography>
                            </Stack>
                        )}

                    </Paper>

                    <Paper className="pos-console__cart" sx={{ p: { xs: 1.15, md: 1.25 }, width: '100%', height: { xs: 'auto', md: '100%' }, display: { xs: mobileStep === 'cart' ? 'flex' : 'none', md: 'flex' }, flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', borderTop: '2px solid', borderTopColor: 'success.main' }}>
                        <Box className="pos-console__cart-header" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', columnGap: 1, width: '100%' }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{tp('Current Sale')}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    {cart.length} {cart.length === 1 ? tp('item') : tp('items')} {tp('from')} {location?.name || tp('warehouse')}
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} sx={{ justifySelf: 'end', flexShrink: 0, alignItems: 'center' }}>
                                {hasAlternatePriceItems && (
                                    <Chip size="small" color="warning" variant="outlined" label={tp('Alternate pricing')} />
                                )}
                                {focLineCount > 0 && (
                                    <Chip size="small" color="info" variant="outlined" icon={<FocIcon />} label={`${focLineCount} ${tp('FOC')}`} />
                                )}
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<CheckoutIcon />}
                                    disabled={busy || !isOnline || !locationId || cart.length === 0 || hasStockIssue}
                                    onClick={openPaymentDialog}
                                    sx={{ minWidth: 128, fontWeight: 800 }}
                                >
                                    {tp('Sell')} {money(totals.grandTotal)}
                                </Button>
                            </Stack>
                        </Box>

                        <Divider className="pos-console__cart-divider" sx={{ my: 1 }} />

                        <Typography className="pos-console__cart-label" variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{tp('Cart')}</Typography>

                        <div className="pos-items">
                            {cart.map(line => <PosCartItem key={line.id} line={line} money={money} t={tp}
                                exceedsStock={lineExceedsStock(line)} canFoc={can.discount}
                                onQuantity={quantity => updateCartLine(line.id, { quantity })}
                                onStep={delta => adjustCartQuantity(line.id, delta)}
                                onUnit={unit => changeCartUnit(line.id, unit)}
                                onFocQuantity={(quantity, normalize) => changeCartFocQuantity(line.id, quantity, normalize)}
                                onFocUnit={unit => changeCartFocUnit(line.id, unit)}
                                onRemove={() => removeCartLine(line.id)} />)}
                            {!cart.length && <div className="pos-console__cart-empty">{tp('Cart is empty.')}</div>}
                        </div>

                    </Paper>

                    <Paper
                        className="pos-console__checkout-mobile"
                        component="form"
                        onSubmit={checkout}
                        sx={{
                            p: 1.25,
                            width: '100%',
                            display: { xs: mobileStep === 'checkout' ? 'flex' : 'none', md: 'none' },
                            flexDirection: 'column',
                            gap: 1.25,
                            borderTop: '2px solid',
                            borderTopColor: 'warning.main',
                        }}
                    >
                        <Stack className="pos-console__checkout-header" direction="row" justifyContent="space-between" spacing={1} sx={{ alignItems: 'center' }}>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{tp('Final Checkout')}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {cart.length} {cart.length === 1 ? tp('item') : tp('items')} - {location?.name || tp('warehouse')}
                                </Typography>
                            </Box>
                            <Chip size="small" color="primary" label={money(totals.grandTotal)} />
                        </Stack>

                        {paymentFormContent}

                        <Stack className="pos-console__checkout-actions" spacing={1} sx={{ pt: 0.5, width: '100%', minWidth: 0 }}>
                            <Button
                                type="button"
                                variant="outlined"
                                fullWidth
                                onClick={() => setMobileStep('cart')}
                                disabled={busy}
                                sx={{ minHeight: 46, fontWeight: 800 }}
                            >
                                {tp('Back to Cart')}
                            </Button>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                                    gap: 1,
                                    width: '100%',
                                    minWidth: 0,
                                    '& .MuiButton-root': {
                                        fontWeight: 800,
                                        overflow: 'hidden',
                                        textAlign: 'center',
                                    },
                                }}
                            >
                                {completeSaleButtons}
                            </Box>
                        </Stack>
                    </Paper>
                </Box>
            </Box>

            <Dialog
                open={paymentDialogOpen}
                onClose={() => !busy && setPaymentDialogOpen(false)}
                maxWidth={false}
                slotProps={{
                    paper: {
                        className: 'pos-console__payment-dialog pos-console__shift-dialog',
                        style: {
                            '--pos-primary': theme.palette.primary.main,
                            '--pos-primary-strong': theme.palette.primary.dark,
                            '--pos-primary-soft': alpha(theme.palette.primary.main, 0.11),
                            '--color-primary': theme.palette.primary.main,
                            '--color-primary-dark': theme.palette.primary.dark,
                            '--color-primary-soft': alpha(theme.palette.primary.main, 0.11),
                            '--color-surface': theme.palette.background.paper,
                            '--color-soft': theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.045) : theme.palette.grey[50],
                            '--color-border': theme.palette.divider,
                            '--color-text': theme.palette.text.primary,
                            '--color-muted': theme.palette.text.secondary,
                        },
                        sx: {
                            width: 'min(520px, calc(100vw - 24px))',
                            maxWidth: 520,
                            borderRadius: 1.5,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                            boxShadow: '0 18px 48px rgba(10, 19, 24, 0.20), 0 3px 10px rgba(10, 19, 24, 0.08)',
                            maxHeight: 'calc(100dvh - 24px)',
                            overflow: 'hidden',
                        },
                    },
                }}
            >
                <Box className="pos-console__payment-window" component="form" onSubmit={checkout}>
                    <DialogTitle
                        className="pos-console__payment-titlebar pos-console__shift-titlebar"
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 1.25,
                            minHeight: 44,
                            height: 44,
                            px: 1.25,
                            py: 0,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            bgcolor: 'background.paper',
                        }}
                    >
                        <Stack direction="row" spacing={1.25} sx={{ minWidth: 0 }}>
                            <Box className="pos-console__shift-title-icon">
                                <CheckoutIcon sx={{ fontSize: 16 }} />
                            </Box>
                            <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', minHeight: 28 }}>
                                <Typography component="h2" className="pos-console__shift-title">
                                    {tp('Complete Sale')}
                                </Typography>
                            </Box>
                        </Stack>
                        <IconButton size="small" sx={{ width: 28, height: 28 }} onClick={() => setPaymentDialogOpen(false)} disabled={busy}>
                            <CloseIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent className="pos-console__payment-body pos-console__shift-body" sx={{ p: 1.25, bgcolor: 'grey.50', overflowY: 'auto' }}>
                        {paymentFormContent}
                    </DialogContent>
                    <DialogActions className="pos-console__payment-actions pos-console__shift-actions" sx={{ flexWrap: 'wrap', gap: 0.75, px: 1.25, py: 1, borderTop: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
                        <Button type="button" variant="outlined" onClick={() => setPaymentDialogOpen(false)} disabled={busy}>{tp('Cancel')}</Button>
                        {completeSaleButtons}
                    </DialogActions>
                </Box>
            </Dialog>

            <Dialog
                open={openShiftDialogOpen && !activeShift}
                onClose={hideOpenShiftDialog}
                aria-labelledby="pos-open-shift-title"
                maxWidth={false}
                slotProps={{
                    paper: {
                        className: 'pos-console__shift-dialog',
                        style: {
                            '--color-primary': theme.palette.primary.main,
                            '--color-primary-dark': theme.palette.primary.dark,
                            '--color-primary-soft': alpha(theme.palette.primary.main, 0.11),
                            '--color-surface': theme.palette.background.paper,
                            '--color-soft': theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.045) : theme.palette.grey[50],
                            '--color-border': theme.palette.divider,
                            '--color-text': theme.palette.text.primary,
                            '--color-muted': theme.palette.text.secondary,
                        },
                    },
                    backdrop: { sx: { bgcolor: 'rgba(10, 19, 24, 0.35)' } },
                }}
            >
                <Box className="pos-console__shift-window" component="form" onSubmit={openShift}>
                    <DialogTitle id="pos-open-shift-title" className="pos-console__shift-titlebar">
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                            <Box className="pos-console__shift-title-icon"><ShiftIcon /></Box>
                            <Typography component="span" className="pos-console__shift-title">{tp('Open shift')}</Typography>
                        </Stack>
                        <IconButton size="small" aria-label={tp('Close')} onClick={hideOpenShiftDialog} disabled={shiftBusy}>
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent className="pos-console__shift-body" dividers>
                        <Stack spacing={1.25}>
                            <Alert severity="info">{tp('An open shift is required before making POS sales.')}</Alert>
                            {openShiftGeneralError && <Alert severity="error">{openShiftGeneralError}</Alert>}
                            <Box className="pos-console__shift-context">
                                <Typography variant="caption">{tp('Warehouse')}</Typography>
                                <Typography variant="body2">{location?.name || tp('No warehouse selected')}</Typography>
                            </Box>
                            <TextField
                                select
                                required
                                size="small"
                                label={tp('POS register')}
                                value={registerId}
                                onChange={(event) => setRegisterId(event.target.value)}
                                fullWidth
                                error={!locationRegisters.length || Boolean(openShiftRegisterError)}
                                helperText={openShiftRegisterError || (!locationRegisters.length ? tp('Create or activate a POS register for this warehouse first.') : '')}
                            >
                                {locationRegisters.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.code}</MenuItem>)}
                            </TextField>
                            <TextField
                                required
                                autoFocus
                                size="small"
                                type="number"
                                label={tp('Opening cash')}
                                value={openingCash}
                                onChange={(event) => setOpeningCash(event.target.value)}
                                error={Boolean(openShiftCashError)}
                                helperText={openShiftCashError || tp('Enter the cash physically available in the drawer.')}
                                slotProps={{
                                    htmlInput: { min: 0, step: 100 },
                                    input: { endAdornment: <InputAdornment position="end">MMK</InputAdornment> },
                                }}
                                fullWidth
                            />
                            <TextField
                                size="small"
                                label={tp('Opening note')}
                                value={openingNotes}
                                onChange={(event) => setOpeningNotes(event.target.value)}
                                error={Boolean(openShiftNotesError)}
                                helperText={openShiftNotesError}
                                inputProps={{ maxLength: 500 }}
                                multiline
                                minRows={2}
                                fullWidth
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions className="pos-console__shift-actions">
                        {!locationRegisters.length && can.manageRegisters && (
                            <Button variant="outlined" component={Link} href={routeWithBase('/admin/registers', app_base)}>{tp('Manage registers')}</Button>
                        )}
                        <Box sx={{ flex: 1 }} />
                        <Button type="button" variant="outlined" onClick={hideOpenShiftDialog} disabled={shiftBusy}>{tp('Cancel')}</Button>
                        <Button type="submit" variant="contained" startIcon={<ShiftIcon />} disabled={shiftBusy || !registerId || openingCash === ''}>{shiftBusy ? tp('Opening...') : tp('Open shift')}</Button>
                    </DialogActions>
                </Box>
            </Dialog>

            <Dialog
                open={closeShiftOpen}
                onClose={hideCloseShiftDialog}
                aria-labelledby="pos-close-shift-title"
                maxWidth={false}
                slotProps={{
                    paper: {
                        className: 'pos-console__shift-dialog',
                        style: {
                            '--color-primary': theme.palette.primary.main,
                            '--color-primary-dark': theme.palette.primary.dark,
                            '--color-primary-soft': alpha(theme.palette.primary.main, 0.11),
                            '--color-surface': theme.palette.background.paper,
                            '--color-soft': theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.045) : theme.palette.grey[50],
                            '--color-border': theme.palette.divider,
                            '--color-text': theme.palette.text.primary,
                            '--color-muted': theme.palette.text.secondary,
                        },
                    },
                    backdrop: { sx: { bgcolor: 'rgba(10, 19, 24, 0.35)' } },
                }}
            >
                <Box className="pos-console__shift-window" component="form" onSubmit={closeShift}>
                    <DialogTitle id="pos-close-shift-title" className="pos-console__shift-titlebar">
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                            <Box className="pos-console__shift-title-icon"><ShiftIcon /></Box>
                            <Typography component="span" className="pos-console__shift-title">{tp('Close shift')}</Typography>
                        </Stack>
                        <IconButton size="small" aria-label={tp('Close')} onClick={hideCloseShiftDialog} disabled={shiftBusy}>
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent className="pos-console__shift-body" dividers>
                        <Stack spacing={1.25}>
                            {closeShiftGeneralError && <Alert severity="error">{closeShiftGeneralError}</Alert>}
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                <Paper variant="outlined" sx={{ p: 1.25 }}><Typography variant="caption" color="text.secondary">{tp('Opening cash')}</Typography><Typography fontWeight={800}>{money(activeShift?.opening_cash || 0)}</Typography></Paper>
                                <Paper variant="outlined" sx={{ p: 1.25 }}><Typography variant="caption" color="text.secondary">{tp('Expected cash')}</Typography><Typography fontWeight={800}>{money(activeShift?.expected_cash || 0)}</Typography></Paper>
                                <Paper variant="outlined" sx={{ p: 1.25 }}><Typography variant="caption" color="text.secondary">{tp('Cash received')}</Typography><Typography fontWeight={800}>{money(activeShift?.cash_received_total || 0)}</Typography></Paper>
                                <Paper variant="outlined" sx={{ p: 1.25 }}><Typography variant="caption" color="text.secondary">{tp('Change given')}</Typography><Typography fontWeight={800}>{money(activeShift?.change_given_total || 0)}</Typography></Paper>
                            </Box>
                            <TextField
                                required
                                autoFocus
                                size="small"
                                type="number"
                                label={tp('Counted cash')}
                                value={countedCash}
                                onChange={(event) => setCountedCash(event.target.value)}
                                error={Boolean(closeShiftCashError)}
                                helperText={closeShiftCashError || tp('Enter the cash physically counted in the drawer.')}
                                slotProps={{
                                    htmlInput: { min: 0, step: 100 },
                                    input: { endAdornment: <InputAdornment position="end">MMK</InputAdornment> },
                                }}
                                fullWidth
                            />
                            <TextField
                                size="small"
                                label={tp('Closing note')}
                                value={closingNotes}
                                onChange={(event) => setClosingNotes(event.target.value)}
                                error={Boolean(closeShiftNotesError)}
                                helperText={closeShiftNotesError}
                                inputProps={{ maxLength: 500 }}
                                multiline
                                minRows={2}
                                fullWidth
                            />
                            {countedCash !== '' && <Alert severity={Math.abs(Number(countedCash) - Number(activeShift?.expected_cash || 0)) < 0.01 ? 'success' : Number(countedCash) > Number(activeShift?.expected_cash || 0) ? 'warning' : 'error'}>{tp('Difference')}: {money(Number(countedCash) - Number(activeShift?.expected_cash || 0))}</Alert>}
                        </Stack>
                    </DialogContent>
                    <DialogActions className="pos-console__shift-actions">
                        <Box sx={{ flex: 1 }} />
                        <Button type="button" variant="outlined" onClick={hideCloseShiftDialog} disabled={shiftBusy}>{tp('Cancel')}</Button>
                        <Button type="submit" color="error" variant="contained" disabled={shiftBusy || countedCash === ''}>{shiftBusy ? tp('Closing...') : tp('Confirm close')}</Button>
                    </DialogActions>
                </Box>
            </Dialog>

            <Dialog open={Boolean(receipt)} onClose={() => setReceipt(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {tp('Sale complete')}
                    <IconButton size="small" onClick={() => setReceipt(null)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={1}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>{receipt?.order?.receipt_number}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {tp('Total')} {money(receipt?.order?.final_amount)}
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    {receipt?.receipt_url && <Button variant="contained" component="a" href={receipt.receipt_url}>{tp('Open receipt')}</Button>}
                </DialogActions>
            </Dialog>

            <Dialog open={customerDialogOpen} onClose={() => !customerCreating && setCustomerDialogOpen(false)} maxWidth="xs" fullWidth>
                <Box component="form" onSubmit={createCustomer}>
                    <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {tp('New customer')}
                        <IconButton size="small" onClick={() => setCustomerDialogOpen(false)} disabled={customerCreating}><CloseIcon /></IconButton>
                    </DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                            {customerCreateErrors.request && <Alert severity="error">{customerCreateErrors.request}</Alert>}
                            <TextField required autoFocus label={tp('Customer name')} value={newCustomer.name} onChange={(event) => setNewCustomer((current) => ({ ...current, name: event.target.value }))} error={Boolean(customerCreateErrors.name)} helperText={customerCreateErrors.name?.[0]} fullWidth />
                            <TextField required type="email" label={tp('Email address')} value={newCustomer.email} onChange={(event) => setNewCustomer((current) => ({ ...current, email: event.target.value }))} error={Boolean(customerCreateErrors.email)} helperText={customerCreateErrors.email?.[0] || tp('Customer can use this email to activate or reset their password.')} fullWidth />
                            <TextField label={tp('Phone number (optional)')} value={newCustomer.phone} onChange={(event) => setNewCustomer((current) => ({ ...current, phone: event.target.value }))} error={Boolean(customerCreateErrors.phone)} helperText={customerCreateErrors.phone?.[0]} fullWidth />
                            <Alert severity="info">{tp('Credit is disabled by default. An authorized admin can enable it from the customer account.')}</Alert>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button type="button" onClick={() => setCustomerDialogOpen(false)} disabled={customerCreating}>{tp('Cancel')}</Button>
                        <Button type="submit" variant="contained" disabled={customerCreating || !newCustomer.name.trim() || !newCustomer.email.trim()}>{customerCreating ? tp('Creating...') : tp('Create & select')}</Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
}
import PosCartItem from '@/Components/Admin/PosCartItem';
