let values = [1.4, 2.1, 0.9];
let mode = 'symbolic';
let lastOrder = null;
let lastVisual = null;

async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'error de servidor');
  return data;
}

// ---------- entrada de valores ----------
function renderVals() {
  const c = document.getElementById('vals');
  c.innerHTML = '';
  values.forEach((v, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `<input type="number" step="any" value="${v}"><button title="quitar">×</button>`;
    chip.querySelector('input').addEventListener('input', e => {
      values[i] = parseFloat(e.target.value) || 0;
      refreshOrder();
    });
    chip.querySelector('button').addEventListener('click', () => {
      if (values.length > 1) { values.splice(i, 1); renderVals(); refreshOrder(); }
    });
    c.appendChild(chip);
  });
}
document.getElementById('addVal').addEventListener('click', () => {
  values.push(1); renderVals(); refreshOrder();
});

// ---------- tabs ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    document.getElementById('viewPanel').style.display = view === 'panel' ? '' : 'none';
    document.getElementById('viewFigura').style.display = view === 'figura' ? '' : 'none';
    if (view === 'figura' && lastVisual) renderFigure(lastVisual);
  });
});

document.querySelectorAll('.modebtn').forEach(btn => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('.modebtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    refreshVisual();
  });
});

// ---------- panel: orden dinámico + gráficas ----------
async function refreshOrder() {
  try {
    const data = await api('/api/order', { values });
    lastOrder = data;
    document.getElementById('roN').textContent = data.n;
    document.getElementById('roL').textContent = data.L.toFixed(3);
    document.getElementById('roPow').textContent = isFinite(data.power) ? data.power.toFixed(3) : '∞';
    document.getElementById('roRoot').textContent = isFinite(data.root) ? data.root.toFixed(3) : '∞';
    document.getElementById('readingText').textContent =
      `Con n=${data.n} valores, L≈${data.L.toFixed(2)}: L^n≈${isFinite(data.power) ? data.power.toFixed(2) : '∞'}, ` +
      `ⁿ√L≈${isFinite(data.root) ? data.root.toFixed(3) : '∞'}.`;
    drawCurve(data);
    drawFall(data);
  } catch (err) {
    document.getElementById('readingText').textContent = 'Error: ' + err.message;
  }
  // la figura también depende de `values` (n, L) — sin esto, cambiar los
  // valores de entrada no movía nada si ya se había evaluado continuidad
  // una vez antes; ahora cualquier cambio (valores o funciones) refresca
  // la figura de punta a punta.
  refreshVisual();
}

// ---------- continuidad → figura: un solo camino de refresco ----------
let visualDebounce = null;
function refreshVisual() {
  clearTimeout(visualDebounce);
  visualDebounce = setTimeout(async () => {
    const left = document.getElementById('fLeft').value;
    const center = document.getElementById('fCenter').value;
    const right = document.getElementById('fRight').value;
    const point = document.getElementById('point').value;
    try {
      const visual = await api('/api/visual', { values, left, center, right, point, mode });
      lastVisual = visual;
      document.getElementById('sourceTag').innerHTML = `<b>fuente</b> = ${visual.source}`;
      if (document.getElementById('viewFigura').style.display !== 'none') renderFigure(visual);
    } catch (err) {
      document.getElementById('sourceTag').innerHTML = `<b>fuente</b> = error (${err.message})`;
    }
  }, 150);
}
['fLeft', 'fCenter', 'fRight', 'point'].forEach(id => {
  document.getElementById(id).addEventListener('input', refreshVisual);
});

function tk() {
  const st = getComputedStyle(document.documentElement);
  return {
    line: st.getPropertyValue('--line').trim(),
    accent: st.getPropertyValue('--accent').trim(),
    alert: st.getPropertyValue('--alert').trim(),
    text: st.getPropertyValue('--text').trim(),
    muted: st.getPropertyValue('--muted').trim(),
  };
}

