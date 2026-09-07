<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\AppSettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReceiptSettingsTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $receipt = []): array
    {
        return [
            'app_name' => 'Test Shop', 'currency_label' => 'MMK', 'theme_color' => '#087f74',
            'receipt' => array_replace(AppSettingsService::RECEIPT_DEFAULTS, $receipt),
        ];
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
    }

    public function test_receipt_tab_has_safe_defaults(): void
    {
        $this->actingAs($this->admin())->getJson('/admin/settings?section=receipts')
            ->assertOk()->assertJsonPath('props.initialSection', 'receipts')
            ->assertJsonPath('props.settings.receipt.paper_size', '80mm')
            ->assertJsonPath('props.settings.receipt.auto_print', false);
    }

    public function test_receipt_settings_are_saved_and_shared_with_pos(): void
    {
        $this->actingAs($this->admin())->from('/admin/settings?section=receipts')
            ->post('/admin/settings', $this->payload([
                'shop_name' => ' Counter Shop ', 'address' => "Street 1\nYangon", 'paper_size' => '58mm',
                'show_logo' => '0', 'show_customer' => '0', 'auto_print' => '1', 'footer' => '',
            ]))->assertSessionHasNoErrors()->assertRedirect('/admin/settings?section=receipts');

        $receipt = app(AppSettingsService::class)->all()['receipt'];
        $this->assertSame('Counter Shop', $receipt['shop_name']);
        $this->assertFalse($receipt['show_logo']);
        $this->assertFalse($receipt['show_customer']);
        $this->assertTrue($receipt['auto_print']);
        $this->assertSame('', $receipt['footer']);
        $this->assertDatabaseHas('settings', ['key' => 'receipt', 'group' => 'receipt']);
        $this->getJson('/admin/pos')->assertOk()
            ->assertJsonPath('props.app_settings.receipt.paper_size', '58mm')
            ->assertJsonPath('props.app_settings.receipt.auto_print', true);
    }

    public function test_invalid_receipt_settings_do_not_save(): void
    {
        $this->actingAs($this->admin())->postJson('/admin/settings', $this->payload([
            'paper_size' => 'unsupported', 'footer' => str_repeat('x', 301), 'show_logo' => 'invalid',
        ]))->assertUnprocessable()->assertJsonValidationErrors(['receipt.paper_size', 'receipt.footer', 'receipt.show_logo']);
        $this->assertDatabaseMissing('settings', ['key' => 'receipt']);
    }

    public function test_a5_paper_size_can_be_saved(): void
    {
        $this->actingAs($this->admin())->post('/admin/settings', $this->payload(['paper_size' => 'A5']))
            ->assertSessionHasNoErrors()->assertRedirect();
        $this->getJson('/admin/settings?section=receipts')->assertOk()
            ->assertJsonPath('props.settings.receipt.paper_size', 'A5');
    }

    public function test_general_save_without_receipt_payload_preserves_receipt_settings(): void
    {
        app(AppSettingsService::class)->setMany(['receipt' => array_replace(AppSettingsService::RECEIPT_DEFAULTS, ['paper_size' => 'A4'])]);
        $payload = $this->payload();
        unset($payload['receipt']);
        $this->actingAs($this->admin())->post('/admin/settings', $payload)->assertSessionHasNoErrors();
        $this->assertSame('A4', app(AppSettingsService::class)->all()['receipt']['paper_size']);
    }

    public function test_customer_cannot_change_receipt_settings(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'customer']))
            ->postJson('/admin/settings', $this->payload())->assertForbidden();
        $this->assertDatabaseMissing('settings', ['key' => 'receipt']);
    }
}
