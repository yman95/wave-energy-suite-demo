/* Wave Forecast North America - station forecast UI.
   Data: window.WAVE_FORECAST (live, written by pipeline/run_forecast.py) or window.WAVE_REPLAY (hindcast replay). */
(function () {
  const LIVE = window.WAVE_FORECAST, REPLAY = window.WAVE_REPLAY;
  const DATA = LIVE || REPLAY;
  if (!DATA) { document.getElementById('issued').textContent = 'No forecast data found - run RUN_FORECAST.cmd'; return; }
  const isReplay = !LIVE;
  const H = DATA.hours, N = H.length;
  const stations = DATA.stations, gauges = DATA.gauges || {}, virtualPoints = DATA.virtual_points || [];
  const virtualStations = {};
  const gaugeOf = {}; Object.entries(gauges).forEach(([gid, g]) => { (gaugeOf[g.buoy] = gaugeOf[g.buoy] || []).push(gid); });
  const getStation = (sid) => stations[sid] || virtualStations[sid];

  // ---------- helpers
  const $ = (id) => document.getElementById(id);
  const fmtT = (d) => d.toISOString().slice(5, 16).replace('T', ' ') + 'Z';
  const addH = (iso, h) => new Date(new Date(iso).getTime() + h * 3600e3);
  const lerp = (a, b, t) => a + (b - a) * t;
  function haversineKm(la1, lo1, la2, lo2) {
    const rad = Math.PI / 180, dla = (la2 - la1) * rad, dlo = (lo2 - lo1) * rad;
    const a = Math.sin(dla / 2) ** 2 + Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.sin(dlo / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  }
  function interpPower(dev, hsVal, teVal) {
    const g = DATA.device_grid;
    if (!g || !dev || !dev.matrix || hsVal == null || isNaN(hsVal) || teVal == null || isNaN(teVal)) return 0;
    const hsG = g.hs, teG = g.te, mat = dev.matrix;
    const clampIdx = (arr, x) => {
      if (x <= arr[0]) return [0, 0, 0];
      const last = arr.length - 1;
      if (x >= arr[last]) return [last, last, 0];
      let k = 0; while (k < last - 1 && arr[k + 1] < x) k++;
      return [k, k + 1, (x - arr[k]) / (arr[k + 1] - arr[k])];
    };
    const [i0, i1, ti] = clampIdx(hsG, hsVal);
    const [j0, j1, tj] = clampIdx(teG, teVal);
    return lerp(lerp(mat[i0][j0], mat[i0][j1], tj), lerp(mat[i1][j0], mat[i1][j1], tj), ti);
  }
  function ramp(stops, x) {               // stops: [[v, [r,g,b]], ...]
    if (x == null || isNaN(x)) return '#475569';
    if (x <= stops[0][0]) return rgb(stops[0][1]);
    for (let i = 1; i < stops.length; i++) if (x <= stops[i][0]) {
      const t = (x - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return rgb(stops[i - 1][1].map((c, k) => lerp(c, stops[i][1][k], t)));
    }
    return rgb(stops[stops.length - 1][1]);
  }
  const rgb = (c) => `rgb(${c.map(Math.round).join(',')})`;
  const HS_STOPS = [[0, [30, 64, 175]], [1, [14, 165, 233]], [2, [45, 212, 191]], [3.5, [250, 204, 21]], [5, [249, 115, 22]], [8, [220, 38, 38]]];
  const P_STOPS = [[0, [49, 46, 129]], [10, [124, 58, 237]], [25, [219, 39, 119]], [50, [249, 115, 22]], [100, [253, 230, 138]]];
  const LVL = [{ c: '#34d399', t: 'No warning' }, { c: '#facc15', t: 'Advisory' }, { c: '#fb923c', t: 'Warning' }, { c: '#ef4444', t: 'Major' }];

  function floodAt(gid, i) {
    const g = gauges[gid], th = g.thresholds, m = g.twl[1][i], hi = g.twl[2][i]; let fl = 0;
    if (m == null) return { lvl: 0, r: [] };
    if (m > th.moderate) fl = 3; else if (m > th.minor) fl = 2; else if (hi > th.minor) fl = 1;
    return { lvl: fl, r: fl ? [`${['', 'Possible', 'Likely', 'Significant'][fl]} coastal flooding at ${g.name}: water level ${m.toFixed(2)} m (P90 ${hi.toFixed(2)}) vs minor ${th.minor.toFixed(2)} m above MHHW`] : [] };
  }
  // warning level at hour index i for station sid -> {lvl, reasons[]}
  function warnAt(sid, i) {
    const s = getStation(sid), r = []; let lvl = 0;
    if (!s) return { lvl: 0, r: [] };
    const q50 = s.hs[1][i], q90 = s.hs[2][i];
    if (s.hs_p99 != null && q50 > s.hs_p99) { lvl = 2; r.push(`High seas: median Hs ${q50.toFixed(1)} m above 1-in-100-hour level (${s.hs_p99.toFixed(1)} m)`); }
    else if ((s.hs_p95 != null && q50 > s.hs_p95) || (s.hs_p99 != null && q90 > s.hs_p99)) { lvl = 1; r.push(`Elevated seas: Hs ${q50.toFixed(1)} m (P90 ${q90.toFixed(1)} m), local 95th pct ${s.hs_p95.toFixed(1)} m`); }
    for (const gid of (gaugeOf[sid] || [])) {
      const g = gauges[gid], th = g.thresholds, m = g.twl[1][i], hi = g.twl[2][i];
      if (m != null) {
        let fl = 0;
        if (m > th.major) fl = 3; else if (m > th.moderate) fl = 3; else if (m > th.minor) fl = 2; else if (hi > th.minor) fl = 1;
        if (fl) r.push(`${['', 'Possible', 'Likely', 'Significant'][fl]} coastal flooding at ${g.name}: water level ${m.toFixed(2)} m (P90 ${hi.toFixed(2)}) vs minor ${th.minor.toFixed(2)} m above MHHW`);
        lvl = Math.max(lvl, fl);
      }
    }
    return { lvl, r };
  }

  // ---------- map
  const map = L.map('map', { zoomControl: false, worldCopyJump: true, minZoom: 2 }).setView([44, -105], 3);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  // Basemap: bundled offline coastlines (Natural Earth, public domain) - no API key, works from file://
  const offline = L.layerGroup();
  let landGeo = null, lakesGeo = null, countriesGeo = null;
  if (window.BASEMAP) {
    landGeo = L.geoJSON(window.BASEMAP.land, { interactive: false, style: { fillColor: '#1b2433', fillOpacity: 1, color: '#3a4a60', weight: 0.8 } }).addTo(offline);
    lakesGeo = L.geoJSON(window.BASEMAP.lakes, { interactive: false, style: { fillColor: '#050a12', fillOpacity: 1, color: '#3a4a60', weight: 0.5 } }).addTo(offline);
    countriesGeo = L.geoJSON(window.BASEMAP.countries, { interactive: false, style: { fill: false, color: '#64748b', weight: 0.7, dashArray: '3 3' } }).addTo(offline);
  }
  offline.addTo(map);
  const isLight = () => document.documentElement.dataset.theme === 'light';
  let mode = 'sea', hi = 0, selected = null, virtualMode = false, virtualPin = null;
  const markers = {}, vMarkers = {}, gaugeMarkers = {};
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('wave_theme', t); } catch (_) {}
    if ($('themeBtn')) $('themeBtn').textContent = t === 'light' ? '☾ Dark' : '☀ Light';
    if (landGeo) landGeo.setStyle(t === 'light' ? { fillColor: '#d8d4c8', color: '#94a3b8' } : { fillColor: '#1b2433', color: '#3a4a60' });
    if (lakesGeo) lakesGeo.setStyle(t === 'light' ? { fillColor: '#dceaf4', color: '#94a3b8' } : { fillColor: '#050a12', color: '#3a4a60' });
    if (countriesGeo) countriesGeo.setStyle({ color: '#64748b' });
    if (Object.keys(markers).length) refresh();
  }
  try { applyTheme(localStorage.getItem('wave_theme') === 'light' ? 'light' : 'dark'); } catch (_) { applyTheme('dark'); }
  function applyFont(sz) {
    const v = (sz === 'sm' || sz === 'lg') ? sz : 'md';
    document.documentElement.dataset.font = v;
    try { localStorage.setItem('wave_font', v); } catch (_) {}
    document.querySelectorAll('.fbtn[data-font]').forEach(b => b.classList.toggle('active', b.dataset.font === v));
  }
  try { applyFont(localStorage.getItem('wave_font') || 'md'); } catch (_) { applyFont('md'); }
  document.querySelectorAll('.fbtn[data-font]').forEach(b => { b.onclick = () => applyFont(b.dataset.font); });
  // NWS & ECCC Tsunami / Coastal Flood / Marine Hazard Alert Polygons
  const alerts = DATA.alerts || [];
  const alertLayer = L.layerGroup();
  const alertColor = (a) => /Tsunami Warning|Coastal Flood Warning|Storm Surge Warning|Hurricane/i.test(a.event) ? '#ef4444'
    : /Advisory|Warning/i.test(a.event) ? '#f97316' : '#facc15';
  alerts.forEach(a => {
    if (!a.geometry) return;
    const col = alertColor(a);
    const layer = L.geoJSON(a.geometry, { style: { color: col, weight: 1.8, fillColor: col, fillOpacity: 0.22 } });
    layer.bindPopup(`<div style="max-width:260px"><b>${a.agency || 'NWS'} · ${a.event}</b> (${a.severity || ''})<br><small>${a.area || ''}</small><p style="margin:6px 0 0;font-size:12px">${a.headline || ''}</p>${a.expires ? `<p style="margin:4px 0 0;font-size:11px;opacity:.75">Expires: ${fmtT(new Date(a.expires))}</p>` : ''}</div>`);
    layer.addTo(alertLayer);
  });
  // Optional online layers - both keyless
  const esriOcean = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Esri, GEBCO, NOAA, Garmin', maxZoom: 13 });
  const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Esri, Maxar, Earthstar Geographics', maxZoom: 18 });
  L.control.layers(
    { 'Offline coastlines': offline, 'Esri Ocean (bathymetry, online)': esriOcean, 'Esri Satellite (online)': esriSat },
    { 'NWS & ECCC Hazard Alerts': alertLayer },
    { position: 'bottomright', collapsed: true }
  ).addTo(map);
  map.attributionControl.addAttribution('Coastlines: Natural Earth');

  // Precompute land polygon bounding boxes for instant click/hash land rejection
  const landBoxes = [];
  if (window.BASEMAP && window.BASEMAP.land && window.BASEMAP.land.features) {
    const pushPoly = (rings) => {
      const outer = rings[0]; if (!outer || !outer.length) return;
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (let i = 0; i < outer.length; i++) {
        const x = outer[i][0], y = outer[i][1];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      landBoxes.push([minX, minY, maxX, maxY, rings]);
    };
    window.BASEMAP.land.features.forEach(ft => {
      const g = ft.geometry; if (!g) return;
      if (g.type === 'Polygon') pushPoly(g.coordinates);
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(pushPoly);
    });
  }
  function pipRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-15) + xi)) inside = !inside;
    }
    return inside;
  }
  function isOnLand(lat, lon) {
    const wlon = ((((lon + 180) % 360) + 360) % 360) - 180;
    for (let b = 0; b < landBoxes.length; b++) {
      const box = landBoxes[b];
      if (wlon < box[0] || wlon > box[2] || lat < box[1] || lat > box[3]) continue;
      const rings = box[4];
      if (!pipRing(wlon, lat, rings[0])) continue;
      let inHole = false;
      for (let h = 1; h < rings.length; h++) if (pipRing(wlon, lat, rings[h])) { inHole = true; break; }
      if (!inHole) return true;
    }
    return false;
  }
  Object.entries(stations).forEach(([sid, s]) => {
    const mk = L.circleMarker([s.lat, s.lon], { radius: 9, weight: 2, color: '#0b1220', fillOpacity: 0.95 }).addTo(map);
    mk.on('click', () => openDrawer(sid));
    mk.bindTooltip('', { className: 'stn-tip', direction: 'top', offset: [0, -8] });
    markers[sid] = mk;
  });
  virtualPoints.forEach((vp, idx) => {
    const vsid = 'v:' + idx;
    virtualStations[vsid] = Object.assign({ isVirtual: true, use: 'mre', obs_available: false }, vp);
    const vm = L.circleMarker([vp.lat, vp.lon], { radius: 6, weight: 2, color: '#38bdf8', dashArray: '3 2', fillOpacity: 0.92 }).addTo(map);
    vm.on('click', (ev) => { L.DomEvent.stopPropagation(ev); openDrawer(vsid); });
    vm.bindTooltip('', { className: 'stn-tip', direction: 'top', offset: [0, -6] });
    vMarkers[vsid] = vm;
  });
  Object.entries(gauges).forEach(([gid, g]) => {
    const cm = L.circleMarker([g.lat, g.lon], { radius: 4, weight: 1, color: '#0b1220', fillColor: '#e2e8f0', fillOpacity: .9 }).addTo(map);
    cm.bindTooltip(`<b>${g.name}</b><br>tide gauge (${g.agency || 'NOAA'})`, { className: 'stn-tip', direction: 'top' });
    cm.on('click', () => openDrawer(stations[g.buoy] ? g.buoy : 'g:' + gid));
    gaugeMarkers[gid] = cm;
  });

  function value(sid, i) {
    const s = getStation(sid);
    if (!s) return 0;
    if (mode === 'sea') return s.hs[1][i];
    if (mode === 'energy') return s.P[1][i];
    return warnAt(sid, i).lvl;
  }
  function color(v) { return mode === 'sea' ? ramp(HS_STOPS, v) : mode === 'energy' ? ramp(P_STOPS, v) : LVL[v].c; }
  function refresh() {
    const borderCol = isLight() ? '#ffffff' : '#0b1220';
    const selCol = isLight() ? '#0f172a' : '#fff';
    Object.entries(markers).forEach(([sid, mk]) => {
      const s = stations[sid], v = value(sid, hi);
      mk.setStyle({ fillColor: color(v), radius: mode === 'warn' ? 7 + 3 * v : 9, color: sid === selected ? selCol : borderCol });
      const txt = mode === 'sea' ? `Hs ${v.toFixed(2)} m  (${s.hs[0][hi].toFixed(1)}–${s.hs[2][hi].toFixed(1)})`
        : mode === 'energy' ? `${v.toFixed(1)} kW/m` : LVL[v].t;
      mk.setTooltipContent(`<b>${s.name}</b><br>${txt}`);
    });
    Object.entries(vMarkers).forEach(([vsid, vm]) => {
      const s = virtualStations[vsid], v = value(vsid, hi);
      vm.setStyle({ fillColor: color(v), radius: vsid === selected ? 8 : 6, color: vsid === selected ? selCol : '#38bdf8' });
      const txt = mode === 'sea' ? `Hs ${v.toFixed(2)} m  (${s.hs[0][hi].toFixed(1)}–${s.hs[2][hi].toFixed(1)})`
        : mode === 'energy' ? `${v.toFixed(1)} kW/m` : LVL[v].t;
      vm.setTooltipContent(`<b>${s.name}</b> · Virtual Buoy<br>${txt}`);
    });
    const s0 = stations[Object.keys(stations)[0]];
    $('lead').textContent = `T+${H[hi]} h`;
    $('valid').textContent = fmtT(addH(s0.t0, H[hi]));
    legend();
    Object.entries(gaugeMarkers).forEach(([gid, cm]) => {
      const f = floodAt(gid, hi).lvl;
      cm.setStyle(mode === 'warn' ? { fillColor: LVL[f].c, color: borderCol, radius: 4 + 2 * f } : { fillColor: isLight() ? '#334155' : '#e2e8f0', color: borderCol, radius: 4 });
    });
    if (selected) (selected.startsWith('g:') ? renderGauge(selected.slice(2)) : renderDetail(selected));
  }
  function legend() {
    const lt = $('legend-title'), lb = $('legend-bar'), tk = $('legend-ticks');
    const grad = (st, max) => 'linear-gradient(90deg,' + st.map(([v, c]) => `${rgb(c)} ${(v / max * 100).toFixed(0)}%`).join(',') + ')';
    if (mode === 'sea') { lt.textContent = 'Significant wave height Hs (m, median)'; lb.style.background = grad(HS_STOPS, 8); tk.innerHTML = '<span>0</span><span>2</span><span>4</span><span>6</span><span>8+</span>'; }
    else if (mode === 'energy') { lt.textContent = 'Wave power (kW per m of crest, median)'; lb.style.background = grad(P_STOPS, 100); tk.innerHTML = '<span>0</span><span>25</span><span>50</span><span>75</span><span>100+</span>'; }
    else { lt.textContent = 'Warning level (waves + total water level)'; lb.style.background = `linear-gradient(90deg,${LVL.map((l, i) => `${l.c} ${i * 25}%, ${l.c} ${(i + 1) * 25}%`).join(',')})`; tk.innerHTML = LVL.map(l => `<span>${l.t}</span>`).join(''); }
  }

  // ---------- header
  const issued = new Date(DATA.issued);
  $('issued').innerHTML = (isReplay ? `<span class="tag">REPLAY</span>${DATA.label || 'Hindcast'} · ` : '<span class="tag" style="background:rgba(56,189,248,.18);color:#38bdf8">LIVE</span>')
    + `issued ${fmtT(issued)} · ${Object.keys(stations).length} buoys · ${Object.keys(gauges).length} tide gauges`
    + (virtualPoints.length ? ` · ${virtualPoints.length} virtual sites` : '');
  document.querySelectorAll('.mode').forEach(b => b.onclick = () => {
    document.querySelectorAll('.mode').forEach(x => x.classList.toggle('active', x === b)); mode = b.dataset.mode;
    if (mode === 'warn' && alerts.length && !map.hasLayer(alertLayer)) alertLayer.addTo(map);
    refresh();
  });
  if ($('alertBadge') && alerts.length) {
    $('alertBadge').hidden = false;
    $('alertBadge').textContent = `⚠ ${alerts.length} Hazard Alert${alerts.length > 1 ? 's' : ''}`;
    $('alertBadge').onclick = () => {
      alertLayer.addTo(map);
      document.querySelectorAll('.mode').forEach(x => x.classList.toggle('active', x.dataset.mode === 'warn'));
      mode = 'warn'; refresh();
    };
  }
  function openSkillModal() {
    const bm = DATA.benchmark;
    if (!bm || (!bm.wave_overall?.length && !bm.surge_by_lead?.length)) {
      $('skillBody').innerHTML = '<p class="note">Benchmark summary not bundled in this file. Re-run pipeline/run_forecast_v2.py or pipeline/make_replay.py.</p>';
    } else {
      const sc = bm.live_scorecard;
      const scHtml = sc ? `<div class="section"><h3>Operational Verification Scorecard (${sc.mode === 'live_rolling' ? 'Live Rolling Archive' : 'Verifying Replay Pairs'})</h3>
        <table class="modal-tbl"><thead><tr><th>Mode</th><th>Archived Runs</th><th>Wave Pairs</th><th>AI Hs RMSE</th><th>Raw Hs RMSE</th><th>Cov80</th><th>Surge RMSE</th></tr></thead>
        <tbody><tr><td>${sc.mode}</td><td>${sc.archived_snapshots ?? 0}</td><td>${sc.n_wave_pairs ?? 0}</td><td>${sc.ai_hs_rmse_m != null ? sc.ai_hs_rmse_m.toFixed(3) + ' m' : '–'}</td><td>${sc.raw_hs_rmse_m != null ? sc.raw_hs_rmse_m.toFixed(3) + ' m' : '–'}</td><td>${sc.cov80_pct != null ? sc.cov80_pct.toFixed(1) + '%' : '–'}</td><td>${sc.surge_rmse_m != null ? sc.surge_rmse_m.toFixed(3) + ' m' : '–'}</td></tr></tbody></table></div>` : '';
      const wRows = (bm.wave_overall || []).map(r => `<tr><td>${r.model}</td><td>${r.hs_rmse.toFixed(3)} m</td><td>${r.p_mae.toFixed(2)} kW/m</td><td>${r.te_mae != null ? r.te_mae.toFixed(3) + ' s' : '–'}</td><td>${r.crps.toFixed(3)}</td><td>${r.cov80.toFixed(1)}%</td></tr>`).join('');
      const sRows = (bm.surge_by_lead || []).filter(r => [1, 6, 12, 24, 48, 72].includes(r.h)).map(r => `<tr><td>+${r.h} h</td><td>${r.persist.toFixed(3)} m</td><td>${r.ai.toFixed(3)} m</td><td>${r.cov80.toFixed(1)}%</td><td>${r.hit.toFixed(1)}%</td></tr>`).join('');
      $('skillBody').innerHTML = scHtml + `
        <div class="section"><h3>Wave Forecast Overall Mean (Held-Out 2024–2025)</h3>
          <table class="modal-tbl"><thead><tr><th>Model</th><th>Hs RMSE</th><th>Power MAE</th><th>Spectral Te MAE</th><th>CRPS</th><th>Cov80</th></tr></thead><tbody>${wRows}</tbody></table></div>
        <div class="section"><h3>Atmospheric-Forced Storm Surge by Lead (26 Gauges)</h3>
          <table class="modal-tbl"><thead><tr><th>Lead</th><th>Persistence RMSE</th><th>Surge AI RMSE</th><th>Cov80</th><th>Flood Hit Rate</th></tr></thead><tbody>${sRows}</tbody></table></div>`;
    }
    $('skillModal').hidden = false;
  }
  if ($('skillBtn')) $('skillBtn').onclick = openSkillModal;
  if ($('skillClose')) $('skillClose').onclick = () => { $('skillModal').hidden = true; };
  if ($('skillModal')) $('skillModal').onclick = (e) => { if (e.target === $('skillModal')) $('skillModal').hidden = true; };
  if ($('skillDlJson')) $('skillDlJson').onclick = () => dlFile('forecast_v2_benchmark.json', JSON.stringify(DATA.benchmark || {}, null, 2), 'application/json');
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('skillModal') && !$('skillModal').hidden) $('skillModal').hidden = true;
  });

  // First-visit decision-support legal warning & bounded mute (session / 6h / 24h / max 7d)
  const LEGAL_VER = '2026-11-v2';
  function legalMuted() {
    try {
      if (sessionStorage.getItem('wave_legal_sess') === LEGAL_VER) return true;
      const raw = localStorage.getItem('wave_legal_ack');
      if (raw) {
        const ack = JSON.parse(raw);
        if (ack && ack.ver === LEGAL_VER && Number(ack.until) > Date.now()) return true;
      }
    } catch (_) {}
    return false;
  }
  function openLegalModal(precheck) {
    if (!$('legalModal')) return;
    if ($('legalChk') && $('legalAccept')) {
      $('legalChk').checked = !!precheck;
      $('legalAccept').disabled = !$('legalChk').checked;
    }
    $('legalModal').hidden = false;
  }
  if ($('legalChk') && $('legalAccept')) {
    $('legalChk').onchange = () => { $('legalAccept').disabled = !$('legalChk').checked; };
    $('legalAccept').onclick = () => {
      if (!$('legalChk').checked) return;
      const hrs = Math.min(168, Math.max(0, Number($('legalMute')?.value || 24)));
      try {
        sessionStorage.setItem('wave_legal_sess', LEGAL_VER);
        if (hrs > 0) {
          localStorage.setItem('wave_legal_ack', JSON.stringify({ ver: LEGAL_VER, at: new Date().toISOString(), until: Date.now() + hrs * 3600e3 }));
        } else {
          localStorage.removeItem('wave_legal_ack');
        }
      } catch (_) {}
      $('legalModal').hidden = true;
    };
  }
  if ($('legalBtn')) $('legalBtn').onclick = () => openLegalModal(legalMuted());
  if (!legalMuted()) openLegalModal(false);
  $('virtualBtn').onclick = () => {
    virtualMode = !virtualMode;
    $('virtualBtn').classList.toggle('active', virtualMode);
    document.body.classList.toggle('virtual-mode', virtualMode);
  };
  if ($('themeBtn')) $('themeBtn').onclick = () => applyTheme(isLight() ? 'dark' : 'light');
  map.on('click', (e) => {
    if (!virtualMode) return;
    openVirtualAt(+e.latlng.lat.toFixed(3), +e.latlng.lng.toFixed(3));
  });
  $('hour').oninput = (e) => { hi = +e.target.value - 1; refresh(); };
  let timer = null;
  $('play').onclick = () => {
    if (timer) { clearInterval(timer); timer = null; $('play').textContent = '▶'; return; }
    $('play').textContent = '❚❚';
    timer = setInterval(() => { hi = (hi + 1) % N; $('hour').value = hi + 1; refresh(); }, 250);
  };
  $('close').onclick = () => {
    $('drawer').hidden = true; document.body.classList.remove('drawer-open');
    selected = null;
    if (virtualPin) { map.removeLayer(virtualPin); virtualPin = null; }
    refresh();
  };

  // ---------- charts (plain SVG)
  function chart({ series, band, ymin = 0, ymax, refs = [], obs = [], future = [], t0, nowIdx, unit, w = 420, h = 170 }) {
    const pad = { l: 34, r: 16, t: 8, b: 20 };
    const xs = (t) => pad.l + (t - tmin) / (tmax - tmin) * (w - pad.l - pad.r);
    const tmin = obs.length ? Math.min(-48, ...obs.map(o => o[0])) : 0, tmax = 72;
    let vals = [].concat(...series.map(s => s.y), band ? band[1] : [], obs.map(o => o[1]), future.map(o => o[1]), refs.map(r => r.v)).filter(v => v != null && !isNaN(v));
    ymax = ymax ?? Math.max(1, ...vals) * 1.08; ymin = Math.min(ymin, ...vals);
    const raw = (ymax - ymin) / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
    ymin = Math.floor(ymin / step) * step; ymax = Math.ceil(ymax / step) * step;
    const ys = (v) => pad.t + (1 - (v - ymin) / (ymax - ymin)) * (h - pad.t - pad.b);
    const path = (x, y) => y.map((v, i) => v == null ? '' : `${i && y[i - 1] != null ? 'L' : 'M'}${xs(x[i]).toFixed(1)},${ys(v).toFixed(1)}`).join('');
    let g = `<svg viewBox="0 0 ${w} ${h}" role="img">`;
    g += '<g class="grid axis">';
    for (let v = ymin; v <= ymax + 1e-9; v += step) { g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${ys(v)}" y2="${ys(v)}"/><text x="${pad.l - 4}" y="${ys(v) + 3}" text-anchor="end">${+v.toFixed(2)}</text>`; }
    for (const t of [-48, -24, 0, 24, 48, 72]) if (t >= tmin) g += `<text x="${xs(t)}" y="${h - 5}" text-anchor="middle">${t === 0 ? 'now' : (t > 0 ? '+' : '') + t + 'h'}</text>`;
    g += '</g>';
    const zeroCol = isLight() ? 'rgba(15,23,42,.25)' : 'rgba(255,255,255,.25)';
    const obsCol = isLight() ? '#0f172a' : '#e2e8f0';
    g += `<line x1="${xs(0)}" x2="${xs(0)}" y1="${pad.t}" y2="${h - pad.b}" stroke="${zeroCol}" stroke-dasharray="2 3"/>`;
    if (nowIdx != null) g += `<line x1="${xs(H[nowIdx])}" x2="${xs(H[nowIdx])}" y1="${pad.t}" y2="${h - pad.b}" stroke="#38bdf8" stroke-width="1.5"/>`;
    refs.forEach(r => { g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${ys(r.v)}" y2="${ys(r.v)}" stroke="${r.c}" stroke-dasharray="5 4" stroke-width="1.2"/><text x="${w - pad.r - 2}" y="${ys(r.v) - 3}" text-anchor="end" fill="${r.c}" font-size="10">${r.label}</text>`; });
    if (band) {
      const up = band[1].map((v, i) => `${i ? 'L' : 'M'}${xs(H[i])},${ys(v)}`).join('');
      const dn = band[0].map((v, i) => `L${xs(H[i])},${ys(v)}`).reverse().join('');
      g += `<path d="${up}${dn}Z" fill="${band[2]}" opacity=".28"/>`;
    }
    series.forEach(s => { g += `<path d="${path(s.x || H, s.y)}" fill="none" stroke="${s.c}" stroke-width="${s.wd || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`; });
    obs.forEach(o => { g += `<circle cx="${xs(o[0])}" cy="${ys(o[1])}" r="1.6" fill="${obsCol}"/>`; });
    future.forEach(o => { g += `<circle cx="${xs(o[0])}" cy="${ys(o[1])}" r="1.8" fill="none" stroke="${obsCol}" stroke-width=".9"/>`; });
    return g + '</svg>';
  }
  const rel = (pairs, t0) => (pairs || []).map(([t, v]) => [(new Date(t) - new Date(t0)) / 3600e3, v]);

  // ---------- drawer + virtual buoy + planning window
  function dlFile(name, txt, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: mime }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const calScales = {};
  function effectiveHs(sid, s) {
    const sc = calScales[sid] ? calScales[sid].scale : 1.0;
    return sc === 1.0 ? s.hs : s.hs.map(band => band.map(v => +(v * sc).toFixed(2)));
  }
  function fitBuoyCsv(sid, s, csvText) {
    const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
    const refPts = (s.obs_hist || []).map(([t, v]) => [new Date(t).getTime(), +v]).filter(x => isFinite(x[1]));
    const fallbackPts = refPts.length ? refPts : H.slice(0, 48).map((h, i) => [addH(s.t0, h).getTime(), s.hs[1][i]]);
    const ratios = [], preds = [], obs = [];
    lines.forEach((ln, idx) => {
      const parts = ln.split(',').map(x => x.trim());
      if (parts.length < 2) return;
      const tMs = new Date(parts[0]).getTime(), v = parseFloat(parts[1]);
      if (idx === 0 && (isNaN(tMs) || isNaN(v))) return;
      if (isNaN(tMs) || isNaN(v) || v <= 0) return;
      let best = null, bestDt = 1e15;
      fallbackPts.forEach(([rt, rv]) => { const dt = Math.abs(rt - tMs); if (dt < bestDt) { bestDt = dt; best = rv; } });
      if (best != null && bestDt <= 6 * 3600e3 && best > 0.05) {
        ratios.push(v / best); preds.push(best); obs.push(v);
      }
    });
    if (ratios.length < 3) throw new Error(`Found only ${ratios.length} overlapping timestamps (need >= 3 within 6h). Format: time,hs`);
    ratios.sort((a, b) => a - b);
    const med = ratios[Math.floor(ratios.length / 2)];
    const scale = Math.max(0.4, Math.min(2.5, med));
    const rmse = (arr) => Math.sqrt(arr.reduce((t, p, i) => t + (p - obs[i]) ** 2, 0) / arr.length);
    return { scale, n: ratios.length, beforeRmse: rmse(preds), afterRmse: rmse(preds.map(p => p * scale)) };
  }
  function exportStation(sid, kind) {
    const s = getStation(sid); if (!s) return;
    const hsEff = effectiveHs(sid, s);
    if (kind === 'csv') {
      const rows = ['lead_h,valid_utc,hs_p10_m,hs_p50_m,hs_p90_m,raw_hs_m,te_s,P_p10_kwm,P_p50_kwm,P_p90_kwm,wspd_ms'];
      H.forEach((h, i) => rows.push([h, addH(s.t0, h).toISOString(), hsEff[0][i], hsEff[1][i], hsEff[2][i], s.raw_hs ? s.raw_hs[i] : '', s.te[i], s.P[0][i], s.P[1][i], s.P[2][i], s.wspd && s.wspd[i] != null ? s.wspd[i] : ''].join(',')));
      dlFile(`${sid.replace(/[^a-zA-Z0-9_-]/g, '_')}_72h.csv`, rows.join('\n'), 'text/csv');
    } else {
      const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: { id: sid, name: s.name, t0: s.t0, variant: s.isVirtual ? 'virtual' : (s.variant || 'buoy'), hours: H, hs: hsEff, te: s.te, P: s.P, wspd: s.wspd || null, local_cal_scale: calScales[sid] ? calScales[sid].scale : 1.0 } }] };
      dlFile(`${sid.replace(/[^a-zA-Z0-9_-]/g, '_')}_72h.geojson`, JSON.stringify(fc, null, 2), 'application/geo+json');
    }
  }
  const hasDevices = DATA.devices && DATA.device_grid && Object.keys(DATA.devices).length > 0;
  let win = { a: 1, b: 24, dev: hasDevices ? (DATA.devices.rm3 ? 'rm3' : Object.keys(DATA.devices)[0]) : 'custom', cw: 10, eff: 0.3, hsLim: 2.0, teLim: 0, wspdLim: 0, minH: 6 };
  function openDrawer(sid) {
    selected = sid;
    if (sid !== 'v:custom' && virtualPin) { map.removeLayer(virtualPin); virtualPin = null; }
    $('drawer').hidden = false; document.body.classList.add('drawer-open'); refresh();
  }
  function blendStations(lat, lon) {
    const ranked = Object.entries(stations).map(([id, s]) => ({ id, s, d: haversineKm(lat, lon, s.lat, s.lon) }))
      .sort((a, b) => a.d - b.d).slice(0, 3);
    const rawW = ranked.map(r => 1 / Math.pow(Math.max(r.d, 5), 1.5));
    const sumW = rawW.reduce((a, b) => a + b, 0);
    const w = rawW.map(v => v / sumW);
    const hs = [0, 1, 2].map(q => H.map((_, i) => +ranked.reduce((t, r, k) => t + w[k] * r.s.hs[q][i], 0).toFixed(2)));
    const P = [0, 1, 2].map(q => H.map((_, i) => +ranked.reduce((t, r, k) => t + w[k] * r.s.P[q][i], 0).toFixed(1)));
    const te = H.map((_, i) => +ranked.reduce((t, r, k) => t + w[k] * r.s.te[i], 0).toFixed(2));
    const raw_hs = H.map((_, i) => ranked[0].s.raw_hs ? +ranked.reduce((t, r, k) => t + w[k] * (r.s.raw_hs[i] ?? r.s.hs[1][i]), 0).toFixed(2) : hs[1][i]);
    const wspd = H.map((_, i) => ranked[0].s.wspd ? +ranked.reduce((t, r, k) => t + w[k] * (r.s.wspd?.[i] ?? 0), 0).toFixed(1) : null);
    const hs_p95 = +ranked.reduce((t, r, k) => t + w[k] * (r.s.hs_p95 || 3.5), 0).toFixed(2);
    const hs_p99 = +ranked.reduce((t, r, k) => t + w[k] * (r.s.hs_p99 || 5.0), 0).toFixed(2);
    const P_mean = +ranked.reduce((t, r, k) => t + w[k] * (r.s.P_mean || 20), 0).toFixed(1);
    return { ranked, w, hs, P, te, raw_hs, wspd, hs_p95, hs_p99, P_mean };
  }
  async function openVirtualAt(lat, lon, customLabel) {
    if (isOnLand(lat, lon)) {
      if (virtualPin) { map.removeLayer(virtualPin); virtualPin = null; }
      L.popup({ closeButton: true, maxWidth: 260 })
        .setLatLng([lat, lon])
        .setContent(`<b>Land location (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)</b><br>Wave forecasts apply to offshore ocean water only. Click an offshore point.`)
        .openOn(map);
      return;
    }
    let bestVp = -1, bestD = 1e9;
    virtualPoints.forEach((vp, idx) => { const d = haversineKm(lat, lon, vp.lat, vp.lon); if (d < bestD) { bestD = d; bestVp = idx; } });
    if (bestVp >= 0 && bestD < 15) {
      map.panTo([virtualPoints[bestVp].lat, virtualPoints[bestVp].lon]);
      openDrawer('v:' + bestVp);
      return;
    }
    if (virtualPin) map.removeLayer(virtualPin);
    virtualPin = L.circleMarker([lat, lon], { radius: 8, weight: 2.5, color: '#ffffff', fillColor: '#38bdf8', dashArray: '3 2', fillOpacity: 0.95 }).addTo(map);
    const idw = blendStations(lat, lon);
    const refNames = idw.ranked.map(r => `${r.id} (${r.d.toFixed(0)} km)`).join(', ');
    const baseT0 = idw.ranked[0].s.t0;
    const baseV = {
      name: customLabel || `Virtual Buoy (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
      lat, lon, t0: baseT0, isVirtual: true, use: 'mre', obs_available: false,
      fc_model: (isReplay ? 'Offline IDW blend: ' : 'IDW blend: ') + refNames,
      hs: idw.hs, P: idw.P, te: idw.te, raw_hs: idw.raw_hs, wspd: idw.wspd,
      hs_p95: idw.hs_p95, hs_p99: idw.hs_p99, P_mean: idw.P_mean,
    };
    virtualStations['v:custom'] = baseV;
    openDrawer('v:custom');
    if (!isReplay && navigator.onLine !== false) {
      try {
        const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&hourly=wave_height,wave_period&forecast_days=4&timezone=GMT&format=csv`;
        const resp = await fetch(url);
        if (!resp.ok) return;
        const txt = await resp.text();
        const ti = txt.indexOf('\ntime,');
        if (ti < 0) return;
        const rows = txt.slice(ti + 1).trim().split(/\r?\n/).slice(1);
        const byMs = new Map();
        rows.forEach(line => {
          const [tStr, wh, wp] = line.split(',');
          const vHs = parseFloat(wh), vTe = parseFloat(wp);
          if (!isNaN(vHs)) byMs.set(new Date(tStr + 'Z').getTime(), [vHs, isNaN(vTe) ? 8.0 : vTe]);
        });
        const t0Ms = new Date(baseT0).getTime();
        const oHs = [], oTe = []; let validCnt = 0;
        for (let i = 0; i < N; i++) {
          const targetMs = t0Ms + H[i] * 3600e3;
          const got = byMs.get(targetMs);
          if (got) { oHs.push(got[0]); oTe.push(got[1]); validCnt++; }
          else { oHs.push(idw.raw_hs[i]); oTe.push(idw.te[i]); }
        }
        if (validCnt >= 24) {
          const hs = [[], [], []], P = [[], [], []];
          for (let i = 0; i < N; i++) {
            const biasRatio = idw.ranked.reduce((t, r, k) => t + idw.w[k] * (r.s.hs[1][i] / Math.max(r.s.raw_hs?.[i] || r.s.hs[1][i], 0.05)), 0);
            const relHalf = idw.ranked.reduce((t, r, k) => t + idw.w[k] * ((r.s.hs[2][i] - r.s.hs[0][i]) / (2 * Math.max(r.s.hs[1][i], 0.05))), 0);
            const q50 = Math.max(0, oHs[i] * Math.max(0.4, Math.min(2.0, biasRatio)));
            const q10 = Math.max(0, q50 * (1 - relHalf)), q90 = Math.max(q50, q50 * (1 + relHalf));
            hs[0].push(+q10.toFixed(2)); hs[1].push(+q50.toFixed(2)); hs[2].push(+q90.toFixed(2));
            P[0].push(+(0.4906 * q10 * q10 * oTe[i]).toFixed(1));
            P[1].push(+(0.4906 * q50 * q50 * oTe[i]).toFixed(1));
            P[2].push(+(0.4906 * q90 * q90 * oTe[i]).toFixed(1));
          }
          virtualStations['v:custom'] = Object.assign({}, baseV, {
            fc_model: `Live Open-Meteo Marine + IDW calibration (${refNames})`,
            hs, P, te: oTe.map(v => +v.toFixed(2)), raw_hs: oHs.map(v => +v.toFixed(2)),
          });
          if (selected === 'v:custom') refresh();
        }
      } catch (_) { /* retain offline IDW fallback cleanly */ }
    }
  }
  function gaugeChart(gid) {
    const g = gauges[gid], wlo = rel(g.wl_hist, g.t0), wlf = rel(g.wl_future, g.t0), th = g.thresholds;
    const ser = [{ y: g.twl[1], c: '#2dd4bf' }, { y: g.tide, c: '#94a3b8', dash: '4 3', wd: 1.2 }];
    if (g.stofs_twl) ser.push({ y: g.stofs_twl, c: '#fb923c', dash: '3 3', wd: 1.4 });
    return `<div class="section chart"><h3>Total water level at ${g.name} (m above MHHW)</h3>${chart({ series: ser, band: [g.twl[0], g.twl[2], '#2dd4bf'], ymin: Math.min(...g.tide.filter(v => v != null)) - .1,
      refs: [{ v: th.minor, c: '#facc15', label: 'minor flood' }, { v: th.moderate, c: '#fb923c', label: 'moderate' }], obs: wlo, future: wlf, nowIdx: hi })}
      <div class="chart-legend"><span><i style="background:#2dd4bf"></i>tide + AI surge</span><span><i style="background:#94a3b8"></i>astronomical tide</span>${g.stofs_twl ? '<span><i style="background:#fb923c"></i>NOAA STOFS-2D</span>' : ''}<span>● observed</span></div>${g.agency === 'DFO' ? '<p class="note">Canadian flood levels are provisional (NOAA method applied to the local tide range). Replace them with municipal or ECCC storm-surge alert levels.</p>' : ''}</div>`;
  }
  function renderGauge(gid) {
    const g = gauges[gid], w = floodAt(gid, hi);
    $('detail').innerHTML = `<div class="d-head"><h2>${g.name}</h2><div class="meta">${g.agency === 'DFO' ? 'DFO Canadian Hydrographic Service' : 'NOAA CO-OPS'} tide gauge ${gid} · forecast from ${fmtT(new Date(g.t0))}</div>
      <div class="chips"><span class="chip">Municipal</span><span class="chip">waves from ERA5 point (no live buoy)</span></div>
      <div class="exp-row"><button class="exp-btn" id="gPrintBtn" type="button">Print EOC Brief</button></div></div>
      <div class="status" style="background:${LVL[w.lvl].c}22;border:1px solid ${LVL[w.lvl].c}66"><span class="dot" style="background:${LVL[w.lvl].c}"></span><div>${LVL[w.lvl].t} at T+${H[hi]} h<small>${w.r.join('<br>') || 'Water level below flood thresholds.'}</small></div></div>` + gaugeChart(gid);
    if ($('gPrintBtn')) $('gPrintBtn').onclick = () => window.print();
  }
  function renderDetail(sid) {
    const s = getStation(sid), gids = gaugeOf[sid] || [];
    if (!s) return;
    const w = warnAt(sid, hi);
    const titleMeta = s.isVirtual
      ? `Virtual Buoy · ${s.lat.toFixed(2)}°, ${s.lon.toFixed(2)}°${s.depth != null ? ` · ${s.depth} m depth · ${s.dist_shore_km} km offshore` : ''} · from ${fmtT(new Date(s.t0))}`
      : `${sid.startsWith('C') ? 'DFO/ECCC buoy ' + sid.slice(1) : 'NOAA NDBC ' + sid} · ${s.region} · ${s.lat.toFixed(2)}°, ${s.lon.toFixed(2)}° · forecast from ${fmtT(new Date(s.t0))}`;
    let html = `<div class="d-head"><h2>${s.name}</h2><div class="meta">${titleMeta}</div>
      <div class="chips">${s.isVirtual ? '<span class="chip">Virtual Buoy (obs-free)</span>' : (s.use || '').split('_').filter(Boolean).map(u => `<span class="chip">${{ mre: 'Wave energy site', municipal: 'Municipal', offshore: 'Offshore ref' }[u] || u}</span>`).join('')}${s.fc_model ? `<span class="chip">${s.fc_model}</span>` : ''}${gids.map(x => `<span class="chip">${gauges[x].agency === 'DFO' ? 'DFO' : 'NOAA'} tide gauge ${gauges[x].name}</span>`).join('')}${!s.isVirtual && s.obs_available === false ? '<span class="chip">no live obs</span>' : ''}</div></div>`;
    html += `<div class="status" style="background:${LVL[w.lvl].c}22;border:1px solid ${LVL[w.lvl].c}66"><span class="dot" style="background:${LVL[w.lvl].c}"></span><div>${LVL[w.lvl].t} at T+${H[hi]} h<small>${w.r.join('<br>') || 'Conditions within normal range for this site.'}</small></div></div>`;
    const obs = rel(s.obs_hist, s.t0), fut = rel(s.obs_future, s.t0);
    const hsEff = effectiveHs(sid, s);
    const calInfo = calScales[sid];
    html += `<div class="section chart"><h3>Significant wave height (m)${calInfo ? ` · <span style="color:var(--accent)">Cal ×${calInfo.scale.toFixed(2)}</span>` : ''}</h3>${chart({ series: [{ y: hsEff[1], c: '#38bdf8' }].concat(s.raw_hs ? [{ y: s.raw_hs, c: '#94a3b8', dash: '4 3', wd: 1.3 }] : []), band: [hsEff[0], hsEff[2], '#38bdf8'],
      refs: s.hs_p95 != null ? [{ v: s.hs_p95, c: '#facc15', label: 'P95 local' }, { v: s.hs_p99, c: '#fb923c', label: 'P99' }] : [], obs, future: fut, t0: s.t0, nowIdx: hi })}
      <div class="chart-legend"><span><i style="background:#38bdf8"></i>AI median</span><span><i style="background:#38bdf8;opacity:.4;height:8px"></i>P10–P90</span><span><i style="background:#94a3b8"></i>Model raw</span><span>● observed${fut.length ? ' · ○ verifying obs' : ''}</span></div></div>`;
    if (mode === 'energy' || (s.use || '').includes('mre') || s.isVirtual) {
      html += `<div class="section chart"><h3>Wave power (kW/m)</h3>${chart({ series: [{ y: s.P[1], c: '#f472b6' }], band: [s.P[0], s.P[2], '#f472b6'], refs: s.P_mean != null ? [{ v: s.P_mean, c: '#a78bfa', label: 'site mean' }] : [], nowIdx: hi })}
      <div class="chart-legend"><span><i style="background:#f472b6"></i>median</span><span><i style="background:#f472b6;opacity:.4;height:8px"></i>P10–P90</span><span>Te median ${s.te[hi].toFixed(1)} s at T+${H[hi]} h</span></div></div>`;
    }
    for (const gid of gids) {
      html += gaugeChart(gid);
    }
    // planning window & WEC power matrix + multi-constraint O&M weather-window finder
    const a = Math.max(1, Math.min(72, win.a)), b = Math.max(a, Math.min(72, win.b)), idx = H.map((h, i) => i).filter(i => H[i] >= a && H[i] <= b);
    const meanP = idx.reduce((t, i) => t + s.P[1][i], 0) / idx.length;
    const useDev = win.dev !== 'custom' && hasDevices && DATA.devices[win.dev];
    let elec = 0, p10 = 0, p90 = 0, meanKw = 0, cfPct = null;
    if (useDev) {
      const dev = DATA.devices[win.dev];
      const e0 = idx.reduce((t, i) => t + interpPower(dev, s.hs[0][i], s.te[i]), 0) / 1000;
      const e1 = idx.reduce((t, i) => t + interpPower(dev, s.hs[1][i], s.te[i]), 0) / 1000;
      const e2 = idx.reduce((t, i) => t + interpPower(dev, s.hs[2][i], s.te[i]), 0) / 1000;
      elec = e1; p10 = Math.min(e0, e1, e2); p90 = Math.max(e0, e1, e2);
      meanKw = (e1 * 1000) / idx.length;
      cfPct = (meanKw / dev.rated) * 100;
    } else {
      const eMWh = idx.reduce((t, i) => t + s.P[1][i], 0) / 1000;
      elec = eMWh * win.cw * win.eff;
      p10 = idx.reduce((t, i) => t + s.P[0][i], 0) / 1000 * win.cw * win.eff;
      p90 = idx.reduce((t, i) => t + s.P[2][i], 0) / 1000 * win.cw * win.eff;
    }
    const maxHs = Math.max(...idx.map(i => hsEff[2][i]));
    const safeAt = (i) => hsEff[2][i] <= win.hsLim && (!win.teLim || s.te[i] <= win.teLim) && (!win.wspdLim || !s.wspd || s.wspd[i] == null || s.wspd[i] <= win.wspdLim);
    const workable = idx.filter(safeAt).length;
    let bestRun = null, curStart = null, curLen = 0;
    for (const i of idx) {
      if (safeAt(i)) {
        if (curStart == null) curStart = H[i];
        curLen++;
        if (!bestRun || curLen > bestRun.len) bestRun = { a: curStart, b: H[i], len: curLen };
      } else { curStart = null; curLen = 0; }
    }
    const isGo = bestRun && bestRun.len >= Math.max(1, win.minH || 1);
    const runCol = isGo ? '#34d399' : (bestRun ? '#facc15' : '#ef4444');
    const runText = bestRun ? `T+${bestRun.a}h – T+${bestRun.b}h (${bestRun.len} h)` : `No safe window`;
    const maxLvl = Math.max(...idx.map(i => warnAt(sid, i).lvl));
    const devOpts = (hasDevices ? Object.entries(DATA.devices).map(([k, d]) => `<option value="${k}"${win.dev === k ? ' selected' : ''}>${d.label}</option>`).join('') : '')
      + `<option value="custom"${!useDev ? ' selected' : ''}>Custom capture width &amp; efficiency</option>`;
    html += `<div class="section"><h3>Assess a planning window</h3><div class="window">
      <label class="span2">WEC Device / Method<select id="wdev">${devOpts}</select></label>
      <label>From T+ (h)<input type="number" id="wa" min="1" max="72" value="${a}"></label><label>To T+ (h)<input type="number" id="wb" min="1" max="72" value="${b}"></label>
      ${!useDev ? `<label>Device capture width (m)<input type="number" id="wcw" min="0" step="1" value="${win.cw}"></label><label>Wave-to-wire efficiency<input type="number" id="weff" min="0" max="1" step="0.05" value="${win.eff}"></label>` : ''}
      <label>Operating limit Hs (m)<input type="number" id="whs" min="0" step="0.1" value="${win.hsLim}"></label>
      <label>Max period Te (s, 0=off)<input type="number" id="wte" min="0" max="25" step="0.5" value="${win.teLim}"></label>
      <label>Max wind (m/s, 0=off)<input type="number" id="wwind" min="0" max="40" step="0.5" value="${win.wspdLim}"></label>
      <label>Min contiguous hours (h)<input type="number" id="wmin" min="1" max="72" step="1" value="${win.minH}"></label></div>
      <div class="win-box" style="border-color:${runCol}55"><span>Longest safe O&amp;M window</span><span><b style="color:${runCol}">${runText}</b><span class="go-pill" style="background:${runCol}22;color:${runCol};border:1px solid ${runCol}55">${isGo ? 'GO' : 'NO-GO'}</span></span></div>
      <div class="stats">
        <div class="stat"><div class="k">${useDev ? 'Mean electric output' : 'Mean wave power'}</div><div class="v">${useDev ? `${meanKw.toFixed(1)} <small>kW (${cfPct.toFixed(0)}% CF)</small>` : `${meanP.toFixed(1)} <small>kW/m</small>`}</div>${useDev ? `<div class="k">Wave flux ${meanP.toFixed(1)} kW/m</div>` : ''}</div>
        <div class="stat"><div class="k">Device energy (P10–P90)</div><div class="v">${elec.toFixed(2)} <small>MWh</small></div><div class="k">${p10.toFixed(2)} – ${p90.toFixed(2)} MWh</div></div>
        <div class="stat"><div class="k">Workable hours (P90 Hs, Te &amp; wind)</div><div class="v">${workable}<small> / ${idx.length}</small></div></div>
        <div class="stat"><div class="k">Peak Hs (P90) · worst warning</div><div class="v">${maxHs.toFixed(1)} <small>m</small> · <span style="color:${LVL[maxLvl].c}">${LVL[maxLvl].t}</span></div></div>
      </div>
      ${calInfo ? `<div class="win-box"><span>Private buoy cal (n=${calInfo.n})</span><span><b>×${calInfo.scale.toFixed(2)}</b> <small>(RMSE ${calInfo.beforeRmse.toFixed(2)}→${calInfo.afterRmse.toFixed(2)} m)</small> <button class="exp-btn" id="clrCalBtn" type="button" style="padding:2px 6px;margin-left:4px">Reset</button></span></div>` : ''}
      <div class="exp-row"><button class="exp-btn" id="expCsvBtn" type="button">Export CSV</button><button class="exp-btn" id="expGeoBtn" type="button">Export GeoJSON</button><button class="exp-btn" id="printBriefBtn" type="button">Print EOC Brief</button><input type="file" id="calBuoyCsv" accept=".csv" hidden><button class="exp-btn" id="calBuoyBtn" type="button" title="Upload private buoy time,hs CSV to fit local site bias">Calibrate Buoy CSV</button></div>
      <p class="note">${useDev ? `2D bilinear interpolation of the ${DATA.devices[win.dev].label} electric power matrix across P10/P50/P90 (Hs, Te) trajectories.` : 'Wave power uses P = ρg²Hs²Te/64π × capture width × efficiency.'} Flood thresholds are NOAA derived levels above MHHW (Sweet et al., 2018). Decision-support only; verify against official NWS/NTWC/ECCC warnings.</p></div>`;
    $('detail').innerHTML = html;
    $('wdev').onchange = (e) => { win.dev = e.target.value; renderDetail(sid); };
    [['wa', 'a'], ['wb', 'b'], ['wcw', 'cw'], ['weff', 'eff'], ['whs', 'hsLim'], ['wte', 'teLim'], ['wwind', 'wspdLim'], ['wmin', 'minH']].forEach(([id, k]) => { if ($(id)) $(id).onchange = (e) => { win[k] = +e.target.value; renderDetail(sid); }; });
    if ($('expCsvBtn')) $('expCsvBtn').onclick = () => exportStation(sid, 'csv');
    if ($('expGeoBtn')) $('expGeoBtn').onclick = () => exportStation(sid, 'geojson');
    if ($('printBriefBtn')) $('printBriefBtn').onclick = () => window.print();
    if ($('clrCalBtn')) $('clrCalBtn').onclick = () => { delete calScales[sid]; renderDetail(sid); };
    if ($('calBuoyBtn') && $('calBuoyCsv')) {
      $('calBuoyBtn').onclick = () => $('calBuoyCsv').click();
      $('calBuoyCsv').onchange = async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        try { calScales[sid] = fitBuoyCsv(sid, s, await f.text()); renderDetail(sid); }
        catch (err) { alert('Buoy calibration failed: ' + err.message); }
        finally { e.target.value = ''; }
      };
    }
  }
  refresh();
  const hm = window.location.hash.match(/^#(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (hm) {
    const la = parseFloat(hm[1]), lo = parseFloat(hm[2]);
    map.setView([la, lo], 6);
    if (isOnLand(la, lo)) {
      openVirtualAt(la, lo);
    } else {
      let bestVp = -1, bestVd = 1e9;
      virtualPoints.forEach((vp, idx) => { const d = haversineKm(la, lo, vp.lat, vp.lon); if (d < bestVd) { bestVd = d; bestVp = idx; } });
      if (bestVp >= 0 && bestVd < 25) openDrawer('v:' + bestVp);
      else {
        let bestSid = null, bestSd = 1e9;
        Object.entries(stations).forEach(([sid, s]) => { const d = haversineKm(la, lo, s.lat, s.lon); if (d < bestSd) { bestSd = d; bestSid = sid; } });
        if (bestSid && bestSd < 20) openDrawer(bestSid);
        else openVirtualAt(la, lo, `Site (${la.toFixed(2)}°, ${lo.toFixed(2)}°)`);
      }
    }
  }
})();
