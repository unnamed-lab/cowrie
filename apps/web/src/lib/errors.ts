/**
 * Turn the long, technical errors wagmi/viem and the relayer throw into a single
 * short, human sentence. Most of the pain the user feels is a slow RPC producing
 * "already known" / timeout / revert dumps; we map the common cases explicitly
 * and fall back to a trimmed message.
 */

// Friendly text for known contract require() strings.
const REVERT_MESSAGES: Record<string, string> = {
  "not organizer": "Only the organizer can do that.",
  "only organizer": "Only the organizer can do that.",
  "not a member": "You're not a member of this circle.",
  "not an employee": "You're not on this payroll.",
  "not authorized to join": "The organizer hasn't whitelisted your address yet.",
  "already a member": "You're already a member.",
  "already contributed": "You've already contributed this round.",
  "round not complete": "Not everyone has contributed yet.",
  "too soon": "It's not time to claim again yet.",
  closed: "This campaign is closed.",
  "not yet": "The deadline hasn't passed yet.",
  "not deciding": "Finalize the campaign before settling.",
  "not succeeded": "The campaign hasn't succeeded.",
  "not failed": "The campaign hasn't failed.",
  "fixed amount not set": "The organizer hasn't set the contribution amount yet.",
  "refund window closed": "Refunds aren't open right now.",
  "nothing to refund": "You have nothing to refund this round.",
  "already refunded": "You've already claimed your refund.",
  "circle already started": "The circle has already started — members are locked.",
  "insufficient creation fee": "Creating this needs a 0.005 ETH stake.",
  "title required": "Please add a title.",
  "payroll stopped": "This payroll has been stopped by the employer.",
  dissolved: "This circle has been dissolved.",
  "goal too low": "The goal is below the minimum (1000 cUSDT).",
  "duration too short": "The duration is below the minimum.",
};

function deepText(err: unknown): string {
  if (typeof err === "string") return err;
  const parts: string[] = [];
  let e: unknown = err;
  for (let i = 0; i < 6 && e; i++) {
    const o = e as { message?: string; shortMessage?: string; reason?: string; details?: string; cause?: unknown };
    if (o.shortMessage) parts.push(o.shortMessage);
    if (o.reason) parts.push(o.reason);
    if (o.details) parts.push(o.details);
    if (o.message) parts.push(o.message);
    e = o.cause;
  }
  return parts.join(" • ");
}

export function formatTxError(err: unknown): string {
  const text = deepText(err).toLowerCase();
  const code = (err as { code?: number | string })?.code;

  // User cancelled in the wallet.
  if (code === 4001 || code === "ACTION_REJECTED" || /user rejected|user denied|rejected the request/.test(text)) {
    return "You cancelled the request in your wallet.";
  }

  // Map a known revert reason if present (takes precedence over generic network/RPC errors).
  for (const key of Object.keys(REVERT_MESSAGES)) {
    if (text.includes(key.toLowerCase())) return REVERT_MESSAGES[key];
  }

  // Likely already executed / a duplicate the slow RPC didn't reflect yet.
  if (/already known|nonce too low|replacement transaction underpriced|tx already/.test(text)) {
    return "That action may have already gone through — refreshing in a moment.";
  }

  // Gas / funds.
  if (/insufficient funds/.test(text)) {
    return "Not enough Sepolia ETH to cover gas.";
  }

  // Network / RPC slowness.
  if (/timeout|timed out|failed to fetch|network error|econnreset|fetch failed|503|429|load failed/.test(text)) {
    return "The network is slow right now — please try again.";
  }

  // Generic revert without a recognised reason.
  if (/reverted|execution reverted|call exception/.test(text)) {
    return "The transaction was rejected by the contract. It may already be done — refresh and check.";
  }

  // Relayer / decryption issues.
  if (/acl|not allowed|decrypt/.test(text)) {
    return "You're not authorised to decrypt this value (or it isn't ready yet).";
  }

  // Fallback: the first, shortest sentence we can show.
  const first = deepText(err).split(" • ")[0] || "Something went wrong.";
  return first.length > 140 ? first.slice(0, 137) + "…" : first;
}
