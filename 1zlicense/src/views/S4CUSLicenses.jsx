import React, { useState } from 'react';
import { makeStyles } from '@mui/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Grid from '@mui/material/Grid';
import StopIcon from '@mui/icons-material/Stop'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import GroupIcon from '@mui/icons-material/Group'
import WorkIcon from '@mui/icons-material/Work'
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import TablePagination from '@mui/material/TablePagination';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';


const useStyles = makeStyles(theme => ({
  root: {
    marginTop: theme.spacing(3),
    overflowX: 'auto',
  },
  table: {
    minWidth: 650,
  },
}));




export default function S4CUSLicense(props) {
  const classes = useStyles();


  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSN, setConfirmSN] = useState(0);
  const [confirmState, setConfirmState] = useState(0);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  function handleConfirm(yON) {
    if (yON === 1) {
      if (confirmState === 1) {
        props.handleBlock(confirmSN);
      }
      if (confirmState === 2) {
        props.handleResume(confirmSN);
      }
    }
    setConfirmOpen(false);
  }
  function handleClose() {
    this.setConfirmOpen(false);
  }
  function handleSNChangeState(sn, state) {

    setConfirmOpen(true);
    setConfirmSN(sn);
    setConfirmState(state);


  }


  return (
    <Grid
      container
      direction="column"
      justifyContent="flex-start"
    >
      <h3>S4CUS licenses</h3>
      <Paper className={classes.root}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>Create time</TableCell>
              <TableCell align="left">Serial Number</TableCell>
              <TableCell align="right">Company</TableCell>
              <TableCell align="right">State</TableCell>
              <TableCell align="right">Type</TableCell>
              <TableCell align="left"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(row => (
              <TableRow key={row.time}>
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
                <TableCell align="right">
                  {row.sntype === 0 &&
                    <Tooltip title='SUTO Partner' placement="top" enterDelay={500}  >
                      <GroupIcon />
                    </Tooltip>
                  }
                  {row.sntype === 1 &&
                    <Tooltip title='Calibration' placement="top" enterDelay={500}  >
                      <WorkIcon />
                    </Tooltip>
                  }
                </TableCell>
                <TableCell align="left">
                  {row.state === 1 &&
                    <IconButton
                      onClick={() => handleSNChangeState(row.sn, row.state)}
                    >

                      <Tooltip title='Block' placement="top" enterDelay={500}  >
                        <StopIcon />
                      </Tooltip>
                    </IconButton>
                  }
                  {row.state === 2 &&
                    <IconButton
                      onClick={() => handleSNChangeState(row.sn, row.state)}
                    >
                      <Tooltip title='Resume' placement="top" enterDelay={500}  >
                        <PlayArrowIcon />
                      </Tooltip>
                    </IconButton>
                  }

                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={props.rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
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
