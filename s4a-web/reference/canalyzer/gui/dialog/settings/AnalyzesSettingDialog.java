/*
 * AnalyzesSettingDialog.java
 *
 * Created on 2008年7月24日, 下午6:02
 */

package com.cs.canalyzer.gui.dialog.settings;

import com.cs.canalyzer.gui.GUIConst;
import com.cs.canalyzer.gui.dialog.NewWaitingDialog;
import com.cs.canalyzer.structs.CommonValue;
import com.cs.canalyzer.structs.Compressor;
import com.cs.canalyzer.structs.LeakStatistics;
import com.cs.canalyzer.structs.MeasurementUnit;
import com.cs.canalyzer.structs.ViewChannel;
import com.cs.canalyzer.structs.ViewOptions;
import com.cs.database.CSMDF;
import com.cs.database.NChannelHeader;
import com.cs.database.NProtocolHeader;
import java.awt.EventQueue;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.TimerTask;
import javax.swing.ButtonGroup;
import javax.swing.ImageIcon;
import javax.swing.JOptionPane;
import javax.swing.SpinnerNumberModel;

/**
 *
 * @author  wolf
 */
public class AnalyzesSettingDialog extends javax.swing.JFrame {
    
     ArrayList<NChannelHeader> assignFlowChannel = new  ArrayList<NChannelHeader>();
    
    /** Creates new form AnalyzesSettingDialog */
    public AnalyzesSettingDialog( CommonValue common, CompressorSettingDialog compressorSettingDlg ) {
        this.theCommonValue = common;
        this.theLeakStatistics = common.getLeakStatistics();
        this.myViewOptions = common.getViewOptions();
        this.myCompressorSettingDlg = compressorSettingDlg;      
       
        myInit();
       
    }
    
    private void myInit() {
        initComponents();
        
        jComboAnalyzesType.setModel(new javax.swing.DefaultComboBoxModel(new String[] {
            java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Flow-_Analyzes"), 
            java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Compressor-_Analyzes"), 
            java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("System-_Analyzes") }));
        
        buttonGroupReportType.add( jRadioDay );
        buttonGroupReportType.add( jRadioWeek );
        buttonGroupReportType.add( jRadioTimePeriod  ); //modify on 29901015,be. CAA v3
        
        atInit = true;

        initValue();
        
        setFieldsAvailability();
        
        atInit = false;

        setIconImage( new ImageIcon( getClass().getResource( GUIConst.IMAGE_PATH + GUIConst.LOGO_FILE_NAME)).getImage() );         
        setBounds( START_X, START_Y, WIDTH, HEIGHT );
        
        //modify on 20091015.be. CAA V3 requirt to visible.
        //jRadioTimePeriod.setVisible( false );

        //add on 20091111,be
        //v3-3 : the "show current chanael as flow" option move to "analyze settings" dialog,and it will be the same for every compressor.
        ButtonGroup buttonGroupShowChannel = new ButtonGroup();
        buttonGroupShowChannel.add(jRadioCurrent);
        buttonGroupShowChannel.add(jRadioFlow);
        
        
        initAssignFlowChannelForSystemAnalyze(theCommonValue,theCommonValue.getDataBase());
        if(jComboAnalyzesType.getSelectedIndex() == LeakStatistics.ANALYZE_TYPE_SYSTEM){
//            checkFullLoadAirDeliveryData(theCommonValue, theCommonValue.getDataBase());
            theCommonValue.setSystemFlowChannelTmp(theLeakStatistics.getSystemFlowChannel());
            if(!assigedFlowChannelBaseOnSystemAnalyze()){
                jComBAssignFlowChannel.setSelectedIndex( 0 );
            }
        }else{
            theCommonValue.setSystemFlowChannelTmp(null);
            jLabel7.setVisible(false);
            jComBAssignFlowChannel.setVisible(false);
        }

    }
    
    private void initValue() {
        // note: here we assume the selection order is the same with LeakStatistics definition
        jComboAnalyzesType.setSelectedIndex ( theLeakStatistics.analyzeType );
        
        ArrayList<NProtocolHeader> pheaders = theCommonValue.getProtocolHeaders();
        if ( pheaders.size() > 0 )
            jLabelDescription.setText( pheaders.get(0).getDescription() );
        
        initTimeFields();
                
        // this has to be after the init time fields otherwise time fields event will trigger
        // changes on these fields.
        switch ( theCommonValue.getReportType() ) {
            case CommonValue.REPORT_TYPE_DAY: jRadioDay.setSelected( true ); break;
            case CommonValue.REPORT_TYPE_WEEK: jRadioWeek.setSelected( true ); break;
            case CommonValue.REPORT_TYPE_PERIOD: jRadioTimePeriod.setSelected( true ); break;
            default: jRadioDay.setSelected( true );
        }
       // jRadioTimePeriod.setSelected( true );//modify on 20091015.be. CAA V3 requirt to visible.

        jCheckStartOnMonday.setSelected( theCommonValue.weekStartFromMonday() );
        
        jTextCostPerM3.setText( String.format("%10.4f", theLeakStatistics.energyCostPerM3 ).trim() );
        
        jTextCurrency.setText( theLeakStatistics.currencyEnergyCost );

        //add air delivery unit. 20091015,be.
        for ( String unit : MeasurementUnit.FLOW_RATE_UNITS )
            jComboAirUnit.addItem( unit );
        //show current channel as flow
        if ( theCommonValue.isShowAsFlow() )
            jRadioFlow.setSelected( true );
        else
            jRadioCurrent.setSelected( true );
        //co2 emmission per kwh
        jTextCO2Emmision.setText(String.format( FORMAT_STRING_2_DIGIT, theLeakStatistics.getCO2EmmisionPerKWh()).trim());
        //working hour per year.
        jTextWorkHourPerYear.setText(String.valueOf(theLeakStatistics.WORKING_HOUR_PER_YEAR));
        //if display co2 emission in report
        if(theLeakStatistics.isDiaplay_CO2EmmisionPerKWh_in_Report()){
            jCBDiaplayCo2InReport.setSelected(true);
        }else{
            jCBDiaplayCo2InReport.setSelected(false);
        } 
        
    }
    
    private void initTimeFields() {
        startTime = Calendar.getInstance();
        startTime.setTimeInMillis( theLeakStatistics.getStartTime().getTime() );
        //startTime.setTimeInMillis( myViewOptions.startTime.getTime() );
        endTime = Calendar.getInstance();
        endTime.setTimeInMillis( theLeakStatistics.getEndTime().getTime() );
        
        initStartDate = Calendar.getInstance();
        initEndDate = Calendar.getInstance();
        initStartDate.setTimeInMillis( startTime.getTimeInMillis() );
        initStartDate.set( Calendar.HOUR_OF_DAY, 0 );
        initStartDate.set( Calendar.MINUTE, 0 );
        initStartDate.set( Calendar.SECOND, 0 );
        initEndDate.setTimeInMillis( endTime.getTimeInMillis() );
        initEndDate.set( Calendar.HOUR_OF_DAY, 23 );
        initEndDate.set( Calendar.MINUTE, 59 );
        initEndDate.set( Calendar.SECOND, 59 );
        
        numModelStartHour = new SpinnerNumberModel( 0, 0, 24, 1 );
        jSpinnerStartHour.setModel( numModelStartHour );
        numModelEndHour = new SpinnerNumberModel( 0, 0, 24, 1 );
        jSpinnerEndHour.setModel( numModelEndHour );        
  
        try {
            getProtocolsStartAndEndTime();
            
            jXDatePickerStart.setDate( startTime.getTime() );
            numModelStartHour.setValue( startTime.get( Calendar.HOUR_OF_DAY ) );
            jXDatePickerEnd.setDate( endTime.getTime() );
            if ( endTime.get( Calendar.MINUTE ) > 0 )
                numModelEndHour.setValue( endTime.get( Calendar.HOUR_OF_DAY ) + 1 );
            else
                numModelEndHour.setValue( endTime.get( Calendar.HOUR_OF_DAY ) );

            String s = GUIConst.DEFAULT_DATE_AND_TIME_SHORT_FORMAT( protocolsStartTime ) + "   " + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("___to___") +
                    GUIConst.DEFAULT_DATE_AND_TIME_SHORT_FORMAT( protocolsEndTime );
            jLabelRecordPeriod.setText( s ); 
            s = GUIConst.DEFAULT_DATE_AND_TIME_SHORT_FORMAT( startTime )  + "   " + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("___to___") +
                    " " + GUIConst.DEFAULT_DATE_FORMAT(endTime) + " " +  numModelEndHour.getValue() + ":00";
            jLabelSelectedPeriod.setText( s );
        } catch ( Exception e ) {
            System.out.println( "initTimeFields: " + e.getMessage() );
        }
                
    }
    
