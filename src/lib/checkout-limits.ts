// Max lengths for the buyer's details (sign-up and checkout). Enforced by the
// buyer login and orders APIs and mirrored as maxLength on the inputs; they
// keep junk out of the email/PDF that every order generates. Client-safe.
export const CHECKOUT_LIMITS = { name: 60, businessName: 100, businessId: 15, phone: 20 } as const;
