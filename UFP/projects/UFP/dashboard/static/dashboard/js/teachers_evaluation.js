let barChart, pieChart;

// =======================
// CSV helpers
// =======================
function csvEscape(value) {
  const v = value ?? '';
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}
function arrayToCsv(rows) {
  return rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
}
function downloadCsv(filename, csvString) {
  const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// =======================
// Data Cache
// =======================
const cache = {
  summary: null,     // from /api/teacher-evaluation-dashboard/
  programs: null,    // { programs: [...] } current (filtered) program performance
  improvement: null, // from /api/teacher-improvement-priority/
  recent: null,      // from /api/recent-teacher-evaluations/
  teachers: null     // current (filtered) teacher performance array
};

// =======================
// Chart Colors (match KPI cards)
// =======================
const sharedColors = {
  positive: '#198754',           // success
  neutral:  '#ffc107',           // warning
  negative: '#dc3545',           // danger
  positiveBorder: '#198754',
  neutralBorder:  '#ffc107',
  negativeBorder: '#dc3545'
};

// =======================
// Charts
// =======================
function initializeCharts() {
  const barCtx = document.getElementById('barChart').getContext('2d');
  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label: 'Positive', backgroundColor: sharedColors.positive, borderColor: sharedColors.positiveBorder, borderWidth: 0, data: [] },
        { label: 'Neutral',  backgroundColor: sharedColors.neutral,  borderColor: sharedColors.neutralBorder,  borderWidth: 0, data: [] },
        { label: 'Negative', backgroundColor: sharedColors.negative, borderColor: sharedColors.negativeBorder, borderWidth: 0, data: [] }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, min: 0 } }
      }
    }
  });

  const pieCtx = document.getElementById('pieChart').getContext('2d');
  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: ['Positive', 'Neutral', 'Negative'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: [sharedColors.positive, sharedColors.neutral, sharedColors.negative],
        borderColor:    [sharedColors.positiveBorder, sharedColors.neutralBorder, sharedColors.negativeBorder],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

// Convenience: get current active year/semester from UI
function getActiveFilter() {
  const active = document.querySelector('.year-filter.active, .year-semester-filter.active');
  let year = 'all', semester = null;
  if (active) {
    year = active.getAttribute('data-year') || 'all';
    const s = active.getAttribute('data-semester');
    if (s) semester = s;
  }
  return { year, semester };
}

// =======================
// Year/Semester filter (updates charts + caches + recos)
// =======================
async function loadYearData(year, semester = null) {
  try {
    // 1) Programs (for bar/pie + per-program cards + recos)
    let programsData;
    if (year === 'all') {
      const programsRes = await fetch('/api/teacher-performance-by-program/');
      programsData = await programsRes.json();
    } else {
      let url = `/api/teacher-evaluation-by-semester/?year=${year}`;
      if (semester) url += `&semester=${semester}`;
      const res = await fetch(url);
      const data = await res.json();
      programsData = { programs: data.programs || [] };
    }
    cache.programs = programsData;

    const programs = programsData.programs || [];
    const labels   = programs.map(p => p.name);
    const positive = programs.map(p => Number(p.positive || 0));
    const neutral  = programs.map(p => Number(p.neutral  || 0));
    const negative = programs.map(p => Number(p.negative || 0));

    // Bar
    barChart.data.labels = labels;
    barChart.data.datasets = [
      { label: 'Positive', backgroundColor: sharedColors.positive, borderColor: sharedColors.positiveBorder, borderWidth: 0, data: positive },
      { label: 'Neutral',  backgroundColor: sharedColors.neutral,  borderColor: sharedColors.neutralBorder,  borderWidth: 0, data: neutral  },
      { label: 'Negative', backgroundColor: sharedColors.negative, borderColor: sharedColors.negativeBorder,  borderWidth: 0, data: negative }
    ];
    barChart.update();

    // Pie
    pieChart.data.datasets[0].data = [
      positive.reduce((s, v) => s + v, 0),
      neutral.reduce((s, v) => s + v, 0),
      negative.reduce((s, v) => s + v, 0)
    ];
    pieChart.update();

    // Update per-program cards
    programs.forEach(prog => {
      const key = (prog.name || '').toLowerCase();
      const p = Number(prog.positive || 0), u = Number(prog.neutral || 0), n = Number(prog.negative || 0);
      const t = p + u + n;
      const rating = t ? Math.round((p / t) * 100) : 0;

      const posEl = document.getElementById(`${key}-positive`);
      const neuEl = document.getElementById(`${key}-neutral`);
      const negEl = document.getElementById(`${key}-negative`);
      const rateEl = document.getElementById(`${key}-rating`);

      if (posEl) posEl.textContent = p.toLocaleString();
      if (neuEl) neuEl.textContent = u.toLocaleString();
      if (negEl) negEl.textContent = n.toLocaleString();
      if (rateEl) rateEl.textContent = rating;
    });

    // 2) Activate UI filters
    document.querySelectorAll('.year-filter, .year-semester-filter').forEach(f => f.classList.remove('active'));
    if (semester) {
      document.querySelectorAll(`.year-semester-filter[data-year="${year}"][data-semester="${semester}"]`).forEach(el => el.classList.add('active'));
    } else {
      document.querySelectorAll(`.year-filter[data-year="${year}"]`).forEach(el => el.classList.add('active'));
    }

    // 3) Teachers (for recos + CSV), fetch with same filter
    await loadTeacherPerformanceData(year, semester);

    // 4) Recompute recommendations using filtered caches
    loadTeacherRecommendations();
  } catch (err) {
    console.error('Year filter failed:', err);
    alert('Failed to apply year filter. Please try again.');
  }
}

// =======================
// CSV Builder
// =======================
function buildTeacherCsv(cacheObj, filterInfo = {}) {
  const now = new Date().toISOString();
  const { year = 'all', semester = null } = filterInfo;

  const s = cacheObj.summary || {};
  const total = Number(s.total || 0);
  const pos = Number(s.positive || 0);
  const neu = Number(s.neutral || 0);
  const neg = Number(s.negative || 0);
  const ppos = Number(s.positive_percent ?? (total ? Math.round((pos / total) * 100) : 0));
  const pneu = Number(s.neutral_percent  ?? (total ? Math.round((neu / total) * 100) : 0));
  const pneg = Number(s.negative_percent ?? (total ? Math.round((neg / total) * 100) : 0));

  const filterText = year === 'all' ? 'All Time' : `Year ${year}${semester ? `, Semester ${semester}` : ''}`;

  const header = [
    ['Teacher Evaluation Sentiment Analysis Export'],
    ['Generated At', now],
    ['Data Filter', filterText],
    []
  ];

  const summary = [
    ['Summary'],
    ['Total', 'Positive', 'Neutral', 'Negative', 'Positive %', 'Neutral %', 'Negative %'],
    [total, pos, neu, neg, ppos, pneu, pneg],
    []
  ];

  const programs = (cacheObj.programs && cacheObj.programs.programs) ? cacheObj.programs.programs : [];
  const programRows = programs.map(p => {
    const P = Number(p.positive || 0), U = Number(p.neutral || 0), N = Number(p.negative || 0);
    const T = P + U + N;
    return [p.name || '', P, U, N, T,
      T ? Math.round((P / T) * 100) : 0,
      T ? Math.round((U / T) * 100) : 0,
      T ? Math.round((N / T) * 100) : 0
    ];
  });

  const perProgram = [
    ['Per-Program Breakdown'],
    ['Program', 'Positive', 'Neutral', 'Negative', 'Total', 'Positive %', 'Neutral %', 'Negative %'],
    ...programRows
  ];

  const teachers = Array.isArray(cacheObj.teachers) ? cacheObj.teachers : [];
  const teacherRows = teachers
    .map(t => {
      const name = t.teacher || 'Unknown';
      const P = Number(t.positive || 0), U = Number(t.neutral || 0), N = Number(t.negative || 0);
      const T = P + U + N;
      return { name, P, U, N, T };
    })
    .sort((a, b) => b.T - a.T)
    .map(t => [t.name, t.P, t.U, t.N, t.T]);

  const perTeacher = [
    [],
    ['Per-Teacher Breakdown'],
    ['Teacher', 'Positive', 'Neutral', 'Negative', 'Total'],
    ...teacherRows
  ];

  return arrayToCsv([...header, ...summary, ...perProgram, ...perTeacher]);
}

// =======================
// KPI + Pie
// =======================
function loadEvaluationData(data) {
  cache.summary = data;

  document.getElementById('positive-count').textContent = Number(data.positive || 0).toLocaleString();
  document.getElementById('neutral-count').textContent  = Number(data.neutral  || 0).toLocaleString();
  document.getElementById('negative-count').textContent = Number(data.negative || 0).toLocaleString();
  document.getElementById('total-count').textContent    = Number(data.total    || 0).toLocaleString();

  document.getElementById('positive-percent').textContent = `${data.positive_percent || 0}% of total reviews`;
  document.getElementById('neutral-percent').textContent  = `${data.neutral_percent  || 0}% of total reviews`;
  document.getElementById('negative-percent').textContent = `${data.negative_percent || 0}% of total reviews`;

  document.getElementById('pie-positive-percent').textContent = data.positive_percent || 0;
  document.getElementById('pie-neutral-percent').textContent  = data.neutral_percent  || 0;
  document.getElementById('pie-negative-percent').textContent = data.negative_percent || 0;

  const chartData = [Number(data.positive || 0), Number(data.neutral || 0), Number(data.negative || 0)];
  pieChart.data.datasets[0].data = chartData;
  pieChart.data.datasets[0].backgroundColor = [sharedColors.positive, sharedColors.neutral, sharedColors.negative];
  pieChart.update();
}

// =======================
// Recent Evaluations (sentiment label above comment)
// =======================
function loadRecentEvaluations() {
  fetch('/api/recent-teacher-evaluations/')
    .then(r => r.json())
    .then(evaluations => {
      cache.recent = evaluations;
      const list = document.getElementById('recent-evaluations-list');
      if (!list) return;

      list.innerHTML = '';

      const colorBySentiment = {
        Positive: 'text-success',
        Neutral:  'text-warning',
        Negative: 'text-danger'
      };

      const labelBySentiment = {
        Positive: 'Positive Sentiment',
        Neutral:  'Neutral Sentiment',
        Negative: 'Negative Sentiment'
      };

      evaluations.forEach(ev => {
        const safeQuote   = (ev.comments || '').replace(/"/g, '&quot;');
        const programText = ev.program ? ` - ${ev.program}` : '';

        const colorClass = colorBySentiment[ev.sentiment] || 'text-muted';
        const labelText  = labelBySentiment[ev.sentiment] || 'Review';

        list.insertAdjacentHTML('beforeend', `
          <li class="list-group-item">
            <div class="row align-items-center no-gutters">
              <div class="col me-2">
                <h6 class="mb-0"><strong>${ev.teacher || 'Teacher'}${programText}</strong></h6>
                <span class="text-xs ${colorClass}">${labelText}</span>
                <p class="text-xs text-muted mb-0">"${safeQuote}"</p>
              </div>
            </div>
          </li>
        `);
      });
    })
    .catch(error => console.error('Failed to load recent evaluations:', error));
}

// =======================
// Program Performance (fills cache.programs on initial load)
// =======================
function loadProgramPerformance() {
  return fetch('/api/teacher-performance-by-program/')
    .then(r => r.json())
    .then(data => {
      cache.programs = data;
      return data;
    })
    .catch(error => {
      console.error('Failed to load program performance:', error);
    });
}

// =======================
// Teacher Improvement Priority (existing separate list)
// =======================
function loadTeacherImprovementPriority() {
  fetch('/api/teacher-improvement-priority/')
    .then(r => r.json())
    .then(priorityList => {
      cache.improvement = priorityList;
      const list = document.getElementById('teacher-priority-list');
      if (!list) return;

      list.innerHTML = '';
      priorityList.forEach(item => {
        let badgeClass = 'bg-secondary', rowClass = '';
        if (item.priority === 'Urgent')  { badgeClass = 'bg-danger';  rowClass = 'is-urgent'; }
        else if (item.priority === 'Medium') { badgeClass = 'bg-warning'; rowClass = 'is-review'; }
        else if (item.priority === 'Low')    { badgeClass = 'bg-success'; rowClass = 'is-maintain'; }

        list.insertAdjacentHTML('beforeend', `
          <li class="list-group-item priority-item ${rowClass}">
            <div class="pri-left">
              <strong>${item.teacher || ''}</strong>${item.program ? ` (${item.program})` : ''}<br>
              <span class="text-muted">${Number(item.percent_negative || 0)}% negative reviews</span>
            </div>
            <span class="badge ${badgeClass}">${item.priority || ''}</span>
          </li>
        `);
      });
    })
    .catch(error => console.error('Failed to load teacher improvement priority:', error));
}

// =======================
// Events (Export + Filters)
// =======================
function initializeEventHandlers() {
  // Export
  document.querySelectorAll('.export-teacher-report, #export-teacher-report-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const { year, semester } = getActiveFilter();

        let programsData, summaryData, teachersData;

        if (year === 'all') {
          const [programsRes, summaryRes, teachersRes] = await Promise.all([
            fetch('/api/teacher-performance-by-program/'),
            fetch('/api/teacher-evaluation-dashboard/'),
            fetch('/api/teacher-performance-by-teacher/')
          ]);
          programsData = await programsRes.json();
          summaryData  = await summaryRes.json();
          teachersData = await teachersRes.json();
        } else {
          let url = `/api/teacher-evaluation-by-semester/?year=${year}`;
          if (semester) url += `&semester=${semester}`;

          const [filterRes, teachersRes] = await Promise.all([
            fetch(url),
            fetch(`/api/teacher-performance-by-teacher/?year=${year}${semester ? `&semester=${semester}` : ''}`)
          ]);

          const filterData = await filterRes.json();
          programsData = { programs: filterData.programs || [] };
          teachersData = await teachersRes.json();

          const positive = programsData.programs.reduce((sum, p) => sum + (Number(p.positive) || 0), 0);
          const neutral  = programsData.programs.reduce((sum, p) => sum + (Number(p.neutral)  || 0), 0);
          const negative = programsData.programs.reduce((sum, p) => sum + (Number(p.negative) || 0), 0);
          const total    = positive + neutral + negative;

          summaryData = {
            total,
            positive,
            neutral,
            negative,
            positive_percent: total ? Math.round((positive / total) * 100) : 0,
            neutral_percent:  total ? Math.round((neutral  / total) * 100) : 0,
            negative_percent: total ? Math.round((negative / total) * 100) : 0
          };
        }

        const csv = buildTeacherCsv({
          summary:  summaryData,
          programs: programsData,
          teachers: teachersData
        }, { year, semester });

        let filename = 'teacher-evaluation-dashboard';
        if (year !== 'all') {
          filename += `_${year}`;
          if (semester) filename += `-sem${semester}`;
        }
        filename += `_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;

        downloadCsv(filename, csv);
      } catch (err) {
        console.error('Export failed:', err);
        alert('Sorry—failed to export the report. Please try again.');
      }
    });
  });

  // Year filters
  document.querySelectorAll('.year-filter').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      const year = e.currentTarget.getAttribute('data-year');
      await loadYearData(year);
    });
  });

  // Year-semester filters
  document.querySelectorAll('.year-semester-filter').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      const year = e.currentTarget.getAttribute('data-year');
      const semester = e.currentTarget.getAttribute('data-semester');
      await loadYearData(year, semester);
    });
  });
}

// =======================
// Teacher performance list (supports filters)
// =======================
function loadTeacherPerformanceData(year = 'all', semester = null) {
  let url = '/api/teacher-performance-by-teacher/';
  if (year && year !== 'all') {
    url += `?year=${encodeURIComponent(year)}`;
    if (semester) url += `&semester=${encodeURIComponent(semester)}`;
  }
  return fetch(url)
    .then(r => r.json())
    .then(data => {
      cache.teachers = data;
      return data;
    })
    .catch(error => console.error('Failed to load teacher performance data:', error));
}

// =======================
// Teacher Development Recommendations (JS-only)
// =======================
const REC_MIN_SAMPLE = 1; // set to 5 or 10 if you want to ignore tiny samples
function loadTeacherRecommendations() {
  const wrap = document.getElementById('static-recos');
  if (!wrap) return;
  wrap.innerHTML = '';

  const teachers = Array.isArray(cache.teachers) ? cache.teachers : [];
  const programs = (cache.programs && cache.programs.programs) ? cache.programs.programs : [];

  // nothing to show
  if (!teachers.length && !programs.length) {
    wrap.innerHTML = `<div class="text-muted">No data available</div>`;
    return;
  }

  const pct = (num, den) => den ? (num / den) * 100 : 0;

  // pickers
  const pickMostByShare = (arr, keyName) => {
    let best = null;
    arr.forEach(it => {
      const pos = Number(it.positive || 0);
      const neu = Number(it.neutral  || 0);
      const neg = Number(it.negative || 0);
      const tot = pos + neu + neg;
      if (tot < REC_MIN_SAMPLE) return;
      let share = 0;
      if (keyName === 'positive') share = pct(pos, tot);
      if (keyName === 'neutral')  share = pct(neu, tot);
      if (keyName === 'negative') share = pct(neg, tot);
      if (!best || share > best.share) best = { ...it, total: tot, share };
    });
    return best;
  };

  // build four items
  const mostNegTeacher = pickMostByShare(teachers, 'negative');
  const mostNeuTeacher = pickMostByShare(teachers, 'neutral');
  const mostPosTeacher = pickMostByShare(teachers, 'positive');
  const mostNegProgram = pickMostByShare(programs, 'negative');

  // render helpers
  const addItem = (cls, label, text) => {
    wrap.insertAdjacentHTML('beforeend', `
      <div class="action-item ${cls}">
        <span class="label">${label}:</span> ${text}
      </div>
    `);
  };

  if (mostNegTeacher) {
    const tLabel = `${mostNegTeacher.teacher || 'Teacher'}${mostNegTeacher.program ? ` (${mostNegTeacher.program})` : ''}`;
    const percent = mostNegTeacher.share.toFixed(0);
    addItem(
      'is-urgent',
      'Urgent',
      `Professor, ${tLabel} has received the most negative feedback, with ${percent}% of evaluations marked as negative. Immediate action is recommended to address concerns.`
    );
  }

  if (mostNeuTeacher) {
    const tLabel = `${mostNeuTeacher.teacher || 'Teacher'}${mostNeuTeacher.program ? ` (${mostNeuTeacher.program})` : ''}`;
    const percent = mostNeuTeacher.share.toFixed(0);
    addItem(
      'is-review',
      'Review',
      `Professor, ${tLabel} stands out with the highest neutral feedback at ${percent}%. This suggests a need to review and provide guidance to move evaluations toward more positive outcomes.`
    );
  }

  if (mostPosTeacher) {
    const tLabel = `${mostPosTeacher.teacher || 'Teacher'}${mostPosTeacher.program ? ` (${mostPosTeacher.program})` : ''}`;
    const percent = mostPosTeacher.share.toFixed(0);
    addItem(
      'is-maintain',
      'Recognize',
      `Professor, ${tLabel} has received the most positive evaluations, with ${percent}% marked as positive. Recognition and encouragement are recommended to reinforce this performance.`
    );
  }

  if (mostNegProgram) {
    const pLabel = mostNegProgram.name || mostNegProgram.program || 'Program';
    const percent = mostNegProgram.share.toFixed(0);
    addItem(
      'is-support',
      'Support',
      `The ${pLabel} Department, received the highest negative evaluations, with ${percent}% of feedback classified as negative. Department-level support and development initiatives are advised.`
    );
  }

  // if still empty (e.g., all below sample threshold)
  if (!wrap.children.length) {
    wrap.innerHTML = `<div class="text-muted">Insufficient data for recommendations</div>`;
  }
}

// =======================
// Init
// =======================
window.addEventListener('DOMContentLoaded', async () => {
  initializeCharts();
  initializeEventHandlers();

  // Load static widgets
  loadRecentEvaluations();
  loadTeacherImprovementPriority();

  // Initial summary (KPI + pie percentages)
  fetch('/api/teacher-evaluation-dashboard/')
    .then(res => res.json())
    .then(data => loadEvaluationData(data))
    .catch(error => {
      console.error('Failed to load dashboard summary:', error);
    });

  // Initial program + teacher data (all time) then recos
  try {
    await loadYearData('all'); // sets cache.programs, fetches teachers with same filter, then renders recos
  } catch (e) {
    console.error('Initial load failed:', e);
    alert('Failed to load dashboard data. Please refresh the page.');
  }
});
