/*
 * PrintManager.java
 *
 * Created on 2006年12月21日, 下午7:28
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.print.printing;

import com.cs.canalyzer.structs.CommonValue;
import java.awt.Component;
import java.awt.Dialog;
import java.awt.Window;
import java.awt.print.Book;
import java.awt.print.PageFormat;
import java.awt.print.Paper;
import java.awt.print.Printable;
import java.awt.print.PrinterException;
import java.awt.print.PrinterJob;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Formatter;
import java.util.Locale;
import java.util.Properties;
import javax.print.PrintService;
import javax.print.PrintServiceLookup;
import javax.swing.ImageIcon;
import javax.swing.JDialog;
import javax.swing.JOptionPane;

/**
 * This class provides the printing function to CSSoft program.
 * Once constructed, an instance of this class will print the specified text and
 * an image if the image file name isn't null.
 *
 * Note: Before using this class to perform printing, make sure you have copied
 * all required images files in a folder named "images" and placed this folder
 * directly in the program's installation folder.
 *
 * @author ll
 */
public class PrintManager {
   private Book painterBook;
   private static boolean hasCover = true; // added on 2007.5.15
   protected PrintPreviewDialog previewDialog;
   protected Window owner;
   /**
    * this page formatInteger is used when adding a new painter to painterBook
    */
   private PageFormat currentFormat = DEFAULT_FORMAT;
   public static String applyToCover = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("No");
   
   public static Properties userSettings;
   public static final PrinterJob PRINTER_JOB = PrinterJob.getPrinterJob();
   public static final PageFormat DEFAULT_FORMAT = new PageFormat();
   public static final PageFormat DEFAULT_FORMAT_IMAGE = new PageFormat();
   public static final Properties DEFAULT_PROPERTIES = new Properties();
   // by Lewis
   public static final SimpleDateFormat DATE_FORMAT  = new SimpleDateFormat("dd-MM-yyyy"
           + " HH:mm:ss");
   
   public final static int PAPER_A4 = 0;
   public final static int PAPER_LETTER = 1;
   public final static int POINTS_PER_INCH = 72;
   public final static double A4_WIDTH = 8.27 * POINTS_PER_INCH;
   public final static double A4_HEIGHT = 11.69 * POINTS_PER_INCH;
   public final static double LETTER_WIDTH = 8.5 * POINTS_PER_INCH;
   public final static double LETTER_HEIGHT = 11.0 * POINTS_PER_INCH;
   public final static double IMAGEABLE_X =  0.4 * POINTS_PER_INCH;
   public final static double IMAGEABLE_Y =  0.4 * POINTS_PER_INCH;
   public final static double IMAGEABLE_WIDTH_A4 = A4_WIDTH - 2 * IMAGEABLE_X;
   public final static double IMAGEABLE_HEIGHT_A4 = A4_HEIGHT - 2 * IMAGEABLE_Y;
   public final static double IMAGEABLE_WIDTH_LETTER = LETTER_WIDTH - 2 * IMAGEABLE_X;
   public final static double IMAGEABLE_HEIGHT_LETTER = LETTER_HEIGHT - 2 * IMAGEABLE_Y;
   
   public final static String CODE_VERSION = "1.5";
   public static final String FILENAME_PAGE_SETUP = "pageSetup.ini";
   public static final String SETTING_CODE_VERSION = "code_version"; // printing src code version
   public static final String SETTING_DEFAULT_PRINTER = "default_printer"; // user's default printer
   public static final String SETTING_LAST_PRINTER = "last_used_printer";
   public static final String SETTING_HEIGHT = "paper_height";
   public static final String SETTING_WIDTH = "paper_width";
   public static final String SETTING_ORIENTATION = "orientation";
   public static final String SETTING_IMAGEABLE_X = "imageable_x";
   public static final String SETTING_IMAGEABLE_Y = "imageable_y";
   public static final String SETTING_IMAGEABLE_W = "imageable_w";
   public static final String SETTING_IMAGEABLE_H = "imageable_h";
   public static final String SETTING_APPLY_TO_COVER = "apply_to_cover";
   public static final String YES = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Yes");
   public static final String NO = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("No");
   
