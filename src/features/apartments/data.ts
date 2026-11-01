// Apartment records for the public site.
//
// EVERYTHING HERE IS SAMPLE DATA for the concept presentation. It is not a real offer: the unit
// symbols, floors, room counts and areas are illustrative, `price` is deliberately null (shown as
// "to be confirmed") and no availability is implied. The UI always labels these records as samples.
//
// To publish real data later: replace SAMPLE_APARTMENTS with the confirmed records (keep the same
// shape), set `sample: false`, and fill `price` / `status` as they are confirmed. The explorer and
// its filters need no redesign.

export type ApartmentStatus = "pending";

export type Apartment = {
  /** Unit symbol, e.g. "A-01". */
  id: string;
  floor: number;
  rooms: number;
  /** Net area in m². */
  area: number;
  /** Price in PLN; null until confirmed. */
  price: number | null;
  status: ApartmentStatus;
  /** True for illustrative records. The UI shows a "sample" marker on every sample record. */
  sample: boolean;
};

export const SAMPLE_APARTMENTS: readonly Apartment[] = [
  { id: "A-01", floor: 1, rooms: 2, area: 38.4, price: null, status: "pending", sample: true },
  { id: "A-02", floor: 1, rooms: 3, area: 52.1, price: null, status: "pending", sample: true },
  { id: "A-03", floor: 2, rooms: 1, area: 29.6, price: null, status: "pending", sample: true },
  { id: "A-04", floor: 2, rooms: 2, area: 41.3, price: null, status: "pending", sample: true },
  { id: "A-05", floor: 2, rooms: 3, area: 57.8, price: null, status: "pending", sample: true },
  { id: "A-06", floor: 3, rooms: 2, area: 43.0, price: null, status: "pending", sample: true },
  { id: "A-07", floor: 3, rooms: 4, area: 74.5, price: null, status: "pending", sample: true },
  { id: "A-08", floor: 4, rooms: 3, area: 61.2, price: null, status: "pending", sample: true },
];

export const SAMPLE_FLOORS = [1, 2, 3, 4] as const;
