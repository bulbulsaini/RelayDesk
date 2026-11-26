
import { DashboardPage } from './DashboardPage';

export function AdminDashboard({
  refreshKey,
}: {
  refreshKey: number;
}) {
  return <DashboardPage refreshKey={refreshKey} />;
}
