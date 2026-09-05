import React, { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import './css/style.css'
import axios from 'axios';
import {
  Paper, Chip, Avatar, Typography, Dialog,
  DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';


export default function UserManage(props) {

  const [users, setUsers] = useState([]);
  const [user, setUser] = useState();
  const [psw, setPsw] = useState();
  const [id2Del, setId2Del] = useState();
  const [cfOpen, setCfOpen] = useState(false);

  useEffect(() => {
    //
    refreshUser();
  }, []);

  function refreshUser() {
    axios.get('/api/users')
      .then(function (response) {
        console.log(response.data.users);
        if (response.data.users !== undefined) {
          setUsers(response.data.users);
        }


      })
      .catch(function (error) {
        console.log(error)
        // props.showErr(error)
      });
  }

  function inputUserName(event) {
    setUser(event.target.value);
  }

  function inputPassword(event) {
    setPsw(event.target.value);
  }
  function tryCreate(e) {
    if (e.keyCode === 13) {
      handleCreate();
    }
  }
  function handleCreate() {
    axios.post('/api/users?user=' + user + '&psw=' + psw)
      .then(function (response) {
        console.log(response.data);
        //if it is ok, reate user chip
        refreshUser();
      })
      .catch(function (error) {
        console.log(error)
        // props.showErr(error)
      });
  }

  function handlePreDelete(id, name) {

    setUser(name);
    setCfOpen(true);
    setId2Del(id);

  }
  function handleClose() {
    setCfOpen(false);
    setUser(null);
    setId2Del(0);
  }
  function handleDelete() {
    axios.delete('/api/users/' + id2Del)
      .then(function (response) {
        console.log(response);
        setCfOpen(false);
        refreshUser();
      })
      .catch(function (error) {
        console.log(error)
        setCfOpen(false);
        // props.showErr(error)
      });
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
        <Grid
          container
          direction="row"
          justifyContent="flex-start"
          alignItems="center"
        >
          <TextField
            label="User"
            autoComplete="new-password"
            onChange={inputUserName}
            // onKeyDown={tryLogin}
            margin="normal"
          />
          <TextField
            label="Password"
            autoComplete="new-password"
            onChange={inputPassword}
            onKeyDown={tryCreate}
            margin="normal"
          />
          <Button variant="contained" color="primary" className="base-margin"
            onClick={handleCreate}
          >
            Create
          </Button>
        </Grid>
        <Paper className='user-list-paper' >
          <Typography > User list</Typography>
          {users.map(d => {
            return (
              <Chip
                className="user-chip"
                avatar={<Avatar >{d.username.substring(0, 1)}</Avatar>}
                key={d.id}
                label={d.username}
                variant="outlined"
                onDelete={() => handlePreDelete(d.id, d.username)}
              ></Chip>
            )
          })}
        </Paper>
        <Dialog
          open={cfOpen}
          onClose={handleClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">Warnning</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              Really want to delete <span className="sn-color">{user}</span> ?
            </DialogContentText>
          </DialogContent>
          <DialogActions>

            <Button onClick={handleDelete} color="primary" autoFocus>
              Confirm
            </Button>
            <Button onClick={handleClose} autoFocus>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
      </Grid>

    </div>
  )
}