let values = [1.4, 2.1, 0.9];
let mode = 'symbolic';
let lastOrder = null;
let lastVisual = null;
let lastChart = null;   // { left_points, right_points, continuity } de /api/chart
let lastParam = null;   // último parámetro resuelto (k, m, a, c...), si se usó
let activeExample = null;   // ejemplo guiado de telecom activo, si hay uno (solo narrativa, no cambia el cálculo)

// ---------- definiciones de tipo de discontinuidad ----------
// Un solo lugar para el texto pedagógico: tanto updateResultsText() como
// updateChartCaption() leen de aquí, así que la explicación nunca se
// desincroniza entre la gráfica y el panel de resultados. La clasificación
// (classifyContinuity) usa EXACTAMENTE la misma comparación que ya hace
// drawCartesian() con los valores que entrega continuity_engine — no es
// una segunda lógica independiente, solo se reutiliza el criterio.
const DISCONTINUITY_INFO = {
  continua: {
    titulo: 'Continua',
    definicion: 'El límite por la izquierda, el límite por la derecha y el valor de la función coinciden exactamente en ese punto: no hay salto, hueco ni asíntota.',
    telecom: 'Equivale, en una red o un canal de datos, a una transición perfectamente suave — por ejemplo una señal que se atenúa gradualmente con la distancia, sin cortes ni saltos abruptos de nivel.',
  },
  salto: {
    titulo: 'Discontinuidad de salto',
    definicion: 'Los límites laterales existen (son números finitos) pero son distintos entre sí: la función "salta" de un valor a otro sin pasar por los valores intermedios. No es un hueco que se pueda tapar con un solo punto — son dos alturas distintas.',
    telecom: 'Es el mismo patrón que un cambio brusco de tarifa al cruzar un umbral de consumo, un cambio de estado digital (de 0 a 1 sin transición), o una reconexión que pasa de golpe de "sin señal" a "señal completa".',
  },
  removible: {
    titulo: 'Discontinuidad removible',
    definicion: 'El límite SÍ existe (los dos límites laterales coinciden entre sí), pero el valor que la función tiene definido exactamente en ese punto no coincide con ese límite. Es un "hueco" que se repara redefiniendo f(x0) para que sea igual al límite.',
    telecom: 'Corresponde, por ejemplo, a una lectura de sensor mal calibrada o a un dato puntual corrupto en un flujo que, de otro modo, se comporta de forma perfectamente predecible.',
  },
  infinita: {
    titulo: 'Discontinuidad infinita (asíntota vertical)',
    definicion: 'Al menos uno de los límites laterales crece sin límite (tiende a infinito). No existe ningún valor finito que se le pueda asignar a la función ahí para "arreglarla": el problema no es un hueco, es que la función se dispara.',
    telecom: 'Modela, por ejemplo, el límite físico de alcance de una antena o el punto de saturación de un canal: más allá de ese umbral, el modelo matemático señala el borde de su propio dominio de validez.',
  },
};

function classifyContinuity(cont) {
  if (!cont) return null;
  const isNum = v => typeof v === 'number' && isFinite(v);
  if (cont.is_continuous) return 'continua';
  if (!isNum(cont.f_x_left) || !isNum(cont.f_x_right)) return 'infinita';
  if (Math.abs(cont.f_x_left - cont.f_x_right) < 1e-6) return 'removible';
  return 'salto';
}

