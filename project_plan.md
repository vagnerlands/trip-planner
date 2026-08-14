# Trip Planner Application — Project Plan

## 1. Goal

Build a browser-based trip-planning application available at `http://127.0.0.1:5050` that:

- loads a trip plan from JSON;
- plots trip activities on an interactive map;
- filters activities by a selected day or day interval;
- shows activity details when the user hovers over or selects a map marker;
- allows activity information to be created and edited;
- persists edits so they survive a page refresh;
- opens on a login screen and requires an authenticated session;
- loads and saves the trip JSON belonging to the logged-in user;
- supports multiple trips per user with a current-trip selector;
- provides a dark, desktop-first interface with a responsive mobile layout;
- leaves room for extending the activity schema later.

## 2. Recommended technology

- **Frontend:** React, TypeScript, and Vite
- **Map:** Leaflet with React Leaflet
- **Backend:** Node.js, Express, and TypeScript
- **Validation:** Zod
- **Testing:** Vitest, React Testing Library, and Supertest
- **Optional end-to-end testing:** Playwright

> **Library note:** Leafmap is primarily a Python/Jupyter mapping package. For a Node.js and React browser application, Leaflet plus React Leaflet is the direct fit. If “Leafmap” is a strict requirement, confirm the intended package before implementation because it would require a different architecture.

## 3. Proposed architecture

Use a small client/server application:

```text
Browser (React + React Leaflet)
        |
        | HTTP/JSON
        v
Node.js/Express API
        |
        v
Authenticated user's trip JSON file (initial persistence)
```

The Express server will expose the API and, in production mode, serve the compiled React application. It will listen on port `5050` and bind to `127.0.0.1` by default. Authentication will be enforced by the server; after login, every trip and activity request will resolve its data file from the authenticated user identity, never from a username supplied by the browser.

Suggested repository structure:

```text
trip-planner/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── App.tsx
│   └── package.json
├── server/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── schemas/
│   │   └── index.ts
│   └── data/
│       ├── users.json
│       └── users/admin/trips.json
├── shared/
│   └── activity.ts
├── tests/
├── package.json
└── project_plan.md
```

## 4. Initial data model

Give every trip and activity a stable unique `id`. Each user JSON contains an ordered `trips` array. The final entry is the trip opened after login. If the array is absent or empty, the server creates and persists a valid default trip before returning data. Use ISO dates as the source of truth; derive the weekday and trip-day number from the trip start date rather than storing inconsistent duplicates.

```json
{
  "trip": {
    "id": "portugal-2026",
    "title": "Portugal Trip",
    "timezone": "Europe/Lisbon",
    "currency": "EUR",
    "activities": [
      {
        "id": "activity-001",
        "day": 1,
        "date": "2026-09-14",
        "suggestedTime": "09:30",
        "title": "Visit Belém Tower",
        "description": "Explore the tower and nearby waterfront.",
        "pictureUrl": "https://example.com/belem.jpg",
        "observations": "Arrive early to avoid queues.",
        "location": {
          "latitude": 38.6916,
          "longitude": -9.2160,
          "address": "Av. Brasília, Lisbon"
        },
        "durationMinutes": 90,
        "price": {
          "amount": 15,
          "currency": "EUR",
          "type": "ticket",
          "isEstimate": true
        },
        "tags": ["sightseeing", "historic"]
      }
    ]
  }
}
```

Validation rules should initially include:

- required, unique `id`;
- non-empty `title`;
- valid ISO date and 24-hour time;
- latitude from `-90` to `90` and longitude from `-180` to `180`;
- non-negative duration and price;
- valid `http` or `https` picture URL when supplied;
- explicit currency code for monetary values.

Unknown optional fields can be preserved to make future schema extensions safer. Add a schema version at the trip level when migrations become necessary.

The per-user file envelope should follow this shape:

```json
{
  "schemaVersion": 1,
  "trips": [
    {
      "id": "portugal-2026",
      "title": "Portugal Trip",
      "startDate": "2026-09-14",
      "endDate": "2026-09-20",
      "timezone": "Europe/Lisbon",
      "currency": "EUR",
      "activities": []
    }
  ]
}
```

