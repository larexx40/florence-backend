# Florence Wholesale Store — Backend API Documentation

## Overview

Florence is a **wholesale-only** ecommerce platform. It sells bags, slippers, women's shoes, kitchenware, and household items in bulk/carton quantities. This document defines all business rules, data models, and API contracts for backend implementation.

---

## Core Business Rules

### 1. Wholesale Minimum Quantity

- Every product has a `min_order_qty`. A buyer **cannot** purchase below this number.
- Example: A bag carton has `min_order_qty: 12`. You must buy at least 12.

### 2. Prerequisite Variant Rule

- Some products require a **specific variant** to be in the cart before additional variants can be added.
- Example: For a shoe, you **must** include size 34 before adding any other size (35, 36, 37...).
- This is configured per product as `prerequisite_variant_id`.

### 3. Carton/Bundle Increment

- Some products must be bought in multiples of a fixed pack size (`order_increment`).
- Example: `order_increment: 6` means valid quantities are 6, 12, 18, etc.

### 4. Discount Rules

- **Flat discount**: A fixed percentage or amount off the product/order.
- **Tiered quantity discount**: Discount percentage increases as the quantity threshold is met.
- Example: Buy 10–19 units → 5% off, Buy 20–49 → 10% off, Buy 50+ → 15% off.
- Discounts can apply at **product level** or **order level**.

### 5. Store Credit

- Every user has a `store_credit_balance` (NGN amount) that accumulates when an order cannot be fully fulfilled.
- **Full non-fulfilment**: the entire amount paid for the order is awarded as store credit.
- **Partial non-fulfilment**: the amount paid for only the unfulfilled items is awarded as store credit.
- On checkout, store credit is **always applied first**. If the order total exceeds the available credit, the remaining balance is charged via Paystack.
- Store credit cannot be cashed out — it can only be spent on future orders.

---

## Data Models

### User

```json
{
  "id": "uuid",
  "email": "string",
  "phone": "string",
  "first_name": "string",
  "last_name": "string",
  "business_name": "string",
  "role": "customer | admin",
  "is_active": "boolean",
  "store_credit_balance": "decimal",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

> `email` is the **unique identifier** for every user. There is no self-registration — accounts are created by admin only.
> `store_credit_balance` — running NGN total. Always recompute from the `StoreCreditTransaction` ledger for accuracy; this field is a denormalised cache for quick display.

---

### Address

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "full_name": "string",
  "phone": "string",
  "address_line1": "string",
  "address_line2": "string",
  "city": "string",
  "state": "string",
  "country": "string",
  "postal_code": "string",
  "is_default": "boolean"
}
```

---

### Category

```json
{
  "id": "uuid",
  "name": "string",
  "slug": "string",
  "description": "string",
  "image_url": "string",
  "parent_id": "uuid | null",
  "is_active": "boolean"
}
```

---

### Product

