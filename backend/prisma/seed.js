require("dotenv").config();
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { ZONES } = require("../src/data/zones");

const prisma = new PrismaClient();

const SEED_PASSWORD = "password123";
const SALT_ROUNDS = 10;

// Story cast per MASTER_PLAN.md Section 0 / CLAUDE.md — never generic user1/driver1.
async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

  const jashim = await prisma.user.upsert({
    where: { email: "jashim@dhakateslapool.test" },
    update: {},
    create: {
      name: "Jashim",
      email: "jashim@dhakateslapool.test",
      passwordHash,
      role: "DRIVER",
      phone: "01700000001",
    },
  });

  await prisma.tesla.upsert({
    where: { driverId: jashim.id },
    update: {},
    create: {
      driverId: jashim.id,
      name: "Bullet",
      capacity: 3,
      status: "ONLINE",
    },
  });

  const passengers = [
    { name: "Nusrat", email: "nusrat@dhakateslapool.test", phone: "01700000002" },
    { name: "Rafiq", email: "rafiq@dhakateslapool.test", phone: "01700000003" },
    { name: "Shirin", email: "shirin@dhakateslapool.test", phone: "01700000004" },
  ];

  for (const passenger of passengers) {
    await prisma.user.upsert({
      where: { email: passenger.email },
      update: {},
      create: { ...passenger, passwordHash, role: "PASSENGER" },
    });
  }

  for (const zone of ZONES) {
    await prisma.zone.upsert({
      where: { name: zone.name },
      update: { cluster: zone.cluster },
      create: zone,
    });
  }

  console.log("Seeded: Jashim (driver) + Bullet (Tesla, capacity 3) + Nusrat/Rafiq/Shirin (passengers).");
  console.log(`Seeded ${ZONES.length} zones.`);
  console.log(`All seed accounts use password: ${SEED_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
