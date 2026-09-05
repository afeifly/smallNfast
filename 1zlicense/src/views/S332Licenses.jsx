import React from 'react';
import { makeStyles } from '@mui/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import AddIcon from '@mui/icons-material/Add';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import TablePagination from '@mui/material/TablePagination';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import * as Constant from '../utils/Constant';

const useStyles = makeStyles(theme => ({
  root: {
    marginTop: theme.spacing(3),
    overflowX: 'auto',
  },
  table: {
    minWidth: 650,
  },
}));




export default function S332Licenses(props) {
  const classes = useStyles();
  const [open, setOpen] = React.useState(false);
  const [machineCode, setMachineCode] = React.useState('');
  const [note, setNote] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setMachineCode('');
    setNote('');
  };

  function generateLicenseCodeV2(machineCode) {
    if (machineCode.length < 16) return "";

    const a = machineCode.substring(0, 8);
    const b = machineCode.substring(8, 16);

    // First MD5: "a:b"
    const s1 = a + ":" + b;
    const c = CryptoJS.MD5(s1).toString();

    // Second MD5: "abcSUTO2005"
    const s2 = a + b + c + "SUTO2005";
    const finalHash = CryptoJS.MD5(s2).toString().toUpperCase();

    // Format as 4-4-4
    const formatted =
      finalHash.substring(0, 4) + "-" +
      finalHash.substring(4, 8) + "-" +
      finalHash.substring(8, 12);

    return formatted;
  }

  function handleCreate() {
    if (machineCode.length < 16) {
      alert("Machine Code should be at least 16 characters");
      return;
    }

    const license = generateLicenseCodeV2(machineCode);

    axios.post("/api/s332licenses", {
      machine_code: machineCode,
      note: note,
      license: license
    }).then(response => {
      handleClose();
      // Trigger refresh in App.js
      props.showPage(Constant.PAGE_TYPE_S332_ALL_LICENSE);
    }).catch(error => {
      console.log(error);
      alert("Create failed: " + error.message);
    });
  }




  function handleDownload(sn, key) {

    const element = document.createElement("a");
    const file = new Blob([key], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = sn + ".lic";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  }

  function handleExport() {
    const header = ["Create time", "Machine Code", "Note", "License", "Created By"];
    const csvRows = [header.join(",")];

    props.rows.forEach(row => {
      const values = [
        `"${row.time}"`,
        `"${row.machine_code}"`,
        `"${row.note || ""}"`,
        `"${row.license}"`,
        `"${row.create_by || ""}"`
      ];
      csvRows.push(values.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "S332_Licenses.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <Grid
      container
      direction="column"
      justifyContent="flex-start"
    >
      <Grid container direction="row" justifyContent="space-between" alignItems="center">
        <h3>S332 licenses</h3>
        <Grid item>
          <Button
            variant="contained"
            color="inherit"
            onClick={handleExport}
            style={{ marginRight: '10px' }}
          >
            Export All
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleClickOpen}
          >
            Create License
          </Button>
        </Grid>
      </Grid>
      <Paper className={classes.root}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>Create time</TableCell>
              <TableCell align="left">Machine Code</TableCell>
              <TableCell align="left">Created By</TableCell>
              <TableCell align="right">Note</TableCell>
              <TableCell align="left">License</TableCell>
              <TableCell align="left"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(row => (
              <TableRow key={row.id}>
                <TableCell component="th" scope="row">
                  {row.time}
                </TableCell>

                <TableCell align="left">{row.machine_code}</TableCell>
                <TableCell align="left">{row.create_by}</TableCell>
                <TableCell align="right">{row.note}</TableCell>
                <TableCell align="left">{row.license}</TableCell>
                <TableCell align="left">
                  <IconButton
                    onClick={() => handleDownload(row.sn, row.license)}
                  >
                    <SaveAltIcon />
                  </IconButton>

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
      </Paper>

      <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
        <DialogTitle id="form-dialog-title">Create S332 License</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="machineCode"
            label="Machine Code (16 chars)"
            type="text"
            fullWidth
            value={machineCode}
            onChange={(e) => setMachineCode(e.target.value)}
          />
          <TextField
            margin="dense"
            id="note"
            label="Note"
            type="text"
            fullWidth
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleCreate} color="primary">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
