import React, { useState } from 'react';
import TextField from '@mui/material/TextField';
import Input from '@mui/material/Input';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import Snackbar from '@mui/material/Snackbar';
import { Typography } from '@mui/material';
import MaskedInput from 'react-maskedinput'
import axios from 'axios';

export default function Offline(props) {


    const [localID, setLocalID] = useState("");
    const [sn, setSN] = useState("");
    const [company, setCompany] = useState("");
    const [user, setUser] = useState("");
    const [email, setEmail] = useState("");
    const [addr, setAddr] = useState("");
    const [errMsg, setErrMsg] = useState("");
    const [errOpen, setErrOpen] = useState(false);

    document.body.style.backgroundColor = "#81d4fa";



    function handleSNChange(e) {
        setSN(e.target.value);
    }
    function handleCompanyChange(e) {
        setCompany(e.target.value);
    }
    function handleUserChange(e) {
        setUser(e.target.value);
    }
    function handleEmailChange(e) {
        setEmail(e.target.value);
    }
    function handleAddrChange(e) {
        setAddr(e.target.value);
    }

    function handleLocalIDChange(e) {
        setLocalID(e.target.value);
    }
    function validateEmail(email) {
        var re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).trim().toLowerCase());
    }
    function handleActive() {
        console.log(company + "-" + user + "-" + email + "-" + addr)
        // console.
        if (!validateEmail(email)) {
            setErrOpen(true);
            setErrMsg("Email validate fail.");
            return;
        }
        if (sn.length !== 19
            || localID.length !== 19
            || company.length < 1
            || user.length < 1
            || !validateEmail(email)
        ) {
            setErrOpen(true);
            setErrMsg("Input error,please check & try again.");
        } else {

            axios.post("/registration", {
                localid: localID,
                sn: sn,
                email: email.trim(),
                company: company,
                user: user,
                addr: addr,

            })
                .then(response => {

                    if (response.status === 200) {
                        var a = document.createElement('a');
                        var blob = new Blob([response.data.text], { type: "octet/stream" });
                        a.href = window.URL.createObjectURL(blob);
                        a.download = "license.ls";
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                    } else {
                        setErrOpen(true);
                        console.log(response.data.err);
                        setErrMsg(response.data.err.toString());
                        //     // setErrMsg("dddsdd");
                    }
                    //     console.log(response.status);  
                    //   console.log(response.data.err);
                })
                .catch(error => {
                    console.log(error);
                    setErrOpen(true);
                    setErrMsg(error)
                });

        }


    }

    function handleErrClose() {
        setErrOpen(false);
    }


    return (
        <Grid
            container
            direction="column"
            justifyContent="flex-start"
            alignItems="center"
            className="margin-top-30"
        >
            <Typography variant="h4">Offline Registration</Typography>
            <div className="card-number-input width-500">
                <div className="width-160">LocalID:</div>
                <MaskedInput
                    mask="WWWW-WWWW-WWWW-WWWW"
                    size="19"
                    className="width-300"
                    formatCharacters={{
                        'W': {
                            validate(char) { return /\w/.test(char) },
                            transform(char) { return char.toUpperCase() }
                        }
                    }}
                    onChange={handleLocalIDChange}
                    placeholderChar={'\u2000'}

                />
            </div>

            <div className="card-number-input width-500">
                <div className="width-160">Serial Number:</div>

                <MaskedInput
                    mask="1111-1111-1111-1111"
                    size="19"
                    className="width-300"
                    formatCharacters={{
                        'W': {
                            validate(char) { return /\w/.test(char) },
                            transform(char) { return char.toUpperCase() }
                        }
                    }}
                    placeholderChar={'\u2000'}
                    onChange={handleSNChange}
                />
            </div>

            <div className="card-number-input width-500">
                <div className="width-160">Company:</div>
                <Input size="20"
                    className="width-300"
                    onChange={handleCompanyChange}
                />
            </div>
            <div className="card-number-input width-500">
                <div className="width-160">User Name:</div>
                <Input size="20"
                    className="width-300"
                    onChange={handleUserChange}
                />
            </div>
            <div className="card-number-input width-500">
                <div className="width-160">Email:</div>
                <Input size="20"
                    className="width-300"
                    onChange={handleEmailChange}
                />
            </div>
            <div className="card-number-input width-500">
                <div className="width-160">Addr:</div>


                <TextField
                    // label="Company Addr."
                    onChange={handleAddrChange}
                    margin="normal"
                    multiline
                    className="width-300 "
                    maxRows={3}
                />

            </div>

            <FormControl >
                <Button variant="contained" color="primary" className="base-margin"
                    onClick={handleActive}
                >
                    Generate License Key
                </Button>
            </FormControl>
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
                open={errOpen}
                autoHideDuration={6000}
                onClose={handleErrClose}
                ContentProps={{
                    'aria-describedby': 'message-id',
                }}
                message={<span id="message-id">{errMsg}</span>}
            />
        </Grid>)
}