import 'whatwg-fetch';
import 'babel-polyfill';

// const API_HEADERS = {
//   'Access-Control-Allow-Origin': '*',
//   'Content-Type'    : 'application/json',
//   'Content-Encoding': 'UTF-8'
// };

// const dateFormat = d3.timeFormat('%Y-%m-%d %H:%M:%S');

let RequestUtil = {

  HOST: '/api',

  requestURL(url, method, callBack) {
    url = this.HOST + url;

    let options = {
      method: method, 
      credentials: "include",
    };

    fetch(url, options)
      .then(response => {
    
        var returnData = {
          data: response.text(),
          status: response.status
        }
        return JSON.stringify(returnData);
      })
      .then(jsonStr => {
        console.log('client get :  '+jsonStr);
        if(callBack !== null) {
          var jsonData;          
          if (jsonStr  && jsonStr !== "204") {
            jsonData = JSON.parse(jsonStr);
          }else {
            jsonData = jsonStr;
          }
      
          var returnData = {
            data: jsonData,
            status: 200 
          }
          // return returnData;

          callBack(returnData);
        }
      })
  },


  requestURLByGet(url, callBack) {
    this.requestURL(url, 'GET', callBack);
  },

  requestURLByPut(url,formData, callBack) {
    
    let options = {
      method: 'PUT', 
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: formData
    };

    fetch(this.HOST+url, options)
      .then(response => {
        if (response.status === 200) {
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
        "Content-Type": "application/json"
      },
      body: formData
    };

    fetch(this.HOST+url, options)
      .then(response => {
        // if (response.status === 200) {
        //   return response.text();
        // } else {
        //   return response.status;
        // }
        var returnData = {
          status: response.status,
          data: response.text()
        }
        return returnData;
      })
      .then(jsonStr => {
        if(callBack !== null) {
          var jsonData;
          if (jsonStr && jsonStr !== "204") {
            jsonData = JSON.parse(jsonStr);
          }else {
            jsonData = jsonStr;
          }
          var returnData = {
            data: jsonData,
            status: 200
          }
          callBack(returnData);
        }
      })

  },


};

export default RequestUtil;