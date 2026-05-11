import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import Opt from './opt';
import UserInfo from '@/components/service/community/UserInfo';
import PostCountTableList from '@/components/service/community/PostCountTableList';

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
          <PostCountTableList />
        </aside>
      </div>
    </main>
  );
}
