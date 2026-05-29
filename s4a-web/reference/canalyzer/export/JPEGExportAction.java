/*
 * JPEGExportAction.java
 *
 * Created on 2007年7月30日, 下午4:59
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.export;

import com.cs.canalyzer.gui.Base;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import javax.imageio.ImageIO;
import javax.swing.JDialog;

/**
 *
 * @author ll
 */
public class JPEGExportAction extends ExportAction {
   private static final String DIALOG_TITLE = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Export_to_a_JPEG_File_-_");
   
   /** Creates a new instance of JPEGExportAction */
   public JPEGExportAction(Base base, JDialog dialog, int choice) {
      super(base, dialog, choice);
   }
   
   protected void setSaveDialogProperties() {
      dialogTitle = "";
      extension = "jpg";
      desc = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("JPEG_files_(*.jpg)");
   }
   
   public boolean createSpecificFile(BufferedImage[] awtImages) {
      // write each BufferedImage to an image file
      for (int i = 0; i < awtImages.length; i++) {
         dialogTitle = DIALOG_TITLE + exportedItems[i];
         File filePath = getFilePath();
         if (filePath == null) {
            return false;
         }
         if (saveImage(awtImages[i], filePath) == false) {
            return false;
         }
      }
      return true;
   }
   
   public boolean saveImage(BufferedImage image, File filePath) {
      try {
         boolean writerFound = ImageIO.write(image, extension, filePath);
         if (writerFound == false) {
            System.err.println(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("No_appropriate_writer_found_for_this_format."));
            return false;
         }
         return true;
      } catch (IOException ex) {
         System.err.println(ex.getMessage());
      } catch (Exception ex2) { // handle NullPointerException
         System.err.println(ex2.getMessage());
      }
      return false;
   }
}
