/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.cs.canalyzer.gui;

import com.cs.canalyzer.structs.CommonValue;
import com.cs.canalyzer.structs.Compressor;
import com.cs.canalyzer.structs.LeakStatistics;
import com.cs.canalyzer.structs.MeasurementUnit;
import java.awt.Color;
import java.awt.Component;
import java.awt.Point;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.Vector;
import javax.swing.JLabel;
import javax.swing.JTable;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.DefaultTableModel;
import javax.swing.table.TableCellRenderer;
import javax.swing.table.TableColumn;
import javax.swing.table.TableColumnModel;

public class JTablePanel {
    private ArrayList<Compressor> myCompressors;
    private static int TABLE_PAGE_COMPRESSOR_COUNT = 4;
    private final String FORMAT_STRING_0_DIGIT = "%15.0f";
    private final String FORMAT_STRING_1_DIGIT = "%10.1f";
    private final String FORMAT_STRING_2_DIGIT = "%10.2f";
    private final String FORMAT_STRING_3_DIGIT = "%10.3f";
    private final String FORMAT_STRING_4_DIGIT = "%15.4f";
    private final String FORMAT_STRING_LONG = "%15d";
    private final String FORMAT_STRING_INT = "%10d";
    private final String TIME_UINT = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("__Hours");

    private final static char CUBIC_ASCII = 179;

    private static int TABLE_COL_DIST = 10;
    private LeakStatistics theLeakStat;

    private String strCostUnit;
    private String strEnergyUnit;
    private String strAirDeliveryUnit;
    private String strLeakageUnit;
    private String strCo2EmissionUnit;
    private String strTimeUnit;
    private JTableFields mySystemTalbeFields ;
    //modify on 20091222.
    //reason : Wolfgang Blessing, Michael Kromer requirement : If leakage line is not set by user,
    //         the value in the table for the leakages should not be zero. It should the either "---"
    //         or the lines should completety disappear.
    //method : show "---" when it is zero.
    private String ZERO_LEAKAGE_STRING = "---";
    private double averageFlowDiviedMum = 0;
    /** Creates new form JTablePanel */
    public JTablePanel(CommonValue commonValue) {
         this.myCompressors = commonValue.getLeakStatistics().getCompressors();
         theLeakStat=commonValue.getLeakStatistics();
         strCostUnit = theLeakStat.currencyEnergyCost;
         strEnergyUnit = "kwh";
         strTimeUnit = TIME_UINT;
         strAirDeliveryUnit = theLeakStat.getAir_delivery_unit() ;
//         * MeasurementUnit.RatioToM3BasedOnFlowUnit( compressor.AirDeliveryUnit )
          if ( strAirDeliveryUnit.indexOf( "/" ) > 0 ){
            strLeakageUnit = strAirDeliveryUnit.substring( 0, strAirDeliveryUnit.indexOf( "/" ));
           // System.out.println("strAirDeliveryUnit.substring(strAirDeliveryUnit.indexOf( / )).trim()="+strAirDeliveryUnit.substring(strAirDeliveryUnit.indexOf( "/" )).trim());
            int index = strAirDeliveryUnit.indexOf( "/" ) +1;
            if("h".equals(strAirDeliveryUnit.substring(index).trim())
                    || "H".equals(strAirDeliveryUnit.substring(index).trim())){
                averageFlowDiviedMum = 1;
            }else if("s".equals(strAirDeliveryUnit.substring(index).trim())
                    || "S".equals(strAirDeliveryUnit.substring(index).trim())){
                averageFlowDiviedMum = 3600;
            }else{
                 averageFlowDiviedMum = 60;
            }
          }else{
              strLeakageUnit = "ft" + CUBIC_ASCII ;
              averageFlowDiviedMum = 60;
          }


         strCo2EmissionUnit = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("kg");
         commonValue.setStatisticsTables(initTable());
    }

