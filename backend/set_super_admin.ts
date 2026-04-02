import { PrismaClient, Role } from '@prisma/client';
const prisma = new PrismaClient();

async function setSuperAdmin() {
  console.log('Atualizando role...');
  try {
    const user = await prisma.user.update({
      where: { email: 'admin@elitetraining.com.br' },
      data: { role: Role.SUPER_ADMIN },
    });
    console.log(`User ${user.email} atualizado para ${user.role}`);
  } catch(e: any) {
    console.log('Erro:', e.message);
  }
}

setSuperAdmin().catch(console.error).finally(() => prisma.$disconnect());
