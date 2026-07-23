-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "estimatedDurationMin" INTEGER;

-- AlterTable
ALTER TABLE "DriverAssignment" ADD COLUMN     "pickedUpAt" TIMESTAMP(3);
