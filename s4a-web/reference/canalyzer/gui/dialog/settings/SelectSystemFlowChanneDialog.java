/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package com.cs.canalyzer.gui.dialog.settings;

import com.cs.canalyzer.gui.GUIConst;
import com.cs.canalyzer.structs.CommonValue;
import com.cs.canalyzer.structs.Compressor;
import com.cs.canalyzer.structs.MeasurementUnit;
import com.cs.database.CSMDF;
import com.cs.database.NChannelHeader;
import com.cs.database.NProtocolHeader;
import java.util.ArrayList;
import javax.swing.ImageIcon;
import javax.swing.JOptionPane;

/**
 *
 * @author be
 */
public class SelectSystemFlowChanneDialog extends javax.swing.JDialog {

     ArrayList<NChannelHeader> flowChannels  = new ArrayList<NChannelHeader>();
     private final int WIDTH = 350;
     private final int HEIGHT = 200;
     private NChannelHeader systemFlowChannel = null;
     private boolean isSelectOK = false;
    
    /**
     * Creates new form SelectSystemFlowChanneDialogl
     */
    public SelectSystemFlowChanneDialog(CommonValue commonValue, CSMDF DB) {
      
        initComponents();
        initValues(commonValue, DB);
        jLabelSelectFlowChannel.setText(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("select_flow_channel_for_system_analyzes") );
        
        setIconImage( new ImageIcon( getClass().getResource( GUIConst.IMAGE_PATH + GUIConst.LOGO_FILE_NAME)).getImage() );         
        this.setLocation( WIDTH, HEIGHT );
        
        if(flowChannels == null || flowChannels.size() < 1){
            jBtnOk.setVisible(false);
            isSelectOK = false;
//            JOptionPane.showMessageDialog( null, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("release_a_flow_channel_to_'System_Analyzes'") );
//            this.dispose();
        }
    }
    
