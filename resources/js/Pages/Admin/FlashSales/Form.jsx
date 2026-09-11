import { useMemo, useRef, useState } from "react";
import { Head, Link, useForm, usePage } from "@/spa/router";
import AdminLayout from "@/Layouts/AdminLayout";
import Icon from "@/Components/Admin/icons";
import { AdminFlash } from "@/Components/Admin/AdminFlash";
import { PanelHeading } from "@/Components/Admin/shared";
import { routeWithBase } from "@/Utils/url";
import { usePhraseTranslation } from "@/Utils/i18n";
import { formatMoney } from "@/Utils/pricing";
import { formatErrorMessage } from "@/Utils/formatErrorMessage";
import { formatSelectedUnitQuantity, formatUnitWithConversion } from "@/Utils/unitLabel";

const steps = [
    { key: "basic", label: "Basic" },
    { key: "products", label: "Products" },
    { key: "pricing", label: "Sale data" },
    { key: "review", label: "Review" },
];
const toDateInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
};
const dateToIsoMidnight = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
        ? new Date(`${value}T00:00:00`).toISOString()
        : null;
const initialData = (sale) => ({
    name: sale?.name || "",
    starts_at: toDateInput(sale?.starts_at),
    ends_at: toDateInput(sale?.ends_at),
    is_active: sale ? Boolean(sale.is_active) : true,
    items: (sale?.items || []).map((item) => ({
        product_unit_id: item.product_unit_id,
        discount_type: item.discount_type || "percentage",
        discount_value: item.discount_value ?? "",
        quantity_limit: item.quantity_limit ?? "",
        sold_count: Number(item.sold_count || 0),
    })),
});
const salePriceFor = (unit, item) => {
    const original = Number(unit?.price || 0);
    const value = Number(item?.discount_value || 0);
    if (
        !original ||
        !value ||
        value <= 0 ||
        (item.discount_type === "percentage" && value >= 100) ||
        (item.discount_type === "fixed_price" && value >= original)
    )
        return null;
    return item.discount_type === "percentage"
        ? original * (1 - value / 100)
        : value;
};
const dateLabel = (value) =>
    value
        ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(
              [],
              { month: "short", day: "numeric", year: "numeric" },
          )
        : "-";
const duration = (start, end) => {
    if (!start || !end) return "-";
    const days = Math.round(
        (new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) /
            86400000,
    );
    return !Number.isFinite(days) || days < 0
        ? "-"
        : days === 0
          ? "Same day"
          : `${days}d`;
};
function FieldError({ message }) {
    return message ? (
        <small className="flash-sale-conflict-message" role="alert">
            {formatErrorMessage(message)}
        </small>
    ) : null;
}
function Stat({ label, value }) {
    const t = usePhraseTranslation();
    return (
        <div className="metric-card" style={{ padding: 12 }}>
            <span>{t(label)}</span>
            <strong>{value}</strong>
        </div>
    );
}
function UnitIdentity({ unit, detail, units = [] }) {
    return (
        <div className="line-product-identity">
            <span className="receipt-product-thumb" aria-hidden="true">
                <Icon name="box" size={16} />
            </span>
            <span>
                <strong>{unit.product_name}</strong>
                <small>{detail || formatUnitWithConversion(unit, units)}</small>
            </span>
        </div>
    );
}

