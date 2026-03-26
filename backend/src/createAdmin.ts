import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const passwordHash = await bcrypt.hash('123456', 12);
    
    // Check if user exists
    let admin = await prisma.user.findUnique({ where: { email: 'admin@elitetraining.com.br' } });
    
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          name: 'Administrador',
          email: 'admin@elitetraining.com.br',
          passwordHash,
          role: 'ADMIN',
          active: true,
        }
      });
      console.log('✅ Admin user created successfully.');
    } else {
      // update password just to be sure
      admin = await prisma.user.update({
        where: { id: admin.id },
        data: { passwordHash }
      });
      console.log('✅ Admin user updated successfully.');
    }
    
    // Create a mock student as well just so there's data
    const studentExists = await prisma.user.findUnique({ where: { email: 'aluno@teste.com' } });
    if (!studentExists) {
      await prisma.student.create({
        data: {
          cpf: '111.111.111-11',
          user: {
            create: {
              name: 'Aluno Teste',
              email: 'aluno@teste.com',
              passwordHash,
              role: 'STUDENT',
              active: true
            }
          }
        }
      });
      console.log('✅ Mock student created successfully.');
    }
    
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
