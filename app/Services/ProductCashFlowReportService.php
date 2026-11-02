<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class ProductCashFlowReportService
{
    public function query(array $locationIds, array $filters): Builder
    {
        $from = \Illuminate\Support\Carbon::parse($filters['from'])->startOfDay();
        $to = \Illuminate\Support\Carbon::parse($filters['to'])->endOfDay();
        $purchases = DB::table('stock_receipt_items as items')
            ->join('stock_receipts as receipts', 'receipts.id', '=', 'items.stock_receipt_id')
            ->where('receipts.status', 'posted')->whereIn('receipts.location_id', $locationIds)
            ->whereBetween('receipts.received_at', [$from, $to])
            ->groupBy('items.product_id')
            ->selectRaw('items.product_id, SUM(items.received_quantity * COALESCE(items.unit_cost, 0)) as purchases');
        // Use the same proportional order-discount allocation as Product Sales.
        $discount = 'items.total_price * CASE WHEN orders.total_amount > 0 THEN LEAST(1, orders.discount_amount / orders.total_amount) ELSE 0 END';
        $sales = DB::table('order_items as items')
            ->join('orders', 'orders.id', '=', 'items.order_id')
            ->whereIn('orders.id', Order::query()->recognizedSale()->select('orders.id'))
            ->whereIn('orders.location_id', $locationIds)->whereBetween('orders.created_at', [$from, $to])
            ->groupBy('items.product_id')
            ->selectRaw("items.product_id, SUM(items.total_price) as sales, SUM($discount) as discounts");
        $stock = DB::table('inventory_balances')->whereIn('location_id', $locationIds)
            ->groupBy('product_id')->selectRaw('product_id, SUM(on_hand_qty) as stock_quantity');

        $retailPrice = DB::table('product_unit_prices as prices')
                ->join('product_units as units', 'units.id', '=', 'prices.product_unit_id')
                ->join('product_price_types as types', 'types.id', '=', 'prices.product_price_type_id')
                ->whereColumn('units.product_id', 'products.id')->whereColumn('types.product_id', 'products.id')
                ->where('units.is_base', true)->where('types.name', 'retail')
                ->where(fn ($price) => $price->where('prices.is_manual', true)
                    ->orWhereNull('prices.calculation_status')->orWhere('prices.calculation_status', '!=', 'cost_required')
                    ->orWhere('prices.price', '>', 0))
                ->orderBy('prices.id')->limit(1)->select('prices.price');

        return DB::table('products')
            ->leftJoinSub($purchases, 'purchases', 'purchases.product_id', '=', 'products.id')
            ->leftJoinSub($sales, 'sales', 'sales.product_id', '=', 'products.id')
            ->leftJoinSub($stock, 'stock', 'stock.product_id', '=', 'products.id')
            ->where(fn ($query) => $query->whereNotNull('purchases.product_id')->orWhereNotNull('sales.product_id')->orWhereNotNull('stock.product_id'))
            ->when(trim($filters['q'] ?? '') !== '', function ($query) use ($filters) {
                $term = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim($filters['q'])).'%';
                $query->where(fn ($search) => $search->where('products.name', 'like', $term)
                    ->orWhere('products.product_code', 'like', $term)->orWhere('products.barcode', 'like', $term));
            })
            ->select('products.id as product_id', 'products.name as product_name', 'products.product_code')
            ->selectSub(DB::table('product_units')->whereColumn('product_id', 'products.id')
                ->where('is_base', true)->orderBy('id')->limit(1)->select('name'), 'base_unit_name')
            ->selectSub($retailPrice, 'current_unit_price')
            ->addSelect('products.original_price as current_unit_cost')
            ->selectRaw('COALESCE(stock.stock_quantity, 0) * ('.$retailPrice->toSql().') as stock_sale_value', $retailPrice->getBindings())
            ->selectRaw('COALESCE(purchases.purchases, 0) as purchases, COALESCE(sales.sales, 0) as sales, COALESCE(sales.discounts, 0) as discounts,
                COALESCE(sales.sales, 0) - COALESCE(purchases.purchases, 0) - COALESCE(sales.discounts, 0) as profit,
                COALESCE(stock.stock_quantity, 0) as stock_quantity, COALESCE(stock.stock_quantity, 0) * products.original_price as stock_value');
    }

    public function report(array $locationIds, array $filters): array
    {
        $query = $this->query($locationIds, $filters);
        $summary = DB::query()->fromSub(clone $query, 'cash_flow')
            ->selectRaw('COUNT(*) as products, COALESCE(SUM(purchases), 0) as purchases, COALESCE(SUM(sales), 0) as sales,
                COALESCE(SUM(discounts), 0) as discounts, COALESCE(SUM(profit), 0) as profit, COALESCE(SUM(stock_value), 0) as stock_value')->first();

        return ['summary' => $summary, 'rows' => $query->orderBy('products.name')->orderBy('products.id')->paginate(25)->withQueryString()];
    }
}
