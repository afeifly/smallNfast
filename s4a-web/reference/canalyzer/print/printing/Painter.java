/*
 * Painter.java
 *
 * Created on April 10, 2007, 5:44 PM
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.print.printing;

import java.awt.Font;
import java.awt.print.Printable;
import javax.swing.ImageIcon;

/**
 *
 * @author ll
 */
public abstract class Painter implements Printable {
   public String title = null;
   public String footer = null;
   public ImageIcon logoImage = null;
   public int logoWidth = 0; // to be calculated based on scale factor
   public int logoHeight = 0;
   
   public static final String n = "\n";
   public static final String nn = "\n\n";
   public static Font FONT_TITLE1 = new Font("Arial", Font.BOLD, 24);
   public static Font FONT_TITLE2 = new Font("Arial", Font.BOLD, 20);
   public static Font FONT_HEADER = new Font("Arial", Font.BOLD, 14);
   public static Font FONT_BODY = new Font("Arial", Font.PLAIN, 11);
   public static Font FONT_FOOTER = new Font("Arial", Font.PLAIN, 9);
   public static Font FONT_TABLE_HEADER = new Font("Arial", Font.BOLD, 11);
   public static Font FONT_CELL = new Font("Arial", Font.PLAIN, 11);
   public static final int ALIGN_LEFT = 1;
   public static final int ALIGN_CENTER = 2;
   
   static {
      if (PrintManager.isCJKLocale()) {
         //"FONT_TITLE1 = FONT_TITLE1.deriveFont(13);" doesn't work at all
         FONT_TITLE1 = new Font("Dialog", FONT_TITLE1.getStyle(), FONT_TITLE1.getSize());
         FONT_TITLE2 = new Font("Dialog", FONT_TITLE2.getStyle(), FONT_TITLE2.getSize());
         FONT_HEADER = new Font("Dialog", FONT_HEADER.getStyle(), FONT_HEADER.getSize());
         FONT_BODY = new Font("Dialog", FONT_BODY.getStyle(), FONT_BODY.getSize());
         FONT_FOOTER = new Font("Dialog", FONT_FOOTER.getStyle(), FONT_FOOTER.getSize());
         FONT_TABLE_HEADER = new Font("Dialog", FONT_TABLE_HEADER.getStyle(), FONT_TABLE_HEADER.getSize());
         FONT_CELL = new Font("Dialog", FONT_CELL.getStyle(), FONT_CELL.getSize());
      }
   }
   
   /** Creates a new instance of Painter */
   public Painter(String title, String footer, String logoPath) {
      if (title != null) {
         this.title = title;
      }
      if (footer != null) {
         this.footer = footer;
      }
      
      this.logoImage = PrintManager.validateAndCreateImageIcon(logoPath);
      if (this.logoImage != null) {
         logoHeight = 30; // default logo height
         // scale while maintaining aspect ratio
         this.logoWidth = this.logoImage.getIconWidth() *
              this.logoHeight / this.logoImage.getIconHeight();
      }
   }
}
