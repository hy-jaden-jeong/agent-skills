// onboarding 장표 마무리 스크립트. render_slide.py가 굽는 순간에 장표 끝에 넣는다.
// 하는 일: (1) Mermaid를 slide.css 색으로 그린다 (2) sankey·timebar 값을 SVG로 그린다
//          (3) 그림을 영역에 맞춘다 (4) 규칙을 어긴 곳을 찾는다.
// 결과는 document.title에 'SLIDE-REPORT:<JSON>'으로 남기고 render_slide.py가 읽는다.
(async () => {
  const MIN_FONT = 18;    // 그림 글자 최소 크기(px). 이보다 작아지면 장표를 나눠야 한다
  const MAX_SCALE = 1.4;  // 작은 그림을 키우는 한도
  const ACCENTS = ['hl', 'alt', 'bad'];  // slide.css의 강조 색
  const MAX_ACCENT_KINDS = 2;  // 한 장에 쓰는 강조 색 가짓수
  const MAX_ACCENTED = 4;      // 한 장에 칠하는 곳 수. 대응 장표가 짝 둘 × 위아래로 4곳을 쓴다
  // 표(references/slides.md "모양 고르기")에 올린 Mermaid 종류. 나머지는 색·글자 크기를 맞추지 않았다
  const MERMAID_KINDS = { flowchart: 'flowchart', graph: 'flowchart', sequenceDiagram: 'sequence', timeline: 'timeline' };
  const report = { failure: '', problems: [] };
  const counted = [];  // DOM class로 셀 수 없는 강조(timeline 칸)
  const color = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const one = sel => document.querySelector(sel);
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const ctx = document.createElement('canvas').getContext('2d');
  const textWidth = (s, px, weight = 400) => { ctx.font = `${weight} ${px}px ${color('--font')}`; return ctx.measureText(s).width; };
  const hexRgb = hex => { const n = parseInt(hex.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgbText = hex => `rgb(${hexRgb(hex).join(',')})`;
  const fmt = v => Number(v).toLocaleString('ko-KR');

  // ── sankey: "보내는 곳, 받는 곳, 값[, hl|alt|bad]" 줄로 양이 갈라지고 모이는 모습을 그린다 ──
  function drawSankey(pre) {
    const unit = pre.dataset.unit || '';
    const rows = pre.textContent.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('%%') && !s.startsWith('#'));
    const nodes = new Map(), links = [];
    const node = name => { if (!nodes.has(name)) nodes.set(name, { name, ins: [], outs: [], order: nodes.size }); return nodes.get(name); };
    rows.forEach((row, i) => {
      const f = row.split(',').map(s => s.trim());
      const where = `sankey ${i + 1}번째 줄(${row})`;
      if (f.length < 3 || f.length > 4) throw new Error(`${where}: "보내는 곳, 받는 곳, 값" 또는 끝에 ", hl"을 더한 모양으로 쓴다.`);
      const v = Number(f[2].replace(/[_\s]/g, ''));
      if (!(v > 0)) throw new Error(`${where}: 값은 0보다 큰 숫자다.`);
      if (f[3] && !ACCENTS.includes(f[3])) throw new Error(`${where}: 넷째 칸은 hl, alt, bad 중 하나다.`);
      if (f[0] === f[1]) throw new Error(`${where}: 보내는 곳과 받는 곳이 같다.`);
      const l = { s: node(f[0]), t: node(f[1]), v, accent: f[3] || '' };
      links.push(l); l.s.outs.push(l); l.t.ins.push(l);
    });
    if (!links.length) throw new Error('sankey에 흐름이 한 줄도 없다.');
    if (nodes.size > 10) report.problems.push(`sankey node가 ${nodes.size}개다. 10개까지다. 작은 흐름은 "기타"로 묶거나 장표를 나눈다.`);

    // column: 출발점에서 가장 긴 경로의 길이
    const list = [...nodes.values()];
    list.forEach(n => { n.col = 0; });
    for (let k = 0; ; k++) {
      let changed = false;
      for (const l of links) if (l.t.col < l.s.col + 1) { l.t.col = l.s.col + 1; changed = true; }
      if (!changed) break;
      if (k >= list.length) throw new Error('sankey 흐름이 돌아서 제자리로 온다(순환). 같은 이름이 앞뒤에 다 나오는지 본다.');
    }
    const sum = ls => ls.reduce((a, l) => a + l.v, 0);
    list.forEach(n => { n.value = Math.max(sum(n.ins), sum(n.outs)); });
    const nCols = Math.max(...list.map(n => n.col)) + 1;
    const cols = Array.from({ length: nCols }, (_, c) => list.filter(n => n.col === c));

    const W = pre.clientWidth, H = Math.min(pre.clientHeight, 640);
    const NODE_W = 16, GAP = 30, PAD = 16, FONT = 20;
    const ky = Math.min(...cols.map(c => (H - 2 * PAD - GAP * (c.length - 1)) / sum(c.map(n => ({ v: n.value })))));
    // 라벨은 모두 node 오른쪽에 둔다. 마지막 column 라벨이 들어갈 폭을 오른쪽에 남긴다
    const labelOf = n => ({ name: n.name, value: `${fmt(n.value)}${unit}` });
    const labelWidth = n => { const l = labelOf(n); return textWidth(l.name, FONT, 600) + 8 + textWidth(l.value, FONT); };
    const right = Math.max(...cols[nCols - 1].map(labelWidth)) + 14;
    if (right > W * 0.35) report.problems.push('sankey 마지막 단계의 라벨이 너무 길다. 이름을 줄인다.');
    const xOf = c => c * (W - right - NODE_W) / (nCols - 1);
    cols.forEach((col, c) => {
      // 앞 column에서 들어오는 흐름의 무게중심 순서로 쌓아 엇갈림을 줄인다
      if (c > 0) for (const n of col) n.key = n.ins.length ? n.ins.reduce((a, l) => a + l.v * (l.s.y + l.s.h / 2), 0) / sum(n.ins) : 1e9 + n.order;
      if (c > 0) col.sort((a, b) => (Math.abs(a.key - b.key) > 0.5 ? a.key - b.key : 0) || a.order - b.order);
      const used = col.reduce((a, n) => a + n.value * ky, 0) + GAP * (col.length - 1);
      let y = PAD + (H - 2 * PAD - used) / 2;
      for (const n of col) { n.x = xOf(c); n.y = y; n.h = n.value * ky; y += n.h + GAP; }
    });
    for (const n of list) {
      let y = n.y;
      for (const l of [...n.outs].sort((a, b) => (a.t.y - b.t.y) || (a.t.order - b.t.order))) { l.sy = y; y += l.v * ky; }
      y = n.y;
      for (const l of [...n.ins].sort((a, b) => (a.s.y - b.s.y) || (a.s.order - b.s.order))) { l.ty = y; y += l.v * ky; }
    }

    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'chart' });
    const band = l => {
      const x0 = l.s.x + NODE_W, x1 = l.t.x, xm = (x0 + x1) / 2, w = l.v * ky;
      return `M${x0},${l.sy} C${xm},${l.sy} ${xm},${l.ty} ${x1},${l.ty} L${x1},${l.ty + w} C${xm},${l.ty + w} ${xm},${l.sy + w} ${x0},${l.sy + w} Z`;
    };
    for (const l of [...links].sort((a, b) => !!a.accent - !!b.accent)) {
      const p = el('path', { d: band(l) }, svg);
      if (l.accent) { p.setAttribute('class', l.accent); p.setAttribute('style', `fill:${color(`--${l.accent}`)};fill-opacity:.42`); }
      else p.setAttribute('style', `fill:${color('--line-strong')};fill-opacity:.45`);
    }
    for (const n of list) el('rect', { x: n.x, y: n.y, width: NODE_W, height: Math.max(n.h, 2), rx: 2, style: `fill:${color('--text-dim')}` }, svg);
    for (const [c, col] of cols.entries()) {
      const last = c === nCols - 1;
      const centers = [];
      for (const n of col) {
        const { name, value } = labelOf(n), w = labelWidth(n);
        const x = n.x + NODE_W + 10, cy = n.y + n.h / 2;
        const t = el('text', { x, y: cy, 'dominant-baseline': 'central', style: `font-size:${FONT}px` }, svg);
        el('tspan', { style: `font-weight:600;fill:${color('--text')}` }, t).textContent = name + ' ';
        el('tspan', { style: `fill:${color('--text-soft')}` }, t).textContent = value;
        if (!last && xOf(c + 1) - (x + w) < 6)
          report.problems.push(`sankey 라벨 "${name} ${value}"이 다음 column까지 닿는다. 이름을 줄이거나 column(단계)을 줄인다.`);
        centers.push(cy);
      }
      for (let i = 1; i < centers.length; i++)
        if (centers[i] - centers[i - 1] < FONT + 6)
          report.problems.push(`sankey ${c + 1}번째 column의 라벨 "${col[i - 1].name}"과 "${col[i].name}"이 겹친다. 작은 흐름을 "기타"로 묶거나 node를 줄인다.`);
    }
    pre.replaceChildren(svg);
  }

  // ── timebar: "이름, 시작, 끝[, hl|alt|bad]" 줄로 실제 시간에 비례한 막대를 그린다 ──
  function drawTimebar(pre) {
    const unit = pre.dataset.unit || '';
    const lines = pre.textContent.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('%%') && !s.startsWith('#'));
    let mode = '';
    const point = (s, where) => {
      let m = s.match(/^(\d{1,2}):(\d{2})$/), kind, v;
      if (m) { kind = 'time'; v = +m[1] * 60 + +m[2]; }
      else if (/^-?\d+(\.\d+)?$/.test(s)) { kind = 'num'; v = +s; }
      else throw new Error(`${where}: "${s}"는 시각(02:30)이나 숫자로 쓴다.`);
      if (mode && mode !== kind) throw new Error(`${where}: 시각(02:30)과 숫자를 섞어 쓸 수 없다.`);
      mode = kind;
      return v;
    };
    const bars = [], marks = [];
    lines.forEach((line, i) => {
      const where = `timebar ${i + 1}번째 줄(${line})`;
      if (line.startsWith('|')) {
        const [at, ...label] = line.slice(1).split(',').map(s => s.trim());
        marks.push({ at: point(at, where), label: label.join(', ') });
        return;
      }
      const f = line.split(',').map(s => s.trim());
      if (f.length < 3 || f.length > 4) throw new Error(`${where}: "이름, 시작, 끝" 또는 끝에 ", hl"을 더한 모양으로 쓴다. 끝은 +30m처럼 길이로 써도 된다.`);
      if (f[3] && !ACCENTS.includes(f[3])) throw new Error(`${where}: 넷째 칸은 hl, alt, bad 중 하나다.`);
      const start = point(f[1], where);
      let end;
      if (f[2].startsWith('+')) {
        const t = f[2].match(/^\+(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?$/), n = f[2].match(/^\+(\d+(?:\.\d+)?)$/);
        if (mode === 'time' && !(t && (t[1] || t[2]))) throw new Error(`${where}: 시각으로 쓴 막대의 길이는 +30m, +2h, +1h20m처럼 단위를 붙인다.`);
        if (mode === 'num' && !n) throw new Error(`${where}: 숫자로 쓴 막대의 길이는 +18처럼 숫자만 쓴다.`);
        end = start + (mode === 'time' ? (+(t[1] || 0)) * 60 + (+(t[2] || 0)) : +n[1]);
      } else {
        end = point(f[2], where);
        if (mode === 'time' && end < start) end += 1440;  // 자정을 넘긴다
      }
      if (!(end > start)) throw new Error(`${where}: 끝이 시작보다 뒤여야 한다.`);
      bars.push({ name: f[0], start, end, accent: f[3] || '' });
    });
    if (!bars.length) throw new Error('timebar에 막대가 한 줄도 없다.');
    if (bars.length > 9) report.problems.push(`timebar 막대가 ${bars.length}줄이다. 9줄까지다. 짧은 것을 묶거나 장표를 나눈다.`);
    let lo = Math.min(...bars.map(b => b.start)), hi = Math.max(...bars.map(b => b.end));
    for (const m of marks) { if (mode === 'time' && m.at < lo && m.at + 1440 <= hi) m.at += 1440; lo = Math.min(lo, m.at); hi = Math.max(hi, m.at); }

    // 눈금: 8칸 안에 드는 가장 촘촘한 간격
    const range = hi - lo;
    let steps = [5, 10, 15, 30, 60, 120, 180, 240, 360, 720, 1440];
    if (mode === 'num') { const p = 10 ** Math.floor(Math.log10(range / 8 || 1)); steps = [1, 2, 5, 10, 20, 50].map(k => k * p); }
    const step = steps.find(s => range / s <= 8) || steps[steps.length - 1];
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const tickText = t => mode === 'time'
      ? `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
      : `${fmt(+t.toFixed(6))}${unit}`;
    const span = v => {
      if (mode === 'num') return `${fmt(+v.toFixed(6))}${unit}`;
      const h = Math.floor(v / 60), m = Math.round(v % 60);
      return [h && `${h}시간`, m && `${m}분`].filter(Boolean).join(' ');
    };

    const W = pre.clientWidth, H = pre.clientHeight;
    const FONT = 20, TICK = 18, ROW = 50, BAR = 32;
    const labelW = Math.max(...bars.map(b => textWidth(b.name, FONT, 600))) + 22;
    if (labelW > W * 0.4) report.problems.push('timebar 이름 칸이 그림 폭의 40%를 넘는다. 막대 이름을 줄인다.');
    const ticks = [];
    for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(t);
    const tickW = Math.max(...ticks.map(t => textWidth(tickText(t), TICK)));
    const top = marks.length ? 34 : 6, x0 = labelW, x1 = W - tickW / 2 - 4;
    const height = top + bars.length * ROW + 34;
    if (height > H) report.problems.push(`timebar가 그림 영역보다 높다(${Math.round(height)}px > ${H}px). 막대를 줄이거나 장표를 나눈다.`);
    const X = t => x0 + (t - lo) / (hi - lo) * (x1 - x0);
    if ((x1 - x0) / (ticks.length - 1) < tickW + 10) report.problems.push('timebar 눈금 글자가 서로 겹친다. 시간 범위를 줄이거나 이름 칸을 줄인다.');

    const svg = el('svg', { width: W, height, viewBox: `0 0 ${W} ${height}`, class: 'chart' });
    const bottom = top + bars.length * ROW;
    for (const t of ticks) {
      el('line', { x1: X(t), x2: X(t), y1: top, y2: bottom, style: `stroke:${color('--line')};stroke-width:1` }, svg);
      const tx = el('text', { x: X(t), y: bottom + 26, 'text-anchor': 'middle', style: `font-size:${TICK}px;fill:${color('--text-dim')}` }, svg);
      tx.textContent = tickText(t);
    }
    for (const m of marks) {
      el('line', { x1: X(m.at), x2: X(m.at), y1: top - 6, y2: bottom, style: `stroke:${color('--text-soft')};stroke-width:2;stroke-dasharray:6 5` }, svg);
      const t = el('text', { x: X(m.at), y: top - 14, 'text-anchor': 'middle', style: `font-size:${TICK}px;font-weight:600;fill:${color('--text-soft')}` }, svg);
      t.textContent = m.label || tickText(m.at);
    }
    bars.forEach((b, i) => {
      const cy = top + i * ROW + ROW / 2;
      const name = el('text', { x: x0 - 14, y: cy, 'text-anchor': 'end', 'dominant-baseline': 'central', style: `font-size:${FONT}px;font-weight:600;fill:${color('--text')}` }, svg);
      name.textContent = b.name;
      const bx = X(b.start), bw = Math.max(X(b.end) - bx, 3);
      const fill = b.accent ? color(`--${b.accent}-fill`) : color('--box');
      const stroke = b.accent ? color(`--${b.accent}`) : color('--line-strong');
      const r = el('rect', { x: bx, y: cy - BAR / 2, width: bw, height: BAR, rx: 6, style: `fill:${fill};stroke:${stroke};stroke-width:${b.accent ? 2.5 : 1.5}` }, svg);
      if (b.accent) r.setAttribute('class', b.accent);
      const label = span(b.end - b.start), lw = textWidth(label, TICK);
      let lx, anchor;
      if (bw >= lw + 16) { lx = bx + bw / 2; anchor = 'middle'; }
      else if (bx + bw + 8 + lw <= W) { lx = bx + bw + 8; anchor = 'start'; }
      else if (bx - 8 - lw >= x0) { lx = bx - 8; anchor = 'end'; }
      else { report.problems.push(`timebar "${b.name}"의 길이 글자를 둘 곳이 없다. 시간 범위를 줄인다.`); return; }
      const t = el('text', { x: lx, y: cy, 'text-anchor': anchor, 'dominant-baseline': 'central',
        style: `font-size:${TICK}px;fill:${b.accent ? color(`--${b.accent}-text`) : color('--text-soft')}` }, svg);
      t.textContent = label;
    });
    pre.replaceChildren(svg);
  }

  // ── timeline: 칠할 칸(:::hl)을 떼어 내고, 칸 색을 회색으로 맞추는 설정을 붙인다 ──
  // 아래 두 함수는 innerHTML로 읽고 쓴다. textContent로 쓰면 줄바꿈 <br>이 사라진다(Mermaid도 innerHTML을 읽는다)
  function prepareTimeline(b) {
    // timeline은 공백에서만 확실히 줄을 바꾼다(<br>은 Mermaid가 <br/>로 바꿔 글자로 나온다). <br>을 공백으로 둔다
    const lines = b.innerHTML.replace(/<br\s*\/?>/gi, ' ').split('\n');
    const sections = lines.some(l => /^\s*section\b/.test(l));
    let index = -1;
    const paint = {};
    for (const [i, line] of lines.entries()) {
      const s = line.trim();
      if (!s || /^(timeline|title|%%|acc)/.test(s)) continue;
      const isSection = /^section\b/.test(s);
      if (sections ? isSection : !s.startsWith(':')) index++;
      const m = s.match(/:::(hl|alt|bad)\b/);
      if (m) { paint[index] = m[1]; counted.push(m[1]); lines[i] = line.replace(/\s*:::(hl|alt|bad)\b/, ''); }
    }
    const vars = {};
    for (let i = 0; i < 12; i++) {
      const a = paint[i] ?? paint[i - 12];
      vars[`cScale${i}`] = a ? color(`--${a}-fill`) : color('--box');
      vars[`cScaleLabel${i}`] = color('--text');
      vars[`cScaleInv${i}`] = a ? color(`--${a}`) : color('--line-strong');
    }
    b.innerHTML = `%%{init: ${JSON.stringify({ themeVariables: vars })}}%%\n` + lines.join('\n');
  }

  // ── sequence: "rect hl" 구간을 강조 채움으로 바꾼다. 테두리는 그린 뒤에 붙인다 ──
  function prepareSequence(b) {
    // Mermaid sequence는 전역 fontSize(기본 16)로 actor·message·note 글자 크기를 덮어쓴다. 이 블록에만 20을 준다
    b.innerHTML = '%%{init: {"fontSize": 20}}%%\n' + b.innerHTML.replace(/^(\s*)rect\s+(hl|alt|bad)\s*$/gm, (_, sp, a) => `${sp}rect ${rgbText(color(`--${a}-fill`))}`);
  }
  function finishSequence(svg) {
    for (const r of svg.querySelectorAll('rect.rect')) {
      const fill = (r.getAttribute('fill') || r.style.fill || '').replace(/\s/g, '');
      const a = ACCENTS.find(x => fill === rgbText(color(`--${x}-fill`)));
      if (a) { r.classList.add(a); r.style.stroke = color(`--${a}`); r.style.strokeWidth = '2px'; }
    }
  }

  // 팔레트(회색 + 강조 세 색) 밖의 채도 높은 색. 표에 없는 Mermaid 종류의 기본 무지개색을 잡는다
  function offPalette() {
    const allowed = ['--hl', '--alt', '--bad', '--hl-text', '--alt-text', '--bad-text'].map(v => hexRgb(color(v)));
    const found = new Set();
    for (const e of document.querySelectorAll('.diagram pre.mermaid svg *')) {
      const cs = getComputedStyle(e);
      for (const c of [cs.fill, cs.stroke]) {
        const m = c && c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
        if (!m || (m[4] !== undefined && +m[4] < 0.15)) continue;
        const rgb = [+m[1], +m[2], +m[3]].map(v => v / 255);
        const mx = Math.max(...rgb), mn = Math.min(...rgb), l = (mx + mn) / 2;
        const s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
        if (s < 0.4 || l < 0.22 || l > 0.9) continue;
        if (allowed.some(a => a.reduce((d, v, i) => d + Math.abs(v - rgb[i] * 255), 0) < 60)) continue;
        found.add('#' + [m[1], m[2], m[3]].map(v => (+v | 0).toString(16).padStart(2, '0')).join(''));
      }
    }
    return [...found];
  }

  try {
    // mermaid.initialize()까지는 await 없이 간다. 그 전에 기다리면 Mermaid가 load 때 기본 설정(밝은 테마)으로 스스로 그려 버린다
    const blocks = [...document.querySelectorAll('pre.mermaid')];
    // 예전 색 이름(ok, warn)은 없앴다. Mermaid는 정의 안 된 class를 말없이 무시하므로 여기서 잡는다
    const retired = new Set();
    for (const b of blocks) for (const m of b.textContent.matchAll(/:::(ok|warn)\b/g)) retired.add(m[1]);
    for (const c of ['ok', 'warn', 'text-ok', 'text-warn']) if (document.querySelector('.' + c)) retired.add(c);
    if (retired.size)
      report.problems.push(`없는 색(${[...retired].join(', ')})을 썼다. 색은 hl(지금 볼 곳), alt(대응의 두 번째 짝), bad(진짜 문제)뿐이고, 나머지 상자는 색 없이 둔다.`);
    const kindOf = b => {
      const first = b.textContent.replace(/%%\{[\s\S]*?\}%%/g, '').split('\n').map(s => s.trim()).find(s => s && !s.startsWith('%%')) || '';
      return first.split(/\s+/)[0];
    };
    if (blocks.length) {
      if (!window.mermaid) throw new Error('Mermaid를 불러오지 못했다. 인터넷 연결을 확인한다.');
      const classDefs = ACCENTS
        .map(c => `\nclassDef ${c} fill:${color(`--${c}-fill`)},stroke:${color(`--${c}`)},color:${color('--text')}`).join('');
      for (const b of blocks) {
        const word = kindOf(b), kind = MERMAID_KINDS[word];
        b.dataset.kind = kind || word;
        // :::hl, :::alt, :::bad 를 장표마다 정의하지 않아도 되게 여기서 붙인다
        if (kind === 'flowchart') b.append(classDefs);
        else if (kind === 'timeline') prepareTimeline(b);
        else if (kind === 'sequence') prepareSequence(b);
        else if (/^(sankey|gantt)/.test(word))
          report.problems.push(`Mermaid ${word}는 쓰지 않는다. 양의 흐름은 slide-sankey.html, 시간 막대는 slide-timebar.html 견본으로 그린다.`);
      }
      mermaid.initialize({
        startOnLoad: false, theme: 'dark',
        flowchart: { useMaxWidth: false, padding: 14, nodeSpacing: 40, rankSpacing: 46, subGraphTitleMargin: { top: 4, bottom: 16 } },
        sequence: { useMaxWidth: false, mirrorActors: false, diagramMarginX: 16, actorMargin: 50, width: 160, height: 56, boxMargin: 10, messageMargin: 36, noteMargin: 10,
          actorFontSize: 20, messageFontSize: 20, noteFontSize: 20, actorFontFamily: color('--font'), messageFontFamily: color('--font'), noteFontFamily: color('--font') },
        timeline: { useMaxWidth: false, padding: 12 },
        themeVariables: {
          background: color('--bg'), primaryColor: color('--box'), primaryTextColor: color('--text'),
          primaryBorderColor: color('--line-strong'), lineColor: color('--text-dim'),
          mainBkg: color('--box'), nodeBorder: color('--line-strong'),  // 기본 상자는 회색. dark 테마 기본값은 파란 테두리라 강조가 묻힌다
          edgeLabelBackground: color('--bg'), clusterBkg: color('--box'), clusterBorder: color('--line-strong'),
          // sequence: 참여자·선·메모를 회색으로. 강조는 rect hl 구간만
          actorBkg: color('--box'), actorBorder: color('--line-strong'), actorTextColor: color('--text'),
          actorLineColor: color('--line-strong'), signalColor: color('--text-dim'), signalTextColor: color('--text'),
          labelBoxBkgColor: color('--box'), labelBoxBorderColor: color('--line-strong'), labelTextColor: color('--text'),
          loopTextColor: color('--text'), noteBkgColor: color('--panel'), noteBorderColor: color('--line-strong'),
          noteTextColor: color('--text'), activationBkgColor: color('--line'), activationBorderColor: color('--line-strong'),
          sequenceNumberColor: color('--bg'),
          fontSize: '20px', fontFamily: color('--font'),
        },
      });
      if (document.fonts) await document.fonts.ready;
      try { await mermaid.run({ nodes: blocks }); }
      catch (e) { throw new Error('Mermaid 문법 오류: ' + String((e && (e.str || e.message)) || e).split('\n').slice(0, 3).join(' | ')); }
      for (const b of blocks) if (b.dataset.kind === 'sequence' && b.querySelector('svg')) finishSequence(b.querySelector('svg'));

      // 그림을 영역에 맞춘다. 키우는 것은 MAX_SCALE까지, 줄어드는 것은 글자 크기로 판정한다
      for (const svg of document.querySelectorAll('.diagram pre.mermaid svg')) {
        const vb = svg.viewBox && svg.viewBox.baseVal;
        if (!vb || !vb.width) continue;
        const box = svg.parentElement;
        const k = Math.min(box.clientWidth / vb.width, box.clientHeight / vb.height, MAX_SCALE);
        svg.removeAttribute('width'); svg.removeAttribute('height');
        Object.assign(svg.style, { width: vb.width * k + 'px', height: vb.height * k + 'px', maxWidth: 'none', maxHeight: 'none' });
        const labels = svg.closest('pre').dataset.kind === 'sequence'
          ? [...svg.querySelectorAll('text.actor, text.messageText, text.noteText')]
          : [svg.querySelector('.nodeLabel, .node text, text')].filter(Boolean);
        const px = labels.length ? Math.min(...labels.map(l => parseFloat(getComputedStyle(l).fontSize))) * k : MIN_FONT;
        if (px < MIN_FONT - 0.5)
          report.problems.push(`그림 글자가 ${px.toFixed(1)}px로 작아진다(최소 ${MIN_FONT}px). 가로 흐름(LR)이면 세로(TB)로 바꾸거나, 상자 글을 줄이거나, 장표를 나눈다.`);
      }
      for (const svg of document.querySelectorAll('.diagram pre.mermaid[data-kind="timeline"] svg')) {
        const wide = [...svg.querySelectorAll('g.timeline-node')].flatMap(g => {
          const bg = g.querySelector('.node-bkg');
          return bg ? [...g.querySelectorAll('text')].filter(x => x.getBBox().width > bg.getBBox().width - 6).map(x => x.textContent.trim()) : [];
        });
        if (wide.length)
          report.problems.push(`timeline 칸 글자가 칸 밖으로 넘친다(${wide.slice(0, 2).join(', ')}). 칸 폭은 고정이고 공백에서만 줄이 바뀐다. 긴 이름은 user_activity_<br>daily_report처럼 나눌 곳에 <br>을 넣거나, 이름 칸이 따로 있는 slide-timebar.html을 쓴다.`);
      }
      const off = offPalette();
      if (off.length)
        report.problems.push(`그림에 팔레트 밖 색(${off.slice(0, 3).join(', ')})이 나온다. references/slides.md "모양 고르기" 표에 있는 종류를 쓰거나, 표에 더하는 절차를 따른다.`);
    }

    if (document.fonts) await document.fonts.ready;
    for (const pre of document.querySelectorAll('.diagram pre.sankey')) drawSankey(pre);
    for (const pre of document.querySelectorAll('.diagram pre.timebar')) drawTimebar(pre);

    // 색: 칠한 곳이 많으면 어디를 볼지 흐려진다. 나머지는 회색으로 두고 지금 볼 곳만 칠한다
    const accented = [...document.querySelectorAll('.diagram .hl, .diagram .alt, .diagram .bad')]
      .map(e => ACCENTS.find(c => e.classList.contains(c))).concat(counted);
    const kinds = new Set(accented);
    if (kinds.size > MAX_ACCENT_KINDS)
      report.problems.push(`강조 색을 ${kinds.size}가지(${[...kinds].join(', ')}) 썼다. ${MAX_ACCENT_KINDS}가지까지다. 색에 뜻을 하나씩 붙이지 말고, 지금 볼 곳만 hl로 칠한다.`);
    if (accented.length > MAX_ACCENTED)
      report.problems.push(`칠한 곳이 ${accented.length}곳이다. ${MAX_ACCENTED}곳까지다. 순서·종류는 번호나 글로 보이고, 색은 지금 볼 곳 1~2곳에만 쓴다.`);

    // 주석이 일찍 닫히면(주석 안의 '-->') 남은 글이 body에 떠서 줄 하나를 차지하고 그림 영역이 줄어든다
    const stray = [...document.body.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
    if (stray.length)
      report.problems.push(`장표 밖에 떠 있는 글이 있다("${stray[0].textContent.trim().slice(0, 30)}…"). 주석 안에 '-->'를 쓰면 주석이 거기서 끝난다. 주석을 고친다.`);

    // 장표 구조: 그림만 있는 장표는 쓰지 않는다
    for (const [sel, what] of [['body>h1', '제목(h1)이'], ['.diagram', '그림 영역(.diagram)이'], ['.panel', '설명 패널(.panel)이'], ['.panel .key', '핵심 문장(.key)이']])
      if (!one(sel)) report.problems.push(`${what} 없다. 견본의 구조를 그대로 쓴다.`);

    // 넘침: 글자를 줄이지 않고 글을 줄이거나 장표를 나눈다
    await new Promise(r => setTimeout(r, 50));
    for (const [sel, what, fix] of [
      ['body', '장표 전체가', '글을 줄이거나 장표를 나눈다'],
      ['body>h1', '제목이', '한 줄에 들어가게 줄인다'],
      ['body>.subtitle', '부제가', '한 줄에 들어가게 줄인다'],
      ['.diagram', '그림 영역이', '상자나 표의 줄을 줄이거나 장표를 나눈다'],
      ['.panel', '설명 패널이', '용어·읽는 법 문장을 줄이거나 장표를 나눈다'],
      ['.source', '근거 줄이', '두 줄 안으로 줄인다'],
    ]) {
      const e = one(sel);
      if (!e) continue;
      const down = e.scrollHeight - e.clientHeight, side = e.scrollWidth - e.clientWidth;
      if (down > 2 || side > 2)
        report.problems.push(`${what} 넘친다(${[down > 2 && `아래로 ${down}px`, side > 2 && `옆으로 ${side}px`].filter(Boolean).join(', ')}). ${fix}.`);
    }
    // 그림 안의 상자·표가 제 칸을 옆으로 삐져나오는 경우(overflow가 보이는 요소라 위 검사에 안 잡힌다)
    const spilled = [...document.querySelectorAll('.diagram .group, .diagram .card')].filter(e => e.scrollWidth > e.clientWidth + 2);
    if (spilled.length)
      report.problems.push(`그림 안의 상자 ${spilled.length}개에서 내용이 옆으로 삐져나온다. 표의 칸이나 값을 줄이거나 장표를 나눈다.`);
  } catch (e) {
    report.failure = String((e && e.message) || e);
  }
  document.title = 'SLIDE-REPORT:' + encodeURIComponent(JSON.stringify(report));
})();
