import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";

const emailConcept = {
  concept_id: "concept:email@1.0.0",
  signals: [
    { signal_id: "ac", evaluator: "dom.attr_in", params: { attr: "autocomplete", values: ["email"] }, mode: "bayes", llr_when_true: 2, llr_when_false: 0 },
    { signal_id: "terms", evaluator: "dom.text_contains_any", params: { terms: ["email"] }, mode: "fuzzy", weight: 1.2 }
  ],
  resolution: { score_model: { type: "hybrid_logit", prior_logit: -1, epsilon: 1e-4, calibration: "sigmoid" }, decision: { policy: "winner_take_all", min_conf: 0.6, min_margin: 0.05, confirm_threshold: 0.8 } }
};

const passwordConcept = {
  concept_id: "concept:password@1.0.0",
  signals: [
    { signal_id: "ac", evaluator: "dom.attr_in", params: { attr: "autocomplete", values: ["current-password", "password"] }, mode: "bayes", llr_when_true: 2.5, llr_when_false: 0 },
    { signal_id: "terms", evaluator: "dom.text_contains_any", params: { terms: ["password", "passcode"] }, mode: "fuzzy", weight: 1.0 }
  ],
  resolution: { score_model: { type: "hybrid_logit", prior_logit: -1, epsilon: 1e-4, calibration: "sigmoid" }, decision: { policy: "winner_take_all", min_conf: 0.6, min_margin: 0.05, confirm_threshold: 0.8 } }
};

const loginPattern = {
  pattern_id: "pattern:login@1.0.0",
  includes: [emailConcept.concept_id, passwordConcept.concept_id],
  strategy: { type: "greedy_repair", top_k: 3, max_repairs: 5 }
};

const loginObservation = {
  page_id: "fixture:login",
  candidates: [
    { candidate_id: "cand_email", dom: { attrs: { autocomplete: "email", name: "email" }, label_text: "Email" } },
    { candidate_id: "cand_pass", dom: { attrs: { autocomplete: "current-password", name: "password" }, label_text: "Password" } }
  ]
};

describe("server-node API", () => {
  let app;
  let store;
  let graphStore;

  beforeEach(async () => {
    store = { append: vi.fn(), latestByUuid: vi.fn() };
    graphStore = { persistConcept: vi.fn().mockResolvedValue({ ok: true, mode: "file" }) };
    app = await buildApp({ logger: false, store, graphStore });
  });

  afterEach(async () => {
    await app.close();
  });

  it("responds to health checks", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("matches a concept", async () => {
    const res = await app.inject({ method: "POST", url: "/cpms/match", payload: { concept: emailConcept, observation: loginObservation } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.best.candidate_id).toBe("cand_email");
  });

  it("returns schema language + template", async () => {
    const res = await app.inject({ method: "GET", url: "/cpms/schema/concepts/language" });
    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload.schema.allowed_evaluators.length).toBeGreaterThan(0);
    expect(payload.template.kind).toBe("cpms.concept");
  });

  it("templates and persists concepts with lint report", async () => {
    const templateRes = await app.inject({
      method: "POST",
      url: "/cpms/schema/concepts/template",
      payload: { labels: ["concept:test@1.0.0"], prototype_of: "type:test" }
    });
    expect(templateRes.statusCode).toBe(200);
    const { template } = templateRes.json();

    const persistRes = await app.inject({
      method: "POST",
      url: "/cpms/schema/concepts/persist",
      payload: { concept: template }
    });
    expect(persistRes.statusCode).toBe(200);
    const body = persistRes.json();
    expect(body.ok).toBe(true);
    expect(store.append).toHaveBeenCalledWith("concept", expect.objectContaining({ uuid: template.uuid }));
    expect(graphStore.persistConcept).toHaveBeenCalled();
  });

  it("matches a pattern and assigns both concepts", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cpms/match_pattern",
      payload: { pattern: loginPattern, concepts: [emailConcept, passwordConcept], observation: loginObservation }
    });
    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload.result.assigned[emailConcept.concept_id]).toBe("cand_email");
    expect(payload.result.assigned[passwordConcept.concept_id]).toBe("cand_pass");
  });
});
