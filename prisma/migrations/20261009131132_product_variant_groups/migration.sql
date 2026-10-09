-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "variantGroupId" TEXT,
ADD COLUMN     "variantLabel" TEXT,
ADD COLUMN     "variantOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "VariantGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariantGroup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_variantGroupId_fkey" FOREIGN KEY ("variantGroupId") REFERENCES "VariantGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
