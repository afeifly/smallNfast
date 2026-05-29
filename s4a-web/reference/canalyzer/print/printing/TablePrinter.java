package com.cs.canalyzer.print.printing;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.font.FontRenderContext;
import java.awt.geom.Line2D;
import java.awt.geom.Point2D;
import java.awt.geom.Rectangle2D.Float;
import java.awt.print.PageFormat;
import java.awt.print.Pageable;
import java.awt.print.Printable;

import javax.swing.table.TableModel;

/** Utility for printing tables. */
public class TablePrinter implements Pageable, Printable {
   private Font cellFont;
   private Font headerFont;
   private FontRenderContext lastFontRenderContext;
   private PageFormat pf;
   private PrintableTableModel model;
   private float[] widths;
   private float headerHeight;
   private float rowHeight;
   private int nPages = UNKNOWN_NUMBER_OF_PAGES;
   private int rowsPerPage;
   private Point2D.Double pen;
   private boolean hasHeader;
   public static final int SPACE_BELOW_TABLE_HEADER = 0;
   public static final int SPACE_BELOW_TABLE_TOP = 2;
   public static final int SPACE_BELOW_TABLE = 2;
   
   /** Create a TablePrinter from a PrintableTableModel
    * @param model The table model to print
    * @param pf The page format to use for printing
    * @param headerFont The font to be used for the table header
    * @param cellFont The font to be used for the cells in the body of the table.
    * @param frc The font render context for the printing device
    */
   public TablePrinter(PrintableTableModel model, PageFormat pf, Font headerFont,
           Font cellFont, FontRenderContext frc, Point2D.Double pen) {
      this.pf = pf;
      this.model = model;
      this.headerFont = headerFont;
      this.cellFont = cellFont;
      this.pen = pen;
      hasHeader = ((PrintModelAdapter)model).hasHeader;
      calculateTableSize(pf, frc);
   }
   /** Create a TablePrinter from a TableModel
    * @param model The table model to print
    * @param title The title to use for the print job
    * @param pf The page format to use for printing
    * @param headerFont The font to be used for the table header
    * @param cellFont The font to be used for the cells in the body of the table.
    * @param frc The font render context for the printing device
    */
   public TablePrinter(TableModel model, String title, PageFormat pf, Font headerFont, Font cellFont, FontRenderContext frc, Point2D.Double pen) {
      this(new PrintModelAdapter(model, title, true, null),pf,headerFont,cellFont,frc,pen);
   }
   
   public int getNumberOfPages() {
      return nPages;
   }
   
   public PageFormat getPageFormat(int p1) {
      return pf;
   }
   
   public Printable getPrintable(int p1) {
      return this;
   }
   
