<template>
	<div>
		<el-card class="ssensor-card">
			<div class="sensor-list-header">
				<h3 class="sensor-list-header title" >{{ $t('message.txt.p3SensorList') }}</h3>
				<el-button  v-if="isAdmin" class="sensor-list-header button" @click="createSensor">
					<img src="/@/assets/icons/add.svg" alt="Icon" class="button-icon-right" />
					{{ $t('message.txt.addp3Sensor') }}
				</el-button>
			</div>
			<div class="container">
				<!-- Left section: Sensor List -->
				<div class="sensor-list">
					<div v-if="p3SensorLength > 0" class="sensor-item header">
						<div class="sensor-col description">{{ $t('message.common.description') }}</div>
						<div class="sensor-col address">{{ $t('message.common.address') }}</div>
						<div class="sensor-col sn">S/N</div>
						<div class="sensor-col actions" v-if="isAdmin"></div>
					</div>
					<div v-if="p3SensorLength > 0" v-for="sensor in onlyDisplay3PSensor" :key="sensor.description"
						:class="['sensor-item', { selected: selectedSensor && selectedSensor.description === sensor.description }]"
						@click="selectSensor(sensor)">

						<div class="sensor-col description">
							<div v-if="sensorBeEdit && sensor.description === sensorBeEdit.description">
								<el-input @click="tmpProvent($event)" class="edit-senosr-desc" size="small"
									v-model="editSensorDesc"></el-input>
							</div>
							<div v-else class="sensor-description text-ellipsis">{{ sensor.description }}</div>
						</div>

						<div class="sensor-col address">
							<div v-if="sensorBeEdit && sensor.description === sensorBeEdit.description
							&& sensor.connecttype !== 9">
								<el-input @click="tmpProvent($event)" class="edit-senosr-addr" size="small"
									v-model.number="editSensorAddr"></el-input>
							</div>
							<div v-else class="sensor-address">
								<template v-if="sensor.connecttype === 9">
									<el-tooltip :content="sensor.ipaddr" placement="top">
										<el-icon class="network-icon"><Connection /></el-icon>
									</el-tooltip>
								</template>
								<template v-else>
									{{ sensor.addr }}
								</template>
							</div>
						</div>

						<div class="sensor-col sn">
							<div v-if="sensorBeEdit && sensor.description === sensorBeEdit.description">
								<el-input @click="tmpProvent($event)" class="edit-senosr-sn" size="small"
									v-model="editSensorSN"></el-input>
							</div>
							<div v-else class="sensor-address">{{ sensor.sn }}</div>
						</div>

						<div class="sensor-col actions" v-if="isAdmin">
							<el-tooltip v-if="sensorBeEdit && sensor.description === sensorBeEdit.description" content="Save"
								placement="top">
								<el-button size="small" class="button-solid" icon="Select" circle
									@click="saveEditSensor($event)" />
							</el-tooltip>
							<el-tooltip v-else content="Edit" placement="top">
								<el-button size="small" class="button-solid" icon="Edit" circle
									@click="editSensor($event, sensor)" />
							</el-tooltip>
							<el-tooltip content="Delete" placement="top">
								<el-button size="small" class="button-solid" icon="Delete" circle
									@click="deleteSensor($event, sensor)" />
							</el-tooltip>
						</div>
					</div>
					<p v-else> {{ $t('message.txt.nosensorFound') }}</p>
				</div>

				<div class="sensor-details sensor-details-scrollable" v-if="!isShowDrawer && selectedSensor">
					<el-row class="sensor-header">
						<el-col :span="12">
							<div class="sensor-description">{{ $t('message.common.sensorDescription') }} : {{
								selectedSensor.description }}</div>
						</el-col>
						<el-col :span="12">
							<div class="sensor-address">{{ $t('message.common.address') }}:
								<template v-if="selectedSensor.connecttype === 9">
									{{ selectedSensor.ipaddr }}
								</template>
								<template v-else>
									{{ selectedSensor.addr }}
								</template>
							</div>
						</el-col>
					</el-row>

					<el-row class="sensor-channels">
						<el-row :gutter="24" class="channel-item-title" :span="24">
							<el-col :span="3" v-if="isAdmin">
								<span class="channel-description">Index</span>
							</el-col>
							<el-col :span="6" v-else>
								<span class="channel-description">Index</span>
							</el-col>
							<el-col :span="8" v-if="isAdmin">
								<span class="channel-description">{{ $t('message.common.description') }}</span>
							</el-col>
							<el-col :span="9" v-else>
								<span class="channel-description">{{ $t('message.common.description') }}</span>
							</el-col>
							<el-col :span="4">
								{{ $t('message.common.address') }}
							</el-col>
							<el-col :span="4">
								{{ $t('message.common.unit') }}
							</el-col>
							<el-col :span="4" v-if="isAdmin">

							</el-col>

						</el-row>
						<el-col v-for="(channel, index) in selectedSensor.cfgchannel" :key="channel.Id" :span="24">

							<el-row :gutter="20" class="channel-item">
								<el-col :span="3">
									<div class="channel-description"> {{ index + 1 }}</div>
								</el-col>
								<el-col :span="8">
									<div class="channel-description"> {{ channel.ChannelDescription }}</div>
								</el-col>
								<el-col :span="4">
									<div class="channel-description"> {{ channel.MBValueAddr }}</div>
								</el-col>
								<el-col :span="4">
									<div class="channel-description">
										{{ channel.UnitInASCII }} </div>
								</el-col>

								<el-col :span="4" v-if="isAdmin">

									<el-tooltip content="Edit" placement="top">
										<el-button size="small" class="button-solid" icon="Edit" circle
											@click="toggleChannelEdit(channel)" />
									</el-tooltip>
									<el-tooltip content="Edit" placement="top">
										<el-button size="small" class="button-solid" icon="Delete" circle
											@click="deleteChannel(channel)" />
									</el-tooltip>

								</el-col>
							</el-row>



						</el-col>
					</el-row>
					<el-row :gutter="20" v-if="isAdmin">
						<el-button class="suto-but-sec" @click="addChannel">{{ $t('message.sensorCfg.addChannel')
							}}</el-button>
					</el-row>
				</div>
			</div>

			<div class="sensor-list-footer" v-if="isAdmin">
				<div v-if="somethingchanged">
					<el-button type="primary" class="suto-but" @click="save2device">{{
					$t('message.common.save2Device') }}</el-button>
				</div>
				<div v-else>
					<el-button class="sensor-list-footer save_button" @click="save2device">
					{{$t('message.common.save2Device') }}
					</el-button>
				</div>
		</div>
		</el-card>

		<el-drawer
			v-if="isShowDrawer"
			v-model="sensorDetailsDrawerVisible"
			:with-header="false"
			direction="rtl"
			size="500px"
			custom-class="sensor-details-drawer"
			:show-close="true"
		>
				<div class="sensor-details" v-if="selectedSensor">
					<el-row class="sensor-header">
						<el-col :span="12">
							<div class="sensor-description">{{ $t('message.common.sensorDescription') }} : {{
								selectedSensor.description }}</div>
						</el-col>
						<el-col :span="12">
							<div class="sensor-address">{{ $t('message.common.address') }}:
								<template v-if="selectedSensor.connecttype === 9">
									{{ selectedSensor.ipaddr }}
								</template>
								<template v-else>
									{{ selectedSensor.addr }}
								</template>
							</div>
						</el-col>
					</el-row>

					<el-row class="sensor-channels">
						<el-row :gutter="24" class="channel-item-title" :span="24">
							<el-col :span="3" v-if="isAdmin">
								<span class="channel-description">Index</span>
							</el-col>
							<el-col :span="6" v-else>
								<span class="channel-description">Index</span>
							</el-col>
							<el-col :span="8" v-if="isAdmin">
								<span class="channel-description">{{ $t('message.common.description') }}</span>
							</el-col>
							<el-col :span="9" v-else>
								<span class="channel-description">{{ $t('message.common.description') }}</span>
							</el-col>
							<el-col :span="4">
								{{ $t('message.common.address') }}
							</el-col>
							<el-col :span="4">
								{{ $t('message.common.unit') }}
							</el-col>
							<el-col :span="4" v-if="isAdmin">

							</el-col>

						</el-row>
						<el-col v-for="(channel, index) in selectedSensor.cfgchannel" :key="channel.Id" :span="24">

							<el-row :gutter="20" class="channel-item">
								<el-col :span="3">
									<div class="channel-description"> {{ index + 1 }}</div>
								</el-col>
								<el-col :span="8">
									<div class="channel-description"> {{ channel.ChannelDescription }}</div>
								</el-col>
								<el-col :span="4">
									<div class="channel-description"> {{ channel.MBValueAddr }}</div>
								</el-col>
								<el-col :span="4">
									<div class="channel-description">
										{{ channel.UnitInASCII }} </div>
								</el-col>

								<el-col :span="4" v-if="isAdmin">

									<el-tooltip content="Edit" placement="top">
										<el-button size="small" class="button-solid" icon="Edit" circle
											@click="toggleChannelEdit(channel)" />
									</el-tooltip>
									<el-tooltip content="Edit" placement="top">
										<el-button size="small" class="button-solid" icon="Delete" circle
											@click="deleteChannel(channel)" />
									</el-tooltip>

								</el-col>
							</el-row>



						</el-col>
					</el-row>
					<el-row :gutter="20" v-if="isAdmin">
						<el-button class="suto-but-sec" @click="addChannel">{{ $t('message.sensorCfg.addChannel')
							}}</el-button>
					</el-row>
				</div>
		</el-drawer>

		<el-dialog :title="$t('message.common.confirmLeave')" v-model="leaveDialogVisible" width="30%"
			@close="leaveDialogVisible = false">
			<template #header>
				<div class="dialog-header">
					<el-icon :size="20" class="warning-icon">
						<i class="el-icon-warning"></i>
							<ele-Warning />
					</el-icon>
					<span>{{  $t('message.common.confirmLeave') }}</span>
				</div>
			</template>
			<div class="delete-dialog-content">
				<span v-html="$t('message.txt.somethingChannelinPage')"></span>
				<!-- <span v-html=" $t('message.txt.somethingChannelinPage') ">{{ $t('message.txt.somethingChannelinPage') }}</span> -->
			</div>
			<span slot="footer" class="dialog-footer">
				<!-- TODO button style -->
				<el-button class="suto-but-sec" @click="leaveDialogVisible = false">{{ $t('message.txt.no') }}</el-button>
				<el-button type="primary" class="suto-but" @click="confirmLeave">{{ $t('message.txt.yes') }}</el-button>
			</span>
		</el-dialog>
		<el-dialog v-model="channelDialogVisible" :title="$t('message.txt.editChannel')" width="40%"
			:before-close="handleCloseChannelDialog">
			<el-row class="edit-channel-margin">
				<el-col :span="8">
					<span>{{ $t('message.common.channelDescription') }}</span>
				</el-col>
				<el-col :span="16">
					<el-input v-model="editChannelDesc" placeholder="Channel description"></el-input>
				</el-col>
			</el-row>
			<el-row class="edit-channel-margin">
				<el-col :span="8">
					<span>{{ $t('message.common.address') }}</span>
				</el-col>
				<el-col :span="16">
					<el-input type="number" v-model.number="editChannelAddr" placeholder="Addr."></el-input>
				</el-col>
			</el-row>
			<el-row class="edit-channel-margin">
				<el-col :span="8">
					<span>{{ $t('message.common.resolution') }}</span>
				</el-col>
				<el-col :span="16">
					<el-select v-model.number="editChannelResolution" style="width: 100%">
						<el-option v-for="option in editChannelResolutionOpts" :key="option.value" :label="option.text"
							:value="option.value">
						</el-option>
					</el-select>
				</el-col>
			</el-row>

			<el-row class="edit-channel-margin">
				<el-col :span="8">
					<span>{{ $t('message.common.unit') }} </span>
				</el-col>
				<el-col :span="16">
					<el-input v-model="editChannelUnit" placeholder="Unit"></el-input>
				</el-col>
			</el-row>
			<el-row class="edit-channel-margin">
				<el-col :span="8">
					<span>{{ $t('message.common.inputVType') }} </span>
				</el-col>
				<el-col :span="16">
					<el-select v-model.number="editChannelInputType" style="width: 100%">
						<el-option v-for="option in editChannelValueTypeOpts" :key="option.value" :label="option.text"
							:value="option.value">
						</el-option>
					</el-select>
				</el-col>
			</el-row>
			<el-row class="edit-channel-margin">
				<el-col :span="8">
					<span>{{ $t('message.common.outputVType') }}</span>
				</el-col>
				<el-col :span="16">
					<el-select v-model.number="editChannelOutputType" style="width: 100%">
						<el-option v-for="option in editChannelValueTypeOpts" :key="option.value" :label="option.text"
							:value="option.value">
						</el-option>
					</el-select>
				</el-col>
			</el-row>
			<el-row class="edit-channel-margin">
				<el-col :span="8">
					<span>{{ $t('message.common.mbFuncCode') }}</span>
				</el-col>
				<el-col :span="16">
					<el-input v-model.number="editChannelFuncode" placeholder="Function code"></el-input>
				</el-col>
			</el-row>
			<el-row class="edit-channel-margin">
				<el-col :span="8">
					<span>{{ $t('message.common.errorValue') }} </span>
				</el-col>
				<el-col :span="16">
					<el-input v-model.number="editChannelErrValue" placeholder="Error value"></el-input>
				</el-col>
			</el-row>
			<el-row>
				<span class="el-form-item__error" v-if="ciinputError"> {{ ciinputErrorMsg }} </span>
			</el-row>
			<br />
			<el-divider />

			<el-row>
				<el-col :span="8">
					<span></span>
				</el-col>
				<el-col :span="16">

					<el-button class="suto-but-sec" @click="handleCloseChannelDialog">{{ $t('message.common.cancel')
						}}</el-button>
					<el-button type="primary" class="suto-but" @click="handleChannelConfirm">{{
						$t('message.common.confirm') }}</el-button>
				</el-col>
			</el-row>
		</el-dialog>
		<el-dialog v-model="progressbarDialogVisible" :title="$t('message.common.save2Device')" width="30%"
			:show-close="false" :modal-append-to-body="true" :lock-scroll="true" :close-on-click-modal="false"
			:close-on-press-escape="false">
			<div class="progress-bar-container">
				<div class="progress-bar" :style="{ width: progress + '%' }"></div>
			</div>
			<p>&nbsp;</p>
			<span slot="footer" class="dialog-footer">
			</span>
		</el-dialog>

		<el-dialog :title="$t('message.common.confirmDeletion')" v-model="deleteDialogVisible" width="30%"
			@close="deleteDialogVisible = false">
			<div class="delete-dialog-content">
				<span>{{ $t('message.txt.areUSure2DelSensor') }}</span>
			</div>
			<span slot="footer" class="dialog-footer">
				<el-button class="suto-but-sec" @click="deleteDialogVisible = false">{{ $t('message.common.cancel') }}</el-button>
				<el-button class="suto-but" type="primary" @click="confirmSensorDelete">{{ $t('message.common.confirm') }}</el-button>
			</span>
		</el-dialog>
		<el-dialog v-model="createSensorVisible" :title="$t('message.txt.addSensor')" width="40%"
			:before-close="handleCloseCreateDialog">
			<el-row class="editpanel-row-space">
				<el-col :span="8">
					<span>{{ $t('message.txt.protocol') }}</span>
				</el-col>
				<el-col :span="16">
					<el-select v-model="selectedProtocol" class="create-sensor-type" @change="handleProtocolChange">
						<el-option :label="'Modbus/RTU'" :value="4"></el-option>
						<el-option :label="'Modbus/TCP'" :value="9"></el-option>
					</el-select>
				</el-col>
			</el-row>
			
			<el-row class="editpanel-row-space">
				<el-col :span="8">
					<span>{{ $t('message.common.description') }}</span>
				</el-col>
				<el-col :span="16">
					<el-input v-model="createSensorName" class="create-sensor-item" placeholder="Sensor Name">
					</el-input>
				</el-col>
			</el-row>
			<el-row v-if="selectedProtocol === 9" class="editpanel-row-space">
				<el-col :span="8">
					<span>{{ $t('message.common.port') }}</span>
				</el-col>
				<el-col :span="16">
					<el-input type="number" v-model.number="tcpPort" class="create-sensor-item"></el-input>
				</el-col>
			</el-row>
			<el-row class="editpanel-row-space">
				<el-col :span="8">
					<span>{{ $t('message.common.address') }}</span>
				</el-col>
				<el-col :span="16">
					<template v-if="selectedProtocol === 9">
						<div class="ip-address-input">
							<el-input type="number" v-model.number="ipPart1" class="ip-part" min="0" max="255" @input="validateIpPart($event, 'ipPart1')" @keyup="handleIpKeyup($event, 'ipPart1')" ref="ipPart1Input"></el-input>
							<span class="ip-dot">.</span>
							<el-input type="number" v-model.number="ipPart2" class="ip-part" min="0" max="255" @input="validateIpPart($event, 'ipPart2')" @keyup="handleIpKeyup($event, 'ipPart2')" ref="ipPart2Input"></el-input>
							<span class="ip-dot">.</span>
							<el-input type="number" v-model.number="ipPart3" class="ip-part" min="0" max="255" @input="validateIpPart($event, 'ipPart3')" @keyup="handleIpKeyup($event, 'ipPart3')" ref="ipPart3Input"></el-input>
							<span class="ip-dot">.</span>
							<el-input type="number" v-model.number="ipPart4" class="ip-part" min="0" max="255" @input="validateIpPart($event, 'ipPart4')" @keyup="handleIpKeyup($event, 'ipPart4')" ref="ipPart4Input"></el-input>
						</div>
					</template>
					<template v-else>
						<el-input type="number" class="create-sensor-item" v-model.number="createSensorAddr">
						</el-input>
					</template>
				</el-col>
			</el-row>
			<el-row>
				<el-col :span="8">
					<span>S/N </span>
				</el-col>
				<el-col :span="16">
					<el-input class="create-sensor-item" v-model="createSensorSN">
					</el-input>
				</el-col>
			</el-row>
			<el-row>
				<span class="el-form-item__error" v-if="createError"> {{ createErrorMsg }} </span>
			</el-row>
			<el-divider />
			<el-row>
				<el-col :span="8">
				</el-col>
				<el-col :span="16">
					<el-button type="primary" class="suto-but" @click="handleCreateConfirm">{{ $t('message.common.confirm')
						}}</el-button>
					<el-button class="suto-but-sec" @click="handleCloseCreateDialog">{{ $t('message.common.cancel')
						}}</el-button>
				</el-col>
			</el-row>
		</el-dialog>
	</div>

