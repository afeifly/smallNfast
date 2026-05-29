package com.cs.canalyzer.print.printing;

import com.cs.canalyzer.gui.Base;
import java.awt.event.*;
import java.awt.*;
import java.awt.print.*;
import javax.swing.*;
import java.awt.geom.*;
import java.util.Properties;
import javax.print.PrintService;

public class PrintPreviewDialog extends JDialog implements ActionListener {
   Base base;
   PrintManager printManager;
   /** will be populated only if user presses the OK button, will be empty otherwise */
   Properties userSettings = new Properties();
   private int currentPage = 0;
   /** Book currently being viewed; a subset of printManager.painterBook */
   private Book currentBook;
   private Book standardBook;
   private Book detailBook;
   
   private Graphics graphics;
   private JButton pageSetupButton = new JButton(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Page_Setup"));
   private int previousIndex = 0;
   private JLabel pageLable = new JLabel();
   private JButton nextButton;
   private JButton previousButton;
   private JButton closeButton = new JButton(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Close"));
   private JLabel viewLabel = new JLabel(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("View:"));
   private JComboBox viewCombobox;
   private JButton printButton = new JButton(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Print"));
   private JPanel buttonPanel = new JPanel();
   private JPanel bottomPanel = new JPanel(new BorderLayout());
   private JLabel printerLabel = new JLabel(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("<html><b>Printer_to_use:"));
   private JLabel printerNameLabel = new JLabel();
   private JPanel printerPanel = new JPanel();
   private PreviewCanvas canvas;
//   protected Dimension frameSize = new Dimension(924, 924);
   protected Dimension frameSize = new Dimension(900, 700);
   private boolean detailTooManyPagesWarningShown = false;
   
   public static final Dimension SCREENSIZE = Toolkit.getDefaultToolkit().getScreenSize();
   // by Lewis on 2007.4.13
   private static final String IMAGE_PATH_PREVIOUS = "/com/cs/canalyzer/print/images/previous.gif";
   private static final String IMAGE_PATH_NEXT = "/com/cs/canalyzer/print/images/next.gif";
   private static final String FULL_REPORT = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Full_report");
   private static final String GRAPH_ONLY = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Graph_only");
   private static final String STANDARD_REPORT = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Standard_report");
   private static final String DETAILED_REPORT = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Detailed_report");
   private static final int NUM_OF_DAY_TO_WARN_WHEN_GENERATING_DAILY_REPORT = 100;
    
   
   public PrintPreviewDialog(Window owner, String title,
        Dialog.ModalityType modalityType, PrintManager printManager) {
      super(owner, title, modalityType);
      this.base = (Base)owner;
      this.printManager = printManager;
      
      currentBook = printManager.getPainterBook();
      standardBook = new Book();
      for ( int i = 0; i < currentBook.getNumberOfPages(); i++ ) {
          standardBook.append( currentBook.getPrintable(i), currentBook.getPageFormat(i) );
      }
      
      if ( !base.hasDailyData() ) {
         viewCombobox = new JComboBox(new String[] {STANDARD_REPORT, GRAPH_ONLY});
      } else {
         viewCombobox = new JComboBox(new String[] {STANDARD_REPORT, DETAILED_REPORT, GRAPH_ONLY});
         //modify by be,20090107.
           //viewCombobox = new JComboBox(new String[] {STANDARD_REPORT, GRAPH_ONLY});
      }
      // display the standard report by default
      canvas = new PreviewCanvas(currentBook);
      
      setLayout();
      initPageButtons();
      this.addWindowListener(new WindowAdapter() {
         public void windowClosing(WindowEvent e) {
            closeAction();
         }
      });
      
      // adapt to smaller screen
      if(SCREENSIZE.getHeight() < frameSize.getHeight() ||
           SCREENSIZE.getWidth() < frameSize.getWidth()) {
         frameSize.setSize(SCREENSIZE.getHeight(), SCREENSIZE.getHeight() - 40);
      }
      setSize(frameSize);
      setLocationRelativeTo(owner);
   }
   /** Enable Next button and disable Previous button */
   private void initPageButtons() {
      if (currentBook.getNumberOfPages() < 2) {
         nextButton.setEnabled(false);
      } else {
         nextButton.setEnabled(true);
      }
      previousButton.setEnabled(false);
   }
   
   private void setLayout() {
      this.getContentPane().setLayout(new BorderLayout());
      this.getContentPane().add(canvas, BorderLayout.CENTER);
      //this.getContentPane().add(canvas, BorderLayout.NORTH);
      pageSetupButton.setMnemonic('S');
      pageSetupButton.setToolTipText(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Set_page_printing_options._Cover_") +
           java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("page_of_a_reoport_will_always_be_printed_in_portrait_orientation."));
      pageSetupButton.addActionListener(this);
      buttonPanel.add(pageSetupButton);
      ImageIcon previousIcon = PrintManager.createImageIcon(IMAGE_PATH_PREVIOUS, "");
      previousButton = new JButton(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Previous"), previousIcon);
      previousButton.setMnemonic(',');
      previousButton.addActionListener(this);
      buttonPanel.add(previousButton);
      ImageIcon nextIcon = PrintManager.createImageIcon(IMAGE_PATH_NEXT, "");
      nextButton = new JButton(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Next"), nextIcon);
      nextButton.setHorizontalTextPosition(AbstractButton.LEFT);
      nextButton.setMnemonic('.');
      nextButton.addActionListener(this);
      buttonPanel.add(nextButton);
      buttonPanel.add(pageLable);
      closeButton.setMnemonic('C');
      closeButton.addActionListener(this);
      buttonPanel.add(closeButton);
      buttonPanel.add(viewLabel);
      viewCombobox.setToolTipText(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Choose_what_to_preview."));
      viewCombobox.addActionListener(this);
      buttonPanel.add(viewCombobox);
      printButton.setMnemonic('P');
      printButton.setToolTipText(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Print_what_you_are_previewing._") +
           java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Make_sure_you've_correctly_set_page_printing_options_in_Page_Setup_dialog."));
      printButton.addActionListener(this);
      buttonPanel.add(printButton);
      
      closeButton.setPreferredSize(previousButton.getPreferredSize());
      //viewCombobox.setPreferredSize(previousButton.getPreferredSize());
      printButton.setPreferredSize(previousButton.getPreferredSize());
      pageSetupButton.setPreferredSize(previousButton.getPreferredSize());
      nextButton.setPreferredSize(previousButton.getPreferredSize());
      Font font = new Font("Dialog", 0, 12);
      pageSetupButton.setFont(font);
      closeButton.setFont(font);
      viewLabel.setFont(font);
      viewCombobox.setFont(font);
      printButton.setFont(font);
      pageLable.setFont(font);
      nextButton.setFont(font);
      previousButton.setFont(font);
      
      printerLabel.setFont(font);
      printerNameLabel.setFont(font);
      printerNameLabel.setText("<html><b><font color=blue>" +
           PrintManager.PRINTER_JOB.getPrintService().getName());
      printerNameLabel.setToolTipText(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("To_change_the_printer_to_use,_click_\"Page_Setup_->_Printer...\"."));
      printerPanel.add(printerLabel);
      printerPanel.add(printerNameLabel);
      bottomPanel.add(printerPanel, BorderLayout.NORTH);
      bottomPanel.add(buttonPanel, BorderLayout.SOUTH);
      bottomPanel.setBorder(BorderFactory.createRaisedBevelBorder());
      
      this.getContentPane().add(bottomPanel, BorderLayout.SOUTH);
      getRootPane().setDefaultButton(printButton);
   }
   
   public void actionPerformed(ActionEvent evt) {
      Object src = evt.getSource();
      if (src == nextButton)
         nextAction();
      else if (src == previousButton)
         previousAction();
      else if (src == closeButton){
         closeAction();
      } else if (src == viewCombobox) {       
         veiwComboBoxAction();
      } else if (src == pageSetupButton) {
         pageSetupAction();
      } else if (src == printButton) {
         printAction(currentBook);
      }
   }
   
   /** no need to change page format or refresh canvas if user cancels the dialog.
    *  @Return true if user okays the dialog or false otherwise
    */
   protected boolean pageSetupAction() {
      if (printManager.showPageDialogAndResetPageFormat() == true) {
         setAllPaintersPageFormat(printManager.getPainterBook(), printManager.getCurrentFormat(), false);
         setAllPaintersPageFormat(currentBook, printManager.getCurrentFormat(), false);
         refreshCanvas();
         printerNameLabel.setText("<html><b><font color=blue>" +
              PrintManager.PRINTER_JOB.getPrintService().getName());
         return true;
      }
      return false;
   }
   
   /**
    * Set every painter's page format to the specified one.
    * Note: Default orientation for cover page is portrait
    * @Parameters:
    * applyToCover - true to apply landscape orientation to the cover page or
    * false to apply default orientation to it.
    **/
   public void setAllPaintersPageFormat(Book book, PageFormat pageFormat, boolean applyToCover) {
      for (int i = 0; i < book.getNumberOfPages(); i++) {
         PageFormat pf = (PageFormat)pageFormat.clone();
         int orient =  book.getPageFormat(i).getOrientation();
         pf.setOrientation(orient);
         book.setPage(i, book.getPrintable(i), pf); // preserve all pages' orientation
//         if (book.getNumberOfPages() > 1 && i == 0 && applyToCover == false) {
//            PageFormat pf = (PageFormat)pageFormat.clone();
//            pf.setOrientation(PageFormat.PORTRAIT);
//            book.setPage(i, book.getPrintable(i), pf);
//         } else {
//            book.setPage(i, book.getPrintable(i), pageFormat);
//         }
      }
   }
   
   /** create a book containing the painter(s) for user's choice and then
    *  refresh the canvas
    */
   private void veiwComboBoxAction() {
      String choice = (String)viewCombobox.getSelectedItem();
      if (choice.equals(FULL_REPORT) || choice.equals(STANDARD_REPORT)) {
          currentBook = standardBook;
          //currentBook = printManager.getPainterBook();
      } else if (choice.equals(DETAILED_REPORT)) { 
          if ( detailBook != null )
              currentBook = detailBook;
          else {
          //if(currentBook.getNumberOfPages() > 2){    //add by be,2008/10/20.
            int pages = base.numOfDailyPages();
            if ( pages >= NUM_OF_DAY_TO_WARN_WHEN_GENERATING_DAILY_REPORT && !detailTooManyPagesWarningShown ) {
                if ( JOptionPane.showConfirmDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("The_detail_report_will_contain_") 
                    + pages + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("_graphs._It_may_take_a_while_to_generate._Continue?_") ) != JOptionPane.YES_OPTION ) {
                    viewCombobox.setSelectedItem( STANDARD_REPORT );
                    return;
                }
            }
            detailTooManyPagesWarningShown = true;
            detailBook = createDetailedBook();  
            currentBook = detailBook;
         }
      } else {
//         Printable painter = printManager.getPainterBook().getPrintable(PrintAction.pageIndexGraph);
//         PageFormat pf = printManager.getPainterBook().getPageFormat(PrintAction.pageIndexGraph);
         //modify by be,20090107. 
         Printable painter = printManager.getPainterBook().getPrintable(PrintAction.pageIndexGraph+1);
         PageFormat pf = printManager.getPainterBook().getPageFormat(PrintAction.pageIndexGraph+1);
         currentBook = new Book();
         currentBook.append(painter, pf);
      }
      currentPage = 0;  // so that 1st page will be displayed
      initPageButtons();
      refreshCanvas();
   }
   
   /** page format associated with each painter must be preserved */
   private Book createDetailedBook() {
      Book book = new Book();
     
      for (int i = 0; i < PrintAction.pageCountStanard; i++) {         
         book.append(printManager.getPainterBook().getPrintable(i),
              printManager.getPainterBook().getPageFormat(i));
      }

      for ( int i = 0; i < standardBook.getNumberOfPages(); i++ ) {
          book.append( standardBook.getPrintable(i), standardBook.getPageFormat(i) );
      }
      
      Container[] dailyGraphs = base.getDailyGraphs();
      //Container[] dailyStats = base.getDailyStats();  ---- canceled, Jan 21, 2009
      Painter painter;
      String logoPath = base.getTheCommonValue().getBasicSetting().ServiceLogoFilePath;
      
      if (dailyGraphs != null && dailyGraphs.length > 0) {
         for (Container component : dailyGraphs) {
            painter = new ComponentPainter(null, null, logoPath,false,
                 component);
            book.append(painter, printManager.getCurrentFormatLandscape());
         }
      }
//      if (dailyStats != null && dailyStats.length > 0) {
//         for (Container component : dailyStats) {
//            painter = new ComponentPainter(null, null, logoPath,
//                 component);
//            book.append(painter, printManager.getCurrentFormatPortrait());
//         }
//      }
      return book;
   }
   
   /** close this dialog before showing the Print dialog */
   private void printAction(Book book) {
      PrinterJob job = PrintManager.PRINTER_JOB;
      job.setPageable(book); // assign printed document to print job
      // get current printer service
      PrintService currentService = job.getPrintService();
      if (job.printDialog()) {
         // block the printing if user changed the printer
         if (currentService.equals(job.getPrintService())) {
            try {
               printManager.print();
            } catch (PrinterException ex) {
               ex.printStackTrace();
            }
            closeAction();
         } else {
            String newPrinter = job.getPrintService().getName();
            String msg = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Page_printing_options_have_been_set_for_printer_\"") +
                 currentService.getName() + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString( "\"_only.\nChoosing_to_use_printer_\"") +
                 newPrinter + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("\"_may_cause_undesirable_printout.") +
                 java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString(".\nPlease_select_the_proper_page_printing_options_in_the_dialog_that_follows.") + newPrinter +
                 java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("\"_and_then_restart_the_printing.");
            String title = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Cannot_change_printer_here");
            int choice = JOptionPane.showOptionDialog(this, msg, title, JOptionPane.OK_CANCEL_OPTION,
                 JOptionPane.WARNING_MESSAGE, null, null, null);
            if (choice == JOptionPane.OK_OPTION) {
               // new print service has been assigned
               // what if user cancels page setup dialog?
               // -> got to return to former print service too
               if (pageSetupAction() == true) {
                  return;
               }
            }
            // return to former print service if user cancels the option dialog or
            // okays the option dialog and then cancels the page setup dialog
            try {
               job.setPrintService(currentService);
            } catch (PrinterException ex) {
               ex.printStackTrace();
            }
         }
      } else { // if user cancels the print dialog
         closeAction();
      }
   }
   
   //modified on 2008.1.28
   public void refreshCanvas() {
      this.getContentPane().remove(canvas);
      canvas = new PreviewCanvas(currentBook);
      this.getContentPane().add(canvas, BorderLayout.CENTER);
      this.getContentPane().validate();
      //this.repaint();
   }
   
   /** Save page setup settings to file only if user has OKed the page setup
    * dialog and then dispose dialog */
   private void closeAction() {
//      if (userSettings.isEmpty() == false) {
//         try {
//            PrintManager.storeUserSettings(userSettings);
//         } catch (FileNotFoundException ex) {
//            ex.printStackTrace();
//         } catch (IOException ex) {
//            ex.printStackTrace();
//         }
//      }
      
      this.setVisible(false);
      this.dispose();
   }
   
   private void nextAction() {
      previousButton.setEnabled(true);
      if (currentPage + 2 >= currentBook.getNumberOfPages()) {
         nextButton.setEnabled(false);
      }
      canvas.viewPage(1);
   }
   
   private void previousAction() {
      nextButton.setEnabled(true);
      if (currentPage - 1 <= 0) {
         previousButton.setEnabled(false);
      }
      canvas.viewPage(-1);
   }
   
   class PreviewCanvas extends JPanel {
      private Book painterBook;
      
      public PreviewCanvas(Book painterBook) {
         this.painterBook = painterBook;
         if (currentPage == 0) { // do not change page number when when it's greater than 1
            pageLable.setText(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Page_1_of_") + painterBook.getNumberOfPages());
         }
         setBackground(Color.lightGray);
      }
      
      public void paintComponent(Graphics g) {
         graphics = g;
         super.paintComponent(g);
         Graphics2D g2 = (Graphics2D)g;
         
         PageFormat pf = painterBook.getPageFormat(currentPage);
         double xoff;
         double yoff;
         double scale;
         double px = pf.getWidth();
         double py = pf.getHeight();
         double sx = getWidth() - 1;
         double sy = getHeight() - 1;
         if (px / py < sx / sy) {
            scale = sy / py;
            xoff = 0.5 * (sx - scale * px);
            yoff = 0;
         } else {
            scale = sx / px;
            xoff = 0;
            yoff = 0.5 * (sy - scale * py);
         }
         g2.translate((float)xoff, (float)yoff);
         g2.scale((float)scale, (float)scale);
         
         Rectangle2D page = new Rectangle2D.Double(0, 0, px, py);
         g2.setPaint(Color.white);
         g2.fill(page);
         g2.setPaint(Color.black);
         g2.draw(page); // draw a rectangle representing a sheet of paper
         
         try {
            Printable painter = painterBook.getPrintable(currentPage);
            painter.print(g2, pf, currentPage); // draw contents of current page
         } catch(PrinterException pe) {
            g2.draw(new Line2D.Double(0, 0, px, py));
            g2.draw(new Line2D.Double(0, px, 0, py));
         }
      }
      
      public void viewPage(int pos) {
         int newPage = currentPage + pos;
         if (0 <= newPage && newPage < painterBook.getNumberOfPages()) {
            currentPage = newPage;
            repaint();
            pageLable.setText(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Page_") + (currentPage + 1) + " " + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("_of_") + painterBook.getNumberOfPages());
         }
      }
   }
}