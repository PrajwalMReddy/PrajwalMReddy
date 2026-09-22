import React from 'react';
import AdminLayout from './AdminLayout';
import UpcomingEvents from './assistant/UpcomingEvents';
import ExecutiveBriefing from './assistant/ExecutiveBriefing';
import { useContent } from '../../utils/ContentContext';

const AdminDashboard = () => {
    const { t } = useContent();

    return (
        <AdminLayout
            title="Dashboard"
            documentTitle={t('pageTitles.admin', 'Admin | Prajwal Reddy')}
        >
            <div className="admin-dashboard-container">
                <div className="admin-dashboard-grid-row">
                    <div className="admin-dashboard-grid-col">
                        <UpcomingEvents />
                    </div>
                    <div className="admin-dashboard-grid-col">
                        <ExecutiveBriefing />
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminDashboard;
