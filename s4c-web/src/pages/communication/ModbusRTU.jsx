import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import ModbusRTUMaster from './ModbusRTUMaster';
import ModbusRTUSlave from './ModbusRTUSlave';
import './ModbusRTU.css';

const tabs = [
  { id: 'master', label: 'Modbus RTU Master' },
  { id: 'slave', label: 'Modbus RTU Slave' },
];

const ModbusRTU = () => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'slave' ? 'slave' : 'master';

  const selectTab = (tab) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('tab', tab);
      return next;
    });
  };

  const handleKeyDown = (event) => {
    let nextTab;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      nextTab = activeTab === 'master' ? 'slave' : 'master';
    } else if (event.key === 'Home') {
      nextTab = 'master';
    } else if (event.key === 'End') {
      nextTab = 'slave';
    } else {
      return;
    }

    event.preventDefault();
    selectTab(nextTab);
    event.currentTarget.parentElement.querySelector(`#modbus-rtu-tab-${nextTab}`).focus();
  };

  return (
    <div className="content-card modbus-rtu-page">
      <header className="modbus-header">
        <div className="modbus-rtu-tabs" role="tablist" aria-label={t('Modbus RTU')}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              id={`modbus-rtu-tab-${tab.id}`}
              type="button"
              role="tab"
              className="modbus-rtu-tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`modbus-rtu-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={handleKeyDown}
            >
              {t(tab.label)}
            </button>
          ))}
        </div>
      </header>
      {tabs.map(tab => (
        <div
          key={tab.id}
          id={`modbus-rtu-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`modbus-rtu-tab-${tab.id}`}
          className="modbus-rtu-panel"
          hidden={activeTab !== tab.id}
          tabIndex={0}
        >
          {activeTab === tab.id && (tab.id === 'master' ? <ModbusRTUMaster /> : <ModbusRTUSlave />)}
        </div>
      ))}
    </div>
  );
};

export default ModbusRTU;