    private void getProtocolsStartAndEndTime() {
        protocolsStartTime = new Timestamp( System.currentTimeMillis() );
        protocolsEndTime =  new Timestamp( System.currentTimeMillis() );
        
        protocolsValidStartTime = new Timestamp( System.currentTimeMillis() );
        protocolsValidEndTime = new Timestamp( System.currentTimeMillis() );
                
        ArrayList<NProtocolHeader> pheaders = theCommonValue.getProtocolHeaders();
        for ( int i = 0; i < pheaders.size(); i++ ) {
            NProtocolHeader pheader = pheaders.get(i);
            if ( i == 0 || protocolsStartTime.getTime() > pheader.StartTime )
                protocolsStartTime.setTime( pheader.StartTime );
            if ( i == 0 || protocolsEndTime.getTime() < pheader.StopTime )
                protocolsEndTime.setTime( pheader.StopTime );
        }
        
        protocolsValidStartTime.setTime(protocolsStartTime.getTime());
        protocolsValidEndTime.setTime(protocolsEndTime.getTime());
        
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis( protocolsEndTime.getTime() );
        if ( c.get( Calendar.MINUTE ) > 0 ) {
            c.set( Calendar.HOUR_OF_DAY, c.get( Calendar.HOUR_OF_DAY ) + 1 );
            c.set( Calendar.MINUTE, 0 );
            c.set( Calendar.SECOND, 0 );
            protocolsEndTime.setTime( c.getTimeInMillis() );
        }
    }
    
    private boolean applyChanges(NewWaitingDialog waitDlg) {
        if ( !validateInput(waitDlg) )
            return false;
        
        if ( ( jComboAnalyzesType.getSelectedIndex() == LeakStatistics.ANALYZE_TYPE_COMPRESSOR || 
                jComboAnalyzesType.getSelectedIndex() == LeakStatistics.ANALYZE_TYPE_SYSTEM ) &&
                ( theCommonValue.getCompressors() == null || theCommonValue.getCompressors().isEmpty() )) {
            if(waitDlg != null){
                waitDlg.unShow();
            }
            JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_setup_compressor_settings_or_change_analyzes_type_to_'Flow_Analyzes'.") );
            return false;
        }

        if ( ( jComboAnalyzesType.getSelectedIndex() == LeakStatistics.ANALYZE_TYPE_COMPRESSOR ||
                jComboAnalyzesType.getSelectedIndex() == LeakStatistics.ANALYZE_TYPE_SYSTEM ) &&
                ( theCommonValue.getCompressors() == null || theCommonValue.getCompressors().isEmpty() ) && jRadioFlow.isSelected()) {
            if(waitDlg != null){
                waitDlg.unShow();
            }
            JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_setup_compressor_settings_or_change_analyzes_type_to_'Flow_Analyzes'.") );
            return false;
        }
//        if(!checkFullLoadAirDeliveryData()){
////            JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_setup_compressor_settings_or_change_analyzes_type_to_'Flow_Analyzes'.") );
//            return false;
//        }
        //add on 20091015. v3-3
        // the order is important!
        //show current record as:
//        if ( jRadioFlow.isSelected() ){
//            if( theCommonValue.getCompressors() == null || theCommonValue.getCompressors().isEmpty() ){
//                if(theCommonValue.getLeakStatistics().getCompressors().size() > 0){
//                    theCommonValue.setCompressors(theCommonValue.getLeakStatistics().getCompressors());
//                    theCommonValue.setShowCurrentValuesAsFlow( true );
//                }
//            }else{
//                 theCommonValue.setShowCurrentValuesAsFlow( true );
//            }
//        }else{
//             if( theCommonValue.getCompressors() == null || theCommonValue.getCompressors().isEmpty() ){
//                  if(theCommonValue.getLeakStatistics().getCompressors().size() > 0){
//                        theCommonValue.setCompressors(theCommonValue.getLeakStatistics().getCompressors());
//                        theCommonValue.setShowCurrentValuesAsFlow( false );
//                  }
//            }else{
//                 theCommonValue.setShowCurrentValuesAsFlow( false );
//            }
//        }
        
        if ( theLeakStatistics.analyzeType != jComboAnalyzesType.getSelectedIndex() ) {
            theLeakStatistics.analyzeType = jComboAnalyzesType.getSelectedIndex();
            theLeakStatistics.triggerCalculate();
        }
        float v = Float.valueOf( GUIConst.VerifyString( jTextCostPerM3.getText() ));
        if ( theLeakStatistics.energyCostPerM3 != v ) {
            theLeakStatistics.energyCostPerM3 = v;
            theLeakStatistics.triggerCalculate();
        }
        if ( theLeakStatistics.currencyEnergyCost.compareTo( jTextCurrency.getText() ) != 0 ) {
            theLeakStatistics.currencyEnergyCost = jTextCurrency.getText();
            theLeakStatistics.triggerCalculate();
        }
        
        theCommonValue.setWeekStartFromMonday( jCheckStartOnMonday.isSelected() );
        getSelectedTime();

        //add by be.20101018. Richard's requirement. ---------- begin
        if(jRadioTimePeriod.isSelected()){
            if ( !endTime.after( startTime )) {
                if(waitDlg != null){
                    waitDlg.unShow();
                }
                JOptionPane.showMessageDialog( this,java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("End_time_must_be_after_the_start_time"));
                return false;
            }
        }else{
//            if ( endTime.before( startTime ))
//                endTime.setTime( startTime.getTime() );
        }
        //----------------------------------------------- end

        if(startTime.getTimeInMillis()/1000 < protocolsValidStartTime.getTime()/1000){
            theLeakStatistics.setStartTime( protocolsValidStartTime.getTime() );
        }else{
            theLeakStatistics.setStartTime( startTime.getTimeInMillis() );
        }
        if(endTime.getTimeInMillis()/1000 > protocolsValidEndTime.getTime()/1000){
            theLeakStatistics.setEndTime( protocolsValidEndTime.getTime() );
        }else{
            theLeakStatistics.setEndTime( endTime.getTimeInMillis() );
        }
        boolean timeChanged=false;
        if ( myViewOptions.startTime.getTime() != startTime.getTimeInMillis() ) {
            myViewOptions.startTime.setTime( startTime.getTimeInMillis() );
//            theCommonValue.setViewOptions(myViewOptions);
            timeChanged = true;
        }
        //add by be.20100818. Richard's requirement. ---------- begin
        if ( myViewOptions.endTime.getTime() != endTime.getTimeInMillis() ) {
            myViewOptions.endTime.setTime( endTime.getTimeInMillis() );
            timeChanged = true;
//            theCommonValue.setViewOptions(myViewOptions);
        }
        //conbine time.

        if(timeChanged) theCommonValue.setViewOptions(myViewOptions);
        //----------------- end

        if ( jRadioWeek.isSelected() )
            theCommonValue.setReportType( CommonValue.REPORT_TYPE_WEEK );
        else if ( jRadioTimePeriod.isSelected() ) {//modify on 20091015 be,v3-3
            theCommonValue.setReportType( CommonValue.REPORT_TYPE_PERIOD );
            theCommonValue.setViewOptions( myViewOptions );
        } 
        else if ( jRadioDay.isSelected() )
            theCommonValue.setReportType( CommonValue.REPORT_TYPE_DAY );

        //if diaplay co2emmision per kwh in report.v3-4
        if ( jCBDiaplayCo2InReport.isSelected() )
            theLeakStatistics.setDiaplay_CO2EmmisionPerKWh_in_Report( true );
        else
            theLeakStatistics.setDiaplay_CO2EmmisionPerKWh_in_Report( false );
        //configure working hour per year . v3-2.
        theLeakStatistics.setWork_hour_per_year(Double.valueOf(jTextWorkHourPerYear.getText().trim()));
      
        if(jComboAnalyzesType.getSelectedIndex() == LeakStatistics.ANALYZE_TYPE_SYSTEM){
            int index = jComBAssignFlowChannel.getSelectedIndex();     
            if ( index >= 0 ){
                theCommonValue.setSystemFlowChannelTmp(assignFlowChannel.get(index));
                isAssignSystemFlowChannel = true;
            }
            theLeakStatistics.setSystemFlowChannel(theCommonValue.getSystemFlowChannelTmp());
        }
              
        //v3-3.
        //air delivery unit will be moved to analyzes settings and it will be the same for every compressor.
        //
        ArrayList<Compressor> myCompressors = new ArrayList();
        if(theCommonValue.getCompressors().size() > 0){
            myCompressors = theCommonValue.getCompressors();
        }else{
            myCompressors = theLeakStatistics.getCompressors();
            theCommonValue.setCompressors(theLeakStatistics.getCompressors());
        }
//        System.out.println("AnalyzesSettingDialog/applyChanges myCompressors="+myCompressors);
        int len = 0;
        if ( myCompressors != null ) 
            len = myCompressors.size();
//        System.out.println("analyzesettingdialog/applyChanges len="+len);
        if(len > 0){
            /* 20130610
             * TF's requirement: Overall, I think we should cut this stupid message, it really sucks if it pops up all the time.
             * We better make a chapter troube shooting into the help file. */
//            for ( Compressor compressor : myCompressors ) {
//                 if ( theCommonValue.isShowAsFlow() && compressor.Type == Compressor.COMPRESSOR_TYPE_LOAD_UNLOAD ) {
//                       //modify on 20091111,be
//                       //reason : compare doblue data no use < > ect,use BigDecimal .
//                       BigDecimal fullLoadAirDeliveryData = new BigDecimal(compressor.FullLoadAirDelivery);
//                       BigDecimal zeroData = new BigDecimal(0.0);
//                       if(zeroData.compareTo(fullLoadAirDeliveryData) >= 0 ){
//                           if(waitDlg != null){
//                               waitDlg.unShow();
//                           } 
//                           JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("When_displaying_current_as_flow,_'Air_Delivery'_must_be_>_0.") );
//                           return false;
//                    }
//                }
//            }

             for(int i =0;i<len;i++){
                 myCompressors.get(i).AirDeliveryUnit = theLeakStatistics.getAir_delivery_unit();
                 myCompressors.get(i).CO2EmmisionPerKWh = theLeakStatistics.getCO2EmmisionPerKWh();                
             }

            if(jRadioFlow.isSelected()){
                theCommonValue.setShowCurrentValuesAsFlow( true );
            }else{
                 theCommonValue.setShowCurrentValuesAsFlow( false );
            }
        }
        
        return true;
    }

