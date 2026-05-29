/*
 * PDFExportAction.java
 *
 * Created on 2007年7月30日, 下午4:58
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */
package com.cs.canalyzer.export;

import com.cs.canalyzer.gui.Base;
import com.cs.canalyzer.gui.JTableTitle;
import com.cs.canalyzer.print.printing.CoverPageForm;
import com.cs.canalyzer.print.printing.PrintManager;
import com.cs.canalyzer.structs.BasicSetting;
import com.cs.canalyzer.structs.LeakStatistics;
import com.lowagie.text.BadElementException;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.awt.Container;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Vector;
import javax.swing.ImageIcon;
import javax.swing.JDialog;
import javax.swing.JTable;
import javax.swing.table.DefaultTableModel;

/**
 *
 * @author ll
 */
public class PDFExportAction extends ExportAction {

//    private Image logoImage = null; // logo to be added
    boolean insertSpace = false; // if true, space is inserted below logo on 1st page
    // 2nd page won't be affected
    // The font variables below must be static or a problem will occurs
    public static Font fontTitle1 = new Font(Font.HELVETICA, 24, Font.BOLD);
    public static Font fontTitle2 = new Font(Font.HELVETICA, 20, Font.BOLD);
    public static Font fontBodyCover = new Font(Font.HELVETICA, 14, Font.BOLD);
    public static Font fontBody = new Font(Font.HELVETICA, 11, Font.NORMAL);
    public final static int POINTS_PER_INCH = 72;
    public static final double SPACE_BELOW_LOGO1 = 1.5 * POINTS_PER_INCH;
    public static final double SPACE_BELOW_LOGO2 = 0.2 * POINTS_PER_INCH;


    static {
        if (PrintManager.isCJKLocale()) {
            try {
                //BaseFont bfChi = BaseFont.createFont( "Dialog", "Dialog Input", BaseFont.NOT_EMBEDDED);
                BaseFont bfChi = BaseFont.createFont(); //  .createFont( "Dialog", "Dialog Input", BaseFont.NOT_EMBEDDED);
                fontTitle1 = new Font(bfChi, fontTitle1.getSize(), fontTitle1.getStyle());
                fontTitle2 = new Font(bfChi, fontTitle2.getSize(), fontTitle2.getStyle());
                fontBodyCover = new Font(bfChi, fontBodyCover.getSize(), fontBodyCover.getStyle());
                fontBody = new Font(bfChi, fontBody.getSize(), fontBody.getStyle());
            } catch (DocumentException ex) {
                ex.printStackTrace();
            } catch (IOException ex) {
                ex.printStackTrace();
            }
        }
    }

    /** Creates a new instance of PDFExportAction */
    public PDFExportAction(Base base, JDialog dialog, int choice) {
        super(base, dialog, choice);
    }

    protected void setSaveDialogProperties() {
        dialogTitle = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Export_to_a_PDF_File");
        extension = "pdf";
        desc = java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("PDF_files_(*.pdf)");

        logoImage = createLogoImage();
        if (choice == ExportAction.CHOICE_STAT_REPORT) {
            insertSpace = true;
        }
    }

