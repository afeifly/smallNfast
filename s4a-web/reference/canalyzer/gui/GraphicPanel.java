/*
 * GraphicPanel.java
 *
 * Created on 2007年3月19日, 下午4:14
 */
package com.cs.canalyzer.gui;

import com.cs.canalyzer.structs.CommonValue;
import com.cs.canalyzer.structs.Compressor;
import com.cs.canalyzer.structs.LeakStatistics;
import com.cs.canalyzer.structs.MeasurementUnit;
import com.cs.canalyzer.structs.Texts;
import com.cs.canalyzer.structs.VFConst;
import com.cs.canalyzer.structs.ViewChannel;
import com.cs.canalyzer.structs.ViewOptions;
import com.cs.database.CSMDF;
import com.cs.database.NChannelHeader;
import com.cs.database.NMeasurementRecordLine;
import com.cs.database.NProtocolHeader;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.EventQueue;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.geom.GeneralPath;
import java.awt.geom.Line2D;
import java.awt.geom.Point2D;
import java.awt.geom.Rectangle2D;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.lang.Integer;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;
import java.util.Hashtable;
import java.util.Locale;
import java.util.Stack;
import java.util.TimerTask;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPopupMenu;
import java.util.Timer;

/**
 *
 * @author msu
 */
public class GraphicPanel extends javax.swing.JPanel implements PropertyChangeListener {

    /**
     * Creates new form GraphicPanel
     */
    public GraphicPanel(CommonValue common) {
        this.theCommonValue = common;
        this.viewOptions = common.getViewOptions();
        this.leakStat = common.getLeakStatistics();


        myInit();
    }

    private void myInit() {
        selectedChannelDatas = new ArrayList<ViewChannelData>();
        origSelectedChannelDatas = new ArrayList<ViewChannelData>();
        allCommentLabels = new Hashtable<String, javax.swing.JLabel>();
        numOfYSteps = new int[GUIConst.Y_AXIS_NUMBER];
        yDivs = new float[GUIConst.Y_AXIS_NUMBER];

        displayRecordAtCursorListener = new java.awt.event.MouseMotionAdapter() {

            public void mouseMoved(java.awt.event.MouseEvent evt) {
                displayRecordAtCursor(evt);
            }
        };

        initComponents();
        calculatePoints();
        initLines();
        //add on 20091223.be
        //reason : Wolfgang Blessing ,Michael Kromer requirement
        //         The name "Record period" seems to be the time of the complete recording.
        //         should be called "time period"
        jLabelFromPre.setText(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Time_Period"));
        initLengendLabels();
    }

    private void calculatePoints() {
        totalW = this.getWidth();       
        totalH = this.getHeight();
        canvasStart = new Point2D.Float((float) 0.0, TITLE_PANEL_HEIGHT);
        canvasW = totalW;
        canvasH = totalH - jPanelTitle.getHeight() - jPanelLegend.getHeight();
        //xStart = new Point2D.Float( LEFT_MARGIN, TITLE_PANEL_HEIGHT + jPanelCanvas.getHeight() - BOTTOM_MARGIN );
        xStart = new Point2D.Float(LEFT_MARGIN, totalH - LEGEND_PANEL_HEIGHT - BOTTOM_MARGIN);
        xEnd = new Point2D.Float(totalW - RIGHT_MARGIN - 2 * ARROW_LENGTH, xStart.y);
        rightYAxisX = xEnd.x;


        yStarts = new Point2D.Float[GUIConst.Y_AXIS_NUMBER];
        for (int i = 0; i < yStarts.length; i += 2) {
            yStarts[i] = new Point2D.Float(LEFT_MARGIN + Y_AXIS_WIDTH * i, xStart.y);
            yStarts[i + 1] = new Point2D.Float(rightYAxisX - Y_AXIS_WIDTH * i, xStart.y);
            if (!viewOptions.yDisableds[i]) {
                xStart = yStarts[i]; // left axis
            }
            if (!viewOptions.yDisableds[i + 1]) {
                xEnd = yStarts[i + 1]; // right axis
            }
        }
        yEnds = new Point2D.Float[GUIConst.Y_AXIS_NUMBER];
        for (int i = 0; i < yStarts.length; i++) {
            yEnds[i] = new Point2D.Float(yStarts[i].x, TITLE_PANEL_HEIGHT);
            yLength = yStarts[0].y - yEnds[0].y;
        }
    }

    private void initLines() {
        xAxis = new GeneralPath();
        yAxises = new ArrayList<GeneralPath>();
        for (int i = 0; i < GUIConst.Y_AXIS_NUMBER; i++) {
            yAxises.add(new GeneralPath());
        }
        yDataStarts = new double[GUIConst.Y_AXIS_NUMBER];
        yDataEnds = new double[GUIConst.Y_AXIS_NUMBER];  // start and end value
        yDataDivs = new double[GUIConst.Y_AXIS_NUMBER];
        yDataLengths = new double[GUIConst.Y_AXIS_NUMBER];
        //numOfYSteps = new int[GUIConst.Y_AXIS_NUMBER];
        //yDivs = new float[GUIConst.Y_AXIS_NUMBER];
//        lines = new ArrayList<GeneralPath>();
         lines = new Hashtable<Long,GeneralPath>();
        /*
         * for ( int i = 0; i < GUIConst.MAX_LENGEND_NUMBER; i++ ) { lines.add(
         * new GeneralPath() );
        }
         */

        yOffSet = new float[GUIConst.Y_AXIS_NUMBER];
        Arrays.fill(yOffSet, 0);

        baseLine = new Line2D.Float();

    }

    private void initLengendLabels() {
        //GridLayout layout = new GridLayout();        //jPanelLegend.getLayout()
        for (int i = 0; i < CommonValue.MAX_LENGEND_NUMBER; i++) {
            javax.swing.JLabel legend = new javax.swing.JLabel();
            legend.setHorizontalAlignment(legend.CENTER);
            legend.setFont(new java.awt.Font("SansSerif", 1, 10));
            jPanelLegendTop.add(legend);
        }
    }

    private void updateLengendLabels() {
        javax.swing.JLabel legend;
        ViewChannelData vcd;
        for (int i = 0; i < CommonValue.MAX_LENGEND_NUMBER; i++) {
            String text = "";
            legend = (javax.swing.JLabel) jPanelLegendTop.getComponent(i);
            legend.setFont(new java.awt.Font(FONT_NAME, 1, 10));
            legend.setAlignmentX(JLabel.CENTER_ALIGNMENT);
            try {
                vcd = selectedChannelDatas.get(i);
                text = vcd.fullChannelName;
                legend.setForeground(selectedChannelDatas.get(i).color);
            } catch (Exception e) {
                vcd = null;
            }

            theCommonValue.getTexts().Legends[i] = text;
            
            if(vcd != null){
                if(MeasurementUnit.IsCurrentUnit(vcd.unit) && showCurrentAsFlow){
                    if(isCurrentHasPowerChannelBaseOnCompressor(vcd.chheader)){
                        text = text + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("no_display");
                    }
                }
            }
            legend.setText(text);
        }
    }

    /**
     * Set x axis start and end time, scale, etc. If report type 1 day, then
     * start from 0:00. If report type 1 week, then start from Monday, 0:00. If
     * report type 1 month, then start from 1st, 0:00.
      *
     */
    private void setXAxis() {
        xAxis.reset();

        DateFormat formatter = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT, Locale.ENGLISH);
//        DateFormat formatter = new SimpleDateFormat(CommonValue.shortDateFormatStyle + " HH:mm:ss");        
        Calendar adjustStartTime = Calendar.getInstance();
        //Calendar adjustEndTime = Calendar.getInstance();

        // decide the time start and end
        xDataStart = viewOptions.startTime.getTime();
        xDataEnd = viewOptions.endTime.getTime();

        if (status == STATUS_SORTED_FLOW) {
            // find out if start time is earlier than first record time
            long firstRecordTimeMilli = 0;
            long distance = xDataEnd - xDataStart;
            for (ViewChannelData vcd : selectedChannelDatas) {
                if (firstRecordTimeMilli == 0 || firstRecordTimeMilli > vcd.startTimeMilli) {
                    firstRecordTimeMilli = vcd.startTimeMilli;
                }
            }
            if (xDataStart < firstRecordTimeMilli) {
                xDataStart = firstRecordTimeMilli;
                xDataEnd = xDataStart + distance;
            }
        }

        adjustStartTime.setTimeInMillis(xDataStart);
        if (theCommonValue.getReportType() != CommonValue.REPORT_TYPE_PERIOD || xDataEnd - xDataStart > GUIConst.ONE_HOUR_MILLS) {
            adjustStartTime.set(Calendar.MINUTE, 0);
        }
        adjustStartTime.set(Calendar.SECOND, 0);
        //adjustEndTime.setTimeInMillis( xDataEnd );

        // set number of steps, change the start and end time to full hour, or day
        if (status == STATUS_SORTED_FLOW) {
            if (theCommonValue.getReportType() == CommonValue.REPORT_TYPE_WEEK) {
                xDataDiv = ViewOptions.ONE_DAY_MILLS;
                numOfXStep = 7;
                adjustStartTime.set(Calendar.HOUR_OF_DAY, 0);
                formatter = DateFormat.getDateInstance(DateFormat.SHORT, Locale.ENGLISH);
//                formatter = new SimpleDateFormat(CommonValue.shortDateFormatStyle);        
            } else {
                numOfXStep = DEFAULT_X_STEP_NUMBER;
                xDataDiv = (xDataEnd - xDataStart) / numOfXStep;
//                formatter = new SimpleDateFormat(CommonValue.shortDateFormatStyle + " HH:mm:ss");        
                formatter = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT, Locale.ENGLISH);
            }
        } else {
            switch (theCommonValue.getReportType()) {
                case CommonValue.REPORT_TYPE_DAY: {
                    xDataDiv = ViewOptions.ONE_HOUR_MILLS;
                    numOfXStep = 24;
                    adjustStartTime.set(Calendar.HOUR_OF_DAY, 0);
                    formatter = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT, Locale.ENGLISH);
//                    formatter = new SimpleDateFormat(CommonValue.shortDateFormatStyle);        
                    break;
                }
                case CommonValue.REPORT_TYPE_WEEK: {
                    xDataDiv = ViewOptions.ONE_DAY_MILLS;
                    numOfXStep = 7;
                    adjustStartTime.set(Calendar.HOUR_OF_DAY, 0);
                    if (theCommonValue.weekStartFromMonday()) {
                        adjustStartTime.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY);
                    }
                    formatter = DateFormat.getDateInstance(DateFormat.SHORT, Locale.ENGLISH);
//                    formatter = new SimpleDateFormat(CommonValue.shortDateFormatStyle);        
                    break;
                }
                case CommonValue.REPORT_TYPE_PERIOD: {
                    numOfXStep = DEFAULT_X_STEP_NUMBER;
                    xDataDiv = (xDataEnd - xDataStart) / numOfXStep;
                    formatter = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT, Locale.ENGLISH);
//                    formatter = new SimpleDateFormat(CommonValue.shortDateFormatStyle);        
                    break;
                }
                case CommonValue.REPORT_TYPE_MONTH: {
                    xDataDiv = ViewOptions.ONE_DAY_MILLS;
                    numOfXStep = 32;
                    adjustStartTime.set(Calendar.HOUR_OF_DAY, 0);
                    adjustStartTime.set(Calendar.DAY_OF_MONTH, 1);
                    break;
                }
                default: {
                    xDataDiv = ViewOptions.ONE_HOUR_MILLS;
                    numOfXStep = 24;
                    adjustStartTime.set(Calendar.HOUR_OF_DAY, 0);
                }
            }
        }

        if (theCommonValue.getReportType() == CommonValue.REPORT_TYPE_DAY) {
            if ((xDataStart - adjustStartTime.getTimeInMillis()) < (xDataEnd - xDataStart)) {
                xDataStart = adjustStartTime.getTimeInMillis();
            }
        } else {

            xDataStart = adjustStartTime.getTimeInMillis();
        }


        // make sure minimum x coodination division is met
        for (int i = 0; i < 4; i++) {
            xDiv = (xEnd.x - xStart.x) / numOfXStep;
            if (xDiv < MINIMUM_X_DIVISION
                    || (xDiv < MINIMUM_X_DIVISION_SORTED_VOLOME_FLOW && status == STATUS_SORTED_FLOW)) { //||
//                    ( xDiv < MINIMUM_X_DIVISION_MONTHLY_VIEW && theCommonValue.getReportType() == CommonValue.REPORT_TYPE_MONTH ) ||
//                    ( xDiv < MINIMUM_X_DIVISION_MONTHLY_VIEW && theCommonValue.getReportType() == CommonValue.REPORT_TYPE_PERIOD &&
//                               adjustStartTime.get( Calendar.DAY_OF_MONTH ) != adjustEndTime.get( Calendar.DAY_OF_MONTH ) )) {
                numOfXStep = numOfXStep / 2;
                xDataDiv = xDataDiv * 2;
            } else {
                break;
            }
        }
        if (theCommonValue.getReportType() == CommonValue.REPORT_TYPE_PERIOD) {
            adjustXDataDivision();
        }
        //if ( theCommonValue.getReportType() != CommonValue.REPORT_TYPE_PERIOD ) {
        //xDataStart = xDataStart - xDataStart % xDataDiv;
        xDataEnd = xDataStart + xDataDiv * numOfXStep;
        //}
        xDataLength = xDataEnd - xDataStart;
        viewOptions.startTime.setTime(xDataStart);
        viewOptions.endTime.setTime(xDataEnd);

        // update the title time field
        /*
         * Date time = new Date();
         *
         * time.setTime( xDataStart ); jLabelFrom.setText( formatter.format(
         * time )); time.setTime( xDataEnd ); jLabelTo.setText(
         * formatter.format( time ));
         */

        // now start to draw
        //float lineEndX = xEnd.x + 2 * ARROW_LENGTH;
        xAxis.moveTo(xStart.x, xStart.y);
        xAxis.lineTo(xEnd.x, xEnd.y);
        //xAxis.lineTo( lineEndX - ARROW_LENGTH, xAxisDrawingEnd.y - ARROW_WIDTH );
        //xAxis.moveTo( lineEndX - ARROW_LENGTH, xAxisDrawingEnd.y + ARROW_WIDTH );
        //xAxis.lineTo( lineEndX, xAxisDrawingEnd.y );
        float x, y;
        y = xStart.y;
        for (int i = 0; i < numOfXStep; i++) {
            x = xStart.x + i * xDiv;
            xAxis.moveTo(x, y);
            xAxis.lineTo(x, y + DASH_LENGTH);
        }

    }

    /**
     * Rule: make x data division 1, 2, 5, 10, 30, 60 minutes
     */
    private void adjustXDataDivision() {
        // note: division is in milli second
        long xDataDivMinute = xDataDiv / (60 * 1000);

        if (xDataDivMinute <= 1) {
            xDataDivMinute = 1;
        } else if (xDataDivMinute <= 2) {
            xDataDivMinute = 2;
        } else if (xDataDivMinute <= 5) {
            xDataDivMinute = 5;
        } else if (xDataDivMinute <= 10) {
            xDataDivMinute = 10;
        } else if (xDataDivMinute <= 15) {
            xDataDivMinute = 15;
        } else if (xDataDivMinute <= 20) {
            xDataDivMinute = 20;
        } else if (xDataDivMinute <= 25) {
            xDataDivMinute = 25;
        } else if (xDataDivMinute <= 30) {
            xDataDivMinute = 30;
        } else if (xDataDivMinute <= 35) {
            xDataDivMinute = 35;
        } else if (xDataDivMinute <= 40) {
            xDataDivMinute = 40;
        } else if (xDataDivMinute <= 45) {
            xDataDivMinute = 45;
        } else if (xDataDivMinute <= 50) {
            xDataDivMinute = 50;
        } else if (xDataDivMinute <= 55) {
            xDataDivMinute = 55;
        } else if (xDataDivMinute <= 60) {
            xDataDivMinute = 60;
        } else {
            return;
        }

        xDataDiv = xDataDivMinute * (60 * 1000);
    }

    private void writeXAxisText(Graphics2D g2) {

        doubTime = false;
        Calendar time = Calendar.getInstance();
        Calendar previousTime = Calendar.getInstance();
        DateFormat formatter; //, dateFormatter;
        SimpleDateFormat dateFormatter;
        String text = "";
        String preText = "";
        float x, y;
        boolean displayDateBelow = false;

        // see if it requires display both date and time and the formatter
        Calendar startTime = Calendar.getInstance();
        Calendar endTime = Calendar.getInstance();
        startTime.setTimeInMillis(xDataStart);
        endTime.setTimeInMillis(xDataEnd);

        //dateFormatter = DateFormat.getDateInstance( DateFormat.SHORT, Locale.GERMAN );
        dateFormatter = new SimpleDateFormat("dd.MM EEE"); //changed "dd.MM.yyyy  EEE" to "dd.MM EEE" by be on 20101008.
        if (theCommonValue.getReportType() == CommonValue.REPORT_TYPE_DAY
                || theCommonValue.getReportType() == CommonValue.REPORT_TYPE_PERIOD) {
            formatter = DateFormat.getTimeInstance(DateFormat.SHORT, Locale.ENGLISH);
//            formatter = new SimpleDateFormat(CommonValue.shortDateFormatStyle);        
            //text = String.format( "  ")time.get( time.HOUR_OF_DAY ) + ":" + time.get( time.MINUTE );
            //if ( startTime.get( Calendar.DAY_OF_MONTH ) != endTime.get( Calendar.DAY_OF_MONTH ))         
            displayDateBelow = true;
        } else {
            displayDateBelow = true;
//            formatter = new SimpleDateFormat(CommonValue.shortDateFormatStyle);        
            formatter = DateFormat.getDateInstance(DateFormat.SHORT, Locale.ENGLISH);
            dateFormatter = new SimpleDateFormat("EEE");
        }

        g2.setFont(new Font(FONT_NAME, 1, 9));
        for (int i = 0; i <= numOfXStep; i++) {
            if (status == STATUS_SORTED_FLOW) {
                int min = (int) (i * xDataDiv / 1000 / 60);
                if (min >= 1440) {
                    if (min % 1440 == 0) {
                        text = String.format("%d d",
                                min / 1440, (min % 1440) / 60, (min % 1440) % 60);
                    } else if (min % 60 == 0) {
                        text = String.format("%d d %d h",
                                min / 1440, (min % 1440) / 60, (min % 1440) % 60);
                    } else {
                        text = String.format("%d d %d h %d m",
                                min / 1440, (min % 1440) / 60, (min % 1440) % 60);
                    }
                } else if (min >= 60) {
                    if (min % 60 == 0) {
                        text = String.format("%d h", min / 60, min % 60);
                    } else {
                        text = String.format("%d h %d m", min / 60, min % 60);
                    }
                } else {
                    text = String.format("%d m", min);
                }
            } else {
                time.setTimeInMillis(xDataStart + i * xDataDiv);
                text = formatter.format(time.getTime());
            }
            x = xStart.x + i * xDiv - TIME_TEXT_WIDTH / 2;
            y = xStart.y + TIME_TEXT_HEIGHT;
            g2.drawString(text, x, y);

            if (text.equals(preText)) {
                doubTime = true;
            }
            preText = text;

            if (displayDateBelow && status != STATUS_SORTED_FLOW) {
                if ((i == 0 || time.get(Calendar.DAY_OF_MONTH) != previousTime.get(Calendar.DAY_OF_MONTH))
                        && status != STATUS_COMPARING) {  //!isComparing() ) {
                    text = dateFormatter.format(time.getTime());
                    y += TIME_TEXT_HEIGHT;
                    g2.drawString(text, x, y);

                    previousTime.setTimeInMillis(time.getTimeInMillis());
                }
            }
        } // for loop
    }

    private void setYAxises() {      
        for (int i = 0; i < yAxises.size(); i++) {
            
            if(status == STATUS_COMPARING){
                if(selectedChannelDatas != null && selectedChannelDatas.size() > 0){
                    ViewChannelData vcd = selectedChannelDatas.get(0);
                    if(i != vcd.yAxisIndex){
                        continue;
                    }
                }
            } 
            
       
            GeneralPath yAxis = yAxises.get(i);
            yAxis.reset();

            if (viewOptions.yDisableds[i]) {
                continue;
            }

            if (viewOptions.yAutomatics[i]) {
                numOfYSteps[i] = DEFAULT_Y_STEPS;
            } else {
                numOfYSteps[i] = viewOptions.ySteps[i];
            }
            yDivs[i] = yLength / numOfYSteps[i];

            // get data start and end value ( min and max )
            if (viewOptions.yAutomatics[i]) {

//                if (showCurrentAsFlow && MeasurementUnit.IsCurrentUnit(viewOptions.yUnits[i])) {
                if (showCurrentAsFlow && (MeasurementUnit.IsCurrentUnit(viewOptions.yUnits[i])
                        || MeasurementUnit.IsPowerUnit(viewOptions.yUnits[i]))) {
                    alterYAxisSettingsToShowCurrentAsFlow(i);
                    yDataStarts[i] = getRound(yDataStarts[i], false);
                    yDataEnds[i] = getRound(yDataEnds[i], true);
                } else {
                    for (int j = 0; j < selectedChannelDatas.size(); j++) {
                        ViewChannelData vcd = selectedChannelDatas.get(j);
                        if (viewOptions.yUnits[i].compareTo(vcd.unit) == 0) {
                            yDataStarts[i] = viewOptions.minValues[j];
                            if (viewOptions.minValues[j] < 0
                                    && (MeasurementUnit.IsCurrentUnit(vcd.unit)
                                    || MeasurementUnit.IsPressureUnit(vcd.unit))) {
                                yDataStarts[i] = 0;
                            }
                            yDataEnds[i] = viewOptions.maxValues[j];
                            //                         System.out.println("viewOptions.maxValues["+j+"]="+viewOptions.maxValues[j]+"=="+"[i]="+i);
                            break;
                        }
                    }

                    // make the data start and end value reasonable
                    yDataStarts[i] = getRound(yDataStarts[i], false);
                    yDataEnds[i] = getRound(yDataEnds[i], true);
                }
            } else {

                //modify on 20100521.
                yDataStarts[i] = viewOptions.yFroms[i];
                yDataEnds[i] = viewOptions.yTos[i];
//                 for( int j = 0; j < selectedChannelDatas.size(); j++ ) {
//                    ViewChannelData vcd = selectedChannelDatas.get(j);
//                    if ( viewOptions.yUnits[i].compareTo( vcd.unit ) == 0 ) {
//                        yDataStarts[i] = viewOptions.minValues[j];
//                        if(viewOptions.yFroms[i] < yDataStarts[i] ){
//                            yDataStarts[i] = viewOptions.yFroms[i];
//                        }
////                        if ( yDataStarts[i] < 0 &&
////                                ( MeasurementUnit.IsCurrentUnit( vcd.unit ) ||
////                                    MeasurementUnit.IsPressureUnit( vcd.unit )) )
////                                   yDataStarts[i] = 0;
//
//                        if(viewOptions.yTos[i] < viewOptions.maxValues[j] ){
//                            yDataEnds[i] = viewOptions.maxValues[j];
//                        } else {
//                            yDataEnds[i] = viewOptions.yTos[i];
//                        }
////                         System.out.println("GraphicPanel/setYAxises viewOptions.minValues["+j+"]="+viewOptions.minValues[j]+"=="+"[i]="+i);
////                         System.out.println("GraphicPanel/setYAxises viewOptions.maxValues["+j+"]="+viewOptions.maxValues[j]+"=="+"[i]="+i);
//                        break;
//                    }
//                }
//                  System.out.println("GraphicPanel/setYAxises viewOptions.minValues["+i+"]="+viewOptions.minValues[i]);
//                System.out.println("GraphicPanel/setYAxises viewOptions.maxValues["+i+"]="+viewOptions.maxValues[i]);
            }

            // if user choose to show current as flow, conversion required including max and min value, and unit
//            if ( showCurrentAsFlow && MeasurementUnit.IsCurrentUnit( viewOptions.yUnits[i] )) {
//                alterYAxisSettingsToShowCurrentAsFlow( i );
//                yDataStarts[i] = getRound( yDataStarts[i], false );
//                yDataEnds[i] = getRound( yDataEnds[i], true );
//            }

            // data division
            yDataLengths[i] = yDataEnds[i] - yDataStarts[i];
            yDataDivs[i] = yDataLengths[i] / numOfYSteps[i];

            // now start to draw
            yAxis.moveTo(yStarts[i].x, yStarts[i].y);
            yAxis.lineTo(yEnds[i].x, yEnds[i].y);
            //yAxis.lineTo( yEnds[i].x - ARROW_WIDTH, yEnds[i].y + ARROW_LENGTH );
            //yAxis.moveTo( yEnds[i].x + ARROW_WIDTH, yEnds[i].y + ARROW_LENGTH );
            //yAxis.lineTo( yEnds[i].x, yEnds[i].y );
            float x, y;
            int parameter; // the bars to the left or right
            if (i % 2 == 0) {
                parameter = -1;
                //xStart = yStarts[i];
            } else {
                parameter = 1;
                //xEnd = yStarts[i];
            }
            x = yStarts[i].x;
            for (int k = 0; k < numOfYSteps[i]; k++) {
                y = yStarts[i].y - yDivs[i] * k;
                yAxis.moveTo(x, y);
                yAxis.lineTo(x + parameter * DASH_LENGTH, y);
            }

        }
       
    }

    private void writeYAxisesText(Graphics2D g2) {
        if (selectedChannelDatas.size() == 0) {
            return;
        }

        float x, y;
        String text;
        int width;
        String formatString;

        g2.setFont(new Font(FONT_NAME, 1, 10));
        FontMetrics fm = g2.getFontMetrics();

        //int sw1 = g2.getFontMetrics().stringWidth(text);
        //int sw2 = fm.stringWidth(text);
        //width = (float)fm.getStringBounds(text, g2).getWidth();        

        for (int i = 0; i < yStarts.length; i++) {
            if (viewOptions.yDisableds[i]) {
                continue;
            }

            // calculate how long the y division text is
            int value = (int) yDataEnds[i];
            int resolution = viewOptions.yResolutions[i];
            double div = yDataDivs[i];
            while (Math.abs(div) < 1 && Math.abs(div) > 0) {
                for (int ten = 0; ten < resolution; ten++) {
                    div = div * 10;
                }
                if (Math.abs(div) < 1) {
                    resolution++;
                }
            }

            width = String.valueOf(value).length() + 2;
            formatString = "%" + width + "." + resolution + "f";

            for (int j = 0; j < numOfYSteps[i]; j++) {
                text = String.format(formatString, yDataStarts[i] + j * yDataDivs[i]);
                yOffSet[i] = Math.max(Y_AXIS_TITLE_GAP, fm.stringWidth(text));
                if (i % 2 == 0) //x = yStarts[i].x - width * SINGLE_TEXT_WIDTH;
                {
                    x = yStarts[i].x - fm.stringWidth(text) - 3 * DASH_LENGTH;
                } else {
                    x = yStarts[i].x + 3 * DASH_LENGTH;
                }

                y = yStarts[i].y - j * yDivs[i] - DASH_LENGTH;
                g2.drawString(text, x, y);
            }
        }
    }
    private boolean doubTime = false;

    private void writeTexts(Graphics2D g2) {
        float x, y;
        Texts texts = theCommonValue.getTexts();
        String s;
        int offSet = 40;

        g2.setColor(java.awt.Color.BLACK);
        g2.setFont(new Font(FONT_NAME, 1, 12));
        FontMetrics fm = g2.getFontMetrics();

        for (int i = 0; i < GUIConst.Y_AXIS_NUMBER; i++) {

            if (viewOptions.yDisableds[i]) {
                return;
            }
            if (showCurrentAsFlow && MeasurementUnit.IsCurrentUnit(viewOptions.yUnits[i])) {
                s = texts.ValueAxises[i] + " ( A --> " + showCurrentAsFlowUnit + " )";
            } else if (showCurrentAsFlow && MeasurementUnit.IsPowerUnit(viewOptions.yUnits[i])) {
                s = texts.ValueAxises[i] + " ( " + viewOptions.yUnits[i] + " --> " + showCurrentAsFlowUnit + " )";
            } else {
                s = texts.ValueAxises[i] + " ( " + viewOptions.yUnits[i] + " )";
            }
            if (i % 2 == 0) {
                //x = LEFT_MARGIN + Y_AXIS_WIDTH * i - offSet;
                //y = yStarts[i].y - ( yLength - s.length() * SINGLE_LARGE_TEXT_WIDTH ) / 2;

                x = yStarts[i].x - yOffSet[i] - Y_AXIS_TITLE_GAP;
                y = yStarts[i].y - (yLength - fm.stringWidth(s)) / 2;
                g2.rotate(-Math.PI / 2, x, y);
                g2.drawString(s, x, y);
                g2.rotate(Math.PI / 2, x, y);
            } else {
                //x = canvasW - RIGHT_MARGIN - Y_AXIS_WIDTH * ( i - 1 ) + offSet - 20;
                //y = yEnds[i].y + ( yLength - s.length() * SINGLE_LARGE_TEXT_WIDTH ) / 2 ;

                x = yStarts[i].x + yOffSet[i] + Y_AXIS_TITLE_GAP;
                y = yEnds[i].y + (yLength - fm.stringWidth(s)) / 2;
                g2.rotate(Math.PI / 2, x, y);
                g2.drawString(s, x, y);
                g2.rotate(-Math.PI / 2, x, y);
            }
        }

        // background loading text
//        int length = loadingText.length();
//        x = canvasStart.x + ( canvasW / 2 ) - GRAPHIC_REFRESH_TEXT_SIZE * length / 3;
//        y = canvasStart.y + ( canvasH / 2 ) - GRAPHIC_REFRESH_TEXT_SIZE;
//        g2.setFont( new Font( FONT_NAME, 1, GRAPHIC_REFRESH_TEXT_SIZE ));
//        g2.setColor( java.awt.Color.WHITE );
//        g2.drawString( loadingText, x, y );
    }

    // make value start from 0, or 10, or 100. 'up' means this is for max
    private double getRound(double value, boolean up) {
        if ((!up && value >= 0) || (up && value <= 0)) {
            return 0;
        }

        int tens = 1;
        int fives = 1;
        double result = value;
        for (int i = 0; i < 10; i++) {
            result = (Math.abs(result) / result) * fives;
            if (Math.abs(value) < fives) {
                break;
            }

            result = (Math.abs(result) / result) * tens;
            if (Math.abs(value) < tens) {
                break;
            }

            tens = tens * 10;
            fives = tens / 2;
        }

        return result;
    }

    private void drawGridLines(Graphics2D g2) {
        GeneralPath gridLine = new GeneralPath();
        float x, y;

        // horizontal lines
        //x = rightYAxisX;
        x = xEnd.x;
        for (int i = 1; i < numOfYSteps[0]; i++) {
            y = xStart.y - i * yDivs[0];
            gridLine.moveTo(xStart.x, y);
            gridLine.lineTo(x, y);
        }
        // vertical lines
        for (int i = 1; i < numOfXStep; i++) {
            x = xStart.x + i * xDiv;
            gridLine.moveTo(x, yStarts[0].y);
            gridLine.lineTo(x, yEnds[0].y);
        }

        float[] dash = {2.0f};
        g2.setStroke(new BasicStroke(0.5f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10.0f, dash, 0.0f));
        g2.setColor(java.awt.Color.LIGHT_GRAY);
        g2.draw(gridLine);
    }

