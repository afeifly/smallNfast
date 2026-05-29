/*
 * StatisticsReportDialog.java
 *
 * Created on 2008年9月5日, 下午6:35
 */

package com.cs.canalyzer.gui.dialog;

import com.cs.canalyzer.gui.GUIConst;
import com.cs.canalyzer.structs.Compressor;
import com.cs.canalyzer.structs.LeakStatistics;
import com.cs.canalyzer.structs.MeasurementUnit;
import java.awt.Color;
import java.awt.Container;
import java.text.NumberFormat;
import java.util.ArrayList;
import javax.swing.ImageIcon;

/**
 *
 * @author  wolf
 */
public class StatisticsReportDialog extends javax.swing.JFrame {
    
    /** Creates new form StatisticsReportDialog */
    public StatisticsReportDialog( LeakStatistics leakStat ) {
        this.theLeakStat = leakStat;
        this.myCompressors = leakStat.getCompressors();
        
        myInit();
    }   
    
    public StatisticsReportDialog( LeakStatistics leakStat, int compressorIndex ) {
        this.theLeakStat = leakStat;
        this.myCompressors = leakStat.getCompressors();
        if ( compressorIndex < myCompressors.size() )
            myCompressorIndex = compressorIndex;
        
        myInit();
    }
    
    private void myInit() {
        initComponents();
        
        setResults();
        
        setIconImage( new ImageIcon( getClass().getResource( GUIConst.IMAGE_PATH + GUIConst.LOGO_FILE_NAME)).getImage() );         
        setBounds( START_X, START_Y, WIDTH, HEIGHT ); 
    }
    
