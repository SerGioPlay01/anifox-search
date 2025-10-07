document.addEventListener("DOMContentLoaded", function () {
  const themeButtons = document.querySelectorAll(".theme-btn");
  const themeStyle = document.getElementById("theme-style");
  const body = document.body;

  // Функция для определения системных предпочтений
  function getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  // Функция для применения темы
  function applyTheme(theme) {
    // Удаляем предыдущие классы темы
    body.removeAttribute("data-theme");

    // Устанавливаем активную кнопку
    themeButtons.forEach((btn) => {
      btn.classList.remove("active");
      if (btn.getAttribute("data-theme") === theme) {
        btn.classList.add("active");
      }
    });

    // Применяем выбранную тему
    if (theme === "auto") {
      const systemTheme = getSystemTheme();
      body.setAttribute("data-theme", systemTheme);
      // Подключаем соответствующий CSS файл
      themeStyle.href =
        systemTheme === "dark" ? "style.css" : "light-theme.css";
    } else {
      body.setAttribute("data-theme", theme);
      // Подключаем соответствующий CSS файл
      themeStyle.href = theme === "dark" ? "style.css" : "light-theme.css";
    }

    // Сохраняем выбор в localStorage
    localStorage.setItem("theme", theme);
  }

  // Обработчики для кнопок переключения темы
  themeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const theme = this.getAttribute("data-theme");
      applyTheme(theme);
    });
  });

  // Слушатель изменений системной темы
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", function (e) {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "auto") {
        applyTheme("auto");
      }
    });

  // Инициализация темы при загрузке
  function initTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      applyTheme(savedTheme);
    } else {
      // Если нет сохраненной темы, используем автоопределение
      applyTheme("auto");
    }
  }

  // Запускаем инициализацию
  initTheme();
});
