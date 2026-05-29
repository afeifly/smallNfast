/*
 * Different project use this lib, just set this class property .
 *
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.cs.canalyzer.license;

import com.cs.canalyzer.gui.PropertyUtil;
import com.cs.log.CSLog;
import java.io.IOException;
import java.util.logging.Logger;

/**
 *
 * @author wolf
 */
public class CAALicenseConst {
//    public static final long serialVersionUID = 8170941048673791171L;

    public static int CS_OR_CUSTEMER_VERSION = 1; //CS is 0; CS-iTEC is 1; BEKO: 2; IR:3
    
    public static final int CS_ITEC_VERSION = 0;    
    public static final int IR_VERSION = 1;
    //add by be,20081229.
    //response online register succeful check code
    public final static String RES_ONLINEREG_SUCC = "798713f8c907dde6a0ab95bb775b8d16";  
    public final static String RES_SN_HAD_USED_TWO_PC = "6e123807d4665475c1a8ab785a081569";
    public final static String RES_SN_INVALID = "c01b044bd550951a13449d5205c2dbd9";
    public final static String UPGRADE_WRONG_CODE = "f3709292f0796148b5db95eb21177066";
    public final static String UPGRADE_WRONG_SN = "e5dc7f05bba49cb398b935cbdb75cf44";
    public final static String UPGRADE_INVALID = "d41d8cd98f00b204e9800998ecf8427e";
    public static long EXPIRATION_REGIST_PERIOD_MILLI = (long) 365 * 86400000;

    public final static String NO_REG = "NoReg";
    public final static String REQUEST_URL = "http://suto.dyndns.biz:8880/licensecontrol/onlinereg/indexv3.php";//online register web page url.
    public final static String UPGRADE_REQUEST_URL = "http://suto.dyndns.biz:8880//upgrade/indexv3.php";//online register web page url.
    //change to set value to test. must be delete and delete LicenseDialog's sendRequest's test url.
//    public final static String REQUEST_URL = "http://localhost:8066/licensecontrol/onlinereg/indexv3.php";//online register web page url.
    
    public final static String IMAGE_PATH = "/com/cs/canalyzer/gui/img/";
    public final static String LOGO_FILE_NAME = "logo.png";
    //add by be,2009/1/12.
    //create logger . 
    private final static Logger logger = Logger.getLogger(CAALicenseConst.class.getName());
    public final static Logger getLogger(){ 
         return logger;
    }
    public final static Logger setLogger(){ 
        try{
                CSLog.setLogingProperties(logger);
            }catch (SecurityException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            } catch (IOException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }
        return logger;
    }
    //add by be, 2008/12/25.
    public static int DAYS_TO_REMIND_BEFORE_EXPIRE;
    public static long EXPIRATION_PERIOD_MILLI;  // 1 month
    public static long ONE_DAY_MILLS ;
    public static String REG_KEY_ROOT;//reigst table's key root.
    public static String LICENSE_FILE_NAME ; //create license file name.   
    public static byte[] KEY_MATRICS ;//encrpy key
    public static String SOFT_TYPE;//which type of sotf to register.
    //add by be,20090116.
    //add software version to identify software
    public static String VERSION;

    //add on 20090610
    //reason : new requirement : show email address which receive registration information on registration dialog.
    //                           add software name when data export to excel.
    public static String REGISTRATION_SENDEMAILTO = null;
    public static String EXPORTEXCEL_SOFTWARENAME = null;
    public static boolean DISPLAY_ONLINE_REGISTRATION = false;

    //new license concept, add on 20100610 ---------begin
     public final static float START_NEW_CONCEPT_VERSION = (float)3.5;
     public final static String DELETE_ACTIVATION_URL = "http://suto.dyndns.biz:8880/deactivation/online.php"; //delete activation web page url.

     public static String REGISTRATION_URL="http://suto.dyndns.biz:8880/registration";
     public static String DEACTIVATION_URL="http://suto.dyndns.biz:8880/deactivation";
     public static String UPGRADE_URL="http://suto.dyndns.biz:8880/upgrade";
    
   }

