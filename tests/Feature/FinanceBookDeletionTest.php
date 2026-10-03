<?php

namespace Tests\Feature;

use App\Models\FinancialEntry;
use App\Models\Location;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FinanceBookDeletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_finance_book_records_can_be_deleted_when_there_are_no_approved_expenses(): void
    {
        [$admin, $location] = $this->financeBookData();

        $fundId = DB::table('finance_book_funds')->where('location_id', $location->id)->value('id');
        $this->actingAs($admin)
            ->delete("/admin/finance-book/funds/{$fundId}")
            ->assertSessionHas('success');

        $this->assertDatabaseMissing('finance_book_funds', ['location_id' => $location->id, 'entry_date' => '2026-10-03']);
        $this->assertDatabaseHas('finance_book_counts', ['location_id' => $location->id, 'entry_date' => '2026-10-03']);
    }

    public function test_approved_expenses_must_be_deleted_before_finance_book_records(): void
    {
        [$admin, $location] = $this->financeBookData();
        FinancialEntry::create([
            'recorded_by' => $admin->id,
            'location_id' => $location->id,
            'type' => 'expense',
            'category' => 'utilities',
            'title' => 'Electricity',
            'amount' => 5000,
            'entry_date' => '2026-10-03',
            'status' => 'approved',
        ]);

        $fundId = DB::table('finance_book_funds')->where('location_id', $location->id)->value('id');
        $this->actingAs($admin)
            ->delete("/admin/finance-book/funds/{$fundId}")
            ->assertSessionHas('error', "Delete this branch's approved expenses for the selected date first.");

        $this->assertDatabaseHas('finance_book_funds', ['location_id' => $location->id, 'entry_date' => '2026-10-03']);
        $this->assertDatabaseHas('finance_book_counts', ['location_id' => $location->id, 'entry_date' => '2026-10-03']);
    }

    private function financeBookData(): array
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $location = Location::create(['name' => 'Test Branch', 'code' => 'TEST-BRANCH', 'type' => 'warehouse', 'is_active' => true]);

        DB::table('finance_book_funds')->insert([
            'location_id' => $location->id,
            'recorded_by' => $admin->id,
            'entry_date' => '2026-10-03',
            'amount' => 10000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('finance_book_counts')->insert([
            'location_id' => $location->id,
            'recorded_by' => $admin->id,
            'entry_date' => '2026-10-03',
            'actual_balance' => 10000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return [$admin, $location];
    }
}
