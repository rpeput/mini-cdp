import { ChevronDown, ChevronUp, FlaskConical, Radio, Users } from 'lucide-react';
import { useState } from 'react';
import type { WorkflowTabId } from '../types/cdp.ts';

interface DemoAccountBannerProps {
  activeTab: WorkflowTabId;
  friendCount: number;
  onTabChange: (tab: WorkflowTabId) => void;
}

const storageKey = 'gather-demo-banner';

function initiallyExpanded(): boolean {
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved === 'open' || saved === 'closed') return saved === 'open';
  } catch {
    // Fall through to the width-based default.
  }
  return window.innerWidth > 680;
}

export function DemoAccountBanner({ activeTab, friendCount, onTabChange }: DemoAccountBannerProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  function toggle() {
    setExpanded(!expanded);
    try {
      sessionStorage.setItem(storageKey, expanded ? 'closed' : 'open');
    } catch {
      // The banner still toggles for this visit.
    }
  }

  return (
    <section className="demo-account" aria-label="บัญชีทดลอง">
      <FlaskConical size={19} aria-hidden="true" />
      {expanded ? (
        <p>
          <strong>เข้าด้วยบัญชีเดโม</strong> เพื่อน {friendCount} คนเป็นชื่อสมมติ ข้อความ LINE ที่ส่งและคำตอบที่เห็นเป็นการจำลองในแอป ไม่มีการส่งหาใครจริง
        </p>
      ) : (
        <p><strong>บัญชีเดโม</strong> · ข้อมูลและข้อความทั้งหมดเป็นการจำลอง</p>
      )}
      {expanded && (
        <div className="demo-account-actions">
          <button className="button button-light" aria-current={activeTab === 'profiles' ? 'page' : undefined} onClick={() => onTabChange('profiles')}>
            <Users size={16} aria-hidden="true" /> ดูรายชื่อเพื่อน
          </button>
          <button className="button button-light" aria-current={activeTab === 'segment' ? 'page' : undefined} onClick={() => onTabChange('segment')}>
            <Radio size={16} aria-hidden="true" /> เริ่มสร้างแคมเปญ
          </button>
        </div>
      )}
      <button className="text-button demo-account-toggle" aria-expanded={expanded} onClick={toggle}>
        {expanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
        {expanded ? 'ซ่อน' : 'รายละเอียด'}
      </button>
    </section>
  );
}
