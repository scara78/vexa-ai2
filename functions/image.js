const DEEPAI_URL = "https://api.deepai.org/api/text2img";
const MODELS = { hd: "hd" };
const PREFERENCES = { speed: "turbo", quality: "quality" };
const DEFAULT_MODEL = "hd";
const DEFAULT_PREFERENCE = "speed";
const MAX_REQUESTS = 10;
const RATE_WINDOW = 60000;

const rateLimitStore = new Map();
const proxyCache = new Map();

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    };
}

function isRateLimited(ip) {
    const now = Date.now();
    if (!rateLimitStore.has(ip)) rateLimitStore.set(ip, []);
    const times = rateLimitStore.get(ip).filter(t => now - t < RATE_WINDOW);
    rateLimitStore.set(ip, times);
    if (times.length >= MAX_REQUESTS) return true;
    times.push(now);
    return false;
}

async function md5Hex(str) {
    const encoded = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("MD5", encoded);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function reversedMd5(str) {
    return (await md5Hex(str)).split("").reverse().join("");
}

async function genKey() {
    const rnd = String(Math.round(Math.random() * 100000000000));
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    const salt = "hackers_become_a_little_stinkier_every_time_they_hack";
    const h1 = await reversedMd5(ua + rnd + salt);
    const h2 = await reversedMd5(ua + h1);
    const h3 = await reversedMd5(ua + h2);
    return `tryit-${rnd}-${h3}`;
}

async function makeProxyId(url) {
    const id = (await reversedMd5(url + String(Date.now()))).slice(0, 24);
    proxyCache.set(id, url);
    return id;
}

function buildBody(prompt, modelVer, prefKey) {
    const boundary = "----DeepAIBound7MA4YWxkTrZu0gW";
    const fields = {
        text: prompt,
        image_generator_version: modelVer,
        generation_source: "img",
    };
    if (prefKey === "turbo") fields.turbo = "true";
    else fields.quality = "true";

    let body = "";
    for (const [name, val] of Object.entries(fields)) {
        body += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${val}\r\n`;
    }
    body += `--${boundary}--\r\n`;
    return { boundary, body: new TextEncoder().encode(body) };
}

async function callDeepAI(prompt, modelVer, prefKey) {
    const { boundary, body } = buildBody(prompt, modelVer, prefKey);
    const key = await genKey();
    const res = await fetch(DEEPAI_URL, {
        method: "POST",
        headers: {
            "api-key": key,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Origin": "https://deepai.org",
            "Referer": "https://deepai.org/machine-learning-model/text2img",
        },
        body,
    });
    const data = await res.json();
    if (!data.output_url) {
        const err = data.err || data.status || data.error || JSON.stringify(data);
        throw new Error(err);
    }
    return data.output_url;
}

function parseGet(url) {
    const sp = url.searchParams;
    return {
        prompt: sp.get("q") || sp.get("prompt") || null,
        model: sp.get("model") || DEFAULT_MODEL,
        preference: sp.get("preference") || DEFAULT_PREFERENCE,
    };
}

async function parsePost(request) {
    let body;
    try { body = await request.json(); }
    catch (_) { return null; }
    return {
        prompt: body.prompt || body.q || null,
        model: body.model || DEFAULT_MODEL,
        preference: body.preference || DEFAULT_PREFERENCE,
    };
}

async function run(args, baseUrl) {
    const { prompt, model, preference } = args;

    if (!prompt || !String(prompt).trim()) {
        return Response.json({ success: false, error: "Missing required parameter: q or prompt" }, { status: 400, headers: corsHeaders() });
    }

    const modelVer = MODELS[model];
    if (!modelVer) {
        return Response.json({ success: false, error: "Invalid model. Valid value: hd" }, { status: 400, headers: corsHeaders() });
    }

    const prefKey = PREFERENCES[preference];
    if (!prefKey) {
        return Response.json({ success: false, error: "Invalid preference. Valid values: speed, quality" }, { status: 400, headers: corsHeaders() });
    }

    const t0 = Date.now();
    let upstreamUrl;
    try {
        upstreamUrl = await callDeepAI(String(prompt).trim().slice(0, 1000), modelVer, prefKey);
    } catch (e) {
        return Response.json({ success: false, error: `Generation failed: ${e.message}` }, { status: 502, headers: corsHeaders() });
    }

    const proxyId = await makeProxyId(upstreamUrl);
    const proxyUrl = `${baseUrl}/image/proxy/${proxyId}`;

    return Response.json({
        success: true,
        prompt: String(prompt).trim().slice(0, 1000),
        model,
        preference,
        proxy_url: proxyUrl,
        elapsed_ms: Date.now() - t0,
    }, { status: 200, headers: corsHeaders() });
}

export { proxyCache };

export async function onRequest({ request }) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

    if (isRateLimited(ip)) {
        return Response.json({ success: false, error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders() });
    }

    if (request.method === "GET") {
        return run(parseGet(url), baseUrl);
    }

    if (request.method === "POST") {
        const args = await parsePost(request);
        if (!args) {
            return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400, headers: corsHeaders() });
        }
        return run(args, baseUrl);
    }

    return Response.json({ success: false, error: "Method not allowed" }, { status: 405, headers: corsHeaders() });
}