package com.cs.canalyzer.print.printing;

import java.util.ArrayList;

import javax.swing.table.AbstractTableModel;

public class GenericTableModel extends AbstractTableModel {
    private static final long serialVersionUID = 1L;
    
    private String[] columnNames;
    
    ArrayList<ArrayList<Object>> data;
    
    public GenericTableModel(ArrayList<ArrayList<Object>> reports, String[] columnNames) {
        this.data = reports;
        this.columnNames = columnNames;
    }
    
    public int getColumnCount() {
        return columnNames.length;
    }
    
    public int getRowCount() {
        return data.size();
    }
    
    public String getColumnName(int col) {
        return columnNames[col];
    }
    
    public Object getValueAt(int row, int col) {
        ArrayList<Object> aRow = data.get(row);
        Object cellValue = aRow.get(col);
        if (cellValue == null) {
            return "";
        }  else {
            return cellValue;
        }
    }
        /* JTable uses this method to determine the default renderer/ editor for
         * each cell. If we didn't implement this method, then the last column would
         * contain text ("true"/"false"), rather than a check box.
         */
    public Class getColumnClass(int c) {
        return getValueAt(0, c).getClass();
    }
}
