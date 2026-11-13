import type { UnlinkedRecord } from '../types/cdp.ts';

/*
 * Ambiguous messages with a gold answer. Every case is invented. They are used twice: the
 * sources page loads the identity cases as an "unknown author" inbox, and the AI page scores the
 * keyword rules against the model on all three sets.
 */

export interface IdentityCase extends UnlinkedRecord {
  /** The friend who wrote it, or null when nobody can be named without guessing. */
  gold: string | null;
  note: string;
}

export const IDENTITY_CASES: IdentityCase[] = [
  { id: 'fx_id_1', source: 'FACEBOOK_POST', handle: 'Fahsai T.', rawText: 'ชาบูร้านใหม่หน้ามอ น้ำซุปเข้มมาก ไปอีกได้เลย', timestamp: '2026-11-10T19:20:00+07:00', gold: 'prof_02', note: 'ชื่ออังกฤษย่อของ Fahsai Thanaporn ไม่ตรงกับชื่อที่เคยพบทุกตัวอักษร' },
  { id: 'fx_id_2', source: 'FACEBOOK_POST', handle: 'Pitchaya A.', rawText: 'ตื่นเช้ามาวิ่ง 10K ที่สวน อากาศดีมาก', timestamp: '2026-11-10T06:40:00+07:00', gold: 'prof_04', note: 'สะกด Pitchaya ต่างจาก Phitchaya Asawa หนึ่งตัวอักษร' },
  { id: 'fx_id_3', source: 'LINE_CHAT', handle: 'Mook', rawText: 'มัทฉะเย็นร้านเดิมไหม เดี๋ยวไปรอ', timestamp: '2026-11-10T16:05:00+07:00', gold: 'prof_05', note: 'Mook คือ มุก และบริบทมัทฉะตรงกับ mook_matcha' },
  { id: 'fx_id_4', source: 'FACEBOOK_POST', handle: 'ธนพร ส.', rawText: 'ฝากบอกทุกคนด้วย ศุกร์นี้ไปหมูกระทะกันนะ', timestamp: '2026-11-09T21:10:00+07:00', gold: 'prof_02', note: 'ชื่อไทยย่อ เทียบกับชื่อจริงได้' },
  { id: 'fx_id_5', source: 'LINE_CHAT', handle: 'นายสิรวิชญ์ ม.', rawText: 'ลงทะเบียนชมรมเรียบร้อยแล้วครับ', timestamp: '2026-11-09T13:00:00+07:00', gold: 'prof_08', note: 'ชื่อไทยตรงกับชื่อจริง จับคู่ชื่อได้' },
  { id: 'fx_id_6', source: 'FACEBOOK_POST', handle: 'Boss', rawText: 'เนื้อสามชั้นจานนี้คือที่สุด', timestamp: '2026-11-08T20:30:00+07:00', gold: 'prof_01', note: 'Boss เขียนอังกฤษ ตรงกับ บอส และ Boss_99' },
  { id: 'fx_id_7', source: 'FACEBOOK_POST', handle: 'Thanakrit P.', rawText: 'ไม่เอาโปรโมชั่นหรือข้อความชวนนะ ขอพักก่อน', timestamp: '2026-11-08T11:15:00+07:00', gold: 'prof_15', note: 'รู้ว่าเป็นโอ๊ต แต่โอ๊ตไม่ยินยอม การจับคู่ไม่ทำให้ยินยอมรับคำเชิญ' },
  { id: 'fx_id_8', source: 'LINE_CHAT', handle: 'Nattapong K.', rawText: 'ไปด้วยครับ เดี๋ยวตามไป', timestamp: '2026-11-07T18:45:00+07:00', gold: null, note: 'Nattapong K. อาจเป็น ณัฐพงศ์ แก้วมณี หรือ รัฐพงษ์ กิตติคุณ ชื่อและตัวย่อใกล้กัน ต้องไม่เดา' },
  { id: 'fx_id_9', source: 'LINE_CHAT', handle: 'bonbon', rawText: 'ใครเปิดคอร์สติวสถิติบ้าง ขอลิงก์หน่อย', timestamp: '2026-11-07T09:20:00+07:00', gold: null, note: 'ไม่ใช่เพื่อนในรายชื่อ' },
];

