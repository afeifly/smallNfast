import React from 'react';
import { useEffect } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useNavigate } from "react-router-dom"
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import Paper from '@mui/material/Paper';
import ListItem from '@mui/material/ListItem';
import Box from '@mui/material/Box';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Grid from '@mui/material/Grid';
import ListIcon from '@mui/icons-material/List';
import SearchIcon from '@mui/icons-material/Search';
import AccountCircle from '@mui/icons-material/AccountCircle';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';

import API from '../../common/api';


import Cookies from 'js-cookie';
import * as Constant from '../../common/Constant';
import { ListItemSecondaryAction } from '@mui/material';
import Logo from "../../common/img/Logo_SUTO.png";
import Icon from '@mui/material/Icon';



var searchTxt;
export default function TopBar(props) {
  const navigate = useNavigate();
  const [state, setState] = React.useState({
    menuOpen: false,
  });
  const [username, setUsername] = React.useState("");
  const [userRole, setUserRole] = React.useState(0);
  const [isLogin, setLogin] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const menuId = 'primary-search-account-menu';
  const profileOpen = Boolean(anchorEl);
  const [allCompanys, setAllCompanys] = React.useState([]);
  const [searchInput, setSearchInput] = React.useState('');
  const [searchCompany, setSearchCompany] = React.useState(null);
  const [autoCompleteValue, setAutoCompleteValue] = React.useState(null);
  const [errOpen, setErrOpen] = React.useState(false);
  const [errMsg, setErrMsg] = React.useState('');


  const [oldpsw, setOldpsw] = React.useState('');
  const [newpsw, setNewpsw] = React.useState('');
  const [newpswc, setNewpswc] = React.useState('');
  const [updatePswOpen, setUpdatePswOpen] = React.useState(false);

  const noBorderTextFieldstyle = {
    "& .MuiOutlinedInput-root": {
      "&.Mui-focused fieldset": {
        borderWidth: "0px"
      }
    }
  }
  useEffect(() => {
    checkStatus();
    loadAllCompany();
  }, []);
  function handleNewpswcChange(event) {
    setNewpswc(event.target.value);
  }
  function handleNewpswChange(event) {
    setNewpsw(event.target.value);
  }
  function handleOldpswChange(event) {
    setOldpsw(event.target.value);
  }
  function handleSearchInputChange(event) {
    setSearchInput(event.target.value);
  }
  function handleUpdatePswClose() {
    setUpdatePswOpen(false);
  }
  function handleUpdateOKConfirm() {
    setUpdatePswOpen(false);
    if(newpsw === newpswc){
      API.put(`users/${username}`,{
        oldpsw: oldpsw,
        newpsw: newpsw 
      })
      .then(res => {
       handleLogout(); 
      }).catch(() => {

      setErrOpen(true);
      setErrMsg('Modify password fail.');
      })
    }else{
      setErrOpen(true);
      setErrMsg('The new password entered twice is different.');
    }

  }
  function handleErrClose(){
    setErrOpen(false);
  }

  function handleAutocomplete(event, newValue) {
    setSearchCompany(newValue);
    setSearchInput(null);
  }
  function loadAllCompany() {
    API.get(`company/allnames`)
      .then(res => {

        let companyArr = [];
        res.data.map(tmpCompany => {
          let tmp = {
            id: tmpCompany.id,
            label: tmpCompany.companyname
          }
          companyArr.push(tmp);
        });
        setAllCompanys(companyArr);

      }).catch(() => {
      })
  }
  function checkStatus() {
    var user = Cookies.get(Constant.COOKIE_USERNAME);
    if (user == null) {
      setLogin(false);
      navigate(Constant.HREF_LOGIN);
    } else {
      setUsername(user);
      setUserRole(Cookies.get(Constant.COOKIE_ROLE));
      setLogin(true);
    }
  }
  function handleSearch() {
    if (searchInput) {
      if (props.query4SN) {
        props.query4SN(searchInput);
      } else {
        navigate(Constant.HREF_SENSORS, {
          state: {
            searchFor: Constant.SENSOR_SEARCH_BY_SN,
            searchKey: searchInput,
          }
        });
      }
    } else {
      if (searchCompany) {
        if (props.query4Company) {
          props.query4Company(searchCompany.id, searchCompany.label);
        } else {
          navigate(Constant.HREF_SENSORS, {
            state: {
              searchFor: Constant.SENSOR_SEARCH_BY_COMPANY,
              searchKey: searchCompany.id,
            }
          });
        }
        setSearchInput(null);
        setSearchCompany(null);


      }
    }

  }

  function handleShowCompanys() {
  }
  function handleShowCustomers() {
  }
  function handleShowSensors() {
  }

  function handleShowUserM() {
  }
  function handleProfileMenuOpen(event) {
    setAnchorEl(event.currentTarget);
  }
  function handleProfileMenuClose() {
    setAnchorEl(null);
  }
  function handleLogout() {
    Cookies.remove(Constant.COOKIE_USERNAME);
    Cookies.remove(Constant.COOKIE_TOKEN);
    Cookies.remove(Constant.COOKIE_ROLE);
    navigate(Constant.HREF_LOGIN);
  }
  function handleModify() {
    setUpdatePswOpen(true);
  }
  function handleManagerUser(){
    navigate(Constant.HREF_MANAGER);
  }

  function keyPress(e) {
    if (e.keyCode === 13) {
      //search and refresh licenses
      if (searchTxt !== null && searchTxt !== '') {
        props.searchLicense(searchTxt);
      }

    }
  }
  function handleKWChange(e) {
    searchTxt = e.target.value;
  }
  const toggleDrawer = (open) => event => {

    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setState({ ...state, menuOpen: open });
  };
  const sideList = (
    <div
      // role="presentation"
      onClick={toggleDrawer(false)}
      onKeyDown={toggleDrawer(false)}
    >
      <List>
        <ListItem button
          disabled={isLogin}
          onClick={handleShowCompanys}
        >
          <ListItemIcon><ListIcon /></ListItemIcon>
          <ListItemText primary="Companys" />
        </ListItem>
        <ListItem button
          disabled={!props.isLogin}
          onClick={handleShowCustomers}
        >
          <ListItemIcon><ListIcon /></ListItemIcon>
          <ListItemText primary="Customers" />
        </ListItem>

        <ListItem button
          disabled={!props.isLogin}
          onClick={handleShowSensors}
        >
          <ListItemIcon><ListIcon /></ListItemIcon>
          <ListItemText primary="Sensors" />
        </ListItem>

      </List>
      <Divider />
      <List>
        <ListItem button
          disabled={!props.isLogin || props.username !== "admin"}
          onClick={handleShowUserM}

        >
          <ListItemIcon><AccountCircle /></ListItemIcon>
          <ListItemText primary="User Manage" />
        </ListItem>
      </List>
    </div>
  );


  return (
    <Box sx={{ flexGrow: 1 }}>


      <AppBar position="static"
        sx={{ backgroundColor: "#229C73", color: "#ffdd22" }}
      >
        <Toolbar>
          {/* <IconButton
            edge="start"
            color="inherit"
            aria-label="open drawer"
            onClick={toggleDrawer(true)}
          >
            <MenuIcon />
          </IconButton> */}
          <Icon sx={{width: "96px"}}
          >
        <img src={Logo}  width={84}/>
        </Icon>
          <Typography variant="h6" noWrap width={800}>
            Customer-Product Manager
          </Typography>

          <Grid
            container
            direction="row"
            justifyContent="flex-end"
          >
            {/* <Autocomplete
              // {...defaultProps}
              options={allCompanys}
              id="disable-close-on-select"
              disableCloseOnSelect
              sx={{
                width: 180,
              }}
              renderInput={(params) => (
                <TextField {...params} label="Company"
                  InputLabelProps={{
                    style: { color: '#ffdd22' }
                  }}
                  variant="standard" />
              )}
            />

            <Autocomplete
              // {...defaultProps}
              options={allCompanys}
              id="disable-close-on-select"
              disableCloseOnSelect
              sx={{
                width: 180,
              }}
              renderInput={(params) => (
                <TextField {...params} label="Manufacturing Year"
                  InputLabelProps={{
                    style: { color: '#ffdd22' }
                  }}
                  variant="standard" />
              )}
            /> */}






            <Paper
              // component="form"
              sx={{ display: 'flex', alignItems: 'center', width: 300 }}
            >


              <Autocomplete
                // {...defaultProps}
                options={allCompanys}
                value={searchCompany}
                disabled={!isLogin}
                sx={{ display: 'flex', alignItems: 'center', width: 300 }}
                onChange={handleAutocomplete}
                renderInput={(params) => (
                  <TextField {...params} label="Company or Sensor ID"
                    sx={{ noBorderTextFieldstyle }}
                    onChange={handleSearchInputChange}
                  />
                )}
              />



              <IconButton type="submit" sx={{}} aria-label="search"
                onClick={handleSearch}
                disabled={!isLogin}
              >
                <SearchIcon />
              </IconButton>


            </Paper>



            <IconButton
              sx={{ p: '10px' }}
              edge="end"
              aria-label="account of current user"
              aria-controls={menuId}
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
              disabled={!isLogin}
            >
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={profileOpen}
              onClose={handleProfileMenuClose}
            >
              <MenuItem >Hi {username} </MenuItem>
              <MenuItem onClick={handleModify}>Modify Password</MenuItem>
              {userRole==='1'?<MenuItem onClick={handleManagerUser}>User Manager</MenuItem>:''}
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Grid>
        </Toolbar>


      </AppBar>

      <Dialog
        open={updatePswOpen}
        onClose={handleUpdatePswClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {'Update password'}
        </DialogTitle>
        <DialogContent>

          <TextField
            margin="dense"
            value={oldpsw}
            type='password'
            onChange={handleOldpswChange}
            label="Old password"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            type='password'
            value={newpsw}
            onChange={handleNewpswChange}
            label="New password"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            type='password'
            value={newpswc}
            onChange={handleNewpswcChange}
            label="Password confirm"
            fullWidth
            variant="standard"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleUpdatePswClose}>Cancel</Button>
          <Button onClick={handleUpdateOKConfirm}>
            {'Update'}
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


      {/* <Drawer open={state.menuOpen} onClose={toggleDrawer(false)}>
        {sideList}
      </Drawer> */}

    </Box>
  );
}
