const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.examAttempt.findMany({orderBy:{createdAt:'desc'},take:5,include:{exam:true}}).then(x => console.log(JSON.stringify(x, null, 2))).catch(console.error).finally(()=>prisma.$disconnect());
