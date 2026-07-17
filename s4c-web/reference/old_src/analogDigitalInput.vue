<template>
    <div class="display-page">
        <div class="display-page-common-layout">
            <el-container>
                <el-header class="display-page-common-layout-header">
                    <h3 class="display-page-common-layout-header-title" >{{ $t('message.router.sensorConfiguration.analogDigitalInput') }}</h3>
                    <el-button 
                    :disabled="loggerRunning || !userInfo.canSetSensor || userOptionBoard.checkOptionBoardList.length < 2"
                    :id="`add-suto-sensor-button`" 
                    class="create-sensor-button font-size-16" 
                    @click="createAnalogDigitalInput"
                    >
                        <img src="/@/assets/icons/add.svg" alt="Icon" class="create-sensor-button-icon" />
                        {{$t('message.sensorCfg.analogDigitalInput.addAnalogDigitalInput') }}
                    </el-button>
                </el-header>
                <el-main class="display-page-common-layout-content">
                    <el-table
                        :data="recvAnalogDigitalInputSensors"         
                        :header-cell-style="{ backgroundColor: '#f3f3f3', color:'black'}"
                        :cell-style="{ textAlign: 'left' }"
                        :header-fixed="true"
                        style="width: 100%"
                        :empty-text="$t('message.sensorCfg.analogDigitalInput.addTips')"
                        :scrollbar-always-on="false"
                        height="100%"
                    >
                        <!-- 模块类型 -->
                        <el-table-column :label="$t('message.sensorCfg.analogDigitalInput.module')" min-width="150px">
                            <template #default="scope">
                                <span>{{ formatOptionBoardType(scope.row.OptionBoardType) }}</span>
                            </template>
                        </el-table-column>
                        <!-- 端子号 -->
                        <el-table-column :label="$t('message.sensorCfg.analogDigitalInput.terminal')" min-width="116px">
                            <template #default="scope">
                                <span>{{ formatTerminal(scope.row.TerminalNo) }}</span>
                            </template>
                        </el-table-column>
                        <!-- 传感器/通道描述 -->
                        <el-table-column :label="$t('message.common.sensor')"  min-width="150px">
                            <template #default="scope">
                                <span>{{ scope.row.SensorDescription }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column :label="$t('message.common.channel')" min-width="150px">
                            <template #default="scope">
                                <span>{{ scope.row.ChannelDescription }}</span>
                            </template>
                        </el-table-column>
                        <!-- 信号类型 -->
                        <el-table-column :label="$t('message.sensorCfg.analogDigitalInput.signal')" min-width="110px">
                            <template #default="scope">
                                <span>{{ formatSignal(scope.row) }}</span>
                            </template>
                        </el-table-column>
                        <!-- 操作列 -->
                        <el-table-column :label="$t('message.common.operate')" min-width="154px" align="center">
                            <template #default="scope">
                                <div style="display: flex; justify-content: center; align-items: center; height: 100%; gap:10px">
                                    <el-button 
                                        link
                                        :disabled="!userInfo.canSetSensor"
                                        style="height: 47px; width: 47px; padding: 0px;"
                                        @click="handleEdit(scope.$index, scope.row)"
                                    >
                                        <img :src="editIcon" alt="Icon" class="table-icon"/>
                                    </el-button>
                                    <el-button
                                        link
                                        :disabled="!userInfo.canSetSensor"
                                        style="height: 47px; width: 47px; padding: 0px;"
                                        @click="handleDelete(scope.$index, scope.row)"
                                    >
                                        <img :src="deleteIcon" alt="Icon" class="table-icon"/>
                                    </el-button>
                                </div>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-main>
                <el-footer class="display-page-common-layout-footer justify-footer-right">
                    <el-button 
                        class="footer-button save-button" 
                        :class="{ 'save-button-disabled': !configureChanged }"
                        :disabled="loggerRunning || !userInfo.canSetSensor || !configureChanged"
                        @click="saveToDevice"
                    >
                        {{ $t('message.common.save2Device') }}
                    </el-button>
                </el-footer>
            </el-container>
            <ConfigOptionBoard ref="configOptionBoardRef" @confirm="onConfigOptionBoardConfirm" @cancel="onConfigOptionBoardCancel" />      
        </div> 
    <SaveSensorProgress
        v-if="showSaveSensorProgress"
        v-model="showSaveSensorProgress"
        :duration="15000"
        @close="closeSaveSensorProgress"
    />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import ConfigOptionBoard from '/@/components/sensorConfiguration/configOptionBoard.vue'
import { ElMessage, ElNotification } from 'element-plus'
const configOptionBoardRef = ref<InstanceType<typeof ConfigOptionBoard> | null>(null);
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useUserInfo } from '/@/stores/userInfo'
const userInfo = useUserInfo()
import editIcon from '/@/assets/icons/sensorEdit.svg'
import deleteIcon from '/@/assets/icons/sensorDelete.svg'
import SaveSensorProgress from '/@/components/sensorConfiguration/saveSensorProgress.vue';
import { showStyledMessageBox } from '/@/utils/messageBox';
import type { Action } from 'element-plus'
import { storeToRefs } from 'pinia';
import { useThemeConfig } from '/@/stores/themeConfig';
const storesThemeConfig = useThemeConfig();
const { themeConfig } = storeToRefs(storesThemeConfig);
const loggerRunning = computed(() => {
    if(themeConfig.value.loggerState ===1 || themeConfig.value.loggerState === 2){
        return true;
    }
    return false;
});
const currentConfigureMode = ref(false); // false: edit mode, true: add mode
import { optionBoardStore, OptionBoardInfo, getOptionBoardTypes, TerminalTypes, getAnalogBoardTypes, getDigitalBoardTypes, } from '/@/stores/optionBoard';
const userOptionBoard = optionBoardStore();
const recvAnalogDigitalInputSensors = ref<OptionBoardInfo[]>([]);
const showSaveSensorProgress = ref(false); // 控制是否显示SaveSensorProgress弹窗
function createAnalogDigitalInput() {
    currentConfigureMode.value = true;
    const existingTerminalNos = recvAnalogDigitalInputSensors.value.map(sensor => sensor.TerminalNo);
    // 新增模式：打开弹窗，内部会初始化空数据
    configOptionBoardRef.value?.open(currentConfigureMode.value, undefined, existingTerminalNos);
    // console.log('Create Analog & Digital Input clicked');
}
function handleEdit(index: number, row: OptionBoardInfo) {
    currentConfigureMode.value = false;
    // 传递除当前行外的所有已用端子号
    const existingTerminalNos = recvAnalogDigitalInputSensors.value
        .filter(sensor => sensor.CreateTime !== row.CreateTime)
        .map(sensor => sensor.TerminalNo);
    // 修改模式：传入当前行数据用于编辑
    configOptionBoardRef.value?.open(currentConfigureMode.value, row, existingTerminalNos);
    // console.log('Edit clicked for index:', index, 'row:', row);
}
import warnIcon from '/@/assets/icons/message-warning.svg';
function handleDelete(index: number, row: OptionBoardInfo) {
    console.log('Delete clicked for index:', index, 'row:', row);

    showStyledMessageBox(
    t('message.sensorCfg.analogDigitalInput.deleteTitle'),
    t('message.sensorCfg.analogDigitalInput.deleteTips'),
    'warnRed',
    {
        confirmButtonText: t('message.common.delete'),
        showCancelButton: true,
        cancelButtonText: t('message.common.cancel'),
        customClass: 'firmware-update-message-box',
        callback: (action: Action) => {
            if (action === 'confirm') {
                recvAnalogDigitalInputSensors.value.splice(index as number, 1);
                configureChanged.value = true;
            }
        },
    }
);
}
onMounted(async () => {
    if (loggerRunning.value) {
        ElMessage.warning(t('message.messageTips.loggerRunningTips'));
    }
    await userOptionBoard.getOptionBoardInfo();
    try {
        await userOptionBoard.getOptionBoardConfig();
        // 将 store 中的配置同步到本地表格数据
        recvAnalogDigitalInputSensors.value = Array.isArray(userOptionBoard.optionBoardConfig)
            ? [...userOptionBoard.optionBoardConfig]
            : [];
        // console.log('Loaded Option Board Config into table:', recvAnalogDigitalInputSensors.value);
    } catch (e) {
        console.log('Failed to fetch Option Board Config', e);
    }
});
const configureChanged = ref(false);
// 处理配置确认：新增则追加，修改则替换
function onConfigOptionBoardConfirm(payload: { isAdd: boolean; optionBoardInfo: OptionBoardInfo }) {
    const { isAdd, optionBoardInfo } = payload;
    optionBoardInfo.ChannelId = 2000 + optionBoardInfo.TerminalNo;
    if (isAdd) {
        // 若新增无 CreateTime，则补充唯一标识
        if (!optionBoardInfo.CreateTime || optionBoardInfo.CreateTime === '') {
            optionBoardInfo.CreateTime = Date.now().toString();
        }
        recvAnalogDigitalInputSensors.value.unshift(optionBoardInfo); // 新增的配置放在最前面显示
    } else {
        const index = recvAnalogDigitalInputSensors.value.findIndex((item) => item.CreateTime === optionBoardInfo.CreateTime);
        if (index !== -1) {
            recvAnalogDigitalInputSensors.value[index] = optionBoardInfo;
        }
    }
    // console.log('ConfigOptionBoard Confirm', optionBoardInfo);
    configureChanged.value = true;
}
function onConfigOptionBoardCancel() {
    console.log('ConfigOptionBoard Cancel');
}
import { locationInfoStore } from '/@/stores/location';
const userLocationBoard = locationInfoStore();
var saveResult = false
function saveToDevice() {
    console.log('Save to Device clicked');
        // 显示进度条弹窗
    showSaveSensorProgress.value = true;

    const oldOptionBoardList = JSON.parse(JSON.stringify(userOptionBoard.optionBoardConfig));
    // 保存当前表格数据到设备
    userOptionBoard
        .saveOptionBoardConfig(recvAnalogDigitalInputSensors.value)
        .then(() => {
            saveResult = true;
            configureChanged.value = false;
            // 保存成功后同步回 store
            userOptionBoard.optionBoardConfig = [...recvAnalogDigitalInputSensors.value];

            userOptionBoard.updateEventLog(oldOptionBoardList, userOptionBoard.optionBoardConfig);
            userLocationBoard.checkLocationFile().then(() => {
                userLocationBoard.checkLayoutFile(); // 保存成功后刷新图表数据
                }).catch((error:any) => {
                    console.error('Error checking layout file after saving sensors:', error);
            });
        })
        .catch((err) => {
            saveResult = false;
            console.log('Save to Device failed', err);
        });
}