export default function FlashSaleForm({
    productOptions = [],
    flashSale = null,
    mode = "create",
}) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const form = useForm(initialData(flashSale));
    const [tab, setTab] = useState(0);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");
    const campaignNameRef = useRef(null);
    const units = useMemo(
        () =>
            productOptions.flatMap((product) =>
                (product.units || []).map((unit) => ({
                    ...unit,
                    product_id: product.id,
                    product_name: product.name,
                    category: product.category || "",
                    product_units: product.units || [],
                })),
            ),
        [productOptions],
    );
    const unitMap = useMemo(
        () => new Map(units.map((unit) => [Number(unit.id), unit])),
        [units],
    );
    const selectedIds = useMemo(
        () => form.data.items.map((item) => Number(item.product_unit_id)),
        [form.data.items],
    );
    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const selectedItems = useMemo(
        () =>
            form.data.items
                .map((item, index) => ({
                    item,
                    index,
                    unit: unitMap.get(Number(item.product_unit_id)),
                }))
                .filter((row) => row.unit),
        [form.data.items, unitMap],
    );
    const categories = useMemo(
        () =>
            [
                ...new Set(
                    productOptions
                        .map((product) => product.category)
                        .filter(Boolean),
                ),
            ].sort(),
        [productOptions],
    );
    const visibleUnits = useMemo(() => {
        const term = search.trim().toLowerCase();
        return units.filter(
            (unit) =>
                (category === "all" || unit.category === category) &&
                (!term ||
                    [unit.product_name, unit.category, unit.name, unit.code]
                        .join(" ")
                        .toLowerCase()
                        .includes(term)),
        );
    }, [category, search, units]);

    const removeUnit = (id) => {
        const item = form.data.items.find(
            (row) => Number(row.product_unit_id) === Number(id),
        );
        if (Number(item?.sold_count || 0) > 0) return;
        form.clearErrors(
            ...Object.keys(form.errors).filter(
                (key) => key === "items" || key.startsWith("items."),
            ),
        );
        form.setData(
            "items",
            form.data.items.filter(
                (row) => Number(row.product_unit_id) !== Number(id),
            ),
        );
    };
    const toggleUnit = (unit) => {
        if (selectedIdSet.has(Number(unit.id))) return removeUnit(unit.id);
        form.clearErrors(
            ...Object.keys(form.errors).filter(
                (key) => key === "items" || key.startsWith("items."),
            ),
        );
        form.setData("items", [
            ...form.data.items,
            {
                product_unit_id: unit.id,
                discount_type: "percentage",
                discount_value: "",
                quantity_limit: "",
                sold_count: 0,
            },
        ]);
    };
    const updateItem = (id, patch) => {
        const index = form.data.items.findIndex(
            (item) => Number(item.product_unit_id) === Number(id),
        );
        form.setData(
            "items",
            form.data.items.map((item) =>
                Number(item.product_unit_id) === Number(id)
                    ? { ...item, ...patch }
                    : item,
            ),
        );
        if (index >= 0)
            form.clearErrors(
                `items.${index}.discount_type`,
                `items.${index}.discount_value`,
                `items.${index}.quantity_limit`,
            );
    };
    const basicErrors = useMemo(
        () =>
            form.data.starts_at &&
            form.data.ends_at &&
            new Date(`${form.data.ends_at}T00:00:00`) <=
                new Date(`${form.data.starts_at}T00:00:00`)
                ? { ends_at: t("End date must be after the start date.") }
                : {},
        [form.data.ends_at, form.data.starts_at, t],
    );
    const pricingErrors = useMemo(() => {
        const errors = {};
        form.data.items.forEach((item, index) => {
            const unit = unitMap.get(Number(item.product_unit_id));
            const value = Number(item.discount_value);
            const limit =
                item.quantity_limit === "" ? null : Number(item.quantity_limit);
            if (!Number.isFinite(value) || value <= 0)
                errors[`items.${index}.discount_value`] = t(
                    "Enter a discount greater than zero.",
                );
            else if (item.discount_type === "percentage" && value >= 100)
                errors[`items.${index}.discount_value`] = t(
                    "Percentage discount must be less than 100%.",
                );
            else if (
                item.discount_type === "fixed_price" &&
                unit &&
                value >= Number(unit.price)
            )
                errors[`items.${index}.discount_value`] = t(
                    "Fixed sale price must be lower than the unit retail price.",
                );
            if (limit !== null && (!Number.isFinite(limit) || limit <= 0))
                errors[`items.${index}.quantity_limit`] = t(
                    "Quantity limit must be greater than zero.",
                );
            else if (limit !== null && limit < Number(item.sold_count || 0))
                errors[`items.${index}.quantity_limit`] = t(
                    "Quantity limit cannot be lower than units already sold.",
                );
        });
        return errors;
    }, [form.data.items, t, unitMap]);
    const basicComplete = Boolean(
        form.data.name.trim() &&
        form.data.starts_at &&
        form.data.ends_at &&
        !Object.keys(basicErrors).length,
    );
    const productsComplete = basicComplete && form.data.items.length > 0;
    const pricingComplete =
        productsComplete && !Object.keys(pricingErrors).length;
    const canAccess = (index) =>
        index === 0 ||
        (index === 1 && basicComplete) ||
        (index === 2 && productsComplete) ||
        (index === 3 && pricingComplete);
    const canNext =
        tab === 0
            ? basicComplete
            : tab === 1
              ? productsComplete
              : tab === 2
                ? pricingComplete
                : true;
    const serverErrors = (errors) => {
        const first = Object.keys(errors)[0] || "";
        if (["name", "starts_at", "ends_at"].includes(first)) setTab(0);
        else if (first === "items") setTab(1);
        else if (first.startsWith("items.")) setTab(2);
        window.requestAnimationFrame(() =>
            (
                document.querySelector(`[name="${first}"]`) ||
                campaignNameRef.current
            )?.focus(),
        );
    };
    const submit = () => {
        if (!pricingComplete || form.processing) return;
        form.transform((data) => ({
            ...data,
            starts_at: dateToIsoMidnight(data.starts_at),
            ends_at: dateToIsoMidnight(data.ends_at),
            items: data.items.map(({ sold_count, ...item }) => item),
        }));
        const options = { preserveScroll: true, onError: serverErrors };
        mode === "edit"
            ? form.patch(
                  routeWithBase(`/admin/flash-sales/${flashSale.id}`, app_base),
                  options,
              )
            : form.post(routeWithBase("/admin/flash-sales", app_base), options);
    };
    const next = () => canNext && setTab((value) => Math.min(3, value + 1));

    return (
        <AdminLayout
            title={
                mode === "edit" ? t("Edit flash sale") : t("Create flash sale")
            }
            eyebrow={t("Marketing")}
            action={
                <Link
                    href={routeWithBase("/admin/flash-sales", app_base)}
                    className="btn secondary"
                >
                    <Icon name="navigation" size={14} />
                    {t("Back to list")}
                </Link>
            }
        >
            <Head
                title={
                    mode === "edit"
                        ? t("Edit Flash Sale")
                        : t("Create Flash Sale")
                }
            />
            <AdminFlash flash={flash} errors={form.errors} />
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    tab < 3 ? next() : submit();
                }}
                noValidate
            >
                <section className="panel glass">
                    <div className="wizard-toolbar">
                        <div
                            className="tab-bar wizard-stepper"
                            role="tablist"
                            aria-label={t("Flash sale form steps")}
                        >
                            {steps.map((step, index) => (
                                <button
                                    key={step.key}
                                    type="button"
                                    className={
                                        tab === index
                                            ? "active"
                                            : index < tab
                                              ? "is-complete"
                                              : ""
                                    }
                                    disabled={!canAccess(index)}
                                    onClick={() =>
                                        canAccess(index) && setTab(index)
                                    }
                                    aria-current={
                                        tab === index ? "step" : undefined
                                    }
                                >
                                    <span className="wizard-step-number">
                                        {index < tab ? (
                                            <Icon name="check" size={13} />
                                        ) : (
                                            index + 1
                                        )}
                                    </span>
                                    <span className="wizard-step-label">
                                        {t(step.label)}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="wizard-toolbar-actions">
                            <button
                                type="button"
                                className="btn secondary"
                                disabled={tab === 0}
                                onClick={() => setTab((value) => value - 1)}
                            >
                                {t("Previous")}
                            </button>
                            {tab < 3 ? (
                                <button
                                    type="button"
                                    className="btn primary"
                                    disabled={!canNext}
                                    onClick={next}
                                >
                                    {t("Next")}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="btn primary"
                                    disabled={
                                        form.processing || !pricingComplete
                                    }
                                    onClick={submit}
                                >
                                    {form.processing
                                        ? t("Saving...")
                                        : mode === "edit"
                                          ? t("Save flash sale")
                                          : t("Create flash sale")}
                                </button>
                            )}
                        </div>
                    </div>

                    {tab === 0 && (
                        <>
                            <PanelHeading
                                eyebrow={t("Step 1")}
                                title={t("Basic information")}
                            />
                            <div className="crud-grid">
                                <label className="form-field span-2">
                                    <span>{t("Campaign name")}</span>
                                    <input
                                        ref={campaignNameRef}
                                        name="name"
                                        value={form.data.name}
                                        onChange={(e) => {
                                            form.setData(
                                                "name",
                                                e.target.value,
                                            );
                                            form.clearErrors("name");
                                        }}
                                        aria-invalid={Boolean(form.errors.name)}
                                    />
                                    <FieldError message={form.errors.name} />
                                </label>
                                <label className="form-field">
                                    <span>{t("Starts")}</span>
                                    <input
                                        name="starts_at"
                                        type="date"
                                        value={form.data.starts_at}
                                        onChange={(e) => {
                                            form.setData(
                                                "starts_at",
                                                e.target.value,
                                            );
                                            form.clearErrors(
                                                "starts_at",
                                                "ends_at",
                                            );
                                        }}
                                    />
                                    <small className="muted">
                                        {t("Defaults to 12:00 AM")}
                                    </small>
                                    <FieldError
                                        message={form.errors.starts_at}
                                    />
                                </label>
                                <label className="form-field">
                                    <span>{t("Ends")}</span>
                                    <input
                                        name="ends_at"
                                        type="date"
                                        min={form.data.starts_at || undefined}
                                        value={form.data.ends_at}
                                        onChange={(e) => {
                                            form.setData(
                                                "ends_at",
                                                e.target.value,
                                            );
                                            form.clearErrors("ends_at");
                                        }}
                                        aria-invalid={Boolean(
                                            form.errors.ends_at ||
                                            basicErrors.ends_at,
                                        )}
                                    />
                                    <small className="muted">
                                        {t("Defaults to 12:00 AM")}
                                    </small>
                                    <FieldError
                                        message={
                                            form.errors.ends_at ||
                                            basicErrors.ends_at
                                        }
                                    />
                                </label>
                                <label className="form-field checkbox-row">
                                    <input
                                        name="is_active"
                                        type="checkbox"
                                        checked={form.data.is_active}
                                        onChange={(e) =>
                                            form.setData(
                                                "is_active",
                                                e.target.checked,
                                            )
                                        }
                                    />
                                    <span>{t("Active campaign")}</span>
                                </label>
                            </div>
                        </>
                    )}

                    {tab === 1 && (
                        <>
                            <PanelHeading
                                eyebrow={t("Step 2")}
                                title={t("Select product units")}
                                action={
                                    <small className="muted">
                                        {form.data.items.length}{" "}
                                        {t("units selected")}
                                    </small>
                                }
                            />
                            <FieldError message={form.errors.items} />
                            <div
                                className="wizard-sku-catalog"
                                style={{ "--wizard-sku-columns": 4 }}
                            >
                                <div className="receipt-product-toolbar">
                                    <div className="search-box">
                                        <Icon name="search" size={15} />
                                        <input
                                            value={search}
                                            onChange={(e) =>
                                                setSearch(e.target.value)
                                            }
                                            placeholder={t(
                                                "Search products, categories, unit codes...",
                                            )}
                                        />
                                    </div>
                                    <label className="receipt-category-select">
                                        <Icon name="tag" size={14} />
                                        <select
                                            value={category}
                                            onChange={(e) =>
                                                setCategory(e.target.value)
                                            }
                                        >
                                            <option value="all">
                                                {t("All categories")}
                                            </option>
                                            {categories.map((name) => (
                                                <option key={name} value={name}>
                                                    {name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                                {visibleUnits.length > 0 && (
                                    <div
                                        className="wizard-sku-list-head"
                                        aria-hidden="true"
                                    >
                                        <span>{t("Product / Unit")}</span>
                                        <span>{t("Price")}</span>
                                        <span>{t("Available")}</span>
                                        <span>{t("Select")}</span>
                                    </div>
                                )}
                                <div className="receipt-product-catalog wizard-sku-catalog-scroll wizard-console-frame">
                                    {visibleUnits.length === 0 ? (
                                        <div className="empty-document-lines">
                                            {t(
                                                "No product units match these filters.",
                                            )}
                                        </div>
                                    ) : (
                                        visibleUnits.map((unit) => {
                                            const selected = selectedIdSet.has(
                                                Number(unit.id),
                                            );
                                            const item = form.data.items.find(
                                                (row) =>
                                                    Number(
                                                        row.product_unit_id,
                                                    ) === Number(unit.id),
                                            );
                                            const locked =
                                                Number(item?.sold_count || 0) >
                                                0;
                                            return (
                                                <label
                                                    key={unit.id}
                                                    className={`receipt-product-row wizard-sku-row${selected ? " selected" : ""}`}
                                                >
                                                    <UnitIdentity
                                                        unit={unit}
                                                        units={
                                                            unit.product_units
                                                        }
                                                    />
                                                    <span>
                                                        <strong>
                                                            {formatMoney(
                                                                unit.price,
                                                            )}
                                                        </strong>
                                                        <small>
                                                            {t("retail")}
                                                        </small>
                                                    </span>
                                                    <span>
                                                        <strong>
                                                            {formatSelectedUnitQuantity(unit.available_qty, unit, unit.product_units)}
                                                        </strong>
                                                        <small>
                                                            {unit.code}
                                                        </small>
                                                    </span>
                                                    <span className="wizard-sku-check">
                                                        <input
                                                            type="checkbox"
                                                            checked={selected}
                                                            disabled={locked}
                                                            onChange={() =>
                                                                !locked &&
                                                                toggleUnit(unit)
                                                            }
                                                        />
                                                    </span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {tab === 2 && (
                        <>
                            <PanelHeading
                                eyebrow={t("Step 3")}
                                title={t("Sale data by unit")}
                                action={
                                    <small className="muted">
                                        {t(
                                            "Discount and quantity limit per selling unit.",
                                        )}
                                    </small>
                                }
                            />
                            <div
                                className="wizard-qty-table"
                                style={{
                                    "--wizard-qty-fields": 5,
                                    "--wizard-qty-unit": "108px",
                                }}
                            >
                                {selectedItems.length > 0 && (
                                    <div
                                        className="wizard-qty-list-head"
                                        aria-hidden="true"
                                    >
                                        <span>{t("Product / Unit")}</span>
                                        <span>{t("Original")}</span>
                                        <span>{t("Discount")}</span>
                                        <span>{t("Value")}</span>
                                        <span>{t("Limit")}</span>
                                        <span>{t("Sale price")}</span>
                                        <span>{t("Action")}</span>
                                    </div>
                                )}
                                <div className="receipt-price-lines wizard-console-lines">
                                    {selectedItems.map(
                                        ({ item, index, unit }) => {
                                            const locked =
                                                Number(item.sold_count || 0) >
                                                0;
                                            const discountError =
                                                form.errors[
                                                    `items.${index}.discount_value`
                                                ] ||
                                                pricingErrors[
                                                    `items.${index}.discount_value`
                                                ];
                                            const quantityError =
                                                form.errors[
                                                    `items.${index}.quantity_limit`
                                                ] ||
                                                pricingErrors[
                                                    `items.${index}.quantity_limit`
                                                ];
                                            return (
                                                <div
                                                    className={`receipt-price-line has-remove wizard-console-line${discountError || quantityError ? " is-invalid" : ""}`}
                                                    key={unit.id}
                                                >
                                                    <UnitIdentity
                                                        unit={unit}
                                                        detail={`${formatUnitWithConversion(unit, unit.product_units)} · ${formatSelectedUnitQuantity(unit.available_qty, unit, unit.product_units)} ${t("available")}`}
                                                    />
                                                    <div className="wizard-qty-value">
                                                        <span>
                                                            {t("Original")}
                                                        </span>
                                                        <strong>
                                                            {formatMoney(
                                                                unit.price,
                                                            )}
                                                        </strong>
                                                    </div>
                                                    <label className="form-field">
                                                        <span>
                                                            {t("Discount")}
                                                        </span>
                                                        <select
                                                            name={`items.${index}.discount_type`}
                                                            value={
                                                                item.discount_type
                                                            }
                                                            disabled={locked}
                                                            onChange={(e) =>
                                                                updateItem(
                                                                    unit.id,
                                                                    {
                                                                        discount_type:
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        discount_value:
                                                                            "",
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            <option value="percentage">
                                                                {t(
                                                                    "Percentage",
                                                                )}
                                                            </option>
                                                            <option value="fixed_price">
                                                                {t(
                                                                    "Fixed price",
                                                                )}
                                                            </option>
                                                        </select>
                                                    </label>
                                                    <label
                                                        className={
                                                            discountError
                                                                ? "form-field is-invalid"
                                                                : "form-field"
                                                        }
                                                    >
                                                        <span>
                                                            {t("Value")}
                                                        </span>
                                                        <input
                                                            name={`items.${index}.discount_value`}
                                                            type="number"
                                                            min="0.01"
                                                            step="0.01"
                                                            value={
                                                                item.discount_value
                                                            }
                                                            disabled={locked}
                                                            onChange={(e) =>
                                                                updateItem(
                                                                    unit.id,
                                                                    {
                                                                        discount_value:
                                                                            e
                                                                                .target
                                                                                .value,
                                                                    },
                                                                )
                                                            }
                                                            aria-invalid={Boolean(
                                                                discountError,
                                                            )}
                                                            title={
                                                                discountError ||
                                                                undefined
                                                            }
                                                        />
                                                    </label>
                                                    <label
                                                        className={
                                                            quantityError
                                                                ? "form-field is-invalid"
                                                                : "form-field"
                                                        }
                                                    >
                                                        <span>
                                                            {t("Limit")}
                                                        </span>
                                                        <input
                                                            name={`items.${index}.quantity_limit`}
                                                            type="number"
                                                            min="0.0001"
                                                            step="0.0001"
                                                            value={
                                                                item.quantity_limit
                                                            }
                                                            onChange={(e) =>
                                                                updateItem(
                                                                    unit.id,
                                                                    {
                                                                        quantity_limit:
                                                                            e
                                                                                .target
                                                                                .value,
                                                                    },
                                                                )
                                                            }
                                                            placeholder={t(
                                                                "No limit",
                                                            )}
                                                            aria-invalid={Boolean(
                                                                quantityError,
                                                            )}
                                                            title={
                                                                quantityError ||
                                                                undefined
                                                            }
                                                        />
                                                    </label>
                                                    <div className="wizard-qty-value">
                                                        <span>
                                                            {t("Sale price")}
                                                        </span>
                                                        <strong>
                                                            {salePriceFor(
                                                                unit,
                                                                item,
                                                            )
                                                                ? formatMoney(
                                                                      salePriceFor(
                                                                          unit,
                                                                          item,
                                                                      ),
                                                                  )
                                                                : "-"}
                                                        </strong>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="icon-btn small danger wizard-qty-remove"
                                                        disabled={locked}
                                                        onClick={() =>
                                                            removeUnit(unit.id)
                                                        }
                                                        aria-label={t(
                                                            "Remove unit",
                                                        )}
                                                    >
                                                        <Icon
                                                            name="trash"
                                                            size={13}
                                                        />
                                                    </button>
                                                </div>
                                            );
                                        },
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {tab === 3 && (
                        <>
                            <PanelHeading
                                eyebrow={t("Step 4")}
                                title={t("Review and submit")}
                            />
                            <div
                                className="metrics-grid compact"
                                style={{ marginBottom: 14 }}
                            >
                                <Stat
                                    label="Campaign"
                                    value={form.data.name || "-"}
                                />
                                <Stat
                                    label="Starts"
                                    value={dateLabel(form.data.starts_at)}
                                />
                                <Stat
                                    label="Ends"
                                    value={dateLabel(form.data.ends_at)}
                                />
                                <Stat
                                    label="Duration"
                                    value={duration(
                                        form.data.starts_at,
                                        form.data.ends_at,
                                    )}
                                />
                                <Stat
                                    label="Products"
                                    value={
                                        new Set(
                                            selectedItems.map(
                                                ({ unit }) => unit.product_id,
                                            ),
                                        ).size
                                    }
                                />
                                <Stat
                                    label="Units"
                                    value={selectedItems.length}
                                />
                                <Stat
                                    label="Status"
                                    value={
                                        form.data.is_active
                                            ? t("Active")
                                            : t("Inactive")
                                    }
                                />
                            </div>
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{t("Product / Unit")}</th>
                                            <th>{t("Discount")}</th>
                                            <th>{t("Limit")}</th>
                                            <th>{t("Sale price")}</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedItems.map(({ item, unit }) => (
                                            <tr key={unit.id}>
                                                <td>
                                                    <strong>
                                                        {unit.product_name}
                                                    </strong>
                                                    <small
                                                        className="muted"
                                                        style={{
                                                            display: "block",
                                                        }}
                                                    >
                                                        {unit.name} ({unit.code}
                                                        )
                                                    </small>
                                                </td>
                                                <td>
                                                    {item.discount_type ===
                                                    "percentage"
                                                        ? `${Number(item.discount_value || 0)}% ${t("off")}`
                                                        : `${formatMoney(item.discount_value || 0)} ${t("fixed")}`}
                                                </td>
                                                <td>
                                                    {item.quantity_limit ||
                                                        t("No limit")}
                                                </td>
                                                <td>
                                                    {salePriceFor(unit, item)
                                                        ? formatMoney(
                                                              salePriceFor(
                                                                  unit,
                                                                  item,
                                                              ),
                                                          )
                                                        : "-"}
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="icon-btn small danger"
                                                        disabled={
                                                            Number(
                                                                item.sold_count ||
                                                                    0,
                                                            ) > 0
                                                        }
                                                        onClick={() =>
                                                            removeUnit(unit.id)
                                                        }
                                                        aria-label={t(
                                                            "Remove unit",
                                                        )}
                                                    >
                                                        <Icon
                                                            name="trash"
                                                            size={13}
                                                        />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </section>
            </form>
        </AdminLayout>
    );
}
