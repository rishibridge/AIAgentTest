#!/usr/bin/env python3
"""Generate style.css and script.js for NatureCure V2."""
import os

BASE = os.path.dirname(__file__)

CSS = r"""/* NatureCure V2 — Design System */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
--bg-primary:#0a0f0d;--bg-secondary:#0f1613;--bg-card:rgba(16,28,22,0.7);--bg-card-hover:rgba(22,40,30,0.8);--bg-glass:rgba(16,28,22,0.45);
--emerald-50:#ecfdf5;--emerald-100:#d1fae5;--emerald-200:#a7f3d0;--emerald-300:#6ee7b7;--emerald-400:#34d399;--emerald-500:#10b981;--emerald-600:#059669;--emerald-700:#047857;
--sage-100:#e2e8df;--sage-200:#c5d1be;--sage-300:#a8b99d;--sage-400:#8ba17c;
--text-primary:#f0fdf4;--text-secondary:#b0c8b4;--text-muted:#7d9480;--text-accent:var(--emerald-400);
--border-subtle:rgba(52,211,153,0.1);--border-medium:rgba(52,211,153,0.2);
--gradient-hero:linear-gradient(135deg,#059669 0%,#10b981 40%,#34d399 100%);--gradient-card:linear-gradient(145deg,rgba(16,28,22,0.8),rgba(10,15,13,0.9));--gradient-text:linear-gradient(135deg,#34d399,#6ee7b7,#a7f3d0);
--shadow-sm:0 2px 8px rgba(0,0,0,0.3);--shadow-md:0 4px 20px rgba(0,0,0,0.4);--shadow-lg:0 8px 40px rgba(0,0,0,0.5);--shadow-glow:0 0 30px rgba(52,211,153,0.15);
--radius-sm:8px;--radius-md:12px;--radius-lg:16px;--radius-xl:24px;--radius-full:9999px;
--transition:0.25s cubic-bezier(0.4,0,0.2,1);
--font:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
}
html{scroll-behavior:smooth}
body{font-family:var(--font);background:var(--bg-primary);color:var(--text-primary);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:var(--text-accent);text-decoration:none;transition:var(--transition)}a:hover{color:var(--emerald-300)}
.container{max-width:1140px;margin:0 auto;padding:0 20px}

/* Skip link */
.skip-link{position:absolute;top:-40px;left:0;background:var(--emerald-600);color:#fff;padding:8px 16px;z-index:200;font-size:0.85rem;border-radius:0 0 var(--radius-sm) 0;transition:top 0.3s}
.skip-link:focus{top:0}

/* Navbar */
.navbar{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(10,15,13,0.85);backdrop-filter:blur(20px);border-bottom:1px solid var(--border-subtle);transition:var(--transition)}
.navbar.scrolled{background:rgba(10,15,13,0.95)}
.nav-container{max-width:1140px;margin:0 auto;padding:0 20px;display:flex;align-items:center;justify-content:space-between;height:64px}
.nav-logo{display:flex;align-items:center;gap:8px;font-weight:700;font-size:1.2rem;color:var(--text-primary)}
.logo-icon{font-size:1.5rem}.nav-links{display:flex;align-items:center;gap:24px}
.nav-links a{color:var(--text-secondary);font-size:0.9rem;font-weight:500}.nav-links a:hover{color:var(--text-primary)}
.mobile-menu-btn{display:none;background:none;border:none;cursor:pointer;flex-direction:column;gap:5px;padding:8px}
.mobile-menu-btn span{display:block;width:22px;height:2px;background:var(--text-primary);border-radius:2px;transition:var(--transition)}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:var(--radius-full);font-family:var(--font);font-size:0.9rem;font-weight:600;border:none;cursor:pointer;transition:var(--transition);text-decoration:none;white-space:nowrap}
.btn-primary{background:var(--gradient-hero);color:#fff;box-shadow:0 4px 15px rgba(5,150,105,0.4)}.btn-primary:hover{transform:translateY(-2px);box-shadow:0 6px 25px rgba(5,150,105,0.5);color:#fff}
.btn-primary:disabled{opacity:0.5;cursor:not-allowed;transform:none}
.btn-ghost{background:transparent;color:var(--text-secondary);border:1px solid var(--border-medium)}.btn-ghost:hover{background:rgba(52,211,153,0.1);color:var(--text-primary)}
.btn-nav{padding:8px 16px;font-size:0.85rem}.btn-lg{padding:14px 28px;font-size:1rem}
.btn-amazon{background:linear-gradient(135deg,#ff9900,#ffad33);color:#111;font-weight:700;box-shadow:0 4px 12px rgba(255,153,0,0.3)}.btn-amazon:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(255,153,0,0.4);color:#111}

/* === AD-STYLE HERO === */
.ad-hero{display:flex;justify-content:center;align-items:center;min-height:100vh;padding:80px 20px 40px;background:#1a1a1a}
.ad-container{width:100%;max-width:800px;aspect-ratio:1/1;position:relative;overflow:hidden;background:#f5efe0;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.4)}
.ad-container::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 20% 80%,rgba(196,151,59,0.08) 0%,transparent 50%),radial-gradient(ellipse at 80% 20%,rgba(90,124,79,0.06) 0%,transparent 50%);pointer-events:none;z-index:1}
.border-frame{position:absolute;inset:24px;border:1.5px solid #4a6741;opacity:0.4;z-index:3;pointer-events:none}
.border-frame-inner{position:absolute;inset:32px;border:0.5px solid #4a6741;opacity:0.25;z-index:3;pointer-events:none}
.corner-botanical{position:absolute;z-index:4;color:#4a6741;opacity:0.15;font-size:100px;line-height:1}
.corner-botanical.tl{top:40px;left:44px}.corner-botanical.tr{top:40px;right:44px;transform:rotate(90deg)}.corner-botanical.bl{bottom:40px;left:44px;transform:rotate(-90deg)}.corner-botanical.br{bottom:40px;right:44px;transform:rotate(180deg)}
.leaf-svg{position:absolute;z-index:4;opacity:0.12}.leaf-left{left:-40px;top:50%;transform:translateY(-50%) rotate(-10deg);width:200px;height:400px}.leaf-right{right:-40px;top:50%;transform:translateY(-50%) rotate(10deg) scaleX(-1);width:200px;height:400px}
.ad-content{position:relative;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px 60px;text-align:center}
.top-ornament{margin-bottom:16px;color:#c4973b;font-size:24px;letter-spacing:12px;opacity:0.7}
.brand-mark{font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;font-weight:400;letter-spacing:8px;text-transform:uppercase;color:#4a6741;margin-bottom:36px;opacity:0.7}
.icon-area{margin-bottom:8px}.icon-area svg{width:48px;height:48px;opacity:0.2}
.tagline-main{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(48px,8vw,72px);font-weight:700;line-height:1.05;color:#2a1f14;margin-bottom:12px;letter-spacing:-1px}
.tagline-your{display:block;font-size:clamp(36px,5vw,48px);font-weight:400;font-style:italic;color:#4a6741;letter-spacing:2px;margin-bottom:4px}
.tagline-body{color:#3d2b1f}.tagline-call{color:#c4973b}
.divider{display:flex;align-items:center;gap:16px;margin:32px 0;width:60%}.divider-line{flex:1;height:1px;background:linear-gradient(to right,transparent,#c4973b,transparent)}.divider-leaf{color:#c4973b;font-size:20px;opacity:0.8}
.tagline-sub{font-family:'Lora',Georgia,serif;font-size:clamp(18px,3vw,24px);line-height:1.6;color:#3d2b1f;font-weight:400;max-width:600px;letter-spacing:0.3px}
.tagline-sub em{font-style:italic;color:#4a6741}.tagline-sub strong{font-weight:500;color:#2a1f14}
.pharma-strike{color:#8b5e3c;opacity:0.7;position:relative}.pharma-strike::after{content:'';position:absolute;left:-2px;right:-2px;top:55%;height:2px;background:#c4973b;opacity:0.6;transform:rotate(-1deg)}
.cta-area{margin-top:40px;display:flex;flex-direction:column;align-items:center;gap:12px}
.cta-button{font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#f5efe0;background:#1a3a2a;border:none;padding:16px 48px;cursor:pointer;position:relative;transition:all 0.3s ease;text-decoration:none;display:inline-block}
.cta-button::before{content:'';position:absolute;inset:-3px;border:1px solid #c4973b;opacity:0.5}.cta-button:hover{background:#4a6741;color:#f5efe0}
.cta-url{font-family:'Lora',Georgia,serif;font-size:13px;color:#4a6741;letter-spacing:2px;opacity:0.6}
.bottom-strip{position:absolute;bottom:36px;left:0;right:0;display:flex;justify-content:center;gap:28px;z-index:5;flex-wrap:wrap}
.bottom-item{display:flex;align-items:center;gap:8px;font-family:'Lora',Georgia,serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#4a6741;opacity:0.5}
.bottom-dot{width:4px;height:4px;border-radius:50%;background:#c4973b;opacity:0.6}

/* Sections */
.section{padding:100px 0}.section-alt{background:var(--bg-secondary)}
.section-header{text-align:center;margin-bottom:56px}
.section-badge{display:inline-block;padding:4px 14px;background:rgba(52,211,153,0.1);border:1px solid var(--border-subtle);border-radius:var(--radius-full);font-size:0.8rem;color:var(--emerald-400);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:16px}
.section-header h2{font-size:clamp(1.8rem,3vw,2.5rem);font-weight:700;margin-bottom:12px}.section-header p{color:var(--text-secondary);font-size:1.05rem}

/* Steps */
.steps-grid{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}
.step-card{flex:1;min-width:220px;max-width:300px;padding:36px 28px;text-align:center;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);transition:var(--transition);backdrop-filter:blur(10px)}
.step-card:hover{transform:translateY(-4px);border-color:var(--border-medium);box-shadow:var(--shadow-glow)}
.step-number{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:rgba(52,211,153,0.15);color:var(--emerald-400);font-size:0.85rem;font-weight:700;margin-bottom:16px}
.step-icon{font-size:2.2rem;margin-bottom:16px}.step-card h3{font-size:1.15rem;font-weight:700;margin-bottom:8px}.step-card p{color:var(--text-secondary);font-size:0.9rem;line-height:1.6}
.step-connector{display:flex;align-items:center;color:var(--text-muted);flex-shrink:0}

/* Categories */
.categories-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.category-card{display:flex;align-items:center;gap:12px;padding:18px 20px;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-md);font-size:0.95rem;font-weight:500;transition:var(--transition);cursor:default;position:relative}
.category-card:hover{border-color:var(--border-medium);transform:translateY(-2px);box-shadow:var(--shadow-glow)}
.cat-icon{font-size:1.4rem}
.badge-new{position:absolute;top:8px;right:8px;padding:2px 8px;background:rgba(52,211,153,0.2);border:1px solid var(--emerald-500);border-radius:var(--radius-full);font-size:0.6rem;font-weight:700;color:var(--emerald-400);text-transform:uppercase;letter-spacing:0.05em}
.new-badge{border-color:rgba(52,211,153,0.3)}

/* Disclaimer */
.disclaimer-card{text-align:center;padding:48px;background:var(--bg-card);border:1px solid rgba(251,191,36,0.2);border-radius:var(--radius-lg);max-width:700px;margin:0 auto}
.disclaimer-icon{font-size:2.5rem;margin-bottom:16px}.disclaimer-card h3{font-size:1.3rem;margin-bottom:12px;color:#fbbf24}
.disclaimer-card p{color:var(--text-secondary);line-height:1.7;font-size:0.95rem}

/* Footer */
.footer{padding:32px 0;border-top:1px solid var(--border-subtle)}
.footer-content{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
.footer-brand{display:flex;align-items:center;gap:8px;font-weight:700}.footer-text{color:var(--text-muted);font-size:0.85rem}

/* === QUESTIONNAIRE === */
.questionnaire-page{padding:100px 0 60px;min-height:100vh}
.progress-bar-container{margin-bottom:40px}
.progress-steps{display:flex;align-items:center;justify-content:center;gap:0}
.progress-step{display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0}
.progress-step span{font-size:0.75rem;color:var(--text-muted);font-weight:500}
.progress-step.active span{color:var(--emerald-400)}.progress-step.completed span{color:var(--emerald-400)}
.step-dot{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--bg-card);border:2px solid var(--border-medium);font-size:0.85rem;font-weight:700;color:var(--text-muted);transition:var(--transition)}
.progress-step.active .step-dot{background:var(--emerald-600);border-color:var(--emerald-400);color:#fff;box-shadow:0 0 15px rgba(52,211,153,0.3)}
.progress-step.completed .step-dot{background:var(--emerald-700);border-color:var(--emerald-500);color:#fff}
.progress-line{width:80px;height:2px;background:var(--border-subtle);margin:0 8px;margin-bottom:22px;position:relative;overflow:hidden}
.progress-line-fill{position:absolute;inset:0;background:var(--emerald-500);transform:scaleX(0);transform-origin:left;transition:transform 0.5s ease}.progress-line-fill.filled{transform:scaleX(1)}

.form-step{display:none}.form-step.active{display:block;animation:fadeInUp 0.4s ease}
@keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.form-card{max-width:680px;margin:0 auto;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-xl);padding:40px;backdrop-filter:blur(10px)}
.form-header{margin-bottom:32px}.form-header h1{font-size:1.6rem;font-weight:700;margin-bottom:8px}.form-header p{color:var(--text-secondary);font-size:0.95rem}

.symptom-input-area{position:relative;margin-bottom:8px}
.chips-container{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px;min-height:52px;background:rgba(10,15,13,0.6);border:1px solid var(--border-medium);border-radius:var(--radius-md);cursor:text;transition:var(--transition)}
.chips-container:focus-within{border-color:var(--emerald-500);box-shadow:0 0 0 3px rgba(16,185,129,0.15)}
.chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(52,211,153,0.15);border:1px solid var(--border-medium);border-radius:var(--radius-full);font-size:0.85rem;color:var(--emerald-300);font-weight:500;animation:chipIn 0.2s ease}
@keyframes chipIn{from{transform:scale(0.8);opacity:0}to{transform:scale(1);opacity:1}}
.chip-remove{background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem;padding:0;line-height:1;transition:var(--transition)}.chip-remove:hover{color:#f87171}
.chip-input{flex:1;min-width:200px;background:none;border:none;outline:none;color:var(--text-primary);font-family:var(--font);font-size:0.95rem}.chip-input::placeholder{color:var(--text-muted)}

.autocomplete-dropdown{display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-secondary);border:1px solid var(--border-medium);border-radius:var(--radius-md);max-height:200px;overflow-y:auto;z-index:50;margin-top:4px;box-shadow:var(--shadow-lg)}
.autocomplete-dropdown.show{display:block}
.autocomplete-item{padding:10px 16px;cursor:pointer;font-size:0.9rem;color:var(--text-secondary);transition:var(--transition)}
.autocomplete-item:hover,.autocomplete-item.highlighted{background:rgba(52,211,153,0.1);color:var(--text-primary)}
.autocomplete-item mark{background:none;color:var(--emerald-400);font-weight:600}

.validation-msg{font-size:0.8rem;color:var(--text-muted);margin-bottom:16px;min-height:20px;transition:var(--transition)}
.validation-msg.hidden{opacity:0}

.popular-symptoms{margin-bottom:28px}.popular-label{font-size:0.8rem;color:var(--text-muted);margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em}
.popular-chips{display:flex;flex-wrap:wrap;gap:8px}
.popular-chip{padding:6px 14px;background:rgba(52,211,153,0.06);border:1px solid var(--border-subtle);border-radius:var(--radius-full);color:var(--text-secondary);font-family:var(--font);font-size:0.82rem;font-weight:500;cursor:pointer;transition:var(--transition)}
.popular-chip:hover{background:rgba(52,211,153,0.15);border-color:var(--border-medium);color:var(--emerald-300)}
.popular-chip:focus{outline:2px solid var(--emerald-400);outline-offset:2px}
.popular-chip.added{background:rgba(52,211,153,0.2);border-color:var(--emerald-500);color:var(--emerald-300);pointer-events:none;opacity:0.6}

.question-block{margin-bottom:28px}.question-label{display:block;font-size:1rem;font-weight:600;margin-bottom:12px}
.safety-badge{display:inline-block;padding:2px 8px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.3);border-radius:var(--radius-full);font-size:0.65rem;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:0.04em;vertical-align:middle;margin-left:8px}
.options-grid{display:flex;flex-direction:column;gap:8px}
.option-btn{text-align:left;padding:14px 18px;background:rgba(10,15,13,0.5);border:1px solid var(--border-subtle);border-radius:var(--radius-md);color:var(--text-secondary);font-family:var(--font);font-size:0.9rem;cursor:pointer;transition:var(--transition)}
.option-btn:hover{border-color:var(--border-medium);background:rgba(52,211,153,0.06);color:var(--text-primary)}
.option-btn:focus{outline:2px solid var(--emerald-400);outline-offset:2px}
.option-btn.selected{background:rgba(52,211,153,0.12);border-color:var(--emerald-500);color:var(--emerald-300);font-weight:500}
.form-actions{display:flex;justify-content:space-between;align-items:center;margin-top:32px;gap:16px}

.loading-card{text-align:center;padding:80px 40px;max-width:500px;margin:0 auto}
.loading-spinner{width:48px;height:48px;margin:0 auto 24px;border:3px solid var(--border-subtle);border-top-color:var(--emerald-500);border-radius:50%;animation:spin 0.8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}.loading-card h2{font-size:1.4rem;margin-bottom:8px}.loading-card p{color:var(--text-secondary)}

/* === RESULTS === */
.results-page{padding:100px 0 40px;min-height:100vh}
.results-header{text-align:center;margin-bottom:24px}
.results-header h1{font-size:clamp(1.6rem,3vw,2.2rem);font-weight:700;margin-bottom:8px}.results-header p{color:var(--text-secondary)}
.symptom-tags{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:16px}
.symptom-tag{padding:4px 12px;background:rgba(52,211,153,0.12);border:1px solid var(--border-medium);border-radius:var(--radius-full);font-size:0.82rem;color:var(--emerald-300);font-weight:500}

.evidence-guide{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 20px;margin-bottom:12px;background:rgba(52,211,153,0.04);border:1px solid var(--border-subtle);border-radius:var(--radius-md);font-size:0.78rem;color:var(--text-muted)}
.evidence-guide-label{font-weight:700;color:var(--text-secondary);margin-right:4px}
.ev-badge{padding:2px 8px;border-radius:var(--radius-full);font-weight:600;font-size:0.72rem;margin-left:8px}
.ev-strong{background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3)}
.ev-moderate{background:rgba(234,179,8,0.15);color:#eab308;border:1px solid rgba(234,179,8,0.3)}
.ev-traditional{background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.25)}

.results-disclaimer{display:flex;align-items:center;gap:12px;padding:14px 20px;margin-bottom:28px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.2);border-radius:var(--radius-md);font-size:0.85rem;color:var(--text-secondary);line-height:1.5}
.disclaimer-badge{flex-shrink:0;padding:3px 10px;background:rgba(251,191,36,0.15);border-radius:var(--radius-full);font-size:0.75rem;font-weight:700;color:#fbbf24}

.category-tabs{display:flex;gap:4px;margin-bottom:28px;padding:4px;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-full);overflow-x:auto}
.tab-btn{flex:1;padding:10px 18px;background:none;border:none;border-radius:var(--radius-full);color:var(--text-muted);font-family:var(--font);font-size:0.85rem;font-weight:600;cursor:pointer;transition:var(--transition);white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:8px}
.tab-btn:hover{color:var(--text-secondary)}.tab-btn.active{background:rgba(52,211,153,0.15);color:var(--emerald-300)}
.tab-count{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;background:rgba(52,211,153,0.1);border-radius:var(--radius-full);font-size:0.75rem;padding:0 6px}
.tab-btn.active .tab-count{background:rgba(52,211,153,0.25)}

.results-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-bottom:40px}

/* Skeleton */
.skeleton-grid{display:none}
.skeleton-grid.show{display:grid}
.skeleton-card{background:var(--gradient-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:24px}
.sk-line{height:14px;background:rgba(52,211,153,0.08);border-radius:4px;margin-bottom:12px;animation:pulse 1.5s ease-in-out infinite}
.sk-title{height:20px;width:60%}.sk-text{width:90%}.sk-text.short{width:50%}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}

/* Remedy Card */
.remedy-card{background:var(--gradient-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:24px;transition:var(--transition);display:flex;flex-direction:column;animation:fadeInUp 0.4s ease}
.remedy-card:hover{border-color:var(--border-medium);transform:translateY(-3px);box-shadow:var(--shadow-glow)}
.remedy-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px}
.remedy-name{font-size:1.1rem;font-weight:700;line-height:1.3}
.remedy-badges{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}
.remedy-type-badge{padding:3px 10px;border-radius:var(--radius-full);font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em}
.badge-ayurvedic{background:rgba(251,146,60,0.15);color:#fb923c;border:1px solid rgba(251,146,60,0.3)}
.badge-herbal{background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.3)}
.badge-supplement{background:rgba(96,165,250,0.15);color:#60a5fa;border:1px solid rgba(96,165,250,0.3)}

.evidence-badge{padding:3px 10px;border-radius:var(--radius-full);font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em}

.remedy-desc{color:var(--text-secondary);font-size:0.88rem;line-height:1.6;margin-bottom:16px}
.remedy-matched{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
.matched-badge{padding:2px 10px;background:rgba(52,211,153,0.1);border-radius:var(--radius-full);font-size:0.72rem;color:var(--emerald-400);font-weight:600}
.remedy-section-title{font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:8px}
.remedy-benefits{list-style:none;margin-bottom:16px;padding:0}
.remedy-benefits li{position:relative;padding-left:18px;font-size:0.85rem;color:var(--text-secondary);margin-bottom:4px}
.remedy-benefits li::before{content:'✓';position:absolute;left:0;color:var(--emerald-400);font-weight:700;font-size:0.8rem}
.remedy-dosage{padding:10px 14px;margin-bottom:12px;background:rgba(52,211,153,0.05);border-radius:var(--radius-sm);font-size:0.83rem;color:var(--sage-300);border-left:3px solid var(--emerald-600)}
.remedy-cautions{margin-bottom:16px}
.caution-item{font-size:0.8rem;color:#fbbf24;opacity:0.8;padding-left:16px;position:relative;margin-bottom:4px}
.caution-item::before{content:'⚠';position:absolute;left:0;font-size:0.7rem}
.interaction-warning{padding:8px 12px;margin-bottom:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-sm);font-size:0.8rem;color:#f87171}

/* References */
.remedy-refs{margin-bottom:12px}
.refs-toggle{background:none;border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:6px 12px;color:var(--text-muted);font-family:var(--font);font-size:0.75rem;cursor:pointer;transition:var(--transition);display:flex;align-items:center;gap:6px;width:100%}
.refs-toggle:hover{background:rgba(52,211,153,0.05);color:var(--text-secondary)}
.refs-toggle .arrow{transition:transform 0.2s;font-size:0.7rem}
.refs-toggle.open .arrow{transform:rotate(90deg)}
.refs-list{display:none;padding:8px 12px;margin-top:6px;background:rgba(10,15,13,0.4);border-radius:var(--radius-sm);font-size:0.75rem}
.refs-list.show{display:block}
.ref-item{margin-bottom:6px;color:var(--text-muted);line-height:1.4}
.ref-item a{color:var(--emerald-400);font-size:0.72rem}

.remedy-footer{margin-top:auto;padding-top:16px;border-top:1px solid var(--border-subtle)}

/* Empty / Results Footer */
.empty-state{text-align:center;padding:60px 20px}.empty-icon{font-size:3rem;margin-bottom:16px}.empty-state h2{font-size:1.3rem;margin-bottom:8px}.empty-state p{color:var(--text-secondary);margin-bottom:24px}
.results-footer{text-align:center;margin-bottom:40px}

/* Scrollbar */
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--bg-primary)}::-webkit-scrollbar-thumb{background:var(--border-medium);border-radius:3px}

/* Responsive */
@media(max-width:768px){
.nav-links{display:none}.mobile-menu-btn{display:flex}
.nav-links.open{display:flex;flex-direction:column;position:absolute;top:64px;left:0;right:0;background:rgba(10,15,13,0.97);padding:20px;gap:16px;border-bottom:1px solid var(--border-subtle)}
.ad-hero{padding:80px 12px 20px}.ad-container{aspect-ratio:auto;min-height:600px}
.ad-content{padding:40px 24px}.tagline-main{font-size:42px}.tagline-your{font-size:28px}
.corner-botanical{font-size:60px}.bottom-strip{gap:12px;padding:0 12px}
.steps-grid{flex-direction:column}.step-connector{transform:rotate(90deg)}
.categories-grid{grid-template-columns:repeat(2,1fr)}
.form-card{padding:24px}.form-actions{flex-direction:column-reverse}.form-actions .btn{width:100%;justify-content:center}
.progress-line{width:40px}.results-grid{grid-template-columns:1fr}
.category-tabs{gap:2px}.tab-btn{padding:8px 12px;font-size:0.78rem}
.results-disclaimer{flex-direction:column;text-align:center}
.evidence-guide{flex-direction:column;align-items:flex-start;gap:4px}
}
@media(max-width:480px){
.categories-grid{grid-template-columns:1fr}
.ad-content{padding:30px 16px}.tagline-main{font-size:32px}.tagline-your{font-size:22px}
.divider{width:80%}.bottom-strip{flex-direction:column;align-items:center;gap:6px}
}
"""

