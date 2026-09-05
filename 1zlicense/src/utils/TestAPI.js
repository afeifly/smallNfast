import RequestUtil from "./RequestUtil";


let TestAPI = {
  
  login(user,psw,callback) {
    let url = `/loginx?user=`+user+'&psw='+psw;
    RequestUtil.requestURLByGet(url, callback);
  },


 
}

export default TestAPI;