    private void setResults() {
        if ( theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM ) {
            jLabelTitle.setText( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("System_Analyzes") );
            setSystemAnalyzeFields();
        } else if ( theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_FLOW ) {
            jLabelTitle.setText( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Flow_Analyzes") );
            jPanelLoadAnalyzes.setVisible( false );
            jPanelLoadAnalyzesOneYear.setVisible( false );
            jLabelValidRecordTimeLabel.setVisible( false );
            setFlowAnalyzeFields();
        } else { 
            jLabelTitle.setText( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Compressor_Analyzes") );
            setCompressorAnalyzeFields();
        }
        
        jLabelFrom.setText( GUIConst.DEFAULT_DATE_AND_TIME_FORMAT( theLeakStat.getStartTime() ));
        jLabelTo.setText( GUIConst.DEFAULT_DATE_AND_TIME_FORMAT( theLeakStat.getEndTime() ));
        if ( theLeakStat.pressureDataUsed ) {
            jLabelMaxPressure.setText( String.format(FORMAT_STRING_1_DIGIT, theLeakStat.maxPressure ).trim() );
            jLabelMinPressure.setText( String.format(FORMAT_STRING_1_DIGIT, theLeakStat.minPressure ).trim() );
            jLabelPressureUnit.setText( theLeakStat.pressureUnit );
        }
        if ( theLeakStat.dewpointDataUsed ) {
            jLabelMaxDewpoint.setText( String.format(FORMAT_STRING_1_DIGIT, theLeakStat.maxDewpoint ).trim() );
            jLabelMinDewpoint.setText( String.format(FORMAT_STRING_1_DIGIT, theLeakStat.minDewpoint ).trim() );
            jLabelDewpointUnit.setText( theLeakStat.dewpointUnit );
        }
  
        if ( theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_FLOW ||
                myCompressors == null || myCompressors.size() < 2 ) {
            jButtonPrevious.setVisible( false );
            jButtonNext.setVisible( false );
        }
        
        jLabelCostLabel.setText( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Cost") 
                + "[" + theLeakStat.currencyEnergyCost + "]" );
        jLabelCostOneYearLabel.setText( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Cost") 
                + "[" + theLeakStat.currencyEnergyCost + "]" );
    }
    
    private void setSystemAnalyzeFields() {
        setFlowAnalyzeFields();
        setCompressorAnalyzeFields();
    }
    
    private void setFlowAnalyzeFields() {
        String flowFormat;
        if ( MeasurementUnit.FlowUnitResolution( theLeakStat.flowUnit ) == 2 )
            flowFormat = FORMAT_STRING_2_DIGIT;
        else
            flowFormat = FORMAT_STRING_1_DIGIT;
        jLabelAverageFlow.setText( String.format(flowFormat, theLeakStat.averageFlow ).trim() + "    " + theLeakStat.flowUnit );
        jLabelMaxFlow.setText( String.format(flowFormat,theLeakStat.maxFlow ).trim() + "    " + theLeakStat.flowUnit );
        jLabelCostPerM3.setText(String.format(FORMAT_STRING_4_DIGIT, theLeakStat.airUnitCost ).trim() + "   " + theLeakStat.currencyEnergyCost);
        jLabelTotalCost.setText( String.format(FORMAT_STRING_LONG, (long) theLeakStat.totalCost ).trim() + "   " + theLeakStat.currencyEnergyCost );
        jLabelTotalCostOneYear.setText( String.format(FORMAT_STRING_LONG, (long) theLeakStat.totalCostOneYear ).trim() + "   " + theLeakStat.currencyEnergyCost );
        jLabelTotalAir.setText(String.format(FORMAT_STRING_LONG, theLeakStat.totalAirConsumption ).trim() + "    " + theLeakStat.airConsumptionUnit );
        jLabelTotalAirOneYear.setText(String.format(FORMAT_STRING_LONG, theLeakStat.totalAirConsumptionOneYear ).trim() + "    " + theLeakStat.airConsumptionUnit );
        //jLabelFlowUnit.setText( theLeakStat.flowUnit );
        
        // leakage section
        if ( theLeakStat.averageLeakage > 0 ) {
            jLabelAverageLeakage.setText(String.format(FORMAT_STRING_1_DIGIT, theLeakStat.averageLeakage ).trim() + "    " + theLeakStat.flowUnit );
            jLabelLeakageCost.setText(String.format(FORMAT_STRING_LONG, (long) theLeakStat.costOfLeakage ).trim() + "   " + theLeakStat.currencyEnergyCost );
            jLabelLeakageCostOneYear.setText(String.format(FORMAT_STRING_LONG, (long ) theLeakStat.costOfLeakageOneYear ).trim() + "   " + theLeakStat.currencyEnergyCost );
            jLabelTotalLeakage.setText(String.format(FORMAT_STRING_LONG, theLeakStat.totalLeakage ).trim() + "   " + theLeakStat.airConsumptionUnit);
            jLabelTotalLeakageOneYear.setText(String.format(FORMAT_STRING_LONG, theLeakStat.totalLeakageOneYear ).trim() + "   " + theLeakStat.airConsumptionUnit );
        }
    }
    
    private void setCompressorAnalyzeFields() {
        if ( myCompressors == null ) return;
        Compressor compressor = myCompressors.get(myCompressorIndex);
        if ( compressor == null ) return;

        jLabelValidRecordTimeLabel.setVisible( true );
        jLabelValidRecordTime.setText( String.format( FORMAT_STRING_1_DIGIT, 
                ( compressor.TotalHours )).trim() + "  " + TIME_UINT );
        setLoadAnalyzeFields( compressor );
        if ( theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_COMPRESSOR )
            setCompressorFlowFields( compressor );
        if ( compressor.TotalAirDeliveryAmount > 0 )
            jLabelCostPerM3.setText(String.format(FORMAT_STRING_4_DIGIT, compressor.AirUnitCost ).trim()  + "    " + theLeakStat.currencyEnergyCost );
    }
    
    private void setLoadAnalyzeFields( Compressor compressor ) {
        jLabelCompresorName.setText(compressor.Description);
        jLabelCompressorType.setText(Compressor.COMPRESS_TYPE_TEXT[compressor.Type]);

        if ( compressor.Type == Compressor.COMPRESSOR_TYPE_LOAD_UNLOAD 
                || compressor.Type == Compressor.COMPRESSOR_TYPE_VARIABLE_FREQUENCY ) {
            jLabelFullLoadCost.setText(String.format(FORMAT_STRING_LONG, (long) compressor.FullLoadEnergyCost).trim() );
            jLabelFullLoadCostOneYear.setText(String.format(FORMAT_STRING_LONG, (long) compressor.FullLoadEnergyCostOneYear).trim() );
            jLabelFullLoadEnergy.setText(String.format(FORMAT_STRING_1_DIGIT, compressor.FullLoadEnergyConsumption).trim() );
            jLabelFullLoadEnergyOneYear.setText(String.format(FORMAT_STRING_0_DIGIT, compressor.FullLoadEnergyConsumptionOneYear).trim() );
            jLabelFullLoadTimeOneYear.setText(String.format(FORMAT_STRING_0_DIGIT, compressor.FullLoadHoursOneYear).trim() + " " + TIME_UINT );
            jLabelLoadChanges.setText(String.format(FORMAT_STRING_INT, compressor.NumOfLoadChanges).trim() );
            jLabelLoadChangesOneYear.setText(String.format(FORMAT_STRING_0_DIGIT, compressor.NumOfLoadChangesOneYear).trim() );

            jLabelNoLoadCost.setText(String.format(FORMAT_STRING_LONG, (long) compressor.NoLoadEnergyCost).trim() );
            jLabelNoLoadCostOneYear.setText(String.format(FORMAT_STRING_LONG, (long) compressor.NoLoadEnergyCostOneYear).trim() );
            jLabelNoLoadEnergy.setText(String.format(FORMAT_STRING_1_DIGIT, compressor.NoLoadEnergyConsumption).trim() );
            jLabelNoLoadEnergyOneYear.setText(String.format(FORMAT_STRING_0_DIGIT, compressor.NoLoadEnergyConsumptionOneYear).trim() );
            jLabelNoLoadTimeOneYear.setText(String.format(FORMAT_STRING_0_DIGIT, compressor.NoLoadHoursOneYear).trim() + " " + TIME_UINT );
            
            jLabelUnLoadCost.setText(String.format(FORMAT_STRING_LONG, (long) compressor.UnLoadEnergyCost).trim() );
            jLabelUnLoadCostOneYear.setText(String.format(FORMAT_STRING_LONG, (long) compressor.UnLoadEnergyCostOneYear).trim() );
            jLabelUnLoadEnergy.setText(String.format(FORMAT_STRING_1_DIGIT, compressor.UnLoadEnergyConsumption).trim() );
            jLabelUnLoadEnergyOneYear.setText(String.format(FORMAT_STRING_0_DIGIT, compressor.UnLoadEnergyConsumptionOneYear).trim() );
            jLabelUnLoadTimeOneYear.setText(String.format(FORMAT_STRING_0_DIGIT, compressor.UnLoadHoursOneYear).trim() + " " + TIME_UINT );

            // percentage: hardcode to make the total not more than 100% ( because of rounding it could be more than 100% )
            long fullLoadPer = Math.round( compressor.FullLoadPercentageMeasurementInterval * 100 );
            long noLoadPer = Math.round( compressor.NoLoadPercentageMeasurementInterval * 100 );
            long unLoadPer = Math.round( compressor.UnLoadPercentageMeasurementInterval * 100 );
            if ( fullLoadPer + noLoadPer + unLoadPer > 100 ) {
                if ( noLoadPer > 0 )
                    noLoadPer -= 1;
                else if ( unLoadPer > 0 )
                    unLoadPer -= 1;
                else
                    fullLoadPer -= 1;
            }
            jLabelFullLoadTime.setText(String.format(FORMAT_STRING_1_DIGIT, compressor.FullLoadHours).trim() + " " + TIME_UINT +
                    " (" + NumberFormat.getPercentInstance().format( fullLoadPer / 100f ) + ")" );
            jLabelNoLoadTime.setText(String.format(FORMAT_STRING_1_DIGIT, compressor.NoLoadHours).trim() + " " + TIME_UINT + 
                    " (" + NumberFormat.getPercentInstance().format( noLoadPer / 100f ) + ")" );
            jLabelUnLoadTime.setText(String.format(FORMAT_STRING_1_DIGIT, compressor.UnLoadHours).trim() + " " + TIME_UINT + 
                    " (" + NumberFormat.getPercentInstance().format( unLoadPer / 100f ) + ")" );
        } else {
            jLabelFullLoadCost.setText( "" );
            jLabelFullLoadCostOneYear.setText( "" );
            jLabelFullLoadEnergy.setText( "" );
            jLabelFullLoadEnergyOneYear.setText( "" );
            jLabelFullLoadTimeOneYear.setText( "" );
            jLabelLoadChanges.setText( "" );
            jLabelLoadChangesOneYear.setText( "" );

            jLabelNoLoadCost.setText("" );
            jLabelNoLoadCostOneYear.setText("" );
            jLabelNoLoadEnergy.setText("" );
            jLabelNoLoadEnergyOneYear.setText("" );
            jLabelNoLoadTimeOneYear.setText( "" );
            
            jLabelUnLoadCost.setText( "" );
            jLabelUnLoadCostOneYear.setText( "" );
            jLabelUnLoadEnergy.setText( "" );
            jLabelUnLoadEnergyOneYear.setText( "" );
            jLabelUnLoadTimeOneYear.setText( "" );

            jLabelFullLoadTime.setText( "" );
            jLabelNoLoadTime.setText( "" );
            jLabelUnLoadTime.setText( "" );
        }
        
        jLabelTotalCost.setText(String.format(FORMAT_STRING_LONG, (long) compressor.TotalCost).trim() + "   " + theLeakStat.currencyEnergyCost );
        jLabelTotalCostOneYear.setText(String.format(FORMAT_STRING_LONG, (long) compressor.TotalCostOneYear).trim() + "   " + theLeakStat.currencyEnergyCost );
        jLabelTotalEnergyCost.setText(String.format(FORMAT_STRING_LONG, (long) compressor.TotalCost).trim() );
        jLabelTotalEnergyCostOneYear.setText(String.format(FORMAT_STRING_LONG, (long) compressor.TotalCostOneYear).trim() );
        jLabelTotalEnergy.setText(String.format(FORMAT_STRING_1_DIGIT, compressor.TotalEnergyConsumption).trim() );
        jLabelTotalEnergyOneYear.setText(String.format(FORMAT_STRING_0_DIGIT, compressor.TotalEnergyConsumptionOneYear).trim() );
        
        jLabelCO2Emmision.setText( String.format(FORMAT_STRING_LONG, (long) compressor.CO2Emmision ).trim() + "   "
                + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("kg") );
        jLabelCO2EmmisionOneYear.setText( String.format(FORMAT_STRING_LONG, (long) compressor.CO2EmmisionOneYear ).trim() );
        
        // leakage
        if ( theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_COMPRESSOR ) {
            if ( compressor.LeakageCost > 0 ) {
                jLabelLeakageCost.setText(String.format(FORMAT_STRING_LONG, (long) compressor.LeakageCost) + "   " + theLeakStat.currencyEnergyCost );
                jLabelLeakageCostOneYear.setText(String.format(FORMAT_STRING_LONG, (long) compressor.LeakageCostOneYear + "   " + theLeakStat.currencyEnergyCost) );
            } else {
                jLabelLeakageCost.setText( "" );
                jLabelLeakageCostOneYear.setText( "" );
            }
        }
    }
    
    private void setCompressorFlowFields( Compressor compressor ) {
        if ( compressor.TotalAirDeliveryAmount > 0 ) {
            jLabelCostPerM3.setText(String.format(FORMAT_STRING_4_DIGIT, compressor.AirUnitCost ).trim()  + "    " + theLeakStat.currencyEnergyCost );
            String airConsumptionUnit = compressor.AirDeliveryUnit;
            if ( airConsumptionUnit.indexOf( "/" ) > 0 )
                airConsumptionUnit = airConsumptionUnit.substring( 0, airConsumptionUnit.indexOf( "/" ));
            String flowFormat;
            if ( MeasurementUnit.FlowUnitResolution( compressor.AirDeliveryUnit ) == 2 )
                flowFormat = FORMAT_STRING_2_DIGIT;
            else
                flowFormat = FORMAT_STRING_1_DIGIT;
            jLabelAverageFlow.setText(String.format(flowFormat, compressor.AverageFlow ).trim() +  "    " + compressor.AirDeliveryUnit );
            jLabelMaxFlow.setText( String.format(flowFormat,compressor.MaxFlow ).trim() +  "    " + compressor.AirDeliveryUnit );
            jLabelTotalAir.setText( String.format(FORMAT_STRING_LONG, compressor.TotalAirDeliveryAmount ).trim() +  "    " + airConsumptionUnit );
            jLabelTotalAirOneYear.setText(String.format(FORMAT_STRING_LONG, compressor.TotalAirDeliveryAmountOneYear ).trim() + "    " + airConsumptionUnit );
            //jLabelFlowUnit.setText( compressor.AirDeliveryUnit );
        } else {
            jLabelAverageFlow.setText( "" );
            jLabelMaxFlow.setText( "" );
            jLabelCostPerM3.setText( "" );
            jLabelTotalAir.setText( "" );
            jLabelTotalAirOneYear.setText( "" );
        }
        
        // leakage
        if ( compressor.AverageLeakage > 0 ) {
            jLabelAverageLeakage.setText(String.format(FORMAT_STRING_1_DIGIT, compressor.AverageLeakage ).trim() );
            //jLabelTotalLeakage.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakage).trim() );
            //jLabelTotalLeakageOneYear.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakageOneYear).trim() );
            jLabelLeakageCostOneYear.setText(String.format(FORMAT_STRING_LONG, (long) compressor.LeakageCostOneYear ).trim() + "   " + theLeakStat.currencyEnergyCost );
            jLabelTotalLeakage.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakage ).trim() + "   " + theLeakStat.airConsumptionUnit );
            jLabelTotalLeakageOneYear.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakageOneYear ).trim() + "   " + theLeakStat.airConsumptionUnit );
            jLabelLeakageCost.setText(String.format(FORMAT_STRING_LONG, (long) compressor.LeakageCost ).trim() + "   " + theLeakStat.currencyEnergyCost );
        } else {
            jLabelAverageLeakage.setText( "" );
            //jLabelTotalLeakage.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakage).trim() );
            //jLabelTotalLeakageOneYear.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakageOneYear).trim() );
            jLabelLeakageCostOneYear.setText( "" );
            jLabelTotalLeakage.setText( "" );
            jLabelTotalLeakageOneYear.setText( "" );
            jLabelLeakageCost.setText( "" );
        }
    }
    
    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jPanel6 = new javax.swing.JPanel();
        jButtonNext = new javax.swing.JButton();
        jButtonPrevious = new javax.swing.JButton();
        jButtonClost = new javax.swing.JButton();
        jPanel5 = new javax.swing.JPanel();
        jPanel1 = new javax.swing.JPanel();
        jPanel10 = new javax.swing.JPanel();
        jPanel12 = new javax.swing.JPanel();
        jLabel73 = new javax.swing.JLabel();
        jLabelTotalAirOneYear = new javax.swing.JLabel();
        jLabel75 = new javax.swing.JLabel();
        jLabelTotalCostOneYear = new javax.swing.JLabel();
        jLabel77 = new javax.swing.JLabel();
        jLabelTotalLeakageOneYear = new javax.swing.JLabel();
        jLabel79 = new javax.swing.JLabel();
        jLabelLeakageCostOneYear = new javax.swing.JLabel();
        jLabel76 = new javax.swing.JLabel();
        jLabelCO2EmmisionOneYear = new javax.swing.JLabel();
        jLabelCO2EmmisionOneYear1 = new javax.swing.JLabel();
        jPanelLoadAnalyzesOneYear = new javax.swing.JPanel();
        jLabel54 = new javax.swing.JLabel();
        jLabel55 = new javax.swing.JLabel();
        jLabelCostOneYearLabel = new javax.swing.JLabel();
        jLabel57 = new javax.swing.JLabel();
        jLabel58 = new javax.swing.JLabel();
        jLabel59 = new javax.swing.JLabel();
        jLabel60 = new javax.swing.JLabel();
        jLabel61 = new javax.swing.JLabel();
        jLabel62 = new javax.swing.JLabel();
        jLabelFullLoadTimeOneYear = new javax.swing.JLabel();
        jLabelUnLoadTimeOneYear = new javax.swing.JLabel();
        jLabelNoLoadTimeOneYear = new javax.swing.JLabel();
        jLabelLoadChangesOneYear = new javax.swing.JLabel();
        jLabelFullLoadEnergyOneYear = new javax.swing.JLabel();
        jLabelUnLoadEnergyOneYear = new javax.swing.JLabel();
        jLabelTotalEnergyOneYear = new javax.swing.JLabel();
        jLabelFullLoadCostOneYear = new javax.swing.JLabel();
        jLabelUnLoadCostOneYear = new javax.swing.JLabel();
        jLabelTotalEnergyCostOneYear = new javax.swing.JLabel();
        jLabelNoLoadEnergyOneYear = new javax.swing.JLabel();
        jLabelNoLoadCostOneYear = new javax.swing.JLabel();
        jPanel11 = new javax.swing.JPanel();
        jLabel53 = new javax.swing.JLabel();
        jPanel2 = new javax.swing.JPanel();
        jPanelLoadAnalyzes = new javax.swing.JPanel();
        jLabel8 = new javax.swing.JLabel();
        jLabel10 = new javax.swing.JLabel();
        jLabelCostLabel = new javax.swing.JLabel();
        jLabel12 = new javax.swing.JLabel();
        jLabel13 = new javax.swing.JLabel();
        jLabel14 = new javax.swing.JLabel();
        jLabel15 = new javax.swing.JLabel();
        jLabel16 = new javax.swing.JLabel();
        jLabel17 = new javax.swing.JLabel();
        jLabelFullLoadTime = new javax.swing.JLabel();
        jLabelUnLoadTime = new javax.swing.JLabel();
        jLabelNoLoadTime = new javax.swing.JLabel();
        jLabelLoadChanges = new javax.swing.JLabel();
        jLabelFullLoadEnergy = new javax.swing.JLabel();
        jLabelUnLoadEnergy = new javax.swing.JLabel();
        jLabelTotalEnergy = new javax.swing.JLabel();
        jLabelFullLoadCost = new javax.swing.JLabel();
        jLabelUnLoadCost = new javax.swing.JLabel();
        jLabelTotalEnergyCost = new javax.swing.JLabel();
        jLabelNoLoadEnergy = new javax.swing.JLabel();
        jLabelNoLoadCost = new javax.swing.JLabel();
        jPanel7 = new javax.swing.JPanel();
        jLabel9 = new javax.swing.JLabel();
        jLabel28 = new javax.swing.JLabel();
        jLabel29 = new javax.swing.JLabel();
        jLabel30 = new javax.swing.JLabel();
        jLabel31 = new javax.swing.JLabel();
        jLabel32 = new javax.swing.JLabel();
        jLabelTotalCostPre = new javax.swing.JLabel();
        jLabelLeakageCostPre = new javax.swing.JLabel();
        jLabelTotalAir = new javax.swing.JLabel();
        jLabelAverageFlow = new javax.swing.JLabel();
        jLabelMaxFlow = new javax.swing.JLabel();
        jLabelTotalLeakage = new javax.swing.JLabel();
        jLabelAverageLeakage = new javax.swing.JLabel();
        jLabel40 = new javax.swing.JLabel();
        jLabel41 = new javax.swing.JLabel();
        jLabel42 = new javax.swing.JLabel();
        jLabel43 = new javax.swing.JLabel();
        jLabelMaxPressure = new javax.swing.JLabel();
        jLabelMaxDewpoint = new javax.swing.JLabel();
        jLabelMinPressure = new javax.swing.JLabel();
        jLabelMinDewpoint = new javax.swing.JLabel();
        jLabelPressureUnit = new javax.swing.JLabel();
        jLabelDewpointUnit = new javax.swing.JLabel();
        jLabelCostPerM3 = new javax.swing.JLabel();
        jLabelTotalCost = new javax.swing.JLabel();
        jLabelLeakageCost = new javax.swing.JLabel();
        jLabelTotalCostPre1 = new javax.swing.JLabel();
        jLabelFlowUnit = new javax.swing.JLabel();
        jLabelCO2Emmision = new javax.swing.JLabel();
        jLabelTotalCostPre2 = new javax.swing.JLabel();
        jPanel3 = new javax.swing.JPanel();
        jPanel4 = new javax.swing.JPanel();
        jLabelTitle = new javax.swing.JLabel();
        jPanel13 = new javax.swing.JPanel();
        jLabel2 = new javax.swing.JLabel();
        jLabelFrom = new javax.swing.JLabel();
        jLabel4 = new javax.swing.JLabel();
        jLabelTo = new javax.swing.JLabel();
        jPanel8 = new javax.swing.JPanel();
        jLabel3 = new javax.swing.JLabel();
        jLabel5 = new javax.swing.JLabel();
        jLabelCompresorName = new javax.swing.JLabel();
        jLabelCompressorType = new javax.swing.JLabel();
        jLabelValidRecordTimeLabel = new javax.swing.JLabel();
        jLabelValidRecordTime = new javax.swing.JLabel();
        jPanel9 = new javax.swing.JPanel();

        setDefaultCloseOperation(javax.swing.WindowConstants.DISPOSE_ON_CLOSE);
        java.util.ResourceBundle bundle = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts"); // NOI18N
        setTitle(bundle.getString("Statistics_Report")); // NOI18N

        jPanel6.setPreferredSize(new java.awt.Dimension(100, 50));
        jPanel6.setLayout(null);

        jButtonNext.setFont(new java.awt.Font("DialogInput", 0, 12));
        jButtonNext.setForeground(new java.awt.Color(0, 204, 51));
        jButtonNext.setText(bundle.getString("Next")); // NOI18N
        jButtonNext.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonNextActionPerformed(evt);
            }
        });
        jPanel6.add(jButtonNext);
        jButtonNext.setBounds(320, 0, 100, 22);

        jButtonPrevious.setFont(new java.awt.Font("DialogInput", 0, 12));
        jButtonPrevious.setForeground(new java.awt.Color(0, 204, 51));
        jButtonPrevious.setText(bundle.getString("Previous")); // NOI18N
        jButtonPrevious.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonPreviousActionPerformed(evt);
            }
        });
        jPanel6.add(jButtonPrevious);
        jButtonPrevious.setBounds(210, 0, 100, 22);

        jButtonClost.setFont(new java.awt.Font("DialogInput", 0, 12));
        jButtonClost.setText(bundle.getString("Close")); // NOI18N
        jButtonClost.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonClostActionPerformed(evt);
            }
        });
        jPanel6.add(jButtonClost);
        jButtonClost.setBounds(490, 10, 120, 25);

        getContentPane().add(jPanel6, java.awt.BorderLayout.SOUTH);

        jPanel5.setLayout(new java.awt.BorderLayout());

        jPanel1.setPreferredSize(new java.awt.Dimension(100, 270));
        jPanel1.setLayout(new java.awt.BorderLayout());

        jPanel10.setLayout(new java.awt.BorderLayout());

        jLabel73.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel73.setText(bundle.getString("Total_air_delivery:")); // NOI18N

        jLabelTotalAirOneYear.setFont(GUIConst.REPORT_FONT);

        jLabel75.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel75.setText(bundle.getString("Total_costs:")); // NOI18N

        jLabelTotalCostOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelTotalCostOneYear.setText(bundle.getString("Cost")); // NOI18N

        jLabel77.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel77.setText(bundle.getString("Total_leakage:")); // NOI18N

        jLabelTotalLeakageOneYear.setFont(GUIConst.REPORT_FONT);

        jLabel79.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel79.setText(bundle.getString("Leakage_costs:")); // NOI18N

        jLabelLeakageCostOneYear.setFont(GUIConst.REPORT_FONT);

        jLabel76.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel76.setText(bundle.getString("CO2_Emmision:")); // NOI18N

        jLabelCO2EmmisionOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelCO2EmmisionOneYear.setText("   ");

        jLabelCO2EmmisionOneYear1.setFont(GUIConst.REPORT_FONT);
        jLabelCO2EmmisionOneYear1.setText("kg");

        org.jdesktop.layout.GroupLayout jPanel12Layout = new org.jdesktop.layout.GroupLayout(jPanel12);
        jPanel12.setLayout(jPanel12Layout);
        jPanel12Layout.setHorizontalGroup(
            jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel12Layout.createSequentialGroup()
                .addContainerGap()
                .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel73)
                    .add(jLabel77)
                    .add(jLabel76))
                .add(28, 28, 28)
                .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel12Layout.createSequentialGroup()
                        .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jLabelTotalAirOneYear)
                            .add(jLabelTotalLeakageOneYear))
                        .add(146, 146, 146)
                        .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jLabel75)
                            .add(jLabel79))
                        .add(25, 25, 25)
                        .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jLabelLeakageCostOneYear)
                            .add(jLabelTotalCostOneYear)))
                    .add(jPanel12Layout.createSequentialGroup()
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jLabelCO2EmmisionOneYear)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                        .add(jLabelCO2EmmisionOneYear1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 30, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                .addContainerGap(696, Short.MAX_VALUE))
        );
        jPanel12Layout.setVerticalGroup(
            jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel12Layout.createSequentialGroup()
                .addContainerGap()
                .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel12Layout.createSequentialGroup()
                        .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel73)
                            .add(jLabelTotalAirOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel77)
                            .add(jLabelTotalLeakageOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                    .add(jPanel12Layout.createSequentialGroup()
                        .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabelTotalCostOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabel75))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel79)
                            .add(jLabelLeakageCostOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel12Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                        .add(jLabelCO2EmmisionOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                        .add(jLabelCO2EmmisionOneYear1, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                    .add(jLabel76))
                .addContainerGap(24, Short.MAX_VALUE))
        );

        jPanel10.add(jPanel12, java.awt.BorderLayout.CENTER);

        jPanelLoadAnalyzesOneYear.setPreferredSize(new java.awt.Dimension(100, 150));

        jLabel54.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel54.setText(bundle.getString("Time")); // NOI18N

        jLabel55.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel55.setText(bundle.getString("Energy[kWh]")); // NOI18N

        jLabelCostOneYearLabel.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabelCostOneYearLabel.setText(bundle.getString("Cost[Euro]")); // NOI18N

        jLabel57.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel57.setText(bundle.getString("Load_analyzes:")); // NOI18N

        jLabel58.setFont(GUIConst.REPORT_FONT);
        jLabel58.setText(bundle.getString("Full_load:")); // NOI18N

        jLabel59.setFont(GUIConst.REPORT_FONT);
        jLabel59.setText(bundle.getString("Un_load:")); // NOI18N

        jLabel60.setFont(GUIConst.REPORT_FONT);
        jLabel60.setText(bundle.getString("Stop:")); // NOI18N

        jLabel61.setFont(GUIConst.REPORT_FONT);
        jLabel61.setText(bundle.getString("Load/Unload_cycles:")); // NOI18N

        jLabel62.setFont(GUIConst.REPORT_FONT);
        jLabel62.setText(bundle.getString("Total_energy_consumption:")); // NOI18N

        jLabelFullLoadTimeOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelFullLoadTimeOneYear.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelFullLoadTimeOneYear.setText("      a     ");

        jLabelUnLoadTimeOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelUnLoadTimeOneYear.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelUnLoadTimeOneYear.setText("     a      ");

        jLabelNoLoadTimeOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelNoLoadTimeOneYear.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelNoLoadTimeOneYear.setText("  aa         ");

        jLabelLoadChangesOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelLoadChangesOneYear.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelLoadChangesOneYear.setText("   aa         ");

        jLabelFullLoadEnergyOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelFullLoadEnergyOneYear.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelFullLoadEnergyOneYear.setText("      a     ");

        jLabelUnLoadEnergyOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelUnLoadEnergyOneYear.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelUnLoadEnergyOneYear.setText("      a     ");

        jLabelTotalEnergyOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelTotalEnergyOneYear.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelTotalEnergyOneYear.setText("      a     ");

        jLabelFullLoadCostOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelFullLoadCostOneYear.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelFullLoadCostOneYear.setText("      a     ");

        jLabelUnLoadCostOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelUnLoadCostOneYear.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelUnLoadCostOneYear.setText("      a     ");

        jLabelTotalEnergyCostOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelTotalEnergyCostOneYear.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelTotalEnergyCostOneYear.setText("      a     ");

        jLabelNoLoadEnergyOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelNoLoadEnergyOneYear.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelNoLoadEnergyOneYear.setText("      a     ");

        jLabelNoLoadCostOneYear.setFont(GUIConst.REPORT_FONT);
        jLabelNoLoadCostOneYear.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelNoLoadCostOneYear.setText("      a     ");

        org.jdesktop.layout.GroupLayout jPanelLoadAnalyzesOneYearLayout = new org.jdesktop.layout.GroupLayout(jPanelLoadAnalyzesOneYear);
        jPanelLoadAnalyzesOneYear.setLayout(jPanelLoadAnalyzesOneYearLayout);
        jPanelLoadAnalyzesOneYearLayout.setHorizontalGroup(
            jPanelLoadAnalyzesOneYearLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelLoadAnalyzesOneYearLayout.createSequentialGroup()
                .addContainerGap()
                .add(jLabel57)
                .add(37, 37, 37)
                .add(jPanelLoadAnalyzesOneYearLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel59)
                    .add(jLabel60)
                    .add(jLabel61)
                    .add(jLabel62)
                    .add(jLabel58))
                .add(10, 10, 10)
                .add(jPanelLoadAnalyzesOneYearLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabelFullLoadTimeOneYear)
                    .add(jLabelUnLoadTimeOneYear)
                    .add(jLabelNoLoadTimeOneYear)
                    .add(jLabelLoadChangesOneYear)
                    .add(jLabel54))
                .add(20, 20, 20)
                .add(jPanelLoadAnalyzesOneYearLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabelFullLoadEnergyOneYear)
                    .add(jLabelUnLoadEnergyOneYear)
                    .add(jLabelTotalEnergyOneYear)
                    .add(jLabel55)
                    .add(jLabelNoLoadEnergyOneYear))
                .add(32, 32, 32)
                .add(jPanelLoadAnalyzesOneYearLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabelNoLoadCostOneYear)
                    .add(jLabelFullLoadCostOneYear)
                    .add(jLabelUnLoadCostOneYear)
                    .add(jLabelTotalEnergyCostOneYear)
                    .add(jLabelCostOneYearLabel))
                .add(319, 319, 319))
        );
        jPanelLoadAnalyzesOneYearLayout.setVerticalGroup(
            jPanelLoadAnalyzesOneYearLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelLoadAnalyzesOneYearLayout.createSequentialGroup()
                .addContainerGap()
                .add(jPanelLoadAnalyzesOneYearLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanelLoadAnalyzesOneYearLayout.createSequentialGroup()
                        .add(28, 28, 28)
                        .add(jPanelLoadAnalyzesOneYearLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel57)
                            .add(jLabelFullLoadTimeOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelFullLoadEnergyOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelFullLoadCostOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabel58))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanelLoadAnalyzesOneYearLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel59)
                            .add(jLabelUnLoadTimeOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelUnLoadEnergyOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelUnLoadCostOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanelLoadAnalyzesOneYearLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel60)
                            .add(jLabelNoLoadTimeOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelNoLoadEnergyOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelNoLoadCostOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanelLoadAnalyzesOneYearLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel61, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelLoadChangesOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanelLoadAnalyzesOneYearLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel62, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelTotalEnergyOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelTotalEnergyCostOneYear, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                    .add(jPanelLoadAnalyzesOneYearLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                        .add(jLabel54)
                        .add(jLabel55)
                        .add(jLabelCostOneYearLabel)))
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );

        jPanel10.add(jPanelLoadAnalyzesOneYear, java.awt.BorderLayout.NORTH);

        jPanel1.add(jPanel10, java.awt.BorderLayout.CENTER);

        jPanel11.setPreferredSize(new java.awt.Dimension(100, 20));
        jPanel11.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT, 15, 0));

        jLabel53.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel53.setText(bundle.getString("Cumulated_statistics_for_one_year_[8400_h]:")); // NOI18N
        jPanel11.add(jLabel53);

        jPanel1.add(jPanel11, java.awt.BorderLayout.NORTH);

        jPanel5.add(jPanel1, java.awt.BorderLayout.SOUTH);

        jPanel2.setLayout(new java.awt.BorderLayout());

        jPanelLoadAnalyzes.setPreferredSize(new java.awt.Dimension(100, 150));

        jLabel8.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel8.setText(bundle.getString("Time")); // NOI18N

        jLabel10.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel10.setText(bundle.getString("Energy[kWh]")); // NOI18N

        jLabelCostLabel.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabelCostLabel.setText(bundle.getString("Cost[Euro]")); // NOI18N

        jLabel12.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel12.setText(bundle.getString("Load_analyzes:")); // NOI18N

        jLabel13.setFont(GUIConst.REPORT_FONT);
        jLabel13.setText(bundle.getString("Full_load:")); // NOI18N

        jLabel14.setFont(GUIConst.REPORT_FONT);
        jLabel14.setText(bundle.getString("Un_load:")); // NOI18N

        jLabel15.setFont(GUIConst.REPORT_FONT);
        jLabel15.setText(bundle.getString("Stop:")); // NOI18N

        jLabel16.setFont(GUIConst.REPORT_FONT);
        jLabel16.setText(bundle.getString("Load/Unload_cycles:")); // NOI18N

        jLabel17.setFont(GUIConst.REPORT_FONT);
        jLabel17.setText(bundle.getString("Total_energy_consumption:")); // NOI18N

        jLabelFullLoadTime.setFont(GUIConst.REPORT_FONT);
        jLabelFullLoadTime.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabelFullLoadTime.setText("      a     ");
        jLabelFullLoadTime.setPreferredSize(new java.awt.Dimension(120, 15));

        jLabelUnLoadTime.setFont(GUIConst.REPORT_FONT);
        jLabelUnLoadTime.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabelUnLoadTime.setText("     a      ");
        jLabelUnLoadTime.setPreferredSize(new java.awt.Dimension(120, 15));

        jLabelNoLoadTime.setFont(GUIConst.REPORT_FONT);
        jLabelNoLoadTime.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabelNoLoadTime.setText("  aa         ");
        jLabelNoLoadTime.setPreferredSize(new java.awt.Dimension(120, 15));

        jLabelLoadChanges.setFont(GUIConst.REPORT_FONT);
        jLabelLoadChanges.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabelLoadChanges.setText("   aa         ");
        jLabelLoadChanges.setPreferredSize(new java.awt.Dimension(120, 15));

        jLabelFullLoadEnergy.setFont(GUIConst.REPORT_FONT);
        jLabelFullLoadEnergy.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelFullLoadEnergy.setText("      a     ");

        jLabelUnLoadEnergy.setFont(GUIConst.REPORT_FONT);
        jLabelUnLoadEnergy.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelUnLoadEnergy.setText("      a     ");

        jLabelTotalEnergy.setFont(GUIConst.REPORT_FONT);
        jLabelTotalEnergy.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelTotalEnergy.setText("      a     ");

        jLabelFullLoadCost.setFont(GUIConst.REPORT_FONT);
        jLabelFullLoadCost.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelFullLoadCost.setText("      a     ");

        jLabelUnLoadCost.setFont(GUIConst.REPORT_FONT);
        jLabelUnLoadCost.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelUnLoadCost.setText("      a     ");

        jLabelTotalEnergyCost.setFont(GUIConst.REPORT_FONT);
        jLabelTotalEnergyCost.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelTotalEnergyCost.setText("      a     ");

        jLabelNoLoadEnergy.setFont(GUIConst.REPORT_FONT);
        jLabelNoLoadEnergy.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelNoLoadEnergy.setText("      a     ");

        jLabelNoLoadCost.setFont(GUIConst.REPORT_FONT);
        jLabelNoLoadCost.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelNoLoadCost.setText("      a     ");

        org.jdesktop.layout.GroupLayout jPanelLoadAnalyzesLayout = new org.jdesktop.layout.GroupLayout(jPanelLoadAnalyzes);
        jPanelLoadAnalyzes.setLayout(jPanelLoadAnalyzesLayout);
        jPanelLoadAnalyzesLayout.setHorizontalGroup(
            jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelLoadAnalyzesLayout.createSequentialGroup()
                .addContainerGap()
                .add(jLabel12)
                .add(37, 37, 37)
                .add(jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel14)
                    .add(jLabel15)
                    .add(jLabel16)
                    .add(jLabel17)
                    .add(jLabel13))
                .add(10, 10, 10)
                .add(jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel8, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 44, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabelFullLoadTime, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabelUnLoadTime, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabelNoLoadTime, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabelLoadChanges, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .add(10, 10, 10)
                .add(jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel10)
                    .add(jLabelFullLoadEnergy)
                    .add(jLabelUnLoadEnergy)
                    .add(jLabelTotalEnergy)
                    .add(jLabelNoLoadEnergy))
                .add(jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanelLoadAnalyzesLayout.createSequentialGroup()
                        .add(18, 18, 18)
                        .add(jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jLabelCostLabel)
                            .add(jLabelFullLoadCost)
                            .add(jLabelUnLoadCost)
                            .add(jLabelTotalEnergyCost)))
                    .add(jPanelLoadAnalyzesLayout.createSequentialGroup()
                        .add(18, 18, 18)
                        .add(jLabelNoLoadCost)))
                .add(319, 319, 319))
        );
        jPanelLoadAnalyzesLayout.setVerticalGroup(
            jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanelLoadAnalyzesLayout.createSequentialGroup()
                .addContainerGap()
                .add(jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanelLoadAnalyzesLayout.createSequentialGroup()
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel10)
                            .add(jLabelCostLabel))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                        .add(jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel12)
                            .add(jLabelFullLoadTime, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelFullLoadEnergy, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelFullLoadCost, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabel13))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel14)
                            .add(jLabelUnLoadTime, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelUnLoadEnergy, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelUnLoadCost, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel15)
                            .add(jLabelNoLoadTime, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelNoLoadEnergy, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelNoLoadCost, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel16, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelLoadChanges, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanelLoadAnalyzesLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel17, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelTotalEnergy, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelTotalEnergyCost, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                    .add(jLabel8))
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );

        jPanel2.add(jPanelLoadAnalyzes, java.awt.BorderLayout.NORTH);

        jLabel9.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel9.setText(bundle.getString("Total_air_delivery:")); // NOI18N

        jLabel28.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel28.setText(bundle.getString("Average_flow:")); // NOI18N

        jLabel29.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel29.setText(bundle.getString("Max_flow:")); // NOI18N

        jLabel30.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel30.setText(bundle.getString("Total_leakage:")); // NOI18N

        jLabel31.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel31.setText(bundle.getString("Average_leakage:")); // NOI18N

        jLabel32.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel32.setText(bundle.getString("Cost_per_m3:")); // NOI18N

        jLabelTotalCostPre.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabelTotalCostPre.setText(bundle.getString("Total_costs:")); // NOI18N

        jLabelLeakageCostPre.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabelLeakageCostPre.setText(bundle.getString("Leakage_costs:")); // NOI18N

        jLabelTotalAir.setFont(GUIConst.REPORT_FONT);
        jLabelTotalAir.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);
        jLabelTotalAir.setText("          ");

        jLabelAverageFlow.setFont(GUIConst.REPORT_FONT);
        jLabelAverageFlow.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);

        jLabelMaxFlow.setFont(GUIConst.REPORT_FONT);
        jLabelMaxFlow.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);

        jLabelTotalLeakage.setFont(GUIConst.REPORT_FONT);
        jLabelTotalLeakage.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);

        jLabelAverageLeakage.setFont(GUIConst.REPORT_FONT);
        jLabelAverageLeakage.setHorizontalAlignment(javax.swing.SwingConstants.LEFT);

        jLabel40.setFont(new java.awt.Font("Dialog", 1, 12)); // NOI18N
        jLabel40.setText(bundle.getString("Max")); // NOI18N

        jLabel41.setFont(new java.awt.Font("Dialog", 1, 12)); // NOI18N
        jLabel41.setText(bundle.getString("Min")); // NOI18N

        jLabel42.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel42.setText(bundle.getString("Pressure")); // NOI18N

        jLabel43.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel43.setText(bundle.getString("Dewpoint")); // NOI18N

        jLabelMaxPressure.setFont(GUIConst.REPORT_FONT);

        jLabelMaxDewpoint.setFont(GUIConst.REPORT_FONT);

        jLabelMinPressure.setFont(GUIConst.REPORT_FONT);
        jLabelMinPressure.setText("    ");

        jLabelMinDewpoint.setFont(GUIConst.REPORT_FONT);
        jLabelMinDewpoint.setText(" ");

        jLabelPressureUnit.setFont(GUIConst.REPORT_FONT);
        jLabelPressureUnit.setText("           ");

        jLabelDewpointUnit.setFont(GUIConst.REPORT_FONT);

        jLabelCostPerM3.setFont(GUIConst.REPORT_FONT);
        jLabelCostPerM3.setText("    ");

        jLabelTotalCost.setFont(GUIConst.REPORT_FONT);
        jLabelTotalCost.setText("    ");

        jLabelLeakageCost.setFont(GUIConst.REPORT_FONT);
        jLabelLeakageCost.setText("              ");

        jLabelTotalCostPre1.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabelTotalCostPre1.setText(bundle.getString("CO2_Emmision:")); // NOI18N

        jLabelFlowUnit.setFont(GUIConst.REPORT_FONT);
        jLabelFlowUnit.setText("   ");

        jLabelCO2Emmision.setFont(GUIConst.REPORT_FONT);
        jLabelCO2Emmision.setText("    ");

        jLabelTotalCostPre2.setFont(GUIConst.REPORT_FONT);
        jLabelTotalCostPre2.setText("   ");

        org.jdesktop.layout.GroupLayout jPanel7Layout = new org.jdesktop.layout.GroupLayout(jPanel7);
        jPanel7.setLayout(jPanel7Layout);
        jPanel7Layout.setHorizontalGroup(
            jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel7Layout.createSequentialGroup()
                .add(200, 200, 200)
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel42)
                    .add(jLabel43))
                .addContainerGap(859, Short.MAX_VALUE))
            .add(jPanel7Layout.createSequentialGroup()
                .add(303, 303, 303)
                .add(jLabelMaxDewpoint, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 37, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(772, Short.MAX_VALUE))
            .add(jPanel7Layout.createSequentialGroup()
                .add(303, 303, 303)
                .add(jLabelMaxPressure, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 53, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(756, Short.MAX_VALUE))
            .add(jPanel7Layout.createSequentialGroup()
                .add(303, 303, 303)
                .add(jLabel40, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 94, Short.MAX_VALUE)
                .addContainerGap(715, Short.MAX_VALUE))
            .add(jPanel7Layout.createSequentialGroup()
                .add(26, 26, 26)
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel9)
                    .add(jLabel28)
                    .add(jLabel29)
                    .add(jLabel30)
                    .add(jLabel31))
                .add(24, 24, 24)
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabelTotalAir, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 100, Short.MAX_VALUE)
                    .add(jLabelAverageFlow, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 100, Short.MAX_VALUE)
                    .add(jLabelMaxFlow, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 100, Short.MAX_VALUE)
                    .add(jLabelTotalLeakage, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 100, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabelAverageLeakage, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 100, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .add(55, 55, 55)
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel32)
                    .add(jLabelTotalCostPre)
                    .add(jLabelTotalCostPre1)
                    .add(jLabelLeakageCostPre))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabelCostPerM3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 90, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabelTotalCost, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 90, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabelCO2Emmision, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 90, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabelLeakageCost))
                .add(10, 10, 10)
                .add(jLabelTotalCostPre2)
                .add(59, 59, 59)
                .add(jLabelFlowUnit)
                .add(527, 527, 527))
            .add(jPanel7Layout.createSequentialGroup()
                .add(388, 388, 388)
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel41, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 64, Short.MAX_VALUE)
                    .add(jLabelMinPressure, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 64, Short.MAX_VALUE)
                    .add(jLabelMinDewpoint, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 64, Short.MAX_VALUE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabelPressureUnit)
                    .add(jLabelDewpointUnit, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 71, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .add(583, 583, 583))
        );

        jPanel7Layout.linkSize(new java.awt.Component[] {jLabel41, jLabelMinDewpoint, jLabelMinPressure}, org.jdesktop.layout.GroupLayout.HORIZONTAL);

        jPanel7Layout.linkSize(new java.awt.Component[] {jLabelCO2Emmision, jLabelCostPerM3, jLabelTotalCost}, org.jdesktop.layout.GroupLayout.HORIZONTAL);

        jPanel7Layout.setVerticalGroup(
            jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel7Layout.createSequentialGroup()
                .addContainerGap()
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel7Layout.createSequentialGroup()
                        .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel9)
                            .add(jLabelTotalAir, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel28)
                            .add(jLabelAverageFlow, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel29)
                            .add(jLabelMaxFlow, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                            .add(jLabel30)
                            .add(jLabelTotalLeakage, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                    .add(jPanel7Layout.createSequentialGroup()
                        .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabel32)
                            .add(jLabelCostPerM3, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabelTotalCostPre)
                            .add(jLabelTotalCost, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                            .add(jLabelTotalCostPre1)
                            .add(jLabelCO2Emmision, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jLabelTotalCostPre2))))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(org.jdesktop.layout.GroupLayout.TRAILING, jLabel31)
                    .add(org.jdesktop.layout.GroupLayout.TRAILING, jLabelAverageLeakage, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(org.jdesktop.layout.GroupLayout.TRAILING, jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                        .add(jLabelLeakageCostPre)
                        .add(jLabelLeakageCost, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel40)
                    .add(jLabel41))
                .add(7, 7, 7)
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(org.jdesktop.layout.GroupLayout.TRAILING, jLabel42)
                    .add(org.jdesktop.layout.GroupLayout.TRAILING, jLabelMaxPressure, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(org.jdesktop.layout.GroupLayout.TRAILING, jLabelMinPressure, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(org.jdesktop.layout.GroupLayout.TRAILING, jLabelPressureUnit, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                .add(jPanel7Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel43)
                    .add(jLabelMaxDewpoint, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabelMinDewpoint, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabelDewpointUnit, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(109, Short.MAX_VALUE))
            .add(jPanel7Layout.createSequentialGroup()
                .add(52, 52, 52)
                .add(jLabelFlowUnit, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(239, Short.MAX_VALUE))
        );

        jPanel2.add(jPanel7, java.awt.BorderLayout.CENTER);

        jPanel5.add(jPanel2, java.awt.BorderLayout.CENTER);

        jPanel3.setPreferredSize(new java.awt.Dimension(100, 120));
        jPanel3.setLayout(new java.awt.BorderLayout());

        jPanel4.setLayout(new java.awt.BorderLayout());

        jLabelTitle.setFont(new java.awt.Font("DialogInput", 1, 18));
        jLabelTitle.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelTitle.setText(bundle.getString("Compressor_Analyzes")); // NOI18N
        jLabelTitle.setPreferredSize(new java.awt.Dimension(152, 40));
        jPanel4.add(jLabelTitle, java.awt.BorderLayout.NORTH);

        jPanel13.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT, 10, 0));

        jLabel2.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel2.setText(bundle.getString("Statistics_for_the_selected_time_period:")); // NOI18N
        jPanel13.add(jLabel2);

        jLabelFrom.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabelFrom.setText("   ");
        jPanel13.add(jLabelFrom);

        jLabel4.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel4.setText(bundle.getString("_to_")); // NOI18N
        jPanel13.add(jLabel4);

        jLabelTo.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabelTo.setText("  ");
        jPanel13.add(jLabelTo);

        jPanel4.add(jPanel13, java.awt.BorderLayout.CENTER);

        jPanel3.add(jPanel4, java.awt.BorderLayout.CENTER);

        jPanel8.setPreferredSize(new java.awt.Dimension(100, 50));

        jLabel3.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel3.setText(bundle.getString("Compressor:")); // NOI18N

        jLabel5.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabel5.setText(bundle.getString("Compressor_Type:")); // NOI18N

        jLabelCompresorName.setFont(GUIConst.REPORT_FONT);
        jLabelCompresorName.setText(bundle.getString("Unknown")); // NOI18N

        jLabelCompressorType.setFont(GUIConst.REPORT_FONT);
        jLabelCompressorType.setText("Unknown");

        jLabelValidRecordTimeLabel.setFont(new java.awt.Font("Dialog", 1, 12));
        jLabelValidRecordTimeLabel.setText(bundle.getString("Valid_record_time:")); // NOI18N

        jLabelValidRecordTime.setFont(GUIConst.REPORT_FONT);
        jLabelValidRecordTime.setText("                ");

        org.jdesktop.layout.GroupLayout jPanel8Layout = new org.jdesktop.layout.GroupLayout(jPanel8);
        jPanel8.setLayout(jPanel8Layout);
        jPanel8Layout.setHorizontalGroup(
            jPanel8Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel8Layout.createSequentialGroup()
                .addContainerGap()
                .add(jPanel8Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jPanel8Layout.createSequentialGroup()
                        .add(jLabel3)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jLabelCompresorName)
                        .add(164, 164, 164)
                        .add(jLabel5)
                        .add(17, 17, 17)
                        .add(jLabelCompressorType))
                    .add(jPanel8Layout.createSequentialGroup()
                        .add(jLabelValidRecordTimeLabel)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jLabelValidRecordTime, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 97, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                .addContainerGap(653, Short.MAX_VALUE))
        );
        jPanel8Layout.setVerticalGroup(
            jPanel8Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel8Layout.createSequentialGroup()
                .add(jPanel8Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabelValidRecordTimeLabel)
                    .add(jLabelValidRecordTime))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanel8Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel5)
                    .add(jLabelCompressorType)
                    .add(jLabel3)
                    .add(jLabelCompresorName))
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );

        jPanel3.add(jPanel8, java.awt.BorderLayout.SOUTH);

        jPanel5.add(jPanel3, java.awt.BorderLayout.NORTH);

        getContentPane().add(jPanel5, java.awt.BorderLayout.CENTER);

        jPanel9.setPreferredSize(new java.awt.Dimension(20, 100));

        org.jdesktop.layout.GroupLayout jPanel9Layout = new org.jdesktop.layout.GroupLayout(jPanel9);
        jPanel9.setLayout(jPanel9Layout);
        jPanel9Layout.setHorizontalGroup(
            jPanel9Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(0, 20, Short.MAX_VALUE)
        );
        jPanel9Layout.setVerticalGroup(
            jPanel9Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(0, 846, Short.MAX_VALUE)
        );

        getContentPane().add(jPanel9, java.awt.BorderLayout.WEST);

        pack();
    }// </editor-fold>//GEN-END:initComponents

