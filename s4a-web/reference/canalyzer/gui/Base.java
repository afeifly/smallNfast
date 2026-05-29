/*
 * Base.java
 *
 * Created on 2007年3月15日, 下午4:12
 */

package com.cs.canalyzer.gui;

import com.cs.caa.registaer.RegistrationDialog;
import com.cs.caa.registaer.RegistrationInfoDialog;
import com.cs.canalyzer.export.ExportDialog;
import com.cs.canalyzer.gui.dialog.About;
import com.cs.canalyzer.gui.dialog.settings.BasicSettingDialog;
import com.cs.canalyzer.gui.dialog.settings.ChangeTextDialog;
import com.cs.canalyzer.gui.dialog.CommentPageDialog;
import com.cs.canalyzer.gui.dialog.NewWaitingDialog;
import com.cs.canalyzer.gui.dialog.PHeaderDialog;
import com.cs.canalyzer.gui.dialog.SaveReportDialog;
import com.cs.canalyzer.gui.dialog.SelectDatabaseDialog;
import com.cs.canalyzer.gui.dialog.StatisticsReportDialog;
import com.cs.canalyzer.gui.dialog.settings.AnalyzesSettingDialog;
import com.cs.canalyzer.gui.dialog.settings.CompressorSettingDialog;
import com.cs.canalyzer.gui.dialog.settings.SelectTimePeriodDialog;
import com.cs.canalyzer.gui.dialog.settings.ViewConfigDialog;
import com.cs.canalyzer.help.HelpConst;
import com.cs.canalyzer.license.CAAExpirationTypeLicense;
import com.cs.canalyzer.print.printing.PrintAction;
import com.cs.canalyzer.print.printing.PrintDetailGraphicPreviewDialog;
import com.cs.canalyzer.print.printing.PrintManager;
import com.cs.canalyzer.print.printing.ReportPrinter;
import com.cs.canalyzer.print.printing.StatisticsDialog;
import com.cs.canalyzer.structs.BasicSetting;
import com.cs.canalyzer.structs.DatabaseInformation;
import com.cs.canalyzer.structs.LeakStatistics;
import com.cs.canalyzer.structs.ReportFile;
import com.cs.canalyzer.structs.Texts;
import com.cs.canalyzer.structs.ViewOptions;
import com.cs.canalyzer.structs.CommonValue;
import com.cs.canalyzer.structs.MeasurementUnit;
import com.cs.canalyzer.structs.ViewChannel;
import com.cs.database.NProtocolHeader;
import com.cs.database.upgrade.DBController;
import com.cs.database.upgrade.UpgraderHSQLDBToCSMDF;
import com.cs.license.ExpirationTypeLicense;
import com.cs.license.License;
import com.cs.license.LicenseController;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.Toolkit;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.URL;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.TimerTask;
import javax.help.HelpBroker;
import javax.help.HelpSet;
import javax.swing.ImageIcon;
import javax.swing.JFileChooser;
import javax.swing.JOptionPane;
import javax.swing.filechooser.FileNameExtensionFilter;

/**
 *
 * @author  msu
 */
public class Base extends javax.swing.JFrame implements ReportPrinter, PropertyChangeListener {
    
    /** Creates new form Base */
    public Base() {
        // checkLicense();   //  ---  moved to main class
         
        myInit();
    }

    private void myInit() {
        theCommonValue = new CommonValue();
        
        // read config file. if it doesn't exist, create default values
        if ( !readConfigFile() ) {
            Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();
            START_X = dim.width / 11; START_Y = dim.height / 11;
            WIDTH = dim.width * 4 / 5;  HEIGHT = dim.height * 4 / 5;
        }

        theCommonValue.addPropertyChangeListener( this );
        
        if ( theCommonValue.getDatabaseInformations().size() == 0 ) 
            autoSearchForCSSoftDatabase();
        
        initVariables();
        
        initComponents();
        
        addPopupMenu( graphicPanel );
        jPanelMain.add( graphicPanel, BorderLayout.CENTER );
        
        initHelp();
        
        jPanelBaseLineButtons.setVisible( false );

        setIconImage( new ImageIcon(getClass().getResource( GUIConst.IMAGE_PATH + GUIConst.LOGO_FILE_NAME)).getImage() ); 
        
        setBounds( START_X, START_Y, WIDTH, HEIGHT );
        //setBounds( START_X, START_Y, HEIGHT * 720 / 526, HEIGHT );
        
        //temp
        jLabelDown.setVisible( false );
        jLabelDownFast.setVisible( false );
        jLabelUpFast.setVisible( false );
        jLabelUp.setVisible( false );
        jFileExport.setVisible( false );
        jButtonSelectPeriod.setVisible( false );
        jFileImport.setVisible( false );
        jFileExportToPDF.setVisible( true );
        jViewSelectPeriod.setVisible( false );
        //jButtonReportType.setVisible( false );

//        //modify on 20091027.be
//        //reason : v3-14 : change arrow button text while comparing from "<-" and "->" to "CH+" and "CH-".
//        jButtonPrevious.setText("CH+");
//        jButtonNext.setText("CH-");


        
        String version = "";
        try {
            version = com.install4j.api.launcher.Variables.getCompilerVariable("sys.version");
        } catch (IOException ex) {
        }
        this.setTitle(GUIConst.VERSION+version);
        
    }
    
    private void initVariables() {
        //viewConfigDlg = new ViewConfigDialog( theCommonValue );
        graphicPanel = new GraphicPanel( theCommonValue );
        selectDatabaseDlg = new SelectDatabaseDialog( theCommonValue );
        pheaderDlg = new PHeaderDialog( theCommonValue );
        compressorSettingDlg = new CompressorSettingDialog( theCommonValue );
        
        //theCommonValue.addPropertyChangeListener( viewConfigDlg );
        theCommonValue.addPropertyChangeListener( graphicPanel );
        theCommonValue.addPropertyChangeListener( pheaderDlg );
        
        myReportFile = new ReportFile( theCommonValue,getGraphicPanel() );
    }
    
    private boolean readConfigFile() {
        try {
            ObjectInputStream in = new ObjectInputStream( new FileInputStream( GUIConst.CONFIG_FILE_NAME ));
            String version = ( String ) in.readObject();
            if ( version == null ) {
                System.out.println( "Read configuration file failed. " );
                return false;
            }

            START_X = in.readInt(); START_Y = in.readInt();
            WIDTH = in.readInt(); HEIGHT = in.readInt();
            
            // database settings
            int size = in.readInt();
            ArrayList<DatabaseInformation> dbInfos = theCommonValue.getDatabaseInformations();
            for ( int i = 0; i < size; i++ ) {
                dbInfos.add( (DatabaseInformation) in.readObject() );
                //theCommonValue.addDatabaseInformationdbInfos.add( (DatabaseInformation) in.readObject() );
            }
            int index = in.readInt();
            theCommonValue.setSelectedDatabaseIndex( index );
            if ( index >= 0 && dbInfos.size() > 0 ) {
                if ( !theCommonValue.getDataBase().openDatabase( dbInfos.get( index ).DatabasePath )) {
                    JOptionPane.showMessageDialog( this, "Open database fail. Please set database connection properly." );
                }
            }
            
            // calculation settings
            /*LeakStatistics stat = theCommonValue.getLeakStatistics();
            stat.cosP = in.readFloat();
            stat.fullLoadCosP = in.readFloat();
            stat.noLoadCosP = in.readFloat();
            stat.fullLoadCurrent = in.readFloat();
            stat.noLoadCurrent = in.readFloat();
            stat.voltage = in.readFloat();
            stat.costPerKwh = in.readFloat();*/
            //stat.currency = (String) in.readObject();
            //stat.useAverage = in.readInt();  ---> move to ViewOptions
            LeakStatistics stat = ( LeakStatistics ) in.readObject();
            theCommonValue.setLeakStatistics( stat );

            // texts
            theCommonValue.setTexts( ( Texts ) in.readObject() );
            
            // basic information
            theCommonValue.setBasicSetting( (BasicSetting) in.readObject() );
            
            // last opened file path
            GUIConst.LOAD_FILE_PATH = (String) in.readObject();
            
            in.close();
            return true;
        } catch (Exception e) {
            System.out.println( "readConfigFile: "  + e.getLocalizedMessage());
            return false;
       }        
    }
     
    private void writeConfigFile() {
        try {
            ObjectOutputStream out = new ObjectOutputStream( new FileOutputStream( GUIConst.CONFIG_FILE_NAME ));
            
            // writes in total device number, then all device one by one
            out.writeObject( GUIConst.VERSION );
            
            // save the size of the screen
            out.writeInt( this.getX() ); out.writeInt( this.getY() );
            out.writeInt( this.getWidth() ); out.writeInt( this.getHeight() );
            
            // database settings
            int size = theCommonValue.getDatabaseInformations().size();
            out.writeInt( size );
            //theCommonValue.getDatabaseInformations().get(0).DatabasePath = DatabaseInformation.DEFAULT_DB_PATH;
            for ( int i = 0; i < size; i++ ) {
                out.writeObject( theCommonValue.getDatabaseInformations().get(i) );
            }
            out.writeInt( theCommonValue.getSelectedDatabaseIndex() );
            
            // calculation settings
            LeakStatistics stat = theCommonValue.getLeakStatistics();
            out.writeObject( stat );
            /*out.writeFloat( stat.cosP );
            out.writeFloat( stat.fullLoadCosP );
            out.writeFloat( stat.noLoadCosP );
            out.writeFloat( stat.fullLoadCurrent );
            out.writeFloat( stat.noLoadCurrent );
            out.writeFloat( stat.voltage );
            out.writeFloat( stat.costPerKwh );*/
            //out.writeObject( stat.currency );
            // out.writeInt( stat.useAverage );  ---> moved to ViewOptions
            
            // texts
            out.writeObject( theCommonValue.getTexts() );
            
            // basic information
            out.writeObject( theCommonValue.getBasicSetting() );
            
            // last opened file path
            out.writeObject( GUIConst.LOAD_FILE_PATH );
           
            out.close();
        } catch (IOException e) {
            System.out.println( "writeConfigFile: " + e.getLocalizedMessage());
        }        
    }
    
    private void autoSearchForCSSoftDatabase() {
        ArrayList<DatabaseInformation> dbs = DatabaseInformation.searchForCSSoftDatabases();
        if ( dbs == null || dbs.size() == 0 ) {
            JOptionPane.showMessageDialog( null, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("No_CSSoft_database_was_found_in_this_machine._Please_setup_database_connection_manually.") );
        } else {
            JOptionPane.showMessageDialog( null, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Auto_search_result:_") + dbs.size() + " " 
                    + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("_CSSoft_database_found_in_this_machine.") );
            theCommonValue.setDatabaseInformations( dbs );
            //theCommonValue.setSelectedDatabaseIndex( 0 );
            theCommonValue.getDataBase().openDatabase( dbs.get( 0 ).DatabasePath );
        }
    }
    