//    private void reReadData() {
//        int size = selectedChannelDatas.size();
//        //DBController db = theCommonValue.getDataBase();
//        CSMDF db = theCommonValue.getDataBase();
//        if (!db.isOpened() || size < 1) {
//            return;
//        }
//
//        ViewChannelData vcd;
//        ArrayList<NMeasurementRecordLine> queryResult;
//        int queryResultSize = 0;
//        short srate;
//        int channelNos[] = new int[1];  // for query
//        //MeasurementRecord[][] queryResultRecords = new MeasurementRecord[size][];
//
//
//        for (int i = 0; i < size; i++) {
//            try {
//                vcd = selectedChannelDatas.get(i);
//
//                //queryResult = db.queryMeasurementRecord( vcd.chheader.cref );
//                channelNos[0] = vcd.chheader.ChannelNumber;
//                queryResult = db.queryMeasurementRecord(vcd.chheader.Pref, channelNos, -1, -1);
//                if (queryResult != null) {
//                    queryResultSize = queryResult.size();
//                } else {
//                    queryResultSize = 0;
//                }
//                vcd.values = new double[queryResultSize];
//                vcd.ids = new int[queryResultSize];
//                //vcData.times = new Timestamp[queryResultSize];
//                for (int j = 0; j < queryResultSize; j++) {
//                    //vcData.times[j] = new Timestamp(xDataStart.getTime() + queryResult.get(j).id * srate * 1000);
//                    vcd.ids[j] = queryResult.get(j).ID;
//                    vcd.values[j] = queryResult.get(j).Values[0];;
//                }
//                vcd.origIDs = vcd.ids; //reserved for zooming function
//                //vcd.origValues = vcd.values;  //reserved for zooming function
//
//                queryResult = null;
//                selectedChannelDatas.set(i, vcd); //  .add(vcd);
//            } catch (Exception e) {
//                e.printStackTrace();
//            }
//        }
//
//    }

