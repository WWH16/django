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
  summary: null,
  programs: null,
  improvement: null,
  recent: null,
  teachers: null
};

// =======================
// ENHANCED Theme Detection (from OSAS code)
// =======================
function detectDarkMode() {
  // Check for common dark mode indicators
  const html = document.documentElement;
  const body = document.body;
  
  // Method 1: Check for dark mode classes
  if (html.classList.contains('dark') || 
      html.classList.contains('dark-mode') ||
      body.classList.contains('dark') || 
      body.classList.contains('dark-mode')) {
    return true;
  }
  
  // Method 2: Check data attributes
  if (html.getAttribute('data-theme') === 'dark' || 
      html.getAttribute('data-bs-theme') === 'dark' ||
      body.getAttribute('data-theme') === 'dark' ||
      body.getAttribute('data-bs-theme') === 'dark') {
    return true;
  }
  
  // Method 3: Check computed background color
  const htmlBg = window.getComputedStyle(html).backgroundColor;
  const bodyBg = window.getComputedStyle(body).backgroundColor;
  
  // Parse rgb values and check if background is dark
  const isDarkBackground = (bgColor) => {
    if (!bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') return false;
    const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [, r, g, b] = match.map(Number);
      // Calculate luminance (perceived brightness)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5; // Dark if luminance is less than 50%
    }
    return false;
  };
  
  return isDarkBackground(bodyBg) || isDarkBackground(htmlBg);
}

// =======================
// ENHANCED Chart Colors (combining both approaches)
// =======================
function getChartColors() {
  try {
    const isDark = detectDarkMode();
    const root = document.documentElement || document.body;
    const csRoot = getComputedStyle(root);

    const tryVars = (names, cs = csRoot) => {
      for (const n of names) {
        const v = cs.getPropertyValue(n);
        if (v && v.trim()) return v.trim();
      }
      return null;
    };

    // Enhanced background detection
    let chartBackground = null;
    const sampleEl = document.querySelector('.chart-area, .bg-white, .block, .card, .bg-base-900, .bg-base-100');
    if (sampleEl) {
      const sampleCs = getComputedStyle(sampleEl);
      chartBackground = sampleCs.backgroundColor || tryVars(['--card-bg', '--surface'], sampleCs);
      if (chartBackground && chartBackground.trim() === 'rgba(0, 0, 0, 0)') chartBackground = null;
    }

    chartBackground = chartBackground ||
      tryVars(['--bg', '--bg-base', '--base-100', '--background', '--color-background', '--surface', '--card-bg']) ||
      csRoot.backgroundColor || 'transparent';

    // Enhanced text color detection with dark mode fallback
    let textColor = tryVars(['--text', '--color-text', '--font-color', '--color', '--body-color']) || csRoot.color;
    
    const textSample = document.querySelector('.text-font-important-light, .text-font-important-dark, h1, h2, h3, h4, h5, h6, p, span');
    if (textSample) {
      const sampleColor = getComputedStyle(textSample).color;
      if (sampleColor && sampleColor !== 'rgba(0, 0, 0, 0)' && sampleColor !== 'transparent') {
        textColor = sampleColor;
      }
    }

    // Fallback based on dark mode detection
    if (!textColor || textColor === 'rgba(0, 0, 0, 0)' || textColor === 'transparent') {
      textColor = isDark ? '#e5e7eb' : '#374151';
    }

    // Enhanced grid color detection
    let gridColor = tryVars(['--border', '--border-color', '--color-border', '--muted', '--divider-color']);
    if (!gridColor || gridColor === 'rgba(0, 0, 0, 0)' || gridColor === 'transparent') {
      gridColor = isDark ? 'rgba(229, 231, 235, 0.2)' : 'rgba(55, 65, 81, 0.1)';
    }

    // Theme-responsive axis and legend colors
    const axisColor = isDark ? '#d1d5db' : '#374151';
    const legendColor = isDark ? '#f3f4f6' : '#374151';

    // Tooltip colors
    const tooltipBackground = isDark ? '#1f2937' : '#ffffff';
    const tooltipTextColor = isDark ? '#f9fafb' : '#0f172a';
    const tooltipBorderColor = isDark ? 'rgba(209, 213, 219, 0.3)' : 'rgba(55, 65, 81, 0.2)';

    return {
      chartBackground,
      textColor,
      axisColor,
      legendColor,
      gridColor,
      isDarkMode: isDark,
      tooltipBackground,
      tooltipTextColor,
      tooltipBorderColor,
      
      // Enhanced chart colors with better contrast
      positive: { 
        background: 'rgba(75, 192, 192, 0.75)', 
        border: 'rgba(75, 192, 192, 1)',
        backgroundLight: 'rgba(75, 192, 192, 0.28)'
      },
      neutral: { 
        background: 'rgba(255, 205, 86, 0.75)', 
        border: 'rgba(255, 205, 86, 1)',
        backgroundLight: 'rgba(255, 205, 86, 0.28)'
      },
      negative: { 
        background: 'rgba(255, 99, 132, 0.75)', 
        border: 'rgba(255, 99, 132, 1)',
        backgroundLight: 'rgba(255, 99, 132, 0.28)'
      }
    };
  } catch (e) {
    console.error('Error getting chart colors:', e);
    // Fallback colors
    return {
      chartBackground: 'transparent',
      textColor: '#374151',
      axisColor: '#374151',
      legendColor: '#374151',
      gridColor: 'rgba(55,65,81,0.1)',
      isDarkMode: false,
      tooltipBackground: '#ffffff',
      tooltipTextColor: '#0f172a',
      tooltipBorderColor: 'rgba(55, 65, 81, 0.2)',
      positive: { background: 'rgba(75,192,192,0.75)', border: 'rgba(75,192,192,1)', backgroundLight: 'rgba(75,192,192,0.28)' },
      neutral: { background: 'rgba(255,205,86,0.75)', border: 'rgba(255,205,86,1)', backgroundLight: 'rgba(255,205,86,0.28)' },
      negative: { background: 'rgba(255,99,132,0.75)', border: 'rgba(255,99,132,1)', backgroundLight: 'rgba(255,99,132,0.28)' }
    };
  }
}

