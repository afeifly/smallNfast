/*
 * PHeaderDialog.java
 *
 * Created on 2005年10月13日, 下午5:38
 */

package com.cs.canalyzer.gui.dialog;

import com.cs.canalyzer.file.export.ExportDataFileTypeDialog;
import com.cs.canalyzer.file.export.ExportDataOptionDialog;
import com.cs.canalyzer.file.export.ExportingDataDialog;
import com.cs.canalyzer.gui.GUIConst;
import com.cs.canalyzer.gui.PropertyUtil;
import com.cs.canalyzer.structs.CommonValue;
import com.cs.canalyzer.structs.Texts;
import com.cs.database.*;
import java.awt.Dialog;
import java.awt.Dimension;
import java.awt.EventQueue;
import java.awt.Toolkit;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.*;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Hashtable;
import java.util.TimerTask;
import java.util.logging.Level;
import javax.swing.*;
import javax.swing.ImageIcon;
import javax.swing.JOptionPane;
import javax.swing.JTable;
import javax.swing.ListSelectionModel;
import javax.swing.filechooser.FileNameExtensionFilter;
import javax.swing.table.DefaultTableModel;

/**
 *
 * @author  msu
 */
public class PHeaderDialog extends javax.swing.JFrame  implements PropertyChangeListener {
    
    /** Creates new form PHeaderDialog */
    /*public PHeaderDialog(final FrontViews view, ArrayList<ProtocolHeader> pheaderList, ProtocolHeader selectedPHeader) {
        this.theView = view;
        this.pheaderList = pheaderList;
        this.selectedPHeader = selectedPHeader;
        this.myDB = view.getDB();
        
        myInit();
    }*/
    
    public PHeaderDialog( CommonValue common ) {
        this.theCommonValue = common;
        this.myDB = common.getDataBase();
        this.myPHeaders = common.getProtocolHeaders();
        
//        QueryRecord query = new QueryRecord();
//        pheaderList = myDB.queryProtocolHeader(query);
        
        
        myInit();
    }
    
    
     private void checkPowerLostAndFillNA(NProtocolHeader pheaderArg){
        final NProtocolHeader pheader = pheaderArg;
        PHeaderCSMDF.setMyDirectory(myDB.getDatabaseDirectory());
       
        PHeaderCSMDF mm = new PHeaderCSMDF(pheader.Pref, null);
        
         long realNumOfSamples = (pheader.StopTime - pheader.StartTime) / (1000 * pheader.SampleRate);

         if (realNumOfSamples != pheader.NumOfSamples) {
             if (((int) realNumOfSamples + 1) == pheader.NumOfSamples || ((int) realNumOfSamples - 1) == pheader.NumOfSamples) {
                 //added by be on 20110523. Because record id start from 0 , but in old CSD file NumOfSamples one less .
             } else {

                 NProtocolHeader pheaderNew = new NProtocolHeader();
                 pheaderNew.copy(pheader);
                 pheaderNew.NumOfSamples = (int) realNumOfSamples;
                 myDB.updateProtocolHeader(pheaderNew, myDB.findRecordFile(pheaderNew.Pref));
             }
         }
         if (mm.isNONAFile(realNumOfSamples)) {

             mm.fillLostPowerNA(realNumOfSamples);
         }
         mm.endLoading();
    }
    
    private void myInit() {
        initComponents();        

        Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();
        int width = dim.width * 2 / 3;
        if ( width < MIN_WIDTH ) 
            width = MIN_WIDTH;
        int height = dim.height * 2 / 3;
        if ( height < MIN_HEIGHT ) 
            height = MIN_HEIGHT;
        setBounds( dim.width / 6, dim.height / 6, width, height );

        setIconImage( new ImageIcon(getClass().getResource( GUIConst.IMAGE_PATH + GUIConst.LOGO_FILE_NAME)).getImage() );

        //mainModel = new DefaultTableModel();
        jTableMain.setModel(new javax.swing.table.DefaultTableModel(
            new Object [][] {

            },
            new String [] {
                java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Start_Time"), 
                java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("End_Time"),
                java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("File_Name"),
                java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Description")
                
            }
        ) {
            Class[] types = new Class [] {
                java.lang.String.class, java.lang.String.class, java.lang.String.class, java.lang.String.class
            };
            boolean[] canEdit = new boolean [] {
                false, false, false, false
            };

            public Class getColumnClass(int columnIndex) {
                return types [columnIndex];
            }

            public boolean isCellEditable(int rowIndex, int columnIndex) {
                return canEdit [columnIndex];
            }
        });        
        jTableMain.setSelectionMode( ListSelectionModel.MULTIPLE_INTERVAL_SELECTION );
        jTableMain.setAutoResizeMode( JTable.AUTO_RESIZE_OFF );
        mainModel = (DefaultTableModel) jTableMain.getModel();

        //getPHeaderList();
        if (pheaderList == null) pheaderList = new ArrayList<NProtocolHeader>();
        //fillTable();
        
        //dealWithEndTimes();

        //for ( Enumeration e = myPHeaders.elements(); e.hasMoreElements(); ) {
        //for ( NProtocolHeader pheader : myPHeaders ) {
          //  jTableMain.changeSelection(pheaderList.indexOf( pheader ), 0, true, false);
        //}
        
        //jButtonCompare.setVisible( false );
        jButton1.setVisible(false);
        jButtonInformation.setVisible( false );
        jButtonExport.setVisible( true );
    }
    
    public void setVisible( boolean visible ) {
        if ( visible ) {
            renewList();
        }        
        super.setVisible( visible );
    }
    
    public void renewList() {
        if ( !getPHeaderList() ) {
            for (; mainModel.getRowCount() > 0; ) 
                mainModel.removeRow( 0 );
            return;
        }
        //if (pheaderList == null) pheaderList = new ArrayList<NProtocolHeader>();
        fillTable();

        for ( NProtocolHeader pheader : myPHeaders ) {
            jTableMain.changeSelection(pheaderList.indexOf( pheader ), 0, true, false);
        }
    }
    