Activities belong to exactly one trip. Browse, create, edit, delete, filtering, calendar status, timeline calculations, and map markers operate only on the current trip.

## 5. API design

Initial endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Validate credentials and create a server-backed session |
| `POST` | `/api/auth/logout` | Destroy the current session |
| `GET` | `/api/auth/me` | Return the authenticated user's basic profile |
| `GET` | `/api/trips` | Return summaries for the authenticated user's trips |
| `POST` | `/api/trips` | Add a trip and make it current |
| `GET` | `/api/trips/current` | Return the complete current trip |
| `PUT` | `/api/trips/current/:tripId` | Change the current trip |
| `GET` | `/api/activities?from=YYYY-MM-DD&to=YYYY-MM-DD` | Return activities in a date interval |
| `POST` | `/api/activities` | Create an activity |
| `PUT` | `/api/activities/:id` | Replace/update an activity |
| `DELETE` | `/api/activities/:id` | Delete an activity after confirmation |
| `GET` | `/api/health` | Confirm that the server is running |

For the first version, seed one user with username `admin` and password `admin`. Treat these as development-only credentials. Store a password hash rather than the plaintext password, compare it on the server, and keep authentication in an `HttpOnly`, `SameSite=Lax` session cookie. State-changing endpoints should also receive CSRF protection. Replace the default password before exposing the application beyond localhost.

Store each user's trips in a separate JSON file, initially `server/data/users/admin/trips.json`, through a dedicated repository/service layer. Normalize and allow-list the authenticated user ID before resolving a path, and reject path traversal. Never accept a client-provided file path. Writes should validate the entire result and use an atomic temporary-file-and-rename operation to reduce the chance of corruption. Serialize writes per user so concurrent requests cannot overwrite one another. The application should also offer explicit JSON import/export for experienced users; imports must be schema-validated before replacing server data and should create a backup of the previous valid file. This abstraction will allow a later move to SQLite or PostgreSQL without changing the UI.

## 6. User interface

### Login screen

- Make the login screen the initial view whenever there is no valid session.
- Provide username and password fields and a clear login action.
- For the initial local version, accept `admin` / `admin`.
- Show a generic invalid-credentials message without revealing which field was wrong.
- After successful login, load only that user's trips and open the main map screen.
- If the session expires, return to login without displaying another user's cached data.
- Include a logout action that clears both the server session and user-specific client state.

### Main screen

- Use a dark-mode visual design and keep the top navigation fixed while the page scrolls.
- Put three keyboard- and touch-accessible menus in the fixed navigation:
  - **Trips:** Add Trip, current-trip drop-down selector, and JSON import/export.
  - **Activities:** Add Activity and Browse Activities.
  - **User:** user information and Logout.
- Directly below the navigation, show a sticky information area containing the calendar/day selector and daily timeline.
- Place the interactive map immediately below the information area.
- Activity list or side panel ordered by date and suggested time.
- Empty state when no activities fall within the selected interval.

### Trip selection and creation

- Populate the **Trips** drop-down from the logged-in user's trip array and clearly mark the current trip.
- Changing the selection loads that trip's activities, resets its calendar interval, recomputes the timeline, and refits the map.
- **Add Trip** opens a form for title, start/end dates, timezone, and currency, then persists the trip on the server.
- After login, select the final trip in the JSON array. If the user has no trips, generate and persist a default trip with editable metadata.
- Scope every subsequent activity request to the server-held current trip; do not trust a trip ID sent only by the browser.

### Calendar and timeline information area

- Show each date with its real date, localized day of week, and a small trip-day number such as `Day 3`.
- Allow a single click/tap on a day to select it; also retain inclusive start/end interval selection for multi-day map views.
- Use these calendar states:
  - gray: outside the trip schedule;
  - white: inside the trip with no activities;
  - yellow: one or more activities with no overlap;
  - yellow with a red stripe and warning icon: activities overlap.
