/*
 * ReportFile.java
 *
 * Created on 2008年3月4日, 下午12:22
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.structs;

import com.cs.canalyzer.gui.GraphicPanel;
import com.cs.canalyzer.structs.ViewOptions;
import com.cs.database.CSMDF;
import com.cs.database.DBMessage;
import com.cs.database.NProtocolHeader;
import com.cs.database.NChannelHeader;
import com.cs.database.NMeasurementRecordLine;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.util.ArrayList;

/**
 *
 * @author wolf
 */
public class ReportFile {
    
    /** Creates a new instance of ReportFile */
    public ReportFile( final CommonValue common,GraphicPanel gp ) {
        this.theCommonValue = common;
        this.myDB = common.getDataBase();
        this.graphicView = gp ;
    }
    
    /** Save report. type means: SAVE_REPORT_WITHOUT_DATA or SAVE_REPORT_WITH_DATA.
     *
     * Report file format:
     * Version ( int );
     * Type ( int )
     * ViewOptions
     * Statistics
     * 
     * ************ newly add ***********
     * Texts
     * ***********************************
     * 
     * Compressors number ( int )
     * Compressor 1
     * Compressor 2
     *  .......
     * Protocol Header number ( int )
     * Protocol Header 1
     * Protocol Header 2
     * Protocol Header 3
     * .........
     * Available Channel Header number ( int )
     * Available Channel Header 1
     * Available Channel Header 2
     * .....
     * Selected Channel Header number ( int )
     * Selected Channel Header 1
     * Selected Channel Header 2
     * ......
     * ......... below section has been changed;
     * <if with data> ChannelHeader number of ProtocolHeader 1
     *  <if with data> ChannelHeader 1 of ProtocolHeader 1
     *  <if with data> Measurement Records number
     *  <if with data> Measurement Records ....
     *  <if with data> ChannelHeader 2 of ProtocolHeader 1
     *  <if with data> ...
     * <if with data> ChannelHeader number of ProtocolHeader 2
     *  <if with data> ChannelHeader 1 of ProtocolHeader 2
     *  
     * ************************ changed to;
     *  <if with data> ChannelHeader 1 of ProtocolHeader 1
     *  <if with data> ChannelHeader 2 of ProtocolHeader 1
     *  <if with data> ...
     *  <if with data> id0, value0 of channel 1, value0 of channel 2 ...
     *  <if with data> id1, value1 of channel 1, value1 of channel 2 ...
     *  ........
     * <if with data> ChannelHeader number of ProtocolHeader 2
     *  <if with data> ChannelHeader 1 of ProtocolHeader 2
     * .........
     */
//    int pageLen = 60*1000*1000/8;
    public boolean saveReport( String fileName, int type ) {
        if (fileName == null || fileName.length() == 0) {
            return false;
        }
        if (!fileName.endsWith(REPORT_FILE_SUFFIX) && !fileName.endsWith(REPORT_FILE_SUFFIX_CAPTICAL)) {
            fileName += REPORT_FILE_SUFFIX;
        }
        try {
            ObjectOutputStream out = new ObjectOutputStream(new FileOutputStream(fileName));
            ArrayList<Compressor> compressors = theCommonValue.getCompressors();
            ArrayList<NProtocolHeader> pheaders = theCommonValue.getProtocolHeaders();
            ArrayList<NChannelHeader> chheaders;
            ArrayList<ViewChannel> availableChannels = theCommonValue.getAvailableChannels();
            ArrayList<ViewChannel> selectedChannels = theCommonValue.getSelectedChannels();
            ArrayList<NMeasurementRecordLine> mRecordLines = new  ArrayList<NMeasurementRecordLine>();
            double[] values;

            out.writeInt(Version);
            out.writeInt(type);
            out.writeObject(theCommonValue.getViewOptions());
            out.writeObject(theCommonValue.getLeakStatistics());            
            out.writeObject( theCommonValue.getTexts() );
            out.writeObject(theCommonValue.getBasicSetting());
            
            out.writeInt( compressors.size() );
            for ( Compressor compressor : compressors ) {
                out.writeObject( compressor );
            }
            
            out.writeInt(pheaders.size());
            for (NProtocolHeader pheader : pheaders) {
                out.writeObject(pheader);
            }

            out.writeInt(availableChannels.size());
            for (ViewChannel viewChannel : availableChannels) {
                out.writeObject(viewChannel);
            }

            out.writeInt(selectedChannels.size());
            for (ViewChannel viewChannel : selectedChannels) {
                out.writeObject(viewChannel);
            }

            if (type == SAVE_REPORT_WITH_DATA) {
                int pages = 0;
                int size = 0;
                int channelNos[] = null;
                NChannelHeader chheader;
                NProtocolHeader pheader;
                int queryStartId = 0;
                int queryEndId = 0;
                int pageLen = 0;
                for (int i = 0; i < pheaders.size(); i++) {
                    queryStartId = 0;
                    queryEndId = 0;
                    pages = 0;
                    size = 0;
                    pheader = pheaders.get(i);
                    //chheaders = myDB.queryChannelHeader( pheader.pref );
                    chheaders = myDB.findChannelHeaders(pheader.Pref);
                    if(chheaders != null){
                        size = chheaders.size();
                        channelNos = new int[size];
                    }
                    //out.writeInt(chheaders.size());
//                    for (NChannelHeader chheader : chheaders) {
                     for (int ii = 0; ii < size; ii++) {
                        chheader = chheaders.get(ii);
                        out.writeObject(chheader);
                        channelNos[ii] = chheader.ChannelNumber;
                    //mrecords = myDB.queryMeasurementRecord( chheader.cref );
                    //out.writeInt( mrecords.size() );
                    //for ( int j = 0; j < mrecords.size(); j++ ) {
                    //    out.writeObject( mrecords.get(j) );
                    //}
                    }
                    
                    pageLen = maxMemorySize/(8*size+4);  
                     
                    pages = pheader.NumOfSamples/pageLen;
                    if(pheader.NumOfSamples%pageLen > 0){
                        pages++;
                    }
                    
                    if(pages == 1){
                        queryStartId = 0;
                        queryEndId = pheader.NumOfSamples ;
                    }else if(pages > 1){
                        queryStartId = 0;
                        queryEndId = pageLen;
                     }else{
                        queryStartId = 0;
                        queryEndId = 0;
                     }

                    for(int n = 0; n < pages; n++){
                                               
                       mRecordLines = myDB.queryMeasurementRecord(pheader.Pref, channelNos, queryStartId, queryEndId);
                        
                       size = mRecordLines.size();
//                        mRecordLines = myDB.readAllMeasurementRecordLines(pheader);
                        for (int j = 0; j < size; j++) {
//                            if(n == 0 && j == 0){
//                                System.out.println(" first id="+mRecordLines.get(j).ID );
//                            }
//                            if(n == (pages - 1) && j == (size -1)){
//                                System.out.println(" last id="+mRecordLines.get(j).ID );
//                            }
                            out.writeInt( mRecordLines.get(j).ID );
                            values = mRecordLines.get(j).Values;
                            for ( int k = 0; k < values.length; k++ ) {
                                out.writeDouble( values[k] );
//                                if(n == 0 && j == 0){
//                                    System.out.println(" first value ="+values[k] );
//                                }
//                                if(n == (pages - 1) && j == (size -1)){
//                                    System.out.println(" last value ="+values[k] );
//                                }
                            }
                        }
                        queryStartId = queryEndId;
                        queryEndId += pageLen;
                        if(queryEndId > pheader.NumOfSamples){
                            queryEndId = pheader.NumOfSamples;
                        } 
                        if(mRecordLines != null){
                            mRecordLines.clear();
                            mRecordLines = null;
                        }
                    }
                }              
            }

            if(mRecordLines != null){
                mRecordLines.clear();
                mRecordLines = null;
            }
            //save stact view settings ----------- begin on 20110308
            int graphicViewStatus = graphicView.getStatus();
            if(graphicViewStatus == 2){ //STATUS_STACK_VIEW = 2;
                out.writeInt(graphicViewStatus);
            }
            //------------------------------------ end

            out.close();
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }

        return true;
    }
    
