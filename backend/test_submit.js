const { PrismaClient } = require('@prisma/client');
const uuid = require('crypto').randomUUID;
const prisma = new PrismaClient();

async function run() {
  try {
    const attemptId = "859d2813-70a7-448f-a875-f2c672bc7f90"; // Marco's attempt
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: true, exam: { include: { _count: { select: { questions: true } } } } },
    });
    
    console.log("Found:", !!attempt);
    if (!attempt) return;
    
    const totalQuestions = attempt.exam._count.questions;
    console.log("totalQuestions", totalQuestions);
    
    const correctAnswers = attempt.answers.filter(a => a.isCorrect).length;
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const passed = score >= attempt.exam.passingScore;
    
    // Check update
    console.log("Updating to pass?", passed);
    // Don't actually update to not ruin the db state for the user
    
    console.log("Checking cooldown logic");
    if (!passed && attempt.exam.cooldownDays > 0) {
      const endsAt = new Date(Date.now() + attempt.exam.cooldownDays * 24 * 60 * 60 * 1000);
      console.log("Cooldown would be created:", endsAt);
    }
    
    let certificate = null;
    if (passed) {
      const code = `CERT-${Date.now().toString(36).toUpperCase()}-${uuid().substring(0, 8).toUpperCase()}`;
      console.log("Certificate would be created:", code);
    }
    
    console.log("Check audit event logic...");
    // await prisma.auditEvent.create({ ... })
    
  } catch(e) {
    console.error("ERROR", e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
