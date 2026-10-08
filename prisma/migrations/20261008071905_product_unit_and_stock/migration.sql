-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "stockQuantity" INTEGER,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'UNIT';
