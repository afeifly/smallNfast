/*
 * ComponentPainter.java
 *
 * Created on April 12, 2007, 6:26 PM
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.print.printing;

import java.awt.Container;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.awt.print.PageFormat;
import java.awt.print.Printable;
import java.awt.print.PrinterException;
import java.io.File;
import java.io.IOException;
import javax.imageio.ImageIO;

/**
 *
 * @author ll
 */
public class ComponentPainter extends Painter {
   /** The Swing component to print. */
   protected Container component;
   public boolean isLandscape = false; // orientation of paper
   private boolean needCover = false;

    public boolean isNoNeedCover() {
        return needCover;
    }

    
   /** Creates a new instance of SwingComponentPainter */
   public ComponentPainter(String title, String footer, String logoPath,boolean needCover, Container component) {
      super(title, footer, logoPath);
      this.component = component;
      if (component.getWidth() > component.getHeight()) {
         isLandscape = true;
      }
      this.needCover = needCover;
   }
   
   public int print(Graphics graphics, PageFormat pageFormat, int pageIndex) throws PrinterException {
      /* User (0,0) is typically outside the imageable area, so we must
       * translate by the X and Y values in the PageFormat to avoid clipping
       */
      
      Graphics2D g2d = (Graphics2D)graphics;         
      g2d.translate(pageFormat.getImageableX(), pageFormat.getImageableY());
      
      double pageWidth = pageFormat.getImageableWidth();
      // Note: logoHeight is 0 by default
      double pageHeight = pageFormat.getImageableHeight() - logoHeight;
      double panelWidth = component.getWidth();
      double panelHeight = component.getHeight();
      
      // print logo on top of the component if it exists
      if (logoImage != null) {
         int x = (int)pageWidth - logoWidth;
           if(pageIndex == 0){
             //add by be on 20090120.
             //draw coverpage logoimage.
               if(this.needCover==true)
                   g2d.drawImage(logoImage.getImage(), x, 0, logoWidth, logoHeight, null);                    
               else
                   g2d.drawImage(logoImage.getImage(), 400, 85, 130, 120, null);  
           }else{
               g2d.drawImage(logoImage.getImage(), x, 0, logoWidth, logoHeight, null);
           }
         // translate again so that component to be printed won't cover logo
         g2d.translate(0, logoHeight + 5);
      }
      
      // Find out what scale factor should be applied
      // to make the image's width small enough to
      // fit on the page
      double scaleX = pageWidth / panelWidth;
      // Now do the same for the height
      double scaleY = pageHeight / panelHeight;
      // Pick the smaller of the two values so that
      // the image is as large as possible while
      // not exceeding either the page's width or
      // its height
      double scaleFactor = Math.min(scaleX, scaleY);
      // Now set the scale factor
//      g2d.scale(scaleFactor, scaleFactor);
       g2d.scale(scaleX, scaleY); //modified by be,20101021.

      /* Now print the component and its visible contents */
      component.print(g2d);
//      Image image = component.createImage(component.getWidth(), component.getHeight());
//      g2d.drawImage(image, 0, 0, component.getWidth(), component.getHeight(), null);
      
      return Printable.PAGE_EXISTS;
   }
   
}