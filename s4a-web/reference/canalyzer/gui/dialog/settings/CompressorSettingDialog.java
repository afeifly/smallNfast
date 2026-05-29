/*
 * CompressSettingDialog.java
 *
 * Created on 2008年7月28日, 下午12:18
 */

package com.cs.canalyzer.gui.dialog.settings;

import com.cs.canalyzer.gui.GUIConst;
import com.cs.canalyzer.gui.dialog.NewWaitingDialog;
import com.cs.canalyzer.gui.dialog.ThresholdSettingDialog;
import com.cs.canalyzer.structs.*;
import com.cs.database.CSMDF;
import com.cs.database.NChannelHeader;
import com.cs.database.NProtocolHeader;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.EventQueue;
import java.awt.Graphics;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.TimerTask;
import javax.swing.ImageIcon;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.SpinnerNumberModel;

/**
 *
 * @author  wolf
 */
public class CompressorSettingDialog extends javax.swing.JDialog {
    public static final int POWER_METER_SUBDEVICE_ID = 0x3510;
    /** Creates new form CompressSettingDialog */
    public CompressorSettingDialog( CommonValue common ) {
        this.theCommonValue = common;
        this.theDB = common.getDataBase();
        this.myTexts = common.getTexts();
   
        myInit();
        
    }
    
    /** This constructor is for loading reports where compressors don't have to be initiated.
     */
    public CompressorSettingDialog( CommonValue common, ArrayList<Compressor> existingCompressors ) {
        this.theCommonValue = common;
        this.myCompressors = existingCompressors;
        this.theDB = common.getDataBase();
        this.myTexts = common.getTexts();
       
        myInit();
    }
    
    private void myInit() {
        atInit = true;
        
        initComponents();
        //add on 20100511, MK's requirement
        jLabel4.setText("("+java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("O'Clock")+")");
//        buttonGroupShowCurrentChannelAs.add( jRadioCurrent );
//        buttonGroupShowCurrentChannelAs.add( jRadioFlow );
       
        initValue();
        
        setIconImage( new ImageIcon( getClass().getResource( GUIConst.IMAGE_PATH + GUIConst.LOGO_FILE_NAME)).getImage() );         
        setBounds( START_X, START_Y, WIDTH, HEIGHT );
        
        jDialogCosPSetting.setModal( true );
        jDialogCosPSetting.setIconImage(new ImageIcon( getClass().getResource( GUIConst.IMAGE_PATH + GUIConst.LOGO_FILE_NAME)).getImage());
        jDialogCosPSetting.setBounds( COSP_DIALOG_START_X, COSP_DIALOG_START_Y, COSP_DIALOG_WIDTH, COSP_DIALOG_HEIGHT );
        
        // 
        jTextUnLoadAir.setVisible( false );
        jTextNoLoadAir.setVisible( false );
        
        atInit = false;
        
        try{                   
            jLabel26.setText("");
            if(myCompressors != null){               
                if(myCompressors.size() > 0){
                    if(myCompressors.get(0).hasPowerChannel()){
                        jTextVoltage.setEnabled(false);
                        jButtonCosPhiSetting.setEnabled(false);
                        jLabel26.setText(POWER_CHANNEL_THRESHOLD_MSG);
                    }else{
                        jLabel26.setText(CURRENT_CHANNEL_THRESHOLD_MSG);
                    }
                }
            }
        }catch(Exception e){
            e.printStackTrace();
        }
        jScrollPane1.setViewportView(jPanel5);
    }
    
    private void initValue() {
        myFlowChannels = new ArrayList<NChannelHeader>();
        myCurrentChannels = new ArrayList<NChannelHeader>();
        
        for ( String typeString : Compressor.COMPRESS_TYPE_TEXT ) 
            jComboCompressorType.addItem( typeString );
                    
//        for ( String unit : MeasurementUnit.FLOW_RATE_UNITS )
//            jComboAirUnit.addItem( unit );
        
        if ( myCompressors == null ) {
            myCompressors = new ArrayList<Compressor>();
            addChannels();
        } else
            initCompressorsFields();

//        if ( theCommonValue.isShowCurrentValuesAsFlow() )
//            jRadioFlow.setSelected( true );
//        else
//            jRadioCurrent.setSelected( true );
     
        
        addMeasurementChannelAreaFields();
        
        if( myCompressors.size() > 0 )
            jComboCurrentChannel.setSelectedIndex(0);
        
        if( myCompressors.size() < 2 ) {
            jComboCopyToChannel.setEnabled( false );
            jButtonCopyTo.setEnabled( false );
        }
        
        jLabelCurrency.setText( theCommonValue.getLeakStatistics().currencyEnergyCost );
        //v3-3
        this.jLabAirUnit.setText( theCommonValue.getLeakStatistics().getAir_delivery_unit() );
        //modify on 20091016.be
        //v3-5 : Energy per kwh setting will be different in for different times a day.
        numModelECostPerKwh1StartHour = new SpinnerNumberModel( theCommonValue.getLeakStatistics().getEnergyCostPerKwh1StartTime(), 0, 24, 1 );
        numModelECostPerKwh1EndHour = new SpinnerNumberModel( theCommonValue.getLeakStatistics().getEnergyCostPerKwh1EndTime(), 0, 24, 1 );
        numModelECostPerKwh2StartHour = new SpinnerNumberModel( theCommonValue.getLeakStatistics().getEnergyCostPerKwh2StartTime(), 0, 24, 1 );
        numModelECostPerKwh2EndHour = new SpinnerNumberModel( theCommonValue.getLeakStatistics().getEnergyCostPerKwh2EndTime(), 0, 24, 1 );
        jECostsPerKwhHour1StartHour.setModel(numModelECostPerKwh1StartHour);
        jECostsPerKwhHour1EndHour.setModel(numModelECostPerKwh1EndHour);
        jECostsPerKwhHour2StartHour.setModel(numModelECostPerKwh2StartHour);
        jECostsPerKwhHour2EndHour.setModel(numModelECostPerKwh2EndHour);

        //v3-9.unload threshold is not editable. modify on 20091019. be
        jTextUnLoadThreshold.setEditable(false);
      
    }
    
    
    private void addChannels() {
        jComboFlowChannel.addItem(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("None"));
        
        ArrayList<NProtocolHeader> pheaders = theCommonValue.getProtocolHeaders();
        ArrayList<NChannelHeader> chheaders;
        char nameTail = 1;  // a tail to add to compressor name so that it can be distinguish 
       
        NChannelHeader systemAnalyzesFlowChheader;
        String idPath = null; 
        String systemAnalyzesFlowChheaderPath = null;
        String splitChar = "_";
        int csdFileVersion = 4; // begining from version 4 has power meter
            
        for ( NProtocolHeader pheader : pheaders ) {
            chheaders = theDB.findChannelHeaders( pheader.Pref );
            for ( NChannelHeader chheader : chheaders ) {
                if ( MeasurementUnit.IsCurrentUnit( chheader.getUnitText() )) {                  
                    Compressor compressor = new Compressor();                 
                    compressor.setCurrentChanel( chheader );
                    
                    if(pheader.versionOfFile >= csdFileVersion){
//                        if(chheader.subDeviceID == powerMeterSubDeviceId){                    
                            idPath = chheader.newDeviceID + splitChar + chheader.subDeviceID + 
                                    splitChar + chheader.sensorID;
                            for ( NChannelHeader chh : chheaders ) {
    //                    		if ( MeasurementUnit.IsEnergyUnit( chh.getUnitText() )) {                          
                                if(idPath.equals(chh.newDeviceID + splitChar + chh.subDeviceID + splitChar + chh.sensorID)){
                                    if(chh.subDeviceID == POWER_METER_SUBDEVICE_ID 
                                            && chh.channelID == ACTIVE_POWER_CHANNEL_ID){//active energy channel no. is 9.                                       
                                        chheader = chh;                                      
                                        compressor.assignedPowerChannel(chh);
                                        break;
                                    }
                                }
                            }
//                        }
                    }
                    
                    double valueLength = chheader.Max - chheader.Min;
                    compressor.Unit = chheader.getUnitText();
                      
                    compressor.FullLoadCurrentThreshold = chheader.Max - valueLength * 0.1f;

                    //v3-9.
                    //unload threshold will be calculated automatically as 55% of full load threshold.
                    //add on 20091019. be.
//                    compressor.UnLoadCurrentThreshold = chheader.Min + valueLength * 0.3f;
                    compressor.UnLoadCurrentThreshold = compressor.FullLoadCurrentThreshold * UNLOAD_THRESHOLD_PERCENT_FULL_LOAD_THRESHOLD;

                    //compressor.NoLoadCurrentThreshold = chheader.Min + valueLength * 0.1f;
                    compressor.NoLoadCurrentThreshold = compressor.UnLoadCurrentThreshold * 0.1;
                    // cos p
                    compressor.FullLoadCurrent = compressor.FullLoadCurrentThreshold;
                    compressor.UnLoadCurrent = compressor.UnLoadCurrentThreshold;
                    compressor.NoLoadCurrent = compressor.NoLoadCurrentThreshold;
                    compressor.FullLoadCosP = compressor.DEFAULT_FULL_LOAD_COSP;
                    compressor.UnLoadCosP = compressor.DEFAULT_UN_LOAD_COSP;
                    // end of cos p
                    if ( chheader.getDescription().length() > 0 )
                        compressor.Description = chheader.getDescription();
                    else
                        compressor.Description = pheader.getDescription() + "." + chheader.ChannelNumber;
                    
                    // Feb 26, 2009  Add last 4 digits of device ID to compressor's description to distinguash 
                    // channels from record files with identical name from differnt device
//                    String idString = String.valueOf( pheader.DeviceID );
//                    int beginIndex = idString.length() - 4;
//                    if ( beginIndex < 0 ) beginIndex = 0;
//                    compressor.Description = idString.substring( beginIndex, idString.length() ) + "_" + compressor.Description;
                    String oldCompressorDes = compressor.Description;
                    compressor.Description = theCommonValue.getViewChannelFullName(pheader,chheader);
                    if(compressor.Description == null){
                        compressor.Description = oldCompressorDes;
                    }
                    
                    myCompressors.add( compressor );
                    myCurrentChannels.add( chheader );
                   
                    jComboCurrentChannel.addItem( compressor.Description + nameTail );
                    jComboCopyToChannel.addItem( compressor.Description  + nameTail );
                } else if ( MeasurementUnit.IsFlowRateUnit( chheader.getUnitText() )) {
                    
//                    //check if assigned to system analyzse
//                    if(theCommonValue != null){
//                        systemAnalyzesFlowChheader = theCommonValue.getSystemFlowChannelTmp();
//                        if(systemAnalyzesFlowChheader != null){
//                            idPath = chheader.newDeviceID + splitChar + chheader.subDeviceID + 
//                                    splitChar + chheader.sensorID + splitChar + chheader.channelID;
//                            systemAnalyzesFlowChheaderPath = systemAnalyzesFlowChheader.newDeviceID + splitChar + systemAnalyzesFlowChheader.subDeviceID + 
//                                    splitChar + systemAnalyzesFlowChheader.sensorID + splitChar + systemAnalyzesFlowChheader.channelID;
//                            if(systemAnalyzesFlowChheaderPath.equals(idPath)){
//                                continue;
//                            }
//                        }
//                    }
                    
                    myFlowChannels.add( chheader );
                    
                    String oldCompressorDes = chheader.getDescription();
                    String newCompressorDes = theCommonValue.getViewChannelFullName(pheader,chheader);
                    if(newCompressorDes == null){
                        newCompressorDes = oldCompressorDes;
                    }
                    
                    if (newCompressorDes != null && newCompressorDes.length() > 0 )
                        jComboFlowChannel.addItem( newCompressorDes + nameTail );
                    else
                        jComboFlowChannel.addItem( pheader.DeviceID + "." + chheader.ChannelNumber + nameTail );
             
                    
//                    if ( chheader.getDescription().length() > 0 )
//                        jComboFlowChannel.addItem( chheader.getDescription() + nameTail );
//                    else
//                        jComboFlowChannel.addItem( pheader.DeviceID + "." + chheader.ChannelNumber + nameTail );
                }
                nameTail++; if ( nameTail == 10 ) nameTail++;
            } // chheader cycle
            
            checkIfStillHasPowerChannel(pheader, chheaders);
        }
    }
    
    private void initCompressorsFields() {
       
        for ( Compressor compressor : myCompressors ) {
            jComboCurrentChannel.addItem( compressor.Description );
            jComboCopyToChannel.addItem( compressor.Description  );
            if(compressor.hasPowerChannel()){
                myCurrentChannels.add( compressor.getAssignedPowerChannel() );
            }else{
                myCurrentChannels.add( compressor.getCurrentChanel() );
            }
        }
        
        addFlowChannelToComboFlowChannel();

    }

