import jwt from 'jsonwebtoken';
import { env } from './src/config/env';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

function generateToken(role: string, userId: string, sessionToken: string) {
  return jwt.sign({ userId, email: 'test@test.com', role }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function testEndpoint(method: string, path: string, role: string, userConf: any) {
  const token = generateToken(role, userConf.id, userConf.sessionToken);
  // Gambiarra para spoof do sessionToken injeção na func.
  await prisma.user.update({ where: { id: userConf.id }, data: { sessionToken: token } });
  
  try {
    const res = await fetch(`http://localhost:3333/api${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    let text = await res.text();
    try { text = JSON.parse(text); } catch(e){}
    
    console.log(`[${role}] ${method} ${path} -> Status: ${res.status}`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
  }
}

async function runTests() {
  // Create dummy users
  const admin = await prisma.user.create({ data: { name: 'A', email: 'admintest@a.com', passwordHash: '123', role: Role.ADMIN } });
  const viewer = await prisma.user.create({ data: { name: 'V', email: 'viewertest@v.com', passwordHash: '123', role: Role.VIEWER } });
  const superAdm = await prisma.user.findUnique({ where: { email: 'admin@elitetraining.com.br' } });

  console.log('--- TESTE: DELETAR (apenas SUPER_ADMIN) ---');
  await testEndpoint('DELETE', '/students/some-id', 'VIEWER', viewer); 
  await testEndpoint('DELETE', '/students/some-id', 'ADMIN', admin);  
  await testEndpoint('DELETE', '/students/some-id', 'SUPER_ADMIN', superAdm); 

  console.log('\n--- TESTE: ENVIAR EMAIL (ADMIN e SUPER_ADMIN) ---');
  await testEndpoint('POST', '/dispatches', 'VIEWER', viewer); 
  await testEndpoint('POST', '/dispatches', 'ADMIN', admin);  

  console.log('\n--- TESTE: CRIAR ALUNO (ADMIN e SUPER_ADMIN) ---');
  await testEndpoint('POST', '/students', 'VIEWER', viewer); 
  await testEndpoint('POST', '/students', 'ADMIN', admin); 

  // Cleanup
  await prisma.user.deleteMany({ where: { email: { in: ['admintest@a.com', 'viewertest@v.com'] } } });
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
