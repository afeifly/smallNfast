/*
 * ThresholdSettingDialog.java
 *
 * Created on August 12, 2008, 4:27 PM
 */

package com.cs.canalyzer.gui.dialog;

import com.cs.database.ChannelHeader;
import com.cs.canalyzer.structs.ViewOptions;
import com.cs.canalyzer.gui.GUIConst;
import com.cs.canalyzer.structs.Texts;
import com.cs.canalyzer.structs.ViewChannel;
import com.cs.database.CSMDF;
import com.cs.database.NChannelHeader;
import com.cs.database.NMeasurementRecordLine;
import com.cs.database.NProtocolHeader;
import com.cs.database.upgrade.DBController;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.FontMetrics;

import javax.swing.JOptionPane;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.Point;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.awt.geom.GeneralPath;
import java.awt.geom.Line2D;
import java.awt.geom.Point2D;
import java.text.DateFormat;
import java.text.DecimalFormat;
import java.util.*;
import javax.swing.ImageIcon;


/**
 *
 * @author  bh
 */
public class ThresholdSettingDialog extends javax.swing.JDialog implements MouseMotionListener,MouseListener {
    
    private NChannelHeader theChannelHeader;
    private NProtocolHeader theProtocolHeader;
    private ViewOptions theViewOptions;
    private CSMDF theDB;
    
    //keep value which is interactive 
    private double theFullLoadThresholdValue ;
    private double theUnLoadThresholdValue ;
    private double theNoLoadThresholdValue ;
    
    //keep value in the process 
    private double theFullLoadTempThresholdValue ;
    private double theUnLoadTempThresholdValue ;
    private double theNoLoadTempThresholdValue ;
    private double theFullloadY;
    private double theUnloadY;
    private double theNoloadY;
        
    private Image theOffScreenBuf; // keep graphics 
    private Graphics theOffScreenG; //  graphics of image
    
    private final static String NO_PHEADER_MSG = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Query_pheader_is_null_") ;
    private final int INDEX = 0 ;
    private int theSelectLineFlag = 0;//1 : fullload ; 2:unload ; 3 :nuload
    
    //lines information
    private Line2D theFullloadLine ;
    private Line2D theUnloadLine;
    private Line2D theNoloadLine ;         
    private final Color FULLLOAD_LINE_COLOR = java.awt.Color.BLUE; 
    private final Color UNLOAD_LINE_COLOR = java.awt.Color.darkGray;
    private final Color NOLOAD_LINE_COLOR = java.awt.Color.MAGENTA;
    private final static String FULLLOAD_TYPE = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Full_Load"); // text 
    private final static String UNLOAD_TYPE = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Unload") ;    // text 
    private final static String NOLOAD_TYPE = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Stop") ;   // text 
    
    private boolean theDraw = true;// if draw graphics : true :yes ; false : no
    
    //base property of draw graphics 
    private GeneralPath theXAxis;
    private ArrayList<ViewChannelData> selectedChannelDatas;
    private  ViewChannelData vcd;
    private double[] yOffSet;  // the offset position for the y axis titles
    private final double Y_AXIS_TITLE_GAP = 15;  // how far away is y axis title from y axis
    private Point2D.Float canvasStart;
    private int totalW, totalH;
    private int canvasW, canvasH;
    private Point2D.Double xStart, xEnd;
    private double rightYAxisX;
    private final float TITLE_PANEL_HEIGHT = 55;
    private final float TITLE_PANEL_DISPLAY_RECORD_HEIGHT = 20;
    private final float LEFT_MARGIN = 80;
    private final float RIGHT_MARGIN = 50;
    public final static float BOTTOM_MARGIN = 30;
    public final static int LEGEND_PANEL_HEIGHT = 70;
    private final float ARROW_LENGTH = 10;
    private Point2D.Double[] yStarts, yEnds;
    private final float Y_AXIS_WIDTH = 35;
    private double yLength;
    private long xDataStart, xDataEnd;  // start time and end time
    private long xDataDiv, xDataLength;
    private int numOfXStep;
    private double xDiv;
    private final int DEFAULT_X_STEP_NUMBER = 12;
    private final float MINIMUM_X_DIVISION = 25;
    private final float MINIMUM_X_DIVISION_MONTHLY_VIEW = 40;
    private final float DASH_LENGTH = 2;  // the bar on each step        
    private ArrayList<GeneralPath> yAxises;
    private int[] numOfYSteps;
    private double[] yDivs;
    private final int DEFAULT_Y_STEPS = 20;
    private double[] yDataStarts, yDataEnds;  // start and end value
    private double[] yDataDivs, yDataLengths;    
//    private ArrayList<GeneralPath> lines;  
    private Hashtable<Long,GeneralPath> lines;
    private final String FONT_NAME = "";
    private final float TIME_TEXT_WIDTH = 24;
    private final float TIME_TEXT_HEIGHT = 12;
    
    private boolean isCanceled = false;
    
    // below is for zooming,add on Nov12,2008.
    private boolean isZoomDragging = false; // to decide whether to draw lines when dragging
    private boolean isZooming = false;
    private Point zoomStart, zoomEnd;
    private GeneralPath zoomLines = new GeneralPath();
    private final int NORTH_PANEL_HEIGHT = 60;
    private static int HEADER_LABEL_HEIGHT = 35;
    private double xLength;
    private final int MINIMUM_ZOOM_X_LENGTH = 20;
    private final int MINIMUM_ZOOM_Y_LENGTH = 20;
     // in zooming, if number of selected records is less than below, don't zoom
    public static final int MINIMUM_ZOOM_RECORD_NUMBER = 20;
    
//    private static final int SHOW_TWO_HOURS = 7200 * 1000;//millseconds
    
