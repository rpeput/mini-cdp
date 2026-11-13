import type { PipelineLog } from '../types/cdp.ts';
import { DrawerShell } from './DrawerShell.tsx';

interface XRayDrawerProps {
  open: boolean;
  onClose: () => void;
  pipelineLogs: PipelineLog[];
}

const time = new Intl.DateTimeFormat('th-TH', { timeStyle: 'medium' });

export function XRayDrawer({ open, onClose, pipelineLogs }: XRayDrawerProps) {
  return (
    <DrawerShell open={open} onClose={onClose} title="บันทึกการประมวลผล" subtitle="วิธีรวมข้อมูล แนะนำผู้รับ และบันทึกคำตอบกลับเข้าโปรไฟล์">
      <div className="drawer-content">
        <section aria-labelledby="pipeline-steps">
          <h3 id="pipeline-steps">ระบบทำงานอย่างไร</h3>
          <ol className="pipeline-steps">
            <li>จับคู่ข้อมูลดิบด้วยรหัสโปรไฟล์ในชุดตัวอย่าง</li>
            <li>สกัดความสนใจจากข้อความ เก็บหลักฐานและค่าความมั่นใจ โดยใช้กฎในเครื่องเมื่อ AI ใช้งานไม่ได้</li>
            <li>เทียบกิจกรรมกับความสนใจของคนที่รวมข้อมูลแล้วและยินยอมรับคำเชิญ</li>
            <li>เก็บคำตอบจากการจำลองกลับเข้าโปรไฟล์เพื่อใช้กับแคมเปญครั้งถัดไป</li>
          </ol>
        </section>
        <section aria-labelledby="pipeline-logs">
          <h3 id="pipeline-logs">บันทึกล่าสุด</h3>
          {pipelineLogs.length ? <ul className="evidence-list">{pipelineLogs.map((log) => (
            <li key={log.id}><div className="evidence-heading"><strong lang="en">{log.step}</strong><time className="muted" dateTime={log.timestamp}>{time.format(new Date(log.timestamp))}</time></div><p lang="en">{log.detail}</p><small>{Math.round(log.latencyMs)} มิลลิวินาที</small></li>
          ))}</ul> : <p className="muted">บันทึกจะปรากฏเมื่อเริ่มประมวลผลข้อมูลหรือแคมเปญ</p>}
        </section>
      </div>
    </DrawerShell>
  );
}
