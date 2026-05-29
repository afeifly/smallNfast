/*
 * StatisticsRenderer.java
 *
 * Created on January 31, 2008, 5:54 PM
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.print.printing;

import com.cs.canalyzer.structs.LeakStatistics;
import com.cs.database.CSMDF;
import java.awt.Frame;
import javax.swing.JFrame;

/**
 *
 * @author ll
 */
public class StatisticsRenderer {
   private FormattedStat stat;
   private String renderedText;
   private StatisticsDialog dialog;
   private static final int CELL_TYPE_HEADER = 0;
   private static final int CELL_TYPE_BODY = 1;
   
   public static void main(String[] args) {
      JFrame frame = new JFrame(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Test_frame"));
      frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
      frame.setLocationRelativeTo(null);
      frame.setVisible(true);
      new StatisticsRenderer(frame, true, new LeakStatistics(new CSMDF())).showDialog();
   }
    
   /**
    * Creates a new instance of StatisticsRenderer
    */
   public StatisticsRenderer(Frame parent, boolean modal, LeakStatistics stat) {
      this.stat = new FormattedStat(stat);
      renderedText = createRenderedText();
      dialog = new StatisticsDialog(parent, modal, renderedText);
   }
   
   public void showDialog() {
      dialog.setVisible(true);
   }
   public StatisticsDialog getDialog() {
      return dialog;
   }
   /**
    * <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
    * <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" dir="ltr">
    * <head>
    * <meta http-equiv="Content-Type" content="text/html; charset=gb2312" />
    * <meta http-equiv="Content-Language" content="zh-CN" />
    * <title>CSS list-style ???? -- CSS??</title>
    * </head>
    */
   protected String createRenderedText() {
      return
           "<html><head><title>" + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Statistics_Report") + "</title></head>" +
           "<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\" />" +
           "<body>" +
           "<h1 align=center><font face=arial>" + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Statistics_Report") + "</font></h1><br>" +
           createAllBodyText() +
           "</body></html>";
   }
   
   private String createAllBodyText() {
      String tableContents =
           createSingleCellRow(5, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Measurement_records_are_from_") + stat.getStartTime() + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("_to_") + stat.getEndTime()) +
           createRow("") +
           createSingleCellRow(5, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Compressor_statistics:")) +
           createRow("") +
           
           createSpecialRow(setBold(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Measured_/_calculated_data:"))) +
           createRow(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Full_Load:"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Time"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("%_of_measured_interval"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Energy_consumption"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Cost")) +
           createRow("", stat.getFullLoadHours(), stat.getFullLoadPercentageMeasurementInterval(),
           stat.getFullLoadEnergyConsumption(), stat.getFullLoadEnergyCost()) +
           createRow("") +
           createRow(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Non_load:"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Time"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("%_of_measured_interval"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Energy_consumption"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Cost")) +
           createRow("", stat.getNoLoadHours(), stat.getNoLoadPercentageMeasurementInterval(),
           stat.getNoLoadEnergyConsumption(), stat.getNoLoadEnergyCost()) +
           createRow("") +
           createRow(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Stop:"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Time"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("%_of_measured_interval"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Number_of_load_changes")) +
           createRow("", stat.getStopHours(), stat.getStopPercentageMeasurementInterval(),
           stat.getNumOfLoadChanges()) +
           createRow("") +
           createSpecialRow(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Total_engergy_consumption"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Cost")) +
           createSpecialRow(stat.getTotalEnergyConsumption(), stat.getTotalCost()) +
           
           createRow("") +
           createSpecialRow(setBold(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Cumulated_data_for_one_year:"))) +
           createSpecialRow(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Full_load_time"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("No_load_time"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Stop_time"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Number_of_load_changes")) +
           createSpecialRow(stat.getFullLoadHoursOneYear(), stat.getNoLoadHoursOneYear(),
           stat.getStopHoursOneYear(), stat.getNumOfLoadChangesOneYear()) +
           createRow("") +
           createSpecialRow(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Energy_consumption_full_load"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Energy_consumption_non_load"),
           java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Total_energy_consumption"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Total_energy_costs")) +
           createSpecialRow(stat.getFullLoadEnergyConsumptionOneYear(), stat.getNoLoadEnergyConsumptionOneYear(),
           stat.getTotalEnergyConsumptionOneYear(), stat.getTotalCostOneYear()) +
           
           createRow("") +
           createSingleCellRow(5, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("System_statistics:")) +
           createRow("") +
           createSpecialRow(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Total_air_consumption"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Unit_costs"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Average_flow"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Max_flow")) +
           createSpecialRow(stat.getTotalAirConsumption(), stat.getAirUnitCost(),
           stat.getAverageFlow(), stat.getMaxFlow()) +
           createRow("") +
           createSpecialRow(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Total_leakage"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Average_leakage"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Leakage_rate"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Cost_of_leakage")) +
           createSpecialRow(stat.getTotalLeakage(), stat.getAverageLeakage(),
           stat.getLeakageRate(), stat.getCostOfLeakage()) +
           createRow("") +
           createSpecialRow(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Max_pressure"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Min_pressure")) +
           createSpecialRow(stat.getMaxPressure(), stat.getMinPressure()) +
           createRow("") +
           createSpecialRow(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Max_dewpoint"), java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Min_dewpoint")) +
           createSpecialRow(stat.getMaxDewpoint(), stat.getMinDewpoint());
      
      //return createList(contents, createTable(tableContents));
      return createTable(tableContents);
   }
   
   private String setBold(String text) {
      return "<b>" + text + "</b>";
   }
   private String createList(Object... rows) {
      String contents = "";
      for (Object row : rows) {
         contents += "<li>" + row + "</li>";
      }
      return "<ul>" + contents + "</ul>";
   }
   private String createTable(String contents) {
      return "<table width=100% border=0 cellpadding=0>" + contents + "</table>";
   }
   /** create a row with a single cell spanning colSpan columns. all text will be bold. */
   private String createSingleCellRow(int colSpan, String cell) {
      return "<tr><td colspan=" + colSpan + ">" + setBold(cell) + "<br><td></tr>";
   }
   /** create a row whose 2nd cell span 2 columns */
   private String createSpecialRow(Object... cells) {
      String row = "<tr><td width = 4%></td>";
      for (int i = 0; i < cells.length; i++) {
         if (i == 0) {
            row += "<td colspan=2>" + cells[i] + "</td>";
         } else {
            row += "<td>" + cells[i] + "</td>";
         }
      }
      return  row;
   }
   private String createRow(Object... cells) {
      return createAnyRow(CELL_TYPE_BODY, cells);
   }
   private String createAnyRow(int cellType, Object... cells) {
      String row = "<tr>";
      String cellTag;
      if (cellType == CELL_TYPE_HEADER) {
         cellTag = "<th align=left>";
      } else {
         cellTag = "<td>";
      }
      String cellTagEnd = "</" + cellTag.substring(1, 3) + ">";
      
      row += cellTag.substring(0, 3) + " width=4%>" + cellTagEnd; // right-shift every row
      for (Object cell : cells) {
         row += cellTag + cell + cellTagEnd;
      }
      
      return row + "</tr>";
   }
}
