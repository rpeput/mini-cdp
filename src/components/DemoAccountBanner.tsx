import { FlaskConical, Radio, Users } from 'lucide-react';
import type { WorkflowTabId } from '../types/cdp.ts';

interface DemoAccountBannerProps {
  activeTab: WorkflowTabId;
  friendCount: number;
  onTabChange: (tab: WorkflowTabId) => void;
}

export function DemoAccountBanner({ activeTab, friendCount, onTabChange }: DemoAccountBannerProps) {
  return (
    <section className="demo-account" aria-label="บัญชีทดลอง">
      <FlaskConical size={19} aria-hidden="true" />
      <p>
        <strong>เข้าด้วยบัญชีเดโม</strong> เพื่อน {friendCount} คนเป็นชื่อสมมติ ข้อความ LINE ที่ส่งและคำตอบที่เห็นเป็นการจำลองในแอป ไม่มีการส่งหาใครจริง
      </p>
      <div className="demo-account-actions">
        <button className="button button-light" aria-current={activeTab === 'profiles' ? 'page' : undefined} onClick={() => onTabChange('profiles')}>
          <Users size={16} aria-hidden="true" /> ดูรายชื่อเพื่อน
        </button>
        <button className="button button-light" aria-current={activeTab === 'segment' ? 'page' : undefined} onClick={() => onTabChange('segment')}>
          <Radio size={16} aria-hidden="true" /> เริ่มสร้างแคมเปญ
        </button>
      </div>
    </section>
  );
}
