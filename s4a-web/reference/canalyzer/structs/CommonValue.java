/*
 * CommonValue.java
 *
 * Created on 2007年3月15日, 下午4:03
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.structs;

import com.cs.canalyzer.gui.GUIConst;
import com.cs.database.CSMDF;
import com.cs.database.NChannelHeader;
import com.cs.database.NProtocolHeader;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.text.DateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.EventListener;
import java.util.Locale;
import javax.swing.JTable;

/**
 *
 * @author msu
 */
public class CommonValue extends javax.swing.JComponent {
    
    private NChannelHeader systemFlowChannelTmp = null;
    private static String TERMINAL_A = "A:";
    private static String TERMINAL_B = "B:";
    private static String TERMINAL_I = "I:";
    private static String TERMINAL_G = "G:";    
    private static String TERMINAL_E = "E:";
    private static String TERMINAL_F = "F:";
    
    private static String TERMINAL_I_ = "I";
    private static String TERMINAL_G_ = "G";    
    private static String TERMINAL_E_ = "E";
    private static String TERMINAL_F_ = "F";
    private static String TERMINAL_A_ = "A";
    private static String TERMINAL_B_ = "B";
    
    private static String TERMINAL_M_ = "M";
    private static String TERMINAL_D_ = "D";
    private static String TERMINAL_V = "V:";
    private static String TERMINAL_1 = "1:";
    private static String TERMINAL_2 = "2:";
    private static String TERMINAL_3 = "3:";
    private static String TERMINAL_4 = "4:";
    private static String TERMINAL_5 = "5:";
    private static String TERMINAL_6 = "6:";
    private static String TERMINAL_7_8 = "7/8";
    /** Creates a new instance of CommonValue */
    public CommonValue() {
        myPHeaders = new ArrayList<NProtocolHeader>();
        myViewOptions = new ViewOptions();
        myAvailableChannels = new ArrayList<ViewChannel>();
        mySelectedChannels = new ArrayList<ViewChannel>();
        myCompressors = new ArrayList<Compressor>();
        myTexts = new Texts();
        myBasicSetting = new BasicSetting();
        
        myDatabaseInformations = new ArrayList<DatabaseInformation>();
        //myDatabaseInformations.add( new DatabaseInformation() );
        setSelectedDatabaseIndex( -1 );
        dbPath = DatabaseInformation.DEFAULT_DB_SUB_PATH;
        //myDB = new AnalyzerHSQLDBController();
        myDB = new CSMDF();
        //myDB.openDatabase( dbPath );
        
        myLeakStat = new LeakStatistics( myDB );
        addPropertyChangeListener( myLeakStat );
        
    }

    public void test( ArrayList<NProtocolHeader> l ) {
        System.out.println( "array " + l.size() ); 
    }
    
    public ArrayList<NProtocolHeader> getProtocolHeaders() {
        ArrayList<NProtocolHeader> pheaders = new ArrayList<NProtocolHeader>();
        for ( NProtocolHeader pheader : myPHeaders ) {
             NProtocolHeader newPHeader = new NProtocolHeader();
             newPHeader.copy( pheader );
             pheaders.add( newPHeader );
        }

        return pheaders;
    }
    
    public boolean setProtocolHeaders( final ArrayList<NProtocolHeader> pheaders ) {
        if ( pheaders == null ) return false;
        
        ArrayList<NProtocolHeader> oldValue = myPHeaders;
        myPHeaders = new ArrayList<NProtocolHeader>();
        
        for ( NProtocolHeader pheader : pheaders ) {
             NProtocolHeader newPHeader = new NProtocolHeader();
             newPHeader.copy( pheader );
             myPHeaders.add( pheader );
        }

        initViewOptionsAndSelectedChannels();
        setMinAndMaxValue();
        setViewOptionsStartAndEndTime();
        
        myReportType = DEFAULT_REPORT_TYPE;
        showCurrentValuesAsFlow = false;
        canStatistic = false;
        
        myCompressors.clear();
        
        firePropertyChangeEvent( new PropertyChangeEvent( this, PROTOCOL_HEADER_LIST, oldValue, pheaders ));
        //add by be july29,2008
        firePropertyChangeEvent( new PropertyChangeEvent( this, ANALYZE_SETTING_IS_ENABLE, null, null ));        
 
        return true;
    }
    
