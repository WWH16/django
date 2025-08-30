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

// Current filter settings for export
let currentFilters = {
  year: 'all',
  semester: 'all'
};

// Export filtered data based on current filter settings
async function exportFilteredData() {
  try {
    console.log('Exporting data with filters:', currentFilters);
    
    // Always use cached data for export to ensure consistency
    let programs = [];
    let teachers = [];
    
    if (cache.programs && cache.programs.programs) {
      programs = cache.programs.programs;
    }
    if (cache.teachers && Array.isArray(cache.teachers)) {
      teachers = cache.teachers;
    }
    
    if (programs.length === 0 && teachers.length === 0) {
      alert('No data available to export for the selected filters.');
      return;
    }
    
    const csvRows = [];
    
    // --- Add Report Metadata ---
    csvRows.push(['Teacher Evaluation Sentiment Analysis Export']);
    csvRows.push([`Generated: ${new Date().toISOString()}`]);
    let filterInfo = `Data Filter: Year ${currentFilters.year === 'all' ? 'All Years' : currentFilters.year}`;
    if (currentFilters.semester && currentFilters.semester !== 'all') {
      filterInfo += `, Semester ${currentFilters.semester}`;
    }
    csvRows.push([filterInfo]);
    csvRows.push([]); // Empty row for separation
    
    // --- Summary Section ---
    let totalPositive = 0, totalNeutral = 0, totalNegative = 0, grandTotal = 0;
    if (programs.length > 0) {
      programs.forEach(prog => {
        totalPositive += Number(prog.positive || 0);
        totalNeutral += Number(prog.neutral || 0);
        totalNegative += Number(prog.negative || 0);
        grandTotal += Number(prog.total || 0);
      });
    } else if (teachers.length > 0) {
      teachers.forEach(teacher => {
        totalPositive += Number(teacher.positive || 0);
        totalNeutral += Number(teacher.neutral || 0);
        totalNegative += Number(teacher.negative || 0);
        grandTotal += Number(teacher.total || 0);
      });
    }
    
    const grandPositivePercent = grandTotal > 0 ? Math.round((totalPositive / grandTotal) * 100) : 0;
    const grandNeutralPercent = grandTotal > 0 ? Math.round((totalNeutral / grandTotal) * 100) : 0;
    const grandNegativePercent = grandTotal > 0 ? Math.round((totalNegative / grandTotal) * 100) : 0;
    
    csvRows.push(['Summary']);
    csvRows.push(['Total', 'Positive', 'Neutral', 'Negative', 'Positive %', 'Neutral %', 'Negative %']);
    csvRows.push([
      grandTotal,
      totalPositive,
      totalNeutral,
      totalNegative,
      grandPositivePercent,
      grandNeutralPercent,
      grandNegativePercent
    ]);
    csvRows.push([]); // Empty row for separation
    
    // --- Per-Program Breakdown Section ---
    if (programs.length > 0) {
      csvRows.push(['Per-Program Breakdown']);
      csvRows.push(['Program', 'Positive', 'Neutral', 'Negative', 'Total', 'Positive %', 'Neutral %', 'Negative %']);
      programs.forEach(prog => {
        const total = Number(prog.total || 0);
        const positive = Number(prog.positive || 0);
        const neutral = Number(prog.neutral || 0);
        const negative = Number(prog.negative || 0);
        
        const positivePercent = total > 0 ? Math.round((positive / total) * 100) : 0;
        const neutralPercent = total > 0 ? Math.round((neutral / total) * 100) : 0;
        const negativePercent = total > 0 ? Math.round((negative / total) * 100) : 0;
        
        csvRows.push([
          prog.name,
          positive,
          neutral,
          negative,
          total,
          positivePercent,
          neutralPercent,
          negativePercent
        ]);
      });
      csvRows.push([]); // Empty row for separation
    }
    
    // --- Per-Teacher Breakdown Section ---
    if (teachers.length > 0) {
      csvRows.push(['Per-Teacher Breakdown']);
      csvRows.push(['Teacher', 'Positive', 'Neutral', 'Negative', 'Total']);
      teachers.forEach(teacher => {
        csvRows.push([
          teacher.teacher || teacher.teacher_name || 'Unknown Teacher',
          teacher.positive || 0,
          teacher.neutral || 0,
          teacher.negative || 0,
          teacher.total || 0
        ]);
      });
    }
    
    // Generate filename
    const date = new Date().toISOString().slice(0, 10);
    let filename = `teacher_evaluation_report`;
    if (currentFilters.year !== 'all') {
      filename += `_${currentFilters.year}`;
    }
    if (currentFilters.semester && currentFilters.semester !== 'all') {
      filename += `_sem${currentFilters.semester}`;
    }
    if (currentFilters.year === 'all' && currentFilters.semester === 'all') {
      filename += '_all_time';
    }
    filename += `_${date}.csv`;
    
    // Download CSV
    const csv = arrayToCsv(csvRows);
    downloadCsv(filename, csv);
    
    console.log('Export completed successfully');
    
  } catch (error) {
    console.error('Export failed:', error);
    alert(`Failed to export data: ${error.message}. Please try again.`);
  }
}

