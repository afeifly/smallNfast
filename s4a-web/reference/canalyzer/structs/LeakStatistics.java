/*
 * LeakageStat.java
 *
 * Created on 2007年4月12日, 下午1:13
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */
package com.cs.canalyzer.structs;

import com.cs.database.CSMDF;
import com.cs.database.NChannelHeader;
import com.cs.database.NMeasurementRecordLine;
import com.cs.database.NProtocolHeader;
import com.cs.license.LicenseConst;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Hashtable;
import java.util.List;
import java.util.logging.Level;

/**
 *
 * @author msu
 */
public class LeakStatistics implements Serializable, Cloneable, PropertyChangeListener {

    private static final long serialVersionUID = 9219389280895628012L;//-2048507859818086239L;

    public double maxFlowBaseOnAllCompressors;  // m3/h, added on 20130606
    public double minFlowBaseOnAllCompressors;  // m3/h, added on 20130606
    private NChannelHeader systemFlowChannel = null;
    private boolean isAssignSystemFlowChannel = false;
//    private double systemAnalyzesSumSpecificPower;
    private double systemAnalyzesSumMaxFlow;
    private double systemAnalyzesSumAverageFlow;
    private long systemAnalyzesSumTotalAirDelivery;
    private long systemAnalyzesSumTotalAirDeliveryOneYear;
    private ArrayList<NChannelHeader> selectedFlowNChannelHeaders;
    
    /**
     * Creates a new instance of LeakageStat
     */
    public LeakStatistics(CSMDF db) {
        this.myDB = db;

        resetValues();
    }

    private void resetValues() {
        //public int useAverage;

        //private float costPerKwh = 0.11f;
        //startTime = new Timestamp( System.currentTimeMillis() );
        //endTime = new Timestamp( System.currentTimeMillis() );

        currentDataUsed = false;
        flowDataUsed = false;
        pressureDataUsed = false;
        dewpointDataUsed = false;

        fullLoadHours = 0;
        fullLoadPercentageMeasurementInterval = 0;   // should be presented as percentage
        fullLoadEnergyConsumption = 0;  // in kwh
        fullLoadEnergyCost = 0;  //  in currency

        noLoadHours = 0;
        noLoadPercentageMeasurementInterval = 0;   // should be presented as percentage
        noLoadEnergyConsumption = 0;  // in kwh
        noLoadEnergyCost = 0;  //  in currency

        stopHours = 0;
        stopPercentageMeasurementInterval = 0;   // should be presented as percentage
        numOfLoadChanges = 0;

        totalEnergyConsumption = 0;  // in kwh
        totalCost = 0;  // in currency

        //add on 20091223.
        //reason : Wolfgang Blessing,Michael Kromer test result : numofloadchange is not number of load/unload cycles value.
        //mothed : create number of load/unload cycles field.
        NumOfLoad_UnloadChanges = 0;
        NumOfLoad_UnloadChangesOneYear = 0;

        // compressor statistics -- cumulated data for one year
        fullLoadHoursOneYear = 0;
        noLoadHoursOneYear = 0;
        stopHoursOneYear = 0;
        numOfLoadChangesOneYear = 0;

        fullLoadEnergyConsumptionOneYear = 0;  // in kwh
        noLoadEnergyConsumptionOneYear = 0;  // in kwh
        totalEnergyConsumptionOneYear = 0;  // in kwh
        totalCostOneYear = 0;  // in currency

        // system statistics
        totalAirConsumption = 0;   // in m3
        airConsumptionUnit = "";
        airUnitCost = 0;  // currency / m3
        averageFlow = 0;  //  m3/h
        maxFlow = 0;  // m3/h
        minFlow = 0;
        flowUnit = "";
        totalLeakage = 0;   // m3
        averageLeakage = 0;  // m3/h
        leakageRate = 0;   // should be presented as percentage
        costOfLeakage = 0;  // in currency
        maxPressure = 0;  // bar
        minPressure = 0;  // bar
        averagePressure = 0; // bar
        pressureUnit = "";
        maxDewpoint = 0;
        minDewpoint = 0;
        averageDewPoint = 0;
        dewpointUnit = "";


        //leakThreadHold = 0; // the actual value of the base line (in graphic view)
        //leakLineUnit = "";  // unit of the channel to calculate leakage
        //leakLineRatio = 0; // to remember the position of it on the graph
    }

    public Object clone() {
        try {
            return super.clone();
        } catch (CloneNotSupportedException e) {
            // This should never happen
            throw new InternalError(e.toString());
        }
    }

    public Timestamp getStartTime() {
        return startTime;
    }

    /*
     * public void setStartTime(Timestamp startTime) { this.startTime =
     * startTime;
   }
     */
    public Timestamp getEndTime() {
        return endTime;
    }

    /*
     * public void setEndTime(Timestamp endTime) { this.endTime = endTime;
   }
     */
    public String getLeakLineUnit() {
        return leakLineUnit;
    }

    public float getLeakLineData() {
        return leakThreadHold;
    }

    public void setLeakLineDataCHHeader(NChannelHeader chheader) {
        //this.chheader = new ChannelHeader();
        //this.chheader.copy( chheader );
    }

    public void setLeakLineData(float value, String unit) {
        this.leakThreadHold = value;
        this.leakLineUnit = unit;

        triggerCalculate();
    }

    /**
     * calculation will base on these pheaders
     */
    public void setProtocolHeaders(ArrayList<NProtocolHeader> pheaders) {
        setProtocolHeaders(pheaders, true);
    }

    /**
     * Calculation will base on these pheaders. When loading report, no need to
     * calculate start and end time.
     */
    public void setProtocolHeaders(ArrayList<NProtocolHeader> pheaders, boolean calStartAndEndTime) {
        this.myPHeaders = pheaders;

        if (calStartAndEndTime) {
            getStartAndEndTime();
        }
    }

    /*
     * when calculate at 'compressor analyze' type, compressor need to be set
     */
    public void setCompressors(ArrayList<Compressor> compressors) {
        this.myCompressors = compressors;
    }

    public ArrayList<Compressor> getCompressors() {
        return myCompressors;
    }

    /**
     * get the earliest start time and latest endtime from selected protocol
     * headers and assign them to startTime and endTime changed: use the start
     * and end time in the analyze settings
     */
    private void getStartAndEndTime() {
        //startTime.setTime( theCommonValue )
        startTime = new Timestamp(0);
        endTime = new Timestamp(0);
        NProtocolHeader pheader;
        for (int i = 0; i < myPHeaders.size(); i++) {
            pheader = myPHeaders.get(i);
            if (i == 0 || startTime.getTime() > pheader.StartTime) {
                startTime.setTime(pheader.StartTime);
            }
            if (i == 0 || endTime.getTime() < pheader.StopTime) {
                endTime.setTime(pheader.StopTime);
            }
        }
    }

    public void setStartTime(long timeMilli) {
        startTime.setTime(timeMilli);
    }

    public void setEndTime(long timeMilli) {
        endTime.setTime(timeMilli);
    }

    /**
     * set the database handle
     */
    public void setDatabase(CSMDF db) {
        this.myDB = db;
    }

    /**
     * when protocol header list changed, need to re-calculate
     */
    public void propertyChange(PropertyChangeEvent event) {
        if (event.getPropertyName().compareTo(CommonValue.PROTOCOL_HEADER_LIST) == 0) {
            ArrayList<NProtocolHeader> pheaders = (ArrayList<NProtocolHeader>) event.getNewValue();
            this.myPHeaders = new ArrayList<NProtocolHeader>();
            for (NProtocolHeader pheader : pheaders) {
                NProtocolHeader newPHeader = new NProtocolHeader();
                newPHeader.copy(pheader);
                this.myPHeaders.add(newPHeader);
            }
            getStartAndEndTime();
        }

        triggerCalculate();
    }

    /**
     * trigger the calculate next time report opens this
     */
    public void triggerCalculate() {
        calculatedPrefs = -9999;
    }

    /**
     * use when loading report.
     */
    public void unTriggerCalculate() {
        calculatedPrefs = calculateRefSum();
    }

    /**
     * create a report given start time and end time
     */
    public void createDailyReport(Timestamp startTime, Timestamp endTime) {
        this.startTime = startTime;
        this.endTime = endTime;

        triggerCalculate();
        calculate();
    }

    /**
     * calculate refSum to see if re-calculatio needed
     */
    private int calculateRefSum() {
        int refSum = 0;      
        switch (analyzeType) {           
            case ANALYZE_TYPE_FLOW: {
                if(selectedFlowNChannelHeaders != null){
                    for (NChannelHeader cheader : selectedFlowNChannelHeaders) {
                        refSum += cheader.Pref;
                    }
                }
                break;
            }
            default: {
                for (NProtocolHeader pheader : myPHeaders) {
                    refSum += pheader.Pref;
                }
            }               
        }
         
        return refSum;
    }

    public boolean isCalculated() {
        if (calculatedPrefs == calculateRefSum()) {
            return true;  // current one already calculated
        } else {
            return false;
        }
    }

    /**
     * Calculate based on settings.
     */
    public boolean calculate() {
//        if (calculatedPrefs == calculateRefSum()) {
//            return true;  // current one already calculated
//        }
        if (isCalculated()) {
            return true;
        }

        resetValues();

        boolean result;
        getMaxMinDewpointPressure();

        switch (analyzeType) {
            case ANALYZE_TYPE_COMPRESSOR: {
                if (myCompressors == null || myCompressors.isEmpty()) {
                    return false;
                }
                result = calculateBasedOnCompressor();
                break;
            }
            case ANALYZE_TYPE_FLOW: {
                result = calculateBasedOnFlow();
                break;
            }
            case ANALYZE_TYPE_SYSTEM: {
                if (myCompressors == null || myCompressors.isEmpty()) {
                    return false;
                }
                result = calculateBasedOnSystem();
//         LicenseConst.getLogger().log( Level.INFO,"LeakStatistics/after calculateBasedOnSystem totalAirConsumption :"+ totalAirConsumption );
//         LicenseConst.getLogger().log( Level.INFO,"LeakStatistics/after calculateBasedOnSystem maxFlow :"+ maxFlow );
//         LicenseConst.getLogger().log( Level.INFO,"LeakStatistics/after calculateBasedOnSystem minFlow :"+ minFlow );

                break;
            }
            default:
                result = calculateBasedOnFlow();
        }

        return result;
    }

