import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, AlertTriangle, Send, ChevronDown, ChevronRight, Lock, Brain, FileText, MessageCircle, Stethoscope } from 'lucide-react';
import InteractiveGraph from './VirtualBrain';
import * as api from '../api';

const DEMO_DIVERGENCES = [
  {
    topic: 'Substance Use History',
    claimA: { text: 'Patient denies current substance use', source: 'Intake Form (Session 1)', credibility: 0.80 },
    claimB: { text: 'Patient disclosed meth use history and current benzo use', source: 'Ally Session 12 (undisclosed)', credibility: 0.85 },
    status: 'active',
  },
  {
    topic: 'Sleep Pattern',
    claimA: { text: 'Reports sleeping 6-7 hours nightly', source: 'PHQ-9 Screening', credibility: 0.70 },
    claimB: { text: 'Consistently messages Ally at 2-3 AM, reports insomnia', source: 'Ally Sessions 8-12', credibility: 0.90 },
    status: 'active',
  },
  {
    topic: 'Medication Adherence',
    claimA: { text: 'Takes ibuprofen as prescribed for pain', source: 'Patient Self-Report', credibility: 0.75 },
    claimB: { text: 'Stockpiling tramadol, not taking as directed', source: 'Ally Session 12 (flagged significance)', credibility: 0.90 },
    status: 'active',
  },
];

