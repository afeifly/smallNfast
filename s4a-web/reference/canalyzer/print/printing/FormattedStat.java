/*
 * FormattedStat.java
 *
 * Created on April 13, 2007, 12:24 PM
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.print.printing;

import com.cs.canalyzer.structs.LeakStatistics;

/**
 * Added by Lewis on 2007.4.13
 * @author ll
 */
public class FormattedStat {
   
   private String startTime;
   private String endTime;
   
   // compressor statistics
   // compressor statistics -- measured / calculated data
   private String fullLoadHours = "";
   private String fullLoadPercentageMeasurementInterval = "";   // should be presented as percentage
   private String fullLoadEnergyConsumption = "";  // in kwh
   private String fullLoadEnergyCost = "";  //  in currency
   
   private String noLoadHours = "";
   private String noLoadPercentageMeasurementInterval = "";   // should be presented as percentage
   private String noLoadEnergyConsumption = "";  // in kwh
   private String noLoadEnergyCost = "";  //  in currency
   
   private String stopHours = "";
   private String stopPercentageMeasurementInterval = "";   // should be presented as percentage
   private String numOfLoadChanges = "";
   
   private String totalEnergyConsumption = "";  // in kwh
   private String totalCost = "";  // in currency
   
   // compressor statistics -- cumulated data for one year
   private String fullLoadHoursOneYear = "";
   private String noLoadHoursOneYear = "";
   private String stopHoursOneYear = "";
   private String numOfLoadChangesOneYear = "";
   
   private String fullLoadEnergyConsumptionOneYear = "";  // in kwh
   private String noLoadEnergyConsumptionOneYear = "";  // in kwh
   private String totalEnergyConsumptionOneYear = "";  // in kwh
   private String totalCostOneYear = "";  // in currency
   
   // system statistics
   private String totalAirConsumption = "";   // in m3
   private String airUnitCost = "";  // currency / m3
   private String averageFlow = "";  //  m3/h
   private String maxFlow = "";  // m3/h
   private String totalLeakage = "";   // m3
   private String averageLeakage = "";  // m3/h
   private String leakageRate = "";   // should be presented as percentage
   private String costOfLeakage = "";  // in currency
   private String maxPressure = "";  // bar
   private String minPressure = "";  // bar
   private String maxDewpoint = "";
   private String minDewpoint = "";
   public static final String H = " Hours";
   public static final String P = " %";
   public static final String DIFFERENT_UNITS = "<i>Different units</i>";
   
   private static final int HOUR_VALUE_RESOLUTION = 1;
   
