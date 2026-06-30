import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, AlertTriangle, Send, ChevronDown, ChevronRight, Lock, Brain, FileText, MessageCircle, Stethoscope } from 'lucide-react';
import InteractiveGraph from './VirtualBrain';
import * as api from '../api';

export default function ClinicianChat({ patientId, patientName, onBack }) {
  const [handoffData, setHandoffData] = useState(null);
  const [debateRaw, setDebateRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Main tab state
  const [mainTab, setMainTab] = useState('summary'); // 'summary', 'graph', 'ddx', 'scribe'

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

      const res = await api.sendClinicianMessage(patientId, apiText);
      const botText = res.response?.text || res.text || 'No response generated.';
      setMessages(prev => [...prev, { sender: 'bot', text: botText }]);
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

              {/* Risk Details (if present) */}
              {handoffData?.risk_assessment && ['Medium', 'High'].includes(handoffData.risk_assessment.level) && (
                <div style={{ marginTop: '16px', padding: '14px 16px', background: handoffData.risk_assessment.level === 'High' ? 'rgba(232,93,93,0.08)' : 'rgba(214,121,89,0.06)', borderRadius: '8px', border: `1px solid ${handoffData.risk_assessment.level === 'High' ? 'rgba(232,93,93,0.2)' : 'rgba(214,121,89,0.15)'}` }}>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#EDEAE3', lineHeight: 1.5 }}>
                    <AlertTriangle size={13} color={handoffData.risk_assessment.level === 'High' ? '#E85D5D' : '#D67959'} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                    {handoffData.risk_assessment.details}
                  </div>
                </div>
              )}
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
                        {typeof debateRaw.advocate === 'string' ? debateRaw.advocate : JSON.stringify(debateRaw.advocate, null, 2)}
                      </div>
                    </div>
                    <div style={{ padding: '18px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '0.65rem', color: '#D67959', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 600 }}>Rule-Out Criteria & Challenges</div>
                      <div style={{ fontFamily: "monospace", fontSize: '0.8rem', color: '#A8A39A', whiteSpace: 'pre-wrap' }}>
                        {typeof debateRaw.skeptic === 'string' ? debateRaw.skeptic : JSON.stringify(debateRaw.skeptic, null, 2)}
                      </div>
                    </div>
                    <div style={{ padding: '18px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 600 }}>Final Clinical Synthesis</div>
                      <div style={{ fontFamily: "monospace", fontSize: '0.8rem', color: '#A8A39A', whiteSpace: 'pre-wrap' }}>
                        {typeof debateRaw.judge === 'string' ? debateRaw.judge : JSON.stringify(debateRaw.judge, null, 2)}
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
                      {msg.sender === 'bot' ? 'Clinical Copilot' : 'You (Clinician)'}
                      {msg.ddxRole && msg.ddxRole !== 'copilot' && (
                        <span style={{ marginLeft: '8px', color: '#A8A39A', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem' }}>
                          {msg.ddxRole.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ background: msg.sender === 'bot' ? 'rgba(95,174,176,0.06)' : 'rgba(217,184,115,0.06)', padding: '14px 18px', borderRadius: '10px', border: msg.sender === 'bot' ? '1px solid rgba(95,174,176,0.12)' : '1px solid rgba(217,184,115,0.12)', maxWidth: '90%', fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', lineHeight: 1.6, color: '#EDEAE3' }}>
                      {msg.text.split('\n').map((line, j) => <React.Fragment key={j}>{line}<br/></React.Fragment>)}
                    </div>
                  </div>
                ))}
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
                    { id: 'copilot', label: 'Copilot' },
                    { id: 'defend', label: 'Defend Dx' },
                    { id: 'challenge', label: 'Challenge Dx' },
                    { id: 'compare', label: 'Compare A vs B' },
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
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    placeholder="Message the DDx Copilot..."
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