    public boolean createSpecificFile(BufferedImage[] awtImages) {
        File filePath = getFilePath();
        if (filePath == null) {
            return false;
        }

        // create a PDF file containing the BufferedImage
        // step 1: creation of a document-object
        Document document;

        if (choice == CHOICE_GRAPH) {
            document = new Document(PageSize.A4.rotate());
        } else {
            document = new Document(PageSize.A4);
        }
        document.setMargins(18, 18, 18, 18);
        try {
            // step 2: we create a writer that listens to the document
            // and directs a PDF-stream to a file
            PdfWriter writer = PdfWriter.getInstance(document, new FileOutputStream(filePath));
            // step 3: we open the document
            document.open();
            // step 4: we add content to the document
            //modify on 20091021.be
            //reason : v3-8 create pdf file.
//         if (choice == ExportAction.CHOICE_FULL || choice == ExportAction.CHOICE_DETAILED) {
//            addCoverPage(document); // add cover page
//            document.newPage();
//            addCommentPage(document);
//            document.setPageSize(PageSize.A4.rotate());
//            document.setMargins(18, 18, 10, 18);
//            document.newPage();
//         }

            for (int i = 0; i < awtImages.length; i++) {

                Image image = Image.getInstance(awtImages[i], null);
                image.setAlignment(Image.MIDDLE);
                Rectangle size = document.getPageSize();
//            image.scaleToFit(size.getWidth() * 0.9f, size.getHeight() * 0.9f);
//            image.scaleToFit(size.getWidth() * 0.9f, size.getHeight() * 0.8f); // on 2008.2.22
                image.scaleAbsoluteWidth(size.getWidth() * 0.9f);
                image.scaleAbsoluteHeight(size.getHeight() * 0.9f);
                //modify on 20091021.be
                //reason : v3-8 create pdf file.
//            if (logoImage != null && i != 0) {
                if (logoImage != null && i != 0 && choice != ExportAction.CHOICE_STAT_REPORT) {
                    document.add(logoImage);
                }else if (choice == CHOICE_GRAPH && logoImage != null) {
                      document.add(logoImage);
                }
//            if (insertSpace == true || i > 0) {
//               document.add(new Paragraph(" "));
//            }
                document.add(image);
                //modify on 20091021.be
                //reason : v3-8 create pdf file.
//            if (i < (dailyGraphCount+1) ){ // portrait for 2nd page (statistics report)
//                if (choice == ExportAction.CHOICE_STAT_REPORT) {
//                    document.setPageSize(PageSize.A4);
//                } else {
////                    if (0 < i && i < (dailyStatsCount + 1)) {
////                        document.setPageSize(PageSize.A4);
////                    //            if (i == 0) { // portrait for 2nd page (statistics report)
////                    //               document.setPageSize(PageSize.A4);
////                    //            } else if (i == 1) { // landscape for daily graph pages
////                    //               document.setPageSize(PageSize.A4.rotate());
////                    // ExportDialog.count must be replaced by actual number of daily graphs
////                    //            } else if (i == (1 + dailyGraphCount)) { // portrait for daily statistics pages
////                    //               document.setPageSize(PageSize.A4);
////                    //            }
////                    } else { // portrait for daily statistics pages
////                        document.setPageSize(PageSize.A4.rotate());
////                    }
//                }
                if(i==0)
                    document.setPageSize(PageSize.A4.rotate());
                if (i == 1 && ((choice == ExportAction.CHOICE_FULL) || (choice == ExportAction.CHOICE_DETAILED)))
                        changePDFStatPart(document);
                if(choice == ExportAction.CHOICE_DETAILED)
                    document.setPageSize(PageSize.A4.rotate());
                document.newPage();

            }
        } catch (DocumentException de) {
            document.close();
            de.printStackTrace();
            return false;
        } catch (IOException ioe) {
            document.close();
            ioe.printStackTrace();
            return false;
        }
        // step 5: we close the document
        document.close();
        return true;
    }

    private void changePDFStatPart(Document document) throws DocumentException, IOException {

        commonValue = base.getTheCommonValue();
        ArrayList<JTable> tables = commonValue.getStatisticsTables();
        int len = tables.size();
        JTableTitle ttitle = new JTableTitle(base.getTheCommonValue());
        JTable tmpTitleTable = ttitle.setTitle();
        DefaultTableModel model = (DefaultTableModel) tmpTitleTable.getModel();
        Vector title = model.getDataVector();
        for (int i = 0; i < len; i++) {
            document.setPageSize(PageSize.A4);
            document.newPage();            
            if (logoImage != null) {
                document.add(logoImage);
            }
            JTable tmpTable = tables.get(i);
            model = (DefaultTableModel) tmpTable.getModel();
            Vector datev = model.getDataVector();
            newPdfPage(document, title, datev);
        }
    }
    public static final char cubeSymbol = 0xB3;

