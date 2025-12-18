// Lightweight “types” (JS doc shapes). Keep simple in v0.1.
export const RepKind = /** @type {const} */ ({
  DOM: "dom",
  VISION: "vision",
  TEXT: "text",
  HYBRID: "hybrid"
});

export const SignalMode = /** @type {const} */ ({
  FUZZY: "fuzzy",
  BAYES: "bayes"
});