    /** Creates new form ThresholdSettingDialog */
    public ThresholdSettingDialog( CSMDF dbCtrl, NChannelHeader channelheader ) {
        if(!dbCtrl.isOpened() || channelheader == null ){
            return;
        }
        
        theDB = dbCtrl;
        theChannelHeader = channelheader;
        theViewOptions = new ViewOptions(); 
        theFullloadLine = new Line2D.Float();
        theUnloadLine = new Line2D.Float();
        theNoloadLine = new Line2D.Float();
       
      //  createTestDate();                // test,will been delete
        
        theProtocolHeader = getPHeader();
        if(theProtocolHeader == null){
            JOptionPane.showMessageDialog(this,NO_PHEADER_MSG);
            return;
        }
        initComponents();       
        doMyInit();
    }
    
public void mouseReleased(MouseEvent e){
    theSelectLineFlag = 0;
   // this.mouseExited(e);
    if(isZoomDragging){
        isZoomDragging = false;
        zoomDrawing();
    }
} 
public void mouseEntered(MouseEvent e){
    this.repaint();
} 
public void mouseExited(MouseEvent e){    
   
} 
public void mouseClicked(MouseEvent e){
    
} 
public void mousePressed(MouseEvent e){
    zoomStart = e.getPoint();    
    zoomEnd = new Point();
    zoomEnd.setLocation(zoomStart.x, zoomStart.y); // in case it remembers previous location
    isZoomDragging = true;
} 
    
/**
 *@author : be
 *@data   : Aug18, 2008
 *@param  : mouseEvent
 *@desc   : take line by mouse and the mouse change state
 */
   public void mouseMoved(MouseEvent e){
       int myFY = (int)theFullloadY;
       int myUY = (int)theUnloadY;
       int myNY = (int)theNoloadY;
       int myEY = e.getPoint().y;
       int myEX = e.getPoint().x;
    
       theDraw = false;
       if((myEX > xStart.x ) && (myEX < this.xEnd.x) && 
               (myEY < yStarts[INDEX].y) && (myEY > yEnds[INDEX].y)){
          if((myEY < (myFY+10)) && (myEY > (myFY-10))){
              theSelectLineFlag = 1;
              setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
          }else if((myEY < (myUY+10)) && myEY > ((myUY-10))){
              theSelectLineFlag = 2;
              setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
          }else if((myEY < (myNY+10)) && myEY > ((myNY-10))){
              theSelectLineFlag = 3;
              setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
          }else{
              theSelectLineFlag = 0;
              setCursor(Cursor.getPredefinedCursor(Cursor.DEFAULT_CURSOR)); 
          }
      }else{          
          setCursor(Cursor.getPredefinedCursor(Cursor.DEFAULT_CURSOR)); 
      }
        
 }
   
/**
 *@author : be
 *@data   : Aug19, 2008
 *@param  : mouseEvent
 *@desc   : drag line by mouse 
 */
   public void mouseDragged(MouseEvent e){
       if(theSelectLineFlag != 0){
          if((e.getPoint().x > xStart.x ) && (e.getPoint().x < this.xEnd.x) && 
                   (e.getPoint().y < yStarts[INDEX].y) && (e.getPoint().y > yEnds[INDEX].y)){  
              switch(theSelectLineFlag){
                  case 1 :{
                     theFullloadY = (double)e.getPoint().y;
                     theFullLoadTempThresholdValue = (float)calculateTempThresholdLineData(theFullloadY);
                     break;}
                  case 2 :{
                      this.theUnloadY = (double)e.getPoint().y;
                      this.theUnLoadTempThresholdValue = (float)calculateTempThresholdLineData(theUnloadY);
                      break;}
                  case 3 :{
                      this.theNoloadY = (double)e.getPoint().y;
                      this.theNoLoadTempThresholdValue = (float)calculateTempThresholdLineData(theNoloadY);
                      break;}
                  default:
                     mouseExited(e);
              }
             zoomLines.reset();
             isZoomDragging = false;
            //this.repaint();
          }else{
              this.mouseExited(e);
          }
       }else{
            if ( isZoomDragging ) { 
                 if((e.getPoint().x > xStart.x ) && (e.getPoint().x < this.xEnd.x) && 
                   (e.getPoint().y < yStarts[INDEX].y) && (e.getPoint().y > yEnds[INDEX].y)){  
                        zoomEnd = e.getPoint();              
                        zoomLines.reset();

        //                //check point area
        //                if( e.getPoint().x < (int)xStart.x ) e.getPoint().x = (int)xStart.x ;
        //                if( e.getPoint().x > (int)xEnd.x ) e.getPoint().x = (int)xEnd.x ;
        //                if( e.getPoint().y > (int)yStarts[INDEX].y ) e.getPoint().y = (int)yStarts[INDEX].y ;
        //                if( e.getPoint().y < (int)yEnds[INDEX].y ) e.getPoint().y = (int)yEnds[INDEX].y ;

                        zoomLines.moveTo(zoomStart.x, zoomStart.y);
                        zoomLines.lineTo(zoomStart.x, zoomEnd.y);
                        zoomLines.lineTo(zoomEnd.x, zoomEnd.y);
                        zoomLines.lineTo(zoomEnd.x, zoomStart.y);
                        zoomLines.lineTo(zoomStart.x, zoomStart.y);

                        if((zoomEnd.x -zoomStart.x) < 1 ){
                            isZooming = false;
                            theDraw = false;
                        }
                 }
            }
       }
       repaint();
   }
   
    /**
     *test data ,create by yourself
     */
   // private void createTestDate(){
    //     int testCRef = 5003;
    //     theChannelHeader = this.theDB.querySingleChannelHeader(testCRef);         
   // }
    
    
    /**
    *@author : be
    *@date   :   Aug12, 2008
    *@desc   : initialize
    */    
    private void doMyInit(){
       
        vcd =  new ViewChannelData(setViewChannel());
        setViewOptionsValue();      
        calculatePoints();
        initLines();
        setXAxis();
        setYAxises();
   
        this.initQueryId(vcd, theViewOptions.startTime.getTime(), theViewOptions.endTime.getTime());
      
       // setThresholedYAndTempValue();
        reReadData();
        setLines();
        
//        theDraw = false;       
         
        drawGraphics();        
     
        
//        theOffScreenBuf = createImage(totalW,canvasH); 
//        theOffScreenG = theOffScreenBuf.getGraphics();
       // repaint();
        setIconImage( new ImageIcon(getClass().getResource( GUIConst.IMAGE_PATH + GUIConst.LOGO_FILE_NAME)).getImage() );
        addMouseMotionListener(this);
        addMouseListener(this); 
        this.setLocation(200,200);
        
        this.setModal( true );

    }
 
    
     /**
    *@author : be
    *@date   : Aug18, 2008
    *@desc   : initialize y according to threshold value
    */ 
    private void setThresholedYAndTempValue(){                
        theFullloadY = calculateThresholdLineData(getFullLoadThreshold());
        theUnloadY = calculateThresholdLineData(getUnLoadThreshold());
        theNoloadY = calculateThresholdLineData(getNoLoadThreshold());
        theFullLoadTempThresholdValue = getFullLoadThreshold();
        theUnLoadTempThresholdValue = getUnLoadThreshold();
        theNoLoadTempThresholdValue = getNoLoadThreshold();
    }
    
   /**
    *@author : be
    *@date   : Aug12, 2008
    *@desc   : create viewchannel by channelheader
    */    
    private ViewChannel setViewChannel(){
        
          //return  new ViewChannel(theChannelHeader.uuid, "", theChannelHeader, theProtocolHeader.stime.getTime(), theProtocolHeader.etime.getTime(), theProtocolHeader.srate ) ;
          return  new ViewChannel(String.valueOf( theProtocolHeader.DeviceID ), 
                                "", 
                                theChannelHeader, 
                                theProtocolHeader.StartTime, 
                                theProtocolHeader.StopTime, 
                                theProtocolHeader.SampleRate * theProtocolHeader.SampleRateFactor / 1000,  theProtocolHeader.NumOfSamples);
    
    }
    