    private void newPdfPage(Document document, Vector title, Vector datev) throws DocumentException, IOException {
        LeakStatistics theLeakStat = base.getTheCommonValue().getLeakStatistics();
        Color colFir = new Color(94, 104, 110);
        Color colSec = new Color(121, 137, 146);
        Color colThi = new Color(150, 174, 190);
        BaseFont bfChinese = BaseFont.createFont("STSong-Light", "UniGB-UCS2-H", false);
//        BaseFont bfChinese = BaseFont.createFont("STSong-Light", "Adobe-GB1-UCS2", false);
        Vector temp = (Vector) datev.get(0);
        int colnum = temp.size();
        PdfPTable table = new PdfPTable(colnum);
        float[] widths = null;

        if (colnum == 3) {
            widths = new float[]{0.03f, 0.4f, 0.6f};
        }
        if (colnum == 5) {
            widths = new float[]{0.03f, 0.3f, 0.25f, 0.02f, 0.25f};
        }
        if (colnum == 7) {
            widths = new float[]{0.04f, 0.35f, 0.25f, 0.02f, 0.25f, 0.02f, 0.25f};
        }
        if (colnum == 9) {
            widths = new float[]{0.04f, 0.35f, 0.25f, 0.02f, 0.25f, 0.02f, 0.25f, 0.02f, 0.25f};
        }
        Font pdfFontW = new Font(bfChinese, 7, Font.BOLD);
        pdfFontW.setColor(Color.WHITE);
        Font pdfFontB = new Font(bfChinese, 7, Font.BOLD);
        table.setWidths(widths);
        Vector v = (Vector) title.get(0);
        Vector v2 = (Vector) title.get(1);
        Paragraph ptitle1 = new Paragraph(v.get(0).toString(), pdfFontW);
        Paragraph ptitle1R = new Paragraph(v.get(1).toString(), pdfFontW);

        PdfPCell cell1 = new PdfPCell(ptitle1);
        cell1.setBackgroundColor(colFir);
        table.addCell(cell1);
        PdfPCell cell1R = new PdfPCell(ptitle1R);
        cell1R.setColspan(colnum - 1);
        cell1R.setBackgroundColor(colFir);
        table.addCell(cell1R);
        Paragraph ptitle2 = new Paragraph(v2.get(0).toString(), pdfFontB);
        Paragraph ptitle2R = new Paragraph(v2.get(1).toString(), pdfFontB);
        PdfPCell cell2 = new PdfPCell(ptitle2);
        table.addCell(cell2);
        PdfPCell cell2R = new PdfPCell(ptitle2R);
        cell2R.setColspan(colnum - 1);
        table.addCell(cell2R);
        int rowCount = datev.size();

        for (int rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            Vector rowVector = (Vector) datev.get(rowIndex);
            for (int colIndex = 0; colIndex < colnum; colIndex++) {

                PdfPCell contentCell = null;
                if (rowIndex == 0) {
                    String tempStr = null;
                    if (rowVector.get(colIndex) != null) {
                        tempStr = rowVector.get(colIndex).toString().replace(cubeSymbol, '3');
                    }
                    Paragraph pcontent = new Paragraph(tempStr, pdfFontW);
                    contentCell = new PdfPCell(pcontent);
                    contentCell.setBackgroundColor(colFir);
                } else {
                    String tempStr = null;
                    if (rowVector.get(colIndex) != null) {
                        tempStr = rowVector.get(colIndex).toString().replace(cubeSymbol, '3');
                    }
                    Paragraph pcontent = new Paragraph(tempStr, pdfFontB);
                    contentCell = new PdfPCell(pcontent);
                    if (theLeakStat.isDiaplay_CO2EmmisionPerKWh_in_Report()) {
                        if (rowIndex == 3 || rowIndex == 38) {
                            contentCell.setBackgroundColor(colSec);
                        }
                        if (rowIndex == 11 || rowIndex == 18 || rowIndex == 25 || rowIndex == 30 || rowIndex == 35 ||
                                rowIndex == 46 || rowIndex == 52 || rowIndex == 58 || rowIndex == 62 || rowIndex == 65) {
                            contentCell.setBackgroundColor(colThi);
                        }
                    } else {
                        if (rowIndex == 3 || rowIndex == 35) {
                            contentCell.setBackgroundColor(colSec);
                        }
                        if (rowIndex == 11 || rowIndex == 18 || rowIndex == 25 || rowIndex == 30 ||
                                rowIndex == 43 || rowIndex == 49 || rowIndex == 55 || rowIndex == 58) {
                            contentCell.setBackgroundColor(colThi);
                        }
                    }
                }
                table.addCell(contentCell);
            }
        }
        document.add(table);
    }
    // to be completed