// ---------- ejemplos guiados (contexto de redes y análisis de datos) ----------
// Puro frontend: solo rellenan las mismas cajas que ya existen y disparan
// el mismo flujo de siempre (refreshVisual / solveParameter). Ningún motor
// nuevo, ninguna ruta nueva — es la capa narrativa que pidió la profesora.
const GUIDED_EXAMPLES = [
  {
    id: 'tarifa-salto',
    label: 'Tarifa de datos por tramo (salto)',
    kind: 'direct',
    left: '10*x', center: '10*x+200', right: '10*x+200', point: '50',
    context: 'Costo de un plan de datos que cobra 10 por GB hasta 50 GB, pero a partir de ahí se suma un cargo fijo de 200 por superar la cuota: un salto real de tarifa, igual que la Figura 16 de la guía (costo de red).',
  },
  {
    id: 'sensor-removible',
    label: 'Sensor IoT descalibrado (removible)',
    kind: 'direct',
    left: '(x**2-9)/(x-3)', center: '10', right: '(x**2-9)/(x-3)', point: '3',
    context: 'Un sensor de temperatura en una red de telemetría debería acercarse suavemente a 6° al pasar por x=3, pero un error de calibración registró 10° justo en ese instante: un "hueco" puntual, no un cambio real de comportamiento del sistema.',
  },
  {
    id: 'antena-infinita',
    label: 'Alcance máximo de una antena (infinita)',
    kind: 'direct',
    left: '1/(x-10)', center: '0', right: '1/(x-10)', point: '10',
    context: 'Modelo simplificado de la potencia de señal requerida en función de la distancia a una antena: al acercarse al límite teórico de alcance (x=10), la potencia requerida crece sin límite — el modelo señala el borde de su propio dominio de validez, no un valor físico real.',
  },
  {
    id: 'tarifa-param',
    label: 'Umbral de tarifa con parámetro k',
    kind: 'jump-param',
    left: 'x**2-4', right: 'k*x+1', point: '2', param_name: 'k',
    context: 'Un operador quiere que el costo no salte al cruzar el umbral de 2 Mbps de consumo: hay que hallar la pendiente k de la tarifa después del umbral para que la transición sea continua.',
  },
  {
    id: 'enlace-param',
    label: 'Indicador de enlace con parámetro m',
    kind: 'removable-param',
    expr: '(x**2-9)/(x-3)', point: '3', param_name: 'm',
    context: 'Un indicador de calidad de enlace tiene un hueco de medición exactamente en x=3: hay que hallar el valor m que habría que registrar ahí para que el indicador sea continuo con el resto de la serie.',
  },
];

function renderExampleButtons() {
  const wrap = document.getElementById('exampleBtns');
  wrap.innerHTML = '';
  GUIDED_EXAMPLES.forEach(ex => {
    const btn = document.createElement('button');
    btn.className = 'examplebtn';
    btn.textContent = ex.label;
    btn.addEventListener('click', () => applyExample(ex, btn));
    wrap.appendChild(btn);
  });
}

function applyExample(ex, btnEl) {
  activeExample = ex;
  document.querySelectorAll('.examplebtn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  const ctxBox = document.getElementById('exampleContext');
  ctxBox.style.display = 'block';
  ctxBox.innerHTML = `<b>Contexto:</b> ${ex.context}`;

  if (ex.kind === 'direct') {
    lastParam = null;
    document.getElementById('paramResult').style.display = 'none';
    document.getElementById('fLeft').value = ex.left;
    document.getElementById('fCenter').value = ex.center;
    document.getElementById('fRight').value = ex.right;
    document.getElementById('point').value = ex.point;
    refreshVisual();
    return;
  }

  // jump-param / removable-param: reutiliza el mismo flujo del botón
  // "resolver parámetro", solo con las cajas ya rellenas.
  const targetMode = ex.kind === 'jump-param' ? 'jump' : 'removable';
  paramMode = targetMode;
  document.querySelectorAll('.modebtn[data-pmode]').forEach(b => b.classList.toggle('active', b.dataset.pmode === targetMode));
  document.getElementById('paramJump').style.display = targetMode === 'jump' ? '' : 'none';
  document.getElementById('paramRemovable').style.display = targetMode === 'removable' ? '' : 'none';
  document.getElementById('pName').value = ex.param_name;
  document.getElementById('pPoint').value = ex.point;
  if (targetMode === 'jump') {
    document.getElementById('pLeft').value = ex.left;
    document.getElementById('pRight').value = ex.right;
  } else {
    document.getElementById('pExpr').value = ex.expr;
  }
  solveParameter();
}

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
    if (view === 'figura') {
      if (lastVisual) renderFigure(lastVisual);
      if (lastChart) drawCartesian(lastChart);
      updateChartCaption();
    }
  });
});

document.querySelectorAll('.modebtn[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('.modebtn[data-mode]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    refreshVisual();
  });
});

