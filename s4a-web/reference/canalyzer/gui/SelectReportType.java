/*
 * SelectReportType.java
 *
 * Created on 2008年1月29日, 下午2:42
 */

package com.cs.canalyzer.gui;

import com.cs.canalyzer.structs.CommonValue;
import com.cs.canalyzer.structs.ViewOptions;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Toolkit;
import javax.swing.ImageIcon;

/**
 *
 * @author  wolf
 */
public class SelectReportType extends javax.swing.JDialog {
    
    /** Creates new form SelectReportType */
    public SelectReportType( CommonValue common ) {
        this.theCommonValue = common;
        
        myInit();
    }
    
    private void myInit() {
        initComponents();        
        
        buttonGroupType.add( jRadioDay );
        buttonGroupType.add( jRadioWeek );
        buttonGroupType.add( jRadioMonth );
        buttonGroupType.add( jRadioTimePeriod );

        buttonGroupAverage.add( jRadioNone );
        buttonGroupAverage.add( jRadio1Minute );
        buttonGroupAverage.add( jRadio15Minute );
        buttonGroupAverage.add( jRadio1Hour );
        //v3-13: provide more choices for "Use average value"
        //1,5,10,15,20,30,45 and 60 minutes.
        //add on 20091020.be.
        buttonGroupAverage.add( jRadio5Minute );
        buttonGroupAverage.add( jRadio10Minute );
        buttonGroupAverage.add( jRadio20Minute );
        buttonGroupAverage.add( jRadio30Minute );
        buttonGroupAverage.add( jRadio45Minute );
        
        initValue();
        
        setIconImage( new ImageIcon( getClass().getResource( GUIConst.IMAGE_PATH + GUIConst.LOGO_FILE_NAME)).getImage() );         
        Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();
        setBounds( (dim.width - WIDTH) / 2, (dim.height - HEIGHT) / 4, WIDTH, HEIGHT );
        
        // temp
        jRadioDay.setVisible( false );
        jRadioWeek.setVisible( false );
        jRadioMonth.setVisible( false );
        jRadioTimePeriod.setVisible( false );
        
    }
    
    private void initValue() {
        // report type
        switch ( theCommonValue.getReportType() ) {
            case CommonValue.REPORT_TYPE_DAY: jRadioDay.setSelected( true ); break;
            case CommonValue.REPORT_TYPE_WEEK: jRadioWeek.setSelected( true ); break;
            case CommonValue.REPORT_TYPE_MONTH: jRadioMonth.setSelected( true ); break;
            case CommonValue.REPORT_TYPE_PERIOD: jRadioTimePeriod.setSelected( true ); break;
            default: jRadioDay.setSelected( true );
        }
        
        switch ( theCommonValue.getViewOptions().useAverage ) {
            case ViewOptions.AVERAGE_NONE: jRadioNone.setSelected( true ); break;
            case ViewOptions.AVERAGE_1_MINUTE: jRadio1Minute.setSelected( true ); break;
            case ViewOptions.AVERAGE_15_MINUTE: jRadio15Minute.setSelected( true ); break;
            case ViewOptions.AVERAGE_1_HOUR: jRadio1Hour.setSelected( true ); break;
            //v3-13: provide more choices for "Use average value"
            //1,5,10,15,20,30,45 and 60 minutes.
            //add on 20091020.be.
            case ViewOptions.AVERAGE_5_MINUTE: jRadio5Minute.setSelected( true ); break;
            case ViewOptions.AVERAGE_10_MINUTE: jRadio10Minute.setSelected( true ); break;
            case ViewOptions.AVERAGE_20_MINUTE: jRadio20Minute.setSelected( true ); break;
            case ViewOptions.AVERAGE_30_MINUTE: jRadio30Minute.setSelected( true ); break;
            case ViewOptions.AVERAGE_45_MINUTE: jRadio45Minute.setSelected( true ); break;

            default: jRadioNone.setSelected( true ); break;
        }
    }
    
