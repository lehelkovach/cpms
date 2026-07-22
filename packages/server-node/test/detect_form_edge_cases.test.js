import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("detect_form edge cases for agent fill safety", () => {
  let app;

  beforeEach(async () => {
    app = await buildApp({
      logger: false,
      store: { append() {}, latestByUuid() {} },
      graphStore: { async persistConcept() { return { ok: true, mode: "test" }; } }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 400 when html, observation, and dom_snapshot are all missing", async () => {
    const res = await app.inject({ method: "POST", url: "/cpms/detect_form", payload: { url: "https://example.com" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBeTruthy();
  });

  it("returns form_type unknown when password is missing from a login-like page", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cpms/detect_form",
      payload: {
        html: `
          <form>
            <label for="email">Email</label>
            <input id="email" autocomplete="email" />
            <button type="submit">Continue</button>
          </form>
        `
      }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.form_type).toBe("unknown");
    expect(body.required.missing.length).toBeGreaterThan(0);
  });

  it("prefers payment over login when both patterns could partially apply", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cpms/detect_form",
      payload: {
        html: `
          <form>
            <label for="email">Receipt email</label>
            <input id="email" autocomplete="email" />
            <label for="cc-name">Name on card</label>
            <input id="cc-name" autocomplete="cc-name" />
            <label for="cc-number">Card number</label>
            <input id="cc-number" autocomplete="cc-number" />
            <label for="cc-exp">Expiry</label>
            <input id="cc-exp" autocomplete="cc-exp" />
            <label for="cc-csc">CVV</label>
            <input id="cc-csc" autocomplete="cc-csc" />
            <button type="submit">Pay</button>
          </form>
        `
      }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.form_type).toBe("payment");
    expect(body.pattern_id).toBe("pattern:payment@1.0.0");
  });

  it("accepts a prebuilt observation and skips HTML parsing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cpms/detect_form",
      payload: {
        observation: {
          page_id: "fixture:prebuilt-login",
          candidates: [
            {
              candidate_id: "cand_email",
              dom: { tag: "input", attrs: { id: "e1", autocomplete: "email", name: "email" }, label_text: "Email" }
            },
            {
              candidate_id: "cand_pass",
              dom: {
                tag: "input",
                attrs: { id: "p1", type: "password", autocomplete: "current-password", name: "password" },
                label_text: "Password"
              }
            },
            {
              candidate_id: "cand_btn",
              dom: { tag: "button", attrs: { type: "submit" }, text: "Sign in" }
            }
          ]
        }
      }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.form_type).toBe("login");
    expect(body.fields.map((f) => f.type)).toEqual(expect.arrayContaining(["email", "password", "submit"]));
  });

  it("does not steal newsletter email when a login form is also present", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cpms/detect_form",
      payload: {
        html: `
          <form id="newsletter">
            <label for="nl">Newsletter</label>
            <input id="nl" name="newsletter" autocomplete="email" />
            <button type="submit">Subscribe</button>
          </form>
          <form id="login">
            <label for="email">Email</label>
            <input id="email" name="email" autocomplete="email" />
            <label for="password">Password</label>
            <input id="password" type="password" autocomplete="current-password" />
            <button type="submit">Sign in</button>
          </form>
        `
      }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.form_type).toBe("login");
    const emailField = body.fields.find((f) => f.type === "email");
    expect(emailField?.selector).toBe("#email");
    expect(emailField?.selector).not.toBe("#nl");
  });
});