// ---------- parámetro desconocido (k, m, a, c...) ----------
let paramMode = 'jump';
document.querySelectorAll('.modebtn[data-pmode]').forEach(btn => {
  btn.addEventListener('click', () => {
    paramMode = btn.dataset.pmode;
    document.querySelectorAll('.modebtn[data-pmode]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('paramJump').style.display = paramMode === 'jump' ? '' : 'none';
    document.getElementById('paramRemovable').style.display = paramMode === 'removable' ? '' : 'none';
  });
});

async function solveParameter() {
  const point = document.getElementById('pPoint').value;
  const param_name = document.getElementById('pName').value;
  const box = document.getElementById('paramResult');
  try {
    const body = { param_mode: paramMode, param_name, point };
    if (paramMode === 'jump') {
      body.left = document.getElementById('pLeft').value;
      body.right = document.getElementById('pRight').value;
    } else {
      body.expr = document.getElementById('pExpr').value;
    }
    const result = await api('/api/solve_parameter', body);
    lastParam = result;
    box.style.display = 'block';
    box.className = 'result ok';
    box.innerHTML = `<div class="verdict">${param_name} = ${result.param_value}</div>` +
      `<div style="margin-top:4px;opacity:.85;">${result.detail.join('<br>')}</div>`;

    // llena las cajas de Continuidad con la función ya resuelta —
    // continuity_engine la verifica exactamente igual que cualquier
    // otra función, sin saber que antes tuvo una incógnita.
    if (paramMode === 'jump') {
      document.getElementById('fLeft').value = result.left_expr;
      document.getElementById('fCenter').value = result.right_expr;
      document.getElementById('fRight').value = result.right_expr;
    } else {
      document.getElementById('fLeft').value = result.expr;
      document.getElementById('fCenter').value = String(result.param_value);
      document.getElementById('fRight').value = result.expr;
    }
    document.getElementById('point').value = point;
    refreshVisual();
  } catch (err) {
    lastParam = null;
    box.style.display = 'block';
    box.className = 'result bad';
    box.innerHTML = `<div class="verdict">Error</div>${err.message}`;
  }
}
document.getElementById('solveParamBtn').addEventListener('click', () => {
  // clic manual (no desde un ejemplo guiado): el ejemplo activo, si había
  // uno, ya no describe lo que se está resolviendo ahora.
  activeExample = null;
  document.querySelectorAll('.examplebtn').forEach(b => b.classList.remove('active'));
  document.getElementById('exampleContext').style.display = 'none';
  solveParameter();
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

// ---------- continuidad → figura + gráfica cartesiana + resultados ----------
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

    try {
      const chart = await api('/api/chart', { left, center, right, point, mode });
      lastChart = chart;
      if (document.getElementById('viewFigura').style.display !== 'none') drawCartesian(chart);
    } catch (err) {
      lastChart = null;
    }

    updateResultsText();
    updateChartCaption();
  }, 150);
}
['fLeft', 'fCenter', 'fRight', 'point'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    lastParam = null; // una edición manual invalida el parámetro resuelto previamente
    activeExample = null; // y también invalida el contexto narrativo del ejemplo guiado
    document.querySelectorAll('.examplebtn').forEach(b => b.classList.remove('active'));
    document.getElementById('exampleContext').style.display = 'none';
    refreshVisual();
  });
});