    private void applyChanges() {
        int reportType, useAverage;
        int currentReportType;
        ViewOptions viewOptions;
        
        if ( jRadioDay.isSelected() )
            reportType = CommonValue.REPORT_TYPE_DAY;
        else if ( jRadioWeek.isSelected() )
            reportType = CommonValue.REPORT_TYPE_WEEK;
        else if ( jRadioMonth.isSelected() )
            reportType = CommonValue.REPORT_TYPE_MONTH;
        else if ( jRadioTimePeriod.isSelected() )
            reportType = CommonValue.REPORT_TYPE_PERIOD;
        else 
            reportType = CommonValue.REPORT_TYPE_DAY;
        
        if ( jRadioNone.isSelected() )
            useAverage = ViewOptions.AVERAGE_NONE;
        else if ( jRadio1Minute.isSelected() )
            useAverage = ViewOptions.AVERAGE_1_MINUTE;
        else if ( jRadio15Minute.isSelected() )
            useAverage = ViewOptions.AVERAGE_15_MINUTE;
        //v3-13: provide more choices for "Use average value"
        //1,5,10,15,20,30,45 and 60 minutes.
        //add on 20091020.be.
        else if ( jRadio5Minute.isSelected() )
            useAverage = ViewOptions.AVERAGE_5_MINUTE;
        else if ( jRadio10Minute.isSelected() )
            useAverage = ViewOptions.AVERAGE_10_MINUTE;
        else if ( jRadio20Minute.isSelected() )
            useAverage = ViewOptions.AVERAGE_20_MINUTE;
        else if ( jRadio30Minute.isSelected() )
            useAverage = ViewOptions.AVERAGE_30_MINUTE;
        else if ( jRadio45Minute.isSelected() )
            useAverage = ViewOptions.AVERAGE_45_MINUTE;

        else if ( jRadio1Hour.isSelected() )
            useAverage = ViewOptions.AVERAGE_1_HOUR;
        else 
            useAverage = ViewOptions.AVERAGE_NONE;
        
        currentReportType = theCommonValue.getReportType();
        viewOptions = theCommonValue.getViewOptions();
        dispose();
        if ( reportType == currentReportType && useAverage != viewOptions.useAverage ) {
            viewOptions.useAverage = useAverage;
            theCommonValue.setViewOptions( viewOptions );
        } else if ( reportType != currentReportType && useAverage == viewOptions.useAverage ) {
            theCommonValue.setReportType( reportType );
        } else if ( reportType != currentReportType && useAverage != viewOptions.useAverage ) {
            viewOptions.useAverage = useAverage;
            theCommonValue.setReportTypeAndViewOptions( reportType, viewOptions );
        } 
        
    }
    
    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        buttonGroupType = new javax.swing.ButtonGroup();
        buttonGroupAverage = new javax.swing.ButtonGroup();
        jLabel7 = new javax.swing.JLabel();
        jRadio1Minute = new javax.swing.JRadioButton();
        jRadio15Minute = new javax.swing.JRadioButton();
        jRadio1Hour = new javax.swing.JRadioButton();
        jRadioNone = new javax.swing.JRadioButton();
        jRadioMonth = new javax.swing.JRadioButton();
        jRadioWeek = new javax.swing.JRadioButton();
        jRadioDay = new javax.swing.JRadioButton();
        jButtonOK = new javax.swing.JButton();
        jButtonCancel = new javax.swing.JButton();
        jRadioTimePeriod = new javax.swing.JRadioButton();
        jRadio10Minute = new javax.swing.JRadioButton();
        jRadio30Minute = new javax.swing.JRadioButton();
        jRadio5Minute = new javax.swing.JRadioButton();
        jRadio20Minute = new javax.swing.JRadioButton();
        jRadio45Minute = new javax.swing.JRadioButton();

        setDefaultCloseOperation(javax.swing.WindowConstants.DISPOSE_ON_CLOSE);
        java.util.ResourceBundle bundle = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts"); // NOI18N
        setTitle(bundle.getString("Select_Report_Type")); // NOI18N

        jLabel7.setFont(new java.awt.Font("SansSerif", 1, 12));
        jLabel7.setText(bundle.getString("Use_average_value:")); // NOI18N

