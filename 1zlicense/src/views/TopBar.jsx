import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import Drawer from '@mui/material/Drawer';
import { alpha, styled } from '@mui/material/styles';
import { makeStyles } from '@mui/styles';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import AccountCircle from '@mui/icons-material/AccountCircle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import ListIcon from '@mui/icons-material/List';

import * as Constant from '../utils/Constant';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(1),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      width: '150px',
      '&:focus': {
        width: '240px',
      },
    },
  },
}));

const useStyles = makeStyles((theme) => ({
  menuButton: {
    marginRight: theme.spacing(2),
  },
  title: {
    flexGrow: 1,
    display: 'none',
    [theme.breakpoints.up('sm')]: {
      display: 'block',
    },
  },
  logo: {
    height: 48,
    marginRight: theme.spacing(2),
    mixBlendMode: 'screen',
    border: 'none',
    outline: 'none',
  },
}));

var searchTxt;
export default function TopBar(props) {
  const classes = useStyles();
  const [state, setState] = React.useState({
    menuOpen: false,
  });

  const [anchorEl, setAnchorEl] = React.useState(null);
  const menuId = 'primary-search-account-menu';
  const profileOpen = Boolean(anchorEl);
  function handleShowList() {
    props.showPage(Constant.PAGE_TYPE_ALL_LICENSE);
  }
  function handleShowS332List() {
    props.showPage(Constant.PAGE_TYPE_S332_ALL_LICENSE);
  }
  function handleShowS520List() {
    props.showPage(Constant.PAGE_TYPE_S520_ALL_LICENSE);
  }
  function handleShowCalibrationSystemList() {
    //TODO
    props.showPage(Constant.PAGE_TYPE_CALIBRATION_ALL_LICENSE);
    // props.showPage(Constant.PAGE_TYPE_S520_ALL_LICENSE);
  }
  function handleShowS4CUSList() {
    props.showPage(Constant.PAGE_TYPE_S4CUS_ALL_LICENSE);
  }
  function handleShowS4ARemoteList() {
    props.showPage(Constant.PAGE_TYPE_S4A_REMOTE_ALL_LICENSE);
  }

  function handleEvents() {
    props.showPage(Constant.PAGE_TYPE_EVENTS);
  }

  function handleShowCreate() {
    props.showPage(Constant.PAGE_TYPE_CREATE);
  }
  function handleShowUserM() {
    props.showPage(Constant.PAGE_TYPE_USER_MANAGE);
  }
  function handleProfileMenuOpen(event) {
    setAnchorEl(event.currentTarget);
  }
  function handleProfileMenuClose() {
    setAnchorEl(null);
  }
  function handleLogout() {
    props.logout();
    handleProfileMenuClose();
  }
  function handleModify() {
    props.showPage(Constant.PAGE_TYPE_MODIFY_PSW);
    handleProfileMenuClose();
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
        <ListItem disablePadding>
          <ListItemButton
            disabled={!props.isLogin}
            onClick={handleShowList}
          >
            <ListItemIcon><ListIcon /></ListItemIcon>
            <ListItemText primary="License List" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            disabled={!props.isLogin}
            onClick={handleShowCalibrationSystemList}
          >
            <ListItemIcon><ListIcon /></ListItemIcon>
            <ListItemText primary="Calibration licenses " />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            disabled={!props.isLogin}
            onClick={handleShowS332List}
          >
            <ListItemIcon><ListIcon /></ListItemIcon>
            <ListItemText primary="S332 Licenses " />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            disabled={!props.isLogin}
            onClick={handleShowS520List}
          >
            <ListItemIcon><ListIcon /></ListItemIcon>
            <ListItemText primary="S520 Licenses " />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            disabled={!props.isLogin}
            onClick={handleShowS4CUSList}
          >
            <ListItemIcon><ListIcon /></ListItemIcon>
            <ListItemText primary="S4CUS Licenses " />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            disabled={!props.isLogin}
            onClick={handleShowS4ARemoteList}
          >
            <ListItemIcon><ListIcon /></ListItemIcon>
            <ListItemText primary="S4A remote Licenses " />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton
            disabled={!props.isLogin}
            onClick={handleEvents}
          >
            <ListItemIcon><ListIcon /></ListItemIcon>
            <ListItemText primary="Events" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton
            onClick={handleShowCreate}
            disabled={!props.isLogin}
          >
            <ListItemIcon><AddIcon /></ListItemIcon>
            <ListItemText primary="Create License" />
          </ListItemButton>
        </ListItem>
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton
            disabled={!props.isLogin || props.username !== "admin"}
            onClick={handleShowUserM}
          >
            <ListItemIcon><AccountCircle /></ListItemIcon>
            <ListItemText primary="User Manage" />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );


  return (
    <div
    // className={classes.root}
    >
      <AppBar position="static" color="primary">
        <Toolbar>
          <IconButton
            edge="start"
            className={classes.menuButton}
            color="inherit"
            aria-label="open drawer"
            onClick={toggleDrawer(true)}
          >
            <MenuIcon />
          </IconButton>
          <img src="/logo.png" alt="Suto Logo" className={classes.logo} />
          <Typography className={classes.title} variant="h6" noWrap>
            Suto License Portal
          </Typography>
          <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase
              disabled={!props.isLogin}
              placeholder="SN or Email ... Enter!"
              inputProps={{ 'aria-label': 'search' }}
              onKeyDown={keyPress}
              onChange={handleKWChange}
            />
          </Search>
          <IconButton
            edge="end"
            aria-label="account of current user"
            aria-controls={menuId}
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
            disabled={!props.isLogin}
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
            <MenuItem >Hi {props.username} </MenuItem>
            <MenuItem onClick={handleModify}>Modify Password</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer open={state.menuOpen} onClose={toggleDrawer(false)}>
        {sideList}
      </Drawer>
    </div>
  );
}
