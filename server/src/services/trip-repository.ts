import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  activityInputSchema,
  createTripSchema,
  userTripsSchema,
  type Activity,
  type ActivityInput,
  type CreateTrip,
  type Trip,
  type TripSummary,
  type UserTrips
} from "@trip-planner/shared";
import { HttpError } from "../errors.js";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDataRoot = path.resolve(sourceDirectory, "../../data/users");
const safeUsernamePattern = /^[a-zA-Z0-9_-]+$/;

export class TripRepository {
  private readonly writeQueues = new Map<string, Promise<void>>();
  private readonly mutationQueues = new Map<string, Promise<unknown>>();

  constructor(private readonly dataRoot = defaultDataRoot) {}

  private userFile(username: string): string {
    if (!safeUsernamePattern.test(username)) throw new HttpError(400, "Invalid user identity");
    const root = path.resolve(this.dataRoot);
    const file = path.resolve(root, username, "trips.json");
    if (!file.startsWith(`${root}${path.sep}`)) throw new HttpError(400, "Invalid user data path");
    return file;
  }

  private defaultTrip(): Trip {
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: randomUUID(),
      title: "My Trip",
      startDate: today,
      endDate: today,
      timezone: "UTC",
      currency: "USD",
      activities: []
    };
  }

  async load(username: string): Promise<UserTrips> {
    const file = this.userFile(username);
    let raw: string;
    try {
      raw = await readFile(file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const initial = { schemaVersion: 1 as const, trips: [this.defaultTrip()] };
      await this.save(username, initial);
      return initial;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new HttpError(500, "The user's trip JSON is not valid JSON");
    }

    const result = userTripsSchema.safeParse(parsed);
    if (!result.success)
      throw new HttpError(
        500,
        `The user's trip JSON is invalid: ${result.error.issues[0]?.message ?? "validation failed"}`
      );
    if (result.data.trips.length > 0) return result.data;

    const withDefault = { ...result.data, trips: [this.defaultTrip()] };
    await this.save(username, withDefault);
    return withDefault;
  }

  async save(username: string, data: UserTrips): Promise<void> {
    const validated = userTripsSchema.parse(data);
    const previous = this.writeQueues.get(username) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        const file = this.userFile(username);
        await mkdir(path.dirname(file), { recursive: true });
        const temporary = `${file}.${randomUUID()}.tmp`;
        await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
        await rename(temporary, file);
      });
    this.writeQueues.set(username, current);
    try {
      await current;
    } finally {
      if (this.writeQueues.get(username) === current) this.writeQueues.delete(username);
    }
  }

  async summaries(username: string): Promise<TripSummary[]> {
    const data = await this.load(username);
    return data.trips.map(({ id, title, startDate, endDate, activities }) => ({
      id,
      title,
      startDate,
      endDate,
      activityCount: activities.length
    }));
  }

  async getCurrent(username: string, currentTripId?: string): Promise<{ trip: Trip; currentTripId: string }> {
    const data = await this.load(username);
    const trip = data.trips.find(({ id }) => id === currentTripId) ?? data.trips.at(-1);
    if (!trip) throw new HttpError(500, "No trip could be selected");
    return { trip, currentTripId: trip.id };
  }

  async create(username: string, input: CreateTrip): Promise<Trip> {
    const values = createTripSchema.parse(input);
    const trip: Trip = { id: randomUUID(), ...values, activities: [] };
    await this.mutate(username, (data) => {
      data.trips.push(trip);
      return trip;
    });
    return trip;
  }

  private async mutate<T>(username: string, operation: (data: UserTrips) => T | Promise<T>): Promise<T> {
    const previous = this.mutationQueues.get(username) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        const data = await this.load(username);
        const result = await operation(data);
        await this.save(username, data);
        return result;
      });
    this.mutationQueues.set(username, current);
    try {
      return await current;
    } finally {
      if (this.mutationQueues.get(username) === current) this.mutationQueues.delete(username);
    }
  }

  private currentTripFrom(data: UserTrips, currentTripId: string): Trip {
    const trip = data.trips.find(({ id }) => id === currentTripId);
    if (!trip) throw new HttpError(404, "Current trip not found");
    return trip;
  }

  async activities(username: string, currentTripId: string, from?: string, to?: string): Promise<Activity[]> {
    const trip = this.currentTripFrom(await this.load(username), currentTripId);
    return trip.activities
      .filter((activity) => (!from || activity.date >= from) && (!to || activity.date <= to))
      .sort((a, b) => `${a.date}T${a.suggestedTime}`.localeCompare(`${b.date}T${b.suggestedTime}`));
  }

  async createActivity(username: string, currentTripId: string, input: ActivityInput): Promise<Activity> {
    const values = activityInputSchema.parse(input);
    return this.mutate(username, (data) => {
      const trip = this.currentTripFrom(data, currentTripId);
      const activity = { id: randomUUID(), ...values } satisfies Activity;
      trip.activities.push(activity);
      return activity;
    });
  }

  async updateActivity(
    username: string,
    currentTripId: string,
    activityId: string,
    input: ActivityInput
  ): Promise<Activity> {
    const values = activityInputSchema.parse(input);
    return this.mutate(username, (data) => {
      const trip = this.currentTripFrom(data, currentTripId);
      const index = trip.activities.findIndex(({ id }) => id === activityId);
      if (index < 0) throw new HttpError(404, "Activity not found");
      const activity = { id: activityId, ...values } satisfies Activity;
      trip.activities[index] = activity;
      return activity;
    });
  }

  async deleteActivity(username: string, currentTripId: string, activityId: string): Promise<void> {
    await this.mutate(username, (data) => {
      const trip = this.currentTripFrom(data, currentTripId);
      const index = trip.activities.findIndex(({ id }) => id === activityId);
      if (index < 0) throw new HttpError(404, "Activity not found");
      trip.activities.splice(index, 1);
    });
  }

  async assertTrip(username: string, tripId: string): Promise<Trip> {
    const data = await this.load(username);
    const trip = data.trips.find(({ id }) => id === tripId);
    if (!trip) throw new HttpError(404, "Trip not found");
    return trip;
  }

  async export(username: string): Promise<UserTrips> {
    return this.load(username);
  }

  async import(username: string, input: unknown): Promise<UserTrips> {
    const parsed = userTripsSchema.safeParse(input);
    if (!parsed.success)
      throw new HttpError(400, `Import rejected: ${parsed.error.issues[0]?.message ?? "invalid data"}`);
    const imported = parsed.data.trips.length ? parsed.data : { ...parsed.data, trips: [this.defaultTrip()] };
    const file = this.userFile(username);
    try {
      const stamp = new Date().toISOString().replaceAll(":", "-");
      await copyFile(file, `${file}.backup-${stamp}.json`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await this.save(username, imported);
    return imported;
  }
}
