import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/', label: '🏠 Home', end: true },
  { to: '/groups', label: '💬 Conversas' },
];

export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard-shell">
      <aside className="sidebar-nav">
        <div className="sidebar-brand">Secure Chat</div>
        <nav>
          <ul>
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} end={link.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="workspace">
        <div className="workspace-inner">{children}</div>
      </div>
    </div>
  );
}

DashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
};
