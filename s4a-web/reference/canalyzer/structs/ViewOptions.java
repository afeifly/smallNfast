/*
 * ViewOptions.java
 *
 * Created on 2005年6月24日, 下午12:11
 */

package com.cs.canalyzer.structs;

import com.cs.canalyzer.gui.*;
import java.awt.Color;
import java.io.Serializable;
import java.sql.Timestamp;
import java.util.Arrays;

/**
 *
 * @author  msu
 */
public class ViewOptions implements Serializable {
//    private static final long serialVersionUID=-1 ;
//    private static final long serialVersionUID = 4280925008692409701L;
    private static final long serialVersionUID= 4280925008692409701L;
    /** Creates a new instance of ViewOptions */
    public ViewOptions() {
        initArrays();
        initColors();
    }
    
    public void copy( ViewOptions option ) {
        yUnits = option.yUnits.clone();
        yResolutions = option.yResolutions.clone();
        yFroms = option.yFroms.clone();
        yTos = option.yTos.clone();
        ySteps = option.ySteps.clone();
        yAutomatics = option.yAutomatics.clone();
        yDisableds = option.yDisableds.clone();
        
        startTime.setTime( option.startTime.getTime() );
        endTime.setTime( option.endTime.getTime() );
        if ( option.maxValues != null ) maxValues = option.maxValues.clone(); else maxValues = null;
        if ( option.minValues != null ) minValues = option.minValues.clone(); else minValues = null;
        
        useAverage = option.useAverage;
    }
    
    private void initArrays() {
        yUnits = new String[GUIConst.Y_AXIS_NUMBER];
        Arrays.fill( yUnits, "" );
        yResolutions = new int[GUIConst.Y_AXIS_NUMBER];
        Arrays.fill( yResolutions, 2 );
        yFroms = new double[GUIConst.Y_AXIS_NUMBER];
        Arrays.fill( yFroms, 0 );
        yTos = new double[GUIConst.Y_AXIS_NUMBER];
        Arrays.fill( yTos, 100 );
        ySteps = new int[GUIConst.Y_AXIS_NUMBER];
        Arrays.fill( ySteps, 10 );
        yAutomatics = new boolean[GUIConst.Y_AXIS_NUMBER];
        Arrays.fill( yAutomatics, true );
        yDisableds = new boolean[GUIConst.Y_AXIS_NUMBER];
        Arrays.fill( yDisableds, true );
        yDisableds[0] = false;
        
//        public float[] yFroms = {0, 0, 0, 0};
//        public float[] yTos = {100, 100, 100, 100};
//        public int[] ySteps = {10, 10, 10, 10};
//        public boolean[] yAutomatics = {true, true, true, true};
//        public boolean[] yDisableds = {false, false, false, false};
        
    }
    
