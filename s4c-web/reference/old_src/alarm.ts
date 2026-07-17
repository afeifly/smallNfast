// store/userAlarm.ts
import { defineStore } from 'pinia';
import request from '/@/utils/request';
import { i18n } from '/@/i18n/index';
import { fetchEventSourceWrapper } from '/@/utils/fetchEventSourceWrapper';
const t = i18n.global.t;

// 如果需要在切换语言后立即获得最新文案，更稳妥的是导出函数而不是静态数组：
export const getDirectionOptions = () => [
  { label: t('message.alarm.up'), value: 1 },
  { label: t('message.alarm.down'), value: -1 },
];
// 下面保留原导出命名（静态生成一次，语言切换后如需更新请改成函数形式）
const directionOptions = [
    { label: t('message.alarm.up'), value: 1 },
    { label: t('message.alarm.down'), value: -1 },
];
interface RecvAlarmSettingInfo {
    isDeleted: boolean,
    isModified: boolean, 
    config_id: number,
    channel_description: string,
    channel_identify_id: string,
    sensor_identify_id: string,
    sensor_description: string,
    location: string,
    measurement_point: string,
    unit: string,
    threshold: number,
    hysteresis: number,
    direction: number,
    relay_id: number,
    relay_address: number,
    relay_ch_id:number,
    pending: boolean,
    delay: number,
    acknowledge_time: number,
    acknowledge_time_set_time: number,
    acknowledge_time_operator: string
}

interface RecvActiveAlarmInfo{
    notification_id: number,
    config_identify_id: number,
    sensor_identify_id: string,
    channel_identify_id: string,
    sensor_description: string,
    channel_description: string,
    channel_unit: string,
    threshold: number,
    direction: string,
    live_value: number,
    relay_id: number,
    relay_address: number,
    trigger_value: number,
    trigger_time: number,
    relay_flag: boolean,
    remain_time: number
    isConfirmed: boolean,
}

interface setAcknowledgeTimeInfo{
    notification_id: number,
    seconds: number,
    operator: string,
}

interface setConfirmTimeInfo{
    notification_id: number,
    switch: boolean,
    operator: string,
}

interface RecvAlarmHistoryInfo {
    alarm_time: number,
    clear_time: number,
    status: string, // "Active" / "Cleared" 等
    sensor_description: string,
    channel_description: string,
    channel_unit: string,
    trigger_value: number,
    threshold: number,
    direction: string, // "up" / "down"
    acknowledge_time: number,
    acknowledge_time_operator: string,
}