   public ArrayList<JTable> initTable(){       
       ArrayList<JTable> tables = new ArrayList();
       //compressors column
      // Vector collist = setCompressorAnalyzeCols(myCompressors);
       Vector collist = setResults();
       int len = collist.size();
       int tablecompressorconut = TABLE_PAGE_COMPRESSOR_COUNT;
       int sumpages = 0;
       if(tablecompressorconut != 0){   
           if(len%tablecompressorconut == 0){
               sumpages = len/tablecompressorconut;
           }else{
               sumpages = len/tablecompressorconut + 1;
           }
       }else{
           sumpages = 1;
       }
       int pagenum = 0;

       for(int j=0;j<sumpages;j++){
          pagenum = j + 1;
          DefaultTableModel model = initModelProperty();
          int endindex = pagenum*tablecompressorconut;
          int startindex = (pagenum-1)*tablecompressorconut;
          if(endindex > len){
              endindex = len;
          }
          for(int i=startindex;i<endindex;i++){
              model.addColumn("", (Vector)collist.get(i));
              if(endindex != (i+1)){
                   model.addColumn("", new Vector());
              }             
          }
         
          
          tables.add(j,setTableProperty(model));

       }

      //set Legend, MK's requirement. add on 20100513.
       if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
            final String ToolTipText = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString(
                    PropertyUtil.isIRLogoType()?"Statistic_Table_Line31_59_Legend_IR":"Statistic_Table_Line31_59_Legend");
//            final Vector temp = (Vector) collist.get(len-1) ;
            if(tables != null)
                 if(tables.size() > 0){
                    final JTable staplefoodTable = tables.get(tables.size()-1);
                    staplefoodTable.addMouseMotionListener(new MouseMotionAdapter(){
                        public void mouseMoved(MouseEvent e){
                            Point p = e.getPoint();
                            int row = staplefoodTable.rowAtPoint(p);
//                              System.out.println("mouseMoved row="+row);
                            if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){                              
                                 if((row > 26 && row < 30) || (row > 57 && row < 63)){
//                                int column = staplefoodTable.columnAtPoint(p);
                                    staplefoodTable.setToolTipText(ToolTipText);
                                 }else{
                                     staplefoodTable.setToolTipText(null);
                                 }
                            }else{
                                 if((row > 26 && row < 30) || (row > 54 && row < 59)){
                                    staplefoodTable.setToolTipText(ToolTipText);
                                 }else{
                                     staplefoodTable.setToolTipText(null);
                                 }
                            }
                        }//end MouseMoved
                   
                    }); // end MouseMotionAdapter
                 }
        }
       
        
      return tables;
  }

    private JTable setTableProperty(DefaultTableModel model){
          int lastnullcolindex = 9;
          int secondnullcolindex = 7;
          int firstnullcolindex = 5;

           //add on 20100330 , MS's requirtment, add color into table --- begin
            final   RowColorRenderer   rcr   =   new   RowColorRenderer();
           //----------- end
          JTable table = new JTable (model){
             public boolean isCellEditable(int row, int column) {
               return false;
              }
              //add on 20100330 , MS's requirtment, add color into table --- begin
              public   TableCellRenderer   getCellRenderer(int   row,   int   column) {
                   return   rcr;
              }

               //----------- end
           };

           
            for(int   i=   0;   i<table.getColumnCount();   i++){
                 int   with   =   this.getPreferredWidthForCloumn(table,i)   +   10;
              //int   with   =   this.getPreferredWidthForCloumn(table,i);
                  with   =   150   >   with   ?  150   :   with;
                  table.getColumnModel().getColumn(i).setPreferredWidth(with);
                  //table.getColumnModel().getColumn(i).setCellRenderer(new TableCellTextAreaRenderer());
            }

           table.getColumnModel().getColumn(0).setPreferredWidth(20);
           table.getColumnModel().getColumn(0).setMaxWidth(20);
           table.getColumnModel().getColumn(0).setMinWidth(20);
           table.getColumnModel().getColumn(1).setPreferredWidth(200);
           table.getColumnModel().getColumn(1).setMaxWidth(200);
           table.getColumnModel().getColumn(1).setMinWidth(200);

           if(table.getColumnCount() == lastnullcolindex){
               table.getColumnModel().getColumn(3).setPreferredWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(3).setMaxWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(3).setMinWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(5).setPreferredWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(5).setMaxWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(5).setMinWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(7).setPreferredWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(7).setMaxWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(7).setMinWidth(TABLE_COL_DIST);

           }
            if(table.getColumnCount() == secondnullcolindex){
               table.getColumnModel().getColumn(3).setPreferredWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(3).setMaxWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(3).setMinWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(5).setPreferredWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(5).setMaxWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(5).setMinWidth(TABLE_COL_DIST);
           }
           if(table.getColumnCount() == firstnullcolindex){
               table.getColumnModel().getColumn(3).setPreferredWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(3).setMaxWidth(TABLE_COL_DIST);
               table.getColumnModel().getColumn(3).setMinWidth(TABLE_COL_DIST);
           }
           table.setRowHeight(14);
          // table.setDefaultRenderer(Object.class, new TableCellTextAreaRenderer());

            
           return table;
    }

     private int getPreferredWidthForCloumn(JTable   table,int   icol){

          TableColumnModel   tcl   =   table.getColumnModel();

          TableColumn   col   =   tcl.getColumn(icol);

          int   c   =   col.getModelIndex(),width   =   0,maxw   =   0;

          for(int   r=0;r<table.getRowCount();++r){

              TableCellRenderer   renderer   =   table.getCellRenderer(r,c);
             
              Component   comp   =   renderer.getTableCellRendererComponent(table,table.getValueAt(r,c),false,false,r,c);
              width   =   comp.getPreferredSize().width;
              maxw   =   width   >   maxw?width:maxw;
          }
          return maxw;
     }

 /**
  * set defaulttablemodel first and second column/row
  *
  * @return
  */
  public DefaultTableModel initModelProperty(){
      DefaultTableModel model = new DefaultTableModel();
      //first column
      Vector fv=new Vector();
      int index = 0 ;
      if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
          index = 70;
      }else{
          index = 64;
      }
      for(int j=3;j<index;j++){
         fv.add(j);
      }
      model.addColumn("", fv);

     //second column
      Vector v=new Vector();
      v.add(" ");
      v.add(" ");
      v.add(" ");
 
      java.util.ResourceBundle rb = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts");
      v.add(rb.getString("Valid_record_time"));
      v.add(rb.getString("Load_analyzes")); //8 line
      v.add(rb.getString("Full_load_time") + " ("+strTimeUnit+"[%])");
      v.add(rb.getString("Unload_time")+" ("+strTimeUnit+"[%])");
      v.add(rb.getString("Stop_time")+" ("+strTimeUnit+"[%])");
      v.add(rb.getString("Number_of_starts"));
      v.add(rb.getString("Number_of_load/unload_cycles"));
      v.add(" ");

      v.add(rb.getString("Energy")); //15 line
      v.add(rb.getString("Full_load_energy")+" ("+strEnergyUnit+")");
      v.add(rb.getString("Unload_energy")+" ("+strEnergyUnit+")");
      v.add(rb.getString("Stop_energy")+" ("+strEnergyUnit+")");
      v.add(rb.getString("Total_energy_consumption")+" ("+strEnergyUnit+")");
      v.add(rb.getString("Specific_power") + " ("+strEnergyUnit+"/" + strLeakageUnit + ")");
      v.add(" ");

      v.add(rb.getString("Costs"));//22 line
      v.add(rb.getString("Full_load_costs")+" ("+strCostUnit+")");
      v.add(rb.getString("Unload_costs")+" ("+strCostUnit+")");
      v.add(rb.getString("Stop_costs")+" ("+strCostUnit+")");
      v.add(rb.getString("Total_costs")+" ("+strCostUnit+")");
      v.add(rb.getString("Costs_per") + " " + strLeakageUnit + " ("+strCostUnit+")");
      v.add(" ");

      v.add(rb.getString("Air_delivery"));//29 line
      v.add(rb.getString("Average_flow")+" (" +strAirDeliveryUnit + ")");
      v.add(rb.getString("Max_flow")+" (" +strAirDeliveryUnit + ")");
      v.add(rb.getString("Total_air_delivery")+" (" + strLeakageUnit + ")");
      v.add(" ");

      v.add(rb.getString("Leakage"));//34 line
      v.add(rb.getString("Average_leakage")+" (" +strAirDeliveryUnit + ")");
      v.add(rb.getString("Total_leakage")+" (" + strLeakageUnit + ")");
      v.add(rb.getString("Leakage_costs")+" ("+strCostUnit+")");
      v.add(" ");

      if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
          v.add(rb.getString("CO2_Emission"));//39 line
          v.add(rb.getString("CO2_Emission")+" ("+strCo2EmissionUnit+")");
          v.add(" ");
      }

      v.add(rb.getString("Cumulated_for") + " " + theLeakStat.WORKING_HOUR_PER_YEAR + " " + rb.getString("Hour")); //42 line
      v.add(rb.getString("Load_analyzes"));
      v.add(rb.getString("Full_load_time") +" ("+rb.getString("Hour")+")");
      v.add(rb.getString("Unload_time") +" ("+rb.getString("Hour")+")");
      v.add(rb.getString("Stop_time") +" ("+rb.getString("Hour")+")");
      v.add(rb.getString("Number_of_starts"));
      v.add(rb.getString("Number_of_load/unload_cycles"));
      v.add(" ");

      v.add(rb.getString("Energy")); //50 line
      v.add(rb.getString("Full_load_energy")+" ("+strEnergyUnit+")");
      v.add(rb.getString("Unload_energy")+" ("+strEnergyUnit+")");
      v.add(rb.getString("Stop_energy")+" ("+strEnergyUnit+")");
      v.add(rb.getString("Total_energy_consumption")+" ("+strEnergyUnit+")");
      v.add(" ");

      v.add(rb.getString("Costs"));//22 line
      v.add(rb.getString("Full_load_costs")+" ("+strCostUnit+")");
      v.add(rb.getString("Unload_costs")+" ("+strCostUnit+")");
      v.add(rb.getString("Stop_costs")+" ("+strCostUnit+")");
      v.add(rb.getString("Total_costs")+" ("+strCostUnit+")");
      v.add(" ");

      v.add(rb.getString("Air_delivery"));//62 line
      v.add(rb.getString("Total_air_delivery")+" (" + strLeakageUnit + ")");
      v.add(" ");

      v.add(rb.getString("Leakage"));//65 line
      v.add(rb.getString("Total_leakage")+" (" + strLeakageUnit + ")");
      v.add(rb.getString("Leakage_costs")+" ("+strCostUnit+")");
     
     if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
          v.add(" ");
          v.add(rb.getString("CO2_Emission"));
          v.add(rb.getString("CO2_Emission")+" ("+strCo2EmissionUnit+")");
     }

      model.addColumn("", v);

      return model;
  }

    /**
     * according compressors to set column data
     * @param compressors
     * @return
     */
    public Vector setCompressorAnalyzeCols(ArrayList<Compressor> compressors, JTableFields mytalbefields){

          if ( compressors == null ){
              return null; 
          }
    
          Vector vlist=new Vector();
          JTableSumFields sumtalbefields = new JTableSumFields();
          double floatTotalValidTime = 0.0f;
          String strTmpOneRecordValieTime = "0";
          int len = compressors.size();
        
          for(int i=0;i<len;i++){
               Compressor compressor = compressors.get(i);
               if ( compressor == null ) continue;
               if ( !compressor.Selected ) continue;
               //mofidy on 20091223.
               //reason : Wolfgang Blessing,Michael Kromer test valid record time is singe compressor total hours,
               //         not all.
               //mothed : put valid record time field on every compressor column.
               strTmpOneRecordValieTime =  String.format( FORMAT_STRING_1_DIGIT, ( compressor.TotalHours )).trim();

               mytalbefields.setValid_record_time(strTmpOneRecordValieTime + "  " + TIME_UINT );
               floatTotalValidTime += Float.valueOf( GUIConst.VerifyString( strTmpOneRecordValieTime ));

               mytalbefields  = setSingleTableLoadEnergyCostFieldsBaseOnCompressor( compressor,mytalbefields );
//               if ( theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_COMPRESSOR )
                   mytalbefields = setSingleTableFlowFieldsBaseOnCompressor( compressor,mytalbefields );
               //add on 20100409. MS's requirement : system analyze the flow value show by compressor's .
//               if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
//                   mytalbefields = setSystemAnalyzeFlowFieldsByCompressor( compressor,mytalbefields );
//               }
               if ( compressor.TotalAirDeliveryAmount > 0 ){
                    //CostPerM3
                    mytalbefields.setCosts_per_m2(String.format(FORMAT_STRING_4_DIGIT, compressor.AirUnitCost ).trim() );
               }
             
               vlist.add(setCompressorSingleVector(mytalbefields));
               sumtalbefields = setSumTableFieldsBaseOnCompressor(compressor,mytalbefields,sumtalbefields);
//               System.out.println("111sumtalbefields.getSum_average_flow()).trim()111="+sumtalbefields.getSum_average_flow());
           }
          // the total valid time should be average of all valid record time
          // if only a single record file, valid record of all compressors will be the same
          // complicated case only when combing record file
          //modify on 20100408, MS's requirement : summary valid record time is
//           sumtalbefields.setSum_valid_record_time(floatTotalValidTime / len);
           long tmpRecordTime = (theLeakStat.getEndTime().getTime()-theLeakStat.getStartTime().getTime())/1000/3600;
           sumtalbefields.setSum_valid_record_time(tmpRecordTime);
//           System.out.println("========tmpRecordTime="+tmpRecordTime);
//           System.out.println("========sumtalbefields.getSum_valid_record_time="+sumtalbefields.getSum_valid_record_time());

//           //reset leakage
//           if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
//               sumtalbefields = test(sumtalbefields);
//           }
           vlist.add(setCompressorSumVector(sumtalbefields,len));
           return vlist;
    }

    //add on 20100623, be
    private JTableSumFields setSumLeakageFieldsBaseOnSystemAnalyze (JTableSumFields sumtalbefields){
        if ( theLeakStat.averageLeakage > 0 ) {
            System.out.println("-----------");
            //AverageLeakage
            sumtalbefields.setSum_average_leakage(theLeakStat.averageLeakage);
            //LeakageCost
            sumtalbefields.setSum_leakage_costs( theLeakStat.costOfLeakage );
            //LeakageCostOneYear
            sumtalbefields.setSum_oneyear_leakage_costs(theLeakStat.costOfLeakageOneYear );
          //TotalLeakage
            sumtalbefields.setSum_total_leakage(theLeakStat.totalLeakage );
            //TotalLeakageOneYear
            sumtalbefields.setSum_oneyear_total_leakage( theLeakStat.totalLeakageOneYear );

        }else {
              sumtalbefields.setSum_average_leakage(0);
              sumtalbefields.setSum_leakage_costs(0);
              sumtalbefields.setSum_oneyear_leakage_costs(0);
              sumtalbefields.setSum_total_leakage(0);
              sumtalbefields.setSum_oneyear_total_leakage(0);
        }
        return sumtalbefields;
    }

    private JTableSumFields setSumTableFieldsBaseOnCompressor(Compressor compressor,JTableFields mytalbefields,JTableSumFields mysumtalbefields){
       //enrgy
        mysumtalbefields.setSum_full_load_energy(mysumtalbefields.getSum_full_load_energy()+Double.parseDouble( GUIConst.VerifyString(mytalbefields.getFull_load_energy())));//compressor.FullLoadEnergyConsumption);
        mysumtalbefields.setSum_unload_energy(mysumtalbefields.getSum_unload_energy()+Double.parseDouble( GUIConst.VerifyString(mytalbefields.getUnload_energy())));//compressor.UnLoadEnergyConsumption);
        mysumtalbefields.setSum_stop_energy(mysumtalbefields.getSum_stop_energy()+Double.parseDouble( GUIConst.VerifyString(mytalbefields.getStop_energy())));//compressor.NoLoadEnergyConsumption);
        mysumtalbefields.setSum_total_energy_consumption(mysumtalbefields.getSum_total_energy_consumption()+Double.parseDouble( GUIConst.VerifyString(mytalbefields.getTotal_energy_consumption())));//compressor.TotalEnergyConsumption);
//        mysumtalbefields.setSum_specific_power(mysumtalbefields.getSum_specific_power()+Double.parseDouble(mytalbefields.getSpecific_power()));
        //costs
        mysumtalbefields.setSum_full_load_costs(mysumtalbefields.getSum_full_load_costs()+Double.parseDouble( GUIConst.VerifyString(mytalbefields.getFull_load_costs())));//compressor.FullLoadEnergyCost);
        mysumtalbefields.setSum_unload_costs(mysumtalbefields.getSum_unload_costs()+Double.parseDouble( GUIConst.VerifyString(mytalbefields.getUnload_costs())));//compressor.UnLoadEnergyCost);
        mysumtalbefields.setSum_stop_costs(mysumtalbefields.getSum_stop_costs()+Double.parseDouble( GUIConst.VerifyString(mytalbefields.getStop_costs())));//compressor.NoLoadEnergyCost);
        mysumtalbefields.setSum_total_costs(mysumtalbefields.getSum_total_costs()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getTotal_costs())));//compressor.TotalCost);
        mysumtalbefields.setSum_costs_per_m2(mysumtalbefields.getSum_costs_per_m2()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getCosts_per_m2())));//compressor.AirUnitCost);
        //air delivery
        mysumtalbefields.setSum_average_flow(mysumtalbefields.getSum_average_flow()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getAverage_flow())));//compressor.AverageFlow);

        //modify on 20091014.be      
//        if(mysumtalbefields.getSum_max_flow() < compressor.MaxFlow){
//         if(mysumtalbefields.getSum_max_flow() < Double.parseDouble( GUIConst.VerifyString(mytalbefields.getMax_flow()))) {
//            mysumtalbefields.setSum_max_flow(Double.parseDouble( GUIConst.VerifyString(mytalbefields.getMax_flow())));
//        }
         //modify on 20130606.be 
        mysumtalbefields.setSum_max_flow(theLeakStat.maxFlowBaseOnAllCompressors);
 
        if ( mysumtalbefields.getSum_total_air_delivery() <= 0 || theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_COMPRESSOR || theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM  )
            mysumtalbefields.setSum_total_air_delivery(mysumtalbefields.getSum_total_air_delivery()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getTotal_air_delivery())));//compressor.TotalAirDeliveryAmount);

        //leakage
//        mysumtalbefields.setSum_average_leakage( Double.parseDouble( GUIConst.VerifyString(mytalbefields.getAverage_leakage() ))); // mysumtalbefields.getSum_average_leakage()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getAverage_leakage()))); //compressor.AverageLeakage);

        /* compressor sum of all leakage calculation is changed on 20130607. 
         * Detail look at the paper about compressor analyzes */
        mysumtalbefields.setSum_average_leakage(theLeakStat.getLeakageThreshold());
        long analyzeTimePeriod = theLeakStat.getEndTime().getTime() - theLeakStat.getStartTime().getTime();       
        double validRecordTimeHours = (double) analyzeTimePeriod / 1000 / 3600;
        double flowRateValidRecordTimeHours = validRecordTimeHours * MeasurementUnit.FlowUnitRatioToOneHour(theLeakStat.getAir_delivery_unit());
        mysumtalbefields.setSum_total_leakage(theLeakStat.getLeakageThreshold() * flowRateValidRecordTimeHours);        
        mysumtalbefields.setSum_leakage_costs(mysumtalbefields.getSum_total_leakage() * flowRateValidRecordTimeHours);
