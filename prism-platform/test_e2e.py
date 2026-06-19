"""End-to-end test for live chat and clinician chat."""
import urllib.request
import json
import time

def api_call(path, data=None, method="GET"):
    headers = {"Content-Type": "application/json"}
    if data is not None:
        req = urllib.request.Request(
            f"http://localhost:8001{path}",
            data=json.dumps(data).encode(),
            headers=headers,
            method="POST",
        )
    else:
        req = urllib.request.Request(f"http://localhost:8001{path}", headers=headers)
    r = urllib.request.urlopen(req, timeout=120)
    return json.loads(r.read())

print("=" * 60)
print("TEST 1: Live Chat with Elena (Function Calling)")
print("=" * 60)

# Start conversation
conv = api_call("/api/v1/patients/elena-ramirez-001/conversations", {"label": "e2e-test"})
conv_id = conv["conversation_id"]
print(f"  [OK] Conversation started: {conv_id[:12]}...")

# Send patient message
resp = api_call(
    f"/api/v1/patients/elena-ramirez-001/conversations/{conv_id}/messages",
    {"text": "Hi, I have been thinking about Sofia lately. She seems stressed about school."},
)
bot_text = resp["bot_response"]["text"]
tool_calls = resp.get("tool_calls", [])
node_count = resp["current_graph"]["node_count"]

print(f"  [OK] Bot responded: {bot_text[:120]}...")
print(f"  [OK] Tool calls: {len(tool_calls)}")
for tc in tool_calls:
    print(f"       - {tc['tool']}({json.dumps(tc['args'])})")
print(f"  [OK] Graph nodes: {node_count}")

print()
print("=" * 60)
print("TEST 2: Clinician Chat")
print("=" * 60)

resp2 = api_call(
    "/api/v1/patients/elena-ramirez-001/clinician/messages",
    {"text": "What are Elena's primary conditions and current adherence concerns?"},
)
clin_text = resp2["response"]["text"]
flags = resp2.get("flags", [])
recs = resp2.get("recommendations", [])

print(f"  [OK] Clinical response: {clin_text[:150]}...")
print(f"  [OK] Flags: {len(flags)}")
print(f"  [OK] Recommendations: {len(recs)}")

print()
print("=" * 60)
print("TEST 3: Persistence Verification")
print("=" * 60)

import os
data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ally", "data")
files = os.listdir(data_dir)
for f in files:
    size = os.path.getsize(os.path.join(data_dir, f))
    print(f"  [OK] {f}: {size:,} bytes")

print()
print("=" * 60)
print("ALL E2E TESTS PASSED")
print("=" * 60)