    private void addPopupMenu( Component c ) {
        c.addMouseListener(new MouseAdapter() {
            public void mousePressed(MouseEvent event) {
                checkForTriggerEvent(event);
            }
            
            public void mouseReleased(MouseEvent event) {
                checkForTriggerEvent(event);
            }
            
            private void checkForTriggerEvent(MouseEvent event) {
                if (event.isPopupTrigger()) {
                    jPopupMenuBase.show(event.getComponent(), event.getX(), event.getY());
                }
            }
        });
    }
    
    
    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {
        java.awt.GridBagConstraints gridBagConstraints;

        jPopupMenuBase = new javax.swing.JPopupMenu();
        jPanelMain = new javax.swing.JPanel();
        jPanel3 = new javax.swing.JPanel();
        jPanelIcons = new javax.swing.JPanel();
        jButtonFileSelect = new javax.swing.JButton();
        jButtonPrintPreview = new javax.swing.JButton();
        jButtonChangeText = new javax.swing.JButton();
        jButtonShowStatistics = new javax.swing.JButton();
        jButtonCalculationSetting = new javax.swing.JButton();
        jButtonBasicSetting = new javax.swing.JButton();
        jButtonAddComment = new javax.swing.JButton();
        jButtonSelectChannel = new javax.swing.JButton();
        jButtonDefineLeakage = new javax.swing.JButton();
        jButtonSelectPeriod = new javax.swing.JButton();
        jButtonCompare = new javax.swing.JButton();
        jButtonReportType = new javax.swing.JButton();
        jButtonStackFlow = new javax.swing.JButton();
        jPanelBaseLineButtons = new javax.swing.JPanel();
        jLabelUpFast = new javax.swing.JLabel();
        jLabelUp = new javax.swing.JLabel();
        jLabelDown = new javax.swing.JLabel();
        jLabelDownFast = new javax.swing.JLabel();
        jButtonUpFast = new javax.swing.JButton();
        jButtonUp = new javax.swing.JButton();
        jButtonDown = new javax.swing.JButton();
        jButtonDownFast = new javax.swing.JButton();
        jPanelPreviousNext = new javax.swing.JPanel();
        jButtonZoomIn = new javax.swing.JButton();
        jLabel2 = new javax.swing.JLabel();
        jButtonZoomOut = new javax.swing.JButton();
        jButtonPrevious = new javax.swing.JButton();
        jLabel1 = new javax.swing.JLabel();
        jButtonNext = new javax.swing.JButton();
        jMainBar = new javax.swing.JMenuBar();
        jFileMenu = new javax.swing.JMenu();
        jFileSelect = new javax.swing.JMenuItem();
        jFileSelectDB = new javax.swing.JMenuItem();
        jFileSeparator3 = new javax.swing.JSeparator();
        jFileSaveReport = new javax.swing.JMenuItem();
        jFileLoadReport = new javax.swing.JMenuItem();
        jFileImport = new javax.swing.JMenuItem();
        jFileExport = new javax.swing.JMenuItem();
        jFileExportToPDF = new javax.swing.JMenuItem();
        jMIExportData = new javax.swing.JMenuItem();
        jFileSeparator2 = new javax.swing.JSeparator();
        jFilePageSetup = new javax.swing.JMenuItem();
        jFilePrintPreview = new javax.swing.JMenuItem();
        jFilePrint = new javax.swing.JMenuItem();
        jFileExit = new javax.swing.JMenuItem();
        jSettingMenu = new javax.swing.JMenu();
        jSettingChangeText = new javax.swing.JMenuItem();
        jSettingCalculation = new javax.swing.JMenuItem();
        jSettingBasic = new javax.swing.JMenuItem();
        jToolMenu = new javax.swing.JMenu();
        jToolShowStatistics = new javax.swing.JMenuItem();
        jToolDefineLeakage = new javax.swing.JMenuItem();
        jToolSelectChannel = new javax.swing.JMenuItem();
        jToolCompareData = new javax.swing.JMenuItem();
        jToolAddComment = new javax.swing.JMenuItem();
        jToolWriteCommentPage = new javax.swing.JMenuItem();
        jToolStackCompressorFlowValeu = new javax.swing.JMenuItem();
        jToolSortedVolumeFlow = new javax.swing.JMenuItem();
        jViewMenu = new javax.swing.JMenu();
        jViewSelectReportType = new javax.swing.JMenuItem();
        jViewSelectPeriod = new javax.swing.JMenuItem();
        jViewReload = new javax.swing.JMenuItem();
        jViewDisplayRecordAtCursor = new javax.swing.JMenuItem();
        jSeparator1 = new javax.swing.JSeparator();
        jViewZoomIn = new javax.swing.JMenuItem();
        jViewZoomOut = new javax.swing.JMenuItem();
        jHelpMenu = new javax.swing.JMenu();
        jHelpContent = new javax.swing.JMenuItem();
        jHelpRegister = new javax.swing.JMenuItem();
        jHelpAbout = new javax.swing.JMenuItem();

        setDefaultCloseOperation(javax.swing.WindowConstants.EXIT_ON_CLOSE);
        setTitle(FRAME_TITLE);
        setMinimumSize(new Dimension( MIN_WIDTH, MIN_HEIGHT ));
        addWindowListener(new java.awt.event.WindowAdapter() {
            public void windowClosing(java.awt.event.WindowEvent evt) {
                formWindowClosing(evt);
            }
        });

        jPanelMain.setLayout(new java.awt.BorderLayout());

        jPanel3.setPreferredSize(new java.awt.Dimension(130, 100));
        jPanel3.setLayout(new java.awt.BorderLayout());

        jPanelIcons.setPreferredSize(new java.awt.Dimension(94, 300));
        jPanelIcons.setLayout(new java.awt.GridBagLayout());

        jButtonFileSelect.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_file.png"))); // NOI18N
        java.util.ResourceBundle bundle = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts"); // NOI18N
        jButtonFileSelect.setToolTipText(bundle.getString("Select_recorded_file_from_database.")); // NOI18N
        jButtonFileSelect.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.RAISED));
        jButtonFileSelect.setPreferredSize(new Dimension( ICON_WIDTH, ICON_HEIGHT ));
        jButtonFileSelect.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonFileSelectActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.insets = new java.awt.Insets(4, 3, 4, 3);
        jPanelIcons.add(jButtonFileSelect, gridBagConstraints);

        jButtonPrintPreview.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_printpreview.png"))); // NOI18N
        jButtonPrintPreview.setToolTipText(bundle.getString("Print_preview_for_report_or_graph.")); // NOI18N
        jButtonPrintPreview.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.RAISED));
        jButtonPrintPreview.setPreferredSize(new Dimension( ICON_WIDTH, ICON_HEIGHT ));
        jButtonPrintPreview.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonPrintPreviewActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 1;
        gridBagConstraints.gridy = 2;
        gridBagConstraints.insets = new java.awt.Insets(4, 3, 4, 3);
        jPanelIcons.add(jButtonPrintPreview, gridBagConstraints);

        jButtonChangeText.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_changetext.png"))); // NOI18N
        jButtonChangeText.setToolTipText(bundle.getString("Change_text_on_the_graph_including_title,_axis_and_legends.")); // NOI18N
        jButtonChangeText.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.RAISED));
        jButtonChangeText.setEnabled(false);
        jButtonChangeText.setPreferredSize(new Dimension( ICON_WIDTH, ICON_HEIGHT ));
        jButtonChangeText.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonChangeTextActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 1;
        gridBagConstraints.gridy = 4;
        gridBagConstraints.insets = new java.awt.Insets(4, 3, 4, 3);
        jPanelIcons.add(jButtonChangeText, gridBagConstraints);

        jButtonShowStatistics.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_statistics.png"))); // NOI18N
        jButtonShowStatistics.setToolTipText(bundle.getString("Show_statistics.")); // NOI18N
        jButtonShowStatistics.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.RAISED));
        jButtonShowStatistics.setEnabled(false);
        jButtonShowStatistics.setPreferredSize(new Dimension( ICON_WIDTH, ICON_HEIGHT ));
        jButtonShowStatistics.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonShowStatisticsActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 2;
        jPanelIcons.add(jButtonShowStatistics, gridBagConstraints);

        jButtonCalculationSetting.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_calculatesetup.png"))); // NOI18N
        jButtonCalculationSetting.setToolTipText(bundle.getString("Settings_for_analyzes.")); // NOI18N
        jButtonCalculationSetting.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.RAISED));
        jButtonCalculationSetting.setEnabled(false);
        jButtonCalculationSetting.setPreferredSize(new Dimension( ICON_WIDTH, ICON_HEIGHT ));
        jButtonCalculationSetting.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonCalculationSettingActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 1;
        gridBagConstraints.gridy = 0;
        gridBagConstraints.insets = new java.awt.Insets(4, 3, 4, 3);
        jPanelIcons.add(jButtonCalculationSetting, gridBagConstraints);

        jButtonBasicSetting.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_basicsetup.png"))); // NOI18N
        jButtonBasicSetting.setToolTipText(bundle.getString("Basic_settings_such_as_company_information._The_information_will_appear_in_printed_reports.")); // NOI18N
        jButtonBasicSetting.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.RAISED));
        jButtonBasicSetting.setPreferredSize(new Dimension( ICON_WIDTH, ICON_HEIGHT ));
        jButtonBasicSetting.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonBasicSettingActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 1;
        gridBagConstraints.gridy = 1;
        gridBagConstraints.insets = new java.awt.Insets(4, 3, 4, 3);
        jPanelIcons.add(jButtonBasicSetting, gridBagConstraints);

        jButtonAddComment.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_addcomment.png"))); // NOI18N
        jButtonAddComment.setToolTipText(bundle.getString("Add_comment_to_the_graph._Comments_will_be_printed_with_report.")); // NOI18N
        jButtonAddComment.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.RAISED));
        jButtonAddComment.setPreferredSize(new Dimension( ICON_WIDTH, ICON_HEIGHT ));
        jButtonAddComment.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonAddCommentActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 1;
        gridBagConstraints.gridy = 3;
        gridBagConstraints.insets = new java.awt.Insets(4, 3, 4, 3);
        jPanelIcons.add(jButtonAddComment, gridBagConstraints);

        jButtonSelectChannel.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_selectchannel.png"))); // NOI18N
        jButtonSelectChannel.setToolTipText(bundle.getString("Select_which_channel(s)_value_should_be_shown_in_the_graph_and_report.")); // NOI18N
        jButtonSelectChannel.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.RAISED));
        jButtonSelectChannel.setPreferredSize(new Dimension( ICON_WIDTH, ICON_HEIGHT ));
        jButtonSelectChannel.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonSelectChannelActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 1;
        gridBagConstraints.insets = new java.awt.Insets(4, 3, 4, 3);
        jPanelIcons.add(jButtonSelectChannel, gridBagConstraints);

        jButtonDefineLeakage.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_defineleakage.png"))); // NOI18N
        jButtonDefineLeakage.setToolTipText(bundle.getString("Define_leakage_line_in_the_graph.")); // NOI18N
        jButtonDefineLeakage.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.RAISED));
        jButtonDefineLeakage.setPreferredSize(new Dimension( ICON_WIDTH, ICON_HEIGHT ));
        jButtonDefineLeakage.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonDefineLeakageActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 3;
        gridBagConstraints.insets = new java.awt.Insets(4, 3, 4, 3);
        jPanelIcons.add(jButtonDefineLeakage, gridBagConstraints);

        jButtonSelectPeriod.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_selectperiod.png"))); // NOI18N
        jButtonSelectPeriod.setToolTipText(bundle.getString("Select_certain_time_period_to_display.")); // NOI18N
        jButtonSelectPeriod.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.RAISED));
        jButtonSelectPeriod.setPreferredSize(new Dimension( ICON_WIDTH, ICON_HEIGHT ));
        jButtonSelectPeriod.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonSelectPeriodActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 1;
        gridBagConstraints.gridy = 5;
        gridBagConstraints.insets = new java.awt.Insets(4, 3, 4, 3);
        jPanelIcons.add(jButtonSelectPeriod, gridBagConstraints);

        jButtonCompare.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_compare.png"))); // NOI18N
        jButtonCompare.setToolTipText(bundle.getString("Compare_records_in_daily_or_weekly_(depends_on_report_type)_basis.")); // NOI18N
        jButtonCompare.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.RAISED));
        jButtonCompare.setPreferredSize(new Dimension( ICON_WIDTH, ICON_HEIGHT ));
        jButtonCompare.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonCompareActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 4;
        jPanelIcons.add(jButtonCompare, gridBagConstraints);

        jButtonReportType.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_reporttype.png"))); // NOI18N
        jButtonReportType.setToolTipText(bundle.getString("Select_report_type,_using_average_value_or_not.")); // NOI18N
        jButtonReportType.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.RAISED));
        jButtonReportType.setPreferredSize(new Dimension( ICON_WIDTH, ICON_HEIGHT ));
        jButtonReportType.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonReportTypeActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 5;
        jPanelIcons.add(jButtonReportType, gridBagConstraints);

        jButtonStackFlow.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_stackflow.png"))); // NOI18N
        jButtonStackFlow.setToolTipText(bundle.getString("Show_stack_view_of_selected_flow_channels_.")); // NOI18N
        jButtonStackFlow.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.RAISED));
        jButtonStackFlow.setPreferredSize(new Dimension( ICON_WIDTH, ICON_HEIGHT ));
        jButtonStackFlow.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonStackFlowActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 1;
        gridBagConstraints.gridy = 5;
        gridBagConstraints.insets = new java.awt.Insets(4, 3, 4, 3);
        jPanelIcons.add(jButtonStackFlow, gridBagConstraints);

        jPanel3.add(jPanelIcons, java.awt.BorderLayout.PAGE_START);

        jPanelBaseLineButtons.setLayout(new org.netbeans.lib.awtextra.AbsoluteLayout());

        jLabelUpFast.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_upfast.png"))); // NOI18N
        jLabelUpFast.setToolTipText(bundle.getString("Click_to_move_the_leakage_line_up_(fast).")); // NOI18N
        jLabelUpFast.setVerticalAlignment(javax.swing.SwingConstants.TOP);
        jLabelUpFast.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mousePressed(java.awt.event.MouseEvent evt) {
                jLabelUpFastMousePressed(evt);
            }
        });
        jPanelBaseLineButtons.add(jLabelUpFast, new org.netbeans.lib.awtextra.AbsoluteConstraints(90, 10, 25, 26));

        jLabelUp.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_up.png"))); // NOI18N
        jLabelUp.setToolTipText(bundle.getString("Click_to_move_the_leakage_line_up_(slow).")); // NOI18N
        jLabelUp.setVerticalAlignment(javax.swing.SwingConstants.TOP);
        jLabelUp.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mousePressed(java.awt.event.MouseEvent evt) {
                jLabelUpMousePressed(evt);
            }
        });
        jPanelBaseLineButtons.add(jLabelUp, new org.netbeans.lib.awtextra.AbsoluteConstraints(90, 40, 25, 20));

        jLabelDown.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_down.png"))); // NOI18N
        jLabelDown.setToolTipText(bundle.getString("Click_to_move_the_leakage_line_down_(slow).")); // NOI18N
        jLabelDown.setVerticalAlignment(javax.swing.SwingConstants.TOP);
        jLabelDown.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mousePressed(java.awt.event.MouseEvent evt) {
                jLabelDownMousePressed(evt);
            }
        });
        jPanelBaseLineButtons.add(jLabelDown, new org.netbeans.lib.awtextra.AbsoluteConstraints(90, 70, 25, 20));

        jLabelDownFast.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_downfast.png"))); // NOI18N
        jLabelDownFast.setToolTipText(bundle.getString("Click_to_move_the_leakage_line_down_(fast).")); // NOI18N
        jLabelDownFast.setVerticalAlignment(javax.swing.SwingConstants.TOP);
        jLabelDownFast.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mousePressed(java.awt.event.MouseEvent evt) {
                jLabelDownFastMousePressed(evt);
            }
        });
        jPanelBaseLineButtons.add(jLabelDownFast, new org.netbeans.lib.awtextra.AbsoluteConstraints(90, 100, 25, 26));

        jButtonUpFast.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_upfast.png"))); // NOI18N
        jButtonUpFast.setToolTipText(bundle.getString("Move_the_leakage_line_up_in_a_faster_pace.")); // NOI18N
        jButtonUpFast.setPreferredSize(new java.awt.Dimension(50, 30));
        jButtonUpFast.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonUpFastActionPerformed(evt);
            }
        });
        jPanelBaseLineButtons.add(jButtonUpFast, new org.netbeans.lib.awtextra.AbsoluteConstraints(30, 0, 30, 30));

        jButtonUp.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_up.png"))); // NOI18N
        jButtonUp.setToolTipText(bundle.getString("Move_the_leakage_line_up.")); // NOI18N
        jButtonUp.setPreferredSize(new java.awt.Dimension(40, 30));
        jButtonUp.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonUpActionPerformed(evt);
            }
        });
        jPanelBaseLineButtons.add(jButtonUp, new org.netbeans.lib.awtextra.AbsoluteConstraints(30, 30, 30, 30));

        jButtonDown.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_down.png"))); // NOI18N
        jButtonDown.setToolTipText(bundle.getString("Move_the_leakage_line_down.")); // NOI18N
        jButtonDown.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonDownActionPerformed(evt);
            }
        });
        jPanelBaseLineButtons.add(jButtonDown, new org.netbeans.lib.awtextra.AbsoluteConstraints(30, 60, 30, 30));

        jButtonDownFast.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_downfast.png"))); // NOI18N
        jButtonDownFast.setToolTipText(bundle.getString("Move_the_leakage_line_down_in_a_faster_pace.")); // NOI18N
        jButtonDownFast.setPreferredSize(new java.awt.Dimension(50, 30));
        jButtonDownFast.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonDownFastActionPerformed(evt);
            }
        });
        jPanelBaseLineButtons.add(jButtonDownFast, new org.netbeans.lib.awtextra.AbsoluteConstraints(30, 90, 30, 30));

        jPanel3.add(jPanelBaseLineButtons, java.awt.BorderLayout.CENTER);

        jPanelPreviousNext.setPreferredSize(new Dimension( 10, 20 + (int) GraphicPanel.BOTTOM_MARGIN + GraphicPanel.LEGEND_PANEL_HEIGHT ));
        jPanelPreviousNext.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.CENTER, 0, 10));

        jButtonZoomIn.setFont(new java.awt.Font("SansSerif", 3, 10)); // NOI18N
        jButtonZoomIn.setForeground(new java.awt.Color(204, 0, 0));
        jButtonZoomIn.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_zoomin.png"))); // NOI18N
        jButtonZoomIn.setToolTipText(bundle.getString("Zoom_in_tooltip")); // NOI18N
        jButtonZoomIn.setPreferredSize(new java.awt.Dimension(45, 28));
        jButtonZoomIn.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonZoomInActionPerformed(evt);
            }
        });
        jPanelPreviousNext.add(jButtonZoomIn);

        jLabel2.setPreferredSize(new java.awt.Dimension(15, 15));
        jPanelPreviousNext.add(jLabel2);

        jButtonZoomOut.setFont(new java.awt.Font("SansSerif", 3, 10)); // NOI18N
        jButtonZoomOut.setForeground(new java.awt.Color(204, 0, 0));
        jButtonZoomOut.setIcon(new javax.swing.ImageIcon(getClass().getResource("/com/cs/canalyzer/gui/img/icon_zoomout.png"))); // NOI18N
        jButtonZoomOut.setToolTipText(bundle.getString("Zoom_out_tooltip")); // NOI18N
        jButtonZoomOut.setPreferredSize(new java.awt.Dimension(45, 28));
        jButtonZoomOut.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonZoomOutActionPerformed(evt);
            }
        });
        jPanelPreviousNext.add(jButtonZoomOut);

        jButtonPrevious.setFont(new java.awt.Font("SansSerif", 3, 10)); // NOI18N
        jButtonPrevious.setForeground(new java.awt.Color(204, 0, 0));
        jButtonPrevious.setText("<----");
        jButtonPrevious.setToolTipText(bundle.getString("Swith_to_previous_period_of_time._When_comparing,_it'll_switch_to_previous_channel.")); // NOI18N
        jButtonPrevious.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonPreviousActionPerformed(evt);
            }
        });
        jPanelPreviousNext.add(jButtonPrevious);

        jLabel1.setPreferredSize(new java.awt.Dimension(10, 15));
        jPanelPreviousNext.add(jLabel1);

        jButtonNext.setFont(new java.awt.Font("SansSerif", 3, 10)); // NOI18N
        jButtonNext.setForeground(new java.awt.Color(204, 0, 0));
        jButtonNext.setText("---->");
        jButtonNext.setToolTipText(bundle.getString("Swith_to_next_period_of_time._When_comparing,_it'll_switch_to_next_channel.")); // NOI18N
        jButtonNext.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonNextActionPerformed(evt);
            }
        });
        jPanelPreviousNext.add(jButtonNext);

        jPanel3.add(jPanelPreviousNext, java.awt.BorderLayout.SOUTH);

        jPanelMain.add(jPanel3, java.awt.BorderLayout.EAST);

        getContentPane().add(jPanelMain, java.awt.BorderLayout.CENTER);

        jMainBar.setBackground(GUIConst.BACKGROUND_COLOR);
        jMainBar.setFocusable(false);

        jFileMenu.setText(bundle.getString("File")); // NOI18N
        jFileMenu.setFocusable(false);
        jFileMenu.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
        jFileMenu.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jFileMenuActionPerformed(evt);
            }
        });

        jFileSelect.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
        jFileSelect.setText(bundle.getString("Select_File")); // NOI18N
        jFileSelect.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jFileSelectActionPerformed(evt);
            }
        });
        jFileMenu.add(jFileSelect);

        jFileSelectDB.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
        jFileSelectDB.setText(bundle.getString("Select_Database")); // NOI18N
        jFileSelectDB.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jFileSelectDBActionPerformed(evt);
            }
        });
        jFileMenu.add(jFileSelectDB);
        jFileMenu.add(jFileSeparator3);

        jFileSaveReport.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
        jFileSaveReport.setText(bundle.getString("Save_Report")); // NOI18N
        jFileSaveReport.setToolTipText(bundle.getString("Save_current_report_and_record_file(s).")); // NOI18N
        jFileSaveReport.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jFileSaveReportActionPerformed(evt);
            }
        });
        jFileMenu.add(jFileSaveReport);

        jFileLoadReport.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
        jFileLoadReport.setText(bundle.getString("Load_Report")); // NOI18N
        jFileLoadReport.setToolTipText(bundle.getString("Load_report_and_record_file(s)_from_a_file.")); // NOI18N
        jFileLoadReport.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jFileLoadReportActionPerformed(evt);
            }
        });
        jFileMenu.add(jFileLoadReport);

        jFileImport.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
        jFileImport.setText(bundle.getString("Import_Data")); // NOI18N
        jFileImport.setToolTipText(bundle.getString(
            PropertyUtil.isIRLogoType()?"Import_data_from_IR_Data_File_into_current_database.":"Import_data_from_CS_Data_File_into_current_database."));
    jFileImport.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jFileImportActionPerformed(evt);
        }
    });
    jFileMenu.add(jFileImport);

    jFileExport.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jFileExport.setText(bundle.getString("Import_Data")); // NOI18N
    jFileExport.setToolTipText(bundle.getString(
        PropertyUtil.isIRLogoType()?"Export_data_to_IR_Data_File_format_for_importation_to_another_database_or_machine.":"Export_data_to_CS_Data_File_format_for_importation_to_another_database_or_machine."));
