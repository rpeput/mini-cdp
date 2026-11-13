import { Ban, Check, ShieldCheck, X } from 'lucide-react';
import { useInView } from 'motion/react';
import { useRef } from 'react';
import { LANDING_EXCLUDED, LANDING_MISREADS, LANDING_NUMBERS, LANDING_SCENARIOS } from '../data/landingDemo.ts';
import { CountUp } from './CountUp.tsx';

export function LandingNumbers() {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.5 });
  const stages = [
    { label: 'ข้อความต้นทาง', value: LANDING_NUMBERS.messages, unit: 'ข้อความ' },
    { label: 'โปรไฟล์ที่รวมแล้ว', value: LANDING_NUMBERS.profiles, unit: 'คน' },
    { label: 'คำเชิญที่ส่ง', value: LANDING_NUMBERS.sent, unit: 'คน' },
    { label: 'ตอบรับ', value: LANDING_NUMBERS.accepted, unit: 'คน' },
  ];
  return (
    <section className="landing-numbers" aria-labelledby="numbers-title">
      <div className="wrap">
        <p className="section-kicker">ตัวเลขจากเดโม <span className="chip chip-neutral">ข้อมูลสมมติ</span></p>
        <h2 id="numbers-title">45 ข้อความ เหลือคนที่ตอบรับ 6 คน</h2>
        <ol className="number-row" ref={ref}>
          {stages.map((stage) => (
            <li key={stage.label}>
              <strong><CountUp value={stage.value} start={seen} /></strong>
              <span>{stage.unit}</span>
              <p>{stage.label}</p>
            </li>
          ))}
        </ol>
        <p className="numbers-note">ตัวเลขนี้มาจากการเล่นเดโมแคมเปญหมูกระทะจริงในแอปนี้ด้วยรายชื่อเพื่อนสมมติ ไม่ใช่ผลของลูกค้า</p>
      </div>
    </section>
  );
}

export function LandingExcluded() {
  const { profile, record, interest } = LANDING_EXCLUDED;
  const total = LANDING_NUMBERS.profiles;
  return (
    <section className="landing-excluded" aria-labelledby="excluded-title">
      <div className="wrap landing-split">
        <div className="chapter-copy">
          <h2 id="excluded-title">ใครไม่ถูกชวน</h2>
          <p>ข้อความของ{profile.nickname}ตรงกับกิจกรรม แต่เขายังไม่ยินยอมรับคำเชิญ Gather จึงตัดออกจากรายชื่อผู้รับก่อนแนะนำ ไม่ว่าจะเลือกกิจกรรมไหน</p>
          <p className="split-fact"><ShieldCheck size={20} aria-hidden="true" /> เพื่อน {total} คน · ยินยอม {total - LANDING_NUMBERS.notConsented} คน · ไม่ถูกชวน {LANDING_NUMBERS.notConsented} คน</p>
        </div>
        <div className="ws-card" role="group" aria-label={`ตัวอย่าง ${profile.nickname} ที่ไม่ถูกชวน`}>
          <div className="ws-row-top">
            <span className="preview-avatar" aria-hidden="true">{profile.nickname[0]}</span>
            <strong>{profile.nickname}</strong>
            <span className="chip chip-waiting">ยังไม่ยินยอม</span>
          </div>
          <blockquote className="ws-quote">{record.rawText}</blockquote>
          <p className="ws-note">ข้อความนี้อ่านพบความสนใจ “{interest}”</p>
          <p className="ws-excluded"><Ban size={18} aria-hidden="true" /> ไม่อยู่ในรายชื่อผู้รับ</p>
        </div>
      </div>
    </section>
  );
}

export function LandingWhy() {
  return (
    <section className="landing-why" aria-labelledby="why-title">
      <div className="wrap">
        <div className="chapter-copy">
          <h2 id="why-title">ทำไมไม่ใช่แค่ตัวกรอง?</h2>
          <p>กฎคำสำคัญเห็นคำว่า “หมูกระทะ” แล้วนับเป็นความชอบเสมอ แต่ข้อความจริงมีคำปฏิเสธ คำว่า “เลิก” และเรื่องที่ไม่เกี่ยวกัน Gather จึงให้ AI อ่านบริบท และเก็บข้อความอ้างอิงให้คนตรวจ</p>
        </div>
        <ul className="misread-list">
          {LANDING_MISREADS.map((item) => (
            <li key={item.id} className="ws-card">
              <blockquote className="ws-quote">{item.text}</blockquote>
              <div className="misread-cols">
                <div>
                  <p className="misread-label">กฎคำสำคัญอ่านว่า <small>(รันจริงบนหน้านี้)</small></p>
                  <ul>{item.rules.map((line) => <li key={line} className="misread-bad"><X size={15} aria-hidden="true" /> {line}</li>)}</ul>
                </div>
                <div>
                  <p className="misread-label">คำตอบที่ถูกต้อง <small>(เฉลยที่เขียนไว้ล่วงหน้า ไม่ใช่ผลจากโมเดล)</small></p>
                  <ul>{item.answer.length ? item.answer.map((line) => <li key={line} className="misread-good"><Check size={15} aria-hidden="true" /> {line}</li>) : <li className="misread-good"><Check size={15} aria-hidden="true" /> ไม่มีความชอบให้บันทึก</li>}</ul>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <p className="numbers-note">คะแนนจริงของกฎและโมเดลดูได้ในหน้า “AI ช่วยอะไร” ของเดโม ถ้าไม่ได้เชื่อมโมเดล หน้านั้นจะบอกว่า AI ไม่ได้ตอบ</p>
      </div>
    </section>
  );
}

export function LandingFinalCta({ onEnter }: { onEnter: (prompt: string) => void }) {
  return (
    <section className="landing-final" aria-labelledby="final-title">
      <div className="wrap">
        <h2 id="final-title">ลองกับกิจกรรมที่คุณอยากชวน</h2>
        <p>เลือกสถานการณ์ แล้วเข้าเดโมที่หน้าสร้างแคมเปญ ไม่ต้องสมัคร ไม่มีการส่งหาใครจริง</p>
        <ul className="scenario-list">
          {LANDING_SCENARIOS.map((scenario, index) => (
            <li key={scenario.id}>
              <button type="button" className={`scenario${index === 0 ? ' scenario-main' : ''}`} onClick={() => onEnter(scenario.prompt)}>
                <strong>{scenario.label}</strong>
                <span>{scenario.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
