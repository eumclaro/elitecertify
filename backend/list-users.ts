import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: { email: true, role: true }
    });
    console.log(JSON.stringify(users, null, 2));
  } catch (error: any) {
    console.error('List Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
