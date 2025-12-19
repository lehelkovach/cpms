export class EvaluatorRegistry {
  constructor() { this.fns = new Map(); }
  /** @param {string} name @param {(candidate:any, params:any)=>number} fn */
  register(name, fn) { this.fns.set(name, fn); }
  eval(name, candidate, params) {
    const fn = this.fns.get(name);
    if (!fn) throw new Error(`Unknown evaluator: ${name}`);
    return fn(candidate, params);
  }
}

export const REGISTRY = new EvaluatorRegistry();

// DOM evaluators
REGISTRY.register("dom.attr_in", (cand, { attr, values }) => {
  const v = String(cand?.dom?.attrs?.[attr] ?? "").toLowerCase();
  const set = new Set((values ?? []).map(x => String(x).toLowerCase()));
  return v && set.has(v) ? 1 : 0;
});

REGISTRY.register("dom.text_contains_any", (cand, { terms }) => {
  const hay = [
    cand?.dom?.label_text,
    cand?.dom?.placeholder,
    cand?.dom?.aria_label,
    cand?.dom?.nearby_text,
    cand?.dom?.attrs?.name,
    cand?.dom?.attrs?.id
  ].filter(Boolean).join(" ").toLowerCase();
  return (terms ?? []).some(t => hay.includes(String(t).toLowerCase())) ? 1 : 0;
});

REGISTRY.register("dom.role_is", (cand, { role }) => {
  const r = String(cand?.dom?.role ?? "").toLowerCase();
  return r === String(role ?? "").toLowerCase() ? 1 : 0;
});

REGISTRY.register("dom.type_is", (cand, params = {}) => {
  const observed = cand?.dom?.type ?? cand?.dom?.attrs?.type;
  if (!observed) return 0;
  const target = params?.types ?? params?.type ?? [];
  const choices = Array.isArray(target) ? target : [target];
  const lower = String(observed).toLowerCase();
  return choices.some((value) => String(value ?? "").toLowerCase() === lower) ? 1 : 0;
});

// Vision evaluator placeholder (expects OCR tokens pre-extracted)
REGISTRY.register("vision.ocr_nearby_contains", (cand, { terms }) => {
  const ocr = (cand?.vision?.ocr_nearby ?? []).join(" ").toLowerCase();
  return (terms ?? []).some(t => ocr.includes(String(t).toLowerCase())) ? 1 : 0;
});

export function evalSignal(sig, cand) {
  return REGISTRY.eval(sig.evaluator, cand, sig.params ?? {});
}
