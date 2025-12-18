import { matchConceptExplain } from "./explain.js";

function topK(arr, k) {
  return [...arr].sort((a, b) => b.p - a.p).slice(0, k);
}

export function matchPatternGreedyRepair(pattern, concepts, obs) {
  const top_k = pattern.strategy?.top_k ?? 7;
  const max_repairs = pattern.strategy?.max_repairs ?? 10;

  const byId = new Map((concepts ?? []).map(c => [c.concept_id, c]));
  const conceptIds = pattern.includes ?? [];

  const rankings = conceptIds.map((cid) => {
    const c = byId.get(cid);
    if (!c) throw new Error(`Missing concept: ${cid}`);
    const ex = matchConceptExplain(c, obs);
    const ranked = topK(ex.candidates.map(x => ({ candidate_id: x.candidate_id, p: x.p })), top_k);
    const best = ranked[0];
    const second = ranked[1];
    const margin = best && second ? best.p - second.p : (best ? best.p : 0);
    return { concept_id: cid, ranked, bestP: best?.p ?? 0, margin, explain: ex };
  });

  rankings.sort((a, b) => (b.bestP - a.bestP) || (b.margin - a.margin));

  const assigned = {};
  const taken = new Set();

  const minConfOf = (cid) => (byId.get(cid)?.resolution?.decision?.min_conf ?? 0);

  for (const r of rankings) {
    const min_conf = minConfOf(r.concept_id);
    for (const x of r.ranked) {
      if (taken.has(x.candidate_id)) continue;
      if (x.p < min_conf) continue;
      assigned[r.concept_id] = x.candidate_id;
      taken.add(x.candidate_id);
      break;
    }
  }

  const repairTrace = [];
  let it = 0;

  const scoreOf = (cid, candId) => {
    const ex = rankings.find(rr => rr.concept_id === cid)?.explain;
    return ex?.candidates?.find(c => c.candidate_id === candId)?.p ?? 0;
  };

  while (it++ < max_repairs) {
    const unassigned = rankings.map(r => r.concept_id).filter(cid => !assigned[cid]);
    if (unassigned.length === 0) break;

    let changed = false;

    for (const cid of unassigned) {
      const r = rankings.find(rr => rr.concept_id === cid);
      if (!r) continue;

      const min_conf = minConfOf(cid);

      // free candidate
      const free = r.ranked.find(x => !taken.has(x.candidate_id) && x.p >= min_conf);
      if (free) {
        assigned[cid] = free.candidate_id;
        taken.add(free.candidate_id);
        repairTrace.push({ type: "assign_free", cid, cand: free.candidate_id, p: free.p });
        changed = true;
        continue;
      }

      // swap
      for (const wish of r.ranked) {
        const holder = Object.entries(assigned).find(([_, cnd]) => cnd === wish.candidate_id)?.[0];
        if (!holder) continue;

        const holderRank = rankings.find(rr => rr.concept_id === holder);
        if (!holderRank) continue;

        const holderMin = minConfOf(holder);
        const alt = holderRank.ranked.find(x => x.candidate_id !== wish.candidate_id && !taken.has(x.candidate_id) && x.p >= holderMin);
        if (!alt) continue;

        const current = scoreOf(holder, wish.candidate_id);
        const proposedHolder = scoreOf(holder, alt.candidate_id);
        const proposedThis = scoreOf(cid, wish.candidate_id);

        if (proposedThis + proposedHolder > current + 1e-4 && proposedThis >= min_conf) {
          assigned[holder] = alt.candidate_id;
          assigned[cid] = wish.candidate_id;
          taken.add(alt.candidate_id);
          repairTrace.push({ type: "swap", cid, takes: wish.candidate_id, holder, holder_to: alt.candidate_id });
          changed = true;
          break;
        }
      }
    }

    if (!changed) break;
  }

  const required = (pattern.constraints ?? [])
    .filter(c => c.type === "required_concepts")
    .flatMap(c => c.params?.ids ?? []);

  const missing_required = required.filter(cid => !assigned[cid]);
  const unassigned_final = rankings.map(r => r.concept_id).filter(cid => !assigned[cid]);

  return {
    pattern_id: pattern.pattern_id,
    assigned,
    unassigned: unassigned_final,
    trace: {
      rankings: rankings.map(r => ({ concept_id: r.concept_id, bestP: r.bestP, margin: r.margin, top: r.ranked })),
      repairs: repairTrace,
      missing_required
    }
  };
}
