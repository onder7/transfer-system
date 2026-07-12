export interface Location {
  id: string;
  name: string;
  nameEn: string | null;
  type: string; // 'airport' | 'region' | 'hotel'
  lat?: number | null;
  lng?: number | null;
}

export interface BookingState {
  tripType: 'one-way' | 'round-trip';
  direction: 'AIRPORT_TO_REGION' | 'REGION_TO_AIRPORT';
  destType: 'region' | 'hotel';
  fromLocationId: string;
  toLocationId: string;
  date: string;
  time: string;
  returnDate?: string;
  returnTime?: string;
  adultCount: number;
  childCount: number;
  flightNo?: string;
  selectedVehicleId: string | null;
}

export interface VehicleClass {
  id: string;
  name: string;
  nameEn: string | null;
  capacity: number;
  luggageCapacity: number;
  isShared: boolean;
  features: string[];
  imageUrl: string | null;
}

export interface TransferResult {
  vehicleClass: VehicleClass;
  price: number;
  pricePerPerson: number | null;
  childUnitPrice: number | null;
  childDiscount: number | null;
  childLabel: string | null;
  returnPrice: number | null;
  surchargeApplied: boolean;
  multiplier: number;
}
