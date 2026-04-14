import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import Sidebar, { NAV } from './Sidebar';

// ── Layout ──────────────────────────────────────────────────────────────────
const Layout = ({ children }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  // Generate breadcrumbs with labels from NAV
  const getBreadcrumbs = () => {
    if (currentPath === '/') return [];
    
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [];
    let pathAcc = '';

    parts.forEach((part, index) => {
      pathAcc += `/${part}`;
      
      // Look for label in NAV
      let foundLabel = part;
      
      // Search top level
      const topMatch = NAV.find(item => item.to === pathAcc || item.key === part);
      if (topMatch) {
        foundLabel = topMatch.label;
      } else {
        // Search children
        NAV.forEach(parent => {
          if (parent.children) {
            const childMatch = parent.children.find(c => c.to === pathAcc);
            if (childMatch) {
              foundLabel = childMatch.label;
            }
          }
        });
      }
      
      crumbs.push({
        label: foundLabel,
        to: pathAcc,
        active: index === parts.length - 1
      });
    });

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="app-container">
      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Main ── */}
      <main className="main-wrapper">
        <header className="top-bar">
          <div className="breadcrumb-nav">
            <Link to="/" className="breadcrumb-item">Home</Link>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                <span className="breadcrumb-separator">/</span>
                <span className={`breadcrumb-item ${crumb.active ? 'active' : ''}`}>
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </div>
          <div className="top-bar-right">
            <div className="user-profile">
              <img src="/images/user_icon.png" alt="Admin" className="user-avatar" />
              <div className="user-info">
                <span className="user-name">suto Admin</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.9)" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
            </div>
            <div className="topbar-icon-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>
        </header>

        <section className="content-area">
          {children}
        </section>
      </main>
    </div>
  );
};

export default Layout;
