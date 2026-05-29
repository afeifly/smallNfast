/*
 * ViewConfig.java
 *
 * Created on 2005年6月21日, 下午6:31
 */

package com.cs.canalyzer.gui.dialog.settings;
 
import com.cs.canalyzer.gui.GUIConst;
import com.cs.canalyzer.structs.ViewChannel;
import com.cs.canalyzer.structs.ViewOptions;
import com.cs.canalyzer.structs.CommonValue;
import com.cs.database.CSMDF;
import com.cs.database.NProtocolHeader;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.EventQueue;
import java.awt.Toolkit;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Hashtable;
import javax.swing.DefaultComboBoxModel;
import javax.swing.DefaultListModel;
import javax.swing.ImageIcon;
import javax.swing.JColorChooser;
import javax.swing.JOptionPane;
import javax.swing.event.ListSelectionListener;


/**
 *
 * @author  msu
 */
public class ViewConfigDialog extends javax.swing.JFrame implements PropertyChangeListener {
    
    public ViewConfigDialog( CommonValue common ) {
        this.theCommonValue = common;
        this.viewOptions = common.getViewOptions();
        orgViewOptions = new ViewOptions();
        orgViewOptions.copy(viewOptions);
        this.pheaders = common.getProtocolHeaders();
        this.myDB = common.getDataBase();

        myInit();
        
    } 
    
    
    /** My initialization.
     *
     */
    private void myInit() {
        initComponents();

        initYAxisRadioButtons();
        initHashes();
        initChannelLists();
        setYAxisFieldsBasedOnViewOptions();
        //initViewOptions();
        
        Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();
        setBounds(dim.width / 11, dim.height / 11, DEFAULT_WIDTH, DEFAULT_HEIGHT);

        setIconImage( new ImageIcon(getClass().getResource( GUIConst.IMAGE_PATH + GUIConst.LOGO_FILE_NAME)).getImage());
        
        // temp
        jCheckDisableY.setVisible( false );
        jButtonSave.setVisible( false );
    }

    /** this listener cares about the protocol header change
     */
    public void propertyChange( PropertyChangeEvent event ) {
//System.out.println("Event: " + event.getSource() + "      " + event.getPropertyName() + "         " + event.getNewValue() );        
        if ( event.getPropertyName().compareTo( CommonValue.PROTOCOL_HEADER_LIST ) == 0 ) {
            pheaders = theCommonValue.getProtocolHeaders();
            selectedChannels = theCommonValue.getSelectedChannels();
            viewOptions = theCommonValue.getViewOptions();
            initChannelLists();
            initViewOptions();
        } else if ( event.getPropertyName().compareTo( CommonValue.VIEW_OPTIONS ) == 0 ) {
            viewOptions = theCommonValue.getViewOptions();
            initViewOptions();
        }
    }
    
    private void initYAxisRadioButtons() {
        javax.swing.JRadioButton jRadioYAxis;
        jRadioYAxises = new javax.swing.JRadioButton[GUIConst.Y_AXIS_NUMBER];
        
        for ( int i = 0; i < GUIConst.Y_AXIS_NUMBER; i++ ) {
            jRadioYAxis = new javax.swing.JRadioButton();
            jRadioYAxis.setFont(new java.awt.Font("Dialog", 1, 12));
            jRadioYAxis.setText( "" + ( i + 1 ));
            jRadioYAxis.setBackground( GUIConst.BACKGROUND_COLOR );
            //jRadioYAxis.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
            jRadioYAxis.setMargin(new java.awt.Insets(0, 0, 0, 0));
            jRadioYAxis.addActionListener(new java.awt.event.ActionListener() {
                public void actionPerformed(java.awt.event.ActionEvent evt) {
                    updateYAxisOptions(evt);
                }
            });        
            
            jButtonGroupYAxis.add( jRadioYAxis );
            jRadioYAxises[i] = jRadioYAxis;
            jPanelYAxisSelection.add( jRadioYAxis );
        }
        
        jRadioYAxises[0].setSelected( true );
    }
    
    private void updateYAxisOptions( java.awt.event.ActionEvent evt ) {
        for ( int i = 0; i < jRadioYAxises.length; i++ ) {
            if ( jRadioYAxises[i].isSelected() ) {
                if ( i == selectedAxis ) return;  // no change
                
                selectedAxis = i;
                setYAxisFieldsBasedOnViewOptions();
            }
        }
    }
    
    private void setYAxisFieldsBasedOnViewOptions() {
        jComboYUnit.setSelectedItem( viewOptions.yUnits[selectedAxis] );
        jCheckAuto.setSelected( viewOptions.yAutomatics[selectedAxis] );
        jCheckDisableY.setSelected( viewOptions.yDisableds[selectedAxis] );
        setYFieldsAvailability();
        jTextYFrom.setText( String.valueOf( viewOptions.yFroms[selectedAxis] ));
        jTextYSteps.setText( String.valueOf( viewOptions.ySteps[selectedAxis] ));
        jTextYTo.setText( String.valueOf( viewOptions.yTos[selectedAxis] ));
    }
    
    private void initHashes() {
        availableChannels = new java.util.ArrayList<ViewChannel>();
        selectedChannels = new java.util.ArrayList<ViewChannel>();
        
        availableListModel = new DefaultListModel();
        availableMap = new Hashtable<String, ViewChannel>();
        jListAvailable.setModel(availableListModel);
        
        selectedListModel = new DefaultListModel();
        selectedMap = new Hashtable<String, ViewChannel>();
        jListSelected.setModel(selectedListModel);
        jListSelected.getSelectionModel().addListSelectionListener( new ListSelectionListener(){
            public void valueChanged(javax.swing.event.ListSelectionEvent evt) {
                String item;
                try {
                    item = (String) jListSelected.getSelectedValue();
                    ViewChannel vc = selectedMap.get(item);
                    jLabelLine.setForeground(vc.color);
                    jLabelLine.setText(ViewChannel.LINE_STYLE_STRING[vc.lineStyle]);
                    /*if (vc.lineStyle == ViewChannel.NORMAL_LINE) {
                        jLabelLine.setText("_______");
                    } else {
                        jLabelLine.setText("-------");
                    }*/
                } catch (java.lang.NullPointerException e) {
                    return;
                }
            }
        });
        
        yUnitModel = new DefaultComboBoxModel();
        jComboYUnit.setModel(yUnitModel);

//        yLeftUnitModel = new DefaultComboBoxModel();
//        jComboYLeftUnit.setModel(yLeftUnitModel);
//        yRightUnitModel = new DefaultComboBoxModel();
//        jComboYRightUnit.setModel(yRightUnitModel);
    }
    
