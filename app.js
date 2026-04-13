/* ============================================
   LinkTIC — Control Panel Engine
   ============================================ */

// ===== THEME =====
const TM = {
  c: (['dark', 'light'].includes(localStorage.getItem('linktic-theme')) ? localStorage.getItem('linktic-theme') : 'light'),
  init() {
    document.documentElement.setAttribute('data-theme', this.c);
    document.getElementById('themeToggle').onclick = () => {
      this.c = this.c === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', this.c);
      localStorage.setItem('linktic-theme', this.c);
      this.onChange();
    };
  },
  dark() { return this.c === 'dark' },
  onChange() {
    // Rebuild charts
    buildCharts();
    // Sparklines
    document.querySelectorAll('[data-spark]').forEach(c => {
      spark(c, c.dataset.spark.split(',').map(Number), c.dataset.color || '#007AFF');
    });
    // Three.js — skip if user prefers reduced motion
    const dk = this.dark();
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (window._threeGrid && !prefersReducedMotion) {
      window._threeGrid.material.color.set(dk ? 0x0A84FF : 0x007AFF);
      window._threeGrid.material.opacity = dk ? .2 : .08;
    }
    if (window._threeParticles && !prefersReducedMotion) {
      const p = window._threeParticles;
      p.M.blending = dk ? THREE.AdditiveBlending : THREE.NormalBlending;
      p.M.needsUpdate = true;
      const newPal = dk ? [[.04, .52, 1], [.37, .36, .9], [.75, .35, .95], [.19, .82, .35], [.04, .35, .65]] : [[0, .48, 1], [.34, .34, .84], [.69, .32, .87], [.35, .55, .8], [.2, .65, .9]];
      const ca = p.G.getAttribute('color');
      for (let i = 0; i < ca.count; i++) { const c = newPal[Math.floor(Math.random() * newPal.length)]; ca.array[i * 3] = c[0]; ca.array[i * 3 + 1] = c[1]; ca.array[i * 3 + 2] = c[2] }
      ca.needsUpdate = true;
    }
    // Map tiles
    if (window._lincMap && window._lincTileLayer) {
      window._lincMap.removeLayer(window._lincTileLayer);
      const url = dk
        ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      window._lincTileLayer = L.tileLayer(url, { attribution: '&copy; OSM &copy; CARTO', maxZoom: 18 }).addTo(window._lincMap);
    }
  }
};