// 显示帮助：模块类型/端子/信号/精度/状态
function formatOptionBoardType(val?: number){
    const f = getOptionBoardTypes().find(i => i.value === val);
    return f ? f.label : '';
}
function formatTerminal(val?: number){
    const f = TerminalTypes.find(i => i.value === val);
    return f ? f.label : '';
}
function formatSignal(row: OptionBoardInfo){
    if (row.OptionBoardType === 0) {
        const f = getAnalogBoardTypes().find(i => i.value === row.AnalogSignalType);
        return f ? f.label : '';
    }
    const f = getDigitalBoardTypes().find(i => i.value === row.DigitalType);
    return f ? f.label : '';
}
function closeSaveSensorProgress() {
    showSaveSensorProgress.value = false;
    if (saveResult) {
        ElNotification({
            title: t('message.common.success'),
            message: t('message.messageTips.saveToDeviceSuccessfully'),
            type: 'success',
            position: 'bottom-right',
            duration: 3000
        });
        configureChanged.value = false;
    } else {
        ElNotification({
            title: t('message.common.error'),
            message: t('message.sensorCfg.addSutoSensor.saveToDeviceFailed'),
            type: 'error',
            position: 'bottom-right',
            duration: 5000
        });
    }
    saveResult = false;
}
</script>