    private void initViewOptionsAndSelectedChannels() {
        myViewOptions = new ViewOptions();
        if ( myPHeaders.size() == 0 ) return;
        
        ViewChannel vc;
        //String chName;
        String fullChannelName;
        int colorIndex = 0;
        int channelIndex = 0;
        //ProtocolHeader pheader  = myPHeaders.get(0);
        
        // clear Y axis' units
        //for ( String yUnit : myViewOptions.yUnits ) yUnit = "";
        Arrays.fill( myViewOptions.yUnits, "" );
        Arrays.fill( myViewOptions.yResolutions, 2 );
        for ( boolean disabled : myViewOptions.yDisableds ) disabled = true;
        
        boolean lookingForFlowChannel = true;  // first time, look for flow channel
        boolean channelFound = false;
        
        do {
            myAvailableChannels.clear();
            mySelectedChannels.clear();
            for ( NProtocolHeader pheader : myPHeaders ) {
                
                //ArrayList<ChannelHeader> chheaderList = myDB.queryChannelHeader( pheader.pref );
                ArrayList<NChannelHeader> chheaderList = myDB.findChannelHeaders( pheader.Pref );
                //for (int i = 0; i < chheaderList.size(); i++) {
                //chheader = chheaderList.get(i);
                
                for ( NChannelHeader chheader : chheaderList ) {
                    //chName = chheader.name;
                    //if (chheader.name.length() == 0)    chName = String.valueOf(chheader.number);
                    //fullChannelName = chheader.dname +  " . " + chName + " (" + chheader.unit + ")";
                    
                    fullChannelName = this.getViewChannelFullName( pheader, chheader );
                    vc = new ViewChannel(String.valueOf(chheader.DeviceID), addNameTail( fullChannelName ), chheader, 
                            pheader.StartTime, pheader.StopTime, pheader.SampleRate * pheader.SampleRateFactor / 1000 , pheader.NumOfSamples);
//                    System.out.println("pheader.StartTime"+pheader.StartTime);
                    //System.out.println("colors are " + vc.color + "    " + viewOptions.ChannelColors[i] + "   " + vc.color.getClass() + "  " + viewOptions.ChannelColors[i].getClass());
                    vc.color = myViewOptions.ChannelColors[colorIndex];
                    colorIndex += 1;
                    vc.startTimeMilli = pheader.StartTime;//add by be on 20101012.
                    vc.endTimeMilli = myDB.calculateEndTime(pheader.Pref);//add by be on 20101012.  
                    vc.numOfSamples = ( vc.endTimeMilli/1000 - vc.startTimeMilli/1000)/pheader.SampleRate;
                    myAvailableChannels.add( vc );

//                     System.out.println("before mySelectedChannels.size() ="+mySelectedChannels.size());

                    if(mySelectedChannels.size() >= GUIConst.MAX_CHANNEL_ALLOW) continue;

                    // use the first channel's unit as the left y axis unit.
                    // second channel's unit (if different) as the right axis unit.
                    // for the other channels, if they don't match either y axis unit, then don't add them
                    // to selectedChannels.
                    boolean unitMatch = false;
                    for ( int j = 0; j < GUIConst.Y_AXIS_NUMBER; j++ ) {
                        if ( chheader.getUnitText().compareTo( myViewOptions.yUnits[j] ) == 0 ) {
                            mySelectedChannels.add( vc );
                            unitMatch = true;
                            break;
                        }
                    }
                    
//                    System.out.println("mySelectedChannels.size() ="+mySelectedChannels.size());

                    if ( lookingForFlowChannel ) {
                        if ( !MeasurementUnit.IsFlowRateUnit( chheader.getUnitText() ))
                            continue;
                    }
                    if ( !unitMatch && channelIndex < GUIConst.Y_AXIS_NUMBER ) {
                        channelFound = true;
                        myViewOptions.yUnits[channelIndex] = chheader.getUnitText();
                        myViewOptions.yResolutions[channelIndex] = chheader.Resolution;
                        myViewOptions.yDisableds[channelIndex] = false;
                        mySelectedChannels.add(vc);
                        channelIndex++;
                    }
                    
                } // channel headers loop
            } // pheaders loop
            if ( !channelFound )
                lookingForFlowChannel = false;  // no found, don't look any more
        } while ( !channelFound );
        
        //add on 20100512, BK's requirement: Fix the colours to the number of channels.
        if(mySelectedChannels != null){
            int myTmpIntLen = mySelectedChannels.size() ;
             if(myTmpIntLen > 0){
                 for(int index = 0; index < myTmpIntLen ; index++){
                      mySelectedChannels.get(index).color = myViewOptions.ChannelColors[index];
                 }
             }
        }
    }
    
    /** get the earlist start time and latest end time of all selected protocol headers.
     */ 
    private void setViewOptionsStartAndEndTime() {
        //for ( ProtocolHeader pheader : myPHeaders ) {
        NProtocolHeader pheader;
        for ( int i = 0; i < myPHeaders.size(); i++ ) {
            pheader = myPHeaders.get(i);
            if ( myViewOptions.startTime.getTime() >  pheader.StartTime || i == 0 ) {
                myViewOptions.startTime.setTime( pheader.StartTime );
            }
            if ( myViewOptions.endTime.getTime() < pheader.StopTime || i == 0 ) {
                myViewOptions.endTime.setTime( pheader.StopTime );
            }
        }

        if ( myPHeaders.size() > 1 ) {
            adjustViewChannelsStartTimeAndText();
        }
    }
    
