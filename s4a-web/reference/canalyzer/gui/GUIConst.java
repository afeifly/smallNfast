/*
 * GUIConst.java
 *
 * Created on 2007年3月15日, 下午5:36
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.gui;

import com.cs.canalyzer.gui.dialog.NewWaitingDialog;
import java.awt.Color;
import java.awt.Font;
import java.sql.Timestamp;
import java.util.Calendar;
import javax.swing.JFileChooser;

/**
 *
 * @author msu
 */
public final class GUIConst {
    
    /** Creates a new instance of GUIConst */
    public GUIConst() {
    }
    
    
  //  public static final LicenseController LICENSE_CONTROLLER = new ExpirationTypeLicense();
    
    public static final int MAX_PAGE_NUMBER_OF_EXPORT_PDF_AND_PRINT = 60;
    
    public static final int MAX_CHANNEL_ALLOW = 6;
    public static final int Y_AXIS_NUMBER = 4;
    public static final int MAX_COLOR_NUMBER = 256;
    
    public static final java.awt.Color BACKGROUND_COLOR = new java.awt.Color(169, 219, 152);
    
    public final static String IMAGE_PATH = "/com/cs/canalyzer/gui/img/";
    public final static String LOGO_FILE_NAME = "logo.png";
    public final static String CONFIG_FILE_NAME = "canalyzer.cfg";
    
    public static String LOAD_FILE_PATH = "";  // remember the last opened file path
    
    public static String[] DATE_FORMAT_STRING = {"EEE dd.MM.yyyy"};  // for use in the jDatePicker field
    
    /** Some strings, because of locale setting, could change decimal point "." to other characters such as
     ",". This method is to change that back to "." so that string is ready for conversion to number. */
    public static final String VerifyString( String s ) {
        String result = "";
        char c;
        for ( int i = 0; i < s.length(); i++ ) {
            c = s.charAt(i);
            if ( c == ',' )
                c = '.';
            result += c;
        }
        return result;
    }
    
    public static String DEFAULT_DATE_FORMAT(Timestamp time) {
        try {
            String date = String.format( "%td.%tm.%tY", time, time, time);
            if ( date != null ) return date;
            else return java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Failed");
        } catch (Exception e) {
            return java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Failed");
        }
    }
    
    public static String DEFAULT_DATE_FORMAT( Calendar time ) {
        try {
            String date = String.format( "%td.%tm.%tY", time, time, time);
            if ( date != null ) return date;
            else return java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Failed");
        } catch (Exception e) {
            return java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Failed");
        }
    }
    
   
    public static String DEFAULT_TIME_FORMAT(Timestamp time) {
        try {
            String gtime = String.format( "%tH:%tM:%tS", time, time, time);
            if ( gtime != null ) return gtime;
            else return java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Failed");
        } catch (Exception e) {
            return java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Failed");
        }
    }
    
    public static String DEFAULT_TIME_FORMAT( Calendar time ) {
        try {
            String gtime = String.format( "%tH:%tM:%tS", time, time, time);
            if ( gtime != null ) return gtime;
            else return java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Failed");
        } catch (Exception e) {
            return java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Failed");
        }
    }

    public static String DEFAULT_DATE_AND_TIME_FORMAT(Timestamp time) {
        String fullTime = DEFAULT_DATE_FORMAT(time) + " " + DEFAULT_TIME_FORMAT(time);
        return fullTime;
    }
    
    public static String DEFAULT_DATE_AND_TIME_FORMAT( Calendar time ) {
        String fullTime = DEFAULT_DATE_FORMAT(time) + " " + DEFAULT_TIME_FORMAT(time);
        return fullTime;
    }
    
    /** return only date and time
     */ 
    public static String DEFAULT_DATE_AND_TIME_SHORT_FORMAT( Timestamp time ) {
        String fullTime = DEFAULT_DATE_FORMAT(time) + " " +  String.format( "%tH", time ) + ":00";
        return fullTime;
    }
    
    /** return only date and time
     */ 
    public static String DEFAULT_DATE_AND_TIME_SHORT_FORMAT( Calendar time ) {
        String fullTime = DEFAULT_DATE_FORMAT(time) + " " +  String.format( "%tH", time ) + ":00";
        return fullTime;
    }

    public final static Font DIALOG_FONT = new Font( "SansSerif", 1, 10 );
    public final static Font TITLE_FONT = new Font( "DialogInput", 0, 12 );
    public final static Color TITLE_COLOR = new Color( 5,176,117 );
    public final static Font BUTTON_FONT = new Font( "Dialog", 1, 10 );
    public final static Font REPORT_FONT = new Font( "Dialog", 0, 12 );
    
    // when mouse move over header list dialog, header information dialog automatically popup after this delay.
    public static final int HEADER_INFORMATION_DIALOG_POPUP_DELAY = 1000;  // in millisecond
    
    public final static long ONE_HOUR_MILLS = 3600000;
    public final static long ONE_DAY_MILLS = 86400000;
    
    public final static char CUBIC_ASCII = 179;
    public final static String CONSUMPTION_UNIT_PREFIX_M = "m" + CUBIC_ASCII + "/";
    public final static String CONSUMPTION_UNIT_PREFIX_C = "cfm";
    
    public final static JFileChooser FILE_CHOOSER = new JFileChooser();    
    public final static NewWaitingDialog WAITING_DIALOG = new NewWaitingDialog();    
    public final static String VERSION = "Compressed Air Analyzer ";
    /**
     *  please make sure the version_number is three party and spilt by '.'
     */
    public final static String VERSION_NUMBER = "2.10.16";
    
    
}
