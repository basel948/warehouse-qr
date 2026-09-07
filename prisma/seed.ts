import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.admin.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash },
  });

  console.log(`Admin user ready: ${username}`);

  const categoryNames = ["Cleaning", "Plastic", "Paper", "Packaging", "Tools", "Safety", "Other"];
  const categories = new Map<string, string>();
  for (const [index, name] of categoryNames.entries()) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, order: index },
    });
    categories.set(name, category.id);
  }
  console.log(`Categories ready: ${categoryNames.join(", ")}`);

  const products = [
    {
      id: "seed-bottled-water",
      name: "Bottled Water (Case of 24)",
      description: "500ml bottles, shrink-wrapped case",
      price: 12.5,
      category: "Plastic",
    },
    {
      id: "seed-trash-bags",
      name: "Trash Bags (Heavy Duty, 50-pack)",
      description: "120L contractor bags",
      price: 22.0,
      category: "Plastic",
    },
    {
      id: "seed-storage-bins",
      name: "Plastic Storage Bins (Set of 3)",
      description: "Stackable bins with snap-on lids",
      price: 26.5,
      category: "Plastic",
    },
    {
      id: "seed-ziplock-bags",
      name: "Zip-Lock Bags (500-pack)",
      description: "Resealable, gallon size",
      price: 19.0,
      category: "Plastic",
    },
    {
      id: "seed-copy-paper",
      name: "Copy Paper (A4, 5 Reams)",
      description: "80gsm white copy paper",
      price: 34.0,
      category: "Paper",
    },
    {
      id: "seed-cardboard-boxes",
      name: "Cardboard Boxes (Medium, 20-pack)",
      description: "Flat-packed, 40x30x30cm",
      price: 28.75,
      category: "Paper",
    },
    {
      id: "seed-paper-towels",
      name: "Paper Towels (Case of 12)",
      description: "2-ply absorbent rolls",
      price: 24.0,
      category: "Paper",
    },
    {
      id: "seed-shipping-labels",
      name: "Shipping Labels (1000-pack)",
      description: "4x6 direct thermal labels",
      price: 31.0,
      category: "Paper",
    },
    {
      id: "seed-allpurpose-cleaner",
      name: "All-Purpose Cleaner (5L)",
      description: "Concentrated surface cleaner",
      price: 18.0,
      category: "Cleaning",
    },
    {
      id: "seed-glass-cleaner",
      name: "Glass Cleaner Spray (12-pack)",
      description: "Streak-free formula, 750ml bottles",
      price: 21.0,
      category: "Cleaning",
    },
    {
      id: "seed-microfiber-cloths",
      name: "Microfiber Cloths (12-pack)",
      description: "Lint-free, reusable",
      price: 15.5,
      category: "Cleaning",
    },
    {
      id: "seed-floor-mop",
      name: "Floor Mop with Bucket",
      description: "Wringer bucket, telescoping handle",
      price: 29.0,
      category: "Cleaning",
    },
    {
      id: "seed-bubble-wrap",
      name: "Bubble Wrap Roll (100ft)",
      description: "3/16 in. small bubble cushioning",
      price: 27.0,
      category: "Packaging",
    },
    {
      id: "seed-packing-tape",
      name: "Packing Tape (6-pack)",
      description: "2 in. x 110 yd, heavy duty",
      price: 16.0,
      category: "Packaging",
    },
    {
      id: "seed-stretch-wrap",
      name: "Stretch Wrap Film (4-pack)",
      description: "18 in. x 1500ft pallet wrap",
      price: 33.0,
      category: "Packaging",
    },
    {
      id: "seed-cordless-drill",
      name: "Cordless Drill (20V)",
      description: "Includes battery and charger",
      price: 89.0,
      category: "Tools",
    },
    {
      id: "seed-tool-belt",
      name: "Tool Belt with Pouches",
      description: "Adjustable, heavy-duty canvas",
      price: 24.0,
      category: "Tools",
    },
    {
      id: "seed-measuring-tape",
      name: "Measuring Tape (25ft)",
      description: "Magnetic hook, belt clip",
      price: 11.0,
      category: "Tools",
    },
    {
      id: "seed-safety-gloves",
      name: "Safety Gloves (Box of 100)",
      description: "Nitrile, powder-free",
      price: 20.0,
      category: "Safety",
    },
    {
      id: "seed-hivis-vest",
      name: "Hi-Vis Safety Vest",
      description: "Reflective strips, one size fits most",
      price: 9.5,
      category: "Safety",
    },
    {
      id: "seed-safety-goggles",
      name: "Safety Goggles (10-pack)",
      description: "Anti-fog, scratch-resistant",
      price: 32.0,
      category: "Safety",
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        inStock: true,
        categoryId: categories.get(product.category),
      },
    });
  }
  console.log(`Products ready: ${products.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
