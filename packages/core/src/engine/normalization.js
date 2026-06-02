export const DEFAULT_SYNONYM_GROUPS = {
  login_identifier: ["email", "e-mail", "username", "user name", "login", "account", "phone"],
  email: ["email", "e-mail", "mail"],
  username: ["username", "user name", "userid", "user id", "login", "account"],
  phone: ["phone", "telephone", "mobile", "cell"],
  password: ["password", "passcode", "pwd"],
  submit_login: ["log in", "login", "sign in", "signin", "continue"]
};

const ALIAS_LOOKUP = new Map();
for (const [canonical, aliases] of Object.entries(DEFAULT_SYNONYM_GROUPS)) {
  for (const alias of aliases) {
    ALIAS_LOOKUP.set(normalizeToken(alias), canonical);
  }
}

export function normalizeToken(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactToken(value) {
  return normalizeToken(value).replace(/\s+/g, "");
}

export function canonicalAlias(value) {
  const normalized = normalizeToken(value);
  return ALIAS_LOOKUP.get(normalized) ?? ALIAS_LOOKUP.get(compactToken(normalized)) ?? normalized;
}

export function expandTerms(terms = [], synonymGroups = DEFAULT_SYNONYM_GROUPS) {
  const expanded = new Set();
  for (const term of terms ?? []) {
    const normalized = normalizeToken(term);
    if (!normalized) continue;
    expanded.add(normalized);
    expanded.add(compactToken(normalized));

    const canonical = canonicalAlias(normalized);
    expanded.add(canonical);
    for (const alias of synonymGroups[canonical] ?? []) {
      expanded.add(normalizeToken(alias));
      expanded.add(compactToken(alias));
    }
  }
  return [...expanded].filter(Boolean).sort();
}

export function normalizeFieldValues(values) {
  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => value != null && value !== false)
    .map((value) => String(value));
}

export function buildNormalizedHaystack(values) {
  const raw_values = normalizeFieldValues(values);
  const normalized_values = raw_values.map(normalizeToken).filter(Boolean);
  const compact_values = normalized_values.map(compactToken).filter(Boolean);
  return {
    raw_values,
    normalized_values,
    haystack: [...normalized_values, ...compact_values].join(" ")
  };
}

export function containsAnyNormalized(values, terms = [], synonymGroups = DEFAULT_SYNONYM_GROUPS) {
  const details = buildNormalizedHaystack(values);
  const normalized_terms = expandTerms(terms, synonymGroups);
  const matched_terms = normalized_terms.filter((term) => details.haystack.includes(term));
  return {
    score: matched_terms.length > 0 ? 1 : 0,
    raw_values: details.raw_values,
    normalized_values: details.normalized_values,
    normalized_terms,
    matched_terms
  };
}
