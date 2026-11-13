import { FlaskConical, Radio, Users } from 'lucide-react';
import { useState } from 'react';
import { getAiEnabled, setAiEnabled } from '../services/aiClient.ts';
import type { WorkflowTabId } from '../types/cdp.ts';

interface DemoAccountBannerProps {
  activeTab: WorkflowTabId;
  onTabChange: (tab: WorkflowTabId) => void;
}

export function DemoAccountBanner({ activeTab, onTabChange }: DemoAccountBannerProps) {
  const [useAi, setUseAi] = useState(getAiEnabled);
  function toggleAi() {
    setAiEnabled(!useAi);
    setUseAi(!useAi);
  }

  return (
    <section className="demo-account" aria-label="บัญชีทดลอง">
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
      <button type="button" className="button button-light ai-mode-toggle" role="switch" aria-checked={useAi} aria-label="ใช้ AI" onClick={toggleAi}>
        {useAi ? 'AI เปิดอยู่' : 'โหมดพื้นฐาน'}
      </button>
    </section>
  );
}
