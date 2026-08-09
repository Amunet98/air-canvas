import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

// Icon-only light/dark toggle. Dark is the default look; light is opt-in and
// persisted to localStorage so it survives reloads. A pre-paint script in
// index.html applies the stored choice before first paint to avoid a flash.
const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // localStorage unavailable (private mode etc.) - theme just won't persist
    }
    setIsDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="inline-flex items-center justify-center w-11 h-11 rounded-full text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors cursor-pointer"
    >
      {/* Sun when dark (click goes to light) and moon when light. Both come
          from lucide so the stroke weight matches every other icon in the app;
          these paths used to be hand-copied inline. */}
      {isDark ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
    </button>
  );
};

export default ThemeToggle;
