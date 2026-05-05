import TableList from '@/components/service/TableList';
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
