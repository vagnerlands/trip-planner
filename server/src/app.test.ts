import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { mkdtemp } from "node:fs/promises";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { createApp } from "./app.js";

const adminHash =
  "scrypt:0e849945f104de80d77d63da2352318e:7642eff9faa4b0f2ef71840bd35d8ddc1a1cdcb4472c5096f75b504402491a7ee98fce7afb6fc100b5c82a0a1b5fd78a065475e906f8839797cf250eff9de817";
let temporaryRoot: string;
let dataRoot: string;
let usersFile: string;

async function writeTrips(trips: unknown[], username = "admin") {
  const directory = path.join(dataRoot, username);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "trips.json"), JSON.stringify({ schemaVersion: 1, trips }), "utf8");
}

const trip = (id: string) => ({
  id,
  title: id,
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  timezone: "UTC",
  currency: "USD",
  activities: []
});

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "trip-planner-test-"));
  dataRoot = path.join(temporaryRoot, "users");
  usersFile = path.join(temporaryRoot, "users.json");
  await writeFile(
    usersFile,
    JSON.stringify({
      users: [
        { username: "admin", passwordHash: adminHash },
        { username: "bob", passwordHash: adminHash }
      ]
    }),
    "utf8"
  );
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

async function login(agent: ReturnType<typeof request.agent>, username = "admin") {
  const response = await agent.post("/api/auth/login").send({ username, password: "admin" }).expect(200);
  return response.body.csrfToken as string;
}

describe("authentication and trips API", () => {
  it("rejects protected requests and invalid credentials", async () => {
    const app = createApp({ dataRoot, usersFile, sessionSecret: "test-secret", logger: false });
    await request(app).get("/api/trips").expect(401);
    await request(app).post("/api/auth/login").send({ username: "admin", password: "wrong" }).expect(401);
  });

  it("selects the final JSON trip on login and enforces CSRF", async () => {
    await writeTrips([trip("first"), trip("last")]);
    const agent = request.agent(createApp({ dataRoot, usersFile, sessionSecret: "test-secret", logger: false }));
    const csrf = await login(agent);
    const listing = await agent.get("/api/trips").expect(200);
    expect(listing.body.currentTripId).toBe("last");
    expect((await agent.get("/api/trips/current").expect(200)).body.id).toBe("last");
    await agent.post("/api/trips").send(trip("invalid-shape")).expect(403);
    await agent
      .post("/api/trips")
      .set("x-csrf-token", csrf)
      .send({ title: "New", startDate: "2026-03-01", endDate: "2026-03-02", timezone: "UTC", currency: "USD" })
      .expect(201);
  });

  it("creates and persists a default trip for an empty user file", async () => {
    await writeTrips([]);
    const agent = request.agent(createApp({ dataRoot, usersFile, sessionSecret: "test-secret", logger: false }));
    await login(agent);
    const current = await agent.get("/api/trips/current").expect(200);
    expect(current.body.title).toBe("My Trip");
    const stored = JSON.parse(await readFile(path.join(dataRoot, "admin", "trips.json"), "utf8")) as {
      trips: unknown[];
    };
    expect(stored.trips).toHaveLength(1);
  });

  it("rejects invalid imports without replacing valid data", async () => {
    await writeTrips([trip("safe")]);
    const agent = request.agent(createApp({ dataRoot, usersFile, sessionSecret: "test-secret", logger: false }));
    const csrf = await login(agent);
    await agent
      .post("/api/trips/import")
      .set("x-csrf-token", csrf)
      .send({ schemaVersion: 1, trips: [{ broken: true }] })
      .expect(400);
    const stored = JSON.parse(await readFile(path.join(dataRoot, "admin", "trips.json"), "utf8")) as {
      trips: Array<{ id: string }>;
    };
    expect(stored.trips[0]?.id).toBe("safe");
  });

  it("creates, filters, updates, and deletes activities in the current trip", async () => {
    await writeTrips([trip("active")]);
    const agent = request.agent(createApp({ dataRoot, usersFile, sessionSecret: "test-secret", logger: false }));
    const csrf = await login(agent);
    const input = {
      date: "2026-01-01",
      suggestedTime: "10:00",
      title: "Museum",
      description: "Visit",
      observations: "",
      pictureUrl: "",
      location: { latitude: 38.7, longitude: -9.1, address: "Lisbon" },
      durationMinutes: 60,
      tags: ["culture"]
    };
    const created = await agent.post("/api/activities").set("x-csrf-token", csrf).send(input).expect(201);
    expect(created.body.id).toBeTypeOf("string");
    const filtered = await agent.get("/api/activities?from=2026-01-01&to=2026-01-01").expect(200);
    expect(filtered.body.activities).toHaveLength(1);
    await agent
      .put(`/api/activities/${created.body.id}`)
      .set("x-csrf-token", csrf)
      .send({ ...input, title: "Updated museum" })
      .expect(200)
      .expect(({ body }) => expect(body.title).toBe("Updated museum"));
    await agent.delete(`/api/activities/${created.body.id}`).set("x-csrf-token", csrf).expect(204);
    expect((await agent.get("/api/trips/current").expect(200)).body.activities).toHaveLength(0);
  });

  it("isolates each authenticated user's JSON and invalidates logout sessions", async () => {
    await writeTrips([trip("admin-trip")]);
    await writeTrips([trip("bob-trip")], "bob");
    const app = createApp({ dataRoot, usersFile, sessionSecret: "test-secret", logger: false });
    const admin = request.agent(app);
    const bob = request.agent(app);
    const adminCsrf = await login(admin);
    await login(bob, "bob");
    expect((await admin.get("/api/trips/current").expect(200)).body.id).toBe("admin-trip");
    expect((await bob.get("/api/trips/current").expect(200)).body.id).toBe("bob-trip");
    await admin.post("/api/auth/logout").set("x-csrf-token", adminCsrf).expect(204);
    await admin.get("/api/trips").expect(401);
  });

  it("adds security, cache, and request tracing headers", async () => {
    await writeTrips([trip("secure")]);
    const agent = request.agent(createApp({ dataRoot, usersFile, sessionSecret: "test-secret", logger: false }));
    await login(agent);
    const response = await agent.get("/api/trips").expect(200);
    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-request-id"]).toBeTypeOf("string");
    await agent.get("/api/activities?from=not-a-date").expect(400);
  });

  it("redirects non-API pages to Vite during development", async () => {
    const app = createApp({ dataRoot, usersFile, sessionSecret: "test-secret", logger: false, serveClient: false });
    const response = await request(app).get("/").expect(307);
    expect(response.headers.location).toMatch(/^http:\/\/[^/]+:5173\/$/);
  });
});