// ===== CLOCK =====
function updateClock() {
  const d = new Date();
  document.getElementById('clock').textContent =
    [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
}
updateClock(); setInterval(updateClock, 1000);

// ===== THREE.JS =====
(() => {
  const cvs = document.getElementById('bg-canvas'); if (!cvs) return;
  // Respect prefers-reduced-motion: skip all Three.js rendering
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { cvs.style.display = 'none'; return; }
  const R = new THREE.WebGLRenderer({ canvas: cvs, alpha: true, antialias: true });
  R.setSize(innerWidth, innerHeight); R.setPixelRatio(Math.min(devicePixelRatio, 2));
  const S = new THREE.Scene(), C = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .1, 1000);
  C.position.set(0, 15, 35); C.lookAt(0, 0, 0);

  const dk = TM.dark();
  const gridH = new THREE.GridHelper(120, 60, dk ? 0x0A84FF : 0x007AFF, dk ? 0x0A1A3A : 0xC7D2FE);
  gridH.position.y = -8; gridH.material.opacity = dk ? .25 : .12; gridH.material.transparent = true;
  window._threeGrid = gridH;
  S.add(gridH);

  const N = 600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), sz = new Float32Array(N);
  const pal = dk ? [[.04, .52, 1], [.37, .36, .9], [.75, .35, .95], [.19, .82, .35], [.04, .35, .65]] : [[0, .48, 1], [.34, .34, .84], [.69, .32, .87], [.35, .55, .8], [.2, .65, .9]];
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - .5) * 80; pos[i * 3 + 1] = Math.random() * 40 - 5; pos[i * 3 + 2] = (Math.random() - .5) * 60;
    const c = pal[Math.floor(Math.random() * pal.length)];
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    sz[i] = Math.random() * 1.8 + .3;
  }
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  G.setAttribute('color', new THREE.BufferAttribute(col, 3));
  G.setAttribute('size', new THREE.BufferAttribute(sz, 1));
  const M = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float size;attribute vec3 color;varying vec3 vC;varying float vA;uniform float uTime;
      void main(){vC=color;vec3 p=position;
        p.y+=sin(p.x*.1+uTime*.15)*2.+cos(p.z*.08+uTime*.1)*1.5;
        p.x+=sin(uTime*.05+p.z*.05)*1.5;
        vA=smoothstep(50.,0.,length(p))*.35;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        gl_PointSize=size*(16./(-(modelViewMatrix*vec4(p,1.)).z));}`,
    fragmentShader: `varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;gl_FragColor=vec4(vC,smoothstep(.5,.0,d)*vA);}`,
    transparent: true, depthWrite: false, blending: dk ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  S.add(new THREE.Points(G, M));
  window._threeParticles = { G, M };

  const lineN = 40, linePos = new Float32Array(lineN * 6);
  for (let i = 0; i < lineN; i++) {
    const a = Math.floor(Math.random() * N), b = Math.floor(Math.random() * N);
    linePos[i * 6] = pos[a * 3]; linePos[i * 6 + 1] = pos[a * 3 + 1]; linePos[i * 6 + 2] = pos[a * 3 + 2];
    linePos[i * 6 + 3] = pos[b * 3]; linePos[i * 6 + 4] = pos[b * 3 + 1]; linePos[i * 6 + 5] = pos[b * 3 + 2];
  }
  const lG = new THREE.BufferGeometry(); lG.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  S.add(new THREE.LineSegments(lG, new THREE.LineBasicMaterial({ color: 0x007AFF, transparent: true, opacity: .025 })));

  const ms = { x: 0, y: 0 };
  document.addEventListener('mousemove', e => { ms.x = (e.clientX / innerWidth) * 2 - 1; ms.y = -(e.clientY / innerHeight) * 2 + 1 });
  addEventListener('resize', () => { C.aspect = innerWidth / innerHeight; C.updateProjectionMatrix(); R.setSize(innerWidth, innerHeight) });
  const clk = new THREE.Clock();
  let _bgAnimId;
  (function loop() { _bgAnimId = requestAnimationFrame(loop); const t = clk.getElapsedTime(); M.uniforms.uTime.value = t; gridH.position.z = -(t * 2 % 4); C.position.x += (ms.x * 3 - C.position.x) * .008; C.position.y += (15 + ms.y * 2 - C.position.y) * .008; C.lookAt(0, 0, 0); R.render(S, C) })();
  // Expose cleanup function for background animation
  window._cancelBgAnim = function () { cancelAnimationFrame(_bgAnimId); };
})();

// ===== GSAP =====
gsap.registerPlugin(ScrollTrigger);

// Reveal elements immediately for active view, or on scroll for visible sections
function revealElementsInSection(section) {
  if (!section) return;
  section.querySelectorAll('[data-reveal]:not(.visible)').forEach(el => {
    el.classList.add('visible');
    const m = el.querySelector('#map');
    if (m && window._lincMap) setTimeout(() => window._lincMap.invalidateSize(), 200);
  });
  // Count-up animations
  section.querySelectorAll('[data-count]:not(.counted)').forEach(el => {
    el.classList.add('counted');
    const t = parseFloat(el.dataset.count);
    gsap.to({ v: 0 }, { v: t, duration: 1.5, ease: 'power2.out', onUpdate() { el.textContent = Math.floor(this.targets()[0].v).toLocaleString() } });
  });
  // Bar fills
  section.querySelectorAll('.bf').forEach(b => {
    if (!b.style.getPropertyValue('--w')) {
      const w = b.style.width; b.style.setProperty('--w', w); b.style.width = '0';
    }
  });
}

// Nav — sections & view system
const sections = ['overview', 'teams', 'delivery', 'talent', 'projects', 'map-section', 'biometrics', 'admin', 'control-panel'];
const sectionNames = { overview: 'Overview', teams: 'Equipos', delivery: 'Delivery', talent: 'Analytics', projects: 'Proyectos', 'map-section': 'Mapa', biometrics: 'Biometricos', admin: 'Admin', 'control-panel': 'Mi Panel' };

// Bar fill (initial setup for overview)
document.querySelectorAll('.bf').forEach(b => { const w = b.style.width; b.style.setProperty('--w', w); b.style.width = '0' });

// ===== SPARKLINES =====
function spark(cvs, data, color) {
  if (!cvs.dataset.origW) { cvs.dataset.origW = cvs.width; cvs.dataset.origH = cvs.height; }
  const w = +cvs.dataset.origW, h = +cvs.dataset.origH, dpr = devicePixelRatio || 1;
  cvs.width = w * dpr; cvs.height = h * dpr; cvs.style.width = w + 'px'; cvs.style.height = h + 'px';
  const ctx = cvs.getContext('2d');
  ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  const mx = Math.max(...data), mn = Math.min(...data), rng = mx - mn || 1, step = w / (data.length - 1);
  const pts = data.map((v, i) => ({ x: i * step, y: h - ((v - mn) / rng) * (h - 8) - 4 }));
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, color + '25'); g.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) { const cp = (pts[i - 1].x + pts[i].x) / 2; ctx.bezierCurveTo(cp, pts[i - 1].y, cp, pts[i].y, pts[i].x, pts[i].y) }
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) { const cp = (pts[i - 1].x + pts[i].x) / 2; ctx.bezierCurveTo(cp, pts[i - 1].y, cp, pts[i].y, pts[i].x, pts[i].y) }
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
  const l = pts[pts.length - 1];
  ctx.beginPath(); ctx.arc(l.x, l.y, 3, 0, Math.PI * 2); ctx.fillStyle = color + '40'; ctx.fill();
  ctx.beginPath(); ctx.arc(l.x, l.y, 1.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}
document.querySelectorAll('[data-spark]').forEach(c => spark(c, c.dataset.spark.split(',').map(Number), c.dataset.color || '#007AFF'));

// ===== CHARTS =====
const PD = {
  labels: ['Web', 'Mobile', 'API', 'Data', 'Infra', 'QA', 'DevOps', 'UX', 'Soporte'],
  collab: [42, 38, 35, 28, 25, 22, 18, 15, 25],
  load: [92, 78, 65, 58, 72, 45, 88, 60, 70],
  colors: ['#007AFF', '#5856D6', '#AF52DE', '#FF9500', '#34C759', '#5AC8FA', '#FF3B30', '#FF2D55', '#00C7BE']
};
const MO = ['Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar'];
const charts = {};
const canvasToChart = { timelineChart: 'time', cargaChart: 'carga', colabChart: 'colab', cargaChart2: 'carga2', sprintChart: 'sprint', deployChart: 'deploy', bugChart: 'bug', retentionChart: 'ret', satisfactionChart: 'sat', revenueChart: 'rev', attendanceChart: 'attendance' };

function getTC() {
  return TM.dark()
    ? { text: '#F5F5F7', ts: '#D1D1D6', tm: '#A1A1A6', grid: '#2C2C2E', tip: '#2C2C2E', pb: '#1C1C1E' }
    : { text: '#1D1D1F', ts: '#3C3C43', tm: '#636366', grid: '#E5E5EA', tip: '#FEFEFE', pb: '#fff' };
}
function mkTip() { const c = getTC(); return { backgroundColor: c.tip, titleColor: c.text, bodyColor: c.ts, borderColor: '#CDDAFF', borderWidth: 0.5, cornerRadius: 12, padding: 14, bodyFont: { family: 'JetBrains Mono', size: 11 }, titleFont: { family: 'Inter', weight: '600', size: 11 }, boxPadding: 4, caretSize: 6 } }
function mkOpts() { const c = getTC(); return { responsive: true, maintainAspectRatio: false, animation: { duration: 700, easing: 'easeOutQuart' }, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: c.text, font: { size: 12, family: 'Inter', weight: '600' }, usePointStyle: true, pointStyle: 'circle', padding: 16 } }, tooltip: mkTip() }, scales: { y: { grid: { color: c.grid, drawBorder: false }, ticks: { color: c.text, font: { size: 12, family: 'JetBrains Mono', weight: '500' }, padding: 8 }, border: { display: false } }, x: { grid: { display: false }, ticks: { color: c.text, font: { size: 12, family: 'JetBrains Mono', weight: '500' }, padding: 8 }, border: { display: false } } } } }

function buildCharts() {
  Object.values(charts).forEach(c => c.destroy());
  const o = mkOpts(), c = getTC(), dk = TM.dark(), dbrd = dk ? '#2C2C2E' : '#FEFEFE';
  // Solid chart fills — light/dark aware
  const CF = dk
    ? { blue: '#0A1F3A', indigo: '#1E1E3A', purple: '#1E1230', red: '#3A1518', orange: '#3A2A10', green: '#0F3320', teal: '#0A2E2C' }
    : { blue: '#E0ECFF', indigo: '#E8E8F8', purple: '#F0E6F8', red: '#FDECEB', orange: '#FFF2E0', green: '#E3F5E8', teal: '#E0F5F4' };
  const CB = dk
    ? { blue: '#1A3F6E', indigo: '#2E2E5C', purple: '#3A2458', red: '#5C2326', orange: '#5C4520', green: '#1A6633', teal: '#1A5C56' }
    : { blue: '#99B3FF', indigo: '#ABABD6', purple: '#C9A0DE', red: '#FF8A84', orange: '#FFB84D', green: '#6BBF80', teal: '#70D6D0' };

  // timelineChart is now managed by bento-v2 initBentoV2() — skip here
  if (!document.querySelector('.bento-v2')) {
    charts.time = new Chart(document.getElementById('timelineChart'), {
      type: 'line', data: {
        labels: MO, datasets: [
          { label: 'Web', data: [35, 38, 40, 42, 41, 42], borderColor: '#007AFF', backgroundColor: CF.blue, borderWidth: 2, fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: '#007AFF', pointBorderColor: c.pb, pointBorderWidth: 2, pointHoverRadius: 6 },
          { label: 'Mobile', data: [30, 32, 34, 36, 37, 38], borderColor: '#5856D6', backgroundColor: CF.indigo, borderWidth: 1.5, fill: true, tension: .4, pointRadius: 2, pointBackgroundColor: '#5856D6' },
          { label: 'API', data: [28, 30, 32, 33, 34, 35], borderColor: '#AF52DE', backgroundColor: CF.purple, borderWidth: 1.5, fill: true, tension: .4, pointRadius: 2, pointBackgroundColor: '#AF52DE' },
          { label: 'DevOps', data: [12, 14, 15, 16, 17, 18], borderColor: '#FF3B30', backgroundColor: CF.red, borderWidth: 1.5, fill: true, tension: .4, pointRadius: 2, pointBackgroundColor: '#FF3B30' },
        ]
      }, options: o
    });
  }

  charts.carga = new Chart(document.getElementById('cargaChart'), { type: 'doughnut', data: { labels: PD.labels, datasets: [{ data: PD.load, backgroundColor: PD.colors, borderColor: dbrd, borderWidth: 1, hoverOffset: 8, spacing: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '68%', animation: { animateRotate: true, duration: 1000 }, plugins: { legend: { display: false }, tooltip: { ...mkTip(), callbacks: { label: x => `${x.label}: ${x.parsed}%` } } } } });

  charts.colab = new Chart(document.getElementById('colabChart'), { type: 'bar', data: { labels: PD.labels, datasets: [{ label: 'Colaboradores', data: PD.collab, backgroundColor: PD.colors, borderColor: PD.colors, borderWidth: 1, borderRadius: 4, borderSkipped: false }] }, options: { ...o, plugins: { ...o.plugins, legend: { display: false } } } });

  charts.carga2 = new Chart(document.getElementById('cargaChart2'), { type: 'radar', data: { labels: PD.labels, datasets: [{ label: 'Carga %', data: PD.load, backgroundColor: CF.blue, borderColor: '#007AFF', borderWidth: 1.5, pointBackgroundColor: '#007AFF', pointRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: mkTip() }, scales: { r: { grid: { color: c.grid }, angleLines: { color: c.grid }, ticks: { display: false }, pointLabels: { color: c.text, font: { size: 12, family: 'JetBrains Mono' } } } } } });

  charts.sprint = new Chart(document.getElementById('sprintChart'), {
    type: 'bar', data: {
      labels: ['S18', 'S19', 'S20', 'S21', 'S22', 'S23', 'S24', 'S25'], datasets: [
        { label: 'Plan', data: [42, 45, 48, 44, 50, 47, 52, 55], backgroundColor: CF.blue, borderColor: CB.blue, borderWidth: 1, borderRadius: 6 },
        { label: 'Done', data: [38, 43, 45, 40, 48, 45, 50, 53], backgroundColor: CF.indigo, borderColor: CB.indigo, borderWidth: 1, borderRadius: 6 }
      ]
    }, options: o
  });

  charts.deploy = new Chart(document.getElementById('deployChart'), {
    type: 'line', data: {
      labels: MO, datasets: [
        { label: 'Prod', data: [18, 22, 28, 35, 42, 48], borderColor: '#007AFF', backgroundColor: CF.blue, borderWidth: 2, fill: true, tension: .4, pointRadius: 2 },
        { label: 'Stage', data: [45, 52, 60, 68, 75, 82], borderColor: '#5856D6', backgroundColor: CF.indigo, borderWidth: 1.5, fill: true, tension: .4, pointRadius: 2 },
        { label: 'Rollback', data: [3, 2, 4, 1, 2, 1], borderColor: '#FF3B30', backgroundColor: CF.red, borderWidth: 1, fill: true, tension: .4, pointRadius: 2 }
      ]
    }, options: o
  });

  charts.bug = new Chart(document.getElementById('bugChart'), {
    type: 'line', data: {
      labels: MO, datasets: [
        { label: 'Crit', data: [12, 8, 10, 6, 4, 3], borderColor: '#FF3B30', backgroundColor: CF.red, borderWidth: 1.5, fill: true, tension: .3 },
        { label: 'Major', data: [28, 25, 22, 18, 15, 12], borderColor: '#FF9500', backgroundColor: CF.orange, borderWidth: 1.5, fill: true, tension: .3 },
        { label: 'Minor', data: [45, 42, 38, 35, 30, 28], borderColor: '#007AFF', backgroundColor: CF.blue, borderWidth: 1.5, fill: true, tension: .3 }
      ]
    }, options: { ...o, scales: { ...o.scales, y: { ...o.scales.y, stacked: true } } }
  });

  charts.ret = new Chart(document.getElementById('retentionChart'), { type: 'doughnut', data: { labels: ['Retencion', 'Voluntaria', 'Involuntaria'], datasets: [{ data: [92, 5, 3], backgroundColor: ['#10B981', '#F59E0B', '#EF4444'], borderColor: dbrd, borderWidth: 1, spacing: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { labels: { color: c.text, font: { size: 12 }, usePointStyle: true, pointStyle: 'circle', padding: 10 } }, tooltip: { ...mkTip(), callbacks: { label: x => `${x.label}: ${x.parsed}%` } } } } });

  const eNPS = [62, 75, 80, 85, 58, 88, 42, 90, 70];
  charts.sat = new Chart(document.getElementById('satisfactionChart'), { type: 'bar', data: { labels: PD.labels, datasets: [{ label: 'eNPS', data: eNPS, backgroundColor: ({ dataIndex: i }) => eNPS[i] >= 70 ? '#10B981' : eNPS[i] >= 50 ? '#F59E0B' : '#EF4444', borderColor: ({ dataIndex: i }) => eNPS[i] >= 70 ? '#10B981' : eNPS[i] >= 50 ? '#F59E0B' : '#EF4444', borderWidth: 1, borderRadius: 4 }] }, options: { ...o, indexAxis: 'y', plugins: { ...o.plugins, legend: { display: false } }, scales: { x: { grid: { color: c.grid }, ticks: { color: c.text, font: { size: 12, weight: '500' } }, border: { display: false } }, y: { grid: { display: false }, ticks: { color: c.text, font: { size: 12 } }, border: { display: false } } } } });

  charts.rev = new Chart(document.getElementById('revenueChart'), {
    type: 'line', data: {
      labels: ['Q1-24', 'Q2-24', 'Q3-24', 'Q4-24', 'Q1-25'], datasets: [
        { label: 'Rev/Emp (K)', data: [28, 31, 29, 34, 38], borderColor: '#007AFF', backgroundColor: CF.blue, borderWidth: 2, fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: '#007AFF', pointBorderColor: c.pb, pointBorderWidth: 2 },
        { label: 'Cost/Emp (K)', data: [22, 23, 22, 24, 25], borderColor: '#AF52DE', backgroundColor: CF.purple, borderWidth: 1.5, fill: true, tension: .4, pointRadius: 2, borderDash: [4, 4] }
      ]
    }, options: o
  });

  // Attendance chart (biometrics)
  const attCanvas = document.getElementById('attendanceChart');
  if (attCanvas) {
    const attDays = []; for (let i = 1; i <= 31; i++)attDays.push(i + ' Mar');
    const attData = [98, 97, 96, 94, 98, 97, 12, 8, 96, 93, 97, 98, 96, 10, 5, 97, 98, 92, 97, 96, 15, 6, 98, 94, 97, 96, 98, 45, 9, 97, 96];
    charts.attendance = new Chart(attCanvas, {
      type: 'line', data: {
        labels: attDays, datasets: [
          { label: 'Asistencia %', data: attData, borderColor: '#007AFF', backgroundColor: CF.blue, borderWidth: 2, fill: true, tension: .3, pointRadius: 2, pointBackgroundColor: '#007AFF', pointBorderColor: c.pb, pointBorderWidth: 1, pointHoverRadius: 5 },
          { label: 'Meta', data: Array(31).fill(95), borderColor: '#34C759', backgroundColor: 'transparent', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false }
        ]
      }, options: { ...o, plugins: { ...o.plugins, legend: { labels: { color: c.text, font: { size: 12, family: 'Inter', weight: '500' }, usePointStyle: true, pointStyle: 'circle', padding: 16 } } } }
    });
  }
  // Hide chart loading skeletons after charts render
  setTimeout(() => { document.querySelectorAll('.cw .chart-skeleton').forEach(sk => { sk.style.display = 'none' }) }, 100);
}
buildCharts();

// ===== LEAFLET MAP =====
(() => {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  const map = L.map(mapEl, { zoomControl: true, scrollWheelZoom: false }).setView([20, 0], 2);
  window._lincMap = map;

  const tileUrl = TM.dark()
    ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  window._lincTileLayer = L.tileLayer(tileUrl, { attribution: '&copy; OSM &copy; CARTO', maxZoom: 18 }).addTo(map);

  function nodeIcon(color) {
    return L.divIcon({
      className: '',
      html: '<div style="width:14px;height:14px;border-radius:50%;background:' + color + ';border:2px solid rgba(255,255,255,.7);box-shadow:0 0 12px ' + color + '50,0 2px 6px rgba(0,0,0,.1)"></div>',
      iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -12]
    });
  }
  [{ lat: 19.43, lng: -99.13, name: 'CDMX', team: 85, status: 'HQ', color: '#007AFF' },
  { lat: 40.71, lng: -74.01, name: 'New York', team: 42, status: 'EXP', color: '#5856D6' },
  { lat: 51.51, lng: -0.13, name: 'London', team: 38, status: 'OPS', color: '#AF52DE' },
  { lat: -33.87, lng: 151.21, name: 'Sydney', team: 28, status: 'APAC', color: '#34C759' },
  { lat: 35.68, lng: 139.69, name: 'Tokyo', team: 55, status: 'TECH', color: '#FF2D55' }
  ].forEach(o => {
    L.marker([o.lat, o.lng], { icon: nodeIcon(o.color) }).addTo(map)
      .bindPopup('<b>' + o.name + '</b><br>' + o.team + ' nodes<br><span style="color:' + o.color + ';font-family:JetBrains Mono;font-size:.7rem;font-weight:700">[' + o.status + ']</span>');
    L.circleMarker([o.lat, o.lng], { radius: 22, color: o.color, weight: 1, opacity: .15, fillColor: o.color, fillOpacity: .03 }).addTo(map);
  });

  // Force size fix after load
  setTimeout(() => map.invalidateSize(), 300);
  setTimeout(() => map.invalidateSize(), 1000);
})();

// ===== DRAG & DROP + INLINE EDIT =====
(() => {
  document.querySelectorAll('.draggable').forEach(card => {
    card.removeAttribute('draggable');
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    for (let i = 0; i < 6; i++) handle.appendChild(document.createElement('span'));
    card.appendChild(handle);
    const resize = document.createElement('div');
    resize.className = 'resize-handle';
    card.appendChild(resize);
  });

  // Inline edit
  '.kpi-label,.kpi-val,.card-head h3,.section-head h2,.section-count,.logo-text,.status-item b'.split(',').forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.classList.add('editable-hint');
      el.addEventListener('dblclick', e => {
        e.stopPropagation();
        el.setAttribute('contenteditable', 'true');
        el.focus();
        const r = document.createRange(); r.selectNodeContents(el);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      });
      el.addEventListener('blur', () => el.removeAttribute('contenteditable'));
      el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur() } if (e.key === 'Escape') el.blur() });
    });
  });

  // Custom drag
  let dragCard = null, ghost = null, placeholder = null, offX = 0, offY = 0;

  document.querySelectorAll('.drag-handle').forEach(handle => {
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      const card = handle.closest('.draggable'); if (!card) return;
      dragCard = card;
      const rect = card.getBoundingClientRect();
      offX = e.clientX - rect.left; offY = e.clientY - rect.top;

      ghost = document.createElement('div');
      ghost.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;width:' + rect.width + 'px;height:60px;left:' + rect.left + 'px;top:' + rect.top + 'px;opacity:.8;border-radius:12px;overflow:hidden;border:2px solid rgba(0,145,234,.3);box-shadow:0 4px 24px rgba(0,80,180,.15);background:rgba(255,255,255,.7);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)';
      const h3 = card.querySelector('.card-head h3,.kpi-label');
      ghost.innerHTML = '<div style="padding:14px;color:#0091EA;font-family:JetBrains Mono;font-size:.7rem;font-weight:700;letter-spacing:1px">' + (h3 ? h3.textContent : 'CARD') + '</div>';
      document.body.appendChild(ghost);

      placeholder = document.createElement('div');
      placeholder.className = 'drag-placeholder';
      const cs = getComputedStyle(card);
      placeholder.style.gridColumn = cs.gridColumn;
      placeholder.style.minHeight = rect.height + 'px';

      card.style.opacity = '.25';
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDrop);
    });
  });

  function onDrag(e) {
    if (!ghost) return;
    ghost.style.left = (e.clientX - offX) + 'px';
    ghost.style.top = (e.clientY - offY) + 'px';
    document.querySelectorAll('.drag-zone,.bento').forEach(zone => {
      const r = zone.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        const after = getAfter(zone, e.clientY);
        if (after) zone.insertBefore(placeholder, after); else zone.appendChild(placeholder);
      }
    });
  }

  function onDrop() {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDrop);
    if (ghost) { ghost.remove(); ghost = null }
    if (dragCard && placeholder && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(dragCard, placeholder);
      placeholder.remove();
    } else if (placeholder) placeholder.remove();
    if (dragCard) {
      dragCard.style.opacity = '';
      if (dragCard.querySelector('#map') && window._lincMap) setTimeout(() => window._lincMap.invalidateSize(), 100);
      dragCard.querySelectorAll('canvas:not(.kpi-spark)').forEach(cv => { if (cv.id && canvasToChart[cv.id] && charts[canvasToChart[cv.id]]) setTimeout(() => charts[canvasToChart[cv.id]].resize(), 50) });
    }
    placeholder = null; dragCard = null;
  }

  function getAfter(zone, y) {
    let closest = null, dist = Infinity;
    zone.querySelectorAll('.draggable').forEach(el => {
      if (el === dragCard) return;
      const mid = el.getBoundingClientRect().top + el.offsetHeight / 2;
      const d = y - mid;
      if (d < 0 && Math.abs(d) < dist) { dist = Math.abs(d); closest = el }
    });
    return closest;
  }

  // Resize
  document.querySelectorAll('.resize-handle').forEach(h => {
    let sx, sy, sw, sh, card;
    h.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      card = h.parentElement; sx = e.clientX; sy = e.clientY; sw = card.offsetWidth; sh = card.offsetHeight;
      document.addEventListener('mousemove', dr); document.addEventListener('mouseup', sr);
    });
    function dr(e) { card.style.width = Math.max(200, sw + (e.clientX - sx)) + 'px'; card.style.height = Math.max(120, sh + (e.clientY - sy)) + 'px'; card.style.minHeight = card.style.height }
    function sr() {
      document.removeEventListener('mousemove', dr); document.removeEventListener('mouseup', sr);
      const cv = card.querySelector('canvas:not(.kpi-spark)'); if (cv && cv.id && canvasToChart[cv.id] && charts[canvasToChart[cv.id]]) setTimeout(() => charts[canvasToChart[cv.id]].resize(), 50);
      if (card.querySelector('#map') && window._lincMap) setTimeout(() => window._lincMap.invalidateSize(), 50)
    }
  });
})();

// ===== FILTERS =====
(() => {
  const section = document.querySelector('.filters-section');
  const header = document.querySelector('.filters-header');
  const clearBtn = document.getElementById('filtersClear');
  const applyBtn = document.getElementById('filtersApply');
  if (!section || !header) return;

  // Toggle collapse
  const toggleBtn = document.getElementById('filtersToggle');
  const toggleFilters = () => {
    const collapsed = section.classList.toggle('collapsed');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(!collapsed));
  };
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
  header.addEventListener('click', toggleFilters);

  // Clear all selects
  if (clearBtn) {
    clearBtn.addEventListener('click', e => {
      e.stopPropagation();
      section.querySelectorAll('.filter-select').forEach(s => { s.value = ''; s.dispatchEvent(new Event('change')) });
    });
  }

  // Apply - visual feedback
  if (applyBtn) {
    applyBtn.addEventListener('click', e => {
      e.stopPropagation();
      const active = [];
      section.querySelectorAll('.filter-select').forEach(s => { if (s.value) active.push({ id: s.id, value: s.value }) });
      applyBtn.textContent = 'Aplicado';
      applyBtn.style.background = '#34C759';
      setTimeout(() => { applyBtn.textContent = 'Aplicar'; applyBtn.style.background = '' }, 1200);
      console.log('Filtros aplicados:', active);
    });
  }

  // Active filter indicator on select change
  section.querySelectorAll('.filter-select').forEach(s => {
    s.addEventListener('change', () => {
      const wrap = s.closest('.filter-select-wrap');
      if (s.value) {
        wrap.style.borderColor = '';
        s.style.borderColor = 'var(--blue)';
        s.style.background = 'var(--blue-subtle)';
      } else {
        s.style.borderColor = '';
        s.style.background = '';
      }
    });
  });
})();

// ===== PROJECT EXPAND/COLLAPSE =====
document.querySelectorAll('.proj-expand-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const card = btn.closest('.card-project');
    if (card) card.classList.toggle('expanded');
  });
});

// ===== ADD "VER DETALLE" BUTTONS TO PROJECT CARDS =====
document.querySelectorAll('.card-project[data-project-id]').forEach(card => {
  const btn = document.createElement('button');
  btn.className = 'detail-trigger-btn';
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg> Ver detalle';
  btn.onclick = e => { e.stopPropagation(); card.classList.add('click-feedback'); setTimeout(() => card.classList.remove('click-feedback'), 200); renderProjectDetail(card.dataset.projectId) };
  // Insert before the expand button
  const expandBtn = card.querySelector('.proj-expand-btn');
  if (expandBtn) card.insertBefore(btn, expandBtn); else card.appendChild(btn);
});

// ===== ADD "VER PERFIL" BUTTONS TO EMPLOYEE CARDS =====
document.querySelectorAll('.emp-card[data-employee-id]').forEach(card => {
  const btn = document.createElement('button');
  btn.className = 'detail-trigger-btn';
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> Ver perfil';
  btn.onclick = e => { e.stopPropagation(); card.classList.add('click-feedback'); setTimeout(() => card.classList.remove('click-feedback'), 200); renderEmployeeDetail(card.dataset.employeeId) };
  card.appendChild(btn);
});

// ===== VIEW SYSTEM =====
const viewScrollPositions = {};
let currentView = 'overview';
let detailActive = false;

function switchView(targetId, pushState = true) {
  if (targetId === currentView && !detailActive) return;
  const currentSection = document.getElementById(currentView);
  const targetSection = document.getElementById(targetId);
  if (!targetSection) return;

  // Store scroll position
  viewScrollPositions[currentView] = window.scrollY;

  // If detail is active, restore original content first (without animation)
  if (detailActive) {
    restoreDetailContent(currentView);
    detailActive = false;
  }

  // Hide current
  if (currentSection) {
    currentSection.classList.remove('active');
    currentSection.classList.remove('view-fading-out');
  }

  // Show target
  document.querySelectorAll('.view-section').forEach(s => { s.classList.remove('active', 'view-fading-out') });
  targetSection.classList.add('active');
  currentView = targetId;

  // Update sidebar items
  document.querySelectorAll('.sidebar-item').forEach(a => a.classList.toggle('active', a.dataset.target === targetId));

  // Scroll to top smoothly
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Reveal elements in the new section
  setTimeout(() => {
    revealElementsInSection(targetSection);
    // Resize charts in the visible section
    resizeChartsInSection(targetSection);
    // Fix map if visible
    if (targetId === 'map-section' && window._lincMap) {
      setTimeout(() => window._lincMap.invalidateSize(), 300);
    }
    // Render control panel if switching to it
    if (targetId === 'control-panel') {
      setTimeout(() => renderControlPanel(), 50);
    }
  }, 50);

  // Update URL hash
  if (pushState) {
    history.pushState({ view: targetId }, '', `#${targetId}`);
  }
}