    private void initColors() {
        ChannelColors = new Color[GUIConst.MAX_COLOR_NUMBER];
        for ( int i = 0; i < ChannelColors.length; i++ ) 
            ChannelColors[i] = new Color( (float) Math.random(), (float) Math.random(), (float) Math.random() );
        // hard code some initial ones
         ChannelColors[0] = Color.RED;
         ChannelColors[1] = Color.BLUE;
         ChannelColors[2] = new Color(0,153,51) ;
         ChannelColors[3] = Color.ORANGE;
         ChannelColors[4] = Color.MAGENTA;
         ChannelColors[5] = new Color(102,0,0) ;//Color.GREEN ;
         ChannelColors[6] = Color.YELLOW;        
         ChannelColors[7] = Color.GREEN ;//Color.WHITE;
         ChannelColors[8] = Color.BLACK;
         ChannelColors[9] = Color.CYAN;
         ChannelColors[10] = Color.PINK ;
        


    }
    
    
     /** take axis indices as parameter
     */ 
    public boolean switchYAxisSettings( int axis1, int axis2 ) {
        if ( axis1 >= GUIConst.Y_AXIS_NUMBER || axis2 >= GUIConst.Y_AXIS_NUMBER || axis1 == axis2 )
            return false;
        
        String unit;    int resolution;        double value;        boolean b;      int i;
        
        unit = yUnits[axis1];
        yUnits[axis1] = yUnits[axis2];
        yUnits[axis2] = unit;
        
        resolution = yResolutions[axis1];
        yResolutions[axis1] = yResolutions[axis2];
        yResolutions[axis2] = resolution;
        
        value = yFroms[axis1];
        yFroms[axis1] = yFroms[axis2];
        yFroms[axis2] = value;
        
        value = yTos[axis1];
        yTos[axis1] = yTos[axis2];
        yTos[axis2] = value;

        i = ySteps[axis1];
        ySteps[axis1] = ySteps[axis2];
        ySteps[axis2] = i;
        
        b = yAutomatics[axis1];
        yAutomatics[axis1] = yAutomatics[axis2];
        yAutomatics[axis2] = b;

        b = yDisableds[axis1];
        yDisableds[axis1] = yDisableds[axis2];
        yDisableds[axis2] = b;
        
        value = maxValues[axis1];
        maxValues[axis1] = maxValues[axis2];
        maxValues[axis2] = value;

        value = minValues[axis1];
        minValues[axis1] = minValues[axis2];
        minValues[axis2] = value;
        
        return true;
    }
    
    
    public Color[] ChannelColors;
    
    
    // the selected Protocol Header and Channel Headers
    //public ProtocolHeader pheader = new ProtocolHeader();
    public static final int AVERAGE_NONE = 0;
    public static final int AVERAGE_1_MINUTE = 1;
    public static final int AVERAGE_15_MINUTE = 2;
    public static final int AVERAGE_1_HOUR = 3;
    //v3-13: provide more choices for "Use average value"
    //1,5,10,15,20,30,45 and 60 minutes.
    //add on 20091020.be.
    public static final int AVERAGE_5_MINUTE = 5;
    public static final int AVERAGE_10_MINUTE = 10;
    public static final int AVERAGE_20_MINUTE = 20;
    public static final int AVERAGE_30_MINUTE = 30;
    public static final int AVERAGE_45_MINUTE = 45;
    
    public final static long ONE_MINUTE_MILLS = 60000;
    public final static long ONE_HOUR_MILLS = 3600000;
    public final static long ONE_DAY_MILLS = 86400000;
    public final static long ONE_WEEK_MILLS = 604800000;
    public final static long ONE_MONTH_MILLS = (long) 2592 * 1000000;
    public final static int ONE_HOUR_UNIT = 0;
    public final static int ONE_DAY_UNIT = 1;
    public final static int ONE_MONTH_UNIT = 2;
    public final static String FUTURE = "3000-01-01 00:00:00";
    
    public String[] yUnits; // = {"", "", "", ""};
    public int[] yResolutions; 
    
    public double[] yFroms; // = {0, 0, 0, 0};
    public double[] yTos; // = {100, 100, 100, 100};
    public int[] ySteps; // = {10, 10, 10, 10};
    public boolean[] yAutomatics; // = {true, true, true, true};
    public boolean[] yDisableds; // = {false, false, false, false};
    
    // since there're multiple protocol headers, some header related information need to initialized
    public Timestamp endTime = new Timestamp( System.currentTimeMillis() );  // earlist start time and latest end time of all protocol headers
    public Timestamp startTime = new Timestamp( System.currentTimeMillis() - ONE_DAY_MILLS );  // earlist start time and latest end time of all protocol headers
    public double[] maxValues, minValues;   // max and min. every channel with the same unit will have same max and min
    
    public int useAverage = AVERAGE_NONE;
    
    // to indicate if the record need to be re-read from the database
    // in 2 cases it'll be set to false: at the beginning, at 'ViewConfig' change
    //public boolean dataUpdated = false;
    
}
