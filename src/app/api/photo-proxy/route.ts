import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/photo-proxy?url=<encoded_url>
 *
 * Proxies profile photo images from Vercel Blob Storage to guarantee
 * same-origin delivery, bypass mobile carrier / browser CORP restrictions,
 * and eliminate broken images on Android/iOS mobile browsers.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Security: only allow proxying from vercel blob storage or trusted image hosts
  try {
    const parsed = new URL(targetUrl);
    const allowedHosts = [
      "blob.vercel-storage.com",
      "public.blob.vercel-storage.com",
      "hycfzwsdzghug7tt.public.blob.vercel-storage.com",
      "lh3.googleusercontent.com",
    ];

    const isAllowed = allowedHosts.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith(".public.blob.vercel-storage.com")
    );

    if (!isAllowed) {
      return NextResponse.json({ error: "Unauthorized image host" }, { status: 403 });
    }

    const upstreamRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "CampusFleet-ImageProxy/1.0",
      },
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed: ${upstreamRes.statusText}` },
        { status: upstreamRes.status }
      );
    }

    const contentType = upstreamRes.headers.get("content-type") || "image/jpeg";
    const imageBuffer = await upstreamRes.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error("Photo proxy error:", err);
    return NextResponse.json({ error: "Failed to proxy image: " + err.message }, { status: 500 });
  }
}
