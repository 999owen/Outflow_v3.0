import { useState } from 'react';
import AppShell from './components/layout/AppShell.jsx';
import { VIEWS } from './constants/views.js';

export { VIEWS };

export default function App() {
  const [activeView, setActiveView] = useState(VIEWS.DASHBOARD);

  return <AppShell activeView={activeView} onNavigate={setActiveView} />;
}
