// Max lengths for the checkout form's fields. Enforced by POST /api/orders and
// mirrored as maxLength on the inputs; they keep junk out of the email/PDF
// that every order generates. Client-safe.
export const CHECKOUT_LIMITS = { name: 60, businessName: 100, phone: 20 } as const;
