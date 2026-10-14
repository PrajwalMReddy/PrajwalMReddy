import React, { useState, useCallback } from 'react';
import AdminLayout from './AdminLayout';
import UpcomingEvents from './assistant/UpcomingEvents';
import ExecutiveBriefing from './assistant/ExecutiveBriefing';
import WeatherWidget from './assistant/WeatherWidget';
import PinnedNotesDashboard from './dashboard/PinnedNotesDashboard';
import DashboardSettingsModal from './assistant/DashboardSettingsModal';
import { useContent } from '../../utils/ContentContext';

const AdminDashboard = () => {
    const { t } = useContent();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState('calendar');
    const [refreshKey, setRefreshKey] = useState(0);

    const handleOpenSettings = useCallback((tab = 'calendar') => {
        setSettingsTab(tab);
        setSettingsOpen(true);
    }, []);

    const handleSettingsSaved = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
    }, []);

    const dashboardActions = (
        <button
            type="button"
            className="admin-dashboard-settings-btn"
            onClick={() => handleOpenSettings('calendar')}
            title={t('admin.settings.title', 'Data Sources Settings')}
            aria-label={t('admin.settings.title', 'Data Sources Settings')}
        >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
        </button>
    );

    return (
        <AdminLayout
            title="Dashboard"
            documentTitle={t('pageTitles.admin', 'Admin | Prajwal Reddy')}
            actions={dashboardActions}
        >
            <div className="admin-dashboard-container">
                <PinnedNotesDashboard />
                <div className="admin-dashboard-grid-row">
                    <div className="admin-dashboard-grid-col">
                        <UpcomingEvents key={`events_${refreshKey}`} onOpenSettings={handleOpenSettings} />
                    </div>
                    <div className="admin-dashboard-grid-col">
                        <ExecutiveBriefing key={`news_${refreshKey}`} />
                        <WeatherWidget key={`weather_${refreshKey}`} />
                    </div>
                </div>
            </div>

            <DashboardSettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                initialTab={settingsTab}
                onSettingsSaved={handleSettingsSaved}
            />
        </AdminLayout>
    );
};

export default AdminDashboard;
