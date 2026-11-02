import { validateConfiguration } from "./validation.js";
import { defaults } from "./models.js";
const KEY = "so-playground-v1",
  labs = Object.keys(defaults),
  empty = () => ({ version: 1, configs: {}, history: [] });
function cleanEntry(entry) {
  if (
    !entry ||
    typeof entry !== "object" ||
    Array.isArray(entry) ||
    !labs.includes(entry.lab) ||
    typeof entry.id !== "string" ||
    typeof entry.date !== "string"
  )
    throw Error("invalid history entry");
  const config = validateConfiguration(entry.lab, entry.config);
  if (
    entry.metrics !== undefined &&
    (!entry.metrics ||
      typeof entry.metrics !== "object" ||
      Array.isArray(entry.metrics))
  )
    throw Error("invalid metrics");
  if (entry.status !== undefined && typeof entry.status !== "string")
    throw Error("invalid status");
  const out = { ...entry, config };
  if (entry.name !== undefined) {
    if (typeof entry.name !== "string" || entry.name.length > 80)
      throw Error("invalid name");
    out.name = entry.name;
  }
  return out;
}
export function load() {
  let parsed;
  try {
    parsed = JSON.parse(localStorage.getItem(KEY));
  } catch {
    return {
      ...empty(),
      recoveryWarnings: [
        "Saved data could not be parsed; started with empty browser data.",
      ],
    };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return empty();
  const result = empty(),
    warnings = [];
  if (parsed.version !== undefined && parsed.version !== 1)
    return {
      ...empty(),
      recoveryWarnings: [
        "Unsupported saved-data version; started with empty browser data.",
      ],
    };
  for (const [lab, raw] of Object.entries(parsed.configs || {})) {
    try {
      if (!labs.includes(lab)) throw Error("unknown lab");
      result.configs[lab] = validateConfiguration(lab, raw);
    } catch {
      warnings.push(`Skipped invalid saved ${lab} configuration.`);
    }
  }
  if (Array.isArray(parsed.history))
    for (const raw of parsed.history) {
      try {
        result.history.push(cleanEntry(raw));
      } catch {
        warnings.push("Skipped a corrupt history entry.");
        if (warnings.length > 40) break;
      }
    }
  else if (parsed.history !== undefined)
    warnings.push("Skipped invalid history data.");
  result.history = result.history.slice(0, 50);
  if (warnings.length) result.recoveryWarnings = warnings;
  return result;
}
export function save(data) {
  try {
    const safe = empty();
    for (const [lab, raw] of Object.entries(data.configs || {}))
      safe.configs[lab] = validateConfiguration(lab, raw);
    safe.history = (data.history || []).slice(0, 50).map(cleanEntry);
    localStorage.setItem(KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}
export function importData(text, currentData = empty()) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw Error("Import file is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw Error("Import data must be a JSON object.");
  if (
    (parsed.configs !== undefined &&
      (!parsed.configs ||
        typeof parsed.configs !== "object" ||
        Array.isArray(parsed.configs))) ||
    (parsed.history !== undefined && !Array.isArray(parsed.history))
  )
    throw Error("Import configurations and history have invalid formats.");
  const merged = empty();
  for (const [lab, raw] of Object.entries(currentData.configs || {}))
    try {
      merged.configs[lab] = validateConfiguration(lab, raw);
    } catch {}
  for (const [lab, raw] of Object.entries(parsed.configs || {})) {
    if (!labs.includes(lab)) continue;
    merged.configs[lab] = validateConfiguration(lab, raw);
  }
  const incoming = [];
  for (const raw of Array.isArray(parsed.history) ? parsed.history : [])
    try {
      incoming.push(cleanEntry(raw));
    } catch {}
  const existing = [];
  for (const raw of Array.isArray(currentData.history)
    ? currentData.history
    : [])
    try {
      existing.push(cleanEntry(raw));
    } catch {}
  merged.history = [...incoming, ...existing].slice(0, 50);
  return merged;
}
export function encodeConfiguration(lab, config) {
  const payload = JSON.stringify({
    lab,
    config: validateConfiguration(lab, config),
  });
  return btoa(unescape(encodeURIComponent(payload)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export function decodeConfiguration(encoded) {
  try {
    if (typeof encoded !== "string" || encoded.length > 100000)
      throw Error("share code is too large");
    const b64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    if (!/^[A-Za-z0-9+/]*$/.test(b64)) throw Error("invalid characters");
    const payload = decodeURIComponent(
      escape(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="))),
    );
    const parsed = JSON.parse(payload);
    return {
      lab: parsed.lab,
      config: validateConfiguration(parsed.lab, parsed.config),
    };
  } catch (error) {
    throw Error(`Invalid shared configuration: ${error.message}`);
  }
}
export function summary(lab, config, result) {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    lab,
    config: structuredClone(config),
    algorithm: config.algorithm,
    status: result.status,
    metrics: result.metrics,
    traceSkipped: result.traceSkipped || 0,
  };
}
