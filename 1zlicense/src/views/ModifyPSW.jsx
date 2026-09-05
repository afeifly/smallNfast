import React, { useState } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import Snackbar from '@mui/material/Snackbar';
import './css/style.css'


export default function ModifyPsw(props) {


  const [errMsg, setErrMsg] = useState();
  const [errOpen, setErrOpen] = useState(false);
  var oldpsw;
  var newpsw1;
  var newpsw2;

  function inputOldPsw(event) {
    oldpsw = event.target.value;
  }

  function inputNewPsw1(event) {
    newpsw1 = event.target.value;
  }
  function inputNewPsw2(event) {
    newpsw2 = event.target.value;
  }
  function handleErrClose() {
    setErrOpen(false);
  }
  function tryModify(e) {

    if (e.keyCode === 13) {
      handleModify();
    }

  }
  function handleModify() {
    if (newpsw1 !== newpsw2 || newpsw1 === undefined || oldpsw === undefined) {
      setErrMsg('Input err or password not match in twice input.')
      setErrOpen(true);
      return;
    } else {
      props.doModify(oldpsw, newpsw1);
    }
  }
  function handleCancel() {
    props.showPage(1);
  }

  return (
    <div>
      <Grid
        container
        direction="column"
        justifyContent="flex-start"
        alignItems="center"
        className="m-top-60"
      >
        <FormControl className="fix-width-40">
          <TextField
            label="Old Password"
            type="password"
            autoComplete="new-password"
            onChange={inputOldPsw}
            margin="normal"
          />
        </FormControl>
        <FormControl className="fix-width-40">
          <TextField
            label="New Password"
            onChange={inputNewPsw1}
            type="password"
            margin="normal"
          />
        </FormControl>

        <FormControl className="fix-width-40">
          <TextField
            label="Confirm Password"
            onChange={inputNewPsw2}
            onKeyDown={tryModify}
            type="password"
            margin="normal"
          />
        </FormControl>

        <FormControl >
          <Grid
            container
            direction="row"
            justifyContent="center"
            alignItems="center"
          >
            <Button variant="contained" color="primary" className="base-margin"
              onClick={handleModify}
            >
              Modify
            </Button>
            <Button variant="contained" className="base-margin"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </Grid>
        </FormControl>


      </Grid>
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
    </div>
  )
}