    private void addFlowChannelToComboFlowChannel(){
//        initFlowChannel = true;
//        myFlowChannels = new ArrayList<NChannelHeader>();
//        jComboFlowChannel.removeAllItems();
        jComboFlowChannel.addItem(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("None"));
      
        NChannelHeader systemAnalyzesFlowChheader;
        String idPath = null; 
        String systemAnalyzesFlowChheaderPath = null;
        String splitChar = "_";
        ArrayList<NProtocolHeader> pheaders = theCommonValue.getProtocolHeaders();
        ArrayList<NChannelHeader> chheaders;
        for ( NProtocolHeader pheader : pheaders ) {
            chheaders = theDB.findChannelHeaders( pheader.Pref );
            for ( NChannelHeader chheader : chheaders ) {
                if ( MeasurementUnit.IsFlowRateUnit( chheader.getUnitText() )) {
                    
//                    //check if assigned to system analyzse
//                    if(theCommonValue != null){
//                        systemAnalyzesFlowChheader = theCommonValue.getSystemFlowChannelTmp();
//                        if(systemAnalyzesFlowChheader != null){
//                            idPath = chheader.newDeviceID + splitChar + chheader.subDeviceID + 
//                                    splitChar + chheader.sensorID + splitChar + chheader.channelID;
//                            systemAnalyzesFlowChheaderPath = systemAnalyzesFlowChheader.newDeviceID + splitChar + systemAnalyzesFlowChheader.subDeviceID + 
//                                    splitChar + systemAnalyzesFlowChheader.sensorID + splitChar + systemAnalyzesFlowChheader.channelID;
//                            if(systemAnalyzesFlowChheaderPath.equals(idPath)){
//                                continue;
//                            }
//                        }
//                    }
                    
                    myFlowChannels.add( chheader );
                    
                    String oldCompressorDes = chheader.getDescription();
                    String newCompressorDes = theCommonValue.getViewChannelFullName(pheader,chheader);
                    if(newCompressorDes == null){
                        newCompressorDes = oldCompressorDes;
                    }
                    
                    if (newCompressorDes != null && newCompressorDes.length() > 0 )
                        jComboFlowChannel.addItem( newCompressorDes );
                    else
                        jComboFlowChannel.addItem( pheader.DeviceID + "." + chheader.ChannelNumber );
                    
//                    if ( chheader.getDescription().length() > 0 )
//                        jComboFlowChannel.addItem( chheader.getDescription() );
//                    else
//                        jComboFlowChannel.addItem( pheader.DeviceID + "." + chheader.ChannelNumber );
                }
            }
        }
        
//        initFlowChannel = false;
    }
    
    private void addMeasurementChannelAreaFields() {
        
        int size = myCompressors.size();
        if (size <= 0) {
            return;
        }
        Compressor compressor;
        mchannelDescriptions = new JLabel[size];
        mchannelStatuses = new JLabel[size];
        mchannelSelects = new JCheckBox[size];
        
        for (int i = 0; i < size; i++) {
            JPanel jpanel = new JPanel();            
            jpanel.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT));
            jpanel.setMaximumSize(new  Dimension(260, 30));
            compressor = myCompressors.get(i);
            JLabel l = new JLabel((i + 1) + ":");
            l.setFont(GUIConst.DIALOG_FONT);                        
//            l.setSize(15, MCHANNEL_FIELDS_HEIGHT);  
            l.setPreferredSize(new  Dimension(15, MCHANNEL_FIELDS_HEIGHT));
            jpanel.add(l);
            
            mchannelDescriptions[i] = new JLabel(compressor.Description);
            mchannelDescriptions[i].setFont(GUIConst.DIALOG_FONT);
            mchannelDescriptions[i].setToolTipText(compressor.Description);            
//            mchannelDescriptions[i].setPreferredSize(MCHANNEL_DESCRIPTION_FIELD_WIDTH, MCHANNEL_FIELDS_HEIGHT);            
            mchannelDescriptions[i].setPreferredSize(new  Dimension(MCHANNEL_DESCRIPTION_FIELD_WIDTH, MCHANNEL_FIELDS_HEIGHT));            
            jpanel.add(mchannelDescriptions[i]);
            
            mchannelStatuses[i] = new JLabel(compressor.getStatusString());            
            mchannelStatuses[i].setFont(GUIConst.DIALOG_FONT);            
//            mchannelStatuses[i].setSize(MCHANNEL_STATUS_FIELD_WIDTH, MCHANNEL_FIELDS_HEIGHT);            
            mchannelStatuses[i].setPreferredSize(new  Dimension(MCHANNEL_STATUS_FIELD_WIDTH, MCHANNEL_FIELDS_HEIGHT));            
            jpanel.add(mchannelStatuses[i]);

            mchannelSelects[i] = new JCheckBox();
            mchannelSelects[i].setFont(GUIConst.DIALOG_FONT);
            mchannelSelects[i].setSelected(compressor.Selected);
            mchannelSelects[i].addActionListener(new java.awt.event.ActionListener() {
                public void actionPerformed(java.awt.event.ActionEvent evt) {
                    setCompressorSelections(evt);
                }
            });            
            mchannelSelects[i].setSize(MCHANNEL_SELECT_FIELD_WIDTH, MCHANNEL_FIELDS_HEIGHT);           
            jpanel.add(mchannelSelects[i]);
            jPanel5.add(jpanel);            
        }
        
        
        
        
        
        
