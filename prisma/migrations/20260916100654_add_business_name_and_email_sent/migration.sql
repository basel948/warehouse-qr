-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL,
    "businessName" TEXT NOT NULL DEFAULT '',
    "customerPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "whatsappSentAt" DATETIME,
    "emailSentAt" DATETIME,
    "couponCode" TEXT,
    "discountPercent" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Order" ("couponCode", "createdAt", "customerName", "customerPhone", "discountPercent", "id", "status", "whatsappSentAt") SELECT "couponCode", "createdAt", "customerName", "customerPhone", "discountPercent", "id", "status", "whatsappSentAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
