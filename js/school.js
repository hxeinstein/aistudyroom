// 학교: 같은 독서실을 여러 학교가 나눠 쓰기. 이 기기가 어느 학교인지 기억해요.
// 학교 코드는 여기 적지 않아요 (사이트 코드는 누구나 볼 수 있어서). 서버가 확인해 줘요.
// cur = { code, name, def(기본 학교인지) } 또는 { guest: true } (학교 코드 없이 둘러보기)
const KEY = 'aistudyroom.school';
function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
let cur = load();
export const school = () => cur;
export const isGuest = () => !!(cur && cur.guest);
export const schoolCode = () => (cur && !cur.guest && cur.code) || '';
export const schoolName = () => (cur && !cur.guest && cur.name) || '';
export function setSchool(s) {
  cur = s && s.guest ? { guest: true } : s && s.code ? { code: String(s.code).toUpperCase(), name: s.name || '', def: !!s.def } : null;
  try { cur ? localStorage.setItem(KEY, JSON.stringify(cur)) : localStorage.removeItem(KEY); } catch (e) {}
}
/** 실시간 공부방 이름: 기본 학교는 예전 방 그대로, 둘러보기는 공개 방 */
export const roomId = () => (isGuest() || !cur ? 'public' : cur.def ? 'room1' : 'school-' + cur.code);
