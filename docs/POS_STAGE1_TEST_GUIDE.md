# POS Stage 1 Test Guide — Register Shift, Cash Tender, and Change

## Automated verification

1. Create the MySQL test database if it does not exist:

   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS music_store_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

2. Ensure the test database credentials in `.env.testing` or `phpunit.xml` are correct.
3. Run the focused POS tests:

   ```bash
   ./vendor/bin/phpunit --filter=ProductUnitArchitectureTest
   ```

4. Run the complete suite:

   ```bash
   ./vendor/bin/phpunit
   ```

5. Build the frontend:

   ```bash
   npm run build
   ```

## Manual cashier test

1. Sign in as a cashier who has POS, shift-open, and warehouse access permissions.
2. Open **Admin → POS**.
3. Select the warehouse and add a product to the cart.
4. Select **Complete Sale**.
5. Select a register. If it has no current shift, enter the physical opening cash and choose **Open shift**.
6. Confirm that the green open-shift message shows the shift number and opening cash.
7. Select **Cash**.
8. Enter less than the sale total. Confirm that checkout is disabled and an underpayment error appears.
9. Enter more than the sale total. Confirm that the correct change is displayed.
10. Complete the sale and open the receipt.
11. Confirm that the receipt/order has the selected register, shift, cashier, amount tendered, and change due.
12. Open the database or shift report and confirm:
    - `orders.register_id` is populated.
    - `orders.shift_id` is populated.
    - The payment uses the same register and shift.
    - `pos_shifts.cash_sales` increased by the sale total, not by the cash received.
    - `pos_shifts.expected_cash = opening_cash + cash_sales - cash_refunds`.

## Card/mobile test

1. Build another cart and choose **Card** or **Mobile**.
2. Complete the sale.
3. Confirm that amount tendered equals the sale total and change due is zero.
4. Confirm that the payment is linked to the active register and shift.
5. Confirm that non-cash payments do not increase `pos_shifts.cash_sales`.

## Negative/security tests

1. Close a shift and attempt to reuse its ID; the server must reject it.
2. Attempt to use another cashier's shift; the server must reject it.
3. Attempt to use a shift from another warehouse; the server must reject it.
4. Submit cash below the total directly to the checkout endpoint; the server must reject it even if frontend validation is bypassed.

## Video walkthrough shot list

1. Show the register configuration page.
2. Open POS and select a warehouse.
3. Add one Piece and one Box selling unit.
4. Open a register shift with opening cash.
5. Demonstrate rejected underpayment.
6. Enter cash received and show calculated change.
7. Complete and print the sale.
8. Show register, shift, tender, and change on the saved transaction.
9. Show the shift cash total and expected cash calculation.
10. Repeat briefly with a mobile payment to show that drawer cash does not increase.
