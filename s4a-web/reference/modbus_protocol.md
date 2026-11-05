public class ModbusRTUResponse implements Response {   private static final int RTU_EXTRA_BYTES = 5;      private int type = 0;      private double value;      public ModbusRTUResponse(int type) {     this.type = type;   }      public void parseResponse(ProtocolAdapter protocol, Action action, byte[] response) throws CommException {     if (response.length < 5)       throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_CRC_FAILED);      int[] crc = MathUtil.calculateCRC(response, 0, response.length - 2);     if (crc[0] != (response[response.length - 2] & 0xFF) || crc[1] != (response[response.length - 1] & 0xFF))       throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_CRC_FAILED);      byte[] buf = new byte[response.length - 5];     System.arraycopy(response, 3, buf, 0, response.length - 5);     if (response[1] != ((Integer)action.getParameters().get("modbus_function_code")).byteValue())       throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_FUNCTION_CODE_UNMATCH);      this.value = DataTypeConverter.modbusData2Double(this.type, buf, 0);   }      public Object getValue() {     return Double.valueOf(this.value);   }      public Model toModel() {     return null;   } 


public class ModbusRTURetrieveMeasurementValuesActionAdapter implements ActionAdapter {   private final ActionExecutor executor = (ActionExecutor)new BaseActionExecutor();      public Response getResponse(ProtocolAdapter protocol, Action action, byte[] response) {     int type = ((Integer)action.getParameters().get("modbus_data_type")).intValue();     ModbusRTUResponse modbusRTUResponse = new ModbusRTUResponse(type);     modbusRTUResponse.parseResponse(protocol, action, response);     return (Response)modbusRTUResponse;   }      public Command getCommand() {     return ModbusCommands.MODBUS_READ;   }      public ActionExecutor getExecutor() {     return this.executor;   }      public ResponseParameters getResponseParameters(Action action) {     int num = ((Integer)action.getParameters().get("modbus_data_num")).intValue();     return (ResponseParameters)new ModbusRTUResponseParameters(num);   } }   public class GetOnLineMeasureValueActionExecutor implements ActionExecutor {   private static final int MASK_INT_VALUE_BITS = 2147483647;      private static final int MASK_INT_SIGN_BIT = -2147483648;      private static final short MASK_SHORT_VALUE_BITS = 32767;      private static final short MASK_SHORT_SIGN_BIT = -32768;      private static final double MEA_MODBUS_MIN_DIFFERENCE_VALUE = 1.0E-6D;      public Response execute(Action action, Device device, ProtocolAdapter protocol, int maxBytesExpected) throws CommException {     Collection<Channel> channels = device.getChannels();     for (Channel ch : channels) {       int num;       if ((ch.getChOptionalConfig() & 0x2) == 2)         continue;        ModbusRetrieveMeasurementValuesAction modbusRetrieveMeasurementValuesAction = new ModbusRetrieveMeasurementValuesAction();       modbusRetrieveMeasurementValuesAction.setParameter("modbus_function_code", Integer.valueOf(ch.getmBAccessFuncCode()));       modbusRetrieveMeasurementValuesAction.setParameter("modbus_data_addr", Integer.valueOf(ch.getmBValueAddr()));       int type = ch.getmBInputValueType();       if (type == 1 || type == 2) {         num = 1;       } else {         num = 2;       }        modbusRetrieveMeasurementValuesAction.setParameter("modbus_data_num", Integer.valueOf(num));       modbusRetrieveMeasurementValuesAction.setParameter("modbus_data_type", Integer.valueOf(type));       Response response = device.executeAction((Action)modbusRetrieveMeasurementValuesAction);       double v = ((Double)response.getValue()).doubleValue();       ch.setMeasurementValue(v);     }      for (Channel ch : channels) {       switch (device.getIdentification()) {         case 13584:         case 13600:           continue;       }        if ((ch.getChOptionalConfig() & 0x1) != 1) {         double v = ch.getMeasurementValue();         if ((ch.getChOptionalConfig() & 0x4) == 4) {           v = v * ch.getmBA1() + ch.getmBA0();           v = (int)(v + 1.0E-6D);         } else if (ch.getmBOutputValueType() == 6) {           v = v * ch.getmBA1() + ch.getmBA0();           v = ((new Double(v + 1.0E-6D)).intValue() & 0xFFFFFFFFL);         } else {           v = v * ch.getmBA1() + ch.getmBA0();           if (Math.abs(v - ch.getErrorValue()) < 1.0E-6D) {             v = -9999.0D;             continue;           }          }          if ((ch.getChOptionalConfig() & Byte.MIN_VALUE) == -128)           if (ch.getmBScalingHi() > ch.getmBScalingLo()) {             if (v > ch.getmBScalingHi() || v < ch.getmBRangeLo())               v = -9999.0D;            } else if (v > ch.getmBScalingLo() || v < ch.getmBRangeHi()) {             v = -9999.0D;           }           ch.setMeasurementValue(v);       }      }      CSBusBaseStringResponse newResponse = new CSBusBaseStringResponse();     newResponse.setValue("ok");     return (Response)newResponse;   } } 

 public class ModbusRetrieveMeasurementValuesAction extends Action {   public static final String MODBUS_FUNCTION_CODE = "modbus_function_code";      public static final String MODBUS_DATA_ADDRESS = "modbus_data_addr";      public static final String MODBUS_DATA_NUM = "modbus_data_num";      public static final String MODBUS_DATA_TYPE = "modbus_data_type";    
public class ModbusASCIIRetrieveMeasurementValuesActionAdapter implements ActionAdapter {   private final ActionExecutor executor = (ActionExecutor)new BaseActionExecutor();      public Response getResponse(ProtocolAdapter protocol, Action action, byte[] response) {     int type = ((Integer)action.getParameters().get("modbus_data_type")).intValue();     ModbusASCIIResponse modbusASCIIResponse = new ModbusASCIIResponse(type);     modbusASCIIResponse.parseResponse(protocol, action, response);     return (Response)modbusASCIIResponse;   }      public Command getCommand() {     return ModbusCommands.MODBUS_READ;   }      public ActionExecutor getExecutor() {     return this.executor;   }      public ResponseParameters getResponseParameters(Action action) {     int num = ((Integer)action.getParameters().get("modbus_data_num")).intValue();     return (ResponseParameters)new ModbusASCIIResponseParameters(num);   } }  public class ModbusTCPRetrieveMeasurementValuesActionAdapter implements ActionAdapter {   private final ActionExecutor executor = (ActionExecutor)new BaseActionExecutor();      public Response getResponse(ProtocolAdapter protocol, Action action, byte[] response) {     int type = ((Integer)action.getParameters().get("modbus_data_type")).intValue();     ModbusTCPResponse modbusTCPResponse = new ModbusTCPResponse(type);     modbusTCPResponse.parseResponse(protocol, action, response);     return (Response)modbusTCPResponse;   }      public Command getCommand() {     return ModbusCommands.MODBUS_READ;   }      public ActionExecutor getExecutor() {     return this.executor;   }      public ResponseParameters getResponseParameters(Action action) {     int num = ((Integer)action.getParameters().get("modbus_data_num")).intValue();     return (ResponseParameters)new ModbusTCPResponseParameters(num);   } package com.cs.communication.protocol;  import com.cs.communication.Action; import com.cs.communication.Communication; import com.cs.communication.Response; import com.cs.communication.ResponseParameters; import com.cs.communication.adapter.CommunicationEthernetRS485ModbusAdapter; import com.cs.communication.device.Device; import com.cs.communication.exception.CommException; import com.cs.communication.exception.shared.ExceptionCodeImpl; import com.cs.communication.util.MathUtil; import com.cs.communication.util.ModbusUtil;  public class CSModbusProtocolAdapter extends CSBusProtocolAdapter {   public static final byte CS_MODBUS_FUNCTION_TYPE = 70;      private static int transId = 1;      public enum ModbusComm {     MODBUS_COMM_RS485_RTU((byte)70, 5),     MODBUS_COMM_TCP((byte)71, 9);          private int extraBytes;          private byte funcCode;          ModbusComm(byte funcCode, int extraBytes) {       this.funcCode = funcCode;       this.extraBytes = extraBytes;     }          public byte getFuncCode() {       return this.funcCode;     }          public int getExtraBytes() {       return this.extraBytes;     }   }      private ModbusComm modbusComm = ModbusComm.MODBUS_COMM_RS485_RTU;      public CSModbusProtocolAdapter(boolean isRegDefault) {     super(isRegDefault);     if (isRegDefault) {       CommunicationEthernetRS485ModbusAdapter communicationEthernetRS485ModbusAdapter = new CommunicationEthernetRS485ModbusAdapter(this);       registerCommunicationAdapter((Communication)communicationEthernetRS485ModbusAdapter);     }    }      public void setModbusComm(ModbusComm modbusComm) {     this.modbusComm = modbusComm;   }      public CSModbusProtocolAdapter(Communication ethernetCommunicationAdapter, Communication rs485CommunicationAdapter) {     super(false);     registerCommunicationAdapter(ethernetCommunicationAdapter);     registerCommunicationAdapter(rs485CommunicationAdapter);   }      private static synchronized int getTransId() {     transId++;     if (transId > 65535)       transId = 1;      return transId;   }      public ResponseParameters getResponseParameters(Action action) throws IllegalArgumentException {     ResponseParameters res = super.getResponseParameters(action);     res.setBytesExpected(res.getBytesExpected() + res.getFramesExpected() * this.modbusComm.getExtraBytes());     return res;   }      public Response parseResponse(Action action, byte[] response) {     byte[] csPkg = null;     ResponseParameters param = getResponseParameters(action);     int lenOffset = 2;     int subPackOffset = 0;     int csPackOff = 0;     if (this.modbusComm == ModbusComm.MODBUS_COMM_RS485_RTU) {       int len = response.length - param.getFramesExpected() * this.modbusComm.getExtraBytes();       if (len <= 4)         if (response.length == this.modbusComm.getExtraBytes() && (response[1] & 0x80) == 128) {           int[] crc = MathUtil.calculateCRC(response, 0, response.length - 2);           if (crc[0] != (response[response.length - 2] & 0xFF) && crc[1] != (response[response.length - 1] & 0xFF))             throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_CRC_FAILED);            ModbusUtil.handleExCode(response[2]);         } else {           throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_WRONG_RESPONSE);         }         csPkg = new byte[len];       lenOffset = 2;       for (int i = 0; i < param.getFramesExpected(); i++) {         len = (0xFF & response[lenOffset]) + this.modbusComm.getExtraBytes();         int[] crc = MathUtil.calculateCRC(response, subPackOffset, len - 2);         int crcI0 = subPackOffset + len - 2;         int crcI1 = subPackOffset + len - 1;         if (crcI0 < 0 || crcI0 >= response.length || crcI1 < 0 || crcI1 >= response.length)           throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_CRC_FAILED);          if (crc[0] != (response[crcI0] & 0xFF) || crc[1] != (response[crcI1] & 0xFF))           throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_CRC_FAILED);          System.arraycopy(response, subPackOffset + 3, csPkg, csPackOff, len - this.modbusComm.getExtraBytes());         subPackOffset += len;         lenOffset = subPackOffset + 2;         csPackOff = csPackOff + len - this.modbusComm.getExtraBytes();       }      } else {       int len = response.length - param.getFramesExpected() * this.modbusComm.getExtraBytes();       if (len <= 4)         if (response.length == this.modbusComm.getExtraBytes() && (response[7] & 0x80) == 128) {           ModbusUtil.handleExCode(response[8]);         } else {           throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_WRONG_RESPONSE);         }         csPkg = new byte[len];       lenOffset = 8;       for (int i = 0; i < param.getFramesExpected(); i++) {         int id = response[0] << 8 & 0xFF00 | response[1] & 0xFF;         if (id != action.getActionId())           throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_WRONG_TRANS_ID);          len = 0xFF & response[lenOffset] + this.modbusComm.getExtraBytes();         System.arraycopy(response, subPackOffset + 9, csPkg, csPackOff, len - this.modbusComm.getExtraBytes());         subPackOffset += len;         lenOffset = subPackOffset + 8;         csPackOff = csPackOff + len - this.modbusComm.getExtraBytes();       }      }      return super.parseResponse(action, csPkg);   }      public byte[] translateAction(Action action, Device device) {     byte[] csPkg = super.translateAction(action, device);     int len = csPkg.length + this.modbusComm.getExtraBytes();     byte[] modPkg = new byte[len];     if (this.modbusComm == ModbusComm.MODBUS_COMM_RS485_RTU) {       System.arraycopy(csPkg, 0, modPkg, 3, csPkg.length);       modPkg[0] = (byte)device.getAddress();       modPkg[1] = this.modbusComm.getFuncCode();       modPkg[2] = (byte)csPkg.length;       int[] crc = MathUtil.calculateCRC(modPkg, 0, len - 2);       modPkg[len - 2] = (byte)crc[0];       modPkg[len - 1] = (byte)crc[1];     } else {       int id = getTransId();       action.setActionId(id);       modPkg[0] = (byte)((id & 0xFF00) >> 8);       modPkg[1] = (byte)(id & 0xFF);       modPkg[2] = 0;       modPkg[3] = 0;       len = csPkg.length + 3;       modPkg[4] = (byte)((len & 0xFF00) >> 8);       modPkg[5] = (byte)(len & 0xFF);       modPkg[6] = (byte)device.getAddress();       modPkg[7] = this.modbusComm.getFuncCode();       modPkg[8] = (byte)csPkg.length;       System.arraycopy(csPkg, 0, modPkg, 9, csPkg.length);     }      return modPkg;   } }   public class ModbusCommands {   public static final Command MODBUS_READ = new Command() {       public byte[] getBytes(Map<String, Object> parameters) {         byte[] result = new byte[5];         try {           result[0] = ((Integer)parameters.get("modbus_function_code")).byteValue();           int addr = ((Integer)parameters.get("modbus_data_addr")).intValue();           result[1] = (byte)(addr >> 8 & 0xFF);           result[2] = (byte)(addr & 0xFF);           int num = ((Integer)parameters.get("modbus_data_num")).byteValue();           result[3] = (byte)(num >> 8 & 0xFF);           result[4] = (byte)(num & 0xFF);         } catch (Exception e) {           return null;         }          return result;       }     }; }   public class ModbusRTUProtocolAdapter extends ProtocolAdapter {   public ModbusRTUProtocolAdapter(boolean isRegDefault) {     if (isRegDefault) {       CommunicationModbusAdapter communicationModbusAdapter = new CommunicationModbusAdapter(this);       registerCommunicationAdapter((Communication)communicationModbusAdapter);     }      init();   }      private void init() {     registerActionAdapter(ModbusRetrieveMeasurementValuesAction.class, ModbusRTURetrieveMeasurementValuesActionAdapter.class);     registerActionAdapter(GetOnlineMeasurementValueAction.class, GetOnlineMeasurementValueActionAdapter.class);   }      public ResponseParameters getResponseParameters(Action action) throws IllegalArgumentException {     ActionAdapter adapter = getActionAdapter(action.getClass());     ResponseParameters result = adapter.getResponseParameters(action);     return result;   }      public Response parseResponse(Action action, byte[] response) {     Response result = null;     ActionAdapter adapter = getActionAdapter(action.getClass());     result = (adapter == null) ? null : adapter.getResponse(this, action, response);     return result;   }      public byte[] translateAction(Action action, Device device) {     byte[] result = null;     ActionAdapter adapter = getActionAdapter(action.getClass());     Command command = adapter.getCommand();     result = packPacket(device.getAddress(), command.getBytes(action.getParameters()));     return result;   }      public static byte[] packPacket(int deviceAddress, byte[] netData) {     int byteTotal = netData.length + 1 + 2;     byte[] packet = new byte[byteTotal];     packet[0] = (byte)deviceAddress;     System.arraycopy(netData, 0, packet, 1, netData.length);     int[] crc = MathUtil.calculateCRC(packet, 0, netData.length + 1);     packet[byteTotal - 2] = (byte)crc[0];     packet[byteTotal - 1] = (byte)crc[1];     return packet;   } }     public ModbusTCPProtocolAdapter(boolean isRegDefault) {     if (isRegDefault) {       CommunicationEthernetAdapter communicationEthernetAdapter = new CommunicationEthernetAdapter(this);       registerCommunicationAdapter((Communication)communicationEthernetAdapter);     }      init();   }      private void init() {     registerActionAdapter(ModbusRetrieveMeasurementValuesAction.class, ModbusTCPRetrieveMeasurementValuesActionAdapter.class);     registerActionAdapter(GetOnlineMeasurementValueAction.class, GetOnlineMeasurementValueActionAdapter.class);   }      public ResponseParameters getResponseParameters(Action action) throws IllegalArgumentException {     ActionAdapter adapter = getActionAdapter(action.getClass());     ResponseParameters result = adapter.getResponseParameters(action);     return result;   }      public Response parseResponse(Action action, byte[] response) {     Response result = null;     ActionAdapter adapter = getActionAdapter(action.getClass());     result = (adapter == null) ? null : adapter.getResponse(this, action, response);     return result;   }      public byte[] translateAction(Action action, Device device) {     byte[] result = null;     ActionAdapter adapter = getActionAdapter(action.getClass());     Command command = adapter.getCommand();     result = packPacket(action, device.getAddress(), command.getBytes(action.getParameters()));     return result;   }      private static synchronized int getTransId() {     transId++;     if (transId > 65535)       transId = 1;      return transId;   }      public static byte[] packPacket(Action action, int deviceAddress, byte[] netData) {     int byteTotal = netData.length + 7;     byte[] packet = new byte[byteTotal];     int id = getTransId();     action.setActionId(id);     packet[0] = (byte)((id & 0xFF00) >> 8);     packet[1] = (byte)(id & 0xFF);     packet[2] = 0;     packet[3] = 0;     int len = netData.length + 1;     packet[4] = (byte)((len & 0xFF00) >> 8);     packet[5] = (byte)(len & 0xFF);     packet[6] = (byte)deviceAddress;     System.arraycopy(netData, 0, packet, 7, netData.length);     return packet;   } }   public class GetManualAddedDeviceTask extends ITask<Void> {   private static Logger logger = Logger.getLogger(GetManualAddedDeviceTask.class);      public GetManualAddedDeviceTask(TaskHandler listener) {     super(listener);   }      void exec() {     logger.info("Start");     final Byte protocol = (Byte)getParameter(TaskParamGetManualAddedDeviceTask.PARAM_PROTOCOL.getName());     final Byte commType = (Byte)getParameter(TaskParamGetManualAddedDeviceTask.PARAM_COMM_TYPE.getName());     Integer addr = (Integer)getParameter(TaskParamGetManualAddedDeviceTask.PARAM_COMM_ADDRESS.getName());     String port = (String)getParameter(TaskParamGetManualAddedDeviceTask.PARAM_COMM_PORT.getName());     final Date date = new Date();     JdbcConnectionSource conn = null;     Device dev = new Device();     try {       CSModbusProtocolAdapter cSModbusProtocolAdapter;       CSBusGetDevInfo cSBusGetDevInfo;       final Device res;       conn = DataSourceManager.getConnectionSource();       final List<DeviceTab> devList = new ArrayList<>();       ProtocolAdapter bus = null;       if (protocol.byteValue() == 1) {         CSBusProtocolAdapter cSBusProtocolAdapter = new CSBusProtocolAdapter(true);       } else if (protocol.byteValue() == 5) {         CSModbusProtocolAdapter modbus = new CSModbusProtocolAdapter(true);         if (commType.byteValue() == 2)           modbus.setModbusComm(CSModbusProtocolAdapter.ModbusComm.MODBUS_COMM_TCP);          cSModbusProtocolAdapter = modbus;       }        dev.setPortAddress(port);       dev.setAddress(addr.intValue());       dev.setAutoDetect(false);       Action act = null;       if (commType.byteValue() == 2) {         dev.setCommunicationAdapter(cSModbusProtocolAdapter.getCommAdapter(CommunicationEthernetAdapter.class));         GetDeviceAction getDeviceAction = new GetDeviceAction();       } else if (commType.byteValue() == 3) {         dev.setCommunicationAdapter(cSModbusProtocolAdapter.getCommAdapter(CommunicationRS485Adapter.class));         Dao<ComPortTab, String> cpDao = DaoManager.createDao((ConnectionSource)conn, ComPortTab.class);         List<ComPortTab> cpl = cpDao.queryForAll();         if (cpl != null && cpl.size() > 0) {           ComPortTab cp = cpl.get(0);           dev.setPortAddress(DBOperationUtil.comFromTab(cp));           port = cp.getPortName();         }          cSBusGetDevInfo = new CSBusGetDevInfo();       } else if (commType.byteValue() == 4) {         dev.setCommunicationAdapter(cSModbusProtocolAdapter.getCommAdapter(CommunicationEthernetRS485Adapter.class));         dev.setPortAddress(port);         cSBusGetDevInfo = new CSBusGetDevInfo();       }        try {         dev.openConnection();         res = (Device)dev.executeAction((Action)cSBusGetDevInfo).getValue();         res.setCommunicationAdapter(dev.getCommunicationAdapter());         res.setPortAddress(dev.getPortAddress());         res.setAutoDetect(false);       } finally {         dev.closeConnection();       }        try {         res.openConnection();         List<CSCommChannelSetting> list = (List<CSCommChannelSetting>)res.executeAction((Action)new CSBusGetAllChannelStructAction())           .getValue();         for (CSCommChannelSetting channelSetting : list) {           Channel channel = Channel.createChannelFromSturct(channelSetting);           res.addChannel(channel);         }        } finally {         res.closeConnection();       }        final Dao<DeviceTab, Long> devDao = DaoManager.createDao((ConnectionSource)conn, DeviceTab.class);       JdbcConnectionSource connTmp = conn;       final String portFinal = port;       TransactionManager.callInTransaction((ConnectionSource)conn, new Callable<Void>() {             public Void call() throws Exception {               DeviceTab deviceTable = new DeviceTab(res.getSerialNumber(), res.getIdentification(), res.getCsbusVersion(),                    res.getFirmwareVersion(), commType.byteValue(), protocol.byteValue(), (byte)                   2,                    3, res.getAddress(),                    portFinal, date, date);               devDao.create(deviceTable);               ForeignCollection<ChannelTab> devForeignList = devDao.getEmptyForeignCollection("channels");               for (Channel channel : res.getChannels()) {                 ChannelTab chTab = new ChannelTab(deviceTable, Integer.valueOf(3),                      Integer.valueOf(channel.getLogicalChannelNo()), channel.getDeviceDescription(),                      channel.getSubDevDescription(), channel.getSensorDescription(),                      channel.getChannelDescription(), Integer.valueOf(channel.getResolution()),                      Integer.valueOf(channel.getUnitIndex()), channel.getUnitInASCII(), Integer.valueOf(channel.getDeviceID()),                      Integer.valueOf(channel.getSubDeviceID()), Integer.valueOf(channel.getSensorID()), Integer.valueOf(channel.getChannelID()),                      Integer.valueOf(channel.getSlaverType()), Integer.valueOf(channel.getSlaverAddr()),                      Integer.valueOf(channel.getSlaverInnerChannelNo()), Integer.valueOf(channel.getMeasureType()),                      Float.valueOf(channel.getAnaScalingHi()), Float.valueOf(channel.getAnaScalingLo()), Float.valueOf(channel.getmBA1()),                      Float.valueOf(channel.getmBA0()), Integer.valueOf(channel.getmBValueAddr()),                      Integer.valueOf(channel.getmBInputValueType()), Integer.valueOf(channel.getmBOutputValueType()),                      Float.valueOf(channel.getErrorValue()), Byte.valueOf(channel.getChOptionalConfig()), date, date,                      Byte.valueOf((byte)channel.getmBAccessFuncCode()), Float.valueOf(channel.getmBScalingHi()),                      Float.valueOf(channel.getmBScalingLo()), Float.valueOf(channel.getmBRangeHi()), Float.valueOf(channel.getmBRangeLo()),                      channel.getVirtualCalcFormula(), Float.valueOf(channel.getVirtualConstantValueA()),                      Float.valueOf(channel.getVirtualConstantValueB()), Float.valueOf(channel.getVirtualConstantValueC()),                      Float.valueOf(channel.getVirtualConstantValueD()));                 chTab.setMinValue(Double.valueOf(-9999.0D));                 chTab.setMaxValue(Double.valueOf(-9999.0D));                 devForeignList.add(chTab);               }                boolean isRelayON = false;               if (res.getIdentification() == 4178 ||                  res.getIdentification() == 4179 ||                  res.getIdentification() == 4181) {                 double fwVer = Double.parseDouble(res.getFirmwareVersion());                 if (MiscUtilShared.isSame(fwVer, 1.54D) ||                    fwVer > 1.54D)                   isRelayON = true;                } else if (res.getIdentification() == 4197 ||                  res.getIdentification() == 4196) {                 isRelayON = true;               }                if (isRelayON) {                 ForeignCollection<RelayTab> foreignCollectionRelays = devDao.getEmptyForeignCollection("relays");                 for (int i = 0; i < 2; i++) {                   RelayTab rt = new RelayTab();                   rt.setIndex(Long.valueOf(i));                   rt.setDismiss(Boolean.valueOf(false));                   rt.setLastModifiedDate(date);                   rt.setCreatedDate(date);                   rt.setDevice(deviceTable);                   rt.setStatus(Integer.valueOf(3));                   foreignCollectionRelays.add(rt);                 }                }                devDao.update(deviceTable);               devList.add(deviceTable);               StringBuilder sb = new StringBuilder();               for (DeviceTab dt : devList)                 sb.append(String.valueOf(dt.getDeviceId()) + ",");                sb.deleteCharAt(sb.length() - 1);               GetManualAddedDeviceTask.this.setTaskReturnData(sb.toString());               return null;             }           });       setTaskStatus(2);       logger.info("Finished");     } catch (CommException ex) {       Gson gson = new Gson();       setTaskStatus(3);       CommExceptionBean ceb = new CommExceptionBean();       ceb.setExCategory(ex.geteCode().getCategory());       ceb.setExCode(ex.geteCode().getCode());       ceb.setExDevECode(ex.getDevECode());       DeviceBean db = new DeviceBean();       ceb.setExDevBean(db);       String returnData = gson.toJson(ceb);       setTaskReturnData(returnData);     } catch (Exception ex) {       setTaskStatus(3);       setTaskReturnData(ex.getMessage());       logger.error(ex.getMessage(), ex);     } finally {       dev.closeConnection();       if (conn != null)         try {           conn.close();         } catch (SQLException e) {           setTaskStatus(3);           setTaskReturnData(e.getMessage());           logger.error(e.getMessage(), e);         }       }    } }  

