/*
  Warnings:

  - Made the column `bookedById` on table `appointments` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_bookedById_fkey";

-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "bookedById" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
