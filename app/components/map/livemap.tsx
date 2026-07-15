"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

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

export default function LiveMap({
  pickup,
  dropoff,
  driverPosition,
  locationHistory,
  heightClassName = "h-96",
}: LiveMapProps) {
  const historyPoints = locationHistory?.map(
    (point) => [point.lat, point.lng] as [number, number]
  );

  const routePoints: [number, number][] = [
    [pickup.lat, pickup.lng],
    ...(historyPoints ?? []),
    ...(driverPosition && !historyPoints?.length
      ? [[driverPosition.lat, driverPosition.lng] as [number, number]]
      : []),
    [dropoff.lat, dropoff.lng],
  ];

  // Points used purely to calculate the initial zoom/fit — same as
  // routePoints but without duplicating the driver marker twice.
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
        <Polyline positions={routePoints} pathOptions={{ color: "#4f46e5", dashArray: "6 6" }} />
      </MapContainer>
    </div>
  );
}