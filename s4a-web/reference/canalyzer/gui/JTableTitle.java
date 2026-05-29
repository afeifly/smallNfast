/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.cs.canalyzer.gui;

import com.cs.canalyzer.gui.GUIConst;
import com.cs.canalyzer.structs.CommonValue;
import com.cs.canalyzer.structs.Compressor;
import com.cs.canalyzer.structs.LeakStatistics;
import java.awt.Color;
import java.awt.Component;
import java.util.ArrayList;
import javax.swing.JTable;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.DefaultTableModel;
import javax.swing.table.TableCellRenderer;

/**
 *
 * @author be
 */
public class JTableTitle {
        private DefaultTableModel tableModel = new DefaultTableModel() {

        /**//*
         * ?? Javadoc?
         *
         * @see javax.swing.table.DefaultTableModel#getColumnCount()
         */
        @Override
        public int getColumnCount() {
            return 2;
        }

        /**//*
         * ?? Javadoc?
         *
         * @see javax.swing.table.DefaultTableModel#getRowCount()
         */
        @Override
        public int getRowCount() {
            return 2;
        }

    };

    private JTable table ;//= new JTable(tableModel);
    private LeakStatistics theLeakStat;

//    private final String FORMAT_STRING_1_DIGIT = "%10.1f";
//    private final String TIME_UINT = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("__Hours");

    public JTableTitle(CommonValue commonValue){

         //add on 20100330 , MS's requirtment, add color into table --- begin
          final   RowColorRenderer   rcr   =   new   RowColorRenderer();
          table = new JTable(tableModel){
              public  TableCellRenderer  getCellRenderer(int   row,   int   column) {
                   return   rcr;
              }
           };
           //----------- end

         theLeakStat = commonValue.getLeakStatistics();
    }

    public JTable setTitle(){
          table.setValueAt(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Statistics_for_the_selected_time_period:")+GUIConst.DEFAULT_DATE_AND_TIME_FORMAT( theLeakStat.getStartTime())
                 +" "+ java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("_to_") +GUIConst.DEFAULT_DATE_AND_TIME_FORMAT( theLeakStat.getEndTime()), 0,1);

//          //modify 20091014.
//         if ( theLeakStat.analyzeType != LeakStatistics.ANALYZE_TYPE_FLOW ){
//             int size = theLeakStat.getCompressors().size();
//             double validrecordtime = 0;
//             if(size > 0){
//                 ArrayList<Compressor> compressors = theLeakStat.getCompressors();
//                 for(int i =0;i<size;i++){
//                    validrecordtime += compressors.get(i).TotalHours;
//                 }
//             }
//             table.setValueAt("valid record time : "+String.format( FORMAT_STRING_1_DIGIT,
//                        validrecordtime).trim() + "  " + TIME_UINT, 1,1);
//
//         }

//         else{
//             table.setValueAt("valid record time : ", 1,1);
//         }
         table.getColumnModel().getColumn(0).setPreferredWidth(20);
         table.getColumnModel().getColumn(0).setMaxWidth(20);
         table.getColumnModel().getColumn(0).setMinWidth(20);
         table.setValueAt("1", 0, 0);
         table.setValueAt("2", 1, 0);
         
         // analyzes type
         String type = "";
         switch ( theLeakStat.analyzeType ) {
             case LeakStatistics.ANALYZE_TYPE_COMPRESSOR: type = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Compressor_Analyzes"); break;
             case LeakStatistics.ANALYZE_TYPE_FLOW: type = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Flow_Analyzes"); break;
             case LeakStatistics.ANALYZE_TYPE_SYSTEM: type = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("System_Analyzes"); break;
             default: break;
         }
         table.setValueAt( type, 1, 1 );
         
         table.setSelectionBackground(Color.WHITE);
         return table;
    }

      /**
     *  set row background color.
     * ???????R 94, G 104, B 110
     * ?2??????R 121, G 137, B 146
     * ???????R 150 G174 B 190
     */
    private Color colFir = new Color(94,104,110);
    private class RowColorRenderer extends DefaultTableCellRenderer
    {
        public Component getTableCellRendererComponent(JTable t, Object value, boolean isSelected, boolean hasFocus, int row, int column)
        {
             if (row == 0){
                setBackground(colFir);
                setForeground(java.awt.Color.white);
             }else{
                 setBackground(java.awt.Color.WHITE);
                 setForeground(java.awt.Color.black);
             }

            return super.getTableCellRendererComponent(t, value, isSelected,
                    hasFocus, row, column);


        }
    }
}
