import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import Opt from './opt';

export default function Page() {
  return (
    <main>
      <div className="container">
        <aside>
          <SiteInfo />
          <TableList />
        </aside>
        <Opt />
      </div>
    </main>
  );
}
