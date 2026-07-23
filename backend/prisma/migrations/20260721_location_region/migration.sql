-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "regionId" TEXT;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