    /** load report and record file from a file.
     * rule: load Protocol Headers. if it's a report file without data, check if protocol headers existed 
     * in database, if not, return error. if it's a report file with data, check if protocol headers existed 
     * in datase, if yes, don't load the records, if no, load records as well. and the selected channels' pref 
     * and cref need to be changed to the new value.
     */
    public int loadReport( String fileName ) {
        ObjectInputStream in = null;
        try {
            ArrayList<Compressor> compressors = new ArrayList<Compressor>();
            Compressor compressor;
            ArrayList<NProtocolHeader> pheaders = new ArrayList<NProtocolHeader>();
            NProtocolHeader pheader;
            ArrayList<NChannelHeader> chheaders;
            ArrayList<ViewChannel> availableChannels = new ArrayList<ViewChannel>();
            ArrayList<ViewChannel> selectedChannels = new ArrayList<ViewChannel>();
            ViewChannel viewChannel;
            in = new ObjectInputStream( new FileInputStream( fileName ));
            boolean[] importDatas;  // if importing data required for individual protocol header
            boolean importDataRequired = false;  // if import is required at all
            
            int version = in.readInt();
            int type = in.readInt();
            ViewOptions viewOptions = (ViewOptions) in.readObject();
            LeakStatistics leakStat = (LeakStatistics) in.readObject();
            
            Texts texts = (Texts) in.readObject();
            BasicSetting basicSetting = null;
            if(version>=3)
                basicSetting = (BasicSetting)in.readObject();            
            int numOfCompressor = in.readInt();
            for ( int i = 0; i < numOfCompressor; i++ ) {
                compressor = (Compressor) in.readObject();
                compressors.add( compressor );
            }
            
            int numOfPHeader = in.readInt();
            importDatas = new boolean[numOfPHeader];
            for ( int i = 0; i < numOfPHeader; i++ ) {
                pheader = (NProtocolHeader) in.readObject();
                NProtocolHeader existingPHeader = myDB.findProtocolHeader( pheader.Pref ); //myDB.queryProtocolHeader( pheader.pref );
                if ( type == SAVE_REPORT_WITHOUT_DATA ) {
                    if ( !identicalPHeaders( pheader, existingPHeader ) ) {
                        return LOAD_REPORT_PHEADER_NOT_EXIST;
                    }
                } else {
                    if ( identicalPHeaders( pheader, existingPHeader ) ) {
                        // protocol header already exist, then don't import the data
                        importDatas[i] = false;
                    } else {
                        importDatas[i] = true;
                        importDataRequired = true;
                    }
                }
                
                pheaders.add( pheader );
            } // loop of pheaders
            
            int numOfAvailableChannel = in.readInt();
            for ( int i = 0; i < numOfAvailableChannel; i++ ) {
                viewChannel = (ViewChannel) in.readObject();
                availableChannels.add( viewChannel );
            }

            int numOfSelectedChannel = in.readInt();
            for ( int i = 0; i < numOfSelectedChannel; i++ ) {
                viewChannel = (ViewChannel) in.readObject();
                selectedChannels.add( viewChannel );
            }
            
            if ( type == SAVE_REPORT_WITH_DATA ) {
                NChannelHeader chheader; // oldCHHeader;
                //MeasurementRecord mrecord;
                //int numOfCHHeaders;
                int numOfMRecords;
                //int oldCref;
                int id;
                double[] values;
                ArrayList<NMeasurementRecordLine> mrecordLines;
                NMeasurementRecordLine mrecordLine;
                
                int pages = 0;
                int chCount = 0;
                int oneTimeReadIDs = 0;
                int pageLen = 0;
                for ( int i = 0; i < pheaders.size(); i++ ) {
                    pages = 0;
                    
                    oneTimeReadIDs = 0;
                    pageLen = 0;
                    pheader = pheaders.get(i);
                    chCount = pheader.NumOfChannels;
                    values = new double[chCount];
                   if ( !importDatas[i] ) {
                        // just read
                        //numOfCHHeaders = in.readInt();
//                        for ( int j = 0; j < pheader.NumOfChannels; j++ ) {
//                            chheader = (NChannelHeader) in.readObject();
//                        }
//                        for ( int j = 0; j < pheader.NumOfSamples; j++ ) {
//                            id = in.readInt();
//                            for ( int k = 0; k < pheader.NumOfChannels; k++ ) {
//                                //mrecord = (MeasurementRecord) in.readObject();
//                                values[k] = in.readDouble();
//                            }
//                        }
                   } else  {
                        // read and write into database
                        //if ( !myDB.addProtocolHeader( pheader ))
                        //    return LOAD_REPORT_WRITE_DATABASE_FAIL;
                        chheaders = new ArrayList<NChannelHeader>();
                        for ( int j = 0; j < chCount; j++ ) {
                            chheader = (NChannelHeader) in.readObject();
                            chheaders.add( chheader );
                        }
                        
                        int NumOfSamplesTmp = pheader.NumOfSamples;
                        pheader.NumOfSamples = 0;
                        if ( myDB.createRecordFileForReprot( "Report", pheader, chheaders, false ) != DBMessage.CSDB_OK )
                            return LOAD_REPORT_WRITE_DATABASE_FAIL;

//                        if(version >= this.Version){
//                              pages = in.readInt();               
//                        }
                        
                        pageLen = maxMemorySize/(8*chCount+4);  
                        
                        pheader.NumOfSamples = NumOfSamplesTmp;
                        
                        pages = pheader.NumOfSamples/pageLen;
                        if(pheader.NumOfSamples%pageLen > 0){
                            pages++;
                        }
                        if(pages == 1){
                            oneTimeReadIDs = pheader.NumOfSamples - 1;
                        }else{
                            oneTimeReadIDs = pageLen;
                        }
//                         System.out.println("pheader.NumOfSamples="+pheader.NumOfSamples);
                        for(int n = 1; n <= pages; n++){
 
                            if(n > 1 && (n*oneTimeReadIDs > pheader.NumOfSamples)){
                                oneTimeReadIDs = pheader.NumOfSamples-(n-1)*pageLen - 1;
                            }
                            
                            values = new double[chCount];
                            mrecordLines = new ArrayList<NMeasurementRecordLine>();
//                            for ( int j = 0; j < pheader.NumOfSamples; j++ ) {
//                            System.out.println("oneTimeReadIDs="+oneTimeReadIDs);
//                            System.out.println("n*pageLen="+n*pageLen);
                            for ( int j = 0; j < oneTimeReadIDs; j++ ) {
                                id = in.readInt();
                                for ( int k = 0; k < chCount; k++ ) {
                                    values[k] = in.readDouble();
                                }
                                mrecordLine = new NMeasurementRecordLine( id, values );
                                mrecordLines.add( mrecordLine );
                                mrecordLine = null;
                            }

                            File recordFile = myDB.findRecordFile( pheader.Pref );
                            if ( myDB.addMeasurementRecordLines( recordFile, mrecordLines ) != DBMessage.CSDB_OK )
                                return LOAD_REPORT_WRITE_DATABASE_FAIL;
                            
                            oneTimeReadIDs = pageLen;
                            if(mrecordLines != null){
                                mrecordLines.clear();
                                mrecordLines = null;
                            }
                        }
                        
                        //numOfCHHeaders = in.readInt();
                        /*for ( int j = 0; j < pheader.NumOfChannels; j++ ) {
                            chheader = (NChannelHeader) in.readObject();
                            chheader.Pref = pheaders.get(i).Pref;
                            if ( !myDB.addChannelHeader( chheader ))
                                return LOAD_REPORT_WRITE_DATABASE_FAIL;

                            //updateViewChannelPrefAndCref( selectedChannels, chheader, oldCHHeader );
                            
                            numOfMRecords = in.readInt();
                            for ( int k = 0; k < numOfMRecords; k++ ) {
                                mrecord = (MeasurementRecord) in.readObject();
                                mrecord.cref = chheader.cref;
                                if ( !myDB.addMeasurementRecord( mrecord ))
                                    return LOAD_REPORT_WRITE_DATABASE_FAIL;
                            }
                        }*/
                   } // if to save
                    
                } // loop of pheader               

            } // if with data



           //load stact view settings ----------- begin on 20110308
            int graphicViewStatus = 0;
            try{              
                if(version == 2){
                     graphicViewStatus = in.readInt();
                }
            }catch(Exception e){

            }
            //------------------------------------ end
            
            in.close();
            
            theCommonValue.loadNewReportAction( pheaders, availableChannels, selectedChannels, viewOptions, leakStat, compressors, texts,basicSetting, graphicViewStatus );
            
            if (  importDataRequired )
                return LOAD_REPORT_OK_WITH_DATA_IMPORTED;
            
        } catch ( Exception e ) {
            //System.out.println( "loadReport:  " + e.getMessage() );
            e.printStackTrace();
            return LOAD_REPORT_FAIL;
        } finally {
            try { in.close(); } catch ( Exception e ){}
        }
        
        return LOAD_REPORT_OK;
    }
    
