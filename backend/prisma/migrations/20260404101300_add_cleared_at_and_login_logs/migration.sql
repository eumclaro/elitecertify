-- AlterTable: Add cleared_at to cooldowns
ALTER TABLE "cooldowns" ADD COLUMN "cleared_at" TIMESTAMPTZ;

-- CreateTable: student_login_logs
CREATE TABLE "student_login_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "student_id" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "student_login_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_login_logs_student_id_idx" ON "student_login_logs"("student_id");

-- AddForeignKey
ALTER TABLE "student_login_logs" ADD CONSTRAINT "student_login_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
