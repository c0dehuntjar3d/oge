import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Главная', end: true },
  { to: '/practice', label: 'Тренажер' },
  { to: '/variant', label: 'Полный вариант' }
];

export default function TopNav() {
  return (
    <header className="top-nav-wrap">
      <div className="bg-shape bg-shape-left" />
      <div className="bg-shape bg-shape-right" />
      <div className="top-nav container">
        <div className="brand">
          <span className="brand-dot" />
          <div>
            <p className="brand-title">ОГЭ Информатика</p>
            <p className="brand-subtitle">Тренажер + проверка</p>
          </div>
        </div>

        <nav className="nav-links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