// =======================
// Theme Change Observer (from OSAS code)
// =======================
function observeThemeChanges() {
  const observer = new MutationObserver((mutations) => {
    let shouldRerender = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && 
          (mutation.attributeName === 'class' || 
           mutation.attributeName === 'data-theme' || 
           mutation.attributeName === 'data-bs-theme')) {
        shouldRerender = true;
      }
    });
    
    if (shouldRerender) {
      // Small delay to ensure theme change is fully applied
      setTimeout(() => {
        console.log('Theme change detected, updating charts...');
        initializeCharts(); // Re-initialize charts with new theme
        // Re-apply current data if available
        if (cache.programs && cache.programs.programs) {
          updateChartsWithData(cache.programs.programs);
        }
      }, 100);
    }
  });
  
  // Observe both html and body for theme changes
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'data-bs-theme']
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'data-bs-theme']
  });
}

// =======================
// ENHANCED Charts Initialization with Theme Support
// =======================
function initializeCharts() {
  console.log('Initializing charts with theme detection...');
  
  // Check if Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.error('Chart.js is not loaded');
    return;
  }

  // Destroy existing charts
  if (barChart) {
    try { barChart.destroy(); } catch (e) { console.warn('Error destroying bar chart:', e); }
    barChart = null;
  }
  if (pieChart) {
    try { pieChart.destroy(); } catch (e) { console.warn('Error destroying pie chart:', e); }
    pieChart = null;
  }

  const colors = getChartColors();
  console.log('Chart colors:', colors);

  // Set Chart.js global defaults
  try { 
    Chart.defaults.color = colors.textColor;
  } catch (e) { 
    console.warn('Could not set Chart.js defaults:', e);
  }

  // Initialize Bar Chart with enhanced theming
  const barEl = document.getElementById('barChart');
  if (!barEl) {
    console.error('Bar chart canvas element not found');
  } else {
    const barCtx = barEl.getContext('2d');
    if (barCtx) {
      try {
        barChart = new Chart(barCtx, {
          type: 'bar',
          data: {
            labels: [],
            datasets: [
              { 
                label: 'Positive', 
                backgroundColor: colors.positive.backgroundLight, 
                borderColor: colors.positive.border,
                borderWidth: 1,
                data: [],
                maxBarThickness: 48
              },
              { 
                label: 'Neutral',  
                backgroundColor: colors.neutral.backgroundLight,  
                borderColor: colors.neutral.border,
                borderWidth: 1,
                data: [],
                maxBarThickness: 48
              },
              { 
                label: 'Negative', 
                backgroundColor: colors.negative.backgroundLight, 
                borderColor: colors.negative.border,
                borderWidth: 1,
                data: [],
                maxBarThickness: 48
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            color: colors.textColor,
            plugins: {
              legend: { 
                position: 'top', 
                labels: { 
                  color: colors.legendColor,
                  font: { weight: '600', size: 12 },
                  usePointStyle: false,
                  padding: 20
                } 
              },
              tooltip: { 
                titleColor: colors.tooltipTextColor,
                bodyColor: colors.tooltipTextColor,
                backgroundColor: colors.tooltipBackground,
                borderColor: colors.tooltipBorderColor,
                borderWidth: 1,
                padding: 8,
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 12 }
              }
            },
            scales: { 
              y: { 
                beginAtZero: true,
                min: 0,
                stacked: false,
                grid: { 
                  color: colors.gridColor,
                  drawBorder: false
                },
                ticks: { 
                  color: colors.axisColor,
                  font: { weight: '600', size: 11 },
                  precision: 0
                } 
              }, 
              x: { 
                stacked: false,
                offset: true,
                grid: { 
                  display: false,
                  color: colors.gridColor
                },
                ticks: { 
                  color: colors.axisColor,
                  font: { weight: '600', size: 11 }
                } 
              } 
            }
          }
        });
        console.log('Bar chart created successfully with theme support');
      } catch (e) {
        console.error('Error creating bar chart:', e);
      }
    }
  }

  // Initialize Pie Chart with enhanced theming
  const pieEl = document.getElementById('pieChart');
  if (!pieEl) {
    console.error('Pie chart canvas element not found');
  } else {
    const pieCtx = pieEl.getContext('2d');
    if (pieCtx) {
      try {
        pieChart = new Chart(pieCtx, {
          type: 'pie',
          data: {
            labels: ['Positive', 'Neutral', 'Negative'],
            datasets: [{
              data: [0, 0, 0],
              backgroundColor: [
                colors.positive.background,
                colors.neutral.background,
                colors.negative.background
              ],
              borderColor: [
                colors.positive.border,
                colors.neutral.border,
                colors.negative.border
              ],
              borderWidth: 1,
              hoverOffset: 5
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            color: colors.textColor,
            plugins: {
              legend: { 
                position: 'bottom', 
                labels: { 
                  color: colors.legendColor,
                  font: { weight: '600', size: 12 }, 
                  usePointStyle: true, 
                  pointStyle: 'circle',
                  boxWidth: 12,
                  padding: 20
                } 
              },
              tooltip: {
                titleColor: colors.tooltipTextColor,
                bodyColor: colors.tooltipTextColor,
                backgroundColor: colors.tooltipBackground,
                borderColor: colors.tooltipBorderColor,
                borderWidth: 1,
                padding: 8,
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 12 }
              }
            }
          }
        });
        console.log('Pie chart created successfully with theme support');
      } catch (e) {
        console.error('Error creating pie chart:', e);
      }
    }
  }
}

// =======================
// Helper function to update charts with data
// =======================
function updateChartsWithData(programs) {
  if (!programs || !programs.length) return;

  const labels = programs.map(p => p.name);
  const positive = programs.map(p => Number(p.positive || 0));
  const neutral = programs.map(p => Number(p.neutral || 0));
  const negative = programs.map(p => Number(p.negative || 0));

  console.log('Updating charts with data:', { labels, positive, neutral, negative });

  // Update bar chart
  if (barChart) {
    barChart.data.labels = labels;
    barChart.data.datasets[0].data = positive;
    barChart.data.datasets[1].data = neutral;
    barChart.data.datasets[2].data = negative;
    barChart.update();
    console.log('Bar chart updated');
  }

  // Update pie chart
  if (pieChart) {
    const totalPositive = positive.reduce((s, v) => s + v, 0);
    const totalNeutral = neutral.reduce((s, v) => s + v, 0);
    const totalNegative = negative.reduce((s, v) => s + v, 0);
    
    pieChart.data.datasets[0].data = [totalPositive, totalNeutral, totalNegative];
    pieChart.update();
    console.log('Pie chart updated');
  }
}

// =======================
// Data Loading Functions with Better Error Handling
// =======================
async function safeFetch(url, errorMessage = 'Request failed') {
  try {
    console.log(`Fetching: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Success fetching ${url}:`, data);
    return data;
  } catch (error) {
    console.error(`${errorMessage} (${url}):`, error);
    throw error;
  }
}

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

async function loadYearData(year, semester = null) {
  console.log(`Loading year data: ${year}, semester: ${semester}`);
  
  try {
    // Build URL with proper error handling
    let url = '/api/teacher-performance-by-program/';
    const params = [];
    if (year && year !== 'all') params.push(`year=${encodeURIComponent(year)}`);
    if (semester) params.push(`semester=${encodeURIComponent(semester)}`);
    if (params.length) url += '?' + params.join('&');

    // Fetch program data
    const programsData = await safeFetch(url, 'Failed to load program performance');
    cache.programs = programsData;

    const programs = programsData.programs || [];
    console.log('Programs loaded:', programs);

    // Update charts with new data
    updateChartsWithData(programs);

    // Update program KPI cards
    updateProgramCards(programs);

    // Update filter UI
    updateActiveFilter(year, semester);

    // Load teacher data
    await loadTeacherPerformanceData(year, semester);

    // Load recommendations
    loadTeacherRecommendations();

    console.log('Year data loading completed successfully');

  } catch (err) {
    console.error('Year filter failed:', err);
    alert(`Failed to apply year filter: ${err.message}. Please try again.`);
  }
}

function updateProgramCards(programs) {
  programs.forEach(prog => {
    const key = (prog.name || '').toLowerCase();
    const P = Number(prog.positive || 0);
    const U = Number(prog.neutral || 0);
    const N = Number(prog.negative || 0);
    const T = P + U + N;
    const rating = T ? Math.round((P / T) * 100) : 0;

    // Update DOM elements
    const elements = {
      positive: document.getElementById(`${key}-positive`),
      neutral: document.getElementById(`${key}-neutral`),
      negative: document.getElementById(`${key}-negative`),
      rating: document.getElementById(`${key}-rating`)
    };

    if (elements.positive) elements.positive.textContent = P.toLocaleString();
    if (elements.neutral) elements.neutral.textContent = U.toLocaleString();
    if (elements.negative) elements.negative.textContent = N.toLocaleString();
    if (elements.rating) elements.rating.textContent = rating;

    console.log(`Updated ${key} program: ${P}/${U}/${N} (${rating}%)`);
  });
}

function updateActiveFilter(year, semester) {
  document.querySelectorAll('.year-filter, .year-semester-filter').forEach(f => f.classList.remove('active'));
  
  if (semester) {
    document.querySelectorAll(`.year-semester-filter[data-year="${year}"][data-semester="${semester}"]`)
      .forEach(el => el.classList.add('active'));
  } else {
    document.querySelectorAll(`.year-filter[data-year="${year}"]`)
      .forEach(el => el.classList.add('active'));
  }
}

async function loadTeacherPerformanceData(year = 'all', semester = null) {
  let url = '/api/teacher-performance-by-teacher/';
  if (year && year !== 'all') {
    url += `?year=${encodeURIComponent(year)}`;
    if (semester) url += `&semester=${encodeURIComponent(semester)}`;
  }
  
  try {
    const data = await safeFetch(url, 'Failed to load teacher performance');
    cache.teachers = data;
    return data;
  } catch (error) {
    console.error('Teacher performance loading failed:', error);
    cache.teachers = [];
    return [];
  }
}

// =======================
// Other functions (keeping original logic, just enhanced chart support)
// =======================
function loadEvaluationData(data) {
  cache.summary = data;

  // Update KPI card counts
  document.getElementById('positive-count').textContent = Number(data.positive || 0).toLocaleString();
  document.getElementById('neutral-count').textContent = Number(data.neutral || 0).toLocaleString();
  document.getElementById('negative-count').textContent = Number(data.negative || 0).toLocaleString();
  document.getElementById('total-count').textContent = Number(data.total || 0).toLocaleString();

  // Update KPI card percentages
  document.getElementById('positive-percent').textContent = `${data.positive_percent || 0}% of total evaluations`;
  document.getElementById('neutral-percent').textContent = `${data.neutral_percent || 0}% of total evaluations`;
  document.getElementById('negative-percent').textContent = `${data.negative_percent || 0}% of total evaluations`;

  // Update pie chart percentages display
  document.getElementById('pie-positive-percent').textContent = data.positive_percent || 0;
  document.getElementById('pie-neutral-percent').textContent = data.neutral_percent || 0;
  document.getElementById('pie-negative-percent').textContent = data.negative_percent || 0;

  // Update pie chart data with theme-aware colors
  if (pieChart) {
    const colors = getChartColors();
    const chartData = [Number(data.positive || 0), Number(data.neutral || 0), Number(data.negative || 0)];
    pieChart.data.datasets[0].data = chartData;
    pieChart.data.datasets[0].backgroundColor = [
      colors.positive.background,
      colors.neutral.background,
      colors.negative.background
    ];
    pieChart.data.datasets[0].borderColor = [
      colors.positive.border,
      colors.neutral.border,
      colors.negative.border
    ];
    pieChart.update();
  }
}

function loadRecentEvaluations() {
  safeFetch('/api/recent-teacher-evaluations/', 'Failed to load recent evaluations')
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
        const safeQuote = (ev.comments || '').replace(/"/g, '&quot;');
        const programText = ev.program ? ` - ${ev.program}` : '';
        const colorClass = colorBySentiment[ev.sentiment] || 'text-muted';
        const labelText = labelBySentiment[ev.sentiment] || 'Review';

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
    .catch(error => console.error('Recent evaluations failed:', error));
}

function loadTeacherImprovementPriority() {
  safeFetch('/api/teacher-improvement-priority/', 'Failed to load teacher improvement priority')
    .then(priorityList => {
      cache.improvement = priorityList;
      const list = document.getElementById('teacher-priority-list');
      if (!list) return;

      list.innerHTML = '';
      priorityList.forEach(item => {
        let badgeClass = 'bg-secondary', rowClass = '';
        if (item.priority === 'Urgent') { 
          badgeClass = 'bg-danger'; 
          rowClass = 'is-urgent'; 
        } else if (item.priority === 'Medium') { 
          badgeClass = 'bg-warning'; 
          rowClass = 'is-review'; 
        } else if (item.priority === 'Low') { 
          badgeClass = 'bg-success'; 
          rowClass = 'is-maintain'; 
        }

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
    .catch(error => console.error('Teacher improvement priority failed:', error));
}

function loadTeacherRecommendations() {
  console.log('Loading teacher recommendations...');
  const wrap = document.getElementById('static-recos');
  if (!wrap) return;
  wrap.innerHTML = '';

  const teachers = Array.isArray(cache.teachers) ? cache.teachers : [];
  const programs = (cache.programs && cache.programs.programs) ? cache.programs.programs : [];

  if (!teachers.length && !programs.length) {
    wrap.innerHTML = `<div class="text-muted">No data available</div>`;
    return;
  }

  const REC_MIN_SAMPLE = 1;
  const pct = (num, den) => den ? (num / den) * 100 : 0;

  const pickMostByShare = (arr, keyName) => {
    let best = null;
    arr.forEach(it => {
      const pos = Number(it.positive || 0);
      const neu = Number(it.neutral || 0);
      const neg = Number(it.negative || 0);
      const tot = pos + neu + neg;
      if (tot < REC_MIN_SAMPLE) return;
      
      let share = 0;
      if (keyName === 'positive') share = pct(pos, tot);
      if (keyName === 'neutral') share = pct(neu, tot);
      if (keyName === 'negative') share = pct(neg, tot);
      
      if (!best || share > best.share) best = { ...it, total: tot, share };
    });
    return best;
  };

  const addItem = (cls, label, text) => {
    let borderColor = '';
    let backgroundColor = '';

    if (cls === 'is-urgent') {
      borderColor = '#ff6384';
      backgroundColor = 'rgba(255,99,132,0.08)';
    } else if (cls === 'is-review') {
      borderColor = '#ffcd56';
      backgroundColor = 'rgba(255,205,86,0.08)';
    } else if (cls === 'is-recognize') {
      borderColor = '#4bc0c0';
      backgroundColor = 'rgba(75,192,192,0.08)';
    } else if (cls === 'is-support') {
      borderColor = '#3b82f6';
      backgroundColor = 'rgba(59,130,246,0.08)';
    }

    wrap.insertAdjacentHTML('beforeend', `
      <div class="action-item ${cls}" style="border-left: 8px solid ${borderColor}; background: ${backgroundColor};">
        <span class="label">${label}:</span> ${text}
      </div>
    `);
  };

  // Generate recommendations
  const mostNegTeacher = pickMostByShare(teachers, 'negative');
  const mostNeuTeacher = pickMostByShare(teachers, 'neutral');
  const mostPosTeacher = pickMostByShare(teachers, 'positive');
  const mostNegProgram = pickMostByShare(programs, 'negative');

  if (mostNegTeacher) {
    const tLabel = `${mostNegTeacher.teacher || 'Teacher'}${mostNegTeacher.program ? ` (${mostNegTeacher.program})` : ''}`;
    const percent = mostNegTeacher.share.toFixed(0);
    addItem('is-urgent', 'Urgent', `Professor, ${tLabel} has received the most negative feedback, with ${percent}% of evaluations marked as negative. Immediate action is recommended to address concerns.`);
  }

  if (mostNeuTeacher) {
    const tLabel = `${mostNeuTeacher.teacher || 'Teacher'}${mostNeuTeacher.program ? ` (${mostNeuTeacher.program})` : ''}`;
    const percent = mostNeuTeacher.share.toFixed(0);
    addItem('is-review', 'Review', `Professor, ${tLabel} stands out with the highest neutral feedback at ${percent}%. This suggests a need to review and provide guidance to move evaluations toward more positive outcomes.`);
  }

  if (mostPosTeacher) {
    const tLabel = `${mostPosTeacher.teacher || 'Teacher'}${mostPosTeacher.program ? ` (${mostPosTeacher.program})` : ''}`;
    const percent = mostPosTeacher.share.toFixed(0);
    addItem('is-maintain', 'Recognize', `Professor, ${tLabel} has received the most positive evaluations, with ${percent}% marked as positive. Recognition and encouragement are recommended to reinforce this performance.`);
  }

  if (mostNegProgram) {
    const pLabel = mostNegProgram.name || mostNegProgram.program || 'Program';
    const percent = mostNegProgram.share.toFixed(0);
    addItem('is-support', 'Support', `The ${pLabel} Department, received the highest negative evaluations, with ${percent}% of feedback classified as negative. Department-level support and development initiatives are advised.`);
  }

  if (!wrap.children.length) {
    wrap.innerHTML = `<div class="text-muted">Insufficient data for recommendations</div>`;
  }
}

// =======================
// Event Handlers
// =======================
function initializeEventHandlers() {
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

  // Export handlers
  document.querySelectorAll('.export-teacher-report, #export-teacher-report-btn, #export-report-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Export clicked');
      // Export implementation
    });
  });
}

// =======================
// ENHANCED Initialization with Theme Support
// =======================
window.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, starting initialization...');
  
  // Set up theme change observer
  observeThemeChanges();
  
  // Wait a bit for Chart.js to be fully available
  setTimeout(async () => {
    try {
      // Initialize charts first with theme support
      initializeCharts();
      
      // Initialize event handlers
      initializeEventHandlers();
      
      // Load initial data
      console.log('Loading initial dashboard data...');
      
      // Load summary data
      const summaryData = await safeFetch('/api/teacher-evaluation-dashboard/', 'Failed to load dashboard summary');
      loadEvaluationData(summaryData);
      
      // Load other data
      loadRecentEvaluations();
      loadTeacherImprovementPriority();
      
      // Load initial year data (all time)
      await loadYearData('all');
      
      console.log('Dashboard initialization completed with theme support');
      
    } catch (error) {
      console.error('Dashboard initialization failed:', error);
      alert('Failed to load dashboard. Please refresh the page.');
    }
  }, 100);
});