    private boolean validateInput(NewWaitingDialog waitDlg) {
        try {
            float v = Float.valueOf( GUIConst.VerifyString( jTextCostPerM3.getText() ));
            if ( v < 0 ) {
                if(waitDlg != null){
                    waitDlg.unShow();
                }
                JOptionPane.showMessageDialog( this, COST_PER_M3_INPUT_ERROR_MESSAGE );
                return false;
            }
        } catch ( Exception e ) {
            if(waitDlg != null){
                waitDlg.unShow();
            }
            JOptionPane.showMessageDialog( this, COST_PER_M3_INPUT_ERROR_MESSAGE );
            return false;
        }
        
        return true;
    }
    
    // get selected start and end time. if end time is earlier than start time, then set end time to the same as 
    // start time
    private void getSelectedTime() {
        int hour;
        
        startTime.setTime( jXDatePickerStart.getDate() );
        startTime.set( Calendar.HOUR_OF_DAY, 0 );        
        startTime.set( Calendar.MINUTE, 0 );
        startTime.set( Calendar.SECOND, 0 );
        hour = numModelStartHour.getNumber().intValue();
        if ( hour == 24 ) {
            startTime.setTimeInMillis( startTime.getTimeInMillis() + GUIConst.ONE_DAY_MILLS );
            hour = 0;
        }
        startTime.set( Calendar.HOUR_OF_DAY, hour );
//        startTime.set( Calendar.MINUTE, numModelStartMinute.getNumber().intValue() );
//        startTime.set( Calendar.SECOND, numModelStartSecond.getNumber().intValue() );
      
//        if ( jRadioDay.isSelected() ) {
//            endTime.setTimeInMillis( startTime.getTimeInMillis() + ONE_DAY_MILLS );
//        } else if ( jRadioWeek.isSelected() ) {
//            if ( jCheckStartOnMonday.isSelected() )
//                startTime.set( Calendar.DAY_OF_WEEK, Calendar.MONDAY );
//            endTime.setTimeInMillis( startTime.getTimeInMillis() + ONE_WEEK_MILLS );
//        } else {
        if ( jCheckStartOnMonday.isSelected() ) {
            startTime.set( Calendar.DAY_OF_WEEK, Calendar.MONDAY );
            jXDatePickerStart.setDateInMillis( startTime.getTimeInMillis() );
        }
        
        endTime.setTime( jXDatePickerEnd.getDate() );
        endTime.set( Calendar.HOUR_OF_DAY, 0 );        
        endTime.set( Calendar.MINUTE, 0 );
        endTime.set( Calendar.SECOND, 0 );
        hour = numModelEndHour.getNumber().intValue();
        if ( hour == 24 ) {
            endTime.setTimeInMillis( endTime.getTimeInMillis() + GUIConst.ONE_DAY_MILLS );
            hour = 0;
        }
        endTime.set( Calendar.HOUR_OF_DAY, hour );
        
        if ( endTime.before( startTime )) 
            endTime.setTime( startTime.getTime() );
    
        //myViewOptions.startTime.setTime( startTime.getTimeInMillis() );
        //myViewOptions.endTime.setTime( endTime.getTimeInMillis() );
        //theLeakStatistics.setStartTime( startTime.getTimeInMillis() );
        //theLeakStatistics.setEndTime( endTime.getTimeInMillis() );
        String s = GUIConst.DEFAULT_DATE_AND_TIME_SHORT_FORMAT( startTime )  + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("___to___") +
                GUIConst.DEFAULT_DATE_AND_TIME_SHORT_FORMAT( endTime );
        jLabelSelectedPeriod.setText( s );        
    }    
    
