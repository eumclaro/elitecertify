const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    try {
        const count = await prisma.user.count();
        console.log('PRISMA CONNECTED, USER COUNT:', count);
    } catch (err) {
        console.error('PRISMA CONNECTION FAILED:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
