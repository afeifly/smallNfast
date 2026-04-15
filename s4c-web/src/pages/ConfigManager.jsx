import React, { useState } from 'react';
import { unzipConfigFile, parseSummary, calculateConfigHash } from '../util/configFileUtils';
import { useConfig } from '../context/ConfigContext';

const ConfigManager = () => {
  const { setConfigData: setGlobalConfigData } = useConfig();
  const [loading, setLoading] = useState(false);
  const [configData, setConfigData] = useState(null);
  const [error, setError] = useState(null);
  const [hashStatus, setHashStatus] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
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
      setHashStatus(isValid ? 'Valid' : 'Invalid - Tampered or Mismatched');

      // Step 4: Extract JSON and .sutolist files for preview
      const extractedConfigs = {};
      const decoder = new TextDecoder();

      for (const [path, content] of fileMap.entries()) {
        // According to documentation, .sutolist is also JSON format
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
        fileMap // Keep the original data for later export
      };

      setConfigData(fullConfig);
      setGlobalConfigData(fullConfig);

    } catch (err) {
      console.error(err);
      setError('Failed to process config file. Check password or file format.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-card" style={{ padding: '24px' }}>
      <header className="card-header">
        <h2 style={{ margin: 0 }}>Device Configuration Manager</h2>
      </header>

      <div style={{ marginTop: '20px' }}>
        <input 
          type="file" 
          accept=".cfgf" 
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          id="config-upload"
        />
        <label 
          htmlFor="config-upload" 
          className="create-logger-btn" 
          style={{ cursor: 'pointer', display: 'inline-block' }}
        >
          {loading ? 'Processing...' : 'Import .cfgf File'}
        </label>
      </div>

      {error && (
        <div style={{ color: '#D9001B', marginTop: '16px', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      {configData && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ 
            padding: '16px', 
            background: hashStatus === 'Valid' ? '#E6F7F0' : '#FFF2F0',
            border: `1px solid ${hashStatus === 'Valid' ? '#00AB84' : '#D9001B'}`,
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            <strong>Integrity Status:</strong> {hashStatus}
          </div>

          <h3>Summary Info</h3>
          <pre style={{ background: '#F3F3F3', padding: '12px', borderRadius: '4px' }}>
            {JSON.stringify(configData.summary, null, 2)}
          </pre>

          <h3>Extracted JSON Files</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {Object.entries(configData.configs).map(([path, data]) => (
              <div key={path} style={{ border: '1px solid #E7E7E7', borderRadius: '8px', padding: '12px' }}>
                <h4 style={{ margin: '0 0 8px 0' }}>{path}</h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '12px' }}>
                  <pre>{JSON.stringify(data, null, 2)}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigManager;
