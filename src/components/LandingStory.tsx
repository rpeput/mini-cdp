import { Check, Database, LayoutDashboard, Pause, Play, Radio, RotateCcw, SquareActivity, Users } from 'lucide-react';
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { type ReactNode, useRef, useState, useSyncExternalStore } from 'react';
import facebookIcon from '../assets/facebook-brand.png';
import lineIcon from '../assets/line-brand.png';
import { LANDING_DEMO as demo, LANDING_OUTCOME, LANDING_RECIPIENTS } from '../data/landingDemo.ts';
import { formatDateShort } from '../utils/cdpHelpers.ts';

type NavId = 'collect' | 'profiles' | 'segment' | 'analytics';

const navItems: Array<{ id: NavId | 'overview'; label: string; icon: typeof Users }> = [
  { id: 'overview', label: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'profiles', label: 'รายชื่อเพื่อน', icon: Users },
  { id: 'collect', label: 'แหล่งข้อมูล', icon: Database },
  { id: 'segment', label: 'สร้างแคมเปญ', icon: Radio },
  { id: 'analytics', label: 'ผลแคมเปญ', icon: SquareActivity },
];

/** The shape of the real workspace: the same side menu, page title and sample-data label. */
export function WorkspaceFrame({ active, title, children }: { active: NavId; title: string; children: ReactNode }) {
  return (
    <div className="ws-frame">
      <div className="ws-nav" aria-hidden="true">
        <span className="ws-logo" lang="en">gather<span className="brand-dot">.</span></span>
        {navItems.map(({ id, label, icon: Icon }) => (
          <span key={id} className="ws-nav-item" data-current={id === active}><Icon size={16} /> {label}</span>
        ))}
      </div>
      <div className="ws-main">
        <div className="ws-bar"><h3>{title}</h3><span className="chip chip-neutral">ข้อมูลสมมติ</span></div>
        {children}
      </div>
    </div>
  );
}

function Marked({ text, term }: { text: string; term: string }) {
  const at = text.indexOf(term);
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<mark>{term}</mark>{text.slice(at + term.length)}</>;
}