   /** Creates a new instance of PrintManager with the specified text and image */
   public PrintManager(Window owner) {
      this.owner = owner;
      painterBook = new Book();
      
      checkAndSetUserSettings(); //make sure the lastest settings are obtained
      selectPrinter();
      
      try {
         currentFormat = retrievePageFormat();
      } catch (NumberFormatException ex2) {
         currentFormat = DEFAULT_FORMAT;
         File file = new File(FILENAME_PAGE_SETUP);
         file.delete();
         ex2.printStackTrace();
      }
   }
   // initialize default page formats even when no instance of PrintManager
   // is created
   static {
      DEFAULT_FORMAT.setPaper(createDefaultPaper(PAPER_A4, false));
      DEFAULT_FORMAT.setOrientation(PageFormat.LANDSCAPE);
      
      DEFAULT_FORMAT_IMAGE.setPaper(createDefaultPaper(PAPER_A4, true));
      DEFAULT_FORMAT_IMAGE.setOrientation(PageFormat.LANDSCAPE);
      
      DEFAULT_PROPERTIES.setProperty(SETTING_WIDTH, A4_WIDTH + "");
      DEFAULT_PROPERTIES.setProperty(SETTING_HEIGHT, A4_HEIGHT + "");
      DEFAULT_PROPERTIES.setProperty(SETTING_IMAGEABLE_X, IMAGEABLE_X + "");
      DEFAULT_PROPERTIES.setProperty(SETTING_IMAGEABLE_Y, IMAGEABLE_Y + "");
      DEFAULT_PROPERTIES.setProperty(SETTING_IMAGEABLE_W, IMAGEABLE_WIDTH_A4 + "");
      DEFAULT_PROPERTIES.setProperty(SETTING_IMAGEABLE_H, IMAGEABLE_HEIGHT_A4 + "");
      DEFAULT_PROPERTIES.setProperty(SETTING_ORIENTATION, PageFormat.LANDSCAPE + "");
   }
   /** check and set user's settings including page setup settings.
    *  return true if settings have been set or false if the setting file
    *  doesn't exist or IOException occurs.
    */
   public static boolean checkAndSetUserSettings() {
      try {
         if (new File(PrintManager.FILENAME_PAGE_SETUP).exists()) {
            userSettings = retrieveUserSettings();
            return true;
         } else {
            userSettings = null;
         }
      } catch (IOException ex) {
         userSettings = null;
         ex.printStackTrace();
      }
      return false;
   }
   
   /** Check if a suitable printer is available on this computer.
    *  Return true it is available. Otherwise, show a message dialog and return
    *  false.
    */
   public static boolean hasPrinter(Component parent) {
      PrintService[] services = PrinterJob.lookupPrintServices();
      if (services.length > 0) {
         return true;
      } else {
         String msg = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("No_suitable_printer_is_found_on_your_computer._") +
              java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_install_a_suitable_printer_first.");
         JOptionPane.showMessageDialog(parent, msg, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("No_Suitable_Printer"),
              JOptionPane.ERROR_MESSAGE);
         return false;
      }
   }
   
   /** associate the printer job with the print service last used by user if
    *  such a print service is found in the setting file and is available.
    */
   public void selectPrinter() {
      if (userSettings != null) {
         String lastPrinter = userSettings.getProperty(SETTING_LAST_PRINTER);
         if (lastPrinter != null) {
            PrintService[] services = PrinterJob.lookupPrintServices();
            for (PrintService service : services) {
               if (service.getName().equals(lastPrinter)) {
                  try {
                     PRINTER_JOB.setPrintService(service); // set print service
                  } catch (PrinterException ex) {
                     ex.printStackTrace();
                  }
                  break;
               }
            }
         }
      }
   }
   
   /** returns true if user okays the dialog, or false otherwise */
   public boolean showPageDialogAndResetPageFormat() {
      PageFormat pf = PRINTER_JOB.pageDialog(getCurrentFormat());
      if (pf != getCurrentFormat()) { //if user okays the dialog
         setCurrentFormat(pf);
         savePageFormat(pf);
         return true;
      }
      return false;
   }
   
   public void preview() {
      // create and show a PrintPreviewDialog
      previewDialog =  new PrintPreviewDialog(owner, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Print_Preview"),
           Dialog.ModalityType.APPLICATION_MODAL, this);
      previewDialog.setVisible(true);
   }
   /** Print the pages contained in the specified book */
   public void print() throws PrinterException {
      /*Creates and returns a PrinterJob which is initially associated with the
       default printer. If no printers are available on the system, a PrinterJob
       will still be returned from this method, but getPrintService() will return
       null, and calling print with this PrinterJob might generate an exception.
       Applications that need to determine if there are suitable printers before
       creating a PrinterJob should ensure that the array returned from
       lookupPrintServices is not empty.*/
      PRINTER_JOB.print();
   }
   /**
    * Append the specified painter to painterBook using the current page formatInteger
    */
   public void addPainter(Printable painter, PageFormat pf) {
      painterBook.append(painter, pf);
   }
   
