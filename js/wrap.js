// 그림(캔버스)에 글을 쓸 때 줄바꿈: 단어 단위로 (한 단어가 한 줄보다 길 때만 글자 단위)
export function wrapLines(ctx, text, max) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let cur = '';
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      const next = cur + word;
      if (ctx.measureText(next).width <= max) { cur = next; continue; }
      if (cur.trim()) { lines.push(cur.trimEnd()); cur = ''; }
      if (/^\s+$/.test(word)) continue;
      // 한 단어가 너무 길면 글자 단위로 나눔
      if (ctx.measureText(word).width > max) {
        for (const ch of word) { if (ctx.measureText(cur + ch).width > max && cur) { lines.push(cur); cur = ch; } else cur += ch; }
      } else cur = word;
    }
    lines.push(cur.trimEnd());
  }
  return lines;
}
