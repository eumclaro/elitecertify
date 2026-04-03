import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- ADMIN CHECK ---');
    const user = await prisma.user.findUnique({
      where: { email: 'admin@eltcert.com' }
    });

    if (!user) {
      console.log('User admin@eltcert.com NOT FOUND');
    } else {
      console.log('User:', user.email);
      console.log('Role:', user.role);
      console.log('Active:', user.active);
      const isPasswordHashPopulated = !!user.passwordHash;
      console.log('Password Hash Populated:', isPasswordHashPopulated);
      
      // Test if Admin@123 works
      if (isPasswordHashPopulated) {
        const valid = await bcrypt.compare('Admin@123', user.passwordHash);
        console.log('Password "Admin@123" is VALID:', valid);
      }
    }
    console.log('--- END CHECK ---');
  } catch (error: any) {
    console.error('Check Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
