import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- DB Current State ---');
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true }
    });
    console.log('Total Users:', users.length);
    console.table(users);
    console.log('--- End of Scan ---');
  } catch (error: any) {
    console.error('Error scanning users:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
