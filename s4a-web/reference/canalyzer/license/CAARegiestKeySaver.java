package com.cs.canalyzer.license;

import com.install4j.api.windows.RegistryRoot;
import com.install4j.api.windows.WinRegistry;

/**
 *
 * @author ex
 */
public class CAARegiestKeySaver {
    
    private static final String IDRoot = "SOFTWARE\\longstram\\#ouDSV\\lc";
    private static final String CIDNode = "cnewID";
    public static boolean saveLocalIDToRegistry(String localID) {
        if ( !WinRegistry.keyExists( RegistryRoot.HKEY_LOCAL_MACHINE, IDRoot )) {
            if ( !WinRegistry.createKey( RegistryRoot.HKEY_LOCAL_MACHINE, IDRoot ))
                return false;
        }
        if ( !WinRegistry.setValue( RegistryRoot.HKEY_LOCAL_MACHINE, IDRoot, CIDNode, localID))
            return false;        
        return true;
    }
    public static String getLocalID(){
        return (String) WinRegistry.getValue( RegistryRoot.HKEY_LOCAL_MACHINE,IDRoot, CIDNode );            
    } 
}
