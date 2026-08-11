// QuantPilot Frontend ↔ Bridge /verification contract.
// The frontend MUST derive its MT5 tier from GET /api/v1/mt5/verification,
// never from default/mock data. If the bridge is unreachable -> UI_CONTRACT.
//
// NOTE: No bridge URL is configured in this Base44 app, so the effective
// tier stays UI_CONTRACT until the external bridge is deployed and reachable.

export const VERIFICATION_PATH = "/api/v1/mt5/verification";

// Default (no bridge reachable) – honest fallback.
export const uiContractVerification = {
  tier: "UI_CONTRACT",
  bridge: false,
  mt5: false,
  account: false,
  symbol: false,
  tick: false,
  positions: false,
  heartbeat: false,
  order_check: false,
  live_execution_blocked: true,
};

/**
 * Fetch verification from the bridge. Returns the JSON body or the
 * UI_CONTRACT fallback on any failure (network error, non-OK, parse error).
 * @param {string} baseUrl - bridge base URL, e.g. "https://bridge.example"
 * @param {string} [apiKey] - optional X-API-Key
 */
export async function fetchVerification(baseUrl, apiKey) {
  if (!baseUrl) return { ...uiContractVerification };
  try {
    const res = await fetch(`${baseUrl}${VERIFICATION_PATH}`, {
      headers: apiKey ? { "X-API-Key": apiKey } : {},
    });
    if (!res.ok) return { ...uiContractVerification };
    const body = await res.json();
    return body?.tier ? body : { ...uiContractVerification };
  } catch {
    return { ...uiContractVerification };
  }
}