---

## Append

package com.cs.communication.util;

import java.io.UnsupportedEncodingException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.DoubleBuffer;
import java.nio.IntBuffer;

public class DataTypeConverter {
  private static final char[] HEX_DIGITS = new char[] { 
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 
      'a', 'b', 'c', 'd', 'e', 'f' };
  
  public static String shortToString(short data) {
    char[] buf = new char[4];
    for (int i = 3; i >= 0; i--) {
      buf[i] = HEX_DIGITS[data & 0xF];
      data = (short)(data >>> 4);
    } 
    return new String(buf);
  }
  
  public static String byteToString(byte value) {
    char[] buf = new char[2];
    for (int i = 1; i >= 0; i--) {
      buf[i] = HEX_DIGITS[value & 0xF];
      value = (byte)(value >>> 4);
    } 
    return new String(buf);
  }
  
  public static int byteArrayToIntLSB(byte[] byteArray) {
    ByteBuffer byteBuf = ByteBuffer.wrap(byteArray);
    byteBuf.order(ByteOrder.LITTLE_ENDIAN);
    IntBuffer intBuf = byteBuf.asIntBuffer();
    int iValue = intBuf.get();
    return iValue;
  }
  
  public static short byteArrayToShortLSB(byte[] byteArray) {
    return bytesToShortLSB(byteArray[0], byteArray[1]);
  }
  