// =======================
// ENHANCED Theme Detection
// =======================
function detectDarkMode() {
  const html = document.documentElement;
  const body = document.body;

  if (html.classList.contains('dark') ||
    html.classList.contains('dark-mode') ||
    body.classList.contains('dark') ||
    body.classList.contains('dark-mode')) {
    return true;
  }

  if (html.getAttribute('data-theme') === 'dark' ||
    html.getAttribute('data-bs-theme') === 'dark' ||
    body.getAttribute('data-theme') === 'dark' ||
    body.getAttribute('data-bs-theme') === 'dark') {
    return true;
  }

  const htmlBg = window.getComputedStyle(html).backgroundColor;
  const bodyBg = window.getComputedStyle(body).backgroundColor;

  const isDarkBackground = (bgColor) => {
    if (!bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') return false;
    const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [, r, g, b] = match.map(Number);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5;
    }
    return false;
  };

  return isDarkBackground(bodyBg) || isDarkBackground(htmlBg);
}

// =======================
// Chart Colors
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

    let textColor = tryVars(['--text', '--color-text', '--font-color', '--color', '--body-color']) || csRoot.color;

    const textSample = document.querySelector('.text-font-important-light, .text-font-important-dark, h1, h2, h3, h4, h5, h6, p, span');
    if (textSample) {
      const sampleColor = getComputedStyle(textSample).color;
      if (sampleColor && sampleColor !== 'rgba(0, 0, 0, 0)' && sampleColor !== 'transparent') {
        textColor = sampleColor;
      }
    }

    if (!textColor || textColor === 'rgba(0, 0, 0, 0)' || textColor === 'transparent') {
      textColor = isDark ? '#e5e7eb' : '#374151';
    }

    let gridColor = tryVars(['--border', '--border-color', '--color-border', '--muted', '--divider-color']);
    if (!gridColor || gridColor === 'rgba(0, 0, 0, 0)' || gridColor === 'transparent') {
      gridColor = isDark ? 'rgba(229, 231, 235, 0.2)' : 'rgba(55, 65, 81, 0.1)';
    }

    const axisColor = isDark ? '#d1d5db' : '#374151';
    const legendColor = isDark ? '#f3f4f6' : '#374151';
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
// Theme Change Observer
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
      setTimeout(() => {
        console.log('Theme change detected, updating charts...');
        initializeCharts();
        if (cache.programs && cache.programs.programs) {
          updateChartsWithData(cache.programs.programs);
        }
      }, 100);
    }
  });

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
// Charts Initialization
// =======================
function initializeCharts() {
  console.log('Initializing charts...');

  if (typeof Chart === 'undefined') {
    console.error('Chart.js is not loaded');
    return;
  }

  if (barChart) {
    try { barChart.destroy(); } catch (e) { console.warn('Error destroying bar chart:', e); }
    barChart = null;
  }
  if (pieChart) {
    try { pieChart.destroy(); } catch (e) { console.warn('Error destroying pie chart:', e); }
    pieChart = null;
  }

  const colors = getChartColors();

  try {
    Chart.defaults.color = colors.textColor;
  } catch (e) {
    console.warn('Could not set Chart.js defaults:', e);
  }

  // Initialize Bar Chart
  const barEl = document.getElementById('barChart');
  if (barEl) {
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
                  color: colors.isDarkMode ? 'rgba(229, 231, 235, 0.15)' : 'rgba(55, 65, 81, 0.08)',
                  drawBorder: false,
                  lineWidth: 1,
                  borderDash: [],
                  drawOnChartArea: true,
                  drawTicks: false
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
                  color: 'transparent'
                },
                ticks: {
                  color: colors.axisColor,
                  font: { weight: '600', size: 11 }
                }
              }
            }
          }
        });
        console.log('Bar chart created successfully');
      } catch (e) {
        console.error('Error creating bar chart:', e);
      }
    }
  }

  // Initialize Pie Chart
  const pieEl = document.getElementById('pieChart');
  if (pieEl) {
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
        console.log('Pie chart created successfully');
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

  if (barChart) {
    barChart.data.labels = labels;
    barChart.data.datasets[0].data = positive;
    barChart.data.datasets[1].data = neutral;
    barChart.data.datasets[2].data = negative;
    barChart.update();
  }

  if (pieChart) {
    const totalPositive = positive.reduce((s, v) => s + v, 0);
    const totalNeutral = neutral.reduce((s, v) => s + v, 0);
    const totalNegative = negative.reduce((s, v) => s + v, 0);
    pieChart.data.datasets[0].data = [totalPositive, totalNeutral, totalNegative];
    pieChart.update();
  }
}