//        for (int i = 0; i < size; i++) {
//            compressor = myCompressors.get(i);
//            JLabel l = new JLabel((i + 1) + ":");
//            l.setFont(GUIConst.DIALOG_FONT);
//            l.setLocation(MCHANNEL_FIELDS_START_X - 20, MCHANNEL_FIELDS_START_Y +
//                    i * (MCHANNEL_FIELDS_HEIGHT + MCHANNEL_FIELDS_GAP));
//            l.setSize(15, MCHANNEL_FIELDS_HEIGHT);
//            jPanelMeasurementChannels.add(l);
//            
//            
//            mchannelDescriptions[i] = new JLabel(compressor.Description);
//            mchannelDescriptions[i].setFont(GUIConst.DIALOG_FONT);
//            mchannelDescriptions[i].setToolTipText(compressor.Description);
//            mchannelDescriptions[i].setLocation(MCHANNEL_FIELDS_START_X,
//                    MCHANNEL_FIELDS_START_Y + i * (MCHANNEL_FIELDS_HEIGHT + MCHANNEL_FIELDS_GAP));
//            mchannelDescriptions[i].setSize(MCHANNEL_DESCRIPTION_FIELD_WIDTH, MCHANNEL_FIELDS_HEIGHT);
//            jPanelMeasurementChannels.add(mchannelDescriptions[i]);
//            
//            
//            mchannelStatuses[i] = new JLabel(compressor.getStatusString());            
//            mchannelStatuses[i].setFont(GUIConst.DIALOG_FONT);
//            mchannelStatuses[i].setLocation(MCHANNEL_FIELDS_START_X + MCHANNEL_DESCRIPTION_FIELD_WIDTH + MCHANNEL_FIELDS_GAP,
//                    MCHANNEL_FIELDS_START_Y + i * (MCHANNEL_FIELDS_HEIGHT + MCHANNEL_FIELDS_GAP));
//            mchannelStatuses[i].setSize(MCHANNEL_STATUS_FIELD_WIDTH, MCHANNEL_FIELDS_HEIGHT);
//            jPanelMeasurementChannels.add(mchannelStatuses[i]);
//
//
//            mchannelSelects[i] = new JCheckBox();
//            mchannelSelects[i].setFont(GUIConst.DIALOG_FONT);
//            mchannelSelects[i].setSelected(compressor.Selected);
//            mchannelSelects[i].addActionListener(new java.awt.event.ActionListener() {
//                public void actionPerformed(java.awt.event.ActionEvent evt) {
//                    setCompressorSelections(evt);
//                }
//            });
//            mchannelSelects[i].setLocation(MCHANNEL_FIELDS_START_X + MCHANNEL_DESCRIPTION_FIELD_WIDTH + MCHANNEL_STATUS_FIELD_WIDTH + 2 * MCHANNEL_FIELDS_GAP,
//                    MCHANNEL_FIELDS_START_Y + i * (MCHANNEL_FIELDS_HEIGHT + MCHANNEL_FIELDS_GAP));
//            mchannelSelects[i].setSize(MCHANNEL_SELECT_FIELD_WIDTH, MCHANNEL_FIELDS_HEIGHT);
//            jPanelMeasurementChannels.add(mchannelSelects[i]);            
//        }
    }

    private void setFieldsBasedOnCompressor() {
        try {
            if ( selectedCompressorIx < 0 ) return;
            Compressor compressor = myCompressors.get( selectedCompressorIx );

            jComboCompressorType.setSelectedIndex( compressor.Type );
                        
            jTextCompressorDescription.setText( compressor.Description );
            
            jTextFullLoadCurrent.setText( String.format( 
                    FORMAT_STRING_1_DIGIT, compressor.FullLoadCurrent).trim() );
            jTextUnLoadCurrent.setText( String.format( 
                    FORMAT_STRING_1_DIGIT, compressor.UnLoadCurrent).trim() );
            jTextNoLoadCurrent.setText( String.format( 
                    FORMAT_STRING_1_DIGIT, compressor.NoLoadCurrent).trim() );
            //v3-9.
            //the full load,unload and stop threshold numbers will be automatically copied into cos p
            //settings and not editable there.
            //add on 20091019. be.
            jTextFullLoadCurrent.setEditable(false);
            jTextUnLoadCurrent.setEditable(false);
            jTextNoLoadCurrent.setEditable(false);

            jTextFullLoadCosP.setText( String.format( 
                    FORMAT_STRING_2_DIGIT, compressor.FullLoadCosP ).trim() );
            jTextUnLoadCosP.setText( String.format( 
                    FORMAT_STRING_2_DIGIT, compressor.UnLoadCosP).trim() );
            jTextNoLoadCosP.setText( String.format( 
                    FORMAT_STRING_2_DIGIT, compressor.NoLoadCosP ).trim() );

            jTextFullLoadAir.setText( String.format( 
                    FORMAT_STRING_1_DIGIT, compressor.FullLoadAirDelivery).trim() );
            jTextUnLoadAir.setText( String.format( 
                    FORMAT_STRING_1_DIGIT, compressor.UnLoadAirDelivery).trim() );
            jTextNoLoadAir.setText( String.format( 
                    FORMAT_STRING_1_DIGIT, compressor.NoLoadAirDelivery).trim() );
            //modify on 20091015. v3-3
//            jComboAirUnit.setSelectedItem( compressor.AirDeliveryUnit );
             //jLabAirUnit.setText( compressor.AirDeliveryUnit );  // all compressors have same unit. set in LeakStat
            
            jTextFullLoadThreshold.setText( String.format( 
                    FORMAT_STRING_1_DIGIT, compressor.FullLoadCurrentThreshold ).trim() );
            jTextUnLoadThreshold.setText( String.format( 
                    FORMAT_STRING_1_DIGIT, compressor.UnLoadCurrentThreshold).trim() );
            jTextNoLoadThreshold.setText( String.format( 
                    FORMAT_STRING_1_DIGIT, compressor.NoLoadCurrentThreshold).trim() );

            jTextVoltage.setText(String.valueOf(compressor.getSupplyVoltage()));

            //modify on 20091016.be
            //v3-5 : Energy per kwh setting will be different in for different times a day.
//            jTextEnergyCost.setText(  String.format(
//                    FORMAT_STRING_2_DIGIT,compressor.EnergyCostPerKwh ).trim() );
              jTextEnergyCost.setText(  String.format(
                    FORMAT_STRING_2_DIGIT,theCommonValue.getLeakStatistics().getEnergyCostPerKwh1() ).trim() );
              jTextEnergyCost2.setText(  String.format(
                    FORMAT_STRING_2_DIGIT,theCommonValue.getLeakStatistics().getEnergyCostPerKwh2() ).trim() );
              //
               numModelECostPerKwh1StartHour.setValue(theCommonValue.getLeakStatistics().getEnergyCostPerKwh1StartTime());
               numModelECostPerKwh1EndHour.setValue(theCommonValue.getLeakStatistics().getEnergyCostPerKwh1EndTime());
               numModelECostPerKwh2StartHour.setValue(theCommonValue.getLeakStatistics().getEnergyCostPerKwh2StartTime());
               numModelECostPerKwh2EndHour.setValue(theCommonValue.getLeakStatistics().getEnergyCostPerKwh2EndTime());


            //jTextCurrency.setText(compressor.Currency);
//            jTextCO2Emmision.setText( String.format( FORMAT_STRING_2_DIGIT, compressor.CO2EmmisionPerKWh).trim() );

            mchannelStatuses[selectedCompressorIx].setText( compressor.getStatusString() );
            
            setCompressorFieldsBasedOnCompressorType();
            setCompressorTypeRelatedAvailability();
            
            setAssignedFlowChannelFieldBasedOnCompressor( compressor );
            
            /* if select channel is power channel, some fields need to change */                  
            if(compressor.hasPowerChannel()){
                jTextVoltage.setEnabled(false);
                jButtonCosPhiSetting.setEnabled(false);
                jLabel26.setText("");
                jLabel26.setText(POWER_CHANNEL_THRESHOLD_MSG);
            }else{
                jTextVoltage.setEnabled(true);
                jLabel26.setText("");
                jLabel26.setText(CURRENT_CHANNEL_THRESHOLD_MSG);
            }
           
        } catch (Exception e) {
            return;
        }
    }
    
    /** If there's an assigned flow channel to this compressor, set the flow channel field.
     */
    private void setAssignedFlowChannelFieldBasedOnCompressor( Compressor compressor ) {
        NChannelHeader assignedChannel =  compressor.getAssignedFlowChannel();
        if ( assignedChannel == null ){
//            return;
            jComboFlowChannel.setSelectedIndex( 0 );
        }else{

            try {
                NChannelHeader flowChannel;
                for ( int i = 0; i < myFlowChannels.size(); i++ ) {
                    flowChannel = myFlowChannels.get(i);
                    if ( flowChannel.Pref == assignedChannel.Pref && 
                            flowChannel.ChannelNumber == assignedChannel.ChannelNumber ) {
                        jComboFlowChannel.setSelectedIndex( i + 1 );
                    }
                }
            } catch ( Exception e ){}
        }
    }
    
    private void setCompressorTypeRelatedAvailability() {
        if ( selectedCompressorIx < 0 ) return;
        
        Compressor compressor = myCompressors.get( selectedCompressorIx );
        if ( compressor.Type == Compressor.COMPRESSOR_TYPE_LOAD_UNLOAD ) {
            jTextFullLoadAir.setEnabled( true );
            jTextFullLoadThreshold.setEditable( true );
            //v3-9.unload threshold is not editable. modify on 20091019. be
//            jTextUnLoadThreshold.setEditable( true );
            jTextUnLoadThreshold.setEditable( false );
            jTextNoLoadThreshold.setEditable( true );
            jButtonThresholdSetting.setEnabled( true );
            jButtonCosPhiSetting.setEnabled( true );
            
            jButtonVFSetting.setEnabled( false );
        } else {
            jTextFullLoadAir.setEnabled( false );
            jTextFullLoadThreshold.setEditable( false );
            jTextUnLoadThreshold.setEditable( false );
            jTextNoLoadThreshold.setEditable( false );
            jButtonThresholdSetting.setEnabled( false );
            jButtonCosPhiSetting.setEnabled( false );
            
            jButtonVFSetting.setEnabled( true );
        }
        }
    
    private boolean applyChanges() {
        // the air delivery can't be 0 if showing current as flow
        for ( Compressor compressor : myCompressors ) {
            if ( compressor.Type == Compressor.COMPRESSOR_TYPE_VARIABLE_FREQUENCY 
                    && !compressor.VFParameterSet ) {
                JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_enter_VF_setting_for_compressor_") + compressor.Description + "." );
                return false;
            }
//            if ( jRadioFlow.isSelected() && compressor.Type == Compressor.COMPRESSOR_TYPE_LOAD_UNLOAD ) {
//             System.out.println("Compressor setting dialog / applyChanges theCommonValue.isShowCurrentValuesAsFlow() ="+theCommonValue.isShowCurrentValuesAsFlow());
//                System.out.println("Compressor setting dialog / applyChanges compressor.Type ="+compressor.Type);

//            if ( theCommonValue.isShowCurrentValuesAsFlow() && compressor.Type == Compressor.COMPRESSOR_TYPE_LOAD_UNLOAD ) {
            
             /* 20130610
             * TF's requirement: Overall, I think we should cut this stupid message, it really sucks if it pops up all the time.
             * We better make a chapter troube shooting into the help file. */
//            if ( theCommonValue.isShowAsFlow() && compressor.Type == Compressor.COMPRESSOR_TYPE_LOAD_UNLOAD ) {
////                 System.out.println("Compressor setting dialog / applyChanges compressor.FullLoadAirDelivery ="+compressor.FullLoadAirDelivery);
//               //modify on 20091111,be
//               //reason : compare doblue data no use < > ect,use BigDecimal .
//                // if ( compressor.FullLoadAirDelivery <= 0 ) {
//               BigDecimal fullLoadAirDeliveryData = new BigDecimal(compressor.FullLoadAirDelivery);
//               BigDecimal zeroData = new BigDecimal(0.0);
//               if(zeroData.compareTo(fullLoadAirDeliveryData) >= 0 ){
//                    JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("When_displaying_current_as_flow,_'Air_Delivery'_must_be_>_0.") );
//                    return false;
//                }
//            }
            
            // change channel description according to compressor description
            if ( compressorDescriptionChanged ) {
                NChannelHeader channel = null;
                if(compressor.hasPowerChannel()){
                    channel = compressor.getAssignedPowerChannel();
                }else{
                    channel = compressor.getCurrentChanel();
                }
                ArrayList<com.cs.canalyzer.structs.ViewChannel> vcs = theCommonValue.getSelectedChannels();
                for ( int i = 0; i < vcs.size(); i++ ) {
                    if ( vcs.get(i).chheader.Pref == channel.Pref 
                            && vcs.get(i).chheader.ChannelNumber == channel.ChannelNumber ) {
                            myTexts.Legends[i] = compressor.Description;
                    } 
                }
            }
        }
        
        if ( !myCompressors.isEmpty() ) {
            theCommonValue.setCompressors(myCompressors);
            //theCommonValue.setSelectedCompressor( myCompressors.get( selectedCompressorIx ));
        }

        if ( compressorDescriptionChanged )
            theCommonValue.setTexts( myTexts );
//        // the order is important!
//        if ( jRadioFlow.isSelected() )
//            theCommonValue.setShowCurrentValuesAsFlow( true );
//        else
//            theCommonValue.setShowCurrentValuesAsFlow( false );
        
        return true;
    }
       
    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        buttonGroupShowCurrentChannelAs = new javax.swing.ButtonGroup();
        jDialogCosPSetting = new javax.swing.JDialog();
        jButtonCosPOK = new javax.swing.JButton();
        jLabel22 = new javax.swing.JLabel();
        jLabel23 = new javax.swing.JLabel();
        jTextFullLoadCurrent = new javax.swing.JTextField();
        jTextFullLoadCosP = new javax.swing.JTextField();
        jTextUnLoadCurrent = new javax.swing.JTextField();
        jTextUnLoadCosP = new javax.swing.JTextField();
        jTextNoLoadCurrent = new javax.swing.JTextField();
        jTextNoLoadCosP = new javax.swing.JTextField();
        jLabel33 = new javax.swing.JLabel();
        jLabel37 = new javax.swing.JLabel();
        jLabel40 = new javax.swing.JLabel();
        jLabel41 = new javax.swing.JLabel();
        jPanel4 = new javax.swing.JPanel();
        jComboCurrentChannel = new javax.swing.JComboBox();
        jLabel1 = new javax.swing.JLabel();
        jButtonCopyTo = new javax.swing.JButton();
        jComboCopyToChannel = new javax.swing.JComboBox();
        jLabel2 = new javax.swing.JLabel();
        jComboFlowChannel = new javax.swing.JComboBox();
        jLabel3 = new javax.swing.JLabel();
        jComboCompressorType = new javax.swing.JComboBox();
        jLabel18 = new javax.swing.JLabel();
        jTextCompressorDescription = new javax.swing.JTextField();
        jLabel19 = new javax.swing.JLabel();
        jLabel20 = new javax.swing.JLabel();
        jLabel21 = new javax.swing.JLabel();
        jLabel24 = new javax.swing.JLabel();
        jTextNoLoadAir = new javax.swing.JTextField();
        jTextFullLoadAir = new javax.swing.JTextField();
        jTextUnLoadAir = new javax.swing.JTextField();
        jLabel25 = new javax.swing.JLabel();
        jLabel26 = new javax.swing.JLabel();
        jTextNoLoadThreshold = new javax.swing.JTextField();
        jTextUnLoadThreshold = new javax.swing.JTextField();
        jTextFullLoadThreshold = new javax.swing.JTextField();
        jLabel27 = new javax.swing.JLabel();
        jLabel28 = new javax.swing.JLabel();
        jLabel29 = new javax.swing.JLabel();
        jButtonThresholdSetting = new javax.swing.JButton();
        jLabel30 = new javax.swing.JLabel();
        jTextVoltage = new javax.swing.JTextField();
        jLabel31 = new javax.swing.JLabel();
        jButtonCosPhiSetting = new javax.swing.JButton();
        jButtonVFSetting = new javax.swing.JButton();
        jLabAirUnit = new javax.swing.JLabel();
        jPanel1 = new javax.swing.JPanel();
        jLabel32 = new javax.swing.JLabel();
        jPanel2 = new javax.swing.JPanel();
        jTextEnergyCost = new javax.swing.JTextField();
        jTextEnergyCost2 = new javax.swing.JTextField();
        jECostsPerKwhHour1StartHour = new javax.swing.JSpinner();
        jLabelTo = new javax.swing.JLabel();
        jECostsPerKwhHour1EndHour = new javax.swing.JSpinner();
        jECostsPerKwhHour2StartHour = new javax.swing.JSpinner();
        jLabelTo1 = new javax.swing.JLabel();
        jLabelCurrency = new javax.swing.JLabel();
        jLabel4 = new javax.swing.JLabel();
        jECostsPerKwhHour2EndHour = new javax.swing.JSpinner();
        jButtonOK = new javax.swing.JButton();
        jButtonCancel = new javax.swing.JButton();
        jPanelMeasurementChannels = new javax.swing.JPanel();
        jPanel3 = new javax.swing.JPanel();
        jLabel34 = new javax.swing.JLabel();
        jLabel36 = new javax.swing.JLabel();
        jLabel35 = new javax.swing.JLabel();
        jScrollPane1 = new javax.swing.JScrollPane();
        jPanel5 = new javax.swing.JPanel();

        java.util.ResourceBundle bundle = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts"); // NOI18N
        jDialogCosPSetting.setTitle(bundle.getString("cos_p_Setting")); // NOI18N
        jDialogCosPSetting.setResizable(false);
        jDialogCosPSetting.getContentPane().setLayout(new org.netbeans.lib.awtextra.AbsoluteLayout());

        jButtonCosPOK.setFont(GUIConst.BUTTON_FONT);
        jButtonCosPOK.setText(bundle.getString("OK")); // NOI18N
        jButtonCosPOK.setPreferredSize(new java.awt.Dimension(80, 23));
        jButtonCosPOK.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonCosPOKActionPerformed(evt);
            }
        });
        jDialogCosPSetting.getContentPane().add(jButtonCosPOK, new org.netbeans.lib.awtextra.AbsoluteConstraints(240, 220, -1, -1));

        jLabel22.setFont(new java.awt.Font("Serif", 1, 14)); // NOI18N
        jLabel22.setText(bundle.getString("Current_(A)")); // NOI18N
        jDialogCosPSetting.getContentPane().add(jLabel22, new org.netbeans.lib.awtextra.AbsoluteConstraints(130, 20, 140, -1));

        jLabel23.setFont(GUIConst.DIALOG_FONT);
        jLabel23.setText(bundle.getString("cos_p")); // NOI18N
        jDialogCosPSetting.getContentPane().add(jLabel23, new org.netbeans.lib.awtextra.AbsoluteConstraints(260, 60, -1, -1));

        jTextFullLoadCurrent.setFont(GUIConst.DIALOG_FONT);
        jTextFullLoadCurrent.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextFullLoadCurrentKeyTyped(evt);
            }
        });
        jDialogCosPSetting.getContentPane().add(jTextFullLoadCurrent, new org.netbeans.lib.awtextra.AbsoluteConstraints(120, 90, 80, -1));

        jTextFullLoadCosP.setFont(GUIConst.DIALOG_FONT);
        jTextFullLoadCosP.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextFullLoadCosPKeyTyped(evt);
            }
        });
        jDialogCosPSetting.getContentPane().add(jTextFullLoadCosP, new org.netbeans.lib.awtextra.AbsoluteConstraints(240, 90, 80, -1));

        jTextUnLoadCurrent.setFont(GUIConst.DIALOG_FONT);
        jTextUnLoadCurrent.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextUnLoadCurrentKeyTyped(evt);
            }
        });
        jDialogCosPSetting.getContentPane().add(jTextUnLoadCurrent, new org.netbeans.lib.awtextra.AbsoluteConstraints(120, 130, 80, -1));

        jTextUnLoadCosP.setFont(GUIConst.DIALOG_FONT);
        jTextUnLoadCosP.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextUnLoadCosPKeyTyped(evt);
            }
        });
        jDialogCosPSetting.getContentPane().add(jTextUnLoadCosP, new org.netbeans.lib.awtextra.AbsoluteConstraints(240, 130, 80, -1));

        jTextNoLoadCurrent.setFont(GUIConst.DIALOG_FONT);
        jTextNoLoadCurrent.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextNoLoadCurrentKeyTyped(evt);
            }
        });
        jDialogCosPSetting.getContentPane().add(jTextNoLoadCurrent, new org.netbeans.lib.awtextra.AbsoluteConstraints(120, 170, 80, -1));

        jTextNoLoadCosP.setFont(GUIConst.DIALOG_FONT);
        jTextNoLoadCosP.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextNoLoadCosPKeyTyped(evt);
            }
        });
        jDialogCosPSetting.getContentPane().add(jTextNoLoadCosP, new org.netbeans.lib.awtextra.AbsoluteConstraints(240, 170, 80, -1));

        jLabel33.setFont(GUIConst.DIALOG_FONT);
        jLabel33.setText(bundle.getString("Full_load:")); // NOI18N
        jDialogCosPSetting.getContentPane().add(jLabel33, new org.netbeans.lib.awtextra.AbsoluteConstraints(20, 90, -1, -1));

        jLabel37.setFont(GUIConst.DIALOG_FONT);
        jLabel37.setText(bundle.getString("Unload:")); // NOI18N
        jDialogCosPSetting.getContentPane().add(jLabel37, new org.netbeans.lib.awtextra.AbsoluteConstraints(20, 130, -1, -1));

        jLabel40.setFont(GUIConst.DIALOG_FONT);
        jLabel40.setText(bundle.getString("Stop:")); // NOI18N
        jDialogCosPSetting.getContentPane().add(jLabel40, new org.netbeans.lib.awtextra.AbsoluteConstraints(20, 170, -1, -1));

        jLabel41.setFont(GUIConst.DIALOG_FONT);
        jLabel41.setText(bundle.getString("Current_(A)")); // NOI18N
        jDialogCosPSetting.getContentPane().add(jLabel41, new org.netbeans.lib.awtextra.AbsoluteConstraints(130, 60, -1, -1));

        setDefaultCloseOperation(javax.swing.WindowConstants.DISPOSE_ON_CLOSE);
        setTitle(bundle.getString("Compressor_settings")); // NOI18N
        getContentPane().setLayout(new org.netbeans.lib.awtextra.AbsoluteLayout());

        jPanel4.setBorder(javax.swing.BorderFactory.createTitledBorder(javax.swing.BorderFactory.createTitledBorder(""), "", javax.swing.border.TitledBorder.DEFAULT_JUSTIFICATION, javax.swing.border.TitledBorder.DEFAULT_POSITION, GUIConst.TITLE_FONT, new java.awt.Color(5, 176, 117)));

        jComboCurrentChannel.setFont(GUIConst.DIALOG_FONT);
        jComboCurrentChannel.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jComboCurrentChannelActionPerformed(evt);
            }
        });

        jLabel1.setFont(GUIConst.DIALOG_FONT);
        jLabel1.setText(bundle.getString("Select_channel")); // NOI18N

        jButtonCopyTo.setFont(GUIConst.BUTTON_FONT);
        jButtonCopyTo.setText(bundle.getString("Copy_to:")); // NOI18N
        jButtonCopyTo.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonCopyToActionPerformed(evt);
            }
        });

        jComboCopyToChannel.setFont(GUIConst.DIALOG_FONT);

        jLabel2.setFont(GUIConst.DIALOG_FONT);
        jLabel2.setText(bundle.getString("Assign_flow_channel:")); // NOI18N

        jComboFlowChannel.setFont(GUIConst.DIALOG_FONT);
        jComboFlowChannel.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jComboFlowChannelActionPerformed(evt);
            }
        });

        jLabel3.setFont(GUIConst.DIALOG_FONT);
        jLabel3.setText(bundle.getString("Type_of_compressor:")); // NOI18N

        jComboCompressorType.setFont(GUIConst.DIALOG_FONT);
        jComboCompressorType.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jComboCompressorTypeActionPerformed(evt);
            }
        });

        jLabel18.setFont(GUIConst.DIALOG_FONT);
        jLabel18.setText(bundle.getString("Compressor_description:")); // NOI18N

        jTextCompressorDescription.setFont(GUIConst.DIALOG_FONT);
        jTextCompressorDescription.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextCompressorDescriptionKeyTyped(evt);
            }
        });

        jLabel19.setFont(GUIConst.DIALOG_FONT);
        jLabel19.setText(bundle.getString("Full_load:")); // NOI18N

        jLabel20.setFont(GUIConst.DIALOG_FONT);
        jLabel20.setText(bundle.getString("Unload:")); // NOI18N

        jLabel21.setFont(GUIConst.DIALOG_FONT);
        jLabel21.setText(bundle.getString("Stop:")); // NOI18N

        jLabel24.setFont(GUIConst.DIALOG_FONT);
        jLabel24.setText(bundle.getString("Air_delivery")); // NOI18N

        jTextNoLoadAir.setEditable(false);
        jTextNoLoadAir.setFont(GUIConst.DIALOG_FONT);
        jTextNoLoadAir.setEnabled(false);
        jTextNoLoadAir.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextNoLoadAirKeyTyped(evt);
            }
        });

        jTextFullLoadAir.setFont(GUIConst.DIALOG_FONT);
        jTextFullLoadAir.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextFullLoadAirKeyTyped(evt);
            }
        });

        jTextUnLoadAir.setEditable(false);
        jTextUnLoadAir.setFont(GUIConst.DIALOG_FONT);
        jTextUnLoadAir.setEnabled(false);
        jTextUnLoadAir.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextUnLoadAirKeyTyped(evt);
            }
        });

        jLabel25.setFont(GUIConst.DIALOG_FONT);
        jLabel25.setText(bundle.getString("Unit")); // NOI18N

        jLabel26.setFont(GUIConst.DIALOG_FONT);
        jLabel26.setText(bundle.getString("Load/Unload<br>Threshold")); // NOI18N

        jTextNoLoadThreshold.setFont(GUIConst.DIALOG_FONT);
        jTextNoLoadThreshold.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyReleased(java.awt.event.KeyEvent evt) {
                jTextNoLoadThresholdKeyReleased(evt);
            }
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextNoLoadThresholdKeyTyped(evt);
            }
        });

        jTextUnLoadThreshold.setFont(GUIConst.DIALOG_FONT);
        jTextUnLoadThreshold.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextUnLoadThresholdKeyTyped(evt);
            }
        });

        jTextFullLoadThreshold.setFont(GUIConst.DIALOG_FONT);
        jTextFullLoadThreshold.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyReleased(java.awt.event.KeyEvent evt) {
                jTextFullLoadThresholdKeyReleased(evt);
            }
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextFullLoadThresholdKeyTyped(evt);
            }
        });

        jLabel27.setFont(GUIConst.DIALOG_FONT);
        jLabel27.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel27.setText(">");

        jLabel28.setFont(GUIConst.DIALOG_FONT);
        jLabel28.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel28.setText(">");

        jLabel29.setFont(GUIConst.DIALOG_FONT);
        jLabel29.setHorizontalAlignment(javax.swing.SwingConstants.RIGHT);
        jLabel29.setText("<");

        jButtonThresholdSetting.setFont(GUIConst.BUTTON_FONT);
        jButtonThresholdSetting.setText(bundle.getString("Threshold_Setting_button")); // NOI18N
        jButtonThresholdSetting.setHorizontalTextPosition(javax.swing.SwingConstants.CENTER);
        jButtonThresholdSetting.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonThresholdSettingActionPerformed(evt);
            }
        });

        jLabel30.setFont(GUIConst.DIALOG_FONT);
        jLabel30.setText(bundle.getString("Supply_voltage:")); // NOI18N

        jTextVoltage.setFont(GUIConst.DIALOG_FONT);
        jTextVoltage.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextVoltageKeyTyped(evt);
            }
        });

        jLabel31.setFont(GUIConst.DIALOG_FONT);
        jLabel31.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabel31.setText("V");

        jButtonCosPhiSetting.setFont(GUIConst.BUTTON_FONT);
        jButtonCosPhiSetting.setText(bundle.getString("cos_phi_Setting")); // NOI18N
        jButtonCosPhiSetting.setHorizontalTextPosition(javax.swing.SwingConstants.CENTER);
        jButtonCosPhiSetting.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonCosPhiSettingActionPerformed(evt);
            }
        });

        jButtonVFSetting.setFont(GUIConst.BUTTON_FONT);
        jButtonVFSetting.setText(bundle.getString("VF_Setting")); // NOI18N
        jButtonVFSetting.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonVFSettingActionPerformed(evt);
            }
        });

        jLabAirUnit.setFont(GUIConst.DIALOG_FONT);
        jLabAirUnit.setText("m3/h");

        org.jdesktop.layout.GroupLayout jPanel4Layout = new org.jdesktop.layout.GroupLayout(jPanel4);
        jPanel4.setLayout(jPanel4Layout);
        jPanel4Layout.setHorizontalGroup(
            jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel4Layout.createSequentialGroup()
                .addContainerGap()
                .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                        .add(jLabel1)
                        .add(jLabel2)
                        .add(jLabel3))
                    .add(jLabel18))
                .add(17, 17, 17)
                .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel4Layout.createSequentialGroup()
                        .add(jTextCompressorDescription, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 178, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                        .add(18, 18, 18)
                        .add(jButtonVFSetting))
                    .add(jPanel4Layout.createSequentialGroup()
                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jComboCompressorType, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jComboFlowChannel, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jPanel4Layout.createSequentialGroup()
                                .add(jComboCurrentChannel, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 197, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                                .add(jButtonCopyTo)))
                        .add(14, 14, 14)
                        .add(jComboCopyToChannel, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 180, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
            .add(jPanel4Layout.createSequentialGroup()
                .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                    .add(org.jdesktop.layout.GroupLayout.LEADING, jPanel4Layout.createSequentialGroup()
                        .addContainerGap()
                        .add(jLabel30)
                        .add(13, 13, 13)
                        .add(jTextVoltage, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 46, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jLabel31, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 25, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                    .add(org.jdesktop.layout.GroupLayout.LEADING, jPanel4Layout.createSequentialGroup()
                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                            .add(jLabel21)
                            .add(jLabel20)
                            .add(jLabel19))
                        .add(41, 41, 41)
                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jTextNoLoadAir)
                            .add(jTextUnLoadAir)
                            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel4Layout.createSequentialGroup()
                                .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                                    .add(org.jdesktop.layout.GroupLayout.LEADING, jPanel4Layout.createSequentialGroup()
                                        .add(jTextFullLoadAir, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 63, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                        .add(jLabAirUnit, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
                                    .add(jPanel4Layout.createSequentialGroup()
                                        .add(jLabel24, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                        .add(jLabel25)))
                                .add(8, 8, 8)))))
                .add(60, 60, 60)
                .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel27, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 13, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel29, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 13, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel28, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 13, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel26, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 81, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jPanel4Layout.createSequentialGroup()
                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                            .add(jTextNoLoadThreshold, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 62, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jTextUnLoadThreshold, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 62, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jTextFullLoadThreshold, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 62, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jButtonThresholdSetting, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 89, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                    .add(jButtonCosPhiSetting, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 149, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .add(297, 297, 297))
        );
        jPanel4Layout.setVerticalGroup(
            jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel4Layout.createSequentialGroup()
                .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel4Layout.createSequentialGroup()
                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel1)
                            .add(jComboCurrentChannel, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jButtonCopyTo)
                            .add(jComboCopyToChannel, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jComboFlowChannel, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabel2))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jComboCompressorType, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabel3))
                        .add(12, 12, 12)
                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel18)
                            .add(jTextCompressorDescription, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jButtonVFSetting))
                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jPanel4Layout.createSequentialGroup()
                                .add(15, 15, 15)
                                .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                                    .add(jLabel24)
                                    .add(jLabel25)))
                            .add(jPanel4Layout.createSequentialGroup()
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jLabel26, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 28, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jPanel4Layout.createSequentialGroup()
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                                    .add(jLabel19)
                                    .add(jLabel27)
                                    .add(jTextFullLoadThreshold, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                    .add(jTextFullLoadAir, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                    .add(jLabAirUnit))
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                                    .add(jPanel4Layout.createSequentialGroup()
                                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                                            .add(jTextUnLoadAir, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                            .add(jLabel20))
                                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                                            .add(jTextNoLoadAir, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                            .add(jLabel21)))
                                    .add(jPanel4Layout.createSequentialGroup()
                                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                                            .add(jTextUnLoadThreshold, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                            .add(jLabel28))
                                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                                            .add(jLabel29)
                                            .add(jTextNoLoadThreshold, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))))
                            .add(jPanel4Layout.createSequentialGroup()
                                .add(18, 18, 18)
                                .add(jButtonThresholdSetting, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 52, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                        .add(27, 27, 27)
                        .add(jPanel4Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel30)
                            .add(jTextVoltage, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabel31)))
                    .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel4Layout.createSequentialGroup()
                        .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                        .add(jButtonCosPhiSetting, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 25, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                .addContainerGap())
        );

        getContentPane().add(jPanel4, new org.netbeans.lib.awtextra.AbsoluteConstraints(10, 15, 640, 300));

        jPanel1.setBorder(javax.swing.BorderFactory.createTitledBorder(null, bundle.getString("Cost_Settings"), javax.swing.border.TitledBorder.DEFAULT_JUSTIFICATION, javax.swing.border.TitledBorder.DEFAULT_POSITION, GUIConst.TITLE_FONT, GUIConst.TITLE_COLOR)); // NOI18N

        jLabel32.setFont(GUIConst.DIALOG_FONT);
        jLabel32.setText(bundle.getString("Energy_costs_per_kWh:")); // NOI18N

        jTextEnergyCost.setFont(GUIConst.DIALOG_FONT);
        jTextEnergyCost.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextEnergyCostKeyTyped(evt);
            }
        });

        jTextEnergyCost2.setFont(GUIConst.DIALOG_FONT);
        jTextEnergyCost2.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextEnergyCost2KeyTyped(evt);
            }
        });

        jECostsPerKwhHour1StartHour.setFont(GUIConst.DIALOG_FONT);
        jECostsPerKwhHour1StartHour.setPreferredSize(new java.awt.Dimension(35, 25));
        jECostsPerKwhHour1StartHour.addChangeListener(new javax.swing.event.ChangeListener() {
            public void stateChanged(javax.swing.event.ChangeEvent evt) {
                jECostsPerKwhHour1StartHourStateChanged(evt);
            }
        });
        jECostsPerKwhHour1StartHour.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jECostsPerKwhHour1StartHourKeyTyped(evt);
            }
        });

        jLabelTo.setFont(new java.awt.Font("SansSerif", 1, 10)); // NOI18N
        jLabelTo.setForeground(new java.awt.Color(0, 153, 153));
        jLabelTo.setText(bundle.getString("To")); // NOI18N

        jECostsPerKwhHour1EndHour.setFont(GUIConst.DIALOG_FONT);
        jECostsPerKwhHour1EndHour.setPreferredSize(new java.awt.Dimension(35, 25));
        jECostsPerKwhHour1EndHour.addChangeListener(new javax.swing.event.ChangeListener() {
            public void stateChanged(javax.swing.event.ChangeEvent evt) {
                jECostsPerKwhHour1EndHourStateChanged(evt);
            }
        });

        jECostsPerKwhHour2StartHour.setFont(GUIConst.DIALOG_FONT);
        jECostsPerKwhHour2StartHour.setPreferredSize(new java.awt.Dimension(35, 25));
        jECostsPerKwhHour2StartHour.addChangeListener(new javax.swing.event.ChangeListener() {
            public void stateChanged(javax.swing.event.ChangeEvent evt) {
                jECostsPerKwhHour2StartHourStateChanged(evt);
            }
        });

        jLabelTo1.setFont(new java.awt.Font("SansSerif", 1, 10)); // NOI18N
        jLabelTo1.setForeground(new java.awt.Color(0, 153, 153));
        jLabelTo1.setText(bundle.getString("To")); // NOI18N

        jLabelCurrency.setFont(GUIConst.DIALOG_FONT);
        jLabelCurrency.setText("    ");

        jLabel4.setFont(GUIConst.DIALOG_FONT);
        jLabel4.setText("(O'Clock)");

        jECostsPerKwhHour2EndHour.setFont(GUIConst.DIALOG_FONT);
        jECostsPerKwhHour2EndHour.setPreferredSize(new java.awt.Dimension(35, 25));
        jECostsPerKwhHour2EndHour.addChangeListener(new javax.swing.event.ChangeListener() {
            public void stateChanged(javax.swing.event.ChangeEvent evt) {
                jECostsPerKwhHour2EndHourStateChanged(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel2Layout = new org.jdesktop.layout.GroupLayout(jPanel2);
        jPanel2.setLayout(jPanel2Layout);
        jPanel2Layout.setHorizontalGroup(
            jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel2Layout.createSequentialGroup()
                .addContainerGap()
                .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING, false)
                    .add(jPanel2Layout.createSequentialGroup()
                        .add(jECostsPerKwhHour1StartHour, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 44, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                        .add(8, 8, 8)
                        .add(jLabelTo, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 19, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jECostsPerKwhHour1EndHour, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 41, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                    .add(jTextEnergyCost))
                .add(38, 38, 38)
                .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING, false)
                    .add(jPanel2Layout.createSequentialGroup()
                        .add(jECostsPerKwhHour2StartHour, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                        .add(8, 8, 8)
                        .add(jLabelTo1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 19, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                        .add(8, 8, 8)
                        .add(jECostsPerKwhHour2EndHour, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 39, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                    .add(jTextEnergyCost2))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel2Layout.createSequentialGroup()
                        .add(jLabelCurrency, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 52, Short.MAX_VALUE)
                        .add(27, 27, 27))
                    .add(jPanel2Layout.createSequentialGroup()
                        .add(jLabel4)
                        .addContainerGap())))
        );

        jPanel2Layout.linkSize(new java.awt.Component[] {jECostsPerKwhHour1EndHour, jECostsPerKwhHour1StartHour, jECostsPerKwhHour2EndHour, jECostsPerKwhHour2StartHour}, org.jdesktop.layout.GroupLayout.HORIZONTAL);

        jPanel2Layout.setVerticalGroup(
            jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel2Layout.createSequentialGroup()
                .add(4, 4, 4)
                .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jECostsPerKwhHour2StartHour, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabelTo1)
                    .add(jECostsPerKwhHour2EndHour, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jECostsPerKwhHour1StartHour, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 21, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabelTo)
                    .add(jECostsPerKwhHour1EndHour, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel4))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabelCurrency)
                    .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                        .add(jTextEnergyCost, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                        .add(jTextEnergyCost2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );

        jPanel2Layout.linkSize(new java.awt.Component[] {jECostsPerKwhHour1EndHour, jECostsPerKwhHour1StartHour, jECostsPerKwhHour2EndHour, jECostsPerKwhHour2StartHour}, org.jdesktop.layout.GroupLayout.VERTICAL);

        jPanel2Layout.linkSize(new java.awt.Component[] {jTextEnergyCost, jTextEnergyCost2}, org.jdesktop.layout.GroupLayout.VERTICAL);

        org.jdesktop.layout.GroupLayout jPanel1Layout = new org.jdesktop.layout.GroupLayout(jPanel1);
        jPanel1.setLayout(jPanel1Layout);
        jPanel1Layout.setHorizontalGroup(
            jPanel1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel1Layout.createSequentialGroup()
                .addContainerGap()
                .add(jLabel32)
                .add(18, 18, 18)
                .add(jPanel2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(118, Short.MAX_VALUE))
        );
        jPanel1Layout.setVerticalGroup(
            jPanel1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel1Layout.createSequentialGroup()
                .add(jPanel2, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                .addContainerGap())
            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel1Layout.createSequentialGroup()
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                .add(jLabel32, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 22, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(20, 20, 20))
        );

        getContentPane().add(jPanel1, new org.netbeans.lib.awtextra.AbsoluteConstraints(10, 320, 640, 100));

        jButtonOK.setFont(GUIConst.BUTTON_FONT);
        jButtonOK.setText(bundle.getString("OK")); // NOI18N
        jButtonOK.setPreferredSize(new java.awt.Dimension(80, 23));
        jButtonOK.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonOKActionPerformed(evt);
            }
        });
        getContentPane().add(jButtonOK, new org.netbeans.lib.awtextra.AbsoluteConstraints(380, 430, -1, -1));

        jButtonCancel.setFont(GUIConst.BUTTON_FONT);
        jButtonCancel.setText(bundle.getString("Cancel")); // NOI18N
        jButtonCancel.setPreferredSize(new java.awt.Dimension(80, 23));
        jButtonCancel.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonCancelActionPerformed(evt);
            }
        });
        getContentPane().add(jButtonCancel, new org.netbeans.lib.awtextra.AbsoluteConstraints(470, 430, -1, -1));

        jPanelMeasurementChannels.setBorder(javax.swing.BorderFactory.createTitledBorder(null, bundle.getString("Measurement_channels"), javax.swing.border.TitledBorder.DEFAULT_JUSTIFICATION, javax.swing.border.TitledBorder.DEFAULT_POSITION, GUIConst.TITLE_FONT, GUIConst.TITLE_COLOR)); // NOI18N
        jPanelMeasurementChannels.setAutoscrolls(true);
        jPanelMeasurementChannels.setPreferredSize(new java.awt.Dimension(195, 41));
        jPanelMeasurementChannels.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT));

        jPanel3.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT));

        jLabel34.setFont(GUIConst.DIALOG_FONT);
        jLabel34.setText(bundle.getString("Description")); // NOI18N
        jLabel34.setPreferredSize(new java.awt.Dimension(140, 14));
        jPanel3.add(jLabel34);

        jLabel36.setFont(GUIConst.DIALOG_FONT);
        jLabel36.setText(bundle.getString("Status")); // NOI18N
        jLabel36.setPreferredSize(new java.awt.Dimension(50, 14));
        jPanel3.add(jLabel36);

        jLabel35.setFont(GUIConst.DIALOG_FONT);
        jLabel35.setText(bundle.getString("Select")); // NOI18N
        jLabel35.setPreferredSize(new java.awt.Dimension(40, 14));
        jPanel3.add(jLabel35);

        jPanelMeasurementChannels.add(jPanel3);

        jScrollPane1.setMaximumSize(new java.awt.Dimension(250, 32767));
        jScrollPane1.setPreferredSize(new java.awt.Dimension(250, 350));

        jPanel5.setMaximumSize(new java.awt.Dimension(250, 32767));
        jPanel5.setLayout(new javax.swing.BoxLayout(jPanel5, javax.swing.BoxLayout.Y_AXIS));
        jScrollPane1.setViewportView(jPanel5);

        jPanelMeasurementChannels.add(jScrollPane1);

        getContentPane().add(jPanelMeasurementChannels, new org.netbeans.lib.awtextra.AbsoluteConstraints(660, 7, 270, 410));

        pack();
    }// </editor-fold>//GEN-END:initComponents

    private void jButtonCopyToActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonCopyToActionPerformed
        // copy current compressor settings to selected compressor
        int copyToIx = jComboCopyToChannel.getSelectedIndex();
        if ( selectedCompressorIx < 0 || copyToIx < 0 || selectedCompressorIx == copyToIx ) {
            return;
        }
        
        Compressor compressor = myCompressors.get( selectedCompressorIx );
        Compressor copyTo = myCompressors.get( copyToIx );
        
        /* copyto function must be used in the same channel */
        if((compressor.hasPowerChannel() && copyTo.hasPowerChannel()) 
                || (!compressor.hasPowerChannel() && !copyTo.hasPowerChannel())){
           
        }else{
            JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_select_the_same_type_channel"));
            return;
        }
        
        Compressor copiedCompressor = compressor.clone();
        if ( copiedCompressor == null ) {
            JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Sorry,_copy_failed."));
            return;
        }
        
        copiedCompressor.Description = copyTo.Description;
        copiedCompressor.setAssignedFlowChannel( copyTo.getAssignedFlowChannel() );
        copiedCompressor.setCurrentChanel( copyTo.getCurrentChanel() );
        
        /*
         * added base on TF found bug:
         * I have selected only one channel for the analyzes (see tick box), 
         * but the statistics shows me all. Should not be like this.
         */
        copiedCompressor.Selected = copyTo.Selected;
        copiedCompressor.assignedPowerChannel(copyTo.getAssignedPowerChannel());
        
        myCompressors.set( copyToIx, copiedCompressor );
        JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Settings_copied_to_selected_compressor."));
    }//GEN-LAST:event_jButtonCopyToActionPerformed

    private void jTextEnergyCostKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextEnergyCostKeyTyped
        EventQueue.invokeLater( new Runnable() {
            public void run() {
                try {
                    if ( selectedCompressorIx < 0 )
                        return;
                    Compressor compressor = myCompressors.get( selectedCompressorIx );
                    
                    if ( jTextEnergyCost.getText().length() > 0 )
                        theCommonValue.getLeakStatistics().setEnergyCostPerKwh1(Double.valueOf(GUIConst.VerifyString( jTextEnergyCost.getText())));
                    else
                         theCommonValue.getLeakStatistics().setEnergyCostPerKwh1( Compressor.DEFAULT_ENERGY_COST_PER_KWH);
                } catch ( Exception e ) {
                    JOptionPane.showMessageDialog( null, MESSAGE_PLEASE_INPUT_NUMBER );
                }
            }});        
    }//GEN-LAST:event_jTextEnergyCostKeyTyped

    private void jTextVoltageKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextVoltageKeyTyped
        EventQueue.invokeLater( new Runnable() {
            public void run() {
                try {
                    if ( selectedCompressorIx < 0 )
                        return;
                    Compressor compressor = myCompressors.get( selectedCompressorIx );
                    
                    if ( jTextVoltage.getText().length() > 0 )
                        compressor.setSupplyVoltage( Float.valueOf( GUIConst.VerifyString( jTextVoltage.getText() )));
                    else
                        compressor.setSupplyVoltage ( Compressor.DEFAULT_SUPPLY_VOTAGE );
                } catch ( Exception e ) {
                    JOptionPane.showMessageDialog( null, MESSAGE_PLEASE_INPUT_NUMBER );
                }
            }});
    }//GEN-LAST:event_jTextVoltageKeyTyped

    private void jTextNoLoadAirKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextNoLoadAirKeyTyped
        getAirDelivery();
    }//GEN-LAST:event_jTextNoLoadAirKeyTyped

    private void jTextUnLoadAirKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextUnLoadAirKeyTyped
        getAirDelivery();
    }//GEN-LAST:event_jTextUnLoadAirKeyTyped

    private void jTextFullLoadAirKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextFullLoadAirKeyTyped
       getAirDelivery();
    }//GEN-LAST:event_jTextFullLoadAirKeyTyped

    private void jTextNoLoadThresholdKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextNoLoadThresholdKeyTyped
        getCosPs();
    }//GEN-LAST:event_jTextNoLoadThresholdKeyTyped

    private void jTextUnLoadThresholdKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextUnLoadThresholdKeyTyped
        getCosPs();
        getAirDelivery();
    }//GEN-LAST:event_jTextUnLoadThresholdKeyTyped

    private void jTextFullLoadThresholdKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextFullLoadThresholdKeyTyped
        getCosPs();
        getAirDelivery();
    }//GEN-LAST:event_jTextFullLoadThresholdKeyTyped

    private void jTextNoLoadCosPKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextNoLoadCosPKeyTyped
        getCosPs();
    }//GEN-LAST:event_jTextNoLoadCosPKeyTyped

    private void jTextUnLoadCosPKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextUnLoadCosPKeyTyped
        getCosPs();
    }//GEN-LAST:event_jTextUnLoadCosPKeyTyped

    private void jTextFullLoadCosPKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextFullLoadCosPKeyTyped
        getCosPs();
    }//GEN-LAST:event_jTextFullLoadCosPKeyTyped

    private void jTextNoLoadCurrentKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextNoLoadCurrentKeyTyped
        getCosPs();
    }//GEN-LAST:event_jTextNoLoadCurrentKeyTyped

    private void jTextUnLoadCurrentKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextUnLoadCurrentKeyTyped
        getCosPs();
    }//GEN-LAST:event_jTextUnLoadCurrentKeyTyped

    private void jTextFullLoadCurrentKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextFullLoadCurrentKeyTyped
        getCosPs();
    }//GEN-LAST:event_jTextFullLoadCurrentKeyTyped

    private void jTextCompressorDescriptionKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextCompressorDescriptionKeyTyped
        EventQueue.invokeLater( new Runnable() {
            public void run() {
                if ( selectedCompressorIx >= 0 ) {
                    String description = jTextCompressorDescription.getText();
                    String origDescription = myCompressors.get( selectedCompressorIx ).Description;
                    myCompressors.get( selectedCompressorIx ).Description = description;
                    mchannelDescriptions[selectedCompressorIx].setText( description );
                    mchannelDescriptions[selectedCompressorIx].setToolTipText(description);
                    myCompressors.get(selectedCompressorIx).getCurrentChanel().setDescription( description );
                    
                    compressorDescriptionChanged = true;
                }
            }
        });
    }//GEN-LAST:event_jTextCompressorDescriptionKeyTyped

    private void jComboCompressorTypeActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jComboCompressorTypeActionPerformed
        if ( atInit ) return;
        
        setCompressorFieldsBasedOnCompressorType();
    }//GEN-LAST:event_jComboCompressorTypeActionPerformed

    private void setCompressorFieldsBasedOnCompressorType() {
        if ( selectedCompressorIx >= 0 ) {
            int type = jComboCompressorType.getSelectedIndex();
            Compressor compressor = myCompressors.get( selectedCompressorIx );
            if ( compressor.Type == type ) return;
            compressor.Type = type;
            if ( type == Compressor.COMPRESSOR_TYPE_VARIABLE_FREQUENCY ) {
                if ( !compressor.VFParameterSet ) {
                    compressor.setStatus( Compressor.STATUS_NOT_READY );
//                    EventQueue.invokeLater( new Runnable() {
//                        public void run() {
//                            try { Thread.sleep( 500 ); } catch ( Exception e ) {}
//                            getVFSettings();
//                        }
//                    });
                } 
            } else 
                compressor.setStatus( Compressor.STATUS_OK );
              
            mchannelStatuses[selectedCompressorIx].setText( compressor.getStatusString() );
            setCompressorTypeRelatedAvailability();
        }        
    }
    
    private void setCompressorSelections( java.awt.event.ActionEvent evt ) {
        for ( int i = 0; i < mchannelSelects.length; i++ ) {
            if ( mchannelSelects[i].isSelected() )
                myCompressors.get(i).Selected = true;
            else
                myCompressors.get(i).Selected = false;
        }
    }
    
    private void jComboCurrentChannelActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jComboCurrentChannelActionPerformed
        //if ( atInit ) return;
        selectedCompressorIx = jComboCurrentChannel.getSelectedIndex();
        setFieldsBasedOnCompressor();
    }//GEN-LAST:event_jComboCurrentChannelActionPerformed