function drawCurve(data) {
  const cv = document.getElementById('curve'), ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height, pad = 34, t = tk();
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = t.line; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, h - pad); ctx.lineTo(w - 10, h - pad); ctx.moveTo(pad, 10); ctx.lineTo(pad, h - pad); ctx.stroke();
  const maxL = 3, steps = 140; let maxY = 0; const pts = [];
  for (let i = 0; i <= steps; i++) { const L = (i / steps) * maxL; const y = Math.pow(L, data.n); pts.push([L, y]); if (isFinite(y)) maxY = Math.max(maxY, y); }
  maxY = maxY || 1;
  ctx.strokeStyle = t.accent; ctx.lineWidth = 2; ctx.beginPath();
  pts.forEach(([L, y], i) => { const px = pad + (L / maxL) * (w - pad - 20); const py = h - pad - (Math.min(y, maxY) / maxY) * (h - pad - 20); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
  ctx.stroke();
}

function drawFall(data) {
  const cv = document.getElementById('fall'), ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height, pad = 34, t = tk();
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = t.line; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, 10); ctx.lineTo(pad, h - pad); ctx.lineTo(w - 10, h - pad); ctx.stroke();
  let maxD = 0; const pts = data.series.map(p => { if (isFinite(p.d)) maxD = Math.max(maxD, p.d); return [p.t, p.d]; });
  maxD = maxD || 1;
  const tmax = data.series[data.series.length - 1].t || 1;
  ctx.strokeStyle = t.accent; ctx.lineWidth = 2; ctx.beginPath();
  pts.forEach(([time, d], i) => { const px = pad + (time / tmax) * (w - pad - 20); const py = 10 + (Math.min(d, maxD) / maxD) * (h - pad - 20); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
  ctx.stroke();
}

// ---------- continuidad: panel de detalle (la figura ya se refresca sola vía refreshVisual) ----------
document.getElementById('evalBtn').addEventListener('click', async () => {
  const left = document.getElementById('fLeft').value;
  const center = document.getElementById('fCenter').value;
  const right = document.getElementById('fRight').value;
  const point = document.getElementById('point').value;
  const box = document.getElementById('result');
  try {
    const cont = await api('/api/continuity', { left, center, right, point, mode });
    box.style.display = 'block';
    box.className = 'result ' + (cont.is_continuous ? 'ok' : 'bad');
    const warn = (cont.domain_warnings && cont.domain_warnings.length)
      ? `<div style="margin-top:6px;color:var(--alert);">⚠ ${cont.domain_warnings.join('<br>⚠ ')}</div>` : '';
    box.innerHTML = `<div class="verdict">${cont.is_continuous ? '✓ Continua' : '✗ Discontinua'} en x = ${cont.x}</div>` +
      `f_izq = ${cont.f_x_left}<br>f(x) = ${cont.f_x}<br>f_der = ${cont.f_x_right}` +
      `<div style="margin-top:6px;opacity:.85;">${cont.detail.join('<br>')}</div>` + warn;
  } catch (err) {
    box.style.display = 'block';
    box.className = 'result bad';
    box.innerHTML = `<div class="verdict">Error</div>${err.message}`;
  }
  refreshVisual();
});

function renderFigure(state) {
  drawAbstract(state);
  drawCute(state);
}

// ---------- caja abstracta: prisma de alambre, proyección 3D a mano ----------
let rafA = null, tA = 0;
function rotateY(p, a) { const [x, y, z] = p; return [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)]; }
function rotateX(p, a) { const [x, y, z] = p; return [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)]; }
function project(p, cx, cy, scale, focal) {
  const [x, y, z] = p; const f = focal / (focal + z);
  return [cx + x * f * scale, cy + y * f * scale];
}

