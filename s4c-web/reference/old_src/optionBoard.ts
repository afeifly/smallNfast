// store/userAlarm.ts
import { defineStore } from 'pinia';
import request from '/@/utils/request';
import { i18n } from '/@/i18n/index';
import { graphicDataStore } from '/@/stores/graphicData';
import { restartMeaLoggerAlarm } from '/@/stores/system';
import { usecfgFile } from '/@/api/cfgfile/index';
const cfgfile = usecfgFile();

const t = i18n.global.t;
import {ChannelCommonInfo,RecordEventLogInfo} from '/@/stores/sensorInfo';
const getOptionBoardTypes = () => [
    { value: 0, label: t('message.sensorCfg.analogDigitalInput.analogModule')},
    { value: 1, label: t('message.sensorCfg.analogDigitalInput.digitalModule') },
];
const TerminalTypes = [
    { value: 0, label: 'N/A' },
    { value: 4, label: 'X9' },
    { value: 3, label: "X10" },
    { value: 2, label: 'X11' },
    { value: 1, label: "X12" },
    { value: 8, label: 'X13' },
    { value: 7, label: "X14" },
    { value: 6, label: 'X15' },
    { value: 5, label: "X16" },
];
const getAnalogBoardTypes = () => [
    { value: 0, label: '0...20mA' },
    { value: 1, label: '4...20mA' },
    { value: 2, label: '0.5...4.5V' },
    { value: 3, label: '0...10V' },
];
const getDigitalBoardTypes = () => [
    { value: 0, label: t('message.sensorCfg.analogDigitalInput.counter') },
    { value: 1, label: t('message.sensorCfg.analogDigitalInput.runTime') },
    { value: 2, label: t('message.sensorCfg.analogDigitalInput.status') },
];
const getOptionNames = () => [
    { value: '0X108A', label: t('message.common.relayBoard') },
    { value: '0X108B', label: t('message.common.currentBoard') },
    { value: '0X108C', label: t('message.common.voltageBoard') },
    { value: '0X108D', label: t('message.common.digitalBoard') },
    { value: '0X108E', label: t('message.common.relayBoard') },
]
const getUintTypes = () => [
    { value: 0, label: t('message.common.unitTypeName.custom') },
    { value: 1, label: t('message.common.unitTypeName.dewPoint') },
    { value: 2, label: t('message.common.unitTypeName.humidity') },
    { value: 3, label: t('message.common.unitTypeName.temperature') },
    { value: 4, label: t('message.common.unitTypeName.pressure') },
    { value: 5, label: t('message.common.unitTypeName.velocity') },
    { value: 6, label: t('message.common.unitTypeName.concentration') },
    { value: 7, label: t('message.common.unitTypeName.flow') },
    { value: 8, label: t('message.common.unitTypeName.volume') },
    { value: 9, label: t('message.common.unitTypeName.mass') },
    { value: 10, label: t('message.common.unitTypeName.voltage') },
    { value: 11, label: t('message.common.unitTypeName.power') },
    { value: 12, label: t('message.common.unitTypeName.energy') },
];
const getRuntimeValueTypes = () => [
    { value: 0, label: t('message.sensorCfg.analogDigitalInput.on') },
    { value: 1, label: t('message.sensorCfg.analogDigitalInput.off') },
];
const getStatusValueTypes = () => [
    { value: 0, label: t('message.sensorCfg.analogDigitalInput.good') },
    { value: 1, label: t('message.sensorCfg.analogDigitalInput.failure') },
];

// 统一的扩展板信息接口，使用可选字段区分模拟/数字板的特有属性
interface OptionBoardInfo {
    // 公共字段
    OptionBoardType: 0 | 1; // 0: 模拟模块板, 1: 数字模块板
    shown: boolean;
    OptionBoardID: number; 
    ChannelId: number;
    TerminalNo: number;
    OptionBoardAddress: number;
    SensorDescription: string;
    ChannelDescription: string;
    Location: string,
    Meapoint: string,
    CreateTime: string;
    ChannelValid: boolean;  //channel 是否有效

    // 模拟板特有字段 (OptionBoardType === 0)
    AnalogSignalType?: number;
    UintType?: number;
    PreDefineUnit?: string;
    Resolution?: number;
    MinScale?: number;
    MaxScale?: number;

    // 数字板特有字段 (OptionBoardType === 1)
    DigitalType?: number;
    DisplayUnit?: string;
    Status0Value?: number;
    Status1Value?: number;
}

