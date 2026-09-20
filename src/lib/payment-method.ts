export const PAYMENT_METHOD = {
  CASH: "CASH",
  CREDIT: "CREDIT",
  PAY_LATER: "PAY_LATER",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

// Hebrew labels shared by the PDF, WhatsApp captions and owner email - those
// are all server-rendered outside the client i18n dictionary (buyers/owner
// receive them regardless of the storefront's current locale).
export const PAYMENT_METHOD_LABEL_HE: Record<PaymentMethod, string> = {
  [PAYMENT_METHOD.CASH]: "מזומן",
  [PAYMENT_METHOD.CREDIT]: "אשראי",
  [PAYMENT_METHOD.PAY_LATER]: "תשלום מאוחר",
};
