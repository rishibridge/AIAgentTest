import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw, FastForward, StepForward, StepBack, Send, Loader2, Users, MessageCircle, Brain, Stethoscope, ArrowLeft, SkipForward, Shield, AlertTriangle } from 'lucide-react';
import VirtualBrain from './components/VirtualBrain';
import InsightPanel from './components/InsightPanel';
import NodeDetailPanel from './components/NodeDetailPanel';
import ClinicianChat from './components/ClinicianChat';
import IntroSequence from './components/IntroSequence';
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

const CRISIS_NUMBERS = [
  { pattern: /\b988\b/g, tel: '988', label: '988 Suicide & Crisis Lifeline' },
  { pattern: /\b741741\b/g, tel: '741741', label: 'Crisis Text Line' },
  { pattern: /\b911\b/g, tel: '911', label: '911 Emergency' },
  { pattern: /800-656-HOPE|800-656-4673/gi, tel: '18006564673', label: 'RAINN Hotline' },
  { pattern: /1-800-4-A-CHILD|1-800-422-4453/gi, tel: '18004224453', label: 'Childhelp Hotline' },
  { pattern: /online\.rainn\.org/g, tel: null, label: 'RAINN Online', url: 'https://online.rainn.org' },
];

/**
 * Render inline markdown (**bold** and *italic*) inside string fragments so
 * literal asterisks never appear in chat bubbles (H8).
 */
const renderInlineMarkdown = (str, keyPrefix) => {
  if (typeof str !== 'string' || (!str.includes('*'))) return [str];
  const tokens = str.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
  return tokens.filter(Boolean).map((tok, idx) => {
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      return React.createElement('strong', { key: `${keyPrefix}-b-${idx}`, style: { color: '#FFF', fontWeight: 600 } }, tok.slice(2, -2));
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 2) {
      return React.createElement('em', { key: `${keyPrefix}-i-${idx}` }, tok.slice(1, -1));
    }
    return tok;
  });
};

