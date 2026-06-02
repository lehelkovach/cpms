const CONCEPT_ID_RE = /^(concept:[^@]+)@(\d+\.\d+\.\d+)$/;

export function parseVersionedId(id) {
  const match = String(id ?? "").match(CONCEPT_ID_RE);
  if (!match) return null;
  return { family: match[1], version: match[2], id: String(id) };
}

export function buildConceptResolver({ concepts = [], aliases = {}, manifest = null } = {}) {
  const byId = new Map();
  const remaps = new Map(Object.entries(aliases));

  for (const concept of concepts) {
    if (!concept?.concept_id) continue;
    byId.set(concept.concept_id, concept);
    if (concept.alias_of) remaps.set(concept.concept_id, concept.alias_of);
    if (concept.deprecated_by) remaps.set(concept.concept_id, concept.deprecated_by);
    for (const compatible of concept.compatible_with ?? []) {
      if (!remaps.has(compatible)) remaps.set(compatible, concept.concept_id);
    }
  }

  for (const object of manifest?.objects ?? []) {
    if (object.alias_of) remaps.set(object.id, object.alias_of);
    if (object.deprecated_by) remaps.set(object.id, object.deprecated_by);
    for (const compatible of object.compatible_with ?? []) {
      if (!remaps.has(compatible)) remaps.set(compatible, object.id);
    }
  }

  const latestByFamily = new Map();
  for (const id of byId.keys()) {
    const parsed = parseVersionedId(id);
    if (!parsed) continue;
    const current = latestByFamily.get(parsed.family);
    if (!current || compareSemver(parsed.version, current.version) > 0) {
      latestByFamily.set(parsed.family, parsed);
    }
  }

  function resolveId(id, options = {}) {
    const seen = new Set();
    let current = id;
    while (remaps.has(current)) {
      if (seen.has(current)) throw new Error(`Concept remap cycle detected at ${current}`);
      seen.add(current);
      current = remaps.get(current);
    }

    if (options.latest !== false && !byId.has(current)) {
      const parsed = parseVersionedId(current);
      const latest = parsed ? latestByFamily.get(parsed.family) : null;
      if (latest) current = latest.id;
    }

    return current;
  }

  function resolveConcept(id, options = {}) {
    const resolved_id = resolveId(id, options);
    return { requested_id: id, resolved_id, concept: byId.get(resolved_id) ?? null };
  }

  return { resolveId, resolveConcept, byId, remaps };
}

export function remapPattern(pattern, resolver) {
  return {
    ...pattern,
    includes: (pattern.includes ?? []).map((id) => resolver.resolveId(id)),
    constraints: (pattern.constraints ?? []).map((constraint) => {
      if (constraint.type !== "required_concepts") return constraint;
      return {
        ...constraint,
        params: {
          ...constraint.params,
          ids: (constraint.params?.ids ?? []).map((id) => resolver.resolveId(id))
        }
      };
    })
  };
}

function compareSemver(a, b) {
  const aa = a.split(".").map(Number);
  const bb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((aa[i] ?? 0) !== (bb[i] ?? 0)) return (aa[i] ?? 0) - (bb[i] ?? 0);
  }
  return 0;
}
