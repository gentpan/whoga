import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const nextTheme = getInitialTheme();
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  function handleToggle(checked: boolean): void {
    const nextTheme: Theme = checked ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("theme", nextTheme);
  }

  return (
    <label className="ui-switch" aria-label="切换主题">
      <input
        id="theme-toggle"
        name="theme-toggle"
        type="checkbox"
        checked={theme === "dark"}
        onChange={(event) => handleToggle(event.target.checked)}
      />
      <div className="slider">
        <div className="circle" />
      </div>
    </label>
  );
}
