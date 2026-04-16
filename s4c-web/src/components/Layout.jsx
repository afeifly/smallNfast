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