    /**
     * @return true when successful, otherwise false;
     */
    private boolean getPHeaderList() {
        recordFileNames = new Hashtable<Long, String>();
        pheaderList = new ArrayList<NProtocolHeader>();
        ArrayList<String> fileNames = myDB.getRecordFileList();
        
        for (String fileName : fileNames) {
            if ( toIgnoreFileNames.contains( fileName ) )
                continue;
            
            NProtocolHeader pheader = myDB.readProtocolHeader(fileName);
            if ( pheader == null ) {
                UpgradeRecordFileTask t = new UpgradeRecordFileTask();
                t.setDialog( this );
                t.setFileName( fileName );
                t.setWaitingDialog ( waitingDlg );
                waitingDlg.showUp( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Processing,_please_wait_..."),  t );
                toIgnoreFileNames.add( fileName );
                return false;
            } else {
//                long caculStopTime = pheader.StartTime + (long)((long)pheader.SampleRate*(long)pheader.SampleRateFactor*(long)pheader.NumOfSamples);
               long caculStopTime = myDB.calculateEndTime(pheader.Pref);
                if(pheader.StopTime < caculStopTime){
                    pheader.StopTime = caculStopTime;
                }
                pheaderList.add(pheader);
                recordFileNames.put(pheader.Pref, fileName);
            }
        }
        
            sortPHeaders();
        //pheaderList = myDB.getProtocolHeaderList();
        return true;
    }
    
    private class UpgradeRecordFileTask extends TimerTask {
        public void UpgradeRecordFileTask( ){};
        public void setDialog ( final PHeaderDialog dlg ) { myDlg = dlg; }
        public void setFileName ( String recordFileName ) { myFileName = recordFileName; }
        public void setWaitingDialog ( NewWaitingDialog waitingDlg ) { myWaitingDlg = waitingDlg; }
        
        public void run() {
            myDB.checkVersion( myFileName );
            myWaitingDlg.unShow();
            myDlg.renewList();
        }
        
        private PHeaderDialog myDlg;
        private String myFileName;
        private NewWaitingDialog myWaitingDlg;
    }
    
    
    private void sortPHeaders() {
        if ( pheaderList == null || pheaderList.size() <= 1 ) return;
        
        ArrayList<NProtocolHeader> oldList = pheaderList;
        pheaderList = new ArrayList<NProtocolHeader>();
        for( NProtocolHeader pheader : oldList ) {
            int size = pheaderList.size();
            if ( size == 0 ) 
                pheaderList.add( pheader );
            else {
                boolean inserted = false;
                for ( int j = 0; j < size; j++ ) {
                    if ( pheader.StopTime > pheaderList.get(j).StopTime )  {
                        pheaderList.add( j, pheader );
                        inserted = true;
                        break;
                    }
                }
                if ( !inserted )
                    pheaderList.add( size, pheader );
            }
        }
    }
    
    /** this listener cares about the database change
     */
    @Override
    public void propertyChange( PropertyChangeEvent event ) {
//System.out.println("Event: " + event.getSource() + "      " + event.getPropertyName() + "         " + event.getNewValue() ); 
        if ( isVisible() ) return;
        
        if ( event.getPropertyName().compareTo( CommonValue.DATABASE ) == 0
                ||  event.getPropertyName().compareTo( CommonValue.RENEW_HEADER ) == 0 ) {
//            QueryRecord query = new QueryRecord();
//            pheaderList = myDB.queryProtocolHeader(query);

//            getPHeaderList();
//        
//            for (; mainModel.getRowCount() > 0; ) 
//                mainModel.removeRow( 0 );
//            fillTable();
//        }
            renewList();
        }
    }
    
    /* sometimes protocol header can have empty endtime due to abnormal recording. we have to 
     * calculate it based on known data. but for the online recording protocol header, we just 
     * don't show it
     */ 
    /*private void dealWithEndTimes() {
        ProtocolHeader pheader;
        int onlinePHeaderIx = -1;
        
        for (int i = 0; i < pheaderList.size(); i++) {
            pheader = pheaderList.get(i);
            
            if ( pheader.etime == null ) {
                if ( pheader.pref == onlineRecordingPref ) {
                    onlinePHeaderIx = i;
                } else {
                    
                }
            } // if etime is null
        }
    }*/
    
    private void fillTable() {
        String[] rowData = new String[4];
        NProtocolHeader pheader;
        for (; mainModel.getRowCount() > 0; ) 
            mainModel.removeRow( 0 );
        //int selectedIndex = 0;
        
        for (int i = 0; i < pheaderList.size(); i++) {
            pheader = pheaderList.get(i);
            
            if ( pheader.StopTime != NProtocolHeader.DEFAULT_START_AND_END_TIME ) {
                rowData[1] = CSMDF.DEFAULT_DATE_AND_TIME_FORMAT( pheader.StopTime );
            } else {
                //Timestamp etime = myDB.calculateEndTime( pheader.Pref );
                long etime = myDB.calculateEndTime( pheader.Pref);
                if ( etime < 0 ) 
                    rowData[1] = "";
                else 
                    rowData[1] = CSMDF.DEFAULT_DATE_AND_TIME_FORMAT( etime );
            } // etime is null
            
            rowData[0] = CSMDF.DEFAULT_DATE_AND_TIME_FORMAT( pheader.StartTime );      
            rowData[2] =  recordFileNames.get(pheader.Pref);
            rowData[3] = pheader.getDescription();
            mainModel.addRow(rowData);
        } // end of loop
    }
    
    
    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jPanel1 = new javax.swing.JPanel();
        jButton1 = new javax.swing.JButton();
        jButtonInformation = new javax.swing.JButton();
        jButtonCombine = new javax.swing.JButton();
        jButtonSelect = new javax.swing.JButton();
        jButtonExport = new javax.swing.JButton();
        jButtonDelect = new javax.swing.JButton();
        jButtonCancel = new javax.swing.JButton();
        jScrollPaneMain = new javax.swing.JScrollPane();
        jTableMain = new javax.swing.JTable();
        jPanel2 = new javax.swing.JPanel();
        jLabel1 = new javax.swing.JLabel();

        setDefaultCloseOperation(javax.swing.WindowConstants.DISPOSE_ON_CLOSE);
        java.util.ResourceBundle bundle = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts"); // NOI18N
        setTitle(bundle.getString("Select_Record_File")); // NOI18N
        addComponentListener(new java.awt.event.ComponentAdapter() {
            public void componentResized(java.awt.event.ComponentEvent evt) {
                formComponentResized(evt);
            }
        });

        jPanel1.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel1.setPreferredSize(new java.awt.Dimension(10, 50));
        jPanel1.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.RIGHT, 20, 10));

        jButton1.setText("jButton1");
        jButton1.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButton1ActionPerformed(evt);
            }
        });
        jPanel1.add(jButton1);

        jButtonInformation.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jButtonInformation.setText(bundle.getString("File_Information")); // NOI18N
        jButtonInformation.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonInformationActionPerformed(evt);
            }
        });
        jPanel1.add(jButtonInformation);

        jButtonCombine.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jButtonCombine.setText(bundle.getString("Combine")); // NOI18N
        jButtonCombine.setToolTipText(bundle.getString("Select_multiple_record_files_to_compare_at_the_same_graph.")); // NOI18N
        jButtonCombine.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonCombineActionPerformed(evt);
            }
        });
        jPanel1.add(jButtonCombine);

        jButtonSelect.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jButtonSelect.setText(bundle.getString("Select")); // NOI18N
        jButtonSelect.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonSelectActionPerformed(evt);
            }
        });
        jPanel1.add(jButtonSelect);

        jButtonExport.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jButtonExport.setText(bundle.getString("Export")); // NOI18N
        jButtonExport.setToolTipText(bundle.getString(
            PropertyUtil.isIRLogoType()?"Export_record_file(s)_to_IR_Data_File.":"Export_record_file(s)_to_CS_Data_File."));
    jButtonExport.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jButtonExportActionPerformed(evt);
        }
    });
    jPanel1.add(jButtonExport);

    jButtonDelect.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
    jButtonDelect.setText(bundle.getString("Delete")); // NOI18N
    jButtonDelect.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jButtonDelectActionPerformed(evt);
        }
    });
    jPanel1.add(jButtonDelect);

    jButtonCancel.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
    jButtonCancel.setText(bundle.getString("Cancel")); // NOI18N
    jButtonCancel.addActionListener(new java.awt.event.ActionListener() {
        public void actionPerformed(java.awt.event.ActionEvent evt) {
            jButtonCancelActionPerformed(evt);
        }
    });
    jPanel1.add(jButtonCancel);

    getContentPane().add(jPanel1, java.awt.BorderLayout.SOUTH);

    jScrollPaneMain.setBackground(GUIConst.BACKGROUND_COLOR);
    jScrollPaneMain.setFont(new java.awt.Font("SansSerif", 1, 10)); // NOI18N

    jTableMain.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
    jTableMain.setModel(new javax.swing.table.DefaultTableModel(
        new Object [][] {

        },
        new String [] {
            "Start Time", "End Time", "File Name", "Description"
        }
    ) {
        Class[] types = new Class [] {
            java.lang.String.class, java.lang.String.class, java.lang.String.class, java.lang.String.class
        };
        boolean[] canEdit = new boolean [] {
            false, false, false, false
        };

        public Class getColumnClass(int columnIndex) {
            return types [columnIndex];
        }

        public boolean isCellEditable(int rowIndex, int columnIndex) {
            return canEdit [columnIndex];
        }
    });
    jTableMain.addMouseListener(new java.awt.event.MouseAdapter() {
        public void mouseExited(java.awt.event.MouseEvent evt) {
            jTableMainMouseExited(evt);
        }
        public void mouseReleased(java.awt.event.MouseEvent evt) {
            jTableMainMouseReleased(evt);
        }
    });
    jTableMain.addMouseMotionListener(new java.awt.event.MouseMotionAdapter() {
        public void mouseMoved(java.awt.event.MouseEvent evt) {
            jTableMainMouseMoved(evt);
        }
    });
    jScrollPaneMain.setViewportView(jTableMain);

    getContentPane().add(jScrollPaneMain, java.awt.BorderLayout.CENTER);

    jPanel2.setBackground(GUIConst.BACKGROUND_COLOR);
    jPanel2.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
    jPanel2.setPreferredSize(new java.awt.Dimension(10, 45));
    jPanel2.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.CENTER, 5, 15));

    jLabel1.setBackground(new java.awt.Color(255, 0, 102));
    jLabel1.setFont(new java.awt.Font("Dialog", 1, 14)); // NOI18N
    jLabel1.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
    jLabel1.setText(bundle.getString("Record_File_List")); // NOI18N
    jPanel2.add(jLabel1);

    getContentPane().add(jPanel2, java.awt.BorderLayout.NORTH);

    pack();
    }// </editor-fold>//GEN-END:initComponents

    private void jButtonExportActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonExportActionPerformed

         exportToExcel();
