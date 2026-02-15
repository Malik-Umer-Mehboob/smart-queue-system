-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_userId_fkey";

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "bookedById" TEXT,
ADD COLUMN     "patientName" TEXT,
ADD COLUMN     "patientPhone" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
