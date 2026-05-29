/*
 * LicenseDialog.java
 *
 * Created on 2005��12��21��, ����6:32
 */
package com.cs.canalyzer.license;

import com.cs.license.License;
import com.cs.license.LicenseConst;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Frame;
import java.awt.Graphics2D;
import java.awt.Toolkit;
import java.awt.datatransfer.Clipboard;

import java.awt.datatransfer.ClipboardOwner;
import java.awt.datatransfer.Transferable;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.util.ResourceBundle;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.swing.ImageIcon;
import javax.swing.JOptionPane;

/**
 *
 * @author  msu
 */
public class CAALicenseDialog extends javax.swing.JDialog implements ClipboardOwner {
    
    private Logger logger = CAALicenseConst.getLogger();
//    private static final long serialVersionUID = CAALicenseConst.serialVersionUID;
    /** Creates new form LicenseDialog */
    public CAALicenseDialog(Frame owner, License license) {
        super(owner, "License Information", true);

        this.license = license;
        myInit();
    }
 

    private void myInit() {
        Level myLogLevelInfo = Level.INFO;
        String myClassName = CAALicenseDialog.class.getName();
        initComponents();

        //add on 20090318.
        //reason : serialnumber split with "-" by manual
        controlSerialNumber();
        String tmp = CAARegiestKeySaver.getLocalID();
        if(tmp!=null)
            this.license.setLocalID(tmp);
        if (license != null) {
            //modify on 20100416.
            if (license.getLocalID() != null) {
                //add on 20100805.Be.
                
                if("".equals(license.getLocalID().trim())){
                    license.setLocalID(license.calculateLocalID());
                }else{
                    String curVersion =license.getVersion();
                    if(curVersion != null){
                        curVersion =  curVersion.replace(',', '.') ;
                        if(license.getLicenseKey() != null){
                            if("".equals(license.getLicenseKey().trim()) && ("3.3".compareTo(curVersion) == 0)){
                                license.setLocalID(license.calculateLocalID());
                            }
                        }else{
                            if("3.3".compareTo(curVersion) == 0){
                                license.setLocalID(license.calculateLocalID());
                            }
                        }
                    }
                }
                jTextLocalID.setText(license.getLocalID());
            }else{
                logger.log(myLogLevelInfo,"LocalID is null.");
                license.setLocalID(license.calculateLocalID());
                jTextLocalID.setText(license.getLocalID());
            }
//            jTextLocalID.setText(License.calculateLocalID());
            logger.log(myLogLevelInfo,"LocalID-calculate :"+License.calculateLocalID());

            if (license.getSerialNumber() != null) {
                if(!"".equals(license.getSerialNumber().trim())){
                    String mysn = license.getSerialNumber();
                    String snlist[] = mysn.split("-");
                    jTextSerialNumber.setText(snlist[0]);
                    jTextSerialNumber1.setText(snlist[1]);
                    jTextSerialNumber2.setText(snlist[2]);                  
                }else{
                    jTextSerialNumber.setText("");
                    jTextSerialNumber1.setText("");
                    jTextSerialNumber2.setText("");
                }
               logger.log(myLogLevelInfo,"SerialNumber :"+license.getSerialNumber());
            }
            
            if (license.getCompany() != null) {
                jTextCompany.setText(license.getCompany());
                logger.log(myLogLevelInfo,"CompanyName :"+license.getCompany());          
            }
            
             //add by be,20081229.
            if (license.getEmail() != null) {
                jTextEmail.setText(license.getEmail());
                logger.log(myLogLevelInfo,"EmailAddress :"+license.getEmail());
            }
            if(license.getAddress()!=null)
                this.jTextAddress.setText(license.getAddress());
        }
        //if the PC had registered, the registration button can't used.
        // if not , the online registration button can't used utill input valid online registration information .
        //add by be,20081230.Customer requestion.       
        if (LicenseConst.IS_HAD_REG) {
            if (license.getUser() != null) {
                jTextUserName.setText(license.getUser());
                logger.log(myLogLevelInfo,"UserName :"+license.getUser());
            }
            registrationStatus.setText(
                    ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Registered"));
            registrationStatus.setForeground(Color.GREEN);
//            btnOnlineReg.setEnabled(false);
//            isEable(false);
           // JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("had_registered"));
        } else {
            registrationStatus.setText(
                    ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Unregistered"));
            registrationStatus.setForeground(Color.RED);
//            btnOnlineReg.setEnabled(false);
//            isEable(true);
        }

        setIconImage(new ImageIcon(getClass().getResource(CAALicenseConst.IMAGE_PATH + CAALicenseConst.LOGO_FILE_NAME)).getImage());

        Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();
        int x, y;
        x = (dim.width - WIDTH) / 2;
        y = (dim.height - HEIGHT) / 3;
        setBounds(x, y, WIDTH, HEIGHT);
    }

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jPanelBodyMain = new javax.swing.JPanel();
        jPanelRegtype1 = new javax.swing.JPanel();
        jLabel12 = new javax.swing.JLabel();
        jPanelRegtype1brode = new javax.swing.JPanel();
        jPanel4 = new javax.swing.JPanel();
        javax.swing.JLabel unusedLocalID = new javax.swing.JLabel();
        jPanel6 = new javax.swing.JPanel();
        jLabel9 = new javax.swing.JLabel();
        jTextLocalID = new javax.swing.JTextField();
        jPanel10 = new javax.swing.JPanel();
        jLabel18 = new javax.swing.JLabel();
        jTextEmail = new javax.swing.JTextField();
        btnOnlineReg = new javax.swing.JButton();
        jPanel11 = new javax.swing.JPanel();
        jLabel21 = new javax.swing.JLabel();
        jTextAddress = new javax.swing.JTextField();
        jPanel5 = new javax.swing.JPanel();
        jTextSerialNumber = new javax.swing.JTextField();
        jLabel17 = new javax.swing.JLabel();
        jTextSerialNumber1 = new javax.swing.JTextField();
        jTextSerialNumber2 = new javax.swing.JTextField();
        jLabel19 = new javax.swing.JLabel();
        jLabel20 = new javax.swing.JLabel();
        jLabel6 = new javax.swing.JLabel();
        jPanel7 = new javax.swing.JPanel();
        jLabel10 = new javax.swing.JLabel();
        jTextUserName = new javax.swing.JTextField();
        jPanel8 = new javax.swing.JPanel();
        jLabel14 = new javax.swing.JLabel();
        jTextCompany = new javax.swing.JTextField();
        registrationStatusL = new javax.swing.JLabel();
        registrationStatus = new javax.swing.JLabel();
        jButton2 = new javax.swing.JButton();

        setDefaultCloseOperation(javax.swing.WindowConstants.DO_NOTHING_ON_CLOSE);
        setTitle("License Information");
        setBackground(BACKGROUND_COLOR);

        jPanelBodyMain.setFont(new java.awt.Font("Dialog", 0, 12));

        jLabel12.setFont(DIALOG_FONT);
        java.util.ResourceBundle bundle = java.util.ResourceBundle.getBundle("com/cs/cslibText"); // NOI18N
        jLabel12.setText(bundle.getString("license_dialog_registertype1_showinfo")); // NOI18N

        jPanelRegtype1brode.setBorder(javax.swing.BorderFactory.createTitledBorder(null, bundle.getString("registtype1_button"), javax.swing.border.TitledBorder.DEFAULT_JUSTIFICATION, javax.swing.border.TitledBorder.DEFAULT_POSITION, new java.awt.Font("Dialog", 1, 12))); // NOI18N
        jPanelRegtype1brode.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanelRegtype1brode.setPreferredSize(new java.awt.Dimension(332, 220));

        jPanel4.setFont(new java.awt.Font("Dialog", 0, 12));

        unusedLocalID.setFont(new java.awt.Font("Dialog", 0, 12));
        unusedLocalID.setText("                            ");

        org.jdesktop.layout.GroupLayout jPanel4Layout = new org.jdesktop.layout.GroupLayout(jPanel4);
        jPanel4.setLayout(jPanel4Layout);
        jPanel4Layout.setHorizontalGroup(
            jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel4Layout.createSequentialGroup()
                .add(264, 264, 264)
                .add(unusedLocalID))
        );
        jPanel4Layout.setVerticalGroup(
            jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel4Layout.createSequentialGroup()
                .add(5, 5, 5)
                .add(unusedLocalID)
                .addContainerGap(21, Short.MAX_VALUE))
        );

