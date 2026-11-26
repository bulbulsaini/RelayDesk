
import { DashboardPage } from './DashboardPage';

export function CustomerDashboard({
  refreshKey,
}: {
  refreshKey: number;
}) {
  return <DashboardPage refreshKey={refreshKey} />;
}