- Do not rely on color alone: add text/tooltips, patterns, icons, and accessible labels for each state.
- Show a timeline for the selected day with open and busy segments calculated from activity start times and durations.
- Render overlapping busy segments with a small warning icon and expose the conflicting activity names and times on hover/focus/click.
- Treat time intervals as half-open (`start <= time < end`) so an activity ending exactly when another starts is not a conflict.
- Use the trip timezone for date, weekday, ordering, and overlap calculations.

### Activities menu and creation routine

- Place an **Activities** button/menu in the top part of the page.
- On mouse hover, keyboard focus, or click/tap, reveal:
  - `[+] New Activity`
  - `[search icon] Browse Activities`
- Keep the menu open while its items have keyboard focus; support `Escape` to close it.
- **New Activity** opens a blank activity form in a modal or side panel.
- The user enters date/day, suggested time, title, description, picture URL, observations, coordinates/address, duration, price, and optional tags.
- Validate the form in the browser, then submit it to `POST /api/activities`.
- The server authenticates the request, validates the activity, assigns a unique ID, appends it to the logged-in user's JSON file, and saves the complete file atomically.
- After a successful save, close or reset the form, update the list and map, and show a confirmation. If saving fails, retain the entered values and show the error.
- **Browse Activities** opens the searchable/filterable activity list; selecting an entry focuses its marker and opens its details.
- Browse results are limited to the current trip and support Edit and Delete actions.
- If the new activity falls outside the selected date interval, explain why its marker is not currently visible and offer to expand the interval.

### Map behavior

- Render one marker per filtered activity with valid coordinates.
- After a valid trip JSON is loaded, fit the map bounds to all valid activity coordinates so the initial view focuses on the trip area. For one coordinate, center on it with a useful detail zoom; for multiple coordinates, use padded bounds.
- After the user changes the day interval, fit the map to the currently visible markers. Use a configured default center when the trip contains no valid coordinates.
- On marker hover, show a compact Leaflet tooltip containing time, title, duration, and expected price.
- On marker click/tap or keyboard activation, open a detail popup containing the description, picture URL preview, observations, location, edit action, and delete action.
- Close the detail popup when the user clicks/taps outside it, presses `Escape`, selects its close control, or selects another marker.
- Use marker clustering if a trip can contain many or overlapping activities.
- Distinguish days with marker colors or numbered marker badges, and include a legend.
- Keep map markers and the activity list synchronized: selecting either highlights the other.

Hover alone is not accessible on touch devices or keyboards, so the same information must also be available by click, tap, and keyboard focus.

### Editing behavior

- Open an add/edit form in a side panel or modal.
- Prepopulate all fields for edits.
- Validate fields in the browser and again on the server.
- Submit changes through the API and refresh local state only after success.
- Show clear saving, success, and failure states.
- Allow editing from both the marker popup and Browse Activities.
- Allow deletion from both locations and ask for confirmation before deleting.
- Accept pictures by URL only; do not implement upload in the first release.
- Let the user enter latitude/longitude directly or place/move the form's marker by clicking the map; keep both representations synchronized.
- Permit overlapping activities but show the calendar/timeline conflict warning immediately after saving.
- Preserve unsaved input if a request fails.

## 7. Implementation phases

### Phase 1 — Bootstrap the workspace

1. Create a root npm workspace containing `client`, `server`, and `shared` packages.
2. Configure React, Vite, TypeScript, ESLint, and formatting.
3. Configure Express with port `5050` and environment-based host/port settings.
4. Add development scripts that run the frontend and backend together.
5. Configure the Vite development proxy for `/api`.
6. Add a production script that builds React and serves its static files through Express.
7. Add `.env.example`, `.gitignore`, and a concise `README.md` with run commands.

**Exit condition:** one command starts development mode, and the application opens successfully in a browser.

### Phase 2 — Define and load trip data

1. Define shared TypeScript types and Zod schemas for `Trip`, `Activity`, `Location`, and `Price`.
2. Add a representative `server/data/users/admin/trips.json` covering multiple days.
3. Implement the ordered multi-trip user envelope and valid default-trip generator.
4. Implement the user-scoped JSON repository and validate data during startup, import, and writes.
5. Add trip list/create/select plus JSON import/export endpoints and consistent API error responses.
6. Show loading, validation-error, network-error, and empty states in React.

