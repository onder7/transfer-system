ALTER TABLE "Booking" ADD COLUMN "adultCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Booking" ADD COLUMN "childCount"  INTEGER NOT NULL DEFAULT 0;
UPDATE "Booking" SET "adultCount" = "passengerCount";
ALTER TABLE "Booking" DROP COLUMN "passengerCount";
ALTER TABLE "VehicleClass" ADD COLUMN "luggageCapacity" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "VehicleClass" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;