   /** Creates a new instance of FormattedStat */
   public FormattedStat(LeakStatistics stat) {
      startTime = PrintManager.DATE_FORMAT.format(stat.getStartTime());
      endTime = PrintManager.DATE_FORMAT.format(stat.getEndTime());
      // Measured/calculated data
    /*  if (stat.currentDataUsed == true || stat.calculationType == stat.CALCULATION_BASED_ON_COMPRESSOR_SPEC) {
         fullLoadHours = PrintManager.formatFloat(stat.fullLoadHours, HOUR_VALUE_RESOLUTION) + H;
         fullLoadPercentageMeasurementInterval = PrintManager.
              round(stat.fullLoadPercentageMeasurementInterval * 100, 1) + P;
         fullLoadEnergyConsumption = PrintManager.formatFloat(stat.fullLoadEnergyConsumption) + " " + stat.UNIT_POWER_CONSUMPTION;
         fullLoadEnergyCost = PrintManager.formatFloat(stat.fullLoadEnergyCost) + " " + stat.currencyEnergyCost;
         noLoadHours = PrintManager.formatFloat(stat.noLoadHours, HOUR_VALUE_RESOLUTION) + H;
         noLoadPercentageMeasurementInterval = PrintManager.
              round(stat.noLoadPercentageMeasurementInterval * 100, 1) + P;
         noLoadEnergyConsumption = PrintManager.formatFloat(stat.noLoadEnergyConsumption) + " " + stat.UNIT_POWER_CONSUMPTION;
         noLoadEnergyCost = PrintManager.formatFloat(stat.noLoadEnergyCost) + " " + stat.currencyEnergyCost;
         totalEnergyConsumption = PrintManager.formatFloat(stat.totalEnergyConsumption) + " " + stat.UNIT_POWER_CONSUMPTION;
         totalEnergyConsumptionOneYear = PrintManager.formatFloat(stat.totalEnergyConsumptionOneYear) + " " + stat.UNIT_POWER_CONSUMPTION;
      }
     if ( stat.currentDataUsed == true && stat.calculationType != stat.CALCULATION_BASED_ON_COMPRESSOR_SPEC ) {
         stopHours = PrintManager.formatFloat(stat.stopHours, HOUR_VALUE_RESOLUTION) + H;
         stopPercentageMeasurementInterval = PrintManager.
              round(stat.stopPercentageMeasurementInterval * 100, 1) + P;
         numOfLoadChanges = stat.numOfLoadChanges + "";
      }*///delete by be
      totalCost = PrintManager.formatFloat(stat.totalCost) + " " + stat.currencyEnergyCost;
      // Cumulated data for one year
    /*  if ( stat.currentDataUsed == true || stat.calculationType == stat.CALCULATION_BASED_ON_COMPRESSOR_SPEC ) {
         fullLoadHoursOneYear = PrintManager.formatFloat(stat.fullLoadHoursOneYear, HOUR_VALUE_RESOLUTION) + H;
         noLoadHoursOneYear = PrintManager.formatFloat(stat.noLoadHoursOneYear, HOUR_VALUE_RESOLUTION) + H;
         fullLoadEnergyConsumptionOneYear = PrintManager.formatFloat(stat.fullLoadEnergyConsumptionOneYear) + " " + stat.UNIT_POWER_CONSUMPTION;
         noLoadEnergyConsumptionOneYear = PrintManager.formatFloat(stat.noLoadEnergyConsumptionOneYear) + " " + stat.UNIT_POWER_CONSUMPTION;
      }*///delete by be
     totalCostOneYear = PrintManager.formatFloat(stat.totalCostOneYear) + " " + stat.currencyEnergyCost;
     /* if ( stat.currentDataUsed == true  && stat.calculationType != stat.CALCULATION_BASED_ON_COMPRESSOR_SPEC ) {
         stopHoursOneYear = PrintManager.formatFloat(stat.stopHoursOneYear, HOUR_VALUE_RESOLUTION) + H;
         numOfLoadChangesOneYear = PrintManager.formatFloat(stat.numOfLoadChangesOneYear);
      }*/ //delete by be
     
      // System statistics
      if (stat.flowDataUsed == true) {
         totalAirConsumption = PrintManager.formatInteger(stat.totalAirConsumption) + " " + stat.airConsumptionUnit;
         airUnitCost = PrintManager.round(stat.airUnitCost, 4) + " " + stat.currencyEnergyCost + "/" + stat.airConsumptionUnit;
         //airUnitCost = PrintManager.round(12345.125f, 2) + " " + stat.currencyEnergyCost + "/" + stat.airConsumptionUnit;
         averageFlow = PrintManager.formatFloat(stat.averageFlow) + " " + stat.flowUnit;
         maxFlow = PrintManager.formatFloat(stat.maxFlow) + " " + stat.flowUnit;
         if ( stat.getLeakageThreshold() > 0 ) {
             totalLeakage = PrintManager.formatInteger(stat.totalLeakage) + " " + stat.airConsumptionUnit;
             averageLeakage = PrintManager.formatFloat(stat.averageLeakage) + " " + stat.flowUnit;
             leakageRate = PrintManager.round(stat.leakageRate * 100, 1) + P;
             costOfLeakage = PrintManager.formatFloat(stat.costOfLeakage) + " " + stat.currencyEnergyCost;
         }
      }
      if (stat.pressureDataUsed == true) {
         maxPressure = processPressureOrDewpoint(stat.maxPressure, 2, stat.pressureUnit);
         minPressure = processPressureOrDewpoint(stat.minPressure, 2, stat.pressureUnit);
      }
      if (stat.dewpointDataUsed == true) {
         maxDewpoint = processPressureOrDewpoint(stat.maxDewpoint, 1, stat.dewpointUnit);
         minDewpoint = processPressureOrDewpoint(stat.minDewpoint, 1, stat.dewpointUnit);
      }
   }
   
