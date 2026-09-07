# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js (App Router) site for a warehouse ordering flow: a customer scans a QR code, lands on
the product catalog at `/`, and submits an order. The order is saved to the database and a
WhatsApp message is sent to the warehouse owner via the Meta WhatsApp Cloud API. There is no
buyer account system — orders are anonymous (name + phone captured per order). The warehouse
owner authenticates into `/admin` to manage products and view/update order status.

## Commands

- `npm run dev` — start the dev server.
- `npm run build` / `npm run start` — production build and serve.
- `npm run lint` — Next.js/ESLint checks.
- `npx prisma migrate dev --name <name>` — create and apply a migration after editing `prisma/schema.prisma`.
- `npx prisma generate` — regenerate the Prisma client (runs automatically after `migrate dev`).
- `npm run db:seed` — seed the admin user (from `SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD` in `.env`), categories, and sample products; fully idempotent (upserts everything by stable id/name), safe to re-run at any time.
- `npm run db:studio` — open Prisma Studio to inspect/edit the SQLite database directly.

There is no test suite configured yet.

## Architecture

**Database**: SQLite via Prisma (`prisma/schema.prisma`). Models: `Admin`, `Category`, `Product`,
`Order`, `OrderItem`, `Coupon`. SQLite has no enum support, so `Order.status` is a plain `String`
constrained at the application layer by `src/lib/order-status.ts` (`ORDER_STATUS.PENDING` /
`CONFIRMED` / `CANCELLED`) rather than a Prisma enum — use that constant instead of hardcoding
status strings. `src/lib/prisma.ts` exports a singleton client (guards against exhausting
connections from Next.js dev-mode hot reload).

`Product.categoryId` is nullable — products with no category fall into an "Other" bucket in the
UI rather than being required to pick one. Category deletion sets `categoryId` to null on its
products (`onDelete: SetNull`) rather than deleting them.

`Order.couponCode`/`Order.discountPercent` are a denormalized snapshot of whichever `Coupon` was
applied at checkout, not a foreign key — this is deliberate, so that deleting or deactivating a
coupon later doesn't change what past orders show. `Coupon.code` is always stored/compared
uppercased (done in the API layer, not the DB).

**Auth**: Single-role admin auth via NextAuth Credentials provider (`src/lib/auth.ts`), JWT
session strategy, no database session table. Admin passwords are bcrypt-hashed in the `Admin`
table. `src/middleware.ts` protects everything under `/admin` except `/admin/login` by
redirecting unauthenticated requests to the login page. There's no buyer-facing auth at all —
the catalog and order-submission API are fully public.

**Customer flow** (`src/app/page.tsx` + `src/app/order-catalog.tsx`): the page is a server
component that reads products directly via Prisma (no fetch round-trip); the catalog/cart/
checkout UI is a client component that posts to `POST /api/orders`.

