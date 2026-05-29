/*
 * PrintAction.java
 *
 * Created on April 11, 2007, 12:13 PM
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.print.printing;

import com.cs.canalyzer.gui.JTablePanel;
import com.cs.canalyzer.gui.JTableTitle;
import com.cs.canalyzer.gui.Base;
import com.cs.canalyzer.gui.PropertyUtil;
import com.cs.canalyzer.gui.dialog.StatisticsReportDialog;
import com.cs.canalyzer.structs.BasicSetting;
import com.cs.canalyzer.structs.Compressor;
import com.cs.canalyzer.structs.LeakStatistics;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.GridLayout;
import java.awt.Toolkit;
import java.awt.print.Printable;
import java.util.ArrayList;
import java.util.Properties;
import javax.print.PrintServiceLookup;
import javax.swing.JFrame;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JTable;

/**
 * This class is to be called by other Java classes to create a Painter for each
 * page to print. It uses a PrintManager to manage the Painters and perform the
 * actual previewing and printing.
 *
 * @author ll
 */
public class PrintAction {
   // by Lewis on 2007.4.13
   Printable painter;
   public static int pageIndexGraph;
   public static int pageCountStanard;
   public static final String n = "\n";
   public static final String nn = "\n\n";
   //public static final String IMAGE_PATH_LOGO = "/com/cs/canalyzer/print/images/CSLogo.JPG";
   //Michael Kromer's requirement
   private LeakStatistics theLeakStat;
   