JS = r"""/**
 * NatureCure V2 — Frontend JavaScript
 */
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initMobileMenu();
    if (document.getElementById('symptom-input')) initQuestionnaire();
    if (document.getElementById('results-grid')) initResults();
});

function initNavbar() {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 40));
}

function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const links = btn.closest('.nav-container').querySelector('.nav-links');
        links.classList.toggle('open');
    });
    // Auto-close on link click
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            const links = document.querySelector('.nav-links');
            if (links) links.classList.remove('open');
        });
    });
}

function initQuestionnaire() {
    const state = { symptoms: [], answers: {}, currentStep: 1 };
    const allSymptoms = window.ALL_SYMPTOMS || [];
    const input = document.getElementById('symptom-input');
    const chipsContainer = document.getElementById('chips-container');
    const dropdown = document.getElementById('autocomplete-dropdown');
    const nextBtn = document.getElementById('btn-next-step');
    const getResultsBtn = document.getElementById('btn-get-results');
    const backBtn = document.getElementById('btn-back-step-1');
    const validationMsg = document.getElementById('validation-msg');
    let highlightedIdx = -1;

    chipsContainer.addEventListener('click', () => input.focus());

    // Autocomplete
    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        highlightedIdx = -1;
        if (val.length < 2) { dropdown.classList.remove('show'); return; }
        const matches = allSymptoms.filter(s => s.includes(val) && !state.symptoms.includes(s)).slice(0, 8);
        if (matches.length === 0) { dropdown.classList.remove('show'); return; }
        dropdown.innerHTML = matches.map((s, i) => {
            const hl = s.replace(new RegExp(`(${escapeRegex(val)})`, 'gi'), '<mark>$1</mark>');
            return `<div class="autocomplete-item" data-index="${i}" data-value="${s}">${hl}</div>`;
        }).join('');
        dropdown.classList.add('show');
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => { addSymptom(item.dataset.value); input.value = ''; dropdown.classList.remove('show'); input.focus(); });
        });
    });

    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        if (e.key === 'ArrowDown') { e.preventDefault(); highlightedIdx = Math.min(highlightedIdx + 1, items.length - 1); updateHighlight(items); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); highlightedIdx = Math.max(highlightedIdx - 1, 0); updateHighlight(items); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIdx >= 0 && items[highlightedIdx]) { addSymptom(items[highlightedIdx].dataset.value); }
            else if (input.value.trim().length >= 2) { addSymptom(input.value.trim().toLowerCase()); }
            input.value = ''; dropdown.classList.remove('show');
        } else if (e.key === 'Backspace' && input.value === '' && state.symptoms.length > 0) {
            removeSymptom(state.symptoms[state.symptoms.length - 1]);
        }
    });

    function updateHighlight(items) { items.forEach((item, i) => item.classList.toggle('highlighted', i === highlightedIdx)); }
    document.addEventListener('click', (e) => { if (!e.target.closest('.symptom-input-area')) dropdown.classList.remove('show'); });

    function addSymptom(s) {
        s = s.trim().toLowerCase();
        if (!s || state.symptoms.includes(s)) return;
        state.symptoms.push(s);
        renderChips(); updatePopularChips(); updateNextBtn();
    }
    function removeSymptom(s) {
        state.symptoms = state.symptoms.filter(x => x !== s);
        renderChips(); updatePopularChips(); updateNextBtn();
    }
    function renderChips() {
        chipsContainer.querySelectorAll('.chip').forEach(c => c.remove());
        state.symptoms.forEach(s => {
            const chip = document.createElement('div');
            chip.className = 'chip'; chip.setAttribute('role', 'option');
            chip.innerHTML = `${escapeHtml(s)} <button class="chip-remove" data-symptom="${escapeHtml(s)}" aria-label="Remove ${escapeHtml(s)}">×</button>`;
            chipsContainer.insertBefore(chip, input);
        });
        chipsContainer.querySelectorAll('.chip-remove').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); removeSymptom(btn.dataset.symptom); });
        });
    }
    function updateNextBtn() {
        const hasSymptoms = state.symptoms.length > 0;
        nextBtn.disabled = !hasSymptoms;
        if (validationMsg) validationMsg.classList.toggle('hidden', hasSymptoms);
    }

    document.querySelectorAll('.popular-chip').forEach(chip => {
        chip.addEventListener('click', () => addSymptom(chip.dataset.symptom));
    });
    function updatePopularChips() {
        document.querySelectorAll('.popular-chip').forEach(chip => {
            chip.classList.toggle('added', state.symptoms.includes(chip.dataset.symptom));
        });
    }

    nextBtn.addEventListener('click', () => goToStep(2));
    if (backBtn) backBtn.addEventListener('click', () => goToStep(1));

    function goToStep(step) {
        state.currentStep = step;
        document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
        document.getElementById(`step-${step}`).classList.add('active');
        document.querySelectorAll('.progress-step').forEach(ps => {
            const s = parseInt(ps.dataset.step);
            ps.classList.toggle('active', s === step);
            ps.classList.toggle('completed', s < step);
        });
        const l1 = document.getElementById('progress-line-1'), l2 = document.getElementById('progress-line-2');
        if (l1) l1.classList.toggle('filled', step >= 2);
        if (l2) l2.classList.toggle('filled', step >= 3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Focus management for a11y
        const heading = document.querySelector(`#step-${step} h1`);
        if (heading) setTimeout(() => heading.focus(), 400);
    }

    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.options-grid').querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.answers[btn.dataset.question] = btn.dataset.value;
        });
    });

    if (getResultsBtn) {
        getResultsBtn.addEventListener('click', async () => {
            document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
            document.getElementById('step-loading').classList.add('active');
            document.querySelectorAll('.progress-step').forEach(ps => { ps.classList.add('completed'); ps.classList.remove('active'); });
            const l1 = document.getElementById('progress-line-1'), l2 = document.getElementById('progress-line-2');
            if (l1) l1.classList.add('filled'); if (l2) l2.classList.add('filled');
            try {
                const resp = await fetch('/api/analyze', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symptoms: state.symptoms, answers: state.answers }),
                });
                const data = await resp.json();
                sessionStorage.setItem('nc_results', JSON.stringify(data));
                sessionStorage.setItem('nc_symptoms', JSON.stringify(state.symptoms));
                if (data.share_id) {
                    window.location.href = '/results/' + data.share_id;
                } else {
                    window.location.href = '/results';
                }
            } catch (err) {
                const errEl = document.createElement('div');
                errEl.className = 'interaction-warning';
                errEl.style.marginTop = '20px';
                errEl.innerHTML = '⚠️ Something went wrong. <button class="btn btn-ghost" onclick="location.reload()" style="margin-left:8px">Try Again</button>';
                document.getElementById('step-loading').appendChild(errEl);
            }
        });
    }
}

function initResults() {
    const skeletonGrid = document.getElementById('skeleton-grid');
    if (skeletonGrid) skeletonGrid.classList.add('show');

    // Check for shared results
    const shareId = window.SHARE_ID;
    if (shareId) {
        fetch('/api/shared/' + shareId)
            .then(r => r.json())
            .then(data => {
                if (data.error) { window.location.href = '/questionnaire'; return; }
                sessionStorage.setItem('nc_results', JSON.stringify(data));
                sessionStorage.setItem('nc_symptoms', JSON.stringify(data.symptoms || []));
                renderResultsData();
            })
            .catch(() => renderResultsData());
    } else {
        setTimeout(() => renderResultsData(), 300);
    }
}

function renderResultsData() {
    const stored = sessionStorage.getItem('nc_results');
    const symptoms = JSON.parse(sessionStorage.getItem('nc_symptoms') || '[]');
    const skeletonGrid = document.getElementById('skeleton-grid');

    if (!stored) { window.location.href = '/questionnaire'; return; }

    const data = JSON.parse(stored);
    const { results, total } = data;
    const allRemedies = [...(results.ayurvedic||[]),...(results.herbal||[]),...(results.supplement||[])];

    document.getElementById('results-subtitle').textContent =
        `We found ${total} natural remedies for your ${symptoms.length} symptom${symptoms.length !== 1 ? 's' : ''}`;
    document.getElementById('symptom-tags').innerHTML = symptoms.map(s => `<span class="symptom-tag">${escapeHtml(s)}</span>`).join('');
    document.getElementById('count-all').textContent = allRemedies.length;
    document.getElementById('count-ayurvedic').textContent = (results.ayurvedic||[]).length;
    document.getElementById('count-herbal').textContent = (results.herbal||[]).length;
    document.getElementById('count-supplement').textContent = (results.supplement||[]).length;

    if (skeletonGrid) skeletonGrid.classList.remove('show');
    renderRemedies(allRemedies);

    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const cat = tab.dataset.category;
            renderRemedies(cat === 'all' ? allRemedies : (results[cat] || []));
        });
    });

    if (allRemedies.length === 0) {
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('category-tabs').style.display = 'none';
    }
}

function renderRemedies(remedies) {
    const grid = document.getElementById('results-grid');
    const empty = document.getElementById('empty-state');
    if (remedies.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    grid.innerHTML = remedies.map((r, i) => {
        const badgeClass = `badge-${r.category}`;
        const catLabel = r.category.charAt(0).toUpperCase() + r.category.slice(1);

        // Evidence badge
        const evMap = { strong: ['ev-strong', '🟢 Strong Evidence'], moderate: ['ev-moderate', '🟡 Moderate Evidence'], traditional: ['ev-traditional', '🔴 Traditional Use'] };
        const [evClass, evLabel] = evMap[r.evidence_level] || evMap.traditional;

        const matchedHtml = (r.matched_symptoms||[]).map(s => `<span class="matched-badge">✓ ${escapeHtml(s)}</span>`).join('');
        const benefitsHtml = (r.benefits||[]).map(b => `<li>${escapeHtml(b)}</li>`).join('');
        const cautionsHtml = (r.cautions||[]).map(c => `<div class="caution-item">${escapeHtml(c)}</div>`).join('');

        // Interaction warnings
        let warningHtml = '';
        if (r._interaction_warnings && r._interaction_warnings.length > 0) {
            warningHtml = r._interaction_warnings.map(w => `<div class="interaction-warning">⚠️ ${escapeHtml(w)}</div>`).join('');
        }

        // References
        let refsHtml = '';
        if (r.references && r.references.length > 0) {
            const refItems = r.references.map(ref => {
                const [title, url, year] = ref;
                return `<div class="ref-item">📄 ${escapeHtml(title)} (${year}) <a href="${escapeHtml(url)}" target="_blank" rel="noopener">PubMed →</a></div>`;
            }).join('');
            refsHtml = `<div class="remedy-refs">
                <button class="refs-toggle" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('show')"><span class="arrow">▶</span> ${r.references.length} Research Reference${r.references.length>1?'s':''}</button>
                <div class="refs-list">${refItems}</div>
            </div>`;
        }

        return `
        <div class="remedy-card" style="animation-delay:${i*0.05}s">
            <div class="remedy-header">
                <div class="remedy-name">${escapeHtml(r.name)}</div>
                <div class="remedy-badges">
                    <span class="evidence-badge ${evClass}">${evLabel}</span>
                    <span class="remedy-type-badge ${badgeClass}">${catLabel}</span>
                </div>
            </div>
            <div class="remedy-desc">${escapeHtml(r.description)}</div>
            ${matchedHtml ? `<div class="remedy-section-title">Matched Symptoms</div><div class="remedy-matched">${matchedHtml}</div>` : ''}
            <div class="remedy-section-title">Benefits</div><ul class="remedy-benefits">${benefitsHtml}</ul>
            <div class="remedy-section-title">Suggested Dosage</div><div class="remedy-dosage">${escapeHtml(r.dosage||'')}</div>
            ${warningHtml}
            ${cautionsHtml ? `<div class="remedy-section-title">Cautions</div><div class="remedy-cautions">${cautionsHtml}</div>` : ''}
            ${refsHtml}
            <div class="remedy-footer">
                <a href="${escapeHtml(r.amazon_url||'#')}" target="_blank" rel="noopener noreferrer" class="btn btn-amazon">🛒 View on Amazon</a>
            </div>
        </div>`;
    }).join('');
}

function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
"""

with open(os.path.join(BASE, "static", "style.css"), "w", encoding="utf-8") as f:
    f.write(CSS)
with open(os.path.join(BASE, "static", "script.js"), "w", encoding="utf-8") as f:
    f.write(JS)
print("Generated style.css and script.js")
