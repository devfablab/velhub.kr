import TableList from '@/components/service/community/TableList';
import SiteInfo from '@/components/service/community/SiteInfo';
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
