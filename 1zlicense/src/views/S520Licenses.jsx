/* global BigInt */
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




export default function S520Licenses(props) {
  const classes = useStyles();
  const [open, setOpen] = React.useState(false);
  const [sn, setSn] = React.useState('');
  const [note, setNote] = React.useState('');
  const [isOld, setIsOld] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleClickOpen = (old = false) => {
    setIsOld(old);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSn('');
    setNote('');
  };

  function generateLicenseCode(serialNumber) {
    const secretKey = CryptoJS.enc.Hex.parse('635166546a576e5a7234753778214125442a462d4a614e645267556b58703273');
    const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const b36_limit_8 = BigInt("2821109907456"); // 36 ** 8

    // HMAC-SHA256
    const hash = CryptoJS.HmacSHA256(serialNumber, secretKey);
    const hashHex = hash.toString(CryptoJS.enc.Hex);

    // Take first 8 bytes (16 hex chars) and convert to BigInt
    const seed = BigInt("0x" + hashHex.substring(0, 16));

    // Modulo
    let tempVal = seed % b36_limit_8;

    // Base36 encoding
    let res = "";
    for (let i = 0; i < 8; i++) {
      res = charset[Number(tempVal % 36n)] + res;
      tempVal = tempVal / 36n;
    }
    return res;
  }

  function handleCreate() {
    var reg = /^[0-9]+.?[0-9]*$/;
    if (!reg.test(sn) || sn.length !== 8) {
      alert("Serial Number should be 8 bit number");
      return;
    }

    const license = isOld ? null : generateLicenseCode(sn);

    axios.post("/api/s520licenses", {
      sn: sn,
      note: note,
      license: license
    }).then(response => {
      handleClose();
      // Trigger refresh in App.js
      props.showPage(Constant.PAGE_TYPE_S520_ALL_LICENSE);
    }).catch(error => {
      console.log(error);
      alert("Create failed: " + error.message);
    });
  }

  function handleCreateOld() {
    var reg = /^[0-9]+.?[0-9]*$/;
    if (!reg.test(sn) || sn.length !== 8) {
      alert("Serial Number should be 8 bit number");
      return;
    }

    axios.post("/api/s520licenses", {
      sn: sn,
      note: note,
    }).then(response => {
      handleClose();
      // Trigger refresh in App.js
      props.showPage(Constant.PAGE_TYPE_S520_ALL_LICENSE);
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
    const header = ["Create time", "Serial Number", "Note", "License"];
    const csvRows = [header.join(",")];

    props.rows.forEach(row => {
      const values = [
        `"${row.time}"`,
        `"${row.sn}"`,
        `"${row.note || ""}"`,
        `"${row.license}"`
      ];
      csvRows.push(values.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "S520_Licenses.csv");
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
        <h3>S520 licenses</h3>
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
            color="inherit"
            startIcon={<AddIcon />}
            onClick={() => handleClickOpen(true)}
            style={{ marginRight: '10px' }}
          >
            Create Old License
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleClickOpen(false)}
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
              <TableCell align="left">Serial Number</TableCell>
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

                <TableCell align="left">{row.sn}</TableCell>
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
        <DialogTitle id="form-dialog-title">{isOld ? "Create Old S520 License" : "Create S520 License"}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="sn"
            label="Serial Number (8 digits)"
            type="text"
            fullWidth
            value={sn}
            onChange={(e) => setSn(e.target.value)}
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
            {isOld ? "Create Old License" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