function drawAbstract(state) {
  const cv = document.getElementById('abstractBox');
  const box = cv.parentElement;
  cv.width = box.clientWidth; cv.height = box.clientHeight;
  const ctx = cv.getContext('2d');
  const t = tk();
  const color = state.stable ? t.accent : t.alert;
  const verts2d = state.vertices; // [[x,y], ...] sobre círculo unitario
  const depth = 0.55;
  const top = verts2d.map(([x, y]) => [x, y, depth]);
  const bottom = verts2d.map(([x, y]) => [x, y, -depth]);
  const sizeScale = 0.55 + Math.min(1.3, state.L / 4);

  const blurPx = Math.max(0, Math.min(5, state.instability * 0.7));

  if (rafA) cancelAnimationFrame(rafA);
  function frame() {
    tA += 0.012;
    const wobble = state.stable ? 0 : Math.sin(tA * 7) * 0.12 * Math.min(1, state.instability / 3);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.filter = blurPx > 0.1 ? `blur(${blurPx.toFixed(1)}px)` : 'none';
    const cx = cv.width / 2, cy = cv.height / 2;
    const scale = Math.min(cv.width, cv.height) * 0.34 * sizeScale;
    const focal = 3.2;
    const project3 = (p) => {
      let q = rotateY(p, tA * 0.6);
      q = rotateX(q, 0.35 + wobble);
      return project(q, cx, cy, scale, focal);
    };
    const topP = top.map(project3);
    const botP = bottom.map(project3);
    ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.95;
    const drawRing = (pts) => { ctx.beginPath(); pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.stroke(); };
    drawRing(topP); drawRing(botP);
    ctx.globalAlpha = 0.55;
    topP.forEach((p, i) => { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(botP[i][0], botP[i][1]); ctx.stroke(); });
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    topP.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 2.2, 0, Math.PI * 2); ctx.fill(); });
    rafA = requestAnimationFrame(frame);
  }
  frame();
}

// ---------- caja simpática: criatura 2D — desenfoque + sonrisa como lectura de la señal ----------
// Nada de gestos sueltos: el mismo número (state.instability) controla el
// desenfoque (ctx.filter, el mismo tipo de "blur" que ya todos asocian a una
// señal con interferencia) y la curvatura de la boca (sonrisa <-> mueca).
let rafC = null, tC = 0;
function drawCute(state) {
  const cv = document.getElementById('cuteBox');
  const box = cv.parentElement;
  cv.width = box.clientWidth; cv.height = box.clientHeight;
  const ctx = cv.getContext('2d');
  const t = tk();
  const color = state.stable ? t.accent : t.alert;
  const sides = state.vertices.length;
  const baseR = Math.min(cv.width, cv.height) * 0.22 * (0.6 + Math.min(1.2, state.L / 4));
  const jitterAmp = state.stable ? 2 : Math.min(14, 3 + state.instability * 3);
  // 0 = señal limpia (nítida), más alto = más interferencia (más borrosa)
  const blurPx = Math.max(0, Math.min(9, state.instability * 1.4));
  // +1 sonríe (señal limpia), -1 hace mueca (señal degradada)
  const smileFactor = Math.max(-1, Math.min(1, 1 - state.instability * 0.45));

  if (rafC) cancelAnimationFrame(rafC);
  function frame() {
    tC += state.stable ? 0.02 : 0.08;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const cx = cv.width / 2, cy = cv.height / 2;
    const jitter = Math.sin(tC * 6) * jitterAmp;

    ctx.save();
    ctx.filter = blurPx > 0.1 ? `blur(${blurPx.toFixed(1)}px)` : 'none';

    // cuerpo
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const wob = Math.sin(tC + i * 1.7) * (state.stable ? 3 : 10);
      const r = baseR + wob + (i % 2 ? jitter : -jitter);
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color + '33';
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.fill(); ctx.stroke();

    // ojos
    ctx.fillStyle = t.text;
    const eyeOff = baseR * 0.32;
    [-1, 1].forEach(side => {
      ctx.beginPath();
      ctx.arc(cx + side * eyeOff, cy - baseR * 0.18 + (state.stable ? 0 : jitter * 0.3), 4.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // boca: sonrisa (cóncava hacia abajo) <-> mueca (hacia arriba), según smileFactor
    const mw = baseR * 0.3, my = cy + baseR * 0.28;
    const curve = smileFactor * baseR * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx - mw, my);
    ctx.quadraticCurveTo(cx, my + curve, cx + mw, my);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = t.text;
    ctx.stroke();

    ctx.restore();
    rafC = requestAnimationFrame(frame);
  }
  frame();
}

renderVals();
refreshOrder();