const getCredibilityColor = (value) => {
  if (value >= 0.85) return '#4CAF50';
  if (value >= 0.75) return '#8BC34A';
  if (value >= 0.65) return '#FFC107';
  if (value >= 0.55) return '#FF9800';
  return '#E85D5D';
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

  // Extract common fields and render them nicely
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

  // Handle challenge_points array
  const challenges = data.challenge_points || data.case?.challenge_points || [];
  if (Array.isArray(challenges) && challenges.length > 0) {
    lines.push('');
    challenges.forEach((cp, i) => {
      const cpTitle = cp.title || cp.point || `Point ${i + 1}`;
      const cpDesc = cp.description || cp.argument || cp.detail || '';
      lines.push(`${i + 1}. ${cpTitle}${cpDesc ? ': ' + cpDesc : ''}`);
    });
  }

  // Handle evidence_chips / evidence arrays
  const evidence = data.evidence_chips || data.evidence || data.supporting_evidence || data.case?.evidence || [];
  if (Array.isArray(evidence) && evidence.length > 0) {
    lines.push('', 'Evidence:');
    evidence.forEach((e, i) => {
      const eText = typeof e === 'string' ? e : (e.text || e.claim || e.description || JSON.stringify(e));
      lines.push(`  • ${eText}`);
    });
  }

  // Handle differential_diagnosis array
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

  // Handle recommendations
  const recs = data.recommendations || data.next_steps || [];
  if (Array.isArray(recs) && recs.length > 0) {
    lines.push('', 'Recommendations:');
    recs.forEach(r => {
      const rText = typeof r === 'string' ? r : (r.text || r.recommendation || JSON.stringify(r));
      lines.push(`  • ${rText}`);
    });
  }

  // If we extracted nothing meaningful, do a smart flatten
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
  const [debateRaw, setDebateRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Main tab state
  const [mainTab, setMainTab] = useState('summary'); // 'summary', 'graph', 'divergences', 'ddx', 'scribe'

  // Chat State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [ddxRole, setDdxRole] = useState('copilot');
  const [isSending, setIsSending] = useState(false);
  const [showDebateTranscript, setShowDebateTranscript] = useState(false);
  
  // Scribe State
  const [transcriptInput, setTranscriptInput] = useState('');
  const [isScribing, setIsScribing] = useState(false);
  const [scribeResult, setScribeResult] = useState(null);

  // Graph state
  const [selectedGraphNode, setSelectedGraphNode] = useState(null);
  
  // Narrative toggle
  const [showNarrative, setShowNarrative] = useState(false);
  
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchHandoff();
  }, [patientId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const fetchHandoff = async () => {
    try {
      setLoading(true);
      const res = await api.generateHandoff(patientId, 'Dr. Provider', 'Clinician');
      setHandoffData(res.handoff);
      setDebateRaw(res.debate);
      setMessages([{ sender: 'bot', text: `Clinical Copilot Online. Patient: ${res.handoff.patient_name || patientName}. How can I assist with this case?` }]);
    } catch (e) {
      setError(`Failed to generate clinical profile: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, { sender: 'clinician', text, ddxRole }]);
    setIsSending(true);

    try {
      let apiText = text;
      if (ddxRole === 'defend') apiText = `[DDX ARENA: I am proposing a diagnosis. Rule it out using graph evidence.] ${text}`;
      else if (ddxRole === 'challenge') apiText = `[DDX ARENA: I am challenging your primary diagnosis. Defend it with specific patient quotes.] ${text}`;
      else if (ddxRole === 'compare') apiText = `[DDX ARENA: Let's compare Hypothesis A vs Hypothesis B.] ${text}`;
      else if (ddxRole === 'debate') apiText = `[DDX ARENA: LIVE DEBATE — Present the full Advocate, Skeptic, and Judge analysis with graph evidence.] ${text}`;

      const res = await api.sendClinicianMessage(patientId, apiText);
      const botText = res.response?.text || res.text || 'No response generated.';
      const debate = res.response?.debate || res.debate || null;

      if (ddxRole === 'debate' && debate) {
        // In debate mode, show the 3-agent debate cards instead of synthesized response
        setMessages(prev => [...prev, { sender: 'bot', text: botText, debate, isDebate: true }]);
      } else {
        setMessages(prev => [...prev, { sender: 'bot', text: botText }]);
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
    } catch (e) {
      setScribeResult({ session_notes: `Error: ${e.message}`, billing_context: '' });
    } finally {
      setIsScribing(false);
    }
  };

  // Styles
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
        <div style={{ fontFamily: "'Work Sans', sans-serif" }}>{error}</div>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>Back to Hub</button>
      </div>
    );
  }

  // Prepare graph data for InteractiveGraph
  const graphNodes = handoffData?.graph_nodes || [];
  const graphEdges = handoffData?.graph_edges || [];
  const graphPositions = handoffData?.graph_positions || {};

  // Extract structured data from graph nodes for At-a-Glance card
  const extractStructured = () => {
    if (!graphNodes.length && !handoffData) return { diagnoses: [], medications: [], symptoms: [], people: [] };
    const byKind = (kind) => graphNodes.filter(n => (n.kind || n.node_type || '').toLowerCase() === kind).map(n => n.label || n.id);
    const diagnoses = byKind('clinical').filter(l => !['depression', 'anxiety'].includes(l.toLowerCase()) || true);
    const medications = byKind('medication');
    const symptoms = byKind('symptom');
    const people = byKind('person').filter(p => p !== (handoffData?.patient_name || patientName));
    return { diagnoses, medications, symptoms, people };
  };
  const structured = extractStructured();

  // Generate suggested questions from handoff data
  const suggestedQuestions = (() => {
    const qs = [];
    const patName = handoffData?.patient_name || patientName || 'this patient';
    if (structured.medications.length >= 2) {
      qs.push(`What are the interaction risks between ${structured.medications[0]} and ${structured.medications[1]}?`);
    }
    if (handoffData?.risk_assessment && ['High', 'Medium'].includes(handoffData.risk_assessment.level)) {
      qs.push(`What safety protocol adjustments should I consider for ${patName} given the current risk level?`);
    }
    if (structured.diagnoses.length > 0) {
      qs.push(`What differential diagnoses should I consider alongside ${structured.diagnoses[0]} for ${patName}?`);
    }
    if (handoffData?.active_themes?.length > 0) {
      const theme = handoffData.active_themes[0];
      // Find the core topic — take up to the first comma or period for a clean phrase
      const shortTheme = theme.split(/[,.]/)  [0].trim().toLowerCase();
      qs.push(`What therapeutic approaches are most effective for addressing ${shortTheme}?`);
    }
    return qs.slice(0, 4);
  })();

  // Condensed context for DDx sidebar
  const sidebarSections = [
    { label: 'Risk', color: '#E85D5D', items: handoffData?.risk_assessment ? [`${handoffData.risk_assessment.level}: ${handoffData.risk_assessment.details?.substring(0, 120)}...`] : [] },
    { label: 'Diagnoses', color: '#7ABFBF', items: structured.diagnoses.slice(0, 8) },
    { label: 'Medications', color: '#5FAEB0', items: structured.medications },
    { label: 'Themes', color: '#D9B873', items: (handoffData?.active_themes || []).slice(0, 4).map(t => t.length > 80 ? t.substring(0, 80) + '...' : t) },
    { label: 'Hypotheses', color: '#D67959', items: (handoffData?.hypotheses || []).slice(0, 3).map(h => typeof h === 'string' ? (h.length > 80 ? h.substring(0, 80) + '...' : h) : JSON.stringify(h)) },
  ].filter(s => s.items.length > 0);

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
              {patientName?.toUpperCase() || handoffData?.patient_name?.toUpperCase()} • Provider Dashboard
            </div>
          </div>
        </div>

        {/* Risk Assessment Badge */}
        {handoffData?.risk_assessment && ['Medium', 'High'].includes(handoffData.risk_assessment.level) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: handoffData.risk_assessment.level === 'High' ? 'rgba(232,93,93,0.15)' : 'rgba(214,121,89,0.15)', padding: '6px 16px', borderRadius: '20px', border: `1px solid ${handoffData.risk_assessment.level === 'High' ? 'rgba(232,93,93,0.4)' : 'rgba(214,121,89,0.4)'}` }}>
            <AlertTriangle size={14} color={handoffData.risk_assessment.level === 'High' ? '#E85D5D' : '#D67959'} />
            <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.75rem', color: handoffData.risk_assessment.level === 'High' ? '#E85D5D' : '#D67959', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {handoffData.risk_assessment.level} Risk
            </span>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.015)', flexShrink: 0 }}>
        <button onClick={() => setMainTab('summary')} style={tabStyle(mainTab === 'summary')}>
          <FileText size={14} /> Transfer Summary
        </button>
        <button onClick={() => setMainTab('graph')} style={tabStyle(mainTab === 'graph')}>
          <Brain size={14} /> Patient Graph
        </button>
        <button onClick={() => setMainTab('divergences')} style={tabStyle(mainTab === 'divergences')}>
          ⚡ Divergences
        </button>
        <button onClick={() => setMainTab('ddx')} style={tabStyle(mainTab === 'ddx')}>
          <MessageCircle size={14} /> DDx Arena
        </button>
        <button onClick={() => setMainTab('scribe')} style={tabStyle(mainTab === 'scribe')}>
          <Stethoscope size={14} /> Post-Visit Scribe
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>

        {/* ═══ TAB 1: TRANSFER SUMMARY ═══ */}
        {mainTab === 'summary' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '32px 48px' }}>
            
            {/* ── AT-A-GLANCE CARD ── */}
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px 28px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.7rem', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.15em' }}>AT-A-GLANCE</div>
                {handoffData?.risk_assessment && ['Medium', 'High'].includes(handoffData.risk_assessment.level) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: handoffData.risk_assessment.level === 'High' ? 'rgba(232,93,93,0.15)' : 'rgba(214,121,89,0.12)', padding: '4px 12px', borderRadius: '6px', border: `1px solid ${handoffData.risk_assessment.level === 'High' ? 'rgba(232,93,93,0.35)' : 'rgba(214,121,89,0.3)'}` }}>
                    <AlertTriangle size={12} color={handoffData.risk_assessment.level === 'High' ? '#E85D5D' : '#D67959'} />
                    <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.7rem', fontWeight: 700, color: handoffData.risk_assessment.level === 'High' ? '#E85D5D' : '#D67959', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{handoffData.risk_assessment.level} Risk</span>
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

              {/* Risk Details (if present) — ABOVE the Dx grid */}
              {handoffData?.risk_assessment && ['Medium', 'High'].includes(handoffData.risk_assessment.level) && (
                <div style={{ marginBottom: '18px', padding: '12px 16px', background: handoffData.risk_assessment.level === 'High' ? 'rgba(232,93,93,0.08)' : 'rgba(214,121,89,0.06)', borderRadius: '8px', border: `1px solid ${handoffData.risk_assessment.level === 'High' ? 'rgba(232,93,93,0.2)' : 'rgba(214,121,89,0.15)'}` }}>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: handoffData.risk_assessment.level === 'High' ? '#E85D5D' : '#D67959', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', fontWeight: 600 }}>Safety Protocol</div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.82rem', color: '#EDEAE3', lineHeight: 1.5 }}>
                    {handoffData.risk_assessment.details}
                  </div>
                </div>
              )}

              {/* Structured Grid: Dx | Meds | Symptoms */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                {/* Diagnoses */}
                <div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#7ABFBF', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px', fontWeight: 600 }}>Diagnoses</div>
                  {structured.diagnoses.length > 0 ? structured.diagnoses.map((d, i) => (
                    <div key={i} style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#EDEAE3', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#7ABFBF', flexShrink: 0 }} />
                      {d}
                    </div>
                  )) : <div style={{ fontSize: '0.8rem', color: '#4A4540' }}>See narrative</div>}
                </div>

                {/* Medications */}
                <div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px', fontWeight: 600 }}>Medications</div>
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

            {/* Two-column: Themes + Evidence */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
              {/* Active Themes */}
              <div>
                <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.8rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '14px', marginTop: 0, borderBottom: '1px solid rgba(95,174,176,0.12)', paddingBottom: '10px' }}>Active Themes</h3>
                <ul style={{ paddingLeft: '20px', margin: 0, fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', color: '#EDEAE3', lineHeight: 1.6 }}>
                  {handoffData?.active_themes?.map((theme, i) => <li key={i} style={{ marginBottom: '12px' }}>{theme}</li>)}
                </ul>

                {/* Clinical Hypotheses */}
                {handoffData?.hypotheses?.length > 0 && (
                  <>
                    <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.8rem', color: '#D67959', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '28px', marginBottom: '14px', borderBottom: '1px solid rgba(214,121,89,0.12)', paddingBottom: '10px' }}>Clinical Hypotheses (DDx)</h3>
                    <ul style={{ paddingLeft: '20px', margin: 0, fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', color: '#EDEAE3', lineHeight: 1.6 }}>
                      {handoffData.hypotheses.map((h, i) => <li key={i} style={{ marginBottom: '12px' }}>{typeof h === 'string' ? h : JSON.stringify(h)}</li>)}
                    </ul>
                  </>
                )}
              </div>

              {/* Evidence Tracker */}
              <div>
                <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.8rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '14px', marginTop: 0, borderBottom: '1px solid rgba(95,174,176,0.12)', paddingBottom: '10px' }}>Evidence Tracker</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {handoffData?.quotes_vs_inferences?.map((item, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.02)', padding: '14px 16px', borderRadius: '8px', borderLeft: '3px solid #D9B873' }}>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#D9B873', fontStyle: 'italic', marginBottom: '8px' }}>"{typeof item.quote === 'string' ? item.quote : JSON.stringify(item.quote)}"</div>
                      <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.8rem', color: '#5FAEB0', display: 'flex', gap: '6px' }}>
                        <span style={{ opacity: 0.6 }}>↳</span>
                        <span>{typeof item.inference === 'string' ? item.inference : JSON.stringify(item.inference)}</span>
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
                  {typeof handoffData?.clinical_narrative === 'string' ? handoffData.clinical_narrative : JSON.stringify(handoffData?.clinical_narrative)}
                </div>
              )}
            </div>

            {/* DDx Evaluation Transcript */}
            {debateRaw && (
              <div style={{ marginBottom: '28px' }}>
                <button onClick={() => setShowDebateTranscript(!showDebateTranscript)} style={{ background: 'none', border: 'none', color: '#5FAEB0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', padding: 0, fontFamily: "'Work Sans', sans-serif" }}>
                  {showDebateTranscript ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                  {showDebateTranscript ? 'Hide DDx Evaluation Transcript' : 'View DDx Evaluation Transcript'}
                </button>
                
                {showDebateTranscript && (
                  <div style={{ marginTop: '14px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(95,174,176,0.12)', overflow: 'hidden' }}>
                    <div style={{ padding: '18px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '0.65rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 600 }}>Supporting Evidence (Hypothesis A)</div>
                      <div style={{ fontFamily: "monospace", fontSize: '0.8rem', color: '#A8A39A', whiteSpace: 'pre-wrap' }}>
                        {formatDebateAgent(debateRaw.advocate)}
                      </div>
                    </div>
                    <div style={{ padding: '18px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '0.65rem', color: '#D67959', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 600 }}>Rule-Out Criteria & Challenges</div>
                      <div style={{ fontFamily: "monospace", fontSize: '0.8rem', color: '#A8A39A', whiteSpace: 'pre-wrap' }}>
                        {formatDebateAgent(debateRaw.skeptic)}
                      </div>
                    </div>
                    <div style={{ padding: '18px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 600 }}>Final Clinical Synthesis</div>
                      <div style={{ fontFamily: "monospace", fontSize: '0.8rem', color: '#A8A39A', whiteSpace: 'pre-wrap' }}>
                        {formatDebateAgent(debateRaw.judge)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB 2: PATIENT GRAPH ═══ */}
        {mainTab === 'graph' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {graphNodes.length > 0 ? (
              <div style={{ flex: 1, position: 'relative' }}>
                <InteractiveGraph
                  nodes={graphNodes}
                  edges={graphEdges}
                  positions={graphPositions}
                  highlight={[]}
                  interactive={true}
                  viewBox="0 0 1100 620"
                  onNodeClick={(n) => setSelectedGraphNode(n)}
                  onBackgroundClick={() => setSelectedGraphNode(null)}
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

                {/* Selected Node Detail */}
                {selectedGraphNode && (
                  <div style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(5,6,8,0.95)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(217,184,115,0.2)', maxWidth: '300px' }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#D9B873', marginBottom: '8px' }}>{selectedGraphNode.label || selectedGraphNode.id}</div>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.8rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>{selectedGraphNode.kind || selectedGraphNode.node_type}</div>
                    {selectedGraphNode.id && (
                      <div style={{ fontFamily: "monospace", fontSize: '0.75rem', color: '#6B6560' }}>ID: {selectedGraphNode.id}</div>
                    )}
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

        {/* ═══ TAB 2.5: DIVERGENCES ═══ */}
        {mainTab === 'divergences' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '32px 48px' }}>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#D9B873', marginTop: 0, marginBottom: '8px' }}>Active Divergences</h2>
              <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', color: '#9B9285', lineHeight: 1.5, margin: 0, maxWidth: '700px' }}>
                Contradictions detected in the patient record. Prism holds both claims without overwriting.
              </p>
            </div>

            {/* Divergence Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
              {DEMO_DIVERGENCES.map((div, idx) => (
                <div key={idx} style={{ background: '#12141A', border: '1px solid rgba(255,80,80,0.2)', borderRadius: '12px', padding: '20px' }}>
                  {/* Topic Header Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#EDEAE3' }}>{div.topic}</div>
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

                  {/* Side-by-side Claims */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0', alignItems: 'stretch' }}>
                    {/* Claim A */}
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

                    {/* Contradiction Indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ width: '1px', flex: 1, background: 'rgba(255,80,80,0.3)' }} />
                      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>⚡</span>
                      <div style={{ width: '1px', flex: 1, background: 'rgba(255,80,80,0.3)' }} />
                    </div>

                    {/* Claim B */}
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
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TAB 3: DDx ARENA (split: chat + context sidebar) ═══ */}
        {mainTab === 'ddx' && (
          <div style={{ height: '100%', display: 'flex' }}>
            {/* LEFT: Chat (60%) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {/* Chat Messages */}
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

                    {/* Live Debate 3-agent cards */}
                    {msg.isDebate && msg.debate ? (
                      <div style={{ width: '100%', maxWidth: '95%' }}>
                        {/* The Case For */}
                        <div style={{ background: 'rgba(95,174,176,0.06)', border: '1px solid rgba(95,174,176,0.2)', borderRadius: '10px', padding: '16px 18px', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#5FAEB0', flexShrink: 0 }} />
                            <div style={{ fontSize: '0.7rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>The Case For — Supporting Evidence</div>
                          </div>
                          <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', lineHeight: 1.65, color: '#EDEAE3', whiteSpace: 'pre-wrap' }}>
                            {formatDebateAgent(msg.debate.advocate)}
                          </div>
                        </div>

                        {/* The Case Against */}
                        <div style={{ background: 'rgba(214,121,89,0.06)', border: '1px solid rgba(214,121,89,0.2)', borderRadius: '10px', padding: '16px 18px', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D67959', flexShrink: 0 }} />
                            <div style={{ fontSize: '0.7rem', color: '#D67959', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>The Case Against — Challenges & Rule-Outs</div>
                          </div>
                          <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', lineHeight: 1.65, color: '#EDEAE3', whiteSpace: 'pre-wrap' }}>
                            {formatDebateAgent(msg.debate.skeptic)}
                          </div>
                        </div>

                        {/* Clinical Synthesis */}
                        <div style={{ background: 'rgba(217,184,115,0.08)', border: '1px solid rgba(217,184,115,0.25)', borderRadius: '10px', padding: '16px 18px', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D9B873', flexShrink: 0 }} />
                            <div style={{ fontSize: '0.7rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>Clinical Synthesis — Weighing Both Sides</div>
                          </div>
                          <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', lineHeight: 1.65, color: '#EDEAE3', whiteSpace: 'pre-wrap' }}>
                            {formatDebateAgent(msg.debate.judge)}
                          </div>
                        </div>

                        {/* Synthesized Verdict */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px 18px' }}>
                          <div style={{ fontSize: '0.65rem', color: '#A8A39A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>Synthesized Clinical Response</div>
                          <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', lineHeight: 1.6, color: '#EDEAE3' }}>
                            {msg.text.split('\n').map((line, j) => <React.Fragment key={j}>{line}<br/></React.Fragment>)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Normal single bubble */
                      <div style={{ background: msg.sender === 'bot' ? 'rgba(95,174,176,0.06)' : 'rgba(217,184,115,0.06)', padding: '14px 18px', borderRadius: '10px', border: msg.sender === 'bot' ? '1px solid rgba(95,174,176,0.12)' : '1px solid rgba(217,184,115,0.12)', maxWidth: '90%', fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', lineHeight: 1.6, color: '#EDEAE3' }}>
                        {msg.text.split('\n').map((line, j) => <React.Fragment key={j}>{line}<br/></React.Fragment>)}
                        {/* Source Attribution Pills */}
                        {msg.sender === 'bot' && msg.referenced_nodes && msg.referenced_nodes.length > 0 && (
                          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(95,174,176,0.1)', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.6rem', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '4px' }}>Sources:</span>
                            {msg.referenced_nodes.map((node, ni) => (
                              <span key={ni} style={{ background: 'rgba(95,174,176,0.15)', color: '#5FAEB0', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', fontFamily: "'Work Sans', sans-serif", lineHeight: 1.4 }}>
                                {typeof node === 'string' ? node : (node.label || node.id || 'Node')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {/* Suggested Questions (zero-state) */}
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
                    <div style={{ background: 'rgba(95,174,176,0.06)', padding: '14px 18px', borderRadius: '10px', border: '1px solid rgba(95,174,176,0.12)', fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', color: '#5FAEB0' }}>
                      Analyzing clinical data...
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div style={{ padding: '16px 32px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                  {[
                    { id: 'copilot', label: '💬 Ask Ally' },
                    { id: 'defend', label: '🛡️ Rule It Out' },
                    { id: 'challenge', label: '✅ Build the Case' },
                    { id: 'compare', label: '⚖️ Compare Two' },
                    { id: 'debate', label: '🔥 Second Opinion' },
                  ].map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setDdxRole(role.id)}
                      style={{
                        background: ddxRole === role.id ? 'rgba(217,184,115,0.12)' : 'none',
                        border: ddxRole === role.id ? '1px solid rgba(217,184,115,0.3)' : '1px solid rgba(255,255,255,0.08)',
                        color: ddxRole === role.id ? '#D9B873' : '#6B6560',
                        padding: '5px 12px',
                        borderRadius: '16px',
                        fontSize: '0.7rem',
                        fontFamily: "'Work Sans', sans-serif",
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>

                {/* ── DDx Mode Description ── */}
                <div style={{
                  padding: '10px 14px',
                  marginBottom: '10px',
                  background: ddxRole === 'debate' ? 'rgba(214,121,89,0.06)' : 'rgba(95,174,176,0.04)',
                  border: `1px solid ${ddxRole === 'debate' ? 'rgba(214,121,89,0.15)' : 'rgba(95,174,176,0.1)'}`,
                  borderRadius: '8px',
                  transition: 'all 0.3s ease',
                }}>
                  {ddxRole === 'copilot' && (
                    <div style={{ fontSize: '0.75rem', color: '#9B9285', fontFamily: "'Work Sans', sans-serif", lineHeight: 1.5 }}>
                      <span style={{ color: '#5FAEB0', fontWeight: 600 }}>Ask Ally</span> — Ask anything about this patient. Ally pulls from the full patient record to answer.<br/>
                      <span style={{ color: '#6B6560', fontStyle: 'italic' }}>Try: "What medications is she on?" · "Summarize her trauma history" · "Any risk factors I should know about?"</span>
                    </div>
                  )}
                  {ddxRole === 'defend' && (
                    <div style={{ fontSize: '0.75rem', color: '#9B9285', fontFamily: "'Work Sans', sans-serif", lineHeight: 1.5 }}>
                      <span style={{ color: '#4CAF50', fontWeight: 600 }}>Rule It Out</span> — You name a diagnosis. The system plays <strong style={{ color: '#E85D5D' }}>devil's advocate</strong> and tries to poke holes in it using the patient's own words and history.<br/>
                      <span style={{ color: '#6B6560', fontStyle: 'italic' }}>Try: "Rule out Bipolar II" · "Why isn't this PTSD?" · "Can we exclude substance-induced mood disorder?"</span>
                    </div>
                  )}
                  {ddxRole === 'challenge' && (
                    <div style={{ fontSize: '0.75rem', color: '#9B9285', fontFamily: "'Work Sans', sans-serif", lineHeight: 1.5 }}>
                      <span style={{ color: '#D9B873', fontWeight: 600 }}>Build the Case</span> — You name a diagnosis. The system builds the <strong style={{ color: '#4CAF50' }}>strongest possible case</strong> for it, citing specific patient quotes and clinical evidence.<br/>
                      <span style={{ color: '#6B6560', fontStyle: 'italic' }}>Try: "Make the case for MDD" · "What supports Adjustment Disorder?" · "Build the case for chronic pain as primary"</span>
                    </div>
                  )}
                  {ddxRole === 'compare' && (
                    <div style={{ fontSize: '0.75rem', color: '#9B9285', fontFamily: "'Work Sans', sans-serif", lineHeight: 1.5 }}>
                      <span style={{ color: '#7B68EE', fontWeight: 600 }}>Compare Two</span> — Name two diagnoses. The system weighs them <strong style={{ color: '#7B68EE' }}>head-to-head</strong> — what evidence supports each, what contradicts each, and which fits better.<br/>
                      <span style={{ color: '#6B6560', fontStyle: 'italic' }}>Try: "MDD vs Adjustment Disorder" · "PTSD vs Complex Grief" · "Generalized Anxiety vs Situational Anxiety"</span>
                    </div>
                  )}
                  {ddxRole === 'debate' && (
                    <div style={{ fontSize: '0.75rem', color: '#9B9285', fontFamily: "'Work Sans', sans-serif", lineHeight: 1.5 }}>
                      <span style={{ color: '#D67959', fontWeight: 600 }}>Second Opinion</span> — The system gives you <strong style={{ color: '#EDEAE3' }}>three independent perspectives</strong> on your question:<br/>
                      <span style={{ color: '#5FAEB0' }}>① One argues FOR</span> a position using supporting evidence<br/>
                      <span style={{ color: '#D67959' }}>② One argues AGAINST</span> it, challenging assumptions<br/>
                      <span style={{ color: '#D9B873' }}>③ One weighs both sides</span> and gives a clinical recommendation<br/>
                      <span style={{ color: '#EDEAE3', fontWeight: 500 }}>You make the final call.</span><br/>
                      <span style={{ color: '#6B6560', fontStyle: 'italic' }}>Try: "What's the primary diagnosis?" · "Should we start an SSRI?" · "Is this trauma or depression?"</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    placeholder={
                      ddxRole === 'copilot' ? 'Ask anything about this patient...' :
                      ddxRole === 'defend' ? 'Name a diagnosis to challenge... e.g. "Rule out Bipolar II"' :
                      ddxRole === 'challenge' ? 'Name a diagnosis to support... e.g. "Make the case for MDD"' :
                      ddxRole === 'compare' ? 'Name two diagnoses... e.g. "MDD vs Adjustment Disorder"' :
                      ddxRole === 'debate' ? 'Ask a clinical question... e.g. "What is the primary diagnosis?"' :
                      'Ask about this patient...'
                    }
                    style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', padding: '12px 14px', borderRadius: '8px', fontSize: '0.85rem', fontFamily: "'Work Sans', sans-serif", outline: 'none' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={isSending || !input.trim()}
                    style={{ background: isSending ? 'rgba(217,184,115,0.2)' : '#D9B873', border: 'none', color: '#050608', padding: '0 18px', borderRadius: '8px', cursor: isSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT: Quick Reference Sidebar (40%) */}
            <div style={{ width: '340px', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)', overflowY: 'auto', padding: '20px' }}>
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '16px' }}>Quick Reference</div>
              
              {/* Patient Header */}
              <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#D9B873', marginBottom: '4px' }}>{handoffData?.patient_name || patientName}</div>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.75rem', color: '#A8A39A' }}>
                  {typeof handoffData?.demographics === 'string' && handoffData.demographics ? handoffData.demographics : ''}
                </div>
              </div>

              {/* Sidebar Sections */}
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
            </div>
          </div>
        )}

        {/* ═══ TAB 4: POST-VISIT SCRIBE ═══ */}
        {mainTab === 'scribe' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '40px 60px' }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#D9B873', marginTop: 0, marginBottom: '12px' }}>Post-Visit Scribe</h2>
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', color: '#9B9285', lineHeight: 1.6, marginBottom: '24px', maxWidth: '700px' }}>
              Paste the transcript of your therapy session. The system will generate clinical session notes (SOAP), identify billable elements, and consolidate insights into the patient's memory graph.
            </p>
            
            <textarea
              value={transcriptInput}
              onChange={(e) => setTranscriptInput(e.target.value)}
              placeholder="Paste session transcript here..."
              style={{ width: '100%', maxWidth: '800px', minHeight: '250px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '20px', borderRadius: '10px', fontSize: '0.9rem', fontFamily: "'Work Sans', sans-serif", outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
            />
            
            <div style={{ marginTop: '16px' }}>
              <button
                onClick={handleScribeSubmit}
                disabled={isScribing || !transcriptInput.trim()}
                style={{ background: isScribing ? 'rgba(217,184,115,0.2)' : '#D9B873', color: '#050608', padding: '14px 28px', borderRadius: '8px', cursor: isScribing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem', border: 'none', transition: 'background 0.2s', fontFamily: "'Work Sans', sans-serif" }}
              >
                {isScribing ? 'Processing Transcript...' : 'Generate Session Notes & Consolidate'}
              </button>
            </div>

            {scribeResult && (
              <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
                <div style={{ background: 'rgba(95,174,176,0.06)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(95,174,176,0.15)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px', fontWeight: 600 }}>Generated Session Notes</div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', color: '#EDEAE3', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{scribeResult.session_notes}</div>
                </div>
                <div style={{ background: 'rgba(217,184,115,0.06)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(217,184,115,0.15)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px', fontWeight: 600 }}>Billing & CPT Context</div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', color: '#EDEAE3', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{scribeResult.billing_context}</div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
