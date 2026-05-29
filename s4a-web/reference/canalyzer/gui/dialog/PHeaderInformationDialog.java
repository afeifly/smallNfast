/*
 * PHeaderInformation.java
 *
 * Created on 2006年1月6日, 下午6:02
 */

package com.cs.canalyzer.gui.dialog;

import com.cs.canalyzer.gui.GUIConst;
import com.cs.canalyzer.structs.CommonValue;
import com.cs.database.CSMDF;
import com.cs.database.NChannelHeader;
import com.cs.database.NProtocolHeader;
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.Toolkit;
import java.util.ArrayList;

/**
 *
 * @author  msu
 */
public class PHeaderInformationDialog extends javax.swing.JDialog {
    
    /** Creates new form PHeaderInformation */
    public PHeaderInformationDialog( Frame owner, final NProtocolHeader pheader, 
                                            final ArrayList<NChannelHeader> chheaders ) { //, int numOfValuesPerChannel ) {
        super(owner, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("File_Information_of_") + pheader.getDescription(), true);

        this.pheader = pheader;
        this.chheaders = chheaders;
        //this.numOfValuesPerChannel = numOfValuesPerChannel;
        
        myInit();
    }
    
    private void myInit() {
        initComponents();
 
        // set header and channel information
        if ( pheader == null ) return;
        
        String text;
        text = CSMDF.DEFAULT_DATE_AND_TIME_FORMAT( pheader.StartTime );
        jLabelStartTime.setText(text);
        if ( pheader.StopTime != NProtocolHeader.DEFAULT_START_AND_END_TIME ) {
            text = CSMDF.DEFAULT_DATE_AND_TIME_FORMAT( pheader.StopTime );
            jLabelEndTime.setText(text);
        }
        text = pheader.SampleRate * pheader.SampleRateFactor / 1000 + " " + "  seconds";
        jLabelSampleRate.setText(text);
        text = String.format( "%d", pheader.NumOfSamples );
        jLabelValuesPerChannel.setText(text);
        text = pheader.getDescription();
        jLabelDesciption.setText(text);
        
        if ( chheaders == null ) return;
        
        NChannelHeader chheader;
        InfoLabel info;
        String name;
        for (int i = 0; i < chheaders.size(); i++) {
            chheader = chheaders.get(i);
            
            // hard coded for CS2390
            if ( chheader.getDescription().compareTo(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Consumption")) == 0 ) {
                    chheader.setDescription( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Consumption") );
            }
            // ******             
            //name = chheader.dname + " . " + chheader.name;
            //if (chheader.name.length() < 1) name += chheader.number;
            name = CommonValue.getViewChannelFullName( pheader, chheader );
//            name = chheader.getDescription().trim();
//            if ( name.isEmpty() )
//                name = chheader.DeviceID + "." + chheader.ChannelNumber;
            info = new InfoLabel("   "+name);
            //info.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
            jPanelName.add(info);
            info = new InfoLabel("   "+chheader.getUnitText());
            jPanelUnit.add(info);

            if(chheader.Resolution < 0) chheader.Resolution = 0;
            info = new InfoLabel( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Max:___") + String.format("%." + chheader.Resolution + "f", chheader.Max) );
            jPanelMax.add(info);
            info = new InfoLabel( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Min:___") + String.format("%." + chheader.Resolution + "f", chheader.Min) );
            jPanelMin.add(info);
        }
        
        Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();
//        int height  = NORTH_PANEL_HEIGHT + SOUTH_PANEL_HEIGHT + chheaders.size() * HEIGHT_PER_CHANNEL + CENTER_HEIGHT;
        int height = 600;
        setBounds( (dim.width - WIDTH) / 2, (dim.height - height) / 2, WIDTH, height);
        
//        this.getGlassPane().addMouseListener( new java.awt.event.MouseAdapter() {
//            public void mouseReleased(java.awt.event.MouseEvent evt) {
//                closeWindow();
//            }
//        });
        this.getGlassPane().setVisible( true );
        
        //int width = jPanelChannels.getWidth() * 3 / 4;
        //jPanelEast.setSize( new Dimension( width, 0 ));
        jButtonOK.setVisible( false );
    }

    private void closeWindow() {
        this.dispose();
    }
    
    /** when reading from the device, 'min' and 'max' values are not available
     */
    public void setMinAndMaxInvisible() {
        //jPanelMin.setVisible( false );
        //jPanelMax.setVisible( false );
        jPanelChannels.remove( jPanelMin );
        jPanelChannels.remove( jPanelMax );
    }
       
    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jLabel6 = new javax.swing.JLabel();
        jPanelNorth = new javax.swing.JPanel();
        jLabel1 = new javax.swing.JLabel();
        jPanel1 = new javax.swing.JPanel();
        jPanel2 = new javax.swing.JPanel();
        jLabel2 = new javax.swing.JLabel();
        jLabel3 = new javax.swing.JLabel();
        jLabelStartTime = new javax.swing.JLabel();
        jPanel4 = new javax.swing.JPanel();
        jLabel5 = new javax.swing.JLabel();
        jLabel4 = new javax.swing.JLabel();
        jLabelEndTime = new javax.swing.JLabel();
        jPanel5 = new javax.swing.JPanel();
        jLabel8 = new javax.swing.JLabel();
        jLabel9 = new javax.swing.JLabel();
        jLabelSampleRate = new javax.swing.JLabel();
        jPanel11 = new javax.swing.JPanel();
        jLabel13 = new javax.swing.JLabel();
        jLabel16 = new javax.swing.JLabel();
        jLabelValuesPerChannel = new javax.swing.JLabel();
        jPanel6 = new javax.swing.JPanel();
        jLabel11 = new javax.swing.JLabel();
        jLabel12 = new javax.swing.JLabel();
        jLabelDesciption = new javax.swing.JLabel();
        jPanel7 = new javax.swing.JPanel();
        jPanel8 = new javax.swing.JPanel();
        jLabel14 = new javax.swing.JLabel();
        jLabel15 = new javax.swing.JLabel();
        jPanel3 = new javax.swing.JPanel();
        jButtonOK = new javax.swing.JButton();
        jPanel10 = new javax.swing.JPanel();
        jPanel9 = new javax.swing.JPanel();
        jScrollPane1 = new javax.swing.JScrollPane();
        jPanelChannels = new javax.swing.JPanel();
        jPanelName = new javax.swing.JPanel();
        jPanelUnit = new javax.swing.JPanel();
        jPanelMin = new javax.swing.JPanel();
        jPanelMax = new javax.swing.JPanel();

        jLabel6.setFont(new java.awt.Font("Dialog", 1, 12));
        java.util.ResourceBundle bundle = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts"); // NOI18N
        jLabel6.setText(bundle.getString("End_Time:")); // NOI18N
        jLabel6.setPreferredSize(new java.awt.Dimension(130, 15));

        setDefaultCloseOperation(javax.swing.WindowConstants.DISPOSE_ON_CLOSE);
        setTitle(bundle.getString("Record_File_Information")); // NOI18N

        jPanelNorth.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanelNorth.setPreferredSize(new java.awt.Dimension(10, 225));
        jPanelNorth.setLayout(new java.awt.GridLayout(9, 1));

        jLabel1.setFont(new java.awt.Font("Dialog", 1, 14));
        jLabel1.setForeground(new java.awt.Color(0, 153, 0));
        jLabel1.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabel1.setText(bundle.getString("Record_File_Information")); // NOI18N
        jLabel1.setVerticalAlignment(javax.swing.SwingConstants.BOTTOM);
        jPanelNorth.add(jLabel1);

        jPanel1.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanelNorth.add(jPanel1);

        jPanel2.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanel2.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT));

        jLabel2.setFont(new java.awt.Font("Dialog", 0, 12));
        jLabel2.setText("  ");
        jLabel2.setPreferredSize(new java.awt.Dimension(50, 15));
        jPanel2.add(jLabel2);

        jLabel3.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel3.setText(bundle.getString("Start_Time:")); // NOI18N
        jLabel3.setPreferredSize(new java.awt.Dimension(130, 15));
        jPanel2.add(jLabel3);

        jLabelStartTime.setFont(new java.awt.Font("Dialog", 0, 12));
        jLabelStartTime.setText(".");
        jPanel2.add(jLabelStartTime);

        jPanelNorth.add(jPanel2);

        jPanel4.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanel4.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT));