```json
{
  "id": "uuid",
  "name": "string",
  "slug": "string",
  "description": "string",
  "category_id": "uuid",
  "images": ["string"],
  "is_active": "boolean",
  "min_order_qty": "integer",
  "order_increment": "integer | null",
  "prerequisite_variant_id": "uuid | null",
  "has_variants": "boolean",
  "discount_id": "uuid | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Field Explanations:**

| Field | Description |
|---|---|
| `min_order_qty` | Minimum units that must be in cart for this product |
| `order_increment` | Quantity must be a multiple of this value (null = no restriction) |
| `prerequisite_variant_id` | A specific variant that must exist in the cart before adding other variants |
| `discount_id` | Linked discount rule (overrides global discount if set) |

---

### ProductVariant

```json
{
  "id": "uuid",
  "product_id": "uuid",
  "sku": "string",
  "name": "string",
  "attributes": {
    "size": "string",
    "color": "string"
  },
  "price": "decimal",
  "compare_at_price": "decimal | null",
  "stock_qty": "integer",
  "is_active": "boolean",
  "weight_kg": "decimal | null",
  "images": ["string"]
}
```

---

### Discount

```json
{
  "id": "uuid",
  "name": "string",
  "type": "flat_percent | flat_amount | tiered_quantity",
  "scope": "product | order",
  "value": "decimal | null",
  "tiers": [
    {
      "min_qty": "integer",
      "max_qty": "integer | null",
      "discount_percent": "decimal"
    }
  ],
  "starts_at": "datetime | null",
  "ends_at": "datetime | null",
  "is_active": "boolean"
}
```

**Discount Type Behaviour:**

| Type | `value` field | `tiers` field |
|---|---|---|
| `flat_percent` | e.g. `10` (= 10% off) | ignored |
| `flat_amount` | e.g. `500` (= NGN 500 off) | ignored |
| `tiered_quantity` | ignored | array of qty bands with % |

**Tiered Discount Example:**

```json
{
  "type": "tiered_quantity",
  "tiers": [
    { "min_qty": 10, "max_qty": 19, "discount_percent": 5 },
    { "min_qty": 20, "max_qty": 49, "discount_percent": 10 },
    { "min_qty": 50, "max_qty": null, "discount_percent": 15 }
  ]
}
```

---

### Cart

```json
{
  "id": "uuid",
  "user_id": "uuid | null",
  "session_id": "string | null",
  "items": ["CartItem"],
  "subtotal": "decimal",
  "discount_amount": "decimal",
  "total": "decimal",
  "validation_errors": ["string"],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### CartItem

```json
{
  "id": "uuid",
  "cart_id": "uuid",
  "product_id": "uuid",
  "variant_id": "uuid",
  "quantity": "integer",
  "unit_price": "decimal",
  "discounted_unit_price": "decimal",
  "line_total": "decimal"
}
```

---

### Order

```json
{
  "id": "uuid",
  "order_number": "string",
  "user_id": "uuid",
  "status": "pending | confirmed | processing | shipped | delivered | cancelled | partially_fulfilled | refunded",
  "payment_status": "unpaid | paid | partial | refunded | credited",
  "payment_method": "paystack | bank_transfer | cash_on_delivery",
  "shipping_address_id": "uuid",
  "items": ["OrderItem"],
  "subtotal": "decimal",
  "discount_amount": "decimal",
  "shipping_fee": "decimal",
  "store_credit_applied": "decimal",
  "paystack_amount": "decimal",
  "total": "decimal",
  "paystack_reference": "string | null",
  "paystack_access_code": "string | null",
  "notes": "string | null",
  "placed_at": "datetime",
  "updated_at": "datetime"
}
```

**Payment field explanations:**

| Field | Description |
|---|---|
| `store_credit_applied` | Amount deducted from user's store credit balance for this order |
| `paystack_amount` | Amount actually charged via Paystack (`total - store_credit_applied`) |
| `paystack_reference` | Paystack transaction reference (set after initialisation) |
| `paystack_access_code` | Paystack access code used to open the payment popup on the frontend |
| `status: partially_fulfilled` | Some items were shipped, others could not be fulfilled |
| `payment_status: credited` | Full refund was issued as store credit instead of cash |

### OrderItem

```json
{
  "id": "uuid",
  "order_id": "uuid",
  "product_id": "uuid",
  "variant_id": "uuid",
  "product_name": "string",
  "variant_name": "string",
  "sku": "string",
  "quantity": "integer",
  "quantity_fulfilled": "integer",
  "unit_price": "decimal",
  "discount_amount": "decimal",
  "line_total": "decimal",
  "fulfilment_status": "pending | fulfilled | partially_fulfilled | unfulfilled"
}
```

> `quantity_fulfilled` — set by admin when dispatching. If less than `quantity`, the item is partially fulfilled and the shortfall amount is credited to the user.

---

### StoreCreditTransaction

Immutable ledger — never update or delete rows, only append.

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "type": "credit | debit",
  "reason": "order_unfulfilled | order_partial | order_payment | admin_adjustment",
  "amount": "decimal",
  "balance_after": "decimal",
  "order_id": "uuid | null",
  "order_item_id": "uuid | null",
  "note": "string | null",
  "created_at": "datetime",
  "created_by": "uuid"
}
```

**`reason` values:**

| Reason | type | Description |
|---|---|---|
| `order_unfulfilled` | credit | Full order could not be fulfilled — entire paid amount credited |
| `order_partial` | credit | Some items unfulfilled — only the shortfall amount credited |
| `order_payment` | debit | Store credit used to pay for an order |
| `admin_adjustment` | credit / debit | Manual correction by admin |

---

## Cart Validation Rules

Every time a cart item is added or updated, the backend **must** validate:

### Rule 1 — Minimum Order Quantity

```
if (item.quantity < product.min_order_qty)
  → error: "Minimum order for {product.name} is {min_order_qty} units"
```

### Rule 2 — Order Increment

```
if (product.order_increment && item.quantity % product.order_increment !== 0)
  → error: "{product.name} must be ordered in multiples of {order_increment}"
```

### Rule 3 — Prerequisite Variant

```
if (product.prerequisite_variant_id is set)
  → check cart contains an item with variant_id == product.prerequisite_variant_id
  → if not found: error: "You must include {prerequisite_variant.name} before adding other variants of {product.name}"
```

### Rule 4 — Stock Check

```
if (item.quantity > variant.stock_qty)
  → error: "Only {stock_qty} units of {variant.name} available"
```

---

## Naming Conventions

| Layer | Convention | Example |
| --- | --- | --- |
| HTTP request/response bodies | **camelCase** | `storeCredit`, `orderNumber`, `minOrderQty` |
| Prisma schema / DB columns | **snake_case** | `store_credit`, `order_number`, `min_order_qty` |
| Redis cache keys | **colon-namespaced snake_case** | `prod:detail:leather-bag`, `cart:user:uuid` |
| JWT payload fields | **camelCase** | `userId`, `businessName` |

## API Endpoints

**Base URL:** `https://api.yourdomain.com/v1`