    // certain fields are available only in some case
    private void setFieldsAvailability() {

        if ( jComboAnalyzesType.getSelectedIndex() != LeakStatistics.ANALYZE_TYPE_FLOW ){
            jTextCostPerM3.setEnabled( false );
            jCBDiaplayCo2InReport.setEnabled(true); //added on 20110305.BE. Reason : Simon feedback flow analyze can't set Co2
            jTextCO2Emmision.setEnabled(true); //added on 20110305.BE. Reason : Simon feedback flow analyze can't set Co2
        }else{
            jTextCostPerM3.setEnabled( true );
            jCBDiaplayCo2InReport.setEnabled(false); //added on 20110305.BE. Reason : Simon feedback flow analyze can't set Co2
            jCBDiaplayCo2InReport.setSelected(false); //added on 20110305.BE. Reason : Simon feedback flow analyze can't set Co2
            jTextCO2Emmision.setEnabled(false); //added on 20110305.BE. Reason : Simon feedback flow analyze can't set Co2
        }
        //being 20091015.be v3-3
        jComboAirUnit.setSelectedItem( theLeakStatistics.getAir_delivery_unit());
        //end
    }
    
    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        buttonGroupReportType = new javax.swing.ButtonGroup();
        jLabel1 = new javax.swing.JLabel();
        jComboAnalyzesType = new javax.swing.JComboBox();
        jLabel2 = new javax.swing.JLabel();
        jRadioWeek = new javax.swing.JRadioButton();
        jRadioDay = new javax.swing.JRadioButton();
        jRadioTimePeriod = new javax.swing.JRadioButton();
        jPanel1 = new javax.swing.JPanel();
        jLabelDescription = new javax.swing.JLabel();
        jButtonCompressSettings = new javax.swing.JButton();
        jPanel2 = new javax.swing.JPanel();
        jLabel4 = new javax.swing.JLabel();
        jLabelRecordPeriod = new javax.swing.JLabel();
        jLabel6 = new javax.swing.JLabel();
        jLabelSelectedPeriod = new javax.swing.JLabel();
        jLabel8 = new javax.swing.JLabel();
        jLabel9 = new javax.swing.JLabel();
        jLabel10 = new javax.swing.JLabel();
        jLabelEndTimeDate = new javax.swing.JLabel();
        jLabelEndTimeHour = new javax.swing.JLabel();
        jXDatePickerStart = new org.jdesktop.swingx.JXDatePicker();
        jSpinnerEndHour = new javax.swing.JSpinner();
        jLabelTo = new javax.swing.JLabel();
        jXDatePickerEnd = new org.jdesktop.swingx.JXDatePicker();
        jSpinnerStartHour = new javax.swing.JSpinner();
        jLabelEndTimeDate1 = new javax.swing.JLabel();
        jLabelTo1 = new javax.swing.JLabel();
        jCheckStartOnMonday = new javax.swing.JCheckBox();
        jLabel11 = new javax.swing.JLabel();
        jTextCostPerM3 = new javax.swing.JTextField();
        jLabel12 = new javax.swing.JLabel();
        jTextCurrency = new javax.swing.JTextField();
        jButtonOK = new javax.swing.JButton();
        jButtonCancel = new javax.swing.JButton();
        labworkhourperyear = new javax.swing.JLabel();
        jTextWorkHourPerYear = new javax.swing.JTextField();
        jLabel38 = new javax.swing.JLabel();
        jTextCO2Emmision = new javax.swing.JTextField();
        jLabel39 = new javax.swing.JLabel();
        jLabel3 = new javax.swing.JLabel();
        jCBDiaplayCo2InReport = new javax.swing.JCheckBox();
        jLabel5 = new javax.swing.JLabel();
        jRadioCurrent = new javax.swing.JRadioButton();
        jRadioFlow = new javax.swing.JRadioButton();
        jLabel24 = new javax.swing.JLabel();
        jLabel25 = new javax.swing.JLabel();
        jComboAirUnit = new javax.swing.JComboBox();
        jLabel7 = new javax.swing.JLabel();
        jComBAssignFlowChannel = new javax.swing.JComboBox();

        setDefaultCloseOperation(javax.swing.WindowConstants.DISPOSE_ON_CLOSE);
        java.util.ResourceBundle bundle = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts"); // NOI18N
        setTitle(bundle.getString("Analyzes_Settings")); // NOI18N
        setResizable(false);

        jLabel1.setFont(GUIConst.DIALOG_FONT);
        jLabel1.setText(bundle.getString("Type_of_analyzes:")); // NOI18N

