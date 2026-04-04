-- AlterTable
ALTER TABLE "email_logs" ADD COLUMN "student_id" TEXT;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "email_logs_student_id_idx" ON "email_logs"("student_id");
