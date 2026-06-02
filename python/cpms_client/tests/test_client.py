import io
import json
import unittest
from urllib import error as urlerror

from cpms_client import CpmsClient


class FakeResponse:
    def __init__(self, payload, status=200):
        self.payload = payload
        self.status = status

    def read(self):
        return json.dumps(self.payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


class ClientTests(unittest.TestCase):
    def test_match_sends_payload_and_returns_result(self):
        captured = {}

        def opener(req, timeout=None):
            captured["url"] = req.full_url
            captured["method"] = req.get_method()
            captured["body"] = json.loads(req.data.decode("utf-8"))
            return FakeResponse({"result": {"best": {"candidate_id": "cand_email"}}})

        client = CpmsClient(base_url="http://localhost:9999", opener=opener)
        result = client.match({"concept_id": "concept:email@1.0.0"}, {"candidates": []})

        self.assertTrue(captured["url"].endswith("/cpms/match"))
        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["body"]["concept"]["concept_id"], "concept:email@1.0.0")
        self.assertEqual(result["result"]["best"]["candidate_id"], "cand_email")

    def test_http_error_is_wrapped(self):
        def opener(req, timeout=None):
            raise urlerror.HTTPError(req.full_url, 400, "bad request", hdrs=None, fp=io.BytesIO(b"boom"))

        client = CpmsClient(opener=opener)
        with self.assertRaises(RuntimeError) as ctx:
            client.match({}, {})

        self.assertIn("HTTP 400", str(ctx.exception))
        self.assertIn("boom", str(ctx.exception))

    def test_detect_form_sends_html_and_optional_snapshot(self):
        captured = {}

        def opener(req, timeout=None):
            captured["url"] = req.full_url
            captured["method"] = req.get_method()
            captured["body"] = json.loads(req.data.decode("utf-8"))
            return FakeResponse({"form_type": "login", "fields": []})

        client = CpmsClient(base_url="http://localhost:9999", opener=opener)
        result = client.detect_form("<form></form>", url="https://example.test", dom_snapshot={"role": "window"})

        self.assertTrue(captured["url"].endswith("/cpms/detect_form"))
        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["body"]["html"], "<form></form>")
        self.assertEqual(captured["body"]["url"], "https://example.test")
        self.assertEqual(captured["body"]["dom_snapshot"]["role"], "window")
        self.assertEqual(result["form_type"], "login")

    def test_concept_crud_methods_encode_ids_and_payloads(self):
        calls = []

        def opener(req, timeout=None):
            body = json.loads(req.data.decode("utf-8")) if req.data else None
            calls.append((req.get_method(), req.full_url, body))
            return FakeResponse({"ok": True, "concept": body.get("concept") if body else {"concept_id": "concept:email@1.0.0"}})

        client = CpmsClient(base_url="http://localhost:9999", opener=opener)
        client.list_concepts()
        client.get_concept("concept:email@1.0.0")
        client.create_concept({"concept_id": "concept:email@1.0.0"})
        client.patch_concept("concept:email@1.0.0", {"meta": {"owner": "test"}})

        self.assertEqual(calls[0][0], "GET")
        self.assertTrue(calls[0][1].endswith("/cpms/concepts"))
        self.assertTrue(calls[1][1].endswith("/cpms/concepts/concept%3Aemail%401.0.0"))
        self.assertEqual(calls[2][2]["concept"]["concept_id"], "concept:email@1.0.0")
        self.assertEqual(calls[3][0], "PATCH")
        self.assertEqual(calls[3][2]["patch"]["meta"]["owner"], "test")

    def test_pattern_observation_feedback_and_revision_methods(self):
        calls = []

        def opener(req, timeout=None):
            body = json.loads(req.data.decode("utf-8")) if req.data else None
            calls.append((req.get_method(), req.full_url, body))
            return FakeResponse({"ok": True})

        client = CpmsClient(base_url="http://localhost:9999", opener=opener)
        client.create_pattern({"pattern_id": "pattern:login@1.0.0"})
        client.patch_pattern("pattern:login@1.0.0", {"strategy": {"top_k": 7}})
        client.observation_from_html("<form></form>", url="https://example.test")
        client.observation_from_mobile_tree({"class": "android.widget.Button"}, url="app://login")
        client.send_feedback("concept:email@1.0.0", {"type": "human_confirmed"})
        client.promote_revision("concept", id="concept:email@1.0.0")

        self.assertTrue(calls[1][1].endswith("/cpms/patterns/pattern%3Alogin%401.0.0"))
        self.assertEqual(calls[2][1], "http://localhost:9999/cpms/observations/from_html")
        self.assertEqual(calls[2][2]["html"], "<form></form>")
        self.assertEqual(calls[3][2]["tree"]["class"], "android.widget.Button")
        self.assertEqual(calls[4][2]["feedback"]["type"], "human_confirmed")
        self.assertEqual(calls[5][2]["kind"], "concept")
        self.assertEqual(calls[5][2]["id"], "concept:email@1.0.0")


if __name__ == "__main__":
    unittest.main()
