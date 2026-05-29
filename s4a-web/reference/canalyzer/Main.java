package com.cs.canalyzer;

import com.cs.caa.registaer.RegistrationDialog;
import com.cs.canalyzer.gui.Base;
import com.cs.canalyzer.gui.CustomizedSettings;
import com.cs.canalyzer.gui.PropertyUtil;
import com.cs.canalyzer.gui.StartupScreen;
import com.cs.canalyzer.license.CAAExpirationTypeLicense;
import com.cs.license.ExpirationTypeLicense;
import com.cs.license.License;
import com.cs.license.LicenseConst;
import com.suto.license.LicenseController;
//import com.cs.license.LicenseController;
import java.awt.Component;
import java.util.ResourceBundle;
import javax.swing.JOptionPane;
/*
 * Main.java
 *
 * Created on 2007年3月14日, 上午10:23
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

/**
 *
 * @author msu
 */
public class Main {
    private static final ResourceBundle cAATexts = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts");
    
    /** Creates a new instance of Main */
    public Main() {
        
    }
    
    /**
     * @param args the command line arguments
     */
    public static void main(String[] args) {

        if ( !CustomizedSettings.readCustomizedInformation() ) {
            JOptionPane.showMessageDialog( null, "Some files are missing. Please re-install program.");
        }

        StartupScreen startup = new StartupScreen();
        startup.showUp( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_wait_while_program_starting_up_..._") );
        

        Base base = new Base();
        base.setVisible( true );
        
        startup.unShow();
        //
        if(!LicenseController.checkLicenseFileStatus(LicenseController.getLocalIDFromRegedit())){
            RegistrationDialog rd = new RegistrationDialog(null,true);
            rd.setVisible(true);
            if(!LicenseController.checkLicenseFileStatus(LicenseController.getLocalIDFromRegedit())){
                System.exit(0);
            }
        }

    }
    
    
     //add by be,20090210.
    //defferent project set different parameter, this parameter effect CSLib.
    private static void setLicenseConst(){
         LicenseConst.DAYS_TO_REMIND_BEFORE_EXPIRE = 15 ;
         LicenseConst.EXPIRATION_PERIOD_MILLI = (long) 45 * 86400000;  // 1 month
         LicenseConst.ONE_DAY_MILLS = 86400000;
         LicenseConst.REG_KEY_ROOT = "SOFTWARE\\CS_Instruments\\CS-CAA-New\\License";
         LicenseConst.LICENSE_FILE_NAME = "cs-caa-new.lic";
           
         LicenseConst.KEY_MATRICS = new byte[]{ 23, 34, 45, 67, 89, 99, 125, 32, 1, 113, 88, 55, 33, 33, 22,
                                   65, 124, 69, 78, 114, 53, 97, 54, 109, 22, 79, 7, 12, 12, 11, 27 };
         LicenseConst.SOFT_TYPE = "CAA-N"; 
         LicenseConst.VERSION = "3.4";
         LicenseConst.setLogger();
//         LicenseConst.DISPLAY_ONLINE_REGISTRATION = true;
         
         LicenseConst.DISPLAY_ONLINE_REGISTRATION = CustomizedSettings.DISPLAY_ONLINE_REGISTRATION;
         //new license control 20100617 -------begin
         LicenseConst.DEACTIVATION_URL = CustomizedSettings.CUS_DEACTIVATION_URL;
         LicenseConst.REGISTRATION_URL = CustomizedSettings.CUS_REGISTRATION_URL;
         LicenseConst.REGISTRATION_SENDEMAILTO = CustomizedSettings.REGISTRATION_SENDEMAILTO;
         //-------------------------- end
         
//         System.out.println("LicenseConst.KEY_MATRICS==="+LicenseConst.KEY_MATRICS);
    }
    
}