//    private void setLines() {
//        //if ( isStackView ) {
//        if (status == STATUS_STACK_VIEW) {
//            setStackFlowLines();
//            return;
//        }
//
//        lines.clear();
//        int recordLength;
//        long startTime, endTime;
//        int startID, endID;
//        double srate;
//        double x, y;
//        double xRatio, yRatio;
//        double xActualStart;  // the start time of x axis normally don't match that of the protocol header
//        boolean previousDataValid; // see if previous data is valid, if yes, then draw lines, no, then dont draw 
//        int recordSteps;  // if user choose using average value
//        //boolean startPointNotDefine;  // flag showing if start point is defined
//        double convertCurrentToFlowRatio = 1;  // flow unit ratio to 'showCurrentAsFlowUnit'  
//
//        //add by be on 20110308.---begin
//        boolean previousYDataIsBound = false;
//        //---------------------- end
//
//        for (ViewChannelData vcd : selectedChannelDatas) {
//            if (vcd.ids == null || vcd.ids.length == 0) {
//                continue;
//            }
//            GeneralPath line = new GeneralPath();
//
//            boolean oneChannelYIsBound = false;//add by be, on 20110308.
//
//            //double airDeliveryRatio = 0;
//            double value;
//            Compressor compressor = new Compressor();
//            boolean convertCurrent = false;
//
//            // find out how many records to average for 1 point
//            switch (viewOptions.useAverage) {
//                case ViewOptions.AVERAGE_15_MINUTE:
//                    recordSteps = 15 * 60 / vcd.sampleRate;
//                    break;
//                case ViewOptions.AVERAGE_1_HOUR:
//                    recordSteps = 60 * 60 / vcd.sampleRate;
//                    break;
//                case ViewOptions.AVERAGE_1_MINUTE:
//                    recordSteps = 60 / vcd.sampleRate;
//                    break;
//                //v3-13: provide more choices for "Use average value"
//                //1,5,10,15,20,30,45 and 60 minutes.
//                //add on 20091020.be.
//                case ViewOptions.AVERAGE_5_MINUTE:
//                    recordSteps = ViewOptions.AVERAGE_5_MINUTE * 60 / vcd.sampleRate;
//                    break;
//                case ViewOptions.AVERAGE_10_MINUTE:
//                    recordSteps = ViewOptions.AVERAGE_10_MINUTE * 60 / vcd.sampleRate;
//                    break;
//                case ViewOptions.AVERAGE_20_MINUTE:
//                    recordSteps = ViewOptions.AVERAGE_20_MINUTE * 60 / vcd.sampleRate;
//                    break;
//                case ViewOptions.AVERAGE_30_MINUTE:
//                    recordSteps = ViewOptions.AVERAGE_30_MINUTE * 60 / vcd.sampleRate;
//                    break;
//                case ViewOptions.AVERAGE_45_MINUTE:
//                    recordSteps = ViewOptions.AVERAGE_45_MINUTE * 60 / vcd.sampleRate;
//                    break;
//
//                default:
//                    recordSteps = 1;
//                    break;
//            }
//            if (recordSteps < 1) {
//                recordSteps = 1;
//            }
//
//
//            srate = vcd.sampleRate * 1000;
//            xRatio = (xEnd.x - xStart.x) * srate / xDataLength;
//            //xActualStart = ( vcd.startTimeMilli - xDataStart ) / srate * xRatio + xStart.x;
//
//            // find out actual start and end id
//            //startTime = viewOptions.startTime.getTime();
//            //endTime = viewOptions.endTime.getTime();
//            startTime = xDataStart;
//            /*
//             * switch ( theCommonValue.getReportType() ) { case
//             * CommonValue.REPORT_TYPE_DAY: endTime = startTime +
//             * ViewOptions.ONE_DAY_MILLS; break; case
//             * CommonValue.REPORT_TYPE_WEEK: endTime = startTime +
//             * ViewOptions.ONE_WEEK_MILLS; break; case
//             * CommonValue.REPORT_TYPE_MONTH: endTime = startTime +
//             * ViewOptions.ONE_MONTH_MILLS; break; case
//             * CommonValue.REPORT_TYPE_PERIOD: endTime = xDataEnd; break;
//             * default: endTime = startTime + ViewOptions.ONE_DAY_MILLS;
//            }
//             */
//            endTime = xDataEnd;
//            if (startTime > vcd.endTimeMilli || endTime < vcd.startTimeMilli) {
//                continue;
//            }
//            startID = (int) ((startTime - vcd.startTimeMilli) / srate);
//            endID = (int) ((endTime - vcd.startTimeMilli) / srate);
//
//            recordLength = vcd.values.length;
//            for (int i = 0; i < recordLength; i++) {
//                if (vcd.ids[i] >= startID) {
//                    startID = i;
//                    break;
//                }
//            }
//            for (int i = recordLength - 1; i >= 0; i--) {
//                if (vcd.ids[i] <= endID) {
//                    endID = i;
//                    break;
//                }
//            }
//
//            xActualStart = ((vcd.startTimeMilli + vcd.ids[startID] * srate) - xDataStart) / srate * xRatio + xStart.x;
//
//            
//
//            BigDecimal bdxActualStart = new BigDecimal(xActualStart);
//            BigDecimal bdxStart = new BigDecimal(xStart.x);
//            BigDecimal bdxEnd = new BigDecimal(xEnd.x);
//            if (bdxActualStart.compareTo(bdxStart) < 0) {
//                xActualStart = xStart.x;
//            }
////            BigDecimal bdxActualStart = new BigDecimal(xActualStart);
////            BigDecimal bdxStart = new BigDecimal(xStart.x);
////            if(bdxActualStart.compareTo(bdxStart) < 0){
////                xActualStart = xStart.x;
////            }
//
//            // if this is a current channel and user choose to display current as flow, the current values have to be 
//            // converted to flow values based on compressor setting
//            if (showCurrentAsFlow && MeasurementUnit.IsCurrentUnit(vcd.unit)) {
//                compressor = findOutLinkingCompressor(vcd.chheader);
//                if (compressor != null) {
//                    //double fullLoadUnLoadCurrentDelta = compressor.FullLoadCurrentThreshold - compressor.UnLoadCurrentThreshold; 
//                    //if ( fullLoadUnLoadCurrentDelta > 0 )
//                    //  airDeliveryRatio = ( compressor.FullLoadAirDelivery - compressor.UnLoadAirDelivery ) / fullLoadUnLoadCurrentDelta;                    
//                    convertCurrent = true;
////                    for ( int i = startID; i <= endID; i++ ) {
////                        vcd.values[i] = airDeliveryRatio * ( vcd.values[i] - compressor.UnLoadCurrentThreshold );
////                    }
//                    if (compressor.Type == Compressor.COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
//                        convertCurrentToFlowRatio = MeasurementUnit.RatioToM3PerHour(compressor.VFAirDeliveryUnit)
//                                / MeasurementUnit.RatioToM3PerHour(showCurrentAsFlowUnit);
//                    } else {
//                        convertCurrentToFlowRatio = MeasurementUnit.RatioToM3PerHour(compressor.AirDeliveryUnit)
//                                / MeasurementUnit.RatioToM3PerHour(showCurrentAsFlowUnit);
//                    }
//                }
//            }
////System.out.println( "full load air " + compressor.FullLoadAirDelivery + " " + compressor.AirDeliveryUnit + "  " + compressor.FullLoadCurrentThreshold );            
//
//            // to the beginning
//            //x =  vcd.ids[startID] * xRatio +xActualStart;
//            x = xActualStart;
//            yRatio = yLength / yDataLengths[vcd.yAxisIndex];
//            // see if it's invalid
//            value = vcd.values[startID];
//            if (value == CSMDF.INVALID_MEASUREMENT_VALUE
//                    || value == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
//                y = 0;
//                previousDataValid = false;
//            } else {
//                if (convertCurrent) {
//                    value = VFConst.calculateFlowBasedOnCurrent(value, compressor) * convertCurrentToFlowRatio;
//                }
//
//                y = yStarts[vcd.yAxisIndex].y - (value - yDataStarts[vcd.yAxisIndex]) * yRatio;
//
//
//               
//                BigDecimal INVALID_BIG = new BigDecimal(0.0);
//                BigDecimal bdyActualStart;
//                try {
//                    bdyActualStart = new BigDecimal(y);
//                } catch (NumberFormatException nfe) {
//                    bdyActualStart = INVALID_BIG;
//                }
//
//                BigDecimal bdyStart = new BigDecimal(yStarts[vcd.yAxisIndex].y);
//                BigDecimal bdyEnd = new BigDecimal(yEnds[vcd.yAxisIndex].y);
//
//                if (bdyActualStart.compareTo(bdyStart) > 0) {
//                    y = yStarts[vcd.yAxisIndex].y;
//                    if (!previousYDataIsBound) {
//                        oneChannelYIsBound = true;
//                    } else {
//                        oneChannelYIsBound = false;
//                    }
//                    previousYDataIsBound = true;
//                } else if (bdyActualStart.compareTo(bdyEnd) < 0) {
//                    y = yEnds[vcd.yAxisIndex].y;
//                    if (!previousYDataIsBound) {
//                        oneChannelYIsBound = true;
//                    } else {
//                        oneChannelYIsBound = false;
//                    }
//                    previousYDataIsBound = true;
//                } else {
//                    oneChannelYIsBound = false;
//                    previousYDataIsBound = false;
//                }
//                // ---------------- end
//
//                previousDataValid = true;
//            }
//            line.moveTo(x, y);
//            vcd.startPoint.setLocation(x, y);
//
//            int beginID = vcd.ids[startID];
//            int previousID = beginID;
//            if (viewOptions.useAverage == ViewOptions.AVERAGE_NONE) {
//                for (int i = startID + 1; i <= endID; i++) {
//                    // temp: for ( int i = startID + 1; i <= endID; i+= 100 ) {
//                    x = (vcd.ids[i] - beginID) * xRatio + xActualStart;
//                    if (x > rightYAxisX) {
//                        break;
//                    }
//
//                   
//                    if (x < 0) {
//                        x = xStart.x;
//                    } else {
//                        //  fix the line out of bounds.
//                        BigDecimal bdxCalStart = new BigDecimal(x);
//                        if (bdxCalStart.compareTo(bdxStart) < 0) {
//                            x = xStart.x;
//                        }
//                        if (bdxCalStart.compareTo(bdxEnd) > 0) {
//                            x = xEnd.x;
//                        }
//
//                    }
//                    // ------------------------- end
//
//                    value = vcd.values[i];
//                    // see if it's invalid
//                    if (value == CSMDF.INVALID_MEASUREMENT_VALUE || value == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
////System.out.println( " " + ( new Timestamp( vcd.startTimeMilli + vcd.ids[i] * vcd.sampleRate * 1000 )) + "   "  + value + "  " + vcd.unit  );
//                        y = 0;
//                        previousDataValid = false;
//                        //line.moveTo( x, y );
//                    } else {
//                        if (convertCurrent) {
//                            value = VFConst.calculateFlowBasedOnCurrent(value, compressor) * convertCurrentToFlowRatio;
//                        }
//
//                        y = yStarts[vcd.yAxisIndex].y - (value - yDataStarts[vcd.yAxisIndex]) * yRatio;
//
//
//                      
//                        BigDecimal INVALID_BIG = new BigDecimal(0.0);
//                        BigDecimal bdyActualStart;
//                        try {
//                            bdyActualStart = new BigDecimal(y);
//                        } catch (NumberFormatException nfe) {
//                            bdyActualStart = INVALID_BIG;
//                        }
//
//                        BigDecimal bdyStart = new BigDecimal(yStarts[vcd.yAxisIndex].y);
//                        BigDecimal bdyEnd = new BigDecimal(yEnds[vcd.yAxisIndex].y);
//                        if (bdyActualStart.compareTo(bdyStart) > 0) {
//                            y = yStarts[vcd.yAxisIndex].y;
//                            if (!previousYDataIsBound) {
//                                oneChannelYIsBound = true;//add by be, on 20100907.
//                            } else {
//                                oneChannelYIsBound = false;
//                            }
//                            previousYDataIsBound = true;
//                        } else if (bdyActualStart.compareTo(bdyEnd) < 0) {
//                            y = yEnds[vcd.yAxisIndex].y;
//                            if (!previousYDataIsBound) {
//                                oneChannelYIsBound = true;//add by be, on 20100907.
//                            } else {
//                                oneChannelYIsBound = false;
//                            }
//                            previousYDataIsBound = true;
//                        } else {
//                            oneChannelYIsBound = false;//add by be, on 20100907.
//                            previousYDataIsBound = false;
//                        }
//                        // ---------------- end
//
//                        if (previousDataValid && vcd.ids[i] - previousID == 1) {
////                            line.lineTo( x, y );
//                            if (!oneChannelYIsBound && previousYDataIsBound) {
//                                line.moveTo(x, y);
//                            } else {
//                                line.lineTo(x, y);
//                            }
//                        } else {
//                            line.moveTo(x, y);
//                        }
//                        previousDataValid = true;
//                    }
//                    previousID = vcd.ids[i];
//                } // for loop
//            } else {
//                // use average value
//                double sum;
//                int step;
//                boolean currentDataValid;
//                int numOfValidValue;
//                int i = startID + 1;
//                while (i < endID) {
//                    sum = 0;
//                    numOfValidValue = 0;
//                    currentDataValid = false;
//                    for (step = 1; (step <= recordSteps && i + step <= endID); step++) {
//                        value = vcd.values[i];
//                        if (value != CSMDF.INVALID_MEASUREMENT_VALUE
//                                && value != CSMDF.OVERANGE_MEASUREMENT_VALUE) {
//                            if (convertCurrent) {
//                                value = VFConst.calculateFlowBasedOnCurrent(value, compressor) * convertCurrentToFlowRatio;
//                            }
//
//                            sum += value;
//                            numOfValidValue += 1;
//                            currentDataValid = true;
//                            //i += step;
//                        } else {
//                            /*
//                             * if ( step > 1 ) { // already had some
//                             * //currentDataValid = true; } else { //i += 1;
//                             * //currentDataValid = false; }
//                            //break;
//                             */
//                        }
//                        i += 1;
//                    } // for step loop
//                    if (currentDataValid) {
//                        x = (vcd.ids[i] - beginID) * xRatio + xActualStart;
//                        if (x > rightYAxisX) {
//                            break;
//                        }
//
//
//                      
//                        if (x < 0) {
//                            x = xStart.x;
//                        } else {
//                            //  fix the line out of bounds.
//                            BigDecimal bdxCalStart = new BigDecimal(x);
//                            if (bdxCalStart.compareTo(bdxStart) < 0) {
//                                x = xStart.x;
//                            }
//                            if (bdxCalStart.compareTo(bdxEnd) > 0) {
//                                x = xEnd.x;
//                            }
//
//                        }
//                        // ------------------------- end
//
//                        y = yStarts[vcd.yAxisIndex].y - (sum / numOfValidValue - yDataStarts[vcd.yAxisIndex]) * yRatio;
//
//                       
//                        BigDecimal INVALID_BIG = new BigDecimal(0.0);
//                        BigDecimal bdyActualStart;
//                        try {
//                            bdyActualStart = new BigDecimal(y);
//                        } catch (NumberFormatException nfe) {
//                            bdyActualStart = INVALID_BIG;
//                        }
//
//                        BigDecimal bdyStart = new BigDecimal(yStarts[vcd.yAxisIndex].y);
//                        BigDecimal bdyEnd = new BigDecimal(yEnds[vcd.yAxisIndex].y);
//                        if (bdyActualStart.compareTo(bdyStart) > 0) {
//                            y = yStarts[vcd.yAxisIndex].y;
//                            if (!previousYDataIsBound) {
//                                oneChannelYIsBound = true;
//                            } else {
//                                oneChannelYIsBound = false;
//                            }
//                            previousYDataIsBound = true;
//                        } else if (bdyActualStart.compareTo(bdyEnd) < 0) {
//                            y = yEnds[vcd.yAxisIndex].y;
//                            if (!previousYDataIsBound) {
//                                oneChannelYIsBound = true;
//                            } else {
//                                oneChannelYIsBound = false;
//                            }
//                            previousYDataIsBound = true;
//                        } else {
//                            oneChannelYIsBound = false;
//                            previousYDataIsBound = false;
//                        }
//                        // ---------------- end
//
//                        if (previousDataValid) {
////                            line.lineTo( x, y );
//                            if (!oneChannelYIsBound && previousYDataIsBound) {
//                                line.moveTo(x, y);
//                            } else {
//                                line.lineTo(x, y);
//                            }
//                        } else {
//                            line.moveTo(x, y);
//                        }
//                    }
//                    previousDataValid = currentDataValid;
//                }  // while loop
//            }
//
//            lines.add(line);
//        }
////        System.out.println("GraphicPanel/ setlines lines.size="+lines.size());
////         System.out.println("GraphicPanel/setlines selectedChannelDatas.size="+selectedChannelDatas.size());
//    }

    private void setStackFlowLines() {

//        lines.clear();
//        if(!cycle){
            lines.clear();
//        }
        int recordLength;
        long startTime, endTime;
        int startID, endID;
        double srate;
        double x, y;
        double xRatio, yRatio;
        double xActualStart;  // the start time of x axis normally don't match that of the protocol header
        boolean previousDataValid; // see if previous data is valid, if yes, then draw lines, no, then dont draw 
        int recordSteps;  // if user choose using average value
        //boolean startPointNotDefine;  // flag showing if start point is defined
        double convertCurrentToFlowRatio = 1;  // flow unit ratio to 'showCurrentAsFlowUnit'  


        //add by be on 20110308.---begin
        boolean previousYDataIsBound = false;
        //---------------------- end

        double[] stackValues;
        double[] preX;
        double[] preY;
        // determin longest stackValue array size
        int stackValueSize = 0;
        for (ViewChannelData vcd : selectedChannelDatas) {
//            System.out.print("vcd" + vcd);
            if (vcd != null) {
                if (vcd.values.length > stackValueSize) {
                    stackValueSize = vcd.values.length;
                }
            }
        }
        stackValues = new double[stackValueSize];
        preX = new double[stackValueSize];
        preY = new double[stackValueSize];

//         for (ViewChannelData vcd : selectedChannelDatas) {
//            
//           key = vcd.pref + vcd.chheader.ChannelNumber;
//           line = lines.get(key);
//           if(line == null){
//               lines.put(key, new GeneralPath());
//               line = lines.get(key);
//           }
        
        long key ;
        GeneralPath line = new GeneralPath();
        int size = selectedChannelDatas.size();
        //for ( ViewChannelData vcd : selectedChannelDatas ) {
        for (int viewChannelNo = 0; viewChannelNo < size ; viewChannelNo++) {
            ViewChannelData vcd = selectedChannelDatas.get(viewChannelNo);
            ViewChannelData previousVCD = null;
            
            if (showCurrentAsFlow && MeasurementUnit.IsCurrentUnit(vcd.unit)){
                if(isCurrentHasPowerChannelBaseOnCompressor(vcd.chheader)){
                    continue;
                }
           }
            
            if (viewChannelNo > 0) {
                previousVCD = selectedChannelDatas.get(viewChannelNo - 1);
            }

            if (vcd.ids == null || vcd.ids.length == 0) {
                continue;
            }
//            GeneralPath line = new GeneralPath();
            key = vcd.pref + vcd.chheader.ChannelNumber;
            line = lines.get(key);
            if(line == null){
               lines.put(key, new GeneralPath());
               line = lines.get(key);
            }

            boolean oneChannelYIsBound = false;//add by be, on 20110308.

            //double airDeliveryRatio = 0;
            double value;
            Compressor compressor = new Compressor();
            boolean convertCurrent = false;
            boolean convertPower = false;
            boolean isStackValue = false;

            if ((MeasurementUnit.IsCurrentUnit(vcd.unit) && showCurrentAsFlow)
                    || (MeasurementUnit.IsPowerUnit(vcd.unit) && showCurrentAsFlow)
                    || (MeasurementUnit.IsFlowRateUnit(vcd.unit) && !showCurrentAsFlow)) {
                isStackValue = true;
            }

            // find out how many records to average for 1 point
            switch (viewOptions.useAverage) {
                case ViewOptions.AVERAGE_15_MINUTE:
                    recordSteps = 15 * 60 / vcd.sampleRate;
                    break;
                case ViewOptions.AVERAGE_1_HOUR:
                    recordSteps = 60 * 60 / vcd.sampleRate;
                    break;
                case ViewOptions.AVERAGE_1_MINUTE:
                    recordSteps = 60 / vcd.sampleRate;
                    break;
                case ViewOptions.AVERAGE_5_MINUTE:
                    recordSteps = ViewOptions.AVERAGE_5_MINUTE * 60 / vcd.sampleRate;
                    break;
                case ViewOptions.AVERAGE_10_MINUTE:
                    recordSteps = ViewOptions.AVERAGE_10_MINUTE * 60 / vcd.sampleRate;
                    break;
                case ViewOptions.AVERAGE_20_MINUTE:
                    recordSteps = ViewOptions.AVERAGE_20_MINUTE * 60 / vcd.sampleRate;
                    break;
                case ViewOptions.AVERAGE_30_MINUTE:
                    recordSteps = ViewOptions.AVERAGE_30_MINUTE * 60 / vcd.sampleRate;
                    break;
                case ViewOptions.AVERAGE_45_MINUTE:
                    recordSteps = ViewOptions.AVERAGE_45_MINUTE * 60 / vcd.sampleRate;
                    break;
                default:
                    recordSteps = 1;
                    break;
            }
            if (recordSteps < 1) {
                recordSteps = 1;
            }


            srate = vcd.sampleRate * 1000;
            xRatio = (xEnd.x - xStart.x) * srate / xDataLength;
            //xActualStart = ( vcd.startTimeMilli - xDataStart ) / srate * xRatio + xStart.x;

            // find out actual start and end id
            //startTime = viewOptions.startTime.getTime();
            //endTime = viewOptions.endTime.getTime();
            startTime = xDataStart;
            /*
             * switch ( theCommonValue.getReportType() ) { case
             * CommonValue.REPORT_TYPE_DAY: endTime = startTime +
             * ViewOptions.ONE_DAY_MILLS; break; case
             * CommonValue.REPORT_TYPE_WEEK: endTime = startTime +
             * ViewOptions.ONE_WEEK_MILLS; break; case
             * CommonValue.REPORT_TYPE_MONTH: endTime = startTime +
             * ViewOptions.ONE_MONTH_MILLS; break; case
             * CommonValue.REPORT_TYPE_PERIOD: endTime = xDataEnd; break;
             * default: endTime = startTime + ViewOptions.ONE_DAY_MILLS;
            }
             */
            endTime = xDataEnd;
            if (startTime > vcd.endTimeMilli || endTime < vcd.startTimeMilli) {
                continue;
            }
            startID = (int) ((startTime - vcd.startTimeMilli) / srate);
            endID = (int) ((endTime - vcd.startTimeMilli) / srate);

            recordLength = vcd.values.length;
//            for (int i = 0; i < recordLength; i++) {
//                if (vcd.ids[i] >= startID) {
//                    startID = i;
//                    break;
//                }
//            }
//            for (int i = recordLength - 1; i >= 0; i--) {
//                if (vcd.ids[i] <= endID) {
//                    endID = i;
//                    break;
//                }
//            }

            startID = 0;
            endID = recordLength - 1;
            
            xActualStart = ((vcd.startTimeMilli + vcd.ids[startID] * srate) - xDataStart) / srate * xRatio + xStart.x;

          
            BigDecimal bdxActualStart = new BigDecimal(xActualStart);
            BigDecimal bdxStart = new BigDecimal(xStart.x);
//            BigDecimal bdxEnd = new BigDecimal(xEnd.x);
            if (bdxActualStart.compareTo(bdxStart) < 0) {
                xActualStart = xStart.x;
            }

            // if this is a current channel and user choose to display current as flow, the current values have to be 
            // converted to flow values based on compressor setting
            if (showCurrentAsFlow && MeasurementUnit.IsCurrentUnit(vcd.unit)) {
                compressor = findOutLinkingCompressor(vcd.chheader, vcd.unit);
                if (compressor != null) {
                    //double fullLoadUnLoadCurrentDelta = compressor.FullLoadCurrentThreshold - compressor.UnLoadCurrentThreshold; 
                    //if ( fullLoadUnLoadCurrentDelta > 0 )
                    //  airDeliveryRatio = ( compressor.FullLoadAirDelivery - compressor.UnLoadAirDelivery ) / fullLoadUnLoadCurrentDelta;                    
                    convertCurrent = true;
//                    for ( int i = startID; i <= endID; i++ ) {
//                        vcd.values[i] = airDeliveryRatio * ( vcd.values[i] - compressor.UnLoadCurrentThreshold );
//                    }
                    if (compressor.Type == Compressor.COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
                        convertCurrentToFlowRatio = MeasurementUnit.RatioToM3PerHour(compressor.VFAirDeliveryUnit)
                                / MeasurementUnit.RatioToM3PerHour(showCurrentAsFlowUnit);
                    } else {
                        convertCurrentToFlowRatio = MeasurementUnit.RatioToM3PerHour(compressor.AirDeliveryUnit)
                                / MeasurementUnit.RatioToM3PerHour(showCurrentAsFlowUnit);
                    }
                }
            }else if(showCurrentAsFlow && MeasurementUnit.IsPowerUnit(vcd.unit)){
                
                compressor = findOutLinkingCompressor(vcd.chheader, vcd.unit);
                if (compressor != null) {
                    convertPower = true;

                    if (compressor.Type == Compressor.COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
                        convertCurrentToFlowRatio = MeasurementUnit.RatioToM3PerHour(compressor.VFAirDeliveryUnit)
                                / MeasurementUnit.RatioToM3PerHour(showCurrentAsFlowUnit);
                    } else {
                        convertCurrentToFlowRatio = MeasurementUnit.RatioToM3PerHour(compressor.AirDeliveryUnit)
                                / MeasurementUnit.RatioToM3PerHour(showCurrentAsFlowUnit);
                    }
                }
                
            }
//System.out.println( "full load air " + compressor.FullLoadAirDelivery + " " + compressor.AirDeliveryUnit + "  " + compressor.FullLoadCurrentThreshold );            

            // to the beginning
            //x =  vcd.ids[startID] * xRatio +xActualStart;
            x = xActualStart;
            yRatio = yLength / yDataLengths[vcd.yAxisIndex];
            // see if it's invalid
            value = vcd.values[startID];
            if (value == CSMDF.INVALID_MEASUREMENT_VALUE
                    || value == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                y = yStarts[vcd.yAxisIndex].y;

                line.moveTo(x, y);
                previousDataValid = false;
            } else {
                if (convertCurrent) {
                    value = VFConst.calculateFlowBasedOnCurrent(value, compressor) * convertCurrentToFlowRatio;
                }else if(convertPower){
                    value = VFConst.calculateFlowBasedOnPower(value, compressor) * convertCurrentToFlowRatio;
                }

                if (isStackValue) {
                    value = value + stackValues[startID];
                    stackValues[startID] = value;
                }

                y = yStarts[vcd.yAxisIndex].y - (value - yDataStarts[vcd.yAxisIndex]) * yRatio;


              
//                BigDecimal INVALID_BIG = new BigDecimal(0.0);
//                BigDecimal bdyActualStart;
//                try {
//                    bdyActualStart = new BigDecimal(y);
//                } catch (NumberFormatException nfe) {
//                    bdyActualStart = INVALID_BIG;
//                }
//
//                BigDecimal bdyStart = new BigDecimal(yStarts[vcd.yAxisIndex].y);
//                BigDecimal bdyEnd = new BigDecimal(yEnds[vcd.yAxisIndex].y);

                if (y > yStarts[vcd.yAxisIndex].y) {
                    y = yStarts[vcd.yAxisIndex].y;
                    if (!previousYDataIsBound) {
                        oneChannelYIsBound = true;
                    } else {
                        oneChannelYIsBound = false;
                    }
                    previousYDataIsBound = true;
                } else if (y < yEnds[vcd.yAxisIndex].y) {
                    y = yEnds[vcd.yAxisIndex].y;
                    if (!previousYDataIsBound) {
                        oneChannelYIsBound = true;
                    } else {
                        oneChannelYIsBound = false;
                    }
                    previousYDataIsBound = true;
                } else {
                    oneChannelYIsBound = false;
                    previousYDataIsBound = false;
                }
                // ---------------- end
                if (isStackValue) {
                    line.moveTo(x, yStarts[vcd.yAxisIndex].y);
                    line.lineTo(x, y);
                } else {
                    line.moveTo(x, y);
                }
                previousDataValid = true;
            }
            vcd.startPoint.setLocation(x, y);

            int beginID = vcd.ids[startID];
            int previousID = beginID;
            if (viewOptions.useAverage == ViewOptions.AVERAGE_NONE) {
               
                for (int i = (startID+1) ; i <= endID; i++) {
                                                        
                    // temp: for ( int i = startID + 1; i <= endID; i+= 100 ) {
                    x = (vcd.ids[i] - beginID) * xRatio + xActualStart;
                    if (x > rightYAxisX) {
                        break;
                    }

                    //add on 20100712.Be -------- begin
                    if (x < 0) {
                        x = xStart.x;
                    } else {
                        //  fix the line out of bounds.
//                        BigDecimal bdxCalStart = new BigDecimal(x);
                        if (x < xStart.x) {
                            x = xStart.x;
                        }
                        if (x > xEnd.x) {
                            x = xEnd.x;
                        }

                    }
                    // ------------------------- end

                    value = vcd.values[i];
                    // see if it's invalid
                    if (value == CSMDF.INVALID_MEASUREMENT_VALUE || value == CSMDF.OVERANGE_MEASUREMENT_VALUE
                            || stackValues[i] == CSMDF.INVALID_MEASUREMENT_VALUE || stackValues[i] == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
//System.out.println( " " + ( new Timestamp( vcd.startTimeMilli + vcd.ids[i] * vcd.sampleRate * 1000 )) + "   "  + value + "  " + vcd.unit  );
                        y = yStarts[vcd.yAxisIndex].y;

                        if (!previousDataValid) {
                            line.moveTo(x, y);
                        } else {
                            line.lineTo(x, y);
//                             line.moveTo( x, y );
                        }
                        previousDataValid = false;
//                         line.lineTo( x, y );
//                         line.moveTo( x, y );
                    } else {

                        if (convertCurrent) {
                            value = VFConst.calculateFlowBasedOnCurrent(value, compressor) * convertCurrentToFlowRatio;
                        }else if(convertPower){
                            value = VFConst.calculateFlowBasedOnPower(value, compressor) * convertCurrentToFlowRatio;
                        }

                        if (isStackValue) {
                            value = value + stackValues[i];
                            stackValues[i] = value;
                        }

                        y = yStarts[vcd.yAxisIndex].y - (value - yDataStarts[vcd.yAxisIndex]) * yRatio;


                      
//                        BigDecimal INVALID_BIG = new BigDecimal(0.0);
//                        BigDecimal bdyActualStart;
//                        try {
//                            bdyActualStart = new BigDecimal(y);
//                        } catch (NumberFormatException nfe) {
//                            bdyActualStart = INVALID_BIG;
//                        }
//
//                        BigDecimal bdyStart = new BigDecimal(yStarts[vcd.yAxisIndex].y);
//                        BigDecimal bdyEnd = new BigDecimal(yEnds[vcd.yAxisIndex].y);

                        if (y > yStarts[vcd.yAxisIndex].y) {
                            y = yStarts[vcd.yAxisIndex].y;
                            if (!previousYDataIsBound) {
                                oneChannelYIsBound = true;
                            } else {
                                oneChannelYIsBound = false;
                            }
                            previousYDataIsBound = true;
                        } else if (y < yEnds[vcd.yAxisIndex].y) {
                            y = yEnds[vcd.yAxisIndex].y;
                            if (!previousYDataIsBound) {
                                oneChannelYIsBound = true;
                            } else {
                                oneChannelYIsBound = false;
                            }
                            previousYDataIsBound = true;
                        } else {
                            oneChannelYIsBound = false;
                            previousYDataIsBound = false;
                        }
                        // ---------------- end

                        if (!previousDataValid) {
                            if (isStackValue) {
                                line.moveTo(x, yStarts[vcd.yAxisIndex].y);
                                line.lineTo(x, y);
                            } else {
                                line.moveTo(x, y);
                            }
                            previousDataValid = true;
                        } else {
                            line.lineTo(x, y);
                        }
//                        if ( previousDataValid && vcd.ids[i] - previousID == 1 )
//                            line.lineTo( x, y );
//                        else
//                            line.moveTo( x, y );
//                        previousDataValid = true;
                    }
                    previousID = vcd.ids[i];
                } // for loop
            } else {
                // use average value
                double sum;
                int step;
                boolean currentDataValid;
                int numOfValidValue;
                int i = startID ;
                while (i < endID) {
                    sum = 0;
                    numOfValidValue = 0;
                    currentDataValid = false;
                    for (step = 1; (step <= recordSteps && i < endID); step++) {
                        value = vcd.values[i];
                        if (value != CSMDF.INVALID_MEASUREMENT_VALUE
                                && value != CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                            if (convertCurrent) {
                                value = VFConst.calculateFlowBasedOnCurrent(value, compressor) * convertCurrentToFlowRatio;
                            }else if(convertPower){
                                value = VFConst.calculateFlowBasedOnPower(value, compressor) * convertCurrentToFlowRatio;
                            }

                            sum += value;
                            numOfValidValue += 1;
                            currentDataValid = true;
                            //i += step;
                        } else {
                            /*
                             * if ( step > 1 ) { // already had some
                             * //currentDataValid = true; } else { //i += 1;
                             * //currentDataValid = false; }
                            //break;
                             */
                        }
                        i += 1;
                    } // for step loop
                    if (currentDataValid) {
                        x = (vcd.ids[i] - beginID) * xRatio + xActualStart;
                        if (x > rightYAxisX) {
                            break;
                        }

                        //modified on 20130514.Be -------- begin
                        if (x < 0) {
                            x = xStart.x;
                        } else {
                            //  fix the line out of bounds.
//                            BigDecimal bdxCalStart = new BigDecimal(x);
                            if (x < xStart.x) {
                                x = xStart.x;
                            }
                            if (x > xEnd.x) {
                                x = xEnd.x;
                            }

                        }
                        // ------------------------- end

                        value = sum / numOfValidValue;

                        if (isStackValue) {
                            if (stackValues[i] != CSMDF.INVALID_MEASUREMENT_VALUE
                                    && stackValues[i] != CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                                value = value + stackValues[i];
                                stackValues[i] = value;
                            }
                        }

                        y = yStarts[vcd.yAxisIndex].y - (value - yDataStarts[vcd.yAxisIndex]) * yRatio;

                       
//                        BigDecimal INVALID_BIG = new BigDecimal(0.0);
//                        BigDecimal bdyActualStart;
//                        try {
//                            bdyActualStart = new BigDecimal(y);
//                        } catch (NumberFormatException nfe) {
//                            bdyActualStart = INVALID_BIG;
//                        }
//
//                        BigDecimal bdyStart = new BigDecimal(yStarts[vcd.yAxisIndex].y);
//                        BigDecimal bdyEnd = new BigDecimal(yEnds[vcd.yAxisIndex].y);

                        if (y > yStarts[vcd.yAxisIndex].y) {
                            y = yStarts[vcd.yAxisIndex].y;
                            if (!previousYDataIsBound) {
                                oneChannelYIsBound = true;
                            } else {
                                oneChannelYIsBound = false;
                            }
                            previousYDataIsBound = true;
                        } else if (y < yEnds[vcd.yAxisIndex].y) {
                            y = yEnds[vcd.yAxisIndex].y;
                            if (!previousYDataIsBound) {
                                oneChannelYIsBound = true;
                            } else {
                                oneChannelYIsBound = false;
                            }
                            previousYDataIsBound = true;
                        } else {
                            oneChannelYIsBound = false;
                            previousYDataIsBound = false;
                        }
                        // ---------------- end

                        if (previousDataValid) {
                            line.lineTo(x, y);
                        } else {
                            if (isStackValue) {
                                line.moveTo(x, yStarts[vcd.yAxisIndex].y);
                                line.lineTo(x, y);
                            } else {
                                line.moveTo(x, y);
                            }
                        }
                    } else {
                        if (!previousDataValid) {
                            line.moveTo(x, yStarts[vcd.yAxisIndex].y);
                        } else {
                            line.lineTo(x, yStarts[vcd.yAxisIndex].y);
                        }
                    }
                    previousDataValid = currentDataValid;
                }  // while loop
            }
//            line.lineTo( x, xEnd.y );
//            lines.add(line);
        }
    }

    // this is for refreshing. purpose is to make background text show and hide
    private void refreshRepaint(boolean showBackgroundText) {
        if (showBackgroundText) {
            loadingText = GRAPHIC_REFRESH_TEXT;
        }
        //repaint();
        Graphics2D g2 = (Graphics2D) getGraphics();
        // the background string
        int length = loadingText.length();
        //if ( length > 0 ) {
        float x, y;
        x = canvasStart.x + (canvasW / 2) - GRAPHIC_REFRESH_TEXT_SIZE * length / 4;
        y = canvasStart.y + (canvasH / 3);
        g2.setFont(new Font(FONT_NAME, 1, GRAPHIC_REFRESH_TEXT_SIZE));
        g2.setColor(java.awt.Color.GREEN);
        g2.drawString(loadingText, x, y);
        //}*/
        // paint( getGraphics() );

        //loadingText = "";
    }
   
    public void paint(Graphics g) {
//System.out.println( "painting " + loadingText + "   "  + ( new Timestamp( System.currentTimeMillis() ) )  );                            
        try {
            super.paint(g);

            Graphics2D g2 = (Graphics2D) g;
            g2.draw(xAxis);
            writeXAxisText(g2);

            for (GeneralPath yAxis : yAxises) {
                g2.draw(yAxis);
            }
            writeYAxisesText(g2);

            writeTexts(g2);

            // grid
            drawGridLines(g2);

            //g2.setStroke( new BasicStroke( 1.0f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10.0f, null, -1f ));
            float dash[] = {10.0f};
            //for ( int i = 0; i < lines.size(); i++ ) {

            // move all current lines to draw first in case stack view and display as flow
            ArrayList<GeneralPath> toDrawFirst = new ArrayList<GeneralPath>();
            ArrayList<GeneralPath> toDrawNext = new ArrayList<GeneralPath>();
            ArrayList<ViewChannelData> firstVCDs = new ArrayList<ViewChannelData>();
            ArrayList<ViewChannelData> nextVCDs = new ArrayList<ViewChannelData>();
            
            if(selectedChannelDatas == null){
                lines.clear();
            }else{
                GeneralPath line = new GeneralPath();
                ViewChannelData vcd ;
                for (int i = selectedChannelDatas.size() - 1; i >= 0; i--) {
                    vcd = selectedChannelDatas.get(i);
//                for ( ViewChannelData vcd : selectedChannelDatas ) {
                    try {
                        //GeneralPath line = lines.get(i);
                        //ViewChannelData vcd = selectedChannelDatas.get(i);
                        line = lines.get(vcd.pref+vcd.chheader.ChannelNumber);  
                        if(line == null){
                            continue;
                        }
                        if (MeasurementUnit.IsCurrentUnit(vcd.unit)) {
                            toDrawFirst.add(line);
                            firstVCDs.add(vcd);
                        } else {
                            toDrawNext.add(line);
                            nextVCDs.add(vcd);
                        }
                    }catch( Exception e ){

                    }
                }
            }
//            for (int i = lines.size() - 1; i >= 0; i--) {
//                GeneralPath line = lines.get(i);
//                ViewChannelData vcd = selectedChannelDatas.get(i);
//                if (MeasurementUnit.IsCurrentUnit(vcd.unit)) {
//                    toDrawFirst.add(line);
//                    firstVCDs.add(vcd);
//                } else {
//                    toDrawNext.add(line);
//                    nextVCDs.add(vcd);
//                }
//            }
            for (int i = 0; i < toDrawNext.size(); i++) {
                toDrawFirst.add(toDrawNext.get(i));
                firstVCDs.add(nextVCDs.get(i));
            }

            ///for ( int i = lines.size() - 1; i >= 0; i-- ) {
            for (int i = 0; i < toDrawFirst.size(); i++) {
                try {
                    //GeneralPath line = lines.get(i);
                    //ViewChannelData vcd = selectedChannelDatas.get(i);
                    GeneralPath line = toDrawFirst.get(i);
                    ViewChannelData vcd = firstVCDs.get(i);
                    g2.setColor(vcd.color);
                    if (vcd.lineStyle == ViewChannel.DASHED_LINE) {
                        g2.setStroke(new BasicStroke(2.0f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10.0f, dash, 0.0f));
                    } else {
                        g2.setStroke(new BasicStroke(1.0f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10.0f, null, -1f));
                    }
                    //g2.drawString( vcd.lineStartDateText, vcd.startPoint.x, vcd.startPoint.y - 10 );

                    //if ( isStackView ) {
                    if (status == STATUS_STACK_VIEW
                            && ((MeasurementUnit.IsCurrentUnit(vcd.unit) && showCurrentAsFlow)
                            || (MeasurementUnit.IsPowerUnit(vcd.unit) && showCurrentAsFlow)
                            || (MeasurementUnit.IsFlowRateUnit(vcd.unit) && !showCurrentAsFlow))) {
                        //if ( i == 0 ) {
                        Rectangle2D bound = line.getBounds2D();
                        line.lineTo(bound.getMaxX(), xEnd.y);
                        line.lineTo(bound.getMinX(), xStart.y);
                        //} else {
                        //GeneralPath previous = (GeneralPath) lines.get( i - 1 ).clone();
                        //line.append( previous, true );
                        //}
                        //line.closePath();
//                    g2.draw( line );
                        g2.fill(line);
                    } else {
                        g2.draw(line);

                    }
                } catch (Exception e) {
                }
            }
          
            if (showBaseLine) {
                drawBaseLine(g2);
            }

            //added by be on 20101013. Richard's issue(see emial on 12/Oct/2010)------ begin
            Date time = new Date();
            DateFormat formatter = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT, Locale.ENGLISH);            
            time.setTime(viewOptions.startTime.getTime());
            jLabelFrom.setText(formatter.format(time));
            time.setTime(viewOptions.endTime.getTime());
            jLabelTo.setText(formatter.format(time));
                   
//            cycle = false;
//            for(ViewChannelData vcd : selectedChannelDatas){
//                if(vcd.calculatedValueCount > 0 && (vcd.calculatedValueCount < vcd.totalValueCount)){                   
//                    vcd.nextPage = true;
//                   
//                    vcd.queryStartID = vcd.queryEndID;
//                    if((vcd.queryEndID + oneTimeGetValues) >= vcd.numOfSamples){
//                        vcd.queryEndID = (int) vcd.numOfSamples;                      
//                    }else{
//                        vcd.queryEndID = vcd.queryEndID + this.oneTimeGetValues;                     
//                    }
//                    if(vcd.queryEndID > vcd.viewEndID){
//                        vcd.queryEndID = vcd.viewEndID;
//                    }
//                    
////                    vcd.queryEndID++;
////                    vcd.calculatedValueCount += (vcd.queryEndID - vcd.queryStartID);                   
//                    
//                }else{
//                    vcd.nextPage = false;
//                }
//            }
//            
//            for(ViewChannelData vcd : selectedChannelDatas){
//                if(vcd.nextPage){
//                     cycle = true;
//                }
//            }
//            
//            if(cycle){ 
//                refreshRepaint(true);
//                this.readDataBaseOnLimitedBuffer();
//                this.reSetLine();
//                this.repaint();
//            }else{
                //add  on  20100521.
                loadingText = "";
//            }
            
           
            //----------- end

           
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void propertyChange(final PropertyChangeEvent event) {
        if (event.getPropertyName().compareTo(CommonValue.PROTOCOL_HEADER_LIST) == 0
                || event.getPropertyName().compareTo(CommonValue.LOAD_REPORT) == 0) {
            Date time = new Date();
            DateFormat formatter = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT, Locale.ENGLISH);
            viewOptions = theCommonValue.getViewOptions();
            time.setTime(viewOptions.startTime.getTime());
            jLabelFrom.setText(formatter.format(time));
            time.setTime(viewOptions.endTime.getTime());
            jLabelTo.setText(formatter.format(time));

            final Texts texts = theCommonValue.getTexts().clone();

            //isComparing = false;
            //isStackView = false;
            if (event.getPropertyName().compareTo(CommonValue.LOAD_REPORT) == 0 && event.getNewValue() != null) {
                if ((Integer) event.getNewValue() == STATUS_STACK_VIEW) {
                    status = STATUS_STACK_VIEW;
                } else {
                    status = STATUS_NORMAL;
                }
            } else {
                status = STATUS_NORMAL;
            }
            myZoomStack.clear();

            Timer refreshTimer = new Timer();
            refreshTimer.schedule((new TimerTask() {

                public void run() {
                    loadNewGraphTask();
                    if (event.getPropertyName().compareTo(CommonValue.LOAD_REPORT) == 0) {
                        leakStat = theCommonValue.getLeakStatistics();
                        if (leakStat.getLeakLineData() > 0) {
                            calculateBaseLinePosition();
                            showBaseLine = true;
                        }
                        theCommonValue.setTexts(texts);
                    }
                }
            }), 10);
        }

        if (event.getPropertyName().compareTo(CommonValue.SELECTED_CHANNEL) == 0) {
            //isComparing = false;
            //isStackView = false;
//            status = STATUS_NORMAL; //deleted on 20110309.be.because If you have chosen stack view?it is not possible
            //to change scaling of y-axis. This is necessary if customer wants to show certain
            //details of graphs which e.g. are in the very low range of the y-axis. Otherwise
            //you do not see any details.

//            Timer refreshTimer = new Timer();
//            refreshTimer.schedule( ( new TimerTask() {
//                public void run() {
            loadNewGraphTask();
//                }
//            }), 10 );
        }

        if (event.getPropertyName().compareTo(CommonValue.VIEW_OPTIONS) == 0) {
            //doCompare( false );

            refreshRepaint(true);
            
            viewOptions = theCommonValue.getViewOptions();

            calculatePoints();
            setXAxis();
            setYAxises();
            updateLengendLabels();
            
            if(status == STATUS_COMPARING){
            
                ViewChannelData selectedVCD = origSelectedChannelDatas.get(comparingChannelIndex);
                if (setComparingViewChannelDatas(selectedVCD)) {
                    compareGraphRepaint(true);
                }

            }else{
            

                int size = selectedChannelDatas.size();
                for(int i = 0 ; i < size; i++){
                    this.initQueryId(selectedChannelDatas.get(i),viewOptions.startTime.getTime(),viewOptions.endTime.getTime());
                }

                this.readDataBaseOnLimitedBuffer();

    //            setLines();
                this.reSetLine();

                if (showBaseLine) {
                    calculateLeakLineData();
                }

                repaint();
            }
        }

        if (event.getPropertyName().compareTo(CommonValue.TEXTS) == 0) {
            Texts texts = theCommonValue.getTexts();
            jLabelTitle.setText(texts.Title);
            String text = "";
            for (int i = 0; i < CommonValue.MAX_LENGEND_NUMBER; i++) {
                ((JLabel) jPanelLegendTop.getComponent(i)).setText(texts.Legends[i]);
                try {
                    text = texts.Legends[i];
                    this.selectedChannelDatas.get(i).fullChannelName = text;
                } catch (Exception e) {
                }
            }
            repaint();
        }

        if (event.getPropertyName().compareTo(CommonValue.REPORT_TYPE) == 0) {
            if (((Integer) event.getOldValue()).intValue() == ((Integer) event.getNewValue()).intValue()) {
                return;
            }

//            doCompare(false);
            if (theCommonValue.getReportType() != CommonValue.REPORT_TYPE_PERIOD) {
                myZoomStack.clear();
            }

            setXAxis();
            updateLengendLabels();
            
            if(status == STATUS_COMPARING){
            
                ViewChannelData selectedVCD = origSelectedChannelDatas.get(comparingChannelIndex);
                if (setComparingViewChannelDatas(selectedVCD)) {
                    compareGraphRepaint(true);
                }

            }else{
            
                int size = selectedChannelDatas.size();
                for(int i = 0 ; i < size; i++){
                    this.initQueryId(selectedChannelDatas.get(i),viewOptions.startTime.getTime(),viewOptions.endTime.getTime());
                }

                this.readDataBaseOnLimitedBuffer();
    //            setLines();
                this.reSetLine();
                repaint();
            }
        }

        if (event.getPropertyName().compareTo(CommonValue.SHOW_CURRENT_AS_FLOW) == 0) {
            showCurrentAsFlow = (Boolean) event.getNewValue();
//             System.out.println("==showCurrentAsFlow1111=="+showCurrentAsFlow);
            if (showCurrentAsFlow) {
//                 System.out.println("theCommonValue.getCompressors()size()="+theCommonValue.getCompressors().size());
//                 if( theCommonValue.getCompressors() == null || theCommonValue.getCompressors().isEmpty() ) {
//                        JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_setup_compressor_settings_or_change_analyzes_type_to_'Flow_Analyzes'.") );
//                        return ;
//                 }
                // setup the flow unit of what it should be
//                System.out.println("====");
                showCurrentAsFlowUnit = theCommonValue.getCompressors().get(0).AirDeliveryUnit;
//                 System.out.println("====showCurrentAsFlowUnit="+showCurrentAsFlowUnit);
            }

            boolean hasCurrentChannel = false;
            for (ViewChannel vcd : selectedChannelDatas) {
                
//                 if(MeasurementUnit.IsCurrentUnit(vcd.unit) && showCurrentAsFlow){
//                    if(isCurrentHasPowerChannelBaseOnCompressor(vcd.chheader)){
//                        continue;
//                    }
//                }
                
                if (MeasurementUnit.IsCurrentUnit(vcd.unit) || MeasurementUnit.IsPowerUnit(vcd.unit)) {
                    hasCurrentChannel = true;
                    break;
                }
            }

            if (hasCurrentChannel) {
                setYAxises();
                //writeTexts(  )
//                setLines();
                updateLengendLabels();
                
                int size = selectedChannelDatas.size();
                for(int i = 0 ; i < size; i++){
                    this.initQueryId(selectedChannelDatas.get(i),viewOptions.startTime.getTime(),viewOptions.endTime.getTime());
                }

                this.readDataBaseOnLimitedBuffer();
                
                this.reSetLine();
                repaint();
            }

        }

    }

    /**
     * to be called when loading pheader changed, selected channels changed,
     * view options changed, etc.
     */
    private void loadNewGraphTask() {
        
        if(lines != null){
            lines.clear();
        }
        
        // disable displaying records at cursor function
        if (displayingRecordAtCursor) {
            jPanelCanvas.removeMouseMotionListener(displayRecordAtCursorListener);
        }

        showCurrentAsFlow = theCommonValue.isShowCurrentValuesAsFlow();
        System.out.println("loadNewGraphTask showCurrentAsFlow=" + showCurrentAsFlow);
        if (showCurrentAsFlow) // setup the flow unit of what it should be
        {
            showCurrentAsFlowUnit = theCommonValue.getCompressors().get(0).AirDeliveryUnit;
        }

        //refreshRepaint( true );      
        Timer backTimer = new Timer();
        backTimer.scheduleAtFixedRate((new TimerTask() {

            public void run() {
                //loadNewGraphTask();
                refreshRepaint(true);
                //if ( showBackgoundText ) showBackgoundText = false;
                //else showBackgoundText = true;
            }
            //private boolean showBackgoundText = true;
        }), 500, 500);

        viewOptions = theCommonValue.getViewOptions();

        selectedChannelDatas.clear();
        ArrayList<ViewChannel> selectedChannels = theCommonValue.getSelectedChannels();
        for (ViewChannel selectedChannel : selectedChannels) {
            ViewChannelData vcData = new ViewChannelData(selectedChannel);
            vcData.yAxisIndex = findYAxisIndex(selectedChannel);
            selectedChannelDatas.add(vcData);
        }

        calculatePoints();
        setXAxis();
        setYAxises();
        updateLengendLabels();

        //Reset draw graphic view method at 2013/05/06. Richard found a bug.
        //calculate the query start id and stop id.

        int size = selectedChannelDatas.size();
        for(int i = 0 ; i < size; i++){
            this.initQueryId(selectedChannelDatas.get(i),viewOptions.startTime.getTime(),viewOptions.endTime.getTime());
        }
        
        this.readDataBaseOnLimitedBuffer();
        this.reSetLine();
//        reReadData();
//        
//        setLines();

        //if ( showBaseLine ) 
        baseLine.setLine(xStart.x, xStart.y - DEFAULT_LEAKAGE_LINE_HEIGHT, rightYAxisX, xStart.y - DEFAULT_LEAKAGE_LINE_HEIGHT);
        //calculateLeakLineData();
        selectLeakStatCHHeader();

        //refreshTimer.cancel();
        backTimer.cancel();
        repaint();

        // restore displaying records at cursor function if necessary
        if (displayingRecordAtCursor) {
            jPanelCanvas.addMouseMotionListener(displayRecordAtCursorListener);
        }

    }
    /*
     * Reset draw graphic view method at 2013/05/06. Richard found a bug.
     * calculate the query start id and stop id.
     */
    //begin ==================================================================

    private final int maxMemorySizePerChannel = 30 * 1000 * 1000;//total max memory
    private final int oneTimeGetValues = maxMemorySizePerChannel/(8 + 4); //id is 4 byte, value is 8 byte

    private boolean initQueryId(ViewChannelData vcd, long viewStartTime, long viewEndTime) {
        vcd.reset();
        
        int sampleRate = vcd.sampleRate;
        int pages = 0;     
        int queryStartID = 0;
        int  queryEndID = 0;
        int onePageViewStartID = 0;
        int onePageViewEndID = 0;
        //viewOptions.startTime.getTime()
        //viewOptions.endTime.getTime()
        if (sampleRate > 0) {
            onePageViewStartID = (int) ((viewStartTime / 1000 - vcd.startTimeMilli / 1000 ) / sampleRate);
            onePageViewEndID = (int) (( viewEndTime / 1000  - vcd.startTimeMilli / 1000 ) / sampleRate);
        } else {
            onePageViewStartID = 0;
            onePageViewEndID = 0;
        }
        queryStartID = onePageViewStartID;
        queryEndID = onePageViewEndID; // ID start from 0.
        
        if(onePageViewStartID <= 0){
            queryStartID = 0;
        }
        if(onePageViewEndID <= 0){
            queryStartID = 0;
            queryEndID = 0;
            return false;
        }
        long numOfSample = (vcd.endTimeMilli / 1000 - vcd.startTimeMilli / 1000) / sampleRate;
        if(onePageViewStartID >= numOfSample){
             queryStartID = (int) numOfSample ; // ID start from 0.
             queryEndID = (int) numOfSample ;
             return false;
        }
        if(onePageViewEndID >= numOfSample){
            queryEndID = (int) numOfSample ;
        }
        
        int queryTotalIDs = 0;
        if (queryStartID > 0) {
            queryTotalIDs = queryEndID - queryStartID;
        } else {
            queryTotalIDs = queryEndID;
        }

//        oneTimeGetValues = oneTimeMemorySize / (myPHeader.NumOfChannels * 8 + 4);

        pages = queryTotalIDs / oneTimeGetValues;
        if (queryTotalIDs % oneTimeGetValues > 0) {
            pages += 1;
        }
      
        if(pages > 1){
             queryEndID = queryStartID + oneTimeGetValues;
        }else{
//            if((numOfSample - queryStartID) >= oneTimeGetValues ){
//                this.queryEndID = oneTimeGetValues;
//            }else{
//                this.queryEndID = numOfSample;
//            }
        }
//        if (pages < 2) {
//            this.queryStartID = onePageViewEndID - onePageIDs;
//            this.queryEndID = onePageViewEndID;
//
//        } else {
//            this.queryStartID = onePageViewEndID - onePageIDs;
//            this.queryEndID = oneTimeGetValues;
//        }
       
        vcd.queryEndID = queryEndID;
        vcd.queryStartID = queryStartID;      
        vcd.totalValueCount = queryTotalIDs;
        vcd.viewStartID = onePageViewStartID;
        vcd.viewEndID = onePageViewEndID;
      
        //get point about windows screen
//        vcd.screenPoint = ((int) java.awt.Toolkit.getDefaultToolkit().getScreenSize().width);

        int screenWidthPoint = canvasW; 
        
        /* check if one screen can draw all the data */
        boolean recalculateScreenWidthPoint = true;
        if(pages == 1){
            if(numOfSample <= screenWidthPoint){
                screenWidthPoint = (int) numOfSample;
                recalculateScreenWidthPoint = false;
            }
            
        }
        
        if(recalculateScreenWidthPoint){
        
            /*
            * calculate how many screen point need to draw when the query data no full on screen base on view start time 
            * and stop time, just for first page and last page will happen
            */ 
            if((vcd.viewStartID <= 0) && (vcd.viewEndID >= numOfSample)){
                screenWidthPoint = (int) (numOfSample) * screenWidthPoint / (vcd.viewEndID - vcd.viewStartID);                 
            }else if((vcd.viewStartID <= 0) && (vcd.viewEndID < numOfSample)){
                screenWidthPoint = vcd.viewEndID * screenWidthPoint / (vcd.viewEndID - vcd.viewStartID);
            }else if((vcd.viewStartID > 0) && (vcd.viewEndID >= numOfSample)){
                screenWidthPoint = ((int) (numOfSample) - vcd.viewStartID) * screenWidthPoint / (vcd.viewEndID - vcd.viewStartID); 
            }
        }
        vcd.screenPoint = screenWidthPoint;
        calculateIntervalGetMaxMinValue(vcd);
        
        return true;
    }
    
    
    /**
     * how many values to calculate the max and min value 
     * @return 
     */
    private void calculateIntervalGetMaxMinValue(ViewChannelData vcd){
        /* get point about windows screen */
        int screenWidthPoint = vcd.screenPoint;
        
//   System.out.println("calculateIntervalGetMaxMinValue/screenWidthPoint="+screenWidthPoint);
//System.out.println("calculateIntervalGetMaxMinValue/vcd.nextPointIndex="+vcd.nextPointIndex);
            
        if(screenWidthPoint > 0){
            
            /* base on view time, how many original data need to get from csd file */
            int viewTotalValues = vcd.totalValueCount;
        
            ArrayList realIntervalToCalculateMinMaxList = new ArrayList();
            boolean noNeedCalculatePointValue = false; //if draw all the data in this view
            
            /* one point need how many original data */
            int intervalToDrawOnePoint = viewTotalValues / screenWidthPoint;
            
            /* how many original data left */
            int leftValue = viewTotalValues % screenWidthPoint;
            
            /* calculate min and max value need how many original data */
            int intervalToCalculateMinMaxValue = 2 * intervalToDrawOnePoint;
           
            /* one point add one left vale, but in intervalToCalculateMinMaxValue can calculated min and 
             * max value, it fixs two point of screen */
            final int calculatedMinMaxValueFixScreenPoint = 2; 
            
            //error
            if(intervalToDrawOnePoint < 0){
                return ;
            }
            
            //no data
            if(intervalToDrawOnePoint == 0 && leftValue <= 0){
                return ;
            }
            
            if(intervalToDrawOnePoint == 0 || (intervalToDrawOnePoint == 1 && leftValue <= 0)){
                noNeedCalculatePointValue = true;
            }
            
            if(!noNeedCalculatePointValue){
                
//                /*
//                 * calculate how many screen point need to draw when the query data no full on screen base on view start time 
//                 * and stop time, just for first page and last page will happen
//                 */ 
//                if((vcd.viewStartID < 0 && (vcd.queryEndID == vcd.viewEndID)) ||
//                        ((vcd.queryStartID == vcd.viewStartID) && (vcd.queryEndID < vcd.viewEndID))){
//                    screenWidthPoint = (vcd.queryEndID - vcd.queryStartID) * screenWidthPoint / (vcd.viewEndID - vcd.viewStartID);
//                    intervalToDrawOnePoint = viewTotalValues / screenWidthPoint;
//                    leftValue = viewTotalValues % screenWidthPoint;
//                    intervalToCalculateMinMaxValue = 2 * intervalToDrawOnePoint;
//                    vcd.screenPoint = screenWidthPoint;
//                }
                
                //calculate how many data be used to calculate max/min value
                //check screen point if is odd number. if is, let the last value to the last point
                int leftPoint = screenWidthPoint % calculatedMinMaxValueFixScreenPoint;
                if(leftPoint > 0){
                    screenWidthPoint -= 1;
                    viewTotalValues -= 1;
                    
                    intervalToDrawOnePoint = viewTotalValues / screenWidthPoint;
                    leftValue = viewTotalValues % screenWidthPoint;
                    intervalToCalculateMinMaxValue = 2 * intervalToDrawOnePoint;
                }
                
                
                for(int i = screenWidthPoint; i > 0 ; ){
                    
                    if(leftValue > calculatedMinMaxValueFixScreenPoint){
                        realIntervalToCalculateMinMaxList.add(intervalToCalculateMinMaxValue + calculatedMinMaxValueFixScreenPoint);
                    }else{                       
                        realIntervalToCalculateMinMaxList.add(intervalToCalculateMinMaxValue + leftValue);                       
                    }
                    
                    i -= calculatedMinMaxValueFixScreenPoint;
                    leftValue -= calculatedMinMaxValueFixScreenPoint;
                    if(leftValue < 0){
                        leftValue = 0;
                    }
                }
                
                //if 
                if(leftPoint > 0){
                    realIntervalToCalculateMinMaxList.add(leftPoint);
                }
            }
            
            //set view channel
            vcd.setNoNeedCalculatePointValue(noNeedCalculatePointValue);
            if(vcd.getRealValueIntervalList() != null){
                vcd.getRealValueIntervalList().clear();
            }
            vcd.setRealValueIntervalList(realIntervalToCalculateMinMaxList);
        }else{
            //set view channel
            vcd.setNoNeedCalculatePointValue(true);
            if(vcd.getRealValueIntervalList() != null){
                vcd.getRealValueIntervalList().clear();
            }
            vcd.setRealValueIntervalList(null);
        }     
        
//           System.out.println("end calculateIntervalGetMaxMinValue/vcd.screenPoint="+vcd.screenPoint);
//System.out.println("end calculateIntervalGetMaxMinValue/vcd.nextPointIndex="+vcd.nextPointIndex);
//        System.out.println("calculateIntervalGetMaxMinValue vcd.screenPoint="+vcd.screenPoint);
    }
    
    /**
     * query data from csd file and calculated max/min value during one interval
     * @param vcd
     * @param db 
     */
    private void getData(ViewChannelData vcd, CSMDF db){
           
        if(vcd == null || db == null){
            return ;
        }
        
        long hpref = 0;
        int singleChVSize = 0;
       
        ArrayList valueList = new ArrayList();
        int channelNos[] = new int[1];   
        
        channelNos[0] = vcd.chheader.ChannelNumber;
        hpref = vcd.chheader.Pref;
        int singleChQueryStartID = vcd.queryStartID;
        int singleChQueryEndID = vcd.queryEndID;
        Hashtable<Long, ArrayList<Double>> queryResult = db.queryMeasurementRecordByOneLineWithRecordID(hpref, channelNos, singleChQueryStartID, vcd.queryEndID);
        if(queryResult == null){
            return ;
        }
        
        valueList = queryResult.get(hpref + channelNos[0]);
        
        //error
        if(valueList == null){
            return ;
        }
        
        singleChVSize = valueList.size() ;
        if(singleChVSize <= 0){
            return;
        }
             
        if(vcd.isNoNeedCalculatePointValue()){
 
            vcd.values = new double[singleChVSize];
            vcd.ids = new int[singleChVSize];
            for (int j = 0; j < singleChVSize; j++) {
                vcd.ids[j] = singleChQueryStartID + j;
                vcd.values[j] = (Double) (valueList.get(j));

            }

        }else{
            ArrayList<Integer> realValueIntervalList = vcd.getRealValueIntervalList();
            if(realValueIntervalList == null){
                return;
            }
            
            singleChVSize = vcd.screenPoint;
//            System.out.println("getData/singleChVSize="+singleChVSize);
//            System.out.println("getData/vcd.nextPointIndex="+vcd.nextPointIndex);
            vcd.values = new double[singleChVSize];
            vcd.ids = new int[singleChVSize];
            
            int len = realValueIntervalList.size();
            boolean isMinFirst = false;
            double maxValue = 0;
            double minValue = 0;
            int interval = 0;
            double value = 0;
            int valueStartId = 0;
            int valueEndId = 0;
            
            int pointIndex = 0;
            int calculatedValueCount = 0;
            int valueTotalId = vcd.totalValueCount;
            int intervalIndex = 0;
            
            while(calculatedValueCount < valueTotalId){   
                 for(int j = intervalIndex; j < len; j++){
                    interval = realValueIntervalList.get(j);
                    valueEndId += interval;

                    if(valueEndId > (singleChQueryEndID - singleChQueryStartID)){
                        singleChQueryEndID = singleChQueryStartID + valueStartId;                    
                        break;
                    }

                    //calculate max and min value in interval values
                    for(int k = valueStartId; k < valueEndId; k++){
                        value = (Double) (valueList.get(k));

                        if(k == valueStartId){
                            maxValue = value;
                            minValue = value;
                            isMinFirst = true;

                        }else{

                            if(minValue > value){
                                minValue = value;
                                isMinFirst = false;
                            }

                            if(maxValue < value){
                                maxValue = value;
                                isMinFirst = true;
                            }

                        }

                    }  

                    if(interval == 1){
                        vcd.ids[pointIndex] = singleChQueryStartID + valueStartId + interval;
                        vcd.values[pointIndex] = minValue;
                    }else{
                        //set min and max value into buffer
                        if(isMinFirst){                     
                            vcd.ids[pointIndex] = singleChQueryStartID + valueStartId + interval / 2;
                            vcd.values[pointIndex] = minValue;

                            vcd.ids[pointIndex + 1] = singleChQueryStartID + valueEndId;
                            vcd.values[pointIndex + 1] = maxValue;
                        }else{
                            vcd.ids[pointIndex] = singleChQueryStartID + valueStartId + interval / 2;
                            vcd.values[pointIndex] = maxValue;

                            vcd.ids[pointIndex + 1] = singleChQueryStartID + valueEndId;
                            vcd.values[pointIndex + 1] = minValue;
                        }
                    }

                    valueStartId += interval;
                    pointIndex = pointIndex + 2 ; //one cycle calculate two point(max and min value), index start from 0  
                    intervalIndex += 1;
                }

                vcd.queryEndID = singleChQueryEndID;
                calculatedValueCount += singleChQueryEndID - singleChQueryStartID;
                
                if(calculatedValueCount < valueTotalId){
                    vcd.queryStartID = vcd.queryEndID;
                    if((vcd.queryEndID + oneTimeGetValues) >= vcd.numOfSamples){
                        vcd.queryEndID = (int) vcd.numOfSamples;                      
                    }else{
                        vcd.queryEndID = vcd.queryEndID + this.oneTimeGetValues;                     
                    }
                    if(vcd.queryEndID > vcd.viewEndID){
                        vcd.queryEndID = vcd.viewEndID;
                    }
                    
                    singleChQueryStartID = vcd.queryStartID;
                    singleChQueryEndID = vcd.queryEndID;
                    isMinFirst = false;
                    maxValue = 0;
                    minValue = 0;
                    interval = 0;
                    value = 0;
                    valueStartId = 0;
                    valueEndId = 0;

                    queryResult = db.queryMeasurementRecordByOneLineWithRecordID(hpref, channelNos, singleChQueryStartID, vcd.queryEndID);
                   
                    if(queryResult == null){
                        break ;
                    }

                    valueList = queryResult.get(hpref + channelNos[0]);

                    //error
                    if(valueList == null){
                        break ;
                    }
                }
                
            }
                   
//            for(int j = vcd.nextIntervalIndex; j < len; j++){
//                interval = realValueIntervalList.get(j);
//                valueEndId += interval;
//                
//                if(valueEndId > (singleChQueryEndID - singleChQueryStartID)){
//                    singleChQueryEndID = singleChQueryStartID + valueStartId;                    
//                    break;
//                }
//                
//                //calculate max and min value in interval values
//                for(int k = valueStartId; k < valueEndId; k++){
//                    value = (Double) (valueList.get(k));
//
//                    if(k == valueStartId){
//                        maxValue = value;
//                        minValue = value;
//                        isMinFirst = true;
//
//                    }else{
//
//                        if(minValue > value){
//                            minValue = value;
//                            isMinFirst = false;
//                        }
//
//                        if(maxValue < value){
//                            maxValue = value;
//                            isMinFirst = true;
//                        }
//
//                    }
//                               
//                }  
//                
//                if(interval == 1){
//                    vcd.ids[vcd.nextPointIndex] = singleChQueryStartID + valueStartId + interval;
//                    vcd.values[vcd.nextPointIndex] = minValue;
//                }else{
//                    //set min and max value into buffer
//                    if(isMinFirst){                     
//                        vcd.ids[vcd.nextPointIndex] = singleChQueryStartID + valueStartId + interval / 2;
//                        vcd.values[vcd.nextPointIndex] = minValue;
//                        
//                        vcd.ids[vcd.nextPointIndex + 1] = singleChQueryStartID + valueEndId;
//                        vcd.values[vcd.nextPointIndex + 1] = maxValue;
//                    }else{
//                        vcd.ids[vcd.nextPointIndex] = singleChQueryStartID + valueStartId + interval / 2;
//                        vcd.values[vcd.nextPointIndex] = maxValue;
//                        
//                        vcd.ids[vcd.nextPointIndex + 1] = singleChQueryStartID + valueEndId;
//                        vcd.values[vcd.nextPointIndex + 1] = minValue;
//                    }
//                }
//        
//                valueStartId += interval;
//                vcd.nextPointIndex = vcd.nextPointIndex + 2 ; //one cycle calculate two point(max and min value), index start from 0  
//                vcd.nextIntervalIndex += 1;
//            }
   
        }      
        
//        vcd.queryEndID = singleChQueryEndID;
//        vcd.calculatedValueCount += singleChQueryEndID - singleChQueryStartID;
        queryResult = null;
        if(valueList != null){
            valueList.clear();
            valueList = null;
        }
        
    }
    
    /**
     * read data and make selected channel data which be used draw line 
     * @return 
     */
    private boolean readDataBaseOnLimitedBuffer(){

        if (selectedChannelDatas == null) {
            return false;
        }
       
        int size = selectedChannelDatas.size();
       
        CSMDF db = theCommonValue.getDataBase();
        if (!db.isOpened() || size < 1) {
            return false;
        }

        ViewChannelData vcd;

        for (int i = 0; i < size; i++) {
            try {
            vcd = selectedChannelDatas.get(i);

            getData(vcd, db) ;

            selectedChannelDatas.set(i, vcd); //  .add(vcd);
            } catch (Exception e) {
                e.printStackTrace();
                return false;
            }
        }
        
        if(status == STATUS_SORTED_FLOW){
            // sort the values of all view channel data
            double temp;
            for (ViewChannelData vcd_sort : selectedChannelDatas) {
                if (vcd_sort.values != null) {                   
                    Arrays.sort(vcd_sort.values);

                    // reverse it                 
                    for (int i = 0, j = vcd_sort.values.length - 1; i < (vcd_sort.values.length / 2); i++, j--) {
                        // swap the elements 
                        temp = vcd_sort.values[i];
                        vcd_sort.values[i] = vcd_sort.values[j];
                        vcd_sort.values[j] = temp;
                    }
                }
            }
        }
        
 
//             //---------------- old --------------------
//        
//               int size = selectedChannelDatas.size();
//        //DBController db = theCommonValue.getDataBase();
//        CSMDF db = theCommonValue.getDataBase();
//        if (!db.isOpened() || size < 1) {
//            return;
//        }
//
//        ViewChannelData vcd;
//        ArrayList<NMeasurementRecordLine> queryResult;
//        int queryResultSize = 0;
//        short srate;
//        int channelNos[] = new int[1];  // for query
//        //MeasurementRecord[][] queryResultRecords = new MeasurementRecord[size][];
//
//
//        for (int i = 0; i < size; i++) {
//            try {
//                vcd = selectedChannelDatas.get(i);
//
//                //queryResult = db.queryMeasurementRecord( vcd.chheader.cref );
//                channelNos[0] = vcd.chheader.ChannelNumber;
//                queryResult = db.queryMeasurementRecord(vcd.chheader.Pref, channelNos, -1, -1);
//                if (queryResult != null) {
//                    queryResultSize = queryResult.size();
//                } else {
//                    queryResultSize = 0;
//                }
//                vcd.values = new double[queryResultSize];
//                vcd.ids = new int[queryResultSize];
//                //vcData.times = new Timestamp[queryResultSize];
//                for (int j = 0; j < queryResultSize; j++) {
//                    //vcData.times[j] = new Timestamp(xDataStart.getTime() + queryResult.get(j).id * srate * 1000);
//                    vcd.ids[j] = queryResult.get(j).ID;
//                    vcd.values[j] = queryResult.get(j).Values[0];;
//                }
//                vcd.origIDs = vcd.ids; //reserved for zooming function
//                //vcd.origValues = vcd.values;  //reserved for zooming function
//
//                queryResult = null;
//                selectedChannelDatas.set(i, vcd); //  .add(vcd);
//            } catch (Exception e) {
//                e.printStackTrace();
//            }
//        }

             
             
             
        return true;
    }
    
    /**
     * draw lines
     * @return 
     */
    private boolean reSetLine(){
       
        if (status == STATUS_STACK_VIEW) {
            setStackFlowLines();
            return true;
        }

//        if(!cycle){
            lines.clear();
//        }
        int recordLength;
        long startTime, endTime;
        int startID, endID;
        double srate;
        double x, y;
        double xRatio, yRatio;
        double xActualStart;  // the start time of x axis normally don't match that of the protocol header
        boolean previousDataValid; // see if previous data is valid, if yes, then draw lines, no, then dont draw 
        int recordSteps;  // if user choose using average value
        //boolean startPointNotDefine;  // flag showing if start point is defined
        double convertCurrentToFlowRatio = 1;  // flow unit ratio to 'showCurrentAsFlowUnit'  

        //add by be on 20110308.---begin
        boolean previousYDataIsBound = false;
        //---------------------- end

        long key ;
        GeneralPath line = new GeneralPath();
        for (ViewChannelData vcd : selectedChannelDatas) {
            
           if (showCurrentAsFlow && MeasurementUnit.IsCurrentUnit(vcd.unit)){
                if(isCurrentHasPowerChannelBaseOnCompressor(vcd.chheader)){
                    continue;
                }
           }
            
           key = vcd.pref + vcd.chheader.ChannelNumber;
           line = lines.get(key);
           if(line == null){
               lines.put(key, new GeneralPath());
               line = lines.get(key);
           }
           
            if (vcd.ids == null || vcd.ids.length == 0) {
                continue;
            }
//            GeneralPath line = new GeneralPath();

            boolean oneChannelYIsBound = false;//add by be, on 20110308.

            //double airDeliveryRatio = 0;
            double value;
            Compressor compressor = new Compressor();
            boolean convertCurrent = false;
            boolean convertPower = false;

            // find out how many records to average for 1 point
            switch (viewOptions.useAverage) {
                case ViewOptions.AVERAGE_15_MINUTE:
                    recordSteps = 15 * 60 / vcd.sampleRate;
                    break;
                case ViewOptions.AVERAGE_1_HOUR:
                    recordSteps = 60 * 60 / vcd.sampleRate;
                    break;
                case ViewOptions.AVERAGE_1_MINUTE:
                    recordSteps = 60 / vcd.sampleRate;
                    break;
                //v3-13: provide more choices for "Use average value"
                //1,5,10,15,20,30,45 and 60 minutes.
                //add on 20091020.be.
                case ViewOptions.AVERAGE_5_MINUTE:
                    recordSteps = ViewOptions.AVERAGE_5_MINUTE * 60 / vcd.sampleRate;
                    break;
                case ViewOptions.AVERAGE_10_MINUTE:
                    recordSteps = ViewOptions.AVERAGE_10_MINUTE * 60 / vcd.sampleRate;
                    break;
                case ViewOptions.AVERAGE_20_MINUTE:
                    recordSteps = ViewOptions.AVERAGE_20_MINUTE * 60 / vcd.sampleRate;
                    break;
                case ViewOptions.AVERAGE_30_MINUTE:
                    recordSteps = ViewOptions.AVERAGE_30_MINUTE * 60 / vcd.sampleRate;
                    break;
                case ViewOptions.AVERAGE_45_MINUTE:
                    recordSteps = ViewOptions.AVERAGE_45_MINUTE * 60 / vcd.sampleRate;
                    break;

                default:
                    recordSteps = 1;
                    break;
            }
            if (recordSteps < 1) {
                recordSteps = 1;
            }


            srate = vcd.sampleRate * 1000;
            xRatio = (xEnd.x - xStart.x) * srate / xDataLength;
            //xActualStart = ( vcd.startTimeMilli - xDataStart ) / srate * xRatio + xStart.x;

            // find out actual start and end id
            //startTime = viewOptions.startTime.getTime();
            //endTime = viewOptions.endTime.getTime();
            startTime = xDataStart;
            /*
             * switch ( theCommonValue.getReportType() ) { case
             * CommonValue.REPORT_TYPE_DAY: endTime = startTime +
             * ViewOptions.ONE_DAY_MILLS; break; case
             * CommonValue.REPORT_TYPE_WEEK: endTime = startTime +
             * ViewOptions.ONE_WEEK_MILLS; break; case
             * CommonValue.REPORT_TYPE_MONTH: endTime = startTime +
             * ViewOptions.ONE_MONTH_MILLS; break; case
             * CommonValue.REPORT_TYPE_PERIOD: endTime = xDataEnd; break;
             * default: endTime = startTime + ViewOptions.ONE_DAY_MILLS;
            }
             */
            endTime = xDataEnd;
            if (startTime > vcd.endTimeMilli || endTime < vcd.startTimeMilli) {
                continue;
            }
//            startID = (int) ((startTime - vcd.startTimeMilli) / srate);
//            endID = (int) ((endTime - vcd.startTimeMilli) / srate);

            recordLength = vcd.values.length;
//            for (int i = 0; i < recordLength; i++) {
//                if (vcd.ids[i] >= startID) {
//                    startID = i;
//                    break;
//                }
//            }
//            for (int i = recordLength - 1; i >= 0; i--) {
//                if (vcd.ids[i] <= endID) {
//                    endID = i;
//                    break;
//                }
//            }

             startID = 0;
             endID = recordLength-1;
                
            xActualStart = ((vcd.startTimeMilli + vcd.ids[startID] * srate) - xDataStart) / srate * xRatio + xStart.x;

          
            BigDecimal bdxActualStart = new BigDecimal(xActualStart);
            BigDecimal bdxStart = new BigDecimal(xStart.x);
//            BigDecimal bdxEnd = new BigDecimal(xEnd.x);
            if (bdxActualStart.compareTo(bdxStart) < 0) {
                xActualStart = xStart.x;
            }
//            BigDecimal bdxActualStart = new BigDecimal(xActualStart);
//            BigDecimal bdxStart = new BigDecimal(xStart.x);
//            if(bdxActualStart.compareTo(bdxStart) < 0){
//                xActualStart = xStart.x;
//            }

            // if this is a current channel and user choose to display current as flow, the current values have to be 
            // converted to flow values based on compressor setting
            if (showCurrentAsFlow && MeasurementUnit.IsCurrentUnit(vcd.unit)) {
                compressor = findOutLinkingCompressor(vcd.chheader, vcd.unit);
                if (compressor != null) {
                    //double fullLoadUnLoadCurrentDelta = compressor.FullLoadCurrentThreshold - compressor.UnLoadCurrentThreshold; 
                    //if ( fullLoadUnLoadCurrentDelta > 0 )
                    //  airDeliveryRatio = ( compressor.FullLoadAirDelivery - compressor.UnLoadAirDelivery ) / fullLoadUnLoadCurrentDelta;                    
                    convertCurrent = true;
//                    for ( int i = startID; i <= endID; i++ ) {
//                        vcd.values[i] = airDeliveryRatio * ( vcd.values[i] - compressor.UnLoadCurrentThreshold );
//                    }
                    if (compressor.Type == Compressor.COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
                        convertCurrentToFlowRatio = MeasurementUnit.RatioToM3PerHour(compressor.VFAirDeliveryUnit)
                                / MeasurementUnit.RatioToM3PerHour(showCurrentAsFlowUnit);
                    } else {
                        convertCurrentToFlowRatio = MeasurementUnit.RatioToM3PerHour(compressor.AirDeliveryUnit)
                                / MeasurementUnit.RatioToM3PerHour(showCurrentAsFlowUnit);
                    }
                }
            }else if(showCurrentAsFlow && MeasurementUnit.IsPowerUnit(vcd.unit)){
                
                compressor = findOutLinkingCompressor(vcd.chheader, vcd.unit);
                if (compressor != null) {
                    
                    convertPower = true;

                    if (compressor.Type == Compressor.COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
                        convertCurrentToFlowRatio = MeasurementUnit.RatioToM3PerHour(compressor.VFAirDeliveryUnit)
                                / MeasurementUnit.RatioToM3PerHour(showCurrentAsFlowUnit);
                    } else {
                        convertCurrentToFlowRatio = MeasurementUnit.RatioToM3PerHour(compressor.AirDeliveryUnit)
                                / MeasurementUnit.RatioToM3PerHour(showCurrentAsFlowUnit);
                    }
                }
                
                
            }
//System.out.println( "full load air " + compressor.FullLoadAirDelivery + " " + compressor.AirDeliveryUnit + "  " + compressor.FullLoadCurrentThreshold );            

            // to the beginning
            //x =  vcd.ids[startID] * xRatio +xActualStart;
            x = xActualStart;
            yRatio = yLength / yDataLengths[vcd.yAxisIndex];
            // see if it's invalid
            value = vcd.values[startID];
            if (value == CSMDF.INVALID_MEASUREMENT_VALUE
                    || value == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                y = 0;
                previousDataValid = false;
            } else {
                if (convertCurrent) {
                    value = VFConst.calculateFlowBasedOnCurrent(value, compressor) * convertCurrentToFlowRatio;
                }else if(convertPower){
                    value = VFConst.calculateFlowBasedOnPower(value, compressor) * convertCurrentToFlowRatio;
                }

                y = yStarts[vcd.yAxisIndex].y - (value - yDataStarts[vcd.yAxisIndex]) * yRatio;

                BigDecimal INVALID_BIG = new BigDecimal(0.0);
                BigDecimal bdyActualStart;
                try {
                    bdyActualStart = new BigDecimal(y);
                } catch (NumberFormatException nfe) {
                    bdyActualStart = INVALID_BIG;
                }

                BigDecimal bdyStart = new BigDecimal(yStarts[vcd.yAxisIndex].y);
                BigDecimal bdyEnd = new BigDecimal(yEnds[vcd.yAxisIndex].y);

                if (bdyActualStart.compareTo(bdyStart) > 0) {
                    y = yStarts[vcd.yAxisIndex].y;
                    if (!previousYDataIsBound) {
                        oneChannelYIsBound = true;
                    } else {
                        oneChannelYIsBound = false;
                    }
                    previousYDataIsBound = true;
                } else if (bdyActualStart.compareTo(bdyEnd) < 0) {
                    y = yEnds[vcd.yAxisIndex].y;
                    if (!previousYDataIsBound) {
                        oneChannelYIsBound = true;
                    } else {
                        oneChannelYIsBound = false;
                    }
                    previousYDataIsBound = true;
                } else {
                    oneChannelYIsBound = false;
                    previousYDataIsBound = false;
                }
                // ---------------- end

                previousDataValid = true;
            }
            line.moveTo(x, y);
            vcd.startPoint.setLocation(x, y);

            int beginID = vcd.ids[startID];
            int previousID = beginID;
            
            if (viewOptions.useAverage == ViewOptions.AVERAGE_NONE) {
                for (int i = startID ; i <= endID; i++) {
                    // temp: for ( int i = startID + 1; i <= endID; i+= 100 ) {
                    x = (vcd.ids[i] - beginID) * xRatio + xActualStart;
                    if (x > rightYAxisX) {
                        break;
                    }

                   
                    if (x < 0) {
                        x = xStart.x;
                    } else {
                        //  fix the line out of bounds.
//                        BigDecimal bdxCalStart = new BigDecimal(x);
//                        if (bdxCalStart.compareTo(bdxStart) < 0) {
//                            x = xStart.x;
//                        }
//                        if (bdxCalStart.compareTo(bdxEnd) > 0) {
//                            x = xEnd.x;
//                        }
                        
                        if (x < xStart.x) {
                            x = xStart.x;
                        }
                        if (x > xEnd.x) {
                            x = xEnd.x;
                        }

                    }
                    // ------------------------- end

                    value = vcd.values[i];
                    // see if it's invalid
                    if (value == CSMDF.INVALID_MEASUREMENT_VALUE || value == CSMDF.OVERANGE_MEASUREMENT_VALUE) {
//System.out.println( " " + ( new Timestamp( vcd.startTimeMilli + vcd.ids[i] * vcd.sampleRate * 1000 )) + "   "  + value + "  " + vcd.unit  );
                        y = 0;
                        previousDataValid = false;
                        //line.moveTo( x, y );
                    } else {
                        if (convertCurrent) {
                            value = VFConst.calculateFlowBasedOnCurrent(value, compressor) * convertCurrentToFlowRatio;
                        }else if(convertPower){
                            value = VFConst.calculateFlowBasedOnPower(value, compressor) * convertCurrentToFlowRatio;
                        }

                        y = yStarts[vcd.yAxisIndex].y - (value - yDataStarts[vcd.yAxisIndex]) * yRatio;


                        
//                        BigDecimal INVALID_BIG = new BigDecimal(0.0);
//                        BigDecimal bdyActualStart;
//                        try {
//                            bdyActualStart = new BigDecimal(y);
//                        } catch (NumberFormatException nfe) {
//                            bdyActualStart = INVALID_BIG;
//                        }

//                        BigDecimal bdyStart = new BigDecimal(yStarts[vcd.yAxisIndex].y);
//                        BigDecimal bdyEnd = new BigDecimal(yEnds[vcd.yAxisIndex].y);
                        if (y > yStarts[vcd.yAxisIndex].y) {
                            y = yStarts[vcd.yAxisIndex].y;
                            if (!previousYDataIsBound) {
                                oneChannelYIsBound = true;//add by be, on 20100907.
                            } else {
                                oneChannelYIsBound = false;
                            }
                            previousYDataIsBound = true;
                        } else if (y < yEnds[vcd.yAxisIndex].y) {
                            y = yEnds[vcd.yAxisIndex].y;
                            if (!previousYDataIsBound) {
                                oneChannelYIsBound = true;//add by be, on 20100907.
                            } else {
                                oneChannelYIsBound = false;
                            }
                            previousYDataIsBound = true;
                        } else {
                            oneChannelYIsBound = false;//add by be, on 20100907.
                            previousYDataIsBound = false;
                        }
                        // ---------------- end

                        if (previousDataValid) {
//                            line.lineTo( x, y );
                            if (!oneChannelYIsBound && previousYDataIsBound) {
                                line.moveTo(x, y);
                            } else {
                                line.lineTo(x, y);
                            }
                        } else {
                            line.moveTo(x, y);
                        }
                        previousDataValid = true;
                    }
                    previousID = vcd.ids[i];
                    
                } // for loop
            } else {
                // use average value
                double sum;
                int step;
                boolean currentDataValid;
                int numOfValidValue;
                int i = startID ;
                while (i < endID) {
                    sum = 0;
                    numOfValidValue = 0;
                    currentDataValid = false;
                    for (step = 1; (step <= recordSteps && i < endID); step++) {
                        value = vcd.values[i];
                        if (value != CSMDF.INVALID_MEASUREMENT_VALUE
                                && value != CSMDF.OVERANGE_MEASUREMENT_VALUE) {
                            if (convertCurrent) {
                                value = VFConst.calculateFlowBasedOnCurrent(value, compressor) * convertCurrentToFlowRatio;
                            }else if(convertPower){
                                value = VFConst.calculateFlowBasedOnPower(value, compressor) * convertCurrentToFlowRatio;
                            }

                            sum += value;
                            numOfValidValue += 1;
                            currentDataValid = true;
                            //i += step;
                        } else {
                            /*
                             * if ( step > 1 ) { // already had some
                             * //currentDataValid = true; } else { //i += 1;
                             * //currentDataValid = false; }
                            //break;
                             */
                        }
                        i += 1;
                    } // for step loop
                    if (currentDataValid) {
                        x = (vcd.ids[i] - beginID) * xRatio + xActualStart;
                        if (x > rightYAxisX) {
                            break;
                        }


                       
                        if (x < 0) {
                            x = xStart.x;
                        } else {
                            //  fix the line out of bounds.
//                            BigDecimal bdxCalStart = new BigDecimal(x);
                            if (x < xStart.x) {
                                x = xStart.x;
                            }
                            if (x > xEnd.x) {
                                x = xEnd.x;
                            }

                        }
                        // ------------------------- end

                        y = yStarts[vcd.yAxisIndex].y - (sum / numOfValidValue - yDataStarts[vcd.yAxisIndex]) * yRatio;

                       
//                        BigDecimal INVALID_BIG = new BigDecimal(0.0);
//                        BigDecimal bdyActualStart;
//                        try {
//                            bdyActualStart = new BigDecimal(y);
//                        } catch (NumberFormatException nfe) {
//                            bdyActualStart = INVALID_BIG;
//                        }

//                        BigDecimal bdyStart = new BigDecimal(yStarts[vcd.yAxisIndex].y);
//                        BigDecimal bdyEnd = new BigDecimal(yEnds[vcd.yAxisIndex].y);
                        if (y > yStarts[vcd.yAxisIndex].y) {
                            y = yStarts[vcd.yAxisIndex].y;
                            if (!previousYDataIsBound) {
                                oneChannelYIsBound = true;
                            } else {
                                oneChannelYIsBound = false;
                            }
                            previousYDataIsBound = true;
                        } else if (y < yEnds[vcd.yAxisIndex].y) {
                            y = yEnds[vcd.yAxisIndex].y;
                            if (!previousYDataIsBound) {
                                oneChannelYIsBound = true;
                            } else {
                                oneChannelYIsBound = false;
                            }
                            previousYDataIsBound = true;
                        } else {
                            oneChannelYIsBound = false;
                            previousYDataIsBound = false;
                        }
                        // ---------------- end

                        if (previousDataValid) {
//                            line.lineTo( x, y );
                            if (!oneChannelYIsBound && previousYDataIsBound) {
                                line.moveTo(x, y);
                            } else {
                                line.lineTo(x, y);
                            }
                        } else {
                            line.moveTo(x, y);
                        }
                    }
                    previousDataValid = currentDataValid;
                }  // while loop
            }

//            vcd.ids = new int[0];
//            vcd.values = new double[0];          
//            lines.add(line);
        }
//        System.out.println("GraphicPanel/ setlines lines.size="+lines.size());
//         System.out.println("GraphicPanel/setlines selectedChannelDatas.size="+selectedChannelDatas.size());
 
        return true;
    }
    
    //end =====================================================================

    /**
     * to generate daily report together with the whole report, we'll create an
     * array of GraphicPanel, 1 for each day. those GraphicPanels will contain
     * mostly the same with original GraphicPanels, except the start time and
     * end time.
     */
    public void createDailyReport(Timestamp startTime, Timestamp endTime, final ArrayList<ViewChannelData> vcds,
            boolean doStackView) {
        creatingDailyReport = true;
        viewOptions = theCommonValue.getViewOptions();
        viewOptions.startTime = startTime;
        viewOptions.endTime = endTime;

        Date time = new Date();
        DateFormat formatter = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT, Locale.ENGLISH);                
        time.setTime(viewOptions.startTime.getTime());
        jLabelFrom.setText(formatter.format(time));