// =======================
// Fixed Data Loading Functions
// =======================
async function safeFetch(url, errorMessage = 'Request failed') {
  try {
    console.log(`Fetching: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorText = await response.text();
        errorDetails = errorText ? ` - ${errorText}` : '';
      } catch (e) {
        console.warn('Could not read error response body:', e);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorDetails}`);
    }

    const data = await response.json();
    console.log(`Success fetching ${url}:`, data);
    return data;
  } catch (error) {
    console.error(`${errorMessage} (${url}):`, error);
    throw error;
  }
}

// Fixed filter functionality
function getActiveFilter() {
  const activeYear = document.querySelector('#year-filter .list-group-item.active');
  const activeSemester = document.querySelector('#semester-filter .list-group-item.active');
  
  let year = activeYear ? activeYear.getAttribute('data-value') : 'all';
  let semester = activeSemester ? activeSemester.getAttribute('data-value') : 'all';
  
  return { year, semester };
}

function updateActiveFilter(year, semester) {
  document.querySelectorAll('#year-filter .list-group-item').forEach(f => f.classList.remove('active'));
  document.querySelectorAll('#semester-filter .list-group-item').forEach(f => f.classList.remove('active'));
  
  const yearItem = document.querySelector(`#year-filter .list-group-item[data-value="${year}"]`);
  if (yearItem) {
    yearItem.classList.add('active');
  }
  
  const semesterItem = document.querySelector(`#semester-filter .list-group-item[data-value="${semester}"]`);
  if (semesterItem) {
    semesterItem.classList.add('active');
  }
}

