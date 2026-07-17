<template>
	<div>
		<el-card class="elcard">
			<div class="container" style="min-height: 100%; padding-bottom: 100px">
				<el-table ref="multipleTableRef" :data="alarmchannel" style="width: 100%">
					<!-- <el-table-column type="selection" width="55" /> -->
					<el-table-column prop="Id" label="Id" width="50"> </el-table-column>
					<el-table-column property="location" label="location" width="120" />
					<el-table-column property="meapoint" label="meapoint" width="120" show-overflow-tooltip />
					<el-table-column property="name" label="name" width="120" show-overflow-tooltip />
					<el-table-column property="ChannelDescription" label="ChannelDescription" width="180" show-overflow-tooltip />
					<el-table-column property="UnitInASCII" label="UnitInASCII" width="120" show-overflow-tooltip />
					<el-table-column property="threshold" label="threshold" width="120" show-overflow-tooltip>
						<template #default="scope">
							<el-input v-model.number="scope.row.threshold" />
						</template>
					</el-table-column>
					<el-table-column property="hysteresis" label="hysteresis" width="120" show-overflow-tooltip>
						<template #default="scope">
							<el-input v-model.number="scope.row.hysteresis" />
						</template>
					</el-table-column>
					<el-table-column property="direction" label="direction" width="120" show-overflow-tooltip>
						<template #default="scope">
							<el-select v-model.number="scope.row.direction" placeholder="direction">
								<el-option label="up" :value="0" />
								<el-option label="down" :value="1" />
							</el-select>
						</template>
					</el-table-column>
					<el-table-column property="relayindex" label="relayindex" width="160" show-overflow-tooltip>
						<template #default="scope">
							<el-select v-model.number="scope.row.relayindex" placeholder="index">
								<el-option label="Not Set" :value="0" />
								<el-option label="Relay1" :value="1" />
								<el-option label="Relay2" :value="2" />
							</el-select>
						</template>
					</el-table-column>
				</el-table>
				<!-- 表单，填写下列信息 -->
				<!-- "smtpserver": "smtp.189.com",
        "smtpport": 587,
        "username": "jarvisjia@189.cn",
        "password": "your_password",
        "sender": "Cv!8Vh!7b%3Kf)8Y",
        "receiver": "jarvis.jia@suto-itec.com",
        "tls": true -->
				<el-row style="margin-top: 20px">
					<el-col :span="8">
						<div class="xuxian-border">
							<el-text style="font-size: 14px; font-weight: bold; margin-bottom: 10px">Email info:</el-text>
							<el-form v-if="emailinfo" :model="allinonesensorlist" label-width="120px">
								<el-form-item label="smtpserver">
									<el-input v-model="emailinfo.smtpserver" />
								</el-form-item>
								<el-form-item label="smtpport">
									<el-input v-model="emailinfo.smtpport" />
								</el-form-item>
								<el-form-item label="username">
									<el-input v-model="emailinfo.username" />
								</el-form-item>
								<el-form-item label="password">
									<el-input type="password" v-model="emailinfo.password" />
								</el-form-item>
								<!-- <el-form-item label="sender">
									<el-input v-model="emailinfo.sender" />
								</el-form-item> -->
								<el-form-item label="receiver">
									<el-input v-model="emailinfo.receiver" />
								</el-form-item>
								<el-form-item label="tls">
									<!-- <el-input v-model="emailinfo.tls" /> -->
									<el-select v-model="emailinfo.tls" placeholder="index">
										<el-option label="Enable" :value="true" />
										<el-option label="Disable" :value="false" />
									</el-select>
								</el-form-item>
								<el-form-item label="Enable">
									<el-switch v-model.bool="emailinfo.enable" />
								</el-form-item>
							</el-form>
							<el-result v-if="testemailisok" icon="success" title="Email send succeed !" subtitle="请根据提示进行操作">
								<template slot="extra">
									<el-button type="primary" size="medium">返回</el-button>
								</template>
							</el-result>
							<el-result v-if="testemailiserr" icon="error" title="Email send Error ! Please check email info" subtitle="请根据提示进行操作">
								<template slot="extra">
									<el-button type="primary" size="medium">返回</el-button>
								</template>
							</el-result>
						</div>
					</el-col>

					<el-col :span="12"> </el-col>
				</el-row>
			</div>

			<el-button type="primary" @click="saveallinonesensorlist">Save</el-button>
			<el-button type="primary" @click="testemail">Test</el-button>
		</el-card>
	</div>