//        System.out.println("base/createdailyreport jLabelFrom.getText="+jLabelFrom.getText());
        time.setTime(viewOptions.endTime.getTime());
        jLabelTo.setText(formatter.format(time));

        this.selectedChannelDatas = vcds;
        showCurrentAsFlow = theCommonValue.isShowCurrentValuesAsFlow();
        if (showCurrentAsFlow) // setup the flow unit of what it should be
        {
            showCurrentAsFlowUnit = theCommonValue.getCompressors().get(0).AirDeliveryUnit;
        }

        if (!doStackView) {
            doLayout();

            calculatePoints();
            setXAxis();
            setYAxises();
            updateLengendLabels();
            
            int size = selectedChannelDatas.size();
            for(int i = 0 ; i < size; i++){
                initQueryId(selectedChannelDatas.get(i),viewOptions.startTime.getTime(),viewOptions.endTime.getTime());
            }

            readDataBaseOnLimitedBuffer();

            this.reSetLine();
//            setLines();
        } else {
            doStackView(true);
        }

        //if ( showBaseLine ) 
        //baseLine.setLine( xStart.x, xStart.y - DEFAULT_LEAKAGE_LINE_HEIGHT, rightYAxisX,  xStart.y - DEFAULT_LEAKAGE_LINE_HEIGHT );
        //calculateLeakLineData();
        //selectLeakStatCHHeader();

        //repaint();
    }

    private int findYAxisIndex(ViewChannel selectedChannel) {
        int index = 0;
        for (int i = 0; i < viewOptions.yUnits.length; i++) {
            String unit = viewOptions.yUnits[i];
            if (unit.compareTo(selectedChannel.unit) == 0) {
                return i;
            }
        }
        return index;
    }

    private void doCompare(boolean toDo) {
        if (toDo) {
            if (status == STATUS_COMPARING) {
                return;  // already comparing
            }
            comparingChannelIndex = 0;
            if (selectedChannelDatas.size() == 0) {
                return; // doesn't make sense
            }
            origSelectedChannelDatas = selectedChannelDatas;
            ViewChannelData selectedVCD = selectedChannelDatas.get(comparingChannelIndex);
            if (!setComparingViewChannelDatas(selectedVCD)) {
                selectedChannelDatas = origSelectedChannelDatas;
                return;
            }

            //isComparing = true;
            status = STATUS_COMPARING;
        } else {
            if (status != STATUS_COMPARING) {
                return;  // already not comparing
            }
            //isComparing = false;
            status = STATUS_NORMAL;
            selectedChannelDatas = origSelectedChannelDatas;
//            viewOptions = theCommonValue.getViewOptions();
            int size = selectedChannelDatas.size();
            for(int i = 0 ; i < size; i++){
                this.initQueryId(selectedChannelDatas.get(i),viewOptions.startTime.getTime(),viewOptions.endTime.getTime());
            }
        }

        compareGraphRepaint(toDo);
    }

    private void compareGraphRepaint(final boolean toDo) {
        EventQueue.invokeLater(new Runnable() {

            public void run() {
                Timer backTimer = new Timer();
                backTimer.scheduleAtFixedRate((new TimerTask() {

                    public void run() {
                        //loadNewGraphTask();
                        refreshRepaint(true);
                    }
                    //private boolean showBackgoundText = true;
                }), 500, 500);

                updateLengendLabels();
                
                readDataBaseOnLimitedBuffer();
                if(toDo && (status == STATUS_COMPARING)){
                    int size = selectedChannelDatas.size();
                    ViewChannelData vcd;
                    int len = 0;                  
                    for(int i = 0; i < size; i++){
                                                
                        vcd = selectedChannelDatas.get(i);
                        vcd.chheader.ChannelNumber = i;
                       
                        if(i > 0){
                            len = vcd.ids.length;
                            for (int j = 0; j < len; j++) {
                                vcd.ids[j] = vcd.ids[j] - vcd.queryStartID;
                            }
                        }
                      
                    }
                    
                }
                reSetLine();

//                setLines();

                //refreshTimer.cancel();
                backTimer.cancel();
                repaint();
            }
        });
    }

    private void doStackView(boolean toDo) {
        if (toDo) {
            if (status == STATUS_STACK_VIEW) {
                return;  // already stack viewing
            }
            /*
             * origSelectedChannelDatas = selectedChannelDatas;
             * selectedChannelDatas = new ArrayList<ViewChannelData>();
             *
             * for ( ViewChannelData vcd : origSelectedChannelDatas ) { if (
             * MeasurementUnit.IsFlowRateUnit( vcd.unit ) || (
             * MeasurementUnit.IsCurrentUnit( vcd.unit ) && showCurrentAsFlow ))
             * { selectedChannelDatas.add( vcd ); } }
             *
             * if ( selectedChannelDatas.size() == 0 ) { selectedChannelDatas =
             * origSelectedChannelDatas; return; // no flow channel
            }
             */

            origViewOptions = new ViewOptions();
            origViewOptions.copy(viewOptions);

            // disable Y axices when not needed
            /*
             * for ( int i = 0; i < viewOptions.yUnits.length; i++ ) { if ( !(
             * MeasurementUnit.IsFlowRateUnit( viewOptions.yUnits[i] )|| (
             * MeasurementUnit.IsCurrentUnit( viewOptions.yUnits[i] ) &&
             * showCurrentAsFlow )) ) viewOptions.yDisableds[i] = true;
            }
             */

            // set new Y axis scale. Note: setting new Y axis scale for current channel is in 
            // 'alterYAxisSettingsToShowCurrentAsFlow' function
            for (int i = 0; i < viewOptions.yUnits.length; i++) {
                if (MeasurementUnit.IsFlowRateUnit(viewOptions.yUnits[i])) {
                    double yTo = 0;
                    for (ViewChannelData vcd : selectedChannelDatas) {
                        if (vcd.unit.compareTo(viewOptions.yUnits[i]) == 0) {
                            yTo += vcd.maxValue;
                        }
                    }
                    if (yTo > 0) {
                        viewOptions.yTos[i] = yTo;
                    }
                }
            }

            //change selectedChannelDatas data --- begin
//             boolean isStackValue = false;
//             ViewChannelData tmp = new ViewChannelData();
//             int index = 0 ;
//             for ( ViewChannelData vcd : selectedChannelDatas ) {
//                 index += 1;
//
//                  if (( MeasurementUnit.IsCurrentUnit( vcd.unit ) && showCurrentAsFlow )
//                    || ( MeasurementUnit.IsFlowRateUnit( vcd.unit ) && !showCurrentAsFlow ))
//                         isStackValue = true;
//                  if(isStackValue && index > 1){
//                      int valueLen = vcd.values.length ;
//                      for(int tmpIndex = 0; tmpIndex < valueLen; tmpIndex++ ){
////                          System.out.println("originality vcd.values["+tmpIndex+"]="+vcd.values[tmpIndex]);
//                          boolean overbound = false;
//                          if(tmp.values[tmpIndex] == CSMDF.INVALID_MEASUREMENT_VALUE || tmp.values[tmpIndex] == CSMDF.OVERANGE_MEASUREMENT_VALUE ){
//                              vcd.values[tmpIndex] += 0;
//                              overbound = true;
//                          }
//                          if(!overbound && vcd.values[tmpIndex] == CSMDF.INVALID_MEASUREMENT_VALUE ||
//                              vcd.values[tmpIndex] == CSMDF.OVERANGE_MEASUREMENT_VALUE ){
//                              vcd.values[tmpIndex] = tmp.values[tmpIndex];
//                              overbound = true;
//                          }
//                          if(!overbound){
//                             vcd.values[tmpIndex] += tmp.values[tmpIndex];
//                          }
//                          System.out.println("overbound="+overbound);
//                          System.out.println("originality vcd.values["+tmpIndex+"]="+vcd.values[tmpIndex]);
//                      }
//                  }
//
//                 tmp = vcd;
//             }
//            // ------------ end

            //isStackView = true;
            status = STATUS_STACK_VIEW;
        } else {
            if (status != STATUS_STACK_VIEW) {
                return;  // already not stack viewing
            }
            //isStackView = false;
            status = STATUS_NORMAL;
//            selectedChannelDatas = origSelectedChannelDatas;
            //deleted by be on 20110309.
//            if ( origViewOptions != null )
//                viewOptions.copy( origViewOptions );
        }

        stackViewAndSortedVolumeFlowRepaint();
    }

    private void stackViewAndSortedVolumeFlowRepaint() {
        EventQueue.invokeLater(new Runnable() {

            public void run() {
                Timer backTimer = new Timer();
                backTimer.scheduleAtFixedRate((new TimerTask() {

                    public void run() {
                        //loadNewGraphTask();
                        refreshRepaint(true);
                    }
                    //private boolean showBackgoundText = true;
                }), 500, 500);

                calculatePoints();
                setXAxis();
                setYAxises();
                updateLengendLabels();

//                setLines();
                
                int size = selectedChannelDatas.size();
                for(int i = 0 ; i < size; i++){
                    initQueryId(selectedChannelDatas.get(i),viewOptions.startTime.getTime(),viewOptions.endTime.getTime());
                }

                readDataBaseOnLimitedBuffer();
                
                reSetLine();

                if (!creatingDailyReport) {
                    //refreshTimer.cancel();
                    backTimer.cancel();
                    repaint();
                }
            }
        });
    }

    /**
     * Create a view channel data for each day ( or each week, depends on
     * report-type ). Channel is decided by 'comparingChannelIndex'.
     */
    private boolean setComparingViewChannelDatas(ViewChannelData selectedVCD) {
        try {
            ViewOptions viewOptions = theCommonValue.getViewOptions();
//            ViewChannelData vcd;
            selectedChannelDatas = new ArrayList<ViewChannelData>();
            int startTimeID, endTimeID;
            int startRecordIndex = 0;
            int endRecordIndex = 0;
            int lineIndex;  // how many lines already
            long lineStartTimeMilli, timeJumpMilli;  // what's the time jump between each line, in milliseconds
            int length = selectedVCD.ids.length;
            int startSearchID;
//            int previousEndID;  // the ending id of previous vcd
            Date theDate;
            SimpleDateFormat dateFormat = new SimpleDateFormat("EEE,   "
                    + "dd.MM.yyyy");                    

            switch (theCommonValue.getReportType()) {
                case CommonValue.REPORT_TYPE_DAY:
                    timeJumpMilli = ViewOptions.ONE_DAY_MILLS;
                    break;
                case CommonValue.REPORT_TYPE_WEEK:
                    timeJumpMilli = ViewOptions.ONE_WEEK_MILLS;
                    break;
                default:
                    timeJumpMilli = ViewOptions.ONE_DAY_MILLS;
            }

            lineIndex = 0;
//            previousEndID = 0;
            while (lineIndex < GUIConst.MAX_CHANNEL_ALLOW) {
                ViewChannelData vcd = new ViewChannelData(selectedVCD);
                vcd.yAxisIndex = selectedVCD.yAxisIndex;
                lineStartTimeMilli = xDataStart + lineIndex * timeJumpMilli;
                
                if (lineStartTimeMilli/1000 > selectedVCD.endTimeMilli/1000) {
                    break;
                }

                this.initQueryId(vcd, lineStartTimeMilli, (xDataEnd + lineIndex * timeJumpMilli));
               
                
                theDate = new Date(lineStartTimeMilli);
                vcd.fullChannelName = selectedVCD.unit + "   " + dateFormat.format(theDate);
                vcd.color = viewOptions.ChannelColors[lineIndex];                  
                if (lineIndex > 0) {
                    vcd.startTimeMilli = xDataStart;
                }
                selectedChannelDatas.add(vcd);
                 
                lineIndex++;
                
                //=========================old ====================
//                vcd = new ViewChannelData(selectedVCD);
//                vcd.yAxisIndex = selectedVCD.yAxisIndex;
//
//                // find out start and end ID
//                lineStartTimeMilli = xDataStart + lineIndex * timeJumpMilli;
//                startTimeID = (int) ((lineStartTimeMilli - selectedVCD.startTimeMilli) / (1000 * vcd.sampleRate));
//                endTimeID = (int) ((xDataEnd + lineIndex * timeJumpMilli - selectedVCD.startTimeMilli) / (1000 * vcd.sampleRate));
//                if (startTimeID > selectedVCD.ids[length - 1]) {
//                    break;
//                }
//                // find the startRecordIndex
//                startSearchID = startTimeID;
//                if (startSearchID < 0) {
//                    startSearchID = 0;
//                }
//                if (startSearchID >= length) {
//                    startSearchID = length - 1;
//                }
//                for (int i = startSearchID; i >= 0; i--) {
//                    if (startTimeID >= selectedVCD.ids[i]) {
//                        startRecordIndex = i;
//                        break;
//                    }
//                }
//                // find the endRecordIndex
//                startSearchID = endTimeID;
//                if (startSearchID >= length) {
//                    startSearchID = length - 1;
//                }
//                for (int i = startSearchID; i >= 0; i--) {
//                    if (endTimeID >= selectedVCD.ids[i]) {
//                        endRecordIndex = i;
//                        break;
//                    }
//                }
//
//                // legend and color
//                theDate = new Date(lineStartTimeMilli);
//                vcd.fullChannelName = selectedVCD.unit + "   " + dateFormat.format(theDate);
//                vcd.color = viewOptions.ChannelColors[lineIndex];
//
//                // assign values, adjust time
//                if (endRecordIndex >= length) {
//                    endRecordIndex = length - 1;
//                }
////System.out.println( startRecordIndex + " " + endRecordIndex );                
//                vcd.ids = Arrays.copyOfRange(selectedVCD.ids, startRecordIndex, endRecordIndex);
//                if (previousEndID > 0) {
//                    for (int i = 0; i < vcd.ids.length; i++) {
//                        vcd.ids[i] -= previousEndID;
//                    }
//                }
//                vcd.values = Arrays.copyOfRange(selectedVCD.values, startRecordIndex, endRecordIndex);
//                if (lineIndex > 0) {
//                    vcd.startTimeMilli = xDataStart;
//                }
//                selectedChannelDatas.add(vcd);
//
//                previousEndID = endTimeID;
//                lineIndex++;
            }
        } catch (Exception e) {
            return false;
        }

        return true;
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jPopupMenuLabel = new javax.swing.JPopupMenu();
        jMenuLabelEdit = new javax.swing.JMenuItem();
        jMenuLabelDelete = new javax.swing.JMenuItem();
        jPanelHeader = new javax.swing.JPanel();
        jPanelTitle = new javax.swing.JPanel();
        jLabelTitle = new javax.swing.JLabel();
        jLabelFromPre = new javax.swing.JLabel();
        jLabelFrom = new javax.swing.JLabel();
        jLabelToPre = new javax.swing.JLabel();
        jLabelTo = new javax.swing.JLabel();
        jLabelDisplayRecords = new javax.swing.JLabel();
        jPanelCanvas = new javax.swing.JPanel();
        jPanelLegend = new javax.swing.JPanel();
        jPanel1 = new javax.swing.JPanel();
        jPanelLegendTop = new javax.swing.JPanel();
        jPanel2 = new javax.swing.JPanel();
        jPanel3 = new javax.swing.JPanel();

        jMenuLabelEdit.setFont(new java.awt.Font("Dialog", 0, 12));
        java.util.ResourceBundle bundle = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts"); // NOI18N
        jMenuLabelEdit.setText(bundle.getString("Edit_Comment")); // NOI18N
        jMenuLabelEdit.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jMenuLabelEditActionPerformed(evt);
            }
        });
        jPopupMenuLabel.add(jMenuLabelEdit);

        jMenuLabelDelete.setFont(new java.awt.Font("Dialog", 0, 12));
        jMenuLabelDelete.setText(bundle.getString("Remove_Comment")); // NOI18N
        jMenuLabelDelete.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jMenuLabelDeleteActionPerformed(evt);
            }
        });
        jPopupMenuLabel.add(jMenuLabelDelete);

        addComponentListener(new java.awt.event.ComponentAdapter() {
            public void componentResized(java.awt.event.ComponentEvent evt) {
                formComponentResized(evt);
            }
        });
        setLayout(new java.awt.BorderLayout());

        jPanelHeader.setPreferredSize(new Dimension( 100, (int) TITLE_PANEL_HEIGHT ));
        jPanelHeader.setLayout(new java.awt.BorderLayout());

        jPanelTitle.setPreferredSize(new Dimension( 100, 10 ));
        jPanelTitle.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.CENTER, 15, 10));

        jLabelTitle.setFont(new java.awt.Font("SansSerif", 1, 12));
        jLabelTitle.setText("        ");
        jPanelTitle.add(jLabelTitle);

        jLabelFromPre.setFont(new java.awt.Font("SansSerif", 1, 10));
        jLabelFromPre.setText(bundle.getString("Record_Period:")); // NOI18N
        jPanelTitle.add(jLabelFromPre);

        jLabelFrom.setFont(new java.awt.Font("DialogInput", 3, 10)); // NOI18N
        jLabelFrom.setForeground(new java.awt.Color(153, 0, 0));
        jLabelFrom.setText("          ");
        jPanelTitle.add(jLabelFrom);

        jLabelToPre.setFont(new java.awt.Font("SansSerif", 1, 10));
        jLabelToPre.setText(bundle.getString("_to_")); // NOI18N
        jPanelTitle.add(jLabelToPre);

        jLabelTo.setFont(new java.awt.Font("DialogInput", 3, 10)); // NOI18N
        jLabelTo.setForeground(new java.awt.Color(153, 0, 0));
        jLabelTo.setText("       ");
        jPanelTitle.add(jLabelTo);

        jPanelHeader.add(jPanelTitle, java.awt.BorderLayout.CENTER);

        jLabelDisplayRecords.setFont(new java.awt.Font("SansSerif", 0, 12));
        jLabelDisplayRecords.setForeground(new java.awt.Color(0, 204, 255));
        jLabelDisplayRecords.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelDisplayRecords.setPreferredSize(new Dimension( 100, (int) TITLE_PANEL_DISPLAY_RECORD_HEIGHT ));
        jPanelHeader.add(jLabelDisplayRecords, java.awt.BorderLayout.SOUTH);

        add(jPanelHeader, java.awt.BorderLayout.NORTH);

        org.jdesktop.layout.GroupLayout jPanelCanvasLayout = new org.jdesktop.layout.GroupLayout(jPanelCanvas);
        jPanelCanvas.setLayout(jPanelCanvasLayout);
        jPanelCanvasLayout.setHorizontalGroup(
            jPanelCanvasLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(0, 658, Short.MAX_VALUE)
        );
        jPanelCanvasLayout.setVerticalGroup(
            jPanelCanvasLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(0, 511, Short.MAX_VALUE)
        );

        add(jPanelCanvas, java.awt.BorderLayout.CENTER);

        jPanelLegend.setPreferredSize(new Dimension( 100, LEGEND_PANEL_HEIGHT ));
        jPanelLegend.setLayout(new java.awt.BorderLayout());

        jPanel1.setPreferredSize(new java.awt.Dimension(0, 50));
        jPanel1.setLayout(new java.awt.BorderLayout());

        jPanelLegendTop.setLayout(new java.awt.GridLayout(2, 3));
        jPanel1.add(jPanelLegendTop, java.awt.BorderLayout.CENTER);

        org.jdesktop.layout.GroupLayout jPanel2Layout = new org.jdesktop.layout.GroupLayout(jPanel2);
        jPanel2.setLayout(jPanel2Layout);
        jPanel2Layout.setHorizontalGroup(
            jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(0, 10, Short.MAX_VALUE)
        );
        jPanel2Layout.setVerticalGroup(
            jPanel2Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(0, 50, Short.MAX_VALUE)
        );

        jPanel1.add(jPanel2, java.awt.BorderLayout.WEST);

        org.jdesktop.layout.GroupLayout jPanel3Layout = new org.jdesktop.layout.GroupLayout(jPanel3);
        jPanel3.setLayout(jPanel3Layout);
        jPanel3Layout.setHorizontalGroup(
            jPanel3Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(0, 10, Short.MAX_VALUE)
        );
        jPanel3Layout.setVerticalGroup(
            jPanel3Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(0, 50, Short.MAX_VALUE)
        );

        jPanel1.add(jPanel3, java.awt.BorderLayout.EAST);

        jPanelLegend.add(jPanel1, java.awt.BorderLayout.NORTH);

        add(jPanelLegend, java.awt.BorderLayout.SOUTH);
    }// </editor-fold>//GEN-END:initComponents

    /**
     * if not comparing, set it to compare. if comparing, set it to not compare
     * return false if trying to trigger this view at non-normal status.
     */
    public boolean triggerComparison() {
        if (status == STATUS_COMPARING) { //isComparing() ) {
            doCompare(false);
        } else {
            if (status != STATUS_NORMAL) {
                JOptionPane.showMessageDialog(this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Only_available_at_normal_viewing"));
                return false;
            }

            if (theCommonValue.getReportType() != CommonValue.REPORT_TYPE_DAY
                    && theCommonValue.getReportType() != CommonValue.REPORT_TYPE_WEEK) {
                //JOptionPane.showMessageDialog( this, "Sorry, not applicable for this report type." );
                //return false;
                //theCommonValue.setReportType( CommonValue.REPORT_TYPE_DAY );
            }
            doCompare(true);
        }

        return true;
    }

    /**
     * if not doing stack view, set it to show stack view. if already showing,
     * set it to not show return false if trying to trigger this view at
     * non-normal status.
     */
    public boolean triggerStackView() {
        if (status == STATUS_STACK_VIEW) {
            doStackView(false);
        } else {
            if (status != STATUS_NORMAL) {
                JOptionPane.showMessageDialog(this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Only_available_at_normal_viewing"));
                return false;
            }

            // if see there's flow channel
            boolean hasFlowChannel = false;
            for (ViewChannelData vcd : selectedChannelDatas) {
                
//                if(MeasurementUnit.IsCurrentUnit(vcd.unit) && showCurrentAsFlow){
//                    if(isCurrentHasPowerChannelBaseOnCompressor(vcd.chheader)){
//                        continue;
//                    }
//                }
                
                if (MeasurementUnit.IsFlowRateUnit(vcd.unit)
                        || (MeasurementUnit.IsCurrentUnit(vcd.unit) && showCurrentAsFlow)
                        || (MeasurementUnit.IsPowerUnit(vcd.unit) && showCurrentAsFlow)) {
                    hasFlowChannel = true;
                    break;
                }
            }
            if (hasFlowChannel) {
                doStackView(true);
            } else {
                JOptionPane.showMessageDialog(this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Sorry,_stack_view_is_only_available_when_there's_flow_channel_selected."));
                return false;
            }
        }

        return true;
    }

    /**
     * if not doing stack view, set it to show stack view. if already showing,
     * set it to not show return false if trying to trigger this view at
     * non-normal status.
     */
    public boolean triggerSortedVolumeFlow() {
        if (status == STATUS_SORTED_FLOW) {
            doSortedVolumeFlow(false);
        } else {
            if (status != STATUS_NORMAL) {
                JOptionPane.showMessageDialog(this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Only_available_at_normal_viewing"));
                return false;
            }
            // if see there's only flow channel
            boolean hasFlowChannel = false;
            boolean hasOtherChannel = false;
            for (ViewChannelData vcd : selectedChannelDatas) {
                
//                if(MeasurementUnit.IsCurrentUnit(vcd.unit) && showCurrentAsFlow){
//                    if(isCurrentHasPowerChannelBaseOnCompressor(vcd.chheader)){
//                        hasOtherChannel = true;
//                        break;
//                    }
//                }
                
                if (MeasurementUnit.IsFlowRateUnit(vcd.unit)
                        || (MeasurementUnit.IsCurrentUnit(vcd.unit) && showCurrentAsFlow)
                        || (MeasurementUnit.IsPowerUnit(vcd.unit) && showCurrentAsFlow)) {
                    hasFlowChannel = true;
                } else {
                    hasOtherChannel = true;
                    break;
                }
            }
            if (hasFlowChannel && !hasOtherChannel) {
                doSortedVolumeFlow(true);
            } else {
                JOptionPane.showMessageDialog(this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Sorry,_sorted_volume_flow_is_only_available_when_there_are_ONLY_flow_channels_(_or_current_channels_displayed_as_flow_)_selected."));
                return false;
            }
        }

        return true;
    }

    private void doSortedVolumeFlow(boolean toDo) {
        if (toDo) {
            if (status == STATUS_SORTED_FLOW) {
                return;  // already sorted volume flow
            }
            // sort the values of all view channel data
            for (ViewChannelData vcd : selectedChannelDatas) {
                if (vcd.values != null) {
                    vcd.origValues = Arrays.copyOf(vcd.values, vcd.values.length);
                    Arrays.sort(vcd.values);

                    // reverse it
                    double temp;
                    for (int i = 0, j = vcd.values.length - 1; i < (vcd.values.length / 2); i++, j--) {
                        // swap the elements 
                        temp = vcd.values[i];
                        vcd.values[i] = vcd.values[j];
                        vcd.values[j] = temp;
                    }
                }
            }

            status = STATUS_SORTED_FLOW;
        } else {
            if (status != STATUS_SORTED_FLOW) {
                return;  // already not sorted volume flow
            }
            for (ViewChannelData vcd : selectedChannelDatas) {
                vcd.values = vcd.origValues;
            }

            status = STATUS_NORMAL;
        }

        stackViewAndSortedVolumeFlowRepaint();
    }

    public void triggerDisplayRecordAtCursor(boolean on) {
        if (on) {
            jPanelCanvas.addMouseMotionListener(displayRecordAtCursorListener);
            displayingRecordAtCursor = true;
        } else {
            jPanelCanvas.removeMouseMotionListener(displayRecordAtCursorListener);
            jLabelDisplayRecords.setText("");
            displayingRecordAtCursor = false;
        }
    }

    private void displayRecordAtCursor(java.awt.event.MouseEvent evt) {
        if (status != STATUS_NORMAL && status != STATUS_STACK_VIEW) // isComparing() ) 
        {
            return;   // doesn't make sense when comparing
        }
        // get the time from graph
        double ratio = (evt.getPoint().getX() - xStart.getX()) / (xEnd.getX() - xStart.getX());
        long timeMilli = xDataStart + (long) ((xDataEnd - xDataStart) * ratio);
        int timeID, recordIndex;
        int length =0;
        int previousID = 0;
        int nextID = 0;
        
        String values;
        DateFormat formatter = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.MEDIUM, Locale.ENGLISH);        
        Date time = new Date(timeMilli);

        values = formatter.format(time) + "  ";
        for (ViewChannelData vcd : selectedChannelDatas) {
            timeID = (int) ((timeMilli - vcd.startTimeMilli) / (1000 * vcd.sampleRate));
            try {
                
                // find the right record id               
                if(timeID < 0){
                    continue;
                }

                if (timeID > vcd.queryEndID) {
                    continue;
                } 
   
                length = vcd.ids.length;
                previousID = 0;
                nextID = 0;

                for (int i = length-1; i >= 0; i--) {                      
                    if((i - 1) >= 0){
                        previousID = vcd.ids[i-1];
                    }else{
                        previousID = vcd.ids[0];
                    }
                    if((i + 1) < length){
                        nextID = vcd.ids[i+1];
                    }else{
                        nextID = vcd.ids[i];
                    }
                    if (timeID <= nextID  && timeID >= previousID) {
                        recordIndex = i;
                        values += String.format("%10." + vcd.chheader.Resolution + "f", vcd.values[recordIndex]) + "  " + vcd.unit + "   ";
                        break;
                    }
                }
                    
//                    System.out.println("canvasW="+canvasW);
//                    System.out.println("evt.getPoint().getX()="+evt.getPoint().getX());
//                    recordIndex = (int)evt.getPoint().getX();
//                    System.out.println("evt.getPoint().getX() to recordIndex="+recordIndex);
//                    values += String.format("%10." + vcd.chheader.Resolution + "f", vcd.values[recordIndex]) + "  " + vcd.unit + "   ";
//                }
                
                
                
                
               
                
//                // find the right record id
//                length = vcd.ids.length;
//                if (timeID > vcd.ids[length - 1] || timeID < 0) {
//                    continue;
//                } else {
//                    startSearchID = timeID;
//                    if (timeID >= length) {
//                        startSearchID = length - 1;
//                    }
//                    for (int i = startSearchID; i >= 0; i--) {
//                        if (timeID == vcd.ids[i]) {
//                            recordIndex = i;
//                            values += String.format("%10." + vcd.chheader.Resolution + "f", vcd.values[recordIndex]) + "  " + vcd.unit + "   ";
//                            break;
//                        }
//                    }
//                }
            } catch (Exception e) {
//                e.printStackTrace();
            }
        }
//            Graphics2D g2 = (Graphics2D) getGraphics();
//            Color origColor = g2.getColor();
//            g2.setColor( Color.BLUE );
//            g2.drawString( values, xStart.x + 20, yEnds[0].y + 20 ); 
        jLabelDisplayRecords.setText(values);
    }

    /**
     * this button is also used to switch to next channel when comparing
     */
    public void goNextPeriod() {
        if (status == STATUS_COMPARING) { // isComparing() ) {
            try {
                if (comparingChannelIndex < origSelectedChannelDatas.size() - 1) {
                    comparingChannelIndex++;
                    ViewChannelData selectedVCD = origSelectedChannelDatas.get(comparingChannelIndex);
                    if (setComparingViewChannelDatas(selectedVCD)) {
                        compareGraphRepaint(true);
                    } else {
                        comparingChannelIndex--;
                    }
                }
                return;
            } catch (Exception e) {
            }
        }

        //if ( theCommonValue.getReportType() == CommonValue.REPORT_TYPE_PERIOD ) return;

        // check if time out of bound
        boolean inbound = false;
        for (ViewChannelData vcd : selectedChannelDatas) {
            if (vcd.endTimeMilli > viewOptions.endTime.getTime()) {
                inbound = true;
                break;
            }
        }
        if (!inbound) {
            return;
        }

//        long timeDifferenceMilli = viewOptions.endTime.getTime() - viewOptions.startTime.getTime();
//        viewOptions.startTime.setTime( viewOptions.endTime.getTime() );
        long timeDifferenceMilli = xDataEnd - xDataStart;

        if (doubTime) {
            xDataEnd += 3600000;
            doubTime = false;
        }

        viewOptions.startTime.setTime(xDataEnd);
        viewOptions.endTime.setTime(xDataEnd + timeDifferenceMilli);

        // note: in viewOptions, startTime is always maitained, endTime not necessary.
//        if ( theCommonValue.getReportType() == CommonValue.REPORT_TYPE_DAY ) {
//            viewOptions.startTime.setTime( viewOptions.startTime.getTime() + ViewOptions.ONE_DAY_MILLS );
//            viewOptions.endTime.setTime( viewOptions.startTime.getTime() + ViewOptions.ONE_DAY_MILLS );
//        } else if ( theCommonValue.getReportType() == CommonValue.REPORT_TYPE_WEEK ) {
//            viewOptions.startTime.setTime( viewOptions.startTime.getTime() + ViewOptions.ONE_WEEK_MILLS );
//            viewOptions.endTime.setTime( viewOptions.startTime.getTime() + ViewOptions.ONE_WEEK_MILLS );
//        } else if ( theCommonValue.getReportType() == CommonValue.REPORT_TYPE_MONTH ) {
//            viewOptions.startTime.setTime( viewOptions.startTime.getTime() + ViewOptions.ONE_MONTH_MILLS );
//            viewOptions.endTime.setTime( viewOptions.startTime.getTime() + ViewOptions.ONE_MONTH_MILLS );
//        } else {
//            // set time period, no next and previous
//            return;
//        }

        theCommonValue.setViewOptions(viewOptions);
    }

    /**
     * this button is also used to switch to next channel when comparing
     */
    public void goPreviousPeriod() {
        if (status == STATUS_COMPARING) {  //isComparing() ) {
            try {
                if (comparingChannelIndex > 0) {
                    comparingChannelIndex--;
                    ViewChannelData selectedVCD = origSelectedChannelDatas.get(comparingChannelIndex);
                    if (setComparingViewChannelDatas(selectedVCD)) {
                        compareGraphRepaint(true);
                    } else {
                        comparingChannelIndex++;
                    }
                }
                return;
            } catch (Exception e) {
            }
        }

        //if ( theCommonValue.getReportType() == CommonValue.REPORT_TYPE_PERIOD ) return;

        // check if time out of bound
        boolean inbound = false;
        for (ViewChannelData vcd : selectedChannelDatas) {
            if (vcd.startTimeMilli < viewOptions.startTime.getTime()) {
                inbound = true;
                break;
            }
        }
        if (!inbound) {
            return;
        }

//        long timeDifferenceMilli = viewOptions.endTime.getTime() - viewOptions.startTime.getTime();
//        viewOptions.endTime.setTime( viewOptions.startTime.getTime() );
//        viewOptions.startTime.setTime( viewOptions.endTime.getTime() - timeDifferenceMilli );
        long timeDifferenceMilli = xDataEnd - xDataStart;
        viewOptions.endTime.setTime(xDataStart);
        viewOptions.startTime.setTime(xDataStart - timeDifferenceMilli);

//        if ( theCommonValue.getReportType() == CommonValue.REPORT_TYPE_DAY ) {
//            viewOptions.startTime.setTime( viewOptions.endTime.getTime() - ViewOptions.ONE_DAY_MILLS );
//        } else if ( theCommonValue.getReportType() == CommonValue.REPORT_TYPE_WEEK ) {
//            viewOptions.startTime.setTime( viewOptions.endTime.getTime() - ViewOptions.ONE_WEEK_MILLS );
//        } else if ( theCommonValue.getReportType() == CommonValue.REPORT_TYPE_MONTH ) {
//            viewOptions.startTime.setTime( viewOptions.endTime.getTime() - ViewOptions.ONE_MONTH_MILLS );
//        } else {
//            // set time period, no next and previous
//            return;
//        }

        theCommonValue.setViewOptions(viewOptions);
    }

    /**
     * Zoom in. Shorten current scale by 50% If it is weekly view, make it daily
     * view. Otherwise shorten it by half and push start and end time into
     * stack.
     */
    public void zoomIn() {

        //add by be on 20101011, TF's requirement: if xdatadiv == 1, can't be zoom in/out. ---------- begin
        if (xDataDiv == (60 * 1000)) {
            return;
        }
        //------------- end

        long startMilli, endMilli; // time in millisecond
        long timeDifferenceMilli;
        int reportType = theCommonValue.getReportType();

        if (reportType == CommonValue.REPORT_TYPE_WEEK) {
            refreshRepaint(true);
            theCommonValue.setReportType(CommonValue.REPORT_TYPE_DAY);
        } else {
//            startMilli = viewOptions.startTime.getTime();
//            endMilli = viewOptions.endTime.getTime();
            startMilli = xDataStart;
            endMilli = xDataEnd;
            if (reportType == CommonValue.REPORT_TYPE_DAY) {
                //endMilli = startMilli + GUIConst.ONE_DAY_MILLS;  // note that in daily view the end time is not necessary maintained
                myZoomStack.push(startMilli);
                myZoomStack.push(endMilli);
                timeDifferenceMilli = (endMilli - startMilli) / ZOOMING_TIMES / 2;
                viewOptions.startTime.setTime(startMilli + timeDifferenceMilli);
                viewOptions.endTime.setTime(endMilli - timeDifferenceMilli);
                theCommonValue.setReportTypeAndViewOptions(CommonValue.REPORT_TYPE_PERIOD, viewOptions);
            } else {
                myZoomStack.push(startMilli);
                myZoomStack.push(endMilli);
                timeDifferenceMilli = (endMilli - startMilli) / ZOOMING_TIMES / 2;
                viewOptions.startTime.setTime(startMilli + timeDifferenceMilli);
                viewOptions.endTime.setTime(endMilli - timeDifferenceMilli);
                theCommonValue.setReportTypeAndViewOptions(CommonValue.REPORT_TYPE_PERIOD, viewOptions);
            }
        }


//            long timeDifferenceMilli = xDataEnd - xDataStart;
//            timeDifferenceMilli = timeDifferenceMilli / ZOOMING_TIMES / 2;
//            viewOptions.startTime.setTime( xDataStart + timeDifferenceMilli );
//            viewOptions.endTime.setTime( xDataEnd - timeDifferenceMilli );
//
//            if ( theCommonValue.getReportType() != CommonValue.REPORT_TYPE_PERIOD )
//                myZoomStack.clear(); // first time zooming
//            myZoomStack.push(1);
//            theCommonValue.setReportTypeAndViewOptions( CommonValue.REPORT_TYPE_PERIOD, viewOptions );
        //theCommonValue.setViewOptions( viewOptions ); 
    }

    /**
     * Zoom out. Larger current scale by 50%
     */
    public void zoomOut() {
        long startMilli, endMilli; // time in millisecond
        long timeDifferenceMilli;
        int reportType = theCommonValue.getReportType();

        switch (reportType) {
            case CommonValue.REPORT_TYPE_WEEK:
                break; // nothing to zoom
            case CommonValue.REPORT_TYPE_DAY:
                refreshRepaint(true);
                theCommonValue.setReportType(CommonValue.REPORT_TYPE_WEEK);
                break;
            default: {
                try {
                    endMilli = (Long) myZoomStack.pop();
                    startMilli = (Long) myZoomStack.pop();
                    viewOptions.startTime.setTime(startMilli);
                    viewOptions.endTime.setTime(endMilli);
                    if (myZoomStack.isEmpty()) {
                        theCommonValue.setReportTypeAndViewOptions(CommonValue.REPORT_TYPE_DAY, viewOptions);
                    } else {
                        theCommonValue.setViewOptions(viewOptions);
                    }
                } catch (Exception e) {
                    theCommonValue.setReportType(CommonValue.REPORT_TYPE_WEEK);
                }
            }
        }

//        if ( theCommonValue.getReportType() != CommonValue.REPORT_TYPE_PERIOD ) {
//            myZoomStack.clear(); // first time zooming
//            return;
//        }
//        if ( myZoomStack.isEmpty() ) return;
//        try { myZoomStack.pop(); } catch( Exception e ) { return; }  // only zoom to original
//        
//        long timeDifferenceMilli =  xDataEnd - xDataStart;
//        timeDifferenceMilli = timeDifferenceMilli * ZOOMING_TIMES / 4;
//        viewOptions.startTime.setTime( xDataStart - timeDifferenceMilli );
//        viewOptions.endTime.setTime( xDataEnd + timeDifferenceMilli );
//
//        theCommonValue.setReportTypeAndViewOptions( CommonValue.REPORT_TYPE_PERIOD, viewOptions );
        //theCommonValue.setViewOptions( viewOptions ); 
    }

    private void jMenuLabelDeleteActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jMenuLabelDeleteActionPerformed
// TODO add your handling code here:
        try {
            jPanelCanvas.remove(selectedComment);
            allCommentLabels.remove(selectedComment.getText());
        } catch (Exception e) {
        }
        repaint();
    }//GEN-LAST:event_jMenuLabelDeleteActionPerformed

    private void jMenuLabelEditActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jMenuLabelEditActionPerformed
        //String comment = JOptionPane.showInputDialog(null, "Please input the new comment.");
        String comment = JOptionPane.showInputDialog(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_input_the_new_comment."), selectedComment.getText());
        if (comment == null || comment.length() <= 0) {
            return;
        } else {
            selectedComment.setText(comment);
            selectedComment.setSize(selectedComment.getText().length() * 10, 20);
        }
    }//GEN-LAST:event_jMenuLabelEditActionPerformed

    /**
     * show or not show baseline
     */
    public void setBaseLineShown(boolean toShow) {
        this.showBaseLine = toShow;

        if (toShow) {
            double y = baseLine.getY1();
            if (y < TITLE_PANEL_HEIGHT) {
                // never defined yet
                //y = xStart.y - canvasH / 2;

                y = xStart.y - DEFAULT_LEAKAGE_LINE_HEIGHT;
            }

            baseLine.setLine(xStart.x, y, rightYAxisX, y);
            calculateLeakLineData();
            selectLeakStatCHHeader();
        } else {
            leakStat.setLeakLineData(0, "");
        }

        repaint();
    }

    private void selectLeakStatCHHeader() {
        for (int i = 0; i < selectedChannelDatas.size(); i++) {
            ViewChannelData vcd = selectedChannelDatas.get(i);
            if (vcd.unit.compareTo(leakStat.getLeakLineUnit()) == 0) {
                leakStat.setLeakLineDataCHHeader(vcd.chheader);
            }
        }
    }

    /**
     * move baseline up and down
     */
    public void moveBaseLine(int action) {
        double y = baseLine.getY1();
        switch (action) {
            case BASELINE_DOWN: {
                y = y + 1;
                break;
            }
            case BASELINE_DOWN_FAST: {
                y = y + BASELINE_FAST_STEP;
                break;
            }
            case BASELINE_UP: {
                y = y - 1;
                break;
            }
            case BASELINE_UP_FAST: {
                y = y - BASELINE_FAST_STEP;
                break;
            }
            default:
                break;
        }

        if (y <= yEnds[0].y || y >= yStarts[0].y) {
            return;
        }
        baseLine.setLine(xStart.x, y, rightYAxisX, y);
        calculateLeakLineData();
        repaint();
    }

    private void calculateLeakLineData() {
        String unit = "";
        float value = 0;
        double y = baseLine.getY1();
        leakStat.leakLineRatio = (yStarts[0].y - y) / yLength;
        for (int i = 0; i < GUIConst.Y_AXIS_NUMBER; i++) {
            //if ( viewOptions.yUnits[i].startsWith( GUIConst.CONSUMPTION_UNIT_PREFIX_M ) 
            //      || viewOptions.yUnits[i].startsWith( GUIConst.CONSUMPTION_UNIT_PREFIX_C )) {
            if (MeasurementUnit.IsFlowRateUnit(viewOptions.yUnits[i])) {
                value = (float) (leakStat.leakLineRatio * yDataLengths[i] + yDataStarts[i]);
                unit = viewOptions.yUnits[i];
                break;
            }
        }
        //System.out.println("base/calculateLeakLineData value="+value);

        leakStat.setLeakLineData(value, unit);
    }

    private void calculateBaseLinePosition() {
        double y = baseLine.getY1();
        String unit = leakStat.getLeakLineUnit();
        if (unit.length() > 0) {
            for (int i = 0; i < GUIConst.Y_AXIS_NUMBER; i++) {
                if (viewOptions.yUnits[i].compareTo(unit) == 0) {
                    y = yStarts[i].y - (leakStat.getLeakLineData() - yDataStarts[i]) / yDataLengths[i] * yLength;
                    break;
                }
            }
        }

        baseLine.setLine(xStart.x, y, rightYAxisX, y);
    }

    private void drawBaseLine(Graphics2D g2) {
        float[] dash = {30.0f, 1f, 5f, 1f};
        g2.setStroke(new BasicStroke(1.0f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10.0f, dash, 0.0f));
        g2.setColor(LEAK_LINE_COLOR);
        g2.draw(baseLine);

        String unit = leakStat.getLeakLineUnit();
        if (unit.length() > 0) {
            //modify on 20091023.be
            //v3-14 : have higher resolution for average leakage : 1.25 m3/min
//            String text = String.format( "Leakage point: %10." +
//                    MeasurementUnit.getUnitResolution( unit ) + "f ", leakStat.getLeakLineData() ) + unit;

            String text = String.format("Leakage point: %10.2"
                    + "f ", leakStat.getLeakLineData()) + unit;

            g2.setColor(java.awt.Color.GRAY);
            g2.drawString(text, rightYAxisX - 230f, (float) baseLine.getY1() - 2);
        }
    }

    private void formComponentResized(java.awt.event.ComponentEvent evt) {//GEN-FIRST:event_formComponentResized
//System.out.println("trigged" + getComponent(0).getClass() );
        // calculate all the points, canvas size, etc
        if(isPrinting()){
            return;
        }
//          System.out.println("evt id "+evt.getID());    
        
        EventQueue.invokeLater(new Runnable() {

            public void run() {
                
               
                
                calculatePoints();
                setXAxis();
                setYAxises();
                
//                int size = selectedChannelDatas.size();
//                for(int i = 0 ; i < size; i++){
//                    initQueryId(selectedChannelDatas.get(i),viewOptions.startTime.getTime(),viewOptions.endTime.getTime());
//                }
//
//                readDataBaseOnLimitedBuffer();
                
//                setLines();           
                reSetLine();

                //calculateBaseLinePosition();
                if (showBaseLine) {
                    double y = yStarts[0].y - leakStat.leakLineRatio * yLength;
                    baseLine.setLine(xStart.x, y, rightYAxisX, y);
                }

                repaint();
            }
        });
    }//GEN-LAST:event_formComponentResized

    public void addCommentLabel() {
        String comment = JOptionPane.showInputDialog(null,
                java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_enter_comment."));
        if (comment == null || comment.length() <= 0) {
            return;
        }

        commentX = canvasW / 2;
        commentY = canvasH / 2;

        javax.swing.JLabel commentLabel = new javax.swing.JLabel(comment);
        commentLabel.setBounds(commentX, commentY, commentLabel.getText().length() * 15, 20);
//        commentLabel.
        commentLabel.addMouseMotionListener(new java.awt.event.MouseMotionAdapter() {

            public void mouseDragged(java.awt.event.MouseEvent evt) {
                jLabelCommentMouseDragged(evt);
            }
        });

        addPopupMenu(commentLabel, jPopupMenuLabel, true);

        allCommentLabels.put(commentLabel.getText(), commentLabel);
        jPanelCanvas.add(commentLabel);

        repaint();
    }

    private void addPopupMenu(Component c, final JPopupMenu pop, final boolean isCommentLabel) {
        c.addMouseListener(new MouseAdapter() {

            public void mousePressed(MouseEvent event) {
                checkForTriggerEvent(event);
            }

            public void mouseReleased(MouseEvent event) {
                checkForTriggerEvent(event);
                if (isCommentLabel) {
                    selectedComment = (javax.swing.JLabel) event.getSource();
                }
            }

            private void checkForTriggerEvent(MouseEvent event) {
                if (event.isPopupTrigger()) {
                    commentX = event.getX();
                    commentY = event.getY();
                    pop.show(event.getComponent(), event.getX(), event.getY());
                } else {
                    if (isCommentLabel) {
                        repaint();
                    }
                }
            }
        });
    }

    private void jLabelCommentMouseDragged(java.awt.event.MouseEvent evt) {
        // TODO add your handling code here:
        javax.swing.JComponent c = (javax.swing.JComponent) evt.getComponent();
        if (c != null) {
            // check if it's out of boundry
            int x = c.getX() + evt.getX();
            int y = c.getY() + evt.getY();
            if (x > 0 && x < canvasW && y > 0 && y < canvasH - RIGHT_MARGIN) {
                c.setLocation(x, y);
            }
            //repaint();
        }
    }

    /**
     * Current value can be displayed as flow value based on compressor
     * settings. Solution is to alter view options here. Change the current
     * setting ( unit, max, min, etc ) into flow. ViewOptions in CommonValue
     * remains the same. Change --- alteration done in Y axis setup.
     */
    private void alterYAxisSettingsToShowCurrentAsFlow(int yIndex) {
        ArrayList<Compressor> compressors = theCommonValue.getCompressors();
        Compressor compressor;
        if (compressors == null || compressors.isEmpty()) {
            return;
        }

        // find out proper max and min value
        double min = 0;
        double max = 0;
        double value = 0;
        double yTo = 0;  // for stack flow view
        for (ViewChannelData vcd : selectedChannelDatas) {
            compressor = findOutLinkingCompressor(vcd.chheader, vcd.unit);
            if (compressor != null) {
                if (compressor.Type == Compressor.COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
                    value = compressor.VFAirDeliveryMax * MeasurementUnit.RatioToM3PerHour(compressor.VFAirDeliveryUnit)
                            / MeasurementUnit.RatioToM3PerHour(showCurrentAsFlowUnit);
                    if (max < value) {
                        max = value;
                    }
                    yTo += value;
                } else {
                    if (max < compressor.MaxAirDelivery) {
                        max = compressor.MaxAirDelivery;
                    }
                    if (min > compressor.MinAirDelivery) {
                        min = compressor.MinAirDelivery;
                    }
                    yTo += compressor.MaxAirDelivery;
                }
            }
        }

        yDataStarts[yIndex] = min;
        if (status == STATUS_STACK_VIEW) {
            yDataEnds[yIndex] = yTo;
        } else {
            yDataEnds[yIndex] = max;
        }
    }

    /**
     * Find out the compressor this channel header links to.
     */
    private Compressor findOutLinkingCompressor(NChannelHeader chheader, String unit) {
        if(chheader == null || unit == null){
            return null;
        }
        
        boolean isCurrent = false;
        if(MeasurementUnit.IsCurrentUnit(unit)){
            isCurrent = true;
        }
        
        ArrayList<Compressor> compressors = theCommonValue.getCompressors();
        NChannelHeader tmpChannelHeader;
        for (Compressor compressor : compressors) {
            if(isCurrent){
                tmpChannelHeader = compressor.getCurrentChanel();
            }else{
                tmpChannelHeader = compressor.getAssignedPowerChannel();               
            }
            if(tmpChannelHeader == null){
                continue;
            }
//            String splitChar = "_";
//            String idPath = chheader.newDeviceID + splitChar + chheader.subDeviceID + 
//                                    splitChar + chheader.sensorID + splitChar + chheader.channelID;
//            if(idPath.equals(tmpChannelHeader.newDeviceID + splitChar + tmpChannelHeader.subDeviceID + splitChar 
//                    
//                    + tmpChannelHeader.sensorID + splitChar + tmpChannelHeader.channelID)){
//                 return compressor;
//            }
            
            if (tmpChannelHeader.Pref == chheader.Pref
                    && tmpChannelHeader.ChannelNumber == chheader.ChannelNumber) {
                return compressor;
            }
        }

        return null;
    }

    /**
     * provide selected view channel data for creating daily report
     */
    public final ArrayList<ViewChannelData> getSelectedChannelDatas() {
        return selectedChannelDatas;
    }

    // added by Lewis on 2007.4.13
    public void print(Graphics g) {
        /*
         * Color orig1 = jPanelLegend.getBackground(); Color orig2 =
         * jPanelTitle.getBackground(); Color orig3 =
         * jPanelCanvas.getBackground(); Color orig4 =
         * jPanelLegendTop.getBackground(); Color white = Color.WHITE;
         * //this.setBackground(white); jPanelLegend.setBackground(white);
         * jPanelTitle.setBackground(white); jPanelCanvas.setBackground(white);
         * jPanelLegendTop.setBackground(white); // wrap in try/finally so that
         * we always restore the state try { super.print(g); } finally {
         * //this.setBackground(orig1); jPanelLegend.setBackground(orig1);
         * jPanelTitle.setBackground(orig2); jPanelCanvas.setBackground(orig3);
         * jPanelLegendTop.setBackground(orig4); repaint();
       }
         */

        Color orig1 = jPanelLegend.getBackground();
        Color orig2 = jPanelTitle.getBackground();
        Color orig3 = jPanelCanvas.getBackground();
        Color orig4 = jPanelLegendTop.getBackground();
        Color orig5 = jPanel2.getBackground();
        Color orig6 = jPanel3.getBackground();
        Color orig7 = jPanelHeader.getBackground();
        Color white = Color.WHITE;
        //this.setBackground(white);
        jPanelLegend.setBackground(white);
        jPanelHeader.setBackground(white);
        jPanelTitle.setBackground(white);
        jPanelCanvas.setBackground(white);
        jPanelLegendTop.setBackground(white);
        jPanel2.setBackground(white);
        jPanel3.setBackground(white);
        // wrap in try/finally so that we always restore the state
        try {
            super.print(g);
        } finally {
            //this.setBackground(orig1);
            jPanelLegend.setBackground(orig1);
            jPanelHeader.setBackground(orig7);
            jPanelTitle.setBackground(orig2);
            jPanelCanvas.setBackground(orig3);
            jPanelLegendTop.setBackground(orig4);
            jPanel2.setBackground(orig5);
            jPanel3.setBackground(orig6);
            repaint();
        }

    }

    //add by be on 2009.03.10
    //reason : when print detail report , the graphic has no dateLengendLabels.
    //request: when print detail report , the graphic must has dateLengendLabels but no RecordPeriod.
    public void clearRecordPeriodLable() {
        //this.jLabelFromPre.setText(null);
        //this.jLabelToPre.setText(null);
        jLabelTitle.setText(theCommonValue.getTexts().Title);
        jLabelTitle.setVisible(true);
        jLabelFromPre.setVisible(true);
        jLabelFromPre.setVisible(true);

    }
    private final int GRAPHIC_REFRESH_RATE = 2000; // in millisecond
    private final String GRAPHIC_REFRESH_TEXT = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Loading._Please_wait_...");
    private final int GRAPHIC_REFRESH_TEXT_SIZE = 30;
    //mofidy on 20091023.be
    //v3-14 : have higher resolution for average leakage : 1.25 m3/min
//    private final int DEFAULT_LEAKAGE_LINE_HEIGHT = 20;
    private final double DEFAULT_LEAKAGE_LINE_HEIGHT = 0.75;
    private final float TITLE_PANEL_HEIGHT = 55;
    private final float TITLE_PANEL_DISPLAY_RECORD_HEIGHT = 20;
    private final float LEFT_MARGIN = 80;
    private final float RIGHT_MARGIN = 50;
    public final static float BOTTOM_MARGIN = 30;
    public final static int LEGEND_PANEL_HEIGHT = 70;
    private final float Y_AXIS_WIDTH = 35;
    private final float ARROW_LENGTH = 10;
    private final float ARROW_WIDTH = 2;
    private final float DASH_LENGTH = 2;  // the bar on each step
    private final float Y_AXIS_TITLE_GAP = 15;  // how far away is y axis title from y axis
    private final float TIME_TEXT_WIDTH = 24;
    private final float TIME_TEXT_HEIGHT = 12;
    private final float SINGLE_TEXT_WIDTH = 7.0f;
    private final float SINGLE_LARGE_TEXT_WIDTH = 5.7f;
    private final float MINIMUM_X_DIVISION = 25;
    private final float MINIMUM_X_DIVISION_MONTHLY_VIEW = 40;
    private final float MINIMUM_X_DIVISION_SORTED_VOLOME_FLOW = 40;
    private final int DEFAULT_Y_STEPS = 20;
    //private final float Y_DIVISION_TEXT_LENGTH = 15;
    private final int DEFAULT_X_STEP_NUMBER = 12;//modify 24 to 12 by be on 20101008.
    private final int ZOOMING_TIMES = 2; // the ratio of zooming in and out. 2 means 2 times smaller / bigger
    //private final int DEFAULT_WIDTH = 600; // for creating report purpose
    //private final int DEFAULT_HEIGHT = 400;
    private final String FONT_NAME = "SansSerif";
    private final Color LEAK_LINE_COLOR = java.awt.Color.BLACK;
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JLabel jLabelDisplayRecords;
    private javax.swing.JLabel jLabelFrom;
    private javax.swing.JLabel jLabelFromPre;
    private javax.swing.JLabel jLabelTitle;
    private javax.swing.JLabel jLabelTo;
    private javax.swing.JLabel jLabelToPre;
    private javax.swing.JMenuItem jMenuLabelDelete;
    private javax.swing.JMenuItem jMenuLabelEdit;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JPanel jPanel2;
    private javax.swing.JPanel jPanel3;
    private javax.swing.JPanel jPanelCanvas;
    private javax.swing.JPanel jPanelHeader;
    private javax.swing.JPanel jPanelLegend;
    private javax.swing.JPanel jPanelLegendTop;
    private javax.swing.JPanel jPanelTitle;
    private javax.swing.JPopupMenu jPopupMenuLabel;
    // End of variables declaration//GEN-END:variables
    public final static int BASELINE_UP_FAST = 0;
    public final static int BASELINE_UP = 1;
    public final static int BASELINE_DOWN = 2;
    public final static int BASELINE_DOWN_FAST = 3;
    private final int BASELINE_FAST_STEP = 10; // how many pixels to move at one click
    public final static int STATUS_NORMAL = 0;
    public final static int STATUS_COMPARING = 1;
    public final static int STATUS_STACK_VIEW = 2;
    public final static int STATUS_SORTED_FLOW = 3;

    /**
     * @return the isComparing
     */
    // public boolean isComparing() {
    //     return isComparing;
    // }
    /**
     * Return status of this view,could be status_normal, status_comparing,
     * status_stack viewing, status_sorted flow.
     */
    public int status() {
        return status;
    }

    /**
     * @return the printing
     */
    public boolean isPrinting() {
        return printing;
    }

    /**
     * @param printing the printing to set
     */
    public void setPrinting(boolean printing) {
        this.printing = printing;
    }

    private class ViewChannelData extends ViewChannel {

        public ViewChannelData() {
        }

        public ViewChannelData(ViewChannel vc) {
            this.pref = vc.pref;
            this.uuid = vc.uuid;
            this.channel = vc.channel;
            this.fullChannelName = vc.fullChannelName;
            this.unit = vc.unit;
            this.color = new Color(vc.color.getRGB());
            this.lineStyle = vc.lineStyle;

            this.chheader = new NChannelHeader();
            this.chheader.copy(vc.chheader);
            this.startTimeMilli = vc.startTimeMilli;
            this.endTimeMilli = vc.endTimeMilli;
            this.sampleRate = vc.sampleRate;
            this.lineStartDateText = vc.lineStartDateText; //add by be on 20101012.
            
            this.colorChanged = vc.colorChanged;
            this.colorIndex = vc.colorIndex;

            this.numOfSamples = vc.numOfSamples;
            this.queryStartID = vc.queryStartID;
            this.queryEndID = vc.queryEndID;         
            this.nextPage = vc.nextPage;
            this.viewStartID = vc.viewStartID;
            this.viewEndID = vc.viewEndID;

        }

        public void reset(){
 
            screenPoint = 0;
//            nextPointIndex = 0;
//            nextIntervalIndex = 0;
//            calculatedValueCount = 0;
            totalValueCount = 0;
            realValueIntervalList.clear();
            noNeedCalculatePointValue = false; 
            
        }
        
        int[] ids;
        int[] origIDs;
        double[] values;
        double[] origValues;
        double maxValue = 0;
        double minValue = 0;
        int yAxisIndex = 0;
        Point startPoint = new Point();
        
        int screenPoint = 0;
//        int nextPointIndex = 0;
//        int nextIntervalIndex = 0;
//        int calculatedValueCount;
        int totalValueCount;
        private ArrayList<Integer> realValueIntervalList = new ArrayList<Integer>();
        private boolean noNeedCalculatePointValue = false; //if draw all the data in this view

        /**
         * @return the realValueIntervalList
         */
        public ArrayList<Integer> getRealValueIntervalList() {
            return realValueIntervalList;
        }

        /**
         * @param realValueIntervalList the realValueIntervalList to set
         */
        public void setRealValueIntervalList(ArrayList<Integer> realValueIntervalList) {
            this.realValueIntervalList = realValueIntervalList;
        }

        /**
         * @return the noNeedCalculate
         */
        public boolean isNoNeedCalculatePointValue() {
            return noNeedCalculatePointValue;
        }

        /**
         * @param noNeedCalculate the noNeedCalculate to set
         */
        public void setNoNeedCalculatePointValue(boolean noNeedCalculate) {
            this.noNeedCalculatePointValue = noNeedCalculate;
        }
        
    }
    private int x0, y0;  // top left
    // for zoom stack: every time zooming in, push in start and end time ( milli) before zooming
    // every time zooming out, pop out previous end and start time
    private Stack myZoomStack = new Stack();
    // the lines to draw
    private GeneralPath xAxis;
    private ArrayList<GeneralPath> yAxises;
//    private ArrayList<GeneralPath> lines;
    private Hashtable<Long,GeneralPath> lines;
    private Line2D baseLine;
    private GeneralPath line;
    // this is the coordinate part
    private Point2D.Float canvasStart;
    private int totalW, totalH;
    private int canvasW, canvasH;
    private Point2D.Float xStart, xEnd;
    //private Point2D.Float xAxisDrawingStart, xAxisDrawingEnd;
    private float rightYAxisX;
    private Point2D.Float[] yStarts, yEnds;
    private float[] yOffSet;  // the offset position for the y axis titles
    // this is the data session
    private long xDataStart, xDataEnd;  // start time and end time
    private long xDataDiv, xDataLength;
    private int numOfXStep;
    private float xDiv;
    private double[] yDataStarts, yDataEnds;  // start and end value
    private double[] yDataDivs, yDataLengths;
    private int[] numOfYSteps;
    private float[] yDivs;
    private float yLength;
    private boolean showBaseLine = false;
    private int commentX, commentY;
    private javax.swing.JLabel selectedComment;
    private Hashtable<String, javax.swing.JLabel> allCommentLabels;
    private ArrayList<ViewChannelData> selectedChannelDatas;
    private ViewOptions viewOptions;
    private LeakStatistics leakStat;
    private CommonValue theCommonValue;
    private boolean showCurrentAsFlow = false;
    private String showCurrentAsFlowUnit = "";
    private java.awt.event.MouseMotionAdapter displayRecordAtCursorListener;
    boolean displayingRecordAtCursor = false;
    //private boolean isStackView = false;  // if the graph is doing stack view
    //private boolean isComparing = false;  // if the graph is doing comparison
    private int status = STATUS_NORMAL; // Status of this view,could be normal, comparing, stack viewing, sorted flow.

    public int getStatus() {
        return status;
    }

    public void setStatus(int s) {
        this.status = s;
    }
    private boolean creatingDailyReport = false;
    private ArrayList<ViewChannelData> origSelectedChannelDatas;  // to store original data temperarily when doing comparison
    private ViewOptions origViewOptions;
    private int comparingChannelIndex = 0;  // which channel is being comparings
    private String loadingText = "";  // this is the text appear in background when loading
    
    private boolean printing = false;
    
    
     /**
     * Check current channel if has related power channel
     */
    private boolean isCurrentHasPowerChannelBaseOnCompressor(NChannelHeader chheader) {
        if(chheader == null){
            return false;
        }

        ArrayList<Compressor> compressors = theCommonValue.getCompressors();
        NChannelHeader tmpChannelHeader;
        for (Compressor compressor : compressors) {
           
            tmpChannelHeader = compressor.getCurrentChanel();
           
            if(tmpChannelHeader == null){
                continue;
            }
            
            if (tmpChannelHeader.Pref == chheader.Pref
                    && tmpChannelHeader.ChannelNumber == chheader.ChannelNumber) {
                if(compressor.hasPowerChannel()){
                    return true;
                }else{
                    return false;
                }
               
            }
        }

        return false;
    }
}