    /** Add channel list. The theory is:
     * 1. add all device contained in 'allDevicePanels' to the 'availableList' 
     * 2. add all items contained in given 'selectedChannels' to 'selectedList'. if the item
     *    exists in 'availableList', remove it from 'availableList'. if not, assume users has
     *    deleted or renamed this device from other place, then remove it from the 'selectedList'
     */
    private void initChannelLists() {
        String item;
        ViewChannel vc;
        String unit;
        
        try {
            getAvailableChannels();
            
            // 1. dealing with 'availableList'
            availableListModel.clear();
            availableMap.clear();
            for (int i = 0; i < availableChannels.size(); i++) {
                vc = availableChannels.get(i);
                item = vc.fullChannelName;
                availableListModel.addElement(item);
                availableMap.put(item, vc);
                
                /* we moved this down to limit the unit choices to 'selected channels' 
                // add the unit's choices
                 unit = vc.unit;
                 if (yLeftUnitModel.getIndexOf(unit) < 0) {
                      yLeftUnitModel.addElement(unit);
                      yRightUnitModel.addElement(unit);
                 }
                 */
            }

        
            // 2. dealing with 'selectedList'
            selectedListModel.clear();
            selectedMap.clear();
            yUnitModel.removeAllElements();
            //yRightUnitModel.removeAllElements();
            for (int i = 0; i < selectedChannels.size(); i++) {
                vc = selectedChannels.get(i);
                item = vc.fullChannelName;
                selectedListModel.addElement(item);

                selectedMap.put(item, vc);
                availableMap.remove(item);
                availableListModel.removeElement(item);
                
                // add the unit's choices
                 unit = vc.unit;
                 if (yUnitModel.getIndexOf(unit) < 0) {
                      yUnitModel.addElement(unit);
                      //yRightUnitModel.addElement(unit);
                 }

                 /*if (availableListModel.indexOf(item) < 0) {
                    // doesn't existing in 'allDevicePanels' anymore
                    //selectedListModel.removeElement(item);
                    //selectedChannels.remove(i);
                //} else {
                    // still exist. then add it to selected list, remove from available list
                    selectedMap.put(item, vc);
                    availableMap.remove(item);
                    availableListModel.removeElement(item);
                }*/
            }

            yUnitModel.setSelectedItem( viewOptions.yUnits[0] );
            //yRightUnitModel.setSelectedItem(viewOptions.yUnits[1] );
            
        } catch (Exception e){
            System.out.println( java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("ViewConfig_initChannelLists:_") + e.getMessage() );
        }
//System.out.println("map " + selectedMap.size());        
    }
    