</template>

<script lang="ts" setup name="alarminfo">
import { ref, onMounted } from 'vue';
import { usecfgFile } from '/@/api/cfgfile/index';
const cfgfilel = usecfgFile();
import { ElNotification } from 'element-plus';

const allinonesensorlistdir = './configs/sensorlist/';
const allinonesensorlistname = 'SUTO-SensorList.sutolist';
const allinonesensorlist = ref({});
const alarmchannel = ref([]);
const testemailisok = ref(false);
const testemailiserr = ref(false);
const emailinfo = ref({});

function getalarmcfgfile() {
	alarmchannel.value = [];
	cfgfilel
		.getfile(allinonesensorlistname, allinonesensorlistdir)
		.then((res) => {
			console.log('res=', res);
			allinonesensorlist.value = res;
			allinonesensorlist.value.cfgsensor.forEach((element) => {
				element.cfgchannel.forEach((element2) => {
					if (element2.enalarm == true) {
						console.log('element2=', element2);
						let newelement2 = {
							...element2,
							location: element.location,
							meapoint: element.meapoint,
							name: element.name,
						};
						alarmchannel.value.push(newelement2);
					}
				});
			});
			emailinfo.value = allinonesensorlist.value.alarm.emailinfo;
			console.log('alarmchannel.value=', alarmchannel.value);
		})
		.catch((err) => {
			console.log('err=', err);
		});
}
function testemail() {
	testemailisok.value = false;
	testemailiserr.value = false;
	cfgfilel
		.testemail()
		.then((res) => {
			console.log('res=', res);
			testemailisok.value = true;
			testemailiserr.value = false;
		})
		.catch((err) => {
			console.log('err=', err);
			testemailisok.value = false;
			testemailiserr.value = true;
		});
}

function saveallinonesensorlist() {
	// 保证发送者和用户名一致
	allinonesensorlist.value.alarm.emailinfo.sender = allinonesensorlist.value.alarm.emailinfo.username;

	allinonesensorlist.value.cfgsensor.forEach((element, index) => {
		element.cfgchannel.forEach((element2, index2) => {
			alarmchannel.value.forEach((element3) => {
				if (element2.Id == element3.Id) {
					allinonesensorlist.value.cfgsensor[index].cfgchannel[index2].threshold = element3.threshold;
					allinonesensorlist.value.cfgsensor[index].cfgchannel[index2].hysteresis = element3.hysteresis;
					allinonesensorlist.value.cfgsensor[index].cfgchannel[index2].direction = element3.direction;
					allinonesensorlist.value.cfgsensor[index].cfgchannel[index2].relayindex = element3.relayindex;

					console.log('element3=', element2.Id, element3.Id);
				}
			});
		});
	});

	cfgfilel
		.savefile(allinonesensorlistname, allinonesensorlist.value, allinonesensorlistdir)
		.then((res) => {
			console.log('res=', res);
			ElNotification({
				title: t('message.common.success'),
				message: 'This is a success message',
				type: 'success',
			});
			cfgfilel
				.restartapp('alarm')
				.then((res) => {
					console.log('res=', res);

					startProgress();
				})
				.catch((err) => {
					console.log('err=', err);
				});
		})
		.catch((err) => {
			console.log('err=', err);
		});
}

// -------------------------------------------------------------------------------------------
onMounted(() => {
	getalarmcfgfile();
});
</script>

<style scoped>
.elcard {
	margin: 20px;
	border-radius: 6px;
	box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
	display: inline-block;
}
.container {
	overflow-x: auto;
}
.el-table {
	font-size: 14px;
	text-align: left;
}
.el-button {
	width: 100px;
}
.xuxian-border {
	border: 1px grey dashed;
	min-height: 1rem;
	border-radius: 5px;
	padding: 10px;
}
</style>