// FIXED: Main data loading function with proper endpoint handling
async function loadYearData(year, semester = null) {
  console.log(`Loading year data: ${year}, semester: ${semester}`);

  currentFilters.year = year;
  currentFilters.semester = semester;

  // Define endpoints with their requirements
  const endpointStrategies = [
    {
      url: '/api/teacher-evaluation-by-semester/',
      requiresYear: true, // This endpoint REQUIRES year parameter
      description: 'Semester-specific endpoint'
    },
    {
      url: '/api/teacher-performance-by-program/',
      requiresYear: false,
      description: 'Program performance endpoint'
    },
    {
      url: '/api/teacher-evaluation-dashboard/',
      requiresYear: false,
      description: 'General dashboard endpoint'
    }
  ];

  let lastError = null;

  for (const strategy of endpointStrategies) {
    try {
      let url = strategy.url;
      const params = [];
      
      // Skip this endpoint if it requires year but we're asking for 'all'
      if (strategy.requiresYear && year === 'all') {
        console.log(`Skipping ${strategy.url} because it requires year parameter but filter is 'all'`);
        continue;
      }
      
      // Add parameters based on endpoint requirements and filter values
      if (year && year !== 'all') {
        params.push(`year=${encodeURIComponent(year)}`);
      }
      if (semester && semester !== 'all') {
        params.push(`semester=${encodeURIComponent(semester)}`);
      }
      
      // For endpoints that require year, use current year if 'all' is selected
      if (strategy.requiresYear && year === 'all') {
        const currentYear = new Date().getFullYear();
        params.push(`year=${currentYear}`);
        console.log(`Using current year ${currentYear} for endpoint that requires year parameter`);
      }
      
      if (params.length > 0) {
        url += '?' + params.join('&');
      }

      console.log(`Trying ${strategy.description}: ${url}`);

      const programsData = await safeFetch(url, `Failed to load from ${strategy.url}`);
      
      let programs = [];
      if (programsData.programs) {
        programs = programsData.programs;
      } else if (Array.isArray(programsData)) {
        programs = programsData;
      } else if (programsData.data && Array.isArray(programsData.data)) {
        programs = programsData.data;
      } else {
        console.warn('Unexpected response format from', strategy.url, programsData);
        
        // Try to extract any array-like data from the response
        const possibleArrays = Object.values(programsData).filter(Array.isArray);
        if (possibleArrays.length > 0) {
          programs = possibleArrays[0];
          console.log('Found array data in response:', programs);
        } else {
          continue;
        }
      }

      // Validate that we have usable program data
      if (!programs.length) {
        console.warn(`No program data found from ${strategy.url}`);
        continue;
      }

      cache.programs = { programs: programs };
      console.log('Successfully loaded from:', strategy.description, programs);

      // Update UI
      let totalPositive = 0, totalNeutral = 0, totalNegative = 0, total = 0;
      programs.forEach(prog => {
        totalPositive += Number(prog.positive || 0);
        totalNeutral += Number(prog.neutral || 0);
        totalNegative += Number(prog.negative || 0);
        total += Number(prog.total || 0);
      });

      updateKPICards(totalPositive, totalNeutral, totalNegative, total);
      updateChartsWithData(programs);
      updateProgramCards(programs);
      updateActiveFilter(year, semester);

      // Load additional data
      await loadTeacherPerformanceData(year, semester);
      await loadRecentEvaluations(year, semester);
      await loadTeacherImprovementPriority(year, semester);
      loadTeacherRecommendations();

      console.log('Year data loading completed successfully');
      return;

    } catch (err) {
      console.warn(`${strategy.description} failed:`, err.message);
      lastError = err;
      continue;
    }
  }

  // If all endpoints failed, try loading basic summary data
  try {
    console.log('All primary endpoints failed, trying dashboard summary...');
    const summaryData = await safeFetch('/api/teacher-evaluation-dashboard/', 'Failed to load dashboard summary');
    
    if (summaryData) {
      console.log('Loaded basic summary data as fallback');
      loadEvaluationData(summaryData);
      
      // Try to load any available programs data
      if (summaryData.programs) {
        cache.programs = { programs: summaryData.programs };
        updateChartsWithData(summaryData.programs);
        updateProgramCards(summaryData.programs);
      }
      
      return;
    }
  } catch (summaryError) {
    console.error('Even summary endpoint failed:', summaryError);
  }

  throw new Error(`All API endpoints failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

function updateTotalCommentsDescription(year, semester) {
  console.log('updateTotalCommentsDescription called with:', { year, semester });
  
  const totalDescEl = document.getElementById('total-description');
  console.log('Found element:', totalDescEl);
  
  if (!totalDescEl) {
    console.error('Element with id "total-description" not found!');
    return;
  }

  let description = '';
  
  if (year === 'all' && (semester === 'all' || !semester)) {
    description = 'All Time';
  } else if (year !== 'all' && (semester === 'all' || !semester)) {
    description = year;
  } else if (year === 'all' && semester !== 'all') {
    const semesterText = semester === '1' ? '1st' : semester === '2' ? '2nd' : `${semester}th`;
    description = `${semesterText} Semester`;
  } else if (year !== 'all' && semester !== 'all') {
    const semesterText = semester === '1' ? '1st' : semester === '2' ? '2nd' : `${semester}th`;
    description = `${year}, ${semesterText} Semester`;
  }
  
  console.log('Setting description to:', description);
  totalDescEl.textContent = description;
} 

function updateKPICards(totalPositive, totalNeutral, totalNegative, total) {
  const positiveCountEl = document.getElementById('positive-count');
  const neutralCountEl = document.getElementById('neutral-count');
  const negativeCountEl = document.getElementById('negative-count');
  const totalCountEl = document.getElementById('total-count');
  
  updateTotalCommentsDescription(currentFilters.year, currentFilters.semester);
  console.log('Called updateTotalCommentsDescription with filters:', currentFilters);
  
  if (positiveCountEl) positiveCountEl.textContent = totalPositive.toLocaleString();
  if (neutralCountEl) neutralCountEl.textContent = totalNeutral.toLocaleString();
  if (negativeCountEl) negativeCountEl.textContent = totalNegative.toLocaleString();
  if (totalCountEl) totalCountEl.textContent = total.toLocaleString();

  const positivePercent = total > 0 ? Math.round((totalPositive / total) * 100) : 0;
  const neutralPercent = total > 0 ? Math.round((totalNeutral / total) * 100) : 0;
  const negativePercent = total > 0 ? Math.round((totalNegative / total) * 100) : 0;

  const positivePercentEl = document.getElementById('positive-percent');
  const neutralPercentEl = document.getElementById('neutral-percent');
  const negativePercentEl = document.getElementById('negative-percent');
  
  if (positivePercentEl) positivePercentEl.textContent = `${positivePercent}% of the evaluations`;
  if (neutralPercentEl) neutralPercentEl.textContent = `${neutralPercent}% of the evaluations`;
  if (negativePercentEl) negativePercentEl.textContent = `${negativePercent}% of the evaluations`;

  const piePositiveEl = document.getElementById('pie-positive-percent');
  const pieNeutralEl = document.getElementById('pie-neutral-percent');
  const pieNegativeEl = document.getElementById('pie-negative-percent');
  
  if (piePositiveEl) piePositiveEl.textContent = positivePercent;
  if (pieNeutralEl) pieNeutralEl.textContent = neutralPercent;
  if (pieNegativeEl) pieNegativeEl.textContent = negativePercent;
}

function updateProgramCards(programs) {
  programs.forEach(prog => {
    const key = (prog.name || '').toLowerCase();
    const P = Number(prog.positive || 0);
    const U = Number(prog.neutral || 0);
    const N = Number(prog.negative || 0);
    const T = P + U + N;
    const rating = T ? Math.round((P / T) * 100) : 0;

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
  });
}

async function loadTeacherPerformanceData(year = 'all', semester = null) {
  let url = '/api/teacher-performance-by-teacher/';
  const params = [];
  
  if (year && year !== 'all') {
    params.push(`year=${encodeURIComponent(year)}`);
  }
  if (semester && semester !== 'all') {
    params.push(`semester=${encodeURIComponent(semester)}`);
  }
  
  if (params.length > 0) {
    url += '?' + params.join('&');
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

function loadRecentEvaluations(year = 'all', semester = null) {
  let url = '/api/recent-teacher-evaluations/';
  const params = [];
  
  if (year && year !== 'all') {
    params.push(`year=${encodeURIComponent(year)}`);
  }
  if (semester && semester !== 'all') {
    params.push(`semester=${encodeURIComponent(semester)}`);
  }
  
  if (params.length > 0) {
    url += '?' + params.join('&');
  }

  safeFetch(url, 'Failed to load recent evaluations')
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
              <span class="text-muted">${Number(item.percent_negative || 0)}% of negative evaluations</span>
            </div>
            <span class="badge ${badgeClass}">${item.priority || ''}</span>
          </li>
        `);
      });
    })
    .catch(error => console.error('Teacher improvement priority failed:', error));
}

