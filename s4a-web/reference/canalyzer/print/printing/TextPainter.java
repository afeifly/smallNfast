/*
 * TextPainter.java
 *
 * Created on April 9, 2007, 6:33 PM
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.print.printing;

import com.cs.canalyzer.structs.BasicSetting;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.font.FontRenderContext;
import java.awt.font.LineBreakMeasurer;
import java.awt.font.TextAttribute;
import java.awt.font.TextLayout;
import java.awt.geom.Point2D;
import java.awt.print.PageFormat;
import java.awt.print.Printable;
import java.awt.print.PrinterException;
import java.text.AttributedString;
import java.util.ArrayList;
import java.util.Vector;
import javax.swing.ImageIcon;

/**
 * print text using the printing API of JDK 1.2
 * @author ll
 */
public class TextPainter extends Painter {
   protected String bodyText;
   public ArrayList<PrintModelAdapter> tableModels;
   ArrayList<ArrayList<Object>> tableData;
   ArrayList<Object> rowData;
   public int sectionNo = 0;
   
   private BasicSetting basicSetting;//add by be,2008/10/18.
   
   private Point2D.Double pen;
   private double textWidth;
   private Font titleFont;
   private Font bodyFont;
   private int titleAlign;
   private int bodyAlign;
   private String seviceLogoPath;
   
   protected double spaceBelowLogo;
   public static final String TAG = "<";
   public static final String TABLE_TAG_HEADER = "<T"; // table tag for header
   public static final String TABLE_TAG = "<t"; // table tag for normal text
   public static final String BOLD_TAG = "<b";
   
   
   /** Creates a new instance of TextPainter */
   public TextPainter(String title, String footer, String logoPath, String bodyText) {     
      super(title, footer, logoPath);        
      this.bodyText = bodyText;    
      tableModels = new ArrayList<PrintModelAdapter>();
      this.pen = new Point2D.Double(0.0, 0.0);
   }
   
   //add by be, 2008/10/18 .
   public void drawServiceLogo(Graphics2D g2, String logoPath){  
       if(logoPath != null){
           ImageIcon serviceLogoImage = null;
           int logoWidth = 0; // to be calculated based on scale factor
           int logoHeight = 0;
           serviceLogoImage = PrintManager.validateAndCreateImageIcon(logoPath);
           if (serviceLogoImage != null) {
               
               logoHeight = 30; // default logo height
               // scale while maintaining aspect ratio
               logoWidth = serviceLogoImage.getIconWidth() *
               logoHeight / serviceLogoImage.getIconHeight();
           }
           //System.out.println("serviceLogoImage =="+serviceLogoImage);

           if (serviceLogoImage != null) {
             int x = logoWidth;
             g2.drawImage(serviceLogoImage.getImage(), 80, 380, logoWidth, logoHeight, null);
             // What if logoImage is null? Modified on 2007.7.2
            // pen.setLocation(0.0, logoHeight);
           } else {
             //pen.setLocation(0.0, 0.0);
           }  
       }
   }
   
   public String createHeaderTableMode(String s, String[] columnNames, String[] headers, boolean hasNum) {
      tableData = new ArrayList<ArrayList<Object>>();
      rowData = new ArrayList<Object>();
      if (hasNum) {
         rowData.add(++sectionNo + ".");
      } else {
         rowData.add("");
      }
      for (int i = 0; i < headers.length; i++) {
         rowData.add(headers[i]);
      }
      tableData.add(rowData);
      s = createTableModel(s, columnNames, false, FONT_TABLE_HEADER, true);
      return s;
   }
   
   /**
    * @Parameters:
    * cellFont - the font used for table cells. If this is null, the default font
    * will be used.
    */
   public String createTableModel(String s, String[] columnNames, boolean
           hasHeader, Font cellFont, boolean isHeader) {
      if (isHeader) {
         s += TABLE_TAG_HEADER + tableModels.size() + n;
      } else {
         s += TABLE_TAG + tableModels.size() + n;
      }
      PrintModelAdapter tableModel = new PrintModelAdapter(
              new GenericTableModel(tableData, columnNames), null, hasHeader, cellFont);
      tableModels.add(tableModel);
      
      return s;
   }
   
   public static void fillRestOfRow(ArrayList<Object> rowData, int cellCount) {
      for (int i = 0; i < cellCount; i++) {
         rowData.add("");
      }
   }
   
