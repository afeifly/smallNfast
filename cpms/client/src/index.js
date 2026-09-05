import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';
import Companys from "./pages/Companys/Companys";
import Customers from "./pages/Companys/Customers";
import Sensors from "./pages/Companys/Sensors";
import ManagerUser from './pages/Admin/ManagerUser';

// import {BrowserRouter,Routes,Route} from "react-router-dom";
import { HashRouter as Router, Route, Routes } from 'react-router-dom';

const root = createRoot(document.getElementById('root'));


root.render(
  <Router>
  <Routes>
    <Route exact path="/" element={<App/>}/>
    <Route exact path="/login" element={<App/>}/>
    <Route exact path="/companys" element={<Companys/>}/>
    <Route exact path="/customers" element={<Customers/>}/>
    <Route exact path="/sensors" element={<Sensors/>}/>
    <Route exact path="/manager" element={<ManagerUser/>}/>
  </Routes>
  </Router>

);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
