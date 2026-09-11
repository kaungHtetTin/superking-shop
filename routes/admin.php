<?php

use App\Http\Controllers\Admin\AdminUserController;
use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\BlogController;
use App\Http\Controllers\Admin\CouponController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\CreditReportController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\FinanceController;
use App\Http\Controllers\Admin\FlashSaleController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\ProductImportController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\ReviewController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\LocationController;
use App\Http\Controllers\Admin\InventoryController;
use App\Http\Controllers\Admin\StockAdjustmentController;
use App\Http\Controllers\Admin\StockReceiptController;
use App\Http\Controllers\Admin\StockTransferController;
use App\Http\Controllers\Admin\ChatController;
use App\Http\Controllers\Admin\OrderController;
use App\Http\Controllers\Admin\OrderVoucherController;
use App\Http\Controllers\Admin\PaymentMethodController;
use App\Http\Controllers\Admin\PosController;
use App\Http\Controllers\Admin\PosRegisterController;
use App\Http\Controllers\Admin\PointConfigurationController;
use App\Http\Controllers\Admin\SettingController;
use App\Http\Controllers\Admin\StorefrontController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\PasswordController;
use App\Http\Controllers\ProfileController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Route;

Route::get('/csrf-token', function (Request $request) {
    return response()
        ->json(['csrf_token' => $request->session()->token()])
        ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
})->name('csrf-token');
Route::post('/locale', function (Request $request) {
    $supportedLocales = array_keys(config('app.supported_locales'));
    $data = $request->validate([
        'locale' => ['required', 'string', 'in:'.implode(',', $supportedLocales)],
    ]);

    $request->session()->put('locale', $data['locale']);
    App::setLocale($data['locale']);

    return back();
})->name('locale.update');

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store'])->name('login.store');
});