// Enhanced Teacher Recommendations - Computed in JavaScript
function loadTeacherRecommendations() {
  console.log('Computing teacher recommendations from cached data...');
  const wrap = document.getElementById('static-recos');
  if (!wrap) return;

  wrap.innerHTML = '';

  // Get data from cache
  const teachers = Array.isArray(cache.teachers) ? cache.teachers : [];
  const programs = (cache.programs && cache.programs.programs) ? cache.programs.programs : [];
  const summary = cache.summary || {};

  console.log('Recommendation data:', { teachers: teachers.length, programs: programs.length });

  if (!teachers.length && !programs.length) {
    wrap.innerHTML = `
      <div class="text-muted text-center py-3">
        <i class="fas fa-info-circle me-2"></i>
        No data available for generating recommendations
      </div>
    `;
    return;
  }

  const recommendations = generateRecommendations(teachers, programs, summary);

  if (!recommendations.length) {
    wrap.innerHTML = `
      <div class="text-muted text-center py-3">
        <i class="fas fa-check-circle me-2"></i>
        All teachers are performing within acceptable ranges. No specific recommendations at this time.
      </div>
    `;
    return;
  }

  // Render recommendations
  recommendations.forEach(rec => {
    const borderColor = rec.borderColor || '#6c757d';
    const backgroundColor = rec.backgroundColor || 'rgba(108, 117, 125, 0.08)';
    
    wrap.insertAdjacentHTML('beforeend', `
      <div class="p-3 rounded-default border-start mb-3" 
           style="border-left: 8px solid ${borderColor}; background: ${backgroundColor};">
        <strong style="color: ${borderColor};">${rec.label}:</strong>
        <div class="mt-1">${rec.message}</div>
        ${rec.metrics ? `<div class="mt-2"><small class="text-muted">${rec.metrics}</small></div>` : ''}
        ${rec.actions ? `
          <div class="mt-2">
            <small><strong>Recommended Actions:</strong></small>
            <ul class="mt-1 mb-0" style="font-size: 0.85rem;">
              ${rec.actions.map(action => `<li>${action}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `);
  });

  console.log(`Generated ${recommendations.length} recommendations`);
}

function generateRecommendations(teachers, programs, summary) {
  const recommendations = [];
  
  // Configuration
  const config = {
    minEvaluations: 5,
    thresholds: {
      urgent: { negative: 25, minSample: 3 },
      review: { neutral: 30, minSample: 5 },
      recognize: { positive: 75, minSample: 5 },
      support: { negative: 20, minSample: 10 }
    }
  };

  // 1. URGENT: Teachers with high negative feedback
  const urgentTeacher = findTeacherByHighestShare(teachers, 'negative', config.thresholds.urgent);
  if (urgentTeacher) {
    recommendations.push({
      type: 'urgent',
      priority: 1,
      label: 'Urgent',
      message: `Professor ${urgentTeacher.teacher}${urgentTeacher.program ? ` (${urgentTeacher.program})` : ''} has received concerning negative feedback at ${urgentTeacher.percentage}% of evaluations. Immediate intervention is recommended to address student concerns and improve teaching effectiveness.`,
      metrics: `${urgentTeacher.total} total evaluations • ${urgentTeacher.negative} negative • Performance declining`,
      actions: [
        'Schedule immediate performance review meeting',
        'Provide targeted professional development training',
        'Assign experienced mentor for classroom observation',
        'Implement monthly progress monitoring'
      ],
      borderColor: '#dc2626',
      backgroundColor: 'rgba(220, 38, 38, 0.08)'
    });
  }

  // 2. REVIEW: Teachers with high neutral feedback (room for improvement)
  const reviewTeacher = findTeacherByHighestShare(teachers, 'neutral', config.thresholds.review);
  if (reviewTeacher && reviewTeacher.teacher !== urgentTeacher?.teacher) {
    recommendations.push({
      type: 'review',
      priority: 2,
      label: 'Review',
      message: `Professor ${reviewTeacher.teacher}${reviewTeacher.program ? ` (${reviewTeacher.program})` : ''} shows potential for improvement with ${reviewTeacher.percentage}% neutral evaluations. Guidance can help move these toward positive outcomes.`,
      metrics: `${reviewTeacher.total} total evaluations • ${reviewTeacher.neutral} neutral • Opportunity for growth`,
      actions: [
        'Conduct constructive feedback session',
        'Provide teaching methodology workshop',
        'Pair with high-performing colleague for collaboration',
        'Set specific improvement goals and timeline'
      ],
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.08)'
    });
  }

  // 3. RECOGNIZE: Teachers with exceptional positive feedback
  const recognizeTeacher = findTeacherByHighestShare(teachers, 'positive', config.thresholds.recognize);
  if (recognizeTeacher) {
    recommendations.push({
      type: 'recognize',
      priority: 3,
      label: 'Recognize',
      message: `Professor ${recognizeTeacher.teacher}${recognizeTeacher.program ? ` (${recognizeTeacher.program})` : ''} demonstrates teaching excellence with ${recognizeTeacher.percentage}% positive evaluations. This outstanding performance should be recognized and leveraged.`,
      metrics: `${recognizeTeacher.total} total evaluations • ${recognizeTeacher.positive} positive • Exceptional performance`,
      actions: [
        'Nominate for teaching excellence awards',
        'Invite to mentor other faculty members',
        'Document and share best teaching practices',
        'Consider for department leadership opportunities'
      ],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.08)'
    });
  }

  // 4. SUPPORT: Programs with systemic issues
  const supportProgram = findProgramByHighestShare(programs, 'negative', config.thresholds.support);
  if (supportProgram) {
    const affectedTeachers = teachers.filter(t => 
      t.program?.toLowerCase().includes(supportProgram.name?.toLowerCase() || '')
    ).length;

    recommendations.push({
      type: 'support',
      priority: 4,
      label: 'Support',
      message: `The ${supportProgram.name} Program requires department-level attention with ${supportProgram.percentage}% negative evaluations. Systemic improvements and support initiatives are needed.`,
      metrics: `${supportProgram.total} total evaluations • ${supportProgram.negative} negative • ${affectedTeachers} teachers affected`,
      actions: [
        'Conduct comprehensive program evaluation',
        'Organize department-wide faculty development',
        'Review and update curriculum standards',
        'Implement peer observation and support system'
      ],
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.08)'
    });
  }

  // 5. ADDITIONAL INSIGHTS: Low engagement or concerning trends
  const additionalInsights = generateAdditionalInsights(teachers, programs, summary, config);
  recommendations.push(...additionalInsights);

  // Sort by priority
  return recommendations.sort((a, b) => (a.priority || 99) - (b.priority || 99));
}

