import prisma from './src/config/database';

async function main() {
  try {
    const logs = await (prisma.emailLog as any).findMany({
      where: { recipient: 'eumarcoclaro@gmail.com' },
      orderBy: { createdAt: 'desc' }
    });
    console.log(JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