    /** change the previously saved selected channel's pref and cref to new ones just added into 
     * database
     */
    /*private boolean updateViewChannelPrefAndCref( ArrayList<ViewChannel> viewChannels, ChannelHeader chheader, int oldCref ) {
        for (  ViewChannel viewChannel : viewChannels ) {
            if ( viewChannel.chheader.cref == oldCref ) {
                viewChannel.chheader.cref = chheader.cref;
                viewChannel.chheader.pref = chheader.pref;
                return true;
            }
        }
        
        return false;
    }*/
    
    /** Compare 2 protocol headers. Use Pref, DeviceID and StartTime as compare argument.
     * 
     */
    private boolean identicalPHeaders( NProtocolHeader pheader1, NProtocolHeader pheader2 ) {
        if ( pheader1 == null || pheader2 == null )
            return false;
        
        if ( pheader1.Pref != pheader2.Pref )
            return false;
        if ( pheader1.DeviceID != pheader2.DeviceID )
            return false;
//        if ( pheader1.StartTime != pheader2.StartTime )
//            return false;
//        String description1 = pheader1.getDescription();
//        String description2 = pheader2.getDescription();
//        if ( !( description1 == null && description2 == null) ) 
//            if ( description1.compareTo( description2 ) != 0 ) 
//                return false;
//        if ( !( pheader1.scondition == null && pheader2.scondition == null) ) 
//            if ( pheader1.scondition.compareTo(  pheader2.scondition ) != 0 ) 
//                return false;
//        if ( !( pheader1.econdition == null && pheader2.econdition == null) ) 
//            if ( pheader1.econdition.compareTo(  pheader2.econdition ) != 0 ) 
//                return false;
//        if ( pheader1.etime.getTime() != pheader2.etime.getTime() ) 
//            return false;
//        if ( pheader1.stime.getTime() != pheader2.stime.getTime() ) 
//            return false;
//        if ( pheader1.srate != pheader2.srate ) 
//            return false;
    
        return true;
    }
    
    
    public final static int LOAD_REPORT_OK = 1;
    public final static int LOAD_REPORT_OK_WITH_DATA_IMPORTED = 2;
    public final static int LOAD_REPORT_FAIL = -1;
    public final static int LOAD_REPORT_PHEADER_NOT_EXIST = -2;
    public final static int LOAD_REPORT_WRITE_DATABASE_FAIL = -3;
    
    public final static String REPORT_FILE_SUFFIX = ".rep";
    public final static String REPORT_FILE_SUFFIX_CAPTICAL = ".REP";
    public final static String REPORT_FILE_SUFFIX_FILTER = "rep";
    public final static String REPORT_FILE_SUFFIX_CAPTICAL_FILTER = ".REP";
    
    public final static int SAVE_REPORT_WITHOUT_DATA = 0;
    public final static int SAVE_REPORT_WITH_DATA = 1;
    
    private CommonValue theCommonValue;
    private CSMDF myDB;
    
//    public final static int Version = 2;// 1; changed 1 to 2 on 20110309.be
    public final static int Version = 4;// 3;// 1; changed 2 to 3 on 20121023.ex

    //added on 20110308 ----------- begin
    private GraphicPanel graphicView;
    //----------------------------- end
    
    private final int maxMemorySize = 10 * 1000 * 1000;
    
}