    /**
     *@author : be
     *@date   : aug 12,2008
     *@param  : channelheader
     *@return : ProtocolHeader
     *@desc   : according to channelheader to get procolherder and then  set viewoptions starttime and endtime
     */
    private NProtocolHeader getPHeader(){
                
        try{
            return theDB.findProtocolHeader( theChannelHeader.Pref ); //.queryProtocolHeader(this.theChannelHeader.pref);
        }catch(Exception e){
            e.printStackTrace();
            System.out.println(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Exception_in_ThresholdSettingDialog/getPHeader_:_") + e.getMessage());
            return null;
        }
    }
    
  /**
    *@author : be
    *@date   : Aug12, 2008
    *@desc   : calculate points
    */
    private void calculatePoints() {
        totalW = this.getWidth(); totalH = this.getHeight();      
        canvasStart = new Point2D.Float( (float)0.0, TITLE_PANEL_HEIGHT );
        canvasW = totalW;
        canvasH = totalH - jPanelTitle.getHeight() - jPanelBottom.getHeight()*2;
        xStart = new Point2D.Double( LEFT_MARGIN, totalH - LEGEND_PANEL_HEIGHT - BOTTOM_MARGIN);        
        xEnd = new Point2D.Double( totalW - RIGHT_MARGIN - 2 * ARROW_LENGTH , xStart.y );
        rightYAxisX = xEnd.x;
        
        xLength = xEnd.x - xStart.x ;// add by be,Nov12,2008.
        
        yStarts = new Point2D.Double[ GUIConst.Y_AXIS_NUMBER ];
        for ( int i = 0; i < yStarts.length; i += 2 ) {
            yStarts[i] = new Point2D.Double( LEFT_MARGIN + Y_AXIS_WIDTH * i, xStart.y );
            yStarts[i + 1] = new Point2D.Double( rightYAxisX - Y_AXIS_WIDTH * i, xStart.y );
            if ( !theViewOptions.yDisableds[i] ) xStart = yStarts[i]; // left axis
            if ( !theViewOptions.yDisableds[i + 1] ) xEnd = yStarts[i + 1]; // right axis
        }
        yEnds = new Point2D.Double[ GUIConst.Y_AXIS_NUMBER ];
        for ( int i = 0; i < yStarts.length; i++ ) {
            yEnds[i] = new Point2D.Double( yStarts[i].x, TITLE_PANEL_HEIGHT );
            yLength = yStarts[0].y - yEnds[0].y;
        }
    }
    
   /**
    *@author : be
    *@date   : Aug12, 2008
    *@desc   : initialize draw lines factors
    */
     private void initLines() {
        theXAxis = new GeneralPath();
        yAxises = new ArrayList<GeneralPath>();
        for ( int i = 0; i < GUIConst.Y_AXIS_NUMBER; i++ ) {
            yAxises.add( new GeneralPath() );
        }
        yDataStarts = new double[GUIConst.Y_AXIS_NUMBER];
        yDataEnds = new double[GUIConst.Y_AXIS_NUMBER];  // start and end value
        yDataDivs = new double[GUIConst.Y_AXIS_NUMBER];
        yDataLengths = new double[GUIConst.Y_AXIS_NUMBER];
        numOfYSteps = new int[GUIConst.Y_AXIS_NUMBER];
        yDivs = new double[GUIConst.Y_AXIS_NUMBER];
//        lines = new ArrayList<GeneralPath>();
        lines = new Hashtable<Long,GeneralPath>();
        yOffSet = new double[GUIConst.Y_AXIS_NUMBER];
        Arrays.fill( yOffSet, 0 );

    }
    

   /**
     *@author : be
     *@date   : Aug12, 2008
     *@desc : Set x axis start and end time, scale, etc.
     * If report type 1 day, then start from 0:00. If report type 1 week, then start from Monday, 0:00.
     * If report type 1 month, then start from 1st, 0:00.
     **/
    private void setXAxis() {
      
        theXAxis.reset();
        
        DateFormat formatter = DateFormat.getDateTimeInstance( DateFormat.SHORT, DateFormat.SHORT, Locale.GERMAN );
        Calendar adjustStartTime = Calendar.getInstance();
        Calendar adjustEndTime = Calendar.getInstance();
        
        // decide the time start and end
        xDataStart = theViewOptions.startTime.getTime();
        xDataEnd = theViewOptions.endTime.getTime();
     
        adjustStartTime.setTimeInMillis( xDataStart );
        adjustStartTime.set( Calendar.MINUTE, 0 );
        adjustStartTime.set( Calendar.SECOND, 0 );
        adjustEndTime.setTimeInMillis( xDataEnd );
        
        // set number of steps, change the start and end time to full hour, or day                  
        numOfXStep = DEFAULT_X_STEP_NUMBER;
        xDataDiv = ( xDataEnd - xDataStart ) / numOfXStep;
        
        formatter  = DateFormat.getDateTimeInstance( DateFormat.SHORT, DateFormat.SHORT, Locale.GERMAN );
                                   
        xDataStart = adjustStartTime.getTimeInMillis();
        
        // make sure minimum x coodination division is met
        for ( int i = 0; i < 4; i++ ) {
            xDiv = ( xEnd.x - xStart.x ) / numOfXStep;
            if ( xDiv < MINIMUM_X_DIVISION ||                   
                    ( xDiv < MINIMUM_X_DIVISION_MONTHLY_VIEW  && adjustStartTime.get( Calendar.DAY_OF_MONTH ) != adjustEndTime.get( Calendar.DAY_OF_MONTH ) )) {
                numOfXStep = numOfXStep / 2;
                xDataDiv = xDataDiv * 2;
            } else
                break;
        }

        xDataLength = xDataEnd - xDataStart;
        theViewOptions.endTime.setTime( xDataEnd );
        
      
        theXAxis.moveTo( xStart.x, xStart.y );
        theXAxis.lineTo( xEnd.x, xEnd.y );
      
        double x, y;
        y = xStart.y;
        for ( int i = 0; i < numOfXStep; i++ ) {
            x = xStart.x + i * xDiv;
            theXAxis.moveTo( x, y );
            theXAxis.lineTo( x, y + DASH_LENGTH );
            
        }
        
    }

    
   /**
     *@author : be
     *@date   : Aug12, 2008
     *@desc : Set y axis start and end time, scale, etc.
     **/
    private void setYAxises() {
        for ( int i = 0; i < yAxises.size(); i ++ ) {
            GeneralPath yAxis = yAxises.get(i);
            yAxis.reset();

            if ( theViewOptions.yDisableds[i] )
                continue;
            
            if ( theViewOptions.yAutomatics[i] )
                numOfYSteps[i] = DEFAULT_Y_STEPS;
            else
                numOfYSteps[i] = theViewOptions.ySteps[i];
            yDivs[i] = yLength / numOfYSteps[i];
            
            // get data start and end value ( min and max )
            yDataStarts[i] = theViewOptions.minValues[INDEX];
            yDataEnds[i] = theViewOptions.maxValues[INDEX];

             // make the data start and end value reasonable
            yDataStarts[i] = getRound( yDataStarts[i], false );
            yDataEnds[i] = getRound( yDataEnds[i], true );
           
            // data division
            yDataLengths[i] = yDataEnds[i] - yDataStarts[i];
            yDataDivs[i] = yDataLengths[i] / numOfYSteps[i];

            
            // now start to draw
            yAxis.moveTo( yStarts[i].x, yStarts[i].y );
            yAxis.lineTo( yEnds[i].x, yEnds[i].y );

            double x, y;
            int parameter; // the bars to the left or right
            if ( i % 2 == 0 ) {
                parameter = -1; 
                //xStart = yStarts[i];
            } else { 
                parameter = 1;
                //xEnd = yStarts[i];
            }
            x = yStarts[i].x;
            for ( int k = 0 ; k < numOfYSteps[i]; k++ ) {
                y = yStarts[i].y - yDivs[i] * k;
                yAxis.moveTo(x, y);
                yAxis.lineTo( x + parameter * DASH_LENGTH, y );
            }
            
        }
    }
    
   /**
     *@author : be
     *@date   : Aug12, 2008
     *@desc   :  make value start from 0, or 10, or 100. 'up' means this is for max
     **/
    private double getRound( double value, boolean up ) {
        if ( ( !up && value >= 0 ) || ( up && value <= 0 ) )
            return 0;
        
        int tens = 1;
        int fives = 1;
        double result = value;
        for ( int i = 0; i < 10; i++ ) {
            result = ( Math.abs( result ) / result ) * fives;
            if ( Math.abs( value ) < fives ) break;
            
            result = ( Math.abs( result ) / result ) * tens;
            if ( Math.abs( value ) < tens ) break;
            
            tens = tens * 10;
            fives = tens / 2;
        } 
        
        return result;
    }
            
   /**
     *@author : be
     *@date   : Aug12, 2008
     *@desc   : select the readdata by channelHeader.cref
     **/
    private void reReadData() {
        selectedChannelDatas = new ArrayList<ViewChannelData>(); 
        if ( ! theDB.isOpened() || theChannelHeader == null) return;

        try {

            getData(vcd, theDB) ;

            selectedChannelDatas.add(vcd); 
        } catch (Exception e) {
            e.printStackTrace();

        }
  
    }

   /**
     *@author : be
     *@date   : Aug12, 2008
     *@desc   : setLines
     **/
    private void setLines() {
       // lines.clear();                  
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
        
        long key ;
        GeneralPath line = new GeneralPath();
        
        for ( ViewChannelData vcd : selectedChannelDatas ) {
            
           key = vcd.pref + vcd.chheader.ChannelNumber;
           line = lines.get(key);
           if(line == null){
               lines.put(key, new GeneralPath());
               line = lines.get(key);
           }
            
            if ( vcd.ids == null || vcd.ids.length == 0 ) return;


            srate = vcd.sampleRate * 1000;
            xRatio = ( xEnd.x - xStart.x ) * srate / xDataLength;
            //xActualStart = ( vcd.startTimeMilli - xDataStart ) / srate * xRatio + xStart.x;
            
            // find out actual start and end id
            //startTime = viewOptions.startTime.getTime();
            //endTime = viewOptions.endTime.getTime();
            startTime = xDataStart;

            endTime = xDataEnd;
            if ( startTime > vcd.endTimeMilli || endTime < vcd.startTimeMilli ) return;
            startID = (int) (( startTime - vcd.startTimeMilli ) / srate );
            endID = (int) (( endTime - vcd.startTimeMilli ) / srate );
            
            recordLength = vcd.values.length;
            startID = 0;
            endID = recordLength - 1;
            
            xActualStart = ( ( vcd.startTimeMilli + vcd.ids[startID] * srate ) - xDataStart ) / srate * xRatio + xStart.x;            
            
            // to the beginning
            x = xActualStart;
            yRatio = yLength / yDataLengths[vcd.yAxisIndex];
            // see if it's invalid
            if ( vcd.values[startID] == DBController.INVALID_MEASUREMENT_VALUE 
                    || vcd.values[startID] == DBController.OVERANGE_MEASUREMENT_VALUE ) {
                y = 0;
                previousDataValid = false;
            } else {
                y = yStarts[vcd.yAxisIndex].y - ( vcd.values[startID] - yDataStarts[vcd.yAxisIndex] ) * yRatio;
                previousDataValid = true;
            }
            line.moveTo( x, y );
            vcd.startPoint.setLocation( x, y );
            
            int beginID = vcd.ids[startID];          
          
            for ( int i = startID; i <= endID; i++ ) {
            // temp: for ( int i = startID + 1; i <= endID; i+= 100 ) {
                x = (vcd.ids[i] - beginID) * xRatio + xActualStart;
                if ( x > rightYAxisX ) break;
                // see if it's invalid
                if ( vcd.values[i] == DBController.INVALID_MEASUREMENT_VALUE || vcd.values[i] == DBController.OVERANGE_MEASUREMENT_VALUE ) {
                    y = 0;
                    previousDataValid = false;
                    line.moveTo( x, y );
                } else {
                    y = yStarts[vcd.yAxisIndex].y - ( vcd.values[i] - yDataStarts[vcd.yAxisIndex] ) * yRatio;
                    if ( previousDataValid ) 
                        line.lineTo( x, y );
                    else
                        line.moveTo( x, y );
                    previousDataValid = true;
                }
               
            } // for loop
            vcd.ids = new int[0];
            vcd.values = new double[0];
        }
    }
   

   /**
     *@author : be
     *@date   : Aug12, 2008
     *@desc   : override paint to draw graphics
     **/
    public void paint( Graphics g ) {
        Graphics2D g2 = (Graphics2D) g;
        super.paint( g );
        if(theDraw){
           
            drawGraphics();        
        }
//        theOffScreenBuf.flush(); 
      
        g2.drawImage(theOffScreenBuf,0,0,null);  

        drawBaseLine(g2);
        
        if(isZoomDragging){
            drawZoomingRectangle(g2);
        }
                   
    }
    
  
     /**
     *@author : be
     *@date   : Aug12, 2008
     *@desc   : draw graphics
     **/
    private void drawGraphics(){
    
       //theOffScreenBuf.getGraphics().dispose();
       
        if(theOffScreenG != null){
            theOffScreenG.dispose();
        }
        if(theOffScreenBuf != null){
            theOffScreenBuf = null;
        }
        theOffScreenBuf = createImage(totalW,canvasH); 
        theOffScreenG = theOffScreenBuf.getGraphics();
  
       Graphics2D g2 = ( Graphics2D )theOffScreenG;                       
//       g2 = ( Graphics2D )theOffScreenG; 
//       g2.setColor( java.awt.Color.black );
       g2.draw( theXAxis );
       writeXAxisText( g2 );

       for ( GeneralPath yAxis : yAxises ) {          
           g2.draw( yAxis );
       }
       writeYAxisesText( g2 );

       writeTexts( g2 );

        // grid
       drawGridLines( g2 );

       g2.setStroke( new BasicStroke( 1.0f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10.0f, null, -1f ));       
       
       //clear image and creart new image when zooming, modify on Nov12,2008.
       if(isZooming){
//           lines.clear();
//           
//           this.initQueryId(vcd, theViewOptions.startTime.getTime(), theViewOptions.endTime.getTime());
//
//           reReadData();
           
           //reset lines values.
           resetLines(g2);
       }
       
        for ( ViewChannelData vcd : selectedChannelDatas ) {
            try { 
                GeneralPath line = lines.get(vcd.pref+vcd.chheader.ChannelNumber);      
               // System.out.println("color ===="+new Color( (int) (Integer.MAX_VALUE * Math.random())));
                //g2.setBackground(new Color(236,233,216));                
                g2.setColor(new Color(48,199,55));
//                g2.setColor(vcd.color);
                g2.draw( line );
            } catch ( Exception e ) {}
        }
       
      
       theOffScreenBuf.flush();
    }

    
   /**
     *@author : be
     *@date   : Aug12, 2008
     *@desc   : write XAxis Text
     **/
     private void writeXAxisText( Graphics2D g2 ) {
        Calendar time = Calendar.getInstance();
        Calendar previousTime = Calendar.getInstance();
        DateFormat formatter, dateFormatter;
        String text = "";
        double x, y;
        boolean displayDateBelow = false;
        g2.setColor( java.awt.Color.black );
        // see if it requires display both date and time and the formatter
        Calendar startTime = Calendar.getInstance();
        Calendar endTime = Calendar.getInstance();
        startTime.setTimeInMillis( xDataStart );
        endTime.setTimeInMillis( xDataEnd );
//       System.out.println("xDataEnd-xDataStart= "+(xDataEnd-xDataStart));
        formatter = DateFormat.getTimeInstance( DateFormat.SHORT, Locale.GERMAN );
          //text = String.format( "  ")time.get( time.HOUR_OF_DAY ) + ":" + time.get( time.MINUTE );
        if ( startTime.get( Calendar.DAY_OF_MONTH ) != endTime.get( Calendar.DAY_OF_MONTH ))         
                displayDateBelow = true;
    
        dateFormatter = DateFormat.getDateInstance( DateFormat.SHORT, Locale.GERMAN );
        
        g2.setFont( new Font( FONT_NAME, 1, 9 ));
        for ( int i = 0; i < numOfXStep; i++ ) {
             
            time.setTimeInMillis( xDataStart + i * xDataDiv );
            text = formatter.format( time.getTime() );
                      
            x = xStart.x + i * xDiv - TIME_TEXT_WIDTH / 2;
            y = xStart.y + TIME_TEXT_HEIGHT;
           
            g2.drawString( text, (float) x, (float) y );
            
            if ( displayDateBelow ) {
                if (( i == 0 || time.get( Calendar.DAY_OF_MONTH ) != previousTime.get( Calendar.DAY_OF_MONTH )) ) {
                    text = dateFormatter.format( time.getTime() );
                    y += TIME_TEXT_HEIGHT;
                    g2.drawString( text, (float) x, (float) y );
                    
                    previousTime.setTimeInMillis( time.getTimeInMillis() );
                }
            }
        } // for loop
    }
     
   /**
     *@author : be
     *@date   : Aug12, 2008
     *@desc   : write YAxis Text
     **/
     private void writeYAxisesText( Graphics2D g2 ) {
        if ( this.theChannelHeader == null ) return;
        
        double x, y;
        String text;
        int width;
        String formatString;
        g2.setColor( java.awt.Color.black );
        g2.setFont( new Font( FONT_NAME, 1, 10 ));
        FontMetrics fm = g2.getFontMetrics();

        //int sw1 = g2.getFontMetrics().stringWidth(text);
        //int sw2 = fm.stringWidth(text);
        //width = (float)fm.getStringBounds(text, g2).getWidth();        
        
        for ( int i = 0; i < yStarts.length; i++ ) {
            if ( theViewOptions.yDisableds[i] )
                continue;
            
            // calculate how long the y division text is
            int value = (int) yDataEnds[i];
            width = String.valueOf( value ).length() + 2;
            formatString = "%" + width + "." + theViewOptions.yResolutions[i] + "f";
            
            for ( int j = 0; j < numOfYSteps[i]; j++ ) {
                text = String.format( formatString, yDataStarts[i] + j * yDataDivs[i]);
                yOffSet[i] = Math.max( Y_AXIS_TITLE_GAP, fm.stringWidth( text ) );
                if ( i % 2 == 0 )
                    //x = yStarts[i].x - width * SINGLE_TEXT_WIDTH;
                    x = yStarts[i].x - fm.stringWidth( text ) -  3 * DASH_LENGTH;
                else
                    x = yStarts[i].x + 3 * DASH_LENGTH;
                
                y = yStarts[i].y - j * yDivs[i] - DASH_LENGTH;
         
                g2.drawString( text, (float) x, (float) y );
            }
        }
    }
    
     
   /**
     *@author : be
     *@date   : Aug12, 2008
     *@desc   : write text (as write YAxises unit )
     **/
     private void writeTexts( Graphics2D g2 ) {
        double x, y;
       // Texts texts = theCommonValue.getTexts();
        Texts texts = new Texts();
        String s;
        int offSet = 40;
        
        g2.setColor( java.awt.Color.black );
        g2.setFont( new Font( FONT_NAME, 1, 12 ));
        FontMetrics fm = g2.getFontMetrics();
        
        for ( int i = 0; i < GUIConst.Y_AXIS_NUMBER; i++ ) {
           if ( theViewOptions.yDisableds[i] )
                return;
            s = texts.ValueAxises[i] + " ( " + theViewOptions.yUnits[i] + " )";
            if ( i % 2 == 0 ) {
                //x = LEFT_MARGIN + Y_AXIS_WIDTH * i - offSet;
                //y = yStarts[i].y - ( yLength - s.length() * SINGLE_LARGE_TEXT_WIDTH ) / 2;
                
                x = yStarts[i].x - yOffSet[i] - Y_AXIS_TITLE_GAP;
                y = yStarts[i].y - ( yLength - fm.stringWidth( s ) ) / 2;
                g2.rotate( - Math.PI / 2, x , y );
                g2.drawString( s, (float) x, (float) y );
                g2.rotate( Math.PI / 2, x , y );
            } else {
                //x = canvasW - RIGHT_MARGIN - Y_AXIS_WIDTH * ( i - 1 ) + offSet - 20;
                //y = yEnds[i].y + ( yLength - s.length() * SINGLE_LARGE_TEXT_WIDTH ) / 2 ;

                x = yStarts[i].x + yOffSet[i] + Y_AXIS_TITLE_GAP;
                y = yEnds[i].y + ( yLength - fm.stringWidth( s ) ) / 2;
                g2.rotate( Math.PI / 2, x , y );
                g2.drawString( s, (float) x, (float) y );
                g2.rotate( - Math.PI / 2, x , y );
            }
        }
    }
     
     
    /**
      *@author : be
      *@data   : Aug15,2008
      *@param  : Graphics2D
      *@desc   : draw the grid line for draw graphics
      */
      private void drawGridLines( Graphics2D g2 ) {
        GeneralPath gridLine = new GeneralPath();
        double x, y;
        
        // horizontal lines
        x = xEnd.x;
        for ( int i = 1; i < numOfYSteps[0]; i++ ) {
            y = xStart.y - i * yDivs[0];
            gridLine.moveTo( xStart.x, y );
            gridLine.lineTo( x, y );
        }
        
        // vertical lines
        for ( int i = 1; i < numOfXStep; i++ ) {
            x = xStart.x + i * xDiv;
            gridLine.moveTo( x, yStarts[0].y );
            gridLine.lineTo( x, yEnds[0].y );
        }
        
        float[] dash = {2.0f};
        g2.setStroke( new BasicStroke( 0.5f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10.0f, dash, 0.0f ));
        g2.setColor( java.awt.Color.LIGHT_GRAY );
        g2.draw( gridLine );
    }

 /**
    *@author : be
    *@date   : Aug15,2008
    *@param  : g : Graphics ; 
    *@return :
    */ 
    private void drawBaseLine(Graphics g) {
    
        Graphics2D g2 = (Graphics2D)g;
        String unit = this.theChannelHeader.getUnitText(); //.unit;
        float[] dash = {30.0f, 1f, 5f, 1f };
        g2.setStroke( new BasicStroke( 1.0f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10.0f, dash, 0.0f ));
        g2.setColor(FULLLOAD_LINE_COLOR);      
        theFullloadLine.setLine(xStart.x,theFullloadY,xEnd.x,theFullloadY);
        g2.draw( theFullloadLine );      
        String text = String.format( FULLLOAD_TYPE + " " + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("_Threshold_value_:_%10.1f_"), theFullLoadTempThresholdValue) + unit;
        g2.setColor(FULLLOAD_LINE_COLOR);
        g2.drawString( text, (float) rightYAxisX - 230f, (float)(theFullloadY-2) );

        //v3-9.
        //in the threshold setting graph dialog only 2 threshold lines will be shown -- full load line and shop line.
        //mofidy on 20091019. be.
//        g2.setColor(UNLOAD_LINE_COLOR);
//        theUnloadLine.setLine(xStart.x,theUnloadY,xEnd.x,theUnloadY);
//        g2.draw( theUnloadLine );
//        text = String.format( UNLOAD_TYPE + " " + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("_Threshold_value_:_%10.1f_"), theUnLoadTempThresholdValue ) + unit;
//        g2.setColor(UNLOAD_LINE_COLOR);
//        g2.drawString( text, (float) rightYAxisX - 230f, (float)(theUnloadY-2) );
        
        g2.setColor(NOLOAD_LINE_COLOR);  
        theNoloadLine.setLine(xStart.x,theNoloadY,xEnd.x,theNoloadY);
        g2.draw( theNoloadLine );
        text = String.format( NOLOAD_TYPE + " " + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("_Threshold_value_:_%10.1f_"), theNoLoadTempThresholdValue) + unit;
        g2.setColor(NOLOAD_LINE_COLOR);
        g2.drawString( text, (float) rightYAxisX - 230f, (float)(theNoloadY-2) );
     //  g2.dispose();
           
     
    } 
    

    
 /**
    *@author : be
    *@date   : Aug12, 2008
    *@desc   : initialze viewoptions
    */
    private void setViewOptionsValue() {
        if ( theChannelHeader != null ) { 
            theViewOptions.maxValues = new double[1];
            theViewOptions.minValues = new double[1];
            theViewOptions.maxValues[INDEX] = theChannelHeader.Max;
            theViewOptions.minValues[INDEX] = theChannelHeader.Min;
            theViewOptions.yUnits[INDEX] = theChannelHeader.getUnitText(); //.unit;                  
            theViewOptions.yResolutions[INDEX] = theChannelHeader.Resolution;
            theViewOptions.yDisableds[INDEX] = false;
        }   
       // theViewOptions.useAverage = 0;
        theViewOptions.startTime.setTime(theProtocolHeader.StartTime);
        theViewOptions.endTime.setTime(theProtocolHeader.StopTime);
//        theViewOptions.endTime.setTime(theProtocolHeader.StartTime+SHOW_TWO_HOURS);                     
    }
      
   
    
    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jPanelTitle = new javax.swing.JPanel();
        jLabelTitle = new javax.swing.JLabel();
        jPanelBottom = new javax.swing.JPanel();
        jPanel3 = new javax.swing.JPanel();
        jPanel4 = new javax.swing.JPanel();
        jPanelMain = new javax.swing.JPanel();
        Cancel = new javax.swing.JButton();
        OK = new javax.swing.JButton();

        setDefaultCloseOperation(javax.swing.WindowConstants.DISPOSE_ON_CLOSE);
        java.util.ResourceBundle bundle = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts"); // NOI18N
        setTitle(bundle.getString("Threshold_Setting")); // NOI18N
        setBackground(new java.awt.Color(239, 239, 234));
        setMinimumSize(new java.awt.Dimension(409, 86));
        setResizable(false);
        addWindowFocusListener(new java.awt.event.WindowFocusListener() {
            public void windowGainedFocus(java.awt.event.WindowEvent evt) {
                formWindowGainedFocus(evt);
            }
            public void windowLostFocus(java.awt.event.WindowEvent evt) {
            }
        });
        addWindowListener(new java.awt.event.WindowAdapter() {
            public void windowClosing(java.awt.event.WindowEvent evt) {
                formWindowClosing(evt);
            }
        });

        jPanelTitle.setPreferredSize(new Dimension( 100, 10 ));
        jPanelTitle.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.CENTER, 15, 10));

        jLabelTitle.setFont(new java.awt.Font("SansSerif", 1, 12));
        jLabelTitle.setText(bundle.getString("Threshold_Setting")); // NOI18N
        jPanelTitle.add(jLabelTitle);

        jPanelBottom.setPreferredSize(new java.awt.Dimension(0, 50));
        jPanelBottom.setLayout(new java.awt.BorderLayout());

        javax.swing.GroupLayout jPanel3Layout = new javax.swing.GroupLayout(jPanel3);
        jPanel3.setLayout(jPanel3Layout);
        jPanel3Layout.setHorizontalGroup(
            jPanel3Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 10, Short.MAX_VALUE)
        );
        jPanel3Layout.setVerticalGroup(
            jPanel3Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 20, Short.MAX_VALUE)
        );

        jPanelBottom.add(jPanel3, java.awt.BorderLayout.WEST);

        javax.swing.GroupLayout jPanel4Layout = new javax.swing.GroupLayout(jPanel4);
        jPanel4.setLayout(jPanel4Layout);
        jPanel4Layout.setHorizontalGroup(
            jPanel4Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 10, Short.MAX_VALUE)
        );
        jPanel4Layout.setVerticalGroup(
            jPanel4Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 20, Short.MAX_VALUE)
        );

        jPanelBottom.add(jPanel4, java.awt.BorderLayout.EAST);

        jPanelMain.addAncestorListener(new javax.swing.event.AncestorListener() {
            public void ancestorMoved(javax.swing.event.AncestorEvent evt) {
                jPanelMainAncestorMoved(evt);
            }
            public void ancestorAdded(javax.swing.event.AncestorEvent evt) {
            }
            public void ancestorRemoved(javax.swing.event.AncestorEvent evt) {
            }
        });

        javax.swing.GroupLayout jPanelMainLayout = new javax.swing.GroupLayout(jPanelMain);
        jPanelMain.setLayout(jPanelMainLayout);
        jPanelMainLayout.setHorizontalGroup(
            jPanelMainLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 828, Short.MAX_VALUE)
        );
        jPanelMainLayout.setVerticalGroup(
            jPanelMainLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 389, Short.MAX_VALUE)
        );

        Cancel.setText(bundle.getString("Cancel")); // NOI18N
        Cancel.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonCancelActionPerformed(evt);
            }
        });

        OK.setText(bundle.getString("OK")); // NOI18N
        OK.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                OKActionPerformed(evt);
            }
        });

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(getContentPane());
        getContentPane().setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                    .addComponent(jPanelMain, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                    .addGroup(javax.swing.GroupLayout.Alignment.TRAILING, layout.createSequentialGroup()
                        .addComponent(jPanelTitle, javax.swing.GroupLayout.DEFAULT_SIZE, 818, Short.MAX_VALUE)
                        .addContainerGap())
                    .addGroup(javax.swing.GroupLayout.Alignment.TRAILING, layout.createSequentialGroup()
                        .addComponent(jPanelBottom, javax.swing.GroupLayout.DEFAULT_SIZE, 818, Short.MAX_VALUE)
                        .addContainerGap())
                    .addGroup(layout.createSequentialGroup()
                        .addGap(596, 596, 596)
                        .addComponent(OK, javax.swing.GroupLayout.PREFERRED_SIZE, 90, javax.swing.GroupLayout.PREFERRED_SIZE)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.UNRELATED)
                        .addComponent(Cancel, javax.swing.GroupLayout.PREFERRED_SIZE, 90, javax.swing.GroupLayout.PREFERRED_SIZE)
                        .addContainerGap())))
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(jPanelTitle, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(jPanelMain, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(jPanelBottom, javax.swing.GroupLayout.PREFERRED_SIZE, 20, javax.swing.GroupLayout.PREFERRED_SIZE)
                .addGap(24, 24, 24)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(Cancel)
                    .addComponent(OK))
                .addContainerGap())
        );

        pack();
    }// </editor-fold>//GEN-END:initComponents

    private void formWindowGainedFocus(java.awt.event.WindowEvent evt) {//GEN-FIRST:event_formWindowGainedFocus
        repaint();
    }//GEN-LAST:event_formWindowGainedFocus

    private void jPanelMainAncestorMoved(javax.swing.event.AncestorEvent evt) {//GEN-FIRST:event_jPanelMainAncestorMoved
// TODO add your handling code here:
        if(!this.theDraw){
            this.repaint();
            Graphics2D g2 = ( Graphics2D )theOffScreenG;
            g2.setColor( java.awt.Color.black );
            g2.draw( theXAxis );
            writeXAxisText( g2 );
            for ( GeneralPath yAxis : yAxises ) {
                g2.draw( yAxis );
            }
            writeYAxisesText( g2 );
            writeTexts( g2 );
            g2.setColor(new Color(48,199,55));
        }
        // g2.dispose();
    }//GEN-LAST:event_jPanelMainAncestorMoved

    private void formWindowClosing(java.awt.event.WindowEvent evt) {//GEN-FIRST:event_formWindowClosing
        isCanceled = true;   
        this.clear();
    }//GEN-LAST:event_formWindowClosing

    private void OKActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_OKActionPerformed
        isCanceled = false;       
        this.setFullLoadThreshold(theFullLoadTempThresholdValue);
        //v3-9.
        //in the threshold setting graph dialog only 2 threshold lines will be shown -- full load line and shop line.
        //mofidy on 20091019. be.
