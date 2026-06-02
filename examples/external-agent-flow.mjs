import { matchPatternGreedyRepair, NoopMemoryAdapter } from "../packages/core/src/index.js";
import { buildObservationFromHtml, loadDefaultLoginPattern } from "../packages/server-node/src/observationBuilder.js";

const htmlSnapshot = `
  <form>
    <label for="agent-email">Email</label>
    <input id="agent-email" name="email" autocomplete="email" />
    <label for="agent-password">Password</label>
    <input id="agent-password" type="password" autocomplete="current-password" />
    <button type="submit">Sign in</button>
  </form>
`;

const observation = buildObservationFromHtml(htmlSnapshot, null, "https://example.test/login");
const { pattern, concepts } = loadDefaultLoginPattern();
const result = matchPatternGreedyRepair(pattern, concepts, observation);
const memory = new NoopMemoryAdapter();

for (const [concept_id, candidate_id] of Object.entries(result.assigned)) {
  await memory.emit({
    type: "concept.matched",
    concept_id,
    observation_id: observation.page_id,
    result: {
      candidate_id,
      pattern_id: pattern.pattern_id,
      accepted: true
    }
  });
}

const fieldAssignments = Object.entries(result.assigned).map(([concept_id, candidate_id]) => ({
  concept_id,
  candidate_id,
  candidate: observation.candidates.find((candidate) => candidate.candidate_id === candidate_id)
}));

console.log(JSON.stringify({
  flow: "HTML snapshot -> observation -> match login pattern -> field assignments -> memory events",
  pattern_id: pattern.pattern_id,
  assigned: fieldAssignments.map(({ concept_id, candidate_id }) => ({ concept_id, candidate_id })),
  memory_events: memory.events,
  note: "An external browser/mobile agent performs filling separately; CPMS only recognizes and explains assignments."
}, null, 2));
