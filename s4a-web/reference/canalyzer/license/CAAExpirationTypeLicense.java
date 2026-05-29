package com.cs.canalyzer.license;

import com.cs.canalyzer.gui.GUIConst;
import com.cs.license.ExpirationTypeLicense;
import com.cs.license.License;
import static com.cs.license.License.calculateLicenseKey;
import static com.cs.license.License.calculateLocalID;
import com.cs.license.LicenseConst;
import com.install4j.api.windows.RegistryRoot;
import com.install4j.api.windows.WinRegistry;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.util.Calendar;
import java.util.Date;
import javax.swing.JOptionPane;

/**
 *
 * @author ethan
 */
public class CAAExpirationTypeLicense extends ExpirationTypeLicense{
    public final static int CSMKEY_ONLY_USED_IN_OLD_VERSION = 15;
    public final static int CS_SOFT_UPGRADE_YEAR = 2011;
//    public static String max_version_canbeused = null;
    public CAAExpirationTypeLicense( License license ) {
        super(license);
    }
    
    public static long daysOfTwo(Date beginDate, Date endDate) {
        long margin = 0;
        margin = endDate.getTime() - beginDate.getTime();
        margin = margin / (1000 * 60 * 60 * 24);
        return margin;
    }
    public static Calendar caculateRegisterTime(String lickey){
        Calendar registerCal = Calendar.getInstance();
        String date1 = lickey.substring(2, 3);
        String date2 = lickey.substring(6, 7);
        String date3 = lickey.substring(11, 12);
        int days = Integer.parseInt(date1+date2+date3,16);
        registerCal.add(Calendar.DAY_OF_MONTH, (0-days+751));
        return registerCal;
    }
    
    @Override
    public int inputLicenseInformation() {
         
        myLicense = readLicense();

        //add by be,20090119.
        //if license file and register are null, let project die.
        if(myLicense == null){
            //System.exit( 0 );
            return INPUT_LICENSE_IS_NULL;
        }

        //keep the old license information, when register has error open, use it to return. TF and SL's requirement ---- begin
        //on 20101104, added by be.
        License myOldLicense = new License();
        myOldLicense.setLocalID(myLicense.getLocalID());
        myOldLicense.setLicenseKey(myLicense.getLicenseKey());
        myOldLicense.setSerialNumber(myLicense.getSerialNumber());
        myOldLicense.setVersion(myLicense.getVersion());
        myOldLicense.setCompany(myLicense.getCompany());
        myOldLicense.setUser(myLicense.getUser());
        myOldLicense.setEmail(myLicense.getEmail());
        myOldLicense.setCreateDate(myLicense.getCreateDate());
        myOldLicense.setInstallationDate(myLicense.getInstallationDate());
        myOldLicense.setAddress(myLicense.getAddress());
        
        
        String keyLocolID = CAARegiestKeySaver.getLocalID();
        if(keyLocolID==null&&myLicense.getLocalID()!=null){
            CAARegiestKeySaver.saveLocalIDToRegistry(myLicense.getLocalID());
        }
       
        //-------------- end
//        System.out.println("old email="+myOldLicense.getEmail());
//        System.out.println("myLicense.getEmail()="+myLicense.getEmail());
        if(!LicenseConst.DISPLAY_ONLINE_REGISTRATION){
            int value = custLicenseDialog(new CSMCustLicenseDialog(null,myLicense));
            if(value != INPUT_LICENSE_VALID) return value;
        }else{
            int value = licenseDialog(new CAALicenseDialog(null,myLicense));
            if(value != INPUT_LICENSE_VALID) return value;
        }
        CAALicense caaLicense = CAALicense.createCSMLicenseFromOldLicense(myLicense);
         try{
            caaLicense.setRegistrationDate(Calendar.getInstance());
            caaLicense.setSoftwareVersion(GUIConst.VERSION_NUMBER);
            
        }catch(Exception e){
            return INPUT_LICENSE_INVALID;
        }        
        writeLicenseFile( caaLicense );
        createLicenseRegistry( caaLicense );
        //checked registry if ok, if no, return it --------- begin
        License newRegLicense = readFromRegistry();
        if(newRegLicense != null){
            if(newRegLicense.getLicenseKey() == null){
                return dealWithRegAfterRegFail(myOldLicense);
            }else{
                if("".equals(newRegLicense.getLicenseKey().trim())){
                     return dealWithRegAfterRegFail(myOldLicense);
                }
            }
        }else{
            return dealWithRegAfterRegFail(myOldLicense);
        }
//        CAARegiestKeySaver.saveLocalIDToRegistry(myLicense.getLocalID());
        LicenseConst.IS_HAD_REG = true;
        return INPUT_LICENSE_VALID;
    }
    

