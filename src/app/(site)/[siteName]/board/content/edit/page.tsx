import TableList from '@/components/service/community/TableList';
import Opt from './opt';

export default function Page() {
  return (
    <main>
      <div className="container">
        <aside>
          <TableList />
        </aside>
        <Opt />
      </div>
    </main>
  );
}