</template>

<script>
import { usecfgFile } from '/@/api/cfgfile/index';
import { useSensorCfgStore } from '/@/stores/sensorconfig';
import { ElNotification } from 'element-plus';
import { useI18n } from 'vue-i18n';
import * as Constants from '../sensorconsts';
import { Session } from '/@/utils/storage';

import {
	Delete,
	Edit,
	Select,
	Warning,
	Connection,
} from '@element-plus/icons-vue';

const sensorchanneldir = './configs/sensorchannel/';
const allinonesensorlistdir = './configs/sensorlist/';
const sensortypedir = './configs/sensorchannel/';
const allinonesensorlistname = 'SUTO-SensorList.sutolist';
const store = useSensorCfgStore();
const cfgfilel = usecfgFile();
const channelResolutionOpts = [
	{ value: 0, text: "1" },
	{ value: 1, text: "0.1" },
	{ value: 2, text: "0.01" },
	{ value: 3, text: "0.001" },
	{ value: 4, text: "0.0001" },
];
const channelValueTypeOpts = [
	{ value: 1, text: "INT16" },
	{ value: 2, text: "UINT16" },
	{ value: 3, text: "INT32_B" },
	{ value: 4, text: "INT32_L" },
	{ value: 5, text: "UINT32_B" },
	{ value: 6, text: "UINT32_L" },
	{ value: 7, text: "FLOAT_B" },
	{ value: 8, text: "FLOAT_L" },
];