//        if ( mysumtalbefields.getSum_total_leakage() <= 0 ) {
//            mysumtalbefields.setSum_total_leakage(mysumtalbefields.getSum_total_leakage()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getTotal_leakage().split(" ")[0])));//compressor.TotalLeakage);
//            mysumtalbefields.setSum_leakage_costs(mysumtalbefields.getSum_leakage_costs()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getLeakage_costs())));//compressor.LeakageCost);
//        }
        //co2 emission
//        mysumtalbefields.setSum_co2_emission(mysumtalbefields.getSum_co2_emission()+compressor.CO2Emmision);
//         mysumtalbefields.setSum_co2_emission(mysumtalbefields.getSum_co2_emission()+theLeakStat.getCO2EmmisionPerKWh());
         if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
                mysumtalbefields.setSum_co2_emission(mysumtalbefields.getSum_co2_emission()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getCo2_emission())));//compressor.CO2Emmision);
          }else{
                mysumtalbefields.setSum_co2_emission(0);
          }

        //one year
        //enrgy
        mysumtalbefields.setSum_oneyear_full_load_energy(mysumtalbefields.getSum_oneyear_full_load_energy()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getOneyear_full_load_energy())));//compressor.FullLoadEnergyConsumptionOneYear);
//        System.out.println("compressor.FullLoadEnergyConsumptionOneYear="+compressor.FullLoadEnergyConsumptionOneYear);
//        System.out.println("mysumtalbefields.setSum_oneyear_full_load_energy="+mysumtalbefields.getSum_oneyear_full_load_energy());
        mysumtalbefields.setSum_oneyear_unload_energy(mysumtalbefields.getSum_oneyear_unload_energy()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getOneyear_unload_energy())));//compressor.UnLoadEnergyConsumptionOneYear);
        mysumtalbefields.setSum_oneyear_stop_energy(mysumtalbefields.getSum_oneyear_stop_energy()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getOneyear_stop_energy())));//compressor.NoLoadEnergyConsumptionOneYear);
        mysumtalbefields.setSum_oneyear_total_energy_consumption(mysumtalbefields.getSum_oneyear_total_energy_consumption()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getOneyear_total_energy_consumption())));//compressor.TotalEnergyConsumptionOneYear);
//        mysumtalbefields.setSum_oneyear_specific_power(mysumtalbefields.getSum_specific_power()+Double.parseDouble(mytalbefields.getSpecific_power()));
        //costs
        mysumtalbefields.setSum_oneyear_full_load_costs(mysumtalbefields.getSum_oneyear_full_load_costs()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getOneyear_full_load_costs())));//compressor.FullLoadEnergyCostOneYear);

        mysumtalbefields.setSum_oneyear_unload_costs(mysumtalbefields.getSum_oneyear_unload_costs()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getOneyear_unload_costs())));//compressor.UnLoadEnergyCostOneYear);
        mysumtalbefields.setSum_oneyear_stop_costs(mysumtalbefields.getSum_oneyear_stop_costs()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getOneyear_stop_costs())));//compressor.NoLoadEnergyCostOneYear);
        mysumtalbefields.setSum_oneyear_total_costs(mysumtalbefields.getSum_oneyear_total_costs()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getOneyear_total_costs())));//compressor.TotalCostOneYear);
//        mysumtalbefields.setSum_oneyear_costs_per_m2(mysumtalbefields.getSum_costs_per_m2()+ compressor.AirUnitCost);
        //air delivery
        if ( mysumtalbefields.getSum_oneyear_total_air_delivery() <= 0 || theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_COMPRESSOR || theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM)
            mysumtalbefields.setSum_oneyear_total_air_delivery(mysumtalbefields.getSum_oneyear_total_air_delivery()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getOneyear_total_air_delivery())));//compressor.TotalAirDeliveryAmountOneYear);

        //leakage
        double yearRatio = theLeakStat.getWork_hour_per_year() / validRecordTimeHours;
        mysumtalbefields.setSum_oneyear_total_leakage(mysumtalbefields.getSum_total_leakage() * yearRatio);
        mysumtalbefields.setSum_oneyear_leakage_costs(mysumtalbefields.getSum_leakage_costs() * yearRatio);
//        if ( mysumtalbefields.getSum_oneyear_total_leakage() <= 0 ) {
//            mysumtalbefields.setSum_oneyear_total_leakage(mysumtalbefields.getSum_oneyear_total_leakage()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getOneyear_total_leakage().split(" ")[0])));//compressor.TotalLeakageOneYear);
//            mysumtalbefields.setSum_oneyear_leakage_costs(mysumtalbefields.getSum_oneyear_leakage_costs()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getOneyear_leakage_costs())));//compressor.LeakageCostOneYear);
//        }
        
        //co2 emission
//        mysumtalbefields.setSum_oneyear_co2_emission(mysumtalbefields.getSum_oneyear_co2_emission()+compressor.CO2EmmisionOneYear);
          if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
                mysumtalbefields.setSum_oneyear_co2_emission(mysumtalbefields.getSum_oneyear_co2_emission()+ Double.parseDouble( GUIConst.VerifyString(mytalbefields.getOneyear_co2_emission())));//compressor.CO2EmmisionOneYear);
          }else{
                mysumtalbefields.setSum_oneyear_co2_emission(0);
          }


        //add v3-6,20091014.be
        if(!"NaN".equals(String.valueOf(mysumtalbefields.getSum_total_air_delivery())) && mysumtalbefields.getSum_total_air_delivery() > 0){
            mysumtalbefields.setSum_specific_power(mysumtalbefields.getSum_total_energy_consumption()/mysumtalbefields.getSum_total_air_delivery());
        }else{
            mysumtalbefields.setSum_specific_power(0.000);
        }
//        mysumtalbefields.setAir_delivery_unit(compressor.AirDeliveryUnit);
//        mysumtalbefields.setSpecific_power_unit(compressor.SpecificPowerUnit);

        //valid record time = all compressors total hours (is right?).ask michael.
        mysumtalbefields.setValid_record_time(mysumtalbefields.getValid_record_time()+compressor.TotalHours);
        return mysumtalbefields;
    }

    private Vector setTableFieldsValue(JTableFields mytalbefields){
         Vector vv=new Vector();
         // vv.add(" ");
         // vv.add(" ");
         //  vv.add(" ");
           vv.add(mytalbefields.getName());
           vv.add(mytalbefields.getType());
           //vv.add("Atlas copco 132");
           vv.add(" ");
           //mofidy on 20091223.
           //reason : Wolfgang Blessing,Michael Kromer test valid record time is singe compressor total hours,
           //         not all.
           //mothed : put valid record time field on every compressor column.
           vv.add(mytalbefields.getValid_record_time());

           vv.add(" ");
           //load analyzes
           vv.add(mytalbefields.getFull_load_time());
           vv.add(mytalbefields.getUnload_time());
           vv.add(mytalbefields.getStop_time());//i donot know this value how to get
           vv.add(mytalbefields.getNumber_of_starts()); //number of starts
           vv.add(mytalbefields.getNumber_of_load_unload_cycles());//number of load/unload cycles

           //energy
           vv.add(" ");
           vv.add(" ");
           //modify on 20091222.
           //reason : Wolfgang Blessing, Michael Kromer requirement
//           vv.add(mytalbefields.getFull_load_energy());
//           vv.add(mytalbefields.getUnload_energy());
//           vv.add(mytalbefields.getStop_energy());//stop energy
//           vv.add(mytalbefields.getTotal_energy_consumption());
           String strTmpFull = mytalbefields.getFull_load_energy();
           String strTmpUnload = mytalbefields.getUnload_energy();
           String strTmpStop = mytalbefields.getStop_energy();
           Float floatTotal = Float.valueOf( GUIConst.VerifyString(strTmpFull) )+
                   Float.valueOf( GUIConst.VerifyString(strTmpUnload) ) + 
                   Float.valueOf( GUIConst.VerifyString(strTmpStop) );
           vv.add(strTmpFull);
           vv.add(strTmpUnload);
           vv.add(strTmpStop);
           vv.add( String.format( FORMAT_STRING_1_DIGIT ,floatTotal ).trim() );

           //modify on 20100106
           if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
                if(Double.valueOf(mytalbefields.getTotal_air_delivery()) > 0){
                    vv.add(String.format(FORMAT_STRING_3_DIGIT, floatTotal/Double.valueOf(mytalbefields.getTotal_air_delivery().trim())).trim());
                }else{
                    vv.add("0.000");
                }
           }else{
               if("0".equals(mytalbefields.getSpecific_power())){
                   vv.add("0.000");
               }else{
                   vv.add(mytalbefields.getSpecific_power());
               }
           }

           //costs
           vv.add(" ");
           vv.add(" ");
//           vv.add(mytalbefields.getFull_load_costs());
//           vv.add(mytalbefields.getUnload_costs());
//           vv.add(mytalbefields.getStop_costs());
//           vv.add(mytalbefields.getTotal_costs());
            strTmpFull = mytalbefields.getFull_load_costs();
            strTmpUnload = mytalbefields.getUnload_costs();
            strTmpStop = mytalbefields.getStop_costs();

           vv.add(strTmpFull);
           vv.add(strTmpUnload);
           vv.add(strTmpStop);
           if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_FLOW){
               vv.add(mytalbefields.getTotal_costs());
           }else{
               floatTotal = Float.valueOf( GUIConst.VerifyString(strTmpFull))+Float.valueOf( GUIConst.VerifyString(strTmpUnload))+Float.valueOf( GUIConst.VerifyString(strTmpStop));
               vv.add(floatTotal.intValue());
           }

           //Modify on 20100106
           //reason : Simon test found it's wrong.
           String costPerM3 = "0";
//           vv.add(mytalbefields.getCosts_per_m2());
          if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_FLOW){
               costPerM3 = mytalbefields.getCosts_per_m2();
               vv.add(costPerM3);
          }else{
               if(Double.valueOf(mytalbefields.getTotal_air_delivery()) > 0){
                   costPerM3 = String.format(FORMAT_STRING_4_DIGIT, floatTotal/Double.valueOf(mytalbefields.getTotal_air_delivery().trim())).trim();
                   vv.add(costPerM3);
               }else{
                   costPerM3 = mytalbefields.getCosts_per_m2();
                   vv.add(costPerM3);
               }
          }
           //air delivery
           vv.add(" ");
           vv.add(" ");
           //Modify on 20100106
           //reason : Simon test found it's wrong.
