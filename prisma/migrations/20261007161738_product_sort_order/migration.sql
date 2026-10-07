-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Start everyone in today's order (alphabetical by name), spaced by 10 so
-- the first reorders rarely need to renumber other products.
UPDATE "Product" AS p
SET "sortOrder" = ranked.rn * 10
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY name, id) AS rn FROM "Product") AS ranked
WHERE p.id = ranked.id;
