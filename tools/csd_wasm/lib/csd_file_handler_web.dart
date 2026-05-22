import 'dart:typed_data';
import 'dart:convert';
import 'dart:math' as Math;

/// Constants for special data values and file structure in CSD files
class CsdConstants {
  // Special data values
  static const double DATA_INVALID = -9999;
  static const double DATA_OVERRANGE = -8888;
  static const double DATA_SENSOR_CHANGE = -8887;
  static const double DATA_UNIT_CHANGE = -8886;

  // File structure constants
  static const int FILE_HEADER_LENGTH = 34;
  static const int PROTOCOL_HEADER_LENGTH = 3552;
  static const int CHANNEL_HEADER_LENGTH = 918;

  // Header positions
  static const int PROTOCOL_HEADER_START = FILE_HEADER_LENGTH;
  static const int CHANNEL_HEADERS_START =
      PROTOCOL_HEADER_START + PROTOCOL_HEADER_LENGTH;

  // Record structure
  static const int RECORD_ID_LENGTH = 4;
  static const int CHANNEL_VALUE_LENGTH = 8;

  static const int DATA_START_OFFSET = 3586;
  static const int CHANNEL_HEADER_SIZE = 918;
}

/// Represents the file information header of a CSD file
class CsdFileInfo {
  final int version;
  final String fileIdentifier;
  final int timestamp;
  final int dummy;
  final int recordPosition;

  CsdFileInfo({
    required this.version,
    required this.fileIdentifier,
    required this.timestamp,
    required this.dummy,
    required this.recordPosition,
  });
}

/// Represents the protocol header of a CSD file
class CsdProtocolHeader {
  final int pref;
  final int deviceId;
  final String description;
  final String testerName;
  final String companyName;
  final String companyAddress;
  final String serviceCompanyName;
  final String serviceCompanyAddress;
  final String deviceName;
  final double calibrationDate;
  final int numOfDevices;
  final int numOfChannels;
  final int numOfSamples;
  final int sampleRate;
  final int sampleRateFactor;
  final int timeOfFirstSample;
  final int stopTime;
  final int status;
  final int firmwareVersion;
  final int firstSamplePointer;
  final int crc;
  final int deviceType;
  final int origin;

  CsdProtocolHeader({
    required this.pref,
    required this.deviceId,
    required this.description,
    required this.testerName,
    required this.companyName,
    required this.companyAddress,
    required this.serviceCompanyName,
    required this.serviceCompanyAddress,
    required this.deviceName,
    required this.calibrationDate,
    required this.numOfDevices,
    required this.numOfChannels,
    required this.numOfSamples,
    required this.sampleRate,
    required this.sampleRateFactor,
    required this.timeOfFirstSample,
    required this.stopTime,
    required this.status,
    required this.firmwareVersion,
    required this.firstSamplePointer,
    required this.crc,
    required this.deviceType,
    required this.origin,
  });
}

/// Represents a channel header in a CSD file
class CsdChannelHeader {
  final int pref;
  final String channelDescription;
  final String subDeviceDescription;
  final String deviceDescription;
  final String sensorDescription;
  final int channelNumber;
  final int unit;
  final String unitText;
  final int resolution;
  final double min;
  final double max;
  final int deviceId;
  final int subDeviceId;
  final int sensorId;
  final int channelId;
  final int channelConfig;
  final int slaveAddress;
  final int deviceType;
  final List<int> deviceUniqueId;

  CsdChannelHeader({
    required this.pref,
    required this.channelDescription,
    required this.subDeviceDescription,
    required this.deviceDescription,
    required this.sensorDescription,
    required this.channelNumber,
    required this.unit,
    required this.unitText,
    required this.resolution,
    required this.min,
    required this.max,
    required this.deviceId,
    required this.subDeviceId,
    required this.sensorId,
    required this.channelId,
    required this.channelConfig,
    required this.slaveAddress,
    required this.deviceType,
    required this.deviceUniqueId,
  });
}

/// Web-compatible CSD file handler — accepts raw Uint8List (no dart:io)
class CsdFileHandlerWeb {
  Uint8List? _bytes;
  CsdFileInfo? _fileInfo;
  CsdProtocolHeader? _protocolHeader;
  List<CsdChannelHeader>? _channelHeaders;

  static const int MAX_DISPLAY_SAMPLES = 3000;

