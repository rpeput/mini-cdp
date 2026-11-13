import { ChevronLeft, Database, Layers3, Radio, RotateCcw, SquareActivity, Users, Workflow } from 'lucide-react';
import type { WorkflowTabId } from '../types/cdp.ts';

interface TopNavbarProps {
  activeTab: WorkflowTabId;
  onTabChange: (tab: WorkflowTabId) => void;
  onToggleXRay: () => void;
  onResetDemo: () => void;
  onReturnToLanding: () => void;
  busy: boolean;
}

const pages = [
  { id: 'profiles', label: 'รายชื่อเพื่อน', icon: Users },
  { id: 'collect', label: 'แหล่งข้อมูล', icon: Database },
  { id: 'segment', label: 'สร้างแคมเปญ', icon: Radio },
  { id: 'analytics', label: 'ผลแคมเปญ', icon: SquareActivity },
] as const;

export function TopNavbar({ activeTab, onTabChange, onToggleXRay, onResetDemo, onReturnToLanding, busy }: TopNavbarProps) {
  return (
    <aside className="workspace-sidebar">
      <button className="brand sidebar-brand" onClick={onReturnToLanding} aria-label="Gather กลับหน้าแรก">
        <span className="brand-mark"><Layers3 size={20} aria-hidden="true" /></span>
        <span lang="en">gather<span className="brand-dot">.</span></span>
      </button>
      <div className="workspace-identity">
        <span className="workspace-avatar" aria-hidden="true">G</span>
        <span><strong>ชมรมเพื่อนภาควิชา</strong><small>พื้นที่ทดลอง</small></span>
      </div>
      <nav className="workspace-nav" aria-label="เมนูพื้นที่ทำงาน">
        {pages.map(({ id, label, icon: Icon }) => (
          <button key={id} className="nav-item" aria-current={activeTab === id ? 'page' : undefined} onClick={() => onTabChange(id)}>
            <Icon size={18} aria-hidden="true" /> <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="workspace-utilities">
        <button className="nav-item" onClick={onToggleXRay}><Workflow size={17} aria-hidden="true" /> บันทึกระบบ</button>
        <button className="nav-item" disabled={busy} onClick={onResetDemo}><RotateCcw size={17} aria-hidden="true" /> เริ่มเดโมใหม่</button>
        <button className="nav-item" onClick={onReturnToLanding}><ChevronLeft size={17} aria-hidden="true" /> กลับหน้าแรก</button>
      </div>
    </aside>
  );
}
