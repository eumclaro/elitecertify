
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { email: true }
  });
  console.log('ADMIN_EMAIL:', admin?.email);
  process.exit(0);
}
main();
