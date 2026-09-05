import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme, StyledEngineProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './App.css';
import * as Constant from './utils/Constant';
import TopBar from './views/TopBar';
import LogIn from './views/LogIn';
import CreateSN from './views/CreateSN';
import Grid from '@mui/material/Grid';
import Licenses from './views/Licenses';
import S520Licenses from './views/S520Licenses';
import S332Licenses from './views/S332Licenses';
import Events from './views/Events';
import axios from 'axios';
import Snackbar from '@mui/material/Snackbar';
import ModifyPsw from './views/ModifyPSW';
import UserManage from './views/UserManage';
import Offline from './views/Offline';
import { BrowserRouter as Router, Route } from "react-router-dom";
import S4CUSLicense from './views/S4CUSLicenses';
import CalibrationLicense from './views/CalibrationLicenses';
import S4ARemoteLicense from './views/S4ARemoteLicenses';

const theme = createTheme({
  palette: {
    primary: {
      main: 'rgb(34, 156, 115)',
    },
  },
});

function App() {
  const [isLogin, setLogin] = useState(false);
  const [username, setUserName] = useState("");
  // Don't restore the page until we've confirmed the session
  const [currentPage, setPage] = useState(Constant.PAGE_TYPE_LOGIN);

  const [errMsg, setErrMsg] = useState();
  const [errOpen, setErrOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [listLoadDone, setListLoadDone] = useState(true);

  useEffect(() => {
    // Check session on mount
    axios.get("/api/session")
      .then(response => {
        if (response.status === 200 && response.data.loginName) {
          setLogin(true);
          setUserName(response.data.loginName);
          // If we were on a specific page, reload its data
          const savedPage = Number(localStorage.getItem('currentPage'));
          if (savedPage) {
            showPage(savedPage);
          }
        } else {
          // Session expired or not logged in
          localStorage.removeItem('currentPage');
          setPage(Constant.PAGE_TYPE_LOGIN);
          setLogin(false);
        }
      }).catch(err => {
        console.log("Session check failed or not logged in");
        localStorage.removeItem('currentPage');
        setPage(Constant.PAGE_TYPE_LOGIN);
        setLogin(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  function handleLogIn(username) {
    localStorage.setItem('currentPage', Constant.PAGE_TYPE_CREATE);
    setPage(Constant.PAGE_TYPE_CREATE);
    setLogin(true);
    setUserName(username);
  }
  function handleErrClose() {
    setErrOpen(false);
  }
  function showErr(msg) {
    setErrOpen(true);
    setErrMsg(msg);
  }
  function logout() {
    axios.get("/api/logout")
      .then(response => {
        localStorage.removeItem('currentPage');
        setPage(Constant.PAGE_TYPE_LOGIN);
        setLogin(false);
        setUserName("");
      })
      .catch(error => {
        console.log(error);

      });


  }

  function showPage(page) {
    localStorage.setItem('currentPage', page);
    setPage(page);
    if (page === Constant.PAGE_TYPE_ALL_LICENSE) {
      setListLoadDone(false);
      refreshList();
    }
    if (page === Constant.PAGE_TYPE_CALIBRATION_ALL_LICENSE) {
      setListLoadDone(false);
      // loadS520License();
      loadCalibrationLicense("");
    }
    if (page === Constant.PAGE_TYPE_S520_ALL_LICENSE) {
      setListLoadDone(false);
      loadS520License();
    }
    if (page === Constant.PAGE_TYPE_S332_ALL_LICENSE) {
      setListLoadDone(false);
      loadS332License();
    }
    if (page === Constant.PAGE_TYPE_S4CUS_ALL_LICENSE) {
      setListLoadDone(false);
      loadS4CUSLicense();
    }
    if (page === Constant.PAGE_TYPE_S4A_REMOTE_ALL_LICENSE) {
      setListLoadDone(false);
      loadS4ALicense();
    }
    if (page === Constant.PAGE_TYPE_EVENTS) {
      setListLoadDone(false);
      loadEvents();
    }
  }
  function searchLicense(keyWord) {
    setListLoadDone(false);
    switch (currentPage) {
      case Constant.PAGE_TYPE_CALIBRATION_ALL_LICENSE:
        loadCalibrationLicense(keyWord);
        return;
      default:
        break;
    }
    setPage(Constant.PAGE_TYPE_ALL_LICENSE);
    refreshList(keyWord);

  }
  function doModify(oldP, newP) {
    axios.post('/api/password', {
      opsw: oldP,
      npsw: newP,
      npswc: newP,
      user: username
    })
      .then(function (response) {
        if (response.data === null) {
          //OK logout
          logout();
        } else {
          //error  
          // console.log(response.data.msg);
          setErrOpen(true);
          setErrMsg(response.data.msg);
        }

      })
      .catch(function (error) {
        console.log(error);
      });
  }
  function handleBlock(sn) {
    axios.put("/api/s4cuslicenses?sn=" + sn + "&kw=" + sn, { sn: sn, state: 2 })
      .then(response => {
        console.log(response.data);
        let data = [...rows];
        data.forEach((row) => {
          if (row.sn === sn) {
            row.state = 2;
          }
        });
        setRows(data);
      }).catch(error => {
        console.log(error);
      });
  }
  function handleCalibrationStatuChange(sn, state) {
    axios.put("/api/calibrationlicense?sn=" + sn, { sn: sn, state: state })
      .then(response => {
        //TODO
        if (response.status !== 200) {
          showErr(response.data.err);
          return;
        }
        console.log(response.data);
        let data = [...rows];
        data.forEach((row) => {
          if (row.sn === sn) {
            row.state = state;
          }
        });
        setRows(data);
      }).catch(error => {
        console.log(error);

      });
  }
  function handleResume(sn) {
    console.log('block sn: ' + sn);
    axios.put("/api/s4cuslicenses?sn=" + sn + "&kw=" + sn, { sn: sn, state: 1 })
      .then(response => {
        let data = [...rows];
        data.forEach((row) => {
          if (row.sn === sn) {
            row.state = 1;
          }
        });
        setRows(data);
      }).catch(error => {
        console.log(error);
      });
  }
  // function handleChangeLocation(id,location){
  //   axios.put("/api/s4aserialnumber", { id: id, location: location })
  //     .then(response => {
  //       loadS4ALicense('');
  //     }).catch(error => {
  //       console.log(error);
  //     });
  // }

  function handleResetSN(sn) {
    axios.get("/api/reset?sn=" + sn + "&kw=" + sn)
      .then(response => {
        if (response.status !== 200) {
          showErr(response.data.err);
          return;
        }
        var trows = [];
        for (var d of response.data) {
          var tmp = {
            time: String(new Date(d.createdatetime)).substring(4, 24),
            sn: d.sn,
            product: GetProductionName(d.products_id),
            // type: d.type,
            status: d.used + "/" + d.max,
            company: d.company,
            email: d.email,
            note: d.note,
          }
          trows.push(tmp);
        }
        setRows(trows);
      }).catch(error => {
        console.log(error);
      });
  }
  function refreshList(kw) {
    let url = (kw === undefined) ? '/api/licenses' : '/api/licenses?kw=' + kw;
    axios.get(url)
      .then(response => {
        var trows = [];
        for (var d of response.data) {
          var tmp = {
            time: String(new Date(d.createdatetime)).substring(4, 24),
            sn: d.sn,
            product_id: d.products_id,
            product: GetProductionName(d.products_id),
            // type: d.type,
            status: d.used + "/" + d.max,
            company: d.company,
            email: d.email,
            note: d.note,
            used: d.used,
            text: d.text,
            canbereset: d.canbereset,
          }
          trows.push(tmp);
        }
        setRows(trows);
        setListLoadDone(true);
      })
      .catch(error => {
        console.log(error);
      });

  }
  function loadS332License(kw) {
    let url = '/api/s332licenses';
    axios.get(url)
      .then(response => {
        var trows = [];
        for (var d of response.data) {
          var tmp = {
            time: String(new Date(d.createdatetime)).substring(4, 24),
            id: d.id,
            machine_code: d.machine_code,
            note: d.note,
            license: d.license,
            create_by: d.create_by
          }
          trows.push(tmp);
        }
        setRows(trows);
        setListLoadDone(true);
      })
      .catch(error => {
        console.log(error);
      });
  }
  function loadCalibrationLicense(kw) {

    let url = '/api/calibrationlicenses?kw=' + kw;
    axios.get(url)
      .then(response => {
        var trows = [];
        for (var d of response.data) {
          var tmp = {
            time: String(new Date(d.createdatetime)).substring(4, 24),
            sn: d.sn,
            company: d.company,
            note: d.note,
            state: d.state
          }
          trows.push(tmp);
        }
        setRows(trows);
        setListLoadDone(true);
      })
      .catch(error => {
        console.log(error);
      });
  }
  function loadS520License(kw) {
    let url = '/api/s520licenses';
    axios.get(url)
      .then(response => {
        var trows = [];
        for (var d of response.data) {
          var tmp = {
            id: d.id,
            time: String(new Date(d.createdatetime)).substring(4, 24),
            sn: d.sn,
            note: d.note,
            license: d.license,
          }
          trows.push(tmp);
        }
        setRows(trows);
        console.log(trows);
        setListLoadDone(true);
      })
      .catch(error => {
        console.log(error);
      });
  }
  function loadS4CUSLicense(kw) {
    let url = '/api/s4cuslicenses';
    axios.get(url)
      .then(response => {
        var trows = [];
        for (var d of response.data) {
          var tmp = {
            time: String(new Date(d.createdatetime)).substring(4, 24),
            sn: d.sn,
            company: d.company,
            sntype: d.sntype,
            state: d.state,
            note: d.note,
          }
          trows.push(tmp);
        }
        setRows(trows);
        setListLoadDone(true);
      })
      .catch(error => {
        console.log(error);
      });
  }
  function updateS4A(id, location) {
    console.log('::: updaet id= ' + id + ' lid = ' + location);
    var tmps = [];
    // tmps = rows;
    rows.forEach(row => {
      let copiedItem = Object.assign({}, row);
      tmps.push(copiedItem);
    })
    tmps.forEach(row => {
      if (row.id === id) {
        row.location = location;
      }
    });
    console.log(tmps);
    setRows(tmps);
    setListLoadDone(true);
  }
  function loadS4ALicense(kw) {
    let url = '/api/s4aserialnumbers';
    axios.get(url)
      .then(response => {
        var trows = [];
        for (var d of response.data) {
          var tmpLocation = "1";
          if (d.hk === 1) {
            tmpLocation = "2";
          } else if (d.eu === 1) {
            tmpLocation = "3";
          } else if (d.cn === 1) {
            tmpLocation = "1";
          }
          var tmp = {
            time: String(new Date(d.createdatetime)).substring(4, 24),
            id: d.id,
            sn: d.sn,
            note: d.note,
            location: tmpLocation,
          }
          trows.push(tmp);
        }
        setRows(trows);
        setListLoadDone(true);
      })
      .catch(error => {
        console.log(error);
      });
  }
  function loadEvents(kw) {
    let url = '/api/events';
    axios.get(url)
      .then(response => {
        var trows = [];
        for (var d of response.data) {
          var actionStr = "Create";
          switch (d.action) {
            case 1:
              actionStr = "Create";
              break;
            case 2:
              actionStr = "Reset";
              break;
            case 3:
              actionStr = "Delete";
              break;
            default:
              break;
          }
          var tmp = {
            time: String(new Date(d.createdatetime)).substring(4, 24),
            user: d.user,
            action: actionStr,
            note: d.action !== 2 ? GetProductionName(d.product_id) + " license " + d.note : d.note,
          }

          trows.push(tmp);
        }
        setRows(trows);
        setListLoadDone(true);
      })
      .catch(error => {
        console.log(error);
      });

  }
  const MainItem = function () {
    return (
      <div className="App">
        <TopBar
          showPage={showPage}
          isLogin={isLogin}
          logout={logout}
          username={username}
          searchLicense={searchLicense}

        />
        <Grid
          container
          direction="column"
          justifyContent="center"
          alignItems="center"
        >
          <div>
            {currentPage === Constant.PAGE_TYPE_LOGIN ? <LogIn onLogIn={handleLogIn} /> : null}
            {currentPage === Constant.PAGE_TYPE_CREATE ? <CreateSN
              showErr={showErr}
            /> : null}
            {currentPage === Constant.PAGE_TYPE_ALL_LICENSE && listLoadDone ? <Licenses
              handleResetSN={handleResetSN}
              rows={rows}
            /> : null}
            {currentPage === Constant.PAGE_TYPE_S520_ALL_LICENSE && listLoadDone ? <S520Licenses
              rows={rows}
              showPage={showPage}
            /> : null}
            {currentPage === Constant.PAGE_TYPE_S332_ALL_LICENSE && listLoadDone ? <S332Licenses
              rows={rows}
              showPage={showPage}
            /> : null}
            {currentPage === Constant.PAGE_TYPE_S4CUS_ALL_LICENSE && listLoadDone ? <S4CUSLicense
              rows={rows}
              handleBlock={handleBlock}
              handleResume={handleResume}
            /> : null}
            {currentPage === Constant.PAGE_TYPE_CALIBRATION_ALL_LICENSE && listLoadDone ? <CalibrationLicense rows={rows}
              handleCalibrationStatuChange={handleCalibrationStatuChange}
              reload={loadCalibrationLicense}
            /> : null}
            {currentPage === Constant.PAGE_TYPE_S4A_REMOTE_ALL_LICENSE && listLoadDone ? <S4ARemoteLicense
              rows={rows}
              handleBlock={handleBlock}
              handleResume={handleResume}
              // handleCreate={handleCreateS4ALic}
              // handleChangeLocation={handleChangeLocation}
              reloadS4A={loadS4ALicense}
              updateS4A={updateS4A}
            /> : null}
            {currentPage === Constant.PAGE_TYPE_EVENTS && listLoadDone ? <Events
              rows={rows}
            /> : null}
            {currentPage === Constant.PAGE_TYPE_MODIFY_PSW ? <ModifyPsw
              showPage={showPage}
              doModify={doModify}
            /> : null}
            {currentPage === Constant.PAGE_TYPE_USER_MANAGE ? <UserManage

              showErr={showErr}
            /> : null}
          </div>
        </Grid>
        <Snackbar
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          open={errOpen}
          //autoHideDuration={6000}
          onClose={handleErrClose}

          message={<span>{errMsg}</span>}
        />



      </div>
    )
  }
  const OfflineItem = function () {
    return (
      <Offline logout={logout}></Offline>
    )
  }
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Route path="/"
            component={MainItem}
            exact
          >
          </Route>
          <Route path="/offline" component={OfflineItem}></Route>
        </Router>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
function GetProductionName(id) {
  switch (id) {
    case Constant.SOFTWARE_TYPE_S4A:
      return "S4A";
    case Constant.SOFTWARE_TYPE_CAA:
      return "CAA";
    case Constant.SOFTWARE_TYPE_S4M:
      return "S4M";
    case Constant.SOFTWARE_TYPE_LMS:
      return "LMS-cloud";
    case Constant.SOFTWARE_TYPE_LMS_lite:
      return "LMS";
    case Constant.SOFTWARE_TYPE_S520:
      return "S520";
    case Constant.SOFTWARE_TYPE_S4CUS:
      return "S4CUS";
    case Constant.SOFTWARE_TYPE_S4A_REMOTE:
      return "S4A_Device SN";
    default:
      return "unknown";
  }
}
export default App;
