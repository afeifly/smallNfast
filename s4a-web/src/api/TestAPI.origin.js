import RequestUtil from '../util/RequestUtil';

const API_URL = `${RequestUtil.HOST}/device`;

let TestAPI = {

  getDevices(callback) {
    const url = `${API_URL}/list/`;
    RequestUtil.requestURLByGet(url, callback);
  },


  getChannels(callback) {
    // const url = '/LoggingChEditBean';
    let url = `/LoggingChEditBean`;
    RequestUtil.requestURLByGet(url, callback);
  },
  getBackupSettings(callback){
    let url = '/backup_setting';
    RequestUtil.requestURLByGet(url, callback);
  },
	updateBackupSettings(json,callback){
		let url = '/backup_setting/1'
    	RequestUtil.requestURLByPut(url,json,callback);
	},
  /**
   * Get user settings of channnel and y-axis from server
   * @param {String} username
   * @param {Function} callback
   */
  getUserSettings(username, callback) {
    let url = `/user_settings/?%24hashtime=1562728615999&type%5Beq%5D=1&username%5Beq%5D=${username}&%24expand=x_axis_option%2Clog_file%2Cdisplay_channel_option%2Cdisplay_channel_option%2Fchannel_id%2Cdisplay_channel_option%2Fchannel_id%2Fdevice%2Cdisplay_channel_option%2Fchannel_id%2Fsensor%2Cdisplay_channel_option%2Fchannel_id%2Fsensor%2Flocation%2Cy_axis_option%2Cy_axis_option%2Fdisplay_channel_option%2Cy_axis_option%2Fdisplay_channel_option%2Fchannel_id%2Cy_axis_option%2Fdisplay_channel_option%2Fchannel_id%2Fsensor%2Cy_axis_option%2Fdisplay_channel_option%2Fchannel_id%2Fsensor%2Flocation%2Clog_file%2Clog_file%2Fsampling_info`;
    RequestUtil.requestURLByGet(url, callback);
  },

    getUsers(callback){
        let url = "/users?%24orderby=createddate%20asc&%24expand=role"
        RequestUtil.requestURLByGet(url, callback);
    },
    checkUserExist(username,callback){
        let url = "/users?username%5Beq%5D="
           + username
            +"&%24expand=role"
        RequestUtil.requestURLByGet(url, callback);
    },
    addUser(json,callback){
        let url = '/users'
        RequestUtil.requestURLByPost(url, json, callback);
    },
    modifyPsw(username,newpsw,oldpsw,callback){
        let url = '/users/%7Busername%7D/reset_password/?%24hashtime=1573035775964&username='
            + username
            + '&new='
            +newpsw
            +'&old='
            +oldpsw;

        RequestUtil.requestURLByPost(url,JSON.stringify([]),  callback);
    },
    deleteUser(username,callback){
        let url= '/users/'+username
        RequestUtil.requestURLByDelete(url,callback);
    },
  getFileList(callback) {
    let url = "/FileListBean";
    RequestUtil.requestURLByGet(url, callback);
  },
    getFileChannelBean(fileType,fileId,groupId,callback){
        let url= `/FileChannelBean?type=${fileType}&log_file_id=${fileId}&sampling_info_group_id=${groupId}`;
        console.log('url =  '+url)
        RequestUtil.requestURLByGet(url, callback);
    },
	initUserUploadDownLoad(user,callback){
		let url = '/user_file_upload_download/?%24hashtime=1576658370642&username%5Beq%5D='
							+user
							+'&type%5Beq%5D=false';	
    RequestUtil.requestURLByDelete(url, callback);
	},
	getUserUploadDownloadProgress(user,callback){
		let url = '/user_file_upload_download/?%24hashtime=1576658371708&username%5Beq%5D='
							+user
							+'&file_index%5Beq%5D=0&type%5Beq%5D=false'
    RequestUtil.requestURLByGet(url, callback);
	},
  getSampleList(callback) {
    let url = "/SamplingInfoListBean";
    RequestUtil.requestURLByGet(url, callback);
  },
  getSampleInfo(sid,callback){
    let url = "/sampling_info/"+sid
    RequestUtil.requestURLByGet(url, callback);
  },
  getSampleInfoGroup(groupId,callback){
    let url = "/sampling_info?sampling_info_group="+groupId
    RequestUtil.requestURLByGet(url, callback);
  },
  login(username, password, callback) {
    let url = `/login?username=${username}&password=${password}`;
    RequestUtil.requestURLByGet(url, callback);
  },
  getLocations(callback) {
    let url = '/LocationEditBean?is_logging_channel=false&get_locations=true';
    RequestUtil.requestURLByGet(url, callback);
  },
  getManualAddDevice(deviceids,callback){
    let url = '/LocationEditBean?is_logging_channel=false'
    +'&get_locations=false'
    +'&get_tmp_device=false'
    +'&get_active_device=false'
    +'&get_tmp_man_device=false'
    +'&get_active_man_device=false'
    +'&include_history=false'
    +'&history_start_time=0'
    +'&history_stop_time=0'
    +'&get_specified_device='+deviceids
    ;
    RequestUtil.requestURLByGet(url, callback); 
  },
  refreshChannelValues(ids, callback) {
    var tmpIDS = '';
    for(let i = 0; i<ids.length; i++){
      if(i===0){
        tmpIDS += ids[i];
      }else{
        tmpIDS +='%2C'+ids[i];
      }
    }
    let url = '/channels/?%24hashtime=1555556289214&channel_id%5Bin%5D='
      +tmpIDS
      +'&%24select=channel_id%2Cmeasurement_value%2Calarm_dismiss%2Calarm_settings%2Falarm_status%2Calarm_settings%2Fstatus%2Calarm_settings%2Fopt%2Cspecial_alarms%2Fthreshold%2Cspecial_alarms%2Flow_color%2Cspecial_alarms%2Flow_text%2Cspecial_alarms%2Fhigh_color%2Cspecial_alarms%2Fhigh_text&%24expand=alarm_settings%2Cspecial_alarms';
    RequestUtil.requestURLByGet(url, callback);
  },

  getMeasurementData(channelId, startTime, stopTime, tableInterval, getDataWay, callback) {
    let url = '/ChannelMeasurementDataBean?';
    const params = `channel_id=${channelId}&start_time=${startTime}&stop_time=${stopTime}&table_interval=${tableInterval}&get_data_way=${getDataWay}`;
    url += params;
    RequestUtil.requestURLByGet(url, callback);
  },

  getMutilMeasurementData(channelIds, startTime, tableInterval, getDataWay, callback) {
    let url = '/ChannelMeasurementDataBean?';
    let channelIdsParam;
    for(let i = 0; i<channelIds.length; i++) {
      if(i === 0) {
        channelIdsParam = `channel_id=${channelIds[0]}`;
      }else{
        channelIdsParam += `&channel_id=${channelIds[i]}`;
      }
    }

    url += channelIdsParam;
    url += `&start_time=${startTime}&stop_time=${startTime}&table_interval=${tableInterval}&get_data_way=${getDataWay}`;
    RequestUtil.requestURLByGet(url, callback);
  },
	getRegisterInfo(callback){
    let url = '/registration/';
    RequestUtil.requestURLByGet(url, callback)
  },
	getRegistration(callback){
		let url = '/register/1';
		RequestUtil.requestURLByGet(url, callback)
	},
	updateRegistration(json,callback){
		let url = '/register/1';
		RequestUtil.requestURLByPut(url, json,callback)
	},
    getReportBasicSetting(callback){
        let url = '/report_basic/1';
        RequestUtil.requestURLByGet(url, callback);
    },
    changeReportBasicSetting(json,callback){
        let url = '/report_basic/1';
        RequestUtil.requestURLByPut(url,json, callback);
    },
    getReportCostCurrency(callback){
        let url ='/report_cost_currency'
        RequestUtil.requestURLByGet(url, callback);
    },
  getReportList(callback){
    let url = '/report_consumption_settings/?%24hashtime=1557915047596&%24expand=groups%2Cgroups%2Fbranches%2Cgroups%2Fmain_channel';
    RequestUtil.requestURLByGet(url, callback);
  },
  changeReportCost(json, callback){
    let url = '/report_cost_currency/1'
    RequestUtil.requestURLByPut(url,json, callback);
  },
    newReport(json,callback){
        let url = '/report_consumption_settings'
        RequestUtil.requestURLByPost(url, json, callback);
    },
    deleteReport(reportId,callback){


        let url1 = '/report_consumption_settings/'+reportId
        let url2 = '/report_setting_groups?report_setting_group_id%5Bin%5D='+reportId
        let url3 = '/report_setting_group_channels?report_setting_group_id%5Bin%5D='+reportId
            RequestUtil.requestURLByDelete(url1, responseData1 => {
                console.log(responseData1)
                RequestUtil.requestURLByDelete(url2, responseData2 => {
                    console.log(responseData2)
                    RequestUtil.requestURLByDelete(url3,callback);
                });
            });

    },
  getReportData(rid,startTime,timeType,callback){
    let url = '/reportq/?%24hashtime=1558407835923&starttime='
      + startTime
      + '&setting_id='
      + rid
      + '&time_type='
      + timeType;
    RequestUtil.requestURLByGet(url, callback);
  },

  getLocationNDevice(callback){
    let url = `/LocationEditBean/?%24hashtime=1562054816234&is_logging_channel=false
      &get_locations=true&get_tmp_device=false&get_active_device=true&get_tmp_man_device=false
      &get_active_man_device=true&include_history=false&history_start_time=0&history_stop_time=0`;
    
    RequestUtil.requestURLByGet(url, callback);
  },
  getDetectedResult(callback){
    let url = '/LocationEditBean/?%24hashtime=1572429521735&is_logging_channel=false&get_locations=false&get_tmp_device=true&get_active_device=false&get_tmp_man_device=false&get_active_man_device=false&include_history=false&history_start_time=0&history_stop_time=0';
    RequestUtil.requestURLByGet(url, callback);
  },

  postLocations(json,callback){
    let url = '/LocationEditBean/?%24hashtime=1562140526924'
    RequestUtil.requestURLByPost(url, json, callback);
  },
  getAlarms(callback){
    let url = '/alarm/?%24hashtime=1562308534809&format=settings'
    RequestUtil.requestURLByGet(url, callback);
  },
	getAlarmHistorys(startTime,endTime,startIndex,type,callback){
		let url = '/alarm_history/?%24hashtime=1578906581129&start_time='
			+ startTime
			+'&end_time='
			+endTime
			+'&start_index='
			+startIndex
			+'&length=50&type='
			+type
		console.log(url)
    RequestUtil.requestURLByGet(url, callback);
	},
	//orderStr = {"asc","desc"}
	getAlarmTime(orderStr,callback){
		let url = '/alarm_historys/?%24hashtime=1578968971630&%24top=1&%24orderby=alarm_time%20'
							+ orderStr
							+ '&%24select=alarm_time'
    RequestUtil.requestURLByGet(url, callback);
	},
  getLocations4Alarms(callback){
    let url = '/LocationEditBean/?%24hashtime=1562566718219&is_logging_channel=false&get_locations=true&get_tmp_device=false&get_active_device=false&get_tmp_man_device=false&get_active_man_device=false&include_history=false&history_start_time=0&history_stop_time=0';
    RequestUtil.requestURLByGet(url, callback);
  },
  postAlarms(json, callback){
    let url = '/alarm/?%24hashtime=1562566718219'
    RequestUtil.requestURLByPost(url, json, callback);
  },
  getEmailSetting(callback){
    let url = '/email_setting/1?%24hashtime=1562919296331';
    RequestUtil.requestURLByGet(url, callback);
  },
  changeEmailSetting(json, callback){
    let url = '/email_setting/1'
    RequestUtil.requestURLByPut(url,json, callback);
  },
  verifyEmail(json,callback){
    let url = '/tasks'
    RequestUtil.requestURLByPost(url, json,callback);
  },
  checkTaskStatus(id,callback){
    let url = '/tasks/'+id
    RequestUtil.requestURLByGet(url, callback);
  },
  getSystemStatus(callback){
    let url = '/system_catalogs/?%24hashtime=1563502480840'
    RequestUtil.requestURLByGet(url, callback);
  },
  loginConfirm(user,psw,callback){
    let url = '/login?confirm=confirm&username='+user+'&password='+psw
    RequestUtil.requestURLByGet(url, callback);
  },
  createTask(json,callback){
    let url = '/tasks'
    RequestUtil.requestURLByPost(url, json, callback);
  },
    changeCommunication(json,callback){
        let url = '/CommConfigBean'
        RequestUtil.requestURLByPost(url, json, callback);
    },
    getCommunication(callback){
        let url = '/CommConfigBean'
        RequestUtil.requestURLByGet(url,  callback);
    },
  getLoggingChannels(callback) {
    let url = "/LoggingChEditBean";
    RequestUtil.requestURLByGet(url, callback);
  },

  saveSensorPosition(id, x, y, callback) {
    let url = '/sensors';
    const param = {
      'sensor_id': id,
      'position_x': x,
      'position_y': y,
    }
    RequestUtil.requestURLByPost(url, JSON.stringify(param), callback);
  }
}

export default TestAPI;