  /// Loads a CSD file from a raw byte array (provided by browser FileReader)
  void loadFromBytes(Uint8List bytes) {
    _bytes = bytes;
    _readFileInfo();
    try {
      _readProtocolHeader();
    } catch (e) {
      if (e is FormatException) {
        _protocolHeader = CsdProtocolHeader(
          pref: 0,
          deviceId: 0,
          description: '',
          testerName: '',
          companyName: '',
          companyAddress: '',
          serviceCompanyName: '',
          serviceCompanyAddress: '',
          deviceName: '',
          calibrationDate: 0,
          numOfDevices: 0,
          numOfChannels: 9,
          numOfSamples: 0,
          sampleRate: 0,
          sampleRateFactor: 0,
          timeOfFirstSample: 0,
          stopTime: 0,
          status: 0,
          firmwareVersion: 0,
          firstSamplePointer: 0,
          crc: 0,
          deviceType: 0,
          origin: 0,
        );
      } else {
        rethrow;
      }
    }

    final numChannels = _protocolHeader!.numOfChannels;
    if (numChannels > 0) {
      _readChannelHeaders();
    }
  }

  void _readFileInfo() {
    final data = ByteData.sublistView(_bytes!, 0, CsdConstants.FILE_HEADER_LENGTH);
    final buffer = _bytes!.sublist(0, CsdConstants.FILE_HEADER_LENGTH);

    _fileInfo = CsdFileInfo(
      version: data.getInt32(0, Endian.big),
      fileIdentifier: utf8.decode(buffer.sublist(4, 14)),
      timestamp: data.getInt64(14, Endian.big),
      dummy: data.getInt64(22, Endian.big),
      recordPosition: data.getInt32(30, Endian.big),
    );
  }

  void _readProtocolHeader() {
    if (_fileInfo == null) throw StateError('File info not loaded');

    final start = CsdConstants.PROTOCOL_HEADER_START;
    final end = start + CsdConstants.PROTOCOL_HEADER_LENGTH;
    final buffer = _bytes!.sublist(start, end);
    final data = ByteData.sublistView(Uint8List.fromList(buffer));

    final rawNumDevices = data.getInt32(3012, Endian.big);
    final rawNumChannels = data.getInt32(3016, Endian.big);
    final rawNumSamples = data.getInt32(3020, Endian.big);
    final rawSampleRate = data.getInt32(3024, Endian.big);
    var rawStartTime = data.getInt64(3032, Endian.big);
    var rawStopTime = data.getInt64(3040, Endian.big);

    if (rawStartTime > 8640000000000000 || rawStartTime < -8640000000000000) {
      rawStartTime = 0;
    }
    if (rawStopTime > 8640000000000000 || rawStopTime < -8640000000000000) {
      rawStopTime = 0;
    }

    _protocolHeader = CsdProtocolHeader(
      pref: data.getInt64(0, Endian.big),
      deviceId: data.getInt32(8, Endian.big),
      description: _safeUtf8Decode(buffer.sublist(14, 142)),
      testerName: _safeUtf8Decode(buffer.sublist(144, 176)),
      companyName: _safeUtf8Decode(buffer.sublist(178, 210)),
      companyAddress: _safeUtf8Decode(buffer.sublist(212, 340)),
      serviceCompanyName: _safeUtf8Decode(buffer.sublist(342, 374)),
      serviceCompanyAddress: _safeUtf8Decode(buffer.sublist(376, 504)),
      deviceName: _safeUtf8Decode(buffer.sublist(506, 538)),
      calibrationDate: data.getFloat64(538, Endian.big),
      numOfDevices: rawNumDevices,
      numOfChannels: rawNumChannels > 0 ? rawNumChannels : 9,
      numOfSamples: rawNumSamples > 0 ? rawNumSamples : 0,
      sampleRate: rawSampleRate,
      sampleRateFactor: data.getInt32(3028, Endian.big),
      timeOfFirstSample: rawStartTime,
      stopTime: rawStopTime,
      status: data.getInt32(3048, Endian.big),
      firmwareVersion: data.getInt16(3052, Endian.big),
      firstSamplePointer: data.getInt32(3054, Endian.big),
      crc: data.getInt16(3058, Endian.big),
      deviceType: data.getInt16(3060, Endian.big),
      origin: buffer[3062],
    );
  }

