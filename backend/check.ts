import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const exams = await prisma.exam.findMany({ select: { title: true, cooldownDays: true } });
  console.log(exams);
}
main().catch(console.error).finally(() => prisma.$disconnect());