//           vv.add(mytalbefields.getAverage_flow());
//           System.out.println("Jtablepanel/setTableFieldsValue mytalbefields.getValid_record_time()="+mytalbefields.getValid_record_time());
           if(mytalbefields.getValid_record_time().isEmpty()){
               vv.add(mytalbefields.getAverage_flow());
           }else{
               //MK's requirement : sum of the single compressors. modify on 20100513.
//               if(Double.valueOf( GUIConst.VerifyString(mytalbefields.getValid_record_time().split(" ")[0].trim()) ) > 0){
//                    vv.add(String.format(FORMAT_STRING_1_DIGIT, (Double.valueOf( GUIConst.VerifyString(mytalbefields.getTotal_air_delivery().trim()))/Double.valueOf( GUIConst.VerifyString(mytalbefields.getValid_record_time().split(" ")[0].trim())))/averageFlowDiviedMum).trim());
//               }else{
//                    vv.add(mytalbefields.getAverage_flow());
//               }
               if(Double.valueOf( GUIConst.VerifyString(mytalbefields.getValid_record_time().split(" ")[0].trim()) ) > 0){
                    mytalbefields.setAverage_flow(String.format(FORMAT_STRING_1_DIGIT, (Double.valueOf( GUIConst.VerifyString(mytalbefields.getTotal_air_delivery().trim()))/Double.valueOf( GUIConst.VerifyString(mytalbefields.getValid_record_time().split(" ")[0].trim())))/averageFlowDiviedMum).trim());
               }else{
                    mytalbefields.setAverage_flow(mytalbefields.getAverage_flow());
               }
               vv.add(mytalbefields.getAverage_flow());
           }
         
           vv.add(mytalbefields.getMax_flow());
           vv.add(mytalbefields.getTotal_air_delivery());

           //leakage
           vv.add(" ");
           vv.add(" ");
           //modify on 20091222.
           //reason : Wolfgang Blessing, Michael Kromer requirement : If leakage line is not set by user,
           //         the value in the table for the leakages should not be zero. It should the either "---"
           //         or the lines should completety disappear.
           //method : show "---" when it is zero.
           String strAverageLeakage = mytalbefields.getAverage_leakage();
           if(strAverageLeakage != null)
               if("".equals(strAverageLeakage.trim()))
                   strAverageLeakage = "0";
           if("0.0".equals(strAverageLeakage) || "0".equals(strAverageLeakage) ){
               vv.add(ZERO_LEAKAGE_STRING);
           }else{
//               //Modify on 20100106
//               //reason : Simon test found it's wrong.
//                if(mytalbefields.getValid_record_time().isEmpty()){
//                     vv.add(strAverageLeakage);
//                }else{
//                   if(Double.valueOf(mytalbefields.getValid_record_time().split(" ")[0].trim()) > 0){
//                        vv.add(String.format(FORMAT_STRING_1_DIGIT, (Double.valueOf(mytalbefields.getTotal_leakage().trim())/Double.valueOf(mytalbefields.getValid_record_time().split(" ")[0].trim()))/averageFlowDiviedMum).trim());
//                   }else{
//                        vv.add(strAverageLeakage);
//                   }
//                }
               vv.add(strAverageLeakage);
           }
           String strTotalLeakage = mytalbefields.getTotal_leakage();
           if( "0".equals(strTotalLeakage)){
               vv.add(ZERO_LEAKAGE_STRING);
           }else{
               vv.add(strTotalLeakage);
           }

//           String strLeakageCosts = mytalbefields.getLeakage_costs();
           String strLeakageCosts = "0";
           if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM || theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_COMPRESSOR){
               Float leakageCosts = Float.valueOf( GUIConst.VerifyString(strTotalLeakage))*Float.valueOf( GUIConst.VerifyString(costPerM3));
               strLeakageCosts = String.valueOf(leakageCosts.intValue());
           }else{
               strLeakageCosts = mytalbefields.getLeakage_costs();
           }
           if("0".equals(strLeakageCosts)){
               vv.add(ZERO_LEAKAGE_STRING);
           }else{
//                if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM || theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_COMPRESSOR){
//                    Float leakageCosts = Float.valueOf(strTotalLeakage)*Float.valueOf(costPerM3);
//                    vv.add(leakageCosts.intValue());
//                }else{
                   vv.add(strLeakageCosts);
//                }
           }
      
           if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
               //co2 emission
               vv.add(" ");
               vv.add(" ");
               vv.add(mytalbefields.getCo2_emission());
           }

           //one year load analyzes
           vv.add(" ");
           vv.add(" ");
           vv.add(" ");
           vv.add(mytalbefields.getOneyear_full_load_time());
           vv.add(mytalbefields.getOneyear_unload_time());
           vv.add(mytalbefields.getOneyear_stop_time());//i donot know this value how to get
           vv.add(mytalbefields.getOneyear_number_of_starts()); //number of starts
           vv.add(mytalbefields.getOneyear_number_of_load_unload_cycles());//number of load/unload cycles

           //one year energy
           vv.add(" ");
           vv.add(" ");
//           vv.add(mytalbefields.getOneyear_full_load_energy());
//           vv.add(mytalbefields.getOneyear_unload_energy());
//           vv.add(mytalbefields.getOneyear_stop_energy());//stop energy
//           vv.add(mytalbefields.getOneyear_total_energy_consumption());
            strTmpFull = mytalbefields.getOneyear_full_load_energy();
            strTmpUnload = mytalbefields.getOneyear_unload_energy();
            strTmpStop = mytalbefields.getOneyear_stop_energy();
            floatTotal = Float.valueOf( GUIConst.VerifyString(strTmpFull))+Float.valueOf( GUIConst.VerifyString(strTmpUnload))+Float.valueOf( GUIConst.VerifyString(strTmpStop));
           vv.add(strTmpFull);
           vv.add(strTmpUnload);
           vv.add(strTmpStop);
           vv.add(floatTotal.intValue());

           //one year costs
           vv.add(" ");
           vv.add(" ");
//           vv.add(mytalbefields.getOneyear_full_load_costs());
//           vv.add(mytalbefields.getOneyear_unload_costs());
//           vv.add(mytalbefields.getOneyear_stop_costs());
//           vv.add(mytalbefields.getOneyear_total_costs());
            strTmpFull = mytalbefields.getOneyear_full_load_costs();
            strTmpUnload = mytalbefields.getOneyear_unload_costs();
            strTmpStop = mytalbefields.getOneyear_stop_costs();
            vv.add(strTmpFull);
            vv.add(strTmpUnload);
            vv.add(strTmpStop);
            if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_FLOW){
                vv.add(mytalbefields.getOneyear_total_costs());
            }else{
                floatTotal = Float.valueOf( GUIConst.VerifyString(strTmpFull))+Float.valueOf( GUIConst.VerifyString(strTmpUnload))+Float.valueOf( GUIConst.VerifyString(strTmpStop));        
                vv.add(floatTotal.intValue());
            }

           //one year air delivery
           vv.add(" ");
           vv.add(" ");
           vv.add(mytalbefields.getOneyear_total_air_delivery());

           //one year leakage
           vv.add(" ");
           vv.add(" ");
           //modify on 20091222.
           //reason : Wolfgang Blessing, Michael Kromer requirement : If leakage line is not set by user,
           //         the value in the table for the leakages should not be zero. It should the either "---"
           //         or the lines should completety disappear.
           //method : show "---" when it is zero.
           String strOneYearTotalLeakage = mytalbefields.getOneyear_total_leakage();
           if( "0".equals(strOneYearTotalLeakage)){
               vv.add(ZERO_LEAKAGE_STRING);
           }else{
               vv.add(strOneYearTotalLeakage);
           }

//           String strOneYearLeakageCosts = mytalbefields.getOneyear_leakage_costs();
            String strOneYearLeakageCosts = "0";
            if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM || theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_COMPRESSOR){
                Float leakageCosts = Float.valueOf( GUIConst.VerifyString(strOneYearTotalLeakage))*Float.valueOf( GUIConst.VerifyString(costPerM3));
                strOneYearLeakageCosts = String.valueOf(leakageCosts.intValue());
            }else{
               strOneYearLeakageCosts = mytalbefields.getOneyear_leakage_costs();
            }
           if("0".equals(strOneYearLeakageCosts)){
               vv.add(ZERO_LEAKAGE_STRING);
           }else{
//                if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM || theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_COMPRESSOR){
//                    Float leakageCosts = Float.valueOf(strOneYearTotalLeakage)*Float.valueOf(costPerM3);
//                    vv.add(leakageCosts.intValue());
//                }else{
                    vv.add(strOneYearLeakageCosts);
//                }
//               vv.add(strOneYearLeakageCosts);
           }

           if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
               //one year co2 emission
               vv.add(" ");
               vv.add(" ");
               vv.add(mytalbefields.getOneyear_co2_emission());
           }

          return vv;
    }

    private Vector setCompressorSumVector(JTableSumFields mytalbefields,int len){
        if(mytalbefields == null) return null;
         Vector vv=new Vector();
         // vv.add(" ");
         // vv.add(" ");
//           vv.add(" ");
           vv.add(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Sum_Of_All"));
           vv.add(" ");
           vv.add(" ");
           //vv.add(" ");
           //mofidy on 20091223.
           //reason : Wolfgang Blessing,Michael Kromer test valid record time is singe compressor total hours,
           //         not all.
           //mothed : put valid record time field on every compressor column.
//           vv.add(mytalbefields.getSum_valid_record_time());
           vv.add(" ");

           vv.add(" ");
           //load analyzes
           vv.add(mytalbefields.getSum_full_load_time());
           vv.add(mytalbefields.getSum_unload_time());
           vv.add(mytalbefields.getSum_stop_time());//i donot know this value how to get
           vv.add(mytalbefields.getSum_number_of_starts()); //number of starts
           vv.add(mytalbefields.getSum_number_of_load_unload_cycles());//number of load/unload cycles

           //energy
           vv.add(" ");
           vv.add(" ");
           //modify on 20091222.
           //reason : Wolfgang Blessing, Michael Kromer requirement :
           String strTmpFull = String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_full_load_energy()).trim();
           String strTmpUnload = String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_unload_energy()).trim();
           String strTmpStop = String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_stop_energy()).trim();
           Float floatTotal = Float.valueOf( GUIConst.VerifyString(strTmpFull.trim()) )+Float.valueOf( GUIConst.VerifyString(strTmpUnload.trim()) )
                   + Float.valueOf( GUIConst.VerifyString(strTmpStop.trim()));
           vv.add(strTmpFull);
           vv.add(strTmpUnload);
           vv.add(strTmpStop);//stop energy
          // vv.add(String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_total_energy_consumption()).trim());
           vv.add(String.format(FORMAT_STRING_1_DIGIT,floatTotal).trim()); 
                              
           if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
               double systemSumTotalAirDelivery = theLeakStat.getSystemAnalyzesSumTotalAirDelivery();
               double compressorSumTotalAirDelivery = mytalbefields.getSum_total_air_delivery();
               double systemSumSpecificPower = 0;
               if(systemSumTotalAirDelivery == 0){
                   systemSumSpecificPower = 0;
               }else{
                   systemSumSpecificPower = floatTotal / systemSumTotalAirDelivery;
               }
               
               double compressorSumSecificPower = 0;
               if(compressorSumTotalAirDelivery == 0){
                   compressorSumSecificPower = 0;
               }else{
                   compressorSumSecificPower = floatTotal / compressorSumTotalAirDelivery;
               }

               vv.add(String.format(FORMAT_STRING_3_DIGIT,systemSumSpecificPower).trim() 
                       + " (" + String.format(FORMAT_STRING_3_DIGIT,compressorSumSecificPower).trim() + ")");
               
           }else{
                if(mytalbefields.getSum_total_air_delivery() == 0){
                    vv.add(String.format(FORMAT_STRING_3_DIGIT,mytalbefields.getSum_specific_power()).trim());
                }else{
                    vv.add(String.format(FORMAT_STRING_3_DIGIT,floatTotal/mytalbefields.getSum_total_air_delivery()).trim());
                }
           }

           //costs
           vv.add(" ");
           vv.add(" ");
           //modify on 20091222.
           //reason : Wolfgang Blessing, Michael Kromer requirement :
//           vv.add(String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_full_load_costs()).trim() );
//           vv.add(String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_unload_costs()).trim());
//           vv.add(String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_stop_costs()).trim());
//           vv.add(String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_total_costs()).trim());
           strTmpFull = String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_full_load_costs()).trim();
           strTmpUnload = String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_unload_costs()).trim();
           strTmpStop = String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_stop_costs()).trim();
           floatTotal = Float.valueOf( GUIConst.VerifyString(strTmpFull))+Float.valueOf( GUIConst.VerifyString(strTmpUnload))+Float.valueOf( GUIConst.VerifyString(strTmpStop));
           vv.add(strTmpFull);
           vv.add(strTmpUnload);
           vv.add(strTmpStop);
           vv.add(floatTotal.intValue());
           //modify on 20100106.
           //reason : Simon test found it's wrong.
