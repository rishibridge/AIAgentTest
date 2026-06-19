import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, FastForward, StepForward, StepBack, Send, Loader2 } from 'lucide-react';
import VirtualBrain from './components/VirtualBrain';
import InsightPanel from './components/InsightPanel';
import NodeDetailPanel from './components/NodeDetailPanel';
import {
  COLORS, COLORS_DARK, FONT_DISPLAY, FONT_SERIF, FONT_SANS,
  ELENA_NODE_POSITIONS, ELENA_NODES_INITIAL, ELENA_EDGES_INITIAL,
  ELENA_CONVERSATION, ELENA_NODES_AFTER_SESSION, ELENA_EDGES_AFTER_SESSION,
  ELENA_HANDOFF_PACKAGE, ELENA_NEXT_CONVERSATION, ELENA_NODES_AFTER_PATEL, ELENA_EDGES_AFTER_PATEL,
  ELENA_NODES_AFTER_CONSOLIDATION, ELENA_EDGES_AFTER_CONSOLIDATION,
  DANIEL_NODE_POSITIONS, DANIEL_NODES_INITIAL, DANIEL_EDGES_INITIAL,
  DANIEL_CONVERSATION, DANIEL_NODES_AFTER_SESSION, DANIEL_EDGES_AFTER_SESSION,
  DANIEL_NODES_AFTER_CONSOLIDATION, DANIEL_EDGES_AFTER_CONSOLIDATION,
  DANIEL_NODES_AFTER_CLINICIANS, DANIEL_EDGES_AFTER_CLINICIANS,
  DANIEL_TRAN_PACKAGE, DANIEL_PATEL_PACKAGE,
  PHASE, PHASE_LABELS,
} from './data';
import * as api from './api';

/* ═══════════════════════════════════════════════════════════════════
 * WOW MOMENTS — Insight overlays at specific chat indices
 * ═══════════════════════════════════════════════════════════════════ */
const WOW_MOMENTS = {
  elena_chat: {
    2: { duration: 8000, highlight: ['sofia'], insight: { title: "ALLY REMEMBERS", body: "Unlike standard LLMs, Ally remembers the emotional context of previous conversations without being prompted, making the patient feel known immediately." } },
    9: { duration: 8000, highlight: ['sleep_disturbed', 'kitchen_counter', 'elena'], insight: { title: "ALLY REMEMBERS", body: "Elena mentions insomnia. Ally immediately connects it to the 'kitchen counter' incident from 3 weeks ago without being prompted. This is clinical inference." } },
    16: { duration: 8000, highlight: ['daniel'], insight: { title: "ALLY KNOWS YOU", body: "ChatGPT wouldn't know her son's birthday. Ally maintains a persistent, multi-dimensional memory of the patient's entire life and family system." } },
    26: { duration: 8000, highlight: ['secret_hope', 'belief_god_will_fix', 'daniel'], insight: { title: "ALLY CARES", body: "Elena confesses a dark, shameful secret: hoping her son's wedding doesn't happen. A human might judge. Ally holds this contradiction objectively with deep care." } },
    41: { duration: 8000, highlight: ['depression', 'anxiety'], insight: { title: "ALLY REMEMBERS", body: "Ally doesn't just know she tried therapy; it knows exactly *when* and *why* she tried it based on previous disclosures, proving a deep clinical history." } },
    49: { duration: 8000, highlight: ['therapist_locked'], insight: { title: "ALLY CARES", body: "Elena explicitly asks Ally to hide trauma and substance abuse from her doctor. Ally respects the clinical firewall, building profound trust." } }
  },
  elena_next_chat: {
    3: { duration: 10000, highlight: ['therapist_locked'], insight: { title: "ALLY CARES", body: "Dr. Patel securely updated the AI on a childhood trauma disclosure. Instead of blindly asking 'How was therapy?', the AI demonstrates deep clinical empathy by acknowledging the difficulty and proactively enforcing the boundary." } }
  },
  daniel_chat: {
    7: { duration: 8000, highlight: ['elena'], insight: { title: "ALLY KNOWS YOU", body: "Ally instantly recalls his mother's birthday without missing a beat, challenging his rationale for wanting to call." } },
    9: { duration: 8000, highlight: ['sofia', 'elena'], insight: { title: "ALLY REMEMBERS", body: "Daniel is Elena's son. Ally possesses an encyclopedic memory of the entire family system, accurately pointing out a shift in his sister's behavior based on years of context." } },
    19: { duration: 8000, highlight: ['prep_regimen', 'avoidance_prep', 'anxiety_stigma'], insight: { title: "ALLY CARES", body: "Daniel admits to avoiding HIV testing and PrEP out of pure fear. Ally remains neutral and caring, keeping the patient engaged instead of alienating him." } },
    26: { duration: 8000, highlight: ['tran_referral', 'prep_regimen'], insight: { title: "ALLY COLLABORATES", body: "Ally navigates complex biomedical reality (the PEP window is closed, PrEP/testing is needed) and seamlessly bridges the gap from therapy to a warm handoff for medical testing." } }
  }
};

