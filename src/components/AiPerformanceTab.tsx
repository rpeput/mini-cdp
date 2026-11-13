import { Check, FlaskConical, Gauge, Minus, RotateCcw, X } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { INITIAL_PROFILES, RAW_SOURCE_RECORDS } from '../data/seedData.ts';
import { type EvalSuite, runEvaluation } from '../services/ai/evaluation.ts';
import { clearAiCalls, getAiCalls, subscribeAiCalls, summarizeAiCalls } from '../services/aiMetrics.ts';
import type { AiAction } from '../types/cdp.ts';

const TASK_LABELS: Record<AiAction, string> = {
  stitch: 'รวมข้อมูลเพื่อน',
  segment: 'แนะนำคนที่น่าจะไป',
  simulate_replies: 'จำลองคำตอบของเพื่อน',
  resolve_identity: 'หาว่าข้อความเป็นของใคร',
  extract_signal: 'อ่านว่าเพื่อนชอบอะไร',
  classify_reply: 'อ่านคำตอบที่เพื่อนส่งมา',
  parse_brief: 'อ่านโจทย์แคมเปญ',
  check_invites: 'ตรวจข้อความชวน',
  summarize_campaign: 'สรุปผลแคมเปญ',
  parse_search: 'แปลงคำถามเป็นตัวกรอง',
};

const number = new Intl.NumberFormat('th-TH');
const seconds = (ms: number | null) => (ms === null ? '—' : ms < 1000 ? 'ไม่ถึง 1 วินาที' : `${(ms / 1000).toFixed(1)} วินาที`);
const noPrices = { input: null, output: null };

