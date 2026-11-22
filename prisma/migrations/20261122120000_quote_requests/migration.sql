-- AlterTable
ALTER TABLE "Buyer" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "CustomerType" DROP COLUMN "icon";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pricedAt" TIMESTAMP(3),
ADD COLUMN     "sentToBuyerAt" TIMESTAMP(3),
ADD COLUMN     "shareToken" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "price" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_shareToken_key" ON "Order"("shareToken");


-- Orders placed before this change were priced automatically at checkout.
UPDATE "Order" SET "pricedAt" = "createdAt";
