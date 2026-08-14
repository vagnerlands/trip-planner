import { z } from "zod";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRealDate(value: string): boolean {
  if (!isoDatePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export const isoDateSchema = z.string().refine(isRealDate, "Expected a valid ISO date (YYYY-MM-DD)");
export const timeSchema = z.string().regex(timePattern, "Expected a 24-hour time (HH:mm)");
export const currencySchema = z.string().regex(/^[A-Z]{3}$/, "Expected a three-letter currency code");

export const locationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().trim().optional()
  })
  .passthrough();

export const priceSchema = z
  .object({
    amount: z.number().nonnegative(),
    currency: currencySchema,
    type: z.enum(["ticket", "expected", "other"]).default("expected"),
    isEstimate: z.boolean().default(true)
  })
  .passthrough();

export const activitySchema = z
  .object({
    id: z.string().trim().min(1),
    date: isoDateSchema,
    suggestedTime: timeSchema,
    title: z.string().trim().min(1).max(200),
    description: z.string().default(""),
    pictureUrl: z.union([z.url({ protocol: /^https?$/ }), z.literal("")]).optional(),
    observations: z.string().default(""),
    location: locationSchema,
    durationMinutes: z.number().int().nonnegative(),
    price: priceSchema.optional(),
    tags: z.array(z.string().trim().min(1)).default([])
  })
  .passthrough();

export const activityInputSchema = activitySchema.omit({ id: true });

export const tripSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1).max(200),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    timezone: z.string().trim().min(1),
    currency: currencySchema,
    activities: z.array(activitySchema).default([])
  })
  .passthrough()
  .superRefine((trip, context) => {
    if (trip.endDate < trip.startDate) {
      context.addIssue({ code: "custom", path: ["endDate"], message: "End date must not be before start date" });
    }
    const ids = new Set<string>();
    trip.activities.forEach((activity, index) => {
      if (ids.has(activity.id)) {
        context.addIssue({ code: "custom", path: ["activities", index, "id"], message: "Activity IDs must be unique" });
      }
      ids.add(activity.id);
    });
  });

export const userTripsSchema = z
  .object({
    schemaVersion: z.literal(1),
    trips: z.array(tripSchema)
  })
  .passthrough()
  .superRefine((data, context) => {
    const ids = new Set<string>();
    data.trips.forEach((trip, index) => {
      if (ids.has(trip.id)) {
        context.addIssue({ code: "custom", path: ["trips", index, "id"], message: "Trip IDs must be unique" });
      }
      ids.add(trip.id);
    });
  });

export const createTripSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    timezone: z.string().trim().min(1),
    currency: currencySchema
  })
  .superRefine((trip, context) => {
    if (trip.endDate < trip.startDate) {
      context.addIssue({ code: "custom", path: ["endDate"], message: "End date must not be before start date" });
    }
  });

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});

export type Activity = z.infer<typeof activitySchema>;
export type ActivityInput = z.input<typeof activityInputSchema>;
export type Trip = z.infer<typeof tripSchema>;
export type UserTrips = z.infer<typeof userTripsSchema>;
export type CreateTrip = z.infer<typeof createTripSchema>;

export interface TripSummary {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  activityCount: number;
}

export interface AuthenticatedUser {
  username: string;
  csrfToken: string;
}