    /** set the min and max value of every selected unit
     */
    private void setMinAndMaxValue() {
        int size = selectedChannels.size();
        if ( size > 0 ) { 
            viewOptions.maxValues = new double[size];
            viewOptions.minValues = new double[size];
        } else {
            
        }
        
        for ( int i = 0; i < size; i++ ) {
            ViewChannel vc = selectedChannels.get(i);
            viewOptions.maxValues[i] = vc.chheader.Max;
            viewOptions.minValues[i] = vc.chheader.Min;
            for ( int j = 0; j < size; j++ ) {
                ViewChannel vc1 = selectedChannels.get(j);
                if ( vc1.unit.compareTo( vc.unit ) == 0 ) {
                    viewOptions.maxValues[i] = Math.max( viewOptions.maxValues[i], vc1.chheader.Max );
                    viewOptions.minValues[i] = Math.min( viewOptions.minValues[i], vc1.chheader.Min );
                }
            }
        }
    }
    
    
    /** get available channels from protocol header list
     */ 
    private void getAvailableChannels() {
        availableChannels = theCommonValue.getAvailableChannels();
        selectedChannels = theCommonValue.getSelectedChannels();
        
        /*ArrayList<NChannelHeader> chheaders;
        ViewChannel vc;
        String fullName;

        availableChannels.clear();
        //for( Enumeration e = pheaders.elements(); e.hasMoreElements(); ) {
        for ( NProtocolHeader pheader : pheaders ) {
            try {
                chheaders = myDB.findChannelHeaders( pheader.Pref ); //.queryChannelHeader( pheader.pref );
                for( NChannelHeader chheader : chheaders ) {
                    fullName = CommonValue.getViewChannelFullName( pheader, chheader );
                    //vc = new ViewChannel( chheader.uuid, fullName, chheader, 
                      //              pheader.stime.getTime(), pheader.etime.getTime(), pheader.srate  );
                    vc = new ViewChannel( String.valueOf( pheader.DeviceID ), fullName, chheader, 
                                    pheader.StartTime, pheader.StopTime, pheader.SampleRate * pheader.SampleRateFactor / 1000 );
                    availableChannels.add( vc );
                }
            } catch ( Exception e ) {}
        }*/
    }
    
    
/*    public void paint(Graphics g) {
        super.paint(g);
    }*/
    
    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {
        java.awt.GridBagConstraints gridBagConstraints;

        jButtonGroupYAxis = new javax.swing.ButtonGroup();
        jButtonGroupTime = new javax.swing.ButtonGroup();
        jPanel1 = new javax.swing.JPanel();
        jPanelCenter = new javax.swing.JPanel();
        jPanel3 = new javax.swing.JPanel();
        jScrollPane1 = new javax.swing.JScrollPane();
        jListAvailable = new javax.swing.JList();
        jPanel6 = new javax.swing.JPanel();
        jButtonSelect = new javax.swing.JButton();
        jButtonRemove = new javax.swing.JButton();
        jLabel13 = new javax.swing.JLabel();
        jPanel7 = new javax.swing.JPanel();
        jPanel4 = new javax.swing.JPanel();
        jLabel11 = new javax.swing.JLabel();
        jPanel5 = new javax.swing.JPanel();
        jLabel12 = new javax.swing.JLabel();
        jScrollPane3 = new javax.swing.JScrollPane();
        jListSelected = new javax.swing.JList();
        jPanelLineColorChooser = new javax.swing.JPanel();
        jLabelChangeColor = new javax.swing.JLabel();
        jLabelLine = new javax.swing.JLabel();
        jButtonChangeColor = new javax.swing.JButton();
        jButtonChangeStyle = new javax.swing.JButton();
        jLabel7 = new javax.swing.JLabel();
        jPanel20 = new javax.swing.JPanel();
        jPanelGraphicViewOnly = new javax.swing.JPanel();
        jPanelYAxisSelection = new javax.swing.JPanel();
        jLabel2 = new javax.swing.JLabel();
        jPanel10 = new javax.swing.JPanel();
        jPanel14 = new javax.swing.JPanel();
        jLabel22 = new javax.swing.JLabel();
        jLabel19 = new javax.swing.JLabel();
        jLabel21 = new javax.swing.JLabel();
        jComboYUnit = new javax.swing.JComboBox();
        jLabel6 = new javax.swing.JLabel();
        jCheckAuto = new javax.swing.JCheckBox();
        jPanel11 = new javax.swing.JPanel();
        jPanel16 = new javax.swing.JPanel();
        jLabel15 = new javax.swing.JLabel();
        jLabel3 = new javax.swing.JLabel();
        jTextYFrom = new javax.swing.JTextField();
        jLabel4 = new javax.swing.JLabel();
        jTextYTo = new javax.swing.JTextField();
        jLabel5 = new javax.swing.JLabel();
        jLabel8 = new javax.swing.JLabel();
        jTextYSteps = new javax.swing.JTextField();
        jCheckDisableY = new javax.swing.JCheckBox();
        jLabel14 = new javax.swing.JLabel();
        jPanel2 = new javax.swing.JPanel();
        jButtonOK = new javax.swing.JButton();
        jButtonSave = new javax.swing.JButton();
        jButtonCancel = new javax.swing.JButton();

        setDefaultCloseOperation(javax.swing.WindowConstants.DISPOSE_ON_CLOSE);
        java.util.ResourceBundle bundle = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts"); // NOI18N
        setTitle(bundle.getString("Select_Channel")); // NOI18N

        jPanel1.setBackground(new java.awt.Color(169, 219, 152));
        jPanel1.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel1.setLayout(new java.awt.BorderLayout());

        jPanelCenter.setBackground(GUIConst.BACKGROUND_COLOR);
        jPanelCenter.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanelCenter.setLayout(new java.awt.GridLayout(0, 2));

        jPanel3.setBackground(GUIConst.BACKGROUND_COLOR);
        jPanel3.setLayout(new java.awt.BorderLayout());

        jScrollPane1.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jScrollPane1.setMinimumSize(new java.awt.Dimension(110, 150));

        jListAvailable.setFont(new java.awt.Font("SansSerif", 1, 10)); // NOI18N
        jScrollPane1.setViewportView(jListAvailable);

        jPanel3.add(jScrollPane1, java.awt.BorderLayout.CENTER);

        jPanel6.setBackground(GUIConst.BACKGROUND_COLOR);
        jPanel6.setPreferredSize(new java.awt.Dimension(109, 80));
        jPanel6.setLayout(new java.awt.GridBagLayout());

        jButtonSelect.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jButtonSelect.setText(bundle.getString("Select")); // NOI18N
        jButtonSelect.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonSelectActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 1;
        gridBagConstraints.gridy = 1;
        gridBagConstraints.gridheight = 3;
        gridBagConstraints.fill = java.awt.GridBagConstraints.HORIZONTAL;
        jPanel6.add(jButtonSelect, gridBagConstraints);

        jButtonRemove.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jButtonRemove.setText(bundle.getString("Remove")); // NOI18N
        jButtonRemove.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonRemoveActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 1;
        gridBagConstraints.gridy = 5;
        gridBagConstraints.gridheight = 3;
        gridBagConstraints.fill = java.awt.GridBagConstraints.HORIZONTAL;
        jPanel6.add(jButtonRemove, gridBagConstraints);

        jLabel13.setText("  ");
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 1;
        gridBagConstraints.gridy = 4;
        gridBagConstraints.ipady = 20;
        jPanel6.add(jLabel13, gridBagConstraints);

        jPanel3.add(jPanel6, java.awt.BorderLayout.EAST);

        jPanel7.setBackground(GUIConst.BACKGROUND_COLOR);
        jPanel7.setPreferredSize(new java.awt.Dimension(20, 10));
        jPanel3.add(jPanel7, java.awt.BorderLayout.WEST);

        jPanel4.setBackground(GUIConst.BACKGROUND_COLOR);
        jPanel4.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel4.setPreferredSize(new java.awt.Dimension(147, 40));
        jPanel4.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT, 20, 5));

        jLabel11.setBackground(GUIConst.BACKGROUND_COLOR);
        jLabel11.setFont(new java.awt.Font("Dialog", 1, 12)); // NOI18N
        jLabel11.setText(bundle.getString("Available_Channels")); // NOI18N
        jLabel11.setPreferredSize(new java.awt.Dimension(180, 40));
        jPanel4.add(jLabel11);

        jPanel3.add(jPanel4, java.awt.BorderLayout.NORTH);

        jPanelCenter.add(jPanel3);

        jPanel5.setBackground(GUIConst.BACKGROUND_COLOR);
        jPanel5.setLayout(new java.awt.BorderLayout());

        jLabel12.setBackground(GUIConst.BACKGROUND_COLOR);
        jLabel12.setFont(new java.awt.Font("Dialog", 1, 12)); // NOI18N
        jLabel12.setText(bundle.getString("Selected_Channels_(_max_6_)")); // NOI18N
        jLabel12.setPreferredSize(new java.awt.Dimension(159, 40));
        jPanel5.add(jLabel12, java.awt.BorderLayout.NORTH);

        jScrollPane3.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jScrollPane3.setMinimumSize(new java.awt.Dimension(110, 150));

        jListSelected.setFont(new java.awt.Font("SansSerif", 1, 10)); // NOI18N
        jScrollPane3.setViewportView(jListSelected);

        jPanel5.add(jScrollPane3, java.awt.BorderLayout.CENTER);

        jPanelLineColorChooser.setBackground(GUIConst.BACKGROUND_COLOR);
        jPanelLineColorChooser.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanelLineColorChooser.setPreferredSize(new java.awt.Dimension(130, 104));
        jPanelLineColorChooser.setLayout(new java.awt.GridBagLayout());

        jLabelChangeColor.setFont(new java.awt.Font("Dialog", 1, 12)); // NOI18N
        jLabelChangeColor.setForeground(java.awt.Color.blue);
        jLabelChangeColor.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelChangeColor.setText(bundle.getString("Line_Style")); // NOI18N
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.ipady = 20;
        jPanelLineColorChooser.add(jLabelChangeColor, gridBagConstraints);

        jLabelLine.setFont(new java.awt.Font("Dialog", 1, 14)); // NOI18N
        jLabelLine.setForeground(new java.awt.Color(0, 204, 204));
        jLabelLine.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabelLine.setText("______");
        jLabelLine.setVerticalAlignment(javax.swing.SwingConstants.TOP);
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 1;
        gridBagConstraints.ipady = 25;
        jPanelLineColorChooser.add(jLabelLine, gridBagConstraints);

        jButtonChangeColor.setFont(new java.awt.Font("SansSerif", 0, 10)); // NOI18N
        jButtonChangeColor.setText(bundle.getString("Change_Color")); // NOI18N
        jButtonChangeColor.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonChangeColorActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 3;
        jPanelLineColorChooser.add(jButtonChangeColor, gridBagConstraints);

        jButtonChangeStyle.setFont(new java.awt.Font("SansSerif", 0, 10)); // NOI18N
        jButtonChangeStyle.setText(bundle.getString("Change_Style")); // NOI18N
        jButtonChangeStyle.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonChangeStyleActionPerformed(evt);
            }
        });
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 5;
        jPanelLineColorChooser.add(jButtonChangeStyle, gridBagConstraints);

        jLabel7.setText("    ");
        gridBagConstraints = new java.awt.GridBagConstraints();
        gridBagConstraints.gridx = 0;
        gridBagConstraints.gridy = 4;
        jPanelLineColorChooser.add(jLabel7, gridBagConstraints);

        jPanel5.add(jPanelLineColorChooser, java.awt.BorderLayout.EAST);

        jPanelCenter.add(jPanel5);

        jPanel1.add(jPanelCenter, java.awt.BorderLayout.CENTER);

        jPanel20.setLayout(new java.awt.BorderLayout());

        jPanelGraphicViewOnly.setBackground(GUIConst.BACKGROUND_COLOR);
        jPanelGraphicViewOnly.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanelGraphicViewOnly.setPreferredSize(new java.awt.Dimension(10, 180));
        jPanelGraphicViewOnly.setLayout(new java.awt.GridLayout(4, 0));

        jPanelYAxisSelection.setBackground(GUIConst.BACKGROUND_COLOR);
        jPanelYAxisSelection.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanelYAxisSelection.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT, 20, 10));

        jLabel2.setFont(new java.awt.Font("Dialog", 1, 12)); // NOI18N
        jLabel2.setText(bundle.getString("Axis_Number:_")); // NOI18N
        jPanelYAxisSelection.add(jLabel2);

        jPanelGraphicViewOnly.add(jPanelYAxisSelection);

        jPanel10.setBackground(GUIConst.BACKGROUND_COLOR);
        jPanel10.setLayout(new java.awt.GridLayout(0, 1));

        jPanel14.setBackground(GUIConst.BACKGROUND_COLOR);
        jPanel14.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT, 10, 10));

        jLabel22.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jLabel22.setText(" ");
        jLabel22.setPreferredSize(new java.awt.Dimension(10, 18));
        jPanel14.add(jLabel22);

        jLabel19.setFont(new java.awt.Font("Dialog", 1, 12)); // NOI18N
        jLabel19.setText(bundle.getString("Y_Axis_Scaling_Settings:")); // NOI18N
        jLabel19.setPreferredSize(new java.awt.Dimension(200, 16));
        jPanel14.add(jLabel19);

        jLabel21.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jLabel21.setText(bundle.getString("Unit:")); // NOI18N
        jPanel14.add(jLabel21);

        jComboYUnit.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jComboYUnit.setEnabled(false);
        jComboYUnit.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jComboYUnitActionPerformed(evt);
            }
        });
        jPanel14.add(jComboYUnit);

        jLabel6.setText("      ");
        jPanel14.add(jLabel6);

        jCheckAuto.setBackground(GUIConst.BACKGROUND_COLOR);
        jCheckAuto.setFont(new java.awt.Font("Dialog", 1, 12)); // NOI18N
        jCheckAuto.setForeground(new java.awt.Color(0, 102, 102));
        jCheckAuto.setSelected(true);
        jCheckAuto.setText(bundle.getString("Automatic_Scaling")); // NOI18N
        jCheckAuto.setHorizontalTextPosition(javax.swing.SwingConstants.LEADING);
        jCheckAuto.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jCheckAutoActionPerformed(evt);
            }
        });
        jPanel14.add(jCheckAuto);

        jPanel10.add(jPanel14);

        jPanelGraphicViewOnly.add(jPanel10);

        jPanel11.setBackground(GUIConst.BACKGROUND_COLOR);
        jPanel11.setLayout(new java.awt.GridLayout(0, 1));

        jPanel16.setBackground(GUIConst.BACKGROUND_COLOR);
        jPanel16.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT, 10, 10));

        jLabel15.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jLabel15.setText(" ");
        jLabel15.setPreferredSize(new java.awt.Dimension(20, 18));
        jPanel16.add(jLabel15);

        jLabel3.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jLabel3.setText(bundle.getString("Scaling:_From")); // NOI18N
        jPanel16.add(jLabel3);

        jTextYFrom.setEditable(false);
        jTextYFrom.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextYFrom.setPreferredSize(new java.awt.Dimension(50, 20));
        jTextYFrom.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mouseClicked(java.awt.event.MouseEvent evt) {
                jTextYFromMouseClicked(evt);
            }
        });
        jTextYFrom.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextYFromKeyTyped(evt);
            }
        });
        jPanel16.add(jTextYFrom);

        jLabel4.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jLabel4.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabel4.setText(bundle.getString("_to_")); // NOI18N
        jLabel4.setPreferredSize(new java.awt.Dimension(25, 18));
        jPanel16.add(jLabel4);

        jTextYTo.setEditable(false);
        jTextYTo.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextYTo.setPreferredSize(new java.awt.Dimension(50, 20));
        jTextYTo.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mouseClicked(java.awt.event.MouseEvent evt) {
                jTextYToMouseClicked(evt);
            }
        });
        jTextYTo.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextYToKeyTyped(evt);
            }
        });
        jPanel16.add(jTextYTo);

        jLabel5.setText("      ");
        jPanel16.add(jLabel5);

        jLabel8.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jLabel8.setText(bundle.getString("Number_of_Steps:")); // NOI18N
        jPanel16.add(jLabel8);

        jTextYSteps.setEditable(false);
        jTextYSteps.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jTextYSteps.setPreferredSize(new java.awt.Dimension(30, 20));
        jTextYSteps.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mouseClicked(java.awt.event.MouseEvent evt) {
                jTextYStepsMouseClicked(evt);
            }
        });
        jTextYSteps.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyTyped(java.awt.event.KeyEvent evt) {
                jTextYStepsKeyTyped(evt);
            }
        });
        jPanel16.add(jTextYSteps);

        jCheckDisableY.setBackground(GUIConst.BACKGROUND_COLOR);
        jCheckDisableY.setFont(new java.awt.Font("Dialog", 1, 12)); // NOI18N
        jCheckDisableY.setForeground(new java.awt.Color(102, 102, 102));
        jCheckDisableY.setText(bundle.getString("Diable_This_Axis")); // NOI18N
        jCheckDisableY.setHorizontalTextPosition(javax.swing.SwingConstants.LEADING);
        jCheckDisableY.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jCheckDisableYActionPerformed(evt);
            }
        });
        jPanel16.add(jCheckDisableY);

        jPanel11.add(jPanel16);

        jPanelGraphicViewOnly.add(jPanel11);

        jPanel20.add(jPanelGraphicViewOnly, java.awt.BorderLayout.SOUTH);

        jPanel1.add(jPanel20, java.awt.BorderLayout.SOUTH);

        jLabel14.setFont(new java.awt.Font("Dialog", 1, 14)); // NOI18N
        jLabel14.setForeground(new java.awt.Color(102, 102, 255));
        jLabel14.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabel14.setText(bundle.getString("Select_Channel")); // NOI18N
        jLabel14.setPreferredSize(new java.awt.Dimension(58, 30));
        jPanel1.add(jLabel14, java.awt.BorderLayout.NORTH);

        getContentPane().add(jPanel1, java.awt.BorderLayout.CENTER);

        jPanel2.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jPanel2.setPreferredSize(new java.awt.Dimension(10, 60));
        jPanel2.setLayout(new java.awt.FlowLayout(java.awt.FlowLayout.RIGHT, 20, 15));

        jButtonOK.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jButtonOK.setText(bundle.getString("OK")); // NOI18N
        jButtonOK.setPreferredSize(new java.awt.Dimension(95, 27));
        jButtonOK.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonOKActionPerformed(evt);
            }
        });
        jPanel2.add(jButtonOK);

        jButtonSave.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jButtonSave.setText(bundle.getString("Apply")); // NOI18N
        jButtonSave.setPreferredSize(new java.awt.Dimension(95, 27));
        jButtonSave.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonSaveActionPerformed(evt);
            }
        });
        jPanel2.add(jButtonSave);

        jButtonCancel.setFont(new java.awt.Font("Dialog", 0, 12)); // NOI18N
        jButtonCancel.setText(bundle.getString("Cancel")); // NOI18N
        jButtonCancel.setPreferredSize(new java.awt.Dimension(95, 27));
        jButtonCancel.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButtonCancelActionPerformed(evt);
            }
        });
        jPanel2.add(jButtonCancel);

        getContentPane().add(jPanel2, java.awt.BorderLayout.SOUTH);

        pack();
    }// </editor-fold>//GEN-END:initComponents

    private void jTextYStepsKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextYStepsKeyTyped
        EventQueue.invokeLater( new Runnable() {
            public void run() {
                try {
                    viewOptions.ySteps[selectedAxis] = Integer.valueOf( jTextYSteps.getText() );
                } catch ( Exception e ) {}
            }
        });                
    }//GEN-LAST:event_jTextYStepsKeyTyped

    private void jTextYToKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextYToKeyTyped
        EventQueue.invokeLater( new Runnable() {
            public void run() {
                try {
                    viewOptions.yTos[selectedAxis] = Double.valueOf( GUIConst.VerifyString( jTextYTo.getText() ));
                 
                } catch ( Exception e ) {}
            }
        });        
    }//GEN-LAST:event_jTextYToKeyTyped

    private void jTextYFromKeyTyped(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_jTextYFromKeyTyped
        EventQueue.invokeLater( new Runnable() {
            public void run() {
                try {
                    viewOptions.yFroms[selectedAxis] = Double.valueOf( GUIConst.VerifyString( jTextYFrom.getText() ));
                } catch ( Exception e ) {}
            }
        });        
    }//GEN-LAST:event_jTextYFromKeyTyped

    private void jComboYUnitActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jComboYUnitActionPerformed
        if ( yUnitModel.getSelectedItem() != null) {
            viewOptions.yUnits[selectedAxis] = (String) yUnitModel.getSelectedItem();
        }        
    }//GEN-LAST:event_jComboYUnitActionPerformed

    private void jTextYStepsMouseClicked(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_jTextYStepsMouseClicked
        // TODO add your handling code here:
        yAxisAutomaticScalingWarning();        
    }//GEN-LAST:event_jTextYStepsMouseClicked

    private void jTextYToMouseClicked(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_jTextYToMouseClicked
        // TODO add your handling code here:
        yAxisAutomaticScalingWarning();
    }//GEN-LAST:event_jTextYToMouseClicked

    private void jTextYFromMouseClicked(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_jTextYFromMouseClicked
        // TODO add your handling code here:
        yAxisAutomaticScalingWarning();       
    }//GEN-LAST:event_jTextYFromMouseClicked

    // returns true when automatic, false when not.
    private boolean yAxisAutomaticScalingWarning() {
        if ( jCheckAuto.isSelected() ) {
            JOptionPane.showMessageDialog(this, AUTOMATIC_SELECT_MESSAGE);
            return true;
        } else
            return false;
    }
    
    /*private void rightAxisAutomaticScalingWarning() {
        if ( jCheckAutoRight.isSelected() && !jCheckDisableY2.isSelected() ) {
            JOptionPane.showMessageDialog(this, AUTOMATIC_SELECT_MESSAGE);
        }
    }*/
    
    private void jCheckDisableYActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jCheckDisableYActionPerformed
        if ( selectedAxis == 0 && jCheckDisableY.isSelected() ) {
            // can't disable first one
            JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Sorry,_the_first_Y_axis_can't_be_disabled."));
            jCheckDisableY.setSelected( false );
            return;
        }
        
        if ( jCheckDisableY.isSelected() ) {
            for ( int i = selectedAxis + 1; i < GUIConst.Y_AXIS_NUMBER; i++ ) {
                if ( !viewOptions.yDisableds[i] ) {
                    JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Sorry,_you_can't_disable_the_current_axis_while_following_axis_is_enabled."));
                    jCheckDisableY.setSelected( false );
                    return;
                }
            }
            viewOptions.yDisableds[selectedAxis] = true;
        } else 
            viewOptions.yDisableds[selectedAxis] = false;
            
        setYFieldsAvailability();
    }//GEN-LAST:event_jCheckDisableYActionPerformed

    private void jButtonChangeStyleActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonChangeStyleActionPerformed
        // TODO add your handling code here:
        int selectedIx = jListSelected.getSelectedIndex();
        if ( selectedIx < 0) return;
        ViewChannel vc = selectedMap.get( (String) selectedListModel.get(selectedIx) );

        //Object[] lineStyles = { ViewChannel.NORMAL_LINE_STYLE, ViewChannel.DASHED_LINE_STYLE };
        Object[] lineStyles = ViewChannel.LINE_STYLE_STRING;
        String selectedLine = (String) JOptionPane.showInputDialog(this,  java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_choose_line_style."), 
                                java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Choose_Line_Style"), JOptionPane.INFORMATION_MESSAGE, null, lineStyles, lineStyles[0]);
        if (selectedLine != null) {
            if (selectedLine == ViewChannel.LINE_STYLE_STRING[ViewChannel.NORMAL_LINE]) {
                vc.lineStyle = ViewChannel.NORMAL_LINE;
            } else if (selectedLine == ViewChannel.LINE_STYLE_STRING[ViewChannel.DASHED_LINE]) {
                vc.lineStyle = ViewChannel.DASHED_LINE;
            }
            
            jLabelLine.setText(selectedLine);
        }

    }//GEN-LAST:event_jButtonChangeStyleActionPerformed

    private void jButtonChangeColorActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonChangeColorActionPerformed
        // TODO add your handling code here:
        int selectedIx = jListSelected.getSelectedIndex();
        if ( selectedIx < 0) return;
        ViewChannel vc = selectedMap.get( (String) selectedListModel.get(selectedIx) );
        
        Color newColor = JColorChooser.showDialog(this,  java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Choose_Line_Color"), vc.color);
        if (newColor != null) {
            vc.color = newColor;
            // add on 20100512, MK's requirement. -- begin
            vc.colorChanged = true;
            vc.colorIndex = selectedIx;
            // ------------- end
            jLabelLine.setForeground(newColor);
            // remember the setting for future use
//            viewOptions.ChannelColors[selectedIx] = newColor; // delete on 20100512, MK's requirement.
        }
    }//GEN-LAST:event_jButtonChangeColorActionPerformed

    private void jButtonSaveActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonSaveActionPerformed
        // TODO add your handling code here:
        if(!applyChanges())return;
    }//GEN-LAST:event_jButtonSaveActionPerformed

    private boolean applyChanges() {
        if ( !setViewOptions() ) return false;
        selectedChannels.clear();
        //selectedChannels.addAll(selectedMap.values());
        // we take this trouble to ensure the order of channels, for color's sake
        for (int i = 0; i < selectedListModel.size(); i++) {
            ViewChannel vc = selectedMap.get( (String) selectedListModel.get(i) );
            selectedChannels.add(vc);
        }
        dispose();
        theCommonValue.setSelectedChannels( selectedChannels );
        return true;
        //viewOptions.dataUpdated = false;
        //if (theView != null) theView.refreshView(false);        
    }
    
    private void jButtonOKActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonOKActionPerformed
        // TODO add your handling code here:
        //selectedChannels = (java.util.List) selectedMap.values();
        if(!applyChanges()) return;
        dispose();
    }//GEN-LAST:event_jButtonOKActionPerformed

    private boolean setViewOptions() {
        try {
            //viewOptions.header = jTextHeader.getText();

            /*viewOptions.yAutomatics[0] = jCheckAutoLeft.isSelected();
            viewOptions.yDisableds[0] = false;
            viewOptions.yFroms[0] = Float.parseFloat(jTextYLeftFrom.getText());
            viewOptions.ySteps[0] = Integer.parseInt(jTextYLeftSteps.getText());
            viewOptions.yTos[0] = Float.parseFloat(jTextYLeftTo.getText());
            if (yLeftUnitModel.getSelectedItem() != null) {
                viewOptions.yUnits[0] = (String) yLeftUnitModel.getSelectedItem();
            }

            viewOptions.yAutomatics[1] = jCheckAutoRight.isSelected();
            viewOptions.yDisableds[1] = jCheckDisableY2.isSelected();
            viewOptions.yFroms[1] = Float.parseFloat(jTextYRightFrom.getText());
            viewOptions.ySteps[1] = Integer.parseInt(jTextYRightSteps.getText());
            viewOptions.yTos[1] = Float.parseFloat(jTextYRightTo.getText());
            if (yRightUnitModel.getSelectedItem() != null) {
                viewOptions.yUnits[1] = (String) yRightUnitModel.getSelectedItem();
            }*/
            
            setMinAndMaxValue();

//            //add on 20100521 ------- begin
//             boolean setDefaultValue = false;
//             boolean isOverValue = false;
//             for ( int i = 0; i < jRadioYAxises.length; i++ ) {
//                 if (  !viewOptions.yAutomatics[i] ) {
//                      setDefaultValue = false;
//                      isOverValue = false;
//                     for( int j = 0; j < selectedChannels.size(); j++ ) {
//                            ViewChannel vcd = selectedChannels.get(j);
//                            if ( viewOptions.yUnits[i].compareTo( vcd.unit ) == 0 ) {
//                                if(viewOptions.yFroms[i] > viewOptions.minValues[j] ){
//                                    isOverValue = true;
//                                    //show message
//                                    int reply = JOptionPane.showConfirmDialog( this, "YAxise"+(i+1)+"'s "+java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("From_value_Greater_than_it's_minvalue_._Set_minvalue_to_From_value_?"),
//                                        java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Comfirm"), JOptionPane.YES_NO_OPTION );
//                                    if ( reply == JOptionPane.OK_OPTION ){
//                                        viewOptions.yFroms[i] = viewOptions.minValues[j] ;
//                                         setDefaultValue = true;
//                                    }else{
////                                        return false;
//                                         setDefaultValue = false;
//                                    }
//                                }
//
//                                if(viewOptions.yTos[i] < viewOptions.maxValues[j] ){
//                                    isOverValue = true;
//                                    setDefaultValue = false;
//                                   //show message
//                                    int reply = JOptionPane.showConfirmDialog( this, "YAxise"+(i+1)+"'s "+java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("To_value_Less_than_it's_maxvalue_._Set_maxvalue_to_To_value_?"),
//                                        java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Comfirm"), JOptionPane.YES_NO_OPTION );
//                                    if ( reply == JOptionPane.OK_OPTION ){
//                                        viewOptions.yTos[i] = viewOptions.maxValues[j] ;
//                                         setDefaultValue = true;
//                                    }else{
////                                        return false;
//                                         setDefaultValue = false;
//                                    }
//                                }
//                                if(isOverValue && !setDefaultValue){
//                                      viewOptions.yAutomatics[i] = orgViewOptions.yAutomatics[i];
//                                      viewOptions.yFroms[i] = orgViewOptions.yFroms[i];
//                                      viewOptions.yTos[i] = orgViewOptions.yTos[i] ;
//                                      setYAxisFieldsBasedOnViewOptions();
//                                      return false;
//                                }
////                                 System.out.println("viewOptions.minValues["+j+"]="+viewOptions.minValues[j]+"=="+"[i]="+i);
////                                 System.out.println("viewOptions.maxValues["+j+"]="+viewOptions.maxValues[j]+"=="+"[i]="+i);
//                                break;
//                            }
//                        }
//                 }
//             }
//            //============ end

            theCommonValue.setOnlyViewOptions( viewOptions );
        } catch (Exception e) {
            JOptionPane.showMessageDialog(this,  java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Please_input_in_right_format."),  java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Reminder"), JOptionPane.OK_OPTION);
            return false;
        }
        return true;
    }
    
    private void initViewOptions() {
        setYAxisFieldsBasedOnViewOptions();
        
        /*jCheckAutoLeft.setSelected( viewOptions.yAutomatics[0] );
        setYLeftFields();
        jTextYLeftFrom.setText( String.valueOf( viewOptions.yFroms[0] ));
        jTextYLeftSteps.setText( String.valueOf( viewOptions.ySteps[0] ));
        jTextYLeftTo.setText( String.valueOf( viewOptions.yTos[0] ));
        
        jCheckAutoRight.setSelected( viewOptions.yAutomatics[1] );
        jCheckDisableY2.setSelected( viewOptions.yDisableds[1] );
        setYRightFields();
        jTextYRightFrom.setText( String.valueOf( viewOptions.yFroms[1] ));
        jTextYRightSteps.setText( String.valueOf( viewOptions.ySteps[1] ));
        jTextYRightTo.setText( String.valueOf( viewOptions.yTos[1] ));*/
    }
    
    private void jButtonRemoveActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonRemoveActionPerformed

