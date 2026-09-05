import React, { useState, useEffect, useCallback } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Snackbar from '@mui/material/Snackbar';
import TableSortLabel from '@mui/material/TableSortLabel';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import NativeSelect from '@mui/material/NativeSelect';
import Typography from '@mui/material/Typography';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import Tooltip from '@mui/material/Tooltip';
import FormControl from '@mui/material/FormControl';
import TablePagination from '@mui/material/TablePagination';
import InputLabel from '@mui/material/InputLabel';
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';


import { Grid } from '@mui/material';
import { useLocation } from 'react-router-dom';


import TopBar from '../Bar/TopBar';
import API from '../../common/api';
import * as Constant from '../../common/Constant';
import Cookies from 'js-cookie';


export default function Sensor(props) {

    const defaultValuePerPage = 10
    const valuesPerPage = [defaultValuePerPage, 50, 200];
    const [totalRows, setTotalRows] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(defaultValuePerPage);
    const [page, setPage] = useState(0);

    const location = useLocation();
    const [rows, setRows] = useState();
    const [searchYear, setSearchYear] = useState(0);
    const [avaiableYears, setAvaiableYears] = useState(null);
    const [companyName, setCompanyName] = useState(null);
    const [companyId, setCompanyId] = useState(null);
    const [sortDirection, setSortDirection] = useState('desc');
    const [addSensorOpen, setAddSensorOpen] = useState(false);
    const [newSN, setNewSN] = useState('');
    const [newSNMFDate, setNewSNMFDate] = useState(new Date());
    const [newNumbersOfSN, setNewNumbersOfSN] = useState(1);

    const [confirmDOpen, setConfirmDOpen] = useState(false);
    const [deleteInfo, setDeleteInfo] = useState(null);
    const [deleteKey, setDeleteKey] = useState(null);

    const [errOpen, setErrOpen] = useState(false);
    const [errMsg, setErrMsg] = useState("Err");

    const checkState = useCallback(() => {
        if (location.state.searchFor === Constant.SENSOR_SEARCH_BY_SN) {

            API.get(`sensor/${location.state.searchKey}`)
                .then(res => {
                    setCompanyId(res.data.companyId);
                    setCompanyName(res.data.companyName);
                    setRows(res.data.rows);
                }).catch(() => {
                });
        } else {
            //get Total rows for a company
            loadForCompany(location.state.searchKey, null, 0, rowsPerPage, sortDirection);
        }
        //fetch years option for a company
        if (location.state.searchFor === Constant.SENSOR_SEARCH_BY_COMPANY) {
            API.get(`sensor/companyyear/${location.state.searchKey}`)
                .then(res => {
                    let tmpY = []
                    res.data.map((item) => (
                        tmpY.push(item.year)
                    ));
                    setAvaiableYears(tmpY);

                }).catch(() => {
                });
        } else {
        }
    }, []);
    useEffect(() => {
        checkState();
    }, [checkState]);


    function handleErrClose() {
        setErrOpen(false);
    }
    function handleCloseDialog() {
        setConfirmDOpen(false);
    }
    function handleDelete(sn) {
        setConfirmDOpen(true);
        setDeleteInfo(sn);
        setDeleteKey(sn);
    }
    function handleDeleteConfirm() {
        console.log(deleteKey);
        //TODO delte 
        API.delete(`sensor/${deleteKey}`).then(res => {
            handleCloseDialog();
            //refresh
            loadForCompany(companyId, searchYear, 0, rowsPerPage, sortDirection);
        }).catch(() => {
        })
    }
    const handleChangePage = (event, value) => {
        setPage(value);
        loadForCompany(companyId, searchYear, (value * rowsPerPage), rowsPerPage, sortDirection);
    };
    function handleChangeRowsPerPage(event) {
        const newValuesPerPage = event.target.value;
        setRowsPerPage(newValuesPerPage)
        setPage(0);
        loadForCompany(companyId, searchYear, 0, newValuesPerPage, sortDirection);
    }

    function handleSort(event) {
        var tmpDirection;
        if (sortDirection === 'asc') {
            tmpDirection = 'desc';
        } else {
            tmpDirection = 'asc';
        }
        setSortDirection(tmpDirection);
        setPage(0);
        loadForCompany(companyId, searchYear, 0, rowsPerPage, tmpDirection);
    }

    function handleExportClick() {
        loadForCompany(companyId, searchYear, 0, rowsPerPage, sortDirection, true);
    }
    function handleSearchYearChange(event) {
        setSearchYear(event.target.value);
    }
    function handleAddSensorClick() {
        setAddSensorOpen(true);
    }
    function handleNewSNChange(event) {
        setNewSN(event.target.value)
    }
    function handleNewNumbersOfSNChange(event) {
        setNewNumbersOfSN(event.target.value)
    }
    function handleNewSNMFDateChange(value) {
        setNewSNMFDate(value);
    }



    function query4SN(sensorId) {
        location.state.searchFor = 0;
        location.state.searchKey = sensorId;
        checkState();
        setSearchYear(0);

    }
    function query4Company(id, name) {
        location.state.searchFor = 1;
        location.state.searchKey = id;
        checkState();
        setSearchYear(0);
    }
    function handleSearchClick(event) {
        setPage(0);
        loadForCompany(companyId, searchYear, 0, rowsPerPage, sortDirection);
    }
    function handleAddSensorClose() {
        setAddSensorOpen(false);
    }
    function handleOKConfirm() {
        if (isNaN(newSN) || newSN.length !== 8) {
            setErrMsg("SN should be a 8 bit number.");
            setErrOpen(true);
            return;
        } if (isNaN(newNumbersOfSN) || newNumbersOfSN > 100 || newNumbersOfSN < 1) {
            setErrMsg("Number of SN should between 1 ~ 100");
            setErrOpen(true);
            return;
        } else {
            API.post(`sensor`,
                {
                    sn: newSN,
                    companyId: companyId,
                    numberofsn: newNumbersOfSN,
                    manufacturingDate: newSNMFDate
                })
                .then(res => {
                    loadForCompany(companyId, searchYear, 0, rowsPerPage, sortDirection);
                }).catch((error) => {
                    if (error.response) {
                        setErrMsg(error.response.data.message);
                        setErrOpen(true);
                    }
                });

            setAddSensorOpen(false);
        }
    }


    function loadForCompany(companyId, year, offset, limit, direction, needexport) {

        console.log(`load company by c:${companyId} y:${year} o:${offset} l:${limit} d:${direction}`);
        let responseType;
        if (needexport) {
            responseType = 'blob';
        } else {
            responseType = 'json';
        }
        API.post(`sensor/bycompany`,
            {
                companyId: companyId,
                year: year,
                offset: offset,
                limit: limit,
                orderby: 'manufacturingDate',
                direction: direction,
                needexport: needexport,
            }, { responseType: responseType })
            .then(res => {
                if (needexport) {
                    const url = window.URL.createObjectURL(new Blob([res.data],
                        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download',
                        res.headers["content-disposition"].split("filename=")[1]);
                    document.body.appendChild(link);
                    link.click();
                } else {
                    console.log(res.data);
                    setCompanyId(res.data.companyId);
                    setCompanyName(res.data.companyName);
                    setTotalRows(res.data.count);
                    setRows(res.data.rows);
                }

            }).catch(() => {
            });

    }


    return (
        <Paper >
            <TopBar
                query4Company={query4Company}
                query4SN={query4SN}
            />
            <Grid container spacing={3}>
                <Grid item xs={6}>
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
                            <Typography color="text.primary">{rows && rows.length > 0 ? `(${companyName}) Sensor` : "Sensor"}</Typography>
                        </Breadcrumbs>
                    </Grid>
                </Grid>
                <Grid item xs={6}>

                    {(location.state.searchFor === Constant.SENSOR_SEARCH_BY_COMPANY) &&
                        <Grid
                            item
                            container
                            direction="row"
                            justifyContent="flex-end"
                            alignItems="center"
                        >


                            <FormControl
                                sx={{ width: "180px" }}
                            >
                                <InputLabel variant="standard"
                                    shrink={true}
                                    value={searchYear}
                                    htmlFor="uncontrolled-native">
                                    {'Manufactureing Year'}
                                </InputLabel>
                                <NativeSelect
                                    value={searchYear}
                                    onChange={handleSearchYearChange}
                                >
                                    <option key={0} value={0}>{"-- Select Year --"}</option>
                                    {avaiableYears &&
                                        avaiableYears.map((data) =>
                                            <option key={data} value={data}>{data}</option>

                                        )}
                                </NativeSelect>
                            </FormControl>





                            <IconButton
                                onClick={handleSearchClick}
                                type="submit" sx={{ marginTop: "15px", marginRight: "15px" }} aria-label="search">
                                <SearchIcon
                                />
                            </IconButton>
                        </Grid>}
                </Grid>
            </Grid>








            <Table
                sx={{ marginBottom: "0px" }}
            >
                <TableHead>
                    <TableRow key="xxx">
                        <TableCell align="center">SN</TableCell>
                        <TableCell align="left" sortDirection={sortDirection}>
                            <TableSortLabel
                                active={true}
                                direction={sortDirection}
                                onClick={handleSort}
                            // direction={'asc'}
                            >

                                Manufactureing Date
                                {/* {orderBy === headCell.id ? (
                <Box component="span" sx={visuallyHidden}>
                  {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                </Box>
              ) : null} */}
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="left">Last Calibration Date</TableCell>
                        <TableCell align="left">Last Upload Date</TableCell>
                        <TableCell align="left">Last Upload By</TableCell>

                        {
                            (Cookies.get(Constant.COOKIE_ROLE) === "1") &&
                            <TableCell align="left">Action</TableCell>
                        }
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows && rows.map(row => (
                        <TableRow key={row.sn}
                        >

                            <TableCell align="center" key={row.sn}>{row.sn}</TableCell>
                            <TableCell align="left">
                                {row.manufacturingDate ? row.manufacturingDate.slice(0, 10) : ''}
                            </TableCell>
                            <TableCell align="left">
                                {row.lastCalibrationDate ? row.lastCalibrationDate.slice(0, 10) : ''}
                            </TableCell>
                            <TableCell align="left">
                                {row.config ? row.config.lastUploadDate.slice(0, 10) : ""}
                            </TableCell>
                            <TableCell align="left">
                                {`${row.config ? row.config.customer.username : ''}`}
                            </TableCell>

                            {
                                (Cookies.get(Constant.COOKIE_ROLE) === "1") &&
                                <TableCell align="left">
                                    <Tooltip title="Delete Sensor">
                                        <IconButton
                                            onClick={() => handleDelete(row.sn)}
                                        >
                                            <DeleteOutlineIcon />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            }

                        </TableRow>
                    ))}

                </TableBody>

            </Table>
            {(location.state.searchFor === Constant.SENSOR_SEARCH_BY_COMPANY) &&
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
            }

            <Tooltip title="Export sensors to Excel">
                <Fab
                    onClick={handleExportClick}
                    sx={{
                        position: "fixed",
                        bottom: (theme) => theme.spacing(2),
                        right: (theme) => theme.spacing(10)
                    }}
                >
                    <SaveAltIcon />
                </Fab>
            </Tooltip>
            <Tooltip title="Add sensor">
                <Fab

                    onClick={handleAddSensorClick}
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
            <Dialog
                open={addSensorOpen}
                onClose={handleAddSensorClose}
                // sx={{width: "280px"}}
                maxWidth={'xs'}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {'Add sensor'}
                </DialogTitle>
                <DialogContent>

                    <TextField
                        margin="dense"
                        value={newSN}
                        onChange={handleNewSNChange}
                        label="Start SN"
                        fullWidth
                        variant="standard"
                    />
                    <TextField
                        margin="dense"
                        value={newNumbersOfSN}
                        onChange={handleNewNumbersOfSNChange}
                        label="Number of sensor"
                        fullWidth
                        variant="standard"
                    />
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DesktopDatePicker
                            margin="dense"
                            fullWidth
                            label="Manufactureing date"
                            inputFormat="MM/dd/yyyy"
                            value={newSNMFDate}
                            onChange={handleNewSNMFDateChange}
                            renderInput={(params) =>
                                <TextField
                                    margin='dense'
                                    variant="standard"
                                    {...params}

                                />}
                        />
                    </LocalizationProvider>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleAddSensorClose}>Cancel</Button>
                    <Button onClick={handleOKConfirm}>
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
