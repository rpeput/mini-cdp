import { ArrowRight, Database, FileText, MessageSquare, Plus, ScanLine, Share2 } from 'lucide-react';
import { useState } from 'react';
import type { DataSourceType, RawSourceRecord, UnifiedProfile } from '../types/cdp.ts';
import { SOURCE_META } from '../utils/cdpHelpers.ts';

interface CollectUnifyTabProps {
  profiles: UnifiedProfile[];
  records: RawSourceRecord[];
  busy: boolean;
  isStitching: boolean;
  confidenceThreshold: number;
  onThresholdChange: (threshold: number) => void;
  onRunStitching: () => void;
  onAddSignal: (id: string, source: DataSourceType, text: string) => void;
  onInspectProfile: (id: string) => void;
  onGoToCampaign: () => void;
}

const sources = [
  { id: 'LINE_CHAT', icon: MessageSquare },
  { id: 'FACEBOOK_POST', icon: Share2 },
  { id: 'DEPT_ROSTER', icon: FileText },
] as const;

export function CollectUnifyTab({ profiles, records, busy, isStitching, confidenceThreshold, onThresholdChange, onRunStitching, onAddSignal, onInspectProfile, onGoToCampaign }: CollectUnifyTabProps) {
  const [filter, setFilter] = useState<DataSourceType | 'all'>('all');
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '');
  const [source, setSource] = useState<DataSourceType>('LINE_CHAT');
  const [text, setText] = useState('');
  const pending = profiles.filter((profile) => !profile.isStitched);
  const visible = records.filter((record) => filter === 'all' || record.source === filter);

  return (
    <section aria-labelledby="sources-title">
      <header className="page-heading">
        <div><h1 id="sources-title">แหล่งข้อมูล</h1><p>ดูว่าระบบจับคู่ข้อมูลกับใคร และสกัดความสนใจจากข้อความไหน</p></div>
        <button className="button button-primary" disabled={!pending.length || busy} onClick={onRunStitching}>
          <ScanLine size={18} aria-hidden="true" /> {isStitching ? 'กำลังรวมข้อมูล…' : 'รวมและสกัดข้อมูล'}
        </button>
      </header>
      <dl className="metric-grid">
        {sources.map(({ id, icon: Icon }) => (
          <div className="metric" key={id}><dt><Icon size={18} aria-hidden="true" /> <span lang="en">{SOURCE_META[id].label}</span></dt><dd>{records.filter((record) => record.source === id).length}</dd></div>
        ))}
      </dl>
      <div className="notice">
        <ScanLine size={20} aria-hidden="true" />
        <p role="status">{isStitching ? 'กำลังจับคู่ข้อมูลและอ่านข้อความต้นทาง…' : pending.length ? <><strong>{pending.length} โปรไฟล์รอประมวลผล</strong> ระบบจะจับคู่ด้วยรหัสโปรไฟล์ในชุดตัวอย่าง แล้วบันทึกความสนใจพร้อมข้อความอ้างอิง</> : <><strong>รวมข้อมูลครบแล้ว</strong> เปิดโปรไฟล์เพื่อตรวจหลักฐาน หรือนำข้อมูลไปสร้างแคมเปญ</>}</p>
        {!pending.length && <button className="button button-light" onClick={onGoToCampaign}>สร้างแคมเปญ <ArrowRight size={16} aria-hidden="true" /></button>}
      </div>
      <div className="source-layout">
        <div className="source-tools">
          <form className="surface panel" onSubmit={(event) => {
            event.preventDefault();
            if (!text.trim() || busy) return;
            onAddSignal(profileId, source, text.trim());
            setFilter('all');
            setText('');
          }}>
            <h2>เพิ่มข้อความทดลอง</h2>
            <p>ใช้ข้อความสมมติ แล้วเลือกเพื่อนที่ข้อความนี้กล่าวถึง</p>
            <label className="field">เพื่อน<select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nickname} · {profile.fullName}</option>)}
            </select></label>
            <label className="field">แหล่งข้อมูล<select value={source} onChange={(event) => setSource(event.target.value as DataSourceType)}>
              {sources.map(({ id }) => <option key={id} value={id}>{SOURCE_META[id].label}</option>)}
            </select></label>
            <label className="field">ข้อความ<textarea rows={3} value={text} maxLength={800} onChange={(event) => setText(event.target.value)} placeholder="เช่น ศุกร์นี้อยากกินหมูกระทะหลังมอ" /></label>
            <button className="button button-light" disabled={!text.trim() || busy} type="submit"><Plus size={18} aria-hidden="true" /> เพิ่มเข้าคิว</button>
          </form>
          <div className="surface panel">
            <h2><Database size={17} aria-hidden="true" /> เกณฑ์ตรวจสอบ</h2>
            <p>ความสนใจที่ต่ำกว่าเกณฑ์จะรอให้คุณยืนยันก่อนใช้แนะนำผู้รับ</p>
            <label className="field">ความมั่นใจขั้นต่ำ {confidenceThreshold}%<input type="range" min={50} max={95} step={5} value={confidenceThreshold} disabled={busy} onChange={(event) => onThresholdChange(Number(event.target.value))} /></label>
          </div>
        </div>
        <div className="surface">
          <div className="table-toolbar">
            <div><h2>ข้อมูลต้นทาง</h2><p aria-live="polite">{visible.length} รายการ</p></div>
            <label><span className="sr-only">กรองแหล่งข้อมูล</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              <option value="all">ทุกแหล่งข้อมูล</option>
              {sources.map(({ id }) => <option key={id} value={id}>{SOURCE_META[id].label}</option>)}
            </select></label>
          </div>
          <ul className="source-list" aria-label="รายการข้อมูลต้นทาง">
            {[...visible].reverse().map((record) => {
              const profile = profiles.find((item) => item.id === record.linkedProfileId);
              return (
                <li key={record.id}>
                  <div className="source-row-top"><span className="chip" lang="en">{SOURCE_META[record.source].shortLabel}</span>{profile && <button className="text-button" onClick={() => onInspectProfile(profile.id)}>ดูโปรไฟล์ {profile.nickname} <ArrowRight size={14} aria-hidden="true" /></button>}</div>
                  <p>{record.rawText}</p>
                  <small className="muted">{record.handle}</small>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
