/*
 * ViewChannel.java
 *
 * Created on 2005年6月21日, 下午5:10
 */

package com.cs.canalyzer.structs;

import com.cs.database.NChannelHeader;
import java.awt.Color;
import java.io.Serializable;

/** This is a class representing the channels chosen by user to 
 * show in GraphicView or TableView.
 * @author  msu
 */
public class ViewChannel implements Serializable {

     private static final long serialVersionUID = -2284164991709719834L;
    /** Creates a new instance of ViewChannel */
    public ViewChannel() {
        autoSetColor();
    }

    /*public ViewChannel(String uuid, int channel, String fullChannelName, String unit) {
        this.uuid = uuid;
        this.channel = channel;
        this.fullChannelName = fullChannelName;
        this.unit = unit;
        
        autoSetColor();        
    }*/

    public ViewChannel(String uuid, String fullChannelName, NChannelHeader chheader, 
            long startTimeMilli, long endTimeMilli, int sampleRate, int numOfSamples ) {
        this.uuid = uuid;
        this.channel = chheader.ChannelNumber;
        this.fullChannelName = fullChannelName;
        this.unit = chheader.getUnitText();
        this.chheader = chheader;
        this.pref = chheader.Pref;
        this.startTimeMilli = startTimeMilli;
        this.endTimeMilli = endTimeMilli;
        this.sampleRate = sampleRate;
        this.numOfSamples = numOfSamples;
        autoSetColor();        
    }

    public void copy( ViewChannel vc ) {
        this.pref = vc.pref;
        this.uuid = vc.uuid;
        this.channel = vc.channel;
        this.fullChannelName = vc.fullChannelName;
        this.unit = vc.unit;
        this.color = new Color( vc.color.getRGB() );
        this.lineStyle = vc.lineStyle;

        this.chheader = new NChannelHeader();
        this.chheader.copy( vc.chheader );
        this.startTimeMilli = vc.startTimeMilli;
        this.endTimeMilli = vc.endTimeMilli;
        this.sampleRate = vc.sampleRate;
        this.colorChanged = vc.colorChanged;
        this.colorIndex = vc.colorIndex;

        this.lineStartDateText = vc.lineStartDateText;
        
        this.numOfSamples = vc.numOfSamples;
        this.queryStartID = vc.queryStartID;
        this.queryEndID = vc.queryEndID;
        this.currentPage = vc.currentPage;
        this.totalPages = vc.totalPages;
        this.nextPage = vc.nextPage;
        this.viewStartID = vc.viewStartID;
        this.viewEndID = vc.viewEndID;
    }
    
    
    private void autoSetColor() {
        /*colorCode = colorCode + COLOR_STEP;
        if (colorCode > 8388608) colorCode = colorCode - 8388608;
        color = new Color(colorCode);*/
        lineStyle = NORMAL_LINE;
        color = new Color( (int) (Integer.MAX_VALUE * Math.random()));
    }
    
    public long pref;   // protocol header reference number
    
    public String uuid = "";
    public int channel;
    // fullChannelName is a [DeviceName . ChannelName ([unit])]
    public String fullChannelName;
    public String unit = "";
    public Color color;
    public int lineStyle;
    
    public NChannelHeader chheader; // Channel Header
    public long startTimeMilli; // the start time of the protocol header
    public long endTimeMilli; // the end time of the protocol header
    public int sampleRate; // in second
    
    public String lineStartDateText = "";  // this text is used to show at the beginning of the line, the actual date of the data, when comparing different protocol headers
    
    // this integer is used to create color object
    private static int colorCode;
        
    //public final static int COLOR_STEP = 53456;
    
    // line style consts. note that the LINE_STYLE_STRING must be concurrent
    // with the DASHED_LINE and NORMAL_LINE defination
    public final static int DASHED_LINE = 0;
    public final static int NORMAL_LINE = 1;
    public final static String[] LINE_STYLE_STRING = {"---------", "_____"};
    //add on 20100512, MK's requirement
    public boolean colorChanged = false;
    public int colorIndex = -1;
    
    public long numOfSamples;  // Samples per channel
    public int queryStartID = 0;
    public int queryEndID = 0;
    public int viewStartID = 0;
    public int viewEndID = 0;
    public int currentPage = 0;
    public int totalPages = 0;
    public boolean nextPage = false;
    
}
