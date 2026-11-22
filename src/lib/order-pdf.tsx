import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { WAREHOUSE_LOGO_URL, WAREHOUSE_NAME } from "@/lib/branding";
import { withImageTransform } from "@/lib/image-url";
import { calculateOrderTotals } from "@/lib/order-totals";
import { formatQuantityHe } from "@/lib/product-unit";

Font.register({
  family: "Alef",
  fonts: [
    { src: path.join(process.cwd(), "src/assets/fonts/Alef-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "src/assets/fonts/Alef-Bold.ttf"), fontWeight: "bold" },
  ],
});

// Alef has no Arabic letters; react-pdf falls back to this font for them
// (product and buyer names can be Arabic).
Font.register({
  family: "Noto Sans Arabic",
  fonts: [
    { src: path.join(process.cwd(), "src/assets/fonts/NotoSansArabic-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "src/assets/fonts/NotoSansArabic-Bold.ttf"), fontWeight: "bold" },
  ],
});

export type OrderPdfItem = {
  productName: string;
  quantity: number;
  /** Product.unit ("UNIT" / "CARTON"); missing = יחידה. */
  unit?: string | null;
  /** The coupon that discounted this line (orders with per-item coupons). */
  couponCode?: string | null;
  discountPercent?: number | null;
  /** Before VAT; null on an order the owner hasn't priced yet. */
  price: number | null;
  imageUrl: string | null;
};

export type OrderPdfData = {
  orderId: string;
  createdAt: Date;
  customerName: string;
  businessName: string;
  /** ח.פ / עוסק מורשה ("" on orders from before it was asked). */
  businessId: string;
  customerPhone: string;
  items: OrderPdfItem[];
  couponCode: string | null;
  discountPercent: number | null;
  /** VAT rate added on top (null = an order from before VAT was charged). */
  vatPercent: number | null;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: ["Alef", "Noto Sans Arabic"],
    direction: "rtl",
    padding: 32,
    fontSize: 11,
    color: "#1a1714",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
    paddingBottom: 14,
    borderBottom: "1pt solid #d8d0c3",
  },
  warehouseName: { fontSize: 16, fontWeight: "bold" },
  warehouseLogo: { height: 30, objectFit: "contain" },
  title: { fontSize: 13, fontWeight: "bold", marginBottom: 3, textAlign: "right" },
  meta: { fontSize: 9, color: "#6b6259", textAlign: "right" },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", marginBottom: 6, textAlign: "right" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  infoLabel: { fontSize: 9, color: "#6b6259" },
  infoValue: { fontSize: 10, fontWeight: "bold" },
  table: { borderTop: "1pt solid #d8d0c3", borderLeft: "1pt solid #d8d0c3" },
  tableRow: { flexDirection: "row" },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: "bold",
    padding: 6,
    borderRight: "1pt solid #d8d0c3",
    borderBottom: "1pt solid #d8d0c3",
    backgroundColor: "#f4f1ec",
    textAlign: "right",
  },
  tableCell: {
    fontSize: 9,
    padding: 6,
    borderRight: "1pt solid #d8d0c3",
    borderBottom: "1pt solid #d8d0c3",
    textAlign: "right",
  },
  colProduct: { width: "46%" },
  productCell: { flexDirection: "row", alignItems: "center", gap: 6 },
  productThumb: { width: 20, height: 20, objectFit: "cover", borderRadius: 3 },
  productName: { fontSize: 9, flex: 1 },
  colQty: { width: "16%" },
  // Unpriced request: product and quantity only.
  colProductWide: { width: "75%" },
  colQtyWide: { width: "25%" },
  colPrice: { width: "19%" },
  colTotal: { width: "19%" },
  totals: { marginTop: 14, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", gap: 10, marginBottom: 3 },
  totalsLabel: { fontSize: 9, color: "#6b6259" },
  totalsValue: { fontSize: 9 },
  grandTotalRow: { flexDirection: "row", gap: 10, marginTop: 4, paddingTop: 6, borderTop: "1pt solid #d8d0c3" },
  grandTotalLabel: { fontSize: 11, fontWeight: "bold" },
  grandTotalValue: { fontSize: 11, fontWeight: "bold" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#a39a8e", textAlign: "center" },
});

function formatCurrency(amount: number): string {
  return `₪${amount.toFixed(2)}`;
}

// Two versions of one document: the request the owner receives when a buyer
// orders (products and quantities, no prices), and the priced order the owner
// sends back to the buyer once every line has a price.
function OrderDocument({ order }: { order: OrderPdfData }) {
  const priced = order.items.every((item) => item.price != null);
  // order.couponCode/discountPercent: the single order-wide coupon of orders
  // from before per-item coupons (newer orders pass discountPercent null).
  const totals = calculateOrderTotals(
    order.items.map((item) => ({ ...item, price: item.price ?? 0 })),
    { couponCode: order.couponCode, discountPercent: order.discountPercent },
    order.vatPercent
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{priced ? "הזמנה" : "הזמנה חדשה - ממתינה לתמחור"}</Text>
            <Text style={styles.meta}>מס&apos; הזמנה: {order.orderId.slice(-6)}</Text>
            <Text style={styles.meta}>
              {order.createdAt.toLocaleDateString("he-IL")} {order.createdAt.toLocaleTimeString("he-IL")}
            </Text>
          </View>
          {WAREHOUSE_LOGO_URL ? (
            <Image
              src={withImageTransform(WAREHOUSE_LOGO_URL, "w-400,f-png")}
              style={styles.warehouseLogo}
            />
          ) : (
            <Text style={styles.warehouseName}>{WAREHOUSE_NAME}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>פרטי הקונה</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{order.customerName}</Text>
            <Text style={styles.infoLabel}>שם</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{order.businessName || "-"}</Text>
            <Text style={styles.infoLabel}>שם העסק</Text>
          </View>
          {order.businessId ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoValue}>{order.businessId}</Text>
              <Text style={styles.infoLabel}>ח.פ / עוסק מורשה</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{order.customerPhone}</Text>
            <Text style={styles.infoLabel}>מספר טלפון</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableHeaderCell, priced ? styles.colProduct : styles.colProductWide]}>מוצר</Text>
            <Text style={[styles.tableHeaderCell, priced ? styles.colQty : styles.colQtyWide]}>כמות</Text>
            {priced && (
              <>
                <Text style={[styles.tableHeaderCell, styles.colPrice]}>
                  {totals.vatPercent ? "מחיר ליחידה (לפני מע\"מ)" : "מחיר ליחידה"}
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colTotal]}>סה&quot;כ</Text>
              </>
            )}
          </View>
          {order.items.map((item, index) => (
            <View style={styles.tableRow} key={index}>
              <View style={[styles.tableCell, priced ? styles.colProduct : styles.colProductWide, styles.productCell]}>
                {item.imageUrl && (
                  <Image
                    src={withImageTransform(item.imageUrl, "w-100,h-100,f-png")}
                    style={styles.productThumb}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9 }}>{item.productName}</Text>
                  {item.discountPercent ? (
                    <Text style={{ fontSize: 8, color: "#2f6b3a", marginTop: 2 }}>
                      קופון <Text style={{ direction: "ltr" }}>{item.couponCode}</Text> -{item.discountPercent}%
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.tableCell, priced ? styles.colQty : styles.colQtyWide]}>
                {formatQuantityHe(item.quantity, item.unit)}
              </Text>
              {priced && (
                <>
                  <Text style={[styles.tableCell, styles.colPrice]}>{formatCurrency(item.price ?? 0)}</Text>
                  <Text style={[styles.tableCell, styles.colTotal]}>
                    {formatCurrency((item.price ?? 0) * item.quantity)}
                  </Text>
                </>
              )}
            </View>
          ))}
        </View>

        {priced && (
        <View style={styles.totals}>
          {totals.discounts.length > 0 && (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsValue}>{formatCurrency(totals.subtotal)}</Text>
                <Text style={styles.totalsLabel}>סכום ביניים</Text>
              </View>
              {totals.discounts.map((discount) => (
                <View style={styles.totalsRow} key={`${discount.code}-${discount.percent}`}>
                  <Text style={styles.totalsValue}>-{formatCurrency(discount.amount)}</Text>
                  <Text style={styles.totalsLabel}>
                    קופון <Text style={{ direction: "ltr" }}>{discount.code}</Text> (-{discount.percent}%)
                  </Text>
                </View>
              ))}
            </>
          )}
          {totals.vatPercent ? (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsValue}>{formatCurrency(totals.totalBeforeVat)}</Text>
                <Text style={styles.totalsLabel}>סה&quot;כ לפני מע&quot;מ</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsValue}>{formatCurrency(totals.vatAmount)}</Text>
                <Text style={styles.totalsLabel}>מע&quot;מ {totals.vatPercent}%</Text>
              </View>
            </>
          ) : null}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalValue}>{formatCurrency(totals.total)}</Text>
            <Text style={styles.grandTotalLabel}>סה&quot;כ לתשלום</Text>
          </View>
        </View>
        )}

        <Text style={styles.footer}>נוצר אוטומטית על ידי {WAREHOUSE_NAME}</Text>
      </Page>
    </Document>
  );
}

export async function generateOrderPdf(order: OrderPdfData): Promise<Buffer> {
  return renderToBuffer(<OrderDocument order={order} />);
}
