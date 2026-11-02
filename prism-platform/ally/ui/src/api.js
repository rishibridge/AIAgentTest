/**
 * Ally API Client — authenticated session-token client (C1, C2).
 */
const API_BASE = window.location.origin.includes('localhost:5173')
  ? 'http://127.0.0.1:8089'
  : '';

const TOKEN_STORAGE_KEY = 'ally_auth_token';
const ROLE_STORAGE_KEY = 'ally_auth_role';

export function getAuthToken() {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function getSessionRole() {
  try {
    return sessionStorage.getItem(ROLE_STORAGE_KEY) || 'user';
  } catch {
    return 'user';
  }
}

export const getAuthRole = getSessionRole;

export function setAuthSession(token, role = 'user') {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      sessionStorage.setItem(ROLE_STORAGE_KEY, role);
      sessionStorage.setItem('prism_terms_accepted', 'true');
    }
  } catch {
    // ignore storage errors
  }
}

export async function acceptTerms(adminKey = null) {
  const payload = { accepted: true };
  if (adminKey) payload.admin_key = adminKey;
  const res = await fetch(`${API_BASE}/api/v1/auth/accept-terms`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Terms auth failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  if (data.token) {
    setAuthSession(data.token, data.role || 'user');
  }
  return data;
}

export async function elevateAdmin(adminKey) {
  const data = await apiFetch('/api/v1/auth/elevate', {
    method: 'POST',
    body: JSON.stringify({ admin_key: adminKey }),
  });
  if (data.token) {
    setAuthSession(data.token, data.role || 'admin');
  }
  return data;
}

async function ensureAuthToken() {
  const existing = getAuthToken();
  if (existing) return existing;
  // If user already accepted terms in this browser session, refresh server token transparently
  try {
    if (sessionStorage.getItem('prism_terms_accepted') === 'true') {
      const auth = await acceptTerms();
      return auth.token || '';
    }
  } catch {
    // ignore
  }
  return '';
}

async function apiFetch(path, options = {}) {
  const token = await ensureAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'X-Ally-Token': token } : {}),
    ...(options.headers || {}),
  };

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  // Auto-reissue once if server restarted while browser tab still held terms acceptance
  if (res.status === 401 && sessionStorage.getItem('prism_terms_accepted') === 'true') {
    try {
      const refreshed = await acceptTerms();
      if (refreshed?.token) {
        res = await fetch(`${API_BASE}${path}`, {
          ...options,
          credentials: 'include',
          headers: { ...headers, 'X-Ally-Token': refreshed.token },
        });
      }
    } catch {
      // fall through to standard error handling
    }
  }

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

// ── Clinician Messages & Scribe ─────────────────────────────────────
export const sendClinicianMessage = (patientId, text) =>
  apiFetch(`/api/v1/patients/${patientId}/clinician/messages`, {
    method: 'POST', body: JSON.stringify({ text }),
  });

export const postVisitScribe = (patientId, transcript) =>
  apiFetch(`/api/v1/patients/${patientId}/clinician/post_visit`, {
    method: 'POST', body: JSON.stringify({ transcript }),
  });

export const getLatestHandoff = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/clinician/handoff`);

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

export const abandonConversation = (patientId, convId) => {
  if (!patientId || !convId) return Promise.resolve();
  const token = getAuthToken();
  return fetch(`${API_BASE}/api/v1/patients/${patientId}/conversations/${convId}/abandon`, {
    method: 'POST',
    keepalive: true,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Ally-Token': token } : {}),
    },
  }).catch(() => {});
};

// ── Graph, Snapshots, Ingest & Divergences ──────────────────────────
export const getGraph = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph`);

export const getGraphPositions = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/positions`);

export const getGraphSnapshots = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/snapshots`);

export const getSnapshot = (patientId, snapshotId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/snapshots/${snapshotId}`);

export const ingestDocument = (patientId, text, sourceName = 'Clinical Note') =>
  apiFetch(`/api/v1/patients/${patientId}/graph/ingest`, {
    method: 'POST',
    body: JSON.stringify({ text, source_name: sourceName }),
  });

export const getDivergences = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/divergences`);

export const addDivergence = (patientId, topic, claimANodeId, claimBNodeId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/divergences`, {
    method: 'POST',
    body: JSON.stringify({
      topic,
      claim_a_node_id: claimANodeId,
      claim_b_node_id: claimBNodeId,
    }),
  });

// ── Consolidation ───────────────────────────────────────────────────
export const getConsolidationSteps = (patientId = 'elena-ramirez-001') =>
  apiFetch(`/api/v1/patients/${patientId}/consolidation/steps`);

export const triggerConsolidation = (patientId, conversationId = null) =>
  apiFetch(`/api/v1/patients/${patientId}/consolidation`, {
    method: 'POST', body: JSON.stringify({ conversation_id: conversationId }),
  });

export const sweepConsolidation = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/consolidation/sweep`, { method: 'POST' });

// ── Handoffs & Hypothesis Lifecycle ─────────────────────────────────
export const generateHandoff = (patientId, recipientName, recipientRole, authNotes = '', force = false) =>
  apiFetch(`/api/v1/patients/${patientId}/handoffs`, {
    method: 'POST', body: JSON.stringify({
      recipient_name: recipientName,
      recipient_role: recipientRole,
      authorization_notes: authNotes,
      force,
    }),
  });

export const getHandoffs = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/handoffs`);

export const updateHypothesis = (patientId, handoffId, hypothesisId, status, clinicianName = 'Dr. A. Patel') =>
  apiFetch(`/api/v1/patients/${patientId}/handoffs/${handoffId}/hypotheses/${hypothesisId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, clinician_name: clinicianName }),
  });

// ── Graph Editing (Admin Protected) ─────────────────────────────────
export const deleteNode = (patientId, nodeId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/nodes/${nodeId}`, { method: 'DELETE' });

export const deleteEdge = (patientId, source, target) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/edges?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`, { method: 'DELETE' });

export const resetPatient = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/graph/reset`, { method: 'POST' });

// ── DDx Debate & Verdicts ───────────────────────────────────────────
export const getDebateStreamUrl = (patientId, topic, forModel, againstModel, judgeModel, maxRounds = 3) => {
  const token = getAuthToken();
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  return `${API_BASE}/api/v1/patients/${patientId}/debate/stream?topic=${encodeURIComponent(topic)}&for_model=${forModel}&against_model=${againstModel}&judge_model=${judgeModel}&max_rounds=${maxRounds}${tokenParam}`;
};

export const submitHumanTurn = (patientId, sessionId, role, text, scoreDelta, endDebate, winner) =>
  apiFetch(`/api/v1/patients/${patientId}/debate/human_turn`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, role, text, score_delta: scoreDelta, end_debate: endDebate, winner }),
  });

export const stopDebate = (patientId, sessionId) =>
  apiFetch(`/api/v1/patients/${patientId}/debate/stop?session_id=${sessionId}`, { method: 'POST' });

export const getDebateVerdicts = (patientId) =>
  apiFetch(`/api/v1/patients/${patientId}/debate/verdicts`);

export const recordDebateVerdict = (patientId, payload) =>
  apiFetch(`/api/v1/patients/${patientId}/debate/verdicts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