        jComboAnalyzesType.setFont(GUIConst.DIALOG_FONT);
        jComboAnalyzesType.setModel(new javax.swing.DefaultComboBoxModel(new String[] { "Flow Analyzes", "Compressor Analyzes", "System Analyzes" }));
        jComboAnalyzesType.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jComboAnalyzesTypeActionPerformed(evt);
            }
        });

        jLabel2.setFont(GUIConst.DIALOG_FONT);
        jLabel2.setText(bundle.getString("Report_Type:")); // NOI18N

        jRadioWeek.setFont(GUIConst.DIALOG_FONT);
        jRadioWeek.setText(bundle.getString("One_week")); // NOI18N
        jRadioWeek.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jRadioWeek.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jRadioDay.setFont(GUIConst.DIALOG_FONT);
        jRadioDay.setText(bundle.getString("One_day")); // NOI18N
        jRadioDay.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jRadioDay.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jRadioTimePeriod.setFont(GUIConst.DIALOG_FONT);
        jRadioTimePeriod.setText(bundle.getString("Selected_time_period")); // NOI18N
        jRadioTimePeriod.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jRadioTimePeriod.setMargin(new java.awt.Insets(0, 0, 0, 0));
        jRadioTimePeriod.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jRadioTimePeriodActionPerformed(evt);
            }
        });

        jPanel1.setBorder(javax.swing.BorderFactory.createTitledBorder(null, bundle.getString("Description"), javax.swing.border.TitledBorder.DEFAULT_JUSTIFICATION, javax.swing.border.TitledBorder.DEFAULT_POSITION, GUIConst.TITLE_FONT, GUIConst.TITLE_COLOR)); // NOI18N

        jLabelDescription.setFont(GUIConst.DIALOG_FONT);
        jLabelDescription.setText(bundle.getString("Description_about_the_analyzes")); // NOI18N

        org.jdesktop.layout.GroupLayout jPanel1Layout = new org.jdesktop.layout.GroupLayout(jPanel1);
        jPanel1.setLayout(jPanel1Layout);
        jPanel1Layout.setHorizontalGroup(
            jPanel1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel1Layout.createSequentialGroup()
                .addContainerGap()
                .add(jLabelDescription, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 308, Short.MAX_VALUE))
        );
        jPanel1Layout.setVerticalGroup(
            jPanel1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel1Layout.createSequentialGroup()
                .add(jLabelDescription)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );

        jButtonCompressSettings.setFont(GUIConst.BUTTON_FONT);
        jButtonCompressSettings.setText(bundle.getString("Compressor_settings")); // NOI18N
        jButtonCompressSettings.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonCompressSettingsActionPerformed(evt);
            }
        });

        jPanel2.setBorder(javax.swing.BorderFactory.createTitledBorder(null, bundle.getString("Select_time_period_for_analyzes"), javax.swing.border.TitledBorder.DEFAULT_JUSTIFICATION, javax.swing.border.TitledBorder.DEFAULT_POSITION, GUIConst.TITLE_FONT, GUIConst.TITLE_COLOR)); // NOI18N

        jLabel4.setFont(GUIConst.DIALOG_FONT);
        jLabel4.setText(bundle.getString("Time_period_of_data_recording:")); // NOI18N

        jLabelRecordPeriod.setFont(GUIConst.DIALOG_FONT);
        jLabelRecordPeriod.setText(bundle.getString("Record_time")); // NOI18N

        jLabel6.setFont(GUIConst.DIALOG_FONT);
        jLabel6.setText(bundle.getString("Current_selected_start_/_end_time:")); // NOI18N

        jLabelSelectedPeriod.setFont(GUIConst.DIALOG_FONT);
        jLabelSelectedPeriod.setForeground(new java.awt.Color(0, 204, 0));
        jLabelSelectedPeriod.setText(bundle.getString("Current_time")); // NOI18N

        jLabel8.setFont(GUIConst.DIALOG_FONT);
        jLabel8.setText(bundle.getString("Which_period_do_you_want_to_select?")); // NOI18N

        jLabel9.setFont(new java.awt.Font("SansSerif", 0, 12)); // NOI18N
        jLabel9.setText(bundle.getString("Date")); // NOI18N

        jLabel10.setFont(GUIConst.DIALOG_FONT);
        jLabel10.setText(bundle.getString("Hour")); // NOI18N

        jLabelEndTimeDate.setFont(GUIConst.DIALOG_FONT);
        jLabelEndTimeDate.setText(bundle.getString("Date")); // NOI18N

        jLabelEndTimeHour.setFont(GUIConst.DIALOG_FONT);
        jLabelEndTimeHour.setText(bundle.getString("Hour")); // NOI18N

        jXDatePickerStart.setFont(GUIConst.DIALOG_FONT);
        jXDatePickerStart.setFormats(GUIConst.DATE_FORMAT_STRING);
        jXDatePickerStart.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jXDatePickerStartActionPerformed(evt);
            }
        });

        jSpinnerEndHour.setFont(GUIConst.DIALOG_FONT);
        jSpinnerEndHour.setPreferredSize(new java.awt.Dimension(35, 25));
        jSpinnerEndHour.addChangeListener(new javax.swing.event.ChangeListener() {
            public void stateChanged(javax.swing.event.ChangeEvent evt) {
                jSpinnerEndHourStateChanged(evt);
            }
        });

        jLabelTo.setFont(new java.awt.Font("SansSerif", 1, 10)); // NOI18N
        jLabelTo.setForeground(new java.awt.Color(0, 153, 153));
        jLabelTo.setText(bundle.getString("To")); // NOI18N

        jXDatePickerEnd.setFont(GUIConst.DIALOG_FONT);
        jXDatePickerEnd.setFormats(GUIConst.DATE_FORMAT_STRING);
        jXDatePickerEnd.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jXDatePickerEndActionPerformed(evt);
            }
        });

        jSpinnerStartHour.setFont(GUIConst.DIALOG_FONT);
        jSpinnerStartHour.setPreferredSize(new java.awt.Dimension(35, 25));
        jSpinnerStartHour.addChangeListener(new javax.swing.event.ChangeListener() {
            public void stateChanged(javax.swing.event.ChangeEvent evt) {
                jSpinnerStartHourStateChanged(evt);
            }
        });

        jLabelEndTimeDate1.setFont(GUIConst.DIALOG_FONT);
        jLabelEndTimeDate1.setText(bundle.getString("Date")); // NOI18N

        jLabelTo1.setFont(new java.awt.Font("SansSerif", 1, 10)); // NOI18N
        jLabelTo1.setForeground(new java.awt.Color(0, 153, 153));
        jLabelTo1.setText(bundle.getString("From")); // NOI18N

        jCheckStartOnMonday.setFont(GUIConst.DIALOG_FONT);
        jCheckStartOnMonday.setText(bundle.getString("Start_on_Monday")); // NOI18N
        jCheckStartOnMonday.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jCheckStartOnMonday.setMargin(new java.awt.Insets(0, 0, 0, 0));
        jCheckStartOnMonday.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jCheckStartOnMondayActionPerformed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel2Layout = new org.jdesktop.layout.GroupLayout(jPanel2);
        jPanel2.setLayout(jPanel2Layout);
        jPanel2Layout.setHorizontalGroup(
            jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel2Layout.createSequentialGroup()
                .addContainerGap()
                .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel2Layout.createSequentialGroup()
                        .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jLabel4)
                            .add(jLabel6))
                        .add(37, 37, 37)
                        .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jPanel2Layout.createSequentialGroup()
                                .add(jLabelSelectedPeriod, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jCheckStartOnMonday))
                            .add(jLabelRecordPeriod, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 298, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                    .add(jLabel8)
                    .add(jPanel2Layout.createSequentialGroup()
                        .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jPanel2Layout.createSequentialGroup()
                                .add(jLabelTo1)
                                .add(19, 19, 19)
                                .add(jXDatePickerStart, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED))
                            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel2Layout.createSequentialGroup()
                                .add(jLabelEndTimeDate1)
                                .add(84, 84, 84)))
                        .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jLabelEndTimeHour)
                            .add(jSpinnerStartHour, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING, false)
                            .add(jPanel2Layout.createSequentialGroup()
                                .add(17, 17, 17)
                                .add(jLabelTo, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 19, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .add(13, 13, 13)
                                .add(jXDatePickerEnd, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 126, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED))
                            .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel2Layout.createSequentialGroup()
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                                .add(jLabelEndTimeDate)
                                .add(86, 86, 86)))
                        .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jSpinnerEndHour, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabel10))))
                .add(522, 522, 522)
                .add(jLabel9)
                .addContainerGap())
        );

        jPanel2Layout.linkSize(new java.awt.Component[] {jXDatePickerEnd, jXDatePickerStart}, org.jdesktop.layout.GroupLayout.HORIZONTAL);

        jPanel2Layout.setVerticalGroup(
            jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel2Layout.createSequentialGroup()
                .addContainerGap()
                .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel4)
                    .add(jLabelRecordPeriod))
                .add(19, 19, 19)
                .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel6)
                    .add(jCheckStartOnMonday)
                    .add(jLabelSelectedPeriod))
                .add(17, 17, 17)
                .add(jLabel8)
                .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel2Layout.createSequentialGroup()
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jLabel9))
                    .add(jPanel2Layout.createSequentialGroup()
                        .add(14, 14, 14)
                        .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                            .add(jPanel2Layout.createSequentialGroup()
                                .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                                    .add(jLabelEndTimeHour)
                                    .add(jLabelEndTimeDate1))
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                                    .add(jSpinnerStartHour, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                    .add(jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                                        .add(jLabelTo1)
                                        .add(jXDatePickerStart, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                                    .add(org.jdesktop.layout.GroupLayout.LEADING, jLabelTo)))
                            .add(jPanel2Layout.createSequentialGroup()
                                .add(jLabelEndTimeDate)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jXDatePickerEnd, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                            .add(jPanel2Layout.createSequentialGroup()
                                .add(jLabel10)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jSpinnerEndHour, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))))
                .add(37, 37, 37))
        );

        jLabel11.setFont(GUIConst.DIALOG_FONT);
        jLabel11.setText(bundle.getString("Energy_Cost_per_m3")); // NOI18N

        jTextCostPerM3.setFont(GUIConst.DIALOG_FONT);
        jTextCostPerM3.setText("0.003");

        jLabel12.setFont(GUIConst.DIALOG_FONT);
        jLabel12.setText(bundle.getString("Currency_used_for_cost_calculation:")); // NOI18N

        jTextCurrency.setFont(GUIConst.DIALOG_FONT);
        jTextCurrency.setText(bundle.getString("Euro")); // NOI18N
        jTextCurrency.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextCurrencyKeyTyped(evt);
            }
        });

        jButtonOK.setFont(GUIConst.BUTTON_FONT);
        jButtonOK.setText(bundle.getString("OK")); // NOI18N
        jButtonOK.setPreferredSize(new java.awt.Dimension(75, 23));
        jButtonOK.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonOKActionPerformed(evt);
            }
        });

        jButtonCancel.setFont(GUIConst.BUTTON_FONT);
        jButtonCancel.setText(bundle.getString("Cancel")); // NOI18N
        jButtonCancel.setPreferredSize(new java.awt.Dimension(75, 23));
        jButtonCancel.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonCancelActionPerformed(evt);
            }
        });

        labworkhourperyear.setFont(GUIConst.DIALOG_FONT);
        labworkhourperyear.setText(bundle.getString("Cumulated_statistics_for_one_year_[8400_h]:")); // NOI18N

        jTextWorkHourPerYear.setFont(GUIConst.DIALOG_FONT);
        jTextWorkHourPerYear.setText("8400");

        jLabel38.setFont(GUIConst.DIALOG_FONT);
        jLabel38.setText(bundle.getString("CO2_emmision_per_kWh:")); // NOI18N

        jTextCO2Emmision.setFont(GUIConst.DIALOG_FONT);
        jTextCO2Emmision.setText("0.55");
        jTextCO2Emmision.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextCO2EmmisionKeyTyped(evt);
            }
        });

        jLabel39.setFont(GUIConst.DIALOG_FONT);
        jLabel39.setText(bundle.getString("kg")); // NOI18N

        jLabel3.setFont(GUIConst.DIALOG_FONT);
        jLabel3.setText(bundle.getString("Display_in_report")); // NOI18N

        jLabel5.setFont(GUIConst.DIALOG_FONT);
        jLabel5.setText(bundle.getString("Show_current_channel_as:")); // NOI18N

        jRadioCurrent.setFont(GUIConst.DIALOG_FONT);
        jRadioCurrent.setText(bundle.getString("current_power")); // NOI18N
        jRadioCurrent.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jRadioCurrent.setMargin(new java.awt.Insets(0, 0, 0, 0));
        jRadioCurrent.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jRadioCurrentActionPerformed(evt);
            }
        });

        jRadioFlow.setFont(GUIConst.DIALOG_FONT);
        jRadioFlow.setText(bundle.getString("flow")); // NOI18N
        jRadioFlow.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jRadioFlow.setMargin(new java.awt.Insets(0, 0, 0, 0));
        jRadioFlow.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jRadioFlowActionPerformed(evt);
            }
        });

        jLabel24.setFont(GUIConst.DIALOG_FONT);
        jLabel24.setText(bundle.getString("Air_delivery")); // NOI18N

        jLabel25.setFont(GUIConst.DIALOG_FONT);
        jLabel25.setText(bundle.getString("Unit")); // NOI18N

        jComboAirUnit.setFont(GUIConst.DIALOG_FONT);
        jComboAirUnit.addItemListener(new java.awt.event.ItemListener() {
            public void itemStateChanged(java.awt.event.ItemEvent evt) {
                jComboAirUnitItemStateChanged(evt);
            }
        });
        jComboAirUnit.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jComboAirUnitActionPerformed(evt);
            }
        });
        jComboAirUnit.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jComboAirUnitKeyTyped(evt);
            }
        });

        jLabel7.setFont(GUIConst.DIALOG_FONT);
        jLabel7.setText(bundle.getString("Assign_flow_channel:")); // NOI18N

        jComBAssignFlowChannel.setFont(GUIConst.DIALOG_FONT);
        jComBAssignFlowChannel.setMinimumSize(new java.awt.Dimension(23, 18));
        jComBAssignFlowChannel.setPreferredSize(new java.awt.Dimension(28, 20));
        jComBAssignFlowChannel.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jComBAssignFlowChannelActionPerformed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout layout = new org.jdesktop.layout.GroupLayout(getContentPane());
        getContentPane().setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(layout.createSequentialGroup()
                .addContainerGap()
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(layout.createSequentialGroup()
                        .add(10, 10, 10)
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(layout.createSequentialGroup()
                                .add(jLabel38)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                                .add(jTextCO2Emmision, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 42, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jLabel39, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 22, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jLabel3)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jCBDiaplayCo2InReport))
                            .add(layout.createSequentialGroup()
                                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                                    .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING, false)
                                        .add(labworkhourperyear, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                                        .add(jLabel11))
                                    .add(jLabel12))
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                                    .add(jTextCurrency, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 50, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                    .add(layout.createSequentialGroup()
                                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                                            .add(jTextCostPerM3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 50, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                            .add(jTextWorkHourPerYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 50, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                                        .add(51, 51, 51)
                                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING, false)
                                            .add(layout.createSequentialGroup()
                                                .add(jLabel24, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 72, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                                                    .add(layout.createSequentialGroup()
                                                        .add(jButtonOK, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                                        .add(18, 18, 18)
                                                        .add(jButtonCancel, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                                                    .add(layout.createSequentialGroup()
                                                        .add(jLabel25)
                                                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                                        .add(jComboAirUnit, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 67, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))))
                                            .add(layout.createSequentialGroup()
                                                .add(jLabel5, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 168, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                                                .add(jRadioCurrent)))
                                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                                        .add(jRadioFlow))))))
                    .add(layout.createSequentialGroup()
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING, false)
                            .add(jPanel1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(layout.createSequentialGroup()
                                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                                    .add(jLabel1)
                                    .add(jLabel7))
                                .add(8, 8, 8)
                                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                                    .add(jComboAnalyzesType, 0, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                    .add(jComBAssignFlowChannel, 0, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))))
                        .add(28, 28, 28)
                        .add(jLabel2)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jButtonCompressSettings)
                            .add(jRadioTimePeriod)
                            .add(jRadioDay)
                            .add(jRadioWeek)))
                    .add(jPanel2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 645, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );

        layout.linkSize(new java.awt.Component[] {jLabel12, labworkhourperyear}, org.jdesktop.layout.GroupLayout.HORIZONTAL);

        layout.setVerticalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(layout.createSequentialGroup()
                .add(20, 20, 20)
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(layout.createSequentialGroup()
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jLabel1)
                            .add(jComboAnalyzesType, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 18, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jLabel7)
                            .add(jComBAssignFlowChannel, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 18, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanel1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                    .add(layout.createSequentialGroup()
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel2)
                            .add(jRadioDay))
                        .add(7, 7, 7)
                        .add(jRadioWeek)
                        .add(10, 10, 10)
                        .add(jRadioTimePeriod)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jButtonCompressSettings)))
                .add(25, 25, 25)
                .add(jPanel2, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 200, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(8, 8, 8)
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(layout.createSequentialGroup()
                        .add(2, 2, 2)
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel11)
                            .add(jTextCostPerM3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .add(18, 18, 18)
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(labworkhourperyear)
                            .add(jTextWorkHourPerYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .add(18, 18, 18)
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jTextCurrency, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabel12))
                        .add(18, 18, 18)
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel38)
                            .add(jTextCO2Emmision, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabel39)
                            .add(jLabel3)))
                    .add(org.jdesktop.layout.GroupLayout.TRAILING, layout.createSequentialGroup()
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                            .add(layout.createSequentialGroup()
                                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                                    .add(jLabel5)
                                    .add(jRadioCurrent)
                                    .add(jRadioFlow))
                                .add(18, 18, 18)
                                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                                    .add(jLabel24)
                                    .add(jLabel25)
                                    .add(jComboAirUnit, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED, 62, Short.MAX_VALUE)
                                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                                    .add(jButtonOK, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                    .add(jButtonCancel, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                            .add(jCBDiaplayCo2InReport))
                        .add(2, 2, 2)))
                .addContainerGap(44, Short.MAX_VALUE))
        );

        pack();
    }// </editor-fold>//GEN-END:initComponents

    private void jXDatePickerEndActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jXDatePickerEndActionPerformed
        //jRadioTimePeriod.setSelected( true );
        getSelectedTime();        
    }//GEN-LAST:event_jXDatePickerEndActionPerformed

    private void jXDatePickerStartActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jXDatePickerStartActionPerformed
        //jRadioTimePeriod.setSelected( true );
        boolean init = atInit;
        atInit = true;
        jCheckStartOnMonday.setSelected( false );
        atInit = init;
        getSelectedTime();
    }//GEN-LAST:event_jXDatePickerStartActionPerformed

    private void jComboAnalyzesTypeActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jComboAnalyzesTypeActionPerformed
        // not every type is available all the time
        boolean currenAvailable = false; 
        boolean flowAvailable = false; 
        int type = jComboAnalyzesType.getSelectedIndex();

        for ( ViewChannel vChannel : theCommonValue.getAvailableChannels() ) {
            if ( MeasurementUnit.IsCurrentUnit( vChannel.unit ) ){
                currenAvailable = true;
            }else if(MeasurementUnit.IsPowerUnit( vChannel.unit )){
                currenAvailable = true;
            }
            if ( MeasurementUnit.IsFlowRateUnit( vChannel.unit ) )
                flowAvailable = true;
        }
        if ( !atInit ) {
            if ( type == LeakStatistics.ANALYZE_TYPE_COMPRESSOR && !currenAvailable ) {
                JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("This_type_is_only_available_when_there's_current_channel."));
                jComboAnalyzesType.setSelectedIndex( LeakStatistics.ANALYZE_TYPE_FLOW );
            }
            if ( type == LeakStatistics.ANALYZE_TYPE_FLOW && !flowAvailable ) {
                //JOptionPane.showMessageDialog( this, "This type is only available when there's flow channel.");
                //jComboAnalyzesType.setSelectedIndex( LeakStatistics.ANALYZE_TYPE_COMPRESSOR );
            }
            if ( type == LeakStatistics.ANALYZE_TYPE_SYSTEM && ( !currenAvailable || !flowAvailable )) {
                JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("This_type_is_only_available_when_there're_both_current_and_flow_channels."));
