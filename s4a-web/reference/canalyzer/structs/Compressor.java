/*
 * Compressor.java
 *
 * Created on 2008年8月20日, 下午12:00
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.structs;

import com.cs.database.NChannelHeader;
import java.io.Serializable;

/**
 *
 * @author wolf
 */
public class Compressor implements Serializable, Cloneable {
    
    private static final long serialVersionUID = 5288281721040277389L;
    
    /** Creates a new instance of Compressor */
    public Compressor() {
        initVFVariables();
    }
    
    public void resetStatisticsValues() {
       FullLoadHours = 0;
       FullLoadPercentageMeasurementInterval = 0;   // should be presented as percentage
       FullLoadEnergyConsumption = 0;  // in kwh
       FullLoadEnergyCost = 0;  //  in currency

       UnLoadHours = 0;
       UnLoadPercentageMeasurementInterval = 0;   // should be presented as percentage
       UnLoadEnergyConsumption = 0;  // in kwh
       UnLoadEnergyCost = 0;  //  in currency

       NoLoadHours = 0;
       NoLoadPercentageMeasurementInterval = 0;   // should be presented as percentage
       NoLoadEnergyConsumption = 0;  // in kwh
       NoLoadEnergyCost = 0;  //  in currency

       NumOfLoadChanges = 0;
       
       TotalHours = 0;
       TotalEnergyConsumption = 0;  // in kwh
       TotalCost = 0;  // in currency

       TotalAirDeliveryAmount = 0; 
       MaxFlow = 0;
       MinFlow = 0;
       AverageFlow = 0;
       AirUnitCost = 0;
       
       TotalLeakage = 0;
       LeakageRate = 0;
       LeakageCost = 0;
       AverageLeakage = 0;

       //add on 20091225.
       //reason : Wolfgang Blessing,Michael Kromer test result : numofloadchange is not number of load/unload cycles value.
       //mothed : create number of load/unload cycles field.
       NumOfLoad_UnloadChanges = 0;
       NumOfLoad_UnloadChangesOneYear = 0;
    
       // compressor statistics -- cumulated data for one year
       FullLoadHoursOneYear = 0;
       NoLoadHoursOneYear = 0;
       UnLoadHoursOneYear = 0;
       NumOfLoadChangesOneYear = 0;
       
       FullLoadEnergyConsumptionOneYear = 0;  // in kwh
       UnLoadEnergyConsumptionOneYear = 0;  // in kwh
       NoLoadEnergyConsumptionOneYear = 0;  // in kwh
       TotalEnergyConsumptionOneYear = 0;  // in kwh
       TotalCostOneYear = 0;  // in currency
       FullLoadEnergyCostOneYear = 0;
       UnLoadEnergyCostOneYear = 0;
       
       LeakageCostOneYear = 0;  // in currency
       TotalLeakageOneYear = 0;
       TotalAirDeliveryAmountOneYear = 0; //
       
       CO2Emmision = 0;
       CO2EmmisionOneYear = 0;

       //v3-1&6 ,20091014 be.
       NumStarts = 0;
       SpecificPower = 0;

    }
    
    private final String DEFAULT_MEASUREMENT_UNIT = "A";
    private final String DEFAULT_CURRENCY = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Euro");
    private final double DEFAULT_CURRENT_VALUE = 0;
    private final double DEFAULT_CURRENT_THRESHOLD = 0;
    private final String DEFAULT_AIR_DELIVERY_UNIT = "m" + (char) 179 + "/h";
    private final String DEFAULT_DESCRIPTION = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Standard_compressor");
    
    public final static String[] COMPRESS_TYPE_TEXT = { java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Load/Unload"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Variable_Frequency") };
    public final static int COMPRESSOR_TYPE_LOAD_UNLOAD = 0;
    public final static int COMPRESSOR_TYPE_VARIABLE_FREQUENCY = 1;
    
    public final static double DEFAULT_AIR_DELIVERY = 0;
    public final static double DEFAULT_COSP_PARAMETER = 0;
    public final static double DEFAULT_FULL_LOAD_COSP = 0.86;
    public final static double DEFAULT_UN_LOAD_COSP = 0.5;
    public final static double DEFAULT_SUPPLY_VOTAGE = 400;
    public final static double DEFAULT_ENERGY_COST_PER_KWH = 0.1;
    public final static double DEFAULT_CO2_EMMISION_PER_KWH = 0.55;

    //v3-6, 20091014 be
    private final String DEFAULT_SPECIFIC_POWER_UNIT = "kwh/"+"m" + (char) 179 ;
    
    /** note: status definition should be corresponding to compressor type */
