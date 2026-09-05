import React, { useState } from 'react';
import { makeStyles } from '@mui/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import StopIcon from '@mui/icons-material/Stop'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import Tooltip from '@mui/material/Tooltip';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';

import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

import DialogTitle from '@mui/material/DialogTitle';
import axios from 'axios';

const useStyles = makeStyles(theme => ({
  root: {
    marginTop: theme.spacing(3),
    overflowX: 'auto',
  },
  table: {
    minWidth: 650,
  },
}));




export default function CalibrationLicense(props) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSN, setConfirmSN] = useState(0);
  const [confirmState, setConfirmState] = useState(0);
  const [errOpen, setErrOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [errMsg, setErrMsg] = useState("Err");
  const [note, setNote] = useState("");

  function handleClose() {
    setOpen(false);
  }
  function handleNoteChange(event) {
    setNote(event.target.value)
  }

  function handleCalibrationStatuChange(sn, state) {
    setConfirmOpen(true);
    setConfirmSN(sn);
    setConfirmState(state);
    // else{
    //   props.handleCalibrationStatuChange(sn,state);
    // }
  }

  function handleErrClose() {
    setErrOpen(false)
  }
  function handleCompanyChange(event) {
    setCompany(event.target.value)
  }
  function handleConfirm(yON) {
    if (yON === 1) {
      props.handleCalibrationStatuChange(confirmSN, confirmState);
    }
    setConfirmOpen(false);
  }
  function handleCreate() {
    if (company === "") {
      setErrMsg("Please input company name.");
      setErrOpen(true);
      return;
    }
    if (note === "") {
      setErrMsg("Please leave some note.");
      setErrOpen(true);
      return;
    }
    axios.post('/api/calibrationlicense', {
      company: company,
      note: note,
    })
      .then(function (response) {
        console.log(response.status);
        if (response.status === 200) {
          props.reload('');
        } else {
          console.log(response.data.msg);
          setErrMsg("Create SN error : " + response.data.msg);
          setErrOpen(true);
          return;
        }
      })
      .catch(function (error) {
        setOpen(false);
        setErrMsg("Create SN error : " + error);
        setErrOpen(true);
        return;
      });
  }
  function handleDownload(sn) {

    const element = document.createElement("a");
    const file = new Blob([sn], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "calibration.lic";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  }

  const handleClickOpen = () => {
    setOpen(true);
  };


  return (
    <Grid
      container
      direction="column"
      justifyContent="flex-start"
    // alignItems="left"
    >
      <h3>Calibration licenses</h3>

      <Button variant="outlined" size="small" style={{ width: '100px' }} onClick={handleClickOpen} >Create</Button>
      <Paper className={classes.root}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>Create time</TableCell>
              <TableCell align="left">Serial Number</TableCell>
              <TableCell align="right">Company</TableCell>
              <TableCell align="right">State</TableCell>
              <TableCell align="left">Opt</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.rows.map(row => (
              <TableRow key={row.sn}>
                <TableCell component="th" scope="row">
                  {row.time}
                </TableCell>

                <TableCell align="left">{row.sn}</TableCell>
                <Tooltip title={row.note} placement="top" enterDelay={500}  >
                  <TableCell align="right">{row.company}</TableCell>
                </Tooltip>
                <TableCell align="left">
                  {row.state === 1 &&
                    <Tooltip title='Active' placement="top" enterDelay={500}  >
                      <PlayArrowIcon />
                    </Tooltip>
                  }
                  {row.state === 2 &&
                    <Tooltip title='Blocked' placement="top" enterDelay={500}  >
                      <StopIcon />
                    </Tooltip>
                  }
                </TableCell>
                <TableCell align="left">
                  {row.state === 1 &&
                    <IconButton
                      onClick={() => handleCalibrationStatuChange(row.sn, 2)}
                    >

                      <Tooltip title='Block' placement="top" enterDelay={500}  >
                        <StopIcon />
                      </Tooltip>
                    </IconButton>
                  }
                  {row.state === 2 &&
                    <IconButton
                      onClick={() => handleCalibrationStatuChange(row.sn, 1)}
                    >
                      <Tooltip title='Resume' placement="top" enterDelay={500}  >
                        <PlayArrowIcon />
                      </Tooltip>
                    </IconButton>
                  }

                </TableCell>
                <TableCell align="left">
                  <IconButton
                    onClick={() => handleDownload(row.sn)}
                  >
                    <SaveAltIcon />
                  </IconButton>

                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Snackbar
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          open={errOpen}
          autoHideDuration={6000}
          onClose={handleErrClose}

          message={<span>{errMsg}</span>}
        />
        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>Create</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Company Name"
              fullWidth
              variant="standard"
              onChange={handleCompanyChange}
            />
            <span><br></br></span>
            <TextField
              margin="dense"
              label="Note"
              fullWidth
              onChange={handleNoteChange}
              variant="standard"
            />
            <br />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCreate}>OK</Button>
            <Button onClick={handleClose}>Cancel</Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={confirmOpen}
          onClose={handleClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            Please confirm !!!
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              Really want to {confirmState === 1 ? "block" : "resume"} SN: {confirmSN} ?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => handleConfirm(0)}>Cancel</Button>
            <Button onClick={() => handleConfirm(1)} autoFocus>
              OK
            </Button>
          </DialogActions>
        </Dialog>


      </Paper>
    </Grid>
  );
}
