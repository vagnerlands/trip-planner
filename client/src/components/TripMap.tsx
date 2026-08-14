import { useEffect, useMemo, useRef, useState } from "react";
import L, { type Marker as LeafletMarker } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Activity } from "@trip-planner/shared";
import { formatDuration } from "../trip-utils";
import "leaflet/dist/leaflet.css";

function FitMap({ activities }: { activities: Activity[] }) {
  const map = useMap();
  const signature = activities.map(({ id, location }) => `${id}:${location.latitude}:${location.longitude}`).join("|");
  useEffect(() => {
    const coordinates = activities.map(({ location }) => [location.latitude, location.longitude] as [number, number]);
    if (coordinates.length === 1) map.setView(coordinates[0]!, 13, { animate: false });
    else if (coordinates.length > 1) map.fitBounds(coordinates, { padding: [55, 55], maxZoom: 14, animate: false });
    else map.setView([20, 0], 2, { animate: false });
  }, [map, signature]);
  return null;
}

function markerIcon(index: number, active: boolean) {
  return L.divIcon({
    className: "trip-marker-wrap",
    html: `<span class="trip-marker ${active ? "active" : ""}"><i>${index + 1}</i></span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38]
  });
}

function ActivityImage({ src, title }: { src: string; title: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed)
    return (
      <div className="image-fallback" role="img" aria-label={`Picture unavailable for ${title}`}>
        Picture unavailable
      </div>
    );
  return (
    <img
      src={src}
      alt={`Preview for ${title}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

interface Props {
  activities: Activity[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
}

export function TripMap({ activities, selectedId, onSelect, onEdit, onDelete }: Props) {
  const markerRefs = useRef(new Map<string, LeafletMarker>());
  const icons = useMemo(
    () => activities.map((_, index) => markerIcon(index, activities[index]?.id === selectedId)),
    [activities, selectedId]
  );

  useEffect(() => {
    if (selectedId) markerRefs.current.get(selectedId)?.openPopup();
  }, [selectedId, activities]);

  return (
    <section className="map-panel" aria-label="Activity map">
      <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom className="trip-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMap activities={activities} />
        {activities.map((activity, index) => (
          <Marker
            key={activity.id}
            position={[activity.location.latitude, activity.location.longitude]}
            icon={icons[index]}
            title={`${activity.suggestedTime} · ${activity.title}`}
            alt={`Map marker ${index + 1}: ${activity.title}`}
            riseOnHover
            ref={(marker) => {
              if (marker) markerRefs.current.set(activity.id, marker);
              else markerRefs.current.delete(activity.id);
            }}
            eventHandlers={{
              click: () => onSelect(activity.id),
              popupclose: () => selectedId === activity.id && onSelect(null)
            }}
          >
            <Tooltip direction="top" offset={[0, -32]} opacity={1}>
              <strong>
                {activity.suggestedTime} · {activity.title}
              </strong>
              <br />
              {formatDuration(activity.durationMinutes)}
              {activity.price ? ` · ${activity.price.currency} ${activity.price.amount.toFixed(2)}` : ""}
            </Tooltip>
            <Popup
              closeButton
              closeOnClick
              autoPan
              eventHandlers={{
                add: (event) => {
                  const element = (event.target as L.Popup).getElement();
                  if (element) {
                    L.DomEvent.disableScrollPropagation(element);
                    L.DomEvent.disableClickPropagation(element);
                  }
                }
              }}
            >
              <article className="activity-popup">
                {activity.pictureUrl && <ActivityImage src={activity.pictureUrl} title={activity.title} />}
                <p className="popup-time">
                  {activity.date} · {activity.suggestedTime}
                </p>
                <h3>{activity.title}</h3>
                <p>{activity.description || "No description."}</p>
                <dl>
                  <div>
                    <dt>Duration</dt>
                    <dd>{formatDuration(activity.durationMinutes)}</dd>
                  </div>
                  {activity.price && (
                    <div>
                      <dt>Price</dt>
                      <dd>
                        {activity.price.currency} {activity.price.amount.toFixed(2)}
                        {activity.price.isEstimate ? " est." : ""}
                      </dd>
                    </div>
                  )}
                  {activity.location.address && (
                    <div>
                      <dt>Location</dt>
                      <dd>{activity.location.address}</dd>
                    </div>
                  )}
                </dl>
                {activity.observations && <p className="observations">{activity.observations}</p>}
                <div className="popup-actions">
                  <button onClick={() => onEdit(activity)}>Edit</button>
                  <button className="danger" onClick={() => onDelete(activity)}>
                    Delete
                  </button>
                </div>
              </article>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {!activities.length && (
        <div className="map-empty">
          <strong>No activities in this interval</strong>
          <span>Choose another day or add an activity.</span>
        </div>
      )}
    </section>
  );
}
