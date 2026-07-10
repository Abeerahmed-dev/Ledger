import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';

export interface InvoiceData {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  ntnNumber: string;
  strnNumber: string;
  poNumber: string;
  jobNumber: string;
  paymentTerms: string;
  shippingMethod: string;
  itemName: string;
  itemSku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  gst: number;
  totalPrice: number;
  financialTransactionId: string;
}

// ─── Color palette ───────────────────────────────────────────────────
const DARK_BLUE = '#1A237E';
const HEADER_BG = '#283593';
const LIGHT_GREY = '#F5F5F5';
const BORDER_COLOR = '#9E9E9E';
const TABLE_HEADER_BG = '#E8EAF6';
const WHITE = '#FFFFFF';
const BLACK = '#212121';
const DARK_GREY = '#616161';
const ACCENT = '#1565C0';

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: BLACK,
    backgroundColor: WHITE,
  },

  // ── Top header band ──
  headerBand: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 30,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 8,
    color: '#B3C5F7',
    marginTop: 2,
  },
  invoiceLabel: {
    alignItems: 'flex-end',
  },
  invoiceNoLabel: {
    fontSize: 9,
    color: '#B3C5F7',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  invoiceNoValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    marginTop: 2,
  },

  // ── Body padding ──
  body: {
    paddingHorizontal: 30,
    paddingTop: 14,
    paddingBottom: 10,
  },

  // ── Grid of bordered cells (meta section) ──
  metaGrid: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  metaRowLast: {
    flexDirection: 'row',
  },
  metaCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRightWidth: 1,
    borderRightColor: BORDER_COLOR,
  },
  metaCellLast: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  metaCellFull: {
    flex: 2,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRightWidth: 1,
    borderRightColor: BORDER_COLOR,
  },
  metaLabel: {
    fontSize: 6.5,
    color: DARK_GREY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
    fontFamily: 'Helvetica-Bold',
  },
  metaValue: {
    fontSize: 8.5,
    color: BLACK,
    fontFamily: 'Helvetica-Bold',
  },
  metaValueLight: {
    fontSize: 8,
    color: BLACK,
  },

  // ── Section label ──
  sectionLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 8,
  },

  // ── Line items table ──
  table: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: TABLE_HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    backgroundColor: LIGHT_GREY,
  },
  tableRowEmpty: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    backgroundColor: WHITE,
    height: 16,
  },

  // column widths
  colSr: { width: 28, borderRightWidth: 1, borderRightColor: BORDER_COLOR, paddingHorizontal: 5, paddingVertical: 5 },
  colDesc: { flex: 1, borderRightWidth: 1, borderRightColor: BORDER_COLOR, paddingHorizontal: 5, paddingVertical: 5 },
  colSku: { width: 70, borderRightWidth: 1, borderRightColor: BORDER_COLOR, paddingHorizontal: 5, paddingVertical: 5 },
  colUnit: { width: 35, borderRightWidth: 1, borderRightColor: BORDER_COLOR, paddingHorizontal: 5, paddingVertical: 5, textAlign: 'center' },
  colQty: { width: 40, borderRightWidth: 1, borderRightColor: BORDER_COLOR, paddingHorizontal: 5, paddingVertical: 5, textAlign: 'right' },
  colRate: { width: 55, borderRightWidth: 1, borderRightColor: BORDER_COLOR, paddingHorizontal: 5, paddingVertical: 5, textAlign: 'right' },
  colAmount: { width: 65, paddingHorizontal: 5, paddingVertical: 5, textAlign: 'right' },

  tableHeaderText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: DARK_BLUE,
    textTransform: 'uppercase',
  },
  tableCellText: {
    fontSize: 8,
    color: BLACK,
  },

  // ── Totals grid ──
  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  totalsTable: {
    width: 200,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  totalsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  totalsRowFinal: {
    flexDirection: 'row',
    backgroundColor: DARK_BLUE,
  },
  totalsLabelCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRightWidth: 1,
    borderRightColor: BORDER_COLOR,
  },
  totalsValueCell: {
    width: 75,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'flex-end',
  },
  totalsLabel: {
    fontSize: 7.5,
    color: DARK_GREY,
  },
  totalsValue: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: BLACK,
  },
  totalsFinalLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
  },
  totalsFinalValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
  },

  // ── Signature row ──
  sigRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 10,
  },
  sigCell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: BORDER_COLOR,
    paddingHorizontal: 10,
    paddingVertical: 18,
  },
  sigCellLast: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 18,
  },
  sigLabel: {
    fontSize: 7,
    color: DARK_GREY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 18,
    fontFamily: 'Helvetica-Bold',
  },
  sigLine: {
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    marginTop: 2,
  },
  sigName: {
    fontSize: 6.5,
    color: DARK_GREY,
    marginTop: 3,
  },

  // ── Footer band ──
  footerBand: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 30,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerText: {
    fontSize: 6.5,
    color: '#B3C5F7',
  },
  footerRef: {
    fontSize: 6.5,
    color: '#B3C5F7',
    fontFamily: 'Helvetica-Bold',
  },
});