**Exit condition:** the browser loads validated activities from the server rather than bundled mock data.

### Phase 3 — Add authentication and user data isolation

1. Seed the development user `admin` with a securely hashed version of the initial password `admin`.
2. Implement login, logout, current-user, session storage, cookie security, and CSRF protection.
3. Add authentication middleware to every trip/activity endpoint.
4. Resolve the trip JSON exclusively from the authenticated user ID.
5. Implement the initial login screen, protected application route, logout, and session-expiry handling.
6. Clear user-specific client state whenever the user logs out or authentication fails.

**Exit condition:** the application starts at login, rejects invalid credentials, and `admin` can log in and access only `admin` trip data.

### Phase 4 — Build the interactive map

1. Install Leaflet and React Leaflet, including Leaflet CSS and marker assets.
2. Create the base map using an appropriately attributed tile provider.
3. Convert activities into markers.
4. Implement hover/focus tooltips and click/tap details.
5. On initial valid trip load, fit padded bounds around all plottable activities; after filtering, fit the visible subset.
6. Add click-to-place coordinates in the activity form and synchronize marker movement with latitude/longitude fields.
7. Add day styling, a legend, and optional clustering.

**Exit condition:** all sample activities appear at the correct coordinates and expose their planned details.

### Phase 5 — Add interval filtering

1. Derive the trip’s minimum and maximum dates.
2. Build an inclusive from/to date selector; optionally offer day-number shortcuts.
3. Validate that the start is not after the end.
4. Filter markers and the activity list from the same state.
5. Recalculate map bounds after every filter change.
6. Optionally encode the interval in URL query parameters so a view can be bookmarked.
7. Build the real-date/weekday/trip-day calendar states and one-click day selection.
8. Compute daily open/busy timeline segments and detect overlaps in the trip timezone.

**Exit condition:** changing the interval immediately and consistently updates the map and list.

### Phase 6 — Add activity creation, browsing, and editing

1. Add the top **Activities** menu with hover, focus, click, touch, and keyboard behavior.
2. Implement **New Activity** with a reusable blank/edit form.
3. Implement **Browse Activities** with search, filters, selection, and map synchronization.
4. Implement authenticated create and update API endpoints.
5. Add client and server validation messages.
6. Persist additions and edits atomically to the logged-in user's JSON file.
7. Update the map/list after a successful save.
8. Add confirmed deletion from marker details and Browse Activities.
9. Warn about unsaved changes when closing the form or navigating away.
10. Recompute calendar conflicts and timeline segments after every activity mutation.

**Exit condition:** a user can add or edit an activity, refresh the browser, and see the saved result.

### Phase 7 — Quality, accessibility, and resilience

1. Make map details accessible through hover, focus, click, and touch.
2. Add labels, focus management, keyboard navigation, and sufficient color contrast.
3. Add a fallback image and gracefully handle broken picture URLs.
4. Escape/sanitize displayed user content and do not inject raw HTML.
5. Add responsive layouts for desktop, tablet, and mobile.
6. Add structured server logging and user-friendly errors.
7. Check tile-provider usage rules and keep attribution visible.
8. Implement the fixed dark navigation and sticky information area without obscuring focused content or map controls.
9. Provide non-color indicators and labels for every calendar and conflict state.

**Exit condition:** the core workflow works with keyboard controls and on a small touch screen, with no unhandled UI errors.

### Phase 8 — Test and package

1. Unit-test schemas, date filtering, time ordering, and price formatting.
2. API-test login/logout, unauthorized access, user data isolation, valid/invalid writes, and unknown activity IDs.
3. Component-test login, all three accessible menus, trip selector, calendar states, timeline conflicts, form validation, browse view, and marker-detail content.
4. End-to-end test: log in, change trips, verify trip-focused bounds, place and create an activity, browse/edit/delete activities, select dates, refresh, and confirm persistence.
5. Test malformed/imported JSON, automatic default-trip creation, missing coordinates, broken image URLs, empty intervals, boundary-touching and overlapping activities, duplicate IDs, expired sessions, and rejected path traversal.
6. Verify the production build and start command on a clean checkout.

