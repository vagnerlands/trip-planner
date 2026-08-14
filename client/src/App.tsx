import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  Activity,
  ActivityInput,
  AuthenticatedUser,
  CreateTrip,
  Trip,
  TripSummary,
  UserTrips
} from "@trip-planner/shared";
import { api } from "./api";
import { ActivityBrowser } from "./components/ActivityBrowser";
import { ActivityEditor } from "./components/ActivityEditor";
import { CalendarTimeline } from "./components/CalendarTimeline";
import { TripMap } from "./components/TripMap";
import { TopMenu } from "./components/TopMenu";
import { activitiesConflict } from "./trip-utils";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function Login({ onLogin }: { onLogin: (user: AuthenticatedUser) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await api.login(username, password);
      api.setUser(user);
      onLogin(user);
    } catch {
      setError("Invalid username or password.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">
          TP
        </div>
        <p className="eyebrow">YOUR JOURNEY, ORGANIZED</p>
        <h1 id="login-title">Trip Planner</h1>
        <p className="muted">Sign in to continue to your trips.</p>
        <form onSubmit={submit}>
          <label>
            Username
            <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="local-note">Local development login: admin / admin</p>
      </section>
    </main>
  );
}

const today = new Date().toISOString().slice(0, 10);
const initialTrip: CreateTrip = { title: "", startDate: today, endDate: today, timezone: "UTC", currency: "USD" };

function Dashboard({
  user,
  onLogout,
  onUnauthorized
}: {
  user: AuthenticatedUser;
  onLogout: () => void;
  onUnauthorized: () => void;
}) {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [current, setCurrent] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Activity | "new" | null>(null);
  const [browse, setBrowse] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revealDate, setRevealDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [tripDraft, setTripDraft] = useState<CreateTrip>(initialTrip);
  const importRef = useRef<HTMLInputElement>(null);

  async function protect<T>(operation: () => Promise<T>): Promise<T | undefined> {
    try {
      return await operation();
    } catch (caught) {
      if ((caught as { status?: number }).status === 401) onUnauthorized();
      else setError(errorMessage(caught));
      return undefined;
    }
  }
  function applyTrip(trip: Trip) {
    setCurrent(trip);
    setActivities(trip.activities);
    setFrom(trip.startDate);
    setTo(trip.startDate);
    setSelectedId(null);
  }
  async function load() {
    setLoading(true);
    setError("");
    const listing = await protect(() => api.trips());
    if (listing) {
      setTrips(listing.trips);
      const trip = await protect(() => api.currentTrip());
      if (trip) applyTrip(trip);
    }
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function selectTrip(id: string) {
    const trip = await protect(() => api.selectTrip(id));
    if (trip) applyTrip(trip);
  }
  async function addTrip(event: FormEvent) {
    event.preventDefault();
    const trip = await protect(() => api.createTrip(tripDraft));
    if (!trip) return;
    applyTrip(trip);
    setTrips((items) => [
      ...items,
      { id: trip.id, title: trip.title, startDate: trip.startDate, endDate: trip.endDate, activityCount: 0 }
    ]);
    setShowAddTrip(false);
    setTripDraft(initialTrip);
  }
  async function importTrips(file?: File) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as UserTrips;
      const listing = await protect(() => api.importTrips(data));
      if (listing) await load();
    } catch (caught) {
      setError(`Import failed: ${errorMessage(caught)}`);
    }
    if (importRef.current) importRef.current.value = "";
  }
  async function logout() {
    await protect(() => api.logout());
    api.setUser(null);
    onLogout();
  }

  async function saveActivity(input: ActivityInput) {
    const saved =
      editing !== "new" && editing ? await api.updateActivity(editing.id, input) : await api.createActivity(input);
    const next =
      editing !== "new" && editing
        ? activities.map((item) => (item.id === saved.id ? saved : item))
        : [...activities, saved];
    setActivities(next);
    setCurrent((trip) => (trip ? { ...trip, activities: next } : trip));
    setTrips((items) =>
      items.map((trip) => (trip.id === current?.id ? { ...trip, activityCount: next.length } : trip))
    );
    setEditing(null);
    const dayActivities = next.filter(({ date }) => date === saved.date);
    setNotice(
      activitiesConflict(dayActivities)
        ? "Activity saved. This day now has an overlapping schedule."
        : "Activity saved to the server."
    );
    if (saved.date < from || saved.date > to) setRevealDate(saved.date);
    else {
      setRevealDate(null);
      setSelectedId(saved.id);
    }
  }

  async function deleteActivity(activity: Activity) {
    if (!window.confirm(`Delete “${activity.title}”? This cannot be undone.`)) return;
    try {
      await api.deleteActivity(activity.id);
    } catch (caught) {
      if ((caught as { status?: number }).status === 401) onUnauthorized();
      else setError(errorMessage(caught));
      return;
    }
    const next = activities.filter(({ id }) => id !== activity.id);
    setActivities(next);
    setCurrent((trip) => (trip ? { ...trip, activities: next } : trip));
    setTrips((items) =>
      items.map((trip) => (trip.id === current?.id ? { ...trip, activityCount: next.length } : trip))
    );
    setSelectedId(null);
    setEditing(null);
    setNotice("Activity deleted from the server.");
  }

  function chooseFromBrowser(activity: Activity) {
    setFrom(activity.date);
    setTo(activity.date);
    setSelectedId(activity.id);
    setBrowse(false);
  }
  const visibleActivities = activities.filter(({ date }) => date >= from && date <= to);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to trip content
      </a>
      <header className="topbar">
        <a className="wordmark" href="#main">
          <span>TP</span> Trip Planner
        </a>
        <nav aria-label="Main navigation">
          <TopMenu label="Trips">
            <button onClick={() => setShowAddTrip(true)}>＋ Add trip</button>
            <button onClick={() => importRef.current?.click()}>⇧ Import JSON</button>
            <button onClick={() => void protect(() => api.exportTrips())}>⇩ Export JSON</button>
          </TopMenu>
          <TopMenu label="Activities">
            <button onClick={() => setEditing("new")}>＋ New activity</button>
            <button onClick={() => setBrowse(true)}>⌕ Browse activities</button>
          </TopMenu>
          <TopMenu label="User">
            <span className="user-info">
              Signed in as <strong>{user.username}</strong>
            </span>
            <button onClick={() => void logout()}>Log out</button>
          </TopMenu>
        </nav>
        <input
          ref={importRef}
          hidden
          type="file"
          accept="application/json,.json"
          onChange={(event) => void importTrips(event.target.files?.[0])}
        />
      </header>

      <main id="main" className="content">
        {error && (
          <div className="banner error" role="alert">
            {error}
            <button aria-label="Dismiss" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        {notice && (
          <div className="banner notice" role="status">
            <span>{notice}</span>
            <span>
              {revealDate && (
                <button
                  className="text-button"
                  onClick={() => {
                    setFrom(revealDate);
                    setTo(revealDate);
                    setRevealDate(null);
                  }}
                >
                  Show that day
                </button>
              )}
              <button aria-label="Dismiss" onClick={() => setNotice("")}>
                ×
              </button>
            </span>
          </div>
        )}
        <section className="trip-heading">
          <div>
            <p className="eyebrow">CURRENT TRIP</p>
            <h1>{loading ? "Loading…" : (current?.title ?? "No trip")}</h1>
            {current && (
              <p className="muted">
                {current.startDate} → {current.endDate} · {current.timezone} · {current.currency}
              </p>
            )}
          </div>
          <label className="trip-selector">
            Working trip
            <select
              value={current?.id ?? ""}
              onChange={(event) => void selectTrip(event.target.value)}
              disabled={loading}
            >
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title} ({trip.activityCount})
                </option>
              ))}
            </select>
          </label>
        </section>

        {showAddTrip && (
          <section className="panel add-trip" aria-labelledby="add-trip-title">
            <div className="panel-title">
              <h2 id="add-trip-title">Add a trip</h2>
              <button aria-label="Close" onClick={() => setShowAddTrip(false)}>
                ×
              </button>
            </div>
            <form onSubmit={addTrip} className="trip-form">
              <label>
                Title
                <input
                  required
                  value={tripDraft.title}
                  onChange={(e) => setTripDraft({ ...tripDraft, title: e.target.value })}
                />
              </label>
              <label>
                Start date
                <input
                  required
                  type="date"
                  value={tripDraft.startDate}
                  onChange={(e) => setTripDraft({ ...tripDraft, startDate: e.target.value })}
                />
              </label>
              <label>
                End date
                <input
                  required
                  type="date"
                  min={tripDraft.startDate}
                  value={tripDraft.endDate}
                  onChange={(e) => setTripDraft({ ...tripDraft, endDate: e.target.value })}
                />
              </label>
              <label>
                Timezone
                <input
                  required
                  value={tripDraft.timezone}
                  onChange={(e) => setTripDraft({ ...tripDraft, timezone: e.target.value })}
                />
              </label>
              <label>
                Currency
                <input
                  required
                  maxLength={3}
                  value={tripDraft.currency}
                  onChange={(e) => setTripDraft({ ...tripDraft, currency: e.target.value.toUpperCase() })}
                />
              </label>
              <button className="primary">Create trip</button>
            </form>
          </section>
        )}

        {current && (
          <>
            <CalendarTimeline
              trip={current}
              activities={activities}
              from={from}
              to={to}
              onChange={(nextFrom, nextTo) => {
                setFrom(nextFrom);
                setTo(nextTo);
                setSelectedId(null);
              }}
            />
            <div className="map-heading">
              <div>
                <p className="eyebrow">MAP VIEW</p>
                <h2>
                  {visibleActivities.length} {visibleActivities.length === 1 ? "activity" : "activities"}
                </h2>
              </div>
              <button className="primary compact" onClick={() => setEditing("new")}>
                ＋ New activity
              </button>
            </div>
            <TripMap
              activities={visibleActivities}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onEdit={setEditing}
              onDelete={(activity) => void deleteActivity(activity)}
            />
          </>
        )}
      </main>
      {current && editing && (
        <ActivityEditor
          trip={current}
          selectedDate={from}
          activity={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={saveActivity}
        />
      )}
      {browse && (
        <ActivityBrowser
          activities={activities}
          onClose={() => setBrowse(false)}
          onSelect={chooseFromBrowser}
          onEdit={(activity) => {
            setBrowse(false);
            setEditing(activity);
          }}
          onDelete={(activity) => void deleteActivity(activity)}
        />
      )}
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    api
      .me()
      .then((authenticated) => {
        api.setUser(authenticated);
        setUser(authenticated);
      })
      .catch(() => api.setUser(null))
      .finally(() => setChecking(false));
  }, []);
  if (checking)
    return (
      <main className="splash">
        <div className="brand-mark">TP</div>
        <p>Loading Trip Planner…</p>
      </main>
    );
  if (!user) return <Login onLogin={setUser} />;
  return (
    <Dashboard
      user={user}
      onLogout={() => setUser(null)}
      onUnauthorized={() => {
        api.setUser(null);
        setUser(null);
      }}
    />
  );
}
