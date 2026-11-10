// 모두에게 보이는 글(목표·게시판)에서 거르는 낱말 (Office.gs의 BAD_WORDS와 같게)
export const BAD_WORDS = ['시발', '씨발', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '개새', '좆', '존나', 'ㅈㄴ', '꺼져', '죽어', '닥쳐', '미친놈', '미친년', '애미', '느금', 'fuck', 'shit', 'bitch'];
export const badWord = (t) => { const x = String(t || '').toLowerCase().replace(/\s/g, ''); return BAD_WORDS.some((w) => x.includes(w)); };
