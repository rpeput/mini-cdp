import { Check, ChevronRight, Layers3, Pause, Play, Radio, RotateCcw, ShieldCheck } from 'lucide-react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import facebookIcon from '../assets/facebook-brand.png';
import lineIcon from '../assets/line-brand.png';
import { LANDING_DEMO as demo } from '../data/landingDemo.ts';
import { SOURCE_META } from '../utils/cdpHelpers.ts';
import type { WorkflowTabId } from '../types/cdp.ts';
import './LandingPage.css';

interface LandingPageProps {
  onEnterWorkspace: (initialTab: WorkflowTabId) => void;
}

const sources = [
  { message: demo.message, evidence: demo.evidence, highlight: demo.highlight, label: 'ข้อความจาก LINE' },
  { ...demo.facebook, label: 'โพสต์จาก Facebook' },
];

function SourcePreview() {
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
    <div className="demo-frame hero-sources" ref={ref} role="group" aria-label="แหล่งข้อมูลของฟ้าใส">
      <div className="source-panels" id="hero-evidence" aria-live={paused || reducedMotion ? 'polite' : 'off'}>
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
                <div className="preview-evidence">
                  <span>ความสนใจจาก{index === 0 ? 'ข้อความ' : 'โพสต์'}</span>
                  <strong>{evidence.value}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
    </div>
  );
}

function DemoChat() {
  const chatRef = useRef<HTMLDivElement>(null);
  const inView = useInView(chatRef, { amount: 0.4 });
  const reducedMotion = useReducedMotion();
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);
  const complete = finished || (reducedMotion && run === 0);

  function replay() {
    setRun((current) => current + 1);
    setFinished(false);
  }

  return (
    <div className="demo-frame chat-frame" ref={chatRef}>
      <div
        className="chat-transcript"
        key={run}
        data-playback={complete ? 'complete' : inView ? 'playing' : 'paused'}
      >
        <div className="chat-message chat-outgoing">
          <span>คำชวนจาก Gather</span>
          <blockquote>{demo.invitation}</blockquote>
        </div>
        <div className="chat-message chat-incoming">
          <span>{demo.profile.nickname}</span>
          <blockquote>{demo.reply}</blockquote>
        </div>
        <div className="chat-feedback" onAnimationEnd={() => setFinished(true)}>
          <span className="chip chip-positive"><Check size={14} aria-hidden="true" /> ตอบรับ</span>
          <p>บันทึกในโปรไฟล์ <strong>{demo.feedback}</strong></p>
        </div>
      </div>
      <div className="chat-controls">
        <button className="button" type="button" aria-label="เล่นแชทซ้ำ" title="เล่นแชทซ้ำ" onClick={replay}>
          <RotateCcw size={19} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function LandingPage({ onEnterWorkspace }: LandingPageProps) {
  const reducedMotion = useReducedMotion();
  const enter = () => onEnterWorkspace('segment');
  const reveal = {
    initial: reducedMotion ? false : { opacity: 0, y: 36 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.22 },
    transition: { duration: reducedMotion ? 0 : 0.55, ease: 'easeOut' as const },
  };

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
        <section aria-labelledby="hero-title">
          <div className="landing-hero wrap">
            <div className="hero-copy">
              <p className="hero-kicker">Mini CDP สำหรับกิจกรรมในมหาวิทยาลัย</p>
              <h1 id="hero-title">ถ้าจะชวนเพื่อน<br /><span>ใครน่าจะไปด้วย?</span></h1>
              <p className="hero-description">Gather รวมแชท โพสต์ และรายชื่อในภาควิชา เพื่อแนะนำเพื่อนที่น่าจะสนใจกิจกรรมและติดตามคำตอบของแต่ละคน</p>
              <div className="hero-actions">
                <button className="button landing-cta" onClick={enter}>ทดลองใช้เดโม</button>
                <a className="hero-secondary" href="#how-it-works">ดูวิธีทำงาน</a>
              </div>
              <p className="hero-note">เข้าด้วยบัญชีเดโม ไม่ต้องสมัคร ใช้ชื่อและข้อความสมมติ ไม่มีการส่งหาใครจริง</p>
            </div>

            <div className="hero-product"><SourcePreview /></div>
          </div>
        </section>

        <section className="landing-workflow" aria-labelledby="how-it-works">
          <div className="wrap landing-chapter">
            <motion.div className="chapter-copy landing-reveal" {...reveal}>
              <h2 id="how-it-works" tabIndex={-1}>ทำไม Gather<br />ถึงแนะนำ{demo.profile.nickname}?</h2>
              <p>Gather ใช้ความสนใจจากโปรไฟล์และความยินยอมรับคำเชิญเพื่อแนะนำผู้รับ คุณเลือกได้ว่าจะชวนใครและแก้ข้อความก่อนส่งได้</p>
              <div className="campaign-evidence">
                <ShieldCheck size={21} aria-hidden="true" />
                <div><strong>{demo.profile.nickname}ยินยอมรับคำเชิญ</strong><p>ตรวจจากโปรไฟล์เพื่อน</p></div>
              </div>
            </motion.div>
            <motion.div className="demo-frame campaign-frame landing-reveal" {...reveal}>
              <div className="demo-frame-bar"><span><Radio size={18} aria-hidden="true" /> สร้างแคมเปญ</span></div>
              <div className="campaign-demo">
                <h3>{demo.campaign}</h3>
                <div className="campaign-recipient">
                  <span className="preview-avatar" aria-hidden="true">{demo.profile.nickname[0]}</span>
                  <div><strong>{demo.profile.nickname}</strong><p>ความสนใจตรงกับกิจกรรม · {demo.evidence.value}</p></div>
                  <span className="chip chip-positive">ตรงกลุ่ม</span>
                </div>
                <div className="campaign-draft"><p>ข้อความถึง {demo.profile.nickname}</p><blockquote>{demo.invitation}</blockquote></div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="landing-results" aria-labelledby="results-title">
          <div className="wrap landing-conversation">
            <motion.div className="chapter-copy landing-reveal" {...reveal}>
              <h2 id="results-title">{demo.profile.nickname}ตอบว่าอะไร?</h2>
              <p>เมื่อ{demo.profile.nickname}ตอบรับ Gather บันทึกคำตอบไว้ในผลแคมเปญและเพิ่มข้อมูลกลับเข้าโปรไฟล์ของเธอ</p>
            </motion.div>
            <motion.div className="conversation-preview landing-reveal" {...reveal}><DemoChat /></motion.div>
            <button className="button landing-cta" onClick={enter}>ทดลองใช้เดโม</button>
          </div>
        </section>
      </main>

      <footer><div className="landing-footer wrap"><span lang="en">gather.</span></div></footer>
    </div>
  );
}
