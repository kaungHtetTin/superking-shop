<?php

namespace App\Services;

use App\Models\CustomerCreditTransaction;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomerCreditService
{
    public function balance(User|int $customer): float
    {
        $customerId = $customer instanceof User ? $customer->id : $customer;

        return round((float) CustomerCreditTransaction::where('customer_id', $customerId)->sum('amount'), 2);
    }

    public function availableCredit(User $customer): float
    {
        return max(0, round((float) $customer->credit_limit - $this->balance($customer), 2));
    }

    public function assertCanBorrow(User $customer, float $amount): void
    {
        if ($customer->role !== User::CUSTOMER_ROLE || $customer->credit_status !== 'active') {
            throw ValidationException::withMessages(['customer_id' => 'Credit sales are not enabled for this customer.']);
        }

        if ($amount <= 0) {
            throw ValidationException::withMessages(['credit_amount' => 'Credit amount must be greater than zero.']);
        }

        $balance = $this->balance($customer);
        if ($balance + $amount > (float) $customer->credit_limit + 0.009) {
            throw ValidationException::withMessages([
                'credit_amount' => 'This sale exceeds the customer credit limit. Available credit: '.number_format(max(0, (float) $customer->credit_limit - $balance), 2),
            ]);
        }
    }

    public function recordSale(User $customer, Order $order, float $amount, User $actor): CustomerCreditTransaction
    {
        $this->assertCanBorrow($customer, $amount);

        return $this->record($customer, [
            'order_id' => $order->id,
            'register_id' => $order->register_id,
            'shift_id' => $order->shift_id,
            'created_by' => $actor->id,
            'type' => 'sale',
            'amount' => $amount,
            'reference' => $order->receipt_number,
            'due_date' => $order->credit_due_date,
            'notes' => 'Credit sale',
        ]);
    }

    public function recordPayment(User $customer, ?Order $order, Payment $payment, User $actor, ?string $notes = null): CustomerCreditTransaction
    {
        return $this->record($customer, [
            'order_id' => $order?->id,
            'payment_id' => $payment->id,
            'register_id' => $payment->register_id,
            'shift_id' => $payment->shift_id,
            'created_by' => $actor->id,
            'type' => 'payment',
            'amount' => -(float) $payment->amount,
            'tender_type' => $payment->tender_type,
            'reference' => $payment->transaction_id,
            'notes' => $notes ?: 'Credit payment',
        ]);
    }

    public function reverseOrderBalance(User $customer, Order $order, User $actor, string $notes): ?CustomerCreditTransaction
    {
        $outstanding = round((float) $order->final_amount - (float) $order->paid_amount, 2);
        if ($outstanding <= 0) {
            return null;
        }

        return $this->record($customer, [
            'order_id' => $order->id,
            'register_id' => $order->register_id,
            'shift_id' => $order->shift_id,
            'created_by' => $actor->id,
            'type' => 'reversal',
            'amount' => -$outstanding,
            'reference' => $order->receipt_number,
            'notes' => $notes,
        ]);
    }

    private function record(User $customer, array $attributes): CustomerCreditTransaction
    {
        $locked = User::query()->lockForUpdate()->findOrFail($customer->id);
        $balanceAfter = round($this->balance($locked) + (float) $attributes['amount'], 2);

        if ($balanceAfter < -0.009) {
            throw ValidationException::withMessages(['amount' => 'Payment exceeds the customer outstanding balance.']);
        }

        return CustomerCreditTransaction::create(array_merge($attributes, [
            'transaction_number' => $this->number(),
            'customer_id' => $locked->id,
            'balance_after' => max(0, $balanceAfter),
        ]));
    }

    private function number(): string
    {
        do {
            $number = 'CR-'.now()->format('ymd').'-'.strtoupper(Str::random(6));
        } while (CustomerCreditTransaction::where('transaction_number', $number)->exists());

        return $number;
    }
}
