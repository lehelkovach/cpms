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


if __name__ == "__main__":
    unittest.main()