jFileExport.addActionListener(new java.awt.event.ActionListener() {
    public void actionPerformed(java.awt.event.ActionEvent evt) {
        jFileExportActionPerformed(evt);
    }
    });
    jFileMenu.add(jFileExport);

    jFileExportToPDF.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jFileExportToPDF.setText(bundle.getString("Export_To_PDF")); // NOI18N
    jFileExportToPDF.setToolTipText(bundle.getString("Export_report_or_graph_to_PDF_file.")); // NOI18N
    jFileExportToPDF.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jFileExportToPDFActionPerformed(evt);
        }
    });
    jFileMenu.add(jFileExportToPDF);

    jMIExportData.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jMIExportData.setText(bundle.getString("Export_data")); // NOI18N
    jMIExportData.setToolTipText(bundle.getString("export_data_tip")); // NOI18N
    jMIExportData.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jMIExportDataActionPerformed(evt);
        }
    });
    jFileMenu.add(jMIExportData);
    jFileMenu.add(jFileSeparator2);

    jFilePageSetup.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jFilePageSetup.setText(bundle.getString("Page_Setup")); // NOI18N
    jFilePageSetup.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jFilePageSetupActionPerformed(evt);
        }
    });
    jFileMenu.add(jFilePageSetup);

    jFilePrintPreview.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jFilePrintPreview.setText(bundle.getString("Print_Preview")); // NOI18N
    jFilePrintPreview.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jFilePrintPreviewActionPerformed(evt);
        }
    });
    jFileMenu.add(jFilePrintPreview);

    jFilePrint.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jFilePrint.setText(bundle.getString("Print")); // NOI18N
    jFilePrint.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jFilePrintActionPerformed(evt);
        }
    });
    jFileMenu.add(jFilePrint);

    jFileExit.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jFileExit.setText(bundle.getString("Exit")); // NOI18N
    jFileExit.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jFileExitActionPerformed(evt);
        }
    });
    jFileMenu.add(jFileExit);

    jMainBar.add(jFileMenu);

    jSettingMenu.setText(bundle.getString("Setting")); // NOI18N
    jSettingMenu.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N

    jSettingChangeText.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jSettingChangeText.setText(bundle.getString("Change_Texts")); // NOI18N
    jSettingChangeText.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jSettingChangeTextActionPerformed(evt);
        }
    });
    jSettingMenu.add(jSettingChangeText);
    jSettingChangeText.getAccessibleContext().setAccessibleDescription(bundle.getString("Change_Texts")); // NOI18N

    jSettingCalculation.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jSettingCalculation.setText(bundle.getString("Calculation_Setting")); // NOI18N
    jSettingCalculation.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jSettingCalculationActionPerformed(evt);
        }
    });
    jSettingMenu.add(jSettingCalculation);

    jSettingBasic.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jSettingBasic.setText(bundle.getString("Basic_Setting")); // NOI18N
    jSettingBasic.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jSettingBasicActionPerformed(evt);
        }
    });
    jSettingMenu.add(jSettingBasic);

    jMainBar.add(jSettingMenu);

    jToolMenu.setText(bundle.getString("Tool")); // NOI18N
    jToolMenu.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jToolMenu.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jToolMenuActionPerformed(evt);
        }
    });

    jToolShowStatistics.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jToolShowStatistics.setText(bundle.getString("Show_Statistics")); // NOI18N
    jToolShowStatistics.setToolTipText(bundle.getString("Show_statistics.")); // NOI18N
    jToolShowStatistics.setEnabled(false);
    jToolShowStatistics.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jToolShowStatisticsActionPerformed(evt);
        }
    });
    jToolMenu.add(jToolShowStatistics);

    jToolDefineLeakage.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jToolDefineLeakage.setText(bundle.getString("Define_Leakage")); // NOI18N
    jToolDefineLeakage.setToolTipText(bundle.getString("Define_Leakage")); // NOI18N
    jToolDefineLeakage.setLabel(bundle.getString("Define_Leakage")); // NOI18N
    jToolDefineLeakage.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jToolDefineLeakageActionPerformed(evt);
        }
    });
    jToolMenu.add(jToolDefineLeakage);

    jToolSelectChannel.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jToolSelectChannel.setText(bundle.getString("Select_Channel")); // NOI18N
    jToolSelectChannel.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jToolSelectChannelActionPerformed(evt);
        }
    });
    jToolMenu.add(jToolSelectChannel);

    jToolCompareData.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jToolCompareData.setText(bundle.getString("Compare_Data")); // NOI18N
    jToolCompareData.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jToolCompareDataActionPerformed(evt);
        }
    });
    jToolMenu.add(jToolCompareData);

    jToolAddComment.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jToolAddComment.setText(bundle.getString("Add_Comment_To_Graph")); // NOI18N
    jToolAddComment.setToolTipText(bundle.getString("Add_comments_to_the_graph.")); // NOI18N
    jToolAddComment.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jToolAddCommentActionPerformed(evt);
        }
    });
    jToolMenu.add(jToolAddComment);

    jToolWriteCommentPage.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jToolWriteCommentPage.setText(bundle.getString("Write_Comment_Page")); // NOI18N
    jToolWriteCommentPage.setToolTipText(bundle.getString("Write_a_comment_page_to_report.")); // NOI18N
    jToolWriteCommentPage.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jToolWriteCommentPageActionPerformed(evt);
        }
    });
    jToolMenu.add(jToolWriteCommentPage);

    jToolStackCompressorFlowValeu.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jToolStackCompressorFlowValeu.setText(bundle.getString("Stack_Compressor_Flow_Value")); // NOI18N
    jToolStackCompressorFlowValeu.setToolTipText(bundle.getString("Stack_flow_values._Click_again_to_cancel.")); // NOI18N
    jToolStackCompressorFlowValeu.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jToolStackCompressorFlowValeuActionPerformed(evt);
        }
    });
    jToolMenu.add(jToolStackCompressorFlowValeu);

    jToolSortedVolumeFlow.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jToolSortedVolumeFlow.setText(bundle.getString("Trigger_/_Cancel_Sorted_Volume_Flow")); // NOI18N
    jToolSortedVolumeFlow.setToolTipText(bundle.getString("Show_sorted_volume_flow._Click_again_to_cancel.")); // NOI18N
    jToolSortedVolumeFlow.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jToolSortedVolumeFlowActionPerformed(evt);
        }
    });
    jToolMenu.add(jToolSortedVolumeFlow);

    jMainBar.add(jToolMenu);

    jViewMenu.setText(bundle.getString("View")); // NOI18N
    jViewMenu.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N

    jViewSelectReportType.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jViewSelectReportType.setText(bundle.getString("Select_Report_Type")); // NOI18N
    jViewSelectReportType.setLabel(bundle.getString("Select_Report_Type")); // NOI18N
    jViewSelectReportType.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jViewSelectReportTypeActionPerformed(evt);
        }
    });
    jViewMenu.add(jViewSelectReportType);

    jViewSelectPeriod.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jViewSelectPeriod.setText(bundle.getString("Select_Time_Period")); // NOI18N
    jViewSelectPeriod.setToolTipText(bundle.getString("Select_certain_time_period_to_display.")); // NOI18N
    jViewSelectPeriod.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jViewSelectPeriodActionPerformed(evt);
        }
    });
    jViewMenu.add(jViewSelectPeriod);

    jViewReload.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jViewReload.setText(bundle.getString("Reload")); // NOI18N
    jViewReload.setToolTipText(bundle.getString("Reload_current_record_file.")); // NOI18N
    jViewReload.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jViewReloadActionPerformed(evt);
        }
    });
    jViewMenu.add(jViewReload);

    jViewDisplayRecordAtCursor.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jViewDisplayRecordAtCursor.setText(bundle.getString("Display_Records_At_Cursor")); // NOI18N
    jViewDisplayRecordAtCursor.setToolTipText(bundle.getString("Display_the_record_values_where_cursor_pointed.")); // NOI18N
    jViewDisplayRecordAtCursor.setLabel(bundle.getString("Display_Records_At_Cursor")); // NOI18N
    jViewDisplayRecordAtCursor.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jViewDisplayRecordAtCursorActionPerformed(evt);
        }
    });
    jViewMenu.add(jViewDisplayRecordAtCursor);
    jViewMenu.add(jSeparator1);

    jViewZoomIn.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jViewZoomIn.setText(bundle.getString("Zoom_in")); // NOI18N
    jViewZoomIn.setToolTipText(bundle.getString("Zoom_in_tooltip")); // NOI18N
    jViewZoomIn.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jViewZoomInActionPerformed(evt);
        }
    });
    jViewMenu.add(jViewZoomIn);

    jViewZoomOut.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jViewZoomOut.setText(bundle.getString("Zoom_Out")); // NOI18N
    jViewZoomOut.setToolTipText(bundle.getString("Zoom_out_tooltip")); // NOI18N
    jViewZoomOut.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jViewZoomOutActionPerformed(evt);
        }
    });
    jViewMenu.add(jViewZoomOut);

    jMainBar.add(jViewMenu);

    jHelpMenu.setText(bundle.getString("Help")); // NOI18N
    jHelpMenu.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N

    jHelpContent.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jHelpContent.setText(bundle.getString("Help_Contents")); // NOI18N
    jHelpContent.setLabel(bundle.getString("Help_Contents")); // NOI18N
    jHelpContent.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jHelpContentActionPerformed(evt);
        }
    });
    jHelpMenu.add(jHelpContent);

    jHelpRegister.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jHelpRegister.setText(bundle.getString("Register_Software")); // NOI18N
    jHelpRegister.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jHelpRegisterActionPerformed(evt);
        }
    });
    jHelpMenu.add(jHelpRegister);

    jHelpAbout.setFont(new java.awt.Font("DialogInput", 0, 12)); // NOI18N
    jHelpAbout.setText(bundle.getString("About")); // NOI18N
    jHelpAbout.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jHelpAboutActionPerformed(evt);
        }
    });
    jHelpMenu.add(jHelpAbout);

    jMainBar.add(jHelpMenu);

    setJMenuBar(jMainBar);

    pack();
    }// </editor-fold>//GEN-END:initComponents

    private void jButtonNextActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonNextActionPerformed
