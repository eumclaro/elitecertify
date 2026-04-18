-- AlterTable: make student_id nullable and add is_test to nps_responses
ALTER TABLE "nps_responses" ALTER COLUMN "student_id" DROP NOT NULL;
ALTER TABLE "nps_responses" ADD COLUMN "is_test" BOOLEAN NOT NULL DEFAULT false;
