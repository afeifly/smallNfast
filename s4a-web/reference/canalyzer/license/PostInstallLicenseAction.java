package com.cs.canalyzer.license;

import com.cs.canalyzer.gui.CustomizedSettings;
import com.cs.license.ExpirationTypeLicense;
import com.cs.license.License;
import com.cs.license.LicenseConst;
import com.install4j.api.actions.AbstractInstallAction;
import com.install4j.api.context.InstallerContext;
import com.suto.license.LicenseController;
import com.suto.license.LicenseUtil;
import javax.swing.JOptionPane;

/**
 *
 * @author ethan
 */
public class PostInstallLicenseAction extends AbstractInstallAction {

    public PostInstallLicenseAction() {
    }

    private static void setLicenseConst() {
        LicenseConst.DAYS_TO_REMIND_BEFORE_EXPIRE = 15;
        LicenseConst.EXPIRATION_PERIOD_MILLI = (long) 45 * 86400000;  // 1 month
        LicenseConst.ONE_DAY_MILLS = 86400000;
        LicenseConst.REG_KEY_ROOT = "SOFTWARE\\CS_Instruments\\CS-CAA-New\\License";
        LicenseConst.LICENSE_FILE_NAME = "cs-caa-new.lic";

        LicenseConst.KEY_MATRICS = new byte[]{23, 34, 45, 67, 89, 99, 125, 32, 1, 113, 88, 55, 33, 33, 22,
            65, 124, 69, 78, 114, 53, 97, 54, 109, 22, 79, 7, 12, 12, 11, 27};
        LicenseConst.SOFT_TYPE = "CAA-N";
        LicenseConst.VERSION = "3.4";
        LicenseConst.setLogger();
        LicenseConst.DISPLAY_ONLINE_REGISTRATION = true;
        LicenseConst.DEACTIVATION_URL = CustomizedSettings.CUS_DEACTIVATION_URL;
        LicenseConst.REGISTRATION_URL = CustomizedSettings.CUS_REGISTRATION_URL;

    }
    CAAExpirationTypeLicense myLicenseController = null;

    public static void main(String[] args) {
        PostInstallLicenseAction ac = new PostInstallLicenseAction();
        ac.install(null);
    }

    public boolean install(InstallerContext context) {
//        setLicenseConst();
//        myLicenseController = new CAAExpirationTypeLicense(new License());
//        makeLicenseAccess();
//        if (myLicenseController.isLicensed()) {
//            if(!myLicenseController.checkVersion()){
//                JOptionPane.showMessageDialog(null,
//                        java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts")
//                        .getString("Free update period is expired, Please use old version.")
//                        +myLicenseController.getOldVersion()
//                        +java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts")
//                        .getString("_or below,")
//                        +"\n"
//                        +java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts")
//                        .getString("Or buy new license and regeister it first.")
//                        );
//                return false;
//            }
//        }
        LicenseController.saveLocalIDToRegedit(LicenseUtil.generateLocalID());
        return true;
    }
    public boolean makeLicenseAccess(){        
        try {
            License licReg, licFile;
            licReg = myLicenseController.readFromRegistry();
            licFile = myLicenseController.readFromFile();
            if ( licReg == null ) {
                if ( licFile == null ) {
                    return createNewLicense();
                } else {
                    return myLicenseController.createLicenseRegistry( licFile );
                }
            } else {
                if ( licFile == null ) {
                    return myLicenseController.writeLicenseFile( licReg );
                } else {                   
                    return true;
                }
            }
        } catch ( Exception e) {
            e.printStackTrace();
            return false;
        }
    }
    private boolean createNewLicense() {
        boolean success = false;
        License lic = new License();
        if ( myLicenseController.createLicenseRegistry( lic ))
            success = true;
        if ( myLicenseController.writeLicenseFile( lic ))
            success = true;
        else
            success = false;
        return success;
    }
}