function resizeChartsInSection(section) {
  if (!section) return;
  section.querySelectorAll('canvas:not(.kpi-spark)').forEach(cv => {
    if (cv.id && canvasToChart[cv.id] && charts[canvasToChart[cv.id]]) {
      setTimeout(() => charts[canvasToChart[cv.id]].resize(), 100);
    }
  });
}

// Sidebar item clicks
document.querySelectorAll('.sidebar-item').forEach(a => {
  a.onclick = e => {
    e.preventDefault();
    switchView(a.dataset.target);
    // Close mobile sidebar if open
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar && sidebar.classList.contains('mobile-open')) {
      sidebar.classList.remove('mobile-open');
      if (backdrop) backdrop.classList.remove('visible');
    }
  };
});

// Browser back/forward
window.addEventListener('popstate', e => {
  const view = (e.state && e.state.view) || getHashView() || 'overview';
  switchView(view, false);
});

function getHashView() {
  const h = location.hash.replace('#', '');
  return sections.includes(h) ? h : null;
}

// ===== DETAIL VIEWS — Shared infrastructure =====
const detailOriginalContent = {};

function showDetailView(sectionId, html) {
  detailActive = true;
  const section = document.getElementById(sectionId);
  if (!section) return;

  // Save original HTML
  if (!detailOriginalContent[sectionId]) {
    detailOriginalContent[sectionId] = section.innerHTML;
  }

  viewScrollPositions[sectionId + '_detail'] = window.scrollY;

  // Replace content with detail
  section.innerHTML = `<div class="detail-view" data-reveal>${html}</div>`;
  section.querySelector('.detail-view').classList.add('visible');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function restoreDetailContent(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section || !detailOriginalContent[sectionId]) return;

  section.innerHTML = detailOriginalContent[sectionId];
  delete detailOriginalContent[sectionId];
  detailActive = false;

  // Re-init interactive elements
  reinitSection(sectionId);

  // Restore scroll
  const savedScroll = viewScrollPositions[sectionId + '_detail'] || 0;
  setTimeout(() => window.scrollTo({ top: savedScroll, behavior: 'smooth' }), 50);
}

function goBackFromDetail(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const detailView = section.querySelector('.detail-view');
  if (detailView) {
    detailView.classList.add('detail-sliding-out');
    setTimeout(() => restoreDetailContent(sectionId), 200);
  } else {
    restoreDetailContent(sectionId);
  }
}

function reinitSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  // Re-reveal
  revealElementsInSection(section);

  // Re-init sparklines
  section.querySelectorAll('[data-spark]').forEach(c => {
    spark(c, c.dataset.spark.split(',').map(Number), c.dataset.color || '#007AFF');
  });

  // Re-init bar fills
  section.querySelectorAll('.bf').forEach(b => {
    if (!b.style.getPropertyValue('--w')) {
      const w = b.style.width; b.style.setProperty('--w', w); b.style.width = '0';
    }
  });

  // Re-init drag handles and resize handles (re-attach listeners even if elements exist)
  section.querySelectorAll('.draggable').forEach(card => {
    let handle = card.querySelector('.drag-handle');
    if (!handle) {
      card.removeAttribute('draggable');
      handle = document.createElement('div');
      handle.className = 'drag-handle';
      for (let i = 0; i < 6; i++) handle.appendChild(document.createElement('span'));
      card.appendChild(handle);
    }
    handle.onmousedown = e => {
      e.preventDefault();
      const dragEvt = new CustomEvent('_dragstart', { detail: { card, x: e.clientX, y: e.clientY } });
      document.dispatchEvent(dragEvt);
    };
    let rh = card.querySelector('.resize-handle');
    if (!rh) {
      rh = document.createElement('div');
      rh.className = 'resize-handle';
      card.appendChild(rh);
    }
    let sx, sy, sw, sh;
    rh.onmousedown = e => {
      e.preventDefault(); e.stopPropagation();
      sx = e.clientX; sy = e.clientY; sw = card.offsetWidth; sh = card.offsetHeight;
      function dr(ev) { card.style.width = Math.max(200, sw + (ev.clientX - sx)) + 'px'; card.style.height = Math.max(120, sh + (ev.clientY - sy)) + 'px'; card.style.minHeight = card.style.height }
      function sr() { document.removeEventListener('mousemove', dr); document.removeEventListener('mouseup', sr); const cv = card.querySelector('canvas:not(.kpi-spark)'); if (cv && cv.id && canvasToChart[cv.id] && charts[canvasToChart[cv.id]]) setTimeout(() => charts[canvasToChart[cv.id]].resize(), 50); if (card.querySelector('#map') && window._lincMap) setTimeout(() => window._lincMap.invalidateSize(), 50) }
      document.addEventListener('mousemove', dr); document.addEventListener('mouseup', sr);
    };
  });

  // Re-init project expand buttons
  section.querySelectorAll('.proj-expand-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const card = btn.closest('.card-project');
      if (card) card.classList.toggle('expanded');
    });
  });

  // Re-add Ver detalle buttons for projects
  section.querySelectorAll('.card-project[data-project-id]').forEach(card => {
    let btn = card.querySelector('.detail-trigger-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'detail-trigger-btn';
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg> Ver detalle';
      const expandBtn = card.querySelector('.proj-expand-btn');
      if (expandBtn) card.insertBefore(btn, expandBtn); else card.appendChild(btn);
    }
    btn.onclick = e => { e.stopPropagation(); card.classList.add('click-feedback'); setTimeout(() => card.classList.remove('click-feedback'), 200); renderProjectDetail(card.dataset.projectId) };
  });

  // Re-add Ver perfil buttons for employees
  section.querySelectorAll('.emp-card[data-employee-id]').forEach(card => {
    let btn = card.querySelector('.detail-trigger-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'detail-trigger-btn';
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> Ver perfil';
      card.appendChild(btn);
    }
    btn.onclick = e => { e.stopPropagation(); card.classList.add('click-feedback'); setTimeout(() => card.classList.remove('click-feedback'), 200); renderEmployeeDetail(card.dataset.employeeId) };
  });

  // Re-add admin row clickable
  section.querySelectorAll('.admin-row-clickable[data-user-id]').forEach(row => {
    row.onclick = e => {
      if (e.target.closest('.action-btn')) return;
      renderUserDetail(row.dataset.userId);
    };
  });

  // Rebuild charts if needed
  if (sectionId === 'overview' || sectionId === 'delivery' || sectionId === 'talent' || sectionId === 'biometrics') {
    buildCharts();
    resizeChartsInSection(section);
  }

  // Inline edit re-init
  '.kpi-label,.kpi-val,.card-head h3,.section-head h2,.section-count'.split(',').forEach(sel => {
    section.querySelectorAll(sel).forEach(el => {
      el.classList.add('editable-hint');
      el.addEventListener('dblclick', e => {
        e.stopPropagation();
        el.setAttribute('contenteditable', 'true');
        el.focus();
        const r = document.createRange(); r.selectNodeContents(el);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      });
      el.addEventListener('blur', () => el.removeAttribute('contenteditable'));
      el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur() } if (e.key === 'Escape') el.blur() });
    });
  });

  // Filters re-init
  const filterSection = section.querySelector('.filters-section');
  if (filterSection) {
    const header = filterSection.querySelector('.filters-header');
    const clearBtn = filterSection.querySelector('#filtersClear');
    const applyBtn = filterSection.querySelector('#filtersApply');
    if (header) header.addEventListener('click', () => filterSection.classList.toggle('collapsed'));
    if (clearBtn) clearBtn.addEventListener('click', e => {
      e.stopPropagation();
      filterSection.querySelectorAll('.filter-select').forEach(s => { s.value = ''; s.dispatchEvent(new Event('change')) });
    });
    if (applyBtn) applyBtn.addEventListener('click', e => {
      e.stopPropagation();
      applyBtn.textContent = 'Aplicado'; applyBtn.style.background = '#34C759';
      setTimeout(() => { applyBtn.textContent = 'Aplicar'; applyBtn.style.background = '' }, 1200);
    });
    filterSection.querySelectorAll('.filter-select').forEach(s => {
      s.addEventListener('change', () => {
        if (s.value) { s.style.borderColor = 'var(--blue)'; s.style.background = 'var(--blue-subtle)' }
        else { s.style.borderColor = ''; s.style.background = '' }
      });
    });
  }
}