    /**
     * Calculate based on flow. Return false if something wrong or selected
     * protocol header is empty -- in that case all result values are still
     * gonna be reset.
     */
    private boolean calculateBasedOnFlow() {
        try {
            long fullLoadSeconds = 0;
            long noLoadSeconds = 0;
            long stopSeconds = 0;
//            double totalSeconds = 0;
            double validSeconds = 0;

            double sumFlowRate = 0;
            //double sumLeakage = 0;
            int numOfFlowRecords = 0;
//            double sumPressure = 0;
//            int numOfPressureRecords = 0;

            int startID, endID;

            maxFlow = 0;
            minFlow = 0;
            maxFlowList = new ArrayList<Double>();
            ArrayList<NProtocolHeader> selectedFlowPHeaders = new ArrayList<NProtocolHeader>();
            if(this.myPHeaders != null){
                for (NProtocolHeader pheader : this.myPHeaders) {
                    for(NChannelHeader nch : selectedFlowNChannelHeaders){
                        if(nch.Pref == pheader.Pref){
                            if(!selectedFlowPHeaders.contains(pheader)){
                                selectedFlowPHeaders.add(pheader);
                            }
                            break;
                        }
                    }
                }
            }

            for (NProtocolHeader pheader : selectedFlowPHeaders) {          
                
//               System.out.println("calculateBasedOnFlow myPHeaders.size="+myPHeaders.size());
                // get start and end id based on startTime and endTime
                startID = (int) ((startTime.getTime() - pheader.StartTime) / (pheader.SampleRate * pheader.SampleRateFactor));
                endID = (int) ((endTime.getTime() - pheader.StartTime) / (pheader.SampleRate * pheader.SampleRateFactor));

                if(startID < 0){
                    startID = 0;
                }
                if(endID < 0){
                    startID = 0;
                }
                
                if(endID > pheader.NumOfSamples){
                    endID = pheader.NumOfSamples;
                }
                
                double srateSecond = pheader.SampleRate * pheader.SampleRateFactor / 1000;
                double srateHour = (double) srateSecond / 3600;  // convert sample rate to hour
//                totalSeconds += (pheader.StopTime - pheader.StartTime) / 1000;

                // algorithm:  power consumption (kwh) = votage * current * sqr(3) * cosP * Hour / 1000
//                double volatgeAndParameterAndHourPerRecord = voltage * 1.732f * srateHour / 1000;

//                ArrayList<NChannelHeader> chheaders = myDB.findChannelHeaders(pheader.Pref); //.queryChannelHeader( pheader.pref );
                for (NChannelHeader chheader : selectedFlowNChannelHeaders) {
                    
                    if(chheader == null || chheader.Pref != pheader.Pref){
                        continue;
                    }
                    
//                    NChannelHeader chheader = chheaders.get(ch);
                    // ***************** flow unit
                    if (MeasurementUnit.IsFlowRateUnit(chheader.getUnitText())) {
                        flowDataUsed = true;

                        double ratioToFirstUnit;
                        double flowRateRationToOneHour;
                        double flowValue;
                        double sumFlowRatePerChHeader = 0;
                        double sumConsumption = 0;
                        double sumLeakage = 0;
                        double delta;

                        if (flowUnit == null || flowUnit.isEmpty()) {
                            flowUnit = chheader.getUnitText(); //.unit;
                            ratioToFirstUnit = 1;
                            airConsumptionUnit = MeasurementUnit.GetConsumptionUnit(flowUnit);
                        } else {
                            ratioToFirstUnit = MeasurementUnit.RatioToM3PerHour(chheader.getUnitText())
                                    / MeasurementUnit.RatioToM3PerHour(flowUnit);
                        }

                        flowRateRationToOneHour = srateHour * MeasurementUnit.FlowUnitRatioToOneHour(flowUnit);

                        averageLeakage = leakThreadHold; // * ratioToFirstUnit;

                        if (maxFlow < ratioToFirstUnit * chheader.Max) {
                            maxFlow = ratioToFirstUnit * chheader.Max;
                        }
                        if (minFlow > ratioToFirstUnit * chheader.Min) {
                            minFlow = ratioToFirstUnit * chheader.Min;
                        }

                        //ArrayList<MeasurementRecord> mrecords = myDB.queryMeasurementRecordWithinCertainPeriod(
                        //      chheader.cref, startID, endID  );
                        int[] channelNos = {chheader.ChannelNumber};

                        ViewChannel vc = this.iniViewChannelForQuery(pheader, chheader, startID, endID);
                        if (vc == null) {
                            return false;
                        }
//                       ArrayList<NMeasurementRecordLine> mrecordLines = null;
                        Hashtable<Long, ArrayList<Double>> mrecordLines = new Hashtable<Long, ArrayList<Double>>();
                        ArrayList oneline = new ArrayList();
                        int len = 0;

                        do {
                            mrecordLines = myDB.queryMeasurementRecordByOneLineWithRecordID(
                                    pheader.Pref, channelNos, vc.queryStartID, vc.queryEndID);

                            oneline = mrecordLines.get(pheader.Pref + channelNos[0]);
                            len = oneline.size();
                            for (int i = 0; i < len; i++) {
                                flowValue = (Double) oneline.get(i);
                                if (flowValue == myDB.INVALID_MEASUREMENT_VALUE || flowValue == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                                    if(maxFlowList.size()<i){
                                        maxFlowList.add(0.0);
                                    }
                                    continue;                                    
                                }
                                if(maxFlowList.size()<=i){
                                    maxFlowList.add(flowValue);
                                }else{
                                    maxFlowList.set(i, maxFlowList.get(i).doubleValue()+flowValue);
                                }
                                sumFlowRatePerChHeader += flowValue;
                                sumConsumption += flowValue * flowRateRationToOneHour;
                                sumLeakage += leakThreadHold * flowRateRationToOneHour;
                                numOfFlowRecords += 1;
                                validSeconds += srateSecond;
                            }

                            vc.queryStartID = vc.queryEndID;
                            if ((vc.queryEndID + oneTimeGetValues) >= vc.numOfSamples) {
                                vc.queryEndID = (int) vc.numOfSamples;
                            } else {
                                vc.queryEndID = vc.queryEndID + this.oneTimeGetValues;
                            }
                            if (vc.queryEndID > vc.viewEndID) {
                                vc.queryEndID = vc.viewEndID;
                            }

                            vc.currentPage++;
                            
                            if(mrecordLines != null){
                                mrecordLines.clear();
                               
                            }
                            if(oneline != null){
                                oneline.clear();
                               
                            }

                        } while (vc.currentPage <= vc.totalPages);


//                       ArrayList<NMeasurementRecordLine> mrecordLines = myDB.queryMeasurementRecordByRecordID( 
//                               pheader.Pref, channelNos, startID, endID );
//                       
//                       for ( int i = 0; i < mrecordLines.size(); i++ ) {
//                           flowValue = mrecordLines.get(i).Values[0];
//                           if ( flowValue == myDB.INVALID_MEASUREMENT_VALUE || flowValue == CSMDF.OVERANGE_MEASUREMENT_VALUE )
//                               continue;
//                           
//                           sumFlowRatePerChHeader += flowValue;
//                           sumConsumption += flowValue * flowRateRationToOneHour;
//                           sumLeakage += leakThreadHold * flowRateRationToOneHour;
//                           numOfFlowRecords += 1;
//                           validSeconds += srateSecond;
//                       }

                        sumFlowRate += sumFlowRatePerChHeader * ratioToFirstUnit;
                        totalAirConsumption += sumConsumption * ratioToFirstUnit;
                        totalLeakage += sumLeakage * ratioToFirstUnit;
                        
                        if(mrecordLines != null){
                            mrecordLines.clear();
                            mrecordLines = null;
                        }
                        if(oneline != null){
                            oneline.clear();
                            oneline = null;
                        }
                        

                    } // end of flow rate unit

                } // loop with chheaders
            } // loop with the protocol headers


            fullLoadHours = (fullLoadSeconds / 3600f);
            noLoadHours = (noLoadSeconds / 3600f);
            stopHours = (stopSeconds / 3600f);
            fullLoadPercentageMeasurementInterval = fullLoadSeconds / validSeconds;
            noLoadPercentageMeasurementInterval = noLoadSeconds / validSeconds;
            stopPercentageMeasurementInterval = stopSeconds / validSeconds;
            fullLoadEnergyCost = fullLoadEnergyConsumption * costPerKwh;
            noLoadEnergyCost = noLoadEnergyConsumption * costPerKwh;

            double yearRatio = 3600 * WORKING_HOUR_PER_YEAR / validSeconds;

//            System.out.println("LeakStatistics/validSeconds="+validSeconds);
//           System.out.println("LeakStatistics/WORKING_HOUR_PER_YEAR="+WORKING_HOUR_PER_YEAR);
//            System.out.println("LeakStatistics/yearRatio="+yearRatio);

            // if ( calculationType != CALCULATION_BASED_ON_COMPRESSOR_SPEC ) {
            fullLoadHoursOneYear = ((fullLoadSeconds / (double) 3600) * yearRatio);
            noLoadHoursOneYear = ((noLoadSeconds / (double) 3600) * yearRatio);
            stopHoursOneYear = ((stopSeconds / (double) 3600) * yearRatio);
            numOfLoadChangesOneYear = numOfLoadChanges * yearRatio;
            //}
            //add on 20091225.
            //reason : Wolfgang Blessing,Michael Kromer test result : numofloadchange is not "number of load/unload cycles" value.
            //mothed : create number of load/unload cycles field.
            NumOfLoad_UnloadChangesOneYear = NumOfLoad_UnloadChanges * yearRatio;

            if (numOfFlowRecords > 0) {
                averageFlow = (float) (sumFlowRate / numOfFlowRecords);
            }
            if (totalAirConsumption > 0) {
                leakageRate = totalLeakage / (float) totalAirConsumption;
            }
            totalAirConsumptionOneYear = (long) ((double) totalAirConsumption * yearRatio);
            totalLeakageOneYear = (long) ((double) totalLeakage * yearRatio);   // m3

            // costs
            totalEnergyConsumptionOneYear = totalEnergyConsumption * yearRatio;
            fullLoadEnergyConsumptionOneYear = fullLoadEnergyConsumption * yearRatio;
            noLoadEnergyConsumptionOneYear = noLoadEnergyConsumption * yearRatio;
            totalCost = totalAirConsumption * MeasurementUnit.RatioToM3BasedOnFlowUnit(flowUnit) * energyCostPerM3;
            //totalCost = totalEnergyConsumption * costPerKwh;
            totalCostOneYear = totalCost * yearRatio;
            costOfLeakage = totalCost * leakageRate;
            costOfLeakageOneYear = costOfLeakage * yearRatio;
            airUnitCost = energyCostPerM3;

            //if ( totalAirConsumption > 0 )
            //airUnitCost = totalCost / totalAirConsumption; // cost per m3, in Euros/m3

            // convert to the unit user select
            double flowUnitRatio = MeasurementUnit.RatioToM3PerHour(flowUnit)
                    / MeasurementUnit.RatioToM3PerHour(air_delivery_unit);
            double consumptionUnitRatio = MeasurementUnit.RatioToM3BasedOnFlowUnit(flowUnit)
                    / MeasurementUnit.RatioToM3BasedOnFlowUnit(air_delivery_unit);
            averageFlow = averageFlow * flowUnitRatio;
//            maxFlow = maxFlow * flowUnitRatio;
            maxFlow = Collections.max(maxFlowList) * flowUnitRatio;
            minFlow = minFlow * flowUnitRatio;
            totalAirConsumption = (long) (totalAirConsumption * consumptionUnitRatio);
            totalAirConsumptionOneYear = (long) (totalAirConsumptionOneYear * consumptionUnitRatio);
            averageLeakage = averageLeakage * flowUnitRatio;
            totalLeakage = (long) (totalLeakage * consumptionUnitRatio);
            totalLeakageOneYear = (long) (totalLeakageOneYear * consumptionUnitRatio);
            LicenseConst.getLogger().log(Level.INFO, "LeakStatistics/calculateBasedOnFlow totalAirConsumption :" + totalAirConsumption);
            LicenseConst.getLogger().log(Level.INFO, "LeakStatistics/calculateBasedOnFlow maxFlow :" + maxFlow);
            LicenseConst.getLogger().log(Level.INFO, "LeakStatistics/calculateBasedOnFlow minFlow :" + minFlow);


        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }

        calculatedPrefs = calculateRefSum();

        return true;
    }
    /**
     * added 12,Oct,2010: to get the max flow of all compressors, calulation
     * should be at every sample rate point, calculate the sum of all flows at
     * that time.
     */
    private int minSample = 0;
 
