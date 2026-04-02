import { proxyCache } from "../../image.js";

export async function onRequest({ request, params }) {
    if (request.method !== "GET") {
        return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" },
        });
    }

    const id = Array.isArray(params.id) ? params.id.join("/") : params.id;

    if (!id) {
        return new Response(JSON.stringify({ success: false, error: "Missing image ID" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const upstreamUrl = proxyCache.get(id);

    if (!upstreamUrl) {
        return new Response(JSON.stringify({ success: false, error: "Image not found or expired" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        });
    }

    let upstream;
    try {
        upstream = await fetch(upstreamUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, error: `Proxy fetch failed: ${e.message}` }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (!upstream.ok) {
        return new Response(JSON.stringify({ success: false, error: `Upstream returned ${upstream.status}` }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
        });
    }

    const contentType = upstream.headers.get("Content-Type") || "image/jpeg";

    return new Response(upstream.body, {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
        },
    });
}