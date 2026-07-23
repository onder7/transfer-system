-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "outboundId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_outboundId_key" ON "Booking"("outboundId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_outboundId_fkey" FOREIGN KEY ("outboundId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