  void _readChannelHeaders() {
    if (_protocolHeader == null) {
      _channelHeaders = [];
      return;
    }

    final numChannels = _protocolHeader!.numOfChannels;
    if (numChannels <= 0) {
      _channelHeaders = [];
      return;
    }

    _channelHeaders = [];
    int pos = CsdConstants.CHANNEL_HEADERS_START;

    for (int i = 0; i < numChannels; i++) {
      try {
        if (pos + CsdConstants.CHANNEL_HEADER_LENGTH > _bytes!.length) break;

        final buffer = Uint8List.fromList(
            _bytes!.sublist(pos, pos + CsdConstants.CHANNEL_HEADER_LENGTH));
        final data = ByteData.sublistView(buffer);

        int fieldPos = 8; // Start after pref (8 bytes)

        int channelDescLen = data.getInt16(fieldPos, Endian.big);
        fieldPos += 2;
        String channelDesc = _safeUtf8Decode(
            buffer.sublist(fieldPos, fieldPos + channelDescLen),
            defaultValue: 'Channel $i');
        fieldPos += 128;

        int subDeviceDescLen = data.getInt16(fieldPos, Endian.big);
        fieldPos += 2;
        String subDeviceDesc = _safeUtf8Decode(
            buffer.sublist(fieldPos, fieldPos + subDeviceDescLen));
        fieldPos += 128;

        int deviceDescLen = data.getInt16(fieldPos, Endian.big);
        fieldPos += 2;
        String deviceDesc = _safeUtf8Decode(
            buffer.sublist(fieldPos, fieldPos + deviceDescLen));
        fieldPos += 19;

        int sensorDescLen = data.getInt16(fieldPos, Endian.big);
        fieldPos += 2;
        String sensorDesc = _safeUtf8Decode(
            buffer.sublist(fieldPos, fieldPos + sensorDescLen));
        fieldPos += 19;

        fieldPos += 470; // Skip reserved bytes

        int channelNumber = data.getInt32(fieldPos, Endian.big);
        fieldPos += 4;

        int unit = data.getInt32(fieldPos, Endian.big);
        fieldPos += 4;

        int unitTextLen = data.getInt16(fieldPos, Endian.big);
        fieldPos += 2;
        String unitText = _safeUtf8Decode(
            buffer.sublist(fieldPos, fieldPos + unitTextLen),
            defaultValue: '');
        fieldPos += 58;

        _channelHeaders!.add(CsdChannelHeader(
          pref: data.getInt64(0, Endian.big),
          channelDescription: channelDesc,
          subDeviceDescription: subDeviceDesc,
          deviceDescription: deviceDesc,
          sensorDescription: sensorDesc,
          channelNumber: channelNumber,
          unit: unit,
          unitText: unitText,
          resolution: data.getInt32(fieldPos, Endian.big),
          min: data.getFloat64(fieldPos + 4, Endian.big),
          max: data.getFloat64(fieldPos + 12, Endian.big),
          deviceId: data.getInt32(fieldPos + 20, Endian.big),
          subDeviceId: data.getInt32(fieldPos + 24, Endian.big),
          sensorId: data.getInt32(fieldPos + 28, Endian.big),
          channelId: data.getInt32(fieldPos + 32, Endian.big),
          channelConfig: buffer[fieldPos + 36],
          slaveAddress: buffer[fieldPos + 37],
          deviceType: data.getInt16(fieldPos + 38, Endian.big),
          deviceUniqueId: buffer.sublist(fieldPos + 40, fieldPos + 48).toList(),
        ));

        pos += CsdConstants.CHANNEL_HEADER_LENGTH;
      } catch (e) {
        break;
      }
    }
  }

  // ─── Public accessors ───────────────────────────────────────────────────────

  bool get isLoaded => _bytes != null && _protocolHeader != null;

  int getNumOfChannels() => _protocolHeader?.numOfChannels ?? 0;
  int getNumOfSamples() => Math.max(0, _protocolHeader?.numOfSamples ?? 0);
  int getSampleRate() => _protocolHeader?.sampleRate ?? 1;
  int getTimeOfFirstSample() => _protocolHeader?.timeOfFirstSample ?? 0;
  int getStopTime() => _protocolHeader?.stopTime ?? 0;

  List<String> getChannelDescriptions() {
    if (_channelHeaders == null || _channelHeaders!.isEmpty) {
      return List.generate(
          _protocolHeader?.numOfChannels ?? 0, (i) => 'Channel $i');
    }
    return _channelHeaders!.map((h) => h.channelDescription).toList();
  }

