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
  let rows;

  beforeEach(async () => {
    rows = { concept: [], pattern: [], feedback: [] };
    store = {
      append: vi.fn((kind, row) => {
        rows[kind] ??= [];
        rows[kind].push(row);
      }),
      list: vi.fn((kind) => rows[kind] ?? []),
      latestByUuid: vi.fn((kind, uuid) => [...(rows[kind] ?? [])].reverse().find((row) => row.uuid === uuid) ?? null),
      latestById: vi.fn((kind, id) => [...(rows[kind] ?? [])].reverse().find((row) => objectId(row, kind) === id || row.uuid === id) ?? null)
    };
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

  it("creates, lists, gets, and patches concepts", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/cpms/concepts",
      payload: { concept: emailConcept }
    });
    expect(createRes.statusCode).toBe(200);
    expect(createRes.json().concept.concept_id).toBe(emailConcept.concept_id);

    const listRes = await app.inject({ method: "GET", url: "/cpms/concepts" });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().concepts.map((concept) => concept.concept_id)).toContain(emailConcept.concept_id);

    const getRes = await app.inject({ method: "GET", url: `/cpms/concepts/${encodeURIComponent(emailConcept.concept_id)}` });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().concept.concept_id).toBe(emailConcept.concept_id);

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/cpms/concepts/${encodeURIComponent(emailConcept.concept_id)}`,
      payload: { patch: { meta: { owner: "test" } } }
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().concept.meta.owner).toBe("test");
  });

  it("creates, lists, gets, and patches patterns", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/cpms/patterns",
      payload: { pattern: loginPattern }
    });
    expect(createRes.statusCode).toBe(200);

    const listRes = await app.inject({ method: "GET", url: "/cpms/patterns" });
    expect(listRes.json().patterns.map((pattern) => pattern.pattern_id)).toContain(loginPattern.pattern_id);

    const getRes = await app.inject({ method: "GET", url: `/cpms/patterns/${encodeURIComponent(loginPattern.pattern_id)}` });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().pattern.pattern_id).toBe(loginPattern.pattern_id);

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/cpms/patterns/${encodeURIComponent(loginPattern.pattern_id)}`,
      payload: { patch: { strategy: { top_k: 7 } } }
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().pattern.strategy.top_k).toBe(7);
  });

  it("builds observations from HTML and mobile trees", async () => {
    const htmlRes = await app.inject({
      method: "POST",
      url: "/cpms/observations/from_html",
      payload: {
        url: "https://example.test/login",
        html: "<label for='email'>Email</label><input id='email' autocomplete='email'>"
      }
    });
    expect(htmlRes.statusCode).toBe(200);
    expect(htmlRes.json().observation.page_id).toBe("https://example.test/login");
    expect(htmlRes.json().observation.candidates[0].dom.attrs.id).toBe("email");

    const mobileRes = await app.inject({
      method: "POST",
      url: "/cpms/observations/from_mobile_tree",
      payload: {
        url: "app://login",
        tree: {
          class: "android.widget.LinearLayout",
          children: [
            { resource_id: "com.example:id/email", class: "android.widget.EditText", text: "Email" },
            { resource_id: "com.example:id/sign_in", class: "android.widget.Button", text: "Sign in", clickable: true }
          ]
        }
      }
    });
    expect(mobileRes.statusCode).toBe(200);
    const mobileObservation = mobileRes.json().observation;
    expect(mobileObservation.page_id).toBe("app://login");
    expect(mobileObservation.candidates.map((candidate) => candidate.mobile.resource_id)).toEqual([
      "com.example:id/email",
      "com.example:id/sign_in"
    ]);
  });

  it("records feedback and promotes revisions", async () => {
    await app.inject({ method: "POST", url: "/cpms/concepts", payload: { concept: { ...emailConcept, status: "draft" } } });

    const feedbackRes = await app.inject({
      method: "POST",
      url: "/cpms/feedback",
      payload: {
        target_id: emailConcept.concept_id,
        feedback: { type: "human_confirmed", candidate_id: "cand_email" }
      }
    });
    expect(feedbackRes.statusCode).toBe(200);
    expect(feedbackRes.json().feedback.target_id).toBe(emailConcept.concept_id);

    const promoteRes = await app.inject({
      method: "POST",
      url: "/cpms/revisions/promote",
      payload: { kind: "concept", id: emailConcept.concept_id }
    });
    expect(promoteRes.statusCode).toBe(200);
    expect(promoteRes.json().active.status).toBe("active");
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

  it("detects a varied login form from HTML", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cpms/detect_form",
      payload: {
        html: `
          <main>
            <label for="account">Account email</label>
            <input id="account" name="identifier" type="email" autocomplete="email" />
            <label>Password <input name="pw" type="password" autocomplete="current-password" /></label>
            <input type="submit" value="Continue" />
          </main>
        `
      }
    });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload.form_type).toBe("login");
    expect(payload.pattern_id).toBe("pattern:login@1.0.0");
    expect(payload.fields.map(field => field.type)).toEqual(expect.arrayContaining(["email", "password", "submit"]));
    expect(payload.fields.find(field => field.type === "email").selector).toBe("#account");
  });

  it("detects payment forms by comparing built-in patterns", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cpms/detect_form",
      payload: {
        html: `
          <form>
            <label for="cc-name">Name on card</label>
            <input id="cc-name" autocomplete="cc-name" />
            <label for="cc-number">Card number</label>
            <input id="cc-number" inputmode="numeric" autocomplete="cc-number" />
            <label for="cc-exp">Expiration date</label>
            <input id="cc-exp" autocomplete="cc-exp" />
            <label for="cc-csc">CVV</label>
            <input id="cc-csc" autocomplete="cc-csc" />
            <button type="submit">Complete purchase</button>
          </form>
        `
      }
    });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload.form_type).toBe("payment");
    expect(payload.pattern_id).toBe("pattern:payment@1.0.0");
    expect(payload.fields.map(field => field.type)).toEqual(expect.arrayContaining([
      "card_name",
      "card_number",
      "card_expiry",
      "card_cvv",
      "submit"
    ]));
  });

  it("detects app-style forms from dom_snapshot without HTML", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cpms/detect_form",
      payload: {
        dom_snapshot: {
          role: "window",
          children: [
            { role: "textbox", name: "Email", attrs: { autocomplete: "email" } },
            { role: "textbox", name: "Password", attrs: { type: "password", autocomplete: "current-password" } },
            { role: "button", name: "Sign in" }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload.form_type).toBe("login");
    expect(payload.fields.map(field => field.type)).toEqual(expect.arrayContaining(["email", "password", "submit"]));
  });
});

function objectId(row, kind) {
  if (kind === "concept") return row.concept_id ?? row.labels?.[0] ?? row.uuid ?? null;
  if (kind === "pattern") return row.pattern_id ?? row.labels?.[0] ?? row.uuid ?? null;
  return row.id ?? row.uuid ?? null;
}