//                jComboAnalyzesType.setSelectedIndex( theLeakStatistics.analyzeType );
                jComboAnalyzesType.setSelectedIndex( LeakStatistics.ANALYZE_TYPE_FLOW );
            }
        }else{
            if ( type == LeakStatistics.ANALYZE_TYPE_SYSTEM && ( !currenAvailable || !flowAvailable )) {
//                JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("This_type_is_only_available_when_there're_both_current_and_flow_channels."));
                jComboAnalyzesType.setSelectedIndex( LeakStatistics.ANALYZE_TYPE_FLOW );
            }
        }
       
        /* if system analyze, set system flow channel temp object */
        if (type == LeakStatistics.ANALYZE_TYPE_SYSTEM){
            if(theCommonValue.getSystemFlowChannelTmp() == null){
                theCommonValue.setSystemFlowChannelTmp(theLeakStatistics.getSystemFlowChannel());
            }           
        }else{
            theCommonValue.setSystemFlowChannelTmp(null);
        }
        
        setFieldsAvailability();
        
        /* if analyze is system type, ask to select a flow channel */
        if(jComboAnalyzesType.getSelectedIndex() == LeakStatistics.ANALYZE_TYPE_SYSTEM){
//            checkFullLoadAirDeliveryData(theCommonValue, theCommonValue.getDataBase());
            if(!assigedFlowChannelBaseOnSystemAnalyze()){
                jComBAssignFlowChannel.setSelectedIndex( 0 );
            }
            
        }else{
            jLabel7.setVisible(false);
            jComBAssignFlowChannel.setVisible(false);
        }
        
    }//GEN-LAST:event_jComboAnalyzesTypeActionPerformed

    private void jButtonCompressSettingsActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonCompressSettingsActionPerformed
        boolean currenAvailable = false; 
        for ( ViewChannel vChannel : theCommonValue.getAvailableChannels() ) {
            if ( MeasurementUnit.IsCurrentUnit( vChannel.unit ) ) {
                currenAvailable = true;
                break;
            }else if(MeasurementUnit.IsPowerUnit( vChannel.unit )){
                currenAvailable = true;
                break;
            }
        }
        if ( !currenAvailable ) {
            JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("<html>This_is_no_current_channel_in_selected_record_file(s)._<br>") +
                    java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Compressor_settings_are_not_available.<br><br></html>"));
            return;
        }
        