        @Override
        public boolean writeLicenseFile( final License lic ) {
        if ( lic == null ) return false;
        try {
            ObjectOutputStream out = new ObjectOutputStream( new FileOutputStream( lic.getLicenseFilePath() + "\\" + LicenseConst.LICENSE_FILE_NAME ));
            out.writeObject( LicenseConst.VERSION );//add 20090106.
            out.writeObject( lic );
            out.close();
        } catch (Exception e) {
            System.out.println( "writeLicenseFile: " + e.getMessage() );
//             logger.log(Level.SEVERE,"writeLicenseFile Exception="+e.getMessage());
            return false;
        }

        return true;
    }
    public int dayToRegExpire(long time) {

        int days;
        Calendar today = Calendar.getInstance();
        Calendar endDate = Calendar.getInstance();
        endDate.setTimeInMillis( time + CAALicenseConst.EXPIRATION_REGIST_PERIOD_MILLI);
        days = (int) (( endDate.getTimeInMillis() - today.getTimeInMillis() ) / LicenseConst.ONE_DAY_MILLS );
        return days;
    }

    public int dayToRegExpire() {

        Calendar today = Calendar.getInstance();
        Calendar endDate = Calendar.getInstance();
        int days;

        // read both, compare
        CAALicense licReg = readFromRegistry();
        CAALicense licFile = readFromFile();
        if ( licReg == null ) {
            if ( licFile == null ) {
                // either doesn't exist, something wrong
                return -1;
            } else {
                myLicense = licFile;
                endDate.setTimeInMillis( licFile.getRegistrationDate().getTimeInMillis() + CAALicenseConst.EXPIRATION_REGIST_PERIOD_MILLI);
            }
        } else {
            myLicense = licReg;
            if ( licFile != null && licReg.getRegistrationDate().after( licFile.getRegistrationDate() )) {
                endDate.setTimeInMillis( licFile.getRegistrationDate().getTimeInMillis() + CAALicenseConst.EXPIRATION_REGIST_PERIOD_MILLI );
            } else {
                endDate.setTimeInMillis( licReg.getRegistrationDate().getTimeInMillis() + CAALicenseConst.EXPIRATION_REGIST_PERIOD_MILLI);
            }
        }

        days = (int) (( endDate.getTimeInMillis() - today.getTimeInMillis() ) / LicenseConst.ONE_DAY_MILLS );        
        return days;
    }
    
