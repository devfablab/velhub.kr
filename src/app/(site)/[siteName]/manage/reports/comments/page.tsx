import Container from '../../menu';
import ReportManage from '../reportManage';

export default function Page() {
  return (
    <Container pageTitle="댓글 신고" menu="reports">
      <ReportManage targetType="comment" />
    </Container>
  );
}
