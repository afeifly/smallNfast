/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.cs.canalyzer.gui;

import java.io.BufferedReader;
import java.io.FileReader;

/**
 *
 * @author be
 */
public class CustomizedSettings {


    /** Read customized information from 'caainfo.cus'. Format like this;
     *  new license control.
     *  Registration web page url
     *  De-activation web page url
     *
     */
    public static boolean readCustomizedInformation() {
        try {
            BufferedReader input =  new BufferedReader(new FileReader(CUSTOMIZED_FILE_NAME));
            String line;

            try {

                                
                //de-activation web page url
                line = input.readLine();
                if(line != null){
                    if(!"".equals(line.trim())){
                        CUS_DEACTIVATION_URL = line.substring( line.indexOf("=") + 1 );
                    }
                }

                //registration web page url
                line = input.readLine();
                if(line != null){
                    if(!"".equals(line.trim())){
                        CUS_REGISTRATION_URL = line.substring( line.indexOf("=") + 1 );
                    }
                }
                line = input.readLine().trim();
                if ( line.substring( line.indexOf("=") + 1 ).compareToIgnoreCase("OFF") == 0 )
                    DISPLAY_ONLINE_REGISTRATION = false;
                
                line = input.readLine().trim();
                REGISTRATION_SENDEMAILTO = line.substring(line.indexOf("=")+1);

            } catch ( Exception ee ) {
                ee.printStackTrace();
            } finally {
                input.close();
            }
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
       }

    }

    //new license control ---------- begin
    private static final String CUSTOMIZED_FILE_NAME = "caainfo.cus";

    public static String CUS_REGISTRATION_URL="http://suto.dyndns.biz:8880/registration";
    public static String CUS_DEACTIVATION_URL="http://suto.dyndns.biz:8880/deactivation";
    public static boolean DISPLAY_ONLINE_REGISTRATION=true;
    public static String REGISTRATION_SENDEMAILTO = null;
    //----------------- end
}
