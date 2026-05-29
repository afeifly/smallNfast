/*
 * HelpConst.java
 *
 * Created on 2008年5月26日, 下午6:27
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.help;

import java.util.Locale;

/**
 *
 * @author wolf
 */
public class HelpConst {
    
    /** Creates a new instance of HelpConst */
    public HelpConst() {
    }
    
    /** Look for .hs file path matching current local setting
     */ 
    public static final String FindHSFilePath() {
        /*for ( Locale l : Locale.getAvailableLocales() ) {
            System.out.print( l.getLanguage() + "   " );
        }
        System.out.println("");*/
        
        String language = Locale.getDefault().getLanguage();
//System.out.println( language );        
        if ( language.compareTo( "zh") == 0 )
            return CHINESE_HELP_HS_FILE_PATH;
        else if ( language.compareTo( "ja") == 0 )
            return JAPANESE_HELP_HS_FILE_PATH;
        else if ( language.compareTo( "de") == 0 )
            return GERMAN_HELP_HS_FILE_PATH;
        
        
        return DEFAULT_HELP_HS_FILE_PATH;
    }
    
    
    public static final String DEFAULT_HELP_HS_FILE_PATH = "com/cs/canalyzer/help/main_en_US.hs";
    public static final String CHINESE_HELP_HS_FILE_PATH = "com/cs/canalyzer/help/CAA Help-zh/main_zh.hs";
    public static final String JAPANESE_HELP_HS_FILE_PATH = "com/cs/canalyzer/help/CAA Help-jp/main_ja.hs";
    public static final String GERMAN_HELP_HS_FILE_PATH = "com/cs/canalyzer/help/main_en_US.hs";
    
}