//        graphicPanel.refreshRepaint(true);
        graphicPanel.goNextPeriod();
    }//GEN-LAST:event_jButtonNextActionPerformed

    private void jButtonPreviousActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonPreviousActionPerformed
//  graphicPanel.refreshRepaint(true);
        graphicPanel.goPreviousPeriod();
    }//GEN-LAST:event_jButtonPreviousActionPerformed

    private void jToolShowStatisticsActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jToolShowStatisticsActionPerformed
       showStatistics();
    }//GEN-LAST:event_jToolShowStatisticsActionPerformed

    public void propertyChange( PropertyChangeEvent event ) {
        if ( event.getPropertyName().compareTo( CommonValue.PROTOCOL_HEADER_LIST ) == 0 ) {
            // protocol headers change, daily graph and report all change
            dailyGraphs = null;
            dailyStats = null;

            setLeakageButtonAvailability();
            showBaseLine = false; 
            jPanelBaseLineButtons.setVisible( false );
            graphicPanel.setBaseLineShown( showBaseLine ); 
            
            compressorSettingDlg = new CompressorSettingDialog( theCommonValue );
        } else if ( event.getPropertyName().compareTo( CommonValue.LOAD_REPORT ) == 0 ) {
            dailyGraphs = null;
            dailyStats = null;
            setLeakageButtonAvailability();
//            System.out.println("Base/propertyChange theCommonValue.getCompressors().size() ="+theCommonValue.getCompressors().size());
            compressorSettingDlg = new CompressorSettingDialog( theCommonValue, theCommonValue.getCompressors() );
            setEnableBut(true,CommonValue.ANALYZE_SETTING_IS_ENABLE);
        } else if ( event.getPropertyName().compareTo( CommonValue.SELECTED_CHANNEL ) == 0 
                || event.getPropertyName().compareTo( CommonValue.VIEW_OPTIONS ) == 0  
                || event.getPropertyName().compareTo( CommonValue.TEXTS ) == 0 
                || event.getPropertyName().compareTo( CommonValue.REPORT_TYPE ) == 0 ) {
            // only change graph
            dailyGraphs = null;
            setLeakageButtonAvailability();
        } else if (event.getPropertyName().compareTo( CommonValue.ANALYZE_SETTING_IS_ENABLE ) == 0) {
            //if had file loaded,the analyze setting could used
            setEnableBut(true,CommonValue.ANALYZE_SETTING_IS_ENABLE);
            //add on 20091110.be
            //reason : v3-14 : change arrow button text while comparing from "<-" and "->" to "CH+" and "CH-".
            jButtonPrevious.setText("<----");
            jButtonNext.setText("---->");
        } else if (event.getPropertyName().compareTo( CommonValue.STATISTICS_IS_ENABLE) == 0) {
            setEnableBut(true,CommonValue.STATISTICS_IS_ENABLE);
        }
    }
    
    private void setLeakageButtonAvailability() {
        boolean flowAvailable = false;
        for ( ViewChannel vChannel : theCommonValue.getSelectedChannels() ) {
            if ( MeasurementUnit.IsFlowRateUnit( vChannel.unit ) )
                flowAvailable = true;
        }
        jButtonDefineLeakage.setEnabled( flowAvailable );
        jToolDefineLeakage.setEnabled( flowAvailable );
        if ( !flowAvailable ) {
            if ( showBaseLine ) { 
                showBaseLine = false; 
                jPanelBaseLineButtons.setVisible( false );
                graphicPanel.setBaseLineShown( showBaseLine );
        
            }
        }
    }
    
    /**
     * Return an array of GraphicPanel objects for all daily graphs if they exist,
     * or null if they don't exist
     */
    public Container[] getDailyGraphs() {
        try { 
            if ( dailyGraphs == null ) {
//                System.out.println("base/getDailyGraphs dailyGraphs is null");

                Timestamp[][] startAndEndTimes = generateDailyStartAndEndTime();
                if ( startAndEndTimes == null )
                    return null;

                int numOfDays = startAndEndTimes[0].length;
                
                /* max page number of exporting pdf file or printing is 60 */
                if(numOfDays > GUIConst.MAX_PAGE_NUMBER_OF_EXPORT_PDF_AND_PRINT){
                    numOfDays = GUIConst.MAX_PAGE_NUMBER_OF_EXPORT_PDF_AND_PRINT;
                }
                
                dailyGraphs = new GraphicPanel[numOfDays];
//                 System.out.println("base/getDailyGraphs numOfDays ="+numOfDays);
                boolean doStackView = false;
                if ( graphicPanel.getStatus() == GraphicPanel.STATUS_STACK_VIEW )
                    doStackView = true;
                for ( int i = 0; i < numOfDays; i++ ) {
                    dailyGraphs[i] = new GraphicPanel( theCommonValue );
                    dailyGraphs[i].setPrinting(true);
                    dailyGraphs[i].setSize( graphicPanel.getWidth(), graphicPanel.getHeight() );
                    dailyGraphs[i].createDailyReport( startAndEndTimes[0][i], startAndEndTimes[1][i], graphicPanel.getSelectedChannelDatas(), doStackView );                   
                    dailyGraphs[i].repaint();
                    dailyGraphs[i].clearRecordPeriodLable();
                    new PrintDetailGraphicPreviewDialog(dailyGraphs[i]);
//                    System.out.println("base/getDailyGraphs i ="+i);
                }
            }else{
               setDailyGraphsIsNull(false);
            }
//             System.out.println("base/getDailyGraphs dailyGraphs.length="+dailyGraphs.length);
            return dailyGraphs;
        } catch ( Exception e ) {
            return null;
        }
    }
    
    /**
     * Return an array of statistics dialog panels for all daily statistics if they exist,
     * or null if they don't exist.
     * If sr is a StatisticsRenderer object, you can get the dialog panel using:
     * sr.getDialog().getDialogPanel()
     */
    public Container[] getDailyStats() {
        try { 
            if ( dailyStats == null ) {
                Timestamp[][] startAndEndTimes = generateDailyStartAndEndTime();
                if ( startAndEndTimes == null )
                    return null;
   
                LeakStatistics totalStat = theCommonValue.getLeakStatistics();
                int numOfDays = startAndEndTimes[0].length;
                dailyStats = new Container[numOfDays];
                for ( int i = 0; i < numOfDays; i++ ) {
//                    LeakStatistics stat = new LeakStatistics( theCommonValue.getDataBase() );
//                    stat.setProtocolHeaders( theCommonValue.getProtocolHeaders() );
//                    stat.setLeakLineData( totalStat.getLeakLineData(), totalStat.getLeakLineUnit() );
                    LeakStatistics stat = (LeakStatistics) totalStat.clone();
                    stat.createDailyReport( startAndEndTimes[0][i], startAndEndTimes[1][i] );
                    //dailyStats[i] = new StatisticsRenderer( this, true, stat ).getDialog().getDialogPanel();
                    dailyStats[i] = new StatisticsReportDialog( stat ).getContainer();// modify by be,2008/10/18 .             
                }
            } 
            
            return dailyStats;
        } catch ( Exception e ) {
            return null;
        }
    }
    
    /**
     * Return true if there are daily graphs and statistics available or false otherwise
     */
    public boolean hasDailyData() {
        if ( jButtonCompare.isSelected() )
            return false;
        
        if ( numOfDailyPages() > 1 ) 
            return true;
        else
            return false;
    }
    
    public int numOfDailyPages() {
        Timestamp[][] times = generateDailyStartAndEndTime();
        if ( times == null )
            return 0;
        else
            return times[0].length;
    }
    
    /** based on selected protocol headers, generate an array of startTime and endTime for daily report.
     * each pair of elements represent one day. first set is startTime, secondSet is endTime.
     * reuturns Timestamp[2][x] where x is number of days. if time period less than one day, return null.
     * Note: starttime is always 0:00 of a day
     * Updated: start time and end time will be based on report start and end time. Jan 21, 2009 MS
     */
    private Timestamp[][] generateDailyStartAndEndTime() {
        Calendar totalStartTime = Calendar.getInstance();
        Calendar totalEndTime = Calendar.getInstance();
        //NProtocolHeader pheader;
        long pageTimeMilli;
        int pages;
        
//        ArrayList<NProtocolHeader> pheaders = theCommonValue.getProtocolHeaders();
//        for ( int i = 0; i < pheaders.size(); i++ ) {
//            pheader = pheaders.get(i);
//            if ( i == 0 || totalStartTime.getTime() > pheader.StartTime )
//                totalStartTime.setTime( pheader.StartTime );
//            if ( i == 0 || totalEndTime.getTime() < pheader.StopTime )
//                totalEndTime.setTime( pheader.StopTime );
//        }

        totalStartTime.setTimeInMillis( theCommonValue.getLeakStatistics().getStartTime().getTime() );
        totalEndTime.setTimeInMillis( theCommonValue.getLeakStatistics().getEndTime().getTime() );
        // make times start from 0:00 of a day
        totalStartTime.set( totalStartTime.get( Calendar.YEAR), totalStartTime.get( Calendar.MONTH ), 
                totalStartTime.get( Calendar.DATE ), 0, 0, 0 );
        ///totalEndTime.set( totalEndTime.get( Calendar.YEAR), totalEndTime.get( Calendar.MONTH ), 
                //totalEndTime.get( Calendar.DATE ), 0, 0, 0 );
        
        if ( theCommonValue.getReportType() == CommonValue.REPORT_TYPE_WEEK ) {
            pageTimeMilli = GUIConst.ONE_DAY_MILLS * 7;
            totalStartTime.set( Calendar.DAY_OF_WEEK, Calendar.MONDAY );
            //totalEndTime.set( Calendar.DAY_OF_WEEK, Calendar.SUNDAY );
        } else {
            pageTimeMilli = GUIConst.ONE_DAY_MILLS;
        }
        
        // show warning if too many
        pages = (int)(( totalEndTime.getTimeInMillis() - totalStartTime.getTimeInMillis() ) / pageTimeMilli );
        
        if((( totalEndTime.getTimeInMillis() - totalStartTime.getTimeInMillis() ) % pageTimeMilli ) > 0){
            pages ++ ;
        }
        
        // how many days we have
        //int numOfFullDays = (int) (( totalEndTime.getTime() - totalStartTime.getTime() ) / GUIConst.ONE_DAY_MILLS );
        if ( pages < 1 ) 
            return null;
        else {
            Timestamp[][] startAndEndTimes = new Timestamp[2][pages];
            
            for ( int i = 0; i < pages; i++ ) {
                if(i == (pages - 1)){
                    startAndEndTimes[0][i] = new Timestamp( totalStartTime.getTimeInMillis() + i * pageTimeMilli );
                    startAndEndTimes[1][i] = new Timestamp( totalEndTime.getTimeInMillis() );
            
                }else{
                    startAndEndTimes[0][i] = new Timestamp( totalStartTime.getTimeInMillis() + i * pageTimeMilli );
                    startAndEndTimes[1][i] = new Timestamp( totalStartTime.getTimeInMillis() + ( i + 1 ) * pageTimeMilli );
                }
            }
            // can't let the last day ( not full day ) behind
//            startAndEndTimes[0][pages] = new Timestamp( totalStartTime.getTimeInMillis() + pages * pageTimeMilli );
//            startAndEndTimes[1][pages] = new Timestamp( totalEndTime.getTimeInMillis() );
            
            return startAndEndTimes;
        }
    }
    
    private void jToolWriteCommentPageActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jToolWriteCommentPageActionPerformed
        CommentPageDialog commentDlg = new CommentPageDialog( theCommonValue.getTexts() );
        commentDlg.setVisible( true );
    }//GEN-LAST:event_jToolWriteCommentPageActionPerformed

    private void jFileLoadReportActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jFileLoadReportActionPerformed
        
        
        JFileChooser fc = new JFileChooser();
        FileNameExtensionFilter filter = new FileNameExtensionFilter( ReportFile.REPORT_FILE_SUFFIX,
                    ReportFile.REPORT_FILE_SUFFIX_FILTER, ReportFile.REPORT_FILE_SUFFIX_CAPTICAL_FILTER );
        fc.setFileFilter( filter );
