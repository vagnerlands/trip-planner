import { useRef, useState } from "react";
import type { Activity } from "@trip-planner/shared";
import { formatDuration } from "../trip-utils";
import { useDialogFocus } from "./useDialogFocus";

interface Props {
  activities: Activity[];
  onClose: () => void;
  onSelect: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
}

export function ActivityBrowser({ activities, onClose, onSelect, onEdit, onDelete }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const [search, setSearch] = useState("");
  useDialogFocus(dialogRef, onClose);
  const query = search.toLowerCase();
  const filtered = activities
    .filter((activity) =>
      [activity.title, activity.description, activity.location.address, ...activity.tags]
        .join(" ")
        .toLowerCase()
        .includes(query)
    )
    .sort((a, b) => `${a.date}${a.suggestedTime}`.localeCompare(`${b.date}${b.suggestedTime}`));
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className="activity-browser"
        role="dialog"
        aria-modal="true"
        aria-labelledby="browse-title"
      >
        <header>
          <div>
            <p className="eyebrow">CURRENT TRIP</p>
            <h2 id="browse-title">Browse activities</h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <label className="search-field">
          Search
          <input
            autoFocus
            type="search"
            placeholder="Search title, description, location, or tag"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="activity-results">
          {filtered.map((activity) => (
            <article key={activity.id}>
              <button className="activity-main" onClick={() => onSelect(activity)}>
                <span className="activity-date">
                  <strong>{activity.date.slice(5)}</strong>
                  <small>{activity.suggestedTime}</small>
                </span>
                <span>
                  <strong>{activity.title}</strong>
                  <small>
                    {formatDuration(activity.durationMinutes)} ·{" "}
                    {activity.location.address || `${activity.location.latitude}, ${activity.location.longitude}`}
                  </small>
                </span>
              </button>
              <div className="result-actions">
                <button onClick={() => onEdit(activity)}>Edit</button>
                <button className="danger" onClick={() => onDelete(activity)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
          {!filtered.length && <p className="empty-result">No activities match this search.</p>}
        </div>
      </section>
    </div>
  );
}
