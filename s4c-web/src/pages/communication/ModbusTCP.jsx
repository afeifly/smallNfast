import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import ModbusTCPMaster from './ModbusTCPMaster';
import ModbusTCPSlave from './ModbusTCPSlave';
import './ModbusTCP.css';

const tabs = [
  { id: 'master', label: 'Modbus/TCP Master' },
  { id: 'slave', label: 'Modbus/TCP Slave' },
];

const ModbusTCP = () => {
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
    event.currentTarget.parentElement.querySelector(`#modbus-tcp-tab-${nextTab}`).focus();
  };

  return (
    <div className="content-card modbus-tcp-page">
      <header className="modbus-header">
        <div className="modbus-tcp-tabs" role="tablist" aria-label={t('Modbus TCP')}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              id={`modbus-tcp-tab-${tab.id}`}
              type="button"
              role="tab"
              className="modbus-tcp-tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`modbus-tcp-panel-${tab.id}`}
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
          id={`modbus-tcp-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`modbus-tcp-tab-${tab.id}`}
          className="modbus-tcp-panel"
          hidden={activeTab !== tab.id}
          tabIndex={0}
        >
          {activeTab === tab.id && (tab.id === 'master' ? <ModbusTCPMaster /> : <ModbusTCPSlave />)}
        </div>
      ))}
    </div>
  );
};

export default ModbusTCP;
