import "express-session";

declare module "express-session" {
  interface SessionData {
    username?: string;
    csrfToken?: string;
    currentTripId?: string;
  }
}