//        if ( GUIConst.LOAD_FILE_PATH != null && !GUIConst.LOAD_FILE_PATH.isEmpty() )
//            fc.setSelectedFile( new File( GUIConst.LOAD_FILE_PATH ));

        if ( fc.showDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Load_Report" ))
                        == JFileChooser.APPROVE_OPTION ) {
            GUIConst.LOAD_FILE_PATH = fc.getSelectedFile().getAbsolutePath();
            final NewWaitingDialog dlg = new NewWaitingDialog();
            dlg.showUp( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Loading_Report"), new TimerTask() {
                public void run() {
                    setBasePanelEnabled(false);
                    int result = myReportFile.loadReport( GUIConst.LOAD_FILE_PATH  );
                    dlg.unShow();
                    setBasePanelEnabled(true);
                    switch ( result ) {
                        case ReportFile.LOAD_REPORT_OK: JOptionPane.showMessageDialog( dlg, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Report_loaded") ); break;
                        case ReportFile.LOAD_REPORT_OK_WITH_DATA_IMPORTED: JOptionPane.showMessageDialog( dlg, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Report_loaded") ); 
                                theCommonValue.triggerProtoclHeaderListUpdate(); break;
                        case ReportFile.LOAD_REPORT_FAIL: JOptionPane.showMessageDialog( dlg, 
                                java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Loading_report_failed" )); break;
                        case ReportFile.LOAD_REPORT_PHEADER_NOT_EXIST: JOptionPane.showMessageDialog( dlg, 
                                java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Record_file_not_exist") ); break;
                        case ReportFile.LOAD_REPORT_WRITE_DATABASE_FAIL: JOptionPane.showMessageDialog( dlg, 
                                java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Error_writing_database") ); break;
                        default: JOptionPane.showMessageDialog( dlg, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Loading_report_failed" ));
                    }
                }
            });  
            setBasePanelEnabled(true);
        }        
    }//GEN-LAST:event_jFileLoadReportActionPerformed

    private void jFileSaveReportActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jFileSaveReportActionPerformed
        SaveReportDialog saveReportDlg = new SaveReportDialog( new ReportFile( theCommonValue,getGraphicPanel() ));        
//        saveReportDlg.setModal( true );
        saveReportDlg.setVisible( true );
    }//GEN-LAST:event_jFileSaveReportActionPerformed

    private void jToolCompareDataActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jToolCompareDataActionPerformed
        if ( graphicPanel.triggerComparison() )
            jButtonCompare.setSelected( !jButtonCompare.isSelected() );
        //else
            //JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Only_available_at_normal_viewing") );
    
        //add on 20091110.be
        //reason : v3-14 : change arrow button text while comparing from "<-" and "->" to "CH+" and "CH-".
        //if(graphicPanel.isComparing()){
        if ( graphicPanel.status() == GraphicPanel.STATUS_COMPARING ) {
            jButtonPrevious.setText("CH-");
            jButtonNext.setText("CH+");
        }else{
            jButtonPrevious.setText("<----");
            jButtonNext.setText("---->");
        }
    }//GEN-LAST:event_jToolCompareDataActionPerformed

    private void jViewDisplayRecordAtCursorActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jViewDisplayRecordAtCursorActionPerformed
        if ( jViewDisplayRecordAtCursor.isSelected() ) {
            jViewDisplayRecordAtCursor.setSelected( false );
            jViewDisplayRecordAtCursor.setText( DISPLAY_RECORD_AT_CURSOR_STRING );
            graphicPanel.triggerDisplayRecordAtCursor( false );
        } else {
            jViewDisplayRecordAtCursor.setSelected( true );
            jViewDisplayRecordAtCursor.setText( DISPLAY_RECORD_AT_CURSOR_STRING + " " + (char)45 + (char)62);
            graphicPanel.triggerDisplayRecordAtCursor( true );
        }
    }//GEN-LAST:event_jViewDisplayRecordAtCursorActionPerformed

    private void jButtonReportTypeActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonReportTypeActionPerformed
        selectReportType();
    }//GEN-LAST:event_jButtonReportTypeActionPerformed

    private void jFileExportToPDFActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jFileExportToPDFActionPerformed
        if(theCommonValue.getCanStatistic()){
            //v3-7: change layout of statistics report.
//            new ExportDialog(this, true).setVisible(true);
            showExportDialog();
        }else{
            confirmEnterIntoCalSetingDig();
        }
    }//GEN-LAST:event_jFileExportToPDFActionPerformed

    /**
     * add on 20091022.be
     * v3-7: change layout of statistics report.
     */
     private void showExportDialog() {
        if ( theCommonValue.getLeakStatistics().isCalculated() ) {
            new JTablePanel(theCommonValue);
            new NewStatisticsReportDialog(theCommonValue);
            new ExportDialog(this, true).setVisible(true);
        } else {
            final NewWaitingDialog waitDlg = new NewWaitingDialog();
            final Base theBase = this;
            waitDlg.showUp( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Processing,_please_wait_..."),
                    new TimerTask() {
                public void run() {
                    setBasePanelEnabled(false);
                    theCommonValue.getLeakStatistics().calculate();
                    new JTablePanel(theCommonValue);
                    new NewStatisticsReportDialog(theCommonValue);

                    waitDlg.unShow();
                    setBasePanelEnabled(true);
                    new ExportDialog(theBase, true).setVisible(true);
                }
            });
            
            setBasePanelEnabled(true);
        }
    }

    private void jFileExportActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jFileExportActionPerformed
        pheaderDlg.setVisible( true );
    }//GEN-LAST:event_jFileExportActionPerformed

    private void jFileImportActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jFileImportActionPerformed
        FileNameExtensionFilter filter = new FileNameExtensionFilter( DBController.EXPORT_FILE_SUFFIX, 
                    DBController.EXPORT_FILE_SUFFIX_FILTER, DBController.EXPORT_FILE_SUFFIX_CAPTICAL_FILTER );
        GUIConst.FILE_CHOOSER.setFileFilter( filter );
        if ( GUIConst.FILE_CHOOSER.showDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Import") ) 
                        == JFileChooser.APPROVE_OPTION ) {
            final NewWaitingDialog dlg = new NewWaitingDialog();
            dlg.showUp( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Importing"), new TimerTask() {
                public void run() {
                    importAction( dlg, GUIConst.FILE_CHOOSER.getSelectedFile().getAbsolutePath() );
                }
            });            
        }
    }//GEN-LAST:event_jFileImportActionPerformed

    private void importAction( NewWaitingDialog dlg, String fileName ) {
        //int imported = theCommonValue.getDataBase().importPHeaderFromSingleFile( fileName );
        int imported = ( new UpgraderHSQLDBToCSMDF() ).importFromPreviousExportation( 
                fileName, theCommonValue.getDataBase() );
        dlg.unShow();
        if ( imported >= 0 ) {
            theCommonValue.triggerProtoclHeaderListUpdate();
            JOptionPane.showMessageDialog( null, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Totally_") + imported + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("_record_file(s)_imported.") );
        } else {
            JOptionPane.showMessageDialog( null, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Importation_failed.") );
        }
    }
    
    private void jButtonCompareActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonCompareActionPerformed
        if ( graphicPanel.triggerComparison() )
            jButtonCompare.setSelected( !jButtonCompare.isSelected() );
       // else
           // JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Only_available_at_normal_viewing") );
         
        //add on 20091110.be
         //reason : v3-14 : change arrow button text while comparing from "<-" and "->" to "CH+" and "CH-".
        //if(graphicPanel.isComparing()){          
        if ( graphicPanel.status() == GraphicPanel.STATUS_COMPARING ) {
            jButtonPrevious.setText("CH-");
            jButtonNext.setText("CH+");
        }else{
            jButtonPrevious.setText("<----");
            jButtonNext.setText("---->");
        }
    }//GEN-LAST:event_jButtonCompareActionPerformed

    private void jMenuPopupReloadActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jMenuPopupReloadActionPerformed
        reloadCurrentProtocolHeader();
    }//GEN-LAST:event_jMenuPopupReloadActionPerformed

    private void jViewReloadActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jViewReloadActionPerformed
        reloadCurrentProtocolHeader();
        //add on 20091110.be
        //reason : v3-14 : change arrow button text while comparing from "<-" and "->" to "CH+" and "CH-".
        jButtonPrevious.setText("<----");
        jButtonNext.setText("---->");

    }//GEN-LAST:event_jViewReloadActionPerformed

    /** provide a way for user to reload the protocol header, clear all previous settings
     */ 
    private void reloadCurrentProtocolHeader() {
        ArrayList<NProtocolHeader> pheaders = theCommonValue.getProtocolHeaders();
        theCommonValue.setProtocolHeaders( pheaders );
    }
    
    private void jViewSelectPeriodActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jViewSelectPeriodActionPerformed
        selectPeriod();
    }//GEN-LAST:event_jViewSelectPeriodActionPerformed

    private void jButtonSelectPeriodActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonSelectPeriodActionPerformed
        selectPeriod();
    }//GEN-LAST:event_jButtonSelectPeriodActionPerformed

    /** the idea is: 1) provide current start and time as default value;
     * 2) if user only set start time, then report type remains, only start time change
     * 3) if select both start and end time, then report type changes to select time period
     */ 
    private void selectPeriod() {
        try {
            Calendar startTime = Calendar.getInstance();
            Calendar endTime = Calendar.getInstance();
            ViewOptions viewOption = theCommonValue.getViewOptions();
            startTime.setTimeInMillis( viewOption.startTime.getTime() );
            endTime.setTimeInMillis( viewOption.endTime.getTime() );
            
            boolean selectEndTime = false;
            if (  theCommonValue.getReportType() == CommonValue.REPORT_TYPE_PERIOD )
                selectEndTime = true;
            
            SelectTimePeriodDialog timeDlg = new SelectTimePeriodDialog( startTime, endTime, selectEndTime );
            timeDlg.setModal( true );
            timeDlg.setVisible( true );

            if ( timeDlg.getSelection() != SelectTimePeriodDialog.SELECTION_OK )
                return;
            
            if ( jButtonCompare.isSelected() ) {
                graphicPanel.triggerComparison();
                jButtonCompare.setSelected( false );
            }
            
            startTime = timeDlg.getStartTime();
            endTime = timeDlg.getEndTime();
            viewOption.startTime.setTime( startTime.getTimeInMillis() );
            viewOption.endTime.setTime( endTime.getTimeInMillis() );
            if ( timeDlg.selectEndTime() )
                theCommonValue.setReportType( CommonValue.REPORT_TYPE_PERIOD );
            theCommonValue.setViewOptions( viewOption );
        } catch ( Exception e ) {
            
        }
    }
    
    private void jButtonDownFastActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonDownFastActionPerformed
        graphicPanel.moveBaseLine ( graphicPanel.BASELINE_DOWN_FAST );
    }//GEN-LAST:event_jButtonDownFastActionPerformed

    private void jButtonDownActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonDownActionPerformed
        graphicPanel.moveBaseLine ( graphicPanel.BASELINE_DOWN );
    }//GEN-LAST:event_jButtonDownActionPerformed

    private void jButtonUpActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonUpActionPerformed
        graphicPanel.moveBaseLine ( graphicPanel.BASELINE_UP );
    }//GEN-LAST:event_jButtonUpActionPerformed

    private void jButtonUpFastActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonUpFastActionPerformed
        graphicPanel.moveBaseLine ( graphicPanel.BASELINE_UP_FAST );
    }//GEN-LAST:event_jButtonUpFastActionPerformed

    private void jLabelDownFastMousePressed(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_jLabelDownFastMousePressed
        graphicPanel.moveBaseLine ( graphicPanel.BASELINE_DOWN_FAST );
    }//GEN-LAST:event_jLabelDownFastMousePressed

    private void jLabelDownMousePressed(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_jLabelDownMousePressed
        graphicPanel.moveBaseLine ( graphicPanel.BASELINE_DOWN );
    }//GEN-LAST:event_jLabelDownMousePressed

    private void jLabelUpMousePressed(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_jLabelUpMousePressed
        graphicPanel.moveBaseLine ( graphicPanel.BASELINE_UP );
    }//GEN-LAST:event_jLabelUpMousePressed

    private void jLabelUpFastMousePressed(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_jLabelUpFastMousePressed
        graphicPanel.moveBaseLine ( graphicPanel.BASELINE_UP_FAST );
    }//GEN-LAST:event_jLabelUpFastMousePressed

    private void jButtonPrintPreviewActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonPrintPreviewActionPerformed
       //modify by be ,2008/10/17
        if(theCommonValue.getCanStatistic()){
            printPreview();
        }else{
            confirmEnterIntoCalSetingDig();
        }
