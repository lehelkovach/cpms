# ADR 0001: Confidence semantics for CPMS matching

Date: 2025-12-16  
Status: Accepted  
Author: Lehel Kovach

Decision gating uses **margin + min_conf**; UX uses **confirm_threshold**:
- accepted if best.p ≥ min_conf AND (best.p - runner_up.p) ≥ min_margin
- needs_user_confirmation if !accepted OR best.p < confirm_threshold (default 0.90)