function findTeacherByHighestShare(teachers, sentiment, threshold) {
  let bestTeacher = null;
  let highestShare = threshold[sentiment] || 0;

  teachers.forEach(teacher => {
    const positive = Number(teacher.positive || 0);
    const neutral = Number(teacher.neutral || 0);
    const negative = Number(teacher.negative || 0);
    const total = positive + neutral + negative;

    if (total < (threshold.minSample || 3)) return;

    let share = 0;
    let count = 0;
    
    if (sentiment === 'positive') {
      share = total > 0 ? (positive / total) * 100 : 0;
      count = positive;
    } else if (sentiment === 'neutral') {
      share = total > 0 ? (neutral / total) * 100 : 0;
      count = neutral;
    } else if (sentiment === 'negative') {
      share = total > 0 ? (negative / total) * 100 : 0;
      count = negative;
    }

    if (share > highestShare) {
      bestTeacher = {
        teacher: teacher.teacher || teacher.name || 'Unknown Teacher',
        program: teacher.program,
        percentage: Math.round(share),
        total: total,
        positive: positive,
        neutral: neutral,
        negative: negative,
        [sentiment]: count,
        share: share
      };
      highestShare = share;
    }
  });

  return bestTeacher;
}

function findProgramByHighestShare(programs, sentiment, threshold) {
  let bestProgram = null;
  let highestShare = threshold[sentiment] || 0;

  programs.forEach(program => {
    const positive = Number(program.positive || 0);
    const neutral = Number(program.neutral || 0);
    const negative = Number(program.negative || 0);
    const total = positive + neutral + negative;

    if (total < (threshold.minSample || 10)) return;

    let share = 0;
    let count = 0;
    
    if (sentiment === 'positive') {
      share = total > 0 ? (positive / total) * 100 : 0;
      count = positive;
    } else if (sentiment === 'neutral') {
      share = total > 0 ? (neutral / total) * 100 : 0;
      count = neutral;
    } else if (sentiment === 'negative') {
      share = total > 0 ? (negative / total) * 100 : 0;
      count = negative;
    }

    if (share > highestShare) {
      bestProgram = {
        name: program.name || program.program || 'Unknown Program',
        percentage: Math.round(share),
        total: total,
        positive: positive,
        neutral: neutral,
        negative: negative,
        [sentiment]: count,
        share: share
      };
      highestShare = share;
    }
  });

  return bestProgram;
}

