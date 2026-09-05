import React, { useState } from "react";

import { useNavigate } from "react-router-dom"
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { Grid } from "@mui/material";
import Cookies from 'js-cookie';

import Snackbar from '@mui/material/Snackbar';
import TopBar from '../Bar/TopBar';
import API from '../../common/api';
import * as Constant from '../../common/Constant';

function Login() {
  const navigate = useNavigate();
  // React States
  // const [errorMessages, setErrorMessages] = useState({});
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");

  
  const [errOpen, setErrOpen] = React.useState(false);
  const [errMsg, setErrMsg] = React.useState('');

  function handleErrClose(){
    setErrOpen(false);
  }
  function handleUsernameChange(e){
    setUsername(e.target.value);
  }
  function handlePasswordChange(e){
    setPassword(e.target.value);
  }


  function onLogin() {
    API.get(`login?username=${username}&password=${password}`)
      .then(res => {
        Cookies.set(Constant.COOKIE_USERNAME, username);
        Cookies.set(Constant.COOKIE_TOKEN, res.data.token);
        Cookies.set(Constant.COOKIE_ROLE, res.data.role);
        API.interceptors.request.use(
          config => {
            config.headers["auth-token"] = res.data.token;
            return config;
          },
          error => {
            Promise.reject(error);
          }
        );
        navigate(Constant.HREF_COMPANYS);
      }).catch(()=>{
        setErrMsg('Login fail. check your usename or passord.');
        setErrOpen(true);
      })
  }

  return (

    <Paper
      sx={{ height: "100vh"  }}
    >
      <TopBar />
      <Grid
        sx={{ marginTop: "60px" }}
        container
        direction="column"
        justifyContent="center"
        alignItems="center"
        spacing={8}

      >

        <TextField
          required
          id="standard-required"
          label="Username"
          variant="standard"
          value={username}
          onChange={handleUsernameChange}
          sx={{ width: "220px" }}
        />
        <br />
        <TextField
          id="standard-password-input"
          label="Password"
          type="password"
          autoComplete="current-password"
          variant="standard"
          onChange={handlePasswordChange}

          value={password}
          sx={{ width: "220px" }}
        />
        <br />
        <Grid
          alignItems="left"

          sx={{ width: "220px" }}
        >

          <Button variant="outlined" 
            
            onClick={() => onLogin()}
          >Login</Button>
        </Grid>

      </Grid>
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

export default Login;