import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/geo/reverse-geocode?lat=29.220849&lng=79.514651
 * Returns formatted street/area address from:
 * 1. Google Maps Geocoding API (if GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured in env)
 * 2. OpenStreetMap Nominatim (open-source reverse geocoder)
 * 3. BigDataCloud reverse geocoder (high-availability open fallback)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    if (!lat || !lng) {
      return NextResponse.json(
        { success: false, message: "Missing required lat and lng parameters." },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { success: false, message: "Invalid numeric coordinates." },
        { status: 400 }
      );
    }

    // 1. Try Google Maps Geocoding API if key is present
    const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (googleKey) {
      try {
        const googleRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleKey}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (googleRes.ok) {
          const googleData = await googleRes.json();
          if (googleData.status === "OK" && googleData.results?.[0]?.formatted_address) {
            return NextResponse.json({
              success: true,
              address: googleData.results[0].formatted_address,
              provider: "google",
              details: googleData.results[0],
            });
          }
        }
      } catch (gErr) {
        console.warn("[reverse-geocode] Google API error or timeout, falling back:", gErr);
      }
    }

    // 2. Try OpenStreetMap Nominatim (open-source)
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      const osmRes = await fetch(nominatimUrl, {
        headers: {
          "User-Agent": "CampusFleet/1.0 (contact@campusfleet.app)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(6000),
      });

      if (osmRes.ok) {
        const osmData = await osmRes.json();
        if (osmData && osmData.display_name) {
          const addr = osmData.address || {};
          // Construct clean street/area address
          const streetParts = [
            addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood,
            addr.residential || addr.city_district || addr.suburb,
            addr.city || addr.town || addr.village || addr.county,
            addr.state,
            addr.postcode,
          ].filter(Boolean);

          // Deduplicate adjacent identical tokens
          const cleanStreetParts = streetParts.filter((part, idx) => streetParts.indexOf(part) === idx);
          const formatted = cleanStreetParts.length > 0 ? cleanStreetParts.join(", ") : osmData.display_name;

          return NextResponse.json({
            success: true,
            address: formatted,
            displayName: osmData.display_name,
            provider: "openstreetmap-nominatim",
            details: addr,
          });
        }
      }
    } catch (osmErr) {
      console.warn("[reverse-geocode] OSM Nominatim error or timeout, falling back:", osmErr);
    }

    // 3. Fallback to BigDataCloud client reverse geocode (open source / no key needed)
    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
      const bdcRes = await fetch(bdcUrl, { signal: AbortSignal.timeout(5000) });
      if (bdcRes.ok) {
        const bdcData = await bdcRes.json();
        const parts = [
          bdcData.locality,
          bdcData.city,
          bdcData.principalSubdivision,
          bdcData.postcode,
          bdcData.countryName,
        ].filter(Boolean);
        const cleanParts = parts.filter((part, idx) => parts.indexOf(part) === idx);

        if (cleanParts.length > 0) {
          return NextResponse.json({
            success: true,
            address: cleanParts.join(", "),
            provider: "bigdatacloud",
            details: bdcData,
          });
        }
      }
    } catch (bdcErr) {
      console.warn("[reverse-geocode] BigDataCloud fallback error:", bdcErr);
    }

    return NextResponse.json({
      success: true,
      address: `Location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`,
      provider: "coordinates-fallback",
    });
  } catch (error: any) {
    console.error("[api/geo/reverse-geocode] Unexpected error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to reverse geocode coordinates." },
      { status: 500 }
    );
  }
}
