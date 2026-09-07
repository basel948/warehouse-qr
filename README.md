# Warehouse Order

A simple ordering site for a warehouse: customers scan a QR code, browse products, and submit
an order. The warehouse owner is notified of each order via WhatsApp. An admin area lets the
owner manage products and view/update incoming orders.

## Getting started

1. Copy `.env.example` to `.env` and fill in the values (see below).
2. Install dependencies: `npm install`
3. Apply the database schema: `npx prisma migrate dev`
4. Seed an admin user and sample products: `npm run db:seed`
5. Run the dev server: `npm run dev`

The customer-facing order page is at `/`, printed on the warehouse's QR code. The admin area is
at `/admin` (login with the `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` you set before seeding).

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file path for Prisma. |
| `NEXTAUTH_SECRET` | Secret for signing admin session JWTs. Generate with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Base URL of the app (used by NextAuth). |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | Credentials created by `prisma/seed.ts` for the warehouse owner's admin login. |
| `WHATSAPP_TOKEN` | Access token for the Meta WhatsApp Cloud API. |
| `WHATSAPP_PHONE_NUMBER_ID` | The Cloud API phone number ID messages are sent from. |
| `WAREHOUSE_OWNER_PHONE` | The warehouse owner's WhatsApp number (E.164 format) that receives order notifications. |
| `NEXT_PUBLIC_SITE_URL` | Public URL the QR code (shown on `/admin`) points to. |
| `NEXT_PUBLIC_WAREHOUSE_NAME` | Shop name shown in the header/nav/login logo. |
| `NEXT_PUBLIC_WAREHOUSE_LOGO_URL` | Optional logo image URL; shows a placeholder icon if unset. |

### WhatsApp notifications

Order notifications use the Meta WhatsApp Cloud API's session (text) messages, which only
deliver to a number that has messaged your business number within the last 24 hours. For
reliable delivery outside that window, register a message template in Meta Business Manager and
send it instead — see `src/lib/whatsapp.ts`.