**Authentication:** Bearer token (JWT) in `Authorization` header.

---

### Auth

There is **no self-registration**. All buyer accounts are created by admin.
Login uses email + OTP (one-time password sent to the buyer's email).
Email is the unique identifier — no password is stored.

#### Auth Flow

```
1. Buyer requests OTP  →  POST /auth/otp/request  (email required)
2. Backend generates 6-digit OTP, stores it (hashed, TTL 10 minutes), sends email
3. Buyer submits OTP  →  POST /auth/otp/verify
4. Backend returns access_token + refresh_token
```

---

#### `POST /auth/otp/request`

Request a one-time login code. Returns `200` regardless of whether the email exists (prevent email enumeration).

**Request Body:**

```json
{
  "email": "string"
}
```

**Response `200`:**

```json
{
  "message": "If this email is registered, a login code has been sent."
}
```

**Backend actions:**

1. Look up user by email.
2. If found and `is_active`: generate 6-digit OTP, hash it (bcrypt/SHA-256), store with 10-minute TTL, send email.
3. If not found or inactive: do nothing but still return `200`.

---

#### `POST /auth/otp/verify`

Submit the OTP to complete login.

**Request Body:**

```json
{
  "email": "string",
  "otp": "string"
}
```

**Response `200`:**

```json
{
  "access_token": "string",
  "refresh_token": "string",
  "user": {
    "id": "uuid",
    "email": "string",
    "first_name": "string",
    "business_name": "string",
    "role": "customer | admin",
    "store_credit_balance": 15000.00
  }
}
```

**Response `401`:** OTP invalid or expired.

**Backend actions:**

1. Look up user by email, verify `is_active`.
2. Verify OTP hash matches and has not expired.
3. Invalidate the OTP immediately (single-use).
4. Issue JWT access token (15-minute TTL) and refresh token (30-day TTL).

---

#### `POST /auth/refresh`

**Request Body:** `{ "refresh_token": "string" }`

**Response `200`:** `{ "access_token": "string" }`

---

#### `POST /auth/logout`

Invalidates the refresh token. Requires auth.

---

### Users

#### `GET /users/me`

Returns the authenticated user's profile including store credit balance.

#### `PUT /users/me`

Update own profile (`first_name`, `last_name`, `phone`, `business_name`).
Email cannot be changed — contact admin to update email.

---

### Addresses

#### `GET /users/me/addresses`

List all saved addresses.

#### `POST /users/me/addresses`

Create a new address.

#### `PUT /users/me/addresses/:id`

Update an address.

#### `DELETE /users/me/addresses/:id`

#### `PATCH /users/me/addresses/:id/default`

Set an address as the default.

---

### Categories

#### `GET /categories`

Returns all active categories (nested tree if `parent_id` used).

**Query Params:** `?flat=true` to return a flat list.

**Response `200`:**

```json
[
  {
    "id": "uuid",
    "name": "Bags",
    "slug": "bags",
    "image_url": "string",
    "children": [...]
  }
]
```

#### `GET /categories/:slug`

Returns a single category and its direct children.

---

### Products

#### `GET /products`

List all active products with pagination.

**Query Params:**

| Param | Type | Description |
|---|---|---|
| `category` | string | Filter by category slug |
| `search` | string | Keyword search on name/description |
| `sort` | string | `price_asc`, `price_desc`, `newest` |
| `page` | integer | Default: 1 |
| `limit` | integer | Default: 20, Max: 100 |
| `min_price` | decimal | Filter by minimum price |
| `max_price` | decimal | Filter by maximum price |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "slug": "string",
      "images": ["string"],
      "min_order_qty": 12,
      "order_increment": 6,
      "category": { "id": "uuid", "name": "string" },
      "price_range": { "min": 2500.00, "max": 3200.00 },
      "discount": { "type": "tiered_quantity", "summary": "Up to 15% off" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 85, "pages": 5 }
}
```

---

#### `GET /products/:slug`

Returns full product detail including variants, wholesale rules, and discount.

**Response `200`:**

```json
{
  "id": "uuid",
  "name": "string",
  "slug": "string",
  "description": "string",
  "images": ["string"],
  "min_order_qty": 12,
  "order_increment": 6,
  "prerequisite_variant": {
    "id": "uuid",
    "name": "Size 34",
    "note": "You must include Size 34 in your order before adding other sizes"
  },
  "variants": [
    {
      "id": "uuid",
      "name": "Size 34",
      "sku": "SH-34-BLK",
      "attributes": { "size": "34", "color": "Black" },
      "price": 2800.00,
      "compare_at_price": 3200.00,
      "stock_qty": 240,
      "is_active": true,
      "images": ["string"]
    }
  ],
  "discount": {
    "type": "tiered_quantity",
    "tiers": [
      { "min_qty": 10, "max_qty": 19, "discount_percent": 5 },
      { "min_qty": 20, "max_qty": null, "discount_percent": 10 }
    ]
  }
}
```

---

### Cart

Cart is identified by either JWT user session or a guest `session_id` (cookie/local storage).

#### `GET /cart`

Returns the current cart with all validation states.

**Response `200`:**

```json
{
  "id": "uuid",
  "items": [
    {
      "id": "uuid",
      "product": { "id": "uuid", "name": "string", "slug": "string" },
      "variant": { "id": "uuid", "name": "Size 34", "sku": "string" },
      "quantity": 12,
      "unit_price": 2800.00,
      "discounted_unit_price": 2660.00,
      "line_total": 31920.00,
      "validation_error": null
    }
  ],
  "subtotal": 31920.00,
  "discount_amount": 1680.00,
  "total": 31920.00,
  "is_valid": true
}
```

---

#### `POST /cart/items`

Add an item to the cart. Triggers all validation rules.

**Request Body:**

```json
{
  "product_id": "uuid",
  "variant_id": "uuid",
  "quantity": 12
}
```

**Response `200`:** Updated cart object.

**Response `422` (Validation Failure):**

```json
{
  "error": "CART_VALIDATION_FAILED",
  "message": "You must include Size 34 before adding other sizes of this shoe",
  "code": "PREREQUISITE_VARIANT_MISSING"
}
```

---

#### `PATCH /cart/items/:id`

Update quantity of an existing cart item.

**Request Body:** `{ "quantity": 24 }`

**Response `200`:** Updated cart object.

---

#### `DELETE /cart/items/:id`

Remove an item from the cart.

---

#### `DELETE /cart`

Clear the entire cart.

---

#### `POST /cart/merge`

Merge guest cart into user cart after login.

**Request Body:** `{ "session_id": "string" }`

---

### Orders

#### `POST /orders`

Place an order from the current cart. Cart must pass all validations.
Store credit is applied automatically at this step — no separate request needed.

**Request Body:**

```json
{
  "shipping_address_id": "uuid",
  "payment_method": "paystack | cash_on_delivery",
  "use_store_credit": true,
  "notes": "string | null"
}
```

> Set `use_store_credit: false` to skip credit application even if balance exists.

**Backend Logic:**

```
order.subtotal      = sum of all cart line totals
order.discount_amount = sum of all applied discounts