interface RecvRelayInfo{
    BoardAddress: number,
    BoardType: number,
    CreateTime: string,
    Description: string,
    RelayChID: number,
    RelayChSetStatus: number,
    RelayDescription: string,
    UniqueId: number,
}
interface FilterCriteriaInfo {
  ChannelNameList: string[];
  LocationList: string[];
  PointList: string[];
  startTime: number;
  endTime: number;
}
export { directionOptions };
export type {RecvAlarmHistoryInfo,RecvAlarmSettingInfo,RecvActiveAlarmInfo,setAcknowledgeTimeInfo,setConfirmTimeInfo,RecvRelayInfo,FilterCriteriaInfo};
export const alarmStore = defineStore('userAlarm', {
    state: () => ({
        alarmSSEController: null as AbortController | null, // 新增用于SSE
        alarmSettingList: [] as RecvAlarmSettingInfo[],
        activeAlarmList: [] as RecvActiveAlarmInfo[],
        relayInfoHash: new Map<number, RecvRelayInfo>(),
    }),
    getters: {
        // activeDismissChannel: (state) => state.alarmSettingList.filter(item => item.dismiss).map(item => item.channel_id),
        relayOptions: (state) => {
            const options = [];
            options.push({ label: `${t('message.common.na')}`, value: 0 });
            for (const [key, relay] of state.relayInfoHash.entries()) {
                if(key > 3){
                    options.push({ label: `${t('message.alarm.relay')} X${key}`, value: key })
                }
                else{
                    options.push({ label: `${t('message.alarm.relay')} ${key}`, value: key });
                }

            }
            return options;
        },
        activeAlarmChannelIdList: (state) => state.activeAlarmList.map(item => item.channel_identify_id),
    },
    actions: {
        openAlarmReceive() {
            // 先关闭旧的 SSE 连接
            if (this.alarmSSEController) {
                this.alarmSSEController.abort();
                this.alarmSSEController = null;
            }
            const controller = new AbortController();
            this.alarmSSEController = controller;
            const store = this;
            fetchEventSourceWrapper('/alarm/notification', {
                method: 'GET',
                signal: controller.signal,
                onmessage(event) {
                    // console.log('Received alarm event:', event);
                    if (!event.data || event.data === "") return;
                    var jsonData = JSON.parse(event.data);
                    // console.log('Parsed alarm event data:', jsonData);
                    const notifications = Array.isArray(jsonData?.notifications) ? jsonData.notifications : [];
                    const confirmed = Array.isArray(jsonData?.confirmed) ? jsonData.confirmed : [];

                    const confirmedIds = new Set(confirmed.map((c: any) => c.notification_id));

                    const newActiveAlarmList = [
                        ...notifications.map((n: any) => ({ ...n, isConfirmed: confirmedIds.has(n.notification_id) })),
                        ...confirmed.filter((c: any) => !notifications.some((n: any) => n.notification_id === c.notification_id)).map((c: any) => ({ ...c, isConfirmed: true }))
                    ];

                    // 保留本地未保存的 isConfirmed 状态
                    if (store.activeAlarmList.length > 0) {
                        newActiveAlarmList.forEach((newItem: RecvActiveAlarmInfo) => {
                            const oldItem = store.activeAlarmList.find(old => old.notification_id === newItem.notification_id);
                            if (oldItem && oldItem.isConfirmed !== newItem.isConfirmed) {
                                // 如果旧项目存在且 isConfirmed 状态不同，则可能存在本地修改。
                                // 在这里，我们决定保留新获取的状态，但可以根据需求调整。
                                // 为了解决用户反馈的问题，我们应该保留旧状态（用户的修改）
                                newItem.isConfirmed = oldItem.isConfirmed;
                            }
                        });
                    }

                    store.activeAlarmList = newActiveAlarmList;
                    // console.log('Updated active alarm list:', store.activeAlarmList);
                },
                onerror(err) {
                    console.log('Alarm SSE error:', err);
                },
            });
        },
        async loadAlarmListSetting() {
            await this.loadRelayConfigs(); // 同步加载继电器配置，确保 alarmSettingList 中的 relay_id 能正确显示文本
            try {
                const res = await request({
                    url: '/alarm/setting',
                    method: 'get',
                });
                // 后端未返回 isNewAlarm / isDeleted，补默认值 false
                this.alarmSettingList = (res.alarm_configs || []).map((item: any) => {
                    let t_relay_id = 0;
                    for (const [key, relay] of this.relayInfoHash.entries()) {
                        if (relay.BoardAddress === item.relay_address && relay.RelayChID === item.relay_ch_id) {
                            t_relay_id = key;
                            break;
                        }
                    }
                    return {
                        isDeleted: false,
                        isModified: false,
                        ...item,
                        relay_id: t_relay_id, // 将匹配到的 t_relay_id 赋值给 item.relay_id，供前端显示使用
                    };
                });
                // console.log('Current alarmListSetting state:', this.alarmSettingList);
                return res;
            } catch (error) {
                console.error('Error fetching alarm settings:', error);
                throw error;
            }
        },
        loadRelayConfigs() {
            this.relayInfoHash.clear();
            const relays: RecvRelayInfo[] = [
                { BoardAddress: 1, RelayChID: 2, RelayChSetStatus: 0, RelayDescription: 'Relay 1' },
                { BoardAddress: 1, RelayChID: 1, RelayChSetStatus: 0, RelayDescription: 'Relay 2' },
                { BoardAddress: 2, RelayChID: 4, RelayChSetStatus: 0, RelayDescription: 'Relay X9' },
                { BoardAddress: 2, RelayChID: 3, RelayChSetStatus: 0, RelayDescription: 'Relay X10' },
                { BoardAddress: 2, RelayChID: 2, RelayChSetStatus: 0, RelayDescription: 'Relay X11' },
                { BoardAddress: 2, RelayChID: 1, RelayChSetStatus: 0, RelayDescription: 'Relay X12' },
                { BoardAddress: 3, RelayChID: 4, RelayChSetStatus: 0, RelayDescription: 'Relay X13' },
                { BoardAddress: 3, RelayChID: 3, RelayChSetStatus: 0, RelayDescription: 'Relay X14' },
                { BoardAddress: 3, RelayChID: 2, RelayChSetStatus: 0, RelayDescription: 'Relay X15' },
                { BoardAddress: 3, RelayChID: 1, RelayChSetStatus: 0, RelayDescription: 'Relay X16' },
            ];
            relays.forEach((relay: RecvRelayInfo) => {
                let baseIndex  = 0;

                if(1 === relay.BoardAddress){
                    baseIndex = 3;
                }
                else{
                    baseIndex = (relay.BoardAddress + 1 ) * 4 + 1;
                }
                this.relayInfoHash.set(baseIndex - relay.RelayChID, relay);
            });
            return Promise.resolve({ config: relays });
        },
        saveAlarmListSetting() {
            // 1) 分类：删除(仅已有)、更新(仅未删的已有)、新增(仅未删的新建)
            const deleteItems = this.alarmSettingList.filter(i => i.isDeleted && i.config_id !== -1 && i.config_id !== 0);
            const updateItems = this.alarmSettingList.filter(i => !i.isDeleted && i.config_id !== -1 && i.config_id !== 0 && i.isModified);
            const addItems = this.alarmSettingList.filter(i => !i.isDeleted && (i.config_id === -1 || i.config_id === 0));

            // 2) 构造删/改/增 payload
            // 批量删除：一次请求携带所有待删除的 config_id
            const deleteConfigIds = deleteItems.map(i => i.config_id);

            const updateAlarmLists = updateItems.map(i => ({
                config_identify_id: i.config_id,
                sensor_identify_id: i.sensor_identify_id,
                channel_identify_id: i.channel_identify_id,
                threshold: i.threshold,
                hysteresis: i.hysteresis,
                direction: i.direction ,
                delay: i.delay,
                relay_id: i.relay_id,
                relay_address:i.relay_address,
                relay_ch_id: i.relay_ch_id,
                pending: i.pending,
                sensor_description: i.sensor_description,
                channel_description: i.channel_description,
                unit: i.unit,
                measurement_point: i.measurement_point,
                location: i.location,
            }));

            const addAlarmLists = addItems.map(i => ({
                sensor_identify_id: i.sensor_identify_id,
                sensor_description: i.sensor_description,
                channel_description: i.channel_description,
                channel_identify_id: i.channel_identify_id,
                unit: i.unit,
                direction: i.direction,
                relay_id: i.relay_id,
                relay_address:i.relay_address,
                relay_ch_id: i.relay_ch_id,
                threshold: i.threshold,
                hysteresis: i.hysteresis,
                location: i.location,
                measurement_point: i.measurement_point,
                delay: i.delay,
                pending: i.pending,
            }));

            // console.log('saveAlarmListSetting -> delete ids:', deleteConfigIds);
            // console.log('saveAlarmListSetting -> update count:', updateAlarmLists);
            // console.log('saveAlarmListSetting -> add count:', addAlarmLists);

            // 3) 顺序执行：先删 -> 再改 -> 最后增
            const run = async () => {
                try {
                    if (deleteConfigIds.length) {
                        await request({
                            url: '/alarm/setting',
                            method: 'DELETE',
                            // 改为通过 query 参数传递逗号分隔的 id，如 ?config_id=43,44,45
                            params: { config_id: deleteConfigIds.join(',') }
                        });
                    }
                    if (updateAlarmLists.length) {
                        await request({
                            url: '/alarm/update-configuration',
                            method: 'POST',
                            data: { config_items: updateAlarmLists }
                        });
                    }
                    if (addAlarmLists.length) {
                        await request({
                            url: '/alarm/setting',
                            method: 'POST',
                            data: { channel_list: addAlarmLists }
                        });
                    }
                    // 刷新列表
                    await this.loadAlarmListSetting();
                    return { deleted: deleteConfigIds.length, updated: updateAlarmLists.length, added: addAlarmLists.length };
                } catch (err) {
                    console.error('saveAlarmListSetting error:', err);
                    throw err;
                }
            };
            return run();
        },
        setAcknowledgeTime(acknowledge_configs:setAcknowledgeTimeInfo[], operator: string) {
            acknowledge_configs.forEach(item => {
                item.operator = operator;
            });
            // console.log('setAcknowledgeTime -> acknowledge_configs:', acknowledge_configs);
            return request({
                url: '/alarm/acknowledge',
                method: 'PATCH',
                data: { acknowledge_configs }
            }).then(res => {
                // console.log('Acknowledge response:', res);
                return res;
            }).catch(err => {
                // console.error('Acknowledge error:', err);
                throw err;
            });
        },
        setConfirmTime(confirm_configs:setConfirmTimeInfo[], operator: string) {
            confirm_configs.forEach(item => {
                item.operator = operator;
            });
            // console.log('setConfirmTime -> confirm_configs:', confirm_configs);
            return request({
                url: '/alarm/confirm',
                method: 'PATCH',
                data: { confirm_configs }
            }).then(res => {
                // console.log('Confirm response:', res);
                return res;
            }).catch(err => {
                // console.error('Confirm error:', err);
                throw err;
            });
        },
        getAlarmHistories(params: { page: number; batch: number; cursor: number; order: string } = { page: 1, batch: 10, cursor: 0, order: 'desc' }) {
            const { page, batch, cursor, order } = params;
            return request({
                url: '/alarm/histories',
                method: 'get',
                params: { page, batch, cursor, order }
            }).then(res => {
                // 后端字段 alarm_history_records
                // console.log('Loaded alarm histories:', res);
                return res;
            }).catch(err => {
                console.error('getAlarmHistories error:', err);
                throw err;
            });
        },
        getAlarmHistoryFilterCriteria(params: { cursor: number} = { cursor: 0 }) {
            const { cursor } = params;
            return request({
                url: '/alarm/history-filter-criteria',
                method: 'get',
                params: { cursor }
            }).then(res => {
                // 后端字段 alarm_history_records
                // console.log('Loaded alarm histories:', res);
                return res;
            }).catch(err => {
                console.error('getAlarmHistories error:', err);
                throw err;
            });
        },
        getAlarmQueryHistoryByFilterCriteria
            (params: { channel_descriptions: string[], locations: string[], measurement_points: string[], start_timestamp: number,
                end_timestamp: number, page_index: number, batch_size: number, cursor: number, order: string }
            = {
                channel_descriptions: [],
                locations: [],
                measurement_points: [],
                start_timestamp: 0,
                end_timestamp: 0,
                page_index: 1,
                batch_size: 10,
                cursor: 0,
                order: ''
            }) {
            const { channel_descriptions, locations, measurement_points, start_timestamp, end_timestamp, page_index, batch_size, cursor, order } = params;
            // 预处理数组 -> 逗号分隔字符串，避免 qs 序列化生成 index 形式
            const channel_descriptions_str = channel_descriptions.join(',');
            const locations_str = locations.join(',');
            const measurement_points_str = measurement_points.join(',');
            return request({
                url: '/alarm/query-history-by-filter-criteria',
                method: 'get',
                params: { 
                    channel_descriptions: channel_descriptions_str,
                    locations: locations_str,
                    measurement_points: measurement_points_str,
                    start_timestamp,
                    end_timestamp,
                    page_index,
                    batch_size,
                    cursor,
                    order 
                }
            }).then(res => {
                // 后端字段 alarm_history_records
                // console.log('Loaded alarm query history:', res);
                return res;
            }).catch(err => {
                console.error('getAlarmHistories error:', err);
                throw err;
            });
        },
    }
});