**Admin flow** (`src/app/admin/**`): `layout.tsx` wraps every admin route in a `SessionProvider`
(`providers.tsx`) and conditionally renders the nav bar (`admin-chrome.tsx` hides it on the
login page, since that route isn't authenticated yet). Product and order management pages are
client components that call the JSON API routes directly.

**API routes** (`src/app/api/**`): `products` and `products/[id]` are public for GET, admin-only
(`getServerSession`) for mutations. `orders` GET (list) is admin-only; `orders` POST (create) is
public — this is the endpoint the customer checkout flow hits. `orders/[id]` PATCH (status
update) is admin-only.

**Order creation → WhatsApp** (`POST /api/orders` in `src/app/api/orders/route.ts`): creates the
`Order`+`OrderItem` rows, then calls `sendOrderWhatsAppMessage` (`src/lib/whatsapp.ts`), which
posts to the Meta Graph API. WhatsApp failures are caught and do **not** fail the order — the
order is always persisted; `whatsappError` is returned to the client and `Order.whatsappSentAt`
stays `null` so admins can see which orders failed to notify (visible in `/admin/orders`). Keep
this non-blocking behavior when touching this code path — a WhatsApp/Meta outage should never
block someone from placing an order.

**QR code**: generated on the fly in `src/app/admin/page.tsx` via the `qrcode` package, encoding
`NEXT_PUBLIC_SITE_URL` (the catalog root, not a per-product URL — there's one QR code for the
whole warehouse). No QR image is stored; it's regenerated on every load of `/admin`.

**Coupons**: `POST /api/coupons/validate` is public and lets the checkout UI (`order-catalog.tsx`)
preview a discount before submitting. That preview is not trusted — `POST /api/orders` re-looks-up
the coupon by code and re-derives `discountPercent` server-side from the DB, so a client can't
forge a discount by tampering with the request body. `/admin/coupons` manages coupons
(create/activate/deactivate/delete); the checkout UI only ever sends a `couponCode` string.

**Branding**: `src/lib/branding.ts` reads `NEXT_PUBLIC_WAREHOUSE_NAME` / `NEXT_PUBLIC_WAREHOUSE_LOGO_URL`
and is the single source of truth for the shop name/logo; `src/components/brand-logo.tsx` renders
it (falls back to a placeholder icon box when no logo URL is set) and is shared between the buyer
header, admin nav, and admin login. There's no DB-backed settings page — changing the name/logo
means editing `.env` and redeploying, matching how `NEXT_PUBLIC_SITE_URL` already works. The color
palette is stone (neutral) + amber (accent) throughout, defined via Tailwind utility classes rather
than a central theme file; `globals.css` fixes the page background to light — do not reintroduce a
`prefers-color-scheme: dark` override there, since that previously made the site go black for any
visitor with OS-level dark mode on.

**i18n (Hebrew/Arabic, both RTL)**: no third-party i18n library — a lightweight custom setup under
`src/lib/i18n/`. `locales.ts` defines the two supported locales (both RTL; there's no LTR locale
yet, so `dir` is always `"rtl"` today, but code reads `LOCALE_DIR[locale]` rather than hardcoding
that). `dictionaries.ts` holds plain nested-object translations for fixed UI copy only — product
names/descriptions and admin-created category/coupon names are intentionally left untranslated
(single language, per-product translations are a future feature). `get-locale.ts` is
server-only (reads the `locale` cookie via `next/headers`); `cookie.ts` just holds the cookie
name constant so client code (`locale-provider.tsx`) can read/write the cookie without pulling in
`next/headers` (that import fails outside Server Components — keep it out of anything client-side).

The root layout (`src/app/layout.tsx`) reads the cookie once, sets `<html lang dir>` accordingly
(defaults to `he`/`rtl` with no cookie), and seeds the client `LocaleProvider` with that same
value so SSR and first client render agree (no hydration mismatch, no flash of wrong direction).
Everything else reads translations via the `useLocale()` hook (`t()`, dot-path keys, `{param}`
interpolation) — client components only. The one exception is `/admin` (`page.tsx`), which stays
a Server Component for its Prisma/QR-code data fetching and delegates all rendering to a client
`DashboardContent` component so it can use `useLocale()` too; follow that split (fetch server-side,
render + translate client-side) rather than reading the cookie again in more Server Components.

`setLocale()` in `locale-provider.tsx` updates React state, writes `document.documentElement`
`lang`/`dir` immediately (instant UI flip, no reload), sets the cookie, and calls
`router.refresh()` so any Server Component data on the page re-renders consistently.

RTL layout mirroring relies on two things: (1) CSS flexbox/grid `justify-between` etc. already
mirror automatically under `dir="rtl"` — most of the app needed no changes; (2) directional
Tailwind utilities were converted to logical ones (`ps-`/`pe-` not `pl-`/`pr-`, `ms-`/`me-` not
`ml-`/`mr-`, `start-`/`end-` not `left-`/`right-`). When adding new UI, use the logical utilities
from the start rather than physical left/right ones, or RTL will silently break for that spot.

## Environment

See `.env.example` for the full list. Required to actually deliver WhatsApp notifications:
`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WAREHOUSE_OWNER_PHONE`. Without these set, orders
still work end-to-end but `sendOrderWhatsAppMessage` throws and the order is saved with no
notification sent — this is expected/handled, not a bug.
