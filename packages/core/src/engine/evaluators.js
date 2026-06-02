import {
  buildNormalizedHaystack,
  containsAnyNormalized,
  expandTerms,
  normalizeToken
} from "./normalization.js";

export const EVALUATOR_ALIASES = {
  "dom.type_is": "dom.input_type_is",
  "vision.ocr_nearby_contains": "vision.ocr_contains_any"
};

export function normalizeEvaluatorName(name) {
  return EVALUATOR_ALIASES[name] ?? name;
}

function detail(score, evidence = {}) {
  return { score: score ? 1 : 0, evidence };
}

function attrValue(cand, attr) {
  return cand?.dom?.attrs?.[String(attr ?? "").toLowerCase()];
}

function domTextValues(cand) {
  return [
    cand?.dom?.label_text,
    cand?.dom?.placeholder,
    cand?.dom?.aria_label,
    cand?.dom?.text,
    cand?.dom?.nearby_text,
    cand?.dom?.attrs?.name,
    cand?.dom?.attrs?.id,
    cand?.dom?.attrs?.autocomplete
  ];
}

function textContains(values, terms, synonymGroups) {
  const result = containsAnyNormalized(values, terms, synonymGroups);
  return detail(result.score, result);
}

function choiceSet(values) {
  return new Set((Array.isArray(values) ? values : [values]).map(normalizeToken).filter(Boolean));
}

function equalsAny(observed, values) {
  const normalized_observed = normalizeToken(observed);
  const normalized_values = [...choiceSet(values)];
  return detail(normalized_observed && normalized_values.includes(normalized_observed), {
    raw_values: observed == null ? [] : [String(observed)],
    normalized_values: normalized_observed ? [normalized_observed] : [],
    normalized_terms: normalized_values,
    matched_terms: normalized_values.filter((value) => value === normalized_observed)
  });
}

export class EvaluatorRegistry {
  constructor() { this.fns = new Map(); }
  /** @param {string} name @param {(candidate:any, params:any)=>number|{score:number,evidence?:any}} fn */
  register(name, fn) { this.fns.set(normalizeEvaluatorName(name), fn); }
  has(name) { return this.fns.has(normalizeEvaluatorName(name)); }
  names() { return [...this.fns.keys()].sort(); }
  evalDetailed(name, candidate, params) {
    const normalizedName = normalizeEvaluatorName(name);
    const fn = this.fns.get(normalizedName);
    if (!fn) throw new Error(`Unknown evaluator: ${name}`);
    const value = fn(candidate, params ?? {});
    return typeof value === "number" ? detail(value) : detail(value?.score ?? 0, value?.evidence ?? {});
  }
  eval(name, candidate, params) {
    return this.evalDetailed(name, candidate, params).score;
  }
}

export const REGISTRY = new EvaluatorRegistry();

REGISTRY.register("dom.attr_equals", (cand, { attr, value }) => {
  return equalsAny(attrValue(cand, attr), [value]);
});

REGISTRY.register("dom.attr_in", (cand, { attr, values }) => {
  return equalsAny(attrValue(cand, attr), values ?? []);
});

REGISTRY.register("dom.attr_contains_any", (cand, { attr, terms, values, synonym_groups }) => {
  return textContains([attrValue(cand, attr)], terms ?? values ?? [], synonym_groups);
});

REGISTRY.register("dom.text_contains_any", (cand, { terms, synonym_groups }) => {
  return textContains(domTextValues(cand), terms, synonym_groups);
});

REGISTRY.register("dom.role_is", (cand, { role }) => {
  return equalsAny(cand?.dom?.role, [role]);
});

REGISTRY.register("dom.tag_is", (cand, { tag, tags }) => {
  return equalsAny(cand?.dom?.tag, tags ?? [tag]);
});

REGISTRY.register("dom.input_type_is", (cand, params = {}) => {
  const observed = cand?.dom?.type ?? cand?.dom?.attrs?.type;
  const target = params?.types ?? params?.type ?? [];
  return equalsAny(observed, target);
});

REGISTRY.register("dom.label_contains_any", (cand, { terms, synonym_groups }) => {
  return textContains([cand?.dom?.label_text, cand?.dom?.aria_label], terms, synonym_groups);
});

REGISTRY.register("dom.near_text_contains_any", (cand, { terms, synonym_groups }) => {
  return textContains([cand?.dom?.nearby_text], terms, synonym_groups);
});

REGISTRY.register("dom.xpath_matches", (cand, { pattern, contains }) => {
  const xpath = String(cand?.dom?.xpath ?? cand?.xpath ?? "");
  const matched = pattern ? new RegExp(pattern).test(xpath) : xpath.includes(String(contains ?? ""));
  return detail(matched, { raw_values: xpath ? [xpath] : [], normalized_values: xpath ? [xpath] : [] });
});

REGISTRY.register("dom.css_path_contains", (cand, { terms, contains }) => {
  return textContains([cand?.dom?.css_path ?? cand?.css_path], terms ?? [contains]);
});

REGISTRY.register("a11y.role_is", (cand, { role }) => {
  return equalsAny(cand?.a11y?.role ?? cand?.dom?.role, [role]);
});

REGISTRY.register("a11y.name_contains_any", (cand, { terms, synonym_groups }) => {
  return textContains([cand?.a11y?.name, cand?.dom?.aria_label, cand?.dom?.label_text], terms, synonym_groups);
});

REGISTRY.register("vision.ocr_contains_any", (cand, { terms, synonym_groups }) => {
  return textContains([cand?.vision?.ocr_tokens, cand?.vision?.ocr_nearby, cand?.vision?.text], terms, synonym_groups);
});

REGISTRY.register("vision.spatial_relation", (_cand, params = {}) => {
  return detail(0, { placeholder: true, relation: params.relation ?? null });
});

REGISTRY.register("mobile.resource_id_contains_any", (cand, { terms, synonym_groups }) => {
  return textContains([cand?.mobile?.resource_id], terms, synonym_groups);
});

REGISTRY.register("mobile.content_desc_contains_any", (cand, { terms, synonym_groups }) => {
  return textContains([cand?.mobile?.content_desc], terms, synonym_groups);
});

REGISTRY.register("mobile.class_is", (cand, { class_name, classes }) => {
  return equalsAny(cand?.mobile?.class, classes ?? [class_name]);
});

REGISTRY.register("mobile.text_contains_any", (cand, { terms, synonym_groups }) => {
  return textContains([cand?.mobile?.text], terms, synonym_groups);
});

REGISTRY.register("semantic.embedding_similarity", (_cand, params = {}) => {
  return detail(0, { placeholder: true, threshold: params.threshold ?? null });
});

export const KNOWN_EVALUATOR_NAMES = REGISTRY.names();

export function evalSignalDetailed(sig, cand) {
  return REGISTRY.evalDetailed(sig.evaluator, cand, sig.params ?? {});
}

export function evalSignal(sig, cand) {
  return evalSignalDetailed(sig, cand).score;
}

export function getExpandedTerms(terms, synonymGroups) {
  return expandTerms(terms, synonymGroups);
}