    @Override
    public CAALicense readFromRegistry() {
       try {
           // License lic = (License) Class.forName( appliedLicense.getClass().getName() ).newInstance(); //appliedLicense.getClass(); // new License();
            CAALicense lic = new CAALicense();
            String value;
            lic.setRegistrationDate(Calendar.getInstance());
            value = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, appliedLicense.REG_VALUE_USER );
            if ( value == null ) return null; else lic.setUser(value);
            value = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, appliedLicense.REG_VALUE_COMPANY );
            if ( value == null ) return null; else lic.setCompany(value);
            value = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, appliedLicense.REG_VALUE_LOCALID );
            if ( value == null ) return null; else lic.setLocalID(value);
            value = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, appliedLicense.REG_VALUE_LICENSE_KEY );
            if ( value == null ) return null; else lic.setLicenseKey(value);
            value = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, appliedLicense.REG_VALUE_SERIAL_NUMBER );
            if ( value == null ) return null; else lic.setSerialNumber(value);
            //add by be, 20081229.
             value = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, appliedLicense.REG_VALUE_EMAIL );
            if ( value == null ) return null; else lic.setEmail(value);
            //add by be,20090116.
             //add software version.
            value = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, appliedLicense.REG_SOFTWARE_VERSION );
            if ( value == null ) return null; else lic.setVersion(value);

            //add on 20091028. be
            //reason : v3-14 : add non-mandatory address field in license dialog.
            if(LicenseConst.VERSION.equals(value) && !LicenseConst.VERSION.equals("CSSoft2.0")){
                value = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, appliedLicense.REG_VALUE_ADDRESS );
                if ( value == null ) lic.setAddress(null); else lic.setAddress(value);
            }

            value = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, appliedLicense.REG_VALUE_INSTALLATION_DATE );
            lic.getInstallationDate().setTimeInMillis( Long.parseLong( value ));
            value = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, appliedLicense.REG_VALUE_CREATE_DATE );
            lic.getCreateDate().setTimeInMillis( Long.parseLong( value ));
            Object obj = WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, CAALicense.REG_VALUE_REGISTRATION_DATE );
            if(obj!=null){
                value = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, CAALicense.REG_VALUE_REGISTRATION_DATE );
                if(value!=null&&!value.equals(""))
                    lic.getRegistrationDate().setTimeInMillis( Long.parseLong( value ));
            }       
            obj = WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, CAALicense.REG_VALUE_SOFTWARE_VERSION );
            if(obj!=null){
                value = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, CAALicense.REG_VALUE_SOFTWARE_VERSION );
                if(value!=null&&!value.equals(""))
                    lic.setSoftwareVersion(value);
            } 
            return lic;
        } catch ( Exception e ) {
            e.printStackTrace();
           // System.out.println( "readFromRegistry: " + e.getMessage() );
            System.err.print(e.getMessage());
            return null;
        }
    }
    @Override
    public CAALicense readFromFile() {
        
        try {
           // License lic =(License) Class.forName( appliedLicense.getClass().getName() ).newInstance();
            CAALicense lic = new CAALicense();

            //add file to test 20090119.
            //check file if exist
            File f = new File(appliedLicense.getLicenseFilePath() + "\\" + LicenseConst.LICENSE_FILE_NAME);
            if(!f.exists()){
                f.createNewFile();
               try {
                 CAALicense mylic = new CAALicense();
                 ObjectOutputStream out = new ObjectOutputStream(  new FileOutputStream(appliedLicense.getLicenseFilePath() + "\\" + LicenseConst.LICENSE_FILE_NAME));
                    out.writeObject(LicenseConst.VERSION);
                    //System.out.println( "LicenseConst.VERSION: " + LicenseConst.VERSION );
                    out.writeObject( mylic );
                    out.close();
                } catch (Exception e) {
                   // System.out.println( "writeLicenseFile: " + e.getMessage() );
                   System.err.print(e.getMessage());
                }

//                  return null;
            }

            ObjectInputStream in = new ObjectInputStream( new FileInputStream( appliedLicense.getLicenseFilePath() + "\\" + LicenseConst.LICENSE_FILE_NAME ));
            String softversion  = in.readObject().toString();// at present, no use it. 20090116 be.
//            if(LicenseConst.VERSION.equals(softversion)){
//                lic = new License();
//            }else{
                 lic = (CAALicense)in.readObject();
//            }
            in.close();
            return lic;
        } catch (Exception e) {
           // System.out.println("CSLib/LicenseController/readFromFile e.printStackTrace=");
//            System.err.print(e.getMessage());
            return null;
        }
    }

    @Override
    public boolean createLicenseRegistry( final License lic ) {
        if ( !WinRegistry.keyExists( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT )) {
            if ( !WinRegistry.createKey( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT ))
                return false;
        }
        if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, License.REG_VALUE_USER, lic.getUser()))
            return false;
        if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, License.REG_VALUE_COMPANY, lic.getCompany()))
            return false;
        if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, License.REG_VALUE_LOCALID, lic.getLocalID()))
            return false;
        if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, License.REG_VALUE_LICENSE_KEY, lic.getLicenseKey()))
            return false;
        if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, License.REG_VALUE_SERIAL_NUMBER, lic.getSerialNumber()))
            return false;
        //add by be, 20081229.
         if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, License.REG_VALUE_EMAIL, lic.getEmail()))
            return false;
        //add by be,20090116.
        //modify on 20091028. be
        //reason : v3-14 : add non-mandatory address field in license dialog.
