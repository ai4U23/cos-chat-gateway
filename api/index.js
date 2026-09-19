/**
 * Unified Serverless Gateway for ai4U CoS Relay
 * Channels: WhatsApp (Meta Cloud API), Telegram, Zalo
 * 
 * Guarantees:
 * - Immediate HTTP 200 OK to Meta / Telegram within 30ms (zero backoff / queuing).
 * - Forwards payloads asynchronously to Google Apps Script /exec.
 * - Handles Meta GET hub.challenge verification handshake directly.
 */

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbwDWezWrXlcudRqydDDptY5c9c7RXHtyXCCbzsh9rfzjGKkGB69cwoNrvtrYKoGGN92lg/exec";
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "5df708d690346e62b254ad792d726106";
const WHATSAPP_WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET || "4dca4219c134968b8131a7aa3e67e9fd";

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  // 1. Health check
  if (pathname === "/" || pathname === "/health") {
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({ status: "ok", service: "cos-chat-gateway", v: "1.0.0" });
  }

  // 2. WhatsApp Verification Handshake (GET /whatsapp or /api/whatsapp)
  if (req.method === "GET" && (pathname.includes("whatsapp") || url.searchParams.has("hub.challenge"))) {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN && challenge) {
      res.setHeader("Content-Type", "text/plain");
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Verification token mismatch");
  }

  // 3. Inbound POST Webhooks
  if (req.method === "POST") {
    let rawBody = "";
    if (typeof req.body === "string") {
      rawBody = req.body;
    } else if (req.body && typeof req.body === "object") {
      rawBody = JSON.stringify(req.body);
    } else {
      rawBody = await new Promise((resolve) => {
        let data = "";
        req.on("data", chunk => { data += chunk; });
        req.on("end", () => resolve(data));
      });
    }

    let parsed = null;
    try { parsed = JSON.parse(rawBody); } catch (_) {}

    // Channel Identification
    let targetUrl = `${APPS_SCRIPT_URL}?token=${WHATSAPP_WEBHOOK_SECRET}`;
    if (pathname.includes("telegram") || (parsed && parsed.update_id)) {
      targetUrl = APPS_SCRIPT_URL;
    } else if (pathname.includes("zalo") || (parsed && (parsed.event_name || (parsed.result && parsed.result.event_name)))) {
      targetUrl = `${APPS_SCRIPT_URL}?zalo_secret=ai4UnowProcaffe`;
    }

    console.log(`[inbound ${req.method}] ${pathname} target=${targetUrl}`);

    // Forward to Apps Script with redirect: "manual" so it does NOT turn into a GET
    const forwardPromise = fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawBody,
      redirect: "manual"
    })
      .then(r => console.log(`[forward response] status=${r.status} location=${r.headers.get("location") ? "yes" : "no"}`))
      .catch(err => console.error("[forward error]:", err));

    // For Meta & Telegram: return 200 OK instantly (<20ms) so they NEVER back off or retry!
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ status: "ok", forwarded: true });

    // Ensure serverless function waits for the forward request before freezing
    await forwardPromise;
    return;
  }

  return res.status(405).json({ error: "Method not allowed" });
}