   /** Creates a new instance of PrintAction */
   public PrintAction(Base base) {
      if(PrintManager.hasPrinter(base) == false) {
         return;
      }
      
      boolean showPageDialog = false;
      String msg = "";
      //When setting file doesn't exist or the version number retrieved from the
      //file is less than the current one, force user to open page setup dialog.
      if (PrintManager.checkAndSetUserSettings() == true) {
         Properties settings = PrintManager.userSettings;
         String version = settings.getProperty(PrintManager.SETTING_CODE_VERSION, "1.0");
         if (version.compareTo(PrintManager.CODE_VERSION) < 0) {
            // if the code version is older than current one
            showPageDialog = true;
            msg = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("You_are_using_this_version_of_the_program_for_the_first_time");
         } else { // if user's default printer has changed
            String defaultPrinter = PrintServiceLookup.lookupDefaultPrintService().getName();
            if (!defaultPrinter.equals(settings.getProperty(PrintManager.SETTING_DEFAULT_PRINTER))) {
               showPageDialog = true;
               msg = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Your_default_printer_has_changed");
            }
         }
      } else { // if file doesn't exist
         showPageDialog = true;
         msg = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Page_printing_options_file_doesn't_exist");
      }
      
      PrintManager printManager = new PrintManager(base);
      // pop up page dialog to get print settings from user
      if (showPageDialog) {
         showMsgDialog(base, msg);
         if (printManager.showPageDialogAndResetPageFormat() == false) {
            return;
         }
      }
      
      // create cover page painter - portrait
      BasicSetting basicSetting = base.getTheCommonValue().getBasicSetting();
      String logoPath = basicSetting.ServiceLogoFilePath;
 //     String logoPath = basicSetting.LogoFilePath;
//     // String serviceLogoPath = basicSetting.ServiceLogoFilePath;//add by be, 2008/10/18.
//      String title = basicSetting.CompanyName;
//      String bodyText = createBodyText(basicSetting);
//      TextPainter tp = new TextPainter(title, null, logoPath, bodyText);
//      tp.setSpaceBelowLogo(1.5 * PrintManager.POINTS_PER_INCH);
//      tp.setTitleFont(Painter.FONT_TITLE1);
//      tp.setTitleAlign(Painter.ALIGN_CENTER);
//      tp.setBodyFont(Painter.FONT_HEADER);
//      tp.setBodyAlign(Painter.ALIGN_CENTER);
//      if (PrintManager.applyToCover.equals(PrintManager.NO)) {
//         printManager.addPainter(tp, printManager.getCurrentFormatPortrait());
//      } else {
//         printManager.addPainter(tp, printManager.getCurrentFormat());
//      }
//      
//      // create comment pages if any - to be completed
////      title = "Summary";  // should be obtained from Base object
////      bodyText = nn + "The comment page(s) comes immediately after the cover page. " +
////           "This is normally a summary or analysis of the report. ";
////      bodyText += n + bodyText;   // should be obtained from Base object
////      title = base.getCommonValue().getTexts().CommendPageTitle;
////      bodyText = nn + base.getCommonValue().getTexts().CommendBodyText;
//      title = base.getCommentPageTitle();
//      bodyText = nn + base.getCommentPageBodyText();
//      
//      pageIndexGraph = 1;
//      pageCountStanard = 3;
//      if (bodyText != null && bodyText.trim().length() > 0) {
//         pageIndexGraph++;
//         pageCountStanard++;
//         
//         tp = new TextPainter(title, null, logoPath, bodyText);
//         tp.setSpaceBelowLogo(0.2 * PrintManager.POINTS_PER_INCH);
//         tp.setTitleFont(Painter.FONT_TITLE2);
//         tp.setTitleAlign(Painter.ALIGN_CENTER);
//         tp.setBodyFont(Painter.FONT_BODY);
//         printManager.addPainter(tp, printManager.getCurrentFormatPortrait());
//      }
//      
      //add by be,20090106.
      //print first page.
      CoverPageForm cpf = new CoverPageForm(base.getTheCommonValue());
//      cpf.drawServiceLogo(logoPath);
      painter = new ComponentPainter(null, null, logoPath,false,
                  cpf.getContainer());           
              printManager.addPainter(painter, printManager.getCurrentFormatPortrait());
     
      // create diagram page painter - landscape
      painter = new ComponentPainter(null, null, logoPath,true,
           base.getGraphicPanel());      
      printManager.addPainter(painter, printManager.getCurrentFormatLandscape());
      
      // create statistics page painter - portrait
//      painter = new ComponentPainter(null, null, logoPath,
//          base.getStatisticsDialog().getDialogPanel());           
//      printManager.addPainter(painter, printManager.getCurrentFormatPortrait());
//      
      //modify by be , 2008/10/17 .
//      ArrayList<Compressor> compressors = base.getTheCommonValue().getLeakStatistics().getCompressors();
//      System.out.println("compressors =="+compressors);
//     // StatisticsReportDialog statisticsReportDialog = new StatisticsReportDialog(base.getTheCommonValue().getLeakStatistics());
//      if(compressors != null){
//          int len = compressors.size();
//          System.out.println("compressors size =="+len);
//          for(int i = 0 ; i < len ; i++){
//            StatisticsReportDialog mySD = new StatisticsReportDialog(base.getTheCommonValue().getLeakStatistics(),i);
//              painter = new ComponentPainter(null, null, logoPath,
//                   mySD.getContainer());
//              printManager.addPainter(painter, printManager.getCurrentFormatPortrait());
//          }
//      }else{
//         // show message
//         // JOptionPane.showMessageDialog(null,"No Compressor . ");
//        StatisticsReportDialog mySD = new StatisticsReportDialog(base.getTheCommonValue().getLeakStatistics());
//          painter = new ComponentPainter(null, null, logoPath,
//               mySD.getContainer());
//          printManager.addPainter(painter, printManager.getCurrentFormatPortrait());
//      }

      //use jtable to show statistics report.
      ArrayList<JTable> tables = base.getTheCommonValue().getStatisticsTables();
//      JTableTitle ttitle = new JTableTitle(base.getTheCommonValue());
     // System.out.println("tables =="+tables);
     // StatisticsReportDialog statisticsReportDialog = new StatisticsReportDialog(base.getTheCommonValue().getLeakStatistics());
     theLeakStat = base.getTheCommonValue().getLeakStatistics();
      if(tables != null){
          int len = tables.size();
//          System.out.println("tables size =="+len);
          setPrintStatisticsTable(len,base,tables,logoPath,printManager);
      }else{
//          System.out.println("tables size is null");
          new JTablePanel(base.getTheCommonValue());
          ArrayList<JTable> tablelist =  base.getTheCommonValue().getStatisticsTables();
          int len = tablelist.size();
          setPrintStatisticsTable(len,base,tablelist,logoPath,printManager);
//          System.out.println("tablelist size =="+len);
//          JFrame frame = new JFrame ("JTableDemo");
//          for(int i = 0 ; i < len ; i++){
//               JPanel panel = new JPanel (new GridLayout (0, 1));
//               panel.setPreferredSize(new Dimension(650,980));
//               panel.add(tablelist.get(i));
//               frame.setContentPane (panel);
//               frame.pack();
//              painter = new ComponentPainter(null, null, logoPath,
//                   frame.getContentPane());
//              printManager.addPainter(painter, printManager.getCurrentFormatPortrait());
//          }
      }
   
     
      // add every day's graph page painter and statistics page painter if available
      // for testing purposes only! After integration, dailyGraphs and dailyStats should be
      // acquired from the Base object
//      int count = 3;
//      Container[] dailyGraphs = new Container[count];
//      createComponents(base, dailyGraphs, 1);
//      Container[] dailyStats = new Container[count];
//      createComponents(base, dailyStats, 2);
/*
      Container[] dailyGraphs = base.getDailyGraphs();
      Container[] dailyStats = base.getDailyStats();
      
      if (dailyGraphs != null && dailyGraphs.length > 0) {
         for (Container component : dailyGraphs) {
            painter = new ComponentPainter(null, null, logoPath,
                 component);
            printManager.addPainter(painter, printManager.getCurrentFormatLandscape());
         }
      }
      if (dailyStats != null && dailyStats.length > 0) {
         for (Container component : dailyStats) {
            painter = new ComponentPainter(null, null, logoPath,
                 component);
            printManager.addPainter(painter, printManager.getCurrentFormatPortrait());
         }
      }
*/
//      painter = new ImagePainter(null, null, IMAGE_PATH_LOGO, IMAGE_PATH_TEST);
//      printManager.addPainter(painter);
      
      printManager.preview();
   }

