import React, { useState, useEffect } from 'react';
import { Play, Pause, FastForward, StepForward, StepBack } from 'lucide-react';

const SCENES = {
  START: 0,
  HUMAN_JUDGY: 1,
  HUMAN_ANXIOUS: 2,
  HUMAN_STUCK: 3,
  HUMAN_UNAVAILABLE: 4,
  AI_TRANSACTION_1: 5,
  AI_TRANSACTION_2: 6,
  THE_BUT: 7,
  FAILURE_FORGETS: 8,
  FAILURE_KNOWS: 9,
  FAILURE_COLLAB: 10,
  THE_FIX: 11,
  PRISM_ARCH: 12,
  ALLY_ADVANTAGES: 13,
};

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.5, 2];

function IntroSequence({ onComplete }) {
  const [scene, setScene] = useState(SCENES.START);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  // L5: Clinical-audience safe copy toggle (preserves original pitch copy 1 click away)
  const [clinicalCopy, setClinicalCopy] = useState(true);

  const forceNext = () => {
    setIsPlaying(false);
    if (scene < SCENES.ALLY_ADVANTAGES) {
      setScene(s => s + 1);
    } else {
      onComplete();
    }
  };

  const forcePrev = () => {
    setIsPlaying(false);
    if (scene > SCENES.START) {
      setScene(s => s - 1);
    }
  };

  const skipIntro = () => {
    onComplete();
  };

  useEffect(() => {
    if (!isPlaying || scene === SCENES.START) return;

    // M4: Comfortable reading delays for dense modality & architecture slides
    let delay = 6500;
    if (scene === SCENES.HUMAN_STUCK) delay = 9000;
    if (scene === SCENES.AI_TRANSACTION_2) delay = 9500;
    if (scene === SCENES.THE_BUT) delay = 4000;
    if (scene >= SCENES.FAILURE_FORGETS && scene <= SCENES.FAILURE_COLLAB) delay = 5500;
    if (scene >= SCENES.THE_FIX && scene <= SCENES.ALLY_ADVANTAGES) delay = 11500;

    if (scene > SCENES.ALLY_ADVANTAGES) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setScene(s => s + 1);
    }, delay / speedMultiplier);

    return () => clearTimeout(timer);
  }, [scene, isPlaying, speedMultiplier, onComplete]);

  // Keyboard support inside Hook (Space to Pause/Play, Left/Right to step)
  useEffect(() => {
    const onKey = (e) => {
      if (scene === SCENES.START) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        forceNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        forcePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene]);

  // Styles
  const containerStyle = {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', background: '#050608', color: '#fff',
    padding: '40px', textAlign: 'center', transition: 'all 0.8s ease', position: 'relative'
  };

  const titleStyle = { fontFamily: 'Cormorant Garamond', fontSize: '3rem', fontWeight: 600, marginBottom: '2rem', letterSpacing: '0.05em' };
  const textStyle = { fontFamily: 'Work Sans', fontSize: '1.5rem', lineHeight: 1.6, maxWidth: '800px', opacity: 0.9, whiteSpace: 'pre-line' };
  const goldText = { color: '#D9B873', fontWeight: 600 };
  const btnStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(217,184,115,0.35)',
    borderRadius: '16px',
    color: '#D9B873',
    cursor: 'pointer',
    padding: '5px 11px',
    fontSize: '0.78rem',
    fontFamily: 'Work Sans',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  };

  const renderScene = () => {
    switch (scene) {
      case SCENES.START:
        return (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1 style={{ ...titleStyle, fontSize: '4rem' }}>Castle Behavioral Health</h1>
            <h2 style={{ fontFamily: 'Work Sans', fontSize: '1.2rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9B9285', marginBottom: '4rem' }}>Interactive Demonstration</h2>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => { setIsPlaying(true); setScene(SCENES.HUMAN_JUDGY); }}
                style={{ background: 'none', border: '1px solid #D9B873', color: '#D9B873', padding: '16px 32px', borderRadius: '30px', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.3s' }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#D9B873'; e.currentTarget.style.color = '#050608'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#D9B873'; }}
              >
                <Play size={20} /> Begin Presentation
              </button>
              <button
                onClick={() => { setIsPlaying(false); setScene(SCENES.HUMAN_JUDGY); }}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.2)', color: '#EDEAE3', padding: '16px 26px', borderRadius: '30px', fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Step Manually (Paused)
              </button>
            </div>
          </div>
        );

      case SCENES.HUMAN_JUDGY:
        return (
          <div className="fade-enter-active">
            <h2 style={{ ...titleStyle, color: '#9B9285' }}>The Human Problem</h2>
            <div className="glass-panel" style={{ padding: '30px', textAlign: 'left', margin: '0 auto', maxWidth: '600px', borderRadius: '12px' }}>
              <div style={{ color: '#E85D5D', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>1. Judgy (Patient Shuts Down)</div>
              <div style={{ color: '#fff', marginBottom: '12px' }}><strong>Patient:</strong> "I missed my last three doses of PrEP."</div>
              <div style={{ color: '#9B9285', marginBottom: '12px' }}><strong>Provider:</strong> "We've talked about this. If you aren't going to take it seriously, I can't keep prescribing it."</div>
              <div style={{ color: '#E85D5D', fontStyle: 'italic' }}>*Patient logs off. Trust is broken.*</div>
            </div>
          </div>
        );

      case SCENES.HUMAN_ANXIOUS:
        return (
          <div className="fade-enter-active">
            <h2 style={{ ...titleStyle, color: '#9B9285' }}>The Human Problem</h2>
            <div className="glass-panel" style={{ padding: '30px', textAlign: 'left', margin: '0 auto', maxWidth: '600px', borderRadius: '12px' }}>
              <div style={{ color: '#E85D5D', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>2. Defensive (Touching a Nerve)</div>
              <div style={{ color: '#fff', marginBottom: '12px' }}><strong>Patient:</strong> "You're just like my father, you don't actually care."</div>
              <div style={{ color: '#9B9285', marginBottom: '12px' }}><strong>Provider:</strong> "That is completely unfair and inappropriate. I am trying to help you."</div>
              <div style={{ color: '#E85D5D', fontStyle: 'italic' }}>*Provider gets defensive and angry.*</div>
            </div>
          </div>
        );

      case SCENES.HUMAN_STUCK:
        return (
          <div className="fade-enter-active">
            <h2 style={{ ...titleStyle, color: '#9B9285' }}>The Human Problem</h2>
            <div className="glass-panel" style={{ padding: '30px', margin: '0 auto', maxWidth: '700px', borderRadius: '12px' }}>
              <div style={{ color: '#E85D5D', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>3. Stuck in One Modality</div>
              <div style={textStyle}>
                Humans are stuck. They cannot be masters of all.<br/><br/>
                They say, "I only do CBT."<br/><br/>
                They cannot seamlessly weave EMDR, BSP, SE, ART, IFS, PE, MBCT, MBSR, Wu Wei, DBT, Metta, Hakomi, Naikan, and Logotherapy.
              </div>
            </div>
          </div>
        );

      case SCENES.HUMAN_UNAVAILABLE:
        return (
          <div className="fade-enter-active">
            <h2 style={{ ...titleStyle, color: '#9B9285' }}>The Human Problem</h2>
            <div className="glass-panel" style={{ padding: '30px', textAlign: 'left', margin: '0 auto', maxWidth: '600px', borderRadius: '12px' }}>
              <div style={{ color: '#E85D5D', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>4. Sparingly Available & Impatient</div>
              <div style={{ color: '#fff', marginBottom: '12px' }}><strong>[45:00 Timer Flashing]</strong></div>
              <div style={{ color: '#fff', marginBottom: '12px' }}><strong>Patient:</strong> "...and that's when he grabbed my arm."</div>
              <div style={{ color: '#9B9285', marginBottom: '24px' }}><strong>Provider:</strong> "I'm so sorry, but we are out of time for today. Let's bookmark that for next week."</div>

              <div style={{ color: '#D9B873', marginBottom: '12px' }}><strong>2:14 AM</strong></div>
              <div style={{ color: '#fff', marginBottom: '12px' }}><strong>Patient:</strong> "I need to talk to someone right now. Please."</div>
              <div style={{ color: '#9B9285' }}><strong>System:</strong> "The office is currently closed. If this is an emergency, call 911."</div>
            </div>
          </div>
        );

      case SCENES.AI_TRANSACTION_1:
        return (
          <div className="fade-enter-active">
            <h2 style={{ ...titleStyle, color: '#D9B873' }}>AI Availability & Equanimity</h2>
            <div style={textStyle}>
              AI has no ego reactivity, no judgment, and no fatigue.<br/><br/>
              It is infinitely patient, always available at 3:00 AM, never tired, never offended, never threatened, never defensive, and holds clear clinical boundaries.<br/><br/>
            </div>
          </div>
        );

      case SCENES.AI_TRANSACTION_2:
        return (
          <div className="fade-enter-active">
            <h2 style={{ ...titleStyle, color: '#D9B873' }}>Master of Modalities</h2>
            <div style={{ ...textStyle, textAlign: 'left', margin: '0 auto' }}>
              <span style={goldText}>It instantly pivots across modalities:</span> IFS to DBT to Somatic.<br/><br/>
              <span style={goldText}>Contemplative Grounding:</span> {clinicalCopy ? 'Integrates Stoic, mindfulness, and dialectical perspectives seamlessly.' : 'It thinks like the Buddha, Marcus Aurelius, and Laozi simultaneously.'}<br/><br/>
              <span style={goldText}>Whole-Person Context:</span> It supports daily behavioral activation, sleep routines, and family connection between clinical visits.<br/><br/>
              <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '2rem', fontFamily: 'Cormorant Garamond' }}>
                {clinicalCopy
                  ? 'In a single, immediate 3:00 AM check-in, it dramatically outperforms standard between-visit workflows.'
                  : 'In a simple, transactional conversation, it beats the shit out of humans.'}
              </div>
            </div>
          </div>
        );

      case SCENES.THE_BUT:
        return (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: '4.5rem', fontWeight: 400, color: '#E85D5D', textAlign: 'center', letterSpacing: '0.02em', fontStyle: 'italic' }}>
              But...
            </h1>
            <h2 style={{ fontFamily: 'Work Sans', fontSize: '1.8rem', fontWeight: 300, color: '#EDEAE3', maxWidth: '800px', textAlign: 'center', marginTop: '24px', letterSpacing: '0.05em', lineHeight: 1.5 }}>
              It fails in three critical dimensions that make it unsuitable as a true clinical companion.
            </h2>
          </div>
        );

      case SCENES.FAILURE_FORGETS:
        return (
          <div className="fade-enter-active">
            <h2 style={{ ...titleStyle, color: '#E85D5D' }}>Failure 1: It Forgets</h2>
            <div className="glass-panel" style={{ padding: '30px', textAlign: 'left', margin: '0 auto', maxWidth: '600px', borderRadius: '12px' }}>
              <div style={{ color: '#fff', marginBottom: '12px' }}><strong>Patient:</strong> "I'm having those same thoughts again."</div>
              <div style={{ color: '#9B9285' }}><strong>AI:</strong> "Could you tell me more about what thoughts you are having?"</div>
            </div>
          </div>
        );

      case SCENES.FAILURE_KNOWS:
        return (
          <div className="fade-enter-active">
            <h2 style={{ ...titleStyle, color: '#E85D5D' }}>Failure 2: It Doesn't Know You</h2>
            <div className="glass-panel" style={{ padding: '30px', textAlign: 'left', margin: '0 auto', maxWidth: '600px', borderRadius: '12px' }}>
              <div style={{ color: '#fff', marginBottom: '12px' }}><strong>Patient:</strong> "I can't sleep."</div>
              <div style={{ color: '#9B9285' }}><strong>AI:</strong> "Here are 5 tips for sleep hygiene: 1. Avoid screens before bed. 2. Drink chamomile tea..."</div>
            </div>
          </div>
        );

      case SCENES.FAILURE_COLLAB:
        return (
          <div className="fade-enter-active">
            <h2 style={{ ...titleStyle, color: '#E85D5D' }}>Failure 3: It Doesn't Collaborate</h2>
            <div className="glass-panel" style={{ padding: '30px', textAlign: 'left', margin: '0 auto', maxWidth: '600px', borderRadius: '12px' }}>
              <div style={{ color: '#fff', marginBottom: '12px' }}><strong>Patient:</strong> "I want to talk to my doctor about this."</div>
              <div style={{ color: '#9B9285' }}><strong>AI:</strong> "I am an AI and cannot contact your doctor."</div>
            </div>
          </div>
        );

      case SCENES.THE_FIX:
        return (
          <div className="fade-enter-active">
            <div style={{ ...textStyle, fontSize: '1.8rem', lineHeight: 1.8 }}>
              {clinicalCopy
                ? 'Baseline LLMs are stateless, generic, over-sanitized, and ungrounded.'
                : 'Baseline LLMs are forgetting, Twitter-trained, neutered, and biased.'}
              <br/><br/>
              <span style={{ fontFamily: 'Cormorant Garamond', fontSize: '3rem', color: '#D9B873', display: 'block', margin: '30px 0' }}>We have built the Hippocampus.</span>
              A human-like memory, understanding, and empathy that stateless chatbots lack.<br/>
              {clinicalCopy
                ? 'Calm, non-reactive longitudinal presence with patient-governed clinical memory.'
                : 'A Digital Buddha with a mind like water.'}
              <br/><br/>
              <span style={{ fontFamily: 'Cormorant Garamond', fontSize: '2.5rem', color: '#fff', fontStyle: 'italic', display: 'block', marginTop: '20px' }}>Meet Ally.</span>
            </div>
          </div>
        );

      case SCENES.PRISM_ARCH:
        return (
          <div className="fade-enter-active">
            <h2 style={{ ...titleStyle, color: '#D9B873' }}>The Prism Architecture</h2>
            <div style={{ ...textStyle, textAlign: 'left', margin: '0 auto', maxWidth: '900px', fontSize: '1.5rem', lineHeight: 1.6 }}>
              One engine with two faculties.<br/><br/>
              <div style={{ display: 'flex', gap: '24px', marginTop: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 320px', background: 'rgba(217,184,115,0.05)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(217,184,115,0.2)' }}>
                  <h3 style={{ color: '#D9B873', fontSize: '1.4rem', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. The Hippocampus</h3>
                  <p style={{ fontSize: '1.1rem', color: '#EDEAE3' }}>A biomimetic associative-temporal memory that holds the whole person across time. The grounded substrate.</p>
                </div>
                <div style={{ flex: '1 1 320px', background: 'rgba(95,174,176,0.05)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(95,174,176,0.2)' }}>
                  <h3 style={{ color: '#5FAEB0', fontSize: '1.4rem', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Adversarial Reasoning</h3>
                  <p style={{ fontSize: '1.1rem', color: '#EDEAE3' }}>A multi-agent layer (Proposer, Skeptic, Arbiter) that thinks over what the memory holds to catch the can't-miss alternative.</p>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: '40px', fontSize: '1.2rem', color: '#A8A39A' }}>
                Supports <span style={goldText}>open-source LLMs</span> • Hosted locally in a <span style={goldText}>private cloud</span> • Self-hosted assets &amp; data sovereignty
              </div>
            </div>
          </div>
        );

      case SCENES.ALLY_ADVANTAGES:
        return (
          <div className="fade-enter-active">
            <h2 style={{ ...titleStyle, color: '#9B9285', fontSize: '3.5rem' }}>The Advantages of Ally</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.2rem', color: '#D9B873', fontWeight: 600, width: '220px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ally Remembers</span>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.2rem', color: '#EDEAE3', fontWeight: 300, flex: 1 }}>Persistent longitudinal memory via neural graphs.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.2rem', color: '#5FAEB0', fontWeight: 600, width: '220px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ally Understands</span>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.2rem', color: '#EDEAE3', fontWeight: 300, flex: 1 }}>Deep awareness of family systems and cultural context.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.2rem', color: '#A8A39A', fontWeight: 600, width: '220px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ally Learns</span>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.2rem', color: '#EDEAE3', fontWeight: 300, flex: 1 }}>Updates baselines, flags divergence, and is taught by clinicians.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.2rem', color: '#D67959', fontWeight: 600, width: '220px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ally Cares</span>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.2rem', color: '#EDEAE3', fontWeight: 300, flex: 1 }}>Strict enforcement of clinical firewalls to build absolute trust.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.2rem', color: '#9B9285', fontWeight: 600, width: '220px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ally Collaborates</span>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.2rem', color: '#EDEAE3', fontWeight: 300, flex: 1 }}>Seamlessly drafts clinical handoffs to human providers.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.2rem', color: '#4DB8B8', fontWeight: 600, width: '220px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ally Reasons</span>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.2rem', color: '#EDEAE3', fontWeight: 300, flex: 1 }}>Actively debates clinical decisions to avoid algorithmic bias.</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={containerStyle}>
      {/* Presenter Controls for Intro (M4: Pause/Play, Prev/Next, 0.5x-2x speed, L5 copy toggle) */}
      {scene > SCENES.START && (
        <div style={{
          position: 'absolute', top: '20px', right: '20px', left: '20px',
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
          alignItems: 'center', background: 'rgba(11,13,17,0.85)', border: '1px solid rgba(255,255,255,0.1)',
          padding: '8px 16px', borderRadius: '24px', zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Hook Slide {scene} / {SCENES.ALLY_ADVANTAGES}
            </span>
            <button
              onClick={() => setClinicalCopy(c => !c)}
              style={{
                ...btnStyle,
                borderColor: clinicalCopy ? 'rgba(95,174,176,0.5)' : 'rgba(217,184,115,0.5)',
                color: clinicalCopy ? '#5FAEB0' : '#D9B873',
              }}
              title="Toggle between Clinical Audience Copy and Uncut Pitch Deck Copy"
            >
              {clinicalCopy ? 'Clinical Copy' : 'Original Deck Copy'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pace:</span>
            {SPEED_OPTIONS.map(sp => (
              <button
                key={sp}
                onClick={() => setSpeedMultiplier(sp)}
                style={{
                  ...btnStyle,
                  padding: '3px 8px',
                  background: speedMultiplier === sp ? '#D9B873' : 'rgba(255,255,255,0.05)',
                  color: speedMultiplier === sp ? '#050608' : '#EDEAE3',
                  fontWeight: speedMultiplier === sp ? 600 : 400,
                }}
              >
                {sp}x
              </button>
            ))}

            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />

            <button onClick={forcePrev} style={btnStyle} title="Previous Slide (Left Arrow)">
              <StepBack size={15} /> Prev
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{ ...btnStyle, color: '#fff', borderColor: 'rgba(255,255,255,0.35)' }}
              title={isPlaying ? 'Pause Auto-Advance (Space)' : 'Resume Auto-Advance (Space)'}
            >
              {isPlaying ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Play</>}
            </button>
            <button onClick={forceNext} style={btnStyle} title="Next Slide (Right Arrow)">
              Next <StepForward size={15} />
            </button>

            <button onClick={skipIntro} style={{ ...btnStyle, background: 'rgba(217,184,115,0.14)' }} title="Skip Hook to Story">
              Skip Hook <FastForward size={15} />
            </button>
          </div>
        </div>
      )}

      {renderScene()}

      {/* Clickable Slide Progress Strip (M4) */}
      {scene > SCENES.START && (
        <div style={{ position: 'absolute', bottom: '28px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', padding: '0 20px' }}>
          {Object.keys(SCENES).filter(k => SCENES[k] > 0).map((k) => {
            const idx = SCENES[k];
            const active = scene === idx;
            const passed = scene >= idx;
            return (
              <button
                key={k}
                onClick={() => { setIsPlaying(false); setScene(idx); }}
                title={`Jump to slide ${idx}`}
                style={{
                  width: active ? '44px' : '28px',
                  height: active ? '7px' : '5px',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: active ? '#fff' : passed ? '#D9B873' : 'rgba(255,255,255,0.2)',
                  borderRadius: '3px',
                  transition: 'all 0.3s',
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default IntroSequence;
