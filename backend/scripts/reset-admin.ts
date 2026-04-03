import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Iniciando redefinição de senha para admin@elitetraining.com.br...')
  const hash = await bcrypt.hash('Admin@2026!', 12)
  const user = await prisma.user.update({
    where: { email: 'admin@elitetraining.com.br' },
    data: { passwordHash: hash }
  })
  console.log('✅ Senha redefinida com sucesso para:', user.email)
  console.log('🔑 Nova senha: Admin@2026!')
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('❌ Erro ao redefinir senha:', err)
  process.exit(1)
})
