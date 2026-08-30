# Today’s Feature Test Checklist

This checklist covers the functional work completed today. Automated-test counts,
build results, and video-recording accomplishments are intentionally not listed as
features.

## Checkout and upload handling

- Submit checkout with valid customer, delivery, and payment information.
- Confirm the order is created and the success page is shown.
- Submit invalid checkout information and confirm the validation message remains
  visible after the redirect.
- Upload a payment proof larger than 10 MB and confirm a readable
  `payment_proof` error is shown instead of a Laravel exception page.
- Correct the invalid field or file and confirm checkout can be submitted again.

## Customer selling units

- Open a product that supports Piece and Box.
- Select Piece and add it to the cart.
- Change the cart selling-unit selector from Piece to Box.
- Confirm the unit label, unit price, available quantity, and line total update.
- Change the quantity and confirm it cannot exceed converted stock.
- Submit the order and confirm the selected selling unit appears in order history
  and order details.

## Admin POS register and shift

- Log in as an administrator and open Admin POS.
- Select a register and confirm checkout is blocked while no cashier shift is open.
- Enter opening cash and open a shift.
- Add a product and switch its selling unit from Piece to Box.
- Open the payment window and enter less cash than the total; confirm completion is
  blocked.
- Enter sufficient cash and confirm the correct change is displayed.
- Complete the sale and confirm register, shift, payment, cash sales, expected cash,
  and order records are updated.

## Expected result

All checks must pass without an unhandled exception. Prices, converted stock,
selling units, tendered cash, and change must match the resulting order records.

## One-command automated run

From the project root, run:

```bash
bash tests/run_today_complete_test.sh
```

The command runs the Laravel suite, frontend build, PHP/diff checks, real Firefox
POS automation, and exports a timestamped MP4 under `artifacts/`.

The browser portion uses the existing demo data and expects the admin account
`admin@onlineshop.com` with password `password`, plus the Aquila demo product.