export default {
	setup() {
		const { t } = useI18n();
		return {
			t,
		}
	},
	data() {
		return {
			sensors: [],
			selectedSensor: null,
			createSensorVisible: false,
			inputNewSensorName: '',
			inputNewSensorAddr: 0,
			inputError: false,
			inputErrorMsg: '',
			createError: false,
			createErrorMsg: '',
			sensorTypeList: [],
			leaveDialogVisible: false,
			newChannel2BeAdded: {
				Id: 0,
				ChannelDescription: 'Channel1',
				DeviceID: 0,
				ErrorValue: -9999,
				channelid: 0,
				InputValueType: 8,
				MBAccessFuncCode: 3,
				MBValueAddr: 1,
				MBValueByteOrder: 0,
				MBValueLength: 4,
				Maximum: 1000,
				MeasureType: 0,
				Minimum: 0,
				Output: true,
				OutputValueType: 8,
				Resolution: 1,
				Show: true,
				SlaverInnerChannelNo: 0,
				SubDeviceID: 0,
				UnitInASCII: 'm/s',
				UnitIndex: 0,
				useErrorValue: false,
				useMinMax: false,
				formula: '',
				isvirtualsensor: false,
				threshold: 0,
				hysteresis: 0,
				direction: 0,
				relayindex: 0,
				location: '',
				meapoint: '',
			},
			newSensor2BeAdded: {
				issuto: false,
				description: '',
				address: 0,
				addr: 0,
				selected: true,
				configfilename: '',
				connecttype: 4,
				deviceID: 0,
				direction: 0,
				fwversion: '1.0',
				index: 1,
				ipaddr: "192.168.8.8",
				isvirtualsensor: false,
				location: "SUTO1",
				meapoint: "point1",
				name: '',
				pn: '12345678',
				protocotype: 0,
				relayindex: 0,
				sn: '12345678',
				subdevicename: '',
				threshold: 0,
				unitauto: false,
				cfgchannel: [],
			},
			editSensorDesc: '',
			editSensorAddr: 0,
			editSensorSN: '',
			createSensorName: 'Sensor',
			createSensorAddr: 1,
			createSensorSN: '',
			sensorBeEdit: null,
			channelBeEdit: null,
			editChannelDesc: '',
			editChannelUnit: '',
			editChannelInputType: 8,
			editChannelOutputType: 8,
			editChannelFuncode: 3,
			editChannelErrValue: -9999,
			ciinputError: false,
			ciinputErrorMsg: '',
			editChannelAddr: 1,
			editChannelResolution: 1,
			editChannelResolutionOpts: channelResolutionOpts,
			editChannelValueTypeOpts: channelValueTypeOpts,
			// editChannel
			deleteDialogVisible: false,
			progressbarDialogVisible: false,
			progress: 0,
			interval: null,
			somethingchanged: false,
			channelDialogVisible: false,
			selectedProtocol: 4,
			tcpPort: 502,
			ipPart1: 192,
			ipPart2: 168,
			ipPart3: 1,
			ipPart4: 100,
			isShowDrawer:false,
			sensorDetailsDrawerVisible: false,
		};
	},
	mounted() {
		this.fetchSensors();
		// 监听窗口大小变化事件
    	window.addEventListener('resize', this.handleResize);
    	// 页面加载时触发一次，确保初始状态正确
    	this.handleResize();
	},
	computed: {

		onlyDisplay3PSensor() {
			return this.sensors.filter(item => item.issuto === false);
		},
		p3SensorLength() {
			return this.sensors.filter(item => item.issuto === false).length;
		},
		isAdmin() {
			return Session.get('userInfo') && Session.get('userInfo').userName === 'admin';
		},
	},
	beforeRouteLeave(to, from, next) {
		if (this.somethingchanged) {
			this.leaveDialogVisible = true;
			this.nextRoute = next;

		} else {
			next(); // Allow navigation if no changes
		}
	},
	methods: {
		handleResize() {
			// 处理窗口大小变化逻辑
			this.isShowDrawer = window.innerWidth < 1200; 
		},
		confirmLeave() {
			this.leaveDialogVisible = false;
			this.nextRoute();
		},
		addChannel() {
			this.ciinputError = false;
			const copiedChannelObject = JSON.parse(JSON.stringify(this.newChannel2BeAdded));
			this.selectedSensor.cfgchannel.push(copiedChannelObject);

			const newName = this.retrieveANoExitsName(this.selectedSensor.cfgchannel);
			const newAddr = this.retrieveANoExitsAddr(this.selectedSensor.cfgchannel);
			copiedChannelObject.ChannelDescription = newName;
			copiedChannelObject.MBValueAddr = newAddr;
			this.toggleChannelEdit(copiedChannelObject);

		},
		retrieveANoExitsAddr(arr) {
			let index = 1;
			let addrToCheck = 1;

			while (arr.some(item => item.MBValueAddr === addrToCheck)) {
				index++;
				addrToCheck = index; // Increment the name with a number
			}

			return addrToCheck;
		},
		retrieveANoExitsName(arr) {
			let index = 1;
			let basicToCheck = 'Channel'
			let nameToCheck = `${basicToCheck}${index}`;
			// let nameToCheck = 'Channel';

			while (arr.some(item => item.ChannelDescription === nameToCheck)) {
				index++;
				nameToCheck = `${basicToCheck}${index}`; // Increment the name with a number
			}

			return nameToCheck;
		},

		// retriveANoExitsName(array, name) {
		// 	array.findIndex(i => i.ChannelDescription === name)
		// 	return "";
		// },
		handleCloseChannelDialog() {
			this.channelDialogVisible = false;
		},
		startTask() {
			this.progressbarDialogVisible = true;
			this.progress = 0;
			this.startProgress();
		},
		startProgress() {
			const duration = 10000; // 10 seconds
			const intervalTime = 100; // update every 100ms
			const increment = (intervalTime / duration) * 100;

			this.interval = setInterval(() => {
				if (this.progress >= 100) {
					clearInterval(this.interval);
					this.interval = null;
					this.progressbarDialogVisible = false;
					this.somethingchanged = false;
				} else {
					this.progress += increment;
				}
			}, intervalTime);
		},
		deleteChannel(channel) {
			this.selectedSensor.cfgchannel = this.selectedSensor.cfgchannel.filter(i => i !== channel);
			this.somethingchanged = true;
		},
		toggleChannelEdit(channel) {
			this.channelDialogVisible = true;
			this.channelBeEdit = channel;
			this.editChannelDesc = channel.ChannelDescription;
			this.editChannelAddr = channel.MBValueAddr;
			this.editChannelResolution = channel.Resolution;
			this.editChannelUnit = channel.UnitInASCII;
			this.editChannelInputType = channel.InputValueType;
			this.editChannelOutputType = channel.OutputValueType;
			this.editChannelFuncode = channel.MBAccessFuncCode;
			this.editChannelErrValue = channel.ErrorValue;

		},
		handleChannelConfirm() {
			if (this.editChannelDesc === null || this.editChannelDesc === '') {
				this.ciinputError = true;
				this.ciinputErrorMsg = this.t("message.common.channelDesCanNBeNull");
				return;
			}
			if (this.editChannelAddr === null
				|| (this.editChannelAddr < 0 || this.editChannelAddr > 65535)) {
				this.ciinputError = true;
				this.ciinputErrorMsg = this.t("message.txt.rangeVaddressLimit");
				return;
			}

			const tryFindex = this.selectedSensor.cfgchannel.findIndex(
				i => i !== this.channelBeEdit
					&& (i.MBValueAddr === this.editChannelAddr
						|| i.ChannelDescription === this.editChannelDesc));
			if (tryFindex !== -1) {
				this.ciinputError = true;
				this.ciinputErrorMsg = this.t("message.txt.duplicateDesOrAddr");
				return;
			}
			this.channelBeEdit.Resolution = this.editChannelResolution;
			this.channelBeEdit.ChannelDescription = this.editChannelDesc;
			this.channelBeEdit.UnitInASCII = this.editChannelUnit;
			this.channelBeEdit.MBValueAddr = this.editChannelAddr;
			this.channelBeEdit.InputValueType = this.editChannelInputType;
			this.channelBeEdit.OutputValueType = this.editChannelOutputType;
			this.channelBeEdit.MBAccessFuncCode = this.editChannelFuncode;
			this.channelBeEdit.ErrorValue = this.editChannelErrValue;

			this.channelBeEdit = null;
			this.somethingchanged = true;
			this.channelDialogVisible = false;
		},
		showResolutionText(value) {
			const option = channelResolutionOpts.find(i => i.value === value);
			return option ? option.text : "Error";
		},


		tmpProvent(event) {
			event.stopPropagation();
		},
		finishEditSensor() {
			if (this.editSensorDesc === null || this.editSensorDesc === '') {
				ElNotification({
					title: 'Error',
					message: this.t('message.common.sensorDescriptionCannotBNull'),
					type: 'error',
					position: 'bottom-right',
					duration: 3000
				});
				return false;
			}
			if (this.editSensorAddr === null || this.editSensorAddr === '') {
				ElNotification({
					title: 'Error',
					message: this.t('message.common.sensorAddrCannotBNull'),
					type: 'error',
					position: 'bottom-right',
					duration: 3000
				});
				return false;
			}
			if (this.editSensorAddr < 1 || this.editSensorAddr > 247) {
				ElNotification({
					title: 'Error',
					message: this.t('message.common.sensorAddrOutOfRange'),
					type: 'error',
					position: 'bottom-right',
					duration: 3000
				});
				return false;
			}
			if (this.checkSensorInfoDupli(this.editSensorDesc, this.editSensorAddr, true, this.sensorBeEdit)) {
				ElNotification({
					title: 'Error',
					message: this.t('message.txt.duplicateDesOrAddr'),
					type: 'error',
					position: 'bottom-right',
					duration: 3000
				});
				return false;
			}
			this.somethingchanged = true;
			this.sensorBeEdit.description = this.editSensorDesc;
			this.sensorBeEdit.addr = this.editSensorAddr;
			this.sensorBeEdit.address = this.editSensorAddr;
			this.sensorBeEdit.sn = this.editSensorSN;
			this.sensorBeEdit = null;
			return true;
		},
		saveEditSensor(event) {
			event.stopPropagation();
			this.finishEditSensor();
		},
		editSensor(event, sensor) {
			this.sensorBeEdit = sensor;
			this.editSensorDesc = sensor.description;
			this.editSensorAddr = sensor.addr;
			this.editSensorSN = sensor.sn;
			event.stopPropagation();
		},



		handleCloseCreateDialog() {
			this.createSensorVisible = false;
		},
		checkSensorInfoDupli(name, addr, isContainerSelf, self) {
			if (isContainerSelf) {
				// For Modbus/TCP, only check description duplication
				if (this.selectedProtocol === 9) {
					return this.sensors.findIndex(i => i !== self && i.description === name) !== -1;
				}
				// For Modbus/RTU, check both description and address
				return this.sensors.findIndex(i => i !== self && i.addr === addr) !== -1
					|| this.sensors.findIndex(i => i !== self && i.description === name) !== -1;
			} else {
				// For Modbus/TCP, only check description duplication
				if (this.selectedProtocol === 9) {
					return this.sensors.findIndex(i => i.description === name) !== -1;
				}
				// For Modbus/RTU, check both description and address
				return this.sensors.findIndex(i => i.addr === addr) !== -1
					|| this.sensors.findIndex(i => i.description === name) !== -1;
			}
		},
		createSensor() {
			this.selectedSensor = null;
			this.sensorBeEdit = null;
			this.channelBeEdit = null;
			this.createSensorVisible = true;
			this.createSensorSN = '00000000';
			this.selectedProtocol = 4; // Reset to default Modbus/RTU
			this.tcpPort = 502; // Reset to default port
			this.ipPart1 = 192;
			this.ipPart2 = 168;
			this.ipPart3 = 1;
			this.ipPart4 = 100;
		},
		handleProtocolChange() {
			if (this.selectedProtocol === 4) {
				this.tcpPort = 502;
				this.createSensorAddr = 1;
			} else {
				// When switching to TCP, convert current address to IP if possible
				this.ipPart1 = 192;
				this.ipPart2 = 168;
				this.ipPart3 = 1;
				this.ipPart4 = 100;
			}
		},
		validateIpPart(value, part) {
			if (value === '') {
				this[part] = 0;
				return;
			}
			let num = parseInt(value);
			if (isNaN(num)) {
				num = 0;
			}
			if (num > 255) {
				num = 255;
			}
			if (num < 0) {
				num = 0;
			}
			this[part] = num;
		},
		isValidIpAddress() {
			const parts = [this.ipPart1, this.ipPart2, this.ipPart3, this.ipPart4];
			return parts.every(part => 
				typeof part === 'number' && 
				part >= 0 && 
				part <= 255
			);
		},
		handleCreateConfirm() {
			if (this.createSensorName === '' || this.createSensorName === null) {
				this.createError = true;
				this.createErrorMsg = this.t("message.common.sensorDesCanNBeNull");
				return;
			}

			// Different validation for RTU and TCP modes
			if (this.selectedProtocol === 4) {
				if (this.createSensorAddr < 1 || this.createSensorAddr > 247) {
					this.createError = true;
					this.createErrorMsg = this.t("message.common.sensorAddrOutOfRange");
					return;
				}
			} else {
				if (!this.isValidIpAddress()) {
					this.createError = true;
					this.createErrorMsg = this.t("message.txt.invalidIPAddress");
					return;
				}
			}

			if (this.selectedProtocol === 9 && (this.tcpPort < 1 || this.tcpPort > 65535)) {
				this.createError = true;
				this.createErrorMsg = this.t("message.common.portOutOfRange");
				return;
			}

			if (this.checkSensorInfoDupli(this.createSensorName, this.createSensorAddr)) {
				this.createError = true;
				this.createErrorMsg = this.t("message.txt.duplicateDesOrAddr");
				return;
			}

			this.createSensorVisible = false;
			this.newSensor2BeAdded.description = this.createSensorName;
			this.newSensor2BeAdded.sn = this.createSensorSN;
			this.newSensor2BeAdded.connecttype = this.selectedProtocol;

			if (this.selectedProtocol === 9) {
				this.newSensor2BeAdded.port = this.tcpPort;
				this.newSensor2BeAdded.ipaddr = `${this.ipPart1}.${this.ipPart2}.${this.ipPart3}.${this.ipPart4}`;
				this.newSensor2BeAdded.addr = 1; // Default address for TCP mode
			} else {
				this.newSensor2BeAdded.addr = this.createSensorAddr;
			}

			const copiedObject = JSON.parse(JSON.stringify(this.newSensor2BeAdded))
			const copiedChannelObject = JSON.parse(JSON.stringify(this.newChannel2BeAdded));
			copiedObject.cfgchannel.push(copiedChannelObject);
			this.sensors.push(copiedObject);
			this.somethingchanged = true;
			this.selectedSensor = copiedObject;

			this.toggleChannelEdit(copiedChannelObject);
		},


		confirmSensorDelete() {
			this.deleteDialogVisible = false;

			const selectedSensorIndex = this.sensors.findIndex(i => i === this.selectedSensor);
			this.sensors = this.sensors.filter(i => i !== this.selectedSensor);
			if (this.p3SensorLength > 0) {
				this.selectedSensor = this.onlyDisplay3PSensor[0];
			} else {
				this.selectedSensor = null;
			}
			this.somethingchanged = true;
		},
		deleteSensor(event, sensor) {
			event.stopPropagation();
			this.selectedSensor = sensor;
			this.deleteDialogVisible = true;

		},
		save2device() {
			// If a sensor is being edited, finish editing first
			if (this.sensorBeEdit) {
				const success = this.finishEditSensor();
				if (!success) {
					// If validation failed, do not proceed
					return;
				}
			}
			let deviceID = 0;
			let channelID = 0;
			this.sensors.forEach((sensorItem, index) => {
				sensorItem.deviceID = deviceID;
				sensorItem.cfgchannel.forEach((channelItem, index1) => {
					channelItem.DeviceID = deviceID;
					channelItem.channelid = channelID;
					channelItem.logger = false;
					channelItem.Id = index1;
					channelID++;
				});
				deviceID++;
			});
			//TODO: add logger and alarm.
			let allinonecfg = {
				cfgsensor: this.sensors,
				logger: Constants.NO_USE_DEFAULT_LOGGER,
				alarm: Constants.NO_USE_DEFAULT_ALARM,
			};
			cfgfilel
				.savefile(allinonesensorlistname, allinonecfg, allinonesensorlistdir)
				.then((res) => {
					this.startTask();
					this.restartapps();
				})
				.catch((err) => {
					console.log('err=', err);
				});
		},
		removeSUTOPrefix(str) {
			let tmp = str;
			if (str.startsWith('SUTO-')) {
				tmp = str.replace('SUTO-', '');
			}
			return tmp.replace('.sutoch', '');
		},


		test() {
			console.log("test");
			console.log(this.sensors);
			// this.deleteSensor();
			// this.startTask();
		},
		selectSensor(sensor) {
			this.selectedSensor = sensor;
			this.sensorDetailsDrawerVisible = true;
		},
		prehandlesensors(res) {
			let cfgsensor = res.cfgsensor;
			cfgsensor.sort((a, b) => a.deviceID - b.deviceID);
			cfgsensor.forEach((item, index) => {
				item.cfgchannel.sort((a, b) => a.channelid - b.channelid);
				item.cfgchannel.forEach((item1, index1) => {
					item1.sname = item.description;
				});
			});
			cfgsensor = cfgsensor.filter((item) => {
				return item.isvirtualsensor != true;
			});
			// this.sensors = cfgsensor.filter(item => item.issuto === false);
			this.sensors = cfgsensor;
			if (this.p3SensorLength > 0) {
				this.selectedSensor = this.onlyDisplay3PSensor[0];
			} else {
				this.selectedSensor = null;
			}
		},

		restartapps() {
			this.restartmeasure();
			this.restartlogger();
			this.restartalarm();
		},
		restartmeasure() {
			cfgfilel
				.restartapp('mea')
				.then((res) => {
					console.log('res=', res);
				})
				.catch((err) => {
					console.log('err=', err);
				});
		},

		restartlogger() {
			cfgfilel
				.restartapp('logger')
				.then((res) => {
					console.log('res=', res);
				})
				.catch((err) => {
					console.log('err=', err);
				});
		},
		restartalarm() {
			cfgfilel
				.restartapp('alarm')
				.then((res) => {
					console.log('res=', res);
				})
				.catch((err) => {
					console.log('err=', err);
				});
		},
		fetchSensors() {
			// if (store.sharedData.init === true) {
			// 	sensors = store.sharedData.data;
			// 	prehandlesensors(res);
			// } else {

			cfgfilel
				.getfile(allinonesensorlistname, allinonesensorlistdir)
				.then((res) => {
					console.log(res);
					this.prehandlesensors(res);

				})
				.catch((err) => {
					console.log('err=', err);
				});
			// }

		},
		handleIpKeyup(event, part) {
			// Move to next input when dot is pressed
			if (event.key === '.') {
				event.preventDefault();
				const currentValue = this[part];
				if (currentValue === '') {
					this[part] = 0;
				}
				this.focusNextIpPart(part);
			}
			// Move to next input when a valid number is entered
			else if (this[part] >= 0 && this[part] <= 255 && this[part].toString().length >= 3) {
				this.focusNextIpPart(part);
			}
		},
		focusNextIpPart(currentPart) {
			const parts = ['ipPart1', 'ipPart2', 'ipPart3', 'ipPart4'];
			const currentIndex = parts.indexOf(currentPart);
			if (currentIndex < parts.length - 1) {
				const nextPart = parts[currentIndex + 1];
				this.$refs[`${nextPart}Input`].focus();
			}
		},
	},
};
</script>