   private void setPrintStatisticsTable(int len,Base base,ArrayList<JTable> tables,String logoPath,PrintManager printManager){
         JFrame frame = new JFrame ("JTableDemo");

         frame.setLayout(new BorderLayout());
         Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();
         int width = dim.width;
         int height = dim.height;

          for(int i = 0 ; i < len ; i++){

             JPanel maintablepanel = new JPanel (new BorderLayout());
             // maintablepanel.setPreferredSize(new Dimension(680,1080));
             JPanel titlepanel = new JPanel (new GridLayout (0, 1));
             JTableTitle ttitle = new JTableTitle(base.getTheCommonValue());
             JTable tmpTitleTable = ttitle.setTitle();
             //add on 20100819. Richard's requirement. -- begin
              tmpTitleTable.setRowHeight(12);
              tmpTitleTable.setFont(new Font("",Font.PLAIN,9));
              //--- end
              titlepanel.add(tmpTitleTable);
              maintablepanel.add(titlepanel,BorderLayout.NORTH);

              JPanel panel = new JPanel (new GridLayout (0, 1));
              maintablepanel.setPreferredSize(new Dimension(680,height));
//              maintablepanel.setBackground(Color.GREEN);

              // tables.get(i).setDefaultRenderer(Object.class, new TableCellTextAreaRenderer());
               JTable tmpTable = tables.get(i);
               if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
                   if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
                       tmpTable.setRowHeight(height/78);
                   }else{
                       tmpTable.setRowHeight(height/73);
                   }
               }else{
                    if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
                         tmpTable.setRowHeight(height/73);
                    }else{
                        tmpTable.setRowHeight(height/68);
                    }
               }
               tmpTable.setFont(new Font("",Font.PLAIN,9));
               panel.add(tables.get(i));

                //add the legend
               if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
                  JPanel legendpanel = new JPanel (new BorderLayout());
                  javax.swing.JLabel legendLabel = new javax.swing.JLabel();
                  legendLabel.setText(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString(
                          PropertyUtil.isIRLogoType()?"Statistic_Table_Line31_59_Legend_IR":"Statistic_Table_Line31_59_Legend"));
                  legendLabel.setText(legendLabel.getText()+"<html><br></html>  ");
                  legendpanel.setBackground(Color.WHITE);
                  legendpanel.add(legendLabel);
                  legendpanel.setSize(680,10);
                  maintablepanel.add(legendpanel,BorderLayout.SOUTH);
               }

               maintablepanel.add(panel,BorderLayout.CENTER);
               frame.setPreferredSize(new Dimension(600,height));
//               frame.getContentPane().removeAll();
               frame.setContentPane(maintablepanel);
               frame.pack();

              
      