  public static short bytesToShortLSB(byte bLow, byte bHigh) {
    short value = 0;
    try {
      short firstByte = (short)(0xFF & (short)bLow);
      short secondByte = (short)(0xFF & (short)bHigh);
      value = (short)(secondByte << 8 | firstByte);
    } catch (Exception e) {
      e.printStackTrace();
    } 
    return value;
  }
  
  public static short bytesToShort(byte bLow, byte bHigh) {
    short firstByte = (short)(0xFF & (short)bLow);
    short secondByte = (short)(0xFF & (short)bHigh);
    return (short)(secondByte << 8 | firstByte);
  }
  
  public static String byteArrayToString(byte[] byteArray) {
    String sValue = "";
    for (int i = 0; i < byteArray.length; i++)
      sValue = sValue + (char)byteArray[i]; 
    return sValue;
  }
  
  public static String byteArrayToStringStopAt0(byte[] byteArray) {
    String sValue = "";
    for (int i = 0; i < byteArray.length; i++) {
      if (byteArray[i] == 0)
        return sValue; 
      char c = (char)(0xFF & byteArray[i]);
      sValue = sValue + c;
    } 
    return sValue;
  }
  
  public static byte[] shortToByteArray(short intValue) {
    byte[] result = new byte[2];
    result[1] = (byte)((intValue & 0xFF00) >> 8);
    result[0] = (byte)(intValue & 0xFF);
    return result;
  }
  
  public static byte[] stringToByteArray(String s, int length) {
    byte[] result = new byte[length];
    int size = s.length();
    if (size > length)
      size = length; 
    for (int i = 0; i < size; i++)
      result[i] = s.getBytes()[i]; 
    return result;
  }
  
  public static int byteToInt(byte b) {
    return 0xFF & b;
  }
  
  public static String byteArrayToUTFStringStopAt0(byte[] byteArray) {
    String sValue = "";
    int count = 0;
    for (int i = 0; i < byteArray.length; i++) {
      if (byteArray[i] == 0) {
        count = i;
        break;
      } 
    } 
    byte[] tmp = new byte[count];
    for (int j = 0; j < count; j++)
      tmp[j] = byteArray[j]; 
    try {
      sValue = new String(tmp, "UTF-8");
    } catch (UnsupportedEncodingException ex) {
      ex.printStackTrace();
    } 
    return sValue;
  }
  
  public static byte[] intToByteArray(int intValue) {
    byte[] result = new byte[4];
    result[3] = (byte)((intValue & 0xFF000000) >> 24);
    result[2] = (byte)((intValue & 0xFF0000) >> 16);
    result[1] = (byte)((intValue & 0xFF00) >> 8);
    result[0] = (byte)(intValue & 0xFF);
    return result;
  }
  
  public static byte[] intToByteArrayMSB(int intValue) {
    byte[] result = new byte[4];
    result[0] = (byte)((intValue & 0xFF000000) >> 24);
    result[1] = (byte)((intValue & 0xFF0000) >> 16);
    result[2] = (byte)((intValue & 0xFF00) >> 8);
    result[3] = (byte)(intValue & 0xFF);
    return result;
  }
  
  public static double byteArrayToDoubleLSB(byte[] byteArray) {
    ByteBuffer byteBuf = ByteBuffer.wrap(byteArray);
    byteBuf.order(ByteOrder.LITTLE_ENDIAN);
    DoubleBuffer doubleBuf = byteBuf.asDoubleBuffer();
    double dValue = doubleBuf.get();
    return dValue;
  }
  
  public static double modbusData2Double(int type, byte[] byteArray, int offset) {
    byte[] tbuf;
    int tint;
    short t;
    double v = 0.0D;
    ByteBuffer byteBuf = ByteBuffer.wrap(byteArray);
    byteBuf.order(ByteOrder.BIG_ENDIAN);
    byteBuf.position(offset);
    switch (type) {
      case 1:
        v = byteBuf.getShort();
        break;
      case 2:
        t = byteBuf.getShort();
        v = (t & 0xFFFF);
        break;
      case 3:
        v = byteBuf.getInt();
        break;
      case 4:
        tbuf = new byte[4];
        tbuf[2] = byteBuf.get();
        tbuf[3] = byteBuf.get();
        tbuf[0] = byteBuf.get();
        tbuf[1] = byteBuf.get();
        byteBuf = ByteBuffer.wrap(tbuf);
        byteBuf.order(ByteOrder.BIG_ENDIAN);
        v = byteBuf.getInt();
        break;
      case 5:
        v = (byteBuf.getInt() & 0xFFFFFFFFL);
        break;
      case 6:
        tbuf = new byte[4];
        tbuf[2] = byteBuf.get();
        tbuf[3] = byteBuf.get();
        tbuf[0] = byteBuf.get();
        tbuf[1] = byteBuf.get();
        byteBuf = ByteBuffer.wrap(tbuf);
        byteBuf.order(ByteOrder.BIG_ENDIAN);
        tint = byteBuf.getInt();
        v = (tint & 0xFFFFFFFFL);
        break;
      case 7:
        v = byteBuf.getFloat();
        break;
      case 8:
        tbuf = new byte[4];
        tbuf[2] = byteBuf.get();
        tbuf[3] = byteBuf.get();
        tbuf[0] = byteBuf.get();
        tbuf[1] = byteBuf.get();
        byteBuf = ByteBuffer.wrap(tbuf);
        byteBuf.order(ByteOrder.BIG_ENDIAN);
        v = byteBuf.getFloat();
        break;
    } 
    return v;
  }
}
package com.cs.communication.util;

public class MathUtil {
  public static final double PRICISION = 1.0E-7D;
  
  public static final int[] calculateCRC(byte[] data, int offset, int len) {
    int[] crc = { 255, 255 };
    int nextByte = 0;
    len += offset;
    for (int i = offset; i < len && i < data.length; i++) {
      nextByte = 0xFF & data[i];
      int uIndex = crc[0] ^ nextByte;
      crc[0] = crc[1] ^ auchCRCHi[uIndex];
      crc[1] = auchCRCLo[uIndex];
    } 
    return crc;
  }
  
  public static boolean isSame(double val0, double val1) {
    if (Math.abs(val0 - val1) < 1.0E-7D)
      return true; 
    return false;
  }
  
  public static final int calculateLRC(byte[] data, int off, int len) {
    int lrc = 0;
    for (int i = off; i < len; i++)
      lrc += data[i] & 0xFF; 
    lrc = (lrc ^ 0xFF) + 1;
    return (byte)lrc & 0xFF;
  }
  
  private static final short[] auchCRCHi = new short[] { 
      0, 193, 129, 64, 1, 192, 128, 65, 1, 192, 
      128, 65, 0, 193, 129, 64, 1, 192, 128, 65, 
      0, 193, 129, 64, 0, 193, 129, 64, 1, 192, 
      128, 65, 1, 192, 128, 65, 0, 193, 129, 64, 
      0, 193, 129, 64, 1, 192, 128, 65, 0, 193, 
      129, 64, 1, 192, 128, 65, 1, 192, 128, 65, 
      0, 193, 129, 64, 1, 192, 128, 65, 0, 193, 
      129, 64, 0, 193, 129, 64, 1, 192, 128, 65, 
      0, 193, 129, 64, 1, 192, 128, 65, 1, 192, 
      128, 65, 0, 193, 129, 64, 0, 193, 129, 64, 
      1, 192, 128, 65, 1, 192, 128, 65, 0, 193, 
      129, 64, 1, 192, 128, 65, 0, 193, 129, 64, 
      0, 193, 129, 64, 1, 192, 128, 65, 1, 192, 
      128, 65, 0, 193, 129, 64, 0, 193, 129, 64, 
      1, 192, 128, 65, 0, 193, 129, 64, 1, 192, 
      128, 65, 1, 192, 128, 65, 0, 193, 129, 64, 
      0, 193, 129, 64, 1, 192, 128, 65, 1, 192, 
      128, 65, 0, 193, 129, 64, 1, 192, 128, 65, 
      0, 193, 129, 64, 0, 193, 129, 64, 1, 192, 
      128, 65, 0, 193, 129, 64, 1, 192, 128, 65, 
      1, 192, 128, 65, 0, 193, 129, 64, 1, 192, 
      128, 65, 0, 193, 129, 64, 0, 193, 129, 64, 
      1, 192, 128, 65, 1, 192, 128, 65, 0, 193, 
      129, 64, 0, 193, 129, 64, 1, 192, 128, 65, 
      0, 193, 129, 64, 1, 192, 128, 65, 1, 192, 
      128, 65, 0, 193, 129, 64 };
  