/* ═══════════════════════════════════════════════════════════════════
 * PHASES — internal phase names for CinematicDemo compatibility
 * ═══════════════════════════════════════════════════════════════════ */
const PHASES = [
  'elena_profile',
  'elena_graph_intro',
  'elena_graph',
  'elena_chat',
  'elena_consolidation',
  'elena_handoff',
  'elena_provider_response',
  'elena_next_chat',
  'transition_daniel',
  'daniel_graph',
  'daniel_chat',
  'daniel_consolidation',
  'daniel_handoff',
  'daniel_updates',
  'family_system',
  'end'
];

/* ═══════════════════════════════════════════════════════════════════
 * HANDOFF CARD COMPONENT
 * ═══════════════════════════════════════════════════════════════════ */
function HandoffCard({ data, accent = '#D9B873' }) {
  return (
    <div className="fade-enter-active" style={{ padding: '32px', overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2rem', color: accent, marginBottom: '24px' }}>Handoff Package</h2>
      <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>To:</strong> {data.recipient}</div>
      <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>Context:</strong><br/>{data.context}</div>
      <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>Summary:</strong><br/>{data.summary}</div>
      <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>Authorized Context:</strong>
        <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>{data.authorized.map((item, i) => <li key={i} style={{ marginBottom: '6px' }}>{item}</li>)}</ul>
      </div>
      <div style={{ color: '#E85D5D', marginBottom: '16px' }}><strong style={{ color: '#E85D5D' }}>Firewall Locked:</strong>
        <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>{data.excluded.map((item, i) => <li key={i} style={{ marginBottom: '6px' }}>{item}</li>)}</ul>
      </div>
      {data.notes && data.notes.length > 0 && (
        <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>Clinical Notes:</strong>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>{data.notes.map((item, i) => <li key={i} style={{ marginBottom: '6px' }}>{item}</li>)}</ul>
        </div>
      )}
      {data.hypotheses && data.hypotheses.length > 0 && (
        <div style={{ marginBottom: '16px' }}><strong style={{ color: '#D4A645' }}>Bot Hypotheses:</strong>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>{data.hypotheses.map((item, i) => <li key={i} style={{ marginBottom: '6px', fontStyle: 'italic' }}>{item}</li>)}</ul>
        </div>
      )}
      {data.family_overlap_flag && (
        <div style={{ marginTop: '16px', padding: '12px', border: '1px solid rgba(200, 72, 72, 0.4)', borderRadius: '8px', background: 'rgba(200, 72, 72, 0.08)', color: '#C84848' }}>
          <strong>⚠ Family Overlap Flag:</strong><br/>{data.family_overlap_flag}
        </div>
      )}
      <div style={{ marginTop: '16px', padding: '12px', border: '1px solid rgba(77, 184, 184, 0.2)', borderRadius: '8px', fontSize: '0.9rem', color: '#5FAEB0' }}>
        <strong>Consent:</strong> {data.consent}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * CONSOLIDATION PANEL — 5-step viewer
 * ═══════════════════════════════════════════════════════════════════ */
const CONSOLIDATION_STEPS = [
  { title: 'Session ended', desc: 'Working memory holds the conversation. Long-term memory has not yet been updated.', accent: '#5FAEB0' },
  { title: 'Significance filtering', desc: 'Surface content filtered out. High-significance disclosures encoded as new nodes with weighted prominence.', accent: '#D4A645' },
  { title: 'Credibility weighting', desc: 'Inconsistencies between disclosures and prior knowledge are held as flagged divergence rather than collapsed. The bot does not naively overwrite.', accent: '#C84848' },
  { title: 'Node merging & edge thickening', desc: 'Repeated content consolidates. Reinforced relationships strengthen. Graph becomes more compact and accurate.', accent: '#5FAEB0' },
  { title: 'Inferred edges drawn', desc: 'Bot generates hypotheses connecting nodes the patient has not explicitly linked. These appear dashed for clinician review and possible confirmation.', accent: '#9E7E3A' },
];

function ConsolidationPanel({ isElena }) {
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setActiveStep(s => s < 4 ? s + 1 : s), 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fade-enter-active" style={{ padding: '32px', overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2rem', color: '#D4A645', marginBottom: '24px' }}>Memory Consolidation</h2>
      <div style={{ fontSize: '0.8rem', color: '#9B9285', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {isElena ? 'Elena Ramirez' : 'Daniel Ramirez'} • Post-session processing
      </div>
      {CONSOLIDATION_STEPS.map((step, i) => (
        <div key={i} className={i <= activeStep ? 'fade-enter-active' : ''} style={{
          marginBottom: '16px', padding: '16px', borderRadius: '8px',
          background: i <= activeStep ? 'rgba(255,255,255,0.05)' : 'transparent',
          borderLeft: `3px solid ${i <= activeStep ? step.accent : 'rgba(255,255,255,0.1)'}`,
          opacity: i <= activeStep ? 1 : 0.3,
          transition: 'all 0.5s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: i <= activeStep ? step.accent : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#050608' }}>{i + 1}</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{step.title}</div>
          </div>
          {i <= activeStep && <div style={{ marginLeft: '36px', fontSize: '0.85rem', color: '#A8A39A', lineHeight: 1.6 }}>{step.desc}</div>}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * LIVE CHAT COMPONENT — Real LLM-powered conversation
 * ═══════════════════════════════════════════════════════════════════ */
function LiveChat({ patientId, patientName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Start a new conversation
    api.startConversation(patientId, 'Live session').then(res => {
      setConvId(res.conversation_id);
    }).catch(console.error);
  }, [patientId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !convId || loading) return;
    const text = input.trim();
    setInput('');
    setMessages(m => [...m, { sender: patientName.split(' ')[0].toLowerCase(), text }]);
    setLoading(true);
    try {
      const res = await api.sendMessage(patientId, convId, text);
      setMessages(m => [...m, { sender: 'bot', text: res.bot_response.text, significance: res.bot_response.significance }]);
    } catch (e) {
      setMessages(m => [...m, { sender: 'bot', text: 'I hear you. Tell me more about what you\'re feeling.' }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        <span>Live Conversation • Real-Time</span>
        <span style={{ color: '#4DB8B8', marginLeft: '16px' }}>LLM-Powered</span>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {messages.map((msg, i) => (
          <div key={i} className="fade-enter-active" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'bot' ? 'flex-start' : 'flex-end' }}>
            <div style={{ fontSize: '0.75rem', color: '#9B9285', textTransform: 'uppercase', marginBottom: '4px' }}>{msg.sender === 'bot' ? 'Ally' : patientName.split(' ')[0]}</div>
            <div style={{ background: msg.sender === 'bot' ? 'rgba(77, 184, 184, 0.15)' : 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '12px', border: msg.sender === 'bot' ? '1px solid rgba(77,184,184,0.3)' : 'none', maxWidth: '85%' }}>
              {msg.text}
              {msg.significance && <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#D4A645', textTransform: 'uppercase', letterSpacing: '0.1em' }}>★ significance moment</div>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="fade-enter-active" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5FAEB0', fontSize: '0.85rem' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Ally is thinking...
          </div>
        )}
      </div>
      <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={`Talk to Ally as ${patientName.split(' ')[0]}...`}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEAE3', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
          />
          <button onClick={handleSend} disabled={loading || !input.trim()} style={{ background: loading ? 'rgba(77,184,184,0.2)' : '#5FAEB0', border: 'none', color: '#050608', padding: '12px 16px', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * MAIN APP — 16-phase presentation shell (pixel-perfect CinematicDemo port)
 * ═══════════════════════════════════════════════════════════════════ */
function App() {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [chatIndex, setChatIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false); // Start paused for manual control
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [presenterMode, setPresenterMode] = useState(false);
  const [detailKind, setDetailKind] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [liveMode, setLiveMode] = useState(false); // Toggle for live LLM chat
  const chatContainerRef = useRef(null);

  const phase = PHASES[phaseIdx] || 'end';
  const isElena = phase.includes('elena') || phase === 'elena_profile';
  const context = isElena ? 'elena' : 'daniel';

  let conversation = isElena ? ELENA_CONVERSATION : DANIEL_CONVERSATION;
  if (phase === 'elena_next_chat') conversation = ELENA_NEXT_CONVERSATION;

  let packageData = isElena ? ELENA_HANDOFF_PACKAGE : DANIEL_TRAN_PACKAGE;

  const wowMoment = (phase === 'elena_chat' && WOW_MOMENTS.elena_chat[chatIndex]) ||
                    (phase === 'elena_next_chat' && WOW_MOMENTS.elena_next_chat[chatIndex]) ||
                    (phase === 'daniel_chat' && WOW_MOMENTS.daniel_chat[chatIndex]);

  const forceNext = () => {
    setIsPlaying(false);
    if (phase.includes('chat') && chatIndex < conversation.length - 1) {
      setChatIndex(c => c + 1);
    } else if (phaseIdx < PHASES.length - 1) {
      setPhaseIdx(p => p + 1);
      setChatIndex(0);
    }
  };

  const forcePrev = () => {
    setIsPlaying(false);
    if (phase.includes('chat') && chatIndex > 0) {
      setChatIndex(c => c - 1);
    } else if (phaseIdx > 0) {
      setPhaseIdx(p => p - 1);
      setChatIndex(0);
    }
  };

  const skipPhase = () => {
    if (phaseIdx < PHASES.length - 1) {
      setPhaseIdx(p => p + 1);
      setChatIndex(0);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); forceNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); forcePrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Auto-advance
  useEffect(() => {
    if (!isPlaying || phase === 'end') return;
    let delay = 3000;
    if (phase === 'elena_profile') { delay = 10000; const t = setTimeout(() => setPhaseIdx(p => p + 1), delay / speedMultiplier); return () => clearTimeout(t); }
    if (phase.includes('graph')) { delay = 5000; const t = setTimeout(() => setPhaseIdx(p => p + 1), delay / speedMultiplier); return () => clearTimeout(t); }
    if (phase.includes('handoff') || phase.includes('provider') || phase.includes('transition') || phase.includes('consolidation') || phase.includes('updates') || phase === 'family_system') {
      delay = 8000; const t = setTimeout(() => setPhaseIdx(p => p + 1), delay / speedMultiplier); return () => clearTimeout(t);
    }
    if (phase.includes('chat')) {
      if (wowMoment) { delay = wowMoment.duration; } else { delay = Math.max(1500, conversation[chatIndex].text.length * 40); }
      const t = setTimeout(() => { if (chatIndex < conversation.length - 1) { setChatIndex(c => c + 1); } else { setChatIndex(0); setPhaseIdx(p => p + 1); } }, delay / speedMultiplier);
      return () => clearTimeout(t);
    }
  }, [phaseIdx, chatIndex, isPlaying, phase, conversation, wowMoment, speedMultiplier]);

  // Auto-scroll chat
  useEffect(() => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    setDetailKind(null); setDetailTarget(null);
  }, [chatIndex, phase]);

  // ── Graph state selection ────────────────────────────────────────
  let nodes = isElena ? ELENA_NODES_INITIAL : DANIEL_NODES_INITIAL;
  let edges = isElena ? ELENA_EDGES_INITIAL : DANIEL_EDGES_INITIAL;
  let positions = isElena ? ELENA_NODE_POSITIONS : DANIEL_NODE_POSITIONS;
  let highlight = [];
  let insight = null;
  let viewBox = "0 0 1100 620";
  let showFirewall = false;

  if (phase === 'family_system') {
    nodes = [...ELENA_NODES_AFTER_PATEL, ...DANIEL_NODES_INITIAL];
    edges = [...ELENA_EDGES_AFTER_PATEL, ...DANIEL_EDGES_INITIAL];
    const combinedPositions = {};
    Object.keys(ELENA_NODE_POSITIONS).forEach(id => { combinedPositions[id] = { x: ELENA_NODE_POSITIONS[id].x - 400, y: ELENA_NODE_POSITIONS[id].y }; });
    Object.keys(DANIEL_NODE_POSITIONS).forEach(id => { combinedPositions[id] = { x: DANIEL_NODE_POSITIONS[id].x + 400, y: DANIEL_NODE_POSITIONS[id].y }; });
    positions = combinedPositions;
    viewBox = "-400 0 1900 620";
    showFirewall = true;
    insight = { title: "THE FIREWALL", body: "Ally maps the entire family system to generate clinical insight, but enforces absolute cryptographic isolation between patients." };
  } else if (phase === 'elena_graph' || phase === 'elena_graph_intro') {
    insight = { title: "ALLY KNOWS YOU", body: "Ally builds a living, multidimensional neural map of beliefs, events, and family systems, holding contradictions objectively." };
  } else if (phase === 'daniel_graph') {
    insight = { title: "ALLY KNOWS YOU", body: "Different patient. Different neural architecture. Watch how Ally handles Daniel's intense shame and clinical non-compliance." };
  } else if (phase === 'elena_chat') {
    if (chatIndex > 8) { nodes = ELENA_NODES_AFTER_SESSION; edges = ELENA_EDGES_AFTER_SESSION; }
    if (wowMoment) { highlight = wowMoment.highlight; insight = wowMoment.insight; }
  } else if (phase === 'elena_consolidation') {
    nodes = ELENA_NODES_AFTER_CONSOLIDATION; edges = ELENA_EDGES_AFTER_CONSOLIDATION;
    insight = { title: "ALLY CONSOLIDATES", body: "The 5-step post-session pipeline filters significance, checks credibility, merges nodes, thickens edges, and generates inferred connections." };
  } else if (phase === 'elena_handoff') {
    nodes = ELENA_NODES_AFTER_SESSION; edges = ELENA_EDGES_AFTER_SESSION;
    highlight = ['patel_referral'];
    insight = { title: "ALLY COLLABORATES", body: "Hours of unstructured, emotional chatting are synthesized into a precise clinical brief delivered 'warm' to the provider." };
  } else if (phase === 'elena_provider_response') {
    nodes = ELENA_NODES_AFTER_PATEL; edges = ELENA_EDGES_AFTER_PATEL;
    highlight = ['therapist_locked'];
    insight = { title: "ALLY COLLABORATES", body: "Dr. Patel securely updates the AI post-session. The graph updates to lock down trauma areas, ensuring the AI and Provider act as a unified clinical team." };
  } else if (phase === 'elena_next_chat') {
    nodes = ELENA_NODES_AFTER_PATEL; edges = ELENA_EDGES_AFTER_PATEL;
    if (wowMoment) { highlight = wowMoment.highlight; insight = wowMoment.insight; }
  } else if (phase === 'daniel_chat') {
    if (chatIndex > 12) { nodes = DANIEL_NODES_AFTER_SESSION; edges = DANIEL_EDGES_AFTER_SESSION; }
    if (wowMoment) { highlight = wowMoment.highlight; insight = wowMoment.insight; }
  } else if (phase === 'daniel_consolidation') {
    nodes = DANIEL_NODES_AFTER_CONSOLIDATION; edges = DANIEL_EDGES_AFTER_CONSOLIDATION;
    insight = { title: "ALLY CONSOLIDATES", body: "Daniel's avoidance of testing is inferred to be connected to fear of disrupting what Marco represents." };
  } else if (phase === 'daniel_handoff') {
    nodes = DANIEL_NODES_AFTER_SESSION; edges = DANIEL_EDGES_AFTER_SESSION;
    highlight = ['tran_referral'];
  } else if (phase === 'daniel_updates') {
    nodes = DANIEL_NODES_AFTER_CLINICIANS; edges = DANIEL_EDGES_AFTER_CLINICIANS;
    highlight = ['hiv_negative', 'descovy_initiated'];
    insight = { title: "ALLY COLLABORATES", body: "Both Dr. Tran and Dr. Patel report back. The graph evolves. An inferred edge is confirmed. The bot adapts." };
  }

  const btnStyle = { background: 'none', border: 'none', color: '#D9B873', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' };

  // ── Transition screens ───────────────────────────────────────────
  if (phase === 'transition_daniel') {
    return (
      <div className="fade-enter-active" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#050608', color: '#fff', padding: '0 20%' }}>
        <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300, marginBottom: '20px', textAlign: 'center' }}>
          Empathy is easy when the patient is cooperative.
        </h2>
        <h1 style={{ fontFamily: 'Work Sans', fontSize: '2rem', color: '#EDEAE3', letterSpacing: '0.05em', fontWeight: 300, textAlign: 'center', lineHeight: 1.6, marginBottom: '40px' }}>
          Let's see what Ally does when the patient is avoiding medical care due to shame and fear.
        </h1>
        <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '4rem', color: '#D9B873', fontWeight: 600 }}>
          Meet Daniel.
        </h2>
        <div style={{ marginTop: '40px', display: 'flex', gap: '16px' }}>
          <button onClick={forcePrev} style={{ ...btnStyle, fontSize: '0.9rem', gap: '8px' }}><StepBack size={16} /> Back</button>
          <button onClick={forceNext} style={{ ...btnStyle, fontSize: '0.9rem', gap: '8px' }}>Continue <StepForward size={16} /></button>
        </div>
      </div>
    );
  }

  if (phase === 'end') {
    return (
      <div className="fade-enter-active" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#050608', color: '#fff' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3.5rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300 }}>Ally Remembers.</h2>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3.5rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300 }}>Ally Knows You.</h2>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3.5rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300 }}>Ally Cares.</h2>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3.5rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300 }}>Ally Collaborates.</h2>
        </div>
        <h1 style={{ fontFamily: 'Work Sans', fontSize: '2rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600 }}>
          Your Ally is there for you.
        </h1>
        <div style={{ marginTop: '60px', display: 'flex', gap: '24px' }}>
          <button
            onClick={() => { setPhaseIdx(0); setChatIndex(0); setIsPlaying(false); setSpeedMultiplier(1); }}
            style={{ background: 'none', border: '1px solid rgba(217,184,115,0.5)', color: '#D9B873', padding: '16px 32px', borderRadius: '30px', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.3s' }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#D9B873'; e.currentTarget.style.color = '#050608'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#D9B873'; }}
          >
            <RotateCcw size={20} /> Restart Demonstration
          </button>
          <button
            onClick={() => setLiveMode(true)}
            style={{ background: '#5FAEB0', border: 'none', color: '#050608', padding: '16px 32px', borderRadius: '30px', fontSize: '1rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <Send size={20} /> Try Live Conversation
          </button>
        </div>
        {liveMode && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#050608', zIndex: 100, display: 'flex' }}>
            <div style={{ flex: 1, padding: '8px' }}>
              <VirtualBrain nodes={ELENA_NODES_AFTER_PATEL} edges={ELENA_EDGES_AFTER_PATEL} positions={ELENA_NODE_POSITIONS} highlight={[]} viewBox="0 0 1100 620" showFirewall={false} opacity={1}
                onNodeClick={(n) => { setDetailKind('node'); setDetailTarget(n); }}
                onEdgeClick={(e) => { setDetailKind('edge'); setDetailTarget(e); }}
                onBackgroundClick={() => { setDetailKind(null); setDetailTarget(null); }}
              />
            </div>
            <div style={{ width: '400px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Cormorant Garamond', color: '#D9B873' }}>Live Chat</span>
                <button onClick={() => setLiveMode(false)} style={{ ...btnStyle, fontSize: '0.8rem' }}>✕ Close</button>
              </div>
              <LiveChat patientId="elena-ramirez-001" patientName="Elena Ramirez" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#050608', color: '#fff' }}>
      {/* Header & Controls */}
      <div style={{ height: '60px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', zIndex: 10 }}>
        <div style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.5rem', color: '#D9B873' }}>Castle Behavioral Health</div>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: '30px' }}>
          <button onClick={() => setPresenterMode(!presenterMode)} style={{...btnStyle, color: presenterMode ? '#D9B873' : '#9B9285', border: presenterMode ? '1px solid #D9B873' : '1px solid rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem'}} title="Toggle Presenter Mode">
            {presenterMode ? 'Presenter Mode' : 'Standalone Mode'}
          </button>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '16px' }}>
            <span style={{ fontSize: '0.75rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Speed ({speedMultiplier}x)</span>
            <input type="range" min="0.5" max="4" step="0.5" value={speedMultiplier} onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))} style={{ width: '80px', cursor: 'pointer', accentColor: '#D9B873' }} />
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={forcePrev} style={btnStyle} title="Step Back"><StepBack size={18} /></button>
            <button onClick={() => setIsPlaying(!isPlaying)} style={{ ...btnStyle, color: '#fff' }} title={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button onClick={forceNext} style={btnStyle} title="Step Forward"><StepForward size={18} /></button>
          </div>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={skipPhase} style={btnStyle} title="Skip to Next Phase"><FastForward size={18} /></button>
            <button onClick={() => { setPhaseIdx(0); setChatIndex(0); setIsPlaying(false); setSpeedMultiplier(1); }} style={btnStyle} title="Restart"><RotateCcw size={18} /></button>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {PHASES[phaseIdx]?.replace(/_/g, ' ') || ''}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {phase === 'elena_profile' ? (
          <div style={{ flex: 1, background: COLORS_DARK.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'scroll', padding: '20px 0' }}>
            <div style={{ background: COLORS_DARK.bgCard, border: `1px solid ${COLORS_DARK.rule}`, padding: '38px 48px', maxWidth: 740, margin: '0 auto' }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: COLORS_DARK.inkFaint, marginBottom: 8 }}>Patient profile</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 38, fontWeight: 500, letterSpacing: '-0.015em', color: COLORS_DARK.ink, marginBottom: 4 }}>Elena Ramirez</div>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 14, color: COLORS_DARK.inkSoft, fontStyle: 'italic', marginBottom: 22 }}>age 47</div>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 15, lineHeight: 1.65, color: COLORS_DARK.ink, marginBottom: 22 }}>
                Elena lives in Atwater. She is a home health aide working for a private agency, paid hourly, no PTO. Born in Michoacán, came to California at thirteen. Married to Raul for eighteen years. Three children: Daniel, twenty-four, lives in Modesto and has been distant since coming out three years ago; Sofia, nineteen, in community college; Miguel, fourteen, recently diagnosed with ADHD. Catholic, attends Mass weekly, draws strength from her faith. Insured through Medi-Cal. Currently presents with type 2 diabetes (A1C 9.2, poorly controlled), hypertension, obesity, chronic lower back pain, depression, and generalized anxiety. Three prior behavioral health referrals in the past five years; none took. The chart describes her as {`'`}lost to follow-up.{`'`} This is what your chart system knows.
              </div>
              <div style={{ borderTop: `1px solid ${COLORS_DARK.rule}`, paddingTop: 18, fontFamily: FONT_SANS, fontSize: 13, lineHeight: 1.6, color: COLORS_DARK.inkSoft, fontStyle: 'italic' }}>
                Elena has been talking to the bot for four months. The bot has had eleven conversations with her. The bot has built a model of her life that is much richer than what any chart contains. What you are about to see is the twelfth conversation.
              </div>
            </div>
          </div>
        ) : (
          <>
          <div style={{ flex: 2, position: 'relative', overflow: 'hidden' }}>
            <VirtualBrain nodes={nodes} edges={edges} positions={positions} highlight={highlight} viewBox={viewBox} showFirewall={showFirewall} opacity={phase.includes('handoff') || phase.includes('provider') ? 0.3 : 1}
              onNodeClick={(n) => { setDetailKind('node'); setDetailTarget(n); }}
              onEdgeClick={(e) => { setDetailKind('edge'); setDetailTarget(e); }}
              onBackgroundClick={() => { setDetailKind(null); setDetailTarget(null); }}
            />
            <InsightPanel isVisible={!!insight} title={insight?.title} body={insight?.body} presenterMode={presenterMode} />
            {detailTarget && <NodeDetailPanel kind={detailKind} target={detailTarget} nodes={nodes} onClose={() => { setDetailKind(null); setDetailTarget(null); }} />}
          </div>

          <div style={{ flex: 1, background: '#0A0C10', borderLeft: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', zIndex: 5 }}>
            {phase.includes('chat') && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {phase === 'elena_chat' && 'Conversation #12 • Late Evening'}
                    {phase === 'elena_next_chat' && 'Conversation #13 • Post-Therapy Follow-up'}
                    {phase === 'daniel_chat' && 'Conversation #10 • Late Night (11:42 PM)'}
                  </span>
                  <span style={{ color: '#4DB8B8' }}>{conversation.length} Messages • Unabridged</span>
                </div>
                <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                  {conversation.slice(0, chatIndex + 1).map((msg, i) => (
                    <div key={i} className="fade-enter-active" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'bot' ? 'flex-start' : 'flex-end' }}>
                      <div style={{ fontSize: '0.75rem', color: '#9B9285', textTransform: 'uppercase', marginBottom: '4px' }}>{msg.sender === 'bot' ? 'Ally' : (isElena ? 'Elena' : 'Daniel')}</div>
                      <div style={{ background: msg.sender === 'bot' ? 'rgba(77, 184, 184, 0.15)' : 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '12px', border: msg.sender === 'bot' ? '1px solid rgba(77,184,184,0.3)' : 'none', maxWidth: '85%', fontStyle: msg.italic ? 'italic' : 'normal' }}>
                        {msg.text}
                        {msg.significance && <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#D4A645', textTransform: 'uppercase', letterSpacing: '0.1em' }}>★ significance moment</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phase.includes('consolidation') && <ConsolidationPanel isElena={isElena} />}

            {phase.includes('handoff') && <HandoffCard data={packageData} />}

            {phase === 'daniel_handoff' && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <HandoffCard data={DANIEL_PATEL_PACKAGE} accent="#D67959" />
              </div>
            )}

            {phase === 'elena_provider_response' && (
              <div className="fade-enter-active" style={{ padding: '40px', overflowY: 'auto', height: '100%', background: 'rgba(77, 184, 184, 0.05)' }}>
                <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2rem', color: '#4DB8B8', marginBottom: '24px' }}>Provider Response Received</h2>
                <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>From:</strong> Dr. A. Patel, Behavioral Health</div>
                <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>Session Notes (Secured):</strong><br/>"Patient disclosed history of severe trauma at age 12. Highly sensitive. We are beginning EMDR. <span style={{ color: '#E85D5D', fontWeight: 600 }}>Do not press this topic in chat.</span> I am handling it."</div>
                <div style={{ marginTop: '30px', padding: '16px', border: '1px solid rgba(77, 184, 184, 0.3)', borderRadius: '8px', color: '#4DB8B8' }}>
                  <strong style={{ display: 'block', marginBottom: '8px' }}>Virtual Brain Updated:</strong>
                  <li>Node 'trauma_12' created.</li>
                  <li>Status: THERAPIST_LOCKED.</li>
                  <li>Directive: Empathize without probing.</li>
                </div>
              </div>
            )}

            {phase === 'daniel_updates' && (
              <div className="fade-enter-active" style={{ padding: '40px', overflowY: 'auto', height: '100%', background: 'rgba(77, 184, 184, 0.05)' }}>
                <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2rem', color: '#4DB8B8', marginBottom: '24px' }}>Clinician Updates Received</h2>
                <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid rgba(77,184,184,0.2)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 600, color: '#5FAEB0', marginBottom: '8px' }}>Dr. L. Tran — Primary Care</div>
                  <li>HIV test result: Negative ✓</li>
                  <li>Descovy (PrEP) initiated</li>
                  <li>Follow-up: 3 months</li>
                </div>
                <div style={{ padding: '16px', border: '1px solid rgba(214,121,89,0.2)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 600, color: '#D67959', marginBottom: '8px' }}>Dr. A. Patel — Behavioral Health</div>
                  <li>Session 1 focus: Marco, staying/leaving</li>
                  <li>Identity-faith content: therapist-locked</li>
                  <li style={{ color: '#D4A645', marginTop: '8px' }}>Inferred edge CONFIRMED: avoidance ↔ fear of disrupting what Marco gave</li>
                </div>
              </div>
            )}

            {phase === 'family_system' && (
              <div className="fade-enter-active" style={{ padding: '40px', overflowY: 'auto', height: '100%' }}>
                <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2rem', color: '#D9B873', marginBottom: '24px' }}>Family System</h2>
                <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: '#A8A39A' }}>
                  <p style={{ marginBottom: '16px' }}>Elena and Daniel are mother and son. They are both patients of this platform. They are both patients of Dr. Patel.</p>
                  <p style={{ marginBottom: '16px' }}>Elena does not know Daniel is a patient. Daniel does not know Elena is a patient.</p>
                  <p style={{ marginBottom: '16px', color: '#C84848', fontWeight: 600 }}>The firewall is absolute. No edges cross. No data leaks.</p>
                  <p>Dr. Patel knows both. She carries that knowledge. The bot respects it.</p>
                </div>
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', position: 'relative', zIndex: 10 }}>
        <div style={{ height: '100%', background: '#D9B873', width: `${((phaseIdx / PHASES.length) + (phase.includes('chat') ? (chatIndex / conversation.length) * (1/PHASES.length) : 0)) * 100}%`, transition: 'width 0.3s linear' }} />
      </div>
    </div>
  );
}

export default App;
