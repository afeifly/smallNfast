import React, { useState } from 'react';
import { unzipConfigFile, parseSummary, calculateConfigHash, exportConfigPackage } from '../util/configFileUtils';
import { useConfig } from '../context/ConfigContext';
import iconAlertBig from '../assets/images/icon_alert_big.png';
import iconSmallPlusCircle from '../assets/images/icon-small-plus-circle.png';

const ConfigManager = () => {
  const { configData: globalConfigData, setConfigData: setGlobalConfigData } = useConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hashStatus, setHashStatus] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setHashStatus(null);

    try {
      // Step 1: Unzip (Decrypt)
      const fileMap = await unzipConfigFile(file);
      
      // Step 2: Parse Summary
      const summary = parseSummary(fileMap);
      
      // Step 3: Verify Hash
      const calculatedHash = await calculateConfigHash(fileMap);
      const isValid = calculatedHash === summary.hash;
      setHashStatus(isValid ? 'Verified' : 'Tampered');

      // Step 4: Extract JSON and .sutolist files for preview
      const extractedConfigs = {};
      const decoder = new TextDecoder();

      for (const [path, content] of fileMap.entries()) {
        if (path.endsWith('.json') || path.endsWith('.sutolist')) {
          try {
            extractedConfigs[path] = JSON.parse(decoder.decode(content));
          } catch (e) {
            extractedConfigs[path] = 'Error parsing JSON';
          }
        }
      }

      const fullConfig = {
        summary,
        configs: extractedConfigs,
        fileMap: fileMap, // Preserve binary contents for export
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        importTime: new Date().toLocaleString()
      };

      setGlobalConfigData(fullConfig);

    } catch (err) {
      console.error(err);
      setError('Failed to process config file. Check password or file format.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all loaded configuration data?')) {
      setGlobalConfigData(null);
      setHashStatus(null);
    }
  };

  const handleExport = async () => {
    if (!globalConfigData) return;
    setLoading(true);
    try {
      const blob = await exportConfigPackage(
        globalConfigData.configs, 
        globalConfigData.summary, 
        globalConfigData.fileMap
      );
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `exported_${globalConfigData.fileName || 'config.cfgf'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export configuration. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        paddingBottom: '16px',
        borderBottom: '1px solid #E7E7E7'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#1D1D1B' }}>Configuration Manager</h1>
          <p style={{ margin: '4px 0 0 0', color: '#86909C', fontSize: '14px' }}>Import and manage your device configuration files (.cfgf)</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {globalConfigData && (
            <button 
              onClick={handleExport}
              disabled={loading}
              style={{ 
                background: '#00AB84', 
                color: 'white', 
                border: 'none', 
                padding: '8px 24px', 
                borderRadius: '4px', 
                fontWeight: '600', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? 'Exporting...' : 'Export .cfgf'}
            </button>
          )}
          {globalConfigData && (
            <button 
              onClick={handleClear}
              style={{ 
                background: '#FFF2F0', 
                color: '#F53F3F', 
                border: '1px solid #FFCFCA', 
                padding: '8px 16px', 
                borderRadius: '4px', 
                fontWeight: '600', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              Clear All Data
            </button>
          )}
        </div>
      </div>

      {!globalConfigData ? (
        /* Empty State / Upload Zone */
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}>
          <div style={{ 
            maxWidth: '600px', 
            width: '100%', 
            padding: '64px', 
            background: 'white', 
            borderRadius: '12px', 
            border: '2px dashed #DCDCDC',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px'
          }}>
            <div style={{ width: '80px', height: '80px', background: '#F2F3F5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={iconAlertBig} width="40" height="40" alt="upload" style={{ opacity: 0.5 }} />
            </div>
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>No Configuration Loaded</h2>
              <p style={{ margin: 0, color: '#86909C' }}>Upload a .cfgf file to start managing your device settings</p>
            </div>
            
            <input 
              type="file" 
              accept=".cfgf" 
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="cm-upload"
            />
            <label 
              htmlFor="cm-upload" 
              style={{ 
                background: '#00AB84', 
                color: 'white', 
                padding: '12px 32px', 
                borderRadius: '6px', 
                fontWeight: '600', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '16px'
              }}
            >
              {loading ? 'Processing...' : 'Import .cfgf File'}
              {!loading && <img src={iconSmallPlusCircle} width="16" height="16" style={{ filter: 'brightness(0) invert(1)' }} alt="plus" />}
            </label>
            
            {error && <p style={{ color: '#F53F3F', margin: 0, fontWeight: '500' }}>{error}</p>}
          </div>
        </div>
      ) : (
        /* Dashboard View */
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
          
          {/* Left Column: Summary Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', borderBottom: '1px solid #F2F3F5', paddingBottom: '8px' }}>Properties</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <PropertyRow label="File Name" value={globalConfigData.fileName} />
                <PropertyRow label="File Size" value={globalConfigData.fileSize} />
                <PropertyRow label="Imported" value={globalConfigData.importTime} />
                <PropertyRow label="Integrity" value={hashStatus || 'Verified'} color={hashStatus === 'Tampered' ? '#F53F3F' : '#00AB84'} />
              </div>
            </div>

            <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', borderBottom: '1px solid #F2F3F5', paddingBottom: '8px' }}>Device Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                <pre style={{ margin: 0, background: '#F8F9FA', padding: '12px', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                  {JSON.stringify(globalConfigData.summary, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          {/* Right Column: Files List */}
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', borderBottom: '1px solid #F2F3F5', paddingBottom: '8px' }}>Embedded Documents</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.entries(globalConfigData.configs).map(([path, data]) => (
                <div key={path} style={{ border: '1px solid #F2F3F5', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ background: '#F8F9FA', padding: '8px 16px', borderBottom: '1px solid #F2F3F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px' }}>{path}</span>
                    <span style={{ fontSize: '12px', color: '#86909C' }}>JSON Format</span>
                  </div>
                  <div style={{ padding: '16px', maxHeight: '160px', overflowY: 'auto', background: 'white' }}>
                    <pre style={{ margin: 0, fontSize: '12px', color: '#4E5969' }}>
                      {JSON.stringify(data, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

const PropertyRow = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
    <span style={{ color: '#86909C' }}>{label}</span>
    <span style={{ fontWeight: '600', color: color || '#1D1D1B' }}>{value}</span>
  </div>
);

export default ConfigManager;