private void jButtonOKActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonOKActionPerformed
    
     if(checkTimeValue() == 0){
           //no set time value
          JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_input_energy_time"));
          return;
     }else if(checkTimeValue() == -1){
           //time format is wrong.
          JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("one_day_has_24hours"));
          return;
     }

    if ( applyChanges() ) {
        theCommonValue.getLeakStatistics().triggerCalculate();    
        dispose();
    }
}//GEN-LAST:event_jButtonOKActionPerformed

/**
 * add on 20091030.be
 * reason : v3-5 : Energy per kwh setting will be different in for different times a day.
 *                The 2 time periods are always 24h in sum and not overlap each other.
 * @return
 */
private int checkTimeValue(){
        theCommonValue.getLeakStatistics().setEnergyCostPerKwh1TimeSplit(false);
        theCommonValue.getLeakStatistics().setEnergyCostPerKwh2TimeSplit(false);
        int flag = -1;
        int onetimestartvalue = numModelECostPerKwh1StartHour.getNumber().intValue();
        int onetimeendvalue = numModelECostPerKwh1EndHour.getNumber().intValue();
        int twotimestartvalue = numModelECostPerKwh2StartHour.getNumber().intValue();
        int twotimeendvalue = numModelECostPerKwh2EndHour.getNumber().intValue();
        //no set time value
        if(onetimestartvalue == 0 &&  onetimeendvalue == 0 && twotimestartvalue == 0 && twotimeendvalue == 0 ){
            return 0;
        }
        // only set the first time value
        if( twotimestartvalue == 0 && twotimeendvalue == 0 && ((onetimestartvalue == 0 &&  onetimeendvalue == 24) || (onetimestartvalue == 24 &&  onetimeendvalue == 0))){
            if(onetimestartvalue > onetimeendvalue ){
                theCommonValue.getLeakStatistics().setEnergyCostPerKwh1StartTime(0);
                theCommonValue.getLeakStatistics().setEnergyCostPerKwh1EndTime(24);
                theCommonValue.getLeakStatistics().setEnergyCostPerKwh2StartTime(0);
                theCommonValue.getLeakStatistics().setEnergyCostPerKwh2EndTime(0);
            }else{
                theCommonValue.getLeakStatistics().setEnergyCostPerKwh2StartTime(0);
                theCommonValue.getLeakStatistics().setEnergyCostPerKwh2EndTime(0);
            }
            flag = 1;
                
        }else if(((twotimestartvalue == 24 && twotimeendvalue == 0) || (twotimestartvalue == 0 && twotimeendvalue == 24)) && onetimestartvalue == 0 &&  onetimeendvalue == 0){
            // only set the second time value
            if(twotimestartvalue > twotimeendvalue ){
                theCommonValue.getLeakStatistics().setEnergyCostPerKwh2StartTime(0);
                theCommonValue.getLeakStatistics().setEnergyCostPerKwh2EndTime(24);
                theCommonValue.getLeakStatistics().setEnergyCostPerKwh1StartTime(0);
                theCommonValue.getLeakStatistics().setEnergyCostPerKwh1EndTime(0);
            }else{
                theCommonValue.getLeakStatistics().setEnergyCostPerKwh1StartTime(0);
                theCommonValue.getLeakStatistics().setEnergyCostPerKwh1EndTime(0);
            }
            flag = 1;
                          
        }else if( onetimestartvalue == 0 &&  onetimeendvalue != 0 && twotimestartvalue != 0 && twotimeendvalue == 24 ){
             //onetimestartvalue = 0; twotimeendvalue = 24
            if( onetimeendvalue !=24 && twotimestartvalue !=24 && (onetimeendvalue == twotimestartvalue) )
               flag = 1;

        }else if(onetimestartvalue != 0 &&  onetimeendvalue != 0 && twotimestartvalue == 0 && twotimeendvalue == 0 ){
            if(onetimestartvalue == onetimeendvalue){
                 theCommonValue.getLeakStatistics().setEnergyCostPerKwh1TimeSplit(true);
                 theCommonValue.getLeakStatistics().setEnergyCostPerKwh2TimeSplit(false);
                 flag = 1;
            }
        }else if(onetimestartvalue == 0 &&  onetimeendvalue == 0 && twotimestartvalue != 0 && twotimeendvalue != 0 ){
            if(twotimestartvalue == twotimeendvalue){
                 theCommonValue.getLeakStatistics().setEnergyCostPerKwh1TimeSplit(false);
                 theCommonValue.getLeakStatistics().setEnergyCostPerKwh2TimeSplit(true);
                 flag = 1;
            }
        }else if(onetimestartvalue != 24 &&  onetimeendvalue != 24 && twotimestartvalue != 24 && twotimeendvalue != 24 ){
                if((onetimestartvalue == twotimeendvalue ) && (onetimeendvalue == twotimestartvalue) && (onetimestartvalue != twotimestartvalue)){
                    if(onetimestartvalue > onetimeendvalue ){
                        theCommonValue.getLeakStatistics().setEnergyCostPerKwh1TimeSplit(true);
                        theCommonValue.getLeakStatistics().setEnergyCostPerKwh2TimeSplit(false);
                    }
                    if(twotimestartvalue > twotimeendvalue){
                        theCommonValue.getLeakStatistics().setEnergyCostPerKwh1TimeSplit(false);
                        theCommonValue.getLeakStatistics().setEnergyCostPerKwh2TimeSplit(true);
                    }
                   flag = 1;
                }
        }

        return flag ;
 
}

