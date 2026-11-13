import { animate, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, ClipboardCheck, Database, MessageSquareText, Radio, SquareActivity, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CampaignRecord, RawSourceRecord, UnifiedProfile, UnlinkedRecord, WorkflowTabId } from '../types/cdp.ts';
import { summarizeCampaign } from '../utils/campaignFlow.ts';
import { buildFunnel, buildNextActions, countVerifiedInterests, type NextAction } from '../utils/overview.ts';
import { formatDateShort } from '../utils/cdpHelpers.ts';

interface OverviewTabProps {
  profiles: UnifiedProfile[];
  records: RawSourceRecord[];
  campaigns: CampaignRecord[];
  inbox: UnlinkedRecord[];
  confidenceThreshold: number;
  manuallyApprovedIds: ReadonlySet<string>;
  onNavigate: (tab: WorkflowTabId, anchor?: string) => void;
}

const actionIcons: Record<NextAction['id'], typeof Users> = {
  stitch: Database,
  review: ClipboardCheck,
  inbox: MessageSquareText,
  replies: SquareActivity,
};

/** Counts up from 0 once when the page opens; the final number is always in the text. */
function CountUp({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const first = useRef(true);
  useEffect(() => {
    if (reduced || !first.current) {
      setShown(value);
      return;
    }
    first.current = false;
    const controls = animate(0, value, { duration: 0.3, ease: 'easeOut', onUpdate: (latest) => setShown(Math.round(latest)) });
    return () => controls.stop();
  }, [value, reduced]);
  return <span aria-label={String(value)}>{shown}</span>;
}

export function OverviewTab({ profiles, records, campaigns, inbox, confidenceThreshold, manuallyApprovedIds, onNavigate }: OverviewTabProps) {
  const actions = buildNextActions({ profiles, campaigns, inbox, confidenceThreshold, manuallyApprovedIds });
  const funnel = buildFunnel(records, profiles, campaigns);
  const latest = campaigns[0];
  const totals = summarizeCampaign(latest);
  const mix = countVerifiedInterests(profiles, confidenceThreshold, manuallyApprovedIds);
  const mixTotal = mix.reduce((sum, slice) => sum + slice.count, 0);
  const mixMax = Math.max(1, ...mix.map((slice) => slice.count));
  const top = mix.reduce((best, slice) => (slice.count > best.count ? slice : best), mix[0]);
  const funnelMax = Math.max(1, ...funnel.map((stage) => stage.count));
  const [messages, combined, consented, sent, accepted] = funnel;

  return (
    <section aria-labelledby="overview-title">
      <header className="page-heading">
        <div>
          <h1 id="overview-title">ภาพรวม</h1>
          <p>ดูว่าตอนนี้ควรทำอะไรต่อ และข้อมูลเดินมาถึงขั้นไหนแล้ว <span className="chip chip-neutral">ข้อมูลสมมติ</span></p>
        </div>
      </header>

      <section aria-labelledby="next-title" className="overview-next">
        <h2 id="next-title">ควรทำอะไรต่อ</h2>
        {actions.length ? (
          <ul className="next-list">
            {actions.map((action, index) => {
              const Icon = actionIcons[action.id];
              return (
                <li key={action.id} className="surface next-card">
                  <span className="summary-icon"><Icon size={20} aria-hidden="true" /></span>
                  <div>
                    <p className="next-rank">{index === 0 ? 'ทำก่อน' : `ลำดับที่ ${index + 1}`}</p>
                    <h3>{action.title}</h3>
                    <p>{action.detail}</p>
                  </div>
                  <button type="button" className={`button ${index === 0 ? 'button-primary' : 'button-light'}`} onClick={() => onNavigate(action.tab, action.anchor)}>{action.cta}</button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="surface next-card next-ready">
            <span className="summary-icon"><CheckCircle2 size={20} aria-hidden="true" /></span>
            <div><h3>ไม่มีอะไรค้าง พร้อมสร้างแคมเปญ</h3><p>โปรไฟล์ถูกรวมแล้ว ความสนใจถูกตรวจแล้ว และไม่มีข้อความรอเจ้าของ</p></div>
            <button type="button" className="button button-primary" onClick={() => onNavigate('segment')}><Radio size={17} aria-hidden="true" /> สร้างแคมเปญ</button>
          </div>
        )}
      </section>

      <div className="overview-grid">
        <section className="surface panel" aria-labelledby="funnel-title">
          <h2 id="funnel-title">จากข้อความถึงคำตอบรับ</h2>
          <p>
            จากข้อความ {messages.count} ข้อความ รวมเป็นโปรไฟล์แล้ว {combined.count} คน พร้อมรับคำเชิญ {consented.count} คน
            {latest ? ` แคมเปญล่าสุดส่ง ${sent.count} คน ตอบรับ ${accepted.count} คน` : ' ยังไม่ได้ส่งแคมเปญ'}
          </p>
          <ol className="funnel">
            {funnel.map((stage) => (
              <li key={stage.id}>
                <div className="funnel-label"><span>{stage.label}</span><strong><CountUp value={stage.count} /> <small>{stage.unit}</small></strong></div>
                <div className="bar-track" aria-hidden="true">
                  <motion.div className="bar-fill" initial={{ scaleX: 0 }} animate={{ scaleX: stage.count / funnelMax }} transition={{ duration: 0.3, ease: 'easeOut' }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="chart-note">ข้อความนับเป็นข้อความ ส่วนขั้นอื่นนับเป็นคน ความยาวแท่งเทียบกับตัวเลขที่มากสุดในรายการนี้</p>
        </section>

        <section className="surface panel" aria-labelledby="latest-title">
          <h2 id="latest-title">ผลแคมเปญล่าสุด</h2>
          {latest ? (
            <>
              <p>{latest.name} · ส่งเมื่อ {formatDateShort(latest.createdAt)}</p>
              <dl className="metric-grid metric-grid-four overview-metrics">
                <div className="metric"><dt>ส่ง</dt><dd><CountUp value={totals.sent} /></dd></div>
                <div className="metric"><dt>ตอบรับ</dt><dd><CountUp value={totals.accepted} /></dd></div>
                <div className="metric"><dt>ปฏิเสธ</dt><dd><CountUp value={totals.declined} /></dd></div>
                <div className="metric"><dt>ยังไม่ตอบ</dt><dd><CountUp value={totals.pending} /></dd></div>
              </dl>
              <button type="button" className="button button-light" onClick={() => onNavigate('analytics')}><SquareActivity size={17} aria-hidden="true" /> ดูผลแคมเปญเต็ม</button>
            </>
          ) : (
            <div className="empty compact-empty"><Radio aria-hidden="true" /><h3>ยังไม่มีแคมเปญ</h3><p>เมื่อส่งคำเชิญจำลองแล้ว ยอดส่ง ตอบรับ และยังไม่ตอบจะมาแสดงที่นี่</p>
              <button type="button" className="button button-light" onClick={() => onNavigate('segment')}>สร้างแคมเปญ</button></div>
          )}
        </section>
      </div>

      <section className="surface panel" aria-labelledby="mix-title">
        <h2 id="mix-title">ความสนใจที่ตรวจแล้ว แยกตามหมวด</h2>
        {mixTotal ? (
          <p>ตรวจแล้ว {mixTotal} รายการ มากที่สุดคือ{top.label} {top.count} รายการ (นับเฉพาะที่ผ่านเกณฑ์หรือคุณยืนยันแล้ว)</p>
        ) : (
          <p>ยังไม่มีความสนใจที่ตรวจแล้ว ลองรวมข้อมูลในหน้าแหล่งข้อมูลก่อน</p>
        )}
        <ul className="bar-chart">
          {mix.map((slice) => (
            <li key={slice.category}>
              <span className="bar-name">{slice.label}</span>
              <div className="bar-track" aria-hidden="true">
                <motion.div className="bar-fill" initial={{ scaleX: 0 }} animate={{ scaleX: slice.count / mixMax }} transition={{ duration: 0.3, ease: 'easeOut' }} />
              </div>
              <strong>{slice.count} <small>รายการ{mixTotal ? ` · ${Math.round((slice.count / mixTotal) * 100)}%` : ''}</small></strong>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