function generateAdditionalInsights(teachers, programs, summary, config) {
  const insights = [];

  // Check for low overall engagement
  const totalEvaluations = Number(summary.total || 0);
  if (totalEvaluations < 50) {
    insights.push({
      type: 'engagement',
      priority: 5,
      label: 'Engagement',
      message: `Low evaluation participation detected with only ${totalEvaluations} total responses. Consider implementing strategies to increase student feedback engagement.`,
      actions: [
        'Review evaluation distribution methods',
        'Implement incentives for participation',
        'Simplify evaluation process',
        'Increase awareness of evaluation importance'
      ],
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.08)'
    });
  }

  // Check for programs with very few teachers
  const underStaffedPrograms = programs.filter(p => {
    const total = Number(p.positive || 0) + Number(p.neutral || 0) + Number(p.negative || 0);
    return total > 0 && total < 15; // Assuming less than 15 evaluations means few teachers
  });

  if (underStaffedPrograms.length > 0) {
    const programNames = underStaffedPrograms.map(p => p.name).join(', ');
    insights.push({
      type: 'capacity',
      priority: 6,
      label: 'Capacity',
      message: `Programs with limited evaluation data detected: ${programNames}. Consider consolidating resources or increasing faculty support.`,
      actions: [
        'Assess faculty-to-student ratios',
        'Consider cross-program collaboration',
        'Evaluate resource allocation',
        'Plan strategic hiring if needed'
      ],
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.08)'
    });
  }

  return insights;
}

