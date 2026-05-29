/*
 * ReportPrinter.java
 *
 * Created on March 14, 2008, 7:08 PM
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.print.printing;

import java.awt.Container;

/**
 * This interface provides methods for acquiring necessary data for printing the
 * report.
 * @author ll
 */
public interface ReportPrinter {
   
   /**
    * Return the comment page's title as a String or null if it doesn't exist
    */
   String getCommentPageTitle();
   
   /**
    * Return the comment page's body text as a String or null if it doesn't exist.
    * If null is returned, no comment page will be printed.
    */
   String getCommentPageBodyText();
   
   /**
    * Return true if there are daily graphs and statistics available or false otherwise
    */
   boolean hasDailyData();
   
   /**
    * Return an array of GraphicPanel objects for all daily graphs if they exist, 
    * or null if they don't exist
    */
   Container[] getDailyGraphs();
   
   /**
    * Return an array of statistics dialog panels for all daily statistics if they exist, 
    * or null if they don't exist.
    * If sr is a StatisticsRenderer object, you can get the dialog panel using:
    * sr.getDialog().getDialogPanel()
    */
   Container[] getDailyStats();
}