//        if(theCommonValue.getProtocolHeaders().size() > 0){
//             printPreview();
//        }else{
//            JOptionPane.showMessageDialog(null,"No Record File.");
//        }
       
    }//GEN-LAST:event_jButtonPrintPreviewActionPerformed

    private void printPreview() {
//        if ( theCommonValue.getLeakStatistics().isCalculated() ) {
////            StatisticsReportDialog dlg = new StatisticsReportDialog( theCommonValue.getLeakStatistics() );
//            //modify on 20091022.be
//            //v3-7: change layout of statistics report.
//            new JTablePanel(theCommonValue);
//            new NewStatisticsReportDialog(theCommonValue);
//
//            new PrintAction( this );
//        } else {
            final NewWaitingDialog waitDlg = new NewWaitingDialog();
            final Base theBase = this;
            waitDlg.showUp( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Processing,_please_wait_..."), 
                    new TimerTask() {
                public void run() {
                    setBasePanelEnabled(false);   
                    if ( theCommonValue.getLeakStatistics().isCalculated() ) {

                        new JTablePanel(theCommonValue);
                        new NewStatisticsReportDialog(theCommonValue);

                        getDailyGraphs();                   
                        waitDlg.unShow();
                        setBasePanelEnabled(true); 
                        new PrintAction( theBase );
                    } else {

                        theCommonValue.getLeakStatistics().calculate();           
                        //modified by Lewis on 2008.2.1
                        //new StatisticsRenderer(this, true, theCommonValue.getLeakStatistics()).showDialog();
    //                    StatisticsReportDialog dlg = new StatisticsReportDialog( theCommonValue.getLeakStatistics() );
                        //modify on 20091022.be
                        //v3-7: change layout of statistics report.
                        new JTablePanel(theCommonValue);
                        new NewStatisticsReportDialog(theCommonValue);

                        getDailyGraphs();

                        waitDlg.unShow();
                        setBasePanelEnabled(true); 
                        new PrintAction( theBase );
                    }
                }
            }); 
            
            setBasePanelEnabled(true);
            
//        }
       //added by Lewis on 2007.4.13  
       //theCommonValue.getLeakStatistics().calculate();      
       //modified by Lewis on 2008.2.1
       //statisticsDialog = new StatisticsRenderer( this, true, theCommonValue.getLeakStatistics() ).getDialog();
       //modify by be, 2008/10/18 .
       //statisticsReportDialog = new StatisticsReportDialog(theCommonValue.getLeakStatistics());
       //new PrintAction(this);
      
    }
    
    private void jButtonBasicSettingActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonBasicSettingActionPerformed
        BasicSettingDialog dlg = new BasicSettingDialog( theCommonValue.getBasicSetting(), theCommonValue.getTexts() );
        dlg.setVisible( true );
    }//GEN-LAST:event_jButtonBasicSettingActionPerformed

    private void jButtonAddCommentActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonAddCommentActionPerformed
        graphicPanel.addCommentLabel();
    }//GEN-LAST:event_jButtonAddCommentActionPerformed

    private void jButtonCalculationSettingActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonCalculationSettingActionPerformed
        //CalculateSettingDialog dlg = new CalculateSettingDialog( theCommonValue );
        AnalyzesSettingDialog dlg = new AnalyzesSettingDialog( theCommonValue, compressorSettingDlg );
        dlg.setVisible( true );        
    }//GEN-LAST:event_jButtonCalculationSettingActionPerformed

    private void jButtonDefineLeakageActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonDefineLeakageActionPerformed
        defineLeakage();
    }//GEN-LAST:event_jButtonDefineLeakageActionPerformed

    private void defineLeakage() {
        if ( showBaseLine ) { 
            showBaseLine = false; 
            jPanelBaseLineButtons.setVisible( false );
        } else { 
            showBaseLine = true;
            jPanelBaseLineButtons.setVisible( true );
        }
        
        dailyStats = null;  // leakage data changed
        graphicPanel.setBaseLineShown( showBaseLine ); 
    }
    
    private void jButtonShowStatisticsActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonShowStatisticsActionPerformed
        showStatistics();
    }//GEN-LAST:event_jButtonShowStatisticsActionPerformed

    private void showStatistics() {
        /*if ( !showBaseLine ) {
            JOptionPane.showMessageDialog( this, "Please define leakage line 
first." );
            return;
        }*/
        /*if ( theCommonValue.getProtocolHeaders().size() > 1 ) {
            JOptionPane.showMessageDialog( this, "This feature is not available when doing comparison." );
            return;
        }*/
       
        if(theCommonValue.getCanStatistic()){
            theCommonValue.getLeakStatistics().setSelectedFlowNChannelHeaders(theCommonValue.getSelectedChannels());//add on 2014/5/30 PC's requirement, flow channel come from select channels
            if ( theCommonValue.getLeakStatistics().isCalculated() ) {
//                StatisticsReportDialog dlg = new StatisticsReportDialog( theCommonValue.getLeakStatistics() );
//                dlg.setVisible( true );
                new JTablePanel(theCommonValue);
                NewStatisticsReportDialog demotable = new NewStatisticsReportDialog(theCommonValue);
                demotable.setVisible(true);
            } else {
                final NewWaitingDialog waitDlg = new NewWaitingDialog();
                waitDlg.showUp( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Processing,_please_wait_..."), 
                        new TimerTask() {
                    public void run() {
                        setBasePanelEnabled(false);                        
                        theCommonValue.getLeakStatistics().calculate();           
                        //modified by Lewis on 2008.2.1
                        //new StatisticsRenderer(this, true, theCommonValue.getLeakStatistics()).showDialog();
//                        StatisticsReportDialog dlg = new StatisticsReportDialog( theCommonValue.getLeakStatistics() );
//                        dlg.setVisible( true );
                        new JTablePanel(theCommonValue);
                        NewStatisticsReportDialog demotable = new NewStatisticsReportDialog(theCommonValue);
                        demotable.setVisible(true);
                        waitDlg.unShow();
                        setBasePanelEnabled(true); 
                    }
                }); 
                
                setBasePanelEnabled(true);
                
            } 
        }else{
            confirmEnterIntoCalSetingDig();
        }
    }
     /**
       *@author : be 
       *@date   : july21,2008
       *@desc   : modify according to update specification -------the analyze setting has to be
       *          entered once after a new file is loaded, otherwise you can not press the 
       *          statistics button .
      */
    private void confirmEnterIntoCalSetingDig(){
         int result = JOptionPane.showConfirmDialog( this, NOT_ANALYZE_SETTING_STRING,java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Comfirm"), JOptionPane.YES_NO_OPTION);
          // System.out.println("result = "+result);
         if(JOptionPane.OK_OPTION == result ){
               //CalculateSettingDialog dlg = new CalculateSettingDialog( theCommonValue );
             AnalyzesSettingDialog dlg = new AnalyzesSettingDialog( theCommonValue, compressorSettingDlg );
             dlg.setVisible( true );
         }
    }   
    
    private void jButtonChangeTextActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonChangeTextActionPerformed
        ChangeTextDialog dlg = new ChangeTextDialog( theCommonValue );
        dlg.setVisible( true );
    }//GEN-LAST:event_jButtonChangeTextActionPerformed

    private void jButtonSelectChannelActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonSelectChannelActionPerformed
        viewConfig();
    }//GEN-LAST:event_jButtonSelectChannelActionPerformed

    private void viewConfig() {
        if ( jButtonCompare.isSelected() ) {
            JOptionPane.showMessageDialog( this, NOT_AVAILABLE_WHILE_COMPARING_STRING );
            return;
        }
        
        if ( graphicPanel.getStatus() == GraphicPanel.STATUS_SORTED_FLOW ) {
            JOptionPane.showMessageDialog( this, NOT_AVAILABLE_WHILE_SORTED_VOLUME_STRING );
            return;
        }

        ViewConfigDialog viewConfigDlg = new ViewConfigDialog( theCommonValue );
        theCommonValue.addPropertyChangeListener( viewConfigDlg );
        viewConfigDlg.setVisible( true ); 
    }   
    
    private void jButtonFileSelectActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonFileSelectActionPerformed
        pheaderDlg.setVisible( true );
    }//GEN-LAST:event_jButtonFileSelectActionPerformed

    private void jToolDefineLeakageActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jToolDefineLeakageActionPerformed
        defineLeakage();
    }//GEN-LAST:event_jToolDefineLeakageActionPerformed

    private void jToolAddCommentActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jToolAddCommentActionPerformed
        graphicPanel.addCommentLabel();
    }//GEN-LAST:event_jToolAddCommentActionPerformed

    private void jToolSelectChannelActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jToolSelectChannelActionPerformed
        viewConfig();
    }//GEN-LAST:event_jToolSelectChannelActionPerformed

    private void jViewSelectReportTypeActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jViewSelectReportTypeActionPerformed
        selectReportType();
        
        /*String[] reportTypes = { "One Day", "One Week", "One Month" };
        String initValue = reportTypes[0];
        if ( theCommonValue.getReportType() != CommonValue.REPORT_TYPE_PERIOD )
            initValue = reportTypes[ theCommonValue.getReportType() ];
        String selection = (String) JOptionPane.showInputDialog( this, "Please select report type: ", "Report Type", 
                                            JOptionPane.QUESTION_MESSAGE, null, reportTypes, initValue );

        if ( selection == null ) return;
        
        if ( selection.compareTo( "One Day" ) == 0 ) 
            theCommonValue.setReportType( CommonValue.REPORT_TYPE_DAY );
        else if ( selection.compareTo( "One Week" ) == 0 ) 
            theCommonValue.setReportType( CommonValue.REPORT_TYPE_WEEK );
        else if ( selection.compareTo( "One Month" ) == 0 ) 
            theCommonValue.setReportType( CommonValue.REPORT_TYPE_MONTH );
        else
            theCommonValue.setReportType( CommonValue.REPORT_TYPE_DAY );
        */
    }//GEN-LAST:event_jViewSelectReportTypeActionPerformed
    
    private void selectReportType() {
        SelectReportType select = new SelectReportType( theCommonValue );
        select.setModal( true );
        select.setVisible( true );
    }
    
    private void jSettingBasicActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jSettingBasicActionPerformed
        BasicSettingDialog dlg = new BasicSettingDialog( theCommonValue.getBasicSetting(), theCommonValue.getTexts() );
        dlg.setVisible( true );        
    }//GEN-LAST:event_jSettingBasicActionPerformed

    private void jSettingCalculationActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jSettingCalculationActionPerformed
        //CalculateSettingDialog dlg = new CalculateSettingDialog( theCommonValue );
        AnalyzesSettingDialog dlg = new AnalyzesSettingDialog( theCommonValue, compressorSettingDlg );
        dlg.setVisible( true );
    }//GEN-LAST:event_jSettingCalculationActionPerformed

    private void jSettingChangeTextActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jSettingChangeTextActionPerformed
        ChangeTextDialog dlg = new ChangeTextDialog( theCommonValue );
        dlg.setVisible( true );
    }//GEN-LAST:event_jSettingChangeTextActionPerformed

    private void jFilePageSetupActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jFilePageSetupActionPerformed
        //( new StandAlonePageSetupDialog(this) ).setVisible(true);
       if (PrintManager.hasPrinter(this)) {
          new PrintManager(this).showPageDialogAndResetPageFormat();
       }
    }//GEN-LAST:event_jFilePageSetupActionPerformed

    private void jFilePrintPreviewActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jFilePrintPreviewActionPerformed
        // modify on 20100511, KR's requirement.
        if(theCommonValue.getCanStatistic()){
            printPreview();
        }else{
            confirmEnterIntoCalSetingDig();
        }
