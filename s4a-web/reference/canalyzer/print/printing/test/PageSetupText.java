/*
 * PageSetupText.java
 *
 * Created on July 9, 2007, 6:47 PM
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.print.printing.test;

import java.awt.Graphics;
import java.awt.print.PageFormat;
import java.awt.print.Printable;
import java.awt.print.PrinterException;

/**
 *
 * @author ll
 */
public class PageSetupText implements Printable {
   
   /** Creates a new instance of PageSetupText */
   public PageSetupText() {
   }

   public int print(Graphics graphics, PageFormat pageFormat, int pageIndex) throws PrinterException {
      if (pageIndex < 1) {
         graphics.drawString(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Test"), 100, 100);
         return Printable.PAGE_EXISTS;
      } else {
         return Printable.NO_SUCH_PAGE;
      }
      
   }
   
}
