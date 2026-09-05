import React from 'react';
import { makeStyles } from '@mui/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import Tooltip from '@mui/material/Tooltip';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh'
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TablePagination from '@mui/material/TablePagination';
import EncryptUtil from '../utils/EncryptUtil'
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




export default function Licenses(props) {
  const classes = useStyles();
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };


  function handleClick(sn) {
    props.handleResetSN(sn);
  }
  function showExpireDate(productID, data) {
    if (data === null || data === undefined) {
      return null;
    } else {
      var json;
      if (productID === Constant.SOFTWARE_TYPE_LMS_lite) {
        json = EncryptUtil.decryptAES(data);
      } else {
        json = EncryptUtil.decrypt(data);
      }
      var obj;
      try {
        obj = JSON.parse(json);
      } catch (e) {
        console.log('json format error');
      }
      if (obj != null && obj.opts != null) {
        for (var opt of obj.opts) {
          if (opt.key === 'expire_date') {
            return String(new Date(opt.value)).substring(4, 24);
          }
        }
      }
      return '';
    }
  }


  return (
    <Grid
      container
      direction="column"
      justifyContent="flex-start"
      sx={{ padding: 3 }}
    >
      <Grid container direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">License List</Typography>
      </Grid>
      <Paper className={classes.root} sx={{ mt: 0 }}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>Create time</TableCell>
              <TableCell align="right">Product</TableCell>
              <TableCell align="left">Serial Number</TableCell>
              <TableCell align="right">Status</TableCell>
              {/* <TableCell align="right">{ EncryptUtil.encrypt('c911f82b9e0c32893e5e099b3b8febf6')}</TableCell> */}
              <TableCell align="left">Company</TableCell>
              <TableCell align="center">Note</TableCell>
              <TableCell align="right">Options</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
              <TableRow key={index}>
                <TableCell component="th" scope="row">
                  {row.time}
                </TableCell>

                <Tooltip title={row.text === null ? '' : showExpireDate(row.product_id, row.text)} placement="top" enterDelay={500}  >
                  <TableCell align="right">{row.product}</TableCell>
                </Tooltip>
                <TableCell align="left">{row.sn}</TableCell>
                <TableCell align="right">{row.status}</TableCell>
                <Tooltip title={row.email === null ? '' : row.email} placement="top" enterDelay={500}  >
                  <TableCell align="left">{row.company}</TableCell>
                </Tooltip>
                <TableCell align="left">{row.note} {row.canbereset} </TableCell>
                <TableCell align="right">
                  {row.canbereset === 1 && row.used > 0 ? <IconButton
                    onClick={() => handleClick(row.sn)}
                  >
                    <RefreshIcon />
                  </IconButton> : null}

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
    </Grid>
  );
}