  private static final short[] auchCRCLo = new short[] { 
      0, 192, 193, 1, 195, 3, 2, 194, 198, 6, 
      7, 199, 5, 197, 196, 4, 204, 12, 13, 205, 
      15, 207, 206, 14, 10, 202, 203, 11, 201, 9, 
      8, 200, 216, 24, 25, 217, 27, 219, 218, 26, 
      30, 222, 223, 31, 221, 29, 28, 220, 20, 212, 
      213, 21, 215, 23, 22, 214, 210, 18, 19, 211, 
      17, 209, 208, 16, 240, 48, 49, 241, 51, 243, 
      242, 50, 54, 246, 247, 55, 245, 53, 52, 244, 
      60, 252, 253, 61, 255, 63, 62, 254, 250, 58, 
      59, 251, 57, 249, 248, 56, 40, 232, 233, 41, 
      235, 43, 42, 234, 238, 46, 47, 239, 45, 237, 
      236, 44, 228, 36, 37, 229, 39, 231, 230, 38, 
      34, 226, 227, 35, 225, 33, 32, 224, 160, 96, 
      97, 161, 99, 163, 162, 98, 102, 166, 167, 103, 
      165, 101, 100, 164, 108, 172, 173, 109, 175, 111, 
      110, 174, 170, 106, 107, 171, 105, 169, 168, 104, 
      120, 184, 185, 121, 187, 123, 122, 186, 190, 126, 
      127, 191, 125, 189, 188, 124, 180, 116, 117, 181, 
      119, 183, 182, 118, 114, 178, 179, 115, 177, 113, 
      112, 176, 80, 144, 145, 81, 147, 83, 82, 146, 
      150, 86, 87, 151, 85, 149, 148, 84, 156, 92, 
      93, 157, 95, 159, 158, 94, 90, 154, 155, 91, 
      153, 89, 88, 152, 136, 72, 73, 137, 75, 139, 
      138, 74, 78, 142, 143, 79, 141, 77, 76, 140, 
      68, 132, 133, 69, 135, 71, 70, 134, 130, 66, 
      67, 131, 65, 129, 128, 64 };
}
package com.cs.communication.device;

import com.cs.communication.struct.CSCommChannelSetting;
import com.cs.communication.util.DataTypeConverter;
import java.io.Serializable;

public class Channel implements Serializable, Comparable<Channel> {
  private static final long serialVersionUID = 5403496565117941756L;
  
  private int logicalChannelNo;
  
  private String deviceDescription;
  
  private String subDevDescription;
  
  private String sensorDescription;
  
  private String channelDescription;
  
  private int resolution = 2;
  
  private int unitIndex;
  
  private String unitInASCII;
  
  private int deviceID = 0;
  
  private int subDeviceID = 0;
  
  private int sensorID = 0;
  
  private int channelID = 0;
  
  private int slaverType;
  
  private int slaverAddr;
  
  private int slaverInnerChannelNo;
  
  private int measureType;
  
  private float anaScalingHi;
  
  private float anaScalingLo;
  
  private float mBA1;
  
  private float mBA0;
  
  private short mBValueAddr;
  
  private int mBInputValueType;
  
  private int mBOutputValueType;
  
  private int mBAccessFuncCode;
  
  private float mBScalingHi;
  
  private float mBScalingLo;
  
  private float mBRangeHi;
  
  private float mBRangeLo;
  
  private float errorValue;
  
  private String virtualCalcFormula;
  
  private float virtualConstantValueA;
  
  private float virtualConstantValueB;
  
  private float virtualConstantValueC;
  
  private float virtualConstantValueD;
  
  private byte chOptionalConfig;
  
  private double measurementValue = -9999.0D;
  
  private String measurementUnit = "";
  
  private int measurementValueStatus = 2;
  
  public static final int VALUE_STATUS_NORMAL = 0;
  
  public static final int VALUE_STATUS_OVERRANGED = 1;
  
  public static final int VALUE_STATUS_INVALID = 2;
  
  public static final int MBOUTPUT_VALUE_TYPE_INT32_L = 4;
  
  public static final int MBOUTPUT_VALUE_TYPE_UINT32_L = 6;
  
  public static final int MBOUTPUT_VALUE_TYPE_FLOAT_L = 8;
  
  public static Channel createChannelFromSturct(CSCommChannelSetting setting) {
    Channel channel = new Channel();
    channel.logicalChannelNo = DataTypeConverter.byteToInt(setting.getLogicalChannelNo());
    channel.deviceDescription = DataTypeConverter.byteArrayToUTFStringStopAt0(setting.getDeviceDescription());
    channel.subDevDescription = DataTypeConverter.byteArrayToUTFStringStopAt0(setting.getSubDevDescription());
    channel.sensorDescription = DataTypeConverter.byteArrayToUTFStringStopAt0(setting.getSensorDescription());
    channel.channelDescription = DataTypeConverter.byteArrayToUTFStringStopAt0(setting.getChannelDescription());
    channel.resolution = DataTypeConverter.byteToInt(setting.getResolution());
    channel.unitIndex = DataTypeConverter.byteToInt(setting.getUnitIndex());
    channel.unitInASCII = DataTypeConverter.byteArrayToUTFStringStopAt0(setting.getUnitInASCII());
    channel.deviceID = setting.getDeviceID();
    channel.subDeviceID = setting.getSubDeviceID();
    channel.sensorID = setting.getSensorID();
    channel.channelID = setting.getChannelID();
    channel.slaverType = DataTypeConverter.byteToInt(setting.getSlaverType());
    channel.slaverAddr = DataTypeConverter.byteToInt(setting.getSlaverAddr());
    channel.slaverInnerChannelNo = DataTypeConverter.byteToInt(setting.getSlaverInnerChannelNo());
    channel.measureType = DataTypeConverter.byteToInt(setting.getMeasureType());
    channel.anaScalingHi = setting.getAnaScalingHi();
    channel.anaScalingLo = setting.getAnaScalingLo();
    channel.mBA1 = setting.getmBA1();
    channel.mBA0 = setting.getmBA0();
    channel.mBValueAddr = setting.getmBValueAddr();
    channel.mBInputValueType = DataTypeConverter.byteToInt(setting.getmBInputValueType());
    channel.mBOutputValueType = DataTypeConverter.byteToInt(setting.getmBOutputValueType());
    channel.mBAccessFuncCode = DataTypeConverter.byteToInt(setting.getmBAccessFuncCode());
    channel.mBScalingHi = setting.getmBScalingHi();
    channel.mBScalingLo = setting.getmBScalingLo();
    channel.mBRangeHi = setting.getmBRangeHi();
    channel.mBRangeLo = setting.getmBRangeLo();
    channel.errorValue = setting.getErrorValue();
    channel.virtualCalcFormula = DataTypeConverter.byteArrayToStringStopAt0(setting.getVirtualCalcFormula());
    channel.virtualConstantValueA = setting.getVirtualConstantValueA();
    channel.virtualConstantValueB = setting.getVirtualConstantValueB();
    channel.virtualConstantValueC = setting.getVirtualConstantValueC();
    channel.virtualConstantValueD = setting.getVirtualConstantValueD();
    channel.chOptionalConfig = setting.getChOptionalConfig();
    return channel;
  }
  
  public int getLogicalChannelNo() {
    return this.logicalChannelNo;
  }
  
  public void setLogicalChannelNo(int logicalChannelNo) {
    this.logicalChannelNo = logicalChannelNo;
  }
  
  public String getDeviceDescription() {
    return this.deviceDescription;
  }
  
  public void setDeviceDescription(String deviceDescription) {
    this.deviceDescription = deviceDescription;
  }
  
  public String getSubDevDescription() {
    return this.subDevDescription;
  }
  
  public void setSubDevDescription(String subDevDescription) {
    this.subDevDescription = subDevDescription;
  }
  
  public String getSensorDescription() {
    return this.sensorDescription;
  }
  
  public void setSensorDescription(String sensorDescription) {
    this.sensorDescription = sensorDescription;
  }
  
  public String getChannelDescription() {
    return this.channelDescription;
  }
  
  public void setChannelDescription(String channelDescription) {
    this.channelDescription = channelDescription;
  }
  
  public int getResolution() {
    return this.resolution;
  }
  
  public void setResolution(int resolution) {
    this.resolution = resolution;
  }
  
  public int getUnitIndex() {
    return this.unitIndex;
  }
  
  public void setUnitIndex(int unitIndex) {
    this.unitIndex = unitIndex;
  }
  
  public String getUnitInASCII() {
    return this.unitInASCII;
  }
  
  public void setUnitInASCII(String unitInASCII) {
    this.unitInASCII = unitInASCII;
  }
  
  public int getDeviceID() {
    return this.deviceID;
  }
  
  public void setDeviceID(int deviceID) {
    this.deviceID = deviceID;
  }
  
  public int getSubDeviceID() {
    return this.subDeviceID;
  }
  
  public void setSubDeviceID(int subDeviceID) {
    this.subDeviceID = subDeviceID;
  }
  
  public int getSensorID() {
    return this.sensorID;
  }
  
  public void setSensorID(int sensorID) {
    this.sensorID = sensorID;
  }
  
  public int getChannelID() {
    return this.channelID;
  }
  
  public void setChannelID(int channelID) {
    this.channelID = channelID;
  }
  
  public int getSlaverType() {
    return this.slaverType;
  }
  
  public void setSlaverType(int slaverType) {
    this.slaverType = slaverType;
  }
  
  public int getSlaverAddr() {
    return this.slaverAddr;
  }
  
  public void setSlaverAddr(int slaverAddr) {
    this.slaverAddr = slaverAddr;
  }
  
  public int getSlaverInnerChannelNo() {
    return this.slaverInnerChannelNo;
  }
  
  public void setSlaverInnerChannelNo(int slaverInnerChannelNo) {
    this.slaverInnerChannelNo = slaverInnerChannelNo;
  }
  
  public int getMeasureType() {
    return this.measureType;
  }
  
  public void setMeasureType(int measureType) {
    this.measureType = measureType;
  }
  
  public float getAnaScalingHi() {
    return this.anaScalingHi;
  }
  
  public void setAnaScalingHi(float anaScalingHi) {
    this.anaScalingHi = anaScalingHi;
  }
  
  public float getAnaScalingLo() {
    return this.anaScalingLo;
  }
  
  public void setAnaScalingLo(float anaScalingLo) {
    this.anaScalingLo = anaScalingLo;
  }
  
  public float getmBA1() {
    return this.mBA1;
  }
  
  public void setmBA1(float mBA1) {
    this.mBA1 = mBA1;
  }
  
  public float getmBA0() {
    return this.mBA0;
  }
  
  public void setmBA0(float mBA0) {
    this.mBA0 = mBA0;
  }
  
  public short getmBValueAddr() {
    return this.mBValueAddr;
  }
  
  public void setmBValueAddr(short mBValueAddr) {
    this.mBValueAddr = mBValueAddr;
  }
  
  public int getmBInputValueType() {
    return this.mBInputValueType;
  }
  
  public void setmBInputValueType(int mBInputValueType) {
    this.mBInputValueType = mBInputValueType;
  }
  
  public int getmBOutputValueType() {
    return this.mBOutputValueType;
  }
  
  public void setmBOutputValueType(int mBOutputValueType) {
    this.mBOutputValueType = mBOutputValueType;
  }
  
  public int getmBAccessFuncCode() {
    return this.mBAccessFuncCode;
  }
  
  public void setmBAccessFuncCode(int mBAccessFuncCode) {
    this.mBAccessFuncCode = mBAccessFuncCode;
  }
  
  public float getmBScalingHi() {
    return this.mBScalingHi;
  }
  
  public void setmBScalingHi(float mBScalingHi) {
    this.mBScalingHi = mBScalingHi;
  }
  
  public float getmBScalingLo() {
    return this.mBScalingLo;
  }
  
  public void setmBScalingLo(float mBScalingLo) {
    this.mBScalingLo = mBScalingLo;
  }
  
  public float getmBRangeHi() {
    return this.mBRangeHi;
  }
  
  public void setmBRangeHi(float mBRangeHi) {
    this.mBRangeHi = mBRangeHi;
  }
  
  public float getmBRangeLo() {
    return this.mBRangeLo;
  }
  
  public void setmBRangeLo(float mBRangeLo) {
    this.mBRangeLo = mBRangeLo;
  }
  
  public float getErrorValue() {
    return this.errorValue;
  }
  
  public void setErrorValue(float errorValue) {
    this.errorValue = errorValue;
  }
  
