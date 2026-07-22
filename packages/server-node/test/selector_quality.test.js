import * as cheerio from "cheerio";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const GENERIC_SELECTORS = new Set(["input", "button", "input, textarea, select, button"]);

describe("detect_form selector quality for agent fill", () => {
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

  it("prefers stable id/name/data-testid over type-only selectors", async () => {
    const html = `
      <form>
        <label for="login-email">Email</label>
        <input id="login-email" data-testid="email-input" name="email" type="email" autocomplete="email" />
        <label for="login-password">Password</label>
        <input id="login-password" data-testid="password-input" name="password" type="password" autocomplete="current-password" />
        <button type="submit" data-testid="login-submit">Sign in</button>
      </form>
    `;
    const res = await app.inject({ method: "POST", url: "/cpms/detect_form", payload: { html } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.form_type).toBe("login");

    const email = body.fields.find((f) => f.type === "email");
    const password = body.fields.find((f) => f.type === "password");
    const submit = body.fields.find((f) => f.type === "submit");

    expect(email.selector).toBe('input[data-testid="email-input"]');
    expect(password.selector).toBe('input[data-testid="password-input"]');
    expect(submit.selector).toBe('button[data-testid="login-submit"]');
    expect(GENERIC_SELECTORS.has(email.selector)).toBe(false);
    expect(GENERIC_SELECTORS.has(password.selector)).toBe(false);
  });

  it("returns selectors that uniquely resolve in the source HTML", async () => {
    const html = `
      <form>
        <label for="account">Account email</label>
        <input id="account" name="identifier" type="email" autocomplete="email" />
        <label for="secret">Password</label>
        <input id="secret" name="pw" type="password" autocomplete="current-password" />
        <button id="go" type="submit">Continue</button>
      </form>
    `;
    const res = await app.inject({ method: "POST", url: "/cpms/detect_form", payload: { html } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.form_type).toBe("login");

    const $ = cheerio.load(html);
    for (const field of body.fields) {
      expect(GENERIC_SELECTORS.has(field.selector)).toBe(false);
      const matches = $(field.selector);
      expect(matches.length, `selector ${field.selector} for ${field.type}`).toBe(1);
    }
  });

  it("avoids generic fallbacks when autocomplete attributes exist", async () => {
    const html = `
      <form>
        <input autocomplete="email" aria-label="Email" />
        <input type="password" autocomplete="current-password" aria-label="Password" />
        <button type="submit">Log in</button>
      </form>
    `;
    const res = await app.inject({ method: "POST", url: "/cpms/detect_form", payload: { html } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.form_type).toBe("login");
    for (const field of body.fields.filter((f) => f.type !== "submit")) {
      expect(GENERIC_SELECTORS.has(field.selector)).toBe(false);
      expect(field.selector.includes("autocomplete") || field.selector.includes("aria-label")).toBe(true);
    }
  });
});