//        for (int i = 0; i < selectedListModel.size(); i++) {
//             String key = (String) selectedListModel.get(i);
//                ViewChannel vc = selectedMap.get(key);
//              System.out.println(" remove 1111 vc.colorChanged="+vc.colorChanged);
//        }
        int[] selectedIx = jListSelected.getSelectedIndices();
        for (int i = 0; i < selectedIx.length; i++) {
            String item = (String) selectedListModel.getElementAt(selectedIx[i]);
            ViewChannel vc = selectedMap.get(item);
            
            availableListModel.addElement(item);
            if (vc != null) {
                availableMap.put(item, vc);
            }
            selectedMap.remove(item);
        }
        // remove from available list. the reason it's put here because removing it
        // in the previous loop will affect the list's index
        for (int i = 0; i < selectedIx.length; i++) {
            selectedListModel.remove(selectedIx[i] - i );
        }


//        for (int i = 0; i < selectedListModel.size(); i++) {
//             String key = (String) selectedListModel.get(i);
//                ViewChannel vc = selectedMap.get(key);
//              System.out.println(" remove vc.colorChanged="+vc.colorChanged);
//        }
        // deal with the Y axis unit setup.
            reArrangeYAxisUnits();
            //checkIfDisableY2();
        reArrangeYAxisDisabilities();

         assignColors();//add on 20100521.
         
         /*
          * added base on TF's requirtment:
          * If I remove channels from the channel selection then these channels are sorted to the end of 
          * the table? I think they should be sorted according to the 4 digits S/N and the connector number.
          */
         sort(availableListModel);
         
    }//GEN-LAST:event_jButtonRemoveActionPerformed

    /**
     * Sort ListModel content 
     * @param dm
     * @return 
     */
    public DefaultListModel sort(DefaultListModel dm){
        if(dm == null){
            return null;
        }
        
        Object[] obj = dm.toArray();
        int n= obj.length;
        for(int i=0;i<n;i++){
            for(int j=0;j<n-i-1;j++){
                if(obj[j].toString().compareTo((obj[j+1].toString())) > 0){
                    Object temp = obj[j];
                    obj[j]=obj[j+1];
                    obj[j+1]=temp;
                }
            }
        }
        dm.removeAllElements();
        for(int i=0;i<n;i++){
            dm.addElement(obj[i]);
        }
        return dm;
    }
    
    /** re-arrange the Y axis units to match the selected channels
     */
    private void reArrangeYAxisUnits() {
        String unit;
        
        yUnitModel.removeAllElements();
        
        Arrays.fill( viewOptions.yDisableds, true );
        //viewOptions.yDisableds[0] = false;
        
        for (int i = 0; i < selectedListModel.size(); i++) {  
            String item = (String) selectedListModel.getElementAt(i);
            ViewChannel vc = selectedMap.get(item);
            
            boolean existed = false;
            for ( int j = 0; j < yUnitModel.getSize(); j++ ) {
                unit = (String) yUnitModel.getElementAt(j);
                if ( vc.unit.compareTo(unit) == 0 ) {
                    existed = true;
                    break;
                }
            }
            
            if ( !existed ) 
                yUnitModel.addElement( vc.unit );
            
            // if it matches any yAxis unit, then enable this axis
            for ( int j = 0; j < GUIConst.Y_AXIS_NUMBER; j++ ) {
                if ( vc.unit.compareTo( viewOptions.yUnits[j] ) == 0 ) {
                    viewOptions.yDisableds[j] = false;
                    break;
                }
            }
            
        }
        
        /*yLeftUnitModel.removeAllElements();
        yRightUnitModel.removeAllElements();
        
        //for (int i = 0; i < selectedListModel.size(); i++) {
        // change is: we now limit the choice of unit within selected channels
        for (int i = 0; i < selectedListModel.size(); i++) {  
            String item = (String) selectedListModel.getElementAt(i);
            ViewChannel vc = selectedMap.get(item);
            
            yLeftUnitModel.addElement(vc.unit);
            yRightUnitModel.addElement(vc.unit);
            
            if ( i == 0 ) {
                yLeftUnitModel.setSelectedItem(vc.unit);
                yRightUnitModel.setSelectedItem(vc.unit);
            } else {
                unitLeft = (String) yLeftUnitModel.getSelectedItem();
                if ( unitLeft.compareTo(vc.unit) != 0 ) {
                    yRightUnitModel.setSelectedItem(vc.unit);
                }
            }
        }        */
    }
    
    private void jButtonSelectActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonSelectActionPerformed
        int[] selectedIx = jListAvailable.getSelectedIndices();
        int stopIndex = -1; // index when operation stops due to error
