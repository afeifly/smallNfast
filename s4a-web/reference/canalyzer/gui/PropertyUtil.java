/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package com.cs.canalyzer.gui;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.Properties;

public class PropertyUtil {
    
    public static final int CS_ITEC_LOGO_TYPE = 0;
    public static final int IR_LOGO_TYPE = 1; 
    public static final int SUTO_LOGO_TYPE = 2; 
    public static final int NEUTRAL_LOGO_TYPE = 3;
    
    public static int logoType = -1;
    public PropertyUtil() {
    }    
    private String getValueByPropertyName(String propertiesFileName,String propertyName) {
        String s="";
        Properties p=new Properties();
        FileInputStream in;
        try {
            //propertiesFileName如test.properties
            in = new FileInputStream(propertiesFileName);
            p.load(in);
            in.close();
            s=p.getProperty(propertyName);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return s;
    }
   
    public static boolean isIRLogoType(){
        if(logoType<0){
            PropertyUtil operatePropertiesFile = new PropertyUtil();
            String value = operatePropertiesFile.getValueByPropertyName("caacfg.properties", "logoType");
            logoType = Integer.valueOf(value);            
        }
        if(logoType==IR_LOGO_TYPE){
            return true;
        }else {
            return false;
        }
    }
    public static boolean isNeutralLogoType(){
        if(logoType<0){
            PropertyUtil operatePropertiesFile = new PropertyUtil();
            String value = operatePropertiesFile.getValueByPropertyName("caacfg.properties", "logoType");
            logoType = Integer.valueOf(value);            
        }
        if(logoType==NEUTRAL_LOGO_TYPE){
            return true;
        }else if(logoType==CS_ITEC_LOGO_TYPE
                ||logoType==SUTO_LOGO_TYPE){
            return false;
        }else{
            return true;
        }
    }
    public static boolean isSUTOLogoType(){
        if(logoType<0){
            PropertyUtil operatePropertiesFile = new PropertyUtil();
            String value = operatePropertiesFile.getValueByPropertyName("caacfg.properties", "logoType");
            logoType = Integer.valueOf(value);            
        }
        if(logoType==SUTO_LOGO_TYPE){
            return true;
        }else{
            return false;
        }
    }
}