private void jButtonNextActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonNextActionPerformed
    if ( myCompressorIndex >= myCompressors.size() - 1 )
        return;
    myCompressorIndex++;
    setCompressorAnalyzeFields();
}//GEN-LAST:event_jButtonNextActionPerformed

private void jButtonPreviousActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonPreviousActionPerformed
    if ( myCompressorIndex == 0 )
        return;
    myCompressorIndex--;
    setCompressorAnalyzeFields();
}//GEN-LAST:event_jButtonPreviousActionPerformed

    //add by be, 2008/10/17 .
    public Container getContainer(){
        
        Color panelColor = java.awt.Color.WHITE;
        jPanel1.setBackground(panelColor);
        jPanel10.setBackground(panelColor);
        jPanel11.setBackground(panelColor);
        jPanel12.setBackground(panelColor);
        jPanel2.setBackground(panelColor);
        jPanel3.setBackground(panelColor);
        jPanel4.setBackground(panelColor);
        jPanel5.setBackground(panelColor);
        jPanel6.setBackground(panelColor);
        jPanel7.setBackground(panelColor);
        jPanel8.setBackground(panelColor);
        jPanelLoadAnalyzes.setBackground(panelColor);
        jPanelLoadAnalyzesOneYear.setBackground(panelColor);
        jPanel5.setBackground(panelColor);
        return this.jPanel5;
    }