//        /* reset flow channel, check if assigned to system analyze */      
//        myCompressorSettingDlg.addFlowChannelToComboFlowChannel();
//        myCompressorSettingDlg.resetAssignedFlowChannelFieldBasedOnCompressor();
              
        myCompressorSettingDlg.setModal( true );
        myCompressorSettingDlg.setVisible( true );
    }//GEN-LAST:event_jButtonCompressSettingsActionPerformed

    private void jSpinnerStartHourStateChanged(javax.swing.event.ChangeEvent evt) {//GEN-FIRST:event_jSpinnerStartHourStateChanged
        //jRadioTimePeriod.setSelected( true );
        if ( atInit ) return;
        getSelectedTime();        
    }//GEN-LAST:event_jSpinnerStartHourStateChanged

    private void jSpinnerEndHourStateChanged(javax.swing.event.ChangeEvent evt) {//GEN-FIRST:event_jSpinnerEndHourStateChanged
        //jRadioTimePeriod.setSelected( true );
        if ( atInit ) return;
        getSelectedTime();        
    }//GEN-LAST:event_jSpinnerEndHourStateChanged

private void jButtonOKActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonOKActionPerformed
    
    final NewWaitingDialog waitDlg = new NewWaitingDialog();
    waitDlg.showUp( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Processing,_please_wait_..."), new TimerTask() {
        public void run() {
            
            //check if assiagn a flow channel for system analyzing
//            if(jComboAnalyzesType.getSelectedIndex() == LeakStatistics.ANALYZE_TYPE_SYSTEM){
//                if(!isAssignSystemFlowChannel){
//                    if(theLeakStatistics.getSystemFlowChannel() == null){
//                        if(waitDlg != null){
//                            waitDlg.unShow();
//                        }
//                        JOptionPane.showMessageDialog( null, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_select_a_flow_channel_to_'System_Analyzes'") );
//                        checkFullLoadAirDeliveryData(theCommonValue, theCommonValue.getDataBase());
//                        if(!isAssignSystemFlowChannel){
//                            return;
//                        }
//                    }
//                }
//            }
            
            
            if ( applyChanges(waitDlg) ) {

                theCommonValue.setCanStatistic(true); 
                if(waitDlg != null){
                    waitDlg.unShow();
                }
                dispose();
            } else {
                if(waitDlg != null){
                    waitDlg.unShow();
                }
            }
        }
    });
    
   
}//GEN-LAST:event_jButtonOKActionPerformed

//private boolean checkFullLoadAirDeliveryData(){
//     ArrayList<Compressor> myCompressors = new ArrayList();   
//     myCompressors = theCommonValue.getCompressors();
//     System.out.println("theCommonValue.getCompressors() size ="+myCompressors.size());
//      if(myCompressors.isEmpty()){
//
//          return false;
//      }else{
//          for ( Compressor compressor : myCompressors ) {
//    //            if ( theCommonValue.isShowCurrentValuesAsFlow() && compressor.Type == Compressor.COMPRESSOR_TYPE_LOAD_UNLOAD ) {
//               if ( theCommonValue.isShowAsFlow() && compressor.Type == Compressor.COMPRESSOR_TYPE_LOAD_UNLOAD ) {
//                   BigDecimal fullLoadAirDeliveryData = new BigDecimal(compressor.FullLoadAirDelivery);
//                   BigDecimal zeroData = new BigDecimal(0.0);
//                   if(zeroData.compareTo(fullLoadAirDeliveryData) >= 0 ){
//                        JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("When_displaying_current_as_flow,_'Air_Delivery'_must_be_>_0.") );
//                        return false;
//                    }
//                }
//            }
//        }
//       return true;
//}

private void jButtonCancelActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonCancelActionPerformed
    dispose();
}//GEN-LAST:event_jButtonCancelActionPerformed

private void jRadioTimePeriodActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jRadioTimePeriodActionPerformed
    if ( atInit ) return; 
    getSelectedTime();
}//GEN-LAST:event_jRadioTimePeriodActionPerformed

private void jCheckStartOnMondayActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jCheckStartOnMondayActionPerformed
    if ( atInit ) return;
    getSelectedTime();
}//GEN-LAST:event_jCheckStartOnMondayActionPerformed

private void jTextCurrencyKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextCurrencyKeyTyped
    EventQueue.invokeLater( new Runnable() {
        public void run() {
            myCompressorSettingDlg.setCurrency( jTextCurrency.getText() );
        }
    });
}//GEN-LAST:event_jTextCurrencyKeyTyped

private void jTextCO2EmmisionKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextCO2EmmisionKeyTyped
    EventQueue.invokeLater( new Runnable() {
        public void run() {
            try {
                if ( jTextCO2Emmision.getText().length() > 0 )
                    theLeakStatistics.setCO2EmmisionPerKWh(Double.valueOf( GUIConst.VerifyString( jTextCO2Emmision.getText() )));
                else
                    theLeakStatistics.setCO2EmmisionPerKWh( Compressor.DEFAULT_CO2_EMMISION_PER_KWH);
            } catch ( Exception e ) {
                JOptionPane.showMessageDialog( null, MESSAGE_PLEASE_INPUT_NUMBER );
            }
        }});
}//GEN-LAST:event_jTextCO2EmmisionKeyTyped

private void jComboAirUnitActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jComboAirUnitActionPerformed
    if ( atInit ) return;
    //getAirDelivery();
    //v3-3.
    //air delivery unit will be moved to analyzes settings and it will be the same for every compressor.
     theLeakStatistics.setAir_delivery_unit((String) jComboAirUnit.getSelectedItem()) ;
     //for every compressor.
     ArrayList<Compressor> myCompressors = theLeakStatistics.getCompressors();
     if(myCompressors != null){
         int len = myCompressors.size();
         if(len > 0){
             for(int i =0;i<len;i++){
                 myCompressors.get(i).AirDeliveryUnit = theLeakStatistics.getAir_delivery_unit();
             }
         }
     }
}//GEN-LAST:event_jComboAirUnitActionPerformed

private void jComboAirUnitKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jComboAirUnitKeyTyped
    // TODO add your handling code here:
//     EventQueue.invokeLater( new Runnable() {
//        public void run() {
//            myCompressorSettingDlg.setAirDeliveryUnit(jComboAirUnit.getSelectedItem().toString() );
//        }
//    });
//    theLeakStatistics.setAir_delivery_unit(jComboAirUnit.getSelectedItem().toString());
}//GEN-LAST:event_jComboAirUnitKeyTyped

private void jComboAirUnitItemStateChanged(java.awt.event.ItemEvent evt) {//GEN-FIRST:event_jComboAirUnitItemStateChanged
    // TODO add your handling code here:
     EventQueue.invokeLater( new Runnable() {
        public void run() {
            myCompressorSettingDlg.setAirDeliveryUnit(jComboAirUnit.getSelectedItem().toString() );
        }
    });
}//GEN-LAST:event_jComboAirUnitItemStateChanged

private void jRadioCurrentActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jRadioCurrentActionPerformed
    // TODO add your handling code here:
    //add on 20091111. v3-3
    theCommonValue.setShowAsFlow( jRadioFlow.isSelected() );
//    if(theCommonValue.getCompressors().size() > 1){
//        theCommonValue.setShowCurrentValuesAsFlow( false );
//    }
//    System.out.println("jRadioCurrentActionPerformed/jRadioFlow.isSelected() ="+jRadioFlow.isSelected());
}//GEN-LAST:event_jRadioCurrentActionPerformed

