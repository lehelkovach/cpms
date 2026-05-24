import { describe, it, expect } from "vitest";
import { matchPatternGreedyRepair } from "@lehelkovach/cpms-core";
import { buildObservationFromHtml, loadDefaultLoginPattern } from "../src/observationBuilder.js";

describe("server-node", () => {
  it("smokes the HTML to login-pattern path", () => {
    const observation = buildObservationFromHtml(`
      <label for="email">Email</label>
      <input id="email" autocomplete="email" />
      <label for="password">Password</label>
      <input id="password" type="password" autocomplete="current-password" />
      <button>Login</button>
    `);
    const { pattern, concepts } = loadDefaultLoginPattern();

    const result = matchPatternGreedyRepair(pattern, concepts, observation);

    expect(result.assigned["concept:email@1.0.0"]).toBeDefined();
    expect(result.assigned["concept:password@1.0.0"]).toBeDefined();
  });
});
