import 'dart:js_interop';
import 'dart:typed_data';
import '../lib/csd_file_handler_web.dart';

/// JS-interop bridge that exposes CsdFileHandlerWeb to JavaScript.
///
/// After `dart compile wasm`, JavaScript calls these methods via the
/// Dart Wasm module exports. See s4a-web/src/api/CsdAPI.js for usage.
@JSExport()
class CsdBridge {
  final CsdFileHandlerWeb _handler = CsdFileHandlerWeb();

  /// Loads CSD data from a JS Uint8Array.
  /// Called from JS after FileReader reads the file.
  @JSExport()
  void loadFromBytes(JSUint8Array jsBytes) {
    final dartBytes = jsBytes.toDart;
    _handler.loadFromBytes(dartBytes);
  }

  /// Returns true if a CSD file has been loaded successfully.
  @JSExport()
  bool isLoaded() => _handler.isLoaded;

  /// Returns the pref (database channel ID) for each channel as a JS Array.
  /// This is the int64 at byte offset 0 of each CsdChannelHeader.
  /// Used as channel_id in the web UI — matches the real device database IDs.
  @JSExport()
  JSArray<JSNumber> getChannelPrefs() {
    return _handler
        .getChannelPrefs()
        .map((v) => v.toDouble().toJS)
        .toList()
        .toJS;
  }

  /// Returns the sensorId for each channel as a JS Array.
  /// Channels with the same sensorId are grouped under one sensor in the sidebar.
  @JSExport()
  JSArray<JSNumber> getChannelSensorIds() {
    return _handler
        .getChannelSensorIds()
        .map((v) => v.toJS)
        .toList()
        .toJS;
  }

  /// Returns total number of channels.
  @JSExport()
  int getNumOfChannels() => _handler.getNumOfChannels();

  /// Returns total number of samples.
  @JSExport()
  int getNumOfSamples() => _handler.getNumOfSamples();

  /// Returns sample rate in Hz.
  @JSExport()
  int getSampleRate() => _handler.getSampleRate();

  /// Returns start timestamp in milliseconds since epoch.
  @JSExport()
  int getTimeOfFirstSample() => _handler.getTimeOfFirstSample();

  /// Returns stop timestamp in milliseconds since epoch.
  @JSExport()
  int getStopTime() => _handler.getStopTime();

  /// Returns channel descriptions as a JS Array of strings.
  @JSExport()
  JSArray<JSString> getChannelDescriptions() {
    return _handler
        .getChannelDescriptions()
        .map((s) => s.toJS)
        .toList()
        .toJS;
  }

  /// Returns unit text strings as a JS Array.
  @JSExport()
  JSArray<JSString> getUnitTexts() {
    return _handler.getUnitTexts().map((s) => s.toJS).toList().toJS;
  }

  /// Returns min values per channel as a JS Array of numbers.
  @JSExport()
  JSArray<JSNumber> getChannelMins() {
    return _handler.getChannelMins().map((v) => v.toJS).toList().toJS;
  }

  /// Returns max values per channel as a JS Array of numbers.
  @JSExport()
  JSArray<JSNumber> getChannelMaxs() {
    return _handler.getChannelMaxs().map((v) => v.toJS).toList().toJS;
  }

  /// Returns measurement data for a specific channel in the given sample range.
  ///
  /// [channelIndex] — 0-based channel index
  /// [startSample] — first sample index (inclusive)
  /// [endSample]   — last sample index (inclusive)
  /// [samplingStep] — take every Nth sample (1 = all)
  ///
  /// Returns a flat JS Float64Array of values.
  @JSExport()
  JSFloat64Array getChannelData(
      int channelIndex, int startSample, int endSample, int samplingStep) {
    final allData = _handler.getDataWithSampling(startSample, endSample,
        samplingStep: samplingStep);

    if (channelIndex >= allData.length) {
      return Float64List(0).toJS;
    }

    final channelData = allData[channelIndex];
    return Float64List.fromList(channelData).toJS;
  }

  /// Returns measurement data for ALL channels in the given sample range.
  ///
  /// Returns a JS object: { channelIndex: Float64Array, ... }
  @JSExport()
  JSAny getAllChannelData(int startSample, int endSample, int samplingStep) {
    final allData = _handler.getDataWithSampling(startSample, endSample,
        samplingStep: samplingStep);

    final result = <String, JSAny>{};
    for (int i = 0; i < allData.length; i++) {
      result[i.toString()] = Float64List.fromList(allData[i]).toJS;
    }
    return result.jsify()!;
  }
}

/// Entry point — registers the CsdBridge on globalThis so JS can call it.
///
/// In dart:js_interop, a top-level `external set` decorated with `@JS()`
/// compiles to a direct globalThis property assignment:
///   globalThis.csdBridge = value;
/// This is the correct way to write a global — NOT via a custom "setProperty" method.
void main() {
  csdBridge = createJSInteropWrapper(CsdBridge());
}

/// Writes the bridge object to globalThis.csdBridge.
/// @JS() with no argument uses the Dart member name as the JS name.
@JS()
external set csdBridge(JSObject value);