//        this.setUnLoadThreshold(theUnLoadTempThresholdValue);
        this.setNoLoadThreshold(theNoLoadTempThresholdValue);;
        this.clear();
       
    }//GEN-LAST:event_OKActionPerformed
    
    private void jButtonCancelActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonCancelActionPerformed
        isCanceled = true;
        clear();
    }//GEN-LAST:event_jButtonCancelActionPerformed
    
   private void clear(){
        if(theOffScreenG != null){
            theOffScreenG.dispose();
        }
        this.theOffScreenBuf = null;
        this.theDraw = true;
        dispose();
    }
   /*set and get property
    /*-----------begin -------------
     */
    DecimalFormat   df   =   new   DecimalFormat("0.#"); 
    public void setFullLoadThreshold(double value){       
       
        theFullloadY = calculateThresholdLineData(value);    
        theFullLoadTempThresholdValue = value;  
        this.theFullLoadThresholdValue = Double.valueOf( GUIConst.VerifyString( df.format(value) ));
    }
    
    public double getFullLoadThreshold(){
        return this.theFullLoadThresholdValue;
    }
    
    public void setUnLoadThreshold(double value){
     
        theUnloadY = calculateThresholdLineData(value);      
        theUnLoadTempThresholdValue = value;
        this.theUnLoadThresholdValue = Float.valueOf( GUIConst.VerifyString( df.format(value)));
    }
    
    public double getUnLoadThreshold(){
        return this.theUnLoadThresholdValue;
    }
    
    public void setNoLoadThreshold(double value){    
   
        theNoloadY = calculateThresholdLineData(value);
        theNoLoadTempThresholdValue = value;
        this.theNoLoadThresholdValue = Float.valueOf( GUIConst.VerifyString( df.format(value) ));
    }
    
    public double getNoLoadThreshold(){
        return this.theNoLoadThresholdValue;
    }
    /**-------------- end -----------------*/
    
