export  const TaskCommand = {
  DETECT_DEVICE_TASK: 1,
  START_LOGGER_TASK: 2,
  STOP_LOGGER_TASK: 3,
  MANUAL_ADD_TASK: 8,
	IMPORT_FILE_TASK: 9,
  EXPORT_FILE_TASK: 12,
	REGISTER_TASK: 13,
  CHECK_BACKUP_PATH_EXIST: 43,
  BACKUP_RESET: 44,
  RETRIEVAL_CSTM_BACKUPFILES: 45,
  DELETE_CSTM_BACKUPFILE: 46,
  RESTORE_CSTM: 47,
  VALIDATE_SEND_EMAIL_TASK: 50,
};

export const REPORT_UNIT_TYPE = {
    CUSTEM: 0,
    M3: 1,
    KWH: 2,
    CF: 3,
    M3_PER_H: 4,
    M3_PER_MIN: 5,
    CFM: 6,
    KW: 7,
    HP: 8,
    BAR: 9,
    MPA: 10,
    PSI: 11,
    CTD: 12,
    FTD: 13,
    DEGRE_C: 14,
    DEGRE_F: 15
}

export const CONSUMPTION_UNIT_KWH = ["KWh","kwh","kWh","KWH","Kwh","kwH"];
export const CONSUMPTION_UNIT_M3 = ["m³","m3"];
export const CONSUMPTION_UNIT_CF = ["cf","CF","ft3","ft³"];
export const CONSUMPTION_UNIT_CURRENCY = ["$","€","¥"];
export const CONSUMPTION_UNIT_M3_H = ["m³/h","m3/h"];
export const CONSUMPTION_UNIT_M3_MIN = ["m³/min","m3/min"];
export const CONSUMPTION_UNIT_CFM = ["cfm","CFM","ft3/min","ft³/min"];
export const CONSUMPTION_UNIT_KW = ["KW","kw","kW","Kw"];
export const CONSUMPTION_UNIT_HP = ["HP","hp","hP","Hp"];
export const CONSUMPTION_UNIT_BAR = ["Bar","bar"];
export const CONSUMPTION_UNIT_MPA = ["Mpa","MPa"];
export const CONSUMPTION_UNIT_PSI = ["PSI","psi"];
export const CONSUMPTION_UNIT_CTD = ["°Ctd"];
export const CONSUMPTION_UNIT_FTD = ["°Ftd"];
export const CONSUMPTION_UNIT_C = ["°C"];
export const CONSUMPTION_UNIT_F = ["°F"];


export function getUnitStr (unitType,custemUnit) {
    var unitStr;
    switch(unitType){
        case REPORT_UNIT_TYPE.M3: unitStr = CONSUMPTION_UNIT_M3[0]; break;
        case REPORT_UNIT_TYPE.KWH: unitStr = CONSUMPTION_UNIT_KWH[0]; break;
        case REPORT_UNIT_TYPE.CF: unitStr = CONSUMPTION_UNIT_CF[0]; break;
        case REPORT_UNIT_TYPE.M3_PER_H: unitStr = CONSUMPTION_UNIT_M3_H[0]; break;
        case REPORT_UNIT_TYPE.M3_PER_MIN: unitStr = CONSUMPTION_UNIT_M3_MIN[0]; break;
        case REPORT_UNIT_TYPE.CFM: unitStr = CONSUMPTION_UNIT_CFM[0]; break;
        case REPORT_UNIT_TYPE.KW: unitStr = CONSUMPTION_UNIT_KW[0]; break;
        case REPORT_UNIT_TYPE.HP: unitStr = CONSUMPTION_UNIT_HP[0]; break;
        case REPORT_UNIT_TYPE.BAR: unitStr = CONSUMPTION_UNIT_BAR[0]; break;
        case REPORT_UNIT_TYPE.MPA: unitStr = CONSUMPTION_UNIT_MPA[0]; break;
        case REPORT_UNIT_TYPE.PSI: unitStr = CONSUMPTION_UNIT_PSI[0]; break;
        case REPORT_UNIT_TYPE.CTD: unitStr = CONSUMPTION_UNIT_CTD[0]; break;
        case REPORT_UNIT_TYPE.FTD: unitStr = CONSUMPTION_UNIT_FTD[0]; break;
        case REPORT_UNIT_TYPE.DEGRE_C: unitStr = CONSUMPTION_UNIT_C[0]; break;
        case REPORT_UNIT_TYPE.DEGRE_F: unitStr = CONSUMPTION_UNIT_F[0]; break;
        case REPORT_UNIT_TYPE.CUSTEM: unitStr = custemUnit; break;
    }
    return unitStr;
};


export const  SystemEvent = {
  INVAILID_SESSION: 'invailidSession', 
  UPDATE_LOCALE: 'udpateLocale',
  LOADING_DATA: 'loadingData',
  LOADING_DATA_COMPLETED: 'loadingDataCompleted',
  NO_SELECTED_CHANNELS: "noSelectedChannels",
  CHANGE_SELECTED_CHANNELS:'changeSelectedChannels',
  HIDE_CHANNEL_LIST: 'hideChannelList',
  SHOW_CHANNEL_LIST: 'showChannelList',
  SHOW_YAXIS_SETTING: 'showYAxisSetting',
  CLOSE_YAXIS_SETTING: 'closeYAxisSetting',
  SHOW_CHANNEL_SETTING: 'showChannelSetting',
  UPDATE_CHANNEL_COLOR: 'updateChannelColor',

  UPDATE_YAXIS_VIEW: 'updateYAxisView',
  UPDATE_YAXIS_AND_SPLINES: 'updateYAxisAndSplines',

  INIT_SELECTED_CHANNELS: 'initSelectedChannels',

  START_LOGGER: 'startLogger',
  STOP_LOGGER: 'stopLogger',

  REFRESH_ONLINE_VIEW: 'refreshOnlineView',
  REFRESH_GRAPHIC_VIEW: 'refreshGraphicView',
	
	EXEC_RESTORE: 'execRestore',
};


export const TaskStatus = {
  TASK_INIT: 0,
  TASK_RUNNING: 1,
  TASK_FINISH: 2,
  TASK_ERROR: 3,
};
export const BACKUP_STATUS = {
	FREE: 0,
	BACKUP: 1,
	RESTORE_ING: 2,
	RESTORE_FINISH: 3,
	RESOTRE_ERROR: 4,
}
export const PROTOCOL_TYPE = {
    SUTO: 1,
    MODBUS_TCP: 4,
    IIOT: 7,
}
export const COMMUNICATION_TYPE = {
    USB: 1,
    ETHERNET: 2,
    RS485: 3,
    ETHERNET_RS485: 4,
    MODBUS_TCP_RTU: 5,
    IIOT: 7,
}
export const TaskParamDataType = {
  BOOLEAN: 1,
  BYTE: 2,
  INT: 3,
  LONG: 4,
  FLOAT: 5,
  DOUBLE: 6,
  STRING: 7,
};
export function checkEmail(email) {
  return /[\w\d\.-]+@[\w\d\.-]+\.[\w\d\.-]+/.test(email);
}
export function checkSN(sn){
	return /[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}/.test(sn)
}