    private void addCommentPage(Document document) throws DocumentException {
        String title = base.getCommentPageTitle();
        String bodyText = base.getCommentPageBodyText();

        if (bodyText != null && bodyText.trim().length() > 0) {
            if (logoImage != null) {
                document.add(logoImage);
            }
            Paragraph[] p = new Paragraph[2];
            p[0] = new Paragraph(title, fontTitle2);
            p[0].setSpacingBefore((float) SPACE_BELOW_LOGO2);
            p[0].setSpacingAfter(POINTS_PER_INCH * 0.4f);
            p[1] = new Paragraph(bodyText, fontBody);

            for (int i = 0; i < p.length; i++) {
                p[i].setIndentationLeft(20);
                p[i].setIndentationRight(20);
                if (i == 0) {
                    p[i].setAlignment(Element.ALIGN_CENTER);
                } else {
                    p[i].setAlignment(Element.ALIGN_JUSTIFIED);
                }
                document.add(p[i]);
            }
        }
    }

    public void addCoverPage(Document document) throws DocumentException {
        //modify on 20091021.be
        //reason : v3-8 create pdf file.
        CoverPageForm cpf = new CoverPageForm(base.getTheCommonValue());
        document.add((Element) cpf.getContainer());
//      if (logoImage != null) {
//         document.add(logoImage);
//      }
//      BasicSetting basicSetting = commonValue.getBasicSetting();
//      Paragraph[] p = new Paragraph[8];
//      p[0] = new Paragraph(basicSetting.CompanyName, fontTitle1);
//      p[0].setSpacingBefore((float)SPACE_BELOW_LOGO1);
//      p[0].setSpacingAfter(POINTS_PER_INCH * 0.5f);
//      p[1] = new Paragraph(basicSetting.AddressLine1, fontBodyCover);
//      p[2] = new Paragraph(basicSetting.AddressLine2, fontBodyCover);
//      p[3] = new Paragraph(basicSetting.AddressLine3, fontBodyCover);
//      p[4] = new Paragraph(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Phone:_") + basicSetting.Phone, fontBodyCover);
//      p[5] = new Paragraph(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Fax:_") + basicSetting.Fax, fontBodyCover);
//      p[6] = new Paragraph(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Email:_") + basicSetting.Email, fontBodyCover);
//      p[7] = new Paragraph(java.util.ResourceBundle.getBundle("com/cs/canalyzer/CAATexts").getString("Webpage:_") + basicSetting.Webpage, fontBodyCover);
//
//      for (int i = 4; i < p.length; i++) {
//         p[i].setSpacingBefore(POINTS_PER_INCH * 0.2f);
//      }
//      for (Paragraph ph : p) {
//         ph.setAlignment(Element.ALIGN_CENTER);
//         document.add(ph);
//      }
    }

    /** create logo image to be added to every page */
//    public Image createLogoImage() {
////      String logoPath = commonValue.getBasicSetting().LogoFilePath;
//        String logoPath = base.getTheCommonValue().getBasicSetting().ServiceLogoFilePath; //modify on 20100819.Be.
//        ImageIcon icon = PrintManager.validateAndCreateImageIcon(logoPath);
//        Image logoImage = null;
//        if (icon != null) {
//            try {
//                logoImage = Image.getInstance(icon.getImage(), null);
//                logoImage.setAlignment(Image.RIGHT);
//                logoImage.scaleToFit(20 * 10, 20);
//            } catch (BadElementException ex) {
//                ex.printStackTrace();
//            } catch (IOException ex) {
//                ex.printStackTrace();
//            }
//        }
//        return logoImage;
//    }
}
