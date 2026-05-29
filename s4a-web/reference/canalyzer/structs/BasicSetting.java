/*
 * Texts.java
 *
 * Created on 2007年4月12日, 下午6:47
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.structs;

import com.cs.canalyzer.gui.GUIConst;
import java.io.Serializable;

/**
 *
 * @author msu
 */
public class BasicSetting implements Serializable {
    
    /** Creates a new instance of Texts */
    public BasicSetting() {

    }
    
    
    public String CompanyName = "";
    public String LogoFilePath = LOGO_FILE_PATH;
    
    public String AddressLine1 = "";
    public String AddressLine2 = "";
    public String AddressLine3 = "";
    public String ResponsiblePerson = "";
    public String Phone = "";
    public String Fax = "";
    public String Email = "";
    public String Webpage = "";
            
    public String ServiceCompanyName = "";
    public String ServiceLogoFilePath = LOGO_FILE_PATH;
    
    public String ServiceAddressLine1 = "";
    public String ServiceAddressLine2 = "";
    public String ServiceAddressLine3 = "";
    public String ServiceResponsiblePerson = "";
    public String ServicePhone = "";
    public String ServiceFax = "";
    public String ServiceEmail = "";
    public String ServiceWebpage = "";
    
    public final static String LOGO_FILE_PATH = "icon.png"; 
  
}