   public static void main(String[] args) {
      //PrintManager pm =  new PrintManager(getTextFromFile(), PAPER_A4, FILENAME_1_FA);
      //pm.filename_img2 = "/images/1xFA+1xVA.jpg";  // folder images placed under folder src
      //pm.filename_img2 = "..\\images\\1xFA+1xVA.jpg"; // folder images placed under folder src
      //pm.imageFilename = "src/images/1xFA+1xVA.jpg"; // causing error when program running outside IDE
      //pm.imageFilename = "images/1xFA.jpg"; // folder images placed under project's root directory
   }
   
   public static Paper createDefaultPaper(int paperType, boolean isImage) {
      Paper paper = new Paper();
      setPaperSize(paper, paperType);
      
      if (paperType == PAPER_LETTER) {
         if (isImage == false) {
            paper.setImageableArea(IMAGEABLE_X, IMAGEABLE_Y, IMAGEABLE_WIDTH_LETTER,
                 IMAGEABLE_HEIGHT_LETTER);
         }
      } else {
         if (isImage == false) {
            paper.setImageableArea(IMAGEABLE_X, IMAGEABLE_Y, IMAGEABLE_WIDTH_A4,
                 IMAGEABLE_HEIGHT_A4);
         }
      }
      return paper;
   }
   
   public static void setPaperSize(Paper paper, int paperType) {
      switch (paperType) {
         case PAPER_A4:
            paper.setSize(A4_WIDTH, A4_HEIGHT);
            break;
         case PAPER_LETTER:
            paper.setSize(LETTER_WIDTH, LETTER_HEIGHT);
            break;
         default:
            paper.setSize(A4_WIDTH, A4_HEIGHT);
            break;
      }
   }
   
   public static void showErrorDialog(Component parent, String msg, String title) {
      JOptionPane.showMessageDialog(parent, msg, title, JOptionPane.ERROR_MESSAGE);
   }
   
   private static String getTextFromFile(String path) {
      String printStr = "";
      try {
         BufferedReader reader = new BufferedReader(new FileReader(path));
         String aLine;
         
         while ((aLine = reader.readLine()) != null) {
            printStr = printStr + aLine + '\n';
         }
         if (printStr.length() > 0) {
            printStr.trim();
            printStr = printStr.substring(0, (printStr.length() - 1));  // remove the last '\n'
         }
         reader.close();
      } catch (FileNotFoundException ex) {
         ex.printStackTrace();
      } catch (IOException ex) {
         ex.printStackTrace();
      }
      
      return printStr;
   }
   
   /** Format an integer to contain thousand separators
    */
   public static String formatInteger(Object value) {
      return String.format("%,d", value);
   }
   
   /**
    * Round a float to a integer and then format it to contain thousand separators
    */
   public static String formatFloat(double value) {
      return formatInteger(Math.round(value));
   }
   
   public static String formatFloat( double value, int resolution ) {
       String s = String.format( "%20." + resolution + "f", value );
       return s.trim();
   }
   
   // by Lewis
   /** Round a float to contain specified number of decimal digits
    *  @Return a string representing the rounded double
    */
   public static String round(float value, int precision) {
      StringBuilder sb = new StringBuilder();
      Formatter formatter = new Formatter(sb);
      String format = "%,." + precision + "f";
      formatter.format(format, value);
      return sb.toString();
   }
   // by Lewis
   /** Round a float to contain specified number of decimal digits
    *  @Return a string representing the rounded double
    */
   public static String round(double value, int precision) {
      StringBuilder sb = new StringBuilder();
      Formatter formatter = new Formatter(sb);
      String format = "%,." + precision + "f";
      formatter.format(format, value);
      return sb.toString();
   }
   
   /** Validate the specified file path and create an ImageIcon object if the
    * file path is valid (the file exists and is a valid image file).
    * Return null if the file path is null or invalid.
    */
   public static ImageIcon validateAndCreateImageIcon(String filePath) {
      if (filePath == null) {
         return null;
      }
      ImageIcon icon = createImageIcon(filePath, "");
      if (icon == null || icon.getIconWidth() <= 0) {
         // if the file doesn't exist or isn't a valid image file
         return null;
      }
      return icon;
   }
   
