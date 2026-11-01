import { useState } from 'react';
import AppShell from './components/layout/AppShell.jsx';
import DashboardView from './components/dashboard/DashboardView.jsx';
import EntriesView from './components/entries/EntriesView.jsx';
import BillsView from './components/bills/BillsView.jsx';
import GroceriesView from './components/groceries/GroceriesView.jsx';
import SettingsView from './components/settings/SettingsView.jsx';
import { VIEWS } from './constants/views.js';

export { VIEWS };

export default function App() {
  const [activeView, setActiveView] = useState(VIEWS.DASHBOARD);

  const renderView = () => {
    switch (activeView) {
      case VIEWS.DASHBOARD:  return <DashboardView />;
      case VIEWS.ENTRIES:    return <EntriesView />;
      case VIEWS.BILLS:      return <BillsView />;
      case VIEWS.GROCERIES:  return <GroceriesView />;
      case VIEWS.SETTINGS:   return <SettingsView />;
      default:               return <DashboardView />;
    }
  };

  return (
    <AppShell activeView={activeView} onNavigate={setActiveView}>
      {renderView()}
    </AppShell>
  );
}
