import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, AlertTriangle, Send, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import mermaid from 'mermaid';
import * as api from '../api';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: "'Work Sans', sans-serif"
});

export default function ClinicianChat({ patientId, patientName, onBack }) {
  const [handoffData, setHandoffData] = useState(null);
  const [debateRaw, setDebateRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [ddxRole, setDdxRole] = useState('copilot'); // 'copilot', 'defend', 'challenge', 'compare'
  const [isSending, setIsSending] = useState(false);
  const [showDebateTranscript, setShowDebateTranscript] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  
  // Scribe State
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'scribe'
  const [transcriptInput, setTranscriptInput] = useState('');
  const [isScribing, setIsScribing] = useState(false);
  const [scribeResult, setScribeResult] = useState(null);
  
  const graphRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchHandoff();
  }, [patientId]);

  useEffect(() => {
    if (graphRef.current && handoffData && handoffData.simplified_graph_mermaid) {
        const id = `mermaid-${Date.now()}`;
        mermaid.render(id, handoffData.simplified_graph_mermaid).then((result) => {
            if (graphRef.current) graphRef.current.innerHTML = result.svg;
        }).catch(e => {
            console.error("Mermaid error:", e);
            if (graphRef.current) graphRef.current.innerHTML = `<div style="color: #E85D5D; padding: 10px; font-family: monospace">Failed to render clinical graph.</div>`;
        });
    } else if (graphRef.current) {
        graphRef.current.innerHTML = '';
    }
  }, [handoffData, showGraph]);

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

    let apiText = text;
    if (ddxRole === 'defend') {
      apiText = `[DDX ARENA: I am proposing a diagnosis. Rule it out using graph evidence.]\n${text}`;
    } else if (ddxRole === 'challenge') {
      apiText = `[DDX ARENA: I am challenging your primary diagnosis. Defend it with specific patient quotes.]\n${text}`;
    } else if (ddxRole === 'compare') {
      apiText = `[DDX ARENA: Let's compare Hypothesis A vs Hypothesis B.]\n${text}`;
    }

    try {
      const res = await api.sendClinicianMessage(patientId, apiText);
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: res.bot_response?.text || res.text || 'Processing your clinical query...',
          significance: res.bot_response?.significance,
        },
      ]);
      if (res.bot_response?.debate) {
        setDebateRaw(res.bot_response.debate);
        setShowDebateTranscript(true);
      }
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: "Error: Could not reach Copilot API.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleScribeSubmit = async () => {
    if (!transcriptInput.trim()) return;
    try {
      setIsScribing(true);
      const res = await api.postVisitScribe(patientId, transcriptInput);
      setScribeResult(res);
    } catch (e) {
      setError(`Failed to process transcript: ${e.message}`);
    } finally {
      setIsScribing(false);
    }
  };


  const btnBaseStyle = {
    fontFamily: "'Work Sans', sans-serif",
    fontSize: '0.8rem',
    fontWeight: 500,
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
  };

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
        <button onClick={onBack} style={{ ...btnBaseStyle, background: 'rgba(255,255,255,0.1)', color: '#fff' }}>Back to Hub</button>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#050608', color: '#fff' }}>
      {/* Header */}
      <div style={{ height: '60px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', zIndex: 10 }}>
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
      </div>

      {/* Main Split View */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* LEFT PANEL: Clinical Profile */}
        <div style={{ flex: 1.5, overflowY: 'auto', padding: '32px 48px', background: '#050608' }}>
          
          {handoffData?.risk_assessment && ['Medium', 'High'].includes(handoffData.risk_assessment.level) && (
            <div style={{ background: '#D67959', borderRadius: '12px', padding: '20px', marginBottom: '32px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <AlertTriangle size={24} color="#050608" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#050608', fontSize: '1.2rem', display: 'block', marginBottom: '8px', fontFamily: "'Work Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em' }}>Safety Protocol: {handoffData.risk_assessment.level} Risk</strong>
                <p style={{ margin: 0, fontSize: '1rem', color: '#050608', lineHeight: 1.5, fontFamily: "'Work Sans', sans-serif", fontWeight: 500 }}>
                  {handoffData.risk_assessment.details}
                </p>
              </div>
            </div>
          )}

          {/* Zone 2: The Human Narrative */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#D9B873', borderBottom: '1px solid rgba(217,184,115,0.2)', paddingBottom: '8px', marginBottom: '16px' }}>Transfer Summary</h2>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#EDEAE3', lineHeight: 1.6 }}>
              {typeof handoffData?.clinical_narrative === 'string' ? handoffData.clinical_narrative : JSON.stringify(handoffData?.clinical_narrative)}
            </div>
            
            {/* Actionability: Recommendations for Today's Session */}
            {handoffData?.recommendations && handoffData.recommendations.length > 0 && (
              <div style={{ marginTop: '32px', background: 'rgba(95,174,176,0.05)', borderRadius: '12px', padding: '24px', border: '1px solid rgba(95,174,176,0.2)' }}>
                <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.1rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ChevronRight size={20} /> Suggested Clinical Focus
                </h3>
                <ul style={{ paddingLeft: '24px', margin: 0, fontFamily: "'Work Sans', sans-serif", fontSize: '1rem', color: '#EDEAE3', lineHeight: 1.6 }}>
                  {handoffData.recommendations.map((rec, idx) => (
                    <li key={idx} style={{ marginBottom: '12px' }}>{typeof rec === 'string' ? rec : JSON.stringify(rec)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Zone 3: The Clinical Core (Split-Pane) */}
          <div style={{ display: 'flex', gap: '32px', marginBottom: '40px' }}>
            
            {/* Left Column: Strategy */}
            <div style={{ flex: 1 }}>
              <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', borderBottom: '1px solid rgba(95,174,176,0.2)', paddingBottom: '8px' }}>Active Themes</h3>
              <ul style={{ paddingLeft: '20px', margin: 0, fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', color: '#EDEAE3', lineHeight: 1.6 }}>
                {handoffData?.active_themes?.map((theme, i) => <li key={i} style={{ marginBottom: '12px' }}>{theme}</li>)}
              </ul>
              
              <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '32px', marginBottom: '16px', borderBottom: '1px solid rgba(95,174,176,0.2)', paddingBottom: '8px' }}>Clinical Hypotheses (DDx)</h3>
              <ul style={{ paddingLeft: '20px', margin: 0, fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', color: '#EDEAE3', lineHeight: 1.6 }}>
                {handoffData?.hypotheses?.map((h, i) => <li key={i} style={{ marginBottom: '12px' }}>{typeof h === 'string' ? h : JSON.stringify(h)}</li>)}
              </ul>
            </div>
            
            {/* Right Column: Evidence Tracker */}
            <div style={{ flex: 1.5 }}>
              <h3 style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', borderBottom: '1px solid rgba(95,174,176,0.2)', paddingBottom: '8px' }}>Evidence Tracker</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {handoffData?.quotes_vs_inferences?.map((item, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', borderLeft: '3px solid #D9B873' }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#D9B873', fontStyle: 'italic', marginBottom: '8px' }}>"{typeof item.quote === 'string' ? item.quote : JSON.stringify(item.quote)}"</div>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', color: '#5FAEB0', display: 'flex', gap: '8px' }}>
                      <span style={{ opacity: 0.7 }}>↳ Inference:</span>
                      <span>{typeof item.inference === 'string' ? item.inference : JSON.stringify(item.inference)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          {/* Zone 4: The Deep Dive (Collapsed Graph & Transcript) */}
          <div style={{ marginBottom: '40px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
            <button onClick={() => setShowGraph(!showGraph)} style={{ background: 'none', border: 'none', fontFamily: "'Work Sans', sans-serif", fontSize: '1rem', color: '#A8A39A', cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: 0 }}>
              {showGraph ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
              Explore Raw Behavioral Graph (Deep Dive)
            </button>
            {showGraph && handoffData?.simplified_graph_mermaid && (
              <div style={{ marginTop: '24px', background: '#11141A', padding: '32px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                <div ref={graphRef} style={{ width: '100%', minHeight: '200px' }}></div>
              </div>
            )}
          </div>
            
            {/* DDx Evaluation Transcript Toggle */}
            {debateRaw && (
              <div style={{ marginTop: '24px' }}>
                <button onClick={() => setShowDebateTranscript(!showDebateTranscript)} style={{ background: 'none', border: 'none', color: '#5FAEB0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: 0, fontFamily: "'Work Sans', sans-serif" }}>
                  {showDebateTranscript ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                  {showDebateTranscript ? 'Hide DDx Evaluation Transcript' : 'View DDx Evaluation Transcript'}
                </button>
                
                {showDebateTranscript && (
                  <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(95,174,176,0.2)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Supporting Evidence (Hypothesis A)</div>
                      <div style={{ fontFamily: "monospace", fontSize: '0.85rem', color: '#A8A39A', whiteSpace: 'pre-wrap' }}>
                        {typeof debateRaw.advocate === 'string' ? debateRaw.advocate : JSON.stringify(debateRaw.advocate, null, 2)}
                      </div>
                    </div>
                    <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#D67959', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Rule-Out Criteria & Challenges</div>
                      <div style={{ fontFamily: "monospace", fontSize: '0.85rem', color: '#A8A39A', whiteSpace: 'pre-wrap' }}>
                        {typeof debateRaw.skeptic === 'string' ? debateRaw.skeptic : JSON.stringify(debateRaw.skeptic, null, 2)}
                      </div>
                    </div>
                    <div style={{ padding: '16px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Final Clinical Synthesis</div>
                      <div style={{ fontFamily: "monospace", fontSize: '0.85rem', color: '#A8A39A', whiteSpace: 'pre-wrap' }}>
                        {typeof debateRaw.judge === 'string' ? debateRaw.judge : JSON.stringify(debateRaw.judge, null, 2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quotes vs Inferences */}
          {handoffData?.quotes_vs_inferences?.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: '#D9B873', borderBottom: '1px solid rgba(217,184,115,0.2)', paddingBottom: '8px', marginBottom: '16px' }}>Evidence Tracker</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {handoffData.quotes_vs_inferences.map((q, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', borderLeft: '3px solid #5FAEB0' }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#EDEAE3', fontStyle: 'italic', marginBottom: '12px' }}>"{typeof q.quote === 'string' ? q.quote : JSON.stringify(q.quote)}"</div>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', color: '#5FAEB0', display: 'flex', gap: '8px' }}>
                      <span style={{ opacity: 0.7 }}>↳ Inference:</span>
                      <span>{typeof q.inference === 'string' ? q.inference : JSON.stringify(q.inference)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SOAP Note */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: '#D9B873', borderBottom: '1px solid rgba(217,184,115,0.2)', paddingBottom: '8px', marginBottom: '16px' }}>Generated SOAP Note</h2>
            <pre style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', color: '#EDEAE3', lineHeight: 1.7, background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {typeof handoffData?.soap_note === 'string' ? handoffData.soap_note : JSON.stringify(handoffData?.soap_note, null, 2)}
            </pre>
          </div>

        </div>

        {/* RIGHT PANEL: Interactive DDx Arena & Post-Visit Scribe */}
        <div style={{ width: '480px', display: 'flex', flexDirection: 'column', background: '#0A0C10', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
          
          <div style={{ padding: '0', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex' }}>
            <button
              onClick={() => setActiveTab('chat')}
              style={{ flex: 1, padding: '16px', background: activeTab === 'chat' ? 'rgba(217,184,115,0.1)' : 'transparent', border: 'none', borderBottom: activeTab === 'chat' ? '2px solid #D9B873' : '2px solid transparent', color: activeTab === 'chat' ? '#D9B873' : '#9B9285', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Work Sans', sans-serif" }}
            >
              Interactive DDx
            </button>
            <button
              onClick={() => setActiveTab('scribe')}
              style={{ flex: 1, padding: '16px', background: activeTab === 'scribe' ? 'rgba(95,174,176,0.1)' : 'transparent', border: 'none', borderBottom: activeTab === 'scribe' ? '2px solid #5FAEB0' : '2px solid transparent', color: activeTab === 'scribe' ? '#5FAEB0' : '#9B9285', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Work Sans', sans-serif" }}
            >
              Post-Visit Scribe
            </button>
          </div>

          {activeTab === 'chat' && (
            <>
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {messages.map((msg, i) => (
              <div key={i} className="fade-enter-active" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'bot' ? 'flex-start' : 'flex-end' }}>
                <div style={{ fontSize: '0.7rem', color: msg.sender === 'bot' ? '#5FAEB0' : '#D9B873', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.08em' }}>
                  {msg.sender === 'bot' ? 'Clinical Copilot' : 'You (Clinician)'}
                  {msg.ddxRole && msg.ddxRole !== 'copilot' && (
                    <span style={{ marginLeft: '8px', color: '#A8A39A', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                      MODE: {msg.ddxRole.toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ background: msg.sender === 'bot' ? 'rgba(95,174,176,0.1)' : 'rgba(217,184,115,0.1)', padding: '14px 18px', borderRadius: '12px', border: msg.sender === 'bot' ? '1px solid rgba(95,174,176,0.2)' : '1px solid rgba(217,184,115,0.2)', maxWidth: '90%', fontFamily: "'Work Sans', sans-serif", fontSize: '0.95rem', lineHeight: 1.5, color: '#EDEAE3' }}>
                  {msg.text.split('\n').map((line, j) => <React.Fragment key={j}>{line}<br/></React.Fragment>)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.7rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Role Injection</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {[
                { id: 'copilot', label: 'Copilot Mode' },
                { id: 'defend', label: '[Defend a Diagnosis]' },
                { id: 'challenge', label: '[Challenge a Diagnosis]' },
                { id: 'compare', label: '[Compare A vs B]' },
              ].map((role) => (
                <button
                  key={role.id}
                  onClick={() => setDdxRole(role.id)}
                  style={{
                    background: ddxRole === role.id ? 'rgba(217,184,115,0.15)' : 'none',
                    border: ddxRole === role.id ? '1px solid rgba(217,184,115,0.4)' : '1px solid rgba(255,255,255,0.15)',
                    color: ddxRole === role.id ? '#D9B873' : '#9B9285',
                    padding: '6px 12px',
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
                style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '14px 16px', borderRadius: '8px', fontSize: '0.9rem', fontFamily: "'Work Sans', sans-serif", outline: 'none' }}
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
            </>
          )}

          {activeTab === 'scribe' && (
            <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#D9B873', marginBottom: '8px' }}>Post-Visit Scribe</div>
              <div style={{ fontSize: '0.9rem', color: '#9B9285', lineHeight: 1.5 }}>
                Paste the transcript of your therapy session here. The system will automatically generate clinical session notes (SOAP), identify billable elements, and consolidate insights into the patient's memory graph.
              </div>
              <textarea
                value={transcriptInput}
                onChange={(e) => setTranscriptInput(e.target.value)}
                placeholder="Paste session transcript here..."
                style={{ flex: 1, minHeight: '200px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '16px', borderRadius: '8px', fontSize: '0.9rem', fontFamily: "'Work Sans', sans-serif", outline: 'none', resize: 'vertical' }}
              />
              <button
                onClick={handleScribeSubmit}
                disabled={isScribing || !transcriptInput.trim()}
                style={{ background: isScribing ? 'rgba(217,184,115,0.2)' : '#D9B873', color: '#050608', padding: '14px', borderRadius: '8px', cursor: isScribing ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '1rem', border: 'none', transition: 'background 0.2s' }}
              >
                {isScribing ? 'Processing Transcript...' : 'Generate Session Notes & Consolidate'}
              </button>

              {scribeResult && (
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ background: 'rgba(95,174,176,0.1)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(95,174,176,0.2)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 'bold' }}>Generated Session Notes</div>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', color: '#EDEAE3', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{scribeResult.session_notes}</div>
                  </div>
                  <div style={{ background: 'rgba(217,184,115,0.1)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(217,184,115,0.2)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 'bold' }}>Billing & CPT Context</div>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem', color: '#EDEAE3', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{scribeResult.billing_context}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