    /** the theory is, if there're more than 1 protocol headers to comparism, then change every view channel's start time to
     * the same DATE of the ViewOption's start time, but add text at the beginning of the line to indicate its real date
     */
    private void adjustViewChannelsStartTimeAndText() {
        Calendar startTime = Calendar.getInstance();
//        startTime.setTimeZone(TimeZone.getTimeZone("GMT+10"));
//        System.out.println("CommonValue/adjustViewChannelsStartTimeAndText startTime getTimeZone().getID()="+startTime.getTimeZone().getID());
        Calendar vcTime = Calendar.getInstance();
//        vcTime.setTimeZone(TimeZone.getTimeZone("GMT+10"));
//        System.out.println("CommonValue/adjustViewChannelsStartTimeAndText vcTime getTimeZone().getID()="+vcTime.getTimeZone().getID());

        int startDate, startMonth, startYear;
        long origStartTimeMilli;
        
        startTime.setTimeInMillis( myViewOptions.startTime.getTime() );
        startDate = startTime.get( Calendar.DAY_OF_MONTH );
        startMonth = startTime.get( Calendar.MONTH );
        startYear = startTime.get( Calendar.YEAR );
        
        for ( ViewChannel vc : myAvailableChannels ) {
            origStartTimeMilli = vc.startTimeMilli;
            vcTime.setTimeInMillis( origStartTimeMilli );
            vc.lineStartDateText = DateFormat.getDateInstance( DateFormat.SHORT, Locale.GERMAN ).format( vcTime.getTime() );

            //delete on 20101012 by be.
//            vcTime.set( Calendar.DAY_OF_MONTH, startDate );
//            vcTime.set( Calendar.MONTH, startMonth );
//            vcTime.set( Calendar.YEAR, startYear );
//            vc.startTimeMilli = vcTime.getTimeInMillis();
//            vc.endTimeMilli = vc.endTimeMilli - ( origStartTimeMilli - vc.startTimeMilli  );
        }
    }

    /** set the min and max value of every selected unit
     */
    private void setMinAndMaxValue() {
        int size = mySelectedChannels.size();
        if ( size > 0 ) { 
            myViewOptions.maxValues = new double[size];
            myViewOptions.minValues = new double[size];
        } else {
            
        }
        
        for ( int i = 0; i < size; i++ ) {
            ViewChannel vc = mySelectedChannels.get(i);
            myViewOptions.maxValues[i] = vc.chheader.Max;
            myViewOptions.minValues[i] = vc.chheader.Min;
            for ( int j = 0; j < size; j++ ) {
                if ( j != i ) {
                    ViewChannel vc1 = mySelectedChannels.get(j);
                    if ( vc1.unit.compareTo( vc.unit ) == 0 ) {
                        myViewOptions.maxValues[i] = Math.max( myViewOptions.maxValues[i], vc1.chheader.Max );
                        myViewOptions.minValues[i] = Math.min( myViewOptions.minValues[i], vc1.chheader.Min );
                    }
                }
            }
        }
    }
        
    
    public ViewOptions getViewOptions() {
        ViewOptions option = new ViewOptions();
        option.copy( myViewOptions );
        return option;
    }
    
    public boolean setViewOptions( final ViewOptions option ) {
        ViewOptions oldValue = new ViewOptions();
        oldValue.copy( myViewOptions );
        myViewOptions.copy( option );
        firePropertyChangeEvent( new PropertyChangeEvent( this, VIEW_OPTIONS, oldValue, option ));
        return true;
    }
    
    public boolean setOnlyViewOptions( final ViewOptions option ) {
        ViewOptions oldValue = new ViewOptions();
        oldValue.copy( myViewOptions );
        myViewOptions.copy( option );
//        firePropertyChangeEvent( new PropertyChangeEvent( this, VIEW_OPTIONS, oldValue, option ));
        return true;
    }
    
    public ArrayList<ViewChannel> getAvailableChannels() {
        ArrayList<ViewChannel> vcs = new ArrayList<ViewChannel>();
        for ( ViewChannel vc : myAvailableChannels ) {
             ViewChannel newVC = new ViewChannel();
             newVC.copy( vc );
             vcs.add( newVC );
        }

        return vcs;
    }
    
    public ArrayList<ViewChannel> getSelectedChannels() {
        ArrayList<ViewChannel> vcs = new ArrayList<ViewChannel>();
        for ( ViewChannel vc : mySelectedChannels ) {
             ViewChannel newVC = new ViewChannel();
             newVC.copy( vc );
             vcs.add( newVC );
        }

        return vcs;
    }
    
    public boolean setSelectedChannels( final ArrayList<ViewChannel> vcs ) {
        if ( vcs == null ) return false;
        ArrayList<ViewChannel> oldValue = mySelectedChannels;
        mySelectedChannels = new ArrayList<ViewChannel>();
        for ( ViewChannel vc : vcs ) {
             ViewChannel newVC = new ViewChannel();
             newVC.copy( vc );
             mySelectedChannels.add( newVC );
        }

        setMinAndMaxValue();
        //delete on 20091020.be
        //reason : v3-11 : After selecting channel graph will remain same shape.
        //(selecting channel and setting scaling affect doesn't change time setting of main graph.)
//        setViewOptionsStartAndEndTime();
        
        firePropertyChangeEvent( new PropertyChangeEvent( this, SELECTED_CHANNEL, oldValue, mySelectedChannels ));
        return true;
    }
    
