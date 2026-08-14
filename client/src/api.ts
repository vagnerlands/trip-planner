import type {
  Activity,
  ActivityInput,
  AuthenticatedUser,
  CreateTrip,
  Trip,
  TripSummary,
  UserTrips
} from "@trip-planner/shared";

let csrfToken = "";

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (csrfToken && !["GET", "HEAD"].includes(init.method ?? "GET")) headers.set("x-csrf-token", csrfToken);
  const response = await fetch(url, { ...init, headers, credentials: "same-origin" });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: "Request failed" }))) as { error?: string };
    const error = new Error(body.error ?? `Request failed (${response.status})`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  setUser(user: AuthenticatedUser | null) {
    csrfToken = user?.csrfToken ?? "";
  },
  me: () => request<AuthenticatedUser>("/api/auth/me"),
  login: (username: string, password: string) =>
    request<AuthenticatedUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  trips: () => request<{ trips: TripSummary[]; currentTripId: string }>("/api/trips"),
  currentTrip: () => request<Trip>("/api/trips/current"),
  selectTrip: (id: string) => request<Trip>(`/api/trips/current/${encodeURIComponent(id)}`, { method: "PUT" }),
  createTrip: (trip: CreateTrip) => request<Trip>("/api/trips", { method: "POST", body: JSON.stringify(trip) }),
  activities: (from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return request<{ activities: Activity[] }>(`/api/activities${query.size ? `?${query}` : ""}`);
  },
  createActivity: (activity: ActivityInput) =>
    request<Activity>("/api/activities", { method: "POST", body: JSON.stringify(activity) }),
  updateActivity: (id: string, activity: ActivityInput) =>
    request<Activity>(`/api/activities/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(activity)
    }),
  deleteActivity: (id: string) => request<void>(`/api/activities/${encodeURIComponent(id)}`, { method: "DELETE" }),
  importTrips: (data: UserTrips) =>
    request<{ trips: TripSummary[]; currentTripId: string }>("/api/trips/import", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  async exportTrips(): Promise<void> {
    const response = await fetch("/api/trips/export", {
      headers: { "x-csrf-token": csrfToken },
      credentials: "same-origin"
    });
    if (!response.ok) throw new Error("Could not export trips");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(await response.blob());
    link.download = "trips.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }
};