// ===== PROJECT DETAIL DATA =====
const projectData = {
  web: {
    name: 'Plataforma Web', color: '#007AFF', team: 42, budget: '$180K', deadline: 'Jun 2026', progress: 92, status: 'En curso',
    tags: ['React', 'Node', 'AWS'],
    milestones: [{ title: 'Diseno de arquitectura', date: 'Oct 2025', status: 'done' }, { title: 'MVP lanzado', date: 'Dic 2025', status: 'done' }, { title: 'Integracion API', date: 'Feb 2026', status: 'done' }, { title: 'Testing final', date: 'May 2026', status: 'active' }],
    team_members: [{ initials: 'AC', name: 'Ana Castillo', role: 'Lead Developer' }, { initials: 'CM', name: 'Carlos Mendez', role: 'DevOps' }, { initials: 'JP', name: 'Juan Perez', role: 'Backend Dev' }, { initials: 'LG', name: 'Laura Garcia', role: 'Frontend Dev' }, { initials: 'MR', name: 'Miguel Reyes', role: 'QA Engineer' }, { initials: 'PD', name: 'Paula Diaz', role: 'UX Designer' }],
    activities: [{ text: 'Deploy v2.4.1 a produccion', time: 'Hace 2h', color: 'var(--green)' }, { text: 'PR #342 merged: Fix auth flow', time: 'Hace 4h', color: 'var(--blue)' }, { text: 'Sprint 25 completado (48/50 pts)', time: 'Hace 1d', color: 'var(--indigo)' }, { text: 'Bug critico resuelto: memory leak', time: 'Hace 2d', color: 'var(--red)' }, { text: 'Nuevo endpoint /api/v3/reports', time: 'Hace 3d', color: 'var(--orange)' }],
    budget_breakdown: { labels: ['Infraestructura', 'Salarios', 'Herramientas', 'Testing', 'Contingencia'], data: [25, 55, 8, 7, 5], colors: ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#AF52DE'] }
  },
  mobile: {
    name: 'App Mobile', color: '#5856D6', team: 38, budget: '$150K', deadline: 'Ago 2026', progress: 65, status: 'En curso',
    tags: ['React Native', 'Firebase'],
    milestones: [{ title: 'Prototipo UI', date: 'Nov 2025', status: 'done' }, { title: 'Auth & onboarding', date: 'Ene 2026', status: 'done' }, { title: 'Modulo de pagos', date: 'Abr 2026', status: 'active' }, { title: 'Beta testing', date: 'Jul 2026', status: 'pending' }],
    team_members: [{ initials: 'MT', name: 'Maria Torres', role: 'UX Lead' }, { initials: 'RV', name: 'Roberto Vargas', role: 'Mobile Dev' }, { initials: 'LS', name: 'Lucia Santos', role: 'iOS Dev' }, { initials: 'FH', name: 'Fernando Herrera', role: 'Android Dev' }],
    activities: [{ text: 'Push notification system integrado', time: 'Hace 3h', color: 'var(--blue)' }, { text: 'Modulo de pagos en review', time: 'Hace 1d', color: 'var(--orange)' }, { text: 'Build 2.1.0-beta publicado', time: 'Hace 2d', color: 'var(--green)' }],
    budget_breakdown: { labels: ['Infraestructura', 'Salarios', 'Herramientas', 'QA', 'Contingencia'], data: [20, 58, 10, 7, 5], colors: ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#AF52DE'] }
  },
  api: {
    name: 'Backend API', color: '#AF52DE', team: 35, budget: '$120K', deadline: 'May 2026', progress: 88, status: 'En curso',
    tags: ['Python', 'FastAPI', 'PostgreSQL'],
    milestones: [{ title: 'Schema & modelos', date: 'Sep 2025', status: 'done' }, { title: 'Endpoints CRUD', date: 'Nov 2025', status: 'done' }, { title: 'Auth JWT', date: 'Ene 2026', status: 'done' }, { title: 'Optimizacion & cache', date: 'Abr 2026', status: 'active' }],
    team_members: [{ initials: 'JP', name: 'Juan Perez', role: 'Backend Lead' }, { initials: 'SR', name: 'Sofia Ramirez', role: 'Data Engineer' }, { initials: 'AV', name: 'Andres Vega', role: 'Backend Dev' }],
    activities: [{ text: 'Cache layer Redis implementado', time: 'Hace 5h', color: 'var(--blue)' }, { text: 'Latencia reducida 40%', time: 'Hace 1d', color: 'var(--green)' }, { text: 'Endpoint /v3/analytics desplegado', time: 'Hace 2d', color: 'var(--indigo)' }],
    budget_breakdown: { labels: ['Infraestructura', 'Salarios', 'DB', 'Herramientas', 'Contingencia'], data: [22, 52, 12, 8, 6], colors: ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#AF52DE'] }
  },
  data: {
    name: 'Data Analytics', color: '#FF9500', team: 28, budget: '$95K', deadline: 'Oct 2026', progress: 45, status: 'En curso',
    tags: ['Python', 'Spark', 'Tableau'],
    milestones: [{ title: 'Pipeline ETL', date: 'Dic 2025', status: 'done' }, { title: 'Dashboard de metricas', date: 'Mar 2026', status: 'active' }, { title: 'Modelos predictivos', date: 'Jul 2026', status: 'pending' }, { title: 'Reportes automaticos', date: 'Oct 2026', status: 'pending' }],
    team_members: [{ initials: 'SR', name: 'Sofia Ramirez', role: 'Data Lead' }, { initials: 'EO', name: 'Elena Ortiz', role: 'Data Scientist' }, { initials: 'GF', name: 'Gabriel Flores', role: 'BI Analyst' }],
    activities: [{ text: 'Dashboard v1 en staging', time: 'Hace 6h', color: 'var(--blue)' }, { text: 'Pipeline ETL optimizado', time: 'Hace 2d', color: 'var(--green)' }],
    budget_breakdown: { labels: ['Cloud', 'Salarios', 'Licencias', 'Herramientas', 'Contingencia'], data: [28, 48, 12, 7, 5], colors: ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#AF52DE'] }
  },
  infra: {
    name: 'Infraestructura', color: '#34C759', team: 25, budget: '$200K', deadline: 'Jul 2026', progress: 72, status: 'En curso',
    tags: ['Terraform', 'K8s', 'AWS'],
    milestones: [{ title: 'IaC base', date: 'Oct 2025', status: 'done' }, { title: 'CI/CD pipelines', date: 'Ene 2026', status: 'done' }, { title: 'Monitoring & alertas', date: 'Abr 2026', status: 'active' }, { title: 'DR & failover', date: 'Jul 2026', status: 'pending' }],
    team_members: [{ initials: 'CM', name: 'Carlos Mendez', role: 'DevOps Lead' }, { initials: 'RM', name: 'Ricardo Munoz', role: 'SRE' }, { initials: 'PL', name: 'Patricia Luna', role: 'Cloud Architect' }],
    activities: [{ text: 'Alertas Datadog configuradas', time: 'Hace 4h', color: 'var(--orange)' }, { text: 'K8s cluster escalado a 12 nodos', time: 'Hace 1d', color: 'var(--blue)' }],
    budget_breakdown: { labels: ['Cloud AWS', 'Salarios', 'Licencias', 'Monitoring', 'Contingencia'], data: [35, 42, 10, 8, 5], colors: ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#AF52DE'] }
  },
  qa: {
    name: 'QA & Testing', color: '#5AC8FA', team: 22, budget: '$60K', deadline: 'Completado', progress: 100, status: 'Completado',
    tags: ['Selenium', 'Jest', 'Cypress'],
    milestones: [{ title: 'Framework setup', date: 'Ago 2025', status: 'done' }, { title: 'Test suites E2E', date: 'Oct 2025', status: 'done' }, { title: 'Integracion CI', date: 'Dic 2025', status: 'done' }, { title: 'Cobertura 95%', date: 'Feb 2026', status: 'done' }],
    team_members: [{ initials: 'DL', name: 'Diego Lopez', role: 'QA Lead' }, { initials: 'IV', name: 'Isabel Varela', role: 'QA Engineer' }, { initials: 'NK', name: 'Nicolas Kern', role: 'Automation' }],
    activities: [{ text: 'Coverage report: 95.2%', time: 'Hace 1d', color: 'var(--green)' }, { text: 'Regression suite pasada 100%', time: 'Hace 3d', color: 'var(--green)' }],
    budget_breakdown: { labels: ['Herramientas', 'Salarios', 'Cloud', 'Licencias', 'Contingencia'], data: [15, 58, 12, 10, 5], colors: ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#AF52DE'] }
  },
  devops: {
    name: 'DevOps', color: '#FF3B30', team: 18, budget: '$85K', deadline: 'Sep 2026', progress: 80, status: 'En curso',
    tags: ['Docker', 'Jenkins', 'ArgoCD'],
    milestones: [{ title: 'Containerizacion', date: 'Sep 2025', status: 'done' }, { title: 'Pipeline CI/CD', date: 'Dic 2025', status: 'done' }, { title: 'GitOps workflow', date: 'Mar 2026', status: 'active' }, { title: 'Auto-scaling', date: 'Sep 2026', status: 'pending' }],
    team_members: [{ initials: 'CM', name: 'Carlos Mendez', role: 'DevOps Lead' }, { initials: 'JR', name: 'Javier Rios', role: 'SRE' }],
    activities: [{ text: 'ArgoCD sync configurado', time: 'Hace 8h', color: 'var(--blue)' }, { text: 'Rollback automatico habilitado', time: 'Hace 2d', color: 'var(--green)' }],
    budget_breakdown: { labels: ['Herramientas', 'Salarios', 'Cloud', 'Licencias', 'Contingencia'], data: [18, 50, 18, 8, 6], colors: ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#AF52DE'] }
  },
  uxui: {
    name: 'UX/UI Design', color: '#AF52DE', team: 15, budget: '$70K', deadline: 'Nov 2026', progress: 55, status: 'En curso',
    tags: ['Figma', 'Storybook'],
    milestones: [{ title: 'Design system', date: 'Nov 2025', status: 'done' }, { title: 'Component library', date: 'Mar 2026', status: 'active' }, { title: 'User testing', date: 'Jul 2026', status: 'pending' }, { title: 'Handoff final', date: 'Nov 2026', status: 'pending' }],
    team_members: [{ initials: 'MT', name: 'Maria Torres', role: 'UX Lead' }, { initials: 'AG', name: 'Andrea Gomez', role: 'UI Designer' }, { initials: 'CV', name: 'Camila Vega', role: 'Motion Designer' }],
    activities: [{ text: 'Component library 60% completa', time: 'Hace 3h', color: 'var(--indigo)' }, { text: 'Design tokens actualizados', time: 'Hace 1d', color: 'var(--blue)' }],
    budget_breakdown: { labels: ['Licencias', 'Salarios', 'Hardware', 'Testing', 'Contingencia'], data: [12, 60, 10, 10, 8], colors: ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#AF52DE'] }
  },
  soporte: {
    name: 'Soporte', color: '#00C7BE', team: 25, budget: '$45K', deadline: 'Continuo', progress: 100, status: 'En curso',
    tags: ['Zendesk', 'Jira'],
    milestones: [{ title: 'Sistema de tickets', date: 'Ago 2025', status: 'done' }, { title: 'SLA definidos', date: 'Oct 2025', status: 'done' }, { title: 'Automatizacion', date: 'Mar 2026', status: 'active' }, { title: 'Chatbot IA', date: 'Jun 2026', status: 'pending' }],
    team_members: [{ initials: 'LM', name: 'Luis Martinez', role: 'Support Lead' }, { initials: 'AH', name: 'Ana Herrera', role: 'Support Eng' }, { initials: 'RB', name: 'Rosa Benitez', role: 'Support Eng' }],
    activities: [{ text: 'SLA cumplimiento: 98.5%', time: 'Hace 1h', color: 'var(--green)' }, { text: '142 tickets resueltos esta semana', time: 'Hace 6h', color: 'var(--blue)' }],
    budget_breakdown: { labels: ['Herramientas', 'Salarios', 'Cloud', 'Formacion', 'Contingencia'], data: [15, 55, 12, 10, 8], colors: ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#AF52DE'] }
  }
};

function renderProjectDetail(projectId) {
  const p = projectData[projectId];
  if (!p) return;

  const barClass = p.progress >= 85 ? 'crit' : p.progress >= 70 ? 'warn' : 'ok';
  const html = `
    <button class="back-btn" onclick="goBackFromDetail('projects')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      Volver a Proyectos
    </button>
    <div class="detail-header">
      <span class="dot" style="--c:${p.color};width:12px;height:12px;border-radius:6px;flex-shrink:0;background:${p.color};box-shadow:0 0 12px ${p.color}50"></span>
      <h2 class="detail-title">${p.name}</h2>
      <span class="badge ok" style="margin-left:auto">${p.status}</span>
    </div>

    <div class="detail-info-grid">
      <div class="detail-stat-card"><div class="detail-stat-label">Equipo</div><div class="detail-stat-val">${p.team}</div></div>
      <div class="detail-stat-card"><div class="detail-stat-label">Presupuesto</div><div class="detail-stat-val">${p.budget}</div></div>
      <div class="detail-stat-card"><div class="detail-stat-label">Deadline</div><div class="detail-stat-val">${p.deadline}</div></div>
      <div class="detail-stat-card"><div class="detail-stat-label">Progreso</div>
        <div class="detail-stat-val">${p.progress}%</div>
        <div class="bc" style="margin-top:8px"><div class="bt"><div class="bf ${barClass}" style="width:${p.progress}%;--w:${p.progress}%"></div></div></div>
      </div>
    </div>

    <div class="detail-section-label">Hitos del proyecto</div>
    <div class="detail-timeline">
      ${p.milestones.map(m => `
        <div class="detail-timeline-item ${m.status}">
          <span class="tl-title">${m.title}</span>
          <span class="tl-date">${m.date}</span>
        </div>
      `).join('')}
    </div>

    <div class="detail-section-label">Equipo (${p.team_members.length} miembros)</div>
    <div class="detail-team-grid">
      ${p.team_members.map(m => `
        <div class="detail-member-card">
          <div class="detail-member-avatar">${m.initials}</div>
          <div class="detail-member-name">${m.name}</div>
          <div class="detail-member-role">${m.role}</div>
        </div>
      `).join('')}
    </div>

    <div class="detail-section-label">Actividad reciente</div>
    <div class="detail-activity-feed">
      ${p.activities.map(a => `
        <div class="detail-activity-item">
          <div class="detail-activity-dot" style="background:${a.color}"></div>
          <div class="detail-activity-text">${a.text}</div>
          <div class="detail-activity-time">${a.time}</div>
        </div>
      `).join('')}
    </div>

    <div class="detail-section-label">Desglose de presupuesto</div>
    <div class="detail-chart-wrap">
      <div class="card"><div class="cw"><canvas id="detailBudgetChart"></canvas></div></div>
    </div>
  `;

  showDetailView('projects', html);

  // Build budget chart
  setTimeout(() => {
    const cv = document.getElementById('detailBudgetChart');
    if (!cv) return;
    const c = getTC(), dk = TM.dark(), dbrd = dk ? 'rgba(0,145,234,.08)' : 'rgba(255,255,255,.5)';
    new Chart(cv, {
      type: 'doughnut', data: {
        labels: p.budget_breakdown.labels,
        datasets: [{ data: p.budget_breakdown.data, backgroundColor: p.budget_breakdown.colors.map(x => x + '50'), borderColor: dbrd, borderWidth: 1, spacing: 2 }]
      }, options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { labels: { color: c.text, font: { size: 12 }, usePointStyle: true, pointStyle: 'circle', padding: 12 } }, tooltip: { ...mkTip(), callbacks: { label: x => `${x.label}: ${x.parsed}%` } } } }
    });
  }, 100);
}

// ===== EMPLOYEE DETAIL DATA =====
const employeeData = {
  ac: {
    name: 'Ana Castillo', initials: 'AC', position: 'Lead Developer', dept: 'Ingenieria', deptColor: 'var(--blue)',
    c1: 'var(--blue)', c2: 'var(--indigo)', attendance: 98, hours: '9.2h', entry: '07:55', exit: '17:10', punctuality: 96,
    checkins: [
      { date: '02 Abr', entry: '07:55', exit: '17:10', hours: '9.2h' }, { date: '01 Abr', entry: '07:50', exit: '17:05', hours: '9.3h' },
      { date: '31 Mar', entry: '08:02', exit: '17:15', hours: '9.2h' }, { date: '30 Mar', entry: '07:48', exit: '17:00', hours: '9.2h' },
      { date: '29 Mar', entry: '07:55', exit: '17:10', hours: '9.3h' }, { date: '28 Mar', entry: '08:00', exit: '17:20', hours: '9.3h' },
      { date: '27 Mar', entry: '07:52', exit: '17:05', hours: '9.2h' }, { date: '26 Mar', entry: '07:58', exit: '17:12', hours: '9.2h' },
      { date: '25 Mar', entry: '08:05', exit: '17:30', hours: '9.4h' }, { date: '24 Mar', entry: '07:50', exit: '17:00', hours: '9.2h' }
    ]
  },
  cm: {
    name: 'Carlos Mendez', initials: 'CM', position: 'DevOps Engineer', dept: 'Operaciones', deptColor: 'var(--green)',
    c1: 'var(--green)', c2: 'var(--teal)', attendance: 96, hours: '9.5h', entry: '08:02', exit: '17:30', punctuality: 92,
    checkins: [
      { date: '02 Abr', entry: '08:02', exit: '17:30', hours: '9.5h' }, { date: '01 Abr', entry: '08:10', exit: '17:45', hours: '9.6h' },
      { date: '31 Mar', entry: '08:00', exit: '17:20', hours: '9.3h' }, { date: '30 Mar', entry: '08:05', exit: '17:35', hours: '9.5h' },
      { date: '29 Mar', entry: '08:15', exit: '17:40', hours: '9.4h' }, { date: '28 Mar', entry: '08:00', exit: '17:25', hours: '9.4h' }
    ]
  },
  mt: {
    name: 'Maria Torres', initials: 'MT', position: 'UX Designer', dept: 'Diseno', deptColor: 'var(--purple)',
    c1: 'var(--purple)', c2: 'var(--pink)', attendance: 95, hours: '8.8h', entry: '08:15', exit: '17:00', punctuality: 90,
    checkins: [
      { date: '02 Abr', entry: '08:15', exit: '17:00', hours: '8.8h' }, { date: '01 Abr', entry: '08:20', exit: '17:10', hours: '8.8h' },
      { date: '31 Mar', entry: '08:10', exit: '16:55', hours: '8.8h' }, { date: '30 Mar', entry: '08:25', exit: '17:15', hours: '8.8h' }
    ]
  },
  jp: {
    name: 'Juan Perez', initials: 'JP', position: 'Backend Developer', dept: 'Ingenieria', deptColor: 'var(--orange)',
    c1: 'var(--orange)', c2: 'var(--red)', attendance: 91, hours: '9.3h', entry: '08:30', exit: '17:45', punctuality: 85,
    checkins: [
      { date: '02 Abr', entry: '08:30', exit: '17:45', hours: '9.3h' }, { date: '01 Abr', entry: '08:35', exit: '17:50', hours: '9.3h' },
      { date: '31 Mar', entry: '08:25', exit: '17:40', hours: '9.3h' }, { date: '30 Mar', entry: '08:45', exit: '18:00', hours: '9.3h' }
    ]
  },
  sr: {
    name: 'Sofia Ramirez', initials: 'SR', position: 'Data Engineer', dept: 'Datos', deptColor: 'var(--indigo)',
    c1: 'var(--indigo)', c2: 'var(--blue)', attendance: 97, hours: '9.1h', entry: '07:45', exit: '16:50', punctuality: 97,
    checkins: [
      { date: '02 Abr', entry: '07:45', exit: '16:50', hours: '9.1h' }, { date: '01 Abr', entry: '07:40', exit: '16:45', hours: '9.1h' },
      { date: '31 Mar', entry: '07:48', exit: '16:55', hours: '9.1h' }, { date: '30 Mar', entry: '07:42', exit: '16:48', hours: '9.1h' }
    ]
  },
  dl: {
    name: 'Diego Lopez', initials: 'DL', position: 'QA Lead', dept: 'Calidad', deptColor: 'var(--red)',
    c1: 'var(--red)', c2: 'var(--orange)', attendance: 99, hours: '9.3h', entry: '08:00', exit: '17:15', punctuality: 98,
    checkins: [
      { date: '02 Abr', entry: '08:00', exit: '17:15', hours: '9.3h' }, { date: '01 Abr', entry: '07:58', exit: '17:10', hours: '9.2h' },
      { date: '31 Mar', entry: '08:02', exit: '17:20', hours: '9.3h' }, { date: '30 Mar', entry: '08:00', exit: '17:15', hours: '9.3h' }
    ]
  }
};

function renderEmployeeDetail(empId) {
  const e = employeeData[empId];
  if (!e) return;

  const html = `
    <button class="back-btn" onclick="goBackFromDetail('biometrics')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      Volver a Biometricos
    </button>

    <div class="detail-emp-header">
      <div class="detail-emp-avatar-lg" style="background:linear-gradient(135deg,${e.c1},${e.c2})">${e.initials}</div>
      <div class="detail-emp-meta">
        <div class="detail-emp-name">${e.name}</div>
        <div class="detail-emp-position">${e.position}</div>
        <span class="emp-dept" style="--dept-c:${e.deptColor}">${e.dept}</span>
      </div>
    </div>

    <div class="detail-info-grid">
      <div class="detail-stat-card"><div class="detail-stat-label">Asistencia</div><div class="detail-stat-val">${e.attendance}%</div></div>
      <div class="detail-stat-card"><div class="detail-stat-label">Horas/dia</div><div class="detail-stat-val">${e.hours}</div></div>
      <div class="detail-stat-card"><div class="detail-stat-label">Entrada promedio</div><div class="detail-stat-val">${e.entry}</div></div>
      <div class="detail-stat-card"><div class="detail-stat-label">Salida promedio</div><div class="detail-stat-val">${e.exit}</div></div>
    </div>

    <div class="detail-section-label">Puntualidad</div>
    <div class="card" style="margin-bottom:var(--sp-6)">
      <div class="detail-gauge">
        <div class="detail-gauge-circle" style="--gauge-pct:${e.punctuality}">
          <span class="detail-gauge-val">${e.punctuality}%</span>
        </div>
        <div class="detail-gauge-label">Puntualidad mensual</div>
      </div>
    </div>

    <div class="detail-section-label">Horas diarias</div>
    <div class="card" style="margin-bottom:var(--sp-6)">
      <div class="cw"><canvas id="detailHoursChart"></canvas></div>
    </div>

    <div class="detail-section-label">Historial de marcaje (ultimos registros)</div>
    <div class="detail-table-wrap">
      <div class="card card-table">
        <div class="tbl-scroll">
          <table class="tbl">
            <thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th class="r">Horas</th></tr></thead>
            <tbody>
              ${e.checkins.map(c => `<tr><td class="mono">${c.date}</td><td class="mono">${c.entry}</td><td class="mono">${c.exit}</td><td class="mono r">${c.hours}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  showDetailView('biometrics', html);

  // Build hours chart
  setTimeout(() => {
    const cv = document.getElementById('detailHoursChart');
    if (!cv) return;
    const o = mkOpts();
    const days = e.checkins.map(c => c.date).reverse();
    const hrs = e.checkins.map(c => parseFloat(c.hours)).reverse();
    const dk = TM.dark();
    new Chart(cv, { type: 'bar', data: { labels: days, datasets: [{ label: 'Horas', data: hrs, backgroundColor: dk ? '#0A1F3A' : '#E0ECFF', borderColor: '#007AFF', borderWidth: 1, borderRadius: 6 }] }, options: { ...o, plugins: { ...o.plugins, legend: { display: false } } } });
  }, 100);
}

// ===== USER DETAIL DATA =====
const userData = {
  ac: {
    name: 'Ana Castillo', initials: 'AC', email: 'a.castillo@linktic.com', role: 'Admin', status: 'Activo', lastLogin: '02 Abr 2026', c1: 'var(--blue)', c2: 'var(--indigo)',
    permissions: [{ name: 'Dashboard', allowed: true }, { name: 'Proyectos', allowed: true }, { name: 'Biometricos', allowed: true }, { name: 'Admin', allowed: true }, { name: 'Exportar datos', allowed: true }, { name: 'Eliminar usuarios', allowed: true }],
    activity: [{ action: 'Login', resource: 'Dashboard principal', time: '09:42', badge: 'log-login' }, { action: 'Create', resource: 'Sprint 26', time: '09:15', badge: 'log-create' }, { action: 'Edit', resource: 'Config equipo', time: '08:50', badge: 'log-edit' }],
    sessions: [{ ip: '192.168.1.105', device: 'Chrome / macOS', time: '02 Abr 09:42' }, { ip: '192.168.1.105', device: 'Chrome / macOS', time: '01 Abr 14:20' }, { ip: '10.0.0.55', device: 'Safari / iOS', time: '31 Mar 08:15' }]
  },
  cm: {
    name: 'Carlos Mendez', initials: 'CM', email: 'c.mendez@linktic.com', role: 'Editor', status: 'Activo', lastLogin: '02 Abr 2026', c1: 'var(--green)', c2: 'var(--teal)',
    permissions: [{ name: 'Dashboard', allowed: true }, { name: 'Proyectos', allowed: true }, { name: 'Biometricos', allowed: true }, { name: 'Admin', allowed: false }, { name: 'Exportar datos', allowed: true }, { name: 'Eliminar usuarios', allowed: false }],
    activity: [{ action: 'Edit', resource: 'Config servidor #3', time: '09:38', badge: 'log-edit' }, { action: 'Edit', resource: 'Pipeline CI/CD', time: '09:10', badge: 'log-edit' }],
    sessions: [{ ip: '192.168.1.112', device: 'Firefox / Linux', time: '02 Abr 09:38' }, { ip: '192.168.1.112', device: 'Firefox / Linux', time: '01 Abr 10:05' }]
  },
  mt: {
    name: 'Maria Torres', initials: 'MT', email: 'm.torres@linktic.com', role: 'Editor', status: 'Activo', lastLogin: '01 Abr 2026', c1: 'var(--purple)', c2: 'var(--pink)',
    permissions: [{ name: 'Dashboard', allowed: true }, { name: 'Proyectos', allowed: true }, { name: 'Biometricos', allowed: false }, { name: 'Admin', allowed: false }, { name: 'Exportar datos', allowed: true }, { name: 'Eliminar usuarios', allowed: false }],
    activity: [{ action: 'Create', resource: 'Componente UI/Header', time: '09:35', badge: 'log-create' }],
    sessions: [{ ip: '10.0.0.45', device: 'Chrome / macOS', time: '01 Abr 09:35' }]
  },
  jp: {
    name: 'Juan Perez', initials: 'JP', email: 'j.perez@linktic.com', role: 'Viewer', status: 'Activo', lastLogin: '31 Mar 2026', c1: 'var(--orange)', c2: 'var(--red)',
    permissions: [{ name: 'Dashboard', allowed: true }, { name: 'Proyectos', allowed: true }, { name: 'Biometricos', allowed: false }, { name: 'Admin', allowed: false }, { name: 'Exportar datos', allowed: false }, { name: 'Eliminar usuarios', allowed: false }],
    activity: [{ action: 'Edit', resource: 'API endpoint /users', time: '09:30', badge: 'log-edit' }, { action: 'Login', resource: 'Dashboard', time: '09:05', badge: 'log-login' }],
    sessions: [{ ip: '192.168.1.98', device: 'Chrome / Windows', time: '31 Mar 09:05' }]
  },
  sr: {
    name: 'Sofia Ramirez', initials: 'SR', email: 's.ramirez@linktic.com', role: 'Editor', status: 'Inactivo', lastLogin: '28 Mar 2026', c1: 'var(--indigo)', c2: 'var(--blue)',
    permissions: [{ name: 'Dashboard', allowed: true }, { name: 'Proyectos', allowed: true }, { name: 'Biometricos', allowed: true }, { name: 'Admin', allowed: false }, { name: 'Exportar datos', allowed: true }, { name: 'Eliminar usuarios', allowed: false }],
    activity: [{ action: 'Login', resource: 'Panel de datos', time: '09:25', badge: 'log-login' }],
    sessions: [{ ip: '10.0.0.78', device: 'Chrome / macOS', time: '28 Mar 09:25' }]
  },
  dl: {
    name: 'Diego Lopez', initials: 'DL', email: 'd.lopez@linktic.com', role: 'Admin', status: 'Activo', lastLogin: '02 Abr 2026', c1: 'var(--red)', c2: 'var(--orange)',
    permissions: [{ name: 'Dashboard', allowed: true }, { name: 'Proyectos', allowed: true }, { name: 'Biometricos', allowed: true }, { name: 'Admin', allowed: true }, { name: 'Exportar datos', allowed: true }, { name: 'Eliminar usuarios', allowed: true }],
    activity: [{ action: 'Delete', resource: 'Test suite #42', time: '09:20', badge: 'log-delete' }, { action: 'Create', resource: 'Test E2E checkout', time: '08:58', badge: 'log-create' }],
    sessions: [{ ip: '192.168.1.130', device: 'Chrome / macOS', time: '02 Abr 09:20' }, { ip: '192.168.1.130', device: 'Chrome / macOS', time: '01 Abr 15:30' }]
  }
};

function renderUserDetail(userId) {
  const u = userData[userId];
  if (!u) return;

  const statusClass = u.status === 'Activo' ? 'ok' : 'crit';
  const html = `
    <button class="back-btn" onclick="goBackFromDetail('admin')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      Volver a Admin
    </button>

    <div class="detail-user-profile">
      <div class="detail-member-avatar" style="background:linear-gradient(135deg,${u.c1},${u.c2});width:64px;height:64px;font-size:22px">${u.initials}</div>
      <div class="detail-user-info">
        <div class="name">${u.name}</div>
        <div class="email">${u.email}</div>
        <div class="meta">
          <span class="badge-role ${u.role.toLowerCase()}">${u.role}</span>
          <span class="badge ${statusClass}">${u.status}</span>
        </div>
      </div>
      <div style="text-align:right;font:400 12px/16px var(--mono);color:var(--txt3)">Ultimo acceso<br><strong style="color:var(--txt)">${u.lastLogin}</strong></div>
    </div>

    <div class="detail-section-label">Actividad reciente</div>
    <div class="detail-activity-feed">
      ${u.activity.map(a => `
        <div class="detail-activity-item">
          <span class="log-badge ${a.badge}">${a.action}</span>
          <div class="detail-activity-text">${a.resource}</div>
          <div class="detail-activity-time">${a.time}</div>
        </div>
      `).join('')}
    </div>

    <div class="detail-section-label">Permisos</div>
    <div class="detail-perm-grid">
      ${u.permissions.map(p => `
        <div class="detail-perm-item">
          <span class="detail-perm-name">${p.name}</span>
          <span class="detail-perm-check ${p.allowed ? 'allowed' : 'denied'}">${p.allowed ? '&#10003;' : '&#10005;'}</span>
        </div>
      `).join('')}
    </div>

    <div class="detail-section-label">Historial de sesiones</div>
    <div class="card" style="margin-bottom:var(--sp-6)">
      ${u.sessions.map(s => `
        <div class="detail-session-item">
          <span class="detail-session-ip">${s.ip}</span>
          <span class="detail-session-device">${s.device}</span>
          <span class="detail-session-time">${s.time}</span>
        </div>
      `).join('')}
    </div>
  `;

  showDetailView('admin', html);
}

// ===== ADMIN ROW CLICK HANDLERS =====
document.querySelectorAll('.admin-row-clickable[data-user-id]').forEach(row => {
  row.onclick = e => {
    if (e.target.closest('.action-btn')) return;
    renderUserDetail(row.dataset.userId);
  };
});

// ===== RE-REGISTER REVEAL + DRAGGABLES FOR NEW SECTIONS =====
// Add drag handles to new draggables that don't have them yet
document.querySelectorAll('.draggable').forEach(card => {
  if (card.querySelector('.drag-handle')) return;
  card.removeAttribute('draggable');
  const handle = document.createElement('div');
  handle.className = 'drag-handle';
  for (let i = 0; i < 6; i++) handle.appendChild(document.createElement('span'));
  card.appendChild(handle);
  const resize = document.createElement('div');
  resize.className = 'resize-handle';
  card.appendChild(resize);
});

// Re-init sparklines for new sections
document.querySelectorAll('[data-spark]').forEach(c => {
  spark(c, c.dataset.spark.split(',').map(Number), c.dataset.color || '#007AFF');
});

// ===== INSIGHT OVERLAY — Immersive Detail =====

const INSIGHT_DATA = {
  'chart-timeline': {
    datasets: [
      { name: 'Web', color: '#007AFF', data: [35, 38, 40, 42, 41, 42] },
      { name: 'Mobile', color: '#5856D6', data: [30, 32, 34, 36, 37, 38] },
      { name: 'API', color: '#AF52DE', data: [28, 30, 32, 33, 34, 35] },
      { name: 'DevOps', color: '#FF3B30', data: [12, 14, 15, 16, 17, 18] }
    ], labels: MO, xLabel: 'Mes', chartType: 'line'
  },
  'chart-sprint': {
    datasets: [
      { name: 'Plan', color: '#007AFF', data: [42, 45, 48, 44, 50, 47, 52, 55] },
      { name: 'Done', color: '#5856D6', data: [38, 43, 45, 40, 48, 45, 50, 53] }
    ], labels: ['S18', 'S19', 'S20', 'S21', 'S22', 'S23', 'S24', 'S25'], xLabel: 'Sprint', chartType: 'bar'
  },
  'chart-deploy': {
    datasets: [
      { name: 'Prod', color: '#007AFF', data: [18, 22, 28, 35, 42, 48] },
      { name: 'Stage', color: '#5856D6', data: [45, 52, 60, 68, 75, 82] },
      { name: 'Rollback', color: '#FF3B30', data: [3, 2, 4, 1, 2, 1] }
    ], labels: MO, xLabel: 'Mes', chartType: 'line'
  },
  'chart-bugs': {
    datasets: [
      { name: 'Crit', color: '#FF3B30', data: [12, 8, 10, 6, 4, 3] },
      { name: 'Major', color: '#FF9500', data: [28, 25, 22, 18, 15, 12] },
      { name: 'Minor', color: '#007AFF', data: [45, 42, 38, 35, 30, 28] }
    ], labels: MO, xLabel: 'Mes', chartType: 'line'
  },
  'chart-colab': {
    datasets: [
      { name: 'Colaboradores', color: '#007AFF', data: PD.collab }
    ], labels: PD.labels, xLabel: 'Proyecto', chartType: 'bar',
    multiColor: true, colors: PD.colors
  },
  'chart-carga': {
    datasets: [
      { name: 'Carga %', color: '#007AFF', data: PD.load }
    ], labels: PD.labels, xLabel: 'Proyecto', chartType: 'doughnut',
    multiColor: true, colors: PD.colors
  },
  'chart-retention': {
    datasets: [
      { name: 'Distribucion', color: '#10B981', data: [92, 5, 3] }
    ], labels: ['Retencion', 'Voluntaria', 'Involuntaria'], xLabel: 'Tipo', chartType: 'doughnut',
    multiColor: true, colors: ['#10B981', '#F59E0B', '#EF4444']
  },
  'chart-satisfaction': {
    datasets: [
      { name: 'eNPS', color: '#10B981', data: [62, 75, 80, 85, 58, 88, 42, 90, 70] }
    ], labels: PD.labels, xLabel: 'Proyecto', chartType: 'bar',
    multiColor: true, colors: PD.colors
  },
  'chart-revenue': {
    datasets: [
      { name: 'Rev/Emp (K)', color: '#007AFF', data: [28, 31, 29, 34, 38] },
      { name: 'Cost/Emp (K)', color: '#AF52DE', data: [22, 23, 22, 24, 25] }
    ], labels: ['Q1-24', 'Q2-24', 'Q3-24', 'Q4-24', 'Q1-25'], xLabel: 'Trimestre', chartType: 'line'
  },
  'chart-attendance': {
    datasets: [
      { name: 'Asistencia %', color: '#007AFF', data: [98, 97, 96, 94, 98, 97, 12, 8, 96, 93, 97, 98, 96, 10, 5, 97, 98, 92, 97, 96, 15, 6, 98, 94, 97, 96, 98, 45, 9, 97, 96] }
    ], labels: Array.from({ length: 31 }, (_, i) => String(i + 1)), xLabel: 'Dia', chartType: 'line'
  }
};

let insightChart = null;
let insightDatasetRefs = [];

function insightCalcStats(arr) {
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const sorted = [...arr].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length;
  const stddev = Math.sqrt(variance);
  return { min, max, avg: +avg.toFixed(2), median: +median.toFixed(2), stddev };
}

function insightIsAnomaly(val, avg, stddev) {
  return val > avg + 2 * stddev || val < avg - 2 * stddev;
}

function openInsight(widgetId) {
  const overlay = document.getElementById('insightOverlay');
  const title = document.getElementById('insightTitle');
  const body = document.getElementById('insightBody');

  const widget = WIDGET_CATALOG.find(w => w.id === widgetId);
  if (!widget) return;

  title.textContent = widget.name;

  if (widget.category === 'kpi') {
    body.innerHTML = renderKPIInsight(widget);
    setTimeout(() => buildKPIInsightChart(widget), 60);
  } else if (widget.category === 'chart') {
    body.innerHTML = renderChartInsight(widget);
    setTimeout(() => buildChartInsightChart(widgetId), 60);
  }

  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => overlay.classList.add('open'));
  setTimeout(() => document.getElementById('insightBack').focus(), 300);
}

function closeInsight() {
  const overlay = document.getElementById('insightOverlay');
  overlay.classList.remove('open');
  setTimeout(() => {
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (insightChart) { insightChart.destroy(); insightChart = null; }
    insightDatasetRefs = [];
  }, 350);
}

function renderKPIInsight(widget) {
  const sparkArr = widget.sparkData.split(',').map(Number);
  const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].slice(0, sparkArr.length);
  const stats = insightCalcStats(sparkArr);
  const changes = sparkArr.map((v, i) => i === 0 ? { abs: 0, pct: 0 } : {
    abs: +(v - sparkArr[i - 1]).toFixed(1),
    pct: sparkArr[i - 1] !== 0 ? +((v - sparkArr[i - 1]) / sparkArr[i - 1] * 100).toFixed(1) : 0
  });

  return `
    <div class="insight-hero">
      <div class="insight-hero-value">${widget.value}</div>
      ${widget.trend ? `<span class="insight-hero-trend ${widget.trendClass}">${widget.trend} vs mes anterior</span>` : ''}
      <div class="insight-hero-sub">Ultimo periodo de 12 meses</div>
    </div>

    <div class="insight-time-range">
      <button class="insight-range-btn" onclick="insightRangeClick(this)">1M</button>
      <button class="insight-range-btn" onclick="insightRangeClick(this)">3M</button>
      <button class="insight-range-btn active" onclick="insightRangeClick(this)">6M</button>
      <button class="insight-range-btn" onclick="insightRangeClick(this)">1A</button>
    </div>

    <div class="insight-chart-wrap">
      <canvas id="insightMainChart"></canvas>
    </div>

    <div class="insight-stats">
      <div class="insight-stat"><div class="insight-stat-label">Minimo</div><div class="insight-stat-value">${stats.min}</div></div>
      <div class="insight-stat"><div class="insight-stat-label">Maximo</div><div class="insight-stat-value">${stats.max}</div></div>
      <div class="insight-stat"><div class="insight-stat-label">Promedio</div><div class="insight-stat-value">${stats.avg}</div></div>
      <div class="insight-stat"><div class="insight-stat-label">Mediana</div><div class="insight-stat-value">${stats.median}</div></div>
    </div>

    <div class="insight-table-wrap">
      <div class="tbl-scroll">
      <table class="tbl">
        <thead><tr><th scope="col">Periodo</th><th scope="col" class="r">Valor</th><th scope="col" class="r">Cambio</th><th scope="col" class="r">% Cambio</th></tr></thead>
        <tbody>
          ${sparkArr.map((v, i) => {
    const isAnom = insightIsAnomaly(v, stats.avg, stats.stddev);
    return `<tr class="${isAnom ? 'insight-anomaly' : ''}">
              <td>${labels[i] || 'M' + (i + 1)}</td>
              <td class="mono r">${v}</td>
              <td class="mono r ${changes[i].abs > 0 ? 'tu' : changes[i].abs < 0 ? 'td' : ''}">${changes[i].abs > 0 ? '+' : ''}${changes[i].abs}</td>
              <td class="mono r">${changes[i].pct > 0 ? '+' : ''}${changes[i].pct}%</td>
            </tr>`;
  }).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `;
}

function buildKPIInsightChart(widget) {
  const cv = document.getElementById('insightMainChart');
  if (!cv) return;
  const sparkArr = widget.sparkData.split(',').map(Number);
  const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].slice(0, sparkArr.length);
  const c = getTC();
  if (insightChart) { insightChart.destroy(); insightChart = null; }
  insightChart = new Chart(cv, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: widget.name,
        data: sparkArr,
        borderColor: widget.sparkColor,
        backgroundColor: widget.sparkColor + '15',
        borderWidth: 2.5, fill: true, tension: 0.4,
        pointRadius: 5, pointBackgroundColor: widget.sparkColor,
        pointBorderColor: c.pb, pointBorderWidth: 2, pointHoverRadius: 8
      }]
    },
    options: { ...mkOpts(), plugins: { ...mkOpts().plugins, legend: { display: false } } }
  });
}

