# Partner types, tiers and how they display

Reference for the `partners` table. Written 2026-10-25 from the code
(`PartnerDetailView.vue`, `ItemDetailsView.vue`, `HomeView.vue`) and the live
data. Re-check the code before relying on a detail that matters.

## Two independent axes

- **`partner_type`** decides which *sections* a partner page has.
- **`partner_tier`** (`gold` / `silver` / `bronze` / null) decides the *premium
  styling* and the gold-only features.
- **`is_active`** hides a partner from lists and from the product-page
  "By <partner>" line. **`verified`** only drives the green "Verified <type>"
  badge when there is no tier.

## Types

| Type | Partners today | Verified label | Page sections that depend on the type |
|---|---|---|---|
| `campus` | National Taiwan University | Verified Campus Partner | "Produced products", "Nearby locations". As gold: "Produced By" card on its products' pages. |
| `halal_body` | ICDL (gold), IAT, Taipei Grand Mosque, Halal IMA | Verified Halal Certification Body | "Certified Locations" heading. As gold: certifies products, shown as "Certified by" on product pages. |
| `merchant` | Energrain (gold), Mahkota Taiwan (hidden) | Verified Merchant | "Products by <name>" list. |
| `organization` | Kedai Sri Rahayu (gold), Amanah Group | Verified Partner | "Products by <name>" list. |
| `government` | KDEI Taipei | Verified Government Partner | Code keyed to slug `kdei-taipei` adds Indonesian products and Indonesian restaurant lists. |
| `vendor` | none yet | Verified Vendor | "Products by <name>" list. |

Energrain and Mahkota Taiwan are the same category (`merchant`): a brand that
supplies products. The difference today is only data: Mahkota has 20 products
linked via `products.partner_id`, Energrain has none yet.

## Tiers

- **none**: verified partners show a green "Verified <type>" badge. No gold styling.
- **gold**: GOLD badge, "Official Partner" tag and shimmer on the partner's
  products (product page, search, Home); ads are hidden on those product
  pages; the partner page loads certified products, certified locations and
  trips; gold products feed the Home "Discover Products" list; the partner can
  appear in the Home "Our Partners" carousel.
- **silver**: badge and shimmer styling exist, no extra features found.
- **bronze**: only in the type definition.

## Product ↔ partner link

- `products.partner_id` links a product to its partner.
- The product page reads the tier from the **partner** (`item.partner_tier =
  partner.partner_tier`), not from `products.partner_tier`. Setting the
  partner's tier is enough; no per-product edit needed.
- Product page "By <partner>" line: shown when `partner.is_active` and the
  type is not `campus` (campus has its own "Produced By" card).
- Partner page "Products by <name>": shown for `campus`, `merchant`,
  `vendor`, `organization`.
- "Certified by" cards come from `product_certifications` rows, not from
  `partner_id`.

## Adding a hidden brand partner (what was done for Mahkota)

1. Insert the partner with `is_active = false`, `verified = false`,
   `partner_tier = null`, `partner_type = 'merchant'`.
2. Set `products.partner_id` on its products. Nothing shows while inactive.
3. Fill in logo, about, address, phone, email and website.
4. To publish: `is_active = true`, `verified = true`, then set the tier.

Note: partners are publicly readable (RLS `true`), so an inactive partner's
page still opens by direct id; it is only hidden from lists and links.