//          if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, lic.REG_SOFTWARE_VERSION, lic.getVersion()))
//                   return false;
        if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, License.REG_SOFTWARE_VERSION, LicenseConst.VERSION))
           return false;

        

        if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, License.REG_VALUE_CREATE_DATE,
                                    String.valueOf( lic.getCreateDate().getTimeInMillis() ))) return false;
        if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, License.REG_VALUE_INSTALLATION_DATE,
                                    String.valueOf( lic.getInstallationDate().getTimeInMillis() ))) return false;
        if(lic instanceof CAALicense){
            CAALicense csmlic = (CAALicense)lic;
            if(csmlic.getRegistrationDate()!=null)
                if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, CAALicense.REG_VALUE_REGISTRATION_DATE,
                                    String.valueOf( csmlic.getRegistrationDate().getTimeInMillis() ))) return false;  
            if(csmlic.getSoftwareVersion()!=null)
                if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, CAALicense.REG_VALUE_SOFTWARE_VERSION,
                                    csmlic.getSoftwareVersion())) return false;  
            
        }
        //add on 20091028. be
        //reason : v3-14 : add non-mandatory address field in license dialog.
        if(!LicenseConst.VERSION.equals("CAA2.0") ){
//            System.out.println("write address");
          if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, LicenseConst.REG_KEY_ROOT, License.REG_VALUE_ADDRESS, lic.getAddress()))
            return false;
        }
