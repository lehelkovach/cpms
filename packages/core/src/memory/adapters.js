export class MemoryAdapter {
  async emit(_event) {
    return { ok: true, skipped: true };
  }
}

export class NoopMemoryAdapter extends MemoryAdapter {
  constructor() {
    super();
    this.events = [];
  }

  async emit(event) {
    this.events.push(event);
    return { ok: true, mode: "noop" };
  }
}

export class NoShogoMemoryAdapter extends MemoryAdapter {
  constructor({ client = null, namespace = "cpms" } = {}) {
    super();
    this.client = client;
    this.namespace = namespace;
  }

  async emit(event) {
    const graphEvent = toNoShogoGraphEvent(event, this.namespace);
    if (!this.client?.writeEvent) {
      return { ok: true, mode: "stub", event: graphEvent };
    }
    await this.client.writeEvent(graphEvent);
    return { ok: true, mode: "noshogo" };
  }
}

export function toNoShogoGraphEvent(event, namespace = "cpms") {
  return {
    namespace,
    type: event.type,
    nodes: graphNodesForEvent(event),
    edges: graphEdgesForEvent(event),
    raw_event: event
  };
}

function graphNodesForEvent(event) {
  switch (event?.type) {
    case "concept.matched":
      return [
        { kind: "Concept", id: event.concept_id },
        { kind: "Observation", id: event.observation_id }
      ];
    case "pattern.matched":
      return [
        { kind: "Pattern", id: event.pattern_id },
        { kind: "Observation", id: event.observation_id }
      ];
    case "feedback.received":
      return [
        { kind: "Feedback", id: event.feedback?.feedback_id ?? event.target_id },
        { kind: "Concept", id: event.target_id }
      ];
    case "revision.created":
      return [
        { kind: "Revision", id: event.revision_id },
        { kind: "Concept", id: event.target_id }
      ];
    case "revision.promoted":
      return [
        { kind: "Revision", id: event.revision_id },
        { kind: "Concept", id: event.target_id }
      ];
    default:
      return [];
  }
}

function graphEdgesForEvent(event) {
  switch (event?.type) {
    case "concept.matched":
      return [{ type: "CANDIDATE_MATCHED_CONCEPT", from: event.observation_id, to: event.concept_id }];
    case "pattern.matched":
      return [{ type: "PATTERN_INCLUDES_CONCEPT", from: event.pattern_id, to: event.observation_id }];
    case "feedback.received":
      return [{ type: "FEEDBACK_SUPPORTS_REVISION", from: event.feedback?.feedback_id ?? event.target_id, to: event.target_id }];
    case "revision.created":
      return [{ type: "REVISION_SUPERSEDES_VERSION", from: event.revision_id, to: event.target_id }];
    case "revision.promoted":
      return [{ type: "REVISION_SUPERSEDES_VERSION", from: event.revision_id, to: event.target_id }];
    default:
      return [];
  }
}