const formatMessageText = (text) => {
  if (!text) return null;
  const lines = String(text).split('\n');
  return lines.map((line, i) => {
    let parts = [line];
    for (const cn of CRISIS_NUMBERS) {
      const newParts = [];
      for (const part of parts) {
        if (typeof part !== 'string') { newParts.push(part); continue; }
        const matches = part.match(cn.pattern);
        if (!matches) { newParts.push(part); continue; }
        const segments = part.split(cn.pattern);
        segments.forEach((seg, si) => {
          newParts.push(seg);
          if (si < segments.length - 1) {
            if (cn.url) {
              newParts.push(
                React.createElement('a', {
                  key: `crisis-${i}-${si}`,
                  href: cn.url,
                  target: '_blank',
                  rel: 'noopener',
                  style: { color: '#FF6B6B', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' },
                  title: cn.label,
                }, matches[si] || cn.label)
              );
            } else {
              newParts.push(
                React.createElement('a', {
                  key: `tel-${i}-${si}`,
                  href: `tel:${cn.tel}`,
                  style: { color: '#FF6B6B', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', background: 'rgba(255,107,107,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,107,107,0.3)' },
                  title: `Tap to call ${cn.label}`,
                  'data-crisis-number': cn.tel,
                }, matches[si] || cn.tel)
              );
            }
          }
        });
      }
      parts = newParts;
    }

    const formattedParts = [];
    parts.forEach((part, pi) => {
      if (typeof part === 'string') {
        formattedParts.push(...renderInlineMarkdown(part, `md-${i}-${pi}`));
      } else {
        formattedParts.push(part);
      }
    });

    return React.createElement(React.Fragment, { key: i }, ...formattedParts, i < lines.length - 1 ? React.createElement('br') : null);
  });
};

/**
 * Convert raw internal snake_case node IDs into human-readable labels for patient chat (L1).
 */
const humanizeGraphRef = (rawRef, nodeLabelMap = {}) => {
  if (!rawRef) return 'Memory';
  const str = String(rawRef).trim();
  const mapped = nodeLabelMap[str];
  if (mapped) {
    return String(mapped).replace(/\s+/g, ' ').trim();
  }
  return str
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/* ═══════════════════════════════════════════════════════════════════
 * WOW MOMENTS — Insight overlays at specific chat indices
 * ═══════════════════════════════════════════════════════════════════ */
const WOW_MOMENTS = {
  elena_chat: {
    2: { duration: 8000, highlight: ['sofia'], insight: { title: "ALLY REMEMBERS", body: "Unlike standard LLMs, Ally remembers the emotional context of previous conversations without being prompted, making the patient feel known immediately." } },
    9: { duration: 8000, highlight: ['sleep_disturbed', 'kitchen_counter', 'elena'], insight: { title: "ALLY REMEMBERS", body: "Elena mentions insomnia. Ally immediately connects it to the 'kitchen counter' incident from 3 weeks ago without being prompted. This is clinical inference." } },
    16: { duration: 8000, highlight: ['daniel'], insight: { title: "ALLY UNDERSTANDS", body: "ChatGPT wouldn't know her son's birthday. Ally maintains a persistent, multi-dimensional memory of the patient's entire life and family system." } },
    26: { duration: 8000, highlight: ['secret_hope', 'belief_god_will_fix', 'daniel'], insight: { title: "ALLY CARES", body: "Elena confesses a dark, shameful secret: hoping her son's wedding doesn't happen. A human might judge. Ally holds this contradiction objectively with deep care." } },
    41: { duration: 8000, highlight: ['depression', 'anxiety'], insight: { title: "ALLY REMEMBERS", body: "Ally doesn't just know she tried therapy; it knows exactly *when* and *why* she tried it based on previous disclosures, proving a deep clinical history." } },
    49: { duration: 8000, highlight: ['therapist_locked'], insight: { title: "ALLY CARES", body: "Elena explicitly asks Ally to hide trauma and substance abuse from her doctor. Ally respects the clinical firewall, building profound trust." } }
  },
  elena_next_chat: {
    3: { duration: 10000, highlight: ['therapist_locked'], insight: { title: "ALLY CARES", body: "Dr. Patel securely updated the AI on a childhood trauma disclosure. Instead of blindly asking 'How was therapy?', the AI demonstrates deep clinical empathy by acknowledging the difficulty and proactively enforcing the boundary." } }
  },
  daniel_chat: {
    7: { duration: 8000, highlight: ['elena'], insight: { title: "ALLY UNDERSTANDS", body: "Ally instantly recalls his mother's birthday without missing a beat, challenging his rationale for wanting to call." } },
    9: { duration: 8000, highlight: ['sofia', 'elena'], insight: { title: "ALLY REMEMBERS", body: "Daniel is Elena's son. Ally possesses an encyclopedic memory of the entire family system, accurately pointing out a shift in his sister's behavior based on years of context." } },
    19: { duration: 8000, highlight: ['prep_regimen', 'avoidance_prep', 'anxiety_stigma'], insight: { title: "ALLY CARES", body: "Daniel admits to avoiding HIV testing and PrEP out of pure fear. Ally remains neutral and caring, keeping the patient engaged instead of alienating him." } },
    26: { duration: 8000, highlight: ['tran_referral', 'prep_regimen'], insight: { title: "ALLY COLLABORATES", body: "Ally navigates complex biomedical reality (the PEP window is closed, PrEP/testing is needed) and seamlessly bridges the gap from therapy to a warm handoff for medical testing." } }
  }
};

/* ═══════════════════════════════════════════════════════════════════
 * PHASES & PRESENTER TELEPROMPTER NOTES (M3 & M5)
 * ═══════════════════════════════════════════════════════════════════ */
const PHASES = [
  'elena_profile',
  'elena_graph_intro',
  'elena_graph',
  'elena_chat',
  'elena_consolidation',
  'elena_reasoning',
  'elena_handoff',
  'elena_provider_response',
  'elena_next_chat',
  'transition_daniel',
  'daniel_profile',
  'daniel_graph',
  'daniel_chat',
  'daniel_consolidation',
  'daniel_handoff',
  'daniel_updates',
  'family_system',
  'end'
];

const PRESENTER_NOTES = {
  elena_profile: { label: 'Elena Profile', note: 'Highlight the gap between what the EHR knows ("lost to follow-up") and 4 months of longitudinal companion trust.' },
  elena_graph_intro: { label: 'Elena Graph Intro', note: 'Point out how beliefs, family ties, medications, and unspoken tensions coexist as typed nodes rather than flat chat logs.' },
  elena_graph: { label: 'Elena Memory Map', note: 'Click any node or edge to inspect source provenance, credibility weighting, and therapist-locked boundaries.' },
  elena_chat: { label: 'Elena Session #12', note: 'Watch Ally connect 3-week insomnia to the kitchen-counter incident with Raul and respect patient-controlled disclosure.' },
  elena_consolidation: { label: 'Post-Session Consolidation', note: '5-step hippocampal pipeline: significance filtering, divergence preservation, edge thickening, and dashed inferred hypotheses.' },
  elena_reasoning: { label: 'Adversarial DDx Layer', note: 'Proposer vs. Skeptic vs. Arbiter catches latent Bipolar-II activation risk before an unopposed SSRI is started.' },
  elena_handoff: { label: 'Warm Handoff to Dr. Patel', note: 'Patient-authorized context transfers cleanly while firewalled disclosures remain locked per Elena\'s explicit consent.' },
  elena_provider_response: { label: 'Clinician Feedback Loop', note: 'Dr. Patel locks childhood trauma for in-person EMDR; Ally updates its graph directive immediately.' },
  elena_next_chat: { label: 'Elena Session #13', note: 'Ally honors Dr. Patel\'s trauma boundary automatically—empathizing without probing locked clinical territory.' },
  transition_daniel: { label: 'Transition to Daniel', note: 'Pivot from cooperative chronic-care distress to acute shame, avoidance, and preventive sexual-health risk.' },
  daniel_profile: { label: 'Daniel Profile', note: 'Daniel (24) is Elena\'s estranged son—demonstrating completely distinct clinical needs on the same underlying architecture.' },
  daniel_graph: { label: 'Daniel Memory Map', note: 'Notice how Marco, faith conflict, and HIV-testing avoidance form a tight emotional cluster.' },
  daniel_chat: { label: 'Daniel Session #10', note: 'Ally recalls Elena\'s birthday, holds non-judgmental space around HIV testing fear, and coordinates dual PCP + therapy referrals.' },
  daniel_consolidation: { label: 'Daniel Consolidation', note: 'Dashed inferred edge links testing avoidance to fear of losing the stability Marco represents.' },
  daniel_handoff: { label: 'Dual Warm Handoffs', note: 'Role-scoped handoff packages: biomedical PrEP/testing context for Dr. Tran, relational/identity context for Dr. Patel.' },
  daniel_updates: { label: 'Closed-Loop Outcomes', note: 'HIV negative confirmed, Descovy (PrEP) initiated, and Dr. Patel confirms the inferred avoidance hypothesis.' },
  family_system: { label: 'Family Firewall', note: 'Mother and son share a clinician, yet per-patient keyed logical isolation ensures zero cross-patient data leakage.' },
  end: { label: 'Closing Summary', note: 'Recap the four pillars—Remembers, Knows You, Cares, Collaborates—or jump into the Live Interactive Sandbox.' },
};

const APP_MODE = {
  LANDING: 'LANDING',
  DEMO: 'DEMO',
  PATIENT_PICKER: 'PATIENT_PICKER',
  LIVE_CHAT: 'LIVE_CHAT',
  CLINICIAN_CHAT: 'CLINICIAN_CHAT',
};

/* ═══════════════════════════════════════════════════════════════════
 * LANDING PAGE COMPONENT
 * ═══════════════════════════════════════════════════════════════════ */
function LandingPage({ onDemoMode, onChatMode, onProviderMode }) {
  const [showPrismInfo, setShowPrismInfo] = useState(false);

  return (
    <div className="fade-enter-active" style={{
      width: '100vw', minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#050608',
      color: '#fff', position: 'relative', overflowX: 'hidden', overflowY: 'auto',
      padding: '32px 16px 48px', boxSizing: 'border-box',
    }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'absolute', width: '600px', height: '600px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(95,174,176,0.06) 0%, transparent 70%)',
        top: '-100px', left: '-100px', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: '500px', height: '500px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,184,115,0.05) 0%, transparent 70%)',
        bottom: '-80px', right: '-80px', pointerEvents: 'none',
      }} />

      {/* Logo / Title */}
      <div style={{ textAlign: 'center', marginBottom: '40px', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem',
          color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.25em',
          marginBottom: '12px',
        }}>
          Castle Behavioral Health
        </div>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: '4.5rem',
          fontWeight: 600, color: '#D9B873', letterSpacing: '-0.02em',
          lineHeight: 1.1, marginBottom: '16px',
        }}>
          Ally
        </h1>
        <p style={{
          fontFamily: "'Lora', serif", fontSize: '1.1rem',
          color: '#A8A39A', fontStyle: 'italic', maxWidth: '480px',
        }}>
          Your patient companion that remembers, knows, cares, and collaborates.
        </p>

        {/* Powered by Prism badge */}
        <div
          onMouseEnter={() => setShowPrismInfo(true)}
          onMouseLeave={() => setShowPrismInfo(false)}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginTop: '20px', position: 'relative', cursor: 'default',
          }}
        >
          <div style={{
            padding: '6px 16px',
            border: '1px solid rgba(217,184,115,0.2)',
            borderRadius: '999px',
            fontFamily: "'Work Sans', sans-serif",
            fontSize: '0.7rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#9B9285',
            transition: 'all 0.3s ease',
            borderColor: showPrismInfo ? 'rgba(217,184,115,0.4)' : 'rgba(217,184,115,0.2)',
          }}>
            ⬡ Powered by Prism
          </div>

          {/* Expanded tooltip */}
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: showPrismInfo ? 1 : 0,
            pointerEvents: showPrismInfo ? 'auto' : 'none',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            background: 'rgba(15,15,18,0.95)',
            border: '1px solid rgba(217,184,115,0.15)',
            borderRadius: '10px',
            padding: '12px 18px',
            whiteSpace: 'nowrap',
            fontFamily: "'Work Sans', sans-serif",
            fontSize: '0.65rem',
            letterSpacing: '0.08em',
            color: '#8A857D',
            lineHeight: 1.7,
            backdropFilter: 'blur(12px)',
            zIndex: 10,
          }}>
            <span style={{ color: '#9B9285', fontWeight: 500 }}>Prism Architecture:</span>{' '}
            Temporal Memory Graph{' • '}
            Adversarial Reasoning Engine{' • '}
            Credibility-Weighted Evidence{' • '}
            Divergence Tracking
          </div>
        </div>
      </div>

      {/* Mode cards */}
      <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        {/* Demo Mode Card */}
        <button
          onClick={onDemoMode}
          style={{
            width: '310px', maxWidth: '90vw', padding: '36px 28px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', backdropFilter: 'blur(12px)',
            cursor: 'pointer', textAlign: 'center',
            transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.border = '1px solid rgba(95,174,176,0.4)';
            e.currentTarget.style.background = 'rgba(95,174,176,0.06)';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(95,174,176,0.12)', border: '1.5px solid rgba(95,174,176,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <Play size={28} color="#5FAEB0" />
          </div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem',
            fontWeight: 600, color: '#5FAEB0', marginBottom: '12px',
          }}>
            Demo Mode
          </div>
          <div style={{
            fontFamily: "'Work Sans', sans-serif", fontSize: '0.88rem',
            color: '#A8A39A', lineHeight: 1.6,
          }}>
            Guided 18-step walkthrough of Elena &amp; Daniel's stories. Isolated canonical seed for presentations.
          </div>
          <div style={{
            marginTop: '20px', fontFamily: "'Work Sans', sans-serif",
            fontSize: '0.75rem', color: '#5FAEB0', textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Start Presentation →
          </div>
        </button>

        {/* Patient Chat Card */}
        <button
          onClick={onChatMode}
          style={{
            width: '310px', maxWidth: '90vw', padding: '36px 28px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', backdropFilter: 'blur(12px)',
            cursor: 'pointer', textAlign: 'center',
            transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.border = '1px solid rgba(217,184,115,0.4)';
            e.currentTarget.style.background = 'rgba(217,184,115,0.06)';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(217,184,115,0.12)', border: '1.5px solid rgba(217,184,115,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <MessageCircle size={28} color="#D9B873" />
          </div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem',
            fontWeight: 600, color: '#D9B873', marginBottom: '12px',
          }}>
            Patient Chat
          </div>
          <div style={{
            fontFamily: "'Work Sans', sans-serif", fontSize: '0.88rem',
            color: '#A8A39A', lineHeight: 1.6,
          }}>
            Live Interactive Sandbox from the patient's perspective. Talk to Ally directly.
          </div>
          <div style={{
            marginTop: '20px', fontFamily: "'Work Sans', sans-serif",
            fontSize: '0.75rem', color: '#D9B873', textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Start Sandbox Chat →
          </div>
        </button>

        {/* Provider Dashboard Card */}
        <button
          onClick={onProviderMode}
          style={{
            width: '310px', maxWidth: '90vw', padding: '36px 28px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', backdropFilter: 'blur(12px)',
            cursor: 'pointer', textAlign: 'center',
            transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.border = '1px solid rgba(77, 184, 184, 0.4)';
            e.currentTarget.style.background = 'rgba(77, 184, 184, 0.06)';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(77, 184, 184, 0.12)', border: '1.5px solid rgba(77, 184, 184, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <Stethoscope size={28} color="#4DB8B8" />
          </div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem',
            fontWeight: 600, color: '#4DB8B8', marginBottom: '12px',
          }}>
            Provider Dashboard
          </div>
          <div style={{
            fontFamily: "'Work Sans', sans-serif", fontSize: '0.88rem',
            color: '#A8A39A', lineHeight: 1.6,
          }}>
            Access the Neural Graph, clinical reasoning, and Interactive DDx Arena interface.
          </div>
          <div style={{
            marginTop: '20px', fontFamily: "'Work Sans', sans-serif",
            fontSize: '0.75rem', color: '#4DB8B8', textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Open Dashboard →
          </div>
        </button>
      </div>

      {/* Concise non-duplicative architecture footer (L3: full IP notice lives solely in Entry Gate) */}
      <div
        data-testid="landing-architecture-footer"
        style={{
          position: 'absolute',
          bottom: '12px',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: "'Work Sans', sans-serif",
          fontSize: '0.68rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#5C5750',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        Castle Behavioral Health • Per-Patient Keyed Logical Isolation • Self-Hosted Sovereign Assets
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * NEW USER ONBOARDING & RETURNING USER SIGN-IN MODAL
 * ═══════════════════════════════════════════════════════════════════ */
function NewUserModal({ onClose, onSuccess, initialTab = 'new' }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'new' | 'returning'
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => api.getLastUserEmail());
  const [password, setPassword] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canSubmitNew = name.trim().length > 0 && email.trim().includes('@') && password.trim().length >= 4 && acknowledged && !submitting;
  const canSubmitResume = email.trim().includes('@') && password.trim().length >= 4 && !submitting;

  const handleNewSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmitNew) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.onboardNewUser({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        demo_terms_acknowledged: acknowledged,
      });
      onSuccess(res.id, res.name);
    } catch (err) {
      setError(err.message || 'Unable to create profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResumeSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmitResume) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.resumeUser({
        email: email.trim(),
        password: password.trim(),
      });
      onSuccess(res.id, res.name);
    } catch (err) {
      setError(err.message || 'Unable to sign in with that email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="new-user-modal"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px', background: '#0B0D12',
          border: '1px solid rgba(217,184,115,0.32)', borderRadius: '16px',
          padding: '28px', boxShadow: '0 24px 80px rgba(0,0,0,0.75)', color: '#EDEAE3',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.75rem', fontWeight: 600, color: '#D9B873' }}>
              Talk to Ally
            </div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: '0.84rem', fontStyle: 'italic', color: '#9B9285' }}>
              {activeTab === 'new'
                ? 'Start from a 1-node blank slate ("You") and watch your memory map grow in real time.'
                : 'Sign in with your email and password to pick up right where you left off.'}
            </div>
          </div>
          <button
            data-testid="close-new-user-modal"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#9B9285', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        {/* Mode Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            type="button"
            data-testid="tab-new-user"
            onClick={() => { setActiveTab('new'); setError(null); }}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              background: activeTab === 'new' ? 'rgba(217,184,115,0.18)' : 'transparent',
              color: activeTab === 'new' ? '#D9B873' : '#9B9285',
              fontFamily: "'Work Sans', sans-serif", fontSize: '0.78rem', fontWeight: 600,
            }}
          >
            New User (Session #1)
          </button>
          <button
            type="button"
            data-testid="tab-returning-user"
            onClick={() => { setActiveTab('returning'); setError(null); }}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              background: activeTab === 'returning' ? 'rgba(95,174,176,0.18)' : 'transparent',
              color: activeTab === 'returning' ? '#5FAEB0' : '#9B9285',
              fontFamily: "'Work Sans', sans-serif", fontSize: '0.78rem', fontWeight: 600,
            }}
          >
            Returning User (Sign In)
          </button>
        </div>

        {error && (
          <div data-testid="new-user-error" style={{ marginBottom: '14px', padding: '10px 12px', background: 'rgba(232,93,93,0.12)', border: '1px solid rgba(232,93,93,0.4)', borderRadius: '8px', color: '#FF6B6B', fontSize: '0.8rem', fontFamily: "'Work Sans', sans-serif" }}>
            {error}
          </div>
        )}

        {activeTab === 'new' ? (
          <form onSubmit={handleNewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontFamily: "'Work Sans', sans-serif", fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9B9285', marginBottom: '6px' }}>
                First Name or Nickname
              </label>
              <input
                data-testid="new-user-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Alex"
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDEAE3', fontSize: '0.9rem', fontFamily: "'Work Sans', sans-serif", outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: "'Work Sans', sans-serif", fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9B9285', marginBottom: '6px' }}>
                Email Address (Used to Resume Your Conversation Later)
              </label>
              <input
                data-testid="new-user-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDEAE3', fontSize: '0.9rem', fontFamily: "'Work Sans', sans-serif", outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: "'Work Sans', sans-serif", fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9B9285', marginBottom: '6px' }}>
                Create Password (4+ Characters)
              </label>
              <input
                data-testid="new-user-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDEAE3', fontSize: '0.9rem', fontFamily: "'Work Sans', sans-serif", outline: 'none' }}
              />
            </div>

            <label
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px',
                background: 'rgba(217,184,115,0.06)', border: '1px solid rgba(217,184,115,0.22)',
                borderRadius: '10px', cursor: 'pointer', fontSize: '0.78rem', lineHeight: 1.5, color: '#D6D1C7',
                fontFamily: "'Work Sans', sans-serif",
              }}
            >
              <input
                data-testid="new-user-terms-checkbox"
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                style={{ marginTop: '3px', accentColor: '#D9B873', cursor: 'pointer' }}
              />
              <span>
                I am <strong>18+</strong> and understand this is an <strong>unmonitored product demo, not medical care</strong>. What I type is saved on demo servers so Ally can remember me across sessions and our team can review conversations to improve Ally. I will use <strong>fictional details</strong> rather than sharing real medical or personal secrets, and I understand nothing entered here is confidential or protected.
              </span>
            </label>

            <button
              data-testid="new-user-submit-btn"
              type="submit"
              disabled={!canSubmitNew}
              style={{
                marginTop: '4px', width: '100%', padding: '13px 18px', borderRadius: '9px', border: 'none',
                background: canSubmitNew ? 'linear-gradient(135deg, #D9B873, #C4A35A)' : 'rgba(255,255,255,0.08)',
                color: canSubmitNew ? '#050608' : '#6B6560', fontWeight: 700, fontSize: '0.88rem',
                fontFamily: "'Work Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em',
                cursor: canSubmitNew ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? 'Setting Up Session #1...' : 'Start Talking to Ally →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResumeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontFamily: "'Work Sans', sans-serif", fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9B9285', marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                data-testid="resume-user-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDEAE3', fontSize: '0.9rem', fontFamily: "'Work Sans', sans-serif", outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: "'Work Sans', sans-serif", fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9B9285', marginBottom: '6px' }}>
                Password
              </label>
              <input
                data-testid="resume-user-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDEAE3', fontSize: '0.9rem', fontFamily: "'Work Sans', sans-serif", outline: 'none' }}
              />
            </div>

            <button
              data-testid="resume-user-submit-btn"
              type="submit"
              disabled={!canSubmitResume}
              style={{
                marginTop: '6px', width: '100%', padding: '13px 18px', borderRadius: '9px', border: 'none',
                background: canSubmitResume ? '#5FAEB0' : 'rgba(255,255,255,0.08)',
                color: canSubmitResume ? '#050608' : '#6B6560', fontWeight: 700, fontSize: '0.88rem',
                fontFamily: "'Work Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em',
                cursor: canSubmitResume ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? 'Resuming Session...' : 'Resume Conversation with Ally →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * USER FEEDBACK MODAL — Accessible from Picker, Live Chat & Consolidation
 * ═══════════════════════════════════════════════════════════════════ */
function FeedbackModal({ onClose, patientId = '' }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState(() => api.getLastUserEmail());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.submitFeedback({
        rating,
        comment: comment.trim(),
        email: email.trim(),
        patient_id: patientId || '',
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Unable to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="feedback-modal"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9600,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '480px', background: '#0B0D12',
          border: '1px solid rgba(95,174,176,0.35)', borderRadius: '16px',
          padding: '26px', boxShadow: '0 24px 80px rgba(0,0,0,0.75)', color: '#EDEAE3',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', fontWeight: 600, color: '#5FAEB0' }}>
              Share Feedback on Ally
            </div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: '0.82rem', fontStyle: 'italic', color: '#9B9285' }}>
              How natural did Ally feel, and what should we improve?
            </div>
          </div>
          <button
            data-testid="close-feedback-modal"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#9B9285', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        {submitted ? (
          <div data-testid="feedback-success-msg" style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', marginBottom: '8px', color: '#D9B873' }}>✦</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#EDEAE3', marginBottom: '6px' }}>
              Thank you for your feedback
            </div>
            <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.84rem', color: '#9B9285', marginBottom: '18px' }}>
              Your notes have been saved to help our team refine Ally.
            </div>
            <button
              onClick={onClose}
              style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#5FAEB0', color: '#050608', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", fontSize: '0.82rem' }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && (
              <div style={{ padding: '9px 12px', background: 'rgba(232,93,93,0.12)', border: '1px solid rgba(232,93,93,0.4)', borderRadius: '8px', color: '#FF6B6B', fontSize: '0.78rem' }}>
                {error}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontFamily: "'Work Sans', sans-serif", fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9B9285', marginBottom: '8px' }}>
                Overall Experience (1–5)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    data-testid={`feedback-rating-${num}`}
                    onClick={() => setRating(num)}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: '8px', cursor: 'pointer',
                      background: rating >= num ? 'rgba(217,184,115,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${rating >= num ? '#D9B873' : 'rgba(255,255,255,0.1)'}`,
                      color: rating >= num ? '#D9B873' : '#9B9285',
                      fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: '0.88rem',
                    }}
                  >
                    {num} ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: "'Work Sans', sans-serif", fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9B9285', marginBottom: '6px' }}>
                Your Thoughts or Suggestions
              </label>
              <textarea
                data-testid="feedback-comment-input"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Did Ally listen well? Did the memory graph capture what mattered?"
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDEAE3', fontSize: '0.88rem', fontFamily: "'Work Sans', sans-serif", outline: 'none', resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: "'Work Sans', sans-serif", fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9B9285', marginBottom: '6px' }}>
                Email (Optional)
              </label>
              <input
                data-testid="feedback-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDEAE3', fontSize: '0.86rem', fontFamily: "'Work Sans', sans-serif", outline: 'none' }}
              />
            </div>

            <button
              data-testid="submit-feedback-btn"
              type="submit"
              disabled={!comment.trim() || submitting}
              style={{
                marginTop: '4px', width: '100%', padding: '12px 18px', borderRadius: '9px', border: 'none',
                background: comment.trim() ? '#5FAEB0' : 'rgba(255,255,255,0.08)',
                color: comment.trim() ? '#050608' : '#6B6560', fontWeight: 700, fontSize: '0.86rem',
                fontFamily: "'Work Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em',
                cursor: comment.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? 'Saving Feedback...' : 'Submit Feedback'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * PATIENT PICKER COMPONENT
 * ═══════════════════════════════════════════════════════════════════ */
function PatientPicker({ onSelectPatient, onBack, isClinician, onToggleClinician }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUserModalTab, setNewUserModalTab] = useState('new');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getPatients()
      .then((data) => {
        const list = Array.isArray(data) ? data : data.patients || [];
        setPatients(list);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="fade-enter-active" style={{
      width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#050608', color: '#fff',
    }}>
      {/* Header */}
      <div style={{
        height: '60px', padding: '0 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.15)',
              color: '#9B9285', padding: '6px 14px', borderRadius: '6px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.8rem', fontFamily: "'Work Sans', sans-serif",
              transition: 'all 0.2s',
            }}
          >
            <ArrowLeft size={14} /> Home
          </button>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#D9B873' }}>
            Select Patient
          </div>
        </div>

        {/* Feedback & Clinician View Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            data-testid="open-feedback-btn"
            onClick={() => setShowFeedbackModal(true)}
            style={{
              background: 'rgba(95,174,176,0.08)',
              border: '1px solid rgba(95,174,176,0.3)',
              color: '#5FAEB0',
              padding: '8px 16px', borderRadius: '24px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.8rem', fontFamily: "'Work Sans', sans-serif",
              fontWeight: 500, transition: 'all 0.2s ease',
            }}
          >
            💬 Give Feedback
          </button>
          <button
            onClick={onToggleClinician}
            style={{
              background: isClinician ? 'rgba(217,184,115,0.15)' : 'rgba(255,255,255,0.05)',
              border: isClinician ? '1px solid rgba(217,184,115,0.4)' : '1px solid rgba(255,255,255,0.12)',
              color: isClinician ? '#D9B873' : '#9B9285',
              padding: '8px 20px', borderRadius: '24px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '0.82rem', fontFamily: "'Work Sans', sans-serif",
              fontWeight: 500, transition: 'all 0.3s ease',
            }}
          >
            <Stethoscope size={15} />
            {isClinician ? 'Clinician View' : 'Patient View'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem',
          color: isClinician ? '#D9B873' : '#5FAEB0', marginBottom: '8px', textAlign: 'center',
        }}>
          {isClinician ? 'Clinical Consultation' : 'Patient Companion (Live Sandbox)'}
        </div>
        <div style={{
          fontFamily: "'Work Sans', sans-serif", fontSize: '0.88rem',
          color: '#9B9285', marginBottom: '40px', textAlign: 'center', maxWidth: '520px',
        }}>
          {isClinician
            ? 'Select a patient to review their neural map, divergences, and run DDx consultations.'
            : 'Select a patient to start a live interactive conversation with Ally (isolated from Guided Demo Mode).'}
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#5FAEB0', padding: '60px 0' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem' }}>Loading patients…</span>
          </div>
        )}

        {error && (
          <div style={{
            padding: '24px 32px', background: 'rgba(200,72,72,0.08)',
            border: '1px solid rgba(200,72,72,0.25)', borderRadius: '12px',
            color: '#C84848', fontFamily: "'Work Sans', sans-serif", fontSize: '0.88rem',
            textAlign: 'center', maxWidth: '500px',
          }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Unable to load patients</div>
            <div style={{ color: 'rgba(200,72,72,0.7)', fontSize: '0.8rem' }}>{error}</div>
          </div>
        )}

        {!loading && !error && patients.length === 0 && (
          <div style={{
            padding: '48px', color: 'rgba(255,255,255,0.25)', fontFamily: "'Work Sans', sans-serif",
            fontSize: '0.9rem', textAlign: 'center',
          }}>
            No patients found. Create patients via the API first.
          </div>
        )}

        {/* Patient Cards Grid */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center', maxWidth: '1000px' }}>
          {patients.map((patient) => {
            const pid = patient.id || patient.patient_id;
            const name = patient.name || patient.patient_name || pid;
            const age = patient.age || patient.demographics?.age || '—';
            const nodeCount = patient.node_count ?? patient.graph_stats?.node_count ?? '—';
            const edgeCount = patient.edge_count ?? patient.graph_stats?.edge_count ?? '—';

            return (
              <button
                key={pid}
                onClick={() => onSelectPatient(pid, name)}
                style={{
                  width: '280px', padding: '28px 24px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '14px', backdropFilter: 'blur(12px)',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.3s ease', position: 'relative',
                }}
                onMouseOver={(e) => {
                  const accent = isClinician ? 'rgba(217,184,115,' : 'rgba(95,174,176,';
                  e.currentTarget.style.border = `1px solid ${accent}0.4)`;
                  e.currentTarget.style.background = `${accent}0.05)`;
                  e.currentTarget.style.transform = 'translateY(-3px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: isClinician ? 'rgba(217,184,115,0.12)' : 'rgba(95,174,176,0.12)',
                  border: `1.5px solid ${isClinician ? 'rgba(217,184,115,0.3)' : 'rgba(95,174,176,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '16px',
                }}>
                  <Users size={20} color={isClinician ? '#D9B873' : '#5FAEB0'} />
                </div>

                <div style={{
                  fontFamily: "'Cormorant Garamond', serif", fontSize: '1.35rem',
                  fontWeight: 600, color: '#EDEAE3', marginBottom: '6px',
                }}>
                  {name}
                </div>

                <div style={{
                  fontFamily: "'Lora', serif", fontSize: '0.82rem',
                  color: '#9B9285', fontStyle: 'italic', marginBottom: '16px',
                }}>
                  {patient.is_custom_private ? 'Your Saved Profile • Resume' : (age !== '—' && age !== 0 ? `Age ${age}` : 'Age not recorded')}
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{
                    padding: '6px 12px', background: 'rgba(95,174,176,0.08)',
                    borderRadius: '6px', border: '1px solid rgba(95,174,176,0.15)',
                  }}>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nodes</div>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.1rem', color: '#EDEAE3', fontWeight: 600 }}>{nodeCount}</div>
                  </div>
                  <div style={{
                    padding: '6px 12px', background: 'rgba(217,184,115,0.08)',
                    borderRadius: '6px', border: '1px solid rgba(217,184,115,0.15)',
                  }}>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Edges</div>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.1rem', color: '#EDEAE3', fontWeight: 600 }}>{edgeCount}</div>
                  </div>
                </div>

                <div style={{
                  marginTop: '16px', fontFamily: "'Work Sans', sans-serif",
                  fontSize: '0.72rem', color: isClinician ? '#D9B873' : '#5FAEB0',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  {isClinician ? 'Open Consultation →' : 'Start Conversation →'}
                </div>
              </button>
            );
          })}

          {/* Try Ally as a New User Card (Blank Slate • Session #1) */}
          <button
            data-testid="try-ally-new-user-card"
            onClick={() => { setNewUserModalTab('new'); setShowNewUserModal(true); }}
            style={{
              width: '280px', padding: '28px 24px',
              background: 'rgba(217,184,115,0.05)',
              border: '1px solid rgba(217,184,115,0.32)',
              borderRadius: '14px', backdropFilter: 'blur(12px)',
              cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.3s ease', position: 'relative',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.border = '1px solid rgba(217,184,115,0.65)';
              e.currentTarget.style.background = 'rgba(217,184,115,0.09)';
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.border = '1px solid rgba(217,184,115,0.32)';
              e.currentTarget.style.background = 'rgba(217,184,115,0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'rgba(217,184,115,0.14)',
              border: '1.5px solid rgba(217,184,115,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <MessageCircle size={20} color="#D9B873" />
            </div>

            <div style={{
              fontFamily: "'Cormorant Garamond', serif", fontSize: '1.35rem',
              fontWeight: 600, color: '#D9B873', marginBottom: '6px',
            }}>
              Try Ally as a New User
            </div>

            <div style={{
              fontFamily: "'Lora', serif", fontSize: '0.82rem',
              color: '#9B9285', fontStyle: 'italic', marginBottom: '16px',
            }}>
              Blank Slate • Session #1
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{
                padding: '6px 12px', background: 'rgba(217,184,115,0.08)',
                borderRadius: '6px', border: '1px solid rgba(217,184,115,0.2)',
              }}>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nodes</div>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.1rem', color: '#EDEAE3', fontWeight: 600 }}>1</div>
              </div>
              <div style={{
                padding: '6px 12px', background: 'rgba(95,174,176,0.08)',
                borderRadius: '6px', border: '1px solid rgba(95,174,176,0.15)',
              }}>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Edges</div>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.1rem', color: '#EDEAE3', fontWeight: 600 }}>0</div>
              </div>
            </div>

            <div style={{
              marginTop: '16px', fontFamily: "'Work Sans', sans-serif",
              fontSize: '0.72rem', color: '#D9B873',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              Start Session #1 or Sign In →
            </div>
          </button>
        </div>
      </div>

      {showNewUserModal && (
        <NewUserModal
          initialTab={newUserModalTab}
          onClose={() => setShowNewUserModal(false)}
          onSuccess={(id, name) => {
            setShowNewUserModal(false);
            onSelectPatient(id, name);
          }}
        />
      )}
      {showFeedbackModal && (
        <FeedbackModal onClose={() => setShowFeedbackModal(false)} />
      )}
    </div>
  );
}

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
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>{data.hypotheses.map((item, i) => <li key={i} style={{ marginBottom: '6px', fontStyle: 'italic' }}>{typeof item === 'string' ? item : (item?.text || '')}</li>)}</ul>
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
 * CONSOLIDATION PANEL — 5-step Short-Term -> Long-Term ritual viewer
 * ═══════════════════════════════════════════════════════════════════ */
const CONSOLIDATION_STEPS = [
  { title: 'Session ended', desc: 'Short-term working memory buffer locked and pre-consolidation graph snapshot captured.', accent: '#5FAEB0', tag: 'SHORT-TERM BUFFER' },
  { title: 'Significance filtering', desc: 'Advocate vs. Skeptic filters surface remarks; high-significance disclosures encoded with weighted prominence.', accent: '#D4A645', tag: 'SIGNIFICANCE GATE' },
  { title: 'Credibility weighting', desc: 'Inconsistencies between disclosures and prior knowledge are held as flagged divergences rather than naively overwritten.', accent: '#C84848', tag: 'CREDIBILITY AUDIT' },
  { title: 'Node merging & edge thickening', desc: 'Short-term session nodes crystallize into long-term cortical memory; reinforced synaptic edges thicken.', accent: '#5FAEB0', tag: 'CORTICAL ENCODING' },
  { title: 'Inferred edges drawn', desc: 'Arbiter synthesizes dashed hypothesis nodes and links connecting previously unlinked concepts for review.', accent: '#9E7E3A', tag: 'HYPOTHESIS LINKS' },
];

function ConsolidationPanel({ isElena, patientName, onStageChange }) {
  const [activeStep, setActiveStep] = useState(0);
  const displayName = patientName || (isElena ? 'Elena Ramirez' : 'Daniel Ramirez');

  useEffect(() => {
    if (onStageChange) onStageChange(0);
    const timer = setInterval(() => {
      setActiveStep(s => {
        const next = s < 4 ? s + 1 : s;
        if (onStageChange) onStageChange(next);
        return next;
      });
    }, 1300);
    return () => clearInterval(timer);
  }, [onStageChange]);

  const progressPct = Math.min(100, (activeStep + 1) * 20);

  return (
    <div data-testid="consolidation-ritual-panel" className="fade-enter-active" style={{ padding: '28px 26px', overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.95rem', color: '#D4A645', marginBottom: '6px' }}>
        Memory Consolidation
      </h2>
      <div data-testid="consolidation-patient-subtitle" style={{ fontSize: '0.76rem', color: '#9B9285', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {displayName} • Short-Term → Long-Term Memory Integration
      </div>

      {/* Synaptic Pipeline Progress Header */}
      <div style={{
        marginBottom: '20px', padding: '12px 14px', borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(217,184,115,0.10), rgba(95,174,176,0.08))',
        border: '1px solid rgba(217,184,115,0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          <span style={{ color: '#D9B873', fontWeight: 700 }}>Working Memory</span>
          <span style={{ color: '#9B9285' }}>→ Advocate / Skeptic / Judge →</span>
          <span style={{ color: '#5FAEB0', fontWeight: 700 }}>Long-Term Graph</span>
        </div>
        <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            width: `${progressPct}%`, height: '100%',
            background: 'linear-gradient(90deg, #D9B873, #5FAEB0)',
            transition: 'width 500ms ease',
          }} />
        </div>
      </div>

      {CONSOLIDATION_STEPS.map((step, i) => {
        const isCurrent = i === activeStep;
        const isDone = i < activeStep;
        const isLit = i <= activeStep;
        return (
          <div key={i} className={isLit ? 'fade-enter-active' : ''} style={{
            marginBottom: '14px', padding: '14px 16px', borderRadius: '8px',
            background: isCurrent ? 'rgba(217,184,115,0.08)' : isLit ? 'rgba(255,255,255,0.04)' : 'transparent',
            borderLeft: `3px solid ${isLit ? step.accent : 'rgba(255,255,255,0.1)'}`,
            borderTop: isCurrent ? '1px solid rgba(217,184,115,0.25)' : '1px solid transparent',
            borderRight: isCurrent ? '1px solid rgba(217,184,115,0.25)' : '1px solid transparent',
            borderBottom: isCurrent ? '1px solid rgba(217,184,115,0.25)' : '1px solid transparent',
            opacity: isLit ? 1 : 0.3,
            transition: 'all 0.45s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: isLit ? step.accent : 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.72rem', fontWeight: 700, color: '#050608', flexShrink: 0,
                }}>
                  {isDone ? '✓' : i + 1}
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', color: isCurrent ? '#EDEAE3' : '#D5D0C8' }}>{step.title}</div>
              </div>
              <span style={{
                fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
                color: isCurrent ? '#D9B873' : isDone ? '#5FAEB0' : '#6B6560',
                textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                {isCurrent && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                {isCurrent ? step.tag : isDone ? 'ENCODED' : 'PENDING'}
              </span>
            </div>
            {isLit && <div style={{ marginLeft: '34px', fontSize: '0.82rem', color: '#A8A39A', lineHeight: 1.55 }}>{step.desc}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * LIVE CHAT COMPONENT — Real LLM-powered conversation (M2, H8, L1)
 * ═══════════════════════════════════════════════════════════════════ */
function LiveChat({ patientId, patientName, onGraphUpdate, onConvIdReady, nodeLabelMap = {}, sessionEndedExternal = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState(null);
  const scrollRef = useRef(null);
  const convIdRef = useRef(null);
  const hasMessagesRef = useRef(false);
  const endedRef = useRef(false);

  useEffect(() => {
    endedRef.current = sessionEndedExternal;
  }, [sessionEndedExternal]);

  useEffect(() => {
    let mounted = true;
    hasMessagesRef.current = false;
    endedRef.current = false;
    api.startConversation(patientId, 'Live session').then(res => {
      if (!mounted) {
        api.abandonConversation(patientId, res.conversation_id);
        return;
      }
      convIdRef.current = res.conversation_id;
      setConvId(res.conversation_id);
      if (res.opening_message?.text) {
        setMessages([{ sender: 'bot', text: res.opening_message.text, seeded: true }]);
      }
      if (onConvIdReady) onConvIdReady(res.conversation_id);
    }).catch(console.error);

    const handleBeforeUnload = () => {
      if (convIdRef.current && !endedRef.current && !hasMessagesRef.current) {
        api.abandonConversation(patientId, convIdRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      mounted = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (convIdRef.current && !endedRef.current && !hasMessagesRef.current) {
        api.abandonConversation(patientId, convIdRef.current);
      }
    };
  }, [patientId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !convId || loading) return;
    const text = input.trim();
    setInput('');
    hasMessagesRef.current = true;
    setMessages(m => [...m, { sender: patientName.split(' ')[0].toLowerCase(), text }]);
    setLoading(true);
    try {
      const res = await api.sendMessage(patientId, convId, text);
      setMessages(m => [...m, {
        sender: 'bot', text: res.bot_response.text,
        significance: res.bot_response.significance,
        toolCalls: res.tool_calls || [],
      }]);
      if (onGraphUpdate && res.current_graph) {
        onGraphUpdate(res.current_graph);
      }
    } catch (e) {
      setMessages(m => [...m, { sender: 'bot', text: `Unable to reach Ally right now (${e.message}).` }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.74rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span>Live Interactive Sandbox</span>
        <span style={{ color: '#4DB8B8' }}>LLM-Powered</span>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {messages.map((msg, i) => (
          <div key={i} className="fade-enter-active" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'bot' ? 'flex-start' : 'flex-end' }}>
            <div style={{ fontSize: '0.75rem', color: '#9B9285', textTransform: 'uppercase', marginBottom: '4px' }}>{msg.sender === 'bot' ? 'Ally' : patientName.split(' ')[0]}</div>
            <div style={{ background: msg.sender === 'bot' ? 'rgba(77, 184, 184, 0.15)' : 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '12px', border: msg.sender === 'bot' ? '1px solid rgba(77,184,184,0.3)' : 'none', maxWidth: '88%' }}>
              {formatMessageText(msg.text)}
              {msg.significance && <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#D4A645', textTransform: 'uppercase', letterSpacing: '0.1em' }}>★ significance moment</div>}
              {msg.toolCalls && msg.toolCalls.some(tc => tc.tool === 'trigger_emergency_alert') && (
                <div data-testid="emergency-alert-banner" style={{ marginTop: '10px', padding: '12px 16px', background: 'rgba(255,0,0,0.12)', borderRadius: '8px', border: '2px solid rgba(255,80,80,0.5)', animation: 'pulse 2s infinite' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🚨</span>
                    <span style={{ color: '#FF5050', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.8rem' }}>Emergency Alert Sent</span>
                  </div>
                  <div style={{ color: '#EDEAE3', fontSize: '0.8rem', lineHeight: 1.5 }}>
                    {msg.toolCalls.filter(tc => tc.tool === 'trigger_emergency_alert').map((tc, j) => (
                      <div key={j}>Clinical staff has been notified: {tc.args?.reason || 'Crisis detected'}</div>
                    ))}
                  </div>
                </div>
              )}
              {msg.toolCalls && msg.toolCalls.length > 0 && !msg.toolCalls.some(tc => tc.tool === 'trigger_emergency_alert') && (
                <div data-testid="memory-updated-badge" style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(217,184,115,0.08)', borderRadius: '6px', border: '1px solid rgba(217,184,115,0.15)', fontSize: '0.7rem', color: '#D9B873' }}>
                  <div data-testid="shine-memory-pill" style={{ fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✦ Memory Updated • Added to memory map</div>
                  {msg.toolCalls.map((tc, j) => (
                    <div key={j} style={{ color: '#B5AEA3', marginBottom: '2px' }}>
                      {tc.tool === 'add_node' && `+ Remembered: ${humanizeGraphRef(tc.args?.label || tc.args?.node_id, nodeLabelMap)}`}
                      {tc.tool === 'add_edge' && `+ Connected: ${humanizeGraphRef(tc.args?.source, nodeLabelMap)} ↔ ${humanizeGraphRef(tc.args?.target, nodeLabelMap)}`}
                      {tc.tool === 'flag_significance' && `★ Noted as important: ${(tc.args?.reason || '').substring(0, 68)}`}
                      {tc.tool === 'flag_divergence' && `⚑ Held both perspectives: ${humanizeGraphRef(tc.args?.topic, nodeLabelMap)}`}
                      {tc.tool === 'thicken_edge' && `↑ Reinforced: ${humanizeGraphRef(tc.args?.source, nodeLabelMap)} ↔ ${humanizeGraphRef(tc.args?.target, nodeLabelMap)}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="fade-enter-active" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5FAEB0', fontSize: '0.85rem' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Ally is thinking...
          </div>
        )}
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', background: '#050608' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            data-testid="live-chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={`Talk to Ally as ${patientName.split(' ')[0]}...`}
            style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEAE3', padding: '12px 14px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
          />
          <button data-testid="live-chat-send" onClick={handleSend} disabled={loading || !input.trim()} style={{ background: loading ? 'rgba(77,184,184,0.2)' : '#5FAEB0', border: 'none', color: '#050608', padding: '12px 16px', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * STANDALONE LIVE CHAT VIEW — Full-screen patient chat (H1, H7, C1)
 * ═══════════════════════════════════════════════════════════════════ */
function StandaloneLiveChat({ patientId, patientName, onBack }) {
  const [detailKind, setDetailKind] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], positions: {} });
  const [highlight, setHighlight] = useState([]);
  const [convId, setConvId] = useState(null);
  const [consolidating, setConsolidating] = useState(false);
  const [consolidationResult, setConsolidationResult] = useState(null);
  const [consolidationError, setConsolidationError] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [mobilePane, setMobilePane] = useState('chat'); // 'chat' | 'graph' (H7)
  const [isAdmin, setIsAdmin] = useState(() => api.getAuthRole() === 'admin');
  const [statusNotice, setStatusNotice] = useState(null);
  const [chatResetNonce, setChatResetNonce] = useState(0);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [ritualMode, setRitualMode] = useState('idle'); // 'idle' | 'scanning' | 'integrating'
  const [ritualStage, setRitualStage] = useState(0);
  const [expandedDebateStep, setExpandedDebateStep] = useState(null);
  const [activeStepIndex, setActiveStepIndex] = useState(null);
  const ritualTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (ritualTimerRef.current) clearTimeout(ritualTimerRef.current);
    };
  }, []);

  const nodeLabelMap = useMemo(() => {
    const map = {};
    (graphData.nodes || []).forEach(n => {
      map[n.id] = String(n.label || n.id).replace(/\s+/g, ' ').trim();
    });
    return map;
  }, [graphData.nodes]);

  const refreshGraph = () => {
    Promise.all([api.getGraph(patientId), api.getGraphPositions(patientId)])
      .then(([graph, posData]) => {
        const nodes = (graph.nodes || []).map((n) => ({
          id: n.id, label: n.label || n.id.replace(/_/g, ' '),
          kind: n.kind || 'event', size: n.size || 30,
          is_new: n.is_new || false,
          consolidated_new: n.consolidated_new || false,
        }));
        const edges = (graph.edges || []).map((e) => ({
          source: e.source, target: e.target,
          weight: e.weight || 1, dashed: e.dashed || e.inferred || false,
          is_new: e.is_new || false,
          consolidated_new: e.consolidated_new || false,
        }));
        setGraphData({ nodes, edges, positions: posData.positions || posData || {} });
      })
      .catch(() => setGraphData({ nodes: [], edges: [], positions: {} }));
  };

  useEffect(() => { refreshGraph(); }, [patientId]);

  const handleGraphUpdate = (currentGraph, skipAutoHighlight = false) => {
    if (!currentGraph) return;
    const nodes = (currentGraph.nodes || []).map((n) => ({
      id: n.id, label: n.label || n.id.replace(/_/g, ' '),
      kind: n.kind || 'event', size: n.size || 30,
      is_new: n.is_new || false,
      consolidated_new: n.consolidated_new || false,
    }));
    const edges = (currentGraph.edges || []).map((e) => ({
      source: e.source, target: e.target,
      weight: e.weight || 1, dashed: e.dashed || e.inferred || false,
      is_new: e.is_new || false,
      consolidated_new: e.consolidated_new || false,
    }));
    setGraphData(prev => {
      const prevIds = new Set((prev.nodes || []).map(n => n.id));
      const trulyNewIds = nodes.filter(n => !prevIds.has(n.id)).map(n => n.id);

      if (!skipAutoHighlight && trulyNewIds.length > 0) {
        setHighlight(trulyNewIds);
        setTimeout(() => setHighlight([]), 4000);
      }

      const newPositions = { ...prev.positions };
      (currentGraph.nodes || []).forEach(rawNode => {
        if (typeof rawNode.x === 'number' && typeof rawNode.y === 'number' && (rawNode.x !== 0 || rawNode.y !== 0)) {
          newPositions[rawNode.id] = { x: rawNode.x, y: rawNode.y };
        } else if (!newPositions[rawNode.id]) {
          newPositions[rawNode.id] = { x: 200 + Math.random() * 700, y: 100 + Math.random() * 400 };
        }
      });
      return { nodes, edges, positions: newPositions };
    });
  };

  const startIntegrationFinale = (resultObj) => {
    if (!resultObj) return;
    if (ritualTimerRef.current) clearTimeout(ritualTimerRef.current);
    setRitualMode('integrating');
    const delta = resultObj.integration_delta || {};
    const allTouched = Array.from(new Set([
      ...(delta.encoded_short_term_ids || []),
      ...(delta.new_consolidation_node_ids || []),
      ...(delta.significant_node_ids || []),
      ...(delta.inferred_node_ids || []),
      ...(delta.merged_or_thickened_ids || []),
    ]));
    if (allTouched.length > 0) {
      setHighlight(allTouched);
    }
    ritualTimerRef.current = setTimeout(() => {
      setRitualMode('idle');
      setHighlight([]);
    }, 4500);
  };

  const runConsolidation = async (targetConvId) => {
    setConsolidating(true);
    setConsolidationError(null);
    setConsolidationResult(null);
    setRitualMode('scanning');
    setRitualStage(0);
    setActiveStepIndex(null);
    setExpandedDebateStep(null);
    try {
      const result = await api.triggerConsolidation(patientId, targetConvId);
      if (!result || result.status === 'error' || !Array.isArray(result.steps) || result.steps.length === 0) {
        throw new Error(result?.detail || 'Consolidation pipeline returned an incomplete state.');
      }
      setConsolidationResult(result);
      if (result.final_graph) {
        handleGraphUpdate(result.final_graph, true);
      }
      refreshGraph();
      startIntegrationFinale(result);
      if (patientId.includes('elena') || patientId.includes('daniel')) {
        api.generateHandoff(patientId, 'Dr. A. Patel', 'Clinician').catch(() => {});
      }
    } catch (e) {
      console.error('Consolidation error:', e);
      // Reconcile against authoritative backend conversation status so UI and API never disagree
      try {
        const convData = await api.getConversations(patientId);
        const convList = Array.isArray(convData) ? convData : (convData?.conversations || []);
        const matchingConv = convList.find(
          c => (targetConvId && c.id === targetConvId) || (!targetConvId && c.status === 'consolidated')
        );
        if (matchingConv && matchingConv.status === 'consolidated') {
          const fallbackSteps = await api.getConsolidationSteps(patientId).catch(() => ({ steps: [] }));
          const graphSnapshot = await api.getGraph(patientId).catch(() => ({}));
          const reconciled = {
            status: 'completed',
            conversation_id: matchingConv.id,
            conversation_status: 'consolidated',
            steps: fallbackSteps?.steps?.length ? fallbackSteps.steps : [
              { id: 'contradiction_detection', title: '1. Contradiction Detection', summary: 'Completed on server' },
              { id: 'weight_recalculation', title: '2. Weight Recalculation', summary: 'Completed on server' },
              { id: 'credibility_weighting', title: '3. Credibility Weighting', summary: 'Completed on server' },
              { id: 'consent_audit', title: '4. Consent Gate Audit', summary: 'Completed on server' },
            ],
            graph: graphSnapshot,
          };
          setConsolidationResult(reconciled);
          refreshGraph();
          startIntegrationFinale(reconciled);
          return;
        }
      } catch {
        // Ignore reconciliation error and display primary consolidation failure
      }
      setRitualMode('idle');
      setConsolidationError(e.message || 'Consolidation pipeline failed.');
    } finally {
      setConsolidating(false);
    }
  };

  const handleEndSession = async () => {
    if (!convId) return;
    setSessionEnded(true);
    setMobilePane('chat');
    try {
      await api.endConversation(patientId, convId);
    } catch (e) { console.error('End conversation error:', e); }
    await runConsolidation(convId);
  };

  const handleUnlockAdmin = async () => {
    const key = window.prompt('Enter Admin Key for reset / delete operations (local default: ally-local-admin-2026):', 'ally-local-admin-2026');
    if (!key) return;
    try {
      await api.elevateAdmin(key);
      setIsAdmin(true);
      setStatusNotice('Admin unlocked');
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (e) {
      setStatusNotice(`Admin unlock failed: ${e.message}`);
    }
  };

  const handleDeleteItem = async (kind, target) => {
    try {
      let result;
      if (kind === 'node') {
        result = await api.deleteNode(patientId, target.id);
      } else {
        result = await api.deleteEdge(patientId, target.source, target.target);
      }
      if (result.current_graph) {
        handleGraphUpdate(result.current_graph);
      } else {
        refreshGraph();
      }
      setDetailKind(null);
      setDetailTarget(null);
    } catch (e) {
      setStatusNotice(`Delete requires Admin role (${e.message})`);
    }
  };

  const handleReset = async () => {
    if (!isAdmin) {
      setStatusNotice('Admin role required to reset patient — click Admin Unlock first.');
      return;
    }
    if (!window.confirm(`Reset ${patientName} to initial seed data? This will erase live sandbox conversations and added nodes.`)) return;
    try {
      const result = await api.resetPatient(patientId);
      if (result.current_graph) {
        handleGraphUpdate(result.current_graph);
      }
      refreshGraph();
      setConsolidationResult(null);
      setConsolidationError(null);
      setSessionEnded(false);
      setConvId(null);
      setRitualMode('idle');
      setActiveStepIndex(null);
      setExpandedDebateStep(null);
      setChatResetNonce(n => n + 1);
      setStatusNotice('Patient reset to seed state');
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (e) {
      setStatusNotice(`Reset error: ${e.message}`);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#050608', color: '#fff', overflow: 'hidden' }}>
      {/* Responsive Header (H7) */}
      <div className="ally-live-header" style={{
        minHeight: '60px', padding: '8px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.02)', gap: '12px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.15)',
              color: '#9B9285', padding: '6px 10px', borderRadius: '6px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '0.78rem', fontFamily: "'Work Sans', sans-serif", flexShrink: 0,
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', color: '#5FAEB0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Patient Companion
            </div>
            <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.66rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {patientName} • {graphData.nodes.length} nodes
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {statusNotice && (
            <span style={{ fontSize: '0.7rem', color: '#D9B873', fontFamily: "'Work Sans', sans-serif" }}>{statusNotice}</span>
          )}
          <button
            data-testid="live-feedback-btn"
            onClick={() => setShowFeedbackModal(true)}
            style={{
              background: 'rgba(95,174,176,0.08)',
              border: '1px solid rgba(95,174,176,0.3)',
              color: '#5FAEB0', padding: '6px 10px', borderRadius: '6px',
              cursor: 'pointer', fontSize: '0.72rem', fontFamily: "'Work Sans', sans-serif",
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            💬 Give Feedback
          </button>
          <button
            data-testid="live-admin-btn"
            onClick={handleUnlockAdmin}
            style={{
              background: isAdmin ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isAdmin ? 'rgba(76,175,80,0.4)' : 'rgba(255,255,255,0.12)'}`,
              color: isAdmin ? '#4CAF50' : '#9B9285', padding: '6px 10px', borderRadius: '6px',
              cursor: 'pointer', fontSize: '0.72rem', fontFamily: "'Work Sans', sans-serif",
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            <Shield size={12} /> {isAdmin ? 'Admin' : 'Admin Unlock'}
          </button>
          <button
            data-testid="reset-seed-btn"
            onClick={handleReset}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
              color: isAdmin ? '#EDEAE3' : '#6B6560', padding: '6px 12px', borderRadius: '6px',
              cursor: 'pointer', fontSize: '0.72rem', fontFamily: "'Work Sans', sans-serif",
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            ↺ Reset
          </button>
          {!sessionEnded && (
            <button
              data-testid="end-consolidate-btn"
              onClick={handleEndSession}
              style={{
                background: 'rgba(200,72,72,0.15)', border: '1px solid rgba(200,72,72,0.4)',
                color: '#C84848', padding: '6px 12px', borderRadius: '6px',
                cursor: 'pointer', fontSize: '0.74rem', fontFamily: "'Work Sans', sans-serif",
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
            >
              End &amp; Consolidate
            </button>
          )}
          {sessionEnded && !consolidating && !consolidationError && (
            <div style={{ color: '#D9B873', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              ★ Consolidated
            </div>
          )}
          {sessionEnded && !consolidating && consolidationError && (
            <div style={{ color: '#E85D5D', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              ⚠ Consolidation Failed
            </div>
          )}
          {consolidating && (
            <div style={{ color: '#5FAEB0', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Consolidating...
            </div>
          )}
        </div>
      </div>

      {/* Mobile Chat / Graph Toggle Bar (H7 — visible on <= 768px) */}
      <div className="ally-mobile-tab-bar" style={{ background: '#0A0C10', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <button
          data-testid="mobile-tab-chat"
          onClick={() => setMobilePane('chat')}
          style={{
            flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
            background: mobilePane === 'chat' ? 'rgba(95,174,176,0.14)' : 'transparent',
            borderBottom: mobilePane === 'chat' ? '2px solid #5FAEB0' : '2px solid transparent',
            color: mobilePane === 'chat' ? '#5FAEB0' : '#8A857D',
            fontFamily: "'Work Sans', sans-serif", fontSize: '0.76rem', fontWeight: 600,
          }}
        >
          💬 Conversation
        </button>
        <button
          data-testid="mobile-tab-graph"
          onClick={() => setMobilePane('graph')}
          style={{
            flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
            background: mobilePane === 'graph' ? 'rgba(217,184,115,0.14)' : 'transparent',
            borderBottom: mobilePane === 'graph' ? '2px solid #D9B873' : '2px solid transparent',
            color: mobilePane === 'graph' ? '#D9B873' : '#8A857D',
            fontFamily: "'Work Sans', sans-serif", fontSize: '0.76rem', fontWeight: 600,
          }}
        >
          🧠 Memory Graph ({graphData.nodes.length})
        </button>
      </div>

      {/* Main Split Content (H7) */}
      <div className="ally-live-split" style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div
          className={mobilePane === 'graph' ? 'ally-live-pane-active-mobile' : 'ally-live-pane-hidden-mobile'}
          style={{ flex: 1, position: 'relative', minHeight: 0 }}
        >
          {graphData.nodes.length > 0 ? (
            <VirtualBrain
              nodes={graphData.nodes} edges={graphData.edges} positions={graphData.positions}
              highlight={highlight} pulseIds={highlight} significancePulse={true} viewBox="0 0 1100 620" showFirewall={false} opacity={1}
              ritualMode={ritualMode}
              ritualStage={ritualStage}
              integrationDelta={consolidationResult?.integration_delta}
              onReplayRitual={consolidationResult ? () => startIntegrationFinale(consolidationResult) : undefined}
              onNodeClick={(n) => { setDetailKind('node'); setDetailTarget(n); }}
              onEdgeClick={(e) => { setDetailKind('edge'); setDetailTarget(e); }}
              onBackgroundClick={() => { setDetailKind(null); setDetailTarget(null); }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>
                <Brain size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem' }}>Loading Neural Map…</div>
              </div>
            </div>
          )}

          {detailTarget && mobilePane === 'graph' && (
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(380px, 100%)', zIndex: 25 }}>
              <NodeDetailPanel
                kind={detailKind}
                target={detailTarget}
                nodes={graphData.nodes}
                onClose={() => { setDetailKind(null); setDetailTarget(null); }}
                onDelete={isAdmin ? handleDeleteItem : undefined}
              />
            </div>
          )}
        </div>

        <div
          className={mobilePane === 'chat' ? 'ally-live-pane-active-mobile' : 'ally-live-pane-hidden-mobile'}
          style={{ width: '400px', borderLeft: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, position: 'relative', minHeight: 0 }}
        >
          {consolidating && !consolidationResult && !consolidationError ? (
            <ConsolidationPanel
              isElena={patientId.includes('elena')}
              patientName={patientName}
              onStageChange={setRitualStage}
            />
          ) : sessionEnded && consolidationError ? (
            /* Explicit Error State on Consolidation Failure (H1) */
            <div data-testid="consolidation-error-card" className="fade-enter-active" style={{ padding: '32px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#E85D5D' }}>
                <AlertTriangle size={26} />
                <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.9rem', color: '#E85D5D', margin: 0 }}>Consolidation Failed</h2>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Session ended • Pending Long-Term Consolidation
              </div>
              <div style={{ padding: '14px 16px', background: 'rgba(232,93,93,0.1)', border: '1px solid rgba(232,93,93,0.35)', borderRadius: '8px', color: '#EDEAE3', fontSize: '0.86rem', lineHeight: 1.55 }}>
                {consolidationError}
              </div>
              <p style={{ color: '#A8A39A', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                This session has NOT been marked consolidated, so no disclosures were lost. You can retry consolidation now or run the unconsolidated-session sweep.
              </p>
              <button
                data-testid="retry-consolidation-btn"
                onClick={() => convId && runConsolidation(convId)}
                style={{ background: '#D9B873', color: '#050608', border: 'none', padding: '12px 18px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem' }}
              >
                ↻ Retry Consolidation
              </button>
            </div>
          ) : sessionEnded && consolidationResult ? (
            <div data-testid="consolidation-complete-card" className="fade-enter-active" style={{ padding: '24px 22px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.95rem', color: '#5FAEB0', marginBottom: '4px' }}>Consolidation Complete</h2>
              <div style={{ fontSize: '0.74rem', color: '#9B9285', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {patientName} • Short-Term → Long-Term Memory Encoded
              </div>

              {/* Memory Integration Delta Summary Banner */}
              <div
                data-testid="consolidation-delta-summary"
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(95,174,176,0.12), rgba(217,184,115,0.08))',
                  border: '1px solid rgba(95,174,176,0.35)',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.68rem', color: '#D9B873', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    ✦ Hippocampal → Cortical Transfer
                  </span>
                  <button
                    data-testid="panel-replay-ritual-btn"
                    onClick={() => startIntegrationFinale(consolidationResult)}
                    style={{
                      background: 'rgba(217,184,115,0.16)',
                      border: '1px solid rgba(217,184,115,0.45)',
                      color: '#D9B873',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "'Work Sans', sans-serif",
                    }}
                  >
                    ↻ Replay Ritual
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                  <div style={{ background: 'rgba(5,6,8,0.55)', padding: '6px 4px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#5FAEB0' }}>
                      {(consolidationResult.integration_delta?.encoded_short_term_ids?.length || 0) + (consolidationResult.integration_delta?.significant_node_ids?.length || 0)}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#9B9285', textTransform: 'uppercase' }}>Encoded LTM</div>
                  </div>
                  <div style={{ background: 'rgba(5,6,8,0.55)', padding: '6px 4px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#D9B873' }}>
                      {(consolidationResult.integration_delta?.new_consolidation_node_ids?.length || 0) + (consolidationResult.integration_delta?.inferred_node_ids?.length || 0)}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#9B9285', textTransform: 'uppercase' }}>Synthesized</div>
                  </div>
                  <div style={{ background: 'rgba(5,6,8,0.55)', padding: '6px 4px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#EDEAE3' }}>
                      {(consolidationResult.integration_delta?.new_consolidation_edge_keys?.length || 0) + (consolidationResult.integration_delta?.inferred_edge_keys?.length || 0)}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#9B9285', textTransform: 'uppercase' }}>New Synapses</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                <button
                  data-testid="start-next-session-btn"
                  onClick={() => {
                    setSessionEnded(false);
                    setConsolidationResult(null);
                    setConsolidationError(null);
                    setConvId(null);
                    setRitualMode('idle');
                    setActiveStepIndex(null);
                    setExpandedDebateStep(null);
                    setChatResetNonce(n => n + 1);
                    refreshGraph();
                  }}
                  style={{
                    width: '100%', padding: '11px 16px', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, #D9B873, #C4A35A)', color: '#050608',
                    fontWeight: 700, fontSize: '0.8rem', fontFamily: "'Work Sans', sans-serif",
                    textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
                  }}
                >
                  ▶ Start Next Session (See What Ally Remembers)
                </button>
                <button
                  data-testid="consolidation-feedback-btn"
                  onClick={() => setShowFeedbackModal(true)}
                  style={{
                    width: '100%', padding: '9px 16px', borderRadius: '8px',
                    background: 'rgba(95,174,176,0.1)', border: '1px solid rgba(95,174,176,0.35)',
                    color: '#5FAEB0', fontWeight: 600, fontSize: '0.78rem',
                    fontFamily: "'Work Sans', sans-serif", cursor: 'pointer',
                  }}
                >
                  💬 Give Feedback on Your Session
                </button>
              </div>

              <div style={{ fontSize: '0.68rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                5-Stage Advocate / Skeptic / Judge Pipeline (Click Step to Highlight Graph)
              </div>

              {consolidationResult.steps && consolidationResult.steps.map((step, i) => {
                const j = step.judge || {};
                const changes = Array.isArray(step.changes)
                  ? step.changes
                  : (typeof step.changes === 'string' && step.changes.trim()
                    ? step.changes.split('; ').map(s => s.trim()).filter(Boolean)
                    : []);
                const advArg = step.debate?.advocate?.argument || step.advocate?.argument || '';
                const skepArg = step.debate?.skeptic?.argument || step.skeptic?.argument || '';
                const touchedIds = Array.isArray(step.touched_node_ids) ? step.touched_node_ids : [];
                const isSelected = activeStepIndex === i;
                const isDebateOpen = expandedDebateStep === i;

                return (
                  <div
                    key={i}
                    data-testid={`consolidation-step-card-${i}`}
                    onClick={() => {
                      setActiveStepIndex(isSelected ? null : i);
                      if (!isSelected && touchedIds.length > 0) {
                        setHighlight(touchedIds);
                      } else if (isSelected) {
                        setHighlight([]);
                      }
                    }}
                    onMouseEnter={() => {
                      if (touchedIds.length > 0) setHighlight(touchedIds);
                    }}
                    style={{
                      marginBottom: '12px',
                      padding: '13px 14px',
                      background: isSelected ? 'rgba(95,174,176,0.11)' : 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      border: `1px solid ${isSelected ? 'rgba(95,174,176,0.45)' : 'rgba(255,255,255,0.07)'}`,
                      borderLeft: `3px solid ${isSelected ? '#5FAEB0' : '#D9B873'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                      <div style={{ fontWeight: 600, color: '#D9B873', fontSize: '0.86rem' }}>
                        {step.step || (i + 1)}. {step.title}
                      </div>
                      {touchedIds.length > 0 && (
                        <span style={{
                          fontSize: '0.62rem', color: '#5FAEB0',
                          background: 'rgba(95,174,176,0.14)',
                          border: '1px solid rgba(95,174,176,0.3)',
                          padding: '2px 6px', borderRadius: '999px', whiteSpace: 'nowrap',
                        }}>
                          {touchedIds.length} node{touchedIds.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    {/* Step Changes Summary (Always Present) */}
                    {changes.length > 0 && (
                      <ul data-testid={`step-changes-${i}`} style={{ paddingLeft: '18px', margin: '4px 0 6px 0', fontSize: '0.78rem', color: '#D5D0C6', lineHeight: 1.45 }}>
                        {changes.map((c, idx) => (
                          <li key={idx}>{humanizeGraphRef(String(c), nodeLabelMap)}</li>
                        ))}
                      </ul>
                    )}

                    {/* Step 1: Significant Disclosures & Size Adjustments */}
                    {Array.isArray(j.significant_disclosures) && j.significant_disclosures.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#EDEAE3', marginTop: '6px' }}>
                        <span style={{ color: '#9B9285', fontSize: '0.68rem', textTransform: 'uppercase' }}>Added / Promoted Nodes:</span>
                        <ul style={{ paddingLeft: '18px', margin: '3px 0 0 0' }}>
                          {j.significant_disclosures.map((d, idx) => (
                            <li key={idx}>
                              <strong>{d.label || humanizeGraphRef(d.node_id, nodeLabelMap)}</strong>
                              {d.reason ? ` — ${d.reason}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(j.size_adjustments) && j.size_adjustments.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#5FAEB0', marginTop: '6px' }}>
                        <span style={{ color: '#9B9285', fontSize: '0.68rem', textTransform: 'uppercase' }}>Salience Weight Updates:</span>
                        <ul style={{ paddingLeft: '18px', margin: '3px 0 0 0' }}>
                          {j.size_adjustments.map((s, idx) => (
                            <li key={idx}>
                              {humanizeGraphRef(s.node_id, nodeLabelMap)} → weight {s.new_size}
                              {s.reason ? ` (${s.reason})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Step 2: Flagged Divergences */}
                    {Array.isArray(j.divergences) && j.divergences.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#E85D5D', marginTop: '6px' }}>
                        <span style={{ color: '#9B9285', fontSize: '0.68rem', textTransform: 'uppercase' }}>Flagged Divergences:</span>
                        <ul style={{ paddingLeft: '18px', margin: '3px 0 0 0' }}>
                          {j.divergences.map((d, idx) => (
                            <li key={idx}>
                              <strong>{d.topic}</strong>
                              {d.severity ? ` [${d.severity}]` : ''}
                              {d.clinical_question ? ` — ${d.clinical_question}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Step 3: Merge Candidates */}
                    {Array.isArray(j.merge_candidates) && j.merge_candidates.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#D9B873', marginTop: '6px' }}>
                        <span style={{ color: '#9B9285', fontSize: '0.68rem', textTransform: 'uppercase' }}>Consolidated Clusters:</span>
                        <ul style={{ paddingLeft: '18px', margin: '3px 0 0 0' }}>
                          {j.merge_candidates.map((m, idx) => (
                            <li key={idx}>
                              {m.remove_id && m.keep_id
                                ? <>{humanizeGraphRef(m.remove_id, nodeLabelMap)} → <strong>{humanizeGraphRef(m.keep_id, nodeLabelMap)}</strong></>
                                : <>{(m.nodes || []).map(id => humanizeGraphRef(id, nodeLabelMap)).join(' + ')} → <strong>{m.merged_label}</strong></>
                              }
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Step 4: Edge Thickening */}
                    {Array.isArray(j.edge_thickening) && j.edge_thickening.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#5FAEB0', marginTop: '6px' }}>
                        <span style={{ color: '#9B9285', fontSize: '0.68rem', textTransform: 'uppercase' }}>Reinforced Synaptic Pathways:</span>
                        <ul style={{ paddingLeft: '18px', margin: '3px 0 0 0' }}>
                          {j.edge_thickening.map((et, idx) => (
                            <li key={idx}>
                              {humanizeGraphRef(et.source, nodeLabelMap)} ↔ {humanizeGraphRef(et.target, nodeLabelMap)} (w={et.new_weight})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Step 5: Inferred Nodes & Inferred Edges */}
                    {Array.isArray(j.inferred_nodes) && j.inferred_nodes.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#D9B873', marginTop: '6px' }}>
                        <span style={{ color: '#9B9285', fontSize: '0.68rem', textTransform: 'uppercase' }}>Latent Pattern Nodes:</span>
                        <ul style={{ paddingLeft: '18px', margin: '3px 0 0 0' }}>
                          {j.inferred_nodes.map((n, idx) => (
                            <li key={idx}>
                              <strong>{n.label}</strong>
                              {n.connected_to ? ` (linked to ${humanizeGraphRef(n.connected_to, nodeLabelMap)})` : ''}
                              {n.evidence ? ` — ${n.evidence}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(j.inferred_edges) && j.inferred_edges.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#4DB8B8', marginTop: '6px' }}>
                        <span style={{ color: '#9B9285', fontSize: '0.68rem', textTransform: 'uppercase' }}>Inferred Connections:</span>
                        <ul style={{ paddingLeft: '18px', margin: '3px 0 0 0' }}>
                          {j.inferred_edges.map((e, idx) => (
                            <li key={idx}>
                              {humanizeGraphRef(e.source, nodeLabelMap)} ↔ {humanizeGraphRef(e.target, nodeLabelMap)}
                              {(e.label || e.reason) ? ` (${e.label || e.reason})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Advocate / Skeptic Reasoning Toggle */}
                    {(advArg || skepArg) && (
                      <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                        <button
                          data-testid={`step-debate-toggle-${i}`}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setExpandedDebateStep(isDebateOpen ? null : i);
                          }}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            color: '#9B9285', fontSize: '0.7rem', cursor: 'pointer',
                            fontFamily: "'Work Sans', sans-serif", display: 'flex', alignItems: 'center', gap: '4px',
                          }}
                        >
                          ⚖ {isDebateOpen ? 'Hide' : 'View'} Advocate / Skeptic Reasoning
                        </button>
                        {isDebateOpen && (
                          <div
                            data-testid={`step-debate-body-${i}`}
                            onClick={(ev) => ev.stopPropagation()}
                            style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.74rem', lineHeight: 1.45 }}
                          >
                            {advArg && (
                              <div style={{ padding: '7px 9px', borderRadius: '6px', background: 'rgba(95,174,176,0.08)', borderLeft: '2px solid #5FAEB0', color: '#D5D0C6' }}>
                                <strong style={{ color: '#5FAEB0', textTransform: 'uppercase', fontSize: '0.64rem', letterSpacing: '0.06em' }}>Advocate: </strong>
                                {advArg}
                              </div>
                            )}
                            {skepArg && (
                              <div style={{ padding: '7px 9px', borderRadius: '6px', background: 'rgba(217,184,115,0.08)', borderLeft: '2px solid #D9B873', color: '#D5D0C6' }}>
                                <strong style={{ color: '#D9B873', textTransform: 'uppercase', fontSize: '0.64rem', letterSpacing: '0.06em' }}>Skeptic: </strong>
                                {skepArg}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <LiveChat
              key={chatResetNonce}
              patientId={patientId}
              patientName={patientName}
              onGraphUpdate={handleGraphUpdate}
              onConvIdReady={setConvId}
              nodeLabelMap={nodeLabelMap}
              sessionEndedExternal={sessionEnded}
            />
          )}
          {detailTarget && !consolidating && !sessionEnded && mobilePane === 'chat' && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}>
              <NodeDetailPanel
                kind={detailKind}
                target={detailTarget}
                nodes={graphData.nodes}
                onClose={() => { setDetailKind(null); setDetailTarget(null); }}
                onDelete={isAdmin ? handleDeleteItem : undefined}
              />
            </div>
          )}
        </div>
      </div>
      {showFeedbackModal && (
        <FeedbackModal
          patientId={patientId}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * MAIN APP — State machine with Server-Backed Gate + Demo + Chat modes
 * ═══════════════════════════════════════════════════════════════════ */
function App() {
  const [appMode, setAppMode] = useState(APP_MODE.LANDING);
  const [showIntro, setShowIntro] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    try {
      return !(sessionStorage.getItem('prism_terms_accepted') === 'true' && api.getAuthToken());
    } catch (e) {
      return true;
    }
  });
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [gateError, setGateError] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [isClinician, setIsClinician] = useState(false);

  // ── Demo state (canonical 18-step guided presentation) ─────────
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [chatIndex, setChatIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [detailKind, setDetailKind] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [presenterMode, setPresenterMode] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const chatContainerRef = useRef(null);

  const handleAcceptDisclaimer = async () => {
    setAcceptingTerms(true);
    setGateError(null);
    try {
      await api.acceptTerms();
      setShowDisclaimer(false);
    } catch (e) {
      setGateError(`Unable to establish authorized session: ${e.message}`);
    } finally {
      setAcceptingTerms(false);
    }
  };

  const phase = PHASES[phaseIdx] || 'end';
  const isElena = phase.includes('elena') || phase === 'elena_profile';

  let conversation = isElena ? ELENA_CONVERSATION : DANIEL_CONVERSATION;
  if (phase === 'elena_next_chat') conversation = ELENA_NEXT_CONVERSATION;

  const packageData = isElena ? ELENA_HANDOFF_PACKAGE : DANIEL_TRAN_PACKAGE;

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

  const skipToEnd = () => {
    setIsPlaying(false);
    setPhaseIdx(PHASES.length - 1);
    setChatIndex(0);
  };

  const skipPhase = () => {
    setIsPlaying(false);
    if (phaseIdx < PHASES.length - 1) {
      setPhaseIdx(p => p + 1);
      setChatIndex(0);
    }
  };

  // Keyboard navigation (only in DEMO mode)
  useEffect(() => {
    if (appMode !== APP_MODE.DEMO || showIntro) return;
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); forceNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); forcePrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Auto-advance
  useEffect(() => {
    if (appMode !== APP_MODE.DEMO || showIntro) return;
    if (!isPlaying || phase === 'end') return;
    let delay = 3000;
    if (phase === 'elena_profile' || phase === 'daniel_profile') { delay = 10000; const t = setTimeout(() => setPhaseIdx(p => p + 1), delay / speedMultiplier); return () => clearTimeout(t); }
    if (phase.includes('graph')) { delay = 5000; const t = setTimeout(() => setPhaseIdx(p => p + 1), delay / speedMultiplier); return () => clearTimeout(t); }
    if (phase.includes('handoff') || phase.includes('provider') || phase.includes('transition') || phase.includes('consolidation') || phase.includes('reasoning') || phase.includes('updates') || phase === 'family_system') {
      delay = 8000; const t = setTimeout(() => setPhaseIdx(p => p + 1), delay / speedMultiplier); return () => clearTimeout(t);
    }
    if (phase.includes('chat')) {
      if (wowMoment) { delay = wowMoment.duration; } else { delay = Math.max(1500, conversation[chatIndex].text.length * 40); }
      const t = setTimeout(() => { if (chatIndex < conversation.length - 1) { setChatIndex(c => c + 1); } else { setChatIndex(0); setPhaseIdx(p => p + 1); } }, delay / speedMultiplier);
      return () => clearTimeout(t);
    }
  }, [phaseIdx, chatIndex, isPlaying, phase, conversation, wowMoment, speedMultiplier, appMode, showIntro]);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    setDetailKind(null); setDetailTarget(null);
  }, [chatIndex, phase]);

  // ── ROUTING ────────────────────────────────────────────────────

  // LANDING PAGE + SERVER-ENFORCED ENTRY GATE (C2, L3)
  if (appMode === APP_MODE.LANDING) {
    return (
      <>
      {showDisclaimer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0D0F14', border: '1px solid rgba(255,80,80,0.3)', borderRadius: '16px', padding: '20px 28px', maxWidth: '680px', width: '92%', maxHeight: '94vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexShrink: 0 }}>
              <span style={{ fontSize: '1.4rem' }}>⚠️</span>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', fontWeight: 700, color: '#FF6B6B', margin: 0 }}>Experimental Demo — Not for Clinical Use</h2>
            </div>
            <div style={{ color: '#EDEAE3', fontSize: '0.8rem', lineHeight: 1.48, marginBottom: '12px', overflowY: 'auto', flex: 1 }}>
              <p style={{ margin: '0 0 8px 0' }}>This application is an <strong style={{ color: '#FF6B6B' }}>experimental research prototype</strong> under active development. By proceeding, you acknowledge:</p>
              <ul style={{ paddingLeft: '18px', margin: '0 0 10px 0' }}>
                <li style={{ marginBottom: '5px' }}><strong style={{ color: '#D9B873' }}>No PHI or PPI.</strong> Do not enter any Protected Health Information or Personal Patient Information. Data protection safeguards are not in place.</li>
                <li style={{ marginBottom: '5px' }}><strong style={{ color: '#D9B873' }}>All data is visible to developers.</strong> Any text entered into this system may be viewed by the development team for debugging and improvement purposes.</li>
                <li style={{ marginBottom: '5px' }}><strong style={{ color: '#D9B873' }}>Not a medical device.</strong> This system does not provide medical advice, diagnosis, or treatment recommendations. It is a technology demonstration only.</li>
                <li style={{ marginBottom: '5px' }}><strong style={{ color: '#D9B873' }}>No warranty or liability.</strong> The developer assumes no responsibility for any outcomes, decisions, or actions taken based on interactions with this system.</li>
                <li style={{ marginBottom: '5px' }}><strong style={{ color: '#D9B873' }}>Proprietary IP &amp; Non-Reverse-Engineering.</strong> This platform—including the Prism Architecture, Temporal Memory Graph, Adversarial Reasoning Engine, workflows, and UI/UX—is the exclusive confidential and proprietary property of <strong style={{ color: '#EDEAE3' }}>Rishi Khullar and Unusual Insights Inc.</strong> By proceeding, you agree not to copy, reproduce, record, scrape, reverse-engineer, decompile, or use any concepts or workflows shown here to build or train a competing product or service.</li>
              </ul>
              <p style={{ color: '#9B9285', fontSize: '0.74rem', fontStyle: 'italic', margin: '0 0 6px 0' }}>All patient scenarios shown are fictional. Any resemblance to real individuals is coincidental.</p>
              <div data-testid="disclaimer-copyright" style={{ paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', color: '#9B9285', fontSize: '0.73rem', letterSpacing: '0.03em' }}>
                © 2026 <strong style={{ color: '#D9B873' }}>Rishi Khullar — Unusual Insights Inc.</strong> All Rights Reserved. Proprietary &amp; Confidential.
              </div>
              {gateError && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(232,93,93,0.14)', border: '1px solid rgba(232,93,93,0.4)', borderRadius: '6px', color: '#FF6B6B', fontSize: '0.75rem' }}>
                  {gateError}
                </div>
              )}
            </div>
            <button
              data-testid="accept-disclaimer-btn"
              onClick={handleAcceptDisclaimer}
              disabled={acceptingTerms}
              style={{ width: '100%', padding: '12px', flexShrink: 0, background: 'linear-gradient(135deg, #D9B873, #C4A35A)', border: 'none', borderRadius: '8px', color: '#050608', fontWeight: 700, fontSize: '0.92rem', cursor: acceptingTerms ? 'wait' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', transition: 'transform 0.2s' }}
              onMouseOver={e => e.target.style.transform = 'scale(1.01)'}
              onMouseOut={e => e.target.style.transform = 'scale(1)'}
            >
              {acceptingTerms ? 'Authorizing Session...' : 'I Understand & Agree — Proceed to Demo'}
            </button>
          </div>
        </div>
      )}
      <LandingPage
        onDemoMode={() => {
          setPhaseIdx(0); setChatIndex(0); setIsPlaying(false);
          setSpeedMultiplier(1); setLiveMode(false);
          setShowIntro(true);
          setAppMode(APP_MODE.DEMO);
        }}
        onChatMode={() => {
          setIsClinician(false);
          setAppMode(APP_MODE.PATIENT_PICKER);
        }}
        onProviderMode={() => {
          setIsClinician(true);
          setAppMode(APP_MODE.PATIENT_PICKER);
        }}
      />
      </>
    );
  }

  // PATIENT PICKER
  if (appMode === APP_MODE.PATIENT_PICKER) {
    return (
      <PatientPicker
        onSelectPatient={(id, name) => {
          setSelectedPatientId(id);
          setSelectedPatientName(name);
          setAppMode(isClinician ? APP_MODE.CLINICIAN_CHAT : APP_MODE.LIVE_CHAT);
        }}
        onBack={() => setAppMode(APP_MODE.LANDING)}
        isClinician={isClinician}
        onToggleClinician={() => setIsClinician(!isClinician)}
      />
    );
  }

  // LIVE CHAT (standalone sandbox, from patient picker)
  if (appMode === APP_MODE.LIVE_CHAT) {
    return (
      <StandaloneLiveChat
        patientId={selectedPatientId}
        patientName={selectedPatientName}
        onBack={() => setAppMode(APP_MODE.PATIENT_PICKER)}
      />
    );
  }

  // CLINICIAN CHAT
  if (appMode === APP_MODE.CLINICIAN_CHAT) {
    return (
      <ClinicianChat
        patientId={selectedPatientId}
        patientName={selectedPatientName}
        onBack={() => setAppMode(APP_MODE.PATIENT_PICKER)}
      />
    );
  }

  // ── DEMO MODE (isolated canonical 18-step presentation) ────────
  if (showIntro) {
    return <IntroSequence onComplete={() => setShowIntro(false)} />;
  }

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
    // Honest wording matching per-patient keyed logical isolation (M8)
    insight = { title: "THE FIREWALL", body: "Ally models each patient's family context independently while enforcing per-patient keyed logical isolation between records — zero cross-patient edges or shared context." };
  } else if (phase === 'elena_graph' || phase === 'elena_graph_intro') {
    insight = { title: "ALLY UNDERSTANDS", body: "Ally builds a living, multidimensional neural map of beliefs, events, and family systems, holding contradictions objectively." };
  } else if (phase === 'daniel_graph') {
    insight = { title: "ALLY UNDERSTANDS", body: "Different patient. Different neural architecture. Watch how Ally handles Daniel's intense shame and clinical non-compliance." };
  } else if (phase === 'elena_chat') {
    if (chatIndex > 8) { nodes = ELENA_NODES_AFTER_SESSION; edges = ELENA_EDGES_AFTER_SESSION; }
    if (wowMoment) { highlight = wowMoment.highlight; insight = wowMoment.insight; }
  } else if (phase === 'elena_consolidation') {
    nodes = ELENA_NODES_AFTER_CONSOLIDATION; edges = ELENA_EDGES_AFTER_CONSOLIDATION;
    insight = { title: "ALLY LEARNS", body: "The 5-step post-session pipeline filters significance, checks credibility, merges nodes, thickens edges, and generates inferred connections." };
  } else if (phase === 'elena_reasoning') {
    nodes = ELENA_NODES_AFTER_CONSOLIDATION; edges = ELENA_EDGES_AFTER_CONSOLIDATION;
    insight = { title: "ALLY REASONS", body: "The Adversarial Engine runs over the memory graph. It catches the Bipolar-II risk before an antidepressant is prescribed—surfacing the can't-miss alternative a single anchored model would overlook." };
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
    insight = { title: "ALLY LEARNS", body: "Daniel's avoidance of testing is inferred to be connected to fear of disrupting what Marco represents." };
  } else if (phase === 'daniel_handoff') {
    nodes = DANIEL_NODES_AFTER_SESSION; edges = DANIEL_EDGES_AFTER_SESSION;
    highlight = ['tran_referral'];
  } else if (phase === 'daniel_updates') {
    nodes = DANIEL_NODES_AFTER_CLINICIANS; edges = DANIEL_EDGES_AFTER_CLINICIANS;
    highlight = ['hiv_negative', 'descovy_initiated'];
    insight = { title: "ALLY COLLABORATES", body: "Both Dr. Tran and Dr. Patel report back. The graph evolves. An inferred edge is confirmed. The bot adapts." };
  }

  const btnStyle = { background: 'none', border: 'none', color: '#D9B873', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' };
  const presenterInfo = PRESENTER_NOTES[phase] || { label: phase.replace(/_/g, ' '), note: '' };

  if (phase === 'end') {
    return (
      <div className="fade-enter-active" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#050608', color: '#fff', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3.5rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300 }}>Ally Remembers.</h2>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3.5rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300 }}>Ally Knows You.</h2>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3.5rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300 }}>Ally Cares.</h2>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3.5rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300 }}>Ally Collaborates.</h2>
        </div>
        <h1 style={{ fontFamily: 'Work Sans', fontSize: '2rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600 }}>
          Your Ally is there for you.
        </h1>
        <div style={{ marginTop: '50px', display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={forcePrev}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#EDEAE3', padding: '14px 24px', borderRadius: '30px', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <StepBack size={18} /> Previous Step
          </button>
          <button
            onClick={() => { setPhaseIdx(0); setChatIndex(0); setIsPlaying(false); setSpeedMultiplier(1); }}
            style={{ background: 'none', border: '1px solid rgba(217,184,115,0.5)', color: '#D9B873', padding: '14px 28px', borderRadius: '30px', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.3s' }}
          >
            <RotateCcw size={18} /> Restart Demonstration
          </button>
          <button
            onClick={() => { setSelectedPatientId('elena-ramirez-001'); setSelectedPatientName('Elena Ramirez'); setIsClinician(false); setAppMode(APP_MODE.LIVE_CHAT); }}
            style={{ background: '#5FAEB0', border: 'none', color: '#050608', padding: '14px 28px', borderRadius: '30px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <Send size={18} /> Try Live Sandbox Conversation
          </button>
          <button
            onClick={() => setAppMode(APP_MODE.LANDING)}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#9B9285', padding: '14px 28px', borderRadius: '30px', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <ArrowLeft size={18} /> Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Main Demo Mode Layout (with Presenter Banner M5 & Visible Story Controls M3) ──
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#050608', color: '#fff' }}>
      {/* Header & Controls */}
      <div style={{ height: '60px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => setAppMode(APP_MODE.LANDING)}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.12)',
              color: '#9B9285', padding: '4px 10px', borderRadius: '6px',
              cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Work Sans', sans-serif",
            }}
          >
            Home
          </button>
          <div style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.5rem', color: '#D9B873' }}>Castle Behavioral Health</div>
        </div>

        <div style={{ display: 'flex', gap: '18px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: '30px' }}>
          <button
            data-testid="presenter-mode-toggle"
            onClick={() => setPresenterMode(!presenterMode)}
            style={{
              ...btnStyle,
              color: presenterMode ? '#050608' : '#9B9285',
              background: presenterMode ? '#D9B873' : 'transparent',
              border: presenterMode ? '1px solid #D9B873' : '1px solid rgba(255,255,255,0.15)',
              padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: presenterMode ? 700 : 400,
            }}
            title="Toggle Presenter Teleprompter & Clinical Notes"
          >
            {presenterMode ? '🎙 Presenter Mode: ON' : 'Presenter Mode: OFF'}
          </button>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '14px' }}>
            <span style={{ fontSize: '0.72rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Speed ({speedMultiplier}x)</span>
            <input type="range" min="0.5" max="4" step="0.5" value={speedMultiplier} onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))} style={{ width: '75px', cursor: 'pointer', accentColor: '#D9B873' }} />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={forcePrev} style={btnStyle} title="Step Back"><StepBack size={18} /></button>
            <button onClick={() => setIsPlaying(!isPlaying)} style={{ ...btnStyle, color: '#fff' }} title={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button onClick={forceNext} style={btnStyle} title="Step Forward"><StepForward size={18} /></button>
          </div>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={skipPhase} style={btnStyle} title="Skip to Next Phase"><FastForward size={18} /></button>
            <button onClick={() => { setPhaseIdx(0); setChatIndex(0); setIsPlaying(false); setSpeedMultiplier(1); }} style={btnStyle} title="Restart"><RotateCcw size={18} /></button>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Work Sans', sans-serif" }}>
          Phase {phaseIdx + 1} / {PHASES.length} • {presenterInfo.label}
        </div>
      </div>

      {/* Presenter Teleprompter & Speaker Notes Banner (M5 — unmistakable visible effect on toggle) */}
      {presenterMode && (
        <div
          data-testid="presenter-notes-banner"
          style={{
            padding: '10px 28px',
            background: 'linear-gradient(90deg, rgba(217,184,115,0.14) 0%, rgba(95,174,176,0.10) 100%)',
            borderBottom: '1px solid rgba(217,184,115,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontFamily: "'Work Sans', sans-serif", fontSize: '0.82rem', color: '#EDEAE3' }}>
            <span style={{ background: '#D9B873', color: '#050608', fontWeight: 700, fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
              Speaker Cue
            </span>
            <span>{presenterInfo.note}</span>
          </div>
          {phase.includes('chat') && (
            <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.72rem', color: '#D9B873', flexShrink: 0 }}>
              Turn {chatIndex + 1} of {conversation.length}
            </span>
          )}
        </div>
      )}

      {/* Phase Body */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {phase === 'transition_daniel' ? (
          <div className="fade-enter-active" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#050608', color: '#fff', padding: '0 15%' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2.8rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300, marginBottom: '20px', textAlign: 'center' }}>
              Empathy is easy when the patient is cooperative.
            </h2>
            <h1 style={{ fontFamily: 'Work Sans', fontSize: '1.8rem', color: '#EDEAE3', letterSpacing: '0.04em', fontWeight: 300, textAlign: 'center', lineHeight: 1.6, marginBottom: '32px' }}>
              Let's see what Ally does when the patient is avoiding medical care due to shame and fear.
            </h1>
            <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3.6rem', color: '#D9B873', fontWeight: 600 }}>
              Meet Daniel.
            </h2>
          </div>
        ) : phase === 'elena_profile' ? (
          <div style={{ flex: 1, background: COLORS_DARK.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '24px' }}>
            <div style={{ background: COLORS_DARK.bgCard, border: `1px solid ${COLORS_DARK.rule}`, padding: '38px 48px', maxWidth: 740, margin: '0 auto', borderRadius: '10px' }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: COLORS_DARK.inkFaint, marginBottom: 8 }}>Patient profile • Case 1 of 2</div>
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
        ) : phase === 'daniel_profile' ? (
          <div style={{ flex: 1, background: COLORS_DARK.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '24px' }}>
            <div style={{ background: COLORS_DARK.bgCard, border: `1px solid ${COLORS_DARK.rule}`, padding: '38px 48px', maxWidth: 740, margin: '0 auto', borderRadius: '10px' }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: COLORS_DARK.inkFaint, marginBottom: 8 }}>Patient profile • Case 2 of 2</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 38, fontWeight: 500, letterSpacing: '-0.015em', color: COLORS_DARK.ink, marginBottom: 4 }}>Daniel Ramirez</div>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 14, color: COLORS_DARK.inkSoft, fontStyle: 'italic', marginBottom: 22 }}>age 24</div>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 15, lineHeight: 1.65, color: COLORS_DARK.ink, marginBottom: 22 }}>
                Daniel lives in Modesto and works as a warehouse logistics coordinator. He is Elena's oldest son—estranged from his parents since coming out three years ago, though still quietly connected through his younger sister Sofia. He has been in a two-year relationship with Marco, an older partner who is HIV-negative and on PrEP. Daniel is not on PrEP, has avoided STI/HIV testing for six months despite rising anxiety, and carries deep unresolved tension between his Catholic upbringing and his relationship.
              </div>
              <div style={{ borderTop: `1px solid ${COLORS_DARK.rule}`, paddingTop: 18, fontFamily: FONT_SANS, fontSize: 13, lineHeight: 1.6, color: COLORS_DARK.inkSoft, fontStyle: 'italic' }}>
                Daniel reaches out late at night—11:42 PM—starting with family guilt before circling toward the medical fear he has been avoiding for months.
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
                  <span style={{ color: '#4DB8B8' }}>{chatIndex + 1} / {conversation.length} Messages</span>
                </div>
                <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                  {conversation.slice(0, chatIndex + 1).map((msg, i) => (
                    <div key={i} className="fade-enter-active" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'bot' ? 'flex-start' : 'flex-end' }}>
                      <div style={{ fontSize: '0.75rem', color: '#9B9285', textTransform: 'uppercase', marginBottom: '4px' }}>{msg.sender === 'bot' ? 'Ally' : (isElena ? 'Elena' : 'Daniel')}</div>
                      <div style={{ background: msg.sender === 'bot' ? 'rgba(77, 184, 184, 0.15)' : 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '12px', border: msg.sender === 'bot' ? '1px solid rgba(77,184,184,0.3)' : 'none', maxWidth: '85%', fontStyle: msg.italic ? 'italic' : 'normal' }}>
                        {formatMessageText(msg.text)}
                        {msg.significance && <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#D4A645', textTransform: 'uppercase', letterSpacing: '0.1em' }}>★ significance moment</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phase.includes('consolidation') && <ConsolidationPanel isElena={isElena} />}

            {phase === 'elena_reasoning' && (
              <div className="fade-enter-active" style={{ padding: '40px', overflowY: 'auto', height: '100%', background: 'rgba(217, 184, 115, 0.05)' }}>
                <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2.5rem', color: '#D9B873', marginBottom: '8px' }}>Adversarial Reasoning Layer</h2>
                <div style={{ marginBottom: '32px', color: '#A8A39A', fontSize: '1rem', lineHeight: 1.6 }}>The Arbiter summons agents to deliberate over the memory graph before generating the clinical handoff.</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '12px', borderLeft: '4px solid #5FAEB0' }}>
                    <div style={{ fontSize: '0.85rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 600 }}>Proposer Agent</div>
                    <div style={{ color: '#EDEAE3', fontSize: '1.1rem', lineHeight: 1.6 }}>Patient shows persistent low mood, lack of energy, and anhedonia. Recommend primary diagnosis of MDD (Major Depressive Disorder) and standard SSRI trial.</div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '12px', borderLeft: '4px solid #E85D5D' }}>
                    <div style={{ fontSize: '0.85rem', color: '#E85D5D', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 600 }}>Skeptic Agent</div>
                    <div style={{ color: '#EDEAE3', fontSize: '1.1rem', lineHeight: 1.6 }}><span style={{ color: '#E85D5D', fontWeight: 600 }}>Dissent:</span> The memory graph shows isolated spikes of rapid speech and impulsive spending ("bought a $400 mixer at 2 AM") three months ago. An SSRI without a mood stabilizer could trigger acute mania if underlying condition is Bipolar-II.</div>
                  </div>

                  <div style={{ background: 'rgba(217,184,115,0.1)', padding: '24px', borderRadius: '12px', borderLeft: '4px solid #D9B873' }}>
                    <div style={{ fontSize: '0.85rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 600 }}>Arbiter Agent</div>
                    <div style={{ color: '#EDEAE3', fontSize: '1.1rem', lineHeight: 1.6 }}><span style={{ color: '#D9B873', fontWeight: 600 }}>Conclusion:</span> MDD diagnosis is plausible but Bipolar-II risk is non-zero.<br/><br/><strong>Action:</strong> Append "Can't-Miss Flag" to clinical handoff. Warn provider to screen for Bipolar-II before prescribing SSRI.</div>
                  </div>
                </div>
              </div>
            )}

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
                  <p style={{ marginBottom: '16px', color: '#C84848', fontWeight: 600 }}>Per-patient keyed logical isolation is enforced. No edges cross. No data leaks.</p>
                  <p>Dr. Patel knows both. She carries that knowledge. The bot respects it.</p>
                </div>
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* Visible Story Navigation Bar & Clickable Progress Strip (M3) */}
      <div
        data-testid="demo-progress-strip"
        style={{
          height: '52px', padding: '0 20px',
          background: '#0A0C10', borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
          zIndex: 15, flexShrink: 0,
        }}
      >
        <button
          data-testid="demo-prev-btn"
          onClick={forcePrev}
          disabled={phaseIdx === 0 && chatIndex === 0}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)',
            color: (phaseIdx === 0 && chatIndex === 0) ? '#4A4540' : '#EDEAE3',
            padding: '7px 14px', borderRadius: '6px',
            cursor: (phaseIdx === 0 && chatIndex === 0) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: "'Work Sans', sans-serif", fontSize: '0.78rem', fontWeight: 600, flexShrink: 0,
          }}
        >
          <StepBack size={14} /> Previous
        </button>

        {/* Clickable 18-Phase Progress Strip */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '880px' }}>
          {PHASES.map((pName, idx) => {
            const active = idx === phaseIdx;
            const completed = idx < phaseIdx;
            return (
              <button
                key={pName}
                data-testid={`phase-pill-${idx}`}
                title={`${idx + 1}. ${PRESENTER_NOTES[pName]?.label || pName}`}
                onClick={() => { setIsPlaying(false); setPhaseIdx(idx); setChatIndex(0); }}
                style={{
                  flex: 1, height: active ? '10px' : '6px', border: 'none', borderRadius: '4px',
                  background: active ? '#D9B873' : completed ? 'rgba(95,174,176,0.65)' : 'rgba(255,255,255,0.12)',
                  cursor: 'pointer', padding: 0, transition: 'all 0.2s',
                }}
              />
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            data-testid="demo-next-btn"
            onClick={forceNext}
            style={{
              background: '#D9B873', border: 'none', color: '#050608',
              padding: '7px 16px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              fontFamily: "'Work Sans', sans-serif", fontSize: '0.78rem', fontWeight: 700,
            }}
          >
            {phase.includes('chat') && chatIndex < conversation.length - 1 ? 'Next Turn' : 'Next'} <StepForward size={14} />
          </button>
          <button
            data-testid="demo-skip-end-btn"
            onClick={skipToEnd}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)',
              color: '#9B9285', padding: '7px 12px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
              fontFamily: "'Work Sans', sans-serif", fontSize: '0.74rem',
            }}
          >
            <SkipForward size={13} /> End
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