    /** this action is to taken after loading a previous saved report file.
     * Note: do not trigger the calculation for this event since Statistics is also one of the objects being loaded.
     */ 
    public void loadNewReportAction( ArrayList<NProtocolHeader> pheaders, ArrayList<ViewChannel> availableChannels, 
        ArrayList<ViewChannel> selectedChannels, ViewOptions viewOptions, LeakStatistics leakStat, 
        ArrayList<Compressor> compressors, Texts texts,BasicSetting basicSetting, int graphicViewStatus ) {
        myPHeaders = new ArrayList<NProtocolHeader>();
        
        for ( NProtocolHeader pheader : pheaders ) {
             NProtocolHeader newPHeader = new NProtocolHeader();
             newPHeader.copy( pheader );
             myPHeaders.add( pheader );
        }

        myAvailableChannels = availableChannels;
        mySelectedChannels = selectedChannels;
        
        myViewOptions.copy( viewOptions );
        showCurrentValuesAsFlow = false;

        myCompressors = compressors;
        //myCompressors.clear();
        
        if ( leakStat != null ) {
            removePropertyChangeListener( myLeakStat );
            this.myLeakStat = leakStat;
            myLeakStat.setDatabase( myDB );
            myLeakStat.setProtocolHeaders( myPHeaders, false );
            myLeakStat.unTriggerCalculate();
            addPropertyChangeListener( myLeakStat );
            canStatistic = true;
        }
        
        myTexts = texts;
        if(basicSetting!=null){
//            this.myBasicSetting = basicSetting;
            this.myBasicSetting.AddressLine1 = basicSetting.AddressLine1;
            this.myBasicSetting.AddressLine2 = basicSetting.AddressLine2;
            this.myBasicSetting.AddressLine3 = basicSetting.AddressLine3;
            this.myBasicSetting.CompanyName = basicSetting.CompanyName;
            this.myBasicSetting.Email = basicSetting.Email;
            this.myBasicSetting.Fax = basicSetting.Fax;
            this.myBasicSetting.Phone = basicSetting.Phone;
            this.myBasicSetting.ResponsiblePerson = basicSetting.ResponsiblePerson;
            this.myBasicSetting.Webpage = basicSetting.Webpage;
            
        }
        firePropertyChangeEvent( new PropertyChangeEvent( this, LOAD_REPORT, null, graphicViewStatus ));
    }
    
    
    public void firePropertyChangeEvent( PropertyChangeEvent event ) {
        EventListener[] listeners = listenerList.getListeners( PropertyChangeListener.class );
        for ( EventListener l : listeners ) 
            ((PropertyChangeListener) l).propertyChange( event );
    }
    
    public void addPropertyChangeListener( PropertyChangeListener listener ) {
        listenerList.add( PropertyChangeListener.class, listener );
    }

    public void firePropertyChange(String propertyName, boolean oldValue, boolean newValue) {

    }
    
    public void removePropertyChangeListener( PropertyChangeListener listener ) {
        listenerList.remove( PropertyChangeListener.class, listener );
    }
    
    
    public CSMDF getDataBase() {
        return myDB;
    }

    public boolean setDataBase( CSMDF db ) {
        if ( db == null )
            return false;
        
        this.myDB = db;
        firePropertyChangeEvent( new PropertyChangeEvent( this, DATABASE, null, db ));
        
        return true;
    }

    public int getReportType() {
        return myReportType;
    }

    public void setReportType( int reportType ) {
        int oldValue = this.myReportType;
        this.myReportType = reportType;
        if ( reportType != REPORT_TYPE_PERIOD )
            // setting report type period normally followed by setting view options ( start and end time ), no need to trigger event here.
            firePropertyChangeEvent( new PropertyChangeEvent( this, REPORT_TYPE, oldValue, reportType ));
    }
    
    public void setOnlyReportType( int reportType ) {
//        int oldValue = this.myReportType;
        this.myReportType = reportType;
//        if ( reportType != REPORT_TYPE_PERIOD )
//            // setting report type period normally followed by setting view options ( start and end time ), no need to trigger event here.
//            firePropertyChangeEvent( new PropertyChangeEvent( this, REPORT_TYPE, oldValue, reportType ));
    }
    
    /** when select report type as 'weekly report', user can choose if the week start from Monday or from the 
     * selected day. 
     */
    public boolean weekStartFromMonday() {
        return weekStartFromMonday;
    }

    /** when select report type as 'weekly report', user can choose if the week start from Monday or from the 
     * selected day. 
     */
    public void setWeekStartFromMonday( boolean startFromMonday ) {
        if ( weekStartFromMonday == startFromMonday ) 
            return;
        
        weekStartFromMonday = startFromMonday;
        if ( myReportType == REPORT_TYPE_WEEK )
            firePropertyChangeEvent( new PropertyChangeEvent( this, REPORT_TYPE, -1, myReportType ));
    }
    
    public void setReportTypeAndViewOptions ( int reportType, ViewOptions options ) {
        this.myReportType = reportType;
        ViewOptions oldValue = new ViewOptions();
        oldValue.copy( myViewOptions );
        myViewOptions.copy( options );
        firePropertyChangeEvent( new PropertyChangeEvent( this, VIEW_OPTIONS, oldValue, options ));
    }
    
    public void setLeakStatistics( final LeakStatistics leakStat ) {
        if ( leakStat == null ) return;
        removePropertyChangeListener( myLeakStat );
        this.myLeakStat = leakStat;
        myLeakStat.setDatabase( myDB );
        addPropertyChangeListener( myLeakStat );
        myLeakStat.setProtocolHeaders( myPHeaders );
        myLeakStat.triggerCalculate();
    }
    
    /** leak statistics is different from other object. it returns the pointer, not a clone.
     */
    public LeakStatistics getLeakStatistics() {
        return myLeakStat;
    }
    
    public Texts getTexts() {
        return myTexts;
    }
    
