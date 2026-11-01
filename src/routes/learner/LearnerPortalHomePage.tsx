import { useAuthSession } from '../../app/providers/authSessionContext';
import { GuardianDashboardPage } from '../guardian/GuardianDashboardPage';
import { LearnerDashboardPage } from './LearnerDashboardPage';
import { LearnerProfilePage } from './LearnerProfilePage';
import { AdminProfilePage } from '../admin/AdminProfilePage';
export function LearnerPortalHomePage() { const { primaryRole } = useAuthSession(); return primaryRole === 'guardian' ? <GuardianDashboardPage /> : <LearnerDashboardPage />; }
export function LearnerPortalProfilePage() { const { primaryRole } = useAuthSession(); return primaryRole === 'guardian' ? <AdminProfilePage /> : <LearnerProfilePage />; }