//           String strCostPerM3 = String.format(FORMAT_STRING_4_DIGIT,  mytalbefields.getSum_costs_per_m2()/len).trim();
           double intCostPerM3 = 0;
           if( mytalbefields.getSum_total_air_delivery() > 0){
                intCostPerM3 = floatTotal/mytalbefields.getSum_total_air_delivery();
           }
           String strCostPerM3 = String.format(FORMAT_STRING_4_DIGIT,  intCostPerM3).trim();
           
           if("0.0000".equals(strCostPerM3)){
              vv.add("0");
           }else{
              vv.add(strCostPerM3);
           }

           //air delivery
           vv.add(" ");
           vv.add(" ");

           //delete on 20100513, MK's requirement : sum of the single compressor.
/*           //modify 20091014.
           if(mytalbefields.getValid_record_time() >  0){
//               System.out.println("mytalbefields.getSum_valid_record_time()="+mytalbefields.getSum_valid_record_time());
//               System.out.println("mytalbefields.getSum_total_air_delivery()="+mytalbefields.getSum_total_air_delivery());
//                mytalbefields.setSum_average_flow(mytalbefields.getSum_total_air_delivery()/mytalbefields.getValid_record_time());

               //modify on 20100409, MS's requirement :In system analyze, totalAirConsumption value from theLeakStat.totalAirConsumption.
//                mytalbefields.setSum_average_flow(mytalbefields.getSum_total_air_delivery()/mytalbefields.getSum_valid_record_time());
               if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
                    mytalbefields.setSum_average_flow(theLeakStat.totalAirConsumption/mytalbefields.getSum_valid_record_time());
               }else{
                    mytalbefields.setSum_average_flow(mytalbefields.getSum_total_air_delivery()/mytalbefields.getSum_valid_record_time());
               }
                 //modify on 20100409,MS's requirement : tatal air deliven
//                 System.out.println("JtablePanel / setCompressorSumVector  mytalbefields.getSum_average_flow()="+ mytalbefields.getSum_average_flow());
                 mytalbefields.setSum_average_flow( mytalbefields.getSum_average_flow()/ averageFlowDiviedMum);
           }else{
                mytalbefields.setSum_average_flow(0);
           }
//           vv.add(String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_average_flow()).trim());
//           vv.add(String.format(FORMAT_STRING_1_DIGIT,  mytalbefields.getSum_max_flow()).trim());
*/
           
//           String strTmpIfZero = String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_average_flow()).trim();
//           String tmp1 = String.format(FORMAT_STRING_1_DIGIT, theLeakStat.averageFlow).trim();
//           String tmp2 = String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_average_flow()).trim();
//           if("0.0".equals(tmp1)){
//               tmp1 = "0";
//           }
//           if("0.0".equals(tmp2)){
//               tmp2 = "0";
//           }
//           String strTmpIfZero = String.format(FORMAT_STRING_1_DIGIT, theLeakStat.averageFlow).trim()+"("
//                   +String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_average_flow()).trim()
//                   +")";
           String strTmpIfZero = "";
           if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
                String compressorAverageFlow = String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_average_flow()).trim();
                if("0.0".equals(compressorAverageFlow)){
                    compressorAverageFlow = "0";
                }
               
                vv.add(String.format(FORMAT_STRING_1_DIGIT, theLeakStat.getSystemAnalyzesSumAverageFlow()).trim()
                        + " (" + compressorAverageFlow + ")");
           }else{
                strTmpIfZero =String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_average_flow()).trim();
                if("0.0".equals(strTmpIfZero)){
                    vv.add("0");
                }else{
                    vv.add(strTmpIfZero);
                }
           }

           //modify on 20100409, MS's requirement : Every analyze type's max flow value get from theLeakStat.maxFlow.
//          strTmpIfZero = String.format(FORMAT_STRING_1_DIGIT,  mytalbefields.getSum_max_flow()).trim();
//           strTmpIfZero = String.format(FORMAT_STRING_1_DIGIT,  theLeakStat.maxFlow).trim()+"("
//                   +String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_max_flow()).trim()
//                   +")";
//           tmp1 = String.format(FORMAT_STRING_1_DIGIT,  theLeakStat.maxFlow).trim();
//           tmp2 = String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_max_flow()).trim();
//           if("0.0".equals(tmp1)){
//               tmp1 = "0";
//           }
//           if("0.0".equals(tmp2)){
//               tmp2 = "0";
//           }    
           
           if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
               String compressorSumMaxFlow = String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_max_flow()).trim();
               if("0.0".equals(compressorSumMaxFlow)){
                   compressorSumMaxFlow = "0";
               }
             
               vv.add(String.format(FORMAT_STRING_1_DIGIT, theLeakStat.getSystemAnalyzesSumMaxFlow()).trim()
                       + " (" + compressorSumMaxFlow + ")");
               
           }else{          
                strTmpIfZero = String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_max_flow()).trim();
                if("0.0".equals(strTmpIfZero)){
                    vv.add("0");
                }else{
                    vv.add(strTmpIfZero);
                }
           }
           //modify on 20100409, MS's requirement : In system analyze, tatal air delivery display format is flow value(compressor value).
//           vv.add(String.format(FORMAT_STRING_LONG, (long)mytalbefields.getSum_total_air_delivery()).trim());
            if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
//                 vv.add(String.format(FORMAT_STRING_LONG, (long)theLeakStat.totalAirConsumption).trim()+"("+String.format(FORMAT_STRING_LONG, (long)mytalbefields.getSum_total_air_delivery()).trim()+")");
                 vv.add(String.format(FORMAT_STRING_LONG, theLeakStat.getSystemAnalyzesSumTotalAirDelivery()).trim());
                 vv.add("("+String.format(FORMAT_STRING_LONG, (long)mytalbefields.getSum_total_air_delivery()).trim()+")");
            }else{
                 vv.add(String.format(FORMAT_STRING_LONG, (long)mytalbefields.getSum_total_air_delivery()).trim());
                 vv.add(" ");
            }

           //leakage
//           vv.add(" ");
           vv.add(" ");
           //modify on 20091222.
           //reason : Wolfgang Blessing, Michael Kromer requirement : If leakage line is not set by user,
           //         the value in the table for the leakages should not be zero. It should the either "---"
           //         or the lines should completety disappear.
           //method : show "---" when it is zero.

           String strSumAverageLeakage = String.format(FORMAT_STRING_1_DIGIT, mytalbefields.getSum_average_leakage() ).trim();
            //String strSumAverageLeakage = String.format(FORMAT_STRING_2_DIGIT,  (mytalbefields.getSum_total_leakage()/mytalbefields.getSum_valid_record_time())/averageFlowDiviedMum ).trim();

            if("0.00".equals(strSumAverageLeakage) || "0".equals(strSumAverageLeakage) 
                || "0.0".equals(strSumAverageLeakage) ){
               vv.add(ZERO_LEAKAGE_STRING);
           }else{
               vv.add(strSumAverageLeakage);
           }
           String strSumTotalLeakage = String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_total_leakage()).trim();
           if( "0".equals(strSumTotalLeakage)){
               vv.add(ZERO_LEAKAGE_STRING);
           }else{
               vv.add(strSumTotalLeakage);
           }
//           String strSumLeakageCosts = String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_leakage_costs()).trim();
           String strSumLeakageCosts = "0";
         
           Float leakageCosts = Float.valueOf( GUIConst.VerifyString(strSumTotalLeakage))*Float.valueOf( GUIConst.VerifyString(strCostPerM3));
           strSumLeakageCosts = String.valueOf(leakageCosts.intValue());
          
           if("0".equals(strSumLeakageCosts)){
               vv.add(ZERO_LEAKAGE_STRING);
           }else{
               vv.add(strSumLeakageCosts);
           }

           if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
               //co2 emission
               vv.add(" ");
               vv.add(" ");
               vv.add(String.format(FORMAT_STRING_LONG, (long)mytalbefields.getSum_co2_emission() ).trim() );
           }

           //one year load analyzes
           vv.add(" ");
           vv.add(" ");
           vv.add(" ");
           vv.add(mytalbefields.getSum_oneyear_full_load_time());
           vv.add(mytalbefields.getSum_oneyear_unload_time());
           vv.add(mytalbefields.getSum_oneyear_stop_time());//i donot know this value how to get
           vv.add(mytalbefields.getSum_oneyear_number_of_starts()); //number of starts
           vv.add(mytalbefields.getSum_oneyear_number_of_load_unload_cycles());//number of load/unload cycles

           //one year energy
           vv.add(" ");
           vv.add(" ");
           //modify on 20091222.
           //reason : Wolfgang Blessing, Michael Kromer requirement :
//           vv.add(String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_full_load_energy()).trim());
//           vv.add(String.format(FORMAT_STRING_LONG, (long)mytalbefields.getSum_oneyear_unload_energy()).trim());
//           vv.add(String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_stop_energy()).trim());
//           vv.add(String.format(FORMAT_STRING_0_DIGIT, mytalbefields.getSum_oneyear_total_energy_consumption()).trim());
           strTmpFull = String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_full_load_energy()).trim();
           strTmpUnload = String.format(FORMAT_STRING_LONG, (long)mytalbefields.getSum_oneyear_unload_energy()).trim();
           strTmpStop = String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_stop_energy()).trim();
           floatTotal = Float.valueOf( GUIConst.VerifyString(strTmpFull))+Float.valueOf( GUIConst.VerifyString(strTmpUnload))+Float.valueOf( GUIConst.VerifyString(strTmpStop));
           vv.add(strTmpFull);
           vv.add(strTmpUnload);
           vv.add(strTmpStop);
           vv.add(floatTotal.intValue());

           //one year costs
           vv.add(" ");
           vv.add(" ");
//           vv.add(String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_full_load_costs()).trim());
//           vv.add(String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_unload_costs()).trim());
//           vv.add(String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_stop_costs()).trim());
//           vv.add(String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_total_costs()).trim() );
           strTmpFull = String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_full_load_costs()).trim();
           strTmpUnload = String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_unload_costs()).trim();
           strTmpStop = String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_stop_costs()).trim();
           floatTotal = Float.valueOf( GUIConst.VerifyString(strTmpFull))+Float.valueOf( GUIConst.VerifyString(strTmpUnload))+Float.valueOf( GUIConst.VerifyString(strTmpStop));
           vv.add(strTmpFull);
           vv.add(strTmpUnload);
           vv.add(strTmpStop);
           vv.add(floatTotal.intValue());

           //one year air delivery
           vv.add(" ");
           vv.add(" ");
//           vv.add(String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_total_air_delivery()).trim());
            //modify on 20100409, MS's requirement : In system analyze, tatal air delivery display format is flow value(compressor value).
            if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
//                 vv.add(String.format(FORMAT_STRING_LONG, (long)theLeakStat.totalAirConsumptionOneYear).trim()+"("+String.format(FORMAT_STRING_LONG, (long)mytalbefields.getSum_oneyear_total_air_delivery()).trim()+")");
                 vv.add(String.format(FORMAT_STRING_LONG, (long)theLeakStat.getSystemAnalyzesSumTotalAirDeliveryOneYear()).trim());
                 vv.add("("+String.format(FORMAT_STRING_LONG, (long)mytalbefields.getSum_oneyear_total_air_delivery()).trim()+")");
                 
            }else{
                 vv.add(String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_total_air_delivery()).trim());
                 vv.add(" ");
            }

           //one year leakage
//           vv.add(" ");
           vv.add(" ");
           //modify on 20091222.
           //reason : Wolfgang Blessing, Michael Kromer requirement : If leakage line is not set by user,
           //         the value in the table for the leakages should not be zero. It should the either "---"
           //         or the lines should completety disappear.
           //method : show "---" when it is zero.
           String strSumOneYearTotalLeakage = String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_total_leakage()).trim();
           if( "0".equals(strSumOneYearTotalLeakage)){
               vv.add(ZERO_LEAKAGE_STRING);
           }else{
               vv.add(strSumOneYearTotalLeakage);
           }

