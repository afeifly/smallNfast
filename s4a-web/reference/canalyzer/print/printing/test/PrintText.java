/*
 * PrintText.java
 *
 * Created on July 9, 2007, 6:46 PM
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.print.printing.test;

import java.awt.print.Book;
import java.awt.print.PageFormat;
import java.awt.print.Paper;
import java.awt.print.PrinterException;
import java.awt.print.PrinterJob;

/**
 *
 * @author ll
 */
public class PrintText {
   
   /** Creates a new instance of PrintText */
   public PrintText() {
   }
   /**
    * Print a single page containing some sample text.
    */
   static public void main(String args[]) {/* Get the representation of the current printer and
    * the current print job.
    */
      PrinterJob printerJob = PrinterJob.getPrinterJob();
/* Let the user choose a paper size and orientation.
 */
      PageFormat format = new PageFormat();
      format = printerJob.pageDialog(format);
/* Build a book containing pairs of page painters (Printables)
 * and PageFormats. This example has a single page containing
 * text.
 */
      Book book = new Book();
      PageFormat pf = new PageFormat();
      pf.setOrientation(PageFormat.LANDSCAPE);
      pf.setPaper(new Paper());
      //book.append(new PageSetupText(), pf);
      book.append(new PageSetupText(), format);
      
/* Set the object to be printed (the Book) into the PrinterJob.
 * Doing this before bringing up the print dialog allows the
 * print dialog to correctly display the page range to be printed
 * and to dissallow any print settings not appropriate for the
 * pages to be printed.
 */
      //printerJob.setPageable(book);
/* Show the print dialog to the user. This is an optional step
 * and need not be done if the application wants to perform
 * 'quiet' printing. If the user cancels the print dialog then false
 * is returned. If true is returned we go ahead and print.
 */
      //boolean doPrint = printerJob.printDialog();
      PrinterJob job = PrinterJob.getPrinterJob();
      job.setPageable(book);
      boolean doPrint = printerJob.printDialog();
      if (doPrint) {
         try {printerJob.print();} catch (PrinterException exception) {System.err.println("Printing error: " + exception);}}}
}
