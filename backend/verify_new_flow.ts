import prisma from './src/config/database';
import { dispatchTemplateToMandrill } from './src/services/mail';

async function main() {
  try {
    console.log('--- Iniciando Teste de Fluxo Novo ---');
    
    // 1. Criar um Dispatch de teste
    const dispatch = await prisma.dispatch.create({
      data: {
        templateSlug: 'welcome',
        recipientGroup: 'manual',
        totalSent: 1,
        totalFailed: 0,
        failedEmails: []
      }
    });
    console.log('Dispatch criado:', dispatch.id);

    // 2. Disparar e-mail vinculado ao Dispatch
    await dispatchTemplateToMandrill(
      'STUDENT_CREATED',
      'eumarcoclaro@gmail.com',
      'Marco Claro',
      { NAME: 'Marco', EMAIL: 'eumarcoclaro@gmail.com' },
      'Teste de Vinculo',
      dispatch.id
    );
    console.log('E-mail disparado via serviço unificado.');

    // 3. Verificar o Log criado
    const log = await (prisma.emailLog as any).findFirst({
      where: { 
        recipient: 'eumarcoclaro@gmail.com',
        dispatchId: dispatch.id 
      },
      orderBy: { createdAt: 'desc' }
    });

    if (log && log.dispatchId === dispatch.id) {
      console.log('SUCESSO: EmailLog encontrado com dispatchId correto!');
      console.log(JSON.stringify(log, null, 2));
    } else {
      console.log('FALHA: EmailLog não encontrado ou sem dispatchId.');
    }

  } catch (err) {
    console.error('Erro no teste:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