function Verdict({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="verdict verdict-none"><Minus size={14} aria-hidden="true" /><span className="sr-only">ไม่ได้ตอบ</span></span>;
  return ok
    ? <span className="verdict verdict-ok"><Check size={14} aria-hidden="true" /><span className="sr-only">ถูก</span></span>
    : <span className="verdict verdict-bad"><X size={14} aria-hidden="true" /><span className="sr-only">ผิด</span></span>;
}

export function AiPerformanceTab() {
  const calls = useSyncExternalStore(subscribeAiCalls, getAiCalls);
  const [suites, setSuites] = useState<EvalSuite[] | null>(null);
  const [running, setRunning] = useState(false);
  const rows = summarizeAiCalls(calls, noPrices);

  async function run() {
    if (running) return;
    setRunning(true);
    try {
      // The test always uses the original friend list, so the score does not change as you edit the demo.
      setSuites(await runEvaluation(INITIAL_PROFILES, RAW_SOURCE_RECORDS));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section aria-labelledby="ai-title">
      <header className="page-heading">
        <div><h1 id="ai-title">AI ช่วยอะไรในแอปนี้</h1><p>ดูว่า AI ช่วยงานไหนไปแล้วบ้าง และลองเทียบกับวิธีเดิมที่ใช้กฎง่าย ๆ ว่าใครตอบถูกกว่า</p></div>
      </header>

      <div className="surface panel">
        <div className="response-heading">
          <div><h2><Gauge size={19} aria-hidden="true" /> สิ่งที่ AI ช่วยไปแล้ว</h2><p>นับจากสิ่งที่คุณลองใช้ในแท็บนี้</p></div>
          {rows.length > 0 && <button className="button button-light" onClick={clearAiCalls}><RotateCcw size={16} aria-hidden="true" /> เริ่มนับใหม่</button>}
        </div>
        {rows.length ? (
          <>
            <div className="metrics-scroll">
              <table className="metrics-table">
                <caption className="sr-only">สิ่งที่ AI ช่วยแยกตามงาน</caption>
                <thead><tr><th scope="col">งาน</th><th scope="col">ใช้กี่ครั้ง</th><th scope="col">AI ตอบได้</th><th scope="col">ใช้วิธีสำรองแทน</th><th scope="col">ใช้เวลาปกติ</th></tr></thead>
                <tbody>{rows.map((row) => (
                  <tr key={row.action}>
                    <th scope="row">{TASK_LABELS[row.action]}</th>
                    <td>{row.calls}</td>
                    <td>{row.model}</td>
                    <td>{row.unavailable + row.invalid}</td>
                    <td>{seconds(row.p50)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="muted">วิธีสำรองคือให้ระบบใช้กฎง่าย ๆ ในเครื่องแทน เมื่อ AI ยังไม่พร้อมหรือตอบมาในรูปแบบที่ใช้ไม่ได้ งานของคุณเดินต่อได้เสมอ</p>
            <details className="tech-details">
              <summary>รายละเอียดสำหรับผู้พัฒนา</summary>
              <div className="metrics-scroll">
                <table className="metrics-table">
                  <caption className="sr-only">รายละเอียดทางเทคนิคแยกตามงาน</caption>
                  <thead><tr><th scope="col">งาน</th><th scope="col">ช้าสุด 5% แรก (p95)</th><th scope="col">token เข้า</th><th scope="col">token ออก</th><th scope="col">ตอบผิดรูปแบบ</th></tr></thead>
                  <tbody>{rows.map((row) => (
                    <tr key={row.action}>
                      <th scope="row">{TASK_LABELS[row.action]}</th>
                      <td>{row.p95 === null ? '—' : `${number.format(row.p95)} ms`}</td>
                      <td>{number.format(row.inputTokens)}</td>
                      <td>{number.format(row.outputTokens)}</td>
                      <td>{row.invalid}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {calls.some((call) => call.estimated) && <p className="muted">บางแถวใช้ตัวเลข token ที่ประมาณจากความยาวข้อความ เพราะบริการ AI ไม่ได้ส่งตัวเลขจริงมา</p>}
            </details>
          </>
        ) : <div className="empty"><Gauge aria-hidden="true" /><h3>ยังไม่ได้ใช้ AI ในรอบนี้</h3><p>ลองกด “แนะนำผู้รับคำเชิญ” หรือ “ให้ AI อ่านโจทย์” ในหน้าสร้างแคมเปญ แล้วกลับมาดูที่นี่</p></div>}
      </div>

      <div className="surface panel eval-panel">
        <div className="response-heading">
          <div><h2><FlaskConical size={19} aria-hidden="true" /> ลองทดสอบกับข้อความที่ตีความยาก</h2><p>24 ข้อความตัวอย่างที่เรารู้เฉลยอยู่แล้ว ให้ทั้งวิธีเดิมและ AI ตอบ แล้วดูว่าใครถูกกว่า</p></div>
          <button className="button button-primary" disabled={running} onClick={run}>{running ? 'กำลังทดสอบ…' : suites ? 'ทดสอบอีกครั้ง' : 'เริ่มทดสอบ'}</button>
        </div>
        {!suites && <p className="muted">วิธีเดิมคือกฎง่าย ๆ เช่น เห็นคำว่า “หมูกระทะ” ก็ถือว่าชอบหมูกระทะ ซึ่งพลาดได้เมื่อเพื่อนพิมพ์ว่า “เลิกกินหมูกระทะแล้ว” การทดสอบนี้เรียก AI 16 ครั้ง</p>}
        {suites?.map((suite) => (
          <details key={suite.key} className="eval-suite" open>
            <summary>
              <strong>{suite.title}</strong>
              <span className="chip">วิธีเดิมถูก {suite.rulesCorrect} จาก {suite.cases.length}</span>
              <span className={`chip ${suite.modelCorrect === null ? 'chip-waiting' : 'chip-positive'}`}>{suite.modelCorrect === null ? 'AI ยังไม่ตอบ' : `AI ถูก ${suite.modelCorrect} จาก ${suite.modelAnswered}`}</span>
            </summary>
            <p className="muted">{suite.question}</p>
            <div className="metrics-scroll">
              <table className="metrics-table eval-table">
                <caption className="sr-only">{suite.title}: เทียบเฉลย วิธีเดิม และ AI</caption>
                <thead><tr><th scope="col">ข้อความ</th><th scope="col">เฉลย</th><th scope="col">วิธีเดิม</th><th scope="col">AI</th></tr></thead>
                <tbody>{suite.cases.map((item) => (
                  <tr key={item.id}>
                    <th scope="row"><span>{item.input}</span><small className="muted">{item.note}</small></th>
                    <td>{item.gold}</td>
                    <td><Verdict ok={item.rulesOk} /> {item.rules}</td>
                    <td><Verdict ok={item.modelOk} /> {item.model ?? 'ยังไม่ตอบ'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </details>
        ))}
        {suites && suites.every((suite) => suite.modelCorrect === null) && (
          <p className="muted" role="status">ตอนนี้ AI ยังไม่ตอบ จึงเห็นแค่คะแนนของวิธีเดิม ถ้าคุณเป็นผู้พัฒนา ให้ตั้งค่า <code>LLM_API_KEY</code> ให้บริการ AI ก่อน แล้วทดสอบอีกครั้ง</p>
        )}
      </div>
    </section>
  );
}
