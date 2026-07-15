export async function geocodeAddress(
  address: string,
  city: string,
  country: string
): Promise<{ lat: number; lng: number }> {
  const params = new URLSearchParams({ address, city, country });
  const res = await fetch(`/api/geocode?${params.toString()}`);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not locate that address");
  }

  const data = await res.json();
  return { lat: data.lat, lng: data.lng };
}