   public int print(Graphics g, PageFormat pf, int page) {
      Graphics2D g2 = (Graphics2D) g;
      FontRenderContext frc = g2.getFontRenderContext();
      if (!frc.equals(lastFontRenderContext)) {
         calculateTableSize(pf, frc);
      }
      
      if (page >= nPages) {
         return NO_SUCH_PAGE;
      }
      
      g2.setColor(Color.black);
      g2.setStroke(new BasicStroke(0));
      
      // modified by by me on 2007.1.19
      // set to 0 because g was already scaled before this method is invoked
      float xx = (float)pen.x;
      float yy;
      if (page == 0) {
         yy = (float)pen.y;
      } else {
         yy = 0;
      }
//      float xx = (float) pf.getImageableX();
//      float yy = (float) pf.getImageableY();
      
      float totalWidth = 4;
      for (int i = 0; i < widths.length; i++) {
         if (widths[i] > 0) {
            totalWidth += (widths[i] + 3);
         }
      }
      // by me
      float y;
      float x;
//      float y = 4 + xx;  // Serious bug! yy should be used instead of xx.
//      float x = 4 + yy;  // Serious bug!
      Float rect = new Float();
      // print table header
      if (hasHeader) {
         y = yy + 4;
         x = xx + 4;
         
         for (int c = 0; c < model.numberOfColumns(); c++) {
            if (widths[c] == 0) {
               continue;
            }
            rect.setRect(x, y, widths[c], headerHeight);
            
            CellPrinter cp = model.getHeaderPrinter(c);
            cp.setFont(headerFont);
            cp.setValue(model.headerForColumn(c));
            cp.print(g, rect);
            x += (widths[c] + 3);
         }
         y += (headerHeight + SPACE_BELOW_TABLE_HEADER);
      } else {
         y = yy + SPACE_BELOW_TABLE_TOP;
         x = xx;
      }
      
      Line2D line = new java.awt.geom.Line2D.Float();
      // print all rows on a page
      for (int r = page * getRowsPerPage(); r < ((page + 1) * getRowsPerPage()); r++) {
         if (r >= model.numberOfRows()) {
            break;
         }
         
         x = 4 + xx;
         // print all cells in a row
         for (int c = 0; c < model.numberOfColumns(); c++) {
            if (widths[c] == 0) {
               continue;
            }
            rect.setRect(x, y, widths[c], rowHeight);
            
            CellPrinter cp = model.getCellPrinter(c);
            cp.setFont(cellFont);
            cp.setValue(model.valueAt(r, c));
            cp.print(g, rect);  // print a cell value
            x += (widths[c] + 3);
         }
         if (hasHeader == true || r != 0) {
            line.setLine(xx, y - 1, xx + totalWidth, y - 1);
            //g2.draw(line); // draw a horizontal line between two adjacent rows
         }
         //y += (rowHeight + 1);
         y += rowHeight;
      }
      
      x = xx + 2;
      for (int c = 0; c < (model.numberOfColumns() - 1); c++) {
         if (widths[c] == 0) {
            continue;
         }
         x += (widths[c] + 3);
         line.setLine(x, yy + 2, x, y);
         //g2.draw(line); // draw a vertial line between 2 adjacent columns
      }
      
      g2.setStroke(new BasicStroke(2)); // use thicker line for table border
      // changed by me on 2007.1.19
      rect.setRect(xx, yy + 2, totalWidth, y - yy);  // move the rect closer to top left corner
      //rect.setRect(xx + 1, yy + 2, totalWidth, y - yy);
      //g2.draw(rect);  // draw a rect around whole table
      
      // print a footer at  bottom of page
//      String footer = "Page " + (page + 1) + " of " + nPages; // +"   header="+headerFont+" cell="+cellFont;
      //g2.drawString(footer, xx, (yy + (float) pf.getImageableHeight()) - g.getFontMetrics().getDescent());
      if (model.numberOfRows() < 2) {
         pen.y = y + SPACE_BELOW_TABLE; // move pen to bottom of table
      } else {
         pen.y = y;
      }
      return PAGE_EXISTS;
   }
   
   /** Go over every cell in this table to determine the proper width and height
    * for all cells and in the end, calculate the total No. of rows for a page
    * and the No. of pages required.
    * @Parameters:
    * pf - the PageFormat object to be used to to get the printable area's
    * height and thus determine the number of rows displayed on each page
    */
   private void calculateTableSize(PageFormat pf, FontRenderContext frc) {
      lastFontRenderContext = frc;
      
      double height = pf.getImageableHeight();
      
      widths = new float[model.numberOfColumns()];
      headerHeight = 0;
      rowHeight = 0;
      
      for (int c = 0; c < model.numberOfColumns(); c++) { //go over every column
         if (model.hideColumn(c)) {
            continue;
         }
         
         float h;
         //if (hasHeader) {
         CellPrinter hp = model.getHeaderPrinter(c);
         hp.setFont(headerFont);
         hp.setValue(model.headerForColumn(c));
         widths[c] = hp.getWidth(frc);
         
         h = hp.getHeight(frc);
         if (h > headerHeight) { //if this header cell is higher than previous one
            headerHeight = h;
         }
         //}
         
         CellPrinter cp = model.getCellPrinter(c);
         cp.setFont(cellFont);
         
         // check every row in this column to determine the proper width and
         // height for all rows
         for (int r = 0; r < model.numberOfRows(); r++) {
            cp.setValue(model.valueAt(r, c));
            
            float w = cp.getWidth(frc);
            if (w > widths[c]) { // if body cell is wider than header cell or
               widths[c] = w;    // the previous body cell
            }
            h = cp.getHeight(frc);
            if (h > rowHeight) { // if this row is higher than the previous row
               rowHeight = h;
            }
         }
      }
      
      int nRows = model.numberOfRows();
      
      // leave room for header and footer
      double effectiveHeight = height - headerHeight - 6 - rowHeight;
      rowsPerPage = (int) Math.floor(effectiveHeight / (rowHeight + 1));
      
      nPages = 1 + ((nRows - 1) / getRowsPerPage());
   }
   
   public int getRowsPerPage() {
      return rowsPerPage;
   }
}