function tk() {
  const st = getComputedStyle(document.documentElement);
  return {
    line: st.getPropertyValue('--line').trim(),
    accent: st.getPropertyValue('--accent').trim(),
    alert: st.getPropertyValue('--alert').trim(),
    text: st.getPropertyValue('--text').trim(),
    muted: st.getPropertyValue('--muted').trim(),
    panel2: st.getPropertyValue('--panel2').trim(),
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

// ---------- gráfica cartesiana real (estilo Figura 16 de la guía) ----------
// Dibuja las dos ramas con los puntos que ya calculó visual_engine, y
// marca el punto crítico leyendo los valores exactos que ya verificó
// continuity_engine (f_x_left / f_x / f_x_right) — no se reclasifica
// nada aquí con una segunda lógica independiente.
function drawCartesian(chart) {
  const cv = document.getElementById('cartBox');
  const box = cv.parentElement;
  cv.width = box.clientWidth; cv.height = box.clientHeight;
  const ctx = cv.getContext('2d');
  const t = tk();
  ctx.clearRect(0, 0, cv.width, cv.height);

  const cont = chart.continuity || {};
  const isNum = v => typeof v === 'number' && isFinite(v);
  const fLeft = cont.f_x_left, fCenter = cont.f_x, fRight = cont.f_x_right;

  const allPts = [...chart.left_points, ...chart.right_points];
  if (allPts.length === 0) return;

  const xMin = chart.x_min, xMax = chart.x_max;
  let yMin = Infinity, yMax = -Infinity;
  allPts.forEach(p => { yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y); });
  [fLeft, fCenter, fRight].forEach(v => { if (isNum(v)) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); } });
  if (!isFinite(yMin) || !isFinite(yMax)) { yMin = -1; yMax = 1; }
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const yPad = (yMax - yMin) * 0.15 || 1;
  yMin -= yPad; yMax += yPad;

  const padL = 46, padR = 14, padT = 14, padB = 26;
  const plotW = cv.width - padL - padR, plotH = cv.height - padT - padB;
  const xToPx = x => padL + ((x - xMin) / (xMax - xMin)) * plotW;
  const yToPx = y => padT + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

  // grilla + ejes con valores reales (no decorativos)
  ctx.font = '10px ui-monospace, monospace';
  const xTicks = 6, yTicks = 5;
  for (let i = 0; i <= xTicks; i++) {
    const x = xMin + (xMax - xMin) * i / xTicks;
    const px = xToPx(x);
    ctx.strokeStyle = t.line; ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, padT + plotH); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = t.muted;
    ctx.fillText(x.toFixed(1), Math.min(px - 10, cv.width - 30), cv.height - 8);
  }
  for (let i = 0; i <= yTicks; i++) {
    const y = yMin + (yMax - yMin) * i / yTicks;
    const py = yToPx(y);
    ctx.strokeStyle = t.line; ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + plotW, py); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = t.muted;
    ctx.fillText(y.toFixed(1), 2, py + 3);
  }
  ctx.strokeStyle = t.muted; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.2;
  if (xMin <= 0 && xMax >= 0) { const px = xToPx(0); ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, padT + plotH); ctx.stroke(); }
  if (yMin <= 0 && yMax >= 0) { const py = yToPx(0); ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + plotW, py); ctx.stroke(); }
  ctx.globalAlpha = 1;

  const lineColor = cont.is_continuous ? t.accent : t.alert;

  const drawBranch = (points) => {
    if (!points.length) return;
    ctx.strokeStyle = lineColor; ctx.lineWidth = 2.2; ctx.beginPath();
    points.forEach((p, i) => { const px = xToPx(p.x), py = yToPx(p.y); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
    ctx.stroke();
  };
  drawBranch(chart.left_points);
  drawBranch(chart.right_points);

  const pointPx = xToPx(chart.point);
  const dot = (px, py, filled) => {
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle = filled ? lineColor : t.panel2;
    ctx.fill();
    ctx.strokeStyle = lineColor; ctx.lineWidth = 2; ctx.stroke();
  };
  const dashedLine = (x1, y1, x2, y2) => {
    ctx.setLineDash([4, 3]); ctx.strokeStyle = t.alert; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
  };

  let annotation = '';
  if (!isNum(fLeft) || !isNum(fRight)) {
    // asíntota: al menos un lado se dispara a infinito
    dashedLine(pointPx, padT, pointPx, padT + plotH);
    annotation = `Asíntota vertical en x=${chart.point}`;
  } else if (Math.abs(fLeft - fRight) < 1e-6) {
    if (isNum(fCenter) && Math.abs(fCenter - fLeft) > 1e-6) {
      // removible: los límites coinciden pero el valor almacenado no
      const limitPx = yToPx(fLeft), storedPx = yToPx(fCenter);
      dashedLine(pointPx, limitPx, pointPx, storedPx);
      dot(pointPx, limitPx, false);
      dot(pointPx, storedPx, true);
      annotation = `Removible en x=${chart.point}: límite=${fLeft.toFixed(3)}, almacenado=${fCenter.toFixed(3)}`;
    } else {
      dot(pointPx, yToPx(fCenter), true);
      annotation = `Continua en x=${chart.point}`;
    }
  } else {
    // salto: izquierda abierta (hueco), derecha cerrada (rellena)
    const leftPx = yToPx(fLeft), rightPx = yToPx(fRight);
    dashedLine(pointPx, leftPx, pointPx, rightPx);
    dot(pointPx, leftPx, false);
    dot(pointPx, rightPx, true);
    annotation = `Salto en x=${chart.point}: Δ = ${Math.abs(fLeft - fRight).toFixed(3)}`;
  }

  if (annotation) {
    ctx.fillStyle = t.text; ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(annotation, padL + 4, padT + 14);
  }
}

// ---------- texto de resultados: mismo dato, formato de respuesta de tarea ----------
// La clasificación (classifyContinuity) y el texto pedagógico
// (DISCONTINUITY_INFO) viven arriba, compartidos con updateChartCaption(),
// para que la gráfica y este panel nunca cuenten una historia distinta.
function updateResultsText() {
  const box = document.getElementById('resultsText');
  const cont = lastChart && lastChart.continuity;
  if (!cont) { box.textContent = 'Evalúa continuidad para generar los resultados.'; box.className = 'result'; return; }

  const lines = [];
  let i = 1;

  if (lastParam) {
    lines.push(`${i++}. Parámetro ${lastParam.param_name} = ${lastParam.param_value} (resuelto para que la función sea continua en x=${lastParam.point}).`);
  }
  lines.push(`${i++}. Límite por la izquierda en x→${cont.x}⁻: ${cont.f_x_left}`);
  lines.push(`${i++}. Valor en el punto / rama derecha en x→${cont.x}⁺: ${cont.f_x_right}`);
  lines.push(`${i++}. f(${cont.x}) = ${cont.f_x}`);
  lines.push(`${i++}. Continuidad: la función es ${cont.is_continuous ? 'CONTINUA' : 'DISCONTINUA'} en x=${cont.x}.`);

  const kind = classifyContinuity(cont);
  if (kind !== 'continua') {
    const info = DISCONTINUITY_INFO[kind];
    let detalle = `${info.titulo}. ${info.definicion}`;
    if (kind === 'removible') detalle += ` Aquí: el límite da ${cont.f_x_left}, pero el valor almacenado es ${cont.f_x}.`;
    if (kind === 'salto') detalle += ` Aquí: Δ = ${Math.abs(cont.f_x_left - cont.f_x_right).toFixed(4)}.`;
    lines.push(`${i++}. Tipo de discontinuidad: ${detalle}`);
    lines.push(`${i++}. En el contexto de redes y análisis de datos: ${activeExample ? activeExample.context : info.telecom}`);
  }

  if (cont.domain_warnings && cont.domain_warnings.length) {
    lines.push(`${i++}. Advertencias de dominio: ${cont.domain_warnings.join(' / ')}`);
  }

  box.textContent = 'Resultados:\n' + lines.join('\n');
  box.className = 'result ' + (cont.is_continuous ? 'ok' : 'bad');
}

// ---------- explicación breve de la gráfica cartesiana ----------
// Pedido explícito de la profesora: "una breve explicación en cada gráfica
// que se genere". No repite el detalle completo del panel de Resultados —
// da el contexto mínimo para leer la curva: qué es cada rama y qué significa
// el punto marcado, en una o dos frases.
function updateChartCaption() {
  const box = document.getElementById('chartCaption');
  const cont = lastChart && lastChart.continuity;
  if (!cont) {
    box.textContent = 'Evalúa una función (o elige un ejemplo guiado) para ver la explicación de esta gráfica.';
    return;
  }
  const kind = classifyContinuity(cont);
  const info = DISCONTINUITY_INFO[kind];
  const narrativa = activeExample ? activeExample.context : info.telecom;
  box.innerHTML =
    `<b>Qué muestra:</b> la rama izquierda (x&lt;${cont.x}) y la derecha (x≥${cont.x}) de la función ingresada, ` +
    `trazadas con los valores reales que calculó el motor — no es una curva decorativa. ` +
    `En x=${cont.x} la función es <b>${cont.is_continuous ? 'continua' : info.titulo.toLowerCase()}</b>: ${info.definicion} ${narrativa}`;
}

renderExampleButtons();
renderVals();
refreshOrder();