<style scoped>
.ssensor-card {
	margin: 10px;
	border-radius: 10px;
	/* width: fit-content; */
	/* 宽度根据内容自适应 */
	/* display: inline-block; */
	/* min-width: 800px; */
}

.container {
	display: flex;
	flex-direction: row;
	/* height: 90vh; */
	min-height: 35px;
	margin-top:40px;
	margin-bottom: 15px;
}

/* Sensor List on the left */
.sensor-list {
	flex: 5;
	padding: 10px;
	/* border-right: 1px solid #ddd; */

	/* margin: 5px;
	border: 1px solid #ccc;
	border-radius: 4px;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); */
}

.sensor-list-header {
	/* margin-bottom: 15px; */
  position: sticky;
  top: 0; /* 固定在顶部 */
  z-index: 1000; /* 可选：确保在其他元素之上 */
}

.sensor-list-header .title{
	/* background: #00ab84; */
	position: absolute;
	left: 0;
	margin-top: 10px;
	margin-right: 0px; /* 根据需要调整 */
}

.sensor-list-header .button{
  	background-color: #00ab84 !important;
	color:white;
	position: absolute;
	right: 0;
	margin-right: 0px; /* 根据需要调整 */
	height: 38px;
}

.sensor-list-footer {
	display: flex;
	justify-content: flex-end;
	align-items: center;
}
.sensor-list-footer .save_button {
	background-color: rgba(0, 171, 132, 0.38); /* 0.38 是不透明度，表示 38% */
	color:white;
	height: 32px;
}
.main-button {
	margin-left: 12px;
	margin-bottom: 12px;
}

