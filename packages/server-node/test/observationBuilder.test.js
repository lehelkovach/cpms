import { describe, expect, it } from "vitest";
import {
  buildObservationFromHtml,
  buildObservationFromMobileTree,
  loadDefaultLoginPattern,
  loadDefaultPatterns
} from "../src/observationBuilder.js";

describe("observationBuilder", () => {
  it("extracts labelled HTML form controls with hyphenated attributes", () => {
    const observation = buildObservationFromHtml(`
      <form>
        <label for="user-email">Email Address</label>
        <input id="user-email" name="login" type="email" aria-label="Work email" data-testid="email-field" autocomplete="email" />
        <label>Password <input name="secret" type="password" autocomplete="current-password" /></label>
        <input type="submit" value="Sign in" />
      </form>
    `);

    expect(observation.candidates).toHaveLength(3);
    expect(observation.candidates[0].dom.attrs).toMatchObject({
      id: "user-email",
      "aria-label": "Work email",
      "data-testid": "email-field"
    });
    expect(observation.candidates[0].dom.attrs.input).toBeUndefined();
    expect(observation.candidates[0].dom.label_text).toBe("Email Address");
    expect(observation.candidates[1].dom.label_text).toContain("Password");
    expect(observation.candidates[2].dom.role).toBe("button");
    expect(observation.candidates[2].dom.label_text).toBe("Sign in");
  });

  it("normalizes app-style DOM snapshots into form candidates", () => {
    const observation = buildObservationFromHtml("", null, "app://login", {
      role: "window",
      children: [
        { role: "textbox", name: "Email", attrs: { autocomplete: "email" } },
        { role: "textbox", name: "Password", attrs: { type: "password", autocomplete: "current-password" } },
        { role: "button", name: "Continue" }
      ]
    });

    expect(observation.page_id).toBe("app://login");
    expect(observation.candidates.map(candidate => candidate.dom.role)).toEqual(["textbox", "textbox", "button"]);
    expect(observation.candidates[0].dom.label_text).toBe("Email");
  });

  it("loads all built-in detection patterns", () => {
    expect(loadDefaultLoginPattern().pattern.pattern_id).toBe("pattern:login@1.0.0");
    expect(loadDefaultPatterns().map(({ pattern }) => pattern.pattern_id)).toEqual([
      "pattern:login@1.0.0",
      "pattern:payment@1.0.0"
    ]);
  });

  it("normalizes mobile tree nodes into mobile candidates", () => {
    const observation = buildObservationFromMobileTree({
      page_id: "mobile:login",
      children: [
        { resource_id: "app:id/user", class: "android.widget.EditText", text: "Email", input_type: "textEmailAddress" },
        { resource_id: "app:id/login", class: "android.widget.Button", text: "Sign in", clickable: true }
      ]
    });

    expect(observation.source).toBe("mobile_tree");
    expect(observation.candidates).toHaveLength(2);
    expect(observation.candidates[0].mobile.resource_id).toBe("app:id/user");
    expect(observation.candidates[0].a11y.role).toBe("textbox");
    expect(observation.candidates[1].a11y.role).toBe("button");
  });
});
