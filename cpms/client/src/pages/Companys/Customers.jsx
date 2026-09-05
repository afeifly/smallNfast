import React, { useState, useEffect } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Fab from '@mui/material/Fab';
import { useNavigate } from "react-router-dom"
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Tooltip from '@mui/material/Tooltip';
import { Grid } from '@mui/material';
import { useLocation } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TablePagination from '@mui/material/TablePagination';

import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';


import TopBar from '../Bar/TopBar';
import API from '../../common/api';
import * as Constant from '../../common/Constant';
import MD5 from "crypto-js/md5";
import QRCode from 'qrcode.react'
import Cookies from 'js-cookie';


export default function Customers(props) {

    const DELETE_TYPE_CUSTOMER = 'customer';
    const DELETE_TYPE_LICCENSE = 'license';
    const defaultValuePerPage = 10;
    const valuesPerPage = [defaultValuePerPage, 50, 200];
    const [totalRows, setTotalRows] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(defaultValuePerPage);
    const [page, setPage] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const [rows, setRows] = useState([]);
    const [newUser, setNewUser] = useState('');
    const [editUserId, setEditUserId] = useState(null);
    const [licenseTypeValue, setLicenseTypeValue] = useState('S4C-FS');
    const [authTypeValue, setAuthTypeValue] = useState('calibrationuser');

    const [confirmDOpen, setConfirmDOpen] = useState(false);
    const [addUserOpen, setAddUserOpen] = useState(false);
    const [addLicenseOpen, setAddlicenseOpen] = useState(false);
    const [addLicenseForUserName, setAddlicenseForUser] = useState('');
    const [addLicenseForUserId, setAddlicenseForUserId] = useState('');

    const [showQRCodeOpen, setShowQRCodeOpen] = useState(false);
    const [qrCodeValue, setQRCodeValue] = useState('');
    const [qrLicense, setQRLicense] = useState('');
    const [deleteInfo, setDeleteInfo] = useState('');
    const [deleteKey, setDeleteKey] = useState(null);
    const [deleteType, setDeleteType] = useState('');



    const [dialogForEdit, setDialogForEdit] = useState(false);

    const companyId = location.state.companyId;
    const companyName = location.state.companyName;

    useEffect(() => {
        loadCustomer(0, rowsPerPage);
    }, []);
    function loadCustomer(offset, limit) {
        API.post(`customer/page`, {
            id: companyId,
            offset: offset,
            limit: limit
        })
            .then(res => {
                setTotalRows(res.data.count);
                setRows(res.data.rows);
                console.log(res.data);
            }).catch(() => {
            })
    }
    const handleChangePage = (event, value) => {
        setPage(value);
        loadCustomer(value * rowsPerPage, rowsPerPage);
    }
    function handleChangeLicenseTypeValue(event) {
        setLicenseTypeValue(event.target.value)
    }
    function handleChangeAuthTypeValue(event) {
        setAuthTypeValue(event.target.value)
    }

    function handleChangeRowsPerPage(event) {
        const newValuesPerPage = event.target.value;
        setRowsPerPage(newValuesPerPage)
        setPage(0);
        loadCustomer(0, newValuesPerPage);
    }

    function handleCloseDialog() {
        setAddUserOpen(false);
        setAddlicenseOpen(false);
        setShowQRCodeOpen(false);
        setConfirmDOpen(false);
    }

    function handleAddCustomerClick() {
        setAddUserOpen(true);

        setNewUser('');
        setEditUserId(null);
        setDialogForEdit(false);
    }
    function handleClickEditUser(user) {
        setDialogForEdit(true);
        setAddUserOpen(true);
        setNewUser(user.username);
        setEditUserId(user.id);

    }
    function handleUsernameChange(event) {
        setNewUser(event.target.value)
    }
    function handleOKConfirm() {

        if (dialogForEdit) {
            API.put(`customer`, {
                username: newUser,
                id: editUserId
            }).then(res => {
                handleCloseDialog();
                loadCustomer(page * rowsPerPage, rowsPerPage);
            }).catch(() => {
            })
        } else {
            API.post(`customer`, {
                username: newUser,
                companyId: location.state.companyId
            }).then(res => {
                handleCloseDialog();
                loadCustomer(page * rowsPerPage, rowsPerPage);
            }).catch(() => {
            })
        }
    }
    function handleAddLicenseOpen(customerId, customerName) {
        console.log('Add license for customer ' + customerId);
        setAddlicenseOpen(true);
        setAddlicenseForUser(customerName);
        setAddlicenseForUserId(customerId);
    }
    function handleAddLicense() {
        var includeStr;
        var excludeStr;
        var app;
        switch (licenseTypeValue) {
            case "S4C-FS":
                includeStr = '["FlowSensors"]';
                excludeStr = '["S431"]';
                app = 'S4C-FS';
                break;
            case "S431":
                includeStr = '["S431"]';
                excludeStr = '[]';
                app = 'S4C-FS';
                break;
            case "S4C-DP":
                includeStr = '["DewPointSensors"]';
                excludeStr = '[]';
                app = 'S4C-DP';
                break;
            case "S4C-WTU":
                includeStr = '["WTU"]';
                excludeStr = '[]';
                app = 'S4C-WTU';
                break;
	    case "FM20":
                includeStr = '["FM20"]';
                excludeStr = '[]';
                app = 'FM20';
                break;
	    case "S4C-APP":
                includeStr = '["S4C-APP"]';
                excludeStr = '[]';
                app = 'S4C-APP';
                break;
        }
        API.post(`license`, {
            include: includeStr,
            exclude: excludeStr,
            app: app,
            auth: authTypeValue,
            customerId: addLicenseForUserId
        }).then(res => {
            handleCloseDialog();
            loadCustomer(page * rowsPerPage, rowsPerPage);
        }).catch(() => {
        })

    }

    function handleLicenseClick(id) {
        console.log(MD5(`this_is_license_salt/${id}`).toString());
        setShowQRCodeOpen(true);
        const md5Value = MD5(`this_is_license_salt/${id}`).toString();
        setQRCodeValue(`license/${id}/${md5Value}`);
        setQRLicense(id);
    }
    function handleDownloadQRCode() {
        var canvas = document.getElementById("qr-canvas");
        var ctx = canvas.getContext('2d');

        ctx.font = "2px Arial";
        ctx.fillStyle = "black";
        ctx.fillText(qrLicense, 4, 39);


        var url = canvas.toDataURL("image/png");
        var link = document.createElement('a');
        link.download = `${qrLicense}.png`;
        link.href = url;
        link.click();
    }

    function handleLicenseDelete(id) {
        setDeleteInfo(`License ${id}`);
        setDeleteKey(id);
        setDeleteType(DELETE_TYPE_LICCENSE)
        setConfirmDOpen(true);
    }

    function handleDeleteConfirm() {
        if (deleteType === DELETE_TYPE_LICCENSE) {
            API.delete(`license/${deleteKey}`).then(res => {
                handleCloseDialog();
                loadCustomer(page * rowsPerPage, rowsPerPage);
            }).catch(() => {
            })
        }
        if (deleteType === DELETE_TYPE_CUSTOMER) {
            API.delete(`customer/${deleteKey}`).then(res => {
                handleCloseDialog();
                loadCustomer(page * rowsPerPage, rowsPerPage);
            }).catch(() => {
            })
        }

    }

    function handleClickDeleteUser(id, name) {
        setDeleteInfo(`customer ${name}`);
        setDeleteKey(id);
        setDeleteType(DELETE_TYPE_CUSTOMER)
        setConfirmDOpen(true);

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
                    <Link
                        underline="hover"
                        color="inherit"
                        href={Constant.HREF_SHARP + Constant.HREF_COMPANYS}
                    >
                        {`Company`}
                    </Link>
                    <Typography color="text.primary">{`(${companyName}) Customer`}</Typography>
                </Breadcrumbs>
                <Tooltip title="Add customer">
                    <Fab
                        onClick={handleAddCustomerClick}
                        sx={{
                            position: "fixed",
                            bottom: (theme) => theme.spacing(2),
                            right: (theme) => theme.spacing(2),
                            backgroundColor: "#ffdd22"
                        }}
                    >
                        <AddIcon />
                    </Fab>
                </Tooltip>


            </Grid>


            <Table
            >
                <TableHead>
                    <TableRow>
                        <TableCell align="center">Username</TableCell>
                        <TableCell align="left">Licenses</TableCell>
                        <TableCell align="center">Action</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map(row => (
                        <TableRow key={row.id}>

                            <TableCell align="center">

                                {row.username}
                            </TableCell>
                            <TableCell align="left">
                                {/* {row.licenses[0].id} */}
                                {row.licenses && row.licenses.map(lic => (
                                    <Tooltip
                                        key={lic.id}
                                        title={`sensor: ${lic.sensorlist}, exclude: ${lic.excludesensorlist}, authorization: ${lic.auth}`} >
                                        <Chip
                                            key={lic.id}
                                            label={lic.id}
                                            variant="outlined"
                                            sx={{ marginRight: "5px" }}
                                            onClick={() => handleLicenseClick(
                                                lic.id,
                                                lic.sensorList,
                                                lic.excludesensorList
                                            )}
                                            onDelete={() => handleLicenseDelete(lic.id)}
                                        /></Tooltip>
                                ))}

                            </TableCell>
                            <TableCell align="center">
                                <Tooltip title="Add License">
                                    <IconButton
                                        onClick={() => handleAddLicenseOpen(row.id, row.username)}
                                    >
                                        <AddIcon />
                                    </IconButton>
                                </Tooltip>

                                <Tooltip title="Modify ">
                                    <IconButton
                                        onClick={() => handleClickEditUser(row)}
                                    >
                                        <EditIcon />
                                    </IconButton>
                                </Tooltip>
                                {
                                    (Cookies.get(Constant.COOKIE_ROLE) === "1") &&
                                    <Tooltip title="Delete customer">
                                        <IconButton
                                            onClick={() => handleClickDeleteUser(row.id, row.username)}
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
            <Dialog
                open={showQRCodeOpen}
                onClose={handleCloseDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {'License QR-code'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText
                        sx={{ textAlign: "center" }}
                    >
                        {qrLicense}
                    </DialogContentText>
                    <br></br>
                    <QRCode
                        id="qr-canvas"
                        value={qrCodeValue}  //value参数为生成二维码的链接
                        size={200} //二维码的宽高尺寸
                        fgColor="#000000"  //二维码的颜色
                        includeMargin={true}
                    />

                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button onClick={handleDownloadQRCode}>
                        {'Download'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={addUserOpen}
                onClose={handleCloseDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {dialogForEdit ? 'Update user' : 'Create user'}
                </DialogTitle>
                <DialogContent>

                    <TextField
                        margin="dense"
                        id="contact"
                        value={newUser}
                        onChange={handleUsernameChange}
                        label="User name"
                        fullWidth
                        variant="standard"
                    />

                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button onClick={handleOKConfirm}>
                        {dialogForEdit ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={addLicenseOpen}
                onClose={handleCloseDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {`Add license for customer ${addLicenseForUserName}`}
                </DialogTitle>
                <DialogContent>
                    <FormControl>
                        <FormLabel id="demo-controlled-radio-buttons-group">License type</FormLabel>
                        <RadioGroup
                            aria-labelledby="demo-controlled-radio-buttons-group"
                            name="controlled-radio-buttons-group"
                            value={licenseTypeValue}
                            onChange={handleChangeLicenseTypeValue}
                        >
                            <FormControlLabel value="S4C-FS" control={<Radio />} label="S4C-FS (exclude S431)" />
                            <FormControlLabel value="S431" control={<Radio />} label="S431" />
                            <FormControlLabel value="S4C-DP" control={<Radio />} label="S4C-DP" />
                            <FormControlLabel value="S4C-WTU" control={<Radio />} label="S4C-WTU" />
                            <FormControlLabel value="FM20" control={<Radio />} label="FM20" />
                            <FormControlLabel value="S4C-APP" control={<Radio />} label="S4C-APP" />
                        </RadioGroup>
                    </FormControl>
                    <br />
                    <FormControl>
                        <FormLabel id="demo-controlled-radio-buttons-group">Authorization</FormLabel>
                        <RadioGroup
                            aria-labelledby="demo-controlled-radio-buttons-group"
                            name="controlled-radio-buttons-group"
                            value={authTypeValue}
                            onChange={handleChangeAuthTypeValue}
                        >
                            <FormControlLabel value="superuser" control={<Radio />} label="superuser" />
                            {(licenseTypeValue !== "S4C-WTU" && licenseTypeValue !== "FM20" )  && (
                                <FormControlLabel value="calibrationuser" control={<Radio />} label="calibrationuser" />
                            )}
                        </RadioGroup>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button onClick={handleAddLicense}>
                        {'Create'}
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
                    <Button onClick={handleDeleteConfirm}>
                        {"Delete"}
                    </Button>
                </DialogActions>
            </Dialog>

        </Paper>
    );
}
