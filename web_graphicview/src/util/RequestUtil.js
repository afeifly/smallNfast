import * as d3 from 'd3';
import 'whatwg-fetch';
import 'babel-polyfill';
import { SystemEvent } from './SystemConstant';

// const API_HEADERS = {
//   'Access-Control-Allow-Origin': '*',
//   'Content-Type'    : 'application/json',
//   'Content-Encoding': 'UTF-8'
// };

// const dateFormat = d3.timeFormat('%Y-%m-%d %H:%M:%S');

let RequestUtil = {

    //For npm build use empty host ''
    HOST: '',
//    HOST: 'https://192.168.0.55',
//    HOST: 'https://192.168.0.57',
//   HOST: 'https://192.168.0.27',

//   HOST: 'https://11.11.11.21',
   HOST: 'https://11.11.11.74',
//    HOST: 'http://127.0.0.1:8889',
//    HOST: 'http://192.168.0.60:8889',
// HOST: 'https://s4m.suto-itec.asia',


  requestURL(url, method, callBack) {
    url = this.HOST+"/api" + url;

    let options = {
      method: method,
      credentials: "include",
    };

    fetch(url, options)
      .then(response => {
        if (response.status === 200 || response.status === 401) {
          if(response.status === 401) {
            d3.select('#App').dispatch(SystemEvent.INVAILID_SESSION);
          }
          return response.text();
        } else {
          return response.status;
        }
      })
      .then(jsonStr => {
        if(callBack !== null) {
          var jsonData;
          if (jsonStr  && jsonStr !== "204") {
            try {
              jsonData = JSON.parse(jsonStr);
            } catch (error) {
              console.log(error);
            }
          }else {
            jsonData = jsonStr;
          }

          callBack(jsonData);
        }
      })
  },


  requestURLByGet(url, callBack) {
    this.requestURL(url, 'GET', callBack);
  },
  requestURLByPut(url, formData, callBack) {

    let options = {
      method: 'PUT',
      credentials: "include",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: formData
    };

    fetch(this.HOST+"/api"+url, options)
      .then(response => {
        if (response.status === 200 || response.status === 401) {
          if(response.status === 401) {
            d3.select('#App').dispatch(SystemEvent.INVAILID_SESSION);
          }
          return response.text();
        } else {
          return response.status;
        }
      })
      .then(jsonStr => {
        if(callBack !== null) {
          var jsonData;
          if (jsonStr && jsonStr !== "204") {
            jsonData = JSON.parse(jsonStr);
          }else {
            jsonData = jsonStr;
          }

          callBack(jsonData);
        }
      })
  },
  requestURLByDelete(url,  callBack) {

    let options = {
      method: 'DELETE',
      credentials: "include",
    };

    fetch(this.HOST+"/api"+url, options)
      .then(response => {
        if (response.status === 200 || response.status === 401) {
          if(response.status === 401) {
            d3.select('#App').dispatch(SystemEvent.INVAILID_SESSION);
          }
          return response.text();
        } else {
          return response.status;
        }
      })
      .then(jsonStr => {
        if(callBack !== null) {
          var jsonData;
          if (jsonStr && jsonStr !== "204") {
            jsonData = JSON.parse(jsonStr);
          }else {
            jsonData = jsonStr;
          }

          callBack(jsonData);
        }
      })
  },
  requestURLByPost(url, formData, callBack) {
    let options = {
      method: 'POST',
      credentials: "include",
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      },
      body: formData
    };

    fetch(this.HOST+"/api"+url, options)
      .then(response => {
        if (response.status === 200 || response.status === 401) {
          if(response.status === 401) {
            d3.select('#App').dispatch(SystemEvent.INVAILID_SESSION);
          }
          return response.text();
        } else {
          return response.status;
        }
      })
      .then(jsonStr => {
        if(callBack !== null) {
          var jsonData;
          if (jsonStr && jsonStr !== "204") {
            jsonData = JSON.parse(jsonStr);
          }else {
            jsonData = jsonStr;
          }

          callBack(jsonData);
        }
      })

  },


};

export default RequestUtil;