// ─── Helper: number to words (PKR) ───────────────────────────────────
function numToWords(n: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(num: number): string {
    if (num === 0) return '';
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convert(num % 100) : '');
    if (num < 100000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    if (num < 10000000) return convert(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + convert(num % 100000) : '');
    return convert(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + convert(num % 10000000) : '');
  }

  const intPart = Math.floor(n);
  const words = convert(intPart);
  return (words || 'Zero') + ' Rupees Only';
}

// ─── The PDF Document ─────────────────────────────────────────────────
export const InvoiceDocument: React.FC<{ data: InvoiceData }> = ({ data }) => {
  const formattedDate = new Date(data.invoiceDate).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const rs = (n: number) => `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // 5 empty filler rows after the 1 real line
  const emptyRows = Array.from({ length: 5 });

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Top header band ── */}
        <View style={styles.headerBand}>
          <View>
            <Text style={styles.headerTitle}>SALES TAX INVOICE</Text>
            <Text style={styles.headerSubtitle}>Subject to Karachi Jurisdiction</Text>
          </View>
          <View style={styles.invoiceLabel}>
            <Text style={styles.invoiceNoLabel}>Invoice No.</Text>
            <Text style={styles.invoiceNoValue}>{data.invoiceNumber}</Text>
          </View>
        </View>

        <View style={styles.body}>

          {/* ── Seller / Buyer meta grid ── */}
          <View style={styles.metaGrid}>
            {/* Row 1: Seller info + Invoice Date */}
            <View style={styles.metaRow}>
              <View style={[styles.metaCellFull]}>
                <Text style={styles.metaLabel}>Sold By (Seller)</Text>
                <Text style={styles.metaValue}>Textile ERP Corp</Text>
                <Text style={styles.metaValueLight}>Industrial Area, Karachi, Pakistan</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Invoice Date</Text>
                <Text style={styles.metaValue}>{formattedDate}</Text>
              </View>
              <View style={styles.metaCellLast}>
                <Text style={styles.metaLabel}>Payment Terms</Text>
                <Text style={styles.metaValue}>{data.paymentTerms || '—'}</Text>
              </View>
            </View>

            {/* Row 2: Buyer info */}
            <View style={styles.metaRow}>
              <View style={[styles.metaCellFull]}>
                <Text style={styles.metaLabel}>Sold To (Buyer)</Text>
                <Text style={styles.metaValue}>{data.companyName}</Text>
                {data.companyAddress ? (
                  <Text style={styles.metaValueLight}>{data.companyAddress}</Text>
                ) : null}
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>PO Number</Text>
                <Text style={styles.metaValue}>{data.poNumber || '—'}</Text>
              </View>
              <View style={styles.metaCellLast}>
                <Text style={styles.metaLabel}>Job / JWO No.</Text>
                <Text style={styles.metaValue}>{data.jobNumber || '—'}</Text>
              </View>
            </View>

            {/* Row 3: NTN / STRN / Shipping */}
            <View style={styles.metaRowLast}>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Buyer NTN</Text>
                <Text style={styles.metaValue}>{data.ntnNumber || '—'}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Buyer STRN</Text>
                <Text style={styles.metaValue}>{data.strnNumber || '—'}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Shipping Method</Text>
                <Text style={styles.metaValue}>{data.shippingMethod || '—'}</Text>
              </View>
              <View style={styles.metaCellLast}>
                <Text style={styles.metaLabel}>Phone / Email</Text>
                <Text style={styles.metaValueLight}>{data.companyPhone || '—'}</Text>
              </View>
            </View>
          </View>

          {/* ── Line Items Table ── */}
          <Text style={styles.sectionLabel}>Description of Goods / Services</Text>
          <View style={styles.table}>
            {/* Header row */}
            <View style={styles.tableHeaderRow}>
              <View style={styles.colSr}><Text style={styles.tableHeaderText}>Sr#</Text></View>
              <View style={styles.colDesc}><Text style={styles.tableHeaderText}>Description</Text></View>
              <View style={styles.colSku}><Text style={styles.tableHeaderText}>SKU / Article</Text></View>
              <View style={styles.colUnit}><Text style={[styles.tableHeaderText, { textAlign: 'center' }]}>Unit</Text></View>
              <View style={styles.colQty}><Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Qty</Text></View>
              <View style={styles.colRate}><Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Rate (Rs.)</Text></View>
              <View style={styles.colAmount}><Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Amount (Rs.)</Text></View>
            </View>

            {/* Line item row */}
            <View style={styles.tableRow}>
              <View style={styles.colSr}><Text style={styles.tableCellText}>1</Text></View>
              <View style={styles.colDesc}><Text style={styles.tableCellText}>{data.itemName}</Text></View>
              <View style={styles.colSku}><Text style={styles.tableCellText}>{data.itemSku}</Text></View>
              <View style={styles.colUnit}><Text style={[styles.tableCellText, { textAlign: 'center' }]}>{data.unit}</Text></View>
              <View style={styles.colQty}><Text style={[styles.tableCellText, { textAlign: 'right' }]}>{data.quantity}</Text></View>
              <View style={styles.colRate}><Text style={[styles.tableCellText, { textAlign: 'right' }]}>{data.unitPrice.toFixed(2)}</Text></View>
              <View style={styles.colAmount}><Text style={[styles.tableCellText, { textAlign: 'right' }]}>{data.subtotal.toFixed(2)}</Text></View>
            </View>

            {/* Empty filler rows */}
            {emptyRows.map((_, idx) => (
              <View key={idx} style={styles.tableRowEmpty}>
                <View style={styles.colSr}><Text style={styles.tableCellText}> </Text></View>
                <View style={styles.colDesc}><Text style={styles.tableCellText}> </Text></View>
                <View style={styles.colSku}><Text style={styles.tableCellText}> </Text></View>
                <View style={styles.colUnit}><Text style={styles.tableCellText}> </Text></View>
                <View style={styles.colQty}><Text style={styles.tableCellText}> </Text></View>
                <View style={styles.colRate}><Text style={styles.tableCellText}> </Text></View>
                <View style={styles.colAmount}><Text style={styles.tableCellText}> </Text></View>
              </View>
            ))}
          </View>

          {/* ── Totals Block ── */}
          <View style={styles.totalsSection}>
            <View style={styles.totalsTable}>
              <View style={styles.totalsRow}>
                <View style={styles.totalsLabelCell}><Text style={styles.totalsLabel}>Subtotal</Text></View>
                <View style={styles.totalsValueCell}><Text style={styles.totalsValue}>{rs(data.subtotal)}</Text></View>
              </View>
              <View style={styles.totalsRow}>
                <View style={styles.totalsLabelCell}><Text style={styles.totalsLabel}>Sales Tax (GST 18%)</Text></View>
                <View style={styles.totalsValueCell}><Text style={styles.totalsValue}>{rs(data.gst)}</Text></View>
              </View>
              <View style={styles.totalsRowFinal}>
                <View style={styles.totalsLabelCell}><Text style={styles.totalsFinalLabel}>Total (Incl. GST)</Text></View>
                <View style={styles.totalsValueCell}><Text style={styles.totalsFinalValue}>{rs(data.totalPrice)}</Text></View>
              </View>
            </View>
          </View>

          {/* ── Amount in Words ── */}
          <View style={{ marginBottom: 10, borderWidth: 1, borderColor: BORDER_COLOR, padding: 7 }}>
            <Text style={[styles.metaLabel, { marginBottom: 2 }]}>Amount In Words</Text>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLACK }}>{numToWords(Math.round(data.totalPrice))}</Text>
          </View>

          {/* ── Signature Row ── */}
          <Text style={styles.sectionLabel}>Authorized Signatures</Text>
          <View style={styles.sigRow}>
            <View style={styles.sigCell}>
              <Text style={styles.sigLabel}>Prepared By</Text>
              <View style={styles.sigLine} />
              <Text style={styles.sigName}>Name &amp; Stamp</Text>
            </View>
            <View style={styles.sigCell}>
              <Text style={styles.sigLabel}>Checked / Approved By</Text>
              <View style={styles.sigLine} />
              <Text style={styles.sigName}>Name &amp; Stamp</Text>
            </View>
            <View style={styles.sigCellLast}>
              <Text style={styles.sigLabel}>Received By (Customer)</Text>
              <View style={styles.sigLine} />
              <Text style={styles.sigName}>Name, Stamp &amp; Date</Text>
            </View>
          </View>

        </View>

        {/* ── Footer band ── */}
        <View style={styles.footerBand} fixed>
          <Text style={styles.footerText}>This is a computer-generated invoice. Ref: {data.invoiceId.substring(0, 16).toUpperCase()}</Text>
          <Text style={styles.footerRef}>TEXTILE ERP CORP · KARACHI</Text>
        </View>

      </Page>
    </Document>
  );
};

export async function generateInvoicePdfBuffer(invoiceData: InvoiceData): Promise<Buffer> {
  return await renderToBuffer(<InvoiceDocument data={invoiceData} />);
}
