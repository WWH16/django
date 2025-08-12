document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('themeToggle');
  const body = document.body;

  // --- Helper: Update toggle icon ---
  function updateThemeIcon() {
    if (body.classList.contains('dark-mode')) {
      toggleBtn.innerHTML = '<i class="bi bi-moon-fill fs-5"></i>';
    } else {
      toggleBtn.innerHTML = '<i class="bi bi-sun-fill fs-5"></i>';
    }
  }

  // --- Helper: Apply theme class ---
  function applyTheme(theme) {
    body.classList.remove('light-mode', 'dark-mode');
    body.classList.add(theme);
    updateThemeIcon();
  }

  // --- Theme Toggle Button Click ---
  toggleBtn.addEventListener('click', () => {
    const currentTheme = body.classList.contains('dark-mode') ? 'dark-mode' : 'light-mode';
    const newTheme = currentTheme === 'dark-mode' ? 'light-mode' : 'dark-mode';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme); // Persist the choice
  });

  // --- Set initial theme on page load ---
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    applyTheme('light-mode'); // Default to light mode
  }
});