//        printPreview();
    }//GEN-LAST:event_jFilePrintPreviewActionPerformed

    private void jFileSelectDBActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jFileSelectDBActionPerformed
        selectDatabaseDlg.setVisible( true );
    }//GEN-LAST:event_jFileSelectDBActionPerformed

    private void formWindowClosing(java.awt.event.WindowEvent evt) {//GEN-FIRST:event_formWindowClosing
        cleanUp();
    }//GEN-LAST:event_formWindowClosing

    private void jHelpRegisterActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jHelpRegisterActionPerformed

//        CAAExpirationTypeLicense licController = new CAAExpirationTypeLicense( new License() );
//        int result = licController.inputLicenseInformation();
//        if ( result == LicenseController.INPUT_LICENSE_VALID ) {
//            
//            String welcStr = null;
//            welcStr = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Thank_you_for_choosing_CS_products.");
//            JOptionPane.showMessageDialog( this, welcStr);
//        } else if ( result == LicenseController.INPUT_LICENSE_INVALID ) {
//            JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("<html>Sorry,_license_key_not_valid._Please_try_again.") + "</html>" );
//        }
          if(!com.suto.license.LicenseController.checkLicenseFileStatus(com.suto.license.LicenseController.getLocalIDFromRegedit("snewID"))){
            RegistrationDialog rD = new RegistrationDialog(null, true);
            rD.setVisible(true);
            }else{
                RegistrationInfoDialog rid = new RegistrationInfoDialog(null, true);
                rid.setVisible(true);
            }          
    }//GEN-LAST:event_jHelpRegisterActionPerformed

    private void jHelpAboutActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jHelpAboutActionPerformed
        //myDB.test();
        About about = new About();
        about.setVisible(true);
    }//GEN-LAST:event_jHelpAboutActionPerformed

    private void jHelpContentActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jHelpContentActionPerformed
        if(PropertyUtil.isIRLogoType()){
            JOptionPane.showMessageDialog(this, 
                     java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("IR_Help_Info")
                        );
            return;
        }
        try {   
            Runtime.getRuntime().exec("cmd /c start .\\newHelpFile\\CAA.chm");
        } catch (IOException ex) {
            ex.printStackTrace();
        }
    }//GEN-LAST:event_jHelpContentActionPerformed

    private void jFileExitActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jFileExitActionPerformed
        cleanUp();
        System.exit(0);
    }//GEN-LAST:event_jFileExitActionPerformed

    private void jFilePrintActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jFilePrintActionPerformed
       //modify it on 20100511, KR's requirement.
//        printPreview();
        if(theCommonValue.getCanStatistic()){
            printPreview();
        }else{
            confirmEnterIntoCalSetingDig();
        }
    }//GEN-LAST:event_jFilePrintActionPerformed

    private void jFileSelectActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jFileSelectActionPerformed
        pheaderDlg.setVisible( true );
    }//GEN-LAST:event_jFileSelectActionPerformed

