import { useRef, useState, type FormEvent } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import type { Activity, ActivityInput, Trip } from "@trip-planner/shared";
import { useDialogFocus } from "./useDialogFocus";

interface FormState {
  date: string;
  suggestedTime: string;
  title: string;
  description: string;
  pictureUrl: string;
  observations: string;
  latitude: string;
  longitude: string;
  address: string;
  durationMinutes: string;
  priceAmount: string;
  priceCurrency: string;
  priceType: "ticket" | "expected" | "other";
  priceEstimate: boolean;
  tags: string;
}

const pickerIcon = L.divIcon({
  className: "picker-icon-wrap",
  html: '<span class="picker-icon">⌖</span>',
  iconSize: [36, 42],
  iconAnchor: [18, 38]
});

function ClickPicker({ onPick }: { onPick: (latitude: number, longitude: number) => void }) {
  useMapEvents({ click: ({ latlng }) => onPick(latlng.lat, latlng.lng) });
  return null;
}

function initialState(trip: Trip, selectedDate: string, activity?: Activity): FormState {
  return {
    date: activity?.date ?? selectedDate,
    suggestedTime: activity?.suggestedTime ?? "09:00",
    title: activity?.title ?? "",
    description: activity?.description ?? "",
    pictureUrl: activity?.pictureUrl ?? "",
    observations: activity?.observations ?? "",
    latitude: activity ? String(activity.location.latitude) : "",
    longitude: activity ? String(activity.location.longitude) : "",
    address: activity?.location.address ?? "",
    durationMinutes: String(activity?.durationMinutes ?? 60),
    priceAmount: activity?.price ? String(activity.price.amount) : "",
    priceCurrency: activity?.price?.currency ?? trip.currency,
    priceType: activity?.price?.type ?? "expected",
    priceEstimate: activity?.price?.isEstimate ?? true,
    tags: activity?.tags.join(", ") ?? ""
  };
}

interface Props {
  trip: Trip;
  selectedDate: string;
  activity: Activity | undefined;
  onClose: () => void;
  onSave: (input: ActivityInput) => Promise<void>;
}

export function ActivityEditor({ trip, selectedDate, activity, onClose, onSave }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState(() => initialState(trip, selectedDate, activity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);
  const hasCoordinates =
    form.latitude !== "" && form.longitude !== "" && Number.isFinite(latitude) && Number.isFinite(longitude);

  useDialogFocus(dialogRef, onClose);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function pick(lat: number, lng: number) {
    setForm((current) => ({ ...current, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!hasCoordinates) return setError("Choose a location on the map or enter valid coordinates.");
    setSaving(true);
    try {
      const input: ActivityInput = {
        date: form.date,
        suggestedTime: form.suggestedTime,
        title: form.title,
        description: form.description,
        pictureUrl: form.pictureUrl,
        observations: form.observations,
        location: { latitude, longitude, address: form.address },
        durationMinutes: Number(form.durationMinutes),
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      };
      if (form.priceAmount !== "")
        input.price = {
          amount: Number(form.priceAmount),
          currency: form.priceCurrency,
          type: form.priceType,
          isEstimate: form.priceEstimate
        };
      await onSave(input);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the activity");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className="activity-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-editor-title"
      >
        <header>
          <div>
            <p className="eyebrow">{activity ? "EDIT ACTIVITY" : "NEW ACTIVITY"}</p>
            <h2 id="activity-editor-title">{activity?.title ?? "Plan something memorable"}</h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="editor-grid">
            <div className="editor-fields">
              <label>
                Title
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              </label>
              <div className="field-row">
                <label>
                  Date
                  <input
                    required
                    type="date"
                    min={trip.startDate}
                    max={trip.endDate}
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                  />
                </label>
                <label>
                  Suggested time
                  <input
                    required
                    type="time"
                    value={form.suggestedTime}
                    onChange={(e) => set("suggestedTime", e.target.value)}
                  />
                </label>
                <label>
                  Duration (minutes)
                  <input
                    required
                    min="0"
                    type="number"
                    value={form.durationMinutes}
                    onChange={(e) => set("durationMinutes", e.target.value)}
                  />
                </label>
              </div>
              <label>
                Description
                <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </label>
              <label>
                Picture URL
                <input
                  type="url"
                  placeholder="https://…"
                  value={form.pictureUrl}
                  onChange={(e) => set("pictureUrl", e.target.value)}
                />
              </label>
              <label>
                Observations
                <textarea rows={2} value={form.observations} onChange={(e) => set("observations", e.target.value)} />
              </label>
              <label>
                Tags
                <input
                  placeholder="museum, food, outdoors"
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                />
              </label>
            </div>
            <div className="location-fields">
              <div className="mini-map">
                <MapContainer
                  center={hasCoordinates ? [latitude, longitude] : [20, 0]}
                  zoom={hasCoordinates ? 12 : 2}
                  scrollWheelZoom
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <ClickPicker onPick={pick} />
                  {hasCoordinates && (
                    <Marker
                      draggable
                      position={[latitude, longitude]}
                      icon={pickerIcon}
                      eventHandlers={{
                        dragend: (event) => {
                          const point = event.target.getLatLng();
                          pick(point.lat, point.lng);
                        }
                      }}
                    />
                  )}
                </MapContainer>
                <span>Click the map to place the activity</span>
              </div>
              <div className="field-row">
                <label>
                  Latitude
                  <input
                    required
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => set("latitude", e.target.value)}
                  />
                </label>
                <label>
                  Longitude
                  <input
                    required
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => set("longitude", e.target.value)}
                  />
                </label>
              </div>
              <label>
                Address
                <input value={form.address} onChange={(e) => set("address", e.target.value)} />
              </label>
              <div className="price-box">
                <p>Expected price</p>
                <div className="field-row">
                  <label>
                    Amount
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={form.priceAmount}
                      onChange={(e) => set("priceAmount", e.target.value)}
                    />
                  </label>
                  <label>
                    Currency
                    <input
                      maxLength={3}
                      value={form.priceCurrency}
                      onChange={(e) => set("priceCurrency", e.target.value.toUpperCase())}
                    />
                  </label>
                  <label>
                    Type
                    <select
                      value={form.priceType}
                      onChange={(e) => set("priceType", e.target.value as FormState["priceType"])}
                    >
                      <option value="expected">Expected</option>
                      <option value="ticket">Ticket</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={form.priceEstimate}
                    onChange={(e) => set("priceEstimate", e.target.checked)}
                  />{" "}
                  This is an estimate
                </label>
              </div>
            </div>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={saving}>
              {saving ? "Saving…" : activity ? "Save changes" : "Add activity"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
