import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import Opt from './opt';
import UserInfo from '@/components/service/community/UserInfo';
import BoardPostCountTableList from '@/components/service/community/BoardPostCountTableList';

export default function Page() {
  return (
    <main>
      <div className="container">
        <aside>
          <SiteInfo />
          <TableList />
        </aside>
        <Opt />
        <aside>
          <UserInfo />
          <BoardPostCountTableList />
        </aside>
      </div>
    </main>
  );
}
