import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, AlertTriangle, Send, ChevronDown, ChevronRight, Lock, Brain, FileText, MessageCircle, Stethoscope, RefreshCw, Plus, History, Shield } from 'lucide-react';
import InteractiveGraph from './VirtualBrain';
import NodeDetailPanel from './NodeDetailPanel';
import DdxDebate from './DdxDebate';
import * as api from '../api';

const getCredibilityColor = (value) => {
  if (value >= 0.85) return '#4CAF50';
  if (value >= 0.75) return '#8BC34A';
  if (value >= 0.65) return '#FFC107';
  if (value >= 0.55) return '#FF9800';
  return '#E85D5D';
};

const cleanNodeLabel = (raw) => String(raw || '').replace(/\s+/g, ' ').trim();

const NON_DIAGNOSIS_LABEL_RE = /marco on prep|not on prep|prep\s*[—-]\s*none|hiv test \d+ months|initiated|irregular|marginal|overuse/i;
const SEEDABLE_DIAGNOSIS_RE = /^(depression|major depressive|anxiety|generalized anxiety|ptsd|bipolar|type 2 diabetes|diabetes|hypertension|obesity|chronic.*pain|adjustment disorder|adhd|substance)/i;

const getHypothesisText = (h) => {
  if (typeof h === 'string') return h;
  if (!h || typeof h !== 'object') return String(h || '');
  return h.text || h.hypothesis || h.statement || '';
};

const normalizeDivergence = (d) => {
  const claimA = d.claimA || d.claim_a || {};
  const claimB = d.claimB || d.claim_b || {};
  return {
    id: d.id || `${d.topic || 'div'}-${Math.random().toString(36).slice(2, 7)}`,
    topic: d.topic || 'Clinical Divergence',
    status: d.status || 'active',
    resolution: d.resolution || '',
    claimA: {
      node_id: claimA.node_id || '',
      text: claimA.text || 'Unspecified claim',
      source: claimA.source || 'Patient Record',
      credibility: typeof claimA.credibility === 'number' ? claimA.credibility : 0.75,
    },
    claimB: {
      node_id: claimB.node_id || '',
      text: claimB.text || 'Unspecified claim',
      source: claimB.source || 'Patient Record',
      credibility: typeof claimB.credibility === 'number' ? claimB.credibility : 0.75,
    },
  };
};

/**
 * Format a debate agent's structured JSON output into readable text.
 * Prism's ReasoningEngine returns structured objects — this converts them
 * to human-readable prose instead of dumping raw JSON.
 */
const formatDebateAgent = (data) => {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return String(data || '');

  const lines = [];

  const title = data.case_title || data.title || data.case_name || data.case?.title || '';
  const thesis = data.thesis_statement || data.opening_statement || data.case?.opening_statement || '';
  const argument = data.argument || data.case?.argument || '';
  const verdict = data.verdict || data.adjudication?.summary || data.adjudication?.verdict || '';
  const reasoning = data.reasoning || data.adjudication?.reasoning || '';
  const decision = data.decision || data.adjudication?.decision || '';

  if (title) lines.push(title);
  if (thesis) lines.push('', thesis);
  if (argument) lines.push('', argument);
  if (decision) lines.push('', `Decision: ${decision}`);
  if (verdict) lines.push('', verdict);
  if (reasoning) lines.push('', reasoning);

  const challenges = data.challenge_points || data.case?.challenge_points || [];
  if (Array.isArray(challenges) && challenges.length > 0) {
    lines.push('');
    challenges.forEach((cp, i) => {
      const cpTitle = cp.title || cp.point || `Point ${i + 1}`;
      const cpDesc = cp.description || cp.argument || cp.detail || '';
      lines.push(`${i + 1}. ${cpTitle}${cpDesc ? ': ' + cpDesc : ''}`);
    });
  }

  const evidence = data.evidence_chips || data.evidence || data.supporting_evidence || data.case?.evidence || [];
  if (Array.isArray(evidence) && evidence.length > 0) {
    lines.push('', 'Evidence:');
    evidence.forEach((e) => {
      const eText = typeof e === 'string' ? e : (e.text || e.claim || e.description || JSON.stringify(e));
      lines.push(`  • ${eText}`);
    });
  }

  const ddx = data.differential_diagnosis || [];
  if (Array.isArray(ddx) && ddx.length > 0) {
    lines.push('');
    ddx.forEach((d, i) => {
      const name = d.diagnosis || d.name || `Diagnosis ${i + 1}`;
      const confidence = d.confidence || d.likelihood || '';
      const changeEvidence = d.change_evidence || d.what_would_change || '';
      lines.push(`${i + 1}. ${name}${confidence ? ` (${confidence})` : ''}`);
      if (changeEvidence) lines.push(`   Would change if: ${changeEvidence}`);
    });
  }

  const recs = data.recommendations || data.next_steps || [];
  if (Array.isArray(recs) && recs.length > 0) {
    lines.push('', 'Recommendations:');
    recs.forEach(r => {
      const rText = typeof r === 'string' ? r : (r.text || r.recommendation || JSON.stringify(r));
      lines.push(`  • ${rText}`);
    });
  }

  if (lines.filter(l => l.trim()).length === 0) {
    return Object.entries(data)
      .filter(([k]) => !['role', 'target_question'].includes(k))
      .map(([k, v]) => {
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (typeof v === 'string') return `${label}: ${v}`;
        if (Array.isArray(v)) return `${label}:\n${v.map(item => typeof item === 'string' ? `  • ${item}` : `  • ${JSON.stringify(item)}`).join('\n')}`;
        if (typeof v === 'object' && v !== null) return `${label}: ${JSON.stringify(v, null, 2)}`;
        return `${label}: ${v}`;
      }).join('\n\n');
  }

  return lines.join('\n').trim();
};