private void jButtonCancelActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonCancelActionPerformed
    dispose();
}//GEN-LAST:event_jButtonCancelActionPerformed

private void jButtonThresholdSettingActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonThresholdSettingActionPerformed
    if ( selectedCompressorIx < 0 ) 
        return;
    
//    waitDlg.showUp( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Loading._Please_wait_..." ));
//    EventQueue.invokeLater( new Runnable() {
//            public void run() { getThresHoldSettings(); }
//    });
    
    waitDlg.showUp( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Loading._Please_wait_..." ), new TimerTask() {
        public void run() {
            getThresHoldSettings();
        }
    });
    

}//GEN-LAST:event_jButtonThresholdSettingActionPerformed
   
    private void getThresHoldSettings() {
        ThresholdSettingDialog dlg = new ThresholdSettingDialog(theDB, myCurrentChannels.get(selectedCompressorIx) );
     
        dlg.setFullLoadThreshold(myCompressors.get(selectedCompressorIx).FullLoadCurrentThreshold);
        //v3-9.
        //in the threshold setting graph dialog only 2 threshold lines will be shown -- full load line and shop line.
        //mofidy on 20091019. be.
//        dlg.setUnLoadThreshold(myCompressors.get(selectedCompressorIx).UnLoadCurrentThreshold);
        dlg.setNoLoadThreshold(myCompressors.get(selectedCompressorIx).NoLoadCurrentThreshold);
   
        waitDlg.unShow();
        dlg.setVisible(true);
        if (dlg.userCanceled()) {
            return;
        }
        Compressor compressor = myCompressors.get(selectedCompressorIx);
        compressor.FullLoadCurrentThreshold = dlg.getFullLoadThreshold();

        //v3-9.
        //unload threshold will be calculated automatically as 55% of full load threshold.
        //mofidy on 20091019. be.
//        compressor.UnLoadCurrentThreshold = dlg.getUnLoadThreshold();
        compressor.UnLoadCurrentThreshold =  compressor.FullLoadCurrentThreshold * UNLOAD_THRESHOLD_PERCENT_FULL_LOAD_THRESHOLD;

        compressor.NoLoadCurrentThreshold = dlg.getNoLoadThreshold();
        //    compressor.FullLoadCurrent = dlg.getFullLoadThreshold();
        //    compressor.UnLoadCurrent = dlg.getUnLoadThreshold();
        //    compressor.NoLoadCurrent = dlg.getNoLoadThreshold();
        jTextFullLoadThreshold.setText(String.format("%15.1f", compressor.FullLoadCurrentThreshold).trim());
        jTextUnLoadThreshold.setText(String.format("%15.1f", compressor.UnLoadCurrentThreshold).trim());
        jTextNoLoadThreshold.setText(String.format("%15.1f", compressor.NoLoadCurrentThreshold).trim());

        //v3-9.
        //the full load,unload and stop threshold numbers will be automatically copied into cos p settings .
        //add on 20091019. be.
        jTextFullLoadCurrent.setText( String.format("%15.1f", compressor.FullLoadCurrentThreshold ).trim() );
        jTextUnLoadCurrent.setText( String.format("%15.1f", compressor.UnLoadCurrentThreshold ).trim() );
        jTextNoLoadCurrent.setText( String.format("%15.1f", compressor.NoLoadCurrentThreshold ).trim() );

        getCosPs();
        getAirDelivery();
       

    }

