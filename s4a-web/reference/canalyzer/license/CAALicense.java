package com.cs.canalyzer.license;

import com.cs.license.License;
import java.util.Calendar;

/**
 *
 * @author ethan
 */
public class CAALicense extends License {

    public final static String REG_VALUE_REGISTRATION_DATE = "RegistrationDate";
    public final static String REG_VALUE_SOFTWARE_VERSION = "SoftwareVersion";
    
    private Calendar registrationDate;
    private String softwareVersion;   
    
    public CAALicense() {

    }
    public Calendar getRegistrationDate() {
        return registrationDate;
    }
    public void setRegistrationDate(Calendar registrationDate) {
        this.registrationDate = registrationDate;
    }
    public String getSoftwareVersion() {
        return softwareVersion;
    }

    public void setSoftwareVersion(String softwareVersion) {
        this.softwareVersion = softwareVersion;
    }
    public static CAALicense createCSMLicenseFromOldLicense(License oldlic){

        CAALicense csmlic = new CAALicense();
        csmlic.setAddress(oldlic.getAddress());
        csmlic.setCompany(oldlic.getCompany());
        csmlic.setCreateDate(oldlic.getCreateDate());
        csmlic.setEmail(oldlic.getEmail());
        csmlic.setInstallationDate(oldlic.getInstallationDate());
        csmlic.setLicenseFilePath(oldlic.getLicenseFilePath());
        csmlic.setLicenseKey(oldlic.getLicenseKey());
        csmlic.setLocalID(oldlic.getLocalID());
//        csmlic.setRegistrationDate(registrationDate);
        csmlic.setSerialNumber(oldlic.getSerialNumber());
        csmlic.setUser(oldlic.getUser());
        csmlic.setVersion(oldlic.getVersion());          
        return csmlic;
    }
   
}
