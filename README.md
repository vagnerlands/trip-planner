# Trip Planner

## Presentation

Trip Planner is a browser-based application for organizing family trips and viewing daily plans on an interactive map.

It combines a calendar, schedule timeline, activity manager, and Leaflet map in a dark, responsive interface. The application runs on a Node.js web server and can be opened from a computer, phone, or tablet on the same trusted network.

The project uses:

- React, TypeScript, and Vite for the user interface
- Node.js and Express for the server
- Leaflet and React Leaflet for maps
- JSON files for validated per-user trip storage
- Zod for data validation

## What It Does

Trip Planner loads a user's trips from the server and lets the user select the trip currently being planned. Each trip contains dated activities with times, descriptions, locations, durations, prices, pictures, observations, and tags.

The application plots the selected activities on a map and provides calendar and timeline views. Users can select one day or a range of days, inspect attraction details, identify schedule conflicts, and maintain the itinerary directly from the browser.

All additions and changes are saved to the authenticated user's JSON file on the server, so they remain available after refreshing or restarting the application.

## Features

### Trips

- Multiple trips per user
- Current-trip drop-down selector
- Add new trips
- Validated JSON import and export
- Automatic default trip when no trips exist
- Trip timezone and currency settings

### Activities

- Create, browse, search, edit, and delete activities
- Date and suggested start time
- Title, description, observations, and tags
- Duration and expected price
- Remote picture URLs with a fallback for broken images
- Latitude and longitude entry
- Click or drag on a map to select coordinates
- Server-side validation and persistent JSON storage

### Interactive map

- One marker for each visible activity
- Automatic map focus around the trip area
- Marker summaries on hover or keyboard focus
- Detailed popups on click or tap
- Independently scrollable popups on mobile devices
- Edit and delete actions from activity details
- OpenStreetMap tiles with attribution

### Calendar and timeline

- Real date, weekday, and trip-day number
- Single-day selection with one click or tap
- Inclusive From/To interval filtering
- Gray days outside the trip schedule
- White days without activities
- Yellow days containing activities
- Yellow and red conflict indicators for overlapping activities
- Daily open/busy timeline
- Keyboard-accessible conflict descriptions
- Back-to-back activities are not incorrectly treated as conflicts

### Users and security

- Login screen and server-backed sessions
- Per-user trip JSON files
- Passwords stored as secure hashes
- CSRF protection for state-changing operations
- Content Security Policy and other browser security headers
- Atomic writes and backup creation before JSON imports
- User data isolation enforced by the server

### Desktop and mobile

- Desktop-first responsive layout
- iPhone and Safari safe-area support
- Touch-friendly controls and 44-pixel minimum menu targets
- Mobile-sized calendar controls
- Responsive maps, forms, dialogs, and activity lists
- Keyboard navigation and visible focus indicators
- Focus-trapped dialogs
- Reduced-motion and high-contrast support

## Requirements

- Node.js 22 or newer
- npm 10 or newer

## Install

From the project directory:

```powershell
npm install
```

## Run in Development

```powershell
npm run dev
```

Open:

- This computer: `http://127.0.0.1:5173`
- Another device: `http://<computer-LAN-IP>:5173`

During development, React runs on port `5173` and the API runs on port `5050`. Opening port `5050` redirects the browser to Vite.

## Run in Release Mode

```powershell
npm run build
$env:NODE_ENV="production"
npm start
```

Open:

- This computer: `http://127.0.0.1:5050`
- Another device: `http://<computer-LAN-IP>:5050`

Find the computer's LAN address with:

```powershell
ipconfig
```

If Windows asks, allow Node.js on Private networks only.

## Initial Login

```text
Username: admin
Password: admin
```

These credentials are intended only for development and trusted private networks. Do not expose port `5050` to the internet. Copy `.env.example` to `.env` and replace `SESSION_SECRET` before using the application outside a purely local development environment.

## Data Storage

User credentials are stored in:

```text
server/data/users.json
```

Each user's trips are stored in:

```text
server/data/users/<username>/trips.json
```

The active admin trip data is therefore located at:

```text
server/data/users/admin/trips.json
```

## Useful Commands

- `npm run dev` - run the application in development mode
- `npm run build` - create the production build
- `npm start` - start the production server
- `npm test` - run automated tests
- `npm run typecheck` - run strict TypeScript checks
- `npm run lint` - run ESLint
- `npm run verify` - run formatting, linting, type checks, tests, and the production build

See [TESTING.md](TESTING.md) for the complete manual acceptance checklist.