// Replace the existing loadTeacherRecommendations function with this simplified version
function loadTeacherRecommendations() {
  console.log('Loading teacher recommendations...');
  const wrap = document.getElementById('static-recos');
  if (!wrap) return;
  wrap.innerHTML = '';

  const teachers = Array.isArray(cache.teachers) ? cache.teachers : [];
  const programs = (cache.programs && cache.programs.programs) ? cache.programs.programs : [];

  if (!teachers.length && !programs.length) {
    wrap.innerHTML = `<div class="text-muted">No data available</div>`;
    return;
  }

  const REC_MIN_SAMPLE = 1;
  const pct = (num, den) => den ? (num / den) * 100 : 0;

  const pickMostByShare = (arr, keyName) => {
    let best = null;
    arr.forEach(it => {
      const pos = Number(it.positive || 0);
      const neu = Number(it.neutral || 0);
      const neg = Number(it.negative || 0);
      const tot = pos + neu + neg;
      if (tot < REC_MIN_SAMPLE) return;
      
      let share = 0;
      if (keyName === 'positive') share = pct(pos, tot);
      if (keyName === 'neutral') share = pct(neu, tot);
      if (keyName === 'negative') share = pct(neg, tot);
      
      if (!best || share > best.share) best = { ...it, total: tot, share };
    });
    return best;
  };

  const addItem = (cls, label, text, isLast = false) => {
    let borderColor = '';
    let backgroundColor = '';

    if (cls === 'is-urgent') {
      borderColor = '#ff6384';
      backgroundColor = 'rgba(255,99,132,0.08)';
    } else if (cls === 'is-review') {
      borderColor = '#ffcd56';
      backgroundColor = 'rgba(255,205,86,0.08)';
    } else if (cls === 'is-recognize') {
      borderColor = '#4bc0c0';
      backgroundColor = 'rgba(75,192,192,0.08)';
    } else if (cls === 'is-support') {
      borderColor = '#3b82f6';
      backgroundColor = 'rgba(59,130,246,0.08)';
    }

    const marginClass = isLast ? '' : ' mb-3';

    wrap.insertAdjacentHTML('beforeend', `
      <div class="p-3 rounded-default border-start${marginClass}" style="border-left: 8px solid ${borderColor}; background: ${backgroundColor};">
        <strong style="color: ${borderColor};">${label}:</strong>
        ${text}
      </div>
    `);
  };

  // Generate recommendations
  const mostNegTeacher = pickMostByShare(teachers, 'negative');
  const mostNeuTeacher = pickMostByShare(teachers, 'neutral');
  const mostPosTeacher = pickMostByShare(teachers, 'positive');
  const mostNegProgram = pickMostByShare(programs, 'negative');

  let itemCount = 0;
  const totalItems = [mostNegTeacher, mostNeuTeacher, mostPosTeacher, mostNegProgram].filter(Boolean).length;

  if (mostNegTeacher) {
    itemCount++;
    const tLabel = `${mostNegTeacher.teacher || 'Teacher'}${mostNegTeacher.program ? `, ${mostNegTeacher.program}` : ''}`;
    const percent = Math.round(mostNegTeacher.share);
    addItem('is-urgent', 'Urgent', `Professor, ${tLabel} has received the most negative feedback, with ${percent}% of evaluations marked as negative. Immediate action is recommended to address concerns.`, itemCount === totalItems);
  }

  if (mostNeuTeacher) {
    itemCount++;
    const tLabel = `${mostNeuTeacher.teacher || 'Teacher'}${mostNeuTeacher.program ? `, ${mostNeuTeacher.program}` : ''}`;
    const percent = Math.round(mostNeuTeacher.share);
    addItem('is-review', 'Review', `Professor, ${tLabel} stands out with the highest neutral feedback at ${percent}%. This suggests a need to review and provide guidance to move evaluations toward more positive outcomes.`, itemCount === totalItems);
  }

  if (mostPosTeacher) {
    itemCount++;
    const tLabel = `${mostPosTeacher.teacher || 'Teacher'}${mostPosTeacher.program ? `, ${mostPosTeacher.program}` : ''}`;
    const percent = Math.round(mostPosTeacher.share);
    addItem('is-recognize', 'Recognize', `Professor, ${tLabel} has received the most positive evaluations, with ${percent}% marked as positive. Recognition and encouragement are recommended to reinforce this performance.`, itemCount === totalItems);
  }

  if (mostNegProgram) {
    itemCount++;
    const pLabel = mostNegProgram.name || mostNegProgram.program || 'Program';
    const percent = Math.round(mostNegProgram.share);
    addItem('is-support', 'Support', `The ${pLabel} Department, received the highest negative evaluations, with ${percent}% of evaluations classified as negative. Support and Development initiatives are advised.`, itemCount === totalItems);
  }

  if (!wrap.children.length) {
    wrap.innerHTML = `<div class="text-muted">Insufficient data for recommendations</div>`;
  }
}