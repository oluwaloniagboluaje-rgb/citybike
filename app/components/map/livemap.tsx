"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useState } from "react";

const pickupIcon = new L.Icon({
  iconUrl:
    "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-blue.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const dropoffIcon = new L.Icon({
  iconUrl:
    "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const driverIcon = new L.Icon({
  iconUrl:
    "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-green.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface LiveMapProps {
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  driverPosition?: { lat: number; lng: number } | null;
  locationHistory?: { lat: number; lng: number }[];
  heightClassName?: string;
  // When true, skips road-routing and draws a straight line instead —
  // appropriate for international shipments where no road route exists
  // between the pickup and dropoff countries.
  isInternational?: boolean;
}

// Automatically zooms/pans the map so every relevant point (pickup,
// dropoff, driver, route history) is visible. This is what makes
// international routes (thousands of km apart) render readably instead
// of showing a blank zoomed-in tile.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 12);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);

  return null;
}

// Fetches the actual driving route between two points from OSRM's public
// routing server, so the line drawn on the map follows real roads instead
// of cutting a straight line through unrelated states/regions. Falls back
// to a straight line if the request fails for any reason (network issue,
// no road route found, rate limiting, etc).
function useRoadRoute(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
  enabled: boolean
) {
  const [routePoints, setRoutePoints] = useState<[number, number][] | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRoutePoints(null);
      return;
    }

    let cancelled = false;

    async function fetchRoute() {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Routing request failed");
        const data = await res.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates as
          | [number, number][]
          | undefined;
        if (!coords || coords.length === 0) throw new Error("No route found");
        if (!cancelled) {
          // OSRM returns [lng, lat]; Leaflet expects [lat, lng].
          setRoutePoints(coords.map(([lng, lat]) => [lat, lng] as [number, number]));
        }
      } catch {
        if (!cancelled) setRoutePoints(null);
      }
    }

    fetchRoute();
    return () => {
      cancelled = true;
    };
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng, enabled]);

  return routePoints;
}

export default function LiveMap({
  pickup,
  dropoff,
  driverPosition,
  locationHistory,
  heightClassName = "h-96",
  isInternational = false,
}: LiveMapProps) {
  const roadRoute = useRoadRoute(pickup, dropoff, !isInternational);

  const historyPoints = locationHistory?.map(
    (point) => [point.lat, point.lng] as [number, number]
  );

  // The main planned route: real road geometry for domestic deliveries
  // (once loaded), straight line for international, and a straight-line
  // fallback for domestic if the routing request hasn't resolved yet or
  // failed.
  const plannedRoute: [number, number][] =
    !isInternational && roadRoute
      ? roadRoute
      : [
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ];

  // Points used purely to calculate the initial zoom/fit.
  const boundsPoints: [number, number][] = [
    [pickup.lat, pickup.lng],
    [dropoff.lat, dropoff.lng],
    ...(driverPosition ? [[driverPosition.lat, driverPosition.lng] as [number, number]] : []),
  ];

  return (
    <div className={`${heightClassName} w-full overflow-hidden rounded-lg border border-neutral-200`}>
      <MapContainer
        center={[pickup.lat, pickup.lng]}
        zoom={13}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={boundsPoints} />
        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
          <Popup>Pickup: {pickup.address}</Popup>
        </Marker>
        <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
          <Popup>Drop-off: {dropoff.address}</Popup>
        </Marker>
        {driverPosition && (
          <Marker position={[driverPosition.lat, driverPosition.lng]} icon={driverIcon}>
            <Popup>Driver&apos;s current location</Popup>
          </Marker>
        )}

        {/* Planned route: real roads for domestic, straight line for international */}
        <Polyline
          positions={plannedRoute}
          pathOptions={{ color: "#4f46e5", dashArray: isInternational ? "6 6" : undefined }}
        />

        {/* Actual path the driver has traveled, if we have real GPS history */}
        {historyPoints && historyPoints.length > 1 && (
          <Polyline positions={historyPoints} pathOptions={{ color: "#16a34a" }} />
        )}
      </MapContainer>
    </div>
  );
}