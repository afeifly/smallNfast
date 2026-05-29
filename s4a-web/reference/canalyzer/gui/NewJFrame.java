/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

/*
 * NewJFrame.java
 *
 * Created on Sep 29, 2009, 3:28:04 PM
 */

package com.cs.canalyzer.gui;

import com.cs.canalyzer.gui.GUIConst;
import com.cs.canalyzer.structs.CommonValue;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.GridLayout;
import java.awt.Toolkit;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.WindowEvent;
import java.awt.event.WindowStateListener;
import java.util.ArrayList;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;

/**
 *
 * @author be
 */
public class NewJFrame extends javax.swing.JFrame {

    private int pagenum = 0;
    private ArrayList<JTable> tables;
    private JTableTitle ttitle;
    /** Creates new form NewJFrame */
    public NewJFrame(CommonValue commonValue) {
        initComponents();
        //new JTablePanel(commonValue);
        ttitle = new JTableTitle(commonValue);
        tables = commonValue.getStatisticsTables();
        tt(tables,pagenum);
        this.addWindowStateListener(new WindowStateListener () {
             public void windowStateChanged(WindowEvent state) {
                 if(state.getNewState() == 0) {
                    //System.out.println("init state");
                    windowrepait();
                 }
//                if(state.getNewState() == 1 || state.getNewState() == 7) {
//                    System.out.println("window mix");
//                }else if(state.getNewState() == 0) {
//                    System.out.println("init state");
//                    windowrepait();
//                }else if(state.getNewState() == 6) {
//                    System.out.println("window max");
//                }
            }
        });
        
        //this.setBounds(300, 0, 800, 950);

    }


 
    private void tt(ArrayList<JTable> tables,int index){                
          JPanel mainpanel = new JPanel (new BorderLayout());
          JPanel btnpanel = new JPanel (new GridLayout(0,8));
          JButton pb = new JButton("Previous");
          pb.addActionListener(new   ActionListener(){
              public void actionPerformed(ActionEvent event){
                  btnPClicked();
              }
          });

          JButton nb = new JButton("Next");
          nb.addActionListener(new   ActionListener(){
              public void actionPerformed(ActionEvent event){
                  btnNClicked();
              }
          });

          //jPanelMain.setLayout(new FlowLayout(FlowLayout.LEADING));
          btnpanel.add(pb);
          btnpanel.add(nb);
          mainpanel.add(btnpanel,BorderLayout.NORTH);

          //table
          JPanel maintablepanel = new JPanel (new BorderLayout());
          //table title
          JPanel titlepanel = new JPanel (new GridLayout(0,1));

         //System.out.println("mytables.get(0)="+mytables.get(0));
//            JPanel titlepanel = new JPanel (new GridLayout(0,1));
//          GroupableTableHeader tableHeader = new GroupableTableHeader();
         //  table = tables.get(index);
//        table.setTableHeader(tableHeader);
//        DefaultGroup group = new DefaultGroup();
//        group.setRow(0);
//        group.setColumn(0);
//        group.setColumnSpan(table.getColumnCount());
//        //tableModel.setValueAt("Statistics for the selected time period :",0, 0);
//        group.setHeaderValue("A 00000000000000000& B");
//        tableHeader.addGroup(group);
//                model.setValueAt("Statistics for the selected time period :",0, 1);
//      model.setValueAt(GUIConst.DEFAULT_DATE_AND_TIME_FORMAT( theLeakStat.getStartTime()),0, 2);
//      model.setValueAt(" to ",0, 3);
//      model.setValueAt(GUIConst.DEFAULT_DATE_AND_TIME_FORMAT( theLeakStat.getEndTime()),0, 4);
//if ( theLeakStat.analyzeType != LeakStatistics.ANALYZE_TYPE_FLOW ){
//      model.setValueAt("Valid record time :"+String.format( FORMAT_STRING_1_DIGIT,
//                ( myCompressors.get(0).TotalHours )).trim() + "  " + TIME_UINT ,1, 1);
//}

         titlepanel.add(ttitle.setTitle());
         maintablepanel.add(titlepanel,BorderLayout.NORTH);

        //table main body
          JPanel tabelpanel = new JPanel (new GridLayout(0,1));
          tabelpanel.add(tables.get(index));
          maintablepanel.add(tabelpanel,BorderLayout.CENTER);
          JScrollPane scroll = new JScrollPane(maintablepanel);

        //  maintablepanel.add(scroll,BorderLayout.CENTER);

          mainpanel.add(scroll,BorderLayout.CENTER);
//           mainpanel.add(maintablepanel,BorderLayout.CENTER);
          mainpanel.setPreferredSize(new Dimension(795,915));

          //this.getContentPane().add(jPanelMain);
          this.setResizable(false);
          this.getContentPane().removeAll();
          this.setContentPane (mainpanel);

          this.setDefaultCloseOperation (JFrame.DISPOSE_ON_CLOSE);
          this.pack();
          this.setIconImage( new ImageIcon( getClass().getResource( GUIConst.IMAGE_PATH + GUIConst.LOGO_FILE_NAME)).getImage() );

          Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();
          int height = dim.height * 3 / 4;
          this.setBounds(( dim.width - WIDTH ) / 2, ( dim.height - height ) / 2, WIDTH, height );
          
          this.setTitle(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Statistics_Report"));

    }

    private void windowrepait(){
         //initComponents();
         tt(tables,pagenum);
    }
    private void btnNClicked(){
//        System.out.println("btnEClicked pagenum="+pagenum);
//        System.out.println("btnEClicked tables.size()="+tables.size());
          if ( pagenum >= tables.size() - 1 )
                return;
           pagenum++;
           tt(tables,pagenum);        
    }
     private void btnPClicked(){
           if ( pagenum == 0 )
                return;
            pagenum--;
            tt(tables,pagenum);           
    }
     
    final static int WIDTH = 800;
     
    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    @SuppressWarnings("unchecked")
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jPanelMain = new javax.swing.JPanel();

        setDefaultCloseOperation(javax.swing.WindowConstants.EXIT_ON_CLOSE);

        jPanelMain.setLayout(new org.netbeans.lib.awtextra.AbsoluteLayout());

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(getContentPane());
        getContentPane().setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(jPanelMain, javax.swing.GroupLayout.DEFAULT_SIZE, 672, Short.MAX_VALUE)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addGap(10, 10, 10)
                .addComponent(jPanelMain, javax.swing.GroupLayout.DEFAULT_SIZE, 644, Short.MAX_VALUE))
        );

        pack();
    }// </editor-fold>//GEN-END:initComponents

    /**
    * @param args the command line arguments
    */
//    public static void main(String args[]) {
//        java.awt.EventQueue.invokeLater(new Runnable() {
//            public void run() {
//                new NewJFrame().setVisible(true);
//            }
//        });
//    }

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JPanel jPanelMain;
    // End of variables declaration//GEN-END:variables

}