        jLabel5.setFont(new java.awt.Font("Dialog", 0, 12));
        jLabel5.setText("  ");
        jLabel5.setPreferredSize(new java.awt.Dimension(50, 15));
        jPanel4.add(jLabel5);

        jLabel4.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel4.setText(bundle.getString("End_Time:")); // NOI18N
        jLabel4.setPreferredSize(new java.awt.Dimension(130, 15));
        jPanel4.add(jLabel4);

        jLabelEndTime.setFont(new java.awt.Font("Dialog", 0, 12));
        jLabelEndTime.setText(".");
        jPanel4.add(jLabelEndTime);

        jPanelNorth.add(jPanel4);

        jPanel5.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanel5.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT));

        jLabel8.setFont(new java.awt.Font("Dialog", 0, 12));
        jLabel8.setText("  ");
        jLabel8.setPreferredSize(new java.awt.Dimension(50, 15));
        jPanel5.add(jLabel8);

        jLabel9.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel9.setText(bundle.getString("Sample_Rate:")); // NOI18N
        jLabel9.setPreferredSize(new java.awt.Dimension(130, 15));
        jPanel5.add(jLabel9);

        jLabelSampleRate.setFont(new java.awt.Font("Dialog", 0, 12));
        jLabelSampleRate.setText(".");
        jPanel5.add(jLabelSampleRate);

        jPanelNorth.add(jPanel5);

        jPanel11.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanel11.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT));

        jLabel13.setFont(new java.awt.Font("Dialog", 0, 12));
        jLabel13.setText("  ");
        jLabel13.setPreferredSize(new java.awt.Dimension(50, 15));
        jPanel11.add(jLabel13);

        jLabel16.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel16.setText(bundle.getString("Values_Per_Channel:")); // NOI18N
        jLabel16.setPreferredSize(new java.awt.Dimension(130, 15));
        jPanel11.add(jLabel16);

        jLabelValuesPerChannel.setFont(new java.awt.Font("Dialog", 0, 12));
        jLabelValuesPerChannel.setText(".");
        jPanel11.add(jLabelValuesPerChannel);

        jPanelNorth.add(jPanel11);

        jPanel6.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanel6.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT));

        jLabel11.setFont(new java.awt.Font("Dialog", 0, 12));
        jLabel11.setText("  ");
        jLabel11.setPreferredSize(new java.awt.Dimension(50, 15));
        jPanel6.add(jLabel11);

        jLabel12.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel12.setText(bundle.getString("Description")); // NOI18N
        jLabel12.setPreferredSize(new java.awt.Dimension(130, 15));
        jPanel6.add(jLabel12);

        jLabelDesciption.setFont(new java.awt.Font("Dialog", 0, 12));
        jLabelDesciption.setText(".");
        jPanel6.add(jLabelDesciption);

        jPanelNorth.add(jPanel6);

        jPanel7.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanel7.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT));
        jPanelNorth.add(jPanel7);

        jPanel8.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanel8.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT));

        jLabel14.setFont(new java.awt.Font("Dialog", 0, 12));
        jLabel14.setText("  ");
        jLabel14.setPreferredSize(new java.awt.Dimension(50, 15));
        jPanel8.add(jLabel14);

        jLabel15.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel15.setText(bundle.getString("Channel_Information:")); // NOI18N
        jLabel15.setPreferredSize(new java.awt.Dimension(130, 15));
        jPanel8.add(jLabel15);

        jPanelNorth.add(jPanel8);

        getContentPane().add(jPanelNorth, java.awt.BorderLayout.NORTH);

        jPanel3.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanel3.setPreferredSize(new java.awt.Dimension(10, SOUTH_PANEL_HEIGHT));

        jButtonOK.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jButtonOK.setText(bundle.getString("OK")); // NOI18N
        jButtonOK.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonOKActionPerformed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel3Layout = new org.jdesktop.layout.GroupLayout(jPanel3);
        jPanel3.setLayout(jPanel3Layout);
        jPanel3Layout.setHorizontalGroup(
            jPanel3Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel3Layout.createSequentialGroup()
                .add(383, 383, 383)
                .add(jButtonOK, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 79, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(65, Short.MAX_VALUE))
        );
        jPanel3Layout.setVerticalGroup(
            jPanel3Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel3Layout.createSequentialGroup()
                .addContainerGap()
                .add(jButtonOK, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 34, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap())
        );

        getContentPane().add(jPanel3, java.awt.BorderLayout.SOUTH);
        getContentPane().add(jPanel10, java.awt.BorderLayout.LINE_START);
        getContentPane().add(jPanel9, java.awt.BorderLayout.LINE_END);

        jPanelChannels.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanelChannels.setLayout(new java.awt.GridLayout());

        jPanelName.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanelName.setLayout(new java.awt.GridLayout(0, 1));
        jPanelChannels.add(jPanelName);

        jPanelUnit.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanelUnit.setLayout(new java.awt.GridLayout(0, 1));
        jPanelChannels.add(jPanelUnit);

        jPanelMin.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanelMin.setLayout(new java.awt.GridLayout(0, 1));
        jPanelChannels.add(jPanelMin);

        jPanelMax.setFont(new java.awt.Font("Dialog", 0, 12));
        jPanelMax.setLayout(new java.awt.GridLayout(0, 1));
        jPanelChannels.add(jPanelMax);

        jScrollPane1.setViewportView(jPanelChannels);

        getContentPane().add(jScrollPane1, java.awt.BorderLayout.CENTER);

        pack();
    }// </editor-fold>//GEN-END:initComponents

    private void jButtonOKActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonOKActionPerformed
        // TODO add your handling code here:
        this.dispose();
    }//GEN-LAST:event_jButtonOKActionPerformed

    
    private final int NORTH_PANEL_HEIGHT = 225;
    private final int SOUTH_PANEL_HEIGHT = 30;
    private final int CENTER_HEIGHT = 90;
    private final int EAST_PANEL_WIDTH = 270;
    private final int HEIGHT_PER_CHANNEL = 30;
    private final int WIDTH = 600;
    
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton jButtonOK;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JLabel jLabel11;
    private javax.swing.JLabel jLabel12;
    private javax.swing.JLabel jLabel13;
    private javax.swing.JLabel jLabel14;
    private javax.swing.JLabel jLabel15;
    private javax.swing.JLabel jLabel16;
    private javax.swing.JLabel jLabel2;
    private javax.swing.JLabel jLabel3;
    private javax.swing.JLabel jLabel4;
    private javax.swing.JLabel jLabel5;
    private javax.swing.JLabel jLabel6;
    private javax.swing.JLabel jLabel8;
    private javax.swing.JLabel jLabel9;
    private javax.swing.JLabel jLabelDesciption;
    private javax.swing.JLabel jLabelEndTime;
    private javax.swing.JLabel jLabelSampleRate;
    private javax.swing.JLabel jLabelStartTime;
    private javax.swing.JLabel jLabelValuesPerChannel;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JPanel jPanel10;
    private javax.swing.JPanel jPanel11;
    private javax.swing.JPanel jPanel2;
    private javax.swing.JPanel jPanel3;
    private javax.swing.JPanel jPanel4;
    private javax.swing.JPanel jPanel5;
    private javax.swing.JPanel jPanel6;
    private javax.swing.JPanel jPanel7;
    private javax.swing.JPanel jPanel8;
    private javax.swing.JPanel jPanel9;
    private javax.swing.JPanel jPanelChannels;
    private javax.swing.JPanel jPanelMax;
    private javax.swing.JPanel jPanelMin;
    private javax.swing.JPanel jPanelName;
    private javax.swing.JPanel jPanelNorth;
    private javax.swing.JPanel jPanelUnit;
    private javax.swing.JScrollPane jScrollPane1;
    // End of variables declaration//GEN-END:variables
    
    private NProtocolHeader pheader;
    private ArrayList<NChannelHeader> chheaders ;
    //private int numOfValuesPerChannel;
    
    
private class InfoLabel extends javax.swing.JLabel {
    public InfoLabel(String text) {
        setFont(new java.awt.Font( "Dialog Input", 0, 11));
        setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        setText(text);        
    }
}        
    
}
