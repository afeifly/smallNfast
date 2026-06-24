import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import iconBtnClose from '../assets/images/icon_btn_close.png';
import CustomDialog from './CustomDialog';
import { useLanguage } from '../context/LanguageContext';
import '../pages/Graphic.css';

const ChannelSelectModal = ({
  isOpen,
  onClose,
  onSettingClick,
  onConfirm,
  allChannels = [],
  initialSelectedIds = [],
  blockedSelectedIds = [], // Added prop
  maxLimit = 5,
  selectionMessage = 'You can only select up to 5 channels.',
  showOperate = true,
  title = 'Channel configuration'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isLimitAlertOpen, setIsLimitAlertOpen] = useState(false);
  const { t } = useLanguage();

  // Initialize selection from prop
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelectedIds);
    }
  }, [isOpen, initialSelectedIds]);

  if (!isOpen) return null;

  const filteredChannels = allChannels.filter(ch =>
    (ch?.sensorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ch?.channelName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ch?.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ch?.point || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelection = (id) => {
    if (blockedSelectedIds.includes(id)) return; // Ignore toggling if channel is blocked

    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        // Only enforce limit if maxLimit is a positive number
        if (typeof maxLimit === 'number' && maxLimit > 0 && prev.length >= maxLimit) {
          setIsLimitAlertOpen(true);
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  // Determine selectable (unblocked) visible channels
  const unblockedVisibleChannels = filteredChannels.filter(ch => !blockedSelectedIds.includes(ch.CreateTime));
  const unblockedVisibleIds = unblockedVisibleChannels.map(ch => ch.CreateTime);

  // Checked if all unblocked visible channels are selected
  const isAllVisibleSelected = unblockedVisibleIds.length > 0 &&
    unblockedVisibleIds.every(id => selectedIds.includes(id));

  const handleSelectAll = () => {
    if (isAllVisibleSelected) {
      // Unselect all unblocked visible
      setSelectedIds(prev => prev.filter(id => !unblockedVisibleIds.includes(id)));
    } else {
      // Select all unblocked visible (respecting limit if any)
      setSelectedIds(prev => {
        const combined = [...new Set([...prev, ...unblockedVisibleIds])];
        if (typeof maxLimit === 'number' && maxLimit > 0) {
          return combined.slice(0, maxLimit);
        }
        return combined;
      });
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm(selectedIds);
    }
  };

  const resolvedTitle = title === 'Channel configuration' 
    ? t({ en: 'Channel configuration', de: 'Kanalkonfiguration', cn: '通道配置' })
    : title;

  const resolvedMessage = selectionMessage === 'You can only select up to 5 channels.'
    ? t({ en: 'You can only select up to 5 channels.', de: 'Sie können nur bis zu 5 Kanäle auswählen.', cn: '您最多只能选择 5 个通道。' })
    : selectionMessage;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-header-content">
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{resolvedTitle}</h3>
            <div className="search-input-wrapper" style={{ width: '320px' }}>
              <input
                type="text"
                placeholder={t({ en: 'please search sensor name', de: 'Bitte Sensorname suchen', cn: '请输入传感器名称搜索' })}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="search-icon" style={{ right: '10px', left: 'auto' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
            </div>
          </div>
          <div className="modal-close-btn" onClick={onClose}>
            <img src={iconBtnClose} alt={t({ en: 'Close', de: 'Schließen', cn: '关闭' })} style={{ width: 32, height: 32 }} />
          </div>
        </header>

        <div className="modal-content-area">
          <table className="channel-table">
            <thead>
              <tr>
                <th style={{ width: '54px', textAlign: 'center' }}>
                  <div
                    className={`custom-checkbox ${isAllVisibleSelected ? 'checked' : ''}`}
                    style={{ margin: '0 auto', cursor: 'pointer' }}
                    onClick={handleSelectAll}
                  ></div>
                </th>
                <th>{t({ en: 'Sensor', de: 'Sensor', cn: '传感器' })}</th>
                <th>{t({ en: 'Channel', de: 'Kanal', cn: '通道' })}</th>
                <th>{t({ en: 'Unit', de: 'Einheit', cn: '单位' })}</th>
                <th>{t({ en: 'Location', de: 'Standort', cn: '位置' })}</th>
                <th>{t({ en: 'Point', de: 'Messpunkt', cn: '测量点' })}</th>
                {showOperate && <th>{t({ en: 'Operate', de: 'Aktion', cn: '操作' })}</th>}
              </tr>
            </thead>
            <tbody>
              {filteredChannels.length > 0 ? (
                filteredChannels.map(ch => {
                  const isBlocked = blockedSelectedIds.includes(ch.CreateTime);
                  const isSelected = selectedIds.includes(ch.CreateTime) || isBlocked;
                  return (
                    <tr 
                      key={ch.CreateTime} 
                      onClick={() => toggleSelection(ch.CreateTime)} 
                      style={isBlocked ? { opacity: 0.6, cursor: 'not-allowed', backgroundColor: '#F8F9FA' } : { cursor: 'pointer' }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <div
                          className={`custom-checkbox ${isSelected ? 'checked' : ''} ${isBlocked ? 'disabled' : ''}`}
                          style={isBlocked ? {
                            margin: '0 auto',
                            background: '#CCCCCC',
                            borderColor: '#CCCCCC',
                            cursor: 'not-allowed'
                          } : { margin: '0 auto', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelection(ch.CreateTime);
                          }}
                        ></div>
                      </td>
                      <td>{ch.sensorName}</td>
                      <td>{ch.channelName}</td>
                      <td>{ch.unit}</td>
                      <td>{ch.location}</td>
                      <td>{ch.point}</td>
                      {showOperate && (
                        <td>
                          {!isBlocked && (
                            <span
                              style={{ color: '#00AB84', cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSettingClick) onSettingClick(ch);
                              }}
                            >
                              {t({ en: 'Setting', de: 'Einstellung', cn: '设置' })}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                    {t({ en: 'No channels found matching search', de: 'Keine passenden Kanäle gefunden', cn: '未找到匹配的通道' })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="modal-footer">
          <button className="btn-drawer-confirm" style={{ width: '120px' }} onClick={handleConfirm}>{t({ en: 'Confirm', de: 'Bestätigen', cn: '确认' })}</button>
          <button className="btn-drawer-cancel" style={{ width: '120px' }} onClick={onClose}>{t({ en: 'Cancel', de: 'Abbrechen', cn: '取消' })}</button>
        </footer>
      </div>

      <CustomDialog
        isOpen={isLimitAlertOpen}
        onClose={() => setIsLimitAlertOpen(false)}
        onConfirm={() => setIsLimitAlertOpen(false)}
        title={t({ en: 'Selection Limit', de: 'Auswahllimit', cn: '选择限制' })}
        body={resolvedMessage}
        type="warn"
        showCancel={false}
      />
    </div>
  );
};


ChannelSelectModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSettingClick: PropTypes.func,
  onConfirm: PropTypes.func,
  allChannels: PropTypes.array,
  initialSelectedIds: PropTypes.array,
  blockedSelectedIds: PropTypes.array,
  maxLimit: PropTypes.number,
  selectionMessage: PropTypes.string,
  showOperate: PropTypes.bool,
  title: PropTypes.string
};

export default ChannelSelectModal;
