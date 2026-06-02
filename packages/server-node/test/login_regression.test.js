import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const positives = [
  {
    name: "semantic HTML login",
    html: `
      <form>
        <label for="email">Email</label>
        <input id="email" name="email" autocomplete="email" />
        <label for="password">Password</label>
        <input id="password" type="password" autocomplete="current-password" />
        <button type="submit">Sign in</button>
      </form>
    `
  },
  {
    name: "Bootstrap login",
    html: `
      <form class="card">
        <div class="form-group">
          <label for="loginEmail">Email address</label>
          <input class="form-control" id="loginEmail" name="user_email" autocomplete="email">
        </div>
        <div class="form-group">
          <label for="loginPassword">Password</label>
          <input class="form-control" id="loginPassword" type="password" autocomplete="current-password">
        </div>
        <button class="btn btn-primary">Log in</button>
      </form>
    `
  },
  {
    name: "generated class names",
    html: `
      <section>
        <label for="mui-42">Account</label>
        <input id="mui-42" class="css-a91x7" name="account_login" autocomplete="username">
        <label for="mui-43">Passcode</label>
        <input id="mui-43" class="css-b13q9" name="pwd" type="password">
        <button class="css-c24z0">Continue</button>
      </section>
    `
  },
  {
    name: "placeholder-only login",
    html: `
      <form>
        <input name="identifier" placeholder="E-mail or username" autocomplete="username">
        <input name="secret" placeholder="Password" type="password" autocomplete="current-password">
        <input type="submit" value="Login">
      </form>
    `
  },
  {
    name: "ARIA-only login",
    html: `
      <form>
        <input aria-label="User name" autocomplete="username">
        <input aria-label="Password" type="password">
        <button aria-label="Sign in"></button>
      </form>
    `
  }
];

const negatives = [
  {
    name: "newsletter signup",
    html: `
      <form>
        <label for="newsletter-email">Email</label>
        <input id="newsletter-email" autocomplete="email">
        <button>Subscribe</button>
      </form>
    `
  },
  {
    name: "site search",
    html: `
      <form role="search">
        <label for="q">Search</label>
        <input id="q" name="q" type="search" placeholder="Search articles">
        <button>Search</button>
      </form>
    `
  },
  {
    name: "comment form",
    html: `
      <form>
        <label for="comment-name">Name</label>
        <input id="comment-name" name="name">
        <label for="comment-body">Comment</label>
        <textarea id="comment-body"></textarea>
        <button>Post comment</button>
      </form>
    `
  }
];

describe("login detection regression fixtures", () => {
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

  for (const fixture of positives) {
    it(`detects ${fixture.name}`, async () => {
      const res = await app.inject({ method: "POST", url: "/cpms/detect_form", payload: { html: fixture.html } });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.form_type).toBe("login");
      expect(body.required.missing).toEqual([]);
      expect(body.fields.map((field) => field.type)).toEqual(expect.arrayContaining(["email", "password"]));
    });
  }

  for (const fixture of negatives) {
    it(`does not classify ${fixture.name} as login`, async () => {
      const res = await app.inject({ method: "POST", url: "/cpms/detect_form", payload: { html: fixture.html } });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.form_type).not.toBe("login");
      expect(body.required?.missing ?? []).not.toEqual([]);
    });
  }
});
