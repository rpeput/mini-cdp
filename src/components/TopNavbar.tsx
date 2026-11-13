import { ChevronLeft, Database, LayoutDashboard, Gauge, Layers3, Menu, Radio, RotateCcw, SquareActivity, Users, Workflow, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  { id: 'overview', label: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'profiles', label: 'รายชื่อเพื่อน', icon: Users },
  { id: 'collect', label: 'แหล่งข้อมูล', icon: Database },
  { id: 'segment', label: 'สร้างแคมเปญ', icon: Radio },
  { id: 'analytics', label: 'ผลแคมเปญ', icon: SquareActivity },
  { id: 'ai', label: 'AI ช่วยอะไร', icon: Gauge },
] as const;

export function TopNavbar({ activeTab, onTabChange, onToggleXRay, onResetDemo, onReturnToLanding, busy }: TopNavbarProps) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);

  // On narrow screens the menu is a drawer: Escape closes it and focus returns to the button that opened it.
  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);
  const run = (action: () => void) => () => {
    close();
    action();
  };

  return (
    <>
      <header className="mobile-bar">
        <button ref={menuButton} type="button" className="mobile-menu-button" aria-label="เปิดเมนู" aria-expanded={open} aria-controls="workspace-sidebar" onClick={() => setOpen(true)}>
          <Menu size={22} aria-hidden="true" />
        </button>
        <span className="brand" lang="en">gather<span className="brand-dot">.</span></span>
      </header>
      <button type="button" className="sidebar-scrim" data-open={open} tabIndex={-1} aria-hidden="true" onClick={close} />
      <aside id="workspace-sidebar" className="workspace-sidebar" data-open={open} aria-label="เมนูพื้นที่ทำงาน">
        <div className="sidebar-top">
          <button className="brand sidebar-brand" onClick={run(onReturnToLanding)} aria-label="Gather กลับหน้าแรก">
            <span className="brand-mark"><Layers3 size={20} aria-hidden="true" /></span>
            <span lang="en">gather<span className="brand-dot">.</span></span>
          </button>
          <button type="button" className="mobile-menu-button sidebar-close" aria-label="ปิดเมนู" onClick={() => { close(); menuButton.current?.focus(); }}>
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="workspace-identity">
          <span className="workspace-avatar" aria-hidden="true">G</span>
          <span><strong>ชมรมเพื่อนภาควิชา</strong><small>พื้นที่ทดลอง</small></span>
        </div>
        <nav className="workspace-nav" aria-label="เมนูพื้นที่ทำงาน">
          {pages.map(({ id, label, icon: Icon }, index) => (
            <button key={id} ref={index === 0 ? firstItem : undefined} className="nav-item" aria-current={activeTab === id ? 'page' : undefined} onClick={run(() => onTabChange(id))}>
              <Icon size={18} aria-hidden="true" /> <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="workspace-utilities">
          <button className="nav-item" onClick={run(onToggleXRay)}><Workflow size={17} aria-hidden="true" /> บันทึกระบบ</button>
          <button className="nav-item" disabled={busy} onClick={run(onResetDemo)}><RotateCcw size={17} aria-hidden="true" /> เริ่มเดโมใหม่</button>
          <button className="nav-item" onClick={run(onReturnToLanding)}><ChevronLeft size={17} aria-hidden="true" /> กลับหน้าแรก</button>
        </div>
      </aside>
    </>
  );
}
