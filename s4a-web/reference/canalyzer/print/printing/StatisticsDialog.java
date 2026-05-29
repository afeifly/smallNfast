/*
 * StatisticsDialog.java
 *
 * Created on January 31, 2008, 5:50 PM
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.print.printing;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.Toolkit;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.KeyEvent;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JEditorPane;
import javax.swing.JPanel;
import javax.swing.JScrollBar;
import javax.swing.JScrollPane;
import javax.swing.border.Border;
import javax.swing.border.CompoundBorder;

/**
 *
 * @author ll
 */
public class StatisticsDialog extends JDialog {
   private JEditorPane editorPane;
   private JScrollPane scrollPane;
   private JButton closeButton;
   public static Dimension scrollPaneSize;
   //public static Dimension scrollPaneSize = new Dimension(500, 700);
   public static final Dimension SCREENSIZE = Toolkit.getDefaultToolkit().getScreenSize();
   public static final int BORDER_WIDTH = 10;
   static {
      if (PrintManager.isCJKLocale()) {
         scrollPaneSize = new Dimension(800, 835); // so as to display the entire client
      } else {
         scrollPaneSize = new Dimension(800, 810);
      }
   }
   /**
    * Creates a new instance of StatisticsDialog
    */
   public StatisticsDialog(Frame parent, boolean modal, String renderedText) {
      super(parent, modal);
      
      Container contentPane = getContentPane();
      contentPane.setBackground(Color.WHITE);
      //contentPane.setForeground(Color.BLUE);
      
      editorPane = new JEditorPane("text/html", renderedText);
      editorPane.setEditable(false);
      
      contentPane.add(createTopPanel(editorPane), BorderLayout.NORTH);
      contentPane.add(createBottomPanel(), BorderLayout.SOUTH);
      setTitle(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Statistics_Report"));
      // adapt to smaller screen
      if(SCREENSIZE.getHeight() < scrollPaneSize.getHeight() ||
           SCREENSIZE.getWidth() < scrollPaneSize.getWidth()) {
         scrollPaneSize.setSize(SCREENSIZE.getHeight(), SCREENSIZE.getHeight() - 130);
      }
      setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);
      pack();
      setLocationRelativeTo(parent);
      getRootPane().setDefaultButton(closeButton);
      
//      addComponentListener(new ComponentAdapter() {
//         public void componentResized(ComponentEvent e)  {
//            System.out.println("resized8");
//            //e.getComponent().validate();
//            Window w = ((Window)e.getComponent());
//            Dimension d = w.getSize();
//            d.setSize(d.getWidth() * 0.9, d.getHeight() * 0.9);
//            scrollPane.setPreferredSize(d);
////            w.pack();
//         }
//      });
   }
   
   private Container createTopPanel(JEditorPane editorPane) {
      scrollPane =
           new JScrollPane(editorPane, JScrollPane.VERTICAL_SCROLLBAR_AS_NEEDED,
           JScrollPane.HORIZONTAL_SCROLLBAR_AS_NEEDED );
      scrollPane.setPreferredSize(scrollPaneSize);
      scrollPane.setBackground(Color.WHITE);
      scrollPane.setBorder(BorderFactory.createEmptyBorder());
      Border innerBorder = BorderFactory.createEmptyBorder(BORDER_WIDTH, BORDER_WIDTH, BORDER_WIDTH, BORDER_WIDTH);
      //Border outerBorder = BorderFactory.createLineBorder(Color.BLACK);
      Border outerBorder = BorderFactory.createEmptyBorder();
      CompoundBorder border = BorderFactory.createCompoundBorder(outerBorder, innerBorder);
      outerBorder = BorderFactory.createEmptyBorder(BORDER_WIDTH, BORDER_WIDTH, BORDER_WIDTH, BORDER_WIDTH);
      border = BorderFactory.createCompoundBorder(outerBorder, border);
      editorPane.setBorder(border);
      return scrollPane;
   }
   
   private JPanel createBottomPanel() {
      closeButton = new JButton(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Close"));
      closeButton.setMnemonic(KeyEvent.VK_C);
      closeButton.addActionListener(new ActionListener() {
         public void actionPerformed(ActionEvent e) {
            setVisible(false);
            dispose();
         }
      });
      JPanel bottomPanel = new JPanel();
      bottomPanel.setBorder(BorderFactory.createRaisedBevelBorder());
      bottomPanel.add(closeButton);
      return bottomPanel;
   }
   
   public Container getDialogPanel() {
      return editorPane;
   }
}
