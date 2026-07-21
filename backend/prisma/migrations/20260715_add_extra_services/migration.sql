-- CreateTable
CREATE TABLE "ExtraService" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "priceType" TEXT NOT NULL DEFAULT 'PER_UNIT',
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "maxQuantity" INTEGER NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingExtra" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "extraServiceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingExtra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtraService_key_key" ON "ExtraService"("key");

-- CreateIndex
CREATE INDEX "BookingExtra_bookingId_idx" ON "BookingExtra"("bookingId");

-- AddForeignKey
ALTER TABLE "BookingExtra" ADD CONSTRAINT "BookingExtra_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingExtra" ADD CONSTRAINT "BookingExtra_extraServiceId_fkey" FOREIGN KEY ("extraServiceId") REFERENCES "ExtraService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