private void jButtonZoomInActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonZoomInActionPerformed
//    graphicPanel.refreshRepaint(true);
    graphicPanel.zoomIn();
}//GEN-LAST:event_jButtonZoomInActionPerformed

private void jButtonZoomOutActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonZoomOutActionPerformed
//    graphicPanel.refreshRepaint(true);
    graphicPanel.zoomOut();
}//GEN-LAST:event_jButtonZoomOutActionPerformed

private void jViewZoomInActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jViewZoomInActionPerformed
//    graphicPanel.refreshRepaint(true);
    graphicPanel.zoomIn();
}//GEN-LAST:event_jViewZoomInActionPerformed

private void jViewZoomOutActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jViewZoomOutActionPerformed
//    graphicPanel.refreshRepaint(true);
    graphicPanel.zoomOut();
}//GEN-LAST:event_jViewZoomOutActionPerformed

private void jButtonStackFlowActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonStackFlowActionPerformed
    if ( graphicPanel.triggerStackView() )
        jButtonStackFlow.setSelected( !jButtonStackFlow.isSelected() );    
   // else
       // JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Only_available_at_normal_viewing") );
}//GEN-LAST:event_jButtonStackFlowActionPerformed

private void jToolMenuActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jToolMenuActionPerformed
    // TODO add your handling code here:
}//GEN-LAST:event_jToolMenuActionPerformed

private void jToolStackCompressorFlowValeuActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jToolStackCompressorFlowValeuActionPerformed
    // TODO add your handling code here:
   if ( graphicPanel.triggerStackView() )
        jButtonStackFlow.setSelected( !jButtonStackFlow.isSelected() );  
   //else
        //JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Only_available_at_normal_viewing") );
}//GEN-LAST:event_jToolStackCompressorFlowValeuActionPerformed

private void jFileMenuActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jFileMenuActionPerformed
    // TODO add your handling code here:
}//GEN-LAST:event_jFileMenuActionPerformed

private void jToolSortedVolumeFlowActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jToolSortedVolumeFlowActionPerformed
    if ( graphicPanel.triggerSortedVolumeFlow() ) {
//        String text = jToolSortedVolumeFlow.getText();
//        if ( text.endsWith( "x" ) )
//            text = text.substring( 0, text.length() - 2 );
//        else
//            text += " x";
//        jToolSortedVolumeFlow.setText( text );
    } //else
        //JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Only_available_at_normal_viewing") );
    
}//GEN-LAST:event_jToolSortedVolumeFlowActionPerformed

    private void jMIExportDataActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jMIExportDataActionPerformed
        // TODO add your handling code here:
         pheaderDlg.setVisible( true );
    }//GEN-LAST:event_jMIExportDataActionPerformed
    
    private void cleanUp() {
        writeConfigFile();
    
        dispose();
        
        theCommonValue.getDataBase().shutDown();
    }
    
    // added by Lewis on 2007.4.13
    public GraphicPanel getGraphicPanel() {
       return graphicPanel;
    }
    // added by Lewis on 2007.4.13
    public StatisticsDialog getStatisticsDialog() {
       return statisticsDialog;
    }
    
    public String getCommentPageTitle() {
        return theCommonValue.getTexts().CommendPageTitle;
    }
    
    /**
     * Return the comment page's body text as a String or null if it doesn't exist.
     * If null is returned, no comment page will be printed.
     */
    public String getCommentPageBodyText() {
        return theCommonValue.getTexts().CommendPageBodyText;
    }

    
    // added by Lewis on 2007.4.20
    public CommonValue getTheCommonValue() {
       return theCommonValue;
    }    
    
    private void initHelp() {            
//      // Find the HelpSet file and create the HelpSet object:
//        HelpSet hs;
//        HelpBroker hb;
//        
//        //String helpHS = "com/cs/canalyzer/help/main_en_US.hs"; // path to the .hs file
//        String helpHS = HelpConst.FindHSFilePath();
//        ClassLoader cl = Base.class.getClassLoader();
//        try {
//            URL hsURL = HelpSet.findHelpSet(cl, helpHS);
//            hs = new HelpSet(null, hsURL);
//        } catch (Exception ee) {
//            System.err.println("HelpSet \""+ helpHS +"\" not found or parsing failed.");
//            ee.printStackTrace();
//            return;
//        }
//         
//        // Create a HelpBroker object:
//        hb = hs.createHelpBroker();
//        hb.enableHelpOnButton(jHelpContent, "caa", null);
//        // enable window-level context sensitive help
//        // i.e. enable viewing help with F1 key
//        hb.enableHelpKey(this.getRootPane(), "caa", null);
    }
    
    /**
     *@author : BE 
     *@date : july 21,2008
     *@desc : set enable buttons
     */
    private void setEnableBut(boolean v,String mode){
        
        if(CommonValue.ANALYZE_SETTING_IS_ENABLE.equals(mode)){
            //this.jSettingMenu.setEnabled(v);
            this.jSettingCalculation.setEnabled(v);
            this.jSettingChangeText.setEnabled(v);
            this.jButtonChangeText.setEnabled(v);
            this.jButtonCalculationSetting.setEnabled(v);
            //this.jButtonBasicSetting.setEnabled(v);
            this.jButtonShowStatistics.setEnabled(v);          
            this.jToolShowStatistics.setEnabled(v);
        }
    }
    
     public void setBasePanelEnabled(boolean v){
        
        this.setEnabled(v);
    }
    
    
    /**
     * @param args the command line arguments
     */
//    public static void main(String args[]) {
//        java.awt.EventQueue.invokeLater(new Runnable() {
//            public void run() {
//                new Base().setVisible(true);
//            }
//        });
//    }
    
    private final int MIN_WIDTH = 600, MIN_HEIGHT = 400;
    private final int ICON_WIDTH = 40, ICON_HEIGHT = 35;
    
    private final String DISPLAY_RECORD_AT_CURSOR_STRING = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Display_Records_At_Cursor");
    private final String NOT_AVAILABLE_WHILE_COMPARING_STRING = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Sorry,_this_feature_is_not_available_while_comparing_data.");
    private final String NOT_AVAILABLE_WHILE_SORTED_VOLUME_STRING = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Sorry,_this_feature_is_not_available_while_displaying_sorted_volume_flow.");
    private final String NOT_ANALYZE_SETTING_STRING = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Analyzes_settings_has_to_be_set_before_viewing_statistics._Continue?");
    
        
    private final String FRAME_TITLE = GUIConst.VERSION+GUIConst.VERSION_NUMBER;
    
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton jButtonAddComment;
    private javax.swing.JButton jButtonBasicSetting;
    private javax.swing.JButton jButtonCalculationSetting;
    private javax.swing.JButton jButtonChangeText;
    private javax.swing.JButton jButtonCompare;
    private javax.swing.JButton jButtonDefineLeakage;
    private javax.swing.JButton jButtonDown;
    private javax.swing.JButton jButtonDownFast;
    private javax.swing.JButton jButtonFileSelect;
    private javax.swing.JButton jButtonNext;
    private javax.swing.JButton jButtonPrevious;
    private javax.swing.JButton jButtonPrintPreview;
    private javax.swing.JButton jButtonReportType;
    private javax.swing.JButton jButtonSelectChannel;
    private javax.swing.JButton jButtonSelectPeriod;
    private javax.swing.JButton jButtonShowStatistics;
    private javax.swing.JButton jButtonStackFlow;
    private javax.swing.JButton jButtonUp;
    private javax.swing.JButton jButtonUpFast;
    private javax.swing.JButton jButtonZoomIn;
    private javax.swing.JButton jButtonZoomOut;
    private javax.swing.JMenuItem jFileExit;
    private javax.swing.JMenuItem jFileExport;
    private javax.swing.JMenuItem jFileExportToPDF;
    private javax.swing.JMenuItem jFileImport;
    private javax.swing.JMenuItem jFileLoadReport;
    private javax.swing.JMenu jFileMenu;
    private javax.swing.JMenuItem jFilePageSetup;
    private javax.swing.JMenuItem jFilePrint;
    private javax.swing.JMenuItem jFilePrintPreview;
    private javax.swing.JMenuItem jFileSaveReport;
    private javax.swing.JMenuItem jFileSelect;
    private javax.swing.JMenuItem jFileSelectDB;
    private javax.swing.JSeparator jFileSeparator2;
    private javax.swing.JSeparator jFileSeparator3;
    private javax.swing.JMenuItem jHelpAbout;
    private javax.swing.JMenuItem jHelpContent;
    private javax.swing.JMenu jHelpMenu;
    private javax.swing.JMenuItem jHelpRegister;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JLabel jLabel2;
    private javax.swing.JLabel jLabelDown;
    private javax.swing.JLabel jLabelDownFast;
    private javax.swing.JLabel jLabelUp;
    private javax.swing.JLabel jLabelUpFast;
    private javax.swing.JMenuItem jMIExportData;
    private javax.swing.JMenuBar jMainBar;
    private javax.swing.JPanel jPanel3;
    private javax.swing.JPanel jPanelBaseLineButtons;
    private javax.swing.JPanel jPanelIcons;
    private javax.swing.JPanel jPanelMain;
    private javax.swing.JPanel jPanelPreviousNext;
    private javax.swing.JPopupMenu jPopupMenuBase;
    private javax.swing.JSeparator jSeparator1;
    private javax.swing.JMenuItem jSettingBasic;
    private javax.swing.JMenuItem jSettingCalculation;
    private javax.swing.JMenuItem jSettingChangeText;
    private javax.swing.JMenu jSettingMenu;
    private javax.swing.JMenuItem jToolAddComment;
    private javax.swing.JMenuItem jToolCompareData;
    private javax.swing.JMenuItem jToolDefineLeakage;
    private javax.swing.JMenu jToolMenu;
    private javax.swing.JMenuItem jToolSelectChannel;
    private javax.swing.JMenuItem jToolShowStatistics;
    private javax.swing.JMenuItem jToolSortedVolumeFlow;
    private javax.swing.JMenuItem jToolStackCompressorFlowValeu;
    private javax.swing.JMenuItem jToolWriteCommentPage;
    private javax.swing.JMenuItem jViewDisplayRecordAtCursor;
    private javax.swing.JMenu jViewMenu;
    private javax.swing.JMenuItem jViewReload;
    private javax.swing.JMenuItem jViewSelectPeriod;
    private javax.swing.JMenuItem jViewSelectReportType;
    private javax.swing.JMenuItem jViewZoomIn;
    private javax.swing.JMenuItem jViewZoomOut;
    // End of variables declaration//GEN-END:variables

    private int START_X, START_Y, WIDTH, HEIGHT;
    //private boolean isMaximized = false;
   
    private GraphicPanel graphicPanel;
    //private ViewConfigDialog viewConfigDlg;
    private SelectDatabaseDialog selectDatabaseDlg;
    private PHeaderDialog pheaderDlg;
    private StatisticsDialog statisticsDialog; // added by Lewis on 2007.4.13
    private StatisticsReportDialog statisticsReportDialog ; //add by be , 2008/10/18 .
    private CompressorSettingDialog compressorSettingDlg;
    
    private GraphicPanel[] dailyGraphs;
    private Container[] dailyStats;
    
    private boolean showBaseLine = false;
    
    private ReportFile myReportFile;
    //final JFileChooser fc = new JFileChooser();    
    
    private CommonValue theCommonValue;

    //add by be , 2008/10/18 .
    public StatisticsReportDialog getStatisticsReportDialog() {
        return statisticsReportDialog;
    }

    private boolean dailyGraphsIsNull = true;

    /**
     * @return the dailyGraphsIsNull
     */
    public boolean isDailyGraphsIsNull() {
        return dailyGraphsIsNull;
    }

    /**
     * @param dailyGraphsIsNull the dailyGraphsIsNull to set
     */
    public void setDailyGraphsIsNull(boolean dailyGraphsIsNull) {
        this.dailyGraphsIsNull = dailyGraphsIsNull;
    }

}
