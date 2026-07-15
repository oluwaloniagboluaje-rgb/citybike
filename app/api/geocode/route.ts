import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const address = searchParams.get("address");
  const city = searchParams.get("city");
  const country = searchParams.get("country") || "Nigeria";

  if (!address || !city) {
    return NextResponse.json(
      { error: "Address and city are required." },
      { status: 400 }
    );
  }

  // Try several search formats
  const queries = [
    `${address}, ${city}, ${country}`,
    `${address}, ${country}`,
    `${city}, ${country}`,
  ];

  let results: any[] = [];

  for (const query of queries) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      query
    )}`;

    let res;
    try {
      res = await fetch(url, {
        headers: {
          "User-Agent":
            "CityBike Logistics (Citybikelogistics1@gmail.com)",
          Accept: "application/json",
        },
        cache: "no-store",
      });
    } catch (error) {
      console.error("Geocode fetch failed", { query, error });
      continue;
    }

    if (!res.ok) {
      console.warn("Geocode service returned non-ok status", {
        query,
        status: res.status,
      });
      continue;
    }

    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      results = data;
      break;
    }
  }

  if (results.length === 0) {
    return NextResponse.json(
      {
        error:
          "Address could not be located. Please enter a nearby landmark or a more common address.",
      },
      { status: 404 }
    );
  }

  const { lat, lon } = results[0];

  if (!lat || !lon) {
    return NextResponse.json(
      {
        error:
          "Address lookup returned invalid coordinates. Please verify the address and try again.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    lat: Number(lat),
    lng: Number(lon),
  });
}