function renderChartInsight(widget) {
  const idata = INSIGHT_DATA[widget.id];
  if (!idata) return '<p style="color:var(--txt2);padding:var(--sp-6)">Datos no disponibles para este grafico.</p>';

  const isDoughnut = idata.chartType === 'doughnut';

  // Stats per dataset
  let statsHTML = '';
  if (!isDoughnut) {
    if (idata.datasets.length === 1) {
      const s = insightCalcStats(idata.datasets[0].data);
      statsHTML = `<div class="insight-stats">
        <div class="insight-stat"><div class="insight-stat-label">Minimo</div><div class="insight-stat-value">${s.min}</div></div>
        <div class="insight-stat"><div class="insight-stat-label">Maximo</div><div class="insight-stat-value">${s.max}</div></div>
        <div class="insight-stat"><div class="insight-stat-label">Promedio</div><div class="insight-stat-value">${s.avg}</div></div>
        <div class="insight-stat"><div class="insight-stat-label">Mediana</div><div class="insight-stat-value">${s.median}</div></div>
      </div>`;
    } else {
      statsHTML = '<div class="insight-stats">';
      idata.datasets.forEach(ds => {
        const s = insightCalcStats(ds.data);
        statsHTML += `<div class="insight-stat"><div class="insight-stat-label">${ds.name} (avg)</div><div class="insight-stat-value" style="color:${ds.color}">${s.avg}</div></div>`;
      });
      statsHTML += '</div>';
    }
  } else {
    const total = idata.datasets[0].data.reduce((a, b) => a + b, 0);
    statsHTML = '<div class="insight-stats">';
    idata.labels.forEach((lbl, i) => {
      const val = idata.datasets[0].data[i];
      const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
      const clr = (idata.colors && idata.colors[i]) || '#007AFF';
      statsHTML += `<div class="insight-stat"><div class="insight-stat-label">${lbl}</div><div class="insight-stat-value" style="color:${clr}">${val} (${pct}%)</div></div>`;
    });
    statsHTML += '</div>';
  }

  // Dataset toggles
  let togglesHTML = '';
  if (!isDoughnut && idata.datasets.length > 1) {
    togglesHTML = '<div class="insight-toggles">';
    idata.datasets.forEach((ds, i) => {
      togglesHTML += `<button class="insight-toggle active" data-ds-idx="${i}" onclick="insightToggleDataset(this, ${i})">
        <span class="insight-toggle-dot" style="background:${ds.color}"></span>${ds.name}
      </button>`;
    });
    togglesHTML += '</div>';
  }

  // Data table
  let tableHTML = '<div class="insight-table-wrap"><div class="tbl-scroll"><table class="tbl"><thead><tr><th scope="col">' + (idata.xLabel || 'Periodo') + '</th>';
  idata.datasets.forEach(ds => { tableHTML += `<th scope="col" class="r">${ds.name}</th>`; });
  tableHTML += '</tr></thead><tbody>';

  // Compute stats for anomaly detection per dataset
  const dsStats = idata.datasets.map(ds => insightCalcStats(ds.data));

  idata.labels.forEach((lbl, i) => {
    let isAnom = false;
    idata.datasets.forEach((ds, di) => {
      if (insightIsAnomaly(ds.data[i], dsStats[di].avg, dsStats[di].stddev)) isAnom = true;
    });
    tableHTML += `<tr class="${isAnom ? 'insight-anomaly' : ''}"><td>${lbl}</td>`;
    idata.datasets.forEach(ds => {
      tableHTML += `<td class="mono r">${ds.data[i] !== undefined ? ds.data[i] : '-'}</td>`;
    });
    tableHTML += '</tr>';
  });
  tableHTML += '</tbody></table></div></div>';

  return `
    <div class="insight-time-range">
      <button class="insight-range-btn" onclick="insightRangeClick(this)">1M</button>
      <button class="insight-range-btn" onclick="insightRangeClick(this)">3M</button>
      <button class="insight-range-btn active" onclick="insightRangeClick(this)">6M</button>
      <button class="insight-range-btn" onclick="insightRangeClick(this)">1A</button>
    </div>

    ${togglesHTML}

    <div class="insight-chart-wrap">
      <canvas id="insightMainChart"></canvas>
    </div>

    ${statsHTML}
    ${tableHTML}
  `;
}

