-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'SERVING';

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "isEmergency" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "departmentId" TEXT;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