   /** Returns an ImageIcon, or null if the path was invalid.
    *  When the image is not part of the application, getResource should not be
    *  used and the ImageIcon constructor is used directly.
    */
   public static ImageIcon createImageIcon(String path, String description) {
      java.net.URL imgURL = PrintManager.class.getResource(path);
      if (imgURL != null) {
         return new ImageIcon(imgURL, description);
      } else if (new File(path).exists()){
         return new ImageIcon(path, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("an_image_on_this_computer"));
      } else {
         System.err.println(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Couldn't_find_file:_") + path);
         return null;
      }
   }
   
   /** Return true if user's OS is of Chinese, Japanese or Korean version.
    *  Otherwise, return false.
    */
   public static boolean isCJKLocale() {
      String userLang = Locale.getDefault().getLanguage();
      if (userLang.equals(Locale.CHINESE.getLanguage()) ||
           userLang.equals(Locale.JAPANESE.getLanguage()) ||
           userLang.equals(Locale.KOREAN.getLanguage())) {
         return true;
      }
      return false;
   }
   
   public Book getPainterBook() {
      return painterBook;
   }
   
   public void setPainterBook(Book painterBook) {
      this.painterBook = painterBook;
   }
   
   public static void savePageFormat(PageFormat pf) {
      Properties settings = new Properties();
      Paper paper = pf.getPaper();
      settings.setProperty(SETTING_WIDTH, paper.getWidth() + "");
      settings.setProperty(SETTING_HEIGHT, paper.getHeight() + "");
      
      settings.setProperty(SETTING_IMAGEABLE_X, paper.getImageableX() + "");
      settings.setProperty(SETTING_IMAGEABLE_Y, paper.getImageableY() + "");
      settings.setProperty(SETTING_IMAGEABLE_W, paper.getImageableWidth() + "");
      settings.setProperty(SETTING_IMAGEABLE_H, paper.getImageableHeight() + "");
      
      settings.setProperty(SETTING_ORIENTATION, pf.getOrientation() + "");
      
      settings.setProperty(SETTING_CODE_VERSION, CODE_VERSION);
      settings.setProperty(SETTING_DEFAULT_PRINTER,
           PrintServiceLookup.lookupDefaultPrintService().getName());
      settings.setProperty(SETTING_LAST_PRINTER, PRINTER_JOB.getPrintService().getName());
      try {
         storeUserSettings(settings);
      } catch (IOException ex) {
         ex.printStackTrace();
      }
   }
   /**
    * In case of an exception, caller should set the page formatInteger to
    *  PrintManager.DEFAULT_FORMAT
    * 
    *  Modified on 2007.7.10
    */
   public static PageFormat retrievePageFormat() throws NumberFormatException {
      // modified on 2007.5.15
      if(userSettings == null) { // if file doesn't exist
         return DEFAULT_FORMAT;
      } else { // if file already exists
         Properties settings = userSettings;
         
         double paperWidth = Double.parseDouble(settings.getProperty(SETTING_WIDTH));
         double paperHeight = Double.parseDouble(settings.getProperty(SETTING_HEIGHT));
         Paper paper = new Paper();
         paper.setSize(paperWidth, paperHeight);
         
         double x = Double.parseDouble(settings.getProperty(SETTING_IMAGEABLE_X));
         double y = Double.parseDouble(settings.getProperty(SETTING_IMAGEABLE_Y));
         double width = Double.parseDouble(settings.getProperty(SETTING_IMAGEABLE_W));
         double height = Double.parseDouble(settings.getProperty(SETTING_IMAGEABLE_H));
         
         paper.setImageableArea(x, y, width, height);
         PageFormat pf = new PageFormat();
         pf.setPaper(paper); // Never miss out this line!
         int orientation = Integer.parseInt(settings.getProperty(SETTING_ORIENTATION));
         pf.setOrientation(orientation);
         
         //applyToCover = userSettings.getProperty(SETTING_APPLY_TO_COVER, NO);
         return pf;
      }
   }
   
   /**
    * retrieve page setup userSettings from setting file
    */
   public static Properties retrieveUserSettings() throws FileNotFoundException, IOException{
      Properties settings = new Properties(DEFAULT_PROPERTIES);
      FileInputStream in = new FileInputStream(FILENAME_PAGE_SETUP);
      settings.load(in);
      in.close();
      return settings;
   }
   
// modified on 2007.5.15
   /**
    * create a file if it doesn't exist and store page setup userSettings in it
    */
   public static void storeUserSettings(Properties settings) throws FileNotFoundException, IOException {
      File file = new File(FILENAME_PAGE_SETUP);
      file.createNewFile();
      FileOutputStream out = new FileOutputStream(FILENAME_PAGE_SETUP);
      settings.store(out, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("User's_settings"));
      out.close();
   }
   
   public PageFormat getCurrentFormat() {
      return currentFormat;
   }
   
   public PageFormat getCurrentFormatLandscape() {
      PageFormat pf = (PageFormat)currentFormat.clone();
      pf.setOrientation(PageFormat.LANDSCAPE);
      return pf;
   }
   
   public PageFormat getCurrentFormatPortrait() {
      PageFormat pf = (PageFormat)currentFormat.clone();
      pf.setOrientation(PageFormat.PORTRAIT);
      return pf;
   }
   
   public void setCurrentFormat(PageFormat currentFormat) {
      this.currentFormat = currentFormat;
   }
   
   public static boolean HasCover() {
      return hasCover;
   }
   
   public static void setHasCover(boolean hasCover) {
      hasCover = hasCover;
   }
}