//           String strSumOneYearLeakageCosts = String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_leakage_costs()).trim();
           String strSumOneYearLeakageCosts = "0";
         
           leakageCosts = Float.valueOf( GUIConst.VerifyString(strSumOneYearTotalLeakage))*Float.valueOf( GUIConst.VerifyString(strCostPerM3));
           strSumOneYearLeakageCosts = String.valueOf(leakageCosts.intValue());
          
           if("0".equals(strSumOneYearLeakageCosts)){
               vv.add(ZERO_LEAKAGE_STRING);
           }else{
               vv.add(strSumOneYearLeakageCosts);
           }

           if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
               //one year co2 emission
               vv.add(" ");
               vv.add(" ");
               vv.add(String.format(FORMAT_STRING_LONG, (long) mytalbefields.getSum_oneyear_co2_emission()).trim() );
           }
          return vv;
    }

    private Vector setResults() {
        Vector results = new Vector();
        if ( theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM ) {
            results = setSystemAnalyzeCols();
        } else if ( theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_FLOW ) {
            results = setFlowAnalyzeCols();
        } else {
            results = setCompressorAnalyzeCols(myCompressors,new JTableFields());
        }

        return results;
    }

    private Vector setFlowAnalyzeCols() {
       // System.out.println("setFlowAnalyzeCols");
        JTableFields mytalbefields = new JTableFields();
        Vector flowlist=new Vector();
//        Vector flowvv=new Vector();
        //String strTmpOneRecordValieTime = "0";
        String flowFormat;
        if ( MeasurementUnit.FlowUnitResolution( strAirDeliveryUnit ) == 2 )
               // theLeakStat.flowUnit ) == 2 )
            flowFormat = FORMAT_STRING_2_DIGIT;
        else
            flowFormat = FORMAT_STRING_1_DIGIT;

       if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
            //mytalbefields.setName(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("System_Analyzes"));
       } else {
            //mytalbefields.setName( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Flow_Analyzes"));
       }
       //mytalbefields.setType("Load/Unload");
      
        //strTmpOneRecordValieTime =  String.format( FORMAT_STRING_1_DIGIT, ( theLeakStat. )).trim();
        //mytalbefields.setValid_record_time(strTmpOneRecordValieTime + "  " + TIME_UINT );
      
        //TotalCost
        mytalbefields.setTotal_costs( String.format(FORMAT_STRING_LONG, (long) theLeakStat.totalCost ).trim() );
       //CostPerM3
        mytalbefields.setCosts_per_m2(String.format(FORMAT_STRING_4_DIGIT, theLeakStat.airUnitCost ).trim());
// System.out.println("theLeakStat.airUnitCost="+theLeakStat.airUnitCost);
//        //averageflow
//        mytalbefields.setAverage_flow( String.format(flowFormat, theLeakStat.averageFlow ).trim() + "    " + theLeakStat.flowUnit );
//        //max flow
//        mytalbefields.setMax_flow( String.format(flowFormat,theLeakStat.maxFlow ).trim() + "    " + theLeakStat.flowUnit);
//        //TotalAir
//        mytalbefields.setTotal_air_delivery(String.format(FORMAT_STRING_LONG, theLeakStat.totalAirConsumption ).trim() + "    " + theLeakStat.airConsumptionUnit );
        //averageflow
        mytalbefields.setAverage_flow( String.format(flowFormat, theLeakStat.averageFlow ).trim() );
        //max flow
        mytalbefields.setMax_flow( String.format(flowFormat,theLeakStat.maxFlow ).trim() );
        //TotalAir
        mytalbefields.setTotal_air_delivery(String.format(FORMAT_STRING_LONG, theLeakStat.totalAirConsumption ).trim() );



        //TotalAirOneYear
//        mytalbefields.setOneyear_total_air_delivery(String.format(FORMAT_STRING_LONG, theLeakStat.totalAirConsumptionOneYear ).trim() + "    " + theLeakStat.airConsumptionUnit );
       mytalbefields.setOneyear_total_air_delivery(String.format(FORMAT_STRING_LONG, theLeakStat.totalAirConsumptionOneYear ).trim() );
        //TotalCostOneYear
        mytalbefields.setOneyear_total_costs( String.format(FORMAT_STRING_LONG, (long) theLeakStat.totalCostOneYear ).trim() );

//        System.out.println("theLeakStat.averageLeakage="+theLeakStat.averageLeakage);
        // leakage section
        if ( theLeakStat.averageLeakage > 0 ) {
            System.out.println("-----------");
            //AverageLeakage
//            mytalbefields.setAverage_leakage(String.format(FORMAT_STRING_1_DIGIT, theLeakStat.averageLeakage ).trim() + "    " + theLeakStat.flowUnit );
             mytalbefields.setAverage_leakage(String.format(flowFormat, theLeakStat.averageLeakage ).trim());
            //LeakageCost
            mytalbefields.setLeakage_costs(String.format(FORMAT_STRING_LONG, (long) theLeakStat.costOfLeakage ).trim() );
            //LeakageCostOneYear
            mytalbefields.setOneyear_leakage_costs(String.format(FORMAT_STRING_LONG, (long ) theLeakStat.costOfLeakageOneYear ).trim() );
//            //TotalLeakage
//            mytalbefields.setTotal_leakage(String.format(FORMAT_STRING_LONG, theLeakStat.totalLeakage ).trim() + "   " + theLeakStat.airConsumptionUnit);
//            //TotalLeakageOneYear
//            mytalbefields.setOneyear_total_leakage(String.format(FORMAT_STRING_LONG, theLeakStat.totalLeakageOneYear ).trim() + "   " + theLeakStat.airConsumptionUnit );
            //TotalLeakage
            mytalbefields.setTotal_leakage(String.format(FORMAT_STRING_LONG, theLeakStat.totalLeakage ).trim());
            //TotalLeakageOneYear
            mytalbefields.setOneyear_total_leakage(String.format(FORMAT_STRING_LONG, theLeakStat.totalLeakageOneYear ).trim() );

        }else {
              mytalbefields.setAverage_leakage(" ");
              mytalbefields.setLeakage_costs(" ");
              mytalbefields.setOneyear_leakage_costs(" ");
              mytalbefields.setTotal_leakage(" ");
              mytalbefields.setOneyear_total_leakage(" ");
        }
//System.out.println("-----mytalbefields.getAverage_leakage()------"+mytalbefields.getAverage_leakage());
//System.out.println("-----mytalbefields.getTotal_leakage()------"+mytalbefields.getTotal_leakage());
//System.out.println("-----mytalbefields.getLeakage_costs()------"+mytalbefields.getLeakage_costs());

        if ( theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM ) {
              mySystemTalbeFields = mytalbefields;
              return null;
        }else{
            flowlist.add(setTableFieldsValue(mytalbefields));
            return flowlist;
        }
    }

    private Vector setSystemAnalyzeCols(){
        mySystemTalbeFields = new JTableFields();
//        setFlowAnalyzeCols();
        return setCompressorAnalyzeCols(myCompressors,mySystemTalbeFields);
////        setFlowAnalyzeFields();
////        setCompressorAnalyzeFields();
//        Vector sysvv = new Vector();
//        Vector syslist=new Vector();
////        sysvv.add(" ");
////           sysvv.add(" ");
//           sysvv.add(" ");
//           sysvv.add( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("System_Analyzes"));
//           sysvv.add("Load/Unload type");
//           sysvv.add("Atlas copco 132");
//           sysvv.add(" ");
//           sysvv.add(" ");
//           sysvv.add(String.format(FORMAT_STRING_LONG, (long) theLeakStat.totalCostOneYear ).trim() + "   " + theLeakStat.currencyEnergyCost);
//           sysvv.add(String.format(FORMAT_STRING_LONG, theLeakStat.totalAirConsumption ).trim() + "    " + theLeakStat.airConsumptionUnit );
//           sysvv.add(String.format(FORMAT_STRING_LONG, theLeakStat.totalAirConsumptionOneYear ).trim() + "    " + theLeakStat.airConsumptionUnit );
//        syslist.add(sysvv);
//        return syslist;
    }

    private JTableFields setSingleTableLoadEnergyCostFieldsBaseOnCompressor( Compressor compressor, JTableFields myfields) {
//        JTableFields myfields = new JTableFields();

        //CompresorName
        //if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
            //myfields.setName(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("System_Analyzes"));
       //}else{
            myfields.setName(compressor.Description);
       //}
        
        //CompressorType
        myfields.setType(Compressor.COMPRESS_TYPE_TEXT[compressor.Type]);

        if ( compressor.Type == Compressor.COMPRESSOR_TYPE_LOAD_UNLOAD
                || compressor.Type == Compressor.COMPRESSOR_TYPE_VARIABLE_FREQUENCY ) {
            //FullLoadCost
            myfields.setFull_load_costs(String.format(FORMAT_STRING_LONG, (long) compressor.FullLoadEnergyCost).trim() );
            //FullLoadCostOneYear
            myfields.setOneyear_full_load_costs(String.format(FORMAT_STRING_LONG, (long) compressor.FullLoadEnergyCostOneYear).trim() );
            //FullLoadEnergy
            myfields.setFull_load_energy(String.format(FORMAT_STRING_1_DIGIT, compressor.FullLoadEnergyConsumption).trim() );
            //FullLoadEnergyOneYear
            myfields.setOneyear_full_load_energy(String.format(FORMAT_STRING_0_DIGIT, compressor.FullLoadEnergyConsumptionOneYear).trim() );
            //FullLoadTimeOneYear
            myfields.setOneyear_full_load_time(String.format(FORMAT_STRING_0_DIGIT, compressor.FullLoadHoursOneYear).trim() );
            //LoadChanges
//            myfields.setNumber_of_load_unload_cycles(String.format(FORMAT_STRING_INT, compressor.NumOfLoadChanges).trim() );
            myfields.setNumber_of_load_unload_cycles(String.format(FORMAT_STRING_INT, (compressor.NumOfLoad_UnloadChanges)).trim() );
            //LoadChangesOneYear
//            myfields.setOneyear_number_of_load_unload_cycles(String.format(FORMAT_STRING_0_DIGIT, compressor.NumOfLoadChangesOneYear).trim() );
            myfields.setOneyear_number_of_load_unload_cycles(String.format(FORMAT_STRING_0_DIGIT, (compressor.NumOfLoad_UnloadChangesOneYear)).trim() );
            //v3-1, add 20091014,be.
            //erery time when current value comes from below stop threshold to above stop
            //threshold, the number of starts of this compressor will be added by 1.
            //number of starts
            myfields.setNumber_of_starts(String.format(FORMAT_STRING_INT, compressor.NumStarts).trim() );
            //number of starts oneyear
            myfields.setOneyear_number_of_starts(String.format(FORMAT_STRING_0_DIGIT, compressor.NumStartsOneYear).trim() );


            //NoLoadCost
            myfields.setStop_costs(String.format(FORMAT_STRING_LONG, (long) compressor.NoLoadEnergyCost).trim() );
            //NoLoadCostOneYear
            myfields.setOneyear_stop_costs(String.format(FORMAT_STRING_LONG, (long) compressor.NoLoadEnergyCostOneYear).trim() );
            //NoLoadEnergy
            myfields.setStop_energy(String.format(FORMAT_STRING_1_DIGIT, compressor.NoLoadEnergyConsumption).trim() );
            //NoLoadEnergyOneYear
            myfields.setOneyear_stop_energy(String.format(FORMAT_STRING_0_DIGIT, compressor.NoLoadEnergyConsumptionOneYear).trim() );
            //NoLoadTimeOneYear
            myfields.setOneyear_stop_time(String.format(FORMAT_STRING_0_DIGIT, compressor.NoLoadHoursOneYear).trim() );

            //UnLoadCost
            myfields.setUnload_costs(String.format(FORMAT_STRING_LONG, (long) compressor.UnLoadEnergyCost).trim() );
            //UnLoadCostOneYear
            myfields.setOneyear_unload_costs(String.format(FORMAT_STRING_LONG, (long) compressor.UnLoadEnergyCostOneYear).trim() );
            //UnLoadEnergy
            myfields.setUnload_energy(String.format(FORMAT_STRING_1_DIGIT, compressor.UnLoadEnergyConsumption).trim() );
            //UnLoadEnergyOneYear
            myfields.setOneyear_unload_energy(String.format(FORMAT_STRING_0_DIGIT, compressor.UnLoadEnergyConsumptionOneYear).trim() );
            //UnLoadTimeOneYear
            myfields.setOneyear_unload_time(String.format(FORMAT_STRING_0_DIGIT, compressor.UnLoadHoursOneYear).trim() );

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
            //FullLoadTime
            myfields.setFull_load_time(String.format(FORMAT_STRING_1_DIGIT, compressor.FullLoadHours).trim() +
                    " (" + NumberFormat.getPercentInstance().format( fullLoadPer / 100f ) + ")" );
            //NoLoadTime
            myfields.setStop_time(String.format(FORMAT_STRING_1_DIGIT, compressor.NoLoadHours).trim() +
                    " (" + NumberFormat.getPercentInstance().format( noLoadPer / 100f ) + ")" );
            //UnLoadTime
            myfields.setUnload_time(String.format(FORMAT_STRING_1_DIGIT, compressor.UnLoadHours).trim() +
                    " (" + NumberFormat.getPercentInstance().format( unLoadPer / 100f ) + ")" );
        } else {
            //FullLoad
            myfields.setFull_load_costs( "" );
            myfields.setOneyear_full_load_costs( "" );
            myfields.setFull_load_energy( "" );
            myfields.setOneyear_full_load_energy( "" );
            myfields.setOneyear_full_load_time( "" );
            myfields.setNumber_of_load_unload_cycles( "" );
            myfields.setOneyear_number_of_load_unload_cycles( "" );

            //NoLoad
            myfields.setStop_costs( "" );
            myfields.setOneyear_stop_costs( "" );
            myfields.setStop_energy( "" );
            myfields.setOneyear_stop_energy( "" );
            myfields.setOneyear_stop_time( "" );

            //UnLoad
            myfields.setUnload_costs( "" );
            myfields.setOneyear_unload_costs( "" );
            myfields.setUnload_energy( "" );
            myfields.setOneyear_unload_energy( "" );
            myfields.setOneyear_unload_time( "" );

            //FullLoadTime NoLoadTime UnLoadTime
            myfields.setFull_load_time( "" );
            myfields.setStop_time( "" );
            myfields.setUnload_time( "" );
        }
        //TotalCost
        myfields.setTotal_costs(String.format(FORMAT_STRING_LONG, (long) compressor.TotalCost).trim()  );
        //TotalCostOneYear
        myfields.setOneyear_total_costs(String.format(FORMAT_STRING_LONG, (long) compressor.TotalCostOneYear).trim() );
        //TotalEnergyCost
        myfields.setTotal_energy_consumption(String.format(FORMAT_STRING_LONG, (long) compressor.TotalCost).trim() );
        //TotalEnergyCostOneYear
        myfields.setOneyear_total_energy_consumption(String.format(FORMAT_STRING_LONG, (long) compressor.TotalCostOneYear).trim() );
        //TotalEnergy
        myfields.setTotal_energy_consumption(String.format(FORMAT_STRING_1_DIGIT, compressor.TotalEnergyConsumption).trim() );
        //TotalEnergyOneYear
        myfields.setOneyear_total_energy_consumption(String.format(FORMAT_STRING_0_DIGIT, compressor.TotalEnergyConsumptionOneYear).trim() );
        //CO2Emmision
//        myfields.setCo2_emission( String.format(FORMAT_STRING_LONG, (long) compressor.CO2Emmision ).trim() + "   "
//                + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("kg") );
          if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
                myfields.setCo2_emission( String.format(FORMAT_STRING_LONG, (long) compressor.CO2Emmision ).trim() );
          }else{
                myfields.setCo2_emission(" ");
          }

        //CO2EmmisionOneYear
