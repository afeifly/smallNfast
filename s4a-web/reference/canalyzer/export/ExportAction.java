/*
 * ExportAction.java
 *
 * Created on 2007年7月27日, 下午5:54
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.export;

import com.cs.canalyzer.gui.Base;
import com.cs.canalyzer.gui.JTablePanel;
import com.cs.canalyzer.gui.JTableTitle;
import com.cs.canalyzer.gui.dialog.NewWaitingDialog;
import com.cs.canalyzer.print.printing.CoverPageForm;
import com.cs.canalyzer.print.printing.PrintManager;
import com.cs.canalyzer.print.printing.StatisticsDialog;
import com.cs.canalyzer.print.printing.StatisticsRenderer;

import com.cs.canalyzer.structs.CommonValue;
import com.lowagie.text.BadElementException;
import com.lowagie.text.Image;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.GridLayout;
import java.awt.Toolkit;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Properties;
import java.util.TimerTask;
import javax.swing.*;
import javax.swing.filechooser.FileNameExtensionFilter;

/**
 *
 * @author ll
 */
public abstract class ExportAction {
    
   protected Image logoImage = null; // logo to be added
    
   protected Base base;
   protected CommonValue commonValue;
   protected int choice;
   protected String dialogTitle;
   protected String extension;
   protected String desc;
   protected String[] exportedItems;
   protected boolean okaysSaveDialog = true;
   protected int dailyGraphCount = 0; // will be used by PDFExportAction.createSpecificFile()
                                      // to change the page orientation
   protected int dailyStatsCount = 0; // will be used by PDFExportAction.createSpecificFile()
                                      // to change the page orientation
   
   public static final String FILE_NAME_SETTINGS = "ExportDir.ini";
   public static final String SETTING_CHOSEN_DIR = "chosen_dir";
   public static final String ITEM_GRAPH = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Graph");
   public static final String ITEM_REPORT = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Statistics_Report");
   public static final int CHOICE_GRAPH = 1;
   public static final int CHOICE_STAT_REPORT = 2;
   public static final int CHOICE_FULL = 3;
   public static final int CHOICE_DETAILED = 4;
   final NewWaitingDialog waitDlg = new NewWaitingDialog();
   
   /** Creates a new instance of ExportAction */
   public ExportAction(Base base, JDialog exportDialog, int choice) {
      this.base = base;
      this.choice = choice;
      commonValue = base.getTheCommonValue();
      setSaveDialogProperties();
      
      exportDialog.dispose();
      
      
        final Base theBase = base;
        waitDlg.showUp( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Processing,_please_wait_..."),
                new TimerTask() {
            public void run() {
                theBase.setBasePanelEnabled(false);
                boolean success = export();
                if(waitDlg != null){
                    waitDlg.unShow();
                }
                if (okaysSaveDialog == true) {
                    String msg = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Export_completed.");
                    if (success == false) {
                        msg = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Export_failed._You_may_try_again.");
                    }
 
                    JOptionPane.showConfirmDialog(theBase, msg, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Export_result"),
                        JOptionPane.DEFAULT_OPTION, JOptionPane.INFORMATION_MESSAGE);
                    
                }
                
                theBase.setBasePanelEnabled(true);
            }
        });
       theBase.setBasePanelEnabled(true);
      
//      boolean success = export();
//      if (okaysSaveDialog == true) {
//         String msg = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Export_completed.");
//         if (success == false) {
//            msg = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Export_failed._You_may_try_again.");
//         }
//         JOptionPane.showConfirmDialog(base, msg, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Export_result"),
//              JOptionPane.DEFAULT_OPTION, JOptionPane.INFORMATION_MESSAGE);
//      }
   }
   
   protected abstract void setSaveDialogProperties();
   
