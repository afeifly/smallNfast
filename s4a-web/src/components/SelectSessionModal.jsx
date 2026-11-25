import React, { useState, useEffect, useRef } from 'react';
import intl from 'react-intl-universal';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import CircularProgress from '@mui/material/CircularProgress';
import FileAnalyzeAPI from '../api/FileAnalyzeAPI';
import { FileInfoDetails } from '../modules/fileinfo/FileInfoView';
import './css/SelectSessionModal.css';

export default function SelectSessionModal() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState('open');
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [details, setDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequest = useRef(0);

  useEffect(() => {
    const requestRef = detailRequest;
    const handleSessionsAvailable = (e) => {
      const detail = e.detail || {};
      const availableSessions = detail.sessions || [];
      requestRef.current++;
      setShowDetails(false);
      setDetails(null);
      setDetailLoading(false);
      setDetailError('');
      setPreparing(Boolean(detail.preparing));
      setSessions(availableSessions);
      setMode(detail.mode || 'open');
      setSelectedSession(availableSessions[0] || null);
      setFileName(detail.file ? detail.file.name : '');
      setOpen(true);
    };

    window.addEventListener('stdbSessionsAvailable', handleSessionsAvailable);
    const handleCancelled = () => {
      requestRef.current++;
      setShowDetails(false);
      setDetails(null);
      setDetailLoading(false);
      setDetailError('');
      setPreparing(false);
      setOpen(false);
    };
    window.addEventListener('stdbSessionsCancelled', handleCancelled);
    const handlePreparing = () => {
      requestRef.current++;
      setDetails(null);
      setShowDetails(false);
      setDetailLoading(false);
      setPreparing(true);
    };
    const handlePrepared = () => setPreparing(false);
    window.addEventListener('stdbSessionsPreparing', handlePreparing);
    window.addEventListener('stdbSessionsPrepared', handlePrepared);
    return () => {
      requestRef.current++;
      window.removeEventListener('stdbSessionsAvailable', handleSessionsAvailable);
      window.removeEventListener('stdbSessionsCancelled', handleCancelled);
      window.removeEventListener('stdbSessionsPreparing', handlePreparing);
      window.removeEventListener('stdbSessionsPrepared', handlePrepared);
    };
  }, []);

  const handleSelect = async () => {
    if (loading || preparing || !selectedSession) return;
    setLoading(true);
    try {
      await FileAnalyzeAPI.selectStdbSession(selectedSession);
      setOpen(false);
    } catch (e) {
      if (window.showAppNotification) {
        window.showAppNotification('Error', e.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const changeSelection = (session) => {
    if (loading || preparing || session === selectedSession) return;
    detailRequest.current++;
    setDetails(null);
    setDetailLoading(false);
    setDetailError('');
    setSelectedSession(session);
    if (showDetails) loadDetails(session);
  };

  const loadDetails = async (session) => {
    const request = ++detailRequest.current;
    setDetails(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const result = await FileAnalyzeAPI.getStdbSessionDetails(session.id);
      if (request === detailRequest.current) {
        setDetails({
          name: result.session.LoggerFileName || session.loggerFileName || fileName,
          start: Number(result.session.StartTimeStamp) || null,
          stop: Number(result.session.EndTimeStamp) || null,
          isStdb: true,
          isCsv: false,
          channels: result.channels
        });
      }
    } catch (error) {
      if (request === detailRequest.current) {
        console.error('[SelectSessionModal] Failed to read recording details:', error);
        setDetailError(error.message);
        window.showAppNotification?.(intl.get('STDB_DETAILS_ERROR') || 'Failed to read recording details', error.message, 'error');
      }
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  };

  const handleDetail = () => {
    if (!selectedSession || loading || preparing) return;
    if (showDetails) {
      detailRequest.current++;
      setShowDetails(false);
      setDetails(null);
      setDetailLoading(false);
      setDetailError('');
    } else {
      setShowDetails(true);
      loadDetails(selectedSession);
    }
  };

  const handleClose = () => {
    if (loading) return;
    detailRequest.current++;
    setShowDetails(false);
    setDetails(null);
    setDetailLoading(false);
    setDetailError('');
    FileAnalyzeAPI.cancelStdbSession();
    setOpen(false);
  };

  const formatDate = (ms) => {
    if (!ms) return '-';
    const d = new Date(Number(ms));
    return d.toLocaleString();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={showDetails ? 'xl' : 'md'}
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }
      }}
    >
      <DialogTitle sx={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', pb: 1.5 }}>
        <Typography component="span" variant="h6" sx={{ display: 'block', fontWeight: 600, color: '#0f172a' }}>
          {mode === 'append' ? (intl.get('STDB_APPEND_SESSION') || 'Append Recording Session') : (intl.get('STDB_SELECT_SESSION') || 'Select Recording Session')}
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>
          {intl.get('FILE_NAME') || 'File Name'}: {fileName} — {preparing
            ? (intl.get('APP_LOADING') || 'Loading...') : sessions.length
            ? (intl.get('STDB_SELECT_SESSION_HINT') || 'Select a recording session to open.')
            : (intl.get('STDB_NO_SESSIONS') || 'No recording sessions found.')}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 2, minHeight: 'min(320px, 45vh)' }}>
        {preparing && <div className="stdb-session-detail-status" role="status"><CircularProgress size={20} />{intl.get('APP_LOADING') || 'Loading...'}</div>}
        <div className={showDetails ? 'stdb-session-layout stdb-session-layout-expanded' : 'stdb-session-layout'}>
        <TableContainer className="stdb-session-list" component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
              <TableRow>
                {!showDetails && <TableCell padding="checkbox" />}
                <TableCell sx={{ fontWeight: 600, color: '#334155' }}>{intl.get('STDB_SESSION_NAME') || 'Session Name'}</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#334155' }}>{intl.get('START_TIME') || 'Start Time'}</TableCell>
                {!showDetails && <>
                  <TableCell sx={{ fontWeight: 600, color: '#334155' }}>{intl.get('END_TIME') || 'End Time'}</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#334155' }} align="center">{intl.get('CHANNEL') || 'Channel'}</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#334155' }} align="center">{intl.get('STDB_SAMPLE_INTERVAL') || 'Interval'}</TableCell>
                </>}
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((s, idx) => (
                <TableRow
                  key={s.id ?? idx}
                  hover
                  selected={selectedSession === s}
                  aria-selected={selectedSession === s}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#f8fafc' },
                    '&.Mui-selected': { backgroundColor: '#e5f7f2' },
                    '&.Mui-selected:hover': { backgroundColor: '#d8f2ea' },
                    transition: 'background-color 0.15s ease'
                  }}
                  onClick={() => changeSelection(s)}
                >
                  {!showDetails && <TableCell padding="checkbox">
                    <Radio
                      checked={selectedSession === s}
                      disabled={loading || preparing}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => changeSelection(s)}
                      name="stdb-session"
                      inputProps={{ 'aria-label': s.loggerFileName || `Session ${s.id ?? idx + 1}` }}
                      sx={{ color: '#94a3b8', '&.Mui-checked': { color: '#00ac86' } }}
                    />
                  </TableCell>}
                  <TableCell sx={{ fontWeight: 500, color: '#0f172a' }}>
                    {showDetails && <Radio
                      checked={selectedSession === s}
                      disabled={loading || preparing}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => changeSelection(s)}
                      name="stdb-session"
                      inputProps={{ 'aria-label': s.loggerFileName || `Session ${s.id ?? idx + 1}` }}
                      sx={{ color: '#94a3b8', '&.Mui-checked': { color: '#00ac86' }, p: 0, mr: 1 }}
                    />}
                    {s.loggerFileName || `Session ${s.id ?? idx + 1}`}
                  </TableCell>
                  <TableCell sx={{ color: '#475569', fontSize: '0.8125rem' }}>
                    {s.startTime || formatDate(s.startTimeStamp)}
                  </TableCell>
                  {!showDetails && <>
                    <TableCell sx={{ color: '#475569', fontSize: '0.8125rem' }}>
                      {s.endTime || formatDate(s.endTimeStamp)}
                    </TableCell>
                    <TableCell align="center" sx={{ color: '#475569' }}>
                      {s.channelCount || '-'}
                    </TableCell>
                    <TableCell align="center" sx={{ color: '#475569' }}>
                      {s.sampleRate ? `${s.sampleRate}s` : '-'}
                    </TableCell>
                  </>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {showDetails && (
          <div className="stdb-session-details" id="stdb-session-details" aria-busy={detailLoading}>
            {detailLoading && <div className="stdb-session-detail-status" role="status"><CircularProgress size={20} />{intl.get('APP_LOADING') || 'Loading...'}</div>}
            {detailError && <div className="stdb-session-detail-status" role="alert">{detailError}</div>}
            {details && <FileInfoDetails fileInfo={details} showHeader={false} />}
          </div>
        )}
        </div>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
        {mode === 'append' && <Button
          onClick={() => FileAnalyzeAPI.openStdbAppendFile()}
          disabled={loading || preparing}
          sx={{ color: '#008b6d', textTransform: 'none', mr: 'auto' }}
        >
          {intl.get('STDB_APPEND_OTHER_FILE') || 'Choose STDB File...'}
        </Button>}
        <Button
          onClick={handleClose}
          disabled={loading}
          sx={{
            color: '#64748b',
            textTransform: 'none',
            '&:hover': { backgroundColor: '#e2e8f0' }
          }}
        >
          {intl.get('CANCEL') || 'Cancel'}
        </Button>
        {selectedSession && <Button
          onClick={handleDetail}
          disabled={loading || preparing}
          aria-expanded={showDetails}
          aria-controls={showDetails ? 'stdb-session-details' : undefined}
          sx={{ color: '#008b6d', textTransform: 'none' }}
        >
          {showDetails ? (intl.get('STDB_HIDE_DETAIL') || 'Hide Detail') : (intl.get('STDB_DETAIL') || 'Show Detail')}
        </Button>}
        <Button
          variant="contained"
          onClick={handleSelect}
          disabled={loading || preparing || detailLoading || !selectedSession}
          sx={{
            backgroundColor: '#00ac86',
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': { backgroundColor: '#009272', boxShadow: 'none' }
          }}
        >
          {loading ? (intl.get('APP_LOADING') || 'Loading...') : mode === 'append'
            ? (intl.get('STDB_APPEND_ACTION') || 'Append Session') : (intl.get('OPEN_FILE') || 'Open File')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
