import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const positives = [
  {
    name: "autocomplete-rich payment",
    html: `
      <form>
        <label for="cc-name">Name on card</label>
        <input id="cc-name" autocomplete="cc-name" />
        <label for="cc-number">Card number</label>
        <input id="cc-number" inputmode="numeric" autocomplete="cc-number" />
        <label for="cc-exp">Expiration date</label>
        <input id="cc-exp" autocomplete="cc-exp" />
        <label for="cc-csc">Security code</label>
        <input id="cc-csc" autocomplete="cc-csc" />
        <button type="submit">Pay now</button>
      </form>
    `
  },
  {
    name: "placeholder/label-only payment",
    html: `
      <form>
        <label>Cardholder name <input name="cardholder" placeholder="Name on card"></label>
        <label>Card number <input name="pan" placeholder="Card number" inputmode="numeric"></label>
        <label>Expiry <input name="exp" placeholder="MM/YY"></label>
        <label>CVV <input name="cvc" placeholder="CVV"></label>
        <button type="submit">Complete purchase</button>
      </form>
    `
  },
  {
    name: "checkout with Place Order CTA",
    html: `
      <form id="checkout">
        <input name="name" autocomplete="cc-name" aria-label="Name on card" />
        <input name="number" autocomplete="cc-number" aria-label="Card number" />
        <input name="expiry" autocomplete="cc-exp" aria-label="Expiration" />
        <input name="cvv" autocomplete="cc-csc" aria-label="CVV" />
        <button type="submit">Place order</button>
      </form>
    `
  }
];

const negatives = [
  {
    name: "shipping address form",
    html: `
      <form>
        <label for="name">Full name</label>
        <input id="name" autocomplete="name" />
        <label for="line1">Address</label>
        <input id="line1" autocomplete="address-line1" />
        <label for="city">City</label>
        <input id="city" autocomplete="address-level2" />
        <label for="zip">ZIP</label>
        <input id="zip" autocomplete="postal-code" />
        <button type="submit">Ship here</button>
      </form>
    `
  },
  {
    name: "login form",
    html: `
      <form>
        <label for="email">Email</label>
        <input id="email" autocomplete="email" />
        <label for="password">Password</label>
        <input id="password" type="password" autocomplete="current-password" />
        <button type="submit">Sign in</button>
      </form>
    `
  },
  {
    name: "donation amount form",
    html: `
      <form>
        <label for="amount">Donation amount</label>
        <input id="amount" name="amount" inputmode="decimal" />
        <button type="submit">Donate</button>
      </form>
    `
  }
];

describe("payment detection regression fixtures", () => {
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
      expect(body.form_type).toBe("payment");
      expect(body.pattern_id).toBe("pattern:payment@1.0.0");
      expect(body.required.missing).toEqual([]);
      expect(body.fields.map((field) => field.type)).toEqual(
        expect.arrayContaining(["card_name", "card_number", "card_expiry", "card_cvv", "submit"])
      );
    });
  }

  for (const fixture of negatives) {
    it(`does not classify ${fixture.name} as payment`, async () => {
      const res = await app.inject({ method: "POST", url: "/cpms/detect_form", payload: { html: fixture.html } });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.form_type).not.toBe("payment");
    });
  }
});