private void jRadioFlowActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jRadioFlowActionPerformed
    // TODO add your handling code here:
//     theCommonValue.setShowCurrentValuesAsFlow( jRadioFlow.isSelected() );
    
        //add on 20091111. v3-3
     theCommonValue.setShowAsFlow( jRadioFlow.isSelected() );
//     if(theCommonValue.getCompressors().size() > 1){
//        theCommonValue.setShowCurrentValuesAsFlow( true );
//     }
//     System.out.println("jRadioFlowAction/jRadioFlow.isSelected() ="+jRadioFlow.isSelected());
}//GEN-LAST:event_jRadioFlowActionPerformed

    private void jComBAssignFlowChannelActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jComBAssignFlowChannelActionPerformed
           
        int index = jComBAssignFlowChannel.getSelectedIndex();     
        if ( index >= 0 ){
            theCommonValue.setSystemFlowChannelTmp(assignFlowChannel.get(index));
            isAssignSystemFlowChannel = true;
        }

    }//GEN-LAST:event_jComBAssignFlowChannelActionPerformed
    
    private final int START_X = 200;
    private final int START_Y = 100;
    private final int WIDTH = 700;
    private final int HEIGHT = 550;
    
    private final long ONE_DAY_MILLS = 86400000;
    private final long ONE_WEEK_MILLS = (long) 7 * 86400000;
    private final long ONE_MONTH_MILLS = (long) 2592 * 1000000;

    private final String COST_PER_M3_INPUT_ERROR_MESSAGE = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_input_a_non-negative_float_value_for_'Energy_cost_per_m?0?'.");

    private final String FORMAT_STRING_2_DIGIT = "%10.2f";
    
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.ButtonGroup buttonGroupReportType;
    private javax.swing.JButton jButtonCancel;
    private javax.swing.JButton jButtonCompressSettings;
    private javax.swing.JButton jButtonOK;
    private javax.swing.JCheckBox jCBDiaplayCo2InReport;
    private javax.swing.JCheckBox jCheckStartOnMonday;
    private javax.swing.JComboBox jComBAssignFlowChannel;
    private javax.swing.JComboBox jComboAirUnit;
    private javax.swing.JComboBox jComboAnalyzesType;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JLabel jLabel10;
    private javax.swing.JLabel jLabel11;
    private javax.swing.JLabel jLabel12;
    private javax.swing.JLabel jLabel2;
    private javax.swing.JLabel jLabel24;
    private javax.swing.JLabel jLabel25;
    private javax.swing.JLabel jLabel3;
    private javax.swing.JLabel jLabel38;
    private javax.swing.JLabel jLabel39;
    private javax.swing.JLabel jLabel4;
    private javax.swing.JLabel jLabel5;
    private javax.swing.JLabel jLabel6;
    private javax.swing.JLabel jLabel7;
    private javax.swing.JLabel jLabel8;
    private javax.swing.JLabel jLabel9;
    private javax.swing.JLabel jLabelDescription;
    private javax.swing.JLabel jLabelEndTimeDate;
    private javax.swing.JLabel jLabelEndTimeDate1;
    private javax.swing.JLabel jLabelEndTimeHour;
    private javax.swing.JLabel jLabelRecordPeriod;
    private javax.swing.JLabel jLabelSelectedPeriod;
    private javax.swing.JLabel jLabelTo;
    private javax.swing.JLabel jLabelTo1;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JPanel jPanel2;
    private javax.swing.JRadioButton jRadioCurrent;
    private javax.swing.JRadioButton jRadioDay;
    private javax.swing.JRadioButton jRadioFlow;
    private javax.swing.JRadioButton jRadioTimePeriod;
    private javax.swing.JRadioButton jRadioWeek;
    private javax.swing.JSpinner jSpinnerEndHour;
    private javax.swing.JSpinner jSpinnerStartHour;
    private javax.swing.JTextField jTextCO2Emmision;
    private javax.swing.JTextField jTextCostPerM3;
    private javax.swing.JTextField jTextCurrency;
    private javax.swing.JTextField jTextWorkHourPerYear;
    private org.jdesktop.swingx.JXDatePicker jXDatePickerEnd;
    private org.jdesktop.swingx.JXDatePicker jXDatePickerStart;
    private javax.swing.JLabel labworkhourperyear;
    // End of variables declaration//GEN-END:variables
    
    private Calendar initStartDate;  // this is to remember the initial time so that we can limit the user's choice range
    private Calendar initEndDate;
    private Calendar startTime;
    private Calendar endTime;
    private Timestamp protocolsStartTime;
    private Timestamp protocolsEndTime;
    
    private SpinnerNumberModel numModelStartHour;
    private SpinnerNumberModel numModelEndHour;
    
    private boolean atInit = false;
    
    private ViewOptions myViewOptions;
    
    private CompressorSettingDialog myCompressorSettingDlg;
    
    private CommonValue theCommonValue;
    private LeakStatistics theLeakStatistics;
    private final String MESSAGE_PLEASE_INPUT_NUMBER = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_input_a_positive_float_number_for_this_field.");

    private Timestamp protocolsValidStartTime;
    private Timestamp protocolsValidEndTime;
    
    private boolean isAssignSystemFlowChannel = false;
        
//    private boolean checkFullLoadAirDeliveryData(CommonValue commonValue, CSMDF DB){
//        try{
//            SelectSystemFlowChanneDialog dialog = new SelectSystemFlowChanneDialog(commonValue, DB);
//            dialog.setModal(true);
//            dialog.setVisible(true);
//
//            if(dialog.isSelectOK()){
//                theCommonValue.setSystemFlowChannelTmp(dialog.getSystemFlowChannel());
//                isAssignSystemFlowChannel = true;
//            }
//        }catch(Exception e){
//            e.printStackTrace();
//            return false;
//        }
//        return true;
//    }
    
    
    private boolean initAssignFlowChannelForSystemAnalyze(CommonValue commonValue, CSMDF DB){
       
        if(commonValue == null || DB == null){
            return false;
        }
        
        try{
//            assignFlowChannel = new ArrayList<NChannelHeader>();
            String oldCompressorDes;
            String newCompressorDes;
            ArrayList<NProtocolHeader> pheaders = commonValue.getProtocolHeaders();
            ArrayList<NChannelHeader> chheaders;

            for ( NProtocolHeader pheader : pheaders ) {               
                chheaders = DB.findChannelHeaders( pheader.Pref );
                for ( NChannelHeader chheader : chheaders ) {
                    if ( MeasurementUnit.IsFlowRateUnit( chheader.getUnitText() )) {
                        
                        assignFlowChannel.add( chheader );

                        oldCompressorDes = chheader.getDescription();
                        newCompressorDes = commonValue.getViewChannelFullName(pheader,chheader);
                        if(newCompressorDes == null){
                            newCompressorDes = oldCompressorDes;
                        }

                        if (newCompressorDes != null && newCompressorDes.length() > 0 )
                            jComBAssignFlowChannel.addItem( newCompressorDes );
                        else
                            jComBAssignFlowChannel.addItem( pheader.DeviceID + "." + chheader.ChannelNumber );

                    }
                }
            }
            
            jComBAssignFlowChannel.setSelectedIndex(0);
            return true;
        }catch(Exception e){
            return false;
        }
    
    }
    
    
    private boolean assigedFlowChannelBaseOnSystemAnalyze(){
        jLabel7.setVisible(true);
        jComBAssignFlowChannel.setVisible(true);

        NChannelHeader assignedChannel = theCommonValue.getSystemFlowChannelTmp();
        if ( assignedChannel == null ){
            jComBAssignFlowChannel.setSelectedIndex( 0 );
        }else{

            try {
                NChannelHeader flowChannel;
                for ( int i = 0; i < assignFlowChannel.size(); i++ ) {
                    flowChannel = assignFlowChannel.get(i);
                    if ( flowChannel.Pref == assignedChannel.Pref && 
                            flowChannel.ChannelNumber == assignedChannel.ChannelNumber ) {
                        jComBAssignFlowChannel.setSelectedIndex(i);
                    }
                }
            } catch ( Exception e ){
                return false;
            }
        }
        
        return true;
    }
    
}
