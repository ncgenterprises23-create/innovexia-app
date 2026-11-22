/** Pipeline access helpers (client-safe — no Google Sheets / Node deps). */

/** Usernames allowed to view and manage this pipeline (comma-separated in sheet). */
function splitAccessList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const u = part.trim();
    if (!u) continue;
    const key = u.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

/** Multiple users live in one sheet column: `owner_username` (comma-separated). */
export function parsePipelineAccessUsernames(pipeline: any): string[] {
  const ownerRaw = String(pipeline?.owner_username ?? '').trim();
  if (ownerRaw) {
    const parsed = splitAccessList(ownerRaw);
    if (parsed.length) return parsed;
  }
  const legacy = String(pipeline?.access_usernames ?? '').trim();
  if (legacy) {
    const parsed = splitAccessList(legacy);
    if (parsed.length) return parsed;
  }
  const createdBy = String(pipeline?.created_by || '').trim();
  return createdBy ? [createdBy] : [];
}

export function pipelineAccessUsernamesToSheet(names: string[]): string {
  return splitAccessList(names.join(',')).join(', ');
}

export function userCanAccessCrmPipeline(
  pipeline: any,
  username: string,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  const mine = String(username || '').trim().toLowerCase();
  if (!mine) return false;
  return parsePipelineAccessUsernames(pipeline).some((u) => u.toLowerCase() === mine);
}

export function userCanManageCrmPipeline(
  pipeline: any,
  username: string,
  isAdmin: boolean
): boolean {
  return userCanAccessCrmPipeline(pipeline, username, isAdmin);
}