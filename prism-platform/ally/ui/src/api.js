/**
 * Ally API Client — connects to the real backend at localhost:8001
 */
const API_BASE = window.location.origin.includes('localhost:5173') ? 'https://prism-platform-525536279111.us-central1.run.app' : '';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API Error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Patients ────────────────────────────────────────────────────────
export const getPatients = () => apiFetch('/api/v1/patients');
export const getPatient = (id) => apiFetch(`/api/v1/patients/${id}`);
export const createPatient = (data) => apiFetch('/api/v1/patients', {
  method: 'POST', body: JSON.stringify(data),
});
export const deletePatient = (id) => apiFetch(`/api/v1/patients/${id}`, { method: 'DELETE' });

// ── Clinician Messages ──────────────────────────────────────────────
export const sendClinicianMessage = (patientId, text) =>
  apiFetch(`/api/v1/patients/${patientId}/clinician/messages`, {
    method: 'POST', body: JSON.stringify({ text }),
  });

export const postVisitScribe = (patientId, transcript) =>
  apiFetch(`/api/v1/patients/${patientId}/clinician/post_visit`, {
    method: 'POST', body: JSON.stringify({ transcript }),
  });

// ── Conversations ───────────────────────────────────────────────────
export const startConversation = (patientId, label = '') =>
  apiFetch(`/api/v1/patients/${patientId}/conversations`, {
    method: 'POST', body: JSON.stringify({ label }),
  });

export const sendMessage = (patientId, convId, text, sender = null) =>
  apiFetch(`/api/v1/patients/${patientId}/conversations/${convId}/messages`, {
    method: 'POST', body: JSON.stringify({ text, sender }),
  });

export const getConversations = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/conversations`);

export const getConversation = (patientId, convId) =>
  apiFetch(`/api/v1/patients/${patientId}/conversations/${convId}`);

export const endConversation = (patientId, convId) =>
  apiFetch(`/api/v1/patients/${patientId}/conversations/${convId}/end`, { method: 'POST' });

// ── Graph ───────────────────────────────────────────────────────────
export const getGraph = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph`);

export const getGraphPositions = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/positions`);

export const getGraphSnapshots = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/snapshots`);

export const getSnapshot = (patientId, snapshotId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/snapshots/${snapshotId}`);

// ── Consolidation ───────────────────────────────────────────────────
export const getConsolidationSteps = () =>
  apiFetch('/api/v1/patients/steps/consolidation/steps');

export const triggerConsolidation = (patientId, conversationId = null) =>
  apiFetch(`/api/v1/patients/${patientId}/consolidation`, {
    method: 'POST', body: JSON.stringify({ conversation_id: conversationId }),
  });

// ── Clinician ───────────────────────────────────────────────────────
export const generateHandoff = (patientId, recipientName, recipientRole, authNotes = '') =>
  apiFetch(`/api/v1/patients/${patientId}/handoffs`, {
    method: 'POST', body: JSON.stringify({
      recipient_name: recipientName,
      recipient_role: recipientRole,
      authorization_notes: authNotes,
    }),
  });

export const getHandoffs = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/handoffs`);

// ── Graph Editing ───────────────────────────────────────────────────
export const deleteNode = (patientId, nodeId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/nodes/${nodeId}`, { method: 'DELETE' });

export const deleteEdge = (patientId, source, target) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/edges?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`, { method: 'DELETE' });

export const resetPatient = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/reset`, { method: 'POST' });

// ── DDx Debate ──────────────────────────────────────────────────────
export const getDebateStreamUrl = (patientId, topic, forModel, againstModel, judgeModel) =>
  `${API_BASE}/api/v1/patients/${patientId}/debate/stream?topic=${encodeURIComponent(topic)}&for_model=${forModel}&against_model=${againstModel}&judge_model=${judgeModel}`;

export const submitHumanTurn = (patientId, sessionId, role, text, scoreDelta, endDebate, winner) =>
  apiFetch(`/api/v1/patients/${patientId}/debate/human_turn`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, role, text, score_delta: scoreDelta, end_debate: endDebate, winner }),
  });

export const stopDebate = (patientId, sessionId) =>
  apiFetch(`/api/v1/patients/${patientId}/debate/stop?session_id=${sessionId}`, { method: 'POST' });