**Exit condition:** automated tests pass and `http://127.0.0.1:5050` serves the production application.

## 8. Testing acceptance criteria

- The server starts on `127.0.0.1:5050` with a documented command.
- With no valid session, the login screen is the only application view available.
- `admin` / `admin` logs in for local development; invalid credentials do not.
- Trip and activity APIs reject unauthenticated requests and load/save only the authenticated user's JSON file.
- The Trips menu can add and switch trips; after login, the final JSON trip opens, or a default trip is created when none exists.
- JSON export works, and invalid JSON import cannot replace the last valid server file.
- A valid JSON trip is loaded and all valid activities are plotted.
- On initial load, the map fits the geographic bounds of the valid trip coordinates.
- Invalid input produces a useful error without crashing the server.
- The day/date interval is inclusive and updates both markers and list entries.
- Hover or keyboard focus shows the planned title, time, duration, and price.
- Click/tap exposes all activity details and the edit action.
- Hover, focus, or click/tap on **Activities** provides **New Activity** and **Browse Activities** actions.
- Creating, editing, or deleting an activity changes the server-side user JSON and persists after a server and browser restart.
- Coordinates can be entered numerically or selected on the map, with both staying synchronized.
- Calendar days show real date, weekday, trip-day number, and the specified gray/white/yellow/conflict state.
- The selected day's timeline distinguishes open/busy time and flags genuine overlaps, but not back-to-back activities.
- Marker details close on outside click/tap, `Escape`, close control, or another marker selection.
- Activities with missing/invalid coordinates remain editable in the list but are not plotted; the UI explains why.
- The application works at common desktop and mobile viewport sizes.
- Map tiles display legally required attribution.

## 9. Confirmed design decisions

1. A user may own multiple trips and changes the current trip through a drop-down list.
2. Activity browsing and all map/calendar operations apply only to the current trip.
3. Coordinates support numeric entry and click-to-place map interaction.
4. Activities can be created, edited, and deleted.
5. Pictures use remote URLs only in the first release.
6. Experienced users can import/export JSON, subject to full server validation and backup safeguards.
7. Time overlaps are allowed and displayed with a warning icon.
8. Dates display the real date, weekday, and trip-day number.
9. The final trip in the JSON opens after login; an empty trip array causes default-trip creation.
10. `admin` / `admin` is restricted to local development and will be improved later.
11. The initial design is dark mode with fixed top menus, a calendar/timeline information area, and the map below.
12. The application is desktop-first but must include a responsive, touch-usable mobile layout.

The implementation will use Leaflet/React Leaflet unless a strict requirement for the Python Leafmap package is introduced later.

## 10. Likely follow-up extensions

- Address search/geocoding and reverse geocoding.
- Route lines, travel modes, and travel-time estimates between activities.
- User administration and multiple concurrent user accounts.
- SQLite/PostgreSQL storage and edit-conflict handling.
- Offline/PWA support.
- Budget totals by day and for the full trip.
- Attachment upload rather than remote image URLs.

## 11. Suggested first release scope

Keep version 1 focused on multiple trips for one authenticated local user:

- React/TypeScript client and Node/Express server;
- initial login screen and server-backed session for the development user `admin`;
- per-user server-side trip JSON selected from the authenticated identity;
- multiple trips with add/current-trip controls, default-trip creation, and validated JSON import/export;
- fixed dark navigation with Trips, Activities, and User menus;
- real-date/weekday/trip-day calendar plus open/busy conflict timeline;
- Leaflet map with markers, accessible tooltips, and detail popups;
- automatic initial map focus on valid trip coordinates;
- numeric and click-to-place coordinates;
- accessible **Activities** menu with **New Activity** and **Browse Activities**;
- persistent create/update/delete operations;
- inclusive date interval filter;
- synchronized activity list and map;
- responsive layout and core automated tests;
- production build served at `127.0.0.1:5050`.

Defer user administration, simultaneous multi-user editing, routing, uploads, and database migration until the core planning workflow is proven.