enum BoardCategory {
    Unknown = -1,           ///< Unknown category
    Analog = 0,             ///< Analog input boards (AnalogCurrent, AnalogVoltage)
    Digital = 1,            ///< Digital input boards (DigitalInput)
    Relay = 3               ///< Relay boards (Relay2Ch, Relay4Ch)
};

interface RecvCheckOptionBoardInfo {
    address:number;
    category:number;
    deviceId:string;
    instance:boolean;
    type:number;
    sn:number;
    fw:number;
    hw:number;
    typeName:string;
}

interface UnitOption {
    unit: string;  // 单位符号
    resolution: number; // 显示精度
}
// 按测量类型(UintTypes.value)提供单位列表，供下拉选择
const UnitOptionsByType: Record<number, UnitOption[]> = {
    // 0: Custom
    0: [
    ],
    // 1: Dew point
    1: [
        { unit: '°C Td', resolution: 0.1 },
        { unit: '°F Td', resolution: 0.1 },
        { unit: '°C Td atm.', resolution: 0.1 },
        { unit: '°F Td atm.', resolution: 0.1 },
    ],
    // 2: Humidity
    2: [
        { unit: '% RH', resolution: 0.001 },
        { unit: 'g/m³', resolution: 0.01 },
        { unit: 'mg/m³', resolution: 0.1 },
        { unit: 'g/m³ atm.', resolution: 0.01 },
        { unit: 'mg/m³ atm.', resolution: 0.1 },
        { unit: 'ppm(v)', resolution: 0.01 },
        { unit: 'g/kg', resolution: 0.001 },
    ],
    // 3: Temperature
    3: [
        { unit: '°C', resolution: 0.1 },
        { unit: '°F', resolution: 0.1 },
    ],
    // 4: Pressure
    4: [
        { unit: 'bar(g)', resolution: 0.01 },
        { unit: 'mbar(g)', resolution: 10 },
        { unit: 'psi(g)', resolution: 0.1 },
        { unit: 'Pa(g)', resolution: 1000 },
        { unit: 'hPa(g)', resolution: 10 },
        { unit: 'kPa(g)', resolution: 1 },
        { unit: 'MPa(g)', resolution: 0.001 },
        { unit: 'bar(abs)', resolution: 0.01 },
        { unit: 'mbar(abs)', resolution: 10 },
        { unit: 'psi(abs)', resolution: 0.1 },
        { unit: 'Pa(abs)', resolution: 1000 },
        { unit: 'hPa(abs)', resolution: 10 },
        { unit: 'kPa(abs)', resolution: 1 },
        { unit: 'MPa(abs)', resolution: 0.001 },
    ],
    // 5: Velocity
    5: [
        { unit: 'm/s', resolution: 0.1 },
        { unit: 'ft/min', resolution: 1 },
        { unit: 'sm/s', resolution: 0.1 },
        { unit: 'sft/min', resolution: 1 },
        { unit: 'Nm/s', resolution: 0.1 },
        { unit: 'Nft/min', resolution: 1 },
    ],
    // 6: Concentration
    6: [
        { unit: 'ppm(v)', resolution: 0.01 },
        { unit: 'mg/m³', resolution: 0.001 },
        { unit: 'cn/m³', resolution: 1 },
    ],
    // 7: Flow
    7: [
        { unit: 'm³/h', resolution: 0.1 },
        { unit: 'm³/min', resolution: 0.1 },
        { unit: 'l/min', resolution: 0.1 },
        { unit: 'l/s', resolution: 0.1 },
        { unit: 'cfm', resolution: 0.1 },
        { unit: 'cfh', resolution: 0.1 },
        { unit: 'Nm³/h', resolution: 0.1 },
        { unit: 'Nm³/min', resolution: 0.1 },
        { unit: 'Nl/min', resolution: 0.1 },
        { unit: 'Nl/s', resolution: 0.1 },
        { unit: 'Ncfm', resolution: 0.1 },
        { unit: 'Ncfh', resolution: 0.1 },
        { unit: 'kg/h', resolution: 0.1 },
        { unit: 'kg/min', resolution: 0.01 },
        { unit: 'kg/s', resolution: 1 },
        { unit: 't/h', resolution: 1 },
        { unit: 'lb/h', resolution: 0.1 },
    ],
    // 8: Volume
    8: [
        { unit: 'm³', resolution: 1 },
        { unit: 'l', resolution: 1 },
        { unit: 'cf', resolution: 1 },
        { unit: 'Nm³', resolution: 1 },
        { unit: 'Nl', resolution: 1 },
        { unit: 'Ncf', resolution: 1 },
        { unit: 'gal', resolution: 1 },
    ],
    // 9: Mass
    9: [
        { unit: 'kg', resolution: 1 },
        { unit: 't', resolution: 1 },
        { unit: 'lb', resolution: 1 },
    ],
    // 10: Voltage
    10: [
        { unit: 'V', resolution: 0.1 },
        { unit: 'kV', resolution: 0.001 },
    ],
    // 11: Power
    11: [
        { unit: 'W', resolution: 1 },
        { unit: 'kW', resolution: 0.001 },
        { unit: 'VA', resolution: 1 },
        { unit: 'kVA', resolution: 0.001 },
        { unit: 'kVAr', resolution: 0.001 },
    ],
    // 12: Energy
    12: [
        { unit: 'Wh', resolution: 1 },
        { unit: 'kWh', resolution: 0.001 },
        { unit: 'Vah', resolution: 1 },
        { unit: 'kVAh', resolution: 0.001 },
        { unit: 'kVArh', resolution: 0.001 },
    ],
};