function loadEvaluationData(data) {
  cache.summary = data;

  document.getElementById('positive-count').textContent = Number(data.positive || 0).toLocaleString();
  document.getElementById('neutral-count').textContent = Number(data.neutral || 0).toLocaleString();
  document.getElementById('negative-count').textContent = Number(data.negative || 0).toLocaleString();
  document.getElementById('total-count').textContent = Number(data.total || 0).toLocaleString();

  document.getElementById('positive-percent').textContent = `${data.positive_percent || 0}% of total evaluations`;
  document.getElementById('neutral-percent').textContent = `${data.neutral_percent || 0}% of total evaluations`;
  document.getElementById('negative-percent').textContent = `${data.negative_percent || 0}% of total evaluations`;

  document.getElementById('pie-positive-percent').textContent = data.positive_percent || 0;
  document.getElementById('pie-neutral-percent').textContent = data.neutral_percent || 0;
  document.getElementById('pie-negative-percent').textContent = data.negative_percent || 0;

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
      <div class="p-3 rounded-default border-start mb-3" style="border-left: 8px solid ${borderColor}; background: ${backgroundColor};">
        <strong style="color: ${borderColor};">${label}:</strong>
        ${text}
      </div>
    `);
  };

  const mostNegTeacher = pickMostByShare(teachers, 'negative');
  const mostNeuTeacher = pickMostByShare(teachers, 'neutral');
  const mostPosTeacher = pickMostByShare(teachers, 'positive');
  const mostNegProgram = pickMostByShare(programs, 'negative');

  if (mostNegTeacher) {
    const tLabel = `${mostNegTeacher.teacher || 'Teacher'}${mostNegTeacher.program ? `, ${mostNegTeacher.program}` : ''}`;
    const percent = Math.round(mostNegTeacher.share);
    addItem('is-urgent', 'Urgent', `Professor, ${tLabel} has received the most negative feedback, with ${percent}% of evaluations marked as negative. Immediate action is recommended to address concerns.`);
  }

  if (mostNeuTeacher) {
    const tLabel = `${mostNeuTeacher.teacher || 'Teacher'}${mostNeuTeacher.program ? `, ${mostNeuTeacher.program}` : ''}`;
    const percent = Math.round(mostNeuTeacher.share);
    addItem('is-review', 'Review', `Professor, ${tLabel} stands out with the highest neutral feedback at ${percent}%. This suggests a need to review and provide guidance to move evaluations toward more positive outcomes.`);
  }

  if (mostPosTeacher) {
    const tLabel = `${mostPosTeacher.teacher || 'Teacher'}${mostPosTeacher.program ? `, ${mostPosTeacher.program}` : ''}`;
    const percent = Math.round(mostPosTeacher.share);
    addItem('is-recognize', 'Recognize', `Professor, ${tLabel} has received the most positive evaluations, with ${percent}% marked as positive. Recognition and encouragement are recommended to reinforce this performance.`);
  }

  if (mostNegProgram) {
    const pLabel = mostNegProgram.name || mostNegProgram.program || 'Program';
    const percent = Math.round(mostNegProgram.share);
    addItem('is-support', 'Support', `The ${pLabel} Department, received the highest negative evaluations, with ${percent}% of evaluations classified as negative. Support and Development initiatives are advised.`);
  }

  if (!wrap.children.length) {
    wrap.innerHTML = `<div class="text-muted">Insufficient data for recommendations</div>`;
  }
}

// Fixed Filter Drawer Implementation
function initializeFilterDrawer() {
  document.addEventListener('DOMContentLoaded', function () {
    const filterBtn = document.getElementById('filter-btn');
    const filterDrawer = document.getElementById('filter-drawer');
    const yearFilter = document.getElementById('year-filter');
    const semesterFilter = document.getElementById('semester-filter');
    const applyFiltersBtn = document.getElementById('apply-filters');

    function showDrawer() {
      filterDrawer.style.display = 'block';
      filterDrawer.style.right = '0';
    }

    function hideDrawer() {
      filterDrawer.style.right = '-400px';
      setTimeout(() => {
        filterDrawer.style.display = 'none';
      }, 300);
    }

    if (filterBtn) {
      filterBtn.addEventListener('click', function () {
        showDrawer();
      });
    }

    const closeBtn = filterDrawer?.querySelector('.btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        hideDrawer();
      });
    }

    if (yearFilter) {
      yearFilter.addEventListener('click', function (e) {
        if (e.target.classList.contains('list-group-item')) {
          yearFilter.querySelectorAll('.list-group-item').forEach(item => {
            item.classList.remove('active');
          });
          e.target.classList.add('active');
        }
      });
    }

    if (semesterFilter) {
      semesterFilter.addEventListener('click', function (e) {
        if (e.target.classList.contains('list-group-item')) {
          semesterFilter.querySelectorAll('.list-group-item').forEach(item => {
            item.classList.remove('active');
          });
          e.target.classList.add('active');
        }
      });
    }

    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener('click', async function () {
        const selectedYear = yearFilter.querySelector('.list-group-item.active')?.getAttribute('data-value') || 'all';
        const selectedSemester = semesterFilter.querySelector('.list-group-item.active')?.getAttribute('data-value') || 'all';

        console.log('Applying filters - Year:', selectedYear, 'Semester:', selectedSemester);

        hideDrawer();

        try {
          const cleanSemester = selectedSemester === 'all' ? null : selectedSemester;
          await loadYearData(selectedYear, cleanSemester);
        } catch (error) {
          console.error('Filter application failed:', error);
          alert(`Failed to apply filters: ${error.message}. Please check the console for details.`);
        }
      });
    }
  });
}

function initializeEventHandlers() {
  document.querySelectorAll('.export-teacher-report, #export-teacher-report-btn, #export-report-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Export clicked with current filters:', currentFilters);
      await exportFilteredData();
    });
  });
}

// Initialize everything
window.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, starting initialization...');

  observeThemeChanges();
  initializeFilterDrawer();

  setTimeout(async () => {
    try {
      initializeCharts();
      initializeEventHandlers();

      console.log('Loading initial dashboard data...');

      // Try to load summary data first
      try {
        const summaryData = await safeFetch('/api/teacher-evaluation-dashboard/', 'Failed to load dashboard summary');
        loadEvaluationData(summaryData);
      } catch (summaryError) {
        console.warn('Could not load summary data:', summaryError.message);
      }

      // Load year data with fallback handling
      await loadYearData('all');

      console.log('Dashboard initialization completed');

    } catch (error) {
      console.error('Dashboard initialization failed:', error);
      
      // Show user-friendly error message
      const errorMessage = error.message.includes('HTTP 400') && error.message.includes('Missing required parameter') 
        ? 'The dashboard is having trouble loading data. This might be because the API requires specific parameters. Please try selecting a specific year or contact your system administrator.'
        : 'Failed to load dashboard. Please refresh the page or contact support if the problem persists.';
        
      alert(errorMessage);
    }
  }, 100);
});



// Make functions globally accessible
window.loadYearData = loadYearData;
window.exportFilteredData = exportFilteredData;