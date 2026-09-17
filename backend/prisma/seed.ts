import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Real departments, each with its own leader count. Edit this list any time —
// the seed is safe to re-run (upsert), it won't duplicate departments or
// accounts that already exist.
const DEPARTMENTS: { name: string; leaders: number }[] = [
  { name: "Mezmur", leaders: 3 },
  { name: "Siel", leaders: 3 },
  { name: "Sine Tsihuf", leaders: 3 },
  { name: "Mezmure and Kflat", leaders: 2 },
];

// Change this before running in anything other than local testing.
const DEFAULT_LEADER_PASSWORD = "changeme123";

async function main() {
  const departments = await Promise.all(
    DEPARTMENTS.map((d) =>
      prisma.department.upsert({ where: { name: d.name }, update: {}, create: { name: d.name } }),
    ),
  );

  // --- Super admin (you) ---
  const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      password: await bcrypt.hash(adminPassword, 10),
      fullName: "Admin",
      role: "SUPER_ADMIN",
      departmentId: null,
    },
  });
  console.log(`Super admin ready -> ${adminUsername} / ${adminPassword}`);

  // --- Leader accounts, count set per department above ---
  console.log("\nLeader accounts (all use the same starting password, change on first login):");
  for (const dept of departments) {
    const slug = dept.name.toLowerCase().replace(/\s+/g, "");
    const leaderCount = DEPARTMENTS.find((d) => d.name === dept.name)!.leaders;
    for (let i = 1; i <= leaderCount; i++) {
      const username = `${slug}.leader${i}`;
      await prisma.user.upsert({
        where: { username },
        update: {},
        create: {
          username,
          password: await bcrypt.hash(DEFAULT_LEADER_PASSWORD, 10),
          fullName: `${dept.name} Leader ${i}`,
          role: "TEACHER",
          departmentId: dept.id,
        },
      });
      console.log(`  ${username} / ${DEFAULT_LEADER_PASSWORD}  (${dept.name})`);
    }
  }

  console.log(
    "\nNo sample students or attendance were created. Add real students per department " +
      "from the Students page (or via /students/import), then start marking attendance.",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