<style scoped>
/* 表体字体 20px，非加粗 */
:deep(.el-table__body td .cell) {
  font-size: 20px !important;
  font-weight: normal !important;
  color: #000 !important;
}
/* :deep(.el-table__body-wrapper) {
  overflow-x: hidden !important;
}
:deep(.el-scrollbar__bar.is-horizontal) {
  display: none !important;
} */
/* 编辑行的样式 */
/* :deep(.editing-row) {
    background-color: #00ab84 !important;
}

:deep(.editing-row td) {
    background-color: #00ab84 !important;
} */

.footer-button{
    height: 40px;
    min-height: 40px;
    font-size: 18px;
    font-weight: 500;
}

.import-button{
    background-color: white !important;
    border-color: #00AB84 !important;
    color: #00AB84 !important;
}

.save-button{
    background-color: #00ab84 !important;
    border-color: #00ab84 !important;
    color: white;
}


.footer-button-icon{  
    margin-right: 8px; /* 调整图标与文本的间距 */
    width: 16px; /* 设置图标大小 */
    height: 16px;
}
.el-table :deep(.el-input--large .el-input__wrapper) {
    font-size: 20px;
    line-height: 48px;
    min-height: 48px;
    padding: 0px;
    min-width: 300px;
}
:deep(.el-input__inner){
    color:black;
}

.error-message {
    color: red;
    font-size: 12px;
    margin-top: 2px;
    line-height: 1.2;
    min-height: 14px; /* 确保错误信息区域始终有固定高度 */
}
</style>