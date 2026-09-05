
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import "package:pointycastle/export.dart";
import 'package:convert/convert.dart';
import 'package:platform_device_id/platform_device_id.dart';


class RegistrationUtil {

  static const String LICENSER_SERVER_URL = 'http://exmm.top:8081/registration';
  static const String ENCRYPT_CUSTEM_KEY = '67a0fd39e75e37bc0743147d43b9487a';
  static const String ENCRYPT_CUSTEM_IV = 'bde7db1f5ef798da4e570d6595190ddb';

  String _detailMessage = '';
  static Uint8List decrypt(Uint8List ciphertext, Uint8List key, Uint8List iv) {
    CBCBlockCipher cipher = new CBCBlockCipher(new AESFastEngine());
    ParametersWithIV<KeyParameter> params = new ParametersWithIV<KeyParameter>(new KeyParameter(key), iv);
    PaddedBlockCipherParameters<ParametersWithIV<KeyParameter>, Null> paddingParams = new PaddedBlockCipherParameters<ParametersWithIV<KeyParameter>, Null>(params, null);
    PaddedBlockCipherImpl paddingCipher = new PaddedBlockCipherImpl(new PKCS7Padding(), cipher);
    paddingCipher.init(false, paddingParams);
    return paddingCipher.process(ciphertext);
  }

  static Future<String> generateDeviceID() async {
    String? deviceId;
    try {
      deviceId = await PlatformDeviceId.getDeviceId;
      deviceId = deviceId!.substring(4,23);
    } on PlatformException {
      deviceId = 'Failed to get deviceId.';
    }
    return deviceId.toString();
  }


  final String localid;
  final String sn;
  final String email;
  final String company;
  final String user;
  final String addr;
  final int productid;

  RegistrationUtil(this.localid,
      this.sn,
      this.email,
      this.company,
      this.user,
      this.addr,
      this.productid
      );

  String getDetailMessage(){
    return _detailMessage;
  }

  Future<bool> doRegistration() async {
    final response = await http.post(
      Uri.parse(LICENSER_SERVER_URL),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonEncode(<String, Object>{
        'localid': localid,
        'sn': sn,
        'email': email,
        'company': company,
        'user': user,
        'addr': addr,
        'productid': productid,
      }),
    );
    print('response = ${response.statusCode}');
    print('response = ${response.body}');
    if (response.statusCode == 200) {
      print('response data = ${response.body}');
      var res = jsonDecode(response.body);
      String text = res['text'];
      String finalT = decryptAES(text);
      // return (finalT);
      _detailMessage = finalT;
      return true;

    } else {
      _detailMessage = 'Status code = ${response.statusCode} ${response.body}';
      return false;
    }
  }

  void testEnDn() {

  }


  void test(){
    String ciphertextBase64 = "K76j/b9pn/Ow80heSc8Arw==";
    print(decryptAES(ciphertextBase64));
  }
  String decryptAES(String encryptTxt){
    Uint8List key = Uint8List.fromList(hex.decode(ENCRYPT_CUSTEM_KEY));
    Uint8List iv = Uint8List.fromList(hex.decode(ENCRYPT_CUSTEM_IV));
    Uint8List ciphertext = base64.decode(encryptTxt);
    Uint8List decrypted = decrypt(ciphertext, key, iv);
    return utf8.decode(decrypted);
  }




}


main() {

}