  List<String> getUnitTexts() {
    if (_channelHeaders == null || _channelHeaders!.isEmpty) {
      return List.generate(_protocolHeader?.numOfChannels ?? 0, (_) => '');
    }
    return _channelHeaders!.map((h) => h.unitText).toList();
  }

  List<double> getChannelMins() {
    if (_channelHeaders == null || _channelHeaders!.isEmpty) {
      return List.generate(_protocolHeader?.numOfChannels ?? 0, (_) => 0.0);
    }
    return _channelHeaders!.map((h) => h.min).toList();
  }

  List<double> getChannelMaxs() {
    if (_channelHeaders == null || _channelHeaders!.isEmpty) {
      return List.generate(_protocolHeader?.numOfChannels ?? 0, (_) => 0.0);
    }
    return _channelHeaders!.map((h) => h.max).toList();
  }

  List<int> getResolutions() {
    if (_channelHeaders == null || _channelHeaders!.isEmpty) {
      return List.generate(_protocolHeader?.numOfChannels ?? 0, (_) => 0);
    }
    return _channelHeaders!.map((h) => h.resolution).toList();
  }

  /// Returns the pref field (int64, byte 0 of each channel header) for each channel.
  /// This is the real database-assigned channel ID stored in the CSD file.
  List<int> getChannelPrefs() {
    if (_channelHeaders == null || _channelHeaders!.isEmpty) {
      return List.generate(_protocolHeader?.numOfChannels ?? 0, (i) => i);
    }
    return _channelHeaders!.map((h) => h.pref).toList();
  }

  /// Returns the sensorId field from each channel header.
  /// Channels with the same sensorId should be grouped under one sensor in the UI.
  List<int> getChannelSensorIds() {
    if (_channelHeaders == null || _channelHeaders!.isEmpty) {
      return List.generate(_protocolHeader?.numOfChannels ?? 0, (_) => 0);
    }
    return _channelHeaders!.map((h) => h.sensorId).toList();
  }

  CsdChannelHeader? getChannelHeader(int index) {
    if (_channelHeaders == null || index >= _channelHeaders!.length) return null;
    return _channelHeaders![index];
  }

  /// Returns sample data for all channels between [startSample] and [endSample].
  /// Returns List<List<double>> — outer index is channel, inner is sample values.
  List<List<double>> getDataWithSampling(int startSample, int endSample,
      {int samplingStep = 1}) {
    if (_protocolHeader == null || _bytes == null) return [];

    final numChannels = _protocolHeader!.numOfChannels;
    final totalSamples = _protocolHeader!.numOfSamples;

    if (totalSamples <= 0 || numChannels <= 0) {
      return List.generate(numChannels, (_) => []);
    }

    startSample = startSample.clamp(0, totalSamples - 1);
    endSample = endSample.clamp(0, totalSamples - 1);
    if (endSample < startSample) return List.generate(numChannels, (_) => []);

    final step = Math.max(1, samplingStep);
    final recordLength = CsdConstants.RECORD_ID_LENGTH +
        (CsdConstants.CHANNEL_VALUE_LENGTH * numChannels);
    final dataStart = CsdConstants.CHANNEL_HEADERS_START +
        (CsdConstants.CHANNEL_HEADER_LENGTH * numChannels);

    List<List<double>> result = List.generate(numChannels, (_) => []);

    for (int sampleIndex = startSample;
        sampleIndex <= endSample;
        sampleIndex += step) {
      final byteOffset = dataStart + (sampleIndex * recordLength);
      if (byteOffset + recordLength > _bytes!.length) break;

      final data = ByteData.sublistView(
          _bytes!, byteOffset, byteOffset + recordLength);

      for (int ch = 0; ch < numChannels; ch++) {
        final valueOffset =
            CsdConstants.RECORD_ID_LENGTH + (ch * CsdConstants.CHANNEL_VALUE_LENGTH);
        final value = data.getFloat64(valueOffset, Endian.big);
        result[ch].add(value);
      }
    }

    return result;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  String _safeUtf8Decode(List<int> bytes, {String defaultValue = ''}) {
    try {
      return utf8.decode(bytes).replaceAll('\x00', '').trim();
    } catch (e) {
      try {
        return String.fromCharCodes(bytes.where((b) => b > 0 && b < 128))
            .trim();
      } catch (_) {
        return defaultValue;
      }
    }
  }
}
