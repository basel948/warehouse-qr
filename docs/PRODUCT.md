# Royal Stock — product overview

What the product is, who uses it, every feature, and the decisions behind them. Written so a
similar project (another shop, different look) can reuse the idea; `CLAUDE.md` covers the code.

## The idea

A wholesale warehouse (cleaning products, laundry, paper goods, disposables) gets a simple online
ordering site instead of phone/WhatsApp orders. Buyers are mostly small businesses. A printed QR
code in the warehouse opens the shop. **Buyers never see prices**: the owner prices every order by
hand. A buyer signs up once (first name, business name, ח.פ / עוסק מורשה, phone), fills a cart and
sends an order request. The owner receives it as a PDF by email, fills in the prices in the admin and
sends the priced order back to the buyer on WhatsApp (a link to the PDF). Delivery and payment are
handled as usual.

Two kinds of users:

- **Buyer** (phone-first, Hebrew or Arabic): find products fast, order in a few taps.
- **Owner** (not technical, also mostly on the phone): manage products, prices, stock, coupons and
  orders himself, without calling the developer.

## Buyer features

- **Home**: sale carousel (products on sale) and category tiles with images.
- **Category page**: products grouped into subcategory sections, a sticky chip bar to jump between
  them, filters (in stock only, price range, sort).
- **Search** across all products from the header.
- **Product card**: photo, name, "details" window, add-to-cart with a quantity stepper. No prices.
  Out-of-stock products are shown faded and can't be added.
- **Product options**: one card for a product that comes in colours or sizes (e.g. a fork in
  transparent / black / cream, cups in 2.5–12 OZ). Options show as buttons when they fit on one
  line of the card, otherwise as a dropdown; the chosen one uses the brand accent colour. Each
  option has its own photo and stock; sold-out options are crossed out. Tapping add with
  nothing chosen highlights the options instead of guessing.
- **Sign-up**: one window with first name, business name, ח.פ / עוסק מורשה and phone; the buyer
  is logged in right away and stays logged in on that phone until they log out. The details are
  saved on the phone and in the owner's database.
- **Cart page** (quantities only), then a centred **send-order window**: the items, the buyer's
  saved details (filled in automatically, with a "change" button) and a note that the prices
  will come back on WhatsApp.
- The cart survives closing the browser; on return the buyer is asked whether to continue the
  saved order or start over.
- Hebrew / Arabic switch, both right-to-left; contact footer with call and WhatsApp links;
  back-to-top button.

## Owner (admin) features

- Login with password reset by email; stays logged in (no automatic logout when idle);
  installable as a phone app.
- **Dashboard**: the shop QR code (download / print), counts of products and pending orders.
- **Categories**: add, rename, delete, drag to reorder, tile image.
- **Subcategories card** (one place for everything about subcategories and arrangement): pick a
  category; add / delete / drag subcategories; open one subcategory at a time to drag its products
  into the order buyers see; tick products for bulk actions — out of stock / in stock, move to
  another subcategory, delete, **merge into one card**, **unmerge**.
- **Products**: add (with photo upload — phone photos are shrunk automatically), edit window
  (name, price, description, unit, stock quantity, sale price or % off, categories, subcategory,
  photo), duplicate, delete (a product that was ever ordered can't be deleted, only hidden by
  marking out of stock). Search, category/subcategory filter, low-stock filter, low-stock badge.
- **Orders**: new orders arrive "waiting for prices" (a "to price" filter shows them). The owner
  types each line's price (before VAT) and sees the total with VAT, saves, then taps **send on
  WhatsApp**: his WhatsApp opens to the buyer with a ready message and a link to the priced PDF.
  The list shows whether the email arrived and whether the order was sent to the buyer; status
  (pending / confirmed / cancelled); delete only after cancelling.
- **Customers**: everyone who signed up (name, business, ח.פ, phone, last login, order count);
  fix details or remove.
- **Coupons**: code, percent, applies to the whole order or chosen categories, activate /
  deactivate / delete.
- **Pay-later**: open debts grouped by customer, mark a customer's orders as paid.

## Rules and decisions (and why)

- **No prices in the shop; the owner prices each order.** The owner wants to quote each buyer
  himself. Buyers send a request; he prices it in the admin and sends it back on WhatsApp. (Price
  lists per customer type existed before; they are switched off "for now" and their data kept.)
- **Sign up once, no password.** First name, business name, ח.פ and phone; the phone is the
  identity (signing up again with it updates the details). Anyone who knows a buyer's phone could
  sign in as them; an SMS code is the next step if needed. Nothing a buyer can reach shows prices
  except the priced-order link the owner sends them (a long random link to that one order).
- **The owner enters prices before VAT; VAT (18%) is added on top** in the priced order. Each
  order stores the VAT rate it was priced with, so a future rate change never rewrites old orders.
- **Orders are snapshots.** Price, coupon and VAT are copied onto the order; editing or deleting a
  product or coupon later never changes past orders.
- **Stock is optional per product.** Empty = not tracked (works like before stock existed). When
  tracked: orders take stock off atomically, an order larger than what's left is refused with
  "only N left", 0 → out of stock automatically, cancelling returns the stock. **Buyers never see
  the quantity** (it's stripped before reaching the browser), only in / out of stock.
- **Units**: each product is sold either per unit (יחידה) or per carton (קרטון); the unit is shown
  next to every price and quantity, including the PDF.
- **Coupons, payment method and pay-later** belonged to the old checkout. With no prices shown,
  checkout no longer takes coupons or a payment method; the admin pages remain for old orders.
- **Notifications never block an order.** If the email fails, the order is still saved and the
  admin sees it wasn't sent.
- **Product options are just grouped products**, not a new kind of product, so cart, stock,
  coupons and PDF work unchanged.
- **One way to do each thing in the admin.** The owner isn't technical; several paths to the same
  result confused him. E.g. cards are made and undone only from the bulk bar; names are edited in
  one window.
- **Confirm before anything destructive**, with a short explanation of the consequence; small
  toast messages after every save.
- **Phone first**: every screen is designed at phone width first; windows (checkout, product
  details, edit) are centred dialogs.
- **Light theme only**, brand colours from environment variables (name, logo, accent, secondary
  colour, contact phone) so the same code can serve another shop.
- **Images on ImageKit** (resized on the fly per use: card, detail, thumbnail), uploads shrunk in
  the browser to stay within the free plan.

## Operations

- Hosting: Railway (web service + Postgres), domain royalstockonline.com. Deploys on push to
  `master`; database migrations apply automatically on start.
- Plan: Railway **Hobby** is enough for this site. For handover, the owner opens his own Railway
  account on Hobby, the project is transferred to him (project → Settings → Members → invite →
  Transfer Ownership; both sides need an active plan), and he invites the developer back as a
  project member.
- Email: Brevo (domain royalstockonline.com authenticated; the developer's account). Images: ImageKit.
- Open items: legal pages (terms, privacy, accessibility statement), whether to bring back price lists
  or coupons.

## Reusing this for a similar project

Start from a copy of this repository (or a GitHub template of it) so `CLAUDE.md` and this file come
along, then change branding through the environment variables and adjust the frontend. The parts
most worth keeping as they are: order snapshots + `order-totals.ts`, stock bookkeeping in
`stock.ts`, the public-product stripping, non-blocking notifications, the i18n/RTL setup, and the
"one way per task" admin approach.
