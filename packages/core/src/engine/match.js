import { scorePair } from "./scoring.js";
import { winnerTakeAll } from "./decision.js";

export function matchConcept(concept, obs) {
  const scored = (obs.candidates ?? []).map(c => ({ id: c.candidate_id, p: scorePair(concept, c) }));
  const policy = concept.resolution.decision?.policy ?? "winner_take_all";
  if (policy === "winner_take_all") return winnerTakeAll(concept, scored);
  const k = concept.resolution.decision?.top_k ?? 3;
  return scored.sort((a,b)=>b.p-a.p).slice(0, k);
}
