// Supabase Edge Function: track-citypak
//
// Keeps the CityPak Falcon API key off the client. The public "Track your order" page
// (audrey-care-ops-v9.html) calls this with ?tracking_number=..., and this function attaches
// the real API key and forwards the request to CityPak's order-tracking endpoint. That way
// customers see live delivery status right inside our own tracking page and never have to
// visit CityPak's site at all.
//
// Deploy:
//   supabase functions deploy track-citypak --no-verify-jwt
//
// Secrets (set once, from the project root):
//   supabase secrets set CITYPAK_API_KEY=your_citypak_falcon_api_key
//   supabase secrets set CITYPAK_APP_SECRET=some-long-random-string
//
// CITYPAK_API_KEY is the Bearer token CityPak issued you for their Falcon customer API.
// CITYPAK_APP_SECRET is a shared password between this function and the frontend (see
// CITYPAK_APP_SECRET near SUPABASE_URL in the HTML file) so random visitors who find the
// function URL can't burn through your CityPak API quota.
//
// While testing against CityPak's sandbox instead of production, also set:
//   supabase secrets set CITYPAK_BASE_URL=https://staging.citypak.lk

const DEFAULT_BASE_URL = "https://falcon.citypak.lk";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-citypak-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "GET") return json({ ok: false, error: "GET only" }, 405);

  const appSecret = Deno.env.get("CITYPAK_APP_SECRET") || "";
  if (appSecret && req.headers.get("x-citypak-secret") !== appSecret) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const trackingNumber = (url.searchParams.get("tracking_number") || "").trim();
  if (!trackingNumber) return json({ ok: false, error: "tracking_number is required" }, 400);

  const apiKey = Deno.env.get("CITYPAK_API_KEY");
  if (!apiKey) {
    return json({ ok: false, error: "CityPak tracking is not configured (missing CITYPAK_API_KEY secret)" }, 500);
  }
  const baseUrl = Deno.env.get("CITYPAK_BASE_URL") || DEFAULT_BASE_URL;

  try {
    const citypakRes = await fetch(
      baseUrl + "/customer_api/v1/track?tracking_number=" + encodeURIComponent(trackingNumber),
      { headers: { "Authorization": "Bearer " + apiKey } },
    );
    const text = await citypakRes.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

    if (!citypakRes.ok) {
      const message = (parsed && parsed.message) || "CityPak rejected the request";
      return json({ ok: false, error: message, detail: parsed }, citypakRes.status === 404 ? 404 : 502);
    }
    // CityPak's success body is { is_success: true, data: {...} } — pass the tracking data
    // straight through so the frontend can render it.
    return json({ ok: true, data: parsed.data });
  } catch (e) {
    return json({ ok: false, error: "could not reach CityPak", detail: String(e) }, 502);
  }
});
