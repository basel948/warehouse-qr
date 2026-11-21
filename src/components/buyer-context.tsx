"use client";

import { createContext, useContext } from "react";

// The shop buyer's login, shared by the storefront shell (which owns it) and
// the catalog components (which show "log in to see prices" for guests).
// Kept in its own file so catalog-ui doesn't import storefront-shell.

export type ShopBuyer = {
  /** Normalised phone ("972501234567"). */
  phone: string;
  name: string;
  businessName: string;
  customerType: { id: string; name: string };
};

export type BuyerContextValue = {
  /** Null = a guest (sees no prices, can't order). */
  buyer: ShopBuyer | null;
  openLogin: () => void;
};

export const BuyerContext = createContext<BuyerContextValue>({ buyer: null, openLogin: () => {} });

export function useBuyer(): BuyerContextValue {
  return useContext(BuyerContext);
}