//        myfields.setOneyear_co2_emission( String.format(FORMAT_STRING_LONG, (long) compressor.CO2EmmisionOneYear ).trim() );
          if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
                 myfields.setOneyear_co2_emission( String.format(FORMAT_STRING_LONG, (long) compressor.CO2EmmisionOneYear ).trim() );
          }else{
                myfields.setOneyear_co2_emission(" ");
          }


        //add v3-6, 20091014.be
        //modify on 20091222.
        //reason : Wolfgang Blessing,Michael Kromer requirement.
        //         Sepecific power(kWh/m3) must have more digits. In this case 0.1 is not enough,
        //         It should be 0.129. 3 digits after the point.
        // myfields.setSpecific_power(String.format(FORMAT_STRING_LONG,(long)compressor.SpecificPower).trim());
        myfields.setSpecific_power(String.format(FORMAT_STRING_3_DIGIT,compressor.SpecificPower).trim());

        // leakage
        if ( theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_COMPRESSOR ) {
            if ( compressor.LeakageCost > 0 ) {
                //LeakageCost
                myfields.setLeakage_costs(String.format(FORMAT_STRING_LONG, (long) compressor.LeakageCost) );
                //LeakageCostOneYear
                myfields.setOneyear_leakage_costs(String.format(FORMAT_STRING_LONG, (long) compressor.LeakageCostOneYear ) );
            } else {
                myfields.setLeakage_costs( "" );
                myfields.setOneyear_leakage_costs( "" );
            }
        }
        return myfields;
    }

     private JTableFields setSingleTableFlowFieldsBaseOnCompressor( Compressor compressor,JTableFields myfields ) {
//         System.out.println("compressor.TotalAirDeliveryAmount="+compressor.TotalAirDeliveryAmount);
        if ( compressor.TotalAirDeliveryAmount > 0 ) {
            //CostPerM3
            myfields.setCosts_per_m2(String.format(FORMAT_STRING_4_DIGIT, compressor.AirUnitCost ).trim() );
            String airConsumptionUnit = compressor.AirDeliveryUnit;
            if ( airConsumptionUnit.indexOf( "/" ) > 0 )
                airConsumptionUnit = airConsumptionUnit.substring( 0, airConsumptionUnit.indexOf( "/" ));
            String flowFormat;
            if ( MeasurementUnit.FlowUnitResolution( compressor.AirDeliveryUnit ) == 2 )
                flowFormat = FORMAT_STRING_2_DIGIT;
            else
                flowFormat = FORMAT_STRING_1_DIGIT;
            //AverageFlow
            myfields.setAverage_flow(String.format(flowFormat, compressor.AverageFlow ).trim() );
            //MaxFlow
            myfields.setMax_flow( String.format(flowFormat,compressor.MaxFlow ).trim() );
            //TotalAir
            myfields.setTotal_air_delivery( String.format(FORMAT_STRING_LONG, compressor.TotalAirDeliveryAmount ).trim() );
            //TotalAirOneYear
            myfields.setOneyear_total_air_delivery(String.format(FORMAT_STRING_LONG, compressor.TotalAirDeliveryAmountOneYear ).trim() );
            //jLabelFlowUnit.setText( compressor.AirDeliveryUnit );
        } else {
            myfields.setCosts_per_m2( "" );
            myfields.setAverage_flow( "" );
            myfields.setMax_flow( "" );
            myfields.setTotal_air_delivery( "" );
            myfields.setOneyear_total_air_delivery( "" );
        }

        // leakage
        System.out.println(" compressor.AverageLeakage ="+ compressor.AverageLeakage );
        if ( compressor.AverageLeakage > 0 ) {
            //AverageLeakage
            myfields.setAverage_leakage(String.format(FORMAT_STRING_2_DIGIT, compressor.AverageLeakage ).trim() );
            //jLabelTotalLeakage.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakage).trim() );
            //jLabelTotalLeakageOneYear.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakageOneYear).trim() );
            //LeakageCostOneYear
            myfields.setOneyear_leakage_costs(String.format(FORMAT_STRING_LONG, (long) compressor.LeakageCostOneYear ).trim() );
            //TotalLeakage
            myfields.setTotal_leakage(String.format(FORMAT_STRING_LONG, compressor.TotalLeakage ).trim() );
            //TotalLeakageOneYear
            myfields.setOneyear_total_leakage(String.format(FORMAT_STRING_LONG, compressor.TotalLeakageOneYear ).trim());
            //LeakageCost
            myfields.setLeakage_costs(String.format(FORMAT_STRING_LONG, (long) compressor.LeakageCost ).trim()  );
        } else {
            myfields.setAverage_leakage( "" );
            //jLabelTotalLeakage.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakage).trim() );
            //jLabelTotalLeakageOneYear.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakageOneYear).trim() );
            myfields.setOneyear_leakage_costs( "" );
            myfields.setTotal_leakage( "" );
            myfields.setOneyear_total_leakage( "" );
            myfields.setLeakage_costs( "" );
        }
        return myfields;
    }

//      private JTableFields setSystemAnalyzeFlowFieldsByCompressor( Compressor compressor,JTableFields myfields ) {
////          System.out.println("setSystemAnalyzeFlowFieldsByCompressor compressor.TotalAirDeliveryAmount="+compressor.TotalAirDeliveryAmount);
//          if ( compressor.TotalAirDeliveryAmount > 0 ) {
//
//            String airConsumptionUnit = compressor.AirDeliveryUnit;
//            if ( airConsumptionUnit.indexOf( "/" ) > 0 )
//                airConsumptionUnit = airConsumptionUnit.substring( 0, airConsumptionUnit.indexOf( "/" ));
//            String flowFormat;
//            if ( MeasurementUnit.FlowUnitResolution( compressor.AirDeliveryUnit ) == 2 )
//                flowFormat = FORMAT_STRING_2_DIGIT;
//            else
//                flowFormat = FORMAT_STRING_1_DIGIT;
//            //AverageFlow
//            myfields.setAverage_flow(String.format(flowFormat, compressor.AverageFlow ).trim() );
//            //MaxFlow
//            myfields.setMax_flow( String.format(flowFormat,compressor.MaxFlow ).trim() );
//            //TotalAir
//            myfields.setTotal_air_delivery( String.format(FORMAT_STRING_LONG, compressor.TotalAirDeliveryAmount ).trim() );
//            //TotalAirOneYear
//            myfields.setOneyear_total_air_delivery(String.format(FORMAT_STRING_LONG, compressor.TotalAirDeliveryAmountOneYear ).trim()  );
//            //jLabelFlowUnit.setText( compressor.AirDeliveryUnit );
//        } else {
////            myfields.setCosts_per_m2( "" );
//            myfields.setAverage_flow( "" );
//            myfields.setMax_flow( "" );
//            myfields.setTotal_air_delivery( "" );
//            myfields.setOneyear_total_air_delivery( "" );
//        }
//
//        //add by be on 20100623, MK's requirement
//        // leakage
//        System.out.println(" compressor.AverageLeakage ="+ compressor.AverageLeakage );
//        if ( compressor.AverageLeakage > 0 ) {
//            //AverageLeakage
//            myfields.setAverage_leakage(String.format(FORMAT_STRING_2_DIGIT, compressor.AverageLeakage ).trim() );
//            //jLabelTotalLeakage.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakage).trim() );
//            //jLabelTotalLeakageOneYear.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakageOneYear).trim() );
//            //LeakageCostOneYear
//            myfields.setOneyear_leakage_costs(String.format(FORMAT_STRING_LONG, (long) compressor.LeakageCostOneYear ).trim() );
//            //TotalLeakage
//            myfields.setTotal_leakage(String.format(FORMAT_STRING_LONG, compressor.TotalLeakage ).trim()  );
//            //TotalLeakageOneYear
//            myfields.setOneyear_total_leakage(String.format(FORMAT_STRING_LONG, compressor.TotalLeakageOneYear ).trim()  );
//            //LeakageCost
//            myfields.setLeakage_costs(String.format(FORMAT_STRING_LONG, (long) compressor.LeakageCost ).trim()  );
//        } else {
//            myfields.setAverage_leakage( "" );
//            //jLabelTotalLeakage.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakage).trim() );
//            //jLabelTotalLeakageOneYear.setText(String.format(FORMAT_STRING_LONG, compressor.TotalLeakageOneYear).trim() );
//            myfields.setOneyear_leakage_costs( "" );
//            myfields.setTotal_leakage( "" );
//            myfields.setOneyear_total_leakage( "" );
//            myfields.setLeakage_costs( "" );
//        }
//
//        return myfields;
//    }

