export function winnerTakeAll(concept, scored) {
  const d = concept.resolution.decision ?? {};
  const min_conf = d.min_conf ?? 0;
  const min_margin = d.min_margin ?? 0;
  const confirm_threshold = d.confirm_threshold ?? 0.90;

  const sorted = [...scored].sort((a, b) => b.p - a.p);
  const best = sorted[0];
  const second = sorted[1];
  const margin = best && second ? best.p - second.p : (best ? best.p : 0);

  const accepted = !!best && best.p >= min_conf && margin >= min_margin;
  const needs_user_confirmation = !accepted || (best?.p ?? 0) < confirm_threshold;

  return {
    accepted,
    needs_user_confirmation,
    best: best ? { candidate_id: best.id, p: best.p } : null,
    runner_up: second ? { candidate_id: second.id, p: second.p } : null,
    margin,
    ranked: sorted
  };
}