    private void calculateMaxFlowBaseOnAllCompressors() {
        maxFlowBaseOnAllCompressors = 0;
        minFlowBaseOnAllCompressors = 0;
        int sampleRateDividor = findoutSampleRateDividor(myCompressors);
        long myStartTime = startTime.getTime();
        if (minSample == 0) {
            minSample = 1;
        }
        long myEndTime = myStartTime + minSample * 1000 * 100000;
        double[] maxFlows = null;

//            double[] maxFlows = new double[(int) ((( endTime.getTime() - startTime.getTime() ) / 1000 / sampleRateDividor )+1)];
        int times = (int) ((endTime.getTime() - startTime.getTime()) / (myEndTime - myStartTime));
//       System.out.println("(endTime.getTime() - startTime.getTime())="+(endTime.getTime() - startTime.getTime()));
//       System.out.println("(myEndTime - myStartTime)="+(myEndTime - myStartTime));
        if (((endTime.getTime() - startTime.getTime()) % (myEndTime - myStartTime)) > 0) {
            times += 1;
        }
//       System.out.println("times="+times);
       
        for (int j = 0; j < times; j++) {
            if (j > 0) {
                myStartTime = myEndTime;
                myEndTime = myStartTime + minSample * 1000 * 100000;
            }

            maxFlows = new double[(int) (((myEndTime - myStartTime) / 1000 / sampleRateDividor) + 1)];
//            System.out.println("maxFlows.length="+maxFlows.length);

            for (Compressor compressor : myCompressors) {

                if(!compressor.Selected){
                    continue;
                }
                
                long srateSecond;
                NChannelHeader channelHeader = compressor.getAssignedFlowChannel();
                boolean hasFlowChannel = true;
                boolean hasPowerChannel = false;
                if(channelHeader == null){
                    hasFlowChannel = false;
                    if(compressor.hasPowerChannel()){
                        channelHeader = compressor.getAssignedPowerChannel();
                        hasPowerChannel = true;
                    }else{
                        channelHeader =  compressor.getCurrentChanel();
                        hasPowerChannel = false;
                    }                  
                }
                
                NProtocolHeader pheader = myDB.findProtocolHeader(channelHeader.Pref);
                pheader.StopTime = myDB.calculateEndTime(channelHeader.Pref);
                if (pheader.StopTime < myStartTime) {
                    continue;
                }
                srateSecond = pheader.SampleRate * pheader.SampleRateFactor / 1000;
                int maxFlowDataPerSampleRate = (int) (srateSecond / sampleRateDividor);
                int maxFlowsID = 0;
                int startID, endID;
                double value;
                double flowRate = 0;
               
                int[] channelNos = {channelHeader.ChannelNumber};
                // get start and end id based on pheader
                startID = (int) ((myStartTime - pheader.StartTime) / (pheader.SampleRate * pheader.SampleRateFactor));

                if (myEndTime > pheader.StopTime) {
                    myEndTime = pheader.StopTime;
                }
                endID = (int) ((myEndTime - pheader.StartTime) / (pheader.SampleRate * pheader.SampleRateFactor));

                //modify on 20100107.
                //Simon feedback the valid record time had some error.
                //reason : startid < 0 .
                if (startID < 0) {
                    startID = 0;
                }

                
                ArrayList oneline = new ArrayList();
                Hashtable<Long, ArrayList<Double>> mrecordLines = new Hashtable<Long, ArrayList<Double>>();//myDB.queryMeasurementRecordByRecordID(pheader.Pref, channelNos, startID, endID );
//                System.out.println("mrecordLines.size()="+mrecordLines.size());
              
                ViewChannel vc = this.iniViewChannelForQuery(pheader, channelHeader, startID, endID);
                if (vc == null) {
                    return;
                }
               
                if (!hasFlowChannel) {

                    int len = 0;

                    do {
                        mrecordLines = myDB.queryMeasurementRecordByOneLineWithRecordID(
                                channelHeader.Pref, channelNos, vc.queryStartID, vc.queryEndID);
                        oneline = mrecordLines.get(channelHeader.Pref + channelNos[0]);
                        len = oneline.size();

                        //doing ======= begin

                        if (compressor.Type == Compressor.COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
                            if(hasPowerChannel){
                                double minFlowThreshold = compressor.VFPowerMin * 0.75;
                                for (int i = 0; i < len; i++) {
                                    value = (Double) oneline.get(i);
                                    if (value == myDB.INVALID_MEASUREMENT_VALUE || value == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                                        //add on 20100602.
                                        for (int ii = 0; ii < maxFlowDataPerSampleRate; ii++) {
                                            maxFlows[ maxFlowsID + ii] += 0;
                                            maxFlowsID++;
                                        }

                                        continue;
                                    }


                                    if (value < minFlowThreshold) {
                                        flowRate = 0;
                                    } else if (value <= compressor.VFPowerMin) {
                                        flowRate = compressor.VFAirDeliveryMin;
                                    } else if (value <= compressor.VFPowerP2) //flowRate = ( value - compressor.VFAmpMin ) * compressor.VFLinearCoefficientP2Min;
                                    {
                                        flowRate = value * compressor.VFLinearCoefficientP2Min + compressor.VFLinearCoefficientP2MinA0;
                                    } else if (value <= compressor.VFPowerP3) {
                                        flowRate = value * compressor.VFLinearCoefficientP3P2 + compressor.VFLinearCoefficientP3P2A0;
                                    } else if (value <= compressor.VFPowerMax) {
                                        flowRate = value * compressor.VFLinearCoefficientMaxP3 + compressor.VFLinearCoefficientMaxP3A0;
                                    } else {
                                        flowRate = compressor.VFAirDeliveryMax;
                                    }

                                    for (int ii = 0; ii < maxFlowDataPerSampleRate; ii++) {
                                        maxFlows[ maxFlowsID + ii] += flowRate;
                                        maxFlowsID++;
                                    }
                                    //                            maxFlows[i] += flowRate;
                                }
                            }else{                         
                                double minFlowThreshold = compressor.VFAmpMin * 0.75;
                                for (int i = 0; i < len; i++) {
                                    value = (Double) oneline.get(i);
                                    if (value == myDB.INVALID_MEASUREMENT_VALUE || value == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                                        //add on 20100602.
                                        for (int ii = 0; ii < maxFlowDataPerSampleRate; ii++) {
                                            maxFlows[ maxFlowsID + ii] += 0;
                                            maxFlowsID++;
                                        }

                                        continue;
                                    }


                                    if (value < minFlowThreshold) {
                                        flowRate = 0;
                                    } else if (value <= compressor.VFAmpMin) {
                                        flowRate = compressor.VFAirDeliveryMin;
                                    } else if (value <= compressor.VFAmpP2) //flowRate = ( value - compressor.VFAmpMin ) * compressor.VFLinearCoefficientP2Min;
                                    {
                                        flowRate = value * compressor.VFLinearCoefficientP2Min + compressor.VFLinearCoefficientP2MinA0;
                                    } else if (value <= compressor.VFAmpP3) {
                                        flowRate = value * compressor.VFLinearCoefficientP3P2 + compressor.VFLinearCoefficientP3P2A0;
                                    } else if (value <= compressor.VFAmpMax) {
                                        flowRate = value * compressor.VFLinearCoefficientMaxP3 + compressor.VFLinearCoefficientMaxP3A0;
                                    } else {
                                        flowRate = compressor.VFAirDeliveryMax;
                                    }

                                    for (int ii = 0; ii < maxFlowDataPerSampleRate; ii++) {
                                        maxFlows[ maxFlowsID + ii] += flowRate;
                                        maxFlowsID++;
                                    }
                                    //                            maxFlows[i] += flowRate;
                                }
                            }
                        } else { // ************* compressor type is load / unload
                            for (int i = 0; i < len; i++) {
                                value = (Double) oneline.get(i);
                                if (value == myDB.INVALID_MEASUREMENT_VALUE || value == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                                    //add on 20100602.
                                    for (int ii = 0; ii < maxFlowDataPerSampleRate; ii++) {
                                        maxFlows[ maxFlowsID + ii] += 0;
                                        maxFlowsID++;
                                    }

                                    continue;
                                }

                                if (value >= compressor.FullLoadCurrentThreshold) {
                                    flowRate = compressor.FullLoadAirDelivery;
                                } else {
                                    flowRate = 0;
                                }

                                for (int ii = 0; ii < maxFlowDataPerSampleRate; ii++) {
                                    maxFlows[ maxFlowsID + ii] += flowRate;
                                    maxFlowsID++;
                                }

                            }

                        } // ***** end of if compressor type

                        //========= end    
                        vc.queryStartID = vc.queryEndID;
                        if ((vc.queryEndID + oneTimeGetValues) >= vc.numOfSamples) {
                            vc.queryEndID = (int) vc.numOfSamples;
                        } else {
                            vc.queryEndID = vc.queryEndID + this.oneTimeGetValues;
                        }
                        if (vc.queryEndID > vc.viewEndID) {
                            vc.queryEndID = vc.viewEndID;
                        }

                        vc.currentPage++;
                        
                        if(mrecordLines != null){
                            mrecordLines.clear();
                        }
                        if(oneline != null){
                            oneline.clear();
                        }

                    } while (vc.currentPage <= vc.totalPages);

                } else { // there's assigned flow channel
                    double flowValue;

                    int len = 0;

                    do {
                        mrecordLines = myDB.queryMeasurementRecordByOneLineWithRecordID(
                                channelHeader.Pref, channelNos, vc.queryStartID, vc.queryEndID);

                        oneline = mrecordLines.get(channelHeader.Pref + channelNos[0]);
                        len = oneline.size();

                        //doing ======= begin

//                    mrecordLines = myDB.queryMeasurementRecordByRecordID(
//                           pheader.Pref, assignedChannelNos, startID, endID );

                        for (int i = 0; i < len; i++) {
                            flowValue = (Double) oneline.get(i);
                            if (flowValue == myDB.INVALID_MEASUREMENT_VALUE || flowValue == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                                //add on 20100602.
                                for (int ii = 0; ii < maxFlowDataPerSampleRate; ii++) {
                                    maxFlows[ maxFlowsID + ii] += 0;
                                    maxFlowsID++;
                                }

                                continue;
                            }

                            for (int ii = 0; ii < maxFlowDataPerSampleRate; ii++) {
                                maxFlows[ maxFlowsID + ii] += flowValue;
                                maxFlowsID++;
                            }
                            //                         maxFlows[i] += flowValue;
                        }

                        //========= end    
                        vc.queryStartID = vc.queryEndID;
                        if ((vc.queryEndID + oneTimeGetValues) >= vc.numOfSamples) {
                            vc.queryEndID = (int) vc.numOfSamples;
                        } else {
                            vc.queryEndID = vc.queryEndID + this.oneTimeGetValues;
                        }
                        if (vc.queryEndID > vc.viewEndID) {
                            vc.queryEndID = vc.viewEndID;
                        }

                        vc.currentPage++;
                        
                        if(mrecordLines != null){
                            mrecordLines.clear();
                        }
                        if(oneline != null){
                            oneline.clear();
                        }

                    } while (vc.currentPage <= vc.totalPages);
                }
                if(mrecordLines != null){
                    mrecordLines.clear();
                    mrecordLines = null;
                }
                if(oneline != null){
                    oneline.clear();
                    oneline = null;
                }
                
            }
            Arrays.sort(maxFlows);
            BigDecimal bdArrayMaxFlow = new BigDecimal(maxFlows[maxFlows.length - 1]);
            BigDecimal bdArrayMinFlow = new BigDecimal(maxFlows[0]);
            BigDecimal bdMaxFlow = new BigDecimal(this.maxFlowBaseOnAllCompressors);
            BigDecimal bdMinFlow = new BigDecimal(this.minFlowBaseOnAllCompressors);
            if (bdMaxFlow.compareTo(bdArrayMaxFlow) < 0) {
                this.maxFlowBaseOnAllCompressors = maxFlows[maxFlows.length - 1];
            }

            if (bdArrayMinFlow.compareTo(bdMinFlow) < 0) {
                this.minFlowBaseOnAllCompressors = maxFlows[0];
            }

            LicenseConst.getLogger().log( Level.INFO,"LeakStatistics/calculateBasedOnCompressor maxFlow :"+ maxFlow );
             LicenseConst.getLogger().log( Level.INFO,"LeakStatistics/calculateBasedOnCompressor maxFlowBaseOnAllCompressors :"+ maxFlowBaseOnAllCompressors );
//
//            LicenseConst.getLogger().log( Level.INFO,"LeakStatistics/calculateBasedOnCompressor minFlow :"+ minFlow );
        }
    }

    /**
     * Calculate based on compressor settings. Return false if there's no
     * compressor or something wrong -- in that case all result values are still
     * gonna be reset.
     */
    @SuppressWarnings("static-access")
    private boolean calculateBasedOnCompressor() {

        try {
            // added April, 2010: to get the max flow of all compressors, calulation should be at every
            // sample rate point, calculate the sum of all flows at that time.
//            int sampleRateDividor = findoutSampleRateDividor( myCompressors );
//            double[] maxFlows = new double[(int) ((( endTime.getTime() - startTime.getTime() ) / 1000 / sampleRateDividor )+1)];
//
//            LicenseConst.getLogger().log( Level.INFO,"LeakStatistics/calculateBasedOnCompressor maxFlows.length :"+ maxFlows.length );

            for (Compressor compressor : myCompressors) {
                compressor.resetStatisticsValues();

                if (!compressor.Selected) {
                    continue;
                }

                //calculate current or power record
                if(!calculateCurrentOrPowerRecordsBaseOnCompressor(compressor)){
                    continue;
                }
                
                calculateFlowRecordsBaseOnCompressor(compressor);
                  
            
            } // loop of compressors

//            Arrays.sort( maxFlows );
//            this.maxFlow = maxFlows[maxFlows.length - 1];
//
//            LicenseConst.getLogger().log( Level.INFO,"LeakStatistics/calculateBasedOnCompressor maxFlow :"+ maxFlow );
//
//            this.minFlow = maxFlows[0];
//            LicenseConst.getLogger().log( Level.INFO,"LeakStatistics/calculateBasedOnCompressor minFlow :"+ minFlow );
            calculateMaxFlowBaseOnAllCompressors();

        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }

        calculatedPrefs = calculateRefSum();

        return false;
    }

    private boolean calculateBasedOnSystem() {

        calculateBasedOnCompressor();
        
        if( systemFlowChannel != null ){
            calculateSystemAnalyzesFlowChannelValueFields(this.getSystemFlowChannel());
        }
        
        return true;
        
//        return calculateBasedOnCompressor() & calculateBasedOnFlow();
    }

