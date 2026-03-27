import prisma from './src/config/database';

async function main() {
  const total = await (prisma.emailLog as any).count();
  const withDispatchId = await (prisma.emailLog as any).count({
    where: { NOT: { dispatchId: null } }
  });
  const withoutDispatchId = await (prisma.emailLog as any).count({
    where: { dispatchId: null }
  });

  console.log(JSON.stringify({
    total,
    withDispatchId,
    withoutDispatchId
  }));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