//    private class ViewChannelData extends ViewChannel {
//        public ViewChannelData() {
//            
//        }
//        
//        public ViewChannelData(ViewChannel vc) {
//            this.pref = vc.pref;
//            this.uuid = vc.uuid;
//            this.channel = vc.channel;
//            this.fullChannelName = vc.fullChannelName;
//            this.unit = vc.unit;
//            this.color = new Color( vc.color.getRGB() );
//            this.lineStyle = vc.lineStyle;
//            
//            this.chheader = new NChannelHeader();
//            this.chheader.copy( vc.chheader );
//            this.startTimeMilli = vc.startTimeMilli;
//            this.endTimeMilli = vc.endTimeMilli;
//            this.sampleRate = vc.sampleRate;
//            
//            this.colorChanged = vc.colorChanged;
//            this.colorIndex = vc.colorIndex;
//
//            this.numOfSamples = vc.numOfSamples;
//            this.queryStartID = vc.queryStartID;
//            this.queryEndID = vc.queryEndID;
//            this.currentPage = vc.currentPage;
//            this.totalPages = vc.totalPages;
//            this.nextPage = vc.nextPage;
//            this.viewStartID = vc.viewStartID;
//            this.viewEndID = vc.viewEndID;
//            
//        }
//        
//        int[] ids;
//        int[] origIDs;
//        double[] values;
//        double[] origValues;
//        double maxValue = 0;
//        double minValue = 0;
//        
//        int yAxisIndex = 0;
//        
//        Point startPoint = new Point();
//    } 
    
    /***show baseline of threshold ----------- begin**/
    
   /*  private void testShowLine(Graphics2D g2){
         Line2D testL = new Line2D.Float();
      float yT = 30.0F;
     float y1 = yT*this.yDivs[0];
     float yd = y1/this.yDataDivs[0];
     float y = this.yStarts[0].y-yd;
      System.out.println("yDataDivs[0] ="+yDataDivs[0]);
       System.out.println("yDivs[0] ="+yDivs[0]);
        System.out.println("y1 ="+y1);
         System.out.println("y ="+y);
        testL.setLine(xStart.x,y,xEnd.x,y);
         g2.setColor( java.awt.Color.RED );
        g2.draw(testL);
        System.out.println("xStart.x,y ="+xStart.x+"===="+y);
        System.out.println("testL ="+testL);
          g2.setColor( java.awt.Color.RED );
        g2.drawString("be test",xStart.x,y);            
     }*/
     
      /**
      *@param  : threshold value of current channel 
      *@return : calculate y value according to threshold value 
      */
     private double calculateThresholdLineData(double value) {              
         return yStarts[vcd.yAxisIndex].y - ( value - yDataStarts[vcd.yAxisIndex] ) * yLength / yDataLengths[vcd.yAxisIndex];
//         return (double)yStarts[INDEX].y-(double)(yDivs[INDEX]*value)/(double)yDataDivs[INDEX];            
    }
     
     /**
      *@param  : threshold value of current channel 
      *@return : calculate y data according to y value 
      */
    private double calculateTempThresholdLineData(double value) { 
        return ((double)yStarts[INDEX].y-value)*yDataLengths[vcd.yAxisIndex]/yLength+yDataStarts[INDEX]; 
//         return ((double)yDataDivs[INDEX]*((double)yStarts[INDEX].y-value + yDataStarts[INDEX]))/(double)yDivs[INDEX];            
    }
     
    public boolean userCanceled() {
        return isCanceled;
    }
    
    
    /**show baseline of threshold ----------- end***/
    
 
     
    /**-------------add zoom function ,nov12,2008------------begin*/    
    /**
     * adjust start and end value of x axis when zoom.
     */
    private void adjustZoomStartEnd() {
        int x1 = zoomStart.x;
        int x2 = zoomEnd.x;
        int y1 = zoomStart.y;
        int y2 = zoomEnd.y;
        zoomStart.setLocation(Math.min(x1, x2), Math.min(y1, y2));
        zoomEnd.setLocation(Math.max(x1, x2), Math.max(y1, y2));
        
        if (zoomStart.x < (int)xStart.x) zoomStart.x = (int)xStart.x;
        if (zoomStart.x > (int)xEnd.x) zoomStart.x = (int)xEnd.x;
        if (zoomEnd.x < (int)xStart.x) zoomEnd.x = (int)xStart.x;
        if (zoomEnd.x > (int)xEnd.x) zoomEnd.x = (int)xEnd.x;
    }
    
    /***
     * draw graphics when zoom .
     */
    private void zoomDrawing() {
        adjustZoomStartEnd();
 
        // we dont zoom unless it makes sense
        if ( zoomEnd.x - zoomStart.x > MINIMUM_ZOOM_X_LENGTH &&
             zoomEnd.y - zoomStart.y > MINIMUM_ZOOM_Y_LENGTH ) {
            calculateXDataAndRecordStartEnd();                 
            isZooming = true;
            
            if(isZooming){
                lines.clear();

                this.initQueryId(vcd, theViewOptions.startTime.getTime(), theViewOptions.endTime.getTime());

                reReadData();

            }
            
            theDraw = true;
            repaint();
        } else {
            isZooming = false;
            theDraw = false;
        }

    }
   
    /***
     * calculate x's data and start and end of record's id to draw zoom-graphics.
     */
     private boolean calculateXDataAndRecordStartEnd() {
        double ratioStart, ratioEnd;
        int zoomRecordStartID, zoomRecordEndID;
        int zoomRecordStart, zoomRecordEnd;
        long zoomXDataStart, zoomXDataEnd;
       
        
        ratioStart = ( (double)zoomStart.x - (double)xStart.x ) / (double)xLength;
        ratioEnd = ( (double)zoomEnd.x - (double)xStart.x ) / (double)xLength;
        
        // the zoom time start and end
        zoomXDataStart = (long) ( xDataStart + ratioStart * xDataLength );
        zoomXDataEnd = (long) ( xDataStart + ratioEnd * xDataLength );

        // now the records
        for (int i = 0; i < selectedChannelDatas.size(); i++) {
            ViewChannelData vcd = selectedChannelDatas.get(i);
            int size = vcd.values.length;
            
                //zoomRecordStart = (int) ( size * ratioStart );
                //zoomRecordEnd = (int) ( size * ratioEnd );
                zoomRecordStart = 0;
                zoomRecordEnd = size - 1;
                //zoomRecordEnd = (int) ( size * ratioEnd );
                //zoomRecordStartID = (int) ( (float) ( zoomXDataStart - theProtocolHeader.stime.getTime() ) / (float) ( theProtocolHeader.srate * 1000 ) );
                zoomRecordStartID = (int) ( (double) ( zoomXDataStart - theProtocolHeader.StartTime ) / (double) ( theProtocolHeader.SampleRate * theProtocolHeader.SampleRateFactor ) );
                zoomRecordEndID = (int) ( (double) ( zoomXDataEnd - theProtocolHeader.StartTime ) / (double) ( theProtocolHeader.SampleRate * theProtocolHeader.SampleRateFactor ) );
                
                if ( zoomRecordEndID - zoomRecordStartID < MINIMUM_ZOOM_RECORD_NUMBER ) return false;
                
                boolean startNotSet = true; // if the starting point is in power loss period, the starting recordID may not match calculation
                
                for ( int recordID = 0; recordID < size; recordID++ ) {
                    if ( startNotSet && vcd.ids[recordID] >= zoomRecordStartID ) { 
                        zoomRecordStart = recordID;
                        startNotSet = false;
                    } else if ( vcd.ids[recordID] >= zoomRecordEndID ) {
                        if ( vcd.ids[recordID] == zoomRecordEndID ) 
                            zoomRecordEnd = recordID;
                        else
                            zoomRecordEnd = recordID - 1;
                        break;
                    }
                }
                
            try {
                vcd.origIDs = vcd.ids;
                vcd.origValues = vcd.values;
                vcd.values = new double[zoomRecordEnd - zoomRecordStart];
                vcd.ids = new int[zoomRecordEnd - zoomRecordStart];
                for (int j = 0; j < vcd.values.length; j++) {
                    vcd.ids[j] = vcd.origIDs[zoomRecordStart + j];
                    vcd.values[j] = vcd.origValues[zoomRecordStart + j];
                }
                //selectedChannelDatas.add(vcd);
                // re-adjust the starting time according the sartID coz the start time may fall in the power loss area
                //origXDataStart = vcd.ids[0] * (myPHeader.srate * 1000) + myPHeader.stime.getTime();
            } catch (Exception e) {}
        }
        
        // the time start and end
        xDataStart = zoomXDataStart;
        xDataEnd = zoomXDataEnd;
        xDataDiv = ( zoomXDataEnd - zoomXDataStart ) / numOfXStep; 

        return true;
    }
 
    /***
     *draw zooming rectangle to show where of graphics to be zoom.
     */
    private void drawZoomingRectangle(Graphics2D g2) {
        adjustZoomStartEnd();
        Color originalColor = g2.getColor();

        float dash[] = {10.0f};
        g2.setStroke(new BasicStroke(0.0f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10.0f, dash, 0.0f));   
        g2.setColor(Color.GRAY);        
        g2.draw(zoomLines);

        g2.setColor(originalColor);
    }
    
    
    
 private void resetLines(Graphics2D g2) {
     
//        lines.clear();
        int recordLength;
        double valueLength;
        long startTime, endTime;
        long timeLength = xDataEnd - xDataStart;
        int startID, endID;
        int startNo, endNo;
        double srate;
        double x, y;
        double value;
        double xRatio, yRatio;
        double xActualStart;  // the start time of x axis normally don't match that of the protocol header
        boolean previousDataValid; // see if previous data is valid, if yes, then draw lines, no, then dont draw 
        int recordSteps;  // if user choose using average value
        //boolean startPointNotDefine;  // flag showing if start point is defined
        
        long key ;
        GeneralPath line = new GeneralPath();
        
        for ( ViewChannelData vcd : selectedChannelDatas ) {
            
           key = vcd.pref + vcd.chheader.ChannelNumber;
           line = lines.get(key);
           if(line == null){
               lines.put(key, new GeneralPath());
               line = lines.get(key);
           }
            
            if ( vcd.ids == null || vcd.ids.length == 0 ) return;
                        
//            GeneralPath line = new GeneralPath();
            
        valueLength = vcd.maxValue - vcd.minValue;
        recordLength = vcd.values.length;

        recordSteps = recordLength;
        
            
//            // find out how many records to average for 1 point
//            switch ( theViewOptions.useAverage ) {
//                case ViewOptions.AVERAGE_15_MINUTE: recordSteps = 15 * 60 / vcd.sampleRate; break;
//                case ViewOptions.AVERAGE_1_HOUR: recordSteps = 60 * 60 / vcd.sampleRate; break;
//                case ViewOptions.AVERAGE_1_MINUTE: recordSteps = 60 / vcd.sampleRate; break;
//                default: recordSteps = 1; break;
//            }
//            if ( recordSteps < 1 ) recordSteps = 1;

            srate = vcd.sampleRate * 1000;

            xRatio = ( xEnd.x - xStart.x ) * srate / timeLength;

            startTime = xDataStart;

            endTime = xDataEnd;
            if ( startTime > vcd.endTimeMilli || endTime < vcd.startTimeMilli ) return;
            startID = (int) (( startTime - vcd.startTimeMilli ) / srate );
            endID = (int) (( endTime - vcd.startTimeMilli ) / srate );
            
            recordLength = vcd.values.length;
            startNo = 0; endNo = 0;
            for ( int i = 0; i < recordLength; i++ ) {
                if ( vcd.ids[i] >= startID ) {
                    startNo = i;
                    break;
                }
            }
            for ( int i = recordLength - 1; i >= 0; i-- ) {
                if ( vcd.ids[i] <= endID ) {
                    endNo = i;
                    break;
                }
            }

            xActualStart = ( ( vcd.startTimeMilli + vcd.ids[startNo] * srate ) - xDataStart ) / srate * xRatio + xStart.x;            
           
            // to the beginning
            x = xActualStart;
            yRatio = yLength / yDataLengths[vcd.yAxisIndex];
            // see if it's invalid
            if ( vcd.values[startNo] == CSMDF.INVALID_MEASUREMENT_VALUE 
                    || vcd.values[startNo] == CSMDF.OVERANGE_MEASUREMENT_VALUE ) {
                y = 0;
                previousDataValid = false;
            } else {
                y = yStarts[vcd.yAxisIndex].y - ( vcd.values[startNo] - yDataStarts[vcd.yAxisIndex] ) * yRatio;
                previousDataValid = true;
            }
            line.moveTo( x, y );
            vcd.startPoint.setLocation( x, y );
            
            int beginID = vcd.ids[startNo];         
           
            for ( int i = startNo + 1; i <= endNo; i++ ) {
            // temp: for ( int i = startID + 1; i <= endID; i+= 100 ) {
                x = (vcd.ids[i] - beginID) * xRatio + xActualStart;
                if ( x > rightYAxisX ) break;
                // see if it's invalid
                if ( vcd.values[i] == CSMDF.INVALID_MEASUREMENT_VALUE || vcd.values[i] == DBController.OVERANGE_MEASUREMENT_VALUE ) {
                    y = 0;
                    previousDataValid = false;
                    line.moveTo( x, y );
                } else {
                    y = yStarts[vcd.yAxisIndex].y - ( vcd.values[i] - yDataStarts[vcd.yAxisIndex] ) * yRatio;
                    if ( previousDataValid ) 
                        line.lineTo( x, y );
                    else
                        line.moveTo( x, y );
                    previousDataValid = true;
                }
              
            } // for loop

            xDataLength = xDataEnd - xDataStart ;
//            lines.add( line );
        }
}
    
    /**-------------add zoom function ,nov12,2008------------end*/
    
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton Cancel;
    private javax.swing.JButton OK;
    private javax.swing.JLabel jLabelTitle;
    private javax.swing.JPanel jPanel3;
    private javax.swing.JPanel jPanel4;
    private javax.swing.JPanel jPanelBottom;
    private javax.swing.JPanel jPanelMain;
    private javax.swing.JPanel jPanelTitle;
    // End of variables declaration//GEN-END:variables
    
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
        }
      
        vcd.queryEndID = queryEndID;
        vcd.queryStartID = queryStartID;      
        vcd.totalValueCount = queryTotalIDs;
        vcd.viewStartID = onePageViewStartID;
        vcd.viewEndID = onePageViewEndID;     

        int screenWidthPoint = canvasW; 
        
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
   
        }      

        queryResult = null;
        if(valueList != null){
            valueList.clear();
            valueList = null;
        }
        
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
    
    
}
