-- AlterTable
ALTER TABLE "answers" ADD COLUMN "text_answer" TEXT;
ALTER TABLE "answers" ALTER COLUMN "is_correct" DROP NOT NULL;
ALTER TABLE "answers" ALTER COLUMN "is_correct" SET DEFAULT false;