//        System.out.println("write address ====");
        return true;
    }

     public static boolean isValidLicenseKey( String key ) {
         
        String validKey = License.calculateLicenseKey(CAARegiestKeySaver.getLocalID());
        if ( validKey.compareTo( key ) == 0 )            
            return true;
        else
            return false;
    }
    private int custLicenseDialog(CSMCustLicenseDialog licDlg) {       
        licDlg.setModal( true );
        licDlg.setVisible( true );
            if(licDlg.getChoice() == licDlg.OFFLINEREG_SELECTED ){                
                if( licDlg.getEnteredLicenseKey() == null){
                     return INPUT_LICENSE_INVALID;
                }
                if (  "".equals(licDlg.getEnteredLicenseKey().trim()) ) {
                    return INPUT_LICENSE_INVALID;
                }
                myLicense.setLicenseKey(licDlg.getEnteredLicenseKey().trim());
                if(!isValidLicenseKey(myLicense.getLicenseKey())){
                    return INPUT_LICENSE_INVALID;
                }
                myLicense.setSerialNumber(licDlg.getSerialNumber());
                myLicense.setEmail("");
                myLicense.setAddress("");
           } else {
            return INPUT_LICENSE_USER_CANCEL;
        }
        return INPUT_LICENSE_VALID;
    }
    boolean validKey(String key,String sn){
        if(key.length()!=19)
            return false;  
        String tmpid = calculateLocalID();
        String tmp = tmpid+sn;        
        if(tmp.length()!=33)
            return false;
        tmp = tmp.replaceAll("-", "");
        String validKey = calculateLicenseKey(tmp);

        int selIndex = key.charAt(28) % 5;
        validKey = validKey.substring(5*selIndex,5*selIndex+28)+key.charAt(28);
//        String tmp1 = getNeedCompareStrKey(validKey);
//        String tmp2 = getNeedCompareStrKey(key);
//        if ( validKey.compareTo( key ) == 0 )
//        if ( tmp1.compareTo( tmp2 ) == 0 )
//            return true;    
        return false;
    }
    public static String calculateLicenseKey( String localID ) {
        String licenseKey = "";
        try {   
             licenseKey = createKey("",localID,"&#");
             if("E".equals(licenseKey)) licenseKey = "";
        } catch (Exception e) {           
           return "";
        }
        return licenseKey;
    }
    public static String createKey(String subkey1,String localID,String subkey2){

        if(localID == null) return "";
        if("".equals(localID.trim())) return "";
        try{

            String baseKey = subkey1+localID+subkey2;

            String localIDBase = new sun.misc.BASE64Encoder().encode(baseKey.getBytes());
            int localidBaseLen = localIDBase.length();
            for(int i=0; i<localidBaseLen; i++){
                String tmpStrChar = localIDBase.substring(i,(i+1));
                if( tmpStrChar.matches("^.*[@|!|~|\"|<|>|#|\\^|/|*|(|)|+|-|=|\\||'|`|:|,|?|\\$|&|%|\\\\|\\.]+.*$")){
                     localIDBase = localIDBase.replaceAll(tmpStrChar, "C");
                }
            }
           localIDBase = localIDBase.toUpperCase();
           localidBaseLen = localIDBase.length();
            String keyPro = "";
		    String keyNext = "" ;
            for(int reply=0; reply < 2 ; reply++){
                keyPro = "" ;
                keyNext = "" ;
				for(int i=0; i < localidBaseLen; i++){
					if(i%2 == 0)  keyPro += localIDBase.substring(i,(i+1));
					else if(i%2 == 1)  keyNext += localIDBase.substring(i,(i+1));
				}
				localIDBase = keyNext+keyPro;
				localidBaseLen = localIDBase.length();
			}

			String key1 = "";
			String key2 = "";
			String key3 = "";
			String key4 = "";
            int keyNextLen = keyNext.length();
			for(int i=0;i < keyNextLen;i++){
				if(i%2 == 0)  key1 += keyNext.substring(i,(i+1));
				else if(i%2 == 1)  key2 += keyNext.substring(i,(i+1));
			}

            int keyProLen = keyPro.length();
			for(int i=0;i < keyProLen;i++){
				if(i%2 == 0)  key3 += keyPro.substring(i,(i+1));
				else if(i%2 == 1)  key4 += keyPro.substring(i,(i+1));
			}

			localIDBase=key4+key2+key1+key3;
		    localidBaseLen = localIDBase.length();
            int keyLen = 0;
            if(localidBaseLen > 39){
                keyLen = 40;
            }else{
                keyLen = localidBaseLen;
            }
			String key = "" ;
			for(int i=0;i < keyLen;i++){
				if(i%4 == 0 && i > 0 )  key +="-"+localIDBase.substring(i,(i+1));
				else key +=localIDBase.substring(i,(i+1));
			}
            return key;

        }catch(Exception e){
            return "E";
        }

    }
    private int dealWithRegAfterRegFail(License myOldLicense) {
        writeLicenseFile(myOldLicense);
        deleteRegistrationInformationFromServer(myLicense.getLocalID(), myLicense.getSerialNumber());        
        JOptionPane.showMessageDialog(null,java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("registratrion_need_admin_right_in_win7"));
        LicenseConst.IS_HAD_REG = false;
        return INPUT_LICENSE_USER_CANCEL;
    }

    private int licenseDialog(CAALicenseDialog licDlg) {
        //LicenseDialog licDlg = new LicenseDialog( null, myLicense );
        licDlg.setModal( true );
        licDlg.setVisible( true );        
        if ( licDlg.getChoice() == licDlg.OFFLINEREG_SELECTED || licDlg.getChoice() == licDlg.ONLINEREG_SELECTED ) {
            final String encoding = System.getProperty("file.encoding");
            if(licDlg.getChoice() == licDlg.OFFLINEREG_SELECTED ){

           }else{
               if(licDlg.getChoice() == licDlg.ONLINEREG_SELECTED){
                    
                    myLicense.setUser(licDlg.getUserName());
                    myLicense.setCompany(licDlg.getComapnyName());
                    myLicense.setEmail(licDlg.getEmail());
                    myLicense.setAddress(licDlg.getAddress());
                    if(myLicense instanceof CAALicense){                    
                        myLicense.setSerialNumber(licDlg.getSerialNumber());
                        myLicense.setLicenseKey(License.calculateLicenseKey(License.calculateLocalID()));
                    }
               }
           }

        } else if ( licDlg.getChoice() == licDlg.CANCEL_SELECTED ) {
            return INPUT_LICENSE_USER_CANCEL;
        }
        return INPUT_LICENSE_VALID;
    }
   
    public boolean checkVersion(){
        if(myLicense instanceof CAALicense){
            CAALicense caaLicense = (CAALicense) myLicense;
            if((System.currentTimeMillis()-caaLicense.getRegistrationDate().getTimeInMillis())/(24*1000*3600)>365){
                String oldversion = caaLicense.getSoftwareVersion();
                String[] oldArray = oldversion.split("\\.");
                String[] newArray = GUIConst.VERSION_NUMBER.split("\\.");            
                if(oldArray.length==3&&newArray.length==3){
                    for(int i=0;i<3;i++){
                        int diff = Integer.valueOf(newArray[i]).compareTo(Integer.valueOf(oldArray[i]));
                        if(diff>0){
                            return false;
                        }else if(diff<0){
                            return true;
                        }
                    }
                    return true;
                }
            }else{
                return true;
            }
                           
        }
        return false;
    }
    public String getOldVersion(){
        if(myLicense instanceof CAALicense){
            CAALicense caaLicense = (CAALicense) myLicense;            
            String oldversion = caaLicense.getSoftwareVersion();
            return oldversion;  
        }
        return null;
    }
    public boolean isLicensed() {

        if (License.isLicenseFreeLocale()) {
            return true;
        }
        LicenseConst.IS_HAD_REG = false;
        // read both, compare
        License licReg = readFromRegistry();
        License licFile = readFromFile();
        if (licReg == null) {
            if (licFile == null) {
                // either doesn't exist, something wrong
                return false;
            } else {
                myLicense = licFile;
                //endDate.setTimeInMillis( licFile.InstallationDate.getTimeInMillis() + EXPIRATION_PERIOD_MILLI  );
            }
        } else {
            myLicense = licReg;
            if (licFile != null && licReg.getInstallationDate().after(licFile.getInstallationDate())) {
                //endDate.setTimeInMillis( licFile.InstallationDate.getTimeInMillis() + EXPIRATION_PERIOD_MILLI  );
            } else {
                //endDate.setTimeInMillis( licReg.InstallationDate.getTimeInMillis() + EXPIRATION_PERIOD_MILLI  );
            }

        }

        //modify on 20100805,be.
        //old version lower 3.3 : localid is old, licensekey is old
        //version 3.3 : localid is new, licensekey is new.
        //greater version 3.3 : localid is old, licensekey is new.
        //check version.
        //if old version software had registered, use old calculate method to check.
        String curVersion = myLicense.getVersion();
        if (curVersion != null) {
            int tmpVersionLen = curVersion.length();
            curVersion = curVersion.substring((tmpVersionLen - 3), tmpVersionLen);
        }
        float fCurVersion = Float.valueOf(curVersion.replace(',', '.'));

        if (!"".equals(myLicense.getLicenseKey())) {
//            if (myLicense.getLicenseKey().length() == 19||myLicense.getLicenseKey().length() == 29) {
//                LicenseConst.IS_HAD_REG = true;
//                return true;
//            }
            if(checkLicenseKey(myLicense.getLicenseKey())){
                LicenseConst.IS_HAD_REG = true;
                return true;
            }
        }
        //csm-m no need old version check
        //old version

        // check if the license key matches        
//        if (CSMLicense.isValidLicenseKey(myLicense.getLicenseKey(), myLicense.getSerialNumber())) {
//            LicenseConst.IS_HAD_REG = true;
//            return true;
//        }        
        return false;
    }

}