        jRadio1Minute.setFont(DIALOG_FONT);
        jRadio1Minute.setText(bundle.getString("1_minute")); // NOI18N
        jRadio1Minute.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jRadio1Minute.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jRadio15Minute.setFont(DIALOG_FONT);
        jRadio15Minute.setText(bundle.getString("15_minute")); // NOI18N
        jRadio15Minute.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jRadio15Minute.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jRadio1Hour.setFont(DIALOG_FONT);
        jRadio1Hour.setText(bundle.getString("1_hour")); // NOI18N
        jRadio1Hour.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jRadio1Hour.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jRadioNone.setFont(DIALOG_FONT);
        jRadioNone.setSelected(true);
        jRadioNone.setText(bundle.getString("none")); // NOI18N
        jRadioNone.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jRadioNone.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jRadioMonth.setFont(DIALOG_FONT);
        jRadioMonth.setText(bundle.getString("one_month")); // NOI18N
        jRadioMonth.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jRadioMonth.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jRadioWeek.setFont(DIALOG_FONT);
        jRadioWeek.setText(bundle.getString("one_week")); // NOI18N
        jRadioWeek.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jRadioWeek.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jRadioDay.setFont(DIALOG_FONT);
        jRadioDay.setSelected(true);
        jRadioDay.setText(bundle.getString("one_day")); // NOI18N
        jRadioDay.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jRadioDay.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jButtonOK.setFont(DIALOG_FONT);
        jButtonOK.setText(bundle.getString("OK")); // NOI18N
        jButtonOK.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonOKActionPerformed(evt);
            }
        });

        jButtonCancel.setFont(DIALOG_FONT);
        jButtonCancel.setText(bundle.getString("Cancel")); // NOI18N
        jButtonCancel.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonCancelActionPerformed(evt);
            }
        });

        jRadioTimePeriod.setFont(DIALOG_FONT);
        jRadioTimePeriod.setText(bundle.getString("selected_time_period")); // NOI18N
        jRadioTimePeriod.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        jRadioTimePeriod.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jRadio10Minute.setFont(DIALOG_FONT);
        jRadio10Minute.setText(bundle.getString("10_minutes")); // NOI18N
        jRadio10Minute.setBorder(javax.swing.BorderFactory.createEmptyBorder(1, 1, 1, 1));
        jRadio10Minute.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jRadio30Minute.setFont(DIALOG_FONT);
        jRadio30Minute.setText(bundle.getString("30_minutes")); // NOI18N
        jRadio30Minute.setBorder(javax.swing.BorderFactory.createEmptyBorder(1, 1, 1, 1));
        jRadio30Minute.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jRadio5Minute.setFont(DIALOG_FONT);
        jRadio5Minute.setText(bundle.getString("5_minutes")); // NOI18N
        jRadio5Minute.setBorder(javax.swing.BorderFactory.createEmptyBorder(1, 1, 1, 1));
        jRadio5Minute.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jRadio20Minute.setFont(DIALOG_FONT);
        jRadio20Minute.setText(bundle.getString("20_minutes")); // NOI18N
        jRadio20Minute.setBorder(javax.swing.BorderFactory.createEmptyBorder(1, 1, 1, 1));
        jRadio20Minute.setMargin(new java.awt.Insets(0, 0, 0, 0));

        jRadio45Minute.setFont(DIALOG_FONT);
        jRadio45Minute.setText(bundle.getString("45_minutes")); // NOI18N
        jRadio45Minute.setBorder(javax.swing.BorderFactory.createEmptyBorder(1, 1, 1, 1));
        jRadio45Minute.setMargin(new java.awt.Insets(0, 0, 0, 0));

        org.jdesktop.layout.GroupLayout layout = new org.jdesktop.layout.GroupLayout(getContentPane());
        getContentPane().setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(layout.createSequentialGroup()
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(layout.createSequentialGroup()
                        .add(18, 18, 18)
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                            .add(jRadioTimePeriod)
                            .add(layout.createSequentialGroup()
                                .add(jRadioDay)
                                .add(18, 18, 18)
                                .add(jRadioWeek))))
                    .add(layout.createSequentialGroup()
                        .addContainerGap()
                        .add(jLabel7)))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING, false)
                    .add(layout.createSequentialGroup()
                        .add(jButtonOK)
                        .add(38, 38, 38)
                        .add(jButtonCancel))
                    .add(layout.createSequentialGroup()
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING, false)
                            .add(jRadio1Minute, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 79, Short.MAX_VALUE)
                            .add(jRadio5Minute, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 79, Short.MAX_VALUE)
                            .add(jRadio15Minute, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 79, Short.MAX_VALUE)
                            .add(jRadioNone, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 79, Short.MAX_VALUE)
                            .add(org.jdesktop.layout.GroupLayout.TRAILING, jRadio10Minute))
                        .add(18, 18, 18)
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jRadio1Hour, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 79, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                            .add(jRadio20Minute)
                            .add(jRadio30Minute)
                            .add(jRadio45Minute)))
                    .add(jRadioMonth))
                .add(91, 91, 91))
        );

        layout.linkSize(new java.awt.Component[] {jButtonCancel, jButtonOK}, org.jdesktop.layout.GroupLayout.HORIZONTAL);

        layout.linkSize(new java.awt.Component[] {jRadio10Minute, jRadio15Minute, jRadio1Hour, jRadio1Minute, jRadio20Minute, jRadio30Minute, jRadio45Minute, jRadio5Minute, jRadioNone}, org.jdesktop.layout.GroupLayout.HORIZONTAL);

        layout.setVerticalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(layout.createSequentialGroup()
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jRadioDay, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jRadioWeek, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jRadioMonth, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                .add(jRadioTimePeriod, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 15, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .add(26, 26, 26)
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel7)
                    .add(layout.createSequentialGroup()
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                            .add(layout.createSequentialGroup()
                                .add(jRadio1Minute)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jRadio5Minute)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jRadio10Minute)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                                    .add(jRadio15Minute)
                                    .add(jRadio1Hour)))
                            .add(layout.createSequentialGroup()
                                .add(jRadio20Minute)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jRadio30Minute)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jRadio45Minute)
                                .add(23, 23, 23)))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jRadioNone)))
                .add(18, 18, 18)
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jButtonCancel)
                    .add(jButtonOK))
                .addContainerGap(28, Short.MAX_VALUE))
        );

        layout.linkSize(new java.awt.Component[] {jRadio10Minute, jRadio15Minute, jRadio1Hour, jRadio1Minute, jRadio20Minute, jRadio30Minute, jRadio45Minute, jRadio5Minute, jRadioNone}, org.jdesktop.layout.GroupLayout.VERTICAL);

        pack();
    }// </editor-fold>//GEN-END:initComponents

    private void jButtonOKActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonOKActionPerformed
        applyChanges();
        dispose();
    }//GEN-LAST:event_jButtonOKActionPerformed

    private void jButtonCancelActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonCancelActionPerformed
        dispose();
    }//GEN-LAST:event_jButtonCancelActionPerformed
    
    //v3-13: provide more choices for "Use average value"
    //1,5,10,15,20,30,45 and 60 minutes.
    //modify on 20091020.be.