const OptionResolutionArray = [
    { id: -3, name: '1000' },
    { id: -1, name: '10' },
    { id: 0, name: '1' },
    { id: 1, name: '0.1' },
    { id: 2, name: '0.01' },
    { id: 3, name: '0.001' },
    { id: 4, name: '0.0001' },
    { id: 5, name: '0.00001' },
    { id: 6, name: '0.000001' },
];


function getUnitListByType(type: number): UnitOption[] {
    return UnitOptionsByType[type] ?? [];
}

export { getAnalogBoardTypes,getOptionNames, getDigitalBoardTypes, getUintTypes, UnitOptionsByType, 
    getUnitListByType, getOptionBoardTypes ,TerminalTypes,OptionResolutionArray,getStatusValueTypes,getRuntimeValueTypes
};
export type { OptionBoardInfo, UnitOption, RecvCheckOptionBoardInfo ,BoardCategory};
export const optionBoardStore = defineStore('userOptionBoard', {
    state: () => ({
        optionBoardConfig: [] as OptionBoardInfo[],
        optionBoardFileDir: '/data/configs/sensorlist/',
        optionBoardFilename: 'cfgOptionBoard.json',
        checkOptionBoardFilename: 'checkOptionBoard.json',
        checkOptionBoardList: [] as RecvCheckOptionBoardInfo[],
        // 新增：CreateTime -> ChannelCommonInfo 的映射
        optionBoardCommonHash: new Map<string, ChannelCommonInfo>(),
    }),
    getters: {

    },
    actions: {
        getOptionBoardConfig() {
            return cfgfile
                .getfile(this.optionBoardFilename, this.optionBoardFileDir)
                .then((response) => {
                // console.log('getOptionBoardConfig', response);
                try {
                    let payload: any;
                    if (response && typeof response === 'object' && 'config' in response) {
                        payload = (response as any).config;
                    } else if (response && typeof response === 'object' && 'data' in response) {
                        payload = (response as any).data;
                    } else if (response && typeof response === 'object' && 'cfgOptionBoard' in response) {
                        payload = (response as any).cfgOptionBoard;
                    } else {
                        payload = response;
                    }

                    if (Array.isArray(payload)) {
                        this.optionBoardConfig = payload as OptionBoardInfo[];
                        this.buildChannelCommonHash();
                        return this.optionBoardConfig;
                    }

                    if (typeof payload === 'string' && payload.trim().length > 0) {
                        const parsed = JSON.parse(payload);
                        if (parsed && typeof parsed === 'object' && 'config' in parsed) {
                            const configPayload = (parsed as any).config;
                            this.optionBoardConfig = Array.isArray(configPayload) ? configPayload : [];
                        } else {
                            this.optionBoardConfig = Array.isArray(parsed) ? parsed : [];
                        }
                        this.buildChannelCommonHash();
                        return this.optionBoardConfig;
                    }

                    // 兜底：不可解析则置空
                    this.optionBoardConfig = [];
                    this.buildChannelCommonHash();
                    return this.optionBoardConfig;
                } catch (error) {
                    console.error('Failed to parse option board config:', error);
                    this.optionBoardConfig = [];
                    return this.optionBoardConfig;
                }
            })
            .catch((error) => {
                console.error('Failed to load option board config:', error);
                this.optionBoardConfig = [];
                return this.optionBoardConfig;
            });
        },
        saveOptionBoardConfig(boardConfig: OptionBoardInfo[]) {
            this.optionBoardConfig = boardConfig;
            var allinonecfg = {
				cfgOptionBoard: this.optionBoardConfig,
			};
            return cfgfile
				.savefile(this.optionBoardFilename, allinonecfg, this.optionBoardFileDir)
				.then((res) => {
                    restartMeaLoggerAlarm().then(() => {
                        this.getOptionBoardConfig();
                        console.log('Services restarted successfully after saving option board config.');
                    }).catch((err) => {
                        console.error('Failed to restart services after saving option board config:', err);
                    });
                    try {
                        const gStore = graphicDataStore();
                        if (gStore && typeof gStore.refreshOptionGraphicChannel === 'function') {
                            gStore.refreshOptionGraphicChannel(this.optionBoardConfig);
                        } else {
                            console.warn('refreshOptionGraphicChannel not available on graphicDataStore instance');
                        }
                    } catch (e) {
                        console.warn('refreshOptionGraphicChannel invoke failed:', e);
                    }
				})
				.catch((err) => {
                    console.log('err=', err);
					if (err.response) {
						console.log('response=', err.response);
					}
					if (err.message) {
						console.log('message=', err.message);
					}
            });
        },
        buildChannelCommonHash() {
            const next = new Map<string, ChannelCommonInfo>();
            this.optionBoardConfig.forEach((optionBoardChannel) => {
                const commonInfo: ChannelCommonInfo = {
                    show: true,
                    sensorDescription: optionBoardChannel.SensorDescription,
                    channelDescription: optionBoardChannel.ChannelDescription,
                    sensorCreateTime: optionBoardChannel.CreateTime,
                    channelCreateTime: optionBoardChannel.CreateTime,
                };
                next.set(optionBoardChannel.CreateTime, commonInfo);
            });
            this.optionBoardCommonHash = next;
            // console.log('optionBoardCommonHash', this.optionBoardCommonHash);
        },
        getOptionBoardChannelByCreateTime(createTime: string): ChannelCommonInfo | undefined {
            if (!createTime || typeof createTime !== 'string') return undefined;

            if(!this.optionBoardCommonHash.has(createTime)){
                return undefined;
            }

            return this.optionBoardCommonHash.get(createTime);
        },
        updateEventLog(oldOptionBoard: OptionBoardInfo[], newOptionBoard: OptionBoardInfo[]) {
            // console.log('updateEventLog called with oldOptionBoard:', oldOptionBoard, 'newOptionBoard:', newOptionBoard);
            const eventLogInfo: RecordEventLogInfo = {
                addEventLog: { type: 'CREATE', operation: 'SENSORLIST', old_data: 'None', new_data: '' },
                deleteEventLog: { type: 'DELETE', operation: 'SENSORLIST', old_data: '', new_data: '' },
                updateEventLog: { type: 'UPDATE', operation: 'SENSORLIST', old_data: '', new_data: '' },
            };

            const oldMap = new Map(oldOptionBoard.map(item => [item.CreateTime, item]));
            const newMap = new Map(newOptionBoard.map(item => [item.CreateTime, item]));

            let add_new_data = '';
            let del_old_data = '';
            let del_new_data = '';
            let upd_old_data = '';
            let upd_new_data = '';

            // Check for additions and updates
            newMap.forEach((newItem, createTime) => {
                const oldItem = oldMap.get(createTime);
                if (!oldItem) {
                    // Added
                    add_new_data += `Add Analog/Digital Input: ${newItem.SensorDescription} - ${newItem.ChannelDescription}\n`;
                } else {
                    // Potentially updated
                    let t_old_data = "", t_new_data = "", hasDiff = false;
                    if (oldItem.SensorDescription !== newItem.SensorDescription) {
                        t_old_data += `Sensor Description: ${oldItem.SensorDescription}, `;
                        t_new_data += `Sensor Description: ${newItem.SensorDescription}, `;
                        hasDiff = true;
                    }
                    if (oldItem.ChannelDescription !== newItem.ChannelDescription) {
                        t_old_data += `Channel Description: ${oldItem.ChannelDescription}, `;
                        t_new_data += `Channel Description: ${newItem.ChannelDescription}, `;
                        hasDiff = true;
                    }
                    // Compare other relevant fields based on OptionBoardType
                    if (newItem.OptionBoardType === 0) { // Analog
                        if (oldItem.AnalogSignalType !== newItem.AnalogSignalType) {
                            hasDiff = true;
                        }
                        if (oldItem.MinScale !== newItem.MinScale) {
                            t_old_data += `Min Scale: ${oldItem.MinScale}, `;
                            t_new_data += `Min Scale: ${newItem.MinScale}, `;
                            hasDiff = true;
                        }
                        if (oldItem.MaxScale !== newItem.MaxScale) {
                            t_old_data += `Max Scale: ${oldItem.MaxScale}, `;
                            t_new_data += `Max Scale: ${newItem.MaxScale}, `;
                            hasDiff = true;
                        }
                    } else { // Digital
                        if (oldItem.DigitalType !== newItem.DigitalType) {
                            hasDiff = true;
                        }
                    }

                    if (hasDiff) {
                        upd_old_data += `Analog/Digital Input [${newItem.SensorDescription} - ${newItem.ChannelDescription}]: ${t_old_data.slice(0, -2)}\n`;
                        upd_new_data += `Analog/Digital Input [${newItem.SensorDescription} - ${newItem.ChannelDescription}]: ${t_new_data.slice(0, -2)}\n`;
                    }
                    oldMap.delete(createTime); // Mark as processed
                }
            });

            // Check for deletions
            oldMap.forEach((oldItem, createTime) => {
                del_old_data += `Analog/Digital Input: ${oldItem.SensorDescription} - ${oldItem.ChannelDescription}\n`;
                del_new_data += `Analog/Digital Input: ${oldItem.SensorDescription} - ${oldItem.ChannelDescription} be deleted\n`;
            });

            if (add_new_data) {
                eventLogInfo.addEventLog.new_data = add_new_data;
            }
            if (del_old_data) {
                eventLogInfo.deleteEventLog.old_data = del_old_data;
                eventLogInfo.deleteEventLog.new_data = del_new_data;
            }
            if (upd_old_data) {
                eventLogInfo.updateEventLog.old_data = upd_old_data;
                eventLogInfo.updateEventLog.new_data = upd_new_data;
            }

            const logs = [
                eventLogInfo.addEventLog,
                eventLogInfo.deleteEventLog,
                eventLogInfo.updateEventLog,
            ];

            logs.forEach((payload) => {
                if (!payload) return;

                // For CREATE and UPDATE, new_data must be non-empty
                if ((payload.type === 'CREATE' || payload.type === 'UPDATE') && (!payload.new_data || payload.new_data.trim() === '')) {
                    return;
                }

                // For DELETE, old_data must be non-empty
                if (payload.type === 'DELETE' && (!payload.old_data || payload.old_data.trim() === '')) {
                    return;
                }
                const body = {
                    type: payload.type,
                    operator: payload.operation,
                    old_data: payload.old_data,
                    new_data: payload.new_data,
                };
                // console.log('Sending event log:', body);
                request.post('/event/log', body)
                    .then(() => {
                        // console.log('Event log sent successfully');
                    })
                    .catch((err:any) => {
                        console.log('sendAuditTrailMessage error=', err);
                    });
            });
        },
        getOptionBoardInfo() {
            return cfgfile
                .getfile(this.checkOptionBoardFilename, this.optionBoardFileDir)
                .then((response) => {
                    // console.log('getOptionBoardInfo response =', response);
                    try {
						let payload: any;
						if (response && typeof response === 'object' && 'data' in response) {
							payload = (response as any).data;
						} else {
							payload = response;
						}
	
						if (Array.isArray(payload)) {
							this.checkOptionBoardList = payload as RecvCheckOptionBoardInfo[];
							return this.checkOptionBoardList;
						}
	
						if (typeof payload === 'string' && payload.trim().length > 0) {
							const parsed = JSON.parse(payload);
							this.checkOptionBoardList = Array.isArray(parsed) ? parsed : [];
							return this.checkOptionBoardList;
						}
	
						// 兜底：不可解析则置空
						this.checkOptionBoardList = [];

						return this.checkOptionBoardList;
					} catch (error) {
						// console.log('Failed to parse option board info:', error);
						this.checkOptionBoardList = [];
						return this.checkOptionBoardList;
					}
                })
                .catch((err) => {
                    console.log('error', err);
					this.checkOptionBoardList = [];
					return this.checkOptionBoardList;
                });
        },
    }
});
