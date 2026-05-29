/*
 * DatabaseSetting.java
 *
 * Created on 2007年4月18日, 上午11:18
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.structs;

import com.cs.canalyzer.gui.PropertyUtil;
import com.install4j.api.windows.RegistryRoot;
import com.install4j.api.windows.WinRegistry;
import java.io.Serializable;
import java.util.ArrayList;

/**
 *
 * @author msu
 */
public class DatabaseInformation implements Serializable {
    
    /** Creates a new instance of DatabaseSetting */
    public DatabaseInformation() {
        
    }
    
    /** Do an automatic search on local machine trying to find any existing CSSoft program
     * and create link to their databases.
     *  In 2.1 version and after, it'll only search for CSSoft 2.0 or after
     */ 
    public static ArrayList<DatabaseInformation> searchForCSSoftDatabases() {
        ArrayList<DatabaseInformation> databases = new ArrayList<DatabaseInformation>();
        DatabaseInformation dbInfo;
        String keyRoot = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall";
        String version, fullVersion;
        int[] totalRelease = { 1, 1, 1, 99, 99, 99, 99, 99, 99, 99 };
        
        // release example: 1.0, 1.1, 1.2.0, 1.3.0, 1.3.1 ... 
        for ( int i = 0; i < 10; i++ ) {
            version = "2." + i;
            for ( int j = 0; j < 100; j++ ) {
                if ( j > 0 ) fullVersion = version + "." + ( j - 1 );
                else fullVersion = version;
                
                String path = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE,
                                                      keyRoot + "\\CSSoft " + fullVersion, 
                                                      "UninstallString");
                if ( path != null ) {
                    // found one
                    path = path.substring( 0, path.indexOf( "uninstall" ));
                    dbInfo = new DatabaseInformation();
                    dbInfo.Name = "CSSoft " + fullVersion + " Data";
                    dbInfo.Description = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString(
                            PropertyUtil.isIRLogoType()?"Record_data_from_IRSoft_":"Record_data_from_CSSoft_") + fullVersion + ".";
                    dbInfo.DatabasePath = path + DEFAULT_DB_SUB_PATH;
                    databases.add( dbInfo );
                } // found one
            }
            
            // CSSoft only
            String path = (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE,
                                                  keyRoot + "\\CSSoft ", 
                                                  "UninstallString");
            if ( path != null ) {
                // found one
                path = path.substring( 0, path.indexOf( "uninstall" ));
                dbInfo = new DatabaseInformation();
                dbInfo.Name = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString(
                        PropertyUtil.isIRLogoType()?"IRSoft_Data":"CSSoft_Data");
                dbInfo.Description = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString(
                        PropertyUtil.isIRLogoType()?"Record_data_from_IRSoft.":"Record_data_from_CSSoft.");
                dbInfo.DatabasePath = path + DEFAULT_DB_SUB_PATH;
                databases.add( dbInfo );
            } // found one
            
        }
        
        return databases;
    }

    //public static final String DEFAULT_DB_PATH = "db\\csmain\\csmain";
    public static final String DEFAULT_DB_SUB_PATH = "data";
    public static final String DEFAULT_NAME = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString(PropertyUtil.isIRLogoType()?"IRSoft_Data":"CSSoft_Data");
    public static final String DEFAULT_DESCRIPTION = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString(
                PropertyUtil.isIRLogoType()?"Record_database_from_IRSoft.":"Record_database_from_CSSoft.");
    
    public static final int TYPE_HSQLDB = 0;
    public static final int TYPE_CSMDF = 0;
    
    public String Name = DEFAULT_NAME;
    public String Description = DEFAULT_DESCRIPTION;
    public String DatabasePath = DEFAULT_DB_SUB_PATH;
    //public float Version = (float) 1.0;
    //public int Type = TYPE_HSQLDB;
    public float Version = (float) 2.0;
    public int Type = TYPE_CSMDF;
    
}