export interface ReplyCase {
  id: string;
  reply: string;
  gold: { status: 'accepted' | 'declined' | 'pending'; hasCondition: boolean };
  note: string;
}

export const REPLY_CASES: ReplyCase[] = [
  { id: 'fx_re_1', reply: 'ได้เลย ไปด้วยครับ', gold: { status: 'accepted', hasCondition: false }, note: 'ตอบรับตรง ๆ' },
  { id: 'fx_re_2', reply: 'ขอผ่านนะ ช่วงนี้ปั่นธีสิสหนักมาก', gold: { status: 'declined', hasCondition: false }, note: 'ปฏิเสธตรง ๆ พร้อมเหตุผล' },
  { id: 'fx_re_3', reply: 'ไปได้แต่ขอเลื่อนเป็นสัปดาห์หน้านะ', gold: { status: 'pending', hasCondition: true }, note: 'พูดว่า "ไปได้" แต่ขอเลื่อน ยังไม่ใช่ตอบรับวันที่เสนอ' },
  { id: 'fx_re_4', reply: 'เดี๋ยวดูก่อนนะ', gold: { status: 'pending', hasCondition: false }, note: 'ยังไม่ตัดสินใจ' },
  { id: 'fx_re_5', reply: 'จะไม่ไปได้ไง หมูกระทะเลยนะ', gold: { status: 'accepted', hasCondition: false }, note: 'ปฏิเสธซ้อนปฏิเสธ แปลว่าไป' },
  { id: 'fx_re_6', reply: 'งบตึงอ่ะ ถ้าไม่เกิน 200 ไปแน่', gold: { status: 'pending', hasCondition: true }, note: 'ตอบรับแบบมีเงื่อนไขเรื่องงบ' },
  { id: 'fx_re_7', reply: '555 ไปดิ', gold: { status: 'accepted', hasCondition: false }, note: 'ภาษาพูด' },
  { id: 'fx_re_8', reply: 'ขอบคุณที่ชวนนะ', gold: { status: 'pending', hasCondition: false }, note: 'ขอบคุณแต่ไม่ได้ตอบ' },
];

export interface SignalCase {
  id: string;
  text: string;
  /** Interest ids from the extraction taxonomy that the writer really has, and ones they reject. */
  gold: { likes: string[]; dislikes: string[] };
  note: string;
}

export const SIGNAL_CASES: SignalCase[] = [
  { id: 'fx_sg_1', text: 'เลิกกินหมูกระทะแล้ว ตอนนี้คุมอาหาร', gold: { likes: [], dislikes: ['mookata'] }, note: 'เลิกแล้ว ไม่ใช่ความสนใจ' },
  { id: 'fx_sg_2', text: 'ไม่ชอบทะเลเลย แดดร้อน ชอบเดินป่ามากกว่า', gold: { likes: ['hiking'], dislikes: ['beach'] }, note: 'ปฏิเสธอย่างหนึ่ง เลือกอีกอย่าง' },
  { id: 'fx_sg_3', text: 'ชาบูหรือหมูกระทะก็ได้ ขอแค่มีชีส', gold: { likes: ['mookata'], dislikes: [] }, note: 'ตอบสนองตรง ๆ' },
  { id: 'fx_sg_4', text: 'เมื่อวานไปหมูกระทะมา อร่อยมาก ไปอีกได้นะ', gold: { likes: ['mookata'], dislikes: [] }, note: 'ชอบ' },
  { id: 'fx_sg_5', text: 'มีคนโทรมาชวนไปดำน้ำ รำคาญมาก ไม่รับสายแล้ว', gold: { likes: [], dislikes: [] }, note: 'รำคาญสายโทร ไม่ได้พูดถึงความชอบเรื่องดำน้ำ' },
  { id: 'fx_sg_6', text: 'เสาร์นี้ใครไปเขาใหญ่บ้าง ขอตามไปด้วยคน', gold: { likes: ['hiking'], dislikes: [] }, note: 'ขอไปด้วย' },
  { id: 'fx_sg_7', text: 'ช่วงนี้ปลายเดือนช็อต ขอตี้งบไม่เกิน 200', gold: { likes: ['budget_tight'], dislikes: [] }, note: 'บอกข้อจำกัดด้านงบของตัวเอง' },
];
