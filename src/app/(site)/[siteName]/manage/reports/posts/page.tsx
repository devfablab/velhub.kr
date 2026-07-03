import Container from '../../menu';
import ReportManage from '../reportManage';

export default function Page() {
  return (
    <Container pageTitle="게시물 신고" menu="reports">
      <ReportManage targetType="post" />
    </Container>
  );
}
