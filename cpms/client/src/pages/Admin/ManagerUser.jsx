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
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Tooltip from '@mui/material/Tooltip';
import { Grid } from '@mui/material';
import { useLocation } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Cookies from 'js-cookie';



import TopBar from '../Bar/TopBar';
import API from '../../common/api';
import * as Constant from '../../common/Constant';

export default function ManagerUser(props) {

    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [newUser, setNewUser] = useState('');
    const [newPsw, setNewPsw] = useState('');
    const [newUserRole, setNewUserRole] = useState('0');

    const [addUserOpen, setAddUserOpen] = useState(false);




    useEffect(() => {
        load();
    }, []);
    function load() {
        if (Cookies.get(Constant.COOKIE_ROLE) === "0") {
            Cookies.remove(Constant.COOKIE_USERNAME);
            Cookies.remove(Constant.COOKIE_TOKEN);
            Cookies.remove(Constant.COOKIE_ROLE);
            navigate(Constant.HREF_LOGIN);
        } else {
            API.get(`users`)
                .then(res => {
                    setRows(res.data);
                }).catch(() => {
                });
        }

    }
    function handleAddUserClose() {
        setAddUserOpen(false);
    }
    function handleAddUserClick() {
        setAddUserOpen(true);
        setNewUser('');
    }

    function handleUsernameChange(event) {
        setNewUser(event.target.value)
    }
    function handleUserPswChange(event) {
        setNewPsw(event.target.value);
    }
    function handleRoleChange(event) {
        setNewUserRole(event.target.value);
    }

    function handleOKConfirm() {
        console.log(`u ${newUser} r ${newUserRole}`)
        API.post(`users`, {
            username: newUser,
            password: newPsw,
            role: parseInt(newUserRole)
        }).then(res => {
            load();
        }).catch(() => {

        })
        setAddUserOpen(false);


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
                        href={Constant.HREF_SHARP+Constant.HREF_COMPANYS}
                    >
                        {`Home`}
                    </Link>
                    <Typography color="text.primary">{`User manager`}</Typography>
                </Breadcrumbs>
                <Tooltip title="Add User">
                    <Fab
                        onClick={handleAddUserClick}
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
                        <TableCell align="left">Username</TableCell>
                        <TableCell align="left">Role</TableCell>
                        <TableCell align="left">Created date</TableCell>
                        <TableCell align="left">Action</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map(row => (
                        <TableRow key={row.username}>
                            <TableCell align="left">
                                {row.username}
                            </TableCell>
                            <TableCell align="left">
                                {row.role === 0 ? "Normal" : "Admin"}
                            </TableCell>
                            <TableCell align="left">
                                {row.createdAt.slice(0, 10)}
                            </TableCell>
                            <TableCell align="left">
                                <Tooltip title="Delete User">
                                    <IconButton
                                    // onClick={()=>handleDownload(row.sn,row.license)}
                                    >
                                        <DeleteOutlineIcon />
                                    </IconButton>
                                </Tooltip>


                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <Dialog
                // maxWidth={"md"}
                open={addUserOpen}
                onClose={handleAddUserClose}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {'Create user'}
                </DialogTitle>
                <DialogContent>

                    <TextField
                        margin="dense"
                        value={newUser}
                        onChange={handleUsernameChange}
                        label="User name"
                        fullWidth
                        variant="standard"
                    />
                    <TextField
                        margin="dense"
                        value={newPsw}
                        onChange={handleUserPswChange}
                        label="Password"
                        fullWidth
                        variant="standard"
                    />
                    <FormControl>
                        <FormLabel id="demo-radio-buttons-group-label">Role</FormLabel>
                        <RadioGroup
                            aria-labelledby="demo-radio-buttons-group-label"
                            value={newUserRole}
                            onChange={handleRoleChange}
                            name="radio-buttons-group"
                        >
                            <FormControlLabel value="0" control={<Radio />} label="Nomal" />
                            <FormControlLabel value="1" control={<Radio />} label="Admin" />
                        </RadioGroup>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleAddUserClose}>Cancel</Button>
                    <Button onClick={handleOKConfirm}>
                        {'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

        </Paper>
    );
}