//    private final int WIDTH = 330;
    private final int WIDTH = 446;
    private final int HEIGHT = 250;
   
    private final Font DIALOG_FONT = new Font( "SansSerif", 1, 10 );
    
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.ButtonGroup buttonGroupAverage;
    private javax.swing.ButtonGroup buttonGroupType;
    private javax.swing.JButton jButtonCancel;
    private javax.swing.JButton jButtonOK;
    private javax.swing.JLabel jLabel7;
    private javax.swing.JRadioButton jRadio10Minute;
    private javax.swing.JRadioButton jRadio15Minute;
    private javax.swing.JRadioButton jRadio1Hour;
    private javax.swing.JRadioButton jRadio1Minute;
    private javax.swing.JRadioButton jRadio20Minute;
    private javax.swing.JRadioButton jRadio30Minute;
    private javax.swing.JRadioButton jRadio45Minute;
    private javax.swing.JRadioButton jRadio5Minute;
    private javax.swing.JRadioButton jRadioDay;
    private javax.swing.JRadioButton jRadioMonth;
    private javax.swing.JRadioButton jRadioNone;
    private javax.swing.JRadioButton jRadioTimePeriod;
    private javax.swing.JRadioButton jRadioWeek;
    // End of variables declaration//GEN-END:variables
 
    private CommonValue theCommonValue;
    
}