function buildChartInsightChart(widgetId) {
  const cv = document.getElementById('insightMainChart');
  if (!cv) return;
  const idata = INSIGHT_DATA[widgetId];
  if (!idata) return;
  const c = getTC();
  const dk = TM.dark();
  const dbrd = dk ? '#2C2C2E' : '#FEFEFE';

  if (insightChart) { insightChart.destroy(); insightChart = null; }
  insightDatasetRefs = [];

  if (idata.chartType === 'doughnut') {
    const colors = idata.colors || PD.colors;
    insightChart = new Chart(cv, {
      type: 'doughnut',
      data: {
        labels: idata.labels,
        datasets: [{
          data: idata.datasets[0].data,
          backgroundColor: colors,
          borderColor: dbrd,
          borderWidth: 1,
          hoverOffset: 12,
          spacing: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        animation: { animateRotate: true, duration: 800 },
        plugins: {
          legend: { labels: { color: c.text, font: { size: 12, family: 'Inter', weight: '500' }, usePointStyle: true, pointStyle: 'circle', padding: 16 } },
          tooltip: { ...mkTip(), callbacks: { label: x => `${x.label}: ${x.parsed}` } }
        }
      }
    });
    return;
  }

  const chartType = idata.chartType || 'line';
  const datasets = idata.datasets.map((ds, i) => {
    const base = {
      label: ds.name,
      data: ds.data,
      borderColor: ds.color,
      backgroundColor: ds.color,
      borderWidth: i === 0 ? 2.5 : 1.5,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: ds.color,
      pointBorderColor: c.pb,
      pointBorderWidth: 2,
      pointHoverRadius: 7
    };
    if (chartType === 'line') { base.fill = true; }
    if (chartType === 'bar') {
      base.borderRadius = 6;
      base.borderWidth = 1;
    }
    if (idata.multiColor && idata.colors) {
      base.backgroundColor = idata.colors;
      base.borderColor = idata.colors;
    }
    return base;
  });

  insightChart = new Chart(cv, {
    type: chartType,
    data: { labels: idata.labels, datasets: datasets },
    options: { ...mkOpts(), plugins: { ...mkOpts().plugins, legend: { labels: { color: c.text, font: { size: 12, family: 'Inter', weight: '500' }, usePointStyle: true, pointStyle: 'circle', padding: 16 } } } }
  });
  insightDatasetRefs = datasets;
}

function insightToggleDataset(btn, idx) {
  if (!insightChart) return;
  btn.classList.toggle('active');
  const visible = btn.classList.contains('active');
  insightChart.setDatasetVisibility(idx, visible);
  insightChart.update();
}

function insightRangeClick(btn) {
  const parent = btn.parentElement;
  parent.querySelectorAll('.insight-range-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// Export CSV
function insightExportCSV() {
  const body = document.getElementById('insightBody');
  const title = document.getElementById('insightTitle');
  if (!body) return;
  const table = body.querySelector('.tbl');
  if (!table) return;

  const rows = [];
  table.querySelectorAll('tr').forEach(tr => {
    const cells = [];
    tr.querySelectorAll('th, td').forEach(cell => cells.push('"' + cell.textContent.trim().replace(/"/g, '""') + '"'));
    rows.push(cells.join(','));
  });

  const csv = rows.join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (title ? title.textContent : 'data').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `linktic-${name}-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Click delegation for opening insights
document.addEventListener('click', e => {
  // Ignore clicks on editable elements and action buttons
  if (e.target.closest('[contenteditable="true"]') || e.target.closest('.cp-widget-remove') || e.target.closest('.drag-handle') || e.target.closest('.resize-handle') || e.target.closest('.proj-expand-btn') || e.target.closest('.detail-trigger-btn') || e.target.closest('.action-btn') || e.target.closest('.tab') || e.target.closest('.filters-header') || e.target.closest('.filter-select') || e.target.closest('.filter-btn')) return;

  // KPI cards in main sections
  const kpiCard = e.target.closest('.card-kpi');
  if (kpiCard && !kpiCard.closest('.cp-widget')) {
    const label = kpiCard.querySelector('.kpi-label');
    if (label) {
      const labelText = label.textContent.trim().toLowerCase();
      const widget = WIDGET_CATALOG.find(w => w.category === 'kpi' && w.name.toLowerCase().includes(labelText.substring(0, 5)));
      if (widget) { openInsight(widget.id); return; }
    }
  }

  // Chart cards in main sections
  const chartCard = e.target.closest('.card');
  if (chartCard && !chartCard.closest('.cp-widget') && chartCard.querySelector('canvas:not(.kpi-spark)') && !chartCard.classList.contains('card-kpi') && !chartCard.classList.contains('card-table') && !chartCard.classList.contains('card-map') && !chartCard.classList.contains('card-project') && !chartCard.classList.contains('emp-card') && !chartCard.classList.contains('card-filters')) {
    const canvas = chartCard.querySelector('canvas:not(.kpi-spark)');
    if (canvas && canvas.id) {
      const mapping = {
        timelineChart: 'chart-timeline', cargaChart: 'chart-carga', sprintChart: 'chart-sprint',
        deployChart: 'chart-deploy', bugChart: 'chart-bugs', colabChart: 'chart-colab',
        cargaChart2: 'chart-carga', retentionChart: 'chart-retention',
        satisfactionChart: 'chart-satisfaction', revenueChart: 'chart-revenue',
        attendanceChart: 'chart-attendance'
      };
      const widgetId = mapping[canvas.id];
      if (widgetId) { openInsight(widgetId); return; }
    }
  }

  // Control panel widgets
  const cpWidget = e.target.closest('.cp-widget');
  if (cpWidget) {
    const widgetId = cpWidget.dataset.widgetId;
    if (widgetId) { openInsight(widgetId); return; }
  }
});

// Close handlers
document.getElementById('insightClose').addEventListener('click', closeInsight);
document.getElementById('insightBack').addEventListener('click', closeInsight);
document.getElementById('insightExport').addEventListener('click', insightExportCSV);

document.querySelector('.insight-backdrop').addEventListener('click', closeInsight);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('insightOverlay');
    if (overlay && !overlay.hidden) { closeInsight(); e.preventDefault(); }
  }
});

// ===== KEYBOARD ACTIVATION FOR ARROW BUTTONS =====
document.querySelectorAll('.bv2-card-arrow[role="button"]').forEach(arrow => {
  arrow.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      arrow.click();
    }
  });
});

// ===== HIDE CHART SKELETONS WHEN CHARTS RENDER =====
function hideChartSkeletons() {
  document.querySelectorAll('.cw .chart-skeleton').forEach(sk => {
    const cw = sk.parentElement;
    if (cw) {
      const canvas = cw.querySelector('canvas');
      if (canvas) {
        // Check if canvas has been drawn to (has chart data)
        sk.style.display = 'none';
      }
    }
  });
}
// Call after initial chart build
setTimeout(hideChartSkeletons, 800);

// ===== INIT =====
TM.init();

// Initial view from hash or default to overview
(() => {
  const initialView = getHashView() || 'overview';
  // Make sure overview has its elements revealed on load
  const initialSection = document.getElementById(initialView);
  if (initialView !== 'overview') {
    document.getElementById('overview').classList.remove('active');
    initialSection.classList.add('active');
    currentView = initialView;
    document.querySelectorAll('.sidebar-item').forEach(a => a.classList.toggle('active', a.dataset.target === initialView));
  }
  // Set initial history state
  history.replaceState({ view: initialView }, '', `#${initialView}`);
  // Reveal the initial section
  setTimeout(() => {
    revealElementsInSection(initialSection);
    resizeChartsInSection(initialSection);
    if (initialView === 'map-section' && window._lincMap) {
      setTimeout(() => window._lincMap.invalidateSize(), 500);
    }
    if (initialView === 'control-panel') {
      setTimeout(() => renderControlPanel(), 50);
    }
  }, 100);
})();

// ===== SIDEBAR TOGGLE =====
(() => {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  const hamburger = document.getElementById('mobileHamburger');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar || !toggleBtn) return;

  // Restore collapsed state
  const savedCollapsed = localStorage.getItem('linktic-sidebar-collapsed') === 'true';
  if (savedCollapsed) {
    sidebar.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
  }

  toggleBtn.addEventListener('click', () => {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    localStorage.setItem('linktic-sidebar-collapsed', String(isCollapsed));
    // Resize charts after transition
    setTimeout(() => {
      const activeSection = document.getElementById(currentView);
      if (activeSection) resizeChartsInSection(activeSection);
      if (currentView === 'map-section' && window._lincMap) window._lincMap.invalidateSize();
    }, 350);
  });

  // Mobile hamburger
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
      if (backdrop) backdrop.classList.add('visible');
    });
  }
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('visible');
    });
  }
  // Keyboard: Cmd+B / Ctrl+B to toggle sidebar
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      toggleBtn.click();
    }
  });
  // Arrow key navigation in sidebar
  sidebar.addEventListener('keydown', e => {
    const items = [...sidebar.querySelectorAll('.sidebar-item')];
    const idx = items.indexOf(document.activeElement);
    if (idx === -1) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(idx + 1, items.length - 1)].focus() }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(idx - 1, 0)].focus() }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.activeElement.click() }
  });
})();

