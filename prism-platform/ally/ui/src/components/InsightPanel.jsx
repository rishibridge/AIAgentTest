import React from 'react';

function InsightPanel({ title, body, isVisible, presenterMode = false }) {
  if (!isVisible) return null;

  return (
    <div 
      className="insight-glass slide-in"
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        width: presenterMode ? '480px' : '400px',
        padding: '24px',
        borderRadius: '12px',
        zIndex: 100,
        color: '#EDEAE3',
        fontFamily: 'Work Sans, sans-serif',
        textAlign: 'left',
        background: '#050608', 
        border: '1px solid rgba(217,184,115,0.3)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
      }}
    >
      <div style={{ color: '#D9B873', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px', fontWeight: 600 }}>
        Insight
      </div>
      <div style={{ fontFamily: 'Cormorant Garamond', fontSize: presenterMode ? '2rem' : '1.6rem', fontWeight: 600, marginBottom: '12px', color: '#fff' }}>
        {title}
      </div>
      <div style={{ fontSize: '1rem', lineHeight: 1.6, opacity: 0.9 }}>
        {body}
      </div>
    </div>
  );
}

export default InsightPanel;