      /*Graphic指明打印的图形环境；PageFormat指明打印页格式(页面大小以点为计量单位，1点
    为1英寸的1/72，1英寸为25.4毫米。A4纸大致为595×842点)；page指明页号
    Note: page is the zero based index of the page to be drawn!
       */
   public int print(Graphics graphics, PageFormat pageFormat, int pageIndex) throws PrinterException {
      Graphics2D g2 = (Graphics2D)graphics;
      textWidth = pageFormat.getImageableWidth();
      g2.setPaint(Color.black); //设置打印颜色为黑色
      
      g2.translate(pageFormat.getImageableX(), pageFormat.getImageableY());//转换坐标，确定打印边界
      drawCurrentPageText(g2, pageFormat, pageIndex); //打印当前页文本
      return Printable.PAGE_EXISTS; //存在打印页时，继续打印工作
   }
   
      /* 打印指定页号的具体文本内容
       * Note: Do not forget to reset the point object pen to point to the top left
       *  corner of the TextLayout object
       */
   private void drawCurrentPageText(Graphics2D g2, PageFormat pf, int page) {
      String pageText = bodyText;
      String drawText;
      int index;
      int printedLines = 0;
      
      //1. draw company logo. Note: g2 has been translated.
      if (logoImage != null) {
         int x = (int)pf.getImageableWidth() - logoWidth;
         g2.drawImage(logoImage.getImage(), x, 0, logoWidth, logoHeight, null);
         // What if logoImage is null? Modified on 2007.7.2
         pen.setLocation(0.0, logoHeight);
      } else {
         pen.setLocation(0.0, 0.0);
      }      
      
      //2. draw title
      if (title != null) {
         drawTitleLine(g2, title);
      }
      
      int testflg = 0; // draw service logo until 19. add by be ,2008/10/18 .
      while(pageText.length() > 0) { //每页限定在54行以内
         index = pageText.indexOf('\n'); //获取每一个回车符的位置
         printedLines += 1; //计算行数               
         if (index != -1) { //存在回车符            
             testflg = testflg + 1;
             if(testflg == 15){
                String tmpDrawText = pageText.substring(0, index); 
                int indexLogo = tmpDrawText.indexOf("#");
                seviceLogoPath = tmpDrawText.substring(0,indexLogo);
                drawServiceLogo(g2,this.seviceLogoPath);
                drawText = tmpDrawText.substring(indexLogo+1);
             }else{
                drawText = pageText.substring(0, index); //获取每一行文本
             }
             // 3. draw body text      
             if (drawText.startsWith(TABLE_TAG) || // TABLE_TAG = "<t";
                    drawText.startsWith(TABLE_TAG_HEADER)) {
                printTable(g2, pf, drawText);
             } else {
                drawCurrentLine(g2, drawText);
             }          
             
             if (pageText.substring(index + 1).length() > 0) {
                pageText = pageText.substring(index + 1); //截取尚未打印的文本
             } else {  // if '\n' is at the end of the string
                printedLines++;
                drawCurrentLine(g2, "");
                pageText = "";
             }  
             
             //add by be, 2008/10/18. add service logo
//             if(testflg == 13){
//                drawServiceLogo(g2,this.seviceLogoPath);
//             }
         } else { //不存在回车符
            drawText = pageText; //获取每一行文本
            drawCurrentLine(g2, drawText);
            pageText = ""; //文本已结束
         }
      }
      // 4. draw footer
      if (footer != null) {
         drawFooter(g2, pf, footer);
      }
      //System.out.println(printedLines + " lines printed on page " + page );
   }
   
   private void drawCurrentLine(Graphics2D g2d, String aLine) {
      Font font = bodyFont;
       
      if (aLine.length() == 0) {
         aLine = " ";   // replace a blank line
      } else if (aLine.startsWith(TAG)) {
         if (aLine.startsWith(BOLD_TAG)) {
            //font = FONT_HEADER;
            font = font.deriveFont(Font.BOLD);
         }
         aLine = aLine.substring(2); // e.g. BOLD_TAG = "<b";
      }
      
      AttributedString paragraphText = new AttributedString(aLine);
      paragraphText.addAttribute(TextAttribute.FONT, font);
      LineBreakMeasurer lineBreaker = new LineBreakMeasurer(paragraphText.getIterator(),
              new FontRenderContext(null, true, true));
      
      TextLayout layout;
      Vector lines = new Vector();
      while ((layout = lineBreaker.nextLayout((float) textWidth)) != null) {
         lines.add(layout);
      }
      // see PFParagraph class for implementations of different justifications
      for (int i = 0; i < lines.size(); i++) {
         layout = (TextLayout) lines.get(i);
         pen.y += layout.getAscent();
         
         if (bodyAlign == Painter.ALIGN_CENTER) {
            //--- Align the X pen to center justify the line
            float layoutX = ((float) (pen.x + (textWidth / 2))) - (layout.getAdvance() / 2);
            layout.draw(g2d, layoutX, (float) pen.y); // draw at center
         } else {
            if (i != (lines.size() - 1)) {
               // print all but the last line with justification
               layout = layout.getJustifiedLayout((float) textWidth);
            }
            layout.draw(g2d, (float) pen.x, (float) pen.y);
         }
         pen.y += layout.getDescent() + layout.getLeading();
      }
      
     
   }
   
