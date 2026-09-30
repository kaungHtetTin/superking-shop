<?php

namespace Tests\Unit;

use App\Exceptions\Handler;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Tests\TestCase;

class AdminDeniedRedirectTest extends TestCase
{
    public function test_browser_denial_redirects_to_a_safe_page(): void
    {
        $response = app(Handler::class)->render($this->request('/admin/dashboard'), new AccessDeniedHttpException());

        $this->assertSame(302, $response->getStatusCode());
        $this->assertSame('/admin/profile', parse_url($response->headers->get('Location'), PHP_URL_PATH));

        $policyResponse = app(Handler::class)->render($this->request('/admin/inventory/receipts'), new AuthorizationException());
        $this->assertSame('/admin/profile', parse_url($policyResponse->headers->get('Location'), PHP_URL_PATH));
    }

    public function test_spa_page_denial_redirects_but_json_requests_keep_403(): void
    {
        $spa = $this->request('/admin/dashboard', 'GET', ['X-SPA' => 'true', 'Accept' => 'application/json']);
        $response = app(Handler::class)->render($spa, new AccessDeniedHttpException());
        $this->assertSame('/admin/profile', parse_url($response->headers->get('Location'), PHP_URL_PATH));

        $json = $this->request('/admin/dashboard', 'GET', ['Accept' => 'application/json']);
        $this->assertSame(403, app(Handler::class)->render($json, new AccessDeniedHttpException())->getStatusCode());

        $post = $this->request('/admin/dashboard', 'POST');
        $this->assertSame(403, app(Handler::class)->render($post, new AccessDeniedHttpException())->getStatusCode());
    }

    private function request(string $path, string $method = 'GET', array $headers = []): Request
    {
        $request = Request::create($path, $method);
        $request->headers->add($headers);
        $request->setLaravelSession(app('session')->driver());
        $request->setUserResolver(function () {
            $user = new class extends User
            {
                public function isAdminStaff(): bool
                {
                    return true;
                }

                public function hasAdminPermission(string $permission): bool
                {
                    return false;
                }
            };
            $user->status = 'active';

            return $user;
        });

        return $request;
    }
}