//        int[] indexes = jTableMain.getSelectedRows();
//        if ( indexes.length > 0 ) {
//            FileNameExtensionFilter filter = new FileNameExtensionFilter( DBController.EXPORT_FILE_SUFFIX, 
//                        DBController.EXPORT_FILE_SUFFIX_FILTER, DBController.EXPORT_FILE_SUFFIX_CAPTICAL_FILTER );
//            GUIConst.FILE_CHOOSER.setFileFilter( filter );
//            if ( GUIConst.FILE_CHOOSER.showDialog(this, "Export") == JFileChooser.APPROVE_OPTION ) {
//
//                final int[] prefs = new int[indexes.length];
//                for ( int i = 0; i < indexes.length; i++ ) {
//                    prefs[i] = pheaderList.get( indexes[i] ).pref;
//                }
//                
//                final NewWaitingDialog dlg = new NewWaitingDialog();
//                dlg.showUp( "Exporting", new TimerTask() {
//                    public void run() {
//                        //exportToSingleFileAction( prefs, fc.getSelectedFile().getAbsolutePath() );
//                        if ( myDB.exportPHeaderToSingleFile( prefs, GUIConst.FILE_CHOOSER.getSelectedFile().getAbsolutePath() ) 
//                                            == DBController.EXPORT_SUCCESS ) {
//                            dlg.unShow();
//                            JOptionPane.showMessageDialog( null, "Data exported." );
//                        } else {
//                            dlg.unShow();
//                            JOptionPane.showMessageDialog( null, "Sorry._Exportation_failed." );
//                        }
//                    }
//                });            
//            }
//        }
    }//GEN-LAST:event_jButtonExportActionPerformed

    private void jButtonDelectActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonDelectActionPerformed
        final int[] indexes = jTableMain.getSelectedRows();
        int size = indexes.length;
        if (size < 1) return;
        
        Arrays.sort( indexes );
        NProtocolHeader pheader;
        String message = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("<html>Are_you_sure_to_delect_below_Protocol_Header(s)_and_all_related_records?<br><br>");
        for (int i = 0; i < size; i++) {
            pheader = pheaderList.get(indexes[i]);
            message += pheader.getDescription() +  "<br>";
            if (i > 8) {
                message +=  "... ...<br>";
                break;
            }
        }
        message +=  "<br></html>";
        
        int selection = JOptionPane.showConfirmDialog(this, message,  java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_Confirm"), JOptionPane.YES_NO_OPTION);
        if (selection == JOptionPane.YES_OPTION) {
            // deleting may take a while
            final NewWaitingDialog dlg = new NewWaitingDialog();
            dlg.showUp( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Deleting_selected_protocol_header"), new TimerTask() {
                public void run() {
                    deletePHeaderAction( indexes.clone() );
                    dlg.unShow();
                }
            });
        }
    }//GEN-LAST:event_jButtonDelectActionPerformed

    private void deletePHeaderAction( int[] indexes ) {
        try {
            NProtocolHeader pheader;
            int size = indexes.length;
            for (int i = size - 1; i >= 0; i--) {
                pheader = pheaderList.get(indexes[i]);
                //if ( myDB.removeProtocolHeader( pheader )) {
                if ( myDB.deleteRecordFile( recordFileNames.get( pheader.Pref )) == DBMessage.CSDB_OK ) {
                        //mainModel.removeRow(indexes[i] - i);
                    mainModel.removeRow( indexes[i] );
                    pheaderList.remove( indexes[i] );
                    recordFileNames.remove( pheader.Pref );
                }
            } // end of loop
        } catch ( Exception e ) {
            
        }
    }
    
    private void jButtonCombineActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonCombineActionPerformed
        int[] indexes = jTableMain.getSelectedRows();
        if ( indexes.length <= 1 ) {
            JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("<html>Please_select_at_least_2_record_files_to_compare.<br><br>") +
                    java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("(_You_can_select_multiple_files_by_holding_[CTRL]_key_and_then_click_on_the_file_names._)<br><br></html>") );
        } else {
            //check if have the same time.fixed richard's combine issue.---- begin
            //add by be on 20101012.
            long tmpSingleStopTime = 0;
            long tmpSingleStartTime = 0;
            long preSingleStopTime = 0;
            long preSingleStartTime = 0;
            for ( int index : indexes ) {
                NProtocolHeader pheader = pheaderList.get(index);
                tmpSingleStartTime = pheader.StartTime;
                tmpSingleStopTime =  myDB.calculateEndTime(pheader.Pref);
                if(preSingleStopTime == 0 || preSingleStartTime == 0 ){
                    if(preSingleStartTime == 0)
                        preSingleStartTime = tmpSingleStartTime;
                    if(preSingleStopTime == 0)
                        preSingleStopTime = tmpSingleStopTime;
                }else{
                    if(preSingleStopTime < tmpSingleStartTime){
                          JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("combine_have_same_time") );
                          return;
                    }
                    if(tmpSingleStopTime < preSingleStartTime){
                          JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("combine_have_same_time") );
                          return;
                    }
                    if( preSingleStartTime < tmpSingleStartTime ) preSingleStartTime = tmpSingleStartTime ;
                    if( preSingleStopTime > tmpSingleStopTime ) preSingleStopTime = tmpSingleStopTime ;
                }

            }
            //------------ end.

            myPHeaders.clear();
             for ( int index : indexes ) {
                NProtocolHeader pheader = pheaderList.get(index);
                myPHeaders.add( pheader );    
            }
            EventQueue.invokeLater( new Runnable() {
                public void run() { 
                    for(NProtocolHeader ph : myPHeaders){
                        checkFileIsCycleAndRewriteAndBackup(ph);
                        checkPowerLostAndFillNA(ph);
                    }
                    theCommonValue.setProtocolHeaders( myPHeaders ); 
                }
            });
            dispose();
        }

    }//GEN-LAST:event_jButtonCombineActionPerformed

    private void exportTest() {
     /*   try {
            int[] indexes = jTableMain.getSelectedRows();
            if ( indexes.length > 0 ) {
                FileNameExtensionFilter filter = new FileNameExtensionFilter( DBController.EXPORT_FILE_SUFFIX, 
                            DBController.EXPORT_FILE_SUFFIX_FILTER, DBController.EXPORT_FILE_SUFFIX_CAPTICAL_FILTER );
                GUIConst.FILE_CHOOSER.setFileFilter( filter );
                if ( GUIConst.FILE_CHOOSER.showDialog(this,"Export") 
                                == JFileChooser.APPROVE_OPTION ) {
                    final int[] prefs = new int[indexes.length];
                    for ( int i = 0; i < indexes.length; i++ ) {
                        prefs[i] = pheaderList.get( indexes[i] ).Pref;
                    }

                int size = prefs.length;
                if ( size < 1 ) return;
                String fileName = GUIConst.FILE_CHOOSER.getSelectedFile().getAbsolutePath();

                if ( !fileName.endsWith( EXPORT_FILE_SUFFIX_CAPTICAL ) && !fileName.endsWith( EXPORT_FILE_SUFFIX ) )
                    fileName += EXPORT_FILE_SUFFIX;

                ProtocolHeader pheader;
                ArrayList<ChannelHeader> chheaders;
                ArrayList<MeasurementRecord> mrecords;
                ObjectOutputStream out = new ObjectOutputStream( new FileOutputStream( fileName ));

                // write sequence: [number of pheaders][pheader1][number of chheaders][chheader1 of pheader1]....[number of measurement records]
                // [measurement records1][measurement records2]...
                out.writeInt( size );
                for ( int i = 0; i < size; i++ ) {
                    pheader = myDB.queryProtocolHeader( prefs[i] );
                    pheader.description = JOptionPane.showInputDialog( "protocol header name ");
                    //pheader.stime = new Timestamp( pheader.stime.getTime() - 2 * ViewOptions.ONE_DAY_MILLS - 78 * ViewOptions.ONE_MINUTE_MILLS );
                    //pheader.etime = new Timestamp( pheader.etime.getTime() - 2 * ViewOptions.ONE_DAY_MILLS - 78 * ViewOptions.ONE_MINUTE_MILLS );
                    
                    out.writeObject( pheader );

                    chheaders = myDB.queryChannelHeader( prefs[i] );
                    out.writeInt( chheaders.size() );
                    for ( ChannelHeader chheader : chheaders ) {
                        /*int type;
                        if ( chheader.unit.compareTo( CONSUMPTION_UNIT ) == 0 ) {
                            type = 1;
                             chheader.max = 81;
                             chheader.min = 0;
                        } else if ( chheader.unit.compareTo( "m/s" ) == 0 ) {
                            type = 2;
                            chheader.max = (float)32.5;
                            chheader.min = (float)1.7;
                        } else {
                            type =3;
                            chheader.max = (float) 65.5;
                            chheader.min = (float) 0;
                        }

                        out.writeObject( chheader );

                        mrecords = myDB.queryMeasurementRecord( chheader.cref );
                        size =  mrecords.size();
                        out.writeInt( size );
                        
                        double delta;
                        for ( MeasurementRecord mrecord : mrecords ) {
                                delta = 1 * ( 0.5 - Math.random() );
                                if ( type == 1 ) {
                                    mrecord.value = mrecord.value * ( 1 + (float) delta / size  );
                                    mrecord.value -= 5;
                                } else {
                                    //do { 
                                        mrecord.value = mrecord.value * ( 1 + (float) delta );
                                    //} while ( mrecord.value > chheader.max || mrecord.value < chheader.min );
                                }
                            if ( mrecord.value > chheader.max  ) mrecord.value = chheader.max - 20 * (float) Math.random();
                            if ( mrecord.value < chheader.min  ) mrecord.value = chheader.min + 20 * (float) Math.random();
                            
                            out.writeObject( mrecord );
                        }
                    }
                }

                }
            }        
        } catch ( Exception e ) { 
            System.out.println( "fail" );
        }
        JOptionPane.showMessageDialog( this, "done " );        
    */    
    }
    
    private void jButton1ActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButton1ActionPerformed
        try { 
        //changeCurrentValues();
        
        //waitingDlg.unShow();
        //exportTest();
        updateRecordFile();
        
        //createTestRecordFiles();
        
        //changePHeaderInfo();
        //createBigRecords();
        
        } catch ( Exception e ) {
            JOptionPane.showMessageDialog( this, "wrong! " + e.getMessage() );
        }
        JOptionPane.showMessageDialog( this, "done!" );
        
        //ArrayList<MeasurementRecord> mrecords = myDB.queryMeasurementRecord(9999);
        // if you have recorded flow at a diameter of 12.7, but need to have the flow at diameter 31.75, then you must muliply the recorded flow with 7.68 
        // the -9999 which appers sometimes should be replaced by the value in the line before
        /*int index = jTableMain.getSelectedRow();
        if (index < 0) return;
        
        float previousValue = 0;
        boolean shouldChange = false;
        char CUBIC_ASCII = 179;
        String flowUnit = "m" + CUBIC_ASCII + "/h";
        try {
            ArrayList<ChannelHeader> chheaders;
            ProtocolHeader pheader = pheaderList.get(index);
            chheaders = myDB.queryChannelHeader(pheader.pref);
            ArrayList<MeasurementRecord> records;
            for ( ChannelHeader chheader : chheaders ) {
                if ( chheader.unit.compareTo( flowUnit ) == 0 ) 
                    shouldChange = true;
                else
                    shouldChange = false;
                
                if ( shouldChange ) {
                    chheader.max = (float) ( chheader.max * 7.68 );
                    chheader.min = (float) ( chheader.min * 7.68 );
                    myDB.updateChannelHeader( chheader );
                }
                records = myDB.queryMeasurementRecord( chheader.cref );
                for ( MeasurementRecord record : records ) {
                    if ( record.value == myDB.INVALID_MEASUREMENT_VALUE ) {
                        record.value = previousValue;
                        myDB.updateMeasurementRecord( record );
                    } else if ( shouldChange ) {
                        record.value = (float) ( record.value * 7.68 );
                        myDB.updateMeasurementRecord( record );
                    }
                    previousValue = record.value;
                }
                
            }
            
            
        } catch ( Exception e ) {
            System.out.println("update measurement records failed: " + e.getMessage() );
        }

        // create a pheader
        /*try {
            ProtocolHeader pheader = new ProtocolHeader();
            pheader.description = "Sample Consumption";
            pheader.stime = Timestamp.valueOf( "2007-02-08 09:05:00.0000000 ");
            pheader.srate = 45;
            pheader.etime = new Timestamp( pheader.stime.getTime() + Test.flow.length * pheader.srate * 1000 );
            myDB.addProtocolHeader( pheader );
        
            ChannelHeader[] chheaders = new ChannelHeader[4];
            String[] units = { LeakStatistics.UNIT_FLOW, LeakStatistics.UNIT_CURRENT, LeakStatistics.UNIT_PRESSURE, LeakStatistics.UNIT_DEW_POINT };
            String[] names = { "Flow Rate", "Current", "Pressure", " Dew Point" };
            short[] resolutions = { 0, 2, 2, 2 };
            for ( int i = 0; i < chheaders.length; i++ ) {
                chheaders[i] = new ChannelHeader();
                chheaders[i].dname = "DS300";
                chheaders[i].name = names[i];
                chheaders[i].pref = pheader.pref;
                chheaders[i].chcount = (short) chheaders.length;
                chheaders[i].unit = units[i];
                chheaders[i].resolution = resolutions[i];
                chheaders[i].uuid = "testsample";
                chheaders[i].number = (short) ( i + 1 );

                myDB.addChannelHeader( chheaders[i] );
            }
            
            addMeasurementRecords( chheaders[0], Test.flow );
            addMeasurementRecords( chheaders[1], Test.A );
            addMeasurementRecords( chheaders[2], Test.bar );
            addMeasurementRecords( chheaders[3], Test.dewpoint );
            
        } catch ( Exception e ) {}

        // first sample rate
        /*int index = jTableMain.getSelectedRow();
        if (index < 0) return;
        
        ArrayList<ChannelHeader> chheaders;
        ProtocolHeader pheader = pheaderList.get(index);
        chheaders = myDB.queryChannelHeader(pheader.pref);

        pheader.srate = 14;
        pheader.description = "CS Druckluft-Analisator";
        myDB.updateProtocolHeader(pheader);
        chheaders = myDB.queryChannelHeader(pheader.pref);
        ArrayList<MeasurementRecord> recordA = new ArrayList<MeasurementRecord>();
        ArrayList<MeasurementRecord> recordFlow = new ArrayList<MeasurementRecord>();
        ChannelHeader chA = new ChannelHeader(); 
        ChannelHeader chFlow = new ChannelHeader();
        for ( ChannelHeader chheader : chheaders ) {
            if ( chheader.unit.startsWith( "A" )) 
                //recordA = myDB.queryMeasurementRecord( chheader.cref );
                chA = chheader;
            if ( chheader.unit.endsWith( "/h" )) 
                //recordFlow = myDB.queryMeasurementRecord( chheader.cref );
                chFlow = chheader;
        }
        
        chFlow.max = chFlow.max - 150;
        chFlow.min -= 150;
        if ( chFlow.min < 0 ) chFlow.min = 0;
        chA.max = chFlow.max / 10;
        chA.min = chFlow.min / 10;
        
        myDB.updateChannelHeader( chFlow );
        myDB.updateChannelHeader( chA );
        
        /*MeasurementRecord a, flow;
        int size = recordA.size();
        if ( size == 0 ) return;
        for ( int i = 0; i < size; i++ ) {
            a = recordA.get(i);
            flow = recordFlow.get(i);
            
            flow.value -= 150; 
            if ( flow.value < 0 ) flow.value = 0;
            a.value = flow.value / 10;
            myDB.updateMeasurementRecord( flow );
            myDB.updateMeasurementRecord( a );
        }
        
        pheader.etime.setTime( pheader.stime.getTime() + pheader.srate * 1000 * recordA.get( size - 1 ).id );
        myDB.updateProtocolHeader( pheader );*/
        
    }//GEN-LAST:event_jButton1ActionPerformed