   private void drawTitleLine(Graphics2D g2d, String aLine) {
      pen.y += spaceBelowLogo;
      if (aLine.length() == 0) {
         aLine = " ";   // replace a blank line
      }
      AttributedString paragraphText = new AttributedString(aLine);
      paragraphText.addAttribute(TextAttribute.FONT, titleFont);
      
      LineBreakMeasurer lineBreaker = new LineBreakMeasurer(paragraphText.getIterator(),
              new FontRenderContext(null, true, true));
      
      TextLayout layout;
      while ((layout = lineBreaker.nextLayout((float) textWidth)) != null) {
         pen.y += layout.getAscent();
         
         if (titleAlign == Painter.ALIGN_CENTER) {
            //--- Align the X pen to center justify the line
            float layoutX = ((float) (pen.x + (textWidth / 2))) - (layout.getAdvance() / 2);
            layout.draw(g2d, layoutX, (float) pen.y); // draw at center
         } else {
            layout.draw(g2d, (float) pen.x, (float) pen.y); // draw at left
         }
         
         pen.y += layout.getDescent() + layout.getLeading();
      }
   }
   
   private void drawFooter(Graphics2D g2d, PageFormat pf, String aLine) {
      if (aLine.length() == 0) {
         aLine = " ";   // replace a blank line
      }
      AttributedString paragraphText = new AttributedString(aLine);
      paragraphText.addAttribute(TextAttribute.FONT, FONT_FOOTER);
      
      LineBreakMeasurer lineBreaker = new LineBreakMeasurer(paragraphText.getIterator(),
              new FontRenderContext(null, true, true));
      
      TextLayout layout;
      while ((layout = lineBreaker.nextLayout((float) textWidth)) != null) {
         pen.y = pf.getImageableHeight() - layout.getDescent(); //Note: g2 has been translated.
         layout.draw(g2d, (float) pen.x, (float) pen.y); // draw at left
         pen.y += layout.getDescent() + layout.getLeading();
      }
   }
   
   private void printTable(Graphics g, PageFormat pf, String drawText) {
      int index = Integer.parseInt(drawText.substring(2)); // examples of tag: <T1, <T10
      FontRenderContext frc = new FontRenderContext(null, true, true);
      PrintModelAdapter tableModel = tableModels.get(index);
      if (drawText.charAt(1) == TABLE_TAG.charAt(1)) {
         // deals with the table for logging interval
         pen.y = pen.y - TablePrinter.SPACE_BELOW_TABLE_TOP - TablePrinter.SPACE_BELOW_TABLE;
      }
      Font cellFont = (tableModel.cellFont == null ? FONT_CELL : tableModel.cellFont);
      TablePrinter tp = new TablePrinter(tableModel, pf, FONT_TABLE_HEADER, cellFont, frc, pen);
      tp.print(g, pf, 0);
   }
   
   public Font getTitleFont() {
      return titleFont;
   }
   
   public void setTitleFont(Font titleFont) {
      this.titleFont = titleFont;
   }
   
   public Font getBodyFont() {
      return bodyFont;
   }
   
   public void setBodyFont(Font bodyFont) {
      this.bodyFont = bodyFont;
   }
   
   public int getTitleAlign() {
      return titleAlign;
   }
   
   public void setTitleAlign(int titleAlign) {
      this.titleAlign = titleAlign;
   }
   
   public int getBodyAlign() {
      return bodyAlign;
   }
   
   public void setBodyAlign(int bodyAlign) {
      this.bodyAlign = bodyAlign;
   }

   public void setSpaceBelowLogo(double spaceBelowLogo) {
      this.spaceBelowLogo = spaceBelowLogo;
   }

    public BasicSetting getBasicSetting() {
        return basicSetting;
    }

    public void setBasicSetting(BasicSetting basicSetting) {
        this.basicSetting = basicSetting;
    }
}