export default function ClinicianChat({ patientId, patientName, onBack }) {
  const [handoffData, setHandoffData] = useState(null);
  const [handoffCached, setHandoffCached] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [debateRaw, setDebateRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Live Graph, Divergences, Snapshots & Verdicts State
  const [liveGraph, setLiveGraph] = useState({ nodes: [], edges: [], positions: {}, graph_version: 1 });
  const [divergences, setDivergences] = useState([]);
  const [debateVerdicts, setDebateVerdicts] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [showSnapshotsPanel, setShowSnapshotsPanel] = useState(false);

  // Document Ingest UI State (H5)
  const [showIngestPanel, setShowIngestPanel] = useState(false);
  const [ingestSource, setIngestSource] = useState('Outside Clinic Note');
  const [ingestText, setIngestText] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState(null);

  // Create Divergence UI State (M14)
  const [showAddDivergence, setShowAddDivergence] = useState(false);
  const [divTopicInput, setDivTopicInput] = useState('');
  const [divNodeA, setDivNodeA] = useState('');
  const [divNodeB, setDivNodeB] = useState('');
  const [divCreateStatus, setDivCreateStatus] = useState(null);

  // Admin state for destructive graph controls (C1)
  const [isAdmin, setIsAdmin] = useState(() => api.getAuthRole() === 'admin');
  const [adminFeedback, setAdminFeedback] = useState(null);

  // Main tab state
  const [mainTab, setMainTab] = useState('summary'); // 'summary', 'graph', 'divergences', 'ddx', 'scribe'

  // Chat State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [ddxRole, setDdxRole] = useState('copilot');
  const [isSending, setIsSending] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);

  // Scribe State
  const [transcriptInput, setTranscriptInput] = useState('');
  const [isScribing, setIsScribing] = useState(false);
  const [scribeResult, setScribeResult] = useState(null);

  // DDx Debate
  const [debateTopic, setDebateTopic] = useState(null);

  // Hypothesis update state (M11)
  const [updatingHypId, setUpdatingHypId] = useState(null);

  // Graph state
  const [detailKind, setDetailKind] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);

  // Narrative toggle
  const [showNarrative, setShowNarrative] = useState(false);

  const scrollRef = useRef(null);

  const refreshAuxiliaryData = async () => {
    try {
      const [graphRes, posRes, divRes, verdictRes, snapRes] = await Promise.all([
        api.getGraph(patientId).catch(() => null),
        api.getGraphPositions(patientId).catch(() => null),
        api.getDivergences(patientId).catch(() => ({ divergences: [] })),
        api.getDebateVerdicts(patientId).catch(() => ({ verdicts: [] })),
        api.getGraphSnapshots(patientId).catch(() => ({ snapshots: [] })),
      ]);

      if (graphRes) {
        setLiveGraph({
          nodes: graphRes.nodes || [],
          edges: graphRes.edges || [],
          positions: posRes?.positions || posRes || {},
          graph_version: graphRes.graph_version || 1,
        });
      }
      setDivergences((divRes?.divergences || []).map(normalizeDivergence));
      setDebateVerdicts(Array.isArray(verdictRes) ? verdictRes : (verdictRes?.verdicts || []));
      setSnapshots(Array.isArray(snapRes) ? snapRes : (snapRes?.snapshots || []));
    } catch (err) {
      console.error('Auxiliary clinical data refresh failed:', err);
    }
  };

  useEffect(() => {
    fetchHandoff(false);
    refreshAuxiliaryData();
  }, [patientId]);

  useEffect(() => {
    let interval;
    if (isSending) {
      setLoadingPhase(0);
      interval = setInterval(() => {
        setLoadingPhase(prev => (prev + 1) % 4);
      }, 3500);
    } else {
      setLoadingPhase(0);
    }
    return () => clearInterval(interval);
  }, [isSending]);

  const loadingPhrases = [
    "Querying memory graph...",
    "Weighing diagnostic criteria...",
    "Drafting clinical response...",
    "Finalizing analysis..."
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const fetchHandoff = async (force = false) => {
    try {
      if (force) {
        setRegenerating(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Same deterministic graph_version caching logic for EVERY patient (H3)
      const [graphRes, cachedList] = await Promise.all([
        api.getGraph(patientId).catch(() => null),
        !force ? api.getHandoffs(patientId).catch(() => []) : Promise.resolve([]),
      ]);

      const currentGraphVersion = graphRes?.graph_version || 1;
      if (!force && Array.isArray(cachedList) && cachedList.length > 0) {
        const latest = cachedList[cachedList.length - 1];
        const latestVersion = latest.graph_version || 1;
        if (latest.clinical_narrative && latest.clinical_narrative.trim() !== '' && latestVersion === currentGraphVersion) {
          setHandoffData(latest);
          setHandoffCached(true);
          setDebateRaw(null);
          if (messages.length === 0) {
            setMessages([{ sender: 'bot', text: `Clinical Copilot Online. Patient: ${latest.patient_name || patientName}. How can I assist with this case?` }]);
          }
          return;
        }
      }

      const res = await api.generateHandoff(patientId, 'Dr. A. Patel', 'Clinician', '', force);
      setHandoffData(res.handoff);
      setHandoffCached(Boolean(res.cached));
      setDebateRaw(res.debate || null);
      if (messages.length === 0) {
        setMessages([{ sender: 'bot', text: `Clinical Copilot Online. Patient: ${res.handoff.patient_name || patientName}. How can I assist with this case?` }]);
      }
    } catch (e) {
      setError(`Failed to generate clinical profile: ${e.message}`);
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  const handleHypothesisStatus = async (hyp, newStatus) => {
    if (!handoffData?.id || !hyp?.id) return;
    setUpdatingHypId(hyp.id);
    try {
      const res = await api.updateHypothesis(patientId, handoffData.id, hyp.id, newStatus, 'Dr. A. Patel');
      setHandoffData(prev => {
        if (!prev) return prev;
        const updatedHyps = (prev.hypotheses || []).map(item =>
          (typeof item === 'object' && item.id === hyp.id) ? res.hypothesis : item
        );
        return { ...prev, hypotheses: updatedHyps };
      });
      await refreshAuxiliaryData();
    } catch (e) {
      alert(`Failed to update hypothesis: ${e.message}`);
    } finally {
      setUpdatingHypId(null);
    }
  };

  const handleIngestSubmit = async () => {
    if (!ingestText.trim() || isIngesting) return;
    setIsIngesting(true);
    setIngestStatus(null);
    try {
      const res = await api.ingestDocument(patientId, ingestText.trim(), ingestSource.trim() || 'Clinical Note');
      const addedNodes = res.extraction_stats?.nodes_added ?? res.nodes_added ?? 0;
      const addedEdges = res.extraction_stats?.edges_added ?? res.edges_added ?? 0;
      setIngestStatus({
        ok: true,
        text: `Ingested ${addedNodes} distinct clinical claims (${addedEdges} edges linked to patient record).`,
      });
      setIngestText('');
      await refreshAuxiliaryData();
    } catch (e) {
      setIngestStatus({ ok: false, text: `Ingest error: ${e.message}` });
    } finally {
      setIsIngesting(false);
    }
  };

  const handleCreateDivergence = async () => {
    if (!divTopicInput.trim() || !divNodeA || !divNodeB) return;
    setDivCreateStatus(null);
    try {
      await api.addDivergence(patientId, divTopicInput.trim(), divNodeA, divNodeB);
      setDivTopicInput('');
      setDivCreateStatus({ ok: true, text: 'Divergence recorded with resolved node claims & sources.' });
      await refreshAuxiliaryData();
    } catch (e) {
      setDivCreateStatus({ ok: false, text: `Failed: ${e.message}` });
    }
  };

  const handleViewSnapshot = async (snapId) => {
    try {
      const snap = await api.getSnapshot(patientId, snapId);
      setSelectedSnapshot(snap);
    } catch (e) {
      setSelectedSnapshot({ error: e.message });
    }
  };

  const handleUnlockAdmin = async () => {
    const key = window.prompt('Enter Admin Key for destructive graph controls (local default: ally-local-admin-2026):', 'ally-local-admin-2026');
    if (!key) return;
    try {
      await api.elevateAdmin(key);
      setIsAdmin(true);
      setAdminFeedback('Admin role active');
      setTimeout(() => setAdminFeedback(null), 3000);
    } catch (e) {
      setAdminFeedback(`Admin unlock failed: ${e.message}`);
    }
  };

  const handleDeleteGraphItem = async (kind, target) => {
    try {
      if (kind === 'node') {
        await api.deleteNode(patientId, target.id);
      } else {
        await api.deleteEdge(patientId, target.source, target.target);
      }
      setDetailKind(null);
      setDetailTarget(null);
      await refreshAuxiliaryData();
    } catch (e) {
      setAdminFeedback(`Delete blocked: ${e.message}`);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const text = input.trim();

    if (ddxRole === 'debate') {
      setInput('');
      setDebateTopic(text);
      return;
    }

    setInput('');
    setMessages(prev => [...prev, { sender: 'clinician', text, ddxRole }]);
    setIsSending(true);

    try {
      let apiText = text;
      if (ddxRole === 'defend') apiText = `[DDX ARENA: I am proposing a diagnosis. Rule it out using graph evidence.] ${text}`;
      else if (ddxRole === 'challenge') apiText = `[DDX ARENA: I am challenging your primary diagnosis. Defend it with specific patient quotes.] ${text}`;
      else if (ddxRole === 'compare') apiText = `[DDX ARENA: Let's compare Hypothesis A vs Hypothesis B.] ${text}`;

      const res = await api.sendClinicianMessage(patientId, apiText);
      const botText = res.response?.text || res.text || 'No response generated.';
      const debate = res.response?.debate || res.debate || null;
      const referenced_nodes = res.response?.referenced_nodes || res.referenced_nodes || [];

      if (ddxRole === 'debate' && debate) {
        setMessages(prev => [...prev, { sender: 'bot', text: botText, debate, isDebate: true, referenced_nodes }]);
      } else {
        setMessages(prev => [...prev, { sender: 'bot', text: botText, referenced_nodes }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { sender: 'bot', text: `Error: ${e.message}` }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleScribeSubmit = async () => {
    if (!transcriptInput.trim() || isScribing) return;
    setIsScribing(true);
    try {
      const res = await api.postVisitScribe(patientId, transcriptInput);
      setScribeResult(res);
      await refreshAuxiliaryData();
    } catch (e) {
      setScribeResult({ session_notes: `Error: ${e.message}`, billing_context: '', isError: true });
    } finally {
      setIsScribing(false);
    }
  };

  const tabStyle = (active) => ({
    flex: 1,
    padding: '14px 8px',
    background: active ? 'rgba(217,184,115,0.08)' : 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid #D9B873' : '2px solid transparent',
    color: active ? '#D9B873' : '#6B6560',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: "'Work Sans', sans-serif",
    fontWeight: active ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  });

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050608', color: '#9B9285', flexDirection: 'column', gap: '16px' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(217,184,115,0.2)', borderTopColor: '#D9B873', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', color: '#D9B873' }}>Synthesizing Clinical Profile...</div>
        <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem' }}>Evaluating Differential Diagnoses and Testing Competing Hypotheses</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050608', color: '#E85D5D', flexDirection: 'column', gap: '16px' }}>
        <AlertTriangle size={48} />
        <div style={{ fontFamily: "'Work Sans', sans-serif", maxWidth: '580px', textAlign: 'center', lineHeight: 1.5 }}>{error}</div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => fetchHandoff(false)} style={{ background: 'rgba(217,184,115,0.18)', color: '#D9B873', border: '1px solid rgba(217,184,115,0.35)', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>Retry</button>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>Back to Hub</button>
        </div>
      </div>
    );
  }

  // Prefer live graph nodes/edges so Ingest (H5) and Scribe (H6) updates show immediately
  const graphNodes = liveGraph.nodes.length > 0 ? liveGraph.nodes : (handoffData?.graph_nodes || []);
  const graphEdges = liveGraph.edges.length > 0 ? liveGraph.edges : (handoffData?.graph_edges || []);
  const basePositions = Object.keys(liveGraph.positions || {}).length > 0 ? liveGraph.positions : (handoffData?.graph_positions || {});
  const graphPositions = { ...basePositions };
  graphNodes.forEach((n, idx) => {
    if (!graphPositions[n.id]) {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      graphPositions[n.id] = { x: 140 + col * 200, y: 95 + (row % 5) * 105 };
    }
  });

  // Extract structured data from graph nodes for At-a-Glance card (M10)
  const extractStructured = () => {
    if (!graphNodes.length && !handoffData) return { diagnoses: [], medications: [], symptoms: [], people: [], seedableDiagnoses: [] };
    const nodesOfKinds = (...kinds) =>
      graphNodes
        .filter(n => kinds.includes((n.kind || n.node_type || '').toLowerCase()))
        .map(n => cleanNodeLabel(n.label || n.id))
        .filter(Boolean);

    const rawClinical = nodesOfKinds('clinical').filter(l => !NON_DIAGNOSIS_LABEL_RE.test(l));
    const clinicianFindings = nodesOfKinds('clinician').filter(l => !/session 1|referral/i.test(l));
    const diagnoses = Array.from(new Set([...rawClinical, ...clinicianFindings]));
    const seedableDiagnoses = rawClinical.filter(l => SEEDABLE_DIAGNOSIS_RE.test(l) && l.length <= 36);

    const medications = Array.from(new Set(nodesOfKinds('medication')));
    const symptoms = Array.from(new Set(nodesOfKinds('symptom', 'avoidance', 'clinician_safety')));
    const patFull = cleanNodeLabel(handoffData?.patient_name || patientName);
    const people = Array.from(new Set(nodesOfKinds('person').filter(p => p !== patFull && p.toLowerCase() !== patFull.split(' ')[0]?.toLowerCase())));

    return { diagnoses, medications, symptoms, people, seedableDiagnoses };
  };
  const structured = extractStructured();

  // Patient-aware pronouns for DDx templates (M15)
  const demoStr = String(handoffData?.demographics || '');
  const isMalePatient = /\b\d+\s*M\b|\bmale\b/i.test(demoStr) || (patientId || '').toLowerCase().includes('daniel') || (patientName || '').toLowerCase().startsWith('daniel');
  const isFemalePatient = !isMalePatient && (/\b\d+\s*F\b|\bfemale\b/i.test(demoStr) || (patientId || '').toLowerCase().includes('elena') || (patientName || '').toLowerCase().startsWith('elena'));
  const pronouns = isMalePatient
    ? { subj: 'he', obj: 'him', poss: 'his', be: 'is', Subj: 'He' }
    : isFemalePatient
      ? { subj: 'she', obj: 'her', poss: 'her', be: 'is', Subj: 'She' }
      : { subj: 'they', obj: 'them', poss: 'their', be: 'are', Subj: 'They' };

  // Patient-aware suggested questions with strict node-kind & diagnosis-label filtering (M15)
  const suggestedQuestions = (() => {
    const qs = [];
    const patName = handoffData?.patient_name || patientName || 'this patient';
    if (structured.medications.length >= 2) {
      qs.push(`What are the interaction risks between ${structured.medications[0]} and ${structured.medications[1]}?`);
    } else if (structured.medications.length === 1) {
      qs.push(`What adherence and follow-up considerations apply to ${structured.medications[0]} for ${patName}?`);
    }
    if (handoffData?.risk_assessment && ['High', 'Medium'].includes(handoffData.risk_assessment.level)) {
      qs.push(`What safety protocol adjustments should I consider for ${patName} given the current risk level?`);
    } else if (structured.symptoms.length > 0) {
      qs.push(`How do ${patName}'s reported symptoms and avoidance patterns connect across recent sessions?`);
    }
    if (structured.seedableDiagnoses.length > 0) {
      qs.push(`What differential diagnoses should I consider alongside ${structured.seedableDiagnoses[0]} for ${patName}?`);
    } else {
      qs.push(`What primary behavioral health differential diagnoses fit ${patName}'s longitudinal graph?`);
    }
    if (handoffData?.active_themes?.length > 0) {
      const theme = handoffData.active_themes[0];
      const shortTheme = theme.split(/[,.;—]/)[0].trim().toLowerCase();
      if (shortTheme.length > 4 && shortTheme.length <= 65) {
        qs.push(`What therapeutic approaches are most effective for addressing ${shortTheme}?`);
      }
    }
    return qs.slice(0, 4);
  })();

  const roleExamples = (() => {
    if (ddxRole === 'copilot') {
      return [
        `What medications ${pronouns.be} ${pronouns.subj} on?`,
        `Summarize ${pronouns.poss} psychosocial and relationship history`,
        'Any risk factors or divergences I should know about?',
        isMalePatient ? `What did ${pronouns.subj} say about HIV testing and Marco?` : `What did ${pronouns.subj} say about sleep?`,
      ];
    }
    if (ddxRole === 'defend') {
      return isMalePatient
        ? ['Rule out Major Depressive Disorder', 'Why isn\'t this primary Panic Disorder?', 'Exclude Acute Stress Disorder', 'Can we rule out Generalized Anxiety Disorder?']
        : ['Rule out Bipolar II', 'Why isn\'t this PTSD?', 'Exclude substance-induced mood disorder', 'Can we rule out BPD?'];
    }
    if (ddxRole === 'challenge') {
      return isMalePatient
        ? ['Make the case for Adjustment Disorder with Anxiety', 'What supports Minority Stress & Identity Conflict?', 'Build the case for GAD', 'Defend fear-based avoidance hypothesis']
        : ['Make the case for MDD', 'What supports Adjustment Disorder?', 'Build the case for GAD', 'Defend chronic pain as primary'];
    }
    if (ddxRole === 'compare') {
      return isMalePatient
        ? ['Adjustment Disorder vs GAD', 'Minority Stress Anxiety vs MDD', 'Avoidant Coping vs Health Anxiety', 'Grief Reaction vs Situational Anxiety']
        : ['MDD vs Adjustment Disorder', 'PTSD vs Complex Grief', 'GAD vs Situational Anxiety', 'Bipolar II vs MDD'];
    }
    return isMalePatient
      ? ['What is the primary behavioral diagnosis?', 'Is avoidance driven by fear of losing Marco?', 'How should Dr. Tran and Dr. Patel coordinate care?', `Is ${pronouns.subj} at acute safety risk?`]
      : ['What is the primary diagnosis?', 'Should we start an SSRI?', 'Is this trauma or depression?', `Is ${pronouns.subj} safe for outpatient follow-up?`];
  })();

  // Condensed context for DDx sidebar (M10, M11 — never JSON.stringify hypotheses, no awkward "Low: ...")
  const formatRiskSummary = (ra) => {
    if (!ra) return [];
    const details = String(ra.details || '').trim();
    if (!details) return [ra.level || 'Low'];
    const clipped = details.length > 140 ? `${details.substring(0, 140)}...` : details;
    return [`${ra.level}: ${clipped}`];
  };

  const sidebarSections = [
    { label: 'Risk', color: riskColorFor(handoffData?.risk_assessment?.level), items: formatRiskSummary(handoffData?.risk_assessment) },
    { label: 'Diagnoses & Status', color: '#7ABFBF', items: structured.diagnoses.slice(0, 8) },
    { label: 'Medications', color: '#5FAEB0', items: structured.medications },
    { label: 'Themes', color: '#D9B873', items: (handoffData?.active_themes || []).slice(0, 4).map(t => t.length > 90 ? t.substring(0, 90) + '...' : t) },
    {
      label: 'Hypotheses',
      color: '#D67959',
      items: (handoffData?.hypotheses || []).slice(0, 4).map(h => {
        const txt = getHypothesisText(h);
        const status = typeof h === 'object' && h?.status ? `[${String(h.status).toUpperCase()}] ` : '';
        const full = `${status}${txt}`;
        return full.length > 95 ? full.substring(0, 95) + '...' : full;
      }),
    },
  ].filter(s => s.items.length > 0);

  function riskColorFor(level) {
    if (level === 'High') return '#E85D5D';
    if (level === 'Medium') return '#D67959';
    return '#5FAEB0';
  }

  const riskLevel = handoffData?.risk_assessment?.level || 'Low';
  const riskAccent = riskColorFor(riskLevel);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#050608', color: '#fff' }}>
      {/* Header */}
      <div style={{ height: '60px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#9B9285', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontFamily: "'Work Sans', sans-serif", transition: 'all 0.2s' }}>
            <ArrowLeft size={14} /> Hub
          </button>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#D9B873', lineHeight: 1.2 }}>Clinical Consultation</div>
            <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#A8A39A', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              {(patientName || handoffData?.patient_name || '').toUpperCase()} • Provider Dashboard
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {adminFeedback && (
            <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.7rem', color: '#D9B873' }}>{adminFeedback}</span>
          )}
          <button
            data-testid="clinician-admin-btn"
            onClick={handleUnlockAdmin}
            style={{
              background: isAdmin ? 'rgba(76,175,80,0.14)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isAdmin ? 'rgba(76,175,80,0.4)' : 'rgba(255,255,255,0.12)'}`,
              color: isAdmin ? '#4CAF50' : '#9B9285',
              padding: '5px 12px', borderRadius: '16px', cursor: 'pointer',
              fontSize: '0.7rem', fontFamily: "'Work Sans', sans-serif",
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            <Shield size={12} /> {isAdmin ? 'Admin Active' : 'Admin Unlock'}
          </button>

          {/* Risk Assessment Badge for ALL risk levels */}
          {handoffData?.risk_assessment && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: `${riskAccent}22`, padding: '6px 16px', borderRadius: '20px', border: `1px solid ${riskAccent}66` }}>
              {['Medium', 'High'].includes(riskLevel) && <AlertTriangle size={14} color={riskAccent} />}
              <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.75rem', color: riskAccent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {riskLevel} Risk
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.015)', flexShrink: 0, overflowX: 'auto' }}>
        <button data-testid="tab-summary" onClick={() => setMainTab('summary')} style={tabStyle(mainTab === 'summary')}>
          <FileText size={14} /> Transfer Summary
        </button>
        <button data-testid="tab-graph" onClick={() => setMainTab('graph')} style={tabStyle(mainTab === 'graph')}>
          <Brain size={14} /> Patient Graph ({graphNodes.length})
        </button>
        <button data-testid="tab-divergences" onClick={() => setMainTab('divergences')} style={tabStyle(mainTab === 'divergences')}>
          ⚡ Divergences ({divergences.length})
        </button>
        <button data-testid="tab-ddx" onClick={() => setMainTab('ddx')} style={tabStyle(mainTab === 'ddx')}>
          <MessageCircle size={14} /> DDx Arena
        </button>
        <button data-testid="tab-scribe" onClick={() => setMainTab('scribe')} style={tabStyle(mainTab === 'scribe')}>
          <Stethoscope size={14} /> Post-Visit Scribe
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>

        {/* ═══ TAB 1: TRANSFER SUMMARY ═══ */}
        {mainTab === 'summary' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '28px 48px' }}>

            {/* ── PROVENANCE & DETERMINISTIC CACHE BAR (H3) ── */}
            <div
              data-testid="handoff-provenance"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
                padding: '10px 16px', marginBottom: '20px', borderRadius: '10px',
                background: 'rgba(217,184,115,0.05)', border: '1px solid rgba(217,184,115,0.18)',
                fontFamily: "'Work Sans', sans-serif", fontSize: '0.74rem', color: '#A8A39A',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ color: '#D9B873', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {handoffCached ? '✓ Cached Synthesis' : '★ Freshly Synthesized'}
                </span>
                <span>Generated: <strong style={{ color: '#EDEAE3' }}>{handoffData?.generated_at ? new Date(handoffData.generated_at).toLocaleString() : 'Seeded'}</strong></span>
                <span>Model: <strong style={{ color: '#EDEAE3' }}>{handoffData?.model || 'gemini-2.5-flash'}</strong> ({handoffData?.model_version || 'v1'})</span>
                <span>Graph Version: <strong style={{ color: '#5FAEB0' }}>v{handoffData?.graph_version || liveGraph.graph_version || 1}</strong></span>
              </div>
              <button
                data-testid="regenerate-handoff-btn"
                onClick={() => fetchHandoff(true)}
                disabled={regenerating}
                style={{
                  background: 'rgba(217,184,115,0.12)', border: '1px solid rgba(217,184,115,0.32)',
                  color: '#D9B873', padding: '6px 14px', borderRadius: '6px',
                  cursor: regenerating ? 'not-allowed' : 'pointer', fontSize: '0.72rem',
                  fontFamily: "'Work Sans', sans-serif", fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <RefreshCw size={12} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
                {regenerating ? 'Regenerating...' : 'Regenerate Synthesis'}
              </button>
            </div>

            {/* ── AT-A-GLANCE CARD ── */}
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px 28px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.7rem', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.15em' }}>AT-A-GLANCE</div>
                {handoffData?.risk_assessment && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: `${riskAccent}20`, padding: '4px 12px', borderRadius: '6px', border: `1px solid ${riskAccent}50` }}>
                    {['Medium', 'High'].includes(riskLevel) && <AlertTriangle size={12} color={riskAccent} />}
                    <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.7rem', fontWeight: 700, color: riskAccent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{riskLevel} Risk</span>
                  </div>
                )}
              </div>

              {/* Patient Name + Demographics Row */}
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#D9B873', marginBottom: '4px' }}>
                {handoffData?.patient_name || patientName}
              </div>
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#A8A39A', marginBottom: '20px' }}>
                {typeof handoffData?.demographics === 'string' && handoffData.demographics ? handoffData.demographics : 'Demographics in clinical narrative'}
              </div>

              {/* Risk Details — shown cleanly for High, Medium, AND Low (M10) */}
              {handoffData?.risk_assessment?.details && (
                <div style={{ marginBottom: '18px', padding: '12px 16px', background: `${riskAccent}12`, borderRadius: '8px', border: `1px solid ${riskAccent}35` }}>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: riskAccent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', fontWeight: 600 }}>
                    {['Medium', 'High'].includes(riskLevel) ? 'Safety Protocol & Risk Assessment' : 'Risk & Protective Factors'}
                  </div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.82rem', color: '#EDEAE3', lineHeight: 1.5 }}>
                    {handoffData.risk_assessment.details}
                  </div>
                </div>
              )}

              {/* Structured Grid: Dx | Meds | Symptoms */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                {/* Diagnoses & Clinical Status */}
                <div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#7ABFBF', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px', fontWeight: 600 }}>Diagnoses &amp; Clinical Status</div>
                  {structured.diagnoses.length > 0 ? structured.diagnoses.map((d, i) => (
                    <div key={i} style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#EDEAE3', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#7ABFBF', flexShrink: 0 }} />
                      {d}
                    </div>
                  )) : <div style={{ fontSize: '0.8rem', color: '#4A4540' }}>See narrative</div>}
                </div>

                {/* Medications */}
                <div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px', fontWeight: 600 }}>Medications &amp; Regimens</div>
                  {structured.medications.length > 0 ? structured.medications.map((m, i) => (
                    <div key={i} style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#EDEAE3', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#5FAEB0', flexShrink: 0 }} />
                      {m}
                    </div>
                  )) : <div style={{ fontSize: '0.8rem', color: '#4A4540' }}>See narrative</div>}
                </div>

                {/* Symptoms / Flags */}
                <div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#D67959', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px', fontWeight: 600 }}>Symptoms &amp; Flags</div>
                  {structured.symptoms.length > 0 ? structured.symptoms.map((s, i) => (
                    <div key={i} style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#EDEAE3', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D67959', flexShrink: 0 }} />
                      {s}
                    </div>
                  )) : <div style={{ fontSize: '0.8rem', color: '#4A4540' }}>See narrative</div>}
                </div>
              </div>

            </div>

            {/* Two-column: Themes + Hypotheses | Evidence Tracker */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
              {/* Active Themes + Hypothesis Lifecycle (M11) */}
              <div>
                <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.8rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '14px', marginTop: 0, borderBottom: '1px solid rgba(95,174,176,0.12)', paddingBottom: '10px' }}>Active Themes</h3>
                <ul style={{ paddingLeft: '20px', margin: 0, fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', color: '#EDEAE3', lineHeight: 1.6 }}>
                  {handoffData?.active_themes?.map((theme, i) => <li key={i} style={{ marginBottom: '12px' }}>{theme}</li>)}
                </ul>

                {/* Clinical Hypotheses with Lifecycle Controls (M11) */}
                {handoffData?.hypotheses?.length > 0 && (
                  <>
                    <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.8rem', color: '#D67959', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '28px', marginBottom: '14px', borderBottom: '1px solid rgba(214,121,89,0.12)', paddingBottom: '10px' }}>Clinical Hypotheses (DDx Lifecycle)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {handoffData.hypotheses.map((h, i) => {
                        const isObj = typeof h === 'object' && h !== null;
                        const text = getHypothesisText(h);
                        const status = isObj ? (h.status || 'open') : 'open';
                        const statusColor = status === 'confirmed' ? '#4CAF50' : status === 'refuted' ? '#E85D5D' : '#D9B873';
                        return (
                          <div key={isObj && h.id ? h.id : i} data-testid="hypothesis-card" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                              <span style={{
                                fontFamily: "'Work Sans', sans-serif", fontSize: '0.62rem', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.1em',
                                padding: '2px 9px', borderRadius: '10px',
                                background: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}55`,
                              }}>
                                {status}
                              </span>
                              {isObj && h.id && (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {status !== 'confirmed' && (
                                    <button
                                      data-testid={`confirm-hyp-${h.id}`}
                                      disabled={updatingHypId === h.id}
                                      onClick={() => handleHypothesisStatus(h, 'confirmed')}
                                      style={{ background: 'rgba(76,175,80,0.14)', border: '1px solid rgba(76,175,80,0.35)', color: '#4CAF50', padding: '3px 9px', borderRadius: '6px', fontSize: '0.65rem', cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}
                                    >
                                      ✓ Confirm
                                    </button>
                                  )}
                                  {status !== 'refuted' && (
                                    <button
                                      data-testid={`refute-hyp-${h.id}`}
                                      disabled={updatingHypId === h.id}
                                      onClick={() => handleHypothesisStatus(h, 'refuted')}
                                      style={{ background: 'rgba(232,93,93,0.14)', border: '1px solid rgba(232,93,93,0.35)', color: '#E85D5D', padding: '3px 9px', borderRadius: '6px', fontSize: '0.65rem', cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}
                                    >
                                      ✕ Refute
                                    </button>
                                  )}
                                  {status !== 'open' && (
                                    <button
                                      disabled={updatingHypId === h.id}
                                      onClick={() => handleHypothesisStatus(h, 'open')}
                                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#A8A39A', padding: '3px 9px', borderRadius: '6px', fontSize: '0.65rem', cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}
                                    >
                                      ↺ Reopen
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.88rem', color: '#EDEAE3', lineHeight: 1.55, marginBottom: '8px' }}>
                              {text}
                            </div>
                            {isObj && (
                              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.68rem', color: '#8A857D', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                <span>Generated by: {h.generated_by || 'gemini-2.5-flash'} ({h.model_version || 'v1'})</span>
                                {h.confirmed_by && (
                                  <span style={{ color: statusColor }}>• {status.toUpperCase()} by {h.confirmed_by}</span>
                                )}
                                {h.timestamp && (
                                  <span>• {new Date(h.timestamp).toLocaleDateString()}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Evidence Tracker */}
              <div>
                <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.8rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '14px', marginTop: 0, borderBottom: '1px solid rgba(95,174,176,0.12)', paddingBottom: '10px' }}>Evidence Tracker</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {handoffData?.quotes_vs_inferences?.map((item, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.02)', padding: '14px 16px', borderRadius: '8px', borderLeft: '3px solid #D9B873' }}>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#D9B873', fontStyle: 'italic', marginBottom: '8px' }}>"{typeof item.quote === 'string' ? item.quote : String(item.quote || '')}"</div>
                      <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.8rem', color: '#5FAEB0', display: 'flex', gap: '6px' }}>
                        <span style={{ opacity: 0.6 }}>↳</span>
                        <span>{typeof item.inference === 'string' ? item.inference : String(item.inference || '')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── COLLAPSIBLE CLINICAL NARRATIVE ── */}
            <div style={{ marginBottom: '28px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden' }}>
              <button onClick={() => setShowNarrative(!showNarrative)} style={{ width: '100%', background: 'none', border: 'none', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {showNarrative ? <ChevronDown size={16} color="#D9B873" /> : <ChevronRight size={16} color="#A8A39A" />}
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: showNarrative ? '#D9B873' : '#A8A39A' }}>Clinical Narrative</span>
                </div>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.7rem', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{showNarrative ? 'Collapse' : 'Expand full narrative'}</span>
              </button>
              {showNarrative && (
                <div style={{ padding: '0 24px 24px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#EDEAE3', lineHeight: 1.7, maxWidth: '900px' }}>
                  {typeof handoffData?.clinical_narrative === 'string' ? handoffData.clinical_narrative : String(handoffData?.clinical_narrative || '')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ TAB 2: PATIENT GRAPH (with Ingest H5 & Snapshots H10) ═══ */}
        {mainTab === 'graph' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Graph Toolbar */}
            <div style={{ padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'rgba(255,255,255,0.015)' }}>
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.75rem', color: '#9B9285' }}>
                {graphNodes.length} Nodes • {graphEdges.length} Edges • Graph v{liveGraph.graph_version || 1}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  data-testid="toggle-ingest-btn"
                  onClick={() => { setShowIngestPanel(!showIngestPanel); setShowSnapshotsPanel(false); }}
                  style={{
                    background: showIngestPanel ? 'rgba(95,174,176,0.18)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(95,174,176,0.35)', color: '#5FAEB0',
                    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: "'Work Sans', sans-serif", fontSize: '0.73rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <Plus size={13} /> Ingest Clinical Note
                </button>
                <button
                  data-testid="toggle-snapshots-btn"
                  onClick={() => { setShowSnapshotsPanel(!showSnapshotsPanel); setShowIngestPanel(false); }}
                  style={{
                    background: showSnapshotsPanel ? 'rgba(217,184,115,0.18)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(217,184,115,0.35)', color: '#D9B873',
                    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: "'Work Sans', sans-serif", fontSize: '0.73rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <History size={13} /> Snapshots ({snapshots.length})
                </button>
              </div>
            </div>

            {/* Collapsible Ingest Panel (H5) */}
            {showIngestPanel && (
              <div style={{ padding: '16px 24px', background: '#0D1016', borderBottom: '1px solid rgba(95,174,176,0.2)' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    data-testid="ingest-source-input"
                    value={ingestSource}
                    onChange={(e) => setIngestSource(e.target.value)}
                    placeholder="Document source (e.g., Outside PCP Note)"
                    style={{ width: '260px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEAE3', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', fontFamily: "'Work Sans', sans-serif" }}
                  />
                  <button
                    data-testid="submit-ingest-btn"
                    onClick={handleIngestSubmit}
                    disabled={isIngesting || !ingestText.trim()}
                    style={{ background: isIngesting ? 'rgba(95,174,176,0.2)' : '#5FAEB0', color: '#050608', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 700, fontSize: '0.78rem', cursor: isIngesting ? 'not-allowed' : 'pointer', fontFamily: "'Work Sans', sans-serif" }}
                  >
                    {isIngesting ? 'Extracting Claims...' : 'Extract & Link Claims'}
                  </button>
                  {ingestStatus && (
                    <span style={{ fontSize: '0.78rem', color: ingestStatus.ok ? '#4CAF50' : '#E85D5D', fontFamily: "'Work Sans', sans-serif" }}>
                      {ingestStatus.text}
                    </span>
                  )}
                </div>
                <textarea
                  data-testid="ingest-text-input"
                  value={ingestText}
                  onChange={(e) => setIngestText(e.target.value)}
                  rows={3}
                  placeholder="Paste clinical note, lab summary, or referral note to extract atomic clinical claims into the patient graph..."
                  style={{ width: '100%', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEAE3', padding: '10px 12px', borderRadius: '6px', fontSize: '0.82rem', fontFamily: "'Work Sans', sans-serif", boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Collapsible Snapshots Panel (H10 & Not Exercised #4) */}
            {showSnapshotsPanel && (
              <div data-testid="snapshots-panel" style={{ padding: '14px 24px', background: '#0D1016', borderBottom: '1px solid rgba(217,184,115,0.2)', maxHeight: '190px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: selectedSnapshot ? '10px' : 0 }}>
                  {snapshots.map((s) => (
                    <button
                      key={s.id}
                      data-testid={`snapshot-item-${s.id}`}
                      onClick={() => handleViewSnapshot(s.id)}
                      style={{
                        background: selectedSnapshot?.id === s.id ? 'rgba(217,184,115,0.18)' : 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(217,184,115,0.3)', color: '#EDEAE3',
                        padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                        fontSize: '0.74rem', fontFamily: "'Work Sans', sans-serif", textAlign: 'left',
                      }}
                    >
                      <strong style={{ color: '#D9B873' }}>{s.label || s.id}</strong> • {s.node_count} nodes / {s.edge_count} edges
                    </button>
                  ))}
                  {snapshots.length === 0 && <span style={{ fontSize: '0.78rem', color: '#6B6560' }}>No snapshots recorded yet.</span>}
                </div>
                {selectedSnapshot && (
                  <div data-testid="snapshot-detail" style={{ fontSize: '0.76rem', color: '#A8A39A', fontFamily: "'Work Sans', sans-serif", padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                    {selectedSnapshot.error
                      ? `Error: ${selectedSnapshot.error}`
                      : `Snapshot "${selectedSnapshot.label}" (${selectedSnapshot.id}) • Timestamp: ${selectedSnapshot.timestamp} • Nodes captured: ${(selectedSnapshot.node_ids || []).length} • Edges captured: ${(selectedSnapshot.edge_ids || []).length}`}
                  </div>
                )}
              </div>
            )}

            {graphNodes.length > 0 ? (
              <div style={{ flex: 1, position: 'relative' }}>
                <InteractiveGraph
                  nodes={graphNodes}
                  edges={graphEdges}
                  positions={graphPositions}
                  highlight={[]}
                  interactive={true}
                  viewBox="0 0 1100 620"
                  onNodeClick={(n) => { setDetailKind('node'); setDetailTarget(n); }}
                  onEdgeClick={(e) => { setDetailKind('edge'); setDetailTarget(e); }}
                  onBackgroundClick={() => { setDetailKind(null); setDetailTarget(null); }}
                />

                {/* Node Legend */}
                <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(5,6,8,0.9)', padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexWrap: 'wrap', gap: '12px', maxWidth: '500px' }}>
                  {[
                    { kind: 'person', label: 'Person', color: '#7ABFBF' },
                    { kind: 'clinical', label: 'Clinical', color: '#7ABFBF' },
                    { kind: 'belief', label: 'Belief', color: '#D9B873' },
                    { kind: 'faith', label: 'Faith', color: '#D9B873' },
                    { kind: 'event', label: 'Event', color: '#6B6560' },
                    { kind: 'medication', label: 'Medication', color: '#7ABFBF' },
                    { kind: 'symptom', label: 'Symptom', color: '#D67959' },
                    { kind: 'locked', label: 'Locked', color: '#4A4540' },
                  ].map(item => (
                    <div key={item.kind} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                      <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.7rem', color: '#9B9285' }}>{item.label}</span>
                    </div>
                  ))}
                </div>

                {detailTarget && (
                  <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '380px', zIndex: 20 }}>
                    <NodeDetailPanel
                      kind={detailKind}
                      target={detailTarget}
                      nodes={graphNodes}
                      onClose={() => { setDetailKind(null); setDetailTarget(null); }}
                      onDelete={isAdmin ? handleDeleteGraphItem : undefined}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', color: '#6B6560' }}>
                <Brain size={48} />
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1rem' }}>No graph data available</div>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#4A4540' }}>Graph will populate after patient conversations</div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB 2.5: DIVERGENCES (Live API-driven H2 & M14) ═══ */}
        {mainTab === 'divergences' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '32px 48px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', maxWidth: '900px', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#D9B873', marginTop: 0, marginBottom: '8px' }}>Active &amp; Resolved Divergences</h2>
                <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', color: '#9B9285', lineHeight: 1.5, margin: 0, maxWidth: '640px' }}>
                  Contradictions detected in {handoffData?.patient_name || patientName}'s longitudinal record. Prism holds both claims with source credibility without overwriting.
                </p>
              </div>
              <button
                data-testid="toggle-add-divergence-btn"
                onClick={() => setShowAddDivergence(!showAddDivergence)}
                style={{
                  background: 'rgba(232,93,93,0.12)', border: '1px solid rgba(232,93,93,0.35)',
                  color: '#E85D5D', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
                  fontFamily: "'Work Sans', sans-serif", fontSize: '0.75rem', fontWeight: 600,
                }}
              >
                + Flag Node Divergence
              </button>
            </div>

            {showAddDivergence && (
              <div style={{ maxWidth: '900px', marginBottom: '24px', padding: '16px 20px', background: '#12141A', border: '1px solid rgba(232,93,93,0.28)', borderRadius: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                  <input
                    data-testid="div-topic-input"
                    value={divTopicInput}
                    onChange={(e) => setDivTopicInput(e.target.value)}
                    placeholder="Divergence topic..."
                    style={{ background: '#0A0C10', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEAE3', padding: '8px 10px', borderRadius: '6px', fontSize: '0.8rem', fontFamily: "'Work Sans', sans-serif" }}
                  />
                  <select
                    data-testid="div-node-a-select"
                    value={divNodeA}
                    onChange={(e) => setDivNodeA(e.target.value)}
                    style={{ background: '#0A0C10', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEAE3', padding: '8px 10px', borderRadius: '6px', fontSize: '0.8rem', fontFamily: "'Work Sans', sans-serif" }}
                  >
                    <option value="">Select Claim A Node...</option>
                    {graphNodes.map(n => <option key={n.id} value={n.id}>{cleanNodeLabel(n.label || n.id)}</option>)}
                  </select>
                  <select
                    data-testid="div-node-b-select"
                    value={divNodeB}
                    onChange={(e) => setDivNodeB(e.target.value)}
                    style={{ background: '#0A0C10', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEAE3', padding: '8px 10px', borderRadius: '6px', fontSize: '0.8rem', fontFamily: "'Work Sans', sans-serif" }}
                  >
                    <option value="">Select Claim B Node...</option>
                    {graphNodes.map(n => <option key={n.id} value={n.id}>{cleanNodeLabel(n.label || n.id)}</option>)}
                  </select>
                  <button
                    data-testid="submit-divergence-btn"
                    onClick={handleCreateDivergence}
                    style={{ background: '#E85D5D', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}
                  >
                    Record
                  </button>
                </div>
                {divCreateStatus && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: divCreateStatus.ok ? '#4CAF50' : '#E85D5D', fontFamily: "'Work Sans', sans-serif" }}>
                    {divCreateStatus.text}
                  </div>
                )}
              </div>
            )}

            {/* Divergence Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
              {divergences.length === 0 && (
                <div style={{ padding: '32px', background: '#12141A', borderRadius: '12px', color: '#9B9285', fontFamily: "'Work Sans', sans-serif" }}>
                  No divergences currently flagged for this patient.
                </div>
              )}
              {divergences.map((div, idx) => (
                <div key={div.id || idx} data-testid="divergence-card" style={{ background: '#12141A', border: `1px solid ${div.status === 'active' ? 'rgba(255,80,80,0.2)' : 'rgba(76,175,80,0.25)'}`, borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#EDEAE3' }}>{div.topic}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => { setMainTab('ddx'); setDdxRole('debate'); setDebateTopic(div.topic); }}
                        style={{ background: 'rgba(217,184,115,0.1)', border: '1px solid rgba(217,184,115,0.3)', color: '#D9B873', padding: '3px 10px', borderRadius: '10px', fontSize: '0.62rem', fontFamily: "'Work Sans', sans-serif", cursor: 'pointer', fontWeight: 600 }}
                      >
                        🔥 Debate in Arena
                      </button>
                      <span style={{
                        fontFamily: "'Work Sans', sans-serif",
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        padding: '3px 10px',
                        borderRadius: '10px',
                        background: div.status === 'active' ? 'rgba(255,80,80,0.12)' : 'rgba(76,175,80,0.12)',
                        color: div.status === 'active' ? '#E85D5D' : '#4CAF50',
                        border: `1px solid ${div.status === 'active' ? 'rgba(255,80,80,0.3)' : 'rgba(76,175,80,0.3)'}`,
                      }}>
                        {div.status === 'active' ? 'ACTIVE' : 'RESOLVED'}
                      </span>
                    </div>
                  </div>

                  {/* Side-by-side Claims */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0', alignItems: 'stretch' }}>
                    <div style={{ background: '#0A0C10', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.6rem', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 600 }}>Claim A</div>
                      <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#EDEAE3', lineHeight: 1.5, marginBottom: '10px' }}>{div.claimA.text}</div>
                      <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.7rem', color: '#A8A39A', marginBottom: '8px' }}>📄 {div.claimA.source}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '4px', background: '#1a1c22', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${div.claimA.credibility * 100}%`, height: '100%', background: getCredibilityColor(div.claimA.credibility), borderRadius: '2px', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: getCredibilityColor(div.claimA.credibility), fontWeight: 600 }}>{Math.round(div.claimA.credibility * 100)}%</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ width: '1px', flex: 1, background: 'rgba(255,80,80,0.3)' }} />
                      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>⚡</span>
                      <div style={{ width: '1px', flex: 1, background: 'rgba(255,80,80,0.3)' }} />
                    </div>

                    <div style={{ background: '#0A0C10', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.6rem', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 600 }}>Claim B</div>
                      <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#EDEAE3', lineHeight: 1.5, marginBottom: '10px' }}>{div.claimB.text}</div>
                      <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.7rem', color: '#A8A39A', marginBottom: '8px' }}>📄 {div.claimB.source}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '4px', background: '#1a1c22', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${div.claimB.credibility * 100}%`, height: '100%', background: getCredibilityColor(div.claimB.credibility), borderRadius: '2px', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: getCredibilityColor(div.claimB.credibility), fontWeight: 600 }}>{Math.round(div.claimB.credibility * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  {div.resolution && (
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(76,175,80,0.2)', fontSize: '0.78rem', color: '#4CAF50', fontFamily: "'Work Sans', sans-serif" }}>
                      ✓ Resolution: {div.resolution}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TAB 3: DDx ARENA (split: chat + context sidebar) ═══ */}
        {mainTab === 'ddx' && (
          <div style={{ height: '100%', display: 'flex' }}>
            {debateTopic ? (
              <div style={{ flex: 1 }}>
                <DdxDebate
                  patientId={patientId}
                  patientName={handoffData?.patient_name || patientName}
                  topic={debateTopic}
                  onVerdictRecorded={() => refreshAuxiliaryData()}
                  onClose={() => { setDebateTopic(null); refreshAuxiliaryData(); }}
                />
              </div>
            ) : (
            <>
            {/* LEFT: Chat (60%) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: '18px', display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'bot' ? 'flex-start' : 'flex-end' }}>
                    <div style={{ fontSize: '0.65rem', color: msg.sender === 'bot' ? '#5FAEB0' : '#D9B873', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '0.08em' }}>
                      {msg.sender === 'bot' ? (msg.isDebate ? '🔥 Live DDx Debate' : 'Clinical Copilot') : 'You (Clinician)'}
                      {msg.ddxRole && msg.ddxRole !== 'copilot' && (
                        <span style={{ marginLeft: '8px', color: '#A8A39A', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem' }}>
                          {msg.ddxRole.toUpperCase()}
                        </span>
                      )}
                    </div>

                    {msg.isDebate && msg.debate ? (
                      <div style={{ width: '100%', maxWidth: '95%' }}>
                        <div style={{ background: 'rgba(95,174,176,0.06)', border: '1px solid rgba(95,174,176,0.2)', borderRadius: '10px', padding: '16px 18px', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#5FAEB0', flexShrink: 0 }} />
                            <div style={{ fontSize: '0.7rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>The Case For — Supporting Evidence</div>
                          </div>
                          <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', lineHeight: 1.65, color: '#EDEAE3', whiteSpace: 'pre-wrap' }}>
                            {formatDebateAgent(msg.debate.advocate)}
                          </div>
                        </div>

                        <div style={{ background: 'rgba(214,121,89,0.06)', border: '1px solid rgba(214,121,89,0.2)', borderRadius: '10px', padding: '16px 18px', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D67959', flexShrink: 0 }} />
                            <div style={{ fontSize: '0.7rem', color: '#D67959', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>The Case Against — Challenges &amp; Rule-Outs</div>
                          </div>
                          <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', lineHeight: 1.65, color: '#EDEAE3', whiteSpace: 'pre-wrap' }}>
                            {formatDebateAgent(msg.debate.skeptic)}
                          </div>
                        </div>

                        <div style={{ background: 'rgba(217,184,115,0.08)', border: '1px solid rgba(217,184,115,0.25)', borderRadius: '10px', padding: '16px 18px', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D9B873', flexShrink: 0 }} />
                            <div style={{ fontSize: '0.7rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>Clinical Synthesis — Weighing Both Sides</div>
                          </div>
                          <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', lineHeight: 1.65, color: '#EDEAE3', whiteSpace: 'pre-wrap' }}>
                            {formatDebateAgent(msg.debate.judge)}
                          </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px 18px' }}>
                          <div style={{ fontSize: '0.65rem', color: '#A8A39A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>Synthesized Clinical Response</div>
                          <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', lineHeight: 1.6, color: '#EDEAE3' }}>
                            {msg.text.split('\n').map((line, j) => <React.Fragment key={j}>{line}<br/></React.Fragment>)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div data-testid={msg.sender === 'bot' ? 'bot-response-bubble' : 'clinician-message-bubble'} style={{ background: msg.sender === 'bot' ? 'rgba(95,174,176,0.06)' : 'rgba(217,184,115,0.06)', padding: '14px 18px', borderRadius: '10px', border: msg.sender === 'bot' ? '1px solid rgba(95,174,176,0.12)' : '1px solid rgba(217,184,115,0.12)', maxWidth: '90%', fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', lineHeight: 1.6, color: '#EDEAE3' }}>
                        {msg.text.split('\n').map((line, j) => <React.Fragment key={j}>{line}<br/></React.Fragment>)}
                        {msg.sender === 'bot' && msg.referenced_nodes && msg.referenced_nodes.length > 0 && (
                          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(95,174,176,0.1)', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.6rem', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '4px' }}>Sources:</span>
                            {msg.referenced_nodes.map((node, ni) => (
                              <span key={ni} style={{ background: 'rgba(95,174,176,0.15)', color: '#5FAEB0', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', fontFamily: "'Work Sans', sans-serif", lineHeight: 1.4 }}>
                                {typeof node === 'string' ? node : cleanNodeLabel(node.label || node.id || 'Node')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {messages.length <= 1 && !isSending && suggestedQuestions.length > 0 && (
                  <div style={{ marginTop: '8px', marginBottom: '20px' }}>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.6rem', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>Suggested Questions</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {suggestedQuestions.map((q, qi) => (
                        <button
                          key={qi}
                          data-testid="suggested-question"
                          onClick={() => { setInput(q); }}
                          style={{
                            background: 'rgba(217,184,115,0.05)',
                            border: '1px solid rgba(217,184,115,0.15)',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: "'Work Sans', sans-serif",
                            fontSize: '0.82rem',
                            color: '#D9B873',
                            lineHeight: 1.4,
                            transition: 'all 0.2s',
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(217,184,115,0.12)'; e.currentTarget.style.borderColor = 'rgba(217,184,115,0.3)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(217,184,115,0.05)'; e.currentTarget.style.borderColor = 'rgba(217,184,115,0.15)'; }}
                        >
                          💬 {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isSending && (
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '0.65rem', color: '#5FAEB0', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '0.08em' }}>Clinical Copilot</div>
                    <div data-testid="loading-indicator" style={{ background: 'rgba(95,174,176,0.06)', padding: '14px 18px', borderRadius: '10px', border: '1px solid rgba(95,174,176,0.12)', fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', color: '#5FAEB0' }}>
                      {loadingPhrases[loadingPhase]}
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div style={{ padding: '16px 32px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>

                {/* ── Role pills + one-line description ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'copilot', label: '💬 Ask', desc: 'You ask → System answers from patient record' },
                    { id: 'defend', label: '🛡️ Challenge', desc: 'You name a diagnosis → System pokes holes in it' },
                    { id: 'challenge', label: '✅ Advocate', desc: 'You name a diagnosis → System builds the case for it' },
                    { id: 'compare', label: '⚖️ Compare', desc: 'You name two diagnoses → System weighs them head-to-head' },
                    { id: 'debate', label: '🔥 Judge', desc: 'System argues FOR and AGAINST → You make the final call' },
                  ].map((role) => (
                    <button
                      key={role.id}
                      data-testid={`ddx-role-${role.id}`}
                      onClick={() => setDdxRole(role.id)}
                      title={role.desc}
                      style={{
                        background: ddxRole === role.id ? 'rgba(217,184,115,0.12)' : 'none',
                        border: ddxRole === role.id ? '1px solid rgba(217,184,115,0.3)' : '1px solid rgba(255,255,255,0.08)',
                        color: ddxRole === role.id ? '#D9B873' : '#6B6560',
                        padding: '4px 10px',
                        borderRadius: '14px',
                        fontSize: '0.7rem',
                        fontFamily: "'Work Sans', sans-serif",
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {role.label}
                    </button>
                  ))}
                  <span style={{ fontSize: '0.65rem', color: '#6B6560', fontFamily: "'Work Sans', sans-serif", marginLeft: '4px', fontStyle: 'italic' }}>
                    {ddxRole === 'copilot' && 'You ask → System answers from patient record'}
                    {ddxRole === 'defend' && 'You name a Dx → System pokes holes in it'}
                    {ddxRole === 'challenge' && 'You name a Dx → System builds the case for it'}
                    {ddxRole === 'compare' && 'You name two Dx → System weighs them head-to-head'}
                    {ddxRole === 'debate' && 'System argues FOR & AGAINST → You make the final call'}
                  </span>
                </div>

                {/* ── Patient-aware clickable example chips (M15) ── */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {roleExamples.map((example) => (
                    <button
                      key={example}
                      data-testid="ddx-example-chip"
                      onClick={() => setInput(example)}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: '#9B9285',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '0.65rem',
                        fontFamily: "'Work Sans', sans-serif",
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(217,184,115,0.08)'; e.currentTarget.style.color = '#D9B873'; e.currentTarget.style.borderColor = 'rgba(217,184,115,0.2)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#9B9285'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                    >
                      {example}
                    </button>
                  ))}
                </div>

                {/* ── Input + Send ── */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    data-testid="ddx-chat-input"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    placeholder={
                      ddxRole === 'copilot' ? 'Ask about this patient...' :
                      ddxRole === 'defend' ? 'Name a diagnosis to challenge...' :
                      ddxRole === 'challenge' ? 'Name a diagnosis to defend...' :
                      ddxRole === 'compare' ? 'Name two diagnoses...' :
                      ddxRole === 'debate' ? 'Ask a clinical question to debate...' :
                      'Type here...'
                    }
                    style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', padding: '12px 14px', borderRadius: '8px', fontSize: '0.85rem', fontFamily: "'Work Sans', sans-serif", outline: 'none' }}
                  />
                  <button
                    data-testid="ddx-send-btn"
                    onClick={handleSend}
                    disabled={isSending || !input.trim()}
                    style={{ background: isSending ? 'rgba(217,184,115,0.2)' : '#D9B873', border: 'none', color: '#050608', padding: '0 18px', borderRadius: '8px', cursor: isSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT: Quick Reference Sidebar + Persisted Debate Verdicts (M13) */}
            <div style={{ width: '340px', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)', overflowY: 'auto', padding: '20px' }}>
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '16px' }}>Quick Reference</div>

              <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#D9B873', marginBottom: '4px' }}>{handoffData?.patient_name || patientName}</div>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.75rem', color: '#A8A39A' }}>
                  {typeof handoffData?.demographics === 'string' && handoffData.demographics ? handoffData.demographics : ''}
                </div>
              </div>

              {sidebarSections.map((section, si) => (
                <div key={si} style={{ marginBottom: '18px' }}>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.6rem', color: section.color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px', fontWeight: 600 }}>{section.label}</div>
                  {section.items.map((item, ii) => (
                    <div key={ii} style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.78rem', color: '#CDCAC3', marginBottom: '5px', paddingLeft: '10px', borderLeft: `2px solid ${section.color}30`, lineHeight: 1.4 }}>
                      {item}
                    </div>
                  ))}
                </div>
              ))}

              {/* Key People */}
              {structured.people.length > 0 && (
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.6rem', color: '#7ABFBF', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px', fontWeight: 600 }}>Key People</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {structured.people.map((p, pi) => (
                      <span key={pi} style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.72rem', color: '#A8A39A', background: 'rgba(122,191,191,0.08)', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(122,191,191,0.12)' }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Persisted Debate Verdicts (M13) */}
              {debateVerdicts.length > 0 && (
                <div data-testid="persisted-verdicts-section" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.6rem', color: '#4CAF50', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px', fontWeight: 700 }}>
                    Persisted Debate Verdicts ({debateVerdicts.length})
                  </div>
                  {debateVerdicts.slice(0, 5).map((v, vi) => {
                    const winSide = v.winning_position || v.winner || 'judged';
                    const roundNum = v.rounds_count || v.round || 1;
                    return (
                    <div key={v.id || v.session_id || vi} data-testid="persisted-verdict-item" style={{ marginBottom: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.025)', borderRadius: '8px', borderLeft: `2px solid ${winSide === 'for' ? '#5FAEB0' : winSide === 'against' ? '#D67959' : '#D9B873'}` }}>
                      <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.76rem', color: '#EDEAE3', fontWeight: 600, marginBottom: '3px' }}>{v.topic}</div>
                      <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.68rem', color: '#9B9285' }}>
                        Winner: <strong style={{ color: '#D9B873' }}>{String(winSide).toUpperCase()}</strong> • Round {roundNum} • Score {v.score > 0 ? `+${v.score}` : v.score}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
            </>
            )}
          </div>
        )}

        {/* ═══ TAB 4: POST-VISIT SCRIBE (H6) ═══ */}
        {mainTab === 'scribe' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '40px 60px' }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#D9B873', marginTop: 0, marginBottom: '12px' }}>Post-Visit Scribe</h2>
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', color: '#9B9285', lineHeight: 1.6, marginBottom: '24px', maxWidth: '700px' }}>
              Paste the transcript of your therapy session. The system generates transcript-grounded SOAP notes, identifies evidence-backed CPT and ICD-10-CM codes, and consolidates clinical insights directly into the patient's memory graph.
            </p>

            <textarea
              data-testid="scribe-transcript-input"
              value={transcriptInput}
              onChange={(e) => setTranscriptInput(e.target.value)}
              placeholder="Paste session transcript here..."
              style={{ width: '100%', maxWidth: '800px', minHeight: '220px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '20px', borderRadius: '10px', fontSize: '0.9rem', fontFamily: "'Work Sans', sans-serif", outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
            />

            <div style={{ marginTop: '16px' }}>
              <button
                data-testid="scribe-submit-btn"
                onClick={handleScribeSubmit}
                disabled={isScribing || !transcriptInput.trim()}
                style={{ background: isScribing ? 'rgba(217,184,115,0.2)' : '#D9B873', color: '#050608', padding: '14px 28px', borderRadius: '8px', cursor: isScribing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem', border: 'none', transition: 'background 0.2s', fontFamily: "'Work Sans', sans-serif" }}
              >
                {isScribing ? 'Processing Transcript & Consolidating Graph...' : 'Generate Session Notes & Consolidate'}
              </button>
            </div>

            {scribeResult && (
              <div data-testid="scribe-results" style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
                {scribeResult.graph_updates && (
                  <div data-testid="scribe-graph-updates" style={{ background: 'rgba(76,175,80,0.08)', padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(76,175,80,0.3)', fontFamily: "'Work Sans', sans-serif", fontSize: '0.84rem', color: '#EDEAE3' }}>
                    <strong style={{ color: '#4CAF50' }}>✓ Memory Graph Consolidated (v{scribeResult.graph_updates.graph_version}):</strong>{' '}
                    +{scribeResult.graph_updates.nodes_added} new clinical nodes, +{scribeResult.graph_updates.edges_added} new edges, {scribeResult.graph_updates.confirmed_edges} inferred edges confirmed.
                  </div>
                )}
                <div style={{ background: 'rgba(95,174,176,0.06)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(95,174,176,0.15)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px', fontWeight: 600 }}>Generated Session Notes (SOAP)</div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', color: '#EDEAE3', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{scribeResult.session_notes}</div>
                </div>
                {scribeResult.billing_context && (
                  <div style={{ background: 'rgba(217,184,115,0.06)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(217,184,115,0.15)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px', fontWeight: 600 }}>Billing, CPT &amp; ICD-10-CM Context</div>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', color: '#EDEAE3', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{scribeResult.billing_context}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
