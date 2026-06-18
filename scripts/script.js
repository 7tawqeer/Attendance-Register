 // ── CONFIG ──────────────────────────────────────
    const ROLLS = Array.from({ length: 42 }, (_, i) => 250801 + i);
    const KEY = 'tawqeer_reg_v3';
    const MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const DAYS_S = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // ── STATE ────────────────────────────────────────
    let db = {};          // { "YYYY-MM-DD": Set<number> }
    let markDate = today();
    let absentOnly = false;
    let viewY = new Date().getFullYear();
    let viewM = new Date().getMonth(); // 0-indexed
    let saveT = null;

    // ── STORAGE ──────────────────────────────────────
    function saveDB() {
      try {
        const out = {};
        for (const [d, s] of Object.entries(db)) out[d] = [...s];
        localStorage.setItem(KEY, JSON.stringify(out));
      } catch (e) { }
    }
    function loadDB() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return;
        const p = JSON.parse(raw);
        for (const [d, a] of Object.entries(p)) db[d] = new Set(a);
      } catch (e) { }
    }
    function ensure(iso) { if (!db[iso]) db[iso] = new Set(); }

    // ── DATE HELPERS ─────────────────────────────────
    function today() {
      const n = new Date();
      return `${n.getFullYear()}-${p2(n.getMonth() + 1)}-${p2(n.getDate())}`;
    }
    function p2(n) { return String(n).padStart(2, '0'); }
    function fmt(iso) {
      const [y, m, d] = iso.split('-');
      return `${d} ${MONTHS_L[parseInt(m) - 1].slice(0, 3)} ${y}`;
    }
    function dayName(iso) { return DAYS_S[new Date(iso + 'T00:00:00').getDay()]; }

    // ── CLOCK ─────────────────────────────────────────
    function tick() {
      const n = new Date();
      const ds = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      document.getElementById('clockDate').textContent = `${p2(n.getDate())} ${MONTHS_L[n.getMonth()].slice(0, 3)} ${n.getFullYear()}`;
      document.getElementById('clockDay').textContent = ds[n.getDay()].toUpperCase();
    }

    // ── VIEW SWITCHING ────────────────────────────────
    function switchView(v) {
      ['mark', 'monthly', 'history'].forEach(x => {
        document.getElementById('view-' + x).style.display = (x === v) ? 'block' : 'none';
        document.querySelector(`[data-view="${x}"]`).classList.toggle('active', x === v);
      });
      if (v === 'monthly') renderMonthly();
      if (v === 'history') renderHistory();
    }

    // ── MARK VIEW ────────────────────────────────────
    function initMark() {
      document.getElementById('markDatePicker').value = markDate;
      ensure(markDate);
      renderGrid();
    }

    function onDateChange() {
      markDate = document.getElementById('markDatePicker').value || today();
      ensure(markDate);
      absentOnly = false;
      document.getElementById('absBtnLbl').textContent = 'Absent Only';
      document.getElementById('markSrch').value = '';
      renderGrid();
    }

    function goToday() {
      markDate = today();
      document.getElementById('markDatePicker').value = markDate;
      ensure(markDate);
      absentOnly = false;
      document.getElementById('markSrch').value = '';
      renderGrid();
      showToast('Switched to today');
    }

    function renderGrid() {
      const grid = document.getElementById('rollGrid');
      grid.innerHTML = '';
      const search = document.getElementById('markSrch').value.trim();
      const set = db[markDate] || new Set();
      let shown = 0;

      ROLLS.forEach((roll, i) => {
        const present = set.has(roll);
        const mS = !search || String(roll).includes(search);
        const mF = absentOnly ? !present : true;
        const vis = mS && mF;

        const c = document.createElement('div');
        c.className = 'roll-card' + (present ? ' present' : '') + (vis ? '' : ' hidden');
        c.style.animationDelay = `${Math.min(i, 25) * 12}ms`;
        c.dataset.roll = roll;
        c.innerHTML = `<span class="rc-check">✓</span>
      <span class="rc-num">${roll}</span>
      <span class="rc-status">${present ? 'present' : 'absent'}</span>`;
        c.onclick = () => toggleRoll(roll, c);
        grid.appendChild(c);
        if (vis) shown++;
      });

      if (!shown && search) {
        grid.innerHTML += `<div class="empty">No roll matching "${search}"</div>`;
      }
      updateStats();
      updateOutput();
    }

    function toggleRoll(roll, card) {
      const set = db[markDate];
      if (set.has(roll)) {
        set.delete(roll);
        card.classList.remove('present');
        card.querySelector('.rc-status').textContent = 'absent';
      } else {
        set.add(roll);
        card.classList.add('present');
        card.querySelector('.rc-status').textContent = 'present';
      }
      flashSave(); saveDB();
      updateStats(); updateOutput();
    }

    function markAll(present) {
      ensure(markDate);
      if (present) ROLLS.forEach(r => db[markDate].add(r));
      else db[markDate].clear();
      flashSave(); saveDB(); renderGrid();
      showToast(present ? 'All marked Present' : 'Cleared');
    }

    function filterGrid() {
      const s = document.getElementById('markSrch').value.trim();
      const set = db[markDate] || new Set();
      document.querySelectorAll('.roll-card').forEach(c => {
        const present = c.classList.contains('present');
        const mS = !s || c.dataset.roll.includes(s);
        const mF = absentOnly ? !present : true;
        c.classList.toggle('hidden', !(mS && mF));
      });
    }

    function toggleAbsent() {
      absentOnly = !absentOnly;
      document.getElementById('absBtnLbl').textContent = absentOnly ? 'Show All' : 'Absent Only';
      filterGrid();
    }

    function updateStats() {
      const p = (db[markDate] || new Set()).size;
      const a = 42 - p;
      document.getElementById('mPres').textContent = p;
      document.getElementById('mAbs').textContent = a;
      document.getElementById('mPct').textContent = ((p / 42) * 100).toFixed(1) + '%';
    }

    function updateOutput() {
      const set = db[markDate] || new Set();
      const body = document.getElementById('outBody');
      if (!set.size) { body.textContent = 'No students marked present yet.'; return; }
      const sorted = ROLLS.filter(r => set.has(r));
      const header = `📅 ${dayName(markDate)}, ${fmt(markDate)}\n✅ Present (${sorted.length}/42):\n`;
      body.innerHTML = header + sorted.map(r => `<span class="pr">${r}</span>`).join('  ');
    }

    function flashSave() {
      const dot = document.getElementById('saveDot');
      const lbl = document.getElementById('saveLabel');
      dot.className = 'dot saving'; lbl.textContent = 'Saving…';
      clearTimeout(saveT);
      saveT = setTimeout(() => { dot.className = 'dot green'; lbl.textContent = 'Saved ✓'; }, 700);
    }

    function copyList() {
      const set = db[markDate] || new Set();
      if (!set.size) { showToast('Nothing to copy'); return; }
      const sorted = ROLLS.filter(r => set.has(r));
      const text = `📅 ${dayName(markDate)}, ${fmt(markDate)}\n✅ Present (${sorted.length}/42):\n${sorted.join('  ')}`;
      navigator.clipboard.writeText(text)
        .then(() => {
          const b = document.getElementById('cpBtn');
          b.textContent = '✓ Copied!'; b.classList.add('copied');
          setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('copied'); }, 2000);
          showToast('Copied to clipboard!');
        }).catch(() => showToast('Copy failed'));
    }

    // ── MONTHLY VIEW ──────────────────────────────────
    function changeMonth(dir) {
      viewM += dir;
      if (viewM > 11) { viewM = 0; viewY++; }
      if (viewM < 0) { viewM = 11; viewY--; }
      renderMonthly();
    }

    function renderMonthly() {
      document.getElementById('monthLabel').textContent = `${MONTHS_L[viewM]} ${viewY}`;
      document.getElementById('monthSub').textContent = `${viewY}-${p2(viewM + 1)}`;

      const prefix = `${viewY}-${p2(viewM + 1)}-`;
      const dates = Object.keys(db).filter(d => d.startsWith(prefix)).sort();

      if (!dates.length) {
        document.getElementById('monthEmpty').style.display = 'block';
        document.getElementById('regWrap').style.display = 'none';
        document.getElementById('monthStats').innerHTML = '';
        return;
      }
      document.getElementById('monthEmpty').style.display = 'none';
      document.getElementById('regWrap').style.display = '';

      // month stats
      let totP = 0;
      dates.forEach(d => totP += (db[d] || new Set()).size);
      const totA = dates.length * 42 - totP;
      const avgPct = ((totP / (dates.length * 42)) * 100).toFixed(1);
      document.getElementById('monthStats').innerHTML = `
    <div class="stat-box"><div class="sb-label">Class Days</div><div class="sb-val c-total">${dates.length}</div></div>
    <div class="stat-box"><div class="sb-label">Total Present</div><div class="sb-val c-present">${totP}</div></div>
    <div class="stat-box"><div class="sb-label">Total Absent</div><div class="sb-val c-absent">${totA}</div></div>
    <div class="stat-box"><div class="sb-label">Avg Attendance</div><div class="sb-val c-pct">${avgPct}%</div></div>
  `;

      // table head
      const thead = document.getElementById('regHead');
      const tbody = document.getElementById('regBody');
      thead.innerHTML = ''; tbody.innerHTML = '';

      const hr = document.createElement('tr');
      hr.innerHTML = '<th class="rc">Roll No.</th>';
      dates.forEach(d => {
        const dd = d.split('-')[2];
        const dn = dayName(d);
        hr.innerHTML += `<th title="${fmt(d)}">${dd}<br><span style="color:var(--txt3);font-size:9px">${dn}</span></th>`;
      });
      hr.innerHTML += '<th>P</th><th>A</th><th>%</th>';
      thead.appendChild(hr);

      // rows
      ROLLS.forEach(roll => {
        let p = 0;
        const tr = document.createElement('tr');
        let cells = `<td class="rn" onclick="openPanel(${roll})">${roll}</td>`;
        dates.forEach(d => {
          if ((db[d] || new Set()).has(roll)) { cells += `<td class="cp">P</td>`; p++; }
          else cells += `<td class="ca">A</td>`;
        });
        const a = dates.length - p;
        const pct = dates.length ? (p / dates.length * 100).toFixed(0) : '0';
        const pc = parseInt(pct) >= 75 ? 'var(--green)' : parseInt(pct) >= 50 ? 'var(--orange)' : 'var(--red)';
        cells += `<td style="color:var(--green);font-weight:700">${p}</td>`;
        cells += `<td style="color:var(--red);font-weight:700">${a}</td>`;
        cells += `<td><span class="pct-badge" style="color:${pc};background:${pc}18">${pct}%</span></td>`;
        tr.innerHTML = cells;
        tbody.appendChild(tr);
      });
    }

    function exportCSV() {
      const prefix = `${viewY}-${p2(viewM + 1)}-`;
      const dates = Object.keys(db).filter(d => d.startsWith(prefix)).sort();
      if (!dates.length) { showToast('No data to export'); return; }
      let csv = 'Roll No.';
      dates.forEach(d => csv += `,${d}`);
      csv += ',Present,Absent,%\n';
      ROLLS.forEach(roll => {
        let p = 0; csv += roll;
        dates.forEach(d => { const v = (db[d] || new Set()).has(roll); csv += ',' + (v ? 'P' : 'A'); if (v) p++; });
        const a = dates.length - p;
        csv += `,${p},${a},${dates.length ? (p / dates.length * 100).toFixed(1) : '0'}%\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `attendance_${viewY}_${p2(viewM + 1)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      showToast('CSV exported!');
    }

    // ── HISTORY VIEW ─────────────────────────────────
    function renderHistory() {
      const search = (document.getElementById('histSrch').value || '').trim();
      const list = document.getElementById('histList');
      list.innerHTML = '';

      const allDates = Object.keys(db).sort();
      if (!allDates.length) {
        list.innerHTML = '<div class="empty">No attendance recorded yet.</div>';
        return;
      }

      const rolls = search ? ROLLS.filter(r => String(r).includes(search)) : ROLLS;
      if (!rolls.length) { list.innerHTML = '<div class="empty">No matching roll numbers.</div>'; return; }

      rolls.forEach(roll => {
        let p = 0;
        allDates.forEach(d => { if ((db[d] || new Set()).has(roll)) p++; });
        const a = allDates.length - p;
        const pct = allDates.length ? (p / allDates.length * 100).toFixed(1) : '0';
        const pc = parseFloat(pct) >= 75 ? 'var(--green)' : parseFloat(pct) >= 50 ? 'var(--orange)' : 'var(--red)';
        const div = document.createElement('div');
        div.className = 'hcard';
        div.innerHTML = `
      <div class="hc-roll">${roll}</div>
      <div class="hc-bar-wrap">
        <div class="hc-bg"><div class="hc-fill" style="width:${pct}%"></div></div>
        <div class="hc-nums">Present: ${p} &nbsp;|&nbsp; Absent: ${a} &nbsp;|&nbsp; ${allDates.length} days total</div>
      </div>
      <div class="hc-pct" style="color:${pc}">${pct}%</div>
    `;
        div.onclick = () => openPanel(roll);
        list.appendChild(div);
      });
    }

    // ── STUDENT PANEL ─────────────────────────────────
    function openPanel(roll) {
      const allDates = Object.keys(db).sort();
      let p = 0;
      const rows = allDates.map(d => {
        const present = (db[d] || new Set()).has(roll);
        if (present) p++;
        const c = present ? 'var(--green)' : 'var(--red)';
        return `<div class="sp-row">
      <span class="sp-row-d">${dayName(d)}, ${fmt(d)}</span>
      <span class="sp-row-s" style="color:${c}">${present ? '✓ Present' : '✗ Absent'}</span>
    </div>`;
      }).join('');

      const a = allDates.length - p;
      const pct = allDates.length ? (p / allDates.length * 100).toFixed(1) : '0';
      const pc = parseFloat(pct) >= 75 ? 'var(--green)' : parseFloat(pct) >= 50 ? 'var(--orange)' : 'var(--red)';

      document.getElementById('spCard').innerHTML = `
    <div class="sp-title">Roll ${roll}</div>
    <div class="sp-sub">Complete attendance record &nbsp;·&nbsp; ${allDates.length} recorded days</div>
    <div class="sp-stats-g">
      <div class="sp-stat"><div class="sp-stat-v" style="color:var(--green)">${p}</div><div class="sp-stat-l">Present</div></div>
      <div class="sp-stat"><div class="sp-stat-v" style="color:var(--red)">${a}</div><div class="sp-stat-l">Absent</div></div>
      <div class="sp-stat"><div class="sp-stat-v" style="color:${pc}">${pct}%</div><div class="sp-stat-l">Rate</div></div>
    </div>
    ${rows || '<div class="empty">No records yet.</div>'}
    <button class="sp-close-btn" onclick="closePanel()">✕ Close</button>
  `;
      document.getElementById('spOverlay').classList.add('open');
    }

    function closePanel() {
      document.getElementById('spOverlay').classList.remove('open');
    }

    // ── TOAST ─────────────────────────────────────────
    let _tt;
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg; t.classList.add('show');
      clearTimeout(_tt); _tt = setTimeout(() => t.classList.remove('show'), 2400);
    }

    // ── MIDNIGHT CHECK ────────────────────────────────
    let _lastDay = today();
    setInterval(() => {
      const t = today();
      if (t !== _lastDay) { _lastDay = t; showToast('New school day — ready to mark!'); }
    }, 30000);

    // ── INIT ──────────────────────────────────────────
    loadDB();
    tick(); setInterval(tick, 1000);
    initMark();