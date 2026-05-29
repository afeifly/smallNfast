/*
 * CustLicenseDialog.java
 *
 * Created on 2005??12??21??, ????6:32
 */
package com.cs.canalyzer.license;

import com.cs.license.License;
import com.cs.license.LicenseConst;
import com.cs.license.SendEmail;
import java.awt.Color;
import java.awt.Container;
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
import java.net.URISyntaxException;
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
public class CSMCustLicenseDialog extends javax.swing.JDialog implements ClipboardOwner {
    
    
//    private static final long serialVersionUID = LicenseConst.serialVersionUID;
    /** Creates new form  */
    public CSMCustLicenseDialog(Frame owner, License license) {
        super(owner, "License Information", true);

        this.license = license;
        myInit();
    }
    
//    //test
//        public LicenseDialog() {
// 
//        myInit();
//    }

    private void myInit() {        
        initComponents();
        //add on 20090318.
        //reason : serialnumber split with "-" by manual
        controlSerialNumber();
        if (license != null) {
            //modify on 20100416,
            if (license.getLocalID() != null) {
                jTextLocalID.setText(CAARegiestKeySaver.getLocalID());                
            }
            if (license.getSerialNumber() != null) {
                if(!"".equals(license.getSerialNumber().trim())){
                    String mysn = license.getSerialNumber();
                    String snlist[] = mysn.split("-");
                    jTextSerialNumberx.setText(snlist[0]);
                    jTextSerialNumberx1.setText(snlist[1]);
                    jTextSerialNumberx2.setText(snlist[2]);  
                }else{
                    jTextSerialNumberx.setText("");
                    jTextSerialNumberx1.setText("");
                    jTextSerialNumberx2.setText("");
                }
               
            }
            if (license.getUser() != null) {
                jTextUserName.setText(license.getUser());
               
            }
            if (license.getCompany() != null) {
                jTextCompany.setText(license.getCompany());
               
            }
            
             //add by be,20081229.
            if (license.getEmail() != null) {
                jTextEmail.setText(license.getEmail());
               
            }
            String key = license.getLicenseKey();
            //if ( key != null && key.compareTo(License.DEFAULT_LICENSE_KEY) != 0 )
            if (key != null) {
                jTextLicenseKey.setText(key);
                
            }
        }
        //if the PC had registered, the registration button can't used.
        // if not , the online registration button can't used utill input valid online registration information .
        //add by be,20081230.Customer requestion.       
        if (LicenseConst.IS_HAD_REG) {
            btnOnlineReg.setEnabled(false);
            isEable(false);
           // JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("had_registered"));
        } else {
            btnOnlineReg.setEnabled(false);
            isEable(true);
        }
        
        //add on 20090609.
        //reason : new requirement: Don't have online registration function .
        //method : input a image.
        this.jLabel12.setVisible(false);
        this.jLabel13.setVisible(false);
        this.jPanelRegtype1brode.setVisible(false);
        this.jLabel3.setIcon(new ImageIcon("registrationimage.jpg"));

        //add on 20090610.
        //reason : new requirement : show email address where offline registration send to.
        //method : configure this email address into info.cus file and read it to show.
        if(LicenseConst.REGISTRATION_SENDEMAILTO != null){           
            this.jLabelSendemail.setText(ResourceBundle.getBundle("com/cs/cslibText").getString("Please_send_email_to")+LicenseConst.REGISTRATION_SENDEMAILTO);
        }else{
            this.jLabelSendemail.setVisible(false);
        }

      
        setIconImage(new ImageIcon(getClass().getResource(LicenseConst.IMAGE_PATH + LicenseConst.LOGO_FILE_NAME)).getImage());

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
        jPanel5 = new javax.swing.JPanel();
        jLabel6 = new javax.swing.JLabel();
        jTextSerialNumber = new javax.swing.JTextField();
        jLabel10 = new javax.swing.JLabel();
        jTextUserName = new javax.swing.JTextField();
        jLabel17 = new javax.swing.JLabel();
        jTextSerialNumber1 = new javax.swing.JTextField();
        jTextSerialNumber2 = new javax.swing.JTextField();
        jLabel19 = new javax.swing.JLabel();
        jLabel20 = new javax.swing.JLabel();
        jPanel10 = new javax.swing.JPanel();
        btnOnlineReg = new javax.swing.JButton();
        jLabel18 = new javax.swing.JLabel();
        jTextEmail = new javax.swing.JTextField();
        jPanel6 = new javax.swing.JPanel();
        jLabel14 = new javax.swing.JLabel();
        jTextCompany = new javax.swing.JTextField();
        jPanel7 = new javax.swing.JPanel();
        jLabel15 = new javax.swing.JLabel();
        jTextCompany1 = new javax.swing.JTextField();
        jPanel8 = new javax.swing.JPanel();
        jLabel7 = new javax.swing.JLabel();
        jTextSerialNumber3 = new javax.swing.JTextField();
        jLabel11 = new javax.swing.JLabel();
        jTextUserName1 = new javax.swing.JTextField();
        jLabel21 = new javax.swing.JLabel();
        jTextSerialNumber4 = new javax.swing.JTextField();
        jTextSerialNumber5 = new javax.swing.JTextField();
        jLabel22 = new javax.swing.JLabel();
        jLabel23 = new javax.swing.JLabel();
        jPanel11 = new javax.swing.JPanel();
        btnOnlineReg1 = new javax.swing.JButton();
        jLabel24 = new javax.swing.JLabel();
        jTextEmail1 = new javax.swing.JTextField();
        jPanel9 = new javax.swing.JPanel();
        jLabel16 = new javax.swing.JLabel();
        jTextCompany2 = new javax.swing.JTextField();
        jPanel12 = new javax.swing.JPanel();
        btnOnlineReg2 = new javax.swing.JButton();
        jLabel25 = new javax.swing.JLabel();
        jTextEmail2 = new javax.swing.JTextField();
        jPanel13 = new javax.swing.JPanel();
        jLabel8 = new javax.swing.JLabel();
        jTextSerialNumber6 = new javax.swing.JTextField();
        jLabel26 = new javax.swing.JLabel();
        jTextUserName2 = new javax.swing.JTextField();
        jLabel27 = new javax.swing.JLabel();
        jTextSerialNumber7 = new javax.swing.JTextField();
        jTextSerialNumber8 = new javax.swing.JTextField();
        jLabel28 = new javax.swing.JLabel();
        jLabel29 = new javax.swing.JLabel();
        jPanel14 = new javax.swing.JPanel();
        jLabel30 = new javax.swing.JLabel();
        jTextCompany3 = new javax.swing.JTextField();
        jPanel15 = new javax.swing.JPanel();
        btnOnlineReg3 = new javax.swing.JButton();
        jLabel31 = new javax.swing.JLabel();
        jTextEmail3 = new javax.swing.JTextField();
        jPanel16 = new javax.swing.JPanel();
        jLabel32 = new javax.swing.JLabel();
        jTextSerialNumber9 = new javax.swing.JTextField();
        jLabel33 = new javax.swing.JLabel();
        jTextUserName3 = new javax.swing.JTextField();
        jLabel34 = new javax.swing.JLabel();
        jTextSerialNumber10 = new javax.swing.JTextField();
        jTextSerialNumber11 = new javax.swing.JTextField();
        jLabel35 = new javax.swing.JLabel();
        jLabel36 = new javax.swing.JLabel();
        jPanel17 = new javax.swing.JPanel();
        jLabel37 = new javax.swing.JLabel();
        jTextSerialNumber12 = new javax.swing.JTextField();
        jLabel38 = new javax.swing.JLabel();
        jTextUserName4 = new javax.swing.JTextField();
        jLabel39 = new javax.swing.JLabel();
        jTextSerialNumber13 = new javax.swing.JTextField();
        jTextSerialNumber14 = new javax.swing.JTextField();
        jLabel40 = new javax.swing.JLabel();
        jLabel41 = new javax.swing.JLabel();
        jPanel18 = new javax.swing.JPanel();
        jLabel42 = new javax.swing.JLabel();
        jTextCompany4 = new javax.swing.JTextField();
        jPanel19 = new javax.swing.JPanel();
        jLabel43 = new javax.swing.JLabel();
        jTextSerialNumber15 = new javax.swing.JTextField();
        jLabel44 = new javax.swing.JLabel();
        jTextUserName5 = new javax.swing.JTextField();
        jLabel45 = new javax.swing.JLabel();
        jTextSerialNumber16 = new javax.swing.JTextField();
        jTextSerialNumber17 = new javax.swing.JTextField();
        jLabel46 = new javax.swing.JLabel();
        jLabel47 = new javax.swing.JLabel();
        jPanel20 = new javax.swing.JPanel();
        jLabel48 = new javax.swing.JLabel();
        jTextCompany5 = new javax.swing.JTextField();
        jPanel21 = new javax.swing.JPanel();
        btnOnlineReg4 = new javax.swing.JButton();
        jLabel49 = new javax.swing.JLabel();
        jTextEmail4 = new javax.swing.JTextField();
        jPanel22 = new javax.swing.JPanel();
        btnOnlineReg5 = new javax.swing.JButton();
        jLabel50 = new javax.swing.JLabel();
        jTextEmail5 = new javax.swing.JTextField();
        jLabel13 = new javax.swing.JLabel();
        jLabel3 = new javax.swing.JLabel();
        jPanelRegtype2 = new javax.swing.JPanel();
        jLabel4 = new javax.swing.JLabel();
        jLabel9 = new javax.swing.JLabel();
        jTextLocalID = new javax.swing.JTextField();
        jPanel1 = new javax.swing.JPanel();
        jLabel5 = new javax.swing.JLabel();
        jTextLicenseKey = new javax.swing.JTextField();
        btnOffLineReg = new javax.swing.JButton();
        jLabelSendemail = new javax.swing.JLabel();
        jTextSerialNumberx2 = new javax.swing.JTextField();
        jLabel52 = new javax.swing.JLabel();
        jTextSerialNumberx1 = new javax.swing.JTextField();
        jLabel53 = new javax.swing.JLabel();
        jTextSerialNumberx = new javax.swing.JTextField();
        jLabel54 = new javax.swing.JLabel();
        jButton2 = new javax.swing.JButton();
        jPanelTitle = new javax.swing.JPanel();
        jLabel1 = new javax.swing.JLabel();

        setDefaultCloseOperation(javax.swing.WindowConstants.DO_NOTHING_ON_CLOSE);
        setTitle("License Information");
        setBackground(BACKGROUND_COLOR);

        jPanelBodyMain.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N

        jPanelRegtype1.setPreferredSize(new java.awt.Dimension(719, 220));

        jLabel12.setFont(DIALOG_FONT);
        java.util.ResourceBundle bundle = java.util.ResourceBundle.getBundle("com/cs/cslibText"); // NOI18N
        jLabel12.setText(bundle.getString("license_dialog_registertype1_showinfo")); // NOI18N

        jPanelRegtype1brode.setBorder(javax.swing.BorderFactory.createTitledBorder(null, bundle.getString("registtype1_button"), javax.swing.border.TitledBorder.DEFAULT_JUSTIFICATION, javax.swing.border.TitledBorder.DEFAULT_POSITION, new java.awt.Font("Dialog", 1, 12))); // NOI18N
        jPanelRegtype1brode.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanelRegtype1brode.setPreferredSize(new java.awt.Dimension(332, 220));

        jPanel4.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N

        unusedLocalID.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
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

        jPanelRegtype1brode.add(jPanel4);

        jPanel5.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel5.setPreferredSize(new java.awt.Dimension(20, 43));

        jLabel6.setFont(DIALOG_FONT);
        jLabel6.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel6.setText(bundle.getString("Serial_Number:")); // NOI18N
        jLabel6.setHorizontalTextPosition(javax.swing.SwingConstants.RIGHT);

        jTextSerialNumber.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumberKeyPressed(evt);
            }
        });

        jLabel10.setFont(DIALOG_FONT);
        jLabel10.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel10.setText(bundle.getString("User_Name")); // NOI18N

        jTextUserName.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextUserName.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextUserName.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextUserNameKeyPressed(evt);
            }
        });

        jLabel17.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel17.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel17.setText("-");

        jTextSerialNumber1.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber1.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber1.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber1KeyPressed(evt);
            }
        });

        jTextSerialNumber2.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber2.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber2.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber2KeyPressed(evt);
            }
        });

        jLabel19.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel19.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel19.setText("-");

        jLabel20.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel20.setText(bundle.getString("12_digits")); // NOI18N

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
                .add(jLabel20, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 51, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(1189, 1189, 1189)
                .add(jLabel10)
                .add(25, 25, 25)
                .add(jTextUserName, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanel5Layout.setVerticalGroup(
            jPanel5Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel5Layout.createSequentialGroup()
                .add(5, 5, 5)
                .add(jPanel5Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jTextSerialNumber1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel20)
                    .add(jLabel17)
                    .add(jTextSerialNumber2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel19)
                    .add(jTextUserName, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel10)
                    .add(jTextSerialNumber, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel6, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 19, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(18, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel5);

        jPanel10.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N

        btnOnlineReg.setFont(DIALOG_FONT);
        btnOnlineReg.setText(bundle.getString("registtype1_button")); // NOI18N
        btnOnlineReg.setPreferredSize(new java.awt.Dimension(150, 27));
        btnOnlineReg.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                btnOnlineRegActionPerformed(evt);
            }
        });

        jLabel18.setFont(DIALOG_FONT);
        jLabel18.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel18.setText(bundle.getString("Email-address:")); // NOI18N

        jTextEmail.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
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
                .add(112, 112, 112)
                .add(btnOnlineReg, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(46, 46, 46)
                .add(jLabel18)
                .add(23, 23, 23)
                .add(jTextEmail, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(17, Short.MAX_VALUE))
        );
        jPanel10Layout.setVerticalGroup(
            jPanel10Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel10Layout.createSequentialGroup()
                .add(jPanel10Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel10Layout.createSequentialGroup()
                        .add(8, 8, 8)
                        .add(jPanel10Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel18)
                            .add(jTextEmail, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                    .add(btnOnlineReg, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(15, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel10);

        jPanel6.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel6.setPreferredSize(new java.awt.Dimension(20, 43));
        jPanel6.setVerifyInputWhenFocusTarget(false);

        jLabel14.setFont(DIALOG_FONT);
        jLabel14.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel14.setText(bundle.getString("Company_Name")); // NOI18N

        jTextCompany.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextCompany.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextCompany.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextCompanyKeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel6Layout = new org.jdesktop.layout.GroupLayout(jPanel6);
        jPanel6.setLayout(jPanel6Layout);
        jPanel6Layout.setHorizontalGroup(
            jPanel6Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel6Layout.createSequentialGroup()
                .add(279, 279, 279)
                .add(jLabel14, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 107, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextCompany, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 200, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanel6Layout.setVerticalGroup(
            jPanel6Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel6Layout.createSequentialGroup()
                .add(5, 5, 5)
                .add(jPanel6Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel14)
                    .add(jTextCompany, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(18, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel6);

        jPanel7.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel7.setPreferredSize(new java.awt.Dimension(20, 43));
        jPanel7.setVerifyInputWhenFocusTarget(false);

        jLabel15.setFont(DIALOG_FONT);
        jLabel15.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel15.setText(bundle.getString("Company_Name")); // NOI18N

        jTextCompany1.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextCompany1.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextCompany1.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextCompany1KeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel7Layout = new org.jdesktop.layout.GroupLayout(jPanel7);
        jPanel7.setLayout(jPanel7Layout);
        jPanel7Layout.setHorizontalGroup(
            jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel7Layout.createSequentialGroup()
                .add(279, 279, 279)
                .add(jLabel15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 107, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextCompany1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 200, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanel7Layout.setVerticalGroup(
            jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel7Layout.createSequentialGroup()
                .add(5, 5, 5)
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel15)
                    .add(jTextCompany1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(18, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel7);

        jPanel8.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel8.setPreferredSize(new java.awt.Dimension(20, 43));

        jLabel7.setFont(DIALOG_FONT);
        jLabel7.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel7.setText(bundle.getString("Serial_Number:")); // NOI18N
        jLabel7.setHorizontalTextPosition(javax.swing.SwingConstants.RIGHT);

        jTextSerialNumber3.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber3.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber3.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber3KeyPressed(evt);
            }
        });

        jLabel11.setFont(DIALOG_FONT);
        jLabel11.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel11.setText(bundle.getString("User_Name")); // NOI18N

        jTextUserName1.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextUserName1.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextUserName1.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextUserName1KeyPressed(evt);
            }
        });

        jLabel21.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel21.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel21.setText("-");

        jTextSerialNumber4.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber4.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber4.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber4KeyPressed(evt);
            }
        });

        jTextSerialNumber5.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber5.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber5.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber5KeyPressed(evt);
            }
        });

        jLabel22.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel22.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel22.setText("-");

        jLabel23.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel23.setText(bundle.getString("12_digits")); // NOI18N

        org.jdesktop.layout.GroupLayout jPanel8Layout = new org.jdesktop.layout.GroupLayout(jPanel8);
        jPanel8.setLayout(jPanel8Layout);
        jPanel8Layout.setHorizontalGroup(
            jPanel8Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel8Layout.createSequentialGroup()
                .addContainerGap()
                .add(jLabel7, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 100, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel22)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber4, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel21)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber5, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(12, 12, 12)
                .add(jLabel23, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 51, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(1189, 1189, 1189)
                .add(jLabel11)
                .add(25, 25, 25)
                .add(jTextUserName1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanel8Layout.setVerticalGroup(
            jPanel8Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel8Layout.createSequentialGroup()
                .add(5, 5, 5)
                .add(jPanel8Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jTextSerialNumber4, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel23)
                    .add(jLabel21)
                    .add(jTextSerialNumber5, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel22)
                    .add(jTextUserName1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel11)
                    .add(jTextSerialNumber3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel7, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 19, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(18, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel8);

        jPanel11.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N

        btnOnlineReg1.setFont(DIALOG_FONT);
        btnOnlineReg1.setText(bundle.getString("registtype1_button")); // NOI18N
        btnOnlineReg1.setPreferredSize(new java.awt.Dimension(150, 27));
        btnOnlineReg1.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                btnOnlineReg1ActionPerformed(evt);
            }
        });

        jLabel24.setFont(DIALOG_FONT);
        jLabel24.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel24.setText(bundle.getString("Email-address:")); // NOI18N

        jTextEmail1.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextEmail1.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextEmail1.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextEmail1KeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel11Layout = new org.jdesktop.layout.GroupLayout(jPanel11);
        jPanel11.setLayout(jPanel11Layout);
        jPanel11Layout.setHorizontalGroup(
            jPanel11Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel11Layout.createSequentialGroup()
                .add(112, 112, 112)
                .add(btnOnlineReg1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(46, 46, 46)
                .add(jLabel24)
                .add(23, 23, 23)
                .add(jTextEmail1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(17, Short.MAX_VALUE))
        );
        jPanel11Layout.setVerticalGroup(
            jPanel11Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel11Layout.createSequentialGroup()
                .add(jPanel11Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel11Layout.createSequentialGroup()
                        .add(8, 8, 8)
                        .add(jPanel11Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel24)
                            .add(jTextEmail1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                    .add(btnOnlineReg1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(15, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel11);

        jPanel9.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel9.setPreferredSize(new java.awt.Dimension(20, 43));
        jPanel9.setVerifyInputWhenFocusTarget(false);

        jLabel16.setFont(DIALOG_FONT);
        jLabel16.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel16.setText(bundle.getString("Company_Name")); // NOI18N

        jTextCompany2.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextCompany2.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextCompany2.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextCompany2KeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel9Layout = new org.jdesktop.layout.GroupLayout(jPanel9);
        jPanel9.setLayout(jPanel9Layout);
        jPanel9Layout.setHorizontalGroup(
            jPanel9Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel9Layout.createSequentialGroup()
                .add(279, 279, 279)
                .add(jLabel16, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 107, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextCompany2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 200, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanel9Layout.setVerticalGroup(
            jPanel9Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel9Layout.createSequentialGroup()
                .add(5, 5, 5)
                .add(jPanel9Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel16)
                    .add(jTextCompany2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(18, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel9);

        jPanel12.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N

        btnOnlineReg2.setFont(DIALOG_FONT);
        btnOnlineReg2.setText(bundle.getString("registtype1_button")); // NOI18N
        btnOnlineReg2.setPreferredSize(new java.awt.Dimension(150, 27));
        btnOnlineReg2.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                btnOnlineReg2ActionPerformed(evt);
            }
        });

        jLabel25.setFont(DIALOG_FONT);
        jLabel25.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel25.setText(bundle.getString("Email-address:")); // NOI18N

        jTextEmail2.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextEmail2.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextEmail2.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextEmail2KeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel12Layout = new org.jdesktop.layout.GroupLayout(jPanel12);
        jPanel12.setLayout(jPanel12Layout);
        jPanel12Layout.setHorizontalGroup(
            jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel12Layout.createSequentialGroup()
                .add(112, 112, 112)
                .add(btnOnlineReg2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(46, 46, 46)
                .add(jLabel25)
                .add(23, 23, 23)
                .add(jTextEmail2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(17, Short.MAX_VALUE))
        );
        jPanel12Layout.setVerticalGroup(
            jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel12Layout.createSequentialGroup()
                .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel12Layout.createSequentialGroup()
                        .add(8, 8, 8)
                        .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel25)
                            .add(jTextEmail2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                    .add(btnOnlineReg2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(15, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel12);

        jPanel13.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel13.setPreferredSize(new java.awt.Dimension(20, 43));

        jLabel8.setFont(DIALOG_FONT);
        jLabel8.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel8.setText(bundle.getString("Serial_Number:")); // NOI18N
        jLabel8.setHorizontalTextPosition(javax.swing.SwingConstants.RIGHT);

        jTextSerialNumber6.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber6.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber6.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber6KeyPressed(evt);
            }
        });

        jLabel26.setFont(DIALOG_FONT);
        jLabel26.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel26.setText(bundle.getString("User_Name")); // NOI18N

        jTextUserName2.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextUserName2.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextUserName2.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextUserName2KeyPressed(evt);
            }
        });

        jLabel27.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel27.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel27.setText("-");

        jTextSerialNumber7.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber7.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber7.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber7KeyPressed(evt);
            }
        });

        jTextSerialNumber8.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber8.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber8.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber8KeyPressed(evt);
            }
        });

        jLabel28.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel28.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel28.setText("-");

        jLabel29.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel29.setText(bundle.getString("12_digits")); // NOI18N

        org.jdesktop.layout.GroupLayout jPanel13Layout = new org.jdesktop.layout.GroupLayout(jPanel13);
        jPanel13.setLayout(jPanel13Layout);
        jPanel13Layout.setHorizontalGroup(
            jPanel13Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel13Layout.createSequentialGroup()
                .addContainerGap()
                .add(jLabel8, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 100, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber6, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel28)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber7, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel27)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber8, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(12, 12, 12)
                .add(jLabel29, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 51, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(1189, 1189, 1189)
                .add(jLabel26)
                .add(25, 25, 25)
                .add(jTextUserName2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanel13Layout.setVerticalGroup(
            jPanel13Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel13Layout.createSequentialGroup()
                .add(5, 5, 5)
                .add(jPanel13Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jTextSerialNumber7, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel29)
                    .add(jLabel27)
                    .add(jTextSerialNumber8, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel28)
                    .add(jTextUserName2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel26)
                    .add(jTextSerialNumber6, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel8, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 19, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(18, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel13);

        jPanel14.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel14.setPreferredSize(new java.awt.Dimension(20, 43));
        jPanel14.setVerifyInputWhenFocusTarget(false);

        jLabel30.setFont(DIALOG_FONT);
        jLabel30.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel30.setText(bundle.getString("Company_Name")); // NOI18N

        jTextCompany3.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextCompany3.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextCompany3.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextCompany3KeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel14Layout = new org.jdesktop.layout.GroupLayout(jPanel14);
        jPanel14.setLayout(jPanel14Layout);
        jPanel14Layout.setHorizontalGroup(
            jPanel14Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel14Layout.createSequentialGroup()
                .add(279, 279, 279)
                .add(jLabel30, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 107, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextCompany3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 200, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanel14Layout.setVerticalGroup(
            jPanel14Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel14Layout.createSequentialGroup()
                .add(5, 5, 5)
                .add(jPanel14Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel30)
                    .add(jTextCompany3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(18, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel14);

        jPanel15.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N

        btnOnlineReg3.setFont(DIALOG_FONT);
        btnOnlineReg3.setText(bundle.getString("registtype1_button")); // NOI18N
        btnOnlineReg3.setPreferredSize(new java.awt.Dimension(150, 27));
        btnOnlineReg3.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                btnOnlineReg3ActionPerformed(evt);
            }
        });

        jLabel31.setFont(DIALOG_FONT);
        jLabel31.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel31.setText(bundle.getString("Email-address:")); // NOI18N

        jTextEmail3.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextEmail3.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextEmail3.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextEmail3KeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel15Layout = new org.jdesktop.layout.GroupLayout(jPanel15);
        jPanel15.setLayout(jPanel15Layout);
        jPanel15Layout.setHorizontalGroup(
            jPanel15Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel15Layout.createSequentialGroup()
                .add(112, 112, 112)
                .add(btnOnlineReg3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(46, 46, 46)
                .add(jLabel31)
                .add(23, 23, 23)
                .add(jTextEmail3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(17, Short.MAX_VALUE))
        );
        jPanel15Layout.setVerticalGroup(
            jPanel15Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel15Layout.createSequentialGroup()
                .add(jPanel15Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel15Layout.createSequentialGroup()
                        .add(8, 8, 8)
                        .add(jPanel15Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel31)
                            .add(jTextEmail3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                    .add(btnOnlineReg3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(15, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel15);

        jPanel16.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel16.setPreferredSize(new java.awt.Dimension(20, 43));

        jLabel32.setFont(DIALOG_FONT);
        jLabel32.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel32.setText(bundle.getString("Serial_Number:")); // NOI18N
        jLabel32.setHorizontalTextPosition(javax.swing.SwingConstants.RIGHT);

        jTextSerialNumber9.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber9.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber9.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber9KeyPressed(evt);
            }
        });

        jLabel33.setFont(DIALOG_FONT);
        jLabel33.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel33.setText(bundle.getString("User_Name")); // NOI18N

        jTextUserName3.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextUserName3.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextUserName3.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextUserName3KeyPressed(evt);
            }
        });

        jLabel34.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel34.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel34.setText("-");

        jTextSerialNumber10.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber10.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber10.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber10KeyPressed(evt);
            }
        });

        jTextSerialNumber11.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber11.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber11.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber11KeyPressed(evt);
            }
        });

        jLabel35.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel35.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel35.setText("-");

        jLabel36.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel36.setText(bundle.getString("12_digits")); // NOI18N

        org.jdesktop.layout.GroupLayout jPanel16Layout = new org.jdesktop.layout.GroupLayout(jPanel16);
        jPanel16.setLayout(jPanel16Layout);
        jPanel16Layout.setHorizontalGroup(
            jPanel16Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel16Layout.createSequentialGroup()
                .addContainerGap()
                .add(jLabel32, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 100, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber9, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel35)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber10, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel34)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber11, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(12, 12, 12)
                .add(jLabel36, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 51, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(1189, 1189, 1189)
                .add(jLabel33)
                .add(25, 25, 25)
                .add(jTextUserName3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanel16Layout.setVerticalGroup(
            jPanel16Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel16Layout.createSequentialGroup()
                .add(5, 5, 5)
                .add(jPanel16Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jTextSerialNumber10, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel36)
                    .add(jLabel34)
                    .add(jTextSerialNumber11, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel35)
                    .add(jTextUserName3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel33)
                    .add(jTextSerialNumber9, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel32, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 19, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(18, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel16);

        jPanel17.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel17.setPreferredSize(new java.awt.Dimension(20, 43));

        jLabel37.setFont(DIALOG_FONT);
        jLabel37.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel37.setText(bundle.getString("Serial_Number:")); // NOI18N
        jLabel37.setHorizontalTextPosition(javax.swing.SwingConstants.RIGHT);

        jTextSerialNumber12.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber12.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber12.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber12KeyPressed(evt);
            }
        });

        jLabel38.setFont(DIALOG_FONT);
        jLabel38.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel38.setText(bundle.getString("User_Name")); // NOI18N

        jTextUserName4.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextUserName4.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextUserName4.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextUserName4KeyPressed(evt);
            }
        });

        jLabel39.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel39.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel39.setText("-");

        jTextSerialNumber13.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber13.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber13.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber13KeyPressed(evt);
            }
        });

        jTextSerialNumber14.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber14.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber14.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber14KeyPressed(evt);
            }
        });

        jLabel40.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel40.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel40.setText("-");

        jLabel41.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel41.setText(bundle.getString("12_digits")); // NOI18N

        org.jdesktop.layout.GroupLayout jPanel17Layout = new org.jdesktop.layout.GroupLayout(jPanel17);
        jPanel17.setLayout(jPanel17Layout);
        jPanel17Layout.setHorizontalGroup(
            jPanel17Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel17Layout.createSequentialGroup()
                .addContainerGap()
                .add(jLabel37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 100, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber12, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel40)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber13, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel39)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber14, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(12, 12, 12)
                .add(jLabel41, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 51, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(1189, 1189, 1189)
                .add(jLabel38)
                .add(25, 25, 25)
                .add(jTextUserName4, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanel17Layout.setVerticalGroup(
            jPanel17Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel17Layout.createSequentialGroup()
                .add(5, 5, 5)
                .add(jPanel17Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jTextSerialNumber13, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel41)
                    .add(jLabel39)
                    .add(jTextSerialNumber14, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel40)
                    .add(jTextUserName4, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel38)
                    .add(jTextSerialNumber12, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 19, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(18, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel17);

        jPanel18.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel18.setPreferredSize(new java.awt.Dimension(20, 43));
        jPanel18.setVerifyInputWhenFocusTarget(false);

        jLabel42.setFont(DIALOG_FONT);
        jLabel42.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel42.setText(bundle.getString("Company_Name")); // NOI18N

        jTextCompany4.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextCompany4.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextCompany4.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextCompany4KeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel18Layout = new org.jdesktop.layout.GroupLayout(jPanel18);
        jPanel18.setLayout(jPanel18Layout);
        jPanel18Layout.setHorizontalGroup(
            jPanel18Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel18Layout.createSequentialGroup()
                .add(279, 279, 279)
                .add(jLabel42, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 107, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextCompany4, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 200, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanel18Layout.setVerticalGroup(
            jPanel18Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel18Layout.createSequentialGroup()
                .add(5, 5, 5)
                .add(jPanel18Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel42)
                    .add(jTextCompany4, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(18, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel18);

        jPanel19.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel19.setPreferredSize(new java.awt.Dimension(20, 43));

        jLabel43.setFont(DIALOG_FONT);
        jLabel43.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel43.setText(bundle.getString("Serial_Number:")); // NOI18N
        jLabel43.setHorizontalTextPosition(javax.swing.SwingConstants.RIGHT);

        jTextSerialNumber15.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber15.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber15.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber15KeyPressed(evt);
            }
        });

        jLabel44.setFont(DIALOG_FONT);
        jLabel44.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel44.setText(bundle.getString("User_Name")); // NOI18N

        jTextUserName5.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextUserName5.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextUserName5.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextUserName5KeyPressed(evt);
            }
        });

        jLabel45.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel45.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel45.setText("-");

        jTextSerialNumber16.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber16.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber16.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber16KeyPressed(evt);
            }
        });

        jTextSerialNumber17.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumber17.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumber17.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumber17KeyPressed(evt);
            }
        });

        jLabel46.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel46.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel46.setText("-");

        jLabel47.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel47.setText(bundle.getString("12_digits")); // NOI18N

        org.jdesktop.layout.GroupLayout jPanel19Layout = new org.jdesktop.layout.GroupLayout(jPanel19);
        jPanel19.setLayout(jPanel19Layout);
        jPanel19Layout.setHorizontalGroup(
            jPanel19Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel19Layout.createSequentialGroup()
                .addContainerGap()
                .add(jLabel43, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 100, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel46)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber16, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel45)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextSerialNumber17, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(12, 12, 12)
                .add(jLabel47, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 51, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(1189, 1189, 1189)
                .add(jLabel44)
                .add(25, 25, 25)
                .add(jTextUserName5, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanel19Layout.setVerticalGroup(
            jPanel19Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel19Layout.createSequentialGroup()
                .add(5, 5, 5)
                .add(jPanel19Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jTextSerialNumber16, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel47)
                    .add(jLabel45)
                    .add(jTextSerialNumber17, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel46)
                    .add(jTextUserName5, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel44)
                    .add(jTextSerialNumber15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel43, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 19, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(18, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel19);

        jPanel20.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel20.setPreferredSize(new java.awt.Dimension(20, 43));
        jPanel20.setVerifyInputWhenFocusTarget(false);

        jLabel48.setFont(DIALOG_FONT);
        jLabel48.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel48.setText(bundle.getString("Company_Name")); // NOI18N

        jTextCompany5.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextCompany5.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextCompany5.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextCompany5KeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel20Layout = new org.jdesktop.layout.GroupLayout(jPanel20);
        jPanel20.setLayout(jPanel20Layout);
        jPanel20Layout.setHorizontalGroup(
            jPanel20Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel20Layout.createSequentialGroup()
                .add(279, 279, 279)
                .add(jLabel48, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 107, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jTextCompany5, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 200, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanel20Layout.setVerticalGroup(
            jPanel20Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel20Layout.createSequentialGroup()
                .add(5, 5, 5)
                .add(jPanel20Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel48)
                    .add(jTextCompany5, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(18, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel20);

        jPanel21.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N

        btnOnlineReg4.setFont(DIALOG_FONT);
        btnOnlineReg4.setText(bundle.getString("registtype1_button")); // NOI18N
        btnOnlineReg4.setPreferredSize(new java.awt.Dimension(150, 27));
        btnOnlineReg4.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                btnOnlineReg4ActionPerformed(evt);
            }
        });

        jLabel49.setFont(DIALOG_FONT);
        jLabel49.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel49.setText(bundle.getString("Email-address:")); // NOI18N

        jTextEmail4.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextEmail4.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextEmail4.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextEmail4KeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel21Layout = new org.jdesktop.layout.GroupLayout(jPanel21);
        jPanel21.setLayout(jPanel21Layout);
        jPanel21Layout.setHorizontalGroup(
            jPanel21Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel21Layout.createSequentialGroup()
                .add(112, 112, 112)
                .add(btnOnlineReg4, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(46, 46, 46)
                .add(jLabel49)
                .add(23, 23, 23)
                .add(jTextEmail4, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(17, Short.MAX_VALUE))
        );
        jPanel21Layout.setVerticalGroup(
            jPanel21Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel21Layout.createSequentialGroup()
                .add(jPanel21Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel21Layout.createSequentialGroup()
                        .add(8, 8, 8)
                        .add(jPanel21Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel49)
                            .add(jTextEmail4, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                    .add(btnOnlineReg4, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(15, Short.MAX_VALUE))
        );

        jPanelRegtype1brode.add(jPanel21);

        jPanel22.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N

        btnOnlineReg5.setFont(DIALOG_FONT);
        btnOnlineReg5.setText(bundle.getString("registtype1_button")); // NOI18N
        btnOnlineReg5.setPreferredSize(new java.awt.Dimension(150, 27));
        btnOnlineReg5.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                btnOnlineReg5ActionPerformed(evt);
            }
        });

        jLabel50.setFont(DIALOG_FONT);
        jLabel50.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel50.setText(bundle.getString("Email-address:")); // NOI18N

        jTextEmail5.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextEmail5.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextEmail5.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextEmail5KeyPressed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel22Layout = new org.jdesktop.layout.GroupLayout(jPanel22);
        jPanel22.setLayout(jPanel22Layout);
        jPanel22Layout.setHorizontalGroup(
            jPanel22Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel22Layout.createSequentialGroup()
                .add(112, 112, 112)
                .add(btnOnlineReg5, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(46, 46, 46)
                .add(jLabel50)
                .add(23, 23, 23)
                .add(jTextEmail5, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(17, Short.MAX_VALUE))
        );
        jPanel22Layout.setVerticalGroup(
            jPanel22Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel22Layout.createSequentialGroup()
                .add(8, 8, 8)
                .add(jPanel22Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel50)
                    .add(jTextEmail5, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
            .add(btnOnlineReg5, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
        );

        jPanelRegtype1brode.add(jPanel22);

        jLabel13.setFont(DIALOG_FONT);
        jLabel13.setText(bundle.getString("license_dialog_registertype1")); // NOI18N

        jLabel3.setFont(DIALOG_FONT);

        org.jdesktop.layout.GroupLayout jPanelRegtype1Layout = new org.jdesktop.layout.GroupLayout(jPanelRegtype1);
        jPanelRegtype1.setLayout(jPanelRegtype1Layout);
        jPanelRegtype1Layout.setHorizontalGroup(
            jPanelRegtype1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelRegtype1Layout.createSequentialGroup()
                .add(jPanelRegtype1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel13, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 10, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jPanelRegtype1Layout.createSequentialGroup()
                        .add(10, 10, 10)
                        .add(jPanelRegtype1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jPanelRegtype1Layout.createSequentialGroup()
                                .add(10, 10, 10)
                                .add(jPanelRegtype1brode, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 11, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                            .add(jPanelRegtype1Layout.createSequentialGroup()
                                .add(jLabel3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 690, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .add(26, 26, 26)
                                .add(jLabel12, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 0, Short.MAX_VALUE)))))
                .addContainerGap())
        );
        jPanelRegtype1Layout.setVerticalGroup(
            jPanelRegtype1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanelRegtype1Layout.createSequentialGroup()
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                .add(jLabel13)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel12, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 57, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanelRegtype1brode, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 168, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(112, 112, 112))
            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanelRegtype1Layout.createSequentialGroup()
                .add(jLabel3, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                .add(88, 88, 88))
        );

        jLabel4.setFont(DIALOG_FONT);
        jLabel4.setText(bundle.getString("license_dialog_registertype2_showinfo")); // NOI18N

        jLabel9.setFont(DIALOG_FONT);
        jLabel9.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel9.setText(bundle.getString("Your_Local_ID:")); // NOI18N
        jLabel9.setHorizontalTextPosition(javax.swing.SwingConstants.RIGHT);
        jLabel9.setPreferredSize(new java.awt.Dimension(180, 15));

        jTextLocalID.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextLocalID.setEnabled(false);
        jTextLocalID.setPreferredSize(new java.awt.Dimension(200, 20));

        jPanel1.setBorder(javax.swing.BorderFactory.createTitledBorder(null, bundle.getString("registtype2_button"), javax.swing.border.TitledBorder.DEFAULT_JUSTIFICATION, javax.swing.border.TitledBorder.DEFAULT_POSITION, new java.awt.Font("Dialog", 1, 12))); // NOI18N

        jLabel5.setFont(DIALOG_FONT);
        jLabel5.setText(bundle.getString("Activation_Key:")); // NOI18N

        jTextLicenseKey.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextLicenseKey.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextLicenseKey.addFocusListener(new java.awt.event.FocusAdapter() {
            public void focusLost(java.awt.event.FocusEvent evt) {
                jTextLicenseKeyFocusLost(evt);
            }
        });

        btnOffLineReg.setFont(DIALOG_FONT);
        btnOffLineReg.setText(bundle.getString("registtype2_button")); // NOI18N
        btnOffLineReg.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                btnOffLineRegActionPerformed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel1Layout = new org.jdesktop.layout.GroupLayout(jPanel1);
        jPanel1.setLayout(jPanel1Layout);
        jPanel1Layout.setHorizontalGroup(
            jPanel1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel1Layout.createSequentialGroup()
                .addContainerGap()
                .add(jLabel5)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                .add(jTextLicenseKey, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 335, Short.MAX_VALUE)
                .add(18, 18, 18)
                .add(btnOffLineReg)
                .add(48, 48, 48))
        );
        jPanel1Layout.setVerticalGroup(
            jPanel1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel1Layout.createSequentialGroup()
                .addContainerGap()
                .add(jPanel1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel5)
                    .add(jTextLicenseKey, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(btnOffLineReg))
                .addContainerGap(20, Short.MAX_VALUE))
        );

        jLabelSendemail.setFont(DIALOG_FONT);
        jLabelSendemail.setText(bundle.getString("Please_send_email_to")); // NOI18N

        jTextSerialNumberx2.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumberx2.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumberx2.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumberx2KeyPressed(evt);
            }
        });

        jLabel52.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel52.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel52.setText("-");

        jTextSerialNumberx1.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumberx1.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumberx1.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumberx1KeyPressed(evt);
            }
        });

        jLabel53.setFont(new java.awt.Font("Serif", 1, 10)); // NOI18N
        jLabel53.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel53.setText("-");

        jTextSerialNumberx.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextSerialNumberx.setPreferredSize(new java.awt.Dimension(200, 20));
        jTextSerialNumberx.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                jTextSerialNumberxKeyPressed(evt);
            }
        });

        jLabel54.setFont(DIALOG_FONT);
        jLabel54.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel54.setText(bundle.getString("Serial_Number:")); // NOI18N
        jLabel54.setHorizontalTextPosition(javax.swing.SwingConstants.RIGHT);

        org.jdesktop.layout.GroupLayout jPanelRegtype2Layout = new org.jdesktop.layout.GroupLayout(jPanelRegtype2);
        jPanelRegtype2.setLayout(jPanelRegtype2Layout);
        jPanelRegtype2Layout.setHorizontalGroup(
            jPanelRegtype2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelRegtype2Layout.createSequentialGroup()
                .addContainerGap()
                .add(jPanelRegtype2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel4, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 702, Short.MAX_VALUE)
                    .add(jPanelRegtype2Layout.createSequentialGroup()
                        .add(jPanelRegtype2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jPanel1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jPanelRegtype2Layout.createSequentialGroup()
                                .add(jLabel9, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 86, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jTextLocalID, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 175, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .add(75, 75, 75)
                                .add(jLabel54, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 100, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jTextSerialNumberx, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jLabel53)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jTextSerialNumberx1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jLabel52)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jTextSerialNumberx2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                            .add(jLabelSendemail, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 285, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))))
        );
        jPanelRegtype2Layout.setVerticalGroup(
            jPanelRegtype2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelRegtype2Layout.createSequentialGroup()
                .addContainerGap()
                .add(jPanelRegtype2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel9, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jTextLocalID, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jTextSerialNumberx1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel52)
                    .add(jTextSerialNumberx2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel53)
                    .add(jTextSerialNumberx, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel54, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 19, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                .add(jLabel4, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabelSendemail)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                .add(jPanel1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap())
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
                        .add(330, 330, 330)
                        .add(jButton2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 90, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                    .add(jPanelBodyMainLayout.createSequentialGroup()
                        .add(24, 24, 24)
                        .add(jPanelBodyMainLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jPanelRegtype2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jPanelRegtype1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 708, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))))
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
        jPanelBodyMainLayout.setVerticalGroup(
            jPanelBodyMainLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelBodyMainLayout.createSequentialGroup()
                .addContainerGap()
                .add(jPanelRegtype1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 294, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                .add(jPanelRegtype2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 191, Short.MAX_VALUE)
                .add(18, 18, 18)
                .add(jButton2)
                .add(51, 51, 51))
        );

        jPanelTitle.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N

        jLabel1.setFont(DIALOG_FONT);
        jLabel1.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabel1.setText(bundle.getString("license_dialog_showinfo1")); // NOI18N
        jLabel1.setPreferredSize(new java.awt.Dimension(139, 50));
        jLabel1.setRequestFocusEnabled(false);

        org.jdesktop.layout.GroupLayout jPanelTitleLayout = new org.jdesktop.layout.GroupLayout(jPanelTitle);
        jPanelTitle.setLayout(jPanelTitleLayout);
        jPanelTitleLayout.setHorizontalGroup(
            jPanelTitleLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanelTitleLayout.createSequentialGroup()
                .addContainerGap(23, Short.MAX_VALUE)
                .add(jLabel1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 739, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
        );
        jPanelTitleLayout.setVerticalGroup(
            jPanelTitleLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelTitleLayout.createSequentialGroup()
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                .add(jLabel1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 60, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
        );

        org.jdesktop.layout.GroupLayout layout = new org.jdesktop.layout.GroupLayout(getContentPane());
        getContentPane().setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, layout.createSequentialGroup()
                .addContainerGap(21, Short.MAX_VALUE)
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                    .add(org.jdesktop.layout.GroupLayout.LEADING, jPanelBodyMain, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                    .add(jPanelTitle, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(layout.createSequentialGroup()
                .add(jPanelTitle, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanelBodyMain, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                .addContainerGap())
        );

        pack();
    }// </editor-fold>//GEN-END:initComponents

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
        public void keyReleased(KeyEvent e){ }
   });
}
    
    private void showOnlineBtn() {
        if ((!LicenseConst.IS_HAD_REG) && realtimeCheckOnlineRegInfo()) {
            btnOnlineReg.setEnabled(true);
        }
    }

    private void btnOffLineRegActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_btnOffLineRegActionPerformed
// TODO add your handling code here:
        choice = OFFLINEREG_SELECTED;
        dispose();
    }//GEN-LAST:event_btnOffLineRegActionPerformed

    private void jTextLicenseKeyFocusLost(java.awt.event.FocusEvent evt) {//GEN-FIRST:event_jTextLicenseKeyFocusLost
// TODO add your handling code here:
//        if (LicenseConst.IS_HAD_REG) {
//            JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("had_registered"));
//            btnOffLineReg.setEnabled(false);
//            return;
//        }
//        String myLicKey = jTextLicenseKey.getText();
////        if (myLicKey == null) {
////            JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("pls_input_lickey"));
////        } else {
////            if ("".equals(myLicKey.trim())) {
////                JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("pls_input_lickey"));
////            }
////        }
    }//GEN-LAST:event_jTextLicenseKeyFocusLost

    private void jButton2ActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButton2ActionPerformed