//    private void changeCurrentValues() {
//        int index = jTableMain.getSelectedRow();
//        ArrayList<NChannelHeader> chheaders;
//        NProtocolHeader pheader = pheaderList.get(index);
//        chheaders = myDB.findChannelHeaders( pheader.Pref );
//        ArrayList<NMeasurementRecordLine> mLines = myDB.readAllMeasurementRecordLines(pheader);
//              
//        int chNo = 0;
//        for ( int i = 0; i < chheaders.size(); i++ ) {
//            if ( chheaders.get(i).getUnitText().compareTo("A") == 0 )
//                chNo = i;
//        }
//        
//        for ( NMeasurementRecordLine mLine : mLines ) {
//            if ( mLine.Values[chNo] < 125 )
//                mLine.Values[chNo] = 0;
//        }
//        
//        myDB.createRecordFile( "DS300", pheader, chheaders, true );
//        File file = myDB.findRecordFile( pheader.Pref );
//        myDB.addMeasurementRecordLines(file, mLines);
//        
//    }
    
    private void updateRecordFile() {
        int index = jTableMain.getSelectedRow();
        ArrayList<NChannelHeader> chheaders;
        NProtocolHeader pheader = pheaderList.get(index);
   
        File file = myDB.findRecordFile( pheader.Pref );
        pheader.StopTime = pheader.StartTime + (long) pheader.SampleRate * pheader.SampleRateFactor 
                * pheader.NumOfSamples;
        myDB.updateProtocolHeader(pheader, file);
        
        /*chheaders = myDB.findChannelHeaders( pheader.Pref );
        ArrayList<NMeasurementRecordLine> mLines = myDB.readAllMeasurementRecordLines(pheader);
              
        int[] chNo = new int[2];
        index = 0;
        for ( int i = 0; i < chheaders.size(); i++ ) {
            if ( chheaders.get(i).getUnitText().compareTo("bar") == 0 ) {
                chNo[index] = i;
                index++; 
            }
        }
        
        for ( NMeasurementRecordLine mLine : mLines ) {
            mLine.Values[chNo[0]] = mLine.Values[chNo[0]] * 2.5;
            mLine.Values[chNo[1]] = mLine.Values[chNo[1]] * 2.5;
        }
        
        myDB.createRecordFile( "DS300", pheader, chheaders, true );
        File file = myDB.findRecordFile( pheader.Pref );
        myDB.addMeasurementRecordLines(file, mLines);*/
        
    }
    
    private void createBigRecords() {
        int size = 1000000;
        MeasurementRecord mrecord = new MeasurementRecord();
        mrecord.cref = 9999;
        for ( int i = 0; i < size; i++ ) {
            mrecord.id = 1;
            mrecord.value = (float) Math.random() * 100;
            //myDB.addMeasurementRecord(mrecord);
        }
    }
    
    private void createTestRecordFiles() {
        // create a pheader
        try {
            int numOfRecords = 661;
            double step = 0.2;
            
            NProtocolHeader pheader = new NProtocolHeader();
            pheader.setDescription( "VF Test" );
            pheader.StartTime = Timestamp.valueOf( "2009-01-30 01:00:00.0000000 ").getTime();
            pheader.SampleRate = 20;
            pheader.StopTime = pheader.StartTime + ( numOfRecords - 1 ) * pheader.SampleRate * 1000;
            pheader.Status = NProtocolHeader.STATUS_STOP;
            pheader.NumOfChannels = 1;
            pheader.NumOfDevices = 1;
            pheader.NumOfSamples = 0;
            pheader.DeviceID  = 1;
            
            ArrayList<NChannelHeader> chheaders = new ArrayList<NChannelHeader>();
            NChannelHeader chheader = new NChannelHeader();
            chheader.ChannelNumber = 1;
            chheader.setDescription( "VF Compressor 1" );
            chheader.DeviceID = 1;
            chheader.Max = 86;
            chheader.Min = 20;
            chheader.Resolution = 1;
            chheader.setUnitText( "A" );
            chheaders.add(chheader);
            
            int reply = myDB.createRecordFile( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Test"), pheader, chheaders, true );
            File file = myDB.findRecordFile( pheader.Pref );
            ArrayList<NMeasurementRecordLine> mrecordLines = new ArrayList<NMeasurementRecordLine>();
            NMeasurementRecordLine mrecordLine;
            for ( int i = 0; i < 331; i++ ) {
                mrecordLine = new NMeasurementRecordLine();
                mrecordLine.ID = i;
                mrecordLine.Values = new double[1];
                mrecordLine.Values[0] = chheader.Min + i * step;
                mrecordLines.add(mrecordLine); 
            }
            for ( int i = 331; i < numOfRecords; i++ ) {
                mrecordLine = new NMeasurementRecordLine();
                mrecordLine.ID = i;
                mrecordLine.Values = new double[1];
                mrecordLine.Values[0] = chheader.Max - ( i - 330 ) * step;
                mrecordLines.add(mrecordLine);
            }
            myDB.addMeasurementRecordLines( file, mrecordLines );
            
            
//            pheader = new ProtocolHeader();
//            pheader.description = "Test2";
//            pheader.stime = Timestamp.valueOf( "2008-03-29 14:00:00.0000000 ");
//            pheader.srate = 30;
//            pheader.etime = new Timestamp( pheader.stime.getTime() + numOfRecords * pheader.srate * 1000 );
//            myDB.addProtocolHeader( pheader );
//        
//            chheaders = new ChannelHeader[2];
//            String[] units2 = { LeakStatistics.UNIT_FLOW_MINUTE, LeakStatistics.UNIT_CURRENT };
//            String[] names2 = { "Flow Rate Minute", "Current A" };
//            short[] resolutions2 = { 0, 2 };
//            float[] values2 = { 600, 200 };
//            float[] values22nd = { 100, 200 };
//            float[] max2 = { 600, 200 };
//            float[] min2 = { 100, 200 };
//            for ( int i = 0; i < chheaders.length; i++ ) {
//                chheaders[i] = new ChannelHeader();
//                chheaders[i].dname = "DS300";
//                chheaders[i].name = names2[i];
//                chheaders[i].pref = pheader.pref;
//                chheaders[i].chcount = (short) chheaders.length;
//                chheaders[i].unit = units2[i];
//                chheaders[i].resolution = resolutions2[i];
//                chheaders[i].uuid = "testsample";
//                chheaders[i].number = (short) ( i + 1 );
//                chheaders[i].max = max2[i];
//                chheaders[i].min = min2[i];
//
//                myDB.addChannelHeader( chheaders[i] );
//                MeasurementRecord record = new MeasurementRecord();
//                record.cref = chheaders[i].cref;
//                for ( int j = 0; j < numOfRecords / 2; j++ ) {
//                    record.id = j;
//                    record.value = values2[i];
//                    myDB.addMeasurementRecord( record );
//                    record.id = j + numOfRecords / 2;
//                    record.value = values22nd[i];
//                    myDB.addMeasurementRecord( record );
//                }
//            }            
        } catch ( Exception e ) {
            System.out.println( e.getMessage() );
        }        
    }
    
    private void changePHeaderInfo() {
        
        int index = jTableMain.getSelectedRow();
        NProtocolHeader pheader = pheaderList.get(index);
        File file = myDB.findRecordFile( pheader.Pref );
        
        Calendar stime = Calendar.getInstance();
        Calendar etime = Calendar.getInstance();
        
        stime.set(2009, 7, 2, 9, 10, 20);
        etime.set(2009, 7, 6, 12, 18, 20);
        
        pheader.setDescription( "Measurement records for demo." );
        pheader.StartTime = stime.getTimeInMillis();
        pheader.StopTime = etime.getTimeInMillis();
        pheader.SampleRate = 60;
        
        myDB.updateProtocolHeader(pheader, file);
        
//        ProtocolHeader pheader;
//        int pref;
//        Timestamp stime, etime;
//        
//        pref = 107;
//        pheader = myDB.queryProtocolHeader( pref );
//        stime = Timestamp.valueOf( "2008-04-09 17:09:51" );
//        etime = Timestamp.valueOf( "2008-04-10 15:34:28" );
//        pheader.stime = stime;
//        pheader.etime = etime;
//        myDB.updateProtocolHeader( pheader );
//
//        pref = 108;
//        pheader = myDB.queryProtocolHeader( pref );
//        //10.04.2008 13.14.59 stop 10.04.2008 15.41.36
//        stime = Timestamp.valueOf( "2008-04-10 13:14:59" );
//        etime = Timestamp.valueOf( "2008-04-10 15:41:36" );
//        pheader.stime = stime;
//        pheader.etime = etime;
//        myDB.updateProtocolHeader( pheader );
//
//        pref = 109;
//        pheader = myDB.queryProtocolHeader( pref );
//        //  9.04.2008 17.11.42 stop 10.04.2008 15.36.31
//        stime = Timestamp.valueOf( "2008-04-09 17:11:42" );
//        etime = Timestamp.valueOf( "2008-04-10 15:36:31" );
//        pheader.stime = stime;
//        pheader.etime = etime;
//        myDB.updateProtocolHeader( pheader );
//    
    }
    
    private void addMeasurementRecords( ChannelHeader chheader, double[] values )  {
//        chheader.max = (float) values[0];
//        chheader.min = (float)  values[0];
//        MeasurementRecord record = new MeasurementRecord();
//        float v;
//        
//        record.cref = chheader.cref;
//        for ( int i = 0; i < values.length; i++ ) {
//            v = (float) values[i];
//            if ( chheader.max < v ) chheader.max = v;
//            else if ( chheader.min > v ) chheader.min = v;
//            record.id = i;
//            record.value = v;
//            myDB.addMeasurementRecord( record );
//        }
//        myDB.updateChannelHeader( chheader );
    }
    
    private final float[] fakevalues = {
        200,	100,
200,	100,
200,	100,
200,	20,
200,	100,
200,	100,
200,	20,
200,	100,
200,	100,
200,	100,
200,	100,
200,	20,
200,	100,
200,	100,
200,	100,
200,	100,
200,	20,
200,	100,
200,	100,
200,	100,
200,	20,
200,	20,
200,	100,
200,	100,
200,	100,
50,	100,
50,	100,
50,	20,
50,	100,
50,	100,
50,	100,
50,	20,
50,	100,
50,	100,
50,	100,
50,	100,
50,	100,
50,	100,
50,	100,
50,	20,
50,	100,
50,	100,
50,	100,
50,	100,
50,	100,
50,	100,
50,	20,
50,	20,
50,	100,
50,	100,

   };
    
    private void jButtonInformationActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonInformationActionPerformed
        // TODO add your handling code here:
//        int index = jTableMain.getSelectedRow();
//        if (index < 0) return;
//        
//        ArrayList<ChannelHeader> chheaders;
//        ProtocolHeader pheader = pheaderList.get(index);
//        chheaders = myDB.queryChannelHeader(pheader.pref);
//        
//        // query how many records per channel. since it's identical for every channel, just take channel 0
//        int numOfValuesPerChannel = 0;
//        try {
//            numOfValuesPerChannel = myDB.recordsPerChannelHeader(chheaders.get(0).cref);
//        } catch (Exception e){}
//        
//        // if etime is null, then calculate it
//        if ( pheader.etime == null ) pheader.etime = myDB.calculateEndTime( pheader.pref );
//        
//        PHeaderInformationDialog infoDlg = new PHeaderInformationDialog(this, pheader, chheaders, numOfValuesPerChannel);
//        infoDlg.setVisible(true);
        

    }//GEN-LAST:event_jButtonInformationActionPerformed

    private void jButtonSelectActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonSelectActionPerformed
        int[] indexes = jTableMain.getSelectedRows();
        if ( indexes.length > 0 ) {
            myPHeaders.clear();
            NProtocolHeader pheader = pheaderList.get( indexes[0] );
            myPHeaders.add( pheader );    
            /*  leave the multiple protocol headers selection to 'compare' function
             for ( int index : indexes ) {
                ProtocolHeader pheader = pheaderList.get(index);
                myPHeaders.add( pheader );    
            }*/
            EventQueue.invokeLater( new Runnable() {
                public void run() { 
                    for(NProtocolHeader ph : myPHeaders){
                        checkFileIsCycleAndRewriteAndBackup(ph);
                        checkPowerLostAndFillNA(ph);
                    }
                    theCommonValue.setProtocolHeaders( myPHeaders ); 
                }
            });

            //modify on 20100108.
            //Simon feedback :the record title and axise values did not update when load new report .
            //method : when choose new record , clear commonvalue texts.
            theCommonValue.setTexts(new Texts());

            dispose();  
           // theCommonValue.setAnalyzeButEnable();
        }
        /*if ( indexes.length > 0 ) {
            myPHeaders.clear();
            for ( int index : indexes ) {
                ProtocolHeader pheader = pheaderList.get(index);
                myPHeaders.put( pheader.pref, pheader );
            }
            theCommonValue.setProtocolHeaders( myPHeaders );
            dispose();
        }*/
        
    }//GEN-LAST:event_jButtonSelectActionPerformed

    private void jButtonCancelActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonCancelActionPerformed
        // TODO add your handling code here:
        this.dispose();
    }//GEN-LAST:event_jButtonCancelActionPerformed

    private void formComponentResized(java.awt.event.ComponentEvent evt) {//GEN-FIRST:event_formComponentResized
        try {
            jTableMain.getColumnModel().getColumn(0).setPreferredWidth(TIME_COLUMN_WITH + 60);
            jTableMain.getColumnModel().getColumn(1).setPreferredWidth(TIME_COLUMN_WITH + 60);
            jTableMain.getColumnModel().getColumn(2).setPreferredWidth(this.getWidth() - 5 * TIME_COLUMN_WITH );
            jTableMain.getColumnModel().getColumn(3).setPreferredWidth(2*TIME_COLUMN_WITH);
        } catch ( Exception e ) {}
    }//GEN-LAST:event_formComponentResized

