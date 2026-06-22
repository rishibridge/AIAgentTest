import React from 'react';

function InsightPanel({ title, body, isVisible, presenterMode = false }) {
  if (!isVisible) return null;

  return (
    <div 
      className="insight-glass slide-in"
      style={{
        position: 'absolute',
        top: presenterMode ? '50%' : '20px',
        left: presenterMode ? '50%' : 'auto',
        right: presenterMode ? 'auto' : '20px',
        transform: presenterMode ? 'translate(-50%, -50%)' : 'none',
        width: presenterMode ? 'auto' : '400px',
        padding: presenterMode ? '40px 60px' : '24px',
        borderRadius: '12px',
        zIndex: 100,
        color: '#EDEAE3',
        fontFamily: 'Work Sans, sans-serif',
        textAlign: presenterMode ? 'center' : 'left',
        background: '#050608', 
        border: presenterMode ? '1px solid rgba(217,184,115,0.4)' : '1px solid rgba(217,184,115,0.2)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
      }}
    >
      <div style={{ color: '#D9B873', fontSize: presenterMode ? '1rem' : '0.85rem', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px', fontWeight: 600 }}>
        Insight
      </div>
      <div style={{ fontFamily: 'Cormorant Garamond', fontSize: presenterMode ? '4rem' : '1.6rem', fontWeight: 600, marginBottom: presenterMode ? '0' : '12px', color: '#fff', whiteSpace: presenterMode ? 'nowrap' : 'normal' }}>
        {title}
      </div>
      {!presenterMode && (
        <div style={{ fontSize: '1rem', lineHeight: 1.5, opacity: 0.9 }}>
          {body}
        </div>
      )}
    </div>
  );
}

export default InsightPanel;
