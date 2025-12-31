"""
Minimal Python wrapper for the CPMS HTTP API.
"""
from urllib import request as urlrequest, error as urlerror
import json

__all__ = ["CpmsClient"]


class CpmsClient:
    """Simple HTTP client for the CPMS API."""

    def __init__(self, base_url="http://localhost:8787", timeout=5, opener=None):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._opener = opener or urlrequest.urlopen

    def _full_url(self, path):
        if not path.startswith("/"):
            path = f"/{path}"
        return f"{self.base_url}{path}"

    def _request(self, method, path, payload=None):
        url = self._full_url(path)
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"content-type": "application/json"}
        req = urlrequest.Request(url, data=data, headers=headers, method=method)
        try:
            with self._opener(req, timeout=self.timeout) as resp:
                raw = resp.read()
                return json.loads(raw.decode("utf-8")) if raw else {}
        except urlerror.HTTPError as err:
            detail = err.read().decode("utf-8") if hasattr(err, "read") else ""
            raise RuntimeError(f"CPMS HTTP {err.code}: {detail or err.reason}") from err
        except urlerror.URLError as err:
            raise RuntimeError(f"CPMS request failed: {err.reason}") from err

    def match(self, concept, observation):
        return self._request("POST", "/cpms/match", {"concept": concept, "observation": observation})

    def match_explain(self, concept, observation):
        return self._request("POST", "/cpms/match_explain", {"concept": concept, "observation": observation})

    def match_pattern(self, pattern, concepts, observation):
        return self._request("POST", "/cpms/match_pattern", {"pattern": pattern, "concepts": concepts, "observation": observation})

    def schema_language(self):
        return self._request("GET", "/cpms/schema/concepts/language")

    def concept_template(self, intent=None):
        return self._request("POST", "/cpms/schema/concepts/template", intent or {})

    def persist_concept(self, concept):
        return self._request("POST", "/cpms/schema/concepts/persist", {"concept": concept})

    def draft_concept(self, intent=None):
        return self._request("POST", "/cpms/concepts/draft", intent or {})

    def draft_pattern(self, intent=None):
        return self._request("POST", "/cpms/patterns/draft", intent or {})

    def activate(self, kind, uuid):
        return self._request("POST", "/cpms/activate", {"kind": kind, "uuid": uuid})