  public String getVirtualCalcFormula() {
    return this.virtualCalcFormula;
  }
  
  public void setVirtualCalcFormula(String virtualCalcFormula) {
    this.virtualCalcFormula = virtualCalcFormula;
  }
  
  public float getVirtualConstantValueA() {
    return this.virtualConstantValueA;
  }
  
  public void setVirtualConstantValueA(float virtualConstantValueA) {
    this.virtualConstantValueA = virtualConstantValueA;
  }
  
  public float getVirtualConstantValueB() {
    return this.virtualConstantValueB;
  }
  
  public void setVirtualConstantValueB(float virtualConstantValueB) {
    this.virtualConstantValueB = virtualConstantValueB;
  }
  
  public float getVirtualConstantValueC() {
    return this.virtualConstantValueC;
  }
  
  public void setVirtualConstantValueC(float virtualConstantValueC) {
    this.virtualConstantValueC = virtualConstantValueC;
  }
  
  public float getVirtualConstantValueD() {
    return this.virtualConstantValueD;
  }
  
  public void setVirtualConstantValueD(float virtualConstantValueD) {
    this.virtualConstantValueD = virtualConstantValueD;
  }
  
  public byte getChOptionalConfig() {
    return this.chOptionalConfig;
  }
  
  public void setChOptionalConfig(byte chOptionalConfig) {
    this.chOptionalConfig = chOptionalConfig;
  }
  
  public double getMeasurementValue() {
    return this.measurementValue;
  }
  
  public void setMeasurementValue(double measurementValue) {
    this.measurementValue = measurementValue;
  }
  
  public String getMeasurementUnit() {
    return this.measurementUnit;
  }
  
  public void setMeasurementUnit(String measurementUnit) {
    this.measurementUnit = measurementUnit;
  }
  
  public int getMeasurementValueStatus() {
    return this.measurementValueStatus;
  }
  
  public void setMeasurementValueStatus(int measurementValueStatus) {
    this.measurementValueStatus = measurementValueStatus;
  }
  
  public int compareTo(Channel arg0) {
    if (null == arg0)
      return 1; 
    if (getLogicalChannelNo() == arg0.getLogicalChannelNo())
      return 0; 
    if (getLogicalChannelNo() > arg0.getLogicalChannelNo())
      return 1; 
    if (getLogicalChannelNo() < arg0.getLogicalChannelNo())
      return -1; 
    return 1;
  }
}
package com.cs.communication.csbus.action;

import com.cs.communication.Action;

public class CSBusGetAllChannelStructAction extends Action {
  public String getName() {
    return "csbusGetAllChannelStruct";
  }
}
package com.cs.communication.struct;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public class CSCommChannelSetting extends CSCommData {
  public static final byte MEA_SLAVE_TYPE_SDI = 1;
  
  public static final byte MEA_SLAVE_TYPE_INTERANL_ANA = 2;
  
  public static final byte MEA_SLAVE_TYPE_EXTERANL_ANA = 3;
  
  public static final byte MEA_SLAVE_TYPE_BUS_SENSOR = 4;
  
  public static final byte MEA_SLAVE_TYPE_VIRTUAL = 5;
  
  public static final byte MEA_SLAVE_TYPE_RESERVED = 6;
  
  public static final byte MEA_SLAVE_TYPE_UNUSED = -1;
  
  private static int LENGTH_7 = 7;
  
  private static int LENGTH_12 = 12;
  
  private static int LENGTH_20 = 20;
  
  private static int LENGTH_21 = 21;
  
  private byte logicalChannelNo;
  
  private byte[] deviceDescription = new byte[LENGTH_21];
  
  private byte[] subDevDescription = new byte[LENGTH_21];
  
  private byte[] sensorDescription = new byte[LENGTH_21];
  
  private byte[] channelDescription = new byte[LENGTH_21];
  
  private byte resolution;
  
  private byte unitIndex;
  
  private byte[] unitInASCII = new byte[LENGTH_12];
  
  private int deviceID = 0;
  
  private int subDeviceID = 0;
  
  private int sensorID = 0;
  
  private int channelID = 0;
  
  private byte slaverType;
  
  private byte slaverAddr;
  
  private byte slaverInnerChannelNo;
  
  private byte measureType;
  
  private float anaScalingHi;
  
  private float anaScalingLo;
  
  private float mBA1;
  
  private float mBA0;
  
  private short mBValueAddr;
  
  private byte mBInputValueType;
  
  private byte mBOutputValueType;
  
  private byte mBAccessFuncCode;
  
  private float mBScalingHi;
  
  private float mBScalingLo;
  
  private float mBRangeHi;
  
  private float mBRangeLo;
  
  private float errorValue;
  
  private byte[] virtualCalcFormula = new byte[LENGTH_20];
  
  private float virtualConstantValueA;
  
  private float virtualConstantValueB;
  
  private float virtualConstantValueC;
  
  private float virtualConstantValueD;
  
  private byte chOptionalConfig;
  
  private byte[] reserved = new byte[LENGTH_7];
  
  public CSCommChannelSetting() {
    this.size = 204;
  }
  
  public void parseByteArray(byte[] byteArray) {
    ByteBuffer byteBuf = ByteBuffer.wrap(byteArray);
    byteBuf.order(ByteOrder.LITTLE_ENDIAN);
    this.logicalChannelNo = byteBuf.get();
    byteBuf.get(this.deviceDescription, 0, LENGTH_21);
    byteBuf.get(this.subDevDescription, 0, LENGTH_21);
    byteBuf.get(this.sensorDescription, 0, LENGTH_21);
    byteBuf.get(this.channelDescription, 0, LENGTH_21);
    this.resolution = byteBuf.get();
    this.unitIndex = byteBuf.get();
    byteBuf.get(this.unitInASCII, 0, LENGTH_12);
    this.deviceID = byteBuf.getInt();
    this.subDeviceID = byteBuf.getInt();
    this.sensorID = byteBuf.getInt();
    this.channelID = byteBuf.getInt();
    this.slaverType = byteBuf.get();
    this.slaverAddr = byteBuf.get();
    this.slaverInnerChannelNo = byteBuf.get();
    this.measureType = byteBuf.get();
    this.anaScalingHi = byteBuf.getFloat();
    this.anaScalingLo = byteBuf.getFloat();
    this.mBA1 = byteBuf.getFloat();
    this.mBA0 = byteBuf.getFloat();
    this.mBValueAddr = byteBuf.getShort();
    this.mBInputValueType = byteBuf.get();
    this.mBOutputValueType = byteBuf.get();
    this.mBAccessFuncCode = byteBuf.get();
    this.mBScalingHi = byteBuf.getFloat();
    this.mBScalingLo = byteBuf.getFloat();
    this.mBRangeHi = byteBuf.getFloat();
    this.mBRangeLo = byteBuf.getFloat();
    float error = 0.0F;
    switch (this.mBInputValueType) {
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
        error = byteBuf.getInt();
        break;
      case 7:
      case 8:
        error = byteBuf.getFloat();
        break;
    } 
    if (error != Float.NaN) {
      this.errorValue = error;
    } else {
      this.errorValue = -100.0F;
    } 
    byteBuf.get(this.virtualCalcFormula, 0, LENGTH_20);
    this.virtualConstantValueA = byteBuf.getFloat();
    this.virtualConstantValueB = byteBuf.getFloat();
    this.virtualConstantValueC = byteBuf.getFloat();
    this.virtualConstantValueD = byteBuf.getFloat();
    this.chOptionalConfig = byteBuf.get();
    byteBuf.get(this.reserved, 0, LENGTH_7);
  }
  
  public byte[] buildByteArray() {
    try {
      byte[] byteArray = new byte[this.size];
      ByteBuffer byteBuf = ByteBuffer.wrap(byteArray);
      byteBuf.order(ByteOrder.LITTLE_ENDIAN);
      byteBuf.put(this.logicalChannelNo);
      byteBuf.put(this.deviceDescription);
      byteBuf.put(this.subDevDescription);
      byteBuf.put(this.sensorDescription);
      byteBuf.put(this.channelDescription);
      byteBuf.put(this.resolution);
      byteBuf.put(this.unitIndex);
      byteBuf.put(this.unitInASCII);
      byteBuf.putInt(this.deviceID);
      byteBuf.putInt(this.subDeviceID);
      byteBuf.putInt(this.sensorID);
      byteBuf.putInt(this.channelID);
      byteBuf.put(this.slaverType);
      byteBuf.put(this.slaverAddr);
      byteBuf.put(this.slaverInnerChannelNo);
      byteBuf.put(this.measureType);
      byteBuf.putFloat(this.anaScalingHi);
      byteBuf.putFloat(this.anaScalingLo);
      byteBuf.putFloat(this.mBA1);
      byteBuf.putFloat(this.mBA0);
      byteBuf.putShort(this.mBValueAddr);
      byteBuf.put(this.mBInputValueType);
      byteBuf.put(this.mBOutputValueType);
      byteBuf.put(this.mBAccessFuncCode);
      byteBuf.putFloat(this.mBScalingHi);
      byteBuf.putFloat(this.mBScalingLo);
      byteBuf.putFloat(this.mBRangeHi);
      byteBuf.putFloat(this.mBRangeLo);
      switch (this.mBInputValueType) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
          byteBuf.putInt((int)this.errorValue);
          break;
        case 7:
        case 8:
          byteBuf.putFloat(this.errorValue);
          break;
      } 
      byteBuf.put(this.virtualCalcFormula);
      byteBuf.putFloat(this.virtualConstantValueA);
      byteBuf.putFloat(this.virtualConstantValueB);
      byteBuf.putFloat(this.virtualConstantValueC);
      byteBuf.putFloat(this.virtualConstantValueD);
      byteBuf.put(this.chOptionalConfig);
      byteBuf.put(this.reserved);
      return byteArray;
    } catch (Exception e) {
      return null;
    } 
  }
  
  public byte getLogicalChannelNo() {
    return this.logicalChannelNo;
  }
  
  public void setLogicalChannelNo(byte logicalChannelNo) {
    this.logicalChannelNo = logicalChannelNo;
  }
  
  public byte[] getDeviceDescription() {
    return this.deviceDescription;
  }
  
  public void setDeviceDescription(byte[] deviceDescription) {
    this.deviceDescription = deviceDescription;
  }
  
  public byte[] getSubDevDescription() {
    return this.subDevDescription;
  }
  
  public void setSubDevDescription(byte[] subDevDescription) {
    this.subDevDescription = subDevDescription;
  }
  
  public byte[] getSensorDescription() {
    return this.sensorDescription;
  }
  
  public void setSensorDescription(byte[] sensorDescription) {
    this.sensorDescription = sensorDescription;
  }
  
  public byte[] getChannelDescription() {
    return this.channelDescription;
  }
  
  public void setChannelDescription(byte[] channelDescription) {
    this.channelDescription = channelDescription;
  }
  
  public byte getResolution() {
    return this.resolution;
  }
  
  public void setResolution(byte resolution) {
    this.resolution = resolution;
  }
  
  public byte getUnitIndex() {
    return this.unitIndex;
  }
  
  public void setUnitIndex(byte unitIndex) {
    this.unitIndex = unitIndex;
  }
  
  public byte[] getUnitInASCII() {
    return this.unitInASCII;
  }
  
  public void setUnitInASCII(byte[] unitInASCII) {
    this.unitInASCII = unitInASCII;
  }
  
  public int getDeviceID() {
    return this.deviceID;
  }
  
  public void setDeviceID(int deviceID) {
    this.deviceID = deviceID;
  }
  
  public int getSubDeviceID() {
    return this.subDeviceID;
  }
  
  public void setSubDeviceID(int subDeviceID) {
    this.subDeviceID = subDeviceID;
  }
  
  public int getSensorID() {
    return this.sensorID;
  }
  
  public void setSensorID(int sensorID) {
    this.sensorID = sensorID;
  }
  
  public int getChannelID() {
    return this.channelID;
  }
  
  public void setChannelID(int channelID) {
    this.channelID = channelID;
  }
  
  public byte getSlaverType() {
    return this.slaverType;
  }
  
  public void setSlaverType(byte slaverType) {
    this.slaverType = slaverType;
  }
  
  public byte getSlaverAddr() {
    return this.slaverAddr;
  }
  
  public void setSlaverAddr(byte slaverAddr) {
    this.slaverAddr = slaverAddr;
  }
  
  public byte getSlaverInnerChannelNo() {
    return this.slaverInnerChannelNo;
  }
  
  public void setSlaverInnerChannelNo(byte slaverInnerChannelNo) {
    this.slaverInnerChannelNo = slaverInnerChannelNo;
  }
  
  public byte getMeasureType() {
    return this.measureType;
  }
  
  public void setMeasureType(byte measureType) {
    this.measureType = measureType;
  }
  
  public float getAnaScalingHi() {
    return this.anaScalingHi;
  }
  
  public void setAnaScalingHi(float anaScalingHi) {
    this.anaScalingHi = anaScalingHi;
  }
  
  public float getAnaScalingLo() {
    return this.anaScalingLo;
  }
  
  public void setAnaScalingLo(float anaScalingLo) {
    this.anaScalingLo = anaScalingLo;
  }
  
  public float getmBA1() {
    return this.mBA1;
  }
  
  public void setmBA1(float mBA1) {
    this.mBA1 = mBA1;
  }
  
  public float getmBA0() {
    return this.mBA0;
  }
  
  public void setmBA0(float mBA0) {
    this.mBA0 = mBA0;
  }
  
  public short getmBValueAddr() {
    return this.mBValueAddr;
  }
  
  public void setmBValueAddr(short mBValueAddr) {
    this.mBValueAddr = mBValueAddr;
  }
  
  public byte getmBInputValueType() {
    return this.mBInputValueType;
  }
  
  public void setmBInputValueType(byte mBInputValueType) {
    this.mBInputValueType = mBInputValueType;
  }
  
  public byte getmBOutputValueType() {
    return this.mBOutputValueType;
  }
  
  public void setmBOutputValueType(byte mBOutputValueType) {
    this.mBOutputValueType = mBOutputValueType;
  }
  
  public byte getmBAccessFuncCode() {
    return this.mBAccessFuncCode;
  }
  
  public void setmBAccessFuncCode(byte mBAccessFuncCode) {
    this.mBAccessFuncCode = mBAccessFuncCode;
  }
  
  public float getmBScalingHi() {
    return this.mBScalingHi;
  }
  
  public void setmBScalingHi(float mBScalingHi) {
    this.mBScalingHi = mBScalingHi;
  }
  
  public float getmBScalingLo() {
    return this.mBScalingLo;
  }
  
  public void setmBScalingLo(float mBScalingLo) {
    this.mBScalingLo = mBScalingLo;
  }
  
  public float getmBRangeHi() {
    return this.mBRangeHi;
  }
  
  public void setmBRangeHi(float mBRangeHi) {
    this.mBRangeHi = mBRangeHi;
  }
  
  public float getmBRangeLo() {
    return this.mBRangeLo;
  }
  
  public void setmBRangeLo(float mBRangeLo) {
    this.mBRangeLo = mBRangeLo;
  }
  
  public float getErrorValue() {
    return this.errorValue;
  }
  
  public void setErrorValue(float errorValue) {
    this.errorValue = errorValue;
  }
  
  public byte[] getVirtualCalcFormula() {
    return this.virtualCalcFormula;
  }
  
  public void setVirtualCalcFormula(byte[] virtualCalcFormula) {
    this.virtualCalcFormula = virtualCalcFormula;
  }
  
  public float getVirtualConstantValueA() {
    return this.virtualConstantValueA;
  }
  
  public void setVirtualConstantValueA(float virtualConstantValueA) {
    this.virtualConstantValueA = virtualConstantValueA;
  }
  
  public float getVirtualConstantValueB() {
    return this.virtualConstantValueB;
  }
  
  public void setVirtualConstantValueB(float virtualConstantValueB) {
    this.virtualConstantValueB = virtualConstantValueB;
  }
  
  public float getVirtualConstantValueC() {
    return this.virtualConstantValueC;
  }
  
  public void setVirtualConstantValueC(float virtualConstantValueC) {
    this.virtualConstantValueC = virtualConstantValueC;
  }
  
  public float getVirtualConstantValueD() {
    return this.virtualConstantValueD;
  }
  
  public void setVirtualConstantValueD(float virtualConstantValueD) {
    this.virtualConstantValueD = virtualConstantValueD;
  }
  
  public byte getChOptionalConfig() {
    return this.chOptionalConfig;
  }
  
  public void setChOptionalConfig(byte chOptionalConfig) {
    this.chOptionalConfig = chOptionalConfig;
  }
  
  public byte[] getReserved() {
    return this.reserved;
  }
  
  public void setReserved(byte[] reserved) {
    this.reserved = reserved;
  }
}
package com.cs.communication.util;