// ===== WIDGET CATALOG =====
const WIDGET_CATALOG = [
  // KPIs
  { id: 'kpi-colaboradores', name: 'Colaboradores', category: 'kpi', icon: 'users', value: '248', trend: '+12', trendClass: 'up', sparkData: '30,35,28,42,38,55,48,60,52,68,62,75', sparkColor: '#007AFF' },
  { id: 'kpi-proyectos', name: 'Proyectos', category: 'kpi', icon: 'folder', value: '12', trend: '0', trendClass: 'flat', sparkData: '12,12,11,12,13,12,12,11,12,12,12,12', sparkColor: '#5856D6' },
  { id: 'kpi-carga', name: 'Carga Promedio', category: 'kpi', icon: 'gauge', value: '74%', trend: '+5%', trendClass: 'warn', sparkData: '60,62,58,65,70,68,72,69,74,71,76,74', sparkColor: '#FF9500' },
  { id: 'kpi-nuevos', name: 'Nuevos Q1', category: 'kpi', icon: 'plus', value: '34', trend: '+8', trendClass: 'up', sparkData: '5,8,6,10,12,9,14,11,16,13,18,34', sparkColor: '#34C759' },
  { id: 'kpi-budget', name: 'Presupuesto Total', category: 'kpi', icon: 'dollar', value: '$1.005M', trend: '', trendClass: 'up', sparkData: '120,150,180,200,250,300,350,400,500,600,800,1005', sparkColor: '#34C759' },
  { id: 'kpi-ontime', name: 'Entrega a Tiempo', category: 'kpi', icon: 'clock', value: '87%', trend: '+4%', trendClass: 'up', sparkData: '72,75,78,80,82,80,83,85,84,86,85,87', sparkColor: '#007AFF' },
  { id: 'kpi-hours', name: 'Horas Promedio', category: 'kpi', icon: 'clock', value: '8.2h', trend: '+0.3', trendClass: 'up', sparkData: '7.8,7.9,8.0,8.1,7.9,8.0,8.1,8.2,8.0,8.1,8.2,8.2', sparkColor: '#007AFF' },
  { id: 'kpi-punctuality', name: 'Puntualidad', category: 'kpi', icon: 'check', value: '94.5%', trend: '+1.2%', trendClass: 'up', sparkData: '90,91,92,91,93,92,93,94,93,94,94,94.5', sparkColor: '#34C759' },
  { id: 'kpi-users', name: 'Total Usuarios', category: 'kpi', icon: 'shield', value: '186', trend: '+14', trendClass: 'up', sparkData: '140,148,155,158,162,168,170,174,178,180,183,186', sparkColor: '#007AFF' },
  { id: 'kpi-sessions', name: 'Sesiones Activas', category: 'kpi', icon: 'activity', value: '42', trend: '-2', trendClass: 'flat', sparkData: '38,40,42,45,43,44,41,42,40,43,41,42', sparkColor: '#34C759' },
  // Charts
  { id: 'chart-timeline', name: 'Evolucion Temporal', category: 'chart', type: 'line' },
  { id: 'chart-carga', name: 'Carga por Equipo', category: 'chart', type: 'doughnut' },
  { id: 'chart-sprint', name: 'Sprint Velocity', category: 'chart', type: 'bar' },
  { id: 'chart-deploy', name: 'Deploy Frequency', category: 'chart', type: 'line' },
  { id: 'chart-bugs', name: 'Bug Tracking', category: 'chart', type: 'line' },
  { id: 'chart-colab', name: 'Colaboradores/Proyecto', category: 'chart', type: 'bar' },
  { id: 'chart-retention', name: 'Retencion', category: 'chart', type: 'doughnut' },
  { id: 'chart-satisfaction', name: 'Satisfaccion eNPS', category: 'chart', type: 'bar' },
  { id: 'chart-revenue', name: 'Revenue/Empleado', category: 'chart', type: 'line' },
  { id: 'chart-attendance', name: 'Asistencia Diaria', category: 'chart', type: 'line' },
  // Tables
  { id: 'table-teams', name: 'Estado por Proyecto', category: 'table' },
  { id: 'table-logs', name: 'Registro de Actividad', category: 'table' }
];

// ===== CONTROL PANEL STATE =====
let cpState = JSON.parse(localStorage.getItem('linktic-panel') || '{"widgets":[],"cols":3}');
const cpCharts = {};
let cpEditMode = false;

function savePanel() {
  localStorage.setItem('linktic-panel', JSON.stringify(cpState));
}

function addWidget(widgetId) {
  if (!cpState.widgets.includes(widgetId)) {
    cpState.widgets.push(widgetId);
    savePanel();
    renderControlPanel();
    renderCatalogGrid();
  }
}

function removeWidget(widgetId) {
  cpState.widgets = cpState.widgets.filter(id => id !== widgetId);
  savePanel();
  renderControlPanel();
  renderCatalogGrid();
}

function getWidgetIcon(cat) {
  const icons = {
    kpi: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    chart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    table: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>'
  };
  return icons[cat] || icons.kpi;
}

function renderWidgetHTML(widgetId) {
  const w = WIDGET_CATALOG.find(x => x.id === widgetId);
  if (!w) return '';
  const now = new Date();
  const ts = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');

  if (w.category === 'kpi') {
    const canvasId = 'cp-spark-' + w.id;
    return `<div class="cp-widget" data-widget-id="${w.id}">
      <button class="cp-widget-remove" onclick="event.stopPropagation();removeWidget('${w.id}')">&times;</button>
      <div class="cp-widget-head">
        <span class="cp-widget-title">${w.name}</span>
        <span class="cp-widget-live"><span class="cp-pulse"></span>${ts}</span>
      </div>
      <div class="kpi-row" style="margin-bottom:var(--sp-1)">
        <span class="kpi-val">${w.value}</span>
        ${w.trend ? '<span class="kpi-trend ' + w.trendClass + '">' + w.trend + '</span>' : ''}
      </div>
      <canvas class="kpi-spark" id="${canvasId}" data-spark="${w.sparkData}" data-color="${w.sparkColor}" width="200" height="24"></canvas>
    </div>`;
  }

  if (w.category === 'chart') {
    const canvasId = 'cp-chart-' + w.id;
    return `<div class="cp-widget" data-widget-id="${w.id}">
      <button class="cp-widget-remove" onclick="event.stopPropagation();removeWidget('${w.id}')">&times;</button>
      <div class="cp-widget-head">
        <span class="cp-widget-title">${w.name}</span>
        <span class="cp-widget-live"><span class="cp-pulse"></span>${ts}</span>
      </div>
      <div class="cw"><canvas id="${canvasId}"></canvas></div>
    </div>`;
  }

  if (w.category === 'table') {
    return `<div class="cp-widget" data-widget-id="${w.id}" style="grid-column:span 2">
      <button class="cp-widget-remove" onclick="event.stopPropagation();removeWidget('${w.id}')">&times;</button>
      <div class="cp-widget-head">
        <span class="cp-widget-title">${w.name}</span>
        <span class="cp-widget-live"><span class="cp-pulse"></span>${ts}</span>
      </div>
      ${renderTableWidget(w.id)}
    </div>`;
  }
  return '';
}

function renderTableWidget(widgetId) {
  if (widgetId === 'table-teams') {
    const rows = [
      ['Plataforma Web', '42', '92%', 'CRIT'], ['App Mobile', '38', '78%', 'WARN'], ['Backend API', '35', '65%', 'OK'],
      ['Data Analytics', '28', '58%', 'OK'], ['Infraestructura', '25', '72%', 'WARN']
    ];
    return `<div class="tbl-scroll"><table class="tbl" style="min-width:300px">
      <thead><tr><th>Proyecto</th><th class="r">Eq.</th><th class="r">Carga</th><th>Estado</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td class="cp" style="font-size:.78rem"><span class="dot" style="--c:var(--blue)"></span>${r[0]}</td><td class="mono r">${r[1]}</td><td class="mono r">${r[2]}</td><td><span class="badge ${r[3].toLowerCase()}">${r[3]}</span></td></tr>`).join('')}</tbody>
    </table></div>
    <div style="text-align:center;padding:var(--sp-2)"><a style="font:500 11px/14px var(--font);color:var(--blue);cursor:pointer" onclick="switchView('teams')">Ver todo</a></div>`;
  }
  if (widgetId === 'table-logs') {
    const rows = [
      ['09:42:18', 'Ana Castillo', 'Login', 'log-login'], ['09:38:05', 'Carlos Mendez', 'Edit', 'log-edit'],
      ['09:35:22', 'Maria Torres', 'Create', 'log-create'], ['09:30:11', 'Juan Perez', 'Edit', 'log-edit'],
      ['09:25:44', 'Sofia Ramirez', 'Login', 'log-login']
    ];
    return `<div class="tbl-scroll"><table class="tbl" style="min-width:300px">
      <thead><tr><th>Hora</th><th>Usuario</th><th>Accion</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td class="mono">${r[0]}</td><td style="font-size:.78rem">${r[1]}</td><td><span class="log-badge ${r[3]}">${r[2]}</span></td></tr>`).join('')}</tbody>
    </table></div>
    <div style="text-align:center;padding:var(--sp-2)"><a style="font:500 11px/14px var(--font);color:var(--blue);cursor:pointer" onclick="switchView('admin')">Ver todo</a></div>`;
  }
  return '';
}

function buildCPChart(widgetId) {
  const w = WIDGET_CATALOG.find(x => x.id === widgetId);
  if (!w || w.category !== 'chart') return;
  const canvasId = 'cp-chart-' + w.id;
  const cv = document.getElementById(canvasId);
  if (!cv) return;
  const o = mkOpts(); const c = getTC(); const dk = TM.dark();
  const dbrd = dk ? '#2C2C2E' : '#FEFEFE';
  const CF = dk
    ? { blue: '#0A1F3A', indigo: '#1E1E3A', purple: '#1E1230', red: '#3A1518', orange: '#3A2A10' }
    : { blue: '#E0ECFF', indigo: '#E8E8F8', purple: '#F0E6F8', red: '#FDECEB', orange: '#FFF2E0' };
  const CB = dk
    ? { blue: '#1A3F6E', indigo: '#2E2E5C' }
    : { blue: '#99B3FF', indigo: '#ABABD6' };

  // Destroy existing
  if (cpCharts[widgetId]) { cpCharts[widgetId].destroy(); delete cpCharts[widgetId] }

  switch (widgetId) {
    case 'chart-timeline':
      cpCharts[widgetId] = new Chart(cv, {
        type: 'line', data: {
          labels: MO, datasets: [
            { label: 'Web', data: [35, 38, 40, 42, 41, 42], borderColor: '#007AFF', backgroundColor: CF.blue, borderWidth: 2, fill: true, tension: .4, pointRadius: 2, pointBackgroundColor: '#007AFF' },
            { label: 'Mobile', data: [30, 32, 34, 36, 37, 38], borderColor: '#5856D6', backgroundColor: CF.indigo, borderWidth: 1.5, fill: true, tension: .4, pointRadius: 1 },
          ]
        }, options: o
      }); break;
    case 'chart-carga':
      cpCharts[widgetId] = new Chart(cv, { type: 'doughnut', data: { labels: PD.labels, datasets: [{ data: PD.load, backgroundColor: PD.colors, borderColor: dbrd, borderWidth: 1, spacing: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { ...mkTip(), callbacks: { label: x => `${x.label}: ${x.parsed}%` } } } } }); break;
    case 'chart-sprint':
      cpCharts[widgetId] = new Chart(cv, {
        type: 'bar', data: {
          labels: ['S18', 'S19', 'S20', 'S21', 'S22', 'S23', 'S24', 'S25'], datasets: [
            { label: 'Plan', data: [42, 45, 48, 44, 50, 47, 52, 55], backgroundColor: CF.blue, borderColor: CB.blue, borderWidth: 1, borderRadius: 4 },
            { label: 'Done', data: [38, 43, 45, 40, 48, 45, 50, 53], backgroundColor: CF.indigo, borderColor: CB.indigo, borderWidth: 1, borderRadius: 4 }
          ]
        }, options: o
      }); break;
    case 'chart-deploy':
      cpCharts[widgetId] = new Chart(cv, {
        type: 'line', data: {
          labels: MO, datasets: [
            { label: 'Prod', data: [18, 22, 28, 35, 42, 48], borderColor: '#007AFF', backgroundColor: CF.blue, borderWidth: 2, fill: true, tension: .4, pointRadius: 2 },
            { label: 'Stage', data: [45, 52, 60, 68, 75, 82], borderColor: '#5856D6', backgroundColor: CF.indigo, borderWidth: 1.5, fill: true, tension: .4, pointRadius: 1 }
          ]
        }, options: o
      }); break;
    case 'chart-bugs':
      cpCharts[widgetId] = new Chart(cv, {
        type: 'line', data: {
          labels: MO, datasets: [
            { label: 'Crit', data: [12, 8, 10, 6, 4, 3], borderColor: '#FF3B30', backgroundColor: CF.red, borderWidth: 1.5, fill: true, tension: .3 },
            { label: 'Major', data: [28, 25, 22, 18, 15, 12], borderColor: '#FF9500', backgroundColor: CF.orange, borderWidth: 1.5, fill: true, tension: .3 }
          ]
        }, options: o
      }); break;
    case 'chart-colab':
      cpCharts[widgetId] = new Chart(cv, { type: 'bar', data: { labels: PD.labels, datasets: [{ label: 'Colaboradores', data: PD.collab, backgroundColor: PD.colors, borderColor: PD.colors, borderWidth: 1, borderRadius: 4, borderSkipped: false }] }, options: { ...o, plugins: { ...o.plugins, legend: { display: false } } } }); break;
    case 'chart-retention':
      cpCharts[widgetId] = new Chart(cv, { type: 'doughnut', data: { labels: ['Retencion', 'Voluntaria', 'Involuntaria'], datasets: [{ data: [92, 5, 3], backgroundColor: ['#10B981', '#F59E0B', '#EF4444'], borderColor: dbrd, borderWidth: 1, spacing: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { labels: { color: c.text, font: { size: 12 }, usePointStyle: true, pointStyle: 'circle', padding: 10 } }, tooltip: { ...mkTip(), callbacks: { label: x => `${x.label}: ${x.parsed}%` } } } } }); break;
    case 'chart-satisfaction': {
      const eNPS = [62, 75, 80, 85, 58, 88, 42, 90, 70];
      cpCharts[widgetId] = new Chart(cv, { type: 'bar', data: { labels: PD.labels, datasets: [{ label: 'eNPS', data: eNPS, backgroundColor: ({ dataIndex: i }) => eNPS[i] >= 70 ? '#10B981' : eNPS[i] >= 50 ? '#F59E0B' : '#EF4444', borderColor: ({ dataIndex: i }) => eNPS[i] >= 70 ? '#10B981' : eNPS[i] >= 50 ? '#F59E0B' : '#EF4444', borderWidth: 1, borderRadius: 4 }] }, options: { ...o, indexAxis: 'y', plugins: { ...o.plugins, legend: { display: false } }, scales: { x: { grid: { color: c.grid }, ticks: { color: c.text, font: { size: 12, weight: '500' } }, border: { display: false } }, y: { grid: { display: false }, ticks: { color: c.text, font: { size: 12 } }, border: { display: false } } } } }); break;
    }
    case 'chart-revenue':
      cpCharts[widgetId] = new Chart(cv, {
        type: 'line', data: {
          labels: ['Q1-24', 'Q2-24', 'Q3-24', 'Q4-24', 'Q1-25'], datasets: [
            { label: 'Rev/Emp (K)', data: [28, 31, 29, 34, 38], borderColor: '#007AFF', backgroundColor: CF.blue, borderWidth: 2, fill: true, tension: .4, pointRadius: 2, pointBackgroundColor: '#007AFF' },
            { label: 'Cost/Emp (K)', data: [22, 23, 22, 24, 25], borderColor: '#AF52DE', backgroundColor: CF.purple, borderWidth: 1.5, fill: true, tension: .4, pointRadius: 1, borderDash: [4, 4] }
          ]
        }, options: o
      }); break;
    case 'chart-attendance': {
      const attDays = []; for (let i = 1; i <= 31; i++)attDays.push(i + '');
      const attData = [98, 97, 96, 94, 98, 97, 12, 8, 96, 93, 97, 98, 96, 10, 5, 97, 98, 92, 97, 96, 15, 6, 98, 94, 97, 96, 98, 45, 9, 97, 96];
      cpCharts[widgetId] = new Chart(cv, {
        type: 'line', data: {
          labels: attDays, datasets: [
            { label: 'Asist. %', data: attData, borderColor: '#007AFF', backgroundColor: CF.blue, borderWidth: 1.5, fill: true, tension: .3, pointRadius: 1 }
          ]
        }, options: o
      }); break;
    }
  }
}

function renderControlPanel() {
  const grid = document.getElementById('cpGrid');
  if (!grid) return;

  // Destroy all existing CP charts
  Object.keys(cpCharts).forEach(k => { cpCharts[k].destroy(); delete cpCharts[k] });

  // Set columns
  grid.dataset.cols = cpState.cols || 3;

  if (!cpState.widgets || cpState.widgets.length === 0) {
    grid.innerHTML = '';
    // Re-add empty state
    grid.innerHTML = `<div class="cp-empty" id="cpEmpty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      <h3>Tu panel esta vacio</h3>
      <p>Agrega widgets para construir tu panel de control personalizado</p>
      <button class="filter-btn filter-btn-apply" onclick="document.getElementById('cpAddWidget').click()">Agregar primer widget</button>
    </div>`;
    if (cpEditMode) { grid.classList.add('editing') } else { grid.classList.remove('editing') }
    return;
  }

  grid.innerHTML = cpState.widgets.map(id => renderWidgetHTML(id)).join('');
  if (cpEditMode) { grid.classList.add('editing') } else { grid.classList.remove('editing') }

  // Build chart widgets
  setTimeout(() => {
    cpState.widgets.forEach(id => {
      const w = WIDGET_CATALOG.find(x => x.id === id);
      if (!w) return;
      if (w.category === 'chart') {
        buildCPChart(id);
      }
      if (w.category === 'kpi') {
        const canvasId = 'cp-spark-' + id;
        const cvEl = document.getElementById(canvasId);
        if (cvEl && cvEl.dataset.spark) {
          spark(cvEl, cvEl.dataset.spark.split(',').map(Number), cvEl.dataset.color || '#007AFF');
        }
      }
    });
  }, 50);

  // Drag reorder in edit mode
  if (cpEditMode) { initCPDrag() }
}

function initCPDrag() {
  const grid = document.getElementById('cpGrid');
  if (!grid) return;
  let dragW = null, startIdx = 0;
  grid.querySelectorAll('.cp-widget').forEach((w, i) => {
    w.draggable = true;
    w.addEventListener('dragstart', e => {
      dragW = w; startIdx = i;
      w.style.opacity = '.4';
      e.dataTransfer.effectAllowed = 'move';
    });
    w.addEventListener('dragend', () => {
      if (dragW) dragW.style.opacity = '';
      dragW = null;
    });
    w.addEventListener('dragover', e => {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      w.style.borderColor = 'var(--blue)';
    });
    w.addEventListener('dragleave', () => {
      w.style.borderColor = '';
    });
    w.addEventListener('drop', e => {
      e.preventDefault();
      w.style.borderColor = '';
      const endIdx = [...grid.querySelectorAll('.cp-widget')].indexOf(w);
      if (startIdx !== endIdx && startIdx >= 0 && endIdx >= 0) {
        const moved = cpState.widgets.splice(startIdx, 1)[0];
        cpState.widgets.splice(endIdx, 0, moved);
        savePanel();
        renderControlPanel();
      }
    });
  });
}

function renderCatalogGrid() {
  const gridEl = document.getElementById('cpCatalogGrid');
  const searchEl = document.getElementById('cpCatalogSearch');
  if (!gridEl) return;
  const searchVal = (searchEl && searchEl.value || '').toLowerCase();
  const activeCat = document.querySelector('.cp-cat-btn.active');
  const cat = activeCat ? activeCat.dataset.cat : 'all';

  const filtered = WIDGET_CATALOG.filter(w => {
    if (cat !== 'all' && w.category !== cat) return false;
    if (searchVal && !w.name.toLowerCase().includes(searchVal)) return false;
    return true;
  });

  gridEl.innerHTML = filtered.map(w => {
    const added = cpState.widgets.includes(w.id);
    return `<div class="cp-catalog-item${added ? ' already-added' : ''}" data-wid="${w.id}" onclick="${added ? '' : 'addWidget(\'' + w.id + '\')'}">
      ${getWidgetIcon(w.category)}
      <span>${w.name}</span>
    </div>`;
  }).join('');
}

// ===== CONTROL PANEL EVENT LISTENERS =====
(() => {
  // Add widget button — open catalog
  const addBtn = document.getElementById('cpAddWidget');
  const catalog = document.getElementById('cpCatalog');
  const closeBtn = document.getElementById('cpCatalogClose');
  const searchInput = document.getElementById('cpCatalogSearch');

  if (addBtn && catalog) {
    addBtn.addEventListener('click', () => {
      catalog.hidden = !catalog.hidden;
      if (!catalog.hidden) { renderCatalogGrid(); if (searchInput) searchInput.focus() }
    });
  }
  if (closeBtn && catalog) {
    closeBtn.addEventListener('click', () => { catalog.hidden = true });
  }
  if (searchInput) {
    searchInput.addEventListener('input', () => renderCatalogGrid());
  }

  // Category buttons
  document.querySelectorAll('.cp-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cp-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCatalogGrid();
    });
  });

  // Edit toggle
  const editBtn = document.getElementById('cpEditToggle');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      cpEditMode = !cpEditMode;
      editBtn.classList.toggle('active', cpEditMode);
      editBtn.querySelector('span').textContent = cpEditMode ? 'Listo' : 'Editar';
      const grid = document.getElementById('cpGrid');
      if (grid) {
        grid.classList.toggle('editing', cpEditMode);
        if (cpEditMode) initCPDrag();
      }
    });
  }

  // Column layout switch
  document.querySelectorAll('.cp-col-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cp-col-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cols = parseInt(btn.dataset.cols);
      cpState.cols = cols;
      savePanel();
      const grid = document.getElementById('cpGrid');
      if (grid) grid.dataset.cols = cols;
    });
  });

  // Fullscreen
  const fsBtn = document.getElementById('cpFullscreen');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      const section = document.getElementById('control-panel');
      if (!section) return;
      if (document.fullscreenElement) {
        document.exitFullscreen();
        section.classList.remove('cp-fullscreen-mode');
      } else {
        section.requestFullscreen().catch(() => { });
        section.classList.add('cp-fullscreen-mode');
      }
    });
    document.addEventListener('fullscreenchange', () => {
      const section = document.getElementById('control-panel');
      if (!document.fullscreenElement && section) {
        section.classList.remove('cp-fullscreen-mode');
      }
    });
  }

  // Set initial column button state
  document.querySelectorAll('.cp-col-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.cols) === (cpState.cols || 3));
  });
})();

