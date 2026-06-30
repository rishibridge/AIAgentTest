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
          <div style={{ height: '100%', overflowY: 'auto', padding: '40px 60px' }}>
            
            {/* Risk Alert Banner */}
            {handoffData?.risk_assessment && ['Medium', 'High'].includes(handoffData.risk_assessment.level) && (
              <div style={{ background: handoffData.risk_assessment.level === 'High' ? 'rgba(232,93,93,0.1)' : 'rgba(214,121,89,0.08)', borderRadius: '12px', padding: '20px 24px', marginBottom: '32px', display: 'flex', gap: '16px', alignItems: 'flex-start', border: `1px solid ${handoffData.risk_assessment.level === 'High' ? 'rgba(232,93,93,0.3)' : 'rgba(214,121,89,0.25)'}` }}>
                <AlertTriangle size={22} color={handoffData.risk_assessment.level === 'High' ? '#E85D5D' : '#D67959'} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: handoffData.risk_assessment.level === 'High' ? '#E85D5D' : '#D67959', fontSize: '0.9rem', display: 'block', marginBottom: '6px', fontFamily: "'Work Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em' }}>Safety Protocol: {handoffData.risk_assessment.level} Risk</strong>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#EDEAE3', lineHeight: 1.5, fontFamily: "'Work Sans', sans-serif" }}>
                    {handoffData.risk_assessment.details}
                  </p>
                </div>
              </div>
            )}

            {/* Clinical Narrative */}
            <div style={{ marginBottom: '48px' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#D9B873', borderBottom: '1px solid rgba(217,184,115,0.15)', paddingBottom: '10px', marginBottom: '20px', marginTop: 0 }}>Clinical Narrative</h2>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', color: '#EDEAE3', lineHeight: 1.7, maxWidth: '900px' }}>
                {typeof handoffData?.clinical_narrative === 'string' ? handoffData.clinical_narrative : JSON.stringify(handoffData?.clinical_narrative)}
              </div>
            </div>

            {/* Two-column: Themes + Evidence */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '48px' }}>
              {/* Active Themes */}
              <div>
                <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '16px', marginTop: 0, borderBottom: '1px solid rgba(95,174,176,0.15)', paddingBottom: '10px' }}>Active Themes</h3>
                <ul style={{ paddingLeft: '20px', margin: 0, fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', color: '#EDEAE3', lineHeight: 1.7 }}>
                  {handoffData?.active_themes?.map((theme, i) => <li key={i} style={{ marginBottom: '14px' }}>{theme}</li>)}
                </ul>

                {/* Clinical Hypotheses */}
                {handoffData?.hypotheses?.length > 0 && (
                  <>
                    <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#D67959', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '36px', marginBottom: '16px', borderBottom: '1px solid rgba(214,121,89,0.15)', paddingBottom: '10px' }}>Clinical Hypotheses (DDx)</h3>
                    <ul style={{ paddingLeft: '20px', margin: 0, fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', color: '#EDEAE3', lineHeight: 1.7 }}>
                      {handoffData.hypotheses.map((h, i) => <li key={i} style={{ marginBottom: '14px' }}>{typeof h === 'string' ? h : JSON.stringify(h)}</li>)}
                    </ul>
                  </>
                )}
              </div>

              {/* Evidence Tracker */}
              <div>
                <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '16px', marginTop: 0, borderBottom: '1px solid rgba(95,174,176,0.15)', paddingBottom: '10px' }}>Evidence Tracker</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {handoffData?.quotes_vs_inferences?.map((item, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.025)', padding: '16px 20px', borderRadius: '10px', borderLeft: '3px solid #D9B873' }}>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#D9B873', fontStyle: 'italic', marginBottom: '10px' }}>"{typeof item.quote === 'string' ? item.quote : JSON.stringify(item.quote)}"</div>
                      <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#5FAEB0', display: 'flex', gap: '8px' }}>
                        <span style={{ opacity: 0.6 }}>↳ Inference:</span>
                        <span>{typeof item.inference === 'string' ? item.inference : JSON.stringify(item.inference)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* DDx Evaluation Transcript */}
            {debateRaw && (
              <div style={{ marginBottom: '48px' }}>
                <button onClick={() => setShowDebateTranscript(!showDebateTranscript)} style={{ background: 'none', border: 'none', color: '#5FAEB0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: 0, fontFamily: "'Work Sans', sans-serif" }}>
                  {showDebateTranscript ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                  {showDebateTranscript ? 'Hide DDx Evaluation Transcript' : 'View DDx Evaluation Transcript'}
                </button>
                
                {showDebateTranscript && (
                  <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(95,174,176,0.15)', overflow: 'hidden' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 600 }}>Supporting Evidence (Hypothesis A)</div>
                      <div style={{ fontFamily: "monospace", fontSize: '0.85rem', color: '#A8A39A', whiteSpace: 'pre-wrap' }}>
                        {typeof debateRaw.advocate === 'string' ? debateRaw.advocate : JSON.stringify(debateRaw.advocate, null, 2)}
                      </div>
                    </div>
                    <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#D67959', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 600 }}>Rule-Out Criteria & Challenges</div>
                      <div style={{ fontFamily: "monospace", fontSize: '0.85rem', color: '#A8A39A', whiteSpace: 'pre-wrap' }}>
                        {typeof debateRaw.skeptic === 'string' ? debateRaw.skeptic : JSON.stringify(debateRaw.skeptic, null, 2)}
                      </div>
                    </div>
                    <div style={{ padding: '20px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 600 }}>Final Clinical Synthesis</div>
                      <div style={{ fontFamily: "monospace", fontSize: '0.85rem', color: '#A8A39A', whiteSpace: 'pre-wrap' }}>
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

        {/* ═══ TAB 3: DDx ARENA ═══ */}
        {mainTab === 'ddx' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Chat Messages */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 40px' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'bot' ? 'flex-start' : 'flex-end', maxWidth: '800px', margin: msg.sender === 'bot' ? '0 auto 20px 0' : '0 0 20px auto' }}>
                  <div style={{ fontSize: '0.7rem', color: msg.sender === 'bot' ? '#5FAEB0' : '#D9B873', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.08em' }}>
                    {msg.sender === 'bot' ? 'Clinical Copilot' : 'You (Clinician)'}
                    {msg.ddxRole && msg.ddxRole !== 'copilot' && (
                      <span style={{ marginLeft: '8px', color: '#A8A39A', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem' }}>
                        MODE: {msg.ddxRole.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ background: msg.sender === 'bot' ? 'rgba(95,174,176,0.08)' : 'rgba(217,184,115,0.08)', padding: '16px 20px', borderRadius: '12px', border: msg.sender === 'bot' ? '1px solid rgba(95,174,176,0.15)' : '1px solid rgba(217,184,115,0.15)', maxWidth: '700px', fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', lineHeight: 1.6, color: '#EDEAE3' }}>
                    {msg.text.split('\n').map((line, j) => <React.Fragment key={j}>{line}<br/></React.Fragment>)}
                  </div>
                </div>
              ))}
              {isSending && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#5FAEB0', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.08em' }}>Clinical Copilot</div>
                  <div style={{ background: 'rgba(95,174,176,0.08)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(95,174,176,0.15)', fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', color: '#5FAEB0' }}>
                    Analyzing clinical data...
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div style={{ padding: '20px 40px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <div style={{ fontSize: '0.7rem', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Role Injection</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                {[
                  { id: 'copilot', label: 'Copilot Mode' },
                  { id: 'defend', label: 'Defend a Diagnosis' },
                  { id: 'challenge', label: 'Challenge a Diagnosis' },
                  { id: 'compare', label: 'Compare A vs B' },
                ].map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setDdxRole(role.id)}
                    style={{
                      background: ddxRole === role.id ? 'rgba(217,184,115,0.12)' : 'none',
                      border: ddxRole === role.id ? '1px solid rgba(217,184,115,0.35)' : '1px solid rgba(255,255,255,0.1)',
                      color: ddxRole === role.id ? '#D9B873' : '#6B6560',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontFamily: "'Work Sans', sans-serif",
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {role.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="Message the DDx Copilot..."
                  style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '14px 16px', borderRadius: '8px', fontSize: '0.9rem', fontFamily: "'Work Sans', sans-serif", outline: 'none' }}
                />
                <button
                  onClick={handleSend}
                  disabled={isSending || !input.trim()}
                  style={{ background: isSending ? 'rgba(217,184,115,0.2)' : '#D9B873', border: 'none', color: '#050608', padding: '0 20px', borderRadius: '8px', cursor: isSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}
                >
                  <Send size={18} />
                </button>
              </div>
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