import com.cs.communication.exception.CommException;
import com.cs.communication.exception.shared.ExceptionCodeImpl;

public class ModbusUtil {
  public static void handleExCode(byte code) {
    switch (code) {
      case 1:
        throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_ILLEGAL_FUNCTION);
      case 2:
        throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_ILLEGAL_DATA_ADDRESS);
      case 3:
        throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_ILLEGAL_DATA_VALUE);
      case 4:
        throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_SLAVE_DEVICE_FAILURE);
      case 5:
        throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_ACKNOWLEDGE);
      case 6:
        throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_SLAVE_DEVICE_BUSY);
      case 7:
        throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_NEGATIVE_ACKNOWLEDGE);
      case 8:
        throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_MEMORY_PARITY_ERROR);
      case 10:
        throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_GATEWAY_PATH_UNAVAILABLE);
      case 11:
        throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_GATEWAY_TARGET_DEVICE_FAILED_TO_RESPOND);
    } 
    throw new CommException(ExceptionCodeImpl.EC_MODBUS_PROTOCOL_UNKNOW_MODBUS_EX_CODE);
  }
}
package com.cs.communication.adapter;

import com.cs.communication.ProtocolAdapter;

public class CommunicationModbusAdapter extends CommunicationAdapter {
  public CommunicationModbusAdapter(ProtocolAdapter protocolAdapter) {
    super(protocolAdapter);
  }
  
  public int getMaxBytesExpected() {
    return 32768;
  }
}
public class CSBusGetDevInfo extends Action {
  public String getName() {
    return "csbusGetDeviceInfo";
  }
}
package com.cs.communication.adapter;

import com.cs.communication.ProtocolAdapter;
import com.cs.communication.driver.DriverManager;
import java.util.List;

public class CommunicationEthernetRS485ModbusAdapter extends CommunicationAdapter {
  public CommunicationEthernetRS485ModbusAdapter(ProtocolAdapter protocolAdapter) {
    super(protocolAdapter);
  }
  
  protected List<String> getConnectionSources() {
    return DriverManager.refreshEthernetDhcp(new byte[] { 40 });
  }
  
  public int getMaxBytesExpected() {
    return 2048;
  }
}


public final class CSBusCommands {
  public static final int EXPECTED_RESPONSE_DATA_LENGTH_BASE = 4;
  
  public static final int EXPECTED_RESPONSE_DATA_LENGTH_GET_DEVICE = 8;
  
  public static final int EXPECTED_RESPONSE_DATA_LENGTH_GET_DEVICE_TIME = 8;
  
  public static final int EXPECTED_RESPONSE_DATA_LENGTH_GET_DEVICE_INFO = 8;
  
  public static final int EXPECTED_RESPONSE_DATA_LENGTH_LOGGER_STATUS = 10;
  
  public static final byte LOGGER_START_CONTROL_IMMEDIATELY = 1;
  
  public static final byte LOGGER_START_CONTROL_ALARM_TIME = 2;
  
  public static final byte LOGGER_STOP_TASK_ID_NULL = 0;
  
  public static final byte LOGGER_STOP_REASON_CMD = 8;
  
  public static final int LOGGER_SETTING_SIZE = 307;
  
  public static final int LEN_LOG_DESP = 128;
  
  public static final int MAX_CHANNEL = 100;
  
  public static final int FINAL_MAX_CHANNEL = 254;
  
  public static final byte LOG_CONTROL_LOG_SETTINGS_ALL = 0;
  
  public static final byte LOG_CONTROL_LOG_SETTINGS_DESP = 1;
  
  public static final byte LOG_CONTROL_LOG_SETTINGS_NUM_CH = 2;
  
  public static final byte LOG_CONTROL_LOG_SETTINGS_RATE = 3;
  
  public static final byte LOG_CONTROL_LOG_SETTINGS_MODE = 4;
  
  public static final byte LOG_CONTROL_LOG_SETTINGS_ALARM_TIME = 5;
  
  public static final byte LOG_CONTROL_LOG_SETTINGS_CH_ARRAY = 6;
  
  public static final int LOG_CONTROL_LOG_SETTINGS_MODE_STOP = 0;
  
  public static final int LOG_CONTROL_LOG_SETTINGS_MODE_CYCLE = 1;
  
  public static final int LOG_CONTROL_LOG_SETTINGS_MODE_AVERAGE = 2;
  
  public static final int LOGGER_FILE_INFO_SIZE = 161;
  
  public static final int LOGGER_FILE_NAME_BYTE_SIZE = 12;
  
  public static final int LOGGER_FILE_DESCRIPTION_BYTE_SIZE = 128;
  
  public static final int LOGGER_RUNNING_INFO_SIZE = 40;
  
  public static final int CHANNEL_STRUCT_BYTE_SIZE = 204;
  
  public static final int MEASUREMENT_VALUE_LENGTH = 7;
  
  public static final int LOGGER_ACCESS_CODE_LENGTH = 2;
  
  public static final int IMG_FILE_NAME_BYTE_SIZE = 55;
  
  public static final int IMG_FILE_INFO_LENGTH = 59;
  
  private static final String COMMAND_RETRIEVE_DEVICE_INFORMATION = "A";
  
  private static final byte COMMAND_CTY_MEASUREMENT_HEADER = 4;
  
  private static final byte COMMAND_CTY_MEASUREMENT_SUB_HEADER_SCTY_COMMON = 1;
  
  private static final byte COMMAND_CTY_MEASUREMENT_ACT_GET_MEASUREMENT_VALUE = 1;
  
  private static final byte COMMAND_CTY_MEASUREMENT_SUB_HEADER_SCTY_DS310_PRIVATE = 2;
  
  private static final byte COMMAND_CTY_MEASUREMENT_ACT_GET_MEASUREMENT_CH_SETTING = 2;
  
  private static final byte COMMAND_CTY_MEASUREMENT_ACT_GET_MEASUREMENT_CH_SETTING_TRED = 11;
  
  private static final byte COMMAND_CTY_SYS_INFO = 1;
  
  private static final byte COMMAND_CTY_SYS_INFO_SUB_NONE = -1;
  
  private static final byte COMMAND_SUB_NONE = -1;
  
  private static final byte COMMAND_CTY_SYS_INFO_ACT_GET_TIME = 1;
  
  private static final byte COMMAND_CTY_SYS_INFO_ACT_SET_TIME = 2;
  
  private static final byte COMMAND_CTY_SYS_INFO_ACT_GET_DEVICE_APP_ID = 27;
  
  private static final byte COMMAND_CTY_SYS_INFO_ACT_GET_DEVICE_INFO = 28;
  
  private static final byte COMMAND_CTY_SYS_INFO_ACT_GET_MAX_CHANNELS = 35;
  
  private static final byte COMMAND_CTY_LOGGER_HEADER = 3;
  
  private static final byte COMMAND_CTY_LOGGER_SUB_HEADER = -1;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_GET_LOGGER_STATUS = 1;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_START_LOGGING = 2;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_STOP_LOGGING = 3;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_REQUEST_ACCESS_CODE = 4;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_SAVE_ACCESS_RIGHT = 5;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_RELEASE_ACCESS_RIGHT = 6;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_GET_FILE_LIST = 7;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_OPEN_FILE = 8;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_SET_READING_TIME = 9;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_READ_FILE = 11;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_READING_FINISHED = 12;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_GET_LOGGER_SETTING = 13;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_SET_LOGGER_SETTING = 14;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_DEL_FILE = 15;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_GET_RUNNING_INFO = 17;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_GET_FILE_NUMBER = 18;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_GET_RUNNING_MIN_MAX = 19;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_SYNCHRONIZE_RUNNING_FILE = 23;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_PC_GET_ACCESS_CODE = 25;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_PC_SAVE_ACCESS_CODE = 26;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_PC_RELEASE_ACCESS_CODE = 27;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_KICK_ACCESS_CODE = 28;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_FORCE_CLEAR_ACCESS_CODE = 29;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_SET_LOGGER_SETTING_NEW = 30;
  