    private boolean initValues(CommonValue commonValue, CSMDF DB){
        if(commonValue == null || DB == null){
            return false;
        }
 
//        boolean hasCompressor = true;
//        ArrayList<Compressor> compressors = commonValue.getCompressors();
//        if(compressors == null || compressors.isEmpty()){
//            hasCompressor = false;
//        } 
        
        try{
            String oldCompressorDes;
            String newCompressorDes;
            ArrayList<NProtocolHeader> pheaders = commonValue.getProtocolHeaders();
            ArrayList<NChannelHeader> chheaders;
//            String channelWholePath;
//            String splitChar = "_";
//            boolean isAssigned = false;
//            NChannelHeader compressorAssignFlowChannel;
//            String compressorAssignFlowChannelWholePath;
//            jCBSelectFlowChannel.addItem(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("None"));
            
            for ( NProtocolHeader pheader : pheaders ) {               
                chheaders = DB.findChannelHeaders( pheader.Pref );
                for ( NChannelHeader chheader : chheaders ) {
//                    isAssigned = false;
                    if ( MeasurementUnit.IsFlowRateUnit( chheader.getUnitText() )) {
                        
//                        //check if assigned to compressor
//                        channelWholePath = chheader.newDeviceID + splitChar + chheader.subDeviceID 
//                                + splitChar + chheader.sensorID + splitChar + chheader.channelID;
//                        if(hasCompressor){
//                            for ( Compressor compressor : compressors ) {
//                                compressorAssignFlowChannel = compressor.getAssignedFlowChannel();
//                                if(compressorAssignFlowChannel != null){
//
//                                    compressorAssignFlowChannelWholePath = compressorAssignFlowChannel.newDeviceID + splitChar + compressorAssignFlowChannel.subDeviceID 
//                                            + splitChar + compressorAssignFlowChannel.sensorID + splitChar + compressorAssignFlowChannel.channelID;
//
//                                    if(compressorAssignFlowChannelWholePath == null){
//                                        continue;
//                                    }
//                                    if(compressorAssignFlowChannelWholePath.equals(channelWholePath)){
//                                        isAssigned = true;
//                                        break;
//                                    }
//                                }                
//                            }
//                        }
//                        
//                        if(isAssigned){
//                            continue;
//                        }
                        
                        flowChannels.add( chheader );

                        oldCompressorDes = chheader.getDescription();
                        newCompressorDes = commonValue.getViewChannelFullName(pheader,chheader);
                        if(newCompressorDes == null){
                            newCompressorDes = oldCompressorDes;
                        }

                        if (newCompressorDes != null && newCompressorDes.length() > 0 )
                            jCBSelectFlowChannel.addItem( newCompressorDes );
                        else
                            jCBSelectFlowChannel.addItem( pheader.DeviceID + "." + chheader.ChannelNumber );

                    }
                }
            }
            
            jCBSelectFlowChannel.setSelectedIndex(0);
            return true;
        }catch(Exception e){
            return false;
        }
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    @SuppressWarnings("unchecked")
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jPanel1 = new javax.swing.JPanel();
        jLabelSelectFlowChannel = new javax.swing.JLabel();
        jCBSelectFlowChannel = new javax.swing.JComboBox();
        jPanel3 = new javax.swing.JPanel();
        jBtnOk = new javax.swing.JButton();
        jBtnCancel = new javax.swing.JButton();

        setDefaultCloseOperation(javax.swing.WindowConstants.DISPOSE_ON_CLOSE);
        getContentPane().setLayout(new org.netbeans.lib.awtextra.AbsoluteLayout());

        jPanel1.setLayout(new org.netbeans.lib.awtextra.AbsoluteLayout());

        jLabelSelectFlowChannel.setFont(GUIConst.DIALOG_FONT);
        jPanel1.add(jLabelSelectFlowChannel, new org.netbeans.lib.awtextra.AbsoluteConstraints(40, 10, 300, -1));

        jCBSelectFlowChannel.setFont(GUIConst.DIALOG_FONT);
        jPanel1.add(jCBSelectFlowChannel, new org.netbeans.lib.awtextra.AbsoluteConstraints(40, 40, 287, -1));

        getContentPane().add(jPanel1, new org.netbeans.lib.awtextra.AbsoluteConstraints(0, 0, 470, 70));

        jBtnOk.setText("OK");
        jBtnOk.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jBtnOkActionPerformed(evt);
            }
        });

        jBtnCancel.setText("Cancel");
        jBtnCancel.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jBtnCancelActionPerformed(evt);
            }
        });

        javax.swing.GroupLayout jPanel3Layout = new javax.swing.GroupLayout(jPanel3);
        jPanel3.setLayout(jPanel3Layout);
        jPanel3Layout.setHorizontalGroup(
            jPanel3Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(jPanel3Layout.createSequentialGroup()
                .addContainerGap(287, Short.MAX_VALUE)
                .addComponent(jBtnOk)
                .addGap(50, 50, 50)
                .addComponent(jBtnCancel)
                .addGap(21, 21, 21))
        );
        jPanel3Layout.setVerticalGroup(
            jPanel3Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(jPanel3Layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(jPanel3Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jBtnOk)
                    .addComponent(jBtnCancel))
                .addContainerGap(16, Short.MAX_VALUE))
        );

        getContentPane().add(jPanel3, new org.netbeans.lib.awtextra.AbsoluteConstraints(0, 80, 470, 50));

        pack();
    }// </editor-fold>//GEN-END:initComponents

    private void jBtnCancelActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jBtnCancelActionPerformed
        // TODO add your handling code here:
        isSelectOK = false;
        dispose();
    }//GEN-LAST:event_jBtnCancelActionPerformed

    private void jBtnOkActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jBtnOkActionPerformed
        // TODO add your handling code here:
        int index = jCBSelectFlowChannel.getSelectedIndex();
        if(index < 0){
            this.setSystemFlowChannel(null);
        }
//        if(index <= 0){
//            this.setSystemFlowChannel(null);
//        }else{
//            this.setSystemFlowChannel(flowChannels.get(index - 1));
//        }
        
        this.setSystemFlowChannel(flowChannels.get(index));
        
        isSelectOK = true;
        dispose();
    }//GEN-LAST:event_jBtnOkActionPerformed


    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton jBtnCancel;
    private javax.swing.JButton jBtnOk;
    private javax.swing.JComboBox jCBSelectFlowChannel;
    private javax.swing.JLabel jLabelSelectFlowChannel;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JPanel jPanel3;
    // End of variables declaration//GEN-END:variables

    /**
     * @return the systemFlowChannel
     */
    public NChannelHeader getSystemFlowChannel() {
        return systemFlowChannel;
    }

    /**
     * @param systemFlowChannel the systemFlowChannel to set
     */
    public void setSystemFlowChannel(NChannelHeader systemFlowChannel) {
        this.systemFlowChannel = systemFlowChannel;
    }

    /**
     * @return the isSelectOK
     */
    public boolean isSelectOK() {
        return isSelectOK;
    }
}