    public void setTexts( Texts texts ) {
        if ( texts == null ) return;
        
        Texts oldValue = myTexts;
        this.myTexts = texts;
        
        for ( int i = 0; i < MAX_LENGEND_NUMBER; i++ ) {
            String text = "";
            try {
                text = texts.Legends[i];
                mySelectedChannels.get(i).fullChannelName = text;
            } catch ( Exception e ) {}
        }
        
        firePropertyChangeEvent( new PropertyChangeEvent( this, TEXTS, oldValue, texts ));
    }
    
    public BasicSetting getBasicSetting() {
        return myBasicSetting;
    }
    
    public void setBasicSetting( final BasicSetting setting ) {
        if ( setting == null ) return;
        
        this.myBasicSetting = setting;
    }

    public ArrayList<DatabaseInformation> getDatabaseInformations() {
        return myDatabaseInformations;
    }
    
    public void setDatabaseInformations( final ArrayList<DatabaseInformation> dbs ) {
        if ( dbs != null ) myDatabaseInformations = dbs;
    }
    
//    public static String getViewChannelFullName( NProtocolHeader pheader, NChannelHeader chheader ) {
//        String fullName = "";
//        try {
//            fullName = chheader.getDescription().trim();
//            if ( fullName.length() == 0 ) fullName = "CH" + chheader.ChannelNumber;
//            fullName += " (" + chheader.getUnitText() + ") "+ " . ";
//            fullName += pheader.getDescription().trim() + " (Ref:" + pheader.Pref + ")";
//        } catch ( Exception e ) {}
//           
//        return fullName;
//    }
    public static String getViewChannelFullName( NProtocolHeader pheader, NChannelHeader chheader ) {
        String fullName = "";
        if(pheader != null){
            String idString = String.valueOf( pheader.DeviceID );
            if(idString != null){
//                int beginIndex = idString.length() - 4;
//                if ( beginIndex < 0 ) beginIndex = 0;
//                fullName = idString.substring( beginIndex, idString.length() ) + "_" +fullName;
                fullName = idString + "_"+fullName;
            }           
        }
        
        try {
            //TF's requirement: if sensor name is null, fullname = channalname+unit. Otherwise fullname = sensorname+unit.
            //changed on 20100709.
//            fullName = chheader.getDescription().trim();
//            if ( fullName.length() == 0 ) fullName = "CH" + chheader.ChannelNumber;
//            fullName += " (" + chheader.getUnitText() + ") "+ " . ";
//            fullName += pheader.getDescription().trim() + " (Ref:" + pheader.Pref + ")";
            
            
            
            if(chheader != null)
                if(chheader.getDescription() != null){
                    
                    if(chheader.newDeviceID<=0){    
                        fullName = chheader.getDescription().trim();
                        fullName += " (" + chheader.getUnitText() + ") ";   
                    }else{
                        //new device
                        if(chheader.subDeviceID==0){// IGEF
                            String tmp = null;
                            if(chheader.sensorID>100){
                                int sensorID = chheader.sensorID-100;
                                if(sensorID>14){
                                    tmp = TERMINAL_V;
                                }
                                switch(sensorID){
                                    case 1: tmp = TERMINAL_1;break;
                                    case 2: tmp = TERMINAL_2;break;
                                    case 3: tmp = TERMINAL_3;break;
                                    case 4: tmp = TERMINAL_4;break;                                    
                                    case 5: tmp = TERMINAL_5;break;                                    
                                    case 6: tmp = TERMINAL_6;break;                                    
                                }
                            }else{
                                if(chheader.sensorID>6+8){
                                    tmp = TERMINAL_V;
                                }else{
                                    switch(chheader.sensorID){
                                        case 1: 
                                            if(pheader.DeviceType==NProtocolHeader.DeviceType_S330
                                                ||pheader.DeviceType==NProtocolHeader.DeviceType_S331){
                                                tmp = TERMINAL_A;
                                            }else{
                                                tmp = TERMINAL_I;
                                            }                                            
                                            break;
                                        case 2:
                                            if(pheader.DeviceType==NProtocolHeader.DeviceType_S330
                                                ||pheader.DeviceType==NProtocolHeader.DeviceType_S331){
                                                tmp = TERMINAL_B;
                                            }else{
                                                tmp = TERMINAL_G;
                                            }
                                            
                                            break;
                                        case 3: tmp = TERMINAL_E;break;
                                        case 4: tmp = TERMINAL_F;break;                                   
                                    }
                                }
                            }
                            
//                            fullName = tmp+chheader.sensorDescription+" (" + chheader.getUnitText() + ") ";
                            fullName += tmp+chheader.sensorDescription+"/"+chheader.getDescription()+" (" + chheader.getUnitText() + ") ";
                        }else{
                            String modbusTermianlStr = null;
                            if(pheader.DeviceType==NProtocolHeader.DeviceType_DS350_P2
                                    ||pheader.DeviceType==NProtocolHeader.DeviceType_DS350_P4
                                    ||pheader.DeviceType==NProtocolHeader.DeviceType_DS350_P6){
                                modbusTermianlStr = TERMINAL_7_8;
                            }else{
                                if(pheader.DeviceType==NProtocolHeader.DeviceType_S330
                                    ||pheader.DeviceType==NProtocolHeader.DeviceType_S331
                                        ||pheader.DeviceType==NProtocolHeader.DeviceType_S551_P4
                                        ||pheader.DeviceType==NProtocolHeader.DeviceType_S551_P6
                                        ){
                                    modbusTermianlStr = TERMINAL_M_;
                                }else{
                                    modbusTermianlStr = TERMINAL_D_;
                                }
                            }
                            if(chheader.subDeviceID>32768){
                                String tmp = null;
                                if(chheader.sensorID>100){
                                    int sensorID = chheader.sensorID-100;
                                    switch(sensorID){
                                        case 1: tmp = TERMINAL_1;break;
                                        case 2: tmp = TERMINAL_2;break;
                                        case 3: tmp = TERMINAL_3;break;
                                        case 4: tmp = TERMINAL_4;break;                                    
                                        case 5: tmp = TERMINAL_5;break;                                    
                                        case 6: tmp = TERMINAL_6;break;                                    
                                    }
                                }else{
                                    //check PM device cann't use IGEF
                                    int modbusDeviceID = chheader.subDeviceID;
                                    if(modbusDeviceID>32768){
                                        modbusDeviceID -= 32768;
                                    }
                                    modbusDeviceID -= chheader.slaveAddress;
                                    if(modbusDeviceID==NProtocolHeader.DeviceType_MODBUS_POWERMETER){
                                        fullName += modbusTermianlStr+":.../"+chheader.sensorDescription+"/"+chheader.getDescription();
                                        fullName += " (" + chheader.getUnitText() + ") ";   
                                        return fullName;
                                    }else if(modbusDeviceID==NProtocolHeader.DeviceType_MODBUS_MODBUS_ID_for_analog_input_module
                                            ||modbusDeviceID==NProtocolHeader.DeviceType_MODBUS_PULSE_ANALOGUE){
                                        fullName += modbusTermianlStr+":"+chheader.subDeviceDescription
                                                + "/"+chheader.sensorDescription+"/"+chheader.getDescription();
                                        fullName += " (" + chheader.getUnitText() + ") ";   
                                        return fullName;
                                    }
                                    else{
                                        switch(chheader.sensorID){
                                            case 1: 
                                                if(modbusDeviceID==NProtocolHeader.DeviceType_MODBUS_S330
                                                        ||modbusDeviceID==NProtocolHeader.DeviceType_MODBUS_S331){
                                                    tmp = TERMINAL_A_;
                                                }else{
                                                    tmp = TERMINAL_I_;
                                                }                             
                                            break;
                                            case 2: 
                                                if(modbusDeviceID==NProtocolHeader.DeviceType_MODBUS_S330
                                                        ||modbusDeviceID==NProtocolHeader.DeviceType_MODBUS_S331){
                                                    tmp = TERMINAL_B_;
                                                }else{
                                                    tmp = TERMINAL_G_;
                                                }
                                                
                                                break;
                                            case 3: tmp = TERMINAL_E_;break;
                                            case 4: tmp = TERMINAL_F_;break;
                                            default:   
                                                fullName += modbusTermianlStr+":"+chheader.subDeviceDescription
                                                        +"("+tmp+")"
                                                        +"/"+chheader.sensorDescription+"/"+chheader.getDescription();
                                                fullName += " (" + chheader.getUnitText() + ") "; 
                                                return fullName;
                                        }
                                    }
                                }
                                
                                fullName += modbusTermianlStr+":"+chheader.subDeviceDescription
                                        +"("+tmp+")"
                                        +"/"+chheader.sensorDescription+"/"+chheader.getDescription();
                                fullName += " (" + chheader.getUnitText() + ") "; 
                            }else{
                                fullName += modbusTermianlStr+":.../"+chheader.sensorDescription+"/"+chheader.getDescription();
                                fullName += " (" + chheader.getUnitText() + ") ";   
                            }
                        }
                    }                    
                }
        } catch ( Exception e ) {}

        return fullName;
    }
//    public static String getViewChannelFullName( NProtocolHeader pheader, NChannelHeader chheader ) {
//        String fullName = "";
//        if(pheader != null){
//            String idString = String.valueOf( pheader.DeviceID );
//            if(idString != null){
//                int beginIndex = idString.length() - 4;
//                if ( beginIndex < 0 ) beginIndex = 0;
//                fullName = idString.substring( beginIndex, idString.length() ) + "_" +fullName;
//            }           
//        }
//        try {
//            //TF's requirement: if sensor name is null, fullname = channalname+unit. Otherwise fullname = sensorname+unit.
//            //changed on 20100709.
////            fullName = chheader.getDescription().trim();
////            if ( fullName.length() == 0 ) fullName = "CH" + chheader.ChannelNumber;
////            fullName += " (" + chheader.getUnitText() + ") "+ " . ";
////            fullName += pheader.getDescription().trim() + " (Ref:" + pheader.Pref + ")";
//            if(chheader != null)
//                if(chheader.getDescription() != null){
//                    
//                    if(chheader.newDeviceID<=0){    
//                        fullName += chheader.getDescription().trim();
//                        fullName += " (" + chheader.getUnitText() + ") ";   
//                    }else{
//                        //new device
//                        if(chheader.subDeviceID==0){// IGEF
//                            String tmp = null;
//                            if(chheader.sensorID>100){
//                                int sensorID = chheader.sensorID-100;
//                                if(sensorID>14){
//                                    tmp = "V:";
//                                }
//                                switch(sensorID){
//                                    case 1: tmp = "1:";break;
//                                    case 2: tmp = "2:";break;
//                                    case 3: tmp = "3:";break;
//                                    case 4: tmp = "4:";break;                                    
//                                    case 5: tmp = "5:";break;                                    
//                                    case 6: tmp = "6:";break;                                    
//                                }
//                            }else{
//                                if(chheader.sensorID>6+8){
//                                    tmp = "V:";
//                                }else{
//                                    switch(chheader.sensorID){
//                                        case 1: tmp = "I:";break;
//                                        case 2: tmp = "G:";break;
//                                        case 3: tmp = "E:";break;
//                                        case 4: tmp = "F:";break;                                   
//                                    }
//                                }
//                            }
//                            
//                            fullName += tmp+chheader.sensorDescription+" (" + chheader.getUnitText() + ") ";
//                        }else{
//                            String modbusTermianlStr = null;
//                            if(pheader.DeviceType==NProtocolHeader.DeviceType_DS350_P2
//                                    ||pheader.DeviceType==NProtocolHeader.DeviceType_DS350_P4
//                                    ||pheader.DeviceType==NProtocolHeader.DeviceType_DS350_P6){
//                                modbusTermianlStr = "7/8";
//                            }else{                                
//                                modbusTermianlStr = "D";
//                            }
//                            if(chheader.subDeviceID>32768){
//                                String tmp = null;
//                                if(chheader.sensorID>100){
//                                    int sensorID = chheader.sensorID-100;
//                                    switch(sensorID){
//                                        case 1: tmp = "1:";break;
//                                        case 2: tmp = "2:";break;
//                                        case 3: tmp = "3:";break;
//                                        case 4: tmp = "4:";break;                                    
//                                        case 5: tmp = "5:";break;                                    
//                                        case 6: tmp = "6:";break;                                    
//                                    }
//                                }else{
//                                    //check PM device cann't use IGEF
//                                    int modbusDeviceID = chheader.subDeviceID;
//                                    if(modbusDeviceID>32768){
//                                        modbusDeviceID -= 32768;
//                                    }
//                                    modbusDeviceID -= chheader.slaveAddress;
//                                    if(modbusDeviceID==NProtocolHeader.DeviceType_MODBUS_POWERMETER){
//                                        fullName += modbusTermianlStr+":.../"+chheader.sensorDescription;
//                                        fullName += " (" + chheader.getUnitText() + ") ";   
//                                        return fullName;
//                                    }else if(modbusDeviceID==NProtocolHeader.DeviceType_MODBUS_MODBUS_ID_for_analog_input_module
//                                            ||modbusDeviceID==NProtocolHeader.DeviceType_MODBUS_PULSE_ANALOGUE){
//                                        fullName += modbusTermianlStr+":"+chheader.subDeviceDescription
//                                                + "/"+chheader.sensorDescription;
//                                        fullName += " (" + chheader.getUnitText() + ") ";   
//                                        return fullName;
//                                    }
//                                    else{
//                                        switch(chheader.sensorID){
//                                            case 1: tmp = "I";break;
//                                            case 2: tmp = "G";break;
//                                            case 3: tmp = "E";break;
//                                            case 4: tmp = "F";break;
//                                            default:   
//                                                fullName += modbusTermianlStr+":"+chheader.subDeviceDescription
//                                                        +"("+tmp+")"
//                                                        +"/"+chheader.sensorDescription;
//                                                fullName += " (" + chheader.getUnitText() + ") "; 
//                                                return fullName;
//                                        }
//                                    }
//                                }
//                                
//                                fullName += modbusTermianlStr+":"+chheader.subDeviceDescription
//                                        +"("+tmp+")"
//                                        +"/"+chheader.sensorDescription;
//                                fullName += " (" + chheader.getUnitText() + ") "; 
//                            }else{
//                                fullName += modbusTermianlStr+":.../"+chheader.sensorDescription;
//                                fullName += " (" + chheader.getUnitText() + ") ";   
//                            }
//                        }
//                    }                    
//                }
//        } catch ( Exception e ) {}
//
//        return fullName;
//    }
    