//    public final static String STATUS_STRING[][] = {{"Full load", "Unload", "Stop", "OK"},
//                                                    {"Max load", "Min load", "No load", "OK"}};
//    public final int STATUS_FULL_LOAD = 0;
//    public final int STATUS_UN_LOAD = 1;
//    public final int STATUS_STOP = 2;
//    public final int STATUS_MAX_LOAD = 0;
//    public final int STATUS_MIN_LOAD = 1;
//    public final int STATUS_NO_LOAD = 2;
//    public final int STATUS_OK = 3;
    public final static String STATUS_STRING[][] = {{java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Not_Ready"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("OK")},
                                                    {java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Not_Ready"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("OK")}};
    public final static int STATUS_NOT_READY = 0;
    public final static int STATUS_OK = 1;
    
    
    /** A copy of this object. Return null when fail.
     */ 
    public Compressor clone() {
        try {
            return (Compressor) super.clone();
        } catch ( Exception e ) {
            return null;
        }
    }
    
    public boolean setStatus( int status ) {
        if ( status < 0 || status >= STATUS_STRING.length )
            return false;
        
        Status = status;
        return true;
    }
    public int getStatus() {
        return Status;
    }
    public String getStatusString() {
        return STATUS_STRING[Type][Status];
    }
    
    public boolean setAssignedFlowChannel( NChannelHeader chheader ) {
        if ( chheader == null ) {
            AssignedFlowChannel = null;
        } else if ( !MeasurementUnit.IsFlowRateUnit( chheader.getUnitText() )) {
            return false;
        } else {
            AssignedFlowChannel = new NChannelHeader();
            AssignedFlowChannel.copy( chheader );
        }
        
        return true;
    }
    public NChannelHeader getAssignedFlowChannel() {
        return AssignedFlowChannel;
    }
    
    public boolean setCurrentChanel( NChannelHeader chheader ) {
        if ( chheader == null || !MeasurementUnit.IsCurrentUnit( chheader.getUnitText() )) {
            return false;
        }
        CurrentChannel = new NChannelHeader();
        CurrentChannel.copy( chheader );
        return true;
    }
    public NChannelHeader getCurrentChanel() {
        return CurrentChannel;
    }

    public double getSupplyVoltage() {
        return SupplyVoltage;
    }
    
    /**
     * Must use a >0 value otherwise fail. It'll also trigger re-calculation of VF variables.
     */
    public boolean setSupplyVoltage( double voltage ) {
        if ( voltage <= 0 ) return false;
        
        SupplyVoltage = voltage;
        calculateVFAmpAndLinearCoefficiency();
        return true;
    }
    
    //*************************
    
       // compressor statistics -- measured / calculated data
       public double FullLoadHours;
       public double FullLoadPercentageMeasurementInterval;   // should be presented as percentage
       public double FullLoadEnergyConsumption;  // in kwh
       public double FullLoadEnergyCost;  //  in currency

       public double UnLoadHours;
       public double UnLoadPercentageMeasurementInterval;   // should be presented as percentage
       public double UnLoadEnergyConsumption;  // in kwh
       public double UnLoadEnergyCost;  //  in currency

       public double NoLoadHours;
       public double NoLoadPercentageMeasurementInterval;   // should be presented as percentage
       public double NoLoadEnergyConsumption;  // in kwh
       public double NoLoadEnergyCost;  //  in currency

       public int NumOfLoadChanges;
       //add on 20091223.
       //reason : Wolfgang Blessing,Michael Kromer test result : numofloadchange is not number of load/unload cycles value.
       //mothed : create number of load/unload cycles field.
       public int NumOfLoad_UnloadChanges;
       public double NumOfLoad_UnloadChangesOneYear;

       public double TotalHours;
       public double TotalEnergyConsumption;  // in kwh
       public double TotalCost;  // in currency

       public long TotalAirDeliveryAmount; 
       public double MaxFlow;
       public double MinFlow;
       public double AverageFlow;
       public double AirUnitCost;
       
       public long TotalLeakage;
       public double LeakageRate;
       public double LeakageCost;
       public double AverageLeakage;
    
       // compressor statistics -- cumulated data for one year
       public double FullLoadHoursOneYear;
       public double NoLoadHoursOneYear;
       public double UnLoadHoursOneYear;
       public double NumOfLoadChangesOneYear;
       
       public double FullLoadEnergyConsumptionOneYear;  // in kwh
       public double UnLoadEnergyConsumptionOneYear;  // in kwh
       public double NoLoadEnergyConsumptionOneYear;  // in kwh
       public double TotalEnergyConsumptionOneYear;  // in kwh
       public double TotalCostOneYear;  // in currency
       public double FullLoadEnergyCostOneYear;
       public double UnLoadEnergyCostOneYear;
       public double NoLoadEnergyCostOneYear;
       
       public double LeakageCostOneYear;  // in currency
       public long TotalLeakageOneYear;
       public long TotalAirDeliveryAmountOneYear; //
       
       public double CO2Emmision;
       public double CO2EmmisionOneYear;

       //v3-1&6 ,20091014 be.
       public int NumStarts;//number of compressor starts of each compressor
       public double NumStartsOneYear;//number of compressor starts of each compressor
       public double SpecificPower;//specific power=total energy consumption divided by total air delivery (unit is kwh/m3)
      
   //************************* 

    //v3-6 ,20091014 be.
    public String SpecificPowerUnit = DEFAULT_SPECIFIC_POWER_UNIT;  //specific power's unit -- kwh/m3.
       
    public int Type = COMPRESSOR_TYPE_LOAD_UNLOAD;
    
    public double CosP = 0.85f;
    public double FullLoadCurrent = DEFAULT_CURRENT_VALUE;
    public double UnLoadCurrent = DEFAULT_CURRENT_VALUE;
    public double NoLoadCurrent = DEFAULT_CURRENT_VALUE;
    
    public double FullLoadCosP = DEFAULT_COSP_PARAMETER;
    public double UnLoadCosP = DEFAULT_COSP_PARAMETER;
    public double NoLoadCosP = DEFAULT_COSP_PARAMETER;
    
    public double FullLoadCurrentThreshold = DEFAULT_CURRENT_THRESHOLD;
    public double UnLoadCurrentThreshold = DEFAULT_CURRENT_THRESHOLD;
    public double NoLoadCurrentThreshold = DEFAULT_CURRENT_THRESHOLD;
    
    public double FullLoadAirDelivery = DEFAULT_AIR_DELIVERY;
    public double UnLoadAirDelivery = DEFAULT_AIR_DELIVERY;
    public double NoLoadAirDelivery = DEFAULT_AIR_DELIVERY; 
    public String AirDeliveryUnit = DEFAULT_AIR_DELIVERY_UNIT;
    // below will be calculated once air delivery parameters are set
    public double MaxAirDelivery = DEFAULT_AIR_DELIVERY;
    public double MinAirDelivery = DEFAULT_AIR_DELIVERY;
    
    public double CosPRatio = 1;
    public double CosPA0 = 0;
    
    private int Status = STATUS_OK;
    
    public boolean Selected = true;
    
    private double SupplyVoltage = DEFAULT_SUPPLY_VOTAGE; // in 'V'
    
    public String Unit = DEFAULT_MEASUREMENT_UNIT; // always 'A'
    private NChannelHeader CurrentChannel; // the current channel header that it links to
    private NChannelHeader AssignedFlowChannel;
    
    public String Description = DEFAULT_DESCRIPTION;
    
//    public double EnergyCostPerKwh = DEFAULT_ENERGY_COST_PER_KWH;

    //public String Currency = DEFAULT_CURRENCY;
    public double CO2EmmisionPerKWh = DEFAULT_CO2_EMMISION_PER_KWH;
    
    // ******************** Variable Frequency type of compressor section. *******************
    public double VFMotorPower; // in kW
    public double VFSystemPressure;  // in Pa
    public double VFPowerMin, VFPowerP2, VFPowerP3, VFPowerMax; // in kW
    public double VFAirDeliveryMin, VFAirDeliveryP2, VFAirDeliveryP3, VFAirDeliveryMax; // in m3/min
    public double VFAmpMin, VFAmpP2, VFAmpP3, VFAmpMax;  // in A
    public double VFLinearCoefficientP2Min, VFLinearCoefficientP3P2, VFLinearCoefficientMaxP3;
    public double VFLinearCoefficientP2MinA0, VFLinearCoefficientP3P2A0, VFLinearCoefficientMaxP3A0;
    public String VFAirDeliveryUnit = VFConst.AIR_DELIVERY_UNIT; // could be different than compressor's air delivery unit selected by user
    public double VFCosPhi = VFConst.COSPHI;
    public boolean VFParameterSet = false;  // if the VF parameter is set
    
    private void initVFVariables() {
        int index = 0;
        VFMotorPower = VFConst.MOTOR_POWER_LIST[index];
        VFSystemPressure = VFConst.SYSTEM_PRESSURE_LIST[index];
        VFPowerMin = VFConst.POWER_LIST[index][index][VFConst.INDEX_MIN];
        VFPowerP2 = VFConst.POWER_LIST[index][index][VFConst.INDEX_P2];
        VFPowerP3 = VFConst.POWER_LIST[index][index][VFConst.INDEX_P3];
        VFPowerMax = VFConst.POWER_LIST[index][index][VFConst.INDEX_MAX];
        VFAirDeliveryMin = VFConst.AIR_DELIVERY_LIST[index][index][VFConst.INDEX_MIN];
        VFAirDeliveryP2 = VFConst.AIR_DELIVERY_LIST[index][index][VFConst.INDEX_P2];
        VFAirDeliveryP3 = VFConst.AIR_DELIVERY_LIST[index][index][VFConst.INDEX_P3];
        VFAirDeliveryMax = VFConst.AIR_DELIVERY_LIST[index][index][VFConst.INDEX_MAX];
        
        calculateVFAmpAndLinearCoefficiency();
    }
    
    public void calculateVFAmpAndLinearCoefficiency() {
        // the amp values: I = P / (SQRT(3) x U x cos Phi). For this compressor cos phi is fixed to 0.96.
        VFAmpMin = VFPowerMin * 1000 / ( Math.sqrt(3) * SupplyVoltage * VFCosPhi );
        VFAmpP2 = VFPowerP2 * 1000 / ( Math.sqrt(3) * SupplyVoltage * VFCosPhi );
        VFAmpP3 = VFPowerP3 * 1000 / ( Math.sqrt(3) * SupplyVoltage * VFCosPhi );
        VFAmpMax = VFPowerMax * 1000 / ( Math.sqrt(3) * SupplyVoltage * VFCosPhi );
        VFLinearCoefficientP2Min = ( VFAirDeliveryP2 - VFAirDeliveryMin ) / ( VFAmpP2 - VFAmpMin );
        VFLinearCoefficientP3P2 = ( VFAirDeliveryP3 - VFAirDeliveryP2 ) / ( VFAmpP3 - VFAmpP2 );
        VFLinearCoefficientMaxP3 = ( VFAirDeliveryMax - VFAirDeliveryP3 ) / ( VFAmpMax - VFAmpP3 );
        VFLinearCoefficientP2MinA0 = VFAirDeliveryP2 - VFAmpP2 * VFLinearCoefficientP2Min;
        VFLinearCoefficientP3P2A0 = VFAirDeliveryP3 - VFAmpP3 * VFLinearCoefficientP3P2;
        VFLinearCoefficientMaxP3A0 = VFAirDeliveryMax - VFAmpMax * VFLinearCoefficientMaxP3;
    }
    
    // ***************** end of variable frequency compressor section ********************
    
    //added on 20130510,be ------------- begin
    private double yearRatio;
    private NChannelHeader assignedPowerChannel = null ;
    private boolean hasPowerChannel = false;
    public boolean assignedPowerChannel( NChannelHeader chheader ) {
        if ( chheader == null ) {
        	assignedPowerChannel = null;
        } else {          
        	assignedPowerChannel = new NChannelHeader();
        	assignedPowerChannel.copy( chheader );
        	hasPowerChannel = true;
        }
        
        return true;
    }
    
    public NChannelHeader getAssignedPowerChannel(){
    	return assignedPowerChannel;
    }
    
    public boolean hasPowerChannel(){
        return hasPowerChannel;
    }
    
    /**
     * calculate linear coefficiency when assiged power channel to this compressor
     */
    public void calculateVFLinearCoefficiency() {
      
        VFLinearCoefficientP2Min = ( VFAirDeliveryP2 - VFAirDeliveryMin ) / ( VFPowerP2 - VFPowerMin );
        VFLinearCoefficientP3P2 = ( VFAirDeliveryP3 - VFAirDeliveryP2 ) / ( VFPowerP3 - VFPowerP2 );
        VFLinearCoefficientMaxP3 = ( VFAirDeliveryMax - VFAirDeliveryP3 ) / ( VFPowerMax - VFPowerP3 );
        VFLinearCoefficientP2MinA0 = VFAirDeliveryP2 - VFPowerP2 * VFLinearCoefficientP2Min;
        VFLinearCoefficientP3P2A0 = VFAirDeliveryP3 - VFPowerP3 * VFLinearCoefficientP3P2;
        VFLinearCoefficientMaxP3A0 = VFAirDeliveryMax - VFPowerMax * VFLinearCoefficientMaxP3;
    }

    /**
     * @return the yearRatio
     */
    public double getYearRatio() {
        return yearRatio;
    }

    /**
     * @param yearRatio the yearRatio to set
     */
    public void setYearRatio(double yearRatio) {
        this.yearRatio = yearRatio;
    }
   //added on 20130510,be ------------- end
}
