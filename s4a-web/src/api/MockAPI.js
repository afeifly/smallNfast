import RequestUtil from '../util/RequestUtil';

const API_URL = `${RequestUtil.HOST}/device`;

let TestAPI = {

  getUserSettings(username, callback) {
    // Mock user settings
    setTimeout(() => {
      callback([{
        alias_name: "Admin",
        createddate: 1562728616000,
        display_channel_option: [
          {
            "channel_id": {
              "channel_id": 16,
              "logic_channel_description": "Humidity",
              "physical_channel_description": "Humidity",
              "sensor_id": 4,
            },
            "color": "#00B8D9",
            "display_channel_option_id": 204
          }
        ],
        username: "admin"
      }]);
    }, 100);
  },

  getLocations(callback) {
    // Mock locations
    setTimeout(() => {
      callback({
        locations: [
          {
            location_id: 1,
            description: "Factory Floor 1",
            location_index: 0,
            background_img: "",
            sensors: []
          }
        ]
      });
    }, 100);
  },

  getChannels(callback) {
    // Mock channels
    setTimeout(() => {
      callback({
        logging_chs: [
          {
            channel_id: 16,
            location_id: 1,
            sensor_id: 4,
            logic_channel_description: "Humidity",
            sensor_description: "Sensor A",
            unit_in_ascii: "%",
          },
          {
            channel_id: 17,
            location_id: 1,
            sensor_id: 4,
            logic_channel_description: "Temperature",
            sensor_description: "Sensor A",
            unit_in_ascii: "°C",
          }
        ]
      });
    }, 100);
  },

  getMeasurementData(channelId, startTime, stopTime, tableInterval, getDataWay, callback) {
    // Mock measurement data
    setTimeout(() => {
      const measurementData = [];
      const realStartTime = [];
      const pointInterval = [];

      const start = startTime;
      const end = stopTime || (start + 3600000 * 24);

      // Smart Mock Capping: "Just want two days data as a test data range"
      // Even if the app requests years of data (e.g. from 2019), we override the start time
      // to be at most 2 days ago. This prevents infinite loading while keeping app code unchanged.
      let effectiveStart = start;
      const twoDays = 3600000 * 24 * 2;
      if (end - effectiveStart > twoDays) {
        effectiveStart = end - twoDays;
        console.log('--- Mock Data Info: Clamped history range to last 2 days ---');
      }

      // Enforce absolute minimum 1 minute interval and log it
      let requestedStep = tableInterval > 0 ? tableInterval : 300000;
      if (requestedStep < 60000) {
        requestedStep = 60000;
      }
      const step = requestedStep;

      const segmentValues = [];
      let counter = 0;

      console.log('--- Mock Data Generation ---');
      for (let time = effectiveStart; time < end; time += step) {
        // Generate a clean sine wave with variation based on channelId to avoid overlap
        // Use channelId to shift phase and offset value
        const id = parseInt(channelId) || 0;
        const phaseShift = id * 0.5;
        const baseOffset = (id % 5) * 5;

        const val = (25 + baseOffset) + 5 * Math.sin(counter + phaseShift);
        segmentValues.push(val);
        counter += 0.2;

        // Log format: timestamp - value
        console.log(`${new Date(time).toLocaleString()} - ${val.toFixed(2)}`);
      }
      console.log('----------------------------');

      measurementData.push(segmentValues);
      realStartTime.push(effectiveStart);
      pointInterval.push(step);

      callback([{
        channel_id: channelId,
        measurementData: measurementData,
        realStartTime: realStartTime,
        pointInterval: pointInterval,
        min: 15,
        max: 35
      }]);
    }, 100);
  },

  getMutilMeasurementData(channelIds, startTime, tableInterval, getDataWay, callback) {
    if (!channelIds || channelIds.length === 0) {
      callback([]);
      return;
    }
    this.getMeasurementData(channelIds[0], startTime, startTime + 3600000 * 24, tableInterval, getDataWay, callback);
  },

  // Keep other methods empty or minimal to avoid crashes
  getDevices(callback) { },
  getBackupSettings(callback) { },
  updateBackupSettings(json, callback) { },
  getUsers(callback) { },
  checkUserExist(username, callback) { },
  addUser(json, callback) { },
  modifyPsw(username, newpsw, oldpsw, callback) { },
  deleteUser(username, callback) { },
  getFileList(callback) { },
  getFileChannelBean(fileType, fileId, groupId, callback) { },
  initUserUploadDownLoad(user, callback) { },
  getUserUploadDownloadProgress(user, callback) { },
  getSampleList(callback) { },
  getSampleInfo(sid, callback) { },
  getSampleInfoGroup(groupId, callback) { },
  login(username, password, callback) { },
  getManualAddDevice(deviceids, callback) { },
  refreshChannelValues(ids, callback) { },
  getRegisterInfo(callback) { },
  getRegistration(callback) { },
  updateRegistration(json, callback) { },
  getReportBasicSetting(callback) { },
  changeReportBasicSetting(json, callback) { },
  getReportCostCurrency(callback) { },
  getReportList(callback) { },
  changeReportCost(json, callback) { },
  newReport(json, callback) { },
  deleteReport(reportId, callback) { },
  getReportData(rid, startTime, timeType, callback) { },
  getLocationNDevice(callback) { },
  getDetectedResult(callback) { },
  postLocations(json, callback) { },
  getAlarms(callback) { },
  getAlarmHistorys(startTime, endTime, startIndex, type, callback) { },
  getAlarmTime(orderStr, callback) { },
  getLocations4Alarms(callback) { },
  postAlarms(json, callback) { },
  getEmailSetting(callback) { },
  changeEmailSetting(json, callback) { },
  verifyEmail(json, callback) { },
  checkTaskStatus(id, callback) { },
  getSystemStatus(callback) { },
  loginConfirm(user, psw, callback) { },
  createTask(json, callback) { },
  changeCommunication(json, callback) { },
  getCommunication(callback) { },
  getLoggingChannels(callback) { },
  saveSensorPosition(id, x, y, callback) { }
}

// MockAPI implementation
export default TestAPI;
