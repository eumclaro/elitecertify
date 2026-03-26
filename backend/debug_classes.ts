import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const classes = await prisma.class.findMany({
      include: { _count: { select: { students: true, examReleases: true } } },
      orderBy: { createdAt: 'desc' },
    });
    console.log("Success:", classes);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
