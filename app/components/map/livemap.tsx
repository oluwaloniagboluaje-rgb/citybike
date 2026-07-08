"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import { useMemo } from "react";

// Leaflet's default marker icons reference local asset paths that don't
// resolve correctly under webpack/Next.js bundling, so we point them at CDN
// URLs instead. This only affects display, not functionality.
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
  heightClassName?: string;
}

export default function LiveMap({
  pickup,
  dropoff,
  driverPosition,
  heightClassName = "h-96",
}: LiveMapProps) {
  const center = useMemo<[number, number]>(() => {
    if (driverPosition) return [driverPosition.lat, driverPosition.lng];
    return [
      (pickup.lat + dropoff.lat) / 2,
      (pickup.lng + dropoff.lng) / 2,
    ];
  }, [pickup, dropoff, driverPosition]);

  const routePoints: [number, number][] = [
    [pickup.lat, pickup.lng],
    ...(driverPosition ? [[driverPosition.lat, driverPosition.lng] as [number, number]] : []),
    [dropoff.lat, dropoff.lng],
  ];

  return (
    <div className={`${heightClassName} w-full overflow-hidden rounded-lg border border-neutral-200`}>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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