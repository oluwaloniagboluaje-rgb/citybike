
const CITY_CODES: Record<string, string> = {
  // Nigeria - primary operating cities
  ibadan: "IBD",
  lagos: "LAG",
  abuja: "ABV",
  "port harcourt": "PHC",
  kano: "KAN",
  kaduna: "KAD",
  benin: "BEN",
  "benin city": "BEN",
  enugu: "ENU",
  ilorin: "ILR",
  ogbomoso: "OGB",
  abeokuta: "ABK",
  akure: "AKR",
  jos: "JOS",
  warri: "WAR",
  onitsha: "ONI",
  calabar: "CAL",
  uyo: "UYO",

  // International destinations CityBike ships to
  london: "LON",
  manchester: "MAN",
  birmingham: "BHX",
  "new york": "NYC",
  "los angeles": "LAX",
  chicago: "CHI",
  houston: "HOU",
  toronto: "YTO",
  vancouver: "YVR",
  montreal: "YUL",
  dubai: "DXB",
  johannesburg: "JNB",
  accra: "ACC",
  nairobi: "NBO",
};

function normalizeCity(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, " ");
}

export function cityCode(city: string): string {
  const key = normalizeCity(city);
  if (CITY_CODES[key]) return CITY_CODES[key];

  const letters = city.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (letters.length >= 3) return letters.slice(0, 3);
  return (letters || "GEN").padEnd(3, "X");
}

function randomSegment(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateTrackingNumber(originCity: string): string {
  const randomDigits = `${Date.now().toString().slice(-8)}${Math.floor(
    1000 + Math.random() * 9000
  )}`;
  return `CITYBIKE${randomDigits}`;
}

export function isLikelyTrackingNumber(value: string): boolean {
  return /^CITYBIKE\d{12,}$/i.test(value.trim());
}