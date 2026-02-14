import { PrismaClient, RoleType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'malik.umerkhan97@gmail.com';
  const adminPassword = 'malikawan97';
  const adminName = 'Admin';

  console.log('Seeding admin user...');

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPassword,
      role: RoleType.ADMIN,
      name: adminName,
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      role: RoleType.ADMIN,
      name: adminName,
    },
  });

  console.log({ admin });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
