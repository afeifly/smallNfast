package com.cs.canalyzer.print.printing;

import java.awt.Font;
import javax.swing.table.TableModel;

/**
 * Converts a TableModel to a PrintableTableModel
 * @author tonyj
 * @version $Id: PrintModelAdapter.java,v 1.1 2007/04/12 12:34:19 msu Exp $
 */
public class PrintModelAdapter implements PrintableTableModel {
   private TableModel model;
   private String title;
   public boolean hasHeader;
   public Font cellFont;
   // modified by me on 2007.1.19
   private CellPrinter headerPrinter = new DefaultCellPrinter(DefaultCellPrinter.ALIGN_LEFT);
   //private CellPrinter headerPrinter = new DefaultCellPrinter(DefaultCellPrinter.ALIGN_CENTER);
   //private CellPrinter textPrinter = new DefaultCellPrinter(DefaultCellPrinter.ALIGN_CENTER);
   private CellPrinter textPrinter = new DefaultCellPrinter(DefaultCellPrinter.ALIGN_LEFT);
   private CellPrinter numberPrinter = new NumberCellPrinter();
   /** Creates a new instance of PrintModelAdapter
    * @param model The table model to convert
    * @param title The title for the generater PrintableTableModel
    */
   public PrintModelAdapter(TableModel model, String title, boolean hasHeader, Font cellFont) {
      this.model = model;
      this.title = title;
      this.hasHeader = hasHeader;
      this.cellFont = cellFont;
   }
   
   public CellPrinter getCellPrinter(int column) {
      //modified by me on 2007.1.19
      //return textPrinter;
      return Number.class.isAssignableFrom(model.getColumnClass(column)) ? numberPrinter : textPrinter;
   }
   
   public CellPrinter getHeaderPrinter(int column) {
      return headerPrinter;
   }
   
   public String getTitle() {
      return title;
   }
   
   public Object headerForColumn(int i) {
      return model.getColumnName(i);
   }
   
   public boolean hideColumn(int i) {
      return false;
   }
   
   public int numberOfColumns() {
      return model.getColumnCount();
   }
   
   public int numberOfRows() {
      return model.getRowCount();
   }
   
   public Object valueAt(int i, int j) {
      return model.getValueAt(i,j);
   }
}