Route::middleware(['auth', 'admin'])->group(function () {
    Route::get('/', [DashboardController::class, 'index'])->middleware('admin.permission:dashboard.view')->name('home');
    Route::get('/dashboard', [DashboardController::class, 'index'])->middleware('admin.permission:dashboard.view')->name('dashboard');
    Route::get('/ui-showcase', [DashboardController::class, 'uiShowcase'])->middleware('admin.permission:dashboard.view')->name('ui-showcase');

    // Categories
    Route::get('/categories', [CategoryController::class, 'index'])->middleware('admin.permission:catalog.view')->name('categories.index');
    Route::post('/categories', [CategoryController::class, 'store'])->middleware('admin.permission:catalog.manage')->name('categories.store');
    Route::post('/categories/{category}', [CategoryController::class, 'update'])->middleware('admin.permission:catalog.manage')->name('categories.update.post');
    Route::patch('/categories/{category}', [CategoryController::class, 'update'])->middleware('admin.permission:catalog.manage')->name('categories.update');
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->middleware('admin.permission:catalog.manage')->name('categories.destroy');

    // Products
    Route::get('/products/barcode/generate', [ProductController::class, 'generateBarcode'])->middleware('admin.permission:catalog.manage')->name('products.barcode.generate');
    Route::get('/products/barcodes', [ProductController::class, 'barcodes'])->middleware('admin.permission:catalog.manage')->name('products.barcodes');
    Route::get('/products/import', [ProductImportController::class, 'create'])->middleware('admin.permission:catalog.manage')->name('products.import.create');
    Route::get('/products/import/template', [ProductImportController::class, 'template'])->middleware('admin.permission:catalog.manage')->name('products.import.template');
    Route::get('/products/import/unit-prices/template', [ProductImportController::class, 'unitPriceTemplate'])->middleware('admin.permission:catalog.manage')->name('products.import.unit-prices.template');
    Route::post('/products/import/unit-prices', [ProductImportController::class, 'storeUnitPrices'])->middleware('admin.permission:catalog.manage')->name('products.import.unit-prices.store');
    Route::get('/products/export', [ProductImportController::class, 'export'])->middleware('admin.permission:catalog.manage')->name('products.export');
    Route::post('/products/import', [ProductImportController::class, 'store'])->middleware('admin.permission:catalog.manage')->name('products.import.store');
    Route::get('/products', [ProductController::class, 'index'])->middleware('admin.permission:catalog.view')->name('products.index');
    Route::get('/products/create', [ProductController::class, 'create'])->middleware('admin.permission:catalog.manage')->name('products.create');
    Route::post('/products', [ProductController::class, 'store'])->middleware('admin.permission:catalog.manage')->name('products.store');
    Route::get('/products/{product}/edit', [ProductController::class, 'edit'])->middleware('admin.permission:catalog.manage')->name('products.edit');
    Route::patch('/products/{product}', [ProductController::class, 'update'])->middleware('admin.permission:catalog.manage')->name('products.update');
    Route::patch('/products/{product}/toggle-status', [ProductController::class, 'toggleStatus'])->middleware('admin.permission:catalog.manage')->name('products.toggle-status');
    Route::delete('/products/{product}', [ProductController::class, 'destroy'])->middleware('admin.permission:catalog.manage')->name('products.destroy');
    Route::get('/orders', [OrderController::class, 'index'])->middleware('admin.permission:orders.view')->name('orders.index');
    Route::get('/orders-export.csv', [OrderController::class, 'export'])->middleware('admin.permission:orders.view')->name('orders.export');
    Route::get('/orders/{order}', [OrderController::class, 'show'])->middleware('admin.permission:orders.view')->name('orders.show');
    Route::get('/orders/{order}/voucher', [OrderVoucherController::class, 'show'])->middleware('admin.permission:orders.view')->name('orders.voucher.show');
    Route::get('/orders/{order}/voucher/pdf', [OrderVoucherController::class, 'pdf'])->middleware('admin.permission:orders.view')->name('orders.voucher.pdf');
    Route::post('/orders/{order}/voucher/link', [OrderVoucherController::class, 'link'])->middleware('admin.permission:orders.manage')->name('orders.voucher.link');
    Route::post('/orders/{order}/confirm-payment', [OrderController::class, 'confirmPayment'])
        ->middleware('order.payment.reviewer')
        ->name('orders.confirm-payment');
    Route::post('/orders/{order}/reject-payment', [OrderController::class, 'rejectPayment'])
        ->middleware('order.payment.reviewer')
        ->name('orders.reject-payment');
    Route::patch('/orders/{order}/status', [OrderController::class, 'updateStatus'])
        ->middleware('order.staff')
        ->name('orders.update-status');
    Route::patch('/orders/{order}/notes', [OrderController::class, 'updateNotes'])
        ->middleware('order.staff')
        ->name('orders.update-notes');
    Route::post('/orders/{order}/cancel', [OrderController::class, 'cancel'])
        ->middleware('admin.permission:orders.cancel')
        ->name('orders.cancel');
    Route::delete('/orders/{order}', [OrderController::class, 'destroy'])
        ->middleware('admin.permission:orders.cancel')
        ->name('orders.destroy');

    Route::get('/chats', [ChatController::class, 'index'])->middleware('admin.permission:chat.manage')->name('chats.index');
    Route::get('/chats/{user}', [ChatController::class, 'show'])->middleware('admin.permission:chat.manage')->name('chats.show');

    Route::middleware('admin.permission:manage_coupons')->group(function () {
        Route::get('/coupons', [CouponController::class, 'index'])->name('coupons.index');
        Route::post('/coupons', [CouponController::class, 'store'])->name('coupons.store');
        Route::patch('/coupons/{coupon}', [CouponController::class, 'update'])->name('coupons.update');
        Route::delete('/coupons/{coupon}', [CouponController::class, 'destroy'])->name('coupons.destroy');
    });

    Route::middleware('admin.permission:manage_flash_sales')->group(function () {
        Route::get('/flash-sales', [FlashSaleController::class, 'index'])->name('flash-sales.index');
        Route::get('/flash-sales/create', [FlashSaleController::class, 'create'])->name('flash-sales.create');
        Route::post('/flash-sales', [FlashSaleController::class, 'store'])->name('flash-sales.store');
        Route::get('/flash-sales/{flashSale}', [FlashSaleController::class, 'show'])->name('flash-sales.show');
        Route::get('/flash-sales/{flashSale}/edit', [FlashSaleController::class, 'edit'])->name('flash-sales.edit');
        Route::patch('/flash-sales/{flashSale}', [FlashSaleController::class, 'update'])->name('flash-sales.update');
        Route::delete('/flash-sales/{flashSale}', [FlashSaleController::class, 'destroy'])->name('flash-sales.destroy');
    });

    Route::middleware('admin.permission:manage_blogs')->group(function () {
        Route::get('/blogs', [BlogController::class, 'index'])->name('blogs.index');
        Route::get('/blogs/create', [BlogController::class, 'create'])->name('blogs.create');
        Route::post('/blogs', [BlogController::class, 'store'])->name('blogs.store');
        Route::get('/blogs/{blog}/edit', [BlogController::class, 'edit'])->name('blogs.edit');
        Route::post('/blogs/{blog}', [BlogController::class, 'update'])->name('blogs.update.post');
        Route::patch('/blogs/{blog}', [BlogController::class, 'update'])->name('blogs.update');
        Route::delete('/blogs/{blog}', [BlogController::class, 'destroy'])->name('blogs.destroy');
    });

    Route::middleware('super_admin')->group(function () {
        Route::get('/marketing/point-configuration', [PointConfigurationController::class, 'edit'])->name('marketing.point-configuration.edit');
        Route::post('/marketing/point-configuration', [PointConfigurationController::class, 'update'])->name('marketing.point-configuration.update');
    });

    Route::get('/storefront', [StorefrontController::class, 'edit'])->middleware('admin.permission:storefront.manage')->name('storefront.edit');
    Route::post('/storefront', [StorefrontController::class, 'update'])->middleware('admin.permission:storefront.manage')->name('storefront.update');

    Route::middleware('admin.permission:moderate_reviews')->group(function () {
        Route::get('/reviews', [ReviewController::class, 'index'])->name('reviews.index');
        Route::patch('/reviews/{review}', [ReviewController::class, 'update'])->name('reviews.update');
        Route::delete('/reviews/{review}', [ReviewController::class, 'destroy'])->name('reviews.destroy');
    });

    Route::middleware('admin.permission:view_customers')->group(function () {
        Route::get('/credit', [CreditReportController::class, 'index'])->middleware('admin.permission:credit.manage')->name('credit.index');
        Route::get('/credit/export', [CreditReportController::class, 'export'])->middleware('admin.permission:credit.manage')->name('credit.export');
        Route::get('/customers', [CustomerController::class, 'index'])->name('customers.index');
        Route::post('/customers', [CustomerController::class, 'store'])->name('customers.store');
        Route::get('/customers/{customer}', [CustomerController::class, 'show'])->name('customers.show');
        Route::patch('/customers/{customer}', [CustomerController::class, 'update'])->name('customers.update');
        Route::delete('/customers/{customer}', [CustomerController::class, 'destroy'])->name('customers.destroy');
        Route::get('/customers/{customer}/credit-statement', [CustomerController::class, 'creditStatement'])->middleware('admin.permission:credit.manage')->name('customers.credit-statement');
        Route::post('/customers/{customer}/loyalty-adjustments', [CustomerController::class, 'adjustLoyalty'])
            ->middleware('super_admin')
            ->name('customers.loyalty-adjustments.store');
        Route::patch('/customers/{customer}/credit-settings', [CustomerController::class, 'updateCreditSettings'])
            ->middleware('admin.permission:credit.manage')
            ->name('customers.credit-settings.update');
        Route::post('/customers/{customer}/credit-payments', [CustomerController::class, 'recordCreditPayment'])
            ->middleware('admin.permission:credit.manage')
            ->name('customers.credit-payments.store');
    });

    Route::middleware('admin.any_permission:view_reports,reports.sales,reports.inventory')->group(function () {
        Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');
        Route::get('/reports/export', [ReportController::class, 'export'])->name('reports.export');
    });

    Route::middleware('admin.permission:manage_finance')->group(function () {
        Route::get('/finance', [FinanceController::class, 'index'])->name('finance.index');
        Route::get('/finance/export', [FinanceController::class, 'export'])->name('finance.export');
        Route::post('/finance/entries', [FinanceController::class, 'store'])->name('finance.entries.store');
        Route::patch('/finance/entries/{entry}', [FinanceController::class, 'update'])->name('finance.entries.update');
        Route::delete('/finance/entries/{entry}', [FinanceController::class, 'destroy'])->name('finance.entries.destroy');
    });

    Route::middleware('admin.permission:manage_payment_methods')->group(function () {
        Route::get('/payment-methods', [PaymentMethodController::class, 'index'])->name('payment-methods.index');
        Route::post('/payment-methods', [PaymentMethodController::class, 'store'])->name('payment-methods.store');
        Route::post('/payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update'])->name('payment-methods.update.post');
        Route::patch('/payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update'])->name('payment-methods.update');
        Route::delete('/payment-methods/{paymentMethod}', [PaymentMethodController::class, 'destroy'])->name('payment-methods.destroy');
    });

    Route::get('/audit-logs', [AuditLogController::class, 'index'])
        ->middleware('admin.permission:view_audit_logs')
        ->name('audit-logs.index');

    Route::middleware('admin.permission:staff.manage')->group(function () {
        Route::get('/users', [AdminUserController::class, 'index'])->name('users.index');
        Route::post('/users', [AdminUserController::class, 'store'])->name('users.store');
        Route::patch('/users/{user}', [AdminUserController::class, 'update'])->name('users.update');
        Route::patch('/users/{user}/toggle-status', [AdminUserController::class, 'toggleStatus'])->name('users.toggle-status');
        Route::delete('/users/{user}', [AdminUserController::class, 'destroy'])->name('users.destroy');

    });

    Route::middleware('admin.permission:roles.manage')->group(function () {
        Route::get('/roles', [RoleController::class, 'index'])->name('roles.index');
        Route::post('/roles', [RoleController::class, 'store'])->name('roles.store');
        Route::patch('/roles/{role}', [RoleController::class, 'update'])->name('roles.update');
        Route::delete('/roles/{role}', [RoleController::class, 'destroy'])->name('roles.destroy');
    });

    Route::get('/locations', [LocationController::class, 'index'])
        ->middleware('admin.permission:locations.view')
        ->name('locations.index');
    Route::post('/locations', [LocationController::class, 'store'])
        ->middleware('admin.permission:locations.manage')
        ->name('locations.store');
    Route::patch('/locations/{location}', [LocationController::class, 'update'])
        ->middleware('admin.permission:locations.manage')
        ->name('locations.update');
    Route::delete('/locations/{location}', [LocationController::class, 'destroy'])
        ->middleware('admin.permission:locations.manage')
        ->name('locations.destroy');

    Route::get('/registers', [PosRegisterController::class, 'index'])
        ->middleware('admin.permission:registers.manage')->name('registers.index');
    Route::post('/registers', [PosRegisterController::class, 'store'])
        ->middleware('admin.permission:registers.manage')->name('registers.store');
    Route::patch('/registers/{register}', [PosRegisterController::class, 'update'])
        ->middleware('admin.permission:registers.manage')->name('registers.update');

    Route::get('/pos', [PosController::class, 'index'])
        ->middleware('admin.permission:pos.access')->name('pos.index');
    Route::get('/pos/shifts', [PosController::class, 'shiftHistory'])
        ->middleware('admin.permission:pos.access')->name('pos.shifts.index');
    Route::get('/pos/products/search', [PosController::class, 'products'])
        ->middleware('admin.permission:pos.access')->name('pos.products.search');
    Route::get('/pos/products/prices', [PosController::class, 'prices'])
        ->middleware('admin.permission:pos.access')->name('pos.products.prices');
    Route::get('/pos/customers/search', [PosController::class, 'customers'])
        ->middleware('admin.permission:pos.access')->name('pos.customers.search');
    Route::post('/pos/customers', [PosController::class, 'storeCustomer'])
        ->middleware('admin.permission:pos.access')->name('pos.customers.store');
    Route::post('/pos/checkout', [PosController::class, 'checkout'])
        ->middleware('admin.permission:pos.access')->name('pos.checkout');
    Route::get('/pos/shifts/active', [PosController::class, 'activeShift'])
        ->middleware('admin.permission:pos.access')->name('pos.shifts.active');
    Route::post('/pos/shifts/open', [PosController::class, 'openShift'])
        ->middleware('admin.permission:pos.access')->name('pos.shifts.open');
    Route::post('/pos/shifts/{shift}/close', [PosController::class, 'closeShift'])
        ->middleware('admin.permission:pos.access')->name('pos.shifts.close');
    Route::post('/pos/held-carts', [PosController::class, 'holdCart'])
        ->middleware('admin.permission:pos.hold')->name('pos.held-carts.store');
    Route::delete('/pos/held-carts/{heldCart}', [PosController::class, 'deleteHeldCart'])
        ->middleware('admin.permission:pos.hold')->name('pos.held-carts.destroy');
    Route::get('/pos/orders/{order}/receipt', [PosController::class, 'receipt'])
        ->middleware('admin.permission:pos.access')->name('pos.orders.receipt');

    Route::get('/inventory', [InventoryController::class, 'index'])
        ->middleware('admin.permission:inventory.view')->name('inventory.index');
    Route::get('/inventory/export', [InventoryController::class, 'exportBalances'])
        ->middleware('admin.permission:inventory.view')->name('inventory.export');
    Route::get('/inventory/products/search', [InventoryController::class, 'searchProducts'])
        ->name('inventory.products.search');
    Route::get('/inventory/products/{product}/export', [InventoryController::class, 'exportMovements'])
        ->middleware('admin.permission:inventory.history')->name('inventory.products.export');
    Route::get('/inventory/products/{product}', [InventoryController::class, 'show'])
        ->middleware('admin.permission:inventory.history')->name('inventory.products.show');

    Route::get('/inventory/receipts', [StockReceiptController::class, 'index'])
        ->middleware('admin.permission:inventory.receive')->name('inventory.receipts.index');
    Route::get('/inventory/receipts/create', [StockReceiptController::class, 'create'])
        ->middleware('admin.permission:inventory.receive')->name('inventory.receipts.create');
    Route::get('/inventory/receipts/import/template', [StockReceiptController::class, 'importTemplate'])
        ->middleware('admin.permission:inventory.receive')->name('inventory.receipts.import.template');
    Route::post('/inventory/receipts/import/preview', [StockReceiptController::class, 'importPreview'])
        ->middleware('admin.permission:inventory.receive')->name('inventory.receipts.import.preview');
    Route::post('/inventory/receipts', [StockReceiptController::class, 'store'])
        ->middleware('admin.permission:inventory.receive')->name('inventory.receipts.store');
    Route::get('/inventory/receipts/{receipt}', [StockReceiptController::class, 'show'])
        ->middleware('admin.permission:inventory.receive')->name('inventory.receipts.show');
    Route::get('/inventory/receipts/{receipt}/edit', [StockReceiptController::class, 'edit'])
        ->middleware('admin.permission:inventory.receive')->name('inventory.receipts.edit');
    Route::put('/inventory/receipts/{receipt}', [StockReceiptController::class, 'update'])
        ->middleware('admin.permission:inventory.receive')->name('inventory.receipts.update');
    Route::delete('/inventory/receipts/{receipt}', [StockReceiptController::class, 'destroy'])
        ->middleware('admin.permission:inventory.receive')->name('inventory.receipts.destroy');

    Route::get('/inventory/adjustments', [StockAdjustmentController::class, 'index'])
        ->middleware('admin.permission:inventory.adjust.create')->name('inventory.adjustments.index');
    Route::get('/inventory/adjustments/create', [StockAdjustmentController::class, 'create'])
        ->middleware('admin.permission:inventory.adjust.create')->name('inventory.adjustments.create');
    Route::post('/inventory/adjustments', [StockAdjustmentController::class, 'store'])
        ->middleware('admin.permission:inventory.adjust.create')->name('inventory.adjustments.store');

    Route::get('/inventory/transfers', [StockTransferController::class, 'index'])->name('inventory.transfers.index');
    Route::get('/inventory/transfers/create', [StockTransferController::class, 'create'])
        ->middleware('admin.permission:inventory.transfer.create')->name('inventory.transfers.create');
    Route::get('/inventory/transfers/export', [StockTransferController::class, 'export'])->name('inventory.transfers.export');
    Route::post('/inventory/transfers', [StockTransferController::class, 'store'])
        ->middleware('admin.permission:inventory.transfer.create')->name('inventory.transfers.store');
    Route::get('/inventory/transfers/{transfer}', [StockTransferController::class, 'show'])->name('inventory.transfers.show');
    Route::delete('/inventory/transfers/{transfer}', [StockTransferController::class, 'destroy'])
        ->middleware('admin.permission:inventory.transfer.create')->name('inventory.transfers.destroy');

    Route::middleware('admin.any_permission:settings.manage,pricing.manage')->group(function () {
        Route::get('/settings/prices', [\App\Http\Controllers\Admin\PricingRuleController::class, 'index'])->name('pricing.index');
        Route::get('/settings/prices/create', [\App\Http\Controllers\Admin\PricingRuleController::class, 'create'])->name('pricing.create');
        Route::post('/settings/prices/preview', [\App\Http\Controllers\Admin\PricingRuleController::class, 'preview'])->name('pricing.preview');
        Route::post('/settings/prices', [\App\Http\Controllers\Admin\PricingRuleController::class, 'store'])->name('pricing.store');
        Route::get('/settings/prices/{rule}/edit', [\App\Http\Controllers\Admin\PricingRuleController::class, 'edit'])->name('pricing.edit');
        Route::patch('/settings/prices/{rule}', [\App\Http\Controllers\Admin\PricingRuleController::class, 'update'])->name('pricing.update');
        Route::delete('/settings/prices/{rule}', [\App\Http\Controllers\Admin\PricingRuleController::class, 'destroy'])->name('pricing.destroy');
        Route::get('/settings', [SettingController::class, 'edit'])->name('settings.edit');
        Route::post('/settings', [SettingController::class, 'update'])->middleware('admin.permission:settings.manage')->name('settings.update');
    });

    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::post('/profile', [ProfileController::class, 'update'])->name('profile.update.post');
    Route::put('/profile/password', [PasswordController::class, 'update'])->name('profile.password.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});