    public int getSelectedDatabaseIndex() {
        return selectedDatabaseIndex;
    }

    public void setSelectedDatabaseIndex( int selectedDatabaseIndex ) {
        this.selectedDatabaseIndex = selectedDatabaseIndex;
    }

    /** To force protocol header list dialog to update its list. Used after importation.
     */
    public void triggerProtoclHeaderListUpdate() {
        firePropertyChangeEvent( new PropertyChangeEvent( this, RENEW_HEADER, null, null ));        
    }
    
    /** if this is true, in the graph current value will be shown as flow
     */
    public boolean isShowCurrentValuesAsFlow() {
        return showCurrentValuesAsFlow;
    }

    /** if this is set to true, in the graph current value will be shown as flow
     */
    public void setShowCurrentValuesAsFlow(boolean showCurrentValuesAsFlow) {
        if ( this.showCurrentValuesAsFlow != showCurrentValuesAsFlow ) {
//            System.out.println("CommonValue/setShowCurrentValuesAsFlow1 = "+showCurrentValuesAsFlow);
            this.showCurrentValuesAsFlow = showCurrentValuesAsFlow;
//            System.out.println("CommonValue/setShowCurrentValuesAsFlow2 = "+showCurrentValuesAsFlow);
            firePropertyChangeEvent( new PropertyChangeEvent( this, 
                    SHOW_CURRENT_AS_FLOW, !showCurrentValuesAsFlow, showCurrentValuesAsFlow ));
        } else if ( showCurrentValuesAsFlow )           
            firePropertyChangeEvent( new PropertyChangeEvent( this, 
                    SHOW_CURRENT_AS_FLOW, !showCurrentValuesAsFlow, showCurrentValuesAsFlow ));
    }
    
    
    /**
     *@author : BE
     *@date : july 21, 2008
     */
     public void setAnalyzeButEnable() {
        firePropertyChangeEvent( new PropertyChangeEvent( this, ANALYZE_SETTING_IS_ENABLE, null, null ));        
    }
    