//     public void paintColorRow()
//    {
//        TableColumnModel tcm = this.getColumnModel();
//        for (int i = 0, n = tcm.getColumnCount(); i < n; i++)
//        {
//            TableColumn tc = tcm.getColumn(i);
//            tc.setCellRenderer(new RowColorRenderer());
//        }
//    }

     /**
     *  set row background color.
     * ???????R 94, G 104, B 110
     * ?2??????R 121, G 137, B 146
     * ???????R 150 G174 B 190
     */
    private Color colFir = new Color(94,104,110);
    private Color colSec = new Color(121,137,146);
    private Color colThi = new Color(150,174,190);
    private class RowColorRenderer extends DefaultTableCellRenderer
    {
        public Component getTableCellRendererComponent(JTable t, Object value,
                    boolean isSelected, boolean hasFocus, int row, int column)
        {
             if (row == 0){
                setBackground(colFir);
                setForeground(java.awt.Color.white);
             }else{
                 if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
                     if (row == 3 || row == 38 ){
                        setBackground(colSec);
                     }else{
                         if (row == 11 || row == 18 || row == 25 || row == 30 || row == 35 || row == 46 || row == 52 || row == 58 || row == 61 || row == 65){
                             setBackground(colThi);
                         }else{
                             setBackground(java.awt.Color.WHITE);
                             setForeground(java.awt.Color.black);
                         }
                     }
                 }else{
                      if (row == 3 || row == 35 ){
                        setBackground(colSec);
                     }else{
                         if (row == 11 || row == 18 || row == 25 || row == 30 || row == 43 || row == 49 || row == 55 || row == 58 ){
                             setBackground(colThi);
                         }else{
                             setBackground(java.awt.Color.WHITE);
                             setForeground(java.awt.Color.black);
                         }
                     }
                 }
             }

            return super.getTableCellRendererComponent(t, value, isSelected,
                    hasFocus, row, column);


        }
    }


    class   Test   extends   DefaultTableCellRenderer{

          /*   (non-Javadoc)
            *   @see   javax.swing.table.TableCellRenderer#getTableCellRendererComponent(javax.swing.JTable,   java.lang.Object,   boolean,   boolean,   int,   int)
            */
          public   Component   getTableCellRendererComponent(JTable   table,
                          Object   value,
                          boolean   isSelected,
                          boolean   hasFocus,
                          int   row,
                          int   column)   {
                JLabel   label   =   (JLabel)super.getTableCellRendererComponent(table,value,isSelected,hasFocus,row,column);
                label.setToolTipText("....");
                return   label;
          }

  }

private void MouseMoved(java.awt.event.MouseEvent evt) {
     if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){

     }
}


    //added on 20130606 -------------- begin
    private Vector setCompressorSingleVector(JTableFields mytalbefields){
        Vector vv=new Vector();

        vv.add(mytalbefields.getName());
        vv.add(mytalbefields.getType());

        vv.add(" ");

        vv.add(mytalbefields.getValid_record_time());

        vv.add(" ");
        //load analyzes
        vv.add(mytalbefields.getFull_load_time());
        vv.add(mytalbefields.getUnload_time());
        vv.add(mytalbefields.getStop_time());//i donot know this value how to get
        vv.add(mytalbefields.getNumber_of_starts()); //number of starts
        vv.add(mytalbefields.getNumber_of_load_unload_cycles());//number of load/unload cycles

        //energy
        vv.add(" ");
        vv.add(" ");
        String strTmpFull = mytalbefields.getFull_load_energy();
        String strTmpUnload = mytalbefields.getUnload_energy();
        String strTmpStop = mytalbefields.getStop_energy();
        Float floatTotal = Float.valueOf( GUIConst.VerifyString(strTmpFull) )+
                Float.valueOf( GUIConst.VerifyString(strTmpUnload) ) + 
                Float.valueOf( GUIConst.VerifyString(strTmpStop) );
        vv.add(strTmpFull);
        vv.add(strTmpUnload);
        vv.add(strTmpStop);
        vv.add( String.format( FORMAT_STRING_1_DIGIT ,floatTotal ).trim() );

        if("0".equals(mytalbefields.getSpecific_power())){
            vv.add("0.000");
        }else{
            vv.add(mytalbefields.getSpecific_power());
        }

        //costs
        vv.add(" ");
        vv.add(" ");

        strTmpFull = mytalbefields.getFull_load_costs();
        strTmpUnload = mytalbefields.getUnload_costs();
        strTmpStop = mytalbefields.getStop_costs();
        vv.add(strTmpFull);
        vv.add(strTmpUnload);
        vv.add(strTmpStop);

        floatTotal = Float.valueOf( GUIConst.VerifyString(strTmpFull))+Float.valueOf( GUIConst.VerifyString(strTmpUnload))+Float.valueOf( GUIConst.VerifyString(strTmpStop));
        vv.add(floatTotal.intValue());

        String costPerM3 = "0";
        if(Double.valueOf(mytalbefields.getTotal_air_delivery()) > 0){
            costPerM3 = String.format(FORMAT_STRING_4_DIGIT, floatTotal/Double.valueOf(mytalbefields.getTotal_air_delivery().trim())).trim();
            vv.add(costPerM3);
        }else{
            costPerM3 = mytalbefields.getCosts_per_m2();
            vv.add(costPerM3);
        }

        //air delivery
        vv.add(" ");
        vv.add(" ");
        if(mytalbefields.getValid_record_time().isEmpty()){
            vv.add(mytalbefields.getAverage_flow());
        }else{
            if(Double.valueOf( GUIConst.VerifyString(mytalbefields.getValid_record_time().split(" ")[0].trim()) ) > 0){
                mytalbefields.setAverage_flow(String.format(FORMAT_STRING_1_DIGIT, (Double.valueOf( GUIConst.VerifyString(mytalbefields.getTotal_air_delivery().trim()))/Double.valueOf( GUIConst.VerifyString(mytalbefields.getValid_record_time().split(" ")[0].trim())))/averageFlowDiviedMum).trim());
            }else{
                mytalbefields.setAverage_flow(mytalbefields.getAverage_flow());
            }
            vv.add(mytalbefields.getAverage_flow());
        }

        vv.add(mytalbefields.getMax_flow());
        vv.add(mytalbefields.getTotal_air_delivery());

        //leakage
        vv.add(" ");
        vv.add(" ");
//        String strAverageLeakage = mytalbefields.getAverage_leakage();
//        if(strAverageLeakage != null)
//            if("".equals(strAverageLeakage.trim()))
//                strAverageLeakage = "0";
//        if("0.0".equals(strAverageLeakage) || "0".equals(strAverageLeakage) ){
            vv.add(ZERO_LEAKAGE_STRING);
//        }else{
//            vv.add(strAverageLeakage);
//        }
//        String strTotalLeakage = mytalbefields.getTotal_leakage();
//        if( "0".equals(strTotalLeakage)){
            vv.add(ZERO_LEAKAGE_STRING);
//        }else{
//            vv.add(strTotalLeakage);
//        }

//        String strLeakageCosts = "0";
//
//        Float leakageCosts = Float.valueOf( GUIConst.VerifyString(strTotalLeakage))*Float.valueOf( GUIConst.VerifyString(costPerM3));
//        strLeakageCosts = String.valueOf(leakageCosts.intValue());
//
//        if("0".equals(strLeakageCosts)){
            vv.add(ZERO_LEAKAGE_STRING);
//        }else{
//            vv.add(strLeakageCosts);
//        }

        if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
            //co2 emission
            vv.add(" ");
            vv.add(" ");
            vv.add(mytalbefields.getCo2_emission());
        }

        //one year load analyzes
        vv.add(" ");
        vv.add(" ");
        vv.add(" ");
        vv.add(mytalbefields.getOneyear_full_load_time());
        vv.add(mytalbefields.getOneyear_unload_time());
        vv.add(mytalbefields.getOneyear_stop_time());//i donot know this value how to get
        vv.add(mytalbefields.getOneyear_number_of_starts()); //number of starts
        vv.add(mytalbefields.getOneyear_number_of_load_unload_cycles());//number of load/unload cycles

        //one year energy
        vv.add(" ");
        vv.add(" ");

        strTmpFull = mytalbefields.getOneyear_full_load_energy();
        strTmpUnload = mytalbefields.getOneyear_unload_energy();
        strTmpStop = mytalbefields.getOneyear_stop_energy();
        floatTotal = Float.valueOf( GUIConst.VerifyString(strTmpFull))+Float.valueOf( GUIConst.VerifyString(strTmpUnload))+Float.valueOf( GUIConst.VerifyString(strTmpStop));
        vv.add(strTmpFull);
        vv.add(strTmpUnload);
        vv.add(strTmpStop);
        vv.add(floatTotal.intValue());

        //one year costs
        vv.add(" ");
        vv.add(" ");

        strTmpFull = mytalbefields.getOneyear_full_load_costs();
        strTmpUnload = mytalbefields.getOneyear_unload_costs();
        strTmpStop = mytalbefields.getOneyear_stop_costs();
        vv.add(strTmpFull);
        vv.add(strTmpUnload);
        vv.add(strTmpStop);

        floatTotal = Float.valueOf( GUIConst.VerifyString(strTmpFull))+Float.valueOf( GUIConst.VerifyString(strTmpUnload))+Float.valueOf( GUIConst.VerifyString(strTmpStop));        
        vv.add(floatTotal.intValue());

        //one year air delivery
        vv.add(" ");
        vv.add(" ");
        vv.add(mytalbefields.getOneyear_total_air_delivery());

        //one year leakage
        vv.add(" ");
        vv.add(" ");

//        String strOneYearTotalLeakage = mytalbefields.getOneyear_total_leakage();
//        if( "0".equals(strOneYearTotalLeakage)){
            vv.add(ZERO_LEAKAGE_STRING);
//        }else{
//            vv.add(strOneYearTotalLeakage);
//        }

//        String strOneYearLeakageCosts = "0";         
//        leakageCosts = Float.valueOf( GUIConst.VerifyString(strOneYearTotalLeakage))*Float.valueOf( GUIConst.VerifyString(costPerM3));
//        strOneYearLeakageCosts = String.valueOf(leakageCosts.intValue());
//
//        if("0".equals(strOneYearLeakageCosts)){
            vv.add(ZERO_LEAKAGE_STRING);
//        }else{
//            vv.add(strOneYearLeakageCosts);
//        }

        if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
            //one year co2 emission
            vv.add(" ");
            vv.add(" ");
            vv.add(mytalbefields.getOneyear_co2_emission());
        }

        return vv;
    }

//added on 20130606 -------------- end

}