private void jButtonClostActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonClostActionPerformed
    dispose();
}//GEN-LAST:event_jButtonClostActionPerformed
    
    private final int START_X = 200;
    private final int START_Y = 50;
    private final int WIDTH = 680;
    private final int HEIGHT = 830;
    
    private final String FORMAT_STRING_0_DIGIT = "%15.0f";
    private final String FORMAT_STRING_1_DIGIT = "%10.1f";
    private final String FORMAT_STRING_2_DIGIT = "%10.2f";
    private final String FORMAT_STRING_4_DIGIT = "%15.4f";
    private final String FORMAT_STRING_LONG = "%15d";
    private final String FORMAT_STRING_INT = "%10d";
    private final String FORMAT_STRING_TIME = "%tF %tR";
    
    private final String TIME_UINT = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("__Hours");
    
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton jButtonClost;
    private javax.swing.JButton jButtonNext;
    private javax.swing.JButton jButtonPrevious;
    private javax.swing.JLabel jLabel10;
    private javax.swing.JLabel jLabel12;
    private javax.swing.JLabel jLabel13;
    private javax.swing.JLabel jLabel14;
    private javax.swing.JLabel jLabel15;
    private javax.swing.JLabel jLabel16;
    private javax.swing.JLabel jLabel17;
    private javax.swing.JLabel jLabel2;
    private javax.swing.JLabel jLabel28;
    private javax.swing.JLabel jLabel29;
    private javax.swing.JLabel jLabel3;
    private javax.swing.JLabel jLabel30;
    private javax.swing.JLabel jLabel31;
    private javax.swing.JLabel jLabel32;
    private javax.swing.JLabel jLabel4;
    private javax.swing.JLabel jLabel40;
    private javax.swing.JLabel jLabel41;
    private javax.swing.JLabel jLabel42;
    private javax.swing.JLabel jLabel43;
    private javax.swing.JLabel jLabel5;
    private javax.swing.JLabel jLabel53;
    private javax.swing.JLabel jLabel54;
    private javax.swing.JLabel jLabel55;
    private javax.swing.JLabel jLabel57;
    private javax.swing.JLabel jLabel58;
    private javax.swing.JLabel jLabel59;
    private javax.swing.JLabel jLabel60;
    private javax.swing.JLabel jLabel61;
    private javax.swing.JLabel jLabel62;
    private javax.swing.JLabel jLabel73;
    private javax.swing.JLabel jLabel75;
    private javax.swing.JLabel jLabel76;
    private javax.swing.JLabel jLabel77;
    private javax.swing.JLabel jLabel79;
    private javax.swing.JLabel jLabel8;
    private javax.swing.JLabel jLabel9;
    private javax.swing.JLabel jLabelAverageFlow;
    private javax.swing.JLabel jLabelAverageLeakage;
    private javax.swing.JLabel jLabelCO2Emmision;
    private javax.swing.JLabel jLabelCO2EmmisionOneYear;
    private javax.swing.JLabel jLabelCO2EmmisionOneYear1;
    private javax.swing.JLabel jLabelCompresorName;
    private javax.swing.JLabel jLabelCompressorType;
    private javax.swing.JLabel jLabelCostLabel;
    private javax.swing.JLabel jLabelCostOneYearLabel;
    private javax.swing.JLabel jLabelCostPerM3;
    private javax.swing.JLabel jLabelDewpointUnit;
    private javax.swing.JLabel jLabelFlowUnit;
    private javax.swing.JLabel jLabelFrom;
    private javax.swing.JLabel jLabelFullLoadCost;
    private javax.swing.JLabel jLabelFullLoadCostOneYear;
    private javax.swing.JLabel jLabelFullLoadEnergy;
    private javax.swing.JLabel jLabelFullLoadEnergyOneYear;
    private javax.swing.JLabel jLabelFullLoadTime;
    private javax.swing.JLabel jLabelFullLoadTimeOneYear;
    private javax.swing.JLabel jLabelLeakageCost;
    private javax.swing.JLabel jLabelLeakageCostOneYear;
    private javax.swing.JLabel jLabelLeakageCostPre;
    private javax.swing.JLabel jLabelLoadChanges;
    private javax.swing.JLabel jLabelLoadChangesOneYear;
    private javax.swing.JLabel jLabelMaxDewpoint;
    private javax.swing.JLabel jLabelMaxFlow;
    private javax.swing.JLabel jLabelMaxPressure;
    private javax.swing.JLabel jLabelMinDewpoint;
    private javax.swing.JLabel jLabelMinPressure;
    private javax.swing.JLabel jLabelNoLoadCost;
    private javax.swing.JLabel jLabelNoLoadCostOneYear;
    private javax.swing.JLabel jLabelNoLoadEnergy;
    private javax.swing.JLabel jLabelNoLoadEnergyOneYear;
    private javax.swing.JLabel jLabelNoLoadTime;
    private javax.swing.JLabel jLabelNoLoadTimeOneYear;
    private javax.swing.JLabel jLabelPressureUnit;
    private javax.swing.JLabel jLabelTitle;
    private javax.swing.JLabel jLabelTo;
    private javax.swing.JLabel jLabelTotalAir;
    private javax.swing.JLabel jLabelTotalAirOneYear;
    private javax.swing.JLabel jLabelTotalCost;
    private javax.swing.JLabel jLabelTotalCostOneYear;
    private javax.swing.JLabel jLabelTotalCostPre;
    private javax.swing.JLabel jLabelTotalCostPre1;
    private javax.swing.JLabel jLabelTotalCostPre2;
    private javax.swing.JLabel jLabelTotalEnergy;
    private javax.swing.JLabel jLabelTotalEnergyCost;
    private javax.swing.JLabel jLabelTotalEnergyCostOneYear;
    private javax.swing.JLabel jLabelTotalEnergyOneYear;
    private javax.swing.JLabel jLabelTotalLeakage;
    private javax.swing.JLabel jLabelTotalLeakageOneYear;
    private javax.swing.JLabel jLabelUnLoadCost;
    private javax.swing.JLabel jLabelUnLoadCostOneYear;
    private javax.swing.JLabel jLabelUnLoadEnergy;
    private javax.swing.JLabel jLabelUnLoadEnergyOneYear;
    private javax.swing.JLabel jLabelUnLoadTime;
    private javax.swing.JLabel jLabelUnLoadTimeOneYear;
    private javax.swing.JLabel jLabelValidRecordTime;
    private javax.swing.JLabel jLabelValidRecordTimeLabel;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JPanel jPanel10;
    private javax.swing.JPanel jPanel11;
    private javax.swing.JPanel jPanel12;
    private javax.swing.JPanel jPanel13;
    private javax.swing.JPanel jPanel2;
    private javax.swing.JPanel jPanel3;
    private javax.swing.JPanel jPanel4;
    private javax.swing.JPanel jPanel5;
    private javax.swing.JPanel jPanel6;
    private javax.swing.JPanel jPanel7;
    private javax.swing.JPanel jPanel8;
    private javax.swing.JPanel jPanel9;
    private javax.swing.JPanel jPanelLoadAnalyzes;
    private javax.swing.JPanel jPanelLoadAnalyzesOneYear;
    // End of variables declaration//GEN-END:variables
 
    private ArrayList<Compressor> myCompressors;
    private int myCompressorIndex = 0; // which compressor is being displayed
    
    private LeakStatistics theLeakStat;
    
    //add by be, 2008/10/17 .