// TODO add your handling code here:
        choice = CANCEL_SELECTED;
        dispose();
    }//GEN-LAST:event_jButton2ActionPerformed

    private void jTextEmailKeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextEmailKeyPressed
        // TODO add your handling code here:
        showOnlineBtn();
}//GEN-LAST:event_jTextEmailKeyPressed

    private void btnOnlineRegActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_btnOnlineRegActionPerformed
        // TODO add your handling code here:
        //add by be, 20081226.
        //       System.out.println("CSLib/LicenseDialog entry btnOnlineRegActionPerformed");

        if (checkOnlineRegInfo()) {
            showProgress(true);
            //         this.jTextLicenseKey.setText("");
            int myCheckCode = responseOnlineReg();
            showProgress(false);
            //logger.log(Level.INFO,"myCheckCode :"+myCheckCode);
            // System.out.println("CSLib/LicenseDialog btnOnlineRegActionPerformed myCheckCode="+myCheckCode);
            if (ONLINEREG_SUCC == myCheckCode) {
                //wirte registration table and license file.
                JOptionPane.showMessageDialog(this, ResourceBundle.getBundle("com/cs/cslibText").getString("Online_register_succ"));
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

    private void jTextCompanyKeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextCompanyKeyPressed
        // TODO add your handling code here:
        showOnlineBtn();
}//GEN-LAST:event_jTextCompanyKeyPressed

    private void jTextSerialNumber2KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber2KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber2KeyPressed

    private void jTextSerialNumber1KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber1KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber1KeyPressed

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

    private void jTextCompany1KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextCompany1KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextCompany1KeyPressed

    private void jTextSerialNumber3KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber3KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber3KeyPressed

    private void jTextUserName1KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextUserName1KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextUserName1KeyPressed

    private void jTextSerialNumber4KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber4KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber4KeyPressed

    private void jTextSerialNumber5KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber5KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber5KeyPressed

    private void btnOnlineReg1ActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_btnOnlineReg1ActionPerformed
        // TODO add your handling code here:
    }//GEN-LAST:event_btnOnlineReg1ActionPerformed

    private void jTextEmail1KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextEmail1KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextEmail1KeyPressed

    private void jTextCompany2KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextCompany2KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextCompany2KeyPressed

    private void btnOnlineReg2ActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_btnOnlineReg2ActionPerformed
        // TODO add your handling code here:
    }//GEN-LAST:event_btnOnlineReg2ActionPerformed

    private void jTextEmail2KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextEmail2KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextEmail2KeyPressed

    private void jTextSerialNumber6KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber6KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber6KeyPressed

    private void jTextUserName2KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextUserName2KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextUserName2KeyPressed

    private void jTextSerialNumber7KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber7KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber7KeyPressed

    private void jTextSerialNumber8KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber8KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber8KeyPressed

    private void jTextCompany3KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextCompany3KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextCompany3KeyPressed

    private void btnOnlineReg3ActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_btnOnlineReg3ActionPerformed
        // TODO add your handling code here:
    }//GEN-LAST:event_btnOnlineReg3ActionPerformed

    private void jTextEmail3KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextEmail3KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextEmail3KeyPressed

    private void jTextSerialNumber9KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber9KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber9KeyPressed

    private void jTextUserName3KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextUserName3KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextUserName3KeyPressed

    private void jTextSerialNumber10KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber10KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber10KeyPressed

    private void jTextSerialNumber11KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber11KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber11KeyPressed

    private void jTextSerialNumber12KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber12KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber12KeyPressed

    private void jTextUserName4KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextUserName4KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextUserName4KeyPressed

    private void jTextSerialNumber13KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber13KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber13KeyPressed

    private void jTextSerialNumber14KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber14KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber14KeyPressed

    private void jTextCompany4KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextCompany4KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextCompany4KeyPressed

    private void jTextSerialNumber15KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber15KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber15KeyPressed

    private void jTextUserName5KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextUserName5KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextUserName5KeyPressed

    private void jTextSerialNumber16KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber16KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber16KeyPressed

    private void jTextSerialNumber17KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumber17KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumber17KeyPressed

    private void jTextCompany5KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextCompany5KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextCompany5KeyPressed

    private void btnOnlineReg4ActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_btnOnlineReg4ActionPerformed
        // TODO add your handling code here:
    }//GEN-LAST:event_btnOnlineReg4ActionPerformed

    private void jTextEmail4KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextEmail4KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextEmail4KeyPressed

    private void btnOnlineReg5ActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_btnOnlineReg5ActionPerformed
        // TODO add your handling code here:
    }//GEN-LAST:event_btnOnlineReg5ActionPerformed

    private void jTextEmail5KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextEmail5KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextEmail5KeyPressed

    private void jTextSerialNumberx2KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumberx2KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumberx2KeyPressed

    private void jTextSerialNumberx1KeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumberx1KeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumberx1KeyPressed

    private void jTextSerialNumberxKeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextSerialNumberxKeyPressed
        // TODO add your handling code here:
    }//GEN-LAST:event_jTextSerialNumberxKeyPressed

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
            // URL url = new URL(LicenseConst.REQUEST_URL+"?action=OnlineReg&softtype="+LicenseConst.SOFT_TYPE+strUrlParam);
            //test url, must be delete.
          // URL url = new URL(LicenseConst.TEST_REQUEST_URL);         
            URL url = new URL(LicenseConst.REQUEST_URL); 
            strUrlParam = "action=OnlineReg&softtype="+LicenseConst.SOFT_TYPE+strUrlParam ;  
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
            return "";
        } catch (SocketTimeoutException stoe) {
            return "";
        } catch (IOException ioe) {
            return "";
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
        if (LicenseConst.RES_ONLINEREG_SUCC.equals(respCode)) {
            return ONLINEREG_SUCC;
        } else {
            if (LicenseConst.RES_SN_HAD_USED_TWO_PC.equals(respCode)) {
                return ONLINEREG_FAIL_SN_HAD_USED_TWO;
            }
            if (LicenseConst.RES_SN_INVALID.equals(respCode)) {
                return ONLINEREG_FAIL_SN_INVALID;
            }
            return ONLINEREG_FAIL_OTHERS;

        }
    }

    //show according to registration state .
    private void isEable(boolean value) {
        this.jTextCompany.setEnabled(value);
        this.jTextEmail.setEnabled(value);
        this.jTextLicenseKey.setEnabled(value);
        this.jTextSerialNumberx.setEnabled(value);
        this.jTextSerialNumberx1.setEnabled(value);
        this.jTextSerialNumberx2.setEnabled(value);
        this.jTextUserName.setEnabled(value);
        this.btnOffLineReg.setEnabled(value);

    }

    public String getEnteredLicenseKey() {
        String key = jTextLicenseKey.getText().trim();
        String resultKey = "";

        for (int i = 0; i < key.length(); i++) {
            char c = key.charAt(i);
            /*if (c < 123 && c > 96) {
            c -= 32;
            }*/
            resultKey += c;
        }

        return resultKey;
    }

    private String getLoaclId() {
        return jTextLocalID.getText().trim();
    }

    public String getSerialNumber() {
        String mysn = null;
        if(jTextSerialNumberx.getText() == null || "".equals(jTextSerialNumberx.getText().trim())){
            return null;
        }
        if(jTextSerialNumberx1.getText()== null || "".equals(jTextSerialNumberx1.getText().trim())){
             return null;
        }
        if(jTextSerialNumberx2.getText()== null || "".equals(jTextSerialNumberx2.getText().trim())){
            return null;
        }
       
        mysn = jTextSerialNumberx.getText().trim()+"-"+jTextSerialNumberx1.getText().trim()+"-"+jTextSerialNumberx2.getText().trim();
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
   
    public Container getPanelbody(){
        return this.jPanelBodyMain;
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
             isEable(false);
             this.btnOnlineReg.setEnabled(false);
             this.jButton2.setEnabled(false);
        }else{
            Color bgcolor = new Color(238,238,238);
            g2.setColor( bgcolor );
            isEable(true);
            this.btnOnlineReg.setEnabled(true);
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
    private final int WIDTH = 800;
    private final int HEIGHT = 720;
    private final int HORIZONTAL_GAP = 30;
    private final int VERTICAL_GAP = 10;
    public final static int OFFLINEREG_SELECTED = 1;
    public final static int CANCEL_SELECTED = 2;
    //add by be,20081226.
    public final static int ONLINEREG_SELECTED = 3;
    //add by be,20081229.    
    public final static int ONLINEREG_SUCC = 11;
    public final static int ONLINEREG_FAIL_SN_HAD_USED_TWO = 12;
    public final static int ONLINEREG_FAIL_SN_INVALID = 13;
    public final static int ONLINEREG_FAIL_OTHERS = 14;
    private final java.awt.Color BACKGROUND_COLOR = new java.awt.Color(169, 219, 152);
    //add on 20090617.
    //input registration information when send registration email.
    private final static String EMAIL_TITLE_2="Registration%20Request";
    private final static String EMAIL_LOCALID = "LocalID%20:%20";
    private final static String EMAIL_SN = "SerialNumber%20:%20";
    private final static String EMAIL_NAME = "UserName%20:%20";
    private final static String EMAIL_COMPANY = "CompanyName%20:%20";
    private final static String EMAIL_EMAILADDRESS = "EmailAddress%20:%20";
    
    private final Font DIALOG_FONT = new java.awt.Font("Dialog", 0, 12);
    
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton btnOffLineReg;
    private javax.swing.JButton btnOnlineReg;
    private javax.swing.JButton btnOnlineReg1;
    private javax.swing.JButton btnOnlineReg2;
    private javax.swing.JButton btnOnlineReg3;
    private javax.swing.JButton btnOnlineReg4;
    private javax.swing.JButton btnOnlineReg5;
    private javax.swing.JButton jButton2;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JLabel jLabel10;
    private javax.swing.JLabel jLabel11;
    private javax.swing.JLabel jLabel12;
    private javax.swing.JLabel jLabel13;
    private javax.swing.JLabel jLabel14;
    private javax.swing.JLabel jLabel15;
    private javax.swing.JLabel jLabel16;
    private javax.swing.JLabel jLabel17;
    private javax.swing.JLabel jLabel18;
    private javax.swing.JLabel jLabel19;
    private javax.swing.JLabel jLabel20;
    private javax.swing.JLabel jLabel21;
    private javax.swing.JLabel jLabel22;
    private javax.swing.JLabel jLabel23;
    private javax.swing.JLabel jLabel24;
    private javax.swing.JLabel jLabel25;
    private javax.swing.JLabel jLabel26;
    private javax.swing.JLabel jLabel27;
    private javax.swing.JLabel jLabel28;
    private javax.swing.JLabel jLabel29;
    private javax.swing.JLabel jLabel3;
    private javax.swing.JLabel jLabel30;
    private javax.swing.JLabel jLabel31;
    private javax.swing.JLabel jLabel32;
    private javax.swing.JLabel jLabel33;
    private javax.swing.JLabel jLabel34;
    private javax.swing.JLabel jLabel35;
    private javax.swing.JLabel jLabel36;
    private javax.swing.JLabel jLabel37;
    private javax.swing.JLabel jLabel38;
    private javax.swing.JLabel jLabel39;
    private javax.swing.JLabel jLabel4;
    private javax.swing.JLabel jLabel40;
    private javax.swing.JLabel jLabel41;
    private javax.swing.JLabel jLabel42;
    private javax.swing.JLabel jLabel43;
    private javax.swing.JLabel jLabel44;
    private javax.swing.JLabel jLabel45;
    private javax.swing.JLabel jLabel46;
    private javax.swing.JLabel jLabel47;
    private javax.swing.JLabel jLabel48;
    private javax.swing.JLabel jLabel49;
    private javax.swing.JLabel jLabel5;
    private javax.swing.JLabel jLabel50;
    private javax.swing.JLabel jLabel52;
    private javax.swing.JLabel jLabel53;
    private javax.swing.JLabel jLabel54;
    private javax.swing.JLabel jLabel6;
    private javax.swing.JLabel jLabel7;
    private javax.swing.JLabel jLabel8;
    private javax.swing.JLabel jLabel9;
    private javax.swing.JLabel jLabelSendemail;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JPanel jPanel10;
    private javax.swing.JPanel jPanel11;
    private javax.swing.JPanel jPanel12;
    private javax.swing.JPanel jPanel13;
    private javax.swing.JPanel jPanel14;
    private javax.swing.JPanel jPanel15;
    private javax.swing.JPanel jPanel16;
    private javax.swing.JPanel jPanel17;
    private javax.swing.JPanel jPanel18;
    private javax.swing.JPanel jPanel19;
    private javax.swing.JPanel jPanel20;
    private javax.swing.JPanel jPanel21;
    private javax.swing.JPanel jPanel22;
    private javax.swing.JPanel jPanel4;
    private javax.swing.JPanel jPanel5;
    private javax.swing.JPanel jPanel6;
    private javax.swing.JPanel jPanel7;
    private javax.swing.JPanel jPanel8;
    private javax.swing.JPanel jPanel9;
    private javax.swing.JPanel jPanelBodyMain;
    private javax.swing.JPanel jPanelRegtype1;
    private javax.swing.JPanel jPanelRegtype1brode;
    private javax.swing.JPanel jPanelRegtype2;
    private javax.swing.JPanel jPanelTitle;
    private javax.swing.JTextField jTextCompany;
    private javax.swing.JTextField jTextCompany1;
    private javax.swing.JTextField jTextCompany2;
    private javax.swing.JTextField jTextCompany3;
    private javax.swing.JTextField jTextCompany4;
    private javax.swing.JTextField jTextCompany5;
    private javax.swing.JTextField jTextEmail;
    private javax.swing.JTextField jTextEmail1;
    private javax.swing.JTextField jTextEmail2;
    private javax.swing.JTextField jTextEmail3;
    private javax.swing.JTextField jTextEmail4;
    private javax.swing.JTextField jTextEmail5;
    private javax.swing.JTextField jTextLicenseKey;
    private javax.swing.JTextField jTextLocalID;
    private javax.swing.JTextField jTextSerialNumber;
    private javax.swing.JTextField jTextSerialNumber1;
    private javax.swing.JTextField jTextSerialNumber10;
    private javax.swing.JTextField jTextSerialNumber11;
    private javax.swing.JTextField jTextSerialNumber12;
    private javax.swing.JTextField jTextSerialNumber13;
    private javax.swing.JTextField jTextSerialNumber14;
    private javax.swing.JTextField jTextSerialNumber15;
    private javax.swing.JTextField jTextSerialNumber16;
    private javax.swing.JTextField jTextSerialNumber17;
    private javax.swing.JTextField jTextSerialNumber2;
    private javax.swing.JTextField jTextSerialNumber3;
    private javax.swing.JTextField jTextSerialNumber4;
    private javax.swing.JTextField jTextSerialNumber5;
    private javax.swing.JTextField jTextSerialNumber6;
    private javax.swing.JTextField jTextSerialNumber7;
    private javax.swing.JTextField jTextSerialNumber8;
    private javax.swing.JTextField jTextSerialNumber9;
    private javax.swing.JTextField jTextSerialNumberx;
    private javax.swing.JTextField jTextSerialNumberx1;
    private javax.swing.JTextField jTextSerialNumberx2;
    private javax.swing.JTextField jTextUserName;
    private javax.swing.JTextField jTextUserName1;
    private javax.swing.JTextField jTextUserName2;
    private javax.swing.JTextField jTextUserName3;
    private javax.swing.JTextField jTextUserName4;
    private javax.swing.JTextField jTextUserName5;
    // End of variables declaration//GEN-END:variables
    private License license;
    // private int choice = SKIP_SELECTED;
    private int choice;
}