if use_store_credit and user.store_credit_balance > 0:
  credit_to_use = min(user.store_credit_balance, order.total)
  order.store_credit_applied = credit_to_use
  user.store_credit_balance -= credit_to_use
  append StoreCreditTransaction(type=debit, reason=order_payment, amount=credit_to_use)
else:
  order.store_credit_applied = 0

order.paystack_amount = order.total - order.store_credit_applied

if order.paystack_amount == 0:
  order.payment_status = "paid"
  order.status = "confirmed"
  // No Paystack call needed — fully covered by credit
else:
  order.payment_status = "unpaid"
  order.status = "pending"
  // Frontend must call POST /payments/paystack/initialize next
```

**Response `201`:**

```json
{
  "id": "uuid",
  "order_number": "FLR-20240401-00123",
  "status": "pending | confirmed",
  "payment_status": "unpaid | paid",
  "subtotal": 35000.00,
  "store_credit_applied": 15000.00,
  "paystack_amount": 20000.00,
  "total": 35000.00,
  "requires_payment": true
}
```

> If `requires_payment: false`, the order is fully paid by credit — skip Paystack initialisation.

---

#### `GET /orders`

List the authenticated user's orders.

**Query Params:** `?status=pending&page=1&limit=10`

**Response `200`:**

```json
{
  "data": [
    {
      "id": "uuid",
      "order_number": "FLR-20240401-00123",
      "status": "confirmed",
      "total": 31920.00,
      "items_count": 3,
      "placed_at": "datetime"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 4 }
}
```

---

#### `GET /orders/:id`

Full order detail with all items and status history.

---

#### `POST /orders/:id/cancel`

Cancel a pending/confirmed order. Not allowed once status is `shipped`.

---

### Payments (Paystack)

#### Payment Flow Overview

```
1. User places order  →  POST /orders  (store credit deducted here if available)
2. If paystack_amount > 0:
     →  POST /payments/paystack/initialize  (get access_code)
     →  Frontend opens Paystack popup with access_code
     →  User completes payment on Paystack
     →  Paystack fires webhook  →  POST /webhooks/paystack
     →  Backend verifies + confirms order
3. If paystack_amount == 0 (fully covered by store credit):
     →  Order auto-confirmed immediately, no Paystack call needed
```

---

#### `POST /payments/paystack/initialize`

Call this after `POST /orders` when `order.paystack_amount > 0`.
Initialises a Paystack transaction and returns the `access_code` for the frontend popup.

**Request Body:**

```json
{
  "order_id": "uuid"
}
```

**Response `200`:**

```json
{
  "access_code": "string",
  "authorization_url": "string",
  "reference": "string"
}
```

> Save `reference` on the Order as `paystack_reference`. The frontend uses `access_code` to open `PaystackPop.newTransaction({ key, accessCode })`.

**Backend actions:**

1. Look up the order, confirm it belongs to the authenticated user and `payment_status` is `unpaid`.
2. Call Paystack `POST /transaction/initialize` with:
   - `email` — user's email
   - `amount` — `order.paystack_amount` in **kobo** (multiply NGN × 100)
   - `reference` — `order.order_number` (or a generated unique ref)
   - `metadata` — `{ order_id, user_id }`
3. Store `access_code` and `reference` on the Order record.
4. Return `access_code` and `reference` to the frontend.

---

#### `GET /payments/paystack/verify/:reference`

Manual verification endpoint (fallback if webhook is delayed or missed).

**Response `200`:**

```json
{
  "order_id": "uuid",
  "payment_status": "paid",
  "order_status": "confirmed",
  "amount_paid": 31920.00
}
```

**Backend actions:**

1. Call Paystack `GET /transaction/verify/:reference`.
2. Confirm `data.status == "success"` and `data.amount == order.paystack_amount * 100`.
3. If valid: mark `order.payment_status = paid`, `order.status = confirmed`, deduct stock.
4. If already processed (idempotent): return current status without duplicate processing.

---

#### `POST /webhooks/paystack`

Paystack calls this URL automatically after every transaction event.
**This is the primary payment confirmation path.**

**Headers from Paystack:**

```
x-paystack-signature: <HMAC-SHA512 of raw request body using your secret key>
```

**Webhook Payload (charge.success event):**

```json
{
  "event": "charge.success",
  "data": {
    "reference": "FLR-20240401-00123",
    "status": "success",
    "amount": 3192000,
    "currency": "NGN",
    "paid_at": "2024-04-01T12:34:56Z",
    "customer": {
      "email": "buyer@example.com"
    },
    "metadata": {
      "order_id": "uuid",
      "user_id": "uuid"
    }
  }
}
```

**Signature Verification (must be done before any processing):**

```js
const hash = crypto
  .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
  .update(rawRequestBody)        // use raw Buffer, not parsed JSON
  .digest('hex');

if (hash !== req.headers['x-paystack-signature']) {
  return res.status(401).send('Invalid signature');
}
```

**Processing Logic:**

```
1. Verify signature — reject with 401 if invalid
2. Check event == "charge.success" — ignore other events, respond 200
3. Look up Order by paystack_reference
4. If order.payment_status already == "paid" → respond 200 (idempotent, already processed)
5. Verify data.amount / 100 == order.paystack_amount (within 1 NGN tolerance for rounding)
6. In a DB transaction:
   a. Set order.payment_status = "paid"
   b. Set order.status = "confirmed"
   c. Deduct stock for each OrderItem
   d. Clear the user's cart
7. Send order confirmation email/SMS to the buyer
8. Respond 200 immediately — Paystack retries on non-200 responses
```

> Always respond `200` to Paystack even if your internal processing fails after signature verification. Log the failure and reprocess manually to avoid Paystack retrying and double-processing.

**Other Webhook Events to Handle:**

| Event | Action |
|---|---|
| `charge.success` | Confirm order, deduct stock |
| `transfer.success` | (future) Confirm refund was sent |
| `transfer.failed` | (future) Alert admin, fall back to store credit |

---

### Store Credit

#### `GET /users/me/store-credit`

Returns the authenticated user's current credit balance and a summary.

**Response `200`:**

```json
{
  "balance": 15000.00,
  "currency": "NGN",
  "last_credited_at": "datetime",
  "last_credited_amount": 8500.00
}
```

---

#### `GET /users/me/store-credit/transactions`

Full paginated ledger of all credit/debit entries for the user.

**Query Params:** `?page=1&limit=20&type=credit`

**Response `200`:**

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "credit",
      "reason": "order_partial",
      "amount": 8500.00,
      "balance_after": 15000.00,
      "order_id": "uuid",
      "order_number": "FLR-20240401-00123",
      "note": "2 units of Black Bag (Size M) could not be fulfilled",
      "created_at": "datetime"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 6 }
}
```

---

### Discounts (Admin reference, applied automatically)

#### `GET /discounts`

List all discount rules (admin only).

#### `POST /discounts`

Create a new discount rule.

**Request Body:**

```json
{
  "name": "Shoe Bulk Deal",
  "type": "tiered_quantity",
  "scope": "product",
  "tiers": [
    { "min_qty": 10, "max_qty": 19, "discount_percent": 5 },
    { "min_qty": 20, "max_qty": null, "discount_percent": 10 }
  ],
  "starts_at": "2024-04-01T00:00:00Z",
  "ends_at": null,
  "is_active": true
}
```

#### `PUT /discounts/:id`

Update a discount rule.

#### `DELETE /discounts/:id`

---

## Admin Endpoints

All admin routes require `role: admin` in the JWT.

### `GET /admin/users`

List all users. Filters: `?role=customer&is_active=true&search=email_or_name`

---

### `POST /admin/users`

Create a new buyer account. Email must be unique.

**Request Body:**

```json
{
  "email": "string",
  "phone": "string",
  "first_name": "string",
  "last_name": "string",
  "business_name": "string"
}
```

**Response `201`:** User object. A welcome email with login instructions is sent automatically.

---

### `PUT /admin/users/:id`

Update buyer details (`phone`, `first_name`, `last_name`, `business_name`).
Email cannot be changed after creation — it is the permanent unique identifier.

---

### `PATCH /admin/users/:id/deactivate`

Deactivate a buyer account. They will no longer be able to request an OTP.

### `PATCH /admin/users/:id/activate`

Re-activate a previously deactivated account.

### `GET /admin/orders`

List all orders. Supports filters: `?status=pending&payment_status=unpaid`

### `PATCH /admin/orders/:id/status`

Update order status.

**Request Body:** `{ "status": "processing | shipped | delivered | cancelled" }`

### `PATCH /admin/orders/:id/payment-status`

Manually mark payment.

**Request Body:** `{ "payment_status": "paid | partial | refunded" }`

### `GET /admin/products`

List all products including inactive.

### `POST /admin/products`

Create a product. Include all wholesale rules in request body.

### `PUT /admin/products/:id`

Full update of a product.

### `PATCH /admin/products/:id/variants/:variantId/stock`

Adjust stock quantity.

**Request Body:** `{ "adjustment": 100, "reason": "restock" }`

### `GET /admin/dashboard`

Returns summary metrics: total orders, revenue, pending approvals, low-stock products.

---

### Admin — Store Credit Management

#### `GET /admin/users/:id/store-credit`

View a user's credit balance and full transaction ledger.

---

#### `POST /admin/users/:id/store-credit/award`

Manually award or deduct store credit (e.g. goodwill, correction).

**Request Body:**

```json
{
  "type": "credit | debit",
  "amount": 5000.00,
  "reason": "admin_adjustment",
  "note": "Compensation for delayed shipment on order FLR-00120"
}
```

**Response `200`:**

```json
{
  "new_balance": 20000.00,
  "transaction_id": "uuid"
}
```

---

### Admin — Order Fulfilment

#### `PATCH /admin/orders/:id/fulfil`

Record actual quantities fulfilled per item. Triggers store credit award for any shortfall automatically.

**Request Body:**

```json
{
  "items": [
    { "order_item_id": "uuid", "quantity_fulfilled": 12 },
    { "order_item_id": "uuid", "quantity_fulfilled": 0 }
  ]
}
```

**Backend Logic:**

```
For each item in request:
  shortfall = item.quantity - quantity_fulfilled
  if shortfall > 0:
    credit_amount = shortfall * item.unit_price (after discount)
    append StoreCreditTransaction:
      type = "credit"
      reason = quantity_fulfilled == 0 ? "order_unfulfilled" : "order_partial"
      amount = credit_amount
      order_id = order.id
      order_item_id = item.id
      note = "{shortfall} units of {product_name} could not be fulfilled"
    update user.store_credit_balance += credit_amount

After processing all items:
  if all items unfulfilled:
    order.status = "cancelled"
    order.payment_status = "credited"
  elif any items unfulfilled:
    order.status = "partially_fulfilled"
  else:
    order.status = "fulfilled"

Notify buyer via email/SMS with credit details
```

**Response `200`:**

```json
{
  "order_status": "partially_fulfilled",
  "items": [
    {
      "order_item_id": "uuid",
      "quantity_ordered": 12,
      "quantity_fulfilled": 10,
      "shortfall": 2,
      "credit_awarded": 5600.00
    }
  ],
  "total_credit_awarded": 5600.00,
  "user_new_credit_balance": 20600.00
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "details": {}
}
```

**Common Error Codes:**

| Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions or unapproved account |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 422 | Request body failed validation |
| `CART_VALIDATION_FAILED` | 422 | Cart business rule violated |
| `MIN_QTY_NOT_MET` | 422 | Quantity below `min_order_qty` |
| `INCREMENT_VIOLATION` | 422 | Quantity is not a valid multiple of `order_increment` |
| `PREREQUISITE_VARIANT_MISSING` | 422 | Required prerequisite variant not in cart |
| `INSUFFICIENT_STOCK` | 422 | Requested quantity exceeds available stock |
| `ACCOUNT_INACTIVE` | 403 | Account has been deactivated by admin |
| `OTP_INVALID` | 401 | OTP is incorrect or has expired |
| `OTP_ALREADY_USED` | 401 | OTP has already been consumed |
| `ORDER_NOT_CANCELLABLE` | 409 | Order is in a non-cancellable state |
| `INVALID_PAYSTACK_SIGNATURE` | 401 | Webhook signature verification failed |
| `PAYMENT_AMOUNT_MISMATCH` | 422 | Paystack amount does not match order total |
| `INSUFFICIENT_STORE_CREDIT` | 422 | Debit exceeds available store credit balance |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Discount Calculation Logic

```
function calculateLineTotal(item, product, discount):
  base_total = item.quantity * item.unit_price

  if discount is null:
    return base_total

  if discount.type == "flat_percent":
    return base_total * (1 - discount.value / 100)

  if discount.type == "flat_amount":
    return max(0, base_total - discount.value)

  if discount.type == "tiered_quantity":
    matched_tier = find tier where item.quantity >= tier.min_qty
                   and (tier.max_qty is null OR item.quantity <= tier.max_qty)
    if matched_tier:
      return base_total * (1 - matched_tier.discount_percent / 100)
    return base_total
```

---

## Internal Event / Notification Hooks

These are internal application events (not Paystack webhooks) that should trigger emails or SMS to buyers.

| Event | Trigger | Notify |
| --- | --- | --- |
| `user.created` | Admin creates a buyer account | Buyer — welcome + login instructions |
| `user.deactivated` | Admin deactivates account | Buyer — account suspended notice |
| `order.placed` | New order created | Buyer — order confirmation |
| `order.confirmed` | Payment verified via Paystack | Buyer — payment received |
| `order.shipped` | Admin marks as shipped | Buyer — tracking info |
| `order.delivered` | Admin marks as delivered | Buyer — delivery confirmation |
| `order.cancelled` | Order cancelled | Buyer — cancellation + credit notice if applicable |
| `order.partially_fulfilled` | Admin records partial fulfilment | Buyer — items shipped + credit awarded for shortfall |
| `credit.awarded` | Store credit credited to user | Buyer — credit amount and new balance |
| `stock.low` | Variant stock below threshold | Admin — restock alert |

---

## Redis Caching Strategy

Stack: **NestJS** + **`@nestjs/cache-manager`** + **`keyv`** / **`cache-manager-ioredis`**

### Setup

```ts
// app.module.ts
CacheModule.registerAsync({
  isGlobal: true,
  useFactory: () => ({
    store: redisStore,
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    ttl: 0, // no default TTL — set explicitly per cache entry
  }),
})
```

Use `CACHE_MANAGER` injection for manual control. Do **not** use `@CacheInterceptor` globally — cache only at the service layer so you control keys and TTLs precisely.

---

### Cache Key Convention

All keys follow the pattern: `{namespace}:{entity}:{identifier}`

```
prod:list:{queryHash}         product listing page (hashed query params)
prod:detail:{slug}            single product with variants + discount
cat:tree                      full category tree
cat:detail:{slug}             single category with children
cart:user:{userId}            authenticated user's cart
cart:guest:{sessionId}        guest cart
otp:{email}                   hashed OTP token for login
user:profile:{userId}         user profile (name, business, credit balance)
```

`queryHash` is a deterministic hash (e.g. SHA-256 first 8 chars) of sorted query params: `category + search + sort + page + limit + minPrice + maxPrice`.

---

### TTL Reference

| Key Pattern | TTL | Reason |
| --- | --- | --- |
| `cat:tree` | 3600s (1 hr) | Categories change rarely |
| `cat:detail:{slug}` | 3600s (1 hr) | Same |
| `prod:detail:{slug}` | 600s (10 min) | Stock/price can change |
| `prod:list:{queryHash}` | 300s (5 min) | High read, acceptable staleness |
| `cart:user:{userId}` | 604800s (7 days) | Keep cart alive across sessions |
| `cart:guest:{sessionId}` | 86400s (1 day) | Shorter — guest may not return |
| `otp:{email}` | 600s (10 min) | OTP expires in 10 min — TTL enforces it |
| `user:profile:{userId}` | 900s (15 min) | Infrequently updated |

**Never cache:**

- Orders — real-time accuracy required
- Payments / Paystack references — financial data
- Store credit balance — read directly from DB ledger sum
- Admin dashboard metrics — must reflect live state

---

### Cache Pattern: Cache-Aside (Lazy Loading)

Used for products and categories. Read from cache first; on miss, read from DB and populate cache.

```ts
// products.service.ts
async findBySlug(slug: string): Promise<ProductDetailDto> {
  const key = `prod:detail:${slug}`;

  const cached = await this.cache.get<ProductDetailDto>(key);
  if (cached) return cached;

  const product = await this.prisma.product.findUniqueOrThrow({
    where: { slug },
    include: { variants: true, discount: true, category: true },
  });

  const dto = plainToClass(ProductDetailDto, product);  // snake → camelCase
  await this.cache.set(key, dto, 600_000); // 10 min in ms
  return dto;
}
```

---

### Cache Pattern: Write-Through (Cart)

Cart is always written to Redis immediately on every mutation. The DB is the source of truth but the cart is read exclusively from Redis during a session. Cart is persisted to DB only when an order is placed.

```ts
// cart.service.ts
async addItem(userId: string, dto: AddCartItemDto): Promise<CartDto> {
  const key = `cart:user:${userId}`;

  let cart = await this.cache.get<CartDto>(key) ?? emptyCart(userId);

  cart = applyCartRules(cart, dto);   // validates min qty, increments, prereqs
  cart = applyDiscounts(cart);

  await this.cache.set(key, cart, 604_800_000); // 7 days
  return cart;
}

// On POST /orders — flush cart from Redis + persist order to DB
async checkout(userId: string): Promise<Order> {
  const key = `cart:user:${userId}`;
  const cart = await this.cache.get<CartDto>(key);
  // ... create order in DB ...
  await this.cache.del(key);
}
```

---

### Cache Pattern: Short-TTL Store (OTP)

OTP is stored in Redis — no separate DB table needed. Redis TTL enforces expiry automatically.

```ts
// auth.service.ts
async requestOtp(email: string): Promise<void> {
  const user = await this.prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return; // silent — no enumeration

  const otp = generateSixDigitOtp();
  const hashed = await bcrypt.hash(otp, 10);
  const key = `otp:${email}`;

  await this.cache.set(key, hashed, 600_000); // 10 min
  await this.mailer.sendOtp(email, otp);
}

async verifyOtp(email: string, otp: string): Promise<Tokens> {
  const key = `otp:${email}`;
  const hashed = await this.cache.get<string>(key);

  if (!hashed) throw new UnauthorizedException('OTP expired or not requested');

  const valid = await bcrypt.compare(otp, hashed);
  if (!valid) throw new UnauthorizedException('Invalid OTP');

  await this.cache.del(key); // single-use — delete immediately
  return this.issueTokens(email);
}
```

---

### Cache Invalidation Rules

Invalidation is done manually in the service layer whenever data changes. Never rely on TTL alone for data that admin has just updated.

| Admin Action | Keys to Delete |
| --- | --- |
| Create / update / delete product | `prod:detail:{slug}`, `prod:list:*` |
| Update product stock | `prod:detail:{slug}`, `prod:list:*` |
| Create / update / delete category | `cat:tree`, `cat:detail:{slug}` |
| Update user profile | `user:profile:{userId}` |
| Deactivate user | `user:profile:{userId}`, `cart:user:{userId}` |

**Wildcard deletion for listing pages** — use Redis `SCAN` + `DEL`, not `KEYS` (blocks server):

```ts
// cache.service.ts
async deleteByPattern(pattern: string): Promise<void> {
  const client = this.cache.store.getClient(); // ioredis client
  let cursor = '0';
  do {
    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length) await client.del(...keys);
  } while (cursor !== '0');
}

// Usage in products.service.ts after update:
await this.cacheService.deleteByPattern('prod:list:*');
await this.cache.del(`prod:detail:${slug}`);
```

---

### Refresh Token Storage

Refresh tokens are stored in Redis (not DB) with the user ID as metadata. On logout or deactivation, the token is deleted immediately — no waiting for expiry.

```txt
Key:    refresh:{tokenId}        (tokenId = random UUID embedded in the signed JWT)
Value:  { userId, issuedAt }
TTL:    2592000s (30 days)
```

```ts
// On login: store in Redis
await this.cache.set(`refresh:${tokenId}`, { userId }, 2_592_000_000);

// On refresh: verify exists in Redis, issue new access token
// On logout: delete from Redis immediately
await this.cache.del(`refresh:${tokenId}`);

// On user deactivation: scan and delete all refresh:{tokenId} for that userId
// (store userId→[tokenId] index in Redis for O(1) lookup)
```

---

### What NOT to Do

- Do not use `@CacheInterceptor` on controllers — you lose key control and cannot invalidate reliably.
- Do not cache by URL path — query param order differences create duplicate keys. Always hash sorted params.
- Do not use `KEYS *` pattern in production — use `SCAN` instead.
- Do not store store credit balance in Redis — always compute from the `StoreCreditTransaction` ledger to avoid financial discrepancies.
- Do not cache order data — order status and payment status must always reflect DB truth.

---

## Suggested Tech Stack

| Layer | Recommendation |
|---|---|
| Language | Node.js (TypeScript) / Python (FastAPI) |
| Database | PostgreSQL |
| ORM | Prisma (Node) / SQLAlchemy (Python) |
| Auth | JWT (access + refresh tokens) |
| File Storage | AWS S3 |
| Payment Gateway | Paystack or Flutterwave |
| Cache | Redis (cart sessions, rate limiting) |
| API Docs | Swagger / OpenAPI 3.0 |

---

*Document version: 1.0 — Florence Wholesale Ecommerce*
