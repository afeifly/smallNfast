import React from 'react';
import './DownloadAppModal.css';
import { checkIsWeb } from '../util/platform';
import intl from 'react-intl-universal';

export default function DownloadAppModal({ isOpen, onClose, version = '0.1.0' }) {
  if (!isOpen) return null;

  const isWebMode = checkIsWeb();
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
  const isCurrentMac = /Macintosh|Mac OS X/i.test(ua);
  const isCurrentWin = /Windows/i.test(ua);
  const isCurrentAndroid = /Android/i.test(ua);

  const platforms = [
    {
      id: 'windows',
      name: 'Windows',
      tag: intl.get('DL_WIN_TAG') || 'x64 Desktop',
      file: 's4a_window.zip',
      href: '/s4a_window.zip',
      desc: intl.get('DL_WIN_DESC') || 'Native Direct USB driver, Ethernet TCP monitoring, full offline CSD & CSV analysis.',
      meta: `Windows 10 / 11 • v${version}`,
      isCurrent: isCurrentWin,
      icon: (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.401H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
        </svg>
      ),
      accentColor: '#0078d4'
    },
    {
      id: 'macos',
      name: 'macOS',
      tag: intl.get('DL_MAC_TAG') || 'Apple Silicon & Intel',
      file: 's4a_mac.zip',
      href: '/s4a_mac.zip',
      desc: intl.get('DL_MAC_DESC') || 'Native IOKit direct USB, Bluetooth Low Energy, standalone DMG installer.',
      meta: `macOS 12+ • v${version}`,
      isCurrent: isCurrentMac,
      icon: (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.77 1.04-1.85.93-2.92-.9.04-2 .6-2.65 1.37-.56.66-1.06 1.74-.93 2.8 1.01.08 2.03-.49 2.65-1.25z" />
        </svg>
      ),
      accentColor: '#0f172a'
    },
    {
      id: 'android',
      name: 'Android',
      tag: intl.get('DL_ANDROID_TAG') || 'ARM64 Mobile APK',
      file: 's4a_android.zip',
      href: '/s4a_android.zip',
      desc: intl.get('DL_ANDROID_DESC') || 'USB-C OTG cable hardware host, Bluetooth LE sensor scanning, field monitoring.',
      meta: `Android 8.0+ • v${version}`,
      isCurrent: isCurrentAndroid,
      icon: (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
          <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-1s.4482-1 .9993-1c.5511 0 .9993.4486.9993 1s-.4482 1-.9993 1m-11.046 0c-.5511 0-.9993-.4486-.9993-1s.4482-1 .9993-1c.5511 0 .9993.4486.9993 1s-.4482 1-.9993 1m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4116 13.8533 8 12 8s-3.5902.4116-5.1367.9507L4.841 5.4477a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
        </svg>
      ),
      accentColor: '#10b981'
    }
  ];

  const lblSupported = intl.get('DL_STATUS_SUPPORTED') || 'Supported';
  const lblUnsupported = intl.get('DL_STATUS_UNSUPPORTED') || 'Unsupported';
  const lblDirectUsb = intl.get('DIRECT_USB') || 'Direct USB';
  const lblWebBle = intl.get('DL_STATUS_WEB_BLE') || 'Web BLE';
  const lblUsbOtg = intl.get('DL_STATUS_USB_OTG') || 'USB OTG';

  const commMatrix = [
    {
      platform: 'Web',
      badge: '🌐',
      usb: { supported: false, label: lblUnsupported },
      ble: { supported: true, label: lblWebBle },
      tcp: { supported: false, label: lblUnsupported },
      file: { supported: true, label: lblSupported },
      api: { supported: false, label: lblUnsupported },
    },
    {
      platform: 'Android',
      badge: '🤖',
      usb: { supported: true, label: lblUsbOtg },
      ble: { supported: true, label: lblSupported },
      tcp: { supported: true, label: lblSupported },
      file: { supported: true, label: lblSupported },
      api: { supported: true, label: lblSupported },
    },
    {
      platform: 'Win (Windows)',
      badge: '🪟',
      usb: { supported: true, label: lblDirectUsb },
      ble: { supported: true, label: lblSupported },
      tcp: { supported: true, label: lblSupported },
      file: { supported: true, label: lblSupported },
      api: { supported: true, label: lblSupported },
    },
    {
      platform: 'macOS',
      badge: '🍎',
      usb: { supported: true, label: lblDirectUsb },
      ble: { supported: true, label: lblSupported },
      tcp: { supported: true, label: lblSupported },
      file: { supported: true, label: lblSupported },
      api: { supported: true, label: lblSupported },
    },
    {
      platform: 'iOS',
      badge: '📱',
      usb: { supported: false, label: lblUnsupported },
      ble: { supported: true, label: lblSupported },
      tcp: { supported: true, label: lblSupported },
      file: { supported: true, label: lblSupported },
      api: { supported: true, label: lblSupported },
    },
  ];

  const renderStatusCell = (status) => {
    if (status.supported) {
      return (
        <span className="matrix-status-badge status-supported">
          <span className="status-dot-check">✓</span>
          <span>{status.label}</span>
        </span>
      );
    }
    return (
      <span className="matrix-status-badge status-unsupported">
        <span className="status-dot-cross">✕</span>
        <span>{status.label}</span>
      </span>
    );
  };

  const modalTitle = isWebMode
    ? (intl.get('TRY_APP') || 'Download S4A for Your Device')
    : (intl.get('ABOUT_S4A') || 'About S4A');

  return (
    <div className="download-modal-overlay" onClick={onClose}>
      <div className="download-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="download-modal-header">
          <div className="download-modal-title-box">
            <div className="download-modal-badge">
              {intl.get('ECOSYSTEM_TITLE') || 'Multi-Platform Ecosystem'} • v{version}
            </div>
            <h3>{modalTitle}</h3>
            <p>
              {isWebMode
                ? (intl.get('DL_WEB_SUBTITLE') || 'Select your operating system package or check communication compatibility below.')
                : (intl.get('DL_NATIVE_SUBTITLE', { version }) || `S4A - Smart Software for Automation (v${version}) • SUTO iTEC`)}
            </p>
          </div>
          <button className="download-modal-close" onClick={onClose} aria-label={intl.get('CLOSE') || 'Close dialog'}>
            ✕
          </button>
        </div>

        <div className="download-modal-scroll-area">
          {/* Platform Cards Grid */}
          <div className="download-platform-grid">
            {platforms.map((p) => (
              <div key={p.id} className={`download-platform-card ${(!isWebMode && p.isCurrent) ? 'is-active-platform' : ''}`}>
                <div className="platform-card-header">
                  <div className="platform-icon-wrap" style={{ color: p.accentColor }}>
                    {p.icon}
                  </div>
                  <div>
                    <h4 className="platform-name">{p.name}</h4>
                    <span className="platform-tag">{p.tag}</span>
                  </div>
                </div>

                <p className="platform-desc">{p.desc}</p>
                <div className="platform-meta">{p.meta}</div>

                {/* If in Web mode: show real download button.
                    If not in Web mode (desktop / native): do not real download, show platform status */}
                {isWebMode ? (
                  <a
                    href={p.href}
                    download={p.file}
                    className="platform-download-btn"
                    title={intl.get('DL_DOWNLOAD_FILE', { file: p.file }) || `Download ${p.file}`}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>{p.file}</span>
                  </a>
                ) : (
                  p.isCurrent ? (
                    <div className="platform-installed-badge" title={intl.get('DL_CURRENT_RUNNING_APP') || 'Current active running application'}>
                      <span className="platform-check-icon">✓</span>
                      <span>{intl.get('CURRENT_PLATFORM') || 'Active Platform (Installed)'}</span>
                    </div>
                  ) : (
                    <div className="platform-spec-badge">
                      <span>{intl.get('DL_DESKTOP_CLIENT', { name: p.name }) || `${p.name} Desktop Client`}</span>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>

          {/* Communication Differences Matrix Table */}
          <div className="download-matrix-section">
            <div className="matrix-title-row">
              <h4>{intl.get('COMM_MATRIX_TITLE') || 'Communication & Hardware Compatibility'}</h4>
              <span className="matrix-subtitle">
                {intl.get('PLATFORM_DIFF_SUBTITLE') || 'Feature availability comparison across platforms'}
              </span>
            </div>

            <div className="download-matrix-table-wrap">
              <table className="download-matrix-table">
                <thead>
                  <tr>
                    <th className="th-platform">{intl.get('DL_TH_PLATFORM') || 'Platform'}</th>
                    <th>{intl.get('DL_TH_USB') || 'USB'}</th>
                    <th>{intl.get('DL_TH_BLE') || 'BLE'}</th>
                    <th>{intl.get('DL_TH_ETHERNET') || 'Ethernet'}</th>
                    <th>{intl.get('DL_TH_LOCAL_FILE') || 'Local File'}</th>
                    <th>{intl.get('DL_TH_S332_API') || 'S332 API'}</th>
                  </tr>
                </thead>
                <tbody>
                  {commMatrix.map((row) => (
                    <tr key={row.platform}>
                      <td className="td-platform">
                        <span className="platform-cell-badge">{row.badge}</span>
                        <span className="platform-cell-name">{row.platform}</span>
                      </td>
                      <td>{renderStatusCell(row.usb)}</td>
                      <td>{renderStatusCell(row.ble)}</td>
                      <td>{renderStatusCell(row.tcp)}</td>
                      <td>{renderStatusCell(row.file)}</td>
                      <td>{renderStatusCell(row.api)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="download-modal-footer">
          <div className="download-footer-note">
            💡 S4A <strong>v{version}</strong> • {isWebMode ? (intl.get('DL_FOOTER_WEB') || 'Standalone desktop & mobile packages provide native hardware access.') : (intl.get('DL_FOOTER_NATIVE') || 'Native Direct hardware I/O & ProcessScape engine active.')}
          </div>
          <button className="download-footer-close-btn" onClick={onClose}>
            {intl.get('CLOSE') || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
