<?php

use App\Http\Controllers\User\CartController;
use App\Http\Controllers\User\BlogController;
use App\Http\Controllers\User\CategoryController;
use App\Http\Controllers\User\CheckoutController;
use App\Http\Controllers\User\ChatController;
use App\Http\Controllers\User\GuideController;
use App\Http\Controllers\User\HomeController;
use App\Http\Controllers\User\OrderController;
use App\Http\Controllers\User\ProductController;
use App\Http\Controllers\User\WishlistController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PublicInvoiceController;
use App\Http\Controllers\PwaController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', [HomeController::class, 'index'])->name('home');
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
Route::get('/manifest.webmanifest', [PwaController::class, 'manifest'])->name('pwa.manifest');
Route::get('/categories', [CategoryController::class, 'index'])->name('categories.index');
Route::get('/categories/{slug}', [CategoryController::class, 'show'])->name('categories.show');
Route::get('/products', [ProductController::class, 'index'])->name('products.index');
Route::get('/products/{slug}', [ProductController::class, 'show'])->name('products.show');
Route::get('/blogs', [BlogController::class, 'index'])->name('blogs.index');
Route::get('/blogs/{slug}', [BlogController::class, 'show'])->name('blogs.show');
Route::get('/buying-guide', [GuideController::class, 'index'])->name('buying-guide');
Route::get('/invoices/{token}', [PublicInvoiceController::class, 'show'])->name('public.invoices.show');

Route::get('/cart', [CartController::class, 'index'])->name('cart.index');
Route::get('/wishlist', [WishlistController::class, 'index'])->name('wishlist.index');

Route::middleware('auth')->group(function () {
    Route::post('/products/{slug}/reviews', [ProductController::class, 'storeReview'])->name('products.reviews.store');
    Route::get('/chat', [ChatController::class, 'index'])->name('chat.index');

    Route::get('/checkout', [CheckoutController::class, 'create'])->name('checkout.create');
    Route::post('/checkout/quote', [CheckoutController::class, 'quote'])->name('checkout.quote');
    Route::post('/checkout', [CheckoutController::class, 'store'])->name('checkout.store');
    Route::get('/orders', [OrderController::class, 'index'])->name('orders.index');
    Route::get('/orders/{order}', [OrderController::class, 'show'])->name('orders.show');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::post('/profile', [ProfileController::class, 'update']);
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
