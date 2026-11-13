import { Ban } from 'lucide-react';
import { LANDING_EXCLUDED, LANDING_SCENARIOS } from '../data/landingDemo.ts';

export function LandingExcluded() {
  const { profile, record, interest } = LANDING_EXCLUDED;
  return (
    <section className="landing-excluded" aria-labelledby="excluded-title">
      <div className="wrap landing-split">
        <div className="chapter-copy">
          <h2 id="excluded-title">ใครไม่ถูกชวน</h2>
          <p>ข้อความของ{profile.nickname}ตรงกับกิจกรรม แต่เขายังไม่ยินยอมรับคำเชิญ Gather จึงตัดออกจากรายชื่อผู้รับก่อนแนะนำ ไม่ว่าจะเลือกกิจกรรมไหน</p>
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

export function LandingFinalCta({ onEnter }: { onEnter: (prompt: string) => void }) {
  return (
    <section className="landing-final" aria-labelledby="final-title">
      <div className="wrap">
        <h2 id="final-title">ลองกับกิจกรรมที่คุณอยากชวน</h2>
        <p>เลือก-สถานการณ์ แล้วเข้าเดโมที่หน้าสร้างแคมเปญ</p>
        <ul className="scenario-list">
          {LANDING_SCENARIOS.map((scenario, index) => (
            <li key={scenario.id}>
              <button type="button" className={`scenario${index === 0 ? ' scenario-main' : ''}`} onClick={() => onEnter(scenario.prompt)}>
                {scenario.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