private void jComboFlowChannelActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jComboFlowChannelActionPerformed
    if ( atInit ) return;
    
//    if(initFlowChannel) return;

    // note: in jComboFlowChannel, first option is 'none'
    if ( selectedCompressorIx >= 0 ) {
        int index = jComboFlowChannel.getSelectedIndex();
        NChannelHeader flowChannel = null;
        if ( index > 0 )
            flowChannel =  myFlowChannels.get( index - 1 );
        myCompressors.get( selectedCompressorIx ).setAssignedFlowChannel( flowChannel );
    }
}//GEN-LAST:event_jComboFlowChannelActionPerformed

private void jButtonCosPOKActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonCosPOKActionPerformed
    jDialogCosPSetting.setVisible( false );
}//GEN-LAST:event_jButtonCosPOKActionPerformed

private void jButtonCosPhiSettingActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonCosPhiSettingActionPerformed
    jDialogCosPSetting.setVisible( true );
}//GEN-LAST:event_jButtonCosPhiSettingActionPerformed

private void jButtonVFSettingActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonVFSettingActionPerformed
    getVFSettings();
}//GEN-LAST:event_jButtonVFSettingActionPerformed

private void jECostsPerKwhHour1StartHourStateChanged(javax.swing.event.ChangeEvent evt) {//GEN-FIRST:event_jECostsPerKwhHour1StartHourStateChanged
    //jRadioTimePeriod.setSelected( true );
//    if ( atInit ) return;
     EventQueue.invokeLater( new Runnable() {
            public void run() {
            try {
                if ( selectedCompressorIx < 0 )
                    return;
                 Compressor compressor = myCompressors.get( selectedCompressorIx );             
               //  numModelStartHour.setValue( startTime.get( Calendar.HOUR_OF_DAY ) );
                 theCommonValue.getLeakStatistics().setEnergyCostPerKwh1StartTime(numModelECostPerKwh1StartHour.getNumber().intValue());
             } catch ( Exception e ) {
                 JOptionPane.showMessageDialog( null, MESSAGE_PLEASE_INPUT_NUMBER );
             }
            }});
}//GEN-LAST:event_jECostsPerKwhHour1StartHourStateChanged