      /**
     *@author : BE
     *@date : july 22, 2008
     */
    public void setStatisticButEnable() {
        firePropertyChangeEvent( new PropertyChangeEvent( this, STATISTICS_IS_ENABLE, null, null ));        
    }
    
    
     /**
     *@author : BE
     *@date : july 29, 2008
     */
    public void setCanStatistic(boolean v){
        this.canStatistic = v ;
    }    
    public boolean getCanStatistic(){
        return this.canStatistic;
    }
    
    public void setCompressors( ArrayList<Compressor> compressors ) {
        if ( compressors != null ) {
            this.myCompressors = compressors;
            this.myLeakStat.setCompressors( compressors );
        }
    }
    /** Could be empty, won't be null.
     */
    public ArrayList<Compressor> getCompressors() {
        return myCompressors;
    }
//    public boolean setSelectedCompressor( Compressor compressor ) {
//        if ( compressor == null )
//            return false;
//        myLeakStat.setCompressor( compressor );
//        return true;
//    }
    
    /** Add an invisible tail to channel name to identify channels with same name.
     */
    private String addNameTail( String s ) {
        String result = s + nameTail;
        nameTail++; 
        if ( nameTail == 10 ) nameTail++;
        if ( nameTail >= 19 ) nameTail = 1; 
        
        return result;
    }
    
