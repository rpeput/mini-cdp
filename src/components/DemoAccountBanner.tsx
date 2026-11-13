import { FlaskConical, Radio, Sparkles, Users } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { getAiEnabled, setAiEnabled } from '../services/aiClient.ts';
import type { WorkflowTabId } from '../types/cdp.ts';

interface DemoAccountBannerProps {
  activeTab: WorkflowTabId;
  onTabChange: (tab: WorkflowTabId) => void;
}

/**
 * The AI switch lives in this banner, where a first-time visitor reads past it. Each time the workspace opens the switch gives one short zoom and two pulses, and a small note explains what it does. It never
 * blocks the page, never takes focus, and goes away once it is dismissed or the switch is used. It shows on every entry to the workspace.
 */
export function DemoAccountBanner({ activeTab, onTabChange }: DemoAccountBannerProps) {
  const reduced = useReducedMotion();
  const [useAi, setUseAi] = useState(getAiEnabled);
  const [tip, setTip] = useState(false);
  const bannerRef = useRef<HTMLElement>(null);
  const switchRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  function flip() {
    setAiEnabled(!useAi);
    setUseAi(!useAi);
  }

  function dismissTip() {
    setTip(false);
  }

  useEffect(() => {
    const id = window.setTimeout(() => setTip(true), reduced ? 300 : 800);
    return () => window.clearTimeout(id);
  }, [reduced]);

  useEffect(() => {
    if (!tip) return;
    // Point the note's arrow at the middle of the switch, wherever the banner has wrapped it.
    const place = () => {
      const banner = bannerRef.current;
      const toggle = switchRef.current;
      const note = tipRef.current;
      if (!banner || !toggle || !note) return;
      const x = toggle.getBoundingClientRect().left + toggle.offsetWidth / 2 - (banner.getBoundingClientRect().left + note.offsetLeft);
      note.style.setProperty('--arrow-x', `${Math.max(18, Math.min(note.offsetWidth - 18, x))}px`);
    };
    place();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissTip();
    };
    window.addEventListener('resize', place);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('keydown', onKey);
    };
  }, [tip]);

  return (
    <section className="demo-account" aria-label="บัญชีทดลอง" ref={bannerRef}>
      <FlaskConical size={19} aria-hidden="true" />
      <p><strong>บัญชีเดโม</strong> · ข้อมูลและข้อความทั้งหมดเป็นการจำลอง</p>
      <div className="demo-account-actions">
        <button className="button button-light" aria-current={activeTab === 'profiles' ? 'page' : undefined} onClick={() => onTabChange('profiles')}>
          <Users size={16} aria-hidden="true" /> ดูรายชื่อเพื่อน
        </button>
        <button className="button button-light" aria-current={activeTab === 'segment' ? 'page' : undefined} onClick={() => onTabChange('segment')}>
          <Radio size={16} aria-hidden="true" /> เริ่มสร้างแคมเปญ
        </button>
      </div>
      <motion.span className="ai-mode-wrap" animate={tip && !reduced ? { scale: [1, 1.14, 1] } : { scale: 1 }} transition={{ duration: 0.6, ease: 'easeInOut' }}>
        {tip && !reduced && (
          <motion.span className="ai-ring" aria-hidden="true" initial={{ opacity: 0.8, scale: 1 }} animate={{ opacity: 0, scale: 1.3 }} transition={{ duration: 1.1, repeat: 2, ease: 'easeOut' }} />
        )}
        <button ref={switchRef} type="button" className="button button-light ai-mode-toggle" role="switch" aria-checked={useAi} aria-label="ใช้ AI"
          onClick={() => { flip(); if (tip) dismissTip(); }}>
          {useAi ? 'AI เปิดอยู่' : 'โหมดพื้นฐาน'}
        </button>
      </motion.span>
      <AnimatePresence>
        {tip && (
          <motion.div ref={tipRef} className="ai-tip" role="region" aria-label="แนะนำโหมด AI"
            style={{ transformOrigin: 'var(--arrow-x, 50%) 0' }}
            initial={reduced ? false : { opacity: 0, scale: 0.9, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }} transition={{ duration: 0.24, ease: 'easeOut' }}>
            <p className="ai-tip-title"><Sparkles size={16} aria-hidden="true" /> มีโหมด AI ให้เลือก</p>
            <p>เปิดไว้ AI จะช่วยอ่านข้อความ แนะนำผู้รับ และตรวจคำเชิญ ปิดแล้วระบบใช้กฎพื้นฐานแทน สลับได้ทุกเมื่อที่ปุ่มนี้</p>
            <div className="ai-tip-actions">
              <button type="button" className="button button-primary" onClick={dismissTip}>เข้าใจแล้ว</button>
              <button type="button" className="button button-light" onClick={flip}>{useAi ? 'ลองปิด AI' : 'เปิด AI'}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
