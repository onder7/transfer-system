-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_vehicleClassId_fkey" FOREIGN KEY ("vehicleClassId") REFERENCES "VehicleClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
