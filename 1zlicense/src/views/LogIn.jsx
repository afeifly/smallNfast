import React, { useState } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import Snackbar from '@mui/material/Snackbar';
import './css/style.css'


export default function Login(props) {

  const [errOpen, setErrOpen] = useState(false);
  //TODO will back
  const [user, setUser] = useState('');
  const [psw, setPsw] = useState('');


  function inputUserName(event) {
    setUser(event.target.value);
  }

  function inputPassword(event) {
    setPsw(event.target.value);
  }

  function handleErrClose() {
    setErrOpen(false);
  }
  function tryLogin(e) {
    if (e.keyCode === 13) {
      doLogin();
    }
  }
  function doLogin() {
    fetch('/api/loginx?user=' + user + '&psw=' + psw)
      // fetch('/api/loginx?user=ethan&psw=xuffei')
      .then(data => {
        if (data.status === 200) {
          props.onLogIn(user);
        } else {
          setErrOpen(true);
        }
      })
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
        <FormControl className="width-250">
          <TextField
            label="Username"
            onChange={inputUserName}
            margin="normal"
          />
        </FormControl>
        <FormControl className="width-250">
          <TextField
            label="Password"
            autoComplete="new-password"
            onChange={inputPassword}
            onKeyDown={tryLogin}
            type="password"
            margin="normal"
          />
        </FormControl>


        <FormControl >
          <Button variant="contained" color="primary" className="base-margin"
            onClick={doLogin}
          >
            Login
          </Button>
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
        message={<span id="message-id">Username or password err.</span>}
      />
    </div>
  )
}