    private void getMaxMinDewpointPressure() {
        try {
            for (NProtocolHeader pheader : myPHeaders) {
                ArrayList<NChannelHeader> chheaders = myDB.findChannelHeaders(pheader.Pref);
                for (int ch = 0; ch < chheaders.size(); ch++) {
                    NChannelHeader chheader = chheaders.get(ch);
                    if (MeasurementUnit.IsPressureUnit(chheader.getUnitText())) {
                        pressureDataUsed = true;

                        if (pressureUnit == null || pressureUnit.isEmpty()) {
                            pressureUnit = chheader.getUnitText();
                            maxPressure = chheader.Max;
                            minPressure = chheader.Min;
                        } else {
                            if (maxPressure != MAX_OR_MIN_VALUE_INDICATING_DIFFERENT_UNIT) {
                                if (chheader.getUnitText().compareTo(pressureUnit) == 0) {
                                    if (maxPressure < chheader.Max) {
                                        maxPressure = chheader.Max;
                                    }
                                    if (minPressure > chheader.Min) {
                                        minPressure = chheader.Min;
                                    }
                                } else {
                                    maxPressure = MAX_OR_MIN_VALUE_INDICATING_DIFFERENT_UNIT;
                                    minPressure = MAX_OR_MIN_VALUE_INDICATING_DIFFERENT_UNIT;
                                }
                            }
                        }
                    } // end of pressure unit
                    // ***************** dewpoint unit
                    else if (MeasurementUnit.IsDewpointUnit(chheader.getUnitText())) {
                        dewpointDataUsed = true;

                        if (dewpointUnit == null || dewpointUnit.isEmpty()) {
                            dewpointUnit = chheader.getUnitText();
                            maxDewpoint = chheader.Max;
                            minDewpoint = chheader.Min;
                        } else {
                            if (maxDewpoint != MAX_OR_MIN_VALUE_INDICATING_DIFFERENT_UNIT) {
                                if (chheader.getUnitText().compareTo(dewpointUnit) == 0) {
                                    if (maxDewpoint < chheader.Max) {
                                        maxDewpoint = chheader.Max;
                                    }
                                    if (minDewpoint > chheader.Min) {
                                        minDewpoint = chheader.Min;
                                    }
                                } else {
                                    maxDewpoint = MAX_OR_MIN_VALUE_INDICATING_DIFFERENT_UNIT;
                                    minDewpoint = MAX_OR_MIN_VALUE_INDICATING_DIFFERENT_UNIT;
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
        }
    }

    /**
     * some parameters only affects when calculate based on compressor
     * specification
     */
//    private void calculateBasedOnCompressorSpecification() {
//        currentDataUsed = true;
//
//        fullLoadHoursOneYear = (operateHourPerYear * fullLoadOperationTime);
//        noLoadHoursOneYear = (operateHourPerYear * noLoadOperationTime);
//        //stopHoursOneYear = ( operateHourPerYear * ( 1 - fullLoadOperationTime - noLoadOperationTime ));
//
//        fullLoadEnergyConsumptionOneYear = fullLoadHoursOneYear * fullLoadPowerConsumption / MOTOR_EFFICIENCY_FACTOR_FULL_LOAD;
//        noLoadEnergyConsumptionOneYear = noLoadHoursOneYear * noLoadPowerConsumption / MOTOR_EFFICIENCY_FACTOR_NO_LOAD;
//        totalEnergyConsumptionOneYear = fullLoadEnergyConsumptionOneYear + noLoadEnergyConsumptionOneYear;
//        totalCostOneYear = totalEnergyConsumptionOneYear * costPerKwh;
//    }

//    private void calculateBasedOnCompressorSpecification(float totalSeconds) {
//        calculateBasedOnCompressorSpecification();
//
//        double yearRatio = 3600 * operateHourPerYear / totalSeconds;
//        fullLoadHours = fullLoadHoursOneYear / yearRatio;
//        noLoadHours = noLoadHoursOneYear / yearRatio;
//        stopHours = stopHoursOneYear / yearRatio;
//
//        fullLoadPercentageMeasurementInterval = fullLoadOperationTime;
//        noLoadPercentageMeasurementInterval = noLoadOperationTime;
//
//        fullLoadEnergyConsumption = fullLoadEnergyConsumptionOneYear / yearRatio;
//        noLoadEnergyConsumption = noLoadEnergyConsumptionOneYear / yearRatio;
//        totalEnergyConsumption = totalEnergyConsumptionOneYear / yearRatio;
//
////       totalCost = totalCostOneYear / yearRatio;
////       fullLoadEnergyCost = totalCost * fullLoadPercentageMeasurementInterval;
////       noLoadEnergyCost = totalCost * noLoadPercentageMeasurementInterval;
//        totalCost = totalEnergyConsumption * costPerKwh;
//        fullLoadEnergyCost = fullLoadEnergyConsumption * costPerKwh;
//        noLoadEnergyCost = noLoadEnergyConsumption * costPerKwh;
//
//    }

    /**
     * cosP = cosPA0 + A * ( fullLoadCosP - noLoadCosP ) / ( fullLoadCurrent -
     * noLoadCurrent )
     */
//    private double calculateCosP(double A) {
//        double phi;
//        if (A <= noLoadCurrent) {
//            phi = noLoadCosP;
//        } else if (A >= fullLoadCurrent) {
//            phi = fullLoadCosP;
//        } else {
//            phi = cosPA0 + A * cosPRatio;
//        }
//
//        return phi;
//    }

    /**
     * cosP = cosPA0 + A * ( fullLoadCosP - noLoadCosP ) / ( fullLoadCurrent -
     * noLoadCurrent ) calculate based on compressor
     */
    private double calculateCosP(double A, Compressor compressor) {
        double phi;
        if (A <= compressor.UnLoadCurrent) {
            phi = compressor.UnLoadCosP;
        } else if (A >= compressor.FullLoadCurrent) {
            phi = compressor.FullLoadCosP;
        } else {
            phi = compressor.CosPA0 + A * compressor.CosPRatio;
        }

        return phi;
    }

    public float getLeakageThreshold() {
        return leakThreadHold;
    }
    public final static float STOP_CURRENT_THRESHOLD = 1;  // 1 A
    public final static float MOTOR_EFFICIENCY_FACTOR_FULL_LOAD = 0.95f;
    public final static float MOTOR_EFFICIENCY_FACTOR_NO_LOAD = 0.90f;
    public final static char CUBIC_ASCII = 179;
    public final static char DEGREE_ASCII = 176;
    public static final String UNIT_AIR_CONSUMPTION = "m" + CUBIC_ASCII;
    public static final String UNIT_FLOW = "m" + CUBIC_ASCII + "/h";
    public static final String UNIT_FLOW_MINUTE = "m" + CUBIC_ASCII + "/min";
    public static final String UNIT_POWER_CONSUMPTION = "KWh";
    public static final String UNIT_CURRENT = "A";
    public static final String UNIT_EURO = "Euro";
    public static final String UNIT_COST_PER_M3 = UNIT_EURO + "/m" + CUBIC_ASCII;
    public static final String UNIT_PRESSURE = "bar";
    public static final String UNIT_DEW_POINT = DEGREE_ASCII + "Ctd";
    public static final float DEFAULT_COSP_PARAMETER = 0;
    public static final float DEFAULT_COSP = 0.85f;
    public static final int ANALYZE_TYPE_FLOW = 0;
    public static final int ANALYZE_TYPE_COMPRESSOR = 1;
    public static final int ANALYZE_TYPE_SYSTEM = 2;
    public static final int ANALYZE_TYPE_DEFAULT = 1;
    //public final static int WORKING_HOUR_PER_YEAR = 8400;
    public double WORKING_HOUR_PER_YEAR = 8400;//modify on 20091015. v3-2.
    public final static long ONE_MINUTE_MILLS = 60000;
    public final static long ONE_HOUR_MILLS = 3600000;
    public final static long ONE_DAY_MILLS = 86400000;
    public final static long ONE_WEEK_MILLS = 604800000;
    public final static long ONE_MONTH_MILLS = (long) 2592 * 1000000;
    public final static float MAX_OR_MIN_VALUE_INDICATING_DIFFERENT_UNIT = -99999;
    /**
     * ************ new design based on new feature specification in Jan, 2008
     */
    /**
     * ************ update again based on 'CAAUpdate1' in June, 2008
     */
    public int analyzeType = ANALYZE_TYPE_DEFAULT;  // based on power or flow or spec
    // note: the orders have to be the same as setting dialog!
    public boolean currentDataUsed;
    public boolean flowDataUsed;
    public boolean pressureDataUsed;
    public boolean dewpointDataUsed;
    // power consumption settings
    public double cosP = DEFAULT_COSP;
    public double fullLoadCurrent = DEFAULT_COSP_PARAMETER;
    public double noLoadCurrent = DEFAULT_COSP_PARAMETER;
    public double fullLoadCosP = DEFAULT_COSP_PARAMETER;
    public double noLoadCosP = DEFAULT_COSP_PARAMETER;
    public double fullLoadCurrentThreshold = DEFAULT_COSP_PARAMETER;
    public double noLoadCurrentThreshold = DEFAULT_COSP_PARAMETER;
    public double stopCurrentThreadhold = 2;  // in A
    private double cosPRatio = 1;
    private double cosPA0 = 0;
    public double voltage = 400;//modify 380 to 400 by be , july22,2008
    public double costPerKwh = 0.10f;
    public String currencyPowerConsumption = UNIT_EURO;
    // flow consumption settings
    public double energyCostPerM3 = 0.008f;  // how much money cost by 1 m3
    public String currencyEnergyCost = UNIT_EURO;
    // compressor settings
    public double fullLoadPowerConsumption;  // in kwh
    public double noLoadPowerConsumption;  // in kwh
    public double fullLoadOperationTime;  // should be presented as percentage
    public double noLoadOperationTime;  // should be presented as percentage
    public double operateHourPerYear;
    // compressor statistics
    // compressor statistics -- measured / calculated data
    public double fullLoadHours;
    public double fullLoadPercentageMeasurementInterval;   // should be presented as percentage
    public double fullLoadEnergyConsumption;  // in kwh
    public double fullLoadEnergyCost;  //  in currency
    public double noLoadHours;
    public double noLoadPercentageMeasurementInterval;   // should be presented as percentage
    public double noLoadEnergyConsumption;  // in kwh
    public double noLoadEnergyCost;  //  in currency
    public double stopHours;
    public double stopPercentageMeasurementInterval;   // should be presented as percentage
    public int numOfLoadChanges;
    public double totalEnergyConsumption;  // in kwh
    public double totalCost;  // in currency
    //add on 20091225.
    //reason : Wolfgang Blessing,Michael Kromer test result : numofloadchange is not number of load/unload cycles value.
    //mothed : create number of load/unload cycles field.
    public int NumOfLoad_UnloadChanges;
    public double NumOfLoad_UnloadChangesOneYear;
    // compressor statistics -- cumulated data for one year
    public double fullLoadHoursOneYear;
    public double noLoadHoursOneYear;
    public double stopHoursOneYear;
    public double numOfLoadChangesOneYear;
    public double fullLoadEnergyConsumptionOneYear;  // in kwh
    public double noLoadEnergyConsumptionOneYear;  // in kwh
    public double totalEnergyConsumptionOneYear;  // in kwh
    public double totalCostOneYear;  // in currency
    // system statistics    
    public long totalAirConsumption;   // in unit of first flow channel    
    public long totalAirConsumptionOneYear;
    public String airConsumptionUnit;
    public double airUnitCost;  // currency / m3
    public double averageFlow;  //  m3/h
    public double maxFlow;  // m3/h
    public List<Double> maxFlowList = null;
    public double minFlow;  // m3/h
    public String flowUnit;
    public long totalLeakage;   // m3
    public long totalLeakageOneYear;   // m3
    public double averageLeakage;  // m3/h
    public double leakageRate;   // should be presented as percentage
    public double costOfLeakage;  // in currency
    public double costOfLeakageOneYear;  // in currency
    public double maxPressure;  // bar
    public double minPressure;  // bar
    public double averagePressure; // bar
    public String pressureUnit;   // can be bar or mbar
    public double maxDewpoint;
    public double minDewpoint;
    public double averageDewPoint;
    public String dewpointUnit;   // can be Ctd or Ftd or others
    /**
     * ************ end of new design based on new feature specification in Jan,
     * 2008
     */
    //private float costPerKwh = 0.11f;
    private Timestamp startTime = new Timestamp(System.currentTimeMillis());
    private Timestamp endTime = new Timestamp(System.currentTimeMillis());
    /*
     * // Compressed air consumption private float airConsumption; // in m3
     * private float AveFlow; // in m3/h private float MaxFlow; // in m3/h //
     * Leakage private float totalLeakage; // in m3 private float aveLeakage; //
     * in m3/h private float leakageRate; // e.g. 23% // Power consumption
     * private float powerConsumption; // in KWh //private float totalCost =
     * powerConsumption * costPerKwh; // in Euros //private float unitCost =
     * totalCost / powerConsumption; // cost per m3, in Euros/m3 private float
     * totalCost; // in Euros private float unitCost; // cost per m3, in
     * Euros/m3 // Other data private float maxPressure; // in bar private float
     * minPressure; // in bar private float avePressure; // in bar private float
     * maxDewpoint; // in Ctd private float minDewpoint; // in Ctd
     *
     * private float leakageCost = totalLeakage * unitCost; // in Euros
     */
    private float leakThreadHold = 0; // the actual value of the base line (in graphic view)
    private String leakLineUnit = "";  // unit of the channel to calculate leakage
    //private ChannelHeader chheader;
    private ArrayList<NProtocolHeader> myPHeaders;
    private ArrayList<Compressor> myCompressors;
    public double leakLineRatio; // to remember the position of it on the graph
    //private int calculatedCref = 0; // no need to calculate again coz it takes time.
    private int calculatedPrefs = 0; // no need to calculate again coz it takes time.  rule: this is a sum of all calculated prefs
    private CSMDF myDB;
    //add on 20091029.be
    //reason : v3-5:Energy per Kwh setting will be different in for different times a day.
    private double EnergyCostPerKwh1 = 0.15;
    private double EnergyCostPerKwh2 = 0.1;
    private int EnergyCostPerKwh1StartTime = 6;
    private int EnergyCostPerKwh1EndTime = 20;
    private int EnergyCostPerKwh2StartTime = 20;
    private int EnergyCostPerKwh2EndTime = 6;
    //add on 20091030.be
    //reason : v3-5:Energy per Kwh setting will be different in for different times a day.
    private int EnergyCostPerKwh1SameDayTime = 0;
    private int EnergyCostPerKwh1TomDayTime = 0;
    private int EnergyCostPerKwh2SameDayTime = 0;
    private int EnergyCostPerKwh2TomDayTime = 0;
    private boolean EnergyCostPerKwh1TimeSplit = false;
    private boolean EnergyCostPerKwh2TimeSplit = false;

    //add on 20091015. v3.
    public void setWork_hour_per_year(double hours) {
        WORKING_HOUR_PER_YEAR = hours;
    }
    
    public double getWork_hour_per_year() {
        return WORKING_HOUR_PER_YEAR;
    }
     
    private String air_delivery_unit = "m" + (char) 179 + "/min";
    private double CO2EmmisionPerKWh = 0.55; //default value is 0.55.
    private boolean Diaplay_CO2EmmisionPerKWh_in_Report = false;

    /**
     * @return the air_delivery_unit
     */
    public String getAir_delivery_unit() {
        if (air_delivery_unit == null) {
            air_delivery_unit = "m" + (char) 179 + "/min";
        }
        if ("".equals(air_delivery_unit)) {
            air_delivery_unit = "m" + (char) 179 + "/min";
        }
        return air_delivery_unit;
    }

    /**
     * @param air_delivery_unit the air_delivery_unit to set
     */
    public void setAir_delivery_unit(String air_delivery_unit) {
        if (air_delivery_unit == null) {
            air_delivery_unit = "m" + (char) 179 + "/min";
        }
        if ("".equals(air_delivery_unit)) {
            air_delivery_unit = "m" + (char) 179 + "/min";
        }
        this.air_delivery_unit = air_delivery_unit;
    }

    /**
     * @return the CO2EmmisionPerKWh
     */
    public double getCO2EmmisionPerKWh() {
        return CO2EmmisionPerKWh;
    }

    /**
     * @param CO2EmmisionPerKWh the CO2EmmisionPerKWh to set
     */
    public void setCO2EmmisionPerKWh(double CO2EmmisionPerKWh) {
        this.CO2EmmisionPerKWh = CO2EmmisionPerKWh;
    }

    /**
     * @return the Diaplay_CO2EmmisionPerKWh_in_Report
     */
    public boolean isDiaplay_CO2EmmisionPerKWh_in_Report() {
        return Diaplay_CO2EmmisionPerKWh_in_Report;
    }

    /**
     * @param Diaplay_CO2EmmisionPerKWh_in_Report the
     * Diaplay_CO2EmmisionPerKWh_in_Report to set
     */
    public void setDiaplay_CO2EmmisionPerKWh_in_Report(boolean Diaplay_CO2EmmisionPerKWh_in_Report) {
        this.Diaplay_CO2EmmisionPerKWh_in_Report = Diaplay_CO2EmmisionPerKWh_in_Report;
    }

    /**
     * @return the EnergyCostPerKwh1
     */
    public double getEnergyCostPerKwh1() {
        return EnergyCostPerKwh1;
    }

    /**
     * @param EnergyCostPerKwh1 the EnergyCostPerKwh1 to set
     */
    public void setEnergyCostPerKwh1(double EnergyCostPerKwh1) {
        this.EnergyCostPerKwh1 = EnergyCostPerKwh1;
    }

    /**
     * @return the EnergyCostPerKwh2
     */
    public double getEnergyCostPerKwh2() {
        return EnergyCostPerKwh2;
    }

    /**
     * @param EnergyCostPerKwh2 the EnergyCostPerKwh2 to set
     */
    public void setEnergyCostPerKwh2(double EnergyCostPerKwh2) {
        this.EnergyCostPerKwh2 = EnergyCostPerKwh2;
    }

    /**
     * @return the EnergyCostPerKwh1StartTime
     */
    public int getEnergyCostPerKwh1StartTime() {
        return EnergyCostPerKwh1StartTime;
    }

    /**
     * @param EnergyCostPerKwh1StartTime the EnergyCostPerKwh1StartTime to set
     */
    public void setEnergyCostPerKwh1StartTime(int EnergyCostPerKwh1StartTime) {
        this.EnergyCostPerKwh1StartTime = EnergyCostPerKwh1StartTime;
    }

    /**
     * @return the EnergyCostPerKwh1EndTime
     */
    public int getEnergyCostPerKwh1EndTime() {
        return EnergyCostPerKwh1EndTime;
    }

    /**
     * @param EnergyCostPerKwh1EndTime the EnergyCostPerKwh1EndTime to set
     */
    public void setEnergyCostPerKwh1EndTime(int EnergyCostPerKwh1EndTime) {
        this.EnergyCostPerKwh1EndTime = EnergyCostPerKwh1EndTime;
    }

    /**
     * @return the EnergyCostPerKwh2StartTime
     */
    public int getEnergyCostPerKwh2StartTime() {
        return EnergyCostPerKwh2StartTime;
    }

    /**
     * @param EnergyCostPerKwh2StartTime the EnergyCostPerKwh2StartTime to set
     */
    public void setEnergyCostPerKwh2StartTime(int EnergyCostPerKwh2StartTime) {
        this.EnergyCostPerKwh2StartTime = EnergyCostPerKwh2StartTime;
    }

    /**
     * @return the EnergyCostPerKwh2EndTime
     */
    public int getEnergyCostPerKwh2EndTime() {
        return EnergyCostPerKwh2EndTime;
    }

    /**
     * @param EnergyCostPerKwh2EndTime the EnergyCostPerKwh2EndTime to set
     */
    public void setEnergyCostPerKwh2EndTime(int EnergyCostPerKwh2EndTime) {
        this.EnergyCostPerKwh2EndTime = EnergyCostPerKwh2EndTime;
    }

    /**
     * @return the EnergyCostPerKwh1SameDayTime
     */
    public int getEnergyCostPerKwh1SameDayTime() {
        return EnergyCostPerKwh1SameDayTime;
    }

    /**
     * @param EnergyCostPerKwh1SameDayTime the EnergyCostPerKwh1SameDayTime to
     * set
     */
    public void setEnergyCostPerKwh1SameDayTime(int EnergyCostPerKwh1SameDayTime) {
        this.EnergyCostPerKwh1SameDayTime = EnergyCostPerKwh1SameDayTime;
    }

    /**
     * @return the EnergyCostPerKwh1TomDayTime
     */
    public int getEnergyCostPerKwh1TomDayTime() {
        return EnergyCostPerKwh1TomDayTime;
    }

    /**
     * @param EnergyCostPerKwh1TomDayTime the EnergyCostPerKwh1TomDayTime to set
     */
    public void setEnergyCostPerKwh1TomDayTime(int EnergyCostPerKwh1TomDayTime) {
        this.EnergyCostPerKwh1TomDayTime = EnergyCostPerKwh1TomDayTime;
    }

    /**
     * @return the EnergyCostPerKwh2SameDayTime
     */
    public int getEnergyCostPerKwh2SameDayTime() {
        return EnergyCostPerKwh2SameDayTime;
    }

    /**
     * @param EnergyCostPerKwh2SameDayTime the EnergyCostPerKwh2SameDayTime to
     * set
     */
    public void setEnergyCostPerKwh2SameDayTime(int EnergyCostPerKwh2SameDayTime) {
        this.EnergyCostPerKwh2SameDayTime = EnergyCostPerKwh2SameDayTime;
    }

    /**
     * @return the EnergyCostPerKwh2TomDayTime
     */
    public int getEnergyCostPerKwh2TomDayTime() {
        return EnergyCostPerKwh2TomDayTime;
    }

    /**
     * @param EnergyCostPerKwh2TomDayTime the EnergyCostPerKwh2TomDayTime to set
     */
    public void setEnergyCostPerKwh2TomDayTime(int EnergyCostPerKwh2TomDayTime) {
        this.EnergyCostPerKwh2TomDayTime = EnergyCostPerKwh2TomDayTime;
    }

    /**
     * @return the EnergyCostPerKwh1TimeSplit
     */
    public boolean isEnergyCostPerKwh1TimeSplit() {
        return EnergyCostPerKwh1TimeSplit;
    }

    /**
     * @param EnergyCostPerKwh1TimeSplit the EnergyCostPerKwh1TimeSplit to set
     */
    public void setEnergyCostPerKwh1TimeSplit(boolean EnergyCostPerKwh1TimeSplit) {
        if (EnergyCostPerKwh1TimeSplit && getEnergyCostPerKwh1StartTime() != 0 && getEnergyCostPerKwh1EndTime() != 0) {
            if (getEnergyCostPerKwh1StartTime() == getEnergyCostPerKwh1EndTime()) {
                setEnergyCostPerKwh1StartTime(0);
                setEnergyCostPerKwh1EndTime(24);
            }
        }
        this.EnergyCostPerKwh1TimeSplit = EnergyCostPerKwh1TimeSplit;

//        if(getEnergyCostPerKwh1StartTime() > getEnergyCostPerKwh1EndTime()){
//
//        }

    }

    /**
     * @return the EnergyCostPerKwh2TimeSplit
     */
    public boolean isEnergyCostPerKwh2TimeSplit() {
        return EnergyCostPerKwh2TimeSplit;
    }

    /**
     * @param EnergyCostPerKwh2TimeSplit the EnergyCostPerKwh2TimeSplit to set
     */
    public void setEnergyCostPerKwh2TimeSplit(boolean EnergyCostPerKwh2TimeSplit) {
        if (EnergyCostPerKwh2TimeSplit && getEnergyCostPerKwh2StartTime() != 0 && getEnergyCostPerKwh2EndTime() != 0) {
            if (getEnergyCostPerKwh2StartTime() == getEnergyCostPerKwh2EndTime()) {
                setEnergyCostPerKwh2StartTime(0);
                setEnergyCostPerKwh2EndTime(24);
            }
        }
        this.EnergyCostPerKwh2TimeSplit = EnergyCostPerKwh2TimeSplit;
    }

    /**
     * Find out the max sample rate devisor. This is for calculating max flow.
     * Minimul is 1.
     */
    public int findoutSampleRateDividor(ArrayList<Compressor> compressors) {
        try {
            
            ArrayList<Compressor> myCompressors = new ArrayList<Compressor>();
            for (Compressor compressor : compressors) {
               if(!compressor.Selected){
                    continue;
               }
               myCompressors.add(compressor);
            }
            
            int[] srates = new int[myCompressors.size()];

            int dividor;
            int i = 0;
            boolean unEven;
            for (Compressor compressor : myCompressors) {
          
                if(compressor.getAssignedFlowChannel() != null){
                     srates[i] = myDB.findProtocolHeader(compressor.getAssignedFlowChannel().Pref).SampleRate;
                }else if(compressor.hasPowerChannel()){
                    srates[i] = myDB.findProtocolHeader(compressor.getAssignedPowerChannel().Pref).SampleRate;
                }else{
                    srates[i] = myDB.findProtocolHeader(compressor.getCurrentChanel().Pref).SampleRate;
                }
                i++;
            }
            Arrays.sort(srates);

            minSample = srates[0];//add by be on 20101012.          

            for (dividor = srates[0]; dividor > 1; dividor--) {
                unEven = false;
                for (i = 0; i < srates.length; i++) {
                    if (srates[i] % dividor != 0) {
                        unEven = true;
                        break;
                    }
                }
                if (!unEven) {
                    return dividor;
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return 1;
    }
    private final int maxMemorySizePerChannel = 10 * 1000 * 1000;//total max count of selected channel is 6
    private final int oneTimeGetValues = maxMemorySizePerChannel / 8; //values: 1024*1024/8 = 131072; //90000;

    private ViewChannel iniViewChannelForQuery(NProtocolHeader protocolHeader, NChannelHeader channelHeader, int startID, int endID) {

        ViewChannel vc = new ViewChannel(String.valueOf(protocolHeader.DeviceID),
                "",
                channelHeader,
                protocolHeader.StartTime,
                protocolHeader.StopTime,
                protocolHeader.SampleRate * protocolHeader.SampleRateFactor / 1000, protocolHeader.NumOfSamples);

        long numOfSample = vc.numOfSamples;
        if (startID > numOfSample) {
            return null;
        }

        int onePageViewStartID = startID;
        int onePageViewEndID = endID;

        int queryStartID = startID;
        int queryEndID = endID;

        int queryTotalIDs = endID - startID;

        if (queryTotalIDs <= 0) {
            return null;
        }

        int pages = 0;
 
        pages = queryTotalIDs / oneTimeGetValues;
        if (queryTotalIDs % oneTimeGetValues > 0) {
            pages += 1;
        }

        if (pages > 1) {
            queryEndID = queryStartID + oneTimeGetValues;
        }

        vc.queryEndID = queryEndID;
        vc.queryStartID = queryStartID;
        vc.currentPage = 1;
        vc.totalPages = pages;
        vc.viewStartID = onePageViewStartID;
        vc.viewEndID = onePageViewEndID;

        return vc;
    }
    
    
    private boolean calculateCurrentOrPowerRecordsBaseOnCompressor(Compressor compressor){

        Compressor oldCompressor = compressor.clone();
        try{
            long fullLoadSeconds = 0;
            long noLoadSeconds = 0;
            long unLoadSeconds = 0;
            double totalSeconds = 0;
            double validSeconds = 0;
            long srateSecond;

//            int numOfValidRecords = 0;

            int startID, endID;

            NChannelHeader channelHeader = null;
            boolean hasPowerChannel = compressor.hasPowerChannel();
            if(hasPowerChannel){
                channelHeader = compressor.getAssignedPowerChannel();
            }else{
                channelHeader = compressor.getCurrentChanel();
            }

            if(channelHeader == null){
                return false;
            }

            NProtocolHeader pheader = myDB.findProtocolHeader(channelHeader.Pref);
            srateSecond = pheader.SampleRate * pheader.SampleRateFactor / 1000;

            // check if using cosP
            boolean calCosP = false;
            double theCosP = cosP;
            if (compressor.FullLoadCurrent > 0 && compressor.UnLoadCurrent > 0 && compressor.FullLoadCosP > 0 && compressor.UnLoadCosP > 0 && compressor.FullLoadCurrent > compressor.UnLoadCurrent && compressor.FullLoadCosP < 1 && compressor.UnLoadCosP < 1) {
                calCosP = true;
                compressor.CosPRatio = (compressor.FullLoadCosP - compressor.UnLoadCosP) / (compressor.FullLoadCurrent - compressor.UnLoadCurrent);
                compressor.CosPA0 = compressor.FullLoadCosP - compressor.FullLoadCurrent * compressor.CosPRatio;
            }

            // get start and end id based on pheader
            startID = (int) ((startTime.getTime() - pheader.StartTime) / (pheader.SampleRate * pheader.SampleRateFactor));
            endID = (int) ((endTime.getTime() - pheader.StartTime) / (pheader.SampleRate * pheader.SampleRateFactor));

            //modify on 20100107.
            //Simon feedback the valid record time had some error.
            //reason : startid < 0 .
            if (startID < 0) {
                startID = 0;
            }

            if(endID > pheader.NumOfSamples){
                endID = pheader.NumOfSamples;
            }
             
            double srateHour = (double) srateSecond / 3600;  // convert sample rate to hour

            totalSeconds += (pheader.StopTime - pheader.StartTime) / 1000;

            // algorithm:  power consumption (kwh) = votage * current * sqr(3) * cosP * Hour / 1000
            double volatgeAndParameterAndHourPerRecord = compressor.getSupplyVoltage() * 1.732f * srateHour / 1000;

            currentDataUsed = true;

            boolean previousFullLoad = true;
            boolean previousUnLoad = true;
            boolean previousNoLoad = true;
            //add on 20091231.
            //reason : Wolfgang Blessing,Michael Kromer test result : numofloadchange is not "number of load/unload cycles" value.
            //mothed : create number of load/unload cycles field.
            boolean previousIsFullLoad = false;
            boolean previousIsUnLoad = false;
            //ArrayList<MeasurementRecord> mrecords = myDB.queryMeasurementRecordWithinCertainPeriod(
            //      currentChannel.cref, startID, endID);
            double value;
            double fullLoadEnergyConsumptionThisChannel = 0;
            double unLoadEnergyConsumptionThisChannel = 0;
            double noLoadEnergyConsumptionThisChannel = 0;
            double totalEnergyConsumptionThisChannel = 0;

            //add on 20091029.be
            //reason : v3-5:Energy per Kwh setting will be different in for different times a day.
            int id;
            long onerecordtime;
            boolean isTime1 = false;
            boolean isTime2 = false;
            double fullLoadEnergyConsumptionThisChannel1time = 0;
            double fullLoadEnergyConsumptionThisChannel2time = 0;
            double unLoadEnergyConsumptionThisChannel1time = 0;
            double unLoadEnergyConsumptionThisChannel2time = 0;
            double noLoadEnergyConsumptionThisChannel1time = 0;
            double noLoadEnergyConsumptionThisChannel2time = 0;
            double totalEnergyConsumptionThisChannel1time = 0;
            double totalEnergyConsumptionThisChannel2time = 0;
            SimpleDateFormat dateFormat = new SimpleDateFormat("HH");
            int thisCompressorStartTimeHour = Integer.valueOf(dateFormat.format(pheader.StartTime));

            double energyCostPerKwh1TimeValue = getEnergyCostPerKwh1();
            double energyCostPerKwh2TimeValue = getEnergyCostPerKwh2();
            long energyCostPerKwh1TimeStartTime = (long) getEnergyCostPerKwh1StartTime();
            long energyCostPerKwh1TimeEndTime = (long) getEnergyCostPerKwh1EndTime();

            long energyCostPerKwh2TimeStartTime = (long) getEnergyCostPerKwh2StartTime();
            long energyCostPerKwh2TimeEndTime = (long) getEnergyCostPerKwh2EndTime();

            double fullLoadThreshold;
            double noLoadThreshold;

            int[] channelNos = {channelHeader.ChannelNumber};
            Hashtable<Long, ArrayList<Double>> mrecordLines = new Hashtable<Long, ArrayList<Double>>();
            ArrayList oneline = new ArrayList();

            if (compressor.Type == Compressor.COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {

                if(hasPowerChannel){
                    fullLoadThreshold = compressor.VFPowerMin * 0.75;
                    noLoadThreshold = compressor.VFPowerMin * 0.2;
                }else{
                    //For frequency controlled compressors we need to calculate:
                    //  Stop time (if amp is below 5 % of the minimum value in the table)
                    //  Unload time (if curent is below 75% if the minimum value in the table. we used it right now to 
                    //      set it to zero flow)
                    //  Load time (everything else)
                    fullLoadThreshold = compressor.VFAmpMin * 0.75;
                    //Michael Kromer requirtment change 5% to 20% (the stop threshold at 20% of the lowest Point P1 (Min) of the frequency regulated compressor)
                    //changed on 20100705.be
//                    noLoadThreshold = compressor.VFAmpMin * 0.05;
                    noLoadThreshold = compressor.VFAmpMin * 0.2;
                }
                    theCosP = compressor.VFCosPhi;
                    calCosP = false;

            } else {
                fullLoadThreshold = compressor.FullLoadCurrentThreshold;
                noLoadThreshold = compressor.NoLoadCurrentThreshold;
                System.out.println("LeakStatistics / calculateBasedOnCompressor fullLoadThreshold="+fullLoadThreshold);
                System.out.println("LeakStatistics / calculateBasedOnCompressor noLoadThreshold="+noLoadThreshold);
            }

            ViewChannel vc = this.iniViewChannelForQuery(pheader, channelHeader, startID, endID);
            if (vc == null) {
                return false;
            }

            int len = 0;

            do {                  
                mrecordLines = myDB.queryMeasurementRecordByOneLineWithRecordID(
                        channelHeader.Pref, channelNos, vc.queryStartID, vc.queryEndID);

                oneline = mrecordLines.get(channelHeader.Pref + channelNos[0]);
                len = oneline.size();


                //doing ======= begin

                for (int i = 0; i < len; i++) {
                    value = (Double) oneline.get(i);

                    //add on 20091029.be
                    //reason : v3-5:Energy per Kwh setting will be different in for different times a day.
                    //method : check record time in which time point.
                    // record id is count of the smaple rate so this record's time is : id * srate + compressor starttime .
                    id = vc.queryStartID + i;
                    onerecordtime = ((id * srateSecond) / 3600 + thisCompressorStartTimeHour) % 24;
                    if (isEnergyCostPerKwh1TimeSplit()) {
                        if (energyCostPerKwh2TimeStartTime != energyCostPerKwh2TimeEndTime) {
                            if ((onerecordtime == energyCostPerKwh2TimeStartTime) || (energyCostPerKwh2TimeStartTime < onerecordtime && onerecordtime < energyCostPerKwh2TimeEndTime)) {
                                isTime1 = false;
                                isTime2 = true;
                            } else {
                                isTime1 = true;
                                isTime2 = false;
                            }
                        } else {
                            isTime1 = true;
                            isTime2 = false;
                        }
                    } else if (isEnergyCostPerKwh2TimeSplit()) {
                        if (energyCostPerKwh1TimeStartTime != energyCostPerKwh1TimeEndTime) {
                            if ((onerecordtime == energyCostPerKwh1TimeStartTime) || (energyCostPerKwh1TimeStartTime < onerecordtime && onerecordtime < energyCostPerKwh1TimeEndTime)) {
                                isTime1 = true;
                                isTime2 = false;
                            } else {
                                isTime1 = false;
                                isTime2 = true;
                            }
                        } else {
                            isTime1 = false;
                            isTime2 = true;
                        }
                    } else {
                        if ((onerecordtime == energyCostPerKwh1TimeStartTime) || (energyCostPerKwh1TimeStartTime < onerecordtime && onerecordtime < energyCostPerKwh1TimeEndTime)) {
                            isTime1 = true;
                            isTime2 = false;
                        } else if ((onerecordtime == energyCostPerKwh2TimeStartTime) || (energyCostPerKwh2TimeStartTime < onerecordtime && onerecordtime < energyCostPerKwh2TimeEndTime)) {
                            isTime1 = false;
                            isTime2 = true;
                        } else {
                            isTime1 = false;
                            isTime2 = false;
                        }
                    }

                    if (value == CSMDF.INVALID_MEASUREMENT_VALUE || value == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                        continue;
                    }
                    // hardcode to compensate the fact that sometimes there's negative current value
                    if (value < 0) {
                        value = 0;
                    }

                    if (calCosP) {
                        theCosP = calculateCosP(value, compressor);
                    }


                    if (value >= fullLoadThreshold) {
                        fullLoadSeconds += srateSecond;
                        if (!previousFullLoad) {
                            compressor.NumOfLoadChanges++;
                        }
                        //v3-1, add 20091014,be.
                        //erery time when current value comes from below stop threshold to above stop
                        //threshold, the number of starts of this compressor will be added by 1.
                        if (previousNoLoad) {
                            compressor.NumStarts++;
                        }

                        //add on 20091225.
                        //reason : Wolfgang Blessing,Michael Kromer test result : numofloadchange is not "number of load/unload cycles" value.
                        //mothed : create number of load/unload cycles field.
                        if (previousIsUnLoad) {
                            compressor.NumOfLoad_UnloadChanges++;
                        }

                        previousFullLoad = true;
                        previousNoLoad = false;
                        previousUnLoad = false;

                        //add on 20091231.
                        //reason : Wolfgang Blessing,Michael Kromer test result : numofloadchange is not "number of load/unload cycles" value.
                        //mothed : create number of load/unload cycles field.
                        previousIsFullLoad = true;
                        previousIsUnLoad = false;

                        //modify on 20091029.be
                        //reason : v3-5:Energy per Kwh setting will be different in for different times a day.

//                            fullLoadEnergyConsumptionThisChannel += theCosP * value;
                        if (isTime1) {
                            if(hasPowerChannel){                                 
                                fullLoadEnergyConsumptionThisChannel1time += value;
                            }else{
                                fullLoadEnergyConsumptionThisChannel1time += theCosP * value;
                            }
                        }
                        if (isTime2) {
                            if(hasPowerChannel){                                 
                                fullLoadEnergyConsumptionThisChannel2time += value;
                            }else{
                                fullLoadEnergyConsumptionThisChannel2time += theCosP * value;
                            }
                        }


                    } else if (value < noLoadThreshold && value >= 0) {
                        noLoadSeconds += srateSecond;
                        if (!previousNoLoad) {
                            compressor.NumOfLoadChanges++;
                        }
                        previousFullLoad = false;
                        previousNoLoad = true;
                        previousUnLoad = false;

                        //add on 20091231.
                        //reason : Wolfgang Blessing,Michael Kromer test result : numofloadchange is not "number of load/unload cycles" value.
                        //mothed : create number of load/unload cycles field.
                        previousIsFullLoad = false;
                        previousIsUnLoad = false;

                        //modify on 20091029.be
                        //reason : v3-5:Energy per Kwh setting will be different in for different times a day.
//                            noLoadEnergyConsumptionThisChannel += theCosP * value;
                        if (isTime1) {
                            if(hasPowerChannel){                                 
                                noLoadEnergyConsumptionThisChannel1time += value;
                            }else{
                                noLoadEnergyConsumptionThisChannel1time += theCosP * value;
                            }
                        }
                        if (isTime2) {
                            if(hasPowerChannel){                                 
                                noLoadEnergyConsumptionThisChannel2time += value;
                            }else{
                                noLoadEnergyConsumptionThisChannel2time += theCosP * value;
                            }
                        }

                    } else { // if ( value < compressor.UnLoadCurrentThreshold && value >= compressor.NoLoadCurrentThreshold ) {
                        unLoadSeconds += srateSecond;
                        if (!previousUnLoad) {
                            compressor.NumOfLoadChanges++;
                        }

                        //v3-1, add 20091014,be.
                        //erery time when current value comes from below stop threshold to above stop
                        //threshold, the number of starts of this compressor will be added by 1.
                        if (previousNoLoad) {
                            compressor.NumStarts++;
                        }

                        //add on 20091225.
                        //reason : Wolfgang Blessing,Michael Kromer test result : numofloadchange is not "number of load/unload cycles" value.
                        //mothed : create number of load/unload cycles field.
                        if (previousIsFullLoad) {
                            compressor.NumOfLoad_UnloadChanges++;
                        }
                        //add on 20091231.
                        //reason : Wolfgang Blessing,Michael Kromer test result : numofloadchange is not "number of load/unload cycles" value.
                        //mothed : create number of load/unload cycles field.
                        previousIsFullLoad = false;
                        previousIsUnLoad = true;

                        previousFullLoad = false;
                        previousNoLoad = false;
                        previousUnLoad = true;

                        //modify on 20091029.be
                        //reason : v3-5:Energy per Kwh setting will be different in for different times a day.
//                          unLoadEnergyConsumptionThisChannel += theCosP * value;
                        if (isTime1) {
                            if(hasPowerChannel){                                 
                                unLoadEnergyConsumptionThisChannel1time += value;
                            }else{
                                unLoadEnergyConsumptionThisChannel1time += theCosP * value;
                            }
                        }
                        if (isTime2) {
                                if(hasPowerChannel){                                 
                                unLoadEnergyConsumptionThisChannel2time += value;
                                }else{
                                unLoadEnergyConsumptionThisChannel2time += theCosP * value;
                                }
                        }

                    } /*
                        * else { if ( previousFullLoad || previousNoLoad ||
                        * previousUnLoad ) { compressor.NumOfLoadChanges++;
                        * } previousFullLoad = false; previousNoLoad =
                        * false; previousUnLoad = false;                        
                }
                        */

                    //modify on 20091029.be
                    //reason : v3-5:Energy per Kwh setting will be different in for different times a day.
                    //v3-5 : Energy per kwh setting will be different in for different times a day.
                    //the 2 time points should be set by the user individually

//                        totalEnergyConsumptionThisChannel += theCosP * value;
                    if (isTime1) {
                        if(hasPowerChannel){                                 
                            totalEnergyConsumptionThisChannel1time += value;
                        }else{
                            totalEnergyConsumptionThisChannel1time += theCosP * value;
                        }
                    }
                    if (isTime2) {
                        if(hasPowerChannel){                                 
                            totalEnergyConsumptionThisChannel2time += value;
                        }else{
                            totalEnergyConsumptionThisChannel2time += theCosP * value;
                        }
                    }

                } // end of measurement record loop

                //doing========= end    
                vc.queryStartID = vc.queryEndID;
                if ((vc.queryEndID + oneTimeGetValues) >= vc.numOfSamples) {
                    vc.queryEndID = (int) vc.numOfSamples;
                } else {
                    vc.queryEndID = vc.queryEndID + this.oneTimeGetValues;
                }
                if (vc.queryEndID > vc.viewEndID) {
                    vc.queryEndID = vc.viewEndID;
                }

                vc.currentPage++;

                if(mrecordLines != null){
                    mrecordLines.clear();

                }
                if(oneline != null){
                    oneline.clear();

                }           

            } while (vc.currentPage <= vc.totalPages);

//=======================================================================
            validSeconds = fullLoadSeconds + unLoadSeconds + noLoadSeconds;
            //} // ********* end of if compressor type

            if (hasPowerChannel) {
                double energySRateHour =  (double)srateSecond / 3600 ;
                fullLoadEnergyConsumptionThisChannel1time = fullLoadEnergyConsumptionThisChannel1time * energySRateHour;
                fullLoadEnergyConsumptionThisChannel2time = fullLoadEnergyConsumptionThisChannel2time * energySRateHour;
                unLoadEnergyConsumptionThisChannel1time = unLoadEnergyConsumptionThisChannel1time * energySRateHour;
                unLoadEnergyConsumptionThisChannel2time = unLoadEnergyConsumptionThisChannel2time * energySRateHour;
                noLoadEnergyConsumptionThisChannel1time = noLoadEnergyConsumptionThisChannel1time * energySRateHour;
                noLoadEnergyConsumptionThisChannel2time = noLoadEnergyConsumptionThisChannel2time * energySRateHour;
                totalEnergyConsumptionThisChannel1time = totalEnergyConsumptionThisChannel1time * energySRateHour;
                totalEnergyConsumptionThisChannel2time = totalEnergyConsumptionThisChannel2time * energySRateHour;

            }


            //add on 20091029.be
            //reason : v3-5:Energy per Kwh setting will be different in for different times a day.
            //v3-5 : Energy per kwh setting will be different in for different times a day.
            //the 2 time points should be set by the user individually
            fullLoadEnergyConsumptionThisChannel = fullLoadEnergyConsumptionThisChannel1time + fullLoadEnergyConsumptionThisChannel2time;
            unLoadEnergyConsumptionThisChannel = unLoadEnergyConsumptionThisChannel1time + unLoadEnergyConsumptionThisChannel2time;
            noLoadEnergyConsumptionThisChannel = noLoadEnergyConsumptionThisChannel1time + noLoadEnergyConsumptionThisChannel2time;
            totalEnergyConsumptionThisChannel = totalEnergyConsumptionThisChannel1time + totalEnergyConsumptionThisChannel2time;

            if (hasPowerChannel) {
                compressor.FullLoadEnergyConsumption = fullLoadEnergyConsumptionThisChannel;
                compressor.UnLoadEnergyConsumption = unLoadEnergyConsumptionThisChannel ;
                compressor.NoLoadEnergyConsumption = noLoadEnergyConsumptionThisChannel ;
                compressor.TotalEnergyConsumption = totalEnergyConsumptionThisChannel;
            } else {
                compressor.FullLoadEnergyConsumption += fullLoadEnergyConsumptionThisChannel * volatgeAndParameterAndHourPerRecord;
                compressor.UnLoadEnergyConsumption += unLoadEnergyConsumptionThisChannel * volatgeAndParameterAndHourPerRecord;
                compressor.NoLoadEnergyConsumption += noLoadEnergyConsumptionThisChannel * volatgeAndParameterAndHourPerRecord;
                //compressor.TotalEnergyConsumption += totalEnergyConsumptionThisChannel * volatgeAndParameterAndHourPerRecord;
                compressor.TotalEnergyConsumption += totalEnergyConsumptionThisChannel * volatgeAndParameterAndHourPerRecord;
            }

            //modify on 20091029.be
            //reason : v3-5:Energy per Kwh setting will be different in for different times a day.
            //v3-5 : Energy per kwh setting will be different in for different times a day.
            //the 2 time points should be set by the user individually
//                compressor.TotalCost = compressor.TotalEnergyConsumption * compressor.EnergyCostPerKwh;
            if (hasPowerChannel) {
                compressor.TotalCost = totalEnergyConsumptionThisChannel1time * energyCostPerKwh1TimeValue
                        + totalEnergyConsumptionThisChannel2time * energyCostPerKwh2TimeValue;
            } else {
                compressor.TotalCost = volatgeAndParameterAndHourPerRecord * (totalEnergyConsumptionThisChannel1time * energyCostPerKwh1TimeValue
                        + totalEnergyConsumptionThisChannel2time * energyCostPerKwh2TimeValue);

            }

            compressor.FullLoadHours = (fullLoadSeconds / 3600d);
            compressor.NoLoadHours = (noLoadSeconds / 3600d);
            compressor.UnLoadHours = (unLoadSeconds / 3600d);
            compressor.TotalHours = (validSeconds / 3600d);
            compressor.FullLoadPercentageMeasurementInterval = fullLoadSeconds / validSeconds;
            compressor.NoLoadPercentageMeasurementInterval = noLoadSeconds / validSeconds;
            compressor.UnLoadPercentageMeasurementInterval = unLoadSeconds / validSeconds;

            //modify on 20091029.be
            //reason : v3-5:Energy per Kwh setting will be different in for different times a day.
            //v3-5 : Energy per kwh setting will be different in for different times a day.
            //the 2 time points should be set by the user individually
//                compressor.FullLoadEnergyCost = compressor.FullLoadEnergyConsumption * compressor.EnergyCostPerKwh;
//                compressor.NoLoadEnergyCost = compressor.NoLoadEnergyConsumption * compressor.EnergyCostPerKwh;
//                compressor.UnLoadEnergyCost = compressor.UnLoadEnergyConsumption * compressor.EnergyCostPerKwh;

            if (hasPowerChannel) {
                compressor.FullLoadEnergyCost = fullLoadEnergyConsumptionThisChannel1time * energyCostPerKwh1TimeValue
                        + fullLoadEnergyConsumptionThisChannel2time * energyCostPerKwh2TimeValue;
                compressor.NoLoadEnergyCost = noLoadEnergyConsumptionThisChannel1time * energyCostPerKwh1TimeValue
                        + noLoadEnergyConsumptionThisChannel2time * energyCostPerKwh2TimeValue;
                compressor.UnLoadEnergyCost = unLoadEnergyConsumptionThisChannel1time * energyCostPerKwh1TimeValue
                        + unLoadEnergyConsumptionThisChannel2time * energyCostPerKwh2TimeValue;
            } else {
                compressor.FullLoadEnergyCost = (fullLoadEnergyConsumptionThisChannel1time * energyCostPerKwh1TimeValue
                        + fullLoadEnergyConsumptionThisChannel2time * energyCostPerKwh2TimeValue) * volatgeAndParameterAndHourPerRecord;
                compressor.NoLoadEnergyCost = (noLoadEnergyConsumptionThisChannel1time * energyCostPerKwh1TimeValue
                        + noLoadEnergyConsumptionThisChannel2time * energyCostPerKwh2TimeValue) * volatgeAndParameterAndHourPerRecord;
                compressor.UnLoadEnergyCost = (unLoadEnergyConsumptionThisChannel1time * energyCostPerKwh1TimeValue
                        + unLoadEnergyConsumptionThisChannel2time * energyCostPerKwh2TimeValue) * volatgeAndParameterAndHourPerRecord;
            }

            compressor.CO2Emmision = compressor.TotalEnergyConsumption * compressor.CO2EmmisionPerKWh;

            double yearRatio = 3600 * WORKING_HOUR_PER_YEAR / validSeconds;

            compressor.FullLoadHoursOneYear = ((fullLoadSeconds / 3600f) * yearRatio);
            compressor.NoLoadHoursOneYear = ((noLoadSeconds / 3600f) * yearRatio);
            compressor.UnLoadHoursOneYear = ((unLoadSeconds / 3600f) * yearRatio);
            compressor.NumOfLoadChangesOneYear = compressor.NumOfLoadChanges * yearRatio;

            //add on 20091225.
            //reason : Wolfgang Blessing,Michael Kromer test result : numofloadchange is not "number of load/unload cycles" value.
            //mothed : create number of load/unload cycles field.
            compressor.NumOfLoad_UnloadChangesOneYear = compressor.NumOfLoad_UnloadChanges * yearRatio;

            //v3-1, add 20091014,be.
            //erery time when current value comes from below stop threshold to above stop
            //threshold, the number of starts of this compressor will be added by 1.
            //one year.
            compressor.NumStartsOneYear = compressor.NumStarts * yearRatio;

            compressor.TotalEnergyConsumptionOneYear = compressor.TotalEnergyConsumption * yearRatio;
            compressor.TotalCostOneYear = compressor.TotalCost * yearRatio;
            compressor.FullLoadEnergyConsumptionOneYear = compressor.FullLoadEnergyConsumption * yearRatio;
            compressor.UnLoadEnergyConsumptionOneYear = compressor.UnLoadEnergyConsumption * yearRatio;
            compressor.NoLoadEnergyConsumptionOneYear = compressor.NoLoadEnergyConsumption * yearRatio;
            compressor.FullLoadEnergyCostOneYear = compressor.FullLoadEnergyCost * yearRatio;
            compressor.UnLoadEnergyCostOneYear = compressor.UnLoadEnergyCost * yearRatio;
            compressor.NoLoadEnergyCostOneYear = compressor.NoLoadEnergyCost * yearRatio;

            //modify on 20091015.be v3-2
            compressor.CO2EmmisionOneYear = compressor.CO2Emmision * yearRatio;
            // compressor.CO2EmmisionOneYear = this.getCO2EmmisionPerKWh() * yearRatio;
            
            compressor.setYearRatio(yearRatio);
            
            return true ;
        }catch(Exception e){
            compressor = oldCompressor.clone();
            return false;
        }

    }
    
    private boolean calculateFlowRecordsBaseOnCompressor(Compressor compressor){
        // calculate flow record
        Compressor oldCompressor = compressor.clone();
        try{
            NChannelHeader channelHeader = compressor.getAssignedFlowChannel();
            boolean hasFlowChannel = true;
            boolean hasPowerChannel = false;
            if(channelHeader == null){
                if(compressor.hasPowerChannel()){
                    channelHeader = compressor.getAssignedPowerChannel();
                    hasPowerChannel = true;
                }else{
                    channelHeader = compressor.getCurrentChanel();
                    hasPowerChannel = false;
                }
                hasFlowChannel = false;
            }

            if(channelHeader == null){
                return false;
            }

            int startID, endID;
            NProtocolHeader pheader = myDB.findProtocolHeader(channelHeader.Pref);
            int srateSecond = pheader.SampleRate * pheader.SampleRateFactor / 1000;

            // get start and end id based on pheader
            startID = (int) ((startTime.getTime() - pheader.StartTime) / (pheader.SampleRate * pheader.SampleRateFactor));
            endID = (int) ((endTime.getTime() - pheader.StartTime) / (pheader.SampleRate * pheader.SampleRateFactor));

            //modify on 20100107.
            //Simon feedback the valid record time had some error.
            //reason : startid < 0 .
            if (startID < 0) {
                startID = 0;
            }

            if(endID > pheader.NumOfSamples){
                endID = pheader.NumOfSamples;
            }
            
            ViewChannel vc = this.iniViewChannelForQuery(pheader, channelHeader, startID, endID);
            if (vc == null) {
                return false;
            }
                
            double srateHour = (double) srateSecond / 3600;  // convert sample rate to hour

            double flowRate = 0;
            double sumFlowRate = 0;
            double sumConsumption = 0;
            double sumLeakage = 0;
            int numOfValidRecords = 0;
            int len = 0;

            // to calculate max flow
            double flowRateRationToOneHour = srateHour * MeasurementUnit.FlowUnitRatioToOneHour(compressor.AirDeliveryUnit);

            Hashtable<Long, ArrayList<Double>> mrecordLines = new Hashtable<Long, ArrayList<Double>>();
            ArrayList oneline = new ArrayList();

            int[] channelNos = {channelHeader.ChannelNumber};
            double value;

            if (!hasFlowChannel) {
                averageLeakage = 0;
                numOfValidRecords = 0;
                len = 0;

                do {
                    mrecordLines = myDB.queryMeasurementRecordByOneLineWithRecordID(
                            channelHeader.Pref, channelNos, vc.queryStartID, vc.queryEndID);
                    oneline = mrecordLines.get(channelHeader.Pref + channelNos[0]);
                    len = oneline.size();
                    //doing ======= begin

                    if (compressor.Type == Compressor.COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
                        
                        if(hasPowerChannel){
                            double minFlowThreshold = compressor.VFPowerMin * 0.75;
                            flowRateRationToOneHour = srateHour * MeasurementUnit.FlowUnitRatioToOneHour(compressor.VFAirDeliveryUnit);
                            compressor.MinFlow = compressor.VFAirDeliveryMax;

                            for (int i = 0; i < len; i++) {
                                value = (Double) oneline.get(i);
                                if (value == myDB.INVALID_MEASUREMENT_VALUE || value == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                                    //add on 20100602.
    //                                for ( int ii = 0; ii < maxFlowDataPerSampleRate; ii++ ) {
    //                                    maxFlows[ maxFlowsID + ii ] += 0;
    //                                    maxFlowsID++;
    //                                }

                                    continue;
                                }
                                numOfValidRecords++;

                                if (value < minFlowThreshold) {
                                    flowRate = 0;
                                } else if (value <= compressor.VFPowerMin) {
                                    flowRate = compressor.VFAirDeliveryMin;
                                } else if (value <= compressor.VFPowerP2) //flowRate = ( value - compressor.VFAmpMin ) * compressor.VFLinearCoefficientP2Min;
                                {
                                    flowRate = value * compressor.VFLinearCoefficientP2Min + compressor.VFLinearCoefficientP2MinA0;
                                } else if (value <= compressor.VFPowerP3) {
                                    flowRate = value * compressor.VFLinearCoefficientP3P2 + compressor.VFLinearCoefficientP3P2A0;
                                } else if (value <= compressor.VFPowerMax) {
                                    flowRate = value * compressor.VFLinearCoefficientMaxP3 + compressor.VFLinearCoefficientMaxP3A0;
                                } else {
                                    flowRate = compressor.VFAirDeliveryMax;
                                }

                                sumFlowRate += flowRate;
                                if (compressor.MaxFlow < flowRate) {
                                    compressor.MaxFlow = flowRate;
                                }
                                if (compressor.MinFlow > flowRate) {
                                    compressor.MinFlow = flowRate;
                                }

    //                            for ( int ii = 0; ii < maxFlowDataPerSampleRate; ii++ ) {
    //                                maxFlows[ maxFlowsID + ii ] += flowRate;
    //                                maxFlowsID++;
    //                            }
    //                            maxFlows[i] += flowRate;
                            }
                        }else{                       
                            double minFlowThreshold = compressor.VFAmpMin * 0.75;
                            flowRateRationToOneHour = srateHour * MeasurementUnit.FlowUnitRatioToOneHour(compressor.VFAirDeliveryUnit);
                            compressor.MinFlow = compressor.VFAirDeliveryMax;

                            for (int i = 0; i < len; i++) {
                                value = (Double) oneline.get(i);
                                if (value == myDB.INVALID_MEASUREMENT_VALUE || value == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                                    //add on 20100602.
    //                                for ( int ii = 0; ii < maxFlowDataPerSampleRate; ii++ ) {
    //                                    maxFlows[ maxFlowsID + ii ] += 0;
    //                                    maxFlowsID++;
    //                                }

                                    continue;
                                }
                                numOfValidRecords++;

                                if (value < minFlowThreshold) {
                                    flowRate = 0;
                                } else if (value <= compressor.VFAmpMin) {
                                    flowRate = compressor.VFAirDeliveryMin;
                                } else if (value <= compressor.VFAmpP2) //flowRate = ( value - compressor.VFAmpMin ) * compressor.VFLinearCoefficientP2Min;
                                {
                                    flowRate = value * compressor.VFLinearCoefficientP2Min + compressor.VFLinearCoefficientP2MinA0;
                                } else if (value <= compressor.VFAmpP3) {
                                    flowRate = value * compressor.VFLinearCoefficientP3P2 + compressor.VFLinearCoefficientP3P2A0;
                                } else if (value <= compressor.VFAmpMax) {
                                    flowRate = value * compressor.VFLinearCoefficientMaxP3 + compressor.VFLinearCoefficientMaxP3A0;
                                } else {
                                    flowRate = compressor.VFAirDeliveryMax;
                                }

                                sumFlowRate += flowRate;
                                if (compressor.MaxFlow < flowRate) {
                                    compressor.MaxFlow = flowRate;
                                }
                                if (compressor.MinFlow > flowRate) {
                                    compressor.MinFlow = flowRate;
                                }

    //                            for ( int ii = 0; ii < maxFlowDataPerSampleRate; ii++ ) {
    //                                maxFlows[ maxFlowsID + ii ] += flowRate;
    //                                maxFlowsID++;
    //                            }
    //                            maxFlows[i] += flowRate;
                            }

                        }
                    } else { // ************* compressor type is load / unload
                        for (int i = 0; i < len; i++) {
                            value = (Double) oneline.get(i);
                            if (value == myDB.INVALID_MEASUREMENT_VALUE || value == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                                //add on 20100602.
//                                for ( int ii = 0; ii < maxFlowDataPerSampleRate; ii++ ) {
//                                    maxFlows[ maxFlowsID + ii ] += 0;
//                                    maxFlowsID++;
//                                }

                                continue;
                            }
                            numOfValidRecords++;

                            if (value >= compressor.FullLoadCurrentThreshold) {
                                flowRate = compressor.FullLoadAirDelivery;
                            } else {
                                flowRate = 0;
                            }
                            sumFlowRate += flowRate;

//                           for ( int ii = 0; ii < maxFlowDataPerSampleRate; ii++ ) {
//                                maxFlows[ maxFlowsID + ii ] += flowRate;
//                                maxFlowsID++;
//                            }
//                           maxFlows[i] += flowRate;
                        }

                        compressor.MaxFlow = compressor.FullLoadAirDelivery; //( currentChannel.Max - compressor.UnLoadCurrentThreshold ) * airDeliveryRatio;
                        compressor.MinFlow = 0; // ( currentChannel.Min - compressor.UnLoadCurrentThreshold ) * airDeliveryRatio;
                    } // ***** end of if compressor type

                    //doing========= end    
                    vc.queryStartID = vc.queryEndID;
                    if ((vc.queryEndID + oneTimeGetValues) >= vc.numOfSamples) {
                        vc.queryEndID = (int) vc.numOfSamples;
                    } else {
                        vc.queryEndID = vc.queryEndID + this.oneTimeGetValues;
                    }
                    if (vc.queryEndID > vc.viewEndID) {
                        vc.queryEndID = vc.viewEndID;
                    }

                    vc.currentPage++;

                    if(mrecordLines != null){
                        mrecordLines.clear();

                    }
                        if(oneline != null){
                            oneline.clear();

                        }


                } while (vc.currentPage <= vc.totalPages);


                sumConsumption += sumFlowRate * flowRateRationToOneHour;
                LicenseConst.getLogger().log(Level.INFO, "LeakStatistics/calculateBasedOnCompressor " + compressor.Description + " sumConsumption :" + sumConsumption);


//                    =============================================================

            } else {  // there's assigned flow channel
                double flowValue;
                averageLeakage = 0;
                
                System.out.println("calculateFlowRecordsBaseOnCompressor/assigned flow channel averageLeakage is " + averageLeakage);

                compressor.MaxFlow = channelHeader.Max;
                compressor.MinFlow = channelHeader.Min;
                compressor.AirDeliveryUnit = channelHeader.getUnitText();

                flowRateRationToOneHour = srateHour * MeasurementUnit.FlowUnitRatioToOneHour(compressor.AirDeliveryUnit);

//                    mrecords = myDB.queryMeasurementRecordWithinCertainPeriod(
//                            assignedFlowChannel.cref, startID, endID  );

                len = 0;
                numOfValidRecords = 0;
                do {
                    mrecordLines = myDB.queryMeasurementRecordByOneLineWithRecordID(
                            channelHeader.Pref, channelNos, vc.queryStartID, vc.queryEndID);
                    oneline = mrecordLines.get(channelHeader.Pref + channelNos[0]);
                    len = oneline.size();
                    //doing ======= begin

                   
                    for (int i = 0; i < len; i++) {
                        flowValue = (Double) oneline.get(i);
                        if (flowValue == myDB.INVALID_MEASUREMENT_VALUE || flowValue == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                            //add on 20100602.
//                            for ( int ii = 0; ii < maxFlowDataPerSampleRate; ii++ ) {
//                                maxFlows[ maxFlowsID + ii ] += 0;
//                                maxFlowsID++;
//                            }

                            continue;
                        }
                        sumFlowRate += flowValue;
                        sumConsumption += flowValue * flowRateRationToOneHour; //have some error ??
                        numOfValidRecords++;

//                        for ( int ii = 0; ii < maxFlowDataPerSampleRate; ii++ ) {
//                            maxFlows[ maxFlowsID + ii ] += flowValue;
//                            maxFlowsID++;
//                        }
//                         maxFlows[i] += flowValue;
                    }

                    //doing========= end    
                    vc.queryStartID = vc.queryEndID;
                    if ((vc.queryEndID + oneTimeGetValues) >= vc.numOfSamples) {
                        vc.queryEndID = (int) vc.numOfSamples;
                    } else {
                        vc.queryEndID = vc.queryEndID + this.oneTimeGetValues;
                    }
                    if (vc.queryEndID > vc.viewEndID) {
                        vc.queryEndID = vc.viewEndID;
                    }

                    vc.currentPage++;

                    if(mrecordLines != null){
                            mrecordLines.clear();

                    }
                    if(oneline != null){
                        oneline.clear();

                    }

                } while (vc.currentPage <= vc.totalPages);




//                    LicenseConst.getLogger().log( Level.INFO,"LeakStatistics/calculateBasedOnCompressor(assignedFlowChannel != null) "+ compressor.Description +" maxFlows.length :"+ maxFlows.length + " ;mrecordLines.size="+mrecordLines.size());
                LicenseConst.getLogger().log(Level.INFO, "LeakStatistics/calculateBasedOnCompressor(assignedFlowChannel != null) " + compressor.Description + " sumConsumption :" + sumConsumption);

                sumLeakage += averageLeakage * flowRateRationToOneHour * numOfValidRecords;
            }  // end of if assigned flow channel not null

            if (numOfValidRecords > 0) {
                compressor.AverageFlow = sumFlowRate / numOfValidRecords;
                //compressor.AverageLeakage = sumLeakage / numOfValidRecords;
                if(sumLeakage != 0){
                    compressor.AverageLeakage = averageLeakage;
                }
            }
            //compressor.TotalAirDeliveryAmount = (long) ( sumConsumption / flowRateRationToOneHour );
            compressor.TotalAirDeliveryAmount = (long) sumConsumption;
//             System.out.println("1111 LeakStatistics/calculateBasedOnCompressor compressor.TotalAirDeliveryAmount="+compressor.TotalAirDeliveryAmount);
            compressor.TotalLeakage = (long) sumLeakage;
            if (compressor.TotalAirDeliveryAmount > 0) {
                compressor.LeakageRate = compressor.TotalLeakage / (double) compressor.TotalAirDeliveryAmount;
                compressor.AirUnitCost = compressor.TotalCost
                        / ((double) compressor.TotalAirDeliveryAmount * MeasurementUnit.RatioToM3BasedOnFlowUnit(compressor.AirDeliveryUnit));

                //v3-1&6 ,20091014 be.
                compressor.SpecificPower = compressor.TotalEnergyConsumption / (double) compressor.TotalAirDeliveryAmount;

            }
            compressor.LeakageCost = compressor.LeakageRate * compressor.TotalCost;

            double yearRatio = compressor.getYearRatio();
            compressor.TotalAirDeliveryAmountOneYear = (long) ((double) compressor.TotalAirDeliveryAmount * yearRatio);
            compressor.TotalLeakageOneYear = (long) ((double) compressor.TotalLeakage * yearRatio);
            compressor.LeakageCostOneYear = compressor.LeakageCost * yearRatio;

            // convert to the unit user select
            double flowUnitRatio = MeasurementUnit.RatioToM3PerHour(compressor.AirDeliveryUnit)
                    / MeasurementUnit.RatioToM3PerHour(air_delivery_unit);
            double consumptionUnitRatio = MeasurementUnit.RatioToM3BasedOnFlowUnit(compressor.AirDeliveryUnit)
                    / MeasurementUnit.RatioToM3BasedOnFlowUnit(air_delivery_unit);
//                System.out.println("LeakStatistics/calculateBasedOnCompressor flowUnitRatio="+flowUnitRatio);
//                System.out.println("LeakStatistics/calculateBasedOnCompressor consumptionUnitRatio="+consumptionUnitRatio);
            compressor.AverageFlow = compressor.AverageFlow * flowUnitRatio;
            compressor.MaxFlow = compressor.MaxFlow * flowUnitRatio;
            compressor.MinFlow = compressor.MinFlow * flowUnitRatio;
            compressor.TotalAirDeliveryAmount = (long) (compressor.TotalAirDeliveryAmount * consumptionUnitRatio);
//                System.out.println("222222LeakStatistics/calculateBasedOnCompressor compressor.TotalAirDeliveryAmount="+compressor.TotalAirDeliveryAmount);

            //add on 20100601.
            if (compressor.TotalAirDeliveryAmount > 0) {
                compressor.SpecificPower = compressor.TotalEnergyConsumption / (double) compressor.TotalAirDeliveryAmount;
            }

            compressor.TotalAirDeliveryAmountOneYear = (long) (compressor.TotalAirDeliveryAmountOneYear * consumptionUnitRatio);
            compressor.AverageLeakage = compressor.AverageLeakage * flowUnitRatio;
            compressor.TotalLeakage = (long) (compressor.TotalLeakage * consumptionUnitRatio);
            compressor.TotalLeakageOneYear = (long) (compressor.TotalLeakageOneYear * consumptionUnitRatio);
            LicenseConst.getLogger().log(Level.INFO, "LeakStatistics/calculateBasedOnCompressor " + compressor.Description + " TotalAirDeliveryAmount :" + compressor.TotalAirDeliveryAmount);

            if(mrecordLines != null){
                mrecordLines.clear();
                mrecordLines = null;
            }
            if(oneline != null){
                oneline.clear();
                oneline = null;
            }
            if(vc != null){
                vc = null;
            }

            return true;
       
        }catch(Exception e){
            compressor = oldCompressor.clone();
            e.printStackTrace();
            return false;
        }
                
    }

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
        if(systemFlowChannel != null){
            isAssignSystemFlowChannel = true;
        }else{
            isAssignSystemFlowChannel = false;
        }
    }
    
    private boolean calculateSystemAnalyzesFlowChannelValueFields(NChannelHeader channelHeader){
        if(channelHeader == null){
            return false;
        }
        
//        systemAnalyzesSumSpecificPower = 0;
        setSystemAnalyzesSumMaxFlow(0);
        setSystemAnalyzesSumAverageFlow(0);
        setSystemAnalyzesSumTotalAirDelivery(0);
        setSystemAnalyzesSumTotalAirDeliveryOneYear(0);
    
        int startID, endID;
        NProtocolHeader pheader = myDB.findProtocolHeader(channelHeader.Pref);
        int srateSecond = pheader.SampleRate * pheader.SampleRateFactor / 1000;

        // get start and end id based on pheader
        startID = (int) ((startTime.getTime() - pheader.StartTime) / (pheader.SampleRate * pheader.SampleRateFactor));
        endID = (int) ((endTime.getTime() - pheader.StartTime) / (pheader.SampleRate * pheader.SampleRateFactor));

        if (startID < 0) {
            startID = 0;
        }

        if(endID > pheader.NumOfSamples){
            endID = pheader.NumOfSamples;
        }

        ViewChannel vc = this.iniViewChannelForQuery(pheader, channelHeader, startID, endID);
        if (vc == null) {
            return false;
        }

        double srateHour = (double) srateSecond / 3600;  // convert sample rate to hour

        double sumFlowRate = 0;
        double sumConsumption = 0;

        int numOfValidRecords = 0;
        int len = 0;

        String channelUnit = channelHeader.getUnitText();
        long analyzeTimePeriod = endTime.getTime() - startTime.getTime();       
        double validRecordTimeHours = (double) analyzeTimePeriod / 1000 / 3600;

        // to calculate max flow
        double flowRateRationToOneHour = srateHour * MeasurementUnit.FlowUnitRatioToOneHour(channelUnit);

        Hashtable<Long, ArrayList<Double>> mrecordLines = new Hashtable<Long, ArrayList<Double>>();
        ArrayList oneline = new ArrayList();

        int[] channelNos = {channelHeader.ChannelNumber};

        double flowValue;
        setSystemAnalyzesSumMaxFlow(channelHeader.Max);

        do {
            mrecordLines = myDB.queryMeasurementRecordByOneLineWithRecordID(
                    channelHeader.Pref, channelNos, vc.queryStartID, vc.queryEndID);
            oneline = mrecordLines.get(channelHeader.Pref + channelNos[0]);
            len = oneline.size();

            for (int i = 0; i < len; i++) {
                flowValue = (Double) oneline.get(i);
                if (flowValue == myDB.INVALID_MEASUREMENT_VALUE || flowValue == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                    continue;
                }
                sumFlowRate += flowValue;
                sumConsumption += flowValue * flowRateRationToOneHour; //have some error ??
                numOfValidRecords++;

            }

            //doing========= end    
            vc.queryStartID = vc.queryEndID;
            if ((vc.queryEndID + oneTimeGetValues) >= vc.numOfSamples) {
                vc.queryEndID = (int) vc.numOfSamples;
            } else {
                vc.queryEndID = vc.queryEndID + this.oneTimeGetValues;
            }
            if (vc.queryEndID > vc.viewEndID) {
                vc.queryEndID = vc.viewEndID;
            }

            vc.currentPage++;

            if(mrecordLines != null){
                    mrecordLines.clear();

            }
            if(oneline != null){
                oneline.clear();

            }

        } while (vc.currentPage <= vc.totalPages);


        if (numOfValidRecords > 0) {
            setSystemAnalyzesSumAverageFlow(sumFlowRate / numOfValidRecords);              
        }

        setSystemAnalyzesSumTotalAirDelivery((long) sumConsumption);


        double yearRatio = getWork_hour_per_year() / validRecordTimeHours;
        setSystemAnalyzesSumTotalAirDeliveryOneYear((long) ((double) getSystemAnalyzesSumTotalAirDelivery() * yearRatio));

        // convert to the unit user select
        String airDeliveryUnit = this.getAir_delivery_unit();
        double flowUnitRatio = MeasurementUnit.RatioToM3PerHour(airDeliveryUnit)
                / MeasurementUnit.RatioToM3PerHour(air_delivery_unit);
        double consumptionUnitRatio = MeasurementUnit.RatioToM3BasedOnFlowUnit(airDeliveryUnit)
                / MeasurementUnit.RatioToM3BasedOnFlowUnit(air_delivery_unit);

        setSystemAnalyzesSumAverageFlow(getSystemAnalyzesSumAverageFlow() * flowUnitRatio);
        setSystemAnalyzesSumMaxFlow(getSystemAnalyzesSumMaxFlow() * flowUnitRatio);

        setSystemAnalyzesSumTotalAirDelivery((long) (getSystemAnalyzesSumTotalAirDelivery() * consumptionUnitRatio));

//        if (systemAnalyzesSumTotalAirDelivery > 0) {
//            systemAnalyzesSumSpecificPower = compressor.TotalEnergyConsumption / systemAnalyzesSumTotalAirDelivery;
//        }

        setSystemAnalyzesSumTotalAirDeliveryOneYear((long) (getSystemAnalyzesSumTotalAirDeliveryOneYear() * consumptionUnitRatio));

        if(mrecordLines != null){
            mrecordLines.clear();
            mrecordLines = null;
        }
        if(oneline != null){
            oneline.clear();
            oneline = null;
        }
        if(vc != null){
            vc = null;
        }

        return true;

    }

    /**
     * @return the systemAnalyzesSumTotalAirDeliveryOneYear
     */
    public long getSystemAnalyzesSumTotalAirDeliveryOneYear() {
        return systemAnalyzesSumTotalAirDeliveryOneYear;
    }

    /**
     * @param systemAnalyzesSumTotalAirDeliveryOneYear the systemAnalyzesSumTotalAirDeliveryOneYear to set
     */
    public void setSystemAnalyzesSumTotalAirDeliveryOneYear(long systemAnalyzesSumTotalAirDeliveryOneYear) {
        this.systemAnalyzesSumTotalAirDeliveryOneYear = systemAnalyzesSumTotalAirDeliveryOneYear;
    }

    /**
     * @return the systemAnalyzesSumTotalAirDelivery
     */
    public long getSystemAnalyzesSumTotalAirDelivery() {
        return systemAnalyzesSumTotalAirDelivery;
    }

    /**
     * @param systemAnalyzesSumTotalAirDelivery the systemAnalyzesSumTotalAirDelivery to set
     */
    public void setSystemAnalyzesSumTotalAirDelivery(long systemAnalyzesSumTotalAirDelivery) {
        this.systemAnalyzesSumTotalAirDelivery = systemAnalyzesSumTotalAirDelivery;
    }

    /**
     * @return the systemAnalyzesSumAverageFlow
     */
    public double getSystemAnalyzesSumAverageFlow() {
        return systemAnalyzesSumAverageFlow;
    }

    /**
     * @param systemAnalyzesSumAverageFlow the systemAnalyzesSumAverageFlow to set
     */
    public void setSystemAnalyzesSumAverageFlow(double systemAnalyzesSumAverageFlow) {
        this.systemAnalyzesSumAverageFlow = systemAnalyzesSumAverageFlow;
    }

    /**
     * @return the systemAnalyzesSumMaxFlow
     */
    public double getSystemAnalyzesSumMaxFlow() {
        return systemAnalyzesSumMaxFlow;
    }

    /**
     * @param systemAnalyzesSumMaxFlow the systemAnalyzesSumMaxFlow to set
     */
    public void setSystemAnalyzesSumMaxFlow(double systemAnalyzesSumMaxFlow) {
        this.systemAnalyzesSumMaxFlow = systemAnalyzesSumMaxFlow;
    }
    
    public void setSelectedFlowNChannelHeaders(ArrayList<ViewChannel> selectedVChannels) {
        if(selectedFlowNChannelHeaders == null){
              selectedFlowNChannelHeaders = new ArrayList<NChannelHeader>();       
        }else{
            selectedFlowNChannelHeaders.clear(); 
        }
     
        //set selectedNChannelHeaders
        if(selectedVChannels != null){
            for(ViewChannel vc : selectedVChannels){
                if(vc != null && vc.chheader != null){
                     if (MeasurementUnit.IsFlowRateUnit(vc.chheader.getUnitText())) {
                        NChannelHeader chheader = new NChannelHeader();
                        chheader.copy(vc.chheader);
                        selectedFlowNChannelHeaders.add(chheader);
                     }
                }
            }
        }
       
    }
}