   public boolean export() {
      Container[] components = null;
      //modify on 20091021.be
      //reason : v3-8 create pdf file.
      if (choice == CHOICE_GRAPH) {
         components = new Container[]{base.getGraphicPanel()};
         exportedItems = new String[]{ITEM_GRAPH};
      } else if (choice == CHOICE_STAT_REPORT) {
//         StatisticsDialog dialog = createStatisticsDialog();
         ArrayList list = new ArrayList();
         Container[] dailyStats = setExportStatisticsTableToPdf();
         dailyStatsCount = dailyStats.length;
          if (dailyStats != null && dailyStats.length > 0) {
            for (Container component : dailyStats) {
               list.add(component);
            }
         }
         components = (Container[])list.toArray(new Container[0]);
         exportedItems = new String[]{ITEM_REPORT};
      } else if (choice == CHOICE_FULL) {

//         StatisticsDialog dialog = createStatisticsDialog();
         ArrayList list = new ArrayList();
         //add coverpage
         CoverPageForm cpf = new CoverPageForm(base.getTheCommonValue());
         list.add(cpf.getContainer());

         list.add(base.getGraphicPanel());
         Container[] dailyStats = setExportStatisticsTableToPdf();
         dailyStatsCount = dailyStats.length;
//          if (dailyStats != null && dailyStats.length > 0) {
//            for (Container component : dailyStats) {
//               list.add(component);
//            }
//         }
         components = (Container[])list.toArray(new Container[0]);
//         components = new Container[]{base.getGraphicPanel(), dialog.getDialogPanel()};
         exportedItems = new String[]{ITEM_GRAPH, ITEM_REPORT};
      } else if (choice == CHOICE_DETAILED) {
//         StatisticsDialog dialog = createStatisticsDialog();
                     
         ArrayList list = new ArrayList();
         //add coverpage
         CoverPageForm cpf = new CoverPageForm(base.getTheCommonValue());
         list.add(cpf.getContainer());

         list.add(base.getGraphicPanel());
//         list.add(dialog.getDialogPanel());
         Container[] dailyStats = setExportStatisticsTableToPdf();
         dailyStatsCount = dailyStats.length;
//         ethan change
//         if (dailyStats != null && dailyStats.length > 0) {
//            for (Container component : dailyStats) {
//               list.add(component);
//            }
//         }

         Container[] dailyGraphs = base.getDailyGraphs();
         dailyGraphCount = dailyGraphs.length;
         if (dailyGraphs != null && dailyGraphs.length > 0) {
            for (Container component : dailyGraphs) {
               list.add(component);
            }
         }
        
         components = (Container[])list.toArray(new Container[0]);
      }
      if (components != null) {
         return createFile(components);
      }
      return false;
   }
   
