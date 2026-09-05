import React, { useState, useEffect } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Fab from '@mui/material/Fab';
import { useNavigate } from "react-router-dom"
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Tooltip from '@mui/material/Tooltip';
import { Grid } from '@mui/material';
import TablePagination from '@mui/material/TablePagination';


import TopBar from '../Bar/TopBar';
import API from '../../common/api';
import * as Constant from '../../common/Constant';
import Cookies from 'js-cookie';

export default function Companys(props) {


  const defaultValuePerPage = 10
  const valuesPerPage = [defaultValuePerPage, 50, 200];
  const [totalRows, setTotalRows] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultValuePerPage);
  const [page, setPage] = useState(0);

  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [contactOpen, setContactOpen] = useState(false);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [contact, setContact] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [editCompanyId, setEditCompanyId] = useState(null);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [dialogForEdit, setDialogForEdit] = useState(false);


  const [deleteInfo, setDeleteInfo] = useState('');
  const [deleteKey, setDeleteKey] = useState(null);
  const [confirmDOpen, setConfirmDOpen] = useState(false);
  const [errOpen, setErrOpen] = useState(false);
  const [errMsg, setErrMsg] = useState("Err");

  useEffect(() => {
    loadCompany(0, rowsPerPage);
  }, []);


  function handleCloseDialog() {
    setContactOpen(false);
    setAddCompanyOpen(false);
    setConfirmDOpen(false);

  }

  function loadCompany(offset, limit) {
    API.post(`company/page`, {
      offset: offset,
      limit: limit
    })
      .then(res => {
        setTotalRows(res.data.count);
        setRows(res.data.rows);
      }).catch(() => {
      })
  }

  const handleChangePage = (event, value) => {
    setPage(value);
    loadCompany(value * rowsPerPage, rowsPerPage);
  }
  function handleChangeRowsPerPage(event) {
    const newValuesPerPage = event.target.value;
    setRowsPerPage(newValuesPerPage)
    setPage(0);
    loadCompany(0, newValuesPerPage);
  }

  function handleErrClose() {
    setErrOpen(false)
  }
  function handleClickOK() {
    console.log(`c:${newCompanyName} a:${newAddress} p:${newContact} p: ${newContactPhone} m: ${newContactEmail}`);

    if (dialogForEdit) {
      API.put(`company`, {
        id: editCompanyId,
        companyname: newCompanyName,
        address: newAddress,
        contact: newContact,
        email: newContactEmail,
        phone: newContactPhone
      }
      ).then(res => {
        handleCloseDialog();
        loadCompany(page * rowsPerPage, rowsPerPage);
      }).catch(() => {
        setErrOpen(true)
        setErrMsg(`Create company ${newCompanyName} fail`);
      })
    } else {
      API.post(`company`, {
        companyname: newCompanyName,
        address: newAddress,
        contact: newContact,
        email: newContactEmail,
        phone: newContactPhone
      }
      ).then(res => {
        handleCloseDialog();
        loadCompany(0, rowsPerPage);
      }).catch(() => {
        setErrOpen(true)
        setErrMsg(`Create company ${newCompanyName} fail`);
      })
    }

  }
  function openContact(contact, phone, email) {
    setContactOpen(true);
    setContactPhone(phone);
    setContact(contact);
    setContactEmail(email);

  }
  function handleCompanyNameChange(event) {
    setNewCompanyName(event.target.value);
  }
  function handleCompanyContactChange(event) {
    setNewContact(event.target.value);
  }
  function handleCompanyAddressChange(event) {
    setNewAddress(event.target.value);
  }
  function handleContactPhoneChange(event) {
    setNewContactPhone(event.target.value);
  }
  function handleContactEmailChange(event) {
    setNewContactEmail(event.target.value);
  }
  function handleShowCustomer(companyId, companyName) {
    navigate(Constant.HREF_CUSTOMERS, {
      state: {
        companyId: companyId,
        companyName: companyName,
      }
    });
  }
  function handleClickAddCompany() {

    setNewCompanyName('');
    setNewContact('');
    setNewContactEmail('');
    setNewContactPhone('');
    setNewAddress('');
    setDialogForEdit(false);
    setAddCompanyOpen(true);
  }
  function handleDelete(id,name) {
    setDeleteInfo(`Company ${name}`);
    setDeleteKey(id);
    setConfirmDOpen(true);
  }
  function execDelete() {
    console.log(`Delete key = ${deleteKey}`);
    API.delete(`company/${deleteKey}`).then(res => {
      handleCloseDialog();
      setAddCompanyOpen(false);
      loadCompany(0, rowsPerPage);
    }).catch(() => {
      setErrOpen(true)
      setErrMsg(`Delete company fail`);
    })
  }
  function handleClickEditCompany(company) {
    setDialogForEdit(true);
    setAddCompanyOpen(true);
    console.log(`${company.id} ${company.companyname} ${company.contact} ${company.phone} ${company.email} ${company.address}`);
    setEditCompanyId(company.id);
    setNewCompanyName(company.companyname);
    setNewContact(company.contact);
    setNewContactEmail(company.email);
    setNewContactPhone(company.phone);
    setNewAddress(company.address);
  }
  function handleShowSensor(companyId, companyName) {

    navigate(Constant.HREF_SENSORS, {
      state: {
        searchFor: Constant.SENSOR_SEARCH_BY_COMPANY,
        searchKey: companyId,
      }
    });
  }


  return (
    <Paper >
      <TopBar />

      <Grid
        // spacing={2}
        container
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
      >
        <Breadcrumbs
          sx={{ m: 2 }}
          aria-label="breadcrumb">
          <Typography color="text.primary">Companys</Typography>
        </Breadcrumbs>

        <Tooltip title="Add company">
          <Fab
            sx={{
              position: "fixed",
              bottom: (theme) => theme.spacing(2),
              right: (theme) => theme.spacing(2),
              backgroundColor: "#ffdd22"
            }}
            onClick={handleClickAddCompany}
          >
            <AddIcon />
          </Fab>
        </Tooltip>
      </Grid>

      <Table
      >
        <TableHead>
          <TableRow>
            <TableCell align="center">Company</TableCell>
            <TableCell align="left">Contact</TableCell>
            <TableCell align="left">Address</TableCell>
            {/* <TableCell align="left">Email</TableCell> */}
            {/* <TableCell align="left">Phone</TableCell> */}
            <TableCell align="left">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.id}>

              <TableCell align="center">{row.companyname}</TableCell>
              <TableCell align="left">
                <Button variant="text"
                  onClick={() => openContact(row.contact, row.phone, row.email)}
                >
                  {row.contact}
                </Button>
              </TableCell>
              <TableCell align="left">{row.address}</TableCell>
              <TableCell align="left">
                <Tooltip title="Customers">
                  <IconButton
                    onClick={() => handleShowCustomer(row.id, row.companyname)}
                  >
                    <PeopleOutlineIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Sensors">
                  <IconButton
                    onClick={() => handleShowSensor(row.id, row.companyname)}
                  >
                    <DeviceHubIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Modify Company">
                  <IconButton
                    onClick={() => handleClickEditCompany(row)}

                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                {
                  (Cookies.get(Constant.COOKIE_ROLE) === "1") &&

                  <Tooltip title="Delete Company">
                    <IconButton
                      onClick={() => handleDelete(row.id, row.companyname)}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Tooltip>
                }

              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        sx={{ marginBottom: "80px" }}
        rowsPerPageOptions={valuesPerPage}
        component="div"
        count={totalRows} // This is what your request should be returning in addition to the current page of rows.
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
      {/* </Grid> */}
      <Dialog
        maxWidth={"md"}
        open={contactOpen}
        onClose={handleCloseDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Contact information"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {"Contact: "}{contact} <br />
            {"Phone: "}{contactPhone} <br />
            {"Email: "}{contactEmail} <br />
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        // maxWidth={"md"}
        open={addCompanyOpen}
        onClose={handleCloseDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {dialogForEdit ? 'Update Company' : 'Create Company'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Company name"
            onChange={handleCompanyNameChange}
            value={newCompanyName}
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="contact"
            value={newContact}
            onChange={handleCompanyContactChange}
            label="Contact"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            label="Address"
            value={newAddress}
            onChange={handleCompanyAddressChange}
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            label="Phone"
            fullWidth
            value={newContactPhone}
            onChange={handleContactPhoneChange}
            variant="standard"
          />
          <TextField
            margin="dense"
            label="Email"
            fullWidth
            value={newContactEmail}
            onChange={handleContactEmailChange}
            variant="standard"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleClickOK}>
            {dialogForEdit ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={confirmDOpen}
        onClose={handleCloseDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Confirm"}
        </DialogTitle>
        <DialogContent>

          <DialogContentText
          >
            {`Do you really want to delete ${deleteInfo}`}
          </DialogContentText>


        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={execDelete}>
            {"Delete"}
          </Button>
        </DialogActions>
      </Dialog>
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
  );
}