//             JPanel maintablepanel = new JPanel (new BorderLayout());
//             // maintablepanel.setPreferredSize(new Dimension(680,1080));
//             JPanel titlepanel = new JPanel (new GridLayout (0, 1));
//             JTableTitle ttitle = new JTableTitle(base.getTheCommonValue());
//              titlepanel.add(ttitle.setTitle());
//              maintablepanel.add(titlepanel,BorderLayout.NORTH);
// Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();
// int width = dim.width;
// int height = dim.height;
//// System.out.println("width="+width);
////  System.out.println("height="+height);
//               JPanel panel = new JPanel (new GridLayout (0, 1));
//                 maintablepanel.setPreferredSize(new Dimension(680,height));
//                 maintablepanel.setBackground(Color.GREEN);
//
//              // tables.get(i).setDefaultRenderer(Object.class, new TableCellTextAreaRenderer());
//               JTable tmpTable = tables.get(i);
//               if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
//                   if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
//                       tmpTable.setRowHeight(height/78);
//                   }else{
//                       tmpTable.setRowHeight(height/73);
//                   }
//               }else{
//                    if(theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()){
//                         tmpTable.setRowHeight(height/73);
//                    }else{
//                        tmpTable.setRowHeight(height/68);
//                    }
//               }
//               panel.add(tables.get(i));
//
//               //panel.setSize(800, 5000);
//               //System.out.println("tables.get(i).getRowHeight() =="+tables.get(i).getRowHeight());
//               maintablepanel.add(panel,BorderLayout.CENTER);
//
//               //add the legend
//           if(theLeakStat.analyzeType == LeakStatistics.ANALYZE_TYPE_SYSTEM){
//              JPanel legendpanel = new JPanel (new BorderLayout());
//              javax.swing.JLabel legendLabel = new javax.swing.JLabel();
//              legendLabel.setText(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Statistic_Table_Line31_59_Legend"));
//              legendpanel.setBackground(Color.WHITE);
//              legendpanel.add(legendLabel);
//              maintablepanel.add(legendpanel,BorderLayout.SOUTH);
//           }
//               frame.setPreferredSize(new Dimension(680,height));
//               frame.setContentPane (maintablepanel);
//               frame.pack();
              painter = new ComponentPainter(null, null, logoPath,false,
                   frame.getContentPane());
              printManager.addPainter(painter, printManager.getCurrentFormatPortrait());
          }
   }
   // for testing purposes only!
   private void createComponents(Base base, Container[] components, int type) {
      Container component;
      if (type == 1) {
         component = base.getGraphicPanel();
      } else {
         //component = base.getStatisticsDialog().getDialogPanel();
          component = base.getStatisticsReportDialog().getContainer();//modify by be, 2008/10/18 .
      }
      for (int i = 0; i < components.length; i++) { // the for-each statement won't work
         components[i] = component;
      }
   }
   
   private void showMsgDialog(Component parent, String msg) {
      msg += java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString(".\nPlease_select_the_proper_page_printing_options_in_the_dialog_that_follows.") +
           java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("\n\n<html>The_print_job_will_be_sent_to_this_printer:_<font_color=blue>") +
           PrintManager.PRINTER_JOB.getPrintService().getName() +
           java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("\nTo_change_the_printer,_click_\"Printer...\"_button_in_that_dialog.") +
           java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("\n\n<html><font_color=red>Make_sure_the_printer_is_loaded_with_") +
           java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("the_same_paper_as_you_specify_there.");
      
      JOptionPane.showMessageDialog(parent, msg, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_select_page_printing_options"),
           JOptionPane.INFORMATION_MESSAGE);
   }
   
   private String createBodyText(BasicSetting setting) {
              
       String bodyText = nn + setting.AddressLine1 + n +
           setting.AddressLine2 + n +
           setting.AddressLine3 + nn +
           java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Phone:_") + setting.Phone + nn +
           java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Fax:_") + setting.Fax + nn +
           java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Email:_") + setting.Email + nn +
           java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Webpage:_") + setting.Webpage;
       // create service information.
       // add by be,2008/10/17 .
       String serviceInfo = createServiceText(setting);
       if(!"".equals(serviceInfo))
          bodyText = bodyText + serviceInfo;

      return bodyText;
   }
   
   //add by be , 2008/10/18 .
   private String createServiceText(BasicSetting setting){
       String serviceCompanyName = setting.ServiceCompanyName;  
       String serviceLogoPath = setting.ServiceLogoFilePath;
       String serviceBodyText = "";
       if(serviceCompanyName != null){
           if(!"".equals(serviceCompanyName.trim())){
               serviceBodyText = nn + serviceLogoPath + "#" +                   
                   java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("ServiceCompanyName:_") + serviceCompanyName + nn +
                   setting.ServiceAddressLine1 + n +
                   setting.ServiceAddressLine2 + n +
                   setting.ServiceAddressLine3 + nn +
                   java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("ServicePhone:_") + setting.ServicePhone + nn +
                   java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("ServiceFax:_") + setting.ServiceFax + nn +
                   java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("ServiceEmail:_") + setting.ServiceEmail + nn +
                   java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("ServiceWebpage:_") + setting.ServiceWebpage + n + "\t";
                  
           }
       }
       return serviceBodyText;
   }
     
}
