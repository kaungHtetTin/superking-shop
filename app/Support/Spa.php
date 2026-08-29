<?php

namespace App\Support;

use App\Models\Order;
use App\Services\AppSettingsService;
use App\Services\SupportChatService;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response as ResponseFactory;
use Illuminate\Support\ViewErrorBag;
use Symfony\Component\HttpFoundation\Response;

class Spa
{
    public static function render(string $component, array $props = []): Response
    {
        $request = request();
        $page = [
            'component' => $component,
            'props' => array_merge(self::sharedProps($request), self::resolveProps($props)),
            'url' => $request->getRequestUri(),
        ];

        if ($request->headers->has('X-SPA') || $request->expectsJson()) {
            return ResponseFactory::json($page);
        }

        return response()->view('app', [
            'page' => $page,
        ]);
    }

    private static function sharedProps(Request $request): array
    {
        $path = rtrim($request->getBaseUrl(), '/');
        $appUrl = rtrim($request->getSchemeAndHttpHost().$path, '/');
        $appSettings = app(AppSettingsService::class)->publicSettings();
        $user = $request->user();
        $isAdminUser = $user?->isAdminStaff() ?? false;
        $authUser = $user?->toArray();

        if ($authUser && $isAdminUser) {
            unset($authUser['roles']);
            $authUser['role'] = $user->adminRoleName();
            $authUser['role_label'] = $user->adminRoleLabel();
            $authUser['permissions'] = $user->effectiveAdminPermissions();
        }

        return [
            'app_url' => $appUrl,
            'app_base' => $path,
            'app_settings' => $appSettings,
            'locale' => app()->getLocale(),
            'supported_locales' => config('app.supported_locales'),
            'translations' => [
                'navigation' => trans('navigation'),
            ],
            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
            'errors' => self::validationErrors($request),
            'auth' => [
                'user' => $authUser,
            ],
            'is_super_admin' => $user?->isSuperAdmin() ?? false,
            'orders_pending_payment_count' => self::pendingPaymentCount($user, $isAdminUser),
            'chat_unread_count' => self::chatUnreadCount($user, $isAdminUser),
        ];
    }

    private static function resolveProps(array $props): array
    {
        return collect($props)
            ->map(function ($value) {
                if ($value instanceof \Closure) {
                    $value = $value();
                }

                return $value instanceof Arrayable ? $value->toArray() : $value;
            })
            ->all();
    }

    private static function validationErrors(Request $request): array
    {
        $errors = $request->session()->get('errors');

        if (! $errors instanceof ViewErrorBag) {
            return [];
        }

        return collect($errors->getBag('default')->getMessages())
            ->map(fn (array $messages) => $messages[0] ?? '')
            ->filter()
            ->all();
    }

    private static function pendingPaymentCount($user, bool $isAdminUser): int
    {
        if (! $isAdminUser || ! $user->hasAdminPermission('orders.view')) {
            return 0;
        }

        return Order::where('payment_status', 'pending_review')->count();
    }

    private static function chatUnreadCount($user, bool $isAdminUser): int
    {
        if (! $user) {
            return 0;
        }

        $service = app(SupportChatService::class);

        if ($isAdminUser && $user->hasAdminPermission('chat.manage')) {
            return $service->unreadCountAllCustomerMessages();
        }

        return $service->unreadCountForCustomer($user->id);
    }
}
