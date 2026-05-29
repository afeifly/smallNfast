/*
 * Texts.java
 *
 * Created on 2007年4月12日, 下午6:47
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.structs;

import com.cs.canalyzer.gui.GUIConst;
import java.io.Serializable;

/**
 *
 * @author msu
 */
public class Texts implements Serializable {
    
    /** Creates a new instance of Texts */
    public Texts() {
        ValueAxises = new String[ GUIConst.Y_AXIS_NUMBER ];
        for ( int i = 0; i < ValueAxises.length; i++ ) 
            ValueAxises[i] = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Value_") + ( i + 1 ) + " ";
        
        Legends = new String[ CommonValue.MAX_LENGEND_NUMBER ];
        for ( int i = 0; i < Legends.length; i++ ) 
            Legends[i] = "";
    }
    
    /**
     * Make a clone of current Text object
     */
    public Texts clone() {
        Texts newTexts = new Texts();
        
        newTexts.Title = this.Title;
        newTexts.ValueAxises = this.ValueAxises.clone();
        newTexts.Legends = this.Legends.clone();
        newTexts.CommendPageBodyText = this.CommendPageBodyText;
        newTexts.CommendPageTitle = this.CommendPageTitle;
        newTexts.bugger = this.bugger;
        
        return newTexts;
    }
    
    //public String Title = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Compressed_Air_Analyzer");
    public String Title = "";
    public String[] ValueAxises; 
    public String[] Legends;
            
    public String CommendPageTitle = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Summary");
    public String CommendPageBodyText = "";
    
    public int bugger; // trick to cause old config file unusable
}
