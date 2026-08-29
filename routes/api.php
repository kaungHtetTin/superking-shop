<?php

use App\Http\Controllers\Api\AdminChatController;
use App\Http\Controllers\Api\CustomerChatController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/chats', [CustomerChatController::class, 'overview']);
    Route::get('/chats/{conversation}/messages', [CustomerChatController::class, 'paginatedMessages']);
    Route::get('/messages/latest', [CustomerChatController::class, 'latest']);
    Route::post('/messages/send', [CustomerChatController::class, 'send']);
    Route::post('/messages/upload-image', [CustomerChatController::class, 'uploadImage']);
});

Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('/conversations/unread', [AdminChatController::class, 'unreadCount']);
    Route::get('/conversations/by-customer/{user}', [AdminChatController::class, 'conversationForCustomer']);
    Route::get('/conversations', [AdminChatController::class, 'index']);
    Route::get('/conversations/{conversation}', [AdminChatController::class, 'show']);
    Route::get('/conversations/{conversation}/messages', [AdminChatController::class, 'paginatedMessages']);
    Route::get('/messages/latest', [AdminChatController::class, 'latest']);
    Route::post('/messages/send', [AdminChatController::class, 'send']);
    Route::post('/messages/upload-image', [AdminChatController::class, 'uploadImage']);
});
