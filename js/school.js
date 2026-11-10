// 학교: 같은 독서실을 여러 학교가 나눠 쓰기. 이 기기가 어느 학교인지 기억해요.
const KEY = 'aistudyroom.school';
export const DEFAULT_SCHOOL = 'SCHOOL';
function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
let cur = load();
export const school = () => cur;
export const schoolCode = () => (cur && cur.code) || DEFAULT_SCHOOL;
export const schoolName = () => (cur && cur.name) || '';
export function setSchool(s) {
  cur = s && s.code ? { code: String(s.code).toUpperCase(), name: s.name || '' } : null;
  try { cur ? localStorage.setItem(KEY, JSON.stringify(cur)) : localStorage.removeItem(KEY); } catch (e) {}
}
/** 실시간 공부방 이름: 기본 학교는 예전 방 그대로 */
export const roomId = () => (schoolCode() === DEFAULT_SCHOOL ? 'room1' : 'school-' + schoolCode());
