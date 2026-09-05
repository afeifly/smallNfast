import React, { useState } from 'react';

import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Grid from '@mui/material/Grid';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import axios from 'axios';
import Typography from '@mui/material/Typography';
import { Button, Dialog, DialogContent, DialogTitle, DialogActions, DialogContentText } from '@mui/material';
import * as Constant from '../utils/Constant';
import './css/style.css'

export default function CreateSN(props) {

    const [snType, setSNType] = useState("0");
    const [note, setNote] = useState();
    const [swType, setSwType] = useState(2);
    const [snOpen, setSNOpen] = useState(false);
    const [sn, setSN] = useState();
    const [maxChs, setMaxChs] = useState(20);
    const [reportEnable, setReportEnable] = useState(false);
    const [s4mWork, setS4mWork] = useState(false);
    const [lmsMaxUsers, setLMSMaxUsers] = useState(10);
    const [lmsInstallType, setLMSInstallType] = useState(0);
    const [lmsExpireYears, setLMSExpireYears] = useState(1);
    const [lmsWork, setLMSWork] = useState(false);
    const [lmsTrial, setLMSTrial] = useState(false);
    const [errOpen, setErrOpen] = useState(false);
    const [errMsg, setErrMsg] = useState("Err");
    const [s4cusWork, setS4CUSWork] = useState(false);
    const [s4cusLicenseType, setS4CUSLicenseType] = useState(0);
    const [s4cusCompany, setS4CUSCompany] = useState('');




    function handleTypeChange(event) {
        setLMSTrial(false);
        setSNType(event.target.value);
        if (swType === Constant.SOFTWARE_TYPE_LMS) {
            if (event.target.value === 1) {
                setLMSTrial(true);
            }
        }
    }
    function handleClose() {
        setSNOpen(false);
    }
    function handleMaxChs(event) {
        setMaxChs(event.target.value)
    }
    function handleSWChange(event) {
        let type = event.target.value;
        setSwType(type)
        setS4mWork(false);
        setLMSWork(false)
        setLMSTrial(false);
        setS4CUSWork(false)
        if (type === Constant.SOFTWARE_TYPE_S4M) {
            setS4mWork(true)
        } else if (type === Constant.SOFTWARE_TYPE_LMS) {
            setLMSWork(true)
        } else if (type === Constant.SOFTWARE_TYPE_S4CUS) {
            setS4CUSWork(true)
        }

    }

    function handleNoteChange(event) {
        setNote(event.target.value)
    }
    function handleLMSMaxUsersChange(event) {
        setLMSMaxUsers(event.target.value)
    }
    function handlelmsInstallTypeChange(event) {
        setLMSInstallType(event.target.value)
    }
    function handleLMSExpireYearsChange(event) {
        setLMSExpireYears(event.target.value)
    }
    function handleErrClose() {
        setErrOpen(false)
    }
    function handleReportChange(event) {
        setReportEnable(event.target.checked);
    }
    function handleS4CUSTypeChange(event) {
        setS4CUSLicenseType(event.target.value);
    }
    function handleS4CUSCompanyChange(event) {
        setS4CUSCompany(event.target.value)
    }
    function handleCreate(event) {
        event.stopPropagation();
        if (note === undefined) {
            //props.showErr("Begging for leaving some notes to us.  -- Ethan Xu")
            setErrMsg("Begging for leaving some notes to us.  -- Ethan Xu")
            setErrOpen(true)
            return
        } else {
            var properties;
            if (swType === Constant.SOFTWARE_TYPE_S4M) {
                properties = {
                    maxChs: maxChs,
                    report: reportEnable
                }
            } else if (swType === Constant.SOFTWARE_TYPE_LMS) {
                properties = {
                    lmsExpireYears: lmsExpireYears,
                    lmsInstallType: lmsInstallType,
                    lmsMaxUsers: lmsMaxUsers,
                }
            } else if (swType === Constant.SOFTWARE_TYPE_S4CUS) {
                if (s4cusCompany === undefined || s4cusCompany === '') {
                    setErrMsg("Please input company information");
                    setErrOpen(true)
                    return
                }

                axios.post("/api/s4cuslicenses", {
                    sntype: s4cusLicenseType,
                    company: s4cusCompany,
                    note: note,
                }).then(response => {
                    if (response.data.license !== undefined) {
                        setSNOpen(true);
                        setSN(response.data.license);
                    }
                })
                    .catch(error => {
                        console.log(error);
                    });
                return
            }

            axios.post("/api/licenses", {
                max: 1,
                note: note,
                pid: swType,
                trial: snType,
                properties: properties,
            })
                .then(response => {
                    //show sn just create.  
                    if (response.data.license !== undefined) {
                        setSNOpen(true);
                        setSN(response.data.license);
                    }
                })
                .catch(error => {
                    console.log(error);
                });
        }
    }
    return (
        <Grid
            container
            direction="column"
            justifyContent="flex-start"
            alignItems="center"
            className="m-top-60"
        >
            <Typography variant="h4" gutterBottom>
                Create License
            </Typography>
            <FormControl className="fix-width-40">
                <InputLabel id="product-label">Product</InputLabel>
                <Select
                    labelId="product-label"
                    label="Product"
                    onChange={handleSWChange}
                    value={swType}
                >
                    {/* <MenuItem value={1}>S4A</MenuItem> */}
                    <MenuItem value={Constant.SOFTWARE_TYPE_CAA}>CAA</MenuItem>
                    <MenuItem value={Constant.SOFTWARE_TYPE_S4M}>S4M</MenuItem>
                    <MenuItem value={Constant.SOFTWARE_TYPE_LMS}>LMS-cloud</MenuItem>
                    <MenuItem value={Constant.SOFTWARE_TYPE_LMS_lite}>LMS</MenuItem>
                    <MenuItem value={Constant.SOFTWARE_TYPE_S4CUS}>S4C-US</MenuItem>
                </Select>
            </FormControl>

            <FormControl
                className={s4cusWork ? 'hidden' : 'fix-width-40'}
            >
                <RadioGroup aria-label="position" name="position"
                    value={snType}
                    onChange={handleTypeChange} row>
                    <FormControlLabel
                        value="0"
                        control={<Radio color="primary" />}
                        label="Normal"
                        labelPlacement="end"
                    />
                    <FormControlLabel
                        value="1"
                        control={<Radio color="primary" />}
                        label="Trial"
                        labelPlacement="end"
                    />
                </RadioGroup>
            </FormControl>
            <Grid
                container
                direction="column"
                justifyContent="flex-start"
                alignItems="center"
                className={s4mWork ? '' : 'hidden'}
            >
                <FormControl className="fix-width-40">
                    <InputLabel id="max-chs-label">Max Channels</InputLabel>
                    <Select
                        labelId="max-chs-label"
                        label="Max Channels"
                        onChange={handleMaxChs}
                        value={maxChs}
                    >
                        <MenuItem value={20}>20</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                        <MenuItem value={0}>unlimited</MenuItem>
                    </Select>
                </FormControl>
                <FormControl
                    className="fix-width-40"
                >
                    <FormControlLabel
                        value="start"
                        control={<Switch color="primary"
                            onChange={handleReportChange}
                            checked={reportEnable} />}
                        label="Report"
                        labelPlacement="end"
                    />
                </FormControl>
            </Grid>
            <Grid
                container
                direction="column"
                justifyContent="flex-start"
                alignItems="center"
                className={lmsWork ? '' : 'hidden'}
            >
                <FormControl className="fix-width-40">
                    <TextField
                        label="Max users"
                        value={lmsMaxUsers}
                        onChange={handleLMSMaxUsersChange}
                        margin="normal"
                    />
                </FormControl>


                <FormControl className="fix-width-40">
                    <RadioGroup aria-label="position" name="position"
                        value={lmsInstallType.toString()}
                        onChange={handlelmsInstallTypeChange} row>
                        <FormControlLabel
                            value="0"
                            control={<Radio color="primary" />}
                            label="Local version"
                            labelPlacement="end"
                        />
                        <FormControlLabel
                            value="1"
                            control={<Radio color="primary" />}
                            label="Cloud version"
                            labelPlacement="end"
                        />
                    </RadioGroup>
                </FormControl>
                <div className={lmsTrial ? "hidden" : ""}>
                    <FormControl className='fix-width-40'>
                        <InputLabel id="expiration-label">Expiration date</InputLabel>
                        <Select
                            labelId="expiration-label"
                            label="Expiration date"
                            onChange={handleLMSExpireYearsChange}
                            value={lmsExpireYears}
                        >
                            <MenuItem value={1}>1 year</MenuItem>
                            <MenuItem value={2}>2 years</MenuItem>
                            <MenuItem value={3}>3 years</MenuItem>
                        </Select>
                    </FormControl>
                </div>
            </Grid>
            <Grid
                container
                direction="column"
                justifyContent="flex-start"
                alignItems="center"
                className={s4cusWork ? '' : 'hidden'}
            >

                <FormControl className="fix-width-40">
                    <RadioGroup aria-label="position" name="position"
                        value={s4cusLicenseType.toString()}
                        onChange={handleS4CUSTypeChange} row>
                        <FormControlLabel
                            value="0"
                            control={<Radio color="primary" />}
                            label="Service Partner"
                            labelPlacement="end"
                        />
                        <FormControlLabel
                            value="1"
                            control={<Radio color="primary" />}
                            label="Calibration"
                            labelPlacement="end"
                        />
                    </RadioGroup>
                </FormControl>
                <FormControl className="fix-width-40">
                    <TextField
                        label="Company"
                        multiline
                        maxRows={1}
                        onChange={handleS4CUSCompanyChange}
                        margin="normal"
                    />
                </FormControl>

            </Grid>

            <FormControl className="fix-width-40">
                <TextField
                    label="Note"
                    multiline
                    maxRows={3}
                    onChange={handleNoteChange}
                    margin="normal"
                />
            </FormControl>
            <FormControl className="width-160">
                <Button variant="contained" color="primary"
                    onClick={handleCreate}
                >
                    Create
                </Button>
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
            </FormControl>
            <Dialog
                open={snOpen}
                onClose={handleClose}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">Success</DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        Get a License <span className="sn-color">{sn}</span>
                    </DialogContentText>
                </DialogContent>
                <DialogActions>

                    <Button onClick={handleClose} color="primary" autoFocus>
                        OK
                    </Button>
                </DialogActions>
            </Dialog>
        </Grid >


    )
}
