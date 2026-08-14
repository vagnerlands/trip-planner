# Manual acceptance checklist

Run `npm run verify`, then start the production build:

```powershell
$env:NODE_ENV="production"
npm start
```

Open `http://127.0.0.1:5050`, or `http://<computer-LAN-IP>:5050` from another device on the same trusted network, and use `admin` / `admin`.

## Login and trips

- Confirm an unauthenticated browser starts at Login.
- Confirm invalid credentials show a generic error and `admin` / `admin` succeeds.
- Open Trips by hover, click, and keyboard; press Escape to close it.
- Change trips and confirm the calendar, map, and activities all change together.
- Add a trip, refresh, and confirm it remains available.
- Export JSON. Try importing malformed/invalid JSON and confirm existing data is unchanged.

## Calendar and timeline

- Confirm every in-trip date shows date, weekday, and trip-day number.
- Confirm outside days are gray/disabled, empty days white, planned days yellow, and conflicts use a red stripe plus warning icon/text.
- Click a day and confirm markers update. Select a multi-day From/To interval and confirm all matching markers appear.
- Focus timeline segments with the keyboard and confirm activity/conflict details are available.
- Confirm activities touching at an exact boundary are not marked as conflicts.

## Map and activities

- Confirm the map initially fits the current trip's activity points.
- Hover/focus a marker for its summary; click/tap it for full details; click outside or press Escape to close.
- Create an activity using numeric coordinates, then another by clicking/dragging the form map.
- Browse and search activities. Select a result and confirm its day and marker open.
- Edit an activity and refresh to confirm server persistence.
- Delete an activity, cancel once, then confirm once and verify it remains deleted after refresh.
- Use a broken picture URL and confirm the labeled fallback appears.

## Responsive and accessible use

- Test widths around 1440, 1024, 768, 390, and 320 pixels.
- Confirm fixed menus and sticky information do not hide focused content or map controls.
- Complete login, trip selection, calendar selection, browsing, editing, and logout using only the keyboard.
- Confirm visible focus, readable contrast, zoom to 200%, and reduced-motion preference behavior.
- Test touch interaction for menus, days, markers, popups, and dialogs on a mobile device or emulator.

## Failure states

- Stop the server while the page is open and confirm saving retains form input and shows an error.
- Restart the server and confirm the session returns safely to Login when necessary.
- Confirm an empty interval and a trip without coordinates show useful empty/default map states.