   /**
    * Pop up "Save File" file chooser dialog to get the file path from user.
    * @Return the File object representing the specified file path or null if
    * user cancels or closes the dialog.
    */
   public File getFilePath() {
      String currentLF = UIManager.getLookAndFeel().getClass().getName();
      setLookAndFeel(UIManager.getSystemLookAndFeelClassName()); // change to Windows look and feel
      
      String currentDir = null;
      try {
         File file = new File(FILE_NAME_SETTINGS);
         file.createNewFile();
         Properties settings = loadProperties(FILE_NAME_SETTINGS);
         currentDir = settings.getProperty(SETTING_CHOSEN_DIR,
              System.getProperty("user.home"));
         
         JFileChooser chooser = new JFileChooser(currentDir);
         chooser.setDialogTitle(dialogTitle);
         //chooser.setMultiSelectionEnabled(false);
         FileNameExtensionFilter filter = new FileNameExtensionFilter
              (desc, extension);
         chooser.addChoosableFileFilter(filter);
         if(waitDlg != null)
                waitDlg.unShow();
         if (chooser.showSaveDialog(base) == JFileChooser.APPROVE_OPTION) {
            waitDlg.showUp(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Processing,_please_wait_..."));
            String path = chooser.getSelectedFile().getPath();
            if (path.endsWith(extension) == false) {
               path += "." + extension;
            }
            
            String chosenDir = chooser.getSelectedFile().getParent();
            settings.setProperty(SETTING_CHOSEN_DIR, chosenDir);
            saveProperties(settings, FILE_NAME_SETTINGS);
            
            setLookAndFeel(currentLF);  // return to former look and feel
            return new File(path);
         } else {
            okaysSaveDialog = false; // if user cancels or closes dialog
         }
      } catch (IOException ex) {
         ex.printStackTrace();
      }
      setLookAndFeel(currentLF);  // return to former look and feel
      return null;
   }
   
   
   public StatisticsDialog createStatisticsDialog() {
      commonValue.getLeakStatistics().calculate();
      StatisticsDialog dialog = new StatisticsRenderer(base, false,
           commonValue.getLeakStatistics()).getDialog();
      dialog.setLocation(2000, 2000);
      dialog.setVisible(true);
      dialog.dispose();
      return dialog;
   }
   
   public boolean createFile(Container[] components) {
      //create a BufferedImage for each component
      BufferedImage[] awtImages = new BufferedImage[components.length];
      for (int i = 0; i < components.length; i++) {
         awtImages[i] = new BufferedImage(components[i].getWidth(),
              components[i].getHeight(), BufferedImage.TYPE_INT_RGB);
         Graphics2D graphics = awtImages[i].createGraphics();
         components[i].print(graphics);
      }
      logoImage = createLogoImage();
      return createSpecificFile(awtImages);
   }
   public abstract boolean createSpecificFile(BufferedImage[] awtImages);
   
   public static Properties loadProperties(String filePath) throws FileNotFoundException, IOException{
      Properties settings = new Properties();
      FileInputStream in = new FileInputStream(filePath);
      settings.load(in);
      in.close();
      return settings;
   }
   
   public static void saveProperties(Properties settings, String filePath) throws FileNotFoundException, IOException {
      File file = new File(filePath);
      file.createNewFile();
      FileOutputStream out = new FileOutputStream(filePath);
      settings.store(out, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("User's_settings"));
      out.close();
   }
   
   public void setLookAndFeel(String className) {
      try {
         UIManager.setLookAndFeel(className);
      } catch (UnsupportedLookAndFeelException ex) {
         ex.printStackTrace();
      } catch (IllegalAccessException ex) {
         ex.printStackTrace();
      } catch (ClassNotFoundException ex) {
         ex.printStackTrace();
      } catch (InstantiationException ex) {
         ex.printStackTrace();
      }
   }

    //add on 20091021.be
    //reason : v3-8 create pdf file.
    private Container[] setExportStatisticsTableToPdf(){

      ArrayList<JTable> tables = base.getTheCommonValue().getStatisticsTables();
      if(tables != null){
          int len = tables.size();
          return setExportStatisticsTable(len,tables);
      }else{
//          System.out.println("tables size is null");
          new JTablePanel(base.getTheCommonValue());
          ArrayList<JTable> listtable = base.getTheCommonValue().getStatisticsTables();
          int len = listtable.size();
          return setExportStatisticsTable(len,listtable);
      }

   }
    
    //add on 20091021.be
    //reason : v3-8 create pdf file.
     private Container[] setExportStatisticsTable(int len,ArrayList<JTable> tables){

          //add on 20100819.-------begin
          Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();
          int height = dim.height;
          //------------ end
          Container[] listStatisticsTable =  new Container[len];
          for(int i = 0 ; i < len ; i++){

             JPanel maintablepanel = new JPanel (new BorderLayout());
             JPanel titlepanel = new JPanel (new GridLayout (0, 1));
             JTableTitle ttitle = new JTableTitle(base.getTheCommonValue());
             JTable tmpTitleTable = ttitle.setTitle();
             //add on 20100819. Richard's requirement. -- begin
             tmpTitleTable.setRowHeight(12);
             tmpTitleTable.setFont(new Font("",Font.BOLD,10));
              //--- end
             titlepanel.add(tmpTitleTable);
             maintablepanel.add(titlepanel,BorderLayout.NORTH);

             JPanel panel = new JPanel (new GridLayout (0, 1));
             maintablepanel.setPreferredSize(new Dimension(680,height));
//             maintablepanel.setBackground(Color.GREEN);

             // tables.get(i).setDefaultRenderer(Object.class, new TableCellTextAreaRenderer());
             JTable tmpTable = tables.get(i);
             //add on 20100819. Richard's requirement. -- begin
             tmpTable.setRowHeight(height/73);
             tmpTable.setFont(new Font("",Font.BOLD,10));
             //-----end

             panel.add(tables.get(i));

             //panel.setSize(800, 5000);
             //System.out.println("tables.get(i).getRowHeight() =="+tables.get(i).getRowHeight());
             maintablepanel.add(panel,BorderLayout.CENTER);
             StatisticsPDFFrame t = new StatisticsPDFFrame();
             t.addPanel(maintablepanel);
             t.pack();

             listStatisticsTable[i] = t.getPanel();
          }
          return listStatisticsTable;
     }

//     private ArrayList setStatisticsTableToPdfList(){
//         Container[] statisticsTables = setExportStatisticsTableToPdf();
//
//         ArrayList listStatisticsTableToPdf = new ArrayList();
//
//         if (statisticsTables != null && statisticsTables.length > 0) {
//            for (Container component : statisticsTables) {
//               listStatisticsTableToPdf.add(component);
//            }
//         }
//         return listStatisticsTableToPdf;
//     }
     
      /** create logo image to be added to every page */
    public Image createLogoImage() {
//      String logoPath = commonValue.getBasicSetting().LogoFilePath;
        String logoPath = base.getTheCommonValue().getBasicSetting().ServiceLogoFilePath; //modify on 20100819.Be.
        ImageIcon icon = PrintManager.validateAndCreateImageIcon(logoPath);
        Image logoImage = null;
        if (icon != null) {
            try {
                    logoImage = Image.getInstance(icon.getImage(), null);
                logoImage.setAlignment(Image.RIGHT);
                logoImage.scaleToFit(20 * 10, 20);
            } catch (BadElementException ex) {
                ex.printStackTrace();
            } catch (IOException ex) {
                ex.printStackTrace();
            }
        }
        return logoImage;
    }

}