private void jTableMainMouseExited(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_jTableMainMouseExited
//    if ( moveHeaderDlg != null )
//        moveHeaderDlg.dispose();
//    moveIndex = -1;
}//GEN-LAST:event_jTableMainMouseExited

private void jTableMainMouseMoved(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_jTableMainMouseMoved
//    Point mousePoint = evt.getPoint();
//    final java.awt.event.MouseEvent event = evt;
//    final int index = jTableMain.rowAtPoint( mousePoint );
//    final javax.swing.JFrame parentDlg = this;
//    
//    if ( moveHeaderDlg != null && moveHeaderDlg.isShowing() && index != moveIndex )
//        moveHeaderDlg.setVisible( false ); //.dispose(); 
//    
//    EventQueue.invokeLater( new Runnable() {
//        public void run() {
//            try { Thread.sleep( GUIConst.HEADER_INFORMATION_DIALOG_POPUP_DELAY ); } catch ( Exception e ) {}
//            if ( index < 0 || index == moveIndex ) return;
//
//            moveIndex = index; 
//            
//            ArrayList<NChannelHeader> chheaders;
//            NProtocolHeader pheader = pheaderList.get(index);
//            chheaders = myDB.findChannelHeaders( pheader.Pref );
//
//            // if etime is null, then calculate it
//            if ( pheader.StopTime == NProtocolHeader.DEFAULT_START_AND_END_TIME ) 
//                pheader.StopTime = myDB.calculateEndTime( pheader.Pref );
//
//            if ( moveHeaderDlg != null ) moveHeaderDlg.dispose();
//            moveHeaderDlg = new PHeaderInformationDialog(parentDlg, pheader, chheaders );
//            moveHeaderDlg.setModalityType( ModalityType.MODELESS );
//        
//            int x = event.getLocationOnScreen().x;
//            int y = event.getLocationOnScreen().y;
//            Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();
//            if ( x + moveHeaderDlg.getWidth() > dim.width )
//                x = x - moveHeaderDlg.getWidth() - 20;
//            else
//                x = x + 20;
//            if ( y + moveHeaderDlg.getHeight() > dim.height )
//                y = y - moveHeaderDlg.getHeight() - 5;
//            else
//                y = y + 2;
//            
//            moveHeaderDlg.setLocation( x,  y );
//            moveHeaderDlg.setVisible(true);                
//        }
//     });
}//GEN-LAST:event_jTableMainMouseMoved

