import React from 'react';
import AdminLayout from './AdminLayout';
import { useContent } from '../../utils/ContentContext';

const AdminDashboard = () => {
    const { t } = useContent();

    return (
        <AdminLayout documentTitle={t('pageTitles.admin', 'Admin | Prajwal Reddy')}>
            <div className="admin-blank-page" />
        </AdminLayout>
    );
};

export default AdminDashboard;
