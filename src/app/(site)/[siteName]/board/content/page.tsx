import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import Opt from './opt';
import RecentTableList from '@/components/service/community/RecentTableList';
import PostCountTableList from '@/components/service/community/PostCountTableList';
import UserInfo from '@/components/service/community/UserInfo';

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
          <RecentTableList />
        </aside>
      </div>
    </main>
  );
}
