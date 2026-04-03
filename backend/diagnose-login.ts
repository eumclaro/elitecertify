import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = "elt-cert-jwt-secret-2026-x9k2m";

async function diagnoseLogin() {
  const email = "admin@elitetraining.com.br";
  const password = "Admin@2026!"; // Senha recém-alterada

  try {
    console.log('--- START LOGIN DIAGNOSTIC ---');
    console.log('Querying user:', email);
    
    const user = await prisma.user.findUnique({ 
      where: { email }, 
      include: { student: true } 
    });

    if (!user) {
      console.log('ERROR: User not found in database.');
      return;
    }

    console.log('User found. Passive check...');
    console.log('Role:', user.role);
    console.log('Active:', user.active);

    console.log('Testing bcrypt compare...');
    const valid = await bcrypt.compare(password, user.passwordHash);
    console.log('Password valid:', valid);

    if (!valid) {
      console.log('ERROR: Invalid credentials (password mismatch).');
      return;
    }

    console.log('Testing JWT signature...');
    const payload = { userId: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
    console.log('JWT Token generated successfully.');

    console.log('Testing Audit Event creation...');
    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'user',
        entityId: user.id,
        ip: '127.0.0.1',
        device: 'Diagnostic-Script'
      }
    });
    console.log('Audit event created successfully.');

    console.log('Testing User session update...');
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionToken: token, lastLoginAt: new Date() }
    });
    console.log('User record updated successfully.');

    console.log('--- DIAGNOSTIC COMPLETE: NO INTERNAL ERRORS FOUND ---');
  } catch (error: any) {
    console.error('--- DIAGNOSTIC FAILED: INTERNAL 500 SOURCE FOUND ---');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('Complete Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseLogin();