export function DemoChat({ active }: { active?: boolean }) {
  const chatRef = useRef<HTMLDivElement>(null);
  const inView = useInView(chatRef, { amount: 0.4 });
  const reducedMotion = useReducedMotion();
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);
  const [paused, setPaused] = useState(false);
  const complete = finished || (reducedMotion && run === 0);
  const playing = (active ?? inView) && !paused;

  function replay() {
    setRun((current) => current + 1);
    setFinished(false);
    setPaused(false);
  }

  return (
    <div className="chat-frame" ref={chatRef}>
      <div className="chat-transcript" key={run} data-playback={complete ? 'complete' : playing ? 'playing' : 'paused'}>
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
        {!complete && (
          <button className="button" type="button" aria-pressed={paused} aria-label={paused ? 'เล่นแชทต่อ' : 'หยุดแชทชั่วคราว'} title={paused ? 'เล่นต่อ' : 'หยุดชั่วคราว'} onClick={() => setPaused((current) => !current)}>
            {paused ? <Play size={19} aria-hidden="true" /> : <Pause size={19} aria-hidden="true" />}
          </button>
        )}
        <button className="button" type="button" aria-label="เล่นแชทซ้ำ" title="เล่นแชทซ้ำ" onClick={replay}>
          <RotateCcw size={19} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

const person = demo.profile;
const lineRecord = demo.message;
const fbRecord = demo.facebook.message;

function StepPanel({ index, active }: { index: number; active: boolean }) {
  if (index === 0) {
    return (
      <WorkspaceFrame active="collect" title="แหล่งข้อมูล">
        <ul className="ws-list">
          {[{ record: lineRecord, term: demo.highlight, icon: lineIcon, name: 'LINE' }, { record: fbRecord, term: demo.facebook.highlight, icon: facebookIcon, name: 'Facebook' }].map(({ record, term, icon, name }) => (
            <li key={record.id}>
              <div className="ws-row-top">
                <img src={icon} alt="" width="22" height="22" /><span className="chip" lang="en">{name}</span>
                <span className="muted">{record.handle} · {formatDateShort(record.timestamp)}</span>
              </div>
              <p className="ws-quote"><Marked text={record.rawText} term={term} /></p>
            </li>
          ))}
        </ul>
      </WorkspaceFrame>
    );
  }
  if (index === 1) {
    return (
      <WorkspaceFrame active="profiles" title={`โปรไฟล์ ${person.nickname}`}>
        <div className="ws-person">
          <span className="preview-avatar" aria-hidden="true">{person.nickname[0]}</span>
          <div><strong>{person.nickname} · {person.fullName}</strong><p className="muted">{person.studentId}</p></div>
          <span className="chip chip-positive">ยินยอมรับคำเชิญ</span>
        </div>
        <ul className="ws-list">
          {person.attributes.map((attribute) => (
            <li key={attribute.id} data-focus={attribute.evidenceQuote === demo.evidence.evidenceQuote}>
              <div className="ws-row-top">
                <span className="chip">{attribute.value}</span>
                <span className="chip chip-positive">ยืนยันแล้ว · มั่นใจ {attribute.confidence}%</span>
              </div>
              <p className="ws-quote">{attribute.evidenceQuote}</p>
            </li>
          ))}
        </ul>
      </WorkspaceFrame>
    );
  }
  if (index === 2) {
    return (
      <WorkspaceFrame active="segment" title="สร้างแคมเปญ">
        <p className="ws-campaign"><span className="muted">กิจกรรมที่คุณพิมพ์</span><strong>{demo.campaign}</strong></p>
        <ul className="ws-list">
          {LANDING_RECIPIENTS.map(({ profile, score, term, record }) => (
            <li key={profile.id}>
              <div className="ws-row-top">
                <span className="ws-check" aria-hidden="true"><Check size={14} /></span>
                <span className="preview-avatar" aria-hidden="true">{profile.nickname[0]}</span>
                <strong>{profile.nickname}</strong>
                <span className="chip chip-positive">ตรงกลุ่ม · {score}</span>
              </div>
              <p className="ws-quote"><span className="muted">เหตุผล: </span><Marked text={record.rawText} term={term} /></p>
            </li>
          ))}
        </ul>
        <p className="ws-note">ติ๊กเลือกและแก้ข้อความได้ก่อนส่ง · แสดงเฉพาะเพื่อนที่ยินยอม</p>
      </WorkspaceFrame>
    );
  }
  return (
    <WorkspaceFrame active="analytics" title="ผลแคมเปญ">
      <dl className="ws-metrics">
        <div><dt>ส่ง</dt><dd>{LANDING_OUTCOME.sent}</dd></div>
        <div><dt>ตอบรับ</dt><dd>{LANDING_OUTCOME.accepted}</dd></div>
        <div><dt>ปฏิเสธ</dt><dd>{LANDING_OUTCOME.declined}</dd></div>
        <div><dt>ยังไม่ตอบ</dt><dd>{LANDING_OUTCOME.pending}</dd></div>
      </dl>
      <DemoChat active={active} />
    </WorkspaceFrame>
  );
}

const steps = [
  { title: 'เริ่มจากข้อความที่เพื่อนพิมพ์จริง', body: `ฟ้าใสพิมพ์ใน LINE ว่า “${demo.message.rawText}” ส่วนที่ไฮไลต์คือข้อความที่ Gather ใช้เป็นหลักฐาน` },
  { title: 'หลักฐานถูกเก็บในโปรไฟล์', body: `ข้อความเดียวกันกลายเป็นความสนใจ “${demo.evidence.value}” พร้อมข้อความอ้างอิง แหล่ง และความมั่นใจ ${demo.evidence.confidence}% ถ้าไม่มั่นใจพอ จะรอให้คุณตรวจก่อน` },
  { title: 'คุณเลือกผู้รับ โดยเห็นเหตุผล', body: 'พิมพ์กิจกรรมแล้ว Gather แนะนำเพื่อนที่น่าจะสนใจ พร้อมข้อความที่ใช้เป็นเหตุผลของแต่ละคน คุณเป็นคนเลือกว่าจะส่งถึงใคร และแสดงเฉพาะเพื่อนที่ยินยอมรับคำเชิญ' },
  { title: 'คำตอบถูกเขียนกลับเข้าโปรไฟล์', body: `${person.nickname}ตอบรับ ยอดผลแคมเปญและประวัติในโปรไฟล์ของเธออัปเดตทันที ในเดโมนี้ส่ง ${LANDING_OUTCOME.sent} คน ตอบรับ ${LANDING_OUTCOME.accepted} คน (ข้อมูลสมมติ)` },
];

function subscribeNarrow(callback: () => void) {
  const query = window.matchMedia('(max-width: 900px)');
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

/**
 * One connected scene in four steps. On a wide screen the product UI stays put and changes with scroll
 * progress; on a narrow screen, or with reduced motion, it becomes four ordinary text-and-screen blocks.
 */
export function LandingStory() {
  const reducedMotion = useReducedMotion();
  const narrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia('(max-width: 900px)').matches, () => false);
  const linear = reducedMotion || narrow;
  const track = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: track, offset: ['start 50%', 'end 50%'] });
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);
  useMotionValueEvent(scrollYProgress, 'change', (value) => setStep(Math.min(steps.length - 1, Math.max(0, Math.floor(value * steps.length)))));

  return (
    <section className="landing-story" aria-labelledby="how-it-works">
      <div className="wrap">
        <div className="story-head">
          <h2 id="how-it-works" tabIndex={-1}>จากข้อความหนึ่งบรรทัด ถึงคำตอบรับหนึ่งคน</h2>
          <p>เรื่องเดียวต่อเนื่อง 4 ขั้น ใช้หน้าจอจริงของ Gather และข้อมูลสมมติชุดเดียวกับเดโม</p>
        </div>
        <div className="story-track" ref={track} data-mode={linear ? 'linear' : 'pinned'}>
          <ol className="story-steps">
            {steps.map((item, index) => (
              <li key={item.title} className="story-step" data-active={linear || index === step}>
                <p className="story-count">ขั้น {index + 1} จาก {steps.length}</p>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                {linear && <div className="story-inline"><StepPanel index={index} active /></div>}
              </li>
            ))}
          </ol>
          {!linear && (
            <div className="story-sticky">
              <motion.div className="story-progress" aria-hidden="true" style={{ scaleX: bar }} />
              <div className="story-stack" aria-live="polite">
                {steps.map((item, index) => (
                  <div key={item.title} className="story-panel" data-active={index === step} aria-hidden={index !== step} inert={index !== step}>
                    <StepPanel index={index} active={index === step} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
