import ExcelJS from 'exceljs';
import type { RevenueListItem } from '@/lib/revenue/list';

type RevenueExportColumn = {
  header: string;
  key: keyof RevenueExportRow;
  width: number;
  type: 'text' | 'amount' | 'date';
};

type RevenueExportRow = {
  buyerName: string;
  buyerEmail: string;
  boardName: string;
  seriesName: string;
  postTitle: string;
  paymentType: string;
  status: string;
  paymentAmount: number;
  paymentSupplyAmount: number;
  paymentVatAmount: number;
  refundAmount: number;
  refundSupplyAmount: number;
  refundVatAmount: number;
  pgFeeAmount: number;
  platformFeeAmount: number;
  settlementAmount: number;
  paidAt: Date | null;
  refundedAt: Date | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  orderNo: string;
};

const columns: RevenueExportColumn[] = [
  { header: '구매자', key: 'buyerName', width: 20, type: 'text' },
  { header: '구매자 이메일', key: 'buyerEmail', width: 28, type: 'text' },
  { header: '게시판 이름', key: 'boardName', width: 20, type: 'text' },
  { header: '연재 이름', key: 'seriesName', width: 20, type: 'text' },
  { header: '포스팅 제목', key: 'postTitle', width: 36, type: 'text' },
  { header: '결제 유형', key: 'paymentType', width: 18, type: 'text' },
  { header: '상태', key: 'status', width: 14, type: 'text' },
  { header: '결제금액', key: 'paymentAmount', width: 14, type: 'amount' },
  { header: '결제 공급가액', key: 'paymentSupplyAmount', width: 14, type: 'amount' },
  { header: '결제 부가세', key: 'paymentVatAmount', width: 14, type: 'amount' },
  { header: '환불금액', key: 'refundAmount', width: 14, type: 'amount' },
  { header: '환불 공급가액', key: 'refundSupplyAmount', width: 14, type: 'amount' },
  { header: '환불 부가세', key: 'refundVatAmount', width: 14, type: 'amount' },
  { header: '결제 수수료', key: 'pgFeeAmount', width: 14, type: 'amount' },
  { header: '플랫폼 수수료', key: 'platformFeeAmount', width: 14, type: 'amount' },
  { header: '정산금액', key: 'settlementAmount', width: 14, type: 'amount' },
  { header: '결제일', key: 'paidAt', width: 22, type: 'date' },
  { header: '환불일', key: 'refundedAt', width: 22, type: 'date' },
  { header: '확정일', key: 'confirmedAt', width: 22, type: 'date' },
  { header: '완료일', key: 'completedAt', width: 22, type: 'date' },
  { header: '주문번호', key: 'orderNo', width: 26, type: 'text' },
];

function getTextCellValue(value: string | null) {
  return value ?? '';
}

function getExcelKstDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

function getRevenueExportRow(item: RevenueListItem): RevenueExportRow {
  return {
    buyerName: getTextCellValue(item.buyerName),
    buyerEmail: getTextCellValue(item.buyerEmail),
    boardName: getTextCellValue(item.boardName),
    seriesName: getTextCellValue(item.seriesName),
    postTitle: getTextCellValue(item.postTitle),
    paymentType: getTextCellValue(item.paymentType),
    status: getTextCellValue(item.status),
    paymentAmount: item.paymentAmount,
    paymentSupplyAmount: item.paymentSupplyAmount,
    paymentVatAmount: item.paymentVatAmount,
    refundAmount: item.refundAmount,
    refundSupplyAmount: item.refundSupplyAmount,
    refundVatAmount: item.refundVatAmount,
    pgFeeAmount: item.pgFeeAmount,
    platformFeeAmount: item.platformFeeAmount,
    settlementAmount: item.settlementAmount,
    paidAt: getExcelKstDate(item.paidAt),
    refundedAt: getExcelKstDate(item.refundedAt),
    confirmedAt: getExcelKstDate(item.confirmedAt),
    completedAt: getExcelKstDate(item.completedAt),
    orderNo: getTextCellValue(item.orderNo),
  };
}

export async function getRevenueXlsxBuffer(items: RevenueListItem[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('수익정산');

  worksheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));

  worksheet.getRow(1).font = { bold: true };

  items.forEach((item) => {
    worksheet.addRow(getRevenueExportRow(item));
  });

  columns.forEach((column, index) => {
    const excelColumn = worksheet.getColumn(index + 1);

    if (column.type === 'amount') {
      excelColumn.numFmt = '#,##0';
    }

    if (column.type === 'date') {
      excelColumn.numFmt = 'yyyy-mm-dd hh:mm';
    }
  });

  return workbook.xlsx.writeBuffer();
}
