import React, { useState } from 'react';
import { makeStyles } from '@mui/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';

import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import Snackbar from '@mui/material/Snackbar';

import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh'
import RemoveIcon from '@mui/icons-material/DeleteOutline'


import DialogContentText from '@mui/material/DialogContentText';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';


import axios from 'axios';

// const label = { inputProps: { 'aria-label': 'Checkbox demo' } };

const useStyles = makeStyles(theme => ({
  root: {
    marginTop: theme.spacing(3),
    overflowX: 'auto',
  },
  table: {
    minWidth: 650,
  },
}));




export default function S4ARemoteLicense(props) {
  const classes = useStyles();

  const [sn, setSN] = useState("");
  const [note, setNote] = useState("");

  const [open, setOpen] = useState(false);
  const [createLocation, setCreateLocation] = useState("1");
  const [errOpen, setErrOpen] = useState(false);
  const [errMsg, setErrMsg] = useState("Err");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSN, setConfirmSN] = useState(0);
  const [confirmID, setConfirmID] = useState(0);
  const [confirmLocation, setConfirmLocation] = useState("");

  const [progressOpen, setProgressOpen] = useState(false);

  function handleNoteChange(event) {
    setNote(event.target.value)
  }

  const handleResetChange = (e, id, sn, location) => {

    setProgressOpen(true);
    var newlocation = e.target.value;
    console.log(newlocation);
    axios.put("/api/s4aserialnumber", { id: id, sn: sn, currlocation: location, newlocation: newlocation })
      .then(response => {
        setProgressOpen(false);
        if (response.status === 200) {
          props.updateS4A(id, newlocation);
        } else {
          setErrMsg("Change location error : " + response.data.msg);
          setErrOpen(true);
          return;
        }
      }).catch(error => {
        setProgressOpen(false);
        setErrMsg("Change location error : " + error);
        setErrOpen(true);
        return;
      });

  }
  function handleSNChange(event) {
    setSN(event.target.value)
  }

  function handleConfirmClose() {
    setConfirmOpen(false);
  }
  function handleErrClose() {
    setErrOpen(false)
  }
  function handleClose() {
    setOpen(false);
  }

  function handleClickRefresh(id, sn, location) {
    setProgressOpen(true);
    axios.get('/api/s4aserialnumber?id=' + id + '&sn=' + sn + '&location=' + location, {
      id: id,
      sn: sn,
      location: location,
    })
      .then(function (response) {
        // loadS4ALicense();
        setProgressOpen(false);
        if (response.status === 200) {
          console.log(response.data);
          console.log(response.data.locationID);
          props.updateS4A(id, response.data.locationID.toString());
          // props.reloadS4A('');
        } else {
          console.log(response.data.msg);
          setErrMsg("Delete SN error : " + response.data.msg);
          setErrOpen(true);
          return;
        }
      })
      .catch(function (error) {
        setProgressOpen(false);
        setErrMsg("Delete SN error : " + error);
        setErrOpen(true);
        return;
      });
  }


  function handleClickRemove(id, sn, location) {
    setConfirmOpen(true);
    setConfirmSN(sn);
    setConfirmID(id);
    setConfirmLocation(location);
  }
  function handleConfirm(yON) {
    if (yON === 1) {
      handleRemove(confirmID, confirmSN, confirmLocation);
    }
    setConfirmOpen(false);
  }

  function handleRemove(id, sn, location) {
    setProgressOpen(true);
    axios.post('/api/s4aserialnumber_delete', {
      id: id,
      sn: sn,
      location: location,
    })
      .then(function (response) {
        setProgressOpen(false);
        if (response.status === 200) {
          props.reloadS4A('');
        } else {
          console.log(response.data.msg);
          setErrMsg("Delete SN error : " + response.data.msg);
          setErrOpen(true);
          return;
        }
      })
      .catch(function (error) {
        setProgressOpen(false);
        setOpen(false);
        setErrMsg("Delete SN error : " + error);
        setErrOpen(true);
        return;
      });
  }
  function handleCreateChange(event) {

    console.log(event.target.value);
    setCreateLocation(event.target.value);
  }
  function handleCreate() {
    if (sn === "") {
      setErrMsg("Please input serial number.");
      setErrOpen(true);
      return;
    }
    var snStr;
    snStr = sn.replace(/\s+/g, "");
    if (snStr.length !== 8) {
      setErrMsg("Serial number should be 8-bit.");
      setErrOpen(true);
      return;
    }
    if (note === "") {
      setErrMsg("Please leave some note.");
      setErrOpen(true);
      return;
    }
    axios.post('/api/s4aserialnumber', {
      sn: snStr,
      location: createLocation,
      note: note,
    })
      .then(function (response) {
        // loadS4ALicense();
        console.log(response.status);
        if (response.status === 200) {
          props.reloadS4A('');
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
      <h3>S4A remote licenses</h3>
      <Button variant="outlined" size="small" style={{ width: '100px' }} onClick={handleClickOpen} >Create</Button>
      <Paper className={classes.root}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>Create time</TableCell>
              <TableCell align="left">Serial Number</TableCell>
              <TableCell align="center">Locations</TableCell>
              {/* <TableCell >&nbsp;&nbsp;&nbsp;CN</TableCell>
            <TableCell >&nbsp;&nbsp;&nbsp;EU</TableCell> */}
              <TableCell align="center">Option</TableCell>
              <TableCell align="left">Note</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.rows.map(row => (
              <TableRow key={row.time}>
                <TableCell component="th" scope="row">
                  {row.time}
                </TableCell>

                <TableCell align="left">{row.sn}</TableCell>

                <TableCell>
                  <FormControl component="fieldset">
                    <RadioGroup row aria-label="line1" name="row-radio-buttons-group"
                      value={row.location}
                      onChange={(e) => handleResetChange(e, row.id, row.sn, row.location)}
                    >
                      <FormControlLabel value="1" control={<Radio />} label="CN" />
                      <FormControlLabel value="2" control={<Radio />} label="HK" />
                      <FormControlLabel value="3" control={<Radio />} label="EU" />
                    </RadioGroup>
                  </FormControl>
                </TableCell>

                <TableCell align="left">

                  <IconButton
                    onClick={() => handleClickRefresh(row.id, row.sn, row.location)}
                  >
                    <RefreshIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleClickRemove(row.id, row.sn, row.location)}
                  >
                    <RemoveIcon />
                  </IconButton>



                </TableCell>
                <TableCell align="left">{row.note}</TableCell>
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
      </Paper>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Create</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Serial number"
            fullWidth
            variant="standard"
            onChange={handleSNChange}
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
          <span>Server locations.<br /></span>
          <FormControl component="fieldset">
            <RadioGroup row aria-label="line1"
              value={createLocation}
              name="row-radio-buttons-group"
              onChange={handleCreateChange}
            >
              <FormControlLabel value="1" control={<Radio />} label="CN" />
              <FormControlLabel value="2" control={<Radio />} label="HK" />
              <FormControlLabel value="3" control={<Radio />} label="EU" />
            </RadioGroup>
          </FormControl>

        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreate}>OK</Button>
          <Button onClick={handleClose}>Cancel</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={progressOpen}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          Working
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Waiting for background processing
          </DialogContentText>
          <Box sx={{ width: '100%' }}>
            <LinearProgress />
          </Box>
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirmOpen}
        onClose={handleConfirmClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          Please confirm !!!
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Really want to delete SN: {confirmSN} ?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleConfirm(0)}>Cancel</Button>
          <Button onClick={() => handleConfirm(1)} autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
