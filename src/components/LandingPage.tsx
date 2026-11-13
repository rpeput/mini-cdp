import { ChevronRight, Layers3, Pause, Play } from 'lucide-react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import facebookIcon from '../assets/facebook-brand.png';
import lineIcon from '../assets/line-brand.png';
import { LANDING_DEMO as demo } from '../data/landingDemo.ts';
import { SOURCE_META } from '../utils/cdpHelpers.ts';
import type { WorkflowTabId } from '../types/cdp.ts';
import { LandingExcluded, LandingFinalCta } from './LandingSections.tsx';
import { LandingStory, WorkspaceFrame } from './LandingStory.tsx';
import './LandingPage.css';

interface LandingPageProps {
  /** `prompt` is the activity to open the campaign composer with; the main button leaves it out. */
  onEnterWorkspace: (initialTab: WorkflowTabId, prompt?: string) => void;
}

const sources = [
  { message: demo.message, evidence: demo.evidence, highlight: demo.highlight, label: 'ข้อความจาก LINE' },
  { ...demo.facebook, label: 'โพสต์จาก Facebook' },
];

function SourcePreview({ ready }: { ready: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.35 });
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!visible || reducedMotion || paused) return;
    const timer = window.setTimeout(() => setSelected((selected + 1) % sources.length), 4400);
    return () => window.clearTimeout(timer);
  }, [visible, reducedMotion, paused, selected]);

  return (
    <div className="hero-sources" ref={ref} data-ready={ready} role="group" aria-label="แหล่งข้อมูลของฟ้าใส">
      <WorkspaceFrame active="collect" title="แหล่งข้อมูล">
      <motion.div className="source-panels" id="hero-evidence" aria-live={paused || reducedMotion ? 'polite' : 'off'}
        onPanEnd={(_, info) => {
          // A swipe moves to the other source; the buttons below do the same for keyboard and mouse.
          if (Math.abs(info.offset.x) < 48 || Math.abs(info.offset.x) < Math.abs(info.offset.y)) return;
          setPaused(true);
          setSelected((current) => (current + (info.offset.x < 0 ? 1 : sources.length - 1)) % sources.length);
        }}>
        {sources.map(({ message, evidence, highlight, label }, index) => {
          const [before, after] = message.rawText.split(highlight);
          const active = index === selected;
          return (
            <div key={message.id} className="hero-preview" data-active={active} aria-hidden={!active}>
              <div className="preview-source">
                <div className="preview-origin">
                  <img src={index === 0 ? lineIcon : facebookIcon} alt="" width="32" height="32" />
                  <div>
                    <p className="preview-label">{label}</p>
                    <p className="preview-handle" lang="en">{message.handle}</p>
                  </div>
                </div>
                <blockquote className="source-quote">{before}<mark>{highlight}</mark>{after}</blockquote>
              </div>
              <div className="preview-profile">
                <div className="preview-person">
                  <span className="preview-avatar" aria-hidden="true">{demo.profile.nickname[0]}</span>
                  <strong>{demo.profile.nickname}</strong>
                </div>
                <motion.div className="preview-evidence" initial={false} animate={ready ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 10, scale: 0.96 }}
                  transition={{ duration: 0.35, delay: ready ? 0.45 : 0, ease: 'easeOut' }}>
                  <span>ความสนใจจาก{index === 0 ? 'ข้อความ' : 'โพสต์'}</span>
                  <strong>{evidence.value}</strong>
                </motion.div>
              </div>
            </div>
          );
        })}
      </motion.div>
      <div className="source-controls">
        <div className="source-options" role="group" aria-label="เลือกแหล่งข้อมูล">
          {sources.map(({ message }, index) => (
            <button key={message.id} className="button" type="button" aria-pressed={index === selected}
              aria-controls="hero-evidence" onClick={() => { setPaused(true); setSelected(index); }}>
              {SOURCE_META[message.source].shortLabel}
            </button>
          ))}
        </div>
        <div className="source-playback">
          {!reducedMotion && (
            <button className="button" type="button" onClick={() => setPaused((current) => !current)}
              aria-label={paused ? 'เล่นการสลับแหล่งข้อมูลอัตโนมัติ' : 'พักการสลับแหล่งข้อมูลอัตโนมัติ'}>
              {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
            </button>
          )}
          <button className="button source-next" type="button" aria-controls="hero-evidence"
            onClick={() => setSelected((current) => (current + 1) % sources.length)}
            aria-label={`ดูแหล่งข้อมูลถัดไป ${SOURCE_META[sources[(selected + 1) % sources.length].message.source].shortLabel}`}>
            <ChevronRight size={21} aria-hidden="true" />
          </button>
        </div>
      </div>
      </WorkspaceFrame>
    </div>
  );
}