private void jTableMainMouseReleased(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_jTableMainMouseReleased
    doPopupHeaderInformation( evt );
}//GEN-LAST:event_jTableMainMouseReleased
    
private void doPopupHeaderInformation( java.awt.event.MouseEvent evt ) {
    if ( evt.isPopupTrigger() ) {
        int index = jTableMain.rowAtPoint( evt.getPoint() );
            ArrayList<NChannelHeader> chheaders;
            NProtocolHeader pheader = pheaderList.get(index);
            chheaders = myDB.findChannelHeaders( pheader.Pref );

            // if etime is null, then calculate it
            if ( pheader.StopTime == NProtocolHeader.DEFAULT_START_AND_END_TIME ) 
                pheader.StopTime = myDB.calculateEndTime( pheader.Pref );
            moveHeaderDlg = new PHeaderInformationDialog( this, pheader, chheaders );
            moveHeaderDlg.setVisible( true );
    }    
}

    /**
     * @param args the command line arguments
     */
  /*  public static void main(String args[]) {
        java.awt.EventQueue.invokeLater(new Runnable() {
            public void run() {
                new PHeaderDialog().setVisible(true);
            }
        });
    }*/
    
    private final static int TIME_COLUMN_WITH = 120;
    private final int MIN_WIDTH = 800;
    private final int MIN_HEIGHT = 600;
    
    private final static String SPACE =  "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
    
    // for testing purpose
    public final static String EXPORT_FILE_SUFFIX = ".csd";
    public final static String EXPORT_FILE_SUFFIX_CAPTICAL = ".CSD";
    public final static String EXPORT_FILE_SUFFIX_FILTER = "csd";
    public final static String EXPORT_FILE_SUFFIX_CAPTICAL_FILTER = ".CSD";
    public static final String CONSUMPTION_UNIT = "m\u00b3";
    
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton jButton1;
    private javax.swing.JButton jButtonCancel;
    private javax.swing.JButton jButtonCombine;
    private javax.swing.JButton jButtonDelect;
    private javax.swing.JButton jButtonExport;
    private javax.swing.JButton jButtonInformation;
    private javax.swing.JButton jButtonSelect;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JPanel jPanel2;
    private javax.swing.JScrollPane jScrollPaneMain;
    private javax.swing.JTable jTableMain;
    // End of variables declaration//GEN-END:variables
    
    private boolean isLicensed = false;  // for exportation function

    //final JFileChooser fc = new JFileChooser();    
    final NewWaitingDialog waitingDlg = new NewWaitingDialog();

    private CSMDF myDB;
    private CommonValue theCommonValue;
    
    private Hashtable<Long, String> recordFileNames;  // key is Pref. Keep corresponding file name
    private ArrayList<NProtocolHeader> pheaderList;
    private ArrayList<NProtocolHeader> myPHeaders;
    private ArrayList<String> toIgnoreFileNames = new ArrayList<String>();  // some files already processed
    
    private DefaultTableModel mainModel;
    
    private PHeaderInformationDialog moveHeaderDlg;
    private int moveIndex = -1;
    
    private static int CSD_FILE_LENGTH_RECORD_POSITION = 30 ;
    private static int CSD_FILE_LENGTH_NUMBER_OF_CHANNELS = 3050 ;
    private static int CSD_FILE_LENGTH_NUMBER_OF_SAMPLES = 3054 ;
    private static int CSD_FILE_LENGTH_POINTER_TO_FIRST_SAMPLE = 3088 ;
    
      //***************** added by be on May 29, 2012 Begin ******************************//
    /*
    * new csm reads new csd file which status is stop and cycle and copy from SD card to database by hand.
    * need to rewrite it.
    */    
    public boolean checkFileIsCycleAndRewriteAndBackup( NProtocolHeader pheader ) {
        System.out.println("Start checkFileIsCycleAndRewriteAndBackup");
        long startTime = System.currentTimeMillis() ;
        
        File file = CSMDF.findRecordFile(pheader.Pref) ;
        if(file == null) return false ;
        String dataPath = myDB.getDatabaseDirectory();
        String fileName = file.getName() ;

        int recordPosition ;
        int pointerToFirstSample ;

        int startId = -1 ;
        int numOfSamples = 0 ;
        int numOfChannels = 0 ;
  
        RandomAccessFile ranFile = null;
        try {
            ranFile = new RandomAccessFile( file, "r" );

            int fileVersion = 0;
        
            ranFile.seek( 0 );
            fileVersion = ranFile.readInt();
            
            if(fileVersion < CSMDF.VERSION_3){
                if(ranFile != null){
                    ranFile.close();
                }
                return false;
            }
 
            ranFile.seek( CSD_FILE_LENGTH_RECORD_POSITION );
          
            recordPosition = ranFile.readInt();
//            System.out.println("recordPosition="+recordPosition);
            ranFile.seek( recordPosition );
          
            startId = ranFile.readInt();  
//            System.out.println("startId="+startId);
            if(startId == 0){
                if(ranFile != null){
                    ranFile.close();
                }
                return false;
            }
            
            ranFile.seek( CSD_FILE_LENGTH_NUMBER_OF_CHANNELS );
            numOfChannels = ranFile.readInt();
//             System.out.println("numOfChannels="+numOfChannels);
            
            ranFile.seek( CSD_FILE_LENGTH_NUMBER_OF_SAMPLES );
            numOfSamples = ranFile.readInt();  
//            System.out.println("numOfSamples="+numOfSamples);
               
            ranFile.seek( CSD_FILE_LENGTH_POINTER_TO_FIRST_SAMPLE );
            pointerToFirstSample = ranFile.readInt(); 
            
//             System.out.println("pointerToFirstSample="+pointerToFirstSample);
            
            
            if(recordPosition == pointerToFirstSample){
                if(ranFile != null){
                    ranFile.close();
                }
                return false ;
            }

            int recordID = 0 ;
            int oneSampleLength = numOfChannels * 8 + 4 ;
            System.out.println("oneSampleLength="+oneSampleLength);    
            long fileLen = ranFile.length() ;
//            long recordLen = fileLen - recordPosition ;
            long cyclePartLen = pointerToFirstSample - recordPosition ;
            long noCyclePartLen = fileLen - pointerToFirstSample ;
            int lastOfOneSample = (int) (noCyclePartLen % oneSampleLength) ;  
            System.out.println("lastOfOneSample="+lastOfOneSample);
            
            
            File toFile = new File( dataPath + fileName+".cp" );
            if(toFile.exists()){
                if(ranFile != null){
                    ranFile.close();
                }
                return false;
            }else toFile.createNewFile();
            
            RandomAccessFile writeToFile = new RandomAccessFile( toFile, "rwd" );
            
            ranFile.seek( 0 );
            int byteReadLen = 0;
            long byteSum = 0;
            int bufSize = 1024*2 ;
            byte[] buffer = new byte[bufSize] ;
            int headerSize = recordPosition ;
            while(headerSize > bufSize){
                byteReadLen = ranFile.read(buffer) ;
                byteSum += byteReadLen ;
                writeToFile.write(buffer,0,byteReadLen);
                headerSize -= bufSize ;
               
            }
            if(headerSize > 0){
                buffer = new byte[headerSize] ;
                byteReadLen = ranFile.read(buffer) ;
                byteSum += byteReadLen ;
                writeToFile.write(buffer,0,byteReadLen);                
            }
            System.out.println("read header byteSum="+byteSum); 
            ranFile.seek( pointerToFirstSample );
            buffer = new byte[oneSampleLength] ;
            byteSum = 0 ;
            byteReadLen = 0;
            byte[] byteID = new byte[4];
            while((byteReadLen = ranFile.read(buffer)) != -1){
                
                if(byteReadLen > 0){

                    byteID = CSMDF.intToByteArray(recordID) ;
                    for ( int ii = 0; ii < 4; ii++ )
                        buffer[ii] = byteID[ii];     
                    
                    writeToFile.write(buffer,0,byteReadLen);
                    
                    recordID += 1;  
                    byteSum += byteReadLen ;
                   
                }  
//                buffer = new byte[oneSampleLength] ;
            }
//            System.out.println("read nocycle path byteSum="+byteSum); 
//            System.out.println("read nocycle path recordID="+recordID); 
            
            ranFile.seek( recordPosition );
            if(lastOfOneSample > 0){
               
                buffer = new byte[oneSampleLength-lastOfOneSample] ;
                byteReadLen = ranFile.read(buffer) ;                             
                writeToFile.write(buffer,0,byteReadLen);
                cyclePartLen -= byteReadLen ;
//                System.out.println("read lastOfOneSample path byteReadLen="+byteReadLen); 
//                System.out.println("read lastOfOneSample path cyclePartLen="+cyclePartLen);
            }
            
            byteSum = 0 ;
            byteReadLen = 0;
            buffer = new byte[oneSampleLength] ;
            while( cyclePartLen >= oneSampleLength){

                byteReadLen = ranFile.read(buffer) ;
                if(byteReadLen > 0){

                    byteID = CSMDF.intToByteArray(recordID) ;
                    for ( int ii = 0; ii < 4; ii++ )
                        buffer[ii] = byteID[ii];     
                    
                    writeToFile.write(buffer,0,byteReadLen);
                    
                    recordID += 1;  
                    byteSum += byteReadLen ;
                    cyclePartLen -= oneSampleLength ;
                    
                }  
                
            }
            
            System.out.println("read cycle path byteSum="+byteSum); 
            System.out.println("read cycle path recordID="+recordID);           
            writeToFile.close();
            ranFile.close();

            System.out.println("Used time is " + ((System.currentTimeMillis() - startTime)/1000) + " s" );
            
            long copyStartTime  = System.currentTimeMillis() ;
            
            File buckupFolder  = new File(dataPath+System.getProperty("file.separator")+"backup") ;
            if(!(buckupFolder.exists()) && !(buckupFolder.isDirectory())){
                System.out.println("buckup make dir is "+buckupFolder.mkdir());
            }
            
            String backupFilePath = buckupFolder.getAbsolutePath() +System.getProperty("file.separator") + fileName + ".bk";
            System.out.println("copy file newFileName is "+backupFilePath); 
            File backupFile = new File(backupFilePath);
            if(backupFile.exists()) backupFile.delete();
            if(copy(file,backupFile)){
                if(file.exists())file.delete();
                if ( !toFile.renameTo( file) ){
                    System.out.println("toFile rename fail.");
                }
                System.out.println("copy file succ."); 
            }           

//            pheader.Status = NProtocolHeader.STATUS_STOP ;
//            pheader.StopTime = pheader.StartTime + (recordID-1)*pheader.SampleRate*pheader.SampleRateFactor;
//            myDB.updateProtocolHeader(pheader, file);
            
            System.out.println("checkFileIsCycleAndRewriteAndBackup end. Copy file and rename used time is " + ((System.currentTimeMillis() - copyStartTime)/1000) + " s" );
        }catch (FileNotFoundException ex) {
            ex.printStackTrace();
            return false ;
        } catch ( java.io.EOFException eof ) {
            eof.printStackTrace();
            return false ;
        } catch ( Exception e ) {
            e.printStackTrace();
            return false;
        }finally{
            if (ranFile != null) {
                try {
                    ranFile.close();
                } catch (IOException ex) {
                    java.util.logging.Logger.getLogger(PHeaderDialog.class.getName()).log(Level.SEVERE, null, ex);
                }
            }
        }
        
        return true;
    }
    
     private boolean copy(File sourceFile, File targetFile){ 

        FileInputStream input = null ; 
        FileOutputStream output = null ; 
        try { 
            input = new FileInputStream(sourceFile) ; 
            output = new FileOutputStream(targetFile) ; 
            byte[] b = new byte[1024 * 3]; 
            int len; 
            while((len = input.read(b)) != -1){ 
                output.write(b, 0, len); 
            } 
            output.flush(); 
            output.close(); 
            input.close(); 
            
            System.out.println("remove   file:   "   +   sourceFile   +   "   ==>   " 
                                +   targetFile   +   "   Sucessful!"); 
            return true;
            
        } catch (Exception e) { 
            try {
                if(output != null)
                    output.close();
                if(input != null)
                    input.close(); 
            } catch (IOException ex) {
                java.util.logging.Logger.getLogger(PHeaderDialog.class.getName()).log(Level.SEVERE, null, ex);
            } finally{           
                System.out.println("File   can't   be   read!"); 
                return false;
            }          
        } 
    }
    
    //***************** added by be on May 29, 2012 End ******************************//
     
    // *********************** added export file function by be on Dec 16, 2013 begin***********************//
    private void exportToExcel() {
        
        final int index = jTableMain.getSelectedRow(); 
        if (index >= 0) {
            
            //This NewWaitingDialog added by be on May 29, 2012.    
            final NewWaitingDialog dlgWaiting = new NewWaitingDialog();
            try{
                dlgWaiting.setAlwaysOnTop(true);
                dlgWaiting.showUp(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Operation_in_progress._Please_wait_..."), new TimerTask() {
                    public void run() {

                        NProtocolHeader pheader = pheaderList.get(index); 

                        checkFileIsCycleAndRewriteAndBackup(pheader) ; //Added by be on May 29, 2012.

                        checkPowerLostAndFillNA(pheader);

                        ExportingDataDialog expDlg;
                        JFileChooser fc = new JFileChooser();
                        if(dlgWaiting != null) dlgWaiting.unShow();
                        //added by be on 20121010, Richard's requirement, export to csv file.
                        ExportDataFileTypeDialog fileTypeDig = new ExportDataFileTypeDialog();
                        fileTypeDig.setModalityType( Dialog.ModalityType.APPLICATION_MODAL );
                        fileTypeDig.setVisible( true );
                        if ( fileTypeDig.getSelection() == ExportDataFileTypeDialog.SELECTION_CANCEL ) {

                            return;
                        }
                        if(fileTypeDig.getSelection() == ExportDataFileTypeDialog.SELECTION_CSV){
                            FileNameExtensionFilter filter = new FileNameExtensionFilter( "csv" , "CSV" );
                            fc = new JFileChooser();
                            fc.setFileFilter( filter );
                            
                            ExportDataOptionDialog dlg = new ExportDataOptionDialog( pheader, myDB, true );
                            dlg.setModalityType( Dialog.ModalityType.APPLICATION_MODAL );
                            dlgWaiting.unShow() ;
                            dlg.setVisible( true );
                            if ( dlg.getSelection() == ExportDataOptionDialog.SELECTION_CANCEL ) {
                                return;
                            }
                            
                            if ( fc.showDialog(null,  java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Export")) == JFileChooser.APPROVE_OPTION ) {
                                //ExportingDataDialog( final CSMDF db, long pref, String fileName, int fileMode ) 
                                 if ( dlg.getSelection() == ExportDataOptionDialog.SELECTION_SELECT_TIME_PERIOD ) {
                                    expDlg = new ExportingDataDialog(myDB, pheader.Pref, fc.getSelectedFile().getAbsolutePath(),ExportingDataDialog.EXPORT_CSV_FILE, dlg.getStartID(), dlg.getEndID() );
                                } else {
                                    expDlg = new ExportingDataDialog( myDB, pheader.Pref, fc.getSelectedFile().getAbsolutePath(),ExportingDataDialog.EXPORT_CSV_FILE );
                                }
                                expDlg.setVisible(true);

                            }
                        }else{

                            FileNameExtensionFilter filter = new FileNameExtensionFilter( "xls", "Excel", "XLS" );
                            fc = new JFileChooser();
                            fc.setFileFilter( filter );

                            ExportDataOptionDialog dlg = new ExportDataOptionDialog( pheader, myDB, true );
                            dlg.setModalityType( Dialog.ModalityType.APPLICATION_MODAL );
                            dlgWaiting.unShow() ;
                            dlg.setVisible( true );
                            if ( dlg.getSelection() == ExportDataOptionDialog.SELECTION_CANCEL ) {
                                return;
                            }
                            if ( fc.showDialog(null,  java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Export")) == JFileChooser.APPROVE_OPTION ) {
                                if ( dlg.getSelection() == ExportDataOptionDialog.SELECTION_SELECT_TIME_PERIOD ) {
                                    expDlg = new ExportingDataDialog( myDB, pheader.Pref, fc.getSelectedFile().getAbsolutePath(),
                                            dlg.getStartID(), dlg.getEndID() );
                                } else {
                                    //save in different files.
                                    expDlg = new ExportingDataDialog( myDB, pheader.Pref, fc.getSelectedFile().getAbsolutePath(), false, true );
                                }
                                expDlg.setVisible(true);
                            }

                        }
                    }

                });              
            }catch(Exception e){
                if(dlgWaiting != null) dlgWaiting.unShow();
//                e.printStackTrace();
            }
        } else { // if no pheader selected
            JOptionPane.showMessageDialog(this,  java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_select_a_file_to_export"));
        }        
    }
    
    // *********************** added export file function by be on Dec 16, 2013 end ***********************//
    
}
