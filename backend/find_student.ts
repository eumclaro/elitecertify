import prisma from './src/config/database';

async function main() {
  try {
    const student = await prisma.student.findFirst({
      where: { user: { email: 'eumarcoclaro@gmail.com' } },
      include: { user: true }
    });
    console.log(JSON.stringify(student, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
