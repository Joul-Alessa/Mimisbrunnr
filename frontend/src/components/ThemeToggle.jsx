import { useTheme } from '../hooks/useTheme';

const ORDER = ['system', 'light', 'dark'];
const LABELS = { system: '🖥️ System', light: '☀️ Light', dark: '🌙 Dark' };

export default function ThemeToggle() {
  const [theme, setTheme] = useTheme();

  function cycle() {
    setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]);
  }

  return (
    <button type="button" className="theme-toggle" onClick={cycle} title="Click to change theme">
      {LABELS[theme]}
    </button>
  );
}
