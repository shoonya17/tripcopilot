/*
  Warnings:

  - A unique constraint covering the columns `[ingest_email_token]` on the table `traveler` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "traveler" ADD COLUMN     "ingest_email_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "traveler_ingest_email_token_key" ON "traveler"("ingest_email_token");