  private static final byte COMMAND_CTY_LOGGER_ACT_GET_LOGGER_SETTING_NEW = 31;
  
  private static final byte COMMAND_CTY_DEVICE_RELATED_HEADER = 9;
  
  private static final byte COMMAND_CTY_DEVICE_RELATED_SCTY_COLOR_DISPLAY_PRIVATE = 8;
  
  private static final byte COMMAND_CTY_DEVICE_RELATED_ACT_SAVE_CONFIGURE = 6;
  
  private static final byte COMMAND_CTY_DEVICE_RELATED_ACT_GET_IMG_FILE_COUNT = 13;
  
  private static final byte COMMAND_CTY_DEVICE_RELATED_ACT_GET_IMG_FILE_INFO = 14;
  
  private static final byte COMMAND_CTY_DEVICE_RELATED_ACT_READ_IMG_FILE = 15;
  
  public static final Command RETRIEVE_DEVICE_INFORMATION = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        return "A".getBytes();
      }
    };
  
  public static final Command GET_DEVICE_INFO = new Command() {
      byte[] result = new byte[3];
      
      public byte[] getBytes(Map<String, Object> parameters) {
        this.result[0] = 1;
        this.result[1] = -1;
        this.result[2] = 28;
        return this.result;
      }
    };
  
  public static final Command GET_DEVICE_APP_ID = new Command() {
      byte[] result = new byte[3];
      
      public byte[] getBytes(Map<String, Object> parameters) {
        this.result[0] = 1;
        this.result[1] = -1;
        this.result[2] = 27;
        return this.result;
      }
    };
  
  public static final Command SET_DEVICE_ADDRESS = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        return null;
      }
    };
  
  public static final Command GET_LOGGER_STATUS = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] result = new byte[3];
        try {
          result[0] = 3;
          result[1] = -1;
          result[2] = 1;
        } catch (Exception e) {
          return null;
        } 
        return result;
      }
    };
  
  public static final Command GET_LOGGER_FILE_LIST = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] result = new byte[8];
        try {
          short length = ((Short)parameters.get("length")).shortValue();
          byte[] lengthBytes = DataTypeConverter.shortToByteArray(length);
          byte control = ((Byte)parameters.get("control")).byteValue();
          byte[] accessCode = DataTypeConverter.shortToByteArray(((Short)parameters.get("access_code")).shortValue());
          result[0] = 3;
          result[1] = -1;
          result[2] = 7;
          result[3] = lengthBytes[0];
          result[4] = lengthBytes[1];
          result[5] = control;
          result[6] = accessCode[0];
          result[7] = accessCode[1];
        } catch (Exception e) {
          return null;
        } 
        return result;
      }
    };
  
  public static final Command RELEASE_LOGGER_ACCESS_RIGHT = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] result = new byte[9];
        try {
          byte[] macAddress = (byte[])parameters.get("mac_address");
          result[0] = 3;
          result[1] = -1;
          result[2] = 27;
          System.arraycopy(macAddress, 0, result, 3, 6);
        } catch (Exception ex) {
          return null;
        } 
        return result;
      }
    };
  
  public static final Command REQUEST_LOGGER_ACCESS_RIGHT = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] result = new byte[9];
        byte[] macAddress = (byte[])parameters.get("mac_address");
        try {
          result[0] = 3;
          result[1] = -1;
          result[2] = 25;
          System.arraycopy(macAddress, 0, result, 3, 6);
        } catch (Exception e) {
          return null;
        } 
        return result;
      }
    };
  
  public static final Command GET_LOGGER_FILE_COUNT = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[3];
        try {
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 18;
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command CLOSE_LOGGER_FILE = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[5];
        try {
          short accesscodeShort = ((Short)parameters.get("access_code")).shortValue();
          byte[] accessCode = DataTypeConverter.shortToByteArray(accesscodeShort);
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 12;
          commandPack[3] = accessCode[0];
          commandPack[4] = accessCode[1];
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command DELETE_LOGGER_FILE = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        int loggerFileNameLen = 12;
        int commandPackLenInt = loggerFileNameLen + 5;
        byte[] commandPack = new byte[commandPackLenInt];
        try {
          short accessCodeShort = ((Short)parameters.get("access_code")).shortValue();
          byte[] accessCode = DataTypeConverter.shortToByteArray(accessCodeShort);
          byte[] fileNameBytes = (byte[])parameters.get("file_name");
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 15;
          System.arraycopy(fileNameBytes, 0, commandPack, 3, loggerFileNameLen);
          commandPack[commandPackLenInt - 2] = accessCode[0];
          commandPack[commandPackLenInt - 1] = accessCode[1];
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static Command KICK_ACCESS_CODE = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] macAddress = (byte[])parameters.get("mac_address");
        byte[] commandPack = new byte[9];
        commandPack[0] = 3;
        commandPack[1] = -1;
        commandPack[2] = 28;
        System.arraycopy(macAddress, 0, commandPack, 3, 6);
        return commandPack;
      }
    };
  
  public static Command FORCE_CLEAR_ACCESS_CODE = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[3];
        commandPack[0] = 3;
        commandPack[1] = -1;
        commandPack[2] = 29;
        return commandPack;
      }
    };
  
  public static final Command OPEN_LOGGER_FILE = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        int loggerFileNameLenInt = 12;
        int commandPackLenInt = loggerFileNameLenInt + 6;
        byte[] commandPack = new byte[commandPackLenInt];
        try {
          short accessCodeShort = ((Short)parameters.get("access_code")).shortValue();
          byte[] accessCode = DataTypeConverter.shortToByteArray(accessCodeShort);
          byte[] fileNameBytes = (byte[])parameters.get("file_name");
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 8;
          System.arraycopy(fileNameBytes, 0, commandPack, 3, loggerFileNameLenInt);
          commandPack[15] = ((Byte)parameters.get("interval")).byteValue();
          commandPack[16] = accessCode[0];
          commandPack[17] = accessCode[1];
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command SET_LOGGER_START_READING_TIME = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[13];
        try {
          short accessCodeShort = ((Short)parameters.get("access_code")).shortValue();
          byte[] accessCode = DataTypeConverter.shortToByteArray(accessCodeShort);
          byte[] timeBytes = (byte[])parameters.get("start_reading_time");
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 9;
          System.arraycopy(timeBytes, 0, commandPack, 3, 8);
          commandPack[11] = accessCode[0];
          commandPack[12] = accessCode[1];
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command SAVE_LOGGER_ACCESS_RIGHT = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[9];
        try {
          byte[] macAddress = (byte[])parameters.get("mac_address");
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 26;
          System.arraycopy(macAddress, 0, commandPack, 3, 6);
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command SAVE_CONFIG = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[7];
        try {
          commandPack[0] = 9;
          commandPack[1] = 8;
          commandPack[2] = 6;
          commandPack[3] = 1;
          commandPack[4] = 0;
          commandPack[5] = 0;
          commandPack[6] = 0;
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command GET_IMG_FILE_COUNT = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[3];
        try {
          commandPack[0] = 9;
          commandPack[1] = 8;
          commandPack[2] = 13;
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command GET_IMG_FILE_INFO = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        int index = ((Integer)parameters.get("file_index")).intValue();
        int no = ((Integer)parameters.get("file_no")).intValue();
        byte[] indexB = DataTypeConverter.intToByteArray(index);
        byte[] noB = DataTypeConverter.intToByteArray(no);
        byte[] commandPack = new byte[11];
        try {
          commandPack[0] = 9;
          commandPack[1] = 8;
          commandPack[2] = 14;
          System.arraycopy(indexB, 0, commandPack, 3, 4);
          System.arraycopy(noB, 0, commandPack, 7, 4);
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command GET_IMG_FILE = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        int offset = 0;
        int size = ((Integer)parameters.get("file_size")).intValue();
        byte[] name = (byte[])parameters.get("file_name");
        byte[] offsetB = DataTypeConverter.intToByteArray(offset);
        byte[] sizeB = DataTypeConverter.intToByteArray(size);
        byte[] commandPack = new byte[66];
        try {
          commandPack[0] = 9;
          commandPack[1] = 8;
          commandPack[2] = 15;
          System.arraycopy(offsetB, 0, commandPack, 3, 4);
          System.arraycopy(sizeB, 0, commandPack, 7, 4);
          System.arraycopy(name, 0, commandPack, 11, 55);
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command GET_CHANNEL_STRUCT = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        int startChannelNumber = ((Integer)parameters.get("startChannelNo")).intValue();
        int numberOfChannel = ((Integer)parameters.get("numberOfChannels")).intValue();
        byte[] commandPack = new byte[5];
        try {
          commandPack[0] = 4;
          commandPack[1] = 2;
          commandPack[2] = 2;
          commandPack[3] = (byte)startChannelNumber;
          commandPack[4] = (byte)numberOfChannel;
        } catch (Exception e) {
          e.printStackTrace();
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command GET_CHANNEL_STRUCT_TRED = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        int startChannelNumber = ((Integer)parameters.get("startChannelNo")).intValue();
        int numberOfChannel = ((Integer)parameters.get("numberOfChannels")).intValue();
        byte[] commandPack = new byte[5];
        try {
          commandPack[0] = 4;
          commandPack[1] = 2;
          commandPack[2] = 11;
          commandPack[3] = (byte)startChannelNumber;
          commandPack[4] = (byte)numberOfChannel;
        } catch (Exception e) {
          e.printStackTrace();
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command GET_MAX_CHANNEL_COUNT = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[3];
        try {
          commandPack[0] = 1;
          commandPack[1] = -1;
          commandPack[2] = 35;
        } catch (Exception e) {
          e.printStackTrace();
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command GET_MEASUREMENT_CHANNEL_COUNT = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[3];
        try {
          commandPack[0] = 4;
          commandPack[1] = 2;
          commandPack[2] = 3;
        } catch (Exception e) {
          e.printStackTrace();
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command GET_LOGGER_RUNNING_INFO = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        int commandPackLenInt = 3;
        byte[] commandPack = new byte[commandPackLenInt];
        try {
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 17;
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command LOGGER_SYNCHRONIZE_RUNNING_FILE = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        short accessCodeShort = ((Short)parameters.get("accessCode")).shortValue();
        byte[] accessCode = DataTypeConverter.shortToByteArray(accessCodeShort);
        int commandPackLenInt = 5;
        byte[] commandPack = new byte[commandPackLenInt];
        try {
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 23;
          commandPack[3] = accessCode[0];
          commandPack[4] = accessCode[1];
        } catch (Exception e) {
          e.printStackTrace();
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command GET_DEVICE_TIME = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[3];
        try {
          commandPack[0] = 1;
          commandPack[1] = -1;
          commandPack[2] = 1;
        } catch (Exception e) {
          e.printStackTrace();
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command STOP_LOGGER = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[7];
        try {
          byte taskIDByte = ((Byte)parameters.get("taskID")).byteValue();
          byte reasonByte = ((Byte)parameters.get("reason")).byteValue();
          short accessCodeShort = ((Short)parameters.get("access_code")).shortValue();
          byte[] accessCodeBytes = DataTypeConverter.shortToByteArray(accessCodeShort);
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 3;
          commandPack[3] = taskIDByte;
          commandPack[4] = reasonByte;
          commandPack[5] = accessCodeBytes[0];
          commandPack[6] = accessCodeBytes[1];
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command START_LOGGER = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[6];
        try {
          byte control = ((Byte)parameters.get("control")).byteValue();
          short accessCodeShort = ((Short)parameters.get("access_code")).shortValue();
          byte[] accessCodeBytes = DataTypeConverter.shortToByteArray(accessCodeShort);
          if (control < 0)
            return null; 
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 2;
          commandPack[3] = control;
          commandPack[4] = accessCodeBytes[0];
          commandPack[5] = accessCodeBytes[1];
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command SET_DEVICE_TIME = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[11];
        try {
          byte[] time = (byte[])parameters.get("time");
          commandPack[0] = 1;
          commandPack[1] = -1;
          commandPack[2] = 2;
          System.arraycopy(time, 0, commandPack, 3, 8);
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command SET_LOGGER_SETTING = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte control = ((Byte)parameters.get("control")).byteValue();
        Object obj = parameters.get("more_than_100");
        int maxChDevice = 0;
        if (obj != null)
          maxChDevice = ((Integer)obj).intValue(); 
        CSCommLoggerSetting loggerSettings = (CSCommLoggerSetting)parameters.get("logger_setting_struct");
        byte[] accessCode = DataTypeConverter.shortToByteArray(((Short)parameters.get("access_code")).shortValue());
        int lenAccessCodeInt = accessCode.length;
        if (lenAccessCodeInt != 2)
          return null; 
        int indexCopyStart = 0;
        int lenCopy = 0;
        if (control == 0) {
          lenCopy = loggerSettings.getSize();
        } else if (control == 1) {
          indexCopyStart = 0;
          lenCopy = 128;
        } else if (control == 2) {
          indexCopyStart = 128;
          lenCopy = 1;
        } else if (control == 3) {
          indexCopyStart = 129;
          lenCopy = 4;
        } else if (control == 4) {
          indexCopyStart = 133;
          lenCopy = 2;
        } else if (control == 5) {
          indexCopyStart = 135;
          lenCopy = 8;
        } else if (control == 6) {
          indexCopyStart = 143;
          if (maxChDevice == 1) {
            lenCopy = 254;
          } else {
            lenCopy = 100;
          } 
        } 
        int commandPackLenInt = lenCopy + 6;
        byte[] commandPack = new byte[commandPackLenInt];
        byte[] settingBytes = loggerSettings.buildByteArray();
        try {
          commandPack[0] = 3;
          commandPack[1] = -1;
          if (maxChDevice == 1 && (control == 6 || control == 2)) {
            commandPack[2] = 30;
          } else {
            commandPack[2] = 14;
          } 
          commandPack[3] = control;
          System.arraycopy(settingBytes, indexCopyStart, commandPack, 4, lenCopy);
          commandPack[commandPackLenInt - 2] = accessCode[0];
          commandPack[commandPackLenInt - 1] = accessCode[1];
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command GET_LOGGER_SETTING = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte control = ((Byte)parameters.get("control")).byteValue();
        byte[] accessCode = DataTypeConverter.shortToByteArray(((Short)parameters.get("access_code")).shortValue());
        int lenAccessCodeInt = accessCode.length;
        if (lenAccessCodeInt != 2)
          return null; 
        int commandPackLenInt = 6;
        byte[] commandPack = new byte[commandPackLenInt];
        try {
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 13;
          commandPack[3] = control;
          commandPack[commandPackLenInt - 2] = accessCode[0];
          commandPack[commandPackLenInt - 1] = accessCode[1];
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command GET_LOGGER_SETTING_NEW = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte control = ((Byte)parameters.get("control")).byteValue();
        byte[] accessCode = DataTypeConverter.shortToByteArray(((Short)parameters.get("access_code")).shortValue());
        int lenAccessCodeInt = accessCode.length;
        if (lenAccessCodeInt != 2)
          return null; 
        int commandPackLenInt = 6;
        byte[] commandPack = new byte[commandPackLenInt];
        try {
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 31;
          commandPack[3] = control;
          commandPack[commandPackLenInt - 2] = accessCode[0];
          commandPack[commandPackLenInt - 1] = accessCode[1];
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command GET_ONLINE_MEASUREMENT_VALUE = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        int startChannelNumber = ((Integer)parameters.get("startChannelNumber")).intValue();
        int numberOfChannel = ((Integer)parameters.get("numberOfChannel")).intValue();
        byte[] commandPack = new byte[5];
        try {
          commandPack[0] = 4;
          commandPack[1] = 1;
          commandPack[2] = 1;
          commandPack[3] = (byte)startChannelNumber;
          commandPack[4] = (byte)numberOfChannel;
        } catch (Exception e) {
          System.out.println("commandGetOnlineMeasurementValue exception :" + e.getMessage());
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command GET_RUNNING_CHANNEL_MINMAX_VALUE = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        byte[] commandPack = new byte[3];
        try {
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 19;
        } catch (Exception e) {
          return null;
        } 
        return commandPack;
      }
    };
  
  public static final Command READ_LOGGER_FILE = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        try {
          short access_Code = ((Short)parameters.get("access_code")).shortValue();
          int lengthInt = ((Integer)parameters.get("data_length")).intValue();
          byte[] length = DataTypeConverter.intToByteArray(lengthInt);
          byte[] accessCode = DataTypeConverter.shortToByteArray(access_Code);
          int commandPackLenInt = 9;
          byte[] commandPack = new byte[commandPackLenInt];
          commandPack[0] = 3;
          commandPack[1] = -1;
          commandPack[2] = 11;
          System.arraycopy(length, 0, commandPack, 3, 4);
          commandPack[commandPackLenInt - 2] = accessCode[0];
          commandPack[commandPackLenInt - 1] = accessCode[1];
          return commandPack;
        } catch (Exception e) {
          return null;
        } 
      }
    };
  
  public static final Command ENTER_REMOTE_MODE = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        int commandPackLenInt = 3;
        byte[] commandPack = new byte[commandPackLenInt];
        commandPack[0] = 9;
        commandPack[1] = 1;
        commandPack[2] = 3;
        return commandPack;
      }
    };
  
  public static final Command EXIT_REMOTE_MODE = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        int commandPackLenInt = 3;
        byte[] commandPack = new byte[commandPackLenInt];
        commandPack[0] = 9;
        commandPack[1] = 1;
        commandPack[2] = 6;
        return commandPack;
      }
    };
  
  public static final Command ALARM_ON = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        int commandPackLenInt = 5;
        byte[] commandPack = new byte[commandPackLenInt];
        commandPack[0] = 6;
        commandPack[1] = 1;
        commandPack[2] = 1;
        commandPack[3] = ((Byte)parameters.get("alarmIndex")).byteValue();
        commandPack[4] = ((Byte)parameters.get("lcd_action")).byteValue();
        return commandPack;
      }
    };
  
  public static final Command ALARM_OFF = new Command() {
      public byte[] getBytes(Map<String, Object> parameters) {
        int commandPackLenInt = 4;
        byte[] commandPack = new byte[commandPackLenInt];
        commandPack[0] = 6;
        commandPack[1] = 1;
        commandPack[2] = 2;
        commandPack[3] = ((Byte)parameters.get("alarmIndex")).byteValue();
        return commandPack;
      }


public class GetAllChannelStructActionExecutor implements ActionExecutor {
  private static final int BATCHES_SIZE = 5;
  
  public Response execute(Action action, Device device, ProtocolAdapter protocol, int maxBytesExpected) throws CommException {
    int maxCount = 100;
    Action miniAction0 = CSBusActionFactory.createAction("GetMaxChannelCountAction");
    try {
      Response response0 = device.executeAction(miniAction0);
      if (response0.getValue() != null) {
        int tmpMaxCount = ((Integer)response0.getValue()).intValue();
        if (tmpMaxCount > 0)
          maxCount = tmpMaxCount; 
      } 
    } catch (Exception exception) {}
    List<CSCommChannelSetting> value = new ArrayList<>();
    int i;
    for (i = 1; i <= maxCount; i += 5) {
      Action miniAction = null;
      if (device.getIdentification() == 4196 || device.getIdentification() == 4197 || device.getIdentification() == 4198 || device.getIdentification() == 4199 || device.getIdentification() == 4200) {
        double fwVer = Double.parseDouble(device.getFirmwareVersion());
        if (MathUtil.isSame(fwVer, 1.31D) || fwVer > 1.31D) {
          miniAction = CSBusActionFactory.createAction("GetChannelStructTredByBatchesAction");
        } else {
          miniAction = CSBusActionFactory.createAction("GetChannelStructByBatchesAction");
        } 
      } else {
        miniAction = CSBusActionFactory.createAction("GetChannelStructByBatchesAction");
      } 
      miniAction.setParameter("startChannelNo", Integer.valueOf(i));
      if (i + 5 > maxCount) {
        miniAction.setParameter("numberOfChannels", Integer.valueOf(maxCount - i + 1));
      } else {
        miniAction.setParameter("numberOfChannels", Integer.valueOf(5));
      } 
      Response response = device.executeAction(miniAction);
      List<CSCommChannelSetting> list = (List<CSCommChannelSetting>)response.getValue();
      if (device.getIdentification() == 4224 || device.getIdentification() == 4226) {
        for (CSCommChannelSetting set : list) {
          if (set.getLogicalChannelNo() >= 33 && set.getLogicalChannelNo() <= 42)
            value.add(set); 
        } 
      } else {
        value.addAll(list);
      } 
    } 
    CSBusGetChannelStructResponse listResponse = new CSBusGetChannelStructResponse();
    listResponse.setValue(value);
    return (Response)listResponse;
  }


public class CSBusGetMeasurementChannelCountResponse extends CSBusResponse implements Response {
  private int value = 0;
  
  public void parseResponse(ProtocolAdapter protocol, Action action, byte[] response) throws CommException {
    ResponseParameters param = protocol.getResponseParameters(action);
    parsePacket(response, param.getDataLengthExpected(), param.getFramesExpected());
    this.value = DataTypeConverter.byteToInt(response[0]);
  }
  
  public Object getValue() {
    return Integer.valueOf(this.value);
  }

public class CSBusGetChannelStructByBatchesActionAdapter implements ActionAdapter {
  private final ActionExecutor executor = (ActionExecutor)new BaseActionExecutor();
  
  public Response getResponse(ProtocolAdapter protocol, Action action, byte[] response) {
    CSBusGetChannelStructResponse cSBusGetChannelStructResponse = new CSBusGetChannelStructResponse();
    cSBusGetChannelStructResponse.parseResponse(protocol, action, response);
    return (Response)cSBusGetChannelStructResponse;
  }
  
  public Command getCommand() {
    return CSBusCommands.GET_CHANNEL_STRUCT;
  }
  
  public ActionExecutor getExecutor() {
    return this.executor;
  }
  
  public ResponseParameters getResponseParameters(Action action) {
    Map<String, Object> actionParameters = action.getParameters();
    Object value = actionParameters.get("numberOfChannels");
    int num = Integer.parseInt(value.toString());
    int length = (value == null) ? 0 : (204 * num);
    return (ResponseParameters)new CSBusResponseParameters(length);
  }

public class CSBusGetChannelStructTredByBatchesActionAdapter implements ActionAdapter {
  private final ActionExecutor executor = (ActionExecutor)new BaseActionExecutor();
  
  public Response getResponse(ProtocolAdapter protocol, Action action, byte[] response) {
    CSBusGetChannelStructResponse cSBusGetChannelStructResponse = new CSBusGetChannelStructResponse();
    cSBusGetChannelStructResponse.parseResponse(protocol, action, response);
    return (Response)cSBusGetChannelStructResponse;
  }
  
  public Command getCommand() {
    return CSBusCommands.GET_CHANNEL_STRUCT_TRED;
  }
  
  public ActionExecutor getExecutor() {
    return this.executor;
  }
  
  public ResponseParameters getResponseParameters(Action action) {
    Map<String, Object> actionParameters = action.getParameters();
    Object value = actionParameters.get("numberOfChannels");
    int num = Integer.parseInt(value.toString());
    int length = (value == null) ? 0 : (204 * num);
    return (ResponseParameters)new CSBusResponseParameters(length);
  }

public class CSBusGetDeviceResponse extends CSBusResponse implements Response {
  private Device value = null;
  
  public void parseResponse(ProtocolAdapter protocol, Action action, byte[] response) throws CommException {
    byte address = response[0];
    ResponseParameters param = protocol.getResponseParameters(action);
    parsePacket(response, param.getDataLengthExpected(), param.getFramesExpected());
    CSCommDeviceID deviceID = new CSCommDeviceID();
    deviceID.parseByteArray(response);
    this.value = new Device(address, deviceID.getDeviceSerialNumber(), deviceID.getDeviceIdentification());
    this.value.setCsbusVersion(deviceID.getBusVersion());
    int num = deviceID.getSoftwareVersion();
    num = (num < 0) ? (num + 256) : num;
    BigDecimal bd = new BigDecimal(((num / 10 * 10 + num % 10) / 100.0F));
    bd = bd.setScale(2, RoundingMode.HALF_UP);
    String softwareVersion = bd.toString();
    if (softwareVersion != null) {
      this.value.setFirmwareVersion(softwareVersion.trim());
    } else {
      this.value.setFirmwareVersion("0");
    } 
  }
  