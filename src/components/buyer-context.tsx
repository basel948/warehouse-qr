"use client";

import { createContext, useContext } from "react";

// The shop buyer's login, shared by the storefront shell (which owns it) and
// the catalog components (whose cart button opens the sign-up for guests).
// Kept in its own file so catalog-ui doesn't import storefront-shell.

export type ShopBuyer = {
  /** Normalised phone ("972501234567"). */
  phone: string;
  /** First name. */
  name: string;
  businessName: string;
  /** ח.פ / עוסק מורשה, digits only. */
  businessId: string;
};

export type BuyerContextValue = {
  /** Null = a guest (can browse, but ordering needs the one-time sign-up). */
  buyer: ShopBuyer | null;
  openLogin: () => void;
};

export const BuyerContext = createContext<BuyerContextValue>({ buyer: null, openLogin: () => {} });

export function useBuyer(): BuyerContextValue {
  return useContext(BuyerContext);
}