private void jECostsPerKwhHour1EndHourStateChanged(javax.swing.event.ChangeEvent evt) {//GEN-FIRST:event_jECostsPerKwhHour1EndHourStateChanged
//    //jRadioTimePeriod.setSelected( true );
//    if ( atInit ) return;
//    getSelectedTime();
        EventQueue.invokeLater( new Runnable() {
            public void run() {
            try {
                if ( selectedCompressorIx < 0 )
                    return;
                 Compressor compressor = myCompressors.get( selectedCompressorIx );
               //  numModelStartHour.setValue( startTime.get( Calendar.HOUR_OF_DAY ) );
                 theCommonValue.getLeakStatistics().setEnergyCostPerKwh1EndTime(numModelECostPerKwh1EndHour.getNumber().intValue());
             } catch ( Exception e ) {
                 JOptionPane.showMessageDialog( null, MESSAGE_PLEASE_INPUT_NUMBER );
             }
            }});
}//GEN-LAST:event_jECostsPerKwhHour1EndHourStateChanged

private void jECostsPerKwhHour2StartHourStateChanged(javax.swing.event.ChangeEvent evt) {//GEN-FIRST:event_jECostsPerKwhHour2StartHourStateChanged
    // TODO add your handling code here:
        EventQueue.invokeLater( new Runnable() {
            public void run() {
            try {
                if ( selectedCompressorIx < 0 )
                    return;
                 Compressor compressor = myCompressors.get( selectedCompressorIx );
               //  numModelStartHour.setValue( startTime.get( Calendar.HOUR_OF_DAY ) );
                theCommonValue.getLeakStatistics().setEnergyCostPerKwh2StartTime(numModelECostPerKwh2StartHour.getNumber().intValue());
             } catch ( Exception e ) {
                 JOptionPane.showMessageDialog( null, MESSAGE_PLEASE_INPUT_NUMBER );
             }
            }});
}//GEN-LAST:event_jECostsPerKwhHour2StartHourStateChanged

private void jECostsPerKwhHour2EndHourStateChanged(javax.swing.event.ChangeEvent evt) {//GEN-FIRST:event_jECostsPerKwhHour2EndHourStateChanged
    // TODO add your handling code here:
     EventQueue.invokeLater( new Runnable() {
            public void run() {
            try {
                if ( selectedCompressorIx < 0 )
                    return;
                 Compressor compressor = myCompressors.get( selectedCompressorIx );
               //  numModelStartHour.setValue( startTime.get( Calendar.HOUR_OF_DAY ) );
                 theCommonValue.getLeakStatistics().setEnergyCostPerKwh2EndTime(numModelECostPerKwh2EndHour.getNumber().intValue());
             } catch ( Exception e ) {
                 JOptionPane.showMessageDialog( null, MESSAGE_PLEASE_INPUT_NUMBER );
             }
            }});
}//GEN-LAST:event_jECostsPerKwhHour2EndHourStateChanged

private void jTextEnergyCost2KeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextEnergyCost2KeyTyped
    // TODO add your handling code here:
     EventQueue.invokeLater( new Runnable() {
            public void run() {
            try {
                if ( selectedCompressorIx < 0 )
                    return;
                Compressor compressor = myCompressors.get( selectedCompressorIx );

                if ( jTextEnergyCost2.getText().length() > 0 )
                    theCommonValue.getLeakStatistics().setEnergyCostPerKwh2(Double.valueOf(GUIConst.VerifyString( jTextEnergyCost2.getText())));
                else
                    theCommonValue.getLeakStatistics().setEnergyCostPerKwh2(Compressor.DEFAULT_ENERGY_COST_PER_KWH);
                } catch ( Exception e ) {
                    JOptionPane.showMessageDialog( null, MESSAGE_PLEASE_INPUT_NUMBER );
                }
            }});
}//GEN-LAST:event_jTextEnergyCost2KeyTyped

private void jTextFullLoadThresholdKeyReleased(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextFullLoadThresholdKeyReleased
    // TODO add your handling code here:
    //add on 20091019.be.
    setFullAndStopThresholdByHand();
}//GEN-LAST:event_jTextFullLoadThresholdKeyReleased

private void jTextNoLoadThresholdKeyReleased(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextNoLoadThresholdKeyReleased
    // TODO add your handling code here:
    //add on 20091019.be.
    setFullAndStopThresholdByHand();
}//GEN-LAST:event_jTextNoLoadThresholdKeyReleased

private void jECostsPerKwhHour1StartHourKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jECostsPerKwhHour1StartHourKeyTyped
    // TODO add your handling code here:
//    System.out.println("jECostsPerKwhHour1StartHour="+jECostsPerKwhHour1StartHour.);
}//GEN-LAST:event_jECostsPerKwhHour1StartHourKeyTyped

private void getVFSettings() {
    if ( selectedCompressorIx >= 0 ) {
        Compressor compressor = myCompressors.get( selectedCompressorIx );
        VFSettingDialog vfDlg = new VFSettingDialog( compressor );
        vfDlg.setVisible( true );
        if ( compressor.VFParameterSet ) {
            compressor.setStatus( Compressor.STATUS_OK );
            mchannelStatuses[selectedCompressorIx].setText( compressor.getStatusString() );
        }
    }    
}

/** Why we need this function: when user change currency in analyze settings, before clicking 'OK' 
 *  changes won't be in LeakStatistics object, and shouldn't be. So setting currency field manually
 *  from outside is necessary. 
 */
public void setCurrency( String currency ) {
    jLabelCurrency.setText( currency );
}