        jPanel6.setFont(new java.awt.Font("Dialog", 0, 12));

        jLabel9.setFont(DIALOG_FONT);
        jLabel9.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel9.setText(bundle.getString("Your_Local_ID:")); // NOI18N
        jLabel9.setHorizontalTextPosition(javax.swing.SwingConstants.RIGHT);
        jLabel9.setPreferredSize(new java.awt.Dimension(180, 15));

        jTextLocalID.setFont(new java.awt.Font("Dialog", 0, 12));
        jTextLocalID.setEnabled(false);
        jTextLocalID.setPreferredSize(new java.awt.Dimension(200, 20));

        org.jdesktop.layout.GroupLayout jPanel6Layout = new org.jdesktop.layout.GroupLayout(jPanel6);
        jPanel6.setLayout(jPanel6Layout);
        jPanel6Layout.setHorizontalGroup(
            jPanel6Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel6Layout.createSequentialGroup()
                .addContainerGap()
                .add(jLabel9, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 94, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(18, 18, 18)
                .add(jTextLocalID, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 185, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanel6Layout.setVerticalGroup(
            jPanel6Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel6Layout.createSequentialGroup()
                .addContainerGap(13, Short.MAX_VALUE)
                .add(jPanel6Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel9, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jTextLocalID, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
        );

        jPanel10.setFont(new java.awt.Font("Dialog", 0, 12));

        jLabel18.setFont(DIALOG_FONT);
        jLabel18.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel18.setText(bundle.getString("Email-address:")); // NOI18N

        jTextEmail.setFont(new java.awt.Font("Dialog", 0, 12));
        jTextEmail.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextEmail.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextEmailKeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel10Layout = new org.jdesktop.layout.GroupLayout(jPanel10);
        jPanel10.setLayout(jPanel10Layout);
        jPanel10Layout.setHorizontalGroup(
            jPanel10Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel10Layout.createSequentialGroup()
                .add(jLabel18, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 106, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(18, 18, 18)
                .add(jTextEmail, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 188, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(5, Short.MAX_VALUE))
        );
        jPanel10Layout.setVerticalGroup(
            jPanel10Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel10Layout.createSequentialGroup()
                .addContainerGap(13, Short.MAX_VALUE)
                .add(jPanel10Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel18)
                    .add(jTextEmail, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
        );

        btnOnlineReg.setFont(DIALOG_FONT);
        btnOnlineReg.setText(bundle.getString("registtype1_button")); // NOI18N
        btnOnlineReg.setPreferredSize(new java.awt.Dimension(150, 27));
        btnOnlineReg.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                btnOnlineRegActionPerformed(evt);
            }
        });

        jPanel11.setFont(new java.awt.Font("Dialog", 0, 12));

        jLabel21.setFont(DIALOG_FONT);
        jLabel21.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel21.setText(bundle.getString("regaddress")); // NOI18N

        jTextAddress.setFont(new java.awt.Font("Dialog", 0, 12));
        jTextAddress.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextAddress.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jTextAddressActionPerformed(evt);
            }
        });
        jTextAddress.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextAddressKeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel11Layout = new org.jdesktop.layout.GroupLayout(jPanel11);
        jPanel11.setLayout(jPanel11Layout);
        jPanel11Layout.setHorizontalGroup(
            jPanel11Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel11Layout.createSequentialGroup()
                .addContainerGap(49, Short.MAX_VALUE)
                .add(jLabel21, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 64, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                .add(jTextAddress, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap())
        );
        jPanel11Layout.setVerticalGroup(
            jPanel11Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel11Layout.createSequentialGroup()
                .addContainerGap(13, Short.MAX_VALUE)
                .add(jPanel11Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jTextAddress, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel21)))
        );

        jPanel5.setFont(new java.awt.Font("Dialog", 0, 12));

        jTextSerialNumber.setFont(new java.awt.Font("Dialog", 0, 12));
        jTextSerialNumber.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumberKeyPressed(evt);
            }
        });

        jLabel17.setFont(new java.awt.Font("Serif", 1, 10));
        jLabel17.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel17.setText("-");

        jTextSerialNumber1.setFont(new java.awt.Font("Dialog", 0, 12));
        jTextSerialNumber1.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber1.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber1KeyPressed(evt);
            }
        });

        jTextSerialNumber2.setFont(new java.awt.Font("Dialog", 0, 12));
        jTextSerialNumber2.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber2.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber2KeyPressed(evt);
            }
        });

        jLabel19.setFont(new java.awt.Font("Serif", 1, 10));
        jLabel19.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel19.setText("-");

        jLabel20.setFont(new java.awt.Font("Serif", 1, 10));
        jLabel20.setText(bundle.getString("12_digits")); // NOI18N

        jLabel6.setFont(DIALOG_FONT);
        jLabel6.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel6.setText(bundle.getString("Serial_Number:")); // NOI18N
        jLabel6.setHorizontalTextPosition(javax.swing.SwingConstants.RIGHT);

        org.jdesktop.layout.GroupLayout jPanel5Layout = new org.jdesktop.layout.GroupLayout(jPanel5);
        jPanel5.setLayout(jPanel5Layout);
        jPanel5Layout.setHorizontalGroup(
            jPanel5Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel5Layout.createSequentialGroup()
                .addContainerGap()
                .add(jLabel6, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 100, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel19)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel17)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(12, 12, 12)
                .add(jLabel20)
                .addContainerGap(15, Short.MAX_VALUE))
        );
        jPanel5Layout.setVerticalGroup(
            jPanel5Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel5Layout.createSequentialGroup()
                .addContainerGap(13, Short.MAX_VALUE)
                .add(jPanel5Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jTextSerialNumber1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel20)
                    .add(jLabel17)
                    .add(jTextSerialNumber2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel19)
                    .add(jTextSerialNumber, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel6, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 19, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
        );

        jPanel7.setFont(new java.awt.Font("Dialog", 0, 12));

        jLabel10.setFont(DIALOG_FONT);
        jLabel10.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel10.setText(bundle.getString("User_Name")); // NOI18N

        jTextUserName.setFont(new java.awt.Font("Dialog", 0, 12));
        jTextUserName.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextUserName.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jTextUserNameActionPerformed(evt);
            }
        });
        jTextUserName.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextUserNameKeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel7Layout = new org.jdesktop.layout.GroupLayout(jPanel7);
        jPanel7.setLayout(jPanel7Layout);
        jPanel7Layout.setHorizontalGroup(
            jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel7Layout.createSequentialGroup()
                .addContainerGap(54, Short.MAX_VALUE)
                .add(jLabel10, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 51, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(18, 18, 18)
                .add(jTextUserName, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap())
        );
        jPanel7Layout.setVerticalGroup(
            jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel7Layout.createSequentialGroup()
                .addContainerGap(13, Short.MAX_VALUE)
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel10)
                    .add(jTextUserName, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
        );

        jPanel8.setFont(new java.awt.Font("Dialog", 0, 12));

        jLabel14.setFont(DIALOG_FONT);
        jLabel14.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel14.setText(bundle.getString("Company_Name")); // NOI18N

        jTextCompany.setFont(new java.awt.Font("Dialog", 0, 12));
        jTextCompany.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextCompany.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextCompanyKeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel8Layout = new org.jdesktop.layout.GroupLayout(jPanel8);
        jPanel8.setLayout(jPanel8Layout);
        jPanel8Layout.setHorizontalGroup(
            jPanel8Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel8Layout.createSequentialGroup()
                .add(jLabel14, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 113, Short.MAX_VALUE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                .add(jTextCompany, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 200, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap())
        );
        jPanel8Layout.setVerticalGroup(
            jPanel8Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel8Layout.createSequentialGroup()
                .addContainerGap(13, Short.MAX_VALUE)
                .add(jPanel8Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel14)
                    .add(jTextCompany, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
        );

        org.jdesktop.layout.GroupLayout jPanelRegtype1brodeLayout = new org.jdesktop.layout.GroupLayout(jPanelRegtype1brode);
        jPanelRegtype1brode.setLayout(jPanelRegtype1brodeLayout);
        jPanelRegtype1brodeLayout.setHorizontalGroup(
            jPanelRegtype1brodeLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelRegtype1brodeLayout.createSequentialGroup()
                .add(jPanelRegtype1brodeLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanelRegtype1brodeLayout.createSequentialGroup()
                        .add(771, 771, 771)
                        .add(jPanel4, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 545, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                    .add(jPanelRegtype1brodeLayout.createSequentialGroup()
                        .add(298, 298, 298)
                        .add(btnOnlineReg, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                    .add(jPanelRegtype1brodeLayout.createSequentialGroup()
                        .addContainerGap()
                        .add(jPanelRegtype1brodeLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING, false)
                            .add(jPanel10, 0, 317, Short.MAX_VALUE)
                            .add(org.jdesktop.layout.GroupLayout.LEADING, jPanel5, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                            .add(org.jdesktop.layout.GroupLayout.LEADING, jPanel6, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanelRegtype1brodeLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jPanel11, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                            .add(jPanelRegtype1brodeLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING, false)
                                .add(org.jdesktop.layout.GroupLayout.LEADING, jPanel7, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                                .add(org.jdesktop.layout.GroupLayout.LEADING, jPanel8, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)))))
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );

        jPanelRegtype1brodeLayout.linkSize(new java.awt.Component[] {jPanel11, jPanel7, jPanel8}, org.jdesktop.layout.GroupLayout.HORIZONTAL);

        jPanelRegtype1brodeLayout.setVerticalGroup(
            jPanelRegtype1brodeLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelRegtype1brodeLayout.createSequentialGroup()
                .addContainerGap()
                .add(jPanelRegtype1brodeLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                    .add(jPanel6, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jPanel8, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanelRegtype1brodeLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                    .add(jPanel7, 0, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                    .add(jPanel5, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanelRegtype1brodeLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                    .add(jPanel10, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jPanel11, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                .add(btnOnlineReg, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(87, 87, 87)
                .add(jPanel4, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
        );

        jPanelRegtype1brodeLayout.linkSize(new java.awt.Component[] {jPanel10, jPanel11, jPanel5, jPanel6, jPanel7, jPanel8}, org.jdesktop.layout.GroupLayout.VERTICAL);

        registrationStatusL.setFont(DIALOG_FONT);
        java.util.ResourceBundle bundle1 = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts"); // NOI18N
        registrationStatusL.setText(bundle1.getString("Status")); // NOI18N

        registrationStatus.setFont(new java.awt.Font("Dialog", 1, 14)); // NOI18N
        registrationStatus.setForeground(new java.awt.Color(153, 255, 153));
        registrationStatus.setText(bundle.getString("license_dialog_registertype1")); // NOI18N

        org.jdesktop.layout.GroupLayout jPanelRegtype1Layout = new org.jdesktop.layout.GroupLayout(jPanelRegtype1);
        jPanelRegtype1.setLayout(jPanelRegtype1Layout);
        jPanelRegtype1Layout.setHorizontalGroup(
            jPanelRegtype1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelRegtype1Layout.createSequentialGroup()
                .add(jPanelRegtype1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanelRegtype1Layout.createSequentialGroup()
                        .addContainerGap()
                        .add(jLabel12, 0, 0, Short.MAX_VALUE))
                    .add(jPanelRegtype1Layout.createSequentialGroup()
                        .add(registrationStatusL, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 46, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(registrationStatus, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 158, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                .add(15, 15, 15))
            .add(jPanelRegtype1Layout.createSequentialGroup()
                .add(jPanelRegtype1brode, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 745, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap())
        );
        jPanelRegtype1Layout.setVerticalGroup(
            jPanelRegtype1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanelRegtype1Layout.createSequentialGroup()
                .add(jPanelRegtype1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(registrationStatusL)
                    .add(registrationStatus))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                .add(jLabel12, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 57, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanelRegtype1brode, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 206, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(74, 74, 74))
        );

        jButton2.setFont(DIALOG_FONT);
        jButton2.setText(bundle.getString("Cancel")); // NOI18N
        jButton2.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButton2ActionPerformed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanelBodyMainLayout = new org.jdesktop.layout.GroupLayout(jPanelBodyMain);
        jPanelBodyMain.setLayout(jPanelBodyMainLayout);
        jPanelBodyMainLayout.setHorizontalGroup(
            jPanelBodyMainLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelBodyMainLayout.createSequentialGroup()
                .add(jPanelBodyMainLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanelBodyMainLayout.createSequentialGroup()
                        .addContainerGap()
                        .add(jPanelRegtype1, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
                    .add(jPanelBodyMainLayout.createSequentialGroup()
                        .add(340, 340, 340)
                        .add(jButton2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 90, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                .addContainerGap())
        );
        jPanelBodyMainLayout.setVerticalGroup(
            jPanelBodyMainLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelBodyMainLayout.createSequentialGroup()
                .add(18, 18, 18)
                .add(jPanelRegtype1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 312, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jButton2)
                .addContainerGap(14, Short.MAX_VALUE))
        );

        org.jdesktop.layout.GroupLayout layout = new org.jdesktop.layout.GroupLayout(getContentPane());
        getContentPane().setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(layout.createSequentialGroup()
                .addContainerGap(15, Short.MAX_VALUE)
                .add(jPanelBodyMain, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(layout.createSequentialGroup()
                .addContainerGap()
                .add(jPanelBodyMain, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(19, Short.MAX_VALUE))
        );

        pack();
    }// </editor-fold>//GEN-END:initComponents

    private void jTextSerialNumber2KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber2KeyPressed
// TODO add your handling code here:

    }//GEN-LAST:event_jTextSerialNumber2KeyPressed

    //add on 20090318.
private void controlSerialNumber(){
    //control SerialNumber
    jTextSerialNumber.addKeyListener(new KeyListener(){          
        public void keyTyped(KeyEvent e){  
            char ch = e.getKeyChar();
            if(ch < '0' || ch > '9'){
                e.consume();
            }else{
                if(jTextSerialNumber.getText().length() == 3){                
                     jTextSerialNumber1.requestFocus();
                } 
            }
        } 
        public void keyPressed(KeyEvent e){
//            if(jTextSerialNumber.getText().length() == 4){
//                jTextSerialNumber1.requestFocus();
//            }   
        }
        public void keyReleased(KeyEvent e){ }
   });
   
    jTextSerialNumber1.addKeyListener(new KeyListener(){          
        public void keyTyped(KeyEvent e){  
            char ch = e.getKeyChar();
            if(ch < '0' || ch > '9'){
                e.consume();
            }else{
                if(jTextSerialNumber1.getText().length() == 3){
                     jTextSerialNumber2.requestFocus();
                } 
            }
        } 
        public void keyPressed(KeyEvent e){}
        public void keyReleased(KeyEvent e){ }
   });
   
    jTextSerialNumber2.addKeyListener(new KeyListener(){          
        public void keyTyped(KeyEvent e){ 
            char ch = e.getKeyChar();
            if(ch < '0' || ch > '9'){
                e.consume();
            }else{
                if(jTextSerialNumber2.getText().length() == 3){                                              
                     showOnlineBtn();
                } 
                 if(jTextSerialNumber2.getText().length() == 4){                            
                     e.setKeyChar('\0');                   
                } 
            }
        } 
        public void keyPressed(KeyEvent e){ }
        public void keyReleased(KeyEvent e){
//             //check sn's digits.
//            if(jTextSerialNumber.getText().trim().length() != 3 || jTextSerialNumber.getText().trim().length() != 3 || jTextSerialNumber2.getText().trim().length() != 3){
//                //show message
//                JOptionPane.showMessageDialog(null, java.util.ResourceBundle.getBundle("com/cs/cslibText").getString("pls_input_full_sn"));
//                return;
//            }
        }
   });
}
    
    private void jTextSerialNumber1KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber1KeyPressed
// TODO add your handling code here:
       
    }//GEN-LAST:event_jTextSerialNumber1KeyPressed

    private void jTextEmailKeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextEmailKeyPressed
// TODO add your handling code here:
        showOnlineBtn();
    }//GEN-LAST:event_jTextEmailKeyPressed

    private void jTextUserNameKeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextUserNameKeyPressed
// TODO add your handling code here:
        showOnlineBtn();
    }//GEN-LAST:event_jTextUserNameKeyPressed

    private void jTextSerialNumberKeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumberKeyPressed
// TODO add your handling code here:
//        if(jTextSerialNumber.getText() != null){
//            if(jTextSerialNumber.getText().trim().length() == 4){
//                 jTextSerialNumber1.requestFocus();
//                // showOnlineBtn();
//            }
//        }
//       
        
    }//GEN-LAST:event_jTextSerialNumberKeyPressed

    private void showOnlineBtn() {
        if ((!LicenseConst.IS_HAD_REG) && realtimeCheckOnlineRegInfo()) {
//            btnOnlineReg.setEnabled(true);
        }
    }

    private void jButton2ActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButton2ActionPerformed
// TODO add your handling code here:
        choice = CANCEL_SELECTED;
        dispose();
    }//GEN-LAST:event_jButton2ActionPerformed

    private void btnOnlineRegActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_btnOnlineRegActionPerformed
// TODO add your handling code here:        
        //add by be, 20081226.
        //       System.out.println("CSLib/LicenseDialog entry btnOnlineRegActionPerformed");
       
         //check sn's digits.
        if(jTextSerialNumber.getText().trim().length() != 4 
                || jTextSerialNumber1.getText().trim().length() != 4 
                || jTextSerialNumber2.getText().trim().length() != 4){
            //show message
            JOptionPane.showMessageDialog(null, java.util.ResourceBundle.getBundle("com/cs/cslibText").getString("pls_input_full_sn"));
            return;
        }
        if (LicenseConst.IS_HAD_REG) {
            if(this.getSerialNumber().equals(this.license.getSerialNumber())){
                JOptionPane.showMessageDialog(null, 
                        java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts")
                        .getString("This serial number has been successfully registered, You also can try another serial number to do register again."));
                return;
            }
        }
        
        if (checkOnlineRegInfo()) {

            showProgress(true);
            //         this.jTextLicenseKey.setText("");
            //add on 20091027. be
            //V3-14 : add non-mandatory address fields in license dialog.
            strUrlParam = strUrlParam + "&RegAddress=" + jTextAddress.getText();
            
            int myCheckCode = responseOnlineReg();
            showProgress(false);
            //logger.log(Level.INFO,"myCheckCode :"+myCheckCode);
           // System.out.println("CSLib/LicenseDialog btnOnlineRegActionPerformed myCheckCode="+myCheckCode);
            if (ONLINEREG_SUCC == myCheckCode) {
                //wirte registration table and license file.
//                JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("Online_register_succ"));
                choice = ONLINEREG_SELECTED;
                dispose();
            } else {
                if (ONLINEREG_FAIL_SN_INVALID == myCheckCode) {
                    JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("online_reg_fial_sn_invalid"));
                } else {
                    if (ONLINEREG_FAIL_SN_HAD_USED_TWO == myCheckCode) {
                        JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("online_reg_fail_sn_had_used_two"));
                    } else {
                        JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("online_reg_fail_others"));
                    }
                }
            }
        }

      //  System.out.println("CSLib/LicenseDialog entry btnOnlineRegActionPerformed this.getChoice()=" + this.getChoice());

    }//GEN-LAST:event_btnOnlineRegActionPerformed

    private void jTextAddressKeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextAddressKeyPressed
        // TODO add your handling code here:
         showOnlineBtn();
}//GEN-LAST:event_jTextAddressKeyPressed

    private void jTextCompanyKeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextCompanyKeyPressed
        // TODO add your handling code here:
        showOnlineBtn();
}//GEN-LAST:event_jTextCompanyKeyPressed

    private void jTextUserNameActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jTextUserNameActionPerformed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextUserNameActionPerformed

    private void jTextAddressActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jTextAddressActionPerformed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextAddressActionPerformed

    //add by be, 20081226.
    //online register function
    private String strUrlParam = "";
    private int myCheckCode = 0;
    public boolean checkOnlineRegInfo() {
        //     boolean isPass = false;
        strUrlParam = "";
        String myLocalID = this.getLoaclId();
        String mySN = this.getSerialNumber();
        String myCoName = this.getComapnyName();
        String myUserName = this.getUserName();
        String myEmail = this.getEmail();
        if (checkLocalID(myLocalID)) {
            strUrlParam = "&LocalID=" + myLocalID;
        } else {
            JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("pls_input_localid"));
            return false;
        }
        if (checkSN(mySN)) {
            strUrlParam = strUrlParam + "&SerialNumber=" + mySN;
        } else {
            JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("pls_input_sn"));
            return false;
        }
        if (checkCompanyName(myCoName)) {
            strUrlParam = strUrlParam + "&RegCompanyName=" + myCoName;
        } else {
            JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("pls_input_companyname"));
            return false;
        }
        if (checkUserName(myUserName)) {
            strUrlParam = strUrlParam + "&RegUserName=" + myUserName;
        } else {
            JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("pls_input_username"));
            return false;
        }
        if (checkEmail(myEmail)) {
            strUrlParam = strUrlParam + "&RegEmail=" + myEmail;
        } else {
            JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("pls_input_email"));
            return false;
        }
        strUrlParam = strUrlParam + "&LicenseKey=" + License.calculateLicenseKey(myLocalID);
        return true;
    }

    //real check information to control register button.
    private boolean realtimeCheckOnlineRegInfo() {
        String myLocalID = this.getLoaclId();
        String mySN = this.getSerialNumber();
        String myCoName = this.getComapnyName();
        String myUserName = this.getUserName();
        String myEmail = this.getEmail();
        if (!checkLocalID(myLocalID)) {
            return false;
        }

        if (mySN == null) {
            return false;
        }
        if ("".equals(mySN.trim())) {
            return false;
        }

        if (!checkCompanyName(myCoName)) {
            return false;
        }
        if (!checkUserName(myUserName)) {
            return false;
        }
        if (myEmail == null) {
            return false;
        }
        if ("".equals(myEmail.trim())) {
            return false;
        }

        return true;
    }

    private boolean checkLocalID(String text) {
        if (text == null) {
            return false;
        }
        if ("".equals(text.trim())) {
            return false;
        }
        return true;
    }

    private boolean checkSN(String text) {
        if (text == null) {
            return false;
        }
        if ("".equals(text.trim())) {
            return false;
        }
//        if (text.trim().length() != 15) {
//            return false;
//        }
        return true;
    }

    private boolean checkCompanyName(String text) {
        if (text == null) {
            return false;
        }
        if ("".equals(text.trim())) {
            return false;
        }
        return true;
    }

    private boolean checkUserName(String text) {
        if (text == null) {
            return false;
        }
        if ("".equals(text.trim())) {
            return false;
        }
        return true;
    }

    public boolean checkEmail(String text) {
        if (text == null) {
            return false;
        }
        if ("".equals(text.trim())) {
            return false;
        }

        Pattern p = Pattern.compile("\\w+([-+.]\\w+)*@\\w+([-.]\\w+)*\\.\\w+([-.]\\w+)*");
        Matcher m = p.matcher(text);
        if (!m.find()) {
            return false;
        } else {
            return true;
        }
    }

    //send register request to license control center.
    private String sendRequest() {
        if ("".equals(strUrlParam)) {
            return "";
        }
        String myRespond = "";
        try {
            // URL url = new URL(CAALicenseConst.REQUEST_URL+"?action=OnlineReg&softtype="+CAALicenseConst.SOFT_TYPE+strUrlParam);
            //test url, must be delete.
          // URL url = new URL(CAALicenseConst.TEST_REQUEST_URL);         
            URL url = new URL(CAALicenseConst.REQUEST_URL); 
            strUrlParam = "action=OnlineReg&softtype="+CAALicenseConst.SOFT_TYPE+strUrlParam ;  
            HttpURLConnection httpUrlConnection = (HttpURLConnection) url.openConnection();
            httpUrlConnection.setDoOutput(true);
            httpUrlConnection.setRequestMethod("POST");
            OutputStreamWriter wr = new OutputStreamWriter(httpUrlConnection.getOutputStream(),"gbk");
       
            wr.write(strUrlParam);
            wr.flush();
            wr.close();
            
            //set time out.
            // httpUrlConnection.setConnectTimeout(6000);
            // httpUrlConnection.setReadTimeout();

            BufferedReader urlRespond = new BufferedReader(new InputStreamReader(httpUrlConnection.getInputStream()));
            StringBuffer line = new StringBuffer();
            while ((myRespond = urlRespond.readLine()) != null) {
                line.append(myRespond.trim());
            }
            urlRespond.close();        
            myRespond = line.toString();
        } catch (MalformedURLException murle) {
            logger.log(Level.SEVERE,"sendRequest MalformedURLException :"+murle.getMessage());
            return "EM";
        } catch (SocketTimeoutException stoe) {
            logger.log(Level.SEVERE,"sendRequest SocketTimeoutException :"+stoe.getMessage());
            return "ES";
        } catch (IOException ioe) {
            logger.log(Level.SEVERE,"sendRequest IOException :"+ioe.getMessage());
            return "EI";
        }
        return myRespond;
    }

    /**
     *online registration response message.
     *return:
     *   ONLINEREG_SUCC : register successful.
     *   ONLINEREG_FAIL_SN_HAD_USED_TWO : this serial number had been used two PCs. One serial number can been used less than two PCs. 
     *   ONLINEREG_FAIL_SN_INVALID : thsi serial number no exist.
     *   ONLINEREG_FAIL_OTHERS : other exception.
     */
    public int responseOnlineReg() {
        Level myLogLevelInfo = Level.INFO;
        String respCode = sendRequest();
       // System.out.println("CSLib/LicenseDialog responseOnlineReg respCode="+respCode);
        if (CAALicenseConst.RES_ONLINEREG_SUCC.equals(respCode)) {
            logger.log(myLogLevelInfo,"OnlineRegSucc.");
            return ONLINEREG_SUCC;
        } else {
            if (CAALicenseConst.RES_SN_HAD_USED_TWO_PC.equals(respCode)) {
               logger.log(myLogLevelInfo,"OnlineRegFail,the serial number is used already.");
                return ONLINEREG_FAIL_SN_HAD_USED_TWO;
            }
            if (CAALicenseConst.RES_SN_INVALID.equals(respCode)) {
                logger.log(myLogLevelInfo,"OnlineRegFail,the serialnumber is invalid.");
                return ONLINEREG_FAIL_SN_INVALID;
            }
            logger.log(myLogLevelInfo,"OnlineRegFail,other cases: "+respCode);
            return ONLINEREG_FAIL_OTHERS;

        }
    }

    //show according to registration state .
    private void isEable(boolean value) {
        this.jTextCompany.setEnabled(value);
        this.jTextEmail.setEnabled(value);
        this.jTextSerialNumber.setEnabled(value);
        this.jTextSerialNumber1.setEnabled(value);
        this.jTextSerialNumber2.setEnabled(value);
        this.jTextUserName.setEnabled(value);
        this.jTextAddress.setEnabled(value);//add on 20091028.be. v3-14 : add non-mandatory address fields in license dialog.

    }

//    public String getEnteredLicenseKey() {
//        String key = jTextLicenseKey.getText().trim();
//        String resultKey = "";
//        for (int i = 0; i < key.length(); i++) {
//            char c = key.charAt(i);
//            /*if (c < 123 && c > 96) {
//            c -= 32;
//            }*/
//            resultKey += c;
//        }
//        return resultKey;
//    }

    private String getLoaclId() {
        return jTextLocalID.getText().trim();
    }

    public String getSerialNumber() {
        String mysn = null;
        if(jTextSerialNumber.getText() == null || "".equals(jTextSerialNumber.getText().trim())){
            return null;
        }
        if(jTextSerialNumber1.getText()== null || "".equals(jTextSerialNumber1.getText().trim())){
             return null;
        }
        if(jTextSerialNumber2.getText()== null || "".equals(jTextSerialNumber2.getText().trim())){
            return null;
        }
        mysn = jTextSerialNumber.getText().trim()+"-"+jTextSerialNumber1.getText().trim()+"-"+jTextSerialNumber2.getText().trim();
        logger.log(Level.INFO,"getSerialNumber :"+mysn);
        return mysn;
    }

    public String getUserName() {
        return jTextUserName.getText().trim();
    }

    public String getComapnyName() {
        return jTextCompany.getText().trim();
    }

    //add by be,20081226.
    public String getEmail() {
        return jTextEmail.getText().trim();
    }

    //modify on 20091028. be
    //reason : v3-14 : add non-mandatory address field in license dialog.
    public String getAddress() {
        return jTextAddress.getText().trim();
    }
    /**
     * Empty implementation of the ClipboardOwner interface.
     */
    public void lostOwnership(Clipboard aClipboard, Transferable aContents) {
        //do nothing
    }

    public int getChoice() {
        return choice;
    }
    
    private final String GRAPHIC_REFRESH_TEXT = "Registering. Please wait ...";
    private final int GRAPHIC_REFRESH_TEXT_SIZE = 23;
    private final String FONT_NAME = "SansSerif";  
    private void showProgress(boolean value) { 
        Graphics2D g2 = (Graphics2D) getGraphics();
        if (value) {
             g2.setColor( new Color(0,153,0) );
//             isEable(false);
//             this.btnOnlineReg.setEnabled(false);
             this.jButton2.setEnabled(false);
        }else{
            Color bgcolor = new Color(238,238,238);
            g2.setColor( bgcolor );
//            isEable(true);
//            this.btnOnlineReg.setEnabled(true);
            this.jButton2.setEnabled(true);
        }
        g2.setFont( new Font( FONT_NAME, 1, GRAPHIC_REFRESH_TEXT_SIZE ));
        g2.drawString(GRAPHIC_REFRESH_TEXT,250, 310);
        

    }
    
   
    /**
     * @param args the command line arguments
     *
     */
//    public static void main(String args[]) {
//        java.awt.EventQueue.invokeLater(new Runnable() {
//            public void run() {
//                new LicenseDialog().setVisible(true);
//            }
//        });
//        
//    }
    private final static int WIDTH = 800;
    private final static int HEIGHT = 430;
    public final static int OFFLINEREG_SELECTED = 1;
    public final static int CANCEL_SELECTED = 2;
    //add by be,20081226.
    public final static int ONLINEREG_SELECTED = 3;
    //add by be,20081229.
    //   public final static int REGINFO_SUCC = 20;
//    public final static int REGINFO_FAIL_LOCALID = 21;
//    public final static int REGINFO_FAIL_SN = 22;
//    public final static int REGINFO_FAIL_COMPANYNAME = 23;
//    public final static int REGINFO_FAIL_USERNAME = 24;
//    public final static int REGINFO_FAIL_EMAIL = 25 ;
//    public final static int REGINFO_FAIL_ADDRESS = 26;
    public final static int ONLINEREG_SUCC = 11;
    public final static int ONLINEREG_FAIL_SN_HAD_USED_TWO = 12;
    public final static int ONLINEREG_FAIL_SN_INVALID = 13;
    public final static int ONLINEREG_FAIL_OTHERS = 14;
    private final java.awt.Color BACKGROUND_COLOR = new java.awt.Color(169, 219, 152);
    
    private final Font DIALOG_FONT = new java.awt.Font("Dialog", 0, 12);
    
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton btnOnlineReg;
    private javax.swing.JButton jButton2;
    private javax.swing.JLabel jLabel10;
    private javax.swing.JLabel jLabel12;
    private javax.swing.JLabel jLabel14;
    private javax.swing.JLabel jLabel17;
    private javax.swing.JLabel jLabel18;
    private javax.swing.JLabel jLabel19;
    private javax.swing.JLabel jLabel20;
    private javax.swing.JLabel jLabel21;
    private javax.swing.JLabel jLabel6;
    private javax.swing.JLabel jLabel9;
    private javax.swing.JPanel jPanel10;
    private javax.swing.JPanel jPanel11;
    private javax.swing.JPanel jPanel4;
    private javax.swing.JPanel jPanel5;
    private javax.swing.JPanel jPanel6;
    private javax.swing.JPanel jPanel7;
    private javax.swing.JPanel jPanel8;
    private javax.swing.JPanel jPanelBodyMain;
    private javax.swing.JPanel jPanelRegtype1;
    private javax.swing.JPanel jPanelRegtype1brode;
    private javax.swing.JTextField jTextAddress;
    private javax.swing.JTextField jTextCompany;
    private javax.swing.JTextField jTextEmail;
    private javax.swing.JTextField jTextLocalID;
    private javax.swing.JTextField jTextSerialNumber;
    private javax.swing.JTextField jTextSerialNumber1;
    private javax.swing.JTextField jTextSerialNumber2;
    private javax.swing.JTextField jTextUserName;
    private javax.swing.JLabel registrationStatus;
    private javax.swing.JLabel registrationStatusL;
    // End of variables declaration//GEN-END:variables
    private License license;
    // private int choice = SKIP_SELECTED;
    private int choice;
}
