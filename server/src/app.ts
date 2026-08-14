import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import helmet from "helmet";
import { activityInputSchema, createTripSchema, isoDateSchema, loginSchema } from "@trip-planner/shared";
import { ZodError, z } from "zod";
import { HttpError } from "./errors.js";
import { TripRepository } from "./services/trip-repository.js";
import { UserService } from "./services/user-service.js";

export interface AppOptions {
  dataRoot?: string;
  usersFile?: string;
  sessionSecret?: string;
  serveClient?: boolean;
  logger?: ((entry: Record<string, unknown>) => void) | false;
}

function requireAuth(request: Request, _response: Response, next: NextFunction): void {
  if (!request.session.username) return next(new HttpError(401, "Authentication required"));
  next();
}

function requireCsrf(request: Request, _response: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
  const supplied = request.header("x-csrf-token");
  if (!request.session.csrfToken || supplied !== request.session.csrfToken)
    return next(new HttpError(403, "Invalid CSRF token"));
  next();
}

function newCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const trips = new TripRepository(options.dataRoot);
  const users = new UserService(options.usersFile);
  const log =
    options.logger === false ? undefined : (options.logger ?? ((entry) => console.log(JSON.stringify(entry))));

  app.disable("x-powered-by");
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://*.tile.openstreetmap.org"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"]
        }
      }
    })
  );
  app.use((request, response, next) => {
    const requestId = request.header("x-request-id")?.slice(0, 100) || randomUUID();
    const started = performance.now();
    response.setHeader("x-request-id", requestId);
    response.on("finish", () => {
      log?.({
        level: response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info",
        event: "request",
        requestId,
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Math.round(performance.now() - started),
        user: request.session?.username ?? null
      });
    });
    next();
  });
  app.use(express.json({ limit: "2mb" }));
  app.use(
    session({
      name: "trip.sid",
      secret: options.sessionSecret ?? process.env.SESSION_SECRET ?? "local-development-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE === "true",
        maxAge: 8 * 60 * 60 * 1000
      }
    })
  );
  app.use("/api", (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (_request, response) => response.json({ status: "ok" }));

  app.post("/api/auth/login", async (request, response, next) => {
    try {
      const credentials = loginSchema.parse(request.body);
      if (!(await users.verify(credentials.username, credentials.password)))
        throw new HttpError(401, "Invalid username or password");
      await new Promise<void>((resolve, reject) =>
        request.session.regenerate((error) => (error ? reject(error) : resolve()))
      );
      request.session.username = credentials.username;
      request.session.csrfToken = newCsrfToken();
      const current = await trips.getCurrent(credentials.username);
      request.session.currentTripId = current.currentTripId;
      response.json({ username: credentials.username, csrfToken: request.session.csrfToken });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/me", requireAuth, (request, response) => {
    response.json({ username: request.session.username, csrfToken: request.session.csrfToken });
  });

  app.post("/api/auth/logout", requireAuth, requireCsrf, (request, response, next) => {
    request.session.destroy((error) => {
      if (error) return next(error);
      response.clearCookie("trip.sid");
      response.status(204).end();
    });
  });

  const api = express.Router();
  api.use(requireAuth, requireCsrf);

  api.get("/trips", async (request, response, next) => {
    try {
      const username = request.session.username!;
      const items = await trips.summaries(username);
      const current = await trips.getCurrent(username, request.session.currentTripId);
      request.session.currentTripId = current.currentTripId;
      response.json({ trips: items, currentTripId: current.currentTripId });
    } catch (error) {
      next(error);
    }
  });

  api.post("/trips", async (request, response, next) => {
    try {
      const username = request.session.username!;
      const trip = await trips.create(username, createTripSchema.parse(request.body));
      request.session.currentTripId = trip.id;
      response.status(201).json(trip);
    } catch (error) {
      next(error);
    }
  });

  api.get("/trips/current", async (request, response, next) => {
    try {
      const current = await trips.getCurrent(request.session.username!, request.session.currentTripId);
      request.session.currentTripId = current.currentTripId;
      response.json(current.trip);
    } catch (error) {
      next(error);
    }
  });

  api.put("/trips/current/:tripId", async (request, response, next) => {
    try {
      const trip = await trips.assertTrip(request.session.username!, request.params.tripId);
      request.session.currentTripId = trip.id;
      response.json(trip);
    } catch (error) {
      next(error);
    }
  });

  api.get("/trips/export", async (request, response, next) => {
    try {
      const data = await trips.export(request.session.username!);
      response.setHeader("Content-Disposition", "attachment; filename=trips.json");
      response.json(data);
    } catch (error) {
      next(error);
    }
  });

  api.post("/trips/import", async (request, response, next) => {
    try {
      const data = await trips.import(request.session.username!, request.body);
      request.session.currentTripId = data.trips.at(-1)!.id;
      response.json({
        trips: await trips.summaries(request.session.username!),
        currentTripId: request.session.currentTripId
      });
    } catch (error) {
      next(error);
    }
  });

  const activityQuerySchema = z.object({ from: isoDateSchema.optional(), to: isoDateSchema.optional() });

  api.get("/activities", async (request, response, next) => {
    try {
      const query = activityQuerySchema.parse(request.query);
      const activities = await trips.activities(
        request.session.username!,
        request.session.currentTripId!,
        query.from,
        query.to
      );
      response.json({ activities });
    } catch (error) {
      next(error);
    }
  });

  api.post("/activities", async (request, response, next) => {
    try {
      const activity = await trips.createActivity(
        request.session.username!,
        request.session.currentTripId!,
        activityInputSchema.parse(request.body)
      );
      response.status(201).json(activity);
    } catch (error) {
      next(error);
    }
  });

  api.put("/activities/:activityId", async (request, response, next) => {
    try {
      const activity = await trips.updateActivity(
        request.session.username!,
        request.session.currentTripId!,
        request.params.activityId,
        activityInputSchema.parse(request.body)
      );
      response.json(activity);
    } catch (error) {
      next(error);
    }
  });

  api.delete("/activities/:activityId", async (request, response, next) => {
    try {
      await trips.deleteActivity(request.session.username!, request.session.currentTripId!, request.params.activityId);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", api);

  if (options.serveClient ?? process.env.NODE_ENV === "production") {
    const directory = path.dirname(fileURLToPath(import.meta.url));
    const clientDist = path.resolve(directory, "../../client/dist");
    app.use(express.static(clientDist));
    app.use((request, response, next) => {
      if (request.method !== "GET" || request.path.startsWith("/api/")) return next();
      response.sendFile(path.join(clientDist, "index.html"));
    });
  } else {
    app.use((request, response, next) => {
      if (request.method !== "GET" || request.path.startsWith("/api/")) return next();
      const localAddress = request.socket.localAddress?.replace(/^::ffff:/, "") ?? "127.0.0.1";
      const developmentHost = localAddress === "::1" || localAddress === "0.0.0.0" ? "127.0.0.1" : localAddress;
      response.redirect(307, `http://${developmentHost}:5173${request.originalUrl}`);
    });
  }

  const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof ZodError) {
      response.status(400).json({ error: "Validation failed", issues: error.issues });
      return;
    }
    log?.({ level: "error", event: "unhandled_error", path: request.path, message: String(error) });
    response.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);
  return app;
}
