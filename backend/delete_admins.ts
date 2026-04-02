import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function deleteAdmins() {
  console.log('Iniciando delecao de conflitos por Prisma objects...');
  const emailsToDelete = ['admin@eltcert.com', 'admin@test.com', 'antigravity@test.com'];
  
  try {
    const users = await prisma.user.findMany({ where: { email: { in: emailsToDelete } } });
    for (const u of users) {
      await prisma.npsResponse.deleteMany({ where: { survey: { createdBy: u.id } } });
      await prisma.npsSurvey.deleteMany({ where: { createdBy: u.id } });
      await prisma.auditEvent.deleteMany({ where: { userId: u.id } });
      try { await prisma.$executeRawUnsafe(`UPDATE "system_settings" SET "updated_by" = NULL WHERE "updated_by" = $1`, u.id); } catch(e){}
      try { await prisma.$executeRawUnsafe(`UPDATE "email_templates" SET "updated_by" = NULL WHERE "updated_by" = $1`, u.id); } catch(e){}
    }
    
    const result = await prisma.user.deleteMany({
      where: {
        email: {
          in: emailsToDelete
        }
      }
    });
    console.log(`Linhas excluídas: ${result.count}`);
  } catch (e: any) {
    console.log(e.message);
  }
}

deleteAdmins().catch(console.error).finally(() => prisma.$disconnect());
