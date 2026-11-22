// The buyer's details (sign-up window and checkout), validated the same way by
// POST /api/buyer/login and POST /api/orders. Client-safe.
import { z } from "zod";
import { isValidBusinessId, normalizeBusinessId } from "@/lib/business-id";
import { CHECKOUT_LIMITS } from "@/lib/checkout-limits";
import { isValidIsraeliPhone, normalizeIsraeliPhone } from "@/lib/phone";

export const buyerDetailsSchema = z.object({
  name: z.string().trim().min(1).max(CHECKOUT_LIMITS.name),
  businessName: z.string().trim().min(1).max(CHECKOUT_LIMITS.businessName),
  businessId: z.string().trim().max(CHECKOUT_LIMITS.businessId),
  phone: z.string().trim().max(CHECKOUT_LIMITS.phone),
});

export type BuyerDetails = z.infer<typeof buyerDetailsSchema>;

export type BuyerDetailsError = "missing_info" | "invalid_business_id" | "invalid_phone";

/** The first problem with the details, or null. Same order as the form's fields. */
export function buyerDetailsError(details: BuyerDetails): BuyerDetailsError | null {
  if (!details.name.trim() || !details.businessName.trim() || !details.businessId.trim() || !details.phone.trim()) {
    return "missing_info";
  }
  if (!isValidBusinessId(details.businessId)) return "invalid_business_id";
  if (!isValidIsraeliPhone(details.phone)) return "invalid_phone";
  return null;
}

/** What is stored on the Buyer row (phone and ח.פ normalised). */
export function normalizeBuyerDetails(details: BuyerDetails) {
  return {
    name: details.name.trim(),
    businessName: details.businessName.trim(),
    businessId: normalizeBusinessId(details.businessId),
    phone: normalizeIsraeliPhone(details.phone),
  };
}