export function LandingPage({ onEnterWorkspace }: LandingPageProps) {
  const reducedMotion = useReducedMotion();
  const enter = () => onEnterWorkspace('segment');
  // The headline block arrives piece by piece, then the product card rises, then its highlight sweeps and the interest appears.
  const [heroReady, setHeroReady] = useState(Boolean(reducedMotion));
  const piece = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } } };

  return (
    <div className="landing" id="top">
      <a className="skip-link" href="#landing-main">ข้ามไปยังเนื้อหา</a>
      <header className="landing-header wrap">
        <a href="#top" className="brand" aria-label="Gather หน้าแรก">
          <span className="brand-mark"><Layers3 size={20} aria-hidden="true" /></span>
          <span lang="en">gather<span className="brand-dot">.</span></span>
        </a>
        <nav className="landing-nav" aria-label="เมนูหลัก">
          <a href="#how-it-works">วิธีทำงาน</a>
          <button className="button landing-outline" onClick={enter}>เข้าเดโม</button>
        </nav>
      </header>
      <main id="landing-main" tabIndex={-1}>
        <section className="landing-hero wrap" aria-labelledby="hero-title">
          <motion.div className="hero-copy" initial={reducedMotion ? false : 'hidden'} animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
            <motion.p variants={piece} className="hero-kicker">Mini CDP สำหรับกิจกรรมในมหาวิทยาลัย</motion.p>
            <motion.h1 variants={piece} id="hero-title">ถ้าจะชวนเพื่อน<br /><span>ใครน่าจะไปด้วย?</span></motion.h1>
            <motion.p variants={piece} className="hero-description">Gather รวมแชท โพสต์ และรายชื่อในภาควิชา เพื่อแนะนำเพื่อนที่น่าจะสนใจกิจกรรม และติดตามคำตอบของแต่ละคน</motion.p>
            <motion.div variants={piece} className="hero-actions">
              <button className="button landing-cta" onClick={enter}>ทดลองใช้เดโม</button>
              <a className="hero-secondary" href="#how-it-works">ดูวิธีทำงาน</a>
            </motion.div>
            <motion.p variants={piece} className="hero-note">เข้าด้วยบัญชีเดโม ไม่ต้องสมัคร ใช้ชื่อและข้อความสมมติ ไม่มีการส่งหาใครจริง</motion.p>
          </motion.div>
          <motion.div className="hero-product" initial={reducedMotion ? false : { opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : 0.4, ease: 'easeOut' }} onAnimationComplete={() => setHeroReady(true)}>
            <SourcePreview ready={heroReady} />
          </motion.div>
        </section>
        <LandingStory />
        <LandingExcluded />
        <LandingFinalCta onEnter={(prompt) => onEnterWorkspace('segment', prompt)} />
      </main>
      <footer><div className="landing-footer wrap"><span lang="en">gather.</span><span>ข้อมูลทั้งหมดในหน้านี้เป็นข้อมูลสมมติ</span></div></footer>
    </div>
  );
}