//         for (int i = 0; i < selectedListModel.size(); i++) {
//             String key = (String) selectedListModel.get(i);
//                ViewChannel vc = selectedMap.get(key);
//              System.out.println("11111vc.colorChanged="+vc.colorChanged);
//        }
        // maximum 10 channels are allowed
        if ( selectedListModel.getSize() + selectedIx.length > GUIConst.MAX_CHANNEL_ALLOW ) {
            JOptionPane.showMessageDialog(this,  java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Sorry,_only_") + GUIConst.MAX_CHANNEL_ALLOW + " "+java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("_channels_maximum_are_allowed."));
            return;
        }
        
        // the theory is: if there're already max units number of channels selected, then compare this new selected one 
        // with the selected ones' units. if the new one matches neither, then refuse to add.
        
        for (int i = 0; i < selectedIx.length; i++) {
            String item = (String) availableListModel.getElementAt(selectedIx[i]);
            ViewChannel vc = availableMap.get(item);
            String unit; // unitLeft, unitRight;
          
            if ( vc != null ) {
                if ( selectedMap.size() == 0 ) {
                    //yLeftUnitModel.addElement(vc.unit);
                    //yRightUnitModel.addElement(vc.unit);
                    
                    //yLeftUnitModel.setSelectedItem(vc.unit);
                    yUnitModel.addElement(vc.unit);
                    yUnitModel.setSelectedItem(vc.unit);
                    
                    viewOptions.yDisableds[0] = false;
                /*} else if ( selectedMap.size() == 1 ) {
                    unitLeft = (String) yLeftUnitModel.getSelectedItem();
                    if ( vc.unit.compareTo(unitLeft) != 0 ) {
                        yLeftUnitModel.addElement(vc.unit);
                        yRightUnitModel.addElement(vc.unit);
                    }
                    
                    yRightUnitModel.setSelectedItem(vc.unit);*/
                } else {
                    //unit = (String) yUnitModel.getSelectedItem();
                    boolean toAdd = false;
                    for ( int j = 0; j < GUIConst.Y_AXIS_NUMBER; j++ ) {
                        // check every axis, if axis is disabled or axis unit match the selected one, add
                        if ( viewOptions.yDisableds[j]  ) {
                            viewOptions.yDisableds[j] = false;
                            viewOptions.yUnits[j] = vc.unit;
                            viewOptions.yAutomatics[j] = true;
                            yUnitModel.addElement( vc.unit );
                            toAdd = true;
                            break;
                        } else {
                            if ( vc.unit.compareTo( viewOptions.yUnits[j] ) == 0 ) {
                                toAdd = true;
                                break;
                            }
                        }
                    }

                    if ( !toAdd ) {
                        JOptionPane.showMessageDialog( this, java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Sorry,_only_") + GUIConst.Y_AXIS_NUMBER 
                                + java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("_different_units_can_be_choosen_at_the_same_time.") );
                        break;
                    }
                    
                    /*unitLeft = (String) yLeftUnitModel.getSelectedItem();
                    unitRight = (String) yRightUnitModel.getSelectedItem();
                    if ( vc.unit.compareTo(unitLeft) != 0 && vc.unit.compareTo(unitRight) != 0 ) {
                        if ( unitLeft.compareTo(unitRight) == 0 ) {
                            yLeftUnitModel.addElement(vc.unit);
                            yRightUnitModel.addElement(vc.unit);
                            yRightUnitModel.setSelectedItem(vc.unit);
                        } else {
                            // doesn't match either one, and left and right are already different. add fail.
                            JOptionPane.showMessageDialog( this, "Sorry, only " + GUIConst.Y_AXIS_NUMBER 
                                    + " different units can be choosen at the same time." );
                            break;
                        }
                    }*/
                }  // end of 'if selectedMap.size() == 0''
                
                selectedListModel.addElement(item);
                selectedMap.put(item, vc);
            } 
            
            availableMap.remove(item);
            
            stopIndex = i;
        }
        // remove from available list. the reason it's put here because removing it
        // in the previous loop will affect the list's index
        //for (int i = 0; i < selectedIx.length; i++) {
        for (int i = 0; i <= stopIndex; i++) {
            availableListModel.remove(selectedIx[i] - i);
        }
//         for (int i = 0; i < selectedListModel.size(); i++) {
//             String key = (String) selectedListModel.get(i);
//                ViewChannel vc = selectedMap.get(key);
//              System.out.println("vc.colorChanged="+vc.colorChanged);
//        }
        assignColors();
        
        //checkIfDisableY2();
        reArrangeYAxisDisabilities();
    }//GEN-LAST:event_jButtonSelectActionPerformed

    private void assignColors() {

        for (int i = 0; i < selectedListModel.size(); i++) {
            try {
                String key = (String) selectedListModel.get(i);
                ViewChannel vc = selectedMap.get(key);
                //add on 20100512, MK's requirement. --------- begin
                if(vc.colorChanged){                 
                    continue;
                }
                 vc.color = viewOptions.ChannelColors[i];                 
              

                 // ------------------ end
//System.out.println("assigning color new color " + vc.color);
            } catch (Exception e) {}
        }
    }
    
    private void checkIfDisableY2() {
        if (selectedListModel.size() < 2) {
            //jCheckDisableY2.setSelected(true);
        } else {
            //jCheckDisableY2.setSelected(false);            
        }
        //setYRightFields();
    }
    
    /** the theory: check from 2nd axis, if it's disabled, then switch it's settings with the next available one 
     * continue till last one.
     */ 
    private void reArrangeYAxisDisabilities() {
        int axis = 0;
        int nextAxis;
        
        while( axis < GUIConst.Y_AXIS_NUMBER ) {
            if ( viewOptions.yDisableds[axis] ) {
                // look for next enabled one
                for ( nextAxis = axis + 1; nextAxis < GUIConst.Y_AXIS_NUMBER; nextAxis++ ) {
                    if ( !viewOptions.yDisableds[nextAxis] ) {
                        viewOptions.switchYAxisSettings( axis, nextAxis );
                        break;
                    }
                } // for nextAxis loop
            }
            
            axis++;
        }
        
        // to be safe, select the first axis to display
        jRadioYAxises[0].setSelected( true );
        updateYAxisOptions( null );
        
        setYFieldsAvailability();
    }
    
    /*private void setYRightFields() {
        if (jCheckAutoRight.isSelected() || jCheckDisableY2.isSelected()) {
            jTextYRightSteps.setEditable(false);
            jTextYRightFrom.setEditable(false);
            jTextYRightTo.setEditable(false);
        } else {
            jTextYRightSteps.setEditable(true);
            jTextYRightFrom.setEditable(true);
            jTextYRightTo.setEditable(true);
        }        
        
        if (jCheckDisableY2.isSelected()) {
            jComboYRightUnit.setEnabled(false);
            jCheckAutoRight.setEnabled(false);
        } else {
            jComboYRightUnit.setEnabled(true);
            jCheckAutoRight.setEnabled(true);
        }
    }*/
    
    private void jCheckAutoActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jCheckAutoActionPerformed
        // TODO add your handling code here:
        //setYLeftFields();
        //setYAxisFieldsBasedOnViewOptions();
        viewOptions.yAutomatics[selectedAxis] = jCheckAuto.isSelected();
        setYFieldsAvailability();
    }//GEN-LAST:event_jCheckAutoActionPerformed

    /*private void setYLeftFields() {
        if (jCheckAutoLeft.isSelected()) {
            jTextYLeftSteps.setEditable(false);
            jTextYLeftFrom.setEditable(false);
            jTextYLeftTo.setEditable(false);
        } else {
            jTextYLeftSteps.setEditable(true);
            jTextYLeftFrom.setEditable(true);
            jTextYLeftTo.setEditable(true);
        }        
    }*/
    
    private void setYFieldsAvailability() {
        if (jCheckAuto.isSelected()) {
            jTextYSteps.setEditable(false);
            jTextYFrom.setEditable(false);
            jTextYTo.setEditable(false);
        } else {
            jTextYSteps.setEditable(true);
            jTextYFrom.setEditable(true);
            jTextYTo.setEditable(true);
        }        
        
        /*if (jCheckDisableY.isSelected()) {
            jComboYUnit.setEnabled(false);
            jCheckAuto.setEnabled(false);
        } else {
            jComboYUnit.setEnabled(true);
            jCheckAuto.setEnabled(true);
        }*/
        
        // hide the axis which is diabled
        for ( int i = 0; i < GUIConst.Y_AXIS_NUMBER; i++ ) {
            if ( viewOptions.yDisableds[i] )
                jRadioYAxises[i].setVisible( false );
            else
                jRadioYAxises[i].setVisible( true );
        }
    }
    
    private void jButtonCancelActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButtonCancelActionPerformed
        // TODO add your handling code here:
        dispose();
    }//GEN-LAST:event_jButtonCancelActionPerformed
    
    /** If it's not from the GraphicView, hide some unecessary components.
     */
    public void hideNonGraphicViewComponents() {
        for (int i = 0; i < jPanelLineColorChooser.getComponentCount(); i++ ) {
            jPanelLineColorChooser.getComponent(i).setVisible(false);
        } 
        jPanelGraphicViewOnly.setVisible(false);
    }
    
    /**
     * @param args the command line arguments
     */
    /*public static void main(String args[]) {
        java.awt.EventQueue.invokeLater(new Runnable() {
            public void run() {
                new ViewConfig().setVisible(true);
            }
        });
    }*/
    
    private static final String AUTOMATIC_SELECT_MESSAGE = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Sorry,_this_field_is_only_enabled_when_Automatic_Scaling_isn't_selected.");
    
    private static final int DEFAULT_WIDTH = 800;
    private static final int DEFAULT_HEIGHT = 650;

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton jButtonCancel;
    private javax.swing.JButton jButtonChangeColor;
    private javax.swing.JButton jButtonChangeStyle;
    private javax.swing.ButtonGroup jButtonGroupTime;
    private javax.swing.ButtonGroup jButtonGroupYAxis;
    private javax.swing.JButton jButtonOK;
    private javax.swing.JButton jButtonRemove;
    private javax.swing.JButton jButtonSave;
    private javax.swing.JButton jButtonSelect;
    private javax.swing.JCheckBox jCheckAuto;
    private javax.swing.JCheckBox jCheckDisableY;
    private javax.swing.JComboBox jComboYUnit;
    private javax.swing.JLabel jLabel11;
    private javax.swing.JLabel jLabel12;
    private javax.swing.JLabel jLabel13;
    private javax.swing.JLabel jLabel14;
    private javax.swing.JLabel jLabel15;
    private javax.swing.JLabel jLabel19;
    private javax.swing.JLabel jLabel2;
    private javax.swing.JLabel jLabel21;
    private javax.swing.JLabel jLabel22;
    private javax.swing.JLabel jLabel3;
    private javax.swing.JLabel jLabel4;
    private javax.swing.JLabel jLabel5;
    private javax.swing.JLabel jLabel6;
    private javax.swing.JLabel jLabel7;
    private javax.swing.JLabel jLabel8;
    private javax.swing.JLabel jLabelChangeColor;
    private javax.swing.JLabel jLabelLine;
    private javax.swing.JList jListAvailable;
    private javax.swing.JList jListSelected;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JPanel jPanel10;
    private javax.swing.JPanel jPanel11;
    private javax.swing.JPanel jPanel14;
    private javax.swing.JPanel jPanel16;
    private javax.swing.JPanel jPanel2;
    private javax.swing.JPanel jPanel20;
    private javax.swing.JPanel jPanel3;
    private javax.swing.JPanel jPanel4;
    private javax.swing.JPanel jPanel5;
    private javax.swing.JPanel jPanel6;
    private javax.swing.JPanel jPanel7;
    private javax.swing.JPanel jPanelCenter;
    private javax.swing.JPanel jPanelGraphicViewOnly;
    private javax.swing.JPanel jPanelLineColorChooser;
    private javax.swing.JPanel jPanelYAxisSelection;
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JScrollPane jScrollPane3;
    private javax.swing.JTextField jTextYFrom;
    private javax.swing.JTextField jTextYSteps;
    private javax.swing.JTextField jTextYTo;
    // End of variables declaration//GEN-END:variables
    
    private DefaultListModel availableListModel;
    private Hashtable<String, ViewChannel> availableMap;
    
    private DefaultListModel selectedListModel;
    private Hashtable<String, ViewChannel> selectedMap;
    private java.util.ArrayList<ViewChannel> selectedChannels;
    private java.util.ArrayList<ViewChannel> availableChannels;
    
    private DefaultComboBoxModel yUnitModel;
    //private DefaultComboBoxModel yLeftUnitModel;
    //private DefaultComboBoxModel yRightUnitModel;
 
    private int selectedAxis = 0; // There're maximum 4 Y axises. It is to identify the current selected one to configure.
    private javax.swing.JRadioButton[] jRadioYAxises;
    
    //private Hashtable<String, DevicePanel> allDevicePanels;
    private ViewOptions viewOptions;
    private ArrayList<NProtocolHeader> pheaders;
    
    private CSMDF myDB;
    private CommonValue theCommonValue;
    
    private boolean availableChannelsChanged = false;
    //add on 20100526.
    private ViewOptions orgViewOptions;

}