/* ============================================
   BENTO V2 — Overview Enhancements
   Hero Three.js + Micro-interactions + Charts
   ============================================ */
(function initBentoV2() {
  'use strict';

  // ===== SVG gradient for gauge (inject once) =====
  (function injectGaugeGradient() {
    const svg = document.querySelector('.bv2-gauge');
    if (!svg) return;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    grad.setAttribute('id', 'gaugeGrad');
    grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '0%');
    const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', '#007AFF');
    const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', '#5856D6');
    grad.appendChild(s1); grad.appendChild(s2); defs.appendChild(grad);
    svg.insertBefore(defs, svg.firstChild);
  })();

  // ===== THREE.JS — Hero Particle Wave =====
  (function initHeroCanvas() {
    const cvs = document.getElementById('heroCanvas');
    if (!cvs || typeof THREE === 'undefined') return;
    // Respect prefers-reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { cvs.style.display = 'none'; return; }

    const renderer = new THREE.WebGLRenderer({ canvas: cvs, alpha: true, antialias: true });
    const rect = cvs.parentElement.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, rect.width / rect.height, .1, 500);
    camera.position.set(0, 5, 18);
    camera.lookAt(0, 0, 0);

    // Particle field
    const count = 400;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const dk = TM.dark();
    const palette = dk
      ? [[0.04, 0.52, 1], [0.37, 0.36, 0.9], [0.75, 0.35, 0.95], [0.19, 0.82, 0.35]]
      : [[0, 0.48, 1], [0.34, 0.34, 0.84], [0.69, 0.32, 0.87], [0.35, 0.55, 0.8]];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
      sizes[i] = Math.random() * 2 + 0.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      transparent: true,
      opacity: dk ? 0.6 : 0.35,
      blending: dk ? THREE.AdditiveBlending : THREE.NormalBlending,
      sizeAttenuation: true,
      depthWrite: false
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // Store original positions for bounded animation
    const origPositions = new Float32Array(positions);

    // Store reference for theme changes
    window._heroParticles = { points: points, mat: mat, geo: geo };

    let time = 0;
    let heroAnimId;
    function animate() {
      heroAnimId = requestAnimationFrame(animate);
      time += 0.003;
      const pos = geo.getAttribute('position');
      for (let i = 0; i < count; i++) {
        // Use sine/cosine offsets from original positions to prevent unbounded drift
        pos.array[i * 3] = origPositions[i * 3] + Math.cos(time + i * 0.05) * 1.5;
        pos.array[i * 3 + 1] = origPositions[i * 3 + 1] + Math.sin(time + i * 0.1) * 1.2;
      }
      pos.needsUpdate = true;
      points.rotation.y = time * 0.08;
      renderer.render(scene, camera);
    }
    animate();
    // Expose cleanup function for hero animation
    window._cancelHeroAnim = function () { cancelAnimationFrame(heroAnimId); };

    // Handle resize
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = e.contentRect.width, h = e.contentRect.height;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    });
    ro.observe(cvs.parentElement);
  })();

  // ===== BAR SPARKLINE =====
  (function initBarSparkline() {
    const container = document.getElementById('barSparkline');
    if (!container) return;
    const data = [35, 50, 40, 70, 55, 80, 65, 90, 45, 60, 75, 85];
    const max = Math.max(...data);
    data.forEach((v, i) => {
      const bar = document.createElement('div');
      bar.className = 'bv2-bar' + (i === data.length - 1 ? ' active' : '');
      bar.style.height = '0%';
      container.appendChild(bar);
      setTimeout(() => { bar.style.height = (v / max * 100) + '%' }, 100 + i * 50);
    });
  })();

  // ===== WAVE BARS =====
  (function initWaveBars() {
    const container = document.getElementById('waveBars');
    if (!container) return;
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const barCount = 24;
    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement('div');
      bar.className = 'bv2-wbar';
      const h = Math.sin(i * 0.5) * 15 + 20;
      bar.style.height = h + 'px';
      container.appendChild(bar);
    }
    // Skip continuous animation if user prefers reduced motion
    if (prefersReducedMotion) return;
    // Animate wave continuously — cache bar elements to avoid DOM queries per frame
    const barEls = container.querySelectorAll('.bv2-wbar');
    let waveTime = 0;
    let waveAnimId;
    function animateWave() {
      waveAnimId = requestAnimationFrame(animateWave);
      waveTime += 0.04;
      barEls.forEach((b, i) => {
        const h = Math.sin(waveTime + i * 0.4) * 15 + 22;
        b.style.height = h + 'px';
        const op = 0.2 + Math.sin(waveTime + i * 0.3) * 0.15 + 0.15;
        b.style.opacity = op;
      });
    }
    animateWave();
    // Expose cleanup function for wave animation
    window._cancelWaveAnim = function () { cancelAnimationFrame(waveAnimId); };
  })();

  // ===== GAUGE ANIMATION =====
  (function initGauge() {
    const fill = document.querySelector('.bv2-gauge-fill');
    const pctText = document.querySelector('.bv2-gauge-pct');
    if (!fill || !pctText) return;
    const target = parseInt(fill.dataset.target) || 78;
    const circumference = 2 * Math.PI * 52; // r=52
    const offset = circumference - (target / 100) * circumference;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          fill.style.strokeDashoffset = offset;
          // Count up the percentage text
          let current = 0;
          const step = Math.ceil(target / 40);
          const interval = setInterval(() => {
            current += step;
            if (current >= target) { current = target; clearInterval(interval) }
            pctText.textContent = current + '%';
          }, 30);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    observer.observe(fill.closest('.card'));
  })();

  // ===== COUNT-UP ANIMATION =====
  (function initCountUp() {
    const els = document.querySelectorAll('[data-countup]');
    if (!els.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.countup);
          const suffix = el.dataset.suffix || '';
          const duration = 1200;
          const start = performance.now();
          function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const val = Math.round(eased * target);
            el.textContent = val.toLocaleString() + suffix;
            if (progress < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.3 });

    els.forEach(el => observer.observe(el));
  })();

  // ===== PROGRESS BARS + FLOW BARS — animate on scroll =====
  (function initProgressBars() {
    const fills = document.querySelectorAll('.bv2-progress-fill,.bv2-flow-fill');
    if (!fills.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = el.dataset.progress || 0;
          setTimeout(() => { el.style.width = target + '%' }, 150);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.2 });

    fills.forEach(f => observer.observe(f));
  })();

  // ===== REBUILD TIMELINE CHART for bento v2 style =====
  // We need to rebuild the timeline chart to be a combo bar+line chart
  (function rebuildTimelineChart() {
    const cvs = document.getElementById('timelineChart');
    if (!cvs || typeof Chart === 'undefined') return;

    // Destroy existing chart if any
    if (charts.time) { charts.time.destroy(); delete charts.time }

    const c = getTC();
    const months = ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep'];
    const barData = [3200, 4100, 3800, 5200, 4600, 5800];
    const lineData = [2800, 3600, 3200, 4800, 4200, 5400];

    charts.time = new Chart(cvs, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Ingresos',
            data: barData,
            backgroundColor: TM.dark() ? '#1A4D8A' : '#A3CDFF',
            borderColor: TM.dark() ? '#2E6FBF' : '#5AA0F0',
            borderWidth: 1,
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
            order: 2
          },
          {
            label: 'Proyeccion',
            type: 'line',
            data: lineData,
            borderColor: '#FF9500',
            backgroundColor: TM.dark() ? '#2A1E08' : '#FFF8ED',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#FF9500',
            pointBorderColor: c.pb,
            pointBorderWidth: 2,
            pointHoverRadius: 7,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: {
              color: c.text,
              font: { size: 12, family: 'Inter', weight: '600' },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16
            }
          },
          tooltip: mkTip()
        },
        scales: {
          y: {
            grid: { color: c.grid, drawBorder: false },
            ticks: {
              color: c.text,
              font: { size: 12, family: 'JetBrains Mono', weight: '500' },
              padding: 8,
              callback: function (v) { return '$' + v / 1000 + 'k' }
            },
            border: { display: false }
          },
          x: {
            grid: { display: false },
            ticks: { color: c.text, font: { size: 12, family: 'JetBrains Mono' }, padding: 8 },
            border: { display: false }
          }
        }
      }
    });
  })();

  // ===== THEME CHANGE HOOK for hero particles =====
  const origOnChange = TM.onChange.bind(TM);
  TM.onChange = function () {
    origOnChange();
    // Update hero particles
    if (window._heroParticles) {
      const dk = TM.dark();
      const hp = window._heroParticles;
      hp.mat.opacity = dk ? 0.6 : 0.35;
      hp.mat.blending = dk ? THREE.AdditiveBlending : THREE.NormalBlending;
      hp.mat.needsUpdate = true;
      const newPal = dk
        ? [[0.04, 0.52, 1], [0.37, 0.36, 0.9], [0.75, 0.35, 0.95], [0.19, 0.82, 0.35]]
        : [[0, 0.48, 1], [0.34, 0.34, 0.84], [0.69, 0.32, 0.87], [0.35, 0.55, 0.8]];
      const ca = hp.geo.getAttribute('color');
      for (let i = 0; i < ca.count; i++) {
        const c = newPal[Math.floor(Math.random() * newPal.length)];
        ca.array[i * 3] = c[0]; ca.array[i * 3 + 1] = c[1]; ca.array[i * 3 + 2] = c[2];
      }
      ca.needsUpdate = true;
    }
    // Rebuild the timeline chart with updated theme colors
    const cvs = document.getElementById('timelineChart');
    if (cvs && typeof Chart !== 'undefined') {
      if (charts.time) { charts.time.destroy(); delete charts.time }
      const c2 = getTC();
      const months = ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep'];
      charts.time = new Chart(cvs, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Ingresos', data: [3200, 4100, 3800, 5200, 4600, 5800],
              backgroundColor: TM.dark() ? '#1A4D8A' : '#A3CDFF',
              borderColor: TM.dark() ? '#2E6FBF' : '#5AA0F0', borderWidth: 1, borderRadius: 8, borderSkipped: false, barPercentage: 0.6, categoryPercentage: 0.7, order: 2
            },
            {
              label: 'Proyeccion', type: 'line', data: [2800, 3600, 3200, 4800, 4200, 5400],
              borderColor: '#FF9500', backgroundColor: TM.dark() ? '#2A1E08' : '#FFF8ED', borderWidth: 2, fill: true, tension: 0.4,
              pointRadius: 4, pointBackgroundColor: '#FF9500', pointBorderColor: c2.pb, pointBorderWidth: 2, pointHoverRadius: 7, order: 1
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 800, easing: 'easeOutQuart' },
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { color: c2.text, font: { size: 12, family: 'Inter', weight: '500' }, usePointStyle: true, pointStyle: 'circle', padding: 16 } }, tooltip: mkTip() },
          scales: {
            y: { grid: { color: c2.grid, drawBorder: false }, ticks: { color: c2.text, font: { size: 12, family: 'JetBrains Mono' }, padding: 8, callback: function (v) { return '$' + v / 1000 + 'k' } }, border: { display: false } },
            x: { grid: { display: false }, ticks: { color: c2.text, font: { size: 12, family: 'JetBrains Mono' }, padding: 8 }, border: { display: false } }
          }
        }
      });
    }
  };

})();