//add on 20091015.be. v3-3.
public void setAirDeliveryUnit( String unit ) {
    jLabAirUnit.setText( unit );
}

    private void getCosPs() {
        EventQueue.invokeLater( new Runnable() {
            public void run() {
                try {
                    if ( selectedCompressorIx < 0 )
                        return;
                    Compressor compressor = myCompressors.get( selectedCompressorIx );
                    
                    // ------------
                    if ( jTextFullLoadCurrent.getText().length() > 0 )
                        compressor.FullLoadCurrent = Float.valueOf( GUIConst.VerifyString( jTextFullLoadCurrent.getText() ));
                    else
                        compressor.FullLoadCurrent = Compressor.DEFAULT_COSP_PARAMETER;
  
                    if ( jTextUnLoadCurrent.getText().length() > 0 )
                        compressor.UnLoadCurrent = Float.valueOf( GUIConst.VerifyString( jTextUnLoadCurrent.getText() ));
                    else
                        compressor.UnLoadCurrent = Compressor.DEFAULT_COSP_PARAMETER;

                    
                    if ( jTextNoLoadCurrent.getText().length() > 0 )
                        compressor.NoLoadCurrent = Float.valueOf( GUIConst.VerifyString( jTextNoLoadCurrent.getText() ));
                    else
                        compressor.NoLoadCurrent = Compressor.DEFAULT_COSP_PARAMETER;
                    
                    // ------------
                    if ( jTextFullLoadCosP.getText().length() > 0 )
                        compressor.FullLoadCosP = Float.valueOf( GUIConst.VerifyString( jTextFullLoadCosP.getText() ));
                    else
                        compressor.FullLoadCosP = Compressor.DEFAULT_COSP_PARAMETER;
                    
                    if ( jTextUnLoadCosP.getText().length() > 0 )
                        compressor.UnLoadCosP = Float.valueOf( GUIConst.VerifyString( jTextUnLoadCosP.getText() ));
                    else
                        compressor.UnLoadCosP = Compressor.DEFAULT_COSP_PARAMETER;
                    
                    if ( jTextNoLoadCosP.getText().length() > 0 )
                        compressor.NoLoadCosP = Float.valueOf( GUIConst.VerifyString( jTextNoLoadCosP.getText() ));
                    else
                        compressor.NoLoadCosP = Compressor.DEFAULT_COSP_PARAMETER;
                    
                    // ------------
                    if ( jTextFullLoadThreshold.getText().length() > 0 )
                        compressor.FullLoadCurrentThreshold = Float.valueOf( GUIConst.VerifyString( jTextFullLoadThreshold.getText() ));
                    else
                        compressor.FullLoadCurrentThreshold = Compressor.DEFAULT_COSP_PARAMETER;

                    //v3-9.
                    //unload threshold will be calculated automatically as 55% of full load threshold.
                    //mofidy on 20091019. be.
//                    if ( jTextUnLoadThreshold.getText().length() > 0 )
//                        compressor.UnLoadCurrentThreshold = Float.valueOf( GUIConst.VerifyString( jTextUnLoadThreshold.getText() ));
//                    else
//                        compressor.UnLoadCurrentThreshold = Compressor.DEFAULT_COSP_PARAMETER;
                    compressor.UnLoadCurrentThreshold = compressor.FullLoadCurrentThreshold * UNLOAD_THRESHOLD_PERCENT_FULL_LOAD_THRESHOLD;
                    
                    if ( jTextNoLoadThreshold.getText().length() > 0 )
                        compressor.NoLoadCurrentThreshold = Float.valueOf( GUIConst.VerifyString( jTextNoLoadThreshold.getText() ));
                    else
                        compressor.NoLoadCurrentThreshold = Compressor.DEFAULT_COSP_PARAMETER;
                    
                } catch ( Exception e ) {
                    JOptionPane.showMessageDialog( null, MESSAGE_PLEASE_INPUT_NUMBER );
                }
            }});
    }
    
    private void getAirDelivery() {
        EventQueue.invokeLater( new Runnable() {
            public void run() {
                try {
                    if ( selectedCompressorIx < 0 )
                        return;
                    Compressor compressor = myCompressors.get( selectedCompressorIx );
                    
//                    compressor.AirDeliveryUnit = (String) jComboAirUnit.getSelectedItem();
                    
                    if ( jTextFullLoadAir.getText().length() > 0 )
                        compressor.FullLoadAirDelivery = Float.valueOf( GUIConst.VerifyString( jTextFullLoadAir.getText() ));
                    else
                        compressor.FullLoadAirDelivery = Compressor.DEFAULT_AIR_DELIVERY;

//                    System.out.println("compressorSetting dialog "+compressor.Description+" compressor.FullLoadAirDelivery="+compressor.FullLoadAirDelivery);
                    
                    if ( jTextUnLoadAir.getText().length() > 0 )
                        compressor.UnLoadAirDelivery = Float.valueOf( GUIConst.VerifyString( jTextUnLoadAir.getText() ));
                    else
                        compressor.UnLoadAirDelivery = Compressor.DEFAULT_AIR_DELIVERY;

                    if ( jTextNoLoadAir.getText().length() > 0 )
                        compressor.NoLoadAirDelivery = Float.valueOf( GUIConst.VerifyString( jTextNoLoadAir.getText() ));
                    else
                        compressor.NoLoadAirDelivery = Compressor.DEFAULT_AIR_DELIVERY;
                    
                    NChannelHeader currentChannel = compressor.getCurrentChanel();
                    //double fullLoadUnLoadCurrentDelta = compressor.FullLoadCurrentThreshold - compressor.UnLoadCurrentThreshold; 
                    //double airDeliveryRatio = 0;
                    //if ( fullLoadUnLoadCurrentDelta > 0 )
                        //airDeliveryRatio = ( compressor.FullLoadAirDelivery - compressor.UnLoadAirDelivery ) / fullLoadUnLoadCurrentDelta; 
//                    compressor.MaxAirDelivery = ( currentChannel.Max - compressor.UnLoadCurrentThreshold ) * airDeliveryRatio;
//                    compressor.MinAirDelivery = ( currentChannel.Min - compressor.UnLoadCurrentThreshold ) * airDeliveryRatio;
                    compressor.MaxAirDelivery = compressor.FullLoadAirDelivery;
                    compressor.MinAirDelivery = 0;
                    if ( compressor.MaxAirDelivery < 0 ) compressor.MaxAirDelivery = 0;
                    if ( compressor.MinAirDelivery < 0 ) compressor.MinAirDelivery = 0;
                } catch ( Exception e ) {
                    JOptionPane.showMessageDialog( null, MESSAGE_PLEASE_INPUT_NUMBER );
                }
            }});
        
    }

    /**
     * Synchronize unload threshold and fullload/unload/stop current value when edit full load threshold or stop threshold by hand
     */
    private void setFullAndStopThresholdByHand(){
        Compressor compressor = myCompressors.get(selectedCompressorIx);
        if(jTextFullLoadThreshold.getText().length() > 0){
//            System.out.println("jTextFullLoadThreshold.getText()="+jTextFullLoadThreshold.getText());
            compressor.FullLoadCurrentThreshold = Double.valueOf(GUIConst.VerifyString(jTextFullLoadThreshold.getText()));
        }else{
            compressor.FullLoadCurrentThreshold = 0 ;
        }
        compressor.UnLoadCurrentThreshold =  compressor.FullLoadCurrentThreshold * UNLOAD_THRESHOLD_PERCENT_FULL_LOAD_THRESHOLD;
        if(jTextNoLoadThreshold.getText().length() > 0){
            compressor.NoLoadCurrentThreshold = Double.valueOf(GUIConst.VerifyString(jTextNoLoadThreshold.getText()));
        }else{
            compressor.NoLoadCurrentThreshold = 0;
        }

        jTextUnLoadThreshold.setText(String.format("%15.1f", compressor.UnLoadCurrentThreshold).trim());

        //v3-9.
        //the full load,unload and stop threshold numbers will be automatically copied into cos p settings .
        //add on 20091019. be.
        jTextFullLoadCurrent.setText( String.format("%15.1f", compressor.FullLoadCurrentThreshold ).trim() );
        jTextUnLoadCurrent.setText( String.format("%15.1f", compressor.UnLoadCurrentThreshold ).trim() );
        jTextNoLoadCurrent.setText( String.format("%15.1f", compressor.NoLoadCurrentThreshold ).trim() );
//        System.out.println("compressor.FullLoadCurrentThreshold="+compressor.FullLoadCurrentThreshold);

    }
    
    private final int START_X = 100;
    private final int START_Y = 100;
    private final int WIDTH = 950;
    private final int HEIGHT = 500;
    private final int COSP_DIALOG_START_X = 200;
    private final int COSP_DIALOG_START_Y = 200;
    private final int COSP_DIALOG_WIDTH = 400;
    private final int COSP_DIALOG_HEIGHT = 300;
    
    private final int MCHANNEL_FIELDS_START_X = 30;
    private final int MCHANNEL_FIELDS_START_Y = 50;
    private final int MCHANNEL_FIELDS_HEIGHT = 20;
    private final int MCHANNEL_FIELDS_GAP = 5;
    private final int MCHANNEL_DESCRIPTION_FIELD_WIDTH = 130;
    private final int MCHANNEL_STATUS_FIELD_WIDTH = 40;
    private final int MCHANNEL_SELECT_FIELD_WIDTH = 20;
        
    private final String MESSAGE_PLEASE_INPUT_NUMBER = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_input_a_positive_float_number_for_this_field.");
    
    private final String MESSAGE_TIME_VALUE_MAX = "The time value max is 24 h ";

    private final String FORMAT_STRING_1_DIGIT = "%10.1f";
    private final String FORMAT_STRING_2_DIGIT = "%10.2f";

    
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.ButtonGroup buttonGroupShowCurrentChannelAs;
    private javax.swing.JButton jButtonCancel;
    private javax.swing.JButton jButtonCopyTo;
    private javax.swing.JButton jButtonCosPOK;
    private javax.swing.JButton jButtonCosPhiSetting;
    private javax.swing.JButton jButtonOK;
    private javax.swing.JButton jButtonThresholdSetting;
    private javax.swing.JButton jButtonVFSetting;
    private javax.swing.JComboBox jComboCompressorType;
    private javax.swing.JComboBox jComboCopyToChannel;
    private javax.swing.JComboBox jComboCurrentChannel;
    private javax.swing.JComboBox jComboFlowChannel;
    private javax.swing.JDialog jDialogCosPSetting;
    private javax.swing.JSpinner jECostsPerKwhHour1EndHour;
    private javax.swing.JSpinner jECostsPerKwhHour1StartHour;
    private javax.swing.JSpinner jECostsPerKwhHour2EndHour;
    private javax.swing.JSpinner jECostsPerKwhHour2StartHour;
    private javax.swing.JLabel jLabAirUnit;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JLabel jLabel18;
    private javax.swing.JLabel jLabel19;
    private javax.swing.JLabel jLabel2;
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
    private javax.swing.JLabel jLabel4;
    private javax.swing.JLabel jLabel40;
    private javax.swing.JLabel jLabel41;
    private javax.swing.JLabel jLabelCurrency;
    private javax.swing.JLabel jLabelTo;
    private javax.swing.JLabel jLabelTo1;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JPanel jPanel2;
    private javax.swing.JPanel jPanel3;
    private javax.swing.JPanel jPanel4;
    private javax.swing.JPanel jPanel5;
    private javax.swing.JPanel jPanelMeasurementChannels;
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JTextField jTextCompressorDescription;
    private javax.swing.JTextField jTextEnergyCost;
    private javax.swing.JTextField jTextEnergyCost2;
    private javax.swing.JTextField jTextFullLoadAir;
    private javax.swing.JTextField jTextFullLoadCosP;
    private javax.swing.JTextField jTextFullLoadCurrent;
    private javax.swing.JTextField jTextFullLoadThreshold;
    private javax.swing.JTextField jTextNoLoadAir;
    private javax.swing.JTextField jTextNoLoadCosP;
    private javax.swing.JTextField jTextNoLoadCurrent;
    private javax.swing.JTextField jTextNoLoadThreshold;
    private javax.swing.JTextField jTextUnLoadAir;
    private javax.swing.JTextField jTextUnLoadCosP;
    private javax.swing.JTextField jTextUnLoadCurrent;
    private javax.swing.JTextField jTextUnLoadThreshold;
    private javax.swing.JTextField jTextVoltage;
    // End of variables declaration//GEN-END:variables
    
    private JLabel[] mchannelDescriptions;
    private JLabel[] mchannelStatuses;
    //private JTextField[] mchannelDescriptions;
    //private JTextField[] mchannelStatuses;
    private JCheckBox[] mchannelSelects;
    
    private boolean atInit = false;
    private NewWaitingDialog waitDlg = new NewWaitingDialog();
    
    private int selectedCompressorIx = -1;  // index of selected item of jComboCurrentChannels
    private boolean compressorDescriptionChanged = false;
    
    private CommonValue theCommonValue;
    private CSMDF theDB;
    private Texts myTexts;
    private ArrayList<Compressor> myCompressors;
    private ArrayList<NChannelHeader> myCurrentChannels;
    private ArrayList<NChannelHeader> myFlowChannels;
    //modify on 20091016.be
    //v3-5 : Energy per kwh setting will be different in for different times a day.
    private SpinnerNumberModel numModelECostPerKwh1StartHour;
    private SpinnerNumberModel numModelECostPerKwh1EndHour;
    private SpinnerNumberModel numModelECostPerKwh2StartHour;
    private SpinnerNumberModel numModelECostPerKwh2EndHour;
    //v3-9.
    //unload threshold will be calculated automatically as 55% of full load threshold.
    //add on 20091019. be.
    private double UNLOAD_THRESHOLD_PERCENT_FULL_LOAD_THRESHOLD = 0.55;
    
    private final static int ACTIVE_POWER_CHANNEL_ID = 5;

    private final String POWER_CHANNEL_THRESHOLD_MSG = "<html>" + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Load/Unload<br>Threshold") + "(kW)</html>";
    private final String CURRENT_CHANNEL_THRESHOLD_MSG = "<html>" + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Load/Unload<br>Threshold") + "(A)</html>";
//    private boolean initFlowChannel = false;
    
    
    /**
     * Check a protocol header is still has power channel after add current channel
     * @param pheader
     * @param chheaders
     * 
     */
    private void checkIfStillHasPowerChannel(NProtocolHeader pheader, ArrayList<NChannelHeader> chheaders){
        
        if(pheader == null || chheaders == null){
            return;
        }
        
        String powerChannelPath = null;
        String compressorAssignFlowChannelWholePath = null;
        String splitChar = "_";
        NChannelHeader compressorAssignedPowerChannel;
        for ( NChannelHeader chheader : chheaders ) {

            if ( MeasurementUnit.IsPowerUnit( chheader.getUnitText() )) {
                //check this power channel is assigned to compressor
                boolean isAssigned = false;
                powerChannelPath = chheader.newDeviceID + splitChar + chheader.subDeviceID 
                        + splitChar + chheader.sensorID + splitChar + chheader.channelID;
                for(Compressor compressor : myCompressors){
                    if(compressor.hasPowerChannel()){
                        compressorAssignedPowerChannel = compressor.getAssignedPowerChannel();
                        compressorAssignFlowChannelWholePath = compressorAssignedPowerChannel.newDeviceID + splitChar + compressorAssignedPowerChannel.subDeviceID 
                        + splitChar + compressorAssignedPowerChannel.sensorID + splitChar + compressorAssignedPowerChannel.channelID;

                        if(compressorAssignFlowChannelWholePath == null){
                            continue;
                        }
                        if(compressorAssignFlowChannelWholePath.equals(powerChannelPath)){
                            isAssigned = true;
                            break;
                        }
                    }

                }

                if(isAssigned){
                    continue;
                }

                Compressor compressor = new Compressor();                 
                compressor.setCurrentChanel( null );

                compressor.assignedPowerChannel(chheader);


                double valueLength = chheader.Max - chheader.Min;
                compressor.Unit = chheader.getUnitText();

                compressor.FullLoadCurrentThreshold = chheader.Max - valueLength * 0.1f;

                //v3-9.
                //unload threshold will be calculated automatically as 55% of full load threshold.
                //add on 20091019. be.
//                    compressor.UnLoadCurrentThreshold = chheader.Min + valueLength * 0.3f;
                compressor.UnLoadCurrentThreshold = compressor.FullLoadCurrentThreshold * UNLOAD_THRESHOLD_PERCENT_FULL_LOAD_THRESHOLD;

                //compressor.NoLoadCurrentThreshold = chheader.Min + valueLength * 0.1f;
                compressor.NoLoadCurrentThreshold = compressor.UnLoadCurrentThreshold * 0.1;
                // cos p
                compressor.FullLoadCurrent = compressor.FullLoadCurrentThreshold;
                compressor.UnLoadCurrent = compressor.UnLoadCurrentThreshold;
                compressor.NoLoadCurrent = compressor.NoLoadCurrentThreshold;
                compressor.FullLoadCosP = compressor.DEFAULT_FULL_LOAD_COSP;
                compressor.UnLoadCosP = compressor.DEFAULT_UN_LOAD_COSP;
                // end of cos p
                if ( chheader.getDescription().length() > 0 )
                    compressor.Description = chheader.getDescription();
                else
                    compressor.Description = pheader.getDescription() + "." + chheader.ChannelNumber;

                // Feb 26, 2009  Add last 4 digits of device ID to compressor's description to distinguash 
                // channels from record files with identical name from differnt device
//                    String idString = String.valueOf( pheader.DeviceID );
//                    int beginIndex = idString.length() - 4;
//                    if ( beginIndex < 0 ) beginIndex = 0;
//                    compressor.Description = idString.substring( beginIndex, idString.length() ) + "_" + compressor.Description;
                String oldCompressorDes = compressor.Description;
                compressor.Description = theCommonValue.getViewChannelFullName(pheader,chheader);
                if(compressor.Description == null){
                    compressor.Description = oldCompressorDes;
                }

                myCompressors.add( compressor );
                myCurrentChannels.add( chheader );

                jComboCurrentChannel.addItem( compressor.Description );
                jComboCopyToChannel.addItem( compressor.Description );

            }

//            nameTail++; if ( nameTail == 10 ) nameTail++;
        } // chheader cycle
      
    }
    
//    public void resetAssignedFlowChannelFieldBasedOnCompressor(){
//        if ( selectedCompressorIx < 0 ) return;
//        Compressor compressor = myCompressors.get( selectedCompressorIx );
//
//        setAssignedFlowChannelFieldBasedOnCompressor(compressor);
//    }
}
