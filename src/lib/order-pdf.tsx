import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { WAREHOUSE_LOGO_URL, WAREHOUSE_NAME } from "@/lib/branding";
import { withCloudinaryTransform } from "@/lib/cloudinary-url";
import { PAYMENT_METHOD_LABEL_HE, type PaymentMethod } from "@/lib/payment-method";

Font.register({
  family: "Alef",
  fonts: [
    { src: path.join(process.cwd(), "src/assets/fonts/Alef-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "src/assets/fonts/Alef-Bold.ttf"), fontWeight: "bold" },
  ],
});

export type OrderPdfItem = {
  productName: string;
  quantity: number;
  price: number;
  imageUrl: string | null;
};

export type OrderPdfData = {
  orderId: string;
  createdAt: Date;
  customerName: string;
  businessName: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  items: OrderPdfItem[];
  subtotal: number;
  couponCode: string | null;
  discountPercent: number | null;
  total: number;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Alef",
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
  colPrice: { width: "19%" },
  colTotal: { width: "19%" },
  totals: { marginTop: 14, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", gap: 10, marginBottom: 3 },
  totalsLabel: { fontSize: 9, color: "#6b6259" },
  totalsValue: { fontSize: 9 },
  grandTotalRow: { flexDirection: "row", gap: 10, marginTop: 4, paddingTop: 6, borderTop: "1pt solid #d8d0c3" },
  grandTotalLabel: { fontSize: 11, fontWeight: "bold" },
  grandTotalValue: { fontSize: 11, fontWeight: "bold" },
  paidStamp: { fontSize: 9, fontWeight: "bold", color: "#2f6b3a", marginBottom: 3, textAlign: "right" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#a39a8e", textAlign: "center" },
});

function formatCurrency(amount: number): string {
  return `₪${amount.toFixed(2)}`;
}

type DocumentVariant = "order" | "receipt";

const DOCUMENT_TITLE: Record<DocumentVariant, string> = {
  order: "הזמנה חדשה",
  receipt: "קבלה",
};

const DOCUMENT_NUMBER_LABEL: Record<DocumentVariant, string> = {
  order: "מס' הזמנה",
  receipt: "מס' קבלה",
};

const TOTAL_LABEL: Record<DocumentVariant, string> = {
  order: "סה\"כ לתשלום",
  receipt: "סה\"כ ששולם",
};

function OrderDocument({ order, variant }: { order: OrderPdfData; variant: DocumentVariant }) {
  const discountAmount = order.discountPercent ? order.subtotal * (order.discountPercent / 100) : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {variant === "receipt" && <Text style={styles.paidStamp}>שולם ✓</Text>}
            <Text style={styles.title}>{DOCUMENT_TITLE[variant]}</Text>
            <Text style={styles.meta}>
              {DOCUMENT_NUMBER_LABEL[variant]}: {order.orderId.slice(-6)}
            </Text>
            <Text style={styles.meta}>
              {order.createdAt.toLocaleDateString("he-IL")} {order.createdAt.toLocaleTimeString("he-IL")}
            </Text>
          </View>
          {WAREHOUSE_LOGO_URL ? (
            <Image
              src={withCloudinaryTransform(WAREHOUSE_LOGO_URL, "w_400,q_auto")}
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
            <Text style={styles.infoLabel}>שם מלא</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{order.businessName || "-"}</Text>
            <Text style={styles.infoLabel}>מעסיק מורשה / שם העסק</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{order.customerPhone}</Text>
            <Text style={styles.infoLabel}>מספר טלפון</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{PAYMENT_METHOD_LABEL_HE[order.paymentMethod]}</Text>
            <Text style={styles.infoLabel}>אופן תשלום</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableHeaderCell, styles.colProduct]}>מוצר</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>כמות</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>מחיר ליחידה</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>סה&quot;כ</Text>
          </View>
          {order.items.map((item, index) => (
            <View style={styles.tableRow} key={index}>
              <View style={[styles.tableCell, styles.colProduct, styles.productCell]}>
                {item.imageUrl && (
                  <Image
                    src={withCloudinaryTransform(item.imageUrl, "w_100,h_100,c_fill,q_auto")}
                    style={styles.productThumb}
                  />
                )}
                <Text style={styles.productName}>{item.productName}</Text>
              </View>
              <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.colPrice]}>{formatCurrency(item.price)}</Text>
              <Text style={[styles.tableCell, styles.colTotal]}>
                {formatCurrency(item.price * item.quantity)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          {order.couponCode && order.discountPercent && (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsValue}>{formatCurrency(order.subtotal)}</Text>
                <Text style={styles.totalsLabel}>סכום ביניים</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsValue}>
                  -{formatCurrency(discountAmount)}
                </Text>
                <Text style={styles.totalsLabel}>
                  קופון <Text style={{ direction: "ltr" }}>{order.couponCode}</Text> (-
                  {order.discountPercent}%)
                </Text>
              </View>
            </>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalValue}>{formatCurrency(order.total)}</Text>
            <Text style={styles.grandTotalLabel}>{TOTAL_LABEL[variant]}</Text>
          </View>
        </View>

        <Text style={styles.footer}>נוצר אוטומטית על ידי {WAREHOUSE_NAME}</Text>
      </Page>
    </Document>
  );
}

export async function generateOrderPdf(order: OrderPdfData): Promise<Buffer> {
  return renderToBuffer(<OrderDocument order={order} variant="order" />);
}

/**
 * A separate "receipt" document (same layout, marked as paid) - only
 * meaningful for orders where payment was actually taken at order time
 * (currently: credit). Not a legally-numbered tax invoice/קבלה - just an
 * informal paid confirmation reusing the order's own reference number.
 */
export async function generateOrderReceiptPdf(order: OrderPdfData): Promise<Buffer> {
  return renderToBuffer(<OrderDocument order={order} variant="receipt" />);
}