//    public Container getContainer(){
//        
//        Color panelColor = java.awt.Color.WHITE;
//        jPanel1.setBackground(panelColor);
//        jPanel10.setBackground(panelColor);
//        jPanel11.setBackground(panelColor);
//        jPanel12.setBackground(panelColor);
//        jPanel2.setBackground(panelColor);
//        jPanel3.setBackground(panelColor);
//        jPanel4.setBackground(panelColor);
//        jPanel5.setBackground(panelColor);
//        jPanel6.setBackground(panelColor);
//        jPanel7.setBackground(panelColor);
//        jPanel8.setBackground(panelColor);
//        jPanelLoadAnalyzes.setBackground(panelColor);
//        jPanelLoadAnalyzesOneYear.setBackground(panelColor);
//        jPanel5.setBackground(panelColor);
//        return this.jPanel5;
//    }
   // public static void main(String[] a){
        //new StatisticsReportDialog().getContainer();
   // }

    public int getMyCompressorIndex() {
        return myCompressorIndex;
    }
    
    //add by be,20090106.
    //when page more than one, set value.
    public void getPrintPage(int index){
        myCompressorIndex = index;
        if ( myCompressorIndex >= myCompressors.size() - 1 )
            return;
            myCompressorIndex++;
            setCompressorAnalyzeFields();
        }
    
}