   private String processPressureOrDewpoint(double value, int precision, String unit) {
      if (value == LeakStatistics.MAX_OR_MIN_VALUE_INDICATING_DIFFERENT_UNIT) {
         return DIFFERENT_UNITS;
      } else {
         return PrintManager.round(value, precision) + " " + unit;
      }
   }
   
   public String getStartTime() {
      return startTime;
   }
   
   public String getEndTime() {
      return endTime;
   }
   
   public String getFullLoadHours() {
      return fullLoadHours;
   }
   
   public String getFullLoadPercentageMeasurementInterval() {
      return fullLoadPercentageMeasurementInterval;
   }
   
   public String getFullLoadEnergyConsumption() {
      return fullLoadEnergyConsumption;
   }
   
   public String getFullLoadEnergyCost() {
      return fullLoadEnergyCost;
   }
   
   public String getNoLoadHours() {
      return noLoadHours;
   }
   
   public String getNoLoadPercentageMeasurementInterval() {
      return noLoadPercentageMeasurementInterval;
   }
   
   public String getNoLoadEnergyConsumption() {
      return noLoadEnergyConsumption;
   }
   
   public String getNoLoadEnergyCost() {
      return noLoadEnergyCost;
   }
   
   public String getStopHours() {
      return stopHours;
   }
   
   public String getStopPercentageMeasurementInterval() {
      return stopPercentageMeasurementInterval;
   }
   
   public String getNumOfLoadChanges() {
      return numOfLoadChanges;
   }
   
   public String getTotalEnergyConsumption() {
      return totalEnergyConsumption;
   }
   
   public String getTotalCost() {
      return totalCost;
   }
   
   public String getFullLoadHoursOneYear() {
      return fullLoadHoursOneYear;
   }
   
   public String getNoLoadHoursOneYear() {
      return noLoadHoursOneYear;
   }
   
   public String getStopHoursOneYear() {
      return stopHoursOneYear;
   }
   
   public String getNumOfLoadChangesOneYear() {
      return numOfLoadChangesOneYear;
   }
   
   public String getFullLoadEnergyConsumptionOneYear() {
      return fullLoadEnergyConsumptionOneYear;
   }
   
   public String getNoLoadEnergyConsumptionOneYear() {
      return noLoadEnergyConsumptionOneYear;
   }
   
   public String getTotalEnergyConsumptionOneYear() {
      return totalEnergyConsumptionOneYear;
   }
   
   public String getTotalCostOneYear() {
      return totalCostOneYear;
   }
   
   public String getTotalAirConsumption() {
      return totalAirConsumption;
   }
   
   public String getAirUnitCost() {
      return airUnitCost;
   }
   
   public String getAverageFlow() {
      return averageFlow;
   }
   
   public String getMaxFlow() {
      return maxFlow;
   }
   
   public String getTotalLeakage() {
      return totalLeakage;
   }
   
   public String getAverageLeakage() {
      return averageLeakage;
   }
   
   public String getLeakageRate() {
      return leakageRate;
   }
   
   public String getCostOfLeakage() {
      return costOfLeakage;
   }
   
   public String getMaxPressure() {
      return maxPressure;
   }
   
   public String getMinPressure() {
      return minPressure;
   }
   
   public String getMaxDewpoint() {
      return maxDewpoint;
   }
   
   public String getMinDewpoint() {
      return minDewpoint;
   }
}