/* Sensor Details on the right */
.sensor-details {
	flex: 6;
	padding: 10px;
	border: 1px solid #ccc;
	border-radius: 4px;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	margin: 5px;
}



.sensor-description {
	min-width: 80px;
	font-weight: normal;
}

.sensor-address {
	font-weight: normal;
}

.sensor-channels {
	display: flex;
	flex-direction: column;
}




.sensor-details {
	flex: 7;
	padding: 10px;
	border: 1px solid #ccc;
	border-radius: 4px;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	margin: 5px;
}

.sensor-item {
	display: flex;
	align-items: center;
	padding: 10px;
	border-bottom: 1px solid #E6E6E6;
	cursor: pointer;
	color: black;
}

.sensor-item.header {
	/* font-weight: bold; */
	background: #F3F3F3;
	height: 32px;
}

.sensor-col {
	display: flex;
	align-items: center;
}

.sensor-col.description {
	flex: 1;
	min-width: 120px;
	max-width: 200px;
	margin-right: 5px;
}

.sensor-col.address {
	width: 60px;
	margin-right: 5px;
}

.sensor-col.sn {
	width: 50px;
	margin-right: 5px;
}

.sensor-col.actions {
	width: 100px;
	justify-content: flex-end;
}

.text-ellipsis {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.edit-senosr-desc {
	width: 100%;
	max-width: 280px;
}



.edit-senosr-addr .el-input__wrapper {
	width: 40px;
  	padding: 0 4px !important;
}
.edit-senosr-addr .el-input__inner {
  	padding: 0;
}


.edit-senosr-sn {
	width: 85px;
}

/* Style for selected sensor */
.sensor-item.selected {
	background-color: #00ab84;
	border-left: 3px solid #ffd322;
	color: white;
}

.sensor-title {
	font-weight: bold;
	min-width: 60px;
}

/* .sensor-item {
	display: flex;
	justify-content: space-between;
	padding: 10px;
	border-bottom: 1px solid #ddd;
	cursor: pointer;
} */

.sensor-header {
	border-bottom: 1px solid #ddd;
	padding-bottom: 10px;
	padding-top: 15px;
	margin-bottom: 15px;
}

.sensor-list {
	display: flex;
	flex-direction: column;
	padding: 10px;
	/* border-right: 1px solid #ddd; */
	/* Thin border for the left module */
	overflow-y: auto;
	/* Allow scrolling if content is large */
}


.channel-item {
	display: flex;
	justify-content: space-between;
	padding: 5px 0;
	border-bottom: 1px solid #ddd;
}

.channel-item-title {
	padding-top: 15px;
	font-weight: bold;
	border-bottom: 1px solid #ddd;
	margin-bottom: 10px;
}



.edit-channel-desc {
	max-width: 200px;
}

.edit-channel-unit {
	max-width: 100px;
}

.create-sensor-type {
	width: 300px;
}

.editpanel-row-space {
	margin-bottom: 20px;
}

.create-sensor-item {
	width: 300px;
}

.button-solid {
	border: none;
	margin-left: 3px;
}

.suto-but {
	background-color: rgba(0, 171, 132);
	color:white;
	height: 32px;
	/* margin-left: 12px;
	margin-bottom: 12px;
	border-radius: 100px;
	background-color: #00ab84;
	border-color: #00ab84;
	min-height: 40px; */
}

.suto-but:hover {
	color: yellow;
	border-color: white
}

.suto-but-sec {
	margin-left: 12px;
	margin-bottom: 12px;
	border-radius: 100px;
	min-height: 40px;
}

.edit-channel-margin {
	margin-bottom: 3px;
}

.delete-dialog-content {
	margin-bottom: 30px;
}

.progress-bar-container {
	width: 100%;
	background-color: #f3f3f3;
	border: 1px solid #ccc;
	height: 30px;
	border-radius: 100px;
	margin: 20px 0;
	position: relative;
}

.progress-bar {
	height: 100%;
	border-radius: 100px;
	background-color: #00ab84;
	transition: width 0.1s;
}

.dialog-footer {
	margin-top: 15px;
}

/* Responsive Layout for narrow screens */
@media (max-width: 768px) {
	.container {
		flex-direction: column;
	}

	.sensor-list,
	.sensor-details {
		flex: 1;
		width: 100%;
	}
}
.dialog-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: bold;
}

