<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinancialEntry extends Model
{
    use HasFactory;

    public const CATEGORY_STOCK_RECEIPT = 'stock_receipt';

    public const CATEGORY_POS_SALE = 'pos_sale';

    public const TYPES = ['income', 'expense'];

    public const STATUSES = ['pending', 'approved', 'void'];

    public const INCOME_CATEGORIES = [
        self::CATEGORY_POS_SALE => 'POS sales',
        'other_income' => 'Other income',
        'service_fee' => 'Service fee',
        'adjustment' => 'Adjustment',
    ];

    public const EXPENSE_CATEGORIES = [
        self::CATEGORY_STOCK_RECEIPT => 'Stock receipts',
        'inventory' => 'Inventory',
        'delivery' => 'Delivery',
        'marketing' => 'Marketing',
        'salary' => 'Salary',
        'rent' => 'Rent',
        'utilities' => 'Utilities',
        'software' => 'Software',
        'bank_fee' => 'Bank fee',
        'refund' => 'Refund',
        'other_expense' => 'Other expense',
    ];

    protected $fillable = [
        'recorded_by',
        'type',
        'category',
        'title',
        'amount',
        'entry_date',
        'payment_method',
        'reference',
        'status',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'entry_date' => 'date',
    ];

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function isStockReceiptEntry(): bool
    {
        return $this->type === 'expense' && $this->category === self::CATEGORY_STOCK_RECEIPT;
    }

    public static function categoryOptions(): array
    {
        return [
            'income' => self::categoryOptionsFor('income'),
            'expense' => self::categoryOptionsFor('expense'),
        ];
    }

    public static function categoryValuesFor(string $type): array
    {
        return collect(self::categoryOptionsFor($type))->pluck('value')->all();
    }

    private static function categoryOptionsFor(string $type): array
    {
        $fallback = $type === 'income' ? self::INCOME_CATEGORIES : self::EXPENSE_CATEGORIES;
        $options = collect($fallback)
            ->map(fn ($label, $value) => ['value' => $value, 'label' => $label])
            ->values();

        if (class_exists(FinancialCategory::class) && \Illuminate\Support\Facades\Schema::hasTable('financial_categories')) {
            FinancialCategory::query()
                ->where('type', $type)
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('label')
                ->get(['value', 'label'])
                ->each(function (FinancialCategory $category) use (&$options) {
                    $options = $options->reject(fn (array $option) => $option['value'] === $category->value)
                        ->prepend(['value' => $category->value, 'label' => $category->label]);
                });
        }

        return $options->values()->all();
    }
}
