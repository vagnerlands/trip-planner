import type { Activity, Trip } from "@trip-planner/shared";
import { activitiesConflict, addDays, dateRange, daysBetween, minutes, shortDate, weekday } from "../trip-utils";

interface Props {
  trip: Trip;
  activities: Activity[];
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

export function CalendarTimeline({ trip, activities, from, to, onChange }: Props) {
  const startWeekday = (new Date(`${trip.startDate}T00:00:00Z`).getUTCDay() + 6) % 7;
  const endWeekday = (new Date(`${trip.endDate}T00:00:00Z`).getUTCDay() + 6) % 7;
  const calendarStart = addDays(trip.startDate, -startWeekday);
  const calendarEnd = addDays(trip.endDate, 6 - endWeekday);
  const selectedActivities = activities.filter(({ date }) => date === from);
  const conflict = activitiesConflict(selectedActivities);

  return (
    <section className="information-bar" aria-label="Trip calendar and timeline">
      <div className="calendar-header">
        <div>
          <p className="eyebrow">TRIP CALENDAR</p>
          <strong>Select a day or interval</strong>
        </div>
        <div className="interval-fields">
          <label>
            From
            <input
              type="date"
              min={trip.startDate}
              max={to}
              value={from}
              onChange={(event) => onChange(event.target.value, to)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              min={from}
              max={trip.endDate}
              value={to}
              onChange={(event) => onChange(from, event.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="calendar-strip">
        {dateRange(calendarStart, calendarEnd).map((date) => {
          const inTrip = date >= trip.startDate && date <= trip.endDate;
          const dayActivities = activities.filter((activity) => activity.date === date);
          const hasConflict = activitiesConflict(dayActivities);
          const selected = date >= from && date <= to;
          const status = !inTrip
            ? "outside trip"
            : hasConflict
              ? "activities with conflict"
              : dayActivities.length
                ? "activities"
                : "open";
          return (
            <button
              key={date}
              disabled={!inTrip}
              className={`calendar-day ${!inTrip ? "outside" : dayActivities.length ? "busy" : "open"} ${hasConflict ? "conflict" : ""} ${selected ? "selected" : ""}`}
              onClick={() => onChange(date, date)}
              title={`${weekday(date)}, ${date}: ${status}`}
              aria-label={`${weekday(date)}, ${date}, ${status}${inTrip ? `, trip day ${daysBetween(trip.startDate, date) + 1}` : ""}`}
            >
              <span>{weekday(date)}</span>
              <strong>{shortDate(date)}</strong>
              {inTrip && <small>Day {daysBetween(trip.startDate, date) + 1}</small>}
              {hasConflict && <b aria-hidden="true">!</b>}
            </button>
          );
        })}
      </div>
      <div className="timeline-header">
        <span>
          <strong>
            {weekday(from)}, {shortDate(from)}
          </strong>{" "}
          timeline
        </span>
        <span className={conflict ? "conflict-label" : "muted"}>
          {conflict ? "⚠ Schedule conflict" : `${selectedActivities.length} planned`}
        </span>
      </div>
      <div className="timeline" aria-label={`Timeline for ${from}`}>
        <div className="timeline-hours" aria-hidden="true">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
        <div className="timeline-track">
          {selectedActivities.map((activity) => {
            const left = Math.min(100, (minutes(activity.suggestedTime) / 1440) * 100);
            const width = Math.max(
              0.8,
              (Math.min(activity.durationMinutes, 1440 - minutes(activity.suggestedTime)) / 1440) * 100
            );
            const isConflict = selectedActivities.some(
              (other) =>
                other.id !== activity.id &&
                minutes(activity.suggestedTime) < minutes(other.suggestedTime) + other.durationMinutes &&
                minutes(other.suggestedTime) < minutes(activity.suggestedTime) + activity.durationMinutes
            );
            const conflictNames = selectedActivities
              .filter(
                (other) =>
                  other.id !== activity.id &&
                  minutes(activity.suggestedTime) < minutes(other.suggestedTime) + other.durationMinutes &&
                  minutes(other.suggestedTime) < minutes(activity.suggestedTime) + activity.durationMinutes
              )
              .map(({ title }) => title);
            const description = `${activity.suggestedTime} · ${activity.title}${isConflict ? ` · overlaps ${conflictNames.join(", ")}` : ""}`;
            return (
              <button
                type="button"
                key={activity.id}
                className={`busy-segment ${isConflict ? "conflict" : ""}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={description}
                aria-label={description}
              >
                <i>{isConflict ? "!" : ""}</i>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
