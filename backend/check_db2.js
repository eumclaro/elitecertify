const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.examAttempt.findMany({where:{resultStatus:'FAILED_ABANDONMENT'}}).then(x => console.log(JSON.stringify(x, null, 2))).catch(console.error).finally(()=>prisma.$disconnect());