.warning-icon {
  color: #e6a23c; /* Warning color */
}

.warning-message {
    color: #f56c6c;
    font-size: 14px;
    line-height: 1.4;
    margin-top: 5px;
    padding: 8px;
    background-color: #fef0f0;
    border-radius: 4px;
}

.ip-address-input {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 300px;
}

.ip-part {
	width: 65px;
}

.ip-part :deep(.el-input__inner) {
	-moz-appearance: textfield;
}

.ip-part :deep(.el-input__inner::-webkit-outer-spin-button),
.ip-part :deep(.el-input__inner::-webkit-inner-spin-button) {
	-webkit-appearance: none;
	margin: 0;
}

.ip-dot {
	font-weight: bold;
	margin: 0 2px;
}

.network-icon {
	font-size: 18px;
	color: #409EFF;
}

.sensor-details-drawer {
	z-index: 3000;
}

@media (max-height: 750px) {
	.ssensor-card{
		height: 473px;
	}
	.sensor-list{
		height: 370px;
	}
	.create-sensor-type{
		width: 220px;
	}
	.create-sensor-item {
		width: 220px;
	}
	.ssensor-card {
		margin: 5px 7px 5px 5px;
		border-radius: 8px;
	}
}

@media (min-height: 750px) {
	.ssensor-card{
		height: 700px;
	}
	.sensor-list{
		height: 580px;
	}
	.ssensor-card {
		margin: 5px 7px 5px 5px;
		border-radius: 8px;
	}
}

.button-icon-right{
  margin-right: 8px; /* 调整图标与文本的间距 */
  width: 12px; /* 设置图标大小 */
  height: 12px;
}

.el-card{
	--el-card-padding: 8px;
}

.sensor-details-scrollable {
  overflow-y: auto;
  height: 580px;
  overflow-x: hidden; /* 禁止水平滚动 */
}

</style>