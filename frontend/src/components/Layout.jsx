import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Study', end: true },
  { to: '/cards', label: 'Cards' },
  { to: '/resources', label: 'Resources' },
  { to: '/fields', label: 'Knowledge Fields' },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Mimisbrunnr</h1>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