   public void setStatisticsTables( ArrayList<JTable> tables ) {
       this.statisticstables = tables;
   }

   public ArrayList<JTable> getStatisticsTables() {
       return statisticstables;
   }
    
    public final static String PROTOCOL_HEADER_LIST = "protocolHeaderList";
    public final static String VIEW_OPTIONS = "viewOptions";
    public final static String SELECTED_CHANNEL = "selectedChannel";
    public final static String REPORT_TYPE = "reportType";
    public final static String TEXTS = "texts";
    public final static String DATABASE = "database";
    public final static String RENEW_HEADER = "renewProtocolHeader";
    public final static String LOAD_REPORT = "loadReport";
    public final static String ANALYZE_SETTING_IS_ENABLE = "analyzeSettingIsEnable";
    public final static String STATISTICS_IS_ENABLE = "statisticsIsEnable";
    public final static String SHOW_CURRENT_AS_FLOW = "showCurrentAsFlow";
    
    public static final int MAX_LENGEND_NUMBER = 6;

    public final static int REPORT_TYPE_DAY = 0;
    public final static int REPORT_TYPE_WEEK = 1;
    public final static int REPORT_TYPE_MONTH = 2;
    public final static int REPORT_TYPE_PERIOD = 3;
    public final static int DEFAULT_REPORT_TYPE = REPORT_TYPE_DAY;
    private int myReportType;  // one day, week or month
    private boolean weekStartFromMonday;
    
    
    
    private ArrayList<NProtocolHeader> myPHeaders;
    private ViewOptions myViewOptions;
    
    private ArrayList<ViewChannel> myAvailableChannels;
    private ArrayList<ViewChannel> mySelectedChannels;
    private char nameTail = 1;  // a tail to add to channel name so that it can be distinguish 
    
    private Texts myTexts;
    private LeakStatistics myLeakStat;
    private BasicSetting myBasicSetting;
    
    private ArrayList<DatabaseInformation> myDatabaseInformations;
    private int selectedDatabaseIndex;
    //private DBController myDB;
    private com.cs.database.CSMDF myDB;
    private String dbPath;
    private boolean canStatistic = false;
    
    private ArrayList<Compressor> myCompressors;
    private boolean showCurrentValuesAsFlow = false;  // if this is selected, in the graph current value will be shown as flow

    private ArrayList<JTable> statisticstables;//statistics report tables .2009.09.28
    //add on 20091113 ,be
    private boolean showAsFlow = false;

    private boolean showFileChooser = false;

    /**
     * @return the showAsFlow
     */
    public boolean isShowAsFlow() {
        return showAsFlow;
    }

    /**
     * @param showAsFlow the showAsFlow to set
     */
    public void setShowAsFlow(boolean showAsFlow) {
        this.showAsFlow = showAsFlow;
    }

//    /**
//     * @return the showFileChooser
//     */
//    public boolean isShowFileChooser() {
//        return showFileChooser;
//    }
//
//    /**
//     * @param showFileChooser the showFileChooser to set
//     */
//    public void setShowFileChooser(boolean showFileChooser) {
//        this.showFileChooser = showFileChooser;
//    }

    /**
     * @return the systemFlowChannelTmp
     */
    public NChannelHeader getSystemFlowChannelTmp() {
        return systemFlowChannelTmp;
    }

    /**
     * @param systemFlowChannelTmp the systemFlowChannelTmp to set
     */
    public void setSystemFlowChannelTmp(NChannelHeader systemFlowChannelTmp) {
        this.systemFlowChannelTmp = systemFlowChannelTmp;
    }


}
